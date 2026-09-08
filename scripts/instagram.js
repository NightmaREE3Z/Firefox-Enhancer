// ==UserScript==
// @name         IGCleaner v27.6.0-V6H
// @version      2026-09-08
// @description  Trying to make my Instagram experience tolerable.
// @match        *://www.instagram.com/*
// @match        *://www.instagram.com/?next=%2F/*
// @match        *://www.instagram.com/accounts/onetap/?next=%2F/*
// @match        *://www.threads.net/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
'use strict';

    // ===== v43: route class for edit-profile no-glimpse CSS =====
    function isMetaManglerAccountEditPathV43() {
        try {
            if (!location.hostname.includes('instagram.com')) return false;
            return /^\/accounts\/edit\/?$/i.test(location.pathname || '');
        } catch { return false; }
    }

    function updateMetaManglerAccountEditClassV43() {
        try {
            const root = document.documentElement;
            if (!root) return;
            root.classList.toggle('metamangler-account-edit-v43', isMetaManglerAccountEditPathV43());
        } catch {}
    }

    updateMetaManglerAccountEditClassV43();

    // ===== No-glimpse nav trash kill: exact-link, feed-safe =====
    // Exact /reels/ and /explore/ only. No a[href*="reel"] nonsense; feed media often uses /reel/<id>/.
    // Parent selectors are tightly shaped to: span.html-span > div.x1n2onr6 > a._a6hd.
    function injectMinimalNoGlimpseNavCSS() {
        try {
            const id = 'metamangler-minimal-nav-kill';
            let style = document.getElementById(id);
            if (!style) {
                style = document.createElement('style');
                style.id = id;
            }
            style.textContent = `
                /* Reels nav button: exact /reels/ only, so Reel feed media (/reel/<id>/) is safe */
                span.html-span:has(> div.x1n2onr6 > a._a6hd[href="/reels/"]),
                span.html-span:has(> div.x1n2onr6 > a[role="link"][href="/reels/"]),
                div.x1n2onr6:has(> a._a6hd[href="/reels/"]),
                div.x1n2onr6:has(> a[role="link"][href="/reels/"]),
                a._a6hd[href="/reels/"],
                a[role="link"][href="/reels/"],
                a[href="/reels/"],
                a[href="/reels"],
                svg[aria-label="Reels"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    left: -10000px !important;
                    top: -10000px !important;
                    transform: none !important;
                    transition: none !important;
                }

                /* Explore / Tutki nav button: exact /explore/ and the icon/button label */
                span.html-span:has(> div.x1n2onr6 > a._a6hd[href="/explore/"]),
                span.html-span:has(> div.x1n2onr6 > a[role="link"][href="/explore/"]),
                div.x1n2onr6:has(> a._a6hd[href="/explore/"]),
                div.x1n2onr6:has(> a[role="link"][href="/explore/"]),
                a._a6hd[href="/explore/"],
                a[role="link"][href="/explore/"],
                a[href="/explore/"],
                a[href="/explore"],
                div[role="button"][aria-label="Tutki"],
                div[role="button"][aria-label="Explore"],
                svg[aria-label="Tutki"],
                svg[aria-label="Explore"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    left: -10000px !important;
                    top: -10000px !important;
                    transform: none !important;
                    transition: none !important;
                }



                /* v43 accounts/edit no-glimpse: hide only the two red-boxed profile edit rows. */
                html.metamangler-account-edit-v43 main div.x1yztbdb:has(input[role="switch"][aria-label="Tekoälysisällöntuottaja"]),
                html.metamangler-account-edit-v43 main div.x1yztbdb:has(input[role="switch"][aria-label*="Tekoäly" i]),
                html.metamangler-account-edit-v43 main div.x1yztbdb:has(input[role="switch"][aria-label="Näytä tiliehdotuksia profiileissa"]),
                html.metamangler-account-edit-v43 main div.x1yztbdb:has(input[role="switch"][aria-label*="tiliehdotuksia" i]) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    position: absolute !important;
                    left: -10000px !important;
                    top: -10000px !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    content-visibility: hidden !important;
                    transition: none !important;
                    animation: none !important;
                }
/* Sidebar-safe no-glimpse kill for only the actual Suggested-for-you people module.
                   Do NOT hide broad ancestors that merely contain /explore/people/, because that nukes the usable right sidebar. */
                html.metamangler-feed-gate main div.x78zum5.xdt5ytf.xdj266r.x14z9mp.xod5an3.x162z183.x1j7kr1c.xvbhtw8:has(a[href^="/explore/people"]) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    position: absolute !important;
                    left: -10000px !important;
                    top: -10000px !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    content-visibility: hidden !important;
                    transition: none !important;
                    animation: none !important;
                }

                                /* Myös Metalta / Meta AI. This is not feed-media related, so broader aria/title matching is safe enough. */
                a[href="/ai/"],
                a[href="/meta-ai/"],
                a[aria-label*="Meta AI"],
                div[role="button"][aria-label*="Meta AI"],
                [aria-label="Meta AI"],
                [aria-label*="Myös Metalta"],
                [title*="Myös Metalta"],
                [aria-label*="Also from Meta"],
                [title*="Also from Meta"],
                /* Collapse the whole Instagram left-rail tile, not just the SVG.
                   The older rule hid the icon itself, leaving a brief empty nav slot until JS caught up. */
                nav div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"]),
                [role="navigation"] div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"]),
                div.x9f619.x3nfvp2.xr9ek0c:has(svg[aria-label*="Myös Metalta"]),
                div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"]),
                nav div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"]),
                [role="navigation"] div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"]),
                div.x9f619.x3nfvp2.xr9ek0c:has(svg[aria-label*="Also from Meta"]),
                div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"]),
                svg[aria-label*="Myös Metalta"],
                svg[aria-label*="Also from Meta"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    left: -10000px !important;
                    top: -10000px !important;
                    transform: none !important;
                    transition: none !important;
                }

                /* Profile Threads tag under usernames. Target the real Threads profile link, not IG's class soup. */
                main header a[target="_blank"][href*="//www.threads.com/@"]:has(svg[aria-label="Threads"]),
                main header a[target="_blank"][href*="//threads.com/@"]:has(svg[aria-label="Threads"]),
                main header a[target="_blank"][href*="//www.threads.net/@"]:has(svg[aria-label="Threads"]),
                main header a[target="_blank"][href*="//threads.net/@"]:has(svg[aria-label="Threads"]),
                main header div:has(> a[target="_blank"][href*="//www.threads.com/@"]:has(svg[aria-label="Threads"])),
                main header div:has(> a[target="_blank"][href*="//threads.com/@"]:has(svg[aria-label="Threads"])),
                main header div:has(> a[target="_blank"][href*="//www.threads.net/@"]:has(svg[aria-label="Threads"])),
                main header div:has(> a[target="_blank"][href*="//threads.net/@"]:has(svg[aria-label="Threads"])),
                main div[style*="--x-width: 100%;"]:has(a[target="_blank"][href*="//www.threads.com/@"]:has(svg[aria-label="Threads"])),
                main div[style*="--x-width: 100%;"]:has(a[target="_blank"][href*="//threads.com/@"]:has(svg[aria-label="Threads"])),
                main div[style*="--x-width: 100%;"]:has(a[target="_blank"][href*="//www.threads.net/@"]:has(svg[aria-label="Threads"])),
                main div[style*="--x-width: 100%;"]:has(a[target="_blank"][href*="//threads.net/@"]:has(svg[aria-label="Threads"])) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    left: -10000px !important;
                    top: -10000px !important;
                    transform: none !important;
                    transition: none !important;
                }

                /* Legacy Home-feed gate intentionally neutralized in V6E. The dedicated
                   coordinator below is the sole owner of Home-feed presentation. */
                html.metamangler-feed-gate main article {
                    transition: none !important;
                }
            `;
            const parent = document.head || document.documentElement;
            if (parent && !style.isConnected) parent.appendChild(style);
        } catch {}
    }
    injectMinimalNoGlimpseNavCSS();
    injectHomeFeedHybridGateCSS();

    // ===== Feed gate: hide feed articles until the caption scan approves them =====
    function isMetaManglerHomeFeedPath() {
        try {
            if (!location.hostname.includes('instagram.com')) return false;
            const p = location.pathname || '/';
            // Home feed only. Do not apply this to profiles, permalink views, DMs, search, explore, reels, etc.
            return p === '/' || p === '';
        } catch { return false; }
    }

    function updateMetaManglerFeedGateClass() {
        try {
            const root = document.documentElement;
            if (!root) return;
            root.classList.remove('metamangler-feed-gate');
            if (isMetaManglerHomeFeedPath()) root.setAttribute('data-bf-ig-home-feed-hybrid', '1');
            else root.removeAttribute('data-bf-ig-home-feed-hybrid');
        } catch {}
    }
    updateMetaManglerFeedGateClass();
    updateMetaManglerAccountEditClassV43();

    // ===== Lightweight lifecycle/memory tracking =====
    const __timers = { intervals: new Set(), timeouts: new Set() };
    const __observers = new Set();
    const __eventCleanups = new Set();
    const __rafIds = new Set(); 
    const __idleIds = new Set();
    let __cleanupRan = false;
    let __intervalsRunning = false;
    let __isRedirectingFast = false; 
    let __lastKnownUrl = window.location.href; 
    // DIAGNOSTIC: completely disable home-feed article processing to isolate scroll/render jank.
    const __disableHomeFeedArticleProcessing = true;

    function devLog(message) {
        // console.log('[INSTAGRAM.JS]', message);
    }

    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        __timers.intervals.add(id);
        return id;
    }
    function addTimeout(fn, ms) {
        const id = setTimeout(() => {
            __timers.timeouts.delete(id);
            try { fn(); } catch {}
        }, ms);
        __timers.timeouts.add(id);
        return id;
    }
    function addRAF(fn) {
        const id = requestAnimationFrame((ts) => {
            __rafIds.delete(id);
            try { fn(ts); } catch {}
        });
        __rafIds.add(id);
        return id;
    }
    function addIdle(fn, timeout = 700) {
        if (typeof requestIdleCallback === 'function') {
            const id = requestIdleCallback((deadline) => {
                __idleIds.delete(id);
                try { fn(deadline); } catch {}
            }, { timeout });
            __idleIds.add(id);
            return id;
        }
        return addTimeout(fn, 80);
    }
    function stopIntervals() {
        __timers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
        __timers.intervals.clear();
        __intervalsRunning = false;
    }
    function startIntervals(schedulerFn) {
        if (__intervalsRunning) return;
        schedulerFn();
        __intervalsRunning = true;
    }
    function trackObserver(observer) {
        __observers.add(observer);
        return observer;
    }
    function onEvent(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        __eventCleanups.add(() => target.removeEventListener(type, handler, options));
    }


    // ===== v44: homepage own-avatar story shortcut =====
    // Instagram changed the right-rail avatar to open the profile instead of the active story.
    // Keep the visible href honest for middle-click/open-in-new-tab, and also intercept an
    // ordinary left click because Instagram's React handler may otherwise ignore a rewritten href.
    // This reuses the existing mutation observer; no extra page-wide observer is installed.
    const IG_SELF_STORY_SHORTCUT_V44 = Object.freeze({
        handle: 'nightmaree3z',
        profilePath: '/nightmaree3z/',
        storyPath: '/stories/nightmaree3z/'
    });
    const IG_SELF_STORY_MARKER_V44 = 'data-metamangler-self-story-v44';

    function normalizeIGShortcutTextV44(value = '') {
        try {
            return String(value || '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
        } catch { return ''; }
    }

    function isIGHomepageV44() {
        try {
            return location.hostname === 'www.instagram.com' && (location.pathname === '/' || location.pathname === '');
        } catch { return false; }
    }

    function getIGShortcutPathV44(anchor) {
        try {
            return new URL(anchor.getAttribute('href') || anchor.href || '', location.origin).pathname;
        } catch { return ''; }
    }

    function getBestIGSelfStoryHrefV44() {
        const fallback = new URL(IG_SELF_STORY_SHORTCUT_V44.storyPath, location.origin).href;
        try {
            // Prefer the concrete active-story URL from Instagram's own story tray when one exists.
            // Skip the shortcut anchor itself so its generic fallback does not win this search.
            const selector = [
                `a[href^="/stories/${IG_SELF_STORY_SHORTCUT_V44.handle}/"]`,
                `a[href^="https://www.instagram.com/stories/${IG_SELF_STORY_SHORTCUT_V44.handle}/"]`
            ].join(',');
            const links = document.querySelectorAll(selector);
            for (let i = 0; i < links.length; i++) {
                const link = links[i];
                if (!link || link.hasAttribute(IG_SELF_STORY_MARKER_V44)) continue;
                const url = new URL(link.getAttribute('href') || link.href || '', location.origin);
                const match = url.pathname.match(new RegExp(`^/stories/${IG_SELF_STORY_SHORTCUT_V44.handle}/([^/]+)/?$`, 'i'));
                if (match && match[1]) return url.href;
            }
        } catch {}
        return fallback;
    }

    function isIGRightRailSelfProfileAnchorV44(anchor) {
        try {
            if (!anchor || anchor.nodeType !== 1 || anchor.tagName !== 'A') return false;
            if (!isIGHomepageV44()) return false;

            const path = getIGShortcutPathV44(anchor).replace(/\/+$/, '/');
            const profilePath = IG_SELF_STORY_SHORTCUT_V44.profilePath.replace(/\/+$/, '/');
            const storyPath = IG_SELF_STORY_SHORTCUT_V44.storyPath.replace(/\/+$/, '/');
            if (path !== profilePath && path !== storyPath && !anchor.hasAttribute(IG_SELF_STORY_MARKER_V44)) return false;

            const img = anchor.querySelector('img[alt]');
            if (!img) return false;
            const alt = normalizeIGShortcutTextV44(img.getAttribute('alt'));
            const handle = IG_SELF_STORY_SHORTCUT_V44.handle.toLowerCase();
            const looksLikeOwnAvatar = alt.includes(handle) &&
                (alt.includes('profiilikuva') || alt.includes('profile picture') || alt.includes('profile photo'));
            if (!looksLikeOwnAvatar) return false;

            let sawHandle = false;
            let sawSwitch = false;
            let node = anchor;
            for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
                const local = normalizeIGShortcutTextV44(node.textContent || '');
                if (local.includes(handle)) sawHandle = true;
                if (/\b(vaihda|switch)\b/i.test(local)) sawSwitch = true;
                if (node.tagName === 'MAIN' || node.tagName === 'BODY') break;
            }

            const inlineWidth = parseFloat(anchor.style.width || '0');
            const inlineHeight = parseFloat(anchor.style.height || '0');
            let compactAvatar = inlineWidth >= 36 && inlineWidth <= 64 && inlineHeight >= 36 && inlineHeight <= 64;
            if (!compactAvatar && anchor.getBoundingClientRect) {
                const rect = anchor.getBoundingClientRect();
                compactAvatar = rect.width >= 36 && rect.width <= 64 && rect.height >= 36 && rect.height <= 64;
            }

            // The Switch/Vaihda label is the strongest right-rail signal. The captured 44x44
            // geometry is the fallback, while excluding the tiny left-nav and huge profile avatar.
            return (sawHandle && sawSwitch) || compactAvatar;
        } catch { return false; }
    }

    function restoreIGSelfStoryShortcutV44() {
        try {
            document.querySelectorAll(`a[${IG_SELF_STORY_MARKER_V44}]`).forEach(anchor => {
                try {
                    anchor.setAttribute('href', IG_SELF_STORY_SHORTCUT_V44.profilePath);
                    anchor.removeAttribute(IG_SELF_STORY_MARKER_V44);
                } catch {}
            });
        } catch {}
    }

    function patchIGSelfStoryShortcutV44(root = document) {
        try {
            if (!isIGHomepageV44()) {
                restoreIGSelfStoryShortcutV44();
                return 0;
            }

            const candidates = [];
            const add = (anchor) => {
                if (anchor && !candidates.includes(anchor)) candidates.push(anchor);
            };
            const selector = [
                `a[role="link"][href="${IG_SELF_STORY_SHORTCUT_V44.profilePath}"]`,
                `a[role="link"][href="${IG_SELF_STORY_SHORTCUT_V44.profilePath.replace(/\/$/, '')}"]`,
                `a[${IG_SELF_STORY_MARKER_V44}]`
            ].join(',');

            if (root && root.nodeType === 1 && root.matches?.(selector)) add(root);
            root?.querySelectorAll?.(selector).forEach(add);
            if (root !== document) document.querySelectorAll(selector).forEach(add);

            const targetHref = getBestIGSelfStoryHrefV44();
            let patched = 0;
            for (let i = 0; i < candidates.length; i++) {
                const anchor = candidates[i];
                if (!isIGRightRailSelfProfileAnchorV44(anchor)) continue;
                anchor.setAttribute(IG_SELF_STORY_MARKER_V44, 'true');
                anchor.setAttribute('href', targetHref);
                patched++;
            }
            return patched;
        } catch { return 0; }
    }

    function handleIGSelfStoryShortcutClickV44(event) {
        try {
            if (!isIGHomepageV44() || !event || event.defaultPrevented) return;
            const target = event.target;
            const anchor = target && target.closest ? target.closest('a[href]') : null;
            if (!isIGRightRailSelfProfileAnchorV44(anchor)) return;

            const targetHref = getBestIGSelfStoryHrefV44();
            anchor.setAttribute(IG_SELF_STORY_MARKER_V44, 'true');
            anchor.setAttribute('href', targetHref);

            // Let modified clicks use the rewritten href normally. For a plain left click,
            // bypass Instagram's stale profile-route handler and perform a reliable navigation.
            if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                location.assign(targetHref);
            }
        } catch {}
    }
    function cleanup() {
        if (__cleanupRan) return;
        __cleanupRan = true;
        try {
            stopIntervals();
            __timers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __timers.timeouts.clear();
            __rafIds.forEach(id => { try { cancelAnimationFrame(id); } catch {} });
            __rafIds.clear();
            __idleIds.forEach(id => { try { cancelIdleCallback(id); } catch {} });
            __idleIds.clear();
            if (homeFeedScrollIdleTimer !== null) { try { clearTimeout(homeFeedScrollIdleTimer); } catch {} homeFeedScrollIdleTimer = null; }
            __observers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __observers.clear();
            __eventCleanups.forEach(fn => { try { fn(); } catch {} });
            __eventCleanups.clear();
            try { __bfHomeFeedPrepaintObserver?.disconnect(); } catch {}
            try { __bfHomeFeedPrepaintRootWaitObserver?.disconnect(); } catch {}
            __bfHomeFeedPrepaintObserver = null;
            __bfHomeFeedPrepaintObservedRoot = null;
            __bfHomeFeedPrepaintRootWaitObserver = null;
            try { document.getElementById('extra-redirect-style')?.remove(); } catch {}
            try { document.getElementById('reels-navigation-hider')?.remove(); } catch {}
            try { document.getElementById('ig-blank-style')?.remove(); } catch {}
        } catch {}
    }

// ======== Unified keyword regex filter ========
// One source of truth for text/content keyword filtering. Literal keywords from the old list
// are stored here as escaped /i regex literals; runtime-synced names are appended as regexes.
const keywordsToHide = [
    /Bliss/i, /Alexa Bliss/i, /Tiffany/i, /Stratton/i, /Chelsea Green/i, /Bayley/i, /Blackheart/i, /Mercedes/i,
    /Alba Fyre/i, /sensuel/i, /Maryse/i, /Meta AI/i, /Del Rey/i, /CJ Perry/i, /Becky Lynch/i, /Michin/i,
    /Mia Yim/i, /julmakira/i, /Stephanie/i, /Liv Morgan/i, /Piper Niven/i, /queer/i, /Pride/i, /NXT Womens/i,
    /Perry/i, /Henley/i, /Nattie/i, /Jordynne/i, /Woman/i, /Women/i, /@tiffanywwe/i, /@yaonlylivvonce/i,
    /@alexa_bliss_wwe_/i, /@alexa_bliss/i, /@samanthathebomb/i, /Women's/i, /Woman's/i, /Summer Rae/i, /Naomi/i, /Bianca Belair/i,
    /Jessika Carr/i, /Carr WWE/i, /Jessica Karr/i, /bikini/i, /Kristen Stewart/i, /Sydney Sweeney/i, /Nia Jax/i, /AI generated/i,
    /Young Bucks/i, /Jackson/i, /Lash Legend/i, /Jordynne Grace/i, /generated/i, /DeepSeek/i, /TOR-Browser/i, /TOR-selain/i,
    /Opera GX/i, /prostitute/i, /AI-generated/i, /Arianna Grace/i, /deepnude/i, /undress/i, /nudify/i, /nude/i,
    /nudifier/i, /faceswap/i, /facemorph/i, /Sweeney/i, /Alexis/i, /Sydney/i, /Zelina Vega/i, /Mandy Rose/i,
    /playboy/i, /Irving/i, /IYO SKY/i, /Nikki/i, /Bella/i, /Opera Browser/i, /Safari/i, /OperaGX/i,
    /MS Edge/i, /Microsoft Edge/i, /clothes/i, /Lola Vice/i, /Vice WWE/i, /Candice LeRae/i, /attire/i, /only fans/i,
    /miska/i, /crotch/i, /dress/i, /dreamtime/i, /Velvet Sky/i, /LGBTQ/i, /panties/i, /panty/i,
    /cloth/i, /cleavage/i, /deviantart/i, /Trish/i, /Stratus/i, /Tutki/i, /AdvancingAI/i, /Paxley/i,
    /misk33/i, /Tiffy Time/i, /Steward/i, /Roxanne/i, /cameltoe/i, /dreamtime AI/i, /Joanie/i, /Stewart/i,
    /Isla Dawn/i, /escort/i, /inpaint/i, /photopea/i, /onlyfans/i, /fantime/i, /Amari Miller/i, /upscale/i,
    /upscaling/i, /upscaled/i, /AJ Lee/i, /deepfake/i, /ring gear/i, /Transvestite/i, /Aleksa/i, /Giulia/i,
    /Rodriguez/i, /Lisa Marie Varon/i, /Kristen/i, /Natasha/i, /Natalia/i, /booty/i, /Paige/i, /Mafiaprinsessa/i,
    /Chyna/i, /lingerie/i, /venice/i, /AI model/i, /nudifying/i, /undressing/i, /undressed/i, /undressifying/i,
    /undressify/i, /Vladimir Putin/i, /Toni Storm/i, /Skye Blue/i, /Carmella/i, /Mariah May/i, /Harley Cameron/i, /Hayter/i,
    /trunks/i, /pants/i, /Ripley/i, /manyvids/i, /Del Ray/i, /Belts Mone/i, /Cargill/i, /five feet of fury/i,
    /5 feet of fury/i, /selain/i, /browser/i, /DeepSeek AI/i, /fansly/i, /justforfans/i, /patreon/i, /Vince Russo/i,
    /Tay Conti/i, /Valhalla/i, /lotta/i, /Shirai/i, /Io Sky/i, /Iyo Shirai/i, /Dakota Kai/i, /wiikmaaan/i,
    /Asuka/i, /Kairi Sane/i, /Meiko Satomura/i, /NXT Women/i, /Russo/i, /underwear/i, /Rule 34/i, /Nikkita Lyons/i,
    /belfie/i, /Miko Satomura/i, /Sarray/i, /Xia Li/i, /Shayna Baszler/i, /Ronda Rousey/i, /Dana Brooke/i, /Izzi Dame/i,
    /Tamina/i, /Alicia Fox/i, /Madison Rayne/i, /Saraya/i, /Sol Ruca/i, /Layla/i, /Michelle McCool/i, /Eve Torres/i,
    /Kelly/i, /Melina WWE/i, /Jillian Hall/i, /Mickie James/i, /Su Yung/i, /Britt/i, /Nick Jackson/i, /Matt Jackson/i,
    /Sakazaki/i, /Primera/i, /Maria Kanellis/i, /Beth Phoenix/i, /Victoria WWE/i, /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i,
    /Deonna/i, /Purrazzo/i, /Anna Jay/i, /Riho/i, /Britney/i, /Nyla Rose/i, /Angelina Love/i, /Tessmacher/i,
    /Havok/i, /Taya Valkyrie/i, /Valkyria/i, /Tay Melo/i, /Nightingale/i, /Statlander/i, /Hikaru Shida/i, /ZELINA!/i,
    /rule34/i, /Sasha/i, /lesbian/i, /Penelope Ford/i, /Shotzi/i, /Tegan/i, /Sasha Banks/i, /Sakura/i,
    /Tessa/i, /Brooke/i, /Jakara/i, /Scarlett Bordeaux/i, /lesbo/i, /Roxan/i, /B-Fab/i, /Kayden Carter/i,
    /Katana Chance/i, /Lyra Valkyria/i, /Indi Hartwell/i, /Blair/i, /Davenport/i, /Maxxine Dupri/i, /Russia/i, /China/i,
    /Natalya/i, /Lisa Varon/i, /Vilma/i, /Karmen Petrovic/i, /Ava Raine/i, /Yulisa Leon/i, /Cora Jade/i, /Gina Adams/i,
    /Jacy Jayne/i, /Gigi Dolin/i, /Thea Hail/i, /Tatum WWE/i, /Fallon/i, /Valentina Feroz/i, /Wilma/i, /wondershare/i,
    /filmora/i, /Kelani Jordan/i, /Electra Lopez/i, /Wendy Choo/i, /lottapupu/i, /m1ska/i, /m1sk4/i, /Milli/i,
    /Niina/i, /Jasmin/i, /Saana/i, /Veera/i, /Saya Kamitani/i, /misk4/i, /misk3/i, /m1sk3/i,
    /m1ske/i, /m1mmuska/i, /misk33waaa/i, /misk33waa/i, /misk33wa/i, /misk3waa/i, /misk3waaa/i, /miskaawq9/i,
    /misk3wa/i, /Matilda/i, /Malla/i, /Kamitani/i, /Minja/i, /Nikkita/i, /linktr\.ee/i, /vsco\.co/i,
    /Sinulle ehdotettua/i, /Sinulle ehdotettu/i, /Suggested for you/i, /Myös Metalta/i, /@lovable\.dev/i, /@lovable\.ai/i, /Serrano/i, /#perse/i,
    /#pylly/i, /#tissit/i, /#takapuoli/i, /#takamus/i, /#boobs/i, /#boobies/i, /#boobie/i, /#booty/i,
    /#butt/i, /#babe/i, /#aigen/i, /#aigenerated/i, /#aigeneration/i, /#artificial/i, /#aiapplication/i, /#aiedit/i,
    /#rack/i, /#finnishgirl/i, /#girl/i, /#women/i, /#woman/i, /#ladies/i, /#girls/i, /#womens/i,
    /#womans/i, /#belfie/i, /#artificialintelligence/i, /#bestie/i, /#gym/i, /#gymgirl/i, /#gymwoman/i, /#heru/i,
    /#heruu/i, /#heruhoro/i, /#slut/i, /#horny/i, /#horni/i, /#bitch/i, /#pants/i, /#panties/i,
    /#pajama/i, /#pyjama/i, /#bikini/i, /#lingerie/i, /#girly/i, /#girlie/i, /#finnishwoman/i, /#boudoir/i,
    /tiliehdotuksia/i, /linktr.ee/i, /vsco.co/i, /AI\-/i, /-\AI/i, /AI\-suck/i, /AIblow/i, /Suckin/i,
    /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, /motionsw/i, /motionc/i, /poseai/i, /RemovingAI/i,
    /blowjob/i, /b\-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /bjob/i,
    /5uck/i, /lex bl/i, /Steph's/i, /Stephanie's/i, /Stepha/i, /Stepan/i, /Stratu/i, /Stratt/i,
    /Tiffa/i, /Tiffy/i, /katj/i, /lesb/i, /homo/i, /transvestite/i, /Henriikka/i, /Gina Adam/i,
    /pride/i, /transve/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Valtez/i, /Lawrence/i, /Jenny/i,
    /Jenn1/i, /J3nn1/i, /J3nni/i, /J3nn4/i, /Jenn4/i, /Dua Lipa/i, /Dualipa/i, /Jenna/i,
    /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /Rasikangas/i, /jjulia/i, /juuliska/i, /Roxanna/i,
    /Wilm/i, /Noelle/i, /Kristiina/i, /Reetta/i, /irpp4/i, /juliana/i, /julianna/i, /juulianna/i,
    /juuliana/i, /juulia/i, /rasikannas/i, /rasikangas/i, /Ansku/i, /Crowley/i, /Ruby Soho/i, /Monica/i,
    /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /McQueen/i, /motionai/i, /Dolli/i,
    /Dolly/i, /Aliisa/i, /maarit/i, /taija/i, /saija/i, /seija/i, /tiina/i, /teija/i,
    /Miska/i, /Saara/i, /Saaru/i, /Lumikki/i, /Laura/i, /Noora/i, /Lumiikki/i, /Elina/i,
    /Nooru/i, /Camila/i, /Emilia/i, /Tiinu/i, /Katherin/i, /Janita/i, /Susan/i, /Sirja/i,
    /Venla/i, /Jenn/i, /Irene/i, /Milana/i, /Milene/i, /Minea/i, /Anette/i, /Tytti/i,
    /Elisa/i, /Elise/i, /Rebecca/i, /Jonna/i, /Janna/i, /Janet/i, /Aleksiina/i, /Alexiina/i,
    /Maria/i, /Marie/i, /Katja/i, /Minna/i, /Janika/i, /Janissa/i, /Pauliina/i, /Janisa/i,
    /Miisa/i, /Kaisa/i, /Pinj/i, /Jemina/i, /Moona/i, /Viivi/i, /Annika/i, /Marissa/i,
    /Jutta/i, /Amalia/i, /Nelli/i, /Anniina/i, /Marjut/i, /Siiri/i, /Kamila/i, /Kamilla/i,
    /Kamilia/i, /Lauren/i, /Camilla/i, /Camilia/i, /Krisse/i, /Miina/i, /Merja/i, /Alina/i,
    /Mirkku/i, /Irkku/i, /zelina/i, /Aliina/i, /Vilhel/i, /Wilhel/i, /Aurora/i, /Joana/i,
    /Iiris/i, /Erika/i, /Janina/i, /Kasie Cay/i, /Marie Varon/i, /Takaichi/i, /With Grok/i, /By Grok/i,
    /heidih/i, /Grok's/i, /Elon Musk/i, /ElonMusk/i, /Sam Altman/i, /SamAltman/i, /changemotion/i, /swapmotion/i,
    /Huuska/i, /Sakurai/i, /Lyons/i, /Milena/i, /AI creative/i, /AI created/i, /Tekoäly/i, /Teko äly/i,
    /Teko-äly/i, /Teko_äly/i, /generoiva/i, /generoitu/i, /generative/i, /AI create/i, /seksi/i, /Sexi/i,
    /minja/i, /anaali/i, /pillu/i, /pimppi/i, /kyrpä/i, /kulli/i, /sexual/i, /seksuaali/i,
    /Kairi's/i, /Kairii/i, /Sexxy/i, /Sexy/i, /Sexx/i, /@lovable.dev/i, /lovable.dev/i, /maisa/i,
    /gener/i, /@lovable.ai/i, /lovable.ai/i, /lovable ai/i, /Zerrano/i, /Ninajessika/i, /\b#ass\b/i, /\b#tit\b/i,
    /\b#tits\b/i, /\b#boob\b/i, /\b#AI\b/i, /\b#Nox\b/i, /\bCharlotte\b/i, /\bGina\b/i, /\bGin4\b/i, /\bHer\b/i,
    /\bShe\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bHers\b/i, /\bShes\b/i, /\bAlexa\b/i, /\bTiffy\b/i, /\bAI\b/i,
    /\bNeea\b/i, /\bHepe\b/i, /\bIris\b/i, /\bMiia\b/i, /\bMira\b/i, /\bTiia\b/i, /\bKara\b/i, /\bEllu\b/i,
    /\bEeva\b/i, /\bEevi\b/i, /\bEssi\b/i, /\bKira\b/i, /\bSusu\b/i, /\bBra\b/i, /\bLana\b/i, /\bNea\b/i,
    /\bSara\b/i, /\bAnni\b/i, /\bNikki\b/i, /\bNia\b/i, /\bJax\b/i, /\bElla\b/i, /\bElli\b/i, /\bRosa\b/i,
    /\bMari\b/i, /\bmotion\b/i, /\bDoll\b/i, /\bOona\b/i, /\bIra\b/i, /\bIrppa\b/i, /\bG1na\b/i, /\bG!na\b/i,
    /\bGigi\b/i, /\bDolin\b/i, /\bSarah\b/i, /\bG1n4\b/i, /\bEmmi\b/i, /\bAI-generated\b/i, /\bKati\b/i, /\bKiia\b/i,
    /\bIda\b/i, /\bIida\b/i, /\bVera\b/i, /\bAI art\b/i, /\bLexi\b/i, /\bBy AI\b/i, /\bAI edited\b/i, /\bAI edit\b/i,
    /\bModel\b/i, /\bSexy\b/i, /\bSex\b/i, /\bAlexis\b/i, /\bHomo\b/i, /\bGay\b/i, /\bDeep\b/i, /\bFake\b/i,
    /\bBrie\b/i, /\bGirls\b/i, /\bGirly\b/i, /\bGirlie\b/i, /\bGirl's\b/i, /\bTorres\b/i, /\bEve WWE\b/i, /\bManna\b/i,
    /\bNanna\b/i, /\bAava\b/i, /\bAva\b/i, /\bRaine\b/i, /\bGrok\b/i, /\bJensku\b/i, /\bSanna\b/i, /\bHanna\b/i,
    /\bHenna\b/i, /\bAss\b/i, /\bNiina\b/i, /\bSandra\b/i, /\bViola\b/i, /\bMinka\b/i, /\bMilla\b/i, /\bMirka\b/i,
    /\bRoosa\b/i, /\bPeppi\b/i, /\bEveliina\b/i, /\bJulle\b/i, /\bNox\b/i, /\bMenni\b/i, /\bGlna\b/i, /\bvsco\b/i,
    /\bElon\b/i, /\bMusk\b/i, /\bJimi\b/i, /\bAltman\b/i, /\bTara\b/i, /\bKairi\b/i, /\bZoey\b/i,
];

function publishInstagramKeywordConfigToMainWorld() {
    try {
        const patterns = keywordsToHide.map(regex => ({
            source: regex.source,
            flags: regex.flags
        }));
        window.postMessage({
            __metamanglerType: 'ig-keyword-config',
            patterns
        }, location.origin);
    } catch {}
}

function publishInstagramAllowedConfigToMainWorld() {
    try {
        window.postMessage({
            __metamanglerType: 'ig-allowed-config',
            words: allowedWords.slice()
        }, location.origin);
    } catch {}
}

function publishInstagramAccountConfigToMainWorld() {
    try {
        window.postMessage({
            __metamanglerType: 'ig-account-config',
            accounts: instagramAccountsToHide.slice()
        }, location.origin);
    } catch {}
}

const pendingInstagramFeedClassifications = [];

window.addEventListener('message', (event) => {
    try {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.__metamanglerType === 'ig-mainworld-config-request') {
            publishInstagramKeywordConfigToMainWorld();
            publishInstagramAllowedConfigToMainWorld();
            publishInstagramAccountConfigToMainWorld();
            return;
        }
        if (data.__metamanglerType === 'ig-feed-classifications' && Array.isArray(data.items)) {
            if (typeof ingestInstagramNetworkFeedClassifications === 'function') {
                ingestInstagramNetworkFeedClassifications(data.items);
            } else {
                pendingInstagramFeedClassifications.push(...data.items);
            }
        }
    } catch {}
});

publishInstagramKeywordConfigToMainWorld();
publishInstagramAllowedConfigToMainWorld();
publishInstagramAccountConfigToMainWorld();
try { window.postMessage({ __metamanglerType: 'ig-feed-classifier-ready' }, location.origin); } catch {}

function resetKeywordRegexState(regex) {
    try {
        if (regex?.global || regex?.sticky) regex.lastIndex = 0;
    } catch {}
}

function keywordRegexMatches(regex, text) {
    try {
        if (!regex || typeof regex.test !== 'function') return false;
        resetKeywordRegexState(regex);
        const matched = regex.test(String(text || ''));
        resetKeywordRegexState(regex);
        return matched;
    } catch {
        return false;
    }
}

function escapeRegexLiteral(value) {
    return String(value || '').replace(/[\\^$.*+?()\[\]{}|/]/g, '\\$&');
}

let instagramKeywordConfigPublishTimer = null;

function scheduleInstagramKeywordConfigPublish() {
    try {
        if (instagramKeywordConfigPublishTimer) clearTimeout(instagramKeywordConfigPublishTimer);
        instagramKeywordConfigPublishTimer = setTimeout(() => {
            instagramKeywordConfigPublishTimer = null;
            publishInstagramKeywordConfigToMainWorld();
        }, 100);
    } catch {}
}

function addKeywordRegexUnique(regex) {
    try {
        if (!(regex instanceof RegExp)) return false;
        const key = `${regex.source}\u0000${regex.flags}`;
        for (const existing of keywordsToHide) {
            if (!(existing instanceof RegExp)) continue;
            if (`${existing.source}\u0000${existing.flags}` === key) return false;
        }
        keywordsToHide.push(regex);
        scheduleInstagramKeywordConfigPublish();
        return true;
    } catch {
        return false;
    }
}

// String allowed words
const allowedWords = [
   "Lähetä", "Viesti", "Lähetä viesti", "Send a message", "Send message", "Send", "message", "Battlefield", "BF", "BF6", "BF1", "BF4", "BF 1942", "BF2", "Battle field", "memes", "masterrace", "#itsevarmuus",
   "#memes", "meme", "#meme", "Pearl", "Harbor", "Market", "Bro", "Brother", "Metallica", "Sabaton", "Joakim", "James", "Hetfield", "PC", "Build", "Memory", "Ram", "Motherboard", "Mobo", "Cooling", "pcmaster",
   "AIO", "CPU", "GPU", "Radeon", "GeForce", "GTX", "RTX", "50", "60", "70", "80", "90", "X3D", "50TI", "60TI", "70TI", "80TI", "90TI", "Processor", "Graphics", "Card", "Intel", "AMD", "NVidia", "RGB", "cooler",
   "#healing", "#heal", "#itsetunto", "😂", "🤣", "😭", "Lisa Su", "Jensen Huang", "Chip", "Android", "Huawei", "Tech", "Patch", "MSI", "Asus", "ROG", "Strix", "TUF", "Suprim", "Gaming", "OSRS", "RS3", "Jagex", 
   "Old School", "RuneScape",  "Sea Shanty 2", "Sailor's Dream", "Sailing", "Skilling", "Bossing", "Boss", "Mod Ash", "JMod", "Reddit", "Core", "Cores", "3DVCache", "VCache", "Inno3D", "Inno 3D", "Sapphire", "XFX",
   "Nitro", "Pure", "Asus Prime", "X570", "B550", "B650", "B650E", "X670", "X670E", "B850", "X870", "X870E", "B450", "X470", "B350", "X370", "LGA", "1150", "1151", "1155", "AM4", "AM5", "AM6", "Corsair", "Kingston",
   "PowerColor", "DDR5", "DDR4", "DDR3", "Computing", "Computer", "AData", "AM3", "AM3+", "AM2", "GSkill", "Memory", "Ram", "Turbo", "Overclock", "Overclocked", "Air cooling", "Radiator", "Pump", "Header", "Water", 
   "GTA", "Grand Theft Auto", "PlayStation", "PS1", "PS2", "PS3", "PS4", "PS5", "Xbox", "Series", "Pro", "Console", "Sega", "MegaDrive", "Genesis", "Nintendo", "Upgrade", "Room", "Setup", "Christmas", "Wordables",
   "Wordable", "lifelearnedfeelings", "feel", "feelings", "feeling", "pcmasterrace_official", "pcmasterrace", "pc masterrace", "pc master race", "gaming", "game",
];

// Instagram accounts to hide
const instagramAccountsToHide = [
  'yaonlylivvonce', 'alexa_bliss_wwe_', 'samanthathebomb', 'tiffanywwe', 'beckylynchwwe', 'charlottewwe', 'biancabelairwwe', 'thetrishstratuscom', 'thebriebella', 'thenikkibella', 'niajaxwwe', 'sonyadevillewwe', 
  'mandysacs', 'natbynature', 'zelinavegawwe', 'carmellawwe', 'itsmebayley', 'sashabankswwe', 'mercedesmone', 'saraya', 'theajmendez', 'livmorganwwe', 'candicelerae', 'indihartwell', 'raquelwwe', 'dakotakaiwwe',
  'kairi_sane_wwe', 'asuka_wwe', 'meiko_satomura', 'roxanne_wwe', 'pipernivenwwe', 'nikki_cross_wwe', 'jacyjaynewwe', 'gigidxdolinnxt', 'avawwe_', 'blairdavenportwwe', 'lyravalkyria', 'katana_chance', 'serenadeeb', 
  'kaydenwwe', 'maxxinedupri', 'chelseaagreen', 'fallonhenleywwe', 'karmenpetrovicwwe', 'danabrookewwe', 'valhallawwe', 'laceyevanswwe', 'shotziwwe', 'dejwujs_', 'dejwujs', 'tegan_nox_wwe', 'mia_yim', 'sylviorvokki',
  'candicewwe', 'emmalution', 'tenille_dashwood', 'lashlegendwwe', 'karabrannbacka', 'julmakira', 'piia_oksanen', 'wiikmaaan', 'taijamaarit', 'riituskavaanhoi', 'heidisofia_agneta', 'nylarosebeast', 'krisstatlander', 
  'jamiehayter', 'thunderrosa22', 'brittbaker', 'thepenelopeford', 'sylviliukkonen',  'willowwrestles', 'skye_by_wrestling', 'redvelvett', 'anna_jay_aew', 'tayconti_', 'tayconti', 'taymelo', 'heidika', 'heidik', 
  'heidih', 'heidit', 'grok', 'erikavikman', 'erika.helin', 'hikaru_shida', 'jjuliakristiina_', 'mafiaprinsessa', 'riho_ringstar', 'gailkimitsme', 'deonnapurrazzo', 'jordynnegrace', 'mickiejames', 'trinity_fatu',
  'm1mmuska', 'mimmi', 'juliaerikaaz', 'dvondivawwe', 'suyung', 'madisonraynewrestling', 'katariinapohjoiskangas', 'angelinalove', 'velvet_sky', 'brookeadams', 'tessblanchard', 'thetayavalkyrie', 'havokdeathmachine', 
  'killerkellywrestling', 'kierahogan', 'diamante_lax', 'ladyfrost', 'taryn_terrell', 'rebeltanea', 'martimichellewwe', 'jaderedeww',  'alishawrestling', 'savannah_evanswrestling', 'jazzygabert', 'masha_slamovich', 
  'paigewwe', 'kayfabe_kayla', 'roxanne_perez', 'cora.jade', 'piia_barlund', 'lottapupu', 'giuliawrestler', 'starkz_wrestler', 'thedollhousewrestling', 'holidead', 'tessafblanchard', 'thealliebunny', 'taya_valkyrie',
  'thedemonbunny', 'rhearipley_wwe', 'rosemarythehive', 'siennawrestling', 'madisonrayne', 'kimber_lee90', 'kiera_hogan', 'diamantelax', 'realtenille', 'stephaniemcmahon', 'stephanie_buttermore', 'stephanie.vaquer', 
  'julianarasikannas', 'emiliaaq96', 'wwe_asuka', 'kairi_sane_wwe', 'wwe_mandyrose', 'stephaniesanzo', 'shaqwrestling', 'jadecargill', 'emimatsumoto', 'yukisakazaki', 'gina.adams', 'mizuki_wrestler',
  'miskaawq9', 'misk33', 'misk33waaa', 'misk33waa', 'misk33wa', 'misk3waa', 'misk3waaa', 'misk3wa', 'misk4', 'misaaqw', 'lovable.dev', 'lovable', 'lovable.ai', 
];

publishInstagramAllowedConfigToMainWorld();
publishInstagramAccountConfigToMainWorld();

    const instagramBannedPaths = [
        ...instagramAccountsToHide,
        'instagram.com/explore',
        'instagram.com/reels',
        'instagram.com/accounts/blocked_accounts',
        'accounts/settings/v2/hidden_words',
        'accounts/restricted_accounts',
    ];

// === DYNAMIC WRESTLING SYNC ENGINE ===
const dynamicWrestlingSlugs = [];

function loadDynamicWrestlingData() {
    const storageApi = (typeof browser !== 'undefined' && browser.storage) ? browser.storage.local : (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null);
    if (storageApi) {
        storageApi.get(['wrestling_women_urls'], (data) => {
            if (data && data.wrestling_women_urls) {
                data.wrestling_women_urls.forEach(url => {
                    const parts = url.split('/').filter(Boolean);
                    const slug = parts[parts.length - 1]; 
                    if (slug) {
                        dynamicWrestlingSlugs.push(slug.toLowerCase());
                        const name = slug.replace(/-/g, ' ').trim();
                        if (name.length > 2) addKeywordRegexUnique(new RegExp(escapeRegexLiteral(name), 'i'));
                    }
                });
                
                devLog(`Loaded ${dynamicWrestlingSlugs.length} dynamic wrestling names from SmackDownHotel cache.`);
            }
        });
        
        if (storageApi.onChanged) {
            storageApi.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.wrestling_women_urls) {
                    loadDynamicWrestlingData();
                }
            });
        }
    }
}
loadDynamicWrestlingData();
// ===================================

const instagramBannedPathsLower = instagramBannedPaths.map(p => p.toLowerCase());
const allowedWordsLower = allowedWords.map(w => w.toLowerCase());
const instagramAccountsToHideLower = instagramAccountsToHide.map(a => a.toLowerCase());
const instagramAccountsSet = new Set(instagramAccountsToHideLower);

const approvedPostIDs = new Set(); 
const scannedPostsCache = new Map(); 
const feedApprovedPostIDs = new Set(); 
const feedBannedPostIDs = new Set(); 
const feedDeepVerifiedPostIDs = new Set();
const feedDecisionStorageKey = 'bfInstagramFeedDecisionsV2760HybridV6HStability'; 
let feedDecisionSaveTimer = null;
let isFeedScanPhase = true; 

    // ===== RAM guardrails: cap long-scroll caches without changing v20 behavior =====
    const POST_CACHE_LIMIT = 2000;

    function trimSetToLimit(set, limit = POST_CACHE_LIMIT) {
        try {
            while (set && set.size > limit) {
                const oldest = set.values().next().value;
                if (oldest === undefined) break;
                set.delete(oldest);
            }
        } catch {}
    }

    function trimMapToLimit(map, limit = POST_CACHE_LIMIT) {
        try {
            while (map && map.size > limit) {
                const oldest = map.keys().next().value;
                if (oldest === undefined) break;
                map.delete(oldest);
            }
        } catch {}
    }

    function rememberSet(set, value) {
        try {
            if (!value) return;
            set.add(value);
            // Home-feed content decisions are intentionally durable. A post ID is the
            // identity of the decision, not the recycled article node. Keep the generic
            // non-feed caches bounded, but let the persisted feed decision sets survive
            // long scrolling sessions without silently forgetting older approvals.
            if (set !== feedApprovedPostIDs && set !== feedBannedPostIDs) trimSetToLimit(set);
        } catch {}
    }

    function rememberScannedPost(postID, isBanned) {
        try {
            if (!postID) return;
            scannedPostsCache.set(postID, isBanned);
            trimMapToLimit(scannedPostsCache);
        } catch {}
    }

    function prunePostCaches() {
        trimSetToLimit(approvedPostIDs);
        // feedApprovedPostIDs/feedBannedPostIDs are persisted Home-feed decisions and
        // are deliberately not pruned here.
        trimMapToLimit(scannedPostsCache);
    }

    function loadFeedDecisionCache() {
        try {
            if (!location.hostname.includes('instagram.com')) return;
            const raw = localStorage.getItem(feedDecisionStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const approved = Array.isArray(parsed?.approved) ? parsed.approved : [];
            const banned = Array.isArray(parsed?.banned) ? parsed.banned : [];
            const deepVerified = Array.isArray(parsed?.deepVerified) ? parsed.deepVerified : [];
            for (const postID of approved) {
                const id = String(postID);
                rememberSet(feedApprovedPostIDs, id);
                rememberSet(approvedPostIDs, id);
                scannedPostsCache.set(id, false);
            }
            for (const postID of banned) {
                const id = String(postID);
                rememberSet(feedBannedPostIDs, id);
                feedDeepVerifiedPostIDs.delete(id);
                scannedPostsCache.set(id, true);
            }
            for (const postID of deepVerified) {
                const id = String(postID);
                if (feedApprovedPostIDs.has(id) && !feedBannedPostIDs.has(id)) feedDeepVerifiedPostIDs.add(id);
            }
            trimMapToLimit(scannedPostsCache);
        } catch {}
    }

    function scheduleFeedDecisionCacheSave() {
        try {
            if (feedDecisionSaveTimer !== null) return;
            feedDecisionSaveTimer = setTimeout(() => {
                feedDecisionSaveTimer = null;
                try {
                    localStorage.setItem(feedDecisionStorageKey, JSON.stringify({
                        approved: Array.from(feedApprovedPostIDs),
                        banned: Array.from(feedBannedPostIDs),
                        deepVerified: Array.from(feedDeepVerifiedPostIDs)
                    }));
                } catch {}
            }, 300);
        } catch {}
    }

    loadFeedDecisionCache();

    // ===== v27.6.0 V6H MAIN-WORLD PRE-RENDER CLASSIFICATION BRIDGE =====
    // MAIN world sanitizes the Home feed before Relay renders it. These transient
    // Post-ID decisions let the DOM fallback respect connected/collaboration posts
    // without turning network ALLOW into a durable approval cache entry.
    const networkFeedRejectedPostIDs = new Set();
    const networkFeedApprovedPostIDs = new Set();
    const networkFeedRejectReasons = new Map();
    const NETWORK_FEED_DECISION_LIMIT = 5000;

    function trimNetworkFeedDecisions() {
        try {
            while (networkFeedRejectedPostIDs.size > NETWORK_FEED_DECISION_LIMIT) {
                const oldest = networkFeedRejectedPostIDs.values().next().value;
                if (oldest === undefined) break;
                networkFeedRejectedPostIDs.delete(oldest);
                networkFeedRejectReasons.delete(oldest);
            }
            while (networkFeedApprovedPostIDs.size > NETWORK_FEED_DECISION_LIMIT) {
                const oldest = networkFeedApprovedPostIDs.values().next().value;
                if (oldest === undefined) break;
                networkFeedApprovedPostIDs.delete(oldest);
            }
        } catch {}
    }

    function ingestInstagramNetworkFeedClassifications(items) {
        try {
            if (!Array.isArray(items) || !items.length) return;
            let changed = false;
            for (const item of items) {
                if (!item) continue;
                const id = String(item.id || '').trim();
                if (!id) continue;

                if (item.decision === 'reject') {
                    const reasons = Array.isArray(item.reasons) ? item.reasons.slice(0, 8) : [];
                    if (!networkFeedRejectedPostIDs.has(id) || networkFeedApprovedPostIDs.has(id)) changed = true;
                    networkFeedApprovedPostIDs.delete(id);
                    networkFeedRejectedPostIDs.add(id);
                    networkFeedRejectReasons.set(id, reasons);
                    continue;
                }

                if (item.decision === 'allow') {
                    const priorReasons = networkFeedRejectReasons.get(id) || [];
                    const intrinsicReject = priorReasons.some(reason =>
                        reason === 'banned-content' || reason === 'banned-account' || reason === 'ai-content' ||
                        reason === 'sponsored-content' || reason === 'ad'
                    );
                    if (intrinsicReject) continue;
                    if (!networkFeedApprovedPostIDs.has(id) || networkFeedRejectedPostIDs.has(id)) changed = true;
                    networkFeedRejectedPostIDs.delete(id);
                    networkFeedRejectReasons.delete(id);
                    networkFeedApprovedPostIDs.add(id);
                }
            }
            trimNetworkFeedDecisions();
            if (changed && isMetaManglerHomeFeedPath()) {
                try {
                    if (typeof __bf2760HomeV5ScheduleReconcile === 'function') __bf2760HomeV5ScheduleReconcile(0);
                    if (typeof __bf2760HomeV5SchedulePump === 'function') __bf2760HomeV5SchedulePump(40);
                } catch {}
            }
        } catch {}
    }

    if (pendingInstagramFeedClassifications.length) {
        ingestInstagramNetworkFeedClassifications(pendingInstagramFeedClassifications.splice(0));
    }

function findPostWrapper(node) {
    if (!node) return null;
    const article = node.closest('article');
    if (article) return article;

    let candidate = node.parentElement;
    let bestCandidate = null;
    let lvl = 0;

    while (candidate && lvl < 12) {
        if (candidate.tagName === 'MAIN' || candidate.getAttribute('role') === 'main' || candidate.tagName === 'BODY' || candidate.tagName === 'HTML' || candidate.tagName === 'NAV' || candidate.tagName === 'FOOTER') {
            break;
        }

        const articleCount = candidate.querySelectorAll('article').length;
        if (articleCount > 1) {
            break;
        }

        const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
        if (rect) {
            const area = rect.width * rect.height;
            if (rect.width > 100 && rect.width <= 800 && rect.height > 100 && rect.height <= 2500) {
                bestCandidate = candidate;
            }
            if (rect.width > 800 || rect.height > 3000 || area > 2000000) {
                break;
            }
        }

        if (candidate.parentElement) {
            const siblings = Array.from(candidate.parentElement.children);
            const hasArticleSibling = siblings.some(sib => sib !== candidate && sib.tagName === 'ARTICLE');
            if (hasArticleSibling) {
                bestCandidate = candidate;
                break; 
            }
        }

        candidate = candidate.parentElement;
        lvl++;
    }

    return bestCandidate;
}

function getPostIDFromArticle(article) {
    try {
        if (!article) return null;
        const postLink = article.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
        if (postLink) {
            const href = postLink.getAttribute('href') || '';
            const match = href.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
            if (match && match[2]) return match[2];
        }
        const embeddedID = article.getAttribute('data-post-id') || article.getAttribute('data-media-id');
        if (embeddedID) return embeddedID;
    } catch {}
    return null;
}

    const excludedPaths = [
        'direct/t/',
        'inbox',
        'direct/t',
        'stories/nightmaree3z/',
        'stories/nightmaree3z',
    ];

    const protectedElements = [
    // STRUCTURAL PROTECTION (CRITICAL)
    'footer',
    'div:has(> footer)',
    'nav',
    'div:has(> a[href="/"])', 
    'svg[aria-label="Lisää"]', 
    'div:has(> div > div > div > svg[aria-label="Lisää"])',
    'div:has(> div > div > svg[aria-label="Lisää"])',
    'svg[aria-label="Asetukset"]',
    'div:has(> article)', 
    'div:has(> div > article)', 

    // === SEARCH SIDEBAR PROTECTION ===
    'input[type="text"]',
    'input[type="search"]',
    'input[placeholder*="Search"]',
    'input[placeholder*="Haku"]',
    'input[placeholder*="Hae"]',
    'form[role="search"]',
    '[role="listbox"]',
    'div:has(> [role="listbox"])',
    'div:has(> div > [role="listbox"])',
    'div:has(> form[role="search"])',
    'div:has(> input[placeholder*="Search"])',
    'div:has(> input[placeholder*="Haku"])',
    'div:has(> input[placeholder*="Hae"])',
    // ==================================

    // Messaging and compose areas
    'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
    'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate[role="textbox"][spellcheck="true"]',
    'textarea[placeholder="Message..."]',
    'button[type="submit"]',
    'div.x1qjc9v5.x1yvgwvq.x1dqoszc.x1ixjvfu.xhk4uv.x1ke7ulo.x3jqge.x1i7howy.x4y8mfe.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.x78zum5.xdt5ytf.xw7yly9.xktsk01.x1yztbdb.x1d',
    'div.x6s0dn4.x78zum5.x1gg8mnh.x1pi30zi.xlu9dua',

    // Large containers / layout cores
    'main[role="main"]',
    'section[role="main"]',
    'div[role="main"]',
    'main',
    'article',
    'div[data-testid="post"]',
    'div[data-testid="story"]',
    'div[data-testid="feed"]',
    'section.x6s0dn4.xrvj5dj.x1o61qjw.x12nagc.x1gslohp',
    'div.xh8yej3.x1gryazu.x10o80wk.x14k21rp.x1porb0y',
    'nav[aria-label*="Primary"]',
    'nav[role="navigation"]',
    'html',
    'body',
    '#mount_0_0_Ie',

    // Emojis / inputs
    'svg[aria-label="Valitse emoji"]',
    'div[aria-label="Viesti"]',
    'div[role="textbox"]',

    // Old extra compose protections
    'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.xexx8yu.x18d9i69.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd',
    'svg[aria-label="Äänileike"]',
    'input[accept="audio/*,.mp4,.mov,.png,.jpg,.jpeg"]',
    'svg[aria-label="Lisää kuva tai video"]',
    'svg[aria-label="Valitse GIF-animaatio tai tarra"]',
    'svg[aria-label="Tykkää"]',
    'div.x1qjc9v5.x1yvgwvq.x1dqoszc.x1ixjvfu.xhk4uv.x1ke7ulo.x3jqge.x1i7howy.x4y8mfe.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.x78zum5.xdt5ytf.xw7yly9.xktsk01.x1yztbdb',
    'div.x1n2onr6 > div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
    'div[aria-hidden="true"] > div.xi81zsa.x17qophe.x6ikm8r.x10wlt62.x47corl.x10l6tqk.xlyipyv.x13vifvy.x87ps6o.xuxw1ft.xh8yej3',

    // Legacy protected send buttons
    'div[role="dialog"] [role="button"][aria-label="Lähetä"]',
    '[role="button"][aria-label="Lähetä"]',
    'div[role="dialog"] [role="button"][aria-label="Send"]',
    '[role="button"][aria-label="Send"]',
    'div[role="dialog"] div[role="button"][aria-label="Lähetä"]',
    'div[role="dialog"] div[role="button"][aria-label="Send"]',
    'div[role="dialog"] div[role="button"].x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x10w94by.x1qhh985.x14z9mp.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.x4uap5.x18d9i69.xkhd6sd',

    // NEW: Direct inbox containers to protect the thread list in the left sidebar
    'div[aria-label="Viestiketjun lista"][role="navigation"]',
    '[data-pagelet="IGDThreadList"]',
    '[data-pagelet="IGDThreadList"] ul',
    '[data-pagelet="IGDThreadList"] li',
    'div[role="presentation"] > ul',
    '[data-pagelet="IGDThreadList"] [role="presentation"]',

    // Profile Edit Protections (Biografia)
    'textarea#pepBio',
    'label[for="pepBio"]',
    'div:has(> textarea#pepBio)',
    'div:has(> label[for="pepBio"])',

    // Protect Likes / Tykkäykset sections
    'a[href*="/liked_by/"]',
    'section:has(a[href*="/liked_by/"])',
    'span[role="button"][tabindex="0"]',
    'div[role="button"][tabindex="0"]:has(> span.html-span)',
    'section:has(div[role="button"][tabindex="0"]:has(> span.html-span))',
];

function isElementProtected(element) {
    if (!element || element.nodeType !== 1) return false;
    
    if (element.tagName === 'FOOTER' || element.tagName === 'NAV' || element.tagName === 'MAIN' || element.tagName === 'BODY') return true;
    if (element.getAttribute('role') === 'feed' || element.getAttribute('role') === 'main' || element.getAttribute('role') === 'listbox') return true;
    
    // === SEARCH SIDEBAR PROTECTION ===
    if (element.tagName === 'INPUT' || element.tagName === 'FORM') return true;
    if (element.closest('form[role="search"]') || element.closest('[role="listbox"]')) return true;
    if (element.querySelector('form[role="search"], [role="listbox"], input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"]')) return true;
    // === END SEARCH PROTECTION ===

    if (element.tagName !== 'ARTICLE' && element.querySelector('article')) return true;

    if (element.querySelector('footer, nav, svg[aria-label="Lisää"], svg[aria-label="Asetukset"], svg[aria-label="More"], svg[aria-label="Settings"]')) return true;
    if (element.matches('svg[aria-label="Lisää"], svg[aria-label="Asetukset"], svg[aria-label="More"], svg[aria-label="Settings"]')) return true;

    return protectedElements.some(selector => {
        try { return element.matches(selector); } catch { return false; }
    });
}

    const selectorsToHide = [
    '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x1n2onr6 > ._a6hd.x1a2a7pz.xggy1nq.x1hl2dhg.x16',
    '.xvbhtw8.x1j7kr1c.x169t7cy.xod5an3.x11i5rnm.xdj266r.xdt5ytf.x78zum5',
    '.wbloks_79.wbloks_1 > .wbloks_1 > .wbloks_1 > .wbloks_1 > div.wbloks_1',
    '.x1ye3gou.x1l90r2v.xn6708d.x1y1aw1k.xl56j7k.x1qx5ct2.x78zum5.x6s0dn4',
    '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x78zum5.x6s0dn4.x1n2onr6 > ._a6hd.x1a2a7pz.xggy',
    '.xfex06f > div:nth-child(3)',
    'div.x1i10hfl:nth-child(8)',
    'mount_0_0_Ie > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div:nth-child(2) > div > div.x1gryazu.xh8yej3.x10o80wk.x14k21rp',
    'div.x6bk1ks:nth-child(3) > div:nth-child(4) > a:nth-child(1)',
    'div.x6bk1ks:nth-child(3) > div:nth-child(3)',
    '.x1xgvd2v > div:nth-child(2) > div:nth-child(4) > span:nth-child(1)',
    '.x1xgvd2v > div:nth-child(2) > div:nth-child(3) > span:nth-child(1) > a:nth-child(1) > div:nth-child(1)',
    'nav svg[aria-label="Tutki"]',
    '[role="navigation"] svg[aria-label="Tutki"]',
    'div[class^="x9f619 xjbqb8w x78zum5 x168nmei x13lgxp2 x5pf9jr xo71vjh"][style*="height: 250px;"]',
    'h4.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10wh',
    'a.x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tds',
    'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10',
    'nav div[role="button"][tabindex][aria-label="Threads"]',
    '[role="navigation"] div[role="button"][tabindex][aria-label="Threads"]',
    'nav div[role="button"][tabindex][aria-label="Tutki"]',
    '[role="navigation"] div[role="button"][tabindex][aria-label="Tutki"]',
    'nav div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"]',
    '[role="navigation"] div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"]',
    'span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
    'span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
    'div.x1azxncr span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
    'div.x1azxncr span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
    'a[href="/ai/"], a[href="/meta-ai/"], a[aria-label*="Meta AI"], *[aria-label="Meta AI"]',
    'nav a.x1i10hfl[href*="threads"]',
    '[role="navigation"] a.x1i10hfl[href*="threads"]',
    'nav svg[aria-label="Threads"]',
    '[role="navigation"] svg[aria-label="Threads"]',
    'nav svg[aria-label="reels"]',
    '[role="navigation"] svg[aria-label="reels"]',
    'nav a[href="/reels/"]',
    '[role="navigation"] a[href="/reels/"]',
    'nav a[href*="reels"] *',
    '[role="navigation"] a[href*="reels"] *',
    'nav a[href*="reels"]',
    '[role="navigation"] a[href*="reels"]',
    'span:has(a[href*="help.instagram.com/347751748650214"])',
    'div.x78zum5.xdt5ytf.xdj266r.x14z9mp.xod5an3.x162z183.x1j7kr1c.xvbhtw8',
    'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x12nagc.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
    'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10',
    'a.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16t',
    'a.x1i10hfl[href*="blocked"]','a.x1i10hfl[href*="estetty"]','a.x1i10hfl[href*="Rajoitetut tilit"]','a.x1i10hfl[href*="Restricted accounts"]','a.x1i10hfl[href*="Piiloitetut sanat"]','a.x1i10hfl[href*="Hidden Words"]','a.x1i10hfl[href*="hide_story_and_live"]',
    'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="blocked"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="estetty"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Rajoitetut tilit"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Restricted accounts"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Piiloitetut sanat"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="hide_story_and_live"]',
    '[aria-label*="Myös Metalta"]','[title*="Myös Metalta"]','[aria-label*="Also from Meta"]','[title*="Also from Meta"]',
    'nav div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"])','[role="navigation"] div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"])','div.x9f619.x3nfvp2.xr9ek0c:has(svg[aria-label*="Myös Metalta"])','div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"])',
    'nav div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"])','[role="navigation"] div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"])','div.x9f619.x3nfvp2.xr9ek0c:has(svg[aria-label*="Also from Meta"])','div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"])',
    'svg[aria-label*="Myös Metalta"]','svg[aria-label*="Also from Meta"]',
    '[role="navigation"] a[href^="/explore"]','nav[aria-label*="Primary"] a[href^="/explore"]','nav a[href="/explore/"]','nav a[href="/explore/?next=%2F"]','nav a[role="link"][href^="/explore"]',
    'section:has(> div > a._a6hd[href*="?next=%2F"])',
    'a._a6hd[href*="?next=%2F"] ~ div[style*="--x-height: 230px"]',
    'section:has(> div > a._a6hd[href*="?next=%2F"]) div[style*="--x-height: 230px"]',
    'section.xc3tme8.xcrlgei.x1tmp44o.xwqlbqq.x7y0ge5.xhayw2b',
    'section.xqui205.x172qv1o',
    // Link selectors
    'svg[aria-label="Linkin kuvake"]',
    'a[href*="linktr.ee"]',
    'a[href*="linktr.ee"] *',
    'a[href*="vsco.co"]',
    'a[href*="vsco.co"] *',
    'button:has(svg[aria-label="Linkin kuvake"])',
    'a[href*="linktr.ee"], a[href*="linktr.ee"] > div',
    'button:has(div[dir="auto"] a[href*="linktr.ee"])',
    'div:has(div[dir="auto"] a[href*="linktr.ee"])',
    'a[href*="vsco.co"], a[href*="vsco.co"] > div',
    'button:has(div[dir="auto"] a[href*="vsco.co"])',
    'div:has(div[dir="auto"] a[href*="vsco.co"])',
    'div:nth-of-type(4) > div > span',
    'form > div:nth-of-type(3) > div > span',
    'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(6) > div > a',
'div:nth-of-type(7) > div > a',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(5) > div:nth-of-type(7) > div',
'div:nth-of-type(6) > div > a',
'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'form > div:nth-of-type(3)',
'form > div:nth-of-type(4) > div',
    ];

    const selectorsToMonitor = [
        'div.x1qjc9v5.x9f619.x78zum5.xg7h5cd.x1mfogq2.xsfy40s.x1bhewko.xgv127d.xh8yej3.xl56j7k',
        'div.x78zum5.xedcshv',
        'div.x78zum5.xl56j7k.x1n2onr6.xh8yej3',
        'img.xz74otr.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1bs05mj.x5yr21d',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x12nagc.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x6s0dn4.x1oa3qoh.x13a6bvl.x1diwwjn.x1247r65',
        'div.html-div',
        'article',
        'video',
        'span',
        'div',
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'a',
        'button',
        'nav div[role="button"][tabindex][aria-label="Threads"]',
    '[role="navigation"] div[role="button"][tabindex][aria-label="Threads"]',
        'nav div[role="button"][tabindex][aria-label="Tutki"]',
    '[role="navigation"] div[role="button"][tabindex][aria-label="Tutki"]',
        'nav div[role="button"][tabindex][aria-label="Reels"]',
        'div[class*="x1nhvcw1"][class*="xqjyukv"][class*="xdt5ytf"]',
        'span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'nav a.x1i10hfl[href*="threads"]',
    '[role="navigation"] a.x1i10hfl[href*="threads"]',
        'canvas.x1upo8f9.xpdipgo.x87ps6o'
    ];

    const selectorsForExcludedPaths = [
        'nav div[role="button"][tabindex][aria-label="Reels"]',
        'nav div[role="button"][tabindex][aria-label="Threads"]',
    '[role="navigation"] div[role="button"][tabindex][aria-label="Threads"]',
        'nav div[role="button"][tabindex][aria-label="Tutki"]',
    '[role="navigation"] div[role="button"][tabindex][aria-label="Tutki"]',
        'nav div[role="button"][tabindex][aria-label="Myös Metalta"]',
        'nav div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"])',
        '[role="navigation"] div.x9f619.x3nfvp2:has(svg[aria-label*="Myös Metalta"])',
        'div.x9f619.x3nfvp2.xr9ek0c:has(svg[aria-label*="Myös Metalta"])',
        'nav div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"])',
        '[role="navigation"] div.x9f619.x3nfvp2:has(svg[aria-label*="Also from Meta"])',
        'div.x9f619.x3nfvp2.xr9ek0c:has(svg[aria-label*="Also from Meta"])',
        'a.x1i10hfl[href*="ai"]',
        'a.x1i10hfl[href*="Myös Metalta"]',
        'nav a.x1i10hfl[href*="threads"]',
    '[role="navigation"] a.x1i10hfl[href*="threads"]',
        'nav div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"]',
    '[role="navigation"] div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"]',
        'nav div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/reels/"]',
        '[role="navigation"] div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/reels/"]',
        'a.x1i10hfl[href*="blocked"]',
        'a.x1i10hfl[href*="estetty"]',
        'a.x1i10hfl[href*="hide_story_and_live"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="blocked"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="estetty"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="hide_story_and_live"]',

//New and shiny, random spaghetti selectors from IG, yey!
    'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(6) > div > a',
'div:nth-of-type(7) > div > a',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(5) > div:nth-of-type(7) > div',
'div:nth-of-type(6) > div > a',
'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'form > div:nth-of-type(3)',
'form > div:nth-of-type(4) > div',
    ];

    const selectorsToMonitorAndRedirect = [
        'svg.x1lliihq.x1n2onr6.x5n08af[height="48"][width="48"][viewBox="0 0 96 96"]',
        'svg[aria-label=""][height="48"][width="48"][viewBox="0 0 96 96"] circle[cx="48"][cy="48"][r="47"]',
        'svg[viewBox="0 0 96 96"] path[d*="M60.931 70.001H35.065"]',
        // Empty profile (Ei vielä julkaisuja) selectors
        'svg[aria-label="Kamera"]',
        'svg[aria-label="Kamera"][viewBox="0 0 96 96"]',
        'svg[aria-label="Kamera"][height="62"][width="62"]',
    ];

    const bannedPhrases = [
        "Sinulle Ehdotettu", "tiliehdotuksia", "Sinulle Ehdotettua", "Meta AI", "Threads", "Näytä kaikki", "Myös Metalta", "Piiloitetut sanat", "Rajoitetut tilit", "Restricted accounts", "Hidden Words", "Piilota tarinat ja livet", "Hide stories and live",
    ].map(s => s.toLowerCase());

    const textBasedTargets = [
        { selector: 'button', text: 'Estä' },
        { selector: 'button', text: 'Block' },
        { selector: 'span', text: 'Estetty' },
        { selector: 'span', text: 'Blocked' },
        { selector: 'button', text: 'Rajoitetut tilit' },
        { selector: 'button', text: 'Restricted accounts' },
        { selector: 'span', text: 'Rajoitetut tilit' },
        { selector: 'span', text: 'Restricted accounts' },
        { selector: 'span', text: 'Tietyt profiilitiedot' },
        { selector: 'button', text: 'Piilota tarinat ja livet' },
        { selector: 'button', text: 'Hidden Words' },
        { selector: 'span', text: 'Piilota tarinat ja livet' },
        { selector: 'span', text: 'Hide stories and live' },
        { selector: 'a', text: 'Meta AI' },
        { selector: 'div', text: 'Sinulle ehdotettua' },
        { selector: 'div', text: 'tiliehdotuksia' },
        { selector: 'div', text: 'Sinulle ehdotettu' },
        { selector: 'h2', text: 'Suggested for you' },
        { selector: 'span', text: 'Threads' }
    ];

    let currentURL = window.location.href;
    const hiddenElements = new WeakSet();
    let reelsStyleInjected = false;

    const IG_SEARCH_HIDDEN_ATTR = 'data-ig-search-hidden-reason';
    const IG_SEARCH_APPROVE_ATTR = 'data-ig-approve';
    const IG_SEARCH_ROW_ATTR = 'data-ig-row';

    // Helper to unhide nodes
    const unhideNode = (n) => {
        if (n) {
            n.style.removeProperty('display');
            if (hiddenElements.has(n)) hiddenElements.delete(n);
        }
    };

    function stripImagesWithin(el) {
        // no-op: never strip src/srcset/poster from IG media. Hiding wrappers is enough.
        return;
    }

    function isInPostOverlay(node) {
        try {
            return !!(node && node.closest('div[role="dialog"], section[role="dialog"], div[aria-modal="true"]'));
        } catch { return false; }
    }
    function isPostOverlayOpen() {
        return !!document.querySelector('div[role="dialog"] article, section[role="dialog"] article, div[aria-modal="true"] article, div[role="dialog"] [data-testid="post"]');
    }
    function updateOverlayState() {
        try {
            const hasOverlay = isPostOverlayOpen();
            const target = document.body || document.documentElement;
            if (!target) return;
            if (hasOverlay) {
                target.classList.add('ig-overlay-open');
                document.querySelectorAll('div[role="dialog"], section[role="dialog"], div[aria-modal="true"]').forEach(dlg => {
                    dlg.querySelectorAll('*').forEach(el => {
                        if (hiddenElements.has(el)) {
                            el.style.removeProperty('display');
                            el.style.removeProperty('visibility');
                            el.style.removeProperty('opacity');
                            el.style.removeProperty('position');
                            el.style.removeProperty('left');
                            el.style.removeProperty('top');
                            hiddenElements.delete(el);
                        }
                    });
                });
            } else {
                target.classList.remove('ig-overlay-open');
            }
        } catch {}
    }

    const POST_PATH_RE = /^\/(?:[^/]+\/)?(reel|p|tv)\/([A-Za-z0-9_-]+)\/?$/i;
    const EXCLUDE_SUBPATH_RE = /\/c\/|\/comments\/|\/liked_by(?:\/|$)/i;

    function findPermalink(root) {
        const scope = root || document;
        try {
            const inScopeAnchors = scope.querySelectorAll('a[href]');
            for (const a of inScopeAnchors) {
                const href = a.getAttribute('href');
                if (!href || EXCLUDE_SUBPATH_RE.test(href)) continue;
                try {
                    const url = new URL(href, location.origin);
                    if (POST_PATH_RE.test(url.pathname)) {
                        return url.href;
                    }
                } catch {}
            }
            const canonical = document.querySelector('link[rel="canonical"]');
            if (canonical && canonical.href) {
                try {
                    const url = new URL(canonical.href, location.origin);
                    if (!EXCLUDE_SUBPATH_RE.test(url.pathname) && POST_PATH_RE.test(url.pathname)) {
                        return url.href;
                    }
                } catch {}
            }
            if (scope !== document) {
                const docAnchors = document.querySelectorAll('a[href]');
                for (const a of docAnchors) {
                    const href = a.getAttribute('href');
                    if (!href || EXCLUDE_SUBPATH_RE.test(href)) continue;
                    try {
                        const url = new URL(href, location.origin);
                        if (POST_PATH_RE.test(url.pathname)) {
                            return url.href;
                        }
                    } catch {}
                }
            }
        } catch {}
        return null;
    }

    window.__getIgPermalinkForBannedCaption = function __getIgPermalinkForBannedCaption(containerEl) {
        return findPermalink(containerEl || document);
    };

    window.__redirectToPermalink = function __redirectToPermalink(containerEl) {
        const target = findPermalink(containerEl || document);
        if (!target) return false;
        try {
            const current = new URL(location.href);
            const targetUrl = new URL(target, location.origin);
            const alreadyOnPost =
                POST_PATH_RE.test(current.pathname) &&
                current.origin === targetUrl.origin &&
                current.pathname.replace(/\/+$/, "") === targetUrl.pathname.replace(/\/+$/, "");
            if (alreadyOnPost) return false;
            location.assign(targetUrl.href);
            return true;
        } catch {
            return false;
        }
    };

    function isPermalinkView() {
        try {
            const p = location.pathname;
            return /^\/(?:[^/]+\/)?(?:p|reel|tv)\/[A-Za-z0-9_\-]+/.test(p);
        } catch { return false; }
    }
    
    function extractHandlesFromText(text) {
        const out = new Set();
        if (!text || typeof text !== 'string') return [];
        try {
            const re = /@([A-Za-z0-9._]{2,30})/g;
            let m;
            while ((m = re.exec(text)) !== null) {
                const h = (m[1] || '').toLowerCase();
                if (h) out.add(h);
            }
        } catch {}
        return Array.from(out);
    }
    
    function getAuthorFromNode(node) {
        if (!node) return '';
        const RESERVED = new Set(['p','reel','tv','explore','reels','accounts','stories','direct','meta-ai','ai', 'about', 'help', 'legal']);
        
        try {
            const profileLinks = Array.from(node.querySelectorAll('a[role="link"][href^="/"]'));
            for (const a of profileLinks) {
                const href = a.getAttribute('href') || '';
                const parts = href.split('/').filter(Boolean);
                if (parts.length === 1 && !RESERVED.has(parts[0]) && !href.includes('?')) {
                    if (a.querySelector('img') || a.querySelector('svg')) {
                        return parts[0].toLowerCase();
                    }
                }
            }
            
            const allLinks = Array.from(node.querySelectorAll('a[href^="/"]'));
            for (const a of allLinks) {
                const href = a.getAttribute('href') || '';
                const parts = href.split('/').filter(Boolean);
                if (parts.length === 1 && !RESERVED.has(parts[0]) && !href.includes('?')) {
                    return parts[0].toLowerCase();
                }
            }
        } catch {}
        return '';
    }

    function getTargetCaptionNode(rootNode) {
        if (!rootNode) return null;

        const article = rootNode.tagName === 'ARTICLE' ? rootNode : rootNode.querySelector('article');
        if (article) return article;

        const h1 = rootNode.querySelector('h1');
        if (h1 && h1.textContent.trim().length > 0) {
            let parent = h1;
            for (let i=0; i<3; i++) { if (parent.parentElement) parent = parent.parentElement; }
            return parent;
        }

        const timeEls = Array.from(rootNode.querySelectorAll('time'));
        if (timeEls.length > 0) {
            const firstTime = timeEls[0];
            let parent = firstTime.parentElement;
            for (let i = 0; i < 7; i++) {
                if (parent && parent.parentElement && parent.tagName !== 'MAIN' && parent.getAttribute('role') !== 'dialog') {
                    parent = parent.parentElement;
                }
            }
            return parent;
        }

        return null; 
    }

    function collectCaptionTextsFromArticle(article) {
        const texts = [];
        try {
            const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (!parent || parent.closest('ul[role="list"]')) continue;
                const t = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
                if (t && /[A-Za-z]/.test(t)) texts.push(t);
            }
        } catch {}
        return texts;
    }

    function articleHasBannedCaption(article) {
        try {
            const texts = collectCaptionTextsFromArticle(article);
            const combinedText = texts.join(' ');
            for (const t of texts) {
                const low = t.toLowerCase();
                if (!allowedWordsLower.some(w => low.includes(w)) &&
                    keywordsToHide.some(rx => keywordRegexMatches(rx, low))) {
                    return true;
                }
            }
            const handles = extractHandlesFromText(combinedText);
            for (const h of handles) {
                if (instagramAccountsSet.has(h)) return true;
                if (!allowedWordsLower.some(w => h.includes(w)) &&
                    keywordsToHide.some(rx => keywordRegexMatches(rx, h))) {
                    return true;
                }
            }
            const attrNodes = article.querySelectorAll('[alt],[title],[aria-label]');
            for (const node of attrNodes) {
                ['alt','title','aria-label'].forEach(attr => {
                    const val = node.getAttribute(attr);
                    if (!val) return;
                    const low = val.toLowerCase();
                    if (!allowedWordsLower.some(w => low.includes(w))) {
                        if (keywordsToHide.some(rx => keywordRegexMatches(rx, low))) { throw 'BANNED_FOUND'; }
                        extractHandlesFromText(val).forEach(h => {
                            if (instagramAccountsSet.has(h)) { throw 'BANNED_FOUND'; }
                            if (!allowedWordsLower.some(w => h.includes(w)) &&
                                keywordsToHide.some(rx => keywordRegexMatches(rx, h))) {
                                throw 'BANNED_FOUND';
                            }
                        });
                    }
                });
            }
            const links = article.querySelectorAll('a[href]');
            for (const a of links) {
                const hrefRaw = a.getAttribute('href') || '';
                let pathname = '';
                try {
                    const u = new URL(hrefRaw, location.origin);
                    pathname = u.pathname.toLowerCase();
                } catch {
                    pathname = hrefRaw.split('?')[0].split('#')[0].toLowerCase();
                }
                const parts = pathname.split('/').filter(Boolean);
                if (parts.length) {
                    const candidateUser = parts[0];
                    if (instagramAccountsSet.has(candidateUser)) return true;
                }
                const hrefLow = hrefRaw.toLowerCase();
                if (!allowedWordsLower.some(w => hrefLow.includes(w)) &&
                    keywordsToHide.some(rx => keywordRegexMatches(rx, hrefRaw))) {
                    return true;
                }
            }
        } catch (e) {
            if (e === 'BANNED_FOUND') return true;
        }
        return false;
    }

    function closeOverlayIfPossible() {
        try {
            const closeBtn = document.querySelector('div[role="dialog"] [aria-label="Sulje"], div[role="dialog"] [aria-label="Close"], div[role="dialog"] svg[aria-label="Sulje"], div[role="dialog"] svg[aria-label="Close"]');
            closeBtn?.click();
        } catch {}
    }

    function expandAndScanNode(node, postID) {
        return new Promise((resolve) => {
            try {
                if (!node) return resolve(true);

                if (postID && scannedPostsCache.has(postID)) {
                    return resolve(!scannedPostsCache.get(postID));
                }

                if (postID && feedBannedPostIDs.has(postID)) {
                    rememberScannedPost(postID, true);
                    return resolve(false);
                }

                if (postID && (feedApprovedPostIDs.has(postID) || approvedPostIDs.has(postID))) {
                    rememberScannedPost(postID, false);
                    return resolve(true);
                }

                if (articleHasBannedCaption(node)) {
                    if (postID) {
                        rememberScannedPost(postID, true);
                        rememberSet(feedBannedPostIDs, postID);
                        scheduleFeedDecisionCacheSave();
                    }
                    return resolve(false);
                }

                const moreBtn = Array.from(node.querySelectorAll('[role="button"], button, span')).find(el => {
                    if (!el || !el.textContent) return false;
                    const txt = el.textContent.trim().toLowerCase();
                    return txt === 'more' || txt === 'lisää' || txt === 'more...' || txt === 'lisää...';
                });

                if (!moreBtn) {
                    if (postID) {
                        rememberSet(feedApprovedPostIDs, postID);
                        rememberSet(approvedPostIDs, postID);
                        rememberScannedPost(postID, false);
                        scheduleFeedDecisionCacheSave();
                    }
                    return resolve(true);
                }

                let expandedByScanner = false;
                try {
                    moreBtn.click();
                    expandedByScanner = true;
                } catch {}

                setTimeout(() => {
                    let hasBanned = false;
                    try { hasBanned = articleHasBannedCaption(node); } catch {}

                    if (expandedByScanner) {
                        try {
                            const lessBtn = Array.from(node.querySelectorAll('[role="button"], button, span')).find(el => {
                                if (!el || !el.textContent) return false;
                                const txt = el.textContent.trim().toLowerCase();
                                return txt === 'less' ||
                                    txt === 'show less' ||
                                    txt === 'vähemmän' ||
                                    txt === 'näytä vähemmän' ||
                                    txt === 'näytä vähemmän...';
                            });
                            if (lessBtn) lessBtn.click();
                            else moreBtn.click();
                        } catch {}
                    }

                    if (postID) {
                        rememberScannedPost(postID, hasBanned);
                        if (hasBanned) {
                            rememberSet(feedBannedPostIDs, postID);
                            feedApprovedPostIDs.delete(postID);
                            approvedPostIDs.delete(postID);
                        } else {
                            rememberSet(feedApprovedPostIDs, postID);
                            rememberSet(approvedPostIDs, postID);
                            feedBannedPostIDs.delete(postID);
                        }
                        scheduleFeedDecisionCacheSave();
                    }
                    resolve(!hasBanned);
                }, 120);
            } catch {
                if (postID) {
                    rememberScannedPost(postID, false);
                    rememberSet(feedApprovedPostIDs, postID);
                    rememberSet(approvedPostIDs, postID);
                    scheduleFeedDecisionCacheSave();
                }
                resolve(true);
            }
        });
    }

    function safelyHideFeedArticle(article) {
        if (!article) return;
        if (isMetaManglerHomeFeedPath() && article.tagName === 'ARTICLE' && article.closest('main')) {
            try {
                const postID = __bf2760HomeV5GetArticlePostID(article) || getPostIDFromArticle(article) || '';
                if (postID) __bf2760HomeV5Reject(article, postID, true);
                else __bf2760HomeV5ReconcileArticle(article, true);
            } catch {}
            return;
        }
        article.style.setProperty('max-height', '1px', 'important');
        article.style.setProperty('height', '1px', 'important');
        article.style.setProperty('min-height', '1px', 'important');
        article.style.setProperty('margin', '0px', 'important');
        article.style.setProperty('padding', '0px', 'important');
        article.style.setProperty('opacity', '0', 'important');
        article.style.setProperty('pointer-events', 'none', 'important');
        article.style.setProperty('border', 'none', 'important');
        article.style.setProperty('overflow', 'hidden', 'important');
        article.style.removeProperty('visibility'); 
        hiddenElements.add(article);
        stripImagesWithin(article);
    }

    function hideHomeFeedFooterLinks() {
        try {
            if (!location.hostname.includes('instagram.com')) return;

            const targetTexts = new Set([
                'suosittua',
                'instagram lite',
                'meta ai',
                'threads'
            ]);

            const isTargetLink = (element) => {
                if (!element || element.nodeType !== 1) return false;
                const text = String(element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const href = String(element.getAttribute('href') || '').toLowerCase();
                return targetTexts.has(text) ||
                    href.includes('/meta-ai/') ||
                    href === '/ai/' ||
                    href.includes('threads.com') ||
                    href.includes('threads.net');
            };

            const collapseTargetItem = (element) => {
                if (!element || element.nodeType !== 1 || hiddenElements.has(element)) return;

                const li = element.closest('li');
                if (li && !li.closest('article, [role="article"], main')) {
                    collapseElement(li);
                    return;
                }

                const parent = element.parentElement;
                if (parent && !parent.matches('footer, nav, main, body, html') &&
                    !parent.closest('article, [role="article"], main')) {
                    const links = parent.querySelectorAll('a, [role="link"]');
                    if (links.length <= 1) {
                        collapseElement(parent);
                        return;
                    }
                }

                collapseElement(element);
            };

            document.querySelectorAll('footer a, footer [role="link"], nav a, nav [role="link"], [role="navigation"] a, [role="navigation"] [role="link"]').forEach(element => {
                if (isTargetLink(element)) collapseTargetItem(element);
            });
        } catch {}
    }

    function processFeedPostsForScanning(maxArticles = Number.POSITIVE_INFINITY) {
        let processed = 0;
        try {
            if (isReelsPage() || isExcludedPath()) return 0;

            if (isMetaManglerHomeFeedPath()) {
                if (homeFeedScanQueue.size === 0) seedHomeFeedScanQueue();

                for (const article of Array.from(homeFeedScanQueue)) {
                    if (processed >= maxArticles) break;
                    homeFeedScanQueue.delete(article);
                    if (!article?.isConnected) continue;

                    const postID = getPostIDFromArticle(article);
                    const scannedID = article.getAttribute('data-scanned-post-id');
                    if (postID && scannedID && scannedID !== postID) {
                        article.removeAttribute('data-banned-scan');
                        article.removeAttribute('data-feed-scan-done');
                    }

                    if (article.hasAttribute('data-feed-scan-done')) continue;

                    if (!article.hasAttribute('data-banned-scan')) {
                        article.setAttribute('data-banned-scan', 'pending');
                    }

                    article.setAttribute('data-feed-scan-done', '1');
                    if (postID) article.setAttribute('data-scanned-post-id', postID);

                    processed++;
                    expandAndScanNode(article, postID).then(isClean => {
                        if (!article.isConnected) return;
                        if (isClean) {
                            article.setAttribute('data-banned-scan', 'safe');
                            article.style.removeProperty('max-height');
                            article.style.removeProperty('height');
                            article.style.removeProperty('min-height');
                            article.style.removeProperty('margin');
                            article.style.removeProperty('padding');
                            article.style.removeProperty('border');
                            article.style.removeProperty('overflow');
                            article.style.setProperty('opacity', '1', 'important');
                            article.style.removeProperty('pointer-events');
                        } else {
                            article.setAttribute('data-banned-scan', 'banned');
                            safelyHideFeedArticle(article);
                        }
                    }).catch(() => {
                        if (!article.isConnected) return;
                        article.setAttribute('data-banned-scan', 'safe');
                        article.style.setProperty('opacity', '1', 'important');
                        article.style.removeProperty('pointer-events');
                    });
                }

            } else {
                const articles = document.querySelectorAll('article');
                for (const article of articles) {
                    if (processed >= maxArticles) break;
                    const postID = getPostIDFromArticle(article);
                    const scannedID = article.getAttribute('data-scanned-post-id');
                    if (postID && scannedID && scannedID !== postID) {
                        article.removeAttribute('data-banned-scan');
                        article.removeAttribute('data-feed-scan-done');
                    }
                    if (article.hasAttribute('data-feed-scan-done')) continue;
                    if (!article.hasAttribute('data-banned-scan')) article.setAttribute('data-banned-scan', 'pending');
                    article.setAttribute('data-feed-scan-done', '1');
                    if (postID) article.setAttribute('data-scanned-post-id', postID);
                    processed++;
                    expandAndScanNode(article, postID).then(isClean => {
                        if (isClean) {
                            article.setAttribute('data-banned-scan', 'safe');
                            article.style.removeProperty('max-height');
                            article.style.removeProperty('height');
                            article.style.removeProperty('min-height');
                            article.style.removeProperty('margin');
                            article.style.removeProperty('padding');
                            article.style.removeProperty('border');
                            article.style.removeProperty('overflow');
                            article.style.setProperty('opacity', '1', 'important');
                            article.style.removeProperty('pointer-events');
                        } else {
                            article.setAttribute('data-banned-scan', 'banned');
                            safelyHideFeedArticle(article);
                        }
                    }).catch(() => {
                        article.setAttribute('data-banned-scan', 'safe');
                        article.style.setProperty('opacity', '1', 'important');
                        article.style.removeProperty('pointer-events');
                    });
                }
            }

            addTimeout(() => { isFeedScanPhase = false; }, 2000);
        } catch {}
        return processed;
    }

    let permalinkScanAttempts = 0;
    const MAX_PERMALINK_SCAN_ATTEMPTS = 80;
    const PERMALINK_RESCAN_DELAY = 60;

    function scanPermalinkArticleAndAct() {
        try {
            let postID = null;
            const match = location.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
            if (match) postID = match[2];

            if (isPermalinkView()) {
                const root = document.querySelector('main') || document.body;
                
                const captionNode = getTargetCaptionNode(root);
                
                if (!captionNode) return;
                if (captionNode.getAttribute('data-caption-scanned') === '1') return;
                
                captionNode.setAttribute('data-caption-scanned', '1');
                
                expandAndScanNode(captionNode, postID).then(isClean => {
                    if (!isClean) {
                        let author = getAuthorFromNode(root) || (location.pathname.match(/^\/([^/]+)\//)?.[1]?.toLowerCase() || '');
                        const RESERVED = new Set(['p','reel','tv','explore','reels','accounts','stories','direct','meta-ai','ai']);
                        if (RESERVED.has(author)) author = ''; 

                        if (author) {
                            fastRedirect(`https://www.instagram.com/${author}/`);
                        } else {
                            fastRedirect('https://www.instagram.com/');
                        }
                    } else {
                        const article = root.tagName === 'ARTICLE' ? root : root.querySelector('article');
                        if (article) article.setAttribute('data-banned-scan', 'safe');
                    }
                });
                return;
            }
            
            if (isPostOverlayOpen()) {
                const overlay = document.querySelector('div[role="dialog"], section[role="dialog"], div[aria-modal="true"]');
                if (!overlay) return;
                
                const captionNode = getTargetCaptionNode(overlay);
                if (!captionNode) return;

                if (captionNode.getAttribute('data-caption-scanned') === '1') return;
                captionNode.setAttribute('data-caption-scanned', '1');
                
                expandAndScanNode(captionNode, postID).then(isClean => {
                    if (!isClean) {
                        closeOverlayIfPossible();
                        safelyHideFeedArticle(overlay);
                    } else {
                        const article = overlay.querySelector('article');
                        if (article) article.setAttribute('data-banned-scan', 'safe');
                    }
                });
            }
        } catch {}
    }

    function makeOverlayLikesClickable() {
        if (!isPostOverlayOpen()) return;
        
        const overlay = document.querySelector('div[role="dialog"] article, section[role="dialog"] article, div[aria-modal="true"] article');
        if (!overlay) return;

        const buttons = overlay.querySelectorAll('span[role="button"][tabindex="0"], div[role="button"][tabindex="0"]');
        
        buttons.forEach(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            if (/^[0-9,.\s]+(?:t\.|m|tykkäystä|likes|k)?$/.test(txt)) {
                if (!btn.hasAttribute('data-ig-likes-fixed')) {
                    btn.setAttribute('data-ig-likes-fixed', '1');
                    btn.style.setProperty('cursor', 'pointer', 'important');
                    btn.title = "View Likes (Redirects to post)";
                    
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const postLink = findPermalink(overlay);
                        if (postLink) {
                            const url = new URL(postLink);
                            const likedByUrl = url.origin + url.pathname.replace(/\/$/, '') + '/liked_by/';
                            fastRedirect(likedByUrl);
                        } else {
                            closeOverlayIfPossible();
                        }
                    }, true);
                }
            }
        });
    }

function buildSearchBanCSS() {
    try {
        const scope = '[role="listbox"]';
        const rules = instagramAccountsToHideLower.map(acc => {
            const p = `${scope} a[href*="/${acc}/"]`;
            return `
/* hide search result for /${acc}/ (scoped to listbox) */
${p}, ${p} * {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  pointer-events: none !important;
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  overflow: hidden !important;
}`;
        }).join('\n');

        return rules;
    } catch { return ''; }
}

    function isSearchSurfacePresent() {
        return !!(
            document.querySelector('form[role="search"]') ||
            document.querySelector('input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"]') ||
            document.querySelector('[role="listbox"]')
        );
    }

    function getSearchRoots() {
        const rootsSet = new Set();
        document.querySelectorAll('[role="listbox"]').forEach(el => rootsSet.add(el));
        document.querySelectorAll('[role="dialog"], section[role="dialog"], div[aria-modal="true"]').forEach(d => {
            if (d.querySelector('form[role="search"], input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"]')) {
                rootsSet.add(d);
            }
        });
        document.querySelectorAll('form[role="search"]').forEach(f => {
            let c = f;
            for (let i = 0; i < 5 && c && c !== document.body && c !== document.documentElement; i++) {
                rootsSet.add(c);
                c = c.parentElement;
            }
        });
        document.querySelectorAll('[aria-label*="Search"], [aria-label*="Haku"], [aria-label*="Hae"]').forEach(el => {
            if (el.querySelector('input, form')) rootsSet.add(el);
        });
        return Array.from(rootsSet);
    }

    function usernameFromHref(rawHref) {
        if (!rawHref) return '';
        try {
            let pathname = '';
            try {
                const u = new URL(rawHref, location.origin);
                pathname = u.pathname || '';
            } catch {
                pathname = (rawHref.split('#')[0].split('?')[0] || '');
            }
            const parts = pathname.split('/').filter(Boolean);
            if (!parts.length) return '';
            const first = parts[0];
            if (
                first === 'explore' ||
                first === 'reels' ||
                first === 'p' ||
                first === 'accounts' ||
                first === 'direct' ||
                first === 'stories' ||
                first === 'ai' ||
                first === 'meta-ai'
            ) {
                return '';
            }
            return first.toLowerCase().replace(/^@+/, '');
        } catch {
            return '';
        }
    }

    function getSearchRowElement(anchor) {
        let row = anchor.closest('[role="option"], li, a[role="link"], a._a6hd, a.x1i10hfl, a');
        if (!row) row = anchor;
        row.setAttribute(IG_SEARCH_ROW_ATTR, '1');
        return row;
    }

    function collectRowTexts(row) {
        const texts = [];
        try {
            const add = (v) => { if (v && typeof v === 'string') { const t = v.trim(); if (t) texts.push(t); } };
            add(row.textContent || '');
            row.querySelectorAll('[alt],[title],[aria-label]').forEach(el => {
                add(el.getAttribute('alt'));
                add(el.getAttribute('title'));
                add(el.getAttribute('aria-label'));
            });
        } catch {}
        return texts;
    }

    function matchesBannedByText(texts) {
        if (!texts || !texts.length) return '';
        for (const raw of texts) {
            const low = raw.toLowerCase();
            if (!allowedWordsLower.some(w => low.includes(w))) {
                for (const rx of keywordsToHide) {
                    try { if (keywordRegexMatches(rx, raw)) return `regex:${String(rx)}`; } catch {}
                }
                for (const rx of keywordsToHide) {
                    try { if (rx.test(raw)) return `regex:${String(rx)}`; } catch {}
                }
            }
        }
        return '';
    }

    function blockRow(row, reason) {
        row.removeAttribute(IG_SEARCH_APPROVE_ATTR);
        row.setAttribute(IG_SEARCH_HIDDEN_ATTR, reason || 'blocked');
        row.style.setProperty('display', 'none', 'important');
        row.style.setProperty('visibility', 'hidden', 'important');
        row.style.setProperty('opacity', '0', 'important');
        row.style.setProperty('height', '0', 'important');
        row.style.setProperty('width', '0', 'important');
        row.style.setProperty('position', 'absolute', 'important');
        row.style.setProperty('left', '-9999px', 'important');
        row.style.setProperty('top', '-9999px', 'important');
        row.style.setProperty('pointer-events', 'none', 'important');
        hiddenElements.add(row);
    }

    function approveRow(row) {
        row.style.removeProperty('display');
        row.style.removeProperty('visibility');
        row.style.removeProperty('opacity');
        row.style.removeProperty('height');
        row.style.removeProperty('width');
        row.style.removeProperty('position');
        row.style.removeProperty('left');
        row.style.removeProperty('top');
        row.style.removeProperty('pointer-events');
        row.removeAttribute(IG_SEARCH_HIDDEN_ATTR);
        row.setAttribute(IG_SEARCH_APPROVE_ATTR, '1');
    }

    function hideInstagramSearchResults() {
        if (!location.hostname.includes('instagram.com')) return;

        const anchorSet = new Set(Array.from(document.querySelectorAll('[role="listbox"] a[href]')));
        const roots = getSearchRoots();
        if (roots.length) {
            roots.forEach(root => {
                root.querySelectorAll('a[href]').forEach(a => anchorSet.add(a));
            });
        }
        if (!anchorSet.size) {
            document.querySelectorAll('a[href]').forEach(a => {
                try {
                    const rect = a.getBoundingClientRect();
                    if (rect && rect.width >= 220 && rect.width <= 480 && rect.left >= 0 && rect.left <= 420 && rect.height >= 44 && rect.height <= 160) {
                        anchorSet.add(a);
                    }
                } catch {}
            });
        }
        if (!anchorSet.size) return;

        anchorSet.forEach(a => {
            try {
                const row = getSearchRowElement(a);
                if (!row) return;
                if (row.getAttribute(IG_SEARCH_APPROVE_ATTR) === '1' || row.hasAttribute(IG_SEARCH_HIDDEN_ATTR)) return;

                const href = a.getAttribute('href') || '';
                let normalizedPath = '';
                try {
                    const u = new URL(href, location.origin);
                    normalizedPath = (u.pathname || '').toLowerCase();
                } catch {
                    normalizedPath = (href.split('?')[0] || '').toLowerCase();
                }

                let decided = false;

                const user = usernameFromHref(href);
                if (user && instagramAccountsSet.has(user)) {
                    blockRow(row, `user:${user}`);
                    decided = true;
                }

                if (!decided) {
                    const immediateTexts = collectRowTexts(row);
                    const immediateReason = matchesBannedByText(immediateTexts);
                    if (immediateReason) {
                        blockRow(row, immediateReason);
                        decided = true;
                    }
                }

                if (!decided) {
                    addRAF(() => {
                        if (row.getAttribute(IG_SEARCH_APPROVE_ATTR) === '1' || row.hasAttribute(IG_SEARCH_HIDDEN_ATTR)) return;
                        const laterTexts = collectRowTexts(row);
                        const laterReason = matchesBannedByText(laterTexts);
                        if (laterReason) {
                            blockRow(row, laterReason);
                        } else {
                            approveRow(row);
                        }
                    });
                }

                if (decided && !row.hasAttribute(IG_SEARCH_HIDDEN_ATTR)) {
                    approveRow(row);
                }
            } catch {}
        });
    }

    function hideMyosMetaltaElements() {
        const metaSvgs = document.querySelectorAll('svg[aria-label*="Myös Metalta"], svg[aria-label*="Also from Meta"]');
        metaSvgs.forEach(svg => {
            try {
                const directTile = svg.closest('div.x9f619.x3nfvp2.xr9ek0c') || svg.closest('div.x9f619.x3nfvp2');
                if (directTile && !isElementProtected(directTile)) {
                    collapseElement(directTile);
                    return;
                }
            } catch {}
            let container = svg;
            let level = 0;
            while (container && level < 10) {
                container = container.parentElement;
                level++;
                if (!container) break;

                if (container.classList.contains('x9f619') && 
                    container.classList.contains('x3nfvp2') && 
                    container.classList.contains('xr9ek0c') &&
                    (container.textContent.includes('Myös Metalta') || container.textContent.includes('Also from Meta'))) {

                    collapseElement(container);
                    break;
                }

                if ((container.textContent.includes('Myös Metalta') || container.textContent.includes('Also from Meta'))) {
                    const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
                    const area = rect ? rect.width * rect.height : 0;
                    if (area > 80 && area < 60000 &&
                        !isElementProtected(container) &&
                        !container.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                        collapseElement(container);
                        break;
                    }
                }
            }
        });

        const allDivs = document.querySelectorAll('div');
        allDivs.forEach(div => {
            if (!div.textContent) return;
            const txt = div.textContent.trim();
            if (txt !== 'Myös Metalta' && txt !== 'Also from Meta') return;

            const strict = div.closest('div.x9f619.x3nfvp2.xr9ek0c');
            if (strict) {
                if (!hiddenElements.has(strict) && !isElementProtected(strict)) {
                    collapseElement(strict);
                }
                return;
            }

            let container = div;
            let level = 0;
            while (container && level < 4) {
                const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
                const area = rect ? rect.width * rect.height : 0;
                if (area > 80 && area < 60000 &&
                    !isElementProtected(container) &&
                    !container.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                    collapseElement(container);
                    break;
                }
                container = container.parentElement;
                level++;
            }
        });
    }

    function hideSettingsPageElements() {
        if (!window.location.pathname.includes('/accounts/') && !window.location.pathname.includes('/settings/')) return;
        const hiddenWordsSelectors = [
            'a[href*="hidden_words"]',
            'a[href*="piiloitetut_sanat"]',
            'a[href*="settings/v2/hidden_words"]',
            'a[href*="accounts/settings/v2/hidden_words"]',
            'a[href*="hide_story_and_live"]',
            'a[href*="/accounts/hide_story_and_live/"]',
            'span:has(a[href*="help.instagram.com/347751748650214"])',
            '[href*="hidden_words"]',
            '[href*="piiloitetut_sanat"]',
            '[href*="hide_story_and_live"]'
        ];
        hiddenWordsSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                let container = element;
                let level = 0;
                while (container && level < 8) {
                    if (container.tagName === 'DIV' && 
                        (container.classList.contains('x9f619') || 
                         container.classList.contains('x1i10hfl') ||
                         container.classList.contains('x1n2onr6'))) {
                        const childCount = container.querySelectorAll('*').length;
                        if (childCount < 50) {
                            container.style.setProperty('display', 'none', 'important');
                            container.style.setProperty('visibility', 'hidden', 'important');
                            container.style.setProperty('opacity', '0', 'important');
                            container.style.setProperty('height', '0', 'important');
                            container.style.setProperty('width', '0', 'important');
                            container.style.setProperty('position', 'absolute', 'important');
                            container.style.setProperty('left', '-9999px', 'important');
                            container.style.setProperty('top', '-9999px', 'important');
                            container.style.setProperty('overflow', 'hidden', 'important');
                            hiddenElements.add(container);
                            break;
                        }
                    }
                    container = container.parentElement;
                    level++;
                }
            });
        });
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (hiddenElements.has(element)) return;
            const text = element.textContent ? element.textContent.trim() : '';
            if (text === 'Piiloitetut sanat' || 
                text === 'Hidden Words' || 
                text === 'Restricted accounts' || 
                text === 'Rajoitetut tilit' ||
                text === 'Piilota tarinat ja livet' ||
                text === 'Hide stories and live' ||
                text === 'Näytä tiliehdotuksia profiileissa' ||
                text === 'Show account suggestions on profiles') {
                let container = element;
                let level = 0;
                while (container && level < 8) {
                    if (container.tagName === 'A' || 
                        container.getAttribute('role') === 'button' ||
                        container.classList.contains('x1i10hfl') ||
                        (container.tagName === 'DIV' && 
                         container.classList.contains('x9f619') &&
                         container.onclick) ||
                        (container.tagName === 'DIV' && container.querySelector('input[role="switch"]'))) {
                        const siblingCount = container.parentElement ? container.parentElement.children.length : 0;
                        const childCount = container.querySelectorAll('*').length;
                        if (siblingCount > 1 && childCount < 100) {
                            container.style.setProperty('display', 'none', 'important');
                            container.style.setProperty('visibility', 'hidden', 'important');
                            container.style.setProperty('opacity', '0', 'important');
                            container.style.setProperty('height', '0', 'important');
                            container.style.setProperty('width', '0', 'important');
                            container.style.setProperty('position', 'absolute', 'important');
                            container.style.setProperty('left', '-9999px', 'important');
                            container.style.setProperty('top', '-9999px', 'important');
                            container.style.setProperty('overflow', 'hidden', 'important');
                            hiddenElements.add(container);
                            break;
                        }
                    }
                    container = container.parentElement;
                    level++;
                }
            }
        });
        const allTextElements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6, a, button');
        allTextElements.forEach(element => {
            if (hiddenElements.has(element)) return;
            const text = element.textContent ? element.textContent.trim() : '';
            if ((text === 'Piiloitetut sanat' || 
                 text === 'Hidden Words' || 
                 text === 'Piilota tarinat ja livet' || 
                 text === 'Hide stories and live' ||
                 text === 'Näytä tiliehdotuksia profiileissa' ||
                 text === 'Show account suggestions on profiles') && 
                element.getBoundingClientRect().width > 0 &&
                element.getBoundingClientRect().height > 0) {
                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('height', '0', 'important');
                element.style.setProperty('width', '0', 'important');
                element.style.setProperty('position', 'absolute', 'important');
                element.style.setProperty('left', '-9999px', 'important');
                element.style.setProperty('top', '-9999px', 'important');
                element.style.setProperty('overflow', 'hidden', 'important');
                hiddenElements.add(element);
                const parent = element.parentElement;
                if (parent && parent.querySelectorAll('*').length < 20) {
                    parent.style.setProperty('display', 'none', 'important');
                    parent.style.setProperty('visibility', 'hidden', 'important');
                    hiddenElements.add(parent);
                }
            }
        });
    }

const IG_SUGGESTED_LABELS_V40 = new Set(['sinulle ehdotettu', 'sinulle ehdotettua', 'suggested for you']);

function isIGSuggestedLabelTextV40(value) {
    try { return IG_SUGGESTED_LABELS_V40.has(String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()); }
    catch { return false; }
}

function findIGSuggestedPeopleModuleV41(labelElement) {
    try {
        let candidate = labelElement.closest('div.html-div') || labelElement.parentElement;
        for (let lvl = 0; candidate && lvl < 10; lvl++, candidate = candidate.parentElement) {
            if (candidate.matches?.('main, section[role="main"], div[role="main"], body, html, nav, footer')) break;
            if (candidate.querySelector?.('article')) break;
            if (isElementProtected(candidate)) continue;

            const txt = String(candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const hasSuggestedLabel = txt.includes('sinulle ehdotettua') || txt.includes('sinulle ehdotettu') || txt.includes('suggested for you');
            if (!hasSuggestedLabel) continue;

            const hasPeopleLink = !!candidate.querySelector?.('a[href^="/explore/people"]');
            const hasPeopleRows = !!candidate.querySelector?.('button, [role="button"], img[alt*="profiilikuva" i], img[alt*="profile picture" i], img[alt*="profile" i]');
            const isKnownPeopleModule = candidate.matches?.('div.x78zum5.xdt5ytf.xdj266r.x14z9mp.xod5an3.x162z183.x1j7kr1c.xvbhtw8');
            if (!hasPeopleLink || (!hasPeopleRows && !isKnownPeopleModule)) continue;

            const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
            const area = rect ? rect.width * rect.height : 0;
            if (!rect || (area > 80 && area < 500000)) return candidate;
        }
    } catch {}
    return null;
}

function hideIGSuggestedContainerFromLabelV40(labelElement) {
    try {
        if (!labelElement || labelElement.nodeType !== 1) return false;
        if (isInPostOverlay(labelElement)) return false;

        const article = labelElement.closest('article');
        if (article) {
            if (isMetaManglerHomeFeedPath() && article.closest('main')) {
                const postID = __bf2760HomeV5GetArticlePostID(article) || getPostIDFromArticle(article) || '';
                if (postID) __bf2760HomeV5Reject(article, postID, true);
                else __bf2760HomeV5ReconcileArticle(article, true);
                return true;
            }
            article.setAttribute('data-banned-scan', 'banned');
            article.setAttribute('data-feed-scan-done', '1');
            safelyHideFeedArticle(article);
            return true;
        }

        if (isMetaManglerHomeFeedPath() && labelElement.closest('main')) return false;

        // Sidebar/account-strip case: collapse the exact Suggested module, never the whole right rail.
        const peopleModule = findIGSuggestedPeopleModuleV41(labelElement);
        if (peopleModule && !isElementProtected(peopleModule)) {
            collapseElement(peopleModule);
            return true;
        }

        // Feed/card fallback for recommended units that are not real <article> nodes.
        // Avoid this path for /explore/people account strips; those are handled above surgically.
        let hasPeopleLinkNearby = false;
        let nearby = labelElement.closest('div.html-div') || labelElement.parentElement;
        for (let lvl = 0; nearby && lvl < 8; lvl++, nearby = nearby.parentElement) {
            if (nearby.matches?.('main, section[role="main"], div[role="main"], body, html, nav, footer')) break;
            if (nearby.querySelector?.('a[href^="/explore/people"]')) { hasPeopleLinkNearby = true; break; }
        }

        if (!hasPeopleLinkNearby) {
            const wrapper = findPostWrapper(labelElement);
            if (wrapper &&
                !isElementProtected(wrapper) &&
                !wrapper.matches('main, section[role="main"], div[role="main"], body, html, nav, footer') &&
                !wrapper.querySelector('article')) {
                collapseElement(wrapper);
                return true;
            }
        }

        let candidate = labelElement.closest('div.html-div') || labelElement.parentElement;
        for (let lvl = 0; candidate && lvl < 8; lvl++, candidate = candidate.parentElement) {
            if (candidate.matches?.('main, section[role="main"], div[role="main"], body, html, nav, footer')) break;
            if (candidate.querySelector?.('article')) break;
            if (candidate.querySelector?.('a[href^="/explore/people"]')) break;
            if (isElementProtected(candidate)) continue;
            const txt = String(candidate.textContent || '').toLowerCase();
            const hasSuggestedShell = txt.includes('sinulle ehdotettua') || txt.includes('sinulle ehdotettu') || txt.includes('suggested for you');
            if (!hasSuggestedShell) continue;
            const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
            const area = rect ? rect.width * rect.height : 0;
            if (!rect || (area > 60 && area < 300000)) {
                collapseElement(candidate);
                return true;
            }
        }

        return false;
    } catch { return false; }
}

function hideAllIGSuggestedLabelsV40(root = document) {
    try {
        if (isMetaManglerHomeFeedPath()) {
            const node = root && root.nodeType === 1 ? root : document.documentElement;
            if (root === document || node?.closest?.('main') || node?.querySelector?.('main')) return;
        }
        const scanRoot = root && root.querySelectorAll ? root : document;
        const nodes = [];
        if (scanRoot.nodeType === 1 && isIGSuggestedLabelTextV40(scanRoot.textContent)) nodes.push(scanRoot);
        scanRoot.querySelectorAll?.('span, div, h2, h3').forEach(el => {
            if (isIGSuggestedLabelTextV40(el.textContent)) nodes.push(el);
        });
        for (let i = 0; i < nodes.length && i < 120; i++) hideIGSuggestedContainerFromLabelV40(nodes[i]);
    } catch {}
}

function isIGAccountEditTargetTextV43(value) {
    try {
        const t = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return t === 'tekoälysisällöntuottaja' ||
               t === 'näytä tiliehdotuksia profiileissa' ||
               t.includes('lisää tämä tunniste profiiliisi, jos sisällössäsi käytetään usein tekoälyä') ||
               t.includes('valitse, näkevätkö ihmiset ehdotuksia samankaltaisista tileistä profiilissasi');
    } catch { return false; }
}

function findIGAccountEditRowV43(element) {
    try {
        if (!element || element.nodeType !== 1) return null;

        let candidate = element.closest?.('div.x1yztbdb') || element.closest?.('div.html-div') || element.parentElement;
        for (let lvl = 0; candidate && lvl < 10; lvl++, candidate = candidate.parentElement) {
            if (candidate.matches?.('main, section[role="main"], div[role="main"], body, html, nav, footer')) break;
            if (candidate.querySelector?.('textarea#pepBio')) break;

            const hasAiSwitch = !!candidate.querySelector?.('input[role="switch"][aria-label="Tekoälysisällöntuottaja"], input[role="switch"][aria-label*="Tekoäly" i]');
            const hasSuggestSwitch = !!candidate.querySelector?.('input[role="switch"][aria-label="Näytä tiliehdotuksia profiileissa"], input[role="switch"][aria-label*="tiliehdotuksia" i]');
            const txt = String(candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

            const looksAi = hasAiSwitch || txt.includes('tekoälysisällöntuottaja') || txt.includes('sisällössäsi käytetään usein tekoälyä');
            const looksSuggest = hasSuggestSwitch || txt.includes('näytä tiliehdotuksia profiileissa') || txt.includes('ehdotuksia samankaltaisista tileistä');

            if (!looksAi && !looksSuggest) continue;

            const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
            const area = rect ? rect.width * rect.height : 0;
            if (!rect || (area > 100 && area < 250000)) return candidate;
        }
    } catch {}
    return null;
}

function hideIGAccountEditSectionsV43(root = document) {
    try {
        updateMetaManglerAccountEditClassV43();
        if (!isMetaManglerAccountEditPathV43()) return;

        const scanRoot = root && root.querySelectorAll ? root : document;
        const nodes = [];
        if (scanRoot.nodeType === 1) {
            if (isIGAccountEditTargetTextV43(scanRoot.textContent || '') ||
                scanRoot.matches?.('input[role="switch"][aria-label="Tekoälysisällöntuottaja"], input[role="switch"][aria-label*="Tekoäly" i], input[role="switch"][aria-label="Näytä tiliehdotuksia profiileissa"], input[role="switch"][aria-label*="tiliehdotuksia" i]')) {
                nodes.push(scanRoot);
            }
        }

        scanRoot.querySelectorAll?.([
            'input[role="switch"][aria-label="Tekoälysisällöntuottaja"]',
            'input[role="switch"][aria-label*="Tekoäly" i]',
            'input[role="switch"][aria-label="Näytä tiliehdotuksia profiileissa"]',
            'input[role="switch"][aria-label*="tiliehdotuksia" i]',
            'span',
            'div'
        ].join(',')).forEach(el => {
            try {
                if (el.matches?.('input[role="switch"]') || isIGAccountEditTargetTextV43(el.textContent || '')) nodes.push(el);
            } catch {}
        });

        const targets = new Set();
        for (let i = 0; i < nodes.length && i < 120; i++) {
            const row = findIGAccountEditRowV43(nodes[i]);
            if (row) targets.add(row);
        }

        targets.forEach(row => {
            try { collapseElement(row); } catch {}
        });
    } catch {}
}


    function hideSinulleEhdotettuaBlock() {
        try {
            if (isMetaManglerHomeFeedPath()) return;
            const spans = document.querySelectorAll('span');
            spans.forEach(span => {
                if (!span.textContent) return;
                const txt = span.textContent.trim();
                if (!isIGSuggestedLabelTextV40(txt)) return;

                if (hideIGSuggestedContainerFromLabelV40(span)) return;

                let container = span.closest('div.html-div') || span.parentElement;
                if (!container) return;

                const scope = container.closest('div') || container;
                const hasShowAllLink =
                    !!scope.querySelector('a[href="/explore/people/"] span') ||
                    !!scope.querySelector('a[href^="/explore/people"]');

                if (!hasShowAllLink) return;

                let lvl = 0;
                let candidate = container;
                while (candidate && lvl < 6) {
                    const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
                    const area = rect ? rect.width * rect.height : 0;

                    const plausibleSize = area > 200 && area < 300000;
                    const isHtmlDiv = candidate.classList.contains('html-div');

                    if (isHtmlDiv &&
                        plausibleSize &&
                        !isElementProtected(candidate) && 
                        !candidate.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                        if (candidate.querySelector('article')) break;

                        collapseElement(candidate);
                        return;
                    }

                    candidate = candidate.parentElement;
                    lvl++;
                }

                const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
                const area = rect ? rect.width * rect.height : 0;
                if (area > 80 && area < 150000 &&
                    !isElementProtected(container) &&
                    !container.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                    collapseElement(container);
                }
            });
        } catch {}
    }

const injectInlineCSS = () => {
    try {
        const styleId = 'extra-redirect-style';
        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
        }
        const searchBanCSS = buildSearchBanCSS();

        const articleProtectionCSS = `
        /* Dialog articles retain their hide-until-scanned protection.
           Homepage feed articles are governed exclusively by the scoped
           html.metamangler-feed-gate rules above; keeping a second global
           article gate here can strand a React-replaced feed item invisible. */
        div[role="dialog"] article:not([data-banned-scan]),
        section[role="dialog"] article:not([data-banned-scan]) {
            opacity: 0 !important;
            pointer-events: none !important;
            transition: opacity 0.1s ease-in !important;
        }
        div[role="dialog"] article[data-banned-scan="safe"],
        section[role="dialog"] article[data-banned-scan="safe"] {
            opacity: 1 !important;
            pointer-events: auto !important;
        }
        div[role="dialog"] article[data-banned-scan="banned"],
        section[role="dialog"] article[data-banned-scan="banned"] {
            height: 1px !important;
            min-height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            border: none !important;
            pointer-events: none !important;
            visibility: hidden !important;
        }
        `;

        const approveGateCSS = `
[role="listbox"] [role="option"]:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] li:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] a[role="link"]:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] a._a6hd:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] a.x1i10hfl:not([${IG_SEARCH_APPROVE_ATTR}="1"]) {
display: none !important;
visibility: hidden !important;
opacity: 0 !important;
pointer-events: none !important;
position: absolute !important;
left: -9999px !important;
top: -9999px !important;
height: 0 !important;
width: 0 !important;
overflow: hidden !important;
}
[role="listbox"] [${IG_SEARCH_APPROVE_ATTR}="1"] {
visibility: visible !important;
opacity: 1 !important;
pointer-events: auto !important;
position: static !important;
height: auto !important;
width: auto !important;
overflow: visible !important;
}
`;

        const safeSuffix = `:not(:has(nav)):not(:has(footer)):not(:has(svg[aria-label="Lisää"])):not(:has(svg[aria-label="Asetukset"])):not(:has(svg[aria-label="More"])):not(:has(a[href*="about.instagram.com"])):not(:has(article)):not(:has(a[href*="instagram.com/direct"]))`;
        const overlayGuardedSelectors = selectorsToHide.map(s => `html:not(.ig-overlay-open) ${s}${safeSuffix}`).join(',\n');

        style.textContent = `
        ${articleProtectionCSS}

        ${overlayGuardedSelectors} {
            visibility: hidden !important;
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            height: 0 !important;
            width: 0 !important;
            max-height: 0 !important;
            max-width: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            flex: 0 0 0px !important;
            grid: none !important;
            transition: none !important;
        }
        [href*="hidden_words"], [href*="piiloitetut_sanat"], [href*="restricted_accounts"], [href*="rajoitetut_tilit"], [href*="hide_story_and_live"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            overflow: hidden !important;
        }

        /* === CSS SLEDGEHAMMER FOR "POISTA SEURAAJA" MENUS === */
        html:not(.safe-story-zone) [role="dialog"] button.xjbqb8w.x1qhh985.x10w94by.x14e42zd.x1yvgwvq.x13fuv20.x178xt8z.x1ypdohk.xvs91rp.x1evy7pa.xdj266r.x14z9mp.xat24cr.x1lziwak.x1wxaq2x.x1iorvi4.xf159sx.xjkvuk6.xmzvs34.x2b8uid.x87ps6o.xxymvpz.xh8yej3.x52vrxo.x4gyw5p.xkmlbd1.x1xlr1w8 {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
        }

        /* 1. PUSH THE RIGHT SIDEBAR PROFILE DOWN & KILL THE GHOST GAP */
        div[style*="--x-width: 100%;"]:has(a[role="link"]),
        div[style*="--x-width:100%"]:has(a[role="link"]) {
            margin-top: 26px !important; 
            gap: 0px !important; 
            transition: none !important;
        }

        /* 2. PUSH THE FOOTER UP */
        div:has(> nav ul li a[href*="about.instagram.com"]) {
            margin-top: -20px !important; 
            padding-top: 0px !important;
            gap: 0px !important;
            transition: none !important;
        }

        /* INSTANTLY HIDE ONLY THE SUGGESTED PEOPLE MODULE, NOT THE WHOLE RIGHT SIDEBAR */
        html.metamangler-feed-gate main div.x78zum5.xdt5ytf.xdj266r.x14z9mp.xod5an3.x162z183.x1j7kr1c.xvbhtw8:has(a[href^="/explore/people"]) {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
        }

        /* ADJUST STORIES TRAY PLACEMENT */
        div[data-pagelet="story_tray"] {
            margin-top: -16px !important; 
        }

        /* Keep the whole tray paint-hidden until the first account-classification /
           compaction commit has completed. Layout is preserved, so the reveal itself
           does not make Instagram recalculate the carousel geometry. */
        div[data-pagelet="story_tray"]:not([data-ig-story-tray-ready]) {
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            transition: none !important;
            animation: none !important;
        }

        /* Newly-created story slots are paint-gated individually until Instagram
           has populated the accessible username. IMPORTANT: keep their geometry while
           pending/staged so a banned tile cannot create a visible hole before the
           transform compaction is committed in the same observer turn. */
        div[data-pagelet="story_tray"] li[data-ig-story-pending],
        div[data-pagelet="story_tray"] [data-ig-story-pending],
        div[data-pagelet="story_tray"] li[data-ig-story-ban-staging],
        div[data-pagelet="story_tray"] [data-ig-story-ban-staging] {
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            transition: none !important;
            animation: none !important;
        }

        /* Persistent story-account hiding. This geometry collapse is applied only
           after the later story transforms have already been compacted in JS. */
        div[data-pagelet="story_tray"] li[data-ig-story-account-banned],
        div[data-pagelet="story_tray"] [data-ig-story-account-banned] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            width: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            flex: 0 0 0 !important;
            overflow: hidden !important;
            transition: none !important;
            transform-origin: left center !important;
        }

        /* Persistent followed/following-row hiding. */
        [data-ig-account-list-banned] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            width: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
        }

        ${searchBanCSS}
        ${approveGateCSS}
        `;
        
        if (!style.isConnected) {
            if (document.head) {
                document.head.appendChild(style);
            } else if (document.documentElement) {
                document.documentElement.insertBefore(style, document.documentElement.firstChild);
            }
        }
    } catch (err) {
        try {
            const styleTag = document.createElement('style');
            styleTag.textContent = `${selectorsToHide.slice(0, 10).join(', ')} { display: none !important; }`;
            (document.head || document.documentElement).appendChild(styleTag);
        } catch (e) {}
    }
};

injectInlineCSS();

    const hideCriticalElements = () => {
        // Home Feed is virtualized and React-owned. Do not run the broad selector
        // sweep here; several legacy selectors can match live feed controls/cards.
        if (!isMetaManglerHomeFeedPath()) {
            selectorsToHide.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => {
                    if (isInPostOverlay(el)) return;
                    if (!hiddenElements.has(el)) {
                        el.style.setProperty('visibility', 'hidden', 'important');
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        hiddenElements.add(el);
                    }
                });
            });
        }
        if (isMetaManglerHomeFeedPath()) {
            try { __bf2760HomeV5EnsureObserver(); } catch {}
        } else {
            processFeedPostsForScanning();
            hideSinulleEhdotettuaBlock();
            hideAllIGSuggestedLabelsV40();
        }
        hideMyosMetaltaElements();
        hideSettingsPageElements();
        hideUnwantedUIButtons();
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    };
    hideCriticalElements();
    updateOverlayState();
    scanPermalinkArticleAndAct();

    function checkForRedirectElements() {
        if (!location.hostname.includes('instagram.com')) return;
        const allSelectors = selectorsToMonitorAndRedirect.join(',');
        const foundElements = document.querySelectorAll(allSelectors);
        if (foundElements.length > 0) {
            fastRedirect('https://www.instagram.com');
        }
    }

    function isReelsPage() {
        return location.pathname.includes('/reels/') || location.pathname.startsWith('/reels');
    }

    function injectReelsCSS() {
        if (!isReelsPage()) return;
        if (reelsStyleInjected && document.getElementById('reels-navigation-hider')) return;
        
        const css = `
            a[href="/ai/"],
            a[href="/meta-ai/"],
            a[aria-label*="Meta AI"],
            *[aria-label="Meta AI"],
            [data-testid*="meta-ai"],
            [data-testid*="metaai"],
            [aria-label*="Myös Metalta"],
            [title*="Myös Metalta"],
            svg[aria-label*="Myös Metalta"],
            nav div[role="button"][tabindex][aria-label="Tutki"],
            [role="navigation"] div[role="button"][tabindex][aria-label="Tutki"],
            nav svg[aria-label="Tutki"],
            [role="navigation"] svg[aria-label="Tutki"],
            nav div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"],
            [role="navigation"] div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"],
            nav a[href="/explore/"],
            [role="navigation"] a[href="/explore/"],
	    nav span:has(a[href*="help.instagram.com/347751748650214"]),
            nav div[role="button"][tabindex][aria-label="Threads"],
            [role="navigation"] div[role="button"][tabindex][aria-label="Threads"],
            nav svg[aria-label="Threads"],
            [role="navigation"] svg[aria-label="Threads"],
            nav a.x1i10hfl[href*="threads"],
            [role="navigation"] a.x1i10hfl[href*="threads"],
            nav a[href*="/threads"],
            [role="navigation"] a[href*="/threads"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                max-height: 0 !important;
                max-width: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
            }
        `;
        
        let style = document.getElementById('reels-navigation-hider');
        if (!style) {
            style = document.createElement('style');
            style.id = 'reels-navigation-hider';
        }
        style.textContent = css;
        
        if (document.head) {
            if (!style.isConnected) document.head.appendChild(style);
        } else {
            onEvent(document, 'DOMContentLoaded', () => {
                if (!style.isConnected) document.head.appendChild(style);
            }, false);
        }
        
        reelsStyleInjected = true;
    }

    function igBlankOutPage() {
        try {
            let s = document.getElementById('ig-blank-style');
            if (!s) {
                s = document.createElement('style');
                s.id = 'ig-blank-style';
                s.textContent = `
                    html, body { background = '#fff !important; }
                    body > * { display: none !important; visibility: hidden !important; }
                `;
                (document.head || document.documentElement).appendChild(s);
            }
            document.documentElement.style.background = '#fff';
            if (document.body) document.body.style.background = '#fff';
        } catch {}
    }

    function fastRedirect(target) {
        if (__isRedirectingFast) return;
        __isRedirectingFast = true;
        try { if (typeof window.stop === "function") window.stop(); } catch(e){}
        igBlankOutPage();
        try { window.location.replace(target); return; } catch(e){}
        try { window.location.assign(target); return; } catch(e){}
        try { window.location.href = target; } catch(e){}
    }

    function shouldInstagramRedirect() {
        const url = window.location.href;
        for (let i = 0; i < instagramBannedPaths.length; ++i) {
            if (url.includes(instagramBannedPaths[i])) return true;
        }
        try {
            const urlObj = new URL(url);
            const parts = urlObj.pathname.split('/').filter(Boolean);
            if (parts.length > 0) {
                const username = parts[0].toLowerCase();
                const RESERVED = new Set(['p','reel','tv','explore','reels','accounts','stories','direct','meta-ai','ai', 'about', 'help', 'legal', 'archive']);
                if (!RESERVED.has(username)) {
                    if (instagramAccountsSet.has(username)) return true;
                    if (dynamicWrestlingSlugs.some(slug => username === slug || username.includes(slug.replace(/-/g, '')))) return true;
                }
            }
        } catch(e){}
        return false;
    }

    if (
        window.location.hostname === "www.instagram.com" &&
        shouldInstagramRedirect()
    ) {
        fastRedirect("https://www.instagram.com");
        return;
    }

    if (isReelsPage()) {
        injectReelsCSS();
    }

    // ===== v48: targeted story-slot paint gate =====
    // Home-page story tray scope predicate used by the lightweight story-slot observer.
    // V6H gates only the tray's paint during its first classification/compaction commit;
    // this predicate tells the observer when that Story-only protection may operate.
    function isMetaManglerStoryTrayPathV45() {
        try {
            if (!location.hostname.includes('instagram.com')) return false;
            const path = location.pathname || '/';
            return (path === '/' || path === '') && !isReelsPage();
        } catch {
            return false;
        }
    }

    // After the initial atomic tray reveal, only individual <li> slots are paint-hidden
    // while their username is classified. Their geometry stays intact until any banned
    // slot and the later translateX positions can be committed together before paint.
    // ===== Story tray account hider =====
    // Hide story tiles when the account username is explicitly listed in
    // instagramAccountsToHide or matches one of keywordsToHide.
    // Important: only the username is tested here, not the whole story tile
    // text, so unrelated UI text cannot accidentally ban the story.
    const IG_STORY_BAN_MARKER = 'data-ig-story-account-banned';
    const IG_STORY_PENDING_MARKER = 'data-ig-story-pending';
    const IG_STORY_BAN_STAGING_MARKER = 'data-ig-story-ban-staging';
    const IG_STORY_TRAY_READY_MARKER = 'data-ig-story-tray-ready';
    let __igStoryTrayObserver = null;
    let __igStoryTrayObservedNode = null;

    function normalizeInstagramStoryUsername(value = '') {
        try {
            return String(value || '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/^@+/, '')
                .trim()
                .toLowerCase();
        } catch {
            return '';
        }
    }

    function extractInstagramStoryUsername(story) {
        try {
            if (!story || story.nodeType !== 1) return '';

            // Best source: Instagram's accessible story label.
            const aria = story.getAttribute('aria-label') || '';
            let match = aria.match(/(?:käyttäjän|user(?:name)?)[\s:]+(.+?)(?:\s+tarina(?:,|\s|$)|[\s']+story(?:,|\s|$))/i);
            if (match && match[1]) {
                const username = normalizeInstagramStoryUsername(match[1]);
                if (username) return username;
            }

            // Second source: profile-picture alt text.
            const img = story.querySelector('img[alt]');
            if (img) {
                const alt = img.getAttribute('alt') || '';
                match = alt.match(/(?:käyttäjän|user(?:name)?)[\s:]+(.+?)(?:\s+profiilikuva|[\s']+profile(?:\s+picture|\s+photo))/i);
                if (match && match[1]) {
                    const username = normalizeInstagramStoryUsername(match[1]);
                    if (username) return username;
                }
            }

            // Final fallback: a story tile normally contains a short username
            // label under the avatar. Avoid using the whole tile text.
            const usernameNode = story.querySelector('span[dir="auto"] span[dir="auto"]');
            if (usernameNode) {
                const username = normalizeInstagramStoryUsername(usernameNode.textContent);
                if (username && !/[\s]/.test(username)) return username;
            }
        } catch {}
        return '';
    }

    function isInstagramStoryUsernameBanned(username) {
        const value = normalizeInstagramStoryUsername(username);
        if (!value) return false;

        // Exact account match.
        if (instagramAccountsSet.has(value)) return true;

        // Username-only regex match. Reset lastIndex for safety in case a
        // future regex is changed to use the global/sticky flags.
        for (const rx of keywordsToHide) {
            try {
                if (rx.global || rx.sticky) rx.lastIndex = 0;
                if (rx.test(value)) return true;
                if (rx.global || rx.sticky) rx.lastIndex = 0;
            } catch {}
        }

        return false;
    }


    // ===== Story tray no-glimpse CSS =====
    // Instagram can paint the story tray before the scheduled JS cleanup pass gets a
    // chance to inspect the new <li>. Build paint-time selectors directly from the
    // explicit banned-account list so those story tiles never get a visible frame.
    // The existing JS story scanner still runs afterwards to cover localization/DOM
    // variants and to mark items for carousel re-compaction.
    function injectInstagramStoryBanNoGlimpseCSS() {
        try {
            const id = 'metamangler-story-ban-no-glimpse';
            let style = document.getElementById(id);
            if (!style) {
                style = document.createElement('style');
                style.id = id;
            }

            const selectors = [];
            const addAccountSelectors = (username) => {
                const value = String(username || '').trim().toLowerCase();
                if (!value) return;
                // These usernames originate from our own static account list, but keep
                // the CSS string escaping defensive in case punctuation is added later.
                const safe = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                selectors.push(
                    `div[data-pagelet="story_tray"] li:has(> div[role="button"][aria-label*="Käyttäjän ${safe} " i])`,
                    `div[data-pagelet="story_tray"] li:has(> div[role="button"][aria-label*="User ${safe} " i])`,
                    `div[data-pagelet="story_tray"] div[role="button"][aria-label*="Käyttäjän ${safe} " i]`,
                    `div[data-pagelet="story_tray"] div[role="button"][aria-label*="User ${safe} " i]`
                );
            };

            // The explicit account list is the safe paint-time source. Regex bans remain
            // JS-only because arbitrary regular expressions cannot be represented safely
            // as CSS selectors.
            for (const username of instagramAccountsToHideLower) {
                addAccountSelectors(username);
            }

            style.textContent = `
                /* Paint-time story ban: suppress the banned account visually but keep
                   its slot geometry until the observer can compact the later translateX
                   positions and collapse the slot atomically before the next paint. */
                ${selectors.join(',\n                ')} {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    transition: none !important;
                    animation: none !important;
                }
            `;

            const parent = document.head || document.documentElement;
            if (parent && !style.isConnected) parent.appendChild(style);
        } catch {}
    }

    injectInstagramStoryBanNoGlimpseCSS();


    // ===== v46: individual late-story paint gate =====
    // The tray is not the only thing Instagram mutates. Even after the tray has
    // been revealed, React can append/re-hydrate new <li> story slots later.
    // Every slot therefore starts as "pending" and stays paint-hidden until its
    // accessible username exists and the account ban decision has completed.
    function getInstagramStoryTrayV46() {
        try {
            if (!isMetaManglerStoryTrayPathV45()) return null;
            return document.querySelector('div[data-pagelet="story_tray"]');
        } catch {
            return null;
        }
    }

    function markInstagramStoryItemPendingV46(item) {
        try {
            if (!item || item.nodeType !== 1 || item.tagName !== 'LI') return false;
            if (item.hasAttribute(IG_STORY_BAN_MARKER) || item.hasAttribute(IG_STORY_BAN_STAGING_MARKER)) {
                item.removeAttribute(IG_STORY_PENDING_MARKER);
                return false;
            }
            if (!item.hasAttribute(IG_STORY_PENDING_MARKER)) {
                item.setAttribute(IG_STORY_PENDING_MARKER, 'true');
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    function classifyInstagramStoryItemV46(item) {
        try {
            if (!item || item.nodeType !== 1 || item.tagName !== 'LI') return false;
            if (item.hasAttribute(IG_STORY_BAN_MARKER) || item.hasAttribute(IG_STORY_BAN_STAGING_MARKER)) {
                item.removeAttribute(IG_STORY_PENDING_MARKER);
                return true;
            }

            const story = item.querySelector(
                'div[role="button"][aria-label*="tarina" i], ' +
                'div[role="button"][aria-label*="story" i]'
            );
            if (!story) return false;

            const username = extractInstagramStoryUsername(story);
            if (!username) return false;

            if (isInstagramStoryUsernameBanned(username)) {
                item.setAttribute(IG_STORY_BAN_STAGING_MARKER, username);
                story.setAttribute(IG_STORY_BAN_STAGING_MARKER, username);
                item.removeAttribute(IG_STORY_PENDING_MARKER);
                return true;
            }

            // Legitimate account: now that it has been positively classified,
            // allow the story slot to enter the already-visible tray.
            item.removeAttribute(IG_STORY_PENDING_MARKER);
            return true;
        } catch {
            return false;
        }
    }

    function prepareInstagramStorySlotsV46(root = document) {
        try {
            const tray = getInstagramStoryTrayV46();
            if (!tray) return 0;

            const items = Array.from(tray.querySelectorAll(':scope > li'));
            let resolved = 0;

            for (const item of items) {
                markInstagramStoryItemPendingV46(item);
            }

            for (const item of items) {
                if (classifyInstagramStoryItemV46(item)) resolved++;
            }

            compactBannedInstagramStorySlots();
            tray.setAttribute(IG_STORY_TRAY_READY_MARKER, 'true');
            return resolved;
        } catch {
            return 0;
        }
    }

    function getInstagramStoryItemFromNodeV48(node, tray) {
        try {
            if (!node || node.nodeType !== 1) return null;
            if (node.tagName === 'LI' && node.parentElement === tray) return node;
            const item = node.closest?.('li');
            return item && item.parentElement === tray ? item : null;
        } catch {
            return null;
        }
    }

    function collectInstagramStoryItemsFromMutationV48(mutation, tray, candidates) {
        try {
            if (mutation.type === 'attributes') {
                const item = getInstagramStoryItemFromNodeV48(mutation.target, tray);
                if (item) candidates.add(item);
                return;
            }

            if (mutation.type !== 'childList') return;

            const targetItem = getInstagramStoryItemFromNodeV48(mutation.target, tray);
            if (targetItem) candidates.add(targetItem);

            for (const node of mutation.addedNodes || []) {
                if (!node || node.nodeType !== 1) continue;
                const directItem = getInstagramStoryItemFromNodeV48(node, tray);
                if (directItem) candidates.add(directItem);

                if (node.matches?.('li')) {
                    if (node.parentElement === tray) candidates.add(node);
                    continue;
                }

                if (typeof node.querySelectorAll === 'function') {
                    for (const item of node.querySelectorAll('li')) {
                        if (item.parentElement === tray) candidates.add(item);
                    }
                }
            }
        } catch {}
    }

    function processInstagramStoryMutationV48(mutations, tray) {
        try {
            const candidates = new Set();
            for (const mutation of mutations) {
                collectInstagramStoryItemsFromMutationV48(mutation, tray, candidates);
            }

            if (!candidates.size) return;

            let bannedChanged = false;
            for (const item of candidates) {
                if (!item?.isConnected || item.parentElement !== tray) continue;
                if (!item.hasAttribute(IG_STORY_BAN_MARKER) && !item.hasAttribute(IG_STORY_BAN_STAGING_MARKER)) {
                    markInstagramStoryItemPendingV46(item);
                }

                const hadBanMarker = item.hasAttribute(IG_STORY_BAN_MARKER) || item.hasAttribute(IG_STORY_BAN_STAGING_MARKER);
                classifyInstagramStoryItemV46(item);
                if (!hadBanMarker && item.hasAttribute(IG_STORY_BAN_STAGING_MARKER)) {
                    bannedChanged = true;
                }
            }

            if (bannedChanged) compactBannedInstagramStorySlots();
        } catch {}
    }

    function ensureInstagramStoryTrayObserverV48() {
        try {
            const tray = getInstagramStoryTrayV46();

            if (!tray) {
                if (__igStoryTrayObserver) {
                    try { __igStoryTrayObserver.disconnect(); } catch {}
                }
                __igStoryTrayObserver = null;
                __igStoryTrayObservedNode = null;
                return;
            }

            if (__igStoryTrayObservedNode === tray && __igStoryTrayObserver) return;

            if (__igStoryTrayObserver) {
                try { __igStoryTrayObserver.disconnect(); } catch {}
            }

            __igStoryTrayObserver = trackObserver(new MutationObserver(mutations => {
                if (document.hidden) return;
                processInstagramStoryMutationV48(mutations, tray);
            }));

            __igStoryTrayObserver.observe(tray, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['aria-label']
            });

            __igStoryTrayObservedNode = tray;

            // One initial pass is enough. After that, only mutation-affected <li>s are
            // classified, preventing the story observer from repeatedly walking the entire
            // tray while Instagram hydrates the rest of the homepage.
            prepareInstagramStorySlotsV46(tray);
            tray.setAttribute(IG_STORY_TRAY_READY_MARKER, 'true');
        } catch {}
    }

    // Instagram's story carousel virtualizes/positions its <li> items with
    // explicit translateX() values. display:none removes the banned item itself,
    // but the later items can retain their old translated positions, leaving a
    // visual hole. Re-compact those positions based on the original X values.
    function compactBannedInstagramStorySlots() {
        try {
            if (!location.hostname.includes('instagram.com')) return 0;
            if (isReelsPage()) return 0;

            const tray = document.querySelector('div[data-pagelet="story_tray"]');
            if (!tray) return 0;

            const items = Array.from(tray.querySelectorAll('li'));
            if (!items.length) return 0;

            const finalizeStagedItems = (entries = null) => {
                try {
                    const stagedItems = entries
                        ? entries.map(entry => entry.item).filter(Boolean)
                        : items.filter(item => item.hasAttribute(IG_STORY_BAN_STAGING_MARKER));
                    for (const item of stagedItems) {
                        if (!item.hasAttribute(IG_STORY_BAN_STAGING_MARKER)) continue;
                        const username = item.getAttribute(IG_STORY_BAN_STAGING_MARKER) || 'true';
                        item.setAttribute(IG_STORY_BAN_MARKER, username);
                        item.removeAttribute(IG_STORY_BAN_STAGING_MARKER);
                        item.removeAttribute(IG_STORY_PENDING_MARKER);
                        for (const story of item.querySelectorAll(`[${IG_STORY_BAN_STAGING_MARKER}]`)) {
                            story.setAttribute(IG_STORY_BAN_MARKER, username);
                            story.removeAttribute(IG_STORY_BAN_STAGING_MARKER);
                        }
                    }
                } catch {}
            };

            const parsed = [];
            for (const item of items) {
                if (!item || item.nodeType !== 1) continue;

                const current = item.style.transform || '';
                const lastApplied = item.getAttribute('data-ig-story-last-transform');

                // If Instagram has changed the transform since our last pass,
                // treat that as the new source position instead of fighting it.
                if (lastApplied !== null && current !== lastApplied) {
                    item.setAttribute('data-ig-story-original-transform', current);
                    item.removeAttribute('data-ig-story-last-transform');
                }

                let original = item.getAttribute('data-ig-story-original-transform');
                if (original === null) {
                    original = current;
                    item.setAttribute('data-ig-story-original-transform', original);
                }

                const match = original.match(/translateX\(\s*(-?\d+(?:\.\d+)?)px\s*\)/i);
                if (!match) continue;

                parsed.push({
                    item,
                    x: parseFloat(match[1]),
                    original
                });
            }

            if (parsed.length < 2) {
                finalizeStagedItems();
                return 0;
            }

            // Restore the original inline transforms before calculating the
            // compacted positions for this pass.
            for (const entry of parsed) {
                entry.item.style.setProperty('transform', entry.original, 'important');
                entry.item.removeAttribute('data-ig-story-last-transform');
            }

            const hidden = parsed
                .filter(entry => entry.item.hasAttribute(IG_STORY_BAN_MARKER) || entry.item.hasAttribute(IG_STORY_BAN_STAGING_MARKER))
                .sort((a, b) => a.x - b.x);

            if (!hidden.length) return 0;

            // Infer the carousel slot spacing from the smallest positive
            // translateX gap. This avoids hard-coding Instagram's current
            // avatar width/gap.
            const uniqueX = [...new Set(parsed.map(entry => entry.x))].sort((a, b) => a - b);
            let slotStep = 0;
            for (let i = 1; i < uniqueX.length; i++) {
                const diff = uniqueX[i] - uniqueX[i - 1];
                if (diff > 0 && (slotStep === 0 || diff < slotStep)) slotStep = diff;
            }
            if (!slotStep) {
                finalizeStagedItems(hidden);
                return 0;
            }

            let adjusted = 0;

            for (const entry of parsed) {
                if (entry.item.hasAttribute(IG_STORY_BAN_MARKER) || entry.item.hasAttribute(IG_STORY_BAN_STAGING_MARKER)) {
                    entry.item.setAttribute('data-ig-story-last-transform', entry.original);
                    continue;
                }

                const hiddenBefore = hidden.reduce((count, banned) => {
                    return count + (banned.x < entry.x ? 1 : 0);
                }, 0);

                if (!hiddenBefore) {
                    entry.item.setAttribute('data-ig-story-last-transform', entry.original);
                    continue;
                }

                const delta = hiddenBefore * slotStep;
                const compacted = entry.original.replace(
                    /translateX\(\s*(-?\d+(?:\.\d+)?)px\s*\)/i,
                    (_, value) => `translateX(${parseFloat(value) - delta}px)`
                );

                entry.item.style.setProperty('transform', compacted, 'important');
                entry.item.setAttribute('data-ig-story-last-transform', compacted);
                adjusted++;
            }

            // Finalize staged bans only after every visible item's compacted transform
            // has been written. MutationObserver callbacks run before the next paint, so
            // the user sees the already-compacted tray rather than a temporary hole.
            finalizeStagedItems(hidden);

            return adjusted;
        } catch {
            return 0;
        }
    }

    function hideBannedInstagramStoryAccounts(root = document) {
        try {
            if (!location.hostname.includes('instagram.com')) return 0;
            if (isReelsPage()) return 0;

            const scope = root && root.nodeType === 1 ? root : document;
            const selector = 'div[data-pagelet="story_tray"] div[role="button"][aria-label*="tarina" i], div[data-pagelet="story_tray"] div[role="button"][aria-label*="story" i]';
            const stories = [];

            const addStory = (el) => {
                if (el && el.nodeType === 1 && !stories.includes(el)) stories.push(el);
            };

            if (scope.matches?.(selector)) addStory(scope);
            scope.querySelectorAll?.(selector).forEach(addStory);

            let hidden = 0;
            for (const story of stories) {
                if (story.hasAttribute(IG_STORY_BAN_MARKER) || story.hasAttribute(IG_STORY_BAN_STAGING_MARKER)) continue;

                const username = extractInstagramStoryUsername(story);
                if (!username) continue;

                if (isInstagramStoryUsernameBanned(username)) {
                    // Stage first. compactBannedInstagramStorySlots() shifts later tiles
                    // before converting this into the geometry-collapsing final marker.
                    const layoutItem = story.closest('li') || story;
                    layoutItem.setAttribute(IG_STORY_BAN_STAGING_MARKER, username);
                    story.setAttribute(IG_STORY_BAN_STAGING_MARKER, username);
                    layoutItem.removeAttribute(IG_STORY_PENDING_MARKER);
                    hidden++;
                }
            }

            if (hidden) compactBannedInstagramStorySlots();
            return hidden;
        } catch {
            return 0;
        }
    }

    function isHomeFeedArticleContext(element) {
        try {
            if (!isMetaManglerHomeFeedPath() || !element || element.nodeType !== 1) return false;
            return !!(element.matches?.('article') || element.closest?.('article'));
        } catch {
            return false;
        }
    }

    function collapseElement(element) {
        if (isHomeFeedArticleContext(element)) return;
        if (!hiddenElements.has(element)) {
            if (isElementProtected(element)) return;

            stripImagesWithin(element);
            
            const isArticle = element.tagName === 'ARTICLE';
            
            if (isArticle) {
                element.style.setProperty('max-height', '1px', 'important');
                element.style.setProperty('height', '1px', 'important');
                element.style.setProperty('min-height', '1px', 'important');
                element.style.setProperty('margin', '0', 'important'); 
                element.style.setProperty('overflow', 'hidden', 'important');
                element.style.setProperty('padding', '0', 'important');
                element.style.setProperty('border', 'none', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('pointer-events', 'none', 'important');
                Array.from(element.children).forEach(child => {
                    child.style.setProperty('display', 'none', 'important');
                });
            } else {
                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('position', 'absolute', 'important');
                element.style.setProperty('height', '0', 'important');
                element.style.setProperty('width', '0', 'important');
                element.style.setProperty('pointer-events', 'none', 'important');
            }
            
            hiddenElements.add(element);
        }
    }

    function isInstagramProfilePathForThreadsTag() {
        try {
            if (!location.hostname.includes('instagram.com')) return false;
            const parts = (location.pathname || '/').split('/').filter(Boolean);
            if (parts.length !== 1) return false;
            const username = (parts[0] || '').toLowerCase();
            const reserved = new Set(['p', 'reel', 'tv', 'explore', 'reels', 'accounts', 'stories', 'direct', 'meta-ai', 'ai', 'about', 'help', 'legal', 'archive']);
            return !!username && !reserved.has(username);
        } catch { return false; }
    }

    function isThreadsProfileAnchor(anchor) {
        try {
            if (!anchor || !anchor.href) return false;
            const url = new URL(anchor.href, location.href);
            const host = url.hostname.replace(/^www\./i, '').toLowerCase();
            return (host === 'threads.com' || host === 'threads.net') && /^\/@[^/]+/i.test(url.pathname || '');
        } catch { return false; }
    }

    function getProfileThreadsTagHideTarget(anchor) {
        try {
            const widthWrapper = anchor.closest('div[style*="--x-width: 100%;"], div[style*="--x-width:100%"]');
            if (
                widthWrapper &&
                !widthWrapper.closest('nav, [role="navigation"], article, [role="dialog"], [aria-modal="true"]') &&
                !isElementProtected(widthWrapper) &&
                widthWrapper.querySelectorAll('a[target="_blank"][href*="threads.com/@"], a[target="_blank"][href*="threads.net/@"]').length === 1
            ) {
                return widthWrapper;
            }

            const directParent = anchor.parentElement;
            if (
                directParent &&
                directParent.children.length === 1 &&
                !directParent.matches('main, header, section, article, nav, body, html') &&
                !directParent.closest('nav, [role="navigation"], article, [role="dialog"], [aria-modal="true"]') &&
                !isElementProtected(directParent)
            ) {
                return directParent;
            }
        } catch {}
        return anchor;
    }

    function hideProfileThreadsTags(root = document) {
        try {
            if (!isInstagramProfilePathForThreadsTag()) return;
            const scope = root && root.querySelectorAll ? root : document;
            const links = scope.querySelectorAll([
                'a[target="_blank"][href*="threads.com/@"]',
                'a[target="_blank"][href*="threads.net/@"]',
                'a[target="_blank"][href*="www.threads.com/@"]',
                'a[target="_blank"][href*="www.threads.net/@"]'
            ].join(','));

            links.forEach(anchor => {
                try {
                    if (!isThreadsProfileAnchor(anchor)) return;
                    if (anchor.closest('nav, [role="navigation"], article, [role="dialog"], [aria-modal="true"]')) return;

                    const hasThreadsIcon = !!anchor.querySelector('svg[aria-label="Threads"], title');
                    if (!hasThreadsIcon) return;

                    const target = getProfileThreadsTagHideTarget(anchor);
                    if (target && !hiddenElements.has(target)) {
                        collapseElement(target);
                    }
                } catch {}
            });
        } catch {}
    }

    function querySelectorAllWithContains(selector, containsText) {
        const elements = document.querySelectorAll(selector);
        const matchingElements = [];
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].textContent && elements[i].textContent.trim() === containsText) {
                matchingElements.push(elements[i]);
            }
        }
        return matchingElements;
    }

    function collapseElementsBySelectors(selectors) {
        if (isReelsPage()) return;
        if (isMetaManglerHomeFeedPath()) return;
        if (isPostOverlayOpen()) return;
        if (!selectors || !selectors.length) return;
        const allSelectors = selectors.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            if (isInPostOverlay(element)) return;
            if (hiddenElements.has(element)) return;
            
            const isProtected = isElementProtected(element);
            
            const containsAllowedWords = allowedWordsLower.some(word =>
                element.textContent && element.textContent.toLowerCase().includes(word)
            );
            if (!isProtected && !containsAllowedWords && !isExcludedPath()) {
                collapseElement(element);
            }
        });
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    }

    function collapseElementsByKeywordsOrPaths(keywords, paths, selectors) {
        if (isReelsPage()) return;
        if (isMetaManglerHomeFeedPath()) return;
        if (isPostOverlayOpen()) return;
        if (!selectors || !selectors.length) return;
        const allSelectors = selectors.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            if (isInPostOverlay(element)) return;
            if (hiddenElements.has(element)) return;
            
            const isProtected = isElementProtected(element);
            if (isProtected) return;
            if (isExcludedPath()) return;
            const textContent = element.textContent ? element.textContent.toLowerCase() : "";
            
            const exactTrimmed = element.textContent ? element.textContent.trim().toLowerCase() : "";
            const currentPathLow = location.pathname.toLowerCase();
            const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
            const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];
            if (isNightmareStory && storySafeWords.includes(exactTrimmed)) return;
            if (['peruuta', 'cancel'].includes(exactTrimmed)) return;

            const containsAllowed = allowedWordsLower.some(word => textContent.includes(word));
            if (containsAllowed) return;
            let matched = false;
            for (let i = 0; i < keywordsToHide.length; ++i) {
                if (keywordRegexMatches(keywordsToHide[i], textContent)) {
                    matched = true;
                    break;
                }
            }
            for (let i = 0; i < instagramBannedPathsLower.length; ++i) {
                if (textContent.includes(instagramBannedPathsLower[i])) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                for (let i = 0; i < keywordsToHide.length; ++i) {
                    if (keywordRegexMatches(keywordsToHide[i], element.textContent)) {
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) {
                let postWrapper = findPostWrapper(element);
                if (!postWrapper) postWrapper = element.closest('article');

                if (postWrapper && postWrapper.getAttribute('data-banned-scan') === 'safe') {
                    // This post is globally safe, do not hide!
                } else if (postWrapper && isInPostOverlay(postWrapper)) {
                    // skip
                } else if (postWrapper && !hiddenElements.has(postWrapper)) {
                    const containsAllowedWords = allowedWordsLower.some(word =>
                        postWrapper.textContent && postWrapper.textContent.toLowerCase().includes(word)
                    );
                    if (!containsAllowedWords) {
                        collapseElement(postWrapper);
                    }
                } else if (!postWrapper) {
                    collapseElement(element);
                }
            }
        });

        textBasedTargets.forEach(target => {
            querySelectorAllWithContains(target.selector, target.text).forEach(element => {
                if (isInPostOverlay(element)) return;
                if (!hiddenElements.has(element)) {
                    const isProtected = isElementProtected(element);
                    if (!isProtected) {
                        collapseElement(element);
                    }
                }
            });
        });

        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    }

    function collapseReelsElementsByKeywordsOrPaths(keywords, paths, selectors) {
        return;
    }

    function collapseElementsOnExcludedPaths() {
        if (!isExcludedPath()) return;
        if (!selectorsForExcludedPaths.length) return;
        const allSelectors = selectorsForExcludedPaths.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            collapseElement(element);
        });
    }

    function isExcludedPath() {
        return excludedPaths.some(path => currentURL.indexOf(path) !== -1);
    }

    function handleRedirectionsAndContentHiding() {
        currentURL = window.location.href;

        // === THE SAFE ZONE TOGGLE ===
        const currentPathLow = location.pathname.toLowerCase();
        if (currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/')) {
            document.documentElement.classList.add('safe-story-zone');
        } else {
            document.documentElement.classList.remove('safe-story-zone');
        }
        // ============================

        if (shouldInstagramRedirect()) {
            window.stop();
            fastRedirect('https://www.instagram.com');
            return;
        }

        if (currentURL.includes('www.threads.')) {
            window.stop();
            fastRedirect('https://www.instagram.com');
            return;
        }

        if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
            return;
        }

        if (isReelsPage()) {
            injectReelsCSS();
            return;
        }

        if (isExcludedPath()) {
            collapseElementsOnExcludedPaths();
            return;
        }

        if (isMetaManglerHomeFeedPath()) {
            try { __bf2760HomeV5EnsureObserver(); } catch {}
            hideUnwantedUIButtons();
            updateOverlayState();
            scanPermalinkArticleAndAct();
            return;
        }

        collapseElementsBySelectors(selectorsToHide);
        collapseElementsByKeywordsOrPaths(keywordsToHide, instagramBannedPaths, selectorsToMonitor);
        checkForRedirectElements();
        hideMyosMetaltaElements();
        hideSettingsPageElements();
        hideSinulleEhdotettuaBlock();
        hideAllIGSuggestedLabelsV40();
        hideUnwantedUIButtons();
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
        updateOverlayState();
        scanPermalinkArticleAndAct();
    }

    function isInstagramAccountUsernameBanned(username) {
        const value = normalizeInstagramStoryUsername(username);
        if (!value) return false;
        if (instagramAccountsSet.has(value)) return true;

        for (const rx of keywordsToHide) {
            try {
                if (rx.global || rx.sticky) rx.lastIndex = 0;
                if (rx.test(value)) {
                    if (rx.global || rx.sticky) rx.lastIndex = 0;
                    return true;
                }
                if (rx.global || rx.sticky) rx.lastIndex = 0;
            } catch {}
        }
        return false;
    }

    function findInstagramAccountListRow(anchor) {
        try {
            if (!anchor || anchor.nodeType !== 1) return null;

            let node = anchor;
            for (let depth = 0; node && depth < 14; depth++, node = node.parentElement) {
                if (node.tagName === 'MAIN' || node.tagName === 'BODY') break;

                const links = node.querySelectorAll?.('a[href^="/"]') || [];
                const avatar = node.querySelector?.('div[role="button"] img[alt*="profiilikuva" i], div[role="button"] img[alt*="profile picture" i], div[role="button"] img[alt*="profile photo" i]');

                // A real user row has the target profile link plus its avatar
                // branch. Avoid climbing into the entire dialog/list container.
                if (avatar && links.length <= 4) {
                    return node;
                }
            }
        } catch {}
        return anchor.parentElement || null;
    }

    function hideInstagramAccountsFromList(root = document) {
        try {
            if (!location.hostname.includes('instagram.com')) return 0;
            if (!location.pathname.match(/\/(followers|following)/)) return 0;
            if (isReelsPage()) return 0;

            const scope = root && root.nodeType === 1 ? root : document;
            const anchors = [];
            const selector = 'a[data-ig-row="1"][href^="/"]';

            const addAnchor = (el) => {
                if (el && el.nodeType === 1 && !anchors.includes(el)) anchors.push(el);
            };

            if (scope.matches?.(selector)) addAnchor(scope);
            scope.querySelectorAll?.(selector).forEach(addAnchor);

            // Fallback for a row whose data marker is absent but still has a
            // profile-style href. Only use this inside followers/following.
            if (!anchors.length) {
                scope.querySelectorAll?.('[role="dialog"] a[href^="/"] , main a[href^="/"]')
                    .forEach(addAnchor);
            }

            let hidden = 0;
            const seenRows = new Set();

            for (const anchor of anchors) {
                const href = anchor.getAttribute('href') || '';
                const match = href.match(/^\/([^/?#]+)\/?(?:[?#].*)?$/);
                if (!match) continue;

                const reserved = new Set([
                    'p', 'reel', 'tv', 'stories', 'explore', 'reels', 'accounts',
                    'direct', 'about', 'help', 'legal', 'privacy', 'terms', 'web'
                ]);
                const username = normalizeInstagramStoryUsername(match[1]);
                if (!username || reserved.has(username)) continue;
                if (!isInstagramAccountUsernameBanned(username)) continue;

                const row = findInstagramAccountListRow(anchor);
                if (!row || seenRows.has(row)) continue;
                seenRows.add(row);

                row.setAttribute('data-ig-account-list-banned', username);
                collapseElement(row);
                hidden++;
            }

            return hidden;
        } catch {
            return 0;
        }
    }

    function hideInstagramBannedContent() {
        if (!location.hostname.includes('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;
        
        instagramAccountsToHideLower.forEach(account => {
            if (location.pathname.toLowerCase() === `/${account}/` || location.pathname.toLowerCase().startsWith(`/${account}/`)) {
                const main = document.querySelector('main');
                if (main) {
                    collapseElement(main);
                }
            }
        });

        hideSinulleEhdotettuaBlock();
        hideAllIGSuggestedLabelsV40();

        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
        updateOverlayState();
        scanPermalinkArticleAndAct();
    }

    function genericAggressiveHider() {
        if (!location.hostname.includes('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;
        if (isPostOverlayOpen()) return;
        if (!document.body) return;
        
        const allTextNodes = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            allTextNodes.push(node);
        }
        
        const nukeTargets = ['sponsoroitu', 'sponsored', 'sinulle ehdotettu', 'sinulle ehdotettua', 'suggested for you'];

        allTextNodes.forEach(node => {
            let txtRaw = node.nodeValue || '';
            let txt = txtRaw.toLowerCase();
            let exactTrimmed = txtRaw.trim().toLowerCase();
            
            const currentPathLow = location.pathname.toLowerCase();
            const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
            const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];
            if (isNightmareStory && storySafeWords.includes(exactTrimmed)) return;
            if (['peruuta', 'cancel'].includes(exactTrimmed)) return;

            if (allowedWordsLower.some(word => txt.includes(word))) return;
            
            if (nukeTargets.includes(exactTrimmed)) {
                const wrapper = findPostWrapper(node.parentElement);
                if (wrapper && !isElementProtected(wrapper) && !wrapper.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                    collapseElement(wrapper);
                }
                return; 
            }

            if (keywordsToHide.some(keyword => keywordRegexMatches(keyword, txt))) {
                let el = node.parentElement;
                if (el && isInPostOverlay(el)) return;
                if (el && el.closest('article[data-banned-scan="safe"]')) return;
                if (el && el.offsetParent !== null && 
                    !el.matches('main, section[role="main"], div[role="main"], body, html, nav') &&
                    !isElementProtected(el)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width * rect.height > 150000)) return;
                    collapseElement(el);
                }
            }
        });
        
        allTextNodes.forEach(node => {
            let txtRaw = node.nodeValue || '';
            let txt = txtRaw.toLowerCase();
            let exactTrimmed = txtRaw.trim().toLowerCase();
            
            const currentPathLow = location.pathname.toLowerCase();
            const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
            const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];
            if (isNightmareStory && storySafeWords.includes(exactTrimmed)) return;
            if (['peruuta', 'cancel'].includes(exactTrimmed)) return;

            if (allowedWordsLower.some(word => txt.includes(word))) return;
            if (keywordsToHide.some(re => keywordRegexMatches(re, txtRaw))) {
                let el = node.parentElement;
                if (el && isInPostOverlay(el)) return;
                if (el && el.closest('article[data-banned-scan="safe"]')) return;
                if (el && el.offsetParent !== null && 
                    !el.matches('main, section[role="main"], div[role="main"], body, html, nav') &&
                    !isElementProtected(el)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width * rect.height > 150000)) return;
                    collapseElement(el);
                }
            }
        });
        hideSinulleEhdotettuaBlock();
        hideAllIGSuggestedLabelsV40();
        hideUnwantedUIButtons();
        updateOverlayState();
        scanPermalinkArticleAndAct();
    }

    function hideUnfollowRowInProfileDialog() {
        try {
            const dlg = document.querySelector('[role="dialog"]');
            if (!dlg) return;
            dlg.querySelectorAll('button, div[role="button"][tabindex]').forEach(btn => {
                const txt = (btn.textContent || '').trim().toLowerCase();
                if (txt === 'unfollow' || txt === 'lopeta seuraaminen' || txt === 'estä' || txt === 'block') {
                    collapseElement(btn);
                }
            });
        } catch {}
    }

    function hideUnwantedUIButtons() {
        const currentPathLow = location.pathname.toLowerCase();
        const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
        const targets = ['poista', 'delete', 'remove', 'poista seuraaja', 'remove follower', 'lopeta seuraaminen', 'unfollow', 'estä', 'block'];
        const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];

        const roots = isMetaManglerHomeFeedPath()
            ? Array.from(document.querySelectorAll('[role="dialog"], [role="menu"]')).slice(0, 12)
            : [document];
        if (!roots.length) return;

        for (const root of roots) {
            root.querySelectorAll('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div').forEach(btn => {
                const txt = (btn.textContent || '').trim().toLowerCase();
                if (targets.includes(txt)) {
                    if (btn.tagName === 'DIV' || btn.tagName === 'SPAN') {
                        if (btn.children.length > 2) return;
                    }

                    if (isNightmareStory && storySafeWords.includes(txt)) {
                        unhideNode(btn);
                        let pBtn = btn.closest('button, [role="button"], a, .x1i10hfl');
                        unhideNode(pBtn);
                        return;
                    }

                    collapseElement(btn);
                    const parentBtn = btn.closest('button, [role="button"], a, .x1i10hfl');
                    if (parentBtn && parentBtn !== btn) collapseElement(parentBtn);
                }
            });
        }
    }

    function fastSynchronousHider(mutations) {
        const path = location.pathname.toLowerCase();
        const isNightmareStory = path.includes('/stories/nightmaree3z') || path.includes('/archive/');
        const targets = ['poista', 'delete', 'remove', 'poista seuraaja', 'remove follower', 'lopeta seuraaminen', 'unfollow', 'estä', 'block'];
        const nukeTargets = ['sponsoroitu', 'sponsored', 'sinulle ehdotettu', 'sinulle ehdotettua', 'suggested for you'];
        const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];

        for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];

            if (m.type === 'childList' && m.target) {
                let nodeForArticle = m.target.nodeType === 1 ? m.target : m.target.parentElement;
                if (nodeForArticle && nodeForArticle.closest && !(isMetaManglerHomeFeedPath() && nodeForArticle.closest('article'))) {
                    const article = nodeForArticle.closest('article');
                    if (article && article.hasAttribute('data-banned-scan')) {
                        const currentId = getPostIDFromArticle(article);
                        const scannedId = article.getAttribute('data-scanned-post-id');
                        if (currentId && scannedId && currentId !== scannedId) {
                            article.removeAttribute('data-banned-scan');
                            article.removeAttribute('data-feed-scan-done');
                            article.removeAttribute('data-scanned-post-id');
                        }
                    }
                }
            }

            const added = m.addedNodes;
            for (let j = 0; j < added.length; j++) {
                const node = added[j];
                if (node.nodeType !== 1) continue;
                if (isMetaManglerHomeFeedPath() && (node.matches?.('article') || node.closest?.('article'))) continue;
                
                let elements;
                try {
                    elements = node.matches('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div') 
                        ? [node, ...node.querySelectorAll('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div')]
                        : node.querySelectorAll('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div');
                } catch { continue; }

                for (let k = 0; k < elements.length; k++) {
                    const el = elements[k];
                    if (el.tagName === 'DIV' || el.tagName === 'SPAN') {
                        if (el.children.length > 2) continue;
                    }
                    const txt = (el.textContent || '').trim().toLowerCase();
                    
                    if (nukeTargets.includes(txt)) {
                        el.style.setProperty('opacity', '0', 'important');
                        const wrapper = findPostWrapper(el);
                        if (wrapper && !isElementProtected(wrapper) && !wrapper.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                            collapseElement(wrapper);
                        }
                        continue;
                    }

                    if (targets.includes(txt)) {
                        if (isNightmareStory && storySafeWords.includes(txt)) {
                            unhideNode(el);
                            const pBtn = el.closest('button, [role="button"], a, .x1i10hfl');
                            unhideNode(pBtn);
                            continue; 
                        }
                        
                        if (!isElementProtected(el)) {
                            collapseElement(el);
                        }
                        
                        const parentBtn = el.closest('button, [role="button"], a, .x1i10hfl');
                        if (parentBtn && parentBtn !== el && !isElementProtected(parentBtn)) {
                            collapseElement(parentBtn);
                        }
                    }
                }
            }
        }
    }

    function checkSPARouting() {
        if (__lastKnownUrl !== window.location.href) {
            __lastKnownUrl = window.location.href;
            if (isMetaManglerStoryTrayPathV45()) {
                
                ensureInstagramStoryTrayObserverV48();
            } else {
                
                if (__igStoryTrayObserver) {
                    try { __igStoryTrayObserver.disconnect(); } catch {}
                }
                __igStoryTrayObserver = null;
                __igStoryTrayObservedNode = null;
            }
            window.dispatchEvent(new Event('locationchange'));
        }
    }

    // ===== Home-feed recommendation filter (lightweight diagnostic path) =====
    const IG_RECOMMENDATION_STATE = {
        observer: null,
        observedArticles: new WeakSet()
    };

    function normalizeIGRecommendationText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function isLikelyRecommendedFeedArticle(article) {
        try {
            if (!article || article.nodeType !== 1 || article.tagName !== 'ARTICLE') return false;

            // Strong structural signals: Instagram's people-recommendation surfaces.
            if (article.querySelector('a[href^="/explore/people"], a[href*="/explore/people/"]')) return true;

            const strongLabels = new Set([
                'suggested for you',
                'suggested accounts',
                'recommended for you',
                'sinulle ehdotettu',
                'sinulle ehdotettua',
                'suositeltu sinulle',
                'sponsoroitu',
                'sponsored'
            ]);

            // Only inspect compact interactive/label elements. Do not walk every span/div/text node.
            const compactNodes = article.querySelectorAll('button, a, [role="button"], [role="heading"]');
            let checked = 0;
            for (const el of compactNodes) {
                if (checked++ >= 80) break;
                const label = normalizeIGRecommendationText(el.getAttribute('aria-label'));
                const title = normalizeIGRecommendationText(el.getAttribute('title'));
                const text = normalizeIGRecommendationText(el.textContent);
                if (strongLabels.has(label) || strongLabels.has(title) || strongLabels.has(text)) return true;
                if (label === 'follow' || label === 'seuraa' || text === 'follow' || text === 'seuraa') return true;
                if (el.tagName === 'A') {
                    const href = String(el.getAttribute('href') || '').toLowerCase();
                    if (href.includes('/explore/people')) return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    function hideRecommendedFeedArticle(article) {
        try {
            if (!article || !article.isConnected || article.tagName !== 'ARTICLE') return;
            if (article.getAttribute('data-recommendation-filter') === 'banned') return;
            // DIAGNOSTIC: mark the recommendation only. Do not change geometry,
            // visibility, opacity, or layout so we can isolate the scroll culprit.
            article.setAttribute('data-recommendation-filter', 'banned');
        } catch {}
    }

    function ensureIGRecommendationObserver() {
        try {
            if (!isMetaManglerHomeFeedPath() || !('IntersectionObserver' in window)) return null;
            if (IG_RECOMMENDATION_STATE.observer) return IG_RECOMMENDATION_STATE.observer;

            IG_RECOMMENDATION_STATE.observer = trackObserver(new IntersectionObserver((entries) => {
                try {
                    if (document.hidden || !isMetaManglerHomeFeedPath()) return;
                    for (const entry of entries) {
                        if (!entry || !entry.isIntersecting) continue;
                        const article = entry.target;
                        if (!article || !article.isConnected) continue;
                        if (isLikelyRecommendedFeedArticle(article)) hideRecommendedFeedArticle(article);
                        IG_RECOMMENDATION_STATE.observer.unobserve(article);
                    }
                } catch {}
            }, { root: null, rootMargin: '900px 0px 1200px 0px', threshold: 0 }));

            return IG_RECOMMENDATION_STATE.observer;
        } catch {
            return null;
        }
    }

    function observeIGRecommendationArticles(root = document) {
        try {
            if (!isMetaManglerHomeFeedPath()) return 0;
            const observer = ensureIGRecommendationObserver();
            if (!observer) return 0;

            const candidates = [];
            if (root && root.nodeType === 1 && root.matches?.('article')) candidates.push(root);
            root?.querySelectorAll?.('article').forEach(article => candidates.push(article));
            if (root === document) document.querySelectorAll('main article').forEach(article => candidates.push(article));

            let observed = 0;
            for (const article of candidates) {
                if (!article || !article.isConnected) continue;
                if (IG_RECOMMENDATION_STATE.observedArticles.has(article)) continue;
                IG_RECOMMENDATION_STATE.observedArticles.add(article);
                observer.observe(article);
                observed++;
            }
            return observed;
        } catch {
            return 0;
        }
    }

    function cleanupIGRecommendationObserver() {
        try { IG_RECOMMENDATION_STATE.observer?.disconnect(); } catch {}
        IG_RECOMMENDATION_STATE.observer = null;
        IG_RECOMMENDATION_STATE.observedArticles = new WeakSet();
    }

    let observerScheduled = false;
    let homeFeedDirtyScanTimer = null;
    const homeFeedDirtyArticles = new Set();
    const homeFeedScanningArticles = new Set();
    const homeFeedNoIDAttempts = new WeakMap();

    const IG_FEED_SMOOTH_STATE = {
        articleObserver: null,
        observedArticles: new WeakSet(),
        observerRootMargin: '1400px 0px 2200px 0px'
    };

    function ensureIGFeedArticleObserver() {
        try {
            if (!isMetaManglerHomeFeedPath() || !('IntersectionObserver' in window)) return null;
            if (IG_FEED_SMOOTH_STATE.articleObserver) return IG_FEED_SMOOTH_STATE.articleObserver;

            IG_FEED_SMOOTH_STATE.articleObserver = trackObserver(new IntersectionObserver((entries) => {
                try {
                    if (document.hidden || !isMetaManglerHomeFeedPath()) return;
                    const candidates = [];
                    for (const entry of entries) {
                        if (!entry || !entry.isIntersecting) continue;
                        const article = entry.target;
                        if (!article || !article.isConnected) continue;
                        if (homeFeedDirtyArticles.has(article) || !article.hasAttribute('data-feed-scan-done')) {
                            candidates.push(article);
                        }
                    }
                    if (candidates.length) processFeedPostsForScanning(candidates);
                } catch {}
            }, { root: null, rootMargin: IG_FEED_SMOOTH_STATE.observerRootMargin, threshold: 0 }));

            return IG_FEED_SMOOTH_STATE.articleObserver;
        } catch {
            return null;
        }
    }

    function observeIGFeedArticles(root = document) {
        try {
            if (!isMetaManglerHomeFeedPath()) return 0;
            const observer = ensureIGFeedArticleObserver();
            if (!observer) return 0;

            const candidates = [];
            if (root && root.nodeType === 1 && root.matches?.('article')) candidates.push(root);
            root?.querySelectorAll?.('article').forEach(article => candidates.push(article));
            if (root === document) {
                document.querySelectorAll('main article, article').forEach(article => candidates.push(article));
            }

            let observed = 0;
            for (const article of candidates) {
                if (!article || !article.isConnected) continue;
                if (IG_FEED_SMOOTH_STATE.observedArticles.has(article)) continue;
                IG_FEED_SMOOTH_STATE.observedArticles.add(article);
                observer.observe(article);
                observed++;
            }
            return observed;
        } catch {
            return 0;
        }
    }

    function cleanupIGFeedArticleObserver() {
        try { __bf2760HomeV5Cleanup(); } catch {}
    }

    function restoreFeedArticleForRescan(article) {
        try {
            if (!article) return;
            article.style.removeProperty('max-height');
            article.style.removeProperty('height');
            article.style.removeProperty('min-height');
            article.style.removeProperty('margin');
            article.style.removeProperty('padding');
            article.style.removeProperty('border');
            article.style.removeProperty('overflow');
            article.style.removeProperty('content-visibility');
            article.style.removeProperty('visibility');
            article.style.setProperty('opacity', '1', 'important');
            article.style.removeProperty('pointer-events');
        } catch {}
    }

    function queueHomeFeedDirtyArticle(article) {
        try {
            if (!isMetaManglerHomeFeedPath() || !article || article.nodeType !== 1) return false;
            if (article.tagName !== 'ARTICLE' || !article.isConnected) return false;
            if (homeFeedScanningArticles.has(article)) return false;
            homeFeedDirtyArticles.add(article);
            return true;
        } catch {
            return false;
        }
    }

    function scheduleHomeFeedDirtyScan() {
        try {
            if (!isMetaManglerHomeFeedPath() || homeFeedDirtyArticles.size === 0) return;
            if (homeFeedDirtyScanTimer !== null) return;
            homeFeedDirtyScanTimer = setTimeout(() => {
                homeFeedDirtyScanTimer = null;
                if (!isMetaManglerHomeFeedPath() || document.hidden) return;

                const nearby = [];
                const distant = [];
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 900;
                for (const article of homeFeedDirtyArticles) {
                    if (!article?.isConnected) {
                        homeFeedDirtyArticles.delete(article);
                        continue;
                    }
                    const rect = article.getBoundingClientRect();
                    if (!rect || rect.bottom < -3200 || rect.top > viewportHeight + 4200) {
                        distant.push(article);
                        continue;
                    }
                    nearby.push({ article, distance: Math.abs(rect.top) });
                }

                nearby.sort((a, b) => a.distance - b.distance);
                const candidates = nearby.slice(0, 4).map(item => item.article);
                for (const article of candidates) homeFeedDirtyArticles.delete(article);

                if (candidates.length) processFeedPostsForScanning(candidates);
                if (homeFeedDirtyArticles.size) scheduleHomeFeedDirtyScan();
            }, 40);
        } catch {}
    }

    function enqueueHomeFeedMutation(mutation) {
        try {
            if (!isMetaManglerHomeFeedPath() || !mutation) return false;
            let queued = false;

            const target = mutation.target;
            if (target?.nodeType === 1) {
                const targetArticle = target.matches?.('article') ? target : target.closest?.('article');
                if (targetArticle) {
                    const state = getHomeFeedScanCSSState(targetArticle);
                    if (state === 'approved' && mutation.addedNodes?.length) {
                        for (const node of mutation.addedNodes) {
                            if (nodeIntroducesExplicitFollowCTA_V2760(node)) {
                                const id = getPostIDFromArticle(targetArticle);
                                rejectHomeFeedArticle(targetArticle, id);
                                break;
                            }
                        }
                    } else if (!state || state === 'pending') {
                        if (queueHomeFeedDirtyArticle(targetArticle)) queued = true;
                    }
                }
            }

            if (mutation.addedNodes?.length) {
                for (const node of mutation.addedNodes) {
                    if (!node || node.nodeType !== 1) continue;
                    if (node.matches?.('article')) {
                        observeIGFeedArticles(node);
                        if (queueHomeFeedDirtyArticle(node)) queued = true;
                        continue;
                    }
                    if (node.querySelector?.('article')) {
                        observeIGFeedArticles(node);
                        node.querySelectorAll('article').forEach(article => {
                            const state = getHomeFeedScanCSSState(article);
                            if (state === 'approved' && nodeIntroducesExplicitFollowCTA_V2760(node)) {
                                rejectHomeFeedArticle(article, getPostIDFromArticle(article));
                            } else if (!state || state === 'pending') {
                                if (queueHomeFeedDirtyArticle(article)) queued = true;
                            }
                        });
                    }
                }
            }

            return queued;
        } catch {
            return false;
        }
    }

    function markHomeFeedArticlePending(article, postID = null) {
        try {
            if (!article || article.nodeType !== 1) return;
            if (isMetaManglerHomeFeedPath() && article.tagName === 'ARTICLE' && article.closest('main')) {
                __bf2760HomeV5ReconcileArticle(article, true);
                return;
            }
            article.setAttribute('data-bf-home-feed-scan-state', 'pending');
            if (postID) article.setAttribute('data-scanned-post-id', postID);
        } catch {}
    }

    function approveHomeFeedArticle(article, postID = null) {
        try {
            if (!article || article.nodeType !== 1) return;
            if (isMetaManglerHomeFeedPath() && article.tagName === 'ARTICLE' && article.closest('main')) {
                const id = String(postID || __bf2760HomeV5GetArticlePostID(article) || '');
                if (id) __bf2760HomeV5Approve(article, id, 'stable');
                else __bf2760HomeV5ReconcileArticle(article, true);
                return;
            }
            if (isLikelyUnwantedHomeFeedArticleV27(article)) {
                rejectHomeFeedArticle(article, postID);
                return;
            }
            if (postID) {
                rememberSet(feedApprovedPostIDs, postID);
                rememberSet(approvedPostIDs, postID);
                rememberScannedPost(postID, false);
                feedBannedPostIDs.delete(postID);
                scheduleFeedDecisionCacheSave();
            }
            article.setAttribute('data-bf-home-feed-scan-state', 'approved');
            article.setAttribute('data-feed-scan-done', '1');
            article.setAttribute('data-banned-scan', 'safe');
            setHomeFeedArticleGateV2760(article, false);
            article.style.removeProperty('display');
            article.style.removeProperty('visibility');
        } catch {}
    }

    function rejectHomeFeedArticle(article, postID = null) {
        try {
            if (!article || article.nodeType !== 1) return;
            if (isMetaManglerHomeFeedPath() && article.tagName === 'ARTICLE' && article.closest('main')) {
                const id = String(postID || __bf2760HomeV5GetArticlePostID(article) || '');
                if (id) __bf2760HomeV5Reject(article, id, true);
                else __bf2760HomeV5ReconcileArticle(article, true);
                return;
            }
            if (postID) {
                rememberSet(feedBannedPostIDs, postID);
                rememberScannedPost(postID, true);
                feedApprovedPostIDs.delete(postID);
                approvedPostIDs.delete(postID);
                scheduleFeedDecisionCacheSave();
            }
            article.setAttribute('data-bf-home-feed-scan-state', 'banned');
            article.setAttribute('data-feed-scan-done', '1');
            article.setAttribute('data-banned-scan', 'banned');
            setHomeFeedArticleGateV2760(article, false);
            article.style.setProperty('display', 'none', 'important');
        } catch {}
    }

    function resetHomeFeedArticleState(article) {
        try {
            if (!article) return;
            if (isMetaManglerHomeFeedPath() && article.tagName === 'ARTICLE' && article.closest('main')) {
                article.removeAttribute('data-bf-home-feed-scan-state');
                article.removeAttribute('data-feed-scan-done');
                article.removeAttribute('data-banned-scan');
                article.removeAttribute('data-scanned-post-id');
                article.removeAttribute('data-bf-home-feed-gated');
                __bf2760HomeV5ForgetArticle(article);
                __bf2760HomeV5ReconcileArticle(article, true);
                return;
            }
            article.removeAttribute('data-bf-home-feed-scan-state');
            article.removeAttribute('data-feed-scan-done');
            article.removeAttribute('data-banned-scan');
            article.removeAttribute('data-scanned-post-id');
            article.removeAttribute('data-bf-home-feed-gated');
            article.style.removeProperty('display');
            article.style.removeProperty('visibility');
        } catch {}
    }

    function processFeedPostsForScanning(articleList = null) {
        try {
            if (isReelsPage() || isExcludedPath()) return 0;

            if (isMetaManglerHomeFeedPath()) {
                // V6E hard invariant: the dedicated ID-first coordinator is the only
                // Home-feed scanner/presentation owner. Never enter the legacy scanner
                // below, which can still use display:none / 1px geometry on articles.
                const state = __bf2760HomeV5State();
                if (!state.observer) __bf2760HomeV5EnsureObserver();
                if (articleList) {
                    for (const article of Array.from(new Set(articleList))) {
                        if (article?.isConnected && article.tagName === 'ARTICLE') __bf2760HomeV5ReconcileArticle(article, true);
                    }
                    __bf2760HomeV5SchedulePump(60);
                }
                return 0;
            }

            if (isMetaManglerHomeFeedPath()) {
                const articles = articleList
                    ? Array.from(new Set(articleList))
                    : Array.from(document.querySelectorAll('main article, article'));

                let scheduled = 0;
                for (const article of articles) {
                    if (!article || !article.isConnected) continue;

                    const postID = getPostIDFromArticle(article);
                    const scannedID = article.getAttribute('data-scanned-post-id');
                    if (postID && scannedID && scannedID !== postID) {
                        resetHomeFeedArticleState(article);
                    }

                    const state = getHomeFeedScanCSSState(article);
                    if (state === 'approved' || state === 'banned' || state === 'scanning') continue;

                    if (!postID) {
                        markHomeFeedArticlePending(article, null);
                        const attempts = homeFeedNoIDAttempts.get(article) || 0;
                        if (attempts < 4) {
                            homeFeedNoIDAttempts.set(article, attempts + 1);
                            queueHomeFeedDirtyArticle(article);
                            continue;
                        }
                    } else {
                        homeFeedNoIDAttempts.delete(article);
                    }

                    if (postID && (feedBannedPostIDs.has(postID) || scannedPostsCache.get(postID) === true)) {
                        rejectHomeFeedArticle(article, postID);
                        continue;
                    }

                    if (feedApprovedPostIDs.has(postID) || approvedPostIDs.has(postID) || scannedPostsCache.get(postID) === false) {
                        approveHomeFeedArticle(article, postID);
                        continue;
                    }

                    markHomeFeedArticlePending(article, postID);

                    const highConfidenceRisk = shouldGateHomeFeedArticleV2760(article);
                    if (highConfidenceRisk) {
                        setHomeFeedArticleGateV2760(article, true);
                    } else {
                        setHomeFeedArticleGateV2760(article, false);
                    }

                    if (isLikelyUnwantedHomeFeedArticleV27(article)) {
                        rejectHomeFeedArticle(article, postID);
                        continue;
                    }

                    if (scheduled >= 2) continue;

                    scheduled++;
                    homeFeedScanningArticles.add(article);
                    article.setAttribute('data-bf-home-feed-scan-state', 'scanning');

                    expandAndScanNode(article, postID).then(isClean => {
                        homeFeedScanningArticles.delete(article);
                        if (!article.isConnected) return;

                        const currentID = getPostIDFromArticle(article);
                        if (postID && currentID && postID !== currentID) {
                            resetHomeFeedArticleState(article);
                            queueHomeFeedDirtyArticle(article);
                            scheduleHomeFeedDirtyScan();
                            return;
                        }

                        if (isClean) approveHomeFeedArticle(article, currentID || postID);
                        else rejectHomeFeedArticle(article, currentID || postID);
                        scheduleHomeFeedDirtyScan();
                    }).catch(() => {
                        homeFeedScanningArticles.delete(article);
                        if (!article.isConnected) return;
                        approveHomeFeedArticle(article, postID);
                        scheduleHomeFeedDirtyScan();
                    });
                }
                return scheduled;
            }

            const articles = articleList ? Array.from(new Set(articleList)) : Array.from(document.querySelectorAll('main article, article'));
            if (!articles.length) return 0;

            let processed = 0;
            for (const article of articles) {
                if (processed >= 8) break;
                if (!article || !article.isConnected || article.hasAttribute('data-feed-scan-done')) continue;
                const postID = getPostIDFromArticle(article);
                article.setAttribute('data-banned-scan', 'pending');
                article.setAttribute('data-feed-scan-done', '1');
                if (postID) article.setAttribute('data-scanned-post-id', postID);
                processed++;

                expandAndScanNode(article, postID).then(isClean => {
                    if (!article.isConnected) return;
                    if (isClean) {
                        article.setAttribute('data-banned-scan', 'safe');
                        article.style.setProperty('opacity', '1', 'important');
                        article.style.removeProperty('pointer-events');
                    } else {
                        article.setAttribute('data-banned-scan', 'banned');
                        safelyHideFeedArticle(article);
                    }
                }).catch(() => {
                    if (!article.isConnected) return;
                    article.setAttribute('data-banned-scan', 'safe');
                    article.style.setProperty('opacity', '1', 'important');
                    article.style.removeProperty('pointer-events');
                });
            }
            return processed;
        } catch {}
        return 0;
    }
    function observerCallback(mutationsList) {
        const isHomeFeed = isMetaManglerHomeFeedPath();
        if (document.hidden) return;

        // HOME FEED HOT PATH: this observer is bound to <main>, so keep this
        // callback intentionally tiny. Instagram generates a lot of descendant
        // mutations while virtualizing/recycling posts; do not run unrelated
        // cleaners or document-wide selectors here.
        if (isHomeFeed) {
            let queued = false;
            for (const mutation of mutationsList) {
                if (enqueueHomeFeedMutation(mutation)) queued = true;
            }
            if (queued) scheduleHomeFeedDirtyScan();
            return;
        }

        updateMetaManglerFeedGateClass();
        updateMetaManglerAccountEditClassV43();

        if (location.hostname.includes('instagram.com') && isMetaManglerStoryTrayPathV45()) {
            ensureInstagramStoryTrayObserverV48();
        }

        let hasAddedElement = false;
        try {
            for (const mutation of mutationsList) {
                if (!mutation.addedNodes || !mutation.addedNodes.length) continue;
                for (const node of mutation.addedNodes) {
                    if (node && node.nodeType === 1) {
                        hasAddedElement = true;
                    }
                }
            }
        } catch {
            hasAddedElement = true;
        }
        if (!hasAddedElement) return;

        injectMinimalNoGlimpseNavCSS();

        hideIGAccountEditSectionsV43();
        try {
            for (const mutation of mutationsList) {
                mutation.addedNodes && mutation.addedNodes.forEach(node => {
                    if (node && node.nodeType === 1) {
                        patchIGSelfStoryShortcutV44(node);
                        hideAllIGSuggestedLabelsV40(node);
                        hideIGAccountEditSectionsV43(node);
                    }
                });
            }
        } catch {}
        hideProfileThreadsTags();
        updateOverlayState();
        makeOverlayLikesClickable(); 
        fastSynchronousHider(mutationsList); 
        if (observerScheduled) return;
        observerScheduled = true;
        addTimeout(() => {
            observerScheduled = false;
            if (isReelsPage()) {
                return;
            }
            if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
                hideInstagramAccountsFromList();
                return;
            }
            if (isExcludedPath()) {
                collapseElementsOnExcludedPaths();
                return;
            }
            collapseElementsBySelectors(selectorsToHide);
            hideProfileThreadsTags();
            processFeedPostsForScanning();
            collapseElementsByKeywordsOrPaths(keywordsToHide, instagramBannedPaths, selectorsToMonitor);
            if (location.hostname.includes('instagram.com')) {
                hideInstagramBannedContent();
                checkForRedirectElements();
                hideMyosMetaltaElements();
                hideSinulleEhdotettuaBlock();
                hideAllIGSuggestedLabelsV40();
                hideIGAccountEditSectionsV43();
                hideUnwantedUIButtons();
                ensureInstagramStoryTrayObserverV48();
                hideBannedInstagramStoryAccounts();
                compactBannedInstagramStorySlots();
                if (isSearchSurfacePresent()) {
                    hideInstagramSearchResults();
                }
            }
            hideUnfollowRowInProfileDialog();
            updateOverlayState();
            scanPermalinkArticleAndAct();
            prunePostCaches();
        }, 450);
    }

    let __homeFeedFooterObserver = null;
    let __homeFeedFooterObservedRoot = null;

    function refreshHomeFeedFooterObserver() {
        try {
            if (!location.hostname.includes('instagram.com')) return;
            const footer = document.querySelector('footer');
            if (!footer) {
                if (__homeFeedFooterObserver) {
                    try { __homeFeedFooterObserver.disconnect(); } catch {}
                }
                __homeFeedFooterObserver = null;
                __homeFeedFooterObservedRoot = null;
                return;
            }

            if (__homeFeedFooterObserver && __homeFeedFooterObservedRoot === footer) {
                hideHomeFeedFooterLinks();
                return;
            }

            if (__homeFeedFooterObserver) {
                try { __homeFeedFooterObserver.disconnect(); } catch {}
            }

            __homeFeedFooterObserver = trackObserver(new MutationObserver(() => {
                if (!document.hidden) hideHomeFeedFooterLinks();
            }));
            __homeFeedFooterObservedRoot = footer;
            __homeFeedFooterObserver.observe(footer, { childList: true, subtree: true });
            hideHomeFeedFooterLinks();
        } catch {}
    }

    let __refreshMutationObserverTarget = null;

    function initObserver() {
        const observer = trackObserver(new MutationObserver(observerCallback));
        let observedRoot = null;

        function refreshTarget() {
            try {
                const isHomeFeed = isMetaManglerHomeFeedPath();
                const nextRoot = isHomeFeed ? document.querySelector('main') : document.body;
                if (!nextRoot) {
                    if (observedRoot) {
                        try { observer.disconnect(); } catch {}
                        observedRoot = null;
                    }
                    return;
                }

                refreshHomeFeedFooterObserver();
                watchForHomeFeedRootV27();
                ensureHomeFeedPrepaintObserverV27();
                if (isHomeFeed) observeIGFeedArticles(document);
                if (observedRoot === nextRoot) return;

                try { observer.disconnect(); } catch {}
                observedRoot = nextRoot;

                if (isHomeFeed) {
                    // Narrow home-feed observer: only child-list mutations inside
                    // <main> are relevant to feed post discovery.
                    observer.observe(nextRoot, { childList: true, subtree: true });
                    inspectAddedHomeFeedArticlesV27(nextRoot);
                } else {
                    observer.observe(nextRoot, { childList: true, subtree: true });
                }
            } catch {}
        }

        __refreshMutationObserverTarget = refreshTarget;
        refreshTarget();
        addInterval(() => {
            if (!document.hidden) {
                refreshTarget();
                refreshHomeFeedFooterObserver();
            }
        }, 2000);

        if (!observedRoot) {
            onEvent(document, 'DOMContentLoaded', refreshTarget, false);
            addTimeout(refreshTarget, 250);
            addTimeout(refreshTarget, 750);
            addTimeout(refreshTarget, 1500);
        }
    }

    let __bfHomeFeedPrepaintObserver = null;
    let __bfHomeFeedPrepaintObservedRoot = null;

    function articleHasExplicitFollowCTA_V2760(article) {
        try {
            if (!article || article.nodeType !== 1 || article.tagName !== 'ARTICLE') return false;
            const articleRect = article.getBoundingClientRect();
            const maxHeaderY = Math.max(160, Math.min(220, articleRect?.height || 220));
            const candidates = article.querySelectorAll?.('button, [role="button"], a');
            const limit = Math.min(candidates?.length || 0, 40);
            for (let i = 0; i < limit; i++) {
                const el = candidates[i];
                if (!el || !el.isConnected) continue;
                const txt = String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const aria = String(el.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const exactFollow = txt === 'seuraa' || txt === 'follow' || aria === 'seuraa' || aria === 'follow';
                if (!exactFollow) continue;

                // Only treat an exact Follow/Seuraa control in the post header as a
                // recommendation signal. A caption saying “follow me” must never do this.
                let y = 0;
                try { y = (el.getBoundingClientRect?.().top || 0) - (articleRect?.top || 0); } catch {}
                if (y >= -20 && y <= maxHeaderY) return true;
            }
        } catch {}
        return false;
    }

    function nodeIntroducesExplicitFollowCTA_V2760(node) {
        try {
            if (!node || node.nodeType !== 1) return false;
            const candidates = node.matches?.('button, [role="button"], a')
                ? [node]
                : Array.from(node.querySelectorAll?.('button, [role="button"], a') || []);
            const limit = Math.min(candidates.length, 16);
            for (let i = 0; i < limit; i++) {
                const el = candidates[i];
                const txt = String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const aria = String(el.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (txt === 'seuraa' || txt === 'follow' || aria === 'seuraa' || aria === 'follow') return true;
            }
        } catch {}
        return false;
    }

    function isLikelyUnwantedHomeFeedArticleV27(article) {
        try {
            if (!article || article.nodeType !== 1 || !isMetaManglerHomeFeedPath()) return false;
            if (articleHasExplicitFollowCTA_V2760(article)) return true;
        } catch {}
        return false;
    }

    function getHomeFeedScanCSSState(article) {
        try { return article?.getAttribute('data-bf-home-feed-scan-state') || ''; } catch {}
        return '';
    }

    function shouldGateHomeFeedArticleV2760(article) {
        try {
            if (!article || article.nodeType !== 1 || !isMetaManglerHomeFeedPath()) return false;
            if (article.hasAttribute('data-bf-network-suspicious')) return true;
            if (articleHasExplicitFollowCTA_V2760(article)) return true;
            const txt = String(article.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return txt.includes('sinulle ehdotettua') || txt.includes('sinulle ehdotettu') || txt.includes('suggested for you');
        } catch {}
        return false;
    }

    function setHomeFeedArticleGateV2760(article, gated) {
        try {
            if (!article || article.nodeType !== 1) return;
            if (isMetaManglerHomeFeedPath() && article.tagName === 'ARTICLE' && article.closest('main')) {
                article.removeAttribute('data-bf-home-feed-gated');
                return;
            }
            if (gated) article.setAttribute('data-bf-home-feed-gated', '1');
            else article.removeAttribute('data-bf-home-feed-gated');
        } catch {}
    }

    function injectHomeFeedHybridGateCSS() {
        try {
            const id = 'metamangler-home-feed-hybrid-gate';
            let style = document.getElementById(id);
            if (!style) {
                style = document.createElement('style');
                style.id = id;
                (document.head || document.documentElement).appendChild(style);
            }
            style.textContent = `
                /* V6E Home Feed presentation. Paint-only hiding keeps native geometry for
                   a reject that is too close to the viewport. Safely offscreen rejects use
                   browser-owned size containment: React's child DOM stays completely intact. */
                html[data-bf-ig-home-feed-hybrid="1"] main article[data-bf-home-v6e-hidden="1"]:not([data-bf-home-v6e-contained]) {
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
                html[data-bf-ig-home-feed-hybrid="1"] main article[data-bf-home-v6e-contained] {
                    content-visibility: hidden !important;
                    contain-intrinsic-block-size: 12px !important;
                    pointer-events: none !important;
                }
            `;
            if (document.documentElement) {
                if (isMetaManglerHomeFeedPath()) document.documentElement.setAttribute('data-bf-ig-home-feed-hybrid', '1');
                else document.documentElement.removeAttribute('data-bf-ig-home-feed-hybrid');
            }
        } catch {}
    }

    function inspectAddedHomeFeedArticlesV27(node) {
        try {
            if (!node || node.nodeType !== 1 || !isMetaManglerHomeFeedPath()) return;

            const articles = node.matches?.('article')
                ? [node]
                : Array.from(node.querySelectorAll?.('article') || []).slice(0, 20);

            for (const article of articles) {
                if (!article?.isConnected) continue;
                const postID = getPostIDFromArticle(article);
                const priorScannedID = article.getAttribute('data-scanned-post-id');
                const priorState = article.getAttribute('data-bf-home-feed-scan-state');
                if (postID && priorState === 'approved' && priorScannedID !== postID) {
                    resetHomeFeedArticleState(article);
                }

                if (postID && feedBannedPostIDs.has(postID)) {
                    rejectHomeFeedArticle(article, postID);
                    continue;
                }
                if (isLikelyUnwantedHomeFeedArticleV27(article)) {
                    rejectHomeFeedArticle(article, postID);
                    continue;
                }
                if (postID && (feedApprovedPostIDs.has(postID) || approvedPostIDs.has(postID))) {
                    approveHomeFeedArticle(article, postID);
                    continue;
                }

                markHomeFeedArticlePending(article, postID);

                queueHomeFeedDirtyArticle(article);
            }
            if (articles.length) scheduleHomeFeedDirtyScan();
        } catch {}
    }

    function ensureHomeFeedPrepaintObserverV27() {
        try {
            if (!__bf2760SafeHomeIsActive()) {
                __bf2760SafeCleanup();
                return;
            }

            injectHomeFeedHybridGateCSS();
            const root = document.querySelector('main');
            if (!root) return;

            const rootChanged = __BF2760_SAFE_HOME_STATE.observedRoot !== root;
            if (rootChanged) {
                __BF2760_SAFE_HOME_STATE.queue.clear();
                __BF2760_SAFE_HOME_STATE.scanning.clear();
                __BF2760_SAFE_HOME_STATE.observedRoot = root;
                __BF2760_SAFE_HOME_STATE.route = location.href;
                const existing = root.querySelectorAll?.('article') || [];
                const limit = Math.min(existing.length, 16);
                for (let i = 0; i < limit; i++) __bf2760SafeRegister(existing[i]);
            }
            __bf2760SafeSchedulePump(100);
        } catch {}
    }

    function watchForHomeFeedRootV27() {
        try {
            if (!isMetaManglerHomeFeedPath()) return;
            if (document.querySelector('main')) {
                ensureHomeFeedPrepaintObserverV27();
                return;
            }
            if (__bfHomeFeedPrepaintRootWaitObserver) return;
            const root = document.documentElement;
            if (!root) return;
            __bfHomeFeedPrepaintRootWaitObserver = trackObserver(new MutationObserver(() => {
                if (document.querySelector('main')) {
                    try { __bfHomeFeedPrepaintRootWaitObserver.disconnect(); } catch {}
                    __bfHomeFeedPrepaintRootWaitObserver = null;
                    ensureHomeFeedPrepaintObserverV27();
                }
            }));
            __bfHomeFeedPrepaintRootWaitObserver.observe(root, { childList: true, subtree: true });
        } catch {}
    }

    function mainHandler() {
        updateMetaManglerFeedGateClass();
        updateMetaManglerAccountEditClassV43();
        injectMinimalNoGlimpseNavCSS();
        patchIGSelfStoryShortcutV44();
        hideIGAccountEditSectionsV43();
        hideProfileThreadsTags();
        hideHomeFeedFooterLinks();
        refreshHomeFeedFooterObserver();
        watchForHomeFeedRootV27();
        ensureHomeFeedPrepaintObserverV27();
        injectHomeFeedHybridGateCSS();
        handleRedirectionsAndContentHiding();
        if (isReelsPage()) {
            updateOverlayState();
            return;
        }
        if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
            hideInstagramAccountsFromList();
            updateOverlayState();
            return;
        }
        
        if (isMetaManglerHomeFeedPath()) {
            // The narrow main observer / prepaint observer now own Home-feed discovery.
            // Avoid installing an additional intersection scanner here; duplicate
            // observation increased churn without improving coverage.
            cleanupIGRecommendationObserver();
        } else {
            cleanupIGRecommendationObserver();
            processFeedPostsForScanning();
        }

        if (location.hostname.includes('instagram.com')) {
            if (!isMetaManglerHomeFeedPath()) hideInstagramBannedContent();
            // genericAggressiveHider(); // disabled in regular home path to reduce churn/RAM
            checkForRedirectElements();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            if (!isMetaManglerHomeFeedPath()) {
                hideSinulleEhdotettuaBlock();
                hideAllIGSuggestedLabelsV40();
            }
            hideIGAccountEditSectionsV43();
            hideUnwantedUIButtons();
            compactBannedInstagramStorySlots();
            
            if (isSearchSurfacePresent()) {
                hideInstagramSearchResults();
            }
        }
        hideUnfollowRowInProfileDialog();
        updateOverlayState();
        scanPermalinkArticleAndAct();
        makeOverlayLikesClickable(); 
    }

    mainHandler();
    initObserver();

    function scheduleIntervals() {
        addInterval(() => {
            updateMetaManglerFeedGateClass();
            updateMetaManglerAccountEditClassV43();
            checkSPARouting(); 
            patchIGSelfStoryShortcutV44();
            if (location.hostname.includes('instagram.com')) {
                ensureInstagramStoryTrayObserverV48();
                hideBannedInstagramStoryAccounts();
                compactBannedInstagramStorySlots();
                if (isMetaManglerHomeFeedPath()) {
                    cleanupIGRecommendationObserver();
                    __bf2760HomeV5EnsureObserver();
                } else {
                    cleanupIGRecommendationObserver();
                }
            }
            updateOverlayState();
            makeOverlayLikesClickable(); 
            if (!isReelsPage() && !document.hidden) {
                hideUnwantedUIButtons();
                hideIGAccountEditSectionsV43();
                hideProfileThreadsTags();
                if (isSearchSurfacePresent()) hideInstagramSearchResults();
                prunePostCaches();
                // genericAggressiveHider disabled here to reduce DOM churn/RAM.
            }
        }, 2000); 
    }
    startIntervals(scheduleIntervals);

    onEvent(document, 'visibilitychange', () => {
        updateOverlayState();
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleIntervals);
            mainHandler();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
    }, false);

    onEvent(document, 'click', handleIGSelfStoryShortcutClickV44, true);

    onEvent(document, 'click', (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href^="/p/"], a[href^="/reel/"], a[href^="/tv/"]');
        if (a) {
            addTimeout(() => { updateOverlayState(); scanPermalinkArticleAndAct(); }, 150);
            addTimeout(() => { updateOverlayState(); scanPermalinkArticleAndAct(); }, 300);
        }
    }, true);

    (function() {
        var _wr = function(type) {
            var orig = history[type];
            return function() {
                var rv = orig.apply(this, arguments);
                window.dispatchEvent(new Event(type));
                window.dispatchEvent(new Event('locationchange'));
                return rv;
            };
        };
        history.pushState = _wr('pushState');
        history.replaceState = _wr('replaceState');
        onEvent(window, 'popstate', function() {
            window.dispatchEvent(new Event('locationchange'));
        }, false);
    })();

    onEvent(window, 'locationchange', function() {
        updateMetaManglerFeedGateClass();
        updateMetaManglerAccountEditClassV43();
        if (isMetaManglerStoryTrayPathV45()) {
            ensureInstagramStoryTrayObserverV48();
        } else {
            if (__igStoryTrayObserver) {
                try { __igStoryTrayObserver.disconnect(); } catch {}
            }
            __igStoryTrayObserver = null;
            __igStoryTrayObservedNode = null;
        }
        patchIGSelfStoryShortcutV44();
        isFeedScanPhase = true; 
        reelsStyleInjected = false;
        currentURL = window.location.href;
        injectInlineCSS();
        updateOverlayState();
        if (__refreshMutationObserverTarget) __refreshMutationObserverTarget();
        ensureHomeFeedPrepaintObserverV27();
        permalinkScanAttempts = 0;
        if (isReelsPage()) {
            injectReelsCSS();
        } else {
            mainHandler();
            hideProfileThreadsTags();
            hideHomeFeedFooterLinks();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            if (!isMetaManglerHomeFeedPath()) {
                hideSinulleEhdotettuaBlock();
                hideAllIGSuggestedLabelsV40();
            }
            hideIGAccountEditSectionsV43();
            hideUnwantedUIButtons();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
        scanPermalinkArticleAndAct();
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);


    // ===== v27.6.0 HYBRID V6E ONE-OWNER CONTAINED-COLLAPSE HOME-FEED COORDINATOR =====
    // The Home Feed is a virtualized React surface. Post IDs own decisions; article
    // elements are disposable hosts. Confirmed rejects are paint-hidden immediately.
    // When safely below the viewport, Chromium content containment supplies a compact
    // intrinsic block size without removing or display:none-ing React-managed children.
    // Expensive caption expansion remains serialized, offscreen-only and tri-state:
    // unsafe/failed verification stays UNKNOWN and is never cached as approved.
    var __BF2760_HOME_V5_STATE;

    function __bf2760HomeV5State() {
        if (__BF2760_HOME_V5_STATE) return __BF2760_HOME_V5_STATE;
        __BF2760_HOME_V5_STATE = {
            root: null,
            observer: null,
            queue: [],
            queuedIDs: new Set(),
            queuedArticles: new WeakSet(),
            articleIDs: new WeakMap(),
            articleGenerations: new WeakMap(),
            retirementArticles: new Set(),
            retiredArticles: new Set(),
            tombstones: new WeakMap(),
            collapseFailedIDs: new Set(),
            missingIDSince: new WeakMap(),
            articleFingerprints: new WeakMap(),
            dirtyArticles: new WeakSet(),
            mutationArticles: new Set(),
            mutationFlushScheduled: false,
            scanning: false,
            scanArticle: null,
            scanID: null,
            scanGeneration: 0,
            pumpTimer: null,
            pumpScheduled: false,
            reconcileTimer: null,
            reconcileDueAt: 0,
            scrollUntil: 0,
            userInputUntil: 0,
            lastScrollAt: 0,
            lastUserInputAt: 0,
            userInputSerial: 0,
            idleHandle: null,
            route: ''
        };
        return __BF2760_HOME_V5_STATE;
    }

    function __bf2760HomeV5Active() {
        try { return isMetaManglerHomeFeedPath(); } catch { return false; }
    }

    function __bf2760HomeV5Normalize(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function __bf2760HomeV5GetArticlePostID(article) {
        try {
            if (!article) return '';
            const parseHref = href => {
                const match = String(href || '').match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
                return match?.[1] || '';
            };

            const time = article.querySelector?.('time');
            const timestampLink = time?.closest?.('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
            const timestampID = parseHref(timestampLink?.getAttribute?.('href'));
            if (timestampID) return timestampID;

            const ids = [];
            const links = article.querySelectorAll?.('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]') || [];
            const limit = Math.min(links.length, 24);
            for (let i = 0; i < limit; i++) {
                const id = parseHref(links[i]?.getAttribute?.('href'));
                if (id && !ids.includes(id)) ids.push(id);
            }
            if (ids.length === 1) return ids[0];
            if (ids.length > 1) {
                // During React host recycling old and new permalinks can briefly coexist.
                // Ambiguous identity is UNKNOWN; never let the old Post ID win by inertia.
                return '';
            }

            const embeddedID = article.getAttribute?.('data-post-id') || article.getAttribute?.('data-media-id') || '';
            return String(embeddedID || '');
        } catch { return ''; }
    }

    function __bf2760HomeV5HasFollowCTA(article) {
        try {
            if (!article?.isConnected || article.tagName !== 'ARTICLE') return false;
            const articleRect = article.getBoundingClientRect?.();
            const maxHeaderY = Math.max(160, Math.min(220, articleRect?.height || 220));
            const candidates = article.querySelectorAll?.('button, [role="button"], a') || [];
            const limit = Math.min(candidates.length, 48);
            for (let i = 0; i < limit; i++) {
                const el = candidates[i];
                const text = __bf2760HomeV5Normalize(el?.textContent);
                const aria = __bf2760HomeV5Normalize(el?.getAttribute?.('aria-label'));
                if (text !== 'seuraa' && text !== 'follow' && aria !== 'seuraa' && aria !== 'follow') continue;
                let y = 0;
                try { y = (el.getBoundingClientRect?.().top || 0) - (articleRect?.top || 0); } catch {}
                if (y >= -24 && y <= maxHeaderY) return true;
            }
        } catch {}
        return false;
    }

    const __BF2760_HOME_V6G_HARD_BADGE_TEXT = new Set([
        'tekoälysisältö',
        'luotu todennäköisesti tekoälyllä',
        'ai info',
        'made with ai',
        'ai-generated content',
        'ai generated content',
        'ai-created content',
        'ai created content',
        'sponsoroitu',
        'sponsored',
        'maksettu kumppanuus',
        'paid partnership',
        'sinulle ehdotettua',
        'sinulle ehdotettu',
        'ehdotettu sinulle',
        'suositeltu sinulle',
        'sinulle suositeltua',
        'suggested for you',
        'suggested post',
        'suggested posts',
        'recommended for you',
        'recommended post',
        'recommended posts'
    ]);

    function __bf2760HomeV6GHasHardBadge(article) {
        try {
            if (!article?.isConnected) return false;
            const candidates = article.querySelectorAll?.('[role="heading"], span, button, [role="button"], [aria-label], [title]') || [];
            const limit = Math.min(candidates.length, 112);
            for (let i = 0; i < limit; i++) {
                const el = candidates[i];
                const text = __bf2760HomeV5Normalize(el?.textContent);
                const aria = __bf2760HomeV5Normalize(el?.getAttribute?.('aria-label'));
                const title = __bf2760HomeV5Normalize(el?.getAttribute?.('title'));
                if (__BF2760_HOME_V6G_HARD_BADGE_TEXT.has(text) ||
                    __BF2760_HOME_V6G_HARD_BADGE_TEXT.has(aria) ||
                    __BF2760_HOME_V6G_HARD_BADGE_TEXT.has(title)) return true;
            }
        } catch {}
        return false;
    }

    function __bf2760HomeV5ImmediateRejectSignal(article, id = '') {
        try {
            if (!article?.isConnected) return false;
            if (__bf2760HomeV6GHasHardBadge(article)) return true;
            if (__bf2760HomeV5HasFollowCTA(article) && !(id && networkFeedApprovedPostIDs.has(id))) return true;
        } catch {}
        return false;
    }

    const __BF2760_HOME_V6E_COLLAPSE_ATTR = 'data-bf-home-v6e-contained';
    const __BF2760_HOME_V6E_HIDDEN_ATTR = 'data-bf-home-v6e-hidden';
    const __BF2760_HOME_V6E_COLLAPSE_SUPPORTED = (() => {
        try {
            return !!window.CSS?.supports?.('content-visibility', 'hidden') &&
                !!window.CSS?.supports?.('contain-intrinsic-block-size', '12px');
        } catch { return false; }
    })();

    function __bf2760HomeV5SetHidden(article, hidden) {
        try {
            if (!article) return;
            article.removeAttribute('data-bf-home-v6d-hidden');
            if (hidden) article.setAttribute(__BF2760_HOME_V6E_HIDDEN_ATTR, '1');
            else article.removeAttribute(__BF2760_HOME_V6E_HIDDEN_ATTR);
        } catch {}
    }

    function __bf2760HomeV6EGetArticleFingerprint(article) {
        try {
            if (!article?.isConnected) return '';
            const time = article.querySelector?.('time');
            const datetime = String(time?.getAttribute?.('datetime') || '').trim();
            let author = '';
            const links = article.querySelectorAll?.('a[href]') || [];
            const limit = Math.min(links.length, 24);
            for (let i = 0; i < limit; i++) {
                const href = String(links[i]?.getAttribute?.('href') || '').trim();
                if (!/^\/[A-Za-z0-9._-]+\/?(?:[?#].*)?$/.test(href)) continue;
                const bare = href.split(/[?#]/, 1)[0].replace(/^\/|\/$/g, '').toLowerCase();
                if (!bare || bare === 'p' || bare === 'reel' || bare === 'reels' || bare === 'tv' || bare === 'explore') continue;
                author = bare;
                break;
            }
            return `${author}|${datetime}`;
        } catch { return ''; }
    }

    function __bf2760HomeV6ENearViewport(article) {
        try {
            const rect = article?.getBoundingClientRect?.();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 900;
            return !!rect && rect.bottom > -viewportHeight * 0.35 && rect.top < viewportHeight * 1.35;
        } catch { return true; }
    }

    function __bf2760HomeV5ClearTombstone(article) {
        try {
            if (!article) return;
            const state = __bf2760HomeV5State();
            state.retirementArticles.delete(article);
            state.retiredArticles.delete(article);
            article.removeAttribute(__BF2760_HOME_V6E_COLLAPSE_ATTR);
            article.removeAttribute('data-bf-home-v6d-collapsed');
            article.removeAttribute('data-bf-feed-tombstone');
            state.tombstones.delete(article);
        } catch {}
    }

    function __bf2760HomeV5RestoreArticle(article) {
        try {
            __bf2760HomeV5ClearTombstone(article);
            __bf2760HomeV5SetHidden(article, false);
        } catch {}
    }

    function __bf2760HomeV6EStillRejected(id) {
        try {
            return !!id && (networkFeedRejectedPostIDs.has(id) || feedBannedPostIDs.has(id) || scannedPostsCache.get(id) === true);
        } catch { return false; }
    }

    function __bf2760HomeV6ECanCollapse(article, id) {
        try {
            if (!__BF2760_HOME_V6E_COLLAPSE_SUPPORTED || !article?.isConnected || !id) return false;
            const state = __bf2760HomeV5State();
            if (Date.now() < state.scrollUntil || Date.now() < state.userInputUntil) return false;
            if (__bf2760HomeV5GetArticlePostID(article) !== id || !__bf2760HomeV6EStillRejected(id)) return false;
            const rect = article.getBoundingClientRect?.();
            if (!rect || rect.height <= 40) return false;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 900;
            const safetyGap = Math.max(320, viewportHeight * 0.35);
            return rect.top > viewportHeight + safetyGap;
        } catch { return false; }
    }

    function __bf2760HomeV5ApplyTombstone(article, id) {
        try {
            const state = __bf2760HomeV5State();
            if (!__bf2760HomeV6ECanCollapse(article, id)) return false;
            const generation = state.articleGenerations.get(article) || 0;
            let tombstone = state.tombstones.get(article);
            if (!tombstone || tombstone.id !== id || tombstone.generation !== generation) {
                __bf2760HomeV5ClearTombstone(article);
                tombstone = { id, generation, retired: false };
                state.tombstones.set(article, tombstone);
            }
            if (tombstone.retired) return true;

            // One-way while this Post ID owns this host: no probe, no expand/revert cycle.
            // content-visibility keeps React's descendants in the DOM and lets Chromium
            // supply the compact intrinsic block size without child display:none surgery.
            article.setAttribute(__BF2760_HOME_V6E_COLLAPSE_ATTR, id);
            article.setAttribute('data-bf-feed-tombstone', id);
            __bf2760HomeV5SetHidden(article, false);
            tombstone.retired = true;
            state.retirementArticles.delete(article);
            state.retiredArticles.add(article);
            return true;
        } catch {}
        return false;
    }

    function __bf2760HomeV5QueueRetirement(article, id) {
        try {
            if (!article?.isConnected || !id) return;
            const state = __bf2760HomeV5State();
            const generation = state.articleGenerations.get(article) || 0;
            let tombstone = state.tombstones.get(article);
            if (tombstone && (tombstone.id !== id || tombstone.generation !== generation)) {
                __bf2760HomeV5ClearTombstone(article);
                tombstone = null;
            }
            if (!tombstone) {
                tombstone = { id, generation, retired: false };
                state.tombstones.set(article, tombstone);
            }

            if (tombstone.retired) {
                state.retirementArticles.delete(article);
                state.retiredArticles.add(article);
                __bf2760HomeV5SetHidden(article, false);
                return;
            }

            // Rejection paint suppression is non-geometric and may happen immediately.
            // Geometry changes wait for a safely-below, idle contained-collapse opportunity.
            state.retirementArticles.add(article);
            __bf2760HomeV5SetHidden(article, true);
            if (!__bf2760HomeV5ApplyTombstone(article, id)) __bf2760HomeV5ScheduleReconcile(220);
        } catch {}
    }

    function __bf2760HomeV5ProcessRetirements(limit = 16) {
        try {
            const state = __bf2760HomeV5State();
            const idle = Date.now() >= state.scrollUntil && Date.now() >= state.userInputUntil;
            let processed = 0;
            for (const article of Array.from(state.retirementArticles)) {
                if (processed++ >= limit) break;
                if (!article?.isConnected) { __bf2760HomeV5RestoreArticle(article); continue; }
                const tombstone = state.tombstones.get(article);
                if (!tombstone) { state.retirementArticles.delete(article); continue; }
                const currentID = __bf2760HomeV5GetArticlePostID(article);
                const generation = state.articleGenerations.get(article) || 0;
                if (!currentID) continue;
                if (currentID !== tombstone.id || generation !== tombstone.generation || !__bf2760HomeV6EStillRejected(currentID)) {
                    __bf2760HomeV5RestoreArticle(article);
                    continue;
                }
                __bf2760HomeV5SetHidden(article, true);
                if (idle) __bf2760HomeV5ApplyTombstone(article, currentID);
            }

            // Rotate a small audit window instead of DOM-querying every collapsed host on
            // every reconcile tick. href/child mutations remain the primary recycle signal.
            let audited = 0;
            const auditLimit = Math.max(4, Math.min(12, Math.floor(limit / 2) || 4));
            for (const article of Array.from(state.retiredArticles)) {
                if (audited++ >= auditLimit) break;
                state.retiredArticles.delete(article);
                if (!article?.isConnected) { __bf2760HomeV5RestoreArticle(article); continue; }
                const tombstone = state.tombstones.get(article);
                const currentID = __bf2760HomeV5GetArticlePostID(article);
                const generation = state.articleGenerations.get(article) || 0;
                if (!tombstone?.retired) { __bf2760HomeV5RestoreArticle(article); continue; }
                if (currentID && (currentID !== tombstone.id || generation !== tombstone.generation || !__bf2760HomeV6EStillRejected(currentID))) {
                    __bf2760HomeV5RestoreArticle(article);
                    continue;
                }
                state.retiredArticles.add(article);
            }
        } catch {}
    }

    function __bf2760HomeV5RememberDecision(id, banned, verification = '') {
        try {
            if (!id) return;
            let persistentChanged = false;
            if (banned) {
                if (!feedBannedPostIDs.has(id)) persistentChanged = true;
                rememberSet(feedBannedPostIDs, id);
                if (feedApprovedPostIDs.delete(id)) persistentChanged = true;
                if (feedDeepVerifiedPostIDs.delete(id)) persistentChanged = true;
                approvedPostIDs.delete(id);
                rememberScannedPost(id, true);
            } else {
                if (!feedApprovedPostIDs.has(id)) persistentChanged = true;
                rememberSet(feedApprovedPostIDs, id);
                rememberSet(approvedPostIDs, id);
                if (feedBannedPostIDs.delete(id)) persistentChanged = true;
                if (verification === 'expanded' && !feedDeepVerifiedPostIDs.has(id)) {
                    feedDeepVerifiedPostIDs.add(id);
                    persistentChanged = true;
                }
                rememberScannedPost(id, false);
            }
            if (persistentChanged) scheduleFeedDecisionCacheSave();
        } catch {}
    }

    function __bf2760HomeV5ForgetArticle(article) {
        try {
            if (!article) return;
            const state = __bf2760HomeV5State();
            const priorID = state.articleIDs.get(article) || '';
            state.articleIDs.delete(article);
            state.articleFingerprints.delete(article);
            state.missingIDSince.delete(article);
            state.articleGenerations.set(article, (state.articleGenerations.get(article) || 0) + 1);
            __bf2760HomeV5RemoveQueued(article, priorID);
            __bf2760HomeV5RestoreArticle(article);
        } catch {}
    }

    function __bf2760HomeV5Approve(article, id, verification = 'stable') {
        try {
            if (!article?.isConnected || !id) return;
            const currentID = __bf2760HomeV5GetArticlePostID(article);
            if (currentID !== id) return;
            __bf2760HomeV5RememberDecision(id, false, verification);
            __bf2760HomeV5RemoveQueued(article, id);
            const state = __bf2760HomeV5State();
            state.articleIDs.set(article, id);
            state.dirtyArticles.delete(article);
            __bf2760HomeV5RestoreArticle(article);
        } catch {}
    }

    function __bf2760HomeV5Reject(article, id, hide = true) {
        try {
            if (!article?.isConnected || !id) return;
            const currentID = __bf2760HomeV5GetArticlePostID(article);
            if (currentID && currentID !== id) return;
            __bf2760HomeV5RememberDecision(id, true);
            __bf2760HomeV5RemoveQueued(article, id);
            const state = __bf2760HomeV5State();
            state.articleIDs.set(article, id);
            if (hide) __bf2760HomeV5QueueRetirement(article, id);
        } catch {}
    }

    function __bf2760HomeV5RemoveQueued(article, id = '') {
        try {
            const state = __bf2760HomeV5State();
            const targetID = String(id || state.articleIDs.get(article) || '');
            if (targetID) state.queuedIDs.delete(targetID);
            if (article) state.queuedArticles.delete(article);
            if (!state.queue.length) return;
            state.queue = state.queue.filter(entry => {
                if (!entry) return false;
                if (article && entry.article === article) return false;
                if (targetID && entry.id === targetID) return false;
                return entry.article?.isConnected;
            });
        } catch {}
    }

    function __bf2760HomeV5Queue(article, id, options = null) {
        try {
            const state = __bf2760HomeV5State();
            if (!article?.isConnected || !id) return;
            if (state.queuedArticles.has(article) || state.scanning && state.scanArticle === article) return;
            if (state.queuedIDs.has(id)) return;
            const now = performance.now();
            state.queuedArticles.add(article);
            state.queuedIDs.add(id);
            state.queue.push({
                article,
                id,
                generation: state.articleGenerations.get(article) || 0,
                enqueuedAt: Number.isFinite(options?.enqueuedAt) ? options.enqueuedAt : now,
                notBefore: Number.isFinite(options?.notBefore) ? options.notBefore : now + 180,
                attempts: Number.isFinite(options?.attempts) ? options.attempts : 0
            });
        } catch {}
    }

    function __bf2760HomeV6CRequeueCandidate(candidate, delay = 500) {
        try {
            const state = __bf2760HomeV5State();
            const article = candidate?.article;
            const id = candidate?.id || '';
            const generation = candidate?.generation || 0;
            if (!article?.isConnected || !id) return;
            if (__bf2760HomeV5GetArticlePostID(article) !== id) return;
            if ((state.articleGenerations.get(article) || 0) !== generation) return;
            if (networkFeedRejectedPostIDs.has(id) || networkFeedApprovedPostIDs.has(id) || feedBannedPostIDs.has(id) || scannedPostsCache.get(id) === true) return;

            if (state.queuedArticles.has(article) || state.queuedIDs.has(id)) return;
            const attempts = Math.max(0, candidate?.attempts || 0) + 1;
            const retryDelay = Math.min(5000, Math.max(delay, 350 * Math.pow(1.65, Math.min(attempts, 6))));
            const now = performance.now();
            state.queuedArticles.add(article);
            state.queuedIDs.add(id);
            state.queue.push({
                article,
                id,
                generation,
                attempts,
                enqueuedAt: candidate?.enqueuedAt || now,
                notBefore: now + retryDelay
            });
            __bf2760HomeV5SchedulePump(retryDelay + 25);
        } catch {}
    }

    function __bf2760HomeV5ReconcileArticle(article, allowQueue = true) {
        try {
            if (!__bf2760HomeV5Active() || !article?.isConnected || article.tagName !== 'ARTICLE') return;
            const state = __bf2760HomeV5State();
            article.removeAttribute('data-bf-home-feed-gated');
            article.removeAttribute('data-bf-home-feed-scan-state');
            article.removeAttribute('data-banned-scan');
            article.removeAttribute('data-feed-scan-done');

            const id = __bf2760HomeV5GetArticlePostID(article);
            const priorID = state.articleIDs.get(article) || '';
            const fingerprint = __bf2760HomeV6EGetArticleFingerprint(article);
            if (!id) {
                if (priorID) {
                    const priorFingerprint = state.articleFingerprints.get(article) || '';
                    if (fingerprint && priorFingerprint && fingerprint !== priorFingerprint) {
                        // Strong recycle evidence: do not let the new host inherit the old
                        // reject/approval presentation while its permalink is between commits.
                        __bf2760HomeV5ForgetArticle(article);
                        return;
                    }
                    let since = state.missingIDSince.get(article);
                    if (!Number.isFinite(since)) { since = performance.now(); state.missingIDSince.set(article, since); }
                    const grace = __bf2760HomeV6ENearViewport(article) ? 90 : 180;
                    if (performance.now() - since > grace) __bf2760HomeV5ForgetArticle(article);
                    else __bf2760HomeV5ScheduleReconcile(Math.min(100, grace));
                }
                return;
            }
            state.missingIDSince.delete(article);

            if (priorID && priorID !== id) {
                state.articleGenerations.set(article, (state.articleGenerations.get(article) || 0) + 1);
                __bf2760HomeV5RemoveQueued(article, priorID);
                __bf2760HomeV5RestoreArticle(article);
            }
            state.articleIDs.set(article, id);
            if (fingerprint) state.articleFingerprints.set(article, fingerprint);
            const wasDirty = state.dirtyArticles.has(article);
            if (wasDirty) state.dirtyArticles.delete(article);
            const identityChanged = !priorID || priorID !== id;

            // Structured/network and durable rejects always win. Persist a network
            // rejection once it reaches the DOM so recycled hosts keep the same decision.
            if (networkFeedRejectedPostIDs.has(id)) { __bf2760HomeV5Reject(article, id, true); return; }
            if (feedBannedPostIDs.has(id) || scannedPostsCache.get(id) === true) { __bf2760HomeV5Reject(article, id, true); return; }
            // Explicit on-post AI/recommendation/sponsor badges are authoritative DOM
            // fallbacks, but scan them only on a new identity or a real React mutation.
            if ((identityChanged || wasDirty) && __bf2760HomeV5ImmediateRejectSignal(article, id)) {
                __bf2760HomeV5Reject(article, id, true);
                return;
            }
            if (networkFeedApprovedPostIDs.has(id)) {
                __bf2760HomeV5RemoveQueued(article, id);
                __bf2760HomeV5RestoreArticle(article);
                return;
            }

            if (feedApprovedPostIDs.has(id)) {
                // An approval made before Instagram exposed a More/Lisää control is not
                // allowed to become a permanent blind spot. Only re-check an approved
                // post when React actually mutated that host; periodic reconciliation
                // stays cheap for stable approved posts.
                if (wasDirty && __bf2760HomeV5CheapContentCheck(article)) {
                    __bf2760HomeV5Reject(article, id, true);
                    return;
                }
                if (wasDirty && __bf2760HomeV5HasMoreButton(article) && !feedDeepVerifiedPostIDs.has(id)) {
                    feedApprovedPostIDs.delete(id);
                    approvedPostIDs.delete(id);
                    scannedPostsCache.delete(id);
                    scheduleFeedDecisionCacheSave();
                    __bf2760HomeV5RestoreArticle(article);
                    if (allowQueue) __bf2760HomeV5Queue(article, id);
                    return;
                }
                __bf2760HomeV5Approve(article, id, feedDeepVerifiedPostIDs.has(id) ? 'expanded' : 'stable');
                return;
            }

            __bf2760HomeV5RestoreArticle(article);
            if (allowQueue) __bf2760HomeV5Queue(article, id);
        } catch {}
    }

    function __bf2760HomeV6EFlushMutationArticles() {
        try {
            const state = __bf2760HomeV5State();
            state.mutationFlushScheduled = false;
            if (!__bf2760HomeV5Active() || document.hidden) { state.mutationArticles.clear(); return; }
            let processed = 0;
            for (const article of Array.from(state.mutationArticles)) {
                state.mutationArticles.delete(article);
                if (!article?.isConnected || article.tagName !== 'ARTICLE') continue;
                state.dirtyArticles.add(article);
                __bf2760HomeV5ReconcileArticle(article, true);
                if (++processed >= 28) break;
            }
            __bf2760HomeV5ProcessRetirements(8);
            __bf2760HomeV5SchedulePump(70);
            if (state.mutationArticles.size) __bf2760HomeV6EScheduleMutationFlush();
        } catch {}
    }

    function __bf2760HomeV6EScheduleMutationFlush() {
        try {
            const state = __bf2760HomeV5State();
            if (state.mutationFlushScheduled) return;
            state.mutationFlushScheduled = true;
            const flush = () => __bf2760HomeV6EFlushMutationArticles();
            if (typeof queueMicrotask === 'function') queueMicrotask(flush);
            else Promise.resolve().then(flush).catch(() => setTimeout(flush, 0));
        } catch {}
    }

    function __bf2760HomeV5DiscoverFromNode(node) {
        try {
            if (!node || node.nodeType !== 1 || !__bf2760HomeV5Active()) return false;
            const state = __bf2760HomeV5State();
            let found = false;
            const add = (article) => {
                if (!article?.isConnected || article.tagName !== 'ARTICLE') return;
                state.mutationArticles.add(article);
                found = true;
            };
            if (node.matches?.('article')) add(node);
            else {
                const closestArticle = node.closest?.('article');
                if (closestArticle) add(closestArticle);
            }
            const articles = node.querySelectorAll?.('article') || [];
            const limit = Math.min(articles.length, 24);
            for (let i = 0; i < limit; i++) add(articles[i]);
            if (found) __bf2760HomeV6EScheduleMutationFlush();
            return found;
        } catch {}
        return false;
    }

    function __bf2760HomeV5PickCandidate() {
        try {
            const state = __bf2760HomeV5State();
            if (!state.queue.length || Date.now() < state.scrollUntil || Date.now() < state.userInputUntil) return null;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 900;
            let bestIndex = -1;
            let bestScore = Infinity;
            const now = performance.now();
            const compactedQueue = [];
            const idleFor = Date.now() - Math.max(state.lastScrollAt || 0, state.lastUserInputAt || 0);

            for (const entry of state.queue) {
                const article = entry?.article;
                if (!article?.isConnected) { state.queuedIDs.delete(entry?.id || ''); state.queuedArticles.delete(article); continue; }
                const currentID = __bf2760HomeV5GetArticlePostID(article);
                if (!currentID || currentID !== entry.id || (state.articleGenerations.get(article) || 0) !== entry.generation) {
                    state.queuedIDs.delete(entry.id); state.queuedArticles.delete(article); continue;
                }

                if (networkFeedApprovedPostIDs.has(entry.id)) {
                    state.queuedIDs.delete(entry.id);
                    state.queuedArticles.delete(article);
                    __bf2760HomeV5RestoreArticle(article);
                    continue;
                }

                const compactedIndex = compactedQueue.length;
                compactedQueue.push(entry);
                if ((entry.notBefore || 0) > now) continue;
                const rect = article.getBoundingClientRect?.();
                if (!rect) continue;
                const hasMore = __bf2760HomeV5HasMoreButton(article);
                const belowSafe = rect.top > viewportHeight * 1.50;
                const aboveSafe = rect.bottom < -viewportHeight * 1.35;
                if (hasMore && !belowSafe && !aboveSafe) continue;
                if (hasMore && aboveSafe && idleFor < 1800) continue;

                let score;
                if (!hasMore) {
                    const distance = rect.top > viewportHeight ? rect.top - viewportHeight : (rect.bottom < 0 ? -rect.bottom : 0);
                    score = distance + Math.max(0, (entry.attempts || 0) * 80);
                } else if (belowSafe) {
                    score = Math.max(0, rect.top - viewportHeight) + Math.max(0, (entry.attempts || 0) * 120);
                } else {
                    score = 100000 + Math.abs(rect.bottom) + Math.max(0, (entry.attempts || 0) * 150);
                }
                score -= Math.min(800, Math.max(0, now - (entry.enqueuedAt || now)) * 0.05);
                if (score < bestScore) { bestScore = score; bestIndex = compactedIndex; }
            }

            if (bestIndex < 0) { state.queue = compactedQueue; return null; }
            const selected = compactedQueue[bestIndex] || null;
            state.queue = compactedQueue.filter((_, index) => index !== bestIndex);
            return selected;
        } catch {}
        return null;
    }

    function __bf2760HomeV5HasMoreButton(article) {
        try {
            if (!article) return false;
            const nodes = article.querySelectorAll?.('button, [role="button"], span') || [];
            const limit = Math.min(nodes.length, 64);
            for (let i = 0; i < limit; i++) {
                const text = __bf2760HomeV5Normalize(nodes[i]?.textContent);
                if (text === 'more' || text === 'lisää' || text === 'more...' || text === 'lisää...') return true;
            }
        } catch {}
        return false;
    }

    function __bf2760HomeV6CFindLessButton(article) {
        try {
            if (!article) return null;
            const nodes = article.querySelectorAll?.('[role="button"], button, span') || [];
            const limit = Math.min(nodes.length, 72);
            for (let i = 0; i < limit; i++) {
                const text = __bf2760HomeV5Normalize(nodes[i]?.textContent);
                if (text === 'less' || text === 'show less' || text === 'vähemmän' || text === 'näytä vähemmän' || text === 'näytä vähemmän...') return nodes[i];
            }
        } catch {}
        return null;
    }

    function __bf2760HomeV5CheapContentCheck(article) {
        try {
            return articleHasBannedCaption(article);
        } catch { return false; }
    }

    function __bf2760HomeV5ExpandAndScan(article, id, generation) {
        return new Promise(resolve => {
            const scanState = __bf2760HomeV5State();
            const inputSerial = scanState.userInputSerial;
            let expanded = false;
            let finished = false;
            const done = (result) => {
                if (finished) return;
                finished = true;
                resolve(result);
            };
            const identityValid = () => {
                try {
                    const state = __bf2760HomeV5State();
                    return !!article?.isConnected &&
                        __bf2760HomeV5GetArticlePostID(article) === id &&
                        (state.articleGenerations.get(article) || 0) === generation;
                } catch { return false; }
            };
            const scanActive = () => {
                try { return identityValid() && __bf2760HomeV5Active() && !document.hidden; } catch { return false; }
            };
            const stillSafeToExpand = () => {
                try {
                    const state = __bf2760HomeV5State();
                    if (!scanActive() || state.userInputSerial !== inputSerial || Date.now() < state.userInputUntil) return false;
                    const rect = article.getBoundingClientRect?.();
                    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 900;
                    const belowSafe = rect.top > viewportHeight * 1.55;
                    const aboveSafe = rect.bottom < -viewportHeight * 1.35 &&
                        Date.now() - Math.max(state.lastScrollAt || 0, state.lastUserInputAt || 0) >= 1800;
                    return !!rect && (belowSafe || aboveSafe);
                } catch { return false; }
            };
            const collapse = () => {
                try {
                    if (!expanded || !identityValid()) return false;
                    const less = __bf2760HomeV6CFindLessButton(article);
                    if (!less) return false;
                    try { less.click(); return true; } catch { return false; }
                } catch { return false; }
            };

            try {
                if (!scanActive() || !stillSafeToExpand()) return done('retry');
                const button = Array.from(article.querySelectorAll('[role="button"], button, span')).find(el => {
                    const text = __bf2760HomeV5Normalize(el?.textContent);
                    return text === 'more' || text === 'lisää' || text === 'more...' || text === 'lisää...';
                });
                // The caller observed More/Lisää. If React removed it before the click,
                // the caption is still in a hydration transition; retry rather than
                // turning that race into a permanent clean decision.
                if (!button) return done('retry');

                try { button.click(); expanded = true; } catch { return done('retry'); }
                const startedAt = performance.now();

                const poll = () => {
                    try {
                        if (!identityValid()) return done('retry');
                        if (!scanActive() || !stillSafeToExpand()) {
                            collapse();
                            return done('retry');
                        }
                        if (__bf2760HomeV5CheapContentCheck(article)) {
                            collapse();
                            return done('banned');
                        }

                        const less = __bf2760HomeV6CFindLessButton(article);
                        const moreStillPresent = __bf2760HomeV5HasMoreButton(article);
                        const expansionObserved = !!less || !moreStillPresent;
                        if (expansionObserved) {
                            collapse();
                            return done('clean-expanded');
                        }

                        if (performance.now() - startedAt >= 760) {
                            collapse();
                            return done('retry');
                        }
                        setTimeout(poll, 60);
                    } catch {
                        collapse();
                        done('retry');
                    }
                };
                setTimeout(poll, 60);
            } catch {
                collapse();
                done('retry');
            }
        });
    }

    function __bf2760HomeV5RunOne() {
        try {
            const state = __bf2760HomeV5State();
            if (!__bf2760HomeV5Active() || document.hidden || state.scanning || !state.queue.length) return;
            const candidate = __bf2760HomeV5PickCandidate();
            if (!candidate) return;

            const { article, id, generation } = candidate;
            state.queuedIDs.delete(id);
            state.queuedArticles.delete(article);
            if (!article?.isConnected || __bf2760HomeV5GetArticlePostID(article) !== id || (state.articleGenerations.get(article) || 0) !== generation) {
                __bf2760HomeV5SchedulePump(80);
                return;
            }

            state.scanning = true;
            state.scanArticle = article;
            state.scanID = id;
            state.scanGeneration = generation;

            const hasMore = __bf2760HomeV5HasMoreButton(article);
            const beforeBanned = __bf2760HomeV5CheapContentCheck(article);
            const candidateAge = performance.now() - Number(candidate.enqueuedAt || performance.now());
            let work;
            if (beforeBanned) {
                work = Promise.resolve('banned');
            } else if (hasMore) {
                work = __bf2760HomeV5ExpandAndScan(article, id, generation);
            } else if (candidateAge < 520) {
                // Give a freshly inserted React article a short hydration window before
                // declaring a no-More caption fully visible. Late mutations still revoke
                // a stable approval if More/Lisää or banned text subsequently appears.
                work = Promise.resolve('retry-hydration');
            } else {
                work = Promise.resolve('clean-stable');
            }

            work.then(result => {
                try {
                    if (!__bf2760HomeV5Active() || document.hidden) return;
                    if (!article?.isConnected || __bf2760HomeV5GetArticlePostID(article) !== id || (state.articleGenerations.get(article) || 0) !== generation) return;
                    if (result === 'retry' || result === 'retry-hydration') {
                        __bf2760HomeV6CRequeueCandidate(candidate, result === 'retry-hydration' ? 240 : 550);
                        return;
                    }
                    if (result === 'clean-stable' || result === 'clean-expanded') {
                        // MAIN-world classification can complete while DOM verification
                        // is already in flight, so structured rejects win at commit time.
                        if (networkFeedRejectedPostIDs.has(id)) {
                            __bf2760HomeV5Reject(article, id, true);
                        } else if (__bf2760HomeV5ImmediateRejectSignal(article, id)) {
                            __bf2760HomeV5Reject(article, id, true);
                        } else if (networkFeedApprovedPostIDs.has(id)) {
                            __bf2760HomeV5RestoreArticle(article);
                        } else if (__bf2760HomeV5CheapContentCheck(article)) {
                            __bf2760HomeV5Reject(article, id, true);
                        } else {
                            __bf2760HomeV5Approve(article, id, result === 'clean-expanded' ? 'expanded' : 'stable');
                        }
                    } else if (result === 'banned') {
                        __bf2760HomeV5Reject(article, id, true);
                    } else {
                        __bf2760HomeV6CRequeueCandidate(candidate, 700);
                    }
                } catch {
                    __bf2760HomeV6CRequeueCandidate(candidate, 850);
                }
            }).catch(() => {
                // Fail visible, not permanently approved: an exception leaves the post
                // UNKNOWN and queues a later retry instead of poisoning the Post-ID cache.
                try { __bf2760HomeV6CRequeueCandidate(candidate, 900); } catch {}
            }).finally(() => {
                state.scanning = false;
                state.scanArticle = null;
                state.scanID = null;
                state.scanGeneration = 0;
                __bf2760HomeV5SchedulePump(100);
            });
        } catch {}
    }

    function __bf2760HomeV5SchedulePump(delay = 120) {
        try {
            if (!__bf2760HomeV5Active()) return;
            const state = __bf2760HomeV5State();
            if (state.pumpScheduled) return;
            state.pumpScheduled = true;
            state.pumpTimer = setTimeout(() => {
                state.pumpTimer = null;
                state.pumpScheduled = false;
                const run = () => __bf2760HomeV5RunOne();
                try {
                    if (typeof requestIdleCallback === 'function') {
                        state.idleHandle = requestIdleCallback(run, { timeout: 500 });
                    } else {
                        run();
                    }
                } catch { run(); }
            }, Math.max(0, delay));
        } catch {}
    }

    function __bf2760HomeV5ScheduleReconcile(delay = 300) {
        try {
            if (!__bf2760HomeV5Active()) return;
            const state = __bf2760HomeV5State();
            const wait = Math.max(0, delay);
            const dueAt = Date.now() + wait;
            if (state.reconcileTimer !== null && state.reconcileDueAt && state.reconcileDueAt <= dueAt) return;
            if (state.reconcileTimer !== null) { try { clearTimeout(state.reconcileTimer); } catch {} }
            state.reconcileDueAt = dueAt;
            state.reconcileTimer = setTimeout(() => {
                state.reconcileTimer = null;
                state.reconcileDueAt = 0;
                __bf2760HomeV5ReconcileVisible();
                if (__bf2760HomeV5Active()) __bf2760HomeV5ScheduleReconcile(1800);
            }, wait);
        } catch {}
    }

    function __bf2760HomeV5ReconcileVisible() {
        try {
            if (!__bf2760HomeV5Active() || document.hidden) return;
            const state = __bf2760HomeV5State();
            const root = state.root || document.querySelector('main');
            if (!root) return;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 900;
            const articles = root.querySelectorAll?.('article') || [];
            let seen = 0;
            for (const article of articles) {
                if (!article?.isConnected) continue;
                const rect = article.getBoundingClientRect?.();
                if (!rect) continue;
                if (rect.bottom < -viewportHeight * 1.10 || rect.top > viewportHeight * 1.75) continue;
                __bf2760HomeV5ReconcileArticle(article, true);
                if (++seen >= 12) break;
            }
            __bf2760HomeV5ProcessRetirements(12);
            __bf2760HomeV5SchedulePump(90);
        } catch {}
    }

    function __bf2760HomeV5EnsureObserver() {
        try {
            if (!__bf2760HomeV5Active()) { __bf2760HomeV5Cleanup(); return null; }
            const state = __bf2760HomeV5State();
            const root = document.querySelector('main');
            if (!root) return null;
            let created = false;

            if (state.root !== root || !state.observer) {
                try { state.observer?.disconnect(); } catch {}
                state.root = root;
                state.route = location.href;
                created = true;
                state.observer = trackObserver(new MutationObserver(mutations => {
                    if (!__bf2760HomeV5Active() || document.hidden) return;
                    let found = false;
                    for (const mutation of mutations) {
                        // Ignore scanner-owned More/Lisää hydration. The serialized scan
                        // validates ID/generation itself; feeding those mutations back into
                        // discovery only creates redundant work and flicker opportunities.
                        let mutationArticle = null;
                        try { mutationArticle = mutation?.target?.closest?.('article') || null; } catch {}
                        if (state.scanning && mutationArticle && mutationArticle === state.scanArticle) continue;

                        if (mutation?.target?.nodeType === 1 && __bf2760HomeV5DiscoverFromNode(mutation.target)) found = true;
                        if (!mutation.addedNodes?.length) continue;
                        for (const node of mutation.addedNodes) {
                            if (node?.nodeType !== 1) continue;
                            if (__bf2760HomeV5DiscoverFromNode(node)) found = true;
                        }
                    }
                    if (found) __bf2760HomeV5SchedulePump(80);
                }));
                state.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });

                const existing = root.querySelectorAll?.('article') || [];
                const limit = Math.min(existing.length, 18);
                for (let i = 0; i < limit; i++) {
                    state.dirtyArticles.add(existing[i]);
                    __bf2760HomeV5ReconcileArticle(existing[i], true);
                }
            }

            // Do the expensive near-viewport pass only when a root/observer is newly
            // installed. Repeated bootstrap/interval calls merely ensure the owner exists;
            // the coordinator's own reconcile timer handles steady-state maintenance.
            if (created) __bf2760HomeV5ReconcileVisible();
            __bf2760HomeV5ScheduleReconcile(700);
            return state.observer;
        } catch {}
        return null;
    }

    function __bf2760HomeV5Cleanup() {
        try {
            const state = __bf2760HomeV5State();
            try { state.observer?.disconnect(); } catch {}
            state.observer = null;
            state.root = null;
            state.queue.length = 0;
            state.queuedIDs.clear();
            state.queuedArticles = new WeakSet();
            for (const article of Array.from(state.retirementArticles)) {
                try { __bf2760HomeV5RestoreArticle(article); } catch {}
            }
            for (const article of Array.from(state.retiredArticles)) {
                try { __bf2760HomeV5RestoreArticle(article); } catch {}
            }
            state.retirementArticles.clear();
            state.retiredArticles.clear();
            state.tombstones = new WeakMap();
            state.collapseFailedIDs.clear();
            state.missingIDSince = new WeakMap();
            state.articleFingerprints = new WeakMap();
            state.dirtyArticles = new WeakSet();
            state.mutationArticles.clear();
            state.mutationFlushScheduled = false;
            state.scanning = false;
            state.scanArticle = null;
            state.scanID = null;
            state.scanGeneration = 0;
            if (state.pumpTimer !== null) { try { clearTimeout(state.pumpTimer); } catch {} }
            if (state.reconcileTimer !== null) { try { clearTimeout(state.reconcileTimer); } catch {} }
            if (state.idleHandle !== null && typeof cancelIdleCallback === 'function') { try { cancelIdleCallback(state.idleHandle); } catch {} }
            state.pumpTimer = null;
            state.reconcileTimer = null;
            state.reconcileDueAt = 0;
            state.idleHandle = null;
            state.scrollUntil = 0;
            state.userInputUntil = 0;
            state.lastScrollAt = 0;
            state.lastUserInputAt = 0;
            state.pumpScheduled = false;
        } catch {}
    }

    // Public bridge used by the existing observer/bootstrap code. V6E keeps this
    // coordinator the sole Home-feed owner; non-Home surfaces keep original scanners.
    function inspectAddedHomeFeedArticlesV27(node) {
        if (__bf2760HomeV5Active()) __bf2760HomeV5DiscoverFromNode(node);
    }

    function enqueueHomeFeedMutation(mutation) {
        if (!__bf2760HomeV5Active()) return false;
        if (!mutation?.addedNodes?.length) return false;
        let found = false;
        for (const node of mutation.addedNodes) {
            if (node?.nodeType === 1 && __bf2760HomeV5DiscoverFromNode(node)) found = true;
        }
        return found;
    }

    function scheduleHomeFeedDirtyScan() {
        __bf2760HomeV5SchedulePump(80);
    }

    function ensureHomeFeedPrepaintObserverV27() {
        return __bf2760HomeV5EnsureObserver();
    }

    function watchForHomeFeedRootV27() {
        if (__bf2760HomeV5Active()) __bf2760HomeV5EnsureObserver();
    }

    function ensureIGFeedArticleObserver() {
        return __bf2760HomeV5Active() ? __bf2760HomeV5EnsureObserver() : null;
    }

    function observeIGFeedArticles() {
        return __bf2760HomeV5Active() ? __bf2760HomeV5EnsureObserver() : null;
    }

    function cleanupIGFeedArticleObserver() {
        try { __bf2760HomeV5Cleanup(); } catch {}
    }

    // ===== v27.6.0 V6E HOME-FEED OBSERVER OVERRIDE =====
    function observerCallback(mutationsList) {
        const isHomeFeed = isMetaManglerHomeFeedPath();
        if (document.hidden) return;

        if (isHomeFeed) {
            // The dedicated coordinator observer is the sole Home-feed discovery owner.
            // This legacy/bootstrap observer intentionally performs no article scan and
            // does not re-run coordinator setup for every hydration mutation.
            const state = __bf2760HomeV5State();
            if (!state.observer || !state.root?.isConnected) __bf2760HomeV5EnsureObserver();
            return;
        }

        // Preserve the pre-V5 non-Home observer behavior without touching the Home Feed.
        updateMetaManglerFeedGateClass();
        updateMetaManglerAccountEditClassV43();
        if (location.hostname.includes('instagram.com') && isMetaManglerStoryTrayPathV45()) {
            ensureInstagramStoryTrayObserverV48();
        }
        let hasAddedElement = false;
        try {
            for (const mutation of mutationsList || []) {
                if (!mutation?.addedNodes?.length) continue;
                for (const node of mutation.addedNodes) {
                    if (node?.nodeType === 1) { hasAddedElement = true; break; }
                }
                if (hasAddedElement) break;
            }
        } catch { hasAddedElement = true; }
        if (!hasAddedElement) return;

        injectMinimalNoGlimpseNavCSS();
        hideIGAccountEditSectionsV43();
        hideProfileThreadsTags();
        updateOverlayState();
        makeOverlayLikesClickable();
        fastSynchronousHider(mutationsList);
        if (observerScheduled) return;
        observerScheduled = true;
        addTimeout(() => {
            observerScheduled = false;
            if (isReelsPage()) return;
            if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
                hideInstagramAccountsFromList();
                return;
            }
            if (isExcludedPath()) {
                collapseElementsOnExcludedPaths();
                return;
            }
            if (isMetaManglerHomeFeedPath()) {
                __bf2760HomeV5EnsureObserver();
                hideProfileThreadsTags();
                hideHomeFeedFooterLinks();
                hideUnwantedUIButtons();
                ensureInstagramStoryTrayObserverV48();
                hideBannedInstagramStoryAccounts();
                compactBannedInstagramStorySlots();
            } else {
                collapseElementsBySelectors(selectorsToHide);
                hideProfileThreadsTags();
                processFeedPostsForScanning();
                collapseElementsByKeywordsOrPaths(keywordsToHide, instagramBannedPaths, selectorsToMonitor);
                if (location.hostname.includes('instagram.com')) {
                    hideIGAccountEditSectionsV43();
                    hideUnwantedUIButtons();
                    ensureInstagramStoryTrayObserverV48();
                    hideBannedInstagramStoryAccounts();
                    compactBannedInstagramStorySlots();
                    if (isSearchSurfacePresent()) hideInstagramSearchResults();
                }
            }
            hideUnfollowRowInProfileDialog();
            updateOverlayState();
            scanPermalinkArticleAndAct();
            prunePostCaches();
        }, 450);
    }

    if (!window.__bf2760HomeV6EInputHookInstalled) {
        window.__bf2760HomeV6EInputHookInstalled = true;
        const markHomeFeedUserInputV6E = () => {
            try {
                if (!__bf2760HomeV5Active()) return;
                const state = __bf2760HomeV5State();
                state.userInputSerial++;
                state.lastUserInputAt = Date.now();
                state.userInputUntil = state.lastUserInputAt + 220;
            } catch {}
        };
        onEvent(window, 'wheel', markHomeFeedUserInputV6E, { capture: true, passive: true });
        onEvent(window, 'touchmove', markHomeFeedUserInputV6E, { capture: true, passive: true });
        onEvent(window, 'pointerdown', markHomeFeedUserInputV6E, { capture: true, passive: true });
        onEvent(window, 'keydown', event => {
            try {
                const key = String(event?.key || '');
                if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'PageDown' || key === 'PageUp' || key === 'Home' || key === 'End' || key === ' ') {
                    markHomeFeedUserInputV6E();
                }
            } catch {}
        }, { capture: true, passive: true });
    }

    if (!window.__bf2760HomeV6EScrollHookInstalled) {
        window.__bf2760HomeV6EScrollHookInstalled = true;
        onEvent(window, 'scroll', () => {
            if (!__bf2760HomeV5Active()) return;
            const state = __bf2760HomeV5State();
            state.lastScrollAt = Date.now();
            state.scrollUntil = state.lastScrollAt + 180;
            __bf2760HomeV5ScheduleReconcile(300);
            __bf2760HomeV5SchedulePump(320);
        }, { capture: true, passive: true });
    }

})();
