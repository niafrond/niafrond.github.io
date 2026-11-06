import { describe, test, expect } from '@jest/globals';
import { rowCardHtml, emptyRowHtml, badgeHtml, cardTipHtml, shortText, moreButtonHtml } from '../../gameCardUi.js';
import { icon } from '../../icons.js';

describe('cartes compactes (onglets Armes, Objets, Stuff)', () => {
    test('nom, pastilles et sous-ligne sont séparés : la quantité n\'est jamais dans le nom', () => {
        const html = rowCardHtml({ key: 'i:miel', name: 'Flacon de Miel Magique', badges: badgeHtml('×2'), sub: '<span>+10 PV</span>', primary: '<button>Activer</button>' });
        expect(html).toContain('<span class="rc-name">Flacon de Miel Magique</span><em class="rc-badge">×2</em>');
        expect(html).toContain('<div class="rc-sub"><span>+10 PV</span></div>');
        expect(html).not.toContain('rc-more');   // pas de menu « ⋯ » sans actions secondaires
    });

    test('les actions secondaires passent par un menu « ⋯ » accessible', () => {
        const html = rowCardHtml({ key: 'w:arc', name: 'Arc', primary: '<button>Équiper</button>', more: '<button>Comparer</button>' });
        expect(html).toContain('data-rc-more');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('aria-label="Plus d\'actions"');
        expect(html).toContain('<div class="rc-more"><button>Comparer</button></div>');
        expect(moreButtonHtml(true)).toContain('aria-expanded="true"');
    });

    test('la description n\'est pas affichée : elle est dans l\'infobulle (appui long), lisible par les lecteurs d\'écran', () => {
        const tip = cardTipHtml('Arc', ['10 / 3'], 'Un vieil arc');
        const html = rowCardHtml({ key: 'w:arc', name: 'Arc', tip });
        expect(html).toContain('<div class="rc-tip visually-hidden">');
        expect(html).not.toContain('class="rc-sub"');
        expect(tip).toContain('<em>Un vieil arc</em>');
    });

    test('échappement de la clé et de la couleur de rareté', () => {
        const html = rowCardHtml({ key: 'a"b', name: 'x', border: '#fff" onclick="x' });
        expect(html).not.toMatch(/data-rc="a"b"/);
        expect(html).not.toContain('onclick="x"');
    });

    test('emplacement vide sur une ligne', () => {
        expect(emptyRowHtml('Main gauche', 'vide')).toContain('rc-empty');
    });

    test('shortText : première proposition de la description, tronquée', () => {
        expect(shortText('Soigne 25 HP par utilisation (2 usages, puis rechargé en 8 tours)')).toBe('Soigne 25 HP par utilisation');
        expect(shortText('Augmente attaque de 8, permanent')).toBe('Augmente attaque de 8');
        expect(shortText('a'.repeat(80), 10)).toHaveLength(10);
        expect(shortText(undefined)).toBe('');
    });

    test('icônes Comparer et Plus', () => {
        expect(icon('more')).toContain('<svg');
        expect(icon('compare')).toContain('<svg');
    });
});
