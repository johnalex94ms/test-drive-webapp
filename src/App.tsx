import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BookingPage from './pages/BookingPage';
import TrackerPage from './pages/TrackerPage';
import GestionReservaPage from './pages/GestionReservaPage';
import LoginAdminPage from './pages/admin/LoginAdminPage';
import LoginConductorPage from './pages/conductor/LoginConductorPage';
import ConductorLayout from './pages/conductor/ConductorLayout';
import ConductorDashboardPage from './pages/conductor/ConductorDashboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import ReservasAdminPage from './pages/admin/ReservasAdminPage';
import CalendarioAdminPage from './pages/admin/CalendarioAdminPage';
import ConductoresAdminPage from './pages/admin/ConductoresAdminPage';
import VehiculosAdminPage from './pages/admin/VehiculosAdminPage';
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
          <Route path="/" element={<BookingPage />} />
          <Route path="/agendar" element={<BookingPage />} />
          <Route path="/tracker/:id" element={<TrackerPage />} />
          <Route path="/reserva/:token" element={<GestionReservaPage />} />

          <Route path="/admin/login" element={<LoginAdminPage />} />
          <Route path="/conductor/login" element={<LoginConductorPage />} />
          <Route path="/conductor" element={<ConductorLayout />}>
            <Route index element={<ConductorDashboardPage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<ReservasAdminPage />} />
            <Route path="calendario" element={<CalendarioAdminPage />} />
            <Route path="conductores" element={<ConductoresAdminPage />} />
            <Route path="vehiculos" element={<VehiculosAdminPage />} />
            <Route path="reportes" element={<ReportesAdminPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}