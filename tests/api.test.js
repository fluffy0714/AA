import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../apps/api/server.js';

test('API serves app, validates requests, and refuses unimplemented checkout', async t => {
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/АА — одна корзина/);
 assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const catalog=await(await fetch(base+'/api/catalog')).json();assert.equal(catalog.products.length,12);
 const body={items:[{productId:'milk',quantity:2}],regionId:'moscow-center',scenario:'normal',promo:''};
 const post=payload=>fetch(base+'/api/compare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const result=await post(body);assert.equal(result.status,200);assert.equal((await result.json()).quotes.length,2);
 assert.equal((await post({...body,items:[{productId:'milk',quantity:-1}]})).status,400);
 assert.equal((await fetch(base+'/api/compare',{method:'POST',headers:{'content-type':'application/json'},body:'{broken'})).status,400);
 assert.equal((await fetch(base+'/api/checkout',{method:'POST'})).status,501);
 assert.equal((await fetch(base+'/package.json')).status,404);
 assert.equal((await fetch(base+'/.env')).status,404);
});
