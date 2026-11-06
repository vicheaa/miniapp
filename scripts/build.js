import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createArchive } from './zip.js';

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

try {
  execFileSync('npm', ['run', 'typecheck'], { stdio: 'inherit' });
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--mode', mode], { stdio: 'inherit' });
  createArchive();
  console.log(`Built ${mode}: dist/ and miniapp.zip`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Build failed.');
  process.exit(1);
}
