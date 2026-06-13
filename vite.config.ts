import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig({
  plugins: [
    preact(),
    imagetools({
      // Plan S-K (D28c): transcode the many heavy UI-icon PNGs to WebP by default.
      // Format-only (NO resize) → resolution is preserved, so icons rendered large
      // (GameIcon accepts numeric sizes up to ~300px) are not softened. Imports with
      // explicit directives (e.g. the ?...&as=picture / ?format=webp backgrounds)
      // override these defaults; non-icon paths get no default directive.
      defaultDirectives: (url) => {
        const p = url.pathname;
        if (p.includes('/assets/ui/icons/') || p.includes('/assets/ui/resources/')) {
          return new URLSearchParams({ format: 'webp', quality: '85' });
        }
        return new URLSearchParams();
      },
    }),
  ],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});
