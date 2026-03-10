function createCheatButton(label, extraClass = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = `cheat-btn ${extraClass}`.trim();
    return btn;
}

function styleSelectForReadability(selectEl) {
    selectEl.classList.add('cheat-select');
}

function styleOptionForReadability(optionEl) {
    optionEl.classList.add('cheat-option');
}

export function createCheatModeSection({ isEnabled, setEnabled, onCheatApplied }) {
    const notifyCheatApplied = typeof onCheatApplied === 'function' ? onCheatApplied : () => {};
    const spellById = new Map();

    function formatSpellCost(spell) {
        if(!spell) return 'Cout: -';
        if(typeof spell.cost === 'number') {
            return `Cout: ${spell.cost} ${spell.color || 'mana'}`;
        }
        if(spell.cost && typeof spell.cost === 'object') {
            const parts = Object.entries(spell.cost).map(([color, value]) => `${value} ${color}`);
            return `Cout: ${parts.join(' + ')}`;
        }
        return 'Cout: -';
    }

    function buildSpellInfoText(spell) {
        if(!spell) {
            return 'Survole un sort pour voir son effet.';
        }

        const statLine = [];
        if(typeof spell.dmg === 'number') statLine.push(`Degats: ${spell.dmg}`);
        if(typeof spell.heal === 'number') statLine.push(`Soin: ${spell.heal}`);
        if(spell.effect) statLine.push(`Effet: ${spell.effect}`);

        const lines = [
            `${spell.name || spell.id}`,
            formatSpellCost(spell),
            statLine.join(' | ') || 'Effet special',
            spell.description || 'Aucune description disponible.'
        ];

        return lines.join('\n');
    }

    const sectionCheat = document.createElement('div');
    sectionCheat.className = 'cheat-section';

    const sectionCheatTitle = document.createElement('div');
    sectionCheatTitle.textContent = 'Cheat Code';
    sectionCheatTitle.className = 'cheat-title';

    const cheatHint = document.createElement('p');
    cheatHint.textContent = 'Mode test in-game: lancer un sort, attaque de test, changer une tuile.';
    cheatHint.className = 'cheat-hint';

    const cheatToggleBtn = document.createElement('button');
    cheatToggleBtn.type = 'button';
    cheatToggleBtn.className = 'cheat-toggle-btn';

    const cheatControlsWrap = document.createElement('div');
    cheatControlsWrap.className = 'cheat-controls-wrap';

    function refreshCheatToggleLabel() {
        const enabled = isEnabled();
        cheatToggleBtn.innerHTML = enabled
            ? '<strong>Cheat mode: ACTIVE</strong><br><span class="cheat-toggle-sub">Clique pour desactiver</span>'
            : '<strong>Cheat mode: DESACTIVE</strong><br><span class="cheat-toggle-sub">Clique pour activer</span>';
        cheatToggleBtn.classList.toggle('cheat-toggle-btn-active', enabled);
        cheatControlsWrap.classList.toggle('cheat-controls-visible', enabled);
    }

    const castWrap = document.createElement('div');
    castWrap.className = 'cheat-cast-wrap';

    const spellInfo = document.createElement('div');
    spellInfo.className = 'cheat-spell-info';
    spellInfo.textContent = 'Survole un sort pour voir son effet.';

    const spellSelect = document.createElement('select');
    styleSelectForReadability(spellSelect);

    const castBtn = createCheatButton('Lancer le sort');

    async function refreshSpellSelectOptions() {
        try {
            const game = await import('./game.js');
            const classesModule = await import('./classes.js');
            const spellsModule = await import('./spells.js');
            const activeSpells = Array.isArray(game.player?.activeSpells) ? game.player.activeSpells : [];
            const availableSpells = Array.isArray(game.player?.availableSpells) ? game.player.availableSpells : [];
            const baseSpells = Array.isArray(spellsModule.allSpells) ? spellsModule.allSpells : [];
            const classSpells = Array.isArray(classesModule.allClassSpells) ? classesModule.allClassSpells : [];

            const uniqueById = new Map();
            [...activeSpells, ...availableSpells, ...baseSpells, ...classSpells].forEach((spell) => {
                if(spell?.id && !uniqueById.has(spell.id)) {
                    uniqueById.set(spell.id, spell);
                }
            });

            const spells = [...uniqueById.values()].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
            spellSelect.innerHTML = '';
            spellById.clear();

            if(spells.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Aucun sort actif';
                styleOptionForReadability(opt);
                spellSelect.appendChild(opt);
                spellInfo.textContent = 'Aucun sort disponible.';
                return;
            }

            spells.forEach((spell) => {
                spellById.set(spell.id, spell);
                const opt = document.createElement('option');
                opt.value = spell.id;
                opt.textContent = `${spell.name || spell.id}`;
                opt.title = spell.description || buildSpellInfoText(spell);
                styleOptionForReadability(opt);
                spellSelect.appendChild(opt);
            });

            const firstSpell = spellById.get(spellSelect.value) || spells[0] || null;
            if(firstSpell && !spellSelect.value) {
                spellSelect.value = firstSpell.id;
            }
            spellInfo.textContent = buildSpellInfoText(firstSpell);
        } catch {
            spellSelect.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Erreur chargement sorts';
            styleOptionForReadability(opt);
            spellSelect.appendChild(opt);
            spellInfo.textContent = 'Impossible de charger les details des sorts.';
        }
    }

    function refreshSpellInfo() {
        const spell = spellById.get(spellSelect.value) || null;
        spellInfo.textContent = buildSpellInfoText(spell);
    }

    spellSelect.addEventListener('mouseenter', () => {
        refreshSpellInfo();
        spellInfo.classList.add('cheat-spell-info-visible');
    });
    spellSelect.addEventListener('mouseleave', () => {
        spellInfo.classList.remove('cheat-spell-info-visible');
    });
    spellSelect.addEventListener('focus', () => {
        refreshSpellInfo();
        spellInfo.classList.add('cheat-spell-info-visible');
    });
    spellSelect.addEventListener('blur', () => {
        spellInfo.classList.remove('cheat-spell-info-visible');
    });
    spellSelect.addEventListener('change', () => {
        refreshSpellInfo();
        spellInfo.classList.add('cheat-spell-info-visible');
    });

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

            notifyCheatApplied();
            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });

            if(typeof game.forcePlayerTurnForCheat === 'function') {
                game.forcePlayerTurnForCheat();
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
            if(typeof game.forcePlayerTurnForCheat === 'function') {
                game.forcePlayerTurnForCheat();
            }
            game.player.combatPoints = Math.max(game.player.combatPoints || 0, game.player.equippedWeapon.actionPoints || 0);
            game.updateStats();
            game.saveUpdate();
            game.useWeapon();
            notifyCheatApplied();
        } catch {
            // no-op
        }
    });

    const tileWrap = document.createElement('div');
    tileWrap.className = 'cheat-tile-wrap';

    const tileIndexInput = document.createElement('input');
    tileIndexInput.type = 'number';
    tileIndexInput.min = '0';
    tileIndexInput.placeholder = 'Index';
    tileIndexInput.className = 'cheat-input cheat-index-input';

    const tileColorSelect = document.createElement('select');
    styleSelectForReadability(tileColorSelect);

    ['red', 'blue', 'green', 'yellow', 'purple', 'skull', 'combat', 'joker'].forEach((tileType) => {
        const opt = document.createElement('option');
        opt.value = tileType;
        opt.textContent = tileType;
        styleOptionForReadability(opt);
        tileColorSelect.appendChild(opt);
    });

    const applyTileBtn = createCheatButton('Appliquer', 'cheat-apply-btn');
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
            notifyCheatApplied();
        } catch {
            // no-op
        }
    });

    const refillManaBtn = createCheatButton('Ajouter +25 mana (toutes couleurs)');
    refillManaBtn.addEventListener('click', async () => {
        if(!isEnabled()) return;

        try {
            const game = await import('./game.js');
            if(typeof game.forcePlayerTurnForCheat === 'function') {
                game.forcePlayerTurnForCheat();
            }
            ['red', 'blue', 'green', 'yellow', 'purple'].forEach((color) => {
                game.player.mana[color] = Math.max(0, (game.player.mana[color] || 0) + 25);
            });
            game.updateStats();
            game.saveUpdate();
            game.log('🧪 Cheat: +25 mana sur toutes les couleurs.');
            notifyCheatApplied();
        } catch {
            // no-op
        }
    });

    castWrap.appendChild(spellSelect);
    castWrap.appendChild(castBtn);

    const cheatLegend1 = document.createElement('div');
    cheatLegend1.textContent = 'Sort actif';
    cheatLegend1.className = 'cheat-legend';

    const cheatLegend2 = document.createElement('div');
    cheatLegend2.textContent = 'Modifier une tuile';
    cheatLegend2.className = 'cheat-legend';

    tileWrap.appendChild(tileIndexInput);
    tileWrap.appendChild(tileColorSelect);
    const spacer = document.createElement('div');
    spacer.className = 'cheat-spacer';
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
    cheatControlsWrap.appendChild(spellInfo);
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
