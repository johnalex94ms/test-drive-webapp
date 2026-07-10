import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { obtenerImagenes360 } from '../../lib/vehiculoImagenes';

interface Vehiculo360Props {
    modelo: string;
    fallbackUrl?: string;
    className?: string;
}

export function Vehiculo360({ modelo, fallbackUrl, className }: Vehiculo360Props) {
    const imagenes = obtenerImagenes360(modelo);
    const [indice, setIndice] = useState(0);
    const arrastrando = useRef(false);
    const inicioX = useRef(0);

    if (!imagenes || imagenes.length === 0) {
        if (!fallbackUrl) return null;
        return <img src={fallbackUrl} alt={'KIA ' + modelo} className={className} />;
    }

    function siguiente() {
        setIndice((i) => (i + 1) % imagenes.length);
    }

    function anterior() {
        setIndice((i) => (i - 1 + imagenes.length) % imagenes.length);
    }

    function onPointerDown(e: React.PointerEvent) {
        arrastrando.current = true;
        inicioX.current = e.clientX;
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
                src={imagenes[indice]}
                alt={'KIA ' + modelo}
                className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                draggable={false}
            />

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
                {imagenes.map((_, i) => (
                    <span
                        key={i}
                        className={
                            'w-1.5 h-1.5 rounded-full ' + (i === indice ? 'bg-[#051620]' : 'bg-[#051620]/25')
                        }
                    />
                ))}
            </div>
        </div>
    );
}