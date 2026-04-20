import { decretumHand } from '../../../../game/items/decretum-store';
import { selectedCommander } from '../../../../game/core/game-state';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { SectionHeader, LinkButton } from '../components/SectionHeader';
import { ScrollRow } from '../components/ScrollRow';
import { setForumTab } from '../state';

interface DecretaPanelProps {
  accent?: string;
}

export function DecretaPanel({ accent = '#d4a843' }: DecretaPanelProps) {
  const hand = decretumHand.value;
  const commander = selectedCommander.value;

  return (
    <OrnatePanel accent={accent} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <SectionHeader
        title="Decreta"
        accent={accent}
        right={<LinkButton label="Open →" onClick={() => setForumTab('decreta')} accent={accent} />}
      />
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        flex: 1, overflow: 'auto',
      }}>
        {hand.length === 0 && (
          <div style={{
            padding: '12px 4px',
            fontFamily: 'var(--imp-font-serif)',
            fontStyle: 'italic', fontSize: 11,
            color: 'var(--imp-text-lo)',
          }}>
            No decreta in hand.
          </div>
        )}
        {hand.map((s) => <ScrollRow key={s.id} s={s} commander={commander} />)}
      </div>
    </OrnatePanel>
  );
}
