/** Build-time settings (see .env.example). */
const env = import.meta.env;

const apiBase = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const config = {
  /** demo = in-browser sample data; api = the DGkart API. */
  dataMode: (env.VITE_DATA_MODE === 'api' && apiBase ? 'api' : 'demo') as 'api' | 'demo',
  apiBaseUrl: apiBase,
  /** browser = normal URLs; hash = /#/path for hosts without rewrites; memory = never touches the address bar (embedded previews). */
  router: (['hash', 'memory'].includes(env.VITE_ROUTER) ? env.VITE_ROUTER : 'browser') as 'browser' | 'hash' | 'memory',
  basePath: env.BASE_URL ?? '/',
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  },
};

/** Resolve an image path from the API or the demo catalogue to a URL. */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (url.startsWith('/uploads/')) return config.apiBaseUrl + url;
  return config.basePath + url.replace(/^\//, '');
}
