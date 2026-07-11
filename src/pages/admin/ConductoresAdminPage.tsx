import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { FotoCropModal } from '../../components/admin/FotoCropModal';
import { Pencil, Trash2 } from 'lucide-react';

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
    cargo: 'Experto de producto KIA',
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
    const conductores = conductoresQuery.data || [];

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
            cargo: c.cargo || 'Experto de producto KIA',
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

        setGuardando(true);
        setErrorMsg(null);

        try {
            let conductorId = form.id;

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
            }

            await supabase.from('conductores_sedes').delete().eq('conductor_id', conductorId);

            if (form.sedesSeleccionadas.length > 0) {
                const filas = form.sedesSeleccionadas.map((sedeId) => ({ conductor_id: conductorId, sede_id: sedeId }));
                const res = await supabase.from('conductores_sedes').insert(filas);
                if (res.error) throw res.error;
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

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-[#051620]">Conductores</h1>
                    <p className="text-sm text-[#666]">Gestiona los expertos y su asignacion por sede.</p>
                </div>
                <button
                    type="button"
                    onClick={abrirNuevo}
                    className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030]"
                >
                    + Nuevo conductor
                </button>
            </div>

            {conductoresQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : conductores.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay conductores creados todavia.
                </p>
            ) : (
                <div className="bg-white border border-[#e5e5e5] rounded-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-[#f8f8f8] text-left text-xs text-[#666] uppercase tracking-wide">
                            <tr>
                                <th className="px-4 py-3">Foto</th>
                                <th className="px-4 py-3">Nombre</th>
                                <th className="px-4 py-3">Correo</th>
                                <th className="px-4 py-3">Cargo</th>
                                <th className="px-4 py-3">Sedes</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {conductores.map((c: any) => (
                                <tr key={c.id} className="border-t border-[#e5e5e5]">
                                    <td className="px-4 py-3">
                                        {c.foto_url ? (
                                            <img src={c.foto_url} alt={c.nombre} className="w-9 h-9 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs text-[#999]">
                                                {c.nombre ? c.nombre[0].toUpperCase() : '?'}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-[#051620]">{c.nombre}</td>
                                    <td className="px-4 py-3 text-[#666]">{c.correo}</td>
                                    <td className="px-4 py-3 text-[#666]">{c.cargo}</td>
                                    <td className="px-4 py-3 text-[#666]">
                                        {(c.conductores_sedes || []).map((cs: any) => cs.sedes?.nombre).filter(Boolean).join(', ') || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={'text-xs font-medium px-2 py-1 rounded-full ' + (c.activo ? 'bg-green-100 text-green-700' : 'bg-[#f0f0f0] text-[#999]')}>
                                            {c.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <button
                                            type="button"
                                            onClick={() => abrirEditar(c)}
                                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-teal-50 text-teal-600 hover:bg-teal-100 cursor-pointer transition-colors px-3 py-1.5 rounded-sm mr-2"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConductorAEliminar(c)}
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
                            <input
                                type="text"
                                placeholder="Nombre completo"
                                value={form.nombre}
                                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                            />
                            <input
                                type="email"
                                placeholder="Correo"
                                value={form.correo}
                                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                            />
                            <input
                                type="text"
                                placeholder="Cargo"
                                value={form.cargo}
                                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
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