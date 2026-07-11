export function crearImagen(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

export async function recortarImagen(
    imagenSrc: string,
    areaRecorte: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
    const imagen = await crearImagen(imagenSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const tamano = 300;
    canvas.width = tamano;
    canvas.height = tamano;

    if (!ctx) throw new Error('No se pudo crear el canvas');

    ctx.drawImage(
        imagen,
        areaRecorte.x,
        areaRecorte.y,
        areaRecorte.width,
        areaRecorte.height,
        0,
        0,
        tamano,
        tamano
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('No se pudo generar la imagen'));
            },
            'image/jpeg',
            0.9
        );
    });
}