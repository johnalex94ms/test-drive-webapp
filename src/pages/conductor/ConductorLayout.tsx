import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, KeyRound, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useConductorStore } from '../../store/conductorStore';
import loadingGif from '../../assets/images/loading/loading_coche.gif';

export default function ConductorLayout() {
    const navigate = useNavigate();
    const { perfil, cargando, setPerfil } = useConductorStore();
    const [modalClaveAbierto, setModalClaveAbierto] = useState(false);
    const [cambioObligatorio, setCambioObligatorio] = useState(false);
    const [claveNueva, setClaveNueva] = useState('');
    const [claveConfirmar, setClaveConfirmar] = useState('');
    const [verClaveNueva, setVerClaveNueva] = useState(false);
    const [verClaveConfirmar, setVerClaveConfirmar] = useState(false);
    const [cambiandoClave, setCambiandoClave] = useState(false);
    const [errorClave, setErrorClave] = useState<string | null>(null);
    const [exitoClave, setExitoClave] = useState(false);

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

            if (!perfilData.clave_cambiada) {
                setModalClaveAbierto(true);
                setCambioObligatorio(true);
            }
        }
        verificar();
    }, [navigate, setPerfil]);

    async function cerrarSesion() {
        await supabase.auth.signOut();
        setPerfil(null);
        navigate('/conductor/login');
    }

    async function cambiarClave(e: React.FormEvent) {
        e.preventDefault();
        setErrorClave(null);

        if (claveNueva.length < 6) {
            setErrorClave('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (claveNueva !== claveConfirmar) {
            setErrorClave('Las contraseñas no coinciden.');
            return;
        }

        setCambiandoClave(true);
        const { error } = await supabase.auth.updateUser({ password: claveNueva });

        if (error) {
            setCambiandoClave(false);
            setErrorClave('No se pudo cambiar la contraseña, intenta de nuevo.');
            return;
        }

        if (perfil) {
            await supabase.from('conductores').update({ clave_cambiada: true }).eq('id', perfil.id);
            setPerfil({ ...perfil, clave_cambiada: true });
        }

        setCambiandoClave(false);
        setExitoClave(true);
        setClaveNueva('');
        setClaveConfirmar('');
        setTimeout(() => {
            setModalClaveAbierto(false);
            setCambioObligatorio(false);
            setExitoClave(false);
        }, 2000);
    }

    if (cargando) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-[#FFFFFF]">
                <img src={loadingGif} alt="Cargando" className="w-24 h-24 object-contain" />
                <p className="text-[#000000] text-md">Cargando...</p>
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
                            onClick={() => setModalClaveAbierto(true)}
                            className="text-white/60 hover:text-white cursor-pointer"
                            title="Cambiar contraseña"
                        >
                            <KeyRound className="w-4 h-4" />
                        </button>
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

            {modalClaveAbierto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-sm max-w-sm w-full p-6 relative">
                        {!cambioObligatorio && (
                            <button
                                type="button"
                                onClick={() => { setModalClaveAbierto(false); setErrorClave(null); setExitoClave(false); }}
                                className="absolute top-4 right-4 text-[#666] hover:text-[#051620] cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}

                        <p className="font-display text-lg font-bold text-[#051620] mb-2">
                            {cambioObligatorio ? 'Debes cambiar tu contraseña' : 'Cambiar contraseña'}
                        </p>
                        {cambioObligatorio && (
                            <p className="text-sm text-[#666] mb-4">
                                Por seguridad, define una contraseña nueva antes de continuar.
                            </p>
                        )}

                        {exitoClave ? (
                            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-sm px-4 py-3">
                                Contraseña actualizada correctamente.
                            </p>
                        ) : (
                            <form onSubmit={cambiarClave} className="flex flex-col gap-3">
                                <div className="relative">
                                    <input
                                        type={verClaveNueva ? 'text' : 'password'}
                                        placeholder="Nueva contraseña"
                                        value={claveNueva}
                                        onChange={(e) => setClaveNueva(e.target.value)}
                                        className="w-full px-3 py-2.5 pr-10 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] focus:ring-2 focus:ring-[#051620]/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setVerClaveNueva((v) => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#051620] cursor-pointer"
                                    >
                                        {verClaveNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                <div className="relative">
                                    <input
                                        type={verClaveConfirmar ? 'text' : 'password'}
                                        placeholder="Confirmar contraseña"
                                        value={claveConfirmar}
                                        onChange={(e) => setClaveConfirmar(e.target.value)}
                                        className="w-full px-3 py-2.5 pr-10 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] focus:ring-2 focus:ring-[#051620]/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setVerClaveConfirmar((v) => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#051620] cursor-pointer"
                                    >
                                        {verClaveConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                {errorClave && (
                                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3">
                                        {errorClave}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={cambiandoClave}
                                    className="bg-[#051620] text-white text-sm font-medium px-5 py-2.5 rounded-sm cursor-pointer hover:bg-[#0a2030] disabled:opacity-50 mt-1"
                                >
                                    {cambiandoClave ? 'Guardando...' : 'Guardar nueva contraseña'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}