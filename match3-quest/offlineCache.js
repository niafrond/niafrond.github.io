// Jeu hors ligne : enregistrement du service worker (sw.js) qui sert le jeu depuis le téléphone. Le pré-téléchargement des musiques et dessins
// en arrière-plan viendra s'ajouter ici. Tout est inoffensif si le navigateur n'a pas de service worker (file://, navigateur ancien).

/** URL d'enregistrement : le suffixe `?v=<build>` (celui des modules, voir index.html) change à chaque release, donc installe un nouveau service worker. */
export const serviceWorkerUrl = build => `./sw.js?v=${encodeURIComponent(build)}`;

export function canUseServiceWorker(env = globalThis) {
    const nav = env.navigator;
    return Boolean(nav && 'serviceWorker' in nav && env.isSecureContext !== false && env.location && /^https?:$/.test(env.location.protocol));
}

/** Enregistre le service worker ; retourne l'enregistrement, ou null (build inconnu, navigateur sans service worker, échec). Ne lève jamais. */
export async function registerServiceWorker(env = globalThis) {
    const build = String(env.__match3Build || '0');
    if (build === '0' || !canUseServiceWorker(env)) return null;   // '0' : version.js illisible (hors ligne sans cache, file://)
    try {
        return await env.navigator.serviceWorker.register(serviceWorkerUrl(build), { scope: './' });
    } catch (e) {
        return null;
    }
}

/** Enregistre une fois la page chargée, pour ne pas concurrencer le démarrage du jeu. */
export function registerServiceWorkerWhenLoaded(env = globalThis) {
    const doc = env.document;
    if (!doc || doc.readyState === 'complete') return registerServiceWorker(env);
    env.addEventListener('load', () => { registerServiceWorker(env); }, { once: true });
    return Promise.resolve(null);
}
