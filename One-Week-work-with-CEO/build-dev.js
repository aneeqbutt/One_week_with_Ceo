#!/usr/bin/env node

/**
 * Cross-platform build script for development
 * This script builds only what's needed for development (not production packaging)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔨 Building AI Automation Dashboard for Development...\n');

// Create dist directories
console.log('📁 Creating dist directories...');
const dirs = [
  'dist',
  'dist/main',
  'dist/services'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`  ✅ Created ${dir}`);
  } else {
    console.log(`  ℹ️  ${dir} already exists`);
  }
});

// Copy main process files
console.log('\n📋 Copying main process files...');
const mainFiles = ['main.js', 'ipcHandlers.js', 'menu.js', 'preload.js'];
mainFiles.forEach(file => {
  const src = path.join(__dirname, 'src', 'main', file);
  const dest = path.join(__dirname, 'dist', 'main', file);
  fs.copyFileSync(src, dest);
  console.log(`  ✅ Copied ${file}`);
});

// Copy preload.js from root to dist/main (overwrite the one from src/main)
console.log('\n📋 Copying root preload.js (with all API methods)...');
const rootPreload = path.join(__dirname, 'preload.js');
const destPreload = path.join(__dirname, 'dist', 'main', 'preload.js');
fs.copyFileSync(rootPreload, destPreload);
console.log('  ✅ Copied preload.js from root');

// Copy services
console.log('\n📋 Copying services...');
const servicesDir = path.join(__dirname, 'src', 'services');
const destServicesDir = path.join(__dirname, 'dist', 'services');

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ Copied ${entry.name}`);
    }
  }
}

copyRecursive(servicesDir, destServicesDir);

// Build renderer
console.log('\n🎨 Building renderer (React app)...');
try {
  execSync('npx vite build --config vite.renderer.config.ts', {
    cwd: __dirname,
    stdio: 'inherit'
  });
  console.log('  ✅ Renderer built successfully');
} catch (error) {
  console.error('  ❌ Failed to build renderer');
  process.exit(1);
}

console.log('\n✅ Build completed successfully!\n');
console.log('📝 Next steps:');
console.log('  1. Make sure MongoDB is running on localhost:27017');
console.log('  2. In one terminal, run: npm run dev:renderer');
console.log('  3. In another terminal, run: npm run dev');
console.log('  4. Click "+ Create Campaign" to test the fix\n');
