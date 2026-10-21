import test from 'node:test';
import assert from 'node:assert/strict';
import { createKuperFulfillmentClient } from '../providers/kuper/fulfillment-client.js';

const token = 'test-only-not-a-real-token';
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('Kuper probe follows the documented read-only stores endpoint and pagination', async () => {
  let called = 0;
  const client = createKuperFulfillmentClient({ token, fetchImpl: async (url, init) => {
    called++;
    assert.equal(url.origin, 'https://api-gw.k-stage.sbermarket.tech');
    assert.equal(url.pathname, '/api/fulfillment/v1/stores');
    assert.equal(url.searchParams.get('max_page_size'), '5');
    assert.equal(url.searchParams.get('page_token'), 'a+b & c');
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers['Client-Token'], token);
    assert.equal(init.headers['sbm-forward-tenant'], 'sbermarket');
    return response({ data: [{ id: 'test-store' }], next_page_token: 'next' });
  } });
  const result = await client.listStores({ pageSize: 5, pageToken: 'a+b & c' });
  assert.equal(result.data.length, 1); assert.equal(called, 1);
});

test('production is explicit and does not carry sandbox routing headers', async () => {
  const client = createKuperFulfillmentClient({ token, environment: 'production', fetchImpl: async (url, init) => {
    assert.equal(url.origin, 'https://api.kuper.ru');
    assert.equal(init.headers['sbm-forward-tenant'], undefined);
    return response({ data: [] });
  } });
  await client.listStores();
});

test('missing token, unknown environments and invalid pagination fail before network access', async () => {
  assert.throws(() => createKuperFulfillmentClient(), { code: 'NOT_CONFIGURED' });
  assert.throws(() => createKuperFulfillmentClient({ token: '\r\n' }), { code: 'NOT_CONFIGURED' });
  assert.throws(() => createKuperFulfillmentClient({ token, environment: 'https://attacker.example' }), { code: 'INVALID_ENVIRONMENT' });
  const client = createKuperFulfillmentClient({ token, fetchImpl: () => { throw new Error('Must not fetch'); } });
  for (const pageSize of [0, 1001, 1.5, '5']) await assert.rejects(client.listStores({ pageSize }), { code: 'INVALID_INPUT' });
});

test('upstream errors are classified without leaking the token or response body', async () => {
  for (const [status, code] of [[401, 'ACCESS_DENIED'], [403, 'ACCESS_DENIED'], [429, 'RATE_LIMITED'], [500, 'UPSTREAM_ERROR']]) {
    const client = createKuperFulfillmentClient({ token, fetchImpl: async () => new Response(token, { status }) });
    await assert.rejects(client.listStores(), error => error.code === code && !error.message.includes(token));
  }
  const client = createKuperFulfillmentClient({ token, fetchImpl: async () => { throw new Error(token); } });
  await assert.rejects(client.listStores(), error => error.code === 'NETWORK_ERROR' && !error.message.includes(token));
});

test('invalid successful JSON is rejected and request timeout aborts fetch', async () => {
  const invalid = createKuperFulfillmentClient({ token, fetchImpl: async () => response({ stores: [] }) });
  await assert.rejects(invalid.listStores(), { code: 'INVALID_RESPONSE' });
  const client = createKuperFulfillmentClient({ token, timeoutMs: 10, fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(client.listStores(), { code: 'ABORTED' });
});
