import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useBookingStore } from '../../store/bookingStore';
import { diasBloqueadosPorPlaca, type DiaPicoPlaca } from '../../lib/picoPlaca';

const CATEGORIAS = [
    { key: 'todos', label: 'Todos' },
    { key: 'automovil', label: 'Automóviles' },
    { key: 'camioneta', label: 'Camionetas' },
    { key: 'hibrido', label: 'Híbridos' },
    { key: 'electrico', label: 'Eléctricos' },
];

const FOTOS: Record<string, string> = {
    Picanto: 'https://www.kia.com/content/dam/kwcms/kce/global/en/assets/contents/utility/find-a-car/carcard/2024-picanto.png',
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
    placa: string;
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
    cantidadUnidades: number;
    enPicoPlacaHoy: number;
}

export function StepVehiculo() {
    const { setModelo, setPaso } = useBookingStore();
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

    const picoPlacaConfigQuery = useQuery({
        queryKey: ['pico-placa-config'],
        queryFn: async () => {
            const res = await supabase.from('pico_placa_config').select('*').order('dia_semana');
            return (res.data || []) as DiaPicoPlaca[];
        },
    });
    const picoPlacaConfig = picoPlacaConfigQuery.data || [];
    const diaSemanaHoy = new Date().getDay();

    const modelosAgrupados = useMemo(() => {
        const mapa: Record<string, VehiculoConSpecs[]> = {};
        vehiculos.forEach((v) => {
            if (!mapa[v.modelo]) mapa[v.modelo] = [];
            mapa[v.modelo].push(v);
        });

        return Object.entries(mapa).map(([nombreModelo, unidades]): ModeloAgrupado => {
            const representante = unidades[0];
            const enPicoPlacaHoy = unidades.filter((v) =>
                diasBloqueadosPorPlaca(v.placa, picoPlacaConfig, v.categoria).includes(diaSemanaHoy)
            ).length;
            return {
                modelo: nombreModelo,
                categoria: representante.categoria,
                velocidad_max: representante.velocidad_max,
                motor: representante.motor,
                potencia: representante.potencia,
                tipo_cambio: representante.tipo_cambio,
                imagenes_360: representante.imagenes_360,
                cantidadSedes: unidades.length,
                cantidadUnidades: unidades.length,
                enPicoPlacaHoy,
            };
        }).sort((a, b) => a.modelo.localeCompare(b.modelo));
    }, [vehiculos, picoPlacaConfig, diaSemanaHoy]);

    const filtrados = categoriaFiltro === 'todos'
        ? modelosAgrupados
        : modelosAgrupados.filter((m) => m.categoria === categoriaFiltro);

    function seleccionarModelo(modelo: string) {
        setModelo(modelo);
        setPaso(2);
    }

    return (
        <div>
            <div className="mb-6">
                <h2 className="font-display text-3xl font-bold text-[#051620]">
                    ¿Qué KIA quieres probar?
                </h2>
                <p className="text-[#666666] mt-1 text-sm">
                    Selecciona el modelo y te asignamos un experto.
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-44 bg-[#e5e5e5] rounded-sm animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filtrados.map((m) => {
                        const fotoFinal = (m.imagenes_360 && m.imagenes_360.length > 0)
                            ? m.imagenes_360[0]
                            : FOTOS[m.modelo];
                        const hover = hoverModelo === m.modelo;
                        return (
                            <div
                                key={m.modelo}
                                onClick={() => seleccionarModelo(m.modelo)}
                                onMouseEnter={() => setHoverModelo(m.modelo)}
                                onMouseLeave={() => setHoverModelo(null)}
                                className="relative cursor-pointer rounded-sm border border-[#e5e5e5] bg-white hover:border-[#051620] transition-all duration-200 overflow-hidden"
                            >
                                <div className="h-44 flex items-center justify-center p-4 bg-[#f8f8f8]">
                                    {fotoFinal ? (
                                        <img
                                            src={fotoFinal}
                                            alt={`KIA ${m.modelo}`}
                                            className={`h-full w-full object-contain transition-transform duration-300 ${hover ? 'scale-110' : 'scale-100'}`}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="text-[#051620]/10 font-display font-bold text-4xl">KIA</div>
                                    )}
                                </div>
                                <div className="px-3 py-2.5 bg-white border-t border-[#e5e5e5]">
                                    <p className="font-display text-base font-bold text-[#051620]">{m.modelo}</p>
                                    <p className="text-xs capitalize text-[#666] mt-0.5">{m.categoria}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="inline-flex items-center gap-1 text-[11px] text-[#999]">
                                            <Car className="w-3 h-3" />
                                            {m.cantidadUnidades} {m.cantidadUnidades === 1 ? 'unidad' : 'unidades'}
                                        </span>
                                        {m.enPicoPlacaHoy > 0 && (
                                            <span className="text-[11px] font-medium text-red-600">
                                                {m.enPicoPlacaHoy} en pico y placa
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}