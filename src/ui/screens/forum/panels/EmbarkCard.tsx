import { plannedSpoke } from '../../../../game/council/council-store';
import { preparedArmy, preparedLegate } from '../../../../game/progression/strategic-store';
import { getResource } from '../../../../game/core/resources';
import { selectedCommander } from '../../../../game/core/game-state';
import { startIterBelliCampaign, computeStartingDiscipline } from '../../../../game/iterBelli/iter-belli-state';
import { navigateToIterBelli } from '../../../screens';
import { playSfx } from '../../../sound/sfx';
import { OrnatePanel } from '../../../components/OrnatePanel';
import { LaurelWreath } from '../../../components/motifs/LaurelWreath';

interface EmbarkCardProps {
  accent?: string;
}

export function EmbarkCard({ accent = '#d4a843' }: EmbarkCardProps) {
  const spoke = plannedSpoke.value;
  const army = preparedArmy.value;

  const campaignTitle = spoke?.label ?? 'No campaign planned';
  const nodes = spoke?.nodes ?? [];
  const canEmbark = !!spoke && nodes.length > 0;

  // Supply warning: how many supplies are needed for the unresolved nodes
  const unresolvedNodes = nodes.filter((n) => !n.resolved);
  const cohortCount = army?.cohorts?.length ?? 0;
  const suppliesHave = army?.supplies ?? 0;
  const suppliesNeeded = cohortCount * unresolvedNodes.length;
  const supplyWarning = canEmbark && cohortCount > 0 && suppliesHave < suppliesNeeded;

  function handleEmbark() {
    if (!canEmbark) return;
    playSfx('ui_click');
    // Hybrid seed: soldiers from the prepared army's effective HP, gold from the run.
    const cohorts = army?.cohorts ?? [];
    const soldiers = cohorts.reduce((sum, c) => sum + (c.currentHp ?? c.stats.hp), 0);
    const archetype = selectedCommander.value?.archetype ?? null;
    const discipline = computeStartingDiscipline(archetype, preparedLegate.value?.traitIds ?? []);
    startIterBelliCampaign({ soldiers, gold: getResource('gold'), iuniores: getResource('iuniores'), discipline, archetype });
    navigateToIterBelli();
  }

  return (
    <OrnatePanel
      accent={accent}
      cornersSize={14}
      style={{
        background: 'linear-gradient(180deg, rgba(122, 36, 50, 0.18) 0%, rgba(22, 19, 34, 0.98) 70%)',
        border: `1px solid ${accent}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.12, pointerEvents: 'none' }}>
        <LaurelWreath size={110} color={accent} opacity={1} />
      </div>
      <div style={{
        fontSize: 9, letterSpacing: 3,
        color: 'var(--imp-text-lo)',
        textTransform: 'uppercase', marginBottom: 4,
      }}>
        The Next Campaign
      </div>
      <div style={{
        fontFamily: 'var(--imp-font-display)',
        fontSize: 24, fontWeight: 500, letterSpacing: 2,
        color: 'var(--imp-text-hi)',
        textTransform: 'uppercase', marginBottom: 14,
      }}>
        {campaignTitle}
      </div>
      {/* ── Supply warning ── */}
      {supplyWarning && (
        <div style={{
          marginBottom: 10,
          padding: '8px 12px',
          background: 'rgba(212, 139, 58, 0.12)',
          border: '1px solid rgba(212, 139, 58, 0.5)',
          borderRadius: 2,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.4 }}>⚠</span>
          <div style={{
            fontSize: 10,
            color: '#d48b3a',
            fontFamily: 'var(--imp-font-serif)',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}>
            Supplies: {suppliesHave}/{suppliesNeeded} — cohorts will take HP & morale attrition
          </div>
        </div>
      )}

      <button
        onClick={handleEmbark}
        disabled={!canEmbark}
        style={{
          width: '100%', padding: '12px',
          background: canEmbark
            ? `linear-gradient(180deg, ${accent} 0%, #b8892a 100%)`
            : 'rgba(80, 70, 50, 0.4)',
          border: 'none', borderRadius: 2,
          cursor: canEmbark ? 'pointer' : 'not-allowed',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 13, fontWeight: 700,
          letterSpacing: 4,
          color: canEmbark ? 'var(--imp-ink)' : 'var(--imp-text-lo)',
          textTransform: 'uppercase',
          boxShadow: canEmbark
            ? `0 2px 12px ${accent}60, inset 0 1px 0 rgba(255, 255, 255, 0.3)`
            : 'none',
          transition: 'all 160ms',
        }}
      >
        ⚔ Embark ⚔
      </button>
    </OrnatePanel>
  );
}
