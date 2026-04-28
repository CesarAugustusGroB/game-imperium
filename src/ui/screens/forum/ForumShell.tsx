import { activeForumTab } from './state';
import type { ForumTab } from './state';
import { Sidebar } from './Sidebar';
import { OverviewTab } from './tabs/OverviewTab';
import { ProvinciaeTab } from './tabs/ProvinciaeTab';
import { ConsiliumTab } from './tabs/ConsiliumTab';
import { ExercitusTab } from './tabs/ExercitusTab';
import { MercatorTab } from './tabs/MercatorTab';
import { DoctrinaeTab } from './tabs/DoctrinaeTab';
import { DecretaTab } from './tabs/DecretaTab';
import { NodeMapScreen } from '../NodeMapScreen';

// ── One-time scoped style injection ──
// Any element inside the Forum shell gets the thin gold scrollbar
// treatment instead of the default chunky OS scrollbar. Scoped with
// the `.imp-forum-shell` class so legacy screens are unaffected.
if (typeof document !== 'undefined' && !document.getElementById('imp-forum-styles')) {
  const el = document.createElement('style');
  el.id = 'imp-forum-styles';
  el.textContent = `
    .imp-forum-shell ::-webkit-scrollbar        { width: 6px; height: 6px; }
    .imp-forum-shell ::-webkit-scrollbar-track  { background: transparent; }
    .imp-forum-shell ::-webkit-scrollbar-thumb  {
      background: rgba(212, 168, 67, 0.25);
      border-radius: 3px;
    }
    .imp-forum-shell ::-webkit-scrollbar-thumb:hover {
      background: rgba(212, 168, 67, 0.45);
    }
    .imp-forum-shell {
      scrollbar-width: thin;
      scrollbar-color: rgba(212, 168, 67, 0.25) transparent;
    }
    .imp-forum-shell * {
      scrollbar-width: thin;
      scrollbar-color: rgba(212, 168, 67, 0.25) transparent;
    }
  `;
  document.head.appendChild(el);
}

const TAB_COMPONENTS: Record<ForumTab, () => preact.JSX.Element> = {
  overview:   OverviewTab,
  provinciae: ProvinciaeTab,
  consilium:  ConsiliumTab,
  exercitus:  ExercitusTab,
  bellum:     NodeMapScreen,
  mercator:   MercatorTab,
  doctrinae:  DoctrinaeTab,
  decreta:    DecretaTab,
};

const BG = `
  radial-gradient(ellipse 1400px 700px at 50% 0%, rgba(122, 36, 50, 0.12) 0%, transparent 60%),
  radial-gradient(ellipse 900px 500px at 50% 100%, rgba(212, 168, 67, 0.06) 0%, transparent 50%),
  linear-gradient(180deg, #14121f 0%, #0d0b14 100%)
`;

export function ForumShell() {
  const Tab = TAB_COMPONENTS[activeForumTab.value];

  return (
    <div
      class="imp-forum-shell"
      style={{
        position: 'fixed', inset: 0,
        display: 'flex',
        background: BG,
        fontFamily: 'var(--imp-font-body)',
        color: 'var(--imp-text)',
      }}
    >
      <Sidebar />
      <div style={{
        flex: 1, minWidth: 0, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <Tab />
      </div>
    </div>
  );
}
