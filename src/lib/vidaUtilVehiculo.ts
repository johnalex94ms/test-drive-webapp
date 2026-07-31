export const MESES_VIDA_UTIL_VEHICULO = 3;

export function fechaListoParaVenta(fechaIngreso: string): Date {
    const [y, m, d] = fechaIngreso.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    fecha.setMonth(fecha.getMonth() + MESES_VIDA_UTIL_VEHICULO);
    return fecha;
}

export function estaListoParaVenta(fechaIngreso: string | null | undefined): boolean {
    if (!fechaIngreso) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy >= fechaListoParaVenta(fechaIngreso);
}

export function diasParaVenta(fechaIngreso: string): number {
    const objetivo = fechaListoParaVenta(fechaIngreso);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    objetivo.setHours(0, 0, 0, 0);
    return Math.round((objetivo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}
