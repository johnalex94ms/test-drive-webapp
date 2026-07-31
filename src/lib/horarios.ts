export function obtenerHorariosDelDia(fechaISO: string): string[] {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    const diaSemana = fecha.getDay(); // 0 = domingo, 1 = lunes, ... 6 = sabado

    if (diaSemana === 0) {
        return []; // domingo cerrado
    }

    if (diaSemana === 5 || diaSemana === 6) {
        return ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']; // viernes y sabado, 9am-4pm
    }

    return ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']; // lunes a jueves, 9am-5pm
}