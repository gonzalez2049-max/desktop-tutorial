/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta NEX teal-esmeralda: evoluciona el verde del logo hacia un
        // teal/turquesa más moderno y llamativo, manteniendo la familia de la
        // marca. Se usa como acento en toda la interfaz.
        nex: {
          50: '#ecfdf6',
          100: '#cff7e7',
          200: '#a1edd3',
          300: '#63dcbb',
          400: '#2ec4a0',
          500: '#0ea47a',
          600: '#0a8567',
          700: '#0c6a54',
          800: '#0d5244',
          900: '#0a3a32',
        },
        // Acento vivo para chispazos (puntos de estado, brillos, hover).
        aqua: {
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
        },
      },
      fontFamily: {
        // Tipografía del sistema (sin dependencias externas): funciona sin red
        // y respeta la fuente nativa de cada sistema operativo.
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        // Sombras suaves y en capas para dar profundidad sin dureza.
        soft: '0 1px 2px rgba(13, 82, 68, 0.05), 0 8px 24px -12px rgba(13, 82, 68, 0.14)',
        lift: '0 2px 4px rgba(13, 82, 68, 0.06), 0 20px 45px -18px rgba(13, 82, 68, 0.30)',
      },
    },
  },
  plugins: [],
};
