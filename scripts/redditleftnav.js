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
  let guardedContainer = null;
  let observedResizeParent = null;
  let navWorkTimer = null;
  let mediaWorkTimer = null;
  let answersBurst = null;
  let recentBurst = null;
  let upgradeBurst = null;
  let navLayoutPending = false;
  let navBurstPending = false;
  let fullMediaSweepPending = false;
  let lastRoute = location.href;
  let stopped = false;
  const mediaRoots = new Set();

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

  // NEW: Ask reddit.js shared Answers helper (if present), then use the local light-DOM fallback
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
    if (stopped || answersBurst !== null) return;
    let count = 0;
    answersBurst = setInterval(() => {
      try { nudgeAnswersRemoval(); } catch {}
      if (++count >= times) {
        clearInterval(answersBurst);
        answersBurst = null;
      }
    }, delay);
  }

  const RECENT_SELECTORS = [
    '#recent-communities-section',
    'div#recent-communities-section',
    'faceplate-expandable-section-helper#recent-communities-section',
    'summary[aria-controls="RECENT"]',
    '[aria-controls="RECENT"]',
    '#RECENT',
    'reddit-recent-pages',
    'shreddit-recent-communities',
    'div[data-testid="community-list"]',
    '[data-testid="recent-communities"]',
    '.recent-communities'
  ];

  function hideRecentSection() {
    try {
      RECENT_SELECTORS.forEach(sel => {
        try {
          const nodes = document.querySelectorAll(sel);
          if (!nodes || !nodes.length) return;
          nodes.forEach(el => {
            try {
              const container =
                el.closest?.('#recent-communities-section') ||
                el.closest?.('faceplate-expandable-section-helper#recent-communities-section') ||
                el.closest?.('details') ||
                el.closest?.('div.mb-sm.pb-sm') ||
                el;
              container.style.display = 'none';
              container.style.pointerEvents = 'none';
              container.style.visibility = 'hidden';
              container.style.opacity = '0';
              container.style.height = '0';
              container.style.minHeight = '0';
              container.style.maxHeight = '0';
              container.style.margin = '0';
              container.style.padding = '0';
              container.style.overflow = 'hidden';
            } catch {}
          });
        } catch {}
      });

      const scopes = document.querySelectorAll('nav, aside, [data-testid="left-sidebar"], #left-sidebar-container, reddit-sidebar-nav, flex-left-nav-container');
      scopes.forEach(scope => {
        try {
          const items = scope.querySelectorAll('div, li, span, summary, faceplate-expandable-section-helper');
          items.forEach(el => {
            const text = (el.textContent || '').trim();
            if (!text || !/^RECENT$/i.test(text)) return;
            const container =
              el.closest?.('#recent-communities-section') ||
              el.closest?.('faceplate-expandable-section-helper#recent-communities-section') ||
              el.closest?.('details') ||
              el.closest?.('div.mb-sm.pb-sm') ||
              el;
            container.style.display = 'none';
            container.style.pointerEvents = 'none';
            container.style.visibility = 'hidden';
            container.style.opacity = '0';
            container.style.height = '0';
            container.style.minHeight = '0';
            container.style.maxHeight = '0';
            container.style.margin = '0';
            container.style.padding = '0';
            container.style.overflow = 'hidden';
          });
        } catch {}
      });
    } catch {}
  }

  function nudgeRecentRemoval() {
    try { hideRecentSection(); } catch {}
  }

  function scheduleRecentNudgeBurst(times = 12, delay = 120) {
    if (stopped || recentBurst !== null) return;
    let count = 0;
    recentBurst = setInterval(() => {
      try { nudgeRecentRemoval(); } catch {}
      if (++count >= times) {
        clearInterval(recentBurst);
        recentBurst = null;
      }
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

      // Navigation cleanup is performed once by forceExpandOnce().
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

  function forceExpandOnce(withBurst = true) {
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

    // NEW: enforce nav cleanup again after any reflow
    nudgeAnswersRemoval();
    nudgeRecentRemoval();
    if (withBurst) {
      scheduleAnswersNudgeBurst();
      scheduleRecentNudgeBurst();
      scheduleUpgradeBurst();
    }

    log(`expand run: before=${before}, attrChanged=${attrChanged}, after=${isExpanded(container)}`);
  }

  function installAttributeGuard(container) {
    if (!container || (moAttr && guardedContainer === container)) return;
    try {
      if (moAttr) moAttr.disconnect();
      guardedContainer = container;
      moAttr = new MutationObserver(() => {
        if (container.isConnected && !isExpanded(container)) {
          // Yield to the browser instead of fighting Reddit in a microtask loop.
          scheduleNavWork(true, true);
        }
      });
      moAttr.observe(container, { attributes: true, attributeFilter: [EXPANDED_ATTR] });
    } catch {}
  }

  function scheduleNavWork(layout = false, burst = false) {
    if (stopped) return;
    navLayoutPending = navLayoutPending || layout;
    navBurstPending = navBurstPending || burst;
    if (navWorkTimer !== null) return;
    navWorkTimer = setTimeout(() => {
      navWorkTimer = null;
      const layout = navLayoutPending;
      const burst = navBurstPending;
      navLayoutPending = navBurstPending = false;
      const container = getContainer();
      if (container && (layout || container !== guardedContainer)) {
        const newContainer = container !== guardedContainer;
        installAttributeGuard(container);
        forceExpandOnce(burst || newContainer);
      } else {
        if (!container && guardedContainer) {
          moAttr?.disconnect();
          moAttr = null;
          guardedContainer = null;
        }
        nudgeAnswersRemoval();
        nudgeRecentRemoval();
        if (burst) {
          scheduleAnswersNudgeBurst();
          scheduleRecentNudgeBurst();
          scheduleUpgradeBurst();
        }
      }
    }, 100);
  }

  const NAV_CHANGE_SELECTOR = CONTAINER_SELECTOR + ', ' + NAV_SELECTOR + ', ' +
    EXPAND_BTN_SELECTOR + ', ' + COLLAPSE_BTN_SELECTOR;
  const NAV_CLEANUP_SELECTOR = NAV_SCOPE_SELECTOR + ', ' + RECENT_SELECTORS.join(', ');

  function queueMediaRoot(node) {
    if (stopped || !node || node.nodeType !== 1) return;
    if (!fullMediaSweepPending) {
      mediaRoots.add(node);
      if (mediaRoots.size > 128) {
        mediaRoots.clear();
        fullMediaSweepPending = true;
      }
    }
    if (mediaWorkTimer !== null) return;
    mediaWorkTimer = setTimeout(() => {
      mediaWorkTimer = null;
      const roots = Array.from(mediaRoots);
      mediaRoots.clear();
      const full = fullMediaSweepPending;
      fullMediaSweepPending = false;
      if (full) {
        upgradeInsecureResources();
        return;
      }
      for (const root of roots) {
        if (!root.isConnected || roots.some(other => other !== root && other.contains(root))) continue;
        upgradeInsecureResources(root);
      }
    }, 120);
  }

  function installDomObserver() {
    try {
      if (moDoc) moDoc.disconnect();
      moDoc = new MutationObserver(mutations => {
        const routeChanged = location.href !== lastRoute;
        if (routeChanged) lastRoute = location.href;
        let layout = routeChanged || !!(guardedContainer && !guardedContainer.isConnected);
        let cosmetics = layout;
        for (const mutation of mutations) {
          const target = mutation.target;
          if (mutation.type === 'attributes') {
            // Late lazy-loaded URLs may change without inserting a new node.
            // Ignore all normal style/URL writes, including our own HTTPS upgrades.
            if (/http:/i.test(target.getAttribute(mutation.attributeName) || '')) queueMediaRoot(target);
            continue;
          }
          if (target.nodeType === 1) {
            if (target.closest(NAV_CHANGE_SELECTOR)) layout = true;
            if (target.closest(NAV_CLEANUP_SELECTOR)) cosmetics = true;
          }
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            queueMediaRoot(node);
            if (!layout && (node.matches(NAV_CHANGE_SELECTOR) || node.querySelector(NAV_CHANGE_SELECTOR))) layout = true;
            if (!cosmetics && (node.matches(NAV_CLEANUP_SELECTOR) || node.querySelector(NAV_CLEANUP_SELECTOR))) cosmetics = true;
          }
        }
        if (layout || cosmetics) scheduleNavWork(layout, routeChanged);
      });
      moDoc.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['src', 'href', 'poster', 'srcset', 'style']
      });
      const container = getContainer();
      if (container) installAttributeGuard(container);
    } catch {}
  }

  function observeResizeTargets() {
    const container = getContainer();
    if (!container) return;
    const parent = container.parentElement;

    // Observe parent width/position changes (grid/flex changes on home feed/posts)
    try {
      if ('ResizeObserver' in window && parent && observedResizeParent !== parent) {
        roParent?.disconnect?.();
        observedResizeParent = parent;
        roParent = new ResizeObserver(() => {
          scheduleLeftSync();
          scheduleNavWork();
        });
        roParent.observe(parent);
      }
    } catch {}

    // Also observe documentElement for viewport scrollbar/zoom/layout shifts
    try {
      if ('ResizeObserver' in window && !roDoc) {
        roDoc = new ResizeObserver(() => {
          scheduleLeftSync();
          scheduleNavWork();
        });
        roDoc.observe(document.documentElement);
      }
    } catch {}
  }

  function installWindowListeners() {
    // Keep fixed-left aligned in Firefox on resize/zoom/orientation changes
    on(window, 'resize', () => { scheduleLeftSync(); scheduleNavWork(false, true); }, { passive: true });
    on(window, 'orientationchange', () => { scheduleLeftSync(); scheduleNavWork(false, true); }, { passive: true });

    // Also re-run on visibility regain (route changes often happen while hidden)
    on(document, 'visibilitychange', () => {
      if (!document.hidden) { scheduleNavWork(true, true); scheduleLeftSync(); }
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
    stopped = true;
    for (const timer of [answersBurst, recentBurst, upgradeBurst]) {
      if (timer !== null) clearInterval(timer);
    }
    for (const timer of [navWorkTimer, mediaWorkTimer]) {
      if (timer !== null) clearTimeout(timer);
    }
    if (rafTick !== null) cancelAnimationFrame(rafTick);
    mediaRoots.clear();
    offAll();
    removeFixedArtifactsIfAny();
  }

  // ===== NEW: Insecure URL upgrader (prevents Mixed Content warnings) =====

  // Hosts we’re comfortable upgrading to https
  const UPGRADE_HOSTS = [
    'i.redd.it',
    'preview.redd.it',
    'external-preview.redd.it',
    'redditmedia.com',
    'i.redditmedia.com',
    'i.imgur.com',
    'imgur.com',
    'media.giphy.com',
    'giphy.com'
  ];

  function hostnameMatchesAllowlist(h) {
    try {
      const host = String(h || '').toLowerCase();
      return UPGRADE_HOSTS.some(allowed => host === allowed || host.endsWith('.' + allowed));
    } catch { return false; }
  }

  function upgradeOneUrl(u) {
    try {
      const str = String(u || '').trim();
      if (!str) return null;
      if (str.startsWith('data:') || str.startsWith('blob:') || str.startsWith('about:') || str.startsWith('chrome-extension:') || /^https:/i.test(str)) return null;

      const url = new URL(str, document.baseURI);
      if (url.protocol === 'http:' && hostnameMatchesAllowlist(url.hostname)) {
        url.protocol = 'https:';
        return url.toString();
      }
    } catch {}
    return null;
  }

  function upgradeSrcset(value) {
    try {
      if (!value || typeof value !== 'string') return value;
      const parts = value.split(',');
      const remapped = parts.map(p => {
        const t = p.trim();
        if (!t) return t;
        // Split first whitespace to separate URL from descriptor (e.g., "2x" or "640w")
        const spaceIdx = t.search(/\s/);
        let urlPart = t;
        let desc = '';
        if (spaceIdx > -1) {
          urlPart = t.slice(0, spaceIdx);
          desc = t.slice(spaceIdx).trim();
        }
        const upgraded = upgradeOneUrl(urlPart);
        return (upgraded || urlPart) + (desc ? ' ' + desc : '');
      });
      return remapped.join(', ');
    } catch { return value; }
  }

  function upgradeInsecureResources(root = document) {
    try {
      const selector = 'img, source, video, audio, picture, a, link[rel="preload"][as="image"], [style]';
      const nodes = Array.from(root.querySelectorAll(selector));
      if (root.matches?.(selector)) nodes.unshift(root);
      nodes.forEach(el => {
        try {
          // src / href / poster
          ['src', 'href', 'poster'].forEach(attr => {
            const cur = el.getAttribute && el.getAttribute(attr);
            const up = upgradeOneUrl(cur);
            if (up && up !== cur) el.setAttribute(attr, up);
          });

          // srcset (images)
          const srcset = el.getAttribute && el.getAttribute('srcset');
          if (srcset) {
            const upSet = upgradeSrcset(srcset);
            if (upSet && upSet !== srcset) el.setAttribute('srcset', upSet);
          }

          // Inline style background / background-image
          if (el.hasAttribute && el.hasAttribute('style')) {
            const styleVal = el.getAttribute('style') || '';
            // Replace any url("http:...") or url(http:...)
            const replaced = styleVal.replace(/url\(\s*(['"]?)(http:\/\/[^'")]+)\1\s*\)/gi, (_m, q, url) => {
              const up = upgradeOneUrl(url);
              if (up) return `url(${q}${up}${q})`;
              return _m;
            });
            if (replaced !== styleVal) el.setAttribute('style', replaced);
          }
        } catch {}
      });
    } catch {}
  }

  function scheduleUpgradeBurst(times = 10, delay = 120) {
    if (stopped || upgradeBurst !== null) return;
    let count = 0;
    upgradeBurst = setInterval(() => {
      try { upgradeInsecureResources(); } catch {}
      if (++count >= times) {
        clearInterval(upgradeBurst);
        upgradeBurst = null;
      }
    }, delay);
  }

  // ===== END: Insecure URL upgrader =====

  function init() {
    // Try immediately, then on DOM ready, then install observers.
    upgradeInsecureResources();
    if (getContainer()) forceExpandOnce();
    else {
      nudgeAnswersRemoval();
      nudgeRecentRemoval();
      scheduleAnswersNudgeBurst();
      scheduleRecentNudgeBurst();
      scheduleUpgradeBurst();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { scheduleNavWork(true, true); upgradeInsecureResources(); }, { once: true });
    } else {
      scheduleNavWork(true, true);
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