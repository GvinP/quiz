import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project site на GitHub Pages живёт по /quiz/, а не в корне домена.
// Без base ассеты соберутся с абсолютными путями от / и не найдутся.
export default defineConfig({
  base: '/quiz/',
  plugins: [react()],
});
