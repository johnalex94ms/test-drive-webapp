import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../styles/booking-calendar.css';
import { Trash2, Ban, Car, Search, RotateCcw, MapPin, CalendarClock, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Input } from '../../components/ui/Input';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { locale: es }),
    getDay,
    locales: { es },
});

interface Bloqueo {
    id: string;
    vehiculo_id: string;
    fecha_inicio: string;
    fecha_fin: string;
    motivo: string;
}

function diaEnRango(diaStr: string, bloqueos: Bloqueo[]): Bloqueo | null {
    return bloqueos.find((b) => diaStr >= b.fecha_inicio && diaStr <= b.fecha_fin) || null;
}

function DiaPersonalizado(
    props: any,
    bloqueosVehiculo: Bloqueo[],
    diasBloqueadosGlobal: Record<string, string>,
    onDiaClick: (dia: string, bloqueo: Bloqueo | null) => void
) {
    const date = props.date;
    const diaStr = format(date, 'yyyy-MM-dd');
    const bloqueo = diaEnRango(diaStr, bloqueosVehiculo);
    const motivoGlobal = diasBloqueadosGlobal[diaStr];
    const bloqueado = !!bloqueo;
    const soloGlobal = !bloqueado && !!motivoGlobal;

    return (
        <button
            type="button"
            onClick={() => { if (!soloGlobal) onDiaClick(diaStr, bloqueo); }}
            title={bloqueado ? bloqueo!.motivo : soloGlobal ? motivoGlobal + ' (festivo / fecha especial, se gestiona en Dias bloqueados)' : 'Click o arrastra para bloquear'}
            style={{
                width: '100%',
                height: '100%',
                minHeight: 26,
                background: 'transparent',
                color: bloqueado ? '#b91c1c' : soloGlobal ? '#999' : '#051620',
                border: 'none',
                cursor: soloGlobal ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 2,
                padding: '2px 2px 4px',
            }}
        >
            <span style={{ fontSize: 13, fontWeight: bloqueado || soloGlobal ? 700 : 600 }}>
                {format(date, 'd')}
            </span>
            {(bloqueado || soloGlobal) && (
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 500,
                        lineHeight: 1.15,
                        color: bloqueado ? '#b91c1c' : '#999',
                        opacity: 0.85,
                        maxWidth: '100%',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        padding: '0 2px',
                        textAlign: 'center',
                    }}
                >
                    {bloqueado ? bloqueo!.motivo : motivoGlobal}
                </span>
            )}
        </button>
    );
}

function getDayPropGetter(bloqueosVehiculo: Bloqueo[], diasBloqueadosGlobal: Record<string, string>) {
    return function (date: Date) {
        const diaStr = format(date, 'yyyy-MM-dd');
        if (diaEnRango(diaStr, bloqueosVehiculo)) return { className: 'dia-bloqueado dia-clickeable' };
        if (diasBloqueadosGlobal[diaStr]) return { className: 'dia-lleno' };
        return { className: 'dia-admin-libre dia-clickeable' };
    };
}

export default function VehiculosBloqueadosAdminPage() {
    const [vehiculoId, setVehiculoId] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [sedeFiltro, setSedeFiltro] = useState('todas');
    const [ciudadFiltro, setCiudadFiltro] = useState('todas');
    const [fechaVisible, setFechaVisible] = useState(new Date());
    const [vista, setVista] = useState<View>('month');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [bloqueoAEliminar, setBloqueoAEliminar] = useState<Bloqueo | null>(null);
    const [rangoABloquear, setRangoABloquear] = useState<{ inicio: string; fin: string } | null>(null);
    const [motivoBloqueo, setMotivoBloqueo] = useState('');
    const [intentoBloquear, setIntentoBloquear] = useState(false);
    const [panelAbierto, setPanelAbierto] = useState(false);
    const [cerrandoPanel, setCerrandoPanel] = useState(false);
    const queryClient = useQueryClient();

    function abrirPanel() {
        setPanelAbierto(true);
    }

    function cerrarPanel() {
        setCerrandoPanel(true);
        setTimeout(() => {
            setPanelAbierto(false);
            setCerrandoPanel(false);
        }, 260);
    }

    useEffect(() => {
        if (!panelAbierto) return;
        const overflowPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = overflowPrevio;
        };
    }, [panelAbierto]);

    const sedesQuery = useQuery({
        queryKey: ['admin-sedes-lista-bloqueos'],
        queryFn: async () => {
            const res = await supabase.from('sedes').select('id, nombre, ciudad').order('nombre');
            return res.data || [];
        },
    });

    const vehiculosQuery = useQuery({
        queryKey: ['admin-vehiculos-lista-bloqueos'],
        queryFn: async () => {
            const res = await supabase.from('vehiculos').select('id, modelo, placa, activo, sede_id, sedes(nombre, ciudad)').eq('activo', true).order('modelo');
            return res.data || [];
        },
    });

    const sedes = sedesQuery.data || [];
    const vehiculosBase = vehiculosQuery.data || [];
    const ciudades = Array.from(new Set(sedes.map((s: any) => s.ciudad).filter(Boolean)));

    const vehiculos = vehiculosBase.filter((v: any) => {
        const coincideTexto = busqueda.trim() === '' ||
            v.modelo.toLowerCase().includes(busqueda.toLowerCase()) ||
            v.placa.toLowerCase().includes(busqueda.toLowerCase());
        const coincideSede = sedeFiltro === 'todas' || v.sede_id === sedeFiltro;
        const coincideCiudad = ciudadFiltro === 'todas' || (v.sedes && v.sedes.ciudad === ciudadFiltro);
        return coincideTexto && coincideSede && coincideCiudad;
    });

    const bloqueosQuery = useQuery({
        queryKey: ['admin-vehiculos-bloqueos', vehiculoId],
        enabled: !!vehiculoId,
        queryFn: async () => {
            const res = await supabase
                .from('vehiculos_bloqueos')
                .select('*')
                .eq('vehiculo_id', vehiculoId)
                .order('fecha_inicio');
            return (res.data || []) as Bloqueo[];
        },
    });

    const diasBloqueadosQuery = useQuery({
        queryKey: ['admin-dias-bloqueados'],
        queryFn: async () => {
            const res = await supabase.from('dias_bloqueados').select('*').order('fecha');
            return res.data || [];
        },
    });

    const bloqueos = bloqueosQuery.data || [];
    const diasBloqueadosGlobal: Record<string, string> = {};
    (diasBloqueadosQuery.data || []).forEach((d: any) => {
        diasBloqueadosGlobal[d.fecha] = d.motivo;
    });
    const vehiculoSeleccionado = vehiculosBase.find((v: any) => v.id === vehiculoId);

    async function agregarBloqueo(inicio: string, fin: string, motivo: string) {
        if (!vehiculoId || !motivo.trim()) return;

        setGuardando(true);
        setErrorMsg(null);
        try {
            const res = await supabase.from('vehiculos_bloqueos').insert({
                vehiculo_id: vehiculoId,
                fecha_inicio: inicio,
                fecha_fin: fin,
                motivo: motivo.trim(),
            });
            if (res.error) throw res.error;
            queryClient.invalidateQueries({ queryKey: ['admin-vehiculos-bloqueos', vehiculoId] });
            setRangoABloquear(null);
            setMotivoBloqueo('');
            setIntentoBloquear(false);
        } catch {
            setErrorMsg('Ocurrio un error al guardar el bloqueo.');
        } finally {
            setGuardando(false);
        }
    }

    async function eliminarBloqueo() {
        if (!bloqueoAEliminar) return;
        setGuardando(true);
        try {
            const res = await supabase.from('vehiculos_bloqueos').delete().eq('id', bloqueoAEliminar.id);
            if (res.error) throw res.error;
            queryClient.invalidateQueries({ queryKey: ['admin-vehiculos-bloqueos', vehiculoId] });
            setBloqueoAEliminar(null);
        } catch {
            setErrorMsg('Ocurrio un error al eliminar el bloqueo.');
        } finally {
            setGuardando(false);
        }
    }

    function onDiaClick(diaStr: string, bloqueo: Bloqueo | null) {
        if (!vehiculoId) return;
        if (bloqueo) {
            setBloqueoAEliminar(bloqueo);
            return;
        }
        if (diasBloqueadosGlobal[diaStr]) {
            setErrorMsg('Ese dia ya esta bloqueado como festivo/fecha especial. Se gestiona desde "Dias bloqueados".');
            return;
        }
        setErrorMsg(null);
        setIntentoBloquear(false);
        setMotivoBloqueo('');
        setRangoABloquear({ inicio: diaStr, fin: diaStr });
    }

    function onSeleccionCalendario(slotInfo: any) {
        if (!vehiculoId) {
            setErrorMsg('Selecciona primero un vehiculo.');
            return;
        }
        const fechas = Array.from(new Set<string>(
            (slotInfo.slots && slotInfo.slots.length > 0 ? slotInfo.slots : [slotInfo.start]).map((d: Date) => format(d, 'yyyy-MM-dd'))
        )).sort();

        if (fechas.length <= 1) {
            onDiaClick(fechas[0], diaEnRango(fechas[0], bloqueos));
            return;
        }

        const fechasSeleccionables = fechas.filter((f) => !diasBloqueadosGlobal[f]);
        if (fechasSeleccionables.length === 0) {
            setErrorMsg('Todas las fechas seleccionadas ya son festivos/fechas especiales.');
            return;
        }

        setErrorMsg(null);
        setIntentoBloquear(false);
        setMotivoBloqueo('');
        setRangoABloquear({ inicio: fechasSeleccionables[0], fin: fechasSeleccionables[fechasSeleccionables.length - 1] });
    }

    function confirmarBloqueo() {
        setIntentoBloquear(true);
        if (!rangoABloquear || !motivoBloqueo.trim()) return;
        agregarBloqueo(rangoABloquear.inicio, rangoABloquear.fin, motivoBloqueo);
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">Vehiculos bloqueados</h1>
                <p className="text-sm text-[#666]">
                    Bloquea un vehiculo especifico por eventos, prestamos a otra sede, mantenimiento o venta en proceso. Ese vehiculo no se ofrecera para test drive en esas fechas.
                </p>
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-6 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-[#666] block mb-1">Buscar vehiculo</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Modelo o placa..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] focus:ring-2 focus:ring-[#051620]/20"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs text-[#666] block mb-1">Ciudad</label>
                    <select
                        value={ciudadFiltro}
                        onChange={(e) => setCiudadFiltro(e.target.value)}
                        className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                        style={{
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                            backgroundPosition: 'right 10px center',
                        }}
                    >
                        <option value="todas">Todas las ciudades</option>
                        {ciudades.map((c: any) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

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
                        {sedes
                            .filter((s: any) => ciudadFiltro === 'todas' || s.ciudad === ciudadFiltro)
                            .map((s: any) => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                    </select>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setBusqueda('');
                        setSedeFiltro('todas');
                        setCiudadFiltro('todas');
                    }}
                    title="Restablecer filtros"
                    className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] cursor-pointer"
                >
                    <RotateCcw className="w-4 h-4 text-[#666]" />
                </button>

                <p className="text-xs text-[#999] whitespace-nowrap pb-2">
                    {vehiculos.length} de {vehiculosBase.length}
                </p>
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-sm p-3 mb-6">
                {vehiculosQuery.isLoading ? (
                    <p className="text-sm text-[#666] px-1 py-1">Cargando vehiculos...</p>
                ) : vehiculos.length === 0 ? (
                    <p className="text-sm text-[#666] px-1 py-1">No hay vehiculos que coincidan con los filtros.</p>
                ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {vehiculos.map((v: any) => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => setVehiculoId(v.id)}
                                className={
                                    'flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border cursor-pointer transition-colors ' +
                                    (v.id === vehiculoId
                                        ? 'bg-[#051620] text-white border-[#051620]'
                                        : 'bg-white text-[#051620] border-[#e5e5e5] hover:border-[#051620]')
                                }
                            >
                                <Car className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>KIA {v.modelo} - {v.placa}</span>
                                <span className={'inline-flex items-center gap-1 ' + (v.id === vehiculoId ? 'text-white/60' : 'text-[#999]')}>
                                    <MapPin className="w-3 h-3" />
                                    {v.sedes ? v.sedes.nombre : 'sin sede'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {!vehiculoId ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    Selecciona un vehiculo para ver y gestionar sus fechas bloqueadas.
                </p>
            ) : (
                <div className="bg-white border border-[#e5e5e5] rounded-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#051620]">
                            <Car className="w-4 h-4" />
                            {vehiculoSeleccionado ? 'KIA ' + vehiculoSeleccionado.modelo + ' - ' + vehiculoSeleccionado.placa : ''}
                        </div>
                        <button
                            type="button"
                            onClick={abrirPanel}
                            className="inline-flex items-center gap-2 bg-[#051620] text-white text-sm font-medium px-4 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] flex-shrink-0"
                        >
                            <CalendarClock className="w-4 h-4" />
                            Bloqueos de este vehiculo ({bloqueos.length})
                        </button>
                    </div>
                    <Calendar
                        localizer={localizer}
                        culture="es"
                        events={[]}
                        startAccessor="start"
                        endAccessor="end"
                        views={['month']}
                        view={vista}
                        onView={setVista}
                        date={fechaVisible}
                        onNavigate={setFechaVisible}
                        selectable={true}
                        longPressThreshold={150}
                        onSelectSlot={onSeleccionCalendario}
                        formats={{
                            monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }),
                            weekdayFormat: (date: Date) => format(date, 'EEE', { locale: es }),
                        }}
                        dayPropGetter={getDayPropGetter(bloqueos, diasBloqueadosGlobal)}
                        components={{
                            month: {
                                dateHeader: (props: any) => DiaPersonalizado(props, bloqueos, diasBloqueadosGlobal, onDiaClick),
                            },
                        }}
                        style={{ height: 'calc(100vh - 220px)' }}
                        messages={{
                            month: 'Mes', today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
                        }}
                    />
                    <p className="text-xs text-[#999] mt-3">
                        Click en un dia libre para bloquearlo, o arrastra el mouse sobre varios dias para bloquear un rango. Click en un dia bloqueado (rojo) para desbloquearlo. Los dias grises son festivos o fechas especiales (se gestionan en "Dias bloqueados").
                    </p>
                </div>
            )}

            {/* Panel lateral: bloqueos de este vehiculo */}
            {panelAbierto && (
                <>
                    <div
                        className={'fixed inset-0 z-50 bg-black/50' + (cerrandoPanel ? ' animate-fade-out-backdrop' : '')}
                        onClick={cerrarPanel}
                    />
                    <div className={'fixed inset-y-0 right-0 z-[60] w-full sm:w-[420px] bg-white shadow-2xl overflow-y-auto scroll-fino ' + (cerrandoPanel ? 'animate-slide-out-right' : 'animate-slide-in-right')}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e5]">
                            <p className="font-display text-lg font-bold text-[#051620]">
                                Bloqueos {vehiculoSeleccionado ? '- KIA ' + vehiculoSeleccionado.modelo : ''}
                            </p>
                            <button
                                type="button"
                                onClick={cerrarPanel}
                                className="text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
                                Bloqueos de este vehiculo ({bloqueos.length})
                            </p>
                            {bloqueosQuery.isLoading ? (
                                <p className="text-sm text-[#666]">Cargando...</p>
                            ) : bloqueos.length === 0 ? (
                                <p className="text-sm text-[#666]">Este vehiculo no tiene bloqueos.</p>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {bloqueos.map((b) => (
                                        <div key={b.id} className="flex items-center justify-between gap-3 border border-[#e5e5e5] rounded-sm px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[#051620]">
                                                    {b.fecha_inicio === b.fecha_fin ? b.fecha_inicio : b.fecha_inicio + ' - ' + b.fecha_fin}
                                                </p>
                                                <p className="text-xs text-[#666] truncate">{b.motivo}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setBloqueoAEliminar(b)}
                                                title="Eliminar"
                                                className="text-red-600 hover:text-red-700 cursor-pointer flex-shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Modal eliminar */}
            {bloqueoAEliminar && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <div className="flex items-center gap-2.5 mb-2">
                            <Ban className="w-5 h-5 text-red-600" />
                            <p className="font-display text-lg font-bold text-[#051620]">
                                Quitar bloqueo?
                            </p>
                        </div>
                        <p className="text-sm text-[#666] mb-6">
                            {bloqueoAEliminar.fecha_inicio === bloqueoAEliminar.fecha_fin
                                ? bloqueoAEliminar.fecha_inicio
                                : bloqueoAEliminar.fecha_inicio + ' - ' + bloqueoAEliminar.fecha_fin}
                            {' '}· Motivo: {bloqueoAEliminar.motivo}. El vehiculo volvera a estar disponible en esas fechas.
                        </p>
                        {errorMsg && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-3 py-2 mb-4">
                                {errorMsg}
                            </p>
                        )}
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setBloqueoAEliminar(null); setErrorMsg(null); }}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={eliminarBloqueo}
                                className="bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-red-700 disabled:opacity-50"
                            >
                                {guardando ? 'Quitando...' : 'Si, quitar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal bloquear */}
            {rangoABloquear && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <div className="flex items-center gap-2.5 mb-2">
                            <Ban className="w-5 h-5 text-[#051620]" />
                            <p className="font-display text-lg font-bold text-[#051620]">
                                {rangoABloquear.inicio === rangoABloquear.fin
                                    ? 'Bloquear ' + rangoABloquear.inicio + '?'
                                    : 'Bloquear del ' + rangoABloquear.inicio + ' al ' + rangoABloquear.fin + '?'}
                            </p>
                        </div>
                        <p className="text-sm text-[#666] mb-3">
                            Este vehiculo no se ofrecera para test drive en esas fechas.
                        </p>
                        <div className="mb-2">
                            <Input
                                type="text"
                                placeholder="Motivo (ej. Mantenimiento, evento, prestamo a sede)"
                                value={motivoBloqueo}
                                onChange={(e) => setMotivoBloqueo(e.target.value)}
                                maxLength={60}
                                autoFocus
                            />
                            {intentoBloquear && !motivoBloqueo.trim() && (
                                <p className="text-xs text-red-600 mt-1">El motivo es obligatorio.</p>
                            )}
                        </div>
                        {errorMsg && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-3 py-2 mb-2">
                                {errorMsg}
                            </p>
                        )}
                        <div className="flex items-center justify-end gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setRangoABloquear(null);
                                    setMotivoBloqueo('');
                                    setIntentoBloquear(false);
                                    setErrorMsg(null);
                                }}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={confirmarBloqueo}
                                className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                            >
                                {guardando ? 'Guardando...' : 'Si, bloquear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
