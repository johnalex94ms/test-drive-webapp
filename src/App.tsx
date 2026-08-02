import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabaseClient';
import BookingPage from './pages/BookingPage';
import TrackerPage from './pages/TrackerPage';
import GestionReservaPage from './pages/GestionReservaPage';
import LoginAdminPage from './pages/admin/LoginAdminPage';
import ResetPasswordPage from './pages/admin/ResetPasswordPage';
import LoginConductorPage from './pages/conductor/LoginConductorPage';
import ConductorLayout from './pages/conductor/ConductorLayout';
import ConductorDashboardPage from './pages/conductor/ConductorDashboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import ReservasAdminPage from './pages/admin/ReservasAdminPage';
import CalendarioAdminPage from './pages/admin/CalendarioAdminPage';
import ConductoresAdminPage from './pages/admin/ConductoresAdminPage';
import AsesoresAdminPage from './pages/admin/AsesoresAdminPage';
import VehiculosAdminPage from './pages/admin/VehiculosAdminPage';
import PicoPlacaAdminPage from './pages/admin/PicoPlacaAdminPage';
import ReportesAdminPage from './pages/admin/ReportesAdminPage';
import NotificacionesAdminPage from './pages/admin/NotificacionesAdminPage';
import DiasBloqueadosAdminPage from './pages/admin/DiasBloqueadosAdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function RecoveryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RecoveryRedirect />
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/agendar" element={<BookingPage />} />
          <Route path="/tracker/:id" element={<TrackerPage />} />
          <Route path="/reserva/:token" element={<GestionReservaPage />} />

          <Route path="/admin/login" element={<LoginAdminPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/conductor/login" element={<LoginConductorPage />} />
          <Route path="/conductor" element={<ConductorLayout />}>
            <Route index element={<ConductorDashboardPage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<ReservasAdminPage />} />
            <Route path="calendario" element={<CalendarioAdminPage />} />
            <Route path="conductores" element={<ConductoresAdminPage />} />
            <Route path="asesores" element={<AsesoresAdminPage />} />
            <Route path="vehiculos" element={<VehiculosAdminPage />} />
            <Route path="pico-placa" element={<PicoPlacaAdminPage />} />
            <Route path="notificaciones" element={<NotificacionesAdminPage />} />
            <Route path="dias-bloqueados" element={<DiasBloqueadosAdminPage />} />
            <Route path="reportes" element={<ReportesAdminPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}