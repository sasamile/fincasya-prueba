'use client';

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from '@teispace/next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { useTheme } from '@teispace/next-themes';
