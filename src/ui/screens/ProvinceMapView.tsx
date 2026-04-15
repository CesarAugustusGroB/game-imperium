import { useRef, useEffect, useCallback, useState } from 'preact/hooks';
import { topologyData, territoryMap, claimedIndices, getAllTerritoryPositions } from '../../game/province/province-map-store';
import { provinces } from '../../game/province/province-store';
import { selectedCommander } from '../../game/core/game-state';
import { FACTION_COLORS } from '../../game/core/commander';

// ── Props ──

interface ProvinceMapViewProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// ── Module-level terrain image cache ──

let cachedTerrainImage: HTMLImageElement | null = null;
let terrainLoadPromise: Promise<HTMLImageElement> | null = null;

function loadTerrainImage(): Promise<HTMLImageElement> {
  if (cachedTerrainImage) return Promise.resolve(cachedTerrainImage);
  if (terrainLoadPromise) return terrainLoadPromise;

  terrainLoadPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cachedTerrainImage = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load terrain_map.png'));
    img.src = '/textures/v2/terrain_map.png';
  });

  return terrainLoadPromise;
}

import type { Province } from '../../game/province/province';

// ── Drawing constants ──

const RADIUS_SELECTED = 8;
const RADIUS_OWNED = 5;
const RADIUS_UNCLAIMED = 3;
const CLICK_HIT_RADIUS = 15;
const LABEL_FONT = '9px "Segoe UI", system-ui, sans-serif';
const CSS_HEIGHT = 200;

/** Wealth tier → dot color (S19-07). */
function getWealthDotColor(province: Province): string {
  const w = province.wealth;
  if (province.rebellionCount >= 3) return '#666666'; // Ruined — gray
  if (w < 20) return '#c24a3a';  // Destitute — red
  if (w < 50) return '#d4a843';  // Poor — orange
  if (w < 100) return '#c8c0a8'; // Growing — off-white
  if (w < 200) return '#5a8a4a'; // Prosperous — green
  return '#f0d080';              // Wealthy — gold
}

/** Unrest dot radius: 0 below 30, scales 2–5 from 30 to 80+. */
function getUnrestRadius(unrest: number): number {
  if (unrest < 30) return 0;
  return 2 + Math.min(3, (unrest - 30) / 50 * 3);
}

// ── Component ──

export function ProvinceMapView({ selectedId, onSelect }: ProvinceMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveringMarker, setHoveringMarker] = useState(false);

  // Store latest marker positions so click handler can use them without re-subscribing.
  const markersRef = useRef<Array<{ roguelikeId: string; x: number; y: number }>>([]);

  // ── DPI-aware canvas sizing ──
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const newW = Math.round(rect.width * dpr);
    const newH = Math.round(CSS_HEIGHT * dpr);

    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas for DPI on mount and whenever the container resizes
    updateCanvasSize();

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
      // Re-trigger draw after resize (animFrame will pick up next tick)
    });
    observer.observe(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Read all reactive signal values to subscribe ──
    const topology = topologyData.value;
    void territoryMap.value;       // subscribe to signal
    const _claimedIndices = claimedIndices.value;
    const allProvinces = provinces.value;
    const commander = selectedCommander.value;

    const factionColor = commander ? FACTION_COLORS[commander.faction] : '#d4a843';

    // Build province lookup by roguelike ID for fast access
    const provinceById = new Map(allProvinces.map(p => [p.id, p]));

    function draw(terrain: HTMLImageElement | null, pulseTime: number) {
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width;
      const H = canvas.height;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Use logical (CSS) dimensions for drawing coordinates
      const lW = W / dpr;
      const lH = H / dpr;

      ctx.clearRect(0, 0, lW, lH);

      // ── Background ──
      ctx.fillStyle = 'rgba(12, 10, 24, 1)';
      ctx.fillRect(0, 0, lW, lH);

      if (terrain) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(terrain, 0, 0, lW, lH);
        ctx.globalAlpha = 1;
      }

      // Subtle dark vignette overlay
      const vignette = ctx.createRadialGradient(lW / 2, lH / 2, lH * 0.2, lW / 2, lH / 2, lH * 0.9);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, lW, lH);

      if (!topology) {
        // No topology yet — show placeholder text
        ctx.fillStyle = 'rgba(180, 170, 150, 0.3)';
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Loading map...', lW / 2, lH / 2);
        ctx.restore();
        return;
      }

      const allCenters = topology.centers;

      // ── Unclaimed province dots (dim gray, show full map shape) ──
      for (const [indexStr, uv] of Object.entries(allCenters)) {
        const idx = Number(indexStr);
        if (_claimedIndices.has(idx)) continue;

        const x = uv[0] * lW;
        const y = uv[1] * lH;

        ctx.beginPath();
        ctx.arc(x, y, RADIUS_UNCLAIMED, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(140, 130, 120, 0.22)';
        ctx.fill();
      }

      // ── Owned territory markers ──
      const positions = getAllTerritoryPositions();
      const newMarkers: Array<{ roguelikeId: string; x: number; y: number }> = [];

      for (const { roguelikeId, uv } of positions) {
        const x = uv[0] * lW;
        const y = uv[1] * lH;

        newMarkers.push({ roguelikeId, x, y });

        const province = provinceById.get(roguelikeId);
        const isSelected = roguelikeId === selectedId;
        const isRuined = province && province.rebellionCount >= 3;
        const radius = isSelected ? RADIUS_SELECTED : RADIUS_OWNED;

        // Wealth-tier dot color (S19-07)
        const dotColor = province ? getWealthDotColor(province) : factionColor;

        // Glow halo (semi-transparent, larger circle) — pulse for selected
        const glowRadius = radius + 5;
        const pulseGlow = isSelected ? glowRadius + 2 * Math.sin(pulseTime * 3) : glowRadius;
        const glowAlpha = isSelected ? 0.35 : 0.18;
        ctx.beginPath();
        ctx.arc(x, y, pulseGlow, 0, Math.PI * 2);
        ctx.fillStyle = dotColor + Math.round(glowAlpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, pulseGlow + 4, 0, Math.PI * 2);
          ctx.strokeStyle = dotColor + '55';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isRuined ? '#444444' : (isSelected ? dotColor : dotColor + 'cc');
        ctx.fill();

        // Dot border
        ctx.strokeStyle = isSelected ? '#fff8e0' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = isSelected ? 1.5 : 0.8;
        ctx.stroke();

        // Ruined X mark (S19-07)
        if (isRuined) {
          ctx.strokeStyle = '#e04040';
          ctx.lineWidth = 1.5;
          const s = radius * 0.5;
          ctx.beginPath();
          ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
          ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
          ctx.stroke();
        }

        // Province name label
        if (province) {
          ctx.font = LABEL_FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const label = province.name;
          const labelY = y + radius + 2;

          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillText(label, x + 1, labelY + 1);
          ctx.fillStyle = isSelected ? '#fff8e0' : 'rgba(240, 230, 200, 0.75)';
          ctx.fillText(label, x, labelY);
        }

        // Unrest indicator — red dot scaled by severity (S19-07)
        const unrest = province?.unrest ?? 0;
        const unrestR = getUnrestRadius(unrest);
        if (unrestR > 0) {
          ctx.beginPath();
          ctx.arc(x + radius - 1, y - radius + 1, unrestR, 0, Math.PI * 2);
          ctx.fillStyle = '#e04040';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // Feature indicator — small gold star (S19-07)
        if (province?.uniqueFeature) {
          ctx.font = '7px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#f0d080';
          ctx.fillText('★', x, y - radius - 1);
        }
      }

      markersRef.current = newMarkers;
      ctx.restore();
    }

    // ── Animation loop ──
    let animFrame: number;
    let pulseTime = 0;

    function animate() {
      pulseTime = (Date.now() / 1000) % 100;
      draw(cachedTerrainImage, pulseTime);
      animFrame = requestAnimationFrame(animate);
    }

    // Start draw immediately with whatever terrain is available, then start loop once loaded.
    draw(cachedTerrainImage, 0);

    loadTerrainImage()
      .then(_img => { animate(); })
      .catch(() => { animate(); });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrame);
    };
  });

  // ── Mouse-move handler for cursor feedback ──

  function handleMouseMove(e: MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    let hovering = false;
    for (const { x, y } of markersRef.current) {
      const dist = Math.sqrt((cssX - x) ** 2 + (cssY - y) ** 2);
      if (dist <= CLICK_HIT_RADIUS) {
        hovering = true;
        break;
      }
    }
    if (hovering !== hoveringMarker) {
      setHoveringMarker(hovering);
    }
  }

  // ── Click handler ──

  function handleClick(e: MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    let nearest: { roguelikeId: string; dist: number } | null = null;

    for (const { roguelikeId, x, y } of markersRef.current) {
      const dist = Math.sqrt((cssX - x) ** 2 + (cssY - y) ** 2);
      if (dist <= CLICK_HIT_RADIUS) {
        if (!nearest || dist < nearest.dist) {
          nearest = { roguelikeId, dist };
        }
      }
    }

    if (nearest) {
      onSelect(nearest.roguelikeId);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveringMarker(false)}
      style={{
        width: '100%',
        height: `${CSS_HEIGHT}px`,
        display: 'block',
        borderRadius: '6px',
        border: '1px solid rgba(180, 160, 100, 0.15)',
        cursor: hoveringMarker ? 'pointer' : 'crosshair',
        background: 'rgba(12, 10, 24, 0.9)',
      }}
    />
  );
}
