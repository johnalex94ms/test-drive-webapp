import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

function fotoConductor(nombre: string) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    const indice = Math.abs(hash % 70) + 1;
    return 'https://i.pravatar.cc/200?img=' + indice;
}

function formatearFecha(fecha: string) {
    const partes = fecha.split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mes = meses[parseInt(partes[1], 10) - 1];
    return parseInt(partes[2], 10) + ' de ' + mes + ' de ' + partes[0];
}

export default function TrackerPage() {
    const { id } = useParams();
    const queryClient = useQueryClient();

    const reservaQuery = useQuery({
        queryKey: ['tracker-reserva', id],
        enabled: !!id,
        refetchInterval: 30000,
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('*, vehiculos(*), conductores(*), sedes(*)')
                .eq('id', id)
                .single();
            if (res.error) throw res.error;
            return res.data;
        },
    });

    useEffect(() => {
        if (!id) return;
        const canal = supabase
            .channel('tracker-' + id)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'reservas', filter: 'id=eq.' + id },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['tracker-reserva', id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, [id, queryClient]);

    const reserva: any = reservaQuery.data;

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
                <div className="text-center">
                    <p className="font-display text-2xl font-bold text-[#051620] mb-2">
                        No encontramos esta reserva
                    </p>
                    <p className="text-[#666] text-sm">Verifica el enlace o contacta a Distrikia.</p>
                </div>
            </div>
        );
    }

    const esDomicilio = reserva.tipo_entrega === 'domicilio';
    const cancelada = reserva.estado === 'cancelada';
    const rechazada = reserva.estado === 'rechazada';
    const pendiente = reserva.estado === 'pendiente';
    const conductor = reserva.conductores;
    const vehiculo = reserva.vehiculos;
    const sede = reserva.sedes;

    const pasosBase = esDomicilio
        ? ['revision', 'confirmada', 'en_camino', 'en_prueba', 'finalizada']
        : ['revision', 'confirmada', 'en_prueba', 'finalizada'];

    function estaCompletado(paso: string) {
        if (paso === 'revision') return reserva.estado !== 'pendiente';
        if (paso === 'confirmada') return ['confirmada', 'en_camino', 'en_prueba', 'finalizada'].includes(reserva.estado);
        if (paso === 'en_camino') return ['en_prueba', 'finalizada'].includes(reserva.estado);
        if (paso === 'en_prueba') return reserva.estado === 'finalizada';
        if (paso === 'finalizada') return reserva.estado === 'finalizada';
        return false;
    }

    function estaActivo(paso: string) {
        if (paso === 'revision') return reserva.estado === 'pendiente';
        if (paso === 'confirmada') return reserva.estado === 'confirmada';
        if (paso === 'en_camino') return reserva.estado === 'en_camino';
        if (paso === 'en_prueba') return reserva.estado === 'en_prueba';
        return false;
    }

    const ETIQUETAS: Record<string, { titulo: string; sub: string }> = {
        revision: { titulo: 'En revision', sub: 'Estamos validando tus datos' },
        confirmada: { titulo: 'Reserva confirmada', sub: conductor ? 'Con ' + conductor.nombre : 'Te asignaremos un experto' },
        en_camino: { titulo: 'En camino a tu ubicacion', sub: 'El KIA va hacia ti' },
        en_prueba: { titulo: 'Prueba de ruta', sub: 'Disfruta tu experiencia' },
        finalizada: { titulo: 'Finalizado', sub: 'Gracias por probar un KIA' },
    };

    function llamarConductor() {
        if (conductor && conductor.correo) {
            window.location.assign('mailto:' + conductor.correo);
        }
    }

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <div className="max-w-lg mx-auto px-6 py-10">

                <div className={'rounded-sm p-5 mb-6 text-white ' + (cancelada || rechazada ? 'bg-[#8a1f1f]' : 'bg-[#051620]')}>
                    <p className="text-xs opacity-60 uppercase tracking-widest mb-1">
                        {rechazada ? 'Solicitud no aprobada' : cancelada ? 'Reserva cancelada' : 'Estado de tu prueba de ruta'}
                    </p>
                    <p className="font-display text-2xl font-bold">
                        {vehiculo ? 'KIA ' + vehiculo.modelo : 'Tu KIA'}
                    </p>
                    <p className="text-sm opacity-70 mt-1">
                        {formatearFecha(reserva.fecha)} · {reserva.hora_inicio ? reserva.hora_inicio.slice(0, 5) : ''}
                    </p>
                    {sede && <p className="text-xs opacity-50 mt-1">{sede.nombre}</p>}
                </div>

                {rechazada && (
                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-5 mb-6">
                        <p className="text-sm font-semibold text-[#051620] mb-1">
                            No pudimos aprobar tu solicitud
                        </p>
                        <p className="text-sm text-[#666]">
                            {reserva.motivo_rechazo || 'Contactanos para mas informacion.'}
                        </p>
                    </div>
                )}

                {pendiente && (
                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-6">
                        <p className="text-sm text-[#666]">
                            Estamos revisando tus datos y tu licencia de conducir. Esto puede tardar unos minutos, te avisaremos por correo.
                        </p>
                    </div>
                )}

                {!cancelada && !rechazada && (
                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-5 mb-6">
                        {pasosBase.map((paso, i) => {
                            const completado = estaCompletado(paso);
                            const activo = estaActivo(paso);
                            const esUltimo = i === pasosBase.length - 1;
                            return (
                                <div key={paso} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className="relative w-6 h-6 flex-shrink-0">
                                            {activo && (
                                                <span className="absolute inset-0 rounded-full bg-[#051620] opacity-75 animate-ping" />
                                            )}
                                            <div
                                                className={
                                                    'relative w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ' +
                                                    (completado
                                                        ? 'bg-[#051620] text-white'
                                                        : activo
                                                            ? 'bg-[#051620] text-white'
                                                            : 'bg-[#e5e5e5] text-[#999]')
                                                }
                                            >
                                                {completado ? '✓' : i + 1}
                                            </div>
                                        </div>
                                        {!esUltimo && (
                                            <div className={'w-0.5 flex-1 my-1 ' + (completado ? 'bg-[#051620]' : 'bg-[#e5e5e5]')} style={{ minHeight: 28 }} />
                                        )}
                                    </div>
                                    <div className={esUltimo ? '' : 'pb-5'}>
                                        <p className={'text-sm font-semibold ' + (completado || activo ? 'text-[#051620]' : 'text-[#999]')}>
                                            {ETIQUETAS[paso].titulo}
                                        </p>
                                        <p className="text-xs text-[#666] mt-0.5">{ETIQUETAS[paso].sub}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {conductor && !cancelada && !rechazada && !pendiente && (
                    <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 flex items-center gap-3 mb-6">
                        <img
                            src={fotoConductor(conductor.nombre)}
                            alt={conductor.nombre}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[#051620]">{conductor.nombre}</p>
                            <p className="text-xs text-[#666]">{conductor.cargo}</p>
                        </div>
                        <button
                            type="button"
                            onClick={llamarConductor}
                            className="w-9 h-9 rounded-full bg-[#051620] flex items-center justify-center cursor-pointer flex-shrink-0"
                        >
                            <Phone className="w-4 h-4 text-white" />
                        </button>
                    </div>
                )}

                {reserva.token_gestion && !cancelada && !rechazada && (
                    <button
                        type="button"
                        onClick={() => window.location.assign('/reserva/' + reserva.token_gestion)}
                        className="w-full text-center text-sm text-[#666] hover:text-[#051620] transition-colors cursor-pointer py-2"
                    >
                        Reprogramar o cancelar mi prueba
                    </button>
                )}

                <p className="text-center text-xs text-[#aaa] mt-4">
                    Esta pagina se actualiza en tiempo real.
                </p>

            </div>
        </div>
    );
}