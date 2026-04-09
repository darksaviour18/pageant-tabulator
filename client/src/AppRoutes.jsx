import { Routes, Route } from 'react-router-dom';
import EventSetup from './pages/EventSetup';
import NotFound from './pages/NotFound';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EventSetup />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
