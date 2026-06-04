/** Print layout tokens — A4, margins, typography, borders. */
export const RECAP_A4 = {
  widthPt: 595,
  heightPt: 842,
} as const;

/** Professional document margins (ISO-friendly). */
export const RECAP_MARGIN_MM = {
  top: 14,
  right: 12,
  bottom: 16,
  left: 12,
} as const;

/** Logo + company lines (fits RECAP_LOGO.heightPt + text). */
export const RECAP_HEADER_CONTENT_MM = 15;
/** Gap between header block and body text. */
export const RECAP_HEADER_GAP_MM = 2;
export const RECAP_FOOTER_BAND_MM = 14;

/** Max height of site map banner in recap PDF/HTML. */
export const RECAP_MAP_DISPLAY_MAX_HEIGHT_MM = 40;

/** Hairline borders render sharply in print (use pt, not px). */
export const RECAP_BORDER_PT = 0.75;

export const RECAP_BRAND = {
  primary: '#F5B301',
  primaryDark: '#C98F00',
  ink: '#1F2937',
  black: '#111827',
  grey900: '#111827',
  grey700: '#374151',
  grey600: '#6B7280',
  grey300: '#D1D5DB',
  grey200: '#E5E7EB',
  grey100: '#F3F4F6',
  grey50: '#F9FAFB',
  white: '#FFFFFF',
  success: '#059669',
  info: '#2563EB',
} as const;

export const RECAP_TYPO = {
  body: '10pt',
  small: '9pt',
  tiny: '8pt',
  h1: '17pt',
  h2: '10.5pt',
  lineBody: 1.5,
  lineTight: 1.35,
  lineHeading: 1.2,
} as const;

export const RECAP_LOGO = {
  heightPt: 39,
  maxWidthPt: 140,
} as const;
