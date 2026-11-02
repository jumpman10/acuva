import React, { forwardRef } from 'react';

export type InputVariant = 'portal' | 'admin';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: InputVariant;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = 'admin', mono = false, className = '', ...props }, ref) => {
    const variantClasses =
      variant === 'portal'
        ? 'h-[54px] bg-surface-portal rounded-[14px] text-[17px] px-4'
        : 'h-11 bg-surface-sunken rounded-xl text-sm px-3.5';

    const fontClasses = mono ? 'font-mono tracking-[0.04em]' : '';

    return (
      <input
        ref={ref}
        className={`w-full border border-border-default text-text-primary placeholder:text-text-faint focus:border-accent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses} ${fontClasses} ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

