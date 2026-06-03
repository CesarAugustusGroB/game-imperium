import type { JSX } from 'preact';
import type { Advisor } from '../../../../../game/council/advisor';
import { getDiscountedAdvisorCost } from '../../../../../game/council/council-store';
import { FACTION_COLORS } from '../../../../../game/core/commander';
import { Corners } from '../../../../components/motifs/Corners';
import { ResourceAmount } from '../../../../components/ResourceIcon';
import { TraitGlyph } from './TraitGlyph';

const ROMAN: readonly string[] = ['I', 'II', 'III'];

interface AdvisorMarketCardProps {
  advisor: Advisor;
  accent?: string;
  disabled?: boolean;
  selected?: boolean;
  actionLabel?: string;
  unavailableReason?: string;
  onSelect?: (advisor: Advisor) => void;
  onHire?: (advisor: Advisor) => void;
  style?: JSX.CSSProperties;
}

export function AdvisorMarketCard({
  advisor,
  accent = 'var(--imp-gold)',
  disabled = false,
  selected = false,
  actionLabel = 'Hire & Seat',
  unavailableReason,
  onSelect,
  onHire,
  style,
}: AdvisorMarketCardProps) {
  const factionColor = FACTION_COLORS[advisor.color];
  const initial = advisor.name.charAt(0).toUpperCase();

  function handleHire(event: MouseEvent) {
    event.stopPropagation();
    if (!disabled) onHire?.(advisor);
  }

  return (
    <article
      onClick={() => onSelect?.(advisor)}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '88px minmax(0, 1fr)',
        gap: 12,
        minWidth: 0,
        padding: 10,
        borderRadius: 2,
        border: `1px solid ${selected ? accent : 'var(--imp-gold-dim)'}`,
        background: selected
          ? 'linear-gradient(180deg, rgba(122, 36, 50, 0.34) 0%, rgba(13, 11, 20, 0.96) 100%)'
          : 'linear-gradient(180deg, rgba(34, 30, 48, 0.92) 0%, rgba(13, 11, 20, 0.94) 100%)',
        boxShadow: selected ? `0 0 0 1px ${accent}33, inset 0 0 24px ${accent}14` : 'inset 0 0 18px rgba(0, 0, 0, 0.2)',
        cursor: onSelect ? 'pointer' : 'default',
        opacity: disabled ? 0.68 : 1,
        transition: 'border-color var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <Corners color={selected ? accent : factionColor} size={10} inset={4} thickness={1} />

      <div style={{
        position: 'relative',
        aspectRatio: '2/3',
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${factionColor}`,
        background: `radial-gradient(ellipse at center top, ${factionColor}44 0%, rgba(13, 11, 20, 0.98) 72%)`,
      }}>
        {advisor.portrait ? (
          <img
            src={advisor.portrait}
            alt={advisor.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 18%',
              filter: 'saturate(0.9) contrast(1.06)',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: factionColor,
            fontFamily: 'var(--imp-font-display)',
            fontSize: 42,
            fontWeight: 700,
            opacity: 0.72,
          }}>
            {initial}
          </div>
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, transparent 48%, rgba(0, 0, 0, 0.88) 100%)',
        }} />
        <div style={{
          position: 'absolute',
          right: 5,
          top: 5,
          width: 21,
          height: 21,
          borderRadius: '50%',
          border: `1px solid ${accent}`,
          background: 'rgba(13, 11, 20, 0.88)',
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--imp-font-display)',
          fontSize: 9,
          fontWeight: 800,
        }}>
          {ROMAN[advisor.currentTier - 1] ?? 'I'}
        </div>
      </div>

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: 'var(--imp-text-hi)',
            fontFamily: 'var(--imp-font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1.3,
            lineHeight: 1.1,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {advisor.name}
          </div>
          <div style={{
            marginTop: 3,
            color: 'var(--imp-text-lo)',
            fontFamily: 'var(--imp-font-body)',
            fontSize: 9,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
          }}>
            Political offer
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, minWidth: 0, flexWrap: 'wrap' }}>
          {advisor.traits.map((trait) => (
            <TraitGlyph key={trait} trait={trait} size={20} />
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 'auto',
          minWidth: 0,
        }}>
          <div style={{
            color: accent,
            fontFamily: 'var(--imp-font-mono)',
            fontSize: 13,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}>
            <ResourceAmount type="gold" amount={getDiscountedAdvisorCost(advisor)} iconSize={14} />
          </div>
          <button
            type="button"
            disabled={disabled}
            title={disabled ? unavailableReason : actionLabel}
            onClick={handleHire}
            style={{
              minWidth: 0,
              maxWidth: 132,
              padding: '7px 10px',
              borderRadius: 2,
              border: disabled ? '1px solid var(--imp-gold-faint)' : 'none',
              background: disabled
                ? 'rgba(80, 70, 50, 0.26)'
                : `linear-gradient(180deg, ${accent} 0%, var(--imp-gold-mid) 100%)`,
              color: disabled ? 'var(--imp-text-lo)' : 'var(--imp-ink)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--imp-font-display)',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1.1,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
