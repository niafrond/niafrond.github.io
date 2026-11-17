// Échappement HTML centralisé : à utiliser pour toute donnée non fiable (nom du héros issu d'une sauvegarde importée…)
// avant de l'insérer dans un `innerHTML`.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ENTITIES[c]);
}
