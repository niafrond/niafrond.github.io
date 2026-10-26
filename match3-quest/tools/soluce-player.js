// Lecteur de solution des énigmes (page soluce/enigmes.html). Ce fichier n'est pas un module : build-soluce.mjs l'insère dans la page
// après le code du moteur (puzzle/engine.js, modes.js, levels.js, art.js), qui définit puzzleDef, getMode et solvePath.
// Chaque `.pl` porte l'identifiant de l'énigme (`data-puzzle`) ; la solution la plus courte est calculée à la première action sur ce lecteur.
(function () {
    const players = new WeakMap();
    const RING = '#ffe27a';

    function get(root) {
        let p = players.get(root);
        if (p) return p;
        const def = puzzleDef(root.dataset.puzzle), mode = getMode(def.mode), path = solvePath(def);
        const { w, h } = mode.size(path[0]);
        p = {
            mode, path, w, h, i: 0, timer: null,
            svg: root.querySelector('svg.board'), status: root.querySelector('.pl-status'), play: root.querySelector('.pl-play'),
            speed: root.querySelector('.pl-speed'), items: Array.from(root.querySelectorAll('li[data-step]'))
        };
        players.set(root, p);
        return p;
    }

    // Numéros de colonnes (en haut) et de lignes (à gauche) : les étapes écrites s'y réfèrent.
    function labels(w, h) {
        let out = '';
        for (let i = 0; i < w; i++) out += '<text x="' + (i + 0.5) + '" y="-0.15" text-anchor="middle">' + (i + 1) + '</text>';
        for (let i = 0; i < h; i++) out += '<text x="-0.25" y="' + (i + 0.68) + '" text-anchor="middle">' + (i + 1) + '</text>';
        return out;
    }

    function draw(root, index) {
        const p = get(root), n = p.path.length - 1;
        p.i = Math.max(0, Math.min(n, index));
        let state = p.path[p.i], extra = '', text = 'Départ : appuyez sur Lecture, ou avancez coup par coup avec Suivant.';
        if (p.i > 0) {
            const before = p.path[p.i - 1], info = p.mode.describe(before, state);
            if (p.mode.swipeSelects && info && info.id) state = Object.assign({}, state, { sel: info.id });       // le bloc déplacé est cerclé d'or
            if (info && info.col) extra = '<rect x="' + (info.col - 1 + 0.04) + '" y="' + (info.row - 1 + 0.04) + '" width="0.92" height="0.92" rx="0.1" fill="none" stroke="' + RING + '" stroke-width="0.09"/>';
            text = 'Étape ' + p.i + ' sur ' + n + ' : ' + p.mode.say(before, p.path[p.i]) + (p.i === n ? ' — énigme résolue.' : '');
        }
        p.svg.innerHTML = '<style>text{font:0.42px system-ui,sans-serif;fill:#7a6a4a}</style>' + labels(p.w, p.h) + p.mode.render(state) + extra;
        p.status.textContent = text;
        p.items.forEach(function (li, k) { li.classList.toggle('cur', k + 1 === p.i); li.classList.toggle('done', k + 1 < p.i); });
        const cur = p.items[p.i - 1];
        if (cur && cur.closest('details') && cur.closest('details').open) cur.scrollIntoView({ block: 'nearest' });
    }

    function pause(root) {
        const p = get(root);
        clearTimeout(p.timer);
        p.timer = null;
        p.play.textContent = 'Lecture';
    }

    function play(root) {
        const p = get(root), n = p.path.length - 1;
        if (p.timer) { pause(root); return; }
        if (p.i >= n) draw(root, 0);
        p.play.textContent = 'Pause';
        const tick = function () {
            draw(root, p.i + 1);
            if (p.i >= n) pause(root); else p.timer = setTimeout(tick, Number(p.speed.value));   // la vitesse choisie s'applique dès le coup suivant
        };
        p.timer = setTimeout(tick, Number(p.speed.value));
    }

    document.querySelectorAll('.pl').forEach(function (root) { root.querySelector('.pl-bar').hidden = false; });
    document.addEventListener('click', function (e) {
        const li = e.target.closest('.pl li[data-step]');
        if (li) { const root = li.closest('.pl'); pause(root); draw(root, Number(li.dataset.step)); return; }
        const b = e.target.closest('.pl button[data-act]');
        if (!b) return;
        const root = b.closest('.pl'), p = get(root);
        switch (b.dataset.act) {
            case 'start': pause(root); draw(root, 0); break;
            case 'prev': pause(root); draw(root, p.i - 1); break;
            case 'next': pause(root); draw(root, p.i + 1); break;
            case 'play': play(root); break;
        }
    });
})();
