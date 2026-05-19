import { toDeck } from './deckHelpers.js';

export function resetAutomixTimeline(state, deck = 'A') {
  state.nextTriggerMs = -1;
  state.triggeredForTrack = false;
  state.currentPlayingDeck = toDeck(deck);
}

export function setAutomixTriggerMs(state, triggerMs) {
  state.nextTriggerMs = Number(triggerMs) > 0 ? Number(triggerMs) : -1;
  state.triggeredForTrack = false;
}

export function shouldTriggerAutomix(state, positionMs) {
  const position = Number(positionMs) || 0;
  return !state.triggeredForTrack && state.nextTriggerMs > 0 && position >= state.nextTriggerMs;
}

export function markAutomixTriggered(state) {
  state.triggeredForTrack = true;
}
