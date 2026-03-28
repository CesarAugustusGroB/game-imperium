import { Component } from 'preact';
import type { ComponentChildren } from 'preact';
import { currentScreen, navigateTo } from './screens';
import { ResourceBar } from './ResourceBar';
import { TitleScreen } from './TitleScreen';
import { CommanderSelectScreen } from './CommanderSelectScreen';
import { HubScreen } from './HubScreen';
import { NodeMapScreen } from './NodeMapScreen';
import { PostBattleScreen } from './PostBattleScreen';

// Inject screen transition CSS once
if (typeof document !== 'undefined' && !document.getElementById('screen-transition-styles')) {
  const el = document.createElement('style');
  el.id = 'screen-transition-styles';
  el.textContent = `
    @keyframes screen-fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .screen-wrapper {
      animation: screen-fade-in 0.25s ease-out;
    }

    /* Global focus-visible styles for keyboard accessibility */
    *:focus-visible {
      outline: 2px solid rgba(240, 208, 128, 0.6);
      outline-offset: 2px;
    }

    /* Suppress outline on mouse focus */
    *:focus:not(:focus-visible) {
      outline: none;
    }

    /* Global selection color */
    ::selection {
      background: rgba(240, 208, 128, 0.3);
      color: #f0d080;
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
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
          color: 'rgba(220, 160, 100, 0.8)', gap: '16px',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(180, 170, 150, 0.5)', maxWidth: '400px', textAlign: 'center', lineHeight: '1.5' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = 'title'; window.location.reload(); }}
            style={{
              marginTop: '8px', padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(60, 60, 80, 0.6)', border: '1px solid rgba(180, 160, 100, 0.25)',
              color: '#d0c8a8', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              letterSpacing: '1px', transition: 'all 0.2s ease',
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
    case 'node-map':
      return <NodeMapScreen />;
    case 'post-battle':
      return <PostBattleScreen />;
    default:
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', color: 'rgba(200, 190, 160, 0.5)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          background: 'radial-gradient(ellipse at 50% 40%, rgba(30, 28, 50, 0.92), rgba(8, 8, 18, 0.97))',
          gap: '16px',
        }}>
          <div style={{ fontSize: '14px', letterSpacing: '1px' }}>
            {screen} — coming soon
          </div>
          <button
            onClick={() => navigateTo('title')}
            style={{
              padding: '10px 24px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(60, 60, 80, 0.6)', border: '1px solid rgba(180, 160, 100, 0.25)',
              color: '#d0c8a8', fontFamily: 'inherit', fontSize: '13px',
              fontWeight: 600, letterSpacing: '1px', transition: 'all 0.2s ease',
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
  const showResourceBar = screen !== 'title' && screen !== 'commander-select' && screen !== 'battle';

  return (
    <>
      {showResourceBar && <ResourceBar />}
      <ErrorBoundary>
        <div class="screen-wrapper" key={screen}>
          <ScreenContent />
        </div>
      </ErrorBoundary>
    </>
  );
}
