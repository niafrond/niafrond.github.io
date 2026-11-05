// Mode Chang'e de la vue d'exploration : épisodes, miroir, soins, arrivée des PNJ, fin de la légende.
// Extrait de explorationView.js : fabrique appelée une fois par createExplorationView, `env` donne accès à l'état partagé de la vue.
import * as X from './exploration.js';
import { playSfx } from './sound.js';
import { openHeal, playMirror } from './change/view.js';
import { episodeById } from './change/data.js';
import { playEndingAnimation, playCredits } from './cinematics.js';
import { loadGbaSprites } from './sprites/index.js';
import { icon } from './icons.js';

export function createChangeFlow(env) {
    const { cfg } = env;
    const { root, vis } = env;
    // ── Mode Chang'e (change/) ───────────────────────────────────────────────────────────────────────────────────────
    // Chang'e explore le village comme Hou Yi (mêmes déplacements, même carte) mais ne peut pas le quitter : le narrateur rappelle qu'il reste du
    // monde à soigner. Toucher un blessé ouvre son puzzle (change/view.js) ; tous soignés : conversation de sortie, retour par le miroir.
    const sfxSafe = name => { try { playSfx(name); } catch { /* le son est facultatif */ } };
    const talkLines = (who, lines) => new Promise(resolve => env.openDialog(
        who === 'hou' ? env.sceneSpeaker({ hero: true }) : env.sceneSpeaker({ npc: 'change', name: "Chang'e", title: 'par le miroir' }), lines, resolve));
    // Conversation à travers le miroir : les répliques sont groupées par locuteur, dites l'une après l'autre.
    async function talkThroughMirror(lines) {
        for (let i = 0; i < lines.length;) {
            let j = i;
            while (j < lines.length && lines[j].who === lines[i].who) j++;
            await talkLines(lines[i].who, lines.slice(i, j).map(l => l.text));
            i = j;
        }
    }
    const narrate = (title, lines) => new Promise(resolve => env.openDialog({ ...env.NARRATOR, title }, lines, resolve));
    const changeEpisode = () => X.changeEpisodeOf(env.session);

    // Remet la caméra et l'état de marche sur la case du héros (après une téléportation : arrivée au village, retour de Hou Yi).
    function resetViewTo() {
        vis.px = env.session.data.x; vis.py = env.session.data.y; vis.cx = vis.px; vis.cy = vis.py;
        vis.trail = null; vis.amb = {}; env.held = null; env.walk = null;
    }
    async function finishChange(done, completed) {
        await playMirror(root, 'mirror-out.gif', sfxSafe);
        X.endChangeMode(env.session, { done });
        env.changeFarewell = false;
        resetViewTo();
        await env.prepareRegion(X.currentScreen(env.session).region).catch(() => {});
        env.refreshHud();
        cfg.onSave();
        const resolve = env.changeEnd; env.changeEnd = null;
        resolve?.({ completed });
    }
    async function concludeChange() {
        const ep = changeEpisode();
        if (!ep) return;
        if (X.changeIsReplay(env.session)) {   // rejeu : pas de conversation avec Hou Yi (ni, à l'épisode 3, d'adieu : le miroir ne se coupe qu'une fois)
            await narrate('Le miroir', [`Tout le monde est de nouveau sur pied à ${ep.village}. Le reflet se referme.`]);
            await finishChange(true, true);
            return;
        }
        if (ep.finale) env.changeFarewell = true;
        await talkThroughMirror(ep.outro);
        if (ep.finale) { sfxSafe('change-cut'); await narrate('Le miroir', [ep.finale]); }
        await finishChange(true, true);
    }
    // Le miroir de la maison de Hou Yi et Chang'e : y regarder propose de revoir un épisode terminé ou de reprendre celui resté ouvert.
    function openHouseMirror() {
        const opts = X.changeReplayOptions(env.session);
        if (!opts.length) {
            // avant le premier épisode, Hou Yi lui-même s'étonne : le miroir préféré de Chang'e a quelque chose d'irréel
            env.openDialog(env.sceneSpeaker({ hero: true }), ['Le miroir favori de Chang\'e… Il a une lueur irréelle.']);
            return;
        }
        env.openDialog({ ...env.NARRATOR, title: 'Le miroir' }, ['Le bronze garde le reflet des villages que Chang\'e a soignés. Y regarder, c\'est y retourner.'], null, [
            // « new » : le soleil est tombé avant le mode Chang'e, l'épisode n'a jamais été joué : il commence comme au premier jour (conversation avec Hou Yi comprise)
            ...opts.map(o => ({ label: `${{ resume: 'Reprendre', replay: 'Revoir', new: 'Découvrir' }[o.kind]} : ${o.village}`, run: () => { startChangeEpisode(o.episode, { resume: o.kind !== 'new' }); } })),
            { label: 'Plus tard', run: () => {} }
        ]);
    }
    // Ouvre le soin d'un blessé (ou rappelle son remerciement s'il est déjà soigné).
    function openHealFor(npcId) {
        const ep = changeEpisode();
        const npc = ep?.injured.find(n => n.id === npcId);
        const amb = !npc && X.changeAmbientOf(env.session, npcId);   // habitant de passage : sa réplique, sans puzzle
        if (amb) { env.openDialog(env.sceneSpeaker({ npc: amb.id, name: amb.name }), [amb.line]); return; }
        if (!npc || env.healView) return;
        if (env.session.data.change.healed.includes(npcId)) {
            env.openDialog(env.sceneSpeaker({ npc: npcId, name: npc.name }), [npc.thanks]);
            return;
        }
        env.held = null; env.walk = null;
        env.healView = openHeal(root, {
            npc, data: env.session.data.change, save: () => cfg.onSave(), sfx: sfxSafe,
            onClose: ({ won }) => {
                env.healView = null;
                env.refreshHud();
                if (won && ep.injured.every(n => env.session.data.change.healed.includes(n.id))) afterDialogs(() => concludeChange());
            }
        });
    }
    // Chang'e touche une sortie du village : elle reste.
    function changeStay() {
        if (Date.now() - env.stayAt < 1500 || env.isDialogOpen()) return;
        env.stayAt = Date.now();
        env.openDialog({ ...env.NARRATOR, title: "Chang'e" }, ["Il reste du monde à soigner ici. Chang'e ne quittera pas le village tant que ses habitants ne seront pas remis sur pied."]);
    }
    // Bouton miroir : en mode Chang'e, retour auprès de Hou Yi (après confirmation, les soins sont conservés) ; sinon, reprise d'un épisode inachevé.
    function askMirror() {
        if (env.healView) return;
        if (X.inChangeMode(env.session)) {
            const ep = changeEpisode();
            env.openDialog({ ...env.NARRATOR, title: 'Le miroir' }, [`Revenir auprès de Hou Yi ? Les soins déjà faits sont conservés ; les autres habitants de ${ep.village} vous attendront.`], null, [
                { label: 'Oui, revenir', run: () => { finishChange(false, false); } },
                { label: 'Rester', run: () => {} }
            ]);
            return;
        }
        const n = X.pendingChangeEpisode(env.session);
        const ep = n && episodeById(n);
        if (!ep) return;
        env.openDialog({ ...env.NARRATOR, title: 'Le miroir' }, [`Le bronze s'éclaire : Chang'e est à ${ep.village}, au milieu de ceux qu'elle soigne. Regarder dans le miroir ?`], null, [
            { label: 'Regarder dans le miroir', run: () => { startChangeEpisode(n, { resume: true }); } },
            { label: 'Plus tard', run: () => {} }
        ]);
    }
    // Ouvre l'épisode `n` : conversation d'entrée (sauf reprise par le bouton miroir), transition, arrivée de Chang'e dans le village. Se résout à la fin du mode.
    async function startChangeEpisode(n, { resume = false } = {}) {
        const ep = episodeById(n);
        if (!ep || X.inChangeMode(env.session) || env.changeEnd) return { completed: false };
        await loadGbaSprites(['change', 'change_jouable', ...ep.injured.map(p => p.id), cfg.getHero().classId]).catch(() => {});
        if (!resume) await talkThroughMirror(ep.intro);
        await playMirror(root, 'mirror-in.gif', sfxSafe);
        const screen = X.startChangeMode(env.session, n);
        if (!screen) return { completed: false };
        resetViewTo();
        await env.prepareRegion(screen.region).catch(() => {});
        env.refreshHud();
        cfg.onSave();
        const done = new Promise(resolve => { env.changeEnd = resolve; });
        if (!resume && ep.arrival) await talkLines('change', ep.arrival.map(l => l.text));   // épisode 1 : la goutte d'élixir qui lui donne le don de soigner
        else env.toast(`Chang'e est à ${ep.village} : touchez les blessés pour les soigner.`, 4500);
        if (ep.injured.every(p => env.session.data.change.healed.includes(p.id))) afterDialogs(() => concludeChange());
        return done;
    }

    // Arrivée d'un PNJ (`arrival`) : il part du bord de la carte, rejoint le héros en sautillant, puis sa conversation s'ouvre ;
    // ensuite il retourne en sautillant à sa place. Position et saut sont purement visuels (vis.npcAnim), rien n'est sauvegardé.
    const NPC_HOP_SPEED = 4.2;   // cases par seconde
    function hopNpcTo(npc, from, to, blocking) {
        return new Promise(resolve => {
            vis.npcAnim = { id: npc.id, x: from.x, y: from.y, tx: to.x, ty: to.y, phase: 0, blocking, resolve };
        });
    }
    async function playNpcArrival(npcId) {
        const screen = X.currentScreen(env.session);
        const npc = screen.npcs.find(n => n.id === npcId);
        if (!npc || !env.isOnScreen()) { X.beginNpcArrival(env.session, npcId); return; }
        const hx = env.session.data.x, hy = env.session.data.y;
        const free = (x, y) => x >= 0 && y >= 0 && x < screen.w && y < screen.h && !X.isTerrainBlocked(screen, x, y)
            && !X.visibleNpcs(env.session).some(n => n.x === x && n.y === y) && !X.aliveEnemies(env.session).some(e => e.x === x && e.y === y);
        const spot = [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]].map(([dx, dy]) => ({ x: hx + dx, y: hy + dy })).find(p => free(p.x, p.y))
            || { x: npc.x, y: npc.y };
        // Départ : à l'écart du héros, côté le plus éloigné du bord (il traverse donc l'écran en sautillant).
        const fromLeft = hx > screen.w / 2;
        const start = { x: fromLeft ? Math.max(0, hx - 9) : Math.min(screen.w - 1, hx + 9), y: Math.min(screen.h - 1, Math.max(0, hy + 2)) };
        X.beginNpcArrival(env.session, npcId);
        await hopNpcTo(npc, start, spot, true);
        if (!env.active) { vis.npcAnim = null; return; }
        const home = { x: npc.x, y: npc.y };
        vis.npcAnim = { ...vis.npcAnim, x: spot.x, y: spot.y, tx: spot.x, ty: spot.y, blocking: false, resolve: null, idle: true };
        env.handleResult({ type: 'talk', npcId });
        afterDialogs(async () => {
            if (!env.active) { vis.npcAnim = null; return; }
            await hopNpcTo(npc, spot, home, false);
            vis.npcAnim = null;
        });
    }

    // Exécute `fn` quand la file de dialogues est vide (tout de suite si aucun dialogue n'est ouvert).
    function afterDialogs(fn) {
        const last = env.dialogQueue[env.dialogQueue.length - 1];
        if (!last) { fn(); return; }
        const prev = last.after;
        last.after = () => { prev?.(); fn(); };
    }

    // Fin de la légende : animation de fin, générique, puis le choix entre continuer la partie et la Nouvelle Partie +.
    async function playLegendEnd() {
        await playEndingAnimation();
        await playCredits();
        env.openDialog({ ...env.NARRATOR, title: 'La légende continue' }, [
            "Votre histoire s'achève, mais le monde, lui, reste ouvert : les soleils dorment, les routes sont sûres, l'Arène des Mille Flèches vous attend.",
            "Continuez à parcourir les terres à votre rythme, ou exportez votre sauvegarde dans un fichier pour entamer la Nouvelle Partie + : l'histoire repart des Rizières, vous gardez tout votre équipement, et l'arène est ouverte dès le début."
        ], null, [
            { label: 'Continuer ma partie', run: () => { env.toast('Le monde est à vous : la Nouvelle Partie + reste disponible dans le carnet.', 5000); } },
            { label: 'Exporter ma sauvegarde et lancer la Nouvelle Partie +', run: () => env.launchNewGamePlus() }
        ]);
    }

    const kindBadge = quest => quest.side
        ? `<span class="quest-badge side" title="Quête annexe">${icon('scroll')} Annexe</span>`
        : `<span class="quest-badge main" title="Quête principale">${icon('star')} Principale</span>`;

    // Après l'activation d'une quête : si une autre quête est déjà suivie, le joueur choisit laquelle suivre.
    function proposeTracking(quest) {
        const p = X.trackProposal(env.session, quest);
        if (!p || p.mode !== 'ask') return;
        env.openDialog({ ...env.NARRATOR, title: 'Suivre cette quête ?' }, [
            `« ${p.quest.title} » vient d'être activée. Vous suivez actuellement « ${p.current.title} ».`
        ], null, [
            { label: 'Suivre cette quête', run: () => { X.setTrackedQuest(env.session, p.quest.id); env.toast(`Quête suivie : ${p.quest.title}`); cfg.onSave(); env.refreshHud(); } },
            { label: 'Rester sur la quête actuelle', run: () => { env.toast(`Quête suivie : ${p.current.title}`); } }
        ]);
    }

    function eventsSpoken(events) {
        return new Set(events.filter(e => e.quest).map(e => e.quest.id));
    }

    return { NPC_HOP_SPEED, afterDialogs, askMirror, changeStay, eventsSpoken, kindBadge, openHealFor, openHouseMirror, playLegendEnd, playNpcArrival, proposeTracking, startChangeEpisode };
}
