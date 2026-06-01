// ==UserScript==
// @name         FBCleaner
// @version      2026-06-01
// @description  Makes my Facebook experience less terrible. With reduced algorithmic bullshit.
// @match        *://*.facebook.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    // === CHROME DEV CONSOLE LOGGING ===
    const DEBUG = false;
    function devLog(message) {
        if (DEBUG) console.log('[FACEBOOK.JS]', message);
    }

console.log('[FBCleaner] chrome.storage.local available inside facebook.js:',
    typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local
);

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['wrestling_women_urls'], (result) => {
        console.log('[FBCleaner] wrestling_women_urls from extension storage:', result);
    });
}

    // ===== Memory/observer/timer lifecycle tracking (added) =====
    const __fbTimers = {
        intervals: new Set(),
        timeouts: new Set(),
        idleCallbacks: new Set(), // track rIC ids to avoid leaks in SPAs
    };
    const __fbObservers = new Set();
    const __fbEventCleanups = new Set();
    let __fbCleanupRan = false;

    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        __fbTimers.intervals.add(id);
        return id;
    }
    function addTimeout(fn, ms) {
        const id = setTimeout(() => {
            __fbTimers.timeouts.delete(id);
            fn();
        }, ms);
        __fbTimers.timeouts.add(id);
        return id;
    }
    function addIdleCallback(fn) {
        // Track requestIdleCallback so we can cancel on cleanup (prevents leaks on SPA navigations)
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(() => {
                try { fn(); } finally { __fbTimers.idleCallbacks.delete(id); }
            });
            __fbTimers.idleCallbacks.add(id);
            return id;
        } else {
            // Fallback is tracked via __fbTimers.timeouts
            return addTimeout(fn, 0);
        }
    }
    function trackObserver(observer) {
        __fbObservers.add(observer);
        return observer;
    }
    function onWindowEvent(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        __fbEventCleanups.add(() => target.removeEventListener(type, handler, options));
    }

    function cleanup() {
        if (__fbCleanupRan) return;
        __fbCleanupRan = true;
        try {
            __fbTimers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
            __fbTimers.intervals.clear();

            __fbTimers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __fbTimers.timeouts.clear();

            if (typeof window.cancelIdleCallback === 'function') {
                __fbTimers.idleCallbacks.forEach(id => { try { window.cancelIdleCallback(id); } catch {} });
            }
            __fbTimers.idleCallbacks.clear();

            __fbObservers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __fbObservers.clear();

            __fbEventCleanups.forEach(fn => { try { fn(); } catch {} });
            __fbEventCleanups.clear();

            // Remove injected style to free memory in long-lived SPA sessions
            try {
                const s = document.getElementById('fb-inline-style');
                if (s) s.remove();
            } catch {}
            try {
                const s2 = document.getElementById('fb-specific-url-style');
                if (s2) s2.remove();
            } catch {}
            try {
                const s3 = document.getElementById('fb-specific-profile-style');
                if (s3) s3.remove();
            } catch {}
            try {
                const s4 = document.getElementById('fb-specific-url-prehide-style');
                if (s4) s4.remove();
            } catch {}
            try {
                const s5 = document.getElementById('fb-safe-noglimpse-bootstrap-v2');
                if (s5) s5.remove();
            } catch {}
            try {
                const s6 = null;
                if (s6) s6.remove();
            } catch {}
            try {
                const s7 = document.getElementById('fb-likes-overlay-softgate-style-v5');
                if (s7) s7.remove();
            } catch {}
            try {
                const s8 = document.getElementById('fb-top-search-dropdown-protect-style-v9');
                if (s8) s8.remove();
            } catch {}
            try {
                const s9 = document.getElementById('fb-top-search-dropdown-native-guard-v10');
                if (s9) s9.remove();
            } catch {}
            try {
                const s10 = document.getElementById('fb-top-search-dropdown-native-guard-v11');
                if (s10) s10.remove();
            } catch {}

            devLog('Cleanup complete.');
        } catch (e) {
            console.log('[FACEBOOK.JS] cleanup error: ' + e.message);
        }
    }

    // Pause background intervals when hidden (saves CPU/memory)
    let __fbIntervalsRunning = false;
    function stopIntervals() {
        __fbTimers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
        __fbTimers.intervals.clear();
        __fbIntervalsRunning = false;
    }
    function startIntervals(schedulerFn) {
        if (__fbIntervalsRunning) return;
        schedulerFn();
        __fbIntervalsRunning = true;
    }

    // Throttle helper (added)
    function createThrottle(fn, wait) {
        let last = 0;
        let trailingTimeout = null;
        return function throttled(...args) {
            const now = performance.now();
            const remaining = wait - (now - last);
            const call = () => { last = performance.now(); fn.apply(this, args); };
            if (remaining <= 0) {
                if (trailingTimeout) { clearTimeout(trailingTimeout); __fbTimers.timeouts.delete(trailingTimeout); trailingTimeout = null; }
                call();
            } else if (!trailingTimeout) {
                trailingTimeout = addTimeout(call, remaining);
            }
        };
    }

    // Variable to cache redirects
    let lastRedirect = null;
    let isRedirecting = false;

    const triggerRedirect = (reason = '') => {
        try {
            if (isRedirecting) return;
            isRedirecting = true;
            lastRedirect = window.location.href;
            devLog('Redirecting to Facebook home' + (reason ? ': ' + reason : ''));

            try { stopIntervals(); } catch (e) {}
            try { __fbObservers.forEach(obs => { try { obs.disconnect(); } catch (e) {} }); } catch (e) {}

            let blackout = document.getElementById('fbcleaner-redirect-blackout');
            if (!blackout && document.documentElement) {
                blackout = document.createElement('div');
                blackout.id = 'fbcleaner-redirect-blackout';
                blackout.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:2147483647;';
                try { document.documentElement.appendChild(blackout); } catch (e) {}
            }

            window.onbeforeunload = null;
            window.location.replace('https://www.facebook.com/');
        } catch (e) {
            try { window.location.href = 'https://www.facebook.com/'; } catch (ignored) {}
        }
    };

    const isFBSearchPagePath = () => {
        try {
            return /\/search(?:\/|$)/i.test(location.pathname || '');
        } catch (e) {
            return false;
        }
    };

    const updateFBSearchPageClass = () => {
        try {
            const active = isFBSearchPagePath();

            // 25.1.5-style behavior: search hiding class belongs on body only.
            // Clear it from html so the top-left native search dropdown cannot get caught
            // by stale body.is-search-page CSS after SPA navigation.
            if (document.documentElement) {
                document.documentElement.classList.remove('is-search-page');
            }
            if (document.body) {
                document.body.classList.toggle('is-search-page', active);
            }
        } catch (e) {}
    };

    updateFBSearchPageClass();

    // ===== HOME FEED ZERO-GLIMPSE GATE v23 =====
    // Keep this narrow: home feed only. Profile/timeline pages have their own protections.
    const isFBHomeFeedSurfaceV23 = () => {
        try {
            const path = (location.pathname || '/').toLowerCase();
            const search = (location.search || '').toLowerCase();
            const host = (location.hostname || '').toLowerCase();
            if (!host.includes('facebook.com')) return false;
            return path === '/' || path === '/home.php' || (path === '/' && search.includes('sk=h_chr'));
        } catch (e) {
            return false;
        }
    };

    const updateFBHomeFeedGateClassV23 = () => {
        try {
            if (!document.documentElement) return;
            document.documentElement.classList.toggle('fb-home-feed-unit-softgate-v23', isFBHomeFeedSurfaceV23());
        } catch (e) {}
    };

    updateFBHomeFeedGateClassV23();

    // ===== SAFE ZERO-GLIMPSE BOOTSTRAP v2 =====
    // This replaces the too-broad "hide feed until approved" idea.
    // It does NOT hide the whole feed/page. It only prehides the Friends/Kaverit nav entry
    // and, on friends-list surfaces, keeps unprocessed profile cards invisible until the scanner approves/bans them.
    const isFBFriendsSurfacePathV2 = () => {
        try {
            const path = (location.pathname || '/').toLowerCase();
            const href = (location.href || '').toLowerCase();
            // v21: include every Facebook friend-list surface, not only /friends.
            // Examples: /Haukkis/friends, /tapio.haukirauma/friends_all/, /friends_mutual/, upcoming birthdays.
            return (
                /\/friends(?:\/|$)/i.test(path) ||
                /\/friends(?:[/?#]|$)/i.test(href) ||
                /\/friends_all(?:\/|$)/i.test(path) ||
                /\/friends_mutual(?:\/|$)/i.test(path) ||
                /\/friends_with_upcoming_birthdays(?:\/|$)/i.test(path) ||
                /\/friends_all(?:[/?#]|$)/i.test(href) ||
                /\/friends_mutual(?:[/?#]|$)/i.test(href) ||
                /\/friends_with_upcoming_birthdays(?:[/?#]|$)/i.test(href)
            );
        } catch (e) {
            return false;
        }
    };

    const updateFBFriendsSoftGateV2 = () => {
        try {
            if (!document.documentElement) return;
            document.documentElement.classList.toggle('fb-friends-card-softgate-v2', isFBFriendsSurfacePathV2());
        } catch (e) {}
    };

    const injectFBSafeNoGlimpseBootstrapV2 = () => {
        try {
            let style = document.getElementById('fb-safe-noglimpse-bootstrap-v2');
            if (!style) {
                style = document.createElement('style');
                style.id = 'fb-safe-noglimpse-bootstrap-v2';
            }

            style.textContent = `
                /* Zero-glimpse for the Friends/Kaverit left-nav button, but scoped to actual friend links. */
                a[aria-label="Kaverit"][href*="/friends"],
                a[aria-label="Friends"][href*="/friends"],
                a[href="/friends/"],
                a[href^="/friends/"],
                a[href*="facebook.com/friends"],
                li:has(> div a[aria-label="Kaverit"][href*="/friends"]),
                li:has(> div a[aria-label="Friends"][href*="/friends"]),
                li:has(> div a[href^="/friends/"]),
                div[role="navigation"] [role="listitem"]:has(a[aria-label="Kaverit"][href*="/friends"]),
                div[role="navigation"] [role="listitem"]:has(a[aria-label="Friends"][href*="/friends"]),
                div[role="navigation"] [role="listitem"]:has(a[href^="/friends/"]),
                div[role="navigation"] li:has(a[aria-label="Kaverit"][href*="/friends"]),
                div[role="navigation"] li:has(a[aria-label="Friends"][href*="/friends"]),
                div[role="navigation"] li:has(a[href^="/friends/"]) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    position: absolute !important;
                    left: -9999px !important;
                    top: -9999px !important;
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
                }

                /* Friends/profile cards: friends page only.
                   v22: include the current card shell captured from friends lists:
                   div.x78zum5.xdt5ytf.x12upk82 -> profile photo link + name link + mutual friends text.
                   These stay invisible until the scanner marks them approved/banned, preventing blocked-card glimpse. */
                html.fb-friends-card-softgate-v2 div.x78zum5.xdt5ytf.x12upk82:has(a[role="link"][href*="facebook.com"]):not(.fb-profile-card-approved):not(.fb-profile-card-banned):not(.fb-element-banned),
                html.fb-friends-card-softgate-v2 div.x78zum5.xdt5ytf.x12upk82:has(a[data-fbcleaner-urlsig*="facebook.com"]):not(.fb-profile-card-approved):not(.fb-profile-card-banned):not(.fb-element-banned) {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    transition: none !important;
                    animation: none !important;
                }

                html.fb-friends-card-softgate-v2 div.x78zum5.xdt5ytf.x12upk82.fb-profile-card-approved {
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
            `;

            if (!style.isConnected) {
                (document.head || document.documentElement).appendChild(style);
            }
        } catch (e) {}
    };

    const releaseFBFriendsSoftGateV2Soon = () => {
        try {
            addTimeout(() => {
                try {
                    // v22: do not fail-open while still on a friends-list surface.
                    // The scanner should approve safe cards and hard-hide banned cards instead.
                    if (document.documentElement && !isFBFriendsSurfacePathV2()) {
                        document.documentElement.classList.remove('fb-friends-card-softgate-v2');
                    }
                } catch (e) {}
            }, 1800);
        } catch (e) {
            try {
                setTimeout(() => {
                    if (document.documentElement && !isFBFriendsSurfacePathV2()) document.documentElement.classList.remove('fb-friends-card-softgate-v2');
                }, 1800);
            } catch (ignored) {}
        }
    };

    updateFBFriendsSoftGateV2();
    injectFBSafeNoGlimpseBootstrapV2();
    releaseFBFriendsSoftGateV2Soon();




    // ===== LIKES / REACTIONS OVERLAY SOFTGATE v5 =====
    // Narrow softgate: only compact profile rows inside reaction/likes dialogs are hidden while being scanned.
    // Safe rows are approved immediately. Banned rows stay hard-hidden. The gate auto-releases to avoid blank overlays.
    const injectFBLikesOverlaySoftGateCSSV5 = () => {
        try {
            let style = document.getElementById('fb-likes-overlay-softgate-style-v5');
            if (!style) {
                style = document.createElement('style');
                style.id = 'fb-likes-overlay-softgate-style-v5';
            }

            style.textContent = `
                html.fb-likes-overlay-softgate-v5 [role="dialog"] div[data-visualcompletion="ignore-dynamic"]:has(a[href*="facebook.com/"]):not(.fb-likes-overlay-row-approved):not(.fb-likes-overlay-row-banned):not(.fb-element-banned) {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    transition: none !important;
                    animation: none !important;
                }

                [role="dialog"] .fb-likes-overlay-row-banned,
                [role="dialog"] .fb-likes-overlay-row-banned * {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    position: absolute !important;
                    left: -9999px !important;
                    top: -9999px !important;
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
                }
            `;

            if (!style.isConnected) {
                (document.head || document.documentElement).appendChild(style);
            }
        } catch (e) {}
    };

    const activateFBLikesOverlaySoftGateV5 = () => {
        try {
            injectFBLikesOverlaySoftGateCSSV5();
            if (document.documentElement) {
                document.documentElement.classList.add('fb-likes-overlay-softgate-v5');
            }

            const release = () => {
                try {
                    if (document.documentElement) {
                        document.documentElement.classList.remove('fb-likes-overlay-softgate-v5');
                    }
                } catch (e) {}
            };

            addTimeout(release, 700);
            addTimeout(release, 1400);
        } catch (e) {}
    };

    injectFBLikesOverlaySoftGateCSSV5();


    // ENHANCED: Inject CSS immediately for instant hiding - REMOVED body visibility hidden to prevent white screen
    // UPDATED: Re-added broad default hiding to prevent flashes, only show approved posts
    const injectInlineCSS = () => {
        try {
            devLog('Injecting inline CSS with instant search hiding and anti-flashing');
            let style = document.getElementById('fb-inline-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'fb-inline-style';
            }
            style.textContent = `
            /* INSTANT SEARCH HIDING - real /search/ results only.
               Keep this scoped under [role="main"] so Facebook's native top-left search dropdown
               in the banner keeps its own layout and does not need artificial approval/protection. */
            body.is-search-page [role="main"] li[role="row"]:not(.fb-search-approved),
            body.is-search-page [role="main"] a[aria-describedby]:not(.fb-search-approved),
            body.is-search-page [role="main"] div[role="option"]:not(.fb-search-approved),
            body.is-search-page [role="main"] div[data-testid="search-result"]:not(.fb-search-approved),
            body.is-search-page [role="main"] div[role="presentation"] a:not(.fb-search-approved) {
                visibility: hidden !important;
                opacity: 0 !important;
                display: none !important;
                pointer-events: none !important;
            }
            
            /* Show only approved real /search/ page results. */
            body.is-search-page [role="main"] li[role="row"].fb-search-approved,
            body.is-search-page [role="main"] a[aria-describedby].fb-search-approved,
            body.is-search-page [role="main"] div[role="option"].fb-search-approved,
            body.is-search-page [role="main"] div[data-testid="search-result"].fb-search-approved,
            body.is-search-page [role="main"] div[role="presentation"] a.fb-search-approved {
                visibility: visible !important;
                opacity: 1 !important;
                display: block !important;
                pointer-events: auto !important;
            }
            
            /* Permanently hide banned search results */
            .fb-search-banned {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
            }

            /* Permanently hide banned posts and elements */
            .fb-post-banned,
            .fb-element-banned {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }

            /* ANTI-FLASHING: Hide critical elements by default immediately with content-visibility */
            div[aria-label="People You May Know"],
            div[aria-label="Ihmisiä, jotka saatat tuntea"],
            a[href="https://www.facebook.com/friends/suggestions/"],
            div[aria-label="Näytä suosituksia"],
            [aria-label="Näytä suositukset"],
            [role="button"][aria-label="Näytä suositukset"],  
            /* v19: zero-glimpse hide the Finnish "Remove from friends" menu item.
               Facebook exposes this dropdown as role="menuitem" with a specific remove-person SVG,
               so hide by structure/icon before JS text scanning gets a paint chance. */
            div[role="menuitem"]:has(svg path[d^="M9.248 1a4.248"]),
            div[role="menuitem"]:has(svg path[d*="18.78 17.72"]),
            a[aria-label="Meta AI"],
            div[aria-label="Meta AI"],
            a[href="/Meta AI/"],
            li:has(a[aria-label="Kaverit"][href*="/friends"]),
            li:has(a[aria-label="Friends"][href*="/friends"]),
            a[href="/friends/"],
            div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12 2.5a9.5"]),
            div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12%202.5a9.5"]),
            a[aria-label="Näytä kaikki"] > span.x193iq5w.xeuugli.x13faqbe,
            /* More specific Meta AI selectors */
            a[aria-label="Meta AI"],
            div[aria-label="Meta AI"],
            span[aria-label="Meta AI"],
            /* v20: Meta AI refresh-time sprite fallback, narrowed to the 36px shortcut row.
               The same 7Md5shK5dH8.webp sprite is reused by harmless profile-header controls
               (for example the "Näytä kaikki" friend-strip button at 16px), so do NOT hide the raw sprite globally. */
            div.html-div[style*="--x-rowGap"]:has(i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"]),
            div.x9f619.x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.x1qughib.x6s0dn4.xozqiw3.x1q0g3np:has(i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"]),
            /* Meta AI contact links */
            a[href*="/messages/t/36327,2227039302/"],
            a[href*="messages/t/36327"],
            /* Friends-related links */
            a[href*="meta.ai"], a[href="/Meta AI/"], a[href="/friends/"],
            a[role="link"][href="/friends/"], a[role="link"][aria-label="Kaverit"], a[role="link"][aria-label="Friends"],
            img[src*="w5I9ktz_3Ib.png"],
            li.x1iyjqo2.xmlsiyf.x1hxoosp.x1l38jg0.x1awlv9s.x1i64zmx.x1gz44f,
            .x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1),
            div.x1i10hfl:nth-child(13),
            div.x1i10hfl:nth-child(13) > div:nth-child(1),
            div.x1i10hfl:nth-child(13) > div:nth-child(2),
            div.x1i10hfl:nth-child(13) > div:nth-child(3),
            .x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty),
            svg[aria-label="Meta AI:n profiilikuva"],
            svg[aria-label*="Meta AI profile"],
            div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12%202.5a9.5"]),
            div.x1gefphp.xf7dkkf.x1l90r2v.xv54qhq.xyamay9.x1e56ztr.x78zum5.x9f619.x1olyfxc.x15x8krk.xde0f50.x5a5i1n.x1obq294.x6s0dn4:nth-of-type(6),
            .xjkvuk6.x1iorvi4.x1qughib.x78zum5.x6s0dn4,
            .x1vjfegm.x1iyjqo2,
            div.x1a02dak:nth-child(3) > div:nth-child(1),
            div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1),
            div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1),
            .x1ye3gou.x1120s5i.xn6708d.xz9dl7a.x1qughib.x1q0g3np.x78zum5,
            .xbbxn1n.xwxc41k.xxbr6pl.x1p5oq8j.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div,
            .x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo,
            /* ENHANCED: All PYMK selectors for instant hiding */
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6,
            .x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d,
            svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq,
            div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j,
            div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z,
            div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo {
                visibility: hidden !important; /* Instantly make elements invisible */
                display: none !important; /* Fully remove them */
                opacity: 0 !important; /* Triple-layer hiding */
                pointer-events: none !important; /* Prevent interaction */
                content-visibility: hidden !important; /* Prevent rendering until shown */
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
            /* Additional aggressive hiding for persistent elements */
            a[href="/friends/"],
            a[aria-label="Meta AI"],
            div[aria-label="Meta AI"] {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                content-visibility: hidden !important; /* Anti-flashing */
            }
            /* ENHANCED: Hide all posts by default to prevent flashes, only show approved ones */
            [role="article"]:not(.fb-post-approved),
            [role="article"].x1lliihq:not(.fb-post-approved),
            [role="article"] .x1yztbdb:not(.fb-post-approved),
            [role="article"] .x1hc1fzr:not(.fb-post-approved),
            div.x1iyjqo2.x1vjfegm:not(.fb-post-approved) {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                content-visibility: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }

            /* v23 home-feed FeedUnit softgate.
               Facebook can paint the FeedUnit wrapper before [role=article] receives/keeps classes.
               On the home feed, hide FeedUnit shells until JS approves/bans them. */
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:not(.fb-feed-unit-approved):not(.fb-post-approved):not(.fb-post-banned):not(.fb-element-banned),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:not(.fb-feed-unit-approved):not(.fb-post-approved):not(.fb-post-banned):not(.fb-element-banned) {
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                content-visibility: hidden !important;
                transition: none !important;
                animation: none !important;
            }

            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"].fb-feed-unit-approved,
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"].fb-post-approved,
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"].fb-feed-unit-approved,
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"].fb-post-approved {
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                content-visibility: visible !important;
            }

            /* v23 immediate structural nukes from captured HTML.
               Mid-feed Reels: FeedUnit with Reels/Kelat region or /reel/ carousel links.
               Join/Follow cards: inline small CTA button wrappers from captured Liity/Seuraa snippets. */
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has([aria-label="Kelat"][role="region"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has([aria-label="Reels"][role="region"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has(a[href^="/reel/"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has(a[aria-label^="Kela käyttäjältä"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has(a[aria-label^="Reel by"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:has([aria-label="Kelat"][role="region"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:has([aria-label="Reels"][role="region"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:has(a[href^="/reel/"]),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has(span.xdwrcjd.xuxw1ft > div[role="button"] > span.x1fey0fg),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has(span.x3nfvp2 > div[role="button"] > span.x1fey0fg),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:has(span.xdwrcjd.xuxw1ft > div[role="button"] > span.x1fey0fg),
            html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:has(span.x3nfvp2 > div[role="button"] > span.x1fey0fg) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
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


            /* v20 profile header safe island.
               Facebook reuses "Kaverit", "Näytä suositukset", and the 7Md5 sprite inside legitimate
               profile headers. Keep the header/name/photo/action area visible while still hiding left-nav Friends/Meta AI. */
            [data-pagelet="ProfileActions"],
            [data-pagelet="ProfileActions"] *,
            h1,
            h1 *,
            a[aria-label][href*="/photo/?fbid="],
            a[aria-label][href*="/photo/?fbid="] *,
            svg[role="img"][style*="168px"],
            svg[role="img"][style*="168px"] *,
            a[href*="/friends_all/"],
            a[href*="/friends_all/"] *,
            a[href*="/friends_mutual/"],
            a[href*="/friends_mutual/"] * {
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                content-visibility: visible !important;
            }
            `;
            // Safe append (no document.write)
            if (!style.isConnected) {
                if (document.head) {
                    document.head.appendChild(style);
                    devLog('CSS injected to head');
                } else if (document.documentElement) {
                    document.documentElement.appendChild(style);
                    devLog('CSS injected to documentElement');
                }
            } else {
                devLog('CSS updated (reuse existing style node)');
            }
        } catch (err) {
            console.log('Error while injecting CSS: ' + err.message);
            try {
                const styleTag = document.createElement('style');
                styleTag.id = 'fb-inline-style-fallback';
                styleTag.textContent = `a[aria-label="Kaverit"][href*="/friends"], a[aria-label="Friends"][href*="/friends"], a[href="/friends/"] { display: none !important; }`;
                (document.head || document.documentElement).appendChild(styleTag);
                devLog('Fallback CSS injected (safe append)');
            } catch (e) {
                console.log('Fallback CSS injection failed: ' + e.message);
            }
        }
    };
    
    // Run CSS injection immediately
    injectInlineCSS();



    // v20: early profile header safe island.
    // Protects profile/page name, profile picture, friend count, and ProfileActions from early
    // critical/zero-glimpse hiders. The captured header has no stable outer data-pagelet in every
    // render, but it reliably contains ProfileActions, h1 title, large 168px profile SVG/image,
    // friends_all/friends_mutual links, and profile action buttons.
    const isProbablyProfileHeaderSafeElementV20 = (el) => {
        try {
            if (!el || !el.closest) return false;
            if (el.closest('[data-pagelet="ProfileHeader"], [data-pagelet="PageHeader"], [data-pagelet="ProfileActions"]')) return true;
            if (el.querySelector && el.querySelector('[data-pagelet="ProfileActions"]')) return true;
            if (el.closest('h1, h1 *')) return true;
            if (el.closest('a[aria-label][href*="/photo/?fbid="], a[aria-label][href*="photo/?fbid="], svg[role="img"][style*="168px"], svg[role="img"][style*="height:168px"], image[style*="168px"]')) return true;
            if (el.closest('a[href*="/friends_all/"], a[href*="/friends_mutual/"], span[aria-label="Korostetut tiedot"], span[aria-label="Featured details"]')) return true;
            if (el.closest('[role="button"][aria-label="Kaverit"], [role="button"][aria-label="Friends"], [role="button"][aria-label="Lähetä viesti"], [role="button"][aria-label="Message"]')) return true;

            // Ancestor being considered for hiding: if it contains core profile-header signals, treat it as safe.
            if (el.querySelector) {
                if (el.querySelector('[data-pagelet="ProfileActions"], h1, svg[role="img"][style*="168px"], a[href*="/friends_all/"], a[href*="/friends_mutual/"]')) return true;
            }
        } catch (e) {}
        return false;
    };

    // v13: Early cheap guard for Facebook's native top-left search dropdown.
    // This lives before the full dropdown detector exists, because hideCriticalElements()
    // runs immediately at document-start. It only checks tiny local structure and viewport.
    const isProbablyNativeTopSearchDropdownNodeEarlyV13 = (el) => {
        try {
            if (!el || !el.closest) return false;
            const row = el.closest('li[role="row"]');
            if (!row) return false;
            const anchor = row.querySelector('a[aria-describedby], a[href*="__epa__=SEARCH_BOX"], a[href*="/search/top/"]');
            const deleteTarget = row.querySelector('[title*="Poista" i], [aria-label*="Poista" i], [title*="Remove" i], [aria-label*="Remove" i], [title*="Delete" i], [aria-label*="Delete" i], svg[title*="Poista" i], svg[title*="Remove" i], svg[title*="Delete" i]');
            if (!anchor && !deleteTarget) return false;
            const rect = row.getBoundingClientRect ? row.getBoundingClientRect() : null;
            if (!rect || rect.width <= 0 || rect.height <= 0) return false;
            return rect.top < 700 && rect.left < 980;
        } catch (e) {
            return false;
        }
    };


    // v18: fast Meta AI row scrubber.
    // Facebook sometimes renders the left-nav Meta AI shortcut as plain text + a CSS image sprite,
    // without aria-label/href. CSS handles most of the zero-glimpse; this catches late React re-renders.
    const findMetaAIRowWrapperV18 = (seed) => {
        try {
            if (!seed) return null;
            let node = seed;
            let best = null;
            const looksLikeMetaAIText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'meta ai';

            for (let depth = 0; node && node !== document.body && node !== document.documentElement && depth < 9; depth++, node = node.parentElement) {
                if (!node || !node.querySelector) continue;
                if (node.matches && node.matches('main, [role="main"], [role="feed"], header, [role="banner"], nav, [role="navigation"]')) break;
                if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(node)) return null;
                if (isProbablyProfileHeaderSafeElementV20(node)) return null;

                const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
                const hasMetaText = looksLikeMetaAIText(text) || !!Array.from(node.querySelectorAll('span[dir="auto"], span.x1lliihq')).some(span => looksLikeMetaAIText(span.textContent));
                const hasMetaIcon = !!node.querySelector('i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"]');
                const isCompactRow = !!(
                    node.matches && (
                        node.matches('a, [role="link"], [role="button"], li, [role="listitem"]') ||
                        (node.classList && node.classList.contains('x9f619') && node.classList.contains('x78zum5')) ||
                        (node.classList && node.classList.contains('html-div') && String(node.getAttribute('style') || '').includes('--x-rowGap'))
                    )
                );

                // Require actual Meta AI text. The sprite alone is not unique; Facebook also uses it in profile headers.
                if (hasMetaText && (hasMetaIcon || isCompactRow)) {
                    best = node;
                    if (hasMetaIcon && isCompactRow) break;
                }
            }

            return best;
        } catch (e) {
            return null;
        }
    };

    const hideMetaAITextRowsV18 = () => {
        try {
            const candidates = document.querySelectorAll([
                'i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"]',
                'span[dir="auto"]',
                'span.x1lliihq'
            ].join(','));

            candidates.forEach((candidate) => {
                try {
                    const text = String(candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                    const isMetaText = text === 'meta ai';
                    const isMetaIcon = candidate.matches && candidate.matches('i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"]');
                    if (!isMetaText && !isMetaIcon) return;

                    const wrapper = findMetaAIRowWrapperV18(candidate);
                    if (!wrapper) return;
                    if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(wrapper)) return;
                    if (isProbablyProfileHeaderSafeElementV20(wrapper)) return;
                    collapseElementHard(wrapper);
                } catch (e) {}
            });
        } catch (e) {}
    };

    // v19: fast no-glimpse scrubber for the "Poista kavereista" dropdown menu item.
    // CSS handles the first paint by matching the remove-person SVG; this JS catches
    // text-only/late React renders and keeps the item hidden during menu updates.
    const findRemoveFriendMenuItemV19 = (seed) => {
        try {
            if (!seed) return null;
            const text = String(seed.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const isRemoveFriendText = text === 'poista kavereista' || text === 'remove from friends';
            const isRemoveFriendIcon = !!(
                seed.matches &&
                seed.matches('svg path[d^="M9.248 1a4.248"], svg path[d*="18.78 17.72"]')
            );
            if (!isRemoveFriendText && !isRemoveFriendIcon) return null;

            const menuItem = seed.closest ? seed.closest('div[role="menuitem"], [role="menuitem"]') : null;
            if (!menuItem) return null;
            if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(menuItem)) return null;
            return menuItem;
        } catch (e) {
            return null;
        }
    };

    const hideRemoveFriendMenuItemsV19 = () => {
        try {
            const candidates = document.querySelectorAll([
                'div[role="menuitem"] span[dir="auto"]',
                'div[role="menuitem"] span.x1lliihq',
                'div[role="menuitem"] svg path[d^="M9.248 1a4.248"]',
                'div[role="menuitem"] svg path[d*="18.78 17.72"]'
            ].join(','));

            candidates.forEach((candidate) => {
                try {
                    const wrapper = findRemoveFriendMenuItemV19(candidate);
                    if (wrapper) collapseElementHard(wrapper);
                } catch (e) {}
            });
        } catch (e) {}
    };

    // Directly hide specific elements based on their unique selectors - Enhanced for persistence and anti-flashing
    const hideCriticalElements = () => {
        try {
            devLog('Hiding critical elements with permanent banning and anti-flashing');
            hideMetaAITextRowsV18();
            hideRemoveFriendMenuItemsV19();
            const selectors = [
                'a[href="https://www.facebook.com/friends/"]',
                'a[aria-label="Kaverit"][href*="/friends"]',
                'a[aria-label="Friends"][href*="/friends"]',
                'a[href="/friends/"]',
                'a[aria-label="Meta AI"]',
                'div[aria-label="Meta AI"]',
                'a[href="https://www.meta.ai/"]',
                'a[href="https://meta.ai/"]',
                'a[href="/Meta AI/"]',
                'svg[aria-label="Meta AI:n profiilikuva"]',
                'svg[aria-label*="Meta AI profile"]', 
                'div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12%202.5a9.5"])',
                'a[aria-label="Meta AI"]',
        	'.x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty)',
		'div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12 2.5a9.5"])',
            	'div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12%202.5a9.5"])',
                'div[aria-label="Meta AI"]',
                'span[aria-label="Meta AI"]',
                // v20: Meta AI refresh-time row fallback, narrowed to the 36px shortcut row.
                'div.html-div[style*="--x-rowGap"]:has(i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"])',
                'div.x9f619.x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.x1qughib.x6s0dn4.xozqiw3.x1q0g3np:has(i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"])',
                // v19: hide the "Poista kavereista" menuitem by remove-person SVG structure.
                'div[role="menuitem"]:has(svg path[d^="M9.248 1a4.248"])',
                'div[role="menuitem"]:has(svg path[d*="18.78 17.72"])',
		'li:has(a[aria-label="Kaverit"][href*="/friends"])',
		'li:has(a[aria-label="Friends"][href*="/friends"])',
                'svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z',
                'div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo',
                // ENHANCED: Meta AI contact specific selectors
                'a[href*="/messages/t/36327,2227039302/"]',
                'a[href*="messages/t/36327"]',
		'div.x1a02dak:nth-child(3) > div:nth-child(1)',
		'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)',
		'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
            ];

            let hiddenCount = 0;
            selectors.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => {
                    if (isProbablyNativeTopSearchDropdownNodeEarlyV13(el)) return;
                    if (isProbablyProfileHeaderSafeElementV20(el)) return;
                    if (!el.classList.contains('fb-element-banned')) {
                        el.classList.add('fb-element-banned');
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('visibility', 'hidden', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        el.style.setProperty('pointer-events', 'none', 'important');
                        el.style.setProperty('position', 'absolute', 'important');
                        el.style.setProperty('left', '-9999px', 'important');
                        el.style.setProperty('top', '-9999px', 'important');
                        el.style.setProperty('height', '0', 'important');
                        el.style.setProperty('width', '0', 'important');
                        el.style.setProperty('overflow', 'hidden', 'important');
                        el.style.setProperty('content-visibility', 'hidden', 'important'); // Anti-flashing
                        hiddenCount++;
                    }
                });
            });
            
            if (hiddenCount > 0) {
                devLog(`Hidden ${hiddenCount} critical elements`);
            }
        } catch (err) {
            console.log('Error hiding critical elements: ' + err.message);
        }
    };
    
    // Run immediately
    hideCriticalElements();

function collapseElementHard(el) {
    if (!el || !el.style) return;

    el.classList.add('fb-element-banned');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('left', '-9999px', 'important');
    el.style.setProperty('top', '-9999px', 'important');
    el.style.setProperty('width', '0', 'important');
    el.style.setProperty('min-width', '0', 'important');
    el.style.setProperty('max-width', '0', 'important');
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('max-height', '0', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('content-visibility', 'hidden', 'important');
}

    // ===== HOME FEED CTA / REELS SCRUBBER v23 =====
    const FB_RESTRICTED_FEED_CTA_TEXT_V23 = new Set(['liity', 'join', 'seuraa', 'follow']);

    const getFBFeedUnitWrapperV23 = (seed) => {
        try {
            if (!seed || !seed.closest) return null;
            return seed.closest('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"]') ||
                   seed.closest('[role="feed"] [role="article"]') ||
                   seed.closest('[role="article"]') ||
                   null;
        } catch (e) {
            return null;
        }
    };

    const isProbablyHomeFeedUnitV23 = (el) => {
        try {
            if (!el || !el.closest) return false;
            if (isProfileHeaderProtectedArea && isProfileHeaderProtectedArea(el)) return false;
            if (isTopLeftSearchDropdownElement && isTopLeftSearchDropdownElement(el)) return false;
            if (el.closest('[role="banner"], [role="navigation"]')) return false;
            return !!(el.closest('[role="feed"]') || el.matches?.('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"]'));
        } catch (e) {
            return false;
        }
    };

    const getCompactLowerTextV23 = (el, fallback = '') => {
        try {
            const raw = collectLightAndOpenShadowTextScoped(
                el,
                fallback || el?.innerText || el?.textContent || '',
                {
                    maxHostSearchNodes: 80,
                    maxShadowHosts: 4,
                    maxTextNodes: 55,
                    maxShadowNodes: 35,
                    maxChars: 2600,
                    maxDepth: 1,
                    includeAttributes: true
                }
            );
            return String(raw || '').replace(/\s+/g, ' ').trim().toLowerCase();
        } catch (e) {
            return String(fallback || el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        }
    };

    const hasRestrictedFeedCTAOrReelsV23 = (seed) => {
        try {
            const unit = getFBFeedUnitWrapperV23(seed) || seed;
            if (!unit || !isProbablyHomeFeedUnitV23(unit)) return false;

            // Mid-feed Reels carousel from captured HTML: h3 "Reels", aria-label="Kelat" region,
            // and /reel/ cards inside a FeedUnit.
            if (unit.querySelector?.('[aria-label="Kelat"][role="region"], [aria-label="Reels"][role="region"], a[href^="/reel/"], a[href*="facebook.com/reel/"], a[aria-label^="Kela käyttäjältä"], a[aria-label^="Reel by"]')) return true;

            const headings = unit.querySelectorAll ? unit.querySelectorAll('h2, h3, h4, [role="heading"]') : [];
            for (let i = 0; i < headings.length; i++) {
                const headingText = getCompactLowerTextV23(headings[i]);
                if (headingText === 'reels' || headingText === 'kelat') return true;
            }

            // Captured Liity/Join and Seuraa/Follow buttons are small inline CTA div[role=button]
            // wrappers, often under span.x3nfvp2 or span.xdwrcjd.xuxw1ft.
            const buttons = querySelectorAllOpenShadowScoped(unit, 'div[role="button"], button[role="button"], button', {
                maxNodes: 120,
                maxHostSearchNodes: 180,
                maxShadowHosts: 6,
                maxDepth: 1
            });

            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const txt = getCompactLowerTextV23(btn);
                if (FB_RESTRICTED_FEED_CTA_TEXT_V23.has(txt)) return true;

                // Extra structural path from uploaded snippets: exact inline text span inside the button.
                const labelSpan = btn.querySelector?.('span.x1fey0fg, span.x193iq5w');
                if (labelSpan) {
                    const label = getCompactLowerTextV23(labelSpan);
                    if (FB_RESTRICTED_FEED_CTA_TEXT_V23.has(label)) return true;
                }
            }

            return false;
        } catch (e) {
            return false;
        }
    };

    const markFBFeedUnitApprovedV23 = (seed) => {
        try {
            const unit = getFBFeedUnitWrapperV23(seed) || seed;
            if (!unit || !unit.classList) return;
            unit.classList.add('fb-feed-unit-approved', 'fb-post-approved');
            unit.classList.remove('fb-post-banned', 'fb-element-banned');
            unit.querySelectorAll?.('[role="article"]').forEach(article => {
                try { article.classList.add('fb-post-approved'); } catch (e) {}
            });
        } catch (e) {}
    };

    const hideFBFeedUnitHardV23 = (seed, reason = 'restricted feed unit') => {
        try {
            const unit = getFBFeedUnitWrapperV23(seed) || seed;
            if (!unit || !unit.style) return false;
            unit.classList.remove('fb-feed-unit-approved', 'fb-post-approved');
            unit.querySelectorAll?.('[role="article"]').forEach(article => {
                try { article.classList.remove('fb-post-approved'); } catch (e) {}
            });
            hideElementHard(unit, 'fb-post-banned');
            devLog(`🚫 Feed unit hidden by v23: ${reason}`);
            return true;
        } catch (e) {
            return false;
        }
    };

    const scrubRestrictedFeedUnitsV23 = () => {
        try {
            updateFBHomeFeedGateClassV23();
            if (!isFBHomeFeedSurfaceV23()) return;

            const selectors = [
                'div[data-pagelet^="FeedUnit_"]',
                'div[data-pagelet^="TimelineFeedUnit_"]',
                '[role="feed"] [role="article"]'
            ];

            const seen = new WeakSet();
            let hidden = 0;
            selectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(candidate => {
                        const unit = getFBFeedUnitWrapperV23(candidate) || candidate;
                        if (!unit || seen.has(unit)) return;
                        seen.add(unit);
                        if (unit.classList?.contains('fb-post-banned') || unit.classList?.contains('fb-element-banned')) return;
                        if (hasRestrictedFeedCTAOrReelsV23(unit)) {
                            if (hideFBFeedUnitHardV23(unit, 'Liity/Join, Seuraa/Follow, or mid-feed Reels')) hidden++;
                        }
                    });
                } catch (e) {}
            });

            if (hidden > 0) devLog(`v23 scrubbed ${hidden} restricted home-feed unit(s)`);
        } catch (e) {
            console.log('Error scrubbing restricted feed units v23: ' + e.message);
        }
    };

    // --- ARRAYS AND CONFIGURATION ---
    const paramsToDelete = ["set", "type"];    // ===== ACCOUNT-SCOPED STRICT FILTERS =====
    // FBID/person filtering is only active for explicitly supported logged-in accounts.
    const SUPPORTED_FBID_LIST = [
        '100005050653554'
    ];

    const getLoggedInFacebookAccountFbid = () => {
        try {
            const cookieMatch = String(document.cookie || '').match(/(?:^|;\s*)c_user=(\d+)/);
            if (cookieMatch && cookieMatch[1]) return cookieMatch[1];
        } catch (e) {}

        try {
            const html = document.documentElement ? (document.documentElement.innerHTML || '').slice(0, 250000) : '';
            const patterns = [
                /["']ACCOUNT_ID["']\s*[:=]\s*["'](\d+)["']/i,
                /["']USER_ID["']\s*[:=]\s*["'](\d+)["']/i,
                /["']actorID["']\s*[:=]\s*["'](\d+)["']/i,
                /["']userID["']\s*[:=]\s*["'](\d+)["']/i,
                /["']viewerID["']\s*[:=]\s*["'](\d+)["']/i
            ];
            for (let i = 0; i < patterns.length; i++) {
                const match = html.match(patterns[i]);
                if (match && match[1]) return match[1];
            }
        } catch (e) {}

        return '';
    };

    const isStrictAccountEnabled = () => {
        try {
            const accountFbid = getLoggedInFacebookAccountFbid();

            // Match the older working behavior:
            // if Facebook has not exposed the logged-in account ID yet, fail closed.
            // Once c_user / boot data becomes available, unsupported accounts are disabled normally.
            if (!accountFbid) return true;

            return SUPPORTED_FBID_LIST.includes(accountFbid);
        } catch (e) {
            return true;
        }
    };

    let __fbStrictAccountEnabled = false;

    const isolatedFbids = [
        '1211026318928667',
        '537550366276269',
        '623119941052644',
        '576288902402415',
        '545014018863237',
        '434866806544626',
        '577933972237908',
        '568117709886201',
        '577933912237914',
        '247979528654747',
        '623591001005538',
        '578307698867202',
        '8607987962565762',
        '9304570432907508',
        '9434929546538262',
        '8594043307293561',
        '8193551130676116',
        '8187588197939076',
        '100064492520692',
        '8894604553904100',
        '577936375571001',
        '577934212237884',
        '7950002728364292',
	'100002704826559',
        '371861326178508',
        '100006231940849',
	'100013206342389',
        '100079421143598',
	'100013206342389',
        '100002140178481',
        '8062936260404271',
	'2717246041744548',
	'100084859553388',
	'100002704826559',
	'100079684276475',
        '100007491272181',
        '100000404984016',
        '100046099231198',
	'1738029402',
	'779432839',
        '1495428881',
	'1120952529',
        '1356706889',
	'10225004332552385',
	'10219580837008386',
	'10220029018452642',
	'10223968662581283',
	'10221462519169264',
	'10224094556048541',
        '1014542354035878',
        '1014535897369857',
        '1340482475983050',
        '6872722896092286',
	'100001785490722',
	'61584748958609',
	'100000645744865',
        '1344030092294955',
        '895923403772295',
        '895814217116547',
        '1062802150417752',
        '1060897693941531',
	'1364634045693372',
        '1458027414228555',
	'1240143084949993',
	'100000586987296',
	'100013206342389',
        '100000586987296',
        '292715294181170',
        '505428986169752',
	'100002030632206',
	'100000873315103',
	'100027515703287',
        '100064492520692',
	'100005784843977',
        '444809228883717',
        '462339497310048',
        '1014126078618693',
	'100023001972023',
        '973601849337783',
        '970049886359646',
	'100001581857271',
	'1256224499884112',
        '940194702678498',
        '9761862833844930',
	'61555778018195',
        '936445033053465',
        '907980612566574',
	'8065217176842846',
        '895381147159854',
        '1080918508606116',
        '1072683142762986',
        '630426793655292',
        '609256709105634',
        '555485811149391',
        '548697141828258',
        '1079952645369369',
        '1209351935762772',
        '24185005747770732',
        '24185005784437395',
        '1178535568844409',
	'100000645744865',
        '101371466560830',
        '1166215320076434',
        '1158912826275168',
	'24697494943188474',
	'24697494953188473',
        '1109723022392331',
	'100000639309471',
	'100001730786421',
        '1099222803442353',
        '1090312024333431',
	'100026405029973',
        '867521339945835',
        '371863449511629',
	'156025504001094',
        '371863216178319',
        '368533993177908',
        '509864159059568',
        '504758682903449',
        '2155319098244876',
        '293678390751527',
        '292375400881826',
	'100027515703287',
        '100003019443729',
        '599253748555949',
        '855022637862372',
        '1467275073303789',
        '24332459019692070',
        '843081002389869',
        '24329736293297676',
        '642842945747010',
        '629932107038094',
        '602713353093303',
        '616352621729376',
        '615068318524473',
        '2822598764438073',
        '2782340741797209',
        '444809795550327',
        '436177466413560',
        '9759657687398778',
        '9817473061617240',
        '24140067825597858',
        '24027737130164262',
        '1400006907824507',
        '8384654324899128',
        '935807304949049',
        '8812088588802292',
        '100000927411277',
	'100027515703287',

	// Bonus blocks
	'1473251876',
	'656747282',
	'533897986',
	'100006631248795',
	'100000407754247',
	'100005219342823',
	'100000163076132',
	'100006304518916',
	'100042472892807',
    ];

    let blockedFbids = [];


    const blockedUrls = [
        /profile\.php\?id=100000639309471&sk=photos/,
        /profile\.php\?id=100000639309471&sk=photos_by/,
        /profile\.php\?id=100000639309471&sk=videos/,
        /permalink\.php\?story_fbid=pfbid0xgBFRfVFGyiwt9b1eibHLQG2vin9NADySKrZm8aPvENT9GWMg3dt8VA6eGHxZjWCl/,
        /permalink\.php\?story_fbid=pfbid0pMgpCH4wjuyq3smimT5ULEmQFzZugx9o3kBraHLJ5Y37toTEn1415Z7L8FpTh135l/,
        /permalink\.php\?story_fbid=pfbid02QrdmwZKfKxAiZm3k41FgqM6FEyRx1eLAB1UiJPc7z9CT3RxL9a4X12qKKyykkfw5l/,
        /permalink\.php\?story_fbid=pfbid02f5iZ2iLyAA4o4PLoreUSQ7EJi19fSmYYUbCqxFEKMZv89VmiKfBtS1hqAErjzdQZl/,
        /permalink\.php\?story_fbid=836447305302755/,
        /permalink\.php\?story_fbid=pfbid022bSh3R6FDVHjTomfKqRremW2dg8fiWb5xaRzpqAJXdQHPkwBvsfJgicom5Vi3RremW2dg8fiWb5xaRzpqAJXdQHPkwBvsfJgicom5Vi3Hml/,
        /permalink\.php\?story_fbid=pfbid0abuaonjJ1417W5MUrmpGgo4pJt5kJGL9hYcGYz8J392z3PjjVjhrZhgcK2fz6pZcl/,
        /permalink\.php\?story_fbid=pfbid02rX4RcxF9v5YB1xAq36u9bndbyiW535dgjuTnbCxJjjRHzPCKDzQyvPAtdN23T4Kzl/,
        /permalink\.php\?story_fbid=1236875833901235/,
        /permalink\.php\?story_fbid=pfbid02cVLMUQSCxQzznzkH5X9BPsUDusdBKc9fzuiGsoJHSXDWqYMKBBXHd8xj6EFKmdivl/,
        /permalink\.php\?story_fbid=583915704973068/,
        /permalink\.php\?story_fbid=pfbid0Xq5bxtrXkWA9gWqcBt2aT8sDMeCDG5XN6hWVHE7axKu3jbn9LfiYfADgWHLtBfEUl/,
        /posts\/pfbid02LXtamB1X9aJrRsMDxkcbNLFk2g9eeYBNii6HzaLLZVamDMnaAG4AvZU1VYfVHvn9l/,
        /posts\/pfbid0XXH5hPZ4kU6y6zm4eeyqYkUMZhCdXsKuMzCRbkZptgEGNTk8UVYT9UEEYinKvXLWl/,
        /posts\/pfbid02LKr4mWRvd45TkNcPfaUFuu3NGkgQb1t8fHD6t9cqigiUkQLuyQRASMMYeH88yDBVl/,
        /story_fbid=164225553736969/,
        /permalink.php?story_fbid=pfbid06VXAEGvWCcsPbk553v88NMB8uWRnRGHffB5s9kEpKRyYmfEJtt4fULTnQ82LnieDl/,
        /permalink.php?story_fbid=pfbid02tTJDFvZ5sfpCUBcnoG1kJvie7dabmLSwHCqVya7XzoZMFc2QX7AU2emUdhE7EeWzl/,
	/permalink.php?story_fbid=pfbid02ApNL79Gp1AKQf55yHVLeQvGAakCwm4STcNQwCVyG26Wk17dt5FZhA3jgAVfgqVt1l/,
	/pfbid02ApNL79Gp1AKQf55yHVLeQvGAakCwm4STcNQwCVyG26Wk17dt5FZhA3jgAVfgqVt1l/,
        /permalink.php?story_fbid=642842945747010/,
        /permalink.php?story_fbid=895381147159854/,
        /permalink.php?story_fbid=936445033053465/,
        /permalink\.php\?story_fbid=pfbid05g1GaBBRjHMhXfekDtUEmRbP98Q4N9kdHhCrUUfp6LGdsQQMmShBYT8KfkSH938pl/,
        /permalink.php?story_fbid=pfbid02ZLJve5megHVfot9Ezfyr5z5m531kDh4TYzysgUZ3J2622PtM5Xb4NpJ9yiJqjfDNl/,
        /permalink.php?story_fbid=pfbid035WcvrEubf1RjAAXbYonu4smUnnSEYPcrY4Qz78v8jk3hv44aLbyikR4y2jboocztl/,
        /permalink.php?story_fbid=pfbid02QLcVYhmA1qEtvnHG986MyGR55duicYgvoykzXa2Vj6n4dUskKQ4FqojZtdQyAm3fl/,
        /permalink.php?story_fbid=1340482475983050/,
        /permalink.php?story_fbid=pfbid0qThHq9yVbKEMUe63CGVZ6BnCy9kDAak1qAMG22if857TPCJX6FpVpNCFeBwEzuRYl/,
        /permalink.php?story_fbid=pfbid02MRkRwJLc6tyeWCMHAw16Z7Y7kQhbFmhk7uui4RV7SRZSXNdL4EYxLgN2ndJriBxel/,
        /permalink.php?story_fbid=pfbid0EPSNtptR1iDJzSakNGr5u1yacxF3wEXcHVSrkp7z68K87xDtzABc5LU7dGv4frL7l/,
        /permalink.php?story_fbid=pfbid0LfgFUf7LJRweuE69QHd3DSuyrDV8RVUudEojMa9a96qPasVBoN1pNzPco1KVd9Vkl/,
        /permalink.php?story_fbid=5666600276704560/,
        /permalink.php?story_fbid=pfbid027gqscS39nkeaTY8cXt7L4RNP1sYuZKoJPu244oxCSvc5z3zxHKNuxNd5MBH5Geool/,
        /permalink.php?story_fbid=pfbid0qThHq9yVbKEMUe63CGVZ6BnCy9kDAak1qAMG22if857TPCJX6FpVpNCFeBwEzuRYl/,
        /permalink.php?story_fbid=pfbid0nkBwAMmJZ8LNs9awZ9tvLRo29tbP9PpW8FZ1cDDFNtVCJJW5Vin8B6QUSqNkqLH5l/,
        /permalink.php?story_fbid=pfbid0efp4yfb77ATKq5vRjB3o3dMGvw9yvagaTz21j4SmbUeeYvNHanjqjGBVpFnCMibBl/,
        /permalink.php?story_fbid=pfbid0EAzJgxVD1zCF6THJ1pKtS6kEe9L1TiLbo2sEKHUqUXJRF899FkUkBH4MNjM22sKpl/,
        /permalink\.php\?story_fbid=pfbid0Xq5bxtrXkWA9gWqcBt2aT8sDMeCDG5XN6hWVHE7axKu3jbn9LfiYfADgWHLtBfEUl/,
        /permalink.php?story_fbid=907980612566574/,
        /permalink.php?story_fbid=pfbid02ERbU7QHGJLQ8CwgMz2wdNjnQJdZ8fJje85i1LcExk5CLCXkDuTyyRp5uat4aKkAYl/,
        /permalink.php?story_fbid=907631116865858/,
	/pfbid0oH97BQX6SJFFD1fVrd5QdFruFfpBMWZp452ZHkxK6arLR68RzbrBuruEye6dwqEl/,
	/pfbid02AeDKp115BTU1qD4QzLZ8V2NWm7NmZUe9V9cghxu5YyasXHDwvJCLgBr9GEtv6qmjl/,
	/permalink\.php\?story_fbid=pfbid02AeDKp115BTU1qD4QzLZ8V2NWm7NmZUe9V9cghxu5YyasXHDwvJCLgBr9GEtv6qmjl/,
	/permalink.php?story_fbid=pfbid02aTQ2VVXnfkxpy38cZ5Ey179t4qcxZugQtAmNU5o4eerHn81h6ETiXcY76XEgAx5ul/,
	/pfbid02aTQ2VVXnfkxpy38cZ5Ey179t4qcxZugQtAmNU5o4eerHn81h6ETiXcY76XEgAx5ul/,
        /permalink.php?story_fbid=10099498386748038/,
        /permalink.php?story_fbid=895923403772295/,
        /permalink.php?story_fbid=895381147159854/,
        /permalink.php?story_fbid=855022637862372/,
        /permalink.php?story_fbid=843081002389869/,
        /permalink.php?story_fbid=1178535568844409/,
        /permalink.php?story_fbid=1062802150417752/,
        /permalink.php?story_fbid=1014126078618693/,
        /permalink.php?story_fbid=970049886359646/,
	/\/facebook\.com\/search\/top\/\?q=Tatu%20Toiviainen/,
	/fbid=10225004332552385/,
	/Tatu%20Toiviainen/,
	/Janica%20Tamminen/,
	/Mimmi%20Wikman/,
	/Ira%20Nyman/,
	/Sanni%20Vuori/,
	/Kara%20B/,
	/Lauren%20/,
	/Laura%20Karhu/,
	/Katariina%20/,
	/\/facebook\.com\/search\/top\/\?q=Katariina/,
	/\/facebook\.com\/search\/people\/\?q=Katariina/,
	/\/facebook\.com\/search\/top\/\?q=Kara%20B/,
	/\/facebook\.com\/search\/people\/\?q=Kara%20B/,
	/pfbid02s8apN5SvHj2L634nJJmzRZbABC9wZzdChf2kqG6m3h1PrDG5Z5CrVYfWpSim9L5Fl/,
	/pfbid02Eho4BczZu7Vbg2iJDF6jr89KwHBy1iGr3GzAwPREbrNr6gjPDXpSy7JwJqvN4fZdl/,
	/pfbid02AuWMkj4XYtGbaneoq8JWomieFk1UuVTPDTSvL3avK74mXykwe87GSA5G4dsaYJ3rl/,
	/permalink.php?story_fbid=pfbid02AuWMkj4XYtGbaneoq8JWomieFk1UuVTPDTSvL3avK74mXykwe87GSA5G4dsaYJ3rl/,
	/permalink.php?story_fbid=pfbid06xvcvULz9eHgge39HMCS4TYPLs6pM3itRyRqUQGHZAZbZAvR6DbQfAskMFTRm1X8l/,
        /pfbid0237ToPx2orNHBxmeBoRmdKFGvEr56RUTYTHtsaECu7gXwDUeVxhpXmqTt6cTvsDYXl/,
        /pfbid0Y6RdZQAvubSckYrudt3rAeNSx2et4YPUg12nx7Nv7cAKFgcgpBwLfQ8XK43Pryr4l/,
        /pfbid027gqscS39nkeaTY8cXt7L4RNP1sYuZKoJPu244oxCSvc5z3zxHKNuxNd5MBH5Geool/,
        /pfbid02MRkRwJLc6tyeWCMHAw16Z7Y7kQhbFmhk7uui4RV7SRZSXNdL4EYxLgN2ndJriBxel/,
        /pfbid0nkBwAMmJZ8LNs9awZ9tvLRo29tbP9PpW8FZ1cDDFNtVCJJW5Vin8B6QUSqNkqLH5l/,
	/pfbid0C5EFsiXaQ4xYxRsYjTbFdJQ16kvSqtGpAgjWjbfkeGj8AnheyLqn7MfKJyKbRSrBl/,
        /pfbid02aGzvCJefJC5Fh3XUVbvBPCxg55Px15NyDsK4VU3TjXpnnMktss6SEUC622SmQmTWl/,
        /pfbid06qH6x7KFy2KNqqB3j8nnDWJDxGfq11oh3FBBPDgPBn4PasfWGshxReW7gvHfqEHkl/,
        /pfbid0HaJikdQnFY855RTGVzsdJ37A35tfx9bwipQu23jk1wyc3xzCSb9rvgBPUpjsuVZbl/,
        /pfbid036f6zK7fAhXTd4CpkSDtayrMrDW6VSNKcoQoPiR3CMPvVCVuMaNX8jMEoYc6WpkZnl/,
        /pfbid0XkSVwYhGrkQ1wcBZHDqvrTXc3nhYzVNnQ6znaLpxwrGeSrpn3VJ4wSaUt1WeywDMl/,
        /pfbid02r7g7nP7vadRLpCU9jtP4yR8bYJtWt7d9JUqC839QUfaySuyzXzMBcExFufQENKaal/,
	/pfbid02AWZoqdyLzr85gw6zzoPzBmDfjXEWbh9GX7oqHBSVrR4D8bcnYGQoCvWEkybUXcKal/,
	/pfbid02Etv8PekTAr8YPSnTbg6bDjKEcPCBPXFxnFfMPEQv4Qipd7oXqeaTeynt1PxGdQZwl/,
        /permalink.php?story_fbid=pfbid02XysYZFdPcadPVYXqD9SyzmDChrqfcK4kd6haSDo2WrE4thPhn8WemX4n44GKsmdVl/,
        /permalink.php?story_fbid=940194702678498/,
        /permalink.php?story_fbid=pfbid0xh4ZoQA4XvgYL7iXe238V7o1sxEyULXGhr6Ufk2YeWFMwD4Ct4UYixF5UbycsCyEl/,
        /permalink.php?story_fbid=pfbid0237ToPx2orNHBxmeBoRmdKFGvEr56RUTYTHtsaECu7gXwDUeVxhpXmqTt6cTvsDYXl/,
        /permalink.php?story_fbid=1209351935762772/,	
	/pfbid0gafHyFzyeSZAVP2Pshkc1jPwHxekWhy1tQ4iBi5VR3M72S7Eyubac2NUuFBDL9Cbl/,
        /permalink.php?story_fbid=108091850860611/,
        /permalink.php?story_fbid=1080918508606116/,
        /permalink.php?story_fbid=116621532007643/,
        /permalink.php?story_fbid=1109723022392331/,
        /permalink.php?story_fbid=1099222803442353/,
        /permalink.php?story_fbid=1090312024333431/,
        /permalink.php?story_fbid=867521339945835/,
        /permalink.php?story_fbid=24140067825597858/,
        /permalink.php?story_fbid=700614522353732/,
        /permalink.php?story_fbid=615068318524473/,
        /www\.facebook\.com\/friends.*/,
        /www\.facebook\.com\/notifications.*/,
        /permalink.php?story_fbid=pfbid02gSLE82JdtQ9BNfzGwBy9SvJgozXPR7DJkZJHvCiYXhxL4cjjrV57evFZpnWyTijhl/,
        /permalink.php?story_fbid=pfbid06VXAEGvWCcsPbk553v88NMB8uWRnRGHffB5s9kEpKRyYmfEJtt4fULTnQ82LnieDl/,
        /permalink.php?story_fbid=pfbid0kx58SnWrhM9iBggJ99sLtKBXZ6jKUymj1T3LGXGPg6vMnUbhZTouZ7hkgozWaDePl/,
	/permalink.php?story_fbid=pfbid02FCiefA3vB2vd4u8MSaD6JhB438oZ1o8DB9bhY4xjB8fBXavvtKd87PwE7QCjArp1l/,
	/pfbid02FCiefA3vB2vd4u8MSaD6JhB438oZ1o8DB9bhY4xjB8fBXavvtKd87PwE7QCjArp1l/,
	/permalink.php?story_fbid=pfbid02aC6zYmULJUrbWKVB8MuP2c23ThvKkpR8AhktLykJCdGeas6TA3S8Sgd7sVAWHBByl/,
	/pfbid02aC6zYmULJUrbWKVB8MuP2c23ThvKkpR8AhktLykJCdGeas6TA3S8Sgd7sVAWHBByl/,
        /ask\.fm/,
        /blogspot\.com/,
        /blogspot\.fi/,
        /kick\.com/,
        /horizonmw\.org/,
        /github\.com/,
	/livmorgan/i, 
	/wweadmire/i,
        /www\.facebook\.com\/Haukkis\/friends_with_upcoming_birthdays/,
        /www\.tiktok\.com/,
        /sportskeeda\.com\/*/,
        /sportskeeda\.com\/*/,
        /sportskeeda\.com/,
        /wwfoldschool\.com\/*/,
        /wwfoldschool\.com/,
        /meta\.ai/i,
        /chromewebstore\.google\.com\/detail\/tor-selain\/eaoamcgoidmhaficdbmcbamiedeklfol/i,
        /opera\./i,
        /huggingface\./i,
        /hugging-face\./i,
        /tenor\./i,
        /tenor\.com/i,
        /torproject\.org/i,
        /tor\.app/i,
        /mozilla\.org/i,
        /mozilla\.fi/i,
        /cloudbooklet\./i,
        /cyberlink\./i,
        /undressapp\./i,
        /undress-app\./i,
        /sportskeeda\./i,
        /wwfoldschool\./i,
        /www\.opera\.com/i,
        /www\.apple\.com/i,
        /microsoft\.com\/en-us\/edge\//i,
        /microsoft\.com\/fi-fi\/edge\//i,
        /cloudbooklet\./i,
        /clothoff\./i,
        /411mania\.com/i,
        /cultaholic\./i,
        /whatculture\./i,
        /ringsideintel\./i,
        /wrestlinginc\./i,
        /thesportster\./i,
        /cagesideseats\./i,
        /f4wonline\./i,
        /www\.\f4wonline\./i,
        /wwfoldschool\./i,
        /sportskeeda\./i,
        /medium\./i,
        /https:\medium\./i,
        /medium\.com\/@/i,
        /awfulannouncing\./i,
        /pwpix\./i,
        /pwpix\.net/i,
        /brave\.com/i,
        /saashub\./i,
        /undress\./i,
        /nudify\./i,
        /nudifier\./i,
        /nudifying\./i,
        /clothoff\./i,
        /undress\./i,
        /un-dress\./i,
        /undressified\./i,
        /undressifyed\./i,
        /undressifying\./i,
        /undressify\./i,
        /deepnude\./i,
        /deep-nude\./i,
        /twitter\.com/i,
        /x\.com/i,
    ];

    const allowedUrls = [
        /is\.fi/,
        /youtube\.com/,
        /www\.youtube\.com/,
        /www\.facebook\.com/,
        /iltalehti\.fi/,
        /ks\.fi/,
        /.\fi/i,
        /.\com/i,
    ];

    const excludedRegexPatterns = [
        /\/(messages|messenger)\b/i,
        /\/notifications\b/i,
        /\/marketplace\b/i,
        /\/ilmoitukset\b/i,
        /\/stories\b/i,
        /\/groups\/(317493608736721|342124472533278|2484497081612438|390555733810362|934038190050109)\b/i,
        /\/(haukkis|tapio\.haukirauma|1267550854|100005050653554|me)\b/i,
        /id=(100005050653554|100000559239899|1267550854)\b/i
    ];

    // ===== NATIVE TOP-LEFT SEARCH SAFE ISLAND v16 =====
    // Built from the captured Facebook dropdown HTML:
    // - search box / form
    // - recent-search grid/list
    // - li[role="row"] cards with /search/top/?q=...&__epa__=SEARCH_BOX
    // - page/profile recent rows with delete buttons titled "Poista ... historiasta"
    // The key rule: this surface is Facebook-owned UI. Scanners must skip it; real /search/ pages still filter normally.
    const fbNativeTopSearchSafeSelectorsV16 = [
        'input[placeholder*="Hae Facebookista" i]',
        'input[placeholder*="Search Facebook" i]',
        '[role="searchbox"]',
        '[role="combobox"]',
        '[role="banner"] form[role="search"]',
        '[role="banner"] div[role="search"]',
        'form[role="search"]:has(input[placeholder*="Hae Facebookista" i])',
        'form[role="search"]:has(input[placeholder*="Search Facebook" i])',
        'div[role="search"]:has(input[placeholder*="Hae Facebookista" i])',
        'div[role="search"]:has(input[placeholder*="Search Facebook" i])',
        'ul[role="grid"][aria-label*="ehdotettu haku" i]',
        'ul[role="grid"][aria-label*="suggested search" i]',
        'ul:has(> li[role="row"] a[href*="__epa__=SEARCH_BOX"])',
        'ul:has(> li[role="row"] a[href*="/search/top/"])',
        'ul:has(> li[role="row"] [title*="historiasta" i])',
        'ul:has(> li[role="row"] [aria-label*="historiasta" i])',
        'ul:has(> li[role="row"] [title*="history" i])',
        'ul:has(> li[role="row"] [aria-label*="history" i])',
        'li[role="row"]:has(a[href*="__epa__=SEARCH_BOX"])',
        'li[role="row"]:has(a[href*="/search/top/"])',
        'li[role="row"]:has([title*="historiasta" i])',
        'li[role="row"]:has([aria-label*="historiasta" i])',
        'li[role="row"]:has([title*="history" i])',
        'li[role="row"]:has([aria-label*="history" i])',
        'li[role="row"]:has(a[aria-describedby][role="none"][tabindex="-1"])',
        'body:not(.is-search-page) li[role="row"]:has(a[aria-describedby][role="none"])',
        'body:not(.is-search-page) a[aria-describedby][role="none"][tabindex="-1"]',
        'a[href*="category_key=SEARCH"]',
        'a[href*="log_filter=search"]',
        'a[href*="entry_point=edit_search_history"]',
        'a[data-fbcleaner-urlsig*="category_key=SEARCH"]',
        'a[data-fbcleaner-urlsig*="log_filter=search"]'
    ];

    const safeSelectors = [
        ...fbNativeTopSearchSafeSelectorsV16,
        '[aria-label="Notifications"]',
        '[aria-label="Marketplace"]',
        '[aria-label="Ilmoitukset"]',
        '[aria-label="Messenger"]',
        '[aria-label="Stories"]',
        '[aria-label="Tarinat"]',
        'div[aria-label="Notifications"]',
        'div[aria-label="Marketplace"]',
        'div[aria-label="Ilmoitukset"]',
        'div[aria-label="Messenger"]',
        'div[aria-label="Stories"]',
        'div[aria-label="Tarinat"]',
        'span[aria-label="Notifications"]',
        'span[aria-label="Marketplace"]',
        'span[aria-label="Ilmoitukset"]',
        'span[aria-label="Messenger"]',
        'span[aria-label="Stories"]',
        'span[aria-label="Tarinat"]',
        '[role="dialog"]',
        '[tabindex="-1"]',
        '[aria-label="Marketplace"]',
        'div[role="none"][data-visualcompletion="ignore"]',
        'div.x6s0dn4.x78zum5.x1s65kcs.x1n2onr6',
        'div.xdj266r.x11i5rnm.xat24cr',
        'a[href="/marketplace/?ref=app_tab"]',
        'svg[viewBox="0 0 24 24"]',
        'span.xdj266r.x11i5rnm.xat24cr'
    ];

    // Keyword arrays
    const isolatedRegex = [
    //Only available for supported accounts
	/gareta/i, /\bkati\b/i, /juutilainen/i, /harjula/i, /taisto/i,
    ];

    const globalRegex = [
    // Classic Regexes (Might cause Meta to push more AI slop onto us)
    	/lex bl/i, /AI-/i, /-AI/i, /AI-suck/i, /Ripl/i, /Shira/i, /Steph's place/i, /Stephanie's place/i, /Steph McMahon/i, /Stepan/i, /Stratu/i, /Stratt/i, /Gina Adam/i, /lantaaa/i, /lantaai/i, /Sherilyn/i, /Tiffa/i, 
	/Tiffy/i, /Dreambooth/i, /Dream booth/i, /Dualipa/i, /Dua Lipa/i, /Meta AI/i, /Tatu Toiviainen/i, /IInspiration/i, /IIconics/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i, 
	/barlow/i, /Nikki/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i,
	/Alicy/i, /Alici/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /AIblow/i, /5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, /AI-suck/i, /drool/i, 
	/RemovingAI/i, /blowjob/i, /bjob/i, /b-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /dr00l/i, /Rhea Ripley/i, /Roxanne/i, /Lauren/i, /Suvi Anniina/i, /Saara Autio/i, /Liv Morgan/i, /Alexa Bliss/i, 
	/\bMarie\b/i, /Juliette/i, /Artificial/i, /Artificial Intelligence/i, /Powered by AI/i, /AI made/i, /AI creation/i, /IYO SKY/i, /AI creative/i, /AI created/i, /Tekoäly/i, /Teko äly/i, /Teko-äly/i, /Teko_äly/i, 
	/gener/i, /generoiva/i, /generoitu/i, /generated/i, /generative/i, /AI create/i, /generation/i, /seksi/i, /anaali/i, /pillu/i, /pimppi/i, /kyrpä/i, /kulli/i, /sexual/i, /sensuel/i, /seksuaali/i, /Kairi's/i,
        /Alexa Bliss/i, /Alexa WWE/i, /5 feet of fury/i, /five feet of fury/i, /Tiffy time/i, /Mercedes/i, /Samantha/i, /La Leona/i, /livmorgan/i, /Mariah May/i, /Mandy Rose/i, /Chelsea Green/i, /liv morgan/i, /sexual/i, 
        /Sportskeeda/i, /Vince Russo/i, /bShirakawa/i, /Samantha Irvin/i, /Brave Software/i, /Nikkita/i, /All Elite Wrestling/i, /Dynamite/i, /Rampage/i, /AEW Collision/i, /Blackheart/i, /Charlotte/i, /Becky Lynch/i,
        /Samantha Irwin/i, /Serena Deeb/i, /Mia Yim/i, /AJ Lee/i, /Stephanie/i, /Liv Morgan/i, /Piper Niven/i, /Jordynne Grace/i, /Jordynne/i, /Carr WWE/i, /Iyo Shirai/i, /Izzi Dame/i, /Iyo Sky/i, /Playboy/i, /goddess/i, 
        /Izzi WWE/i, /Nick Jackson/i, /NXT Womens/i, /NXT Women/i, /NXT Woman/i, /Jackson/i, /DeepSeek/i, /DeepSeek AI/i, /Rhea Ripley/i, /Instagram/i, /Jakara/i, /Lash Legend/i, /Alba Fyre/i, /Isla Dawn/i, /CJ Perry/i, 
	/Lana WWE/i, /Raquel Rodriguez/i, /Zelina Vega/i, /Alicia Fox/i, /Willow Nightingale/i, /Kris Statlander/i, /Kayden Carter/i, /Katana Chance/i, /Izzi Dame/i, /Dame WWE/i, /Indi Hartwell/i, /Blair Davenport/i, 
	/Lola Vice/i, /\bValhalla\b/i, /Maxxine Dupri/i, /Karmen Petrovic/i, /Ava Raine/i, /Cora Jade/i, /Jacy Jayne/i, /Gigi Dolin/i, /Io Sky/i, /Shirai/i, /Scarlett/i, /Thea Hail/i, /Tatum Paxley/i, /Dakota Kai/i,
	/Kelani Jordan/i, /Electra Lopez/i, /Wendy Choo/i, /Yulisa Leon/i, /Valentina/i, /Amari Miller/i, /Young Bucks/i, /Torrie Wilson/i, /Ripley!/i, /Monroe/i, /Arianna Grace/i, /Zelina/i, /Natalya/i, /Sexy/i,
	/Kairi Sane/i, /Satomura/i, /Candice/i, /Nia Jax/i, /\bNaomi\b/i, /Roxanne/i, /Xia Li/i, /Shayna/i, /Baszler/i, /Rousey/i, /Velvet Sky/i, /Carmella/i, /Dana Brooke/i, /Martinez/i, /Marina/i, /goddess/i, 
	/Sasha Banks/i, /Valkyria/i, /Kara B/i, /Primera/i, /Summer Rae/i, /Michelle McCool/i, /Eve Torres/i, /Kelly Kelly/i, /Tatu Toiviainen/i, /Jessika Carr/i, /Jessica Karr/i, /Venice/i, /Jessica Carr/i, 
        /Jessica WWE/i, /Matt Jackson/i, /Karr WWE/i, /Melina wrestler/i, /bKanellis/i, /Beth Phoenix/i, /Kaipio/i, /Victoria/i, /Jazz WWE/i, /Molly Holly/i, /Priscilla/i, /Red Velvet/i, /Meta AI/i, /sasha/i, 
        /Awesome Kong/i, /Madison Rayne/i, /Angelina/i, /Tessmacher/i, /Su Yung/i, /woman/i, /women/i,  /Taya Valkyrie/i, /Bianca Belair/i, /Skye Blue/i, /Bordeaux/i, /Brooke/i, /Purrazzo/i, /Toni Storm/i, 
        /Jamie Hayter/i, /Anna Jay/i, /Hikaru/i, /Sakazaki/i, /Nyla Rose/i, /Sakura/i, /Penelope Ford/i, /Julia Hart/i, /Kamifuku/i, /Elayna/i, /Juliette/i, /Juliana/i, /Julianna/i, /Henley/i, /Saya Kamitani/i, 
        /AJ Lee's/i, /Nikkita Lyons/i, /Lisa Varon/i, /Marie Varon/i, /Irving/i, /Belts Mone/i, /Amanda Huber/i, /Megan Bayne/i, /Wren Sinclair/i, /Bella Twins/i, /Britt Baker/i,  /Kairii/i, /Sexxy/i, /Xia Li/i, 
	/Sexx/i, /Sexi/i, /Monroe/i, /Girlfriend/i, /Girl's/i, /Women's/i, /Woman's/i, /Lady's/i, /Ladies'/i, /Toni Harsunen/i, /Wikman/i, /Jaida Parker/i, /suositukset/i, /ehdotukset/i, /Kamitani/i, /Gail Kim/i,
	/Artificial Intelligence/i, /20\. heinäkuu klo/i, /Sisältö ei ole käytettävissä tällä hetkellä/i, /sinulle ehdotettu/i, /kendal.*(grey|gray)/i, /leila.*(grey|gray)/i, /Jessika WWE/i, /Fallon Henley/i,

    // Boundaried regexes (separated for clarity)
    	/\bSol\b/i, /\bShe\b/i, /\bHer\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bRiho\b/i, /\bCum\b/i, /\bSlut\b/i, /\bTor\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /\bAlexa\b/i, /\bTay\b/i, /\bMelo\b/i,
    	/\bConti\b/i, /\bPaige\b/i, /\bShotzi\b/i, /\bTiffy\b/i, /\bStratton\b/i, /\bAEW\b/i, /\bBy AI\b/i, /\bAis\b/i, /\bIvory\b/i, /\bposing\b/i, /\bSasha\b/i, /\bAnal\b/i, /\bBliss\b/i, /\bKara\b/i, /\bGay\b/i, 
	/\bTransvestite\b/i, /\bTransu\b/i, /\bPride\b/i, /\bLesbian\b/i, /\bLesbo\b/i, /\bHomo\b/i, /\bQueer\b/i, /\bSable\b/i, /\bBella\b/i, /\bNikki\b/i, /\bTegan\b/i, /\bGoddess\b/i, /\bLita\b/i, /\bRusso\b/i, 
	/\bLGBT\b/i, /\bLGBTQ\b/i, /\bMami\b/i, /\bTrish\b/i, /\bStratus\b/i, /\bGiulia\b/i, /\bMichin\b/i, /\bJayne\b/i, /\bLLM\b/i, /\bMLM\b/i, /\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /\bODB\b/i, /\bChyna\b/i, 
	/\bSaraya\b/i, /\bBrooke\b/i, /\bCora\b/i, /\bGin4\b/i, /\bG1n4\b/i, /\bTamina\b/i, /\bTessa\b/i, /\bRuca\b/i, /\bRuby\b/i, /\bSoho\b/i, /\bTrans\b/i, /\bposed\b/i, /\bLayla\b/i, /\bLana\b/i, /\bJacy\b/i, 
	/\bBrie\b/i, /\bYung\b/i, /\bHavok\b/i, /\bJade\b/i, /\bAthena\b/i, /\bFuku\b/i, /\bGina\b/i, /\bSex\b/i, /\bAI\b/i, /\bKairi\b/i, /\bKiana\b/i, /\bGirl\b/i, /\bGirls\b/i, /\bWoman\b/i, /\bWomen\b/i, 
	/\bWomens\b/i, /\bWomans\b/i, /\bLady\b/i, /\bLadies\b/i, /\bLadys\b/i, /\bMarie\b/i, /\bKairi\b/i, /\bAsuka\b/i, /\bB-Fab\b/i, /\b#\b/i, /\bTiffany\b/i, /\bStratton\b/i, /\bPerez\b/i, /\bPerze\b/i,
	/\bHavok\b/i, /\bJillian\b/i, /\bMickie\b/i, /\bFlair\b/i, /\bMeltzer\b/i, /\bLayla\b/i, /\bBlake\b/i, /\bRipley\b/i, /\bKatie\b/i, /\bShafir\b/i, /\bStacy\b/i, /\bKeibler\b/i, /\bMaryse\b/i, /\bTrish\b/i,
	/\bSarray\b/i, /\bXia\b/i, /\bRonda\b/i, /\bNattie\b/i, /\bBayley\b/i, /\bGiulia\b/i, /\bFallon\b/i, /\bMichin\b/i, /\bStratus\b/i, /\bKelly\b/i, /\bKarr\b/i, /\bFallon\b/i, /\bDeonna\b/i, /\bThekla\b/i, 
	/\bLeRae\b/i,
    ];

    let regexBlockedWords = [];
    const refreshAccountScopedFilters = () => {
        try {
            __fbStrictAccountEnabled = isStrictAccountEnabled();
            blockedFbids = __fbStrictAccountEnabled ? isolatedFbids : [];
            regexBlockedWords = __fbStrictAccountEnabled ? globalRegex.concat(isolatedRegex) : globalRegex;
        } catch (e) {
            __fbStrictAccountEnabled = false;
            blockedFbids = [];
            regexBlockedWords = globalRegex;
        }
    };
    refreshAccountScopedFilters();

    // ===== SAFE MATCH HELPERS =====
    // Keeps the old feed approval behavior alive while using the new regex-only blocklists.
    const testRegexPattern = (pattern, value) => {
        try {
            if (!pattern) return false;
            pattern.lastIndex = 0;
            return pattern.test(String(value || ''));
        } catch (e) {
            return false;
        }
    };

    const matchesAnyActiveRegex = (value) => {
        const text = String(value || '');
        if (!text) return false;
        return regexBlockedWords.some((pattern) => testRegexPattern(pattern, text));
    };

    const matchesAnyBlockedUrl = (value) => {
        const text = String(value || '');
        if (!text) return false;
        return blockedUrls.some((pattern) => testRegexPattern(pattern, text));
    };

    const matchesAnyBlockedFbid = (value) => {
        const text = String(value || '');
        if (!text) return false;
        return blockedFbids.some((fbid) => {
            const id = String(fbid || '').trim();
            return !!id && (
                text.includes(id) ||
                text.includes(`id=${id}`) ||
                text.includes(`fbid=${id}`) ||
                text.includes(`profile.php?id=${id}`) ||
                text.includes(`/messages/t/${id}`)
            );
        });
    };

    const hideElementHard = (element, className = 'fb-element-banned') => {
        if (!element || !element.style) return;
        try {
            if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(element)) return;
        } catch (e) {}
        try { element.classList.add(className); } catch (e) {}
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        element.style.setProperty('position', 'absolute', 'important');
        element.style.setProperty('left', '-9999px', 'important');
        element.style.setProperty('top', '-9999px', 'important');
        element.style.setProperty('height', '0', 'important');
        element.style.setProperty('width', '0', 'important');
        element.style.setProperty('overflow', 'hidden', 'important');
    };


    const allowedWords = [
    //String based allowed words (global)
	"Lähetä", "Viesti", "Lähetä viesti", "Send a message", "Send message", "Send", "message", "Battlefield", "BF", "BF6", "BF1", "BF4", "BF 1942", "BF2", "Battle field", "memes", "masterrace", "#itsevarmuus",
	"#memes", "meme", "#meme", "Pearl", "Harbor", "Market", "Bro", "Brother", "Metallica", "Sabaton", "Joakim", "James", "Hetfield", "PC", "Build", "Memory", "Ram", "Motherboard", "Mobo", "Cooling", "pcmaster",
	"AIO", "CPU", "GPU", "Radeon", "GeForce", "GTX", "RTX", "50", "60", "70", "80", "90", "X3D", "50TI", "60TI", "70TI", "80TI", "90TI", "Processor", "Graphics", "Card", "Intel", "AMD", "NVidia", "RGB", "cooler",
	"#healing", "#heal", "#itsetunto", "😂", "🤣", "😭", "Lisa Su", "Jensen Huang", "Chip", "Android", "Huawei", "Tech", "Patch", "MSI", "Asus", "ROG", "Strix", "TUF", "Suprim", "Gaming", "OSRS", "RS3", "Jagex", 
	"Old School", "RuneScape",  "Sea Shanty 2", "Sailor's Dream", "Sailing", "Skilling", "Bossing", "Boss", "Mod Ash", "JMod", "Reddit", "Core", "Cores", "3DVCache", "VCache", "Inno3D", "Inno 3D", "Sapphire", "XFX",
	"Nitro", "Pure", "Asus Prime", "X570", "B550", "B650", "B650E", "X670", "X670E", "B850", "X870", "X870E", "B450", "X470", "B350", "X370", "LGA", "1150", "1151", "1155", "AM4", "AM5", "AM6", "Corsair", "Kingston",
	"PowerColor", "DDR5", "DDR4", "DDR3", "Computing", "Computer", "AData", "AM3", "AM3+", "AM2", "GSkill", "Memory", "Ram", "Turbo", "Overclock", "Overclocked", "Air cooling", "Radiator", "Pump", "Header", "Water", 
	"GTA", "Grand Theft Auto", "PlayStation", "PS1", "PS2", "PS3", "PS4", "PS5", "Xbox", "Series", "Pro", "Console", "Sega", "MegaDrive", "Genesis", "Nintendo", "Upgrade", "Room", "Setup", "Christmas", "Wordables",
	"Wordable", "lifelearnedfeelings", "feel", "feelings", "feeling", "pcmasterrace_official", "pcmasterrace", "pc masterrace", "pc master race", "gaming", "game", "gamer", "Tarina", "Tarinat", "Story", "Stories",
	"Vice City", "Liberty City", "San Andreas", "North Yankton", "Yankton", "Rockstar", "North", "South", "West", "East", "Johanna", "Jojo", "Lääkäri", "Lääke", "Lääkis", "Koulu", "Oppilaitos", "Sairaanhoitaja",
	"Tohtori", "Professori", "Yliopisto", "Perho", "Perhon", "Perhonjokilaakso", "Jokilaakso", "Talouskauppa", "Ikiliikku", "KPO", "S-Market", "K-Market", "Tikkari", "Valkeinen", "OP", "Osuuspankki", "Pankki",
	"Sairaus", "Sairas", "Sairastaa", "Sairastu", "Sairastuin", "Sairastuimme", "Korona", "Koronavirus", "Covid-19", "SARS-COV", "SARS-COV2", "Koronatesti", "Koronatestit", "Testi", "Testata", "Testissä", "Testit",
	"Veikonkone", "Euromarket", "Taloustalo", "Kipakka", "Rautakauppa", "Kauppa", "Google", "Naamakirja", "Veispuuk", "Veispuukki", "naama kirja", "Lärvikirja", "Lärvi kirja",
     ]; 

    const restrictedPhrases = [
        "Ryhmiä Sinulle", "Liity", "Meta AI", "Ihmisiä,", "Joita saatat tuntea", "Ihmisiä, joita saatat tuntea", "Kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea.", "Lisää kavereita saadaksesi suosituksia", "Sisältö ei ole käytettävissä tällä hetkellä", "sinulle ehdotettu", "sinulle ehdotettua",
    ].map(s => s.toLowerCase());

    // Function to check if current path is excluded
    const isExcludedPath = (path) => excludedRegexPatterns.some((pattern) => {
        try {
            pattern.lastIndex = 0;
            return pattern.test(String(path || ''));
        } catch (e) {
            return false;
        }
    });
    
    // Function to check if element matches any safe selector.
    // v16: the native top-left Facebook search dropdown/search form is a hard safe island.
    // No scanners, no row repair, no layout cleanup, no hard-hide classes. Real /search/ pages still filter normally.
    const matchesClosestSelectorSafe = (element, selectors) => {
        try {
            if (!element || !element.closest || !Array.isArray(selectors)) return false;
            return selectors.some(selector => {
                try { return !!element.closest(selector); }
                catch (e) { return false; }
            });
        } catch (e) {
            return false;
        }
    };

    const isFBNativeTopSearchSafeIslandV16 = (element) => {
        try {
            if (!element || !element.closest) return false;

            // Never let this helper immunize real search result pages or feed content.
            if (isFBSearchPagePath && isFBSearchPagePath()) return false;
            if (element.closest('[role="main"]') && !element.closest('[role="banner"]')) return false;

            if (matchesClosestSelectorSafe(element, fbNativeTopSearchSafeSelectorsV16)) return true;

            const row = element.closest('li[role="row"]');
            if (row) {
                const hasSearchBoxHref = !!row.querySelector('a[href*="__epa__=SEARCH_BOX"], a[href*="/search/top/"]');
                const hasHistoryDelete = !!row.querySelector('[title*="historiasta" i], [aria-label*="historiasta" i], [title*="history" i], [aria-label*="history" i], [title*="Remove" i], [aria-label*="Remove" i], [title*="Delete" i], [aria-label*="Delete" i]');
                const looksLikeNativeRow = !!row.querySelector('a[aria-describedby][role="none"][tabindex="-1"]');
                if (hasSearchBoxHref || hasHistoryDelete || looksLikeNativeRow) return true;
            }

            return false;
        } catch (e) {
            return false;
        }
    };

    const isSafeElement = (element) => {
        try {
            if (isFBNativeTopSearchSafeIslandV16(element)) return true;
            if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(element)) return true;
        } catch (e) {}
        try {
            return matchesClosestSelectorSafe(element, safeSelectors);
        } catch (e) {
            return false;
        }
    };

    // ===== TOP-LEFT SEARCH DROPDOWN SURFACE DETECTION =====
    // v12: cheap, hands-off detection. This helper is called by broad scanners every 250ms,
    // so it must NOT walk large subtrees or read innerText on random page elements.
    // It only answers: "is this node part of Facebook's native top-left search surface?"
    const fbTopSearchDropdownDeleteSelector = [
        '[title*="Poista" i]',
        '[aria-label*="Poista" i]',
        '[title*="Remove" i]',
        '[aria-label*="Remove" i]',
        '[title*="Delete" i]',
        '[aria-label*="Delete" i]',
        'svg[title*="Poista" i]',
        'svg[title*="Remove" i]',
        'svg[title*="Delete" i]'
    ].join(',');

    const fbTopLeftSearchDropdownRectOkay = (el) => {
        try {
            if (!el || !el.getBoundingClientRect) return false;
            const rect = el.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) return false;
            // Native FB search dropdown lives in the upper-left-ish header/portal area.
            return rect.top < 700 && rect.left < 980;
        } catch (e) {
            return false;
        }
    };

    const fbElementLooksLikeNativeSearchRow = (row) => {
        try {
            if (!row || !row.matches || !row.matches('li[role="row"]')) return false;
            const anchor = row.querySelector(':scope > a[aria-describedby], :scope > a[href], a[href*="__epa__=SEARCH_BOX"], a[href*="/search/top/"]');
            if (!anchor) return false;

            const href = String(anchor.getAttribute('href') || anchor.href || '');
            return !!(
                row.querySelector(fbTopSearchDropdownDeleteSelector) ||
                /__epa__=SEARCH_BOX/i.test(href) ||
                /\/search\/top\/?\?q=/i.test(href) ||
                /\/profile\.php\?/i.test(href) ||
                /^\/[A-Za-z0-9._-]+(?:[/?#]|$)/i.test(href) ||
                /facebook\.com\/[A-Za-z0-9._-]+/i.test(href)
            );
        } catch (e) {
            return false;
        }
    };

    const getFBTopSearchDropdownContainer = (element) => {
        try {
            if (!element || !element.closest) return null;

            // Never classify normal /search/ results or feed content as the native top-left dropdown.
            if (element.closest('[role="main"]') && !element.closest('[role="banner"]')) return null;

            // Cheapest and most stable case: inside the Facebook header search surface.
            const bannerSearch = element.closest('[role="banner"] form[role="search"], [role="banner"] div[role="search"]');
            if (bannerSearch) return bannerSearch;

            const directSearch = element.closest('form[role="search"], div[role="search"]');
            if (directSearch && fbTopLeftSearchDropdownRectOkay(directSearch)) return directSearch;

            // Portal-ish dropdown rows: protect only if the row/list is physically in the top-left area.
            const row = element.closest('li[role="row"]');
            if (row && fbElementLooksLikeNativeSearchRow(row)) {
                const list = row.closest('ul') || row;
                if (fbTopLeftSearchDropdownRectOkay(row) || fbTopLeftSearchDropdownRectOkay(list)) return list;
            }

            // Search input itself, if Facebook changes wrappers again.
            const input = element.closest('input[placeholder*="Hae Facebookista" i], input[placeholder*="Search Facebook" i], [role="searchbox"], [role="combobox"]');
            if (input && fbTopLeftSearchDropdownRectOkay(input)) return input.closest('form, div') || input;

            return null;
        } catch (e) {
            return null;
        }
    };

    const isTopLeftSearchDropdownElement = (element) => isFBNativeTopSearchSafeIslandV16(element) || !!getFBTopSearchDropdownContainer(element);

    // ===== FACEBOOK NATIVE TOP-LEFT SEARCH SAFE ISLAND v16 =====
    // This intentionally copies the stable 25.1.5 philosophy instead of trying to micro-manage the dropdown:
    // - filter real /search/ result pages;
    // - do not scan, approve, restyle, repair, or hard-hide the native header search dropdown;
    // - keep scanners/CSS alive; only treat the native dropdown itself as a safe Facebook-owned surface.
    let __fbNativeTopSearchActiveUntilV15 = 0;

    const markFBNativeTopSearchActiveV15 = () => {
        try {
            __fbNativeTopSearchActiveUntilV15 = Math.max(__fbNativeTopSearchActiveUntilV15, performance.now() + 3000);
            refreshFBNativeTopSearchHandoffV15();
            addTimeout(refreshFBNativeTopSearchHandoffV15, 400);
            addTimeout(refreshFBNativeTopSearchHandoffV15, 1200);
            addTimeout(refreshFBNativeTopSearchHandoffV15, 3200);
        } catch (e) {}
    };

    const fbNativeTopSearchDropdownExistsV15 = () => {
        try {
            if (isFBSearchPagePath()) return false;
            return !!document.querySelector([
                'ul[role="grid"][aria-label*="ehdotettu haku" i]',
                'ul[role="grid"][aria-label*="suggested search" i]',
                'li[role="row"]:has(a[href*="__epa__=SEARCH_BOX"])',
                'li[role="row"]:has(a[href*="/search/top/"])',
                'li[role="row"]:has([title*="historiasta" i])',
                'li[role="row"]:has([aria-label*="historiasta" i])',
                'li[role="row"]:has([title*="history" i])',
                'li[role="row"]:has([aria-label*="history" i])'
            ].join(','));
        } catch (e) {
            return false;
        }
    };

    const activeElementIsNativeTopSearchV15 = () => {
        try {
            const el = document.activeElement;
            if (!el || !el.closest) return false;
            return !!(
                el.closest('input[placeholder*="Hae Facebookista" i], input[placeholder*="Search Facebook" i], [role="searchbox"], [role="combobox"]') ||
                el.closest('[role="banner"] form[role="search"], [role="banner"] div[role="search"]') ||
                isTopLeftSearchDropdownElement(el)
            );
        } catch (e) {
            return false;
        }
    };

    const isFBNativeTopSearchActiveV15 = () => {
        try {
            if (isFBSearchPagePath()) return false;
            if (performance.now() < __fbNativeTopSearchActiveUntilV15) return true;
            if (activeElementIsNativeTopSearchV15()) return true;
            if (fbNativeTopSearchDropdownExistsV15()) return true;
        } catch (e) {}
        return false;
    };

    const setFBInlineStylePausedForNativeSearchV15 = (_active) => {
        // v16: scanners and CSS stay alive.
        // If a previous v14 run left fb-inline-style disabled with media="not all", restore it.
        try {
            const style = document.getElementById('fb-inline-style');
            if (!style) return;
            if (style.hasAttribute('data-fbcleaner-v15-original-media')) {
                const original = style.getAttribute('data-fbcleaner-v15-original-media') || '';
                if (original) style.setAttribute('media', original);
                else style.removeAttribute('media');
                style.removeAttribute('data-fbcleaner-v15-original-media');
            }
            if (style.getAttribute('media') === 'not all') style.removeAttribute('media');
            style.removeAttribute('data-fbcleaner-v14-original-media');
        } catch (e) {}
    };

    const refreshFBNativeTopSearchHandoffV15 = () => {
        try {
            const active = isFBNativeTopSearchActiveV15();
            if (document.documentElement) {
                document.documentElement.classList.toggle('fb-native-top-search-handoff-v15', active);
            }
            setFBInlineStylePausedForNativeSearchV15(active);
            return active;
        } catch (e) {
            return false;
        }
    };

    const installFBNativeTopSearchHandoffV15 = () => {
        try {
            // Remove stale active dropdown styles from v9-v11. v15 does not inject any row styling.
            [
                'fb-top-search-dropdown-protect-style-v9',
                'fb-top-search-dropdown-native-guard-v10',
                'fb-top-search-dropdown-native-guard-v11'
            ].forEach((id) => {
                try { const style = document.getElementById(id); if (style) style.remove(); } catch (e) {}
            });

            if (document.documentElement) {
                document.documentElement.classList.remove(
                    'fb-top-search-dropdown-active-v9',
                    'fb-top-search-dropdown-active-v10',
                    'fb-top-search-dropdown-active-v11'
                );
            }

            const removeFBCleanerHardHideFromNativeDropdownNodeV15 = (el) => {
                try {
                    if (!el || !el.classList || !el.style) return;
                    el.classList.remove(
                        'fb-element-banned',
                        'fb-post-banned',
                        'fb-search-banned',
                        'fb-search-dropdown-row-banned',
                        'fb-search-dropdown-row-banned-v9',
                        'fb-post-approved',
                        'fb-search-approved',
                        'fb-search-processed',
                        'fb-post-processed'
                    );
                    [
                        'display',
                        'visibility',
                        'opacity',
                        'pointer-events',
                        'position',
                        'left',
                        'top',
                        'width',
                        'min-width',
                        'max-width',
                        'height',
                        'min-height',
                        'max-height',
                        'margin',
                        'padding',
                        'overflow',
                        'content-visibility'
                    ].forEach(prop => {
                        try { el.style.removeProperty(prop); } catch (e) {}
                    });
                    el.removeAttribute('data-processed-text');
                } catch (e) {}
            };

            const repairFBTopSearchDropdownOnceV15 = () => {
                try {
                    const candidates = document.querySelectorAll([
                        'li[role="row"]',
                        'li[role="row"] *',
                        'a[aria-describedby]',
                        'a[href*="__epa__=SEARCH_BOX"]',
                        'a[href*="/search/top/"]'
                    ].join(','));

                    candidates.forEach((el) => {
                        try {
                            if (!isTopLeftSearchDropdownElement(el)) return;
                            const row = el.closest && el.closest('li[role="row"]');
                            if (row) removeFBCleanerHardHideFromNativeDropdownNodeV15(row);
                            removeFBCleanerHardHideFromNativeDropdownNodeV15(el);
                        } catch (e) {}
                    });
                } catch (e) {}
            };

            const schedulePassiveNativeDropdownRepairV15 = () => {
                // v16: intentionally no-op.
                // The old v15 repair walked every dropdown descendant and removed inline width/height/display,
                // which broke Facebook's native row layout into avatars/black squares. Protection now happens by
                // exempting the native search surface from scanners before they touch it.
                try { refreshFBNativeTopSearchHandoffV15(); } catch (e) {}
            };

            const maybeNativeSearchInteractionV15 = (event) => {
                try {
                    const target = event && event.target;
                    if (!target || !target.closest) return;
                    if (
                        target.closest('input[placeholder*="Hae Facebookista" i], input[placeholder*="Search Facebook" i], [role="searchbox"], [role="combobox"]') ||
                        target.closest('[role="banner"] form[role="search"], [role="banner"] div[role="search"]') ||
                        isTopLeftSearchDropdownElement(target)
                    ) {
                        markFBNativeTopSearchActiveV15();
                    }
                } catch (e) {}
            };

            onWindowEvent(document, 'focusin', maybeNativeSearchInteractionV15, true);
            onWindowEvent(document, 'pointerdown', maybeNativeSearchInteractionV15, true);
            onWindowEvent(document, 'click', maybeNativeSearchInteractionV15, true);
            onWindowEvent(document, 'input', maybeNativeSearchInteractionV15, true);
            onWindowEvent(document, 'keydown', maybeNativeSearchInteractionV15, true);
            onWindowEvent(document, 'focusout', () => addTimeout(refreshFBNativeTopSearchHandoffV15, 250), true);
            onWindowEvent(document, 'keyup', () => addTimeout(refreshFBNativeTopSearchHandoffV15, 250), true);
            refreshFBNativeTopSearchHandoffV15();
        } catch (e) {
            console.log('[FBCleaner] Native search dropdown v15 handoff error: ' + e.message);
        }
    };
    
    // Function to get regex blocked words (maintain function signature)
    const getRegexBlockedWords = () => regexBlockedWords;

    // Function to get allowed URLs (maintain function signature)
    const getAllowedUrls = () => allowedUrls;

    // Function to clean the current URL
    const cleanUrl = () => {
        try {
            devLog('Cleaning URL parameters');
            const url = new URL(window.location.href);
            let modified = false;
            
            paramsToDelete.forEach(param => {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    modified = true;
                }
            });
            
            if (modified) {
                window.history.replaceState({}, document.title, url.toString());
                devLog('URL parameters cleaned');
            }
        } catch (e) {
            console.log('Error cleaning URL: ' + e.message);
        }
    };


    // ===== REDIRECT / IDENTITY HELPERS =====
    const normalizeFBText = (value = '') => {
        try {
            return String(value || '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
        } catch (e) {
            return '';
        }
    };

    const safeDecodeFBValue = (value = '') => {
        try {
            let out = String(value || '');
            for (let i = 0; i < 3; i++) {
                try {
                    const decoded = decodeURIComponent(out);
                    if (decoded === out) break;
                    out = decoded;
                } catch (e) { break; }
            }
            return out
                .replace(/\\u0025/g, '%')
                .replace(/\\u0026/g, '&')
                .replace(/\\u003d/g, '=')
                .replace(/\\u003f/g, '?')
                .replace(/\\u002f/g, '/')
                .replace(/\\\//g, '/')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#034;/g, '"')
                .replace(/&#039;/g, "'");
        } catch (e) {
            return String(value || '');
        }
    };

    const isSafeWhitelistedPath = (path = window.location.pathname, url = window.location.href) => {
        try {
            const p = String(path || '').toLowerCase();
            const u = String(url || '').toLowerCase();
            return excludedRegexPatterns.some(regex => {
                try {
                    regex.lastIndex = 0;
                    if (regex.test(p)) return true;
                    regex.lastIndex = 0;
                    return regex.test(u);
                } catch (e) { return false; }
            });
        } catch (e) {
            return false;
        }
    };

    const isNotificationNavigationUrl = (inputUrl = window.location.href) => {
        try {
            const url = new URL(inputUrl, window.location.origin);
            return (
                url.searchParams.has('notif_id') ||
                url.searchParams.has('notif_t') ||
                url.searchParams.get('ref') === 'notif' ||
                /\/(notifications|ilmoitukset)\b/i.test(url.pathname)
            );
        } catch (e) {
            return false;
        }
    };

    const getSanitizedPathSearchForMatching = (inputUrl = window.location.href) => {
        try {
            const url = new URL(inputUrl, window.location.origin);
            ['notif_id', 'notif_t', 'ref'].forEach(param => {
                if (param !== 'ref' || url.searchParams.get('ref') === 'notif') {
                    url.searchParams.delete(param);
                }
            });
            return normalizeFBText(safeDecodeFBValue(url.pathname + url.search));
        } catch (e) {
            return '';
        }
    };

    const matchesBlockedUrlCandidates = (value = '') => {
        try {
            const decoded = safeDecodeFBValue(value);
            return matchesAnyBlockedUrl(decoded) || matchesAnyBlockedUrl(String(value || ''));
        } catch (e) {
            return matchesAnyBlockedUrl(value);
        }
    };


    // Redirects must only use blockedUrls when the *current Facebook URL itself* is blocked.
    // External domains inside l.php/u= links, feed descriptions, or post link previews are handled by DOM hiding,
    // not by redirecting every Facebook route to home.
    const looksLikeDirectFacebookBlockedUrlPattern = (pattern) => {
        try {
            const src = String(pattern && pattern.source || pattern || '').toLowerCase();
            return (
                src.includes('facebook') ||
                src.includes('profile') ||
                src.includes('permalink') ||
                src.includes('story_fbid') ||
                src.includes('pfbid') ||
                src.includes('fbid') ||
                src.includes('posts') ||
                src.includes('photo') ||
                src.includes('photos') ||
                src.includes('video') ||
                src.includes('watch') ||
                src.includes('reel') ||
                src.includes('share') ||
                src.includes('search') ||
                src.includes('friends') ||
                src.includes('notifications') ||
                src.includes('id=')
            );
        } catch (e) {
            return false;
        }
    };

    const matchesDirectFacebookBlockedUrlForRedirect = (inputUrl = window.location.href) => {
        try {
            const url = new URL(inputUrl, window.location.origin);
            if (!/facebook\.com$/i.test(url.hostname) && !/\.facebook\.com$/i.test(url.hostname)) return false;

            // Raw/current URL only. Do NOT decode embedded outbound links here.
            const rawCandidates = [
                String(inputUrl || ''),
                url.href,
                url.pathname + url.search,
                url.pathname
            ];

            return blockedUrls.some((pattern) => {
                try {
                    if (!looksLikeDirectFacebookBlockedUrlPattern(pattern)) return false;
                    return rawCandidates.some(candidate => {
                        try {
                            pattern.lastIndex = 0;
                            return pattern.test(candidate);
                        } catch (e) {
                            return false;
                        }
                    });
                } catch (e) {
                    return false;
                }
            });
        } catch (e) {
            return false;
        }
    };

    const fbValueHasBlockedFbid = (value = '') => {
        try {
            refreshAccountScopedFilters();
            if (!value || !blockedFbids.length) return false;
            const decoded = safeDecodeFBValue(value);
            return blockedFbids.some(fbid => {
                const id = String(fbid || '').trim();
                return !!id && decoded.includes(id);
            });
        } catch (e) {
            return false;
        }
    };

    const fbLooksLikeExplicitIdentityCarrier = (value = '') => {
        try {
            const decoded = safeDecodeFBValue(value).toLowerCase();
            return decoded.includes('hovercard') ||
                   decoded.includes('profile.php?id=') ||
                   decoded.includes('user.php?id=') ||
                   decoded.includes('page.php?id=') ||
                   decoded.includes('profile_id') ||
                   decoded.includes('profileid') ||
                   decoded.includes('page_id') ||
                   decoded.includes('pageid') ||
                   decoded.includes('actor_id') ||
                   decoded.includes('actorid') ||
                   decoded.includes('entity_id') ||
                   decoded.includes('entityid') ||
                   decoded.includes('owner_id') ||
                   decoded.includes('ownerid') ||
                   decoded.includes('user_id') ||
                   decoded.includes('userid') ||
                   decoded.includes('/messages/t/');
        } catch (e) {
            return false;
        }
    };

    const fbExplicitIdentityValueHasBlockedFbid = (value = '') => {
        try {
            return fbValueHasBlockedFbid(value) && fbLooksLikeExplicitIdentityCarrier(value);
        } catch (e) {
            return false;
        }
    };

    const fbElementHasBlockedIdentity = (element) => {
        try {
            if (!element || !element.getAttribute) return false;
            refreshAccountScopedFilters();
            if (!blockedFbids.length) return false;

            const exactAttrs = [
                'data-profileid', 'data-profile-id',
                'data-pageid', 'data-page-id',
                'data-ownerid', 'data-owner-id',
                'data-actorid', 'data-actor-id',
                'data-entityid', 'data-entity-id',
                'data-fbid'
            ];

            for (let i = 0; i < exactAttrs.length; i++) {
                const value = element.getAttribute(exactAttrs[i]);
                if (value && blockedFbids.includes(String(value).trim())) return true;
            }

            const identityAttrs = [
                'href', 'data-hovercard', 'ajaxify', 'data-lynx-uri',
                'data-store', 'data-ft', 'data-testid', 'aria-describedby'
            ];

            for (let i = 0; i < identityAttrs.length; i++) {
                const attr = identityAttrs[i];
                const value = (element.getAttribute(attr) || element[attr] || '');
                if (fbExplicitIdentityValueHasBlockedFbid(value)) return true;
            }
        } catch (e) {}
        return false;
    };

    const fbScopedDocumentHasBlockedIdentity = (allowScriptScan = false) => {
        try {
            refreshAccountScopedFilters();
            if (!blockedFbids.length) return false;

            const scopedElements = document.querySelectorAll([
                '[data-pagelet="ProfileHeader"] [href]',
                '[data-pagelet="ProfileHeader"] [data-hovercard]',
                '[data-pagelet="ProfileHeader"] [ajaxify]',
                '[data-pagelet="ProfileHeader"] [data-profileid]',
                '[data-pagelet="ProfileHeader"] [data-pageid]',
                '[data-pagelet="ProfileHeader"] [data-fbid]',
                '[data-pagelet="PageHeader"] [href]',
                '[data-pagelet="PageHeader"] [data-hovercard]',
                '[data-pagelet="PageHeader"] [ajaxify]',
                '[data-pagelet="PageHeader"] [data-profileid]',
                '[data-pagelet="PageHeader"] [data-pageid]',
                '[data-pagelet="PageHeader"] [data-fbid]',
                'div.x78zum5.xdt5ytf.x12upk82.xod5an3 [href]',
                'div.x78zum5.xdt5ytf.x12upk82.xod5an3 [data-hovercard]',
                'div.x78zum5.xdt5ytf.x12upk82.xod5an3 [ajaxify]',
                'div.x78zum5.xdt5ytf.x12upk82.xod5an3 [data-profileid]',
                'div.x78zum5.xdt5ytf.x12upk82.xod5an3 [data-fbid]',
                'meta[property="al:android:url"]',
                'meta[property="al:ios:url"]',
                'meta[property="og:url"]',
                'meta[content*="profile.php?id="]',
                'meta[content*="page.php?id="]'
            ].join(','));

            for (let i = 0; i < scopedElements.length; i++) {
                const el = scopedElements[i];
                const value = (
                    el.content ||
                    el.href ||
                    el.getAttribute('href') ||
                    el.getAttribute('data-hovercard') ||
                    el.getAttribute('ajaxify') ||
                    el.getAttribute('data-profileid') ||
                    el.getAttribute('data-pageid') ||
                    el.getAttribute('data-fbid') ||
                    el.getAttribute('data-store') ||
                    ''
                );

                if (fbValueHasBlockedFbid(value)) return true;
                if (fbElementHasBlockedIdentity(el)) return true;
            }

            // Delayed profile/page script scan from the older working file.
            // This is the part that often exposes numeric FBIDs on vanity/profile routes.
            if (allowScriptScan && isLikelyProfileOrPageRoute()) {
                const scripts = document.querySelectorAll('script[type="application/json"], script[data-content-len]');
                for (let i = 0; i < scripts.length && i < 30; i++) {
                    const text = scripts[i].textContent || '';
                    if (!text || text.length > 350000) continue;

                    const decoded = safeDecodeFBValue(text);

                    for (let j = 0; j < blockedFbids.length; j++) {
                        const fbid = String(blockedFbids[j] || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        if (!fbid) continue;

                        const pattern = new RegExp(
                            '(?:profile_id|profileID|profileid|page_id|pageID|pageid|actor_id|actorID|actorid|entity_id|entityID|entityid|user_id|userID|userid|owner_id|ownerID|ownerid|id)[^0-9]{0,80}' +
                            fbid +
                            '|' +
                            fbid +
                            '[^a-zA-Z0-9]{0,80}(?:profile|page|actor|entity|user|owner)',
                            'i'
                        );

                        if (pattern.test(decoded)) return true;
                    }
                }
            }
        } catch (e) {}
        return false;
    };

    const fbClickedTargetHasBlockedIdentity = (anchor) => {
        try {
            if (!anchor) return false;
            if (fbElementHasBlockedIdentity(anchor)) return true;

            const children = anchor.querySelectorAll ? anchor.querySelectorAll([
                '[data-profileid]', '[data-profile-id]',
                '[data-pageid]', '[data-page-id]',
                '[data-ownerid]', '[data-owner-id]',
                '[data-actorid]', '[data-actor-id]',
                '[data-entityid]', '[data-entity-id]',
                '[data-hovercard]', '[ajaxify]', '[data-store]',
                '[data-ft]', '[data-fbid]'
            ].join(',')) : [];

            for (let i = 0; i < children.length && i < 20; i++) {
                if (fbElementHasBlockedIdentity(children[i])) return true;
            }

            let parent = anchor.parentElement;
            let depth = 0;
            while (parent && parent !== document.body && depth < 3) {
                if (parent.matches && parent.matches([
                    '[data-profileid]', '[data-profile-id]',
                    '[data-pageid]', '[data-page-id]',
                    '[data-ownerid]', '[data-owner-id]',
                    '[data-actorid]', '[data-actor-id]',
                    '[data-entityid]', '[data-entity-id]',
                    '[data-hovercard]', '[ajaxify]', '[data-fbid]'
                ].join(','))) {
                    if (fbElementHasBlockedIdentity(parent)) return true;
                }
                if (parent.matches && parent.matches('[role="article"], [role="feed"], [role="dialog"], main, [role="main"]')) break;
                parent = parent.parentElement;
                depth++;
            }
        } catch (e) {}
        return false;
    };

    const isInsideComment = (element) => {
        try {
            if (!element || !element.closest) return false;
            if (element.closest('[aria-label*="komment" i], [aria-label*="comment" i], [title*="komment" i], [title*="comment" i], [data-testid*="comment" i]')) return true;

            const article = element.closest('[role="article"]');
            if (article && article.parentElement && article.parentElement.closest('[role="article"]')) return true;

            if (element.closest('ul[role="list"]') && element.closest('[role="dialog"]')) return true;
        } catch (e) {}
        return false;
    };

    const isPostLikeContentUrl = (inputUrl = window.location.href) => {
        try {
            const url = new URL(inputUrl, window.location.origin);
            const raw = url.href.toLowerCase();
            const path = url.pathname.toLowerCase();
            return /\/(posts|permalink|photos|photo|videos|watch|reel|share)(?:\/|$)/i.test(path) ||
                   /\/groups\/[^/]+\/(permalink|posts)\/[^/?#]+/i.test(path) ||
                   /(story_fbid|fbid|multi_permalinks|v)=/i.test(url.search) ||
                   raw.includes('/story.php');
        } catch (e) {
            return false;
        }
    };

    // ===== APPROVED BROWSE CACHE =====
    // Allows comment/permalink/media pages opened from already-approved feed posts.
    // Still lets direct blocked FBID URLs and direct blocked Facebook URLs override the cache.
    const APPROVED_BROWSE_CACHE_STORAGE_KEY = 'fbcleaner_approved_browse_cache_v1';
    const APPROVED_BROWSE_PENDING_NAV_STORAGE_KEY = 'fbcleaner_approved_browse_pending_nav_v1';
    const APPROVED_BROWSE_CACHE_LIMIT = 1250; // MW2 flawless FFA nuke score. Obviously.
    const APPROVED_BROWSE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
    const APPROVED_BROWSE_PENDING_NAV_TTL_MS = 45 * 1000;
    let __approvedBrowseCache = null;
    let __approvedBrowseCacheLoadedAt = 0;

    const markApprovedBrowsePendingNavigation = () => {
        try {
            sessionStorage.setItem(APPROVED_BROWSE_PENDING_NAV_STORAGE_KEY, String(Date.now()));
        } catch (e) {}
    };

    const hasFreshApprovedBrowsePendingNavigation = () => {
        try {
            const ts = Number(sessionStorage.getItem(APPROVED_BROWSE_PENDING_NAV_STORAGE_KEY) || 0);
            return !!ts && Date.now() - ts <= APPROVED_BROWSE_PENDING_NAV_TTL_MS;
        } catch (e) {
            return false;
        }
    };

    const clearApprovedBrowsePendingNavigation = () => {
        try { sessionStorage.removeItem(APPROVED_BROWSE_PENDING_NAV_STORAGE_KEY); } catch (e) {}
    };

    const getFacebookContentKeys = (inputValue = '') => {
        const keys = new Set();
        const add = (prefix, value) => {
            try {
                const clean = safeDecodeFBValue(String(value || '')).replace(/[\s"'<>]+$/g, '').trim();
                if (clean) keys.add(`${prefix}:${clean}`);
            } catch (e) {}
        };

        try {
            const raw = safeDecodeFBValue(String(inputValue || ''));
            if (!raw) return [];

            let url = null;
            try { url = new URL(raw, window.location.origin); } catch (e) {}

            if (url) {
                const path = url.pathname || '';

                const groupMatch = path.match(/\/groups\/[^/]+\/(?:permalink|posts)\/(\d+)/i);
                if (groupMatch && groupMatch[1]) {
                    add('group-post', groupMatch[1]);
                    add('post', groupMatch[1]);
                }

                const pathPost = path.match(/\/(?:posts|permalink)\/(pfbid[^/?#]+)/i);
                if (pathPost && pathPost[1]) add('pfbid', pathPost[1]);

                const pathNumericPost = path.match(/\/(?:posts|permalink)\/(\d+)/i);
                if (pathNumericPost && pathNumericPost[1]) add('post', pathNumericPost[1]);

                const reel = path.match(/\/reel\/(\d+)/i);
                if (reel && reel[1]) add('reel', reel[1]);

                const videoPath = path.match(/\/videos\/(\d+)/i);
                if (videoPath && videoPath[1]) add('video', videoPath[1]);

                const params = url.searchParams;
                const addMultiPermalinkValue = (value) => {
                    try {
                        safeDecodeFBValue(String(value || ''))
                            .split(/[,.]/)
                            .map(v => v.trim())
                            .filter(Boolean)
                            .forEach(v => {
                                add('multi-permalink', v);
                                add('story', v);
                                add('post', v);
                                add('group-post', v);
                            });
                    } catch (e) {}
                };

                ['story_fbid', 'fbid', 'multi_permalinks', 'v'].forEach((name) => {
                    const values = params.getAll(name);
                    if (!values || !values.length) return;
                    values.forEach((value) => {
                        if (!value) return;
                        if (name === 'story_fbid') { add('story', value); add('post', value); }
                        else if (name === 'fbid') { add('fbid', value); add('post', value); }
                        else if (name === 'multi_permalinks') { addMultiPermalinkValue(value); }
                        else if (name === 'v') { add('video', value); }
                    });
                });
            }

            const haystack = raw + ' ' + safeDecodeFBValue(raw);
            const regexes = [
                [/\/groups\/[^/"'\s]+\/(?:permalink|posts)\/(\d+)/ig, ['group-post', 'post']],
                [/[?&]story_fbid=([^&#"'\s]+)/ig, ['story', 'post']],
                [/[?&]fbid=([^&#"'\s]+)/ig, ['fbid', 'post']],
                [/[?&]multi_permalinks=([^&#"'\s]+)/ig, ['multi-permalink', 'story', 'post', 'group-post']],
                [/[?&]v=(\d+)/ig, ['video']],
                [/\/(pfbid[^/?#"'\s]+)/ig, ['pfbid']],
                [/\/reel\/(\d+)/ig, ['reel']],
                [/\/videos\/(\d+)/ig, ['video']]
            ];

            regexes.forEach(([regex, prefixes]) => {
                let match;
                regex.lastIndex = 0;
                while ((match = regex.exec(haystack)) !== null) {
                    prefixes.forEach(prefix => add(prefix, match[1]));
                }
            });
        } catch (e) {}

        return Array.from(keys);
    };

    const loadApprovedBrowseCache = () => {
        const now = Date.now();
        if (__approvedBrowseCache && now - __approvedBrowseCacheLoadedAt < 1500) return __approvedBrowseCache;

        const map = new Map();
        try {
            const raw = sessionStorage.getItem(APPROVED_BROWSE_CACHE_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) {
                parsed.forEach((entry) => {
                    if (!entry) return;
                    const key = String(entry.key || entry[0] || '');
                    const ts = Number(entry.ts || entry[1] || 0);
                    if (key && ts && now - ts <= APPROVED_BROWSE_CACHE_TTL_MS) {
                        const old = map.get(key) || 0;
                        if (ts > old) map.set(key, ts);
                    }
                });
            }
        } catch (e) {}

        __approvedBrowseCache = map;
        __approvedBrowseCacheLoadedAt = now;
        return map;
    };

    const saveApprovedBrowseCache = () => {
        try {
            const now = Date.now();
            const map = loadApprovedBrowseCache();
            const entries = Array.from(map.entries())
                .filter(([, ts]) => now - ts <= APPROVED_BROWSE_CACHE_TTL_MS)
                .sort((a, b) => b[1] - a[1])
                .slice(0, APPROVED_BROWSE_CACHE_LIMIT)
                .map(([key, ts]) => ({ key, ts }));

            __approvedBrowseCache = new Map(entries.map(({ key, ts }) => [key, ts]));
            __approvedBrowseCacheLoadedAt = now;
            sessionStorage.setItem(APPROVED_BROWSE_CACHE_STORAGE_KEY, JSON.stringify(entries));
        } catch (e) {}
    };

    const rememberApprovedContentKeys = (keys) => {
        try {
            if (!keys || !keys.length) return;
            const now = Date.now();
            const map = loadApprovedBrowseCache();
            let changed = false;

            keys.forEach((key) => {
                key = String(key || '').trim();
                if (!key) return;
                if ((map.get(key) || 0) < now) {
                    map.set(key, now);
                    changed = true;
                }
            });

            if (changed) saveApprovedBrowseCache();
        } catch (e) {}
    };

    const rememberApprovedSignalForBrowsing = (signal) => {
        try {
            const keys = getFacebookContentKeys(signal);
            if (keys.length) rememberApprovedContentKeys(keys);
        } catch (e) {}
    };

    const rememberApprovedPostForBrowsing = (post) => {
        try {
            if (!post || !post.classList || !post.classList.contains('fb-post-approved')) return;
            if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) return;

            const signals = [];
            const push = (value) => { if (value) signals.push(String(value)); };
            push(post.getAttribute && post.getAttribute('data-ft'));
            push(post.getAttribute && post.getAttribute('data-store'));
            push(post.getAttribute && post.getAttribute('data-fbcleaner-urlsig'));
            push(post.getAttribute && post.getAttribute('data-fb-urlsig'));

            const nodes = post.querySelectorAll ? Array.from(post.querySelectorAll('a[href], [data-ft], [data-store], [data-fbcleaner-urlsig], [data-fb-urlsig], [ajaxify], [data-hovercard]')).slice(0, 140) : [];
            nodes.forEach((node) => {
                push(node.href || '');
                push(node.getAttribute('href') || '');
                push(node.getAttribute('data-ft') || '');
                push(node.getAttribute('data-store') || '');
                push(node.getAttribute('data-fbcleaner-urlsig') || '');
                push(node.getAttribute('data-fb-urlsig') || '');
                push(node.getAttribute('ajaxify') || '');
                push(node.getAttribute('data-hovercard') || '');
            });

            const keys = new Set();
            signals.forEach((signal) => getFacebookContentKeys(signal).forEach(key => keys.add(key)));
            rememberApprovedContentKeys(Array.from(keys));
        } catch (e) {}
    };

    const currentUrlIsApprovedForBrowsing = (inputUrl = window.location.href) => {
        try {
            const keys = getFacebookContentKeys(inputUrl);
            if (!keys.length) return false;
            const map = loadApprovedBrowseCache();
            const now = Date.now();

            const cached = keys.some((key) => {
                const ts = map.get(key) || 0;
                return ts && now - ts <= APPROVED_BROWSE_CACHE_TTL_MS;
            });
            if (cached) return true;

            // Some FB comment buttons open /groups/<id>/?multi_permalinks=<postid>
            // through React/modal plumbing where the clicked target does not expose a useful href.
            // If the click came from an already-approved post moments ago, bless this new
            // post-like URL once, cache its canonical keys, and then clear the pending pass.
            if (hasFreshApprovedBrowsePendingNavigation() && isPostLikeContentUrl(inputUrl)) {
                rememberApprovedContentKeys(keys);
                clearApprovedBrowsePendingNavigation();
                return true;
            }

            return false;
        } catch (e) {
            return false;
        }
    };


    const approveCurrentApprovedBrowseSurface = () => {
        try {
            if (!currentUrlIsApprovedForBrowsing(window.location.href)) return false;

            const selectors = [
                '[role="dialog"] [role="article"]',
                '[role="article"]',
                'div[data-pagelet^="FeedUnit_"]',
                'div[data-pagelet^="TimelineFeedUnit_"]',
                'div[data-ad-rendering-role="story_message"]',
                'div[data-ad-preview="message"]',
                'div[data-ad-comet-preview="message"]',
                '[data-pagelet="MediaViewer_Sidebar"]',
                '[data-pagelet="TahoeRightRail"]',
                '[data-pagelet="MediaViewerPhoto"]',
                'div.x1iyjqo2.x1vjfegm'
            ].join(',');

            let approvedCount = 0;
            document.querySelectorAll(selectors).forEach((el) => {
                if (!el || !el.classList) return;
                if (el.classList.contains('fb-post-banned') || el.classList.contains('fb-element-banned')) return;
                el.classList.add('fb-post-approved', 'fb-approved-browse-surface', 'fb-post-processed');
                el.classList.remove('fb-post-pending', 'fb-post-scanning', 'fb-post-expanding');
                approvedCount++;
            });

            if (approvedCount > 0) devLog(`Approved ${approvedCount} cached browse surface nodes`);
            return true;
        } catch (e) {
            return false;
        }
    };

    let lastVanityUrl = '';
    let vanityCheckCount = 0;

    const checkVanityProfileFBID = () => {
        try {
            refreshAccountScopedFilters();
            if (isRedirecting) return;

            const currentUrlFull = window.location.href;
            const currentUrl = currentUrlFull.split('?')[0];
            const currentPath = window.location.pathname.toLowerCase();

            if (isSafeWhitelistedPath(currentPath, currentUrlFull)) return;
            if (currentPath === '/' || currentPath.includes('/home.php') || currentPath.includes('/search/')) {
                vanityCheckCount = 151;
                return;
            }

            if (currentUrl !== lastVanityUrl) {
                lastVanityUrl = currentUrl;
                vanityCheckCount = 0;
            }

            if (currentUrl === lastVanityUrl && vanityCheckCount > 150) return;
            vanityCheckCount++;

            // Direct numeric FBIDs and explicit entity carriers must always win,
            // including after SPA navigation. The deeper scan is restricted to
            // profile/page routes so comments/posts do not inherit random IDs.
            if (fbValueHasBlockedFbid(currentUrlFull)) {
                triggerRedirect('blocked numeric FBID in current URL');
                return;
            }

            // If this post/media/permalink was opened from an already-approved feed card,
            // do not let hydrated sidebar/comment/profile identity soup re-trigger redirects.
            if (currentUrlIsApprovedForBrowsing(currentUrlFull)) return;

            if (fbScopedDocumentHasBlockedIdentity(vanityCheckCount >= 2)) {
                triggerRedirect('blocked numeric FBID in scoped page identity');
                return;
            }
        } catch(e) {}
    };

    const isLikelyProfileOrPageRoute = (inputUrl = window.location.href) => {
        try {
            const url = new URL(inputUrl, window.location.origin);
            const path = url.pathname.toLowerCase();
            if (path === '/' || path === '/home.php') return false;
            if (/\/(posts|permalink|photos|photo|videos|watch|reel|share|groups|events|marketplace|messages|messenger|notifications|search|stories|friends|gaming|settings|help)(?:\/|$)/i.test(path)) return false;
            if (url.searchParams.has('comment_id') || url.searchParams.has('reply_comment_id') || url.searchParams.has('focused_comment_id')) return false;
            if (/(story_fbid|fbid|multi_permalinks|v)=/i.test(url.search)) return false;
            return path === '/profile.php' || /^\/[a-z0-9_.-]+\/?$/i.test(path);
        } catch (e) {
            return false;
        }
    };

    const urlPathOrTitleHasBlockedTerms = (inputUrl = window.location.href) => {
        try {
            const raw = getSanitizedPathSearchForMatching(inputUrl);
            const spaced = raw.replace(/[\.\,\-\=\!\?\+\_\@\/]+/g, ' ');
            const compact = raw.replace(/[\.\,\-\=\!\?\+\_\s\@\/]+/g, '');
            const title = normalizeFBText(document.title || '');

            if (matchesAnyActiveRegex(raw) || matchesAnyActiveRegex(spaced) || matchesAnyActiveRegex(title)) return true;

            // Helps with names like first.last.5 or first-last where the regex is plain /first/i.
            return regexBlockedWords.some(regex => {
                try {
                    regex.lastIndex = 0;
                    return regex.test(compact);
                } catch (e) { return false; }
            });
        } catch (e) {
            return false;
        }
    };


    // ===== SCOPED OPEN SHADOW DOM TEXT HELPERS =====
    // Purposefully narrow: open Shadow DOM may contribute TEXT to word/phrase scanners,
    // but never FBID/URL identity signals. Performance version avoids duplicate parent/child
    // text aggregation and uses capped TreeWalkers instead of broad querySelectorAll('*') crawls.
    const FB_SHADOW_TEXT_SELECTOR = [
        'span[dir="auto"]',
        'div[dir="auto"]',
        'h1', 'h2', 'h3', 'h4',
        '[data-ad-comet-preview="message"]',
        '[data-ad-preview="message"]',
        '[data-ad-rendering-role="story_message"]',
        'p',
        'span',
        'div'
    ].join(',');

    const FB_PROFILE_HEADER_PROTECT_SELECTOR = [
        '[data-pagelet="ProfileHeader"]',
        '[data-pagelet="PageHeader"]',
        '[data-pagelet="ProfileActions"]',
        'h1',
        'svg[role="img"][style*="168px"]',
        'a[aria-label][href*="/photo/?fbid="]',
        'a[href*="/friends_all/"]',
        'a[href*="/friends_mutual/"]',
        '[role="button"][aria-label="Kaverit"]',
        '[role="button"][aria-label="Friends"]',
        '[role="button"][aria-label="Lähetä viesti"]',
        '[role="button"][aria-label="Message"]',
        '[aria-label="Profiilikuvan toiminnot"]',
        '[aria-label="Profile picture actions"]',
        '[aria-label="Muokkaa kansikuvaa"]',
        '[aria-label="Edit cover photo"]',
        'a[aria-label="Lisää tarinaan"]',
        'a[aria-label="Add to story"]',
        'a[aria-label="Muokkaa profiilia"]',
        'a[aria-label="Edit profile"]'
    ].join(',');

    const __fbRestrictedWordsChecked = new WeakSet();
    const __fbRestrictedPhraseHeadersChecked = new WeakSet();

    const shadowTextOptions = (options = {}) => ({
        maxHostSearchNodes: options.maxHostSearchNodes ?? 160,
        maxShadowHosts: options.maxShadowHosts ?? 8,
        maxShadowNodes: options.maxShadowNodes ?? 70,
        maxTextNodes: options.maxTextNodes ?? 90,
        maxNestedHosts: options.maxNestedHosts ?? 4,
        maxChars: options.maxChars ?? 8000,
        maxDepth: options.maxDepth ?? 1,
        includeAttributes: options.includeAttributes === true,
        selector: options.selector || FB_SHADOW_TEXT_SELECTOR
    });

    const isProfileHeaderProtectedArea = (element) => {
        try {
            return !!(
                element &&
                element.nodeType === 1 &&
                (
                    (element.matches && element.matches(FB_PROFILE_HEADER_PROTECT_SELECTOR)) ||
                    (element.closest && element.closest(FB_PROFILE_HEADER_PROTECT_SELECTOR)) ||
                    (element.querySelector && element.querySelector(FB_PROFILE_HEADER_PROTECT_SELECTOR))
                )
            );
        } catch (e) {
            return false;
        }
    };

    const isShadowTextUsableElement = (element) => {
        try {
            if (!element || element.nodeType !== 1) return false;
            if (element.matches && element.matches('script, style, template, noscript, meta, link')) return false;
            if (element.hidden || (element.getAttribute && element.getAttribute('aria-hidden') === 'true')) return false;
            if (element.closest && element.closest('[hidden], [aria-hidden="true"], script, style, template, noscript')) return false;
            if (isInsideComment(element)) return false;
            return true;
        } catch (e) {
            return false;
        }
    };

    const collectTextInsideOpenShadowRoot = (shadowRoot, options = {}, depth = 0, seenRoots) => {
        try {
            const opts = shadowTextOptions(options);
            if (!shadowRoot || depth > opts.maxDepth) return '';
            if (!seenRoots) seenRoots = new WeakSet();
            try {
                if (seenRoots.has(shadowRoot)) return '';
                seenRoots.add(shadowRoot);
            } catch (e) {}

            let text = '';
            let textNodes = 0;

            const push = (value) => {
                if (!value || text.length >= opts.maxChars) return;
                text += ' ' + String(value).slice(0, Math.max(0, opts.maxChars - text.length));
            };

            try {
                const walker = document.createTreeWalker(
                    shadowRoot,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode(node) {
                            if (textNodes >= opts.maxTextNodes) return NodeFilter.FILTER_REJECT;
                            const value = node && node.nodeValue ? node.nodeValue.trim() : '';
                            if (!value) return NodeFilter.FILTER_REJECT;
                            const parent = node.parentElement || node.parentNode;
                            if (!isShadowTextUsableElement(parent)) return NodeFilter.FILTER_REJECT;
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                );
                let node;
                while ((node = walker.nextNode()) && text.length < opts.maxChars && textNodes < opts.maxTextNodes) {
                    textNodes++;
                    push(node.nodeValue);
                }
            } catch (e) {}

            // Attribute text is opt-in and should only be used in narrow UI/button contexts.
            if (opts.includeAttributes && shadowRoot.querySelectorAll && text.length < opts.maxChars) {
                try {
                    const attrMatches = shadowRoot.querySelectorAll('[aria-label], [title], img[alt]');
                    for (let i = 0; i < attrMatches.length && i < opts.maxShadowNodes && text.length < opts.maxChars; i++) {
                        const el = attrMatches[i];
                        if (!isShadowTextUsableElement(el)) continue;
                        push((el.getAttribute && el.getAttribute('aria-label')) || '');
                        push((el.getAttribute && el.getAttribute('title')) || '');
                        push((el.getAttribute && el.getAttribute('alt')) || '');
                    }
                } catch (e) {}
            }

            // Support nested open shadow roots, but keep it tiny. Facebook pages are already spicy enough.
            if (depth < opts.maxDepth && shadowRoot.querySelectorAll && text.length < opts.maxChars) {
                try {
                    const walker = document.createTreeWalker(shadowRoot, NodeFilter.SHOW_ELEMENT);
                    let el;
                    let scanned = 0;
                    let hosts = 0;
                    while ((el = walker.nextNode()) && scanned < opts.maxHostSearchNodes && hosts < opts.maxNestedHosts && text.length < opts.maxChars) {
                        scanned++;
                        if (el && el.shadowRoot) {
                            hosts++;
                            push(collectTextInsideOpenShadowRoot(el.shadowRoot, opts, depth + 1, seenRoots));
                        }
                    }
                } catch (e) {}
            }

            return text;
        } catch (e) {
            return '';
        }
    };

    const collectOpenShadowTextScoped = (root, options = {}) => {
        try {
            if (!root || root.nodeType !== 1) return '';
            const opts = shadowTextOptions(options);
            let text = '';
            let scanned = 0;
            let hosts = 0;

            const push = (value) => {
                if (!value || text.length >= opts.maxChars) return;
                text += ' ' + String(value).slice(0, Math.max(0, opts.maxChars - text.length));
            };

            if (root.shadowRoot) {
                hosts++;
                push(collectTextInsideOpenShadowRoot(root.shadowRoot, opts));
            }

            if (hosts >= opts.maxShadowHosts || text.length >= opts.maxChars) return text;

            try {
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                let el;
                while ((el = walker.nextNode()) && scanned < opts.maxHostSearchNodes && hosts < opts.maxShadowHosts && text.length < opts.maxChars) {
                    scanned++;
                    if (el && el.shadowRoot) {
                        hosts++;
                        push(collectTextInsideOpenShadowRoot(el.shadowRoot, opts));
                    }
                }
            } catch (e) {}

            return text;
        } catch (e) {
            return '';
        }
    };

    const collectLightAndOpenShadowTextScoped = (root, lightText = '', options = {}) => {
        try {
            return normalizeFBText(String(lightText || '') + ' ' + collectOpenShadowTextScoped(root, options));
        } catch (e) {
            return normalizeFBText(lightText || '');
        }
    };

    const querySelectorAllOpenShadowScoped = (root, selector, options = {}) => {
        const results = [];
        const seen = new WeakSet();
        const add = (el) => {
            try {
                if (!el || seen.has(el)) return;
                seen.add(el);
                results.push(el);
            } catch (e) {}
        };

        try {
            if (!root || !selector) return results;
            const opts = shadowTextOptions(options);
            const maxNodes = options.maxNodes ?? 80;

            const scanRoot = (scanRootValue, depth) => {
                if (!scanRootValue || depth > opts.maxDepth || results.length >= maxNodes) return;
                try {
                    if (scanRootValue.nodeType === 1 && scanRootValue.matches && scanRootValue.matches(selector)) add(scanRootValue);
                } catch (e) {}
                try {
                    if (scanRootValue.querySelectorAll) {
                        const matches = scanRootValue.querySelectorAll(selector);
                        for (let i = 0; i < matches.length && results.length < maxNodes; i++) add(matches[i]);
                    }
                } catch (e) {}
                try {
                    const walker = document.createTreeWalker(scanRootValue, NodeFilter.SHOW_ELEMENT);
                    let el;
                    let scanned = 0;
                    let hosts = 0;
                    while ((el = walker.nextNode()) && scanned < opts.maxHostSearchNodes && hosts < opts.maxShadowHosts && results.length < maxNodes) {
                        scanned++;
                        if (el && el.shadowRoot) {
                            hosts++;
                            scanRoot(el.shadowRoot, depth + 1);
                        }
                    }
                } catch (e) {}
                try {
                    if (scanRootValue.shadowRoot) scanRoot(scanRootValue.shadowRoot, depth + 1);
                } catch (e) {}
            };

            scanRoot(root, 0);
        } catch (e) {}
        return results;
    };

    const collectScopedText = (root, maxNodes = 120) => {
        try {
            if (!root || !root.querySelectorAll) return '';
            const nodes = Array.from(root.querySelectorAll([
                'span[dir="auto"]',
                'div[dir="auto"]',
                'h1', 'h2', 'h3', 'h4',
                '[data-ad-comet-preview="message"]',
                '[data-ad-preview="message"]',
                '[data-ad-rendering-role="story_message"]',
                '[aria-label]',
                '[title]'
            ].join(','))).slice(0, maxNodes);

            let text = '';
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (isInsideComment(node)) continue;
                text += ' ' + (node.textContent || '');
                text += ' ' + ((node.getAttribute && node.getAttribute('aria-label')) || '');
                text += ' ' + ((node.getAttribute && node.getAttribute('title')) || '');
            }
            return text;
        } catch (e) {
            return '';
        }
    };

    const currentProfileOrPageHasBlockedIdentityOrTerms = () => {
        try {
            // Excluded/self/family-safe profile routes must never be redirected by broad
            // profile-header/title/metadata regex checks. Direct blocked FBID/current-URL
            // checks happen earlier in handleRedirects/checkVanityProfileFBID.
            if (isSafeWhitelistedPath(window.location.pathname, window.location.href)) return false;

            // Strictly header/title/url only. Do NOT scan ProfileTimeline/ProfileTilesFeed here,
            // because normal profile posts can contain banned terms and would otherwise redirect almost every profile.
            const areas = Array.from(document.querySelectorAll([
                '[data-pagelet="ProfileHeader"]',
                '[data-pagelet="PageHeader"]',
                'div.x78zum5.xdt5ytf.x12upk82.xod5an3'
            ].join(','))).slice(0, 8);

            for (let i = 0; i < areas.length; i++) {
                const area = areas[i];
                const signalParts = [collectScopedText(area, 80)];

                const signalNodes = area.querySelectorAll ? area.querySelectorAll('a[href], [data-hovercard], [ajaxify], [data-profileid], [data-pageid], [data-fbid], [data-store], [aria-label], [title]') : [];
                for (let j = 0; j < signalNodes.length && j < 80; j++) {
                    const el = signalNodes[j];
                    if (fbElementHasBlockedIdentity(el)) return true;
                    signalParts.push(el.href || '');
                    signalParts.push(el.getAttribute('href') || '');
                    signalParts.push(el.getAttribute('data-hovercard') || '');
                    signalParts.push(el.getAttribute('ajaxify') || '');
                    signalParts.push(el.getAttribute('data-profileid') || '');
                    signalParts.push(el.getAttribute('data-pageid') || '');
                    signalParts.push(el.getAttribute('data-fbid') || '');
                    signalParts.push(el.getAttribute('data-store') || '');
                    signalParts.push(el.getAttribute('aria-label') || '');
                    signalParts.push(el.getAttribute('title') || '');
                }

                const signal = signalParts.join(' ');
                if (matchesAnyActiveRegex(signal) || matchesAnyBlockedFbid(signal)) return true;
                if (matchesDirectFacebookBlockedUrlForRedirect(signal)) return true;
            }

            // Metadata is okay for profile/page redirect because it represents the current page identity,
            // not random timeline/feed content.
            const metas = document.querySelectorAll('meta[property="og:title"], meta[property="og:url"], meta[property="al:android:url"], meta[property="al:ios:url"], meta[name="description"], title');
            for (let i = 0; i < metas.length; i++) {
                const el = metas[i];
                const value = el.content || el.textContent || '';
                if (matchesAnyActiveRegex(value) || fbExplicitIdentityValueHasBlockedFbid(value)) return true;
                if (matchesDirectFacebookBlockedUrlForRedirect(value)) return true;
            }
        } catch (e) {}
        return false;
    };

    const currentMediaOrPostViewHasBlockedCaption = () => {
        try {
            if (!isPostLikeContentUrl(window.location.href)) return false;

            /*
             * Photo/post pages are annoying because the caption often is NOT inside
             * FeedUnit_/story_message nodes. In the current photo viewer dump, the useful
             * caption is this standalone wrapper:
             *
             *   div.xyinxu5.xyri2b.x1g2khh7.x1c1uobl > span[dir="auto"]
             *
             * The previous scanner mostly searched descendants of known pagelets, so this
             * exact caption node could sit there waving banned words at us like a tiny
             * goblin with diplomatic immunity. This scanner keeps the old safe behavior,
             * but adds the actual caption wrappers/selectors from the photo view.
             */
            const directCaptionSelectors = [
                'div.xyinxu5.xyri2b.x1g2khh7.x1c1uobl',
                'div.xyinxu5.xyri2b.x1g2khh7.x1c1uobl > span[dir="auto"]',
                'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xo1l8bm.xzsf02u[dir="auto"]',
                '[data-ad-rendering-role="story_message"]',
                '[data-ad-preview="message"]',
                '[data-ad-comet-preview="message"]'
            ].join(',');

            const areaSelectors = [
                '[data-pagelet="MediaViewer_Sidebar"]',
                '[data-pagelet="TahoeRightRail"]',
                '[data-pagelet="MediaViewerPhoto"]',
                '[data-pagelet^="FeedUnit_"]',
                '[data-pagelet^="TimelineFeedUnit_"]',
                'div[role="dialog"]',
                '[role="article"]',
                directCaptionSelectors
            ].join(',');

            const textNodesSelector = [
                directCaptionSelectors,
                'span[dir="auto"]',
                'div[dir="auto"]',
                'h1', 'h2', 'h3', 'h4',
                '[data-ad-comet-preview="message"]',
                '[data-ad-preview="message"]',
                '[data-ad-rendering-role="story_message"]',
                '[aria-label]',
                '[title]',
                'a[href]',
                '[data-fbcleaner-urlsig]',
                '[data-fb-urlsig]'
            ].join(',');

            const targetAreas = Array.from(document.querySelectorAll(areaSelectors)).slice(0, 40);
            let textToScan = '';

            const addNodeSignals = (node) => {
                try {
                    if (!node || isInsideComment(node)) return;

                    textToScan += ' ' + (node.textContent || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('aria-label')) || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('title')) || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('href')) || '');
                    textToScan += ' ' + (node.href || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('data-fbcleaner-urlsig')) || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('data-fb-urlsig')) || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('data-hovercard')) || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('ajaxify')) || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('data-store')) || '');
                    textToScan += ' ' + ((node.getAttribute && node.getAttribute('data-ft')) || '');
                } catch (e) {}
            };

            for (let i = 0; i < targetAreas.length; i++) {
                const area = targetAreas[i];
                if (!area || isInsideComment(area)) continue;

                // Include the area itself. This matters for exact caption wrappers.
                addNodeSignals(area);

                const nodes = Array.from(area.querySelectorAll ? area.querySelectorAll(textNodesSelector) : []).slice(0, 180);
                for (let j = 0; j < nodes.length; j++) {
                    addNodeSignals(nodes[j]);
                }
            }

            // Fallback for photo URLs where FB doesn't expose stable pagelet wrappers:
            // scan the right-side visible caption-like text nodes directly, but still let
            // isInsideComment() reject actual comments/replies.
            if (!textToScan.trim()) {
                const looseCaptionNodes = Array.from(document.querySelectorAll(directCaptionSelectors)).slice(0, 25);
                for (let i = 0; i < looseCaptionNodes.length; i++) {
                    addNodeSignals(looseCaptionNodes[i]);
                }
            }

            const rawSignal = safeDecodeFBValue(textToScan);
            const normalized = normalizeFBText(rawSignal);
            if (!normalized) return false;

            // Individual post/photo/video/reel pages should redirect when the caption or
            // description itself contains blocked terms. Do not apply allowedWords here:
            // UI words like "Send", "Message", "Reply", etc. would otherwise shield the page.
            return matchesAnyActiveRegex(normalized);
        } catch (e) {
            return false;
        }
    };

    // Handle redirects for blocked content
    const handleRedirects = () => {
        try {
            refreshAccountScopedFilters();
            if (isRedirecting) return;

            const url = new URL(window.location.href);
            const isHome = url.pathname === '/' || url.pathname === '/home.php';
            if (isHome) return;
            if (lastRedirect === url.href) return;
            if (isSafeWhitelistedPath(url.pathname, url.href)) return;

            // 1. Hard current-URL redirects only:
            //    - scoped blocked FBIDs anywhere in the current URL
            //    - blockedUrls only when the current Facebook URL itself is a directly-blocked FB URL
            if (fbValueHasBlockedFbid(url.href) || matchesDirectFacebookBlockedUrlForRedirect(url.href)) {
                triggerRedirect('blocked current URL/direct FB URL');
                return;
            }

            // Approved browse cache: if this post/media/permalink/comment page came from an
            // already-approved feed card, let it breathe. Direct blocked FBIDs/URLs above still win.
            if (currentUrlIsApprovedForBrowsing(url.href)) {
                devLog('Allowing approved cached post/media/permalink browsing');
                return;
            }

            if (fbScopedDocumentHasBlockedIdentity(false)) {
                triggerRedirect('blocked scoped identity');
                return;
            }

            // 2. Profile/page route redirects by actual page identity: path/title/header/name/metadata.
            //    This intentionally does NOT scan normal timeline/feed content.
            if (isLikelyProfileOrPageRoute(url.href)) {
                if (urlPathOrTitleHasBlockedTerms(url.href) || currentProfileOrPageHasBlockedIdentityOrTerms()) {
                    triggerRedirect('blocked profile/page identity/name/url');
                    return;
                }
            }

            // 3. Photo/post/video/reel caption/description redirects.
            //    This is limited to post-like routes and skips comment-ish areas.
            if (currentMediaOrPostViewHasBlockedCaption()) {
                triggerRedirect('blocked media/post caption');
                return;
            }
        } catch (e) {
            console.log('Error handling redirects: ' + e.message);
        }
    };

    // Enhanced function to handle deleting images/links with blocked FBIDs and URLs.
    // Optimized: scans only elements that can actually carry URLs/IDs and caches signatures.
    const deleteBlockedElements = () => {
        try {
            refreshAccountScopedFilters();
            const elements = document.querySelectorAll([
                'img[src]',
                'source[srcset]',
                'a[href]',
                '[data-fbid]',
                '[data-profileid]',
                '[data-pageid]',
                '[data-hovercard]',
                '[ajaxify]',
                '[data-lynx-uri]',
                '[data-store]',
                '[data-ft]'
            ].join(','));

            let deletedCount = 0;

            elements.forEach(element => {
                if (!element || isSafeElement(element) || isTopLeftSearchDropdownElement(element) || isInsideComment(element)) return;

                const values = [
                    element.src || '',
                    element.getAttribute('srcset') || '',
                    element.href || '',
                    element.getAttribute('href') || '',
                    element.getAttribute('data-fbid') || '',
                    element.getAttribute('data-profileid') || '',
                    element.getAttribute('data-pageid') || '',
                    element.getAttribute('data-hovercard') || '',
                    element.getAttribute('ajaxify') || '',
                    element.getAttribute('data-lynx-uri') || '',
                    element.getAttribute('data-store') || '',
                    element.getAttribute('data-ft') || ''
                ];

                const parentLink = element.closest && element.closest('a[href]');
                if (parentLink) {
                    values.push(parentLink.href || '');
                    values.push(parentLink.getAttribute('href') || '');
                }

                const signature = values.join('||');
                if (element.getAttribute('data-fbcleaner-urlsig') === signature) return;
                element.setAttribute('data-fbcleaner-urlsig', signature);

                const signal = safeDecodeFBValue(signature);
                const hasBlockedFbid = matchesAnyBlockedFbid(signal) || fbElementHasBlockedIdentity(element);
                const hasBlockedUrl = matchesBlockedUrlCandidates(signal);

                if (hasBlockedFbid || hasBlockedUrl) {
                    const elementToDelete =
                        element.closest('[data-pagelet^="FeedUnit_"]') ||
                        element.closest('[data-pagelet^="TimelineFeedUnit_"]') ||
                        element.closest('[role="article"]') ||
                        element.closest('[role="listitem"], li, [role="row"]') ||
                        element.closest('div') ||
                        element;

                    if (elementToDelete && !elementToDelete.closest('[role="banner"]') && !elementToDelete.closest('[role="navigation"]')) {
                        hideElementHard(elementToDelete, 'fb-element-banned');
                        deletedCount++;
                    }
                }
            });

            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} blocked elements`);
            }
        } catch (e) {
            console.log('Error deleting blocked elements: ' + e.message);
        }
    };

    // ENHANCED: Function to scan and ban entire posts initially to prevent "Show more" issues
    // UPDATED: Add fb-post-approved class to non-banned posts for immediate visibility
    const scanAndBanEntirePosts = () => {
        try {
            devLog('Scanning entire posts for banned content');
            const postSelectors = [
                'div[data-pagelet^="FeedUnit_"]',
                'div[data-pagelet^="TimelineFeedUnit_"]',
                '[role="feed"] [role="article"]',
                '[role="article"]',
                '[role="article"].x1lliihq',
                '[role="article"] .x1yztbdb',
                '[role="article"] .x1hc1fzr',
                'div.x1iyjqo2.x1vjfegm'
            ];

            let bannedCount = 0;
            const seenPosts = new WeakSet();
            postSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(candidate => {
                    const post = getFBFeedUnitWrapperV23(candidate) || (candidate.closest && candidate.closest('[role="article"]')) || candidate;
                    if (!post || seenPosts.has(post)) return;
                    seenPosts.add(post);
                    if (post.classList.contains('fb-post-processed')) return;
                    if (isProfileHeaderProtectedArea(post)) return;
                    if (isTopLeftSearchDropdownElement(post)) return;
                    post.classList.add('fb-post-processed');

                    // Fast path: light DOM text first. Only ask Shadow DOM if the light DOM did not already decide.
                    const lightText = normalizeFBText(post.innerText || post.textContent || '');
                    let fullPostText = lightText;

                    // Check against all blocking criteria
                    let isBanned = false;

                    if (hasRestrictedFeedCTAOrReelsV23(post)) {
                        isBanned = true;
                        devLog(`🚫 Post banned by v23 home-feed CTA/Reels structure`);
                    }

                    if (!isBanned && matchesAnyActiveRegex(fullPostText)) {
                        isBanned = true;
                        devLog(`🚫 Post banned by active regex in light content`);
                    }

                    if (!isBanned) {
                        const shadowText = collectOpenShadowTextScoped(post, {
                            maxHostSearchNodes: 160,
                            maxShadowHosts: 8,
                            maxTextNodes: 80,
                            maxShadowNodes: 50,
                            maxChars: 8000,
                            maxDepth: 1,
                            includeAttributes: false
                        });
                        if (shadowText) {
                            fullPostText = normalizeFBText(lightText + ' ' + shadowText);
                            if (matchesAnyActiveRegex(fullPostText)) {
                                isBanned = true;
                                devLog(`🚫 Post banned by active regex in open Shadow DOM text`);
                            }
                        }
                    }

                    // Check for blocked FBIDs in post attributes or links. Still light-DOM only.
                    if (!isBanned) {
                        const postLinks = post.querySelectorAll('a[href]');
                        for (let link of postLinks) {
                            const href = link.href;
                            if (matchesAnyBlockedFbid(href)) {
                                isBanned = true;
                                devLog(`🚫 Post banned by FBID in links`);
                                break;
                            }
                        }
                    }

                    // Check for blocked URLs in post. Still light-DOM only.
                    if (!isBanned) {
                        const postLinks = post.querySelectorAll('a[href]');
                        for (let link of postLinks) {
                            if (matchesAnyBlockedUrl(link.href)) {
                                isBanned = true;
                                devLog(`🚫 Post banned by URL in post`);
                                break;
                            }
                        }
                    }

                    if (isBanned) {
                        post.classList.remove('fb-feed-unit-approved', 'fb-post-approved');
                        post.querySelectorAll?.('[role="article"]').forEach(article => {
                            try { article.classList.remove('fb-post-approved'); } catch (e) {}
                        });
                        post.classList.add('fb-post-banned');
                        post.style.setProperty('display', 'none', 'important');
                        post.style.setProperty('visibility', 'hidden', 'important');
                        post.style.setProperty('opacity', '0', 'important');
                        post.style.setProperty('pointer-events', 'none', 'important');
                        post.style.setProperty('position', 'absolute', 'important');
                        post.style.setProperty('left', '-9999px', 'important');
                        post.style.setProperty('top', '-9999px', 'important');
                        post.style.setProperty('height', '0', 'important');
                        post.style.setProperty('width', '0', 'important');
                        post.style.setProperty('overflow', 'hidden', 'important');
                        bannedCount++;
                    } else {
                        post.classList.add('fb-post-approved', 'fb-feed-unit-approved');
                        markFBFeedUnitApprovedV23(post);
                        rememberApprovedPostForBrowsing(post);
                    }
                });
            });

            if (bannedCount > 0) {
                devLog(`Banned ${bannedCount} entire posts initially`);
            }
        } catch (e) {
            console.log('Error scanning entire posts: ' + e.message);
        }
    };

    // IMPORTANT: This function must be separate to ensure reels are removed
    const deleteRestrictedWords = () => {
        try {
            const selectors = [
                '[role="article"]',
                '[role="article"].x1lliihq',
                '[role="article"] .x1yztbdb',
                '[role="article"] .x1hc1fzr',
                'div.x1iyjqo2.x1vjfegm',
        		'svg[aria-label="Meta AI:n profiilikuva"]',
        		'svg[aria-label*="Meta AI profile"]', 
        		'a[aria-label="Meta AI"]',
        		'div[aria-label="Meta AI"]',
        		'span[aria-label="Meta AI"]',
                'div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xn6708d.x1120s5i.x1ye3gou',
                'div.x10l6tqk.xwa60dl.x1d8287x.x19991ni.xwji4o3.x1vjfegm.xg01cxk.x47corl',
                'div.x1iyjqo2.x1vjfegm',
                'div.x6s0dn4.x78zum5.x1qughib.x1iorvi4.xjkvuk6',
                '.x1y71gwh',
                '.x1p5oq8j',
                'div.xieb3on:nth-child(1)',
                'div.xieb3on:nth-child(1) > svg:nth-child(1)',
                '.x1p5oq8j > div:nth-child(2)',
                'div.x6s0dn4.x78zum5.x1qughib.x1iorvi4.xjkvuk6',
        		'a[aria-label*="20. heinäkuu klo 14.53"]',
        		'a[href*="facebook.com/permalink"][aria-label*="20. heinäkuu klo 14.53"]'
            ];

            let removedCount = 0;
            document.querySelectorAll(selectors.join(','))
                .forEach(element => {
                    if (isSafeElement(element) || isTopLeftSearchDropdownElement(element)) return;
                    if (isProfileHeaderProtectedArea(element)) return;
                    if (__fbRestrictedWordsChecked.has(element)) return;
                    __fbRestrictedWordsChecked.add(element);

                    const elementToRemove = element.closest('[role="article"]') || element;
                    // Approved/banned posts are intentionally final decisions; do not re-scan them here.
                    if (elementToRemove.classList.contains('fb-post-approved') || elementToRemove.classList.contains('fb-post-banned') || elementToRemove.classList.contains('fb-element-banned')) return;
                    
                    let elementText = normalizeFBText(element.innerText || element.textContent || '');
                    let isRegexBlocked = matchesAnyActiveRegex(elementText);
                    if (!isRegexBlocked) {
                        const shadowText = collectOpenShadowTextScoped(element, {
                            maxHostSearchNodes: 120,
                            maxShadowHosts: 6,
                            maxTextNodes: 60,
                            maxShadowNodes: 40,
                            maxChars: 6000,
                            maxDepth: 1,
                            includeAttributes: false
                        });
                        if (shadowText) {
                            elementText = normalizeFBText(elementText + ' ' + shadowText);
                            isRegexBlocked = matchesAnyActiveRegex(elementText);
                        }
                    }
                    const isRestricted = false;
                    
                    if (isRestricted || isRegexBlocked) {
                        // UPDATED: Do not hide approved posts (even if comments have banned content)
                        if (!elementToRemove.classList.contains('fb-post-approved') && !elementToRemove.classList.contains('fb-post-banned') && !elementToRemove.classList.contains('fb-element-banned')) {
                            elementToRemove.classList.add('fb-element-banned');
                            elementToRemove.style.setProperty('display', 'none', 'important');
                            elementToRemove.style.setProperty('visibility', 'hidden', 'important');
                            elementToRemove.style.setProperty('opacity', '0', 'important');
                            elementToRemove.style.setProperty('pointer-events', 'none', 'important');
                            elementToRemove.style.setProperty('position', 'absolute', 'important');
                            elementToRemove.style.setProperty('left', '-9999px', 'important');
                            elementToRemove.style.setProperty('top', '-9999px', 'important');
                            elementToRemove.style.setProperty('height', '0', 'important');
                            elementToRemove.style.setProperty('width', '0', 'important');
                            elementToRemove.style.setProperty('overflow', 'hidden', 'important');
                            removedCount++;
                        }
                    }
                });
                
            if (removedCount > 0) {
                devLog(`Removed ${removedCount} elements with restricted words`);
            }
        } catch (e) {
            console.log('Error deleting restricted words: ' + e.message);
        }
    };

    // ENHANCED: Instant search result filtering with comprehensive blocking
    const processSearchResults = () => {
        try {
            updateFBSearchPageClass();

            if (!isFBSearchPagePath()) return;

            const searchSelectors = [
                'li[role="row"]',
                'a[aria-describedby]',
                'div[role="option"]',
                'div[data-testid="search-result"]',
                'div[role="presentation"] a',
                'a[href*="facebook.com/profile.php"]',
                'a[href*="facebook.com/"][aria-describedby]'
            ];

            searchSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(result => {
                    // 25.1.5 behavior: do not process top/header/nav search UI.
                    // This is the key part for the native recent-search dropdown.
                    if (result.closest('[role="banner"]') || result.closest('[role="navigation"]') || isTopLeftSearchDropdownElement(result)) return;
                    if (isSafeElement(result)) return;

                    const textContent = (result.textContent || result.innerText || '').toLowerCase();
                    const processedText = result.getAttribute('data-processed-text');

                    if (result.classList.contains('fb-search-processed') && processedText === textContent) return;

                    result.classList.add('fb-search-processed');
                    result.setAttribute('data-processed-text', textContent);

                    const href = result.href || '';
                    const ariaLabel = result.getAttribute('aria-label') || '';
                    const dataHover = result.getAttribute('data-hovercard') || '';
                    const signal = `${textContent} ${ariaLabel} ${href} ${dataHover}`;

                    let isBlocked = false;

                    if (matchesAnyActiveRegex(signal)) isBlocked = true;
                    if (!isBlocked && matchesAnyBlockedFbid(`${href} ${dataHover}`)) isBlocked = true;
                    if (!isBlocked && matchesAnyBlockedUrl(href)) isBlocked = true;
                    if (!isBlocked && matchesBlockedUrlCandidates(href)) isBlocked = true;

                    if (isBlocked) {
                        result.style.setProperty('display', 'none', 'important');
                        result.style.setProperty('visibility', 'hidden', 'important');
                        result.style.setProperty('opacity', '0', 'important');
                        result.style.setProperty('pointer-events', 'none', 'important');
                        result.style.setProperty('position', 'absolute', 'important');
                        result.style.setProperty('left', '-9999px', 'important');
                        result.style.setProperty('top', '-9999px', 'important');
                        result.classList.add('fb-search-banned');
                        result.classList.remove('fb-search-approved');

                        const parentLi = result.closest('li');
                        if (parentLi && parentLi !== result) {
                            parentLi.style.setProperty('display', 'none', 'important');
                            parentLi.style.setProperty('visibility', 'hidden', 'important');
                            parentLi.classList.add('fb-search-banned');
                            parentLi.classList.remove('fb-search-approved');
                        }
                    } else {
                        result.classList.add('fb-search-approved');
                        result.classList.remove('fb-search-banned');
                        result.style.removeProperty('display');
                        result.style.removeProperty('visibility');
                        result.style.removeProperty('opacity');
                        result.style.removeProperty('pointer-events');
                        result.style.removeProperty('position');
                        result.style.removeProperty('left');
                        result.style.removeProperty('top');

                        const parentLi = result.closest('li');
                        if (parentLi && parentLi !== result) {
                            parentLi.classList.add('fb-search-approved');
                            parentLi.classList.remove('fb-search-banned');
                            parentLi.style.removeProperty('display');
                            parentLi.style.removeProperty('visibility');
                        }
                    }
                });
            });
        } catch (e) {
            console.log('Error processing search results: ' + e.message);
        }
    };

    // IMPORTANT: This function must be separate to ensure reels are removed from feed
    const deleteRestrictedPhrases = () => {
        try {
            // Cache restricted phrases in lowercase for faster matching
            const restrictedPhrasesLower = [
                "liity", "reels", "kelat", "sinulle suositeltua", "suositeltua", "tilaa", "ryhmiä sinulle", "Meta AI", "ihmisiä,", "joita saatat tuntea", "ihmisiä, joita saatat tuntea", 
                "kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea.", "lisää kavereita saadaksesi suosituksia", "Sisältö ei ole käytettävissä tällä hetkellä", "sinulle ehdotettua",
            ];

            // Use a Set for faster lookups
            const restrictedPhrasesSet = new Set(restrictedPhrasesLower);
            
            // Cache processed header elements across runs to avoid re-processing
            const processedElements = __fbRestrictedPhraseHeadersChecked;

            let removedPostCount = 0;
            // Only process new feed articles
            document.querySelectorAll('[role="feed"] [role="article"]:not([data-processed])').forEach((post) => {
                if (isProfileHeaderProtectedArea(post)) return;
                // Mark as processed to avoid re-processing
                post.dataset.processed = "true";
                
                // Check for restricted button text first (fastest check), including buttons inside open Shadow DOM.
                let shouldRemove = false;
                const buttons = querySelectorAllOpenShadowScoped(post, 'div[role="button"], button[role="button"], button', {
                    maxNodes: 60,
                    maxHostSearchNodes: 120,
                    maxShadowHosts: 6,
                    maxDepth: 1
                });
                
                // Use faster for loop instead of Array.from.some
                for (let i = 0; i < buttons.length && !shouldRemove; i++) {
                    const btnText = collectLightAndOpenShadowTextScoped(
                        buttons[i],
                        (buttons[i].innerText || buttons[i].textContent || ''),
                        {
                            maxHostSearchNodes: 50,
                            maxShadowHosts: 4,
                            maxTextNodes: 35,
                            maxShadowNodes: 25,
                            maxChars: 2200,
                            maxDepth: 1,
                            includeAttributes: true
                        }
                    );
                    const normalizedBtnText = String(btnText || '').replace(/\s+/g, ' ').trim().toLowerCase();
                    if (FB_RESTRICTED_FEED_CTA_TEXT_V23.has(normalizedBtnText)) {
                        shouldRemove = true;
                    }
                }
                
                // If no restricted buttons, check for phrases in key elements only
                if (!shouldRemove) {
                    // Only check headings and key containers rather than all text, including open Shadow DOM.
                    const keyElements = querySelectorAllOpenShadowScoped(post, 'h2, h3, h4, div.x1heor9g, div[role="button"], button', {
                        maxNodes: 90,
                        maxHostSearchNodes: 140,
                        maxShadowHosts: 6,
                        maxDepth: 1
                    });
                    
                    for (let i = 0; i < keyElements.length && !shouldRemove; i++) {
                        const text = collectLightAndOpenShadowTextScoped(
                            keyElements[i],
                            (keyElements[i].innerText || keyElements[i].textContent || ''),
                            {
                                maxHostSearchNodes: 70,
                                maxShadowHosts: 4,
                                maxTextNodes: 45,
                                maxShadowNodes: 35,
                                maxChars: 3500,
                                maxDepth: 1,
                                includeAttributes: false
                            }
                        );
                        
                        // Check for exact restricted phrases
                        for (let i = 0; i < restrictedPhrasesLower.length; i++) {
                            if (text.includes(restrictedPhrasesLower[i])) {
                                shouldRemove = true;
                                break;
                            }
                        }
                    }
                }
                
                if (!shouldRemove && hasRestrictedFeedCTAOrReelsV23(post)) {
                    shouldRemove = true;
                }

                if (shouldRemove) {
                    // Hide/remove the whole FeedUnit wrapper when possible so blank shells do not remain.
                    const targetPost = getFBFeedUnitWrapperV23(post) || post;
                    if (!targetPost.classList.contains('fb-post-banned') && !targetPost.classList.contains('fb-element-banned')) {
                        targetPost.classList.remove('fb-feed-unit-approved', 'fb-post-approved');
                        targetPost.classList.add('fb-element-banned');
                        targetPost.style.display = 'none';
                        targetPost.style.visibility = 'hidden';
                        
                        const parent = targetPost.parentNode;
                        if (parent) parent.removeChild(targetPost);
                        removedPostCount++;
                    }
                }
            });
            
            // Look for non-article restricted content (like Reels sections)
            // Use more specific selectors and skip already processed elements
            const headerSelectors = 'h2.html-h2, h3.html-h3, h2, h3, div.html-h2.xdj266r, [aria-label="Kelat"][role="region"], [aria-label="Reels"][role="region"]';
            let removedHeaderCount = 0;
            document.querySelectorAll(headerSelectors).forEach(header => {
                // Skip if already processed or in navigation
                if (processedElements.has(header) || 
                    header.closest('header') || 
                    header.closest('[role="navigation"]') || 
                    header.closest('[role="banner"]') ||
                    isProfileHeaderProtectedArea(header)) {
                    return;
                }
                
                // Mark as processed
                processedElements.add(header);
                
                const headerText = collectLightAndOpenShadowTextScoped(
                    header,
                    (header.innerText || header.textContent || ''),
                    {
                        maxHostSearchNodes: 80,
                        maxShadowHosts: 4,
                        maxTextNodes: 45,
                        maxShadowNodes: 35,
                        maxChars: 3500,
                        maxDepth: 1,
                        includeAttributes: false
                    }
                );
                
                // Check if this is a restricted header
                let isRestricted = false;
                for (let i = 0; i < restrictedPhrasesLower.length && !isRestricted; i++) {
                    if (headerText.includes(restrictedPhrasesLower[i])) {
                        isRestricted = true;
                    }
                }
                
                if (isRestricted) {
                    // Find the parent section/container
                    let container = null;
                    
                    // Try these containers in order
                    if (!container) container = getFBFeedUnitWrapperV23(header);
                    if (!container) container = header.closest('[role="article"]');
                    if (!container) container = header.closest('div.x1lliihq');
                    if (!container) container = header.closest('div.x1ye3gou');
                    if (!container) container = header.closest('div.x78zum5:not([role="navigation"])');
                    
                    // Only remove if it's a valid container (not navigation and has size)
                    if (container && 
                        !container.closest('[role="navigation"]') && 
                        !container.closest('[role="banner"]') &&
                        container.offsetHeight > 40) {
                        
                        // Hide first, then remove
                        if (!container.classList.contains('fb-post-banned') && !container.classList.contains('fb-element-banned')) {
                            container.classList.add('fb-element-banned');
                            container.style.display = 'none';
                            
                            // Use direct parent removal for better performance
                            const parent = container.parentNode;
                            if (parent) parent.removeChild(container);
                            removedHeaderCount++;
                        }
                    }
                }
            });
            
            if (removedPostCount > 0 || removedHeaderCount > 0) {
                devLog(`Removed ${removedPostCount} posts and ${removedHeaderCount} headers with restricted phrases`);
            }
        } catch (e) {
            console.log('Error deleting restricted phrases: ' + e.message);
        }
    };

    // More efficient observer implementation
    let __fbPhrasesObserverInstalled = false;
    const observeForRestrictedPhrases = () => {
        try {
            if (!document.body || __fbPhrasesObserverInstalled) return;
            __fbPhrasesObserverInstalled = true;

            devLog('Setting up restricted phrases observer');
            
            // Use a throttled version of the function for better performance
            let throttleTimeout = null;
            const throttledDeletePhrases = () => {
                if (!throttleTimeout) {
                    throttleTimeout = addTimeout(() => {
                        deleteRestrictedPhrases();
                        throttleTimeout = null;
                    }, 220); // 220ms throttle, smoother on slower machines
                }
            };

            // Observe only essential changes
            const observer = trackObserver(new MutationObserver((mutations) => {
                if (typeof refreshFBNativeTopSearchHandoffV15 === 'function') refreshFBNativeTopSearchHandoffV15();
                let shouldProcess = false;
                
                // Check if any mutation is relevant
                for (let i = 0; i < mutations.length; i++) {
                    const mutation = mutations[i];
                    
                    // Check for feed content
                    if (mutation.target.closest && 
                        (mutation.target.closest('[role="feed"]') || 
                         mutation.target.getAttribute?.('role') === 'feed')) {
                        shouldProcess = true;
                        break;
                    }
                    
                    // Check for added nodes with relevant content
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        for (let j = 0; j < mutation.addedNodes.length; j++) {
                            const node = mutation.addedNodes[j];
                            if (node.nodeType === 1) { // Element node
                                if (node.querySelector && (
                                    node.querySelector('h2.html-h2') || 
                                    node.querySelector('[role="article"]') ||
                                    node.querySelector('div.x1lliihq')
                                )) {
                                    shouldProcess = true;
                                    break;
                                }
                            }
                        }
                        if (shouldProcess) break;
                    }
                }
                
                // Only process if relevant mutations were found
                if (shouldProcess) {
                    scrubRestrictedFeedUnitsV23();
                    throttledDeletePhrases();
                }
            }));

            observer.observe(document.body, { 
                childList: true, 
                subtree: true,
                attributes: false,
                characterData: false
            });

            // Run once immediately
            deleteRestrictedPhrases();
        } catch (e) {
            console.log('Error setting up restricted phrases observer: ' + e.message);
        }
    };

    // More efficient initialization
    if (document.readyState === 'loading') {
        onWindowEvent(window, 'DOMContentLoaded', observeForRestrictedPhrases, false);
    } else {
        // Use requestIdleCallback for non-blocking initialization if available (tracked to avoid leaks)
        addIdleCallback(observeForRestrictedPhrases);
    }

    // Function to delete "People You May Know" sections
    const deletePeopleYouMayKnow = () => {
        try {
            const selectors = [
                'div[aria-label="People You May Know"]',
                'div[aria-label="Ihmisiä, jotka saatat tuntea"]',
                'a[href="https://www.facebook.com/friends/suggestions/"]',
                'div[aria-label="Näytä suosituksia"]',
                'a[href="https://www.facebook.com/friends/"]',
                'a[aria-label="Kaverit"][href*="/friends"]',
                'a[aria-label="Friends"][href*="/friends"]',
                'a[href="/friends/"]',
                'div[aria-label="Kaverit"] > span.x1lliihq',
                'li.x1iyjqo2.xmlsiyf.x1hxoosp.x1l38jg0.x1awlv9s.x1i64zmx.x1gz44f',
                '.x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1)',
                'div.x1i10hfl:nth-child(13)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(1)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(2)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(3)',
                '.x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty)',
                'svg[aria-label="Meta AI:n profiilikuva"]',
                'svg[aria-label*="Meta AI profile"]',
                'div.x1gefphp.xf7dkkf.x1l90r2v.xv54qhq.xyamay9.x1e56ztr.x78zum5.x9f619.x1olyfxc.x15x8krk.xde0f50.x5a5i1n.x1obq294.x6s0dn4:nth-of-type(6)',
                '.xjkvuk6.x1iorvi4.x1qughib.x78zum5.x6s0dn4',
                '.x1vjfegm.x1iyjqo2',
                'div.x1a02dak:nth-child(3) > div:nth-child(1)',
                'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)',
                'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
                '.x1ye3gou.x1120s5i.xn6708d.xz9dl7a.x1qughib.x1q0g3np.x78zum5',
                '.xbbxn1n.xwxc41k.xxbr6pl.x1p5oq8j.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div',
                '.x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
                /* ENHANCED: All PYMK selectors for instant hiding */
                '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6',
                '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d',
                'svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z',
                'div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo'
            ];

            let deletedCount = 0;
            document.querySelectorAll(selectors.join(','))
                .forEach(element => {
                    if (isTopLeftSearchDropdownElement(element)) return;
                    if (!element.classList.contains('fb-element-banned')) {
                        element.classList.add('fb-element-banned');
                        element.style.setProperty('display', 'none', 'important');
                        element.style.setProperty('visibility', 'hidden', 'important');
                        element.style.setProperty('opacity', '0', 'important');
                        element.style.setProperty('pointer-events', 'none', 'important');
                        element.style.setProperty('position', 'absolute', 'important');
                        element.style.setProperty('left', '-9999px', 'important');
                        element.style.setProperty('top', '-9999px', 'important');
                        element.style.setProperty('height', '0', 'important');
                        element.style.setProperty('width', '0', 'important');
                        element.style.setProperty('overflow', 'hidden', 'important');
                        deletedCount++;
                    }
                });
                
            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} "People You May Know" elements`);
            }
        } catch (e) {
            console.log('Error deleting People You May Know: ' + e.message);
        }
    };

    // Delete specific elements
    const deleteElement = () => {
        try {
            const selectors = [
                'div[aria-label="Näytä suosituksia"].x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x1ypdohk.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5',
                'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suosituksia"]',
                'div[aria-label="Näytä suosituksia"] .x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x',
                'div[aria-label="Näytä suosituksia"] .x1ey2m1c.xds687c.x17qophe.xg01cxk.x47corl.x10l6tqk.x13vifvy.x1ebt8du.x19991ni.x1dhq9h.x1o1ewxj.x3x9cwd.x1e5q0jg.x3x9cwd',
                'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suosituksia"] .x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x',
                'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suosituksia"] .x1ey2m1c.xds687c.x17qophe.xg01cxk.x47corl.x10l6tqk.x13vifvy.x1ebt8du.x19991ni.x1dhq9h.x1o1ewxj.x3x9cwd',
                'div.x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
        		'[aria-label="Näytä suositukset"]',
                '[role="button"][aria-label="Näytä suositukset"]'
            ];

            let deletedCount = 0;
            document.querySelectorAll(selectors.join(','))
                .forEach(element => {
                    if (!element.classList.contains('fb-element-banned')) {
                        element.classList.add('fb-element-banned');
                        element.style.setProperty('display', 'none', 'important');
                        element.style.setProperty('visibility', 'hidden', 'important');
                        element.style.setProperty('opacity', '0', 'important');
                        element.style.setProperty('pointer-events', 'none', 'important');
                        element.style.setProperty('position', 'absolute', 'important');
                        element.style.setProperty('left', '-9999px', 'important');
                        element.style.setProperty('top', '-9999px', 'important');
                        element.style.setProperty('height', '0', 'important');
                        element.style.setProperty('width', '0', 'important');
                        element.style.setProperty('overflow', 'hidden', 'important');
                        deletedCount++;
                    }
                });
                
            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} specific elements`);
            }
        } catch (e) {
            console.log('Error deleting specific elements: ' + e.message);
        }
    };

    // FIXED: Helper function with proper URL matching
    function isSupportedFacebookPage(currentUrl, supportedPages) {
        try {
            const url = new URL(currentUrl);
            
            return supportedPages.some(pageUrl => {
                try {
                    const page = new URL(pageUrl);
                    // Must be same host
                    if (url.host !== page.host) return false;
                    
                    // Extract the page path (e.g., "/four3four")
                    const basePath = page.pathname.replace(/\/+$/, '');
                    const currentPath = url.pathname.replace(/\/+$/, '');
                    
                    // Exact match OR subpage match
                    return currentPath === basePath || currentPath.startsWith(basePath + '/');
                } catch (e) {
                    return false;
                }
            });
        } catch (e) {
            return false;
        }
    }

    // ENHANCED: Inject CSS for specific URL prehide to prevent flashes on supported pages
    const injectSpecificUrlPrehideCSS = () => {
        try {
            const currentUrl = window.location.href;
            const supportedUrls = [
                "https://www.facebook.com/four3four",
                "https://www.facebook.com/ItsStillRealToUsDammit",
                "https://www.facebook.com/prowrestlingworld",
                "https://www.facebook.com/weirdimagesworthseeing"
            ];

            // Only inject on supported heavy pages; remove the sheet after SPA navigation away.
            if (!isSupportedFacebookPage(currentUrl, supportedUrls)) {
                try {
                    const oldStyle = document.getElementById('fb-specific-url-prehide-style');
                    if (oldStyle) oldStyle.remove();
                } catch (e) {}
                return;
            }

            devLog('Injecting specific URL prehide CSS for supported pages');
            let style = document.getElementById('fb-specific-url-prehide-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'fb-specific-url-prehide-style';
            }
            style.textContent = `
            /* PREHIDE CSS: Hide selectors immediately on supported pages to prevent flashes */
            .x1120s5i.x1n2onr6.x10wlt62.x6ikm8r.x1lliihq,
            .x1cnzs8.xjkvuk6.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6,
            .xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619,
            .x7wzq59 > div > div > div > .x1yztbdb > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f61,
            .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w > .xt0psk2,
            footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w,
            .x1xzczws.x7ep2pv.x1d1medc.xnp8db0.x1i64zmx.x1e56ztr.x1emribx.x1xmf6yo.xjl7jj.xs83m0k.xeuugli.x1ja2u2z.x1n2onr6.x9f619,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph > .xeuug,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1k70j0n.xzueoph > .xeuug,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619,
            .xifccgj.x4cne27.xbmpl8g.xykv574.x1y1aw1k.xwib8y2.x1ye3gou.xn6708d.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619,
            .x1y1aw1k.x150jy0e.x1e558r4.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619,
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo,
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6 > .x2lwn1j.x1iyjqo2.x,
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6,
            .x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n,
            .xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619,
            .x1x99re3.x1jdnuiz.x1r1pt67.x1qhmfi1.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k,
            .xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.xh8yej3.xdsb8wn.x10l6tqk.x5yr21d.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x2lah0s.x78zum5.x1ja2u2z.x9f619,
            .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1n2onr6.x10wlt62.x6ikm8r.x1ja2u2z.x9f619,
            div[aria-label="Photos"],
            .xieb3on,
            div.x9f619.x1n2onr6.x1ja2u2z.xeuugli.xs83m0k.xjl7jj.x1xmf6yo.x1xegmmw.x1e56ztr.x13fj5qh.xnp8db0.x1d1medc.x7ep2pv.x1xzczws,
            '*:contains("Suositeltu")',
            '*:contains("Recommended")',
            'div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so.xau1kf4.x9f619.xh8yej3.x6ikm8r.x10wlt62.xquyuld:has(.x1k70j0n.xzueoph)',
            footer .xi81zsa,
            .xh8yej3 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r,
            h2.html-h2.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1vvkbs.x1heor9g.x1qlqyl8.x1pd3egz.x1a2a7pz.x193iq5w.xeuugli {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                content-visibility: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
            `;
            // Safe append (no document.write)
            if (!style.isConnected) {
                if (document.head) {
                    document.head.appendChild(style);
                    devLog('Specific URL prehide CSS injected to head');
                } else if (document.documentElement) {
                    document.documentElement.appendChild(style);
                    devLog('Specific URL prehide CSS injected to documentElement');
                }
            } else {
                devLog('Specific URL prehide CSS updated (reuse existing style node)');
            }
        } catch (err) {
            console.log('Error while injecting specific URL prehide CSS: ' + err.message);
        }
    };

    // Run specific URL prehide CSS injection immediately
    injectSpecificUrlPrehideCSS();

// FIXED: Function to delete elements for specific URLs - now with proper URL restriction
const deleteSelectorsForSpecificUrl = () => {
        try {
            const currentUrl = window.location.href;
            const supportedUrls = [
                "https://www.facebook.com/four3four",
                "https://www.facebook.com/ItsStillRealToUsDammit",
                "https://www.facebook.com/prowrestlingworld",
                "https://www.facebook.com/weirdimagesworthseeing"
            ];
            
            const isSupported = supportedUrls.some(pageUrl => {
                try {
                    const url = new URL(currentUrl);
                    const page = new URL(pageUrl);
                    if (url.host !== page.host) return false;
                    const basePath = page.pathname.replace(/\/+$/, '');
                    const currentPath = url.pathname.replace(/\/+$/, '');
                    return currentPath === basePath || currentPath.startsWith(basePath + '/');
                } catch (e) { return false; }
            });
            
            if (!isSupported) return;

            // 25.1.5-style safe hiding, kept local so no other redirect/block functions are touched.
            const isSpecificUrlDangerousToHide = (el) => {
                if (!el) return true;
                if (el === document.body || el === document.documentElement) return true;

                try {
                    if (el.matches && el.matches('header, nav, [role="banner"], [role="navigation"]')) return true;
                    if (el.matches && el.matches('main, [role="main"], [role="feed"], #mount_0_0_fb, #globalContainer, #content')) return true;

                    if (el.querySelector && el.querySelector('main, [role="main"], [role="feed"], [data-pagelet="ProfileTimeline"]')) return true;

                    if (el.querySelector && (el.querySelector('div[aria-label="Luo julkaisu"]') || el.querySelector('div[aria-label="Create a post"]'))) return true;

                    const txt = el.textContent || '';
                    if (txt.includes('Mitä mietit') || txt.includes("What's on your mind")) return true;
                } catch (e) {}

                return false;
            };

            const isSpecificUrlSafeElement = (element) => {
                if (!element || !element.closest) return false;

                try {
                    const elText = (element.textContent || '').toLowerCase();
                    const elAria = (element.getAttribute('aria-label') || '').toLowerCase();

                    // Keep the old exception behavior: Meta AI / unfriend-like targets must still be hideable.
                    if (elText.includes('poista kavereista') || elText.includes('meta ai') || elAria.includes('meta ai')) {
                        return false;
                    }

                    if (Array.isArray(safeSelectors)) {
                        const isInsideSafe = safeSelectors.some(selector => {
                            try { return element.closest(selector) !== null; }
                            catch (e) { return false; }
                        });
                        if (isInsideSafe) return true;
                    }

                    // This is the important 25.1.5-style skeleton protection.
                    if (element.hasAttribute('data-visualcompletion') && element.getAttribute('data-visualcompletion') === 'loading-state') return true;
                    if (element.getAttribute('role') === 'progressbar') return true;
                    if (element.querySelector && (element.querySelector('[data-visualcompletion="loading-state"]') || element.querySelector('[role="progressbar"]'))) return true;
                } catch (e) {}

                return false;
            };

            const safelyHideSpecificUrlElement = (element) => {
                if (!element) return;
                if (isSpecificUrlSafeElement(element)) return;
                if (isSpecificUrlDangerousToHide(element)) return;

                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('pointer-events', 'none', 'important');
                element.style.setProperty('position', 'absolute', 'important');
                element.style.setProperty('left', '-9999px', 'important');
                element.style.setProperty('top', '-9999px', 'important');
                element.style.setProperty('height', '0', 'important');
                element.style.setProperty('width', '0', 'important');
                element.style.setProperty('overflow', 'hidden', 'important');

                try {
                    if (!element.classList.contains('fb-element-banned')) element.classList.add('fb-element-banned');
                } catch (e) {}
            };


            const selectorsToDelete = [
                '.x1120s5i.x1n2onr6.x10wlt62.x6ikm8r.x1lliihq',
                'div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so.xau1kf4.x9f619.xh8yej3.x6ikm8r.x10wlt62.xquyuld:has(.x1k70j0n.xzueoph)',
                '.x1cnzs8.xjkvuk6.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6',
                '.xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
                '.x7wzq59 > div > div > div > .x1yztbdb > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f61',
                '.xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w > .xt0psk2',
                'footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w',
                '.x1xzczws.x7ep2pv.x1d1medc.xnp8db0.x1i64zmx.x1e56ztr.x1emribx.x1xmf6yo.xjl7jj.xs83m0k.xeuugli.x1ja2u2z.x1n2onr6.x9f619',
                '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph > .xeuug',
                '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1k70j0n.xzueoph > .xeuug',
                '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph',
                '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.xifccgj.x4cne27.xbmpl8g.xykv574.x1y1aw1k.xwib8y2.x1ye3gou.xn6708d.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
                '.x1y1aw1k.x150jy0e.x1e558r4.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
                '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6 > .x2lwn1j.x1iyjqo2.x',
                '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6',
                '.x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n',
                '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.x1x99re3.x1jdnuiz.x1r1pt67.x1qhmfi1.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14zmp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k',
                '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.xh8yej3.xdsb8wn.x10l6tqk.x5yr21d.x1q0g3np.xozqiw3.x1qjc9v5.xqughib.x2lah0s.x78zum5.x1ja2u2z.x9f619',
                '.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1n2onr6.x10wlt62.x6ikm8r.x1ja2u2z.x9f619',
                'div[aria-label="Photos"]',
                '.xieb3on',
		        'footer .xi81zsa',
		        'footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w',
                'div.x9f619.x1n2onr6.x1ja2u2z.xeuugli.xs83m0k.xjl7jj.x1xmf6yo.x1xegmmw.x1e56ztr.x13fj5qh.xnp8db0.x1d1medc.x7ep2pv.x1xzczws',
                'div[data-pagelet^="ProfileTilesFeed_"]:has(a[href*="/photos"])',
                'h2:has(a[href*="/photos"])'
            ];

            selectorsToDelete.forEach(selector => {
                if (selector.includes(':has(')) {
                    const hasMatch = selector.match(/^(.*?):has\((.*?)\)$/);
                    if (hasMatch) {
                        document.querySelectorAll(hasMatch[1]).forEach(element => {
                            if (isSpecificUrlSafeElement(element)) return; 
                            if (element.querySelector(hasMatch[2]) && !element.classList.contains('fb-element-banned')) {
                                safelyHideSpecificUrlElement(element);
                            }
                        });
                    }
                } else {
                    document.querySelectorAll(selector).forEach(element => {
                        if (isSpecificUrlSafeElement(element)) return; 
                        safelyHideSpecificUrlElement(element);
                    });
                }
            });
        } catch (e) {}
    };

    // FIXED: Function to delete elements for specific profiles - now with proper URL restriction
    const deleteSelectorsForSpecificProfile = () => {
        try {
            const currentUrl = window.location.href;
            const url = new URL(currentUrl);
            const profileIds = [
                '100000639309471',
        	'jiri.innanen'
                // Add more profile IDs or vanity usernames here
            ];

            // FIXED: Strictly match only these profile pages
            const matchesProfile = profileIds.some(profileId => {
                return (
                    (url.pathname === '/profile.php' && url.searchParams.get('id') === profileId) ||
                    (url.pathname === `/${profileId}` || url.pathname === `/${profileId}/`)
                );
            });
            
            // FIXED: Only run if we're actually on one of the specified profiles
            if (!matchesProfile) {
                return; // Exit early if not on specified profile
            }
            
            devLog('Applying selectors for specific profiles');
            const selectorsToDelete = [
                '.x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n',
                '.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > div > .x1jfb8zj.x1qrby5j.x1n2onr6.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.x1qhmfi1.x1pdmqnj.x9f619.x178xt8z.xm81vs4.xso031l.xy80clv.x1xmf6yo',
                '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.x78zum5 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div',
                '.x78zum5 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
                '.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xamitd3.xeuugli.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x78zum5',
                '.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xamitd3.xeuugli.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
                '.x2lah0s.xvo6coq.x1ve1bff.x1q0g3np.xozqiw3.x1qjc9v5.xl56j7k.x1n2onr6.x78zum5.x1ja2u2z.x9f619 > .x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.x2lah0s.xvo6coq.x1ve1bff.x1q0g3np.xozqiw3.x1qjc9v5.xl56j7k.x1n2onr6.x78zum5.x1ja2u2z.x9f619',
                '.x7wzq59.x1xzczws.x1ja2u2z.x9f619',
                'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x13vifvy.x16tdsg8.x1xmf6yo',
                'div.x78zum5.x12nagc.x1n2onr6.x1s6qhgt:empty',
                '.x7wzq59 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2)',
                '.x7wzq59 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)',
                'div.xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619:nth-of-type(2)',
                'div.x1yztbdb:nth-child(2)',
                'div.x1yztbdb:nth-child(2) > div:nth-child(1)',
                'div.x1yztbdb:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.x1yztbdb:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(1)',
                'div.xamitd3:nth-child(2)',
                'div.xamitd3:nth-child(2) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > span:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > span:nth-child(1) > span:nth-child(1) > span:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2)',
                '.x6d00yu',
                'mount_0_0_9k > div > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div.x78zum5.xdt5ytf.x1t2pt76 > div > div > div.x6s0dn4.x78zum5.xdt5ytf.x193iq5w > div.x9f619.x193iq5w.x1talbiv.x1sltb1f.x3fxtfs.xf7dkkf.xv54qhq.xw7yly9 > div > div.x9f619.x1n2onr6.x1ja2u2z.xeuugli.xs83m0k.xjl7jj.x1xmf6yo.x1xegmmw.x1e56ztr.x13fj5qh.xnp8db0.x1d1medc.x7ep2pv.x1xzczws > div.x7wzq59 > div > div:nth-child(2) > div > div',
                'div[aria-label="Suodattimet"]',
                'div[aria-label="Filters"]',
                'div[aria-label="Suodattimet"][role="button"]',
                'div[aria-label="Filters"][role="button"]',
                '.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k',
                '.x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.x14ldlfn.x1b1wa69.xws8118.x5fzff1.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.xpdmqnj.x1g0dm76.x1qhmfi1.x1r1pt67',
                'h2:contains("Julkaisut")',
                'span:contains("Julkaisut")',
                'div:contains("Suodattimet")',
                'span:contains("Suodattimet")'
            ];
            
            let deletedCount = 0;
            const hideProfileSpecificElement = (element) => {
                if (!element || element.classList.contains('fb-element-banned')) return;
                if (isSafeElement(element) || isTopLeftSearchDropdownElement(element)) return;
                if (isProfileHeaderProtectedArea(element)) return;
                if (typeof isDangerousToHide === 'function' && isDangerousToHide(element)) return;
                collapseElementHard(element);
                deletedCount++;
            };

            selectorsToDelete.forEach(selector => {
                try {
                    const containsMatch = selector.match(/^(.*?):contains\("(.*?)"\)$/);
                    if (containsMatch) {
                        const tag = containsMatch[1].trim().toLowerCase();
                        const needle = containsMatch[2];
                        const candidates = Array.from(document.querySelectorAll(tag)).slice(0, 120);
                        candidates.forEach(element => {
                            if ((element.textContent || '').includes(needle)) hideProfileSpecificElement(element);
                        });
                        return;
                    }

                    document.querySelectorAll(selector).forEach(hideProfileSpecificElement);
                } catch (e) {
                    // Selector drift is normal on Facebook. Skip broken selectors instead of aborting the whole pass.
                }
            });
            
            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} elements for specific profiles`);
            }
        } catch (e) {
            console.log('Error deleting selectors for specific profiles: ' + e.message);
        }
    };

// Function to delete elements for a personal profile - now with support for multiple URLs
const deleteSelectorsForPersonalProfile = () => {
    try {
        const currentUrl = window.location.href;

        // Allowed URLs: add strings (exact match, trailing slash ignored) or RegExp patterns.
        const allowedUrls = [
		'https://www.facebook.com/Haukkis/friends',
		'https://www.facebook.com/Haukkis/friends_all',
		'https://www.facebook.com/Haukkis/friends_with_upcoming_birthdays'	
        ];

        // Normalize URL (ignore hash, handle trailing slash) and test against allowlist
        const normalizeForCompare = (u) => {
            try {
                const url = new URL(u);
                url.hash = '';
                return url.toString().replace(/\/+$/, '');
            } catch {
                return String(u).replace(/#.*$/, '').replace(/\/+$/, '');
            }
        };

        const isAllowed = allowedUrls.some((matcher) => {
            if (typeof matcher === 'string') {
                return normalizeForCompare(currentUrl) === normalizeForCompare(matcher);
            } else if (matcher instanceof RegExp) {
                return matcher.test(currentUrl.replace(/\/+$/, ''));
            }
            return false;
        });

        if (!isAllowed) {
            return;
        }

        devLog('Applying selectors for personal profile');

        const personalProfileSelectors = [
            'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x13vifvy.x16tdsg8.x1xmf6yo',
            'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x13vifvy.x16tdsg8.x1xmf6yo',
            'span:contains("Poista kavereista")',
            'div[role="menuitem"] span:contains("Poista kavereista")',
            'i[style*="BXcBrMYpzXO.png"][style*="background-position: 0px -84px"]',
        ];

        let deletedCount = 0;
        personalProfileSelectors.forEach(selector => {
            if (selector.includes(':contains(')) {
                const text = selector.match(/\:contains\("([^"]+)"\)/)?.[1];
                if (text) {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    let node;
                    while ((node = walker.nextNode())) {
                        if (node.nodeValue.includes(text)) {
                            let parent = node.parentElement;
                            while (parent && parent !== document.body) {
                                if (parent.getAttribute('role') === 'menuitem' &&
                                    parent.textContent.includes('Poista kavereista')) {
                                    if (!parent.classList.contains('fb-element-banned')) {
                                        parent.classList.add('fb-element-banned');
                                        parent.style.setProperty('display', 'none', 'important');
                                        parent.style.setProperty('visibility', 'hidden', 'important');
                                        parent.style.setProperty('opacity', '0', 'important');
                                        parent.style.setProperty('pointer-events', 'none', 'important');
                                        parent.style.setProperty('position', 'absolute', 'important');
                                        parent.style.setProperty('left', '-9999px', 'important');
                                        parent.style.setProperty('top', '-9999px', 'important');
                                        parent.style.setProperty('height', '0', 'important');
                                        parent.style.setProperty('width', '0', 'important');
                                        parent.style.setProperty('overflow', 'hidden', 'important');
                                        deletedCount++;
                                    }
                                    break;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }
                }
            } else {
                document.querySelectorAll(selector).forEach(el => {
                    if (!el.classList.contains('fb-element-banned')) {
                        el.classList.add('fb-element-banned');
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('visibility', 'hidden', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        el.style.setProperty('pointer-events', 'none', 'important');
                        el.style.setProperty('position', 'absolute', 'important');
                        el.style.setProperty('left', '-9999px', 'important');
                        el.style.setProperty('top', '-9999px', 'important');
                        el.style.setProperty('height', '0', 'important');
                        el.style.setProperty('width', '0', 'important');
                        el.style.setProperty('overflow', 'hidden', 'important');
                        deletedCount++;
                    }
                });
            }
        });

        if (deletedCount > 0) {
            devLog(`Deleted ${deletedCount} elements for personal profile`);
        }
    } catch (e) {
        console.log('Error deleting selectors for personal profile: ' + e.message);
    }
};

    // Intercept navigation to blocked URLs / FBIDs / profile-page terms
    const isPlainLeftClick = (event) => {
        try {
            return event && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
        } catch (e) {
            return false;
        }
    };

    const getBestNavigationAnchor = (target) => {
        try {
            if (!target || !target.closest) return null;
            const directAnchor = target.closest('a[href]');
            if (directAnchor) return directAnchor;

            const clickableWrapper = target.closest('[role="link"], [role="option"], li[role="row"], div[role="presentation"], [data-testid*="search" i]');
            if (clickableWrapper) {
                if (clickableWrapper.matches && clickableWrapper.matches('a[href]')) return clickableWrapper;
                const nestedAnchor = clickableWrapper.querySelector && clickableWrapper.querySelector('a[href]');
                if (nestedAnchor) return nestedAnchor;
            }

            return target.closest('a, [role="link"]');
        } catch (e) {
            return null;
        }
    };

    const isCommentNavigationUrl = (inputUrl = window.location.href) => {
        try {
            const raw = String(inputUrl || '').toLowerCase();
            const url = new URL(inputUrl, window.location.origin);
            const combined = (url.search + ' ' + url.hash + ' ' + raw).toLowerCase();
            return url.searchParams.has('comment_id') ||
                   url.searchParams.has('reply_comment_id') ||
                   url.searchParams.has('focused_comment_id') ||
                   url.searchParams.has('comment_tracking') ||
                   combined.includes('comment_id=') ||
                   combined.includes('reply_comment_id=') ||
                   combined.includes('focused_comment_id=') ||
                   combined.includes('comment_tracking') ||
                   combined.includes('comments');
        } catch (e) {
            const raw = String(inputUrl || '').toLowerCase();
            return raw.includes('comment_id') || raw.includes('reply_comment_id') || raw.includes('focused_comment_id') || raw.includes('comment_tracking') || raw.includes('comments');
        }
    };

    const clickedProfileOrPageHasBlockedTerm = (anchor) => {
        try {
            const href = anchor.href || anchor.getAttribute('href') || '';
            if (!isLikelyProfileOrPageRoute(href)) return false;
            try {
                const hrefUrl = new URL(href, window.location.origin);
                if (isSafeWhitelistedPath(hrefUrl.pathname, hrefUrl.href)) return false;
            } catch (e) {
                if (isSafeWhitelistedPath('', href)) return false;
            }

            const signal = [
                href,
                anchor.textContent || '',
                anchor.getAttribute('aria-label') || '',
                anchor.getAttribute('title') || '',
                anchor.getAttribute('data-hovercard') || '',
                anchor.getAttribute('data-profileid') || '',
                anchor.getAttribute('data-pageid') || '',
                anchor.getAttribute('data-fbid') || ''
            ].join(' ');

            return matchesAnyActiveRegex(signal) || matchesAnyBlockedFbid(signal) || fbClickedTargetHasBlockedIdentity(anchor);
        } catch (e) {
            return false;
        }
    };

    let __fbNavInterceptInstalled = false;
    const interceptNavigation = () => {
        try {
            if (__fbNavInterceptInstalled) return;
            __fbNavInterceptInstalled = true;

            const clickHandler = (event) => {
                const approvedPost = event.target && event.target.closest ? event.target.closest('.fb-post-approved:not(.fb-post-banned):not(.fb-element-banned)') : null;
                if (approvedPost) {
                    rememberApprovedPostForBrowsing(approvedPost);
                    markApprovedBrowsePendingNavigation();
                }

                const anchor = getBestNavigationAnchor(event.target);
                if (!anchor) return;

                const href = anchor.href || (anchor.getAttribute && anchor.getAttribute('href')) || '';
                if (approvedPost && href) rememberApprovedSignalForBrowsing(href);
                if (!href || isNotificationNavigationUrl(href) || isCommentNavigationUrl(href)) return;

                // Let explicitly whitelisted/self/family-safe routes navigate normally.
                // Without this, broad profile/header regex checks can redirect before the
                // destination page gets a chance to be recognized as safe.
                try {
                    const hrefUrl = new URL(href, window.location.origin);
                    if (isSafeWhitelistedPath(hrefUrl.pathname, hrefUrl.href)) return;
                } catch (e) {
                    if (isSafeWhitelistedPath('', href)) return;
                }

                if (!isPlainLeftClick(event)) return;

                if (fbClickedTargetHasBlockedIdentity(anchor) || matchesDirectFacebookBlockedUrlForRedirect(href) || clickedProfileOrPageHasBlockedTerm(anchor)) {
                    event.preventDefault();
                    event.stopPropagation();
                    triggerRedirect('blocked clicked navigation');
                    return;
                }

                // Bare profile/page SPA routes may hide FBIDs until after hydration.
                // Force a normal document navigation so handleRedirects can inspect metadata.
                if (isLikelyProfileOrPageRoute(href)) {
                    const textSignal = normalizeFBText([href, anchor.textContent || '', anchor.getAttribute('aria-label') || '', anchor.getAttribute('title') || ''].join(' '));
                    if (matchesAnyActiveRegex(textSignal)) {
                        event.preventDefault();
                        event.stopPropagation();
                        triggerRedirect('blocked clicked profile/page term');
                        return;
                    }
                }
            };

            const submitHandler = (event) => {
                const form = event.target;
                const action = form.action || '';
                if (isNotificationNavigationUrl(action)) return;
                try {
                    const actionUrl = new URL(action, window.location.origin);
                    if (isSafeWhitelistedPath(actionUrl.pathname, actionUrl.href)) return;
                } catch (e) {
                    if (isSafeWhitelistedPath('', action)) return;
                }
                if (matchesDirectFacebookBlockedUrlForRedirect(action) || fbExplicitIdentityValueHasBlockedFbid(action)) {
                    event.preventDefault();
                    event.stopPropagation();
                    triggerRedirect('blocked form action');
                }
            };

            onWindowEvent(document, 'click', clickHandler, true);
            onWindowEvent(document, 'submit', submitHandler, true);
        } catch (e) {
            console.log('Error setting up navigation interception: ' + e.message);
        }
    };

    let __fbHistoryHooked = false;
    const hookHistoryAPI = () => {
        try {
            if (__fbHistoryHooked) return;
            __fbHistoryHooked = true;

            const originalPushState = history.pushState;
            history.pushState = function() {
                const rv = originalPushState.apply(this, arguments);
                setTimeout(runAllFilters, 0);
                return rv;
            };

            const originalReplaceState = history.replaceState;
            history.replaceState = function() {
                const rv = originalReplaceState.apply(this, arguments);
                setTimeout(runAllFilters, 0);
                return rv;
            };

            onWindowEvent(window, 'popstate', () => setTimeout(runAllFilters, 0), false);
        } catch (e) {}
    };

    // ENHANCED: DOM observer with instant search result processing and full post scanning
    let __fbDomObserverInstalled = false;
    const observeDOMChanges = () => {
        try {
            if (__fbDomObserverInstalled) return;
            __fbDomObserverInstalled = true;

            devLog('Setting up DOM observer with instant search processing and full post scanning');

            const throttledRunAllFilters = createThrottle(() => runAllFilters(), 200);

            const observer = trackObserver(new MutationObserver((mutations) => {
                if (typeof refreshFBNativeTopSearchHandoffV15 === 'function') refreshFBNativeTopSearchHandoffV15();

                // Check for search/feed-related changes first for instant processing
                let hasSearchChanges = false;
                let hasHomeFeedUnitChanges = false;
                mutations.forEach(mutation => {
                    if (mutation.target && mutation.target.closest && (
                        mutation.target.closest('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"], [role="feed"] [role="article"]') ||
                        mutation.target.getAttribute?.('role') === 'feed'
                    )) {
                        hasHomeFeedUnitChanges = true;
                    }

                    mutation.addedNodes && mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.matches && (
                            node.matches('li[role="row"]') ||
                            node.matches('a[aria-describedby]') ||
                            node.matches('div[role="option"]') ||
                            node.matches('div[role="presentation"]')
                        )) {
                            hasSearchChanges = true;
                        }

                        if (node.nodeType === 1 && (
                            (node.matches && node.matches('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"] [role="article"], [role="article"]')) ||
                            (node.querySelector && node.querySelector('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"] [role="article"], [role="article"], [aria-label="Kelat"][role="region"], [aria-label="Reels"][role="region"], a[href^="/reel/"]'))
                        )) {
                            hasHomeFeedUnitChanges = true;
                        }
                    });
                });

                // Process search results immediately if detected
                if (hasSearchChanges) {
                    processSearchResults();
                }

                // Home feed FeedUnits are softgated; approve/ban them without waiting for the 650ms heavy cadence.
                if (hasHomeFeedUnitChanges) {
                    updateFBHomeFeedGateClassV23();
                    scrubRestrictedFeedUnitsV23();
                    scanAndBanEntirePosts();
                }

                // Then run other filtering functions (throttled)
                throttledRunAllFilters();
            }));
            
            observer.observe(document.documentElement, { 
                childList: true, 
                subtree: true,
                attributes: false,
                characterData: false
            });
        } catch (e) {
            console.log('Error setting up DOM observer: ' + e.message);
        }
    };


    // Targeted friends/contact card cleanup. This does NOT approve/hide feed posts.
    const scrubBlockedFriendAndContactCards = () => {
        try {
            refreshAccountScopedFilters();

            const optionSelector = '[aria-label*="Lisää vaihtoehtoja kaverille"], [aria-label*="More options for friend"], [aria-label*="More options for"]';
            // v22: Current friends-list cards may be x78zum5/xdt5ytf/x12upk82 without xod5an3.
            // Keep this selector tight to profile-link cards; safety checks below prevent profile-header/main wrappers from being used as cards.
            const modernProfileCardSelector = 'div.x78zum5.xdt5ytf.x12upk82:has(a[role="link"][href*="facebook.com"], a[data-fbcleaner-urlsig*="facebook.com"])';

            const collectSignals = (element) => {
                const chunks = [];
                const push = (value) => {
                    if (value !== null && value !== undefined && value !== '') chunks.push(String(value));
                };

                if (!element) return '';

                push(element.textContent || element.innerText || '');
                if (element.getAttribute) {
                    [
                        'aria-label', 'title', 'alt', 'href', 'src',
                        'data-hovercard', 'data-hovercard-prefer-more-content-show',
                        'data-profileid', 'data-profile-id',
                        'data-pageid', 'data-page-id',
                        'data-fbid', 'data-userid', 'data-ownerid',
                        'data-store', 'data-ft',
                        'data-fbcleaner-urlsig'
                    ].forEach(attr => push(element.getAttribute(attr)));
                }
                if (element.href) push(element.href);
                if (element.src) push(element.src);

                if (element.querySelectorAll) {
                    element.querySelectorAll([
                        'a[href]',
                        'img[src]',
                        'img[alt]',
                        '[aria-label]',
                        '[title]',
                        '[data-hovercard]',
                        '[data-profileid]',
                        '[data-profile-id]',
                        '[data-pageid]',
                        '[data-page-id]',
                        '[data-fbid]',
                        '[data-userid]',
                        '[data-ownerid]',
                        '[data-store]',
                        '[data-ft]',
                        '[data-fbcleaner-urlsig]'
                    ].join(',')).forEach((child) => {
                        push(child.textContent || '');
                        push(child.href);
                        push(child.src);
                        [
                            'href', 'src', 'alt', 'aria-label', 'title',
                            'data-hovercard', 'data-hovercard-prefer-more-content-show',
                            'data-profileid', 'data-profile-id',
                            'data-pageid', 'data-page-id',
                            'data-fbid', 'data-userid', 'data-ownerid',
                            'data-store', 'data-ft',
                            'data-fbcleaner-urlsig'
                        ].forEach(attr => push(child.getAttribute && child.getAttribute(attr)));
                    });
                }

                return chunks.join(' ');
            };

            const isBlockedSignal = (signal) => {
                return matchesAnyActiveRegex(signal) || matchesAnyBlockedFbid(signal) || matchesAnyBlockedUrl(signal);
            };

            // v21: Friends list pages are not just /Haukkis/friends*.
            // Facebook renders /<profile>/friends_all, /friends_mutual, etc. with slightly different card shells,
            // so we detect the surface by URL and scan profile links/cards generically.
            const isAnyFriendsListSurfaceV21 = () => {
                try {
                    const path = (location.pathname || '/').toLowerCase();
                    const href = (location.href || '').toLowerCase();
                    return (
                        /\/friends(?:\/|$)/i.test(path) ||
                        /\/friends_all(?:\/|$)/i.test(path) ||
                        /\/friends_mutual(?:\/|$)/i.test(path) ||
                        /\/friends_with_upcoming_birthdays(?:\/|$)/i.test(path) ||
                        /\/friends(?:[/?#]|$)/i.test(href) ||
                        /\/friends_all(?:[/?#]|$)/i.test(href) ||
                        /\/friends_mutual(?:[/?#]|$)/i.test(href) ||
                        /\/friends_with_upcoming_birthdays(?:[/?#]|$)/i.test(href)
                    );
                } catch (e) { return false; }
            };

            const isUnsafeToUseAsFriendCardV21 = (element) => {
                try {
                    if (!element || element === document.body || element === document.documentElement) return true;
                    if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(element)) return true;
                    if (typeof isProbablyProfileHeaderSafeElementV20 === 'function' && isProbablyProfileHeaderSafeElementV20(element)) return true;
                    if (element.matches && element.matches('main, [role="main"], [role="feed"], header, [role="banner"], nav, [role="navigation"], [data-pagelet="ProfileHeader"], [data-pagelet="ProfileActions"]')) return true;
                    if (element.querySelector && element.querySelector('[data-pagelet="ProfileActions"], h1, [role="feed"], [role="main"]')) return true;
                } catch (e) {}
                return false;
            };

            const profileHrefLooksLikeFriendListPersonV21 = (href = '') => {
                try {
                    const raw = String(href || '');
                    if (!raw) return false;
                    const url = new URL(raw, location.origin);
                    if (!/facebook\.com$/i.test(url.hostname) && !/\.facebook\.com$/i.test(url.hostname)) return false;
                    const p = (url.pathname || '').toLowerCase();
                    if (!p || p === '/' || p === '/home.php') return false;
                    if (/\/(friends|friends_all|friends_mutual|friends_with_upcoming_birthdays|groups|pages|marketplace|messages|messenger|notifications|search|photo|photos|videos|watch|reel|stories|events|gaming|settings|help)(?:\/|$)/i.test(p)) return false;
                    return true;
                } catch (e) { return false; }
            };

            const findFriendListCardShellV21 = (element) => {
                try {
                    if (!element) return null;

                    const modernCard = element.closest && element.closest(modernProfileCardSelector);
                    if (modernCard && !isUnsafeToUseAsFriendCardV21(modernCard)) return modernCard;

                    const explicitCard = element.closest && element.closest('[role="listitem"], li, [role="row"]');
                    if (explicitCard && !isUnsafeToUseAsFriendCardV21(explicitCard)) return explicitCard;

                    let current = element;
                    let best = null;
                    for (let depth = 0; depth < 12 && current && current !== document.body && current !== document.documentElement; depth++) {
                        if (isUnsafeToUseAsFriendCardV21(current)) break;
                        if (current.matches && current.matches('div, li, [role="listitem"], [role="row"]')) {
                            const profileLinks = current.querySelectorAll ? Array.from(current.querySelectorAll('a[href]')).filter(a => profileHrefLooksLikeFriendListPersonV21(a.getAttribute('href') || a.href || '')).length : 0;
                            const optionCount = current.querySelectorAll ? current.querySelectorAll(optionSelector).length : 0;
                            if ((profileLinks >= 1 && profileLinks <= 3) || optionCount === 1) best = current;
                            if (profileLinks > 6 || optionCount > 1) break;
                        }
                        current = current.parentElement;
                    }
                    return best || null;
                } catch (e) { return null; }
            };

            const findSingleFriendCardShell = (element) => {
                if (!element) return null;

                const modernCard = element.closest && element.closest(modernProfileCardSelector);
                if (modernCard) return modernCard;

                let current = element;
                let best = null;
                for (let depth = 0; depth < 12 && current && current !== document.body && current !== document.documentElement; depth++) {
                    if (current.matches && current.matches('div, li, [role="listitem"], [role="row"]')) {
                        const count = current.querySelectorAll ? current.querySelectorAll(optionSelector).length : 0;
                        if (count === 1) best = current;
                        if (count > 1) break;
                    }
                    current = current.parentElement;
                }
                return best || element.closest('[role="listitem"], li, [role="row"]') || element.closest('div') || element;
            };

            let hiddenCount = 0;
            let approvedCount = 0;

            // Modern friends/profile cards, including x78zum5/xdt5ytf/x12upk82 and x12upk82/xod5an3 structures.
            document.querySelectorAll(modernProfileCardSelector + ':not(.fb-profile-card-processed)').forEach((card) => {
                card.classList.add('fb-profile-card-processed');

                // Do not let the broader v22 selector grab profile headers, main wrappers, or large friend grids.
                if (isUnsafeToUseAsFriendCardV21(card)) {
                    card.classList.add('fb-profile-card-approved');
                    approvedCount++;
                    return;
                }

                const profileLinkCount = card.querySelectorAll
                    ? Array.from(card.querySelectorAll('a[href]')).filter(a => profileHrefLooksLikeFriendListPersonV21(a.getAttribute('href') || a.href || '')).length
                    : 0;
                if (profileLinkCount > 4) {
                    card.classList.add('fb-profile-card-approved');
                    approvedCount++;
                    return;
                }

                const signal = collectSignals(card);
                if (isBlockedSignal(signal)) {
                    hideElementHard(card, 'fb-profile-card-banned');
                    hiddenCount++;
                } else {
                    card.classList.add('fb-profile-card-approved');
                    approvedCount++;
                }
            });

            // Friends-page cards and their leftover empty shells expose the target name in the options button aria-label.
            document.querySelectorAll(optionSelector + ':not(.fb-profile-card-processed)').forEach((button) => {
                button.classList.add('fb-profile-card-processed');
                const card = findSingleFriendCardShell(button);
                if (!card || card.classList.contains('fb-profile-card-banned')) return;

                const signal = collectSignals(card) + ' ' + collectSignals(button);
                if (isBlockedSignal(signal)) {
                    hideElementHard(card, 'fb-profile-card-banned');
                    hiddenCount++;
                } else {
                    card.classList.add('fb-profile-card-approved');
                    approvedCount++;
                }
            });

            // v21: Any Facebook friend-list page, not just the logged-in user's own friends page.
            // This catches blocked people by FBID, vanity URL, aria-label/name, profile-picture alt/aria, and URL signals.
            if (isAnyFriendsListSurfaceV21()) {
                document.querySelectorAll('a[href][aria-label], a[href*="profile.php?id="], a[href*="facebook.com/"]').forEach((link) => {
                    try {
                        if (!link || link.classList.contains('fb-profile-card-processed')) return;
                        if (!profileHrefLooksLikeFriendListPersonV21(link.getAttribute('href') || link.href || '')) return;

                        const card = findFriendListCardShellV21(link);
                        if (!card || card.classList.contains('fb-profile-card-banned')) return;
                        if (card.classList.contains('fb-profile-card-processed')) return;
                        card.classList.add('fb-profile-card-processed');

                        const signal = collectSignals(card) + ' ' + collectSignals(link);
                        if (isBlockedSignal(signal)) {
                            hideElementHard(card, 'fb-profile-card-banned');
                            hiddenCount++;
                        } else {
                            card.classList.add('fb-profile-card-approved');
                            approvedCount++;
                        }
                    } catch (e) {}
                });
            }

            // Right-rail chat/contact rows usually expose FBIDs through /messages/t/<id> links.
            document.querySelectorAll('a[href*="/messages/t/"], a[href*="messenger.com/t/"]').forEach((link) => {
                const row = link.closest('[role="listitem"], li, [role="row"], [role="button"]') || link.closest('div') || link;
                if (!row || row.classList.contains('fb-profile-card-banned')) return;
                const signal = collectSignals(row) + ' ' + collectSignals(link);
                if (isBlockedSignal(signal)) {
                    hideElementHard(row, 'fb-profile-card-banned');
                    hiddenCount++;
                }
            });

            if (hiddenCount > 0) devLog(`Hidden ${hiddenCount} blocked friend/contact/profile cards`);
            if (approvedCount > 0) devLog(`Approved ${approvedCount} friend/contact/profile cards`);
        } catch (e) {
            console.log('Error scrubbing friend/contact cards: ' + e.message);
        }
    };


    // ===== LIKES / REACTIONS OVERLAY IDENTITY SCRUBBER v1 =====
    // Handles the reaction/likes overlay list rows that contain profile links,
    // profile-picture aria-labels, svg labels, image hrefs and "Viesti/Message" buttons.
    const scrubBlockedLikesOverlayRows = () => {
        try {
            refreshAccountScopedFilters();

            const pushAttrs = (el, chunks) => {
                if (!el || !el.getAttribute) return;

                [
                    'href', 'src', 'alt', 'aria-label', 'title',
                    'id', 'aria-describedby',
                    'data-hovercard', 'data-hovercard-prefer-more-content-show',
                    'data-profileid', 'data-profile-id',
                    'data-pageid', 'data-page-id',
                    'data-fbid', 'data-userid', 'data-ownerid',
                    'data-store', 'data-ft',
                    'data-fbcleaner-urlsig'
                ].forEach(attr => {
                    try {
                        const value = el.getAttribute(attr);
                        if (value) chunks.push(value);
                    } catch (e) {}
                });

                try {
                    const xlink = el.getAttribute('xlink:href');
                    if (xlink) chunks.push(xlink);
                } catch (e) {}

                try {
                    if (el.href) chunks.push(el.href);
                    if (el.src) chunks.push(el.src);
                } catch (e) {}
            };

            const collectSignals = (row) => {
                const chunks = [];
                try { chunks.push(row.textContent || row.innerText || ''); } catch (e) {}
                pushAttrs(row, chunks);

                try {
                    row.querySelectorAll([
                        'a[href]',
                        'img[src]',
                        'image',
                        'svg[aria-label]',
                        'svg[title]',
                        '[aria-label]',
                        '[aria-describedby]',
                        '[title]',
                        '[id]',
                        '[data-hovercard]',
                        '[data-profileid]',
                        '[data-profile-id]',
                        '[data-pageid]',
                        '[data-page-id]',
                        '[data-fbid]',
                        '[data-userid]',
                        '[data-ownerid]',
                        '[data-store]',
                        '[data-ft]',
                        '[data-fbcleaner-urlsig]'
                    ].join(',')).forEach((el) => {
                        try { chunks.push(el.textContent || ''); } catch (e) {}
                        pushAttrs(el, chunks);
                    });
                } catch (e) {}

                return chunks.join(' ');
            };

            const isBlockedSignal = (signal) => {
                const raw = String(signal || '');
                const normalized = normalizeFBText(raw);
                return matchesAnyActiveRegex(normalized) || matchesAnyBlockedFbid(raw) || matchesAnyBlockedUrl(raw);
            };

            const isLikelyProfileLink = (link) => {
                try {
                    if (!link || !link.href) return false;
                    const href = String(link.href);
                    if (!/facebook\.com\//i.test(href)) return false;
                    if (/\/(reactions|ufi|plugins|share|sharer|photo|photos|groups|events|watch|marketplace|messages|notifications)\b/i.test(href)) return false;
                    if (/\/profile\.php\?id=\d+/i.test(href)) return true;
                    if (/facebook\.com\/[A-Za-z0-9._-]+/i.test(href)) return true;
                    return false;
                } catch (e) {
                    return false;
                }
            };

            const isLikesOverlayDialog = (dialog) => {
                try {
                    if (!dialog || !dialog.isConnected) return false;
                    const rect = dialog.getBoundingClientRect();
                    if (rect.width < 220 || rect.height < 100) return false;

                    const text = (dialog.innerText || dialog.textContent || '').toLowerCase();
                    const hasProfileLink = !!dialog.querySelector('a[href*="facebook.com/"]');
                    const hasLikeOverlaySignals =
                        text.includes('viesti') ||
                        text.includes('message') ||
                        !!dialog.querySelector('[aria-label="Viesti"], [aria-label="Message"], svg[aria-label], image, img[src]');

                    return hasProfileLink && hasLikeOverlaySignals;
                } catch (e) {
                    return false;
                }
            };

            const findLikesOverlayRow = (link, dialog) => {
                try {
                    const dynamicRow = link.closest('div[data-visualcompletion="ignore-dynamic"]');
                    if (dynamicRow && dynamicRow !== dialog) return dynamicRow;

                    let current = link;
                    let best = null;

                    for (let depth = 0; depth < 16 && current && current !== dialog && current !== document.body && current !== document.documentElement; depth++) {
                        if (current.nodeType === 1 && current.matches && current.matches('div, li, [role="row"], [role="listitem"]')) {
                            const rect = current.getBoundingClientRect();
                            const profileLinks = current.querySelectorAll
                                ? Array.from(current.querySelectorAll('a[href*="facebook.com/"]')).filter(isLikelyProfileLink).length
                                : 0;
                            const text = (current.innerText || current.textContent || '').toLowerCase();
                            const hasMessageButton =
                                text.includes('viesti') ||
                                text.includes('message') ||
                                !!(current.querySelector && current.querySelector('[aria-label="Viesti"], [aria-label="Message"]'));

                            if (rect.width >= 220 && rect.height >= 26 && rect.height <= 230 && profileLinks >= 1) {
                                best = current;
                                if (hasMessageButton || current.matches('div[data-visualcompletion="ignore-dynamic"]')) break;
                            }
                        }
                        current = current.parentElement;
                    }

                    return best || link.closest('[role="row"], [role="listitem"], li') || link.closest('div') || link;
                } catch (e) {
                    return link;
                }
            };

            const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(isLikesOverlayDialog);
            if (!dialogs.length) return;

            let hidden = 0;
            let approved = 0;

            dialogs.forEach((dialog) => {
                const profileLinks = Array.from(dialog.querySelectorAll('a[href*="facebook.com/"]')).filter(isLikelyProfileLink);

                profileLinks.forEach((link) => {
                    const row = findLikesOverlayRow(link, dialog);
                    if (!row || row.classList.contains('fb-likes-overlay-row-banned') || row.classList.contains('fb-element-banned')) return;

                    const signal = collectSignals(row) + ' ' + collectSignals(link);
                    if (isBlockedSignal(signal)) {
                        row.classList.remove('fb-likes-overlay-row-approved');
                        hideElementHard(row, 'fb-likes-overlay-row-banned');
                        hidden++;
                    } else {
                        row.classList.add('fb-likes-overlay-row-approved');
                        approved++;
                    }
                });
            });

            if (hidden > 0) devLog(`Hidden ${hidden} blocked likes/reactions overlay row(s)`);
            if (approved > 0) devLog(`Approved ${approved} likes/reactions overlay row(s)`);
        } catch (e) {
            console.log('Error scrubbing likes/reactions overlay rows: ' + e.message);
        }
    };





    // Fast, narrow observer for reaction/likes overlays.
    // It activates the short softgate, scans immediately, then releases safe rows.
    const likesOverlayFastObserverV5 = trackObserver(new MutationObserver((mutations) => {
        try {
            let shouldScan = false;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes || []) {
                    if (!node || node.nodeType !== 1) continue;

                    if (
                        (node.matches && (
                            node.matches('[role="dialog"]') ||
                            node.matches('div[data-visualcompletion="ignore-dynamic"]')
                        )) ||
                        (node.querySelector && (
                            node.querySelector('[role="dialog"]') ||
                            node.querySelector('div[data-visualcompletion="ignore-dynamic"] a[href*="facebook.com/"]')
                        ))
                    ) {
                        shouldScan = true;
                        break;
                    }
                }
                if (shouldScan) break;
            }

            if (shouldScan) {
                activateFBLikesOverlaySoftGateV5();
                scrubBlockedLikesOverlayRows();
                addTimeout(scrubBlockedLikesOverlayRows, 30);
                addTimeout(scrubBlockedLikesOverlayRows, 90);
                addTimeout(scrubBlockedLikesOverlayRows, 180);
                addTimeout(scrubBlockedLikesOverlayRows, 360);
            }
        } catch (e) {}
    }));

    try {
        likesOverlayFastObserverV5.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}


    // ===== TOP FEED LATE AUDITOR v2 =====
    // Fixes the case where the top post was approved before Facebook hydrated all text/media bits.
    // This does NOT hide the whole feed. It only re-checks the first visible feed units, including approved ones.
    const auditTopFeedPostsForLateBlockedSignals = () => {
        try {
            refreshAccountScopedFilters();

            const selectors = [
                'div[data-pagelet^="FeedUnit_"]',
                'div[data-pagelet^="TimelineFeedUnit_"]',
                '[role="feed"] [role="article"]',
                '[role="article"]'
            ];

            const seen = new Set();
            const posts = [];
            selectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        if (!el || seen.has(el)) return;
                        seen.add(el);
                        posts.push(el);
                    });
                } catch (e) {}
            });

            let hidden = 0;
            posts.slice(0, 8).forEach(post => {
                if (!post || post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) return;
                if (isSafeElement(post) || isProfileHeaderProtectedArea(post)) return;

                const text = collectLightAndOpenShadowTextScoped(
                    post,
                    post.textContent || post.innerText || '',
                    {
                        maxHostSearchNodes: 140,
                        maxShadowHosts: 8,
                        maxTextNodes: 80,
                        maxShadowNodes: 50,
                        maxChars: 9000,
                        maxDepth: 1,
                        includeAttributes: true
                    }
                );

                const attrSignals = Array.from(post.querySelectorAll ? post.querySelectorAll('a[href], img[src], img[alt], [aria-label], [title], [data-hovercard], [data-profileid], [data-pageid], [data-fbid], [data-store], [data-fbcleaner-urlsig]') : [])
                    .slice(0, 120)
                    .map(el => [
                        el.href || '',
                        el.src || '',
                        el.getAttribute('href') || '',
                        el.getAttribute('src') || '',
                        el.getAttribute('alt') || '',
                        el.getAttribute('aria-label') || '',
                        el.getAttribute('title') || '',
                        el.getAttribute('data-hovercard') || '',
                        el.getAttribute('data-profileid') || '',
                        el.getAttribute('data-pageid') || '',
                        el.getAttribute('data-fbid') || '',
                        el.getAttribute('data-store') || '',
                        el.getAttribute('data-fbcleaner-urlsig') || ''
                    ].join(' '))
                    .join(' ');

                const signal = normalizeFBText(text + ' ' + attrSignals);
                const blocked = hasRestrictedFeedCTAOrReelsV23(post) || matchesAnyActiveRegex(signal) || matchesAnyBlockedFbid(signal) || matchesAnyBlockedUrl(signal);

                if (blocked) {
                    try { post.classList.remove('fb-post-approved'); } catch (e) {}
                    hideElementHard(post, 'fb-post-banned');
                    hidden++;
                } else if (!post.classList.contains('fb-post-approved')) {
                    post.classList.add('fb-post-approved', 'fb-feed-unit-approved');
                    markFBFeedUnitApprovedV23(post);
                    rememberApprovedPostForBrowsing(post);
                }
            });

            if (hidden > 0) devLog(`Late-audited and hidden ${hidden} hydrated top feed post(s)`);
        } catch (e) {
            console.log('Error auditing top feed posts: ' + e.message);
        }
    };



    const scrubBlockedProfileHeaderBits = () => {
        try {
            refreshAccountScopedFilters();
            const selectors = [
                '[data-pagelet="ProfileHeader"]',
                '[data-pagelet="PageHeader"]',
                'div.x78zum5.xdt5ytf.x12upk82.xod5an3'
            ];

            let hiddenCount = 0;
            document.querySelectorAll(selectors.join(',')).forEach(header => {
                if (!header || header.classList.contains('fb-profile-header-banned')) return;
                const signal = [
                    collectScopedText(header, 80),
                    Array.from(header.querySelectorAll ? header.querySelectorAll('a[href], [aria-label], [title], [data-hovercard], [data-profileid], [data-pageid], [data-fbid], [data-store]') : []).slice(0, 80).map(el => [
                        el.href || '',
                        el.getAttribute('href') || '',
                        el.getAttribute('aria-label') || '',
                        el.getAttribute('title') || '',
                        el.getAttribute('data-hovercard') || '',
                        el.getAttribute('data-profileid') || '',
                        el.getAttribute('data-pageid') || '',
                        el.getAttribute('data-fbid') || '',
                        el.getAttribute('data-store') || ''
                    ].join(' ')).join(' ')
                ].join(' ');

                const isSafeCurrentProfileRoute = isSafeWhitelistedPath(window.location.pathname, window.location.href);
                const hasBlockedIdentity = matchesAnyBlockedFbid(signal) || matchesDirectFacebookBlockedUrlForRedirect(signal);
                const hasBlockedTerms = matchesAnyActiveRegex(signal);

                if (hasBlockedIdentity || hasBlockedTerms) {
                    // Header scrubber is allowed to redirect only on non-whitelisted actual
                    // profile/page routes. Safe/self/family profiles must not get thrown home
                    // just because the header/title/meta contains a broad global regex term.
                    if (isLikelyProfileOrPageRoute(window.location.href) && !isSafeCurrentProfileRoute) {
                        if (hasBlockedIdentity) {
                            triggerRedirect('blocked profile/page header identity');
                            return;
                        }
                        if (hasBlockedTerms) {
                            triggerRedirect('blocked profile/page header terms');
                            return;
                        }
                    } else if (!isSafeCurrentProfileRoute) {
                        // If it is merely a card/header fragment elsewhere, hide only that fragment.
                        hideElementHard(header, 'fb-profile-header-banned');
                        hiddenCount++;
                    }
                }
            });

            if (hiddenCount > 0) devLog(`Hidden ${hiddenCount} blocked profile/page header fragments`);
        } catch (e) {
            console.log('Error scrubbing profile header bits: ' + e.message);
        }
    };



    // ===== PERFORMANCE ROUTER / CADENCE CONTROLS v17 =====
    // Keep the safety scanners alive, but stop the heaviest page-specific passes from
    // re-querying half of Facebook every 250ms on accounts/pages that do not need them.
    const FB_SPECIFIC_URL_SURFACES_V17 = [
        "https://www.facebook.com/four3four",
        "https://www.facebook.com/ItsStillRealToUsDammit",
        "https://www.facebook.com/prowrestlingworld",
        "https://www.facebook.com/weirdimagesworthseeing"
    ];

    const FB_SPECIFIC_PROFILE_IDS_V17 = [
        '100000639309471',
        'jiri.innanen'
    ];

    const FB_PERSONAL_PROFILE_URLS_V17 = [
        'https://www.facebook.com/Haukkis/friends',
        'https://www.facebook.com/Haukkis/friends_all',
        'https://www.facebook.com/Haukkis/friends_with_upcoming_birthdays'
    ];

    const __fbPerfV17 = {
        routeKey: '',
        last: Object.create(null),
        lastPrehideRouteKey: ''
    };

    const getFBRouteKeyV17 = () => {
        try { return `${location.pathname || '/'}${location.search || ''}`; }
        catch (e) { return ''; }
    };

    const shouldRunCadencedV17 = (key, ms, force = false) => {
        try {
            const now = (performance && performance.now) ? performance.now() : Date.now();
            const routeKey = getFBRouteKeyV17();
            const scopedKey = `${key}::${routeKey}`;
            const last = __fbPerfV17.last[scopedKey] || 0;
            if (force || !last || (now - last) >= ms) {
                __fbPerfV17.last[scopedKey] = now;
                return true;
            }
        } catch (e) {
            return true;
        }
        return false;
    };

    const isCurrentSpecificUrlSurfaceV17 = () => {
        try { return isSupportedFacebookPage(window.location.href, FB_SPECIFIC_URL_SURFACES_V17); }
        catch (e) { return false; }
    };

    const isCurrentSpecificProfileSurfaceV17 = () => {
        try {
            const url = new URL(window.location.href);
            return FB_SPECIFIC_PROFILE_IDS_V17.some(profileId => (
                (url.pathname === '/profile.php' && url.searchParams.get('id') === profileId) ||
                (url.pathname === `/${profileId}` || url.pathname === `/${profileId}/`)
            ));
        } catch (e) { return false; }
    };

    const isCurrentPersonalProfileSurfaceV17 = () => {
        try { return isSupportedFacebookPage(window.location.href, FB_PERSONAL_PROFILE_URLS_V17); }
        catch (e) { return false; }
    };

    const refreshSpecificUrlPrehideOptimizedV17 = (force = false) => {
        try {
            const routeKey = getFBRouteKeyV17();
            if (!force && __fbPerfV17.lastPrehideRouteKey === routeKey) return;
            __fbPerfV17.lastPrehideRouteKey = routeKey;
            injectSpecificUrlPrehideCSS();
        } catch (e) {}
    };

    const runSpecificSurfaceFiltersOptimizedV17 = (force = false) => {
        try {
            refreshSpecificUrlPrehideOptimizedV17(force);

            const specificUrlSurface = isCurrentSpecificUrlSurfaceV17();
            const specificProfileSurface = isCurrentSpecificProfileSurfaceV17();
            const personalProfileSurface = isCurrentPersonalProfileSurfaceV17();
            if (!specificUrlSurface && !specificProfileSurface && !personalProfileSurface) return;

            // These selector packs are the expensive ones. Run immediately on route changes/init,
            // then at a calmer cadence while the user stays on that same heavy page.
            if (!shouldRunCadencedV17('specificSurfaces', 900, force)) return;

            if (specificUrlSurface) deleteSelectorsForSpecificUrl();
            if (specificProfileSurface) deleteSelectorsForSpecificProfile();
            if (personalProfileSurface) deleteSelectorsForPersonalProfile();
        } catch (e) {
            console.log('Error running optimized specific surface filters: ' + e.message);
        }
    };

    const runGeneralHeavyFiltersOptimizedV17 = (force = false) => {
        try {
            // Main feed safety remains active, but the DOM-wide text/URL crawlers no longer run 4x/sec.
            // CSS prehide still keeps unapproved feed cards hidden between scans.
            if (!shouldRunCadencedV17('generalHeavy', 650, force)) return;

            updateFBHomeFeedGateClassV23();
            scrubRestrictedFeedUnitsV23();
            deleteBlockedElements();
            scanAndBanEntirePosts();
            deleteRestrictedWords();
            scrubBlockedFriendAndContactCards();
            scrubBlockedLikesOverlayRows();
            auditTopFeedPostsForLateBlockedSignals();
            scrubBlockedProfileHeaderBits();
            deleteRestrictedPhrases();
            deletePeopleYouMayKnow();
            deleteElement();
        } catch (e) {
            console.log('Error running optimized heavy filters: ' + e.message);
        }
    };

    // ENHANCED: Run all filtering functions with full post scanning
    const runAllFilters = () => {
        try {
            updateFBSearchPageClass();
            updateFBHomeFeedGateClassV23();
            if (typeof refreshFBNativeTopSearchHandoffV15 === 'function') refreshFBNativeTopSearchHandoffV15();
            refreshAccountScopedFilters();
            checkVanityProfileFBID();
            handleRedirects();
            approveCurrentApprovedBrowseSurface();
            cleanUrl();

            // Fast critical pass: small/important stuff still runs every tick.
            hideCriticalElements();
            processSearchResults();

            // Heavy passes are still active, just cadenced instead of brute-forced every 250ms.
            runGeneralHeavyFiltersOptimizedV17(false);
            runSpecificSurfaceFiltersOptimizedV17(false);
        } catch (e) {
            console.log('Error running all filters: ' + e.message);
        }
    };

    // NEW: Immediate initialization function for zero-glimpse hiding
    const immediateInit = () => {
        devLog('Running immediate init for zero-glimpse hiding');
        updateFBSearchPageClass();
        updateFBHomeFeedGateClassV23();
        if (typeof refreshFBNativeTopSearchHandoffV15 === 'function') refreshFBNativeTopSearchHandoffV15();
        updateFBFriendsSoftGateV2();
        refreshAccountScopedFilters();
        checkVanityProfileFBID();
        handleRedirects();
        approveCurrentApprovedBrowseSurface();
        hideCriticalElements();
        processSearchResults();
        scrubRestrictedFeedUnitsV23();
        runGeneralHeavyFiltersOptimizedV17(false);
        runSpecificSurfaceFiltersOptimizedV17(false);
    };

    // Ensure DOM is ready before initializing
    const ensureDOMReady = () => {
        const installLiveHooks = () => {
            observeDOMChanges();
            observeForRestrictedPhrases();
            interceptNavigation();
            hookHistoryAPI();
        };

        if (document.readyState === 'loading') {
            onWindowEvent(window, 'DOMContentLoaded', installLiveHooks, false);
        } else {
            installLiveHooks();
        }
    };

    // Initialize the script
    const init = () => {
        devLog('Initializing Facebook script with instant search hiding and full post scanning');
        if (typeof installFBNativeTopSearchHandoffV15 === 'function') installFBNativeTopSearchHandoffV15();
        ensureDOMReady();
        checkVanityProfileFBID();
        handleRedirects();
        approveCurrentApprovedBrowseSurface();
        cleanUrl();
        updateFBHomeFeedGateClassV23();
        processSearchResults();
        scrubRestrictedFeedUnitsV23();
        runGeneralHeavyFiltersOptimizedV17(true);
        runSpecificSurfaceFiltersOptimizedV17(true);

        // ANTI-FLASHING: Add pageshow event to re-hide on navigation (e.g., back/forward cache)
        onWindowEvent(window, 'pageshow', (event) => {
            if (event.persisted) {
                // Page was restored from bfcache, re-run hiding
                runAllFilters();
            }
        }, false);
    };

    // Start initialization
    init();

    // ENHANCED: Run immediate init right after CSS injection for zero-glimpse
    immediateInit();

    // Attach event listeners for changes (tracked for cleanup)
    onWindowEvent(window, 'DOMContentLoaded', runAllFilters, false);
    onWindowEvent(window, 'load', runAllFilters, false);
    onWindowEvent(window, 'popstate', runAllFilters, false);

    // Main interval scheduler
    function scheduleMainInterval() {
        addInterval(() => {
            if (!document.hidden) {
                runAllFilters();
            }
        }, 350);
    }

    // Start intervals now (foreground), pause/resume on visibility changes
    startIntervals(scheduleMainInterval);
    onWindowEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleMainInterval);
            runAllFilters();
        }
    }, false);

    // Teardown on pagehide/beforeunload to avoid leaks
    onWindowEvent(window, 'pagehide', cleanup, false);
    onWindowEvent(window, 'beforeunload', cleanup, false);

    // ===== FACEBOOK TOP-LEFT SEARCH DROPDOWN HANDOFF v15 =====
    // Already installed before init so the native dropdown can stay Facebook-owned.
    refreshFBNativeTopSearchHandoffV15();

})();