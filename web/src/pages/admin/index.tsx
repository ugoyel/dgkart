import { Route, Routes } from 'react-router-dom';
import { NotFound } from '../Info';
import { AdminImport, AdminOrders, AdminProducts } from './AdminCatalog';
import { AdminFestivals } from './AdminFestivals';
import { AdminDashboard, AdminNotifications } from './AdminHome';
import { AdminOffers } from './AdminOffers';

/** Admin routes (lazy-loaded so shoppers never download them). */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="notifications" element={<AdminNotifications />} />
      <Route path="offers" element={<AdminOffers />} />
      <Route path="festivals" element={<AdminFestivals />} />
      <Route path="products" element={<AdminProducts />} />
      <Route path="import" element={<AdminImport />} />
      <Route path="orders" element={<AdminOrders />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
