import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../styles/booking-calendar.css';
import { supabase } from '../../lib/supabaseClient';
import { useBookingStore } from '../../store/bookingStore';
import { ReservaModal } from './ReservaModal';
import { obtenerHorariosDelDia } from '../../lib/horarios';
import { diasBloqueadosPorPlaca, type DiaPicoPlaca } from '../../lib/picoPlaca';

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

    return (
        <button
            type="button"
            disabled={bloqueado}
            onClick={() => onDiaClick(diaStr)}
            title={fechasBloqueadas[diaStr] || undefined}
            style={{
                width: '100%',
                height: '100%',
                minHeight: 26,
                background: 'transparent',
                color: bloqueado ? '#999' : '#051620',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: bloqueado ? 'not-allowed' : 'pointer',
            }}
        >
            {format(date, 'd')}
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
    const { vehiculo, zona, setPaso } = useBookingStore();
    const [fechaVisible, setFechaVisible] = useState(new Date());
    const [vista, setVista] = useState<View>('month');
    const [diaModal, setDiaModal] = useState<string | null>(null);

    const inicioMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth(), 1);
    const finMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth() + 1, 0);
    const inicioMesStr = format(inicioMes, 'yyyy-MM-dd');
    const finMesStr = format(finMes, 'yyyy-MM-dd');

    const reservasQuery = useQuery({
        queryKey: ['reservas-mes', vehiculo ? vehiculo.id : null, inicioMesStr, finMesStr],
        enabled: !!vehiculo,
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('fecha, hora_inicio, hora_fin')
                .eq('vehiculo_id', vehiculo!.id)
                .gte('fecha', inicioMesStr)
                .lte('fecha', finMesStr)
                .in('estado', ['pendiente', 'confirmada', 'en_camino', 'en_prueba']);
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
    const diasPicoPlaca = vehiculo ? diasBloqueadosPorPlaca(vehiculo.placa, picoPlacaConfigQuery.data || []) : [];
    const fechasBloqueadas: Record<string, string> = {};
    (diasBloqueadosQuery.data || []).forEach((d: any) => {
        fechasBloqueadas[d.fecha] = d.motivo;
    });

    const ocupadosPorDia: Record<string, string[]> = {};
    reservas.forEach((r: any) => {
        if (!ocupadosPorDia[r.fecha]) ocupadosPorDia[r.fecha] = [];
        ocupadosPorDia[r.fecha].push(r.hora_inicio.slice(0, 5));
    });

    const diasCompletos: Record<string, boolean> = {};
    Object.keys(ocupadosPorDia).forEach((dia) => {
        const horariosEseDia = obtenerHorariosDelDia(dia);
        if (horariosEseDia.length > 0 && ocupadosPorDia[dia].length >= horariosEseDia.length) {
            diasCompletos[dia] = true;
        }
    });

    const eventos = reservas.map((r: any) => {
        const inicio = new Date(r.fecha + 'T' + r.hora_inicio);
        const fin = new Date(r.fecha + 'T' + r.hora_fin);
        return { title: 'Ocupado ' + r.hora_inicio.slice(0, 5), start: inicio, end: fin };
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
                <ReservaModal
                    vehiculo={vehiculo}
                    zona={zona}
                    fecha={diaModal}
                    onClose={() => setDiaModal(null)}
                    onSuccess={(id: string) => window.location.assign('/tracker/' + id)}
                />
            )}
        </div>
    );
}