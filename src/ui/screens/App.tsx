import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { currentScreen, navigateTo, navigateToIterBelli, transitionState } from '../screens';
import type { ScreenName } from '../screens';
import { ResourceBar } from '../components/ResourceBar';
import { NotificationFeed } from '../components/NotificationFeed';
import { MusicToggle } from '../components/MusicToggle';
import { CustomCursor } from '../components/CustomCursor';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TitleScreen } from './TitleScreen';
import { CommanderSelectScreen } from './CommanderSelectScreen';
import { RecordsScreen } from './RecordsScreen';
import { ForumShell } from './forum';
import { IterBelliScreen } from './iterbelli/IterBelliScreen';
import { loadMetaSave, startActiveRunPersistence, restoreActiveRun, metaSave } from '../../game/core/meta-save';

// Load meta-save from localStorage on startup
loadMetaSave();

/**
 * True while a saved run is being restored at boot. `App` renders a bare veil
 * during this window so an empty screen never flashes before the async restore
 * (which may load topology) completes.
 *
 * Gated on there being an active run AND the initial screen needing one (i.e.
 * the player reloaded *into* the Hub or a campaign, not onto the title). This
 * covers BOTH a mid-campaign reload and a Hub-only reload — without it, a Hub
 * reload would render the Forum with no commander/resources ("no data"). The
 * title and commander-select screens don't require a run, so reloading there
 * skips the veil and resumes via the "Continue" button as before.
 */
const bootInitialScreen = currentScreen.value;
const runNeedsRestore =
  metaSave.value.activeRun != null &&
  bootInitialScreen !== 'title' &&
  bootInitialScreen !== 'commander-select';

export const bootResuming = signal<boolean>(runNeedsRestore);

if (bootResuming.value) {
  void (async () => {
    const ok = await restoreActiveRun();
    if (ok) {
      const inCampaign = metaSave.value.activeRun?.iterBelli != null;
      if (inCampaign && currentScreen.value !== 'iterbelli') {
        // Mid-campaign reload that lost the hash — route into the campaign.
        navigateToIterBelli();
      } else if (!inCampaign && currentScreen.value === 'iterbelli') {
        // Hub-only run sitting on a stale #iterbelli hash — send it to the Forum.
        navigateTo('forum');
      }
      // Otherwise the hash already matches the restored state (e.g. #forum) —
      // stay put; the run state is now populated, so the screen renders fully.
    } else {
      navigateTo('title');
    }
    bootResuming.value = false;
  })();
}

/**
 * Screens that should not render the global ResourceBar. The Forum shell
 * provides its own resource chips in the Masthead, so `forum` is bare too.
 */
const BARE_SCREENS: ReadonlySet<ScreenName> = new Set(['title', 'commander-select', 'forum', 'iterbelli', 'records']);

/** Map of screen id → component. Order matches navigation flow. */
const SCREEN_COMPONENTS: Partial<Record<ScreenName, () => preact.JSX.Element>> = {
  'title': TitleScreen,
  'commander-select': CommanderSelectScreen,
  'forum': ForumShell,
  'hub': ForumShell,
  'iterbelli': IterBelliScreen,
  'records': RecordsScreen,
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
  const resuming = bootResuming.value;

  useEffect(() => {
    return startActiveRunPersistence();
  }, []);

  if (resuming) {
    return <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg-primary, #0a0a14)' }} />;
  }

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
      <CustomCursor />
    </>
  );
}
