async function request(path, options) {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('API временно недоступен');
  return response.json();
}
export const getCatalog = () => request('/api/catalog');
export const compare = body => request('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
