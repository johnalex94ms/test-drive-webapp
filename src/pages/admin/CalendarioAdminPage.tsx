import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import { ChevronLeft, ChevronRight, RotateCcw, FileSpreadsheet, ShipWheel, UserRound, Ban } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SelectorFecha } from '../../components/ui/SelectorFecha';
import { obtenerHorariosDelDia } from '../../lib/horarios';

const ESTILO_ESTADO: Record<string, { bg: string; texto: string; label: string }> = {
    pendiente: { bg: '#fdf3d9', texto: '#8a6d00', label: 'Pendiente' },
    confirmada: { bg: '#dcf3e4', texto: '#0a6e3a', label: 'Confirmada' },
    en_camino: { bg: '#dbe9fb', texto: '#0a4a8a', label: 'En camino' },
    en_prueba: { bg: '#dbe9fb', texto: '#0a4a8a', label: 'En prueba' },
    finalizada: { bg: '#f0f0f0', texto: '#666666', label: 'Finalizada' },
    rechazada: { bg: '#fbdcdc', texto: '#8a1f1f', label: 'Rechazada' },
    cancelada: { bg: '#f0f0f0', texto: '#999999', label: 'Cancelada' },
};

function hoyISO() {
    return new Date().toISOString().slice(0, 10);
}

function sumarDias(fechaISO: string, dias: number) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    fecha.setDate(fecha.getDate() + dias);
    const yy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
}

function formatearFechaBonita(fechaISO: string) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

function iniciales(nombre: string) {
    if (!nombre) return '?';
    const partes = nombre.trim().split(' ');
    const a = partes[0] ? partes[0][0] : '';
    const b = partes[1] ? partes[1][0] : '';
    return (a + b).toUpperCase();
}

export default function CalendarioAdminPage() {
    const [fecha, setFecha] = useState(hoyISO());
    const [sedeFiltro, setSedeFiltro] = useState('todas');
    const [vehiculoFiltro, setVehiculoFiltro] = useState('todos');
    const [conductorFiltro, setConductorFiltro] = useState('todos');
    const [reservaSel, setReservaSel] = useState<any>(null);
    const queryClient = useQueryClient();

    const sedesQuery = useQuery({
        queryKey: ['admin-sedes-lista'],
        queryFn: async () => {
            const res = await supabase.from('sedes').select('*').order('nombre');
            return res.data || [];
        },
    });

    const conductoresQuery = useQuery({
        queryKey: ['admin-conductores-lista'],
        queryFn: async () => {
            const res = await supabase.from('conductores').select('*').eq('activo', true).order('nombre');
            return res.data || [];
        },
    });

    const vehiculosQuery = useQuery({
        queryKey: ['admin-vehiculos-calendario', sedeFiltro],
        queryFn: async () => {
            let query = supabase.from('vehiculos').select('*, sedes(nombre)').eq('activo', true).order('modelo');
            if (sedeFiltro !== 'todas') query = query.eq('sede_id', sedeFiltro);
            const res = await query;
            return res.data || [];
        },
    });

    const reservasDiaQuery = useQuery({
        queryKey: ['admin-calendario-reservas', fecha],
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('*, conductores(nombre, foto_url), asesores(nombre, foto_url)')
                .eq('fecha', fecha);
            return res.data || [];
        },
    });

    const vehiculosBloqueadosQuery = useQuery({
        queryKey: ['admin-calendario-vehiculos-bloqueados', fecha],
        queryFn: async () => {
            const res = await supabase
                .from('vehiculos_bloqueos')
                .select('*')
                .lte('fecha_inicio', fecha)
                .gte('fecha_fin', fecha);
            return res.data || [];
        },
    });

    useEffect(() => {
        const canal = supabase
            .channel('admin-calendario-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reservas' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['admin-calendario-reservas'] });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'vehiculos_bloqueos' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['admin-calendario-vehiculos-bloqueados'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, [queryClient]);

    const sedes = sedesQuery.data || [];
    const conductores = conductoresQuery.data || [];
    const reservasDia = reservasDiaQuery.data || [];

    const bloqueosPorVehiculo: Record<string, { motivo: string; fecha_inicio: string; fecha_fin: string }> = {};
    (vehiculosBloqueadosQuery.data || []).forEach((b: any) => {
        bloqueosPorVehiculo[b.vehiculo_id] = b;
    });

    const vehiculosBase = vehiculosQuery.data || [];
    const vehiculos = vehiculoFiltro === 'todos'
        ? vehiculosBase
        : vehiculosBase.filter((v: any) => v.id === vehiculoFiltro);

    function buscarReserva(vehiculoId: string, hora: string) {
        const reserva = reservasDia.find(
            (r: any) => r.vehiculo_id === vehiculoId && r.hora_inicio.slice(0, 5) === hora
        );
        if (!reserva) return undefined;
        if (conductorFiltro !== 'todos' && reserva.conductor_id !== conductorFiltro) return undefined;
        return reserva;
    }

    async function exportarExcel() {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Distrikia';
        workbook.created = new Date();

        const horariosExcel = obtenerHorariosDelDia(fecha);
        const hoja = workbook.addWorksheet('Calendario ' + fecha);
        hoja.columns = [
            { header: 'Vehiculo', key: 'vehiculo', width: 22 },
            { header: 'Placa', key: 'placa', width: 12 },
            { header: 'Sede', key: 'sede', width: 20 },
            ...horariosExcel.map((h) => ({ header: h, key: h, width: 26 })),
        ];

        const encabezado = hoja.getRow(1);
        encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF051620' } };

        vehiculos.forEach((v: any) => {
            const fila: any = {
                vehiculo: 'KIA ' + v.modelo,
                placa: v.placa,
                sede: v.sedes ? v.sedes.nombre : '',
            };

            horariosExcel.forEach((h) => {
                const reserva = buscarReserva(v.id, h);
                if (reserva) {
                    const estado = ESTILO_ESTADO[reserva.estado]?.label || reserva.estado;
                    fila[h] = reserva.cliente_nombre + ' ' + (reserva.cliente_apellido || '') + ' (' + estado + ')' +
                        (reserva.conductores ? ' - ' + reserva.conductores.nombre : '');
                } else {
                    fila[h] = '';
                }
            });

            hoja.addRow(fila);
        });

        hoja.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.setAttribute('href', url);
        enlace.setAttribute('download', 'calendario-distrikia_' + fecha + '.xlsx');
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
    }

    const cargando = vehiculosQuery.isLoading || reservasDiaQuery.isLoading;

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-[#051620]">Calendario</h1>
                    <p className="text-sm text-[#666]">Disponibilidad de vehiculos por horario, dia a dia.</p>
                </div>
                <button
                    type="button"
                    onClick={exportarExcel}
                    disabled={vehiculos.length === 0}
                    className="inline-flex items-center gap-2 bg-[#051620] text-white text-sm font-medium px-4 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-40"
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar Excel
                </button>
            </div>

            {/* Controles */}
            <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-6 flex items-end gap-4 flex-wrap">
                <div className="flex items-end gap-2">
                    <button
                        type="button"
                        onClick={() => setFecha(sumarDias(fecha, -1))}
                        className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4 text-[#051620]" />
                    </button>
                    <div className="w-48">
                        <SelectorFecha label="Fecha" valor={fecha} onCambio={setFecha} />
                    </div>
                    <button
                        type="button"
                        onClick={() => setFecha(sumarDias(fecha, 1))}
                        className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4 text-[#051620]" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setFecha(hoyISO())}
                        className="h-9 text-xs font-medium text-[#666] hover:text-[#051620] border border-[#e5e5e5] rounded-sm px-3 cursor-pointer hover:border-[#051620]"
                    >
                        Hoy
                    </button>
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
                        {sedes.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs text-[#666] block mb-1">Vehiculo</label>
                    <select
                        value={vehiculoFiltro}
                        onChange={(e) => setVehiculoFiltro(e.target.value)}
                        className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                        style={{
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                            backgroundPosition: 'right 10px center',
                        }}
                    >
                        <option value="todos">Todos los vehiculos</option>
                        {vehiculosBase.map((v: any) => (
                            <option key={v.id} value={v.id}>KIA {v.modelo} · {v.placa}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs text-[#666] block mb-1">Conductor</label>
                    <select
                        value={conductorFiltro}
                        onChange={(e) => setConductorFiltro(e.target.value)}
                        className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                        style={{
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                            backgroundPosition: 'right 10px center',
                        }}
                    >
                        <option value="todos">Todos los conductores</option>
                        {conductores.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setSedeFiltro('todas');
                        setVehiculoFiltro('todos');
                        setConductorFiltro('todos');
                    }}
                    title="Restablecer filtros"
                    className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] cursor-pointer"
                >
                    <RotateCcw className="w-4 h-4 text-[#666]" />
                </button>

                <p className="text-sm text-[#666] capitalize ml-auto self-center">
                    {formatearFechaBonita(fecha)}
                </p>
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-4 flex-wrap mb-4 text-xs text-[#666]">
                {Object.entries(ESTILO_ESTADO).map(([key, val]) => (
                    <span key={key} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: val.texto }} />
                        {val.label}
                    </span>
                ))}
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    Vehiculo bloqueado (novedad)
                </span>
            </div>

            {cargando ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : vehiculos.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay vehiculos activos para esta sede.
                </p>
            ) : (
                <div className="bg-white border border-[#e5e5e5] rounded-sm overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="sticky left-0 bg-[#f8f8f8] text-left text-xs text-[#666] uppercase tracking-wide px-4 py-3 border-b border-[#e5e5e5] min-w-[160px]">
                                    Vehiculo
                                </th>
                                {obtenerHorariosDelDia(fecha).map((h) => (
                                    <th key={h} className="text-center text-xs text-[#666] uppercase tracking-wide px-2 py-3 border-b border-l border-[#e5e5e5] min-w-[110px]">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {vehiculos.map((v: any) => {
                                const bloqueo = bloqueosPorVehiculo[v.id];
                                const horarios = obtenerHorariosDelDia(fecha);
                                return (
                                <tr key={v.id} className="border-t border-[#e5e5e5]">
                                    <td className="sticky left-0 bg-white px-4 py-2 border-r border-[#e5e5e5]">
                                        <p className="font-medium text-[#051620] text-sm">KIA {v.modelo}</p>
                                        <p className="text-xs text-[#999]">{v.placa} · {v.sedes ? v.sedes.nombre : ''}</p>
                                    </td>
                                    {bloqueo ? (
                                        <td colSpan={horarios.length} className="border-l border-[#e5e5e5] p-1.5 align-top">
                                            <div
                                                className="w-full h-[42px] rounded-sm bg-red-50 border border-red-100 flex items-center gap-2 px-3"
                                                title={bloqueo.motivo}
                                            >
                                                <Ban className="w-4 h-4 text-red-600 flex-shrink-0" />
                                                <span className="text-xs font-medium text-red-700 truncate">{bloqueo.motivo}</span>
                                            </div>
                                        </td>
                                    ) : horarios.map((h) => {
                                        const reserva = buscarReserva(v.id, h);
                                        const estilo = reserva ? ESTILO_ESTADO[reserva.estado] : null;
                                        return (
                                            <td key={h} className="border-l border-[#e5e5e5] p-1.5 align-top">
                                                {reserva ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setReservaSel(reserva)}
                                                        className="w-full text-left rounded-sm px-2 py-1.5 cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5"
                                                        style={{ background: estilo!.bg }}
                                                    >
                                                        {(() => {
                                                            const esConductor = !!reserva.conductores;
                                                            const persona = reserva.conductores || (reserva.conducido_por_asesor ? reserva.asesores : null);
                                                            const IconoRol = esConductor ? ShipWheel : UserRound;
                                                            if (!persona) return null;
                                                            return (
                                                                <div className="relative flex-shrink-0">
                                                                    {persona.foto_url ? (
                                                                        <img
                                                                            src={persona.foto_url}
                                                                            alt={persona.nombre}
                                                                            className="w-6 h-6 rounded-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div
                                                                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                                                                            style={{ background: estilo!.texto, color: '#fff' }}
                                                                        >
                                                                            {iniciales(persona.nombre)}
                                                                        </div>
                                                                    )}
                                                                    <div
                                                                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center border border-white"
                                                                        style={{ background: estilo!.texto }}
                                                                        title={esConductor ? 'Conductor' : 'Asesor comercial'}
                                                                    >
                                                                        <IconoRol className="w-2 h-2 text-white" strokeWidth={3} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                        <div className="min-w-0">
                                                            <p className="text-[11px] font-semibold truncate" style={{ color: estilo!.texto }}>
                                                                {reserva.cliente_nombre}
                                                            </p>
                                                            <p className="text-[10px] truncate" style={{ color: estilo!.texto, opacity: 0.8 }}>
                                                                {reserva.conductores
                                                                    ? reserva.conductores.nombre
                                                                    : reserva.conducido_por_asesor
                                                                        ? (reserva.asesores ? reserva.asesores.nombre + ' (asesor)' : 'Asesor comercial')
                                                                        : 'Sin conductor'}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <div className="w-full h-[42px] rounded-sm bg-[#f8f8f8]" />
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal detalle rapido */}
            {reservaSel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReservaSel(null)}>
                    <div className="bg-white rounded-sm max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <span
                                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={{
                                    background: ESTILO_ESTADO[reservaSel.estado].bg,
                                    color: ESTILO_ESTADO[reservaSel.estado].texto,
                                }}
                            >
                                {ESTILO_ESTADO[reservaSel.estado].label}
                            </span>
                            <button
                                type="button"
                                onClick={() => setReservaSel(null)}
                                className="text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                X
                            </button>
                        </div>
                        <p className="font-display text-lg font-bold text-[#051620]">
                            {reservaSel.cliente_nombre} {reservaSel.cliente_apellido}
                        </p>
                        <div className="text-sm text-[#666] mt-3 flex flex-col gap-1">
                            <p><strong className="text-[#051620]">Hora:</strong> {reservaSel.hora_inicio.slice(0, 5)} - {reservaSel.hora_fin.slice(0, 5)}</p>
                            <p><strong className="text-[#051620]">Correo:</strong> {reservaSel.cliente_correo}</p>
                            <p><strong className="text-[#051620]">Celular:</strong> {reservaSel.cliente_celular}</p>
                            <p><strong className="text-[#051620]">Conductor:</strong> {reservaSel.conductores ? reservaSel.conductores.nombre : (reservaSel.conducido_por_asesor ? 'La hace el asesor: ' + (reservaSel.asesores ? reservaSel.asesores.nombre : 'Sin dato') : 'Sin asignar')}</p>
                            <p><strong className="text-[#051620]">Entrega:</strong> {reservaSel.tipo_entrega === 'domicilio' ? 'A domicilio' : 'En sede'}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}