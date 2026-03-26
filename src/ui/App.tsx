import { currentScreen } from './screens';
import { TitleScreen } from './TitleScreen';
import { CommanderSelectScreen } from './CommanderSelectScreen';
import { HubScreen } from './HubScreen';
import { NodeMapScreen } from './NodeMapScreen';

export function App() {
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
    // battle: handled by Canvas (Preact UI hidden)
    // post-battle, victory, defeat: placeholders for later sprints
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
