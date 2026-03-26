import { currentScreen } from './screens';
import { ResourceBar } from './ResourceBar';
import { TitleScreen } from './TitleScreen';
import { CommanderSelectScreen } from './CommanderSelectScreen';
import { HubScreen } from './HubScreen';
import { NodeMapScreen } from './NodeMapScreen';

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
      <ScreenContent />
    </>
  );
}
