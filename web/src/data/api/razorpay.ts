/* Loads Razorpay Checkout on demand (only when a shopper pays online). */
interface RazorpayInstance {
  open(): void;
  on(event: string, cb: () => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let loading: Promise<RazorpayCtor> | null = null;

export function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Razorpay failed to load')));
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load the payment window. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
