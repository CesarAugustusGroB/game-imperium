import { useRef, useEffect } from 'preact/hooks';
import { topologyData, territoryMap, claimedIndices, getAllTerritoryPositions } from '../game/province-map-store';
import { provinces } from '../game/province-store';
import { selectedCommander } from '../game/game-state';
import { FACTION_COLORS } from '../game/commander';
import { getGovernorTraits } from '../game/governor-store';
import { getUnrestModifier } from '../game/province';

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

// ── Drawing constants ──

const RADIUS_SELECTED = 8;
const RADIUS_OWNED = 5;
const RADIUS_UNCLAIMED = 3;
const CLICK_HIT_RADIUS = 15;
const LABEL_FONT = '9px "Segoe UI", system-ui, sans-serif';

// ── Component ──

export function ProvinceMapView({ selectedId, onSelect }: ProvinceMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Store latest marker positions so click handler can use them without re-subscribing.
  const markersRef = useRef<Array<{ roguelikeId: string; x: number; y: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    function draw(terrain: HTMLImageElement | null) {
      if (!canvas || !ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // ── Background ──
      ctx.fillStyle = 'rgba(12, 10, 24, 1)';
      ctx.fillRect(0, 0, W, H);

      if (terrain) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(terrain, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // Subtle dark vignette overlay
      const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      if (!topology) {
        // No topology yet — show placeholder text
        ctx.fillStyle = 'rgba(180, 170, 150, 0.3)';
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Loading map…', W / 2, H / 2);
        return;
      }

      const allCenters = topology.centers;

      // ── Unclaimed province dots (dim gray, show full map shape) ──
      for (const [indexStr, uv] of Object.entries(allCenters)) {
        const idx = Number(indexStr);
        if (_claimedIndices.has(idx)) continue;

        const x = uv[0] * W;
        const y = uv[1] * H;

        ctx.beginPath();
        ctx.arc(x, y, RADIUS_UNCLAIMED, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(140, 130, 120, 0.22)';
        ctx.fill();
      }

      // ── Owned territory markers ──
      const positions = getAllTerritoryPositions();
      const newMarkers: Array<{ roguelikeId: string; x: number; y: number }> = [];

      for (const { roguelikeId, uv } of positions) {
        const x = uv[0] * W;
        const y = uv[1] * H;

        newMarkers.push({ roguelikeId, x, y });

        const province = provinceById.get(roguelikeId);
        const isSelected = roguelikeId === selectedId;
        const radius = isSelected ? RADIUS_SELECTED : RADIUS_OWNED;

        // Compute unrest for indicator
        let unrest = 0;
        if (province) {
          const traits = getGovernorTraits(province.id);
          unrest = province.unrest + getUnrestModifier(province, traits);
        }

        // Glow halo (semi-transparent, larger circle)
        const glowRadius = radius + 5;
        const glowAlpha = isSelected ? 0.35 : 0.18;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = factionColor + Math.round(glowAlpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        if (isSelected) {
          // Second outer ring for selected
          ctx.beginPath();
          ctx.arc(x, y, glowRadius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = factionColor + '55';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? factionColor : factionColor + 'cc';
        ctx.fill();

        // Dot border
        ctx.strokeStyle = isSelected ? '#fff8e0' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = isSelected ? 1.5 : 0.8;
        ctx.stroke();

        // Province name label
        if (province) {
          ctx.font = LABEL_FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const label = province.name;
          const labelY = y + radius + 2;

          // Text shadow for legibility
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillText(label, x + 1, labelY + 1);

          ctx.fillStyle = isSelected ? '#fff8e0' : 'rgba(240, 230, 200, 0.75)';
          ctx.fillText(label, x, labelY);
        }

        // Unrest indicator — small red dot if unrest > 50
        if (unrest > 50) {
          ctx.beginPath();
          ctx.arc(x + radius - 1, y - radius + 1, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#e04040';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      markersRef.current = newMarkers;
    }

    // Start draw immediately with whatever terrain is available, then re-draw once loaded.
    draw(cachedTerrainImage);

    loadTerrainImage()
      .then(img => draw(img))
      .catch(() => draw(null));
  });

  // ── Click handler ──

  function handleClick(e: MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    let nearest: { roguelikeId: string; dist: number } | null = null;

    for (const { roguelikeId, x, y } of markersRef.current) {
      const dist = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
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
      width={800}
      height={200}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '200px',
        display: 'block',
        borderRadius: '6px',
        border: '1px solid rgba(180, 160, 100, 0.15)',
        cursor: 'crosshair',
        background: 'rgba(12, 10, 24, 0.9)',
      }}
    />
  );
}
