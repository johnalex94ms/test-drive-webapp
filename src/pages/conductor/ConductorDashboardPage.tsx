import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../styles/booking-calendar.css';
import { Phone, Mail, X, IdCard, CalendarDays, Clock, User, LayoutList, CalendarRange, MapPin, ChevronDown, Rows3, LayoutGrid } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useConductorStore } from '../../store/conductorStore';
import { fechaHoyLocal } from '../../lib/fecha';
import { obtenerFotoCarro } from '../../lib/vehiculoImagenes';

const ESTILO_ESTADO: Record<string, { bg: string; texto: string; label: string }> = {
    confirmada: { bg: '#dcf3e4', texto: '#0a6e3a', label: 'Confirmada' },
    en_camino: { bg: '#dbe9fb', texto: '#0a4a8a', label: 'En camino' },
    en_prueba: { bg: '#dbe9fb', texto: '#0a4a8a', label: 'En prueba' },
    finalizada: { bg: '#f0f0f0', texto: '#666666', label: 'Finalizada' },
    cancelada: { bg: '#fbdcdc', texto: '#8a1f1f', label: 'Cancelada' },
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { locale: es }),
    getDay,
    locales: { es },
});

function formatearFecha(fechaISO: string) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ConductorDashboardPage() {
    const { perfil } = useConductorStore();
    const [filtro, setFiltro] = useState<'proximas' | 'todas'>('proximas');
    const [estadoFiltro, setEstadoFiltro] = useState('todos');
    const [sedeFiltro, setSedeFiltro] = useState('todas');
    const [vista, setVista] = useState<'lista' | 'calendario'>('lista');
    const [vistaCompacta, setVistaCompacta] = useState(false);
    const [vistaCalendario, setVistaCalendario] = useState<View>('month');
    const [fechaVisible, setFechaVisible] = useState(new Date());
    const [reservaSel, setReservaSel] = useState<any>(null);
    const [reservaExpandidaId, setReservaExpandidaId] = useState<string | null>(null);
    const [diaCalendarioSel, setDiaCalendarioSel] = useState<string | null>(null);
    const [cerrandoPanelDias, setCerrandoPanelDias] = useState(false);
    const [diasExpandidos, setDiasExpandidos] = useState<Record<string, boolean>>({});
    const queryClient = useQueryClient();

    function abrirPanelDia(diaStr: string) {
        setDiaCalendarioSel(diaStr);
        setDiasExpandidos({ [diaStr]: true });
    }

    function cerrarPanelDias() {
        setCerrandoPanelDias(true);
        setTimeout(() => {
            setDiaCalendarioSel(null);
            setCerrandoPanelDias(false);
        }, 260);
    }

    function toggleDiaExpandido(diaStr: string) {
        setDiasExpandidos((s) => ({ ...s, [diaStr]: !s[diaStr] }));
    }

    useEffect(() => {
        if (!diaCalendarioSel) return;
        const overflowPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflowPrevio;
        };
    }, [diaCalendarioSel]);

    const reservasQuery = useQuery({
        queryKey: ['conductor-reservas', perfil?.id],
        enabled: !!perfil?.id,
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('*, vehiculos(*), sedes(*), conductores(nombre, foto_url)')
                .eq('conductor_id', perfil!.id)
                .in('estado', ['confirmada', 'en_camino', 'en_prueba', 'finalizada', 'cancelada'])
                .order('fecha', { ascending: true })
                .order('hora_inicio', { ascending: true });
            return res.data || [];
        },
    });

    useEffect(() => {
        if (!perfil?.id) return;
        const canal = supabase
            .channel('conductor-reservas-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reservas', filter: 'conductor_id=eq.' + perfil.id },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['conductor-reservas', perfil.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, [perfil?.id, queryClient]);

    const reservas = reservasQuery.data || [];
    const hoyStr = fechaHoyLocal();

    const sedesDisponibles = Array.from(
        new Set(reservas.map((r: any) => (r.sedes ? r.sedes.nombre : null)).filter(Boolean))
    ) as string[];

    const reservasFiltradas = reservas.filter((r: any) => {
        const pasaProximas = filtro === 'todas' || (r.fecha >= hoyStr && r.estado !== 'finalizada' && r.estado !== 'cancelada');
        const pasaEstado = estadoFiltro === 'todos' || r.estado === estadoFiltro;
        const pasaSede = sedeFiltro === 'todas' || (r.sedes && r.sedes.nombre === sedeFiltro);
        return pasaProximas && pasaEstado && pasaSede;
    });

    const reservasPorDia: Array<[string, any[]]> = [];
    {
        const grupos: Record<string, any[]> = {};
        reservasFiltradas.forEach((r: any) => {
            if (!grupos[r.fecha]) grupos[r.fecha] = [];
            grupos[r.fecha].push(r);
        });
        Object.keys(grupos).forEach((fecha) => reservasPorDia.push([fecha, grupos[fecha]]));
    }

    const inicioMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth(), 1);
    const finMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth() + 1, 0);
    const inicioMesStr = format(inicioMes, 'yyyy-MM-dd');
    const finMesStr = format(finMes, 'yyyy-MM-dd');

    const diasBloqueadosQuery = useQuery({
        queryKey: ['dias-bloqueados', inicioMesStr, finMesStr],
        enabled: vista === 'calendario',
        queryFn: async () => {
            const res = await supabase
                .from('dias_bloqueados')
                .select('*')
                .gte('fecha', inicioMesStr)
                .lte('fecha', finMesStr);
            return res.data || [];
        },
    });

    const fechasBloqueadas: Record<string, string> = {};
    (diasBloqueadosQuery.data || []).forEach((d: any) => {
        fechasBloqueadas[d.fecha] = d.motivo;
    });

    const reservasPorDiaMapa: Record<string, any[]> = {};
    reservasPorDia.forEach(([fecha, lista]) => {
        reservasPorDiaMapa[fecha] = lista;
    });

    function colorCarga(cantidad: number) {
        if (cantidad >= 5) return { bg: '#f8caca', texto: '#8a1f1f' };
        if (cantidad >= 3) return { bg: '#fdecec', texto: '#8a1f1f' };
        return { bg: '#dcf3e4', texto: '#0a6e3a' };
    }

    function getDayPropGetter(date: Date) {
        const diaStr = format(date, 'yyyy-MM-dd');
        if (fechasBloqueadas[diaStr]) return { className: 'dia-lleno' };
        return { className: 'dia-clickeable' };
    }

    function DiaPersonalizado(props: any) {
        const date = props.date;
        const diaStr = format(date, 'yyyy-MM-dd');
        const motivo = fechasBloqueadas[diaStr];
        const reservasEseDia = reservasPorDiaMapa[diaStr] || [];
        const cantidad = reservasEseDia.length;
        const color = cantidad > 0 ? colorCarga(cantidad) : null;
        return (
            <button
                type="button"
                onClick={() => { if (!motivo && cantidad > 0) abrirPanelDia(diaStr); }}
                title={motivo || (cantidad > 0 ? cantidad + ' prueba(s) este dia' : undefined)}
                style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 26,
                    background: 'transparent',
                    border: 'none',
                    cursor: motivo ? 'default' : cantidad > 0 ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 3,
                    padding: '2px 2px 4px',
                }}
            >
                <span style={{ fontSize: 13, fontWeight: motivo ? 700 : 600, color: motivo ? '#999' : '#051620' }}>
                    {format(date, 'd')}
                </span>
                {motivo && (
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 500,
                            lineHeight: 1.15,
                            color: '#999',
                            opacity: 0.9,
                            maxWidth: '100%',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            padding: '0 2px',
                            textAlign: 'center',
                        }}
                    >
                        {motivo}
                    </span>
                )}
                {!motivo && color && (
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: color.bg,
                            color: color.texto,
                        }}
                    >
                        {cantidad} {cantidad === 1 ? 'prueba' : 'pruebas'}
                    </span>
                )}
            </button>
        );
    }

    const eventosCalendario = reservasFiltradas.map((r: any) => {
        const inicio = new Date(r.fecha + 'T' + r.hora_inicio);
        const fin = new Date(r.fecha + 'T' + r.hora_fin);
        const placa = r.vehiculos ? r.vehiculos.placa : '';
        return {
            title: (placa || 'Prueba') + ' · ' + r.hora_inicio.slice(0, 5),
            start: inicio,
            end: fin,
            resource: r,
        };
    });

    function estiloEvento(event: any) {
        const estilo = ESTILO_ESTADO[event.resource.estado] || ESTILO_ESTADO.confirmada;
        return { style: { backgroundColor: estilo.texto, border: 'none' } };
    }

    const diasDelMesConReservas = reservasPorDia
        .filter(([fecha]) => fecha >= inicioMesStr && fecha <= finMesStr)
        .sort(([a], [b]) => a.localeCompare(b));

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">
                    Hola, {perfil?.nombre?.split(' ')[0]}
                </h1>
                <p className="text-sm text-[#666]">Estas son tus pruebas de ruta asignadas.</p>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setVista('lista')}
                        className={
                            'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                            (vista === 'lista' ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                        }
                    >
                        <LayoutList className="w-3.5 h-3.5" />
                        Lista
                    </button>
                    <button
                        type="button"
                        onClick={() => setVista('calendario')}
                        className={
                            'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                            (vista === 'calendario' ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                        }
                    >
                        <CalendarRange className="w-3.5 h-3.5" />
                        Calendario
                    </button>
                </div>
            </div>

            <div className="mb-6 flex items-end gap-4 flex-wrap">
                <div>
                    <label className="text-xs text-[#666] block mb-1">Rango</label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltro('proximas')}
                            className={
                                'px-4 py-2 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                                (filtro === 'proximas' ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                            }
                        >
                            Proximas
                        </button>
                        <button
                            type="button"
                            onClick={() => setFiltro('todas')}
                            className={
                                'px-4 py-2 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                                (filtro === 'todas' ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                            }
                        >
                            Todas
                        </button>
                    </div>
                </div>

                <div>
                    <label className="text-xs text-[#666] block mb-1">Estado</label>
                    <select
                        value={estadoFiltro}
                        onChange={(e) => setEstadoFiltro(e.target.value)}
                        className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                        style={{
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                            backgroundPosition: 'right 10px center',
                        }}
                    >
                        <option value="todos">Todos los estados</option>
                        <option value="confirmada">Confirmada</option>
                        <option value="en_camino">En camino</option>
                        <option value="en_prueba">En prueba</option>
                        <option value="finalizada">Finalizada</option>
                        <option value="cancelada">Cancelada</option>
                    </select>
                </div>

                {sedesDisponibles.length > 1 && (
                    <div>
                        <label className="text-xs text-[#666] block mb-1">Sede</label>
                        <select
                            value={sedeFiltro}
                            onChange={(e) => setSedeFiltro(e.target.value)}
                            className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                            style={{
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                                backgroundPosition: 'right 10px center',
                            }}
                        >
                            <option value="todas">Todas las sedes</option>
                            {sedesDisponibles.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                )}

                {vista === 'lista' && (
                    <div className="ml-auto">
                        <label className="text-xs text-[#666] block mb-1">Vista</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setVistaCompacta(false)}
                                className={
                                    'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                                    (!vistaCompacta ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                                }
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Mostrar
                            </button>
                            <button
                                type="button"
                                onClick={() => setVistaCompacta(true)}
                                className={
                                    'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                                    (vistaCompacta ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                                }
                            >
                                <Rows3 className="w-3.5 h-3.5" />
                                Compactar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {reservasQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : vista === 'calendario' ? (
                <div className="bg-white border border-[#e5e5e5] rounded-sm p-4">
                    <Calendar
                        localizer={localizer}
                        culture="es"
                        events={eventosCalendario}
                        startAccessor="start"
                        endAccessor="end"
                        views={['month', 'week', 'agenda']}
                        view={vistaCalendario}
                        onView={setVistaCalendario}
                        date={fechaVisible}
                        onNavigate={setFechaVisible}
                        onSelectEvent={(event: any) => setReservaSel(event.resource)}
                        eventPropGetter={estiloEvento}
                        dayPropGetter={getDayPropGetter}
                        components={{
                            month: {
                                dateHeader: DiaPersonalizado,
                                event: () => null,
                            },
                        }}
                        formats={{
                            monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }),
                            dayHeaderFormat: (date: Date) => format(date, "EEEE d 'de' MMMM", { locale: es }),
                            weekdayFormat: (date: Date) => format(date, 'EEE', { locale: es }),
                        }}
                        style={{ height: 600 }}
                        messages={{
                            month: 'Mes', week: 'Semana', day: 'Dia', agenda: 'Agenda',
                            today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
                            noEventsInRange: 'Sin pruebas de ruta en este rango.',
                        }}
                    />
                    <p className="text-xs text-[#999] mt-3">
                        En la vista de mes, toca un dia con pruebas para ver el listado completo de ese dia.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[#666] mt-3 flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#0a6e3a' }} />
                            1-2 pruebas
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#8a1f1f' }} />
                            3-4 pruebas
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                            5 o mas pruebas
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#666] mt-2 flex-wrap">
                        {Object.entries(ESTILO_ESTADO).map(([key, val]) => (
                            <span key={key} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: val.texto }} />
                                {val.label}
                            </span>
                        ))}
                    </div>
                </div>
            ) : reservasFiltradas.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No tienes pruebas de ruta que coincidan con estos filtros.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                    {reservasPorDia.map(([fecha, reservasDia]) => (
                        <div key={fecha} className="bg-[#f8f8f8] rounded-lg p-3">
                            <p className="text-sm font-semibold text-[#051620] mb-3 capitalize px-1">
                                {formatearFecha(fecha)} · {reservasDia.length} {reservasDia.length === 1 ? 'prueba' : 'pruebas'}
                            </p>
                            <div className={'flex flex-col gap-3' + (reservasDia.length > 4 ? ' max-h-[560px] overflow-y-auto scroll-fino pr-1' : '')}>
                                {reservasDia.map((r: any) => {
                                    const estilo = ESTILO_ESTADO[r.estado] || ESTILO_ESTADO.confirmada;
                                    const foto = r.vehiculos ? obtenerFotoCarro(r.vehiculos.modelo) : undefined;

                                    if (vistaCompacta) {
                                        return (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => setReservaSel(r)}
                                                className="w-full flex items-center gap-2 text-left bg-white border border-[#e5e5e5] rounded-md px-3 py-2 hover:border-[#051620] transition-colors cursor-pointer"
                                            >
                                                <span className="text-xs font-semibold text-[#051620] flex-shrink-0">
                                                    {r.hora_inicio.slice(0, 5)}
                                                </span>
                                                <span className="text-xs text-[#051620] truncate flex-1 min-w-0">
                                                    {r.vehiculos ? r.vehiculos.modelo : 'Vehiculo'}
                                                    {r.vehiculos?.placa && <span className="text-[#999]"> · {r.vehiculos.placa}</span>}
                                                </span>
                                                <span
                                                    className="flex-shrink-0 w-2 h-2 rounded-full"
                                                    style={{ background: estilo.texto }}
                                                    title={estilo.label}
                                                />
                                            </button>
                                        );
                                    }

                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => setReservaSel(r)}
                                            className="text-left bg-white border border-[#e5e5e5] rounded-lg p-4 hover:border-[#051620] hover:shadow-sm transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span
                                                    className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                                                    style={{ background: estilo.bg, color: estilo.texto }}
                                                >
                                                    {estilo.label}
                                                </span>
                                                {r.vehiculos?.placa && (
                                                    <span className="text-xs text-[#999] font-medium">ID: {r.vehiculos.placa}</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 mb-3">
                                                {foto ? (
                                                    <img src={foto} alt={r.vehiculos.modelo} className="w-12 h-12 object-contain flex-shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-[#f8f8f8] flex-shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-display text-base font-bold text-[#051620] truncate">
                                                        {r.vehiculos ? 'KIA ' + r.vehiculos.modelo : 'Vehiculo'}
                                                    </p>
                                                    <p className="text-xs text-[#666] truncate">
                                                        {r.cliente_nombre} {r.cliente_apellido}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5 text-xs text-[#666] border-t border-[#e5e5e5] pt-3">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                                                    {r.hora_inicio.slice(0, 5)} - {r.hora_fin.slice(0, 5)}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                                                    {r.tipo_entrega === 'domicilio' ? r.direccion_domicilio : (r.sedes ? r.sedes.nombre : '—')}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {diaCalendarioSel && (
                <>
                    <div
                        className={'fixed inset-0 z-50 bg-black/50' + (cerrandoPanelDias ? ' animate-fade-out-backdrop' : '')}
                        onClick={cerrarPanelDias}
                    />
                    <div className={'fixed inset-y-0 right-0 z-[60] w-full sm:w-[420px] bg-white shadow-2xl flex flex-col ' + (cerrandoPanelDias ? 'animate-slide-out-right' : 'animate-slide-in-right')}>
                        <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-center justify-between flex-shrink-0">
                            <p className="font-display text-lg font-bold text-[#051620]">
                                Pruebas del mes
                            </p>
                            <button
                                type="button"
                                onClick={cerrarPanelDias}
                                className="text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto scroll-fino">
                            {diasDelMesConReservas.map(([fecha, reservasDia]) => {
                                const abierto = !!diasExpandidos[fecha];
                                return (
                                    <div key={fecha} className="border-b border-[#e5e5e5]">
                                        <button
                                            type="button"
                                            onClick={() => toggleDiaExpandido(fecha)}
                                            className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left cursor-pointer hover:bg-[#f8f8f8]"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-[#051620] capitalize">
                                                    {formatearFecha(fecha)}
                                                </p>
                                                <p className="text-xs text-[#999]">
                                                    {reservasDia.length} {reservasDia.length === 1 ? 'prueba' : 'pruebas'}
                                                </p>
                                            </div>
                                            <ChevronDown className={'w-4 h-4 text-[#666] flex-shrink-0 transition-transform ' + (abierto ? 'rotate-180' : '')} />
                                        </button>
                                        {abierto && (
                                            <div className="divide-y divide-[#e5e5e5] bg-[#f8f8f8] px-3 py-3">
                                                {reservasDia.map((r: any) => {
                                                    const estilo = ESTILO_ESTADO[r.estado] || ESTILO_ESTADO.confirmada;
                                                    const expandida = reservaExpandidaId === r.id;
                                                    return (
                                                        <div key={r.id}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setReservaExpandidaId(expandida ? null : r.id)}
                                                                className="w-full flex items-center gap-3 px-5 py-3 text-left bg-[#ecf0f1] rounded-md hover:bg-white transition-colors cursor-pointer"
                                                            >
                                                                <div className="w-16 flex-shrink-0 flex items-center gap-1 text-sm font-semibold text-[#051620]">
                                                                    <Clock className="w-3.5 h-3.5 text-[#999]" />
                                                                    {r.hora_inicio.slice(0, 5)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-[#051620] truncate">
                                                                        {r.vehiculos ? 'KIA ' + r.vehiculos.modelo : 'Vehiculo'}
                                                                        {r.vehiculos?.placa && <span className="text-[#999] font-normal text-xs"> · {r.vehiculos.placa}</span>}
                                                                    </p>
                                                                    <p className="text-xs text-[#666] truncate">
                                                                        {r.cliente_nombre} {r.cliente_apellido}
                                                                    </p>
                                                                </div>
                                                                <span
                                                                    className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                                                                    style={{ background: estilo.bg, color: estilo.texto }}
                                                                >
                                                                    {estilo.label}
                                                                </span>
                                                                <ChevronDown className={'w-3.5 h-3.5 text-[#999] flex-shrink-0 transition-transform ' + (expandida ? 'rotate-180' : '')} />
                                                            </button>
                                                            {expandida && (() => {
                                                                const fotoDetalle = r.vehiculos ? obtenerFotoCarro(r.vehiculos.modelo) : undefined;
                                                                const nombreConductor = r.conductores ? r.conductores.nombre.trim().split(' ')[0] : null;
                                                                return (
                                                                    <div className="bg-white p-3 border-t border-[#e5e5e5]">
                                                                        <div className="rounded-2xl overflow-hidden">
                                                                            <div className="relative p-3 pb-0" style={{ background: '#5291F8' }}>
                                                                                <p
                                                                                    className="text-right text-white/25 font-light text-[40px]"
                                                                                    style={{ letterSpacing: '0.35em' }}
                                                                                >
                                                                                    {r.vehiculos ? r.vehiculos.modelo : ''}
                                                                                </p>
                                                                                {fotoDetalle && (
                                                                                    <div className="flex justify-end relative bottom-10">
                                                                                        <img
                                                                                            src={fotoDetalle}
                                                                                            alt={r.vehiculos.modelo}
                                                                                            className="w-2/3 h-28 object-contain mt-1 pointer-events-none select-none"
                                                                                            style={{ transform: 'scaleX(-1)' }}
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                                {nombreConductor && (
                                                                                    <div className="absolute left-5 bottom-10 flex flex-col items-center gap-1.5">
                                                                                        {r.conductores.foto_url ? (
                                                                                            <img
                                                                                                src={r.conductores.foto_url}
                                                                                                alt={nombreConductor}
                                                                                                className="w-14 h-14 rounded-full object-cover border-2 border-white/40"
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40" />
                                                                                        )}
                                                                                        <span className="text-md font-medium text-white">{nombreConductor}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="bg-white rounded-t-2xl -mt-4 relative p-5">
                                                                                <p className="font-display text-lg font-bold text-[#051620] uppercase tracking-wide">
                                                                                    {r.vehiculos ? r.vehiculos.placa : '—'}
                                                                                </p>

                                                                                <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mt-4 mb-1.5">
                                                                                    Detalles de la reserva
                                                                                </p>
                                                                                <div className="flex items-center justify-between gap-4 text-sm text-[#666]">
                                                                                    <span className="flex items-center gap-1.5">
                                                                                        <Clock className="w-4 h-4 text-[#999] flex-shrink-0" />
                                                                                        {r.hora_inicio.slice(0, 5)} - {r.hora_fin.slice(0, 5)}
                                                                                    </span>
                                                                                    <span className="flex items-center gap-1.5">
                                                                                        <MapPin className="w-4 h-4 text-[#999] flex-shrink-0" />
                                                                                        {r.tipo_entrega === 'domicilio' ? r.direccion_domicilio : (r.sedes ? r.sedes.nombre : '—')}
                                                                                    </span>
                                                                                </div>

                                                                                <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mt-6 mb-1.5">
                                                                                    Datos del cliente
                                                                                </p>
                                                                                <div className="flex flex-col gap-1.5 text-sm text-[#666]">
                                                                                    <span className="flex items-center gap-1.5 text-[#051620]">
                                                                                        <User className="w-4 h-4 text-[#999] flex-shrink-0" />
                                                                                        {r.cliente_nombre} {r.cliente_apellido || ''}
                                                                                    </span>
                                                                                    <a href={'tel:' + r.cliente_celular} className="flex items-center gap-1.5 hover:text-[#051620]">
                                                                                        <Phone className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                                                                                        {r.cliente_celular}
                                                                                    </a>
                                                                                    <a href={'mailto:' + r.cliente_correo} className="flex items-center gap-1.5 hover:text-[#051620]">
                                                                                        <Mail className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                                                                                        {r.cliente_correo}
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {reservaSel && (() => {
                const foto = reservaSel.vehiculos ? obtenerFotoCarro(reservaSel.vehiculos.modelo) : undefined;
                return (
                    <div
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
                        onClick={() => setReservaSel(null)}
                    >
                        <div
                            className="bg-white rounded-sm max-w-sm w-full overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 border-b border-[#e5e5e5]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        {foto ? (
                                            <img
                                                key={foto}
                                                src={foto}
                                                alt={reservaSel.vehiculos.modelo}
                                                className="w-14 h-14 object-contain flex-shrink-0 animate-car-entrada"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 rounded-full bg-[#f8f8f8] flex items-center justify-center flex-shrink-0">
                                                <IdCard className="w-5 h-5 text-[#999]" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-display text-base font-bold text-[#051620]">
                                                {reservaSel.vehiculos ? 'KIA ' + reservaSel.vehiculos.modelo : 'Vehiculo'}
                                            </p>
                                            <p className="text-xs text-[#999]">{reservaSel.vehiculos?.placa || '—'}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setReservaSel(null)}
                                        className="text-[#666] hover:text-[#051620] cursor-pointer flex-shrink-0"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 flex flex-col gap-2 text-sm text-[#051620]">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-[#999] flex-shrink-0" />
                                    <span className="capitalize">{formatearFecha(reservaSel.fecha)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-[#999] flex-shrink-0" />
                                    <span>{reservaSel.hora_inicio.slice(0, 5)} - {reservaSel.hora_fin.slice(0, 5)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <IdCard className="w-4 h-4 text-[#999] flex-shrink-0" />
                                    <span>{reservaSel.vehiculos ? reservaSel.vehiculos.placa : '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-[#999] flex-shrink-0" />
                                    <span>{reservaSel.tipo_entrega === 'domicilio' ? reservaSel.direccion_domicilio : (reservaSel.sedes ? reservaSel.sedes.nombre : '—')}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 border-t border-[#e5e5e5] pt-3">
                                    <User className="w-4 h-4 text-[#999] flex-shrink-0" />
                                    <span>{reservaSel.cliente_nombre} {reservaSel.cliente_apellido || ''}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <a href={'tel:' + reservaSel.cliente_celular} className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#051620]">
                                        <Phone className="w-3.5 h-3.5" />
                                        {reservaSel.cliente_celular}
                                    </a>
                                    <a href={'mailto:' + reservaSel.cliente_correo} className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#051620]">
                                        <Mail className="w-3.5 h-3.5" />
                                        {reservaSel.cliente_correo}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
