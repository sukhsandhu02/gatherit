interface LogoMarkProps {
  className?: string;
  variant?: 'brand' | 'terracotta';
}

/**
 * Gather brand mark: points converging on a central lens.
 * Sized via className (defaults to filling its container).
 */
export function LogoMark({ className = 'w-10 h-10', variant = 'brand' }: LogoMarkProps) {
  const bg = variant === 'terracotta' ? '#a05e44' : '#2447f0';
  const dot = variant === 'terracotta' ? '#deb09d' : '#8dacff';

  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Gather" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="12" fill={bg} />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#fff" strokeWidth="2.4" strokeDasharray="52 17" strokeLinecap="round" transform="rotate(-70 20 20)" />
      <circle cx="20" cy="20" r="4.2" fill="#fff" />
      <circle cx="31" cy="10.5" r="2.4" fill={dot} />
    </svg>
  );
}
