import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'vite';

test('production CSS retains viewport fallbacks required by Sunmi WebView 101', async () => {
  const result = await build({ mode: 'test', logLevel: 'silent', build: { write: false } });
  const bundles = Array.isArray(result) ? result : [result];
  const css = bundles.flatMap((bundle) => bundle.output)
    .filter((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
    .map((file) => String(file.source)).join('\n');
  const pageRule = css.match(/\.products-page\s*\{([^}]+)\}/)?.[1];
  assert.ok(pageRule, 'The production catalog styles must be present.');
  assert.match(pageRule, /(?:^|;)height:100vh(?:;|$)/, 'The build must preserve a height supported by WebView 101.');
  assert.match(pageRule, /height:100vh;[^}]*height:100dvh/, 'Modern viewport height must follow the fallback.');
  const keyboardRule = css.match(/\.keyboard-page\s*\{([^}]+)\}/)?.[1];
  assert.ok(keyboardRule, 'Input screens must use the shared keyboard viewport.');
  assert.match(keyboardRule, /height:var\(--keyboard-viewport-height,\s*100vh\)/, 'The custom property fallback must work before the controller mounts on WebView 101.');
  assert.doesNotMatch(keyboardRule, /var\([^;]*100dvh/, 'An unsupported unit inside var() can invalidate height at computed-value time.');
  const hideActionsRule = css.match(/html\[data-keyboard-actions-hidden=true\][^{]*\{([^}]+)\}/)?.[1];
  assert.ok(hideActionsRule, 'Actions must be hideable before the keyboard viewport threshold.');
  assert.match(hideActionsRule, /visibility:hidden/);
  assert.match(hideActionsRule, /transition:none/, 'Fading out during resize exposes the moving footer for several frames.');
});
