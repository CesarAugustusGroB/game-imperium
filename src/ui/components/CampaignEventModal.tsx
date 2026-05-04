// S30-10: lightweight modal that fronts the campaign hex event flow.
// Reads activeEventTileId + hexTiles signals, derives the payload from
// getEventContent, and clears the event on any action so re-entry won't
// re-fire the modal. The full encounter dispatch (battle/forage/etc.)
// is deferred to S31's gameplay-systems sprint.

import { useEffect, useState } from 'preact/hooks';
import { activeEventId, activeEventTileId, hexTiles, setActiveEvent, setActiveEventId } from '../../game/campaign/campaign-state';
import { getEventColor, getEventContent, getEventIcon, getEventIconUrl } from '../../game/campaign/events';
import { resolveEncounter } from '../../game/campaign/encounter-bridge';
import { getCurrentResources, resolveCampaignTileEvent } from '../../game/campaign/campaign-tile-event-engine';
import { isCampaignTileEventType, pickCampaignTileEvent } from '../../game/campaign/campaign-tile-events';
import { addNotification } from '../notifications/notification-store';
import { OrnateFrame, OrnateHeader, OrnateDivider } from './OrnateFrame';
import { colorToCss } from '../../utils/color';
import { FACTION_COLORS, type Faction } from '../../game/core/commander';
import { ChoiceButton } from './ChoiceButton';

// Shared CSS injection (mirrors EventModal pattern).
if (typeof document !== 'undefined' && !document.getElementById('campaign-event-modal-styles')) {
  const el = document.createElement('style');
  el.id = 'campaign-event-modal-styles';
  el.textContent = `
    .campaign-event-modal-card {
      position: relative;
    }
    @media (prefers-reduced-motion: no-preference) {
      @keyframes campaign-event-modal-in {
        from { opacity: 0; transform: scale(0.95) translateY(8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      .campaign-event-modal-card {
        animation: campaign-event-modal-in 0.25s var(--ease-default);
      }
      /* S34-08: dismiss fade-out */
      @keyframes campaign-event-modal-out {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(0.97); }
      }
      .campaign-event-modal-card--exiting {
        animation: campaign-event-modal-out 150ms var(--ease-default) forwards;
      }
      /* S34-08: banner shimmer — subtle alpha pulse on the accent band */
      @keyframes campaign-event-banner-shimmer {
        0%, 100% { opacity: 0.85; }
        50%      { opacity: 1; }
      }
      .campaign-event-banner {
        animation: campaign-event-banner-shimmer 2.4s ease-in-out infinite;
      }
    }
    .campaign-event-close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid rgba(212, 168, 67, 0.3);
      border-radius: var(--radius-sm);
      color: var(--color-gold-dim);
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
      z-index: 1;
    }
    .campaign-event-close-btn:hover {
      color: var(--color-gold-primary);
      border-color: rgba(212, 168, 67, 0.7);
      background: rgba(212, 168, 67, 0.08);
    }
    .campaign-event-action {
      display: block;
      width: 100%;
      padding: 10px 16px;
      background: rgba(212, 168, 67, 0.08);
      border: 1px solid rgba(212, 168, 67, 0.45);
      border-radius: var(--radius-sm);
      color: var(--imp-text);
      font-family: var(--imp-font-body);
      font-size: var(--font-size-md);
      letter-spacing: 0.04em;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .campaign-event-action:hover {
      background: rgba(212, 168, 67, 0.18);
      border-color: rgba(212, 168, 67, 0.75);
    }
    /* Primary action (first choice) — filled gold-tinted, slightly bolder */
    .campaign-event-action--primary {
      background: linear-gradient(180deg, rgba(212, 168, 67, 0.28), rgba(212, 168, 67, 0.18));
      border-color: rgba(212, 168, 67, 0.85);
      color: var(--color-gold-primary);
      font-weight: 700;
    }
    .campaign-event-action--primary:hover {
      background: linear-gradient(180deg, rgba(212, 168, 67, 0.40), rgba(212, 168, 67, 0.28));
      border-color: rgba(212, 168, 67, 1);
    }
  `;
  document.head.appendChild(el);
}

export function CampaignEventModal() {
  const tileId = activeEventTileId.value;
  const persistedEventId = activeEventId.value;
  const tile = tileId ? hexTiles.value.find((t) => t.id === tileId) : null;
  const campaignTileEvent = tile ? pickCampaignTileEvent(tile, persistedEventId) : null;

  // S34-08: dismiss animation state.
  const [exiting, setExiting] = useState(false);

  // S34-08: stageDismiss — plays the 150ms exit animation then calls the
  // provided callback. Resets `exiting` after so the next mount starts clean.
  function stageDismiss(then: () => void): void {
    setExiting(true);
    window.setTimeout(() => {
      then();
      setExiting(false);
    }, 150);
  }

  // S34-08: if the event is cleared externally (e.g. battle navigation clears
  // activeEventTileId without going through a button), ensure we don't leave
  // the modal stuck in the exiting state on its next mount.
  useEffect(() => {
    if (!tileId) setExiting(false);
  }, [tileId]);

  // 3a-3: Escape key dismisses without consuming the event.
  useEffect(() => {
    if (!tileId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stageDismiss(() => setActiveEvent(null));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tileId]);

  useEffect(() => {
    if (!tileId || !campaignTileEvent) return;
    if (persistedEventId === campaignTileEvent.id) return;
    setActiveEventId(campaignTileEvent.id);
  }, [tileId, persistedEventId, campaignTileEvent?.id]);

  if (!tileId) return null;
  if (!tile) return null;

  const isCampaignTileEvent = isCampaignTileEventType(tile.event) && campaignTileEvent !== null;
  const content = isCampaignTileEvent ? null : getEventContent(tile);
  if (!isCampaignTileEvent && !content) return null;

  const accent = isCampaignTileEvent
    ? getCampaignTileEventAccent(campaignTileEvent.color)
    : colorToCss(getEventColor(tile.event));
  const icon = getEventIcon(tile.event);
  const iconUrl = getEventIconUrl(tile.event);

  const handleAction = (index: number): void => {
    // S34-08: stage the dismiss animation first, then dispatch inside the
    // callback so the exit plays before the modal unmounts.
    stageDismiss(() => {
      // Dispatch the chosen action through the encounter bridge.
      // Battle/elite/ambush launch BattleScreenV2 via launchHexBattle;
      // others apply morale/supplies/gold deltas directly.
      //
      // S32-07 audit: order is `dispatch → consumeEvent` inside resolveEncounter.
      // For the battle path, dispatch sets currentSpoke + navigates to battleV2,
      // then consumeEvent clears activeEventTileId. All writes are synchronous
      // inside this click callback so Preact batches them — its next render
      // observes the post-state of every write at once. No intermediate frame
      // shows "modal-still-up + battle-screen-visible", so swapping the order
      // (consume-first) is unnecessary.
      const outcome = isCampaignTileEvent
        ? resolveCampaignTileEvent(tile, campaignTileEvent, index)
        : resolveEncounter(tile, index);
      if (outcome.message) {
        addNotification({
          kind: 'toast',
          message: outcome.message,
          icon,
          color: accent,
        });
      }
    });
  };

  // 3a-2: backdrop click dismisses without consuming the event.
  const handleBackdropClick = (): void => {
    stageDismiss(() => setActiveEvent(null));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
      }}
      onClick={handleBackdropClick}
    >
      <OrnateFrame
        className={exiting ? 'campaign-event-modal-card campaign-event-modal-card--exiting' : 'campaign-event-modal-card'}
        width="min(520px, 92vw)"
        padding="compact"
        style={{ maxHeight: '85vh', overflow: 'hidden' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* 3a-1: Close button — top-right of OrnateFrame. Does not consume the event. */}
        <button
          type="button"
          class="campaign-event-close-btn"
          onClick={() => stageDismiss(() => setActiveEvent(null))}
          aria-label="Close encounter"
        >
          ×
        </button>

        {/* S34-08: campaign-event-banner class drives the shimmer animation */}
        <div
          class="campaign-event-banner"
          style={{
            height: '120px',
            width: 'calc(100% + 48px)',
            marginLeft: '-24px',
            marginTop: '-20px',
            marginBottom: '0',
            background: `linear-gradient(135deg, ${accent}55, ${accent}1a)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              style={{
                width: '64px',
                height: '64px',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            />
          ) : (
            <span
              style={{
                fontSize: '48px',
                color: accent,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                fontWeight: 'bold',
              }}
            >
              {icon}
            </span>
          )}
        </div>

        <div style={{ marginTop: '16px' }}>
          <OrnateHeader
            titleSize="md"
            eyebrow={isCampaignTileEvent ? `T${campaignTileEvent.tier} Encounter` : 'Encounter'}
            title={isCampaignTileEvent ? campaignTileEvent.title : content!.title}
            accentColor={accent}
          />
        </div>

        <p
          style={{
            margin: '0 0 var(--space-md) 0',
            fontSize: 'var(--font-size-md)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {isCampaignTileEvent ? campaignTileEvent.description : content!.description}
        </p>

        <OrnateDivider />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
          }}
        >
          {/* 3b: first action is primary (filled gold-tinted); subsequent are secondary (outline). */}
          {isCampaignTileEvent
            ? campaignTileEvent.choices.map((choice, i) => (
                <ChoiceButton
                  key={i}
                  choice={choice}
                  index={i}
                  onSelect={handleAction}
                  currentResources={getCurrentResources()}
                />
              ))
            : content!.actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  class={i === 0 ? 'campaign-event-action campaign-event-action--primary' : 'campaign-event-action'}
                  onClick={() => handleAction(i)}
                >
                  {action}
                </button>
              ))}
        </div>
      </OrnateFrame>
    </div>
  );
}

function getCampaignTileEventAccent(color: Faction | 'neutral'): string {
  return color === 'neutral' ? 'var(--color-gold-secondary)' : FACTION_COLORS[color];
}
