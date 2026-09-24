"""
OpenRouter image-generation worker.

Polls jobs\ for job JSON files, calls the OpenRouter unified Image API for
each step in order, saves generated images to disk, and writes a result
JSON per job to results\. Mirrors the EtsyAutomation worker's job/done/
results pattern so it's easy to reason about alongside it.

Job file schema (jobs\<job_id>.json):
{
  "job_id": "001_reference_sheet",
  "steps": [
    {
      "step_id": "ref_sheet",              // unique within the job
      "model": "google/gemini-3-pro-image",
      "prompt": "...",
      "resolution": "2K",                  // optional, default "2K"
      "aspect_ratio": "4:3",                // optional
      "output_file": "output/01_ref.png",   // relative to this folder
      "input_references": [                 // optional
        {"type": "file", "path": "output/some_earlier.png"},
        {"type": "step_output", "step_id": "ref_sheet"},   // same job only
        {"type": "url", "url": "https://..."}
      ]
    }
  ]
}

Steps within a job run strictly in order, one at a time, so a later step
can reference an image an earlier step in the SAME job just produced
(via step_output) or one produced by an earlier job entirely (via file,
pointing at that job's already-written output_file). Jobs themselves are
also processed one at a time, in filename-sorted order, so job_001's
outputs exist on disk before job_002 is even read.
"""

import base64
import json
import mimetypes
import os
import sys
import time
import traceback

import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JOBS_DIR = os.path.join(BASE_DIR, "jobs")
DONE_DIR = os.path.join(JOBS_DIR, "done")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
CONFIG_PATH = os.path.join(BASE_DIR, "openrouter_config.json")
API_URL = "https://openrouter.ai/api/v1/images"
POLL_SECONDS = 5

for d in (JOBS_DIR, DONE_DIR, RESULTS_DIR):
    os.makedirs(d, exist_ok=True)


def load_api_key():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    key = cfg.get("api_key")
    if not key:
        raise RuntimeError(f"No api_key found in {CONFIG_PATH}")
    return key


def file_to_data_url(path):
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    mime, _ = mimetypes.guess_type(path)
    mime = mime or "image/png"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def resolve_input_references(refs, step_outputs):
    """refs: list of {"type": "file"|"step_output"|"url", ...}
    step_outputs: dict of step_id -> absolute output file path, for steps
    already completed earlier in THIS job."""
    resolved = []
    for ref in refs or []:
        rtype = ref.get("type")
        if rtype == "file":
            url = file_to_data_url(ref["path"])
        elif rtype == "step_output":
            sid = ref["step_id"]
            if sid not in step_outputs:
                raise RuntimeError(
                    f"input_references step_output '{sid}' not found "
                    f"(must be an earlier step in the same job)"
                )
            url = file_to_data_url(step_outputs[sid])
        elif rtype == "url":
            url = ref["url"]
        else:
            raise RuntimeError(f"Unknown input_reference type: {rtype!r}")
        resolved.append({"type": "image_url", "image_url": {"url": url}})
    return resolved


def run_step(api_key, step, step_outputs):
    payload = {
        "model": step["model"],
        "prompt": step["prompt"],
    }
    if step.get("resolution"):
        payload["resolution"] = step["resolution"]
    if step.get("aspect_ratio"):
        payload["aspect_ratio"] = step["aspect_ratio"]
    refs = resolve_input_references(step.get("input_references"), step_outputs)
    if refs:
        payload["input_references"] = refs

    resp = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:2000]}")

    body = resp.json()
    data = body.get("data") or []
    if not data:
        raise RuntimeError(f"No image data in response: {json.dumps(body)[:2000]}")

    img_b64 = data[0].get("b64_json")
    if not img_b64:
        raise RuntimeError(f"No b64_json in response: {json.dumps(body)[:2000]}")

    out_path = step["output_file"]
    if not os.path.isabs(out_path):
        out_path = os.path.join(BASE_DIR, out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(img_b64))

    cost = (body.get("usage") or {}).get("cost")
    return out_path, cost


def process_job(api_key, job_path):
    with open(job_path, "r", encoding="utf-8") as f:
        job = json.load(f)

    job_id = job.get("job_id") or os.path.splitext(os.path.basename(job_path))[0]
    print(f"[{job_id}] starting, {len(job.get('steps', []))} step(s)")

    step_outputs = {}
    results = []
    status = "success"
    error = None

    for step in job.get("steps", []):
        step_id = step["step_id"]
        try:
            out_path, cost = run_step(api_key, step, step_outputs)
            step_outputs[step_id] = out_path
            results.append({
                "step_id": step_id,
                "status": "success",
                "output_file": out_path,
                "cost": cost,
            })
            print(f"[{job_id}] step '{step_id}' -> {out_path} (cost: {cost})")
        except Exception as e:
            err_text = f"{e}"
            results.append({
                "step_id": step_id,
                "status": "error",
                "error": err_text,
            })
            print(f"[{job_id}] step '{step_id}' FAILED: {err_text}")
            status = "error"
            error = err_text
            break  # stop the job; later steps likely depend on this one

    result_path = os.path.join(RESULTS_DIR, f"{job_id}.result.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump({
            "job_id": job_id,
            "status": status,
            "error": error,
            "steps": results,
        }, f, indent=2)

    done_path = os.path.join(DONE_DIR, os.path.basename(job_path))
    os.replace(job_path, done_path)
    print(f"[{job_id}] done, status={status}")


def main():
    print("OpenRouter image worker starting.")
    print(f"Watching: {JOBS_DIR}")
    api_key = load_api_key()

    while True:
        try:
            job_files = sorted(
                f for f in os.listdir(JOBS_DIR)
                if f.endswith(".json") and os.path.isfile(os.path.join(JOBS_DIR, f))
            )
            for fname in job_files:
                job_path = os.path.join(JOBS_DIR, fname)
                try:
                    process_job(api_key, job_path)
                except Exception:
                    print(f"Unexpected error processing {fname}:")
                    traceback.print_exc()
        except Exception:
            print("Unexpected error in poll loop:")
            traceback.print_exc()
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
