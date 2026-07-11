import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { recortarImagen } from '../../lib/recortarImagen';

interface FotoCropModalProps {
    imagenSrc: string;
    onCancelar: () => void;
    onConfirmar: (blob: Blob) => void;
}

export function FotoCropModal({ imagenSrc, onCancelar, onConfirmar }: FotoCropModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [areaPixeles, setAreaPixeles] = useState<any>(null);
    const [procesando, setProcesando] = useState(false);

    const onCropComplete = useCallback((_area: any, areaPixelesNuevo: any) => {
        setAreaPixeles(areaPixelesNuevo);
    }, []);

    async function confirmar() {
        if (!areaPixeles) return;
        setProcesando(true);
        try {
            const blob = await recortarImagen(imagenSrc, areaPixeles);
            onConfirmar(blob);
        } finally {
            setProcesando(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-white rounded-sm max-w-sm w-full p-5">
                <p className="font-display text-lg font-bold text-[#051620] mb-3">
                    Ajusta la foto
                </p>

                <div className="relative w-full h-72 bg-[#f0f0f0] rounded-sm overflow-hidden">
                    <Cropper
                        image={imagenSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                    />
                </div>

                <div className="mt-4">
                    <label className="text-xs text-[#666] mb-1 block">Zoom</label>
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full cursor-pointer"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 mt-5">
                    <button
                        type="button"
                        onClick={onCancelar}
                        className="text-sm text-[#666] hover:text-[#051620] cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={procesando}
                        onClick={confirmar}
                        className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50"
                    >
                        {procesando ? 'Procesando...' : 'Usar esta foto'}
                    </button>
                </div>
            </div>
        </div>
    );
}