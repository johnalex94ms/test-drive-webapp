import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    selected?: boolean;
    hoverable?: boolean;
}

export function Card({ children, className, onClick, selected, hoverable }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={clsx(
                'bg-white border rounded-sm p-5 transition-all duration-150',
                onClick || hoverable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : '',
                selected
                    ? 'border-[#BB162B] ring-2 ring-[#BB162B]/30 shadow-sm'
                    : 'border-[#e5e5e5]',
                className
            )}
        >
            {children}
        </div>
    );
}