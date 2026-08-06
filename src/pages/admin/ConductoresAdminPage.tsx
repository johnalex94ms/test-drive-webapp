import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, RotateCcw, FileSpreadsheet, KeyRound } from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../../lib/supabaseClient';
import { FotoCropModal } from '../../components/admin/FotoCropModal';
import { Input } from '../../components/ui/Input';

const PORPAGINA = 10;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

interface ConductorForm {
    id?: string;
    nombre: string;
    correo: string;
    cargo: string;
    activo: boolean;
    foto_url: string | null;
    sedesSeleccionadas: string[];
}

const FORM_VACIO: ConductorForm = {
    nombre: '',
    correo: '',
    cargo: '',
    activo: true,
    foto_url: null,
    sedesSeleccionadas: [],
};

export default function ConductoresAdminPage() {
    const [modalAbierto, setModalAbierto] = useState(false);
    const [form, setForm] = useState<ConductorForm>(FORM_VACIO);
    const [guardando, setGuardando] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [conductorAEliminar, setConductorAEliminar] = useState<any>(null);
    const queryClient = useQueryClient();
    const [imagenTemporal, setImagenTemporal] = useState<string | null>(null);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [sedeFiltro, setSedeFiltro] = useState('todas');
    const [estadoFiltro, setEstadoFiltro] = useState('todos');
    const [pagina, setPagina] = useState(1);
    const [conductorAResetear, setConductorAResetear] = useState<any>(null);
    const [reseteando, setReseteando] = useState(false);
    const [resetExitoso, setResetExitoso] = useState(false);

    const sedesQuery = useQuery({
        queryKey: ['admin-sedes-lista'],
        queryFn: async () => {
            const res = await supabase.from('sedes').select('*').order('nombre');
            return res.data || [];
        },
    });

    const conductoresQuery = useQuery({
        queryKey: ['admin-conductores'],
        queryFn: async () => {
            const res = await supabase
                .from('conductores')
                .select('*, conductores_sedes(sede_id, sedes(nombre))')
                .order('nombre');
            return res.data || [];
        },
    });

    const sedes = sedesQuery.data || [];
    const conductoresBase = conductoresQuery.data || [];

    const conductores = conductoresBase.filter((c: any) => {
        const coincideTexto = busqueda.trim() === '' ||
            c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            c.correo.toLowerCase().includes(busqueda.toLowerCase());
        const coincideSede = sedeFiltro === 'todas' ||
            (c.conductores_sedes || []).some((cs: any) => cs.sede_id === sedeFiltro);
        const coincideEstado = estadoFiltro === 'todos' ||
            (estadoFiltro === 'activo' && c.activo) ||
            (estadoFiltro === 'inactivo' && !c.activo);
        return coincideTexto && coincideSede && coincideEstado;
    });

    const totalPaginas = Math.max(1, Math.ceil(conductores.length / PORPAGINA));
    const conductoresPagina = conductores.slice((pagina - 1) * PORPAGINA, pagina * PORPAGINA);

    useEffect(() => {
        setPagina(1);
    }, [busqueda, sedeFiltro, estadoFiltro]);

    function abrirNuevo() {
        setForm(FORM_VACIO);
        setErrorMsg(null);
        setModalAbierto(true);
    }

    function abrirEditar(c: any) {
        setForm({
            id: c.id,
            nombre: c.nombre,
            correo: c.correo,
            cargo: c.cargo || '',
            activo: c.activo,
            foto_url: c.foto_url || null,
            sedesSeleccionadas: (c.conductores_sedes || []).map((cs: any) => cs.sede_id),
        });
        setErrorMsg(null);
        setModalAbierto(true);
    }

    function toggleSede(sedeId: string) {
        setForm((f) => {
            const yaSel = f.sedesSeleccionadas.includes(sedeId);
            return {
                ...f,
                sedesSeleccionadas: yaSel
                    ? f.sedesSeleccionadas.filter((id) => id !== sedeId)
                    : [...f.sedesSeleccionadas, sedeId],
            };
        });
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

            const path = 'conductores/' + Date.now() + '.jpg';
            const res = await supabase.storage.from('fotos-conductores').upload(path, blob, {
                contentType: 'image/jpeg',
            });

            if (!res.error) {
                const publicUrlData = supabase.storage.from('fotos-conductores').getPublicUrl(path);
                setForm((f) => ({ ...f, foto_url: publicUrlData.data.publicUrl }));

                if (fotoAnterior) {
                    try {
                        const partes = fotoAnterior.split('/fotos-conductores/');
                        const pathAnterior = partes[1];
                        if (pathAnterior) {
                            await supabase.storage.from('fotos-conductores').remove([pathAnterior]);
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
        if (!form.nombre.trim() || !form.correo.trim()) {
            setErrorMsg('Nombre y correo son obligatorios.');
            return;
        }

        if (!REGEX_CORREO.test(form.correo.trim())) {
            setErrorMsg('Ingresa un correo electronico valido.');
            return;
        }

        setGuardando(true);
        setErrorMsg(null);

        try {
            let conductorId = form.id;
            let esNuevo = false;

            if (conductorId) {
                const res = await supabase
                    .from('conductores')
                    .update({ nombre: form.nombre, correo: form.correo, cargo: form.cargo, activo: form.activo, foto_url: form.foto_url })
                    .eq('id', conductorId);
                if (res.error) throw res.error;
            } else {
                const res = await supabase
                    .from('conductores')
                    .insert({ nombre: form.nombre, correo: form.correo, cargo: form.cargo, activo: form.activo, foto_url: form.foto_url })
                    .select()
                    .single();
                if (res.error) throw res.error;
                conductorId = res.data.id;
                esNuevo = true;
            }

            await supabase.from('conductores_sedes').delete().eq('conductor_id', conductorId);

            if (form.sedesSeleccionadas.length > 0) {
                const filas = form.sedesSeleccionadas.map((sedeId) => ({ conductor_id: conductorId, sede_id: sedeId }));
                const res = await supabase.from('conductores_sedes').insert(filas);
                if (res.error) throw res.error;
            }

            if (esNuevo) {
                try {
                    const sesionActual = await supabase.auth.getSession();
                    await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/crear-conductor', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: 'Bearer ' + sesionActual.data.session?.access_token,
                        },
                        body: JSON.stringify({ conductorId, nombre: form.nombre, correo: form.correo }),
                    });
                } catch {
                    // si falla la creacion de la cuenta, el conductor ya quedo guardado, se puede reintentar despues
                }
            }

            queryClient.invalidateQueries({ queryKey: ['admin-conductores'] });
            setModalAbierto(false);
        } catch (err: any) {
            setErrorMsg(err.code === '23505' ? 'Ese correo ya esta registrado.' : 'Ocurrio un error al guardar.');
        } finally {
            setGuardando(false);
        }
    }

    async function eliminar() {
        if (!conductorAEliminar) return;
        setGuardando(true);
        try {
            const res = await supabase.from('conductores').delete().eq('id', conductorAEliminar.id);
            if (res.error) throw res.error;
            queryClient.invalidateQueries({ queryKey: ['admin-conductores'] });
            setConductorAEliminar(null);
        } catch {
            setErrorMsg('No se pudo eliminar, tiene pruebas de ruta asociadas. Puedes desactivarlo en su lugar.');
        } finally {
            setGuardando(false);
        }
    }

    async function resetearClave() {
        if (!conductorAResetear) return;
        setReseteando(true);
        setErrorMsg(null);

        try {
            const sesionActual = await supabase.auth.getSession();
            const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/crear-conductor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + sesionActual.data.session?.access_token,
                },
                body: JSON.stringify({
                    conductorId: conductorAResetear.id,
                    nombre: conductorAResetear.nombre,
                    correo: conductorAResetear.correo,
                    authUserId: conductorAResetear.auth_user_id,
                }),
            });

            if (!res.ok) throw new Error('fallo');

            setResetExitoso(true);
            queryClient.invalidateQueries({ queryKey: ['admin-conductores'] });
            setTimeout(() => {
                setConductorAResetear(null);
                setResetExitoso(false);
            }, 2500);
        } catch {
            setErrorMsg('No se pudo restablecer la contraseña, intenta de nuevo.');
        } finally {
            setReseteando(false);
        }
    }

    async function exportarExcel() {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Distrikia';
        workbook.created = new Date();

        const hoja = workbook.addWorksheet('Conductores');
        hoja.columns = [
            { header: 'Nombre', key: 'nombre', width: 26 },
            { header: 'Correo', key: 'correo', width: 30 },
            { header: 'Cargo', key: 'cargo', width: 24 },
            { header: 'Sedes', key: 'sedes', width: 30 },
            { header: 'Estado', key: 'estado', width: 12 },
        ];

        const encabezado = hoja.getRow(1);
        encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF051620' } };

        conductores.forEach((c: any) => {
            hoja.addRow({
                nombre: c.nombre,
                correo: c.correo,
                cargo: c.cargo || '',
                sedes: (c.conductores_sedes || []).map((cs: any) => cs.sedes?.nombre).filter(Boolean).join(', '),
                estado: c.activo ? 'Activo' : 'Inactivo',
            });
        });

        hoja.views = [{ state: 'frozen', ySplit: 1 }];
        hoja.autoFilter = { from: 'A1', to: 'E1' };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.setAttribute('href', url);
        enlace.setAttribute('download', 'conductores-distrikia.xlsx');
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
    }

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-[#051620]">Conductores</h1>
                    <p className="text-sm text-[#666]">Gestiona los expertos y su asignacion por sede.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={exportarExcel}
                        disabled={conductores.length === 0}
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
                        + Nuevo conductor
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
                            placeholder="Nombre o correo..."
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
            </div>

            {conductoresQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : conductores.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay conductores que coincidan con los filtros.
                </p>
            ) : (
                <>
                    <div className="bg-white border border-[#e5e5e5] rounded-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-[#f8f8f8] text-left text-xs text-[#666] uppercase tracking-wide">
                                <tr>
                                    <th className="px-3 py-2.5">Foto</th>
                                    <th className="px-3 py-2.5">Nombre</th>
                                    <th className="px-3 py-2.5">Correo</th>
                                    <th className="px-3 py-2.5">Cargo</th>
                                    <th className="px-3 py-2.5">Sedes</th>
                                    <th className="px-3 py-2.5">Estado</th>
                                    <th className="px-3 py-2.5"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {conductoresPagina.map((c: any) => (
                                    <tr key={c.id} className="border-t border-[#e5e5e5]">
                                        <td className="px-3 py-2.5">
                                            {c.foto_url ? (
                                                <img src={c.foto_url} alt={c.nombre} className="w-9 h-9 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs text-[#999]">
                                                    {c.nombre ? c.nombre[0].toUpperCase() : '?'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 font-medium text-[#051620]">{c.nombre}</td>
                                        <td className="px-3 py-2.5 text-[#666]">{c.correo}</td>
                                        <td className="px-3 py-2.5 text-[#666]">{c.cargo}</td>
                                        <td className="px-3 py-2.5 text-[#666]">
                                            {(c.conductores_sedes || []).map((cs: any) => cs.sedes?.nombre).filter(Boolean).join(', ') || '—'}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={'text-xs font-medium px-2 py-1 rounded-full ' + (c.activo ? 'bg-green-100 text-green-700' : 'bg-[#f0f0f0] text-[#999]')}>
                                                {c.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => setConductorAResetear(c)}
                                                title="Restablecer contraseña"
                                                className="inline-flex items-center justify-center bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer transition-colors p-1.5 rounded-sm mr-1.5"
                                            >
                                                <KeyRound className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => abrirEditar(c)}
                                                title="Editar"
                                                className="inline-flex items-center justify-center bg-teal-50 text-teal-600 hover:bg-teal-100 cursor-pointer transition-colors p-1.5 rounded-sm mr-1.5"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConductorAEliminar(c)}
                                                title="Eliminar"
                                                className="inline-flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer transition-colors p-1.5 rounded-sm"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-[#999]">
                            {totalPaginas > 1 ? 'Pagina ' + pagina + ' de ' + totalPaginas + ' | ' : ''}{conductores.length} de {conductoresBase.length}
                        </p>
                        {totalPaginas > 1 && (
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
                        )}
                    </div>
                </>
            )}

            {/* Modal crear/editar */}
            {modalAbierto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <p className="font-display text-lg font-bold text-[#051620] mb-4">
                            {form.id ? 'Editar conductor' : 'Nuevo conductor'}
                        </p>

                        <div className="flex items-center justify-center mb-4">
                            <label htmlFor="foto-conductor" className="cursor-pointer relative group">
                                {form.foto_url ? (
                                    <img
                                        src={form.foto_url}
                                        alt="Foto del conductor"
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
                                id="foto-conductor"
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
                            <Input
                                type="email"
                                placeholder="Correo"
                                value={form.correo}
                                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                            />
                            <Input
                                type="text"
                                placeholder="Cargo (ej. Experto de producto KIA)"
                                value={form.cargo}
                                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                                maxLength={50}
                            />

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.activo}
                                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                                    className="cursor-pointer"
                                />
                                <span className="text-sm text-[#051620]">Conductor activo</span>
                            </label>
                        </div>

                        <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-2">
                            Sedes asignadas
                        </p>
                        <div className="flex flex-col gap-2 mb-4 max-h-40 overflow-y-auto">
                            {sedes.map((s: any) => (
                                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.sedesSeleccionadas.includes(s.id)}
                                        onChange={() => toggleSede(s.id)}
                                        className="cursor-pointer"
                                    />
                                    <span className="text-sm text-[#051620]">{s.nombre}</span>
                                </label>
                            ))}
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
            {conductorAEliminar && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Eliminar a {conductorAEliminar.nombre}?
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
                                onClick={() => { setConductorAEliminar(null); setErrorMsg(null); }}
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

            {/* Modal restablecer contraseña */}
            {conductorAResetear && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6">
                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            Restablecer contraseña de {conductorAResetear.nombre}?
                        </p>
                        <p className="text-sm text-[#666] mb-6">
                            Se generara una nueva contraseña temporal y se le enviara por correo. Debera cambiarla al ingresar de nuevo.
                        </p>
                        {resetExitoso ? (
                            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-sm px-4 py-3">
                                Contraseña restablecida y correo enviado.
                            </p>
                        ) : (
                            <>
                                {errorMsg && (
                                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 mb-4">
                                        {errorMsg}
                                    </p>
                                )}
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setConductorAResetear(null); setErrorMsg(null); }}
                                        className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={reseteando}
                                        onClick={resetearClave}
                                        className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                                    >
                                        {reseteando ? 'Restableciendo...' : 'Si, restablecer'}
                                    </button>
                                </div>
                            </>
                        )}
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