import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { obtenerImagenes360 } from '../../lib/vehiculoImagenes';

interface Vehiculo360Props {
    modelo: string;
    imagenes?: string[];
    fallbackUrl?: string;
    className?: string;
}

export function Vehiculo360({ modelo, imagenes, fallbackUrl, className }: Vehiculo360Props) {
    const imagenesFinal = imagenes && imagenes.length > 0 ? imagenes : obtenerImagenes360(modelo);
    const [indice, setIndice] = useState(0);
    const [pausado, setPausado] = useState(false);
    const arrastrando = useRef(false);
    const inicioX = useRef(0);
    const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reanudarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setIndice(0);
    }, [modelo]);

    useEffect(() => {
        if (!imagenesFinal || imagenesFinal.length <= 1 || pausado) return;

        intervaloRef.current = setInterval(() => {
            setIndice((i) => (i + 1) % imagenesFinal.length);
        }, 1400);

        return () => {
            if (intervaloRef.current) clearInterval(intervaloRef.current);
        };
    }, [imagenesFinal, pausado]);

    function pausarTemporalmente() {
        setPausado(true);
        if (reanudarTimeoutRef.current) clearTimeout(reanudarTimeoutRef.current);
        reanudarTimeoutRef.current = setTimeout(() => setPausado(false), 4000);
    }

    if (!imagenesFinal || imagenesFinal.length === 0) {
        if (!fallbackUrl) return null;
        return <img src={fallbackUrl} alt={'KIA ' + modelo} className={className} />;
    }

    function siguiente() {
        pausarTemporalmente();
        setIndice((i) => (i + 1) % imagenesFinal.length);
    }

    function anterior() {
        pausarTemporalmente();
        setIndice((i) => (i - 1 + imagenesFinal.length) % imagenesFinal.length);
    }

    function onPointerDown(e: React.PointerEvent) {
        arrastrando.current = true;
        inicioX.current = e.clientX;
        pausarTemporalmente();
    }

    function onPointerMove(e: React.PointerEvent) {
        if (!arrastrando.current) return;
        const delta = e.clientX - inicioX.current;
        if (Math.abs(delta) > 40) {
            if (delta > 0) anterior();
            else siguiente();
            inicioX.current = e.clientX;
        }
    }

    function onPointerUp() {
        arrastrando.current = false;
    }

    return (
        <div className={'relative select-none ' + (className || '')}>
            <img
                key={indice}
                src={imagenesFinal[indice]}
                alt={'KIA ' + modelo}
                className="w-full h-full object-contain cursor-grab active:cursor-grabbing animate-fade-rotate"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                draggable={false}
            />

            {imagenesFinal.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={anterior}
                        className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4 text-[#051620]" />
                    </button>
                    <button
                        type="button"
                        onClick={siguiente}
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4 text-[#051620]" />
                    </button>

                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                        {imagenesFinal.map((_, i) => (
                            <span
                                key={i}
                                className={
                                    'w-1.5 h-1.5 rounded-full transition-colors ' + (i === indice ? 'bg-[#051620]' : 'bg-[#051620]/25')
                                }
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}