import { test, expect, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { reportPdf } from './pdf-fixture';

// These are current browser engines with APIs deliberately removed. They
// exercise fallbacks; the UA strings do not turn them into old OS versions.
async function prepare(page: Page, options: {
  delay?: number; token?: string; noBridge?: boolean; blockedStorage?: boolean;
  oldBridge?: boolean; pendingSettings?: boolean; pendingToken?: boolean; missingWorker?: boolean;
} = {}) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Prevent tests from reaching a real business API. Test the task screen's
  // existing offline error path after native authentication completes.
  await page.route('**/services/**', route => route.abort('internetdisconnected'));
  await page.addInitScript((opts) => {
    for (const [object, key] of [
      [Object, 'hasOwn'], [Promise, 'withResolvers'], [Promise, 'any'],
      [Array.prototype, 'at'], [String.prototype, 'replaceAll'],
      [window, 'structuredClone'], [window, 'ResizeObserver'], [window, 'IntersectionObserver'],
      [ArrayBuffer.prototype, 'transfer'], [ArrayBuffer.prototype, 'transferToFixedLength'],
    ] as const) {
      Object.defineProperty(object, key, { value: undefined, configurable: true, writable: true });
    }
    if (opts.missingWorker) Object.defineProperty(window, 'Worker', { value: undefined, configurable: true });
    if (opts.blockedStorage) {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('Storage unavailable', 'SecurityError'); },
      });
    }
    if (opts.noBridge) return;
    const install = () => {
      const native: Record<string, unknown> = {
        getAuthToken: () => opts.pendingToken ? new Promise(() => {}) : Promise.resolve(opts.token ?? 'compatibility-test-token'),
        showToast() {}, close() {},
      };
      if (!opts.oldBridge) Object.assign(native, {
        ready() {}, setTitle() {}, on() {}, setPullToRefreshEnabled() {},
        getInitParams: () => opts.pendingSettings ? new Promise(() => {}) : Promise.resolve({}),
        getLocalization: () => opts.pendingSettings ? new Promise(() => {}) : Promise.resolve({ language: 'en' }),
      });
      (window as unknown as { superApp: unknown }).superApp = native;
    };
    if (opts.delay) {
      (window as unknown as { superApp: unknown }).superApp = {};
      setTimeout(install, opts.delay);
    }
    else install();
  }, options);
  return errors;
}

test('starts with missing APIs and blocked storage; menus retain usable styling', async ({ page }, info) => {
  const errors = await prepare(page, { blockedStorage: true });
  const requestedAssets: string[] = [];
  page.on('request', request => requestedAssets.push(request.url()));
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.splash-init, .bootstrap-skeleton')).toHaveCount(0);
  const search = page.getByPlaceholder('Search tasks, keys, requestors...');
  await expect(search).toHaveCSS('height', '40px');
  await expect(search).toHaveCSS('padding-left', '36px');
  await expect(search).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('main')).toHaveCSS('display', 'block');
  await page.getByRole('button', { name: 'My Tasks' }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(menu).toHaveCSS('padding', '4px');
  await expect(menu).toHaveCSS('opacity', '1');
  await expect(page.getByRole('menuitemradio', { name: 'Available Tasks' })).toBeVisible();
  expect(await page.evaluate(() => [typeof Object.hasOwn, typeof structuredClone, typeof (Promise as any).withResolvers])).toEqual(['function', 'function', 'function']);
  expect(requestedAssets.some(url => /pdf-renderer|pdf\.worker/.test(url))).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('menu.png'), animations: 'disabled' });
  await page.getByRole('menuitemradio', { name: 'Available Tasks' }).click();
  await expect(page.getByRole('button', { name: 'Available Tasks' })).toBeVisible();
});

test('waits for slow native injection instead of selecting a mock login', async ({ page }) => {
  const errors = await prepare(page, { delay: 1500 });
  let authorization: string | undefined;
  page.on('request', request => {
    if (request.url().includes('/services/')) authorization = request.headers().authorization;
  });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect.poll(() => authorization).toBe('Bearer compatibility-test-token');
  await expect(page.getByText('DEV', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an older bridge without optional settings methods can open the task list', async ({ page }) => {
  const errors = await prepare(page, { oldBridge: true });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toEqual([]);
});

test('optional native settings that never reply do not keep loading forever', async ({ page }) => {
  const errors = await prepare(page, { pendingSettings: true });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.bootstrap-skeleton')).toBeVisible();
  await page.clock.fastForward(5500);
  await page.clock.fastForward(5500);
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a missing production bridge shows recovery without sending a mock token', async ({ page }) => {
  const errors = await prepare(page, { noBridge: true });
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/services/')) requests.push(request.url()); });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.bootstrap-skeleton')).toBeVisible();
  await page.clock.fastForward(16000);
  await expect(page.getByText('Unable to connect to the Super App.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('an empty native token shows recovery instead of an endless skeleton', async ({ page }) => {
  const errors = await prepare(page, { token: '' });
  await page.goto('/');
  await expect(page.getByText('The Super App could not sign you in.', { exact: false })).toBeVisible();
  await expect(page.locator('.bootstrap-skeleton')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a native sign-in call that never replies shows recovery', async ({ page }) => {
  const errors = await prepare(page, { pendingToken: true });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.bootstrap-skeleton')).toBeVisible();
  await page.clock.fastForward(11000);
  await expect(page.getByText('Sign-in timed out.', { exact: false })).toBeVisible();
  await expect(page.locator('.bootstrap-skeleton')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const missingWorker of [false, true]) {
for (const font of ['standard', 'embedded', 'cmap'] as const) {
test(`the production PDF renderer paints ${font} text ${missingWorker ? 'without' : 'with'} native workers`, async ({ page }, info) => {
  const errors = await prepare(page, { missingWorker });
  // Init scripts do not run in workers. Remove the newer buffer APIs there
  // too: PDF.js serializes every font with transferToFixedLength.
  await page.route(/\/assets\/pdf\.worker-.*\.js$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `delete ArrayBuffer.prototype.transfer; delete ArrayBuffer.prototype.transferToFixedLength;\n${await response.text()}` });
  });
  const warnings: string[] = [];
  page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
  // Simulate a WebView whose native font renderer silently paints no text.
  // Android must still paint PDF text via glyph outlines.
  if (info.project.name.startsWith('android')) {
    await page.addInitScript(() => {
      CanvasRenderingContext2D.prototype.fillText = () => {};
      CanvasRenderingContext2D.prototype.strokeText = () => {};
    });
  }
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  const files = readdirSync('dist/assets');
  const result = await page.evaluate(async ({ renderer, worker, data }) => {
    const pdf = await import(`/assets/${renderer}`);
    pdf.GlobalWorkerOptions.workerSrc = `/assets/${worker}`;
    const task = pdf.getDocument({ data: new Uint8Array(data) });
    try {
      const doc = await task.promise;
      const pdfPage = await doc.getPage(1);
      const canvas = document.createElement('canvas');
      const viewport = pdfPage.getViewport({ scale: 1 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvas, viewport }).promise;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d')!;
      const darkPixels = (x: number, y: number, width: number, height: number) => {
        const pixels = ctx.getImageData(x, y, width, height).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) count++;
        }
        return count;
      };
      return {
        pages: doc.numPages, width: canvas.width,
        logo: Array.from(ctx.getImageData(15, 20, 1, 1).data),
        titlePixels: darkPixels(10, 30, 180, 25),
        bodyPixels: darkPixels(20, 85, 170, 20),
        text: (await pdfPage.getTextContent()).items.map((item: { str?: string }) => item.str || '').join(' '),
      };
    } finally {
      await task.destroy();
    }
  }, { renderer: files.find(f => /^pdf-renderer-.*\.js$/.test(f))!, worker: files.find(f => /^pdf\.worker-.*\.js$/.test(f))!, data: reportPdf(font) });
  expect(result.pages).toBe(1);
  expect(result.width).toBe(200);
  expect(result.logo).toEqual([255, 204, 0, 255]);
  expect(result.titlePixels).toBeGreaterThan(100);
  expect(result.bodyPixels).toBeGreaterThan(50);
  expect(result.text).toContain('NCM-005125');
  expect(warnings.filter(warning => /font|cmap|glyph|ignoring errors/i.test(warning))).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('pdf-text.png'), animations: 'disabled' });
});
}
}
