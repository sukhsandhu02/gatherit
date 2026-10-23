// Web Gather color palette: electric blue + cool slate
export const lightPalette = {
  // Backgrounds & Surfaces
  canvas: '#f8fafc',         // Pearl background (var(--brand-bg))
  surface: '#ffffff',        // White surface (var(--brand-surface))
  surfaceElevated: '#f1f5f9',// Card surface (var(--brand-card))
  surfaceHover: '#e2e8f0',
  inputBg: '#f8fafc',

  // Borders
  border: '#e2e8f0',         // Slate 200 (var(--brand-border))
  borderMuted: '#edf2f7',
  borderFocus: '#2447f0',

  // Brand electric blue accents
  brand: '#2447f0',          // Electric blue primary
  brandHover: '#3a63ff',     // Lighter blue hover
  brandLight: '#eef3ff',     // Brand-50 light wash
  brandText: '#ffffff',      // Text inside brand buttons
  brandAccent: '#8dacff',    // Brand-300 secondary mark

  // Text
  textPrimary: '#0f172a',    // Dark slate text
  textSecondary: '#475569',  // Medium slate
  textMuted: '#94a3b8',      // Muted slate 400

  // Status & indicators
  live: '#ef4444',           // Red
  warning: '#f59e0b',        // Amber
  success: '#10b981',        // Emerald
  folder: '#d97706',         // Amber-600 folder icon
  folderBg: '#fef3c7',       // Amber-100 folder pill

  // Constants
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.6)',
};

export const darkPalette = {
  // Backgrounds & Surfaces
  canvas: '#090b0e',         // Dark pearl background (var(--brand-bg))
  surface: '#12151c',        // Dark surface (var(--brand-surface))
  surfaceElevated: '#181c25',// Dark card (var(--brand-card))
  surfaceHover: '#222734',
  inputBg: '#181c25',

  // Borders
  border: '#222734',         // Border slate (var(--brand-border))
  borderMuted: '#1a1f2b',
  borderFocus: '#3a63ff',

  // Brand electric blue accents
  brand: '#2447f0',          // Electric blue primary
  brandHover: '#3a63ff',     // Lighter blue hover
  brandLight: '#1a2b78',     // Brand-900 dark wash
  brandText: '#ffffff',      // Text inside brand buttons
  brandAccent: '#8dacff',    // Brand-300 secondary mark

  // Text
  textPrimary: '#f8fafc',    // Bright text
  textSecondary: '#94a3b8',  // Slate 400
  textMuted: '#64748b',      // Slate 500

  // Status & indicators
  live: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  folder: '#f59e0b',
  folderBg: '#292115',

  // Constants
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.75)',
};

// Default export uses dark palette for backward compatibility while ThemeContext provides reactive theme
export const colors = darkPalette;
export type ColorPalette = typeof darkPalette;
