import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { DIAS_SEMANA_PICO_PLACA, type DiaPicoPlaca } from '../../lib/picoPlaca';

const DIGITOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function PicoPlacaAdminPage() {
    const [config, setConfig] = useState<Record<number, number[]>>({});
    const [guardando, setGuardando] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);
    const queryClient = useQueryClient();

    const configQuery = useQuery({
        queryKey: ['pico-placa-config'],
        queryFn: async () => {
            const res = await supabase.from('pico_placa_config').select('*').order('dia_semana');
            return (res.data || []) as DiaPicoPlaca[];
        },
    });

    useEffect(() => {
        if (!configQuery.data) return;
        const mapa: Record<number, number[]> = {};
        DIAS_SEMANA_PICO_PLACA.forEach((d) => {
            mapa[d.value] = configQuery.data.find((c) => c.dia_semana === d.value)?.digitos || [];
        });
        setConfig(mapa);
    }, [configQuery.data]);

    function toggleDigito(dia: number, digito: number) {
        setGuardadoOk(false);
        setConfig((prev) => {
            const actuales = prev[dia] || [];
            const yaSel = actuales.includes(digito);
            return {
                ...prev,
                [dia]: yaSel ? actuales.filter((d) => d !== digito) : [...actuales, digito],
            };
        });
    }

    async function guardar() {
        setGuardando(true);
        try {
            const filas = DIAS_SEMANA_PICO_PLACA.map((d) => ({
                dia_semana: d.value,
                digitos: config[d.value] || [],
            }));
            const res = await supabase.from('pico_placa_config').upsert(filas, { onConflict: 'dia_semana' });
            if (res.error) throw res.error;
            queryClient.invalidateQueries({ queryKey: ['pico-placa-config'] });
            setGuardadoOk(true);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">Pico y placa</h1>
                <p className="text-sm text-[#666]">
                    Configura que ultimo digito de placa aplica cada dia. Los vehiculos con placa terminada en esos digitos quedan bloqueados automaticamente ese dia en el agendamiento.
                </p>
            </div>

            {configQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : (
                <div className="bg-white border border-[#e5e5e5] rounded-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-[#f8f8f8] text-left text-xs text-[#666] uppercase tracking-wide">
                            <tr>
                                <th className="px-4 py-3">Dia</th>
                                <th className="px-4 py-3">Digitos restringidos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DIAS_SEMANA_PICO_PLACA.map((d) => (
                                <tr key={d.value} className="border-t border-[#e5e5e5]">
                                    <td className="px-4 py-3 font-medium text-[#051620] w-32">{d.label}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2 flex-wrap">
                                            {DIGITOS.map((digito) => {
                                                const activo = (config[d.value] || []).includes(digito);
                                                return (
                                                    <button
                                                        key={digito}
                                                        type="button"
                                                        onClick={() => toggleDigito(d.value, digito)}
                                                        className={
                                                            'w-9 h-9 rounded-sm text-sm font-medium cursor-pointer transition-colors ' +
                                                            (activo
                                                                ? 'bg-[#051620] text-white'
                                                                : 'bg-[#f8f8f8] text-[#666] hover:bg-[#e5e5e5]')
                                                        }
                                                    >
                                                        {digito}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex items-center gap-4 mt-6">
                <button
                    type="button"
                    disabled={guardando}
                    onClick={guardar}
                    className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                >
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
                {guardadoOk && (
                    <p className="text-sm text-green-700">Configuracion guardada.</p>
                )}
            </div>
        </div>
    );
}
