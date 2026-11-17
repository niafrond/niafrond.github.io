// Écran de chargement plein écran (démarrage du jeu, entrée dans une région dont les dessins ne sont pas encore
// chargés). L'élément #loading-screen est déjà dans index.html, visible dès le départ : il couvre le téléchargement
// des modules ; main.js le masque une fois le jeu prêt.
//
// withLoadingScreen(label, task) n'affiche l'écran que si la tâche dure plus de SHOW_DELAY_MS (pas de clignotement
// pour un chargement instantané) et, une fois affiché, le garde au moins MIN_VISIBLE_MS.

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 450;
const FADE_MS = 250;
const CLIP_WAIT_MS = 500;      // attente maximale de la planche d'animation avant d'afficher l'écran sans elle
const CLIP_MIN_VISIBLE_MS = 1400;   // une animation de biome se voit : on la garde un peu plus longtemps

let shownAt = 0;
let hideTimer = null;
let minVisible = MIN_VISIBLE_MS;
let clipRaf = 0;
let clipTimer = 0;
let suppressed = false;   // démarrage : le launcher est à l'écran, le chargement se fait en arrière-plan sans écran de chargement

const screenEl = () => (typeof document === 'undefined' ? null : document.getElementById('loading-screen'));

// Pendant que le launcher est affiché, withLoadingScreen exécute sa tâche sans rien montrer (ni écran, ni animation de biome).
export const setLoadingScreenSuppressed = v => { suppressed = Boolean(v); };
export const isLoadingScreenSuppressed = () => suppressed;

export function isLoadingScreenVisible() {
    const el = screenEl();
    return Boolean(el && el.classList.contains('visible'));
}

// Boucle d'animation en fond de l'écran de chargement : `seq` = { img, frames, fps, size, cols } (planche en grille, voir
// ultimateCinematics.loadSequence). Une seule animation à la fois ; retirée quand l'écran se ferme.
function startClip(el, seq) {
    stopClip(el);
    const cv = document.createElement('canvas');
    cv.className = 'loading-clip pixel-art';
    cv.width = seq.size[0];
    cv.height = seq.size[1];
    cv.setAttribute('aria-hidden', 'true');
    el.insertBefore(cv, el.firstChild);
    el.classList.add('has-clip');
    const ctx = cv.getContext('2d');
    const t0 = performance.now();
    const draw = now => {
        const n = Math.floor((now - t0) / 1000 * seq.fps) % seq.frames;
        ctx.drawImage(seq.img, (n % seq.cols) * seq.size[0], Math.floor(n / seq.cols) * seq.size[1], seq.size[0], seq.size[1], 0, 0, seq.size[0], seq.size[1]);
        // une image par pas de la planche (quelques i/s), pas à chaque rafraîchissement de l'écran : batterie
        clipTimer = setTimeout(() => { clipRaf = requestAnimationFrame(draw); }, Math.max(16, 1000 / (seq.fps || 12) - 8));
    };
    clipRaf = requestAnimationFrame(draw);
}

function stopClip(el) {
    cancelAnimationFrame(clipRaf);
    clearTimeout(clipTimer);
    clipRaf = 0;
    clipTimer = 0;
    el?.querySelector('.loading-clip')?.remove();
    el?.classList.remove('has-clip');
}

export function showLoadingScreen(label = 'Chargement…', clip = null) {
    const el = screenEl();
    if (!el) return;
    clearTimeout(hideTimer);
    if (clip) startClip(el, clip); else if (!el.classList.contains('visible')) stopClip(el);
    minVisible = clip ? CLIP_MIN_VISIBLE_MS : MIN_VISIBLE_MS;
    const text = el.querySelector('.loading-label');
    if (text) text.textContent = label;
    setLoadingProgress(0);
    el.classList.remove('closing');
    if (!el.classList.contains('visible')) shownAt = performance.now();
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
}

export function setLoadingProgress(ratio) {
    const bar = screenEl()?.querySelector('.loading-bar i');
    if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

// Masque l'écran (après le temps minimal d'affichage) ; la promesse se résout quand il a disparu.
export function hideLoadingScreen(immediate = false) {
    const el = screenEl();
    if (!el || !el.classList.contains('visible')) return Promise.resolve();
    setLoadingProgress(1);
    const wait = immediate ? 0 : Math.max(0, minVisible - (performance.now() - shownAt));
    return new Promise(resolve => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            el.classList.add('closing');
            hideTimer = setTimeout(() => {
                el.classList.remove('visible', 'closing', 'boot');
                stopClip(el);
                el.setAttribute('aria-hidden', 'true');
                resolve();
            }, FADE_MS);
        }, wait);
    });
}

// Exécute `task(progress)` derrière l'écran de chargement s'il dure ; `progress(ratio)` fait avancer la barre.
// `clip` (promesse d'une animation, ex. boucle d'arrivée dans un biome) : si elle est prête à temps, l'écran s'affiche tout de suite
// avec elle en fond, au lieu d'attendre SHOW_DELAY_MS.
export async function withLoadingScreen(label, task, clip = null) {
    if (suppressed) return task(() => {});
    let shown = false;
    const seq = clip ? await Promise.race([Promise.resolve(clip).catch(() => null), new Promise(r => setTimeout(r, CLIP_WAIT_MS, null))]) : null;
    const show = () => { shown = true; showLoadingScreen(label, seq); };
    const timer = seq ? (show(), 0) : setTimeout(show, SHOW_DELAY_MS);
    try {
        return await task(ratio => { if (shown) setLoadingProgress(ratio); });
    } finally {
        clearTimeout(timer);
        if (shown) await hideLoadingScreen();
    }
}

// Suit l'avancement d'une liste de promesses : progress(n terminées / total).
export function trackProgress(promises, progress) {
    let done = 0;
    const total = promises.length || 1;
    return Promise.all(promises.map(p => Promise.resolve(p).finally(() => progress(++done / total))));
}
