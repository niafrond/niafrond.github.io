// Créatures du jeu absentes de bestiary-data.mjs (ou à redessiner) pour gen-sprites-gm.mjs : mêmes champs qu'une ligne du bestiaire,
// [id, nom affiché, race, titre, couleur dominante, région, archétype, prompt (anglais)]. Elles remplacent l'entrée de même id.
//
// assassin_masque : l'ancien dessin ressemblait à un ninja japonais (capuche, bandeau sur le visage, shuriken). Remplacé par un tueur
// à gages de la Chine ancienne : masque rituel de bronze nuo/taotie (yeux globuleux, crocs), cheveux en chignon retenu par une épingle,
// robe croisée à larges manches ornée de nuages (yunwen), lame droite jian — ni capuche, ni voile, ni shuriken.
export const OVERRIDES = [
  ['assassin_masque', 'Assassin Masqué', 'Humain', 'Lame du Voile Noir', 'purple', 'rizieres', 'e',
    'ancient Chinese hired killer of the Warring States, wearing a carved bronze nuo ritual mask with bulging round eyes and fangs, ' +
    'bare head with black hair in a topknot held by a bronze hairpin, no hood, no headscarf, no cloth over the face, ' +
    'dark indigo and crimson crossed-collar hanfu robe with wide sleeves and gold cloud-pattern trim, sash belt, ' +
    'holding a straight double-edged jian sword low, no shuriken, not a ninja, crouching ready-to-strike stance'],
];
