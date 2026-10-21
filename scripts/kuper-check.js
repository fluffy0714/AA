import { createKuperFulfillmentClient } from '../providers/kuper/fulfillment-client.js';

try {
  const client = createKuperFulfillmentClient({ token: process.env.KUPER_CLIENT_TOKEN, environment: process.env.KUPER_ENVIRONMENT || 'sandbox' });
  const result = await client.listStores({ pageSize: 1 });
  // No addresses, store details, credentials, or opaque pagination tokens in logs.
  console.log(JSON.stringify({ connected: true, storesOnPage: result.data.length, hasMore: Boolean(result.next_page_token) }));
} catch (error) {
  console.error(JSON.stringify({ connected: false, code: error.code || 'UNKNOWN', message: error.message }));
  process.exitCode = 1;
}
