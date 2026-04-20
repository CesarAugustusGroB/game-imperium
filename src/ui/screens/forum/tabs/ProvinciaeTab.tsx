import { provinces } from '../../../../game/province/province-store';
import { PlaceholderTab } from './PlaceholderTab';

export function ProvinciaeTab() {
  return (
    <PlaceholderTab
      title="Provinciae"
      subtitle={`${provinces.value.length} Holdings`}
      nextTask="S22-04"
    />
  );
}
