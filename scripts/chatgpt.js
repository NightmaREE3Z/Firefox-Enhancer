/* ChatGPT.js
 * BraveFox Enhancer — ChatGPT SPA/sub-page protection and UI cleanup.
 *
 * Protects ChatGPT Personalization settings with the extension's existing
 * password page, adds a second confirmation gate before opening
 * "Muistiyhteenveto", and removes sensitive memory controls without a flash.
 *
 * Performance notes:
 * - Critical controls are hidden by CSS at document_start.
 * - DOM work is mutation-driven and batched instead of repeatedly scanning
 *   the whole page or polling the URL.
 * - Added subtrees are processed in small idle-time batches, with a stricter
 *   queue cap and gentler timing on Firefox for Android.
 */

(() => {
  'use strict';

  // Resolve the actual WebExtension API by capability. Some installed-app/PWA
  // environments may expose a non-extension `browser` global, so blindly
  // preferring `browser` can hide Chrome's real `chrome.runtime` object.
  const api = resolveExtensionApi();
  const PASSWORD_PAGE_URL = getExtensionUrl('html/password-protected.html');

  function resolveExtensionApi() {
    for (const candidate of [globalThis.browser, globalThis.chrome]) {
      try {
        if (typeof candidate?.runtime?.getURL === 'function') return candidate;
      } catch {
        // Keep trying the next API candidate.
      }
    }
    return null;
  }

  function getExtensionUrl(path) {
    try {
      return typeof api?.runtime?.getURL === 'function'
        ? api.runtime.getURL(path)
        : '';
    } catch {
      return '';
    }
  }
  const STYLE_ID = 'bravefox-chatgpt-style';
  const GATED_CLASS = 'bravefox-chatgpt-gated';
  const PERSONALIZATION_CLASS = 'bravefox-chatgpt-personalization';
  const HIDDEN_CLASS = 'bravefox-chatgpt-hidden';
  const PASSWORD_HOST_ID = 'bravefox-chatgpt-password-host';

  const PERSONALIZATION_PROMPT = 'ChatGPT Personalization settings are password protected';
  const MEMORY_SUMMARY_PROMPT = 'Are you sure you want to do this? Enter password';

  const MEMORY_ENABLE_LABELS = new Set(['ota muisti käyttöön', 'enable memory']);
  const MEMORY_SUMMARY_LABELS = ['muistiyhteenveto', 'memory summary', 'saved memories'];
  const MANAGE_LABELS = new Set(['hallitse', 'manage']);
  const ENHANCED_MEMORY_BUTTON_LABELS = new Set([
    'kokeile parannettua muistia',
    'try enhanced memory'
  ]);
  const LEGACY_MEMORY_BANNER_TEXT = [
    'tämä on muistitoiminnon vanha versio',
    'this is an older version of memory'
  ];
  const DELETE_ALL_MEMORY_LABELS = new Set([
    'poista kaikki muistot',
    'delete all memories'
  ]);

  const MODELS_TO_REMOVE = new Set([
    'gpt-5 instant',
    'gpt-5 thinking mini',
    'gpt-5 thinking',
    'o3',
    'o4-mini'
  ]);

  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  const MAX_PENDING_ROOTS = IS_ANDROID ? 18 : 36;
  const IDLE_TIMEOUT = IS_ANDROID ? 420 : 220;
  const FALLBACK_DELAY = IS_ANDROID ? 90 : 35;
  const RELEVANT_MUTATION_SELECTOR = [
    '[role="menuitem"]',
    'button[role="switch"]',
    'button[aria-haspopup="menu"][aria-label]',
    'button.btn-secondary',
    'button.bg-token-text-primary',
    'button[aria-label="Päivitä"]',
    'button.flex.items-center.gap-1.bg-transparent',
    'div.truncate[dir="auto"]',
    'div.flex.items-center.gap-1.text-sm.font-semibold.opacity-70',
    'div.border-token-border-light.bg-token-bg-elevated-secondary'
  ].join(',');

  let observer = null;
  let scanHandle = null;
  let scanHandleType = null;
  let fullScanPending = false;
  let activeGate = null;
  let personalizationVisitActive = false;
  let personalizationUnlocked = false;
  let lastUrl = location.href;

  const pendingRoots = new Set();
  const replayAllowedButtons = new WeakSet();

  injectStyles();
  synchronizeRoute();
  installEventGuards();
  startObserver();
  scheduleFullScan(true);

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function includesAny(text, values) {
    for (const value of values) {
      if (text.includes(value)) return true;
    }
    return false;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${GATED_CLASS},
      html.${GATED_CLASS} body {
        overflow: hidden !important;
        background: #ffffff !important;
      }

      html.${GATED_CLASS} body {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      #${PASSWORD_HOST_ID} {
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      .${HIDDEN_CLASS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Hide the legacy-memory upgrade nag before ChatGPT can paint it. */
      html.${PERSONALIZATION_CLASS}
      div.border-token-border-light.bg-token-bg-elevated-secondary.flex.min-h-20.flex-col.items-start.gap-3.rounded-2xl.border.px-4.py-4 {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Hide the About-you menu button before it can paint. */
      button[aria-label="Tietoja sinusta -valikko"],
      button[aria-label^="Tietoja sinusta"][aria-haspopup="menu"],
      button[aria-label="About you menu"],
      button[aria-label^="About you"][aria-haspopup="menu"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /*
       * The memory-summary overflow menu is rendered in a portal. Its delete
       * command is the danger-coloured menu item, so suppress it at paint time.
       * JavaScript then verifies the exact text and removes the item entirely.
       */
      html.${PERSONALIZATION_CLASS}
      [role="menuitem"][data-color="danger"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Existing BraveFox ChatGPT presentation cleanup. */
      [data-message-author-role="user"] .bg-token-main-surface-secondary {
        background: none !important;
        border: none !important;
        box-shadow: none !important;
      }

      .user-message-bubble-color {
        background-color: #cce4ff !important;
        border-radius: 16px !important;
        border: 1px solid #a0b8c8 !important;
        margin-left: auto !important;
        margin-right: 2% !important;
        max-width: 98% !important;
        padding: 12px !important;
        box-sizing: border-box !important;
      }

      [data-message-author-role="assistant"] .prose.markdown {
        background-color: #e9eaea !important;
        border: 1px solid #cfcfcf !important;
        border-radius: 16px !important;
        margin-left: 2% !important;
        max-width: 98% !important;
        padding: 12px !important;
        box-sizing: border-box !important;
        color: #222 !important;
      }

      [data-message-author-role="assistant"] .text-token-text-secondary {
        background: none !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin-top: 4px !important;
      }

      .CodeBlock-module__code--KUcqT div {
        background-color: #ffffff !important;
        border: none !important;
        border-radius: 0 !important;
      }

      .CodeBlock-module__code--KUcqT code {
        font-family: "Courier New", monospace !important;
        font-size: 1rem !important;
        color: #222 !important;
      }

      button[aria-label="Päivitä"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function isPersonalizationRoute() {
    let hash = location.hash || '';
    try {
      hash = decodeURIComponent(hash);
    } catch {
      // A malformed hash should not break the extension.
    }
    return normalizeText(hash).startsWith('#settings/personalization');
  }

  function synchronizeRoute() {
    const onPersonalization = isPersonalizationRoute();
    document.documentElement.classList.toggle(PERSONALIZATION_CLASS, onPersonalization);

    if (onPersonalization && !personalizationVisitActive) {
      personalizationVisitActive = true;
      personalizationUnlocked = false;

      const gateOpened = showPasswordGate({
        kind: 'personalization-route',
        title: PERSONALIZATION_PROMPT,
        onSuccess: () => {
          personalizationUnlocked = true;
          hideSensitiveMemoryControls(document);
        }
      });

      if (!gateOpened) {
        personalizationVisitActive = false;
      }
      return;
    }

    if (!onPersonalization && personalizationVisitActive) {
      personalizationVisitActive = false;
      personalizationUnlocked = false;
      if (activeGate?.kind === 'personalization-route') {
        closePasswordGate(false);
      }
    }
  }

  function checkForRouteChange() {
    if (location.href === lastUrl) return false;
    lastUrl = location.href;
    synchronizeRoute();
    scheduleFullScan(true);
    return true;
  }

  function installEventGuards() {
    const handleNavigation = () => {
      lastUrl = location.href;
      synchronizeRoute();
      scheduleFullScan(true);
    };

    window.addEventListener('hashchange', handleNavigation, true);
    window.addEventListener('popstate', handleNavigation, true);
    window.addEventListener('pageshow', handleNavigation, true);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForRouteChange();
    }, true);

    document.addEventListener('click', event => {
      const menuItem = getElementFromEvent(event, '[role="menuitem"]');
      if (menuItem && isDeleteAllMemoriesItem(menuItem)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        menuItem.remove();
        return;
      }

      const button = getButtonFromEvent(event);
      if (!button || replayAllowedButtons.has(button)) return;
      if (!isMemorySummaryManageButton(button)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      showPasswordGate({
        kind: 'memory-summary',
        title: MEMORY_SUMMARY_PROMPT,
        onSuccess: () => replayManageClick(button)
      });
    }, true);
  }

  function getElementFromEvent(event, selector) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof Element && node.matches(selector)) return node;
    }
    return event.target instanceof Element ? event.target.closest(selector) : null;
  }

  function getButtonFromEvent(event) {
    const element = getElementFromEvent(event, 'button');
    return element instanceof HTMLButtonElement ? element : null;
  }

  function isDeleteAllMemoriesItem(menuItem) {
    return DELETE_ALL_MEMORY_LABELS.has(normalizeText(menuItem.textContent));
  }

  function isMemorySummaryManageButton(button) {
    if (!isPersonalizationRoute() || !personalizationUnlocked) return false;
    if (!MANAGE_LABELS.has(normalizeText(button.textContent))) return false;

    let node = button;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      if (MEMORY_SUMMARY_LABELS.some(label => context.includes(label))) return true;
    }
    return false;
  }

  function replayManageClick(originalButton) {
    const button = originalButton?.isConnected ? originalButton : findMemorySummaryManageButton();
    if (!button) return;

    replayAllowedButtons.add(button);
    try {
      button.click();
    } finally {
      queueMicrotask(() => replayAllowedButtons.delete(button));
    }
  }

  function findMemorySummaryManageButton() {
    for (const button of document.querySelectorAll('button')) {
      if (!MANAGE_LABELS.has(normalizeText(button.textContent))) continue;

      let node = button;
      for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
        const context = normalizeText(node.textContent);
        if (MEMORY_SUMMARY_LABELS.some(label => context.includes(label))) return button;
      }
    }
    return null;
  }

  function showPasswordGate({ kind, title, onSuccess }) {
    if (activeGate) return false;
    // Cache the extension URL at content-script startup. This keeps the gate
    // usable in long-lived PWA windows even if Chrome later reloads/updates the
    // extension context while the app window remains open.
    const passwordPageUrl = PASSWORD_PAGE_URL || getExtensionUrl('html/password-protected.html');
    if (!passwordPageUrl) {
      console.warn('[BraveFox Enhancer] Password page URL is unavailable. Reload the PWA window once.');
      return false;
    }

    document.documentElement.classList.add(GATED_CLASS);

    const host = document.createElement('div');
    host.id = PASSWORD_HOST_ID;
    host.style.cssText = [
      'all: initial !important',
      'position: fixed !important',
      'inset: 0 !important',
      'width: 100vw !important',
      'height: 100vh !important',
      'z-index: 2147483647 !important',
      'display: block !important',
      'visibility: visible !important',
      'opacity: 1 !important',
      'pointer-events: auto !important',
      'background: #ffffff !important'
    ].join(';');

    const shadow = host.attachShadow({ mode: 'closed' });
    const reset = document.createElement('style');
    reset.textContent = [
      ':host { all: initial; }',
      'iframe {',
      '  width: 100%;',
      '  height: 100%;',
      '  border: 0;',
      '  display: block;',
      '  background: #fff;',
      '}'
    ].join(' ');

    const iframe = document.createElement('iframe');
    const params = new URLSearchParams({
      embedded: '1',
      compact: '1',
      title
    });
    iframe.src = `${passwordPageUrl}?${params}`;
    iframe.title = title;
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write');

    shadow.append(reset, iframe);
    (document.documentElement || document.body).appendChild(host);

    const messageListener = event => {
      if (event.source !== iframe.contentWindow) return;
      const unlocked = event.data === 'BraveFox-Unlock' || event.data?.type === 'BraveFox-Unlock';
      if (!unlocked) return;

      const callback = activeGate?.onSuccess;
      closePasswordGate(true);
      try {
        callback?.();
      } catch (error) {
        console.error('[BraveFox Enhancer] ChatGPT protected action failed:', error);
      }
    };

    window.addEventListener('message', messageListener, true);
    activeGate = { kind, host, iframe, onSuccess, messageListener };
    return true;
  }

  function closePasswordGate(unlocked) {
    if (!activeGate) return;
    const gate = activeGate;
    activeGate = null;

    window.removeEventListener('message', gate.messageListener, true);
    gate.host.remove();

    if (unlocked) {
      hideSensitiveMemoryControls(document);
      cleanChatGptUi(document);
    }

    document.documentElement.classList.remove(GATED_CLASS);
  }

  function startObserver() {
    observer = new MutationObserver(mutations => {
      checkForRouteChange();
      const onPersonalization = isPersonalizationRoute();

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (!isRelevantMutationRoot(node)) continue;

          // Sensitive settings stay synchronous so they never flash after a rerender.
          if (onPersonalization) hideSensitiveMemoryControls(node);
          queueScanRoot(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function isRelevantMutationRoot(root) {
    return root.matches(RELEVANT_MUTATION_SELECTOR) ||
      root.querySelector(RELEVANT_MUTATION_SELECTOR) !== null;
  }

  function queueScanRoot(root) {
    if (!(root instanceof Element) || fullScanPending) return;

    if (pendingRoots.size >= MAX_PENDING_ROOTS) {
      scheduleFullScan(false);
      return;
    }

    for (const existing of pendingRoots) {
      if (existing.contains(root)) return;
      if (root.contains(existing)) pendingRoots.delete(existing);
    }

    pendingRoots.add(root);
    scheduleScan(false);
  }

  function scheduleFullScan(urgent = false) {
    fullScanPending = true;
    pendingRoots.clear();
    scheduleScan(urgent);
  }

  function scheduleScan(urgent) {
    if (scanHandle !== null) {
      if (!urgent) return;
      cancelScheduledScan();
    }

    if (!urgent && typeof requestIdleCallback === 'function') {
      scanHandleType = 'idle';
      scanHandle = requestIdleCallback(flushScans, { timeout: IDLE_TIMEOUT });
      return;
    }

    scanHandleType = 'timeout';
    scanHandle = setTimeout(flushScans, urgent ? 0 : FALLBACK_DELAY);
  }

  function cancelScheduledScan() {
    if (scanHandle === null) return;

    if (scanHandleType === 'idle' && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(scanHandle);
    } else {
      clearTimeout(scanHandle);
    }

    scanHandle = null;
    scanHandleType = null;
  }

  function flushScans() {
    scanHandle = null;
    scanHandleType = null;

    if (fullScanPending) {
      fullScanPending = false;
      pendingRoots.clear();
      hideSensitiveMemoryControls(document);
      cleanChatGptUi(document);
      return;
    }

    const roots = Array.from(pendingRoots);
    pendingRoots.clear();

    for (const root of roots) {
      if (!root.isConnected) continue;
      hideSensitiveMemoryControls(root);
      cleanChatGptUi(root);
    }
  }

  function forEachMatch(scope, selector, callback) {
    if (!scope) return;

    if (scope instanceof Element && scope.matches(selector)) {
      callback(scope);
    }

    if (typeof scope.querySelectorAll !== 'function') return;
    for (const element of scope.querySelectorAll(selector)) {
      callback(element);
    }
  }

  function hideSensitiveMemoryControls(scope = document) {
    hideMemoryEnableRows(scope);
    hideEnhancedMemoryBanners(scope);
    hideAboutYouMenus(scope);
    removeDeleteAllMemoriesItems(scope);
  }

  function hideMemoryEnableRows(scope = document) {
    forEachMatch(scope, 'button[role="switch"]', switchButton => {
      const container = switchButton.closest('.flex.justify-between.gap-2') || switchButton.parentElement;
      if (!container) return;

      const context = normalizeText(container.textContent);
      if (!includesAny(context, MEMORY_ENABLE_LABELS)) return;

      const row = findSettingRow(switchButton);
      if (!row) return;
      hideElement(row);
    });
  }

  function findSettingRow(startNode) {
    let node = startNode;
    let outermostSwitchContainer = null;

    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (node.querySelector?.('button[role="switch"]')) {
        outermostSwitchContainer = node;
      }
      if (node.classList?.contains('border-token-border-light')) {
        return node;
      }
    }
    return outermostSwitchContainer;
  }

  function hideEnhancedMemoryBanners(scope = document) {
    if (!isPersonalizationRoute()) return;

    const cardSelector =
      'div.border-token-border-light.bg-token-bg-elevated-secondary.flex.min-h-20.flex-col.items-start.gap-3.rounded-2xl.border.px-4.py-4';

    forEachMatch(scope, cardSelector, card => {
      const context = normalizeText(card.textContent);
      const hasLegacyText = includesAny(context, LEGACY_MEMORY_BANNER_TEXT);
      const hasUpgradeButton = includesAny(context, ENHANCED_MEMORY_BUTTON_LABELS);
      if (hasLegacyText && hasUpgradeButton) hideElement(card);
    });

    forEachMatch(scope, 'button[type="button"]', button => {
      if (!ENHANCED_MEMORY_BUTTON_LABELS.has(normalizeText(button.textContent))) return;

      let card = button.closest('div.border-token-border-light.bg-token-bg-elevated-secondary');
      if (!card) {
        let node = button.parentElement;
        for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
          const context = normalizeText(node.textContent);
          if (includesAny(context, LEGACY_MEMORY_BANNER_TEXT)) {
            card = node;
            break;
          }
        }
      }

      if (card) hideElement(card);
    });
  }

  function hideAboutYouMenus(scope = document) {
    forEachMatch(scope, 'button[aria-haspopup="menu"][aria-label]', button => {
      const label = normalizeText(button.getAttribute('aria-label'));
      const isFinnish = label.includes('tietoja sinusta') && label.includes('valikko');
      const isEnglish = label.includes('about you') && label.includes('menu');
      if (!isFinnish && !isEnglish) return;

      hideElement(button);
      button.tabIndex = -1;
    });
  }

  function removeDeleteAllMemoriesItems(scope = document) {
    forEachMatch(scope, '[role="menuitem"]', item => {
      if (!isDeleteAllMemoriesItem(item)) return;
      hideElement(item);
      item.remove();
    });
  }

  function hideElement(element) {
    element.classList.add(HIDDEN_CLASS);
    element.setAttribute('aria-hidden', 'true');
  }

  function cleanChatGptUi(scope = document) {
    forEachMatch(scope, 'div[role="menuitem"]', item => {
      const firstLine = normalizeText(String(item.textContent || '').split('\n')[0]);
      if (MODELS_TO_REMOVE.has(firstLine)) item.remove();
    });

    hideElementsBySelectorAndText(
      scope,
      'button[type="button"].flex.items-center.gap-1.bg-transparent',
      'hanki plus'
    );
    hideElementsBySelectorAndText(scope, 'div.truncate[dir="auto"]', 'free', true);
    hideElementsBySelectorAndText(
      scope,
      'div.flex.items-center.gap-1.text-sm.font-semibold.opacity-70',
      'muisti täynnä'
    );
    hideElementsBySelectorAndText(scope, 'button[aria-label="Päivitä"]', 'päivitä');
  }

  function hideElementsBySelectorAndText(scope, selector, expectedText, exact = false) {
    forEachMatch(scope, selector, element => {
      const text = normalizeText(element.textContent);
      const matches = exact ? text === expectedText : text.includes(expectedText);
      if (matches) hideElement(element);
    });
  }

  console.log(
    `[BraveFox Enhancer] ChatGPT SPA protection active (${IS_ANDROID ? 'Android-optimized' : 'desktop-optimized'}).`
  );
})();
