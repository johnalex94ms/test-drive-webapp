export function obtenerHorariosDelDia(fechaISO: string): string[] {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    const diaSemana = fecha.getDay();

    if (diaSemana === 0) {
        return [];
    }

    if (diaSemana === 6) {
        return ['08:00', '09:00', '10:00', '11:00'];
    }

    return ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
}