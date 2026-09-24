Mapleframe art-pipeline
========================

Same worker as KidsBooksAutomation, pointed at a separate jobs/output/results
set so game-art jobs don't mix with book jobs. It polls jobs\ and calls
OpenRouter's image API for you, because OpenRouter can't be reached from
Claude's cloud sandbox.

To run it: double-click start_worker.bat. Leave the console window open
while it works — Claude will tell you when to start it and when a batch
is done.

Folders:
  jobs\      - job JSON files waiting to be processed (Claude drops these in)
  jobs\done\ - processed job files get moved here
  output\    - generated images land here (Claude picks them up from here)
  results\   - one <job_id>.result.json per job, with status/cost/output paths

openrouter_config.json holds the API key (same one as KidsBooksAutomation).
Keep this file local — never paste the key into chat.
