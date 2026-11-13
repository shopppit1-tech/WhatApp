import { useState } from 'react';
import { Users } from 'lucide-react';
import { getInitials } from '../utils/chatHelpers';

interface AvatarProps {
  name: string;
  src?: string;
  bg?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isGroup?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-2xl',
};

export function Avatar({
  name,
  src,
  bg = '#00A884',
  size = 'md',
  isGroup = false,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = SIZE_CLASSES[size];

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={`Foto profil ${name}`}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${dim} rounded-full object-cover shrink-0 bg-slate-200 dark:bg-slate-700`}
      />
    );
  }

  return (
    <div
      style={{ backgroundColor: bg }}
      className={`${dim} rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none`}
      aria-label={`Avatar ${name}`}
    >
      {isGroup ? <Users className="w-1/2 h-1/2" aria-hidden="true" /> : getInitials(name)}
    </div>
  );
}
