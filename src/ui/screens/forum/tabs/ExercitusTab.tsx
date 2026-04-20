import { preparedArmy } from '../../../../game/progression/strategic-store';
import { PlaceholderTab } from './PlaceholderTab';

export function ExercitusTab() {
  const cohorts = preparedArmy.value?.cohorts.length ?? 0;
  return (
    <PlaceholderTab
      title="Exercitus"
      subtitle={`${cohorts} cohorts`}
      nextTask="S22-06"
    />
  );
}
