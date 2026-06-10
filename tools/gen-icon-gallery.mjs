// Generates iconos.html — a visual gallery of every game UI icon.
// Scans src/assets/ui, skips intermediate variants, groups by family,
// and badges the 32 icons exposed through the GameIcon component.
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const UI = 'src/assets/ui';

// The canonical GameIcon set (keys of GAME_ICONS in icon-system / GameIcon.tsx).
const GAME_ICON_NAMES = new Set([
  'nav-forum','nav-provinciae','nav-consilium','nav-exercitus','nav-doctrinae','nav-decreta',
  'nav-tutorial','nav-abandon','nav-prev','nav-next',
  'node-battle','node-event','node-rest','node-boss',
  'arrow-right','supplies-crate','delta-up','delta-down',
  'res-soldiers','res-morale','res-discipline','res-supplies','res-threat',
  'cat-logistica','cat-movimiento','cat-inteligencia','cat-coercion','cat-diplomacia',
  'cat-postura','cat-operaciones','cat-crisis',
  'op-quest','op-final-battle',
]);

const EXCLUDE = /-source|-alpha-raw|-generated|-preview|-manifest|_source|_transparent|_green/;
const isAsset = (f) => /\.(png|svg)$/i.test(f) && !EXCLUDE.test(f);
const baseName = (f) => f.replace(/\.(png|svg)$/i, '');

function listDir(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter(isAsset).sort();
}

// Group files within the icons/ folder by their prefix family.
const FAMILIES = [
  { key: 'nav',   title: 'Navegación (sidebar del Foro)', match: (n) => n.startsWith('nav-') },
  { key: 'node',  title: 'Nodos de campaña',              match: (n) => n.startsWith('node-') },
  { key: 'res',   title: 'Recursos de campaña (Iter Belli)', match: (n) => n.startsWith('res-') },
  { key: 'cat',   title: 'Categorías de carta de operación', match: (n) => n.startsWith('cat-') },
  { key: 'op',    title: 'Operaciones especiales',        match: (n) => n.startsWith('op-') },
  { key: 'stat',  title: 'Estadísticas de combate',       match: (n) => n.startsWith('stat-') },
  { key: 'misc',  title: 'Misceláneos del Hub',           match: () => true },
];

function buildIconSections() {
  const files = listDir(`${UI}/icons`);
  const used = new Set();
  const sections = [];
  for (const fam of FAMILIES) {
    const items = files.filter((f) => !used.has(f) && fam.match(baseName(f)));
    items.forEach((f) => used.add(f));
    if (items.length) sections.push({ title: fam.title, dir: `${UI}/icons`, files: items });
  }
  return sections;
}

const SECTIONS = [
  ...buildIconSections(),
  { title: 'Recursos (Hub: economía, población, estaciones)', dir: `${UI}/resources`, files: listDir(`${UI}/resources`) },
  { title: 'Barra de progresión (tier-bar)', dir: `${UI}/tier-bar`, files: listDir(`${UI}/tier-bar`) },
  { title: 'Campaña (marcas y pergaminos)', dir: `${UI}/campaign`, files: listDir(`${UI}/campaign`) },
  { title: 'Cursor', dir: `${UI}/cursor`, files: listDir(`${UI}/cursor`) },
  { title: 'Sello / medallón', dir: UI, files: ['consilium-medallion.png'].filter((f) => existsSync(join(ROOT, UI, f))) },
].filter((s) => s.files.length);

const totalIcons = SECTIONS.reduce((n, s) => n + s.files.length, 0);
const gameIconCount = [...GAME_ICON_NAMES].length;

function tile(dir, file) {
  const name = baseName(file);
  const path = `${dir}/${file}`.replace(/\\/g, '/');
  const isGame = GAME_ICON_NAMES.has(name);
  const ext = file.split('.').pop().toUpperCase();
  return `        <figure class="tile" data-name="${name}" title="Click para copiar el nombre">
          <div class="thumb"><img loading="lazy" src="${path}" alt="${name}"></div>
          <figcaption>
            <span class="name">${name}</span>
            <span class="meta">${isGame ? '<b class="badge">GameIcon</b>' : ''}<span class="ext">${ext}</span></span>
          </figcaption>
        </figure>`;
}

function section(s) {
  return `      <section class="group">
        <h2>${s.title} <span class="count">${s.files.length}</span></h2>
        <div class="grid">
${s.files.map((f) => tile(s.dir, f)).join('\n')}
        </div>
      </section>`;
}

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Imperium · Catálogo de Iconos</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=Cormorant+Garamond:ital@0;1&family=Spline+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --vio-900:#2a1147; --vio-800:#3d1a63; --vio-700:#532388; --vio-600:#6d28d9;
    --vio-500:#7c3aed; --vio-300:#b794f6; --vio-200:#d6bcfa; --vio-100:#ede4fb; --vio-50:#f6f1fd;
    --paper:#fbf9ff; --ink:#241038; --ink-soft:#5a4a72; --ink-faint:#8b7ca3; --line:#e3d6f5; --white:#fff;
    --tile-bg:#150d24; /* default dark tile so gold medallions read well */
    --font-display:'Cinzel',serif; --font-body:'Cormorant Garamond',serif; --font-mono:'Spline Sans Mono',monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:var(--font-body);color:var(--ink);font-size:17px;
    background:radial-gradient(1100px 560px at 88% -8%,var(--vio-100),transparent 60%),var(--paper);
    min-height:100vh;
  }
  .wrap{max-width:1280px;margin:0 auto;padding:0 28px}

  header{padding:54px 0 22px;text-align:center}
  .eyebrow{font-family:var(--font-mono);font-size:12px;letter-spacing:.4em;text-transform:uppercase;color:var(--vio-500);
    display:inline-flex;align-items:center;gap:13px;margin-bottom:14px}
  .eyebrow::before,.eyebrow::after{content:"";width:38px;height:1px;background:linear-gradient(90deg,transparent,var(--vio-300),transparent)}
  header h1{font-family:var(--font-display);font-weight:800;font-size:clamp(38px,6vw,64px);color:var(--vio-900);letter-spacing:.02em;line-height:1}
  header p{color:var(--ink-soft);font-style:italic;font-size:20px;margin-top:10px}

  .toolbar{position:sticky;top:0;z-index:20;background:rgba(251,249,255,.86);backdrop-filter:blur(12px) saturate(1.3);
    border-bottom:1px solid var(--line);margin-top:18px}
  .toolbar .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;padding-top:13px;padding-bottom:13px}
  .stat{font-family:var(--font-mono);font-size:13px;color:var(--ink-soft)}
  .stat b{color:var(--vio-700)}
  .spacer{flex:1}
  .search{font-family:var(--font-mono);font-size:13px;color:var(--ink);background:var(--white);border:1px solid var(--line);
    border-radius:9px;padding:9px 13px;min-width:220px;outline:none}
  .search:focus{border-color:var(--vio-400);box-shadow:0 0 0 3px var(--vio-100)}
  .seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--white)}
  .seg button{font-family:var(--font-mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;border:none;
    background:none;cursor:pointer;padding:9px 13px;color:var(--ink-faint)}
  .seg button.on{background:var(--vio-600);color:#fff}
  .seg-label{font-family:var(--font-mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint)}

  main{padding:30px 0 110px}
  .group{margin-bottom:42px}
  .group h2{font-family:var(--font-display);font-weight:600;font-size:21px;color:var(--vio-800);
    display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--line)}
  .group h2 .count{font-family:var(--font-mono);font-size:12px;font-weight:500;color:var(--vio-500);
    background:var(--vio-50);border:1px solid var(--vio-100);border-radius:99px;padding:2px 9px}

  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px}
  .tile{background:var(--white);border:1px solid var(--line);border-radius:13px;overflow:hidden;cursor:pointer;
    transition:transform .18s,box-shadow .18s,border-color .18s;display:flex;flex-direction:column}
  .tile:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(61,26,99,.16);border-color:var(--vio-200)}
  .tile.hidden{display:none}
  .thumb{aspect-ratio:1;display:grid;place-items:center;background:var(--tile-bg);background-size:18px 18px;padding:18px}
  .thumb img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
  figcaption{padding:9px 11px 11px;border-top:1px solid var(--line)}
  .name{display:block;font-family:var(--font-mono);font-size:12px;color:var(--ink);word-break:break-all;line-height:1.3}
  .meta{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:5px}
  .badge{font-family:var(--font-mono);font-size:9px;font-weight:600;letter-spacing:.05em;color:#fff;background:var(--vio-600);
    border-radius:5px;padding:2px 6px;font-style:normal}
  .ext{font-family:var(--font-mono);font-size:9.5px;color:var(--ink-faint);letter-spacing:.08em;margin-left:auto}

  .copied{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);opacity:0;
    background:var(--vio-800);color:#fff;font-family:var(--font-mono);font-size:13px;padding:11px 20px;border-radius:10px;
    box-shadow:0 12px 30px rgba(42,17,71,.4);transition:opacity .2s,transform .2s;pointer-events:none;z-index:50}
  .copied.show{opacity:1;transform:translateX(-50%) translateY(0)}
  footer{border-top:1px solid var(--line);padding:30px 0 50px;text-align:center;color:var(--ink-faint);font-style:italic}

  /* tile background variants */
  body.bg-light{--tile-bg:#f4eefc}
  body.bg-light .thumb img{filter:drop-shadow(0 2px 5px rgba(80,40,120,.25))}
  body.bg-check .thumb{background-image:
    linear-gradient(45deg,#cbb8e8 25%,transparent 25%),linear-gradient(-45deg,#cbb8e8 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,#cbb8e8 75%),linear-gradient(-45deg,transparent 75%,#cbb8e8 75%);
    background-position:0 0,0 9px,9px -9px,-9px 0;background-color:#ece2f8}
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="eyebrow">Codex Iconorum</div>
    <h1>Catálogo de Iconos</h1>
    <p>Todos los iconos de UI del juego — ${totalIcons} en total · ${gameIconCount} expuestos vía <code>&lt;GameIcon&gt;</code>.</p>
  </div>
</header>

<div class="toolbar">
  <div class="wrap">
    <span class="stat"><b id="shown">${totalIcons}</b> mostrados</span>
    <input id="search" class="search" type="search" placeholder="filtrar por nombre…" autocomplete="off">
    <span class="spacer"></span>
    <span class="seg-label">Fondo</span>
    <div class="seg" id="bgseg">
      <button data-bg="dark" class="on">Oscuro</button>
      <button data-bg="light">Claro</button>
      <button data-bg="check">Damero</button>
    </div>
    <div class="seg" id="filterseg">
      <button data-filter="all" class="on">Todos</button>
      <button data-filter="game">Solo GameIcon</button>
    </div>
  </div>
</div>

<main class="wrap">
${SECTIONS.map(section).join('\n')}
</main>

<footer class="wrap"><p>Generado desde <span style="font-family:var(--font-mono)">src/assets/ui</span> · tools/gen-icon-gallery.mjs</p></footer>
<div class="copied" id="toast">copiado</div>

<script>
  const tiles=[...document.querySelectorAll('.tile')];
  const shown=document.getElementById('shown');
  let q='',filter='all';
  function apply(){
    let n=0;
    for(const t of tiles){
      const name=t.dataset.name;
      const isGame=!!t.querySelector('.badge');
      const ok=(filter==='all'||isGame)&&name.includes(q);
      t.classList.toggle('hidden',!ok);
      if(ok)n++;
    }
    shown.textContent=n;
    for(const g of document.querySelectorAll('.group')){
      const any=[...g.querySelectorAll('.tile')].some(t=>!t.classList.contains('hidden'));
      g.style.display=any?'':'none';
    }
  }
  document.getElementById('search').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();apply();});
  document.getElementById('filterseg').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    filter=b.dataset.filter;[...e.currentTarget.children].forEach(x=>x.classList.toggle('on',x===b));apply();
  });
  document.getElementById('bgseg').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    document.body.classList.remove('bg-light','bg-check');
    if(b.dataset.bg==='light')document.body.classList.add('bg-light');
    if(b.dataset.bg==='check')document.body.classList.add('bg-check');
    [...e.currentTarget.children].forEach(x=>x.classList.toggle('on',x===b));
  });
  const toast=document.getElementById('toast');let tmr;
  for(const t of tiles)t.addEventListener('click',()=>{
    const name=t.dataset.name;
    navigator.clipboard?.writeText(name).catch(()=>{});
    toast.textContent='copiado: '+name;toast.classList.add('show');
    clearTimeout(tmr);tmr=setTimeout(()=>toast.classList.remove('show'),1400);
  });
</script>
</body>
</html>
`;

writeFileSync(join(ROOT, 'iconos.html'), html, 'utf8');
console.log(`Wrote iconos.html — ${totalIcons} icons across ${SECTIONS.length} sections.`);
for (const s of SECTIONS) console.log(`  ${s.files.length.toString().padStart(3)}  ${s.title}`);
