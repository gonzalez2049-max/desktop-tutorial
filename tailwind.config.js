/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta NEX "Aurora": índigo-violeta como acento principal, moderno y
        // llamativo. Se combina con destellos fucsia y cian del degradado hero.
        nex: {
          50: '#f2f1ff',
          100: '#e7e4ff',
          200: '#d0caff',
          300: '#b0a5ff',
          400: '#8f7cf9',
          500: '#7458f0',
          600: '#5f3fe0',
          700: '#4f30bf',
          800: '#412a99',
          900: '#2f2072',
        },
        // Acentos vivos para chispazos (puntos de estado, brillos, hover).
        aqua: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
        },
      },
      fontFamily: {
        // Tipografía del sistema (sin dependencias externas): funciona sin red
        // y respeta la fuente nativa de cada sistema operativo.
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        // Sombras suaves y en capas para dar profundidad sin dureza.
        soft: '0 1px 2px rgba(63, 42, 153, 0.05), 0 8px 24px -12px rgba(63, 42, 153, 0.16)',
        lift: '0 2px 4px rgba(63, 42, 153, 0.06), 0 22px 48px -18px rgba(79, 48, 191, 0.34)',
      },
    },
  },
  plugins: [],
};
