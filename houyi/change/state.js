// État sauvegardé du mode Chang'e (session.data.change) : épisodes terminés, épisode commencé, soins obtenus, habitants soignés.
// Séparé de view.js : pas de DOM, utilisable par exploration.js et les tests.
import { EPISODES } from './data.js';

// `return` : où se trouvait Hou Yi quand l'épisode a commencé (écran et case), tant que Chang'e explore son village ; sert à le replacer au retour (et à la sauvegarde).
// `tuto` : true une fois le tutoriel du puzzle de soin terminé (il ne se relance qu'avec le bouton « Aide »).
// `keep` : soins d'un épisode déjà terminé, mis de côté le temps de le rejouer (le Livre des noms les garde) ; rendus à la fin du rejeu ou au chargement.
export const defaultChangeData = () => ({ done: [], pending: null, hp: {}, healed: [], return: null, keep: null, tuto: false });

/** Normalise `session.data.change` (sauvegardes anciennes ou abîmées). */
export function normalizeChangeData(raw) {
    const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const ids = new Set(EPISODES.flatMap(e => e.injured.map(n => n.id)));
    const hp = {};
    for (const [k, v] of Object.entries(d.hp && typeof d.hp === 'object' ? d.hp : {})) if (ids.has(k) && Number.isFinite(v) && v > 0) hp[k] = Math.floor(v);
    const keepRaw = d.keep && typeof d.keep === 'object' ? d.keep : null;
    const out = {
        done: Array.isArray(d.done) ? [...new Set(d.done.filter(n => EPISODES.some(e => e.id === n)))] : [],
        pending: EPISODES.some(e => e.id === d.pending) ? d.pending : null,
        hp,
        healed: Array.isArray(d.healed) ? [...new Set(d.healed.filter(id => ids.has(id)))] : [],
        return: d.return && typeof d.return.screenId === 'string' && Number.isInteger(d.return.x) && Number.isInteger(d.return.y) ? { screenId: d.return.screenId, x: d.return.x, y: d.return.y } : null,
        keep: null,
        tuto: d.tuto === true   // le tutoriel du puzzle de soin a été vu
    };
    // soins mis de côté pendant un rejeu interrompu (partie sauvegardée en plein rejeu) : on les rend, rien n'est perdu
    if (keepRaw) {
        const kh = Array.isArray(keepRaw.healed) ? keepRaw.healed.filter(id => ids.has(id)) : [];
        out.healed = [...new Set([...out.healed, ...kh])];
        for (const [k, v] of Object.entries(keepRaw.hp && typeof keepRaw.hp === 'object' ? keepRaw.hp : {})) if (ids.has(k) && Number.isFinite(v) && v > (out.hp[k] || 0)) out.hp[k] = Math.floor(v);
    }
    return out;
}
