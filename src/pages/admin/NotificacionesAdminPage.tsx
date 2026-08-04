import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { estaListoParaVenta, diasParaVenta } from '../../lib/vidaUtilVehiculo';

export default function NotificacionesAdminPage() {
    const queryClient = useQueryClient();

    const vehiculosQuery = useQuery({
        queryKey: ['admin-vehiculos'],
        queryFn: async () => {
            const res = await supabase.from('vehiculos').select('*, sedes(nombre)').order('modelo');
            return res.data || [];
        },
    });

    const vehiculos = vehiculosQuery.data || [];
    const listosParaVenta = vehiculos
        .filter((v: any) => v.activo && estaListoParaVenta(v.fecha_ingreso))
        .sort((a: any, b: any) => diasParaVenta(a.fecha_ingreso) - diasParaVenta(b.fecha_ingreso));

    async function marcarComoVendido(id: string) {
        await supabase.from('vehiculos').update({ activo: false }).eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['admin-vehiculos'] });
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">Notificaciones</h1>
                <p className="text-sm text-[#666]">
                    Alertas de la plataforma sobre eventos que requieren tu atencion.
                </p>
            </div>

            {vehiculosQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : listosParaVenta.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No hay alertas pendientes por ahora.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {listosParaVenta.map((v: any) => {
                        const diasVencido = Math.abs(diasParaVenta(v.fecha_ingreso));
                        return (
                            <div
                                key={v.id}
                                className="bg-white border border-red-100 rounded-sm p-4 flex items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                        <Tag className="w-4 h-4 text-red-700" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-[#051620]">
                                            KIA {v.modelo} — {v.placa} esta listo para vender
                                        </p>
                                        <p className="text-xs text-[#666] mt-0.5">
                                            Ingreso el {v.fecha_ingreso} · {v.sedes?.nombre || 'sin sede'} · cumplio los 3 meses hace {diasVencido} dia{diasVencido === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => marcarComoVendido(v.id)}
                                    className="text-xs font-medium bg-[#051620] text-white px-4 py-2 rounded-sm cursor-pointer hover:bg-[#0a2030] whitespace-nowrap"
                                >
                                    Marcar como vendido
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
