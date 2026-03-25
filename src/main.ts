import { createWebGL2Context, resizeViewport } from './renderer/context';
import { createShaderProgram } from './renderer/shader';
import { createFullScreenQuad } from './renderer/quad';
import { loadAllTextures } from './renderer/textures';
import { MapRenderer } from './renderer/renderer';
import { ArmyRenderer } from './renderer/army-renderer';
import { Camera } from './camera/camera';
import { setupInput } from './camera/input';
import { GameState } from './game/state';
import { ProvinceRegistry } from './game/provinces';
import { ProvincePicker } from './game/picking';
import { ArmyManager } from './game/army';
import { Overlay } from './ui/overlay';
import { DebugPanel } from './ui/debug-panel';
import { MainMenu } from './ui/main-menu';
import { BattleMode } from './battle/index';
import { rgbToIndex, keyToRgb } from './utils/color';
import mapVert from './shaders/map.vert';
import mapFrag from './shaders/map.frag';

async function main() {
  const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
  const armyCanvas = document.getElementById('army-overlay') as HTMLCanvasElement;
  if (!canvas || !armyCanvas) throw new Error('Canvas elements not found');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  armyCanvas.width = window.innerWidth;
  armyCanvas.height = window.innerHeight;

  const gl = createWebGL2Context(canvas);
  resizeViewport(gl, canvas.width, canvas.height);

  const program = createShaderProgram(gl, mapVert, mapFrag);
  const quad = createFullScreenQuad(gl);
  const textures = await loadAllTextures(gl);

  const gameState = new GameState();
  await gameState.load();

  const registry = new ProvinceRegistry(gl, gameState);
  registry.buildLUT();

  const camera = new Camera();
  setupInput(canvas, camera);

  const picker = new ProvincePicker(gl, program, quad, textures.idMap);
  const overlay = new Overlay(gameState, registry);
  const renderer = new MapRenderer(gl, program, quad, textures, camera, registry);

  // Army system
  const armyManager = new ArmyManager(gameState.topology);
  const armyRenderer = new ArmyRenderer(armyCanvas, camera, armyManager, gameState);

  // Battle mode
  let gameRunning = false;
  const battleMode = new BattleMode(() => {
    gameRunning = true;
  });

  // Screenshot function
  function takeScreenshot() {
    renderer.render();
    armyRenderer.render();
    const composite = document.createElement('canvas');
    composite.width = canvas.width;
    composite.height = canvas.height;
    const ctx = composite.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    ctx.drawImage(armyCanvas, 0, 0);
    composite.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `map-screenshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  // Debug panel
  new DebugPanel(renderer, takeScreenshot);

  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    armyCanvas.width = window.innerWidth;
    armyCanvas.height = window.innerHeight;
    resizeViewport(gl, canvas.width, canvas.height);
    picker.resize(canvas.width, canvas.height);
    armyRenderer.resize(canvas.width, canvas.height);
    battleMode.resize(canvas.width, canvas.height);
  });

  // Mouse interaction
  canvas.addEventListener('mousemove', (e) => {
    if (menu.isVisible || battleMode.isVisible) return;
    const provinceKey = picker.pick(e.clientX, e.clientY, camera);
    gameState.hoveredProvinceKey = provinceKey;
    overlay.update(e.clientX, e.clientY);
    renderer.setHoveredProvince(provinceKey);
  });

  // Left-click: select army first, then province
  canvas.addEventListener('click', (e) => {
    if (menu.isVisible || battleMode.isVisible) return;

    // Check if clicking an army
    const armyId = armyRenderer.hitTest(e.clientX, e.clientY);
    if (armyId !== null) {
      armyRenderer.selectedArmyId = armyId;
      const army = armyManager.armies.get(armyId);
      if (army) {
        const prov = gameState.provinceByIndex.get(army.provinceIndex);
        if (prov) {
          const key = `${prov.color[0]},${prov.color[1]},${prov.color[2]}`;
          gameState.selectedProvinceKey = key;
          renderer.setSelectedProvince(key);
        }
      }
      return;
    }

    // Otherwise select province
    const provinceKey = picker.pick(e.clientX, e.clientY, camera);
    gameState.selectedProvinceKey = provinceKey;
    renderer.setSelectedProvince(provinceKey);

    // If clicking a province with an army, select that army
    if (provinceKey) {
      const rgb = keyToRgb(provinceKey);
      const idx = rgbToIndex(rgb[0], rgb[1], rgb[2]);
      const armiesHere = armyManager.getArmiesInProvince(idx);
      if (armiesHere.length > 0) {
        armyRenderer.selectedArmyId = armiesHere[0].id;
      } else {
        armyRenderer.selectedArmyId = null;
      }
    } else {
      armyRenderer.selectedArmyId = null;
    }
  });

  // Right-click: move selected army to target province
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (menu.isVisible || battleMode.isVisible) return;

    if (armyRenderer.selectedArmyId === null) return;

    const provinceKey = picker.pick(e.clientX, e.clientY, camera);
    if (!provinceKey) return;

    const rgb = keyToRgb(provinceKey);
    const targetIndex = rgbToIndex(rgb[0], rgb[1], rgb[2]);

    armyManager.moveArmy(armyRenderer.selectedArmyId, targetIndex);
  });

  // Render loop
  let lastTime = performance.now();
  function frame(now: number) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    camera.update();
    if (gameRunning) armyManager.update(dt);
    battleMode.update(dt);
    renderer.render();
    armyRenderer.render();
    battleMode.render();

    requestAnimationFrame(frame);
  }

  // Start render loop (shows map behind menu)
  requestAnimationFrame(frame);

  // Main menu
  const menu = new MainMenu({
    onNewGame: () => {
      spawnStarterArmies(armyManager, gameState);
      gameRunning = true;
      console.log('Grand Strategy Map ready — left-click to select armies, right-click to move them');
    },
    onContinue: () => {
      gameRunning = true;
    },
  });
  menu.setCamera(camera);

  // B key enters battle mode from campaign
  document.addEventListener('keydown', (e) => {
    if (e.key === 'b' || e.key === 'B') {
      if (!menu.isVisible && !battleMode.isVisible && gameRunning) {
        gameRunning = false;
        battleMode.enter();
      }
    }
  });
}

function spawnStarterArmies(armyManager: ArmyManager, gameState: GameState) {
  // Spawn armies at nation capitals
  const armyDefs = [
    { nation: 'france',     name: '1st French Army',    size: 30000, province: 1 },
    { nation: 'france',     name: '2nd French Army',    size: 15000, province: 4 },
    { nation: 'england',    name: 'English Royal Army', size: 25000, province: 10 },
    { nation: 'castile',    name: 'Castilian Host',     size: 20000, province: 18 },
    { nation: 'aragon',     name: 'Aragonese Force',    size: 12000, province: 19 },
    { nation: 'hre',        name: 'Imperial Army',      size: 35000, province: 24 },
    { nation: 'ottomans',   name: 'Ottoman Janissaries', size: 40000, province: 40 },
    { nation: 'ottomans',   name: 'Anatolian Sipahis',  size: 20000, province: 41 },
    { nation: 'muscovy',    name: 'Muscovite Horde',    size: 25000, province: 38 },
    { nation: 'poland',     name: 'Polish Hussars',     size: 18000, province: 36 },
    { nation: 'venice',     name: 'Venetian Marines',   size: 10000, province: 30 },
    { nation: 'papal',      name: 'Papal Guard',        size: 8000,  province: 27 },
    { nation: 'denmark',    name: 'Danish Levy',        size: 12000, province: 33 },
    { nation: 'burgundy_nation', name: 'Burgundian Knights', size: 15000, province: 31 },
    { nation: 'scotland',   name: 'Scottish Clansmen',  size: 8000,  province: 16 },
    { nation: 'hungary',    name: 'Hungarian Army',     size: 16000, province: 43 },
  ];

  for (const def of armyDefs) {
    if (gameState.nations.has(def.nation)) {
      armyManager.createArmy(def.nation, def.name, def.size, def.province);
    }
  }
}

main().catch(console.error);
