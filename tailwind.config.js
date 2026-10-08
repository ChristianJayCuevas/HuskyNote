import animate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';
import plugin from 'tailwindcss/plugin';

// Design tokens live in src/index.css (shadcn v3 format: HSL channels, light in :root, dark in .dark).
// slate and zinc resolve through rgb channel variables so untouched pages pick up the Notion grays:
// slate is the warm light ramp in both themes, zinc flips to the Notion dark ramp under .dark.
const neutralShades = [50, 100, 200, 300, 400, 500, 600, 700, 750, 800, 850, 900, 950];
const ramp = (name) =>
  Object.fromEntries(neutralShades.map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`]));
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

// Prose follows the tokens directly, so `dark:prose-invert` and gray modifiers are not needed (and are no-ops).
const proseColors = {
  body: 'hsl(var(--foreground))',
  headings: 'hsl(var(--foreground))',
  lead: 'hsl(var(--muted-foreground))',
  links: 'hsl(var(--foreground))',
  bold: 'hsl(var(--foreground))',
  counters: 'hsl(var(--muted-foreground))',
  bullets: 'hsl(var(--muted-foreground))',
  hr: 'hsl(var(--border))',
  quotes: 'hsl(var(--foreground))',
  'quote-borders': 'hsl(var(--foreground))',
  captions: 'hsl(var(--muted-foreground))',
  kbd: 'hsl(var(--foreground))',
  'kbd-shadows': '128 128 128',
  code: 'hsl(var(--foreground))',
  'pre-code': 'hsl(var(--foreground))',
  'pre-bg': 'hsl(var(--muted))',
  'th-borders': 'hsl(var(--border))',
  'td-borders': 'hsl(var(--border))',
};
const proseVars = Object.fromEntries(
  Object.entries(proseColors).flatMap(([key, value]) => [
    [`--tw-prose-${key}`, value],
    [`--tw-prose-invert-${key}`, value],
  ])
);

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // --font-brand-* are defined by src/brand/fonts.css (bundled Geist, no network requests)
        sans: [
          'var(--font-brand-sans)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        mono: [
          'var(--font-brand-mono)',
          'ui-monospace',
          '"Cascadia Code"',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        slate: ramp('slate'),
        zinc: ramp('zinc'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        success: token('success'),
        warning: token('warning'),
        info: token('info'),
        paper: { DEFAULT: token('paper'), foreground: token('paper-foreground') },
        sidebar: {
          DEFAULT: token('sidebar-background'),
          foreground: token('sidebar-foreground'),
          primary: token('sidebar-primary'),
          'primary-foreground': token('sidebar-primary-foreground'),
          accent: token('sidebar-accent'),
          'accent-foreground': token('sidebar-accent-foreground'),
          border: token('sidebar-border'),
          ring: token('sidebar-ring'),
        },
        chart: {
          1: token('chart-1'),
          2: token('chart-2'),
          3: token('chart-3'),
          4: token('chart-4'),
          5: token('chart-5'),
        },
        // @deprecated GitHub-era canvas names, kept so unconverted classes resolve. Use bg-background / bg-sidebar.
        canvas: {
          DEFAULT: token('background'),
          inset: token('sidebar-background'),
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-xl)',
        // @deprecated aliases
        subtle: 'var(--shadow-xs)',
        elevated: 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            ...proseVars,
            a: { textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: '500' },
            code: {
              backgroundColor: 'hsl(var(--muted))',
              borderRadius: 'calc(var(--radius) - 4px)',
              padding: '0.125rem 0.25rem',
              fontSize: '85%',
              fontWeight: '400',
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            // Notion-style quote: a plain left rule, no typographic quote marks or italics
            blockquote: { fontStyle: 'normal', fontWeight: '400', borderInlineStartWidth: '3px' },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            pre: { border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' },
            'pre code': { backgroundColor: 'transparent', padding: '0', fontSize: 'inherit', borderRadius: '0' },
          },
        },
        // Gray modifiers would hardcode Tailwind's stock palettes; keep them on the tokens
        slate: { css: proseVars },
        gray: { css: proseVars },
        zinc: { css: proseVars },
        neutral: { css: proseVars },
        stone: { css: proseVars },
      },
    },
  },
  plugins: [
    animate,
    typography,
    plugin(({ addVariant }) => {
      addVariant('coarse', '@media (pointer: coarse)');
    }),
  ],
};
