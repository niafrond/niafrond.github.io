export function createMixControls(options) {
  const {
    autoBpmBtn,
    deckAPanel,
    deckBPanel,
    deckFxActions,
    deckMixLabel,
    deckMixSlider,
    distortionBtn,
    echoBtn,
    fxVisibilityBtn,
    getDeckBCueIndex,
    getDeckCueDeck,
    getDeckMixRatio,
    getManualMixLock,
    getMixFeatures,
    getPlayer,
    getQueueLength,
    getFxControlsHidden,
    manualLockBtn,
    onFocusDeckChanged,
    setDeckMixRatio,
    setMixFeatures,
  } = options;

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
    if (!fxVisibilityBtn || !deckFxActions) return;
    deckFxActions.hidden = getFxControlsHidden();
    fxVisibilityBtn.setAttribute('aria-expanded', String(!getFxControlsHidden()));
    fxVisibilityBtn.textContent = getFxControlsHidden() ? 'FX ▸' : 'FX ▾';
  }

  function styleFxButton(btn, active, label) {
    if (!btn) return;
    btn.classList.toggle('is-enabled', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.textContent = `${label}: ${active ? 'ON' : 'OFF'}`;
  }

  function updateMixFeaturesUI() {
    const features = getMixFeatures();
    styleFxButton(autoBpmBtn, features.autoBpm, 'Auto BPM');
    styleFxButton(echoBtn, features.echo, 'Echo');
    styleFxButton(distortionBtn, features.distortion, 'Distorsion');
  }

  function updateDeckCueUI() {
    const inactiveDeck = getDeckCueDeck() || getInactiveDeck();
    const inactivePanel = inactiveDeck === 'A' ? deckAPanel : deckBPanel;
    const otherPanel = inactiveDeck === 'A' ? deckBPanel : deckAPanel;
    if (!inactivePanel) return;
    const hasCue = getDeckBCueIndex() >= 0 && getDeckBCueIndex() < getQueueLength();
    inactivePanel.classList.toggle('has-cue', hasCue);
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

  function setMixFeatureEnabled(name, enabled) {
    setMixFeatures({
      ...getMixFeatures(),
      [name]: Boolean(enabled),
    });
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
