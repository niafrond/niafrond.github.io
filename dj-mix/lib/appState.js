export function createAppState() {
  return {
    queueDnd: {
      draggedQueueIndex: -1,
      suppressQueueItemClick: false,
    },
    automixTimeline: {
      nextTriggerMs: -1,
      triggeredForTrack: false,
      currentPlayingDeck: 'A',
    },
  };
}
