// Manifest de prompts pour la génération de sprites GBA via pixel.lab.
// Stratégie : PixFlux génère le sprite de face, /rotate dérive les autres directions.
// Les descriptions décrivent le personnage en détail — sans mention de direction ni de pose.

export const SPRITE_MANIFEST = {
  heroes: {
    assassin: {
      desc: 'Hou Yi as a young 25-year-old Chinese shadow assassin, lithe athletic build, dark navy silk changpao with silver cloud trim, twin jade-handled short blades at belt, black hair in a tight warrior knot, sharp focused eyes, jade archer pendant at chest',
    },
    sorcerer: {
      desc: 'Hou Yi as a young 25-year-old Chinese celestial mage, lean athletic build, flowing crimson hanfu robe with gold sun and arrow embroidery, black hair in a high guan knot with a gold pin, holding a short lacquered wooden staff with a glowing solar jade orb, intense determined expression',
    },
    archer: {
      desc: 'Hou Yi the divine archer, young 25-year-old Chinese hero, lean muscular build, red and gold lamellar xia armor, black hair in a warrior top-knot, large wooden recurve bow in hand with a quiver of red-fletched arrows at back, jade sun pendant at chest, heroic confident expression',
    },
    warrior: {
      desc: 'Hou Yi as a young 25-year-old Chinese warrior, strong athletic build, red lamellar chest armor with gold sun motif and jade pauldrons, black hair in a warrior bun with a gold pin, bronze dao sword at hip and round lacquered shield on arm, fierce determined expression',
    },
  },

  npcs: {
    farmer_lin: {
      desc: 'elderly Chinese male farmer, wide round straw hat, simple undyed hemp crossover robe tied with rope belt, carrying a bundle of golden wheat sheaves, sun-weathered kind face, bare feet with straw sandals',
    },
    merchant_ma: {
      desc: 'middle-aged Chinese male merchant, rounded brocade hat, layered colorful silk trade robe with wide sleeves, plump cheerful round face, holding a cloth coin purse, jade ring on finger, traveling pack on back',
    },
    elder_wen: {
      desc: 'very old Chinese village elder, extremely long white flowing beard, formal grey Taoist changpao robe with black trim, tall ceremonial square hat, leaning on carved wooden walking stick, deeply wrinkled wise face',
    },
    monk_zhen: {
      desc: 'Chinese Buddhist monk, saffron orange kasaya robe draped over one shoulder, completely shaved head, large wooden prayer bead necklace, eyes closed in serene calm expression, simple sandals',
    },
    herbalist_xu: {
      desc: 'Chinese woman herbalist, light jade-green crossover linen robe, conical pointed bamboo rain hat, wicker basket of colorful medicinal herbs hanging from arm, small pouches on belt, gentle thoughtful expression',
    },
    smith_tie: {
      desc: 'stocky Chinese male blacksmith, thick leather work apron over bare chest, muscular arms with rolled cloth bracers, holding a heavy iron hammer, soot and sweat on rugged face, short unruly black hair',
    },
    weaver_mei: {
      desc: 'young Chinese woman weaver, pale pink silk hanfu robe with flower embroidery, long straight black hair with small flower hairpin, holding a spool of red silk thread, delicate graceful appearance, soft shy expression',
    },
    shepherd_zi: {
      desc: 'young Chinese shepherd boy, simple rough-spun light brown robe, bare legs, holding a long wooden crook staff taller than himself, round innocent face, messy short black hair, small woven hat hanging at back',
    },
    guide_dawa: {
      desc: 'Tibetan mountain guide, heavy brown yak-fur coat with colorful trim, windswept black hair tied loosely, weathered rugged face with sun-burnt cheeks, carrying a carved wooden walking staff, fur-lined boots',
    },
    ferryman_gu: {
      desc: 'old Chinese river ferryman, wide conical straw hat, faded navy blue rough linen robe, deeply tanned wrinkled face, holding a long wooden pole oar, rope sandals, lean wiry build from years of river work',
    },
    hunter_wu: {
      desc: 'Chinese male hunter, dark forest-green loose changshan jacket and trousers, feathered conical hat, short recurve bow slung over shoulder, quiver at hip, sharp alert eyes, light leather boots, lean athletic build',
    },
    fisher_hai: {
      desc: 'cheerful Chinese fisherman, faded pale blue rough linen robe hiked up at knee, simple woven hat, bamboo fishing rod over shoulder with line dangling, wide toothy grin, bare feet, tanned happy face',
    },
    miner_shan: {
      desc: 'Chinese male miner, dusty grey hemp work clothes, cloth headband with small oil lantern attached, iron pickaxe over shoulder, stocky strong build, dust-smudged serious face, leather boots',
    },
    priestess_yan: {
      desc: 'young Chinese temple priestess, flowing formal white hanfu robe with red silk sash and cloud motif trim, red silk ribbons in elaborate black hair updo, holding a lit incense stick with both hands, serene graceful expression',
    },
    crane_envoy: {
      desc: 'divine spirit messenger wearing white feather ceremonial robes with silver crane motif embroidery, elaborate crane-feather headdress, otherworldly pale beautiful face, faint ethereal golden glow around the figure',
    },
    change: {
      desc: 'Chang e moon goddess, exquisite flowing white and silver hanfu with moon and cloud embroidery, crescent moon gold hairpin in elaborate black updo, carrying a jade rabbit figurine, ethereal otherworldly beautiful face, soft silver moonlight glow',
    },
  },

  enemies: {
    huli_jing: {
      desc: 'Huli Jing, small mischievous fox spirit, orange fox in a tattered patchwork vest, pointed ears, sly grin, holding a sizzling round black firecracker, glowing yellow eyes',
    },
    shu_jing: {
      desc: 'Shu Jing, ancient tree spirit, gnarled old pine and willow body with bark plates and green needle leaves, face in the trunk, root legs, glowing amber eyes, moss on shoulders',
    },
    gui_guerrier: {
      desc: 'Gui warrior, skeleton soldier in cracked bronze lamellar armor and a rusty helmet, yellowed bare bones, rusty curved dao saber, hollow black eye sockets with faint purple glow',
    },
    lei_gong: {
      desc: 'Lei Gong, Chinese thunder god, blue-skinned bird-beaked general in blue armor, small wings, holding a mallet and chisel, crackling lightning around the hands, imposing silhouette',
    },
    assassin_masque: {
      desc: 'shadow ninja, slender figure wrapped in dark charcoal silk, wisps of black smoke curling around the body, holding a gleaming shuriken, blank white mask face, crouching coiled ready-to-strike posture',
    },
    lettre_sorcier: {
      desc: 'undead mage scholar, rotting tattered dark purple ceremonial robe, three glowing arcane tomes floating around the figure, cracked round spectacles, bony withered hands, hollow sunken eye sockets with green glow',
    },
    soldat_terre_cuite: {
      desc: 'heavy armored arena gladiator, thick riveted iron chest plate, spiked iron gauntlets, full iron helmet with visor, swinging a spiked iron chain flail, scarred muscular arms visible, arena champion stance',
    },
    hundun: {
      desc: 'Hundun, formless primordial Chinese spirit, huge round faceless body of swirling sand and clay without eyes or mouth, six stubby legs, glowing amber cracks, dust flowing off the body',
    },
    canglong: {
      desc: 'Canglong, Chinese azure dragon, long wingless serpentine body of icy pale blue scales, four clawed legs, antlered horned head with long white whiskers and beard, frost mist around the mouth, cold glinting blue eyes',
    },
    chilong: {
      desc: 'Chilong, Chinese red dragon, long wingless serpentine body of deep red and burnt orange scales, four clawed legs, antlered horned head with long whiskers, ember sparks and flames in a mane, fierce orange eyes',
    },
    chiyou: {
      desc: 'Chiyou, Chinese war god chieftain, massive muscular build, red-brown skin, bronze helmet with ox horns, bronze lamellar armor, giant crescent-moon battle axe on shoulder, fierce scowl',
    },
    immortel_jade: {
      desc: 'crystal mage sorcerer, translucent cobalt blue robe seeming to be made of light, crystal-tipped wooden staff, three orbiting gem shards of different colors floating around the figure, calm serene powerful expression, faint blue inner glow',
    },
    pretresse_lunaire: {
      desc: 'sinister moon cult priestess, silver silk robes covered in crescent moon and star motifs, silver crescent headdress, pale white face with dark eye markings, holding a silver ritual blade, soft blue moonlight aura',
    },
    garde_solaire: {
      desc: 'sun temple paladin, gleaming polished golden full plate armor, large radiant sun halo disc behind the head, sacred longsword raised in salute, visor open showing righteous determined face, warm golden light radiating outward',
    },
    wen_shen: {
      desc: 'Wen Shen, Chinese plague spirit, gaunt sickly green-faced official in a dark robe and a black winged official hat, holding a poison gourd and a bamboo fan, sickly green mist, ghostly stare',
    },
  },
};

import { EXTRA_MANIFEST } from './sprite-prompts-extra.js';
for (const [cat, entries] of Object.entries(EXTRA_MANIFEST)) Object.assign(SPRITE_MANIFEST[cat], entries);
import { BESTIARY_MANIFEST } from './sprite-prompts-bestiary.js';
Object.assign(SPRITE_MANIFEST.enemies, BESTIARY_MANIFEST);

// Style commun à tous les sprites — ne pas mettre de direction ici
export const STYLE_SUFFIX =
  'GBA pixel art RPG sprite, ancient Chinese mythological world, ' +
  'chibi full-body character, clean bold dark outline, flat cel shading, ' +
  'limited color palette, transparent background, pixel perfect, no anti-aliasing, no gradients, ' +
  'neutral idle standing pose, whole body visible head to feet';

export const NEGATIVE_PROMPT =
  'blurry, realistic, 3d render, photorealistic, western medieval, modern clothes, ' +
  'anti-aliasing, smooth shading, gradients, extra limbs, deformed, ' +
  'text, watermark, signature, cropped, partial body, face only, portrait';
