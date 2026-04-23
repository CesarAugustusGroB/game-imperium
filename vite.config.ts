import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig({
  plugins: [preact(), imagetools()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
