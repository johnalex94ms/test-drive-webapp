import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useConductorStore } from '../../store/conductorStore';

const ESTILO_ESTADO: Record<string, { bg: string; texto: string; label: string }> = {
    pendiente: { bg: '#fdf3d9', texto: '#8a6d00', label: 'Pendiente' },
    confirmada: { bg: '#dcf3e4', texto: '#0a6e3a', label: 'Confirmada' },
    en_camino: { bg: '#dbe9fb', texto: '#0a4a8a', label: 'En camino' },
    en_prueba: { bg: '#dbe9fb', texto: '#0a4a8a', label: 'En prueba' },
    finalizada: { bg: '#f0f0f0', texto: '#666666', label: 'Finalizada' },
};

function formatearFecha(fechaISO: string) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ConductorDashboardPage() {
    const { perfil } = useConductorStore();
    const [filtro, setFiltro] = useState<'proximas' | 'todas'>('proximas');
    const queryClient = useQueryClient();

    const reservasQuery = useQuery({
        queryKey: ['conductor-reservas', perfil?.id],
        enabled: !!perfil?.id,
        queryFn: async () => {
            const res = await supabase
                .from('reservas')
                .select('*, vehiculos(*), sedes(*)')
                .eq('conductor_id', perfil!.id)
                .in('estado', ['confirmada', 'en_camino', 'en_prueba', 'finalizada'])
                .order('fecha', { ascending: true })
                .order('hora_inicio', { ascending: true });
            return res.data || [];
        },
    });

    useEffect(() => {
        if (!perfil?.id) return;
        const canal = supabase
            .channel('conductor-reservas-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reservas', filter: 'conductor_id=eq.' + perfil.id },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['conductor-reservas', perfil.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canal);
        };
    }, [perfil?.id, queryClient]);

    const reservas = reservasQuery.data || [];
    const hoyStr = new Date().toISOString().slice(0, 10);

    const reservasFiltradas = filtro === 'proximas'
        ? reservas.filter((r: any) => r.fecha >= hoyStr && r.estado !== 'finalizada')
        : reservas;

    return (
        <div>
            <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-[#051620]">
                    Hola, {perfil?.nombre?.split(' ')[0]}
                </h1>
                <p className="text-sm text-[#666]">Estas son tus pruebas de ruta asignadas.</p>
            </div>

            <div className="flex gap-2 mb-6">
                <button
                    type="button"
                    onClick={() => setFiltro('proximas')}
                    className={
                        'px-4 py-1.5 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                        (filtro === 'proximas' ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                    }
                >
                    Proximas
                </button>
                <button
                    type="button"
                    onClick={() => setFiltro('todas')}
                    className={
                        'px-4 py-1.5 text-xs font-medium rounded-sm cursor-pointer transition-colors ' +
                        (filtro === 'todas' ? 'bg-[#051620] text-white' : 'bg-white border border-[#e5e5e5] text-[#666] hover:border-[#051620]')
                    }
                >
                    Todas
                </button>
            </div>

            {reservasQuery.isLoading ? (
                <p className="text-sm text-[#666]">Cargando...</p>
            ) : reservasFiltradas.length === 0 ? (
                <p className="text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-sm p-6 text-center">
                    No tienes pruebas de ruta {filtro === 'proximas' ? 'proximas' : 'asignadas'}.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {reservasFiltradas.map((r: any) => {
                        const estilo = ESTILO_ESTADO[r.estado] || ESTILO_ESTADO.confirmada;
                        const fotoVehiculo = r.vehiculos?.imagenes_360?.[0];
                        return (
                            <div key={r.id} className="bg-white border border-[#e5e5e5] rounded-sm p-4 flex gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="font-display text-lg font-bold text-[#051620]">
                                                {r.vehiculos ? 'KIA ' + r.vehiculos.modelo : 'Vehiculo'}
                                            </p>
                                            {r.vehiculos?.placa && (
                                                <p className="text-xs text-[#999] font-medium mt-0.5">Placa: {r.vehiculos.placa}</p>
                                            )}
                                        </div>
                                        <span
                                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                            style={{ background: estilo.bg, color: estilo.texto }}
                                        >
                                            {estilo.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[#666] capitalize mb-3">
                                        {formatearFecha(r.fecha)} · {r.hora_inicio.slice(0, 5)} - {r.hora_fin.slice(0, 5)}
                                    </p>
                                    <div className="border-t border-[#e5e5e5] pt-3 flex flex-col gap-1">
                                        <p className="text-sm text-[#051620]">
                                            <strong>{r.cliente_nombre} {r.cliente_apellido}</strong>
                                        </p>
                                        <div className="flex items-center gap-4 mt-1">
                                            <a href={'tel:' + r.cliente_celular} className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#051620]">
                                                <Phone className="w-3.5 h-3.5" />
                                                {r.cliente_celular}
                                            </a>
                                            <a href={'mailto:' + r.cliente_correo} className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#051620]">
                                                <Mail className="w-3.5 h-3.5" />
                                                {r.cliente_correo}
                                            </a>
                                        </div>
                                        <p className="text-xs text-[#999] mt-1">
                                            {r.tipo_entrega === 'domicilio' ? r.direccion_domicilio : (r.sedes ? r.sedes.nombre : '')}
                                        </p>
                                    </div>
                                </div>

                                {fotoVehiculo && (
                                    <div className="w-56 flex-shrink-0 flex flex-col items-center justify-center gap-2">
                                        <img
                                            src={fotoVehiculo}
                                            alt={r.vehiculos.modelo}
                                            className="w-full object-contain"
                                        />
                                        {r.vehiculos?.placa && (
                                            <p className="font-display text-2xl font-bold text-[#051620] tracking-wide">
                                                {r.vehiculos.placa}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}