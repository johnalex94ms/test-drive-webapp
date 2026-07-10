import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/booking-calendar.css';
import { supabase } from '../lib/supabaseClient';
import { asignarConductorDisponible } from '../lib/asignarConductor';

const HORARIOS_BASE = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { locale: es }),
    getDay,
    locales: { es },
});

function calcularHoraFin(hora: string) {
    const partes = hora.split(':');
    const h = parseInt(partes[0], 10) + 1;
    return (h < 10 ? '0' + h : '' + h) + ':00';
}

function esDiaBloqueado(date: Date, diasCompletos: Record<string, boolean>) {
    const diaStr = format(date, 'yyyy-MM-dd');
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const esPasado = date < hoyInicio;
    const esDomingo = date.getDay() === 0;
    return esPasado || esDomingo || !!diasCompletos[diaStr];
}

export default function GestionReservaPage() {
    const { token } = useParams();
    const [vista, setVista] = useState<'resumen' | 'reprogramar' | 'cancelar' | 'exito'>('resumen');
    const [fechaVisible, setFechaVisible] = useState(new Date());
    const [diaSel, setDiaSel] = useState<string | null>(null);
    const [horaSel, setHoraSel] = useState<string | null>(null);
    const [numeroDocEditado, setNumeroDocEditado] = useState('');
    const [licenciaFile, setLicenciaFile] = useState<File | null>(null);
    const [licenciaPreview, setLicenciaPreview] = useState<string | null>(null);
    const [procesando, setProcesando] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const reservaQuery = useQuery({
        queryKey: ['gestion-reserva', token],
        enabled: !!token,
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('*, vehiculos(*), conductores(*), sedes(*)')
                .eq('token_gestion', token)
                .single();
            if (res.error) throw res.error;
            return res.data;
        },
    });

    const reserva: any = reservaQuery.data;

    const inicioMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth(), 1);
    const finMes = new Date(fechaVisible.getFullYear(), fechaVisible.getMonth() + 1, 0);
    const inicioMesStr = format(inicioMes, 'yyyy-MM-dd');
    const finMesStr = format(finMes, 'yyyy-MM-dd');

    const reservasMesQuery = useQuery({
        queryKey: ['gestion-reservas-mes', reserva?.vehiculo_id, inicioMesStr, finMesStr],
        enabled: vista === 'reprogramar' && !!reserva?.vehiculo_id,
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('id, fecha, hora_inicio')
                .eq('vehiculo_id', reserva.vehiculo_id)
                .gte('fecha', inicioMesStr)
                .lte('fecha', finMesStr)
                .in('estado', ['pendiente', 'confirmada', 'en_camino', 'en_prueba']);
            return (res.data || []).filter((r: any) => r.id !== reserva.id);
        },
    });

    const ocupadosPorDia: Record<string, string[]> = {};
    (reservasMesQuery.data || []).forEach((r: any) => {
        if (!ocupadosPorDia[r.fecha]) ocupadosPorDia[r.fecha] = [];
        ocupadosPorDia[r.fecha].push(r.hora_inicio.slice(0, 5));
    });

    const diasCompletos: Record<string, boolean> = {};
    Object.keys(ocupadosPorDia).forEach((dia) => {
        if (ocupadosPorDia[dia].length >= HORARIOS_BASE.length) diasCompletos[dia] = true;
    });

    const disponiblesDia = diaSel
        ? HORARIOS_BASE.filter((h) => !(ocupadosPorDia[diaSel] || []).includes(h))
        : [];

    function dayPropGetter(date: Date) {
        const diaStr = format(date, 'yyyy-MM-dd');
        const hoyInicio = new Date();
        hoyInicio.setHours(0, 0, 0, 0);
        const esPasado = date < hoyInicio;
        const esDomingo = date.getDay() === 0;
        const completo = !!diasCompletos[diaStr];
        const conOcupacion = ocupadosPorDia[diaStr] && ocupadosPorDia[diaStr].length > 0;

        if (diaSel === diaStr) return { className: 'dia-seleccionado' };
        if (esPasado || esDomingo) return { className: 'dia-lleno' };
        if (completo) return { className: 'dia-bloqueado' };
        if (conOcupacion) return { className: 'dia-ocupado-parcial' };
        return { className: 'dia-libre' };
    }

    function DiaPersonalizado(props: any) {
        const date = props.date;
        const diaStr = format(date, 'yyyy-MM-dd');
        const bloqueado = esDiaBloqueado(date, diasCompletos);
        const seleccionado = diaSel === diaStr;

        return (
            <button
                type="button"
                tabIndex={-1}
                style={{
                    width: '100%', height: '100%', minHeight: 26,
                    background: seleccionado ? '#051620' : 'transparent',
                    color: seleccionado ? '#ffffff' : bloqueado ? '#999' : '#051620',
                    fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 4,
                    pointerEvents: 'none',
                }}
            >
                {format(date, 'd')}
            </button>
        );
    }

    function handleLicencia(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setLicenciaFile(file);
        const reader = new FileReader();
        reader.onload = () => setLicenciaPreview(reader.result as string);
        reader.readAsDataURL(file);
    }

    function abrirReprogramar() {
        setNumeroDocEditado(reserva.numero_documento || '');
        setDiaSel(null);
        setHoraSel(null);
        setErrorMsg(null);
        setVista('reprogramar');
    }

    async function confirmarReprogramacion() {
        if (!diaSel || !horaSel) {
            setErrorMsg('Selecciona un dia y un horario.');
            return;
        }

        const documentoCambio = numeroDocEditado.trim() !== (reserva.numero_documento || '').trim();

        if (documentoCambio && !licenciaFile) {
            setErrorMsg('Cambiaste tu numero de documento, debes subir una nueva foto de tu licencia.');
            return;
        }

        setProcesando(true);
        setErrorMsg(null);

        try {
            let licenciaUrl = reserva.licencia_url;

            if (documentoCambio && licenciaFile) {
                const ext = licenciaFile.name.split('.').pop();
                const path = 'licencias/' + Date.now() + '.' + ext;
                const uploadResult = await supabase.storage.from('licencias').upload(path, licenciaFile);
                if (!uploadResult.error) {
                    const publicUrlData = supabase.storage.from('licencias').getPublicUrl(path);
                    licenciaUrl = publicUrlData.data.publicUrl;
                }
            }

            const nuevoConductorId = await asignarConductorDisponible(
                reserva.sede_id,
                diaSel,
                horaSel,
                reserva.id
            );

            const payload: any = {
                fecha: diaSel,
                hora_inicio: horaSel,
                hora_fin: calcularHoraFin(horaSel),
                conductor_id: nuevoConductorId,
            };

            if (documentoCambio) {
                payload.numero_documento = numeroDocEditado.trim();
                payload.licencia_url = licenciaUrl;
                payload.estado = 'pendiente';
                payload.conductor_id = null;
            }

            const res = await supabase.from('reservas').update(payload).eq('id', reserva.id);

            if (res.error) throw res.error;

            window.location.assign('/tracker/' + reserva.id);
        } catch (err: any) {
            if (err && err.code === '23505') {
                setErrorMsg('Ese horario ya fue tomado por otra persona. Elige otro.');
            } else {
                setErrorMsg('Ocurrio un error. Intenta de nuevo.');
            }
        } finally {
            setProcesando(false);
        }
    }

    async function confirmarCancelacion() {
        setProcesando(true);
        await supabase.from('reservas').update({ estado: 'cancelada' }).eq('id', reserva.id);
        setProcesando(false);
        setVista('exito');
    }

    if (reservaQuery.isLoading) {
        return (
            <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center">
                <p className="text-[#666] text-sm">Cargando tu reserva...</p>
            </div>
        );
    }

    if (reservaQuery.isError || !reserva) {
        return (
            <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center px-6">
                <p className="text-[#666] text-sm">No encontramos esta reserva.</p>
            </div>
        );
    }

    const yaFinalizadaOCancelada = ['cancelada', 'finalizada', 'rechazada'].includes(reserva.estado);

    return (
        <div className="min-h-screen bg-[#f8f8f8] px-6 py-10">
            <div className="max-w-lg mx-auto">

                {vista === 'resumen' && (
                    <>
                        <div className="bg-[#051620] text-white rounded-sm p-5 mb-6">
                            <p className="text-xs opacity-60 uppercase tracking-widest mb-1">Tu prueba de ruta</p>
                            <p className="font-display text-2xl font-bold">
                                {reserva.vehiculos ? 'KIA ' + reserva.vehiculos.modelo : 'Tu KIA'}
                            </p>
                            <p className="text-sm opacity-70 mt-1">
                                {reserva.fecha} · {reserva.hora_inicio ? reserva.hora_inicio.slice(0, 5) : ''}
                            </p>
                            <p className="text-xs opacity-50 mt-1 capitalize">Estado: {reserva.estado}</p>
                        </div>

                        {yaFinalizadaOCancelada ? (
                            <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-4">
                                Esta reserva ya no se puede modificar porque su estado es "{reserva.estado}".
                            </p>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={abrirReprogramar}
                                    className="flex-1 bg-[#051620] text-white text-sm font-medium py-3 rounded-sm cursor-pointer hover:bg-[#0a2030]"
                                >
                                    Reprogramar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVista('cancelar')}
                                    className="flex-1 border border-[#e5e5e5] text-[#051620] text-sm font-medium py-3 rounded-sm cursor-pointer hover:border-[#051620]"
                                >
                                    Cancelar prueba
                                </button>
                            </div>
                        )}
                    </>
                )}

                {vista === 'reprogramar' && (
                    <>
                        <button
                            type="button"
                            onClick={() => setVista('resumen')}
                            className="text-sm text-[#666] hover:text-[#051620] cursor-pointer mb-4"
                        >
                            ← Volver
                        </button>

                        <h2 className="font-display text-2xl font-bold text-[#051620] mb-1">
                            Reprograma tu prueba
                        </h2>
                        <p className="text-sm text-[#666] mb-6">
                            Elige un nuevo dia y horario disponible para el {reserva.vehiculos ? 'KIA ' + reserva.vehiculos.modelo : 'vehiculo'}.
                        </p>

                        <div className="bg-white border border-[#e5e5e5] rounded-sm p-3 mb-4">
                            <Calendar
                                localizer={localizer}
                                culture="es"
                                events={[]}
                                startAccessor="start"
                                endAccessor="end"
                                views={['month']}
                                defaultView="month"
                                date={fechaVisible}
                                onNavigate={setFechaVisible}
                                selectable={true}
                                onSelectSlot={(slotInfo: any) => {
                                    if (esDiaBloqueado(slotInfo.start, diasCompletos)) return;
                                    setDiaSel(format(slotInfo.start, 'yyyy-MM-dd'));
                                    setHoraSel(null);
                                }}
                                dayPropGetter={dayPropGetter}
                                components={{ month: { dateHeader: DiaPersonalizado } }}
                                style={{ height: 420 }}
                                messages={{ month: 'Mes', today: 'Hoy', previous: 'Anterior', next: 'Siguiente' }}
                            />
                        </div>

                        {diaSel && (
                            <div className="mb-4">
                                <p className="text-sm font-medium text-[#051620] mb-2">Horarios disponibles</p>
                                {reservasMesQuery.isLoading ? (
                                    <p className="text-sm text-[#666]">Cargando horarios disponibles...</p>
                                ) : (
                                    <div className="flex gap-2 flex-wrap">
                                        {disponiblesDia.map((h) => (
                                            <button
                                                key={h}
                                                type="button"
                                                onClick={() => setHoraSel(h)}
                                                className={
                                                    'px-4 py-2 text-sm font-medium rounded-sm border cursor-pointer ' +
                                                    (horaSel === h
                                                        ? 'bg-[#051620] text-white border-[#051620]'
                                                        : 'bg-white border-[#e5e5e5] text-[#051620] hover:border-[#051620]')
                                                }
                                            >
                                                {h}
                                            </button>
                                        ))}
                                        {disponiblesDia.length === 0 && (
                                            <p className="text-sm text-[#666]">No hay horarios disponibles este dia.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-4">
                            <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">
                                Confirma tu documento
                            </p>
                            <input
                                type="text"
                                value={numeroDocEditado}
                                onChange={(e) => setNumeroDocEditado(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] mb-2"
                            />
                            <p className="text-xs text-[#999]">
                                Si tu numero de documento cambio, deberas subir una nueva foto de tu licencia y tu prueba pasara de nuevo por revision.
                            </p>

                            {numeroDocEditado.trim() !== (reserva.numero_documento || '').trim() && (
                                <div className="mt-3">
                                    <label
                                        htmlFor="nueva-licencia"
                                        className="border border-dashed border-[#e5e5e5] rounded-sm p-4 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#051620] bg-[#f8f8f8]"
                                    >
                                        {licenciaPreview ? (
                                            <img src={licenciaPreview} alt="Licencia" className="h-20 object-contain rounded" />
                                        ) : (
                                            <p className="text-sm text-[#666]">Sube tu nueva licencia de conducir</p>
                                        )}
                                    </label>
                                    <input
                                        id="nueva-licencia"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleLicencia}
                                    />
                                </div>
                            )}
                        </div>

                        {errorMsg && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 mb-4">
                                {errorMsg}
                            </p>
                        )}

                        <button
                            type="button"
                            disabled={procesando}
                            onClick={confirmarReprogramacion}
                            className="w-full bg-[#051620] text-white text-sm font-medium py-3 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                        >
                            {procesando ? 'Guardando...' : 'Confirmar nuevo horario'}
                        </button>
                    </>
                )}

                {vista === 'cancelar' && (
                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Seguro que quieres cancelar tu prueba?
                        </p>
                        <p className="text-sm text-[#666] mb-6">
                            Esta accion no se puede deshacer. Si quieres, puedes agendar otra prueba mas adelante.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setVista('resumen')}
                                className="flex-1 border border-[#e5e5e5] text-[#051620] text-sm font-medium py-3 rounded-sm cursor-pointer hover:border-[#051620]"
                            >
                                No, volver
                            </button>
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={confirmarCancelacion}
                                className="flex-1 bg-red-600 text-white text-sm font-medium py-3 rounded-sm cursor-pointer hover:bg-red-700 disabled:opacity-50"
                            >
                                {procesando ? 'Cancelando...' : 'Si, cancelar'}
                            </button>
                        </div>
                    </div>
                )}

                {vista === 'exito' && (
                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                        <div className="w-14 h-14 bg-[#051620] rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-white text-xl">✓</span>
                        </div>
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">Listo</p>
                        <p className="text-sm text-[#666] mb-5">
                            Tu prueba fue cancelada correctamente.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.assign('/')}
                            className="text-sm text-[#051620] hover:underline cursor-pointer"
                        >
                            Volver al inicio
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}