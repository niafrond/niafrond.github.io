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
  // Événement « La Nuit des âmes errantes » (events/wanderingSouls/) : dessins propres à ses trois ennemis, clés = ids d'ennemis du royaume.
  ['ws_gardien_jugement', 'Gardien du jugement', 'Spectre', 'Juge des registres des âmes', 'purple', 'bambous', 'e',
    'super deformed chibi stern judge of the dead from the Chinese underworld, oversized round head about half of the total height, tiny stubby body, short little arms and legs, ' +
    'black and crimson official robes with wide sleeves, winged black official hat futou, long black beard, big serious eyes, ' +
    'holding an open ledger scroll in one hand and a large brush in the other, small pale jade green ghostly flames at his feet, ' +
    'cute but stern ancient Chinese bureaucrat of the afterlife, not a western devil, no horns, no pitchfork'],
  ['ws_jiangshi_patrouille', 'Jiangshi du sanctuaire', 'Mort-vivant', 'Revenant sauteur', 'green', 'bambous', 'e',
    'super deformed chibi Chinese hopping vampire jiangshi, oversized round head about half of the total height, tiny stubby body, short little legs, ' +
    'both short arms held straight out horizontally in front of the body, pale gray-green skin, big dull round eyes, ' +
    'dark teal blue Qing dynasty official robe (not red), black official hat, a long yellow paper talisman strip with red symbols hanging down over the face from the hat, ' +
    'cute but spooky, not a western vampire, no cape, no fangs'],
  ['ws_huli_jing', 'Renarde des faux chemins', 'Esprit', 'Huli jing', 'green', 'bambous', 'e',
    'super deformed chibi huli jing, Chinese fox spirit, oversized round white fox head about half of the total height, tiny stubby body on two short legs, ' +
    'big sly eyes and a mischievous smile, two small bushy tails glowing pale jade green, ' +
    'pale green and white robe with wide sleeves, small floating paper lantern, cute and mischievous, not a Japanese kitsune, no mask'],
  ['assassin_masque', 'Assassin Masqué', 'Humain', 'Lame du Voile Noir', 'purple', 'rizieres', 'e',
    'ancient Chinese hired killer of the Warring States, wearing a carved bronze nuo ritual mask with bulging round eyes and fangs, ' +
    'bare head with black hair in a topknot held by a bronze hairpin, no hood, no headscarf, no cloth over the face, ' +
    'dark indigo and crimson crossed-collar hanfu robe with wide sleeves and gold cloud-pattern trim, sash belt, ' +
    'holding a straight double-edged jian sword low, no shuriken, not a ninja, crouching ready-to-strike stance'],
  // Compagnons de route (companions.js) : sprites animés du suiveur en exploration (clé `companion_<id>`), voir tools/gen-companion-walk.mjs
  // pour les images de marche. Même univers que leur PNJ (portrait de dialogue), mais en quatre directions.
  ['companion_xiao_gui', 'Xiao Gui', 'Démon-renard', 'Compagnon', 'orange', 'rizieres', 'e',
    'Xiao Gui, a chibi super-deformed cute fox, huge round head and tiny body, a real four-legged animal, long horizontal body walking on all four paws, head low, never upright, orange fur, side profile shows a long fox body with four legs and head turned sideways, cream chest and muzzle, three fluffy tails with white tips, a small red scarf around the neck, pointed ears, sly friendly grin'],
  ['companion_zhi', 'Zhi', 'Humain', 'Compagnon', 'orange', 'bambous', 'e',
    'Zhi, a chibi super-deformed young novice Buddhist monk boy of ancient China, two heads tall, huge round head, tiny body, shaved head, saffron orange robe with a maroon sash, wooden prayer beads around the neck, bare feet, small and gentle, kind smile'],
  ['companion_dawa', 'Dawa', 'Humain', 'Compagnon', 'brown', 'gobi', 'e',
    'Dawa, a chibi super-deformed middle-aged human man, two heads tall, huge round head, tiny body, desert guide of the Gobi, a normal human head with a weathered tanned face and short dark beard, sand-colored wrapped turban, long layered brown and ochre travel coat, leather satchel, wooden walking staff, no tail, no animal features'],
  ['companion_yu', 'Yu', 'Esprit', 'Compagnon', 'yellow', 'fleuve', 'e',
    'Yu, a chibi super-deformed cute golden koi carp spirit with a big round head and big eyes, floating in the air, shimmering gold and orange scales, long flowing translucent fins and tail, two curling whiskers, a few water droplets around it, no legs'],
  ['companion_etincelle', 'Leigong', 'Esprit', 'Compagnon', 'yellow', 'tonnerre', 'e',
    'Étincelle, a chibi super-deformed tiny Leigong thunder god spirit, two heads tall, huge round oversized head taking half of the body, tiny short stubby body, eagle-headed, big round white-feathered eagle head with a yellow hooked beak and glowing cyan eyes, two small red feather tufts on a golden headband, small stubby white and dark wings, purple scarf, short white robe with a golden braided rope belt and two small round drums with gold thunder symbols, holding a small glowing thunder mallet crackling with lightning, tiny clawed bird feet, floating in the air above the ground, little sparks around it, no shadow'],
  ['companion_braise', 'Braise', 'Bête', 'Compagnon', 'red', 'volcan', 'e',
    'Braise, a chibi super-deformed playful baby wolf pup, huge round head, tiny body, a real four-legged animal standing on all four paws on the ground, never upright, dark charcoal grey fur with glowing ember-orange markings on the chest and paws, tail tip glowing like embers, big paws, large ears, on four legs'],
  ['companion_jian', 'Jian', 'Bête', 'Compagnon', 'purple', 'fauves', 'e',
    'Jian, a chibi super-deformed cute black crow with a big round head, perched on two bird legs, glossy feathers and a sharp beak, a small leather quiver of arrows strapped on its back, bright intelligent eyes, wings folded'],
  ['companion_tou', 'Tou', 'Bête', 'Compagnon', 'yellow', 'bambous', 'e',
    'Tou, a chibi super-deformed yellow weasel thief (huang xian), huge round head, a real four-legged animal with a long low horizontal sausage body on all four paws, never upright, golden-yellow fur and a cream belly, mischievous face, a small cloth sack tied on its back, on four short legs'],
  ['wlm_ancien', 'Grand-père Lao Dong', 'Humain', 'Ancien du village', 'blue', 'tonnerre', 'e',
    'a chibi super-deformed cute elderly Chinese village elder, two heads tall, huge round head, tiny stubby body, big expressive eyes, thick quilted padded dark blue winter robe with red trim, long white beard, round fur hat, holding a wooden walking stick, kind smile, warm Chinese winter mountain village style, thick padded winter clothes, no text, no snowman, no santa'],
  ['wlm_cuisinier', 'Maître Boulette', 'Humain', 'Cuisinier des tangyuan', 'red', 'tonnerre', 'e',
    'a chibi super-deformed cute Chinese village cook, clean-shaven round smiling face, no beard, black hair, two heads tall, huge round head, tiny stubby body, big expressive eyes, tall white cook cap, white apron over a dark brown padded winter jacket with orange trim, holding a big wooden ladle, a steaming pot beside him, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_artisan', 'Dame Hong Deng', 'Humain', 'Artisane des lanternes', 'red', 'tonnerre', 'e',
    'a chibi super-deformed cute Chinese craftswoman, bare head with no hat, black hair in a bun with a red pin, rosy face, two heads tall, huge round head, tiny stubby body, big expressive eyes, red padded winter jacket and brown apron, holding a half-finished bamboo lantern frame, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_gardien_sanctuaire', 'Tianlan', 'Humain', 'Gardien du sanctuaire', 'blue', 'tonnerre', 'e',
    'a chibi super-deformed cute young shrine guardian, youthful face, no beard, black hair in a topknot, bare head, no hat, two heads tall, huge round head, tiny stubby body, big expressive eyes, long dark blue padded robe with gold embroidery, jade pendant, holding a tall staff topped with a small red lantern, serene, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_enfants', 'Enfants du village', 'Humain', 'Bataille de boules de neige', 'green', 'tonnerre', 'e',
    'a chibi super-deformed cute pair of Chinese village children, a boy and a girl side by side, two heads tall, huge round head, tiny stubby body, big expressive eyes, thick red and green padded clothes, round fur hats, one holding a snowball, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_esprit_village', 'Esprit protecteur du village', 'Esprit', 'Petite flamme sur un seuil', 'orange', 'tonnerre', 'e',
    'a chibi super-deformed cute lantern spirit, only a round red paper lantern with a tiny glowing smiling face on it, no body, no hat, no beard, no limbs, two heads tall, huge round head, tiny stubby body, big expressive eyes, golden tassel hanging below, warm orange inner glow, tiny sparkles, floating, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_famille', 'Famille Lin', 'Humain', 'Habitants', 'green', 'tonnerre', 'e',
    'a chibi super-deformed cute Chinese family of three standing close together, two heads tall, huge round head, tiny stubby body, big expressive eyes, father mother and small child in padded winter clothes red blue and green, holding bowls of rice dumplings, warm Chinese winter mountain village style, thick padded winter clothes, no text, no snowman, no santa'],
  ['wlm_pelerin', 'Pèlerin porteur de lanterne', 'Humain', 'Voyageur du solstice', 'yellow', 'tonnerre', 'e',
    'a chibi super-deformed cute traveling pilgrim, round face, no beard, no pointed hat, two heads tall, huge round head, tiny stubby body, big expressive eyes, wide straw hat, straw rain cloak over a gray padded coat, carrying a glowing red lantern on a pole and a small pack, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_renard_neiges', 'Renard des neiges', 'Bête', 'Guide des passages cachés', 'blue', 'tonnerre', 'e',
    'a chibi super-deformed cute white snow fox, a real four-legged animal standing on all four paws, seen alone, never upright, two heads tall, huge round head, tiny stubby body, big expressive eyes, pale blue and jade green markings, glowing blue eyes, big fluffy tail with a jade tip, no snow, no trees, no landscape, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_esprit_givre', 'Esprit du givre', 'Esprit', 'Souffle de l’hiver', 'blue', 'tonnerre', 'e',
    'a chibi super-deformed cute frost spirit, two heads tall, huge round head, tiny stubby body, big expressive eyes, translucent ice and mist body with flowing white sleeves, pale blue glow, floating snow particles, calm and mysterious, not scary, warm Chinese winter mountain village style, thick padded winter clothes, no text, no snowman, no santa'],
  ['wlm_oiseau_givre', 'Oiseau de givre', 'Bête', 'Oiseau des neiges', 'blue', 'tonnerre', 'e',
    'a chibi super-deformed cute white and blue bird with a small crest, no antlers, no horns, two heads tall, huge round head, tiny stubby body, big expressive eyes, crystal wings, long tail feathers like ice shards, flying, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_gardien_glace', 'Gardien de glace', 'Esprit', 'Sentinelle du sanctuaire', 'blue', 'tonnerre', 'e',
    'a chibi super-deformed cute stone and ice guardian, two heads tall, huge round head, tiny stubby body, big expressive eyes, armor of gray stone and glacier ice, jade ornaments, red cord details, holding a stone halberd, frost on the shoulders, solemn, one single character alone on a plain flat background, warm Chinese winter mountain village style, no text, no santa claus, no antlers, no reindeer, no scenery, no hood, no horns, no snow, no trees, no background objects'],
  ['wlm_gardien_flamme', 'Gardien de la flamme hivernale', 'Esprit', 'Équilibre du feu et de la glace', 'orange', 'tonnerre', 'e',
    'a chibi super-deformed cute ancient stone guardian statue come to life, two heads tall, huge round head, tiny stubby body, big expressive eyes, red and gold ornaments, a warm flame burning in its chest, ice crystals growing on its shoulders, majestic and a little sad, not scary, warm Chinese winter mountain village style, thick padded winter clothes, no text, no snowman, no santa'],
];
