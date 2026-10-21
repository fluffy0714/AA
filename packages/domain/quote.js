import { catalog } from './catalog.js';

export const issueMessages = {
  missing: 'Нет товара в наличии',
  mismatch: 'Отличается товар или упаковка',
  quantity: 'Отличается количество',
  fees_unknown: 'Неизвестна часть доставки или сборов',
  expired: 'Расчёт устарел',
  invalid_response: 'Сервис вернул некорректный расчёт',
  context_changed: 'Расчёт относится к другой корзине или району',
  timeout: 'Сервис не успел ответить',
  unavailable: 'Сервис временно недоступен',
};

export const requestKey = request => JSON.stringify({
  items: [...request.items].sort((a, b) => a.productId.localeCompare(b.productId)),
  regionId: request.regionId,
  promo: request.promo,
  scenario: request.scenario,
});

const money = n => Number.isSafeInteger(n) && n >= 0;
const fields = ['subtotal', 'discount', 'delivery', 'service', 'surge'];

export function unavailableQuote(provider, code = 'unavailable') {
  return {
    providerId: provider.id,
    providerName: provider.name,
    mode: provider.mode,
    status: 'unavailable',
    total: null,
    lines: [],
    missing: [],
    issues: [{ code, message: issueMessages[code] }],
    checkout: { available: false },
  };
}

/** Treat adapter output as untrusted. Never rank a quote on its claimed status alone. */
export function validateQuote(raw, request, provider, now) {
  const invalid = code => unavailableQuote(provider, code);
  if (!raw || raw.providerId !== provider.id || raw.mode !== provider.mode || !['demo', 'live'].includes(raw.mode)) return invalid('invalid_response');
  if (raw.requestKey !== requestKey(request)) return invalid('context_changed');
  if (!Array.isArray(raw.lines) || raw.lines.length !== request.items.length) return invalid('invalid_response');
  const quotedAt = Date.parse(raw.quotedAt), expiresAt = Date.parse(raw.expiresAt);
  if (!Number.isFinite(quotedAt) || !Number.isFinite(expiresAt) || quotedAt > now || expiresAt <= quotedAt) return invalid('invalid_response');

  const issues = [], seen = new Set(), lines = [];
  let subtotal = 0;
  for (const line of raw.lines) {
    const item = request.items.find(i => i.productId === line?.productId);
    const product = catalog.find(p => p.id === item?.productId);
    if (!item || seen.has(item.productId) || typeof line.available !== 'boolean') return invalid('invalid_response');
    seen.add(item.productId);
    const issue = code => issues.push({ code, productId: item.productId, message: issueMessages[code] });
    if (!line.available) issue('missing');
    if (line.identity !== product.identity || line.match !== 'exact') issue('mismatch');
    if (line.quantity !== item.quantity) issue('quantity');
    if (!money(line.unitPrice) || !Number.isSafeInteger(line.quantity) || line.quantity < 1) return invalid('invalid_response');
    const expected = line.available ? line.unitPrice * line.quantity : null;
    if (line.subtotal !== expected || (expected !== null && !money(expected))) return invalid('invalid_response');
    subtotal += expected ?? 0;
    lines.push({ productId: item.productId, identity: line.identity, quantity: line.quantity,
      match: line.identity === product.identity && line.match === 'exact' ? 'exact' : 'mismatch',
      available: line.available, unitPrice: line.unitPrice, subtotal: expected });
  }
  if (!money(subtotal) || raw.subtotal !== subtotal) return invalid('invalid_response');
  for (const key of fields) {
    if (['delivery', 'service', 'surge'].includes(key) && raw[key] === null) {
      issues.push({ code: 'fees_unknown', field: key, message: issueMessages.fees_unknown });
    } else if (!money(raw[key])) return invalid('invalid_response');
  }
  if (raw.discount > subtotal) return invalid('invalid_response');
  if (expiresAt <= now) issues.push({ code: 'expired', message: issueMessages.expired });
  const complete = issues.length === 0;
  const total = complete ? subtotal - raw.discount + raw.delivery + raw.service + raw.surge : null;
  if (complete && (!money(total) || raw.total !== total)) return invalid('invalid_response');
  return {
    providerId: provider.id, providerName: provider.name, mode: provider.mode,
    status: complete ? 'complete' : 'incomplete', lines, issues,
    missing: issues.filter(i => i.code === 'missing').map(i => i.productId),
    subtotal, discount: raw.discount, delivery: raw.delivery, service: raw.service, surge: raw.surge,
    total, promoStatus: ['none', 'applied', 'not_applicable'].includes(raw.promoStatus) ? raw.promoStatus : 'none',
    eta: typeof raw.eta === 'string' ? raw.eta.slice(0, 50) : '',
    quotedAt: new Date(quotedAt).toISOString(), expiresAt: new Date(expiresAt).toISOString(),
    // Checkout is a separate capability; a price response can never enable purchases.
    checkout: { available: false },
  };
}

export async function fetchQuote(provider, request, { now, timeoutMs, clock }) {
  const controller = new AbortController();
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('QUOTE_TIMEOUT')); }, timeoutMs);
    });
    const raw = await Promise.race([
      Promise.resolve().then(() => provider.quote(structuredClone(request), { now, signal: controller.signal })),
      timeout,
    ]);
    return validateQuote(raw, request, provider, clock());
  } catch (error) {
    return unavailableQuote(provider, error?.message === 'QUOTE_TIMEOUT' ? 'timeout' : 'unavailable');
  } finally { clearTimeout(timer); }
}
