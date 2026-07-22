/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde institucional NEX: mismo idioma cromático del logo y de los
        // informes (masthead #0f3d2e, acento #0f7a4f). Unifica toda la interfaz.
        nex: {
          50: '#eef7f1',
          100: '#d3ecdd',
          200: '#a9d8bd',
          300: '#71bd97',
          400: '#3f9e73',
          500: '#0f7a4f',
          600: '#0c6642',
          700: '#0f5236',
          800: '#0f3d2e',
          900: '#0b2c22',
        },
      },
      fontFamily: {
        // Tipografía del sistema (sin dependencias externas): funciona sin red
        // y respeta la fuente nativa de cada sistema operativo.
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        // Sombras suaves y en capas para dar profundidad sin dureza.
        soft: '0 1px 2px rgba(15, 61, 46, 0.04), 0 8px 24px -12px rgba(15, 61, 46, 0.12)',
        lift: '0 2px 4px rgba(15, 61, 46, 0.05), 0 18px 40px -18px rgba(15, 61, 46, 0.28)',
      },
    },
  },
  plugins: [],
};
