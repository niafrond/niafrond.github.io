import { attachQueueDndHandlers } from '../../lib/queueDnD.js';

function makeDataTransfer() {
  const data = new Map();
  return {
    effectAllowed: '',
    setData: (type, value) => data.set(type, value),
    getData: (type) => data.get(type),
  };
}

describe('queueDnD', () => {
  test('dragstart blur un champ de saisie actif pour éviter le clavier mobile', () => {
    document.body.innerHTML = `
      <input id="search-input" type="text" />
      <div id="queue-list">
        <div class="queue-item" data-index="0"></div>
        <div class="queue-item" data-index="1"></div>
      </div>
    `;

    const queueList = document.getElementById('queue-list');
    const input = document.getElementById('search-input');
    const state = { draggedQueueIndex: -1, suppressQueueItemClick: false };

    attachQueueDndHandlers({ queueList, state });
    input.focus();
    expect(document.activeElement).toBe(input);

    const dragStart = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragStart, 'dataTransfer', {
      value: makeDataTransfer(),
      configurable: true,
    });
    queueList.querySelector('.queue-item[data-index="0"]').dispatchEvent(dragStart);

    expect(state.draggedQueueIndex).toBe(0);
    expect(document.activeElement).not.toBe(input);
  });
});
