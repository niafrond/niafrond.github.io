/**
 * spellfx-motifs.mjs — Motif visuel (en anglais, pour Pixel Lab) et mouvement de chaque sort.
 * Format : id -> [motif de l'image clé, mouvement de l'animation].
 * Les sorts sont des effets seuls (pas de personnage) : projectile, souffle, nuée, onde…
 */
export const MOTIFS = {
  // ── Sorts élémentaires (tier 1 → 4) ──
  fireball: ['a small red dragon head breathing a jet of fire', 'the dragon breathes fire forward, flames flicker'],
  flameStrike: ['a blazing phoenix diving, wings of fire spread', 'phoenix wings beat and flames trail'],
  inferno: ['a huge celestial furnace cauldron overflowing with roaring flames', 'flames surge up and swirl'],
  meteor: ['a flaming shooting star with a long fiery tail crashing down', 'the star streaks down, sparks fly'],
  ice: ['a cluster of sharp ice shards flying', 'ice shards shoot forward and glitter'],
  frostNova: ['a blue sea dragon king made of a freezing wave', 'icy wave rolls and surges forward'],
  blizzard: ['a swirling snowstorm of the north with whipping white wind', 'snow swirls violently'],
  iceAge: ['a giant glacier of the Kunlun mountains freezing the ground, ice spikes', 'ice spreads and crystals grow'],
  heal: ['a green jade talisman glowing with soft light', 'the talisman glows and sparkles pulse'],
  greatHeal: ['celestial dew drops falling from the sky, green glow', 'dew drops fall and shimmer'],
  revitalize: ['a green swirl of qi energy circulating in a circle', 'qi energy circulates around'],
  miracle: ['a radiant full moon blessing with green and white light rays', 'moonlight rays pulse and sparkle'],
  bolt: ['a yellow lightning bolt', 'lightning crackles and flashes'],
  thunderBolt: ['a thick lightning bolt striking from dark thunder clouds on mountains', 'lightning strikes and flashes'],
  lightningStorm: ['a storm of one hundred yellow lightning bolts under a dark cloud', 'many bolts strike in sequence'],
  stormOfGods: ['a celestial tribulation, huge divine lightning columns from a swirling heavenly vortex', 'lightning columns strike, vortex spins'],

  // ── Combinaisons (tier 2 → 4) ──
  vaporBurst: ['a steaming cauldron bursting with red and blue vapor', 'steam bursts out'],
  goldenDew: ['golden dew drops with green sparkles', 'golden drops fall and sparkle'],
  lotusPoison: ['a black lotus flower releasing purple and green poison mist', 'poison mist rises and the lotus opens'],
  emberStorm: ['a god of fire riding a storm of embers and yellow lightning', 'embers and lightning whirl'],
  shadowFlame: ['dark purple flames with red edges, shadow fire', 'shadow flames lick and flicker'],
  springRain: ['gentle spring rain falling with green leaves and blue drops', 'rain falls, leaves drift'],
  frostLightning: ['a stormy blue ice cloud with yellow lightning from high mountains', 'lightning flashes in icy clouds'],
  voidChill: ['a purple void breath of freezing mist with ice crystals', 'cold void mist swirls out'],

  // ── Avancés (tier 3 → 5) ──
  bladeWinds: ['four curved wind blades spinning in a cross, red yellow blue', 'the four blades spin outward'],
  brasierSeals: ['a brazier ringed by glowing red and purple talisman seals', 'seals rotate, flames rise'],
  threeDragons: ['exactly three separate Chinese dragons side by side, one blue one yellow one green, each with its own head, three dragon heads visible', 'three dragons coil and fly upward'],
  dragonCross: ['four separate Chinese dragons forming a cross, one red one yellow one blue one green, four distinct dragon heads', 'the four dragons spiral around the cross'],
  thunderPrison: ['a cage of yellow thunder and frozen ice bars', 'lightning crackles along the cage bars'],
  jadeBreath: ['a vast cloud of green jade breath with colored sparks', 'jade breath billows'],
  starRain: ['a rain of one thousand colored stars falling', 'stars fall in a glittering shower'],
  fiveHarmony: ['five elements orbs, fire water wood earth lightning, orbiting a glowing center', 'the five orbs orbit and merge into light'],

  // ── Grands sorts (tier 5) ──
  twinDragonsStrike: ['a red dragon and a blue dragon intertwined striking forward', 'the two dragons spiral and strike'],
  vermilionBirdDive: ['a huge vermilion bird of the south diving in flames and golden light', 'the bird dives with burning wings'],
  azureDragonRoar: ['a roaring azure dragon head with green and purple shockwave', 'the dragon roars, shockwaves ripple'],
  whiteTigerClaw: ['giant white tiger claw slashes of red yellow and green energy', 'the claw rakes in three slashes'],
  thunderDukeWrath: ['the thunder duke god hurling huge yellow and blue lightning hammers', 'hammers of lightning strike down'],
  fiveElementsSeal: ['a large glowing magic seal circle with five element symbols', 'the seal rotates and flares'],
  heavenlyRiverFlood: ['a colossal celestial river flooding down as a roaring blue and green waterfall wave', 'the flood crashes forward'],
  nineSunsFall: ['nine separate small blazing suns arranged in a 3 by 3 grid, nine distinct round fiery suns with fire trails', 'the suns fall one after another, fire trails'],
  kunlunMountainFall: ['a huge mountain falling from the sky wrapped in green purple and red energy', 'the mountain crashes down, rocks scatter'],
  pangusAxe: ['the colossal axe of Pangu splitting heaven and earth with red yellow and blue light', 'the axe swings down, light cracks the sky'],
  jadeEmperorDecree: ['the Jade Emperor imperial decree scroll unrolling with golden five-colored divine light', 'the scroll unrolls, radiant light bursts'],
  heavenTribulationEnd: ['the end of heavenly tribulation, apocalyptic sky of thunder fire and light', 'the sky tears apart in thunder'],
  jadeSpringBlessing: ['a jade spring fountain glowing green and blue', 'the fountain rises and sparkles'],
  immortalPeach: ['a glowing golden immortal peach with green and purple aura', 'the peach glows and petals drift'],
  queenMotherElixir: ['the Queen Mother of the West elixir cauldron overflowing with green blue and purple light', 'elixir light swells and flows'],

  // ── Sorts de plateau (tier 1 → 3) ──
  emberScythe: ['a red glowing ember scythe slash', 'the scythe sweeps across, embers fly'],
  frostCleave: ['a blue frost blade cleaving, ice trail', 'the blade cleaves, frost scatters'],
  galeSlash: ['a yellow wind blade slash', 'the wind blade slashes across'],
  voidRift: ['a purple dark rift tearing in space', 'the rift widens and pulses'],
  crimsonPurge: ['a crimson flame wave purging the board', 'the red wave sweeps across'],
  tidalPurge: ['a blue tidal wave sweeping', 'the tide sweeps across'],
  jadePurge: ['a green jade energy wave sweeping', 'the green wave sweeps across'],
  stormPurge: ['a yellow storm wave sweeping with lightning', 'the storm wave sweeps across'],
  shadowPurge: ['a purple shadow wave sweeping', 'the dark wave sweeps across'],
  emberGoldCross: ['a cross of red and golden embers', 'the cross flares and embers fly'],
  jadeCurtain: ['a curtain of green jade and water falling', 'the curtain of water falls'],
  purpleRazor: ['a purple storm razor blade with yellow sparks', 'the razor spins and sparks'],
  burningTide: ['a burning red and blue tide, steaming waves of fire and water', 'fire and water waves clash'],
  seasonsPurge: ['a swirl of four seasons, leaves snow sun and lightning, green and yellow', 'the seasons swirl'],

  // ── Sorcier ──
  mageStrike: ['a Taoist master casting a blue and red spell bolt', 'the bolt shoots forward'],
  wildMana: ['wild blue and green qi energy wisps', 'wisps swirl wildly'],
  shadowCurse: ['a purple sealing talisman paper with glowing runes', 'the talisman flutters and glows'],
  darkChannels: ['dark purple meridian energy lines glowing', 'energy lines pulse'],
  flameBolts: ['flaming red talisman papers flying', 'burning talismans fly forward'],
  iceShield: ['a blue frost barrier shield of ice', 'the ice barrier forms and shimmers'],
  flameblade: ['a purple-red flame sword blade', 'the flame sword flickers and slashes'],
  weakness: ['a purple weakening seal sigil', 'the seal pulses and darkens'],
  handOfIce: ['a hand palm of frost with ice crystals', 'the icy palm strikes'],
  fingerOfDeath: ['a solar finger beam, dark purple death ray', 'the ray fires forward'],
  chasm: ['a deep chasm fissure of the Yellow River, red and blue light cracks', 'the ground splits open'],
  stoneskin: ['a green jade armor skin shimmering', 'the jade skin shimmers'],
  strength: ['a red tiger spirit aura', 'the tiger aura roars'],
  flameSphere: ['a sphere of red flames', 'the fireball pulses and orbits'],
  mirrorShield: ['a bronze mirror shield reflecting blue light', 'the mirror glints'],
  manaSiphon: ['purple qi energy being sucked in a spiral', 'energy spirals inward'],
  manaBlast: ['an explosion of the five elements, red blue green yellow', 'the explosion bursts outward'],

  // ── Assassin / archer ──
  tigerEye: ['a glowing blue tiger eye', 'the eye glints'],
  sneakAttack: ['a silent blue arrow shot', 'the arrow flies'],
  swiftStrike: ['a fast yellow and red arrow shot with motion lines', 'the arrow zips'],
  confuse: ['a mist arrow with blue and green fog swirls', 'fog swirls around the arrow'],
  stealth: ['a purple mist veil of fog', 'mist drifts and fades'],
  poisonBlade: ['a green poisoned arrow dripping venom', 'the arrow flies, venom drips'],
  shadowStrike: ['a shadow arrow, black purple with red glint', 'the arrow strikes from darkness'],
  dualShot: ['two arrows flying together, four elements colored trails', 'twin arrows fly'],
  shadowStep: ['a yellow shadow dash afterimage', 'afterimages dash'],
  sharpenedBlade: ['a sharpened yellow arrow with a red tip', 'the arrow glints and flies'],

  // ── Templier / garde ──
  defensiveWall: ['an imperial wall of green and purple energy bricks', 'the wall rises'],
  shieldBash: ['a round red shield bash impact', 'the shield slams'],
  focus: ['a blue and yellow qi focus ring', 'the ring tightens'],
  intimidate: ['a purple imperial glare, eyes glowing', 'the glare flashes'],
  rush: ['a yellow and green cavalry charge dust horse silhouette', 'the charge rushes forward'],
  counterAttack: ['a red guard counter-strike sword flash', 'the sword counter-strikes'],
  reinforce: ['green banner troops reinforcements glow', 'the banner waves'],
  barrier: ['a green jade rampart barrier shield', 'the barrier forms'],
  divinePower: ['a yellow heavenly mandate light descending', 'light descends'],
  holdTheLine: ['a green turtle shell formation shield', 'the shell shield glows'],
  heavensWrath: ['yellow wrath of heaven, a divine lightning from clouds', 'divine lightning strikes'],
  commandAura: ['a purple and green command aura ring', 'the aura radiates'],

  // ── Barbare ──
  enrage: ['a red steppe fury aura of rage', 'the aura flares in anger'],
  cleave: ['a horde cleave axe slash, red and yellow', 'the axe cleaves'],
  throwAxe: ['a flying throwing axe, green and red trail', 'the axe spins forward'],
  bloodlust: ['a red green yellow and blue battle lust aura swirl', 'the aura swirls'],
  summonTempest: ['a heavenly wind summoned, red yellow blue gale swirl', 'the gale swirls'],
  berserkerRage: ['a steppe wolf spirit howling, red and green aura', 'the wolf howls'],
  singingBlades: ['whistling arrows flying with red and yellow trails', 'arrows whistle by'],
  deathbringer: ['a Sun-bearer, a huge blazing sun carried like a shield, fire and green light', 'the sun flares and pulses'],
  revenant: ['spirits of the ancestors rising as ghostly red and yellow flames', 'ancestor spirits rise'],
  warCry: ['a red war cry shockwave from a roaring mouth', 'the shockwave blasts out']
};

/** Taille forcée (px) pour les sorts à sujets multiples, illisibles en petit. */
export const SIZE_OVERRIDE = { threeDragons: 96, dragonCross: 96, nineSunsFall: 128, starRain: 96, lightningStorm: 96, twinDragonsStrike: 128, fiveHarmony: 96 };
