export function diasParaInactivar(fecha: string): number {
    const [y, m, d] = fecha.split('-').map(Number);
    const objetivo = new Date(y, m - 1, d);
    objetivo.setHours(0, 0, 0, 0);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export function debeInactivarse(fecha: string): boolean {
    return diasParaInactivar(fecha) <= 0;
}

export function textoCuentaRegresiva(fecha: string): string {
    const dias = diasParaInactivar(fecha);
    if (dias > 1) return 'Se inactiva en ' + dias + ' dias';
    if (dias === 1) return 'Se inactiva manana';
    if (dias === 0) return 'Se inactiva hoy';
    return 'Inactivado';
}
