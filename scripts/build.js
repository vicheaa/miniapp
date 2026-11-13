import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createArchive } from './zip.js';
import { loadEnv } from 'vite';

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 26) {
  console.error('This project uses Node 26 LTS. Run nvm use before building.');
  process.exit(1);
}

const args = process.argv.slice(2);
const modes = ['dev', 'staging', 'prod'];
if (args.length > 1 || (args[0] && !modes.includes(args[0].replace(/^--/, '')))) {
  console.error('Usage: npm run build -- [--dev|--staging|--prod]');
  process.exit(1);
}
const mode = args[0]?.replace(/^--/, '') || 'prod';
const env = loadEnv(mode, process.cwd(), 'VITE_');
if (!env.VITE_GOOGLE_MAPS_API_KEY?.trim()) {
  console.error(`VITE_GOOGLE_MAPS_API_KEY is missing in .env.${mode} or the build environment. Configure it before packaging; the location screen requires Google Maps.`);
  process.exit(1);
}

try {
  execFileSync('npm', ['run', 'typecheck'], { stdio: 'inherit' });
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--mode', mode], { stdio: 'inherit' });
  const manifest = JSON.parse(readFileSync(resolve('miniapp.manifest.json'), 'utf8'));
  if (!Number.isInteger(manifest.id) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error('miniapp.manifest.json requires a numeric id and a semantic version.');
  }
  writeFileSync(resolve('dist/miniapp.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  createArchive();
  const bundleHash = createHash('sha256').update(readFileSync(resolve('miniapp.zip'))).digest('hex');
  writeFileSync(resolve('miniapp.release.json'), `${JSON.stringify({ ...manifest, bundleFile: 'miniapp.zip',
    bundleHash, mode, authDiagnosticsEnabled: mode === 'staging' && env.VITE_AUTH_DIAGNOSTICS === 'true' }, null, 2)}\n`);
  console.log(`Built ${mode}: dist/ and miniapp.zip`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Build failed.');
  process.exit(1);
}
