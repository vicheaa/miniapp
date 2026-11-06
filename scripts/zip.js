import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Create a real ZIP with index.html at the archive root, replacing any older archive. */
export function createArchive() {
  const dist = resolve('dist');
  if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html is missing. Run npm run build first.');
  const temporary = mkdtempSync(join(tmpdir(), 'miniapp-zip-'));
  try {
    const archive = join(temporary, 'miniapp.zip');
    execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: dist, stdio: 'inherit' });
    copyFileSync(archive, resolve('miniapp.zip'));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { createArchive(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'ZIP packaging failed.');
    process.exit(1);
  }
}
