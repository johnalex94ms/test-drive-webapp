import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Circle, Marker, InfoWindow } from '@react-google-maps/api';
import { supabase } from '../../lib/supabaseClient';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

const SEDES = [
    {
        id: 'premium',
        nombre: 'Distrikia Premium',
        direccion: 'Calle 29 #43A-47, Medellín',
        coords: { lat: 6.2280, lng: -75.5705 },
        radioKm: 5,
    },
    {
        id: 'la-10',
        nombre: 'Distrikia La 10',
        direccion: 'Calle 10 #50-264, Medellín',
        coords: { lat: 6.2147, lng: -75.5809 },
        radioKm: 5,
    },
    {
        id: 'palace',
        nombre: 'Distrikia Palacé',
        direccion: 'Carrera 50 #32-164, Medellín',
        coords: { lat: 6.2350, lng: -75.5736 },
        radioKm: 4,
    },
    {
        id: 'llanogrande',
        nombre: 'Distrikia Llanogrande',
        direccion: 'Km 6 Vía Don Diego, Rionegro',
        coords: { lat: 6.1215, lng: -75.4266 },
        radioKm: 6,
    },
    {
        id: 'monteria',
        nombre: 'Distrikia Montería',
        direccion: 'Calle 73 #05-76, Montería',
        coords: { lat: 8.7838, lng: -75.8598 },
        radioKm: 5,
    },
    {
        id: 'sincelejo',
        nombre: 'Distrikia Sincelejo',
        direccion: 'Calle 32 #27B-82, Sincelejo',
        coords: { lat: 9.3033, lng: -75.3771 },
        radioKm: 4,
    },
    {
        id: 'apartado',
        nombre: 'Distrikia Apartadó',
        direccion: 'Carrera 100 #77-502, Apartadó',
        coords: { lat: 7.8728, lng: -76.6346 },
        radioKm: 4,
    },
];

const COLOMBIA_CENTER = { lat: 6.2442, lng: -75.5812 };

// Estilo del mapa: quita puntos de interes y transporte para que se vea limpio, como Voyager/CartoDB
const MAP_STYLES: google.maps.MapTypeStyle[] = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

interface Props {
    onCobertura: (tiene: boolean, direccion: string, coords: [number, number]) => void;
}

function calcularDistanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function dentroDeCobertura(coords: { lat: number; lng: number }): boolean {
    return SEDES.some((sede) => calcularDistanciaKm(coords, sede.coords) <= sede.radioKm);
}

function sedesCercanas(coords: { lat: number; lng: number }) {
    return SEDES.filter((sede) => calcularDistanciaKm(coords, sede.coords) <= sede.radioKm);
}

export function MapaCobertura({ onCobertura }: Props) {
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        id: 'distrikia-google-maps',
    });

    const [busqueda, setBusqueda] = useState('');
    const [sugerencias, setSugerencias] = useState<any[]>([]);
    const [coordsUsuario, setCoordsUsuario] = useState<{ lat: number; lng: number } | null>(null);
    const [direccionSel, setDireccionSel] = useState('');
    const [direccionEditable, setDireccionEditable] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [sedePopup, setSedePopup] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    useEffect(() => {
        if (isLoaded && !geocoderRef.current) {
            geocoderRef.current = new google.maps.Geocoder();
        }
    }, [isLoaded]);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

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

    function actualizarUbicacion(coords: { lat: number; lng: number }, direccion: string) {
        setCoordsUsuario(coords);
        setDireccionSel(direccion);
        setDireccionEditable(direccion);
        const tiene = dentroDeCobertura(coords);
        onCobertura(tiene, direccion, [coords.lat, coords.lng]);
        mapRef.current?.panTo(coords);
        mapRef.current?.setZoom(16);
    }

    function onEditarDireccion(nuevoTexto: string) {
        setDireccionEditable(nuevoTexto);
        if (coordsUsuario) {
            const tiene = dentroDeCobertura(coordsUsuario);
            onCobertura(tiene, nuevoTexto, [coordsUsuario.lat, coordsUsuario.lng]);
        }
    }

    function seleccionarDireccion(item: any) {
        const coords = { lat: Number(item.latitud), lng: Number(item.longitud) };
        const direccion = item.nombre + ', ' + item.municipio;
        setBusqueda(direccion);
        setSugerencias([]);
        actualizarUbicacion(coords, direccion);
    }

    function onArrastrarPin(e: google.maps.MapMouseEvent) {
        if (!e.latLng || !geocoderRef.current) return;
        const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };

        setBuscando(true);
        geocoderRef.current.geocode({ location: coords, language: 'es' }, (resultados, status) => {
            setBuscando(false);
            if (status === 'OK' && resultados && resultados[0]) {
                const direccion = resultados[0].formatted_address;
                setBusqueda(direccion);
                actualizarUbicacion(coords, direccion);
            } else {
                actualizarUbicacion(coords, direccionSel || 'Ubicacion seleccionada en el mapa');
            }
        });
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
                {loadError ? (
                    <div className="w-full h-full flex items-center justify-center bg-[#f8f8f8]">
                        <p className="text-sm text-red-600">No se pudo cargar Google Maps. Revisa la API key.</p>
                    </div>
                ) : !isLoaded ? (
                    <div className="w-full h-full flex items-center justify-center bg-[#f8f8f8] animate-pulse">
                        <p className="text-sm text-[#999]">Cargando mapa...</p>
                    </div>
                ) : (
                    <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={COLOMBIA_CENTER}
                        zoom={12}
                        onLoad={onMapLoad}
                        options={{
                            styles: MAP_STYLES,
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                        }}
                    >
                        {/* Circulos de cobertura por sede */}
                        {SEDES.map((sede) => (
                            <Circle
                                key={sede.id}
                                center={sede.coords}
                                radius={sede.radioKm * 1000}
                                options={{
                                    strokeColor: '#051620',
                                    strokeWeight: 1.5,
                                    fillColor: '#051620',
                                    fillOpacity: 0.08,
                                }}
                            />
                        ))}

                        {/* Marcadores de sedes */}
                        {SEDES.map((sede) => (
                            <Marker
                                key={'marker-' + sede.id}
                                position={sede.coords}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 6,
                                    fillColor: '#051620',
                                    fillOpacity: 1,
                                    strokeColor: 'white',
                                    strokeWeight: 2,
                                }}
                                onClick={() => setSedePopup(sede.id)}
                            >
                                {sedePopup === sede.id && (
                                    <InfoWindow onCloseClick={() => setSedePopup(null)}>
                                        <div className="text-xs">
                                            <p className="font-semibold">{sede.nombre}</p>
                                            <p className="text-gray-500">{sede.direccion}</p>
                                        </div>
                                    </InfoWindow>
                                )}
                            </Marker>
                        ))}

                        {/* Pin del usuario */}
                        {coordsUsuario && (
                            <Marker
                                position={coordsUsuario}
                                draggable={true}
                                onDragEnd={onArrastrarPin}
                            />
                        )}
                    </GoogleMap>
                )}
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
