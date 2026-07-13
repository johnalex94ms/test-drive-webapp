import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useBookingStore } from '../../store/bookingStore';
import { Button } from '../ui/Button';
import { Vehiculo360 } from './Vehiculo360';
import { obtenerImagenes360 } from '../../lib/vehiculoImagenes';

const CATEGORIAS = [
    { key: 'todos', label: 'Todos' },
    { key: 'automovil', label: 'Automóviles' },
    { key: 'camioneta', label: 'Camionetas' },
    { key: 'hibrido', label: 'Híbridos' },
    { key: 'electrico', label: 'Eléctricos' },
];

const FOTOS: Record<string, string> = {
    Picanto: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-picanto.png',
    Soluto: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2023-soluto.png',
    K3: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-k3.png',
    Sonet: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-sonet.png',
    Seltos: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-seltos.png',
    Sportage: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-sportage.png',
    EV3: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-ev3.png',
    EV6: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-ev6.png',
    EV2: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-ev2.png',
};

interface VehiculoConSpecs {
    id: string;
    modelo: string;
    categoria: string;
    velocidad_max?: string;
    motor?: string;
    potencia?: string;
    tipo_cambio?: string;
    imagenes_360?: string[];
    sede_id: string;
    activo: boolean;
}

interface ModeloAgrupado {
    modelo: string;
    categoria: string;
    velocidad_max?: string;
    motor?: string;
    potencia?: string;
    tipo_cambio?: string;
    imagenes_360?: string[];
    cantidadSedes: number;
}

export function StepVehiculo() {
    const { modelo, setModelo, setPaso } = useBookingStore();
    const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
    const [hoverModelo, setHoverModelo] = useState<string | null>(null);

    const { data: vehiculos = [], isLoading } = useQuery({
        queryKey: ['vehiculos'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vehiculos')
                .select('*')
                .eq('activo', true)
                .order('modelo');
            if (error) throw error;
            return data as VehiculoConSpecs[];
        },
    });

    const modelosAgrupados = useMemo(() => {
        const mapa: Record<string, VehiculoConSpecs[]> = {};
        vehiculos.forEach((v) => {
            if (!mapa[v.modelo]) mapa[v.modelo] = [];
            mapa[v.modelo].push(v);
        });

        return Object.entries(mapa).map(([nombreModelo, unidades]): ModeloAgrupado => {
            const representante = unidades[0];
            return {
                modelo: nombreModelo,
                categoria: representante.categoria,
                velocidad_max: representante.velocidad_max,
                motor: representante.motor,
                potencia: representante.potencia,
                tipo_cambio: representante.tipo_cambio,
                imagenes_360: representante.imagenes_360,
                cantidadSedes: unidades.length,
            };
        }).sort((a, b) => a.modelo.localeCompare(b.modelo));
    }, [vehiculos]);

    const filtrados = categoriaFiltro === 'todos'
        ? modelosAgrupados
        : modelosAgrupados.filter((m) => m.categoria === categoriaFiltro);

    const seleccionado = modelosAgrupados.find((m) => m.modelo === modelo);

    return (
        <div className="flex flex-col lg:flex-row gap-8">

            {/* Panel izquierdo — selector */}
            <div className="flex-1">
                <div className="mb-6">
                    <h2 className="font-display text-3xl font-bold text-[#051620]">
                        ¿Qué KIA quieres probar?
                    </h2>
                    <p className="text-[#666666] mt-1 text-sm">
                        Selecciona el modelo y descubre sus características.
                    </p>
                </div>

                {/* Filtros */}
                <div className="flex gap-2 flex-wrap mb-5">
                    {CATEGORIAS.map((cat) => (
                        <button
                            key={cat.key}
                            onClick={() => setCategoriaFiltro(cat.key)}
                            className={`px-4 py-1.5 text-xs font-medium transition-colors rounded-sm cursor-pointer ${categoriaFiltro === cat.key
                                ? 'bg-[#051620] text-white'
                                : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-44 bg-[#e5e5e5] rounded-sm animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {filtrados.map((m) => {
                            const imagenesLocal = obtenerImagenes360(m.modelo);
                            const fotoFinal = (m.imagenes_360 && m.imagenes_360.length > 0)
                                ? m.imagenes_360[0]
                                : (imagenesLocal.length > 0 ? imagenesLocal[0] : FOTOS[m.modelo]);
                            const activo = modelo === m.modelo;
                            const hover = hoverModelo === m.modelo;
                            return (
                                <div
                                    key={m.modelo}
                                    onClick={() => setModelo(m.modelo)}
                                    onMouseEnter={() => setHoverModelo(m.modelo)}
                                    onMouseLeave={() => setHoverModelo(null)}
                                    className={`
                    relative cursor-pointer rounded-sm border transition-all duration-200 overflow-hidden
                    ${activo
                                            ? 'border-[#051620] bg-[#051620]'
                                            : 'border-[#e5e5e5] bg-white hover:border-[#051620]'
                                        }
                  `}
                                >
                                    <div className={`h-44 flex items-center justify-center p-2 transition-colors ${activo ? 'bg-[#051620]' : 'bg-[#f8f8f8]'}`}>
                                        {fotoFinal ? (
                                            <img
                                                src={fotoFinal}
                                                alt={`KIA ${m.modelo}`}
                                                className={`h-full w-full object-contain transition-transform duration-300 ${hover || activo ? 'scale-110' : 'scale-100'}`}
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <span className="font-display text-3xl font-bold text-[#e5e5e5]">KIA</span>
                                        )}
                                    </div>

                                    <div className={`px-3 py-2.5 ${activo ? 'bg-[#051620]' : 'bg-white'}`}>
                                        <p className={`font-display text-base font-bold ${activo ? 'text-white' : 'text-[#051620]'}`}>
                                            {m.modelo}
                                        </p>
                                        <p className={`text-xs capitalize mt-0.5 ${activo ? 'text-white/50' : 'text-[#666]'}`}>
                                            {m.categoria}
                                        </p>
                                    </div>

                                    {activo && (
                                        <div className="absolute top-2 right-2 w-5 h-5 bg-white/10 border border-white/20 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs">✓</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Panel derecho — detalle del modelo seleccionado */}
            <div className="lg:w-80 lg:sticky lg:top-24 lg:self-start">
                {seleccionado ? (
                    <div className="bg-[#051620] rounded-sm overflow-hidden">
                        <div className="h-48 bg-[#0a2030] flex items-center justify-center p-6">
                            <Vehiculo360
                                modelo={seleccionado.modelo}
                                imagenes={seleccionado.imagenes_360}
                                fallbackUrl={FOTOS[seleccionado.modelo]}
                                className="h-full w-full"
                            />
                        </div>

                        <div className="px-5 pt-4 pb-2 border-b border-white/10">
                            <p className="text-white/50 text-xs uppercase tracking-widest">KIA</p>
                            <h3 className="font-display text-2xl font-bold text-white mt-0.5">
                                {seleccionado.modelo}
                            </h3>
                            <p className="text-white/40 text-xs capitalize mt-0.5">{seleccionado.categoria}</p>
                        </div>

                        <div className="px-5 py-4 grid grid-cols-2 gap-3">
                            {[
                                { label: 'Motor', valor: seleccionado.motor },
                                { label: 'Potencia', valor: seleccionado.potencia },
                                { label: 'Vel. máx.', valor: seleccionado.velocidad_max },
                                { label: 'Cambios', valor: seleccionado.tipo_cambio },
                            ].map((spec) => (
                                spec.valor && (
                                    <div key={spec.label} className="bg-white/5 rounded-sm px-3 py-2.5">
                                        <p className="text-white/40 text-xs">{spec.label}</p>
                                        <p className="text-white font-medium text-sm mt-0.5">{spec.valor}</p>
                                    </div>
                                )
                            ))}
                        </div>

                        <div className="px-5 pb-5">
                            <Button
                                onClick={() => setPaso(2)}
                                variant="primary"
                                className="w-full"
                                size="lg"
                            >
                                Continuar con {seleccionado.modelo} →
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#051620] rounded-sm p-10 text-center">
                        <div className="text-5xl mb-3 text-white/20 font-display font-bold">KIA</div>
                        <p className="text-white/50 text-sm">
                            Selecciona un vehículo para ver sus características
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}