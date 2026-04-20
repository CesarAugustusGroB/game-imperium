import { decretumHand } from '../../../../game/items/decretum-store';
import { PlaceholderTab } from './PlaceholderTab';

export function DecretaTab() {
  const hand = decretumHand.value.length;
  return (
    <PlaceholderTab
      title="Decreta"
      subtitle={`${hand} scrolls in hand`}
      nextTask="S22-08"
    />
  );
}
