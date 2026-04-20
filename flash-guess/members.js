/**
 * members.js — Membres (historique joueurs) et groupes de joueurs
 */

import { state, GROUPS_KEY } from './state.js';
import { el, showScreen, showToast } from './ui.js';

const MEMBERS_KEY = 'flashguess-members';

// ─── Membres ───────────────────────────────────────────────────────────────────
export function loadMembers() {
  try { return JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]'); } catch { return []; }
}

export function saveMembers(members) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function autoSaveMember(name, isChild = false) {
  const members = loadMembers();
  const existing = members.find(m => m.name === name);
  if (!existing) {
    const entry = { name, games: 0, totalPts: 0 };
    if (isChild) entry.isChild = true;
    members.push(entry);
    saveMembers(members);
  } else if (isChild && !existing.isChild) {
    existing.isChild = true;
    saveMembers(members);
  }
}

export function saveMembersAfterGame() {
  const members = loadMembers();
  state.teams.forEach(team => {
    const teamTotal = team.score.reduce((a, b) => a + b, 0);
    team.players.forEach(playerName => {
      const existing = members.find(m => m.name === playerName);
      if (existing) {
        existing.games    = (existing.games    || 0) + 1;
        existing.totalPts = (existing.totalPts || 0) + teamTotal;
        if (state.playerIsChild.has(playerName)) existing.isChild = true;
      } else {
        const entry = { name: playerName, games: 1, totalPts: teamTotal };
        if (state.playerIsChild.has(playerName)) entry.isChild = true;
        members.push(entry);
      }
    });
  });
  saveMembers(members);
}

export function renderMembersList() {
  const members   = loadMembers();
  const container = el('members-list');
  container.innerHTML = '';

  if (members.length === 0) return;

  const hint = document.createElement('p');
  hint.className = 'members-hint';
  hint.textContent = 'Joueurs enregistrés — cliquez pour ajouter :';
  container.appendChild(hint);

  members.forEach((member, idx) => {
    const alreadyAdded = state.playerNames.includes(member.name);

    const item = document.createElement('div');
    item.className = `member-item${alreadyAdded ? ' member-item--added' : ''}`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'member-item-name';
    nameSpan.textContent = `👤 ${member.name}${member.isChild ? ' 👶' : ''}`;

    const statsSpan = document.createElement('span');
    statsSpan.className = 'member-item-stats';
    statsSpan.textContent = member.games
      ? `${member.games} partie${member.games > 1 ? 's' : ''} · ${member.totalPts || 0} pts`
      : 'Aucune partie';

    item.appendChild(nameSpan);
    item.appendChild(statsSpan);

    if (!alreadyAdded) {
      const childBtn = document.createElement('button');
      childBtn.className = `member-child-btn${member.isChild ? ' member-child-btn--active' : ''}`;
      childBtn.title = member.isChild ? 'Retirer le marquage enfant' : 'Marquer comme enfant (-12 ans)';
      childBtn.textContent = '👦';
      childBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const members2 = loadMembers();
        const m = members2.find(x => x.name === member.name);
        if (m) {
          if (m.isChild) { delete m.isChild; } else { m.isChild = true; }
          saveMembers(members2);
        }
        renderMembersList();
        renderGroupsInSetup();
      });
      item.appendChild(childBtn);
      item.addEventListener('click', () => addPlayerFromMember(member.name));
    } else {
      const badge = document.createElement('span');
      badge.className = 'member-item-added-badge';
      badge.textContent = '✓ Ajouté';
      item.appendChild(badge);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-danger';
    delBtn.setAttribute('aria-label', `Supprimer ${member.name}`);
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeMember(idx); });
    item.appendChild(delBtn);

    container.appendChild(item);
  });
}

export function removeMember(idx) {
  const members = loadMembers();
  members.splice(idx, 1);
  saveMembers(members);
  renderMembersList();
  renderGroupsInSetup();
}

export function addPlayerFromMember(name) {
  if (state.playerNames.includes(name)) { showToast('Déjà dans la partie', 'warn'); return; }
  if (state.playerNames.length >= 20) { showToast('Maximum 20 joueurs', 'warn'); return; }
  const members = loadMembers();
  const member = members.find(m => m.name === name);
  state.playerNames.push(name);
  if (member?.isChild) state.playerIsChild.add(name);
  // Import dynamique pour éviter la dépendance circulaire setup ↔ members
  import('./setup.js').then(({ renderPlayerList, updateKidsModeStatus }) => {
    renderPlayerList();
    updateKidsModeStatus();
  });
  renderMembersList();
  renderGroupsInSetup();
  showToast(`${name} ajouté à la partie ✅`);
}

// ─── Groupes ───────────────────────────────────────────────────────────────────
export function loadGroups() {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch { return []; }
}

export function saveGroups(groups) {
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); } catch (_) { /* ignore */ }
}

let _groupIdCounter = 0;

function generateGroupId() {
  return 'grp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-' + (++_groupIdCounter);
}

export function renderGroupsInSetup() {
  const container = el('groups-in-setup');
  if (!container) return;
  container.innerHTML = '';

  const groups = loadGroups();
  const nonEmpty = groups.filter(g => g.members.length > 0);
  if (nonEmpty.length === 0) return;

  const hint = document.createElement('p');
  hint.className = 'members-hint';
  hint.textContent = 'Groupes — ajoutez tous les membres d\'un coup :';
  container.appendChild(hint);

  const allMembers = loadMembers();
  nonEmpty.forEach(group => {
    const card = document.createElement('div');
    card.className = 'setup-group-card';

    const headerRow = document.createElement('div');
    headerRow.className = 'setup-group-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'setup-group-name';
    nameSpan.textContent = group.name;

    const notAdded = group.members.filter(m => !state.playerNames.includes(m));
    const addAllBtn = document.createElement('button');
    addAllBtn.className = 'btn btn-primary btn-sm';
    addAllBtn.textContent = 'Tout ajouter';
    addAllBtn.disabled = notAdded.length === 0;
    addAllBtn.addEventListener('click', () => {
      let added = 0;
      const freshMembers = loadMembers();
      group.members.forEach(name => {
        if (!state.playerNames.includes(name) && state.playerNames.length < 20) {
          const memberData = freshMembers.find(m => m.name === name);
          state.playerNames.push(name);
          if (memberData?.isChild) state.playerIsChild.add(name);
          added++;
        }
      });
      if (added > 0) {
        import('./setup.js').then(({ renderPlayerList, updateKidsModeStatus }) => {
          renderPlayerList();
          updateKidsModeStatus();
        });
        renderMembersList();
        renderGroupsInSetup();
        showToast(`${added} joueur${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} ✅`);
      }
    });

    headerRow.appendChild(nameSpan);
    headerRow.appendChild(addAllBtn);
    card.appendChild(headerRow);

    const membersRow = document.createElement('div');
    membersRow.className = 'setup-group-members';
    group.members.forEach(name => {
      const memberData = allMembers.find(m => m.name === name);
      const isAdded = state.playerNames.includes(name);
      const isChild = memberData?.isChild ?? false;

      const chip = document.createElement('button');
      chip.className = `setup-group-member${isAdded ? ' setup-group-member--added' : ''}`;
      chip.textContent = `👤 ${name}${isChild ? ' 👶' : ''}`;
      chip.disabled = isAdded;
      chip.title = isAdded ? `${name} déjà dans la partie` : `Ajouter ${name}`;
      if (!isAdded) {
        chip.addEventListener('click', () => addPlayerFromMember(name));
      }
      membersRow.appendChild(chip);
    });
    card.appendChild(membersRow);
    container.appendChild(card);
  });
}

// ─── Éditeur de groupes ───────────────────────────────────────────────────────
let _editingGroupId = null;

export function createNewGroup() {
  const input = el('group-new-name');
  const name = input.value.trim();
  if (!name) { showToast('Entrez un nom de groupe', 'warn'); return; }
  const groups = loadGroups();
  if (groups.find(g => g.name === name)) { showToast('Ce groupe existe déjà', 'warn'); return; }
  groups.push({ id: generateGroupId(), name, members: [] });
  saveGroups(groups);
  input.value = '';
  _editingGroupId = null;
  renderGroupsEditor();
  showToast(`Groupe « ${name} » créé ✅`);
}

export function openGroupsEditor() {
  _editingGroupId = null;
  renderGroupsEditor();
  showScreen('screen-groups');
}

export function renderGroupsEditor() {
  const list = el('groups-editor-list');
  list.innerHTML = '';

  const groups     = loadGroups();
  const allMembers = loadMembers();

  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--text-muted);font-size:0.9rem;text-align:center;padding:20px 0;';
    empty.textContent = 'Aucun groupe — créez-en un ci-dessus !';
    list.appendChild(empty);
    return;
  }

  groups.forEach((group) => {
    const card = document.createElement('div');
    card.className = 'card group-editor-card';

    // ── Header: nom + renommer + supprimer ──
    const header = document.createElement('div');
    header.className = 'group-editor-header';

    if (_editingGroupId === group.id) {
      const input = document.createElement('input');
      input.className = 'input group-rename-input';
      input.value = group.name;
      input.maxLength = 30;
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');

      const doRename = () => {
        const newName = input.value.trim();
        if (!newName) { showToast('Entrez un nom', 'warn'); return; }
        const groups2 = loadGroups();
        const g = groups2.find(x => x.id === group.id);
        if (g) { g.name = newName; saveGroups(groups2); }
        _editingGroupId = null;
        renderGroupsEditor();
        renderGroupsInSetup();
        showToast('Groupe renommé ✅');
      };

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary btn-sm';
      saveBtn.textContent = '✓ OK';
      saveBtn.addEventListener('click', doRename);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doRename(); });

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary btn-sm';
      cancelBtn.textContent = '✕';
      cancelBtn.addEventListener('click', () => { _editingGroupId = null; renderGroupsEditor(); });

      header.appendChild(input);
      header.appendChild(saveBtn);
      header.appendChild(cancelBtn);
    } else {
      const nameSpan = document.createElement('span');
      nameSpan.className = 'group-editor-name';
      nameSpan.textContent = group.name;

      const countSpan = document.createElement('span');
      countSpan.className = 'group-editor-count';
      countSpan.textContent = `${group.members.length} membre${group.members.length !== 1 ? 's' : ''}`;

      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn-icon';
      renameBtn.title = 'Renommer';
      renameBtn.setAttribute('aria-label', `Renommer ${group.name}`);
      renameBtn.textContent = '✏️';
      renameBtn.addEventListener('click', () => { _editingGroupId = group.id; renderGroupsEditor(); });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-danger';
      delBtn.title = 'Supprimer le groupe';
      delBtn.setAttribute('aria-label', `Supprimer ${group.name}`);
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => {
        if (!confirm(`Supprimer le groupe « ${group.name} » ?`)) return;
        const groups2 = loadGroups();
        const removeIdx = groups2.findIndex(x => x.id === group.id);
        if (removeIdx !== -1) groups2.splice(removeIdx, 1);
        saveGroups(groups2);
        renderGroupsEditor();
        renderGroupsInSetup();
      });

      header.appendChild(nameSpan);
      header.appendChild(countSpan);
      header.appendChild(renameBtn);
      header.appendChild(delBtn);
    }
    card.appendChild(header);

    // ── Liste des membres ──
    if (group.members.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.style.cssText = 'color:var(--text-muted);font-size:0.85rem;margin:4px 0 10px;';
      emptyMsg.textContent = 'Aucun membre dans ce groupe.';
      card.appendChild(emptyMsg);
    } else {
      const membersList = document.createElement('div');
      membersList.className = 'group-editor-members';
      group.members.forEach((name) => {
        const memberData = allMembers.find(m => m.name === name);
        const isChild = memberData?.isChild ?? false;

        const chip = document.createElement('div');
        chip.className = 'group-member-chip';

        const nameEl = document.createElement('span');
        nameEl.textContent = `👤 ${name}${isChild ? ' 👶' : ''}`;
        chip.appendChild(nameEl);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-icon btn-danger group-member-remove';
        removeBtn.setAttribute('aria-label', `Retirer ${name} du groupe`);
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => {
          const groups2 = loadGroups();
          const g = groups2.find(x => x.id === group.id);
          if (g) {
            const mi = g.members.indexOf(name);
            if (mi !== -1) g.members.splice(mi, 1);
            saveGroups(groups2);
          }
          renderGroupsEditor();
          renderGroupsInSetup();
        });
        chip.appendChild(removeBtn);
        membersList.appendChild(chip);
      });
      card.appendChild(membersList);
    }

    // ── Ajouter des membres ──
    const addSection = document.createElement('div');
    addSection.className = 'group-editor-add';

    const knownNotInGroup = allMembers.filter(m => !group.members.includes(m.name));
    if (knownNotInGroup.length > 0) {
      const knownLabel = document.createElement('p');
      knownLabel.className = 'group-add-label';
      knownLabel.textContent = 'Ajouter un joueur connu :';
      addSection.appendChild(knownLabel);

      const knownList = document.createElement('div');
      knownList.className = 'group-add-known';
      knownNotInGroup.forEach(member => {
        const isChild = member.isChild ?? false;
        const btn = document.createElement('button');
        btn.className = 'setup-group-member';
        btn.textContent = `👤 ${member.name}${isChild ? ' 👶' : ''}`;
        btn.addEventListener('click', () => {
          const groups2 = loadGroups();
          const g = groups2.find(x => x.id === group.id);
          if (g && !g.members.includes(member.name)) {
            g.members.push(member.name);
            saveGroups(groups2);
          }
          renderGroupsEditor();
          renderGroupsInSetup();
        });
        knownList.appendChild(btn);
      });
      addSection.appendChild(knownList);
    }

    const newLabel = document.createElement('p');
    newLabel.className = 'group-add-label';
    newLabel.textContent = knownNotInGroup.length > 0 ? 'Ou ajouter un nouveau joueur :' : 'Ajouter un joueur :';
    addSection.appendChild(newLabel);

    const inputRow = document.createElement('div');
    inputRow.className = 'input-row';

    const newInput = document.createElement('input');
    newInput.className = 'input';
    newInput.type = 'text';
    newInput.placeholder = 'Prénom…';
    newInput.maxLength = 24;
    newInput.setAttribute('autocomplete', 'off');
    newInput.setAttribute('autocorrect', 'off');

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Ajouter';

    const doAddNew = () => {
      const name = newInput.value.trim();
      if (!name) { showToast('Entrez un prénom', 'warn'); return; }
      const groups2 = loadGroups();
      const g = groups2.find(x => x.id === group.id);
      if (!g) return;
      if (g.members.includes(name)) { showToast(`${name} est déjà dans ce groupe`, 'warn'); return; }
      g.members.push(name);
      saveGroups(groups2);
      autoSaveMember(name);
      newInput.value = '';
      renderGroupsEditor();
      renderGroupsInSetup();
      showToast(`${name} ajouté au groupe ✅`);
    };

    addBtn.addEventListener('click', doAddNew);
    newInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAddNew(); });

    inputRow.appendChild(newInput);
    inputRow.appendChild(addBtn);
    addSection.appendChild(inputRow);

    card.appendChild(addSection);
    list.appendChild(card);
  });
}
