export function nombreCortoSede(nombre: string | null | undefined): string {
    if (!nombre) return '';
    return nombre.replace(/^distrikia\s+/i, '').trim();
}
