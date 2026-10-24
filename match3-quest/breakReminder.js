// Rappel de pause : une popup bienveillante après 1 h de jeu continu, puis toutes les 30 min.
// Le message se compose d'une accroche, d'un corps (humour ou douceur) et d'une conclusion rassurante, plus une petite phrase.

export const FIRST_BREAK_SECONDS = 60 * 60;
export const NEXT_BREAK_SECONDS = 30 * 60;

// Prochain seuil (en secondes de jeu de la session) après `shownAt` rappels déjà affichés.
export const breakThreshold = shownCount => FIRST_BREAK_SECONDS + shownCount * NEXT_BREAK_SECONDS;

// « 1 h », « 1 h 30 », « 2 h »… arrondi à la demi-heure inférieure, pour un texte naturel.
export function breakDurationLabel(seconds) {
    const halfHours = Math.max(1, Math.floor(seconds / 1800));
    const h = Math.floor(halfHours / 2);
    if (!h) return '30 min';
    return halfHours % 2 ? `${h} h 30` : `${h} h`;
}

const HOOKS = [
    d => `Ça fait ${d} que tu joues !`,
    d => `${d} de jeu, déjà !`,
    d => `Tu es là depuis ${d}.`,
    d => `${d} de jeu non-stop ?!`,
    d => `Nouveau record débloqué : ${d} de jeu !`,
    d => `Ça fait ${d} que tu explores notre univers !`,
];

const BODIES = [
    'Et si tu prenais une petite pause ?',
    'Même les personnages secondaires ont eu le temps de faire une pause. Va te dégourdir les jambes !',
    'Petit rappel : tu es un humain, pas un PC gaming. Bois un verre d’eau, étire-toi un peu et repose tes yeux.',
    'Tu peux souffler un peu, promis, rien ne va disparaître pendant ton absence.',
    'Tout va bien de ton côté ? Nous, ça va, mais tes jambes aimeraient peut-être te revoir !',
    'Récompense : le droit de faire une pause bien méritée.',
    'Prends quelques minutes pour toi : bois, respire, bouge un peu.',
    'Le comité officiel de tes jambes réclame une réunion d’urgence. Motif : immobilité prolongée. Décision : petite balade recommandée.',
    'C’est chouette de t’avoir avec nous, mais n’oublie pas le monde extérieur : il a aussi quelques quêtes secondaires intéressantes.',
    'Batterie du joueur : niveau critique. Pense à recharger ton énergie avec une pause, un peu d’eau et quelques pas.',
    'Le temps file quand on s’amuse. Va prendre l’air quelques instants.',
    'Message officiel du ministère des pauses. Une pause est fortement conseillée. Aucun contrôle surprise à la sortie : prends soin de toi, citoyen !',
];

const CONCLUSIONS = [
    'Rien n’est perdu, ta progression t’attend sagement.',
    'Le jeu reste gratuit et ne va pas s’enfuir.',
    'On garde ta place au chaud : ton aventure reprendra quand tu voudras.',
    'Aucun objet perdu, aucun abonnement requis.',
    'On sera toujours là à ton retour !',
];

const PUNCHLINES = [
    'Tes yeux méritent mieux qu’un écran en gros plan.',
    'Même les boss ont des phases de repos.',
    'Une pause maintenant, une meilleure partie ensuite !',
    'Va vérifier que le soleil existe toujours.',
    'Ta chaise commence à se poser des questions.',
    'Sauvegarde ta bonne humeur : prends une pause !',
    'Pas besoin de quitter le jeu pour toujours. Juste quelques minutes pour toi.',
    'La vraie vie n’a pas de bouton Pause, alors profite-en un peu.',
    'Ton prochain succès : boire un verre d’eau.',
    'Le jeu est gratuit, mais ton temps est précieux.',
];

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// { hook, body, conclusion, punchline } pour `seconds` de jeu ; `rng` renvoie un nombre dans [0, 1[.
export function buildBreakMessage(seconds, rng = Math.random) {
    const duration = breakDurationLabel(seconds);
    return {
        hook: pick(HOOKS, rng)(duration),
        body: pick(BODIES, rng),
        conclusion: pick(CONCLUSIONS, rng),
        punchline: pick(PUNCHLINES, rng),
    };
}

export const BREAK_VARIANT_COUNT = HOOKS.length * BODIES.length * CONCLUSIONS.length * PUNCHLINES.length;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Affiche la popup ; renvoie l'élément (ou null s'il y en a déjà une).
export function showBreakReminder(seconds, rng = Math.random) {
    if (document.getElementById('break-reminder-modal')) return null;
    const m = buildBreakMessage(seconds, rng);
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'break-reminder-modal';
    modal.innerHTML = `<div class="modal-content">
        <h2>Petite pause ?</h2>
        <p><strong>${esc(m.hook)}</strong></p>
        <p>${esc(m.body)}</p>
        <p>${esc(m.conclusion)}</p>
        <p><em>${esc(m.punchline)}</em></p>
        <div class="modal-actions"><button class="primary" id="break-reminder-close">Continuer à jouer</button></div>
    </div>`;
    document.body.appendChild(modal);
    // Fermeture facile, sans obligation de faire une pause : bouton, clic à côté de la fenêtre ou Échap.
    const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    modal.querySelector('#break-reminder-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', onKey);
    return modal;
}

// Surveille le temps de jeu de la session (secondes, page visible). `isCalm()` doit renvoyer true hors combat / dialogue :
// le rappel attend un moment calme (jamais en plein combat ou puzzle). Fermer la popup ne touche pas au compteur de session. Renvoie la fonction à appeler chaque seconde.
export function createBreakWatcher({ isCalm = () => true, show = showBreakReminder } = {}) {
    let session = 0;
    let shown = 0;
    let last = Date.now();
    return function tick(now = Date.now()) {
        const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
        if (visible) session += Math.min(now - last, 5000) / 1000;   // plafond : une veille ne compte pas
        last = now;
        if (session >= breakThreshold(shown) && isCalm()) {
            show(session);
            shown += 1;
            // Si la session a beaucoup dépassé le seuil (calme tardif), on saute les rappels manqués.
            while (session >= breakThreshold(shown)) shown += 1;
        }
        return session;
    };
}
