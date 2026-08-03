import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../styles/booking-calendar.css';
import { X, Car, IdCard, CalendarDays, Clock, User, UserRound } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useBookingStore } from '../../store/bookingStore';
import { ReservaModal } from './ReservaModal';
import { obtenerHorariosDelDia } from '../../lib/horarios';
import { diasBloqueadosPorPlaca, type DiaPicoPlaca } from '../../lib/picoPlaca';
import { obtenerFotoCarro } from '../../lib/vehiculoImagenes';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { locale: es }),
    getDay,
    locales: { es },
});

function esDiaBloqueado(date: Date, diasCompletos: any, diasPicoPlaca: number[] = [], fechasBloqueadas: Record<string, string> = {}) {
    const diaStr = format(date, 'yyyy-MM-dd');
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const esPasado = date < hoyInicio;
    const esDomingo = date.getDay() === 0;
    const esPicoPlaca = diasPicoPlaca.includes(date.getDay());
    const esFechaBloqueada = !!fechasBloqueadas[diaStr];
    const completo = !!diasCompletos[diaStr];
    return esPasado || esDomingo || esPicoPlaca || esFechaBloqueada || completo;
}

function DiaPersonalizado(props: any, onDiaClick: any, diasCompletos: any, diasPicoPlaca: number[], fechasBloqueadas: Record<string, string>) {
    const date = props.date;
    const diaStr = format(date, 'yyyy-MM-dd');
    const bloqueado = esDiaBloqueado(date, diasCompletos, diasPicoPlaca, fechasBloqueadas);
    const motivo = fechasBloqueadas[diaStr];

    return (
        <button
            type="button"
            onClick={() => { if (!bloqueado) onDiaClick(diaStr); }}
            title={motivo || undefined}
            style={{
                width: '100%',
                height: '100%',
                minHeight: 26,
                background: 'transparent',
                color: bloqueado ? '#999' : '#051620',
                border: 'none',
                cursor: bloqueado ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 2,
                padding: '2px 2px 4px',
            }}
        >
            <span style={{ fontSize: 13, fontWeight: 600 }}>
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
        </button>
    );
}

function getDayPropGetter(ocupadosPorDia: any, diasCompletos: any, diasPicoPlaca: number[], fechasBloqueadas: Record<string, string>) {
    return function (date: Date) {
        const diaStr = format(date, 'yyyy-MM-dd');
        const hoyInicio = new Date();
        hoyInicio.setHours(0, 0, 0, 0);
        const esPasado = date < hoyInicio;
        const esDomingo = date.getDay() === 0;
        const esPicoPlaca = diasPicoPlaca.includes(date.getDay());
        const esFechaBloqueada = !!fechasBloqueadas[diaStr];
        const completo = !!diasCompletos[diaStr];
        const conOcupacion = ocupadosPorDia[diaStr] && ocupadosPorDia[diaStr].length > 0;

        if (esPasado || esDomingo || esPicoPlaca || esFechaBloqueada) return { className: 'dia-lleno' };
        if (completo) return { className: 'dia-bloqueado' };
        if (conOcupacion) return { className: 'dia-ocupado-parcial' };
        return { className: 'dia-libre' };
    };
}

export function StepFechaHora() {
    const { vehiculo, vehiculosPool, zona, setPaso } = useBookingStore();
    const [fechaVisible, setFechaVisible] = useState(new Date());
    const [vista, setVista] = useState<View>('month');
    const [diaModal, setDiaModal] = useState<string | null>(null);
    const [eventoDetalle, setEventoDetalle] = useState<any>(null);
    const queryClient = useQueryClient();

    const pool = vehiculosPool.length > 0 ? vehiculosPool : (vehiculo ? [vehiculo] : []);

    // El calendario es unico por sede: la disponibilidad no depende del modelo elegido,
    // sino de TODOS los vehiculos activos de esa sede (cualquier modelo).
    const vehiculosSedeQuery = useQuery({
        queryKey: ['vehiculos-sede-completo', vehiculo ? vehiculo.sede_id : null],
        enabled: !!vehiculo,
        queryFn: async () => {
            const res = await supabase
                .from('vehiculos')
                .select('id, placa, sede_id')
                .eq('sede_id', vehiculo!.sede_id)
                .eq('activo', true);
            return res.data || [];
        },
    });

    const poolSede = vehiculosSedeQuery.data && vehiculosSedeQuery.data.length > 0 ? vehiculosSedeQuery.data : pool;
    const poolSedeIds = poolSede.map((v: any) => v.id);
    const poolSedeIdsKey = poolSedeIds.slice().sort().join(',');

    useEffect(() => {
        if (poolSedeIds.length === 0) return;

        const canal = supabase
            .channel('booking-reservas-' + poolSedeIdsKey)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reservas' },
                (payload: any) => {
                    const idAfectado = (payload.new && payload.new.vehiculo_id) || (payload.old && payload.old.vehiculo_id);
                    if (idAfectado && !poolSedeIds.includes(idAfectado)) return;
                    queryClient.invalidateQueries({ queryKey: ['reservas-mes'] });
                    queryClient.invalidateQueries({ queryKey: ['ocupados-dia'] });
                    queryClient.invalidateQueries({ queryKey: ['conductor-disponible'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, [poolSedeIdsKey, queryClient]);

    const inicioMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth(), 1);
    const finMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth() + 1, 0);
    const inicioMesStr = format(inicioMes, 'yyyy-MM-dd');
    const finMesStr = format(finMes, 'yyyy-MM-dd');

    const reservasQuery = useQuery({
        queryKey: ['reservas-mes', poolSedeIdsKey, inicioMesStr, finMesStr],
        enabled: poolSedeIds.length > 0,
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('fecha, hora_inicio, hora_fin, vehiculo_id, cliente_nombre, cliente_apellido, vehiculos(modelo, placa), asesores(nombre)')
                .in('vehiculo_id', poolSedeIds)
                .gte('fecha', inicioMesStr)
                .lte('fecha', finMesStr)
                .in('estado', ['confirmada', 'en_camino', 'en_prueba']);
            return res.data || [];
        },
    });

    const picoPlacaConfigQuery = useQuery({
        queryKey: ['pico-placa-config'],
        queryFn: async () => {
            const res = await supabase.from('pico_placa_config').select('*').order('dia_semana');
            return (res.data || []) as DiaPicoPlaca[];
        },
    });

    const diasBloqueadosQuery = useQuery({
        queryKey: ['dias-bloqueados', inicioMesStr, finMesStr],
        queryFn: async () => {
            const res = await supabase
                .from('dias_bloqueados')
                .select('*')
                .gte('fecha', inicioMesStr)
                .lte('fecha', finMesStr);
            return res.data || [];
        },
    });

    const reservas = reservasQuery.data || [];
    const picoPlacaConfig = picoPlacaConfigQuery.data || [];

    // Un dia solo queda bloqueado por pico y placa si TODAS las unidades de la sede estan restringidas ese dia
    const diasPicoPlaca = poolSede.reduce((dias: number[] | null, v: any) => {
        const propios = diasBloqueadosPorPlaca(v.placa, picoPlacaConfig);
        if (dias === null) return propios;
        return dias.filter((d) => propios.includes(d));
    }, null as number[] | null) || [];

    const fechasBloqueadas: Record<string, string> = {};
    (diasBloqueadosQuery.data || []).forEach((d: any) => {
        fechasBloqueadas[d.fecha] = d.motivo;
    });

    function unidadesDisponiblesEseDia(diaStr: string) {
        const diaSemana = new Date(diaStr + 'T00:00:00').getDay();
        return poolSede.filter((v: any) => !diasBloqueadosPorPlaca(v.placa, picoPlacaConfig).includes(diaSemana)).length;
    }

    const ocupadosPorDia: Record<string, string[]> = {};
    const conteoPorDiaHora: Record<string, Record<string, number>> = {};
    reservas.forEach((r: any) => {
        const hora = r.hora_inicio.slice(0, 5);
        if (!ocupadosPorDia[r.fecha]) ocupadosPorDia[r.fecha] = [];
        ocupadosPorDia[r.fecha].push(hora);
        if (!conteoPorDiaHora[r.fecha]) conteoPorDiaHora[r.fecha] = {};
        conteoPorDiaHora[r.fecha][hora] = (conteoPorDiaHora[r.fecha][hora] || 0) + 1;
    });

    const diasCompletos: Record<string, boolean> = {};
    Object.keys(conteoPorDiaHora).forEach((dia) => {
        const horariosEseDia = obtenerHorariosDelDia(dia);
        const unidadesDisponibles = unidadesDisponiblesEseDia(dia);
        if (horariosEseDia.length > 0 && unidadesDisponibles > 0) {
            const todasLlenas = horariosEseDia.every((h) => (conteoPorDiaHora[dia][h] || 0) >= unidadesDisponibles);
            if (todasLlenas) diasCompletos[dia] = true;
        }
    });

    const eventos = reservas.map((r: any) => {
        const inicio = new Date(r.fecha + 'T' + r.hora_inicio);
        const fin = new Date(r.fecha + 'T' + r.hora_fin);
        const placa = r.vehiculos ? r.vehiculos.placa : '';
        return {
            title: (placa || 'Ocupado') + ' · ' + r.hora_inicio.slice(0, 5),
            start: inicio,
            end: fin,
            resource: r,
        };
    });

    function onDiaClick(diaStr: string) {
        setDiaModal(diaStr);
    }

    function handleSelectSlot(slotInfo: any) {
        if (esDiaBloqueado(slotInfo.start, diasCompletos, diasPicoPlaca, fechasBloqueadas)) return;
        onDiaClick(format(slotInfo.start, 'yyyy-MM-dd'));
    }

    if (!vehiculo || !zona) {
        return (
            <div className="text-center py-10">
                <p className="text-[#666]">Selecciona primero un vehiculo y una ubicacion.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-6">
                <h2 className="font-display text-3xl font-bold text-[#051620]">
                    Elige fecha y hora
                </h2>
                <p className="text-[#666666] mt-2">
                    Verde: disponible. Rojo claro: con algunos horarios ocupados. Rojo fuerte: sin cupo. Gris: no disponible.
                </p>
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-6">
                <Calendar
                    localizer={localizer}
                    culture="es"
                    events={eventos}
                    startAccessor="start"
                    endAccessor="end"
                    views={['month', 'week', 'day', 'agenda']}
                    view={vista}
                    onView={setVista}
                    date={fechaVisible}
                    onNavigate={setFechaVisible}
                    selectable={true}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={(event: any) => setEventoDetalle(event.resource)}
                    formats={{
                        monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }),
                        dayHeaderFormat: (date: Date) => format(date, "EEEE d 'de' MMMM", { locale: es }),
                        weekdayFormat: (date: Date) => format(date, 'EEE', { locale: es }),
                    }}
                    dayPropGetter={getDayPropGetter(ocupadosPorDia, diasCompletos, diasPicoPlaca, fechasBloqueadas)}
                    components={{
                        month: {
                            dateHeader: (props: any) => DiaPersonalizado(props, onDiaClick, diasCompletos, diasPicoPlaca, fechasBloqueadas),
                        },
                    }}
                    style={{ height: 600 }}
                    messages={{
                        month: 'Mes', week: 'Semana', day: 'Dia', agenda: 'Agenda',
                        today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
                        noEventsInRange: 'Sin pruebas agendadas.',
                    }}
                />
            </div>

            <div className="flex items-center gap-4 text-xs text-[#666] mb-6 flex-wrap">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: '#eaf6ec' }} /> Disponible
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: '#fdecec' }} /> Parcialmente ocupado
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: '#f8caca' }} /> Sin cupo
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ background: '#fafafa' }} /> No disponible
                </span>
            </div>

            <button
                type="button"
                onClick={() => setPaso(2)}
                className="text-sm text-[#666] hover:text-[#051620] transition-colors cursor-pointer"
            >
                Cambiar ubicacion
            </button>

            {diaModal && (
                <>
                    <div
                        className="fixed inset-0 z-50 bg-black/50"
                        onClick={() => setDiaModal(null)}
                    />
                    <div className="fixed inset-y-0 right-0 z-[60] w-full sm:w-[440px] xl:w-[480px] bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
                        <ReservaModal
                            variant="panel"
                            vehiculo={vehiculo}
                            vehiculosPool={pool}
                            vehiculosSede={poolSede}
                            zona={zona}
                            fecha={diaModal}
                            onClose={() => setDiaModal(null)}
                            onSuccess={(id: string) => window.location.assign('/tracker/' + id)}
                        />
                    </div>
                </>
            )}

            {eventoDetalle && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setEventoDetalle(null)}
                >
                    <div
                        className="bg-white rounded-sm max-w-sm w-full overflow-hidden relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-center justify-between relative z-10">
                            <p className="font-display text-lg font-bold text-[#051620]">
                                Prueba de ruta agendada
                            </p>
                            <button
                                type="button"
                                onClick={() => setEventoDetalle(null)}
                                className="text-[#666] hover:text-[#051620] cursor-pointer flex-shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className={'p-5 flex flex-col gap-2 text-sm text-[#051620] relative min-h-[190px] ' + (eventoDetalle.vehiculos && obtenerFotoCarro(eventoDetalle.vehiculos.modelo) ? 'pr-32' : '')}>
                            {eventoDetalle.vehiculos && obtenerFotoCarro(eventoDetalle.vehiculos.modelo) && (
                                <img
                                    src={obtenerFotoCarro(eventoDetalle.vehiculos.modelo)}
                                    alt={eventoDetalle.vehiculos.modelo}
                                    className="absolute right-3 bottom-8 w-46 h-auto object-contain pointer-events-none select-none"
                                />
                            )}
                            <div className="flex items-center gap-2">
                                <Car className="w-4 h-4 text-[#999] flex-shrink-0" />
                                <span>{eventoDetalle.vehiculos ? 'KIA ' + eventoDetalle.vehiculos.modelo : '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <IdCard className="w-4 h-4 text-[#999] flex-shrink-0" />
                                <span>{eventoDetalle.vehiculos ? eventoDetalle.vehiculos.placa : '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-[#999] flex-shrink-0" />
                                <span>{eventoDetalle.fecha}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#999] flex-shrink-0" />
                                <span>{eventoDetalle.hora_inicio.slice(0, 5)} - {eventoDetalle.hora_fin.slice(0, 5)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-[#999] flex-shrink-0" />
                                <span>{eventoDetalle.cliente_nombre} {eventoDetalle.cliente_apellido || ''}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <UserRound className="w-4 h-4 text-[#999] flex-shrink-0" />
                                <span>{eventoDetalle.asesores ? eventoDetalle.asesores.nombre : '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}