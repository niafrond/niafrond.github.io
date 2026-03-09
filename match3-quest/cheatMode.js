function createCheatButton(label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.background = 'rgba(255, 255, 255, 0.08)';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.16)';
    btn.style.borderRadius = '8px';
    btn.style.color = '#f3f5f8';
    btn.style.padding = '8px 10px';
    btn.style.cursor = 'pointer';
    btn.style.textAlign = 'left';
    return btn;
}

export function createCheatModeSection({ isEnabled, setEnabled }) {
    const sectionCheat = document.createElement('div');
    sectionCheat.style.marginTop = '10px';
    sectionCheat.style.paddingTop = '12px';
    sectionCheat.style.borderTop = '1px solid rgba(255, 255, 255, 0.12)';

    const sectionCheatTitle = document.createElement('div');
    sectionCheatTitle.textContent = 'Cheat Code';
    sectionCheatTitle.style.fontSize = '0.8rem';
    sectionCheatTitle.style.letterSpacing = '.08em';
    sectionCheatTitle.style.opacity = '0.75';
    sectionCheatTitle.style.textTransform = 'uppercase';
    sectionCheatTitle.style.marginBottom = '8px';

    const cheatHint = document.createElement('p');
    cheatHint.textContent = 'Mode test in-game: lancer un sort, attaque de test, changer une tuile.';
    cheatHint.style.margin = '0 0 10px';
    cheatHint.style.opacity = '0.82';
    cheatHint.style.fontSize = '0.88rem';

    const cheatToggleBtn = document.createElement('button');
    cheatToggleBtn.type = 'button';
    cheatToggleBtn.style.textAlign = 'left';
    cheatToggleBtn.style.borderRadius = '10px';
    cheatToggleBtn.style.padding = '10px 12px';
    cheatToggleBtn.style.color = '#f3f5f8';
    cheatToggleBtn.style.cursor = 'pointer';

    const cheatControlsWrap = document.createElement('div');
    cheatControlsWrap.style.marginTop = '10px';
    cheatControlsWrap.style.display = isEnabled() ? 'grid' : 'none';
    cheatControlsWrap.style.gap = '8px';

    function refreshCheatToggleLabel() {
        const enabled = isEnabled();
        cheatToggleBtn.innerHTML = enabled
            ? '<strong>Cheat mode: ACTIVE</strong><br><span style="opacity:.78;font-size:.85rem">Clique pour desactiver</span>'
            : '<strong>Cheat mode: DESACTIVE</strong><br><span style="opacity:.78;font-size:.85rem">Clique pour activer</span>';
        cheatToggleBtn.style.background = enabled ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.08)';
        cheatToggleBtn.style.border = enabled ? '1px solid rgba(16, 185, 129, 0.75)' : '1px solid rgba(255, 255, 255, 0.12)';
        cheatControlsWrap.style.display = enabled ? 'grid' : 'none';
    }

    const castWrap = document.createElement('div');
    castWrap.style.display = 'grid';
    castWrap.style.gridTemplateColumns = '1fr auto';
    castWrap.style.gap = '6px';

    const spellSelect = document.createElement('select');
    spellSelect.style.background = 'rgba(255, 255, 255, 0.08)';
    spellSelect.style.border = '1px solid rgba(255, 255, 255, 0.16)';
    spellSelect.style.borderRadius = '8px';
    spellSelect.style.color = '#f3f5f8';
    spellSelect.style.padding = '8px';

    const castBtn = createCheatButton('Lancer le sort');

    async function refreshSpellSelectOptions() {
        try {
            const game = await import('./game.js');
            const classesModule = await import('./classes.js');
            const activeSpells = Array.isArray(game.player?.activeSpells) ? game.player.activeSpells : [];
            const availableSpells = Array.isArray(game.player?.availableSpells) ? game.player.availableSpells : [];
            const baseSpells = Array.isArray(game.allSpells) ? game.allSpells : [];
            const classSpells = Array.isArray(classesModule.allClassSpells) ? classesModule.allClassSpells : [];

            const uniqueById = new Map();
            [...activeSpells, ...availableSpells, ...baseSpells, ...classSpells].forEach((spell) => {
                if(spell?.id && !uniqueById.has(spell.id)) {
                    uniqueById.set(spell.id, spell);
                }
            });

            const spells = [...uniqueById.values()].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
            spellSelect.innerHTML = '';

            if(spells.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Aucun sort actif';
                spellSelect.appendChild(opt);
                return;
            }

            spells.forEach((spell) => {
                const opt = document.createElement('option');
                opt.value = spell.id;
                const levelLabel = Number.isFinite(spell.minLevel) ? `Nv${spell.minLevel}` : 'Nv?';
                const classLabel = spell.class ? ` | ${spell.class}` : '';
                opt.textContent = `${spell.name || spell.id} (${spell.id}) - ${levelLabel}${classLabel}`;
                spellSelect.appendChild(opt);
            });
        } catch {
            spellSelect.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Erreur chargement sorts';
            spellSelect.appendChild(opt);
        }
    }

    castBtn.addEventListener('click', async () => {
        if(!isEnabled()) return;

        try {
            const game = await import('./game.js');
            const spellId = spellSelect.value;
            if(!spellId) {
                game.log('⚠️ Cheat: aucun sort selectionne.');
                return;
            }

            if(typeof game.castSpellForCheat !== 'function') {
                game.log('⚠️ Cheat: simulateur de sort indisponible.');
                return;
            }

            await game.castSpellForCheat(spellId, { consumeTurn: false });
        } catch {
            // no-op
        }
    });

    const attackBtn = createCheatButton('Attaque de test (arme equipee)');
    attackBtn.addEventListener('click', async () => {
        if(!isEnabled()) return;

        try {
            const game = await import('./game.js');
            if(!game.player.equippedWeapon) {
                game.log('⚠️ Cheat: equipez une arme avant l\'attaque de test.');
                return;
            }
            game.player.combatPoints = Math.max(game.player.combatPoints || 0, game.player.equippedWeapon.actionPoints || 0);
            game.updateStats();
            game.saveUpdate();
            game.useWeapon();
        } catch {
            // no-op
        }
    });

    const tileWrap = document.createElement('div');
    tileWrap.style.display = 'grid';
    tileWrap.style.gridTemplateColumns = '1fr 1fr 1fr auto';
    tileWrap.style.gap = '6px';

    const tileIndexInput = document.createElement('input');
    tileIndexInput.type = 'number';
    tileIndexInput.min = '0';
    tileIndexInput.placeholder = 'Index';
    tileIndexInput.style.background = 'rgba(255, 255, 255, 0.08)';
    tileIndexInput.style.border = '1px solid rgba(255, 255, 255, 0.16)';
    tileIndexInput.style.borderRadius = '8px';
    tileIndexInput.style.color = '#f3f5f8';
    tileIndexInput.style.padding = '8px';

    const tileColorSelect = document.createElement('select');
    tileColorSelect.style.background = 'rgba(255, 255, 255, 0.08)';
    tileColorSelect.style.border = '1px solid rgba(255, 255, 255, 0.16)';
    tileColorSelect.style.borderRadius = '8px';
    tileColorSelect.style.color = '#f3f5f8';
    tileColorSelect.style.padding = '8px';

    ['red', 'blue', 'green', 'yellow', 'purple', 'skull', 'combat', 'joker'].forEach((tileType) => {
        const opt = document.createElement('option');
        opt.value = tileType;
        opt.textContent = tileType;
        tileColorSelect.appendChild(opt);
    });

    const applyTileBtn = createCheatButton('Appliquer');
    applyTileBtn.style.margin = '0';
    applyTileBtn.style.height = '100%';
    applyTileBtn.addEventListener('click', async () => {
        if(!isEnabled()) return;

        try {
            const boardModule = await import('./board.js');
            const game = await import('./game.js');
            const idx = Number(tileIndexInput.value);

            if(!Number.isInteger(idx) || idx < 0 || idx >= boardModule.board.length) {
                game.log('⚠️ Cheat: index de tuile invalide.');
                return;
            }

            boardModule.board[idx] = tileColorSelect.value;
            boardModule.renderBoard();
            game.log(`🧪 Cheat: tuile ${idx} -> ${tileColorSelect.value}`);
            game.saveUpdate();
        } catch {
            // no-op
        }
    });

    const refillManaBtn = createCheatButton('Ajouter +25 mana (toutes couleurs)');
    refillManaBtn.addEventListener('click', async () => {
        if(!isEnabled()) return;

        try {
            const game = await import('./game.js');
            ['red', 'blue', 'green', 'yellow', 'purple'].forEach((color) => {
                game.player.mana[color] = Math.max(0, (game.player.mana[color] || 0) + 25);
            });
            game.updateStats();
            game.saveUpdate();
            game.log('🧪 Cheat: +25 mana sur toutes les couleurs.');
        } catch {
            // no-op
        }
    });

    castWrap.appendChild(spellSelect);
    castWrap.appendChild(castBtn);

    const cheatLegend1 = document.createElement('div');
    cheatLegend1.textContent = 'Sort actif';
    cheatLegend1.style.fontSize = '0.78rem';
    cheatLegend1.style.opacity = '0.72';

    const cheatLegend2 = document.createElement('div');
    cheatLegend2.textContent = 'Modifier une tuile';
    cheatLegend2.style.fontSize = '0.78rem';
    cheatLegend2.style.opacity = '0.72';

    tileWrap.appendChild(tileIndexInput);
    tileWrap.appendChild(tileColorSelect);
    const spacer = document.createElement('div');
    spacer.style.display = 'none';
    tileWrap.appendChild(spacer);
    tileWrap.appendChild(applyTileBtn);

    cheatToggleBtn.addEventListener('click', async () => {
        const next = !isEnabled();
        setEnabled(next);
        refreshCheatToggleLabel();

        try {
            const game = await import('./game.js');
            game.log(next ? '🧪 Cheat mode active.' : '✅ Cheat mode desactive.');
        } catch {
            // no-op
        }
    });

    cheatControlsWrap.appendChild(refillManaBtn);
    cheatControlsWrap.appendChild(cheatLegend1);
    cheatControlsWrap.appendChild(castWrap);
    cheatControlsWrap.appendChild(attackBtn);
    cheatControlsWrap.appendChild(cheatLegend2);
    cheatControlsWrap.appendChild(tileWrap);

    refreshCheatToggleLabel();
    refreshSpellSelectOptions();

    sectionCheat.appendChild(sectionCheatTitle);
    sectionCheat.appendChild(cheatHint);
    sectionCheat.appendChild(cheatToggleBtn);
    sectionCheat.appendChild(cheatControlsWrap);

    return sectionCheat;
}
