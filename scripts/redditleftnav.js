// Force Reddit left nav to expanded state reliably (Chrome/Firefox/Firefox Android).
// - No innerHTML.
// - Idempotent and safe to run multiple times.
// - Works across route changes by observing DOM and attribute flips.
// - Firefox-only fix: avoid nested/buggy sticky by using a fixed rail + spacer.
// - Enhanced for Firefox home feed and posts: dynamic header height, robust left anchoring,
//   ResizeObserver-based syncing, and inline !important overrides so JS wins over CSS.

(function () {
  'use strict';

  // Boot guard (safe if injected multiple times by route changes)
  if (window.__RLEFTNAV_BOOTED__) return;
  window.__RLEFTNAV_BOOTED__ = true;

  const LOG_PREFIX = '[leftnav-force-expand]';
  const EXPANDED_ATTR = 'expanded';

  // Stable selectors from your dumps
  const CONTAINER_SELECTOR = 'flex-left-nav-container#left-sidebar-container, #left-sidebar-container';
  const NAV_SELECTOR = '[data-testid="left-sidebar"], #left-sidebar, reddit-sidebar-nav';
  const EXPAND_BTN_SELECTOR = '#flex-nav-expand-button';
  const COLLAPSE_BTN_SELECTOR = '#flex-nav-collapse-button';

  // IDs/dataset keys for elements we create
  const SPACER_ID = 'leftnav-fixed-spacer';
  const DS_APPLIED = 'leftnavApplied';
  const DS_FIXED = 'leftnavFixed';
  const DS_INIT_LEFT = 'leftnavInitialLeft'; // left (px) cached before switching to fixed

  let moDoc = null;
  let moAttr = null;
  let rafTick = null;
  let roParent = null;
  let roDoc = null;

  const listeners = [];

  const isFirefox = typeof InstallTrigger !== 'undefined' || /\bFirefox\//.test(navigator.userAgent);

  function log(...args) {
    try { console.log(LOG_PREFIX, ...args); } catch {}
  }

  function on(target, evt, handler, opts) {
    try {
      target.addEventListener(evt, handler, opts || { passive: true });
      listeners.push({ target, evt, handler, opts });
    } catch {}
  }

  function offAll() {
    try {
      listeners.forEach(({ target, evt, handler, opts }) => {
        try { target.removeEventListener(evt, handler, opts); } catch {}
      });
      listeners.length = 0;
    } catch {}
  }

  function getContainer() {
    return document.querySelector(CONTAINER_SELECTOR);
  }

  function getNavs() {
    try {
      return Array.from(document.querySelectorAll(NAV_SELECTOR));
    } catch {
      return [];
    }
  }

  function readPxVar(varName, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (!v) return fallback;
      if (v.endsWith('px')) return Math.round(parseFloat(v));
      const n = Math.round(parseFloat(v));
      return Number.isFinite(n) ? n : fallback;
    } catch { return fallback; }
  }

  function isExpanded(container) {
    if (!container) return false;
    // Reddit uses expanded="1" in your dump; treat presence as expanded.
    return container.hasAttribute(EXPANDED_ATTR) && container.getAttribute(EXPANDED_ATTR) !== '0';
  }

  function setExpanded(container) {
    if (!container) return false;
    try {
      if (!isExpanded(container)) {
        container.setAttribute(EXPANDED_ATTR, '1');
        log('set attribute expanded="1"');
        return true;
      }
    } catch {}
    return false;
  }

  function clickExpandButtonFallback() {
    try {
      const btn = document.querySelector(EXPAND_BTN_SELECTOR);
      if (btn && typeof btn.click === 'function') {
        btn.click();
        log('clicked expand button fallback');
        return true;
      }
    } catch {}
    return false;
  }

  // NEW: Scoped “Answers/Guides” killer for nav/header/aside only.
  const NAV_SCOPE_SELECTOR = 'nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]';
  const ANSWERS_SELECTORS = [
    // anchors by href or aria-label
    'a[href="/answers"]',
    'a[href="/answers/"]',
    'a[href^="/answers"]',
    'a[href*="/answers"]',
    'a[href*="/guides"]',
    'a[aria-label*="Answers" i]',
    'a[aria-label*="Guides" i]',
    // wrappers/trackers/icons/testids
    'faceplate-tracker[noun="gen_guides_sidebar"]',
    'faceplate-tracker[noun*="answers" i]',
    'faceplate-tracker[noun*="guide" i]',
    'svg[icon-name="answers-outline"]',
    'svg[icon-name*="answers" i]',
    'svg[icon-name*="guide" i]',
    '[data-testid*="answers" i]',
    '[data-spotlight-name*="answers" i]'
  ];

  function hideAnswersBeta() {
    try {
      const scopes = document.querySelectorAll(NAV_SCOPE_SELECTOR);
      if (!scopes || !scopes.length) return;

      scopes.forEach(scope => {
        ANSWERS_SELECTORS.forEach(sel => {
          try {
            const nodes = scope.querySelectorAll(sel);
            if (!nodes || !nodes.length) return;
            nodes.forEach(el => {
              try {
                // Prefer a small safe container (li/a/faceplate-tracker) if present
                const container =
                  el.closest?.('li[role="presentation"], li, a, faceplate-tracker') || el;

                container.style.display = 'none';
                container.style.pointerEvents = 'none';
                container.style.visibility = 'hidden';
                container.style.opacity = '0';
                // Keep layout stable without reflowing parents aggressively
                container.style.height = container.style.height || '0px';
                container.style.width = container.style.width || '';
              } catch {}
            });
          } catch {}
        });
      });
    } catch {}
  }

  // NEW: Ask reddit.js page-world hook (if present) to remove “Answers” everywhere (incl. closed Shadow DOM)
  function nudgeAnswersRemoval() {
    try {
      if (typeof window.__nrRemoveAnswersIn_forAnswers === 'function') {
        try { window.__nrRemoveAnswersIn_forAnswers(document); } catch {}
      }
    } catch {}
    // Still run local fallback for light/open DOM
    try { hideAnswersBeta(); } catch {}
  }

  // NEW: short burst to sweep late nav mounts after big layout changes
  function scheduleAnswersNudgeBurst(times = 12, delay = 120) {
    let count = 0;
    const id = setInterval(() => {
      try { nudgeAnswersRemoval(); } catch {}
      if (++count >= times) clearInterval(id);
    }, delay);
  }

  function neutralizeHoverGate() {
    try {
      // Hide the explicit buttons and tooltips, if present (defensive duplicate of CSS).
      const toHide = [
        EXPAND_BTN_SELECTOR,
        COLLAPSE_BTN_SELECTOR,
        'rpl-tooltip[content="Expand Navigation"]',
        'rpl-tooltip[content="Collapse Navigation"]',
      ];
      toHide.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.display = 'none';
          el.style.pointerEvents = 'none';
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
        });
      });

      // Ensure the nav itself accepts pointer events.
      document.querySelectorAll(NAV_SELECTOR).forEach(el => {
        el.style.pointerEvents = 'auto';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
      });

      // NEW: also kill any “Answers/Guides” entries that may have mounted here
      nudgeAnswersRemoval();
    } catch {}
  }

  // Common sizing that both Chrome (sticky) and Firefox (fixed) share
  function applyBaseSizing(widthPx) {
    const container = getContainer();
    if (container) {
      try {
        container.style.setProperty('width', widthPx + 'px', 'important');
        container.style.setProperty('min-width', widthPx + 'px', 'important');
        container.style.setProperty('max-width', widthPx + 'px', 'important');
        container.style.setProperty('flex', `0 0 ${widthPx}px`, 'important');
        container.style.setProperty('transform', 'none', 'important');
        container.style.setProperty('opacity', '1', 'important');
        container.style.setProperty('pointer-events', 'auto', 'important');
        container.style.setProperty('z-index', '3', 'important');
        container.dataset[DS_APPLIED] = '1';
      } catch {}
    }

    try {
      getNavs().forEach(el => {
        el.style.setProperty('width', widthPx + 'px', 'important');
        el.style.setProperty('min-width', widthPx + 'px', 'important');
        el.style.setProperty('max-width', widthPx + 'px', 'important');
        el.style.setProperty('flex', `0 0 ${widthPx}px`, 'important');
        el.style.setProperty('transform', 'none', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('pointer-events', 'auto', 'important');
        el.style.setProperty('z-index', '3', 'important');

        // Reset any accidental sticky on the child (prevents nested-sticky issues)
        el.style.setProperty('position', 'static', 'important');
        el.style.setProperty('top', 'auto', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('overflow-y', 'visible', 'important');
        el.style.setProperty('overflow-x', 'visible', 'important');
      });
    } catch {}
  }

  // Chrome/Edge/etc.: position: sticky on the container (CSS already handles this; keep as a nudge)
  function applyStickyLayoutChrome(widthPx, headerOffset) {
    const container = getContainer();
    if (!container) return;
    try {
      // Do NOT use !important here; let your CSS (sticky) win naturally in Chrome.
      container.style.position = 'sticky';
      container.style.top = headerOffset + 'px';
      container.style.height = `calc(100vh - ${headerOffset}px)`;
      container.style.overflowY = 'auto';
      container.style.overflowX = 'hidden';
      container.style.bottom = '';
      container.style.left = '';
      container.style.right = '';
      container.dataset[DS_FIXED] = '';
    } catch {}
  }

  // Firefox-only helpers
  function ensureSpacer(widthPx) {
    const container = getContainer();
    if (!container || !container.parentElement) return null;

    let spacer = container.parentElement.querySelector('#' + SPACER_ID);
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = SPACER_ID;
      try {
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.display = 'block';
        spacer.style.visibility = 'hidden';       // invisible but occupies space
        spacer.style.pointerEvents = 'none';
        spacer.style.flex = `0 0 ${widthPx}px`;
        spacer.style.width = widthPx + 'px';
        spacer.style.minWidth = widthPx + 'px';
        spacer.style.maxWidth = widthPx + 'px';
        spacer.style.height = '1px';              // minimal height to participate in flex sizing
        spacer.style.minHeight = '1px';
        spacer.style.maxHeight = '1px';
      } catch {}
      // Place spacer right before the container so left position aligns with it
      try { container.parentElement.insertBefore(spacer, container); } catch {}
    } else {
      // keep width in sync
      spacer.style.flex = `0 0 ${widthPx}px`;
      spacer.style.width = widthPx + 'px';
      spacer.style.minWidth = widthPx + 'px';
      spacer.style.maxWidth = widthPx + 'px';
    }
    return spacer;
  }

  function computeHeaderOffsetDynamic(fallbackPx) {
    try {
      const hdr = document.querySelector('header');
      if (!hdr) return fallbackPx;
      const cs = getComputedStyle(hdr);
      if (cs.position === 'sticky' || cs.position === 'fixed') {
        const r = hdr.getBoundingClientRect();
        const h = Math.round(r.height || 0);
        // Typical reddit header heights fall within this range
        if (h >= 44 && h <= 120) return h;
      }
    } catch {}
    return fallbackPx;
  }

  function computeLeftFromSpacer(spacer) {
    try {
      const rect = spacer.getBoundingClientRect();
      // Round to avoid subpixel blurring in Firefox
      return Math.round(rect.left);
    } catch { return 0; }
  }

  function computeLeftFallback(container) {
    // Use cached pre-fix left, then parent left, then main content left.
    try {
      const cached = parseInt(container.dataset[DS_INIT_LEFT] || '', 10);
      if (Number.isFinite(cached)) return cached;

      const parent = container.parentElement;
      if (parent) {
        const pr = parent.getBoundingClientRect();
        return Math.round(pr.left);
      }

      const main = document.querySelector('div[role="main"], shreddit-app main, faceplate-tracker[slot="layout"]');
      if (main) {
        const mr = main.getBoundingClientRect();
        return Math.round(mr.left);
      }
    } catch {}
    return 0;
  }

  function applyFixedLayoutFirefox(widthPx, headerOffset) {
    const container = getContainer();
    if (!container) return;

    // Cache initial left once, before switching to fixed (used when spacer can't anchor)
    if (container.dataset[DS_INIT_LEFT] == null) {
      try {
        const pre = container.getBoundingClientRect();
        container.dataset[DS_INIT_LEFT] = String(Math.round(pre.left));
      } catch {}
    }

    const spacer = ensureSpacer(widthPx);
    const left = spacer ? computeLeftFromSpacer(spacer) : computeLeftFallback(container);

    try {
      // Use inline !important to beat stylesheet !important for Firefox path.
      container.style.setProperty('position', 'fixed', 'important');
      container.style.setProperty('left', left + 'px', 'important');
      container.style.setProperty('top', headerOffset + 'px', 'important');
      container.style.setProperty('bottom', '0px', 'important');
      container.style.setProperty('right', '', 'important');
      container.style.setProperty('height', '', 'important'); // implied by top+bottom
      container.style.setProperty('overflow-y', 'auto', 'important');
      container.style.setProperty('overflow-x', 'hidden', 'important');
      container.dataset[DS_FIXED] = '1';
    } catch {}

    scheduleLeftSync();
    observeResizeTargets(); // start listening to responsive/grid shifts immediately
  }

  function scheduleLeftSync() {
    if (rafTick) cancelAnimationFrame(rafTick);
    rafTick = requestAnimationFrame(syncFixedLeft);
  }

  function syncFixedLeft() {
    rafTick = null;
    const container = getContainer();
    if (!container || container.dataset[DS_FIXED] !== '1') return;

    const widthPx = getTargetWidth();
    const spacer = ensureSpacer(widthPx);
    const dynamicHeader = computeHeaderOffsetDynamic(getHeaderOffset());

    const left = spacer ? computeLeftFromSpacer(spacer) : computeLeftFallback(container);
    try {
      container.style.setProperty('left', left + 'px', 'important');
      container.style.setProperty('top', dynamicHeader + 'px', 'important');
    } catch {}
  }

  function removeFixedArtifactsIfAny() {
    const container = getContainer();
    if (container && container.dataset[DS_FIXED] === '1') {
      try {
        // Clearing properties lets your CSS sticky path take over again.
        container.style.removeProperty('position');
        container.style.removeProperty('left');
        container.style.removeProperty('top');
        container.style.removeProperty('bottom');
        container.style.removeProperty('right');
        container.style.removeProperty('height');
        container.style.removeProperty('overflow-y');
        container.style.removeProperty('overflow-x');
        container.dataset[DS_FIXED] = '';
      } catch {}
    }
    // Remove spacer if it exists
    try {
      const parent = getContainer()?.parentElement;
      const spacer = parent?.querySelector('#' + SPACER_ID);
      if (spacer) spacer.remove();
    } catch {}
  }

  function getTargetWidth() {
    // Prefer your CSS variable; fallback to 320px which matches the stylesheet
    return readPxVar('--rb-leftnav-expanded', 320);
  }

  function getHeaderOffset() {
    // Prefer your CSS variable; fallback to 56px which matches the stylesheet
    return readPxVar('--rb-header-offset', 56);
  }

  function applyLayout() {
    const widthPx = getTargetWidth();

    // Always size the elements first
    applyBaseSizing(widthPx);

    if (isFirefox) {
      // Use dynamic header height in Firefox to avoid overlap/drift on home/posts
      const headerOffset = computeHeaderOffsetDynamic(getHeaderOffset());
      applyFixedLayoutFirefox(widthPx, headerOffset);
    } else {
      // Chrome: rely on stylesheet sticky path; remove any fixed artifacts if we navigated from FF
      removeFixedArtifactsIfAny();
      const headerOffset = getHeaderOffset();
      applyStickyLayoutChrome(widthPx, headerOffset);
    }
  }

  function forceExpandOnce() {
    const container = getContainer();
    if (!container) return;

    const before = isExpanded(container);
    const attrChanged = setExpanded(container);
    const after = isExpanded(container);

    if (!after) {
      // If attribute alone didn’t take, try clicking the official expand button.
      clickExpandButtonFallback();
    }

    // Make sure hover gate isn’t intercepting.
    neutralizeHoverGate();

    // Ensure cross-browser layout
    applyLayout();

    // NEW: enforce Answers removal again after any reflow
    nudgeAnswersRemoval();
    scheduleAnswersNudgeBurst();

    log(`expand run: before=${before}, attrChanged=${attrChanged}, after=${isExpanded(container)}`);
  }

  function installAttributeGuard(container) {
    if (!container) return;
    try {
      if (moAttr) moAttr.disconnect();
      moAttr = new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === 'attributes' && m.attributeName === EXPANDED_ATTR) {
            const nowExpanded = isExpanded(container);
            if (!nowExpanded) {
              setExpanded(container);
              neutralizeHoverGate();
              applyLayout();
              nudgeAnswersRemoval();        // NEW: re‑hide Answers after attribute flips
              scheduleAnswersNudgeBurst();  // NEW: sweep late mounts
              log('guard reapplied expanded after attribute flip');
            }
          }
        }
      });
      moAttr.observe(container, { attributes: true, attributeFilter: [EXPANDED_ATTR] });
    } catch {}
  }

  function installDomObserver() {
    try {
      if (moDoc) moDoc.disconnect();
      moDoc = new MutationObserver(() => {
        const container = getContainer();
        if (container) {
          forceExpandOnce();
          installAttributeGuard(container);
          // NEW: catch late nav mounts caused by SPA route changes
          nudgeAnswersRemoval();
        }
      });
      moDoc.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
  }

  function observeResizeTargets() {
    const container = getContainer();
    if (!container) return;
    const parent = container.parentElement;

    // Observe parent width/position changes (grid/flex changes on home feed/posts)
    try {
      if ('ResizeObserver' in window && parent) {
        roParent?.disconnect?.();
        roParent = new ResizeObserver(() => {
          scheduleLeftSync();
          nudgeAnswersRemoval();       // NEW: in case layout swaps nav variants
        });
        roParent.observe(parent);
      }
    } catch {}

    // Also observe documentElement for viewport scrollbar/zoom/layout shifts
    try {
      if ('ResizeObserver' in window) {
        roDoc?.disconnect?.();
        roDoc = new ResizeObserver(() => {
          scheduleLeftSync();
          nudgeAnswersRemoval();
        });
        roDoc.observe(document.documentElement);
      }
    } catch {}
  }

  function installWindowListeners() {
    // Keep fixed-left aligned in Firefox on resize/zoom/orientation changes
    on(window, 'resize', () => { scheduleLeftSync(); nudgeAnswersRemoval(); }, { passive: true });
    on(window, 'orientationchange', () => { scheduleLeftSync(); nudgeAnswersRemoval(); }, { passive: true });

    // Also re-run on visibility regain (route changes often happen while hidden)
    on(document, 'visibilitychange', () => {
      if (!document.hidden) setTimeout(() => { forceExpandOnce(); scheduleLeftSync(); nudgeAnswersRemoval(); scheduleAnswersNudgeBurst(); }, 50);
    }, { passive: true });

    // Occasionally Reddit toggles classes that change layout margins on scroll.
    // Use a cheap scroll sync only in Firefox when fixed mode is active.
    if (isFirefox) {
      on(window, 'scroll', () => {
        const container = getContainer();
        if (container && container.dataset[DS_FIXED] === '1') scheduleLeftSync();
      }, { passive: true });
    }

    // Clean up on navigation away (helps FF memory + removes spacer)
    on(window, 'pagehide', cleanup, { passive: true });
    on(window, 'beforeunload', cleanup, { passive: true });
  }

  function cleanup() {
    try { moDoc && moDoc.disconnect && moDoc.disconnect(); } catch {}
    try { moAttr && moAttr.disconnect && moAttr.disconnect(); } catch {}
    try { roParent && roParent.disconnect && roParent.disconnect(); } catch {}
    try { roDoc && roDoc.disconnect && roDoc.disconnect(); } catch {}
    offAll();
    removeFixedArtifactsIfAny();
  }

  function init() {
    // Try immediately, then on DOM ready, then install observers.
    nudgeAnswersRemoval();       // NEW: immediate pass
    scheduleAnswersNudgeBurst(); // NEW: early burst

    forceExpandOnce();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { forceExpandOnce(); nudgeAnswersRemoval(); scheduleAnswersNudgeBurst(); }, { once: true });
    } else {
      setTimeout(() => { forceExpandOnce(); nudgeAnswersRemoval(); scheduleAnswersNudgeBurst(); }, 0);
    }
    installDomObserver();
    installWindowListeners();
    // If FF path is active by the time we initialize, begin observing for resize/layout shifts
    if (isFirefox) observeResizeTargets();
  }

  try { init(); } catch (e) { log('init error', e); }

  // Expose a manual cleanup for debugging if needed
  try { window.__rleftnav_cleanup = cleanup; } catch {}
})();