import { supabase } from './supabaseClient';
import { diasBloqueadosPorPlaca, type DiaPicoPlaca } from './picoPlaca';
import { vehiculoBloqueadoEnFecha, type VehiculoBloqueo } from './vehiculosBloqueos';

interface VehiculoCandidato {
    id: string;
    placa: string;
}

export function vehiculosDisponiblesEseDia(
    pool: VehiculoCandidato[],
    fecha: string,
    picoPlacaConfig: DiaPicoPlaca[],
    bloqueos: VehiculoBloqueo[] = []
): VehiculoCandidato[] {
    const diaSemana = new Date(fecha + 'T00:00:00').getDay();
    return pool.filter((v) =>
        !diasBloqueadosPorPlaca(v.placa, picoPlacaConfig).includes(diaSemana) &&
        !vehiculoBloqueadoEnFecha(v.id, fecha, bloqueos)
    );
}

export async function asignarVehiculoDisponible(
    pool: VehiculoCandidato[],
    fecha: string,
    horaInicio: string,
    excluirReservaId?: string
): Promise<string | null> {
    if (pool.length === 0) return null;

    let query = supabase
        .from('reservas')
        .select('vehiculo_id')
        .eq('fecha', fecha)
        .eq('hora_inicio', horaInicio)
        .in('vehiculo_id', pool.map((v) => v.id))
        .in('estado', ['confirmada', 'en_camino', 'en_prueba']);

    if (excluirReservaId) {
        query = query.neq('id', excluirReservaId);
    }

    const res = await query;
    const ocupados = new Set((res.data || []).map((r: any) => r.vehiculo_id));

    const disponible = pool.find((v) => !ocupados.has(v.id));
    return disponible ? disponible.id : null;
}
