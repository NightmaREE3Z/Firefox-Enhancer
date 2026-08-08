/* ChatGPT.js
 * BraveFox Enhancer — lean Firefox ChatGPT cleanup for PC/ESR and Android/Fenix Nightly.
 *
 * Firefox is intentionally the secondary-browser lane:
 * - Plugins, GPT directory and Images are hidden and their routes auto-close.
 * - More/Lisää, Plugins/Lisäosat, GPTs and Kuvat/Images entry points stay gone.
 * - ChatGPT sign-in is Google-only (Apple, phone, email and signup stay hidden).
 * - Personalization remains password protected, but uses BraveFox's real top-level
 *   password page rather than an iframe overlay.
 * - Sensitive memory controls and the existing lightweight presentation cleanup remain.
 *
 * Performance model:
 * - Paint-time CSS handles deterministic hiding.
 * - Normal conversations have no permanent whole-page MutationObserver.
 * - Personalization gets one route-specific batched observer only while that route is open.
 * - Late Radix/settings portals get a short-lived observer after relevant interactions.
 */

(() => {
  'use strict';

  if (window.top !== window) return;

  const api = resolveExtensionApi();
  const STYLE_ID = 'bravefox-chatgpt-style';
  const HIDDEN_CLASS = 'bravefox-chatgpt-hidden';
  const GATED_CLASS = 'bravefox-chatgpt-gated';
  const PERSONALIZATION_CLASS = 'bravefox-chatgpt-personalization';

  const PERSONALIZATION_PROMPT = 'ChatGPT Personalization settings are password protected';
  const MEMORY_SUMMARY_PROMPT = 'Are you sure you want to do this? Enter password';

  const RESTRICTED_PATHS = ['/plugins', '/gpts', '/images'];
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
  const PORTAL_WATCH_MS = IS_ANDROID ? 1500 : 1100;
  const PERSONALIZATION_MAINTENANCE_MS = IS_ANDROID ? 110 : 70;

  let lastUrl = location.href;
  let routeCheckQueued = false;
  let routeAuthCheckInProgress = false;
  let authRedirectRequested = false;
  let protectedRouteUnlocked = false;
  let personalizationVisitActive = false;
  let pendingApprovedAction = null;
  let personalizationObserver = null;
  let personalizationMaintenanceTimer = 0;
  let portalObserver = null;
  let portalObserverTimer = 0;
  let uiScanTimer = 0;
  let uiScanRetryTimer = 0;

  const replayAllowedButtons = new WeakSet();

  // Direct navigation to a secondary-only ChatGPT surface should never paint.
  if (isRestrictedChatGptPath(location.pathname)) {
    setInlinePaintGate(true);
    void requestRestrictedTabClose(location.href);
    return;
  }

  // Direct Personalization loads are paint-gated until a one-time native password
  // grant is consumed or the background moves the tab to the BraveFox password page.
  if (isPersonalizationRoute()) {
    document.documentElement.classList.add(GATED_CLASS, PERSONALIZATION_CLASS);
    setInlinePaintGate(true);
  }

  injectStyles();
  installNavigationGuards();
  installInteractionGuards();
  void synchronizeRoute();
  scheduleGeneralUiScan(true);
  scheduleGoogleOnlyLoginCleanupRetries();

  function resolveExtensionApi() {
    for (const candidate of [globalThis.browser, globalThis.chrome]) {
      try {
        if (typeof candidate?.runtime?.getURL === 'function' && typeof candidate?.runtime?.sendMessage === 'function') {
          return candidate;
        }
      } catch {
        // Keep trying.
      }
    }
    return null;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function includesAny(text, values) {
    for (const value of values) {
      if (text.includes(value)) return true;
    }
    return false;
  }

  function normalizePathname(value = location.pathname) {
    const path = String(value || '/').toLowerCase().replace(/\/+$/, '');
    return path || '/';
  }

  function isRestrictedChatGptPath(pathname = location.pathname) {
    const path = normalizePathname(pathname);
    return RESTRICTED_PATHS.some(base => path === base || path.startsWith(`${base}/`));
  }

  function isRestrictedChatGptUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ''), location.href);
      return url.protocol === 'https:' && url.hostname.toLowerCase() === 'chatgpt.com' && isRestrictedChatGptPath(url.pathname);
    } catch {
      return false;
    }
  }

  function isPersonalizationRoute() {
    let hash = location.hash || '';
    try {
      hash = decodeURIComponent(hash);
    } catch {
      // Malformed hashes should not break the extension.
    }
    return normalizeText(hash).startsWith('#settings/personalization');
  }

  function setInlinePaintGate(active) {
    const root = document.documentElement;
    if (!root) return;

    if (active) {
      root.setAttribute('data-bravefox-inline-gated', 'true');
      root.style.setProperty('visibility', 'hidden', 'important');
      root.style.setProperty('opacity', '0', 'important');
      root.style.setProperty('pointer-events', 'none', 'important');
      root.style.setProperty('background', '#ffffff', 'important');
      return;
    }

    if (root.getAttribute('data-bravefox-inline-gated') !== 'true') return;
    root.removeAttribute('data-bravefox-inline-gated');
    root.style.removeProperty('visibility');
    root.style.removeProperty('opacity');
    root.style.removeProperty('pointer-events');
    root.style.removeProperty('background');
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

      .${HIDDEN_CLASS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Firefox secondary-browser navigation: these surfaces simply do not exist. */
      a[data-testid="plugins-button"][data-sidebar-item="true"],
      a[href="/plugins"],
      a[href="/gpts"],
      a[href="/images"],
      a[href="/plugins"]:has(use[href*="#all-products"]),
      div[data-sidebar-item="true"][aria-haspopup="menu"]:has(use[href$="#dots-horizontal"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Account menu Personalization / Yksilöinti — paint-time no-glimpse. */
      [role="menuitem"]:has(use[href*="#face"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Google-only ChatGPT sign-in lane. */
      [data-testid="signup-button"],
      input#email,
      input[name="email"][type="email"],
      label:has(> input#email),
      div:has(> input#email),
      div:has(> label > input#email),
      button:has(use[href$="#f5a288"]),
      button:has(use[href$="#d6f274"]),
      body:has(input#email) button[type="submit"][class*="btn-primary"][class*="h-13"][class*="w-full"],
      body:has(input#email) div[class*="grid-cols-[1fr_max-content_1fr]"][class~="my-2"]:has(> div.h-px),
      body:has(input#email) div.flex.flex-col.gap-3:has(button use[href$="#8e7aa4"]) > button:not(:has(use[href$="#8e7aa4"])) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Sensitive Personalization controls remain no-glimpse protected. */
      html.${PERSONALIZATION_CLASS}
      div.border-token-border-light.bg-token-bg-elevated-secondary.flex.min-h-20.flex-col.items-start.gap-3.rounded-2xl.border.px-4.py-4,
      html.${PERSONALIZATION_CLASS} [role="menuitem"][data-color="danger"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      button[aria-label="Tietoja sinusta -valikko"],
      button[aria-label^="Tietoja sinusta"][aria-haspopup="menu"],
      button[aria-label="About you menu"],
      button[aria-label^="About you"][aria-haspopup="menu"] {
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

  async function sendRuntimeMessage(message) {
    if (!api?.runtime?.sendMessage) return { ok: false, error: 'Extension runtime unavailable.' };
    try {
      const result = api.runtime.sendMessage(message);
      if (result && typeof result.then === 'function') return await result;
      return await new Promise(resolve => {
        api.runtime.sendMessage(message, response => {
          const runtimeError = api.runtime.lastError;
          resolve(runtimeError
            ? { ok: false, error: runtimeError.message }
            : (response || { ok: false, error: 'No response from BraveFox background.' }));
        });
      });
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }

  function makeAuthRequestId() {
    try {
      if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
      const bytes = new Uint8Array(16);
      globalThis.crypto?.getRandomValues?.(bytes);
      return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    } catch {
      return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }

  async function requestRestrictedTabClose(targetUrl = location.href) {
    const response = await sendRuntimeMessage({
      type: 'BRAVEFOX_CHATGPT_CLOSE_RESTRICTED',
      targetUrl
    });
    if (!response?.ok) {
      console.warn('[BraveFox Enhancer] Firefox could not close restricted ChatGPT route:', response?.error || response);
    }
    return Boolean(response?.ok);
  }

  async function beginNativePasswordFlow({ kind = 'protected-route', title, returnUrl = location.href }) {
    if (authRedirectRequested) return false;
    authRedirectRequested = true;
    document.documentElement.classList.add(GATED_CLASS, PERSONALIZATION_CLASS);
    setInlinePaintGate(true);

    const response = await sendRuntimeMessage({
      type: 'BRAVEFOX_CHATGPT_AUTH_BEGIN',
      requestId: makeAuthRequestId(),
      kind,
      routeKey: 'personalization',
      title,
      returnUrl
    });

    if (!response?.ok) {
      authRedirectRequested = false;
      console.warn('[BraveFox Enhancer] Could not open native ChatGPT password page:', response?.error || response);
      return false;
    }
    return true;
  }

  async function consumeNativePasswordGrant() {
    const response = await sendRuntimeMessage({ type: 'BRAVEFOX_CHATGPT_AUTH_CONSUME' });
    return response?.ok && response?.unlocked ? response : null;
  }

  async function synchronizeRoute() {
    if (routeAuthCheckInProgress) return;

    if (isRestrictedChatGptPath(location.pathname)) {
      setInlinePaintGate(true);
      void requestRestrictedTabClose(location.href);
      return;
    }

    const onPersonalization = isPersonalizationRoute();
    document.documentElement.classList.toggle(PERSONALIZATION_CLASS, onPersonalization);

    if (!onPersonalization) {
      personalizationVisitActive = false;
      protectedRouteUnlocked = false;
      authRedirectRequested = false;
      pendingApprovedAction = null;
      document.documentElement.classList.remove(GATED_CLASS);
      setInlinePaintGate(false);
      configurePersonalizationObserver(false);
      return;
    }

    configurePersonalizationObserver(true);
    if (personalizationVisitActive && protectedRouteUnlocked) return;

    personalizationVisitActive = true;
    routeAuthCheckInProgress = true;
    document.documentElement.classList.add(GATED_CLASS);
    setInlinePaintGate(true);

    try {
      const grant = await consumeNativePasswordGrant();
      if (grant) {
        protectedRouteUnlocked = true;
        authRedirectRequested = false;
        pendingApprovedAction = grant.kind === 'memory-summary' ? grant : null;
        hideSensitiveMemoryControls(document);
        cleanChatGptUi(document);
        document.documentElement.classList.remove(GATED_CLASS);
        setInlinePaintGate(false);

        if (pendingApprovedAction) {
          pendingApprovedAction = null;
          resumeMemorySummaryAfterUnlock();
        }
        return;
      }

      await beginNativePasswordFlow({
        kind: 'protected-route',
        title: PERSONALIZATION_PROMPT,
        returnUrl: location.href
      });
    } finally {
      routeAuthCheckInProgress = false;
    }
  }

  function queueRouteCheck() {
    if (routeCheckQueued) return;
    routeCheckQueued = true;
    queueMicrotask(() => {
      routeCheckQueued = false;
      checkForRouteChange();
    });
  }

  function checkForRouteChange() {
    if (location.href === lastUrl) return false;
    lastUrl = location.href;
    void synchronizeRoute();
    scheduleGeneralUiScan(true);
    if (normalizeText(location.hash).startsWith('#settings')) armPortalWatcher();
    return true;
  }

  function installNavigationGuards() {
    const handleNavigation = () => {
      lastUrl = location.href;
      void synchronizeRoute();
      scheduleGeneralUiScan(true);
      if (normalizeText(location.hash).startsWith('#settings')) armPortalWatcher();
    };

    window.addEventListener('hashchange', handleNavigation, true);
    window.addEventListener('popstate', handleNavigation, true);
    window.addEventListener('pageshow', handleNavigation, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForRouteChange();
    }, true);

    try {
      if (globalThis.navigation?.addEventListener) {
        globalThis.navigation.addEventListener('navigate', event => {
          const destinationUrl = event?.destination?.url;
          if (!destinationUrl || !isRestrictedChatGptUrl(destinationUrl)) return;
          setInlinePaintGate(true);
          void requestRestrictedTabClose(destinationUrl);
        });
        globalThis.navigation.addEventListener('currententrychange', queueRouteCheck);
      }
    } catch {
      // Firefox versions without Navigation API are covered by click guards + background webNavigation.
    }
  }

  function installInteractionGuards() {
    document.addEventListener('click', event => {
      if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        const anchor = getElementFromEvent(event, 'a[href]');
        if (anchor) {
          const targetUrl = new URL(anchor.getAttribute('href'), location.href);
          if (isRestrictedChatGptUrl(targetUrl.href)) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            setInlinePaintGate(true);
            void requestRestrictedTabClose(targetUrl.href);
            return;
          }
        }
      }

      const menuItem = getElementFromEvent(event, '[role="menuitem"]');
      if (menuItem && isDeleteAllMemoriesItem(menuItem)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        menuItem.remove();
        return;
      }

      const button = getButtonFromEvent(event);
      if (button && !replayAllowedButtons.has(button) && isMemorySummaryManageButton(button)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void beginNativePasswordFlow({
          kind: 'memory-summary',
          title: MEMORY_SUMMARY_PROMPT,
          returnUrl: location.href
        });
        return;
      }

      if (menuItem || isLikelyMenuTrigger(event.target) || isLikelySettingsInteraction(event.target)) {
        armPortalWatcher();
        scheduleGeneralUiScan(false);
      }
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (isLikelyMenuTrigger(event.target) || isLikelySettingsInteraction(event.target)) {
        armPortalWatcher();
        scheduleGeneralUiScan(false);
      }
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

  function isLikelyMenuTrigger(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
      'button[aria-haspopup="menu"], button[aria-haspopup="listbox"], [role="button"][aria-haspopup="menu"], [role="button"][aria-haspopup="listbox"]'
    ));
  }

  function isLikelySettingsInteraction(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
      '[role="menuitem"], [role="dialog"] button, [role="dialog"] [role="tab"], [role="dialog"] a'
    ));
  }

  function armPortalWatcher(duration = PORTAL_WATCH_MS) {
    const start = () => {
      if (!document.documentElement) return;

      if (!portalObserver) {
        portalObserver = new MutationObserver(mutations => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (!(node instanceof Element)) continue;
              const relevant =
                node.matches('[role="menu"], [role="dialog"], [role="menuitem"], a[href="/plugins"], a[href="/gpts"], a[href="/images"]') ||
                node.querySelector('[role="menu"], [role="dialog"], [role="menuitem"], a[href="/plugins"], a[href="/gpts"], a[href="/images"]');
              if (!relevant) continue;
              cleanChatGptUi(node);
            }
          }
        });
        portalObserver.observe(document.documentElement, { childList: true, subtree: true });
      }

      if (portalObserverTimer) clearTimeout(portalObserverTimer);
      portalObserverTimer = window.setTimeout(() => {
        portalObserverTimer = 0;
        portalObserver?.disconnect();
        portalObserver = null;
      }, Math.max(300, Number(duration) || PORTAL_WATCH_MS));
    };

    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function configurePersonalizationObserver(enable) {
    if (!enable) {
      personalizationObserver?.disconnect();
      personalizationObserver = null;
      if (personalizationMaintenanceTimer) {
        clearTimeout(personalizationMaintenanceTimer);
        personalizationMaintenanceTimer = 0;
      }
      return;
    }

    if (personalizationObserver || !document.documentElement) return;
    personalizationObserver = new MutationObserver(() => {
      queueRouteCheck();
      if (personalizationMaintenanceTimer) clearTimeout(personalizationMaintenanceTimer);
      personalizationMaintenanceTimer = window.setTimeout(() => {
        personalizationMaintenanceTimer = 0;
        if (!isPersonalizationRoute()) return;
        hideSensitiveMemoryControls(document);
        cleanChatGptUi(document);
      }, PERSONALIZATION_MAINTENANCE_MS);
    });
    personalizationObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function scheduleGeneralUiScan(immediate = false) {
    if (uiScanTimer) clearTimeout(uiScanTimer);
    if (uiScanRetryTimer) clearTimeout(uiScanRetryTimer);

    uiScanTimer = window.setTimeout(() => {
      uiScanTimer = 0;
      cleanChatGptUi(document);
      if (isPersonalizationRoute()) hideSensitiveMemoryControls(document);
    }, immediate ? 0 : 25);

    if (!immediate) {
      uiScanRetryTimer = window.setTimeout(() => {
        uiScanRetryTimer = 0;
        cleanChatGptUi(document);
        if (isPersonalizationRoute()) hideSensitiveMemoryControls(document);
      }, IS_ANDROID ? 220 : 150);
    }
  }

  function scheduleGoogleOnlyLoginCleanupRetries() {
    // CSS is authoritative for no-glimpse; finite retries collapse React wrappers.
    for (const delay of [0, 90, 280, 800, 1800]) {
      window.setTimeout(() => applyGoogleOnlyLoginPolicy(document), delay);
    }
  }

  function forEachMatch(scope, selector, callback) {
    if (!scope) return;
    if (scope instanceof Element && scope.matches(selector)) callback(scope);
    if (typeof scope.querySelectorAll !== 'function') return;
    for (const element of scope.querySelectorAll(selector)) callback(element);
  }

  function hardHide(element) {
    if (!(element instanceof Element)) return;
    hideElement(element);
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
  }

  function hideElement(element) {
    if (!(element instanceof Element)) return;
    element.classList.add(HIDDEN_CLASS);
    element.setAttribute('aria-hidden', 'true');
  }

  function applySecondaryBrowserNavigationCleanup(scope = document) {
    forEachMatch(scope, 'a[href="/plugins"], a[href="/gpts"], a[href="/images"]', hardHide);

    forEachMatch(scope, '[data-sidebar-item="true"]', item => {
      const text = normalizeText(item.textContent);
      const href = normalizeText(item.getAttribute?.('href'));
      const isMore =
        Boolean(item.querySelector?.('use[href$="#dots-horizontal"]')) ||
        text === 'lisää' ||
        text === 'more';
      const isExtraDestination =
        href === '/plugins' || href === '/gpts' || href === '/images' ||
        text === 'lisäosat' || text === 'plugins' ||
        text === 'gpt:t' || text === 'gpts' ||
        text === 'kuvat' || text === 'images';
      if (isMore || isExtraDestination) hardHide(item);
    });
  }

  function applyAccountAndSettingsCleanup(scope = document) {
    forEachMatch(scope, '[role="menuitem"]', item => {
      const text = normalizeText(item.textContent);
      const hasFaceIcon = Boolean(item.querySelector('use[href*="#face"]'));
      if (hasFaceIcon || text === 'yksilöinti' || text === 'personalization') hardHide(item);
    });

    // Settings > Plugins/Browse addons. Hide the exact link always; collapse its row only
    // when the small settings-row structure is positively identified.
    forEachMatch(scope, 'a[href="/plugins"]', link => {
      hardHide(link);
      const text = normalizeText(link.textContent);
      const isBrowseAddons =
        Boolean(link.querySelector('use[href*="#all-products"]')) ||
        text === 'selaa lisäosia' ||
        text === 'browse addons' ||
        text === 'browse add-ons';
      if (!isBrowseAddons) return;

      const wrapper = link.parentElement;
      const row = wrapper?.parentElement;
      const wrapperIsExact =
        wrapper instanceof HTMLElement &&
        wrapper.children.length === 1 &&
        wrapper.firstElementChild === link &&
        wrapper.classList.contains('w-full');
      const rowIsExact =
        row instanceof HTMLElement &&
        row.children.length === 1 &&
        row.firstElementChild === wrapper &&
        row.classList.contains('border-token-border-light') &&
        row.classList.contains('flex') &&
        row.classList.contains('items-center') &&
        row.classList.contains('border-b');
      if (wrapperIsExact && rowIsExact) hardHide(row);
    });
  }

  function applyGoogleOnlyLoginPolicy(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    forEachMatch(scope, '[data-testid="signup-button"]', hideElement);
    forEachMatch(scope, 'button:has(use[href$="#f5a288"]), button:has(use[href$="#d6f274"])', hideElement);

    const email = document.querySelector('input#email, input[name="email"][type="email"]');
    if (!email) return;

    hideElement(email);
    const fieldWrapper = email.closest('label') || email.parentElement;
    if (fieldWrapper && !fieldWrapper.matches('form, main, body')) hideElement(fieldWrapper);

    const form = email.closest('form');
    if (form) {
      for (const submit of form.querySelectorAll('button[type="submit"]')) hideElement(submit);
    } else {
      for (const submit of document.querySelectorAll('button[type="submit"][class*="btn-primary"][class*="h-13"][class*="w-full"]')) {
        hideElement(submit);
      }
    }

    for (const divider of document.querySelectorAll('div[class*="grid-cols-[1fr_max-content_1fr]"]')) {
      const text = normalizeText(divider.textContent);
      if ((text === 'tai' || text === 'or') && divider.querySelector('.h-px')) hideElement(divider);
    }

    for (const group of document.querySelectorAll('div.flex.flex-col.gap-3')) {
      if (!group.querySelector('button use[href$="#8e7aa4"]')) continue;
      for (const button of group.querySelectorAll(':scope > button')) {
        if (!button.querySelector('use[href$="#8e7aa4"]')) hideElement(button);
      }
    }
  }

  function isDeleteAllMemoriesItem(menuItem) {
    return DELETE_ALL_MEMORY_LABELS.has(normalizeText(menuItem.textContent));
  }

  function isMemorySummaryManageButton(button) {
    if (!isPersonalizationRoute() || !protectedRouteUnlocked) return false;
    if (!MANAGE_LABELS.has(normalizeText(button.textContent))) return false;

    let node = button;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      if (MEMORY_SUMMARY_LABELS.some(label => context.includes(label))) return true;
    }
    return false;
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

  function resumeMemorySummaryAfterUnlock(attempt = 0) {
    const button = findMemorySummaryManageButton();
    if (button) {
      replayAllowedButtons.add(button);
      try {
        button.click();
      } finally {
        queueMicrotask(() => replayAllowedButtons.delete(button));
      }
      return;
    }
    if (attempt < 24) window.setTimeout(() => resumeMemorySummaryAfterUnlock(attempt + 1), 125);
  }

  function hideSensitiveMemoryControls(scope = document) {
    if (!isPersonalizationRoute()) return;
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
      if (row) hideElement(row);
    });
  }

  function findSettingRow(startNode) {
    let node = startNode;
    let outermostSwitchContainer = null;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (node.querySelector?.('button[role="switch"]')) outermostSwitchContainer = node;
      if (node.classList?.contains('border-token-border-light')) return node;
    }
    return outermostSwitchContainer;
  }

  function hideEnhancedMemoryBanners(scope = document) {
    if (!isPersonalizationRoute()) return;

    const cardSelector =
      'div.border-token-border-light.bg-token-bg-elevated-secondary.flex.min-h-20.flex-col.items-start.gap-3.rounded-2xl.border.px-4.py-4';

    forEachMatch(scope, cardSelector, card => {
      const context = normalizeText(card.textContent);
      if (includesAny(context, LEGACY_MEMORY_BANNER_TEXT) && includesAny(context, ENHANCED_MEMORY_BUTTON_LABELS)) {
        hideElement(card);
      }
    });

    forEachMatch(scope, 'button[type="button"]', button => {
      if (!ENHANCED_MEMORY_BUTTON_LABELS.has(normalizeText(button.textContent))) return;
      let card = button.closest('div.border-token-border-light.bg-token-bg-elevated-secondary');
      if (!card) {
        let node = button.parentElement;
        for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
          if (includesAny(normalizeText(node.textContent), LEGACY_MEMORY_BANNER_TEXT)) {
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

  function cleanChatGptUi(scope = document) {
    applyGoogleOnlyLoginPolicy(scope);
    applySecondaryBrowserNavigationCleanup(scope);
    applyAccountAndSettingsCleanup(scope);

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
    `[BraveFox Enhancer] Firefox ChatGPT lean mode active (${IS_ANDROID ? 'Fenix Nightly' : 'PC/ESR'}; route-specific observers only).`
  );
})();
