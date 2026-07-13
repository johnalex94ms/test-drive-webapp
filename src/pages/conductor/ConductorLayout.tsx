import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useConductorStore } from '../../store/conductorStore';

export default function ConductorLayout() {
    const navigate = useNavigate();
    const { perfil, cargando, setPerfil } = useConductorStore();

    useEffect(() => {
        async function verificar() {
            const { data: sesion } = await supabase.auth.getSession();
            if (!sesion.session) {
                navigate('/conductor/login');
                return;
            }

            const { data: perfilData } = await supabase
                .from('conductores')
                .select('*')
                .eq('auth_user_id', sesion.session.user.id)
                .eq('activo', true)
                .single();

            if (!perfilData) {
                navigate('/conductor/login');
                return;
            }

            setPerfil(perfilData);
        }
        verificar();
    }, [navigate, setPerfil]);

    async function cerrarSesion() {
        await supabase.auth.signOut();
        setPerfil(null);
        navigate('/conductor/login');
    }

    if (cargando) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
                <p className="text-[#666] text-sm">Cargando...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f8f8]">
            <header className="bg-[#051620] py-3">
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-widest">Distrikia</p>
                        <p className="text-sm font-semibold text-white">Panel de conductores</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {perfil && (
                            <div className="flex items-center gap-2">
                                {perfil.foto_url ? (
                                    <img src={perfil.foto_url} alt={perfil.nombre} className="w-7 h-7 rounded-full object-cover" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white">
                                        {perfil.nombre ? perfil.nombre[0].toUpperCase() : '?'}
                                    </div>
                                )}
                                <span className="text-sm text-white/80">{perfil.nombre}</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={cerrarSesion}
                            className="text-white/60 hover:text-red-400 cursor-pointer"
                            title="Cerrar sesion"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                <Outlet />
            </main>
        </div>
    );
}