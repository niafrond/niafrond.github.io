// Accessibilité transversale : annonces pour lecteurs d'écran, bulle d'information visible et comportement des fenêtres (.modal).
//  - announce(texte) : relaie un message dans une zone `role="status"` masquée (dégâts, soins, sorts, erreurs…), sans dépendre d'une animation ni d'un son ;
//  - notify(texte)   : idem, avec en plus une bulle visible quelques secondes (actions indisponibles, erreurs de sauvegarde) ;
//  - initDialogs()   : donne aux fenêtres `.modal` le rôle `dialog`, place le focus dedans à l'ouverture, le rend à la fermeture.
// Module sans dépendance, sûr hors navigateur (tests Node : tout est ignoré sans `document`).

const LIVE_ID = 'sr-status';
const TOAST_ID = 'a11y-toast';
let toastTimer = null;
let lastText = '';

const hasDom = () => typeof document !== 'undefined' && Boolean(document.body);

function liveRegion() {
    let el = document.getElementById(LIVE_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = LIVE_ID;
        el.className = 'visually-hidden';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        document.body.appendChild(el);
    }
    return el;
}

const plain = text => String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export function announce(text) {
    if (!hasDom()) return false;
    const msg = plain(text);
    if (!msg) return false;
    const el = liveRegion();
    // Un même message répété doit être relu : on alterne un espace insécable invisible.
    el.textContent = msg === lastText ? `${msg} ` : msg;
    lastText = el.textContent === msg ? msg : '';
    return true;
}

export function notify(text, ms = 4000) {
    if (!hasDom()) return false;
    const msg = plain(text);
    if (!msg) return false;
    let box = document.getElementById(TOAST_ID);
    if (!box) {
        box = document.createElement('div');
        box.id = TOAST_ID;
        box.className = 'a11y-toast';
        box.setAttribute('aria-hidden', 'true');   // lue via la zone d'annonce, pas deux fois
        document.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('visible'), ms);
    announce(msg);
    return true;
}

// ---- Fenêtres modales ----
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const opener = new WeakMap();

const isOpen = el => el.classList.contains('active') || /flex|block/.test(el.style.display || '');
const IS_JSDOM = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);   // jsdom ne calcule aucune mise en page
const visibleFocusables = el => [...el.querySelectorAll(FOCUSABLE)].filter(n => IS_JSDOM || n.getClientRects().length > 0);

function decorate(modal) {
    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    if (!modal.hasAttribute('aria-modal')) modal.setAttribute('aria-modal', 'true');
    const title = modal.querySelector('h2, h3');
    if (title && !modal.hasAttribute('aria-labelledby') && !modal.hasAttribute('aria-label')) {
        if (!title.id) title.id = `${modal.id || 'modal'}-title`;
        modal.setAttribute('aria-labelledby', title.id);
    }
}

function onOpen(modal) {
    decorate(modal);
    if (modal.contains(document.activeElement)) return;
    opener.set(modal, document.activeElement);
    const target = modal.querySelector('[autofocus]') || modal.querySelector('.modal-actions .primary') || visibleFocusables(modal)[0];
    if (target) target.focus({ preventScroll: true });
    else { modal.setAttribute('tabindex', '-1'); modal.focus({ preventScroll: true }); }
}

function onClose(modal) {
    const back = opener.get(modal);
    opener.delete(modal);
    const lost = !document.activeElement || document.activeElement === document.body || modal.contains(document.activeElement);
    if (back && back.isConnected && back !== document.body && lost) back.focus?.({ preventScroll: true });
}

let started = false;
export function initDialogs() {
    if (!hasDom() || started || typeof MutationObserver === 'undefined') return false;
    started = true;
    const known = new WeakMap();   // modal -> était ouverte ?
    const check = modal => {
        const open = isOpen(modal);
        if (known.get(modal) === open) return;
        known.set(modal, open);
        if (open) onOpen(modal); else onClose(modal);
    };
    const scan = root => (root.matches?.('.modal') ? [root] : []).concat([...(root.querySelectorAll?.('.modal') || [])]).forEach(m => { decorate(m); check(m); });
    new MutationObserver(records => {
        if (typeof document === 'undefined' || !document.body) return;   // page en cours de fermeture
        try { records.forEach(r => {
            if (r.type === 'attributes') { if (r.target.classList?.contains('modal')) check(r.target); }
            else {
                r.addedNodes.forEach(n => n.nodeType === 1 && scan(n));
                r.removedNodes.forEach(n => n.nodeType === 1 && n.classList?.contains('modal') && onClose(n));
            }
        }); } catch (e) { console.warn('a11y: fenêtre ignorée', e); }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    scan(document.body);
    return true;
}
