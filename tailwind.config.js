/** @type {import('tailwindcss').Config} */
import themeTokens from './src/config/theme.js';

const { brand, sizing, spacing } = themeTokens;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx,css}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: brand.bg,
          panel: brand.panel,
          border: brand.border,
          text: brand.text,
          muted: brand.muted,
          primary: brand.primary,
          accent: brand.accent,
          success: brand.success,
          warning: brand.warning,
          danger: brand.danger,
        },
      },
      fontSize: {
        'kiosk-title': sizing.kioskTitle,
        'kiosk-rack': sizing.kioskRackText,
        'kiosk-meta': sizing.kioskMeta,
        'admin-title': sizing.adminTitle,
        'admin-body': sizing.adminBody,
        'admin-small': sizing.adminSmall,
      },
      spacing: {
        xs: spacing.xs,
        sm: spacing.sm,
        md: spacing.md,
        lg: spacing.lg,
        xl: spacing.xl,
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
