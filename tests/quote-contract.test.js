import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBasket } from '../packages/domain/compare.js';
import { createDemoProviders } from '../providers/demo.js';

const now = Date.parse('2026-10-22T00:00:00Z');
const request = { items: [{ productId: 'milk', quantity: 2 }, { productId: 'eggs', quantity: 1 }], regionId: 'moscow-center', scenario: 'normal', promo: '' };
function altered(mutator) {
  const providers = createDemoProviders();
  const original = providers[1].quote;
  providers[1].quote = async (...args) => {
    const quote = await original(...args);
    mutator(quote);
    return quote;
  };
  return providers;
}

test('claimed complete status cannot hide wrong product identity or quantity', async () => {
  for (const [code, mutate] of [
    ['mismatch', q => { q.lines[0].identity += ':900ml'; }],
    ['quantity', q => { q.lines[0].quantity = 1; q.lines[0].subtotal = q.lines[0].unitPrice; q.subtotal -= q.lines[0].unitPrice; }],
  ]) {
    const result = await compareBasket(request, altered(mutate), { now });
    assert.equal(result.comparison.winnerId, null);
    assert.equal(result.quotes[1].total, null);
    assert.ok(result.quotes[1].issues.some(i => i.code === code));
  }
});

test('incomplete, duplicated or additional quote lines are rejected', async () => {
  for (const mutate of [q => q.lines.pop(), q => q.lines.push(q.lines[0]), q => { q.lines[1] = q.lines[0]; }]) {
    const r = await compareBasket(request, altered(mutate), { now });
    assert.equal(r.quotes[1].status, 'unavailable');
    assert.equal(r.quotes[1].issues[0].code, 'invalid_response');
    assert.equal(r.comparison.winnerId, null);
  }
});

test('invalid price arithmetic cannot be trusted even if the advertised total is cheap', async () => {
  for (const mutate of [q => { q.total = 1; }, q => { q.lines[0].unitPrice = -1; }, q => { q.discount = q.subtotal + 1; }, q => { q.service = undefined; }, q => { q.lines[0].subtotal += 1; }]) {
    const r = await compareBasket(request, altered(mutate), { now });
    assert.equal(r.quotes[1].issues[0].code, 'invalid_response');
    assert.equal(r.comparison.winnerId, null);
  }
});

test('unknown charges are distinct from a known zero', async () => {
  const unknown = await compareBasket(request, altered(q => { q.delivery = null; }), { now });
  assert.equal(unknown.quotes[1].delivery, null);
  assert.equal(unknown.quotes[1].issues[0].code, 'fees_unknown');
  const free = await compareBasket(request, altered(q => { q.total -= q.delivery; q.delivery = 0; }), { now });
  assert.equal(free.quotes[1].status, 'complete');
});

test('quotes are bound to the exact request, provider and source mode', async () => {
  for (const mutate of [q => { q.requestKey = 'old-cart'; }, q => { q.providerId = 'yandex'; }, q => { q.mode = 'live'; }]) {
    const r = await compareBasket(request, altered(mutate), { now });
    assert.equal(r.quotes[1].status, 'unavailable');
    assert.equal(r.comparison.winnerId, null);
  }
  const mixed = createDemoProviders(); mixed[1].mode = 'live';
  await assert.rejects(compareBasket(request, mixed, { now }), /modes must match/);
});

test('expired and future-dated quotes never win', async () => {
  const expired = await compareBasket({ ...request, scenario: 'expired' }, createDemoProviders(), { now });
  assert.equal(expired.quotes[1].issues[0].code, 'expired');
  assert.equal(expired.comparison.winnerId, null);
  const future = await compareBasket(request, altered(q => { q.quotedAt = new Date(now + 1000).toISOString(); }), { now });
  assert.equal(future.quotes[1].status, 'unavailable');
});

test('quote expiry is rechecked after waiting for the other provider', async () => {
  let current = now;
  const providers = createDemoProviders();
  const original = providers[1].quote;
  providers[1].quote = async (...args) => { const q = await original(...args); current += 360000; return q; };
  const r = await compareBasket(request, providers, { clock: () => current });
  assert.equal(r.comparison.winnerId, null);
  assert.ok(r.quotes.every(q => q.total === null));
});

test('a hung provider times out and is signalled to abort without losing the good quote', async () => {
  const providers = createDemoProviders(); let signal;
  providers[1].quote = async (_, options) => { signal = options.signal; return new Promise(() => {}); };
  const r = await compareBasket(request, providers, { now, timeoutMs: 20 });
  assert.equal(r.quotes[0].status, 'complete');
  assert.equal(r.quotes[1].issues[0].code, 'timeout');
  assert.equal(signal.aborted, true);
});

test('providers cannot mutate the basket seen by another provider or caller', async () => {
  const providers = createDemoProviders();
  providers[0].quote = async input => { input.items.length = 0; throw null; };
  const r = await compareBasket(request, providers, { now });
  assert.equal(r.quotes[0].status, 'unavailable');
  assert.equal(r.quotes[1].lines.length, 2);
  assert.equal(request.items.length, 2);
});
