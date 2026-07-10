import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className=" bg-white text-[#051620]">

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#051620] border-b border-white/10">
                <div className="flex items-center gap-3">
                    <img src="https://distrikia.com.co/wp-content/uploads/2026/02/distrikia-kia-logo-blanco-2026.webp" alt="Distrikia" className="h-8" />
                </div>
                <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
                    <a href="#vehiculos" className="hover:text-white transition-colors">Vehículos</a>
                    <a href="#como-funciona" className="hover:text-white transition-colors">¿Cómo funciona?</a>
                    <a href="#sedes" className="hover:text-white transition-colors">Sedes</a>
                </nav>
                <Button onClick={() => navigate('/agendar')} variant="primary" size="sm">
                    Agendar prueba
                </Button>
            </header>

            {/* Hero */}
            <section className="relative top-[65px] h-screen w-full flex flex-col items-center justify-center bg-[#051620]">

                {/* Contenido central */}
                <div className="z-10 text-center max-w-3xl mx-auto flex flex-col justify-center items-center box-border h-full">
                    <p className="text-white/50 text-xs font-medium uppercase tracking-[0.3em] mb-3">
                        Distrikia · Concesionario KIA
                    </p>
                    <h1 className="font-display text-4xl md:text-7xl font-bold leading-none mb-5 text-white">
                        Siente la diferencia.<br />
                        <span className="text-white/60">Maneja un KIA.</span>
                    </h1>
                    <p className="text-white/60 text-lg md:text-xl max-w-1xl mx-auto mb-5">
                        Agenda tu prueba de ruta en minutos. Te llevamos el carro hasta tu
                        ubicación o visítanos en nuestras sedes.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button onClick={() => navigate('/agendar')} variant="primary" size="lg">
                            Agendar mi prueba de ruta
                        </Button>
                        <Button
                            onClick={() => navigate('/agendar')}
                            variant="ghost"
                            size="lg"
                            className="border-white/30 text-white hover:bg-white/10"
                        >
                            Ver vehículos disponibles
                        </Button>
                    </div>
                </div>

                {/* Trust badges — separados del contenido */}
                <div className="w-full bg-white/5 border-t border-white/10">
                    <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-white font-semibold text-sm">Experto asignado</p>
                            <p className="text-white/40 text-xs mt-1">Te acompaña en toda la prueba</p>
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm">Te recogemos</p>
                            <p className="text-white/40 text-xs mt-1">Llevamos el KIA hasta ti</p>
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm">Confirmación inmediata</p>
                            <p className="text-white/40 text-xs mt-1">Correo al instante</p>
                        </div>
                    </div>
                </div>

            </section>

            {/* Cómo funciona */}
            <section id="como-funciona" className="py-24 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-[#051620]/40 text-sm uppercase tracking-widest mb-3">Proceso simple</p>
                        <h2 className="font-display text-4xl font-bold text-[#051620]">¿Cómo funciona?</h2>
                    </div>
                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            { num: '01', title: 'Elige tu KIA', desc: 'Selecciona el modelo que quieres probar entre todo el catálogo Distrikia.' },
                            { num: '02', title: 'Tu ubicación', desc: 'Dinos dónde estás. Si hay cobertura, el carro va hasta ti.' },
                            { num: '03', title: 'Elige fecha y hora', desc: 'Ve la disponibilidad real y reserva el horario que más te convenga.' },
                            { num: '04', title: 'Disfruta la ruta', desc: 'Un experto KIA te acompaña y resuelve todas tus dudas en el camino.' },
                        ].map((paso) => (
                            <div key={paso.num} className="text-center">
                                <div className="text-5xl font-display font-bold text-[#051620]/10 mb-3">{paso.num}</div>
                                <h3 className="text-[#051620] font-semibold mb-2">{paso.title}</h3>
                                <p className="text-[#666666] text-sm leading-relaxed">{paso.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="text-center mt-12">
                        <Button onClick={() => navigate('/agendar')} variant="primary" size="lg">
                            Agendar ahora
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#051620] py-8 px-6">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <img src="https://distrikia.com.co/wp-content/uploads/2023/01/logo-distrikia.svg" alt="Distrikia" className="h-6 opacity-70" />
                    <p className="text-white/30 text-sm">© 2025 Distrikia · Concesionario KIA Colombia</p>
                    <a href="https://distrikia.com.co" target="_blank" rel="noreferrer" className="text-white/30 text-sm hover:text-white/60 transition-colors">
                        distrikia.com.co
                    </a>
                </div>
            </footer>

        </div>
    );
}