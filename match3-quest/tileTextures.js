// Charge les tuiles de terrain GBA (générées par gen-tiles.mjs) et fournit
// des CanvasPattern prêts à l'emploi pour tilePainter.js.
// Fallback silencieux : si une tuile n'est pas disponible, retourne null
// et tilePainter continue avec son rendu procédural habituel.

let tiles = null;

async function loadTiles() {
    if (tiles !== null) return;
    try {
        const mod = await import('./terrain/generated-tiles.js');
        tiles = mod.GBA_TILES ?? {};
    } catch {
        tiles = {};
    }
}

// Démarre le chargement dès l'import du module (non-bloquant)
loadTiles();

// Cache des patterns par clé "biomeId/type/canvasId"
const patternCache = new WeakMap();

function cacheKey(biomeId, type) { return `${biomeId}/${type}`; }

/**
 * Retourne un CanvasPattern (répétable) pour un biome+type donné,
 * ou null si la tuile n'est pas encore chargée / indisponible.
 * Le pattern est mis en cache par contexte canvas.
 */
export function getTilePattern(ctx, biomeId, type) {
    if (!tiles || !biomeId) return null;
    const uri = tiles[biomeId]?.[type];
    if (!uri) return null;

    // Utilise le canvas comme clé WeakMap pour isoler les patterns par contexte
    let ctxCache = patternCache.get(ctx.canvas);
    if (!ctxCache) { ctxCache = {}; patternCache.set(ctx.canvas, ctxCache); }

    const k = cacheKey(biomeId, type);
    if (k in ctxCache) return ctxCache[k]; // null ou pattern

    // L'image n'est pas encore dans le cache → déclenche le chargement
    ctxCache[k] = null; // marque "en cours" pour éviter les rechargements
    const img = new Image();
    img.onload = () => {
        const pattern = ctx.createPattern(img, 'repeat');
        if (pattern) {
            ctxCache[k] = pattern;
            // Force un re-rendu au prochain frame (tilePainter est appelé chaque frame)
        }
    };
    img.src = uri;
    return null;
}

/**
 * Dessine la tuile de texture GBA sur un canvas 2D comme fond de tuile.
 * La texture est mise à l'échelle pour couvrir exactement `size`×`size` pixels.
 * Retourne true si la texture a été dessinée, false sinon.
 */
export function drawTileTexture(ctx, biomeId, type, px, py, size, alpha = 1) {
    const pattern = getTilePattern(ctx, biomeId, type);
    if (!pattern) return false;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pattern;
    // Scale le pattern pour qu'une tuile source (32px) couvre exactement `size` px
    const scale = size / 32;
    const m = new DOMMatrix().scaleSelf(scale, scale);
    pattern.setTransform(m.translateSelf(px / scale, py / scale));
    ctx.fillRect(px, py, size, size);
    ctx.restore();
    return true;
}
