// État sauvegardé du mode Chang'e (session.data.change) : épisodes terminés, épisode commencé, soins obtenus, habitants soignés.
// Séparé de view.js : pas de DOM, utilisable par exploration.js et les tests.
import { EPISODES } from './data.js';

// `return` : où se trouvait Hou Yi quand l'épisode a commencé (écran et case), tant que Chang'e explore son village ; sert à le replacer au retour (et à la sauvegarde).
export const defaultChangeData = () => ({ done: [], pending: null, hp: {}, healed: [], return: null });

/** Normalise `session.data.change` (sauvegardes anciennes ou abîmées). */
export function normalizeChangeData(raw) {
    const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const ids = new Set(EPISODES.flatMap(e => e.injured.map(n => n.id)));
    const hp = {};
    for (const [k, v] of Object.entries(d.hp && typeof d.hp === 'object' ? d.hp : {})) if (ids.has(k) && Number.isFinite(v) && v > 0) hp[k] = Math.floor(v);
    return {
        done: Array.isArray(d.done) ? [...new Set(d.done.filter(n => EPISODES.some(e => e.id === n)))] : [],
        pending: EPISODES.some(e => e.id === d.pending) ? d.pending : null,
        hp,
        healed: Array.isArray(d.healed) ? [...new Set(d.healed.filter(id => ids.has(id)))] : [],
        return: d.return && typeof d.return.screenId === 'string' && Number.isInteger(d.return.x) && Number.isInteger(d.return.y) ? { screenId: d.return.screenId, x: d.return.x, y: d.return.y } : null
    };
}
