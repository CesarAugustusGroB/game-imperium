import { useEffect } from 'preact/hooks';
import { currentScreen, navigateTo, transitionState } from '../screens';
import type { ScreenName } from '../screens';
import { ResourceBar } from '../components/ResourceBar';
import { NotificationFeed } from '../components/NotificationFeed';
import { MusicToggle } from '../components/MusicToggle';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TitleScreen } from './TitleScreen';
import { CommanderSelectScreen } from './CommanderSelectScreen';
import { QuickBattleScreen } from './QuickBattleScreen';
import { PostBattleScreen } from './PostBattleScreen';
import { VictoryScreen } from './VictoryScreen';
import { DefeatScreen } from './DefeatScreen';
import { BattleScreenV2 } from './BattleScreenV2';
import { ForumShell } from './forum';
import { loadMetaSave, startActiveRunPersistence } from '../../game/core/meta-save';

// Load meta-save from localStorage on startup
loadMetaSave();

/**
 * Screens that should not render the global ResourceBar. The Forum shell
 * provides its own resource chips in the Masthead, so `forum` is bare too.
 */
const BARE_SCREENS: ReadonlySet<ScreenName> = new Set(['title', 'commander-select', 'quick-battle', 'forum', 'battle', 'battleV2']);

/** Map of screen id → component. Order matches navigation flow. */
const SCREEN_COMPONENTS: Partial<Record<ScreenName, () => preact.JSX.Element>> = {
  'title': TitleScreen,
  'commander-select': CommanderSelectScreen,
  'quick-battle': QuickBattleScreen,
  'forum': ForumShell,
  // Legacy hash routes (e.g. #node-map, #spoke-campaign) are rewritten to
  // 'forum' by resolveScreen() in screens.ts so deep links keep working.
  // The map below covers screens that still have standalone bodies
  // (battleV2, post-battle, victory, defeat) plus a hub fallback that
  // also resolves to ForumShell.
  'hub': ForumShell,
  // 'node-map' / 'spoke-campaign' resolve to 'forum' with the bellum tab via
  // LEGACY_TAB_MAP in screens.ts, so they never reach this map. Their legacy
  // screen bodies were retired in S30-12.
  'battleV2': BattleScreenV2,
  'post-battle': PostBattleScreen,
  'victory': VictoryScreen,
  'defeat': DefeatScreen,
};

function UnknownScreen({ screen }: { screen: ScreenName }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: '16px',
      color: 'var(--color-text-secondary)',
      fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
    }}>
      <div style={{ fontSize: 'var(--font-size-lg)', letterSpacing: '1px' }}>
        {screen} — coming soon
      </div>
      <button
        onClick={() => navigateTo('title')}
        style={{
          padding: '10px 24px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border-default)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'inherit',
          fontSize: 'var(--font-size-md)',
          fontWeight: 600,
          letterSpacing: '1px',
          transition: 'all var(--duration-normal) var(--ease-default)',
        }}
      >
        Return to Title
      </button>
    </div>
  );
}

function ScreenContent() {
  const screen = currentScreen.value;
  const Component = SCREEN_COMPONENTS[screen];
  return Component ? <Component /> : <UnknownScreen screen={screen} />;
}

export function App() {
  const screen = currentScreen.value;
  const exiting = transitionState.value === 'exiting';
  const showResourceBar = !BARE_SCREENS.has(screen);

  useEffect(() => {
    return startActiveRunPersistence();
  }, []);

  return (
    <>
      {showResourceBar && <ResourceBar />}
      <ErrorBoundary>
        <div class={`screen-wrapper${exiting ? ' exiting' : ''}`} key={screen}>
          <ScreenContent />
        </div>
      </ErrorBoundary>
      <NotificationFeed />
      <MusicToggle />
    </>
  );
}
