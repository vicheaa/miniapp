import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite, ApiError, presentation, Notice, ValidationNotice, session, MemoryRouter, NavigationProvider;
before(async () => {
  vite = await createServer({ mode: 'test', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
  ({ ApiError } = await vite.ssrLoadModule('/src/services/api/request.ts'));
  ({ requestErrorPresentation: presentation } = await vite.ssrLoadModule('/src/services/api/error-presentation.ts'));
  ({ default: Notice, ErrorNotice: ValidationNotice } = await vite.ssrLoadModule('/src/components/ui/RequestErrorNotice.tsx'));
  ({ useMiniAppStore: session } = await vite.ssrLoadModule('/src/store/miniAppStore.ts'));
  ({ MiniAppNavigationProvider: NavigationProvider } = await vite.ssrLoadModule('/src/components/MiniAppNavigation.tsx'));
  ({ MemoryRouter } = await import('react-router-dom'));
});
after(async () => { await vite?.close(); });

const failure = (status, kind = 'http') => new ApiError(
  '[401 Unauthorized] during [POST] to [http://sfa/mobile/staff-order/save/] [SFAApiProxy#staffOrder(JsonNode)]: []',
  { kind, status, url: '/services/central/api/name/staff-order-save/exec', method: 'POST', data: { private: 'backend-detail' } },
);

test('error presentation: session and service failures have distinct guidance without leaking backend details', () => {
  for (const language of ['en', 'km']) {
    session.getState().setLanguage(language);
    for (const status of [401, 403, 404, 422, 429, 500]) {
      const html = renderToStaticMarkup(h(Notice, { error: failure(status), retry() {} }));
      assert.match(html, /role="alert"/);
      assert.match(html, /aria-labelledby=/);
      assert.match(html, /<button/);
      assert.doesNotMatch(html, /HTTP|Unauthorized|SFAApiProxy|http:\/\/sfa|backend-detail|errors\./);
    }
  }
  assert.equal(presentation(failure(401)).titleKey, 'errors.sessionTitle');
  assert.equal(presentation(failure(500)).titleKey, 'errors.serverTitle');
});

test('error presentation: uncertain order outcomes offer order history instead of a blind retry', () => {
  for (const language of ['en', 'km']) {
    session.getState().setLanguage(language);
    for (const error of [failure(500), failure(null, 'network'), failure(null, 'timeout'), failure(200, 'parse'), new Error('Raw server error')]) {
      assert.equal(presentation(error, 'submit').checkOrders, true);
      const html = renderToStaticMarkup(h(MemoryRouter, null, h(NavigationProvider, null, h(Notice, { error, context: 'submit' }))));
      assert.match(html, /href="\/orders"/);
      assert.doesNotMatch(html, /<button|HTTP|Unauthorized|SFAApiProxy|Raw server|errors\./);
    }
  }
  assert.equal(presentation(failure(401), 'submit').checkOrders, false);
  assert.equal(presentation(failure(422), 'submit').checkOrders, false);
});

test('error presentation: known field-validation guidance stays available', () => {
  const html = renderToStaticMarkup(h(ValidationNotice, { title: 'Check your details', message: 'Select the delivery location.' }));
  assert.match(html, /Select the delivery location\./);
});
