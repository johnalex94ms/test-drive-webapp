import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SEDES = [
    {
        id: 'premium',
        nombre: 'Distrikia Premium',
        direccion: 'Calle 29 #43A-47, Medellín',
        coords: [6.2280, -75.5705] as [number, number],
        radioKm: 5,
    },
    {
        id: 'la-10',
        nombre: 'Distrikia La 10',
        direccion: 'Calle 10 #50-264, Medellín',
        coords: [6.2147, -75.5809] as [number, number],
        radioKm: 5,
    },
    {
        id: 'palace',
        nombre: 'Distrikia Palacé',
        direccion: 'Carrera 50 #32-164, Medellín',
        coords: [6.2350, -75.5736] as [number, number],
        radioKm: 4,
    },
    {
        id: 'llanogrande',
        nombre: 'Distrikia Llanogrande',
        direccion: 'Km 6 Vía Don Diego, Rionegro',
        coords: [6.1215, -75.4266] as [number, number],
        radioKm: 6,
    },
    {
        id: 'monteria',
        nombre: 'Distrikia Montería',
        direccion: 'Calle 73 #05-76, Montería',
        coords: [8.7838, -75.8598] as [number, number],
        radioKm: 5,
    },
    {
        id: 'sincelejo',
        nombre: 'Distrikia Sincelejo',
        direccion: 'Calle 32 #27B-82, Sincelejo',
        coords: [9.3033, -75.3771] as [number, number],
        radioKm: 4,
    },
    {
        id: 'apartado',
        nombre: 'Distrikia Apartadó',
        direccion: 'Carrera 100 #77-502, Apartadó',
        coords: [7.8728, -76.6346] as [number, number],
        radioKm: 4,
    },
];

const COLOMBIA_CENTER: [number, number] = [6.2442, -75.5812];

interface Props {
    onCobertura: (tiene: boolean, direccion: string, coords: [number, number]) => void;
}

function MoverMapa({ coords }: { coords: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (coords) map.flyTo(coords, 14, { duration: 1.2 });
    }, [coords, map]);
    return null;
}

const iconUsuario = L.divIcon({
    className: '',
    html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#051620;border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,.4)
  "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

const iconSede = L.divIcon({
    className: '',
    html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#051620;border:2px solid white;
    box-shadow:0 1px 4px rgba(0,0,0,.3)
  "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

export function MapaCobertura({ onCobertura }: Props) {
    const [busqueda, setBusqueda] = useState('');
    const [sugerencias, setSugerencias] = useState<any[]>([]);
    const [coordsUsuario, setCoordsUsuario] = useState<[number, number] | null>(null);
    const [direccionSel, setDireccionSel] = useState('');
    const [buscando, setBuscando] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function calcularDistanciaKm(a: [number, number], b: [number, number]): number {
        const R = 6371;
        const dLat = ((b[0] - a[0]) * Math.PI) / 180;
        const dLon = ((b[1] - a[1]) * Math.PI) / 180;
        const x =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((a[0] * Math.PI) / 180) *
            Math.cos((b[0] * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }

    function dentroDeCobertura(coords: [number, number]): boolean {
        return SEDES.some((sede) => {
            const distancia = calcularDistanciaKm(coords, sede.coords);
            return distancia <= sede.radioKm;
        });
    }

    function sedesCercanas(coords: [number, number]) {
        return SEDES.filter((sede) => {
            const distancia = calcularDistanciaKm(coords, sede.coords);
            return distancia <= sede.radioKm;
        });
    }

    function buscarDireccion(texto: string) {
        setBusqueda(texto);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (texto.length < 4) { setSugerencias([]); return; }

        debounceRef.current = setTimeout(async () => {
            setBuscando(true);
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texto + ', Colombia')}&format=json&limit=5&addressdetails=1`,
                    { headers: { 'Accept-Language': 'es' } }
                );
                const data = await res.json();
                setSugerencias(data);
            } catch {
                setSugerencias([]);
            } finally {
                setBuscando(false);
            }
        }, 500);
    }

    function seleccionarDireccion(item: any) {
        const coords: [number, number] = [parseFloat(item.lat), parseFloat(item.lon)];
        const direccion = item.display_name.split(',').slice(0, 3).join(',');
        setCoordsUsuario(coords);
        setDireccionSel(direccion);
        setBusqueda(direccion);
        setSugerencias([]);
        const tiene = dentroDeCobertura(coords);
        onCobertura(tiene, direccion, coords);
    }

    const tieneCobertura = coordsUsuario ? dentroDeCobertura(coordsUsuario) : null;
    const cercanas = coordsUsuario ? sedesCercanas(coordsUsuario) : [];

    return (
        <div className="flex flex-col gap-4">

            {/* Buscador */}
            <div className="relative">
                <div className="flex items-center gap-2 bg-white border border-[#e5e5e5] rounded-sm px-4 py-3 focus-within:border-[#051620] transition-colors">
                    <span className="text-[#666] text-sm">⌕</span>
                    <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => buscarDireccion(e.target.value)}
                        placeholder="Escribe tu dirección..."
                        className="flex-1 outline-none text-sm text-[#051620] placeholder:text-[#aaa] bg-transparent"
                    />
                    {buscando && (
                        <span className="w-4 h-4 border-2 border-[#e5e5e5] border-t-[#051620] rounded-full animate-spin" />
                    )}
                </div>

                {/* Sugerencias */}
                {sugerencias.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[9999] bg-white border border-[#e5e5e5] rounded-sm shadow-lg mt-1 overflow-hidden">
                        {sugerencias.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => seleccionarDireccion(s)}
                                className="w-full text-left px-4 py-3 text-sm text-[#051620] hover:bg-[#f8f8f8] border-b border-[#e5e5e5] last:border-0 cursor-pointer transition-colors"
                            >
                                <p className="font-medium">{s.display_name.split(',')[0]}</p>
                                <p className="text-xs text-[#666] mt-0.5">
                                    {s.display_name.split(',').slice(1, 3).join(',')}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Mapa */}
            <div className="rounded-sm overflow-hidden border border-[#e5e5e5]" style={{ height: 380, zIndex: 0 }}>
                <MapContainer
                    center={COLOMBIA_CENTER}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                >
                    {/* Tile blanco estilo Google Maps */}
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                    />

                    {/* Círculos de cobertura por sede */}
                    {SEDES.map((sede) => (
                        <Circle
                            key={sede.id}
                            center={sede.coords}
                            radius={sede.radioKm * 1000}
                            pathOptions={{
                                color: '#051620',
                                fillColor: '#051620',
                                fillOpacity: 0.08,
                                weight: 1.5,
                                dashArray: '5 5',
                            }}
                        >
                            <Popup>
                                <div className="text-xs">
                                    <p className="font-semibold">{sede.nombre}</p>
                                    <p className="text-gray-500">{sede.direccion}</p>
                                </div>
                            </Popup>
                        </Circle>
                    ))}

                    {/* Marcadores de sedes */}
                    {SEDES.map((sede) => (
                        <Marker key={`marker-${sede.id}`} position={sede.coords} icon={iconSede}>
                            <Popup>
                                <div className="text-xs">
                                    <p className="font-semibold">{sede.nombre}</p>
                                    <p className="text-gray-500">{sede.direccion}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Pin del usuario */}
                    {coordsUsuario && (
                        <Marker position={coordsUsuario} icon={iconUsuario}>
                            <Popup>{direccionSel}</Popup>
                        </Marker>
                    )}

                    <MoverMapa coords={coordsUsuario} />
                </MapContainer>
            </div>

            {/* Resultado cobertura */}
            {tieneCobertura !== null && (
                <div className={`rounded-sm p-4 flex items-start gap-3 ${tieneCobertura
                    ? 'bg-[#051620]'
                    : 'bg-[#f8f8f8] border border-[#e5e5e5]'
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm mt-0.5 ${tieneCobertura ? 'bg-white/10 text-white' : 'bg-[#e5e5e5] text-[#666]'
                        }`}>
                        {tieneCobertura ? '✓' : '✗'}
                    </div>
                    <div>
                        <p className={`font-semibold text-sm ${tieneCobertura ? 'text-white' : 'text-[#051620]'}`}>
                            {tieneCobertura
                                ? 'Tu dirección tiene cobertura — el KIA va hasta ti'
                                : 'Sin cobertura en esta zona por ahora'}
                        </p>
                        <p className={`text-xs mt-0.5 ${tieneCobertura ? 'text-white/50' : 'text-[#666]'}`}>
                            {tieneCobertura
                                ? `Sede más cercana: ${cercanas[0]?.nombre}`
                                : 'Puedes visitarnos en cualquiera de nuestras sedes'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}