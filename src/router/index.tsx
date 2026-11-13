import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import ProductsPage from '../pages/product';
import CartSummaryPage from '../pages/cart/CartSummaryPage';
import LocationPage from '../pages/cart/LocationPage';
import OrderHistoryPage from '../pages/orders/OrderHistoryPage';
import OrderDetailPage from '../pages/orders/OrderDetailPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/cart" element={<CartSummaryPage />} />
      <Route path="/cart/location" element={<LocationPage />} />
      <Route path="/orders" element={<OrderHistoryPage />} />
      <Route path="/orders/:orderId" element={<OrderDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
