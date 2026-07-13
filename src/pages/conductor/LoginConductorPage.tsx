import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import logoDistrikia from '../../assets/images/logos/logotipo-kia-distrkia-negro.webp';

export default function LoginConductorPage() {
    const [correo, setCorreo] = useState('');
    const [clave, setClave] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const navigate = useNavigate();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setCargando(true);
        setError(null);

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: correo,
            password: clave,
        });

        if (authError || !authData.user) {
            setError('Correo o contraseña incorrectos.');
            setCargando(false);
            return;
        }

        const { data: perfil, error: perfilError } = await supabase
            .from('conductores')
            .select('*')
            .eq('auth_user_id', authData.user.id)
            .eq('activo', true)
            .single();

        if (perfilError || !perfil) {
            setError('Tu cuenta no tiene acceso al panel de conductores.');
            await supabase.auth.signOut();
            setCargando(false);
            return;
        }

        setCargando(false);
        navigate('/conductor');
    }

    return (
        <div className="min-h-screen bg-white flex">
            {/* Video izquierda */}
            <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-[#051620]">
                <iframe
                    src="https://www.youtube.com/embed/SjPWSiHOLI4?autoplay=1&mute=1&loop=1&playlist=SjPWSiHOLI4&controls=0&showinfo=0&rel=0&modestbranding=1"
                    title="Distrikia KIA"
                    allow="autoplay; encrypted-media"
                    className="absolute w-[177.78vh] h-[56.25vw] min-w-full min-h-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#051620] via-transparent to-transparent" />
                <div className="absolute bottom-10 left-10">
                    <p className="font-display text-3xl font-bold text-white leading-tight">
                        TU RUTA.<br />TU EXPERIENCIA.<br />TU MARCA.
                    </p>
                </div>
            </div>

            {/* Formulario derecha */}
            <div className="w-full lg:w-1/2 flex items-center justify-center px-30">
                <form onSubmit={handleLogin} className="w-full max-w-full">
                    <div className="text-center mb-10">
                        <button
                            type="button"
                            onClick={() => window.open('https://distrikia.com.co/', '_blank')}
                            className="cursor-pointer inline-block mb-6"
                        >
                            <img src={logoDistrikia} alt="Distrikia" className="w-80 mx-auto" />
                        </button>

                        <h1 className="font-display text-4xl font-bold text-[#051620] mb-2">
                            Panel de conductores
                        </h1>
                        <p className="text-base text-[#666]">
                            Ingresa tus credenciales para ver tus pruebas de ruta asignadas.
                        </p>
                    </div>

                    <div className="flex flex-col gap-5">
                        <Input
                            label="Correo"
                            type="email"
                            required
                            value={correo}
                            onChange={(e) => setCorreo(e.target.value)}
                            className="py-3.5"
                        />
                        <Input
                            label="Contraseña"
                            type="password"
                            required
                            value={clave}
                            onChange={(e) => setClave(e.target.value)}
                            className="py-3.5"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 mt-5">
                            {error}
                        </p>
                    )}

                    <Button type="submit" variant="primary" size="lg" className="w-full mt-8 py-4 text-base" loading={cargando} disabled={cargando}>
                        Ingresar
                    </Button>
                </form>
            </div>
        </div>
    );
}