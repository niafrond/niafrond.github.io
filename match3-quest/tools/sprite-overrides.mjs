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
  // Compagnons de route (companions.js) : sprites animés du suiveur en exploration (clé `companion_<id>`), voir tools/gen-companion-walk.mjs
  // pour les images de marche. Même univers que leur PNJ (portrait de dialogue), mais en quatre directions.
  ['companion_xiao_gui', 'Xiao Gui', 'Démon-renard', 'Compagnon', 'orange', 'rizieres', 'e',
    'Xiao Gui, a small mischievous fox demon of ancient China walking on four legs, orange fur with a cream chest and muzzle, three fluffy tails with white tips, a small red scarf around the neck, pointed ears, sly friendly grin'],
  ['companion_zhi', 'Zhi', 'Humain', 'Compagnon', 'orange', 'bambous', 'e',
    'Zhi, a young novice Buddhist monk boy of ancient China, shaved head, saffron orange robe with a maroon sash, wooden prayer beads around the neck, bare feet, small and gentle, kind smile'],
  ['companion_dawa', 'Dawa', 'Humain', 'Compagnon', 'brown', 'gobi', 'e',
    'Dawa, a middle-aged human man, desert guide of the Gobi, a normal human head with a weathered tanned face and short dark beard, sand-colored wrapped turban, long layered brown and ochre travel coat, leather satchel, wooden walking staff, no tail, no animal features'],
  ['companion_yu', 'Yu', 'Esprit', 'Compagnon', 'yellow', 'fleuve', 'e',
    'Yu, a small golden koi carp spirit floating in the air, shimmering gold and orange scales, long flowing translucent fins and tail, two curling whiskers, a few water droplets around it, no legs'],
  ['companion_etincelle', 'Étincelle', 'Esprit', 'Compagnon', 'yellow', 'tonnerre', 'e',
    'Étincelle, a tiny lightning spirit, small round glowing pale yellow body with two tiny arms and big shiny eyes, a zigzag lightning-bolt tail, little sparks around it, floating'],
  ['companion_braise', 'Braise', 'Bête', 'Compagnon', 'red', 'volcan', 'e',
    'Braise, a playful baby wolf pup, dark charcoal grey fur with glowing ember-orange markings on the chest and paws, tail tip glowing like embers, big paws, large ears, on four legs'],
  ['companion_jian', 'Jian', 'Bête', 'Compagnon', 'purple', 'fauves', 'e',
    'Jian, a sleek black crow with glossy feathers and a sharp beak, a small leather quiver of arrows strapped on its back, bright intelligent eyes, wings folded'],
  ['companion_tou', 'Tou', 'Bête', 'Compagnon', 'yellow', 'bambous', 'e',
    'Tou, a lean yellow weasel thief (huang xian) with golden-yellow fur and a cream belly, long slim body, mischievous face, a small cloth sack tied on its back, on four short legs'],
];
