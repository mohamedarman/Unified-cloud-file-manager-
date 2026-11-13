import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
    watch: {
      ignored: [
        '**/app/**',
        '**/domain/**',
        '**/core/**',
        '**/data/**',
        '**/cloud/**',
        '**/gradle/**',
        '**/.gradle/**',
        '**/build/**',
        '**/dist/**',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-icons': ['lucide-react'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
