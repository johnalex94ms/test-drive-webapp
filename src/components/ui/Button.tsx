import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
}

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    className,
    children,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            className={clsx(
                'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm cursor-pointer',
                {
                    sm: 'px-4 py-2 text-sm',
                    md: 'px-6 py-3 text-sm',
                    lg: 'px-8 py-4 text-base',
                }[size],
                {
                    primary: 'bg-[#000000] text-white hover:bg-[#212529] active:scale-[0.98]',
                    secondary: 'bg-[#BB162B] text-white hover:bg-[#8F0F20] active:scale-[0.98]',
                    ghost: 'bg-transparent text-[#212529] border border-[#212529] hover:bg-[#f8f8f8]',
                    danger: 'bg-[#BB162B] text-white hover:opacity-90',
                }[variant],
                className
            )}
            {...props}
        >
            {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            {children}
        </button>
    );
}