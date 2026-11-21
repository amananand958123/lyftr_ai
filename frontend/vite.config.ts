import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/health': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/sessions': 'http://localhost:8000',
      '/cache': 'http://localhost:8000',
    },
  },
  preview: {
    port: 3000,
    host: true,
    proxy: {
      '/health': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/sessions': 'http://localhost:8000',
      '/cache': 'http://localhost:8000',
    },
  },
});
