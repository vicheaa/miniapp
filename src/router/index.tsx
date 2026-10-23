import { Navigate, Route, Routes } from 'react-router-dom';
import PosTerminalPage from '../pages/PosTerminalPage';
import HomePage from '../pages/HomePage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pos-apps/:appId/pos" element={<PosTerminalPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
