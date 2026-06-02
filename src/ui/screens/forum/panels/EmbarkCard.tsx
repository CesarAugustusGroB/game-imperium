import { useMemo } from 'preact/hooks';
import { councilSlots, plannedCampaignDuration, canEmbarkFromCouncil } from '../../../../game/council/council-store';
import { preparedArmy, preparedLegate } from '../../../../game/progression/strategic-store';
import { getResource } from '../../../../game/core/resources';
import { selectedCommander } from '../../../../game/core/game-state';
import { startIterBelliCampaign, computeStartingDiscipline } from '../../../../game/iterBelli/iter-belli-state';
import { getActiveScenario } from '../../../../game/iterBelli/iter-belli-scenario';
import { computeConsiliumSetup, getMissionById, computeSecondaryQuests } from '../../../../data/iter-belli-consilium';
import { equippedDoctrines, getEmbarkBonus } from '../../../../game/items/doctrine-store';
import { computeDoctrineModifiers } from '../../../../data/iter-belli-doctrines';
import { SUPPLY_UPKEEP_PER_TURN, START } from '../../../../game/iterBelli/iter-belli-balance';
import { SUPPLIES_STARTING_STOCK } from '../../../../config/game-config';
import { navigateToIterBelli } from '../../../screens';
import { playSfx } from '../../../sound/sfx';
import { BentoCard } from '../../../components/BentoCard';
import campaignBriefingBackground from '../../../../assets/ui/campaign/campaign-briefing-background.png';

interface EmbarkCardProps {
  accent?: string;
  index?: number;
}

export function EmbarkCard({ accent = '#d4a843', index = 0 }: EmbarkCardProps) {
  const army = preparedArmy.value;

  const consilium = computeConsiliumSetup(councilSlots.value);
  const seatedCount = councilSlots.value.filter(Boolean).length;
  const seatTotal = councilSlots.value.length;
  const cohortCount = army?.cohorts?.length ?? 0;
  const mission = getMissionById(consilium.missionId);
  const modSummary = [
    consilium.supplies ? `+${consilium.supplies} suministros` : null,
    consilium.threat ? `-${consilium.threat} amenaza` : null,
    consilium.gold ? `+${consilium.gold} oro` : null,
    consilium.morale ? `+${consilium.morale} moral` : null,
  ].filter(Boolean).join(' | ');

  // Memoize so the quests' random locations stay stable for a given seated
  // council (computeSecondaryQuests uses Math.random); recomputed only when the
  // seating changes. handleEmbark seeds this exact value into the campaign.
  const secondaryQuests = useMemo(() => computeSecondaryQuests(councilSlots.value), [councilSlots.value]);
  const questPreview = secondaryQuests.map((q) => q.title).join(' | ');

  const doctrineModifiers = useMemo(() => computeDoctrineModifiers(equippedDoctrines.value), [equippedDoctrines.value]);
  const doctrinePreview = [...new Set(doctrineModifiers.map((m) => m.label))].join(' | ');

  const campaignTitle = `Campaña — ${getActiveScenario().enemy.name}`;
  const canEmbark = canEmbarkFromCouncil();

  // Supply warning: warn if the Hub stock is below the campaign's upkeep budget.
  const suppliesHave = army?.supplies ?? SUPPLIES_STARTING_STOCK;
  const suppliesRecommended = SUPPLY_UPKEEP_PER_TURN * START.timeRemaining;
  const supplyWarning = canEmbark && suppliesHave < suppliesRecommended;

  function handleEmbark() {
    if (!canEmbark) return;
    playSfx('ui_click');
    // Hybrid seed: soldiers from the prepared army's effective HP, gold from the run.
    const cohorts = army?.cohorts ?? [];
    const soldiers = cohorts.reduce((sum, c) => sum + (c.currentHp ?? c.stats.hp), 0);
    const archetype = selectedCommander.value?.archetype ?? null;
    const discipline = computeStartingDiscipline(archetype, preparedLegate.value?.traitIds ?? []);
    const spokeTerrain = getActiveScenario().provinceTerrain;
    const spokeDuration = plannedCampaignDuration();
    const supplies = (army?.supplies ?? SUPPLIES_STARTING_STOCK) + consilium.supplies;
    const embark = getEmbarkBonus();
    startIterBelliCampaign({
      soldiers: soldiers + embark.soldiers + consilium.soldiers,
      gold: getResource('gold') + consilium.gold,
      iuniores: getResource('iuniores'),
      discipline: discipline + embark.discipline,
      archetype, spokeTerrain, spokeDuration,
      supplies: supplies + embark.supplies,
      missionId: consilium.missionId ?? undefined,
      startThreat: START.threat - consilium.threat,
      startMorale: START.morale + consilium.morale + embark.morale,
      enemyWeaken: consilium.enemyWeaken,
      extraDays: consilium.extraDays,
      quests: secondaryQuests,
      doctrineModifiers,
    });
    navigateToIterBelli();
  }

  return (
    <BentoCard
      accent={accent}
      index={index}
      style={{
        minHeight: 292,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(212, 168, 67, 0.58)',
        overflow: 'hidden',
        boxShadow: '0 16px 38px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(0, 0, 0, 0.72)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(90deg, rgba(8, 10, 11, 0.94) 0%, rgba(13, 12, 12, 0.78) 43%, rgba(19, 12, 8, 0.22) 100%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.58) 100%),
            url(${campaignBriefingBackground})
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: 'scale(1.01)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 5,
          border: '1px solid rgba(212, 168, 67, 0.16)',
          boxShadow: 'inset 0 0 42px rgba(0, 0, 0, 0.72)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--imp-font-body)',
          fontSize: 9, letterSpacing: 2,
          color: canEmbark ? 'rgba(158, 211, 180, 0.9)' : 'rgba(223, 205, 172, 0.5)',
          textTransform: 'uppercase',
          marginBottom: 9,
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.95)',
        }}>
          <span
            class="imp-pulse-dot"
            style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: canEmbark ? 'var(--imp-oxidize)' : 'var(--imp-text-lo)',
              animation: canEmbark ? 'imp-pulse-dot 1.8s var(--ease-default) infinite' : 'none',
            }}
          />
          {canEmbark ? 'Legions Ready' : 'Standing By'} · {seatedCount}/{seatTotal} Seated · {cohortCount} Cohort{cohortCount === 1 ? '' : 's'}
        </div>
        <div style={{
          fontSize: 9,
          letterSpacing: 2.4,
          color: 'rgba(223, 205, 172, 0.55)',
          textTransform: 'uppercase',
          marginBottom: 3,
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.95)',
        }}>
          The Next Campaign
        </div>
        <div style={{
          fontFamily: 'var(--imp-font-display)',
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: 2.3,
          color: 'rgba(246, 233, 210, 0.95)',
          textTransform: 'uppercase',
          marginBottom: 27,
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.86)',
        }}>
          {campaignTitle}
        </div>

        {(mission || modSummary || questPreview || doctrinePreview) && (
          <div style={{
            marginBottom: 16,
            padding: '13px 32px 14px',
            minHeight: 91,
            width: 'fit-content',
            maxWidth: 'min(100%, 520px)',
            background: 'linear-gradient(90deg, rgba(7, 8, 9, 0.68), rgba(19, 18, 17, 0.44))',
            border: '1px solid rgba(166, 115, 43, 0.42)',
            borderRadius: 2,
            boxShadow: 'inset 0 0 22px rgba(0, 0, 0, 0.48)',
          }}>
            {mission && (
              <>
                <div style={{ fontFamily: 'var(--imp-font-display)', fontSize: 13, letterSpacing: 0.8, color: 'var(--imp-gold-hi)' }}>
                  <span aria-hidden="true" style={{ marginRight: 7 }}>o</span>
                  Mission: {mission.title}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(229, 216, 194, 0.76)', fontFamily: 'var(--imp-font-serif)', marginTop: 13, paddingLeft: 24 }}>
                  Termina la ruta con {mission.conditionDesc}.
                </div>
                <div style={{ fontSize: 11, color: 'rgba(229, 216, 194, 0.72)', fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic', marginTop: 14, paddingLeft: 24 }}>
                  Bonus: +{mission.bonusGold} oro al cumplir la mision Consilium.
                </div>
              </>
            )}
            {!mission && modSummary && (
              <div style={{ fontSize: 11, color: 'rgba(229, 216, 194, 0.76)', fontFamily: 'var(--imp-font-serif)', fontStyle: 'italic' }}>
                Consilium: {modSummary}
              </div>
            )}
          </div>
        )}

        {supplyWarning && (
          <div style={{
            marginBottom: 12,
            padding: '8px 12px',
            background: 'rgba(20, 10, 5, 0.58)',
            border: '1px solid rgba(212, 139, 58, 0.5)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}>
            <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.4 }}>!</span>
            <div style={{
              fontSize: 10,
              color: '#d48b3a',
              fontFamily: 'var(--imp-font-serif)',
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}>
              Supplies: {suppliesHave}/{suppliesRecommended} - buy more in Exercitus or the campaign may starve
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={handleEmbark}
          disabled={!canEmbark}
          data-no-lift
          style={{
            alignSelf: 'center',
            width: '50%',
            minWidth: 190,
            minHeight: 58,
            padding: '12px 18px',
            position: 'relative',
            overflow: 'hidden',
            background: canEmbark
              ? 'linear-gradient(180deg, rgba(18, 22, 26, 0.92), rgba(9, 11, 14, 0.9)), radial-gradient(ellipse at center, rgba(212, 168, 67, 0.12), transparent 64%)'
              : 'linear-gradient(180deg, rgba(30, 30, 28, 0.68), rgba(12, 12, 12, 0.74))',
            border: '2px solid rgba(212, 168, 67, 0.8)',
            borderRadius: 3,
            cursor: canEmbark ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--imp-font-display)',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 4,
            color: canEmbark ? '#f3cb74' : 'var(--imp-text-lo)',
            textTransform: 'uppercase',
            textShadow: canEmbark ? '0 2px 6px rgba(0, 0, 0, 0.95), 0 0 18px rgba(212, 168, 67, 0.22)' : 'none',
            boxShadow: canEmbark
              ? '0 0 0 1px rgba(0, 0, 0, 0.88), inset 0 0 0 2px rgba(240, 208, 128, 0.18), inset 0 0 34px rgba(0, 0, 0, 0.74), 0 12px 30px rgba(0, 0, 0, 0.62)'
              : 'none',
            transition: 'transform var(--duration-fast) var(--ease-default), border-color var(--duration-normal) var(--ease-default), color var(--duration-normal) var(--ease-default), box-shadow var(--duration-normal) var(--ease-default), background var(--duration-normal) var(--ease-default)',
          }}
        >
          {canEmbark && <span class="imp-embark-sheen" aria-hidden="true" />}
          <span style={{ position: 'relative', zIndex: 1 }}>Embark</span>
        </button>
      </div>
    </BentoCard>
  );
}
