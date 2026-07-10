import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useBookingStore } from '../../store/bookingStore';
import type { Zona } from '../../lib/types';
import { MapaCobertura } from './MapaCobertura';
import { Button } from '../ui/Button';

export function StepZona() {
    const { vehiculo, zona, setZona, setPaso } = useBookingStore();
    const [municipioSel, setMunicipioSel] = useState<Zona | null>(null);
    const [mostrarMapa, setMostrarMapa] = useState(false);

    const { data: zonas = [], isLoading } = useQuery({
        queryKey: ['zonas'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('zonas')
                .select('*')
                .order('municipio');
            if (error) throw error;
            return data as Zona[];
        },
    });

    const zonasConCobertura = zonas.filter((z) => z.tiene_cobertura);
    const zonasSinCobertura = zonas.filter((z) => !z.tiene_cobertura);

    function seleccionarMunicipio(z: Zona) {
        setMunicipioSel(z);
        setMostrarMapa(false);
        setZona(null);
    }

    function handleCobertura(tiene: boolean, dir: string, _coords: [number, number]) {
        if (tiene) {
            setZona({
                id: municipioSel?.id ?? 'domicilio',
                nombre: dir,
                municipio: municipioSel?.municipio ?? 'Medellín',
                tiene_cobertura: true,
                sede_id: municipioSel?.sede_id ?? '',
            });
        } else {
            setZona({
                id: 'sede',
                nombre: 'Distrikia La 10',
                municipio: 'Medellín',
                tiene_cobertura: true,
                sede_id: '',
            });
        }
    }

    return (
        <div className="w-full">
            <div className="mb-8">
                <h2 className="font-display text-3xl font-bold text-[#051620]">
                    ¿Dónde te recogemos?
                </h2>
                <p className="text-[#666666] mt-2">
                    Selecciona tu municipio y luego confirma tu dirección exacta en el mapa
                    {vehiculo && ' para tu prueba del KIA ' + vehiculo.modelo}.
                </p>
            </div>

            {/* Paso 1 — Municipio */}
            {!mostrarMapa && (
                <>
                    {isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-20 bg-[#e5e5e5] rounded-sm animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
                                Con cobertura — te recogemos
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                {zonasConCobertura.map((z) => (
                                    <div
                                        key={z.id}
                                        onClick={() => seleccionarMunicipio(z)}
                                        className={`
                      cursor-pointer rounded-sm border p-4 transition-all duration-150
                      ${municipioSel?.id === z.id
                                                ? 'bg-[#051620] border-[#051620]'
                                                : 'bg-white border-[#e5e5e5] hover:border-[#051620]'
                                            }
                    `}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${municipioSel?.id === z.id ? 'bg-white' : 'bg-green-500'}`} />
                                            <p className={`font-semibold text-sm ${municipioSel?.id === z.id ? 'text-white' : 'text-[#051620]'}`}>
                                                {z.municipio}
                                            </p>
                                        </div>
                                        <p className={`text-xs ml-4 ${municipioSel?.id === z.id ? 'text-white/50' : 'text-[#666]'}`}>
                                            Te recogemos
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {zonasSinCobertura.length > 0 && (
                                <>
                                    <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
                                        Sin cobertura aún — visítanos en sede
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                        {zonasSinCobertura.map((z) => (
                                            <div
                                                key={z.id}
                                                className="rounded-sm border border-[#e5e5e5] p-4 opacity-50 cursor-not-allowed bg-[#f8f8f8]"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2 h-2 rounded-full bg-[#ccc] flex-shrink-0" />
                                                    <p className="font-semibold text-sm text-[#666]">{z.municipio}</p>
                                                </div>
                                                <p className="text-xs ml-4 text-[#999]">Próximamente</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Opción sede */}
                            <div className="border border-[#e5e5e5] rounded-sm p-4 mb-6 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-sm text-[#051620]">¿Prefieres ir a la sede?</p>
                                    <p className="text-xs text-[#666] mt-0.5">Distrikia La 10 · Medellín</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setZona({ id: 'sede', nombre: 'Distrikia La 10', municipio: 'Medellín', tiene_cobertura: true, sede_id: '' });
                                        setMunicipioSel(null);
                                    }}
                                    className={`text-xs font-medium px-3 py-2 rounded-sm border transition-colors cursor-pointer ${zona?.id === 'sede'
                                        ? 'bg-[#051620] text-white border-[#051620]'
                                        : 'border-[#e5e5e5] text-[#051620] hover:border-[#051620]'
                                        }`}
                                >
                                    {zona?.id === 'sede' ? '✓ Seleccionado' : 'Ir a la sede'}
                                </button>
                            </div>

                            {/* CTA confirmar municipio */}
                            {municipioSel && (
                                <div className="bg-[#051620] text-white rounded-sm p-4 mb-6 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-sm">{municipioSel.municipio} tiene cobertura</p>
                                        <p className="text-white/50 text-xs mt-0.5">
                                            Ahora confirma tu dirección exacta en el mapa
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setMostrarMapa(true)}
                                        className="bg-white text-[#051620] text-xs font-semibold px-4 py-2 rounded-sm hover:bg-white/90 transition-colors cursor-pointer"
                                    >
                                        Ver en mapa →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Paso 2 — Mapa con dirección exacta */}
            {mostrarMapa && municipioSel && (
                <>
                    <div className="flex items-center gap-3 mb-5">
                        <button
                            onClick={() => { setMostrarMapa(false); setZona(null); }}
                            className="text-sm text-[#666] hover:text-[#051620] transition-colors cursor-pointer"
                        >
                            ← Cambiar municipio
                        </button>
                        <span className="text-[#e5e5e5]">|</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <p className="text-sm font-medium text-[#051620]">{municipioSel.municipio}</p>
                        </div>
                    </div>
                    <MapaCobertura onCobertura={handleCobertura} />
                </>
            )}

            {/* Navegación */}
            <div className="flex items-center justify-between mt-6">
                <button
                    onClick={() => setPaso(1)}
                    className="text-sm text-[#666] hover:text-[#051620] transition-colors cursor-pointer"
                >
                    ← Cambiar vehículo
                </button>
                {zona && (
                    <Button onClick={() => setPaso(3)} variant="primary">
                        Continuar →
                    </Button>
                )}
            </div>
        </div>
    );
}