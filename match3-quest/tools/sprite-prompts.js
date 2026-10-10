// Manifest de prompts pour la génération de sprites GBA via pixel.lab.
// Chaque entrée correspond à une clé de sprite dans le jeu.
// desc : description du personnage (sans style/direction, ajoutés par le script)

export const SPRITE_MANIFEST = {
  heroes: {
    assassin: { desc: 'female assassin, dark purple silk robe, silver throwing daggers, black hair bun with pin' },
    sorcerer: { desc: 'male sorcerer, deep blue flowing robes, glowing magic staff, long grey beard' },
    archer:   { desc: 'Hou Yi archer hero, red and gold lamellar armor, wooden bow and arrow, black top-knot hair' },
    warrior:  { desc: 'female warrior, red jade plate armor, bronze sword and round shield, black hair bun' },
  },

  npcs: {
    farmer_lin:    { desc: 'Chinese farmer, wide straw hat, simple brown hemp robe, carrying wheat sheaf' },
    merchant_ma:   { desc: 'Chinese merchant, round silk hat, colorful trade robe, holding coin purse' },
    elder_wen:     { desc: 'old Chinese village elder, long white beard, grey Taoist robe, wooden walking stick' },
    monk_zhen:     { desc: 'Buddhist monk, saffron orange robe, shaved head, string of prayer beads' },
    herbalist_xu:  { desc: 'Chinese herbalist, light green robe, wicker basket of herbs, pointed bamboo hat' },
    smith_tie:     { desc: 'Chinese blacksmith, leather work apron, muscular arms, holding iron hammer' },
    weaver_mei:    { desc: 'Chinese weaver girl, pink silk robe, long straight black hair, holding silk thread' },
    shepherd_zi:   { desc: 'young Chinese shepherd boy, simple rough-spun clothes, long wooden crook staff' },
    guide_dawa:    { desc: 'Tibetan mountain guide, brown yak-fur coat, pointing finger forward, windswept hair' },
    ferryman_gu:   { desc: 'Chinese river ferryman, conical straw hat, navy blue robe, holding wooden oar' },
    hunter_wu:     { desc: 'Chinese hunter, dark green camouflage clothes, bow slung on back, feathered hat' },
    fisher_hai:    { desc: 'Chinese fisherman, faded blue robe, bamboo fishing rod, cheerful smile' },
    miner_shan:    { desc: 'Chinese miner, dusty grey work clothes, iron pickaxe, lantern headband' },
    priestess_yan: { desc: 'Chinese temple priestess, white hanfu robe, red silk ornaments, holding incense stick' },
    crane_envoy:   { desc: 'divine crane messenger, white feather ceremonial robe, crane feather headdress' },
    change:        { desc: 'Chang e moon goddess, flowing white and silver hanfu, glowing moon hair ornament' },
  },

  enemies: {
    goblin_saboteur: { desc: 'mischievous goblin, torn dirty clothes, carrying explosive bomb and wrench, green skin' },
    forest_guardian: { desc: 'forest spirit warrior, bark and leaf green armor, vine shield, glowing amber eyes' },
    bone_reaver:     { desc: 'skeleton warrior, yellowed bone plate armor, jagged curved sword, hollow eyes' },
    storm_knight:    { desc: 'dark armored knight, black iron plate armor, crackling lightning, horned visor' },
    shadow_assassin: { desc: 'shadow ninja, dark silk wrappings, smoke tendrils, crouching ready to strike' },
    arcane_scholar:  { desc: 'undead mage scholar, tattered purple robe, floating arcane books, cracked spectacles' },
    iron_gladiator:  { desc: 'heavy armored gladiator, iron chest plate, spiked gauntlets, iron chain flail' },
    sand_colossus:   { desc: 'massive sand golem, body made of swirling desert sand and stone, glowing orange eyes' },
    frost_dragon:    { desc: 'young frost dragon, icy pale blue scales, frost breath cloud, small folded wings' },
    ember_dragon:    { desc: 'young fire dragon, deep red and orange scales, ember flames, curved horns' },
    orc_warmaster:   { desc: 'orc warlord, grey-green skin, black spiked iron armor, giant battle axe, war face paint' },
    crystal_sage:    { desc: 'crystal mage, translucent cobalt robe, crystal-tipped staff, orbiting gem shards' },
    moon_priestess:  { desc: 'moon cult priestess, silver silk robes, silver crescent hair ornaments, soft moonlight glow' },
    sun_paladin:     { desc: 'sun temple paladin, polished golden armor, radiant sun halo, sacred longsword' },
    plague_doctor:   { desc: 'plague doctor, long-beaked bird mask, dark oilskin coat, belt of poison vials' },
  },
};

export const STYLE_SUFFIX =
  'Chinese mythology Hou Yi world, GBA Game Boy Advance pixel art style, ' +
  'chibi proportions, flat cel colors, crisp dark outline, transparent background, ' +
  'no anti-aliasing, no shading gradients, pixel perfect';

export const NEGATIVE_PROMPT =
  'blurry, realistic, 3d render, photorealistic, anti-aliasing, smooth shading, ' +
  'gradient, extra limbs, text, watermark, signature, western style, modern clothes';
