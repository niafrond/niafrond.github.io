// Prompts des ennemis nommés (gabarits `copyOf` de enemies.catalog.json) : dessin dédié au lieu de l'emprunt du gabarit d'origine
// (TEMPLATE_SPRITE_COPIES, sprites/index.js). Fusionné dans EXTRA_MANIFEST.enemies (sprite-prompts-extra.js) ; lu aussi par gen-sprites-gm.mjs
// via sprite-overrides.mjs. Régénérer : node tools/gen-sprites-gm.mjs --only=<id> --force
export const NAMED_ENEMIES = {
    // Maîtres de l'Arène des Mille Flèches
    maitresse_tong: { desc: 'Master Tong, stern middle-aged Chinese swordswoman, bronze lamellar armor over a dark green hanfu, hair in a tight bun with a bronze pin, holding a straight bronze jian sword, upright dueling stance' },
    maitre_hong_gang: { desc: 'Master Hong Gang, broad muscular Chinese martial artist, bare arms, copper-red sash and trousers, a large copper gong strapped on his back, holding a heavy gong mallet, fierce grin' },
    maitre_tie_bi: { desc: 'Master Tie Bi, stocky Chinese warrior with one forged iron arm, dark grey robe with iron bracers, short beard, sparks of lightning on the iron fist, solid wide stance' },
    dame_yin_yue: { desc: 'Lady Yin Yue, graceful Chinese dancer-fighter in a flowing silver and pale blue hanfu, long silver ribbons, crescent moon hair ornament, holding two silver fans, moonlit glow' },
    seigneur_jin_long: { desc: 'Lord Jin Long, proud Chinese champion in golden scale armor decorated with a coiled golden dragon, red cape, golden dragon helmet, holding a golden guandao glaive' },
    dame_bi_yu: { desc: 'Lady Bi Yu, calm Chinese martial artist in a jade green hanfu, jade bangles, one hand made of polished glowing jade, hair with jade hairpins, palm strike stance' },
    immortel_yun_zhong: { desc: 'Immortal Yun Zhong, elderly Chinese hermit sage floating on a small white cloud, long white beard, light blue and white flowing robes, frost crystals around him, fly-whisk in hand' },
    grand_maitre_qian_jian: { desc: 'Grand Master Qian Jian, legendary old Chinese archer, long grey hair tied back, dark red archer robe, huge quiver overflowing with arrows, drawing a tall recurve bow, piercing eyes' },
    // Gardes des soleils
    noye_garde: { desc: 'drowned guard ghost, pale bloated soldier in rusted waterlogged armor, river weeds tangled on the body, dripping water, hollow glowing blue eyes, holding a corroded halberd' },
    esprit_cloche: { desc: 'bell spirit, small floating ancient Chinese bronze temple bell with green patina, cracked, faint ghostly face on the bell, two wispy arms, echoing sound rings around it' },
    foudre_garde: { desc: 'thunder guard, young son of the Chinese thunder god, blue-skinned youth with small feathered wings and a beaked face, light armor, holding a small drum and mallet crackling with lightning' },
    forgeron_magma: { desc: 'fire temple smith, burly Chinese blacksmith in a scorched leather apron, soot-covered skin, glowing molten veins on the arms, holding a large bellows and a hammer, ember sparks' },
    forgeron_lave: { desc: 'lava forge giant, huge hulking smith made of cooled black basalt with glowing lava cracks, leather apron, enormous hammer dripping molten metal, heavy brow' },
    garde_maree: { desc: 'tide guard of the Dragon King, Chinese sea soldier with a shrimp-like armored body, blue-green shell armor, long antennae on the helmet, holding a trident, foam at the feet' },
    grue_lige: { desc: 'liege crane, tall elegant white red-crowned crane spirit with golden armor plates on the wings, long black neck, wise eyes, spread protective wings, small sun glow behind' },
    // Ennemis de quête
    brigand_sables: { desc: 'desert bandit, lean Chinese brigand in a dusty sand-colored hooded cloak, face scarf, curved saber, leather bracers, water gourd at the belt, crouching ready to pounce' },
    chef_de_dune: { desc: 'dune warlord Sand-Arm, massive Chinese bandit chief, bronze horned helmet, tattered desert cloak, one arm wrapped in sand-colored bandages swirling with sand, heavy war axe' },
    petit_gui: { desc: 'small mischievous ghost imp, tiny pale grey Chinese spirit with a round head, big dark eyes, wispy tail instead of legs, muddy splashes, sneaky grin, stealing a coin' },
    corbeau_demon: { desc: 'demon crow, large black three-eyed crow with ember-red eyes, ragged smoking feathers, sharp beak holding a stolen rice ear, wings half spread, menacing' },
    singe_demon: { desc: 'demon monkey, wiry golden-brown macaque with red face and glowing eyes, ragged red vest, clutching a stolen peach, long tail curled, mischievous fangs' },
    taureau_braise: { desc: 'ember bull, powerful black bull with glowing orange cracks in its hide, horns red-hot like embers, smoke from the nostrils, pawing the ground ready to charge' },
    crabe_soldat: { desc: 'crab soldier, large red armored crab standing upright, one oversized blade-like pincer, small soldier helmet, barnacles on the shell, sea foam' },
    carpe_doree: { desc: 'golden carp spirit, big shimmering golden koi-like carp with long flowing fins and small dragon whiskers, jumping out of water, splashing droplets' },
    tortue_dragon: { desc: 'dragon turtle, giant sleeping turtle with a dragon head, dark blue-green frosted shell covered in moss and small rocks, icy breath, closed heavy-lidded eyes' }
};
