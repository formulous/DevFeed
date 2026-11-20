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
      boxShadow: { pop: 'var(--shadow-pop)' },
      colors: {
        brand: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
          line: 'var(--color-primary-line)',
          ring: 'var(--color-primary-ring)',
          focus: 'color-mix(in srgb, var(--color-primary-ring) 40%, transparent)',
        },
        app: 'var(--color-bg-app)',
        surface: 'var(--color-bg-surface)',
        fg: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        line: { DEFAULT: 'var(--color-border)', strong: 'var(--color-border-strong)' },
        hover: 'var(--color-bg-hover)',
        subtle: { DEFAULT: 'var(--color-bg-subtle)', strong: 'var(--color-bg-subtle-strong)' },
        input: 'var(--color-bg-input)',
        inverse: 'var(--color-inverse)',
        'on-inverse': 'var(--color-on-inverse)',
        'on-brand': 'var(--color-on-primary)',
        danger: { DEFAULT: 'var(--color-danger)', soft: 'var(--color-danger-soft)', line: 'var(--color-danger-line)' },
        'on-danger': 'var(--color-on-danger)',
        success: { DEFAULT: 'var(--color-success)', soft: 'var(--color-success-soft)' },
        warn: 'var(--color-warn)',
        hot: { DEFAULT: 'var(--color-hot)', soft: 'var(--color-hot-soft)' },
        overlay: 'var(--color-overlay)',
      },
    },
  },
  plugins: [],
};
