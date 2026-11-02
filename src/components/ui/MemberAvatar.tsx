import React, { useState } from 'react';
import { User } from 'lucide-react';

export type AvatarShape = 'circle' | 'square';

export interface MemberAvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  className?: string;
  iconClassName?: string;
  shape?: AvatarShape;
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  src,
  alt = '',
  name = '',
  className = 'w-10 h-10',
  iconClassName = 'w-5 h-5',
  shape = 'circle',
}) => {
  const [hasError, setHasError] = useState(false);

  const trimmedSrc = src?.trim();
  const showImage = Boolean(trimmedSrc && !hasError);

  const shapeClass = shape === 'square' ? 'rounded-2xl' : 'rounded-full';
  const cleanClassName = className.replace(/\brounded-\S+/g, '').trim();

  // Derive initials from name (up to 2 letters)
  const initials = name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '';

  if (showImage) {
    return (
      <img
        src={trimmedSrc}
        alt={alt || name?.trim() || 'Avatar'}
        crossOrigin="anonymous"
        onError={() => setHasError(true)}
        className={`${shapeClass} object-cover border border-accent-border shrink-0 ${cleanClassName}`}
      />
    );
  }

  return (
    <div
      className={`${shapeClass} shrink-0 bg-avatar-bg border border-accent-border flex items-center justify-center text-accent font-extrabold select-none ${cleanClassName}`}
      title={name?.trim() || undefined}
    >
      {initials ? (
        <span className="text-[13px] tracking-wider leading-none">{initials}</span>
      ) : (
        <User className={`${iconClassName} text-accent/60`} strokeWidth={2} />
      )}
    </div>
  );
};

