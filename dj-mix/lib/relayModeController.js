/**
 * relayModeController.js — UI du mode maître/relais (côté index.html)
 *
 * Responsabilités (maître uniquement — le relais utilise relay.html) :
 *  - Gérer les boutons Autonome / Maître
 *  - Générer et afficher le QR code + lien de session
 *  - Si ?relay-session= dans l'URL sur index.html, rediriger vers relay.html
 */

import {
  persistRelayModeSetting,
  persistRelaySessionIdSetting,
  readRelayModeSetting,
  readRelaySessionIdSetting,
} from './settingsStorage.js';

export function createRelayModeController({
  relayModeManager,
  showToast,
  logInfo,
  logWarn,
  onRoleChanged,
  getDownloaderApiUrl,
  getDownloaderApiToken,
  setDownloaderApiUrl,
  // DOM — config maître uniquement
  relayModeStandaloneBtn,
  relayModeMasterBtn,
  relayMasterPanel,
  relayQrcodeEl,
  relaySessionUrlEl,
  relayCopyLinkBtn,
  relayStatusEl,
  relayIndicatorEl,
} = {}) {

  let _qrScriptLoaded = false;

  // ── Changement de rôle ────────────────────────────────────────────────────

  async function _activateMaster() {
    _setButtonsActive('master');
    _showPanel('master');
    _updateStatus('Création de la session…');

    let sessionId = relayModeManager.getSessionId();
    if (!sessionId) {
      sessionId = await relayModeManager.createSession();
    }

    if (!sessionId) {
      showToast('Impossible de créer la session maître (API indisponible ?)', true);
      _activateStandalone();
      return;
    }

    relayModeManager.startAsMaster(sessionId);
    persistRelayModeSetting('master');
    persistRelaySessionIdSetting(sessionId);

    const url = _buildRelayUrl(sessionId);
    if (relaySessionUrlEl) relaySessionUrlEl.textContent = url;
    _renderQrCode(url);
    _updateStatus(`Session maître active · ID : ${sessionId}`);
    _updateIndicator('master');
    onRoleChanged?.('master');
    logInfo('relay.master.activated', { sessionId });
  }

  function _activateStandalone() {
    relayModeManager.setStandalone();
    persistRelayModeSetting('standalone');
    persistRelaySessionIdSetting(null);
    _setButtonsActive('standalone');
    _showPanel('standalone');
    _updateStatus('Autonome : cet appareil gère sa propre lecture.');
    _updateIndicator('standalone');
    onRoleChanged?.('standalone');
    logInfo('relay.standalone.activated');
  }

  // ── QR code ───────────────────────────────────────────────────────────────

  function _buildRelayUrl(sessionId) {
    const apiUrl   = getDownloaderApiUrl?.() || '';
    const apiToken = getDownloaderApiToken?.() || '';
    const origin = window.location.origin;
    const dir = window.location.pathname.replace(/\/[^/]*$/, '/');
    const params = new URLSearchParams({ 'relay-session': sessionId });
    if (apiUrl)   params.set('relay-api',   apiUrl);
    if (apiToken) params.set('relay-token', apiToken);
    return `${origin}${dir}relay?${params.toString()}`;
  }

  async function _renderQrCode(url) {
    if (!relayQrcodeEl) return;
    relayQrcodeEl.innerHTML = '';

    if (!_qrScriptLoaded) {
      try {
        await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
        _qrScriptLoaded = true;
      } catch (_) {
        relayQrcodeEl.textContent = url;
        return;
      }
    }

    try {
      /* global QRCode */
      new window.QRCode(relayQrcodeEl, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#ffffff',
        colorLight: '#1a1a2e',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    } catch (_) {
      relayQrcodeEl.textContent = url;
    }
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Script load failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────

  function _setButtonsActive(role) {
    for (const [btn, r] of [
      [relayModeStandaloneBtn, 'standalone'],
      [relayModeMasterBtn, 'master'],
    ]) {
      if (!btn) continue;
      btn.classList.toggle('relay-mode-btn--active', r === role);
      btn.setAttribute('aria-pressed', String(r === role));
    }
  }

  function _showPanel(role) {
    if (relayMasterPanel) relayMasterPanel.hidden = role !== 'master';
  }

  function _updateStatus(msg) {
    if (relayStatusEl) relayStatusEl.textContent = msg;
  }

  function _updateIndicator(role) {
    if (!relayIndicatorEl) return;
    relayIndicatorEl.hidden = role === 'standalone';
    relayIndicatorEl.className = `relay-indicator relay-indicator--${role}`;
    relayIndicatorEl.textContent = role === 'master' ? '📡 Maître' : '';
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  function init() {
    relayModeStandaloneBtn?.addEventListener('click', _activateStandalone);

    relayModeMasterBtn?.addEventListener('click', () => {
      if (relayModeManager.getRole() !== 'master') _activateMaster();
    });

    relayCopyLinkBtn?.addEventListener('click', () => {
      const url = relaySessionUrlEl?.textContent;
      if (!url) return;
      navigator.clipboard?.writeText(url)
        .then(() => showToast('Lien copié !'))
        .catch(() => showToast('Impossible de copier', true));
    });

    // Restaurer le rôle sauvegardé (uniquement maître ou autonome)
    const savedRole    = readRelayModeSetting();
    const savedSession = readRelaySessionIdSetting();
    if (savedRole === 'master' && savedSession) {
      relayModeManager.startAsMaster(savedSession);
      _setButtonsActive('master');
      _showPanel('master');
      const url = _buildRelayUrl(savedSession);
      if (relaySessionUrlEl) relaySessionUrlEl.textContent = url;
      _renderQrCode(url);
      _updateStatus(`Session maître active · ID : ${savedSession}`);
      _updateIndicator('master');
    } else {
      _activateStandalone();
    }
  }

  return { init };
}
