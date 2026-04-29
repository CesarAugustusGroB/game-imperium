// S30-10: pure mapping from the campaign hex EventType (S30 data shape)
// to the existing EncounterType used by the legacy spoke pipeline.
// This is a forward-compatibility bridge — S30 itself uses the lightweight
// CampaignEventModal, but S31's gameplay-systems sprint can route through
// the full encounter dispatch by feeding the mapped EncounterType into
// NodeMapScreen-style logic.

import type { EventType } from './campaign-types';
import type { EncounterType } from '../progression/landmark-types';

export function eventTypeToEncounterType(
  event: EventType,
): EncounterType | null {
  switch (event) {
    case 'battle':
      return 'battle';
    case 'elite':
      return 'elite_battle';
    case 'ambush':
      return 'ambush';
    case 'supply':
      return 'forage';
    case 'rest':
      return 'rest';
    case 'merchant':
      return 'merchant';
    case 'story':
      return 'event';
    default:
      // 'none' and any future unmapped EventType both return null here.
      return null;
  }
}
