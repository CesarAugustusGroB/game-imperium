import { useEffect, useRef } from 'preact/hooks';
import gladiusCursor from '../../assets/ui/cursor/roman-gladius-cursor-64.png';

/**
 * Bespoke pointer for the Imperium UI: a gladius tip and a soft gold aura,
 * both pinned to the true pointer (zero lag), plus a gold ripple on every
 * click. The native cursor is hidden while this is mounted (via the
 * `imp-cursor-active` class on <html>).
 *
 * Pure event-driven (no RAF) and bows out entirely on coarse-pointer (touch)
 * devices, where a custom cursor is just invisible overhead.
 */
export function CustomCursor() {
  const tipRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only fine pointers (mouse/trackpad) get the custom cursor.
    if (!window.matchMedia?.('(pointer: fine)').matches) return;

    const tip = tipRef.current;
    const aura = auraRef.current;
    const layer = layerRef.current;
    if (!tip || !aura || !layer) return;

    document.documentElement.classList.add('imp-cursor-active');

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let visible = false;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      // Tip and aura are both pinned to the true pointer — zero lag.
      tip.style.transform = `translate(${tx}px, ${ty}px)`;
      aura.style.transform = `translate(${tx}px, ${ty}px) translate(-50%, -50%)`;
      if (!visible) {
        visible = true;
        layer.style.opacity = '1';
      }
    };

    const onDown = () => {
      spawnRipple(tx, ty);
    };
    const onLeave = () => {
      visible = false;
      layer.style.opacity = '0';
    };
    const onEnter = () => {
      visible = true;
      layer.style.opacity = '1';
    };

    const spawnRipple = (x: number, y: number) => {
      const r = document.createElement('div');
      r.className = 'imp-cursor-ripple';
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      layer.appendChild(r);
      // Remove once the one-shot CSS animation finishes.
      r.addEventListener('animationend', () => r.remove(), { once: true });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerenter', onEnter);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
      document.documentElement.classList.remove('imp-cursor-active');
    };
  }, []);

  return (
    <div ref={layerRef} class="imp-cursor-layer" aria-hidden="true" style={{ opacity: 0 }}>
      {/* Aura — soft gold bloom that drifts behind the pointer. */}
      <div ref={auraRef} class="imp-cursor-aura" />
      {/* Tip — gladius point pinned to the true pointer. */}
      <div ref={tipRef} class="imp-cursor-tip">
        <img src={gladiusCursor} alt="" width="48" height="48" />
      </div>
    </div>
  );
}
