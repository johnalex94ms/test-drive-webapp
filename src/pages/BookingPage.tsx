import { useBookingStore } from '../store/bookingStore';
import { StepVehiculo } from '../components/booking/StepVehiculo';
import { StepZona } from '../components/booking/StepZona';
import { StepFechaHora } from '../components/booking/StepFechaHora';
import { StepCliente } from '../components/booking/StepCliente';

const PASOS = ['Vehículo', 'Ubicación', 'Fecha y hora', 'Tus datos'];

export default function BookingPage() {
    const paso = useBookingStore((s) => s.paso);

    return (
        <div className="min-h-screen bg-[#f8f8f8]">

            {/* Header */}
            <header className="bg-[#051620] py-3">
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    <img
                        src="https://distrikia.com.co/wp-content/uploads/2026/02/distrikia-kia-logo-blanco-2026.webp"
                        alt="Distrikia"
                        className="h-7"
                    />
                    <a href="/" className="text-white/60 text-sm hover:text-white transition-colors">
                        ← Volver al inicio
                    </a>
                </div>
            </header>

            {/* Stepper */}
            <div className="bg-white border-b border-[#e5e5e5]">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {PASOS.map((nombre, i) => {
                            const num = i + 1;
                            const activo = num === paso;
                            const completado = num < paso;
                            return (
                                <div key={nombre} className="flex items-center gap-2">
                                    <div className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${completado ? 'bg-[#051620] text-white' : activo ? 'bg-[#051620] text-white' : 'bg-[#e5e5e5] text-[#666]'}
                  `}>
                                        {completado ? '✓' : num}
                                    </div>
                                    <span className={`text-sm hidden sm:block ${activo ? 'text-[#212529] font-medium' : 'text-[#666]'}`}>
                                        {nombre}
                                    </span>
                                    {i < PASOS.length - 1 && (
                                        <div className={`w-12 md:w-24 h-0.5 mx-2 ${completado ? 'bg-[#051620]/30' : 'bg-[#e5e5e5]'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Contenido del paso */}
            <div className="max-w-6xl mx-auto px-6 py-10">
                {paso === 1 && <StepVehiculo />}
                {paso === 2 && <StepZona />}
                {paso === 3 && <StepFechaHora />}
                {paso === 4 && <StepCliente />}
            </div>

        </div>
    );
}