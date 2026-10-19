/**
 * Everything brand- or business-specific lives here, so a rebrand, a new
 * footer link or a new payment bank is a one-file change.
 */
export const site = {
  name: 'DGkart',
  domain: 'DGkart.com',
  tagline: 'India’s marketplace for great deals',
  /** Logo is drawn as text: "DG" in navy, "kart" in orange (same as the app). */
  logo: { left: 'DG', right: 'kart' },
  supportEmail: 'support@dgkart.com',
  supportPhone: '+91 99101 23503',
  address: 'DGkart.com, New Delhi, India',
  /** The admin's mobile number (the API decides roles; demo mode uses this). */
  adminPhone: '9910123503',
  demoOtp: '123456',
  currency: 'INR',
  locale: 'en-IN',
  social: [
    { label: 'Instagram', href: 'https://instagram.com/' },
    { label: 'Facebook', href: 'https://facebook.com/' },
    { label: 'YouTube', href: 'https://youtube.com/' },
    { label: 'X', href: 'https://x.com/' },
  ],
  footer: [
    {
      title: 'Shop',
      links: [
        { label: 'Today’s Deals', to: '/deals' },
        { label: 'All categories', to: '/categories' },
        { label: 'Coupons & bank offers', to: '/deals?tab=offers' },
        { label: 'Watchlist', to: '/watchlist' },
      ],
    },
    {
      title: 'My DGkart',
      links: [
        { label: 'Your account', to: '/account' },
        { label: 'Your orders', to: '/orders' },
        { label: 'Saved addresses', to: '/account/addresses' },
        { label: 'Cart', to: '/cart' },
      ],
    },
    {
      title: 'Help',
      links: [
        { label: 'Help centre', to: '/help' },
        { label: 'Shipping & delivery', to: '/help#shipping' },
        { label: 'Returns & refunds', to: '/help#returns' },
        { label: 'Contact us', to: '/help#contact' },
      ],
    },
    {
      title: 'About',
      links: [
        { label: 'About DGkart', to: '/about' },
        { label: 'Privacy policy', to: '/privacy' },
        { label: 'Terms of use', to: '/terms' },
        { label: 'Get the Android app', to: '/app' },
      ],
    },
  ],
  /** Banks shown in the checkout's "Pay with" list for bank offers. */
  banks: ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra Bank', 'Yes Bank', 'IDFC FIRST Bank', 'AU Small Finance Bank', 'RBL Bank', 'Federal Bank', 'Bank of Baroda', 'OneCard'],
  /** Shown in the footer as accepted payment methods. */
  paymentMethods: ['UPI', 'Visa', 'Mastercard', 'RuPay', 'Net Banking', 'Wallets', 'Cash on Delivery'],
  androidAppUrl: 'https://github.com/ugoyel/dgkart/releases/download/demo/dgkart-demo.apk',
  delivery: { standardDays: '3-5', returnDays: 7 },
  /** Home page hero slides used when no festival or sale banner is live. */
  heroSlides: [
    { title: 'Big savings on mobiles', subtitle: 'Latest 5G phones with bank offers', to: '/search?category=mobiles', bg: 'linear-gradient(120deg,#0B3BA8,#1A56DB 60%,#60A5FA)' },
    { title: 'Fashion for every occasion', subtitle: 'Up to 60% off top brands', to: '/search?category=fashion', bg: 'linear-gradient(120deg,#9D174D,#DB2777 60%,#F9A8D4)' },
    { title: 'Home makeover', subtitle: 'Kitchen, decor & furniture deals', to: '/search?category=home-garden', bg: 'linear-gradient(120deg,#065F46,#059669 60%,#6EE7B7)' },
    { title: 'Gear up for the game', subtitle: 'Cricket, fitness & cycling', to: '/search?category=sports', bg: 'linear-gradient(120deg,#7C2D12,#EA580C 60%,#FDBA74)' },
  ],
};

export type Site = typeof site;
