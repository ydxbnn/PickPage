export type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  danger: string;
  dangerSurface: string;
  success: string;
};

export const lightPalette: Palette = {
  background: '#F6F5F0',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEDE6',
  text: '#20231F',
  textSecondary: '#7D8176',
  border: '#E4E1D8',
  accent: '#2E6B5A',
  danger: '#C93F3A',
  dangerSurface: '#FBEAE7',
  success: '#2E7D5B',
};

export const darkPalette: Palette = {
  background: '#111310',
  surface: '#1B1E1A',
  surfaceMuted: '#262A25',
  text: '#EDEEE8',
  textSecondary: '#9A9F94',
  border: '#2D312B',
  accent: '#7BC4AE',
  danger: '#FF6B63',
  dangerSurface: '#3A211F',
  success: '#64C89F',
};
