import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';

const html = readFileSync('dist/index.html', 'utf8');
const scripts = new Map();
for (const name of readdirSync('dist/assets').filter(name => /\.m?js$/.test(name))) {
  const source = ts.createSourceFile(name, readFileSync(`dist/assets/${name}`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  scripts.set(name, source);
  const pending = [source];
  while (pending.length) {
    const node = pending.pop();
    assert.ok(!ts.isClassStaticBlockDeclaration(node), `${name}: untransformed class static block`);
    assert.ok(!(ts.isMethodDeclaration(node) && ts.isPrivateIdentifier(node.name)), `${name}: untransformed private method`);
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      assert.ok(!/\(\?<([=!])/.test(node.text), `${name}: regex lookbehind unsupported on older iOS`);
    }
    ts.forEachChild(node, child => { pending.push(child); });
  }
}

const entry = html.match(/type="module"[^>]*src="\.\/assets\/([^\"]+)"/)?.[1];
assert.ok(entry, 'Missing application entry');
const eager = new Set();
function trace(name) {
  if (eager.has(name)) return;
  eager.add(name);
  assert.ok(!/^pdf[.-]/.test(name), 'PDF renderer must remain outside the startup imports');
  for (const statement of scripts.get(name).statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier) {
      trace(path.basename(statement.moduleSpecifier.text));
    }
  }
}
trace(entry);
assert.ok(!/modulepreload[^>]*pdf/.test(html), 'PDF renderer must not be preloaded');

for (const name of readdirSync('dist/assets').filter(name => name.endsWith('.css'))) {
  const css = postcss.parse(readFileSync(`dist/assets/${name}`, 'utf8'));
  css.walkAtRules(rule => {
    assert.ok(!['layer', 'property', 'theme', 'utility', 'custom-variant'].includes(rule.name), `${name}: CSS requires a newer styling engine (${rule.name})`);
  });
  css.walkDecls(declaration => {
    assert.ok(!/\b(?:oklch|oklab|color-mix)\(/.test(declaration.value), `${name}: color needs an older-browser fallback`);
  });
}
console.log('Compatibility checks passed: older-browser syntax/CSS and deferred PDF loading.');
