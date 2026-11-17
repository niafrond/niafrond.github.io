import { createSession, trackProposal, trackedQuest, setTrackedQuest, questKind } from '../../exploration.js';

const q = (id, side) => ({ id, side, title: id, objectives: [{ id: 'o', type: 'visit', target: 'x', text: 't' }], offer: [], complete: [] });

describe('suivi de quête après activation', () => {
    const quests = [q('main1', false), q('side1', true)];
    const fresh = () => {
        const s = createSession({}, undefined, quests);
        s.data.quests.main1 = 'active';
        s.data.quests.side1 = 'active';
        return s;
    };

    test('aucune quête suivie : la nouvelle est suivie automatiquement', () => {
        const s = fresh();
        expect(trackProposal(s, quests[0]).mode).toBe('auto');
        expect(trackedQuest(s).id).toBe('main1');
    });

    test('une autre quête suivie : le joueur doit choisir, rien ne change sans choix', () => {
        const s = fresh();
        setTrackedQuest(s, 'main1');
        const p = trackProposal(s, quests[1]);
        expect(p.mode).toBe('ask');
        expect(p.current.id).toBe('main1');
        expect(trackedQuest(s).id).toBe('main1');
        setTrackedQuest(s, 'side1');
        expect(trackedQuest(s).id).toBe('side1');
    });

    test('même quête déjà suivie : pas de question ; type principale / annexe', () => {
        const s = fresh();
        setTrackedQuest(s, 'side1');
        expect(trackProposal(s, quests[1])).toBeNull();
        expect(questKind(quests[0])).toBe('main');
        expect(questKind(quests[1])).toBe('side');
    });
});
