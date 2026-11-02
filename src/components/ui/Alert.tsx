import React from 'react';
import { CircleAlert } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 bg-status-danger-soft text-status-danger border border-status-danger-border rounded-xl px-3.5 py-3 text-[13px] leading-snug ${className}`}
      {...props}
    >
      <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} aria-hidden="true" />
      <div className="flex-1">{children}</div>
    </div>
  );
};

