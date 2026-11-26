import {useState} from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-7 w-7 rounded-lg',
  md: 'h-8 w-8 rounded-lg',
  lg: 'h-14 w-14 rounded-2xl',
};

export function BrandLogo({size = 'md', className = ''}: BrandLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`${SIZE_CLASSES[size]} flex shrink-0 items-center justify-center bg-[#122B8E] font-semibold text-white select-none ${className}`}
        aria-label="fawzy.ai logo"
      >
        <span className={size === 'lg' ? 'text-xl' : 'text-xs'}>F</span>
      </div>
    );
  }

  return (
    <img
      src="/assets/aistudio/IMG_1442_1043911f.jpg"
      alt="fawzy.ai logo"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${SIZE_CLASSES[size]} shrink-0 border border-[#E2E8F0] bg-white object-cover dark:border-slate-700 ${className}`}
    />
  );
}
