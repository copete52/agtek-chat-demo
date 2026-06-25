import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3104,
    open: '/agtek.html',
  },
  build: {
    rollupOptions: {
      input: {
        agtek: resolve(__dirname, 'agtek.html'),
        micron: resolve(__dirname, 'micron.html'),
      },
    },
  },
});
