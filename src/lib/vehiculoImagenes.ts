type ModuloImagen = { default: string };

const modulos = import.meta.glob('/src/assets/images/**/*.{png,jpg,jpeg,webp}', { eager: true }) as Record<string, ModuloImagen>;

function normalizar(texto: string) {
    return texto
        .toLowerCase()
        .replace(/^kia[_\s-]*/i, '')
        .replace(/[^a-z0-9]/g, '');
}

function construirMapa() {
    const mapa: Record<string, string[]> = {};
    Object.keys(modulos)
        .sort()
        .forEach((ruta) => {
            const match = ruta.match(/images\/([^/]+)\//);
            if (!match) return;
            const clave = normalizar(match[1]);
            if (!mapa[clave]) mapa[clave] = [];
            mapa[clave].push(modulos[ruta].default);
        });
    return mapa;
}

const MAPA_360 = construirMapa();

export function obtenerImagenes360(modelo: string): string[] {
    return MAPA_360[normalizar(modelo)] || [];
}