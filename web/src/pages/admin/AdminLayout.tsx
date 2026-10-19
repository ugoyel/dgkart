import { pendingCount } from '@engine';
import { ReactNode } from 'react';
import { Navigate, NavLink } from 'react-router-dom';
import { Icon, IconName } from '../../components/Icon';
import { useAdminReminders } from '../../components/Layout';
import { Spinner, useTitle } from '../../components/ui';
import { useAuth } from '../../state/AppState';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/admin', label: 'Dashboard', icon: 'home' },
  { to: '/admin/notifications', label: 'Festival reminders', icon: 'bell' },
  { to: '/admin/offers', label: 'Offers & deals', icon: 'tag' },
  { to: '/admin/festivals', label: 'Festivals & themes', icon: 'palette' },
  { to: '/admin/products', label: 'Products', icon: 'box' },
  { to: '/admin/import', label: 'Catalogue upload', icon: 'upload' },
  { to: '/admin/orders', label: 'Orders', icon: 'receipt' },
];

export function AdminLayout({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  useTitle(`Admin · ${title}`);
  const { user, ready, isAdmin } = useAuth();
  const reminders = useAdminReminders();
  if (!ready) return <div className="container"><Spinner /></div>;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!isAdmin) return <div className="container"><div className="card"><h1>Admin only</h1><p>Sign in with the admin mobile number to manage the store.</p></div></div>;
  const pending = pendingCount(reminders);
  return (
    <div className="container admin">
      <nav className="admin-nav" aria-label="Admin">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/admin'}>
            <Icon name={n.icon} size={20} /> <span>{n.label}</span>
            {n.to === '/admin/notifications' && pending > 0 && <span className="dot-count inline">{pending}</span>}
          </NavLink>
        ))}
      </nav>
      <section className="admin-main">
        <div className="admin-head">
          <h1>{title}</h1>
          <div className="row">{actions}</div>
        </div>
        {children}
      </section>
    </div>
  );
}

/** Tell the header bell and dashboard to refresh after offers or reminders change. */
export const remindersChanged = () => window.dispatchEvent(new Event('dg:reminders-changed'));
