import { supabase } from './supabaseClient';

export async function asignarConductorDisponible(
    sedeId: string,
    fecha: string,
    horaInicio: string,
    excluirReservaId?: string
): Promise<string | null> {
    const resConductores = await supabase
        .from('conductores_sedes')
        .select('conductor_id, conductores!inner(activo)')
        .eq('sede_id', sedeId)
        .eq('conductores.activo', true);

    const candidatos = (resConductores.data || []).map((r: any) => r.conductor_id);
    if (candidatos.length === 0) return null;

    let query = supabase
        .from('reservas')
        .select('conductor_id')
        .eq('fecha', fecha)
        .eq('hora_inicio', horaInicio)
        .in('estado', ['pendiente', 'confirmada', 'en_camino', 'en_prueba']);

    if (excluirReservaId) {
        query = query.neq('id', excluirReservaId);
    }

    const resOcupados = await query;
    const ocupados = new Set((resOcupados.data || []).map((r: any) => r.conductor_id));

    const disponible = candidatos.find((id: string) => !ocupados.has(id));
    return disponible || null;
}