import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Truck, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import logoDistrikia from '../assets/images/logos/logotipo-kia-distrkia-negro.webp';
import imagenHero from '../assets/images/ilustraciones/imagen-concepto-test-drive.png';
import loadingGif from '../assets/images/loading/loading_coche.gif';

const PASOS = [
    { num: '01', title: 'Elige tu KIA', desc: 'Selecciona el modelo que quieres probar entre todo el catálogo Distrikia.' },
    { num: '02', title: 'Tu ubicación', desc: 'Dinos dónde estás. Si hay cobertura, el carro va hasta ti.' },
    { num: '03', title: 'Elige fecha y hora', desc: 'Ve la disponibilidad real y reserva el horario que más te convenga.' },
    { num: '04', title: 'Disfruta la ruta', desc: 'Un experto KIA te acompaña y resuelve todas tus dudas en el camino.' },
];

const CHIPS = [
    { icon: Home, label: 'Te recogemos en casa' },
    { icon: Truck, label: 'Confirmación inmediata' },
    { icon: Mail, label: 'Sin costo, sin compromiso' },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const [imagenCargada, setImagenCargada] = useState(false);

    if (!imagenCargada) {
        return (
            <>
                <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
                    <img src={loadingGif} alt="Cargando" className="w-24 h-24 object-contain" />
                    <p className="text-[#666] text-sm">Cargando...</p>
                </div>
                <img
                    src={imagenHero}
                    alt=""
                    className="hidden"
                    onLoad={() => setImagenCargada(true)}
                    onError={() => setImagenCargada(true)}
                />
            </>
        );
    }

    return (
        <div className="bg-white text-[#051620]">

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-[#e5e5e5]">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <img src={logoDistrikia} alt="Distrikia" className="w-40" />
                    <nav className="hidden md:flex items-center gap-8 text-sm text-[#666]">
                        <a href="#como-funciona" className="hover:text-[#051620] transition-colors">¿Cómo funciona?</a>
                    </nav>
                    <Button onClick={() => navigate('/agendar')} variant="primary" size="sm">
                        Agendar prueba
                    </Button>
                </div>
            </header>

            {/* Hero */}
            <section className="relative p-0 h-auto overflow-hidden min-h-screen flex items-center">
                {/* Blobs decorativos */}
                <div className="pointer-events-none absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#051620]/[0.04] blur-3xl" />
                <div className="pointer-events-none absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full bg-[#051620]/[0.05] blur-3xl" />

                <div className="relative max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
                    {/* Texto */}
                    <div>
                        <p className="text-[#051620]/40 text-xs font-sm uppercase tracking-[0.3em] mb-4">
                            Distrikia · Concesionario KIA
                        </p>
                        <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.05] mb-3">
                            Siente la diferencia.
                            <br />
                            <span className="text-[#051620]/35">Maneja un KIA.</span>
                        </h1>
                        <p className="text-[#666] text-md max-w-md mb-4 leading-relaxed">
                            Agenda tu prueba de ruta en minutos. Te llevamos el carro hasta tu ubicación,
                            o visítanos en cualquiera de nuestras sedes.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button onClick={() => navigate('/agendar')} variant="primary" size="md">
                                Agendar mi prueba de ruta →
                            </Button>
                        </div>
                    </div>

                    {/* Imagen hero */}
                    <div className="relative flex items-center justify-center lg:justify-end">
                        <img
                            src={imagenHero}
                            alt="Distrikia test drive"
                            className="relative z-10 w-full max-w-xl lg:max-w-3xl object-contain"
                        />
                    </div>
                </div>

                {/* Chips de confianza */}
                <div className="absolute bottom-8 left-0 right-0 hidden md:flex justify-center gap-3 px-6">
                    {CHIPS.map((chip) => {
                        const Icon = chip.icon;
                        return (
                            <div
                                key={chip.label}
                                className="bg-white border border-[#e5e5e5] rounded-full px-4 py-2 flex items-center gap-2 shadow-sm"
                            >
                                <Icon className="w-3.5 h-3.5 text-[#051620]" />
                                <span className="text-xs font-medium text-[#051620]">{chip.label}</span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Cómo funciona */}
            <section id="como-funciona" className="py-24 px-6 bg-[#f8f8f8]">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-[#051620]/40 text-xs uppercase tracking-widest mb-3">Proceso simple</p>
                        <h2 className="font-display text-4xl font-bold text-[#051620]">¿Cómo funciona?</h2>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8 relative">
                        <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-px bg-[#051620]/10" />
                        {PASOS.map((paso) => (
                            <div key={paso.num} className="text-center relative">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white border border-[#e5e5e5] flex items-center justify-center font-display font-bold text-[#051620] relative z-10">
                                    {paso.num}
                                </div>
                                <h3 className="text-[#051620] font-semibold mb-2">{paso.title}</h3>
                                <p className="text-[#666] text-sm leading-relaxed">{paso.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-14">
                        <Button onClick={() => navigate('/agendar')} variant="primary" size="md">
                            Agendar ahora
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-[#e5e5e5]">
                <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <img src={logoDistrikia} alt="Distrikia" className="w-40" />
                    <p className="text-[#666] text-sm">© 2026 Distrikia · Concesionario KIA Colombia</p>
                    <button
                        type="button"
                        onClick={() => window.open('https://distrikia.com.co', '_blank')}
                        className="text-[#666] text-sm hover:text-[#051620] transition-colors cursor-pointer"
                    >
                        distrikia.com.co
                    </button>
                </div>
            </footer>

        </div>
    );
}