import { Component } from 'preact';
import type { ComponentChildren } from 'preact';
import { currentScreen, navigateTo, transitionState } from '../screens';
import { ResourceBar } from '../components/ResourceBar';
import { TitleScreen } from './TitleScreen';
import { CommanderSelectScreen } from './CommanderSelectScreen';
import { HubScreen } from './HubScreen';
import { NodeMapScreen } from './NodeMapScreen';
import { PostBattleScreen } from './PostBattleScreen';
import { DoctrineScreen } from './DoctrineScreen';
import { CouncilScreen } from './CouncilScreen';
import { ProvinceScreen } from './ProvinceScreen';
import { VictoryScreen } from './VictoryScreen';
import { DefeatScreen } from './DefeatScreen';
import { toggleMute, musicMuted } from '../sound/music';
import { loadMetaSave } from '../../game/core/meta-save';

// Load meta-save from localStorage on startup
loadMetaSave();

// Inject screen transition CSS once
if (typeof document !== 'undefined' && !document.getElementById('screen-transition-styles')) {
  const el = document.createElement('style');
  el.id = 'screen-transition-styles';
  el.textContent = `
    @keyframes screen-enter {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes screen-exit {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-6px); }
    }
    .screen-wrapper {
      animation: screen-enter var(--duration-slow) var(--ease-default);
    }
    .screen-wrapper.exiting {
      animation: screen-exit var(--duration-normal) ease-in forwards;
    }

    /* Global focus-visible styles for keyboard accessibility */
    *:focus-visible {
      outline: 2px solid var(--color-gold-primary);
      outline-offset: 2px;
    }

    /* Suppress outline on mouse focus */
    *:focus:not(:focus-visible) {
      outline: none;
    }

    /* Global selection color */
    ::selection {
      background: var(--color-border-subtle);
      color: var(--color-gold-primary);
    }
    @media (max-width: 900px) {
      .curtain-img { opacity: 0.3 !important; }
    }
    @media (max-width: 600px) {
      .curtain-img { display: none !important; }
      .screen-wrapper { padding-top: 42px !important; }
    }
  `;
  document.head.appendChild(el);
}

interface EBState { error: Error | null; }
class ErrorBoundary extends Component<{ children: ComponentChildren }, EBState> {
  state: EBState = { error: null };
  componentDidCatch(error: Error) { this.setState({ error }); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh',
          fontFamily: 'var(--font-family)',
          background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
          color: 'rgba(220, 160, 100, 0.8)', gap: '16px',
        }}>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)', maxWidth: '400px', textAlign: 'center', lineHeight: '1.5' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = 'title'; window.location.reload(); }}
            style={{
              marginTop: '8px', padding: '10px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: 'var(--font-size-md)', fontWeight: 600,
              letterSpacing: '1px', transition: `all var(--duration-normal) var(--ease-default)`,
            }}
          >
            Return to Title
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScreenContent() {
  const screen = currentScreen.value;

  switch (screen) {
    case 'title':
      return <TitleScreen />;
    case 'commander-select':
      return <CommanderSelectScreen />;
    case 'hub':
      return <HubScreen />;
    case 'doctrine':
      return <DoctrineScreen />;
    case 'council':
      return <CouncilScreen />;
    case 'provinces':
      return <ProvinceScreen />;
    case 'node-map':
      return <NodeMapScreen />;
    case 'post-battle':
      return <PostBattleScreen />;
    case 'victory':
      return <VictoryScreen />;
    case 'defeat':
      return <DefeatScreen />;
    default:
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
          background: '#d8d0c8 url(/asset/marbel_background.png) center / contain no-repeat',
          gap: '16px',
        }}>
          <div style={{ fontSize: 'var(--font-size-lg)', letterSpacing: '1px' }}>
            {screen} — coming soon
          </div>
          <button
            onClick={() => navigateTo('title')}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-secondary)', fontFamily: 'inherit', fontSize: 'var(--font-size-md)',
              fontWeight: 600, letterSpacing: '1px', transition: `all var(--duration-normal) var(--ease-default)`,
            }}
          >
            Return to Title
          </button>
        </div>
      );
  }
}

export function App() {
  const screen = currentScreen.value;
  const exiting = transitionState.value === 'exiting';
  const showResourceBar = screen !== 'title' && screen !== 'commander-select' && screen !== 'battle';

  const showCurtains = screen !== 'battle';

  return (
    <>
      {showCurtains && (
        <>
          <img
            class="curtain-img"
            src="/asset/cortina_izq.png"
            alt=""
            aria-hidden="true"
            style={{
              position: 'fixed', left: '0', top: '0',
              height: '100vh', width: 'auto',
              zIndex: '1', pointerEvents: 'none',
              objectFit: 'cover',
            }}
          />
          <img
            class="curtain-img"
            src="/asset/cortina_izq.png"
            alt=""
            aria-hidden="true"
            style={{
              position: 'fixed', right: '0', top: '0',
              height: '100vh', width: 'auto',
              zIndex: '1', pointerEvents: 'none',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
        </>
      )}
      {showResourceBar && <ResourceBar />}
      <ErrorBoundary>
        <div class={`screen-wrapper${exiting ? ' exiting' : ''}`} key={screen}>
          <ScreenContent />
        </div>
      </ErrorBoundary>
      {showCurtains && (
        <button
          onClick={toggleMute}
          title={musicMuted.value ? 'Unmute music' : 'Mute music'}
          aria-label={musicMuted.value ? 'Unmute music' : 'Mute music'}
          style={{
            position: 'fixed', bottom: '16px', right: '16px',
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)',
            color: musicMuted.value ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            fontSize: 'var(--font-size-lg)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: '200', transition: `all var(--duration-normal) var(--ease-default)`,
            backdropFilter: 'blur(8px)',
          }}
        >
          {musicMuted.value ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
        </button>
      )}
    </>
  );
}
