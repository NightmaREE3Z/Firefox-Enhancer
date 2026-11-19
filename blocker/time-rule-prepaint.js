// BraveFox Focus Master Time Rule pre-paint guard — 2026-08-21
// Firefox ESR/Fenix document_start guard for scheduled blocks and daily quotas.

(() => {
  if (!/^https?:$/i.test(location.protocol)) return;

  const MESSAGE_TYPE = 'BFB_TIME_RULE_PREPAINT_CHECK';
  const STYLE_ID = 'bfb-time-rule-prepaint-shield';
  let generation = 0;
  let shield = null;

  function ensureShield() {
    if (shield?.isConnected) return;
    shield = document.createElement('style');
    shield.id = STYLE_ID;
    shield.textContent = `
      html { background: #0b4b63 !important; }
      body { visibility: hidden !important; }
    `;
    (document.head || document.documentElement)?.appendChild(shield);
  }

  function releaseShield(expectedGeneration) {
    if (expectedGeneration !== generation) return;
    try { shield?.remove(); } catch {}
    shield = null;
  }

  async function checkUrl(urlValue) {
    const url = String(urlValue || location.href || '');
    if (!/^https?:\/\//i.test(url)) return;

    generation += 1;
    const currentGeneration = generation;
    ensureShield();

    try {
      const response = await browser.runtime.sendMessage({ type: MESSAGE_TYPE, url });
      if (currentGeneration !== generation) return;
      if (!response?.ok || response?.blocked !== true) releaseShield(currentGeneration);
      // If blocked, keep the shield in place until the background replaces the tab.
    } catch {
      releaseShield(currentGeneration);
    }
  }

  void checkUrl(location.href);

  // Firefox webNavigation.onHistoryStateUpdated in the background is the primary
  // pushState/replaceState backup. These local events cover back/forward/hash
  // transitions without letting a configured Time Rule page sit visibly open.
  addEventListener('popstate', () => void checkUrl(location.href), true);
  addEventListener('hashchange', () => void checkUrl(location.href), true);
})();
