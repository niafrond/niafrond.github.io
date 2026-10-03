// Fusion des textes d'une région : base (world/text/<R>.js) + extra (world/text/extra/<R>.js).
// - screens / npcs / chests : fusion d'objets (les clés de base gagnent en cas de doublon) ;
// - quests : concaténation (base d'abord) ;
// - npcPatches : { id: { talk: [...] } } — les répliques s'ajoutent à celles du PNJ de base si celui-ci est défini
//   dans les textes ; sinon (PNJ de story.js) le patch est conservé dans `npcPatches` pour le moteur.
export function mergeTexts(base = {}, extra = {}) {
  const out = {
    ...base,
    screens: { ...(extra.screens || {}), ...(base.screens || {}) },
    npcs: { ...(extra.npcs || {}), ...(base.npcs || {}) },
    chests: { ...(extra.chests || {}), ...(base.chests || {}) },
    quests: [...(base.quests || []), ...(extra.quests || [])]
  };
  const patches = { ...(base.npcPatches || {}) };
  for (const [id, patch] of Object.entries(extra.npcPatches || {})) {
    if (out.npcs[id]) {
      const cur = out.npcs[id];
      out.npcs[id] = { ...cur, talk: [...(cur.talk || []), ...(patch.talk || [])],
        ...(patch.idle ? { idle: [...(cur.idle || []), ...patch.idle] } : {}) };
    } else {
      patches[id] = patch;
    }
  }
  if (Object.keys(patches).length) out.npcPatches = patches;
  return out;
}
