import { provinces } from '../../../../game/province/province-store';
import { BentoCard } from '../../../components/BentoCard';
import { SectionHeader, LinkButton } from '../components/SectionHeader';
import { ProvinceRow } from '../components/ProvinceRow';
import { setForumTab } from '../state';

interface ProvinciaeListPanelProps {
  accent?: string;
  index?: number;
}

export function ProvinciaeListPanel({ accent = '#d4a843', index = 0 }: ProvinciaeListPanelProps) {
  const provs = provinces.value;

  return (
    <BentoCard accent={accent} index={index} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <SectionHeader
        title="Provinciae"
        accent={accent}
        right={<LinkButton label="Manage →" onClick={() => setForumTab('provinciae')} accent={accent} />}
      />
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        flex: 1, overflow: 'auto',
      }}>
        {provs.length === 0 && (
          <div style={{
            padding: '12px 4px',
            fontFamily: 'var(--imp-font-serif)',
            fontStyle: 'italic', fontSize: 12,
            color: 'var(--imp-text-lo)',
          }}>
            No provinces yet.
          </div>
        )}
        {provs.map((p) => (
          <ProvinceRow
            key={p.id}
            p={p}
            accent={accent}
            onClick={() => setForumTab('provinciae')}
          />
        ))}
      </div>
    </BentoCard>
  );
}
