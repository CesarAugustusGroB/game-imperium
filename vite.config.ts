import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [glsl(), preact()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
