// Aucun emoji à l'écran : chaque emoji d'un texte affiché (boutons, journal de combat, dialogues, toasts, modales…)
// est remplacé par son icône pixel art (pixelIcons.js), ou retiré s'il n'en a pas. Un MutationObserver traite le
// document entier, y compris tout ce qui est ajouté ou modifié après coup ; les attributs lus par le navigateur
// (title, aria-label, placeholder, alt) et les boîtes confirm/alert sont nettoyés, sans icône possible.

import { EMOJI_RE, isPictogram, iconForEmoji, iconUri, stripEmoji, hasEmoji } from './pixelIcons.js';

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT']);
// Pas d'<img> possible dans ces éléments : on retire seulement les emojis.
const TEXT_ONLY = new Set(['OPTION', 'TITLE', 'text', 'tspan', 'textPath']);
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'data-full-name'];

function iconImg(icon) {
    const img = document.createElement('img');
    img.className = 'px-icon';
    img.alt = '';
    img.draggable = false;
    img.src = iconUri(icon);
    return img;
}

function convertTextNode(node) {
    const text = node.nodeValue;
    if (!text || !hasEmoji(text)) return;
    const parent = node.parentNode;
    if (!parent || SKIP.has(parent.nodeName)) return;
    if (TEXT_ONLY.has(parent.nodeName) || parent.namespaceURI === 'http://www.w3.org/2000/svg') {
        node.nodeValue = stripEmoji(text);
        return;
    }
    const frag = document.createDocumentFragment();
    let last = 0;
    let dropped = false;
    text.replace(EMOJI_RE, (m, offset) => {
        if (!isPictogram(m)) return m;
        let chunk = text.slice(last, offset);
        if (dropped && chunk.startsWith(' ')) chunk = chunk.slice(1);
        if (chunk) frag.appendChild(document.createTextNode(chunk));
        const icon = iconForEmoji(m);
        dropped = !icon;
        if (icon) frag.appendChild(iconImg(icon));
        last = offset + m.length;
        return m;
    });
    let rest = text.slice(last);
    if (dropped && rest.startsWith(' ')) rest = rest.slice(1);
    if (rest) frag.appendChild(document.createTextNode(rest));
    parent.replaceChild(frag, node);
}

function cleanAttributes(el) {
    for (const name of ATTRS) {
        const v = el.getAttribute?.(name);
        if (v && hasEmoji(v)) el.setAttribute(name, stripEmoji(v));
    }
}

function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { convertTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (SKIP.has(root.nodeName)) return;
    if (root.nodeType === Node.ELEMENT_NODE) cleanAttributes(root);
    const texts = [];
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) texts.push(n);
        else cleanAttributes(n);
    }
    texts.forEach(convertTextNode);
}

let installed = false;

// À appeler une fois au démarrage : nettoie le document et surveille toutes les modifications.
export function installPixelText(root = document.documentElement) {
    if (installed || typeof MutationObserver === 'undefined') return;
    installed = true;
    walk(root);
    if (hasEmoji(document.title)) document.title = stripEmoji(document.title);
    const observer = new MutationObserver(records => {
        for (const r of records) {
            if (r.type === 'characterData') convertTextNode(r.target);
            else if (r.type === 'attributes') cleanAttributes(r.target);
            else r.addedNodes.forEach(walk);
        }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // Boîtes natives : pas d'image possible, on retire les emojis.
    const wrap = fn => (fn ? msg => fn.call(window, stripEmoji(msg)) : fn);
    window.confirm = wrap(window.confirm);
    window.alert = wrap(window.alert);
}
