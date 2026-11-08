// Dimensionnement du plateau : taille des cases selon la fenêtre (paysage / portrait), observateur de redimensionnement.
// Extrait de board.js.
import { boardSize } from './constants.js';
import { requestTileBitmaps } from './tileBitmaps.js';


let boardResizeListenersAttached = false;
let boardResizeObserver = null;
function getOuterBlockSize(element){
    if(!element) return 0;
    if(element.offsetParent === null) return 0;

    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const marginTop = parseFloat(styles.marginTop || '0') || 0;
    const marginBottom = parseFloat(styles.marginBottom || '0') || 0;
    return rect.height + marginTop + marginBottom;
}

// Paysage : la grille occupe les 2/3 de la largeur de l'écran (le tiers restant sert aux colonnes joueur / ennemi)
const LANDSCAPE_BOARD_WIDTH_RATIO = 2 / 3;

function isLandscapeLayout(){
    return Boolean(typeof window !== 'undefined' && window.matchMedia?.('(orientation: landscape)').matches);
}

function getMaxTileSizeFromViewport(boardDiv){
    // Paysage : la grille est centrée dans sa rangée, son propre haut ne dit rien ; on part du haut de la zone de combat
    const topRef = isLandscapeLayout() ? (document.getElementById('tab-combat') || boardDiv) : boardDiv;
    const top = Math.max(0, topRef.getBoundingClientRect().top);
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if(viewportHeight <= 0) return Infinity;

    const spellsContainer = document.getElementById('spells-container');
    const battleResultScreen = document.getElementById('battle-result-screen');
    // Paysage : les sorts sont dans les colonnes latérales, pas sous la grille
    const spellsHeight = isLandscapeLayout() ? 0 : getOuterBlockSize(spellsContainer);
    // Paysage : les boutons de combat flottent en bas de la colonne joueur, ils ne prennent pas de hauteur à la grille
    const controlsHeight = isLandscapeLayout() ? 0 : getOuterBlockSize(document.getElementById('combat-controls'));
    const resultHeight = getOuterBlockSize(battleResultScreen) + controlsHeight;
    // Paysage : la pastille de niveau (fixe, en bas de l'écran) ne doit pas recouvrir les boutons de combat
    const hud = isLandscapeLayout() ? document.getElementById('level-hud') : null;
    const hudBox = hud && hud.offsetParent !== null ? hud.getBoundingClientRect() : null;
    const boardBox = boardDiv.getBoundingClientRect();
    // Seulement si elle passe sous la grille (sur écran bas elle est rangée dans la colonne ennemi)
    const hudRect = hudBox && hudBox.left < boardBox.right && hudBox.right > boardBox.left ? hudBox : null;
    const bottomSafety = (hudRect ? 12 : 8) + (hudRect && hudRect.height > 0 ? Math.max(0, viewportHeight - hudRect.top) : 0);

    const availableBoardHeight = viewportHeight - top - spellsHeight - resultHeight - bottomSafety;
    if(availableBoardHeight <= 0) return 1;

    const styles = window.getComputedStyle(boardDiv);
    const paddingTop = parseFloat(styles.paddingTop || '0') || 0;
    const paddingBottom = parseFloat(styles.paddingBottom || '0') || 0;
    const borderY = (parseFloat(styles.borderTopWidth || '0') || 0) + (parseFloat(styles.borderBottomWidth || '0') || 0);
    const marginBottom = parseFloat(styles.marginBottom || '0') || 0;
    const gap = parseFloat(styles.rowGap || styles.gap || '0') || 0;
    const usableHeight = availableBoardHeight - paddingTop - paddingBottom - borderY - marginBottom - (gap * (boardSize - 1));
    if(usableHeight <= 0) return 1;

    return Math.floor(usableHeight / boardSize);
}

// Plus petite tuile que le filet de hauteur (portrait) accepte : en dessous, la page défile plutôt que de rendre la grille illisible.
const MIN_PORTRAIT_TILE = 30;

export function syncBoardTileSize(){
    if(typeof window === 'undefined') return;
    const boardDiv = document.getElementById('board');
    if(!boardDiv) return;
    if(boardDiv.offsetParent === null) return;

    const parentWidth = boardDiv.parentElement?.clientWidth || 0;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    // Mobile en portrait : la grille occupe toute la largeur (priorité sur la hauteur : la page défile au besoin).
    const fullWidth = Boolean(window.matchMedia?.('(orientation: portrait) and (max-width: 820px)').matches);
    const landscape = !fullWidth && isLandscapeLayout();
    // Écran bas : colonnes latérales de largeur fixe (--landscape-side, style.css) ; la grille ne déborde pas sur elles
    const sideWidth = landscape ? (parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--landscape-side')) || 0) : 0;
    const widthBudget = landscape && viewportWidth > 0
        ? Math.floor(Math.min(viewportWidth * LANDSCAPE_BOARD_WIDTH_RATIO, sideWidth > 0 ? viewportWidth - 2 * sideWidth - 24 : Infinity))
        : Math.min(
            parentWidth > 0 ? parentWidth : Number.POSITIVE_INFINITY,
            viewportWidth > 0 ? (viewportWidth - (fullWidth ? 4 : 24)) : Number.POSITIVE_INFINITY,
            980
        );

    if(!Number.isFinite(widthBudget) || widthBudget <= 0) return;

    const styles = window.getComputedStyle(boardDiv);
    const paddingLeft = parseFloat(styles.paddingLeft || '0') || 0;
    const paddingRight = parseFloat(styles.paddingRight || '0') || 0;
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    const borderX = (parseFloat(styles.borderLeftWidth || '0') || 0) + (parseFloat(styles.borderRightWidth || '0') || 0);
    const usableWidth = widthBudget - paddingLeft - paddingRight - borderX - (gap * (boardSize - 1));
    if(usableWidth <= 0) return;

    const tileSizeFromWidth = Math.floor(usableWidth / boardSize);
    const spellsContainer = document.getElementById('spells-container');
    if(spellsContainer){
        if(fullWidth){
            // Liste verticale si elle tient dans l'écran (avec une grille de taille raisonnable), sinon grille compacte
            spellsContainer.classList.remove('spells-compact');
            const boardSide = Math.max(10, Math.floor(usableWidth / boardSize)) * boardSize + paddingLeft + paddingRight + (gap * (boardSize - 1));
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const top = Math.max(0, boardDiv.getBoundingClientRect().top);
            const controls = getOuterBlockSize(document.getElementById('combat-controls'));
            const needed = top + boardSide + getOuterBlockSize(spellsContainer) + controls + 8;
            if(viewportHeight > 0 && needed > viewportHeight) spellsContainer.classList.add('spells-compact');
        } else {
            spellsContainer.classList.remove('spells-compact');
        }
    }
    const tileSizeFromHeight = getMaxTileSizeFromViewport(boardDiv);
    const tileSize = Math.max(10, fullWidth ? tileSizeFromWidth : Math.min(tileSizeFromWidth, tileSizeFromHeight));
    boardDiv.style.setProperty('--tile-size', `${tileSize}px`);
    // Filet : si la grille dépasse encore la largeur visible (bordures, marges, mesure faite avant un changement de mise en page),
    // on rogne les tuiles plutôt que d'obliger à faire défiler la page vers la droite.
    const docWidth = document.documentElement.clientWidth || viewportWidth;
    const limit = Math.min(parentWidth > 0 ? parentWidth : Infinity, docWidth > 0 ? docWidth - 2 : Infinity);
    const overflow = Math.max(boardDiv.getBoundingClientRect().width, boardDiv.scrollWidth) - limit;   // scrollWidth : le CSS plafonne la boîte à 100 %, pas son contenu
    let fitted = tileSize;
    if(Number.isFinite(limit) && overflow > 0.5) fitted = Math.max(10, fitted - Math.ceil(overflow / boardSize));
    // Portrait : si la page déborde encore en hauteur (la pastille de niveau en bas n'est plus visible), on rogne aussi les tuiles.
    if(fullWidth){
        if(fitted !== tileSize) boardDiv.style.setProperty('--tile-size', `${fitted}px`);
        const doc = document.documentElement;
        const tall = doc.scrollHeight - doc.clientHeight;
        if(tall > 1){
            const shrunk = Math.max(MIN_PORTRAIT_TILE, fitted - Math.ceil(tall / boardSize));
            if(shrunk < fitted){
                // PWA (écran de veille / barre système) : le débordement peut venir d'une hauteur minimale (100dvh) et non de la grille.
                // On ne rogne donc que si la page rétrécit réellement ; sinon on garde la pleine largeur.
                const before = doc.scrollHeight;
                boardDiv.style.setProperty('--tile-size', `${shrunk}px`);
                const gained = before - doc.scrollHeight;
                if(gained >= (fitted - shrunk) * boardSize * 0.5) fitted = shrunk;
                else boardDiv.style.setProperty('--tile-size', `${fitted}px`);
            }
        }
    }
    if(fitted !== tileSize){
        boardDiv.style.setProperty('--tile-size', `${fitted}px`);
        requestTileBitmaps(fitted);
        return;
    }
    requestTileBitmaps(tileSize);   // fonds des tuiles rastérisés à la taille d'affichage (tileBitmaps.js)
}

export function ensureBoardResizeListeners(){
    if(boardResizeListenersAttached || typeof window === 'undefined') return;
    const schedule = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 0);

    const handleResize = () => {
        schedule(syncBoardTileSize);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    // PWA : la mesure faite au lancement (barres système, polices, mise en page pas stabilisée) peut être fausse ;
    // on recalcule au retour dans l'app, une fois la page chargée et quand les polices sont prêtes.
    window.addEventListener('pageshow', handleResize);
    window.addEventListener('load', handleResize);
    document.addEventListener('visibilitychange', () => { if(!document.hidden) handleResize(); });
    document.fonts?.ready?.then(handleResize);
    setTimeout(handleResize, 400);

    if(typeof window.ResizeObserver === 'function'){
        boardResizeObserver = new window.ResizeObserver(() => {
            schedule(syncBoardTileSize);
        });

        const observedElements = [
            document.querySelector('.stats-container'),
            document.getElementById('spells-container'),
            document.getElementById('battle-result-screen'),
            document.querySelector('.tabs')
        ];

        observedElements.forEach((element) => {
            if(element){
                boardResizeObserver.observe(element);
            }
        });
    }

    boardResizeListenersAttached = true;
}
