export function marbleBg(base = '#ede4d3', vein = 'rgba(120, 100, 70, 0.08)'): string {
  return `
    radial-gradient(ellipse 800px 300px at 30% 20%, ${vein} 0%, transparent 50%),
    radial-gradient(ellipse 600px 200px at 70% 80%, ${vein} 0%, transparent 50%),
    radial-gradient(ellipse 400px 100px at 80% 30%, ${vein} 0%, transparent 60%),
    linear-gradient(135deg, ${base} 0%, ${base} 100%)
  `;
}

export const NOISE_SVG: string = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
