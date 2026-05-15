import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..');
const srcMainDir = path.join(root, 'src', 'main');
const srcServicesDir = path.join(root, 'src', 'services');
const distMainDir = path.join(root, 'dist', 'main');
const distServicesDir = path.join(root, 'dist', 'services');
const srcScriptsDir = path.join(root, 'scripts');
const distScriptsDir = path.join(root, 'dist', 'scripts');
const srcUtilsDir = path.join(root, 'src', 'utils');
const distUtilsDir = path.join(root, 'dist', 'utils');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFile(srcPath, destPath);
    }
  }
}

ensureDir(distMainDir);
ensureDir(distServicesDir);

// Copy main process files
for (const file of ['main.js', 'ipcHandlers.js', 'menu.js', 'preload.js', 'logger.js']) {
  const src = path.join(srcMainDir, file);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(distMainDir, file));
  }
}

// Copy services directory
if (fs.existsSync(srcServicesDir)) {
  copyDir(srcServicesDir, distServicesDir);
}

// Copy scripts directory so packaged app has runtime scripts (e.g. starRepositories.js)
if (fs.existsSync(srcScriptsDir)) {
  copyDir(srcScriptsDir, distScriptsDir);
}

// Copy utils directory so helper utilities are available in packaged app
if (fs.existsSync(srcUtilsDir)) {
  copyDir(srcUtilsDir, distUtilsDir);
}

console.log('✅ Copied main and services to dist');
