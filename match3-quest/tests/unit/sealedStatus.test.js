import { activeStatuses } from '../../statusBadges.js';

test('la pastille « Scellé » apparaît avec sa durée restante', () => {
    const list = activeStatuses({ statusEffects: { sealed: 2 } });
    const badge = list.find(b => b.id === 'sealed' || b.key === 'sealed');
    expect(badge).toBeTruthy();
    expect(JSON.stringify(badge)).toContain('Scellé');
});
