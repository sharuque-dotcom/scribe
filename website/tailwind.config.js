/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './privacy.html', './terms.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF8F4',
        ink: '#151412',
        soft: '#5F5B55',
        line: '#E7E2D9',
        brand: '#4F46E5',
        ember: '#F97316',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        float: '0 30px 60px -20px rgba(21,20,18,.35), 0 10px 20px -10px rgba(21,20,18,.2)',
        card: '0 1px 2px rgba(21,20,18,.06), 0 12px 32px -16px rgba(21,20,18,.18)',
      },
    },
  },
  plugins: [],
}
