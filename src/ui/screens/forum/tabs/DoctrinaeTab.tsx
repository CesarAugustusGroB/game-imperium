import { equippedDoctrines, doctrineCollection } from '../../../../game/items/doctrine-store';
import { PlaceholderTab } from './PlaceholderTab';

export function DoctrinaeTab() {
  const equipped = equippedDoctrines.value.filter((d) => d !== null).length;
  const total = equippedDoctrines.value.length;
  const collected = doctrineCollection.value.length;
  return (
    <PlaceholderTab
      title="Doctrinae"
      subtitle={`${equipped} of ${total} equipped · ${collected} in collection`}
      nextTask="S22-07"
    />
  );
}
