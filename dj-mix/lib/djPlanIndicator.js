/**
 * djPlanIndicator.js — Pure logic for computing the DJ Plan indicator state.
 *
 * When DJ Plan is ON, the indicator must always be visible. This function
 * computes what to show (ready data, or a graceful fallback state) without
 * ever hiding the indicator while the plan is enabled.
 */

/**
 * @typedef {'no-track'|'no-transition'|'next-not-found'|'ready'} DjPlanIndicatorStatus
 *
 * @typedef {Object} DjPlanIndicatorState
 * @property {boolean} visible
 * @property {DjPlanIndicatorStatus} [state]
 * @property {Object} [item]       — current fil rouge item
 * @property {Object} [transition] — item.djTransition
 * @property {Object} [nextItem]   — item at transition.toItemId
 */

/**
 * Compute what the DJ Plan indicator should show.
 *
 * Never returns `visible: false` when `enabled` is true — always picks a
 * graceful fallback state so the indicator stays on screen.
 *
 * @param {{ enabled: boolean, playlist: Object[], playingId: string|number|null, currentIndex: number }} opts
 * @returns {DjPlanIndicatorState}
 */
export function computeDjPlanIndicatorState({ enabled, playlist, playingId, currentIndex }) {
  if (!enabled) return { visible: false };

  const byPlayingId = playingId != null
    ? (playlist.find((p) => String(p.id) === String(playingId)) ?? null)
    : null;
  const currentItem = byPlayingId ?? (currentIndex >= 0 ? (playlist[currentIndex] ?? null) : null);

  if (!currentItem) return { visible: true, state: 'no-track' };

  const t = currentItem.djTransition;
  if (!t || !t.toItemId) return { visible: true, state: 'no-transition', item: currentItem };

  const nextItem = playlist.find((p) => String(p.id) === String(t.toItemId)) ?? null;
  if (!nextItem) return { visible: true, state: 'next-not-found', item: currentItem, transition: t };

  return { visible: true, state: 'ready', item: currentItem, transition: t, nextItem };
}
