import { productArt } from './art.js';
import { getCatalog, compare } from './api-client.js';
const $ = id => document.getElementById(id);
const state = { products: [], cart: new Map(), category: 'Все продукты', search: '', promo: '', data: null, busy: false, request: 0, timer: null, expired: false };
const rub = value => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(value / 100);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const totalCount = () => [...state.cart.values()].reduce((a,b) => a+b, 0);
function stepper(p, quantity) { return `<div class="stepper"><button data-change="-1" data-id="${p.id}" aria-label="Уменьшить количество: ${esc(p.name)}">−</button><span aria-label="Количество">${quantity}</span><button data-change="1" data-id="${p.id}" aria-label="Увеличить количество: ${esc(p.name)}" ${quantity >= 99 ? 'disabled' : ''}>+</button></div>`; }
function renderProducts() {
 const filtered = state.products.filter(p => (state.category === 'Все продукты' || p.category === state.category) && `${p.name} ${p.brand} ${p.size}`.toLowerCase().includes(state.search.toLowerCase()));
 $('catalog-count').textContent = `${filtered.length} из ${state.products.length}`;
 $('products').innerHTML = filtered.length ? filtered.map(p => `<article class="product"><div class="product-art" style="background:${p.color}">${productArt(p.art)}<span class="product-demo">ДЕМО</span></div><div class="product-info"><p class="product-brand">${esc(p.brand)}</p><h3>${esc(p.name)}</h3><p class="product-size">${esc(p.size)}</p><div class="product-bottom"><div class="product-price">от ${rub(p.price)}<span>за упаковку</span></div>${state.cart.has(p.id) ? stepper(p, state.cart.get(p.id)) : `<button class="add-button" data-change="1" data-id="${p.id}" aria-label="Добавить: ${esc(p.name)}">+</button>`}</div></div></article>`).join('') : '<div class="no-results"><h3>Пока ничего не нашли</h3><p>Попробуйте другое название или категорию.</p><button id="reset-search" class="secondary-button">Показать все продукты</button></div>';
 document.querySelectorAll('[data-category]').forEach(b => { const selected = b.dataset.category === state.category; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', selected); });
}
function renderBasket() {
 const count = totalCount();
 $('basket-count').textContent = count; $('mobile-count').textContent = count; $('clear-button').hidden = count === 0;
 $('basket-items').innerHTML = !count ? '<div class="empty-basket"><div class="empty-icon">＋</div><h3>Здесь начинается выгода</h3><p>Добавьте продукты — мы сравним<br>две одинаковые корзины.</p></div>' : [...state.cart].map(([id, quantity]) => {
  const p = state.products.find(p => p.id === id);
  return `<div class="basket-item"><div class="basket-thumb" style="background:${p.color}">${productArt(p.art)}</div><div class="basket-item-info"><b>${esc(p.name)}</b><span>${esc(p.size)}</span></div>${stepper(p, quantity)}</div>`;
 }).join('');
}
function renderQuotes() {
 $('details-button').disabled = !state.data?.quotes.length || state.busy || state.expired;
 if (!totalCount()) { $('quotes').innerHTML = '<div class="quote-placeholder"><span><i class="provider-dot yandex"></i>Яндекс Еда</span><b>—</b></div><div class="quote-placeholder"><span><i class="provider-dot kuper"></i>Купер</span><b>—</b></div>'; return; }
 if (state.busy) { $('quotes').innerHTML = '<p class="quote-loading">Рассчитываем одну и ту же корзину…</p>'; return; }
 if (!state.data) { $('quotes').innerHTML = '<p class="quote-error">Не удалось получить расчёт.</p><button id="retry-button" class="secondary-button">Повторить</button>'; return; }
 if (state.expired) { $('quotes').innerHTML = '<p class="quote-error">Расчёт устарел. Обновите цены перед сравнением.</p><button id="retry-button" class="secondary-button">Обновить расчёт</button>'; return; }
 const { comparison } = state.data;
 $('quotes').innerHTML = state.data.quotes.map(q => `<div class="quote ${comparison.winnerId === q.providerId ? 'winner' : ''}"><div class="quote-top"><span class="provider-name"><i class="provider-dot ${q.providerId}"></i>${esc(q.providerName)}</span>${comparison.winnerId === q.providerId ? '<span class="winner-badge">Выгоднее</span>' : ''}</div>${q.status === 'unavailable' ? '<p class="quote-error">Сервис не ответил</p>' : q.status === 'incomplete' ? `<p class="quote-error">Нет ${q.missing.length} позиции · итога нет</p><p class="microcopy">Неполную корзину нельзя сравнивать с полной.</p>` : `<div class="quote-total"><strong>${rub(q.total)}</strong><span>${q.eta}</span></div><div class="quote-detail"><span>Товары</span><span>${rub(q.subtotal)}</span></div><div class="quote-detail"><span>Доставка и сборы</span><span>${rub(q.delivery+q.service+q.surge)}</span></div>${q.discount ? `<div class="quote-detail discount"><span>Промокод</span><span>−${rub(q.discount)}</span></div>` : ''}`}</div>`).join('') + (comparison.status === 'compared' ? `<p class="savings">Разница в деморасчёте <b>${rub(comparison.savings)}</b></p>` : comparison.status === 'tie' ? '<p class="savings">Полная стоимость одинакова</p>' : '<p class="comparison-warning">Сравнение неполное. Выгодный вариант не определён.</p>') + '<p class="quote-time">Деморасчёт действителен 5 минут <button id="refresh-button" class="text-button">Обновить</button></p>';
}
async function refresh() {
 const request = ++state.request;
 clearTimeout(state.timer); state.expired = false; state.data = null;
 if (!totalCount()) { state.busy = false; if(state.promo) $('promo-note').textContent = 'Добавьте товары, чтобы проверить промокод.'; renderQuotes(); return; }
 state.busy = true; renderQuotes();
 const payload = { items: [...state.cart].map(([productId,quantity])=>({productId,quantity})), regionId: $('region').value, scenario: $('scenario').value, promo: state.promo };
 try {
  const data = await compare(payload);
  if (request !== state.request) return;
  state.data = data;
  const expiry = Math.min(...data.quotes.filter(q=>q.expiresAt).map(q=>Date.parse(q.expiresAt)));
  if (Number.isFinite(expiry)) state.timer = setTimeout(() => { state.expired = true; renderQuotes(); if ($('detail-dialog').open && $('detail-dialog').dataset.kind === 'comparison') showComparison(); }, Math.max(0,expiry-Date.now()));
  if (state.promo) $('promo-note').textContent = data.quotes.some(q=>q.promoStatus === 'applied') ? 'DEMO10 применён к корзине Купера.' : 'Промокод не применён. DEMO10 работает в Купере от 500 ₽ на товары.';
 } catch (error) { if (request !== state.request) return; state.data = null; }
 finally { if (request === state.request) { state.busy = false; renderQuotes(); } }
}
function change(id, amount) {
 const next = Math.max(0, Math.min(99, (state.cart.get(id)||0)+amount));
 if(next) state.cart.set(id,next); else state.cart.delete(id);
 renderProducts(); renderBasket(); refresh();
}
function openDialog(title, body, kind) {
 $('dialog-title').textContent = title; $('dialog-body').innerHTML = body; $('detail-dialog').dataset.kind = kind;
 if (!$('detail-dialog').open) $('detail-dialog').showModal();
}
function showComparison() {
 if (state.expired) return openDialog('Расчёт устарел', '<p>Закройте это окно и обновите расчёт в корзине.</p>', 'comparison');
 if(!state.data) return;
 const qs = state.data.quotes;
 const rows = [...state.cart].map(([id,qty])=>{
  const p=state.products.find(p=>p.id===id);
  return `<tr><th scope="row">${esc(p.name)}<small>${esc(p.size)} × ${qty}</small></th>${qs.map(q=>{const l=q.lines?.find(l=>l.productId===id);return `<td>${!l?'Нет данных':!l.available?'Нет в наличии':rub(l.subtotal)}</td>`;}).join('')}</tr>`;
 }).join('');
 const feeRows = [['subtotal','Товары'],['delivery','Доставка'],['service','Сервисный сбор'],['surge','Повышенный спрос'],['discount','Скидка'],['total','Полная стоимость']].map(([key,label])=>`<tr class="${key==='total'?'total-row':''}"><th scope="row">${label}</th>${qs.map(q=>`<td>${q[key] == null?'—':(key==='discount'&&q[key]?'−':'')+rub(q[key])}</td>`).join('')}</tr>`).join('');
 openDialog('Вся корзина. Все расходы.', `<p class="dialog-intro">Демонстрационные цены, ${esc($('region').selectedOptions[0].textContent)}. Сравниваем одинаковые упаковки и количество.</p><div class="table-wrap"><table><thead><tr><th scope="col">Состав корзины</th>${qs.map(q=>`<th scope="col">${esc(q.providerName)}</th>`).join('')}</tr></thead><tbody>${rows}${feeRows}</tbody></table></div><p class="dialog-note">Если товара нет или сервис не отвечает, полный итог не вычисляется. Пустое значение не означает нулевую цену.</p><div class="checkout-block"><b>Оформление пока недоступно</b><p>Готовая корзина будет передаваться через официальную интеграцию. Сейчас подключение не настроено; реальные заказы не создаются.</p><button class="primary-button" disabled>Перейти к оформлению</button></div>`, 'comparison');
}
function showResearch() {
 openDialog('Что известно об интеграциях', `<p class="dialog-intro">Проверено 22 октября 2026 года. Наличие документации ещё не означает, что проект АА получил доступ.</p><div class="research-card"><h3>Купер <span>Есть направление для интеграции</span></h3><p>Официальный портал описывает Client apps API для клиентских приложений. Отдельный Fulfillment API документирует оформление заказов внешними витринами и опции доставки.</p><p>Условия подключения АА, доступ к магазинам, персональные скидки и перенос корзины в приложение требуют подтверждения.</p><a href="https://docs.kuper.ru/" target="_blank" rel="noopener noreferrer">Портал Купер API ↗</a><a href="https://docs.kuper.ru/api-products/fulfillment/swagger" target="_blank" rel="noopener noreferrer">Fulfillment API ↗</a></div><div class="research-card"><h3>Яндекс Еда <span>Потребительский сценарий не подтверждён</span></h3><p>Проверенная документация Retail API предназначена для интеграции кассовых систем магазинов. Она не подтверждает право АА читать корзину покупателя или оформлять заказ от его имени.</p><a href="https://yandex.ru/support/retail/ru/ref/" target="_blank" rel="noopener noreferrer">Официальный Retail API ↗</a></div><p class="dialog-note">Деморежим не обращается к API агрегаторов. Вымышленные товары и цены нужны только для проверки поведения приложения.</p>`, 'research');
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button'); if(!b)return;
 if(b.dataset.change) change(b.dataset.id,Number(b.dataset.change));
 if(b.dataset.category){state.category=b.dataset.category;renderProducts();}
 if(b.id==='reset-search'){state.search='';state.category='Все продукты';$('search').value='';renderProducts();}
 if(b.id==='retry-button'||b.id==='refresh-button') refresh();
});
$('search').addEventListener('input',e=>{state.search=e.target.value;renderProducts();});
$('region').addEventListener('change',refresh); $('scenario').addEventListener('change',refresh);
$('clear-button').addEventListener('click',()=>{state.cart.clear();renderProducts();renderBasket();refresh();});
$('sample-button').addEventListener('click',()=>{state.cart=new Map([['milk',2],['eggs',1],['bread',1],['tomato',1]]);renderProducts();renderBasket();refresh();$('basket').scrollIntoView({behavior:'smooth',block:'nearest'});});
$('promo-form').addEventListener('submit',event=>{event.preventDefault();state.promo=$('promo').value.trim().toUpperCase();$('promo').value=state.promo;$('promo-note').textContent=state.promo?'Проверяем демопромокод…':'DEMO10: −10% на товары Купера от 500 ₽, до 200 ₽.';refresh();});
$('details-button').addEventListener('click',showComparison);
for(const id of ['research-button','footer-research'])$(id).addEventListener('click',showResearch);
$('how-button').addEventListener('click',()=>openDialog('Собрали один раз. Сравнили целиком.', '<ol class="how-list"><li><b>Соберите корзину</b><p>Выберите товары и количество. Для быстрого знакомства нажмите «Попробовать с примером».</p></li><li><b>Сравните полную стоимость</b><p>В расчёт входят одинаковые товары, доставка, сервисные сборы и применённый демопромокод.</p></li><li><b>Посмотрите детали</b><p>Откройте подробное сравнение или измените сценарий внизу страницы. Сейчас все цены вымышлены, реальные покупки недоступны.</p></li></ol>', 'how'));
$('close-dialog').addEventListener('click',()=>$('detail-dialog').close());
$('detail-dialog').addEventListener('click',event=>{if(event.target===$('detail-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('detail-dialog').open){event.preventDefault();$('search').focus();}});
async function boot(){
 try{
  const data=await getCatalog();state.products=data.products;
  $('region').innerHTML=data.regions.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
  $('categories').innerHTML=['Все продукты',...new Set(state.products.map(p=>p.category))].map(c=>`<button data-category="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('');
  renderProducts();renderBasket();renderQuotes();$('sample-button').disabled=false;
 }catch{ $('startup-error').hidden=false;$('startup-error').innerHTML='Не удалось загрузить каталог. <button id="reload-button" class="text-button">Повторить</button>';$('reload-button').onclick=()=>location.reload();$('products').textContent='Каталог временно недоступен.';$('sample-button').disabled=true; }
}
boot();
