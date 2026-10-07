/**
 * Copies Next.js static assets into the standalone output so Electron can
 * run `node server.js` from frontend/.next/standalone (or packaged extraResources).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const frontend = path.join(root, 'frontend');
const standalone = path.join(frontend, '.next', 'standalone');
const staticSrc = path.join(frontend, '.next', 'static');
const staticDest = path.join(standalone, '.next', 'static');
const publicSrc = path.join(frontend, 'public');
const publicDest = path.join(standalone, 'public');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Skip missing: ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`Copied ${src} -> ${dest}`);
}

if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error(
    'Standalone build missing. Run "npm run build --prefix frontend" first (output: standalone).'
  );
  process.exit(1);
}

copyDir(staticSrc, staticDest);
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
}

console.log('Desktop frontend prepare done.');
