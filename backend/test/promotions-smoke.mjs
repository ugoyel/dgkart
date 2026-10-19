// End-to-end test of offers, festival calendar and admin reminders against a running API.
// Usage: API=http://localhost:3000 node test/promotions-smoke.mjs
const API = (process.env.API ?? 'http://localhost:3000') + '/api/v1';
const OTP = process.env.DEV_OTP_CODE ?? '123456';
let failures = 0;

async function call(method, path, { token, body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
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
  return (await call('POST', '/auth/otp/verify', { body: { phone, code: OTP } })).json.accessToken;
}
const hours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
const address = { id: 'a1', name: 'Test', phone: '9876543210', line1: '1 MG Road', city: 'Delhi', state: 'Delhi', pincode: '110001' };

const admin = await login('9910123503');
const shopper = await login('9876500011');

const state = (await call('GET', '/promotions')).json;
check('public state has festival calendar and theme', state.festivals?.length >= 10 && !!state.theme?.theme?.primary);
check('public calendar hides offer templates', state.festivals.every((f) => !('offerTemplate' in f)));
const preview = (await call('GET', '/promotions?at=2026-11-07T12:00:00%2B05:30')).json;
check('theme preview on Diwali shows Diwali', preview.theme.occurrence?.festival.id === 'diwali', preview.theme.occurrence?.festival.id);

check('shopper cannot list admin offers', (await call('GET', '/admin/offers', { token: shopper })).status === 403);

// Use the cheapest few products so totals are predictable.
const products = (await call('GET', '/products?sort=price_asc&pageSize=5')).json.items;
const [p1, p2] = products;
const make = (body) => call('POST', '/admin/offers', { token: admin, body });

const bad = await make({ kind: 'LIGHTNING_DEAL', title: 'x', discount: { type: 'PERCENT', value: 30 }, scope: {}, startsAt: hours(-1), endsAt: hours(5), isActive: true });
check('invalid lightning deal is rejected', bad.status === 400, JSON.stringify(bad.json.message));

const ld = (await make({ kind: 'LIGHTNING_DEAL', title: 'Smoke lightning', discount: { type: 'PERCENT', value: 50 }, scope: { productIds: [p1.id] }, stockLimit: 2, perUserLimit: 2, startsAt: hours(-1), endsAt: hours(5), isActive: true })).json;
check('admin creates a lightning deal', !!ld.id, JSON.stringify(ld).slice(0, 200));
const code = 'SMOKE' + Math.floor(Math.random() * 1e5);
const cp = (await make({ kind: 'COUPON', title: 'Smoke coupon', code: code.toLowerCase(), discount: { type: 'FLAT', value: 10 }, scope: {}, perUserLimit: 1, startsAt: hours(-1), endsAt: hours(5), isActive: true })).json;
check('coupon code is stored upper-case', cp.code === code);
const bank = (await make({ kind: 'BANK_OFFER', title: 'Smoke bank', bank: 'Smoke Bank', cardType: 'ANY', discount: { type: 'PERCENT', value: 10, maxDiscount: 5 }, scope: {}, startsAt: hours(-1), endsAt: hours(5), isActive: true })).json;

const live = (await call('GET', '/promotions')).json.offers.map((o) => o.id);
check('live offers are public', [ld.id, cp.id, bank.id].every((id) => live.includes(id)));

const q = (await call('POST', '/promotions/quote', {
  token: shopper,
  body: { items: [{ productId: p1.id, quantity: 3 }, { productId: p2.id, quantity: 1 }], couponCode: code, payment: { method: 'ONLINE', bank: 'Smoke Bank' } },
})).json;
const expectSub = Math.round((p1.price / 2 * 2 + p1.price + p2.price) * 100) / 100;
check('quote: lightning deal covers only the 2 units left', q.lines[0].deal?.units === 2 && q.subtotal === expectSub, `${q.subtotal} vs ${expectSub}`);
check('quote: coupon and capped bank offer applied', q.couponDiscount === 10 && q.bankDiscount === 5, `${q.couponDiscount}/${q.bankDiscount}`);

const order = await call('POST', '/orders', {
  token: shopper,
  body: { address, paymentMethod: 'ONLINE', items: [{ productId: p1.id, quantity: 3 }, { productId: p2.id, quantity: 1 }], couponCode: code, bank: 'Smoke Bank', cardType: 'CREDIT' },
});
check('order uses the same quote', order.status === 201 && order.json.total === q.total && order.json.discount === 15, `${order.json.total} vs ${q.total}`);

const after = (await call('GET', '/admin/offers', { token: admin })).json.find((o) => o.id === ld.id);
check('lightning deal units are claimed', after.claimedCount === 2);
const again = await call('POST', '/orders', { token: shopper, body: { address, paymentMethod: 'COD', items: [{ productId: p2.id, quantity: 1 }], couponCode: code } });
check('coupon cannot be reused by the same shopper', again.status === 400 && /already used/.test(again.json.message), again.json.message);

await call('PATCH', `/admin/orders/${order.json.id}/status`, { token: admin, body: { status: 'CANCELLED' } });
const released = (await call('GET', '/admin/offers', { token: admin })).json.find((o) => o.id === ld.id);
check('cancelling releases lightning deal units', released.claimedCount === 0);

const reminders = (await call('GET', '/admin/notifications', { token: admin })).json;
check('admin gets festival reminders', Array.isArray(reminders), JSON.stringify(reminders.map?.((r) => r.id)));
const cal = (await call('GET', '/admin/festivals', { token: admin })).json;
const next = reminders[0]?.festivalId ?? cal.find((f) => f.dates['2027'])?.id;
const drafts = await call('POST', `/admin/festivals/${next}/drafts`, { token: admin });
check('festival drafts are created inactive', drafts.status === 201 && drafts.json.length >= 5 && drafts.json.every((d) => !d.isActive), `${drafts.status} ${drafts.json.length}`);

const diwali = cal.find((f) => f.id === 'diwali');
const saved = await call('PUT', '/admin/festivals/diwali', { token: admin, body: { ...diwali, dates: { ...diwali.dates, '2028': { start: '2028-10-15', end: '2028-10-19' } } } });
check('admin can add next year’s Diwali dates', saved.status === 200 && saved.json.find((f) => f.id === 'diwali').dates['2028']);
if (reminders[0]) {
  await call('POST', `/admin/notifications/${reminders[0].id}/dismiss`, { token: admin });
  const left = (await call('GET', '/admin/notifications', { token: admin })).json;
  check('dismissed reminder stays dismissed', !left.some((r) => r.id === reminders[0].id));
}

// Appearance: theme mode, banners and uploads.
const look = (await call('GET', '/admin/appearance', { token: admin })).json;
check('appearance has defaults', look.themeMode === 'auto' && look.heroSlides.length > 0 && look.slider.effect === 'slide');
const forced = await call('PUT', '/admin/appearance', { token: admin, body: { ...look, themeMode: 'festival', forcedFestivalId: 'diwali', slider: { ...look.slider, effect: 'fade' } } });
check('admin can force a festival theme', forced.status === 200 && forced.json.slider.effect === 'fade', `${forced.status}`);
const pub = (await call('GET', '/promotions')).json;
check('shoppers get the forced theme and the look settings', pub.theme.occurrence?.festival.id === 'diwali' && pub.appearance.slider.effect === 'fade');
const badLook = await call('PUT', '/admin/appearance', { token: admin, body: { ...look, heroSlides: [{ ...look.heroSlides[0], link: 'javascript:alert(1)' }] } });
check('unsafe banner links are rejected', badLook.status === 400, `${badLook.status}`);
check('shoppers cannot change the look', (await call('PUT', '/admin/appearance', { token: shopper, body: look })).status === 403);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const form = new FormData();
form.append('file', new Blob([png], { type: 'image/png' }), 'banner.png');
const up = await fetch(API + '/admin/media', { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: form }).then(async (r) => ({ status: r.status, json: await r.json() }));
check('admin can upload a banner image', up.status === 201 && /\/uploads\/site\/.+\.png$/.test(up.json.url), JSON.stringify(up.json));
const notImage = new FormData();
notImage.append('file', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'x.svg');
check('non-image uploads are refused', (await fetch(API + '/admin/media', { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: notImage })).status === 400);
await call('POST', '/admin/appearance/reset', { token: admin });

// Clean up so reruns start fresh.
for (const o of [ld, cp, bank, ...drafts.json]) await call('DELETE', `/admin/offers/${o.id}`, { token: admin });
await call('POST', '/admin/festivals/reset', { token: admin });

console.log(failures ? `\n${failures} check(s) failed` : '\nAll promotion checks passed');
process.exit(failures ? 1 : 0);
