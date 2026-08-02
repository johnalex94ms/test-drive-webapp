import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import logoDistrikia from '../../assets/images/logos/logotipo-kia-distrkia-negro.webp';

export default function ResetPasswordPage() {
    const [claveNueva, setClaveNueva] = useState('');
    const [claveConfirmar, setClaveConfirmar] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const [exito, setExito] = useState(false);
    const [sesionLista, setSesionLista] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSesionLista(true);
            }
        });

        supabase.auth.getSession().then(({ data }) => {
            if (data.session) setSesionLista(true);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    async function handleReset(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (claveNueva.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (claveNueva !== claveConfirmar) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setCargando(true);
        const { error: updateError } = await supabase.auth.updateUser({ password: claveNueva });
        setCargando(false);

        if (updateError) {
            setError('No se pudo actualizar la contraseña, el link puede haber expirado.');
            return;
        }

        setExito(true);
        setTimeout(() => navigate('/admin/login'), 2000);
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <img src={logoDistrikia} alt="Distrikia" className="w-64 mx-auto mb-6" />
                    <h1 className="font-display text-3xl font-bold text-[#051620] mb-2">
                        Restablecer contraseña
                    </h1>
                    <p className="text-base text-[#666]">
                        Ingresa tu nueva contraseña para continuar.
                    </p>
                </div>

                {!sesionLista && !exito && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-sm px-4 py-3">
                        Validando el link de recuperación...
                    </p>
                )}

                {sesionLista && !exito && (
                    <form onSubmit={handleReset} className="flex flex-col gap-5">
                        <Input
                            label="Nueva contraseña"
                            type="password"
                            required
                            value={claveNueva}
                            onChange={(e) => setClaveNueva(e.target.value)}
                            className="py-3.5"
                        />
                        <Input
                            label="Confirmar contraseña"
                            type="password"
                            required
                            value={claveConfirmar}
                            onChange={(e) => setClaveConfirmar(e.target.value)}
                            className="py-3.5"
                        />

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3">
                                {error}
                            </p>
                        )}

                        <Button type="submit" variant="primary" size="lg" className="w-full mt-2 py-4 text-base" loading={cargando} disabled={cargando}>
                            Actualizar contraseña
                        </Button>
                    </form>
                )}

                {exito && (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-sm px-4 py-3 text-center">
                        Contraseña actualizada correctamente. Redirigiendo al login...
                    </p>
                )}
            </div>
        </div>
    );
}
