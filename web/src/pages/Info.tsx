import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Empty, useTitle } from '../components/ui';
import { site } from '../config/site';

/**
 * Static pages. Replace the copy with your own business details before going
 * live (the privacy policy must match the Play Store data-safety form).
 */
const PAGES: Record<string, { title: string; body: ReactNode }> = {
  about: {
    title: `About ${site.name}`,
    body: (
      <>
        <p>{site.domain} is an online marketplace for electronics, fashion, home, sports, beauty and more, with festival sales throughout the year.</p>
        <p>Shop on the web or on our Android app; your account, cart and orders are the same on both.</p>
      </>
    ),
  },
  help: {
    title: 'Help centre',
    body: (
      <>
        <h2 id="shipping">Shipping & delivery</h2>
        <p>Orders are delivered in {site.delivery.standardDays} business days. Delivery is free on orders of ₹499 or more and on items marked “Free delivery”; otherwise a ₹40 fee applies.</p>
        <h2 id="offers">Deals, coupons and bank offers</h2>
        <ul>
          <li><b>Lightning Deals</b> run for a few hours with limited stock. The deal price applies until the claimed bar reaches 100%.</li>
          <li><b>Deal of the Day</b> prices last until midnight.</li>
          <li><b>Clip coupons</b> are ticked on the product page and applied automatically in your cart.</li>
          <li><b>Promo codes</b> are entered in the cart or at checkout. One code per order.</li>
          <li><b>Bank offers</b> are instant discounts when you choose the matching bank card at checkout and pay online.</li>
        </ul>
        <h2 id="returns">Returns & refunds</h2>
        <p>Most items can be returned within {site.delivery.returnDays} days of delivery. Refunds go back to the original payment method within 5-7 business days. Offer discounts are adjusted in the refund.</p>
        <h2 id="contact">Contact us</h2>
        <p>Email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> or call {site.supportPhone}.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy policy',
    body: (
      <>
        <p>We collect your mobile number to sign you in, your delivery addresses to ship orders, and your order history to provide support. Payments are processed by Razorpay; we never store card numbers.</p>
        <p>We do not sell your personal data. You can delete your account at any time from the app, or by writing to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms of use',
    body: (
      <>
        <p>By using {site.domain} you agree to provide accurate information, use the site lawfully and pay for orders you place. Prices and offers can change without notice; the price at checkout is final.</p>
        <p>Offers cannot be exchanged for cash and may be withdrawn if misused. Limited deals are first come, first served.</p>
      </>
    ),
  },
  app: {
    title: `Get the ${site.name} app`,
    body: (
      <>
        <p>Shop faster with the {site.name} Android app: OTP sign-in, deal alerts and one-tap checkout.</p>
        <p><a className="btn" href={site.androidAppUrl}>Download for Android</a></p>
      </>
    ),
  },
};

export function InfoPage({ page }: { page: keyof typeof PAGES }) {
  const p = PAGES[page];
  useTitle(p.title);
  return (
    <div className="container info-page card">
      <h1>{p.title}</h1>
      {p.body}
    </div>
  );
}

export function NotFound() {
  useTitle('Page not found');
  return (
    <div className="container">
      <Empty title="We couldn’t find that page" icon="search">
        <Link to="/" className="btn">Go to the home page</Link>
      </Empty>
    </div>
  );
}
