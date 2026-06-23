import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3104,
    open: true,
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'micron.html'),
    },
  },
});
