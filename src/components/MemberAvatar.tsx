import React, { useState } from 'react';
import { User } from 'lucide-react';

interface MemberAvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  className?: string;
  iconClassName?: string;
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  src,
  alt = '',
  name = '',
  className = 'w-10 h-10 rounded-lg',
  iconClassName = 'w-5 h-5',
}) => {
  const [hasError, setHasError] = useState(false);

  const trimmedSrc = src?.trim();
  const showImage = Boolean(trimmedSrc && !hasError);

  // Derive initials from name (up to 2 letters)
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (showImage) {
    return (
      <img
        src={trimmedSrc}
        alt={alt}
        onError={() => setHasError(true)}
        className={`${className} object-cover border border-[#34d399]/40 bg-[#0f172a] shrink-0 transition-all`}
      />
    );
  }

  // Placeholder when no photo is uploaded or image errored
  return (
    <div
      className={`${className} shrink-0 bg-[#0f172a] border border-[#34d399]/40 flex items-center justify-center text-white font-mono font-bold select-none`}
      title={name ? `${name} (Sin foto)` : 'Sin foto'}
    >
      {initials ? (
        <span className="text-[11px] tracking-wider text-white">{initials}</span>
      ) : (
        <User className={`${iconClassName} text-white/60 stroke-[1.5]`} />
      )}
    </div>
  );
};
