import React, { forwardRef } from 'react';
import { Loader2, LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

interface BaseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
  loading?: boolean;
}

export type ButtonProps =
  | (BaseButtonProps & {
      iconOnly: true;
      'aria-label': string;
    })
  | (BaseButtonProps & {
      iconOnly?: false;
      'aria-label'?: string;
    });

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconOnly = false,
      loading = false,
      disabled = false,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isPrimary = variant === 'primary';
    const iconStroke = isPrimary ? 2.5 : 2;

    const variantClasses = {
      primary: 'bg-accent text-ink-on-accent hover:bg-accent-hover',
      secondary:
        'bg-transparent border border-border-default text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      ghost:
        'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      danger:
        'bg-status-danger-soft text-status-danger hover:bg-status-danger-soft/80',
    }[variant];

    const sizeClasses = iconOnly
      ? 'w-9 h-9 min-w-[36px] min-h-[36px] p-0 rounded-[10px]'
      : size === 'lg'
      ? 'h-[52px] px-5 rounded-[14px] text-[15px] font-extrabold gap-2.5'
      : 'h-11 px-4 rounded-xl text-sm font-semibold gap-2';

    const baseClasses =
      'inline-flex items-center justify-center transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 focus:outline-none';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2
            size={17}
            strokeWidth={iconStroke}
            className="animate-spin shrink-0"
            aria-hidden="true"
          />
        ) : Icon ? (
          <Icon
            size={17}
            strokeWidth={iconStroke}
            className="shrink-0"
            aria-hidden="true"
          />
        ) : null}
        {iconOnly ? (!loading && !Icon ? children : null) : children}
      </button>
    );
  }
);

Button.displayName = 'Button';

