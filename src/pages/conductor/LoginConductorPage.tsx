import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

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
        <div className="min-h-screen bg-[#051620] flex items-center justify-center px-6">
            <form onSubmit={handleLogin} className="bg-white rounded-sm p-8 w-full max-w-sm">
                <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Distrikia</p>
                <h1 className="font-display text-2xl font-bold text-[#051620] mb-6">
                    Panel de conductores
                </h1>

                <div className="flex flex-col gap-4">
                    <Input
                        label="Correo"
                        type="email"
                        required
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                    />
                    <Input
                        label="Contraseña"
                        type="password"
                        required
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 mt-4">
                        {error}
                    </p>
                )}

                <Button type="submit" variant="primary" size="lg" className="w-full mt-6" loading={cargando} disabled={cargando}>
                    Ingresar
                </Button>
            </form>
        </div>
    );
}