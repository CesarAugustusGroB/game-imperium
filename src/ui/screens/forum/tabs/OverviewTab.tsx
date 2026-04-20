import { selectedCommander, completedSpokes } from '../../../../game/core/game-state';
import { PlaceholderTab } from './PlaceholderTab';

export function OverviewTab() {
  const commander = selectedCommander.value;
  const turn = completedSpokes.value;
  const title = commander?.name.toUpperCase() ?? 'IMPERIUM';
  return (
    <PlaceholderTab
      title={title}
      subtitle={`Strategic Hub · Turn ${turn}`}
      nextTask="S22-03"
    />
  );
}
