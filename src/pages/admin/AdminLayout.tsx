import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { Bell, BellOff, ClipboardList, CalendarDays, Users, BarChart3, Car } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminStore } from '../../store/adminStore';
import iconoNotificacion from '../../assets/images/notificaciones/imagen_notificacion_nuevo_test_drive.webp';

const LINKS = [
    { to: '/admin', label: 'Reservas', icon: ClipboardList },
    { to: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
    { to: '/admin/vehiculos', label: 'Vehiculos', icon: Car },
    { to: '/admin/conductores', label: 'Conductores', icon: Users },
    { to: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
];

function reproducirSonido() {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch {
        // navegador sin soporte de audio, se ignora
    }
}

export default function AdminLayout() {
    const navigate = useNavigate();
    const { perfil, cargando, setPerfil } = useAdminStore();
    const [pendientes, setPendientes] = useState(0);
    const [permiso, setPermiso] = useState<NotificationPermission>('default');

    useEffect(() => {
        async function verificar() {
            const { data: sesion } = await supabase.auth.getSession();
            if (!sesion.session) {
                navigate('/admin/login');
                return;
            }

            const { data: perfilData } = await supabase
                .from('admins')
                .select('*')
                .eq('id', sesion.session.user.id)
                .eq('activo', true)
                .single();

            if (!perfilData) {
                navigate('/admin/login');
                return;
            }

            setPerfil(perfilData);
        }
        verificar();
    }, [navigate, setPerfil]);

    useEffect(() => {
        if (typeof Notification !== 'undefined') {
            setPermiso(Notification.permission);
        }
    }, []);

    async function cargarConteoPendientes() {
        const res = await supabase
            .from('reservas')
            .select('id', { count: 'exact', head: true })
            .eq('estado', 'pendiente');
        setPendientes(res.count || 0);
    }

    useEffect(() => {
        cargarConteoPendientes();

        const canal = supabase
            .channel('admin-notificaciones')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'reservas' },
                (payload: any) => {
                    cargarConteoPendientes();

                    if (payload.new.estado !== 'pendiente') return;

                    const cliente = payload.new.cliente_nombre || 'Un cliente';

                    reproducirSonido();

                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        new Notification('Nueva prueba de ruta', {
                            body: cliente + ' agendo una prueba y espera aprobacion.',
                            icon: iconoNotificacion,
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'reservas' },
                (payload: any) => {
                    cargarConteoPendientes();

                    const anterior = payload.old;
                    const actual = payload.new;
                    const fueReprogramada = anterior.estado === actual.estado &&
                        (anterior.fecha !== actual.fecha || anterior.hora_inicio !== actual.hora_inicio);

                    if (fueReprogramada) {
                        reproducirSonido();
                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            new Notification('Prueba reprogramada', {
                                body: (actual.cliente_nombre || 'Un cliente') + ' cambio su fecha a ' + actual.fecha + ' ' + (actual.hora_inicio || '').slice(0, 5),
                                icon: iconoNotificacion,
                            });
                        }
                    }
                }
            )
            .subscribe((status) => console.log('Estado canal admin-notificaciones:', status));

        return () => {
            supabase.removeChannel(canal);
        };
    }, []);

    async function activarNotificaciones() {
        if (typeof Notification === 'undefined') return;
        const resultado = await Notification.requestPermission();
        setPermiso(resultado);
    }

    async function cerrarSesion() {
        await supabase.auth.signOut();
        setPerfil(null);
        navigate('/admin/login');
    }

    if (cargando) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
                <p className="text-[#666] text-sm">Cargando...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex">
            <aside className="w-56 bg-[#051620] flex flex-col justify-between py-6">
                <div>
                    <div className="px-5 mb-8">
                        <p className="text-xs text-white/40 uppercase tracking-widest">Distrikia</p>
                        <p className="font-display text-lg font-bold text-white">Panel admin</p>
                    </div>
                    <nav className="flex flex-col gap-1 px-3">
                        {LINKS.map((link) => {
                            const Icon = link.icon;
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    end
                                    className={({ isActive }) =>
                                        'px-3 py-2.5 rounded-sm text-sm font-medium transition-colors flex items-center justify-between ' +
                                        (isActive ? 'bg-white text-[#051620]' : 'text-white/70 hover:bg-white/10')
                                    }
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Icon className="w-4 h-4" />
                                        {link.label}
                                    </span>
                                    {link.to === '/admin' && pendientes > 0 && (
                                        <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                            {pendientes}
                                        </span>
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>
                <div className="px-5 flex flex-col gap-3">
                    {permiso !== 'granted' && (
                        <button
                            type="button"
                            onClick={activarNotificaciones}
                            className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
                        >
                            <BellOff className="w-3.5 h-3.5" />
                            Activar notificaciones
                        </button>
                    )}
                    {permiso === 'granted' && (
                        <p className="flex items-center gap-2 text-xs text-white/40">
                            <Bell className="w-3.5 h-3.5" />
                            Notificaciones activas
                        </p>
                    )}
                    {perfil && (
                        <p className="text-xs text-white/40">{perfil.nombre}</p>
                    )}
                    <button
                        type="button"
                        onClick={cerrarSesion}
                        className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer text-left"
                    >
                        Cerrar sesion
                    </button>
                </div>
            </aside>

            <main className="flex-1 p-8">
                <Outlet />
            </main>
        </div>
    );
}