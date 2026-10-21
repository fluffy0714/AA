import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBasket, rankQuotes, validateRequest, InputError } from '../packages/domain/compare.js';
import { createDemoProviders } from '../providers/demo.js';

const now = Date.parse('2026-10-22T00:00:00Z');
const input = { items: [{ productId: 'milk', quantity: 2 }, { productId: 'eggs', quantity: 1 }, { productId: 'bread', quantity: 1 }, { productId: 'tomato', quantity: 1 }], regionId: 'moscow-center', scenario: 'normal', promo: '' };
const compare = overrides => compareBasket({ ...input, ...overrides }, createDemoProviders(), { now });

test('full totals include delivery and service; cheaper items do not guarantee a cheaper basket', async () => {
 const r = await compare({});
 const [y,k] = r.quotes;
 assert.equal(y.subtotal,64950); assert.equal(k.subtotal,62450);
 assert.equal(y.total,78750); assert.equal(k.total,80250);
 assert.equal(r.comparison.winnerId,'yandex');assert.equal(r.comparison.savings,1500);
 assert.ok(r.quotes.every(q=>q.checkout.available===false));
});
test('promo is evaluated per provider and changes the winner', async () => {
 const r=await compare({promo:' demo10 '});
 assert.equal(r.quotes[0].discount,0);assert.equal(r.quotes[1].discount,6245);
 assert.equal(r.quotes[1].total,74005);assert.equal(r.comparison.winnerId,'kuper');
});
test('discount threshold and cap use integer kopecks', async () => {
 const low=await compare({items:[{productId:'milk',quantity:1}],promo:'DEMO10'});
 assert.equal(low.quotes[1].discount,0);
 const high=await compare({items:[{productId:'coffee',quantity:20}],promo:'DEMO10'});
 assert.equal(high.quotes[1].discount,20000);assert.equal(high.quotes[1].delivery,0);
});
test('delivery free threshold uses amount after discount', async () => {
 const r=await compare({items:[{productId:'milk',quantity:17}],promo:'DEMO10'});
 assert.equal(r.quotes[1].subtotal,186830);assert.equal(r.quotes[1].delivery,14900);
});
test('regional delivery and surge both change full totals', async () => {
 const r=await compare({regionId:'moscow-outer',scenario:'busy'});
 assert.equal(r.quotes[0].total,98650);assert.equal(r.quotes[1].total,95150);
 assert.equal(r.comparison.winnerId,'kuper');
});
test('missing item never produces a false winner or partial full total', async () => {
 const r=await compare({scenario:'missing'});
 assert.equal(r.quotes[1].status,'incomplete');assert.equal(r.quotes[1].total,null);
 assert.deepEqual(r.quotes[1].missing,['milk']);assert.equal(r.comparison.winnerId,null);assert.equal(r.comparison.savings,null);
});
test('one provider failure preserves the other quote without ranking', async () => {
 const r=await compare({scenario:'outage'});
 assert.equal(r.quotes[0].status,'complete');assert.equal(r.quotes[1].status,'unavailable');assert.equal(r.comparison.status,'incomplete');
});
test('empty basket has no delivery fees or winner', async () => {
 const r=await compare({items:[]});assert.deepEqual(r.quotes,[]);assert.equal(r.comparison.status,'empty');
});
test('expired, invalid, or unknown totals cannot be ranked; ties have no winner', () => {
 const q={status:'complete',total:100,expiresAt:new Date(now+1000).toISOString()};
 assert.equal(rankQuotes([{...q,providerId:'a'},{...q,providerId:'b'}],now).status,'tie');
 for (const invalid of [{total:null},{total:NaN},{total:-1},{total:1.5},{expiresAt:new Date(now).toISOString()}]) {
  assert.equal(rankQuotes([q,{...q,...invalid}],now).status,'incomplete');
 }
});
test('rejects invalid quantities, unknown products, duplicates and untrusted client prices', async () => {
 for(const quantity of [0,-1,1.5,100,'2',null]) assert.throws(()=>validateRequest({...input,items:[{productId:'milk',quantity}]}),InputError);
 for(const items of [[{productId:'unknown',quantity:1}],[{productId:'milk',quantity:1},{productId:'milk',quantity:2}], [null]]) assert.throws(()=>validateRequest({...input,items}),InputError);
 for(const invalid of [{regionId:'unknown'},{scenario:'unknown'},{promo:123},{items:null}]) assert.throws(()=>validateRequest({...input,...invalid}),InputError);
 const r=await compare({items:[{productId:'milk',quantity:1,unitPrice:1}]});assert.equal(r.quotes[0].subtotal,11490);
});
