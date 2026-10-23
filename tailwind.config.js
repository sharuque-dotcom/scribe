/** @type {import('tailwindcss').Config} */
export default {
  content: ['./editor.html', './popup.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        rec: 'rgb(var(--rec) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px -12px rgb(0 0 0 / 0.15)',
      },
    },
  },
  plugins: [],
}
