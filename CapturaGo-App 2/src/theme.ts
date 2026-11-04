// "Paper & Clay" — the same design tokens as the website (style.css :root).
export const color = {
  clay: '#B04722',        // the one accent: buttons, links, active states
  clayLight: '#D97A4C',
  clayDim: 'rgba(176,71,34,0.10)',
  canvas: '#FAF3E7',      // page background
  sand: '#F1E6D4',        // structural / secondary surface
  card: '#FFFFFF',
  input: '#F6EDE0',
  text: '#241A10',
  muted: '#6B5842',
  dim: '#7D6A53',
  border: 'rgba(36,26,16,0.11)',
  borderStrong: 'rgba(36,26,16,0.22)',
  ink: '#211911',
  inkText: '#F6ECDD',
  ok: '#2F6B45',
  okDim: 'rgba(47,107,69,0.10)',
  err: '#A42638',
  errDim: 'rgba(164,38,56,0.08)',
  onClay: '#FFFBF5',
} as const;

// Three weights only (400 display serif, 500 UI, 600 emphasis) — same as the website
export const font = {
  display: 'Fraunces_400Regular',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'Inter_500Medium',
  bold: 'Inter_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

// 44pt minimum touch target (Apple HIG) / 48dp (Material)
export const TOUCH = 48;
