/*
 * BraveFox Enhancer — PWA navigation fallback.
 *
 * Installed web apps can intentionally remove ordinary browser navigation
 * chrome. This content script detects app-style display modes and provides a
 * compact Back / Forward / Reload dock. It never appears in ordinary tabs.
 */

(() => {
  'use strict';

  const BUILD_FAMILY = 'firefox';
  const HOST_ID = 'bravefox-pwa-navigation-host';
  const ACTIVE_ATTR = 'data-bravefox-pwa-navigation';
  const MODE_ATTR = 'data-bravefox-pwa-display-mode';
  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  const MAINTENANCE_INTERVAL_MS = IS_ANDROID ? 1400 : 900;

  if (window.top !== window) return;
  if (!/^https?:$/i.test(location.protocol)) return;

  const DISPLAY_MODES = [
    'window-controls-overlay',
    'standalone',
    'minimal-ui',
    'tabbed',
    'fullscreen'
  ];

  const displayQueries = DISPLAY_MODES.map(mode => [
    mode,
    safeMatchMedia(`(display-mode: ${mode})`)
  ]);

  let host = null;
  let backButton = null;
  let forwardButton = null;
  let maintenanceTimer = 0;
  let synchronizeQueued = false;

  for (const [, query] of displayQueries) {
    if (!query) continue;
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', queueSynchronize);
    } else if (typeof query.addListener === 'function') {
      query.addListener(queueSynchronize);
    }
  }

  try {
    navigator.windowControlsOverlay?.addEventListener?.('geometrychange', queueSynchronize);
  } catch {
    // Window Controls Overlay support is optional.
  }

  window.addEventListener('pageshow', queueSynchronize, true);
  window.addEventListener('popstate', queueSynchronize, true);
  window.addEventListener('hashchange', queueSynchronize, true);
  document.addEventListener('fullscreenchange', queueSynchronize, true);
  document.addEventListener('visibilitychange', queueSynchronize, true);

  try {
    globalThis.navigation?.addEventListener?.('currententrychange', queueSynchronize);
    globalThis.navigation?.addEventListener?.('navigate', queueSynchronize);
  } catch {
    // Navigation API support is optional.
  }

  synchronize();

  function safeMatchMedia(query) {
    try {
      return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
    } catch {
      return null;
    }
  }

  function queueSynchronize() {
    if (synchronizeQueued) return;
    synchronizeQueued = true;
    queueMicrotask(() => {
      synchronizeQueued = false;
      synchronize();
    });
  }

  function detectDisplayMode() {
    try {
      if (navigator.windowControlsOverlay?.visible) return 'window-controls-overlay';
    } catch {
      // Continue with media-query detection.
    }

    for (const [mode, query] of displayQueries) {
      if (query?.matches) return mode;
    }

    // Kept as a harmless compatibility fallback for standalone-capable WebKit.
    if (navigator.standalone === true) return 'standalone';
    return 'browser';
  }

  function shouldShowDock(mode) {
    if (mode === 'browser') return false;

    // Do not overlay controls when a normal page enters the Fullscreen API.
    // A manifest-launched fullscreen PWA has no fullscreenElement and remains
    // eligible for the fallback controls.
    if (mode === 'fullscreen' && document.fullscreenElement) return false;
    return true;
  }

  function synchronize() {
    const mode = detectDisplayMode();

    if (!shouldShowDock(mode)) {
      stopMaintenance();
      removeDock();
      return;
    }

    ensureDock();
    document.documentElement.setAttribute(ACTIVE_ATTR, BUILD_FAMILY);
    document.documentElement.setAttribute(MODE_ATTR, mode);
    updateNavigationState();
    startMaintenance();
  }

  function startMaintenance() {
    if (maintenanceTimer) return;
    maintenanceTimer = window.setInterval(() => {
      // React/SPA document rewrites occasionally remove extension-owned nodes.
      // Re-running synchronization makes the dock self-healing.
      synchronize();
    }, MAINTENANCE_INTERVAL_MS);
  }

  function stopMaintenance() {
    if (!maintenanceTimer) return;
    clearInterval(maintenanceTimer);
    maintenanceTimer = 0;
  }

  function removeDock() {
    document.documentElement.removeAttribute(ACTIVE_ATTR);
    document.documentElement.removeAttribute(MODE_ATTR);
    host?.remove();
    host = null;
    backButton = null;
    forwardButton = null;
  }

  function ensureDock() {
    if (host?.isConnected) return;

    document.getElementById(HOST_ID)?.remove();

    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-build-family', BUILD_FAMILY);

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial !important;
          position: fixed !important;
          top: 50% !important;
          right: calc(env(safe-area-inset-right, 0px) + 10px) !important;
          transform: translateY(-50%) !important;
          z-index: 2147483647 !important;
          display: block !important;
          width: auto !important;
          height: auto !important;
          pointer-events: auto !important;
          contain: layout style paint !important;
          color-scheme: light dark !important;
        }

        .dock {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 5px;
          border: 1px solid rgba(127, 127, 127, 0.32);
          border-radius: 14px;
          background: rgba(248, 248, 248, 0.82);
          box-shadow: 0 7px 24px rgba(0, 0, 0, 0.20);
          backdrop-filter: blur(14px) saturate(135%);
          -webkit-backdrop-filter: blur(14px) saturate(135%);
          opacity: 0.74;
          transition: opacity 120ms ease, box-shadow 120ms ease;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
        }

        .dock:hover,
        .dock:focus-within {
          opacity: 1;
          box-shadow: 0 9px 28px rgba(0, 0, 0, 0.25);
        }

        button {
          all: unset;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          color: #1f1f1f;
          cursor: pointer;
          outline: none;
          transition: background-color 100ms ease, opacity 100ms ease, transform 80ms ease;
          -webkit-tap-highlight-color: transparent;
        }

        button:hover { background: rgba(0, 0, 0, 0.09); }
        button:active {
          transform: scale(0.92);
          background: rgba(0, 0, 0, 0.14);
        }
        button:focus-visible { box-shadow: 0 0 0 2px #0b57d0 inset; }
        button:disabled {
          opacity: 0.28;
          cursor: default;
          transform: none;
          background: transparent;
        }

        svg {
          width: 21px;
          height: 21px;
          display: block;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          pointer-events: none;
        }

        @media (prefers-color-scheme: dark) {
          .dock {
            border-color: rgba(255, 255, 255, 0.17);
            background: rgba(35, 35, 35, 0.84);
            box-shadow: 0 7px 24px rgba(0, 0, 0, 0.40);
          }
          button { color: #f1f1f1; }
          button:hover { background: rgba(255, 255, 255, 0.12); }
          button:active { background: rgba(255, 255, 255, 0.18); }
        }

        @media (pointer: coarse), (max-width: 720px) {
          :host {
            right: calc(env(safe-area-inset-right, 0px) + 7px) !important;
          }
          .dock {
            gap: 3px;
            padding: 4px;
            border-radius: 13px;
            opacity: 0.88;
          }
          button {
            width: 42px;
            height: 42px;
            border-radius: 9px;
          }
          svg {
            width: 22px;
            height: 22px;
          }
        }

        @media print {
          :host { display: none !important; }
        }
      </style>
      <nav class="dock" aria-label="PWA navigation">
        <button type="button" data-action="back" title="Back" aria-label="Back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button type="button" data-action="forward" title="Forward" aria-label="Forward">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button type="button" data-action="reload" title="Reload" aria-label="Reload">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg>
        </button>
      </nav>
    `;

    backButton = shadow.querySelector('[data-action="back"]');
    forwardButton = shadow.querySelector('[data-action="forward"]');
    const reloadButton = shadow.querySelector('[data-action="reload"]');

    backButton.addEventListener('click', () => {
      try { history.back(); } catch { /* Best-effort browser history action. */ }
    });

    forwardButton.addEventListener('click', () => {
      try { history.forward(); } catch { /* Best-effort browser history action. */ }
    });

    reloadButton.addEventListener('click', () => {
      try { location.reload(); } catch { /* The document may already be unloading. */ }
    });

    (document.documentElement || document).appendChild(host);
  }

  function updateNavigationState() {
    if (!host?.isConnected || document.hidden) return;

    let canGoBack = history.length > 1;
    let canGoForward = true;

    try {
      if (globalThis.navigation &&
          typeof globalThis.navigation.canGoBack === 'boolean' &&
          typeof globalThis.navigation.canGoForward === 'boolean') {
        canGoBack = globalThis.navigation.canGoBack;
        canGoForward = globalThis.navigation.canGoForward;
      }
    } catch {
      // Firefox and older Chromium builds fall back to session-history hints.
    }

    if (backButton) backButton.disabled = !canGoBack;
    if (forwardButton) forwardButton.disabled = !canGoForward;
  }
})();
