import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, Phone, Mail, Play } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useBookingStore } from '../../store/bookingStore';
import type { Zona } from '../../lib/types';
import { MapaCobertura } from './MapaCobertura';
import { Button } from '../ui/Button';

function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function StepZona() {
    const { modelo, sedeSeleccionada, setSedeSeleccionada, setVehiculo, zona, setZona, setPaso } = useBookingStore();
    const [subPaso, setSubPaso] = useState<'sede' | 'modalidad' | 'municipio' | 'mapa'>(
        sedeSeleccionada ? 'modalidad' : 'sede'
    );
    const [ubicacionCliente, setUbicacionCliente] = useState<{ lat: number; lon: number } | null>(null);
    const [permisoUbicacion, setPermisoUbicacion] = useState<'pendiente' | 'concedido' | 'denegado'>('pendiente');
    const [municipioSel, setMunicipioSel] = useState<Zona | null>(null);

    const vehiculosDelModeloQuery = useQuery({
        queryKey: ['vehiculos-por-modelo', modelo],
        enabled: !!modelo,
        queryFn: async () => {
            const res = await supabase
                .from('vehiculos')
                .select('*, sedes(*)')
                .eq('modelo', modelo)
                .eq('activo', true);
            return res.data || [];
        },
    });

    const vehiculos = vehiculosDelModeloQuery.data || [];

    const sedesDisponibles = useMemo(() => {
        const vistas = new Set<string>();
        const lista: any[] = [];
        vehiculos.forEach((v: any) => {
            if (v.sedes && !vistas.has(v.sede_id) && (v.sedes.servicios || []).includes('Vitrina')) {
                vistas.add(v.sede_id);
                lista.push(v.sedes);
            }
        });

        return lista.map((s) => ({
            ...s,
            distancia: (ubicacionCliente && s.latitud && s.longitud)
                ? calcularDistanciaKm(ubicacionCliente.lat, ubicacionCliente.lon, Number(s.latitud), Number(s.longitud))
                : null,
        }));
    }, [vehiculos, ubicacionCliente]);

    const idSedeMasCercana = useMemo(() => {
        const conDistancia = sedesDisponibles.filter((s) => s.distancia !== null);
        if (conDistancia.length === 0) return null;
        return conDistancia.reduce((min, s) => (s.distancia < min.distancia ? s : min)).id;
    }, [sedesDisponibles]);

    function solicitarUbicacion() {
        if (!navigator.geolocation) {
            setPermisoUbicacion('denegado');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUbicacionCliente({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                setPermisoUbicacion('concedido');
            },
            () => setPermisoUbicacion('denegado'),
            { timeout: 8000 }
        );
    }

    useEffect(() => {
        if (!sedeSeleccionada) solicitarUbicacion();
    }, []);

    function elegirSede(sede: any) {
        setSedeSeleccionada(sede);
        const vehiculoDeSede = vehiculos.find((v: any) => v.sede_id === sede.id);
        if (vehiculoDeSede) setVehiculo(vehiculoDeSede);
        setSubPaso('modalidad');
    }

    function cambiarSede() {
        setSedeSeleccionada(null);
        setZona(null);
        setSubPaso('sede');
    }

    function elegirEnSede() {
        setZona({
            id: 'sede',
            nombre: sedeSeleccionada.nombre,
            municipio: sedeSeleccionada.ciudad,
            tiene_cobertura: true,
            sede_id: sedeSeleccionada.id,
        });
    }

    function elegirDomicilio() {
        setZona(null);
        setSubPaso('municipio');
    }

    const zonasQuery = useQuery({
        queryKey: ['zonas'],
        enabled: subPaso === 'municipio',
        queryFn: async () => {
            const { data, error } = await supabase.from('zonas').select('*').order('municipio');
            if (error) throw error;
            return data as Zona[];
        },
    });

    const zonas = zonasQuery.data || [];
    const zonasConCobertura = zonas.filter((z) => z.tiene_cobertura);
    const zonasSinCobertura = zonas.filter((z) => !z.tiene_cobertura);

    function seleccionarMunicipio(z: Zona) {
        setMunicipioSel(z);
        setSubPaso('mapa');
    }

    function handleCobertura(tiene: boolean, dir: string, _coords: [number, number]) {
        if (tiene) {
            setZona({
                id: municipioSel?.id ?? 'domicilio',
                nombre: dir,
                municipio: municipioSel?.municipio ?? sedeSeleccionada.ciudad,
                tiene_cobertura: true,
                sede_id: sedeSeleccionada.id,
            });
        } else {
            elegirEnSede();
        }
    }

    return (
        <div className="w-full">
            <div className="mb-8">
                <h2 className="font-display text-3xl font-bold text-[#051620]">
                    {subPaso === 'sede' && '¿Dónde queda el KIA ' + modelo + '?'}
                    {subPaso !== 'sede' && '¿Cómo quieres hacer tu prueba?'}
                </h2>
                <p className="text-[#666666] mt-2">
                    {subPaso === 'sede' && 'Te mostramos las sedes donde puedes encontrar este vehiculo.'}
                    {subPaso !== 'sede' && 'Elige si prefieres ir a la sede o que te lo llevemos a domicilio.'}
                </p>
            </div>

            {/* Paso: elegir sede */}
            {subPaso === 'sede' && (
                <>
                    {permisoUbicacion === 'pendiente' && (
                        <div className="bg-white border border-[#e5e5e5] rounded-sm p-4 mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Navigation className="w-5 h-5 text-[#051620] flex-shrink-0" />
                                <p className="text-sm text-[#666]">Buscando la sede mas cercana a ti...</p>
                            </div>
                        </div>
                    )}
                    {permisoUbicacion === 'denegado' && (
                        <div className="bg-[#f8f8f8] rounded-sm p-4 mb-5 flex items-center justify-between">
                            <p className="text-sm text-[#666]">No pudimos ubicarte, elige tu sede manualmente.</p>
                            <button
                                type="button"
                                onClick={solicitarUbicacion}
                                className="text-xs font-medium text-[#051620] hover:underline cursor-pointer flex-shrink-0"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                    {vehiculosDelModeloQuery.isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[0, 1].map((i) => (
                                <div key={i} className="h-24 bg-[#e5e5e5] rounded-sm animate-pulse" />
                            ))}
                        </div>
                    ) : sedesDisponibles.length === 0 ? (
                        <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                            No hay sedes con este vehiculo disponible en este momento.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sedesDisponibles.map((s: any) => (
                                <div
                                    key={s.id}
                                    onClick={() => elegirSede(s)}
                                    className="cursor-pointer rounded-sm border border-[#e5e5e5] bg-white hover:border-[#051620] transition-all p-4"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <MapPin className="w-4 h-4 text-[#051620] flex-shrink-0" />
                                        <p className="font-semibold text-sm text-[#051620]">{s.nombre}</p>
                                        {s.id === idSedeMasCercana && (
                                            <span className="text-[12px] font-medium text-[#0a6e3a] bg-[#0a6e3a]/10 px-2 py-0.5 rounded-full ml-auto">
                                                Sede mas cercana
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[#666] ml-6">{s.direccion}</p>
                                    {s.distancia !== null && s.distancia !== undefined && (
                                        <p className="text-xs text-[#999] ml-6 mt-1">a {s.distancia.toFixed(1)} km de ti</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Video + info de la sede elegida, y pregunta de modalidad */}
            {(subPaso === 'modalidad' || subPaso === 'municipio' || subPaso === 'mapa') && sedeSeleccionada && (
                <>
                    <button
                        type="button"
                        onClick={cambiarSede}
                        className="text-sm text-[#666] hover:text-[#051620] transition-colors cursor-pointer mb-5"
                    >
                        ← Cambiar sede
                    </button>

                    <div className="grid md:grid-cols-[1fr_1fr_auto] gap-5 mb-6">
                        <div className="bg-white border border-[#e5e5e5] rounded-sm p-5 h-72 md:h-96 overflow-y-auto">
                            <p className="font-display text-xl font-bold text-[#051620] mb-3">{sedeSeleccionada.nombre}</p>
                            <div className="flex flex-col gap-2.5 text-sm text-[#666] mb-4">
                                <span className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-[#999] flex-shrink-0" />
                                    {sedeSeleccionada.direccion}
                                </span>
                                {sedeSeleccionada.telefono_contacto && (
                                    <span className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-[#999] flex-shrink-0" /> {sedeSeleccionada.telefono_contacto}
                                    </span>
                                )}
                                {sedeSeleccionada.correo_contacto && (
                                    <span className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-[#999] flex-shrink-0" /> {sedeSeleccionada.correo_contacto}
                                    </span>
                                )}
                            </div>

                            {(sedeSeleccionada.waze_url || sedeSeleccionada.maps_url) && (
                                <div className="flex gap-2">
                                    {sedeSeleccionada.waze_url && (
                                        <button
                                            type="button"
                                            onClick={() => window.open(sedeSeleccionada.waze_url, '_blank')}
                                            className="text-xs font-medium text-[#051620] border border-[#e5e5e5] rounded-sm px-3 py-2 hover:border-[#051620] transition-colors cursor-pointer"
                                        >
                                            Ir con Waze
                                        </button>
                                    )}
                                    {sedeSeleccionada.maps_url && (
                                        <button
                                            type="button"
                                            onClick={() => window.open(sedeSeleccionada.maps_url, '_blank')}
                                            className="text-xs font-medium text-[#051620] border border-[#e5e5e5] rounded-sm px-3 py-2 hover:border-[#051620] transition-colors cursor-pointer"
                                        >
                                            Ir con Maps
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="rounded-sm overflow-hidden border border-[#e5e5e5] h-72 md:h-96">
                            <iframe
                                title="Mapa de la sede"
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                loading="lazy"
                                src={'https://www.google.com/maps?q=' + sedeSeleccionada.latitud + ',' + sedeSeleccionada.longitud + '&z=15&output=embed'}
                            />
                        </div>

                        <div className="w-full md:w-64 h-72 md:h-96 mx-auto md:mx-0">
                            {sedeSeleccionada.video_url ? (
                                <video
                                    key={sedeSeleccionada.id}
                                    src={sedeSeleccionada.video_url}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    controlsList="nodownload noremoteplayback"
                                    disablePictureInPicture
                                    className="w-full h-full rounded-sm bg-black object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-[#051620] rounded-sm flex items-center justify-center">
                                    <Play className="w-8 h-8 text-white/30" />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Paso: modalidad */}
            {subPaso === 'modalidad' && sedeSeleccionada && (
                <div className="grid sm:grid-cols-2 gap-3">
                    <div
                        onClick={() => { elegirEnSede(); }}
                        className={`cursor-pointer rounded-sm border p-5 transition-all ${zona?.id === 'sede' ? 'border-[#051620] bg-[#051620]' : 'border-[#e5e5e5] bg-white hover:border-[#051620]'}`}
                    >
                        <p className={`font-semibold text-sm mb-1 ${zona?.id === 'sede' ? 'text-white' : 'text-[#051620]'}`}>
                            Ir a la sede
                        </p>
                        <p className={`text-xs ${zona?.id === 'sede' ? 'text-white/60' : 'text-[#666]'}`}>
                            Realiza tu prueba directamente en {sedeSeleccionada.nombre}
                        </p>
                    </div>

                    {sedeSeleccionada.permite_domicilio && (
                        <div
                            onClick={elegirDomicilio}
                            className="cursor-pointer rounded-sm border border-[#e5e5e5] bg-white hover:border-[#051620] transition-all p-5"
                        >
                            <p className="font-semibold text-sm text-[#051620] mb-1">Recogeme en mi domicilio</p>
                            <p className="text-xs text-[#666]">Un experto te lleva el vehiculo a tu ubicacion</p>
                        </div>
                    )}
                </div>
            )}

            {/* Paso: municipio (domicilio) */}
            {subPaso === 'municipio' && (
                <>
                    {zonasQuery.isLoading ? (
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
                                        className="cursor-pointer rounded-sm border border-[#e5e5e5] bg-white hover:border-[#051620] p-4 transition-all"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                            <p className="font-semibold text-sm text-[#051620]">{z.municipio}</p>
                                        </div>
                                        <p className="text-xs ml-4 text-[#666]">Te recogemos</p>
                                    </div>
                                ))}
                            </div>

                            {zonasSinCobertura.length > 0 && (
                                <>
                                    <p className="text-xs font-medium text-[#051620]/40 uppercase tracking-widest mb-3">
                                        Sin cobertura aún
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                        {zonasSinCobertura.map((z) => (
                                            <div key={z.id} className="rounded-sm border border-[#e5e5e5] p-4 opacity-50 cursor-not-allowed bg-[#f8f8f8]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2 h-2 rounded-full bg-[#ccc] flex-shrink-0" />
                                                    <p className="font-semibold text-sm text-[#666]">{z.municipio}</p>
                                                </div>
                                                <p className="text-xs ml-4 text-[#999]">Proximamente</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={() => setSubPaso('modalidad')}
                                className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                ← Volver
                            </button>
                        </>
                    )}
                </>
            )}

            {/* Paso: mapa (confirmar direccion exacta) */}
            {subPaso === 'mapa' && municipioSel && (
                <>
                    <div className="flex items-center gap-3 mb-5">
                        <button
                            type="button"
                            onClick={() => setSubPaso('municipio')}
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
                    <MapaCobertura onCobertura={handleCobertura} ciudad={municipioSel?.municipio} />
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