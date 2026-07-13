import { useState, type InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    required?: boolean;
    icon?: LucideIcon;
}

export function Input({ label, error, required, className, id, icon: Icon, type, ...props }: InputProps) {
    const [verClave, setVerClave] = useState(false);
    const esPassword = type === 'password';
    const tipoFinal = esPassword ? (verClave ? 'text' : 'password') : type;

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={id} className="text-sm font-medium text-[#212529]">
                    {label} {required && <span className="text-[#BB162B]">*</span>}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
                )}
                <input
                    id={id}
                    type={tipoFinal}
                    className={clsx(
                        'w-full px-4 py-3 text-sm border border-[#e5e5e5] rounded-sm outline-none transition-colors text-[#212529] placeholder:text-[#aaa]',
                        'focus:border-[#051620] focus:ring-2 focus:ring-[#051620]/20',
                        Icon && 'pl-10',
                        esPassword && 'pr-10',
                        error && 'border-[#BB162B]',
                        className
                    )}
                    {...props}
                />
                {esPassword && (
                    <button
                        type="button"
                        onClick={() => setVerClave((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#051620] cursor-pointer"
                    >
                        {verClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>
            {error && <span className="text-xs text-[#BB162B]">{error}</span>}
        </div>
    );
}