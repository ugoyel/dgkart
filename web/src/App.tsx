import { Suspense, lazy } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { config } from './config/env';
import { AccountPage, AddressesPage, Login, OrderPage, OrdersPage, WatchlistPage } from './pages/Account';
import { CartPage } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Deals } from './pages/Deals';
import { Home } from './pages/Home';
import { InfoPage, NotFound } from './pages/Info';
import { ProductPage } from './pages/Product';
import { Categories, Search } from './pages/Search';
import { AppProviders } from './state/AppState';

const AdminRoutes = lazy(() => import('./pages/admin'));
const Router = config.router === 'hash' ? HashRouter : BrowserRouter;

export function App() {
  return (
    <Router basename={config.router === 'hash' ? undefined : config.basePath.replace(/\/$/, '') || undefined}>
      <AppProviders>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/addresses" element={<AddressesPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/about" element={<InfoPage page="about" />} />
            <Route path="/help" element={<InfoPage page="help" />} />
            <Route path="/privacy" element={<InfoPage page="privacy" />} />
            <Route path="/terms" element={<InfoPage page="terms" />} />
            <Route path="/app" element={<InfoPage page="app" />} />
            <Route path="/admin/*" element={<Suspense fallback={<Spinner />}><AdminRoutes /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </AppProviders>
    </Router>
  );
}
