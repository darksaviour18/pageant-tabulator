import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';
import JudgeLogin from './pages/JudgeLogin';
import JudgeDashboard from './pages/JudgeDashboard';
import ProtectedRoute, { JudgeProtectedRoute } from './components/ProtectedRoute';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Admin routes — wrapped in Layout + ProtectedRoute */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Judge portal routes — full-screen, no Layout */}
      <Route path="/judge/login" element={<JudgeLogin />} />
      <Route path="/judge/dashboard" element={
        <JudgeProtectedRoute>
          <JudgeDashboard />
        </JudgeProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
