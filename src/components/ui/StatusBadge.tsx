import React from 'react';
import { LucideIcon } from 'lucide-react';
import { MembershipTone, TONE_CLASSES } from '../../lib/status';

export interface StatusBadgeProps {
  tone: MembershipTone;
  children: React.ReactNode;
  icon?: LucideIcon | React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone,
  children,
  icon: Icon,
  className = '',
}) => {
  const colors = TONE_CLASSES[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full text-xs font-bold border select-none ${colors.bg} ${colors.text} ${colors.border} ${className}`}
    >
      {Icon ? (
        <Icon size={13} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
      ) : (
        <span
          className={`w-[6px] h-[6px] rounded-full shrink-0 ${colors.solid}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};

