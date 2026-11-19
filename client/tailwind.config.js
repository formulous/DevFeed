const sizes = ['xs', 'sm', 'base', 'lg'];
const weights = ['regular', 'medium', 'semibold', 'bold'];

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../onyx-ui/src/**/*.{ts,tsx}'],
  safelist: [
    ...sizes.map((s) => `text-[length:var(--font-size-${s})]`),
    ...weights.map((w) => `font-[var(--font-weight-${w})]`),
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: 'var(--color-primary)', soft: '#eff6ff' },
        app: 'var(--color-bg-app)',
        surface: 'var(--color-bg-surface)',
        fg: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        line: 'var(--color-border)',
      },
    },
  },
  plugins: [],
};
