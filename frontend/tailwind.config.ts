import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    // Scan the shared marketing-chrome package so its Tailwind classes
    // (used inside MarketingNav / Footer / docs scaffold) get extracted
    // into our CSS bundle. Required by every consumer of @forjio/website-ui.
    './node_modules/@forjio/website-ui/dist/**/*.{js,cjs}',
  ],
  theme: {
    extend: {
      colors: {
        // Twilio-red brand palette (#F22F46 ≈ red-500)
        brand: {
          50:  '#FFF1F3',
          100: '#FFE0E5',
          200: '#FFC1CC',
          300: '#FF93A7',
          400: '#FA5C7A',
          500: '#F22F46', // primary
          600: '#D81F38',
          700: '#B41530',
          800: '#92142D',
          900: '#7A152C',
          950: '#430713',
        },
        ink: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#0B0F1A',
        },
        paper: '#FAF7F5', // warm off-white canvas
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
        },
        header: {
          DEFAULT: 'hsl(var(--header))',
          foreground: 'hsl(var(--header-foreground))',
          border: 'hsl(var(--header-border))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { none: '0', sm: '4px', md: '6px', lg: '8px', xl: '12px', full: '9999px' },
      boxShadow: {
        xs: '0 1px 2px rgba(11, 15, 26, 0.04)',
        sm: '0 1px 3px rgba(11, 15, 26, 0.06), 0 1px 2px rgba(11, 15, 26, 0.04)',
        md: '0 4px 8px rgba(11, 15, 26, 0.06), 0 2px 4px rgba(11, 15, 26, 0.04)',
        lg: '0 10px 20px rgba(11, 15, 26, 0.08), 0 4px 8px rgba(11, 15, 26, 0.04)',
        focus: '0 0 0 2px hsl(var(--ring)), 0 0 0 4px rgba(242, 47, 70, 0.15)',
      },
      spacing: { sidebar: '256px', header: '64px' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
