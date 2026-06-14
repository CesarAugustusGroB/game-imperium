import { signal } from '@preact/signals';
import type { Advisor } from './advisor';
import { getCurrentSpokeTemplate, getTierForXp, getCurrentPassive } from './advisor';
import { getShopDiscount } from '../items/doctrine-store';
import { refundResource, spendResource } from '../core/resources';
import type { ResourceType } from '../core/commander';
import { addNotification } from '../../ui/notifications/notification-store';

// ── Council signals ──

/** The 3 advisor slots. null = empty seat. */
export const councilSlots = signal<(Advisor | null)[]>([null, null, null]);

/** Purchasable advisor offers. These are not owned until hired. */
export const advisorMarket = signal<Advisor[]>([]);

/** Names of advisors who tiered up at last spoke completion. Cleared when hub is shown. */
export const tierUpNotices = signal<string[]>([]);

// ── Slot management ──

/**
 * Seat an advisor into the given slot (0–2).
 * Internal/test helper: UI hiring should use hireAndSeatAdvisor.
 * If the slot is occupied, the displaced advisor returns to the market.
 * Removes the incoming advisor from the market if present.
 * Returns false if slotIndex is out of range.
 */
export function seatAdvisor(slotIndex: number, advisor: Advisor): boolean {
  if (slotIndex < 0 || slotIndex > 2) return false;

  const slots = councilSlots.value.slice() as (Advisor | null)[];
  const market = advisorMarket.value.slice();

  const displaced = slots[slotIndex];
  if (displaced !== null) {
    market.push(displaced);
  }

  const marketIndex = market.findIndex(a => a.id === advisor.id);
  if (marketIndex !== -1) {
    market.splice(marketIndex, 1);
  }

  slots[slotIndex] = advisor;

  councilSlots.value = slots;
  advisorMarket.value = market;

  return true;
}

/**
 * Move the advisor in the given slot back to the market.
 * No-op if slot is empty or index is invalid.
 */
export function unseatAdvisor(slotIndex: number): void {
  if (slotIndex < 0 || slotIndex > 2) return;

  const slots = councilSlots.value.slice() as (Advisor | null)[];
  const advisor = slots[slotIndex];
  if (advisor === null) return;

  const market = advisorMarket.value.slice();
  market.push(advisor);
  slots[slotIndex] = null;

  councilSlots.value = slots;
  advisorMarket.value = market;
}

/** Replace the current political market offers. */
export function setAdvisorMarket(advisors: Advisor[]): void {
  advisorMarket.value = advisors.slice();
}

/** Add one purchasable advisor offer if it is not already present. */
export function addAdvisorMarketOffer(advisor: Advisor): void {
  if (advisorMarket.value.some(a => a.id === advisor.id)) return;
  advisorMarket.value = [...advisorMarket.value, advisor];
}

function getAdvisorCost(advisor: Advisor): { resource: ResourceType; amount: number } {
  const pct = Math.min(75, getShopDiscount() + advisorShopDiscount());
  return { resource: 'gold', amount: Math.max(1, Math.round(advisor.cost * (1 - pct / 100))) };
}

/** Advisor hire gold cost after equipped-doctrine shop-discount (for UI gate + display). */
export function getDiscountedAdvisorCost(advisor: Advisor): number {
  return getAdvisorCost(advisor).amount;
}

/**
 * Buy an advisor from the political market and seat them immediately.
 * Returns false and mutates nothing if the offer is missing, unaffordable,
 * the slot is invalid, or the target seat is occupied.
 */
export function hireAndSeatAdvisor(advisor: Advisor, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex > 2) return false;

  const slots = councilSlots.value.slice() as (Advisor | null)[];
  if (slots[slotIndex] !== null) return false;

  const market = advisorMarket.value.slice();
  const offerIndex = market.findIndex(a => a.id === advisor.id);
  if (offerIndex === -1) return false;

  const offer = market[offerIndex];
  const cost = getAdvisorCost(offer);
  if (cost.amount > 0 && !spendResource(cost.resource, cost.amount)) return false;

  slots[slotIndex] = { ...offer };
  market.splice(offerIndex, 1);

  councilSlots.value = slots;
  advisorMarket.value = market;

  return true;
}

/**
 * Remove an advisor from the market (NOT from a seated slot) and sell for gold.
 * Sell price = 4 + (currentTier - 1) * 2.
 * Returns gold gained, or 0 if not found in market or if the advisor is seated.
 */
export function fireAdvisor(advisorId: string): number {
  // Refuse to fire a seated advisor
  if (councilSlots.value.some(a => a?.id === advisorId)) return 0;

  const market = advisorMarket.value.slice();
  const index = market.findIndex(a => a.id === advisorId);
  if (index === -1) return 0;

  const advisor = market[index];
  const goldGained = 4 + (advisor.currentTier - 1) * 2;

  market.splice(index, 1);
  advisorMarket.value = market;

  // Face value (refundResource) — no income-modifier tracking, so firing returns
  // exactly the shown gold and is not inflated by War Profiteer / loot-bonus.
  refundResource('gold', goldGained);

  return goldGained;
}

/**
 * Grant XP to an advisor (in slots or pool), auto-tier-up if threshold reached.
 * Creates new objects for signal reactivity.
 * Returns true if the advisor tiered up.
 */
export function grantAdvisorXp(advisorId: string, amount: number): boolean {
  if (amount <= 0) return false;
  const slots = councilSlots.value.slice() as (Advisor | null)[];
  const market = advisorMarket.value.slice();

  let found = false;
  let tieredUp = false;

  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    if (a && a.id === advisorId) {
      const newXp = a.xp + amount;
      const newTier = getTierForXp(newXp);
      tieredUp = newTier > a.currentTier;
      slots[i] = { ...a, xp: newXp, currentTier: newTier };
      found = true;
      break;
    }
  }

  if (!found) {
    for (let i = 0; i < market.length; i++) {
      const a = market[i];
      if (a.id === advisorId) {
        const newXp = a.xp + amount;
        const newTier = getTierForXp(newXp);
        tieredUp = newTier > a.currentTier;
        market[i] = { ...a, xp: newXp, currentTier: newTier };
        found = true;
        break;
      }
    }
  }

  if (!found) return false;

  councilSlots.value = slots;
  advisorMarket.value = market;

  if (tieredUp) {
    // Find the advisor's updated tier from slots or pool
    const updated =
      slots.find(a => a?.id === advisorId) ??
      market.find(a => a.id === advisorId);
    if (updated) {
      const newTierRoman = (['I', 'II', 'III'] as const)[updated.currentTier - 1] ?? 'III';
      addNotification({
        kind: 'toast',
        icon: '⭐',
        title: 'Advisor Promoted',
        message: `${updated.name} advanced to Tier ${newTierRoman}`,
        color: '#d4a843',
      });
    }
  }

  return tieredUp;
}

/**
 * Apply a SIGNED xp delta to an advisor (campaign-event consequence, D10).
 * Positive routes through grantAdvisorXp (auto tier-up + promotion toast); negative
 * reduces xp toward 0 WITHOUT stripping an already-earned tier (rank is earned,
 * not lost — losing favour only slows the next promotion). Returns true if applied.
 */
export function adjustAdvisorXp(advisorId: string, delta: number): boolean {
  if (delta > 0) return grantAdvisorXp(advisorId, delta);
  if (delta === 0) return false;
  const slots = councilSlots.value.slice() as (Advisor | null)[];
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    if (a && a.id === advisorId) {
      slots[i] = { ...a, xp: Math.max(0, a.xp + delta) };
      councilSlots.value = slots;
      return true;
    }
  }
  const market = advisorMarket.value.slice();
  for (let i = 0; i < market.length; i++) {
    if (market[i].id === advisorId) {
      market[i] = { ...market[i], xp: Math.max(0, market[i].xp + delta) };
      advisorMarket.value = market;
      return true;
    }
  }
  return false;
}

// ── Advisor passive aggregators ──

/** Sum of shop-discount percents from all seated advisors. */
export function advisorShopDiscount(): number {
  let sum = 0;
  for (const a of councilSlots.value) {
    if (!a) continue;
    const p = getCurrentPassive(a);
    if (p.type === 'shop-discount') sum += p.percent;
  }
  return sum;
}

/** Additive income multiplier for a resource from seated advisors' loot-bonus (gold only). */
export function advisorIncomeBonus(resource: ResourceType): number {
  let bonus = 0;
  for (const a of councilSlots.value) {
    if (!a) continue;
    const p = getCurrentPassive(a);
    if (p.type === 'loot-bonus' && resource === 'gold') bonus += p.percent / 100;
  }
  return bonus;
}

/**
 * Campaign duration (seasons) derived from seated advisors —
 * derived from seated advisors' campaign-duration templates. 0 seated → 1
 * (matches the old `spoke?.duration ?? 1` fallback).
 */
export function plannedCampaignDuration(): number {
  const seated = councilSlots.value.filter((a): a is Advisor => a !== null);
  if (seated.length === 0) return 1;
  const avg = seated.reduce((sum, a) => {
    const [min, max] = getCurrentSpokeTemplate(a).durationRange;
    return sum + (min + max) / 2;
  }, 0) / seated.length;
  return Math.round(Math.min(4, Math.max(2, avg)));
}

/** Embark is allowed once at least one advisor is seated (preserves the old
 *  gate: no seated council → no plannedSpoke → embark disabled). */
export function canEmbarkFromCouncil(): boolean {
  return councilSlots.value.some(Boolean);
}

/** Reset all council state (called on run end / title screen return). */
export function resetCouncilStore(): void {
  councilSlots.value = [null, null, null];
  advisorMarket.value = [];
  tierUpNotices.value = [];
}
