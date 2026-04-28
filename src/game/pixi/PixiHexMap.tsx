import { useEffect, useRef } from 'preact/hooks';
import { Application } from 'pixi.js';

export function PixiHexMap() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let cancelled = false;

    void app
      .init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }
        host.appendChild(app.canvas);
      });

    return () => {
      cancelled = true;
      app.destroy(true);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ position: 'absolute', inset: 0, background: '#070509' }}
    />
  );
}
