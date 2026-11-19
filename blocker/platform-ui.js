(() => {
  const root = document.documentElement;

  function applyPlatform(platform) {
    const normalized = platform === 'android' ? 'android' : 'desktop';
    root.dataset.platform = normalized;
    root.classList.toggle('platform-android', normalized === 'android');
    root.classList.toggle('platform-desktop', normalized === 'desktop');
  }

  applyPlatform(/Android/i.test(navigator.userAgent) ? 'android' : 'desktop');

  try {
    if (globalThis.browser?.runtime?.getPlatformInfo) {
      browser.runtime.getPlatformInfo()
        .then(info => applyPlatform(info?.os === 'android' ? 'android' : 'desktop'))
        .catch(() => {});
    }
  } catch {}
})();
