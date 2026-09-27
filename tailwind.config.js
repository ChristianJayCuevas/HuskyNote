// zinc resolves through CSS variables so dark mode can use GitHub's dark palette
// while light mode keeps Tailwind's stock zinc values (see src/index.css).
const zincShades = [50, 100, 200, 300, 400, 500, 600, 700, 750, 800, 850, 900, 950];
const zinc = Object.fromEntries(
  zincShades.map((shade) => [shade, `rgb(var(--zinc-${shade}) / <alpha-value>)`])
);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        zinc,
        // GitHub dark canvases: canvas.default and canvas.inset
        canvas: {
          DEFAULT: '#0d1117',
          inset: '#010409',
        },
        husky: {
          950: '#050505',
          900: '#0a0a0a',
          850: '#121212',
          800: '#18181b',
          700: '#27272a',
          600: '#3f3f46',
          500: '#52525b',
          400: '#71717a',
          300: '#a1a1aa',
          200: '#d4d4d8',
          100: '#e4e4e7',
          50: '#f4f4f5',
          border: '#27272a',
          surface: '#111113',
        },
        semantic: {
          recording: '#ef4444',
          connected: '#10b981',
          warning: '#f59e0b',
        }
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'elevated': '0 8px 30px rgba(0, 0, 0, 0.6)',
        'spotlight': '0 0 40px -10px rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
