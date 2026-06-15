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
        if (!arr.includes(id)) arr.push(id);
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
                    const card = el?.closest?.('article, shreddit-post, [data-testid="search-post-unit"], [data-id="search-media-post-unit"]');
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
                        const card = el.closest?.('article, shreddit-post, [data-testid="search-post-unit"], [data-id="search-media-post-unit"]');
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

            function injectIntoPage(fn) {
                try {
                    const el = document.createElement('script');
                    el.type = 'text/javascript';
                    el.textContent = `;(${fn})();`;
                    (document.documentElement || document.head).appendChild(el);
                    el.remove();
                } catch {}
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

            injectIntoPage(function pageWorldAnswersHook() {
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

                window.addEventListener('pagehide', disconnectAll, { once: true });
                window.addEventListener('beforeunload', disconnectAll, { once: true });

                try { removeAnswersIn(document); } catch {}
            });

            PAGE_WORLD_HOOKED = true;
        } catch {}
    })();

    // --- IMMEDIATE PRE-HIDING CSS ---
    function addPreHidingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            article:not(.reddit-approved),
            shreddit-post:not(.reddit-approved),
            [subreddit-prefixed-name]:not(.reddit-approved),
            [data-testid="search-post-unit"]:not(.reddit-approved),
            [data-id="search-media-post-unit"]:not(.reddit-approved) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            article.reddit-approved,
            shreddit-post.reddit-approved,
            [subreddit-prefixed-name].reddit-approved,
            [data-testid="search-post-unit"].reddit-approved,
            [data-id="search-media-post-unit"].reddit-approved {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
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
            
            li[role="presentation"]:not(.reddit-search-approved),
            div[role="presentation"]:not(.reddit-search-approved),
            li[data-testid="search-sdui-query-autocomplete"]:not(.reddit-search-approved),
            li.recent-search-item:not(.reddit-search-approved),
            a[role="option"]:not(.reddit-search-approved),
            div[data-testid="search-dropdown-item"]:not(.reddit-search-approved),
            [data-testid="search-community"]:not(.reddit-search-approved) {
                display: none !important;
                visibility: hidden !important;
            }
            
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
            
            a[href="/answers/"],
            a[href^="/answers"],
            faceplate-tracker[noun="gen_guides_sidebar"],
            span:contains("BETA"),
            span:contains("Answers BETA"),
            a[href="/answers/"],
            span.text-global-admin.font-semibold.text-12:contains("BETA"),
            span.text-global-admin.font-semibold.text-12:contains("Answers BETA"),
            svg[icon-name="answers-outline"],
            span:contains("Answers"),
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
            
            article.prehide, shreddit-post.prehide, [subreddit-prefixed-name].prehide, [data-testid="search-post-unit"].prehide, [data-testid="search-community"].prehide, [data-id="search-media-post-unit"].prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
            }
            
            article:not(.reddit-approved) img, 
            shreddit-post:not(.reddit-approved) img,
            [subreddit-prefixed-name]:not(.reddit-approved) img,
            [data-testid="search-post-unit"]:not(.reddit-approved) img,
            [data-id="search-media-post-unit"]:not(.reddit-approved) img {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            article.reddit-approved img, 
            shreddit-post.reddit-approved img,
            [subreddit-prefixed-name].reddit-approved img,
            [data-testid="search-post-unit"].reddit-approved img,
            [data-id="search-media-post-unit"].reddit-approved img {
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
        "r/Gemini"
    ];

    const broadKeywordsList = [
        "woman", "women", "girl", "girls", "girlfriend", "boyfriend", "boy friend", "girl friend",
        "amateur", "poses", "posing", "breast", "breasts", "lady", "ladies", "womens", "womans",
        "ladies'", "lady's", "girl's", "woman's"
    ];

    const broadRegexPatterns = [
        "\\bshe\\b", "\\bher\\b", "\\bher's\\b", "\\bshe's\\b", "\\bemma\\b", "\\bliv\\b", "\\btay\\b", 
        "\\bsol\\b", "\\btor\\b", "\\bava\\b", "\\bindi\\b", "\\bgirl\\b", "\\blady\\b", "\\bmina\\b", "\\bamber\\b"
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
        "Saya Kamitani", "Kamitani", "Katie", "Nikkita", "Nikkita Lyons", "Lisa Marie", "Lisa Marie Varon", "Lisa Varon", "Marie Varon", "Irving", "Naomi", "Belts Mone", "Amanda Huber", "aivideo", 
	"ai video", "Ivy Nile",
    ];

    const redgifsKeyword = "www.redgifs.com";

    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro", "r/AlexaBliss", "r/AlexaPearl", "r/comfyui", "r/grok", "r/artificialintelligence", "r/AI", "r/WrestlingBotches"
    ];

    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i,
        /morph/i, /inpaint/i, /art intel/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /\bbra\b/i, /soulgen/i, /ismartta/i, /editor/i, /image enhanced/i, /image enhancing/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /Blis/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhanced image/i,
        /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i,
        /vegi/i, /vege/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /eras cloth/i, /arxiv/i,  /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i,
        /Tiffa/i, /Strat/i, /puz/i, /Sweee/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /\bSlut\b/i, /3dit/i, /ed1t/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bAi\b/i,
        /Sydney Sweeney/i, /Sweeney/i, /fap/i, /GenHey/i, /Sydnee/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bedit\b/i, /Feikki/i,
        /\bAnal\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i, /\bHer\b/i, /\bShe\b/i, /\bADMX\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /Amber/i, /\bAi-\b/i, /\bAi\b/i,
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
        /\bAnswers BETA\b/i, /\bFuku\b/i, /\bDick\b/i, /\bCock\b/i, /arxiv/i, /\bCock\b/i, /\bRape\b/i, /\bEmma\b/i, /\bIndi\b/i, /\bTegan\b/i, /\bGirl\b/i, /\bPenis\b/i, /\bLady\b/i, /\bAnus\b/i, /\bNSFW\b/i, 
        /\bsex\b/i, /\bAdult\b/i, /\bB-Fab\b/i, /Elayna/i, /Eleyna/i, /Eliyna/i, /Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elina/i, /Elyna/i, /Elyina/i, /Aikusviihde/i, /Aikus viihde/i, /La Primare/i,
        /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i,  /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, /La Premare/i,
        /twat/i, /topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, /softorbit/i, /softorbits/i, /soft-orbit/i, 
        /\bLita\b/i, /soft-orbits/i, /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper-v/i,
        /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper-v/i, /hyper v/i, /\bLilly\b/i, 
        /\*/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, 
        /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i, /\bLili\b/i,
        /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /virtmachine/i, /virt-machine/i, /virtumachine/i, /vir mach/i,
        /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, /\bMachiene\b/i, /vi mach/i, /virtual machi/i, /\bLily\b/i,
        /virtuaali masiina/i, /virtuaalimasiina/i,  /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /virtuaali masiina/i, /\bLili\b/i,
        /Cathy/i, /Kathy/i, /Katherine/i, /Kazuki/i, /Kathy/i, /Yoshiko/i, /Yoshihiko/i, /Hirata/i, /birppis/i, /irpp4/i, /b1rppis/i, /birpp1s/i, /b1rpp1s/i, /comfyui/i, /Lily Adam/i, /Lilly Adam/i, /Dualipa/i,
        /comfy ui/i, /comfy ai/i, /comfyai/i, /comfy-ui/i, /comfy-ai/i, /comfy-ai/i, /Becky/i, /Becki/i, /Rebecca/i, /Amber Heard/i, /mid journey/i, /unstable diffusion/i, /Dua Lipa/i, /Elon Musk/i, /ElonMusk/i,
        /AI[ -]?generated/i, /generated[ -]?by[ -]?AI/i, /artificial[ -]?intelligence/i, /machine[ -]?learning/i, /neural[ -]?network/i, /deep[ -]?learning/i, /midjourney/i, /dall[ -]?e/i, /stable[ -]?diffusion/i,
        /computer[ -]?generated/i, /text[ -]?to[ -]?image/i, /image[ -]?generation/i, /AI[ -]?art/i, /synthetic[ -]?media/i, /algorithmically/i, /bot[ -]?generated/i, /automated[ -]?content/i, /stablediffused/i, 
        /Hirada/i, /Hirata/i, /Mizubi/i, /Mizupi/i, /Mizuki/i, /Watanabe/i, /Watanaba/i, /Wakana/i, /Kana Urai/i, /Uehara/i, /Uehara/i, /jazmyn/i, /Jazmin/i, /Jasmin/i, /Jasmyn/i, /\bNyx\b/i, /Primera/i, /Sherilyn/i,
        /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /rasikangas/i, /rasikannas/i, /\bJade\b/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i, /barlow/i, /Nikki/i, /HeyGen/i, 
        /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, /Alici/i,
        /headgen/i, /head gen/i, /genhead/i, /genhead/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /Nia Jax/i, /McQueen/i, /Kasie Cay/i, 
	/Mafiaprinsessa/i, /ai twerk/i, /twerk ai/i, /mangoanimat/i, /photo jiggle/i, /animat pic/i, /animat pho/i, /ai-app/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /animat ima/i, /animat pic/i, 
	/animat pho/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /img animat/i, /ima animat/i, /photo animat/i, /image animat/i, /make pic mov/i, /make pho mov/i, /make img mov/i, /make ima mov/i, 
	/gif pic/i, /gif pho/i, /gif img/i, /gif ima/i, /photo to gif/i, /image to gif/i, /pic to gif/i, /pic to vid/i, /pic to vid/i, /photo to video/i, /image to video/i, /ph0t/i, /pho7/i, /ph07/i, /1m4g/i, /im4g/i, /1mag/i, 
	/!mag/i, /!m4g/i, /!mg/i, /v1d3/i, /vid3/i, /v1de/i, /vld3/i, /v1d3/i, /g!f/i, /mangoai/i, /mangoapp/i, /mango-app/i,  /mangoai/i, /mangoapp/i, /mango-app/i, /ai-app/i, /mangoanim/i, /mango anim/i, /mango-anim/i,
	/lantaai/i, /lantaaa/i, /motionai/i, /changemotion/i, /swapmotion/i, /motionsw/i, /motionc/i, /\bmotion\b/i, /poseAI/i, /AI-/i, /-AI/i, /AIblow/i, /5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, 
	/AI-suck/i, /drool/i, /RemovingAI/i, /blowjob/i, /bjob/i, /b-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /dr00l/i, /BJAI/i, /BJ-AI/i, /BJ0b/i, /BJob/i, /B-J0b/i, /B-Job/i, /Suckjob/i, /Suckj0b/i, 
	/Suck-job/i, /Suck-j0b/i, /Mouthjob/i, /Mouthj0b/i, /M0uthjob/i, /M0uthj0b/i, /Mouth-job/i, /Mouth-j0b/i, /M0uth-job/i, /M0uth/i, /M0u7h/i, /Mou7h/i, /MouthAI/i, /MouthinAI/i, /MouthingAI/i, /AIMouth/i, /BlowAI/i, 
	/AIBlow/i, /BlowsAI/i, /BlowingAI/i, /JobAI/i, /AIJob/i, /Mouthig/i, /Suck/i, /ZuckCock/i, /ZuckC/i, /ZuckD/i, /ZuckP/i, /Zuckz/i, /Zucks/i, /Zuckc/i, /Zuzkc/i, /YouZuck/i, /ZuckYou/i, /AIZuck/i, /ZuckAI/i, 
	/Cuck/i, /Guck/i, /SDuck/i, /Cheek/i, /Sukc/i, /Sukz/i, /AISucc/i, /SuccAI/i, /Suqz/i, /Suqs/i, /Suqc/i, /Suqq/i, /Suqq/i, /Suqi/i, /Suqz/i, /Sucq/i, /cukc/i, /boob/i, /b0ob/i, /b00b/i, /bo0b/i, /titjob/i, 
	/titty/i, /titti/i, /j0b/i, /w0rk/i, /assjob/i, /buttjob/i, /wank/i, /w4nk/i, /tittt/i, /tiitt/i, /crotch/i, /thigh/i, /legjob/i, /asssex/i, /buttsex/i, /titsex/i, /buttsex/i, /ass sex/i, /butt sex/i, 
	/tit sex/i, /butt sex/i, /buttstuff/i, /butt stuff/i, /p0rn/i, /redtube/i, /asstube/i, /butttube/i, /xhamster/i, /adulttube/i, /adult tube/i, /FapAI/i, /HerAi/i, /AiHer/i, /SheAi/i, /AIShe/i, /AroundAI/i, 
	/\bVidu\b/i, /HerAround/i, /AroundHer/i, /TurnHer/i, /HerTurn/i, /SheAround/i, /AroundShe/i, /TurnShe/i, /SheTurn/i, /-her/i, /her-/i, /-she/i, /she-/i, /AIFap/i, /AIHug/i, /FapAI/i, /HugAI/i, /AIOut/i,
	/AIAdult/i, /AdultAI/i, /AIContent/i, /ContentAI/i, /AICreate/i, /CreateAI/i, /AICreating/i, /CreatingAI/i, /AICreation/i, /CreationAI/i, /AIMake/i, /MakeAI/i, /AIMaking/i, /MakingAI/i, /OutAI/i, /AIStuff/i, 
	/StuffAI/i, /t0ol/i, /to0l/i, /t00l/i, /70ol/i, /7o0l/i, /700l/i, /FindAI/i, /FinderAI/i, /FindingAI/i, /AIFind/i, /DirectoryAI/i, /AIDirect/i, /AILook/i, /LookAI/i, /LooksAI/i, /LookupAI/i, /Look-upAI/i, 
	/LookingUpAI/i, /UpLookAI/i, /AIUpLook/i, /ButtAPP/i, /APPAI/i, /AIAPP/i, /AssAI/i, /AIAss/i, /AssAPP/i, /AppAss/i, /Ass-/i, /-Ass/i, /Butt-/i, /-Butt/i, /Cooch-/i, /-Cooch/i, /Coochie-/i, /Kewch-/i, 
	/-Kewch/i, /Kewchie-/i, /Coachie/i, /K3wc/i, /cooch/i, /tush/i, /7ush/i, /7u5h/i, /tu5h/i, /AITit/i, /TitAI/i, /TitsAI/i, /AIBoob/i, /BoobAI/i, /BoobsAI/i, /BoobieAI/i, /BoobiesAI/i, /BoobyAI/i, /BoobysAI/i,
	/Boob/i, /titti/i, /titty/i, /ellie/i, /3llie/i, /elli3/i, /3lli3/i, /cha0tic/i, /AISketch/i, /SketchAI/i, /AIDraw/i, /AIDrew/i, /DrawAI/i,  /DrewAI/i, /DrawsAI/i, /DrawingAI/i, /DrawingsAI/i, /PaintAI/i, 
	/PaintsAI/i, /PaintingAI/i, /PaintingsAI/i, /AIPain/i, /OpenHerLegs/i, /OpenLegs/i, /OpeningLegs/i, /OpeningHerLegs/i, /OpensLegs/i, /OpensHerLegs/i, /SpreadLeg/i, /SpreadHerLeg/i, /cunnt/i, /cunnn/i, 
	/SpreadingLeg/i, /SpreadingHerLeg/i, /SpreadsLeg/i, /SpreadsHerLeg/i, /HerThig/i, /HerLeg/i, /HerThic/i, /SheThig/i, /SheLeg/i, /SheThic/i, /HerLeg/i, /HerThic/i, /LegShe/i, /LegsShe/i, /Thicc/i, /ThickShe/i, 
	/HerSkirt/i, /SheSkirt/i, /Her Skirt/i, /She Skirt/i, /Girl Skirt/i, /Girls Skirt/i, /Womans Skirt/i, /Woman Skirt/i, /Women Skirt/i, /Girly Skirt/i, /-lab/i, /depn/i, /d3pn/i, /deppn/i, /depenu/i, /depeni/i, 
	/d3ppn/i, /d3penu/i, /d3p3nu/i, /dep3nu/i, /depeni/i, /d3peni/i, /d3p3ni/i, /d3p3n1/i, /d3p3n!/i, /dep3n1/i, /dep3n!/i, /d3pen1/i, /d3pen!/i, /p05/i, /po5/i, /p0s/i, /postur/i, /posin/i, /pose/i, /iconicto/i, 
	/diepn/i, /artif/i, /artin/i, /-tool/i, /deipn/i, /Claude/i, /Anthropic/i, /wedgi/i, /wedge/i, /wedgy/i, /wedg1/i, /wedg!/i, /w3dg/i, /w33d/i, /we3d/i, /w3ed/i, /w333d/i, /w3333/i, /we333/i, /w3e33/i, /w33e3/i, 
	/w333e/i, /we33e/i, /we3e3/i, /wee3e/i, /w3e3e/i, /weee/i, /w3333/i, /edgin/i, /3dg1n/i, /edgyi/i, /edgy1/i, /3dgy1/i, /3dgin/i, /edg1n/i, /edg1i/i, /edgi1/i, /3dg1i/i, /3dgi1/i, /edgiy/i, /edgyi/i, /\bGrok\b/i,
	/Grok-AI/i, /\bxAI\b/i, /TwitterAI/i, 	/Anthr/i, /\bAnt\b/i, /Antro/i, /\bS0ft\b/i, /s0ftw/i, /softw/i, /\b50ft\b/i, /w4re/i, /war3/i, /w4r3/i, /p41n/i, /pa1n/i, /p4in/i, /ndif/i, /ndfy/i, /nd1f/i, /nd!f/i, 
	/ndlf/i, /shag/i, /5hag/i, /5h4g/i, /sh4g/i, /f4gg/i, /fagg3/i, /fagger/i, /vaat.*pois/i, /vaatteet pois/i, /3dgin/i, /edg1n/i, /edg1i/i, /edgi1/i, /3dg1i/i, /3dgi1/i, /edgiy/i, /edgye/i, /bliswwe/i, /\bRinnat\b/i, 
	/\bTissi\b/i, /\bTisu\b/i, /\bTisut\b/i, /rintalii/i, /rinta lii/i, /tissi/i, /r1nta/i, /r1nt4/i, /rint4/i, /l1ivi/i, /liiv1/i, /l1iv1/i, /li1v1/i, /l11v1/i, /l11vi/i, /bl15s/i, /bl1s5/i, /bl155/i, /bl1ss/i, /bli55/i, 
	/\bAnus\b/i, /anusaukko/i, /anus-aukko/i, /anus aukko/i, /pers aukko/i, /persaukko/i, /perseaukko/i, /perse aukko/i, /perse-aukko/i, /pers-aukko/i, /li1vi/i, /p3rs aukko/i, /p3r5 aukko/i, /per5 aukko/i, /p3rs-aukko/i, 
	/p3r5 aukko/i, /per5 aukko/i, /p3rse/i, /pers3/i, /p3rs3/i, /per5e/i, /per53/i, /p3r5e/i, /p3r53/i, /rints/i, /r1nts/i, /r1nt5/i, /rint5/i, /p1p4r/i, /pip4r/i, /p1par/i, /Jackie/i, /Kairi/i, /sexx/i, /sexi/i, /Redmond/i, 
	/Kiana/i, /\bKaina\b/i, /Jiana/i, /Kairi Sane/i, /\bKairi\b/i, /Kairi's/i, /Kairii/i, /Sexxy/i, /Sexy/i, /Sexx/i, /Sexi/i, /Goddess/i, /Kendal Grey/i, /Jackie/i, /Kayla/i, /Braxton/i, /Samantha/i, /Samantha Irvin/i, 
	/Samantha Irwin/i, /4lexa/i, /al3xa/i, /alex4/i, /4l3xa/i, /al3x4/i, /4l3x4/i, /4lex4/i, /bl15s/i, /bl1s5/i, /bl155/i, /blis5/i, /bli5s/i, /artintel/i, /artifi intel/i, /ardrob/i, /wardrobe/i, /robe malfunc/i,
	/ring gear malfunc/i, /ring malfunc/i, /solrvca/i, /billieeilish/i, /billie eilish/i, /ivynile/i, /Ivy Nile/, /UnderRatedLadies/i, /Ivy+Nile/i, /SkylarRaye/i,

//Nuclear regexes, use with caution ;)
/gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img)))|(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|denois(?:e|er|ing)?)(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img))?(?:[\s_\-\/.]{0,3}gr[a4][i1l]n)|gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic|image|img))|(?:ph(?:o|0)?t(?:o|0)?|pic|image|img)(?:[\s_\-\/.]{0,3}fix)/i, /lex.*bl/i, /liv.*morgan/i, /saad.*pipar/i, /s4ad.*pipar/i, /s44d.*pipar/i, /sa4d.*pipar/i, /rint.*pois/i, /dress.*remov/i,
        /(?:n(?:o|0)ise(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?))|(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?)(?:[\s_\-\/.]{0,3})n(?:o|0)ise|de[\s_\-\.]?n(?:o|0)is(?:e|er|ing)?)/i, /make.*(move|gif|video)/i, /photo.*(move|gif|video)/i, /image.*(move|gif|video)/i, /pic.*(move|gif|video)/i, /img.*(move|gif|video)/i, /booty/i, /ass.*(animat|ai|move)/i, /twerk/i, /twerking/i, /jiggle/i, /bounce.*(ai|gif)/i, /booty.*(ai|gif|video|animat)/i, /ass.*(ai|gif|video|animat)/i, /mangoanimat/i, /deepnude/i, /undress/i, /strip.*ai/i, /nude.*ai/i, /clothes.*remove/i, /remove.*(clothes|clothing|dress)/i, /face.*(swap|deepfake|replace)/i, /vaat.*pois/i, /hous.*pois/i, /pait.*pois/i, /pait.*pois/i, /liiv.*pois/i, /alushous.*pois/i, /alkkarit.*pois/i, /alusvaat.*pois/i, /clothing.*remove/i, 
/alexa.*(wwe|wrest|ras|NXT|pro)/i, /blis.*(wwe|wrest|ras|NXT|pro)/i, /lexa.*(wwe|wrest|ras|NXT|pro)/i, /lexi.*(wwe|wrest|ras|NXT|pro)/i, /blis.*(wwe|wrest|ras|NXT|pro)/i, /bils.*(wwe|wrest|ras|NXT|pro)/i, /lex.*(kauf|cabr|carb)/i, /model.*(mach|langu)/i, /robe.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin)/i,
/robe.*(malf|func)/i, /ring gear|trunk|pant|shirt|jacket.*(malf|func)/i, /malfunc.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin|ring)/i, 
    ];

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
    const MAX_CACHE_SIZE = IS_FIREFOX ? 30 : 50;         
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

    const shadowRootObservers = new WeakMap();

    let lastFilterTime = 0;
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

    function hideAnswersButton() {
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

    function extractCompletePostContent(element) {
        try {
            if (!STRICT_BLOCKING && isElementInSafeSubreddit(element)) {
                return element.textContent || element.innerText || '';
            }
            
            const allTextContent = [];
            const mainText = element.textContent || element.innerText || '';
            if (mainText.trim()) allTextContent.push(mainText);
            
            const contentSelectors = [
                'h1, h2, h3, h4, h5, h6', '[slot="title"]', '#post-title, [id*="post-title"]', '.title',
                'a[data-click-id="body"]', '[data-testid="post-title-text"]',
                '.md', '.md.feed-card-text-preview', '.md.text-14-scalable', '[slot="text-body"]',
                '[data-post-click-location="text-body"]', '.post-content', '.usertext-body', '.text-body',
                '.text-ellipsis', 'p', 'div[class*="text"]', 'span[class*="text"]',
                '[data-testid="post-content"]', '[about*="_"]', '[id*="post-rtjson-content"]', '.entry .usertext-body',
                'faceplate-screen-reader-content', '.line-clamp-3', '.line-clamp-6', '[aria-label]', '[title]'
            ];
            
            for (let i = 0; i < contentSelectors.length; i++) {
                const elements = element.querySelectorAll(contentSelectors[i]);
                for (let j = 0; j < elements.length; j++) {
                    const elem = elements[j];
                    let text = elem.textContent || elem.innerText || '';
                    if (!text && elem.getAttribute) {
                        text = elem.getAttribute('aria-label') || elem.getAttribute('title') || '';
                    }
                    if (text.trim() && text.length > 2) allTextContent.push(text);
                }
            }
            
            const links = element.querySelectorAll('a[href]');
            for (let i = 0; i < links.length; i++) {
                const href = links[i].getAttribute('href');
                if (href && href.includes('/comments/')) {
                    const linkText = links[i].textContent || links[i].innerText || '';
                    if (linkText.trim()) allTextContent.push(linkText);
                }
            }
            
            const dataAttributes = ['data-permalink', 'data-testid', 'aria-label', 'title', 'alt'];
            for (let i = 0; i < dataAttributes.length; i++) {
                const attr = dataAttributes[i];
                const value = element.getAttribute && element.getAttribute(attr);
                if (value && typeof value === 'string' && value.length > 2) allTextContent.push(value);
            }
            
            const truncatedElements = element.querySelectorAll('.text-ellipsis, .line-clamp-3, .line-clamp-6');
            for (let i = 0; i < truncatedElements.length; i++) {
                const elem = truncatedElements[i];
                const fullText = elem.textContent || elem.innerText || '';
                if (fullText.trim()) allTextContent.push(fullText);
            }
            
            const combinedContent = allTextContent.join(' ').trim();
            return combinedContent;
            
        } catch (error) {
            return element.textContent || element.innerText || '';
        }
    }

    function checkTextForKeywords(textContent, isSafeSub = false) {
        if (!textContent) return false;
        
        let lowerText = textContent.toLowerCase();
        if (lowerText.length > 2000) lowerText = lowerText.substring(0, 2000); 
        
        if (contentBannedCache.has(lowerText)) return contentBannedCache.get(lowerText);
        
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

            for (let i = 0; i < keywordsToHide.length; i++) {
                const keyword = keywordsToHide[i].toLowerCase();
                if (isSafeSub && broadKeywordsList.includes(keyword)) continue; 

                if (textToTest.includes(keyword)) {
                    if (keyword.length <= 3) {
                        const wordBoundaryRegex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
                        if (wordBoundaryRegex.test(textToTest)) {
                            contentBannedCache.set(lowerText, true);
                            return true;
                        }
                    } else {
                        contentBannedCache.set(lowerText, true);
                        return true;
                    }
                }
            }
            
            for (let i = 0; i < regexKeywordsToHide.length; i++) {
                const regexStr = regexKeywordsToHide[i].toString().toLowerCase();
                if (isSafeSub) {
                    let isBroad = false;
                    for (let j = 0; j < broadRegexPatterns.length; j++) {
                        if (regexStr.includes(broadRegexPatterns[j])) {
                            isBroad = true; break;
                        }
                    }
                    if (isBroad) continue;
                }
                if (regexKeywordsToHide[i].test(textToTest)) {
                    contentBannedCache.set(lowerText, true);
                    return true;
                }
            }
        }
        
        contentBannedCache.set(lowerText, false);
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

            for (let i = 0; i < keywordsToHide.length; i++) {
                if (textToTest.includes(keywordsToHide[i].toLowerCase())) return true;
            }

            for (let i = 0; i < regexKeywordsToHide.length; i++) {
                if (regexKeywordsToHide[i].test(textToTest)) return true;
            }
            
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

            for (let i = 0; i < keywordsToHide.length; i++) {
                const keywordNoSpaces = keywordsToHide[i].toLowerCase().replace(/\s+/g, '');
                if (!keywordNoSpaces || keywordNoSpaces.length < 3) continue; 
                
                if (textToTest.startsWith(keywordNoSpaces) || textToTest.endsWith(keywordNoSpaces) || textToTest === keywordNoSpaces) {
                    return true;
                }
            }
            
            for (let i = 0; i < regexKeywordsToHide.length; i++) {
                if (regexKeywordsToHide[i].test(textToTest)) return true;
            }
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
            if (canonical) rememberApprovedPostId(canonical);
        } catch {}

        element.classList.add('reddit-approved');
        permanentlyApprovedElements.add(element);
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
        
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerSub.includes(keywordsToHide[i].toLowerCase())) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerSub)) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
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

    function processAllUnapprovedPosts() {
        const posts = document.querySelectorAll(`
            article:not(.prehide):not(.reddit-approved), 
            shreddit-post:not(.prehide):not(.reddit-approved), 
            [subreddit-prefixed-name]:not(.prehide):not(.reddit-approved),
            [data-testid="search-post-unit"]:not(.prehide):not(.reddit-approved),
            [data-id="search-media-post-unit"]:not(.prehide):not(.reddit-approved)
        `);
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            const shouldBan = evaluateElementForBanning(post);
            if (shouldBan) {
                post.classList.add('prehide', 'reddit-banned');
                hideSearchElement(post); 
                removeElementAndRelated(post); 
            } else {
                markElementAsApproved(post);
            }
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
        const allSearchItems = [
            ...Array.from(document.querySelectorAll('[data-type="search-dropdown-item-label-text"]')),
            ...Array.from(document.querySelectorAll('span.font-semibold.text-12.uppercase, span.text-category-nsfw')),
            ...Array.from(document.querySelectorAll('li[data-testid="search-sdui-query-autocomplete"], li.recent-search-item')),
            ...Array.from(document.querySelectorAll('li[role="presentation"], a[role="option"], div[data-testid="search-dropdown-item"]')),
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
        function processShadowRoots(node) {
            if (!node) return;
            
            if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                shadowRootsProcessed.add(node.shadowRoot);
                processShadowSearchItems(node.shadowRoot);
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
        if (document.body) { processShadowRoots(document.body); }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            processShadowRoots(searchDropdowns[i]);
        }
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

            // 5. Fallback URL Check (Raw strings)
            if (!isUrlAllowed()) {
                for (let i = 0; i < keywordsToHide.length; i++) {
                    if (currentUrl.includes(keywordsToHide[i].toLowerCase())) {
                        devLog(`Banned keyword in URL: ${keywordsToHide[i]}. Redirecting...`);
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                        return;
                    }
                }
                for (let i = 0; i < regexKeywordsToHide.length; i++) {
                    if (regexKeywordsToHide[i].test(currentUrl)) {
                        devLog(`Banned regex in URL: ${regexKeywordsToHide[i]}. Redirecting...`);
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                        return;
                    }
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

    function clearRecentPages() {
        try {
            localStorage.setItem('recent-subreddits-store', '[]');
            localStorage.removeItem('recent-communities-store');
            localStorage.removeItem('recent-communities');
            localStorage.removeItem('reddit-recent-pages');
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
        
        clearRecentPages();
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
            if (!element.shadowRoot || shadowRootsProcessed.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            for (let j = 0; j < posts.length; j++) {
                const post = posts[j];
                if (processedElements.has(post)) continue;
                processedElements.add(post);
                
                const shouldBan = evaluateElementForBanning(post);
                if (shouldBan) {
                    safelyHideElement(post);
                } else {
                    markElementAsApproved(post);
                }
            }
            
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
        processAllUnapprovedPosts();
        processSearchCommunities();
        
        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            checkForAdultContentTag();
            clearRecentPages();
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

        // Sanity loop fully unbound from document.hidden to catch background tabs!
        const sanityInterval = setInterval(() => {
            enforceSanity();
        }, 500);
        intervalIds.add(sanityInterval);
        
        if (window.requestIdleCallback) {
            const idleCallback = () => {
                if (document.hidden) {
                    runAllChecks();
                } else {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    processAllUnapprovedPosts();
                    processSearchCommunities();
                    hideAnswersButton();
                }
                window.requestIdleCallback(idleCallback, { timeout: 3000 });
            };
            window.requestIdleCallback(idleCallback, { timeout: 3000 });
        } else {
            const backgroundInterval = setInterval(() => {
                batchProcess(() => {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    processAllUnapprovedPosts();
                    processSearchCommunities();
                    hideAnswersButton();
                });
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

    const processNewElements = throttle((mutations) => {
        let needsSearchUpdate = false;

        const limitedMutations = Array.isArray(mutations) ? mutations.slice(0, 30) : mutations;
        
        for (let i = 0; i < limitedMutations.length; i++) {
            const mutation = limitedMutations[i];
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
            }
            
            const addedLimit = Math.min(mutation.addedNodes.length, 15);
            for (let j = 0; j < addedLimit; j++) {
                const node = mutation.addedNodes[j];
                if (!node || node.nodeType !== 1) continue;
                
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
                
                if (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST' || 
                   (node.getAttribute && node.getAttribute('data-testid') === 'search-post-unit') ||
                   (node.getAttribute && node.getAttribute('data-id') === 'search-media-post-unit')) {
                    if (!processedElements.has(node)) {
                        processedElements.add(node);
                        
                        const shouldBan = evaluateElementForBanning(node);
                        if (shouldBan) {
                            safelyHideElement(node);
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
                    
                    const shadowPosts = node.shadowRoot.querySelectorAll('article, shreddit-post');
                    const maxShadowPosts = Math.min(shadowPosts.length, 10);
                    for (let k = 0; k < maxShadowPosts; k++) {
                        const shadowPost = shadowPosts[k];
                        if (!processedElements.has(shadowPost)) {
                            processedElements.add(shadowPost);
                            
                            const shouldBan = evaluateElementForBanning(shadowPost);
                            if (shouldBan) {
                                safelyHideElement(shadowPost);
                            } else {
                                markElementAsApproved(shadowPost);
                            }
                        }
                    }
                    
                    observeShadowRootOnce(node.shadowRoot);
                }
                
                if (node.querySelectorAll) {
                    const hrElements = node.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
                    for (let k = 0; k < hrElements.length; k++) {
                        safelyHideElement(hrElements[k]);
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
    try {
        domDetachObserver.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}

    hideBannedSubredditsFromSearch();
    hideBannedSubredditsFromAllSearchDropdowns();

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