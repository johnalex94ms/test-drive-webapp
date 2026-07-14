import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, Link } from 'react-router-dom';
import { Bell, BellOff, ClipboardList, CalendarDays, Users, BarChart3, Car, LogOut, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminStore } from '../../store/adminStore';
import iconoNotificacion from '../../assets/images/notificaciones/imagen_notificacion_nuevo_test_drive.webp';
import logoDistrikia from '../../assets/images/logos/logotipo-distrikia-blanco.webp';
import loadingGif from '../../assets/images/loading/loading_coche.gif';

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

function obtenerIniciales(nombre: string) {
    if (!nombre) return '?';
    const partes = nombre.trim().split(' ');
    const a = partes[0] ? partes[0][0] : '';
    const b = partes[1] ? partes[1][0] : '';
    return (a + b).toUpperCase();
}

interface Toast {
    id: number;
    titulo: string;
    mensaje: string;
}

export default function AdminLayout() {
    const navigate = useNavigate();
    const { perfil, cargando, setPerfil } = useAdminStore();
    const [pendientes, setPendientes] = useState(0);
    const [permiso, setPermiso] = useState<NotificationPermission>('default');
    const [toasts, setToasts] = useState<Toast[]>([]);

    function mostrarToast(titulo: string, mensaje: string) {
        const id = Date.now();
        setToasts((actuales) => [...actuales, { id, titulo, mensaje }]);
        setTimeout(() => {
            setToasts((actuales) => actuales.filter((t) => t.id !== id));
        }, 20000);
    }

    function cerrarToast(id: number) {
        setToasts((actuales) => actuales.filter((t) => t.id !== id));
    }

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
                    mostrarToast('Nueva prueba de ruta', cliente + ' agendo una prueba y espera aprobacion.');

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
                        const cliente = actual.cliente_nombre || 'Un cliente';
                        mostrarToast('Prueba reprogramada', cliente + ' cambio su fecha a ' + actual.fecha + ' ' + (actual.hora_inicio || '').slice(0, 5));

                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            new Notification('Prueba reprogramada', {
                                body: cliente + ' cambio su fecha a ' + actual.fecha + ' ' + (actual.hora_inicio || '').slice(0, 5),
                                icon: iconoNotificacion,
                            });
                        }
                    }
                }
            )
            .subscribe();

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
            <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-[#FFFFFF]">
                <img src={loadingGif} alt="Cargando" className="w-24 h-24 object-contain" />
                <p className="text-[#000000] text-md">Cargando...</p>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[#f8f8f8] flex overflow-hidden">
            <aside className="w-56 bg-[#051620] flex flex-col justify-between py-6 h-full flex-shrink-0 overflow-y-auto">
                <div>
                    <Link to="/admin" className="px-5 mb-8 block hover:opacity-80 transition-opacity">
                        <img src={logoDistrikia} alt="Distrikia" className="h-5 mb-2" />
                        <p className="font-display text-lg font-bold text-white">Panel admin</p>
                    </Link>
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
                        <p className="flex items-center justify-center gap-2 text-xs text-white/40">
                            <Bell className="w-3.5 h-3.5" />
                            Notificaciones activas
                        </p>
                    )}

                    {perfil && (
                        <div className="flex items-center gap-2.5 pt-3 border-t border-white/10">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                                {obtenerIniciales(perfil.nombre)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate">{perfil.nombre}</p>
                                <p className="text-[10px] text-white/40 truncate">{perfil.rol === 'super_admin' ? 'Super admin' : 'Admin'}</p>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={cerrarSesion}
                        className="flex items-center gap-2 text-sm text-white/60 hover:text-red-400 transition-colors cursor-pointer bg-white/5 hover:bg-red-500/10 rounded-sm px-3 py-2"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Cerrar sesion
                    </button>
                </div>
            </aside>

            <main className="flex-1 h-full overflow-y-auto p-8">
                <Outlet />
            </main>

            {/* Toasts de notificacion */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className="bg-[#051620] text-white rounded-sm shadow-lg p-4 flex items-start gap-3 animate-fade-rotate"
                    >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Bell className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold">{toast.titulo}</p>
                            <p className="text-xs text-white/60 mt-0.5">{toast.mensaje}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => cerrarToast(toast.id)}
                            className="text-white/40 hover:text-white cursor-pointer flex-shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}