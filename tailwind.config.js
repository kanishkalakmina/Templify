/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Application chrome. Values taken from the UI mock.
        app: '#0B0D10',
        sidebar: '#101318',
        toolbar: '#11151A',
        panel: '#151A20',
        raised: '#1B2129',

        line: '#252B33',
        'line-hover': '#3A4250',
        'line-strong': '#333B45',

        ink: '#F5F7FA',
        'ink-1': '#E4E8EE',
        'ink-2': '#D6DBE3',
        'ink-3': '#C9D1DB',
        muted: '#9AA3AF',
        faint: '#68717E',

        accent: '#5B7CFA',
        'accent-hover': '#6E8BFF',
        'accent-text': '#A9BCFF',
        'accent-link': '#8FA6FF',
        'accent-nav': '#C6D2FF',
        violet: '#8B5CF6',

        ok: '#3FD68C',
        warn: '#F1C475',
        danger: '#E7807F',
        'danger-line': '#8A4442',
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
        serif: ["'Source Serif 4'", 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: '8px',
        xl: '9px',
        '2xl': '11px',
        '3xl': '13px',
      },
      boxShadow: {
        pop: '0 18px 40px rgba(0,0,0,.55)',
        modal: '0 30px 80px rgba(0,0,0,.6)',
        toast: '0 14px 34px rgba(0,0,0,.5)',
        thumb: '0 6px 18px rgba(0,0,0,.5)',
        page: '0 24px 60px rgba(0,0,0,.55)',
        'page-lg': '0 24px 70px rgba(0,0,0,.6)',
        float: '0 12px 30px rgba(0,0,0,.5)',
      },
      keyframes: {
        rfin: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rfin: 'rfin .18s ease-out',
      },
    },
  },
  plugins: [],
}
