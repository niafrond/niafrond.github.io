// Manifest de prompts pour la génération de sprites GBA via pixel.lab.
// Chaque entrée correspond à une clé de sprite dans le jeu.
// desc : description du personnage (sans style/direction, ajoutés par le script)

export const SPRITE_MANIFEST = {
  heroes: {
    assassin: { desc: 'Chinese female assassin hero, dark purple silk robe, silver throwing daggers, black hair bun with pin, Pokémon trainer sprite pose, facing front' },
    sorcerer: { desc: 'Chinese male sorcerer hero, deep blue flowing robes, glowing magic staff, long grey beard, Pokémon trainer sprite pose, facing front' },
    archer:   { desc: 'Hou Yi Chinese archer hero, red and gold lamellar armor, wooden recurve bow held ready, black top-knot hair, quiver of arrows on back, Pokémon trainer sprite pose, facing front' },
    warrior:  { desc: 'Chinese female warrior hero, red jade plate armor, bronze sword and round shield, black hair bun, Pokémon trainer sprite pose, facing front' },
  },

  npcs: {
    farmer_lin:    { desc: 'Chinese village farmer, wide straw hat, simple brown hemp robe, holding wheat sheaf, friendly smile, facing front' },
    merchant_ma:   { desc: 'Chinese traveling merchant, round silk hat, colorful layered trade robe, holding coin purse, plump cheerful face, facing front' },
    elder_wen:     { desc: 'old Chinese village elder, very long white beard, grey Taoist robe, wooden walking stick, wise gentle expression, facing front' },
    monk_zhen:     { desc: 'Buddhist monk, saffron orange robe, shaved head, wooden string of prayer beads around neck, serene expression, facing front' },
    herbalist_xu:  { desc: 'Chinese herbalist woman, light green robe, wicker basket of herbs on arm, pointed bamboo hat, facing front' },
    smith_tie:     { desc: 'Chinese blacksmith, brown leather work apron, muscular arms, holding iron hammer, soot on face, facing front' },
    weaver_mei:    { desc: 'Chinese weaver girl, pink silk robe, long straight black hair with ornament, holding silk thread spool, facing front' },
    shepherd_zi:   { desc: 'young Chinese shepherd boy, simple rough-spun robe, long wooden crook staff, round innocent face, facing front' },
    guide_dawa:    { desc: 'Tibetan mountain guide, brown yak-fur coat, pointing staff, windswept black hair, rugged face, facing front' },
    ferryman_gu:   { desc: 'Chinese river ferryman, conical straw hat, navy blue robe, holding wooden oar, weathered face, facing front' },
    hunter_wu:     { desc: 'Chinese hunter, dark green clothes, bow slung over shoulder, feathered hat, alert eyes, facing front' },
    fisher_hai:    { desc: 'Chinese fisherman, faded blue robe, bamboo fishing rod over shoulder, big cheerful grin, facing front' },
    miner_shan:    { desc: 'Chinese miner, dusty grey work clothes, iron pickaxe over shoulder, headband lantern, stocky build, facing front' },
    priestess_yan: { desc: 'Chinese temple priestess, flowing white hanfu robe, red silk ornaments, holding lit incense stick, graceful pose, facing front' },
    crane_envoy:   { desc: 'divine crane messenger spirit, white and silver feather robe, elaborate crane feather headdress, ethereal glow, facing front' },
    change:        { desc: 'Chang e moon goddess, flowing white and silver hanfu, glowing crescent moon hair ornament, otherworldly beauty, moonlight aura, facing front' },
  },

  enemies: {
    goblin_saboteur: { desc: 'mischievous goblin, torn patchwork clothes, holding explosive bomb, green warty skin, big ears, sneaky grin, facing front' },
    forest_guardian: { desc: 'forest spirit warrior, green bark plate armor covered in leaves, vine shield, glowing amber eyes, mossy shoulders, facing front' },
    bone_reaver:     { desc: 'skeleton warrior, yellowed bone plate armor, jagged curved sword, hollow glowing eyes, facing front' },
    storm_knight:    { desc: 'dark armored knight, black iron plate armor, crackling lightning on gauntlets, horned visor, imposing stance, facing front' },
    shadow_assassin: { desc: 'shadow ninja, dark silk wrappings, wisps of dark smoke around body, shuriken in hand, menacing crouch, facing front' },
    arcane_scholar:  { desc: 'undead mage scholar, tattered purple robe, floating open arcane books, cracked spectacles, bony hands, facing front' },
    iron_gladiator:  { desc: 'heavy armored gladiator, iron chest plate, spiked gauntlets, iron chain flail raised, arena fighter pose, facing front' },
    sand_colossus:   { desc: 'sand golem, massive body of swirling desert sand and stone, glowing orange eyes, rocky fists, facing front' },
    frost_dragon:    { desc: 'young frost dragon, icy pale blue scales, frost breath wisps, small folded wings, crouched ready stance, facing front' },
    ember_dragon:    { desc: 'young fire dragon, deep red and orange scales, small ember flames on body, curved horns, crouched ready stance, facing front' },
    orc_warmaster:   { desc: 'orc warlord, grey-green skin, black spiked iron armor, giant battle axe on shoulder, tribal war face paint, facing front' },
    crystal_sage:    { desc: 'crystal mage, translucent cobalt robe, crystal-tipped staff, three orbiting gem shards, calm powerful pose, facing front' },
    moon_priestess:  { desc: 'moon cult priestess, silver silk robes with moon motifs, silver crescent hair ornaments, soft moonlight halo, facing front' },
    sun_paladin:     { desc: 'sun temple paladin, polished golden armor, radiant sun halo behind head, sacred longsword raised, facing front' },
    plague_doctor:   { desc: 'plague doctor, long-beaked bird mask, dark oilskin long coat, belt of colored vials, sinister pose, facing front' },
  },
};

export const STYLE_SUFFIX =
  'Pokémon GBA Game Boy Advance sprite style, Chinese mythology Hou Yi world, ' +
  'chibi proportions, full body visible, flat cel shading, bold dark outline, transparent background, ' +
  'no anti-aliasing, no gradients, pixel perfect, 32x32 pixels';

export const NEGATIVE_PROMPT =
  'blurry, realistic, 3d render, photorealistic, anti-aliasing, smooth shading, ' +
  'gradient, extra limbs, text, watermark, signature, western style, modern clothes, ' +
  'cropped, partial body, zoomed in face only';
