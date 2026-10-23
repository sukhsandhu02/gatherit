import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer select-none text-xs font-semibold ${
        isDark
          ? 'bg-[#25201c] hover:bg-[#2e2722] border-[#38312a] text-amber-300 hover:text-amber-200 shadow-2xs'
          : 'bg-[#faf7f2] hover:bg-[#f4efe6] border-[#e7dfd3] text-[#5c5246] hover:text-[#2b2621] shadow-2xs'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 shrink-0 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 shrink-0 transition-transform duration-200 -hover:rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      )}
    </button>
  );
}
