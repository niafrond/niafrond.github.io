// Prompts de génération de tuiles de terrain GBA via pixel.lab Bitforge.
// Chaque biome a 3 variantes : ground (sol), path (chemin), liquid (eau/lave).

export const TILE_SIZE = 16; // pixels natifs

// Types de tuile à générer par biome
export const TILE_TYPES = ['ground', 'path', 'liquid'];

export const TILE_MANIFEST = {
  paddy: {
    label: 'Rizière',
    ground: 'lush green rice paddy field tile, short bright green grass with water puddles, overhead top-down view',
    path:   'dirt path through rice fields, packed light brown soil, top-down view',
    liquid: 'calm shallow paddy water tile, pale teal blue water with gentle ripple lines, top-down view',
  },
  riverbed: {
    label: 'Lit de rivière',
    ground: 'dry riverbed ground tile, warm sandy beige gravel with small pebbles, top-down view',
    path:   'sandy trail tile, compacted warm sand with light footprint marks, top-down view',
    liquid: 'muddy shallow river tile, murky brownish water with slow current lines, top-down view',
  },
  bamboo: {
    label: 'Forêt de bambous',
    ground: 'mossy forest floor tile, dark green moss and fallen leaves on grey-green earth, top-down view',
    path:   'narrow forest trail tile, dark grey-green packed earth with leaf litter, top-down view',
    liquid: 'dark forest pond tile, still dark green water reflecting bamboo, top-down view',
  },
  gobi: {
    label: 'Désert de Gobi',
    ground: 'desert sand tile, warm golden sand with subtle wind ripple pattern, top-down view',
    path:   'desert caravan path tile, pale yellow compacted sand with stone fragments, top-down view',
    liquid: 'desert oasis water tile, bright turquoise water with sand border, top-down view',
  },
  storm: {
    label: 'Montagne tempête',
    ground: 'stormy mountain rock tile, dark purple-grey rough stone surface with cracks, top-down view',
    path:   'mountain pass path tile, dark slate stone steps worn smooth, top-down view',
    liquid: 'storm mountain lake tile, dark navy blue water with white foam flecks, top-down view',
  },
  volcano: {
    label: 'Volcan',
    ground: 'volcanic rock tile, very dark grey-black porous lava rock with red glowing cracks, top-down view',
    path:   'ash path tile, grey ash and cinder trail on black rock, top-down view',
    liquid: 'lava tile, glowing orange-red molten lava with dark crust cracks, bright light, top-down view',
  },
  savanna: {
    label: 'Savane',
    ground: 'savanna ground tile, dry golden-yellow grass and red-brown earth, top-down view',
    path:   'savanna trail tile, red-brown dry earth packed trail with dry grass edges, top-down view',
    liquid: 'savanna watering hole tile, blue water with sandy beige edge, top-down view',
  },
  coast: {
    label: 'Côte',
    ground: 'coastal sand tile, fine pale cream beach sand with tiny shell fragments, top-down view',
    path:   'coastal walkway tile, pale beige compacted sand trail, top-down view',
    liquid: 'shallow sea tile, clear bright blue water with white foam and sandy seabed visible, top-down view',
  },
  fusang: {
    label: 'Fusang doré',
    ground: 'magical golden forest floor tile, warm golden grass with glowing amber sparks, top-down view',
    path:   'golden forest path tile, warm golden dirt path with fallen glowing petals, top-down view',
    liquid: 'magical golden pool tile, liquid gold shimmering surface with light reflections, top-down view',
  },
  house: {
    label: 'Intérieur maison',
    ground: 'chinese house floor tile, polished warm wooden planks with grain texture, top-down view',
    path:   'indoor corridor tile, terracotta red clay floor tiles with grout lines, top-down view',
    liquid: null, // pas de liquide intérieur
  },
  cave: {
    label: 'Grotte',
    ground: 'cave stone floor tile, dark grey-brown rough cave rock with small pebbles, top-down view',
    path:   'cave tunnel path tile, dark stone with worn smooth footpath, top-down view',
    liquid: 'underground lake tile, very dark navy blue still water with faint bioluminescent glow, top-down view',
  },
  moon: {
    label: 'Lune',
    ground: 'lunar surface tile, pale blue-grey moon dust with small impact craters, top-down view',
    path:   'moon path tile, pale silver-white moon rock pathway, top-down view',
    liquid: 'moonlit pool tile, glowing indigo and silver magical water reflecting moonlight, top-down view',
  },
};

export const TILE_STYLE_SUFFIX =
  'Pokémon GBA Game Boy Advance tileset style, seamless texture tile, ' +
  'flat cel shading, bold dark outline, 16x16 pixel art, ' +
  'no characters, no objects, ground texture only, ' +
  'pixel perfect, no anti-aliasing, no gradients';

export const TILE_NEGATIVE =
  'characters, NPCs, animals, items, objects, furniture, trees, buildings, ' +
  'blurry, realistic, 3d, photorealistic, anti-aliasing, gradients, text, watermark';
