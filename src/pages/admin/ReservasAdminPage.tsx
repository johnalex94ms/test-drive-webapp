import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

const TABS = [
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'confirmada', label: 'Confirmadas' },
    { key: 'en_camino', label: 'En camino' },
    { key: 'en_prueba', label: 'En prueba' },
    { key: 'finalizada', label: 'Finalizadas' },
    { key: 'rechazada', label: 'Rechazadas' },
    { key: 'cancelada', label: 'Canceladas' },
];

function siguienteEstado(reserva: any) {
    if (reserva.estado === 'confirmada' && reserva.tipo_entrega === 'domicilio') {
        return { label: 'Marcar en camino', nuevo: 'en_camino' };
    }
    if (reserva.estado === 'confirmada' && reserva.tipo_entrega === 'concesionario') {
        return { label: 'Iniciar prueba', nuevo: 'en_prueba' };
    }
    if (reserva.estado === 'en_camino') {
        return { label: 'Iniciar prueba', nuevo: 'en_prueba' };
    }
    if (reserva.estado === 'en_prueba') {
        return { label: 'Finalizar prueba', nuevo: 'finalizada' };
    }
    return null;
}

export default function ReservasAdminPage() {
    const [tab, setTab] = useState('pendiente');
    const [seleccionada, setSeleccionada] = useState<any>(null);
    const [accion, setAccion] = useState<'aprobar' | 'rechazar' | null>(null);
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [licenciaAmpliada, setLicenciaAmpliada] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        const canal = supabase
            .channel('admin-reservas-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reservas' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['admin-reservas'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, [queryClient]);

    const reservasQuery = useQuery({
        queryKey: ['admin-reservas', tab],
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('*, vehiculos(*), conductores(*), sedes(*)')
                .eq('estado', tab)
                .order('fecha', { ascending: true });
            return res.data || [];
        },
    });

    const reservas = reservasQuery.data || [];

    async function actualizarEstado(id: string, nuevoEstado: string, motivo?: string) {
        setProcesando(true);
        const payload: any = { estado: nuevoEstado };
        if (motivo !== undefined) payload.motivo_rechazo = motivo;
        await supabase.from('reservas').update(payload).eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['admin-reservas'] });
        setProcesando(false);
        setSeleccionada(null);
        setAccion(null);
        setMotivoRechazo('');
    }

    function avanzar(reserva: any) {
        const paso = siguienteEstado(reserva);
        if (!paso) return;
        actualizarEstado(reserva.id, paso.nuevo);
    }

    async function descargarLicencia(url: string, nombreCliente: string) {
        try {
            const respuesta = await fetch(url);
            const blob = await respuesta.blob();
            const urlBlob = URL.createObjectURL(blob);
            const enlace = document.createElement('a');
            enlace.setAttribute('href', urlBlob);
            enlace.setAttribute('download', 'licencia-' + nombreCliente.replace(/\s+/g, '-') + '.jpg');
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
            URL.revokeObjectURL(urlBlob);
        } catch {
            window.open(url, '_blank');
        }
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">Reservas</h1>
                <p className="text-sm text-[#666]">Revisa, aprueba y da seguimiento a las pruebas de ruta.</p>
            </div>

            <div className="flex gap-2 flex-wrap mb-6">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={
                            'px-4 py-1.5 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                            (tab === t.key
                                ? 'bg-[#051620] text-white'
                                : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                        }
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {reservasQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : reservas.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay reservas en este estado.
                </p>
            ) : (
                <div className="bg-white border border-[#e5e5e5] rounded-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-[#f8f8f8] text-left text-xs text-[#666] uppercase tracking-wide">
                            <tr>
                                <th className="px-4 py-3">Cliente</th>
                                <th className="px-4 py-3">Vehiculo</th>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Sede</th>
                                <th className="px-4 py-3">Entrega</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {reservas.map((r: any) => (
                                <tr
                                    key={r.id}
                                    className="border-t border-[#e5e5e5] hover:bg-[#f8f8f8] cursor-pointer"
                                    onClick={() => setSeleccionada(r)}
                                >
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-[#051620]">{r.cliente_nombre} {r.cliente_apellido}</p>
                                        <p className="text-xs text-[#666]">{r.cliente_correo}</p>
                                    </td>
                                    <td className="px-4 py-3 text-[#051620]">
                                        {r.vehiculos ? r.vehiculos.modelo : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-[#051620]">
                                        {r.fecha} {r.hora_inicio ? r.hora_inicio.slice(0, 5) : ''}
                                    </td>
                                    <td className="px-4 py-3 text-[#666]">
                                        {r.sedes ? r.sedes.nombre : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-[#666] capitalize">
                                        {r.tipo_entrega}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-[#051620] font-medium">
                                        Ver detalle →
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de detalle */}
            {seleccionada && !accion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-5 border-b border-[#e5e5e5] flex items-center justify-between">
                            <div>
                                <p className="text-xs text-[#666]">{seleccionada.vehiculos ? 'KIA ' + seleccionada.vehiculos.modelo : ''}</p>
                                <p className="font-display text-xl font-bold text-[#051620]">
                                    {seleccionada.cliente_nombre} {seleccionada.cliente_apellido}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSeleccionada(null)}
                                className="text-[#666] hover:text-[#051620] text-xl cursor-pointer"
                            >
                                X
                            </button>
                        </div>

                        <div className="p-6 grid md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">Datos del cliente</p>
                                <div className="text-sm text-[#051620] flex flex-col gap-1 mb-4">
                                    <p><strong>Documento:</strong> {seleccionada.tipo_documento} {seleccionada.numero_documento}</p>
                                    <p><strong>Correo:</strong> {seleccionada.cliente_correo}</p>
                                    <p><strong>Celular:</strong> {seleccionada.cliente_celular}</p>
                                    <p><strong>Ciudad:</strong> {seleccionada.ciudad}</p>
                                </div>

                                <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">Prueba</p>
                                <div className="text-sm text-[#051620] flex flex-col gap-1 mb-4">
                                    <p><strong>Fecha:</strong> {seleccionada.fecha} {seleccionada.hora_inicio?.slice(0, 5)}</p>
                                    <p><strong>Sede:</strong> {seleccionada.sedes ? seleccionada.sedes.nombre : '-'}</p>
                                    <p><strong>Entrega:</strong> {seleccionada.tipo_entrega}</p>
                                    {seleccionada.direccion_domicilio && (
                                        <p><strong>Direccion:</strong> {seleccionada.direccion_domicilio}</p>
                                    )}
                                    <p><strong>Conductor:</strong> {seleccionada.conductores ? seleccionada.conductores.nombre : 'Sin asignar'}</p>
                                </div>

                                {seleccionada.comentario && (
                                    <>
                                        <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">Comentario</p>
                                        <p className="text-sm text-[#666] mb-4">{seleccionada.comentario}</p>
                                    </>
                                )}
                            </div>

                            <div>
                                <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">Licencia de conducir</p>
                                {seleccionada.licencia_url ? (
                                    <>
                                        <img
                                            src={seleccionada.licencia_url}
                                            alt="Licencia"
                                            onClick={() => setLicenciaAmpliada(true)}
                                            className="w-full rounded-sm border border-[#e5e5e5] cursor-pointer hover:opacity-90 transition-opacity"
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                type="button"
                                                onClick={() => setLicenciaAmpliada(true)}
                                                className="flex-1 text-xs font-medium text-[#051620] border border-[#e5e5e5] rounded-sm py-2 cursor-pointer hover:border-[#051620]"
                                            >
                                                Ver en grande
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => descargarLicencia(seleccionada.licencia_url, seleccionada.cliente_nombre || 'cliente')}
                                                className="flex-1 text-xs font-medium text-white bg-[#051620] rounded-sm py-2 cursor-pointer hover:bg-[#0a2030]"
                                            >
                                                Descargar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-[#666] bg-[#f8f8f8] rounded-sm p-4">
                                        El cliente no adjunto licencia.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-5 border-t border-[#e5e5e5] flex items-center justify-between gap-3">
                            {seleccionada.estado === 'pendiente' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setAccion('rechazar')}
                                        className="text-sm text-red-600 hover:underline cursor-pointer"
                                    >
                                        Rechazar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAccion('aprobar')}
                                        className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030]"
                                    >
                                        Aprobar reserva
                                    </button>
                                </>
                            )}

                            {siguienteEstado(seleccionada) && (
                                <button
                                    type="button"
                                    onClick={() => avanzar(seleccionada)}
                                    className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] ml-auto"
                                >
                                    {siguienteEstado(seleccionada)?.label}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmacion — Aprobar */}
            {seleccionada && accion === 'aprobar' && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Aprobar esta reserva?
                        </p>
                        <p className="text-sm text-[#666] mb-6">
                            {seleccionada.cliente_nombre} vera en su seguimiento que la prueba fue confirmada.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setAccion(null)}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={() => actualizarEstado(seleccionada.id, 'confirmada')}
                                className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                            >
                                {procesando ? 'Aprobando...' : 'Si, aprobar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmacion — Rechazar */}
            {seleccionada && accion === 'rechazar' && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Rechazar esta reserva?
                        </p>
                        <p className="text-sm text-[#666] mb-3">
                            El cliente vera este motivo en su correo, es obligatorio explicarle por que.
                        </p>
                        <textarea
                            value={motivoRechazo}
                            onChange={(e) => setMotivoRechazo(e.target.value)}
                            placeholder="Ej: la licencia no es legible, por favor sube una nueva foto."
                            rows={3}
                            className={
                                'w-full px-3 py-2.5 text-sm border rounded-sm outline-none text-[#051620] placeholder:text-[#aaa] resize-none mb-1 ' +
                                (motivoRechazo.trim() === '' ? 'border-[#e5e5e5] focus:border-[#051620]' : 'border-[#051620]')
                            }
                        />
                        {motivoRechazo.trim() === '' && (
                            <p className="text-xs text-red-600 mb-4">Debes explicar el motivo antes de rechazar.</p>
                        )}
                        {motivoRechazo.trim() !== '' && <div className="mb-4" />}
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setAccion(null)}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={procesando || motivoRechazo.trim() === ''}
                                onClick={() => actualizarEstado(seleccionada.id, 'rechazada', motivoRechazo)}
                                className="bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-red-700 disabled:opacity-50"
                            >
                                {procesando ? 'Rechazando...' : 'Si, rechazar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox de licencia */}
            {licenciaAmpliada && seleccionada && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-6"
                    onClick={() => setLicenciaAmpliada(false)}
                >
                    <img
                        src={seleccionada.licencia_url}
                        alt="Licencia ampliada"
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-full max-h-[85vh] rounded-sm object-contain"
                    />
                    <button
                        type="button"
                        onClick={() => setLicenciaAmpliada(false)}
                        className="absolute top-6 right-6 text-white text-2xl cursor-pointer"
                    >
                        X
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            descargarLicencia(seleccionada.licencia_url, seleccionada.cliente_nombre || 'cliente');
                        }}
                        className="absolute bottom-6 bg-white text-[#051620] text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-white/90"
                    >
                        Descargar imagen
                    </button>
                </div>
            )}
        </div>
    );
}