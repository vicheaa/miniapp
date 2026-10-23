import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Compile these dependency-free utilities without starting a server or contacting a real printer.
const load = async (path, replace = (code) => code) => {
  const code = replace(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
};
const pricingCode = ts.transpileModule(fs.readFileSync('src/utils/pos-pricing.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const pricingUrl = `data:text/javascript;base64,${Buffer.from(pricingCode).toString('base64')}`;
const { buildReceipt, wrapReceiptText, RECEIPT_COLUMNS } = await load('src/utils/receipt.ts', (code) => code.replace("'./pos-pricing'", JSON.stringify(pricingUrl)));
const { printReceipt, openPrinterSettings } = await load('src/services/bridge/printer.ts');
const payload = {
  customer_name: 'VIP Member', customer_phone: null, currency: 'USD', second_currency: 'KHR', second_grand_total: 10000,
  notes: 'Please pack carefully\nOrder source: Table 01',
  items: [{ product_id: 'hot-latte', quantity: 2, price: 5000/4100, notes: 'No lid' }],
};
const draft = { id: 1, lines: [{ name: 'Hot Latte', options: 'Sweetness: 0%' }] };
const app = { name: 'Main Register', merchant: { name: 'Chamkar Coffee' } };
const receipt = buildReceipt(payload, draft, app, 'order-123', new Date('2026-10-18T00:00:00Z'));
for (const text of ['Chamkar Coffee', 'Main Register', 'Order: order-123', 'Hot Latte', 'Sweetness: 0%', '2 x $1.22', '$2.44', '10,000 KHR', 'Payment: CASH', 'Status: PAID', 'No lid', 'Order source: Table 01']) assert.ok(receipt.text.includes(text), text);
assert.equal(RECEIPT_COLUMNS, 48);
assert.ok(!receipt.text.startsWith('\n'), 'Receipt should start without blank header lines');
assert.ok(receipt.text.endsWith('Thank you!\n'), 'Receipt should end with one line terminator');
assert.ok(!receipt.text.endsWith('\n\n'), 'Native paper feed should not be duplicated by blank footer lines');
assert.ok(receipt.text.split('\n').every((line) => Array.from(line).length <= 48));
for (const label of ['TOTAL ', 'TOTAL KHR', '2 x ']) {
  const line = receipt.text.split('\n').find((value) => value.startsWith(label));
  assert.equal(line.length, 48, `${label} should use the full printable width`);
}
assert.ok(receipt.text.includes('-'.repeat(48)));
const orderHeading = 'Order: 01a14cc6-36d6-712c-a39e-70b82e3539f3';
assert.equal(wrapReceiptText(orderHeading), orderHeading);
const longReceipt = buildReceipt({ ...payload, customer_name: 'Customer '.repeat(15), notes: 'Long note '.repeat(20) },
  { ...draft, lines: [{ name: 'Coffee '.repeat(20), options: 'Sweetness: 100%' }] }, app, 'x'.repeat(100));
assert.ok(longReceipt.text.split('\n').every((line) => Array.from(line).length <= 48));
assert.equal(wrapReceiptText('x'.repeat(49)), `${'x'.repeat(48)}\nx`);
const unsafe = buildReceipt({ ...payload, customer_name: '\x1b@VIP\x00', notes: '\x1dV\x01' }, draft, app);
assert.equal(/[\x00-\x09\x0b-\x1f\x7f]/.test(unsafe.text), false);
assert.ok(unsafe.text.includes('Register order: #1'));
let calls = [];
const bridge = { printText: async (...args) => { calls.push(args); }, openPrinterSettings: async () => { calls.push('settings'); } };
await printReceipt(bridge, receipt.text);
assert.deepEqual(calls, [[receipt.text, true]]);
await openPrinterSettings(bridge);
assert.equal(calls[1], 'settings');
await assert.rejects(printReceipt(null, receipt.text), /unavailable/);
await assert.rejects(printReceipt({ printText: async () => ({ success: false, message: 'Not connected' }) }, receipt.text), /Not connected/);
await assert.rejects(printReceipt({ printText: async () => false }, receipt.text), /could not print/);
await assert.rejects(printReceipt({ printText: async () => { throw new Error('Offline'); } }, receipt.text), /Offline/);
await assert.rejects(openPrinterSettings({}), /unavailable/);
const { createMockBridge } = await load('src/services/bridge/mock-bridge.ts');
const mock = createMockBridge('test');
await assert.rejects(printReceipt(mock, receipt.text), /Browser preview only/);
console.log('Passed: 48-column receipt layout, aligned USD/KHR totals, UUID order heading, long-text wrapping, control-character removal, printText(text, true), printer settings, rejected/failed jobs, and browser mock preview.');
