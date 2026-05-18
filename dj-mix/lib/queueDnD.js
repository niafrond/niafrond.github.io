export function clearQueueDragMarkers(queueList) {
  if (!queueList) return;
  queueList.querySelectorAll('.queue-item').forEach((el) => {
    el.classList.remove('is-dragging', 'is-drag-over-before', 'is-drag-over-after');
  });
}

export function attachQueueDndHandlers(options) {
  const {
    queueList,
    state,
    onReorder,
    onActivate,
    getCurrentIndex,
    isCrossfading,
  } = options || {};

  if (!queueList || !state) return;

  queueList.querySelectorAll('.queue-item').forEach((el) => {
    el.addEventListener('dragstart', (event) => {
      state.draggedQueueIndex = Number(el.dataset.index);
      el.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(state.draggedQueueIndex));
      }
    });

    el.addEventListener('dragend', () => {
      state.draggedQueueIndex = -1;
      clearQueueDragMarkers(queueList);
      queueList.querySelectorAll('.queue-item').forEach((node) => node.classList.remove('is-dragging'));
      requestAnimationFrame(() => {
        state.suppressQueueItemClick = false;
      });
    });

    el.addEventListener('dragover', (event) => {
      if (state.draggedQueueIndex < 0) return;
      event.preventDefault();
      const targetIndex = Number(el.dataset.index);
      if (targetIndex === state.draggedQueueIndex) return;

      const rect = el.getBoundingClientRect();
      const insertAfter = event.clientY >= rect.top + (rect.height / 2);
      clearQueueDragMarkers(queueList);
      el.classList.add(insertAfter ? 'is-drag-over-after' : 'is-drag-over-before');
    });

    el.addEventListener('dragleave', (event) => {
      if (!el.contains(event.relatedTarget)) {
        el.classList.remove('is-drag-over-before', 'is-drag-over-after');
      }
    });

    el.addEventListener('drop', (event) => {
      if (state.draggedQueueIndex < 0) return;
      event.preventDefault();
      const targetIndex = Number(el.dataset.index);
      const rect = el.getBoundingClientRect();
      const insertAfter = event.clientY >= rect.top + (rect.height / 2);
      onReorder?.(state.draggedQueueIndex, targetIndex, insertAfter);
      state.suppressQueueItemClick = true;
    });

    el.addEventListener('click', async (event) => {
      if (event.target.classList.contains('queue-remove') || event.target.classList.contains('queue-cue')) return;
      if (state.suppressQueueItemClick) {
        state.suppressQueueItemClick = false;
        return;
      }
      const idx = Number(el.dataset.index);
      if (idx === getCurrentIndex?.() || isCrossfading?.()) return;
      await onActivate?.(idx);
    });
  });
}
