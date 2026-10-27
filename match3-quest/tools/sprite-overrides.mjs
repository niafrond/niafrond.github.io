// Créatures du jeu absentes de bestiary-data.mjs (ou à redessiner) pour gen-sprites-gm.mjs : mêmes champs qu'une ligne du bestiaire,
// [id, nom affiché, race, titre, couleur dominante, région, archétype, prompt (anglais)]. Elles remplacent l'entrée de même id.
//
// assassin_masque : l'ancien dessin ressemblait à un ninja japonais (capuche, bandeau sur le visage, shuriken). Remplacé par un tueur
// à gages de la Chine ancienne : masque rituel de bronze nuo/taotie (yeux globuleux, crocs), cheveux en chignon retenu par une épingle,
// robe croisée à larges manches ornée de nuages (yunwen), lame droite jian — ni capuche, ni voile, ni shuriken.
import { NAMED_ENEMIES } from './sprite-prompts-named.js';

// Ennemis nommés (gabarits `copyOf`) : leur dessin dédié remplace l'emprunt de TEMPLATE_SPRITE_COPIES (sprites/index.js).
const NAMED = Object.entries(NAMED_ENEMIES).map(([id, { desc }]) => [id, id, 'Humain', '', 'purple', 'rizieres', 'e', desc]);

export const OVERRIDES = [
    ...NAMED,
  // Créatures dont l'ancien dessin était informe (refait en 64 px, voir tools/gen-sprites-gm.mjs --px=64).
  ['hundun', 'Hundun', 'Bête', 'Chaos primordial', 'orange', 'tonnerre', 'e',
    'Hundun, primordial chaos creature, a round shaggy faceless body like a stuffed bag, dark brown fur with glowing orange cracks, six short legs and four small wings, no face'],
  ['gui_esprit', 'Esprit errant', 'Spectre', '', 'purple', 'rizieres', 'e',
    'wandering ghost spirit of ancient China, tattered hooded gray-violet robe fading into a wispy tail, two glowing pale eyes in the dark hood, thin skeletal hands, ethereal floating'],
  ['assassin_masque', 'Assassin Masqué', 'Humain', 'Lame du Voile Noir', 'purple', 'rizieres', 'e',
    'ancient Chinese hired killer of the Warring States, wearing a carved bronze nuo ritual mask with bulging round eyes and fangs, ' +
    'bare head with black hair in a topknot held by a bronze hairpin, no hood, no headscarf, no cloth over the face, ' +
    'dark indigo and crimson crossed-collar hanfu robe with wide sleeves and gold cloud-pattern trim, sash belt, ' +
    'holding a straight double-edged jian sword low, no shuriken, not a ninja, crouching ready-to-strike stance'],
];
