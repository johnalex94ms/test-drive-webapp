export interface VehiculoBloqueo {
    id: string;
    vehiculo_id: string;
    fecha_inicio: string;
    fecha_fin: string;
    motivo: string;
}

export function vehiculoBloqueadoEnFecha(vehiculoId: string, fecha: string, bloqueos: VehiculoBloqueo[]): VehiculoBloqueo | null {
    return bloqueos.find((b) => b.vehiculo_id === vehiculoId && fecha >= b.fecha_inicio && fecha <= b.fecha_fin) || null;
}
