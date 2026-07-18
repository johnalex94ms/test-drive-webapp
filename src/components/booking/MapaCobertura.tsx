import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabaseClient';

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
        if (coords) map.flyTo(coords, 16, { duration: 1.2 });
    }, [coords, map]);
    return null;
}

const iconUsuario = L.divIcon({
    className: '',
    html: `
    <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 4px rgba(0,0,0,.35));">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.4 17 27 17 27s17-14.6 17-27C34 7.6 26.4 0 17 0z" fill="#051620"/>
      <circle cx="17" cy="17" r="6.5" fill="white"/>
    </svg>
  `,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
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
    const [direccionEditable, setDireccionEditable] = useState('');
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
        if (texto.length < 2) { setSugerencias([]); return; }

        debounceRef.current = setTimeout(async () => {
            setBuscando(true);
            try {
                const res = await supabase
                    .from('barrios_cobertura')
                    .select('*')
                    .ilike('nombre', '%' + texto + '%')
                    .limit(8);
                setSugerencias(res.data || []);
            } catch {
                setSugerencias([]);
            } finally {
                setBuscando(false);
            }
        }, 300);
    }

    function actualizarUbicacion(coords: [number, number], direccion: string) {
        setCoordsUsuario(coords);
        setDireccionSel(direccion);
        setDireccionEditable(direccion);
        const tiene = dentroDeCobertura(coords);
        onCobertura(tiene, direccion, coords);
    }

    function onEditarDireccion(nuevoTexto: string) {
        setDireccionEditable(nuevoTexto);
        if (coordsUsuario) {
            const tiene = dentroDeCobertura(coordsUsuario);
            onCobertura(tiene, nuevoTexto, coordsUsuario);
        }
    }

    function seleccionarDireccion(item: any) {
        const coords: [number, number] = [Number(item.latitud), Number(item.longitud)];
        const direccion = item.nombre + ', ' + item.municipio;
        setBusqueda(direccion);
        setSugerencias([]);
        actualizarUbicacion(coords, direccion);
    }

    async function onArrastrarPin(e: any) {
        const marker = e.target;
        const posicion = marker.getLatLng();
        const coords: [number, number] = [posicion.lat, posicion.lng];

        setBuscando(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords[0]}&lon=${coords[1]}&addressdetails=1`,
                { headers: { 'Accept-Language': 'es' } }
            );
            const data = await res.json();
            const direccion = data.display_name
                ? data.display_name.split(',').slice(0, 3).join(',')
                : 'Ubicacion seleccionada en el mapa';
            setBusqueda(direccion);
            actualizarUbicacion(coords, direccion);
        } catch {
            actualizarUbicacion(coords, direccionSel);
        } finally {
            setBuscando(false);
        }
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
                        placeholder="Escribe tu barrio (ej: Laureles, Belén, El Poblado)..."
                        className="flex-1 outline-none text-sm text-[#051620] placeholder:text-[#aaa] bg-transparent"
                    />
                    {buscando && (
                        <span className="w-4 h-4 border-2 border-[#e5e5e5] border-t-[#051620] rounded-full animate-spin" />
                    )}
                </div>

                {/* Sugerencias */}
                {sugerencias.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[9999] bg-white border border-[#e5e5e5] rounded-sm shadow-lg mt-1 overflow-hidden">
                        {sugerencias.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => seleccionarDireccion(s)}
                                className="w-full text-left px-4 py-3 text-sm text-[#051620] hover:bg-[#f8f8f8] border-b border-[#e5e5e5] last:border-0 cursor-pointer transition-colors"
                            >
                                <p className="font-medium">{s.nombre}</p>
                                <p className="text-xs text-[#666] mt-0.5">Comuna {s.comuna} · {s.municipio}</p>
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
                    {/* Tile con colores tipo Google Maps */}
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
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
                        <Marker
                            position={coordsUsuario}
                            icon={iconUsuario}
                            draggable={true}
                            eventHandlers={{ dragend: onArrastrarPin }}
                        >
                            <Popup>Arrastra el pin para ajustar tu ubicacion exacta</Popup>
                        </Marker>
                    )}

                    <MoverMapa coords={coordsUsuario} />
                </MapContainer>
            </div>

            {coordsUsuario && (
                <div>
                    <label className="text-xs font-medium text-[#051620]/60 uppercase tracking-widest mb-1.5 block">
                        Confirma tu direccion exacta
                    </label>
                    <input
                        type="text"
                        value={direccionEditable}
                        onChange={(e) => onEditarDireccion(e.target.value)}
                        placeholder="Ej: Carrera 25A #53-20, El Pinal"
                        className="w-full px-4 py-2.5 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] focus:ring-2 focus:ring-[#051620]/20"
                    />
                    <p className="text-xs text-[#999] mt-1.5">
                        Ajustamos el pin al punto aproximado, corrige aqui el numero exacto de tu casa si hace falta.
                    </p>
                </div>
            )}

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