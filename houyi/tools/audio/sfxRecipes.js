/**
 * sfxRecipes.js — Recettes de synthèse des effets sonores — OUTIL DE BUILD, pas chargé par le jeu.
 *
 * Données pures : sfxRecipe(event, payload) renvoie les notes (`tones` : [délai s, fréquence Hz, durée s, gain relatif, onde])
 * et les rafales de bruit filtré (`noises` : [délai, durée, gain relatif, fréquence départ, fréquence fin, type de filtre])
 * d'un effet, chacune avec un multiplicateur de gain. tools/audio/render.mjs les rend hors ligne en MP3 (audio/sfx/).
 */
/* ───────────── Sorts : un petit effet par sort (0,25 à 1,1 s) ───────────── */
const hash32 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const PENTA = [0, 2, 4, 7, 9];                       // gamme pentatonique : jamais de fausse note, même par hasard
const hz = (root, semis) => root * 2 ** (semis / 12);

/**
 * Recette d'un sort. `meta` : { colors: ['red'…], type, effect, cost (qì total), ultimate }.
 * Timbre par couleur de qì (rouge feu, bleu eau/glace, vert vent/bois, jaune métal/terre, violet ombre), geste par type
 * (soin = arpège montant, plateau = balayage, renfort = double note brillante), durée et basse selon le coût ; hauteur et
 * motif tirés de l'identifiant, donc stables et différents d'un sort à l'autre.
 */
export function spellFx(id, meta = {}) {
    const tones = [], noises = [];
    const T = (delay, freq, dur, rel, wave) => tones.push({ p: [delay, freq, dur, rel, wave], gain: 1 });
    const N = (delay, dur, rel, f0, f1, type) => noises.push({ b: [delay, dur, rel, f0, f1, type], gain: 1 });
    const rnd = seeded(hash32(id));
    const colors = meta.colors || [];
    const color = colors[0] || null;
    const cost = Math.max(0, Number(meta.cost) || 0);
    const power = Math.min(1, Math.max(0.15, cost / 40));            // 0,15 (petit sort) à 1 (coup de maître)
    const ult = !!meta.ultimate;
    const heal = meta.type === 'heal' || /heal|elixir|peach|blessing|breath|dew|miracle|revitalize/i.test(id);
    const buff = !heal && (/^(statBuff|increase|enchant|reflect|reduceEnemy|preventItems|createJoker|createActionGem|harmony|bonusTurn)/.test(meta.effect || '') || /shield|barrier|stealth|focus|wall|aura|strength|stoneskin|reinforce|cry|enrage|hold/i.test(id));
    const sweep = /^(sweep|destroy|clearColor|fireballArea)/.test(meta.effect || '');
    const root = 196 * 2 ** (((hash32(id) >>> 3) % 13 - 6) / 12);    // 138 à 277 Hz
    const step = 0.045 + rnd() * 0.03;
    const count = 2 + Math.floor(rnd() * 2 + power * 2);              // 2 à 5 notes
    const run = Array.from({ length: count }, (_, i) => PENTA[(Math.floor(rnd() * 5) + i * 2) % 5] + (i >= 3 ? 12 : 0));
    if (rnd() < 0.5) run.sort((a, b) => a - b); else run.sort((a, b) => b - a);
    const len = 0.22 + power * 0.35;

    if (heal) {                                  // soin : arpège montant doux + souffle clair
        const up = [...run].sort((a, b) => a - b);
        up.forEach((s, i) => { T(i * step, hz(root * 2, s), 0.18 + power * 0.1, 0.55 + i * 0.07, 'sine'); T(i * step, hz(root * 4, s), 0.1, 0.16, 'sine'); });
        N(0, len, 0.12, 2500, 6000, 'highpass');
    } else if (color === 'red') {                 // feu : souffle qui crépite, grondement qui monte
        N(0, len, 0.7, 500, 2800, 'bandpass'); N(0.04, len * 0.8, 0.5, 3200, 700, 'lowpass');
        run.forEach((s, i) => T(i * step, hz(root, s - 12), 0.12 + power * 0.1, 0.5, i % 2 ? 'square' : 'sawtooth'));
    } else if (color === 'blue') {                // eau / glace : gouttes descendantes, scintillement
        run.forEach((s, i) => { T(i * step, hz(root * 2, s), 0.16 + power * 0.1, 0.6, 'sine'); T(i * step + 0.01, hz(root * 4, s) * 1.005, 0.09, 0.2, 'sine'); });
        N(0.02, len, 0.25, 6500, 2500, 'highpass');
    } else if (color === 'green') {               // vent / bois : pincement de guzheng et brise
        run.forEach((s, i) => { T(i * step, hz(root * 2, s), 0.14, 0.7 - i * 0.05, 'triangle'); T(i * step, hz(root * 4, s), 0.06, 0.18, 'sine'); });
        N(0, len, 0.3, 1400, 700, 'bandpass');
    } else if (color === 'yellow') {              // métal / terre : gong et cloche aux partiels inharmoniques
        const f = hz(root * 2, run[0]);
        [[1, 0.8], [2.76, 0.4], [5.4, 0.22]].forEach(([r, g]) => T(0, f * r, 0.2 + power * 0.3, g, 'sine'));
        T(0, 90, 0.16, 0.9, 'sine'); N(0, 0.06, 0.5, 4000, 1500, 'bandpass');
    } else if (color === 'purple') {              // ombre : deux notes qui battent, grondement sourd
        const f = hz(root, run[0]);
        T(0, f, len, 0.55, 'square'); T(0, f * 1.047, len, 0.5, 'square'); T(0.05, f / 2, len, 0.6, 'sine');
        N(0, len, 0.5, 900, 150, 'lowpass');
    } else if (buff) {                            // renfort : deux notes brillantes montantes
        T(0, hz(root * 2, run[0]), 0.1, 0.7, 'triangle'); T(0.07, hz(root * 2, run[0] + 7), 0.16, 0.8, 'triangle'); T(0.07, hz(root * 4, run[0] + 7), 0.08, 0.2, 'sine');
        N(0, 0.05, 0.3, 4500, 2000, 'bandpass');
    } else {                                      // coup de lame / de martial : sifflement, claquement, choc
        N(0, 0.09 + power * 0.06, 0.8, 5000 - rnd() * 1500, 1200, 'bandpass'); N(0.06, 0.14, 0.7, 1500, 140, 'lowpass');
        T(0.06, 120 + rnd() * 40, 0.14, 0.9, 'sine'); T(0.06, 330 + rnd() * 120, 0.05, 0.4, 'square');
    }
    if (sweep) N(0.02, 0.3 + power * 0.2, 0.35, 600, 5000, 'bandpass');   // balayage du plateau
    if (power > 0.6 || ult) T(0, 62 + rnd() * 10, 0.3 + power * 0.25, 0.9, 'sine');   // basse d'un sort cher
    if (ult) { for (let i = 0; i < 4; i++) T(0.15 + i * 0.1, hz(root * 4, PENTA[i % 5] + 12), 0.4, 0.4, 'sine'); N(0, 0.7, 0.3, 300, 4000, 'bandpass'); }
    return { tones, noises };
}

/** Coup d'arc : corde, flèche qui siffle, impact ; plus la rareté monte, plus le tintement métallique est long. */
export function bowHitFx(rarity, isPlayer = true) {
    const tones = [], noises = [];
    const T = (delay, freq, dur, rel, wave) => tones.push({ p: [delay, freq, dur, rel, wave], gain: 1 });
    const N = (delay, dur, rel, f0, f1, type) => noises.push({ b: [delay, dur, rel, f0, f1, type], gain: 1 });
    const k = isPlayer ? 1 : 0.8;
    T(0, 196 * k, 0.07, 0.6, 'triangle'); T(0, 392 * k, 0.04, 0.3, 'sine');            // corde
    N(0.02, 0.1, 0.5, 4200, 1200, 'bandpass');                                          // flèche
    N(0.1, 0.14, 0.9, 1400, 140, 'lowpass'); T(0.1, isPlayer ? 130 : 105, 0.14, 1, 'sine');   // impact
    if (rarity === 'uncommon') T(0.1, 2400 * k, 0.04, 0.25, 'sine');
    if (rarity === 'rare') { T(0.1, 1800 * k, 0.2, 0.3, 'sine'); T(0.1, 2700 * k, 0.12, 0.18, 'sine'); }
    if (rarity === 'legendary') { [1760, 2349, 2960, 3520].forEach((f, i) => T(0.1 + i * 0.045, f * k, 0.22, 0.28, 'sine')); T(0.1, 70, 0.22, 0.8, 'sine'); }
    return { tones, noises };
}

export function sfxRecipe(eventName, payload = {}) {
    const len = Math.max(3, Math.min(7, Number(payload.length) || 3));
    const isPlayer = payload.isPlayer !== false;
    const tones = [];
    const noises = [];
    const playPattern = (pattern, options = {}) => { const gain = options.gain ?? 1; pattern.forEach(p => tones.push({ p, gain })); };
    const playNoise = (bursts, options = {}) => { const gain = options.gain ?? 1; bursts.forEach(b => noises.push({ b, gain })); };

    switch (eventName) {
        case 'uiClick':
            playPattern([[0, 640, 0.07, 0.7, 'triangle']]);
            break;
        case 'toggleOn':
            playPattern([
                [0,    480, 0.06, 0.8, 'triangle'],
                [0.05, 720, 0.09, 1,   'triangle']
            ]);
            break;
        case 'swap':
            playPattern([
                [0,    380, 0.045, 0.7,  'square'],
                [0.04, 460, 0.045, 0.55, 'square']
            ]);
            break;
        case 'invalid':
            playPattern([
                [0,    220, 0.07, 0.75, 'sawtooth'],
                [0.04, 170, 0.08, 0.65, 'sawtooth']
            ]);
            break;
        case 'match': {
            const type = payload.matchType || 'color';
            const base = type === 'skull' ? 210 : type === 'combat' ? 300 : 520;
            const wave = type === 'color' ? 'triangle' : 'square';
            playPattern([
                [0,    base,            0.06, 0.7, wave],
                [0.05, base + len * 20, 0.09, 0.9, wave]
            ]);
            break;
        }
        case 'turnBonus':
            playPattern([
                [0,    520, 0.06, 0.7, 'triangle'],
                [0.05, 700, 0.06, 0.8, 'triangle'],
                [0.1,  900, 0.08, 1,   'triangle']
            ]);
            break;
        case 'spellCast':   // formule : souffle montant + tintement ; avec `spellId` : petit effet propre au sort (voir spellFx)
            if (payload.spellId) { const fx = spellFx(payload.spellId, payload.meta || {}); fx.tones.forEach(t => tones.push(t)); fx.noises.forEach(n => noises.push(n)); break; }
            playNoise([[0, 0.22, 0.35, 500, 3200, 'bandpass']]);
            playPattern([
                [0,    430, 0.08, 0.5, 'sine'],
                [0.05, 640, 0.1,  0.6, 'triangle'],
                [0.12, 860, 0.12, 0.55, 'sine']
            ]);
            break;
        case 'spellHit':    // le sort frappe : choc sourd + éclat magique
            playNoise([[0, 0.16, 0.9, isPlayer ? 1800 : 900, 160, 'lowpass']]);
            playPattern([
                [0,     isPlayer ? 150 : 110, 0.14, 1,   'sine'],
                [0.02,  isPlayer ? 760 : 300, 0.08, 0.6, 'square'],
                [0.06,  isPlayer ? 980 : 240, 0.1,  0.4, 'triangle']
            ]);
            break;
        case 'heal':
            playPattern([
                [0,    430, 0.07, 0.65, 'sine'],
                [0.05, 560, 0.08, 0.8,  'sine'],
                [0.11, 720, 0.08, 0.95, 'sine']
            ]);
            break;
        case 'weaponHit':   // coup d'arme : sifflement de lame puis impact sourd ; avec `rarity` : tir d'arc (corde + flèche), plus brillant selon la rareté
            if (payload.rarity) { const fx = bowHitFx(payload.rarity, isPlayer); fx.tones.forEach(t => tones.push(t)); fx.noises.forEach(n => noises.push(n)); break; }
            playNoise([
                [0,    0.07, 0.5, 4200, 1200, 'bandpass'],
                [0.05, 0.16, 1,   1400, 140,  'lowpass']
            ]);
            playPattern([
                [0.05, isPlayer ? 130 : 105, 0.14, 1, 'sine'],
                [0.05, isPlayer ? 210 : 170, 0.05, 0.6, 'square']
            ]);
            break;
        case 'skullHit':    // attaque par alignement de crânes : coup de poing lourd, plus fort selon la longueur
            playNoise([[0, 0.12 + len * 0.02, 0.9, 1500, 120, 'lowpass']]);
            playPattern([
                [0,    isPlayer ? 120 : 95, 0.16 + len * 0.01, 1,    'sine'],
                [0.02, isPlayer ? 190 : 150, 0.07, 0.6, 'square'],
                ...(len >= 4 ? [[0.07, 90, 0.16, 0.8, 'sine']] : [])
            ]);
            break;
        case 'manaGain': {  // mana récolté : scintillement magique ascendant (plus long avec la longueur)
            const notes = [880, 1108, 1318, 1760, 2093, 2637];
            const n = Math.min(notes.length, 2 + Math.floor(len / 2));
            const pat = [];
            for (let k = 0; k < n; k++) pat.push([k * 0.045, notes[k], 0.22, 0.45 + k * 0.05, 'sine'], [k * 0.045, notes[k] * 2.01, 0.12, 0.15, 'sine']);
            playPattern(pat, { gain: isPlayer ? 1 : 0.5 });
            break;
        }
        case 'combatStart': case 'bossStart': {
            // Jingle d'entrée en combat (façon Pokémon) : martèlement alterné rapide, montée pentatonique, note tenue.
            // Durée ≈ COMBAT_INTRO_MS : la musique de combat démarre juste après (voir main.js).
            const boss = eventName === 'bossStart';
            const lo = boss ? 164.8 : 329.6, hi = boss ? 196 : 392;
            const wave = boss ? 'sawtooth' : 'square';
            const p = [];
            const hits = boss ? 8 : 6;
            for (let i = 0; i < hits; i++) p.push([i * 0.075, i % 2 ? hi : lo, 0.06, 0.8, wave]);
            const t0 = hits * 0.075 + 0.05;
            const run = boss ? [220, 261.6, 329.6, 392, 440, 523.3] : [440, 523.3, 659.3, 784];
            run.forEach((f, i) => p.push([t0 + i * 0.09, f, 0.1, 0.85, wave]));
            const tEnd = t0 + run.length * 0.09;
            const top = run[run.length - 1];
            p.push([tEnd, top, 0.45, 1, 'triangle'], [tEnd, top / 2, 0.45, 0.8, wave], [tEnd, top * 1.5, 0.45, 0.5, 'triangle']);
            p.push([0, 90, 0.18, 1, 'sine'], [tEnd, 70, 0.25, 1, 'sine']);
            playPattern(p, { gain: boss ? 1.1 : 1 });
            break;
        }
        case 'victory':
            playPattern([
                [0,    520, 0.08, 0.75, 'triangle'],
                [0.08, 660, 0.08, 0.85, 'triangle'],
                [0.16, 880, 0.12, 1,    'triangle']
            ]);
            break;
        case 'defeat':
            playPattern([
                [0,    320, 0.1,  0.7,  'sawtooth'],
                [0.08, 240, 0.12, 0.85, 'sawtooth'],
                [0.18, 160, 0.18, 0.95, 'triangle']
            ]);
            break;
        case 'battleStart': // petit motif de début de combat
            playPattern([
                [0,    330, 0.09, 0.8, 'square'],
                [0.1,  330, 0.09, 0.8, 'square'],
                [0.2,  440, 0.09, 0.9, 'square'],
                [0.3,  523, 0.18, 1,   'square'],
                [0.3,  262, 0.18, 0.5, 'triangle']
            ]);
            break;
        case 'bossStart': // fanfare plus grave et plus longue pour les boss
            playPattern([
                [0,    196, 0.16, 0.9, 'sawtooth'],
                [0.18, 196, 0.16, 0.9, 'sawtooth'],
                [0.36, 233, 0.16, 0.95, 'sawtooth'],
                [0.54, 294, 0.16, 1,   'sawtooth'],
                [0.72, 392, 0.32, 1,   'square'],
                [0.72, 196, 0.32, 0.7, 'triangle'],
                [1.1,  370, 0.45, 1,   'square'],
                [1.1,  185, 0.45, 0.7, 'triangle']
            ]);
            break;
        case 'introJingle': // lent et mystérieux, façon chant du Fusang
            playPattern([
                [0,   262, 0.5, 0.6, 'triangle'], [0.6, 330, 0.5, 0.6, 'triangle'],
                [1.2, 392, 0.5, 0.7, 'triangle'], [1.8, 523, 0.9, 0.8, 'triangle'],
                [3.5, 392, 0.2, 0.7, 'square'],   [3.8, 392, 0.2, 0.7, 'square'],
                [4.1, 494, 0.2, 0.8, 'square'],   [4.4, 587, 0.6, 0.9, 'square'],
                [6.5, 392, 0.3, 0.9, 'square'],   [6.9, 523, 0.3, 0.9, 'square'],
                [7.3, 659, 0.9, 1,   'square'],   [7.3, 330, 0.9, 0.5, 'triangle']
            ]);
            break;
        case 'endingJingle': // berceuse apaisée
            playPattern([
                [0,   392, 0.6, 0.6, 'sine'], [0.7, 440, 0.6, 0.6, 'sine'],
                [1.4, 523, 0.9, 0.7, 'sine'], [2.6, 440, 0.6, 0.6, 'sine'],
                [3.3, 392, 0.6, 0.6, 'sine'], [4.0, 330, 1.2, 0.7, 'sine'],
                [6.0, 392, 0.6, 0.6, 'sine'], [6.7, 523, 0.6, 0.7, 'sine'],
                [7.4, 659, 1.0, 0.8, 'sine'], [8.8, 523, 0.8, 0.7, 'sine'],
                [9.8, 392, 1.8, 0.7, 'sine'], [9.8, 196, 1.8, 0.4, 'triangle']
            ]);
            break;
        default:
            playPattern([[0, 500, 0.05, 0.6, 'sine']]);
            break;
    }
    return { tones, noises };
}
