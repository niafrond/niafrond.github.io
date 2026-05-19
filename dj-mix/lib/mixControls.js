export function createMixControls(options) {
  const {
    autoBpmBtn,
    crossfadeControlMix,
    djFxMenu,
    djFxRow,
    mixModeRow,
    deckAPanel,
    deckBPanel,
    deckFxActions,
    deckScopedFxButtons,
    deckMixLabel,
    deckMixSlider,
    distortionBtn,
    echoBtn,
    fxVisibilityBtn,
    getDeckBCueIndex,
    getDeckCueDeck,
    getDeckDisplayItems,
    getDeckMixRatio,
    getManualMixLock,
    getMixFeatures,
    getPlayer,
    getQueueLength,
    getFxControlsHidden,
    manualLockBtn,
    onFocusDeckChanged,
    setDeckCueDeck,
    setDeckMixRatio,
    setMixFeatures,
  } = options;

  const DECK_SCOPED_FEATURES = new Set(['vocalRemove', 'instruRemove']);

  function clampCrossfadeSeconds(value) {
    return Math.max(1, Math.min(30, Number(value) || 12));
  }

  function clampDeckMixRatio(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function getFocusDeck() {
    return getDeckMixRatio() > 0.5 ? 'B' : 'A';
  }

  function getInactiveDeck() {
    return getFocusDeck() === 'A' ? 'B' : 'A';
  }

  function deckToPlatineLabel(deck) {
    return deck === 'A' ? '1' : '2';
  }

  function updateDeckMixUI(ratio) {
    const safeRatio = clampDeckMixRatio(ratio);
    const deckA = Math.round((1 - safeRatio) * 100);
    const deckB = Math.round(safeRatio * 100);
    if (deckMixSlider) {
      deckMixSlider.value = String(deckB);
    }
  }

  function updateManualLockUI() {
    if (!manualLockBtn) return;
    manualLockBtn.setAttribute('aria-pressed', String(getManualMixLock()));
    manualLockBtn.textContent = getManualMixLock() ? 'Auto-Fade: OFF (verrou)' : 'Auto-Fade: ON';
  }

  function updateFxVisibilityUI() {
    if (!fxVisibilityBtn) return;
    const hidden = getFxControlsHidden();
    if (deckFxActions) deckFxActions.hidden = hidden;
    if (djFxRow) djFxRow.hidden = hidden;
    if (djFxMenu) djFxMenu.hidden = hidden;
    if (crossfadeControlMix) crossfadeControlMix.hidden = hidden;
    if (mixModeRow) mixModeRow.hidden = hidden;
    fxVisibilityBtn.setAttribute('aria-expanded', String(!getFxControlsHidden()));
    fxVisibilityBtn.textContent = getFxControlsHidden() ? 'FX ▸' : 'FX ▾';
  }

  function styleFxButton(btn, active, label) {
    if (!btn) return;
    btn.classList.toggle('is-enabled', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.textContent = `${label}: ${active ? 'ON' : 'OFF'}`;
  }

  function styleDeckFxButton(btn, active, label, platineLabel) {
    if (!btn) return;
    btn.classList.toggle('is-enabled', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.setAttribute('title', `${label} platine ${platineLabel}: ${active ? 'ON' : 'OFF'}`);
    btn.setAttribute('aria-label', `${label} platine ${platineLabel}: ${active ? 'activé' : 'désactivé'}`);
  }

  function getDeckFxState(deck) {
    const features = getMixFeatures();
    return features.deckFx?.[deck] || { vocalRemove: false, instruRemove: false };
  }

  function updateMixFeaturesUI() {
    const features = getMixFeatures();
    styleFxButton(autoBpmBtn, features.autoBpm, 'Auto BPM');
    styleFxButton(echoBtn, features.echo, 'Echo');
    styleFxButton(distortionBtn, features.distortion, 'Distorsion');
    styleDeckFxButton(deckScopedFxButtons?.A?.vocalRemoveBtn, getDeckFxState('A').vocalRemove, 'Retrait voix', '1');
    styleDeckFxButton(deckScopedFxButtons?.A?.instruRemoveBtn, getDeckFxState('A').instruRemove, 'Retrait instru', '1');
    styleDeckFxButton(deckScopedFxButtons?.B?.vocalRemoveBtn, getDeckFxState('B').vocalRemove, 'Retrait voix', '2');
    styleDeckFxButton(deckScopedFxButtons?.B?.instruRemoveBtn, getDeckFxState('B').instruRemove, 'Retrait instru', '2');
  }

  function updateDeckCueUI() {
    const manualCueDeck = getDeckCueDeck();
    const hasManualCue = getDeckBCueIndex() >= 0 && getDeckBCueIndex() < getQueueLength();
    const inactiveDeck = getInactiveDeck();
    const cueDeck = (hasManualCue && (manualCueDeck === 'A' || manualCueDeck === 'B'))
      ? (manualCueDeck === inactiveDeck ? manualCueDeck : inactiveDeck)
      : inactiveDeck;

    if (hasManualCue && cueDeck !== manualCueDeck) {
      setDeckCueDeck?.(cueDeck);
    }

    const cuePanel = cueDeck === 'A' ? deckAPanel : deckBPanel;
    const otherPanel = cueDeck === 'A' ? deckBPanel : deckAPanel;
    if (!cuePanel) return;

    const deckDisplayItems = getDeckDisplayItems?.() || {};
    const cueDeckItem = deckDisplayItems[cueDeck] || null;
    const otherDeckItem = deckDisplayItems[cueDeck === 'A' ? 'B' : 'A'] || null;
    const hasPreparedCueDeck = Boolean(cueDeckItem && cueDeckItem.id != null && cueDeckItem.id !== otherDeckItem?.id);

    cuePanel.classList.toggle('has-cue', hasManualCue || hasPreparedCueDeck);
    otherPanel?.classList.remove('has-cue');
  }

  function applyDeckMixRatio(ratio, transitionMs = 140) {
    const prevFocus = getFocusDeck();
    const nextRatio = clampDeckMixRatio(ratio);
    setDeckMixRatio(nextRatio);
    updateDeckMixUI(nextRatio);
    const player = getPlayer();
    if (player) player.setDeckMixRatio(nextRatio, transitionMs);
    const nextFocus = getFocusDeck();
    updateDeckCueUI();
    if (prevFocus !== nextFocus) {
      onFocusDeckChanged?.();
    }
  }

  function applyMixFeatures() {
    const player = getPlayer();
    if (player) player.setMixFeatures(getMixFeatures());
    updateMixFeaturesUI();
  }

  function setMixFeatureEnabled(name, enabled, deck = null) {
    const nextEnabled = Boolean(enabled);
    const features = getMixFeatures();
    if (DECK_SCOPED_FEATURES.has(name)) {
      const targetDeck = deck === 'B' ? 'B' : (deck === 'A' ? 'A' : getFocusDeck());
      const nextDeckFx = {
        A: { vocalRemove: false, instruRemove: false, ...(features.deckFx?.A || {}) },
        B: { vocalRemove: false, instruRemove: false, ...(features.deckFx?.B || {}) },
      };
      nextDeckFx[targetDeck] = {
        ...nextDeckFx[targetDeck],
        [name]: nextEnabled,
      };
      if (name === 'vocalRemove' && nextEnabled) nextDeckFx[targetDeck].instruRemove = false;
      if (name === 'instruRemove' && nextEnabled) nextDeckFx[targetDeck].vocalRemove = false;
      setMixFeatures({
        ...features,
        deckFx: nextDeckFx,
      });
    } else {
      setMixFeatures({
        ...features,
        [name]: nextEnabled,
      });
    }
    applyMixFeatures();
  }

  return {
    applyDeckMixRatio,
    applyMixFeatures,
    clampCrossfadeSeconds,
    clampDeckMixRatio,
    deckToPlatineLabel,
    getFocusDeck,
    getInactiveDeck,
    setMixFeatureEnabled,
    updateDeckCueUI,
    updateDeckMixUI,
    updateFxVisibilityUI,
    updateManualLockUI,
    updateMixFeaturesUI,
  };
}
