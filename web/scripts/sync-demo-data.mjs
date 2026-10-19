// Copies the app's offline demo catalogue (mobile/assets/demo) into public/demo
// so demo mode and the app show the same products and photos.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, '..', 'mobile', 'assets', 'demo');
const out = join(root, 'public', 'demo');
if (!existsSync(join(src, 'catalog.json'))) {
  console.warn('sync-demo: mobile/assets/demo not found; demo mode will have no products.');
  process.exit(0);
}
mkdirSync(out, { recursive: true });
cpSync(join(src, 'img'), join(out, 'img'), { recursive: true });
const catalog = JSON.parse(readFileSync(join(src, 'catalog.json'), 'utf8'));
// "asset:assets/demo/img/x.jpg" → "demo/img/x.jpg" (relative to the site base)
const json = JSON.stringify(catalog).replaceAll('asset:assets/demo/', 'demo/');
writeFileSync(join(out, 'catalog.json'), json);
console.log(`sync-demo: ${catalog.products.length} products, ${catalog.categories.length} categories`);
