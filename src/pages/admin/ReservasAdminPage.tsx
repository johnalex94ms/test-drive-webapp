import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { Copy, ExternalLink, X } from 'lucide-react';

const SITE_URL = 'http://localhost:5173';

const TABS = [
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
    const [tab, setTab] = useState('confirmada');
    const [seleccionada, setSeleccionada] = useState<any>(null);
    const [accion, setAccion] = useState<'cancelar' | null>(null);
    const [procesando, setProcesando] = useState(false);
    const [licenciaAmpliada, setLicenciaAmpliada] = useState(false);
    const [motivoCancelacion, setMotivoCancelacion] = useState('');
    const [cambiandoConductor, setCambiandoConductor] = useState(false);
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
                .select('*, vehiculos(*), conductores(*), sedes(*), asesores(nombre, foto_url)')
                .eq('estado', tab)
                .order('fecha', { ascending: true });
            return res.data || [];
        },
    });

    const reservas = reservasQuery.data || [];

    const conductoresQuery = useQuery({
        queryKey: ['admin-conductores-sede', seleccionada?.sede_id, seleccionada?.fecha, seleccionada?.hora_inicio],
        enabled: !!seleccionada?.sede_id,
        queryFn: async () => {
            const resSede = await supabase
                .from('conductores_sedes')
                .select('conductor_id, conductores(*)')
                .eq('sede_id', seleccionada.sede_id);

            const candidatos = (resSede.data || [])
                .map((cs: any) => cs.conductores)
                .filter((c: any) => c && c.activo);

            const resOcupados = await supabase
                .from('reservas')
                .select('conductor_id')
                .eq('fecha', seleccionada.fecha)
                .eq('hora_inicio', seleccionada.hora_inicio)
                .neq('id', seleccionada.id)
                .in('estado', ['pendiente', 'confirmada', 'en_camino', 'en_prueba']);

            const ocupadosIds = new Set((resOcupados.data || []).map((r: any) => r.conductor_id));

            return candidatos.map((c: any) => ({
                ...c,
                ocupado: ocupadosIds.has(c.id) && c.id !== seleccionada.conductor_id,
            }));
        },
    });

    async function actualizarEstado(id: string, nuevoEstado: string, motivo?: string) {
        setProcesando(true);
        const payload: any = { estado: nuevoEstado };
        if (motivo !== undefined) payload.motivo_rechazo = motivo;
        await supabase.from('reservas').update(payload).eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['admin-reservas'] });
        setProcesando(false);
        setSeleccionada(null);
        setAccion(null);
    }

    function abrirCancelar() {
        setMotivoCancelacion('');
        setAccion('cancelar');
    }

    function confirmarCancelacion() {
        actualizarEstado(seleccionada.id, 'cancelada', motivoCancelacion);
    }

    function avanzar(reserva: any) {
        const paso = siguienteEstado(reserva);
        if (!paso) return;
        actualizarEstado(reserva.id, paso.nuevo);
    }

    async function cambiarConductor(conductorId: string) {
        setProcesando(true);
        await supabase.from('reservas').update({ conductor_id: conductorId || null }).eq('id', seleccionada.id);
        queryClient.invalidateQueries({ queryKey: ['admin-reservas'] });
        setSeleccionada((s: any) => ({ ...s, conductor_id: conductorId || null }));
        setProcesando(false);
        setCambiandoConductor(false);
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

    function copiarLink(texto: string) {
        navigator.clipboard.writeText(texto);
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">Reservas</h1>
                <p className="text-sm text-[#666]">Da seguimiento a las pruebas de ruta.</p>
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
                                className="text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                <X className="w-5 h-5" />
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

                                <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">Enlaces del cliente</p>
                                <div className="flex flex-col gap-2 mb-4">
                                    <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-sm px-3 py-2">
                                        <span className="text-xs text-[#666] flex-1 truncate">/tracker/{seleccionada.id}</span>
                                        <button
                                            type="button"
                                            onClick={() => copiarLink(SITE_URL + '/tracker/' + seleccionada.id)}
                                            className="text-[#051620] hover:text-[#0a2030] cursor-pointer"
                                            title="Copiar link del tracker"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => window.open(SITE_URL + '/tracker/' + seleccionada.id, '_blank')}
                                            className="text-[#051620] hover:text-[#0a2030] cursor-pointer"
                                            title="Abrir tracker"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    {seleccionada.token_gestion && (
                                        <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-sm px-3 py-2">
                                            <span className="text-xs text-[#666] flex-1 truncate">/reserva/{seleccionada.token_gestion}</span>
                                            <button
                                                type="button"
                                                onClick={() => copiarLink(SITE_URL + '/reserva/' + seleccionada.token_gestion)}
                                                className="text-[#051620] hover:text-[#0a2030] cursor-pointer"
                                                title="Copiar link de gestion"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => window.open(SITE_URL + '/reserva/' + seleccionada.token_gestion, '_blank')}
                                                className="text-[#051620] hover:text-[#0a2030] cursor-pointer"
                                                title="Abrir gestion de reserva"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">Prueba</p>
                                <div className="text-sm text-[#051620] flex flex-col gap-1 mb-4">
                                    <p><strong>Fecha:</strong> {seleccionada.fecha} {seleccionada.hora_inicio?.slice(0, 5)}</p>
                                    <p><strong>Sede:</strong> {seleccionada.sedes ? seleccionada.sedes.nombre : '-'}</p>
                                    <p><strong>Entrega:</strong> {seleccionada.tipo_entrega}</p>
                                    {seleccionada.direccion_domicilio && (
                                        <p><strong>Direccion:</strong> {seleccionada.direccion_domicilio}</p>
                                    )}
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <p><strong>Conductor:</strong> {seleccionada.conductores ? seleccionada.conductores.nombre : (seleccionada.conducido_por_asesor ? 'La hace el asesor: ' + (seleccionada.asesores ? seleccionada.asesores.nombre : 'Sin dato') : 'Sin asignar')}</p>
                                            {['confirmada', 'en_camino', 'en_prueba'].includes(seleccionada.estado) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setCambiandoConductor(true)}
                                                    className="text-xs font-medium text-[#051620] hover:underline cursor-pointer"
                                                >
                                                    Cambiar
                                                </button>
                                            )}
                                        </div>
                                        {cambiandoConductor && (
                                            <select
                                                value={seleccionada.conductor_id || ''}
                                                onChange={(e) => cambiarConductor(e.target.value)}
                                                disabled={procesando}
                                                className="w-full mt-2 pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                                                style={{
                                                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                                                    backgroundPosition: 'right 10px center',
                                                }}
                                            >
                                                <option value="">Sin asignar</option>
                                                {(conductoresQuery.data || []).map((c: any) => (
                                                    <option key={c.id} value={c.id} disabled={c.ocupado}>
                                                        {c.nombre}{c.ocupado ? ' (ocupado a esta hora)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
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
                            {['confirmada', 'en_camino', 'en_prueba'].includes(seleccionada.estado) && (
                                <button
                                    type="button"
                                    onClick={abrirCancelar}
                                    className="text-sm text-red-600 hover:underline cursor-pointer"
                                >
                                    Cancelar reserva
                                </button>
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

            {/* Modal de confirmacion — Cancelar */}
            {seleccionada && accion === 'cancelar' && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Cancelar esta reserva?
                        </p>
                        <p className="text-sm text-[#666] mb-3">
                            {seleccionada.cliente_nombre} recibira un correo confirmando la cancelacion.
                        </p>
                        <textarea
                            value={motivoCancelacion}
                            onChange={(e) => setMotivoCancelacion(e.target.value)}
                            placeholder="Motivo (opcional, se incluye en el correo al cliente)"
                            rows={3}
                            className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] placeholder:text-[#aaa] focus:border-[#051620] resize-none mb-4"
                        />
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setAccion(null)}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Volver
                            </button>
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={confirmarCancelacion}
                                className="bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-red-700 disabled:opacity-50"
                            >
                                {procesando ? 'Cancelando...' : 'Si, cancelar'}
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
                        className="absolute top-6 right-6 text-white cursor-pointer"
                    >
                        <X className="w-6 h-6" />
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