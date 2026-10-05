// Builds the offline demo catalogue bundled with DEMO_MODE builds.
//
//   1. Start the API with demo products seeded (see docs/SETUP.md).
//   2. node mobile/tool/build_demo_data.mjs [apiBase]
//
// Writes mobile/assets/demo/catalog.json and one picture per product type in
// mobile/assets/demo/img/. Pictures are drawn with Playwright (Chromium's
// emoji font) so the demo needs no network access at all.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const API = (process.argv[2] ?? 'http://localhost:3000') + '/api/v1';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'demo');
const PER_SUBCATEGORY = 20;

const EMOJI = {
  '5G Smartphone 128GB': '📱', 'Smartphone 256GB': '📱', 'Foldable Phone': '📱', 'Rugged Phone': '📱', 'Feature Phone Dual SIM': '📞',
  'Thin & Light Laptop 16GB': '💻', 'Gaming Laptop RTX': '💻', '2-in-1 Touch Laptop': '💻', 'Chromebook 14"': '💻', 'Mini PC i5': '🖥️',
  'Wireless Earbuds ANC': '🎧', 'Over-Ear Headphones': '🎧', 'Bluetooth Speaker': '🔊', 'Soundbar 2.1': '🔈', 'Neckband Earphones': '🎧',
  'Mirrorless Camera Kit': '📷', 'Action Camera 4K': '📹', 'Instant Camera': '📸', 'Camera Tripod': '🎥', 'Ring Light 18"': '💡',
  'Smart Watch AMOLED': '⌚', 'Fitness Band': '⌚', 'Kids GPS Watch': '⌚', 'Smart Ring': '💍',
  'Cotton Polo T-Shirt': '👕', 'Slim Fit Jeans': '👖', 'Formal Shirt': '👔', 'Hooded Sweatshirt': '🧥', 'Kurta Set': '👘',
  'Printed Kurti': '👚', 'Maxi Dress': '👗', 'Silk Saree': '🥻', 'Denim Jacket': '🧥', 'Palazzo Set': '👚',
  'Running Shoes': '👟', 'Leather Sneakers': '👟', 'Casual Loafers': '👞', 'Sports Sandals': '🩴', 'Formal Oxford Shoes': '👞',
  'Laptop Backpack': '🎒', 'Trolley Bag 24"': '🧳', 'Leather Wallet': '👛', 'Handbag': '👜', 'Duffel Bag': '💼',
  'Non-Stick Cookware Set': '🍳', 'Mixer Grinder 750W': '🥤', 'Air Fryer 4L': '🍟', 'Pressure Cooker 5L': '🍲', 'Dinner Set 24 Pcs': '🍽️',
  'Ergonomic Office Chair': '🪑', 'Study Table': '🗄️', 'Bookshelf 5 Tier': '📚', 'Bean Bag XXL': '🛋️', 'Shoe Rack': '👞',
  'Wall Clock': '🕰️', 'LED String Lights': '✨', 'Ceramic Vase': '🏺', 'Cotton Bedsheet Double': '🛏️', 'Blackout Curtains': '🪟',
  'Garden Tool Kit': '🧑‍🌾', 'Self-Watering Planter': '🪴', 'Outdoor Solar Lights': '🔆', 'Hose Pipe 15m': '🚿',
  'Adjustable Dumbbells': '🏋️', 'Yoga Mat 6mm': '🧘', 'Resistance Bands Set': '💪', 'Treadmill Foldable': '🏃', 'Skipping Rope': '🪢',
  'English Willow Bat': '🏏', 'Cricket Ball Leather': '🏏', 'Batting Gloves': '🧤', 'Cricket Kit Bag': '🎒',
  'Mountain Bike 21 Speed': '🚵', 'Cycling Helmet': '⛑️', 'Bike Light Set': '🔦',
  'Building Blocks 500 Pcs': '🧱', 'Remote Control Car': '🏎️', 'Soft Teddy Bear': '🧸', 'Board Game Family': '🎲', 'Puzzle 1000 Pcs': '🧩',
  'Vintage Coin Set': '🪙', 'Die-cast Model Car': '🚗', 'Canvas Painting': '🖼️', 'Action Figure': '🦸',
  'Vitamin C Serum': '🧪', 'Sunscreen SPF 50': '🧴', 'Face Wash 150ml': '🧼', 'Moisturiser 100g': '🧴',
  'Beard Trimmer': '🪒', 'Hair Dryer 1200W': '💨', 'Electric Toothbrush': '🪥', 'Perfume 100ml': '🌸',
  'Car Phone Holder': '📲', 'Bike Helmet ISI': '🪖', 'Car Vacuum Cleaner': '🧹', 'Dash Cam 1080p': '📹', 'Tyre Inflator': '🛞',
  'Bestselling Novel': '📕', 'Self-Help Paperback': '📘', 'Competitive Exam Guide': '📗', "Children's Story Book": '📖',
  'Fountain Pen Set': '🖋️', 'Spiral Notebook Pack': '📓', 'Art Colour Set': '🎨',
  'Gold Plated Necklace Set': '📿', 'Silver Ring 925': '💍', 'Oxidised Jhumka': '💎', 'Bangles Set': '💫',
  'Analog Watch Leather': '⌚', 'Chronograph Steel Watch': '⌚', 'Digital Sports Watch': '⌚',
};
const CATEGORY_EMOJI = {
  electronics: '📱', fashion: '👗', 'home-garden': '🛋️', sports: '🏏', toys: '🧸', 'health-beauty': '💄', motors: '🏍️',
  books: '📚', jewellery: '💍',
};
// Soft backgrounds that suit the DKKart palette.
const BACKGROUNDS = ['#eef2ff', '#fff7ed', '#ecfdf5', '#fdf2f8', '#f0f9ff', '#fefce8', '#f5f3ff', '#f1f5f9'];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const get = async (path) => {
  let r = await fetch(API + path);
  // The API allows 300 requests a minute; wait out the limiter instead of failing.
  while (r.status === 429) {
    await new Promise((ok) => setTimeout(ok, 1000 * Number(r.headers.get('retry-after') ?? 5)));
    r = await fetch(API + path);
  }
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
};

const categories = await get('/categories');
const home = await get('/home');
const byId = new Map();
for (const list of [home.dailyDeals, home.trending, home.newArrivals]) for (const p of list) byId.set(p.id, p);
for (const c of categories.filter((c) => c.parentId)) {
  const page = await get(`/products?category=${c.slug}&pageSize=${PER_SUBCATEGORY}`);
  for (const p of page.items) byId.set(p.id, p);
}

const pictures = new Map(); // file name -> { emoji, bg }
const picture = (emoji, key) => {
  const name = `${slug(key)}.jpg`;
  if (!pictures.has(name)) pictures.set(name, { emoji, bg: BACKGROUNDS[pictures.size % BACKGROUNDS.length] });
  return `asset:assets/demo/img/${name}`;
};

const products = [];
for (const id of byId.keys()) {
  const p = await get(`/products/${id}`);
  const type = p.specs?.Type;
  const top = categories.find((c) => c.id === (p.category?.parentId ?? p.categoryId));
  const url = picture(EMOJI[type] ?? CATEGORY_EMOJI[top?.slug] ?? '🛍️', type ?? top?.slug ?? 'item');
  delete p.category;
  delete p.isActive;
  p.thumbnailUrl = url;
  p.images = [{ id: `${p.id}-0`, productId: p.id, url, position: 0, sourceFileName: null }];
  products.push(p);
}
for (const c of categories) {
  const parent = categories.find((x) => x.id === c.parentId);
  c.imageUrl = picture(CATEGORY_EMOJI[c.slug] ?? CATEGORY_EMOJI[parent?.slug] ?? '🛍️', `cat-${c.slug}`);
}
// Child categories use the picture of their best-selling product type.
for (const c of categories.filter((c) => c.parentId)) {
  const first = products.filter((p) => p.categoryId === c.id).sort((a, b) => b.soldCount - a.soldCount)[0];
  if (first) c.imageUrl = first.thumbnailUrl;
}

rmSync(join(OUT, 'img'), { recursive: true, force: true });
mkdirSync(join(OUT, 'img'), { recursive: true });
writeFileSync(
  join(OUT, 'catalog.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), categories, products, home: {
    dailyDeals: home.dailyDeals.map((p) => p.id), trending: home.trending.map((p) => p.id), newArrivals: home.newArrivals.map((p) => p.id),
  } }),
);

const require = createRequire(join(process.cwd(), 'noop.js'));
const { chromium } = require('playwright');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 360, height: 360 } });
for (const [name, { emoji, bg }] of pictures) {
  await page.setContent(`<body style="margin:0;display:grid;place-items:center;width:360px;height:360px;background:${bg};font-size:190px">${emoji}</body>`);
  await page.screenshot({ path: join(OUT, 'img', name), type: 'jpeg', quality: 72 });
}
await browser.close();
console.log(`demo catalogue: ${products.length} products, ${categories.length} categories, ${pictures.size} pictures`);
