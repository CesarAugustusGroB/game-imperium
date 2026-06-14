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
    rollupOptions: {
      output: {
        // D28b — split the single ~600 kB app chunk into named chunks by subsystem.
        // Static imports stay eager (load order is preserved by the import graph, so
        // runtime behaviour is unchanged), but the bundle is broken up so the stable
        // vendor/data code caches independently of churn-heavy UI, and the
        // >500 kB single-chunk warning clears. Lazy deferral (dynamic import) is a
        // documented follow-up that needs live route validation.
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/game/iterBelli/battle/') || id.includes('/ui/screens/iterbelli/')) return 'battle';
          if (id.includes('/ui/screens/forum/')) return 'forum';
          if (id.includes('/src/data/')) return 'data';
          return undefined;
        },
      },
    },
  },
});
