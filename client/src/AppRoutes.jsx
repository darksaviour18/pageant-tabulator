import { Routes, Route } from 'react-router-dom';
import EventSetup from './pages/EventSetup';
import NotFound from './pages/NotFound';
import JudgeLogin from './pages/JudgeLogin';
import JudgeDashboard from './pages/JudgeDashboard';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Admin routes */}
      <Route path="/" element={<EventSetup />} />

      {/* Judge portal routes (full-screen, no admin layout) */}
      <Route path="/judge/login" element={<JudgeLogin />} />
      <Route path="/judge/dashboard" element={<JudgeDashboard />} />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
