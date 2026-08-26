/* ChatGPT.js
 * BraveFox Enhancer — ChatGPT SPA/sub-page protection and UI cleanup.
 *
 * Goals:
 * - Keep protected ChatGPT routes behind BraveFox's existing password page.
 * - Remove selected ChatGPT UI controls without a visible flash.
 * - Stay friendly to long-lived ChatGPT tabs/PWAs: no always-on whole-page mutation
 *   scanning while messages are streaming.
 *
 * Performance model:
 * - Deterministic removals are CSS-first at document_start.
 * - Route changes use browser navigation events plus a tiny always-on href comparison
 *   fallback so ChatGPT SPA router changes cannot delay a protected-route gate.
 * - MutationObserver is enabled only on routes that genuinely need live DOM policing
 *   (Personalization, Plugins and GPT directory), rather than across every chat message mutation.
 * - General menu cleanup runs only on startup/route changes and when menu-like controls
 *   are opened.
 */

(() => {
  'use strict';

  if (window.top !== window) return;

  // Resolve the actual WebExtension API by capability. Some installed-app/PWA
  // environments may expose a non-extension `browser` global, so blindly preferring
  // `browser` can hide Chrome's real `chrome.runtime` object.
  const api = resolveExtensionApi();

  function resolveExtensionApi() {
    // Prefer the real Chromium extension object in the PWA, and require storage when
    // possible because the plugin vault depends on persistent extension-local state.
    const candidates = [globalThis.chrome, globalThis.browser];

    for (const candidate of candidates) {
      try {
        if (
          typeof candidate?.runtime?.getURL === 'function' &&
          typeof candidate?.storage?.local?.get === 'function' &&
          typeof candidate?.storage?.local?.set === 'function'
        ) {
          return candidate;
        }
      } catch {
        // Keep trying.
      }
    }

    for (const candidate of candidates) {
      try {
        if (typeof candidate?.runtime?.getURL === 'function') return candidate;
      } catch {
        // Keep trying.
      }
    }
    return null;
  }

  const STYLE_ID = 'bravefox-chatgpt-style';
  const GATED_CLASS = 'bravefox-chatgpt-gated';
  const PERSONALIZATION_CLASS = 'bravefox-chatgpt-personalization';
  const HIDDEN_CLASS = 'bravefox-chatgpt-hidden';

  const PERSONALIZATION_PROMPT = 'ChatGPT Personalization settings are password protected';
  const MEMORY_SUMMARY_PROMPT = 'Are you sure you want to do this? Enter password';

  const PROTECTED_PATH_ROUTES = [
    { key: 'plugins', path: '/plugins', title: 'ChatGPT Plugins are password protected' },
    { key: 'gpts', path: '/gpts', title: 'ChatGPT GPTs are password protected' }
  ];

  const MEMORY_ENABLE_LABELS = new Set(['ota muisti käyttöön', 'enable memory']);
  const MEMORY_SUMMARY_LABELS = ['muistiyhteenveto', 'memory summary', 'saved memories'];
  const MANAGE_LABELS = new Set(['hallitse', 'manage']);
  // ChatGPT renders the per-message memory status as an imperative React button
  // (for example "Muisti päivitetty" / "Memory updated"). Clicking it opens
  // saved memories without navigating through the protected Personalization route.
  const MEMORY_STATUS_TRIGGER_LABELS = new Set([
    'muisti päivitetty',
    'muisti tallennettu',
    'memory updated',
    'memory saved'
  ]);
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
  const DELETE_SINGLE_MEMORY_LABELS = new Set([
    'poista',
    'delete'
  ]);
  const SAVED_MEMORIES_DIALOG_LABELS = [
    'tallennetut muistot',
    'saved memories'
  ];

  const MODELS_TO_REMOVE = new Set([
    'gpt-5 instant',
    'gpt-5 thinking mini',
    'gpt-5 thinking',
    'o3',
    'o4-mini'
  ]);

  // === Plugins vault ============================================================
  // The supplied + button uses this sprite fragment. A card showing that + is an
  // installable/uninstalled catalog entry; installed/connected cards use some other
  // action state. BraveFox remembers the latter forever unless its storage is cleared.
  const PLUGIN_VAULT_KEY = 'bravefoxChatGptPluginVault_v2';
  const PLUGIN_VAULT_SEEDED_KEY = 'bravefoxChatGptPluginVaultSeeded_v2';
  const PLUGIN_SAVED_SECTION_ID = 'bravefox-chatgpt-saved-plugins';
  const PLUGIN_PLUS_ICON_FRAGMENT = '#6be74c';
  const PLUGIN_INSTALLED_ACTION_ICON_FRAGMENT = '#623957';
  const PLUGIN_INSTALL_PROMPT = 'Installing this saved ChatGPT plugin is password protected';
  const PLUGIN_CARD_LINK_SELECTOR = 'a[href^="/plugins/"]';
  const PLUGIN_INSTALLED_STATUS_TERMS = [
    'installed', 'asennettu', 'connected', 'yhdistetty', 'enabled', 'käytössä'
  ];
  const PLUGIN_INSTALL_ARIA_TERMS = [
    'install', 'asenna', 'add ', 'lisää', 'update to install', 'päivitä, jotta voit asentaa'
  ];

  // === GPT directory allowlist ==================================================
  // Edit THIS ONE ARRAY to control which third-party GPTs stay visible on /gpts.
  // Everything else is removed, except GPTs published by OpenAI/ChatGPT itself.
  // Titles are normalized before matching, so punctuation/case differences are ignored.
  const GPT_ALLOWLIST = [
    'ScholarGPT',
    'Consensus',
    'AskYourPDF Research assistant',
    'PDF Reader',
    'SciSpace',
    'YouTube Video Summarizer',
    'DesignerGPT',
    'Mia AI',
    'Code',
    'Mirror 4o',
    'Code Copilot',
    'Code GPT',
    'Website AI Designer',
    'SQL Expert (QueryGPT)',
    'Ethical Hacker GPT',
    'Website Generator',
    'Website Builder, Generator & Creator AI',
    'Unbound Limitless Storywriter',
    'Translate GPT',
    'Website & App Builder🔹Mobile App AI'
  ];
  const GPT_NATIVE_PUBLISHERS = ['openai', 'chatgpt'];
  const GPT_CARD_SELECTOR = 'a.gizmo-link';
  const GPT_SOURCE_SECTION_SELECTOR = 'div.h-fit.scroll-mt-28';
  const GPT_APPROVED_SECTION_ID = 'bravefox-approved-gpts';
  const GPT_APPROVED_SECTION_ATTR = 'data-bravefox-gpt-approved-section';
  const GPTS_CURATING_CLASS = 'bravefox-gpts-curating';
  const PLUGINS_CURATING_CLASS = 'bravefox-plugins-curating';
  const PLUGINS_READY_CLASS = 'bravefox-plugins-ready';
  // Keep /plugins paint-hidden until React has stopped changing the native card set for
  // a short quiet window. This turns the old card-by-card reveal into one stable paint.
  const PLUGIN_READY_MIN_MS = 900;
  const PLUGIN_READY_QUIET_MS = 420;
  const PLUGIN_READY_HARD_MS = 3600;
  const LEGACY_GPT_APPROVED_TITLE = 'BraveFox Approved GPTs';
  const LEGACY_GPT_APPROVED_SUBTITLE = 'Useful GPTs on this list';
  const GPT_NATIVE_HEADER_ID = 'bravefox-gpts-native-header';
  const GPT_NATIVE_HEADER_ATTR = 'data-bravefox-gpt-native-header';
  const GPT_NATIVE_HERO_ATTR = 'data-bravefox-gpt-native-hero';
  const GPT_NATIVE_ACTIONS_ATTR = 'data-bravefox-gpt-native-actions';
  const GPT_NATIVE_DESCRIPTION_TERMS = [
    'löydä ja luo mukautettuja chatgpt-versioita',
    'loyda ja luo mukautettuja chatgpt-versioita',
    'find and create custom versions of chatgpt',
    'discover and create custom versions of chatgpt'
  ];
  const GPT_SHOW_MORE_LABELS = new Set(['näytä enemmän', 'show more']);
  const GPT_MAX_SHOW_MORE_CLICKS = 4;
  const GPT_MIN_CURATION_MS = 1200;
  const GPT_HARD_CURATION_MS = 8000;

  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  // Always-on route polling is only a location.href string comparison. It is cheap, and
  // provides a deterministic fallback when ChatGPT's SPA navigation skips browser events.
  const ROUTE_POLL_MS = IS_ANDROID ? 900 : 500;

  let routeObserver = null;
  let routePollTimer = 0;
  let routeMaintenanceTimer = 0;
  let activeProtectedRouteKey = null;
  let protectedRouteUnlocked = false;
  let routeAuthCheckInProgress = false;
  let authRedirectRequested = false;
  let pendingApprovedAction = null;
  let lastUrl = location.href;
  let routeCheckQueued = false;
  let uiScanTimer = 0;
  let uiScanRetryTimer = 0;
  let escapeHatchObserver = null;
  let sidebarPolishTimers = [];
  let pluginVault = new Map();
  let pluginVaultLoaded = false;
  let pluginVaultLoadPromise = null;
  let pluginVaultSeeded = false;
  let pluginCurationStartedAt = 0;
  let pluginCurationLastActivityAt = 0;
  let pluginLastNativeSignature = '';
  let pluginReadyTimer = 0;
  let gptApprovedSection = null;
  let gptApprovedGrid = null;
  let gptNativeHeaderHost = null;
  let gptCurationStartedAt = 0;
  let gptCurationLastActivityAt = 0;
  let gptCurationRetryTimer = 0;
  const gptApprovedKeys = new Set();
  const gptShowMoreState = new WeakMap();

  const replayAllowedButtons = new WeakSet();
  const replayAllowedPluginButtons = new WeakSet();

  // Pre-arm protected pages at document_start. On a direct /plugins or /gpts load,
  // ChatGPT never gets a paint before BraveFox either consumes a one-time unlock grant
  // or redirects the tab to the extension's native password page.
  const initialProtectedRoute = getProtectedRouteDescriptor();
  if (initialProtectedRoute) {
    document.documentElement.classList.add(GATED_CLASS);
    setInlinePaintGate(true);
  }
  if (isPluginsPathname(location.pathname)) document.documentElement.classList.add(PLUGINS_CURATING_CLASS);
  if (isGptsPathname(location.pathname)) document.documentElement.classList.add(GPTS_CURATING_CLASS);

  injectStyles();
  void synchronizeRoute();
  installNavigationGuards();
  installInteractionGuards();
  installEscapeHatchObserver();
  configureRouteObserver();
  scheduleGeneralUiScan(true);
  scheduleSidebarPolishRetries();
  scheduleGoogleOnlyLoginCleanupRetries();

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

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function normalizeLooseTitle(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9äöå]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

      .${HIDDEN_CLASS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Google-only ChatGPT sign-in lane. These are paint-time selectors, so the
       * disallowed auth paths never get a one-frame cameo while React mounts them.
       * Google itself is intentionally untouched. */
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

      /* Account/settings escape-hatch cleanup. Keep these selectors paint-time so
       * Personalization in the profile menu and Browse addons in Settings never flash.
       * Bundle filenames may rotate; the sprite fragment ids are the stable part. */
      [role="menuitem"]:has(use[href*="#face"]),
      a[href="/plugins"]:has(use[href*="#all-products"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* BraveFox ChatGPT navigation cleanup: no Plugins shortcut, no featured-plugin
       * promo row, and no native More/Lisää menu flash before it is replaced by Images. */
      a[data-testid="plugins-button"][data-sidebar-item="true"],
      a[data-sidebar-item="true"][href="/plugins"],
      a.interactive-button[href^="/plugins?category=featured"],
      div[data-sidebar-item="true"][aria-haspopup="menu"]:has(use[href$="#dots-horizontal"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      a[data-bravefox-sidebar-images="true"] {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
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

      /* Hide the native "Enable memory" setting row at paint time. The supplied
       * ChatGPT row is the border-token-border-light/min-h-15 setting row containing
       * the memory switch. The text check in hideMemoryEnableRows remains the semantic
       * guard; this CSS rule prevents the row from flashing before React cleanup runs. */
      html.${PERSONALIZATION_CLASS}
      div.border-token-border-light.flex.min-h-15.items-center.border-b:has(button[role="switch"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* The memory-summary overflow menu is rendered in a portal. */
      html.${PERSONALIZATION_CLASS}
      [role="menuitem"][data-color="danger"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* /plugins stays in a paint-safe filtering lane. Keep the main pane hidden until
       * the vault has loaded and the first policy pass has classified native cards. */
      html.${PLUGINS_CURATING_CLASS}:not(.${PLUGINS_READY_CLASS}) main,
      html.${PLUGINS_CURATING_CLASS}:not(.${PLUGINS_READY_CLASS}) [role="main"] {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Keep React's plugin page structure mounted. Hide only rejected plugin cards and
       * card-bearing sections that contain no approved descendant. This is deliberately
       * nesting-safe: an approved inner grid can no longer sit inside a hidden outer
       * <section>, which was the reason /plugins could finish as an empty shell. */
      html.${PLUGINS_CURATING_CLASS}
      article:has(a[href^="/plugins/"]):not([data-bravefox-plugin-allowed]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html.${PLUGINS_CURATING_CLASS}
      section:has(article a[href^="/plugins/"]):not(:has(article[data-bravefox-plugin-allowed])) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html.${PLUGINS_CURATING_CLASS} article[data-bravefox-plugin-allowed] {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      html.${PLUGINS_CURATING_CLASS}
      section:has(article[data-bravefox-plugin-allowed]) {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      html.${PLUGINS_CURATING_CLASS} #${PLUGIN_SAVED_SECTION_ID},
      html.${PLUGINS_CURATING_CLASS} #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      html.${PLUGINS_CURATING_CLASS} #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card {
        display: flex !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} {
        margin: 0 0 24px 0 !important;
        padding: 12px !important;
        border: 1px solid rgba(127, 127, 127, 0.22) !important;
        border-radius: 16px !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
        gap: 8px !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 10px !important;
        border-radius: 14px !important;
        background: var(--main-surface-secondary, rgba(127, 127, 127, 0.08)) !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card img {
        width: 40px !important;
        height: 40px !important;
        border-radius: 10px !important;
        object-fit: cover !important;
        flex: 0 0 auto !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-link {
        min-width: 0 !important;
        flex: 1 1 auto !important;
        text-decoration: none !important;
        color: inherit !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-name {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-weight: 600 !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-note {
        opacity: 0.68 !important;
        font-size: 12px !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-reinstall {
        width: 32px !important;
        height: 32px !important;
        border: 0 !important;
        border-radius: 999px !important;
        cursor: pointer !important;
        font-size: 22px !important;
        line-height: 1 !important;
      }

      /* /gpts is a BraveFox-owned curated shelf. Hide ChatGPT's native category UI
       * at paint time so rejected cards/sections never flash before JavaScript filters
       * them. Only the donor shelf marked by BraveFox is allowed to become visible. */
      html.${GPTS_CURATING_CLASS} div.sticky.top-14.z-10,
      html.${GPTS_CURATING_CLASS} ${GPT_SOURCE_SECTION_SELECTOR}:not([${GPT_APPROVED_SECTION_ATTR}="true"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html.${GPTS_CURATING_CLASS} [${GPT_APPROVED_SECTION_ATTR}="true"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      /* The visible /gpts chrome stays stock ChatGPT. BraveFox only owns the filtered
       * card grid beneath it. Any heading left by an older BraveFox build is suppressed. */
      #${GPT_APPROVED_SECTION_ID} > [data-bravefox-gpt-heading="true"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Keep ChatGPT's real title/description/search exactly where React owns them.
       * BraveFox creates only lightweight action proxies, positioned in the page's
       * top-right utility area so React-controlled nodes never need to move. */
      #${GPT_NATIVE_HEADER_ID} {
        display: flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        gap: 0.5rem !important;
        width: auto !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        /* Keep the native-style GPT actions out of the vertical directory flow.
         * This mirrors ChatGPT's own top-right utility placement and lets the
         * approved shelf sit naturally closer to the search field. */
        position: fixed !important;
        top: 0.9rem !important;
        right: 1.25rem !important;
        z-index: 60 !important;
        margin: 0 !important;
      }

      #${GPT_NATIVE_HEADER_ID} [data-bravefox-gpt-action-proxy="my-gpts"] {
        border: 0 !important;
        background: transparent !important;
        color: inherit !important;
        cursor: pointer !important;
        font-size: 0.875rem !important;
        font-weight: 500 !important;
        padding: 0.35rem 0.2rem !important;
      }

      #${GPT_NATIVE_HEADER_ID} [data-bravefox-gpt-action-proxy="create"] {
        border: 0 !important;
        border-radius: 999px !important;
        background: #000000 !important;
        color: #ffffff !important;
        cursor: pointer !important;
        font-size: 0.875rem !important;
        font-weight: 600 !important;
        padding: 0.4rem 0.75rem !important;
      }

      [${GPT_NATIVE_HERO_ATTR}="true"] {
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        /* ChatGPT currently lets the GPT directory hero grow to nearly a viewport.
         * Once BraveFox removes the native shelves that leaves a giant blank spacer
         * between Search and the curated grid. Keep the stock hero, but make its
         * layout height match its actual title/description/search content. */
        min-height: 0 !important;
        height: auto !important;
        flex: 0 0 auto !important;
        flex-grow: 0 !important;
        padding-bottom: 0 !important;
        margin-bottom: 0 !important;
      }

      #${GPT_APPROVED_SECTION_ID} {
        min-height: 0 !important;
        /* One final compacting pass after moving the action row out of flow. */
        margin-top: -0.7rem !important;
      }

      #${GPT_APPROVED_SECTION_ID} > [data-bravefox-gpt-content="true"] {
        margin-top: 0 !important;
      }

      #${GPT_APPROVED_SECTION_ID} a.gizmo-link {
        min-height: 104px !important;
      }

      /* Expansion is automatic. Never show ChatGPT's Show more button in the custom shelf. */
      html.${GPTS_CURATING_CLASS} [${GPT_APPROVED_SECTION_ATTR}="true"] button.btn-secondary.w-full {
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

  function getProtectedRouteDescriptorForUrl(value) {
    try {
      const url = new URL(String(value || location.href), location.href);
      if (url.origin !== location.origin) return null;

      let hash = url.hash || '';
      try {
        hash = decodeURIComponent(hash);
      } catch {
        // A malformed hash should not break the extension.
      }
      if (normalizeText(hash).startsWith('#settings/personalization')) {
        return { key: 'personalization', path: null, title: PERSONALIZATION_PROMPT };
      }

      const pathname = String(url.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
      for (const route of PROTECTED_PATH_ROUTES) {
        if (pathname === route.path || pathname.startsWith(`${route.path}/`)) return route;
      }
      return null;
    } catch {
      return null;
    }
  }

  function getProtectedRouteDescriptor() {
    return getProtectedRouteDescriptorForUrl(location.href);
  }

  function isPersonalizationRoute() {
    return getProtectedRouteDescriptor()?.key === 'personalization';
  }

  function isPluginsRoute() {
    return getProtectedRouteDescriptor()?.key === 'plugins';
  }

  function isGptsRoute() {
    return getProtectedRouteDescriptor()?.key === 'gpts';
  }

  function isPluginsPathname(pathname) {
    const normalizedPath = String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    return normalizedPath === '/plugins' || normalizedPath.startsWith('/plugins/');
  }

  function isGptsPathname(pathname) {
    const normalizedPath = String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    return normalizedPath === '/gpts' || normalizedPath.startsWith('/gpts/');
  }

  function resetPluginCurationState() {
    if (pluginReadyTimer) {
      clearTimeout(pluginReadyTimer);
      pluginReadyTimer = 0;
    }
    pluginCurationStartedAt = 0;
    pluginCurationLastActivityAt = 0;
    pluginLastNativeSignature = '';
    document.documentElement.classList.remove(PLUGINS_READY_CLASS);
  }

  function resetGptCurationState() {
    if (gptCurationRetryTimer) {
      clearTimeout(gptCurationRetryTimer);
      gptCurationRetryTimer = 0;
    }
    gptApprovedSection = null;
    gptApprovedGrid = null;
    gptNativeHeaderHost = null;
    gptCurationStartedAt = 0;
    gptCurationLastActivityAt = 0;
    gptApprovedKeys.clear();
  }

  function sendRuntimeMessage(message) {
    return new Promise(resolve => {
      try {
        if (!api?.runtime?.sendMessage) {
          resolve({ ok: false, error: 'Extension messaging is unavailable.' });
          return;
        }
        api.runtime.sendMessage(message, response => {
          const runtimeError = api.runtime.lastError;
          if (runtimeError) {
            resolve({ ok: false, error: runtimeError.message });
            return;
          }
          resolve(response || { ok: false, error: 'No response from BraveFox background.' });
        });
      } catch (error) {
        resolve({ ok: false, error: error?.message || String(error) });
      }
    });
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

  function preArmProtectedRoute(descriptor) {
    if (!descriptor) return;
    document.documentElement.classList.add(GATED_CLASS);
    setInlinePaintGate(true);
    document.documentElement.classList.toggle(PERSONALIZATION_CLASS, descriptor.key === 'personalization');
    document.documentElement.classList.toggle(PLUGINS_CURATING_CLASS, descriptor.key === 'plugins');
    document.documentElement.classList.toggle(GPTS_CURATING_CLASS, descriptor.key === 'gpts');
    if (descriptor.key === 'plugins') document.documentElement.classList.remove(PLUGINS_READY_CLASS);
  }

  async function beginNativePasswordFlow({ kind = 'protected-route', routeKey, title, returnUrl = location.href, payload = {} }) {
    if (authRedirectRequested) return false;
    authRedirectRequested = true;
    document.documentElement.classList.add(GATED_CLASS);
    setInlinePaintGate(true);

    const response = await sendRuntimeMessage({
      type: 'BRAVEFOX_CHATGPT_AUTH_BEGIN',
      requestId: makeAuthRequestId(),
      kind,
      routeKey,
      title,
      returnUrl,
      payload
    });

    if (!response?.ok) {
      authRedirectRequested = false;
      console.warn('[BraveFox Enhancer] Could not open native ChatGPT password page:', response?.error || response);
      if (protectedRouteUnlocked) document.documentElement.classList.remove(GATED_CLASS);
      return false;
    }
    return true;
  }

  async function consumeNativePasswordGrant() {
    const response = await sendRuntimeMessage({ type: 'BRAVEFOX_CHATGPT_AUTH_CONSUME' });
    return response?.ok && response?.unlocked ? response : null;
  }

  async function waitFor(ms) {
    await new Promise(resolve => window.setTimeout(resolve, ms));
  }

  async function prepareUnlockedProtectedRoute(routeKey) {
    if (routeKey === 'personalization') {
      hideSensitiveMemoryControls(document);
      cleanChatGptUi(document);
      return;
    }

    if (routeKey === 'plugins') {
      document.documentElement.classList.add(PLUGINS_CURATING_CLASS);
      await applyPluginPagePolicy(document);
      return;
    }

    if (routeKey === 'gpts') {
      document.documentElement.classList.add(GPTS_CURATING_CLASS);
      applyGptPagePolicy(document);
      // The custom shelf is now created by BraveFox itself and normally exists on the
      // first pass. Give React a very short grace window if <main> has not mounted yet.
      const deadline = Date.now() + 900;
      while (!gptApprovedSection?.isConnected && Date.now() < deadline) {
        await waitFor(45);
        applyGptPagePolicy(document);
      }
    }
  }

  function resumeMemorySummaryAfterUnlock(attempt = 0) {
    if (!isPersonalizationRoute() || !protectedRouteUnlocked) return;
    const button = findMemorySummaryManageButton();
    if (button) {
      replayManageClick(button);
      return;
    }
    if (attempt < 24) window.setTimeout(() => resumeMemorySummaryAfterUnlock(attempt + 1), 125);
  }

  function findPluginInstallButtonByKey(pluginKey) {
    for (const article of getPluginArticles(document)) {
      const info = extractPluginCardInfo(article);
      if (!info || info.key !== pluginKey) continue;
      for (const button of article.querySelectorAll('button[type="button"], button')) {
        if (isPluginInstallButton(button)) return button;
      }
    }
    return null;
  }

  function resumePluginInstallAfterUnlock(pluginKey, attempt = 0) {
    if (!isPluginsRoute() || !protectedRouteUnlocked || !pluginKey) return;
    const button = findPluginInstallButtonByKey(pluginKey);
    if (button) {
      replayPluginInstall(button, pluginKey);
      return;
    }

    if (attempt < 24) {
      window.setTimeout(() => resumePluginInstallAfterUnlock(pluginKey, attempt + 1), 125);
      return;
    }

    const savedEntry = pluginVault.get(pluginKey);
    if (savedEntry?.href) location.assign(savedEntry.href);
  }

  function resumeApprovedPasswordAction(grant) {
    if (!grant) return;
    if (grant.kind === 'memory-summary') {
      resumeMemorySummaryAfterUnlock();
      return;
    }
    if (grant.kind === 'plugin-install') {
      resumePluginInstallAfterUnlock(String(grant.payload?.pluginKey || ''));
    }
  }

  async function synchronizeRoute() {
    const descriptor = getProtectedRouteDescriptor();
    const routeKey = descriptor?.key || null;
    const onPersonalization = routeKey === 'personalization';
    const onPlugins = routeKey === 'plugins';
    const onGpts = routeKey === 'gpts';

    document.documentElement.classList.toggle(PERSONALIZATION_CLASS, onPersonalization);
    document.documentElement.classList.toggle(PLUGINS_CURATING_CLASS, onPlugins);
    document.documentElement.classList.toggle(GPTS_CURATING_CLASS, onGpts);

    if (routeKey !== activeProtectedRouteKey) {
      const previousRouteKey = activeProtectedRouteKey;
      activeProtectedRouteKey = routeKey;
      protectedRouteUnlocked = false;
      routeAuthCheckInProgress = false;
      authRedirectRequested = false;
      pendingApprovedAction = null;

      if (previousRouteKey === 'plugins' && routeKey !== 'plugins') {
        resetPluginCurationState();
        void finalizePluginVaultSeedIfReady();
      }
      if (routeKey === 'plugins' && previousRouteKey !== 'plugins') {
        resetPluginCurationState();
      }
      if (previousRouteKey === 'gpts' && routeKey !== 'gpts') {
        resetGptCurationState();
      }
    }

    configureRouteObserver();

    if (!descriptor) {
      document.documentElement.classList.remove(GATED_CLASS);
      document.documentElement.classList.remove(PLUGINS_READY_CLASS);
      setInlinePaintGate(false);
      return;
    }

    if (protectedRouteUnlocked) {
      document.documentElement.classList.remove(GATED_CLASS);
      setInlinePaintGate(false);
      return;
    }

    preArmProtectedRoute(descriptor);
    if (routeAuthCheckInProgress || authRedirectRequested) return;

    routeAuthCheckInProgress = true;
    try {
      const grant = await consumeNativePasswordGrant();
      const current = getProtectedRouteDescriptor();
      if (current?.key !== routeKey) return;

      if (grant?.routeKey === routeKey) {
        protectedRouteUnlocked = true;
        authRedirectRequested = false;
        pendingApprovedAction = grant;
        await prepareUnlockedProtectedRoute(routeKey);
        document.documentElement.classList.remove(GATED_CLASS);
        setInlinePaintGate(false);
        scheduleGeneralUiScan(true);
        const approvedAction = pendingApprovedAction;
        pendingApprovedAction = null;
        resumeApprovedPasswordAction(approvedAction);
        return;
      }

      await beginNativePasswordFlow({
        kind: 'protected-route',
        routeKey,
        title: descriptor.title,
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
    return true;
  }

  function installNavigationGuards() {
    const handleNavigation = () => {
      lastUrl = location.href;
      void synchronizeRoute();
      scheduleGeneralUiScan(true);
      scheduleSidebarPolishRetries();
    };

    window.addEventListener('hashchange', handleNavigation, true);
    window.addEventListener('popstate', handleNavigation, true);
    window.addEventListener('pageshow', handleNavigation, true);
    window.addEventListener('pagehide', () => {
      if (isPluginsRoute()) void finalizePluginVaultSeedIfReady();
    }, true);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForRouteChange();
    }, true);

    try {
      if (globalThis.navigation?.addEventListener) {
        // Pre-arm protected SPA destinations before ChatGPT commits the new route. This
        // closes the brief raw-/plugins glimpse that can otherwise happen before
        // currententrychange or the href poll notices the URL.
        globalThis.navigation.addEventListener('navigate', event => {
          try {
            const destinationUrl = event?.destination?.url;
            if (!destinationUrl) return;
            const descriptor = getProtectedRouteDescriptorForUrl(destinationUrl);
            const sameUnlockedLane =
              descriptor?.key &&
              descriptor.key === activeProtectedRouteKey &&
              protectedRouteUnlocked;
            if (descriptor && !sameUnlockedLane) preArmProtectedRoute(descriptor);
          } catch {
            // currententrychange/polling remain as fallbacks.
          }
        });
        globalThis.navigation.addEventListener('currententrychange', queueRouteCheck);
      }
    } catch {
      // Navigation API support is optional.
    }

    // Always keep the tiny href-string fallback. ChatGPT has changed router behavior
    // enough times that relying on one SPA event source is not worth another 3-second
    // password-gate delay. No DOM scanning happens here.
    routePollTimer = window.setInterval(checkForRouteChange, ROUTE_POLL_MS);
  }

  function installInteractionGuards() {
    document.addEventListener('click', event => {
      // Pre-empt normal left-click navigation into protected ChatGPT routes. This runs
      // in capture phase before React's router, so the protected page never paints first.
      if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        const anchor = getElementFromEvent(event, 'a[href]');
        if (anchor) {
          const targetUrl = new URL(anchor.getAttribute('href'), location.href);
          const targetDescriptor = getProtectedRouteDescriptorForUrl(targetUrl.href);
          const sameUnlockedLane =
            targetDescriptor?.key &&
            targetDescriptor.key === activeProtectedRouteKey &&
            protectedRouteUnlocked;

          if (targetDescriptor && !sameUnlockedLane) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            preArmProtectedRoute(targetDescriptor);
            void beginNativePasswordFlow({
              kind: 'protected-route',
              routeKey: targetDescriptor.key,
              title: targetDescriptor.title,
              returnUrl: targetUrl.href
            });
            return;
          }
        }
      }

      const menuItem = getElementFromEvent(event, '[role="menuitem"]');
      if (menuItem && isForbiddenMemoryDeleteItem(menuItem)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        hideElement(menuItem);
        menuItem.remove();
        return;
      }

      const button = getButtonFromEvent(event);
      const memoryStatusControl = getMemoryStatusEscapeControl(event);

      // The memory-status button in a normal chat opens saved memories directly and
      // therefore bypasses the protected #settings/personalization navigation lane.
      // Catch the React action in capture phase and deliberately send it through the
      // existing native BraveFox password page instead.
      if (memoryStatusControl && isMemoryStatusEscapeControl(memoryStatusControl)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const returnUrl = new URL(location.href);
        returnUrl.hash = '#settings/personalization';

        preArmProtectedRoute({ key: 'personalization', path: null, title: PERSONALIZATION_PROMPT });
        void beginNativePasswordFlow({
          kind: 'protected-route',
          routeKey: 'personalization',
          title: PERSONALIZATION_PROMPT,
          returnUrl: returnUrl.href
        });
        return;
      }

      if (button && !replayAllowedButtons.has(button) && isMemorySummaryManageButton(button)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        void beginNativePasswordFlow({
          kind: 'memory-summary',
          routeKey: 'personalization',
          title: MEMORY_SUMMARY_PROMPT,
          returnUrl: location.href
        });
        return;
      }

      if (button && isPluginsRoute() && !replayAllowedPluginButtons.has(button) && isPluginInstallButton(button)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void protectPluginInstallAction(button);
        return;
      }

      if (isLikelyMenuTrigger(event.target)) scheduleGeneralUiScan(false);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (isLikelyMenuTrigger(event.target)) scheduleGeneralUiScan(false);
    }, true);
  }

  function isLikelyMenuTrigger(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
      'button[aria-haspopup="menu"], button[aria-haspopup="listbox"], [role="button"][aria-haspopup="menu"], [role="button"][aria-haspopup="listbox"]'
    ));
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

  function isSingleMemoryDeleteItem(menuItem) {
    const label = normalizeText(menuItem?.textContent);
    if (!DELETE_SINGLE_MEMORY_LABELS.has(label)) return false;

    // The per-memory overflow menu is Radix/React portal-mounted under document.body,
    // not inside the Saved Memories modal. Scope it by requiring the real saved-memory
    // dialog to be open and at least one per-memory options trigger to exist there.
    // That avoids globally murdering every generic "Poista" / "Delete" menu item in ChatGPT.
    if (!hasSavedMemoriesDialogOpen()) return false;
    if (menuItem.getAttribute('data-color') === 'danger') return true;

    return Boolean(document.querySelector(
      'button[aria-label^="Lisää vaihtoehtoja muistille:"], button[aria-label^="More options for memory:"]'
    ));
  }

  function isForbiddenMemoryDeleteItem(menuItem) {
    return isDeleteAllMemoriesItem(menuItem) || isSingleMemoryDeleteItem(menuItem);
  }

  function hasSavedMemoriesDialogOpen() {
    for (const dialog of document.querySelectorAll('[role="dialog"][data-state="open"], [role="dialog"]')) {
      if (!(dialog instanceof Element)) continue;

      if (dialog.querySelector('#memories-search, input[name="memories-search"]')) return true;

      const title = dialog.querySelector('h1, h2, [id^="radix-"]');
      const titleText = normalizeText(title?.textContent);
      if (SAVED_MEMORIES_DIALOG_LABELS.some(label => titleText.includes(label))) return true;

      const dialogText = normalizeText(dialog.textContent);
      if (SAVED_MEMORIES_DIALOG_LABELS.some(label => dialogText.includes(label))) {
        const hasMemoryOptions = dialog.querySelector(
          'button[aria-label^="Lisää vaihtoehtoja muistille:"], button[aria-label^="More options for memory:"]'
        );
        if (hasMemoryOptions) return true;
      }
    }
    return false;
  }

  function getMemoryStatusEscapeControl(event) {
    return getElementFromEvent(event, 'button, [role="button"], a');
  }

  function isMemoryStatusEscapeControl(control) {
    if (!(control instanceof Element)) return false;
    if (!MEMORY_STATUS_TRIGGER_LABELS.has(normalizeText(control.textContent))) return false;

    // Personalization is already protected by the route gate. Never interfere with
    // legitimate memory controls after that lane has been explicitly unlocked.
    if (isPersonalizationRoute() && protectedRouteUnlocked) return false;
    return true;
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

  function configureRouteObserver() {
    const descriptor = getProtectedRouteDescriptor();
    const routeKey = descriptor?.key || null;
    const needsObserver =
      routeKey === 'personalization' ||
      routeKey === 'plugins' ||
      routeKey === 'gpts';

    if (!needsObserver) {
      routeObserver?.disconnect();
      routeObserver = null;
      if (routeMaintenanceTimer) {
        clearTimeout(routeMaintenanceTimer);
        routeMaintenanceTimer = 0;
      }
      return;
    }

    if (routeObserver) return;

    // Protected directory/settings pages can lazy-load a lot of React nodes. Batch all
    // mutation bursts into one cheap route-specific maintenance pass rather than scanning
    // every added subtree individually.
    routeObserver = new MutationObserver(() => {
      queueRouteCheck();
      scheduleRouteMaintenance();
    });

    routeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    scheduleRouteMaintenance(0);
  }

  function installEscapeHatchObserver() {
    if (escapeHatchObserver) return;

    const start = () => {
      if (escapeHatchObserver || !document.documentElement) return;

      escapeHatchObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;

            // Radix menus/settings dialogs are portal-mounted after the click that opens
            // them. Only inspect roots that can actually contain one of our two escape
            // hatches; normal chat/message DOM never reaches the expensive cleanup path.
            const relevant =
              node.matches('[role="menu"], [role="dialog"], [role="menuitem"], a[href="/plugins"]') ||
              node.querySelector('[role="menu"], [role="dialog"], [role="menuitem"], a[href="/plugins"]');
            if (!relevant) continue;

            applyAccountAndSettingsCleanup(node);
            if (isPersonalizationRoute()) hideSensitiveMemoryControls(node);
          }
        }
      });

      escapeHatchObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    };

    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function scheduleRouteMaintenance(delay = 70) {
    if (routeMaintenanceTimer) clearTimeout(routeMaintenanceTimer);
    routeMaintenanceTimer = window.setTimeout(() => {
      routeMaintenanceTimer = 0;
      const route = getProtectedRouteDescriptor()?.key;

      if (!document.getElementById(STYLE_ID)) injectStyles();

      // Protected pages are unusually mutation-heavy; keep the tiny sidebar policy
      // reasserted here so React cannot permanently evict the custom Kuvat/Images item.
      polishSidebarNavigation();
      removePluginFeaturedPromo(document);

      if (route === 'personalization') {
        hideSensitiveMemoryControls(document);
        cleanChatGptUi(document);
      } else if (route === 'plugins') {
        void applyPluginPagePolicy(document);
      } else if (route === 'gpts') {
        applyGptPagePolicy(document);
      }
    }, delay);
  }

  function scheduleGeneralUiScan(immediate = false) {
    if (uiScanTimer) {
      clearTimeout(uiScanTimer);
      uiScanTimer = 0;
    }
    if (uiScanRetryTimer) {
      clearTimeout(uiScanRetryTimer);
      uiScanRetryTimer = 0;
    }

    const firstDelay = immediate ? 0 : 20;
    uiScanTimer = window.setTimeout(() => {
      uiScanTimer = 0;
      runGeneralUiScan(document);
    }, firstDelay);

    // React portals can mount one task later than the click that opened them. One small
    // retry is much cheaper than a permanent observer over the entire conversation DOM.
    if (!immediate) {
      uiScanRetryTimer = window.setTimeout(() => {
        uiScanRetryTimer = 0;
        runGeneralUiScan(document);
      }, 140);
    }
  }

  function runGeneralUiScan(scope) {
    if (isPersonalizationRoute()) hideSensitiveMemoryControls(scope);
    if (isPluginsRoute()) void applyPluginPagePolicy(document);
    if (isGptsRoute()) applyGptPagePolicy(document);
    cleanChatGptUi(scope);
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
    if (!isPersonalizationRoute()) return;
    hideMemoryEnableRows(scope);
    hideEnhancedMemoryBanners(scope);
    removeForbiddenMemoryDeleteItems(scope);
  }

  function hideMemoryEnableRows(scope = document) {
    // Match the actual setting row supplied by ChatGPT rather than walking upward from
    // the switch. This is both more deterministic and resilient to extra wrapper divs.
    const rowSelector =
      'div.border-token-border-light.flex.min-h-15.items-center.border-b:has(button[role="switch"])';

    forEachMatch(scope, rowSelector, row => {
      const context = normalizeText(row.textContent);
      if (!includesAny(context, MEMORY_ENABLE_LABELS)) return;
      hideElement(row);
    });
  }

  function hideEnhancedMemoryBanners(scope = document) {
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

  function removeForbiddenMemoryDeleteItems(scope = document) {
    forEachMatch(scope, '[role="menuitem"]', item => {
      if (!isForbiddenMemoryDeleteItem(item)) return;
      hideElement(item);
      item.remove();
    });
  }

  // === Persistent ChatGPT plugin vault =========================================

  async function ensurePluginVaultLoaded() {
    if (pluginVaultLoaded) return pluginVault;
    if (pluginVaultLoadPromise) return pluginVaultLoadPromise;

    pluginVaultLoadPromise = (async () => {
      try {
        const stored = await api?.storage?.local?.get?.([
          PLUGIN_VAULT_KEY,
          PLUGIN_VAULT_SEEDED_KEY
        ]);
        const rows = Array.isArray(stored?.[PLUGIN_VAULT_KEY]) ? stored[PLUGIN_VAULT_KEY] : [];
        pluginVaultSeeded = stored?.[PLUGIN_VAULT_SEEDED_KEY] === true;
        pluginVault = new Map();

        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const key = getPluginKey(row.href || row.key);
          if (!key) continue;
          pluginVault.set(key, {
            key,
            href: row.href || key,
            name: String(row.name || 'Saved plugin'),
            iconSrc: String(row.iconSrc || ''),
            description: String(row.description || ''),
            cachedAt: Number(row.cachedAt) || Date.now()
          });
        }
      } catch (error) {
        console.warn('[BraveFox Enhancer] Failed to load ChatGPT plugin vault:', error);
        pluginVault = new Map();
      } finally {
        pluginVaultLoaded = true;
        pluginVaultLoadPromise = null;
      }
      return pluginVault;
    })();

    return pluginVaultLoadPromise;
  }

  async function savePluginVault() {
    try {
      if (!api?.storage?.local?.set) return;
      const rows = Array.from(pluginVault.values())
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map(entry => ({
          key: entry.key,
          href: entry.href,
          name: entry.name,
          iconSrc: entry.iconSrc,
          description: entry.description,
          cachedAt: entry.cachedAt
        }));
      await api.storage.local.set({ [PLUGIN_VAULT_KEY]: rows });
    } catch (error) {
      console.warn('[BraveFox Enhancer] Failed to save ChatGPT plugin vault:', error);
    }
  }

  async function finalizePluginVaultSeedIfReady() {
    await ensurePluginVaultLoaded();
    if (pluginVaultSeeded || pluginVault.size === 0) return false;

    try {
      pluginVaultSeeded = true;
      await api?.storage?.local?.set?.({ [PLUGIN_VAULT_SEEDED_KEY]: true });
      console.log(
        `[BraveFox Enhancer] Plugin vault baseline frozen with ${pluginVault.size} installed/active plugin(s).`
      );
      return true;
    } catch (error) {
      pluginVaultSeeded = false;
      console.warn('[BraveFox Enhancer] Failed to freeze ChatGPT plugin vault baseline:', error);
      return false;
    }
  }

  function normalizePluginHref(value) {
    try {
      const parsed = new URL(String(value || ''), location.origin);
      if (parsed.origin !== location.origin) return '';
      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (!/^\/plugins\/[^/]+/i.test(pathname)) return '';
      return `${pathname}${parsed.search || ''}`;
    } catch {
      return '';
    }
  }

  function getPluginKey(value) {
    const href = normalizePluginHref(value);
    if (!href) return '';
    return href.split('?')[0].toLowerCase();
  }

  function getPluginArticles(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    const articles = root.querySelectorAll('article');
    return Array.from(articles).filter(article => article.querySelector(PLUGIN_CARD_LINK_SELECTOR));
  }

  function getPluginLink(article) {
    return article?.querySelector?.(PLUGIN_CARD_LINK_SELECTOR) || null;
  }

  function getPluginActionButton(article) {
    if (!article?.querySelector) return null;
    return article.querySelector('button[type="button"], button');
  }

  function isPluginPlusButton(button) {
    if (!(button instanceof Element)) return false;
    if (button.hasAttribute('data-bravefox-plugin-reinstall')) return true;
    return Boolean(button.querySelector(`use[href$="${PLUGIN_PLUS_ICON_FRAGMENT}"]`));
  }

  function isPluginInstallButton(button) {
    if (!(button instanceof Element)) return false;
    if (button.hasAttribute('data-bravefox-plugin-reinstall')) return true;
    if (isPluginPlusButton(button)) return true;

    const aria = normalizeText(button.getAttribute('aria-label'));
    return PLUGIN_INSTALL_ARIA_TERMS.some(term => aria.includes(term));
  }

  function isInstalledPluginActionButton(button) {
    if (!(button instanceof Element)) return false;
    if (isPluginInstallButton(button)) return false;

    // Confirmed installed-card structure from ChatGPT:
    //   <button aria-haspopup="menu" aria-label="GitHub: toiminnot">
    //     ... <use href="...#623957">
    //   </button>
    // Prefer structural attributes over generated Radix IDs/classes.
    const hasActionsMenu = button.getAttribute('aria-haspopup') === 'menu';
    const hasInstalledActionSprite = Boolean(
      button.querySelector(`use[href$="${PLUGIN_INSTALLED_ACTION_ICON_FRAGMENT}"]`)
    );
    const aria = normalizeText(button.getAttribute('aria-label'));
    const hasActionsLabel =
      aria.includes(': toiminnot') ||
      aria.endsWith('toiminnot') ||
      aria.includes(': actions') ||
      aria.endsWith('actions');

    if (hasActionsMenu && (hasInstalledActionSprite || hasActionsLabel)) return true;

    // Language-independent fallback: an actions-menu button with the confirmed installed
    // sprite is sufficient even if ChatGPT changes the visible aria-label wording.
    if (hasActionsMenu && hasInstalledActionSprite) return true;

    // Keep explicit installed/management wording as a secondary compatibility fallback.
    return (
      aria.includes('uninstall') ||
      aria.includes('remove') ||
      aria.includes('disconnect') ||
      aria.includes('poista') ||
      aria.includes('katkaise') ||
      aria.includes('manage') ||
      aria.includes('hallinnoi')
    );
  }

  function isInstalledPluginCard(article) {
    if (!(article instanceof Element) || article.hasAttribute('data-bravefox-saved-plugin')) return false;

    // Do not infer installed state merely because a card has some non-plus button.
    // The installed baseline is intentionally strict so the permanent vault cannot
    // accidentally learn random catalog cards.
    const buttons = article.querySelectorAll('button[type="button"], button');
    for (const button of buttons) {
      if (isInstalledPluginActionButton(button)) return true;
    }

    // Buttonless status rows are a weaker fallback used only when ChatGPT exposes an
    // explicit installed/connected label.
    const context = normalizeText(article.textContent);
    return PLUGIN_INSTALLED_STATUS_TERMS.some(term => context.includes(term));
  }

  function extractPluginCardInfo(article) {
    const link = getPluginLink(article);
    if (!link) return null;

    const href = normalizePluginHref(link.getAttribute('href'));
    const key = getPluginKey(href);
    if (!key) return null;

    const icon = article.querySelector('[data-testid="plugin-icon-wrapper"] img, img');
    const ariaName = String(link.getAttribute('aria-label') || '')
      .replace(/^(avaa|open)\s+/i, '')
      .trim();
    const name = String(icon?.getAttribute('alt') || ariaName || key.split('/').pop() || 'Saved plugin').trim();

    const descriptionNode = article.querySelector(
      'div[class*="text-token-text-tertiary"][class*="line-clamp-1"], div[class*="line-clamp-1"][class*="text-[13px]"]'
    );

    return {
      key,
      href,
      name,
      iconSrc: String(icon?.getAttribute('src') || ''),
      description: String(descriptionNode?.textContent || '').trim(),
      cachedAt: Date.now()
    };
  }

  function samePluginMetadata(a, b) {
    return Boolean(
      a && b &&
      a.key === b.key &&
      a.href === b.href &&
      a.name === b.name &&
      a.iconSrc === b.iconSrc &&
      a.description === b.description
    );
  }

  async function rememberInstalledPluginCards(scope = document) {
    await ensurePluginVaultLoaded();

    // The original baseline remains a reinstall allowlist, but always refresh cards that
    // ChatGPT itself currently exposes as installed/connected. This repairs incomplete
    // snapshots from slow/lazy first loads without ever learning ordinary + catalog cards.
    let changed = false;

    for (const article of getPluginArticles(scope)) {
      if (!isInstalledPluginCard(article)) continue;
      const info = extractPluginCardInfo(article);
      if (!info) continue;

      const previous = pluginVault.get(info.key);
      if (!samePluginMetadata(previous, info)) {
        pluginVault.set(info.key, info);
        changed = true;
      }
    }

    if (changed) {
      await savePluginVault();
      console.log(`[BraveFox Enhancer] Plugin vault now remembers ${pluginVault.size} plugin(s).`);
    }

    return changed;
  }

  function updateCachedPluginMetadataFromAllowedCards(cards) {
    let changed = false;

    for (const article of cards) {
      const info = extractPluginCardInfo(article);
      if (!info || !pluginVault.has(info.key)) continue;

      const previous = pluginVault.get(info.key);
      const merged = {
        ...previous,
        href: info.href || previous.href,
        name: info.name || previous.name,
        iconSrc: info.iconSrc || previous.iconSrc,
        description: info.description || previous.description,
        cachedAt: previous.cachedAt || Date.now()
      };
      if (!samePluginMetadata(previous, merged)) {
        pluginVault.set(info.key, merged);
        changed = true;
      }
    }

    return changed;
  }

  function getPluginNativeSignature(cards) {
    return cards.map(article => {
      const info = extractPluginCardInfo(article);
      const key = info?.key || '';
      const installed = isInstalledPluginCard(article) ? 'i' : 'c';
      const approved = key && pluginVault.has(key) ? 'a' : 'x';
      return `${key}:${installed}:${approved}`;
    }).join('|');
  }

  function hasRenderableApprovedPlugins() {
    return Boolean(
      document.querySelector('article[data-bravefox-plugin-allowed]') ||
      document.querySelector(`#${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card`)
    );
  }

  function schedulePluginStableReveal() {
    if (!isPluginsRoute()) return;
    if (document.documentElement.classList.contains(PLUGINS_READY_CLASS)) return;

    if (pluginReadyTimer) {
      clearTimeout(pluginReadyTimer);
      pluginReadyTimer = 0;
    }

    const now = Date.now();
    if (!pluginCurationStartedAt) {
      pluginCurationStartedAt = now;
      pluginCurationLastActivityAt = now;
    }

    const elapsed = now - pluginCurationStartedAt;
    const quietFor = now - pluginCurationLastActivityAt;
    const stable =
      elapsed >= PLUGIN_READY_MIN_MS &&
      quietFor >= PLUGIN_READY_QUIET_MS &&
      hasRenderableApprovedPlugins();
    const hardStop = elapsed >= PLUGIN_READY_HARD_MS;

    if (stable || hardStop) {
      document.documentElement.classList.add(PLUGINS_READY_CLASS);
      return;
    }

    const minWait = Math.max(0, PLUGIN_READY_MIN_MS - elapsed);
    const quietWait = Math.max(0, PLUGIN_READY_QUIET_MS - quietFor);
    const wait = Math.max(80, Math.min(240, Math.max(minWait, quietWait)));
    pluginReadyTimer = window.setTimeout(() => {
      pluginReadyTimer = 0;
      schedulePluginStableReveal();
    }, wait);
  }

  async function applyPluginPagePolicy(scope = document) {
    if (!isPluginsRoute()) return;

    document.documentElement.classList.add(PLUGINS_CURATING_CLASS);
    await ensurePluginVaultLoaded();

    const now = Date.now();
    if (!pluginCurationStartedAt) {
      pluginCurationStartedAt = now;
      pluginCurationLastActivityAt = now;
    }

    for (const article of document.querySelectorAll('article[data-bravefox-plugin-allowed]')) {
      article.removeAttribute('data-bravefox-plugin-allowed');
    }
    for (const section of document.querySelectorAll('section[data-bravefox-plugin-section-allowed="true"]')) {
      section.removeAttribute('data-bravefox-plugin-section-allowed');
    }

    // Capture installed/connected cards before classification. Native catalog DOM is never
    // removed anymore; rejected cards simply stay paint-hidden so React can reconcile safely.
    await rememberInstalledPluginCards(scope);

    const cards = getPluginArticles(document);
    const nativeSignature = getPluginNativeSignature(cards);
    if (nativeSignature !== pluginLastNativeSignature) {
      pluginLastNativeSignature = nativeSignature;
      pluginCurationLastActivityAt = Date.now();
    }

    const firstCatalogSection = cards[0]?.closest?.('section') || null;
    const preferredMount = firstCatalogSection?.parentElement || null;
    const seenAllowed = new Set();
    const allowedNativeCards = [];

    for (const article of cards) {
      if (article.hasAttribute('data-bravefox-saved-plugin')) continue;

      const info = extractPluginCardInfo(article);
      if (!info || !pluginVault.has(info.key) || seenAllowed.has(info.key)) {
        continue;
      }

      seenAllowed.add(info.key);
      allowedNativeCards.push(article);
      article.setAttribute('data-bravefox-plugin-allowed', info.key);
      const allowedSection = article.closest('section');
      if (allowedSection) allowedSection.setAttribute('data-bravefox-plugin-section-allowed', 'true');
    }

    if (updateCachedPluginMetadataFromAllowedCards(allowedNativeCards)) {
      void savePluginVault();
    }

    renderMissingSavedPluginCards(seenAllowed, preferredMount, firstCatalogSection);

    // Do not reveal the directory on the first classification pass. React tends to mount
    // the catalog in several bursts, which previously produced the visible card cascade
    // and layout jumps. Reveal once the native card signature has stayed quiet briefly.
    schedulePluginStableReveal();
  }


  function renderMissingSavedPluginCards(nativeKeys, preferredMount = null, catalogAnchor = null) {
    const previousSection = document.getElementById(PLUGIN_SAVED_SECTION_ID);

    // Custom fallback cards are only needed on the main plugin directory, not on a
    // plugin's individual detail page.
    const pathname = String(location.pathname || '').replace(/\/+$/, '') || '/';
    if (pathname.toLowerCase() !== '/plugins') {
      previousSection?.remove();
      return;
    }

    const missing = Array.from(pluginVault.values())
      .filter(entry => !nativeKeys.has(entry.key))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    if (!missing.length) {
      previousSection?.remove();
      return;
    }

    const signature = missing
      .map(entry => `${entry.key}|${entry.name}|${entry.iconSrc}`)
      .join('||');

    // Avoid an observer feedback loop: our own cached section triggers one mutation when
    // first inserted, but an unchanged signature must not be torn down and rebuilt again.
    if (previousSection?.dataset?.bravefoxVaultSignature === signature) return;
    previousSection?.remove();

    const section = document.createElement('section');
    section.dataset.bravefoxVaultSignature = signature;
    section.id = PLUGIN_SAVED_SECTION_ID;

    const heading = document.createElement('div');
    heading.textContent = 'BraveFox saved plugins';
    heading.style.cssText = 'font-weight:600;margin:0 0 10px 2px;';

    const grid = document.createElement('div');
    grid.className = 'bravefox-saved-plugin-grid';

    for (const entry of missing) {
      const article = document.createElement('article');
      article.className = 'bravefox-saved-plugin-card';
      article.setAttribute('data-bravefox-saved-plugin', entry.key);

      if (entry.iconSrc) {
        const img = document.createElement('img');
        img.src = entry.iconSrc;
        img.alt = entry.name;
        article.appendChild(img);
      }

      const link = document.createElement('a');
      link.className = 'bravefox-saved-plugin-link';
      link.href = entry.href;

      const name = document.createElement('div');
      name.className = 'bravefox-saved-plugin-name';
      name.textContent = entry.name;

      const note = document.createElement('div');
      note.className = 'bravefox-saved-plugin-note';
      note.textContent = entry.description || 'Saved for reinstall';

      link.append(name, note);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bravefox-saved-plugin-reinstall';
      button.textContent = '+';
      button.title = `Open ${entry.name} to reinstall`;
      button.setAttribute('aria-label', `Open ${entry.name} to reinstall`);
      button.setAttribute('data-bravefox-plugin-reinstall', entry.key);

      article.append(link, button);
      grid.appendChild(article);
    }

    section.append(heading, grid);

    const firstNativeArticle = document.querySelector(`article ${PLUGIN_CARD_LINK_SELECTOR}`)?.closest('article');
    const firstNativeSection = firstNativeArticle?.closest('section');
    const host =
      preferredMount ||
      firstNativeSection?.parentElement ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body;
    const anchor =
      (catalogAnchor?.parentElement === host && catalogAnchor) ||
      (firstNativeSection?.parentElement === host && firstNativeSection) ||
      null;

    if (anchor) {
      host.insertBefore(section, anchor);
    } else {
      host.insertBefore(section, host.firstChild);
    }
  }

  function getPluginKeyForButton(button) {
    const savedKey = button?.getAttribute?.('data-bravefox-plugin-reinstall');
    if (savedKey) return getPluginKey(savedKey);

    const article = button?.closest?.('article');
    const articleLink = article ? getPluginLink(article) : null;
    const fromArticle = getPluginKey(articleLink?.getAttribute('href'));
    if (fromArticle) return fromArticle;

    return getPluginKey(location.pathname);
  }

  async function protectPluginInstallAction(button) {
    await ensurePluginVaultLoaded();

    const pluginKey = getPluginKeyForButton(button);
    if (!pluginKey || !pluginVault.has(pluginKey)) {
      // An install/+ control for a plugin that was never in the installed vault is not
      // permitted to survive the filtered page.
      button.remove();
      return;
    }

    void beginNativePasswordFlow({
      kind: 'plugin-install',
      routeKey: 'plugins',
      title: PLUGIN_INSTALL_PROMPT,
      returnUrl: location.href,
      payload: { pluginKey }
    });
  }

  function replayPluginInstall(button, pluginKey) {
    const savedEntry = pluginVault.get(pluginKey);

    if (button?.hasAttribute?.('data-bravefox-plugin-reinstall')) {
      if (savedEntry?.href) location.assign(savedEntry.href);
      return;
    }

    if (!(button instanceof HTMLButtonElement) || !button.isConnected) {
      if (savedEntry?.href) location.assign(savedEntry.href);
      return;
    }

    replayAllowedPluginButtons.add(button);
    try {
      button.click();
    } finally {
      queueMicrotask(() => replayAllowedPluginButtons.delete(button));
    }
  }

  // === GPT directory curation ===================================================

  function getGptCards(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    return Array.from(root.querySelectorAll(GPT_CARD_SELECTOR))
      .filter(card => card.querySelector('img[alt="GPT Icon"], img[alt*="GPT"]'));
  }

  function getGptSections() {
    return Array.from(document.querySelectorAll(GPT_SOURCE_SECTION_SELECTOR));
  }

  function extractGptCardInfo(card) {
    const titleElement =
      card.querySelector('div[class*="font-semibold"][class*="line-clamp"]') ||
      card.querySelector('span[class*="font-semibold"][class*="line-clamp"]') ||
      Array.from(card.querySelectorAll('div, span')).find(node =>
        node.classList?.contains('font-semibold') && normalizeText(node.textContent)
      );

    const descriptionElement =
      card.querySelector('span[class*="line-clamp-3"][class*="text-xs"]') ||
      card.querySelector('span[class*="line-clamp-2"][class*="text-xs"]') ||
      card.querySelector('span[class*="line-clamp"]');

    let author = '';
    for (const node of card.querySelectorAll('div, span')) {
      const text = String(node.textContent || '').trim();
      const normalized = normalizeText(text);
      if (
        normalized.startsWith('tekijä:') ||
        normalized.startsWith('by ') ||
        normalized.startsWith('by:') ||
        normalized.startsWith('creator:') ||
        normalized.startsWith('author:')
      ) {
        author = text;
        break;
      }
    }

    return {
      title: String(titleElement?.textContent || '').trim(),
      description: String(descriptionElement?.textContent || '').trim(),
      author
    };
  }

  function isAllowedGptCard(card) {
    const info = extractGptCardInfo(card);
    const looseTitle = normalizeLooseTitle(info.title);
    const author = normalizeLooseTitle(info.author);

    if (!looseTitle) return false;

    // OpenAI/ChatGPT is the only publisher wildcard. Native GPTs stay visible even
    // when their individual titles are not listed in GPT_ALLOWLIST.
    if (GPT_NATIVE_PUBLISHERS.some(publisher => author.includes(publisher))) return true;

    // Every third-party GPT must be explicitly present in the single editable array.
    return GPT_ALLOWLIST.some(title => normalizeLooseTitle(title) === looseTitle);
  }

  function getGptSectionHeading(section) {
    if (!(section instanceof Element)) return '';
    const heading =
      section.querySelector(':scope > div[tabindex="0"] div.text-xl.font-semibold') ||
      section.querySelector(':scope > div[tabindex="0"] [class*="font-semibold"]') ||
      section.querySelector('div.text-xl.font-semibold');
    return String(heading?.textContent || '').trim();
  }

  function isChatGptDonorSection(section) {
    const heading = normalizeLooseTitle(getGptSectionHeading(section));
    if (
      heading.includes('chatgpt n tekemät') ||
      heading.includes('chatgpt n tekemat') ||
      heading.includes('made by chatgpt') ||
      heading.includes('created by chatgpt') ||
      heading.includes('from chatgpt')
    ) {
      return true;
    }

    // Heading labels can change. A shelf whose rendered cards are all authored by
    // ChatGPT/OpenAI is a safe fallback donor for the curated container.
    const cards = getGptCards(section);
    return cards.length > 0 && cards.every(card => {
      const author = normalizeLooseTitle(extractGptCardInfo(card).author);
      return GPT_NATIVE_PUBLISHERS.some(publisher => author.includes(publisher));
    });
  }

  function findGptGrid(section) {
    if (!(section instanceof Element)) return null;
    return (
      section.querySelector(':scope > .mt-4.mb-10 > .grid') ||
      section.querySelector(':scope > div[class*="mt-4"][class*="mb-10"] > div.grid') ||
      section.querySelector('div.grid.grid-cols-1') ||
      section.querySelector('div.grid')
    );
  }

  function removeLegacyApprovedGptHeadings(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    const legacyTitle = normalizeText(LEGACY_GPT_APPROVED_TITLE);
    const legacySubtitle = normalizeText(LEGACY_GPT_APPROVED_SUBTITLE);

    for (const node of root.querySelectorAll('div, span, h1, h2, h3')) {
      const text = normalizeText(node.textContent);
      if (text !== legacyTitle && text !== legacySubtitle) continue;
      const wrapper = node.closest('[data-bravefox-gpt-heading="true"]');
      if (wrapper) wrapper.remove();
      else node.remove();
    }
  }

  function normalizeApprovedGptSection(section) {
    if (!(section instanceof Element)) return null;

    section.id = GPT_APPROVED_SECTION_ID;
    section.setAttribute(GPT_APPROVED_SECTION_ATTR, 'true');

    // The approved shelf no longer owns a heading. The stock ChatGPT GPT directory
    // header/search/actions are moved above this grid instead.
    for (const heading of section.querySelectorAll(':scope > [data-bravefox-gpt-heading="true"]')) {
      heading.remove();
    }
    removeLegacyApprovedGptHeadings(section);

    let content = section.querySelector(':scope > div[data-bravefox-gpt-content="true"]');
    if (!content) {
      content = Array.from(section.children).find(child =>
        child instanceof Element && child.classList.contains('mt-4') && child.classList.contains('mb-10')
      ) || null;
    }
    if (!content) {
      content = document.createElement('div');
      content.className = 'mt-4 mb-10';
      section.appendChild(content);
    }
    content.setAttribute('data-bravefox-gpt-content', 'true');

    let grid = findGptGrid(section);
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 gap-x-1.5 gap-y-1 md:gap-x-2 md:gap-y-1.5 lg:grid-cols-2 lg:gap-x-3 lg:gap-y-2.5';
      content.prepend(grid);
    }

    for (const button of content.querySelectorAll('button')) {
      if (isGptShowMoreButton(button)) button.remove();
    }

    return grid;
  }

  function createApprovedGptSectionShell() {
    const section = document.createElement('div');
    section.className = 'h-fit scroll-mt-28';
    section.id = GPT_APPROVED_SECTION_ID;
    section.setAttribute(GPT_APPROVED_SECTION_ATTR, 'true');

    const content = document.createElement('div');
    content.className = 'mt-4 mb-10';
    content.setAttribute('data-bravefox-gpt-content', 'true');

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-x-1.5 gap-y-1 md:gap-x-2 md:gap-y-1.5 lg:grid-cols-2 lg:gap-x-3 lg:gap-y-2.5';
    content.appendChild(grid);
    section.appendChild(content);
    return { section, grid };
  }

  function findExactTextElement(root, expectedValues, selector = 'div, span, h1, h2, h3, p') {
    const expected = new Set(expectedValues.map(value => normalizeText(value)));
    for (const node of root.querySelectorAll(selector)) {
      if (expected.has(normalizeText(node.textContent))) return node;
    }
    return null;
  }

  function findNativeGptSearchInput(root = document) {
    for (const input of root.querySelectorAll('input')) {
      const placeholder = normalizeText(input.getAttribute('placeholder'));
      const aria = normalizeText(input.getAttribute('aria-label'));
      if (
        placeholder.includes('hae gpt') ||
        placeholder.includes('search gpt') ||
        aria.includes('hae gpt') ||
        aria.includes('search gpt')
      ) return input;
    }
    return null;
  }

  function findCommonAncestor(elements, maxDepth = 10) {
    const nodes = elements.filter(node => node instanceof Element);
    if (!nodes.length) return null;
    let candidate = nodes[0];
    let depth = 0;
    while (candidate && depth <= maxDepth) {
      if (nodes.every(node => candidate.contains(node))) return candidate;
      candidate = candidate.parentElement;
      depth += 1;
    }
    return null;
  }

  function findNativeGptHero() {
    const root = document.querySelector('main') || document.querySelector('[role="main"]') || document;
    const search = findNativeGptSearchInput(root);
    if (!search) return null;

    const title = findExactTextElement(root, ['GPT:t', 'GPTs'], 'h1, h2, div, span');
    let description = null;
    for (const node of root.querySelectorAll('div, p, span')) {
      const text = normalizeText(node.textContent);
      if (GPT_NATIVE_DESCRIPTION_TERMS.some(term => text.includes(term))) {
        description = node;
        break;
      }
    }

    const required = [search];
    if (title) required.push(title);
    if (description) required.push(description);

    // Walk upward from the search control until its native container also contains the
    // stock GPT title/description. Stop before swallowing any of the directory shelves.
    let candidate = search;
    for (let depth = 0; candidate && depth < 10; depth += 1, candidate = candidate.parentElement) {
      if (!required.every(node => candidate.contains(node))) continue;
      if (candidate.querySelector?.(GPT_SOURCE_SECTION_SELECTOR)) continue;
      return candidate;
    }

    return findCommonAncestor(required, 10);
  }

  function findNativeGptActions() {
    const root = document.querySelector('main') || document.querySelector('[role="main"]') || document;
    const myLabel = findExactTextElement(root, ['Omat GPT:t', 'My GPTs', 'My GPTs:'], 'div, span, a, button');
    let createControl = null;

    for (const control of root.querySelectorAll('button, a')) {
      const text = normalizeText(control.textContent);
      if (text === 'luo' || text === 'create' || text === '+ luo' || text === '+ create') {
        createControl = control;
        break;
      }
    }

    const myControl =
      myLabel?.closest?.('a, button') ||
      (myLabel?.matches?.('a, button') ? myLabel : null);

    if (!myControl && !createControl) return null;

    const container = findCommonAncestor([myControl || myLabel, createControl].filter(Boolean), 6);
    return { myLabel, myControl, createControl, container };
  }


  function removeNativeGptExploreLabel(root = document) {
    const labels = ['Tutustu GPT:ihin', 'Explore GPTs', 'Explore GPTs:'];
    const node = findExactTextElement(root, labels, 'div, span, p');
    if (!node) return;
    node.setAttribute('data-bravefox-gpt-explore-hidden', 'true');
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
  }

  function stripClonedDomIds(root) {
    if (!(root instanceof Element)) return;
    if (root.hasAttribute('id')) root.removeAttribute('id');
    for (const node of root.querySelectorAll('[id]')) node.removeAttribute('id');
  }

  function makeGptActionProxy(kind, label, target) {
    const control = document.createElement('button');
    control.type = 'button';
    control.setAttribute('data-bravefox-gpt-action-proxy', kind);
    control.textContent = label;

    control.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      try {
        if (target?.isConnected && typeof target.click === 'function') {
          target.click();
          return;
        }

        const href = target?.getAttribute?.('href');
        if (href) location.assign(href);
      } catch (error) {
        console.warn('[BraveFox Enhancer] GPT action proxy failed:', error);
      }
    }, true);

    return control;
  }

  function prepareNativeGptHeader() {
    if (!gptApprovedSection?.isConnected) return false;

    removeLegacyApprovedGptHeadings(document);

    const hero = findNativeGptHero();
    if (hero) {
      hero.setAttribute(GPT_NATIVE_HERO_ATTR, 'true');
      hero.style.opacity = '1';
      hero.style.transform = 'none';
    }

    const actions = findNativeGptActions();
    for (const nativeControl of [actions?.myControl || actions?.myLabel, actions?.createControl]) {
      if (!(nativeControl instanceof Element)) continue;
      nativeControl.setAttribute(GPT_NATIVE_ACTIONS_ATTR, 'true');
      nativeControl.style.setProperty('display', 'none', 'important');
      nativeControl.style.setProperty('visibility', 'hidden', 'important');
    }

    let host = document.getElementById(GPT_NATIVE_HEADER_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = GPT_NATIVE_HEADER_ID;
      host.setAttribute(GPT_NATIVE_HEADER_ATTR, 'true');
    }

    // Never move ChatGPT's React-owned hero. Move only BraveFox-owned nodes so the final
    // order is always: native GPT title/description/search -> curated grid. The BraveFox
    // action proxies are fixed in the page's top-right utility area and do not consume flow.
    // The previous build inserted the shelf before the first source section, which on the
    // live page could place the whole curated grid above the native hero.
    const parent = hero?.parentElement || gptApprovedSection.parentElement;
    if (!parent) return false;

    if (hero?.parentElement === parent) {
      parent.insertBefore(host, hero.nextSibling);
      parent.insertBefore(gptApprovedSection, host.nextSibling);
    } else {
      if (gptApprovedSection.parentElement !== parent) parent.appendChild(gptApprovedSection);
      parent.insertBefore(host, gptApprovedSection);
    }
    gptNativeHeaderHost = host;

    host.replaceChildren();

    const myLabel = String(actions?.myLabel?.textContent || 'Omat GPT:t').trim() || 'Omat GPT:t';
    const createText = String(actions?.createControl?.textContent || 'Luo').trim() || 'Luo';

    const myProxy = makeGptActionProxy('my-gpts', myLabel, actions?.myControl || null);
    host.appendChild(myProxy);

    if (actions?.createControl) {
      const createLabel = /^\s*\+/.test(createText) ? createText : `+ ${createText}`;
      host.appendChild(makeGptActionProxy('create', createLabel, actions.createControl));
    }

    removeNativeGptExploreLabel(document);
    return Boolean(hero && findNativeGptSearchInput(hero));
  }


  function prepareApprovedGptSection() {
    if (gptApprovedSection?.isConnected && gptApprovedGrid?.isConnected) {
      normalizeApprovedGptSection(gptApprovedSection);
      return gptApprovedSection;
    }

    const existingSections = Array.from(document.querySelectorAll(`[${GPT_APPROVED_SECTION_ATTR}="true"], #${GPT_APPROVED_SECTION_ID}`));
    const existing = existingSections.shift() || null;
    for (const duplicate of existingSections) duplicate.remove();

    if (existing) {
      const grid = normalizeApprovedGptSection(existing);
      if (grid) {
        gptApprovedSection = existing;
        gptApprovedGrid = grid;
        return existing;
      }
      existing.remove();
    }

    // Do not wait for the far-down "Made by ChatGPT" shelf. That donor was the main
    // reason /gpts could sit blank for tens of seconds on a cold/lazy load. BraveFox
    // builds the same native-shaped shell immediately and harvests approved cards into it.
    const sourceSections = getGptSections().filter(section =>
      section.getAttribute(GPT_APPROVED_SECTION_ATTR) !== 'true'
    );
    const firstSource = sourceSections[0] || null;
    const nativeHero = findNativeGptHero();
    const host =
      nativeHero?.parentElement ||
      firstSource?.parentElement ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]');
    if (!host) return null;

    const created = createApprovedGptSectionShell();
    if (nativeHero?.parentElement === host) {
      host.insertBefore(created.section, nativeHero.nextSibling);
    } else if (firstSource?.parentElement === host) {
      host.insertBefore(created.section, firstSource);
    } else {
      host.appendChild(created.section);
    }

    gptApprovedSection = created.section;
    gptApprovedGrid = created.grid;
    gptCurationLastActivityAt = Date.now();
    return created.section;
  }

  function makeGptCardKey(card) {
    const info = extractGptCardInfo(card);
    const href = String(card.getAttribute('href') || '').trim();
    if (href && href !== '#') return `href:${href}`;
    return `text:${normalizeLooseTitle(info.title)}|${normalizeLooseTitle(info.author)}`;
  }

  function stripGptRankNumber(card) {
    if (!(card instanceof Element)) return;
    const first = card.firstElementChild;
    if (!first) return;
    const text = String(first.textContent || '').trim();
    if (/^\d+$/.test(text) && !first.querySelector('img, svg')) {
      first.remove();
    }
  }

  function getGptCardWrapper(card) {
    if (!(card instanceof Element)) return null;
    const wrapper = card.closest('div[tabindex="0"]');
    return wrapper && wrapper !== document.documentElement && wrapper !== document.body
      ? wrapper
      : card;
  }

  function normalizeApprovedGptCard(card, wrapper) {
    if (!(card instanceof Element)) return;
    stripGptRankNumber(card);

    if (wrapper instanceof Element) {
      wrapper.setAttribute('tabindex', '0');
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'none';
    }

    // Use the compact two-column card geometry from ChatGPT's own GPT shelf even when
    // the source card came from Featured or another category with a larger presentation.
    card.className = 'gizmo-link cursor-pointer group hover:bg-token-main-surface-secondary flex h-[104px] items-center gap-2.5 overflow-hidden rounded-xl px-1 py-4 md:px-3 md:py-4 lg:px-3';
  }

  function harvestApprovedGpts() {
    if (!gptApprovedGrid?.isConnected) return 0;

    let changed = 0;

    // Re-index the BraveFox-owned clone grid first. If an older route pass left a card
    // that no longer satisfies the allowlist, remove only that clone — never React's source.
    for (const existingCard of getGptCards(gptApprovedGrid)) {
      const existingWrapper = getGptCardWrapper(existingCard);
      const key = makeGptCardKey(existingCard);
      if (!isAllowedGptCard(existingCard)) {
        existingWrapper?.remove();
        gptApprovedKeys.delete(key);
        changed += 1;
        continue;
      }
      gptApprovedKeys.add(key);
      normalizeApprovedGptCard(existingCard, existingWrapper);
    }

    for (const card of getGptCards(document)) {
      if (gptApprovedGrid.contains(card)) continue;
      if (!isAllowedGptCard(card)) continue;

      const key = makeGptCardKey(card);
      if (!key || gptApprovedKeys.has(key)) continue;

      const sourceWrapper = getGptCardWrapper(card);
      if (!(sourceWrapper instanceof Element) || !sourceWrapper.isConnected) continue;

      const cloneWrapper = sourceWrapper.cloneNode(true);
      stripClonedDomIds(cloneWrapper);

      const cloneCard =
        cloneWrapper.matches?.(GPT_CARD_SELECTOR)
          ? cloneWrapper
          : cloneWrapper.querySelector?.(GPT_CARD_SELECTOR);
      if (!(cloneCard instanceof Element)) continue;

      cloneCard.setAttribute('data-bravefox-gpt-allowed', 'true');
      normalizeApprovedGptCard(cloneCard, cloneWrapper);
      gptApprovedGrid.appendChild(cloneWrapper);
      gptApprovedKeys.add(key);
      changed += 1;
    }

    if (changed) gptCurationLastActivityAt = Date.now();
    return changed;
  }


  function isGptShowMoreButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    return GPT_SHOW_MORE_LABELS.has(normalizeText(button.textContent));
  }

  function expandGptSourceShelves() {
    const now = Date.now();
    let pending = false;
    let clicked = false;

    for (const section of getGptSections()) {
      if (section === gptApprovedSection || section.getAttribute(GPT_APPROVED_SECTION_ATTR) === 'true') continue;

      for (const button of section.querySelectorAll('button')) {
        if (!isGptShowMoreButton(button) || button.disabled) continue;

        const currentCardCount = getGptCards(section).length;
        let state = gptShowMoreState.get(button);
        if (!state) state = { count: 0, lastClickAt: 0, lastCardCount: -1 };

        if (state.count >= GPT_MAX_SHOW_MORE_CLICKS) continue;
        pending = true;

        // Do not hammer the same React control four times while one network request is
        // still in flight. Re-click only after cards actually grew, or after a 2.5s
        // timeout indicates the previous click was swallowed.
        const waitingForGrowth = state.lastClickAt > 0 && currentCardCount <= state.lastCardCount;
        if (waitingForGrowth && now - state.lastClickAt < 2500) continue;
        if (!waitingForGrowth && now - state.lastClickAt < 700) continue;

        state.count += 1;
        state.lastClickAt = now;
        state.lastCardCount = currentCardCount;
        gptShowMoreState.set(button, state);
        try {
          button.click();
          clicked = true;
        } catch {
          // The maintenance pass will retry if React replaces the button.
        }
      }
    }

    if (clicked) gptCurationLastActivityAt = now;
    return { pending, clicked };
  }

  function removeGptCategoryNavigation() {
    for (const nav of document.querySelectorAll('div.sticky.top-14.z-10')) {
      const scroller = nav.querySelector(':scope > div.no-scrollbar');
      if (!scroller) continue;
      const text = normalizeText(scroller.textContent);
      const categoryHits = [
        'huippuvalinnat', 'ohjelmointi', 'tutkimus ja analyysi', 'tuottavuus',
        'programming', 'research & analysis', 'productivity', 'dall·e', 'writing', 'lifestyle'
      ].filter(term => text.includes(term)).length;
      if (categoryHits < 2) continue;

      // Leave React's navigation node in place; CSS already keeps it paint-hidden.
      nav.setAttribute('data-bravefox-gpt-category-nav-hidden', 'true');
    }
  }

  function removeOtherGptShelvesIfSettled(pendingShowMore) {
    if (!gptApprovedSection?.isConnected) return false;

    const now = Date.now();
    const elapsed = now - gptCurationStartedAt;
    const quietFor = now - gptCurationLastActivityAt;
    const settled = elapsed >= GPT_MIN_CURATION_MS && !pendingShowMore && quietFor >= 650;
    const hardStop = elapsed >= GPT_HARD_CURATION_MS;
    if (!settled && !hardStop) return false;

    // Native source shelves deliberately remain mounted but hidden. Removing them was
    // capable of making ChatGPT's React tree throw "Content failed to load" on rerenders.
    removeGptCategoryNavigation();
    return true;
  }


  function scheduleGptCurationRetry(delay = 260) {
    if (!isGptsRoute()) return;
    if (gptCurationRetryTimer) clearTimeout(gptCurationRetryTimer);
    gptCurationRetryTimer = window.setTimeout(() => {
      gptCurationRetryTimer = 0;
      applyGptPagePolicy(document);
    }, delay);
  }

  function applyGptPagePolicy(scope = document) {
    if (!isGptsRoute()) return;

    document.documentElement.classList.add(GPTS_CURATING_CLASS);
    if (!gptCurationStartedAt) {
      gptCurationStartedAt = Date.now();
      gptCurationLastActivityAt = gptCurationStartedAt;
    }

    const approvedSection = prepareApprovedGptSection();
    if (!approvedSection) {
      scheduleGptCurationRetry(120);
      return;
    }

    // Keep ChatGPT's stock GPT title/description/search/create controls, but move that
    // native chrome above the BraveFox-filtered grid. No custom BraveFox heading text.
    prepareNativeGptHeader();
    removeGptCategoryNavigation();
    harvestApprovedGpts();
    const expansion = expandGptSourceShelves();

    const finalized = removeOtherGptShelvesIfSettled(expansion.pending);

    // A programmatic Show-more click normally causes a React mutation, but keep a short
    // retry as insurance for slow PWA/network commits, shelves that replace buttons, and
    // the final quiet-period cleanup after the last expansion click.
    if (!finalized) {
      scheduleGptCurationRetry(expansion.clicked ? 260 : 420);
    }
  }

  function removePluginFeaturedPromo(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    for (const link of root.querySelectorAll('a.interactive-button[href^="/plugins?category=featured"]')) {
      link.remove();
    }
  }

  function makeSidebarImagesItem(moreItem = null) {
    const anchor = document.createElement('a');
    anchor.tabIndex = 0;
    anchor.setAttribute('data-fill', '');
    anchor.className = 'group __menu-item hoverable gap-1.5 transition-colors keyboard-focused:focus-ring keyboard-focused:-outline-offset-2';
    anchor.setAttribute('data-testid', 'sidebar-item-images');
    anchor.setAttribute('data-sidebar-item', 'true');
    anchor.setAttribute('data-bravefox-sidebar-images', 'true');
    anchor.href = '/images';
    anchor.setAttribute('data-discover', 'true');

    const bodyText = normalizeText(document.body?.textContent);
    const oldLabel = normalizeText(moreItem?.textContent);
    const finnish =
      oldLabel.includes('lisää') ||
      /^fi(?:-|$)/i.test(String(document.documentElement.lang || '')) ||
      bodyText.includes('uusi keskustelu') ||
      bodyText.includes('kirjasto');
    const label = finnish ? 'Kuvat' : 'Images';

    // Standalone SVG instead of borrowing a generated ChatGPT sprite id. This keeps the
    // sidebar item intact even when ChatGPT rotates sprite bundles between deployments.
    // Build it with DOM APIs rather than innerHTML so AMO's unsafe-assignment scanner stays quiet.
    const iconHost = document.createElement('div');
    iconHost.setAttribute('aria-hidden', 'true');
    iconHost.className = 'relative flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon';

    const iconInner = document.createElement('div');
    iconInner.className = 'absolute inset-0 flex items-center justify-center';

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');

    const rect = document.createElementNS(svgNs, 'rect');
    rect.setAttribute('x', '3.25');
    rect.setAttribute('y', '4');
    rect.setAttribute('width', '13.5');
    rect.setAttribute('height', '12');
    rect.setAttribute('rx', '2.25');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'currentColor');
    rect.setAttribute('stroke-width', '1.5');

    const circle = document.createElementNS(svgNs, 'circle');
    circle.setAttribute('cx', '7.25');
    circle.setAttribute('cy', '8');
    circle.setAttribute('r', '1.35');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '1.35');

    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', 'M4.75 14.15l3.45-3.45 2.45 2.45 1.75-1.75 2.85 2.85');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.45');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    svg.append(rect, circle, path);
    iconInner.append(svg);
    iconHost.append(iconInner);

    const labelHost = document.createElement('div');
    labelHost.className = 'flex min-w-0 grow items-center gap-2.5';

    const labelNode = document.createElement('div');
    labelNode.className = 'truncate [&:has([data-marquee-text])]:min-w-0 [&:has([data-marquee-text])]:flex-1 [&:has([data-marquee-text])]:overflow-visible';
    labelNode.textContent = label;
    labelHost.append(labelNode);

    anchor.append(iconHost, labelHost);
    return anchor;
  }

  function polishSidebarNavigation() {
    // Do not remove React-owned sidebar nodes. CSS hides Plugins and More; leaving them
    // mounted prevents React from reconciling our replacement away on busy directory pages.
    for (const pluginsButton of document.querySelectorAll(
      'a[data-testid="plugins-button"][data-sidebar-item="true"], a[data-sidebar-item="true"][href="/plugins"]'
    )) {
      pluginsButton.setAttribute('aria-hidden', 'true');
      pluginsButton.setAttribute('data-bravefox-sidebar-hidden', 'plugins');
    }

    const existingCustom = document.querySelector('a[data-bravefox-sidebar-images="true"]');
    if (existingCustom?.isConnected) return;

    const nativeImages = Array.from(document.querySelectorAll('a[data-sidebar-item="true"][href="/images"]'))
      .find(item => !item.hasAttribute('data-bravefox-sidebar-images'));
    if (nativeImages) {
      nativeImages.setAttribute('data-bravefox-sidebar-images', 'true');
      nativeImages.removeAttribute('aria-hidden');
      return;
    }

    const moreItems = Array.from(document.querySelectorAll('div[data-sidebar-item="true"][aria-haspopup="menu"]'))
      .filter(item => item.querySelector('svg use[href$="#dots-horizontal"]'));

    const moreItem = moreItems[0] || null;
    const custom = makeSidebarImagesItem(moreItem);

    if (moreItem?.parentElement) {
      moreItem.after(custom);
      return;
    }

    // Fallback for routes where ChatGPT has not mounted More yet. Place Kuvat after
    // Tasks/Ajastukset when possible, otherwise after the last normal top-level item.
    const sidebarItems = Array.from(document.querySelectorAll('a[data-sidebar-item="true"]'))
      .filter(item =>
        !item.hasAttribute('data-bravefox-sidebar-images') &&
        !String(item.getAttribute('href') || '').startsWith('/plugins')
      );
    const preferred = sidebarItems.find(item => {
      const label = normalizeText(item.textContent);
      const href = normalizeText(item.getAttribute('href'));
      return label.includes('ajastukset') || label === 'tasks' || href.includes('task');
    }) || sidebarItems[sidebarItems.length - 1] || null;

    if (preferred?.parentElement) {
      preferred.after(custom);
    }
  }


  function hardHideEscapeHatch(element) {
    if (!(element instanceof Element)) return;
    hideElement(element);
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
  }

  function applyAccountAndSettingsCleanup(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    // Account/profile menu: Personalization / Yksilöinti. Radix mounts this menu in a
    // portal, often after the click-time scan has already completed. The targeted portal
    // observer above makes this live policy authoritative; text is the final fallback if
    // ChatGPT rotates the sprite id again.
    forEachMatch(scope, '[role="menuitem"]', item => {
      const text = normalizeText(item.textContent);
      const hasFaceIcon = Boolean(item.querySelector('use[href*="#face"]'));
      if (hasFaceIcon || text === 'yksilöinti' || text === 'personalization') {
        hardHideEscapeHatch(item);
      }
    });

    // Settings > Plugins: exact /plugins navigation links are escape hatches, while
    // plugin cards use /plugins/<id>. Paint-time CSS hides only the exact link. Here we
    // collapse its row *only* when the live DOM exactly matches the small settings-row
    // structure supplied by the user. Never climb generic ancestors: those can be major
    // ChatGPT layout containers and hiding one can blank large parts of the app.
    forEachMatch(scope, 'a[href="/plugins"]', link => {
      const text = normalizeText(link.textContent);
      const hasBrowseAddonsIcon = Boolean(link.querySelector('use[href*="#all-products"]'));
      const isBrowseAddons =
        hasBrowseAddonsIcon ||
        text === 'selaa lisäosia' ||
        text === 'browse addons' ||
        text === 'browse add-ons';
      if (!isBrowseAddons) return;

      hardHideEscapeHatch(link);

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

      if (wrapperIsExact && rowIsExact) hardHideEscapeHatch(row);
    });
  }

  function applyGoogleOnlyLoginPolicy(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    // Signup is never needed for this profile. Keep it gone even on logged-out chrome
    // that has not mounted the email form yet.
    forEachMatch(scope, '[data-testid="signup-button"]', hideElement);

    // Current Apple + phone provider sprites. The broader provider-group rule below
    // additionally keeps only Google if ChatGPT adds/reorders other provider buttons.
    forEachMatch(scope, 'button:has(use[href$="#f5a288"]), button:has(use[href$="#d6f274"])', hideElement);

    const email = document.querySelector('input#email, input[name="email"][type="email"]');
    if (!email) return;

    hideElement(email);

    // Hide only the field-sized wrapper, not the whole auth form (Google may live beside it).
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

    // Remove the OR/TAI separator by both structure and text so harmless grids elsewhere
    // on ChatGPT are not affected.
    for (const divider of document.querySelectorAll('div[class*="grid-cols-[1fr_max-content_1fr]"]')) {
      const text = normalizeText(divider.textContent);
      if ((text === 'tai' || text === 'or') && divider.querySelector('.h-px')) hideElement(divider);
    }

    // In the provider button stack, Google is the only allowed path. The Google sprite
    // from the supplied markup is #8e7aa4; everything else in that same provider group
    // stays hidden even if Apple/phone text is localized differently.
    for (const group of document.querySelectorAll('div.flex.flex-col.gap-3')) {
      if (!group.querySelector('button use[href$="#8e7aa4"]')) continue;
      for (const button of group.querySelectorAll(':scope > button')) {
        if (!button.querySelector('use[href$="#8e7aa4"]')) hideElement(button);
      }
    }
  }

  function scheduleGoogleOnlyLoginCleanupRetries() {
    // CSS does the no-glimpse work. These tiny retries only collapse any React wrappers
    // that remain after mount, without installing another permanent whole-page observer.
    for (const delay of [0, 60, 160, 420, 900, 1800, 3200]) {
      window.setTimeout(() => applyGoogleOnlyLoginPolicy(document), delay);
    }
  }

  function scheduleSidebarPolishRetries() {
    for (const timer of sidebarPolishTimers) clearTimeout(timer);
    sidebarPolishTimers = [];
    for (const delay of [0, 100, 300, 800, 1600, 3200]) {
      sidebarPolishTimers.push(window.setTimeout(() => {
        polishSidebarNavigation();
        removePluginFeaturedPromo(document);
      }, delay));
    }
  }

  function hideElement(element) {
    element.classList.add(HIDDEN_CLASS);
    element.setAttribute('aria-hidden', 'true');
  }

  function cleanChatGptUi(scope = document) {
    applyGoogleOnlyLoginPolicy(scope);
    applyAccountAndSettingsCleanup(scope);
    polishSidebarNavigation();
    removePluginFeaturedPromo(scope);
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
  }

  function hideElementsBySelectorAndText(scope, selector, expectedText, exact = false) {
    forEachMatch(scope, selector, element => {
      const text = normalizeText(element.textContent);
      const matches = exact ? text === expectedText : text.includes(expectedText);
      if (matches) hideElement(element);
    });
  }

  console.log(
    `[BraveFox Enhancer] ChatGPT SPA/UI protection active (${IS_ANDROID ? 'Android-optimized' : 'desktop-optimized'}, low-overhead routing).`
  );
})();
