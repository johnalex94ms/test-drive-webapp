import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, X, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const CATEGORIAS = [
    { value: 'automovil', label: 'Automovil' },
    { value: 'camioneta', label: 'Camioneta' },
    { value: 'hibrido', label: 'Hibrido' },
    { value: 'electrico', label: 'Electrico' },
];

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
        tipo_cambio: 'Automatico',
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
    const vehiculos = vehiculosQuery.data || [];

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
            tipo_cambio: v.tipo_cambio || 'Automatico',
            activo: v.activo,
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

            {vehiculosQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : vehiculos.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay vehiculos creados todavia.
                </p>
            ) : (
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
                            {vehiculos.map((v: any) => (
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
                                className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                            >
                                {sedes.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Modelo (ej. Sportage)"
                                    value={form.modelo}
                                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                                />
                                <input
                                    type="text"
                                    placeholder="Placa"
                                    value={form.placa}
                                    onChange={(e) => setForm({ ...form, placa: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                                />
                            </div>

                            <select
                                value={form.categoria}
                                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                            >
                                {CATEGORIAS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Motor (ej. 1.6T)"
                                    value={form.motor}
                                    onChange={(e) => setForm({ ...form, motor: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                                />
                                <input
                                    type="text"
                                    placeholder="Potencia (ej. 180 hp)"
                                    value={form.potencia}
                                    onChange={(e) => setForm({ ...form, potencia: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Vel. maxima (ej. 200 km/h)"
                                    value={form.velocidad_max}
                                    onChange={(e) => setForm({ ...form, velocidad_max: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
                                />
                                <input
                                    type="text"
                                    placeholder="Cambios (ej. Automatico)"
                                    value={form.tipo_cambio}
                                    onChange={(e) => setForm({ ...form, tipo_cambio: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620]"
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