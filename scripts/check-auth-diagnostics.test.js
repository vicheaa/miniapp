import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'vite';

test('auth diagnostics: only an opted-in staging bundle includes the console sink', async () => {
  for (const [mode, enabled, expected] of [['prod', 'true', false], ['staging', 'false', false], ['staging', 'true', true]]) {
    const result = await build({ mode, logLevel: 'silent',
      define: { 'import.meta.env.VITE_AUTH_DIAGNOSTICS': JSON.stringify(enabled) }, build: { write: false } });
    const bundles = Array.isArray(result) ? result : [result];
    const code = bundles.flatMap((bundle) => bundle.output)
      .filter((item) => item.type === 'chunk').map((item) => item.code).join('\n');
    assert.equal(code.includes('[Miniapp Auth]'), expected, `${mode}, opt-in=${enabled}`);
  }
});
