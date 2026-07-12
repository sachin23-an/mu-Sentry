import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',

    watch: {
      ignored: [
        '**/.venv/**',
        '**/__pycache__/**',
        '**/*.pyc/**',
        // FIX: stop Vite reloading the page every time backend writes a CSV
        '**/market_data/**',
        '**/backend/**',
      ]
    },

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },

      '/v1': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },

      '/python-ws': {
        target: 'ws://localhost:5000',
        ws: true,
        changeOrigin: true,   // FIX: was missing, caused WS connection failures
      },
    },
  },

  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});