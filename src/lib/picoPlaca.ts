export interface DiaPicoPlaca {
    dia_semana: number;
    digitos: number[];
}

export const DIAS_SEMANA_PICO_PLACA = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miercoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
];

export function obtenerUltimoDigitoPlaca(placa: string): number | null {
    const match = placa.match(/(\d)(?!.*\d)/);
    return match ? Number(match[1]) : null;
}

const CATEGORIAS_EXENTAS_PICO_PLACA = ['electrico', 'hibrido'];

export function categoriaExentaPicoPlaca(categoria?: string | null): boolean {
    return !!categoria && CATEGORIAS_EXENTAS_PICO_PLACA.includes(categoria.toLowerCase());
}

export function diasBloqueadosPorPlaca(placa: string, config: DiaPicoPlaca[], categoria?: string | null): number[] {
    if (categoriaExentaPicoPlaca(categoria)) return [];
    const digito = obtenerUltimoDigitoPlaca(placa);
    if (digito === null) return [];
    return config.filter((c) => c.digitos.includes(digito)).map((c) => c.dia_semana);
}

export function digitosDelDia(diaSemana: number, config: DiaPicoPlaca[]): number[] {
    return config.find((c) => c.dia_semana === diaSemana)?.digitos || [];
}
