// Read-only integration probe. Not a consumer basket or checkout implementation.
// Source: https://docs.kuper.ru/api-products/fulfillment/swagger
const origins = {
  production: 'https://api.kuper.ru',
  sandbox: 'https://api-gw.k-stage.sbermarket.tech',
};

export class KuperError extends Error {
  constructor(code, message) { super(message); this.name = 'KuperError'; this.code = code; }
}

export function createKuperFulfillmentClient({ token, environment = 'sandbox', fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) throw new KuperError('NOT_CONFIGURED', 'Нужен выданный Купером Client-Token.');
  if (!Object.hasOwn(origins, environment)) throw new KuperError('INVALID_ENVIRONMENT', 'Выберите sandbox или production.');
  const base = origins[environment];

  return {
    async listStores({ pageSize = 20, pageToken, signal } = {}) {
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new KuperError('INVALID_INPUT', 'pageSize: целое число от 1 до 1000.');
      if (pageToken !== undefined && (typeof pageToken !== 'string' || pageToken.length > 2048)) throw new KuperError('INVALID_INPUT', 'Некорректный pageToken.');
      const url = new URL('/api/fulfillment/v1/stores', base);
      url.searchParams.set('max_page_size', String(pageSize));
      if (pageToken) url.searchParams.set('page_token', pageToken);
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal?.aborted) abort();
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: 'GET', redirect: 'error', signal: controller.signal,
          headers: {
            Accept: 'application/json', 'Client-Token': token,
            ...(environment === 'sandbox' ? {
              'sbm-forward-feature-version-paas-content-fulfilment-api': 'integrations',
              'sbm-forward-tenant': 'sbermarket',
            } : {}),
          },
        });
        // Never include upstream response bodies, URLs with query data, or tokens in errors.
        if ([401, 403].includes(response.status)) throw new KuperError('ACCESS_DENIED', 'Купер отклонил доступ. Проверьте выданный ключ и права.');
        if (response.status === 429) throw new KuperError('RATE_LIMITED', 'Достигнут лимит запросов Купера. Повторите позже.');
        if (!response.ok) throw new KuperError('UPSTREAM_ERROR', 'Купер не смог вернуть список магазинов.');
        const result = await response.json();
        if (!result || typeof result !== 'object' || Array.isArray(result) || !Array.isArray(result.data)) throw new KuperError('INVALID_RESPONSE', 'Ответ не соответствует ожидаемому списку магазинов.');
        return result;
      } catch (error) {
        if (error instanceof KuperError) throw error;
        throw new KuperError(controller.signal.aborted ? 'ABORTED' : 'NETWORK_ERROR', controller.signal.aborted ? 'Запрос отменён или превысил время ожидания.' : 'Не удалось получить ответ Купера.');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
  };
}
