import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/selector-fecha.css';

registerLocale('es', es);

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface SelectorFechaProps {
    label: string;
    valor: string;
    onCambio: (valorISO: string) => void;
    minFecha?: string;
    maxFecha?: string;
}

function aFecha(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function aISO(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

export function SelectorFecha({ label, valor, onCambio, minFecha, maxFecha }: SelectorFechaProps) {
    const anioActual = new Date().getFullYear();
    const anios = Array.from({ length: 10 }, (_, i) => anioActual - 6 + i);

    return (
        <div>
            <label className="text-xs text-[#666] block mb-1">{label}</label>
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none z-10" />
                <DatePicker
                    selected={aFecha(valor)}
                    onChange={(fecha) => fecha && onCambio(aISO(fecha))}
                    locale="es"
                    dateFormat="d 'de' MMMM, yyyy"
                    minDate={minFecha ? aFecha(minFecha) : undefined}
                    maxDate={maxFecha ? aFecha(maxFecha) : undefined}
                    className="pl-9 pr-3 py-2 text-sm border border-[#e5e5e5] rounded-sm outline-none text-[#051620] focus:border-[#051620] cursor-pointer w-full"
                    renderCustomHeader={({ date, changeYear, changeMonth, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                        <div className="flex items-center justify-between px-2 pb-2">
                            <button
                                type="button"
                                onClick={decreaseMonth}
                                disabled={prevMonthButtonDisabled}
                                className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4 text-white" />
                            </button>

                            <div className="flex gap-1.5">
                                <select
                                    value={date.getMonth()}
                                    onChange={(e) => changeMonth(Number(e.target.value))}
                                    className="bg-white text-[#051620] text-xs font-medium rounded-sm px-2 py-1 outline-none cursor-pointer border border-transparent focus:border-[#F4A100]"
                                >
                                    {MESES.map((mes, i) => (
                                        <option key={mes} value={i}>{mes}</option>
                                    ))}
                                </select>
                                <select
                                    value={date.getFullYear()}
                                    onChange={(e) => changeYear(Number(e.target.value))}
                                    className="bg-white text-[#051620] text-xs font-medium rounded-sm px-2 py-1 outline-none cursor-pointer border border-transparent focus:border-[#F4A100]"
                                >
                                    {anios.map((anio) => (
                                        <option key={anio} value={anio}>{anio}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={increaseMonth}
                                disabled={nextMonthButtonDisabled}
                                className="w-7 h-7 flex items-center justify-center rounded-sm hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    )}
                />
            </div>
        </div>
    );
}