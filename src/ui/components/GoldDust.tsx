import { useEffect, useRef } from 'preact/hooks';

interface GoldDustProps {
  count?: number;
  className?: string;
}

const COLORS = [
  'rgba(212, 168, 67, ',
  'rgba(240, 208, 128, ',
  'rgba(201, 162, 74, ',
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function GoldDust({ count = 14, className }: GoldDustProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let rafId: number | null = null;
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    interface P {
      x: number; y: number; vx: number; vy: number; r: number;
      color: string; alpha: number; alphaDir: 1 | -1; alphaSpeed: number;
    }
    const particles: P[] = Array.from({ length: count }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-0.08, 0.08),
      vy: rand(-0.40, -0.15),
      r: rand(1, 2.5),
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      alpha: rand(0.06, 0.22),
      alphaDir: Math.random() > 0.5 ? 1 : -1,
      alphaSpeed: rand(0.002, 0.006),
    }));

    const step = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += p.alphaDir * p.alphaSpeed;
        if (p.alpha <= 0.04 || p.alpha >= 0.24) p.alphaDir = (p.alphaDir * -1) as 1 | -1;
        if (p.y < -5) { p.y = h + 5; p.x = rand(0, w); }
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        ctx.fillStyle = `${p.color}${p.alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = requestAnimationFrame(step);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (rafId == null) {
        running = true;
        rafId = requestAnimationFrame(step);
      }
    };

    const onResize = () => resize();

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    rafId = requestAnimationFrame(step);

    return () => {
      running = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count]);

  return <canvas ref={canvasRef} class={className} aria-hidden="true" />;
}
