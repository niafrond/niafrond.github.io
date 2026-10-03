// Écran de chargement plein écran (démarrage du jeu, entrée dans une région dont les dessins ne sont pas encore
// chargés). L'élément #loading-screen est déjà dans index.html, visible dès le départ : il couvre le téléchargement
// des modules ; main.js le masque une fois le jeu prêt.
//
// withLoadingScreen(label, task) n'affiche l'écran que si la tâche dure plus de SHOW_DELAY_MS (pas de clignotement
// pour un chargement instantané) et, une fois affiché, le garde au moins MIN_VISIBLE_MS.

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 450;
const FADE_MS = 250;

let shownAt = 0;
let hideTimer = null;

const screenEl = () => (typeof document === 'undefined' ? null : document.getElementById('loading-screen'));

export function isLoadingScreenVisible() {
    const el = screenEl();
    return Boolean(el && el.classList.contains('visible'));
}

export function showLoadingScreen(label = 'Chargement…') {
    const el = screenEl();
    if (!el) return;
    clearTimeout(hideTimer);
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
export function hideLoadingScreen() {
    const el = screenEl();
    if (!el || !el.classList.contains('visible')) return Promise.resolve();
    setLoadingProgress(1);
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt));
    return new Promise(resolve => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            el.classList.add('closing');
            hideTimer = setTimeout(() => {
                el.classList.remove('visible', 'closing');
                el.setAttribute('aria-hidden', 'true');
                resolve();
            }, FADE_MS);
        }, wait);
    });
}

// Exécute `task(progress)` derrière l'écran de chargement s'il dure ; `progress(ratio)` fait avancer la barre.
export async function withLoadingScreen(label, task) {
    let shown = false;
    const timer = setTimeout(() => { shown = true; showLoadingScreen(label); }, SHOW_DELAY_MS);
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
