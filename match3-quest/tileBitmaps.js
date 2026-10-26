// Tuiles du plateau en bitmap. Chaque tuile est un <div> dont le fond est un SVG (≈ 40 primitives vectorielles : cercles tracés, dégradé radial, groupe
// à opacité) découpé en cercle. Le GPU rejoue ce vectoriel pour les 64 tuiles à chaque rastérisation du plateau : mesuré sur GPU (CPU ×4), les ≈ 10
// premières secondes de chaque combat tournent à 6-35 images/s (60 en rendu logiciel) ; sans l'image de fond des tuiles, 60 dès la première seconde.
// Les 8 SVG sont donc rastérisés une seule fois en PNG à la taille exacte d'affichage (taille CSS × densité de pixels) et servent de fond à leur place.
// Le SVG reste en place tant que le bitmap n'est pas prêt, et en cas d'échec (pas de canvas, image illisible).

export const TILE_NAMES = ['red', 'blue', 'green', 'yellow', 'purple', 'combat', 'skull', 'skull5', 'joker'];
export const STYLE_ID = 'tile-bitmaps';
const MIN_PX = 16, MAX_PX = 256;
const RESIZE_DELAY_MS = 250;   // pendant un redimensionnement, on attend que la taille se stabilise avant de refaire les 8 bitmaps

/** Côté du bitmap en pixels écran pour une tuile de `cssPx` pixels CSS. */
export const tileBitmapPx = (cssPx, dpr = 1) => Math.max(MIN_PX, Math.min(MAX_PX, Math.round((Number(cssPx) || 0) * (Number(dpr) || 1))));

/** Règles CSS : même sélecteur que retro.css / index.html (`body.rt .tile.<nom>`), ajoutées après elles, elles l'emportent. */
export const tileBitmapRules = urls => TILE_NAMES.filter(n => urls[n]).map(n => `body.rt .tile.${n}{background-image:url("${urls[n]}")}`).join('');

/**
 * @param env      window (ou un faux en test)
 * @param svgUrl   nom de tuile → URL du SVG
 * @param schedule (fn, ms) → identifiant ; (id) pour annuler : minuterie injectable
 * @returns {{ request(cssPx: number): void, ready: () => Promise<boolean> }}
 */
export function createTileBitmaps(env = globalThis, { svgUrl, schedule = (fn, ms) => setTimeout(fn, ms), cancel = id => clearTimeout(id) } = {}) {
    let current = 0;      // côté (px) des bitmaps actuellement appliqués
    let building = 0;     // côté en cours de fabrication
    let failed = 0;       // dernier côté dont la fabrication a échoué : pas de nouvel essai en boucle
    let wanted = 0;
    let timer = null;
    let lastBuild = Promise.resolve(false);

    const supported = () => Boolean(env.document && env.Image && env.document.createElement && env.document.head);

    async function build(px) {
        const urls = {};
        for (const name of TILE_NAMES) {
            const img = new env.Image();
            img.src = svgUrl(name);
            if (img.decode) await img.decode();
            else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            const canvas = env.document.createElement('canvas');
            canvas.width = canvas.height = px;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });   // logiciel : pas d'attente synchrone du GPU pour toDataURL
            if (!ctx) throw new Error('pas de canvas 2D');
            ctx.drawImage(img, 0, 0, px, px);
            urls[name] = canvas.toDataURL('image/png');
        }
        let style = env.document.getElementById(STYLE_ID);
        if (!style) {
            style = env.document.createElement('style');
            style.id = STYLE_ID;
            env.document.head.appendChild(style);
        }
        style.textContent = tileBitmapRules(urls);
    }

    function run(px) {
        if (!px || px === current || px === building || px === failed || !supported()) return lastBuild;
        building = px;
        lastBuild = build(px).then(() => { current = px; return true; }, () => { failed = px; return false; }).finally(() => {
            building = 0;
            if (wanted && wanted !== current && wanted !== failed) run(wanted);   // la taille a changé pendant la fabrication
        });
        return lastBuild;
    }

    return {
        /** Demande des bitmaps pour une tuile de `cssPx` pixels CSS : tout de suite la première fois, ensuite après stabilisation de la taille. */
        request(cssPx) {
            const px = tileBitmapPx(cssPx, env.devicePixelRatio);
            wanted = px;
            if (timer) { cancel(timer); timer = null; }
            if (!current && !building) { run(px); return; }
            if (px === current) return;
            timer = schedule(() => { timer = null; run(wanted); }, RESIZE_DELAY_MS);
        },
        ready: () => lastBuild,
        get currentPx() { return current; }
    };
}

// Instance du jeu : SVG versionnés comme le reste (`?v=<build>` posé par index.html)
const build = () => (typeof window !== 'undefined' && window.__match3Build) || '0';
const instance = typeof window !== 'undefined'
    ? createTileBitmaps(window, { svgUrl: name => new URL(`./sprites/tiles/tile-${name}.svg?v=${build()}`, import.meta.url).href })
    : null;

export const requestTileBitmaps = cssPx => { if (instance) instance.request(cssPx); };
