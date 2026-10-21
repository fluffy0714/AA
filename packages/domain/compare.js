import { catalog, regions } from './catalog.js';
import { fetchQuote } from './quote.js';

export class InputError extends Error {}

export function validateRequest(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.items) || input.items.length > 50) throw new InputError('Передайте корзину: не более 50 позиций.');
  if (!regions.some(r => r.id === input.regionId)) throw new InputError('Выберите доступный деморайон.');
  if (!['normal', 'busy', 'missing', 'outage', 'mismatch', 'fees_unknown', 'expired'].includes(input.scenario)) throw new InputError('Неизвестный сценарий.');
  if (typeof input.promo !== 'string' || input.promo.length > 32) throw new InputError('Промокод: не более 32 символов.');
  const ids = new Set();
  for (const item of input.items) {
    if (!item || !catalog.some(p => p.id === item.productId)) throw new InputError('Неизвестный товар.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new InputError('Количество должно быть целым числом от 1 до 99.');
    if (ids.has(item.productId)) throw new InputError('Объедините повторяющиеся товары.');
    ids.add(item.productId);
  }
  return { items: input.items.map(({ productId, quantity }) => ({ productId, quantity })), regionId: input.regionId, scenario: input.scenario, promo: input.promo.trim().toUpperCase() };
}

// No winner unless BOTH providers priced the exact, complete basket with known fees.
export function rankQuotes(quotes, now = Date.now()) {
  const eligible = quotes.filter(q => q.status === 'complete' && Number.isSafeInteger(q.total) && q.total >= 0 && Date.parse(q.expiresAt) > now);
  if (quotes.length !== 2 || eligible.length !== 2 || new Set(quotes.map(q => q.providerId)).size !== 2 || new Set(quotes.map(q => q.mode)).size !== 1) return { status: 'incomplete', winnerId: null, savings: null };
  const [first, second] = [...eligible].sort((a, b) => a.total - b.total);
  const savings = second.total - first.total;
  return { status: savings === 0 ? 'tie' : 'compared', winnerId: savings ? first.providerId : null, savings };
}

export async function compareBasket(raw, providers, options = {}) {
  const clock = options.clock ?? (options.now === undefined ? Date.now : () => options.now);
  const now = clock();
  const timeoutMs = options.timeoutMs ?? 4000;
  if (providers.length !== 2 || new Set(providers.map(p => p.id)).size !== 2) throw new Error('Exactly two different providers are required');
  if (!providers.every(p => ['demo', 'live'].includes(p.mode)) || new Set(providers.map(p => p.mode)).size !== 1) throw new Error('Provider modes must match');
  const mode = providers[0].mode;
  const input = validateRequest(raw);
  if (input.items.length === 0) return { mode, quotes: [], comparison: { status: 'empty', winnerId: null, savings: null }, calculatedAt: new Date(now).toISOString() };
  const quotes = await Promise.all(providers.map(provider => fetchQuote(provider, input, { now, timeoutMs, clock })));
  // The second provider may finish after the first quote expired.
  const finishedAt = clock();
  for (const quote of quotes) {
    if (quote.status === 'complete' && Date.parse(quote.expiresAt) <= finishedAt) {
      quote.status = 'incomplete'; quote.total = null;
      quote.issues.push({ code: 'expired', message: 'Расчёт устарел' });
    }
  }
  return { mode, quotes, comparison: rankQuotes(quotes, finishedAt), calculatedAt: new Date(finishedAt).toISOString() };
}
