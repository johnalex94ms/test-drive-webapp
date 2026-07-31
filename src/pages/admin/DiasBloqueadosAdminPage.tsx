import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../../styles/booking-calendar.css';
import { Trash2, Ban } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Input } from '../../components/ui/Input';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { locale: es }),
    getDay,
    locales: { es },
});

function hoyISO() {
    return new Date().toISOString().slice(0, 10);
}

function DiaPersonalizado(props: any, diasBloqueados: Record<string, string>, onDiaClick: (dia: string) => void) {
    const date = props.date;
    const diaStr = format(date, 'yyyy-MM-dd');
    const bloqueado = !!diasBloqueados[diaStr];

    return (
        <button
            type="button"
            onClick={() => onDiaClick(diaStr)}
            title={bloqueado ? diasBloqueados[diaStr] : 'Click para bloquear este dia'}
            style={{
                width: '100%',
                height: '100%',
                minHeight: 26,
                background: 'transparent',
                color: bloqueado ? '#b91c1c' : '#051620',
                fontSize: 13,
                fontWeight: bloqueado ? 700 : 600,
                border: 'none',
                cursor: 'pointer',
            }}
        >
            {format(date, 'd')}
        </button>
    );
}

function getDayPropGetter(diasBloqueados: Record<string, string>) {
    return function (date: Date) {
        const diaStr = format(date, 'yyyy-MM-dd');
        if (diasBloqueados[diaStr]) return { className: 'dia-bloqueado dia-clickeable' };
        return { className: 'dia-admin-libre dia-clickeable' };
    };
}

export default function DiasBloqueadosAdminPage() {
    const [fechaVisible, setFechaVisible] = useState(new Date());
    const [vista, setVista] = useState<View>('month');
    const [nuevaFecha, setNuevaFecha] = useState(hoyISO());
    const [nuevoMotivo, setNuevoMotivo] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [fechaAEliminar, setFechaAEliminar] = useState<any>(null);
    const queryClient = useQueryClient();

    const diasQuery = useQuery({
        queryKey: ['admin-dias-bloqueados'],
        queryFn: async () => {
            const res = await supabase.from('dias_bloqueados').select('*').order('fecha');
            return res.data || [];
        },
    });

    const dias = diasQuery.data || [];
    const diasBloqueados: Record<string, string> = {};
    dias.forEach((d: any) => {
        diasBloqueados[d.fecha] = d.motivo;
    });

    async function agregarDia(fecha: string, motivoInicial: string) {
        if (!fecha) return;
        if (diasBloqueados[fecha]) {
            setFechaAEliminar({ fecha, motivo: diasBloqueados[fecha] });
            return;
        }

        setGuardando(true);
        setErrorMsg(null);
        try {
            const res = await supabase.from('dias_bloqueados').insert({ fecha, motivo: motivoInicial || 'Dia no laboral' });
            if (res.error) throw res.error;
            queryClient.invalidateQueries({ queryKey: ['admin-dias-bloqueados'] });
            setNuevaFecha(hoyISO());
            setNuevoMotivo('');
        } catch {
            setErrorMsg('Ocurrio un error al guardar la fecha.');
        } finally {
            setGuardando(false);
        }
    }

    async function eliminarDia() {
        if (!fechaAEliminar) return;
        setGuardando(true);
        try {
            const res = await supabase.from('dias_bloqueados').delete().eq('fecha', fechaAEliminar.fecha);
            if (res.error) throw res.error;
            queryClient.invalidateQueries({ queryKey: ['admin-dias-bloqueados'] });
            setFechaAEliminar(null);
        } catch {
            setErrorMsg('Ocurrio un error al eliminar la fecha.');
        } finally {
            setGuardando(false);
        }
    }

    function onDiaClickCalendario(diaStr: string) {
        if (diasBloqueados[diaStr]) {
            setFechaAEliminar({ fecha: diaStr, motivo: diasBloqueados[diaStr] });
        } else {
            agregarDia(diaStr, 'Festivo');
        }
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">Dias bloqueados</h1>
                <p className="text-sm text-[#666]">
                    Festivos y fechas especiales sin test drive. Estos dias quedan bloqueados para todos los vehiculos en el agendamiento, igual que los domingos.
                </p>
            </div>

            <div className="grid lg:grid-cols-[1fr_360px] gap-6">
                <div className="bg-white border border-[#e5e5e5] rounded-sm p-4">
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
                        onSelectSlot={(slotInfo: any) => onDiaClickCalendario(format(slotInfo.start, 'yyyy-MM-dd'))}
                        formats={{
                            monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: es }),
                            weekdayFormat: (date: Date) => format(date, 'EEE', { locale: es }),
                        }}
                        dayPropGetter={getDayPropGetter(diasBloqueados)}
                        components={{
                            month: {
                                dateHeader: (props: any) => DiaPersonalizado(props, diasBloqueados, onDiaClickCalendario),
                            },
                        }}
                        style={{ height: 560 }}
                        messages={{
                            month: 'Mes', today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
                        }}
                    />
                    <p className="text-xs text-[#999] mt-3">
                        Click en un dia libre para bloquearlo. Click en un dia bloqueado (rojo) para desbloquearlo.
                    </p>
                </div>

                <div>
                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-4">
                        <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
                            Agregar fecha
                        </p>
                        <div className="flex flex-col gap-3">
                            <Input
                                type="date"
                                value={nuevaFecha}
                                onChange={(e) => setNuevaFecha(e.target.value)}
                            />
                            <Input
                                type="text"
                                placeholder="Motivo (ej. Navidad)"
                                value={nuevoMotivo}
                                onChange={(e) => setNuevoMotivo(e.target.value)}
                                maxLength={60}
                            />
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={() => agregarDia(nuevaFecha, nuevoMotivo)}
                                className="bg-[#051620] text-white text-sm font-medium px-4 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                            >
                                {guardando ? 'Guardando...' : 'Bloquear fecha'}
                            </button>
                        </div>
                        {errorMsg && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-3 py-2 mt-3">
                                {errorMsg}
                            </p>
                        )}
                    </div>

                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-4">
                        <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
                            Fechas bloqueadas ({dias.length})
                        </p>
                        {diasQuery.isLoading ? (
                            <p className="text-sm text-[#666]">Cargando...</p>
                        ) : dias.length === 0 ? (
                            <p className="text-sm text-[#666]">No hay fechas bloqueadas todavia.</p>
                        ) : (
                            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-3 pb-4">
                                {dias.map((d: any) => (
                                    <div key={d.fecha} className="flex items-center justify-between gap-3 border border-[#e5e5e5] rounded-sm px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-[#051620]">{d.fecha}</p>
                                            <p className="text-xs text-[#666] truncate">{d.motivo}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFechaAEliminar(d)}
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
            </div>

            {/* Modal eliminar */}
            {fechaAEliminar && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <div className="flex items-center gap-2.5 mb-2">
                            <Ban className="w-5 h-5 text-red-600" />
                            <p className="font-display text-lg font-bold text-[#051620]">
                                Desbloquear {fechaAEliminar.fecha}?
                            </p>
                        </div>
                        <p className="text-sm text-[#666] mb-6">
                            Motivo actual: {fechaAEliminar.motivo}. Ese dia volvera a estar disponible para agendar.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setFechaAEliminar(null)}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={eliminarDia}
                                className="bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-red-700 disabled:opacity-50"
                            >
                                {guardando ? 'Quitando...' : 'Si, desbloquear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
