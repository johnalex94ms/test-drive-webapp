import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, RotateCcw, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../../lib/supabaseClient';
import { FotoCropModal } from '../../components/admin/FotoCropModal';
import { Input } from '../../components/ui/Input';

const PORPAGINA = 10;

interface AsesorForm {
    id?: string;
    nombre: string;
    sede_id: string;
    activo: boolean;
    foto_url: string | null;
}

const FORM_VACIO: AsesorForm = {
    nombre: '',
    sede_id: '',
    activo: true,
    foto_url: null,
};

export default function AsesoresAdminPage() {
    const [modalAbierto, setModalAbierto] = useState(false);
    const [form, setForm] = useState<AsesorForm>(FORM_VACIO);
    const [guardando, setGuardando] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [asesorAEliminar, setAsesorAEliminar] = useState<any>(null);
    const queryClient = useQueryClient();
    const [imagenTemporal, setImagenTemporal] = useState<string | null>(null);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [sedeFiltro, setSedeFiltro] = useState('todas');
    const [estadoFiltro, setEstadoFiltro] = useState('todos');
    const [pagina, setPagina] = useState(1);

    const sedesQuery = useQuery({
        queryKey: ['admin-sedes-lista'],
        queryFn: async () => {
            const res = await supabase.from('sedes').select('*').order('nombre');
            return res.data || [];
        },
    });

    const asesoresQuery = useQuery({
        queryKey: ['admin-asesores'],
        queryFn: async () => {
            const res = await supabase
                .from('asesores')
                .select('*, sedes(nombre)')
                .order('nombre');
            return res.data || [];
        },
    });

    const sedes = sedesQuery.data || [];
    const asesoresBase = asesoresQuery.data || [];

    const asesores = asesoresBase.filter((a: any) => {
        const coincideTexto = busqueda.trim() === '' ||
            a.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const coincideSede = sedeFiltro === 'todas' || a.sede_id === sedeFiltro;
        const coincideEstado = estadoFiltro === 'todos' ||
            (estadoFiltro === 'activo' && a.activo) ||
            (estadoFiltro === 'inactivo' && !a.activo);
        return coincideTexto && coincideSede && coincideEstado;
    });

    const totalPaginas = Math.max(1, Math.ceil(asesores.length / PORPAGINA));
    const asesoresPagina = asesores.slice((pagina - 1) * PORPAGINA, pagina * PORPAGINA);

    useEffect(() => {
        setPagina(1);
    }, [busqueda, sedeFiltro, estadoFiltro]);

    function abrirNuevo() {
        setForm(FORM_VACIO);
        setErrorMsg(null);
        setModalAbierto(true);
    }

    function abrirEditar(a: any) {
        setForm({
            id: a.id,
            nombre: a.nombre,
            sede_id: a.sede_id || '',
            activo: a.activo,
            foto_url: a.foto_url || null,
        });
        setErrorMsg(null);
        setModalAbierto(true);
    }

    function handleSeleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImagenTemporal(reader.result as string);
        reader.readAsDataURL(file);
    }

    async function subirFotoRecortada(blob: Blob) {
        setSubiendoFoto(true);
        try {
            const fotoAnterior = form.foto_url;

            const path = 'asesores/' + Date.now() + '.jpg';
            const res = await supabase.storage.from('fotos-asesores').upload(path, blob, {
                contentType: 'image/jpeg',
            });

            if (!res.error) {
                const publicUrlData = supabase.storage.from('fotos-asesores').getPublicUrl(path);
                setForm((f) => ({ ...f, foto_url: publicUrlData.data.publicUrl }));

                if (fotoAnterior) {
                    try {
                        const partes = fotoAnterior.split('/fotos-asesores/');
                        const pathAnterior = partes[1];
                        if (pathAnterior) {
                            await supabase.storage.from('fotos-asesores').remove([pathAnterior]);
                        }
                    } catch {
                        // si falla el borrado de la foto vieja, no bloqueamos el guardado
                    }
                }
            }
        } finally {
            setSubiendoFoto(false);
            setImagenTemporal(null);
        }
    }

    async function guardar() {
        if (!form.nombre.trim()) {
            setErrorMsg('El nombre es obligatorio.');
            return;
        }

        if (!form.sede_id) {
            setErrorMsg('Selecciona una sede.');
            return;
        }

        setGuardando(true);
        setErrorMsg(null);

        try {
            if (form.id) {
                const res = await supabase
                    .from('asesores')
                    .update({ nombre: form.nombre, sede_id: form.sede_id, activo: form.activo, foto_url: form.foto_url })
                    .eq('id', form.id);
                if (res.error) throw res.error;
            } else {
                const res = await supabase
                    .from('asesores')
                    .insert({ nombre: form.nombre, sede_id: form.sede_id, activo: form.activo, foto_url: form.foto_url });
                if (res.error) throw res.error;
            }

            queryClient.invalidateQueries({ queryKey: ['admin-asesores'] });
            setModalAbierto(false);
        } catch {
            setErrorMsg('Ocurrio un error al guardar.');
        } finally {
            setGuardando(false);
        }
    }

    async function eliminar() {
        if (!asesorAEliminar) return;
        setGuardando(true);
        try {
            const res = await supabase.from('asesores').delete().eq('id', asesorAEliminar.id);
            if (res.error) throw res.error;

            if (asesorAEliminar.foto_url) {
                try {
                    const partes = asesorAEliminar.foto_url.split('/fotos-asesores/');
                    const path = partes[1];
                    if (path) {
                        await supabase.storage.from('fotos-asesores').remove([path]);
                    }
                } catch {
                    // si falla el borrado de la foto, el asesor ya quedo eliminado
                }
            }

            queryClient.invalidateQueries({ queryKey: ['admin-asesores'] });
            setAsesorAEliminar(null);
        } catch {
            setErrorMsg('No se pudo eliminar. Puedes desactivarlo en su lugar.');
        } finally {
            setGuardando(false);
        }
    }

    async function exportarExcel() {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Distrikia';
        workbook.created = new Date();

        const hoja = workbook.addWorksheet('Asesores');
        hoja.columns = [
            { header: 'Nombre', key: 'nombre', width: 26 },
            { header: 'Sede', key: 'sede', width: 26 },
            { header: 'Estado', key: 'estado', width: 12 },
        ];

        const encabezado = hoja.getRow(1);
        encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF051620' } };

        asesores.forEach((a: any) => {
            hoja.addRow({
                nombre: a.nombre,
                sede: a.sedes?.nombre || '',
                estado: a.activo ? 'Activo' : 'Inactivo',
            });
        });

        hoja.views = [{ state: 'frozen', ySplit: 1 }];
        hoja.autoFilter = { from: 'A1', to: 'C1' };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.setAttribute('href', url);
        enlace.setAttribute('download', 'asesores-distrikia.xlsx');
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
    }

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-[#051620]">Asesores</h1>
                    <p className="text-sm text-[#666]">Gestiona los asesores comerciales por sede.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={exportarExcel}
                        disabled={asesores.length === 0}
                        className="inline-flex items-center gap-2 border border-[#e5e5e5] text-[#051620] text-sm font-medium px-4 py-2.5 rounded-sm cursor-pointer hover:border-[#051620] disabled:opacity-40"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportar
                    </button>
                    <button
                        type="button"
                        onClick={abrirNuevo}
                        className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030]"
                    >
                        + Nuevo asesor
                    </button>
                </div>
            </div>

            <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-6 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                    <label className="text-xs text-[#666] block mb-1">Buscar</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Nombre..."
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
                        setEstadoFiltro('todos');
                    }}
                    title="Restablecer filtros"
                    className="w-9 h-9 flex items-center justify-center border border-[#e5e5e5] rounded-sm hover:border-[#051620] cursor-pointer"
                >
                    <RotateCcw className="w-4 h-4 text-[#666]" />
                </button>

                <p className="text-xs text-[#999] whitespace-nowrap pb-2">
                    {asesores.length} de {asesoresBase.length}
                </p>
            </div>

            {asesoresQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : asesores.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay asesores que coincidan con los filtros.
                </p>
            ) : (
                <>
                    <div className="bg-white border border-[#e5e5e5] rounded-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-[#f8f8f8] text-left text-xs text-[#666] uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3">Foto</th>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Sede</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {asesoresPagina.map((a: any) => (
                                    <tr key={a.id} className="border-t border-[#e5e5e5]">
                                        <td className="px-4 py-3">
                                            {a.foto_url ? (
                                                <img src={a.foto_url} alt={a.nombre} className="w-9 h-9 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs text-[#999]">
                                                    {a.nombre ? a.nombre[0].toUpperCase() : '?'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-[#051620]">{a.nombre}</td>
                                        <td className="px-4 py-3 text-[#666]">{a.sedes?.nombre || '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={'text-xs font-medium px-2 py-1 rounded-full ' + (a.activo ? 'bg-green-100 text-green-700' : 'bg-[#f0f0f0] text-[#999]')}>
                                                {a.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => abrirEditar(a)}
                                                className="inline-flex items-center gap-1.5 text-xs font-medium bg-teal-50 text-teal-600 hover:bg-teal-100 cursor-pointer transition-colors px-3 py-1.5 rounded-sm mr-2"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAsesorAEliminar(a)}
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
                            {form.id ? 'Editar asesor' : 'Nuevo asesor'}
                        </p>

                        <div className="flex items-center justify-center mb-4">
                            <label htmlFor="foto-asesor" className="cursor-pointer relative group">
                                {form.foto_url ? (
                                    <img
                                        src={form.foto_url}
                                        alt="Foto del asesor"
                                        className="w-24 h-24 rounded-full object-cover border-2 border-[#e5e5e5]"
                                    />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-[#f8f8f8] border-2 border-dashed border-[#e5e5e5] flex items-center justify-center text-xs text-[#999] text-center px-2">
                                        {subiendoFoto ? 'Subiendo...' : 'Subir foto'}
                                    </div>
                                )}
                                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <span className="text-white text-xs opacity-0 group-hover:opacity-100">Cambiar</span>
                                </div>
                            </label>
                            <input
                                id="foto-asesor"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleSeleccionarFoto}
                            />
                        </div>

                        <div className="flex flex-col gap-3 mb-4">
                            <Input
                                type="text"
                                placeholder="Nombre completo"
                                value={form.nombre}
                                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                maxLength={50}
                            />

                            <select
                                value={form.sede_id}
                                onChange={(e) => setForm({ ...form, sede_id: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] appearance-none bg-white bg-no-repeat"
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                                    backgroundPosition: 'right 10px center',
                                }}
                            >
                                <option value="">Selecciona una sede</option>
                                {sedes.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.activo}
                                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                                    className="cursor-pointer"
                                />
                                <span className="text-sm text-[#051620]">Asesor activo</span>
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
            {asesorAEliminar && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Eliminar a {asesorAEliminar.nombre}?
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
                                onClick={() => { setAsesorAEliminar(null); setErrorMsg(null); }}
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

            {imagenTemporal && (
                <FotoCropModal
                    imagenSrc={imagenTemporal}
                    onCancelar={() => setImagenTemporal(null)}
                    onConfirmar={subirFotoRecortada}
                />
            )}
        </div>
    );
}
