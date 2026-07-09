import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// En producción (build y preview) la app se sirve desde el subdirectorio
// /desktop-tutorial/ (GitHub Pages). En desarrollo (npm run dev) se usa la raíz "/".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/desktop-tutorial/' : '/',
}));
