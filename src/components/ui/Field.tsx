import React from 'react';

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  htmlFor,
  className = '',
  children,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || hint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-bold text-text-secondary">
              {label}
            </label>
          )}
          {hint && (
            <span className="text-[13px] font-medium text-text-muted">
              {hint}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

