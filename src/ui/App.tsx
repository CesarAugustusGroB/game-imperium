import { Component } from 'preact';
import type { ComponentChildren } from 'preact';
import { currentScreen } from './screens';
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
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .screen-wrapper {
      animation: screen-fade-in 0.2s ease-out;
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
          color: 'rgba(220, 160, 100, 0.8)', gap: '12px',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: '12px', color: 'rgba(180, 170, 150, 0.5)' }}>
            {this.state.error.message}
          </div>
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
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', color: 'rgba(200, 190, 160, 0.5)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
          Screen: {screen} — coming soon
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
