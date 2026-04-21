import { gold, faith, influence, momentum } from '../../../game/core/resources';
import { MosaicBand } from '../../components/motifs/MosaicBand';
import { StatChip } from './StatChip';
import type { StatChipData } from './StatChip';

interface MastheadProps {
  title: string;
  subtitle: string;
  accent?: string;
}

export function Masthead({ title, subtitle, accent = '#d4a843' }: MastheadProps) {
  const chips: StatChipData[] = [
    {
      key: 'gold', glyph: '⚜', value: gold.value, color: '#d4a843',
      label: 'Gold',
      description: 'Primary income for all factions. Spent on unit upkeep, upgrades, and investments. Purple commanders earn 2× gold.',
    },
    {
      key: 'faith', glyph: '✦', value: faith.value, color: '#c8b080',
      label: 'Faith',
      description: 'Primary resource of the Gold (Religious) faction. Drives crusade and miracle abilities. Gold commanders earn 2× faith.',
    },
    {
      key: 'influence', glyph: '◈', value: influence.value, color: '#9fb8d0',
      label: 'Influence',
      description: 'Primary resource of the Blue (Diplomat) faction. Powers negotiation and manipulation. Blue commanders earn 2× influence.',
    },
    {
      key: 'momentum', glyph: '⚡', value: momentum.value, color: '#e07a50',
      label: 'Momentum',
      description: 'Primary resource of the Red (Warlord) faction. Fuels aggressive tactics and berserk stances. Red commanders earn 2× momentum.',
    },
  ];

  return (
    <>
      <div style={{
        padding: '18px 32px 14px',
        borderBottom: '1px solid rgba(212, 168, 67, 0.15)',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--imp-font-body)',
            fontSize: 9, letterSpacing: 3,
            color: 'var(--imp-text-lo)',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            {subtitle}
          </div>
          <div style={{
            fontFamily: 'var(--imp-font-display)',
            fontSize: 26, fontWeight: 500, letterSpacing: 4,
            color: 'var(--imp-text-hi)',
            textTransform: 'uppercase',
          }}>
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {chips.map((c) => <StatChip key={c.key} r={c} accent={accent} />)}
        </div>
      </div>
      <div style={{ padding: '0 32px', marginTop: -1 }}>
        <MosaicBand width={1300} height={8} color={accent} opacity={0.4} />
      </div>
    </>
  );
}
