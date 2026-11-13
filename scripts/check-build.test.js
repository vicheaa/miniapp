import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

test('packaging: an empty Maps key rejects every build mode before creating a broken location screen', () => {
  for (const mode of ['prod', 'dev', 'staging']) {
    const result = spawnSync(process.execPath, ['scripts/build.js', `--${mode}`], {
      env: { ...process.env, VITE_GOOGLE_MAPS_API_KEY: '   ' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /VITE_GOOGLE_MAPS_API_KEY is missing/);
    assert.match(result.stderr, new RegExp(`\\.env\\.${mode}`));
    assert.doesNotMatch(result.stdout, /tsc|vite|Built/);
  }
});
