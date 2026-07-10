import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import BookingPage from './pages/BookingPage';
import TrackerPage from './pages/TrackerPage';
import GestionReservaPage from './pages/GestionReservaPage';
import LoginAdminPage from './pages/admin/LoginAdminPage';
import AdminLayout from './pages/admin/AdminLayout';
import ReservasAdminPage from './pages/admin/ReservasAdminPage';
import CalendarioAdminPage from './pages/admin/CalendarioAdminPage';
import ConductoresAdminPage from './pages/admin/ConductoresAdminPage';
import ReportesAdminPage from './pages/admin/ReportesAdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/agendar" element={<BookingPage />} />
          <Route path="/tracker/:id" element={<TrackerPage />} />
          <Route path="/reserva/:token" element={<GestionReservaPage />} />

          <Route path="/admin/login" element={<LoginAdminPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<ReservasAdminPage />} />
            <Route path="calendario" element={<CalendarioAdminPage />} />
            <Route path="conductores" element={<ConductoresAdminPage />} />
            <Route path="reportes" element={<ReportesAdminPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}