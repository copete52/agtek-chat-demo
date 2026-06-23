/**
 * KRE theme following Unisphere theming conventions
 * Can be passed to the Unisphere loader as ui.theme
 */
export const KRE_THEME = {
  mode: 'light',
  palette: {
    primary: {
      light: '#2e89ff',
      main: '#006cfa',
      dark: '#0056c7',
      contrastText: '#ffffff',
    },
    secondary: {
      light: '#60a5fa',
      main: '#3b82f6',
      dark: '#2563eb',
      contrastText: '#ffffff',
    },
    surfaces: {
      background: '#ffffff',
      paper: '#f7f8fa',
      elevated: '#ffffff',
      protection: 'rgba(0,0,0,0.5)',
    },
    tone1: '#1a1a2e',
    tone2: '#374151',
    tone3: '#6b7280',
    tone4: '#9ca3af',
    tone5: '#d1d5db',
    tone6: '#e5e7eb',
    tone7: '#f3f4f6',
    tone8: '#f9fafb',
    danger: { main: '#dc2626', contrastText: '#fff' },
    success: { main: '#16a34a', contrastText: '#fff' },
    warning: { main: '#d97706', contrastText: '#fff' },
    info: { main: '#006cfa', contrastText: '#fff' },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
  },
  shape: {
    roundness1: 8,
    roundness2: 12,
    roundness3: 16,
  },
};

/**
 * CSS custom properties for standalone use (without Unisphere loader)
 */
export const KRE_CSS_VARS = `
  --kre-primary: #006cfa;
  --kre-primary-dark: #0056c7;
  --kre-primary-light: #e8f0fe;
  --kre-bg: #ffffff;
  --kre-bg-paper: #f7f8fa;
  --kre-text: #1a1a2e;
  --kre-text-muted: #6b7280;
  --kre-border: #e5e7eb;
  --kre-radius-sm: 8px;
  --kre-radius-md: 12px;
  --kre-radius-lg: 16px;
  --kre-shadow: 0 8px 32px rgba(0,0,0,0.12);
  --kre-transition: 0.2s ease;
  --kre-success: #16a34a;
  --kre-danger: #dc2626;
`;
