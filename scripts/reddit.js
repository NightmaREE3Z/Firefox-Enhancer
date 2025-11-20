(function () {
    'use strict';

    // ---- RUNTIME + FIREFOX GUARDS ----
    const IS_FIREFOX = typeof InstallTrigger !== 'undefined' || /\bFirefox\//.test(navigator.userAgent);
    let HEAVY_OBSERVERS_ACTIVE = false;       // track whether main MOs are attached
    let INITIAL_BURST_DONE = false;           // taper aggressive timers after startup
    let PAGE_WORLD_HOOKED = false;            // page-world Answers hook installed flag
    let START_TS = performance.now();

    // Enforce hard, no-bypass blocking of all lists (subreddits, strings, regex)
    const STRICT_BLOCKING = true;

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        try { console.log('[REDDIT.JS]', message); } catch {}
    }

    // === Click-through guarantee + author allowlist globals ===
    // If a post was previously approved in a feed, guarantee it will not be hidden when opened on its comments page.
    // Also never hide posts authored by u/NightmaREE3Z anywhere.
    const WHITELIST_AUTHORS = ['u/NightmaREE3Z', 'NightmaREE3Z', 'u/nightmareee3z', 'nightmareee3z'];
    const APPROVED_SS_KEY = '__nrApprovedPostsV1';
    const APPROVED_LS_KEY = '__nrApprovedPostsV1_ls'; // NEW: localStorage mirror for cross-tab persistence
    let CURRENT_POST_ID = null;               // "post_<id>" on comments page, else null
    let ALWAYS_ALLOW_CURRENT_POST = false;    // true if CURRENT_POST_ID was previously approved in a feed

    function getCurrentPostIdFromUrl() {
        try {
            const m = window.location.href.match(/\/comments\/([a-zA-Z0-9]+)/);
            return m ? `post_${m[1]}` : null;
        } catch { return null; }
    }
    function getApprovedPostsArray() {
        // CHANGED: unify approvals from sessionStorage + localStorage, dedupe
        try {
            const ssRaw = sessionStorage.getItem(APPROVED_SS_KEY);
            const lsRaw = localStorage.getItem(APPROVED_LS_KEY);
            const ssArr = ssRaw ? JSON.parse(ssRaw) : [];
            const lsArr = lsRaw ? JSON.parse(lsRaw) : [];
            const set = new Set();
            if (Array.isArray(ssArr)) { for (let i = 0; i < ssArr.length; i++) set.add(ssArr[i]); }
            if (Array.isArray(lsArr)) { for (let i = 0; i < lsArr.length; i++) set.add(lsArr[i]); }
            return Array.from(set);
        } catch { return []; }
    }
    function setApprovedPostsArray(arr) {
        // CHANGED: persist to both storages for reliability across tabs and reloads
        try {
            const safeArr = Array.isArray(arr) ? arr : [];
            const json = JSON.stringify(safeArr);
            try { sessionStorage.setItem(APPROVED_SS_KEY, json); } catch {}
            try { localStorage.setItem(APPROVED_LS_KEY, json); } catch {}
        } catch {}
    }
    function getApprovedPostIdsFromSession() {
        // CHANGED: now returns the union Set (still returns Set for compatibility)
        return new Set(getApprovedPostsArray());
    }
    function rememberApprovedPostId(id) {
        // CHANGED: only persist canonical IDs ("post_<id>"), ignore fallbacks to prevent mismatches
        if (!id) return;
        const canonical = /^post_[a-zA-Z0-9]+$/.test(String(id));
        if (!canonical) return;
        const arr = getApprovedPostsArray();
        if (!arr.includes(id)) arr.push(id);
        // keep only last 100 approved post ids
        if (arr.length > 100) arr.splice(0, arr.length - 100);
        setApprovedPostsArray(arr);
    }
    function isWhitelistedAuthorName(name) {
        if (!name) return false;
        const n = String(name).trim().replace(/^u\//i, '').toLowerCase();
        return WHITELIST_AUTHORS.some(a => a.replace(/^u\//i, '').toLowerCase() === n);
    }
    function getAuthorFromElement(el) {
        try {
            // Attribute-based first (custom elements sometimes expose author)
            const attrAuthor = (el.getAttribute && (el.getAttribute('author') || el.getAttribute('data-author') || el.getAttribute('data-username'))) || '';
            if (attrAuthor) return attrAuthor;

            // Known selectors in new Reddit
            const sel = el.querySelector && el.querySelector(
                'a[data-testid="post_author_link"], ' +
                'a[href^="/user/"], a[href^="/u/"], ' +
                '[slot="author"] a, faceplate-username, ' +
                '[data-testid="post-author"], ' +
                'a[data-testid="comment_author_link"]'
            );
            if (sel && sel.textContent) return sel.textContent.trim();

            // Try enclosing shreddit-post attributes
            const postEl = el.closest && el.closest('shreddit-post');
            if (postEl) {
                const pAuthor = postEl.getAttribute('author') || postEl.getAttribute('data-author') || '';
                if (pAuthor) return pAuthor;
            }
        } catch {}
        return '';
    }
    function isElementFromWhitelistedAuthor(el) {
        try {
            const name = getAuthorFromElement(el);
            return isWhitelistedAuthorName(name);
        } catch { return false; }
    }
    function isCurrentPageWhitelistedAuthor() {
        try {
            // Only meaningful on comments pages
            if (!/\/comments\//.test(window.location.href)) return false;
            const el = document.querySelector(
                'a[data-testid="post_author_link"], ' +
                '[data-testid="post-author"], ' +
                'a[href^="/user/"], a[href^="/u/"], ' +
                'shreddit-post'
            );
            if (!el) return false;
            const name = getAuthorFromElement(el);
            return isWhitelistedAuthorName(name);
        } catch { return false; }
    }

    // initialize current post allow flag ASAP
    try {
        CURRENT_POST_ID = getCurrentPostIdFromUrl();
        if (CURRENT_POST_ID) {
            const set = getApprovedPostIdsFromSession(); // union set
            ALWAYS_ALLOW_CURRENT_POST = set.has(CURRENT_POST_ID);
        }
    } catch {}

    // === NEW: rock-solid click-through capture (prevents misses on SPA/various click types) ===
    // Extract canonical post_<id> from a given href
    function extractCanonicalPostIdFromHref(href) {
        if (!href || typeof href !== 'string') return null;
        try {
            const m = href.match(/\/comments\/([a-zA-Z0-9]+)/);
            return m ? `post_${m[1]}` : null;
        } catch { return null; }
    }
    // Try to get canonical post id from any element’s own attributes or nearest shreddit-post wrapper
    function tryGetCanonicalPostId(el) {
        if (!el) return null;
        try {
            // 1) data-ks-id="t3_xxx" on self or descendants
            const dataKsElement = (el.matches?.('[data-ks-id*="t3_"]') ? el : el.querySelector?.('[data-ks-id*="t3_"]'));
            if (dataKsElement) {
                const dataKsId = dataKsElement.getAttribute('data-ks-id') || '';
                const m = dataKsId.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
            }
            // 2) data-post-id on self or descendants
            const postIdEl = (el.hasAttribute?.('data-post-id') ? el : el.querySelector?.('[data-post-id]'));
            if (postIdEl) {
                const pid = postIdEl.getAttribute('data-post-id');
                if (pid && /^[a-zA-Z0-9]+$/.test(pid)) return `post_${pid}`;
            }
            // 3) id="t3_xxx" on shreddit-post wrapper
            const postWrapper = el.closest?.('shreddit-post');
            if (postWrapper) {
                const idAttr = postWrapper.getAttribute('id') || '';
                const m = idAttr.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
                const pid2 = postWrapper.getAttribute('data-post-id') || postWrapper.getAttribute('post-id') || '';
                if (pid2 && /^[a-zA-Z0-9]+$/.test(pid2)) return `post_${pid2}`;
            }
            // 4) scan any comments link in the element
            const a = el.querySelector?.('a[href*="/comments/"]');
            if (a) {
                const href = a.getAttribute('href') || '';
                const id = extractCanonicalPostIdFromHref(href);
                if (id) return id;
            }
            return null;
        } catch { return null; }
    }
    // Record an approval by anchor href
    function rememberApprovalByHref(href) {
        const id = extractCanonicalPostIdFromHref(href);
        if (id) {
            rememberApprovedPostId(id);
            devLog(`🧷 Captured approval via click: ${id}`);
        }
    }
    // Install capture listeners once
    (function installClickThroughCapture() {
        try {
            if (window.__nrClickCaptureInstalled) return;
            window.__nrClickCaptureInstalled = true;
            const capture = (evt) => {
                try {
                    let el = evt.target;
                    // climb up to nearest anchor
                    const anchor = el?.closest?.('a[href*="/comments/"]');
                    if (anchor) {
                        rememberApprovalByHref(anchor.getAttribute('href') || '');
                        return;
                    }
                    // If click on a post card with no visible anchor target, try canonical from wrapper
                    const card = el?.closest?.('article, shreddit-post');
                    const cid = tryGetCanonicalPostId(card || el);
                    if (cid) rememberApprovedPostId(cid);
                } catch {}
            };
            const keyCapture = (evt) => {
                try {
                    if (evt.key !== 'Enter' && evt.key !== ' ') return;
                    const el = document.activeElement;
                    if (!el) return;
                    const anchor = el.matches?.('a[href*="/comments/"]') ? el : el.closest?.('a[href*="/comments/"]');
                    if (anchor) {
                        rememberApprovalByHref(anchor.getAttribute('href') || '');
                    } else {
                        const card = el.closest?.('article, shreddit-post');
                        const cid = tryGetCanonicalPostId(card || el);
                        if (cid) rememberApprovedPostId(cid);
                    }
                } catch {}
            };
            document.addEventListener('click', capture, true);
            document.addEventListener('auxclick', capture, true);
            document.addEventListener('mousedown', capture, true);
            document.addEventListener('contextmenu', capture, true);
            document.addEventListener('keydown', keyCapture, true);
            // Storage sync across tabs/windows
            window.addEventListener('storage', () => {
                try {
                    CURRENT_POST_ID = getCurrentPostIdFromUrl();
                    if (!CURRENT_POST_ID) return;
                    const set = getApprovedPostIdsFromSession();
                    const allow = set.has(CURRENT_POST_ID);
                    ALWAYS_ALLOW_CURRENT_POST = allow;
                    if (allow) {
                        document.documentElement.classList.add('nr-allow-current-post');
                        document.body && document.body.classList.add('nr-allow-current-post');
                    } else {
                        document.documentElement.classList.remove('nr-allow-current-post');
                        document.body && document.body.classList.remove('nr-allow-current-post');
                    }
                } catch {}
            });
        } catch {}
    })();

    // === ANSWERS PAGE-WORLD HOOK (Shadow DOM safe; nav-scoped; optimized for Firefox) ===
    // Inject a tiny script into the page world so it can see Shadow DOM and clean “Answers” reliably without nuking layout.
    // Changes:
    // - Avoid scanning document.querySelectorAll('*') for ShadowRoots (very heavy on FF).
    // - Track created MutationObservers and disconnect them on pagehide.
    // - Limit initial sweep to known nav/toolbar scopes and common shells.
    (function installAnswersPageHook() {
        try {
            if (window.__nrAnswersEarlyInstalled) return;
            window.__nrAnswersEarlyInstalled = true;

            function injectIntoPage(fn) {
                try {
                    const el = document.createElement('script');
                    el.type = 'text/javascript';
                    el.textContent = `;(${fn})();`;
                    (document.documentElement || document.head).appendChild(el);
                    el.remove();
                } catch {}
            }

            // Light-DOM-only prehide for Answers INSIDE NAV SCOPES (shadow handled by the hook)
            (function injectPrehideCss() {
                try {
                    const id = 'nr-answers-prehide-css';
                    if (document.getElementById(id)) return;
                    const style = document.createElement('style');
                    style.id = id;
                    style.textContent = `
                      nav a[href="/answers"],
                      nav a[href="/answers/"],
                      nav a[href^="/answers"],
                      header a[href="/answers"],
                      header a[href="/answers/"],
                      header a[href^="/answers"],
                      aside a[href="/answers"],
                      aside a[href="/answers/"],
                      aside a[href^="/answers"],
                      [role="navigation"] a[href="/answers"],
                      [role="navigation"] a[href^="/answers"],
                      faceplate-tracker[source="nav"] a[href="/answers"],
                      faceplate-tracker[source="nav"] a[href^="/answers"],
                      svg[icon-name="answers-outline"] {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        height: 0 !important;
                        width: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        overflow: hidden !important;
                        position: absolute !important;
                        left: -9999px !important;
                        top: -9999px !important;
                        pointer-events: none !important;
                      }
                    `;
                    (document.head || document.documentElement).prepend(style);
                } catch {}
            })();

            // Page-world remover: nav-scoped and container-safe.
            injectIntoPage(function pageWorldAnswersHook() {
                if (window.__nrAnswersPageHooked) return;
                window.__nrAnswersPageHooked = true;

                // Track created observers so we can disconnect them on pagehide
                const OBS = new Set();
                function addObs(mo) { try { if (mo) OBS.add(mo); } catch(e){} }
                function disconnectAll() { try { OBS.forEach(o => { try { o.disconnect(); } catch {} }); OBS.clear(); } catch {} }

                // Only remove small, obvious nav items — never arbitrary div wrappers.
                function removeAnswersAnchor(a) {
                    try {
                        // Limit to nav scopes
                        const navScope = a.closest('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        if (!navScope) {
                            // Not in nav scope: just hide the anchor itself (don’t remove containers).
                            a.style.display = 'none';
                            a.style.visibility = 'hidden';
                            a.style.pointerEvents = 'none';
                            return;
                        }
                        // Prefer removing the li or the anchor itself inside nav
                        const li = a.closest('li[role="presentation"], li');
                        if (li) {
                            li.remove();
                        } else {
                            a.remove();
                        }
                    } catch {}
                }

                function removeAnswersIcon(svg) {
                    try {
                        const navScope = svg.closest && svg.closest('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        if (!navScope) return;
                        const a = svg.closest('a');
                        if (a) {
                            removeAnswersAnchor(a);
                        } else {
                            svg.remove();
                        }
                    } catch {}
                }

                function removeAnswersTextNodes(scopeRoot) {
                    try {
                        // Only look inside nav scopes
                        const scopes = scopeRoot.querySelectorAll('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        for (let s = 0; s < scopes.length; s++) {
                            const scope = scopes[s];
                            // Check common clickable containers inside nav
                            const items = scope.querySelectorAll('a, button, li[role="presentation"], li, span, div');
                            for (let i = 0; i < items.length; i++) {
                                const el = items[i];
                                const t = (el.textContent || '').trim();
                                if (!t) continue;
                                if (/(^|\s)answers(\s|$)/i.test(t)) {
                                    // Remove small containers only (a/li/button or faceplate-tracker), not generic divs.
                                    const anchor = el.closest('a, button');
                                    if (anchor) {
                                        removeAnswersAnchor(anchor.tagName === 'A' ? anchor : anchor.closest('a') || anchor);
                                        continue;
                                    }
                                    const li = el.closest('li[role="presentation"], li');
                                    if (li) { li.remove(); continue; }
                                    const fpt = el.closest('faceplate-tracker');
                                    if (fpt) { fpt.remove(); continue; }
                                    // As a last resort inside nav, hide the element
                                    el.style.display = 'none';
                                    el.style.visibility = 'hidden';
                                    el.style.pointerEvents = 'none';
                                }
                            }
                        }
                    } catch {}
                }

                function removeAnswersIn(root) {
                    try {
                        if (!root || !root.querySelectorAll) return;

                        // Direct hrefs — any scope, but removal is restricted to nav
                        const anchors = root.querySelectorAll('a[href="/answers"], a[href="/answers/"], a[href^="/answers"]');
                        for (let i = 0; i < anchors.length; i++) removeAnswersAnchor(anchors[i]);

                        // Aria labels — restrict to nav
                        const aria = root.querySelectorAll('a[aria-label="Answers"], a[aria-label*="Answers" i]');
                        for (let i = 0; i < aria.length; i++) removeAnswersAnchor(aria[i]);

                        // Icons — restrict to nav
                        const icons = root.querySelectorAll('svg[icon-name="answers-outline"]');
                        for (let i = 0; i < icons.length; i++) removeAnswersIcon(icons[i]);

                        // Text matches in nav scopes only
                        removeAnswersTextNodes(root);
                    } catch {}
                }

                // Expose a callable for the content world to nudge cleanup at will
                try {
                    window.__nrRemoveAnswersIn_forAnswers = function(root) {
                        try { removeAnswersIn(root || document); } catch {}
                    };
                } catch {}

                // Targeted initial sweep: only known nav/header/aside + common shells (avoid queryAll '*')
                (function targetedInitialSweep() {
                  try {
                    removeAnswersIn(document);
                    // Include reddit-sidebar-nav and the left sidebar container so we sweep/observe their ShadowRoots
                    const seeds = document.querySelectorAll(
                      'nav, header, aside, [role="navigation"], ' +
                      'faceplate-tracker[source="nav"], ' +
                      'shreddit-app, faceplate-tracker, shreddit-feed, ' +
                      'reddit-sidebar-nav, #left-sidebar-container, flex-left-nav-container#left-sidebar-container'
                    );
                    const max = Math.min(seeds.length, 160);
                    for (let i = 0; i < max; i++) {
                      const el = seeds[i];
                      if (el && el.shadowRoot) {
                        removeAnswersIn(el.shadowRoot);
                        try {
                          const mo = new MutationObserver(() => removeAnswersIn(el.shadowRoot));
                          mo.observe(el.shadowRoot, { childList: true, subtree: true });
                          addObs(mo);
                        } catch {}
                      }
                    }
                  } catch {}
                })();

                // Observe for nav containers appearing later
                (function observeNavs() {
                  try {
                    const WATCH_SEL =
                      'nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"], ' +
                      'reddit-sidebar-nav, #left-sidebar-container, flex-left-nav-container#left-sidebar-container';

                    const observeOne = (nav) => {
                      if (!nav || nav.__nrAnswersObserved) return;
                      nav.__nrAnswersObserved = true;
                      removeAnswersIn(nav);

                      // If this nav has a ShadowRoot, observe within it too
                      if (nav.shadowRoot) {
                        try {
                          removeAnswersIn(nav.shadowRoot);
                          const moShadow = new MutationObserver(() => removeAnswersIn(nav.shadowRoot));
                          moShadow.observe(nav.shadowRoot, { childList: true, subtree: true });
                          addObs(moShadow);
                        } catch {}
                      }

                      // Observe the element itself for children/subtree changes
                      try {
                        const mo = new MutationObserver(() => removeAnswersIn(nav));
                        mo.observe(nav, { childList: true, subtree: true });
                        addObs(mo);
                      } catch {}
                    };

                    // Observe all current targets (incl. reddit-sidebar-nav)
                    document.querySelectorAll(WATCH_SEL).forEach(observeOne);

                    // Doc-level observer for future mounts
                    const docMo = new MutationObserver(muts => {
                      for (let i = 0; i < muts.length; i++) {
                        const m = muts[i];
                        for (let j = 0; j < m.addedNodes.length; j++) {
                          const n = m.addedNodes[j];
                          if (n && n.nodeType === 1) {
                            if (n.matches?.(WATCH_SEL)) {
                              observeOne(n);
                            } else if (n.querySelector) {
                              const late = n.querySelector(WATCH_SEL);
                              if (late) observeOne(late);
                            }
                          }
                        }
                      }
                    });
                    docMo.observe(document.documentElement, { childList: true, subtree: true });
                    addObs(docMo);
                  } catch {}
                })();

                // Hook attachShadow so future ShadowRoots are cleaned automatically
                (function hookAttachShadow() {
                    try {
                        const proto = Element.prototype;
                        if (proto.__nrAttachShadowHooked) return;
                        const orig = proto.attachShadow;
                        if (!orig) return;
                        proto.__nrAttachShadowHooked = true;

                        proto.attachShadow = function(init) {
                            const root = orig.call(this, init);
                            try {
                                removeAnswersIn(root);
                                const mo = new MutationObserver(() => removeAnswersIn(root));
                                mo.observe(root, { childList: true, subtree: true });
                                addObs(mo);
                            } catch {}
                            return root;
                        };
                    } catch {}
                })();

                // Short early burst (reduced to 15 iterations) to catch initial mounts
                (function shortBurst() {
                    let count = 0;
                    const id = setInterval(() => {
                        try { removeAnswersIn(document); } catch {}
                        if (++count >= 15) clearInterval(id);
                    }, 100);
                })();

                // Cleanup on navigation
                window.addEventListener('pagehide', disconnectAll, { once: true });
                window.addEventListener('beforeunload', disconnectAll, { once: true });

                // Initial sweep
                try { removeAnswersIn(document); } catch {}
            });

            PAGE_WORLD_HOOKED = true;
        } catch {}
    })();

    // --- IMMEDIATE PRE-HIDING CSS (Applied before any content loads) ---
    function addPreHidingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Hide ALL posts immediately until approved */
            article:not(.reddit-approved),
            shreddit-post:not(.reddit-approved),
            [subreddit-prefixed-name]:not(.reddit-approved) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Show only approved content */
            article.reddit-approved,
            shreddit-post.reddit-approved,
            [subreddit-prefixed-name].reddit-approved {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            /* Click-through guarantee: if current post was previously approved in a feed, don't prehide on its comments page */
            html.nr-allow-current-post article,
            html.nr-allow-current-post shreddit-post,
            html.nr-allow-current-post [subreddit-prefixed-name],
            body.nr-allow-current-post article,
            body.nr-allow-current-post shreddit-post,
            body.nr-allow-current-post [subreddit-prefixed-name] {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            /* Hide search dropdown items until filtered */
            li[role="presentation"]:not(.reddit-search-approved),
            div[role="presentation"]:not(.reddit-search-approved),
            li[data-testid="search-sdui-query-autocomplete"]:not(.reddit-search-approved),
            li.recent-search-item:not(.reddit-search-approved),
            a[role="option"]:not(.reddit-search-approved),
            div[data-testid="search-dropdown-item"]:not(.reddit-search-approved) {
                display: none !important;
                visibility: hidden !important;
            }
            
            /* Hide community suggestions permanently */
            reddit-recent-pages,
            shreddit-recent-communities,
            div[data-testid="community-list"],
            [data-testid="recent-communities"],
            .recent-communities,
            community-highlight-carousel {
                display: none !important;
            }
            
            /* Hide Answers BETA button - Simplified selectors */
            a[href="/answers/"],
            a[href^="/answers"],
            faceplate-tracker[noun="gen_guides_sidebar"],
            span:contains("BETA"),
            span:contains("Answers BETA"),
            a[href="/answers/"],
            .flex.justify-between.relative.px-md.gap-\\[0\\.5rem\\].text-secondary.hover\\:text-secondary-hover.active\\:bg-interactive-pressed.hover\\:bg-neutral-background-hover.hover\\:no-underline.cursor-pointer.py-2xs.-outline-offset-1.s\\:rounded-2.bg-transparent.no-underline,
            .flex.justify-between.relative.px-md.gap-\\[0\\.5rem\\],
            span.text-global-admin.font-semibold.text-12:contains("BETA"),
            span.text-global-admin.font-semibold.text-12:contains("Answers BETA"),
            svg[icon-name="answers-outline"],
            .text-14 > div.flex.gap-xs.items-baseline,
            span:contains("Answers"),
            *[href="/answers/"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
            }
            
            /* Hide by class for Answers button */
            .reddit-answers-hidden {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
            }
            
            /* Banned content - permanent hiding */
            .reddit-banned {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* Specific prehiding classes for banned content */
            article.prehide, shreddit-post.prehide, [subreddit-prefixed-name].prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                pointer-events: none !important;
            }
            
            /* Search dropdown hiding */
            .reddit-search-item-prehide, .reddit-search-shadow-prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Hide potentially NSFW thumbnails until approved */
            article:not(.reddit-approved) img, 
            shreddit-post:not(.reddit-approved) img,
            [subreddit-prefixed-name]:not(.reddit-approved) img {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            article.reddit-approved img, 
            shreddit-post.reddit-approved img,
            [subreddit-prefixed-name].reddit-approved img {
                visibility: visible !important;
                opacity: 1 !important;
            }
        `;
        
        // Inject style at the earliest possible moment
        try {
            // Create and inject before DOM is ready for fastest application
            const head = document.head || document.documentElement;
            head.insertBefore(style, head.firstChild);
        } catch (e) {
            // Fallback: wait for document ready and try again
            document.addEventListener('DOMContentLoaded', function() {
                (document.head || document.documentElement).appendChild(style);
            });
        }
    }

    // Apply CSS immediately before any other code runs
    addPreHidingCSS();

    // Apply click-through allow marker ASAP for comments pages
    try {
        if (ALWAYS_ALLOW_CURRENT_POST) {
            // add to html immediately (body may not exist yet)
            document.documentElement.classList.add('nr-allow-current-post');
            // ensure body also gets the class when ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    try { document.body && document.body.classList.add('nr-allow-current-post'); } catch {}
                });
            } else {
                try { document.body && document.body.classList.add('nr-allow-current-post'); } catch {}
            }
        }
    } catch {}

    // --- CSS PRE-HIDING for posts ---
    const style = document.createElement('style');
    style.textContent = `
        article.prehide, shreddit-post.prehide {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: none !important;
        }
        body.reddit-filter-ready article:not(.prehide),
        body.reddit-filter-ready shreddit-post:not(.prehide) {
            visibility: visible !important;
            opacity: 1 !important;
        }
        reddit-recent-pages,
        shreddit-recent-communities,
        div[data-testid="community-list"],
        [data-testid="recent-communities"],
        .recent-communities {
            display: none !important;
        }
    `;
    document.documentElement.appendChild(style);

    // --- PREFERENCES REDIRECT ---
    function checkAndRedirectFromPreferences() {
        if (window.location.href.includes('reddit.com/settings/preferences')) {
            window.location.href = 'https://www.reddit.com/settings/';
        }
    }

    checkAndRedirectFromPreferences();

    const allowedUrls = [
        "https://www.reddit.com/user/NightmaREE3Z/"
    ];

    const safeSubreddits = [
        "r/AmItheAsshole",
        "r/AmItheButtface",
        "r/AskReddit",
        "r/DimensionJumping",
        "r/BestofRedditorUpdates",
        "r/Glitch_in_the_Matrix",
        "r/niceguys",
        "r/nicegirls",
        "r/ChatGPT",
        "r/ChatGPTcomplaints",
    ];

    const keywordsToHide = [
        "porn", "nude", "Alexa", "penetration", "naked", "xxx", "rule34", "r34", "r_34", "rule 34", "got hard", "get hard", "Vince Russo", "Dave Meltzer",
        "deepnude", "nudify", "nudifier", "nudifying", "nudity", "undress", "undressing", "undressifying", "undressify", "getdisciplined", "Mariah",
        "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley", "Cameron", "Hayter", "Britt Baker", "Ripley", "Rhea Ripley", "Mariah May", "Blake",
        "transv", "transvestite", "queer", "LGBT", "LGBTQ", "Pride", "Jessika Carr", "Carr"," Jessica Carr", "Jessika Karr", "Jessika", "sexy", "Monroe",
        "prostitute", "escort", "fetish", "adult", "erotic", "explicit", "mature", "blowjob", "sexual", "Jessica", "Jessica Karr", "Analsex", "orgasm",
        "vagina", "pussy", "tushy", "tushi", "genital", "vagena", "booty", "derriere", "busty", "slut", "Karr", "CJ Lana", "raped", "orga5m", "org@sm", 
        "whore", "camgirl", "celeb", "cumslut", "Tiffany Stratton", "Lillian", "Garcia", "Jordynne", "Trish", "Stratus", "Lana Del Rey", "orga$m", "0rg@sm", 
        "DeepSeek", "DeepSeek AI", "nudyi", "ai app", "onlyfans", "fantime", "fansly", "justforfans", "patreon", "CJ Perry", "Lana Perry", "orga5m", "org@5m", 
        "manyvids", "chaturbate", "myfreecams", "cam4", "fat fetish", "camsoda", "stripchat", "bongacams", "livejasmin", "Mandy", "0rgasm", "org@sm", "0rga$m",
        "woman", "women", "Liv Xoxo", "Xoxo", "Chelsey", "Chelsea", "Piper Niven", "Hardwell", "Del Rey", "Del Ray", "breast", "5 feet of fury", "0rg@5m",
        "amateur", "alexa", "bliss", "alexa bliss", "her ass", "she ass", "her's ass", "hers ass", "venice", "Alexa", "Morgan Xoxo", "poses", "posing", "girl",
        "Tiffany Stratton", "Tiffy time", "Stratton", "Tiffany", "Mandy Rose", "Chelsea Green", "Zelina", "Zelina Vega", "Valhalla", "vagene", "Sportskeeda",
        "IYO SKY", "Io Shirai", "Iyo Shirai", "IO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Meiko", "Satomura", "playboy", "Dynamite", "jizz", "woman",
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge", "jizzed", "Torrie", "Sasha", 
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina", "Melina wrestler", "Jillian Hall", "five feet of fury", "Rampage", "raepd", "Wilson", "women",
        "Mickie James", "Maria", "Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess", "Rampaige", "breasts", "Liv Xoxo",
        "Madison Rayne", "Velvet Sky", "Angelina", "filmora", "wondershare", "Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX", "Sweeney", "Mickie", "Mercedes",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Vaquer", "Vaqueer", "Vaguer", "Vagueer", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", 
        "Nightingale", "Statlander", "Hikaru Shida", "Riho", "Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", "Fatal Influence", "Aubert", "*ape", "Brooke", "Hikaru", "Roxanne", 
        "Penelope", "Shotzi", "Blackheart", "Tegan", "Charlotte", "Kamifuku", "Charlotte", "Sarray", "Xia Li", "OperaGX", "Sky Wrestling", "steph", "r*pe", "Opera Browser", 
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Alicia", "Atout", "stephanie", "ra*e", "nofap", "No nut",
        "Stephanie", "Thekla", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Renee", "rap*", "Sasha Banks", 
        "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Izzi Dame", "Alba Fyre", "Isla Dawn", "Tamina", "Sydney", "Gina Adams", "Kelly2", "Russo", 
        "Raquel Rodriguez", "Scarlett", "Bordeaux", "Kayden", "Carter", "Katana Chance", "Valkyria", "Tamina Snuka", "Renee Young", "Sydney Sweeney", "Priscilla", "Cathalina",
        "Roxanne Perez", "Indi Hartwell", "Hartwell", "Blair", "Davenport", "wonder share", "Lola Vice", "Maxxine Dupri", "Karmen", "Karmen Petrovic", "Brittany", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum", "Paxley", "Fallon Henley", "Sky wrestle", "Women's", "Women", "venoisi",  "rawdog", "rawdogging", 
        "Kelani Jordan", "Electra", "Wendy Choo", "Yulisa", "Valentina", "Valentine", "Amari Miller", "Woman", "Lady", "Girls", "Girl's", "venoise", "AlexaBliss", "Cathy", "Kathy",
        "Sol Ruca", "lexi", "AlexaPearl", "Arianna", "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW", "Woman's", "Lady's", "Girl's", "HorizonMW", "Horizon MW",
        "Horizon Modern Warfare", "HorizonModern", "HorizonWarfare", "Horizon ModernWarfare", "Diffusion", "StableDiffusion", "UnStableDiffusion", "Dreambooth", "Dream booth", "comfyui",
        "sperm", "boyfriend", "girlfriend", "AI generated", "AI-generated", "generated", "artificial intelligence", "machine learning", "neural network", "deep learning", "Jazmyn Nyx",
        "Kazuki", "Midjourney", "stable diffusion", "artificial", "synthetic", "computer generated", "algorithm", "automated", "text to image", "Answers BETA", "Birppis", "AI girl", "Juliana",
        "Saya Kamitani", "Kamitani", "Katie", "Nikkita", "Nikkita Lyons", "Lisa Marie", "Lisa Marie Varon", "Lisa Varon", "Marie Varon", "Irving", "Naomi", "Belts Mone", "Amanda Huber", 
    ];

    const redgifsKeyword = "www.redgifs.com";

    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro", "r/AlexaBliss", "r/AlexaPearl", "r/comfyui"
    ];

    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i,
        /morph/i, /inpaint/i, /art intel/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /\bbra\b/i, /soulgen/i, /ismartta/i, /editor/i, /image enhanced/i, /image enhancing/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /Blis/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhanced image/i,
        /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i,
        /vegi/i, /vege/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i,
        /Tiffa/i, /Strat/i, /puz/i, /Sweee/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /\bSlut\b/i, /3dit/i, /ed1t/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bAi\b/i,
        /Sydney Sweeney/i, /Sweeney/i, /fap/i, /GenHey/i, /Sydnee/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bedit\b/i, /Feikki/i,
        /\bAnall\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i, /\bHer\b/i, /\bShe\b/i, /\bADMX\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /Amber/i, /\bAi-\b/i, /\bAi\b/i,
        /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /Valtez/i, /\bLiv\b/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /Chel5/i, /\bTay\b/i, /\balexa\b/i, /\bazz\b/i, /\bjaida\b/i, /Steph/i, /St3ph/i, /editation/i, /3d!7/i, 
        /P4IG3/i, /Paig3/i, /P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /Lana Del Rey/i, /\bLana\b/i, /image app/i, /edi7/i, /syvavaarennos/i, /boy friend/i, /photo app/i,
        /Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /picture app/i, /edit app/i, /pic app/i, /syvävääre/i, /girl friend/i, 
        /pillu/i, /perse/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /\bPeba\b/i, /\bBeba\b/i, /\bBabe\b/i, /\bBepa\b/i, /\bAnaali\b/i, /\bAnus\b/i, /sexuaali/i, /\bSeksi\b/i, /yhdyntä/i, /\bGina\b/i,
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i, /seksi/i,
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /seksi kuvia/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synth/i,
        /Margot/i, /Robbie/i, /Johansson/i, /Ana de Armas/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /panee/i, /panev/i,
        /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimis/i, /Stratusfaction/i, /yhdynnässä/i, /seksivideo/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i,
        /pano kuva/i, /panokuvat/i, /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpi/i,
        /sormetus/i, /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkky/i, 
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuissivusto/i, /homo/i, /lesbo/i, /transu/i, /pervo/i, /5yvä/i, /\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /face plus/i,  /face\+/i, /face+/i, /face\-/i,
        /bg remover/i, /lexi/i, /\bMina\b/i, /Shir/i, /kawa/i, /perver/i, /Mariah/i, /\bAva\b/i, /\bAnal-\b/i, /\b-Anal\b/i, /\bAnal\b/i, /\bCum\b/i, /\bNox\b/i, /\bButt\b/i, /\bNiven\b/i, /\bODB\b/i,
        /\bAnswers BETA\b/i, /\bFuku\b/i, /\bDick\b/i, /\bCock\b/i, /\bCock\b/i, /\bRape\b/i, /\bEmma\b/i, /\bIndi\b/i, /\bTegan\b/i, /\bGirl\b/i, /\bPenis\b/i, /\bLady\b/i, /\bAnus\b/i, /\bNSFW\b/i, 
        /\bsex\b/i, /\bAdult\b/i, /\bB-Fab\b/i, /Elayna/i, /Eleyna/i, /Eliyna/i, /Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elina/i, /Elyna/i, /Elyina/i, /Aikusviihde/i, /Aikus viihde/i, /La Primare/i,
        /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i,  /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, /La Premare/i,
        /topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, /softorbit/i, /softorbits/i, /soft-orbit/i, 
        /\bLita\b/i, /soft-orbits/i, /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper-v/i,
        /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper-v/i, /hyper v/i, /\bLilly\b/i, 
        /\*/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, 
        /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i, /\bLili\b/i,
        /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /virtmachine/i, /virt-machine/i, /virtumachine/i, /vir mach/i,
        /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, /\bMachiene\b/i, /vi mach/i, /virtual machi/i, /\bLily\b/i,
        /virtuaali masiina/i, /virtuaalimasiina/i,  /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /virtuaali masiina/i, /\bLili\b/i,
        /Cathy/i, /Kathy/i, /Katherine/i, /Kazuki/i, /Kathy/i, /Yoshiko/i, /Yoshihiko/i, /Hirata/i, /birppis/i, /irpp4/i, /b1rppis/i, /birpp1s/i, /b1rpp1s/i, /comfyui/i, /Lily Adam/i, /Lilly Adam/i, /Dualipa/i,
        /comfy ui/i, /comfy ai/i, /comfyai/i, /comfy-ui/i, /comfy-ai/i, /comfy-ai/i, /Becky/i, /Becki/i, /Rebecca/i, /Amber Heard/i, /girlfriend/i, /boyfriend/i, /mid journey/i, /unstable diffusion/i, /Dua Lipa/i, 
        /AI[ -]?generated/i, /generated[ -]?by[ -]?AI/i, /artificial[ -]?intelligence/i, /machine[ -]?learning/i, /neural[ -]?network/i, /deep[ -]?learning/i, /midjourney/i, /dall[ -]?e/i, /stable[ -]?diffusion/i,
        /computer[ -]?generated/i, /text[ -]?to[ -]?image/i, /image[ -]?generation/i, /AI[ -]?art/i, /synthetic[ -]?media/i, /algorithmically/i, /bot[ -]?generated/i, /automated[ -]?content/i, /stablediffused/i, 
        /Hirada/i, /Hirata/i, /Mizubi/i, /Mizupi/i, /Mizuki/i, /Watanabe/i, /Watanaba/i, /Wakana/i, /Kana Urai/i, /Uehara/i, /Uehara/i, /jazmyn/i, /Jazmin/i, /Jasmin/i, /Jasmyn/i, /\bNyx\b/i, /Primera/i, /Sherilyn/i,
        /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /rasikangas/i, /rasikannas/i, /\bJade\b/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i, /barlow/i, /Nikki/i, /HeyGen/i, 
        /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, /Alici/i,
        /headgen/i, /head gen/i, /genhead/i, /genhead/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /Nia Jax/i, /McQueen/i, /Kasie Cay/i, 
	/Mafiaprinsessa/i, /ai twerk/i, /twerk ai/i, /mangoanimat/i, /photo jiggle/i, /animat pic/i, /animat pho/i, /ai-app/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /animat ima/i, /animat pic/i, 
	/animat pho/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /img animat/i, /ima animat/i, /photo animat/i, /image animat/i, /make pic mov/i, /make pho mov/i, /make img mov/i, /make ima mov/i, 
	/gif pic/i, /gif pho/i, /gif img/i, /gif ima/i, /photo to gif/i, /image to gif/i, /pic to gif/i, /pic to vid/i, /photo to video/i, /image to video/i, /ph0t/i, /pho7/i, /ph07/i, /1m4g/i, /im4g/i, /1mag/i, 
	/!mag/i, /!m4g/i, /!mg/i, /v1d3/i, /vid3/i, /v1de/i, /vld3/i, /v1d3/i, /g!f/i, /mangoai/i, /mangoapp/i, /mango-app/i,  /mangoai/i, /mangoapp/i, /mango-app/i, /ai-app/i, /mangoanim/i, /mango anim/i, /mango-anim/i,
	/lantaai/i, /lantaaa/i, /motionai/i, /changemotion/i, /swapmotion/i, /motionsw/i, /motionc/i, /\bmotion\b/i, /poseai/i, /ai-/i, /-ai/i, /AIblow/i, /5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, 
	/AI-suck/i, /drool/i, /RemovingAI/i, /blowjob/i, /bjob/i, /b-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /dr00l/i, /BJAI/i, /BJ-AI/i, /BJ0b/i, /BJob/i, /B-J0b/i, /B-Job/i, /Suckjob/i, /Suckj0b/i, 
	/Suck-job/i, /Suck-j0b/i, /Mouthjob/i, /Mouthj0b/i, /M0uthjob/i, /M0uthj0b/i, /Mouth-job/i, /Mouth-j0b/i, /M0uth-job/i, /M0uth/i, /M0u7h/i, /Mou7h/i, /MouthAI/i, /MouthinAI/i, /MouthingAI/i, /AIMouth/i, /BlowAI/i, 
	/AIBlow/i, /BlowsAI/i, /BlowingAI/i, /JobAI/i, /AIJob/i, /Mouthig/i,
    ];

    // Extra tolerant variant for the name (Maria vs Marie)
    try { regexKeywordsToHide.push(/Lisa Mar(?:ie|ia) Varon/i); } catch {}

    const unifiedSelectors = [
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-weak",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-weak",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader",
        ".\\32 xs.gap.items-center.flex",
        ".mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        ".row-end-2.row-start-1.col-end-3.col-start-1 > .mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        'span.text-global-admin.font-semibold.text-12'
    ];

    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel"
    ];

    // Simplified and more effective Answers button selectors
    const answersButtonSelectors = [
        'a[href="/answers/"]',
        'a[href^="/answers"]',
        'faceplate-tracker[noun="gen_guides_sidebar"]',
        'span.text-global-admin.font-semibold.text-12'
    ];

    // --- OPTIMIZED MEMORY MANAGEMENT ---
    // Firefox doesn't expose performance.memory in stable; use stricter caps + hibernation heuristics.
    const MEMORY_CAP_GB = IS_FIREFOX ? 3.5 : 6;         // tighter cap on FF
    const MEMORY_WARNING_GB = IS_FIREFOX ? 2.2 : 3;
    const MAX_CACHE_SIZE = IS_FIREFOX ? 30 : 50;         // smaller caches on FF
    const MAX_APPROVAL_PERSISTENCE = IS_FIREFOX ? 30 : 40;
    const CLEANUP_INTERVAL = IS_FIREFOX ? 7000 : 10000;  // prune a bit more often on FF
    const MEMORY_CHECK_INTERVAL = 4000;                  // frequent checks help hibernation
    const CRITICAL_MEMORY_THRESHOLD = 0.65;              // 65% of heap limit

    // Lightweight caches - minimal memory footprint with WeakSet/WeakMap for automatic cleanup
    const processedElements = new WeakSet();
    const processedSearchItems = new WeakSet();
    const bannedSubredditCache = new Map();
    const contentBannedCache = new Map();
    const shadowRootsProcessed = new WeakSet();
    const permanentlyApprovedElements = new WeakSet();
    const approvalPersistence = new Map();
    const eventListenersAdded = new WeakSet();

    // Tracking for cleanup with automatic disposal
    const intervalIds = new Set();
    const observerInstances = new Set();
    const mutationObservers = new WeakMap();

    // ensure single observer per ShadowRoot and auto-disconnect later
    const shadowRootObservers = new WeakMap();

    let lastFilterTime = 0;
    let pendingOperations = false;
    let memoryCleanupCount = 0;
    let lastMemoryWarning = 0;
    let isCleaningUp = false;

    // Memory monitoring (Chrome returns values; FF returns null)
    function getMemoryUsage() {
        if (performance.memory) {
            const memInfo = performance.memory;
            const usedGB = memInfo.usedJSHeapSize / (1024 * 1024 * 1024);
            const limitGB = memInfo.jsHeapSizeLimit / (1024 * 1024 * 1024);
            const percentage = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
            
            return {
                usedGB: Math.round(usedGB * 100) / 100,
                limitGB: Math.round(limitGB * 100) / 100,
                percentage: Math.round(percentage * 100),
                usedMB: Math.round(memInfo.usedJSHeapSize / (1024 * 1024)),
                limitMB: Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024))
            };
        }
        return null;
    }

    // Enhanced cache cleanup with better memory leak prevention
    function cleanupCaches(force = false) {
        if (isCleaningUp) return;
        isCleaningUp = true;
        
        try {
            const memInfo = getMemoryUsage();
            const isOverCap = memInfo ? memInfo.usedGB > MEMORY_CAP_GB : false;
            const isWarning = memInfo ? memInfo.usedGB > MEMORY_WARNING_GB : false;
            const isCritical = memInfo ? (memInfo.usedMB / memInfo.limitMB) > CRITICAL_MEMORY_THRESHOLD : false;
            
            if (force || isOverCap || isCritical) {
                const beforeContent = contentBannedCache.size;
                const beforeSubreddit = bannedSubredditCache.size;
                const beforeApproval = approvalPersistence.size;
                
                contentBannedCache.clear();
                bannedSubredditCache.clear();

                // Keep only last few approvals when critical
                const keep = IS_FIREFOX ? 8 : 10;
                if (isCritical || isOverCap) {
                    const entries = Array.from(approvalPersistence.entries()).slice(-keep);
                    approvalPersistence.clear();
                    entries.forEach(([key, value]) => approvalPersistence.set(key, value));
                }
                
                // Clean up any stale observers
                observerInstances.forEach(observer => {
                    try { if (observer && typeof observer.disconnect === 'function') observer.disconnect(); } catch {}
                });
                observerInstances.clear();
                HEAVY_OBSERVERS_ACTIVE = false; // we'll reattach lazily

                if (memInfo) {
                    devLog(`🧹 MEMORY CAP CLEANUP - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB | Cleared: Content(${beforeContent}), Subreddit(${beforeSubreddit}), Approval(${beforeApproval}→${approvalPersistence.size})`);
                }
                
            } else if (isWarning || contentBannedCache.size > MAX_CACHE_SIZE || bannedSubredditCache.size > MAX_CACHE_SIZE) {
                if (contentBannedCache.size > MAX_CACHE_SIZE) {
                    const entries = Array.from(contentBannedCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
                    contentBannedCache.clear();
                    entries.forEach(([key, value]) => contentBannedCache.set(key, value));
                }
                if (bannedSubredditCache.size > MAX_CACHE_SIZE) {
                    const entries = Array.from(bannedSubredditCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
                    bannedSubredditCache.clear();
                    entries.forEach(([key, value]) => bannedSubredditCache.set(key, value));
                }
                if (approvalPersistence.size > MAX_APPROVAL_PERSISTENCE) {
                    const entries = Array.from(approvalPersistence.entries()).slice(-Math.floor(MAX_APPROVAL_PERSISTENCE * 0.7));
                    approvalPersistence.clear();
                    entries.forEach(([key, value]) => approvalPersistence.set(key, value));
                }
                
                if (memInfo) {
                    devLog(`🧹 Gentle cleanup - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB (${memInfo.percentage}%)`);
                }
            }

            memoryCleanupCount++;
            
            // Force garbage collection only when necessary (dev/automation builds)
            if (window.gc && (force || isOverCap || (IS_FIREFOX && memoryCleanupCount % 2 === 0))) {
                try {
                    window.gc();
                    const afterMemInfo = getMemoryUsage();
                    if (afterMemInfo && memInfo) {
                        devLog(`🗑️ GC - Memory: ${afterMemInfo.usedGB}GB (was ${memInfo.usedGB}GB)`);
                    }
                } catch {}
            }
        } finally {
            isCleaningUp = false;
        }
    }

    // Hibernation: detach heavy observers during memory pressure or when tab is hidden.
    function suspendHeavyObservers() {
        if (!HEAVY_OBSERVERS_ACTIVE) return;
        try {
            observerInstances.forEach(mo => { try { mo.disconnect(); } catch {} });
            observerInstances.clear();
            HEAVY_OBSERVERS_ACTIVE = false;
            devLog('🛌 Observers hibernated');
        } catch {}
    }

    function attachMainObservers() {
        try {
            // Main DOM observer for new content
            const observer = new MutationObserver(processNewElements);
            observerInstances.add(observer);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });

            // Detach observer to clean shadow-root observers on subtree removals
            const domDetachObserver = new MutationObserver((muts) => {
                for (let i = 0; i < muts.length; i++) {
                    const m = muts[i];
                    if (m.removedNodes && m.removedNodes.length) {
                        const maxRemoved = Math.min(m.removedNodes.length, 50);
                        for (let j = 0; j < maxRemoved; j++) {
                            const n = m.removedNodes[j];
                            if (n && n.nodeType === 1) {
                                disconnectShadowObserversInSubtree(n, 0);
                            }
                        }
                    }
                }
            });
            observerInstances.add(domDetachObserver);
            domDetachObserver.observe(document.documentElement, { childList: true, subtree: true });

            HEAVY_OBSERVERS_ACTIVE = true;
        } catch {}
    }

    function resumeHeavyObservers() {
        if (HEAVY_OBSERVERS_ACTIVE) return;
        try {
            attachMainObservers();
            // Re-arm search dropdown observers that may have been disconnected
            observeSearchDropdown(true);
            HEAVY_OBSERVERS_ACTIVE = true;
            devLog('🌙 Observers resumed');
        } catch {}
    }

    // Memory pressure monitoring optimized for stability
    function monitorMemoryPressure() {
        const memInfo = getMemoryUsage();
        // On Firefox memInfo is usually null. Use visibility + elapsed time heuristics to keep things light.
        const now = Date.now();

        if (memInfo) {
            const pct = (memInfo.usedMB / memInfo.limitMB);
            if (memInfo.usedGB > MEMORY_CAP_GB || pct > CRITICAL_MEMORY_THRESHOLD) {
                if (now - lastMemoryWarning > 4000) {
                    devLog(`🚨 memory pressure: ${memInfo.usedGB}GB (${Math.round(pct*100)}%) — hibernating observers`);
                    lastMemoryWarning = now;
                }
                cleanupCaches(true);
                suspendHeavyObservers();
                return;
            }
        } else if (IS_FIREFOX) {
            // Heuristic: after the first 20 seconds, if tab is hidden or we've been running long, hibernate briefly
            if (document.visibilityState === 'hidden') {
                suspendHeavyObservers();
                return;
            }
        }

        if (document.visibilityState === 'visible' && !HEAVY_OBSERVERS_ACTIVE) {
            resumeHeavyObservers();
        }
    }

    // Enhanced global cleanup function
    function cleanup() {
        devLog('🧹 Performing cleanup...');
        
        // Clear all intervals
        intervalIds.forEach(id => {
            try { clearInterval(id); } catch {}
        });
        intervalIds.clear();

        // Disconnect all observers
        observerInstances.forEach(observer => {
            try { if (observer && typeof observer.disconnect === 'function') observer.disconnect(); } catch {}
        });
        observerInstances.clear();
        HEAVY_OBSERVERS_ACTIVE = false;

        // Force cache cleanup
        cleanupCaches(true);
        
        const memInfo = getMemoryUsage();
        if (memInfo) {
            devLog(`🧹 Cleanup completed - Memory: ${memInfo.usedGB}GB`);
        }
    }

    // Enhanced page visibility cleanup + hibernation
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cleanupCaches();
            suspendHeavyObservers();
        } else {
            resumeHeavyObservers();
            runAllChecks();
        }
    });

    // Enhanced cleanup before page unload
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    // Check if we're on a single post page (not feed or subreddit)
    function isPostPage() {
        const url = window.location.href;
        return url.includes('/comments/') && !url.includes('/s/') && !url.includes('?') && url.split('/').length >= 7;
    }

    // --- SIMPLIFIED ANSWERS BUTTON HIDING FUNCTIONS ---
    function hideAnswersButton() {
        // Ask the page‑world hook to clean both light DOM and all ShadowRoots (nav-scoped)
        try { window.__nrRemoveAnswersIn_forAnswers && window.__nrRemoveAnswersIn_forAnswers(document); } catch {}

        // Method 1: Direct removal by href (most effective)
        try { document.querySelectorAll('a[href="/answers/"], a[href^="/answers"]').forEach(el => el.remove()); } catch {}

        // Method 2: Remove by faceplate-tracker
        try { document.querySelectorAll('faceplate-tracker[noun="gen_guides_sidebar"]').forEach(el => el.remove()); } catch {}

        // Method 3: Remove BETA spans and their parents
        try {
            document.querySelectorAll('span.text-global-admin.font-semibold.text-12').forEach(span => {
                if (span.textContent && span.textContent.trim() === 'BETA') {
                    const parent = span.closest('a, li, div, faceplate-tracker');
                    if (parent) parent.remove(); else span.remove();
                }
            });
        } catch {}

        // Method 4: Text-based removal for "Answers" + "BETA" — scoped to nav/header for performance
        try {
            const scopes = document.querySelectorAll('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
            const maxScopes = Math.min(scopes.length, 50);
            for (let s = 0; s < maxScopes; s++) {
                const scope = scopes[s];
                // Only scan leaf nodes inside scope — avoids scanning entire DOM
                const leaves = scope.querySelectorAll('*:not(:has(*))');
                const limit = Math.min(leaves.length, 500);
                for (let i = 0; i < limit; i++) {
                    const element = leaves[i];
                    const text = (element.textContent || '').trim();
                    if (!text) continue;
                    if ((text.includes('Answers') && text.includes('BETA')) || text === 'Answers BETA') {
                        const container = element.closest('a, li, div[class*="nav"], faceplate-tracker');
                        if (container) container.remove(); else element.remove();
                    }
                }
            }
        } catch {}

        // Method 5: CSS hide any stragglers
        try {
            document.querySelectorAll('a[href*="answers"], *[class*="answers"], *[data-testid*="answers"]').forEach(el => {
                el.classList.add('reddit-answers-hidden');
            });
        } catch {}
    }

    // Performance functions with memory monitoring
    function throttle(fn, wait) {
        let lastCall = 0;
        let requestId = null;
        
        return function(...args) {
            const now = performance.now();
            const context = this;
            
            if (now - lastCall >= wait) {
                lastCall = now;
                return fn.apply(context, args);
            } else if (!requestId) {
                requestId = (window.requestIdleCallback || window.requestAnimationFrame)(() => {
                    requestId = null;
                    lastCall = performance.now();
                    return fn.apply(context, args);
                });
            }
        };
    }

    function debounce(fn, wait, immediate = false) {
        let timeout;
        return function(...args) {
            const context = this;
            const callNow = immediate && !timeout;
            
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                timeout = null;
                if (!immediate) fn.apply(context, args);
            }, wait);
            
            if (callNow) return fn.apply(context, args);
        };
    }

    function batchProcess(fn) {
        if (pendingOperations) return;
        pendingOperations = true;
        
        requestAnimationFrame(() => {
            try {
                fn();
            } finally {
                pendingOperations = false;
            }
        });
    }

    // ENHANCED: Function to scan FULL post content - now with better extraction
    function extractCompletePostContent(element) {
        try {
            // Skip expensive operations for safe subreddits only when not strict
            if (!STRICT_BLOCKING && isElementInSafeSubreddit(element)) {
                devLog('✅ Safe subreddit - basic content extraction');
                const basicContent = element.textContent || element.innerText || '';
                return basicContent;
            }
            
            // Extract ALL available text from the element more thoroughly
            const allTextContent = [];
            
            // Method 1: main element text content
            const mainText = element.textContent || element.innerText || '';
            if (mainText.trim()) allTextContent.push(mainText);
            
            // Method 2: specific content from known selectors
            const contentSelectors = [
                // Titles
                'h1, h2, h3, h4, h5, h6',
                '[slot="title"]',
                '#post-title, [id*="post-title"]',
                '.title',
                'a[data-click-id="body"]',
                
                // Body
                '.md',
                '.md.feed-card-text-preview',
                '.md.text-14-scalable',
                '[slot="text-body"]',
                '[data-post-click-location="text-body"]',
                '.post-content',
                '.usertext-body',
                '.text-body',
                '.text-ellipsis',
                'p',
                'div[class*="text"]',
                'span[class*="text"]',
                
                // Reddit containers
                '[data-testid="post-content"]',
                '[about*="_"]',
                '[id*="post-rtjson-content"]',
                '.entry .usertext-body',
                
                // Accessibility
                'faceplate-screen-reader-content',
                '.line-clamp-3',
                '.line-clamp-6',
                '[aria-label]',
                '[title]'
            ];
            
            for (let i = 0; i < contentSelectors.length; i++) {
                const elements = element.querySelectorAll(contentSelectors[i]);
                for (let j = 0; j < elements.length; j++) {
                    const elem = elements[j];
                    let text = elem.textContent || elem.innerText || '';
                    
                    // Also check aria-label and title attributes
                    if (!text && elem.getAttribute) {
                        text = elem.getAttribute('aria-label') || elem.getAttribute('title') || '';
                    }
                    
                    if (text.trim() && text.length > 2) allTextContent.push(text);
                }
            }
            
            // Method 3: hrefs
            const links = element.querySelectorAll('a[href]');
            for (let i = 0; i < links.length; i++) {
                const href = links[i].getAttribute('href');
                if (href && href.includes('/comments/')) {
                    const linkText = links[i].textContent || links[i].innerText || '';
                    if (linkText.trim()) allTextContent.push(linkText);
                }
            }
            
            // Method 4: data attributes
            const dataAttributes = ['data-permalink', 'data-testid', 'aria-label', 'title', 'alt'];
            for (let i = 0; i < dataAttributes.length; i++) {
                const attr = dataAttributes[i];
                const value = element.getAttribute && element.getAttribute(attr);
                if (value && typeof value === 'string' && value.length > 2) allTextContent.push(value);
            }
            
            // Method 5: truncated content
            const truncatedElements = element.querySelectorAll('.text-ellipsis, .line-clamp-3, .line-clamp-6');
            for (let i = 0; i < truncatedElements.length; i++) {
                const elem = truncatedElements[i];
                const fullText = elem.textContent || elem.innerText || '';
                if (fullText.trim()) allTextContent.push(fullText);
            }
            
            const combinedContent = allTextContent.join(' ').trim();
            if (combinedContent.toLowerCase().includes('ai')) {
                devLog(`🔍 AI string present (first 200): "${combinedContent.substring(0, 200)}..."`);
            }
            devLog(`📄 Extracted content length: ${combinedContent.length}`);
            return combinedContent;
            
        } catch (error) {
            devLog(`❌ extractCompletePostContent error: ${error.message}`);
            // Fallback to basic text content
            return element.textContent || element.innerText || '';
        }
    }

    // ENHANCED: Text checking with improved keyword matching and debug logging
    function checkTextForKeywords(textContent) {
        if (!textContent) return false;
        
        // Normalize text for better matching
        const lowerText = textContent.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Check cache first
        if (contentBannedCache.has(lowerText)) {
            return contentBannedCache.get(lowerText);
        }
        
        // Prevent cache from growing too large
        if (contentBannedCache.size >= MAX_CACHE_SIZE) {
            const entries = Array.from(contentBannedCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
            contentBannedCache.clear();
            entries.forEach(([key, value]) => contentBannedCache.set(key, value));
        }
        
        // Exact keyword match + word boundary for very short tokens
        for (let i = 0; i < keywordsToHide.length; i++) {
            const keyword = keywordsToHide[i].toLowerCase();
            if (lowerText.includes(keyword)) {
                if (keyword.length <= 3) {
                    const wordBoundaryRegex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
                    if (wordBoundaryRegex.test(lowerText)) {
                        contentBannedCache.set(lowerText, true);
                        devLog(`🚫 Blocked by keyword: "${keywordsToHide[i]}"`);
                        return true;
                    }
                } else {
                    contentBannedCache.set(lowerText, true);
                    devLog(`🚫 Blocked by keyword: "${keywordsToHide[i]}"`);
                    return true;
                }
            }
        }
        
        // Regex patterns (now unlimited)
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerText)) {
                contentBannedCache.set(lowerText, true);
                devLog(`🚫 Blocked by regex: ${regexKeywordsToHide[i]}`);
                return true;
            }
        }
        
        contentBannedCache.set(lowerText, false);
        return false;
    }

    // Better post identifier that works across feed and post pages
    function getPostIdentifier(element) {
        // Check data-ks-id first (most reliable)
        const dataKsElement = element.querySelector && element.querySelector('[data-ks-id*="t3_"]');
        if (dataKsElement) {
            const dataKsId = dataKsElement.getAttribute('data-ks-id');
            const match = dataKsId.match(/t3_([a-zA-Z0-9]+)/);
            if (match) {
                return `post_${match[1]}`;
            }
        }
        
        const postLinks = element.querySelectorAll && element.querySelectorAll('a[href*="/comments/"]');
        if (postLinks && postLinks.length > 0) {
            for (let i = 0; i < postLinks.length; i++) {
                const href = postLinks[i].getAttribute('href');
                if (href) {
                    const match = href.match(/\/comments\/([a-zA-Z0-9]+)/);
                    if (match) {
                        return `post_${match[1]}`;
                    }
                }
            }
        }
        
        if (isPostPage()) {
            const currentUrl = window.location.href;
            const match = currentUrl.match(/\/comments\/([a-zA-Z0-9]+)/);
            if (match) {
                return `post_${match[1]}`;
            }
        }
        
        const permalink = element.getAttribute && element.getAttribute('data-permalink');
        if (permalink) return permalink;
        
        const postId = element.getAttribute && element.getAttribute('data-post-id');
        if (postId) return `post_${postId}`;
        
        const allLinks = element.querySelectorAll && element.querySelectorAll('a[href]');
        if (allLinks) {
            for (let i = 0; i < allLinks.length; i++) {
                const href = allLinks[i].getAttribute('href');
                if (href && href.includes('/r/') && href.includes('/comments/')) {
                    const match = href.match(/\/comments\/([a-zA-Z0-9]+)/);
                    if (match) {
                        return `post_${match[1]}`;
                    }
                }
            }
        }
        
        const subreddit = getSubredditForAnyRedditPost(element);
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, [data-testid="post-content"] h1, [data-testid="post-content"] h2, [data-testid="post-content"] h3, [slot="title"]');
        const title = titleElement ? titleElement.textContent : '';
        
        if (subreddit && title) {
            return `${subreddit}:${title.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        
        return null;
    }

    function wasElementPreviouslyApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier && approvalPersistence.has(identifier)) {
            if (isPostPage()) {
                devLog(`✅ Previously approved: ${identifier}`);
            }
            return approvalPersistence.get(identifier);
        }
        return false;
    }

    function markElementAsApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier) {
            // Prevent approval persistence from growing too large
            if (approvalPersistence.size >= MAX_APPROVAL_PERSISTENCE) {
                const entries = Array.from(approvalPersistence.entries()).slice(-Math.floor(MAX_APPROVAL_PERSISTENCE * 0.7));
                approvalPersistence.clear();
                entries.forEach(([key, value]) => approvalPersistence.set(key, value));
            }
            
            approvalPersistence.set(identifier, true);

            // Remember approved posts to guarantee click-through visibility on comments pages
            try { rememberApprovedPostId(identifier); } catch {}
        }

        // NEW: also try to store a canonical post_<id> even if identifier fallback was non-canonical
        try {
            const canonical = tryGetCanonicalPostId(element);
            if (canonical) rememberApprovedPostId(canonical);
        } catch {}

        element.classList.add('reddit-approved');
        permanentlyApprovedElements.add(element);
    }

    // --- CORE FILTERING FUNCTIONS ---
    function isSubredditNameBanned(subName) {
        if (!subName) return false;
        const lowerSub = subName.toLowerCase();
        
        if (bannedSubredditCache.has(lowerSub)) {
            return bannedSubredditCache.get(lowerSub);
        }
        
        // Prevent cache from growing too large
        if (bannedSubredditCache.size >= MAX_CACHE_SIZE) {
            const entries = Array.from(bannedSubredditCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
            bannedSubredditCache.clear();
            entries.forEach(([key, value]) => bannedSubredditCache.set(key, value));
        }
        
        for (let i = 0; i < adultSubreddits.length; i++) {
            if (lowerSub === adultSubreddits[i].toLowerCase()) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`🚫 Blocked by banned subreddit: ${subName}`);
                }
                return true;
            }
        }
        
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerSub.includes(keywordsToHide[i].toLowerCase())) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`🚫 Blocked subreddit "${subName}" by keyword: "${keywordsToHide[i]}"`);
                }
                return true;
            }
        }
        
        // Regex checks (now unlimited)
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerSub)) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`🚫 Blocked subreddit "${subName}" by regex: ${regexKeywordsToHide[i]}`);
                }
                return true;
            }
        }
        
        bannedSubredditCache.set(lowerSub, false);
        return false;
    }

    function checkContentForKeywords(content) {
        if (!content) return false;
        
        const contentText = content.textContent || content.innerText || content.nodeValue || '';
        if (!contentText) return false;
        
        return checkTextForKeywords(contentText);
    }

    // Enhanced to work for both feed pages and individual post pages
    function isSafeSubredditUrl() {
        const url = window.location.href.toLowerCase();
        
        // Check if current page is in a safe subreddit
        for (let i = 0; i < safeSubreddits.length; i++) {
            const safeSub = safeSubreddits[i].replace(/^r\//, '').toLowerCase();
            // Match both feed pages (/r/subreddit) and post pages (/r/subreddit/comments/...)
            if (url.match(new RegExp(`/r/${safeSub}([/?#]|$|/comments/)`))) {
                return true;
            }
        }
        
        return false;
    }

    function isUrlAllowed() {
        const currentUrl = window.location.href;
        // Click-through or whitelisted author should always be allowed
        if (ALWAYS_ALLOW_CURRENT_POST || isCurrentPageWhitelistedAuthor()) return true;
        return allowedUrls.some(url => currentUrl.startsWith(url)) || isSafeSubredditUrl();
    }

    function removeElementAndRelated(element) {
        if (element && element.parentNode) {
            element.remove();
        }
    }

    function getSubredditForAnyRedditPost(el) {
        const prefixedName = el.getAttribute && el.getAttribute('subreddit-prefixed-name');
        if (prefixedName) return prefixedName.startsWith('r/') ? prefixedName : 'r/' + prefixedName;
        
        const subredditName = el.getAttribute && el.getAttribute('subreddit-name');
        if (subredditName) return 'r/' + subredditName;
        
        const dataSubreddit = el.getAttribute && el.getAttribute('data-subreddit');
        if (dataSubreddit) return dataSubreddit.startsWith('r/') ? dataSubreddit : 'r/' + dataSubreddit;
        
        const subredditLink = el.querySelector && el.querySelector('a[data-testid="subreddit-name"]');
        if (subredditLink && el.textContent) return subredditLink.textContent.trim();
        
        const rLink = el.querySelector && el.querySelector('a[href^="/r/"]');
        if (rLink && el.textContent) return rLink.textContent.trim();
        
        const links = el.querySelectorAll && el.querySelectorAll('a[href*="/r/"]');
        if (links) {
            for (let i = 0; i < links.length; i++) {
                const href = links[i].getAttribute('href');
                const match = href && href.match(/\/r\/([A-Za-z0-9_]+)/);
                if (match) {
                    return "r/" + match[1];
                }
            }
        }
        
        return null;
    }

    function isElementFromAdultSubreddit(el) {
        const sub = getSubredditForAnyRedditPost(el);
        if (!sub) return false;
        return isSubredditNameBanned(sub);
    }

    // ENHANCED: Enhanced safe subreddit detection that works on both URL and element
    function isElementInSafeSubreddit(element) {
        // Method 1: Check current URL first
        if (isSafeSubredditUrl()) {
            return true;
        }
        
        // Method 2: Check element attributes
        const subredditPrefixedName = element.getAttribute && element.getAttribute('subreddit-prefixed-name');
        if (subredditPrefixedName) {
            const normalizedName = subredditPrefixedName.startsWith('r/') ? subredditPrefixedName : 'r/' + subredditPrefixedName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                devLog(`Element is in safe subreddit: ${normalizedName}`);
                return true;
            }
        }
        
        // Method 3: Check subreddit-name attribute
        const subredditName = element.getAttribute && element.getAttribute('subreddit-name');
        if (subredditName) {
            const normalizedName = 'r/' + subredditName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                devLog(`Element is in safe subreddit: ${normalizedName}`);
                return true;
            }
        }
        
        // Method 4: Check through getSubredditForAnyRedditPost
        const subreddit = getSubredditForAnyRedditPost(element);
        if (subreddit) {
            const normalizedName = subreddit.startsWith('r/') ? subreddit : 'r/' + subreddit;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                devLog(`Element is in safe subreddit: ${normalizedName}`);
                return true;
            }
        }
        
        return false;
    }

    // ENHANCED: Content evaluation function - strict, complete scanning with allowlist + click-through guarantee
    function evaluateElementForBanning(element) {
        const wasApprovedBefore = (permanentlyApprovedElements.has(element) || wasElementPreviouslyApproved(element));
        if (!STRICT_BLOCKING && wasApprovedBefore) {
            return false;
        }
        
        const identifier = getPostIdentifier(element);
        if (isPostPage() && identifier) {
            devLog(`🔍 Evaluating element: ${identifier}`);
        }

        // 1) Never hide posts from the whitelisted author
        if (isElementFromWhitelistedAuthor(element)) {
            if (identifier) devLog(`🟢 Whitelisted author - allowing: ${identifier}`);
            markElementAsApproved(element);
            return false;
        }
        // 2) Click-through guarantee: if this is the current post, allow it (no storage dependency)
        if (identifier && CURRENT_POST_ID && identifier === CURRENT_POST_ID) {
            devLog(`🟢 Click-through guarantee - allowing current post: ${identifier}`);
            markElementAsApproved(element);
            return false;
        }
        // 2a) Extra resilience: even if identifier failed, try canonical id right here
        if (CURRENT_POST_ID) {
            const canonical = tryGetCanonicalPostId(element);
            if (canonical && canonical === CURRENT_POST_ID) {
                devLog(`🟢 Click-through guarantee (canonical fallback) - allowing current post: ${canonical}`);
                markElementAsApproved(element);
                return false;
            }
        }
        // 2b) If page-level detection shows whitelisted author for the current post id, allow
        if (identifier && CURRENT_POST_ID && identifier === CURRENT_POST_ID && isCurrentPageWhitelistedAuthor()) {
            devLog(`🟢 Whitelisted author (page-level) - allowing current post: ${identifier}`);
            markElementAsApproved(element);
            return false;
        }

        // Check safe subreddit, but do not auto-approve in strict mode
        const isSafe = isElementInSafeSubreddit(element);

        // Do COMPLETE content scanning
        const fullContent = extractCompletePostContent(element);

        // Check if element is from a banned subreddit
        if (isElementFromAdultSubreddit(element)) {
            if (isPostPage()) {
                const sub = getSubredditForAnyRedditPost(element);
                devLog(`🚫 Blocked by subreddit: ${sub}`);
            }
            return true;
        }
        
        // Check ALL keywords using COMPLETE content scan
        if (checkTextForKeywords(fullContent)) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by full content scan`);
            }
            return true;
        }
        
        // Also check individual elements for thorough scanning
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, a[data-click-id="body"], .title, [slot="title"]');
        if (titleElement && checkContentForKeywords(titleElement)) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by title content`);
            }
            return true;
        }
        
        // Check post body content
        const contentElement = element.querySelector && element.querySelector('.post-content, .md-container, p, [slot="text-body"], [data-testid="post-content"]');
        if (contentElement && checkContentForKeywords(contentElement)) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by post content`);
            }
            return true;
        }
        
        // Check for NSFW indicators
        const nsfwIndicators = element.querySelectorAll && element.querySelectorAll('.nsfw, [data-nsfw="true"], svg[icon-name="nsfw-outline"], .text-category-nsfw');
        if (nsfwIndicators && nsfwIndicators.length > 0) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by NSFW indicator`);
            }
            return true;
        }
        
        if (isPostPage() && identifier) {
            devLog(`✅ Element passed all checks: ${identifier} ${isSafe ? '(safe subreddit)' : ''} ${wasApprovedBefore ? '(previously approved)' : ''}`);
        }
        
        return false;
    }

    // OPTIMIZED: Main filtering functions with synchronous processing
    function filterAdultSubredditPosts() {
        // Only filter posts, NOT comments - optimized for performance
        const postSelectors = [
            'article:not(.prehide):not(.reddit-approved)',
            'shreddit-post:not(.prehide):not(.reddit-approved)', 
            '[subreddit-prefixed-name]:not(.prehide):not(.reddit-approved)'
        ];
        
        for (let selectorIndex = 0; selectorIndex < postSelectors.length; selectorIndex++) {
            const elements = document.querySelectorAll(postSelectors[selectorIndex]);
            
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                if (processedElements.has(element)) continue;
                processedElements.add(element);
                
                const shouldBan = evaluateElementForBanning(element);
                if (shouldBan) {
                    element.classList.add('prehide', 'reddit-banned');
                    removeElementAndRelated(element);
                } else {
                    markElementAsApproved(element);
                }
            }
        }
    }

    function checkContentForSubreddits(content) {
        const contentText = content.textContent ? content.textContent.toLowerCase() : '';
        return adultSubreddits.some(subreddit =>
            contentText.includes(subreddit.toLowerCase())
        );
    }

    function hideJoinNowPosts() {
        const posts = document.querySelectorAll('article:not(.prehide), shreddit-post:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            
            let joinNowFound = false;
            
            const btns = post.querySelectorAll('button, a');
            for (let j = 0; j < btns.length && !joinNowFound; j++) {
                if (btns[j].textContent && btns[j].textContent.trim().toLowerCase() === 'join now') {
                    joinNowFound = true;
                }
            }
            
            if (joinNowFound) {
                post.classList.add('prehide');
                removeElementAndRelated(post);
            }
        }
    }

    function getSubredditFromPost(post) {
        const sub = post.getAttribute && post.getAttribute('data-subreddit');
        if (sub) return sub.startsWith('r/') ? sub : 'r/' + sub;
        
        const aTags = post.querySelectorAll && post.querySelectorAll('a[href*="/r/"]');
        if (aTags) {
            for (let i = 0; i < aTags.length; i++) {
                const match = aTags[i].getAttribute('href').match(/\/r\/([A-Za-z0-9_]+)/);
                if (match) return 'r/' + match[1];
            }
        }
        
        return null;
    }

    function hideSubredditPosts() {
        const posts = document.querySelectorAll('article:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            
            const subName = getSubredditFromPost(post);
            if (subName && isSubredditNameBanned(subName)) {
                post.classList.add('prehide');
                removeElementAndRelated(post);
            }
        }
    }

    function hideKeywordPosts() {
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            const shouldBan = evaluateElementForBanning(post);
            if (shouldBan) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                markElementAsApproved(post);
            }
        }
    }

    function filterPostsByContent() {
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved), shreddit-post:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            const shouldBan = evaluateElementForBanning(post);
            if (shouldBan) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                markElementAsApproved(post);
            }
        }
    }

    function checkForAdultContentTag() {
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    // --- SEARCH FILTERING FUNCTIONS ---
    function hideBannedSubredditsFromSearch() {
        const allSearchItems = [
            ...Array.from(document.querySelectorAll('[data-type="search-dropdown-item-label-text"]')),
            ...Array.from(document.querySelectorAll('span.font-semibold.text-12.uppercase, span.text-category-nsfw')),
            ...Array.from(document.querySelectorAll('li[data-testid="search-sdui-query-autocomplete"], li.recent-search-item')),
            ...Array.from(document.querySelectorAll('li[role="presentation"], a[role="option"], div[data-testid="search-dropdown-item"]'))
        ];
        
        for (let i = 0; i < allSearchItems.length; i++) {
            const item = allSearchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            if (item.classList.contains('text-category-nsfw') || 
                (item.textContent && item.textContent.trim().toUpperCase() === "NSFW")) {
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                }
                continue;
            }
            
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const textContent = item.textContent || '';
            const label = ariaLabel + ' ' + textContent;
            
            if (isSubredditNameBanned(label)) {
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                } else if (item.parentElement) {
                    item.parentElement.style.display = 'none';
                } else {
                    item.style.display = 'none';
                }
            } else {
                item.classList.add('reddit-search-approved');
                let parent = item.closest('li[role="presentation"], li, a, div');
                if (parent) parent.classList.add('reddit-search-approved');
            }
        }
    }

    // Helper: observe a ShadowRoot exactly once and reuse its observer
    function observeShadowRootOnce(root) {
        if (!root || shadowRootObservers.has(root)) return;
        try {
            const mo = new MutationObserver(throttledShadowRootHandler);
            mo.observe(root, { childList: true, subtree: true, attributes: false, characterData: false });
            shadowRootObservers.set(root, mo);
            observerInstances.add(mo);
        } catch (e) {}
    }

    // Helper: disconnect shadow observers in a removed subtree (prevents accumulation)
    function disconnectShadowObserversInSubtree(node, depth = 0) {
        if (!node || node.nodeType !== 1 || depth > 6) return;
        try {
            if (node.shadowRoot && shadowRootObservers.has(node.shadowRoot)) {
                const mo = shadowRootObservers.get(node.shadowRoot);
                try { mo && mo.disconnect && mo.disconnect(); } catch {}
                shadowRootObservers.delete(node.shadowRoot);
            }
            const children = node.children;
            if (children && children.length) {
                const max = Math.min(children.length, 200);
                for (let i = 0; i < max; i++) {
                    disconnectShadowObserversInSubtree(children[i], depth + 1);
                }
            }
        } catch {}
    }

    function processShadowSearchItems(root) {
        if (!root || !root.querySelectorAll) return;
        
        const searchItems = root.querySelectorAll('li[role="presentation"], div[role="presentation"], li, a[role="option"], div[data-testid="search-dropdown-item"]');
        
        for (let i = 0; i < searchItems.length; i++) {
            const item = searchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            const text = item.textContent || '';
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const fullText = text + ' ' + ariaLabel;
            
            let hasNSFWBadge = false;
            const spans = item.querySelectorAll('span, div');
            for (let j = 0; j < spans.length && !hasNSFWBadge; j++) {
                if (spans[j].textContent && spans[j].textContent.trim().toUpperCase() === 'NSFW') {
                    hasNSFWBadge = true;
                }
            }
            
            if (isSubredditNameBanned(fullText) || hasNSFWBadge) {
                item.style.display = 'none';
            } else {
                item.classList.add('reddit-search-approved');
            }
        }
    }

    function hideBannedSubredditsFromAllSearchDropdowns() {
        function processShadowRoots(node) {
            if (!node) return;
            
            if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                shadowRootsProcessed.add(node.shadowRoot);
                processShadowSearchItems(node.shadowRoot);
                
                // NEW: observe the shadow root once (no duplicate observers)
                observeShadowRootOnce(node.shadowRoot);
                
                const shadowChildren = node.shadowRoot.querySelectorAll('*');
                for (let i = 0; i < shadowChildren.length; i++) {
                    processShadowRoots(shadowChildren[i]);
                }
            }
            
            if (node.children) {
                for (let i = 0; i < node.children.length; i++) {
                    processShadowRoots(node.children[i]);
                }
            }
        }
        
        hideBannedSubredditsFromSearch();
        
        if (document.body) {
            processShadowRoots(document.body);
        }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            processShadowRoots(searchDropdowns[i]);
        }
    }

    // Bounded ShadowRoot mutation handler (caps work per tick)
    const throttledShadowRootHandler = throttle((mutations) => {
        const maxMutations = Math.min(mutations.length, 20);
        for (let mi = 0; mi < maxMutations; mi++) {
            const mutation = mutations[mi];
            const addedLimit = Math.min(mutation.addedNodes.length, 10);
            for (let ni = 0; ni < addedLimit; ni++) {
                const node = mutation.addedNodes[ni];
                if (node && node.nodeType === 1) {
                    processShadowSearchItems(mutation.target);
                    if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                        shadowRootsProcessed.add(node.shadowRoot);
                        processShadowSearchItems(node.shadowRoot);
                        observeShadowRootOnce(node.shadowRoot);
                    }
                }
            }
        }
    }, 100);

    function observeSearchDropdown() {
        const container = document.getElementById('search-dropdown-results-container');
        if (container && !container.__searchObserved) {
            const observer = new MutationObserver(() => {
                batchProcess(() => {
                    hideBannedSubredditsFromSearch();
                    hideBannedSubredditsFromAllSearchDropdowns();
                });
            });
            
            observerInstances.add(observer);
            observer.observe(container, { 
                childList: true, 
                subtree: true
            });
            container.__searchObserved = true;
        }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            const dropdown = searchDropdowns[i];
            if (dropdown.__searchObserved) continue;
            dropdown.__searchObserved = true;
            
            const observer = new MutationObserver(() => {
                batchProcess(() => {
                    if (dropdown.shadowRoot) {
                        processShadowSearchItems(dropdown.shadowRoot);
                    }
                });
            });
            
            observerInstances.add(observer);
            observer.observe(dropdown, {
                childList: true,
                subtree: true
            });
        }
    }

    // --- UTILITY FUNCTIONS ---
    function interceptSearchInputChanges() {
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && !eventListenersAdded.has(searchInput)) {
            const inputHandler = debounce(() => {
                const query = searchInput.value.toLowerCase();
                const exactMatch = keywordsToHide.some(keyword =>
                    query.includes(keyword.toLowerCase())
                );
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(query)
                );
                
                if ((exactMatch || regexMatch) || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    window.location.replace('https://www.reddit.com');
                }
            }, 200);
            
            searchInput.addEventListener('input', inputHandler);
            eventListenersAdded.add(searchInput);
        }
    }

    function interceptSearchFormSubmit() {
        const searchForm = document.querySelector('form[action="/search"]');
        if (searchForm && !eventListenersAdded.has(searchForm)) {
            const submitHandler = (event) => {
                const formData = new FormData(searchForm);
                const query = (formData.get('q') || '').toLowerCase();
                const exactMatch = keywordsToHide.some(keyword =>
                    query.includes(keyword.toLowerCase())
                );
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(query)
                );
                
                if ((exactMatch || regexMatch) || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    event.preventDefault();
                    window.location.replace('https://www.reddit.com');
                }
            };
            
            searchForm.addEventListener('submit', submitHandler);
            eventListenersAdded.add(searchForm);
        }
    }

    function checkUrlForKeywordsToHide() {
        if (isSafeSubredditUrl()) return;
        // Allow the current post if it was previously approved or is authored by the whitelisted user
        if (ALWAYS_ALLOW_CURRENT_POST || isCurrentPageWhitelistedAuthor()) return;
        
        const currentUrl = window.location.href.toLowerCase();
        
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (currentUrl.includes(keywordsToHide[i].toLowerCase())) {
                if (!isUrlAllowed()) {
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }
        }
        
        // Regex checks (now unlimited)
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(currentUrl)) {
                if (!isUrlAllowed()) {
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }
        }
    }

    function clearRecentPages() {
        try {
            const recentPagesStore = localStorage.getItem('recent-subreddits-store');
            if (!recentPagesStore) return;
            
            const recentPages = JSON.parse(recentPagesStore);
            if (!Array.isArray(recentPages)) return;
            
            const filteredPages = recentPages.filter(page => {
                if (typeof page !== 'string') return true;
                return !isSubredditNameBanned(page);
            });
            
            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
        } catch (e) {
            console.error("Error clearing recent pages:", e);
        }
    }

    function hideRecentCommunitiesSection() {
        const selectors = [
            'reddit-recent-pages', 
            'shreddit-recent-communities',
            'div[data-testid="community-list"]',
            '[data-testid="recent-communities"]',
            '.recent-communities'
        ];
        
        for (let i = 0; i < selectors.length; i++) {
            const elements = document.querySelectorAll(selectors[i]);
            for (let j = 0; j < elements.length; j++) {
                elements[j].style.display = 'none';
            }
        }
        
        try {
            localStorage.setItem('recent-subreddits-store', '[]');
        } catch (e) {
            // Handle localStorage errors
        }
    }

    function checkAndHideNSFWClassElements() {
        if (ALWAYS_ALLOW_CURRENT_POST) return;
        const nsfwClasses = ['NSFW', 'nsfw-tag', 'nsfw-content'];
        for (let i = 0; i < nsfwClasses.length; i++) {
            const elements = document.querySelectorAll(`.${nsfwClasses[i]}`);
            for (let j = 0; j < elements.length; j++) {
                removeElementAndRelated(elements[j]);
            }
        }
    }

    function removeHrElements() {
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        for (let i = 0; i < hrElements.length; i++) {
            hrElements[i].remove();
        }
    }

    function removeSelectorsToDelete() {
        for (let i = 0; i < selectorsToDelete.length; i++) {
            const elements = document.querySelectorAll(selectorsToDelete[i]);
            for (let j = 0; j < elements.length; j++) {
                removeElementAndRelated(elements[j]);
            }
        }
    }

    function processShadowDOM() {
        const elements = document.querySelectorAll('shreddit-post, shreddit-feed');
        
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!element.shadowRoot || shadowRootsProcessed.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            
            // Process ONLY posts in shadow DOM, NOT comments
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            for (let j = 0; j < posts.length; j++) {
                const post = posts[j];
                if (processedElements.has(post)) continue;
                processedElements.add(post);
                
                const shouldBan = evaluateElementForBanning(post);
                if (shouldBan) {
                    post.classList.add('prehide', 'reddit-banned');
                    post.remove();
                } else {
                    markElementAsApproved(post);
                }
            }
            
            // NEW: single observer per ShadowRoot
            observeShadowRootOnce(element.shadowRoot);
        }
    }

    // --- MAIN FILTER FUNCTION ---
    function runAllChecks() {
        const now = performance.now();
        if (now - lastFilterTime < 50) return;
        lastFilterTime = now;
        
        if (document.body && !document.body.classList.contains('reddit-filter-ready')) {
            document.body.classList.add('reddit-filter-ready');
        }
        
        hideAnswersButton();
        
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
        observeSearchDropdown();
        
        processShadowDOM();
        
        // Filter ONLY posts, NOT comments - optimized performance
        filterAdultSubredditPosts();
        hideKeywordPosts();
        filterPostsByContent();
        
        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            hideSubredditPosts();
            checkForAdultContentTag();
            checkUrlForKeywordsToHide();
            clearRecentPages();
            hideRecentCommunitiesSection();
        }
        
        removeHrElements();
        removeSelectorsToDelete();
        checkAndHideNSFWClassElements();
    }

    // --- INITIALIZATION AND EVENT HANDLING ---
    function init() {
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        
        runAllChecks();
        
        const throttledRunChecks = throttle(() => runAllChecks(), 75);
        const observer = new MutationObserver(throttledRunChecks);
        
        if (document.body) {
            observerInstances.add(observer);
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }
        
        const minimalInterval = setInterval(hideBannedSubredditsFromSearch, 1000);
        intervalIds.add(minimalInterval);
        
        const answersButtonInterval = setInterval(hideAnswersButton, 150);
        intervalIds.add(answersButtonInterval);
        
        if (window.requestIdleCallback) {
            const idleCallback = () => {
                if (document.hidden) {
                    runAllChecks();
                } else {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                }
                
                window.requestIdleCallback(idleCallback, { timeout: 3000 });
            };
            
            window.requestIdleCallback(idleCallback, { timeout: 3000 });
        } else {
            const backgroundInterval = setInterval(() => {
                batchProcess(() => {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                });
            }, 3000);
            intervalIds.add(backgroundInterval);
        }
        
        // Memory monitoring every 5 seconds
        const memoryMonitorInterval = setInterval(() => {
            monitorMemoryPressure();
        }, MEMORY_CHECK_INTERVAL);
        intervalIds.add(memoryMonitorInterval);
        
        // Cache cleanup every 10 seconds
        const cleanupInterval = setInterval(() => {
            cleanupCaches();
        }, CLEANUP_INTERVAL);
        intervalIds.add(cleanupInterval);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // === FIXED AND COMPLETED: processNewElements (single definition, no duplicates) ===
    const processNewElements = throttle((mutations) => {
        let needsSearchUpdate = false;

        // NEW: bound number of mutations per turn
        const limitedMutations = Array.isArray(mutations) ? mutations.slice(0, 30) : mutations;
        
        for (let i = 0; i < limitedMutations.length; i++) {
            const mutation = limitedMutations[i];
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
            }
            
            // NEW: limit added nodes processed per mutation
            const addedLimit = Math.min(mutation.addedNodes.length, 15);
            for (let j = 0; j < addedLimit; j++) {
                const node = mutation.addedNodes[j];
                if (!node || node.nodeType !== 1) continue;
                
                if (node.tagName === 'A' && node.getAttribute('href') === '/answers/') {
                    hideAnswersButton();
                }
                
                if (node.tagName === 'FACEPLATE-TRACKER' || 
                    (node.querySelector && (node.querySelector('faceplate-tracker[noun="gen_guides_sidebar"]') ||
                                            node.querySelector('a[href="/answers/"]')))) {
                    hideAnswersButton();
                }
                
                // Process ONLY posts, NOT comments - optimized
                if (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST') {
                    if (!processedElements.has(node)) {
                        processedElements.add(node);
                        
                        const shouldBan = evaluateElementForBanning(node);
                        if (shouldBan) {
                            node.classList.add('prehide', 'reddit-banned');
                            removeElementAndRelated(node);
                        } else {
                            markElementAsApproved(node);
                        }
                    }
                } else if (node.hasAttribute && (
                    node.hasAttribute('role') || 
                    node.hasAttribute('data-testid') || 
                    node.classList.contains('recent-search-item')
                )) {
                    needsSearchUpdate = true;
                }
                
                if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                    shadowRootsProcessed.add(node.shadowRoot);
                    
                    processShadowSearchItems(node.shadowRoot);
                    
                    // Process ONLY posts in shadow DOM, NOT comments - optimized
                    const shadowPosts = node.shadowRoot.querySelectorAll('article, shreddit-post');
                    const maxShadowPosts = Math.min(shadowPosts.length, 10);
                    for (let k = 0; k < maxShadowPosts; k++) {
                        const shadowPost = shadowPosts[k];
                        if (!processedElements.has(shadowPost)) {
                            processedElements.add(shadowPost);
                            
                            const shouldBan = evaluateElementForBanning(shadowPost);
                            if (shouldBan) {
                                shadowPost.classList.add('prehide', 'reddit-banned');
                                shadowPost.remove();
                            } else {
                                markElementAsApproved(shadowPost);
                            }
                        }
                    }
                    
                    // NEW: single observer per ShadowRoot
                    observeShadowRootOnce(node.shadowRoot);
                }
                
                if (node.querySelectorAll) {
                    const hrElements = node.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
                    for (let k = 0; k < hrElements.length; k++) {
                        hrElements[k].remove();
                    }
                    
                    for (let k = 0; k < selectorsToDelete.length; k++) {
                        const elements = node.querySelectorAll(selectorsToDelete[k]);
                        for (let l = 0; l < elements.length; l++) {
                            removeElementAndRelated(elements[l]);
                        }
                    }
                }
            }
        }
        
        if (needsSearchUpdate) {
            batchProcess(() => {
                hideBannedSubredditsFromSearch();
                hideBannedSubredditsFromAllSearchDropdowns();
            });
        }
        
        hideAnswersButton();
    }, 75);

    const observer = new MutationObserver(processNewElements);
    observerInstances.add(observer);
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    // NEW: observe detachments to auto-disconnect any shadow observers in removed subtrees
    const domDetachObserver = new MutationObserver((muts) => {
        for (let i = 0; i < muts.length; i++) {
            const m = muts[i];
            if (m.removedNodes && m.removedNodes.length) {
                const maxRemoved = Math.min(m.removedNodes.length, 50);
                for (let j = 0; j < maxRemoved; j++) {
                    const n = m.removedNodes[j];
                    if (n && n.nodeType === 1) {
                        disconnectShadowObserversInSubtree(n, 0);
                    }
                }
            }
        }
    });
    observerInstances.add(domDetachObserver);
    try {
        domDetachObserver.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}

    hideBannedSubredditsFromSearch();
    hideBannedSubredditsFromAllSearchDropdowns();

    // URL change detection with optimized memory cleanup + click-through state refresh
    let currentUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            
            // Gentle cache cleanup on navigation
            cleanupCaches();
            
            const memInfo = getMemoryUsage();
            if (memInfo) {
                devLog(`🔄 URL changed - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB`);
            }

            // Refresh click-through allowance for comments pages
            try {
                CURRENT_POST_ID = (function () {
                    const m = window.location.href.match(/\/comments\/([a-zA-Z0-9]+)/);
                    return m ? `post_${m[1]}` : null;
                })();
                // CHANGED: use union (sessionStorage + localStorage) consistently
                const approvedSet = (function(){
                    try {
                        const arr = getApprovedPostsArray();
                        return new Set(Array.isArray(arr) ? arr : []);
                    } catch { return new Set(); }
                })();
                ALWAYS_ALLOW_CURRENT_POST = !!(CURRENT_POST_ID && approvedSet.has(CURRENT_POST_ID));
                if (ALWAYS_ALLOW_CURRENT_POST) {
                    document.documentElement.classList.add('nr-allow-current-post');
                    document.body && document.body.classList.add('nr-allow-current-post');
                } else {
                    document.documentElement.classList.remove('nr-allow-current-post');
                    document.body && document.body.classList.remove('nr-allow-current-post');
                }
            } catch {}
        }
    }, 500);
    intervalIds.add(urlCheckInterval);

})();