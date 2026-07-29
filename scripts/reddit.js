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

    //  Blocksite consistency list (every term from blocksite list)
        /epnu/i, /epno/i, /epeno/i, /ndres/i, /udif/i, /derrier/i, /derriere/i, /undress/i, /del clot/i, /eras clot/i, /eras pant/i, /del pant/i, /lex bl/i, /lex kauf/i,
        /lex cabr/i, /lex carb/i, /Liv Morgan/i, /Giona Jene/i, /Gionna Daddio/i, /Jene Daddio/i, /Zeli Vega/i, /Nikki/i, /remov pant/i, /remov cloth/i, /shak ass/i, 
	/shak booty/i, /shak butt/i, /AI cloth/i, /AI pant/i, /AI linger/i, /linqerie/i, /Zelina/i, /Zel Vega WWE/i, /removal of cloth/i, /remov of cloth/i, /0ffr0b/i,  
	/eras of cloth/i, /Sydney Sweeney/i, /Zel Veg WWE/i, /swapface/i, /Fanene/i, /faceswap/i, /face swap/i, /morphface/i, /morph face/i, /facemorph/i, /face morph/i, 
	/faceblend/i, /face blend/i, /Zel Vag WWE/i, /swap face/i, /switch faces/i, /switchfaces/i, /faceswitch/i, /face switch/i, /offrobe/i, /0ffrob/i, /offr0b/i,  
	/painttonud/i, /paint2nud/i, /paint to nud/i, /paint 2 nud/i, /p4int/i, /pa1nt/i, /uncloth/i, /un cloth/i, /derobe/i, /de robe/i, /un-cloth/i, /delet of cloth/i,
        /de-robe/i, /disrobe/i, /dis-robe/i, /clothoff/i, /cloth off/i, /cloth-off/i, /Unpant/i, /b1kin/i, /bik1n/i, /trunks/i, /trunk5/i, /unblur/i, /enhanc/i, /upscale/i,
        /enhanceunblur/i, /photoenhance AI/i, /AI enhancing/i, /Enhancing AI/i, /AI photoenhance/i, /AI-photoenhance/i, /photoenhance-AI/i, /AI unblur and enhance/i, 
	/AI unblur and upscale/i, /rule 34/i, /rulethirtyfour/i, /rule thirtyfour/i, /Explicit AI content/i, /gr4phy/i, /p0rno/i, /porn0/i, /deepfake/i, /deep fake/i, 
	/object remov/i, /remov object/i, /delet object/i, /object delet/i, /eras object/i, /object eras/i, /unblur/i, /un blur/i, /deblur/i, /de blur/i, /remov blur/i, 
	/rem0v/i, /r3mov/i, /d3let/i, /del3t/i, /3rasi/i, /er4si/i, /eras1/i, /Reveal AI/i, /AI Reveal/i, /uncensor AI/i, /AI uncensor/i, /unc3nsor/i, /uncen5or/i, 
	/uncens0r/i, /unc3n50r/i, /uncen50r/i, /unc3ns0r/i, /Artific uncensor/i, /Uncensor artific/i, /d3epnu/i, /de3pnu/i, /d33pnu/i, /ndr3ss/i, /ndre5s/i, /ndres5/i, 
	/ndre55/i, /ndr3s5/i, /ndr35s/i, /aifake/i, /iafake/i, /ai fake/i, /ia fake/i, /Denois/i, /De nois/i, /de-nois/i, /dr3ss/i, /dre5s/i, /dres5/i, /celebjihad/i, 
	/celeb-jihad/i, /celebsunmasked/i, /unmaskedcelebs/i, /celebrityfakes4u/i, /celebrityfakesforyou/i, /celebrityfakes2you/i, /celebrityfakestoyou/i, /outfitswap/i, 
	/swapoutfit/i, /outfit-swap/i, /swap-outfit/i, /aznude/i, /az_nude/i, /az-nude/i, /Fapello/i, /Daddio/i, /Gionna/i, /Giona/i, /Gion4/i, /G1ona/i, /Brianna Garcia/i, 
	/gi0na/i, /Brie Garcia/i, /Nikki Garcia/i, /Bella Twin/i, /Samantha/i, /S4mantha/i, /sam4ntha/i, /s4m4ntha/i, /s4m4nth4/i, /sam4nth4/i, /s4manth4/i, /Irvin wrest/i, 
	/Irvin rass/i, /Irvin WWE/i, /Irvin AEW/i, /Irvin TNA/i, /Irvin NJPW/i, /Irwin wrest/i, /Irwin rass/i, /Irwin WWE/i, /Irwin AEW/i, /Irwin TNA/i, /Irwin NJPW/i, 
	/D4ddio/i, /dadd1o/i, /daddi0/i, /d4dd1o/i, /d4ddi0/i, /dadd10/i, /Sanna Marin sex/i, /Sanna Marin anal/i, /fappenist/i, /fappening/i, /nude leak/i, /naked leak/i, 
	/bare leak/i, /cunt leak/i, /pussy image leak/i, /pussy photo leak/i, /pussy pic leak/i, /celeb leak/i, /porn leak/i, /onlyfans leak/i, /fantime leak/i, /Nood/i,
	/JustForFans leak/i, /FanCentro leak/i, /MYM leak/i, /Unfiltrd leak/i, /Loyalfans leak/i, /Ismygirl leak/i, /Friendsonly leak/i, /Modelhub leak/i, /myFanPark leak/i, 
	/iFans leak/i, /Fanso leak/i, /Mygirlfund leak/i, /AdultNode leak/i, /Uncensored leak/i, /Unfiltered leak/i, /Fanvue leak/i, /Okfans leak/i, /Manyvids leak/i, 
	/Scrile connect leak/i, /Flirtback leak/i, /Scrile content leak/i, /picwish/i, /snapedit/i, /Carbrera/i, /undiewear/i, /und1es/i, /undi3s/i, /undie5/i, /und13s/i, 
	/und1e5/i, /undi35/i, /swimwear/i, /sw1mw/i, /5wimw/i, /sw1mwe4r/i, /sw1mw34r/i, /remov underwear/i, /remov undie/i, /remov boxers/i, /delet underwear/i, /poses/i,
	/Fansly leak/i, /delet bikini/i, /eras swimwear/i, /remov swimwear/i, /delet swimwear/i, /remov suit/i, /delet suit/i, /eras suit/i, /remov bra/i, /delet bra/i, 
	/delet pant/i, /delet boxers/i, /delet undie/i, /delet cloth/i, /eras cloth/i, /based labs/i, /basedlabs/i, /Glutes/i, /Coarse vid/i, /Coarse pic/i, /c0arse/i, 
	/co4rse/i, /coar5e/i, /coars3/i, /noodi/i, /b1kin1/i, /b!kin1/i, /b1kin!/i, /b!kin!/i, /Bella fantas/i, /St3phan/i, /st3ph4n/i, /steph4n/i, /Steph Nicole/i, 
	/Chigvintsev/i, /Immodest/i, /Nethers/i, /Nether regions/i, /posing/i, /p0s1ng/i, /p05ing/i, /WWE onlyfans/i, /AEW onlyfans/i, /NJPW onlyfans/i, /TNA onlyfans/i, 
	/smexy/i, /sm3xy/i, /Bella/i, /Point 0f View/i, /b0oty/i, /bo0ty/i, /Lady Part/i, /Femal part/i, /Girl part/i, /Genital/i, /Fannie/i, /Fannys/i, /skimp/i, /sk1mp/i, 
	/5kimp/i, /generativ/i, /gener AI/i, /ejaculat/i,/5quirt/i, /squ1rt/i, /squir7/i, /squ1r7/i, /5quir7/i, /5qu1rt/i, /Mercedes Mon/i, /Sasha/i, /B4nks/i, /NJPW tush/i, 
	/AEW tush/i, /TNA tush/i, /WWE tush/i, /NJPW vulva/i, /AEW vulva/i, /TNA vulva/i, /WWE vulva/i, /mak1n out/i, /m4kin out/i, /m4k1n out/i, /makin 0ut/i, /mak1n 0ut/i, 
	/m4kin 0ut/i, /m4k1n 0ut/i, /Nikk Bell/i, /Niki Bell/i, /Zelin Veg/i, /d3epn/i, /de3pn/i, /Nude_AI/i, /noowd/i, /deee/i, /deppp/i, /pus5y/i, /pu5sy/i, /Nude-AI/i, 
	/nuuw/i, /NudeAI/i, /A1 Nud3/i, /AI Nud3/i, /A1 Nude/i, /mak3 nude/i, /mak3 nud3/i, /make nude/i, /mak nud/i, /deppnude/i, /depp-nude/i, /depp nude/i, /depp\+nude/i, 
	/nud1f/i, /deepp/i, /deepe nude/i, /d33p3 nud3/i, /deep3 nud3/i, /deep3 n00d/i, /deep3 n00/i, /deepe no0/i, /deepe n0/i, /deep e n0o/i, /deep e n00/i, /deep e noo/i, 
	/deepe n0o/i, /deepe n00d/i, /foxify/i, /deepen 00/i, /d33pen0/i, /d3epen0/i, /de3pen0/i, /peee/i, /deepeen/i, /deepen oo/i, /deepenoo/i, /deepe noo/i, /make nud3/i, 
	/mak1n/i, /gen nud3/i, /bas3dlabs/i, /AI Gen nud/i, /AI Gen n0/i, /g3n nude/i, /generat_nud/i, /generatenud/i, /genratenud/i, /genratnud/i, /d33pe nude/i, /undre55/i, 
	/undre/i, /AI Nud/i, /de3pno/i, /d33pno/i, /deepn0/i, /de3pn0/i, /deepnu/i, /deep-nud/i, /d33pn0d/i, /depnud/i, /pusss/i, /pussie/i, /pussiie/i, /pussiii/i, /d3pnud/i, 
	/deep-n/i, /deep\+n/i, /deep_nud/i, /deep_n0/i, /deep nud/i, /deepnudo/i, /nuds/i, /n8ked/i, /nak3d/i, /n4ked/i, /deep3/i, /deep-nu/i, /d33p-nu/i, /deep nu/i, /diii/i, 
	/dipnud/i, /dllp-n/i, /dllp_n/i, /dllp n/i, /dllpn/i, /diip n/i, /diip\.n/i, /d1pnud/i, /dip nud/i, /dip-nud/i, /dip_nud/i, /unstabl diffu/i, /diipn/i, /unst4bl d1ffu/i, 
	/deep_n/i, /AI Noo/i, /deepe n00/i, /unst4ble/i, /unst4bl3/i, /unstabl3/i, /pqrn/i, /pårn/i, /pxrn/i, /p0rni/i, /porni/i, /porny/i, /swap pant/i, /fox1fy/i, /fox1f/i,
	/foxif/i, /f0xif/i, /removecloth/i, /remove cloth/i, /generatenude/i, /un5tabl/i, /generate nude/i, /generate nud3/i, /change pant AI/i, /photo ai/i, /imag ai/i,  
	/nsfw=tool/i, /nsfw/i, /nsfw-tool/i, /stablediffusion/i, /stabl diffus/i, /stable-diffusion/i, /stable_diffusion/i, /stable\?diffusion/i, /stable=diffusion/i, /nuk3if/i,
	/st4bl3/i, /stabl diffu/i, /st4bl diffu/i, /5t4bl diffu/i, /d1ffu/i, /unstable-diffusion/i, /un5t4bl/i, /unst4bl/i, /undr/i, /onlyf4ns/i, /onlyf4n5/i, /onlif4n5/i, 
	/mak1n/i, /IMG ai/i, /st4ble/i, /onlif4ns/i, /f4nt1me/i, /fant1me/i, /f4ntime/i, /manyvids/i, /m4nyvids/i, /manyv1ds/i, /manyvid5/i, /m4nyv1d5/i, /f4n5ly/i, /fan5ly/i,
	/f4nsly/i, /0nlynsfw/i, /onlynsfw/i, /deepai/i, /deep-ai/i, /deep\+ai/i, /deep\?ai/i, /deep=ai/i, /deep_ai/i, /gen nude/i, /nude gen/i, /genaratenud/i, /gen_nude/i, 
	/generate_nud/i, /g3nerate_nud/i, /g3n3rat/i, /nudgen/i, /nudegen/i, /nudesgen/i, /nudes gen/i, /nde gen/i, /nude gn/i, /nde gn/i, /creat girlf/i, /creat gf/i, /creategf/i, 
	/mak gf/i, /mak girlf/i, /Girlfriend AI/i, /nudgener/i, /nudi gen/i, /gen3raten/i, /gen3rat3n/i, /live3d/i, /aiexotic/i, /ai exotic/i, /ai-exotic/i, /nsfwart/i, /nsfw art/i, 
	/nsfw art gen/i, /ero Artificial intelligence/i, /Artificial intelligence gen/i, /babe5/i, /Artificial intelligence g3n/i, /generat3/i, /genrat/i, /nude5/i, /waif/i, /cr34te/i, 
	/cr3ate/i, /cr3a7e/i, /cr3at/i, /creat1/i, /Artificial intelligence porn/i, /creat3/i, /Artificial intelligence ero/i, /bebe5/i, /nubee/i, /nub3e/i, /nube3/i, /pxxrn/i, /pxxxrn/i, 
	/poorn/i, /penetr\*\*e/i, /Lex Bliss/i, /createporn/i, /vidnoz/i, /creat porn/i, /porn journey/i, /bussy/i, /pornjourney/i, /frosting ai/i, /fr0st ai/i, /fr0st a1/i, /pornjoy/i, 
	/porn joy/i, /pornj0y/i, /porn j0y/i, /only-babe/i, /onlybabe/i, /ai p0rn/i, /ai corn/i, /priv3/i, /aip0rn/i, /bus5y/i, /bu5sy/i, /privee/i, /prive/i, /r3m0ve/i, /remov3/i, 
	/r3m AI/i, /rem cloth/i, /cloth rem/i, /pant rem/i, /rem pant/i, /pant eras/i, /pant del/i, /frosting\?ai/i, /frosting=ai/i, /frosting-ai/i, /ai onl/i, /porm/i, /un pant/i, 
	/de pant/i, /depant/i, /remdress/i, /rem dress/i, /dress rem/i, /dressrem/i, /rem bra/i, /rem boxers/i, /deldress/i, /de dress/i, /dress de/i, /dressde/i, /del bik/i, /rem bik/i, 
	/eras bik/i, /dress eras/i, /clit\*/i, /clito\*/i, /\*litor\*/i, /\*litori/i, /clitori\*/i, /clitor\*/i, /pl3as/i, /pl345sure/i, /g3nit/i, /ai tush/i, /L3X Bliss/i, /Bl1ss/i, 
	/L3X Bl1ss/i, /pl345ur3/i, /vulv\*/i, /\*ulva/i, /Mercede Bank/i, /pl345ure/i, /m\*stu/i, /mas\*u/i, /mast\*r/i, /vag\*\*a/i, /Artific Intellig/i, /v\*\*ina/i, /\*agina/i, 
	/vagin\*/i, /vagi\*n/i, /puss\*/i, /puss3/i, /pussee/i, /pu5si/i, /puss1/i, /squ1r/i, /s\*uir/i, /squir\*/i, /\*quir/i, /squ\*r/i, /squi\*/i, /sq\*ir/i, /5quir\*/i, /eras photo/i, 
	/eras pic/i, /midjourney/i, /mid journey/i, /prompthero/i, /prompt hero/i, /midjourn3y/i, /creat nud/i, /gen nud/i, /convert nud/i, /conversion nud/i, /nud someone/i, /cr3at nud/i,
	/nud some else pic/i, /nud someone pic/i, /AI suit/i, /nud person p/i, /nud people p/i, /nud person i/i, /nak convert/i, /nak conversion/i, /nud someone i/i, /nud some else i/i, 
	/nud someone p/i, /cre\*te/i, /cre4t nud/i, /crea7 nud/i, /cr347 nud/i, /nud app/i, /m\*k nud/i, /\*ak nud/i, /m4k nud/i, /m&k3 nud/i, /m&ke nud/i, /c\*eate/i, /cr\*ate/i, 
	/crea\*e/i, /creat\*/i, /\*reat/i, /crete nud/i, /cret3 nud/i, /Nudi it/i, /Nude it/i, /###/i, /nud softw/i, /nud softv/i, /nud softf/i, /nud her p/i, /nud the/i, /nud people/i, 
	/nud person/i, /nudein/i, /nudin/i, /nudey/i, /nudy/i, /nudyin/i, /nudeyi/i, /\*ying/i, /creat nak/i, /nud!f/i, /nude!f/i, /doepnud/i, /nuid1/i, /nuidi/i, /nuid/i, /nudl/i, /njuud/i,
        /njud/i, /nujd/i, /nudj/i, /nuidif/i, /nui!d/i, /diepn/i, /deip/i, /diif/i, /deopnud/i, /nidif/i, /n1dif/i, /nid1f/i, /expli\*it/i, /explic\*t/i, /explici\*/i, /\*xplicit/i,
	/e\*plicit/i, /ex\*licit/i, /exp\*icit/i, /expl\*cit/i, /exp!ic/i, /expl!c/i, /3xpl!c/i, /expl1c/i, /horni/i, /horn1/i, /h0rny/i, /whor1/i, /wh0re/i, /whor3/i, /dirti/i, /dirt\*/i,  
	/d1rti/i, /conv3rt/i, /conv3rs/i, /c0nver/i, /d1rtl/i, /dlrt1/i, /dlrt!/i, /dlrti/i, /dlrty/i, /d!rti/i, /dir\*i/i, /dir\*y/i, /who\*ing/i, /deepmok/i, /nuk1f/i, /nuk3f/i,  
	/deepnugif/i, /deepnukeif/i, /deepnugeif/i, /deepn00/i, /deepnoo/i, /diep/i, /nudi app/i, /nude app/i, /ned1f/i, /nedif/i, /nedeif/i, /nudeif/i, /nootify/i, /ned!f/i, /diva vulva/i,
	/artificial intelligence/i, /art intel/i, /ai booty/i, /ai butt/i, /ai horny/i, /diva vag/i, /diva pussy/i, /diva naked/i, /diva nude/i, /diva anal/i, /diva horny/i, /diva the butt/i, 
	/AI explicit/i, /AI explic/i, /Art explic/i, /A1 explic/i, /al explic/i, /al lntel/i, /cl0at/i, /elliecha0tic/i, /AI sensu/i, /off cloth/i, /off robe/i, /Off dress/i, /Off pant/i, 
	/off bra/i, /off swimwear/i, /off lingerie/i, /off boxers/i, /off swimsuit/i, /AI Uncens/i, /Al uncens/i, /A1 uncens/i, /IA nude/i, /AI censor/i, /A\* censor/i, /Al censor/i, 
	/A1 censor/i, /Al unfilt/i, /A1 unflit/i, /AI unfilt/i, /unf1lt/i, /unfllt/i, /unf!lt/i, /\*l tool/i, /\*I tool/i, /A\* tool/i, /IA nud/i, /cloth chan web/i, /cloth chan app/i, 
	/cloth chan sit/i, /cloth chan im/i, /cloth chan ph/i, /cloth chan si/i, /pant chan si/i, /pant chan im/i, /shirt chan pic/i, /shirt chan ph/i, /sh1rt/i, /shirt chan im/i,
	/cloth chan pic/i, /outf chan ap/i, /chng/i, /facechan/i, /cust ai/i, /facl/i, /facechang/i, /face chan/i, /khangin/i, /khange/i, /kh4ng/i, /changr/i, /khang1/i, /khang3/i,
        /khang/i, /thr0at/i, /thro4t/i, /sw1tch/i, /face swi/i, /outf chan im/i, /dress chan ap/i, /shirt chan ap/i, /biur/i, /nude scan/i, /AI blur/i, /khank/i, /khanc/i, /ghang/i,
        /dres chan/i, /dres switch/i, /AI dres/i, /nub1f/i, /nubif/i, /nuuu/i, /noudi/i, /nuod/i, /noudl/i, /noud1/i, /noud3/i, /deepnoud/i, /deepnou/i, /deepnu0/i, /ch4ng/i, /dlidn/i,
	/nuubif/i, /nuub3f/i, /nodress/i, /ndress/i, /nub app/i, /nub site/i, /nuub app/i, /nuub site/i, /deeper nud/i, /deepernud/i, /deepern0o/i, /deeperno0/i, /no dress/i, /diip/i,
	/unstress/i, /n0 tre/i, /n0tre/i, /no tress/i, /untres/i, /ntress/i, /notress/i, /nodif/i, /nod1f/i, /ndif/i, /ndlf/i, /doodlf/i, /dood!f/i, /doodif/i, /dood1f/i, /diid/i,  
	/deepi/i, /sma5h/i, /sm4sh/i, /deep dud si/i, /deep dud ap/i, /deeperno/i, /neepdud/i, /neep dud/i, /dudeif/i, /udelf/i, /dudief/i, /udeif/i, /ude1f/i, /ude!f/i, /dlid n/i,  
	/dild/i, /difd/i, /d nudi/i, /d3d nud/i, /deepenu/i, /deepa/i, /deepb/i, /deepd/i, /deep fa/i, /deepfa/i, /deepfx/i, /deepcu/i, /deepcoc/i, /deepdic/i, /deepic/i, /deeppic/i,  
	/deepf3/i, /deep f4/i, /deepg/i, /deep f3/i, /deepl/i, /deeph/i, /deepj/i, /deepk/i, /deppn/i, /depp nu/i, /deepr/i, /deepq/i, /deepo/i, /deep0/i, /deep n0/i, /deepm/i, /deepw/i,  
	/deepu/i, /deept/i, /deepx/i, /deepsx/i, /deeps\*x/i, /deepz/i, /deeznud/i, /deez nud/i, /deepy/i, /nutif/i, /ntif/i, /nutlf/i, /nut!f/i, /nuteif/i, /nopif/i, /nop1f/i, /nopeif/i,  
	/inpa1nt/i, /inp4int/i, /inp41nt/i, /inpa!nt/i, /inpalnt/i, /llng/i, /AI outf/i, /AI wear/i, /cl0ath/i, /outf!t/i, /outf1t/i, /AI shir/i, /cI0uth/i, /c!0uth/i, /c10uth/i, /cl0uth/i, 
	/c1outh/i, /c!outh/i, /cIouth/i, /c1oth/i, /c!oth/i, /diva the ass/i, /cl0th/i, /cl04th/i, /clo4th/i, /cl0yth/i, /cloyth/i, /w1thout/i, /with0ut/i, /wlth/i, /shlrt/i, /sh!rt/i, /5kirt/i, 
	/5klrt/i, /dudif/i, /dud1f/i, /dud!f/i, /deep som/i, /deepsum/i, /deep sum/i, /deep sud/i, /deep gud/i, /deep cod/i, /nqde/i, /nxde/i, /tutif/i, /tut1f/i, /tut!f/i, /duudi/i, /d0dif/i, 
        /n0dress/i, /dod1f/i, /deepfu/i, /deepfo/i, /deepf0/i, /deep fud/i, /AI editor/i, /3ditor/i, /3d1tor/i, /undressaitool/i, /undressaitools/i, /dexp/i, /nxxe/i, /nuxe/i, /nudx/i, /deepxu/i,  
	/fudeif/i, /deep xu/i, /xudl/i, /qudl/i, /qud!f/i, /qude!f/i, /deep qud/i, /ai dress/i, /ai edit vid/i, /ai softw/i, /nudeifi/i, /zudeif/i, /zudif/i, /deep zu/i, /deep zode/i, /zodlf/i,  
	/zode/i, /zodei/i, /zude/i, /zud1f/i, /zud!f/i, /budif/i, /budeif/i, /deep bude/i, /deep budi/i, /deebn/i, /deeb/i, /debbn/i, /debn/i, /noudif/i, /nuodif/i, /debb/i, /nuodef/i, /noudef/i,  
	/bud!f/i, /budlf/i, /budelf/i, /deep ud/i, /deepud/i, /deep kud/i, /deep xud/i, /deep dudi/i, /deep fui/i, /deep ful/i, /deep fuo/i, /deep fyu/i, /deepfy/i, /deepfiy/i, /deepfiu/i, /deepfe/i,
	/deep fi/i, /deep fou/i, /deep fuy/i, /fodif/i, /fod1f/i, /fod!f/i, /deep cu/i, /deep codi/i, /deep cud/i, /cudeif/i, /cudif/i, /deep foud/i, /deep fuod/i, /deepcod/i, /deepny/i, /deep ny/i, 
	/neep dy/i, /deep noy/i, /noydif/i, /nyodif/i, /nuydif/i, /nyudif/i, /gen1r/i, /off skirt/i, /off skir/i, /bude1f/i, /dodif/i, /without skirt/i, /with out skirt/i, /5quir/i, /plea5/i, /gen1t/i, 
	/deep fuid/i, /deep fod/i, /bude!lf/i, /nudief/i, /leak nude/i, /deepsom/i, /cloath/i, /skrt/i, /outflt/i, /promp nud/i, /nude people i/i, /nud some else p/i, /nud her i/i, /nud!n/i, /nud!ng/i, 
	/niidif/i, /3xpl1c/i, /c0nv3r/i, /deepnukif/i, /nut1f/i, /ntlf/i, /deepf4/i, /Art !ntel/i, /pant chan ph/i, /outf chan si/i, /thr04t/i, /depdud/i, /ghanc/i, /deepnuo/i, /n0dif/i, /deepe nu/i, 
	/deepdud/i, /Art explicit/i, /Xia Brookside/i, /Charlot Flai/i, /Ruby Soho/i, /Iyo sky/i, /Iyo Shirai/i, /Io Shirai/i, /dirt1/i, /n0 dress/i, /sklr/i, /clouth/i, /inpaint/i, /deepv/i, /fudif/i, 
	/zod!f/i,  /un stress/i, /nuub1f/i, /nuod3/i, /deep dudeif/i, /Shirai/i, /rule34/i, /windsor/i, /winds0r/i, /w1nds0r/i, /w1ndsor/i, /Adriana Rizzo/i, /Adriana/i, /Alba Fyre/i, /Kay Lee Ray/i, 
	/Alicia Taylor/i, /Alicia Warrington/i, /Warrington/i, /Arianna Grace/i, /Bianca Carelli/i, /Kanako Urai/i, /Space Galaxy Warrior Leona/i, /Asuka/i, /B-Fab/i, /Briana Brandy/i, /Davina Rose/i, 
	/Davina/i, /Bianca Belair/i, /Bianca/i, /Nicole/i, /Brie Bella/i, /Nikki Bella/i, /Nicole Garcia/i, /Brooke Hogan/i, /azm/i, /Melina Nava/i, /Melina Nava Pérez/i, /Melina Pérez/i, /Mariah May/i, 
	/Blake Monroe/i, /Candice LeRae/i, /Cathy Kelley/i, /Chantel Monroe/i, /Derrian Gobourne/i, /Chelsea Green/i, /Laurel Van Ness/i, /Megan Miller/i, /Fallon Henley/i, /Giulia/i, /Dakota Kai/i,
	/Emily Andzulis/i, /Izzi Dame/i, /Franki Carissa/i, /Jackie Redmond/i, /Jacy Jayne/i, /Avery Taylor/i, /Jade Cargill/i, /Jaida Parker/i, /Tiana Caffey/i, /jazz/i, /Kairi Sane/i, /Xtina Kay/i,
	/Jordynne Grace/i, /Tylynn Register/i, /Kairi Hoku/i, /Karmen Petrovic/i, /Monika Klisara/i, /Kelani Jordan/i, /Lea Mitchell/i, /Kendal Grey/i, /Kiana James/i, /Kayla Inlay/i, /Lainey Reid/i, 
	/Adelicious/i, /Sasha Banks/i, /Mercedes Moné/i, /Alex Gracia/i, /Aleah James/i, /Alicia Atout/i, /Alisha Edwards/i, /naomi/i, /Allysin Kay/i, /Alpha Female/i, /Jazzy Gabert/i, /Amber O'Neal/i, 
	/Amale Winchester/i, /Angel Hayze/i, /Angelica Risk/i, /Angelina Love/i, /Airica Demia/i, /anna jay/i, /Aria Bennett/i, /Arie Alexander/i, /Arkady Aura/i, /azumi/i, /Blair Davenport/i, /hyan/i, 
	/Ash By Elegance/i, /Ashley D'Amboise/i, /Bea Priestley/i, /Dana Brooke/i, /Ayako Hamada/i, /Billie Starkz/i, /Lillian Bridget/i, /Jessie Brooks/i, /Ava Storie/i, /Brandi Lauren/i, /Ivy Nile/i,
	/Camron Branae/i, /Ashley Blaze/i, /Amari Miller/i, /Camron Bra'Nae/i, /Camron Connors/i, /Carlee Bright/i, /Peyton Royce/i, /Cassie Lee/i, /Charlette Renegade/i, /Chigusa Nagayo/i, /Chik Tormenta/i, 
	/Christina Von Eerie/i, /Christyan Reid/i, /Christi Jaynes/i, /Crystal Carmichael/i, /Dalys la Caribean/i, /Dani Luna/i, /Vanessa Borne/i, /Danielle Kamela/i, /Sonya Deville/i, /Daria Berenato/i, 
	/Dasha Gonzalez/i, /Dasha Fuentes/i, /Delmi Exo/i, /Deonna Purrazzo/i, /Diamanté/i, /Priscilla Zuniga/i, /Britt Baker/i, /Dream Girl Ellie/i, /Virginia Ferry/i, /Cora Jade/i, /Elayna Black/i, 
	/Dump Matsumoto/i, /Ella Envy/i, /Dump Matsumoto/i, /Kaoru Matsumoto/i, /Emi Sakura/i, /Emi Motokawa/i, /Donna Rama/i, /Erica Leigh/i, /Estrellita/i, /Faby Apache/i, /Faye Jackson/i, /Lady Flammer/i, 
	/Big Booty Trudy/i, /Freya the Slaya/i, /Freya the Slayer/i, /Gabby LaSpisa/i, /Gabby Ortiz/i, /Gia Miller/i, /Georgia Lee Ann Milton/i, /Valentina Rossi/i, /Gianna Capri/i, /Adriana Gambino/i, 
	/Jenny Levy/i, /Gisele Shaw/i, /Harley Cameron/i, /Danni Ellexo/i, /Reyna Reyes/i, /Harley Hudson/i, /Jessicka Havok/i, /Jessica Havok/i, /Jessika Havok/i, /Heather Reckless/i, /Hikaru Shida/i,
        /holidead/i, /HollyHood Haley/i, /Indi Hartwell/i, /Samantha De Martin/i, /Courtney Stewart/i, /Isla Dawn/i, /Ivelisse/i, /Ivelisse Vélez/i, /Sofia Cortez/i, /Juliette/i, /Jada Stone/i, /Kellyanne/i,
	/Jade Chung/i, /Jade Gentile/i, /Jazmyn Nyx/i, /Rimi Yokota/i, /Jaguar Yokota/i, /Jamie Hayter/i, /Jessi Kamea/i, /Jessie Elaban/i, /Billie Kay/i, /Jessie McKay/i, /Jessy Ventura/i, /Jessy Queen/i, 
	/Jody Threat/i, /Julia Hart/i, /Yulisa Leon/i, /Julisa Leon/i, /Julissa Mexa/i, /Yulisa León/i, /Kacy Catanzaro/i, /Kali Armstrong/i, /Destinee Brown/i, /Karen Jarrett/i, /Elektra Lopez/i, 
	/Karissa Rivera/i, /Kamilla Kaine/i, /kamille/i, /kamille/i, /Summer Sorrell/i, /Katie Forbes/i, /Khloe Hurtz/i, /Kayla Braxton/i, /Kayla Rossi/i, /KC Spinelli/i, /Traci Spinelli/i, /Kylie Rae/i,
	/Nikita Naridian/i,  /Kenzie Paige/i, /Kenzie HEnry/i, /Paige Henry/i, /Kiera Hogan/i, /Killer Kelly/i, /KiLynn King/i, /Kris Statlander/i, /Kristen Stadtlander/i, /Kylie Paige/i, /Kylie Alexa/i, 
	/Briana Ray/i, /Katrina Cortez/i, /Catalina Garcia/i, /Catalina García/i, /La Hiedra/i, /La Rosa Negra/i, /Jamie Frost/i, /Leigh Laurel/i, /Kayden Carter/i, /Lacey Lane/i, /lady frost/i, /Mia Yim/i, 
	/Lady Shani/i, /Lash Legend/i, /Layla Diggs/i, /Breanna Covington/i, /Laynie Luck/i, /Amber Lynn/i, /Lei'D Tapa/i, /Leila Grey/i, /Cat Cardoza/i, /Lena Kross/i, /Marie Malenko/i, /Leva Bates/i,
	/Lexy Nair/i, /Leyla Hirsch/i, /Lilian Garcia/i, /Lizzy Evo/i, /Eliza Alexander/i, /Lizzy Styles/i, /Lola Yara/i, /Lola the Adventurer/i, /Lola Vice/i, /Valerie Loureda/i, /Lyra Valkyria/i, 
	/Aoife Valkyrie/i, /Lady Valkyrie/i, /xia-li/i, /xia li/i, /Maggie Lee/i, /Maggie Moore/i, /Maggie Minerva/i, /Maggie McKinney/i, /Mai Sakurai/i, /Maki Itoh/i, /Jakara Jackson/i, /Mara Sadè/i, 
	/Maria Manic/i, /Marina Shafir/i, /Marti Belle/i, /Masha Slamovich/i, /Masyn Holiday/i, /Darci Khan/i, /Maxxine Dupri/i, /Sofia Cromwell/i, /Utami Hayashishita/i, /mayvalentine/i, /mayaworld/i, 
	/may valentine/i, /maya-world/i, /maya world/i, /Mayu Iwatani/i, /mazzerati/i, /mazzerati/i, /McKenzie Mitchell/i, /Megan Bayne/i, /Lady Maravilla/i, /Meg Monroe/i, /Mercedes Martinez/i, 
	/Melissa Santos/i, /Melina Perez/i, /Mei Suruga/i, /Megumi Kudo/i, /Mickie James/i, /Alexis Laree/i, /Emilia McKenzie/i, /Millie McKenzie/i, /Mila Moore/i, /Kellie Morga/i, /Mima Shimoda/i,
        /Mirai Maiumi/i, /Miranda Alize/i, /Miranda Salinas/i, /Mina Shirakawa/i, /Samantha Starr/i, /Shayna Wayne/i, /Myla Grace/i, /Trinity Fatu/i, /Naomi Knight/i, /Natalia Markova/i, /Nevaeh/i, 
	/Ekaterina Bonnie/i, /Natalya Neidhart/i, /Jasmin Areebi/i, /Nikkita Lyons/i, /La Diablesa Rosa/i, /Nixon Newell/i, /Tegan Nox/i, /Nyla Rose/i, /Penelope Ford/i, /Persephone/i, /Rosemary/i,  
	/Hayley Montoya/i, /Penina Tuilaepa/i, /Piper Niven/i, /Priscilla Kelly/i, /Gigi Dolin/i, /Queen Aminata/i, /Rachael Ellering/i, /Rachael Evers/i, /Aliyah/i, /Nia Jax/i, /Lina Fanene/i, 
	/Nikki Blackheart/i, /Nikki Cross/i, /Nina Samuels/i, /Raquel Rodriguez/i, /Raquel González/i, /Reina González/i, /Victoria González/i, /Reina Dorada/i, /Reyna Dorada/i, /Renee Michelle/i,
	/Haze Jameson/i, /Renee Paquette/i, /Renee Young/i, /Rhea Ripley/i, /Demi Bennett/i, /Robyn Renegade/i, /Ronda Rousey/i, /Courtney Rush/i, /PJ Tyler/i, /Casey Maguire/i, /Roxanne Perez/i, 
	/Ruthie Jay/i, /Ryo Mizunami/i, /Aya Mizunami/i, /Ayane Mizumura/i, /Sadie Gibbs/i, /Sam Leterna/i, /Sam L'Eterna/i, /Samantha L'Eterna/i, /Santana Garrett/i, /Sarah Schreiber/i, /Paige/i, 
	/Saraya/i, /Sareee/i, /Sarray/i, /Sexy Star/i, /Savannah Evans/i, /Saya Kamitani/i, /Scarlett Bordeaux/i, /Elizabeth Chihaia/i, /Serena Deeb/i, /Session Moth Martina/i, /Sexy Dulce/i, 
	/Dulce Garcia/i, /Dulce Poly/i, /Alexandra Barrulas/i, /Shayna Baszler/i, /Shazza McKenzie/i, /Chantelle Bathory/i, /Shinobu Kandori/i, /Shotzi Blackheart/i, /Sirena Linton/i, /Tay Melo/i,
	/Dani Sekelsky/i, /Skylar Raye/i, /Sloane Jacobs/i, /Sloane Jacobs/i, /The Notorious MiMi/i, /Dani Sekelsky/i, /SoCal Val/i, /Valerie Wyndham/i, /Sol Ruca/i, /Steph De Lander/i, /Skylar Raye/i, 
	/Persia Pirotta/i, /Stephanie Vaquer/i, /Stori Denali/i, /Su Yung/i, /Susie/i, /Susan/i, /Sussy Love/i, /Tamina Snuka/i, /Tasha Steelz/i, /Tatevik The Gamer/i, /Tatevik Hunanyan/i, /Tatum Paxley/i, 
	/Tatyanna Dumas/i, /Tay Conti/i, /Taya Valkyrie/i, /Kira Foster/i, /Tessa Blanchard/i, /Thea Hail/i, /Thunder Rosa/i, /Tiffany Nieves/i, /Tiffany Stratton/i, /Tiffany/i, /Toni Storm/i, /Trish Adora/i, 
	/Trish Stratus/i, /Tyra Mae Steele/i, /Tamyra Mensah-Stock/i, /Valentynna Reis/i, /Valentina Feroz/i, /Vicious Vicki/i, /Vicki Venuto/i, /Victoria Andreola/i, /Vivacious Vicki/i, /Vicky Haskins/i, 
	/Amber Vixen/i, /Alicia Fox/i, /Victoria Yuzuki/i, /Vita VonStarr/i, /Wendy Choo/i, /Willow Nightingale/i, /Nightingale/i, /Wren Sinclair/i, /Madi Wrenkowski/i, /Zelina Rosita/i, /Yuka Sakazaki/i, 
	/Zayda Steel/i, /Zena Sterling/i, /Olena Sadovska/i, /Zoey Stark/i, /Lacey Ryan/i, /Zoë Sager/i, /Zelina Vega/i, /Rosita/i, /Victoria Crawford/i,

	// Nuclear regexes, use with caution ;)
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