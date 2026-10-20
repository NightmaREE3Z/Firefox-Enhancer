(function () {
    'use strict';

    // ---- RUNTIME + FIREFOX GUARDS ----
    const IS_FIREFOX = typeof InstallTrigger !== 'undefined' || /\bFirefox\//.test(navigator.userAgent);
    let HEAVY_OBSERVERS_ACTIVE = false;       // track whether main MOs are attached
    let INITIAL_BURST_DONE = false;           // taper aggressive timers after startup
    let PAGE_WORLD_HOOKED = false;            // page-world Answers hook installed flag
    let START_TS = performance.now();
    let isRedirecting = false;                // global flag to prevent redirect loops

    // Enforce hard, no-bypass blocking of all lists (subreddits, strings, regex)
    const STRICT_BLOCKING = true;

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        try { console.log('[REDDIT.JS]', message); } catch {}
    }

    // === Click-through guarantee + author allowlist globals ===
    const WHITELIST_AUTHORS = ['u/NightmaREE3Z', 'NightmaREE3Z', 'u/nightmareee3z', 'nightmareee3z'];
    const APPROVED_SS_KEY = '__nrApprovedPostsV1';
    const APPROVED_LS_KEY = '__nrApprovedPostsV1_ls';
    let CURRENT_POST_ID = null;               
    let ALWAYS_ALLOW_CURRENT_POST = false;    

    function getCurrentPostIdFromUrl() {
        try {
            const m = window.location.href.match(/\/comments\/([a-zA-Z0-9]+)/);
            return m ? `post_${m[1]}` : null;
        } catch { return null; }
    }
    function getApprovedPostsArray() {
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
        try {
            const safeArr = Array.isArray(arr) ? arr : [];
            const json = JSON.stringify(safeArr);
            try { sessionStorage.setItem(APPROVED_SS_KEY, json); } catch {}
            try { localStorage.setItem(APPROVED_LS_KEY, json); } catch {}
        } catch {}
    }
    function getApprovedPostIdsFromSession() {
        return new Set(getApprovedPostsArray());
    }
    function rememberApprovedPostId(id) {
        if (!id) return;
        const canonical = /^post_[a-zA-Z0-9]+$/.test(String(id));
        if (!canonical) return;
        const arr = getApprovedPostsArray();
        // Already remembered IDs require no storage writes. Reading and
        // rewriting both storage areas for every feed approval causes jank.
        if (arr.includes(id)) return;
        arr.push(id);
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
            const attrAuthor = (el.getAttribute && (el.getAttribute('author') || el.getAttribute('data-author') || el.getAttribute('data-username'))) || '';
            if (attrAuthor) return attrAuthor;

            const sel = el.querySelector && el.querySelector(
                'a[data-testid="post_author_link"], ' +
                'a[href^="/user/"], a[href^="/u/"], ' +
                '[slot="author"] a, faceplate-username, ' +
                '[data-testid="post-author"], ' +
                'a[data-testid="comment_author_link"]'
            );
            if (sel && sel.textContent) return sel.textContent.trim();

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

    try {
        CURRENT_POST_ID = getCurrentPostIdFromUrl();
        if (CURRENT_POST_ID) {
            const set = getApprovedPostIdsFromSession(); 
            ALWAYS_ALLOW_CURRENT_POST = set.has(CURRENT_POST_ID);
        }
    } catch {}

    function extractCanonicalPostIdFromHref(href) {
        if (!href || typeof href !== 'string') return null;
        try {
            const m = href.match(/\/comments\/([a-zA-Z0-9]+)/);
            return m ? `post_${m[1]}` : null;
        } catch { return null; }
    }
    function tryGetCanonicalPostId(el) {
        if (!el) return null;
        try {
            const dataKsElement = (el.matches?.('[data-ks-id*="t3_"]') ? el : el.querySelector?.('[data-ks-id*="t3_"]'));
            if (dataKsElement) {
                const dataKsId = dataKsElement.getAttribute('data-ks-id') || '';
                const m = dataKsId.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
            }
            const postIdEl = (el.hasAttribute?.('data-post-id') ? el : el.querySelector?.('[data-post-id]'));
            if (postIdEl) {
                const pid = postIdEl.getAttribute('data-post-id');
                if (pid && /^[a-zA-Z0-9]+$/.test(pid)) return `post_${pid}`;
            }
            const postWrapper = el.closest?.('shreddit-post');
            if (postWrapper) {
                const idAttr = postWrapper.getAttribute('id') || '';
                const m = idAttr.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
                const pid2 = postWrapper.getAttribute('data-post-id') || postWrapper.getAttribute('post-id') || '';
                if (pid2 && /^[a-zA-Z0-9]+$/.test(pid2)) return `post_${pid2}`;
            }
            const a = el.querySelector?.('a[href*="/comments/"]');
            if (a) {
                const href = a.getAttribute('href') || '';
                const id = extractCanonicalPostIdFromHref(href);
                if (id) return id;
            }
            const searchTitleId = el.querySelector && el.querySelector('[id^="search-post-title-t3_"]');
            if (searchTitleId && searchTitleId.id) {
                const m = searchTitleId.id.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
            }
            return null;
        } catch { return null; }
    }
    function rememberApprovalByHref(href) {
        const id = extractCanonicalPostIdFromHref(href);
        if (id) {
            rememberApprovedPostId(id);
            devLog(`🧷 Captured approval via click: ${id}`);
        }
    }
    (function installClickThroughCapture() {
        try {
            if (window.__nrClickCaptureInstalled) return;
            window.__nrClickCaptureInstalled = true;
            const capture = (evt) => {
                try {
                    let el = evt.target;
                    const anchor = el?.closest?.('a[href*="/comments/"]');
                    if (anchor) {
                        rememberApprovalByHref(anchor.getAttribute('href') || '');
                        return;
                    }
                    const card = el?.closest?.('article, shreddit-post, [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]');
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
                        const card = el.closest?.('article, shreddit-post, [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]');
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

    // React-Safe Hide Function (replaces .remove())
    function safelyHideElement(el) {
        if (!el) return;
        try {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('height', '0', 'important');
            el.style.setProperty('padding', '0', 'important');
            el.style.setProperty('margin', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.style.setProperty('position', 'absolute', 'important');
            el.style.setProperty('z-index', '-9999', 'important');
            el.classList.add('reddit-banned', 'prehide');
        } catch (e) {}
    }

    // === ANSWERS PAGE-WORLD HOOK ===
    (function installAnswersPageHook() {
        try {
            if (window.__nrAnswersEarlyInstalled) return;
            window.__nrAnswersEarlyInstalled = true;

            function getRedditPageNonce() {
                try {
                    const scripts = document.querySelectorAll('script[nonce]');
                    for (let i = 0; i < scripts.length; i++) {
                        const nonce = scripts[i].nonce || scripts[i].getAttribute('nonce') || '';
                        if (nonce) return nonce;
                    }
                } catch {}
                return '';
            }

            function injectIntoPage(fn) {
                try {
                    // Reddit's /media utility page has no nav/Answers surface and enforces a
                    // nonce-only script CSP. Never create an inline script there.
                    if (/^\/media(?:\/|$)/i.test(location.pathname || '')) return false;

                    const nonce = getRedditPageNonce();
                    if (!nonce) return false;

                    const el = document.createElement('script');
                    el.type = 'text/javascript';
                    el.nonce = nonce;
                    el.textContent = `;(${fn})();`;
                    (document.documentElement || document.head).appendChild(el);
                    el.remove();
                    return true;
                } catch {}
                return false;
            }

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

            const installAnswersRuntime = function pageWorldAnswersHook() {
                if (window.__nrAnswersPageHooked) return;
                window.__nrAnswersPageHooked = true;

                const OBS = new Set();
                function addObs(mo) { try { if (mo) OBS.add(mo); } catch(e){} }
                function disconnectAll() { try { OBS.forEach(o => { try { o.disconnect(); } catch {} }); OBS.clear(); } catch {} }

                function safeHide(el) {
                    if(!el) return;
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('pointer-events', 'none', 'important');
                    el.style.setProperty('height', '0', 'important');
                    el.style.setProperty('margin', '0', 'important');
                }

                function removeAnswersAnchor(a) {
                    try {
                        const navScope = a.closest('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        if (!navScope) { safeHide(a); return; }
                        const li = a.closest('li[role="presentation"], li');
                        if (li) { safeHide(li); } else { safeHide(a); }
                    } catch {}
                }

                function removeAnswersIcon(svg) {
                    try {
                        const navScope = svg.closest && svg.closest('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        if (!navScope) return;
                        const a = svg.closest('a');
                        if (a) { removeAnswersAnchor(a); } else { safeHide(svg); }
                    } catch {}
                }

                function removeAnswersTextNodes(scopeRoot) {
                    try {
                        const scopes = scopeRoot.querySelectorAll('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        for (let s = 0; s < scopes.length; s++) {
                            const scope = scopes[s];
                            const items = scope.querySelectorAll('a, button, li[role="presentation"], li, span, div');
                            for (let i = 0; i < items.length; i++) {
                                const el = items[i];
                                const t = (el.textContent || '').trim();
                                if (!t) continue;
                                if (/(^|\s)answers(\s|$)/i.test(t)) {
                                    const anchor = el.closest('a, button');
                                    if (anchor) {
                                        removeAnswersAnchor(anchor.tagName === 'A' ? anchor : anchor.closest('a') || anchor);
                                        continue;
                                    }
                                    const li = el.closest('li[role="presentation"], li');
                                    if (li) { safeHide(li); continue; }
                                    const fpt = el.closest('faceplate-tracker');
                                    if (fpt) { safeHide(fpt); continue; }
                                    safeHide(el);
                                }
                            }
                        }
                    } catch {}
                }

                function removeAnswersIn(root) {
                    try {
                        if (!root || !root.querySelectorAll) return;

                        const anchors = root.querySelectorAll('a[href="/answers"], a[href="/answers/"], a[href^="/answers"]');
                        for (let i = 0; i < anchors.length; i++) removeAnswersAnchor(anchors[i]);

                        const aria = root.querySelectorAll('a[aria-label="Answers"], a[aria-label*="Answers" i]');
                        for (let i = 0; i < aria.length; i++) removeAnswersAnchor(aria[i]);

                        const icons = root.querySelectorAll('svg[icon-name="answers-outline"]');
                        for (let i = 0; i < icons.length; i++) removeAnswersIcon(icons[i]);

                        removeAnswersTextNodes(root);
                    } catch {}
                }

                try {
                    window.__nrRemoveAnswersIn_forAnswers = function(root) {
                        try { removeAnswersIn(root || document); } catch {}
                    };
                } catch {}

                (function targetedInitialSweep() {
                  try {
                    removeAnswersIn(document);
                    const seeds = document.querySelectorAll(
                      'nav, header, aside, [role="navigation"], ' +
                      'faceplate-tracker[source="nav"], faceplate-tracker[noun="gen_guides_sidebar"], ' +
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

                (function hookAttachShadow() {
                    try {
                        const proto = Element.prototype;
                        if (proto.__nrAttachShadowHooked) return;
                        const orig = proto.attachShadow;
                        if (!orig) return;
                        proto.__nrAttachShadowHooked = true;

                        proto.attachShadow = function(init) {
                            const root = orig.call(this, init);
                            // Reddit creates shadow roots for posts, feeds, menus and icons.
                            // Watching every root delays hydration and has no benefit for Answers.
                            try {
                                const navScope = 'nav, header, aside, [role="navigation"], ' +
                                    'reddit-sidebar-nav, #left-sidebar-container, ' +
                                    'flex-left-nav-container#left-sidebar-container, ' +
                                    'faceplate-tracker[source="nav"], ' +
                                    'faceplate-tracker[noun="gen_guides_sidebar"]';
                                if (!this.matches?.(navScope) && !this.closest?.(navScope)) return root;
                                removeAnswersIn(root);
                                const mo = new MutationObserver(() => removeAnswersIn(root));
                                mo.observe(root, { childList: true, subtree: true });
                                addObs(mo);
                            } catch {}
                            return root;
                        };
                    } catch {}
                })();

                window.addEventListener('pagehide', disconnectAll, { once: true });
                window.addEventListener('beforeunload', disconnectAll, { once: true });

                try { removeAnswersIn(document); } catch {}
            };

            // Install the same helper in the extension/content-script world so reddit.js and
            // redditleftnav.js can cooperate without relying on page-world globals.
            try { installAnswersRuntime(); } catch {}

            // Closed Shadow DOM interception still needs the real page world. Reuse Reddit's
            // own CSP nonce when it becomes available; if no nonce is exposed, fail quietly
            // instead of deliberately generating a CSP violation.
            const pageHookDelays = [0, 40, 120, 260, 520, 900];
            pageHookDelays.forEach(delay => {
                setTimeout(() => {
                    try {
                        if (!PAGE_WORLD_HOOKED) PAGE_WORLD_HOOKED = injectIntoPage(installAnswersRuntime);
                    } catch {}
                }, delay);
            });
        } catch {}
    })();

    // --- IMMEDIATE PRE-HIDING CSS ---
    function addPreHidingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            article:has(> shreddit-post):not(.reddit-approved),
            article[data-testid="post-container"]:not(.reddit-approved),
            shreddit-post:not(.reddit-approved),
            [data-testid="search-post-unit"]:not(.reddit-approved),
            [data-id="search-media-post-unit"]:not(.reddit-approved),
            [data-testid="search-post-with-content-preview"]:not(.reddit-approved) {
                /* Keep Reddit's own post geometry while the policy scanner decides it.
                   display:none can starve Shreddit's feed virtualization/hydration. */
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            article:has(> shreddit-post).reddit-approved,
            article[data-testid="post-container"].reddit-approved,
            shreddit-post.reddit-approved,
            [data-testid="search-post-unit"].reddit-approved,
            [data-id="search-media-post-unit"].reddit-approved,
            [data-testid="search-post-with-content-preview"].reddit-approved {
                /* Restore paint without overriding Reddit's native layout display type. */
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }

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
            
            #search-dropdown-results-container li[role="presentation"]:not(.reddit-search-approved),
            #search-dropdown-results-container div[role="presentation"]:not(.reddit-search-approved),
            li[data-testid="search-sdui-query-autocomplete"]:not(.reddit-search-approved),
            li.recent-search-item:not(.reddit-search-approved),
            #search-dropdown-results-container a[role="option"]:not(.reddit-search-approved),
            div[data-testid="search-dropdown-item"]:not(.reddit-search-approved),
            [data-testid="search-community"]:not(.reddit-search-approved) {
                display: none !important;
                visibility: hidden !important;
            }
            
            recent-posts,
            reddit-recent-pages,
            shreddit-recent-communities,
            div[data-testid="community-list"],
            [data-testid="recent-communities"],
            .recent-communities,
            in-feed-community-recommendations,
            community-recommendation,
            #recent-communities-section,
            div#recent-communities-section,
            faceplate-expandable-section-helper#recent-communities-section,
            summary[aria-controls="RECENT"],
            [aria-controls="RECENT"],
            #RECENT {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
            }
            
            /* RedGIFs is blocked at DNS level in this setup, so Reddit's embedded iframe
               can only render a browser error page. Collapse the media slot itself so the
               failed iframe never leaves a black/error box behind, while keeping the post. */
            shreddit-post[domain*="redgifs.com"] [slot="post-media-container"],
            shreddit-post[content-href*="redgifs.com"] [slot="post-media-container"],
            [slot="post-media-container"]:has(shreddit-embed[providername="RedGIFs"]),
            [slot="post-media-container"]:has(shreddit-embed[html*="redgifs.com/ifr/"]),
            shreddit-embed[providername="RedGIFs"],
            shreddit-embed[html*="redgifs.com/ifr/"],
            iframe[src*="redgifs.com/ifr/"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }

            a[href="/answers/"],
            a[href^="/answers"],
            faceplate-tracker[noun="gen_guides_sidebar"],
            a[href="/answers/"],
            svg[icon-name="answers-outline"],
            *[href="/answers/"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
            }
            
            .reddit-banned, .reddit-search-banned, .reddit-answers-hidden {
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
            
            article.prehide, shreddit-post.prehide, [data-testid="search-post-unit"].prehide, [data-testid="search-community"].prehide, [data-id="search-media-post-unit"].prehide, [data-testid="search-post-with-content-preview"].prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
            }
            
            article:has(> shreddit-post):not(.reddit-approved) img,
            article[data-testid="post-container"]:not(.reddit-approved) img,
            shreddit-post:not(.reddit-approved) img,
            [data-testid="search-post-unit"]:not(.reddit-approved) img,
            [data-id="search-media-post-unit"]:not(.reddit-approved) img,
            [data-testid="search-post-with-content-preview"]:not(.reddit-approved) img {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            article:has(> shreddit-post).reddit-approved img,
            article[data-testid="post-container"].reddit-approved img,
            shreddit-post.reddit-approved img,
            [data-testid="search-post-unit"].reddit-approved img,
            [data-id="search-media-post-unit"].reddit-approved img,
            [data-testid="search-post-with-content-preview"].reddit-approved img {
                visibility: visible !important;
                opacity: 1 !important;
            }
        `;
        
        try {
            const head = document.head || document.documentElement;
            head.insertBefore(style, head.firstChild);
        } catch (e) {
            document.addEventListener('DOMContentLoaded', function() {
                (document.head || document.documentElement).appendChild(style);
            });
        }
    }

    addPreHidingCSS();

    try {
        if (ALWAYS_ALLOW_CURRENT_POST) {
            document.documentElement.classList.add('nr-allow-current-post');
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    try { document.body && document.body.classList.add('nr-allow-current-post'); } catch {}
                });
            } else {
                try { document.body && document.body.classList.add('nr-allow-current-post'); } catch {}
            }
        }
    } catch {}

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
        "r/OpenAI",
        "r/NVidia",
        "r/AMD",
        "r/Intel",
        "r/AyyMD",
	"r/buildapc",
	"r/buildmeapc",
	"r/RealHomePorn",
	"r/AmateursDoingIt"
    ];



    const redgifsKeyword = "www.redgifs.com";


    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro", "r/AlexaBliss", "r/AlexaPearl", "r/comfyui", "r/grok", "r/artificialintelligence", "r/AI", "r/WrestlingBotches"
    ];


    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /image enhancing/i,
	/Alexa/i, /Blis/i, /naked/i, /rule34/i, /Keibler/i, /morph/i, /inpaint/i, /art intel/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /soulgen/i, /ismartta/i,
	/Stacy/i, /Staci/i, /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /vegi/i,
	/enhanced image/i, /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, 
	/pics app/i, /ed17/i, /Lana Perry/i, /Del Rey/i, /vege/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /eras cloth/i, /La Premare/i,
	/GenHey/i, /arxiv/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i, /Tiffa/i, /Strat/i, /puz/i, /Sweee/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, 
	/Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /3dit/i, /ed1t/i, /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /her pant/i, 
	/she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /editing/i, /3d1t/i, /Sydney Sweeney/i, /Sweeney/i, /fap/i, /Sydnee/i, /Stee/i, /Waaa/i, /Stewart/i, /3d!7/i,
	/TOR-browser/i, /Feikki/i, /MS Edge/i, /AI Tool/i, /aitool/i, /Valtez/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /Chel5/i, /Steph/i, /St3ph/i, /editation/i, /penetration/i, /Paig3/i, 
	/P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /Lana Del Rey/i, /\bLana\b/i, /image app/i, /edi7/i, /syvavaarennos/i, /boy friend/i, /photo app/i, 
	/Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /picture app/i, /edit app/i, /pic app/i, /Opera/i, 
	/P4IG3/i, /syvävääre/i, /girl friend/i, /pillu/i, /perse/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /sexuaali/i, /yhdyntä/i, /application/i, /sukupuoliyhteys/i, /penetraatio/i,  
	/xray/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /seksi/i, /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /seksi kuvia/i, /uncensor app/i, 
	/clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i, /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /eroottinen/i, 
	/erotic/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synth/i, /Margot/i, /Robbie/i, /Johansson/i, /Ana de Armas/i, /Emily/i, /Emilia/i, /Ratajkowski/i, 
	/Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i, /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, 
	/edit for fun/i, /realistic AI/i, /dream girl/i,  /Derriere/i, /Backside/i, /läpinäkyvä/i, /panee/i, /panev/i, /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /yhdyntäkuvia/i,
	/Stratusfaction/i, /yhdynnässä/i, /seksivideo/i, /nussimis/i, /seksikuvia/i, /yhdyntä kuvia/i, /face plus/i, /panovideo/i, /pano video/i, /pano kuva/i, /panokuvat/i, /masturb/i, 
	/itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpi/i, /sormettamiskuv/i, 
	/sormittamiskuv/i, /sormetus/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /aikuis viihde/i, /jynkky/i, 
	/sheer/i, /aikuissisältö/i, /aikuissivusto/i, /homo/i, /lesbo/i, /transu/i, /pervo/i, /5yvä/i,  /face\+/i, /face+/i, /face\-/i, /bg remover/i, /lexi/i, /Elayna/i, /Eleyna/i, 
	/Eliyna/i, /Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elina/i, /Elyna/i, /Elyina/i, /Aikusviihde/i, /Aikus viihde/i, /La Primare/i, /Fantop/i, /Fan top/i, /Fan-top/i, 
	/Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i, /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, /twat/i, /topi-fan/i, 
	/topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, /softorbit/i, /softorbits/i, /VMWare/i,
	/soft-orbit/i, /soft-orbits/i, /VM Ware/i, /Virtual Machine/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hypervisor/i,  
	/hyper v/i, /hyperv/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /virtualworkstation/i, /virtuaaliworkstation/i, /hyper-v/i,
	/hyper visor/i, /\*/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, 
	/Cathy/i,  /v-machine/i, /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /virtmachine/i, 
	/Kathy/i, /virt-machine/i, /virtumachine/i, /vir mach/i, /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /vi mach/i, /virtual machi/i, 
	/virtuaali masiina/i, /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /virtuaalimasiina/i,
	/Katherine/i, /Kazuki/i, /Yoshiko/i, /Yoshihiko/i, /Hirata/i, /birppis/i, /irpp4/i, /b1rppis/i, /birpp1s/i, /b1rpp1s/i, /comfyui/i, /Lily Adam/i, /Lilly Adam/i, /Dualipa/i, 
	/comfy ui/i, /comfy ai/i, /comfyai/i, /comfy-ui/i, /comfy-ai/i, /Becky/i, /Becki/i, /Rebecca/i, /Amber Heard/i, /mid journey/i, /unstable diffusion/i, /Dua Lipa/i, /Jasmin/i,
	/ElonMusk/i, /stablediffused/i, /Hirada/i, /Mizubi/i, /Mizupi/i, /Mizuki/i, /Watanabe/i, /Watanaba/i, /Wakana/i, /Kana Urai/i, /Uehara/i, /Sherilyn/i, /jazmyn/i, /Jazmin/i, 
	/Jasmyn/i, /Primera/i, /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /rasikangas/i, /rasikannas/i, /cargil/i, /cargirl/i, /Lisa Varon/i, /Elon Musk/i, /Marie Varon/i, 
	/gargirl/i, /garcirl/i, /barlow/i, /Nikki/i, /HeyGen/i, /cargril/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, 
	/gargril/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, /Alici/i, /headgen/i, /head gen/i, /genhead/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, 
	/Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /Nia Jax/i, /McQueen/i, /Kasie Cay/i, /Mafiaprinsessa/i, /mangoanimat/i, /photo jiggle/i, /animat pic/i, 
	/animat pho/i, /ai-app/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /ai twerk/i, /twerk ai/i, /img animat/i, /ima animat/i, /photo animat/i, /image animat/i, 
	/make pic mov/i, /make pho mov/i, /make img mov/i, /make ima mov/i, /gif pic/i, /gif pho/i, /gif img/i, /gif ima/i, /photo to gif/i, /image to gif/i, /pic to gif/i, /pic to vid/i, 
	/photo to video/i, /image to video/i, /ph0t/i, /pho7/i, /ph07/i, /1m4g/i, /im4g/i, /!mag/i, /!m4g/i, /!mg/i, /v1d3/i, /vid3/i, /v1de/i, /vld3/i, /g!f/i, /mangoai/i, /mangoapp/i, 
	/mango-app/i, /mangoanim/i, /mango anim/i, /mango-anim/i, /lantaai/i, /lantaaa/i, /motionai/i, /changemotion/i, /swapmotion/i, /motionsw/i, /motionc/i, /poseAI/i, /AI-/i, /-AI/i, 
	/AIblow/i, /5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, /AI-suck/i, /drool/i, /RemovingAI/i, /blowjob/i, /bjob/i, /b-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, 
	/dro0l/i, /dr00l/i, /BJAI/i, /BJ-AI/i, /Suckjob/i, /B-J0b/i, /Suckj0b/i, /Suck-job/i, /Suck-j0b/i, /Mouthjob/i, /Mouthj0b/i, /M0uthjob/i, /M0uthj0b/i, /Mouth-job/i, /Mouth-j0b/i, 
	/M0uth-job/i, /M0uth/i, /buttsex/i, /Mou7h/i, /MouthAI/i, /MouthinAI/i, /MouthingAI/i, /AIMouth/i, /BlowAI/i, /BlowsAI/i, /BlowingAI/i, /JobAI/i, /AIJob/i, /ZuckCock/i, /Mouthig/i, 
	/Suck/i, /ZuckC/i, /AroundHer/i, /ZuckP/i, /Zuckz/i, /Zucks/i, /Zuzkc/i, /YouZuck/i, /ZuckYou/i, /AIZuck/i, /ZuckAI/i, /M0u7h/i, /ZuckD/i, /Cuck/i, /Guck/i, /SDuck/i, /Cheek/i, 
	/Sukc/i, /Sukz/i, /AISucc/i, /SuccAI/i, /Suqz/i, /Suqs/i, /Suqc/i, /Suqq/i, /Suqi/i, /Sucq/i, /cukc/i, /boob/i, /b0ob/i, /b00b/i, /bo0b/i, /titjob/i, /titty/i, /titti/i, /j0b/i, 
	/w0rk/i, /assjob/i, /buttjob/i, /wank/i, /w4nk/i, /tittt/i, /tiitt/i, /crotch/i, /thigh/i, /legjob/i, /asssex/i, /titsex/i, /ass sex/i, /butt sex/i, /tit sex/i, /butt stuff/i, 
	/buttstuff/i, /p0rn/i, /redtube/i, /asstube/i, /butttube/i, /xhamster/i, /adulttube/i, /adult tube/i, /FapAI/i, /HerAi/i, /AiHer/i, /SheAi/i, /AIShe/i, /AroundAI/i, /HerAround/i, 
	/TurnHer/i, /HerTurn/i, /SheAround/i, /AroundShe/i, /TurnShe/i, /SheTurn/i, /-her/i, /her-/i, /-she/i, /she-/i, /AIFap/i, /AIHug/i, /HugAI/i, /AIOut/i, /AIAdult/i, /AIContent/i, 
	/AdultAI/i, /ContentAI/i, /AIMake/i, /AICreate/i, /CreateAI/i, /AICreating/i, /CreatingAI/i, /AICreation/i, /CreationAI/i, /MakeAI/i, /AIMaking/i, /MakingAI/i, /OutAI/i, /t0ol/i, 
	/AIStuff/i, /StuffAI/i, /to0l/i, /t00l/i, /70ol/i, /7o0l/i, /700l/i, /FindAI/i, /FinderAI/i, /FindingAI/i, /AIFind/i, /DirectoryAI/i, /AIDirect/i, /AILook/i, /LookAI/i, /LooksAI/i, 
	/LookupAI/i, /Look-upAI/i, /LookingUpAI/i, /UpLookAI/i, /AIUpLook/i, /ButtAPP/i, /DrawingsAI/i, /AIAPP/i, /AssAI/i, /AIAss/i, /AssAPP/i, /AppAss/i, /Ass-/i, /-Ass/i, /Butt-/i, 
	/-Butt/i, /Cooch-/i, /-Cooch/i, /Coochie-/i, /Kewch-/i, /1mag/i, /-Kewch/i, /Kewchie-/i, /Coachie/i, /BoobysAI/i, /7ush/i, /7u5h/i, /tu5h/i, /AITit/i, /TitAI/i, /BoobiesAI/i, 
	/TitsAI/i, /AIBoob/i, /BoobAI/i, /BoobsAI/i, /BoobieAI/i, /BoobyAI/i, /APPAI/i, /cooch/i, /K3wc/i, /ellie/i, /3llie/i, /elli3/i, /3lli3/i, /cha0tic/i, /AISketch/i, /SketchAI/i, 
	/AIDraw/i, /AIDrew/i, /DrawAI/i, /DrewAI/i, /DrawsAI/i, /DrawingAI/i, /PaintingAI/i, /PaintingsAI/i, /OpenHerLegs/i, /OpeningHerLegs/i, /OpenLegs/i, /OpeningLegs/i, /PaintAI/i,  
	/OpensLegs/i, /OpensHerLegs/i, /SpreadLeg/i, /SpreadHerLeg/i, /cunnt/i, /cunnn/i, /SpreadingLeg/i, /HerSkirt/i, /PaintsAI/i, /AIPain/i, /SpreadingHerLeg/i, /SpreadsHerLeg/i, 
	/SpreadsLeg/i, /HerThig/i, /HerLeg/i, /HerThic/i, /SheThig/i, /SheLeg/i, /SheThic/i, /LegShe/i, /LegsShe/i, /Thicc/i, /ThickShe/i, /SheSkirt/i, /Her Skirt/i, /She Skirt/i, 
	/Girl Skirt/i, /Girls Skirt/i, /Womans Skirt/i, /Woman Skirt/i, /Women Skirt/i, /Girly Skirt/i, /-lab/i, /depn/i, /d3pn/i, /deppn/i, /depenu/i, /depeni/i, /d3ppn/i, /d3penu/i, 
	/d3p3nu/i, /dep3nu/i, /d3peni/i, /d3p3ni/i, /d3p3n1/i, /d3p3n!/i, /dep3n1/i, /dep3n!/i, /d3pen1/i, /d3pen!/i, /p05/i, /po5/i, /p0s/i, /postur/i, /posin/i, /pose/i, /iconicto/i, 
	/diepn/i, /artif/i, /artin/i, /-tool/i, /deipn/i, /Claude/i, /Anthropic/i, /wedgi/i, /wedge/i, /wedgy/i, /wedg1/i, /wedg!/i, /w3dg/i, /w33d/i, /we3d/i, /w3ed/i, /w333d/i, /w3333/i, 
	/we333/i, /w3e33/i, /w33e3/i, /w333e/i, /we33e/i, /we3e3/i, /wee3e/i, /w3e3e/i, /weee/i, /edgin/i, /3dg1n/i, /edgyi/i, /edgy1/i, /3dgy1/i, /3dgin/i, /edg1n/i, /edg1i/i, /edgi1/i,
	/3dg1i/i, /3dgi1/i, /edgiy/i, /Grok-AI/i, /TwitterAI/i, /Anthr/i, /Antro/i, /s0ftw/i, /softw/i, /w4re/i, /war3/i, /w4r3/i, /p41n/i, /pa1n/i, /p4in/i, /ndif/i, /ndfy/i, /bliswwe/i,
	/nd!f/i, /ndlf/i, /shag/i, /5hag/i, /5h4g/i, /sh4g/i, /f4gg/i, /fagg3/i, /fagger/i, /vaat.*pois/i, /vaatteet pois/i,/edgye/i, /rintalii/i, /rinta lii/i, /tissi/i, /r1nta/i, /r1nt4/i, 
	/rint4/i, /l1ivi/i, /liiv1/i, /l1iv1/i, /li1v1/i, /l11v1/i, /l11vi/i, /bl15s/i, /bl1s5/i, /bl155/i, /bl1ss/i, /bli55/i, /anusaukko/i, /anus-aukko/i, /anus aukko/i, /pers aukko/i, 
	/nd1f/i, /persaukko/i, /perseaukko/i, /perse aukko/i, /perse-aukko/i, /pers-aukko/i, /li1vi/i, /p3rs aukko/i, /p3r5 aukko/i, /Monroe/i, /per5 aukko/i, /p3rs-aukko/i, /Redmond/i, 
	/p1p4r/i, /p3rse/i, /pers3/i, /p3rs3/i, /per5e/i, /per53/i, /p3r5e/i, /p3r53/i, /rints/i, /r1nts/i, /r1nt5/i, /rint5/i, /pip4r/i, /p1par/i, /Jackie/i, /Kairi/i, /sexx/i, /sexi/i, 
	/p1p4r/i, /Kiana/i, /Jiana/i, /Kairi Sane/i, /Kairi's/i, /Kairii/i, /Sexxy/i, /Sexy/i, /Goddess/i, /Kendal Grey/i, /Kayla/i, /Braxton/i, /alex4/i,  /Samantha/i, /Samantha Irvin/i, 
	/Samantha Irwin/i, /4lexa/i, /al3xa/i, /alex4/i, /4l3xa/i, /al3x4/i, /4l3x4/i, /4lex4/i, /blis5/i, /bli5s/i, /artintel/i, /artifi intel/i, /ardrob/i, /wardrobe/i, /robe malfunc/i, 
	/ring gear malfunc/i, /ring malfunc/i, /solrvca/i, /billieeilish/i, /billie eilish/i, /ivynile/i, /Ivy Nile/, /UnderRatedLadies/i, /Ivy+Nile/i, /SkylarRaye/i, /Serrano/i, /Zerrano/i, 
	/windsor/i, /winds0r/i, /w1nds0r/i, /w1ndsor/i, /woman/i, /women/i, /girl/i, /girls/i, /girlfriend/i, /boyfriend/i, /amateur/i, /poses/i, /posing/i, /breast/i, /breasts/i, /nudity/i, 
	/ladies/i, /womens/i, /womans/i, /ladies'/i, /lady's/i, /girl's/i, /woman'/i, /rule 34/i, /got hard/i, /get hard/i, /Vince Russo/i, /Dave Meltzer/i, /nudify/i, /nudifier/i, /nudifying/i, 
	/lady/i, /Jessika Carr/i, /Xia Li/i, /undressify/i, /getdisciplined/i, /Toni Storm/i, /Skye Blue/i, /Carmella/i, /Mariah May/i, /Harley/i, /Cameron/i, /Hayter/i, /Britt Baker/i, /Ripley/i, 
	/Rhea Ripley/i, /Blake/i, /transv/i, /transvestite/i, /queer/i, /undressing/i, /undressifying/i, /LGBTQ/i, /Pride/i, /Jessica Carr/i, /Jessika Karr/i, /Jessika/i, /prostitute/i, /escort/i, 
	/fetish/i, /adult/i, /explicit/i, /mature/i, /sexual/i, /Jessica/i, /Jessica Karr/i, /Analsex/i, /orgasm/i, /vagina/i, /tushy/i, /tushi/i, /genital/i, /busty/i, /camgirl/i, /onlyfans/i, 
	/raped/i, /org@sm/i, /whore/i, /celeb/i, /cumslut/i, /Tiffany Stratton/i, /Lillian/i, /Garcia/i, /Jordynne/i, /Trish/i, /Stratus/i, /orga\$m/i, /0rg@sm/i, /DeepSeek AI/i, /ai app/i, 
	/nudyi/i, /orga5m/i, /fantime/i, /fansly/i, /justforfans/i, /patreon/i, /CJ Perry/i, /org@5m/i, /manyvids/i, /0rg@5m/i, /chaturbate/i, /myfreecams/i, /fat fetish/i, /camsoda/i, /Mandy/i,
	/stripchat/i, /bongacams/i, /livejasmin/i,  /0rgasm/i, /Liv Xoxo/i, /Chelsea/i, /Piper Niven/i, /Hardwell/i, /5 feet of fury/i, /bliss/i, /alexa bliss/i, /her ass/i, /she ass/i, /venice/i,
	/her's ass/i, /hers ass/i, /Morgan Xoxo/i, /Tiffy time/i, /Stratton/i, /Tiffany/i, /Mandy Rose/i, /Chelsea Green/i, /Zelina/i, /Zelina Vega/i, /Valhalla/i, /Sportskeeda/i, /IYO SKY/i, 
	/Io Shirai/i, /Iyo Shirai/i, /IO SKY/i, /Dakota Kai/i, /Asuka/i, /Meiko/i, /Satomura/i, /playboy/i, /Dynamite/i, /Shayna Baszler/i, /Ronda Rousey/i, /Dana Brooke/i, /Alicia Fox/i, /Summer Rae/i, 
	/Microsoft Edge/i, /jizzed/i, /Torrie/i, /Sasha/i, /Layla/i, /Michelle McCool/i, /Eve Torres/i, /Kelly Kelly/i, /Melina/i, /Melina wrestler/i, /Jillian Hall/i, /five feet of fury/i, /raepd/i, 
	/Wilson/i, /Mickie James/i, /Maria/i, /Kanellis/i, /Beth Phoenix/i, /Victoria/i, /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i, /Rampaige/i, /Madison Rayne/i, /Velvet Sky/i, /Jamie Hayter/i, 
	/Saraya/i, /filmora/i, /wondershare/i, /Tessmacher/i, /Havok/i, /Su Yung/i, /Miko Satomura/i, /Mercedes/i, /Valkyrie/i, /Deonna/i, /Purrazzo/i, /Vaquer/i, /Vaqueer/i, /Vaguer/i, /Vagueer/i, 
	/Tamina/i, /Anna Jay/i, /Tay Conti/i, /Tay Melo/i, /Nightingale/i, /Statlander/i, /Hikaru Shida/i, /Tessa/i, /Sakazaki/i, /Nyla Rose/i, /Emi Sakura/i, /Fatal Influence/i, /Aubert/i, /Brooke/i, 
	/Hikaru/i, /aivideo/i, /Penelope/i, /Roxanne/i, /Shotzi/i, /Blackheart/i, /Tegan/i, /Charlotte/i, /Kamifuku/i, /Sarray/i, /OperaGX/i, /Sky Wrestling/i, /Becky Lynch/i, /Bayley/i, /Bailey/i, 
	/Giulia/i, /Michin/i, /nofap/i, /Mia Yim/i, /AJ Lee/i, /Paige/i, /Bianca/i, /Belair/i, /Alicia/i, /Atout/i, /stephanie/i, /No nut/i, /Thekla/i, /Liv Morgan/i, /Jordynne Grace/i, /NXT Womens/i, 
	/NXT Women/i, /NXT Woman/i, /Aubrey/i, /Edwards/i, /Renee/i, /Maryse/i, /Sasha Banks/i, /Jackson/i, /Jakara/i, /Lash Legend/i, /Izzi Dame/i, /Alba Fyre/i, /Isla Dawn/i, /Sydney/i, /Gina Adams/i, 
	/rawdog/i, /Kelly2/i, /Russo/i, /Raquel Rodriguez/i, /Scarlett/i, /Bordeaux/i, /Kayden/i, /Katana Chance/i,  /Carter/i, /Valkyria/i, /Tamina Snuka/i, /Renee Young/i, /Priscilla/i, /Cathalina/i, 
	/Roxanne Perez/i, /Indi Hartwell/i, /Hartwell/i, /Karmen/i, /Davenport/i, /wonder share/i, /Lola Vice/i, /Maxxine Dupri/i, /Karmen Petrovic/i, /Brittany/i, /Renee Paquette/i, /Ava Raine/i, 
	/Cora Jade/i, /Jacy Jayne/i, /Gigi Dolin/i, /Thea Hail/i, /Tatum/i, /Paxley/i, /Fallon Henley/i, /Sky wrestle/i, /Blair/i, /venoisi/i, /Women's/i, /rawdogging/i, /Kelani Jordan/i, /Electra/i, 
	/Wendy Choo/i, /Yulisa/i, /Valentina/i, /Valentine/i, /Amari Miller/i, /venoise/i, /AlexaBliss/i, /Sol Ruca/i, /AlexaPearl/i, /Arianna/i, /Natalya/i, /Nattie/i, /Woman's/i, /Diffusion/i, 
	/StableDiffusion/i, /UnStableDiffusion/i, /Dreambooth/i, /Dream booth/i, /sperm/i, /AI generated/i, /AI-generated/i, /generated/i, /machine learning/i, /artificial intelligence/i, /AI girl/i, 
	/neural network/i, /deep learning/i, /Naomi/i, /Jazmyn Nyx/i, /stable diffusion/i, /artificial/i, /synthetic/i, /computer generated/i, /algorithm/i, /Angelina/i, /automated/i, /text to image/i, 
	/editor/i, /image enhanced/i, /Answers BETA/i, /ai video/i, /Irving/i,  /Belts Mone/i, /Amanda Huber/i, /Ivy Nile/i, /Shir/i, /kawa/i, /perver/i, /Mariah/i,


   // Boundaried Regexes
    	/\bher's\b/i, /\bshe's\b/i, /\bAmber\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /\blexi\b/i, /\bButt\b/i, /\bsexy\b/i, /\bKarr\b/i, /\bMina\b/i, /\bTisu\b/i, /\bTisut\b/i, /\bRinnat\b/i, /\bXoxo\b/i, 
	/\bAnaali\b/i,  /\bLGBT\b/i, /\bShe\b/i, /\bJazz\b/i, /\bjizz\b/i, /\bKaina\b/i, /\bZoey\b/i, /\bKairi\b/i, /\bxAI\b/i,/\b50ft\b/i, /\bVidu\b/i, /\bJade\b/i, /\bmotion\b/i, /\bMachaine\b/i, 
	/\bNyx\b/i, /\bMachiine\b/i, /\bLily\b/i, /\bMacheine\b/i, /\bLili\b/i, /\bAnt\b/i, /\bAva\b/i, /\bAnal-\b/i, /\b-Anal\b/i, /\bAnal\b/i, /\bCum\b/i, /\bNox\b/i, /\bFuku\b/i, /\bDick\b/i, 
	/\bAnswers BETA\b/i, /\bCock\b/i, /\bporn\b/i, /\bnude\b/i, /\bxxx\b/i, /\br34\b/i, /\br_34\b/i, /\bCarr\b/i, /\bTaya\b/i, /\bMachiene\b/i, /\bcam4\b/i, /\bGrok\b/i, /\bVM\b/i, /\bVMs\b/i,
	/\bTegan\b/i, /\bS0ft\b/i, /\bsex\b/i, /\bVMs\b/i, /\bRape\b/i, /\bEmma\b/i, /\bAnus\b/i, /\bNiven\b/i,  /\bGirl\b/i, /\bPenis\b/i, /\bLady\b/i, /\bNSFW\b/i, /\bB-Fab\b/i, /\bAdult\b/i, 
	/\bB-Fab\b/i, /\bVM\b/i, /\bJaida\b/i, /\bSeksi\b/i, /\bRiho\b/i, /\bIzzi\b/i, /\bbra\b/i, /\bSlut\b/i, /\bTor\b/i,  /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bLita\b/i, /\bHer\b/i, 
	/\bJaida\b/i, /\bedit\b/i, /\bADMX\b/i, /\bSol\b/i, /\bAi-\b/i, /\bPeba\b/i, /\bBeba\b/i, /\bBabe\b/i, /\bBepa\b/i, /\bGina\b/i, /\bLiv\b/i, /\bDame\b/i, /\bTay\b/i, /\bazz\b/i, /\bIndi\b/i,
	/\bTissi\b/i,


   // Nuclear/special regexes
/gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img)))|(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|denois(?:e|er|ing)?)(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img))?(?:[\s_\-\/.]{0,3}gr[a4][i1l]n)|gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic|image|img))|(?:ph(?:o|0)?t(?:o|0)?|pic|image|img)(?:[\s_\-\/.]{0,3}fix)/i, /lex.*bl/i, /liv.*morgan/i, /saad.*pipar/i, /s4ad.*pipar/i, /s44d.*pipar/i, /sa4d.*pipar/i, /rint.*pois/i, /dress.*remov/i,
        /(?:n(?:o|0)ise(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?))|(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?)(?:[\s_\-\/.]{0,3})n(?:o|0)ise|de[\s_\-\.]?n(?:o|0)is(?:e|er|ing)?)/i, /make.*(move|gif|video)/i, /photo.*(move|gif|video)/i, /image.*(move|gif|video)/i, /pic.*(move|gif|video)/i, /img.*(move|gif|video)/i, /booty/i, /ass.*(animat|ai|move)/i, /twerk/i, /twerking/i, /jiggle/i, /bounce.*(ai|gif)/i, /booty.*(ai|gif|video|animat)/i, /ass.*(ai|gif|video|animat)/i, /undress/i, /strip.*ai/i, /nude.*ai/i, /clothes.*remove/i, /remove.*(clothes|clothing|dress)/i, /face.*(swap|deepfake|replace)/i, /hous.*pois/i, /pait.*pois/i, /liiv.*pois/i, /alushous.*pois/i, /alkkarit.*pois/i, /alusvaat.*pois/i, /clothing.*remove/i, /\bra\*e\b/i,/\br\*pe\b/i, /\*ape/i, /rap\*/i, /0rga\$m/i,
/alexa.*(wwe|wrest|ras|NXT|pro)/i, /blis.*(wwe|wrest|ras|NXT|pro)/i, /lexa.*(wwe|wrest|ras|NXT|pro)/i, /lexi.*(wwe|wrest|ras|NXT|pro)/i, /bils.*(wwe|wrest|ras|NXT|pro)/i, /lex.*(kauf|cabr|carb)/i, /model.*(mach|langu)/i, /robe.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin)/i,
/robe.*(malf|func)/i, /ring gear|trunk|pant|shirt|jacket.*(malf|func)/i, /malfunc.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin|ring)/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i,  /\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /see[- ]?through/i, /AI[ -]?generated/i, /generated[ -]?by[ -]?AI/i, /artificial[ -]?intelligence/i, /machine[ -]?learning/i, /neural[ -]?network/i, /deep[ -]?learning/i, /midjourney/i, /dall[ -]?e/i, /stable[ -]?diffusion/i, /computer[ -]?generated/i, /text[ -]?to[ -]?image/i, /image[ -]?generation/i, /AI[ -]?art/i, /synthetic[ -]?media/i, /algorithmically/i, /bot[ -]?generated/i, /automated[ -]?content/i,

    ];


    // v29.5.0: One authoritative regex list, with a compiled fast lane for simple
    // literals. Complex regexes (boundaries, lookarounds, wildcards, etc.) are
    // executed unchanged; no keywords are removed or given different semantics.
    // Rebuild when the existing dynamic wrestler-name feature extends the list.
    let redditCompiledRegexCountV295 = -1;
    let redditLiteralRegexGroupsV295 = [];
    let redditComplexRegexesV295 = [];

    function rebuildRedditRegexMatcherV295() {
        const literals = [];
        const complex = [];
        for (const expression of regexKeywordsToHide) {
            // Only combine pure, case-insensitive literal RegExp sources. Do not
            // reinterpret regex syntax, flags or matching order within a pattern.
            if (expression instanceof RegExp && expression.flags === 'i' &&
                !/[.*+?^${}()|[\]\\]/.test(expression.source)) {
                literals.push(expression.source);
            } else {
                complex.push(expression);
            }
        }
        const groups = [];
        // Small alternation groups avoid an excessively large compiled regex.
        for (let i = 0; i < literals.length; i += 96) {
            groups.push(new RegExp('(?:' + literals.slice(i, i + 96).join('|') + ')', 'i'));
        }
        redditLiteralRegexGroupsV295 = groups;
        redditComplexRegexesV295 = complex;
        redditCompiledRegexCountV295 = regexKeywordsToHide.length;
    }

    function isBlockedByRedditRegexesV295(text) {
        if (!text) return false;
        if (redditCompiledRegexCountV295 !== regexKeywordsToHide.length) {
            rebuildRedditRegexMatcherV295();
        }
        for (const group of redditLiteralRegexGroupsV295) {
            if (group.test(text)) return true;
        }
        for (const expression of redditComplexRegexesV295) {
            if (expression.test(text)) return true;
        }
        return false;
    }

    // --- Dynamic Banned List from Chrome Storage ---
    function applyDynamicWrestlerBans() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            try {
                chrome.storage.local.get(['wrestling_women_urls'], function(result) {
                    if (result.wrestling_women_urls && Array.isArray(result.wrestling_women_urls)) {
                        let addedCount = 0;
                        const localExclusions = ['aj-lee', 'aj', 'becky-lynch', 'becky'];

                        result.wrestling_women_urls.forEach(url => {
                            const parts = url.split('/').filter(Boolean);
                            const slug = parts[parts.length - 1].toLowerCase();
                            
                            if (localExclusions.includes(slug)) return;

                            const name = slug.replace(/-/g, ' ');
                            const namePattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                            const noSpacePattern = namePattern.replace(/\s+/g, '');
                            const boundariedRegex = new RegExp('\\b' + namePattern + '\\b', 'i');

                            let isDuplicate = false;
                            for (let i = 0; i < regexKeywordsToHide.length; i++) {
                                if (regexKeywordsToHide[i].toString() === boundariedRegex.toString()) {
                                    isDuplicate = true; break;
                                }
                            }
                            if (!isDuplicate) {
                                regexKeywordsToHide.push(boundariedRegex);
                                addedCount++;
                            }

                            if (namePattern !== noSpacePattern) {
                                const spacelessRegex = new RegExp('\\b' + noSpacePattern + '\\b', 'i');
                                let isSpacelessDuplicate = false;
                                for (let i = 0; i < regexKeywordsToHide.length; i++) {
                                    if (regexKeywordsToHide[i].toString() === spacelessRegex.toString()) {
                                        isSpacelessDuplicate = true; break;
                                    }
                                }
                                if (!isSpacelessDuplicate) {
                                    regexKeywordsToHide.push(spacelessRegex);
                                    addedCount++;
                                }
                            }
                        });

                        if (addedCount > 0) {
                            devLog(`Dynamically added ${addedCount} wrestler names from shared storage to blocklist as boundaried regexes.`);
                            try { enforceSanity(); runAllChecks(); } catch(e) {}
                        }
                    }
                });
            } catch(e) {}
        }
    }
    applyDynamicWrestlerBans();

    try { regexKeywordsToHide.push(/Lisa Mar(?:ie|ia) Varon/i); } catch {}

    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel",
        "in-feed-community-recommendations",
        "in-feed-community-recommendations h3",
        "community-recommendation"
    ];

    // --- OPTIMIZED MEMORY MANAGEMENT ---
    const MEMORY_CAP_GB = IS_FIREFOX ? 3.5 : 6;         
    const MEMORY_WARNING_GB = IS_FIREFOX ? 2.2 : 3;
    const MAX_CACHE_SIZE = IS_FIREFOX ? 320 : 512;         
    const MAX_APPROVAL_PERSISTENCE = IS_FIREFOX ? 30 : 40;
    const CLEANUP_INTERVAL = IS_FIREFOX ? 7000 : 10000;  
    const MEMORY_CHECK_INTERVAL = 4000;                  
    const CRITICAL_MEMORY_THRESHOLD = 0.65;              

    const processedElements = new WeakSet();
    const processedSearchItems = new WeakSet();
    const bannedSubredditCache = new Map();
    const contentBannedCache = new Map();
    const shadowRootsProcessed = new WeakSet();
    const permanentlyApprovedElements = new WeakSet();
    const approvalPersistence = new Map();
    const eventListenersAdded = new WeakSet();

    const intervalIds = new Set();
    const observerInstances = new Set();
    const searchDropdownObserverTargetsV295 = new Set();

    const shadowRootObservers = new Map();

    let lastFilterTime = -Infinity;
    let pendingOperations = false;
    let memoryCleanupCount = 0;
    let lastMemoryWarning = 0;
    let isCleaningUp = false;

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

                const keep = IS_FIREFOX ? 8 : 10;
                if (isCritical || isOverCap) {
                    const entries = Array.from(approvalPersistence.entries()).slice(-keep);
                    approvalPersistence.clear();
                    entries.forEach(([key, value]) => approvalPersistence.set(key, value));
                }
                
                observerInstances.forEach(observer => {
                    try { if (observer && typeof observer.disconnect === 'function') observer.disconnect(); } catch {}
                });
                observerInstances.clear();
                for (const target of searchDropdownObserverTargetsV295) {
                    try { delete target.__searchObserved; } catch {}
                }
                searchDropdownObserverTargetsV295.clear();
                HEAVY_OBSERVERS_ACTIVE = false; 

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

    function suspendHeavyObservers() {
        if (!HEAVY_OBSERVERS_ACTIVE) return;
        try {
            observerInstances.forEach(mo => { try { mo.disconnect(); } catch {} });
            observerInstances.clear();
            for (const target of searchDropdownObserverTargetsV295) {
                try { delete target.__searchObserved; } catch {}
            }
            searchDropdownObserverTargetsV295.clear();
            HEAVY_OBSERVERS_ACTIVE = false;
            devLog('🛌 Observers hibernated');
        } catch {}
    }

    function attachMainObservers() {
        try {
            const observer = new MutationObserver(processNewElements);
            observerInstances.add(observer);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });

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

            // Also restore previously observed shadow roots after a real suspend.
            for (const [root, mo] of shadowRootObservers) {
                if (root.host?.isConnected) {
                    mo.observe(root, { childList: true, subtree: true, attributes: false, characterData: false });
                    observerInstances.add(mo);
                } else {
                    shadowRootObservers.delete(root);
                }
            }
            HEAVY_OBSERVERS_ACTIVE = true;
        } catch {}
    }

    function resumeHeavyObservers() {
        if (HEAVY_OBSERVERS_ACTIVE) return;
        try {
            attachMainObservers();
            observeSearchDropdown();
            HEAVY_OBSERVERS_ACTIVE = true;
            devLog('🌙 Observers resumed');
        } catch {}
    }

    function monitorMemoryPressure() {
        const memInfo = getMemoryUsage();
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
            if (document.visibilityState === 'hidden') {
                suspendHeavyObservers();
                return;
            }
        }

        if (document.visibilityState === 'visible' && !HEAVY_OBSERVERS_ACTIVE) {
            resumeHeavyObservers();
        }
    }

    function cleanup() {
        devLog('🧹 Performing cleanup...');
        
        intervalIds.forEach(id => {
            try { clearInterval(id); } catch {}
        });
        intervalIds.clear();

        observerInstances.forEach(observer => {
            try { if (observer && typeof observer.disconnect === 'function') observer.disconnect(); } catch {}
        });
        observerInstances.clear();
        HEAVY_OBSERVERS_ACTIVE = false;

        cleanupCaches(true);
        
        const memInfo = getMemoryUsage();
        if (memInfo) {
            devLog(`🧹 Cleanup completed - Memory: ${memInfo.usedGB}GB`);
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cleanupCaches();
            suspendHeavyObservers();
        } else {
            resumeHeavyObservers();
            runAllChecks();
        }
    });

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    function isPostPage() {
        const url = window.location.href;
        return url.includes('/comments/') && !url.includes('/s/') && !url.includes('?') && url.split('/').length >= 7;
    }

    // Answers markup is immediately concealed by document-start CSS. The expensive
    // navigation text sweep is only a fallback, not a 150ms whole-page workload.
    let lastAnswersNavigationSweepV295 = -Infinity;
    function hideAnswersButton() {
        const now = performance.now();
        if (now - lastAnswersNavigationSweepV295 < 1800) return;
        lastAnswersNavigationSweepV295 = now;
        try { window.__nrRemoveAnswersIn_forAnswers && window.__nrRemoveAnswersIn_forAnswers(document); } catch {}
        try { document.querySelectorAll('a[href="/answers/"], a[href^="/answers"]').forEach(el => safelyHideElement(el)); } catch {}
        try { document.querySelectorAll('faceplate-tracker[noun="gen_guides_sidebar"]').forEach(el => safelyHideElement(el)); } catch {}
        try {
            document.querySelectorAll('span.text-global-admin.font-semibold.text-12').forEach(span => {
                if (span.textContent && span.textContent.trim() === 'BETA') {
                    const parent = span.closest('a, li, div, faceplate-tracker');
                    if (parent) safelyHideElement(parent); else safelyHideElement(span);
                }
            });
        } catch {}
    }

    function throttle(fn, wait) {
        // Both callers are MutationObservers. Previously a queued idle callback
        // held only the FIRST mutation array and silently discarded later DOM
        // insertions. Keep a bounded queue and flush promptly on the main thread.
        let lastCall = -Infinity;
        let timer = null;
        let pending = [];

        function flush() {
            timer = null;
            if (!pending.length) return;
            lastCall = performance.now();
            const next = pending.splice(0, 30);
            fn(next);
            if (pending.length) timer = setTimeout(flush, wait);
        }

        return function(mutations) {
            if (Array.isArray(mutations)) pending.push(...mutations);
            else if (mutations) pending.push(mutations);
            // Bound backlog during unusually large React commits. The overflow
            // gets a full post scan (still fail-closed) rather than keeping the
            // renderer blocked by an unlimited queue of old mutation records.
            if (pending.length > 180) {
                pending = pending.slice(-180);
                queueRedditOverflowSweepV295();
            }
            if (timer === null && pending.length) {
                const remaining = Math.max(0, wait - (performance.now() - lastCall));
                if (remaining === 0) flush();
                else timer = setTimeout(flush, remaining);
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

    function extractCompletePostContent(element) {
        try {
            // textContent includes Reddit's inline hydration scripts. Their
            // opaque JavaScript IDs sometimes accidentally match banned words,
            // resulting in entire harmless posts being removed. Screen text
            // nodes belonging to the post, not SCRIPT/STYLE/TEMPLATE payloads.
            const chunks = [];
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node;
            let totalLength = 0;
            while ((node = walker.nextNode()) && totalLength < 6000) {
                if (node.parentElement?.closest('script, style, noscript, template')) continue;
                const value = node.nodeValue || '';
                if (!value.trim()) continue;
                chunks.push(value);
                totalLength += value.length;
            }

            // Preserve the existing attribute/metadata screening, which can
            // catch blocked terms not printed as visible text in the post.
            const metadataElements = element.querySelectorAll(
                '[aria-label], [title], [alt], [data-permalink], [data-testid]'
            );
            const targets = [element, ...metadataElements];
            for (const target of targets) {
                if (target.closest?.('script, style, noscript, template')) continue;
                for (const attribute of ['data-permalink', 'data-testid', 'aria-label', 'title', 'alt']) {
                    const value = target.getAttribute?.(attribute);
                    if (value && value.length > 2) chunks.push(value);
                }
            }
            return chunks.join(' ').trim();
        } catch (error) {
            // Never fall back to script-inclusive textContent on error.
            return element.innerText || '';
        }
    }

    function checkTextForKeywords(textContent, isSafeSub = false) {
        if (!textContent) return false;
        
        let lowerText = textContent.toLowerCase();
        if (lowerText.length > 2000) lowerText = lowerText.substring(0, 2000); 
        
        const cacheKey = (isSafeSub ? 'safe:' : 'global:') + lowerText;
        if (contentBannedCache.has(cacheKey)) return contentBannedCache.get(cacheKey);
        
        if (contentBannedCache.size >= MAX_CACHE_SIZE) {
            const entries = Array.from(contentBannedCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
            contentBannedCache.clear();
            entries.forEach(([key, value]) => contentBannedCache.set(key, value));
        }

        let strippedText = lowerText.replace(/[^a-zäöå\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const textVariants = [lowerText, strippedText];

        for (let t = 0; t < textVariants.length; t++) {
            const textToTest = textVariants[t];
            if (!textToTest) continue;

            if (isBlockedByRedditRegexesV295(textToTest)) {
                contentBannedCache.set(cacheKey, true);
                return true;
            }
        }
        
        contentBannedCache.set(cacheKey, false);
        return false;
    }

    function isSafeAcronymSuffix(word) {
        const safeAiWords = ['samurai', 'bonsai', 'mumbai', 'thai', 'dubai', 'shanghai', 'hawaii', 'chai', 'sinai', 'kawaii'];
        for (let i=0; i<safeAiWords.length; i++) {
            if (word.endsWith(safeAiWords[i])) return true;
        }
        return false;
    }

    function isSearchTextBanned(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        const strippedText = lowerText.replace(/[^a-zäöå\s]/g, ' ').replace(/\s+/g, ' ').trim();
        
        const textVariants = [lowerText, strippedText];

        for (let t = 0; t < textVariants.length; t++) {
            const textToTest = textVariants[t];
            if (!textToTest) continue;
            
            if (textToTest.includes('openai') || textToTest.includes('chatgpt') || textToTest.includes('airbnb')) continue;

            for (let i = 0; i < adultSubreddits.length; i++) {
                if (textToTest.includes(adultSubreddits[i].toLowerCase().replace('r/', ''))) return true;
            }

            if (textToTest.includes(redgifsKeyword.toLowerCase())) return true;

            if (isBlockedByRedditRegexesV295(textToTest)) return true;
            
            const words = textToTest.split(/\s+/);
            const exactMatches = ['ai', 'llm', 'mlm'];
            for (let w = 0; w < words.length; w++) {
                const word = words[w];
                if (!word) continue;
                
                for (let a = 0; a < exactMatches.length; a++) {
                    const ac = exactMatches[a];
                    if (word === ac || (word.endsWith(ac) && !isSafeAcronymSuffix(word))) return true;
                }
                
                if (word.startsWith('ai') && word.length > 2) {
                    const rest = word.substring(2);
                    const badSuffixes = ['video', 'art', 'gen', 'chat', 'bot', 'girl', 'porn', 'xxx'];
                    if (badSuffixes.some(s => rest.startsWith(s))) return true;
                }
            }
        }
        return false;
    }

    function isNameBannedByPrefixSuffix(name) {
        if (!name) return false;
        const lowerName = name.toLowerCase();
        const strippedName = lowerName.replace(/[^a-zäöå]/g, ''); 
        
        const variants = [lowerName, strippedName];
        
        for (let t=0; t<variants.length; t++) {
            const textToTest = variants[t];
            if (!textToTest) continue;
            
            if (textToTest.includes('openai') || textToTest.includes('chatgpt') || textToTest.includes('airbnb')) continue;

            const exactMatches = ['ai', 'llm', 'mlm', 'porn'];
            for (let i = 0; i < exactMatches.length; i++) {
                const acronym = exactMatches[i];
                if (textToTest === acronym || (textToTest.endsWith(acronym) && !isSafeAcronymSuffix(textToTest))) return true;
            }
            
            if (textToTest.startsWith('ai') && textToTest.length > 2) {
                const rest = textToTest.substring(2);
                const badSuffixes = ['video', 'art', 'gen', 'chat', 'bot', 'girl', 'porn', 'xxx'];
                if (badSuffixes.some(s => rest.startsWith(s))) return true;
            }
            
            if (isBlockedByRedditRegexesV295(textToTest)) return true;
        }
        return false;
    }

    function getPostIdentifier(element) {
        const dataKsElement = element.querySelector && element.querySelector('[data-ks-id*="t3_"]');
        if (dataKsElement) {
            const dataKsId = dataKsElement.getAttribute('data-ks-id');
            const match = dataKsId.match(/t3_([a-zA-Z0-9]+)/);
            if (match) {
                return `post_${match[1]}`;
            }
        }
        
        const searchTitleId = element.querySelector && element.querySelector('[id^="search-post-title-t3_"]');
        if (searchTitleId && searchTitleId.id) {
            const m = searchTitleId.id.match(/t3_([a-zA-Z0-9]+)/);
            if (m) return `post_${m[1]}`;
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
            return approvalPersistence.get(identifier);
        }
        return false;
    }

    function markElementAsApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier) {
            if (approvalPersistence.size >= MAX_APPROVAL_PERSISTENCE) {
                const entries = Array.from(approvalPersistence.entries()).slice(-Math.floor(MAX_APPROVAL_PERSISTENCE * 0.7));
                approvalPersistence.clear();
                entries.forEach(([key, value]) => approvalPersistence.set(key, value));
            }
            
            approvalPersistence.set(identifier, true);
            try { rememberApprovedPostId(identifier); } catch {}
        }

        try {
            const canonical = tryGetCanonicalPostId(element);
            if (canonical && canonical !== identifier) rememberApprovedPostId(canonical);
        } catch {}

        element.classList.add('reddit-approved');
        permanentlyApprovedElements.add(element);

        // v29.5.0: Home-feed fragments arrive as ARTICLE > SHREDDIT-POST. The
        // parent is already screened above, so release the child in the same turn.
        // Previously two independent CSS gates could leave an approved article blank.
        if (element.tagName === 'ARTICLE') {
            const directPost = Array.from(element.children || []).find(child => child.tagName === 'SHREDDIT-POST');
            if (directPost && element.querySelectorAll('shreddit-post').length === 1) {
                directPost.classList.add('reddit-approved');
                permanentlyApprovedElements.add(directPost);
                processedElements.add(directPost);
            }
        }
    }

    function isSubredditNameBanned(subName) {
        if (!subName) return false;
        const lowerSub = subName.toLowerCase();
        
        if (bannedSubredditCache.has(lowerSub)) {
            return bannedSubredditCache.get(lowerSub);
        }
        
        const cleanName = lowerSub.replace(/^(r\/|u\/|user\/)/i, '');
        
        if (isNameBannedByPrefixSuffix(cleanName)) {
            bannedSubredditCache.set(lowerSub, true);
            return true;
        }
        
        for (let i = 0; i < adultSubreddits.length; i++) {
            if (lowerSub === adultSubreddits[i].toLowerCase()) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        if (isBlockedByRedditRegexesV295(lowerSub)) {
            bannedSubredditCache.set(lowerSub, true);
            return true;
        }
        
        bannedSubredditCache.set(lowerSub, false);
        return false;
    }

    function isSafeSubredditUrl() {
        const url = window.location.href.toLowerCase();
        for (let i = 0; i < safeSubreddits.length; i++) {
            const safeSub = safeSubreddits[i].replace(/^r\//, '').toLowerCase();
            if (url.match(new RegExp(`/r/${safeSub}([/?#]|$|/comments/)`))) {
                return true;
            }
        }
        return false;
    }

    function isUrlAllowed() {
        const currentUrl = window.location.href;
        if (ALWAYS_ALLOW_CURRENT_POST || isCurrentPageWhitelistedAuthor()) return true;
        return allowedUrls.some(url => currentUrl.startsWith(url)) || isSafeSubredditUrl();
    }

    function hideSearchElement(el) {
        if (!el) return;
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('reddit-search-banned', 'prehide');
        
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName.includes('TRACKER') && parent.getAttribute('click-events')?.includes('search/click/')) {
                parent.style.setProperty('display', 'none', 'important');
                parent.classList.add('reddit-search-banned');
            }
            if (parent.getAttribute('data-testid') === 'search-community' || 
                parent.getAttribute('data-testid') === 'search-post-unit' ||
                parent.getAttribute('data-id') === 'search-media-post-unit') {
                parent.style.setProperty('display', 'none', 'important');
                parent.classList.add('reddit-search-banned', 'prehide');
                break; 
            }
            parent = parent.parentElement;
        }
    }

    function removeElementAndRelated(element) {
        if (!element) return;
        let tracker = element.closest('search-telemetry-tracker');
        if (tracker && tracker.parentElement && tracker.parentElement.tagName !== 'BODY') {
            safelyHideElement(tracker);
        } else if (element.parentNode) {
            safelyHideElement(element);
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

    function isElementInSafeSubreddit(element) {
        if (isSafeSubredditUrl()) return true;
        
        const subredditPrefixedName = element.getAttribute && element.getAttribute('subreddit-prefixed-name');
        if (subredditPrefixedName) {
            const normalizedName = subredditPrefixedName.startsWith('r/') ? subredditPrefixedName : 'r/' + subredditPrefixedName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        const subredditName = element.getAttribute && element.getAttribute('subreddit-name');
        if (subredditName) {
            const normalizedName = 'r/' + subredditName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        const subreddit = getSubredditForAnyRedditPost(element);
        if (subreddit) {
            const normalizedName = subreddit.startsWith('r/') ? subreddit : 'r/' + subreddit;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        return false;
    }

    function checkContentForKeywords(content, isSafe = false) {
        if (!content) return false;
        const contentText = content.textContent || content.innerText || content.nodeValue || '';
        if (!contentText) return false;
        return checkTextForKeywords(contentText, isSafe);
    }

    function evaluateElementForBanning(element) {
        const wasApprovedBefore = (permanentlyApprovedElements.has(element) || wasElementPreviouslyApproved(element));
        if (!STRICT_BLOCKING && wasApprovedBefore) return false;
        
        const identifier = getPostIdentifier(element);

        if (isElementFromWhitelistedAuthor(element)) return false;
        if (identifier && CURRENT_POST_ID && identifier === CURRENT_POST_ID) return false;
        if (CURRENT_POST_ID) {
            const canonical = tryGetCanonicalPostId(element);
            if (canonical && canonical === CURRENT_POST_ID) return false;
        }
        if (identifier && CURRENT_POST_ID && identifier === CURRENT_POST_ID && isCurrentPageWhitelistedAuthor()) return false;

        const isSafe = isElementInSafeSubreddit(element);
        const fullContent = extractCompletePostContent(element);

        if (isElementFromAdultSubreddit(element)) return true;

        if (checkTextForKeywords(fullContent, isSafe)) return true;
        
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, a[data-click-id="body"], .title, [slot="title"], [data-testid="post-title-text"]');
        if (titleElement && checkContentForKeywords(titleElement, isSafe)) return true;
        
        const contentElement = element.querySelector && element.querySelector('.post-content, .md-container, p, [slot="text-body"], [data-testid="post-content"]');
        if (contentElement && checkContentForKeywords(contentElement, isSafe)) return true;
        
        const nsfwIndicators = element.querySelectorAll && element.querySelectorAll('.nsfw, [data-nsfw="true"], svg[icon-name="nsfw-outline"], .text-category-nsfw');
        if (nsfwIndicators && nsfwIndicators.length > 0) return true;
        
        return false;
    }

    // The current Reddit /search/ Posts tab uses SDUI preview cards, not
    // shreddit-post or the older search-post-unit element. Treat each card as
    // the screening unit so a matching title/snippet hides the whole result.
    const REDDIT_SEARCH_PREVIEW_SELECTOR_V295 = '[data-testid="search-post-with-content-preview"]';
    const redditSearchPreviewSignaturesV295 = new WeakMap();

    function getRedditSearchPreviewSignatureV295(card) {
        // This fingerprint detects late title/snippet hydration and recycled
        // results. It is never used for actual blocking (which remains script-safe).
        const content = card.querySelector('[data-testid="sdui-post-unit"]');
        const title = card.querySelector('a[data-testid="post-title-text"], a[data-testid="post-title"]');
        return (content?.textContent || card.textContent || '').slice(0, 8000) + '\u0000' +
            (title?.textContent || '') + '\u0000' +
            (title?.getAttribute('aria-label') || '') + '\u0000' +
            (title?.getAttribute('href') || '');
    }

    function screenRedditSearchPreviewV295(card) {
        // A title is needed before a result is ready to be approved. Until then
        // the initial CSS gate leaves the incomplete card invisible.
        const title = card.querySelector('a[data-testid="post-title-text"], a[data-testid="post-title"], [id^="search-post-title-t3_"]');
        if (!title || !(title.textContent?.trim() || title.getAttribute('aria-label')?.trim())) return;

        const signature = getRedditSearchPreviewSignatureV295(card);
        if (redditSearchPreviewSignaturesV295.get(card) === signature && processedElements.has(card)) return;

        // Re-evaluate a card if Reddit populates its snippet after its title,
        // rather than trusting a previous approval for the changed content.
        const banned = evaluateElementForBanning(card);
        redditSearchPreviewSignaturesV295.set(card, signature);
        processedElements.add(card);
        if (banned) {
            card.classList.remove('reddit-approved');
            card.classList.add('reddit-banned', 'prehide');
            safelyHideElement(card);
            return;
        }

        if (card.classList.contains('reddit-banned') || card.classList.contains('prehide')) {
            card.classList.remove('reddit-banned', 'reddit-search-banned', 'prehide');
            for (const property of ['display', 'visibility', 'opacity', 'height', 'padding',
                                    'margin', 'pointer-events', 'position', 'z-index']) {
                card.style.removeProperty(property);
            }
        }
        if (!card.classList.contains('reddit-approved')) markElementAsApproved(card);
    }

    function getRedditScreeningRootV295(element) {
        if (!element?.tagName) return element;
        const searchCard = element.closest?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295);
        if (searchCard) return searchCard;
        return element.tagName === 'SHREDDIT-POST' && element.parentElement?.tagName === 'ARTICLE'
            ? element.parentElement : element;
    }

    function screenRedditPostRootV295(seed) {
        const post = getRedditScreeningRootV295(seed);
        if (!post) return;
        if (post.matches?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295)) {
            screenRedditSearchPreviewV295(post);
            return;
        }
        if (processedElements.has(post)) {
            // Shreddit can replace the child custom element without replacing ARTICLE.
            // The old wrapper's approval is NOT transferable until the replacement
            // content has passed the same full blocking checks.
            if (post.classList.contains('reddit-approved') &&
                post.tagName === 'ARTICLE' &&
                Array.from(post.children || []).some(child =>
                    child.tagName === 'SHREDDIT-POST' && !child.classList.contains('reddit-approved'))) {
                if (evaluateElementForBanning(post)) {
                    post.classList.remove('reddit-approved');
                    post.classList.add('reddit-banned', 'prehide');
                    safelyHideElement(post);
                } else {
                    markElementAsApproved(post);
                }
            }
            return;
        }
        // Never release a descendant of a banned wrapper on a later mutation pass.
        if (post.closest?.('.reddit-banned, .prehide')) {
            processedElements.add(post);
            return;
        }
        processedElements.add(post);
        if (evaluateElementForBanning(post)) {
            post.classList.add('prehide', 'reddit-banned');
            hideSearchElement(post);
            removeElementAndRelated(post);
            return;
        }
        markElementAsApproved(post);
    }

    function processAllUnapprovedPosts() {
        const posts = document.querySelectorAll(`
            article:has(> shreddit-post):not(.prehide):not(.reddit-approved),
            article[data-testid="post-container"]:not(.prehide):not(.reddit-approved),
            shreddit-post:not(.prehide):not(.reddit-approved),
            [data-testid="search-post-unit"]:not(.prehide):not(.reddit-approved),
            [data-id="search-media-post-unit"]:not(.prehide):not(.reddit-approved),
            [data-testid="search-post-with-content-preview"]:not(.prehide):not(.reddit-approved)
        `);
        
        for (let i = 0; i < posts.length; i++) {
            screenRedditPostRootV295(posts[i]);
        }
    }

    function processSearchCommunities() {
        const communities = document.querySelectorAll('[data-testid="search-community"]:not(.reddit-search-approved):not(.prehide)');
        for (let i = 0; i < communities.length; i++) {
            const el = communities[i];
            if (processedSearchItems.has(el)) continue;
            processedSearchItems.add(el);
            
            const link = el.querySelector('a[href^="/r/"]');
            const titleMatch = link ? link.getAttribute('href').match(/^\/r\/([a-zA-Z0-9_]+)\/?$/i) : null;
            const name = titleMatch ? titleMatch[1] : (el.textContent || '');
            
            if (isSubredditNameBanned(name) || isSearchTextBanned(el.textContent)) {
                hideSearchElement(el);
            } else {
                el.classList.add('reddit-search-approved');
            }
        }
    }

    function hideJoinNowPosts() {
        const posts = document.querySelectorAll('article:not(.prehide), shreddit-post:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            
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

    function checkForAdultContentTag() {
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    function hideBannedSubredditsFromSearch() {
        // Do not classify the site's normal navigation or feed LI elements as search results.
        const searchUi = '#search-dropdown-results-container, faceplate-search-dropdown, shreddit-search-dropdown';
        const onSearchPage = /^\/search(?:\/|$)/i.test(window.location.pathname);
        if (!onSearchPage && !document.querySelector(searchUi) &&
            !document.querySelector('[data-testid="search-community"], li[data-testid="search-sdui-query-autocomplete"]')) return;
        const allSearchItems = [
            ...Array.from(document.querySelectorAll('[data-type="search-dropdown-item-label-text"]')),
            ...Array.from(document.querySelectorAll('#search-dropdown-results-container span.font-semibold.text-12.uppercase, faceplate-search-dropdown span.font-semibold.text-12.uppercase, shreddit-search-dropdown span.font-semibold.text-12.uppercase, span.text-category-nsfw')),
            ...Array.from(document.querySelectorAll('li[data-testid="search-sdui-query-autocomplete"], li.recent-search-item')),
            ...Array.from(document.querySelectorAll('#search-dropdown-results-container li[role="presentation"], faceplate-search-dropdown li[role="presentation"], shreddit-search-dropdown li[role="presentation"], #search-dropdown-results-container a[role="option"], faceplate-search-dropdown a[role="option"], shreddit-search-dropdown a[role="option"], div[data-testid="search-dropdown-item"]')),
            ...Array.from(document.querySelectorAll('[data-testid="search-community"]'))
        ];
        
        for (let i = 0; i < allSearchItems.length; i++) {
            const item = allSearchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            if (item.classList.contains('text-category-nsfw') || 
                (item.textContent && item.textContent.trim().toUpperCase() === "NSFW")) {
                hideSearchElement(item);
                continue;
            }
            
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const textContent = item.textContent || '';
            const label = ariaLabel + ' ' + textContent;
            
            if (isSearchTextBanned(label) || isSubredditNameBanned(label)) {
                hideSearchElement(item);
            } else {
                item.classList.add('reddit-search-approved');
                let parent = item.closest('li[role="presentation"], li, a, div');
                if (parent) parent.classList.add('reddit-search-approved');
            }
        }
    }

    const throttledShadowRootHandler = throttle((mutations) => {
        const maxMutations = Math.min(mutations.length, 20);
        for (let mi = 0; mi < maxMutations; mi++) {
            const mutation = mutations[mi];
            const addedLimit = Math.min(mutation.addedNodes.length, 10);
            for (let ni = 0; ni < addedLimit; ni++) {
                const node = mutation.addedNodes[ni];
                if (node && node.nodeType === 1) {
                    processShadowSearchItems(mutation.target);
                    // A feed's shadow root can receive posts after its initial
                    // scan. Screen those specific new posts instead of leaving
                    // them waiting for an unreachable light-DOM fallback.
                    if (node.matches?.('shreddit-post, article[data-testid="post-container"], [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]') ||
                        (node.tagName === 'ARTICLE' && node.querySelector?.('shreddit-post'))) {
                        screenRedditPostRootV295(node);
                    } else if (node.querySelectorAll) {
                        const nested = node.querySelectorAll('shreddit-post, article[data-testid="post-container"], [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]');
                        const limit = Math.min(nested.length, 60);
                        for (let k = 0; k < limit; k++) screenRedditPostRootV295(nested[k]);
                        if (nested.length > limit) queueRedditOverflowSweepV295();
                    }
                    if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                        shadowRootsProcessed.add(node.shadowRoot);
                        processShadowSearchItems(node.shadowRoot);
                        observeShadowRootOnce(node.shadowRoot);
                    }
                }
            }
        }
    }, 100);

    function observeShadowRootOnce(root) {
        if (!root || shadowRootObservers.has(root)) return;
        try {
            const mo = new MutationObserver(throttledShadowRootHandler);
            mo.observe(root, { childList: true, subtree: true, attributes: false, characterData: false });
            shadowRootObservers.set(root, mo);
            observerInstances.add(mo);
        } catch (e) {}
    }

    function disconnectShadowObserversInSubtree(node, depth = 0) {
        if (!node || node.nodeType !== 1 || depth > 6) return;
        try {
            if (node.shadowRoot && shadowRootObservers.has(node.shadowRoot)) {
                const mo = shadowRootObservers.get(node.shadowRoot);
                try { mo && mo.disconnect && mo.disconnect(); } catch {}
                observerInstances.delete(mo);
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
        const host = root.host || (root.nodeType === 1 ? root : null);
        if (host && !host.matches?.('faceplate-search-dropdown, shreddit-search-dropdown, #search-dropdown-results-container') &&
            !host.closest?.('faceplate-search-dropdown, shreddit-search-dropdown, #search-dropdown-results-container')) return;

        const searchItems = root.querySelectorAll('li[role="presentation"], div[role="presentation"], li, a[role="option"], div[data-testid="search-dropdown-item"], [data-testid="search-community"]');
        
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
            
            if (isSearchTextBanned(fullText) || hasNSFWBadge) {
                hideSearchElement(item);
            } else {
                item.classList.add('reddit-search-approved');
            }
        }
    }

    function hideBannedSubredditsFromAllSearchDropdowns() {
        // Search screening must never recursively walk the entire home feed.
        // Restrict shadow-root discovery to search surfaces and their descendants.
        hideBannedSubredditsFromSearch();
        const dropdowns = document.querySelectorAll(
            'faceplate-search-dropdown, shreddit-search-dropdown, #search-dropdown-results-container'
        );
        const visitedRoots = new Set();
        function scanSearchSubtree(host, depth = 0) {
            if (!host || depth > 8) return;
            const root = host.shadowRoot || host;
            if (visitedRoots.has(root)) return;
            visitedRoots.add(root);
            if (host.shadowRoot && !shadowRootsProcessed.has(host.shadowRoot)) {
                shadowRootsProcessed.add(host.shadowRoot);
                observeShadowRootOnce(host.shadowRoot);
            }
            processShadowSearchItems(root);
            const nodes = root.querySelectorAll?.('faceplate-search-dropdown, shreddit-search-dropdown, *') || [];
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].shadowRoot) scanSearchSubtree(nodes[i], depth + 1);
            }
        }
        for (let i = 0; i < dropdowns.length; i++) scanSearchSubtree(dropdowns[i]);
    }

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
            observer.observe(container, { childList: true, subtree: true });
            container.__searchObserved = true;
            searchDropdownObserverTargetsV295.add(container);
        }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            const dropdown = searchDropdowns[i];
            if (dropdown.__searchObserved) continue;
            dropdown.__searchObserved = true;
            searchDropdownObserverTargetsV295.add(dropdown);
            
            const observer = new MutationObserver(() => {
                batchProcess(() => {
                    if (dropdown.shadowRoot) {
                        processShadowSearchItems(dropdown.shadowRoot);
                    }
                });
            });
            observerInstances.add(observer);
            observer.observe(dropdown, { childList: true, subtree: true });
        }
    }

    // === THE ULTIMATE SANITY ENFORCER (WITH HOMEPAGE GUARD) ===
    function enforceSanity() {
        if (isRedirecting) return;
        if (ALWAYS_ALLOW_CURRENT_POST || isCurrentPageWhitelistedAuthor()) return;

        try {
            const currentUrl = window.location.href.toLowerCase();
            const urlObj = new URL(window.location.href);
            const isHomePage = urlObj.pathname === '/' || urlObj.pathname === '';

            // 1. Check Search Query in URL
            if (urlObj.pathname.toLowerCase().includes('/search')) {
                const searchQuery = urlObj.searchParams.get('q');
                if (searchQuery && isSearchTextBanned(searchQuery)) {
                    devLog(`Banned search query detected: ${searchQuery}. Redirecting...`);
                    isRedirecting = true;
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }

            // 2. Check Active Search Input Box (Clear it if on homepage, redirect otherwise)
            const searchInputs = document.querySelectorAll('input[name="q"], input[type="search"]');
            for (let i = 0; i < searchInputs.length; i++) {
                if (searchInputs[i].value && isSearchTextBanned(searchInputs[i].value)) {
                    devLog(`Banned text in search box: ${searchInputs[i].value}. Clearing...`);
                    searchInputs[i].value = ''; // Silently clear it
                    if (!isHomePage) {
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                        return;
                    }
                }
            }

            // HOMEPAGE GUARD: Stop checking URL if we are on the homepage to prevent infinite redirect loops
            if (isHomePage) return;

            // 3. Check Subreddit URL
            if (!isSafeSubredditUrl()) {
                const subMatch = currentUrl.match(/\/r\/([a-zA-Z0-9_]+)/i);
                if (subMatch && subMatch[1] && (isNameBannedByPrefixSuffix(subMatch[1]) || isSubredditNameBanned(subMatch[1]))) {
                    devLog(`Banned subreddit detected: ${subMatch[1]}. Redirecting...`);
                    isRedirecting = true;
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }

            // 4. Check User URL
            const userMatch = currentUrl.match(/\/(?:u|user)\/([a-zA-Z0-9_-]+)/i);
            if (userMatch && userMatch[1] && isNameBannedByPrefixSuffix(userMatch[1])) {
                devLog(`Banned user detected: ${userMatch[1]}. Redirecting...`);
                isRedirecting = true;
                window.location.replace('https://www.reddit.com');
                return;
            }

            // 5. Fallback URL Check (unified regex policy)
            if (!isUrlAllowed()) {
                if (isBlockedByRedditRegexesV295(currentUrl)) {
                    devLog('Banned regex in URL. Redirecting...');
                    isRedirecting = true;
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }
        } catch (e) {}
    }

    function interceptSearchInputChanges() {
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && !eventListenersAdded.has(searchInput)) {
            const inputHandler = debounce(() => {
                if (isSearchTextBanned(searchInput.value)) {
                    searchInput.value = '';
                    if (window.location.pathname !== '/' && window.location.pathname !== '') {
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                    }
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
                if (isSearchTextBanned(query)) {
                    event.preventDefault();
                    if (window.location.pathname !== '/' && window.location.pathname !== '') {
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                    }
                }
            };
            searchForm.addEventListener('submit', submitHandler);
            eventListenersAdded.add(searchForm);
        }
    }

    const recentPostsClearState = new WeakMap();

    function hideAndClearRecentPostsPanel(root = document) {
        try {
            const hosts = [];

            if (root && root.nodeType === 1 && root.matches?.('recent-posts')) {
                hosts.push(root);
            }

            if (root && root.querySelectorAll) {
                const found = root.querySelectorAll('recent-posts');
                for (let i = 0; i < found.length; i++) {
                    hosts.push(found[i]);
                }
            }

            for (let i = 0; i < hosts.length; i++) {
                const host = hosts[i];
                if (!host) continue;

                try {
                    host.style.setProperty('display', 'none', 'important');
                    host.style.setProperty('visibility', 'hidden', 'important');
                    host.style.setProperty('opacity', '0', 'important');
                    host.style.setProperty('height', '0', 'important');
                    host.style.setProperty('min-height', '0', 'important');
                    host.style.setProperty('max-height', '0', 'important');
                    host.style.setProperty('overflow', 'hidden', 'important');
                    host.style.setProperty('margin', '0', 'important');
                    host.style.setProperty('padding', '0', 'important');
                    host.style.setProperty('pointer-events', 'none', 'important');
                } catch {}

                const signature = String(host.getAttribute?.('recent-post-ids') || '').trim();
                if (!signature || signature === '[]') continue;

                const shadow = host.shadowRoot;
                if (!shadow) continue;

                const tracker = shadow.querySelector('faceplate-tracker[noun="clear_recent_module"]');
                const button = tracker?.querySelector('button');
                if (!button || typeof button.click !== 'function') continue;

                const now = Date.now();
                const previous = recentPostsClearState.get(host);
                const sameSignature = !!(previous && previous.signature === signature);
                const attempts = sameSignature ? previous.attempts : 0;
                const lastClick = sameSignature ? previous.lastClick : 0;

                if (attempts >= 3 || (sameSignature && now - lastClick < 1500)) continue;

                recentPostsClearState.set(host, {
                    signature,
                    attempts: attempts + 1,
                    lastClick: now
                });

                button.click();
                devLog('🧹 Cleared Reddit Recent Posts module');
            }
        } catch (e) {}
    }

    function hideRecentCommunitiesSection() {
        const selectors = [
            'reddit-recent-pages', 
            'shreddit-recent-communities',
            'div[data-testid="community-list"]',
            '[data-testid="recent-communities"]',
            '.recent-communities',
            'in-feed-community-recommendations',
            'community-recommendation',
            '#recent-communities-section',
            'div#recent-communities-section',
            'faceplate-expandable-section-helper#recent-communities-section',
            'summary[aria-controls="RECENT"]',
            '[aria-controls="RECENT"]',
            '#RECENT'
        ];
        
        for (let i = 0; i < selectors.length; i++) {
            const elements = document.querySelectorAll(selectors[i]);
            for (let j = 0; j < elements.length; j++) {
                const el = elements[j];
                const wrapper =
                    el.closest?.('#recent-communities-section') ||
                    el.closest?.('faceplate-expandable-section-helper#recent-communities-section') ||
                    el.closest?.('details') ||
                    el.closest?.('div.mb-sm.pb-sm') ||
                    el;
                safelyHideElement(wrapper);
            }
        }

        try {
            const navScopes = document.querySelectorAll('nav, aside, [data-testid="left-sidebar"], #left-sidebar-container, reddit-sidebar-nav, flex-left-nav-container');
            for (let i = 0; i < navScopes.length; i++) {
                const scope = navScopes[i];
                const items = scope.querySelectorAll('div, li, span, summary, faceplate-expandable-section-helper');
                for (let j = 0; j < items.length; j++) {
                    const item = items[j];
                    const text = (item.textContent || '').trim();
                    if (!text || !/^RECENT$/i.test(text)) continue;
                    const wrapper =
                        item.closest?.('#recent-communities-section') ||
                        item.closest?.('faceplate-expandable-section-helper#recent-communities-section') ||
                        item.closest?.('details') ||
                        item.closest?.('div.mb-sm.pb-sm') ||
                        item;
                    safelyHideElement(wrapper);
                }
            }
        } catch (e) {}
        
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
            safelyHideElement(hrElements[i]);
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
            if (!element.shadowRoot || shadowRootObservers.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            for (let j = 0; j < posts.length; j++) {
                const post = posts[j];
                screenRedditPostRootV295(post);
            }
            
            observeShadowRootOnce(element.shadowRoot);
        }
    }

    // --- MAIN FILTER FUNCTION ---
    function runAllChecks() {
        const now = performance.now();
        // Newly inserted posts are screened by the mutation handler. Full UI
        // audits need no faster cadence; keeping them below React's commit rate
        // prevents repeated whole-page scans while the initial feed hydrates.
        if (now - lastFilterTime < 450) return;
        lastFilterTime = now;
        
        if (document.body && !document.body.classList.contains('reddit-filter-ready')) {
            document.body.classList.add('reddit-filter-ready');
        }
        
        hideAnswersButton();
        
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
        observeSearchDropdown();
        
        processShadowDOM();
        processAllUnapprovedPosts();
        processSearchCommunities();
        hideAndClearRecentPostsPanel();
        
        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            checkForAdultContentTag();
            hideRecentCommunitiesSection();
        }
        
        enforceSanity();
        
        removeHrElements();
        removeSelectorsToDelete();
        checkAndHideNSFWClassElements();
    }

    // --- INITIALIZATION AND EVENT HANDLING ---
    function init() {
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        
        runAllChecks();
        
        // The documentElement observer below already watches body mutations,
        // handles fresh posts and performs the periodic full audit. A second
        // subtree observer doubled every startup React mutation's workload.
        
        const minimalInterval = setInterval(hideBannedSubredditsFromSearch, 1000);
        intervalIds.add(minimalInterval);
        
        // Document-start CSS and mutation handling hide Answers immediately;
        // the slower timer is only a fallback for navigation surfaces.
        const answersButtonInterval = setInterval(hideAnswersButton, 1200);
        intervalIds.add(answersButtonInterval);

        // Sanity loop fully unbound from document.hidden to catch background tabs!
        const sanityInterval = setInterval(() => {
            enforceSanity();
        }, 500);
        intervalIds.add(sanityInterval);
        
        // The mutation observers perform immediate screening. Keep the
        // periodic post fallback, but avoid costly peripheral DOM sweeps on
        // every pass while the user is scrolling through an already loaded feed.
        let lastPeripheralAuditV295 = -Infinity;
        function runRedditIdleAuditV295() {
            if (document.hidden) {
                runAllChecks();
                return;
            }
            processAllUnapprovedPosts();
            const now = performance.now();
            if (now - lastPeripheralAuditV295 < 8500) return;
            lastPeripheralAuditV295 = now;
            hideBannedSubredditsFromAllSearchDropdowns();
            processSearchCommunities();
            hideAnswersButton();
            hideAndClearRecentPostsPanel();
        }
        if (window.requestIdleCallback) {
            const idleAuditIntervalV295 = setInterval(() => {
                window.requestIdleCallback(runRedditIdleAuditV295, { timeout: 3000 });
            }, 2200);
            intervalIds.add(idleAuditIntervalV295);
        } else {
            const backgroundInterval = setInterval(() => {
                batchProcess(runRedditIdleAuditV295);
            }, 3000);
            intervalIds.add(backgroundInterval);
        }
        
        const memoryMonitorInterval = setInterval(() => {
            monitorMemoryPressure();
        }, MEMORY_CHECK_INTERVAL);
        intervalIds.add(memoryMonitorInterval);
        
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

    let redditOverflowSweepQueuedV295 = false;
    function queueRedditOverflowSweepV295() {
        if (redditOverflowSweepQueuedV295) return;
        redditOverflowSweepQueuedV295 = true;
        setTimeout(() => {
            redditOverflowSweepQueuedV295 = false;
            processAllUnapprovedPosts();
        }, 120);
    }

    const processNewElements = throttle((mutations) => {
        let needsSearchUpdate = false;
        let needsPostSweepV295 = false;

        const limitedMutations = Array.isArray(mutations) ? mutations.slice(0, 30) : mutations;
        
        for (let i = 0; i < limitedMutations.length; i++) {
            const mutation = limitedMutations[i];
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
            }

            if (mutation.type === 'attributes' && mutation.attributeName === 'recent-post-ids') {
                hideAndClearRecentPostsPanel(mutation.target);
            }

            // The preview shell may be inserted before its title/snippet. Later
            // childList commits must recheck that same card in-place.
            const changedSearchCard = mutation.target.closest?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295);
            if (changedSearchCard) screenRedditSearchPreviewV295(changedSearchCard);
            
            const addedLimit = Math.min(mutation.addedNodes.length, 15);
            for (let j = 0; j < addedLimit; j++) {
                const node = mutation.addedNodes[j];
                if (!node || node.nodeType !== 1) continue;

                // Never query each entire added React subtree for unrelated
                // recent-posts markup. Preserve the clearing feature when its
                // actual host arrives (including in a newly inserted fragment).
                if (node.matches?.('recent-posts') || node.querySelector?.('recent-posts')) {
                    hideAndClearRecentPostsPanel(node);
                }

                if (node.tagName && node.matches) {
                    for (let k = 0; k < selectorsToDelete.length; k++) {
                        if (node.matches(selectorsToDelete[k])) {
                            removeElementAndRelated(node);
                        }
                    }
                }

                if (node.tagName === 'A' && node.getAttribute('href') === '/answers/') {
                    hideAnswersButton();
                }
                
                if (node.tagName === 'FACEPLATE-TRACKER' || 
                    (node.querySelector && (node.querySelector('faceplate-tracker[noun="gen_guides_sidebar"]') ||
                                            node.querySelector('a[href="/answers/"]')))) {
                    hideAnswersButton();
                }
                
                const enclosingSearchCard = node.closest?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295);
                if (enclosingSearchCard) screenRedditSearchPreviewV295(enclosingSearchCard);

                if (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST' ||
                   (node.getAttribute && node.getAttribute('data-testid') === 'search-post-unit') ||
                   (node.getAttribute && node.getAttribute('data-id') === 'search-media-post-unit')) {
                    screenRedditPostRootV295(node);
                } else if (node.querySelectorAll) {
                    // Reddit commonly inserts a wrapper containing many posts.
                    // Screen its descendants now; no whole-document pass for
                    // every unrelated navigation, comment or icon mutation.
                    const nestedPosts = node.querySelectorAll(
                        'shreddit-post, article[data-testid="post-container"], ' +
                        '[data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]'
                    );
                    const limit = Math.min(nestedPosts.length, 60);
                    for (let k = 0; k < limit; k++) screenRedditPostRootV295(nestedPosts[k]);
                    if (nestedPosts.length > limit) needsPostSweepV295 = true;
                }
                // Ordinary feed posts also have role/data-testid attributes.
                // They must not trigger a whole search-dropdown sweep for each
                // React commit. Actual dropdowns and search results still do.
                if (node.matches?.(
                    '#search-dropdown-results-container, faceplate-search-dropdown, ' +
                    'shreddit-search-dropdown, [data-testid="search-community"], ' +
                    '[data-testid="search-dropdown-item"], ' +
                    'li[data-testid="search-sdui-query-autocomplete"], ' +
                    'li.recent-search-item, [data-type="search-dropdown-item-label-text"]'
                ) || node.closest?.(
                    '#search-dropdown-results-container, faceplate-search-dropdown, shreddit-search-dropdown'
                ) || node.querySelector?.(
                    '#search-dropdown-results-container, faceplate-search-dropdown, ' +
                    'shreddit-search-dropdown, [data-testid="search-community"], ' +
                    '[data-testid="search-dropdown-item"], ' +
                    'li[data-testid="search-sdui-query-autocomplete"]'
                )) {
                    needsSearchUpdate = true;
                }
                
                if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                    shadowRootsProcessed.add(node.shadowRoot);
                    
                    processShadowSearchItems(node.shadowRoot);
                    
                    const shadowPosts = node.shadowRoot.querySelectorAll('article, shreddit-post');
                    const maxShadowPosts = Math.min(shadowPosts.length, 10);
                    for (let k = 0; k < maxShadowPosts; k++) {
                        const shadowPost = shadowPosts[k];
                        screenRedditPostRootV295(shadowPost);
                    }
                    
                    observeShadowRootOnce(node.shadowRoot);
                }
                
                if (node.querySelectorAll) {
                    // Keep cosmetic removals reactive, but traverse only once
                    // instead of running separate DOM searches for each selector.
                    const disposable = node.querySelectorAll(
                        'hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0, ' +
                        selectorsToDelete.join(', ')
                    );
                    for (let k = 0; k < disposable.length; k++) {
                        const target = disposable[k];
                        if (target.matches('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0')) {
                            safelyHideElement(target);
                        } else {
                            removeElementAndRelated(target);
                        }
                    }
                }
            }
        }
        
        // The targeted fragment scan above handles fresh posts. A bounded
        // fallback is retained if one React commit exceeded its per-pass limit.
        if (needsPostSweepV295) queueRedditOverflowSweepV295();

        if (needsSearchUpdate) {
            batchProcess(() => {
                hideBannedSubredditsFromSearch();
                hideBannedSubredditsFromAllSearchDropdowns();
                processSearchCommunities();
            });
        }
        
        hideAnswersButton();
    }, 75);

    const observer = new MutationObserver(processNewElements);
    observerInstances.add(observer);
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['recent-post-ids'],
        characterData: false
    });

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
        // These primary observers are already active at document-start. Without
        // this state flag the 4-second memory monitor installed a duplicate pair.
        HEAVY_OBSERVERS_ACTIVE = true;
    } catch (e) {}

    hideBannedSubredditsFromSearch();
    hideBannedSubredditsFromAllSearchDropdowns();
    hideAndClearRecentPostsPanel();

    let currentUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            
            cleanupCaches();
            
            const memInfo = getMemoryUsage();
            if (memInfo) {
                devLog(`🔄 URL changed - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB`);
            }

            try {
                CURRENT_POST_ID = (function () {
                    const m = window.location.href.match(/\/comments\/([a-zA-Z0-9]+)/);
                    return m ? `post_${m[1]}` : null;
                })();
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
            
            // Force immediate check on URL change
            runAllChecks();
        }
    }, 500);
    intervalIds.add(urlCheckInterval);

})();