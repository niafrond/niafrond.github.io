// Options d'affichage et de performance (menu Options), mémorisées par appareil dans localStorage.
//  - manaFlight : particules de qì qui rejoignent la banque (manaFlight.js) ;
//  - effects    : 'auto' | 'low' | 'normal' | 'high' — niveau d'effets visuels ('auto' se règle sur l'appareil) ;
//  - speed      : 'slow' | 'normal' | 'fast' — durée des animations de combat et pauses entre les tours ;
//  - vibration  : vibrations du téléphone (dégâts subis, onde de la perception du qì), désactivables.
// Accessibilité :
//  - textSize   : 'normal' | 'large' | 'xlarge' — taille du texte des menus, de la fiche des combattants et du journal ;
//  - shapes     : symboles en plus des couleurs (tuiles, qì, camps) pour ne pas dépendre de la seule couleur ;
//  - colorblind : mode daltonien — palette des tuiles et du qì séparée par la teinte ET la luminosité (rouge/vert, bleu/violet), symboles activés d'office ;
//  - animations : false coupe animations et transitions (les pauses de combat restent, raccourcies) ;
//  - reduceFx   : réduit les effets visuels (équivaut au niveau d'effets « Économe », sans lueurs ni secousses).
//    Tant que le joueur n'a pas choisi lui-même « Animations », le réglage « réduire les animations » du système (prefers-reduced-motion) s'applique ;
//    son choix explicite, dans un sens ou dans l'autre, prime ensuite.
// Confort :
//  - breakReminder : rappel de pause bienveillant (breakReminder.js), désactivable.
// Difficulté des ennemis :
//  - aiDifficulty : 'auto' | 'easy' | 'normal' | 'hard' | 'expert' (enemyAI.js). 'auto' (défaut) adapte la qualité des décisions au
//    niveau de l'ennemi, de façon bornée ; un palier fixe est appliqué tel quel à chaque combat (jamais de bonus de statistiques).
// Les autres options sont purement visuelles : elles ne changent pas les règles du jeu.

export const OPTIONS_STORAGE_KEY = 'match3quest.options';
export const OPTION_DEFAULTS = { manaFlight: true, effects: 'auto', speed: 'normal', vibration: true, textSize: 'normal', shapes: false, colorblind: false, animations: true, reduceFx: false, breakReminder: true, aiDifficulty: 'auto' };
const CHOICES = { effects: ['auto', 'low', 'normal', 'high'], speed: ['slow', 'normal', 'fast'], textSize: ['normal', 'large', 'xlarge'], aiDifficulty: ['auto', 'easy', 'normal', 'hard', 'expert'] };
const SPEED_FACTOR = { slow: 1.4, normal: 1, fast: 0.6 };

let current = { ...OPTION_DEFAULTS };
const explicit = new Set();   // options que le joueur a réellement choisies (stockées)

function load() {
    try {
        const raw = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) || '{}');
        Object.keys(OPTION_DEFAULTS).forEach(k => { if (isValid(k, raw[k])) { current[k] = raw[k]; explicit.add(k); } });
    } catch (e) { /* stockage indisponible : valeurs par défaut */ }
}

function isValid(key, value) {
    if (typeof OPTION_DEFAULTS[key] === 'boolean') return typeof value === 'boolean';
    return CHOICES[key]?.includes(value) === true;
}

export function getOption(key) { return current[key]; }

export function setOption(key, value) {
    if (!(key in OPTION_DEFAULTS) || !isValid(key, value)) return false;
    current[key] = value;
    explicit.add(key);
    try { localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(current)); } catch (e) { /* ignoré */ }
    applyOptions();
    return true;
}

// Niveau d'effets réellement appliqué : 'low' | 'normal' | 'high'.
export function effectsLevel() {
    if (current.reduceFx) return 'low';
    if (current.effects !== 'auto') return current.effects;
    try {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'low';
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory; // Go (indéfini sur certains navigateurs)
        if (cores <= 4 || (memory && memory <= 2)) return 'low';
        if (cores >= 8 && memory && memory >= 6) return 'high';
    } catch (e) { /* détection impossible */ }
    return 'normal';
}

function osReducesMotion() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}

// Animations réellement actives : choix explicite du joueur, sinon réglage du système (prefers-reduced-motion).
export function animationsEnabled() {
    return explicit.has('animations') ? current.animations : !osReducesMotion();
}

// Multiplicateur appliqué aux durées d'animation et aux pauses (1 = normal).
export function animationFactor() { return (SPEED_FACTOR[current.speed] || 1) * (animationsEnabled() ? 1 : 0.3); }

// Nombre maximal de particules de qì par match, selon le niveau d'effets.
export function maxManaParticles() { return { low: 3, normal: 6, high: 10 }[effectsLevel()]; }

// Fait vibrer l'appareil (durée en ms ou motif), sauf si l'option « Vibrations » est coupée ou si l'appareil ne sait pas vibrer.
// `shakeIfUnsupported` : sur un appareil sans vibreur, secoue l'écran à la place (dégâts subis).
// Retourne true si une vibration a été demandée.
export function vibrate(pattern, shakeIfUnsupported = false) {
    if (!current.vibration) return false;
    try {
        const haptics = nativeHaptics();
        if (haptics) return nativeVibrate(haptics, pattern);
        if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') { if (shakeIfUnsupported) shake(); return false; }
        const ok = navigator.vibrate(pattern) !== false;
        if (!ok) notifyBlocked(); else vibrationBlocked = false;
        return ok;
    } catch (e) { return false; }   // vibration refusée (pas de geste utilisateur, mode économie…)
}

// Dans l'APK (Capacitor), le WebView ne vibre pas sans la permission VIBRATE, que n'a pas l'application : on passe par le plugin Haptics
// (installé avec l'APK, il apporte la permission). Aucune exigence de geste de l'utilisateur côté natif.
function nativeHaptics() {
    const c = typeof window !== 'undefined' ? window.Capacitor : null;
    try { return c && typeof c.isNativePlatform === 'function' && c.isNativePlatform() && c.Plugins && c.Plugins.Haptics || null; } catch (e) { return null; }
}
// Motif de `navigator.vibrate` (durée ou [vibre, pause, vibre…]) rejoué en appels Haptics.vibrate({ duration }).
function nativeVibrate(haptics, pattern) {
    const parts = (Array.isArray(pattern) ? pattern : [pattern]).map(Number);
    let at = 0;
    parts.forEach((ms, i) => {
        if (i % 2 === 0 && ms > 0) { const d = Math.min(ms, 1000); setTimeout(() => { try { haptics.vibrate({ duration: d }); } catch (e) { /* plugin absent */ } }, at); }
        at += ms;
    });
    vibrationBlocked = false;
    return true;
}

// Depuis Chrome 60, navigator.vibrate() exige un geste de l'utilisateur (sinon il renvoie false) : tant qu'il n'a rien touché, les vibrations
// déclenchées par le jeu (dégâts, ondes) sont ignorées. Le premier geste (toucher, clic, touche) les arme ; si le navigateur les refuse
// quand même, l'événement `m3:vibration-blocked` invite à les réactiver d'un toucher (main.js).
let vibrationBlocked = false, lastBlockedNotice = 0;
export const isVibrationBlocked = () => vibrationBlocked;
function notifyBlocked() {
    vibrationBlocked = true;
    const now = Date.now();
    if (typeof window === 'undefined' || now - lastBlockedNotice < 60000) return;
    lastBlockedNotice = now;
    window.dispatchEvent(new Event('m3:vibration-blocked'));
}

// À appeler DANS un geste de l'utilisateur : une micro-vibration qui valide l'autorisation. Retourne true si elle est accordée.
export function armVibration() {
    if (!current.vibration || !canVibrate()) return false;
    if (nativeHaptics()) return true;
    try {
        const ok = navigator.vibrate(1) !== false;
        if (ok) vibrationBlocked = false;
        return ok;
    } catch (e) { return false; }
}

// L'appareil sait-il vibrer ? (Absent sur iPhone / iPad et Firefox ordinateur : l'API Vibration n'y existe pas.)
export function canVibrate() {
    return Boolean(nativeHaptics()) || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
}

// À défaut de vibreur : une brève secousse de l'écran (classe `shake` du body, style.css) à la place.
function shake() {
    if (typeof document === 'undefined' || !document.body || effectsLevel() === 'low') return;
    document.body.classList.remove('shake');
    void document.body.offsetWidth;   // relance l'animation
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 320);
}

export function applyOptions() {
    if (typeof document === 'undefined' || !document.body) return;
    const level = effectsLevel();
    document.body.classList.toggle('fx-low', level === 'low');
    document.body.classList.toggle('fx-high', level === 'high' && !current.reduceFx);
    const b = document.body.classList;
    b.toggle('text-large', current.textSize === 'large');
    b.toggle('text-xlarge', current.textSize === 'xlarge');
    b.toggle('a11y-shapes', current.shapes || current.colorblind);   // le mode daltonien impose les symboles
    b.toggle('a11y-colorblind', current.colorblind);
    b.toggle('no-anim', !animationsEnabled());
    b.toggle('fx-reduced', current.reduceFx);
}

load();
// Chaque premier geste de la page arme les vibrations (écouteurs ôtés dès qu'ils ont réussi).
if (typeof window !== 'undefined' && window.addEventListener) {
    const arm = () => { if (armVibration()) ['pointerdown', 'touchend', 'keydown', 'click'].forEach(t => window.removeEventListener(t, arm, true)); };
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach(t => window.addEventListener(t, arm, true));
}

// Diagnostic pour le bouton « Tester » des options : vibre (geste en cours) et dit pourquoi ça ne marche pas le cas échéant.
export function testVibration() {
    const haptics = nativeHaptics();
    if (haptics) { nativeVibrate(haptics, [200, 100, 200]); return { ok: true, message: 'Vibration envoyée (application). Rien ressenti ? Vérifiez les réglages de vibration et le mode silencieux du téléphone.' }; }
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return { ok: false, message: "Ce navigateur n'a pas de vibration (iPhone, iPad, Firefox ordinateur)." };
    const ok = navigator.vibrate([200, 100, 200]);
    if (ok === false) return { ok: false, message: 'Le navigateur refuse la vibration (économie d\'énergie, ou site non autorisé).' };
    return { ok: true, message: 'Vibration envoyée. Rien ressenti ? Le téléphone est peut-être en mode silencieux ou la vibration système coupée (réglages Android > Son et vibration).' };
}
