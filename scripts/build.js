import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(root, 'apps/web/index.html'), join(dist, 'index.html'));
await cp(join(root, 'apps/web/src'), dist, { recursive: true });
await cp(join(root, 'apps/web/public'), dist, { recursive: true });
await cp(join(root, 'packages'), join(dist, 'packages'), { recursive: true });
await cp(join(root, 'providers'), join(dist, 'providers'), { recursive: true });
// A portable static demo reuses the SAME pricing engine as the Node API.
// Production integrations must run on a server; never put credentials in this file.
await writeFile(join(dist, 'api-client.js'), `import { catalog, regions } from './packages/domain/catalog.js';
import { compareBasket } from './packages/domain/compare.js';
import { createDemoProviders } from './providers/demo.js';
export const getCatalog = async () => ({ products: catalog, regions, mode: 'demo' });
export const compare = input => compareBasket(input, createDemoProviders());
`);
console.log('Built dist/: standalone demo, no live integrations or secrets.');
