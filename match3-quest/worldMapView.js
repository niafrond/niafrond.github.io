// Rendu de la carte du monde façon "overworld" de Mario : mer, île aux falaises,
// biomes décorés, chemin en pointillés reliant les zones dans l'ordre de progression,
// noeuds rouge (à explorer) / or (déjà explorée) / gris (verrouillée).
// buildWorldMapSvg est pur (retourne du HTML) pour rester testable sous Node. Icônes : pixel art (pixelIcons.js).

import { iconUri, iconForEmoji } from './pixelIcons.js';

export const MAP_WIDTH = 820;
export const MAP_HEIGHT = 600;
const LAND_PATH_WIDTH = 120;
const LAND_NODE_RADIUS = 74;
const BIOME_RADIUS = 62;

const BIOMES = {
    rizieres: { fill: '#9fd05a', deco: ['bush', 'bush', 'bush', 'tree', 'rock'] },
    fleuve: { fill: '#cfae6e', deco: ['rock', 'rock', 'bush', 'rock'] },
    bambous: { fill: '#6e9a5a', deco: ['pine', 'pine', 'tree', 'pine', 'rock'] },
    gobi: { fill: '#ecd394', deco: ['cactus', 'cactus', 'pyramid', 'rock'] },
    tonnerre: { fill: '#8a86a8', deco: ['mountain', 'mountain', 'rock', 'crystal'] },
    volcan: { fill: '#8a4a3e', deco: ['mountain', 'mountain', 'rock', 'tent'] },
    fauves: { fill: '#dcb862', deco: ['bush', 'rock', 'tree', 'bush'] },
    mer: { fill: '#7fbad8', deco: ['rock', 'rock', 'bush'] },
    fusang: { fill: '#e8c860', deco: ['tree', 'tree', 'crystal', 'tree'] },
    lune: { fill: '#a4aedc', deco: ['crystal', 'crystal', 'rock', 'pillar'] }
};
const DEFAULT_BIOME = { fill: '#6cc24a', deco: ['tree', 'tree', 'rock'] };

const SYMBOLS = `
<g id="d-tree"><ellipse cy="1" rx="9" ry="3" fill="rgba(0,0,0,.22)"/><rect x="-2" y="-8" width="4" height="9" fill="#7a4a21"/><circle cy="-15" r="10" fill="#1f7a35"/><circle cx="-3" cy="-18" r="5" fill="#45c265"/></g>
<g id="d-bush"><ellipse cy="1" rx="8" ry="2.5" fill="rgba(0,0,0,.2)"/><circle cx="-4" cy="-4" r="5" fill="#2a8c43"/><circle cx="4" cy="-4" r="5" fill="#2a8c43"/><circle cy="-7" r="5" fill="#45c265"/></g>
<g id="d-rock"><ellipse cy="1" rx="9" ry="3" fill="rgba(0,0,0,.2)"/><ellipse cy="-4" rx="8" ry="6" fill="#8d99ae"/><ellipse cx="-2" cy="-6" rx="4" ry="2.5" fill="#b8c0cc"/></g>
<g id="d-pillar"><ellipse cy="1" rx="8" ry="2.5" fill="rgba(0,0,0,.2)"/><rect x="-5" y="-20" width="10" height="20" fill="#d4d9df"/><rect x="-7" y="-23" width="14" height="4" fill="#eef0f3"/><rect x="-7" y="-3" width="14" height="3" fill="#a9b0b8"/><rect x="-1" y="-19" width="2" height="16" fill="#b7bec6"/></g>
<g id="d-pillarBroken"><ellipse cy="1" rx="8" ry="2.5" fill="rgba(0,0,0,.2)"/><polygon points="-5,0 -5,-9 -2,-12 1,-8 5,-11 5,0" fill="#c4cad1"/><rect x="-7" y="-3" width="14" height="3" fill="#a9b0b8"/></g>
<g id="d-tent"><ellipse cy="1" rx="13" ry="3" fill="rgba(0,0,0,.22)"/><polygon points="-13,0 0,-19 13,0" fill="#b23a48"/><polygon points="0,-19 13,0 4,0" fill="#8f2a36"/><polygon points="-3.5,0 0,-9 3.5,0" fill="#2b1b17"/></g>
<g id="d-flag"><rect x="-1" y="-26" width="2" height="26" fill="#3b2a20"/><polygon points="1,-26 15,-20.5 1,-15" fill="#c1121f"/></g>
<g id="d-mountain"><ellipse cy="1" rx="17" ry="3" fill="rgba(0,0,0,.2)"/><polygon points="-17,0 0,-28 17,0" fill="#7d6b5d"/><polygon points="0,-28 17,0 5,0" fill="#5e4f44"/></g>
<g id="d-cactus"><ellipse cy="1" rx="8" ry="2.5" fill="rgba(0,0,0,.18)"/><rect x="-3" y="-22" width="6" height="22" rx="3" fill="#2d8a4e"/><rect x="-11" y="-15" width="5" height="10" rx="2.5" fill="#2d8a4e"/><rect x="-11" y="-8" width="8" height="4" rx="2" fill="#2d8a4e"/><rect x="6" y="-17" width="5" height="10" rx="2.5" fill="#2d8a4e"/><rect x="3" y="-10" width="8" height="4" rx="2" fill="#2d8a4e"/></g>
<g id="d-pyramid"><ellipse cy="1" rx="19" ry="3" fill="rgba(0,0,0,.18)"/><polygon points="-18,0 0,-24 18,0" fill="#f0d27a"/><polygon points="0,-24 18,0 5,0" fill="#c99a3c"/></g>
<g id="d-pine"><ellipse cy="1" rx="8" ry="2.5" fill="rgba(0,0,0,.15)"/><rect x="-1.5" y="-5" width="3" height="6" fill="#6b4a2b"/><polygon points="0,-30 -10,-9 10,-9" fill="#2f7d8f"/><polygon points="0,-30 -4,-22 4,-22" fill="#fff"/><polygon points="-10,-9 -6,-14 6,-14 10,-9" fill="#e9f6ff"/></g>
<g id="d-iceMountain"><ellipse cy="1" rx="17" ry="3" fill="rgba(0,0,0,.15)"/><polygon points="-17,0 0,-28 17,0" fill="#9cc7e0"/><polygon points="0,-28 17,0 5,0" fill="#79a8c7"/><polygon points="0,-28 -6,-17 0,-20 6,-17" fill="#fff"/></g>
<g id="d-crystal"><ellipse cy="1" rx="8" ry="2.5" fill="rgba(0,0,0,.3)"/><polygon points="0,-26 -8,-9 0,0 8,-9" fill="#b565f0"/><polygon points="0,-26 8,-9 0,0" fill="#8a2fd0"/><polygon points="0,-26 -3,-14 0,-9" fill="#e2b8ff"/></g>
`;

// Générateur pseudo-aléatoire déterministe : la carte est identique à chaque ouverture.
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const escapeHtml = (str) => String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function segmentPath(a, b) {
    const mx = (a.x + b.x) / 2;
    return `C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
}

function landPath(points) {
    if (!points.length) return '';
    return `M${points[0].x} ${points[0].y}` + points.slice(1).map((p, i) => segmentPath(points[i], p)).join('');
}

function decorations(zone, index) {
    const biome = BIOMES[zone.id] || DEFAULT_BIOME;
    const rand = mulberry32(1000 + index * 97);
    const placed = [];
    const items = [];
    biome.deco.forEach(kind => {
        for (let attempt = 0; attempt < 30; attempt++) {
            const angle = rand() * Math.PI * 2;
            const dist = 26 + rand() * 26;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist * 0.85;
            // on laisse libre l'emplacement de la bannière du nom, sous le noeud
            if (dy > 12 && dy < 52 && Math.abs(dx) < 62) continue;
            if (placed.some(p => Math.hypot(p.dx - dx, p.dy - dy) < 17)) continue;
            placed.push({ dx, dy });
            items.push({ kind, x: zone.map.x + dx, y: zone.map.y + dy });
            break;
        }
    });
    return items;
}

function seaWaves() {
    const rand = mulberry32(42);
    let out = '';
    for (let i = 0; i < 46; i++) {
        const x = rand() * MAP_WIDTH;
        const y = rand() * MAP_HEIGHT;
        out += `<path class="wm-wave" d="M${x.toFixed(0)} ${y.toFixed(0)} q6 -6 12 0 t12 0" />`;
    }
    return out;
}

/**
 * @param {Array} zones  worldZones (avec .map {x,y}), dans l'ordre du chemin
 * @param {{level:number, visitedIds:string[], currentId:string|null, heroUri?:string, requireVisit?:boolean}} state
 */
export function buildWorldMapSvg(zones, state) {
    const level = Math.max(1, Math.floor(state?.level || 1));
    const visitedIds = state?.visitedIds || [];
    const currentId = state?.currentId || null;
    // requireVisit : en exploration, une région ne se rejoint que si on l'a déjà découverte à pied.
    const isUnlocked = z => level >= z.unlockLevel && (!state.requireVisit || visitedIds.includes(z.id));
    const points = zones.map(z => z.map);

    const roadD = landPath(points);
    const landShapes = `
        <path d="${roadD}" fill="none" stroke-width="${LAND_PATH_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="${LAND_NODE_RADIUS}"/>`).join('')}`;

    const roads = zones.slice(1).map((zone, i) => {
        const d = `M${points[i].x} ${points[i].y}` + segmentPath(points[i], zone.map);
        const locked = !isUnlocked(zone);
        return `<g class="wm-road${locked ? ' locked' : ''}">
            <path d="${d}" class="wm-road-edge"/><path d="${d}" class="wm-road-fill"/><path d="${d}" class="wm-road-dots"/>
        </g>`;
    }).join('');

    const biomes = zones.map(zone => {
        const b = BIOMES[zone.id] || DEFAULT_BIOME;
        const locked = !isUnlocked(zone);
        const decos = decorations(zone, zones.indexOf(zone)).sort((a, b2) => a.y - b2.y)
            .map(d => `<use href="#d-${d.kind}" x="${d.x.toFixed(1)}" y="${d.y.toFixed(1)}"/>`).join('');
        return `<g class="wm-biome${locked ? ' locked' : ''}" data-zone="${zone.id}">
            <circle cx="${zone.map.x}" cy="${zone.map.y}" r="${BIOME_RADIUS}" fill="${b.fill}" class="wm-biome-blob" filter="url(#wm-patch)"/>
            ${decos}
            ${locked ? `<circle cx="${zone.map.x}" cy="${zone.map.y}" r="${BIOME_RADIUS}" class="wm-fog"/>` : ''}
        </g>`;
    }).join('');

    const nodes = zones.map(zone => {
        const unlocked = isUnlocked(zone);
        const visited = visitedIds.includes(zone.id);
        const current = zone.id === currentId;
        const { x, y } = zone.map;
        const bannerLabel = zone.shortName || zone.name;
        const name = escapeHtml(bannerLabel);
        const bannerW = Math.round(bannerLabel.length * 7.6 + 22);
        const state = !unlocked ? 'locked' : visited ? 'visited' : 'new';
        const label = unlocked
            ? `${zone.name}${visited ? ', déjà explorée' : ''}`
            : `${zone.name}, verrouillée, niveau ${zone.unlockLevel} requis`;
        return `<g class="wm-node ${state}${current ? ' current' : ''}" data-zone="${zone.id}" transform="translate(${x} ${y})"
                role="button" tabindex="0" aria-label="${escapeHtml(label)}" aria-disabled="${unlocked ? 'false' : 'true'}">
            <g class="wm-node-inner">
                ${state === 'new' ? '<circle class="wm-pulse" r="26"/>' : ''}
                <circle class="wm-node-shadow" cy="4" r="25"/>
                <circle class="wm-node-dot" r="25"/>
                <circle class="wm-node-shine" cx="-8" cy="-9" r="6"/>
                <image class="wm-node-icon" href="${iconUri(unlocked ? (iconForEmoji(zone.emoji) || 'pin') : 'lock')}" x="-15" y="-15" width="30" height="30"/>
                ${state === 'visited' ? `<image class="wm-node-badge" href="${iconUri('star')}" x="11" y="-26" width="18" height="18"/>` : ''}
                <rect class="wm-banner" x="${-bannerW / 2}" y="32" width="${bannerW}" height="22" rx="8"/>
                <text class="wm-banner-text" y="47" text-anchor="middle">${name}</text>
                ${unlocked ? '' : `<rect class="wm-lvl" x="-34" y="58" width="68" height="18" rx="9"/><text class="wm-lvl-text" y="71" text-anchor="middle">${level >= zone.unlockLevel ? '???' : `Niv. ${zone.unlockLevel}`}</text>`}
            </g>
            ${current ? (state.heroUri
                ? `<image class="wm-hero" href="${state.heroUri}" x="-24" y="-84" width="48" height="48"/>`
                : `<image class="wm-hero" href="${iconUri('person')}" x="-15" y="-66" width="30" height="30"/>`) : ''}
        </g>`;
    }).join('');

    return `<svg class="wm-svg" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Carte du monde">
    <defs>
        <linearGradient id="wm-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wm-sea-a"/><stop offset="1" class="wm-sea-b"/></linearGradient>
        <filter id="wm-patch" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <filter id="wm-coast" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="7" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        ${SYMBOLS}
    </defs>
    <rect width="${MAP_WIDTH}" height="${MAP_HEIGHT}" fill="url(#wm-sea)"/>
    <g class="wm-waves">${seaWaves()}</g>
    <g filter="url(#wm-coast)">
        <g class="wm-shallows" transform="translate(0 6)">${landShapes}</g>
        <g class="wm-cliff" transform="translate(0 14)">${landShapes}</g>
        <g class="wm-grass">${landShapes}</g>
    </g>
    ${roads}
    ${biomes}
    ${nodes}
    <g class="wm-clouds" pointer-events="none">
        <g class="wm-cloud c1"><ellipse cx="90" cy="70" rx="38" ry="12"/><ellipse cx="115" cy="60" rx="24" ry="12"/></g>
        <g class="wm-cloud c2"><ellipse cx="560" cy="110" rx="44" ry="13"/><ellipse cx="590" cy="99" rx="26" ry="12"/></g>
        <g class="wm-cloud c3"><ellipse cx="330" cy="330" rx="34" ry="10"/><ellipse cx="352" cy="322" rx="20" ry="9"/></g>
    </g>
</svg>`;
}

const DEFAULT_CAPTION = 'Touchez une région découverte pour vous y rendre.';

/**
 * Insère la carte dans `container` et branche les interactions.
 * @param {(zone:object)=>void} onSelect appelé pour une zone débloquée
 */
export function mountWorldMap(container, zones, state, onSelect) {
    container.innerHTML = `${buildWorldMapSvg(zones, state)}<div class="wm-caption" aria-live="polite"></div>`;
    const caption = container.querySelector('.wm-caption');
    const isSelectable = zone => state.level >= zone.unlockLevel && (!state.requireVisit || (state.visitedIds || []).includes(zone.id));
    const setCaption = (zone) => {
        if (!zone) { caption.textContent = DEFAULT_CAPTION; return; }
        if (isSelectable(zone)) {
            caption.textContent = `${zone.emoji} ${zone.name} — ${zone.description}`;
        } else if (state.level >= zone.unlockLevel) {
            caption.textContent = `❔ ${zone.name} — région inexplorée : trouvez le chemin à pied pour la découvrir.`;
        } else {
            caption.textContent = `🔒 ${zone.name} — se débloque au niveau ${zone.unlockLevel}.`;
        }
    };
    setCaption(null);

    container.querySelectorAll('.wm-node').forEach(node => {
        const zone = zones.find(z => z.id === node.dataset.zone);
        if (!zone) return;
        const activate = () => { if (isSelectable(zone)) onSelect(zone); else setCaption(zone); };
        node.addEventListener('click', activate);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        });
        node.addEventListener('mouseenter', () => setCaption(zone));
        node.addEventListener('focus', () => setCaption(zone));
        node.addEventListener('mouseleave', () => setCaption(null));
        node.addEventListener('blur', () => setCaption(null));
    });
}
