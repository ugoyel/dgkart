// End-to-end smoke test against a running API (dev auth + mock payments).
// Usage: API=http://localhost:3000 node test/smoke.mjs
import ExcelJS from 'exceljs';

const API = (process.env.API ?? 'http://localhost:3000') + '/api/v1';
const OTP = process.env.DEV_OTP_CODE ?? '123456';
let failures = 0;

async function call(method, path, { token, body, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}
async function login(phone) {
  await call('POST', '/auth/otp/request', { body: { phone } });
  const r = await call('POST', '/auth/otp/verify', { body: { phone, code: OTP } });
  return r.json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitJob(token, id) {
  for (let i = 0; i < 100; i++) {
    const j = (await call('GET', `/admin/jobs/${id}`, { token })).json;
    if (j.status === 'DONE' || j.status === 'FAILED') return j;
    await sleep(200);
  }
  throw new Error('job timeout');
}
async function xlsx(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('s');
  ws.addRows(rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
function formWith(field, files) {
  const f = new FormData();
  for (const [name, buf, type] of files) f.append(field, new Blob([buf], { type }), name);
  return f;
}

const admin = await login('9910123503');
check('admin number gets ADMIN role', admin.user?.role === 'ADMIN', admin.user?.role);
const user = await login('9876543210');
check('other numbers get USER role', user.user?.role === 'USER');
check('wrong OTP rejected', (await call('POST', '/auth/otp/verify', { body: { phone: '9876543210', code: '000000' } })).status === 401);
check('user cannot reach admin', (await call('GET', '/admin/stats', { token: user.accessToken })).status === 403);

const home = (await call('GET', '/home')).json;
check('home has categories and deals', home.categories?.length > 0 && home.dailyDeals?.length > 0, `${home.categories?.length} cats`);
const search = (await call('GET', '/products?q=shoes&sort=price_asc&pageSize=5')).json;
check('search returns paged results', search.items?.length > 0 && search.total > 0, `total=${search.total}`);
const product = (await call('GET', `/products/${search.items[0].id}`)).json;
check('product detail has images', product.images?.length >= 2);

const t = user.accessToken;
let cart = (await call('POST', '/cart', { token: t, body: { productId: product.id, quantity: 1 } })).json;
check('add to cart', cart.count === 1, `total=${cart.total}`);
check('watchlist add', (await call('PUT', `/watchlist/${product.id}`, { token: t })).json.watching === true);
const address = { id: 'a1', name: 'Test User', phone: '9876543210', line1: '12 MG Road', city: 'Delhi', state: 'Delhi', pincode: '110001' };
const order = (await call('POST', '/orders', { token: t, body: { address, paymentMethod: 'ONLINE' } })).json;
check('place order', order.status === 'PENDING_PAYMENT', order.orderNumber);
check('cart cleared after order', (await call('GET', '/cart', { token: t })).json.count === 0);
const co = (await call('POST', '/payments/checkout', { token: t, body: { orderId: order.id } })).json;
check('payment checkout', !!co.gatewayOrderId, co.provider);
const bad = await call('POST', '/payments/confirm', { token: t, body: { orderId: order.id, gatewayOrderId: co.gatewayOrderId, paymentId: 'p1', signature: 'forged' } });
check('forged payment signature rejected', bad.status === 403);
const order2 = (await call('POST', '/orders', { token: t, body: { address, paymentMethod: 'ONLINE', items: [{ productId: product.id, quantity: 1 }] } })).json;
const co2 = (await call('POST', '/payments/checkout', { token: t, body: { orderId: order2.id } })).json;
const paid = (await call('POST', '/payments/confirm', { token: t, body: { orderId: order2.id, gatewayOrderId: co2.gatewayOrderId, paymentId: 'pay_mock', signature: 'mock-success' } })).json;
check('mock payment marks order PAID', paid.status === 'PAID');
const cod = (await call('POST', '/orders', { token: t, body: { address, paymentMethod: 'COD', items: [{ productId: product.id, quantity: 1 }] } })).json;
check('cash on delivery order', cod.status === 'CONFIRMED_COD');

// ---- Bulk import ----
const A = admin.accessToken;
const N = 3000;
const rows = [['sku', 'title', 'price', 'mrp', 'stock', 'brand', 'category', 'condition', 'specs', 'images']];
for (let i = 1; i <= N; i++) rows.push([`SMK-${i}`, `Smoke Test Product ${i}`, 100 + i, 200 + i, 10, 'DGkart', 'Smoke Category', i % 2 ? 'New' : 'Refurbished', 'Colour=Red; Size=M', `smk-${i}_1.jpg`]);
rows.push(['', 'missing sku', 10]);
rows.push(['SMK-BAD', 'bad price', 'abc']);
const t0 = Date.now();
let job = (await call('POST', '/admin/import/products', { token: A, form: formWith('file', [['products.xlsx', await xlsx(rows), 'application/octet-stream']]) })).json;
job = await waitJob(A, job.id);
check(`import ${N} products from Excel`, job.status === 'DONE' && job.upsertedRows === N && job.failedRows === 2, `${Date.now() - t0}ms, errors=${JSON.stringify(job.errors)}`);
job = (await call('POST', '/admin/import/products', { token: A, form: formWith('file', [['products.xlsx', await xlsx(rows), 'application/octet-stream']]) })).json;
job = await waitJob(A, job.id);
const again = (await call('GET', '/products?q=SMK-1&pageSize=1')).json;
check('re-import updates instead of duplicating', job.status === 'DONE' && again.total === 1, `total=${again.total}`);

const mapping = (await call('POST', '/admin/import/image-mapping', { token: A, form: formWith('file', [['map.xlsx', await xlsx([['image_file_name', 'sku', 'position'], ['front.png', 'SMK-2', 0], ['back.png', 'SMK-2', 1]]), 'application/octet-stream']]) })).json;
check('mapping sheet imported', (await waitJob(A, mapping.id)).upsertedRows === 2);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const up = (await call('POST', '/admin/images', { token: A, form: formWith('files', [['front.png', png, 'image/png'], ['back.png', png, 'image/png'], ['SMK-1_1.jpg', png, 'image/jpeg'], ['smk-5_1.jpg', png, 'image/jpeg'], ['random.png', png, 'image/png']]) })).json;
check('multi-image upload matches by mapping sheet and file name', up.matched?.length === 4 && up.unmatched?.length === 1, JSON.stringify(up.unmatched));
const smk2 = (await call('GET', '/products?q=SMK-2&pageSize=1')).json.items[0];
const smk2d = (await call('GET', `/products/${smk2.id}`)).json;
check('uploaded images attached in order with thumbnail', smk2d.images.length === 2 && smk2d.thumbnailUrl === smk2d.images[0].url);
const img = await fetch(smk2d.images[0].url);
check('uploaded image is served', img.status === 200);

const stats = (await call('GET', '/admin/stats', { token: A })).json;
check('admin stats', stats.products >= N, JSON.stringify(stats));
const wiped = (await call('DELETE', '/admin/products/dummy', { token: A })).json;
const after = (await call('GET', '/admin/stats', { token: A })).json;
check('wipe dummy keeps imported products', after.dummyProducts === 0 && after.products === stats.products - wiped.deleted, `deleted=${wiped.deleted}`);
const seed = (await call('POST', '/admin/seed', { token: A, body: { count: 500 } })).json;
check('re-seed demo products', (await waitJob(A, seed.id)).upsertedRows === 500);

const temp = await login('9000000001');
check('delete account', (await call('DELETE', '/users/me', { token: temp.accessToken })).json.deleted === true);
check('deleted account is gone', (await call('GET', '/users/me', { token: temp.accessToken })).status === 404);
const priv = await fetch(API.replace('/api/v1', '') + '/privacy.html');
check('privacy policy page is public', priv.status === 200);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
