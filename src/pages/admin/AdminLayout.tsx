import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useNavigate, useLocation, NavLink, Link } from 'react-router-dom';
import { Bell, BellRing, BellOff, ClipboardList, CalendarDays, Users, UserRound, BarChart3, Car, LogOut, X, CalendarClock, Ban, Wrench, ChevronDown, PanelLeftDashed, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminStore } from '../../store/adminStore';
import { estaListoParaVenta } from '../../lib/vidaUtilVehiculo';
import iconoNotificacion from '../../assets/images/notificaciones/imagen_notificacion_nuevo_test_drive.webp';
import logoDistrikia from '../../assets/images/logos/logotipo-distrikia-blanco.webp';
import logoDistridrive from '../../assets/images/logos/logotipo-distridrive.png';
import isotipoDistrikia from '../../assets/images/logos/isopotipo-distrikia.webp';
import loadingGif from '../../assets/images/loading/loading_coche.gif';

type ModoSidebar = 'expanded' | 'collapsed' | 'hover';

const OPCIONES_SIDEBAR: { value: ModoSidebar; label: string }[] = [
    { value: 'expanded', label: 'Expandido' },
    { value: 'collapsed', label: 'Colapsado' },
    { value: 'hover', label: 'Expandir al pasar el mouse' },
];

interface NavLinkItem {
    type: 'link';
    to: string;
    label: string;
    icon: any;
}

interface NavGroupItem {
    type: 'group';
    label: string;
    icon: any;
    children: { to: string; label: string; icon: any }[];
}

const NAV: (NavLinkItem | NavGroupItem)[] = [
    { type: 'link', to: '/admin', label: 'Reservas', icon: ClipboardList },
    { type: 'link', to: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
    {
        type: 'group', label: 'Flota', icon: Car, children: [
            { to: '/admin/vehiculos', label: 'Vehiculos', icon: Car },
            { to: '/admin/pico-placa', label: 'Pico y placa', icon: CalendarClock },
            { to: '/admin/dias-bloqueados', label: 'Dias bloqueados', icon: Ban },
            { to: '/admin/vehiculos-bloqueados', label: 'Vehiculos bloqueados', icon: Wrench },
        ]
    },
    {
        type: 'group', label: 'Equipo', icon: Users, children: [
            { to: '/admin/conductores', label: 'Conductores', icon: Users },
            { to: '/admin/asesores', label: 'Asesores', icon: UserRound },
        ]
    },
    { type: 'link', to: '/admin/notificaciones', label: 'Notificaciones', icon: Bell },
    { type: 'link', to: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
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
    const location = useLocation();
    const { perfil, cargando, setPerfil } = useAdminStore();
    const [alertasVenta, setAlertasVenta] = useState(0);
    const [reservasHoy, setReservasHoy] = useState(0);
    const [permiso, setPermiso] = useState<NotificationPermission>('default');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>(() => {
        const iniciales: Record<string, boolean> = {};
        NAV.forEach((item) => {
            if (item.type === 'group') {
                iniciales[item.label] = item.children.some((c) => location.pathname === c.to);
            }
        });
        return iniciales;
    });
    const [modoSidebar, setModoSidebar] = useState<ModoSidebar>(() => {
        const guardado = localStorage.getItem('admin-sidebar-modo');
        return (guardado as ModoSidebar) || 'expanded';
    });
    const [hoverActivo, setHoverActivo] = useState(false);
    const [configAbierta, setConfigAbierta] = useState(false);
    const [configPos, setConfigPos] = useState<{ bottom: number; left: number } | null>(null);
    const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
    const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
    const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
    const settingsPopoverRef = useRef<HTMLDivElement | null>(null);
    const flyoutPopoverRef = useRef<HTMLDivElement | null>(null);
    const grupoAbiertoColapsado = Object.keys(gruposAbiertos).find((k) => gruposAbiertos[k]);

    const expandido = modoSidebar === 'expanded' ? true : modoSidebar === 'collapsed' ? false : hoverActivo;

    function cambiarModoSidebar(modo: ModoSidebar) {
        setModoSidebar(modo);
        localStorage.setItem('admin-sidebar-modo', modo);
        setConfigAbierta(false);
    }

    function toggleConfig() {
        if (!configAbierta && settingsBtnRef.current) {
            const rect = settingsBtnRef.current.getBoundingClientRect();
            setConfigPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
        }
        setConfigAbierta((v) => !v);
    }

    useEffect(() => {
        function alHacerClickFuera(e: MouseEvent) {
            const target = e.target as Node;
            if (
                settingsBtnRef.current && !settingsBtnRef.current.contains(target) &&
                settingsPopoverRef.current && !settingsPopoverRef.current.contains(target)
            ) {
                setConfigAbierta(false);
            }
            if (
                flyoutPopoverRef.current && !flyoutPopoverRef.current.contains(target) &&
                !(target as HTMLElement).closest?.('[data-nav-group-trigger]')
            ) {
                setGruposAbiertos((prev) => {
                    const nuevo: Record<string, boolean> = {};
                    Object.keys(prev).forEach((k) => { nuevo[k] = false; });
                    return nuevo;
                });
            }
        }
        document.addEventListener('mousedown', alHacerClickFuera);
        return () => document.removeEventListener('mousedown', alHacerClickFuera);
    }, []);

    function mostrarTooltip(e: React.MouseEvent<HTMLElement>, label: string) {
        if (expandido) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 14 });
    }

    useEffect(() => {
        if (expandido) setTooltip(null);
    }, [expandido]);

    function ocultarTooltip() {
        setTooltip(null);
    }

    function toggleGrupo(label: string, e?: React.MouseEvent<HTMLButtonElement>) {
        const yaAbierto = !!gruposAbiertos[label];
        const rect = !yaAbierto && !expandido && e ? e.currentTarget.getBoundingClientRect() : null;

        setGruposAbiertos(() => {
            const nuevo: Record<string, boolean> = {};
            NAV.forEach((item) => {
                if (item.type === 'group') nuevo[item.label] = false;
            });
            nuevo[label] = !yaAbierto;
            return nuevo;
        });

        if (rect) {
            setFlyoutPos({ top: rect.top, left: rect.right + 14 });
        }
    }

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

    async function cargarAlertasVenta() {
        const res = await supabase.from('vehiculos').select('fecha_ingreso, activo').eq('activo', true);
        const total = (res.data || []).filter((v: any) => estaListoParaVenta(v.fecha_ingreso)).length;
        setAlertasVenta(total);
    }

    async function cargarReservasHoy() {
        const hoy = new Date().toISOString().slice(0, 10);
        const res = await supabase
            .from('reservas')
            .select('id', { count: 'exact', head: true })
            .eq('fecha', hoy)
            .in('estado', ['confirmada', 'en_camino', 'en_prueba']);
        setReservasHoy(res.count || 0);
    }

    useEffect(() => {
        cargarAlertasVenta();
        cargarReservasHoy();
    }, []);

    useEffect(() => {
        const canal = supabase
            .channel('admin-notificaciones')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'reservas' },
                (payload: any) => {
                    cargarReservasHoy();

                    const cliente = payload.new.cliente_nombre || 'Un cliente';

                    reproducirSonido();
                    mostrarToast('Nueva prueba de ruta', cliente + ' agendo y confirmo una prueba de ruta.');

                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        new Notification('Nueva prueba de ruta', {
                            body: cliente + ' agendo y confirmo una prueba de ruta.',
                            icon: iconoNotificacion,
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'reservas' },
                (payload: any) => {
                    cargarReservasHoy();

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
            <aside
                onMouseEnter={() => { if (modoSidebar === 'hover') setHoverActivo(true); }}
                onMouseLeave={() => { if (modoSidebar === 'hover') setHoverActivo(false); }}
                className={
                    'bg-gradient-to-b from-[#051620] to-black flex flex-col justify-between py-6 h-full flex-shrink-0 overflow-y-auto overflow-x-hidden transition-all duration-200 relative ' +
                    (expandido ? 'w-56' : 'w-16')
                }
            >
                <div>
                    {expandido ? (
                        <>
                            <div className="px-5 mb-4 flex items-start justify-between gap-2">
                                <Link to="/admin" className="hover:opacity-80 transition-opacity min-w-0">
                                    <img src={logoDistrikia} alt="Distrikia" className="h-5" />
                                </Link>
                                <button
                                    type="button"
                                    onClick={permiso === 'granted' ? undefined : activarNotificaciones}
                                    title={permiso === 'granted' ? 'Notificaciones activas' : 'Activar notificaciones'}
                                    className={
                                        'bell-hover flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ' +
                                        (permiso === 'granted' ? 'text-amber-400' : 'text-white/40 hover:text-white cursor-pointer hover:bg-white/10')
                                    }
                                >
                                    {permiso === 'granted' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                                </button>
                            </div>
                            <div className="px-5 mb-8 flex justify-center">
                                <img src={logoDistridrive} alt="Panel admin" className="w-[130px] h-auto" />
                            </div>
                        </>
                    ) : (
                        <div className="mb-8 flex flex-col items-center gap-2">
                            <Link to="/admin" className="hover:opacity-80 transition-opacity">
                                <img src={isotipoDistrikia} alt="Distrikia" className="h-8 w-8 object-contain" />
                            </Link>
                            <button
                                type="button"
                                onClick={permiso === 'granted' ? undefined : activarNotificaciones}
                                title={permiso === 'granted' ? 'Notificaciones activas' : 'Activar notificaciones'}
                                className={
                                    'bell-hover w-7 h-7 rounded-full flex items-center justify-center transition-colors ' +
                                    (permiso === 'granted' ? 'text-amber-400' : 'text-white/40 hover:text-white cursor-pointer hover:bg-white/10')
                                }
                            >
                                {permiso === 'granted' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                            </button>
                        </div>
                    )}
                    <nav className={'flex flex-col gap-1 ' + (expandido ? 'px-3' : 'px-2')}>
                        {NAV.map((item) => {
                            if (item.type === 'link') {
                                const Icon = item.icon;
                                const badge = item.to === '/admin' ? reservasHoy : item.to === '/admin/notificaciones' ? alertasVenta : 0;
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end
                                        onMouseEnter={(e) => mostrarTooltip(e, item.label)}
                                        onMouseLeave={ocultarTooltip}
                                        onClick={ocultarTooltip}
                                        className={({ isActive }) =>
                                            'group relative rounded-sm text-[13px] font-medium transition-colors flex items-center ' +
                                            (expandido ? 'px-3 py-2.5 justify-between' : 'px-0 py-2.5 justify-center') + ' ' +
                                            (isActive ? 'bg-white text-[#051620]' : 'text-white/70 hover:bg-white/10')
                                        }
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Icon className="nav-icon w-4 h-4" />
                                            {expandido && item.label}
                                        </span>
                                        {badge > 0 && (
                                            expandido ? (
                                                <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                    {badge}
                                                </span>
                                            ) : (
                                                <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-red-600" />
                                            )
                                        )}
                                    </NavLink>
                                );
                            }

                            const GroupIcon = item.icon;
                            const abierto = !!gruposAbiertos[item.label];
                            const grupoActivo = item.children.some((c) => location.pathname === c.to);

                            return (
                                <div key={item.label} className="relative group/navgroup">
                                    <button
                                        type="button"
                                        data-nav-group-trigger
                                        onClick={(e) => { toggleGrupo(item.label, e); ocultarTooltip(); }}
                                        onMouseEnter={(e) => mostrarTooltip(e, item.label)}
                                        onMouseLeave={ocultarTooltip}
                                        className={
                                            'group w-full rounded-sm text-[13px] font-medium transition-colors flex items-center cursor-pointer ' +
                                            (expandido ? 'px-3 py-2.5 justify-between' : 'px-0 py-2.5 justify-center') + ' ' +
                                            (grupoActivo && !abierto ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10')
                                        }
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <GroupIcon className="nav-icon w-4 h-4" />
                                            {expandido && item.label}
                                        </span>
                                        {expandido && (
                                            <ChevronDown className={'w-3.5 h-3.5 transition-transform ' + (abierto ? 'rotate-180' : '')} />
                                        )}
                                    </button>

                                    {/* Expandido: lista debajo, comportamiento normal */}
                                    {expandido && abierto && (
                                        <div className="flex flex-col gap-1 mt-1 pl-3">
                                            {item.children.map((child) => {
                                                const ChildIcon = child.icon;
                                                return (
                                                    <NavLink
                                                        key={child.to}
                                                        to={child.to}
                                                        end
                                                        className={({ isActive }) =>
                                                            'group px-3 py-2 rounded-sm text-[13px] font-medium transition-colors flex items-center gap-2.5 ' +
                                                            (isActive ? 'bg-white text-[#051620]' : 'text-white/60 hover:bg-white/10')
                                                        }
                                                    >
                                                        <ChildIcon className="nav-icon w-3.5 h-3.5" />
                                                        {child.label}
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    )}

                                </div>
                            );
                        })}
                    </nav>
                </div>

                {/* Colapsado: flyout del grupo abierto, renderizado por fuera del aside via portal */}
                {!expandido && grupoAbiertoColapsado && flyoutPos && createPortal(
                    (() => {
                        const grupo = NAV.find((i) => i.type === 'group' && i.label === grupoAbiertoColapsado) as NavGroupItem | undefined;
                        if (!grupo) return null;
                        return (
                            <div
                                ref={flyoutPopoverRef}
                                style={{ position: 'fixed', top: flyoutPos.top, left: flyoutPos.left }}
                                className="z-[200] bg-[#0a2030] border border-white/10 rounded-sm shadow-lg py-1.5 min-w-[170px]"
                            >
                                <p className="px-3 py-1 text-[10px] font-medium text-white/40 uppercase tracking-widest">{grupo.label}</p>
                                {grupo.children.map((child) => {
                                    const ChildIcon = child.icon;
                                    return (
                                        <NavLink
                                            key={child.to}
                                            to={child.to}
                                            end
                                            onClick={() => setGruposAbiertos((prev) => ({ ...prev, [grupo.label]: false }))}
                                            className={({ isActive }) =>
                                                'group px-3 py-2 text-[13px] font-medium transition-colors flex items-center gap-2.5 ' +
                                                (isActive ? 'bg-white text-[#051620]' : 'text-white/70 hover:bg-white/10')
                                            }
                                        >
                                            <ChildIcon className="nav-icon w-3.5 h-3.5" />
                                            {child.label}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        );
                    })(),
                    document.body
                )}
                <div className={'flex flex-col gap-3 ' + (expandido ? 'px-5' : 'px-2')}>
                    {perfil && expandido && (
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
                    {perfil && !expandido && (
                        <div className="flex justify-center pt-3 border-t border-white/10" title={perfil.nombre}>
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                                {obtenerIniciales(perfil.nombre)}
                            </div>
                        </div>
                    )}

                    {/* Configuracion del sidebar + cerrar sesion */}
                    {expandido ? (
                        <div className="flex items-center justify-between gap-2">
                            <button
                                ref={settingsBtnRef}
                                type="button"
                                onClick={() => { toggleConfig(); ocultarTooltip(); }}
                                className="flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer rounded-sm p-2 hover:bg-white/10 flex-shrink-0"
                            >
                                <PanelLeftDashed className="w-4 h-4 flex-shrink-0" />
                            </button>

                            <button
                                type="button"
                                onClick={cerrarSesion}
                                className="flex items-center gap-2 text-[13px] text-white/60 hover:text-red-400 transition-colors cursor-pointer rounded-sm p-2 hover:bg-red-500/10 flex-shrink-0"
                            >
                                <LogOut className="w-4 h-4" />
                                Cerrar sesion
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                ref={settingsBtnRef}
                                type="button"
                                onClick={() => { toggleConfig(); ocultarTooltip(); }}
                                onMouseEnter={(e) => mostrarTooltip(e, 'Sidebar control')}
                                onMouseLeave={ocultarTooltip}
                                className="w-full rounded-sm text-[13px] font-light transition-colors flex items-center justify-center gap-2.5 cursor-pointer text-white/60 hover:text-white hover:bg-white/10 px-0 py-2.5"
                            >
                                <PanelLeftDashed className="w-5 h-4 flex-shrink-0" />
                            </button>

                            <button
                                type="button"
                                onClick={cerrarSesion}
                                onMouseEnter={(e) => mostrarTooltip(e, 'Cerrar sesion')}
                                onMouseLeave={ocultarTooltip}
                                className="w-full rounded-sm text-[13px] font-medium transition-colors flex items-center justify-center gap-2.5 cursor-pointer text-white/60 hover:text-red-400 hover:bg-red-500/10 px-0 py-2.5"
                            >
                                <LogOut className="w-4 h-4 flex-shrink-0" />
                            </button>
                        </>
                    )}

                    {configAbierta && configPos && createPortal(
                        <div
                            ref={settingsPopoverRef}
                            style={{ position: 'fixed', bottom: configPos.bottom, left: configPos.left }}
                            className="z-[200] bg-[#0a2030] border border-white/10 rounded-sm shadow-lg py-1.5 w-[168px]"
                        >
                            <p className="px-3 py-1 text-[9px] font-medium text-white/40 uppercase tracking-widest">
                                Sidebar control
                            </p>
                            {OPCIONES_SIDEBAR.map((op) => (
                                <button
                                    key={op.value}
                                    type="button"
                                    onClick={() => cambiarModoSidebar(op.value)}
                                    className={
                                        'w-full text-left px-3 py-2 text-[13px] flex items-center justify-between gap-2 cursor-pointer transition-colors ' +
                                        (modoSidebar === op.value ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10')
                                    }
                                >
                                    {op.label}
                                    {modoSidebar === op.value && <Check className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                        </div>,
                        document.body
                    )}
                </div>
            </aside>

            {/* Tooltip tipo toast para items colapsados */}
            {tooltip && createPortal(
                <div
                    style={{ position: 'fixed', top: tooltip.top, left: tooltip.left, transform: 'translateY(-50%)' }}
                    className="z-[200] bg-[#0a2030] border border-white/10 rounded-sm shadow-lg px-3 py-1.5 text-[13px] font-medium text-white whitespace-nowrap pointer-events-none animate-fade-in-only"
                >
                    {tooltip.label}
                </div>,
                document.body
            )}

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