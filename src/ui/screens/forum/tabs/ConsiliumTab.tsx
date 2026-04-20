import { councilSlots } from '../../../../game/council/council-store';
import { PlaceholderTab } from './PlaceholderTab';

export function ConsiliumTab() {
  const seated = councilSlots.value.filter((s) => s !== null).length;
  const total = councilSlots.value.length;
  return (
    <PlaceholderTab
      title="Consilium"
      subtitle={`${seated} of ${total} seated`}
      nextTask="S22-05"
    />
  );
}
