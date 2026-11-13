// Carnet de voyage de la vue d'exploration : onglets quêtes, voyage rapide, progression, bestiaire.
// Extrait de explorationView.js : fabrique appelée une fois par createExplorationView, `env` donne accès à l'état partagé de la vue.
import { getStuffById } from './stuff.js';
import { STORY_TITLE } from './story.js';
import * as X from './exploration.js';
import { worldZones } from './worldMap.js';
import { gbaSprite } from './sprites/index.js';
import { icon, manaIcon } from './icons.js';
import { enemyCatalogList } from './enemies.js';
import { bestiaryEntries, SOURCE_LABELS, creaturePlaces, matchesBestiary } from './bestiary.js';
import { SCREENS } from './story.js';
import { MANA_COLORS, elementName } from './elements.js';

export function createCarnet(env) {
    const { cfg } = env;
    const { root } = env;
    // ── Carnet de voyage : quêtes (suivi), voyage rapide, progression (le bestiaire a son propre onglet) ──────
    const REGION_LABEL = Object.fromEntries(worldZones.map(z => [z.id, z.shortName]));
    const carnet = { tab: 'quests', filter: 'all', region: 'all', travelRegion: null };
    const STATUS_LABEL = { available: `${icon('talk')} À démarrer`, active: `${icon('target')} En cours`, ready: `${icon('check')} À rendre`, done: `${icon('flag')} Terminée` };
    const STATUS_ORDER = { ready: 0, active: 1, available: 2, done: 3 };

    function questsPanel() {
        const all = X.journalEntries(env.session);
        const regions = [...new Set(all.map(e => e.region).filter(Boolean))];
        if (carnet.region !== 'all' && !regions.includes(carnet.region)) carnet.region = 'all';
        const counts = {
            main: all.filter(e => !e.quest.side && e.status !== 'done').length,
            side: all.filter(e => e.quest.side && e.status !== 'done').length,
            done: all.filter(e => e.status === 'done').length
        };
        const entries = all
            .filter(e => carnet.filter === 'all' ? e.status !== 'done'
                : carnet.filter === 'main' ? !e.quest.side && e.status !== 'done'
                    : carnet.filter === 'side' ? e.quest.side && e.status !== 'done' : e.status === 'done')
            .filter(e => carnet.region === 'all' || e.region === carnet.region)
            .sort((a, b) => Number(b.tracked) - Number(a.tracked) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        const chip = (key, label) => `<button type="button" class="carnet-chip${carnet.filter === key ? ' on' : ''}" data-filter="${key}">${label}</button>`;
        const reward = r => [r.gold ? `${icon('coin')} ${r.gold}` : '', r.xp ? `${icon('star')} ${r.xp} XP` : '', r.fragment ? `${icon('puzzle')} ${env.escapeHtml(r.fragment)}` : '', r.stuff ? `${icon('shield')} ${env.escapeHtml(getStuffById(r.stuff)?.name || 'Stuff')}` : ''].filter(Boolean).join(' · ');
        return `
            <div class="carnet-filters">
                ${chip('all', 'En cours')}${chip('main', `Principale (${counts.main})`)}${chip('side', `Annexes (${counts.side})`)}${chip('done', `Terminées (${counts.done})`)}
            </div>
            <select class="carnet-region" aria-label="Région">
                <option value="all">Toutes les régions</option>
                ${regions.map(r => `<option value="${r}"${carnet.region === r ? ' selected' : ''}>${env.escapeHtml(REGION_LABEL[r] || r)}</option>`).join('')}
            </select>
            <div class="explore-journal-list">
            ${entries.length === 0 ? '<p>Aucune quête dans cette liste. Parlez aux villageois, entrez dans les maisons.</p>' : entries.map(e => `
                <div class="explore-quest ${e.status}${e.tracked ? ' tracked' : ''}">
                    <div class="explore-quest-head"><b>${e.tracked ? `${icon('check')} ` : ''}${env.escapeHtml(e.quest.title)}</b> ${env.kindBadge(e.quest)} <span>${STATUS_LABEL[e.status] || ''}</span></div>
                    <div class="explore-quest-chapter">${env.escapeHtml(e.quest.chapter)}${e.region && REGION_LABEL[e.region] ? ` · ${env.escapeHtml(REGION_LABEL[e.region])}` : ''}</div>
                    ${e.status === 'available'
                        ? `<div class="explore-quest-where">${icon('talk')} Parlez à ${env.escapeHtml(e.giverName || 'un PNJ')}${e.giverPlace ? ` (${env.escapeHtml(e.giverPlace)})` : ''}</div>`
                        : `<ul>${e.objectives.map(o => `<li class="${o.done ? 'done' : ''}">${o.done ? icon('check') : '○'} ${env.escapeHtml(o.text)}</li>`).join('')}</ul>`}
                    ${e.where && e.status !== 'done' && e.status !== 'available' ? `<div class="explore-quest-where">${icon('pin')} ${env.escapeHtml(e.where)}</div>` : ''}
                    ${e.quest.reward ? `<div class="explore-quest-reward">${reward(e.quest.reward)}</div>` : ''}
                    ${e.status === 'done' ? '' : `<button type="button" class="carnet-track" data-track="${e.tracked ? '' : e.quest.id}">${e.tracked ? 'Ne plus suivre' : `${icon('star')} Suivre`}</button>`}
                </div>`).join('')}
            </div>`;
    }

    function travelPanel() {
        const stones = X.waypointList(env.session);
        if (stones.length === 0) return '<p>Aucune pierre de voyage activée. Touchez une pierre de voyage dans un village ou en chemin.</p>';
        if (!X.nearWaypoint(env.session)) {
            return `<p class="carnet-hint">${icon('stone')} Le voyage rapide n'est possible que depuis une borne de voyage. Approchez-vous d'une pierre de voyage (dans chaque village, au milieu des terres sauvages et à l'entrée des sanctuaires), puis touchez-la.</p>`;
        }
        const byRegion = new Map();
        stones.forEach(w => { if (!byRegion.has(w.region)) byRegion.set(w.region, []); byRegion.get(w.region).push(w); });
        const kindIcon = { village: icon('village'), wild: icon('leafWild'), sanctuary: icon('sun') };
        const chosen = byRegion.has(carnet.travelRegion) ? carnet.travelRegion : null;
        const biomes = `<div class="carnet-travel-biomes">${[...byRegion.entries()].map(([region, list]) =>
            `<button type="button" class="carnet-chip carnet-travel-biome${region === chosen ? ' active' : ''}" data-travel-region="${region}">${env.escapeHtml(REGION_LABEL[region] || region)} <small>(${list.length})</small></button>`).join('')}</div>`;
        const list = chosen ? `<div class="carnet-travel-region"><h4>${env.escapeHtml(REGION_LABEL[chosen] || chosen)}</h4>
            ${byRegion.get(chosen).map(w => `<button type="button" class="carnet-travel-btn" data-travel="${w.screenId}"${w.current ? ' disabled' : ''}>
                ${kindIcon[w.kind] || icon('stone')} ${env.escapeHtml(w.screenName)}${w.current ? ' <small>(vous êtes ici)</small>' : ''}</button>`).join('')}</div>`
            : '<p class="carnet-hint">Choisissez un biome pour voir ses pierres de voyage.</p>';
        return `<p class="carnet-hint">Borne de voyage ${icon('stone')} : choisissez une destination.</p>${biomes}<div class="carnet-travel">${list}</div>`;
    }

    function progressPanel() {
        const rows = X.regionProgress(env.session).filter(r => r.visited);
        const bar = (n, total) => `<span class="carnet-bar"><i style="width:${total ? Math.round(100 * n / total) : 0}%"></i></span> ${n}/${total}`;
        return `<div class="carnet-progress">${rows.map(r => `
            <div class="carnet-progress-row"><b>${env.escapeHtml(REGION_LABEL[r.region] || r.region)}</b>
                <div>${icon('chest')} Coffres ${bar(r.chestsOpened, r.chestsTotal)}</div>
                <div>${icon('scroll')} Annexes ${bar(r.sideDone, r.sideTotal)}</div>
                <div>${icon('stone')} Pierres ${bar(r.stonesFound, r.stonesTotal)}</div>
            </div>`).join('')}</div>`;
    }

    // Bestiaire (onglet dédié, voir bestiaryHtml) : créatures croisées en combat ou observées, avec force, faiblesse et notice mythologique (bestiary.js).
    // Filtres (recherche, famille, résistance, faiblesse, zone, boss) : appliqués sur le DOM (attribut `hidden`) par bindBestiary, sans rendu complet.
    const beastFilter = { q: '', family: '', resist: '', weak: '', zone: '', boss: false };
    function bestiaryPanel() {
        const { entries, known, total } = bestiaryEntries(enemyCatalogList(), env.session.data.bestiary);
        const head = `<p class="carnet-hint">${icon('book')} ${known}/${total} créatures connues. Combattez ou observez une créature (immobile près d'elle) pour l'inscrire.</p>`;
        if (entries.length === 0) return `${head}<p>Aucune créature dans le bestiaire pour l'instant.</p>`;
        const element = (color, label) => color ? `${manaIcon(color)} ${env.escapeHtml(label || color)}` : '?';
        const places = creaturePlaces(SCREENS);
        const esc = env.escapeHtml;
        const opts = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('');
        const colors = MANA_COLORS.map(c => [c, elementName(c)]);
        const families = [...new Set(entries.map(e => e.family))].sort((a, b) => a.localeCompare(b, 'fr')).map(f => [f, f]);
        // zones des seules créatures connues, groupées par région
        const zoneIds = new Set(entries.flatMap(e => [...(places.get(e.id)?.zones || [])]));
        const byRegion = new Map();
        [...zoneIds].filter(id => SCREENS[id]).forEach(id => {
            const r = SCREENS[id].region || id;
            (byRegion.get(r) || byRegion.set(r, []).get(r)).push(id);
        });
        const zoneOpts = [...byRegion.entries()].map(([r, ids]) => `<optgroup label="${esc(REGION_LABEL[r] || SCREENS[r]?.name || r)}">${opts(ids.sort((a, b) => SCREENS[a].name.localeCompare(SCREENS[b].name, 'fr')).map(id => [id, SCREENS[id].name]), beastFilter.zone)}</optgroup>`).join('');
        const sel = (key, label, options, all) => `<label class="carnet-bf">${label}<select data-bf="${key}"><option value="">${all}</option>${options}</select></label>`;
        const filters = `<div class="carnet-bfilters">
            <input type="search" class="carnet-bsearch" data-bf="q" value="${esc(beastFilter.q)}" placeholder="Rechercher une créature…" autocomplete="off" aria-label="Rechercher dans le bestiaire">
            ${sel('family', 'Famille', opts(families, beastFilter.family), 'Toutes')}
            ${sel('resist', 'Résiste à', opts(colors, beastFilter.resist), 'Toutes')}
            ${sel('weak', 'Faible à', opts(colors, beastFilter.weak), 'Toutes')}
            ${sel('zone', 'Zone', zoneOpts, 'Toutes')}
            <label class="carnet-bf carnet-bf-check"><input type="checkbox" data-bf="boss"${beastFilter.boss ? ' checked' : ''}> Boss seulement</label>
            <button type="button" class="carnet-chip" data-bf-reset>Réinitialiser</button>
        </div>
        <p class="carnet-hint carnet-bcount" role="status" aria-live="polite"></p>`;
        return `${head}${filters}<div class="carnet-bestiary">${entries.map(e => {
            const img = gbaSprite(e.id, 'front');
            const pl = places.get(e.id);
            const data = `data-name="${esc(`${e.name} ${e.pinyin} ${e.hanzi} ${e.title} ${e.race}`.toLowerCase())}" data-family="${esc(e.family)}" data-resist="${e.strongColor || ''}" data-weak="${e.weakColor || ''}" data-zones="${esc([...(pl?.zones || [])].join(' '))}" data-boss="${pl?.boss ? 1 : ''}"`;
            return `
            <div class="carnet-beast" ${data}>
                <div class="carnet-beast-head">
                    ${img ? `<img class="carnet-beast-sprite" alt="" loading="lazy" src="${img}">` : `<span class="carnet-beast-sprite">${icon('ghost')}</span>`}
                    <div><b>${env.escapeHtml(e.heading)}</b>${pl?.boss ? ' <span class="carnet-beast-boss">Boss</span>' : ''}${e.subtitle ? `<div class="carnet-beast-sub">${env.escapeHtml(e.subtitle)}</div>` : ''}<div class="carnet-beast-race">${env.escapeHtml(e.race)}</div></div>
                </div>
                <div class="carnet-beast-stats">
                    <span>${icon('shield')} Force : ${element(e.strongColor, e.strongElement)}${e.traits.length ? ` · ${env.escapeHtml(e.traits.join(', '))}` : ''}</span>
                    <span>${icon('target')} Faiblesse : ${element(e.weakColor, e.weakElement)}</span>
                </div>
                <div class="carnet-beast-more">
                    ${e.name && e.name !== e.pinyin ? `<span>${icon('ghost')} Nom en combat : ${env.escapeHtml(e.name)}${e.title ? ` — ${env.escapeHtml(e.title)}` : ''}</span>` : ''}
                    ${e.literal ? `<span>${icon('book')} Traduction littérale : ${env.escapeHtml(e.literal)}</span>` : ''}
                    ${e.resistances.length ? `<span>${icon('shield')} Résistances : ${e.resistances.map(r => `${manaIcon(r.color)} ${r.percent} %`).join(' · ')}</span>` : ''}
                    ${pl?.zones?.size ? `<span>${icon('map')} Où : ${env.escapeHtml([...pl.zones].map(id => SCREENS[id]?.name).filter(Boolean).join(', '))}</span>` : ''}
                </div>
                <p class="carnet-beast-lore">${icon('scroll')} ${env.escapeHtml(e.lore)}</p>
                <div class="carnet-beast-source ${e.source}">${icon('book')} ${env.escapeHtml(SOURCE_LABELS[e.source] || e.source)}</div>
            </div>`;
        }).join('')}</div>
        <button type="button" class="carnet-totop" hidden aria-label="Retour en haut" title="Retour en haut">↑ Haut</button>`;
    }

    // Branche les filtres, le compteur de résultats et « Retour en haut » sur le panneau fraîchement inséré (appelé après chaque innerHTML).
    let offBeastScroll = null;
    function bindBestiary(pane) {
        if (offBeastScroll) { offBeastScroll(); offBeastScroll = null; }
        if (!pane) return;
        const cards = [...pane.querySelectorAll('.carnet-beast')];
        const count = pane.querySelector('.carnet-bcount');
        const apply = () => {
            let shown = 0;
            cards.forEach(el => {
                const d = el.dataset;
                const ok = matchesBestiary({ name: d.name, family: d.family, resist: d.resist, weak: d.weak, zones: d.zones.split(' ').filter(Boolean), boss: Boolean(d.boss) }, beastFilter);
                el.hidden = !ok;
                if (ok) shown++;
            });
            if (count) count.textContent = shown === 0 ? 'Aucune créature ne correspond à ces filtres.' : `${shown} ${shown > 1 ? 'créatures affichées' : 'créature affichée'} sur ${cards.length}.`;
        };
        pane.querySelectorAll('[data-bf]').forEach(ctl => {
            ctl.addEventListener(ctl.type === 'search' ? 'input' : 'change', () => {
                const key = ctl.dataset.bf;
                beastFilter[key] = ctl.type === 'checkbox' ? ctl.checked : ctl.value;
                apply();
            });
        });
        pane.querySelector('[data-bf-reset]')?.addEventListener('click', () => {
            Object.assign(beastFilter, { q: '', family: '', resist: '', weak: '', zone: '', boss: false });
            pane.querySelectorAll('select[data-bf]').forEach(el => { el.value = ''; });
            pane.querySelectorAll('input[data-bf]').forEach(el => { if (el.type === 'checkbox') el.checked = false; else el.value = ''; });
            apply();
        });
        const top = pane.querySelector('.carnet-totop');
        if (top) {
            const sync = () => { top.hidden = (window.scrollY || document.documentElement.scrollTop || 0) < 300; };
            top.addEventListener('click', () => {
                (pane.closest('.tab-panel') || pane).scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            window.addEventListener('scroll', sync, { passive: true });
            offBeastScroll = () => window.removeEventListener('scroll', sync);
            sync();
        }
        apply();
    }

    function renderCarnet() {
        if (!env.journalEl) return;
        const body = carnet.tab === 'travel' ? travelPanel() : carnet.tab === 'progress' ? progressPanel() : questsPanel();
        const tab = (key, label) => `<button type="button" class="carnet-tab${carnet.tab === key ? ' on' : ''}" data-tab="${key}">${label}</button>`;
        env.journalEl.innerHTML = `
            <div class="explore-journal-card">
                <h3>${icon('scroll')} ${env.escapeHtml(STORY_TITLE)}</h3>
                ${env.session.data.ended ? `<p class="explore-journal-end">${icon('moon')} La légende est achevée !</p>` : ''}
                <div class="carnet-tabs">${tab('quests', `${icon('scroll')} Quêtes`)}${tab('travel', `${icon('stone')} Voyage`)}${tab('progress', `${icon('chart')} Progression`)}</div>
                ${body}
                ${env.session.data.ended ? `<button type="button" class="primary explore-journal-ngplus">${icon('moon')} Nouvelle Partie +</button>` : ''}
                <button type="button" class="primary explore-journal-close">Fermer</button>
            </div>`;
    }

    function showJournal(tab) {
        if (env.journalEl) return env.closeJournal();
        if (typeof tab === 'string') carnet.tab = tab;
        env.journalEl = document.createElement('div');
        env.journalEl.className = 'explore-journal';
        env.journalEl.addEventListener('click', ev => {
            if (ev.target.closest('.explore-journal-ngplus')) { env.confirmNewGamePlus(); return; }
            if (ev.target === env.journalEl || ev.target.closest('.explore-journal-close')) { env.closeJournal(); return; }
            const tabBtn = ev.target.closest('[data-tab]');
            if (tabBtn) { carnet.tab = tabBtn.dataset.tab; renderCarnet(); return; }
            const filterBtn = ev.target.closest('[data-filter]');
            if (filterBtn) { carnet.filter = filterBtn.dataset.filter; renderCarnet(); return; }
            const trackBtn = ev.target.closest('[data-track]');
            if (trackBtn) {
                X.setTrackedQuest(env.session, trackBtn.dataset.track || null);
                cfg.onSave();
                env.refreshHud();
                renderCarnet();
                return;
            }
            const biomeBtn = ev.target.closest('[data-travel-region]');
            if (biomeBtn) { carnet.travelRegion = biomeBtn.dataset.travelRegion; renderCarnet(); return; }
            const travelBtn = ev.target.closest('[data-travel]');
            if (travelBtn) { env.closeJournal(); env.travelTo(travelBtn.dataset.travel); }
        });
        env.journalEl.addEventListener('change', ev => {
            if (ev.target.classList.contains('carnet-region')) { carnet.region = ev.target.value; renderCarnet(); }
        });
        root.appendChild(env.journalEl);
        renderCarnet();
    }

    return { bestiaryPanel, bindBestiary, showJournal };
}
