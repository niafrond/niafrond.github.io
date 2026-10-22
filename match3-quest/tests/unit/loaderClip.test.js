/** @jest-environment jsdom */
import { withLoadingScreen, isLoadingScreenVisible } from '../../loader.js';

const seq = { img: {}, frames: 4, fps: 24, size: [2, 2], cols: 2 };

describe('écran de chargement avec animation de biome', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="loading-screen" class="loading-screen" aria-hidden="true"><div class="loading-panel"><div class="loading-label"></div><div class="loading-bar"><i></i></div></div></div>';
        HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    });

    test('avec une animation prête, l\'écran s\'affiche tout de suite avec un canvas en fond, retiré à la fermeture', async () => {
        let during;
        await withLoadingScreen('Gobi', async () => {
            during = { visible: isLoadingScreenVisible(), clip: Boolean(document.querySelector('#loading-screen > canvas.loading-clip')), cls: document.getElementById('loading-screen').classList.contains('has-clip') };
        }, Promise.resolve(seq));
        expect(during).toEqual({ visible: true, clip: true, cls: true });
        expect(document.querySelector('.loading-clip')).toBeNull();
        expect(document.getElementById('loading-screen').classList.contains('has-clip')).toBe(false);
    });

    test('sans animation (ou animation absente), pas de canvas et pas d\'affichage immédiat', async () => {
        let during;
        await withLoadingScreen('Gobi', async () => { during = { visible: isLoadingScreenVisible(), clip: document.querySelector('.loading-clip') }; }, Promise.resolve(null));
        expect(during).toEqual({ visible: false, clip: null });
    });
});
