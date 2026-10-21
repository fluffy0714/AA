import { catalog, regions } from '../packages/domain/catalog.js';
import { requestKey } from '../packages/domain/quote.js';

const definitions = [
  { id: 'yandex', name: 'Яндекс Еда', prices: [11490,13990,7990,19990,15990,22990,10990,9490,45990,5490,7490,17990], delivery: 9900, freeAbove: 200000, service: 3900, eta: '30–45 мин' },
  { id: 'kuper', name: 'Купер', prices: [10990,12990,8490,18990,14990,21990,11990,8990,44990,5990,6990,16990], delivery: 14900, freeAbove: 180000, service: 2900, eta: '45–60 мин' }
];

// Provider contract: quote(request, { now }) -> Quote; prices are integer kopecks.
// No endpoint or credential for a live provider is inferred from these demo fixtures.
export function createDemoProviders() {
  return definitions.map(def => ({
    id: def.id, name: def.name, mode: 'demo',
    async quote(input, { now }) {
      if (input.scenario === 'outage' && def.id === 'kuper') throw new Error('Demo outage');
      const lines = input.items.map((item, index) => {
        const p = catalog.find(p => p.id === item.productId);
        const unitPrice = def.prices[catalog.indexOf(p)];
        const available = !(input.scenario === 'missing' && def.id === 'kuper' && p.id === 'milk');
        const mismatch = input.scenario === 'mismatch' && def.id === 'kuper' && p.id === 'milk';
        return { productId: p.id, identity: mismatch ? p.identity + ':different-pack' : p.identity, quantity: item.quantity, match: 'exact', available, unitPrice, subtotal: available ? unitPrice * item.quantity : null };
      });
      const missing = lines.filter(l => !l.available).map(l => l.productId);
      const subtotal = lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0);
      const promoApplied = input.promo === 'DEMO10' && def.id === 'kuper' && subtotal >= 50000;
      const discount = promoApplied ? Math.min(20000, Math.floor(subtotal / 10)) : 0;
      const region = regions.find(r => r.id === input.regionId);
      const delivery = (subtotal - discount >= def.freeAbove ? 0 : def.delivery) + region.deliveryExtra;
      const surge = input.scenario === 'busy' ? (def.id === 'yandex' ? 12900 : 7900) : 0;
      const complete = missing.length === 0;
      return {
        providerId: def.id, providerName: def.name, mode: 'demo', requestKey: requestKey(input), status: complete ? 'complete' : 'incomplete',
        lines, missing, subtotal, discount, delivery: input.scenario === 'fees_unknown' && def.id === 'kuper' ? null : delivery, service: def.service, surge,
        total: complete ? subtotal + delivery + def.service + surge - discount : null,
        promoStatus: !input.promo ? 'none' : promoApplied ? 'applied' : 'not_applicable',
        eta: def.eta,
        quotedAt: new Date(input.scenario === 'expired' && def.id === 'kuper' ? now - 6 * 60_000 : now).toISOString(),
        expiresAt: new Date(input.scenario === 'expired' && def.id === 'kuper' ? now - 60_000 : now + 5 * 60_000).toISOString(),
        checkout: { available: false, reason: 'Демонстрация: официальная интеграция оформления ещё не подключена.' }
      };
    }
  }));
}
