// frontend/vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],            // Tailwind CSS v4 como plugin de Vite
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' }, // las peticiones /api van al backend Express
  },
});
