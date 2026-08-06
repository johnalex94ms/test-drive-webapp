import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { FileSpreadsheet, Radio, RotateCcw, ClipboardCheck, CheckCircle2, XCircle, Gauge, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { SelectorFecha } from '../../components/ui/SelectorFecha';
import { fechaHoyLocal } from '../../lib/fecha';
import { nombreCortoSede } from '../../lib/sedes';
import { obtenerFotoCarro } from '../../lib/vehiculoImagenes';
import ExcelJS from 'exceljs';

function hoyISO() {
    return fechaHoyLocal();
}

function haceNDias(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return fechaHoyLocal(d);
}

function inicioMesActual() {
    const d = new Date();
    return fechaHoyLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

function finMesActual() {
    const d = new Date();
    return fechaHoyLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-white border border-[#e5e5e5] rounded-md shadow-md px-3 py-2 text-xs">
            {label && <p className="font-medium text-[#051620] mb-1">{label}</p>}
            <div className="flex flex-col gap-0.5">
                {payload.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: item.color || item.fill }}
                        />
                        <span className="text-[#666]">{item.name || 'Total'}:</span>
                        <span className="font-semibold text-[#051620]">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Acordeon({ titulo, abierto, onToggle, children }: { titulo: string; abierto: boolean; onToggle: () => void; children: ReactNode }) {
    return (
        <div className="bg-white border border-[#e5e5e5] rounded-sm mb-6">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 cursor-pointer"
            >
                <p className="text-md font-semibold text-[#051620]">{titulo}</p>
                <ChevronDown className={'w-4 h-4 text-[#666] transition-transform ' + (abierto ? 'rotate-180' : '')} />
            </button>
            {abierto && <div className="px-4 pb-4">{children}</div>}
        </div>
    );
}

const ESTADOS_LABEL: Record<string, string> = {
    confirmada: 'Confirmada',
    en_camino: 'En camino',
    en_prueba: 'En prueba',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada',
};

export default function ReportesAdminPage() {
    const [desde, setDesde] = useState(inicioMesActual());
    const [hasta, setHasta] = useState(finMesActual());
    const [sedeFiltro, setSedeFiltro] = useState('todas');
    const [vehiculoFiltro, setVehiculoFiltro] = useState('todos');
    const [busquedaPlaca, setBusquedaPlaca] = useState('');
    const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({
        estado: true,
        porDia: true,
        porVehiculo: true,
        porSede: true,
        porConductor: true,
    });
    const queryClient = useQueryClient();

    function toggleSeccion(clave: string) {
        setSeccionesAbiertas((s) => ({ ...s, [clave]: !s[clave] }));
    }

    const sedesQuery = useQuery({
        queryKey: ['admin-sedes-lista'],
        queryFn: async () => {
            const res = await supabase.from('sedes').select('*').order('nombre');
            return res.data || [];
        },
    });

    const vehiculosQuery = useQuery({
        queryKey: ['admin-vehiculos-lista-reportes-v2'],
        queryFn: async () => {
            const res = await supabase.from('vehiculos').select('id, modelo, placa, sede_id').order('modelo');
            return res.data || [];
        },
    });

    const reservasQuery = useQuery({
        queryKey: ['admin-reportes', desde, hasta, sedeFiltro, vehiculoFiltro],
        queryFn: async () => {
            let query = supabase
                .from('reservas')
                .select('*, vehiculos(modelo, placa), sedes(nombre), conductores(nombre)')
                .gte('fecha', desde)
                .lte('fecha', hasta)
                .order('fecha', { ascending: true });

            if (sedeFiltro !== 'todas') query = query.eq('sede_id', sedeFiltro);
            if (vehiculoFiltro !== 'todos') query = query.eq('vehiculo_id', vehiculoFiltro);

            const res = await query;
            return res.data || [];
        },
    });

    const enVivoQuery = useQuery({
        queryKey: ['admin-en-vivo'],
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('*, vehiculos(modelo), sedes(nombre), conductores(nombre)')
                .in('estado', ['en_camino', 'en_prueba'])
                .order('hora_inicio', { ascending: true });
            return res.data || [];
        },
    });

    useEffect(() => {
        const canal = supabase
            .channel('reportes-en-vivo')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'reservas' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['admin-en-vivo'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, [queryClient]);

    const sedes = sedesQuery.data || [];
    const vehiculosTodos = vehiculosQuery.data || [];
    const vehiculosBase = sedeFiltro === 'todas'
        ? vehiculosTodos
        : vehiculosTodos.filter((v: any) => v.sede_id === sedeFiltro);
    const reservasBase = reservasQuery.data || [];
    const reservas = reservasBase.filter((r: any) =>
        busquedaPlaca.trim() === '' || (r.vehiculos && r.vehiculos.placa && r.vehiculos.placa.toLowerCase().includes(busquedaPlaca.trim().toLowerCase()))
    );
    const enVivo = enVivoQuery.data || [];

    const vehiculoSeleccionado = vehiculoFiltro !== 'todos' ? vehiculosTodos.find((v: any) => v.id === vehiculoFiltro) : null;
    const vehiculoSeleccionadoModelo = vehiculoSeleccionado ? vehiculoSeleccionado.modelo : '';
    const vehiculoSeleccionadoFoto = vehiculoSeleccionado ? obtenerFotoCarro(vehiculoSeleccionado.modelo) : undefined;

    const total = reservas.length;

    const porEstado = useMemo(() => {
        const conteo: Record<string, number> = {};
        reservas.forEach((r: any) => {
            conteo[r.estado] = (conteo[r.estado] || 0) + 1;
        });
        return conteo;
    }, [reservas]);

    const tasaCancelacion = total > 0 ? Math.round(((porEstado['cancelada'] || 0) / total) * 100) : 0;
    const completadas = porEstado['finalizada'] || 0;
    const diasEnRango = Math.max(1, Math.round((new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / 86400000) + 1);
    const promedioDiario = total > 0 ? (total / diasEnRango).toFixed(1) : '0';

    const porVehiculo = useMemo(() => {
        const conteo: Record<string, number> = {};
        reservas.forEach((r: any) => {
            const nombre = r.vehiculos ? 'KIA ' + r.vehiculos.modelo + ' · ' + r.vehiculos.placa : 'Sin dato';
            conteo[nombre] = (conteo[nombre] || 0) + 1;
        });
        return Object.entries(conteo)
            .map(([vehiculo, total]) => ({ vehiculo, total }))
            .sort((a, b) => b.total - a.total);
    }, [reservas]);

    const porSede = useMemo(() => {
        const conteo: Record<string, number> = {};
        reservas.forEach((r: any) => {
            const nombre = r.sedes ? nombreCortoSede(r.sedes.nombre) : 'Sin dato';
            conteo[nombre] = (conteo[nombre] || 0) + 1;
        });
        return Object.entries(conteo).map(([sede, total]) => ({ sede, total }));
    }, [reservas]);

    const porConductor = useMemo(() => {
        const conteo: Record<string, number> = {};
        reservas.forEach((r: any) => {
            if (!r.conductores) return;
            const nombre = r.conductores.nombre + ' · ' + (r.sedes ? nombreCortoSede(r.sedes.nombre) : 'Sin sede');
            conteo[nombre] = (conteo[nombre] || 0) + 1;
        });
        return Object.entries(conteo)
            .map(([conductor, total]) => ({ conductor, total }))
            .sort((a, b) => b.total - a.total);
    }, [reservas]);

    const porDia = useMemo(() => {
        const conteo: Record<string, number> = {};
        reservas.forEach((r: any) => {
            conteo[r.fecha] = (conteo[r.fecha] || 0) + 1;
        });
        return Object.entries(conteo)
            .map(([fecha, total]) => ({ fecha: fecha.slice(5), total }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
    }, [reservas]);

    async function exportarExcel() {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Distrikia';
        workbook.created = new Date();

        // --- Hoja 1: Resumen ---
        const hojaResumen = workbook.addWorksheet('Resumen');
        hojaResumen.columns = [
            { header: 'Indicador', key: 'indicador', width: 30 },
            { header: 'Valor', key: 'valor', width: 20 },
        ];

        const filaTitulo = hojaResumen.getRow(1);
        filaTitulo.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        filaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF051620' } };

        hojaResumen.addRows([
            { indicador: 'Rango de fechas', valor: desde + ' a ' + hasta },
            { indicador: 'Total de pruebas', valor: total },
            { indicador: 'Finalizadas', valor: completadas },
            { indicador: 'Tasa de cancelacion', valor: tasaCancelacion + '%' },
            { indicador: '', valor: '' },
            { indicador: 'Desglose por estado', valor: '' },
            ...Object.entries(ESTADOS_LABEL).map(([key, label]) => ({
                indicador: label,
                valor: porEstado[key] || 0,
            })),
        ]);

        hojaResumen.getRow(7).font = { bold: true };

        // --- Hoja 2: Detalle de reservas ---
        const hojaDetalle = workbook.addWorksheet('Detalle de reservas');
        hojaDetalle.columns = [
            { header: 'Fecha', key: 'fecha', width: 12 },
            { header: 'Hora', key: 'hora', width: 8 },
            { header: 'Cliente', key: 'cliente', width: 26 },
            { header: 'Correo', key: 'correo', width: 28 },
            { header: 'Celular', key: 'celular', width: 15 },
            { header: 'Vehiculo', key: 'vehiculo', width: 16 },
            { header: 'Sede', key: 'sede', width: 20 },
            { header: 'Conductor', key: 'conductor', width: 20 },
            { header: 'Entrega', key: 'entrega', width: 14 },
            { header: 'Estado', key: 'estado', width: 14 },
        ];

        const encabezadoDetalle = hojaDetalle.getRow(1);
        encabezadoDetalle.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        encabezadoDetalle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF051620' } };
        hojaDetalle.views = [{ state: 'frozen', ySplit: 1 }];

        reservas.forEach((r: any) => {
            hojaDetalle.addRow({
                fecha: r.fecha,
                hora: r.hora_inicio ? r.hora_inicio.slice(0, 5) : '',
                cliente: (r.cliente_nombre || '') + ' ' + (r.cliente_apellido || ''),
                correo: r.cliente_correo,
                celular: r.cliente_celular,
                vehiculo: r.vehiculos ? 'KIA ' + r.vehiculos.modelo : '',
                sede: r.sedes ? nombreCortoSede(r.sedes.nombre) : '',
                conductor: r.conductores ? r.conductores.nombre : 'Sin asignar',
                entrega: r.tipo_entrega === 'domicilio' ? 'A domicilio' : 'En sede',
                estado: ESTADOS_LABEL[r.estado] || r.estado,
            });
        });

        hojaDetalle.autoFilter = { from: 'A1', to: 'J1' };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.setAttribute('href', url);
        enlace.setAttribute('download', 'reservas-distrikia_' + desde + '_a_' + hasta + '.xlsx');
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
    }

    return (
        <div>
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold text-[#051620]">Reportes</h1>
                    <p className="text-sm text-[#666]">Analiza el desempeño del programa de pruebas de ruta.</p>
                </div>
                <button
                    type="button"
                    onClick={exportarExcel}
                    disabled={total === 0}
                    className="inline-flex items-center gap-2 bg-[#051620] text-white text-sm font-medium px-4 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-40"
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar Excel
                </button>
            </div>

            {/* En vivo — independiente del filtro de fechas */}
            {enVivo.length > 0 && (
                <div className="bg-[#051620] rounded-sm p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                        <p className="text-sm font-semibold text-white">
                            {enVivo.length} prueba{enVivo.length > 1 ? 's' : ''} en curso ahora mismo
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {enVivo.map((r: any) => (
                            <div key={r.id} className="bg-white/5 rounded-sm p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-medium text-white">
                                        {r.vehiculos ? 'KIA ' + r.vehiculos.modelo : 'Vehiculo'}
                                    </p>
                                    <span className={
                                        'text-[10px] font-semibold px-2 py-0.5 rounded-full ' +
                                        (r.estado === 'en_camino' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300')
                                    }>
                                        {r.estado === 'en_camino' ? 'En camino' : 'En prueba'}
                                    </span>
                                </div>
                                <p className="text-xs text-white/50">{r.cliente_nombre} {r.cliente_apellido}</p>
                                <p className="text-xs text-white/40 mt-1">
                                    {r.conductores ? r.conductores.nombre : 'Sin conductor'} · {r.sedes ? nombreCortoSede(r.sedes.nombre) : ''}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-6">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div className="flex items-end gap-4 flex-wrap">
                        <SelectorFecha label="Desde" valor={desde} onCambio={setDesde} maxFecha={hasta} />
                        <SelectorFecha label="Hasta" valor={hasta} onCambio={setHasta} minFecha={desde} />

                        <div>
                            <label className="text-xs text-[#666] block mb-1">Sede</label>
                            <select
                                value={sedeFiltro}
                                onChange={(e) => { setSedeFiltro(e.target.value); setVehiculoFiltro('todos'); }}
                                className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                                    backgroundPosition: 'right 10px center',
                                }}
                            >
                                <option value="todas">Todas las sedes</option>
                                {sedes.map((s: any) => (
                                    <option key={s.id} value={s.id}>{nombreCortoSede(s.nombre)}</option>
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
                            <label className="text-xs text-[#666] block mb-1">Buscar placa</label>
                            <input
                                type="text"
                                placeholder="Ej. ABC-123"
                                value={busquedaPlaca}
                                onChange={(e) => setBusquedaPlaca(e.target.value)}
                                className="pl-3 pr-3 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setDesde(inicioMesActual());
                                setHasta(finMesActual());
                                setSedeFiltro('todas');
                                setVehiculoFiltro('todos');
                                setBusquedaPlaca('');
                            }}
                            title="Restablecer filtros"
                            className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] cursor-pointer"
                        >
                            <RotateCcw className="w-4 h-4 text-[#666]" />
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setDesde(inicioMesActual()); setHasta(finMesActual()); }}
                            className="text-xs font-medium text-[#666] hover:text-[#051620] border border-[#e5e5e5] rounded-sm px-3 py-2 cursor-pointer hover:border-[#051620] whitespace-nowrap"
                        >
                            Este mes
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDesde(haceNDias(7)); setHasta(hoyISO()); }}
                            className="text-xs font-medium text-[#666] hover:text-[#051620] border border-[#e5e5e5] rounded-sm px-3 py-2 cursor-pointer hover:border-[#051620] whitespace-nowrap"
                        >
                            Ultimos 7 dias
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDesde(haceNDias(30)); setHasta(hoyISO()); }}
                            className="text-xs font-medium text-[#666] hover:text-[#051620] border border-[#e5e5e5] rounded-sm px-3 py-2 cursor-pointer hover:border-[#051620] whitespace-nowrap"
                        >
                            Ultimos 30 dias
                        </button>
                    </div>
                </div>
            </div>

            {reservasQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : total === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay reservas en este rango de fechas.
                </p>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div
                            className="relative rounded-lg p-4 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #e6f4fd 0%, #d9edfb 100%)' }}
                        >
                            {!vehiculoSeleccionadoFoto && (
                                <ClipboardCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20 text-[#0284c7] opacity-[0.08] pointer-events-none select-none" strokeWidth={1.5} />
                            )}
                            <div
                                className="relative w-11 h-11 rounded-full flex items-center justify-center mb-4"
                                style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)' }}
                            >
                                <ClipboardCheck className="w-5 h-5 text-white" />
                            </div>
                            <p className="relative font-display text-2xl font-bold text-[#051620]">{total}</p>
                            <p className="relative text-xs text-[#5a6b78] mt-1">Total pruebas</p>
                            {vehiculoSeleccionadoFoto && (
                                <img
                                    key={vehiculoSeleccionadoFoto}
                                    src={vehiculoSeleccionadoFoto}
                                    alt={vehiculoSeleccionadoModelo}
                                    className="absolute right-5 bottom-10 w-35 h-auto object-contain pointer-events-none select-none animate-car-entrada"
                                />
                            )}
                        </div>

                        <div
                            className="relative rounded-lg p-4 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #e9f9ef 0%, #dcf3e4 100%)' }}
                        >
                            <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20 text-[#0a6e3a] opacity-[0.08] pointer-events-none select-none" strokeWidth={1.5} />
                            <div
                                className="relative w-11 h-11 rounded-full flex items-center justify-center mb-4"
                                style={{ background: 'linear-gradient(135deg, #4ade80 0%, #0a6e3a 100%)' }}
                            >
                                <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                            <p className="relative font-display text-2xl font-bold text-[#051620]">{completadas}</p>
                            <p className="relative text-xs text-[#5a6b78] mt-1">Finalizadas</p>
                        </div>

                        <div
                            className="relative rounded-lg p-4 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #fdf3e0 0%, #fbe8c8 100%)' }}
                        >
                            <XCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20 text-[#b45309] opacity-[0.08] pointer-events-none select-none" strokeWidth={1.5} />
                            <div
                                className="relative w-11 h-11 rounded-full flex items-center justify-center mb-4"
                                style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #b45309 100%)' }}
                            >
                                <XCircle className="w-5 h-5 text-white" />
                            </div>
                            <p className="relative font-display text-2xl font-bold text-[#051620]">{tasaCancelacion}%</p>
                            <p className="relative text-xs text-[#5a6b78] mt-1">Tasa de cancelacion</p>
                        </div>

                        <div
                            className="relative rounded-lg p-4 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #f1ecfc 0%, #e6dbf9 100%)' }}
                        >
                            <Gauge className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20 text-[#6d28d9] opacity-[0.08] pointer-events-none select-none" strokeWidth={1.5} />
                            <div
                                className="relative w-11 h-11 rounded-full flex items-center justify-center mb-4"
                                style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #6d28d9 100%)' }}
                            >
                                <Gauge className="w-5 h-5 text-white" />
                            </div>
                            <p className="relative font-display text-2xl font-bold text-[#051620]">{promedioDiario}</p>
                            <p className="relative text-xs text-[#5a6b78] mt-1">Promedio de pruebas / dia</p>
                        </div>
                    </div>

                    {/* Desglose por estado */}
                    <Acordeon titulo="Desglose por estado" abierto={seccionesAbiertas.estado} onToggle={() => toggleSeccion('estado')}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.entries(ESTADOS_LABEL).map(([key, label]) => (
                                <div key={key} className="bg-[#f8f8f8] rounded-sm p-3">
                                    <p className="text-xs text-[#666]">{label}</p>
                                    <p className="font-display text-lg font-bold text-[#051620]">{porEstado[key] || 0}</p>
                                </div>
                            ))}
                        </div>
                    </Acordeon>

                    {/* Grafico por dia */}
                    <Acordeon titulo="Pruebas por dia" abierto={seccionesAbiertas.porDia} onToggle={() => toggleSeccion('porDia')}>
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={porDia} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="fecha" fontSize={11} stroke="#999" axisLine={false} tickLine={false} tickMargin={8} />
                                <YAxis allowDecimals={false} fontSize={11} stroke="#999" axisLine={false} tickLine={false} tickMargin={8} width={30} />
                                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e5e5e5', strokeWidth: 1 }} />
                                <Line
                                    type="monotone"
                                    dataKey="total"
                                    name="Pruebas"
                                    stroke="#051620"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#051620', strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Acordeon>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Por vehiculo */}
                        <Acordeon titulo="Pruebas por vehiculo" abierto={seccionesAbiertas.porVehiculo} onToggle={() => toggleSeccion('porVehiculo')}>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={porVehiculo} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barCategoryGap={10}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                    <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#999" axisLine={false} tickLine={false} tickMargin={8} />
                                    <YAxis type="category" dataKey="vehiculo" fontSize={11} stroke="#666" axisLine={false} tickLine={false} width={150} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8f8f8' }} />
                                    <Bar dataKey="total" name="Pruebas" fill="#051620" radius={[0, 6, 6, 0]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Acordeon>

                        {/* Por sede */}
                        <Acordeon titulo="Pruebas por sede" abierto={seccionesAbiertas.porSede} onToggle={() => toggleSeccion('porSede')}>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={porSede} margin={{ top: 4, right: 12, left: -12, bottom: 0 }} barCategoryGap={16}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis dataKey="sede" fontSize={11} stroke="#999" axisLine={false} tickLine={false} tickMargin={8} />
                                    <YAxis allowDecimals={false} fontSize={11} stroke="#999" axisLine={false} tickLine={false} tickMargin={8} width={30} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8f8f8' }} />
                                    <Bar dataKey="total" name="Pruebas" fill="#0a4a8a" radius={[6, 6, 0, 0]} maxBarSize={48} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Acordeon>
                    </div>

                    {/* Por conductor */}
                    <Acordeon titulo="Pruebas por conductor" abierto={seccionesAbiertas.porConductor} onToggle={() => toggleSeccion('porConductor')}>
                        {porConductor.length === 0 ? (
                            <p className="text-sm text-[#666]">Ninguna reserva en este rango tiene conductor asignado.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={Math.max(200, porConductor.length * 40)}>
                                <BarChart data={porConductor} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barCategoryGap={10}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                    <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#999" axisLine={false} tickLine={false} tickMargin={8} />
                                    <YAxis type="category" dataKey="conductor" fontSize={11} stroke="#666" axisLine={false} tickLine={false} width={170} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8f8f8' }} />
                                    <Bar dataKey="total" name="Pruebas" fill="#0a6e3a" radius={[0, 6, 6, 0]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Acordeon>
                </>
            )}
        </div>
    );
}