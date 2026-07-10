import clsx from 'clsx';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'dark';

interface BadgeProps {
    children: React.ReactNode;
    tone?: BadgeTone;
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
    return (
        <span
            className={clsx(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                {
                    success: 'bg-green-100 text-green-800',
                    warning: 'bg-yellow-100 text-yellow-800',
                    danger: 'bg-red-100 text-[#8F0F20]',
                    neutral: 'bg-[#f8f8f8] text-[#666666]',
                    dark: 'bg-[#212529] text-white',
                }[tone]
            )}
        >
            {children}
        </span>
    );
}