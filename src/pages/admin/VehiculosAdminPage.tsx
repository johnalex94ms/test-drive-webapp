import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, X, Upload, Copy, Search, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Input } from '../../components/ui/Input';

const CATEGORIAS = [
    { value: 'automovil', label: 'Automovil' },
    { value: 'camioneta', label: 'Camioneta' },
    { value: 'hibrido', label: 'Hibrido' },
    { value: 'electrico', label: 'Electrico' },
];

const PORPAGINA = 10;

interface VehiculoForm {
    id?: string;
    sede_id: string;
    modelo: string;
    placa: string;
    categoria: string;
    motor: string;
    potencia: string;
    velocidad_max: string;
    tipo_cambio: string;
    activo: boolean;
    imagenes: string[];
}

function formVacio(sedeDefault: string): VehiculoForm {
    return {
        sede_id: sedeDefault,
        modelo: '',
        placa: '',
        categoria: 'automovil',
        motor: '',
        potencia: '',
        velocidad_max: '',
        tipo_cambio: '',
        activo: true,
        imagenes: [],
    };
}

export default function VehiculosAdminPage() {
    const [modalAbierto, setModalAbierto] = useState(false);
    const [form, setForm] = useState<VehiculoForm>(formVacio(''));
    const [guardando, setGuardando] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [vehiculoAEliminar, setVehiculoAEliminar] = useState<any>(null);
    const [subiendoImagenes, setSubiendoImagenes] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [sedeFiltro, setSedeFiltro] = useState('todas');
    const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
    const [estadoFiltro, setEstadoFiltro] = useState('todos');
    const [pagina, setPagina] = useState(1);
    const queryClient = useQueryClient();

    const sedesQuery = useQuery({
        queryKey: ['admin-sedes-lista'],
        queryFn: async () => {
            const res = await supabase.from('sedes').select('*').order('nombre');
            return res.data || [];
        },
    });

    const vehiculosQuery = useQuery({
        queryKey: ['admin-vehiculos'],
        queryFn: async () => {
            const res = await supabase.from('vehiculos').select('*, sedes(nombre)').order('modelo');
            return res.data || [];
        },
    });

    const sedes = sedesQuery.data || [];
    const vehiculosBase = vehiculosQuery.data || [];

    const vehiculos = vehiculosBase.filter((v: any) => {
        const coincideTexto = busqueda.trim() === '' ||
            v.modelo.toLowerCase().includes(busqueda.toLowerCase()) ||
            v.placa.toLowerCase().includes(busqueda.toLowerCase());
        const coincideSede = sedeFiltro === 'todas' || v.sede_id === sedeFiltro;
        const coincideCategoria = categoriaFiltro === 'todas' || v.categoria === categoriaFiltro;
        const coincideEstado = estadoFiltro === 'todos' ||
            (estadoFiltro === 'activo' && v.activo) ||
            (estadoFiltro === 'inactivo' && !v.activo);
        return coincideTexto && coincideSede && coincideCategoria && coincideEstado;
    });

    const totalPaginas = Math.max(1, Math.ceil(vehiculos.length / PORPAGINA));
    const vehiculosPagina = vehiculos.slice((pagina - 1) * PORPAGINA, pagina * PORPAGINA);

    useEffect(() => {
        setPagina(1);
    }, [busqueda, sedeFiltro, categoriaFiltro, estadoFiltro]);

    function abrirNuevo() {
        setForm(formVacio(sedes[0]?.id || ''));
        setErrorMsg(null);
        setModalAbierto(true);
    }

    function abrirEditar(v: any) {
        setForm({
            id: v.id,
            sede_id: v.sede_id,
            modelo: v.modelo,
            placa: v.placa,
            categoria: v.categoria || 'automovil',
            motor: v.motor || '',
            potencia: v.potencia || '',
            velocidad_max: v.velocidad_max || '',
            tipo_cambio: v.tipo_cambio || '',
            activo: v.activo,
            imagenes: v.imagenes_360 || [],
        });
        setErrorMsg(null);
        setModalAbierto(true);
    }

    function duplicarVehiculo(v: any) {
        setForm({
            sede_id: v.sede_id,
            modelo: v.modelo,
            placa: '',
            categoria: v.categoria || 'automovil',
            motor: v.motor || '',
            potencia: v.potencia || '',
            velocidad_max: v.velocidad_max || '',
            tipo_cambio: v.tipo_cambio || '',
            activo: true,
            imagenes: v.imagenes_360 || [],
        });
        setErrorMsg(null);
        setModalAbierto(true);
    }

    async function subirImagenVehiculo(file: File): Promise<string | null> {
        const ext = file.name.split('.').pop();
        const path = 'vehiculos/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
        const res = await supabase.storage.from('fotos-vehiculos').upload(path, file, { contentType: file.type });
        if (res.error) return null;
        const publicUrlData = supabase.storage.from('fotos-vehiculos').getPublicUrl(path);
        return publicUrlData.data.publicUrl;
    }

    async function handleSeleccionarImagenes(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setSubiendoImagenes(true);
        const espacioDisponible = 4 - form.imagenes.length;
        const filesAUsar = files.slice(0, espacioDisponible);
        const urls: string[] = [];

        for (const file of filesAUsar) {
            const url = await subirImagenVehiculo(file);
            if (url) urls.push(url);
        }

        setForm((f) => ({ ...f, imagenes: [...f.imagenes, ...urls] }));
        setSubiendoImagenes(false);
        e.target.value = '';
    }

    async function quitarImagen(index: number) {
        const url = form.imagenes[index];
        setForm((f) => ({ ...f, imagenes: f.imagenes.filter((_, i) => i !== index) }));

        if (url) {
            try {
                const partes = url.split('/fotos-vehiculos/');
                const path = partes[1];
                if (path) {
                    await supabase.storage.from('fotos-vehiculos').remove([path]);
                }
            } catch {
                // si falla el borrado fisico, no bloqueamos la edicion del formulario
            }
        }
    }

    async function guardar() {
        if (!form.modelo.trim() || !form.placa.trim() || !form.sede_id) {
            setErrorMsg('Modelo, placa y sede son obligatorios.');
            return;
        }

        setGuardando(true);
        setErrorMsg(null);

        try {
            const payload = {
                sede_id: form.sede_id,
                modelo: form.modelo.trim(),
                placa: form.placa.trim().toUpperCase(),
                categoria: form.categoria,
                motor: form.motor || null,
                potencia: form.potencia || null,
                velocidad_max: form.velocidad_max || null,
                tipo_cambio: form.tipo_cambio || null,
                activo: form.activo,
                imagenes_360: form.imagenes,
            };

            if (form.id) {
                const res = await supabase.from('vehiculos').update(payload).eq('id', form.id);
                if (res.error) throw res.error;
            } else {
                const res = await supabase.from('vehiculos').insert(payload);
                if (res.error) throw res.error;
            }

            queryClient.invalidateQueries({ queryKey: ['admin-vehiculos'] });
            setModalAbierto(false);
        } catch (err: any) {
            setErrorMsg(err.code === '23505' ? 'Esa placa ya esta registrada.' : 'Ocurrio un error al guardar.');
        } finally {
            setGuardando(false);
        }
    }

    async function eliminar() {
        if (!vehiculoAEliminar) return;
        setGuardando(true);
        try {
            const res = await supabase.from('vehiculos').delete().eq('id', vehiculoAEliminar.id);
            if (res.error) throw res.error;
            queryClient.invalidateQueries({ queryKey: ['admin-vehiculos'] });
            setVehiculoAEliminar(null);
        } catch {
            setErrorMsg('No se pudo eliminar, tiene pruebas de ruta asociadas. Puedes desactivarlo en su lugar.');
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-[#051620]">Vehiculos</h1>
                    <p className="text-sm text-[#666]">Gestiona el catalogo de vehiculos disponibles para prueba.</p>
                </div>
                <button
                    type="button"
                    onClick={abrirNuevo}
                    className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030]"
                >
                    + Nuevo vehiculo
                </button>
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-6 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-[#666] block mb-1">Buscar</label>
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
                    <label className="text-xs text-[#666] block mb-1">Categoria</label>
                    <select
                        value={categoriaFiltro}
                        onChange={(e) => setCategoriaFiltro(e.target.value)}
                        className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                        style={{
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                            backgroundPosition: 'right 10px center',
                        }}
                    >
                        <option value="todas">Todas</option>
                        {CATEGORIAS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs text-[#666] block mb-1">Estado</label>
                    <select
                        value={estadoFiltro}
                        onChange={(e) => setEstadoFiltro(e.target.value)}
                        className="pl-3 pr-9 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                        style={{
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                            backgroundPosition: 'right 10px center',
                        }}
                    >
                        <option value="todos">Todos</option>
                        <option value="activo">Activos</option>
                        <option value="inactivo">Inactivos</option>
                    </select>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setBusqueda('');
                        setSedeFiltro('todas');
                        setCategoriaFiltro('todas');
                        setEstadoFiltro('todos');
                    }}
                    title="Restablecer filtros"
                    className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] cursor-pointer flex-shrink-0"
                >
                    <RotateCcw className="w-4 h-4 text-[#666]" />
                </button>

                <p className="text-xs text-[#999] whitespace-nowrap pb-2">
                    {vehiculos.length} de {vehiculosBase.length}
                </p>
            </div>

            {vehiculosQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : vehiculos.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay vehiculos que coincidan con los filtros.
                </p>
            ) : (
                <>
                    <div className="bg-white border border-[#e5e5e5] rounded-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-[#f8f8f8] text-left text-xs text-[#666] uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3">Modelo</th>
                                    <th className="px-4 py-3">Placa</th>
                                    <th className="px-4 py-3">Categoria</th>
                                    <th className="px-4 py-3">Sede</th>
                                    <th className="px-4 py-3">Fotos</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehiculosPagina.map((v: any) => (
                                    <tr key={v.id} className="border-t border-[#e5e5e5]">
                                        <td className="px-4 py-3 font-medium text-[#051620]">KIA {v.modelo}</td>
                                        <td className="px-4 py-3 text-[#666]">{v.placa}</td>
                                        <td className="px-4 py-3 text-[#666] capitalize">{v.categoria}</td>
                                        <td className="px-4 py-3 text-[#666]">{v.sedes ? v.sedes.nombre : '—'}</td>
                                        <td className="px-4 py-3 text-[#666]">
                                            {v.imagenes_360 && v.imagenes_360.length > 0 ? v.imagenes_360.length + '/4' : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={'text-xs font-medium px-2 py-1 rounded-full ' + (v.activo ? 'bg-green-100 text-green-700' : 'bg-[#f0f0f0] text-[#999]')}>
                                                {v.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => duplicarVehiculo(v)}
                                                className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer transition-colors px-3 py-1.5 rounded-sm mr-2"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => abrirEditar(v)}
                                                className="inline-flex items-center gap-1.5 text-xs font-medium bg-teal-50 text-teal-600 hover:bg-teal-100 cursor-pointer transition-colors px-3 py-1.5 rounded-sm mr-2"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setVehiculoAEliminar(v)}
                                                className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer transition-colors px-3 py-1.5 rounded-sm"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-xs text-[#666]">
                                Pagina {pagina} de {totalPaginas}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                                    disabled={pagina === 1}
                                    className="w-8 h-8 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4 text-[#051620]" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                                    disabled={pagina === totalPaginas}
                                    className="w-8 h-8 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4 text-[#051620]" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal crear/editar */}
            {modalAbierto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <p className="font-display text-lg font-bold text-[#051620] mb-4">
                            {form.id ? 'Editar vehiculo' : 'Nuevo vehiculo'}
                        </p>

                        <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">
                            Fotos 360 (hasta 4)
                        </p>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {[0, 1, 2, 3].map((i) => {
                                const url = form.imagenes[i];
                                return (
                                    <div key={i} className="aspect-square relative">
                                        {url ? (
                                            <>
                                                <img src={url} alt={'Foto ' + (i + 1)} className="w-full h-full object-cover rounded-sm border border-[#e5e5e5]" />
                                                <button
                                                    type="button"
                                                    onClick={() => quitarImagen(i)}
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center cursor-pointer"
                                                >
                                                    <X className="w-3 h-3 text-white" />
                                                </button>
                                            </>
                                        ) : i === form.imagenes.length ? (
                                            <label
                                                htmlFor="fotos-vehiculo"
                                                className="w-full h-full rounded-sm border border-dashed border-[#e5e5e5] flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#051620] bg-[#f8f8f8]"
                                            >
                                                <Upload className="w-4 h-4 text-[#999]" />
                                                <span className="text-[10px] text-[#999]">{subiendoImagenes ? '...' : 'Subir'}</span>
                                            </label>
                                        ) : (
                                            <div className="w-full h-full rounded-sm bg-[#f8f8f8] border border-[#e5e5e5]" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <input
                            id="fotos-vehiculo"
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleSeleccionarImagenes}
                        />

                        <div className="flex flex-col gap-3 mb-4">
                            <select
                                value={form.sede_id}
                                onChange={(e) => setForm({ ...form, sede_id: e.target.value })}
                                className="w-full pl-3 pr-9 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                                    backgroundPosition: 'right 10px center',
                                }}
                            >
                                {sedes.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    type="text"
                                    placeholder="Modelo (ej. Sportage)"
                                    value={form.modelo}
                                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                                />
                                <Input
                                    type="text"
                                    placeholder="Placa"
                                    value={form.placa}
                                    onChange={(e) => setForm({ ...form, placa: e.target.value })}
                                />
                            </div>

                            <select
                                value={form.categoria}
                                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                                className="w-full pl-3 pr-9 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                                    backgroundPosition: 'right 10px center',
                                }}
                            >
                                {CATEGORIAS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    type="text"
                                    placeholder="Motor (ej. 1.6T)"
                                    value={form.motor}
                                    onChange={(e) => setForm({ ...form, motor: e.target.value })}
                                />
                                <Input
                                    type="text"
                                    placeholder="Potencia (ej. 180 hp)"
                                    value={form.potencia}
                                    onChange={(e) => setForm({ ...form, potencia: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    type="text"
                                    placeholder="Vel. maxima (ej. 200 km/h)"
                                    value={form.velocidad_max}
                                    onChange={(e) => setForm({ ...form, velocidad_max: e.target.value })}
                                />
                                <Input
                                    type="text"
                                    placeholder="Cambios (ej. Automatico)"
                                    value={form.tipo_cambio}
                                    onChange={(e) => setForm({ ...form, tipo_cambio: e.target.value })}
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.activo}
                                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                                    className="cursor-pointer"
                                />
                                <span className="text-sm text-[#051620]">Vehiculo activo (visible para agendar)</span>
                            </label>
                        </div>

                        {errorMsg && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 mb-4">
                                {errorMsg}
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setModalAbierto(false)}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={guardar}
                                className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                            >
                                {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal eliminar */}
            {vehiculoAEliminar && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Eliminar KIA {vehiculoAEliminar.modelo}?
                        </p>
                        <p className="text-sm text-[#666] mb-6">
                            Esta accion no se puede deshacer.
                        </p>
                        {errorMsg && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 mb-4">
                                {errorMsg}
                            </p>
                        )}
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setVehiculoAEliminar(null); setErrorMsg(null); }}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={eliminar}
                                className="bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-red-700 disabled:opacity-50"
                            >
                                {guardando ? 'Eliminando...' : 'Si, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}