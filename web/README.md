# DGkart website

The DGkart.com storefront and admin panel for phones, tablets and laptops. It is built with React, Vite and TypeScript. It uses the same API, catalogue and branding as the Android app, and it changes its own theme for Indian festivals.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

By default the site runs in **demo mode**. The 499-product sample catalogue from the app runs entirely in the browser, and changes are saved in that browser only.

- Sign in with any mobile number and OTP `123456`.
- Use **9910123503** for the admin panel.
- Payments are simulated.

To use the real API (`backend/`, see the root README), copy `.env.example` to `.env.local` and set:

```
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build in `dist/` (copies the demo catalogue from `mobile/assets/demo` first) |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Type-checks |
| `npm test` | Unit tests |

## Hosting

`npm run build` produces a static `dist/` folder. Any static host can serve it.

- **Netlify:** set the build command to `npm run build` and the publish folder to `web/dist`. `public/_redirects` already sends every path to `index.html`.
- **Vercel:** set the root directory to `web`. `vercel.json` has the same rewrite.
- **Hosts that can't rewrite paths** (GitHub Pages, S3, plain shared hosting): build with `VITE_ROUTER=hash`. URLs then look like `/#/product/123`.
- **Serving from a sub-folder:** set `VITE_BASE_PATH=/shop/`.

In API mode, also add the website's address to `CORS_ORIGINS` on the API. If the API runs `AUTH_MODE=firebase`, fill in the `VITE_FIREBASE_*` values from your Firebase web app.

## Changing the look (Admin → Appearance)

Admin → Appearance changes the site's look without touching code. The whole site previews your changes while you edit, and **Publish** makes them live for shoppers.

- **Theme:** there are three modes:
  - *Automatic* follows the festival calendar.
  - *Keep one festival's theme on* holds a festival's look until a date you pick, for example for an early sale.
  - *Always everyday* turns festival themes off.
- **Colours & background:**
  - presets, or your own colours for buttons, highlights, header and footer (solid or gradient)
  - optional header, footer and page-background pictures
  - corner roundness and shadow depth
- **Home slider:** add, edit, reorder, hide or duplicate banners. Each banner has a heading, text, button, link, background colour or photo, and a picture on the right. A banner with no picture shows best-selling products from the category it links to. The current festival's banner and live sales can be added automatically.
- **Category banners:** every category page opens with a banner slider. Pick a category to give it its own banners. Categories without any get automatic ones from their best sellers, new arrivals, sales and subcategories. Subcategories use their parent's banners.
- **Transitions:**
  - effect: slide, cross-fade or fade-and-zoom
  - speed, how long each banner stays, and motion style
  - autoplay on or off

Shoppers can always swipe, drag, use the arrows or keyboard, or pause. Uploaded pictures are shrunk in the browser before upload. In API mode they are stored with product images (`/uploads/site/…` or S3). In demo mode they stay in that browser.

## Festival themes

The site checks the festival calendar every minute.

- **Before the festival:** the theme switches `themeLeadDays` days ahead. This covers colours, header and footer art, the festival banner, the announcement bar and a "Festival Sale" link.
- **During the festival:** the theme stays on until the end date, plus a short wind-down.
- **After the festival:** the theme reverts to DGkart blue on its own.

When festivals overlap, the one with the higher `priority` wins. Diwali has the highest.

**Navratri and Dussehra.** Dussehra outranks Navratri and switches on 3 days early, so it takes over during the last days of Navratri.

**What it covers.** The calendar includes Diwali, Dussehra, Navratri, Holi, Eid al-Fitr, Eid al-Adha, Ganesh Chaturthi, Janmashtami, Raksha Bandhan, Onam, Pongal and Makar Sankranti, Republic Day, Independence Day, Christmas and New Year. Dates are filled in for 2026 and 2027.

**Previewing.** You can see any date before it happens:

- open `/?themeDate=2026-11-07`, or
- use **Preview theme** in Admin → Festival reminders.

**Updating dates each year.** Lunar festivals move every year, and those marked "verify date" are approximate. Once a year, open **Admin → Festivals & themes** and add next year's dates. The same screen edits:

- colours, motif and decoration strip
- optional header, footer and banner image URLs
- how many days early the theme switches on
- which weeks ahead you get reminders
- the offer template used for drafts

Your edits are stored by the API and override the built-in calendar (`backend/src/modules/promotions/engine/festival-calendar.ts`). Reset restores the built-in calendar.

## Reminders to plan offers

Each festival has reminder steps; for example, Diwali has reminders 8, 6, 4, 2 and 1 week before. From the first step until the festival has offers, the admin sees three things:

- a red count on the bell in the header
- a card in **Admin → Festival reminders**
- an optional browser notification

**Create draft offers** prepares a full set of **inactive** drafts from the festival's template:

- a festival category sale
- a promo code, for example `DIWALI26`
- a clip-on coupon
- two bank card offers
- lightning deals in three daily slots, and a deal of the day, using best-selling products

Review the drafts in **Offers & deals**, edit them if needed, then press **Activate**. Dismissing a reminder hides it until the next reminder step.

## How offers apply (Amazon-style)

Every offer has a start and end time. Some also have a stock or use limit. The API and the website price a cart with the same engine (`backend/src/modules/promotions/engine`), so the total the shopper sees is the total the order is placed at. The steps run in this order:

1. **Item deal:** each product gets the best of its live deals, checked in this order:
   - a lightning deal, with a countdown, a claimed % bar and a unit limit
   - a deal of the day
   - a festival sale
   - a category sale
2. **Clip coupons:** coupons the shopper clipped take extra off matching items.
3. **Promo code:** one code per order, checked for minimum order, per-shopper limit and total uses.
4. **Bank offer:** applies to online payments with the matching bank and card type (for example 10% off HDFC credit cards, capped). Shoppers pick their card at checkout.
5. **Delivery:** free from ₹499, otherwise ₹40.

Lightning deal units and coupon uses are claimed when the order is placed. They are released if the order is cancelled or the payment fails.

## Code map

| Path | What it is |
| --- | --- |
| `src/config/site.ts` | Brand, footer links, banks, hero slides: edit to change site content |
| `src/data/source.ts` | The `DataSource` interface. `api/` talks to the backend and `demo/` runs in the browser |
| `src/state/AppState.tsx` | Sign-in, cart, offers and the live festival theme |
| `src/components/` | Header, footer, banner slider (`Carousel`, `Banners`), festival art, product cards, price summary |
| `src/pages/` | Storefront pages |
| `src/pages/admin/` | Admin panel (loaded only for admins), including Appearance |
| `src/styles/app.css` | All styles. Colours are CSS variables that festival themes override |
