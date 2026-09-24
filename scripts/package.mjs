// Zips dist/ into release/<game>-<platform>-v<version>.zip — the file
// you upload to CrazyGames / Poki / itch.io. Works on Windows, Mac, Linux.
import AdmZip from 'adm-zip';
import { readFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const platform = process.argv[2] ?? 'web';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const cfg = readFileSync('src/config.js', 'utf8');
const id = (cfg.match(/id:\s*'([^']+)'/) ?? [])[1] ?? pkg.name;
const version = (cfg.match(/version:\s*'([^']+)'/) ?? [])[1] ?? pkg.version;

const size = (dir) => readdirSync(dir).reduce((s, f) => {
  const p = join(dir, f); const st = statSync(p);
  return s + (st.isDirectory() ? size(p) : st.size);
}, 0);

mkdirSync('release', { recursive: true });
const out = `release/${id}-${platform}-v${version}.zip`;
const zip = new AdmZip();
zip.addLocalFolder('dist');   // index.html at zip root (portals require this)
zip.writeZip(out);

const mb = (b) => (b / 1024 / 1024).toFixed(2);
const built = size('dist');
console.log(`\n✔ ${out}  (build ${mb(built)} MB, zip ${mb(statSync(out).size)} MB)`);
if (built > 20 * 1024 * 1024) console.warn('⚠ Build is over 20 MB — CrazyGames recommends staying under 20 MB.');
