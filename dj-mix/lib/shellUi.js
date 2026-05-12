export function createShellUi(options) {
  const {
    appScreen,
    crossfadeRing,
    setupError,
    setupLoading,
    setupScreen,
  } = options;

  let toastTimer = null;

  function showToast(msg, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    clearTimeout(toastTimer);

    const el = document.createElement('div');
    el.className = 'toast';
    if (isError) el.style.borderColor = '#f87171';
    el.textContent = msg;
    document.body.appendChild(el);

    toastTimer = setTimeout(() => el.remove(), 3000);
  }

  function showSetup() {
    setupScreen.classList.add('active');
    setupScreen.hidden = false;
    appScreen.classList.remove('active');
    appScreen.hidden = true;
    showSetupLoading(false);
  }

  function showSetupError(message) {
    if (!setupError) return;
    setupError.textContent = message || 'Erreur inconnue';
    setupError.hidden = false;
  }

  function hideSetupError() {
    if (!setupError) return;
    setupError.hidden = true;
    setupError.textContent = '';
  }

  function showSetupLoading(on, message = null) {
    if (!setupLoading) return;

    setupLoading.hidden = !on;
    if (!on) return;

    if (message) {
      setupLoading.textContent = '';
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      setupLoading.appendChild(spinner);
      setupLoading.appendChild(document.createTextNode(` ${message}`));
    }
  }

  function showApp() {
    setupScreen.classList.remove('active');
    setupScreen.hidden = true;
    appScreen.classList.add('active');
    appScreen.hidden = false;
    hideSetupError();
  }

  function showCrossfadeRing(on) {
    crossfadeRing.hidden = !on;
  }

  return {
    hideSetupError,
    showApp,
    showCrossfadeRing,
    showSetup,
    showSetupError,
    showSetupLoading,
    showToast,
  };
}
