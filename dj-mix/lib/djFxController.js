import { toDeck } from './deckHelpers.js';
import { uiState } from './uiState.js';
import { LOOP_CUE_REPEAT_COUNT, LOOP_CUE_INTERVAL_MS } from './constants.js';

const DJ_FX_TRANSITION_MODE = Object.freeze({
  filter: 'filter_sweep_low_high',
  lowPass: 'filter_sweep_low_high',
  highPass: 'filter_sweep_low_high',
  reverb: 'reverb_short_simple',
  roll: 'short_loop',
  loop: 'short_loop',
  beatRepeat: 'short_loop',
  brake: 'brake_tape_stop_simple',
  backspin: 'short_reverse',
  noise: 'filter_automation',
  eq: 'eq_transition_simple',
});

const DJ_FX_TOGGLE_FEATURE = Object.freeze({
  echoDelay: 'echo',
  flangerPhaser: 'distortion',
});

const DJ_FX_TRANSIENT_ACTIONS = new Set([
  'reverb',
  'roll',
  'loop',
  'beatRepeat',
  'brake',
  'backspin',
  'noise',
  'keyShift',
  'scratching',
  'hotCues',
  'loopCue',
  'sampling',
]);


export function createDjFxController(options) {
  const {
    applyMixFeatures,
    applyTransitionModeSetting,
    djFxButtons,
    getAutomixCurrentPlayingDeck,
    getCurrentIndex,
    getCurrentTrackMixData,
    getDeckDisplayItems,
    getDeckMixRatio,
    getMixFeatures,
    getNextTrackMixData,
    getPlayer,
    getQueue,
    getSelectedTransitionMode,
    getTrackMixData,
    setMixFeatureEnabled,
    setMixFeatures,
    showToast,
    transitionModeLabels,
  } = options;

  const SAMPLER_SOUND_URLS = [
    new URL('../resources/sample_airhorn.wav', import.meta.url).href,
    new URL('../resources/sample_stab.wav', import.meta.url).href,
    new URL('../resources/sample_laser.wav', import.meta.url).href,
    new URL('../resources/sample_siren.wav', import.meta.url).href,
  ];

  const runtime = {
    loopTimers: { A: null, B: null },
    playbackRateTimers: { A: null, B: null },
    samplingAudioContext: null,
    vinylNoiseBuffer: null,
    scratchSoundBuffer: null,
    samplerSoundBuffers: null,
    scratch: {
      animationFrameId: null,
      deck: 'A',
      velocity: 0,
      currentRate: 0,
      endAtMs: 0,
      lastReverseSeekAtMs: 0,
      running: false,
    },
    transientActionTimers: new Map(),
    autoDjRestoreTimers: new Map(),
    activeTransientActions: new Set(),
  };

  function getFocusedDeckForFx() {
    return getDeckMixRatio() > 0.5 ? 'B' : 'A';
  }

  function getDeckStateForFx(deck) {
    const state = uiState.lastDeckState;
    if (!state) return null;
    return deck === 'B' ? state.deckB : state.deckA;
  }

  function clearDeckLoopFx(deck) {
    const timer = runtime.loopTimers[deck];
    if (timer) {
      clearInterval(timer);
      runtime.loopTimers[deck] = null;
    }
  }

  function setDeckFilterMode(mode, deck = getFocusedDeckForFx()) {
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const safeMode = mode === 'lowPass' || mode === 'highPass' ? mode : 'off';
    const features = getMixFeatures();
    const nextDeckFx = {
      A: { vocalRemove: false, instruRemove: false, filterMode: 'off', ...(features.deckFx?.A || {}) },
      B: { vocalRemove: false, instruRemove: false, filterMode: 'off', ...(features.deckFx?.B || {}) },
    };
    nextDeckFx[safeDeck] = {
      ...nextDeckFx[safeDeck],
      filterMode: safeMode,
    };

    setMixFeatures({
      ...features,
      deckFx: nextDeckFx,
    });
    applyMixFeatures();
    updateDjFxMenuUI();
  }

  function cycleFocusedDeckFilterMode() {
    const deck = getFocusedDeckForFx();
    const currentMode = getMixFeatures().deckFx?.[deck]?.filterMode || 'off';
    const nextMode = currentMode === 'off'
      ? 'lowPass'
      : currentMode === 'lowPass'
        ? 'highPass'
        : 'off';
    setDeckFilterMode(nextMode, deck);
    const label = nextMode === 'off' ? 'Filter OFF' : (nextMode === 'lowPass' ? 'Low-pass ON' : 'High-pass ON');
    showToast(label);
  }

  function applyTemporaryDeckPlaybackRate(deck, targetRate, durationMs = 1600) {
    const player = getPlayer();
    if (!player) return;
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const safeRate = Math.max(0.55, Math.min(1.45, Number(targetRate) || 1));
    player.setDeckPlaybackRate(safeDeck, safeRate);

    const prevTimer = runtime.playbackRateTimers[safeDeck];
    if (prevTimer) clearTimeout(prevTimer);
    runtime.playbackRateTimers[safeDeck] = setTimeout(() => {
      getPlayer()?.resetDeckPlaybackRate(safeDeck);
      runtime.playbackRateTimers[safeDeck] = null;
    }, Math.max(120, Number(durationMs) || 1600));
  }

  function triggerLoopRoll(deck, options = {}) {
    const player = getPlayer();
    if (!player) return;
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const state = getDeckStateForFx(safeDeck);
    const anchorMs = 'anchorMs' in options ? Number(options.anchorMs) : (Number(state?.positionMs) || 0);
    const durationMs = 'durationMs' in options ? Number(options.durationMs) : (Number(state?.durationMs) || 0);
    if (anchorMs <= 0 || durationMs <= 0) return;

    const windowMs = Math.max(90, Number(options.windowMs) || 220);
    const totalMs = Math.max(180, Number(options.totalMs) || 1300);
    const tickMs = Math.max(55, Number(options.tickMs) || 110);
    const instantSeek = options.instantSeek === true;
    const loopStartMs = Math.max(0, Math.min(durationMs - 5, anchorMs - windowMs));

    clearDeckLoopFx(safeDeck);
    const startedAt = Date.now();
    runtime.loopTimers[safeDeck] = setInterval(() => {
      const livePlayer = getPlayer();
      if (!livePlayer) {
        clearDeckLoopFx(safeDeck);
        return;
      }
      livePlayer.seekDeckTo(
        safeDeck,
        loopStartMs,
        instantSeek ? { instant: true } : { fadeMs: 52 },
      ).catch(() => {});
      if (Date.now() - startedAt >= totalMs) {
        clearDeckLoopFx(safeDeck);
      }
    }, tickMs);
  }

  function triggerBackspinFx(deck) {
    if (!getPlayer()) return;
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const state = getDeckStateForFx(safeDeck);
    const anchorMs = Number(state?.positionMs) || 0;
    if (anchorMs <= 200) return;

    applyTemporaryDeckPlaybackRate(safeDeck, 1.18, 640);
    for (let i = 0; i < 8; i += 1) {
      const targetMs = Math.max(0, anchorMs - ((i + 1) * 90));
      setTimeout(() => {
        getPlayer()?.seekDeckTo(safeDeck, targetMs, { instant: true }).catch(() => {});
      }, i * 66);
    }
  }

  async function getOrCreateFxAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    if (!runtime.samplingAudioContext) {
      runtime.samplingAudioContext = new Ctx();
    }

    const ctx = runtime.samplingAudioContext;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return null;
      }
    }

    if (ctx.state === 'closed') return null;
    return ctx;
  }

  function getOrCreateVinylNoiseBuffer(ctx) {
    if (!ctx) return null;
    if (runtime.vinylNoiseBuffer) return runtime.vinylNoiseBuffer;

    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = ((Math.random() * 2) - 1) * 0.02;
    }

    runtime.vinylNoiseBuffer = buffer;
    return buffer;
  }

  async function loadScratchSoundBuffer(ctx) {
    if (runtime.scratchSoundBuffer) return runtime.scratchSoundBuffer;
    try {
      const url = new URL('../resources/scratch_sound.mp3', import.meta.url).href;
      const response = await fetch(url);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      runtime.scratchSoundBuffer = await ctx.decodeAudioData(arrayBuffer);
      return runtime.scratchSoundBuffer;
    } catch (_) {
      return null;
    }
  }

  async function loadSamplerSoundBuffers(ctx) {
    if (runtime.samplerSoundBuffers) return runtime.samplerSoundBuffers;
    const buffers = await Promise.all(
      SAMPLER_SOUND_URLS.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          const arrayBuffer = await response.arrayBuffer();
          return ctx.decodeAudioData(arrayBuffer);
        } catch (_) {
          return null;
        }
      }),
    );
    const valid = buffers.filter(Boolean);
    if (valid.length > 0) {
      runtime.samplerSoundBuffers = valid;
    }
    return runtime.samplerSoundBuffers || null;
  }

  async function playVinylNoise(intensity = 1) {
    const ctx = await getOrCreateFxAudioContext();
    if (!ctx) return;

    const safeIntensity = Math.max(0.15, Math.min(2, Number(intensity) || 1));
    const scratchBuffer = await loadScratchSoundBuffer(ctx);

    if (scratchBuffer) {
      const playDuration = 0.55 + Math.random() * 0.25;
      const maxOffset = Math.max(0, scratchBuffer.duration - playDuration);
      const startOffset = maxOffset > 0.01 ? Math.random() * maxOffset : 0;

      const source = ctx.createBufferSource();
      source.buffer = scratchBuffer;
      source.playbackRate.value = 0.85 + Math.random() * 0.35;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(safeIntensity, ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime + playDuration * 0.65, 0.06);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime, startOffset, playDuration);
      return;
    }

    // Fallback: generated white noise
    const noiseBuffer = getOrCreateVinylNoiseBuffer(ctx);
    if (!noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(1200, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05 * safeIntensity, ctx.currentTime);

    noise.connect(highPass);
    highPass.connect(gain);
    gain.connect(ctx.destination);

    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.12);
  }

  function setScratchVelocity(value) {
    const velocity = Number(value) || 0;
    runtime.scratch.velocity = Math.max(-2, Math.min(2, velocity));
  }

  function stopScratchEngine(resetPlaybackRate = true) {
    const scratch = runtime.scratch;
    if (scratch.animationFrameId) {
      cancelAnimationFrame(scratch.animationFrameId);
      scratch.animationFrameId = null;
    }
    scratch.running = false;
    scratch.velocity = 0;
    scratch.currentRate = 0;
    scratch.endAtMs = 0;
    scratch.lastReverseSeekAtMs = 0;

    if (resetPlaybackRate && getPlayer()) {
      getPlayer().resetDeckPlaybackRate(scratch.deck === 'B' ? 'B' : 'A');
    }
  }

  function runScratchEngineFrame() {
    const scratch = runtime.scratch;
    const player = getPlayer();
    if (!scratch.running || !player) {
      scratch.animationFrameId = null;
      return;
    }

    const nowMs = window.performance?.now?.() || Date.now();
    const deck = scratch.deck === 'B' ? 'B' : 'A';
    const targetRate = Math.max(-2, Math.min(2, Number(scratch.velocity) || 0));

    scratch.currentRate = (scratch.currentRate * 0.8) + (targetRate * 0.2);

    if (scratch.currentRate >= -0.03) {
      const forwardRate = 1 + (Math.abs(scratch.currentRate) * 0.32);
      player.setDeckPlaybackRate(deck, Math.max(0.82, Math.min(1.62, forwardRate)));
    } else {
      const pullStrength = Math.abs(scratch.currentRate);
      player.setDeckPlaybackRate(deck, Math.max(0.7, 1 - (pullStrength * 0.2)));

      const cadenceMs = Math.max(48, 92 - (pullStrength * 22));
      if ((nowMs - scratch.lastReverseSeekAtMs) >= cadenceMs) {
        const state = getDeckStateForFx(deck);
        const positionMs = Number(state?.positionMs) || 0;
        const durationMs = Number(state?.durationMs) || 0;
        if (positionMs > 0 && durationMs > 0) {
          const pullMs = Math.max(26, Math.min(140, 28 + (pullStrength * 42)));
          const targetMs = Math.max(0, Math.min(durationMs - 5, positionMs - pullMs));
          player.seekDeckTo(deck, targetMs, { instant: true }).catch(() => {});
        }
        scratch.lastReverseSeekAtMs = nowMs;
      }
    }

    if (nowMs >= scratch.endAtMs && Math.abs(targetRate) < 0.02 && Math.abs(scratch.currentRate) < 0.03) {
      stopScratchEngine(true);
      return;
    }

    scratch.animationFrameId = requestAnimationFrame(runScratchEngineFrame);
  }

  function ensureScratchEngine(deck, durationMs = 520) {
    const scratch = runtime.scratch;
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const previousDeck = scratch.deck === 'B' ? 'B' : 'A';
    if (scratch.running && previousDeck !== safeDeck && getPlayer()) {
      getPlayer().resetDeckPlaybackRate(previousDeck);
    }
    scratch.deck = safeDeck;
    scratch.endAtMs = Math.max(scratch.endAtMs, (window.performance?.now?.() || Date.now()) + Math.max(180, Number(durationMs) || 520));
    scratch.running = true;

    const prevRateTimer = runtime.playbackRateTimers[safeDeck];
    if (prevRateTimer) {
      clearTimeout(prevRateTimer);
      runtime.playbackRateTimers[safeDeck] = null;
    }

    if (!scratch.animationFrameId) {
      scratch.animationFrameId = requestAnimationFrame(runScratchEngineFrame);
    }
  }

  function triggerScratchFx() {
    if (!getPlayer()) return;
    playVinylNoise(1);
  }

  function resolveCueCandidatesMs(deck, durationMs) {
    const safeDeck = toDeck(deck);
    const deckDisplayItems = getDeckDisplayItems();
    const queue = getQueue();
    const currentIndex = getCurrentIndex();
    const item = deckDisplayItems[safeDeck] || queue[currentIndex] || null;
    const mixData = getTrackMixData(item)
      || (safeDeck === getAutomixCurrentPlayingDeck() ? getCurrentTrackMixData?.() : getNextTrackMixData?.())
      || null;

    const cueCandidatesMs = [];
    const pushCue = (sec) => {
      const ms = Math.round(Number(sec) * 1000);
      if (!Number.isFinite(ms) || ms <= 800 || ms >= (durationMs - 800)) return;
      cueCandidatesMs.push(ms);
    };

    const zoneLists = [mixData?.dropZones, mixData?.peakZones, mixData?.safeTransitionZones];
    for (const zones of zoneLists) {
      if (!Array.isArray(zones)) continue;
      for (const zone of zones) {
        pushCue(zone?.startSec);
        if (cueCandidatesMs.length >= 8) break;
      }
      if (cueCandidatesMs.length >= 8) break;
    }

    if (!cueCandidatesMs.length) {
      cueCandidatesMs.push(
        Math.round(durationMs * 0.2),
        Math.round(durationMs * 0.4),
        Math.round(durationMs * 0.6),
        Math.round(durationMs * 0.8),
      );
    }

    return [...new Set(cueCandidatesMs)].sort((a, b) => a - b);
  }

  function triggerHotCueFx(deck) {
    const player = getPlayer();
    if (!player) return;
    const safeDeck = toDeck(deck);
    const state = getDeckStateForFx(safeDeck);
    const durationMs = Number(state?.durationMs) || 0;
    if (durationMs <= 0) return;

    const uniqueCues = resolveCueCandidatesMs(safeDeck, durationMs);
    if (!uniqueCues.length) return;

    const currentPositionMs = Math.max(0, Number(state?.positionMs) || 0);
    const nextCueIndex = uniqueCues.findIndex((cueMs) => cueMs > currentPositionMs);
    if (nextCueIndex < 0) return;
    const targetMs = uniqueCues[nextCueIndex];

    player.seekDeckTo(safeDeck, targetMs, { fadeMs: 34 }).catch(() => {});
  }

  function triggerLoopCueFx(deck, repeatCount = LOOP_CUE_REPEAT_COUNT, waitMs = LOOP_CUE_INTERVAL_MS) {
    const player = getPlayer();
    if (!player) return false;
    const safeDeck = toDeck(deck);
    const state = getDeckStateForFx(safeDeck);
    const durationMs = Number(state?.durationMs) || 0;
    if (durationMs <= 0) return false;

    const uniqueCues = resolveCueCandidatesMs(safeDeck, durationMs);
    if (!uniqueCues.length) return false;

    const currentPositionMs = Math.max(0, Number(state?.positionMs) || 0);
    const prevCueCandidates = uniqueCues.filter((cueMs) => cueMs < currentPositionMs);
    const targetMs = prevCueCandidates.length
      ? prevCueCandidates[prevCueCandidates.length - 1]
      : uniqueCues[uniqueCues.length - 1];

    const safeRepeatCount = Math.max(1, Math.min(12, Number(repeatCount) || LOOP_CUE_REPEAT_COUNT));
    const safeWaitMs = Math.max(250, Math.min(6000, Number(waitMs) || LOOP_CUE_INTERVAL_MS));
    for (let i = 0; i < safeRepeatCount; i += 1) {
      setTimeout(() => {
        getPlayer()?.seekDeckTo(safeDeck, targetMs, { fadeMs: 28 }).catch(() => {});
      }, i * safeWaitMs);
    }

    return true;
  }

  async function triggerSamplingFx() {
    try {
      const ctx = await getOrCreateFxAudioContext();
      if (!ctx) {
        showToast('Sampling indisponible: AudioContext non supporte.', true);
        return;
      }

      const buffers = await loadSamplerSoundBuffers(ctx);
      if (!buffers || buffers.length === 0) {
        showToast('Sampling indisponible: samples introuvables.', true);
        return;
      }

      const buffer = buffers[Math.floor(Math.random() * buffers.length)];
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 0.9 + Math.random() * 0.2;

      const gain = ctx.createGain();
      const now = ctx.currentTime + 0.01;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.85, now + 0.02);
      gain.gain.setTargetAtTime(0, now + buffer.duration * 0.7, 0.08);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);
    } catch (err) {
      showToast(`Sampling indisponible: ${err?.message || 'erreur audio'}`, true);
    }
  }

  function triggerBrakeFx(deck) {
    if (!getPlayer()) return;
    const safeDeck = deck === 'B' ? 'B' : 'A';
    let step = 0;
    const maxSteps = 12;
    const timer = setInterval(() => {
      step += 1;
      const ratio = step / maxSteps;
      const rate = Math.max(0.35, 1 - (ratio * 0.7));
      getPlayer()?.setDeckPlaybackRate(safeDeck, rate);
      if (step >= maxSteps) {
        clearInterval(timer);
        setTimeout(() => getPlayer()?.resetDeckPlaybackRate(safeDeck), 120);
      }
    }, 48);
  }

  function triggerFlangerPhaserFx(deck) {
    if (!getPlayer()) return;
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const startedAt = Date.now();
    const totalMs = 1500;
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const phase = elapsed / 85;
      const rate = 1 + (Math.sin(phase) * 0.06);
      getPlayer()?.setDeckPlaybackRate(safeDeck, rate);
      if (elapsed >= totalMs) {
        clearInterval(timer);
        getPlayer()?.resetDeckPlaybackRate(safeDeck);
      }
    }, 70);
  }

  function triggerNoiseFx() {
    void playVinylNoise(1.35);
    void triggerSamplingFx();
  }

  function triggerTransientDjFxAction(action, durationMs = 900) {
    if (!action) return;

    runtime.activeTransientActions.add(action);
    const prevTimer = runtime.transientActionTimers.get(action);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    const safeDuration = Math.max(120, Number(durationMs) || 900);
    const timer = setTimeout(() => {
      runtime.activeTransientActions.delete(action);
      runtime.transientActionTimers.delete(action);
      updateDjFxMenuUI();
    }, safeDuration);

    runtime.transientActionTimers.set(action, timer);
    updateDjFxMenuUI();
  }

  function scheduleAutoDjRestoreTimer(key, durationMs, restoreFn) {
    if (!key || typeof restoreFn !== 'function') return;
    const prevTimer = runtime.autoDjRestoreTimers.get(key);
    if (prevTimer) clearTimeout(prevTimer);

    const safeDuration = Math.max(120, Number(durationMs) || 900);
    const timer = setTimeout(() => {
      runtime.autoDjRestoreTimers.delete(key);
      restoreFn();
      updateDjFxMenuUI();
    }, safeDuration);

    runtime.autoDjRestoreTimers.set(key, timer);
  }

  function scheduleAutoDjMixFeatureRestore(feature, previousValue, durationMs) {
    const key = `feature:${feature}`;
    const expectedCurrent = !Boolean(previousValue);
    scheduleAutoDjRestoreTimer(key, durationMs, () => {
      if (Boolean(getMixFeatures()?.[feature]) === expectedCurrent) {
        setMixFeatureEnabled(feature, Boolean(previousValue));
      }
    });
  }

  function scheduleAutoDjFilterRestore(deck, previousMode, durationMs) {
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const prevMode = previousMode === 'lowPass' || previousMode === 'highPass' ? previousMode : 'off';
    scheduleAutoDjRestoreTimer(`filter:${safeDeck}`, durationMs, () => {
      const currentMode = getMixFeatures().deckFx?.[safeDeck]?.filterMode || 'off';
      if (currentMode !== prevMode) {
        setDeckFilterMode(prevMode, safeDeck);
      }
    });
  }

  function updateDjFxMenuUI() {
    if (!djFxButtons.length) return;
    const focusDeck = getFocusedDeckForFx();
    const focusFilterMode = getMixFeatures().deckFx?.[focusDeck]?.filterMode || 'off';
    for (const btn of djFxButtons) {
      const action = String(btn.dataset.fxAction || '');
      const feature = DJ_FX_TOGGLE_FEATURE[action];
      const transitionMode = DJ_FX_TRANSITION_MODE[action];

      let isEnabled = false;
      if (DJ_FX_TRANSIENT_ACTIONS.has(action)) {
        isEnabled = runtime.activeTransientActions.has(action);
      } else if (action === 'filter') {
        isEnabled = focusFilterMode !== 'off';
      } else if (action === 'lowPass') {
        isEnabled = focusFilterMode === 'lowPass';
      } else if (action === 'highPass') {
        isEnabled = focusFilterMode === 'highPass';
      } else if (action === 'vocalRemove') {
        isEnabled = Boolean(getMixFeatures().deckFx?.[focusDeck]?.vocalRemove);
      } else if (action === 'instruRemove') {
        isEnabled = Boolean(getMixFeatures().deckFx?.[focusDeck]?.instruRemove);
      } else if (feature) {
        isEnabled = Boolean(getMixFeatures()?.[feature]);
      } else if (transitionMode) {
        isEnabled = getSelectedTransitionMode() === transitionMode;
      }

      btn.classList.toggle('is-enabled', isEnabled);
      btn.setAttribute('aria-pressed', String(isEnabled));
    }
  }

  function applyDjFxTransition(action, toastLabel, suppressToast = false) {
    const transitionMode = DJ_FX_TRANSITION_MODE[action];
    if (!transitionMode) return;
    applyTransitionModeSetting(transitionMode, { persist: true });
    const label = transitionModeLabels[getSelectedTransitionMode()] || getSelectedTransitionMode();
    if (!suppressToast) showToast(`${toastLabel} -> ${label}`);
  }

  function toggleDjFxFeature(action, toastLabel, afterEnable, suppressToast = false) {
    const feature = DJ_FX_TOGGLE_FEATURE[action];
    if (!feature) return;
    const nextEnabled = !Boolean(getMixFeatures()?.[feature]);
    setMixFeatureEnabled(feature, nextEnabled);
    if (nextEnabled) afterEnable?.();
    if (!suppressToast) showToast(`${toastLabel}: ${nextEnabled ? 'ON' : 'OFF'}`);
    updateDjFxMenuUI();
  }

  function handleDjFxAction(action) {
    const focusDeck = getFocusedDeckForFx();

    switch (action) {
      case 'filter':
        cycleFocusedDeckFilterMode();
        applyDjFxTransition('filter', 'Filter mode AutoMix', true);
        break;
      case 'lowPass':
        setDeckFilterMode(getMixFeatures().deckFx?.[focusDeck]?.filterMode === 'lowPass' ? 'off' : 'lowPass', focusDeck);
        applyDjFxTransition('lowPass', 'Low-pass AutoMix', true);
        break;
      case 'highPass':
        setDeckFilterMode(getMixFeatures().deckFx?.[focusDeck]?.filterMode === 'highPass' ? 'off' : 'highPass', focusDeck);
        applyDjFxTransition('highPass', 'High-pass AutoMix', true);
        break;
      case 'vocalRemove': {
        const enabled = Boolean(getMixFeatures().deckFx?.[focusDeck]?.vocalRemove);
        setMixFeatureEnabled('vocalRemove', !enabled, focusDeck);
        break;
      }
      case 'instruRemove': {
        const enabled = Boolean(getMixFeatures().deckFx?.[focusDeck]?.instruRemove);
        setMixFeatureEnabled('instruRemove', !enabled, focusDeck);
        break;
      }
      case 'echoDelay':
        toggleDjFxFeature('echoDelay', 'Echo / Delay', undefined, true);
        break;
      case 'reverb':
        setMixFeatureEnabled('echo', true);
        setMixFeatureEnabled('distortion', true);
        triggerTransientDjFxAction('reverb', 1200);
        setTimeout(() => {
          setMixFeatureEnabled('echo', false);
          setMixFeatureEnabled('distortion', false);
          updateDjFxMenuUI();
        }, 1200);
        break;
      case 'flangerPhaser':
        triggerFlangerPhaserFx(focusDeck);
        toggleDjFxFeature('flangerPhaser', 'Flanger / Phaser', undefined, true);
        break;
      case 'roll':
        triggerLoopRoll(focusDeck, { windowMs: 220, totalMs: 1100, tickMs: 105 });
        triggerTransientDjFxAction('roll', 1000);
        break;
      case 'loop':
        triggerLoopRoll(focusDeck, { windowMs: 520, totalMs: 2400, tickMs: 115 });
        triggerTransientDjFxAction('loop', 2600);
        break;
      case 'beatRepeat':
        triggerLoopRoll(focusDeck, { windowMs: 140, totalMs: 950, tickMs: 90, instantSeek: true });
        triggerTransientDjFxAction('beatRepeat', 900);
        break;
      case 'brake':
        triggerBrakeFx(focusDeck);
        triggerTransientDjFxAction('brake', 900);
        break;
      case 'backspin':
        triggerBackspinFx(focusDeck);
        triggerTransientDjFxAction('backspin', 1200);
        break;
      case 'noise':
        triggerNoiseFx();
        triggerTransientDjFxAction('noise', 800);
        break;
      case 'eq':
        cycleFocusedDeckFilterMode();
        applyDjFxTransition('eq', 'EQ AutoMix', true);
        break;
      case 'keyShift':
        applyTemporaryDeckPlaybackRate(focusDeck, 1.035, 1800);
        triggerTransientDjFxAction('keyShift', 1800);
        break;
      case 'scratching':
        triggerScratchFx(focusDeck);
        triggerTransientDjFxAction('scratching', 450);
        break;
      case 'hotCues':
        triggerHotCueFx(focusDeck);
        triggerTransientDjFxAction('hotCues', 450);
        break;
      case 'loopCue': {
        const didTrigger = triggerLoopCueFx(focusDeck, LOOP_CUE_REPEAT_COUNT, LOOP_CUE_INTERVAL_MS);
        if (didTrigger) {
          triggerTransientDjFxAction('loopCue', (LOOP_CUE_REPEAT_COUNT * LOOP_CUE_INTERVAL_MS) + 400);
        }
        break;
      }
      case 'sampling':
        void triggerSamplingFx();
        triggerTransientDjFxAction('sampling', 500);
        break;
      default:
        break;
    }
  }

  function applyAutoDjCreativeFx(type, targetDeck) {
    const safeDeck = targetDeck === 'B' ? 'B' : 'A';
    switch (type) {
      case 'filter':
        {
          const prevMode = getMixFeatures().deckFx?.[safeDeck]?.filterMode || 'off';
          setDeckFilterMode('lowPass', safeDeck);
          scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
        }
        return true;
      case 'lowPass':
        {
          const prevMode = getMixFeatures().deckFx?.[safeDeck]?.filterMode || 'off';
          setDeckFilterMode('lowPass', safeDeck);
          scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
        }
        return true;
      case 'highPass':
        {
          const prevMode = getMixFeatures().deckFx?.[safeDeck]?.filterMode || 'off';
          setDeckFilterMode('highPass', safeDeck);
          scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
        }
        return true;
      case 'echoDelay':
        {
          const prevEcho = Boolean(getMixFeatures().echo);
          setMixFeatureEnabled('echo', true);
          scheduleAutoDjMixFeatureRestore('echo', prevEcho, 1200);
        }
        triggerTransientDjFxAction('echoDelay', 1200);
        return true;
      case 'reverb':
        {
          const prevEcho = Boolean(getMixFeatures().echo);
          const prevDistortion = Boolean(getMixFeatures().distortion);
          setMixFeatureEnabled('echo', true);
          setMixFeatureEnabled('distortion', true);
          scheduleAutoDjMixFeatureRestore('echo', prevEcho, 1200);
          scheduleAutoDjMixFeatureRestore('distortion', prevDistortion, 1200);
        }
        triggerTransientDjFxAction('reverb', 1200);
        return true;
      case 'flangerPhaser':
        {
          const prevDistortion = Boolean(getMixFeatures().distortion);
          setMixFeatureEnabled('distortion', true);
          scheduleAutoDjMixFeatureRestore('distortion', prevDistortion, 1600);
        }
        triggerFlangerPhaserFx(safeDeck);
        triggerTransientDjFxAction('flangerPhaser', 1600);
        return true;
      case 'roll':
        triggerLoopRoll(safeDeck, { windowMs: 220, totalMs: 1100, tickMs: 105 });
        triggerTransientDjFxAction('roll', 1000);
        return true;
      case 'loop':
        triggerLoopRoll(safeDeck, { windowMs: 520, totalMs: 2400, tickMs: 115 });
        triggerTransientDjFxAction('loop', 2600);
        return true;
      case 'beatRepeat':
        triggerLoopRoll(safeDeck, { windowMs: 140, totalMs: 950, tickMs: 90, instantSeek: true });
        triggerTransientDjFxAction('beatRepeat', 900);
        return true;
      case 'brake':
        triggerBrakeFx(safeDeck);
        triggerTransientDjFxAction('brake', 900);
        return true;
      case 'backspin':
        triggerBackspinFx(safeDeck);
        triggerTransientDjFxAction('backspin', 1200);
        return true;
      case 'noise':
        triggerNoiseFx();
        triggerTransientDjFxAction('noise', 800);
        return true;
      case 'eq':
        {
          const prevMode = getMixFeatures().deckFx?.[safeDeck]?.filterMode || 'off';
          setDeckFilterMode('highPass', safeDeck);
          scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
        }
        return true;
      case 'keyShift':
        applyTemporaryDeckPlaybackRate(safeDeck, 1.035, 1800);
        triggerTransientDjFxAction('keyShift', 1800);
        return true;
      case 'scratching':
        triggerScratchFx(safeDeck);
        triggerTransientDjFxAction('scratching', 450);
        return true;
      case 'hotCues':
        triggerHotCueFx(safeDeck);
        triggerTransientDjFxAction('hotCues', 450);
        return true;
      case 'loopCue':
        if (triggerLoopCueFx(safeDeck, LOOP_CUE_REPEAT_COUNT, LOOP_CUE_INTERVAL_MS)) {
          triggerTransientDjFxAction('loopCue', (LOOP_CUE_REPEAT_COUNT * LOOP_CUE_INTERVAL_MS) + 400);
        }
        return true;
      case 'sampling':
        void triggerSamplingFx();
        triggerTransientDjFxAction('sampling', 500);
        return true;
      default:
        return false;
    }
  }

  function triggerBeatRepeatTransitionFx(outgoingDeck, incomingDeck, phaseDurationMs, bpm) {
    const safeBpm = Math.max(60, Math.min(220, Number(bpm) || 120));
    const eighthNoteMs = Math.round(30000 / safeBpm);
    const windowMs = Math.max(60, Math.min(500, eighthNoteMs));
    const tickMs = windowMs;
    const totalMs = Math.max(500, Math.round(Number(phaseDurationMs) || 3900));
    const safeOut = outgoingDeck === 'B' ? 'B' : 'A';
    const safeIn = incomingDeck === 'B' ? 'B' : 'A';

    triggerLoopRoll(safeOut, { windowMs, totalMs, tickMs, instantSeek: true });

    setTimeout(() => {
      const state = getDeckStateForFx(safeIn);
      const currentPos = Number(state?.positionMs) || 0;
      const currentDur = Number(state?.durationMs) || 0;
      if (currentDur > 0) {
        const anchorMs = Math.max(windowMs, currentPos);
        triggerLoopRoll(safeIn, {
          windowMs,
          totalMs: Math.max(200, totalMs - 350),
          tickMs,
          instantSeek: true,
          anchorMs,
          durationMs: currentDur,
        });
      }
    }, 350);
  }

  function resetRuntimeState() {
    stopScratchEngine(false);

    clearDeckLoopFx('A');
    clearDeckLoopFx('B');

    for (const key of ['A', 'B']) {
      const timer = runtime.playbackRateTimers[key];
      if (timer) {
        clearTimeout(timer);
        runtime.playbackRateTimers[key] = null;
      }
    }

    for (const timer of runtime.transientActionTimers.values()) {
      clearTimeout(timer);
    }
    runtime.transientActionTimers.clear();

    for (const timer of runtime.autoDjRestoreTimers.values()) {
      clearTimeout(timer);
    }
    runtime.autoDjRestoreTimers.clear();
    runtime.activeTransientActions.clear();

    updateDjFxMenuUI();
  }

  return {
    applyAutoDjCreativeFx,
    handleDjFxAction,
    resetRuntimeState,
    triggerBeatRepeatTransitionFx,
    updateDjFxMenuUI,
  };
}
