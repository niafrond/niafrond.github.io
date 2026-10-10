// Manifest de prompts pour la génération de sprites GBA via pixel.lab.
// Stratégie : PixFlux génère le sprite de face, /rotate dérive les autres directions.
// Les descriptions décrivent le personnage en détail — sans mention de direction ni de pose.

export const SPRITE_MANIFEST = {
  heroes: {
    assassin: {
      desc: 'young Chinese woman assassin, fitted dark purple silk changpao robe with silver trim, two silver throwing daggers tucked in sash, black hair in tight bun secured with a jade pin, red and black fabric bracers on forearms, determined expression',
    },
    sorcerer: {
      desc: 'elderly Chinese male sorcerer, long flowing deep indigo daoist robe with gold cloud embroidery, tall ceremonial hat, long white beard and mustache, holding a gnarled wooden staff topped with a glowing blue pearl, wise stern expression',
    },
    archer: {
      desc: 'Hou Yi the divine archer hero, red lamellar xia armor with gold shoulder guards, black hair in a warrior top-knot, wooden recurve bow across back with a quiver of red-fletched arrows, jade pendant at chest, heroic confident expression',
    },
    warrior: {
      desc: 'Chinese female warrior, red and gold plate armor with jade pauldrons, black hair in an elaborate warrior bun with gold pin, one-handed bronze dao sword at hip and round lacquered shield on arm, fierce determined expression',
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
    goblin_saboteur: {
      desc: 'small mischievous goblin, sickly green warty skin, big pointed ears, wearing torn patchwork vest and shorts, holding a sizzling round black bomb, gap-toothed wicked grin, beady red eyes',
    },
    forest_guardian: {
      desc: 'forest nature spirit warrior, tall muscular figure, body wrapped in overlapping bark plate armor covered in living green leaves, vine-woven shield on arm, glowing amber eyes, mossy shoulders, ancient powerful appearance',
    },
    bone_reaver: {
      desc: 'animated skeleton warrior, yellowed bare bone body, wearing cracked dark iron shoulder plates and a rusty horned helmet, wielding a jagged curved bone sword, hollow black eye sockets with faint purple glow',
    },
    storm_knight: {
      desc: 'dark armored knight, full black iron plate armor with lightning bolt engravings, purple crackling electricity around gauntlets, menacing horned visor helmet, imposing bulky silhouette',
    },
    shadow_assassin: {
      desc: 'shadow ninja, slender figure wrapped in dark charcoal silk, wisps of black smoke curling around the body, holding a gleaming shuriken, blank white mask face, crouching coiled ready-to-strike posture',
    },
    arcane_scholar: {
      desc: 'undead mage scholar, rotting tattered dark purple ceremonial robe, three glowing arcane tomes floating around the figure, cracked round spectacles, bony withered hands, hollow sunken eye sockets with green glow',
    },
    iron_gladiator: {
      desc: 'heavy armored arena gladiator, thick riveted iron chest plate, spiked iron gauntlets, full iron helmet with visor, swinging a spiked iron chain flail, scarred muscular arms visible, arena champion stance',
    },
    sand_colossus: {
      desc: 'massive desert sand golem, huge body made of swirling compacted sand and broken stone, two glowing amber eyes in featureless sand face, heavy stone fist arms, sand dust constantly flowing off the body',
    },
    frost_dragon: {
      desc: 'young frost dragon, small and stocky, icy pale blue and white scales, small folded bat-like wings at back, frost breath mist around mouth, sharp curved claws, cold glinting blue eyes, horned head',
    },
    ember_dragon: {
      desc: 'young fire dragon, small and stocky, deep red and burnt orange scales, small folded wings, ember sparks flying off body, curved black horns, sharp claws, fierce bright orange glowing eyes',
    },
    orc_warmaster: {
      desc: 'orc warlord, massive muscular build, grey-green thick skin, wearing black spiked iron pauldrons and chest plate, giant two-handed battle axe resting on shoulder, tribal red war paint markings on face, fierce tusked scowl',
    },
    crystal_sage: {
      desc: 'crystal mage sorcerer, translucent cobalt blue robe seeming to be made of light, crystal-tipped wooden staff, three orbiting gem shards of different colors floating around the figure, calm serene powerful expression, faint blue inner glow',
    },
    moon_priestess: {
      desc: 'sinister moon cult priestess, silver silk robes covered in crescent moon and star motifs, silver crescent headdress, pale white face with dark eye markings, holding a silver ritual blade, soft blue moonlight aura',
    },
    sun_paladin: {
      desc: 'sun temple paladin, gleaming polished golden full plate armor, large radiant sun halo disc behind the head, sacred longsword raised in salute, visor open showing righteous determined face, warm golden light radiating outward',
    },
    plague_doctor: {
      desc: 'sinister plague doctor, long hooked bird-beak porcelain mask, floor-length dark waxed oilskin coat, wide-brimmed black hat, belt covered with colorful glass vials and pouches, black leather gloves, unsettling hunched posture',
    },
  },
};

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
