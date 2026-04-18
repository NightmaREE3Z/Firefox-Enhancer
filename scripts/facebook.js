// ==UserScript==
// @name         FB Sanity Enhancer
// @date      	 2026-04-18
// @description  Makes my Facebook experience tolerable. With less algorithmic bullshit.
// @match        *://*.facebook.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        // console.log('[FACEBOOK.JS]', message);
    }

    // ===== Memory/observer/timer lifecycle tracking =====
    const __fbTimers = {
        intervals: new Set(),
        timeouts: new Set(),
        idleCallbacks: new Set(),
    };
    const __fbObservers = new Set();
    const __fbEventCleanups = new Set();
    let __fbCleanupRan = false;
    let __lastKnownUrl = window.location.href; // Track URL for strict SPA awareness

    let isRedirecting = false; // Global redirect flag to prevent infinite loops

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
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(() => {
                try { fn(); } finally { __fbTimers.idleCallbacks.delete(id); }
            });
            __fbTimers.idleCallbacks.add(id);
            return id;
        } else {
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

            ['fb-inline-style', 'fb-personal-profile-style', 'fb-specific-url-style', 'fb-specific-profile-style', 'fb-specific-url-prehide-style'].forEach(id => {
                try { const s = document.getElementById(id); if (s) s.remove(); } catch {}
            });
            devLog('Cleanup complete.');
        } catch (e) {
            console.log('[FACEBOOK.JS] cleanup error: ' + e.message);
        }
    }

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

    // CENTRALIZED REDIRECT FUNCTION
    const triggerRedirect = () => {
        if (isRedirecting) return;
        isRedirecting = true;
        
        stopIntervals();
        __fbObservers.forEach(obs => { try { obs.disconnect(); } catch {} });
        
        let blackout = document.getElementById('sanity-blackout');
        if (!blackout) {
            blackout = document.createElement('div');
            blackout.id = 'sanity-blackout';
            blackout.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:2147483647;';
            try {
                if (document.body) document.body.style.display = 'none';
                if (document.documentElement) document.documentElement.appendChild(blackout);
            } catch(e) {}
        }
        
        // Removed history overriding to prevent React Router from lagging/looping out
        try {
            window.onbeforeunload = null;
            window.location.href = 'https://www.facebook.com/?ref=logo';
        } catch(e) {}
    };

    // ==========================================
    // CSS INJECTION FUNCTIONS
    // ==========================================

    const PersonalProfileCSS = () => {
        let style = document.getElementById('fb-personal-profile-style');
        if (!style) {
            devLog('Injecting Personal Profile CSS');
            style = document.createElement('style');
            style.id = 'fb-personal-profile-style';
            style.textContent = `
            /* Personal Profile No-Glimpse Immunization */
            /* Hide the giant specific SVG image of the Suosituksia box to stop flashing without harming posts */
            svg[viewBox="0 0 112 112"][width="112"][height="112"], 
	    div:has(> img[src*="M12 2.5a9.5 9.5 0 1 0 0 19"]) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
            }
            `;
            if (document.head) {
                document.head.appendChild(style);
            } else if (document.documentElement) {
                document.documentElement.appendChild(style);
            }
        }
    };

    const injectInlineCSS = () => {
        try {
            let style = document.getElementById('fb-inline-style');
            if (!style) {
                devLog('Injecting inline CSS');
                style = document.createElement('style');
                style.id = 'fb-inline-style';
                
                style.textContent = `
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
                    content-visibility: hidden !important;
                }

                /* INSTANT SEARCH HIDING */
                .is-search-page li[role="row"]:not(.fb-search-approved),
                .is-search-page a[aria-describedby]:not(.fb-search-approved),
                .is-search-page div[role="option"]:not(.fb-search-approved),
                .is-search-page div[data-testid="search-result"]:not(.fb-search-approved),
                .is-search-page div[role="presentation"] a:not(.fb-search-approved) {
                    visibility: hidden !important; 
                    display: none !important; 
                    opacity: 0 !important;
                }

                /* ANTI-FLASHING FOR KNOWN GARBAGE */
                div[aria-label="People You May Know"],
                div[aria-label="Ihmisiä, jotka saatat tuntea"],
                a[href="https://www.facebook.com/friends/suggestions/"],
                div[aria-label="Näytä suosituksia"],
                [aria-label="Näytä suositukset"],
                [role="button"][aria-label="Näytä suositukset"],  
                div[aria-label="Kelat"][role="region"],
                div[aria-label="Reels"][role="region"],
                div[aria-label="Sinulle ehdotettua"][role="region"],
                div[aria-label="Suggested for you"][role="region"],
                div.x1yztbdb:has(div[aria-label="Edelliset kohteet"]),
                div.x1yztbdb:has(div[aria-label="Seuraavat kohteet"]),
                div.x1yztbdb:has(div[aria-label="Suositeltu"][role="region"]) {
                    display: none !important;
                }
                
                /* ABSOLUTE ZERO-GLIMPSE for Meta AI & Kaverit (Friends) */
                a[href*="meta.ai" i], 
                a[href*="www.meta.ai"],
                a[href*="/metaai/" i], 
                a[href="/Meta AI/"],
                a[href*="/messages/t/36327"],
                a[aria-label="Meta AI"],
                div[aria-label="Meta AI"],
                span[aria-label="Meta AI"],
                [title*="Meta AI" i],
                [data-testid*="meta_ai" i],
                input[placeholder*="Meta AI" i],
            div.html-div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so:has(div[aria-label="Kelat"][role="region"]),
            div.html-div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so:has(div[aria-label="Reels"][role="region"]),
            div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xpdmqnj.x1120s5i.x1g0dm76:has(div[aria-label="Kelat"][role="region"]),
                div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xpdmqnj.x1120s5i.x1g0dm76:has(div[aria-label="Reels"][role="region"]),
        /* 1. ZERO-GLIMPSE: META AI & KAVERIT (Left Menu & Chat List) */
            /* Targets the links AND their immediate parent list-items/wrappers to completely collapse the space */
            a[href^="https://www.meta.ai/"],
            li:has(a[href^="https://www.meta.ai/"]),
            div:has(> a[href^="https://www.meta.ai/"]),
            a[href*="/messages/t/36327"],
            li:has(a[href*="/messages/t/36327"]),
            div:has(> a[href*="/messages/t/36327"]),
                a[href*="meta.ai" i], 
                a[href*="www.meta.ai"],
                a[href*="/metaai/" i], 
                a[href="/Meta AI/"],
                a[aria-label="Meta AI"],
                div[aria-label="Meta AI"],
                span[aria-label="Meta AI"],
                [title*="Meta AI" i],
                [data-testid*="meta_ai" i],
                input[placeholder*="Meta AI" i],
                a[aria-label="Kaverit"],
                div[aria-label="Kaverit"],
                a[href^="https://www.meta.ai/"],
                li:has(a[href^="https://www.meta.ai/"]),
                div:has(> a[href^="https://www.meta.ai/"]),
                a[href*="/messages/t/36327"],
                li:has(a[href*="/messages/t/36327"]),
                div:has(> a[href*="/messages/t/36327"]),
                a[href="https://www.facebook.com/friends/"],
                a[href^="/friends/"],
                a[href*="facebook.com/friends"],
                li:has(a[href="https://www.facebook.com/friends/"]),
                div:has(> a[href="https://www.facebook.com/friends/"]),
                div:has(> a[href*="meta.ai" i]),
                div:has(> a[aria-label="Meta AI" i]),
                li:has(a[aria-label="Meta AI" i]),
                li:has(a[href*="meta.ai" i]),
                li:has(a[href^="/friends/"]),
                li:has(a[href*="facebook.com/friends"]),
            a[href="https://www.facebook.com/friends/"],
            li:has(a[href="https://www.facebook.com/friends/"]),
            div:has(> a[href="https://www.facebook.com/friends/"]) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    width: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: absolute !important;
                    pointer-events: none !important;
                }

                /* HIDE SPECIFIC PEOPLE FROM CHAT LIST */
                a[href*="/messages/t/100000645744865"],
                li:has(a[href*="/messages/t/100000645744865"]),
                div:has(> a[href*="/messages/t/100000645744865"]) {
                    display: none !important; 
                    visibility: hidden !important;
                    opacity: 0 !important;
                    width: 0 !important;
                    height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: absolute !important;
                    pointer-events: none !important;
                }

                /* 2. COMPLETELY ERADICATE THE REELS WRAPPER & SEPARATOR LINE */
                /* Targets the outer wrapper when it contains a banned Reels element */
                div.x6ikm8r.x10wlt62:has(> div.x78zum5.x1q0g3np.x1qughib.xz9dl7a:has(.fb-element-banned)),
                div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xpdmqnj.x1120s5i.x1g0dm76:has(.fb-element-banned),
                /* Targets the annoying empty spacer/border line right below the Reels box */
                div.x1tz4bnf.x1yqjg3l.x25epmt.xkkygvr.x16qb05n.xi7iut8 {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                }

                /* COMPLETELY NUKE THE OUTER FEEDUNIT GHOST BOXES IF THEY HOLD REELS OR SUGGESTED GARBAGE */
                div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Kelat"][role="region"]),
                div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Reels"][role="region"]),
                div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Sinulle ehdotettua"][role="region"]),
                div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Suggested for you"][role="region"]),
                div[data-pagelet^="TimelineFeedUnit_"]:has(div[aria-label="Kelat"][role="region"]),
                div[data-pagelet^="TimelineFeedUnit_"]:has(div[aria-label="Reels"][role="region"]) {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    min-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    position: absolute !important;
                    pointer-events: none !important;
                }
                
                /* EXPLICIT PREHIDE ONLY WHILE A POST IS ACTUALLY PENDING / SCANNING */
                div[data-pagelet^="FeedUnit_"].fb-post-pending,
                div[data-pagelet^="TimelineFeedUnit_"].fb-post-pending,
                div[data-ad-rendering-role="story_message"].fb-post-pending,
                div[data-ad-preview="message"].fb-post-pending,
                div[data-pagelet^="FeedUnit_"].fb-post-scanning,
                div[data-pagelet^="TimelineFeedUnit_"].fb-post-scanning,
                div[data-ad-rendering-role="story_message"].fb-post-scanning,
                div[data-ad-preview="message"].fb-post-scanning,
                div[data-pagelet^="FeedUnit_"].fb-post-expanding,
                div[data-pagelet^="TimelineFeedUnit_"].fb-post-expanding,
                div[data-ad-rendering-role="story_message"].fb-post-expanding,
                div[data-ad-preview="message"].fb-post-expanding {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                /* Ensure approved posts snap back instantly */
                div[data-pagelet^="FeedUnit_"].fb-post-approved,
                div[data-pagelet^="TimelineFeedUnit_"].fb-post-approved,
                div[data-ad-rendering-role="story_message"].fb-post-approved,
                div[data-ad-preview="message"].fb-post-approved {
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }

                /* IMMUNITY SHIELD FOR DIALOGS AND CRITICAL BUTTONS */
                [role="dialog"]:not(.fb-element-banned):not(:has(div[data-pagelet="MediaViewerPhoto"])),
                [role="dialog"] *:not(.fb-element-banned):not(:has(div[data-pagelet="MediaViewerPhoto"])),
                div[aria-label="Poistetaanko?"],
                div[aria-label="Poista"],
                div[aria-label="Peruuta"],
                div[aria-label="Luo julkaisu"],
                div[aria-label="Create a post"] {
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
                `;
                
                if (document.head) {
                    document.head.appendChild(style);
                } else if (document.documentElement) {
                    document.documentElement.appendChild(style);
                }
            }
        } catch (err) {}
    };
    
    // ==========================================
    // UNIFIED REGEX-POWERED PROFILE / CHAT BYPASS CHECKER
    // ==========================================

    const excludedRegexPatterns = [
        /\/(messages|messenger)\b/i,
        /\/notifications\b/i,
        /\/ilmoitukset\b/i,
        /\/stories\b/i,
        /\/groups\/(317493608736721|342124472533278|2484497081612438|390555733810362|934038190050109)\b/i,
        /\/(haukkis|tapio\.haukirauma|1267550854|100005050653554|me)\b/i,
        /id=(100005050653554|100000559239899|1267550854)\b/i
    ];

    // 1. Checks ONLY for structurally whitelisted URLs. (Redirect logic uses ONLY this)
    const isSafeWhitelistedPath = (path, url = '') => {
        if (!path) return false;
        const p = path.toLowerCase();
        const u = url.toLowerCase();
        return excludedRegexPatterns.some(regex => regex.test(p) || regex.test(u));
    };

    // 2. Checks ONLY if a Profile page is present on screen.
    const isAnyProfileTimeline = () => {
        return !!(document.querySelector('[data-pagelet="ProfileTimeline"]') || 
                  document.querySelector('[data-pagelet="ProfileSelfTimeline"]') ||
                  document.querySelector('[data-pagelet="ProfileTimelineComposer"]'));
    };

    // 3. Combined check used exclusively for DOM scrubbing to protect your profile posts from being hidden.
    const isExcludedPathForDOM = (path, url = '') => {
        // Strictly restricted to Regex paths to prevent Facebook Pages like The 434 from triggering the immunity
        return isSafeWhitelistedPath(path, url);
    };

    const manageCSSStyles = () => {
        try {
            const path = window.location.pathname.toLowerCase();
            const url = window.location.href.toLowerCase();
            const isPersonal = isExcludedPathForDOM(path, url);
            
            if (isPersonal) {
                const globalStyle = document.getElementById('fb-inline-style');
                if (globalStyle) globalStyle.remove();
                PersonalProfileCSS();
            } else {
                const personalStyle = document.getElementById('fb-personal-profile-style');
                if (personalStyle) personalStyle.remove();
                injectInlineCSS();
            }
            return isPersonal;
        } catch(e) { return false; }
    };

    manageCSSStyles(); // Initial eval on load

    // ==========================================
    // ULTIMATE SAFETY NET FOR HIDING ELEMENTS
    // Prevents cascading deletion (blank pages)
    // ==========================================
    const isDangerousToHide = (el) => {
        if (!el) return true;
        if (el === document.body || el === document.documentElement) return true;
        
        // Protect Major Navigation and Headers THEMSELVES from being deleted, 
        // but DO NOT protect their children (so we can delete Kaverit/Meta AI inside them!)
        if (el.matches('header, nav, [role="banner"], [role="navigation"]')) return true;

        // Never hide massive structural wrappers
        if (el.matches('main, [role="main"], [role="feed"], #mount_0_0_fb, #globalContainer, #content')) return true;
        
        // Protect elements that *contain* major structural components so profiles don't vanish
        if (el.querySelector('main, [role="main"], [role="feed"], [data-pagelet="ProfileTimeline"]')) return true;

        // PROTECT THE COMPOSER (Status Update Box)
        if (el.querySelector('div[aria-label="Luo julkaisu"]') || el.querySelector('div[aria-label="Create a post"]')) return true;
        if (el.textContent && (el.textContent.includes('Mitä mietit') || el.textContent.includes("What's on your mind"))) return true;

        return false;
    };

    // ==========================================
    // COMMENT ISOLATOR (BULLETPROOF BLIND SPOT)
    // Instantly skips comments using explicit ARIA labels
    // to completely prevent ghost-banning and lag.
    // ==========================================
    const isInsideComment = (element) => {
        if (!element || !element.closest) return false;
        
        // 1. Explicit comment labels (Facebook explicitly tags comment wrappers with aria-label="Kommentti...")
        if (element.closest('[aria-label*="komment" i], [aria-label*="comment" i]')) return true;

        // 2. Media Viewers (Photo Theater) sidebars are mostly comments
        const currentPath = window.location.pathname.toLowerCase();
        const isMediaView = currentPath.includes('/photo') || currentPath.includes('/reel') || currentPath.includes('/videos') || currentPath.includes('/watch');
        if (!isMediaView && (element.closest('[data-pagelet="RightRail"]') || element.closest('[role="complementary"]'))) {
            return true;
        }

        // 3. Comments inside Overlay dialogs (usually in lists)
        if (element.closest('div[role="dialog"]') && element.closest('ul')) {
            return true; 
        }
        
        // 4. Nested Articles: Comments in the feed are ALWAYS role="article" nested inside another role="article"
        const article = element.closest('[role="article"]');
        if (article && article.parentElement && article.parentElement.closest('[role="article"]')) {
            return true;
        }

        return false;
    };

    const safeSelectors = [
        '[aria-label="Notifications"]', '[aria-label="Marketplace"]', '[aria-label="Ilmoitukset"]',
        '[aria-label="Messenger"]', '[aria-label="Stories"]', '[aria-label="Tarinat"]',
        'div[aria-label="Notifications"]', 'div[aria-label="Marketplace"]', 'div[aria-label="Ilmoitukset"]',
        '[role="dialog"]:not(:has(div[data-pagelet="MediaViewerPhoto"]))',
        '[tabindex="-1"]',
        'div[role="none"][data-visualcompletion="ignore"]',
        'a[href="/marketplace/?ref=app_tab"]',
        '[data-pagelet="RightRail"]',
        '[role="complementary"]',
        '[aria-label="Luo julkaisu"]',
        '[aria-label="Create a post"]'
    ];

    const isSafeElement = (element) => {
        if (!element || !element.closest) return false;
        
        const elText = (element.textContent || '').toLowerCase();
        const elAria = (element.getAttribute('aria-label') || '').toLowerCase();
        if (elText.includes('poista kavereista') || elText.includes('meta ai') || elAria.includes('meta ai')) {
            return false;
        }

        const isInsideSafe = safeSelectors.some(selector => {
            try { return element.closest(selector) !== null; } 
            catch(e) { return false; }
        });
        if (isInsideSafe) return true;

        try {
            if (element.hasAttribute('data-visualcompletion') && element.getAttribute('data-visualcompletion') === 'loading-state') return true;
            if (element.getAttribute('role') === 'progressbar') return true;
            if (element.querySelector && (element.querySelector('[data-visualcompletion="loading-state"]') || element.querySelector('[role="progressbar"]'))) {
                return true;
            }
        } catch(e) {}

        return false;
    };

    // Helper function to safely apply CSS hiding without breaking React DOM
    const safelyHideFBElement = (element) => {
        if (!element || hiddenElements.has(element) || isSafeElement(element)) return; 
        if (isDangerousToHide(element)) return; 
        
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
        
        if (!element.classList.contains('fb-element-banned')) element.classList.add('fb-element-banned');
        hiddenElements.add(element);
    };


    const normalizeFBText = (value = '') => {
        try {
            return String(value)
                .replace(/[​-‍﻿]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
        } catch (e) {
            return '';
        }
    };

    const bannedPostActionTexts = new Set(['liity', 'join', 'seuraa', 'follow']);

    const hasExplicitBannedPostAction = (root) => {
        try {
            if (!root || !root.querySelectorAll) return false;

            const selector = [
                '[role="button"]',
                'a',
                'div[role="button"][tabindex="0"]',
                'span.x3nfvp2 > div[role="button"][tabindex="0"]',
                'span[dir="ltr"] span.x3nfvp2 > div[role="button"][tabindex="0"]'
            ].join(',');

            const candidates = Array.from(root.querySelectorAll(selector));
            for (let i = 0; i < candidates.length; i++) {
                const el = candidates[i];
                if (!el || isInsideComment(el)) continue;

                const textVariants = [
                    normalizeFBText(el.textContent || el.innerText || ''),
                    normalizeFBText(el.getAttribute && el.getAttribute('aria-label') || ''),
                    normalizeFBText((el.querySelector && el.querySelector('span')) ? (el.querySelector('span').textContent || '') : ''),
                    normalizeFBText((el.querySelector && el.querySelector('span.x193iq5w')) ? (el.querySelector('span.x193iq5w').textContent || '') : '')
                ];

                for (let j = 0; j < textVariants.length; j++) {
                    if (bannedPostActionTexts.has(textVariants[j])) {
                        return true;
                    }
                }
            }
        } catch (e) {}
        return false;
    };

    // ==========================================
    // ISOLATED PERSONAL PROFILE SELECTORS
    // ==========================================
    const PersonalProfileSelectors = () => {
        try {
            // Nuke "Poista kavereista" from any chat/friends list overlay menu
            document.querySelectorAll('div[role="menuitem"], span[dir="auto"]').forEach(el => {
                if (el.textContent && el.textContent.includes('Poista kavereista')) {
                    const wrapper = el.closest('div[role="menuitem"]') || el;
                    if (!isDangerousToHide(wrapper)) safelyHideFBElement(wrapper);
                }
            });

            // Structurally Nuke "Sinulle ehdotettua" / "Lisää kavereita" Ghost Box exclusively by Text mapping
            const textToFind = ["Lisää kavereita saadaksesi suosituksia", "Kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea."];
            
            document.querySelectorAll('span[dir="auto"], h2.html-h2, div[dir="auto"]').forEach(el => {
                if (el.textContent && textToFind.some(t => el.textContent.includes(t))) {
                    let parent = el.parentElement;
                    let wrapperToHide = el; // default to hiding just the text if climbing fails
                    
                    while (parent && parent !== document.body) {
                        if (parent.classList.contains('x1exxf4d') || parent.classList.contains('html-div') || parent.classList.contains('x1yztbdb')) {
                            if (isDangerousToHide(parent)) break;
                            if (parent.querySelector('[data-pagelet^="FeedUnit"]') || parent.matches('[role="feed"]')) break;
                            
                            wrapperToHide = parent;
                            if (parent.classList.contains('x1exxf4d')) break;
                        }
                        parent = parent.parentElement;
                    }
                    
                    if (wrapperToHide && !isDangerousToHide(wrapperToHide)) {
                        safelyHideFBElement(wrapperToHide);
                    }
                }
            });
            
            // Clean up standalone stray icon if text mapping misses it
            document.querySelectorAll('i[style*="BXcBrMYpzXO.png"][style*="background-position: 0px -84px"]').forEach(el => {
                if (isSafeElement(el)) return; 
                if (isDangerousToHide(el)) return;
                safelyHideFBElement(el);
            });
            
        } catch (e) {}
    };

// FIXED: Function to delete elements for specific profiles - now with proper URL restriction
    const filteredProfiles = () => {
        try {
            const currentUrl = window.location.href;
            const url = new URL(currentUrl);
            const profileIds = [
                '100000639309471',
                'jiri.innanen',
            ];

            // Strictly match only these profile pages
            const matchesProfile = profileIds.some(profileId => {
                return (
                    (url.pathname === '/profile.php' && url.searchParams.get('id') === profileId) ||
                    (url.pathname === `/${profileId}` || url.pathname === `/${profileId}/`)
                );
            });
            
            // Only run if we're actually on one of the specified profiles
            if (!matchesProfile) return; 
            
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
                '.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14zmp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k',
                '.x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.x14ldlfn.x1b1wa69.xws8118.x5fzff1.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.xpdmqnj.x1g0dm76.x1qhmfi1.x1r1pt67',
                'h2:contains("Julkaisut")',
                'span:contains("Julkaisut")',
                'div:contains("Suodattimet")',
                'span:contains("Suodattimet")'
            ];
            
            selectorsToDelete.forEach(selector => {
                // Handle our custom pseudo-selector for native JS compatibility!
                if (selector.includes(':contains(')) {
                    const match = selector.match(/^(.*?):contains\("(.*?)"\)$/);
                    if (match) {
                        const tag = match[1].toUpperCase(); 
                        const text = match[2];
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                        let node;
                        while ((node = walker.nextNode())) {
                            if (node.nodeValue.includes(text)) {
                                let parent = node.parentElement;
                                while (parent && parent !== document.body) {
                                    if (parent.tagName === tag) {
                                        if (!isSafeElement(parent) && !isDangerousToHide(parent)) {
                                            safelyHideFBElement(parent);
                                        }
                                        break;
                                    }
                                    parent = parent.parentElement;
                                }
                            }
                        }
                    }
                } else {
                    // Standard CSS Selectors
                    document.querySelectorAll(selector).forEach(element => {
                        if (isSafeElement(element)) return;
                        safelyHideFBElement(element);
                    });
                }
            });
        } catch (e) {
            console.log('Error deleting selectors for specific profiles: ' + e.message);
        }
    };

    const hideCriticalElements = () => {
        try {
            const selectors = [
                'div:has(> a[href*="meta.ai" i])',
                'div:has(> a[href^="/friends/"])',
                'div:has(> a[href*="facebook.com/friends"])',
                'a[aria-label="Kaverit"]',
                'div[aria-label="Kaverit"]',
                'a[href="https://www.facebook.com/friends/"]',
                'a[href^="/friends/"]',
                'a[aria-label*="Meta AI" i]',
                'div[aria-label="Kelat"][role="region"]',
                'div[aria-label="Reels"][role="region"]',
                'div.html-div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so:has(div[aria-label="Kelat"][role="region"])',
                'div.html-div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so:has(div[aria-label="Reels"][role="region"])',
                'div[aria-label="Sinulle ehdotettua"][role="region"]',
                'div[aria-label="Suggested for you"][role="region"]',
                'div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Kelat"][role="region"])',
                'div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Reels"][role="region"])',
                'div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Sinulle ehdotettua"][role="region"])',
                'div[data-pagelet^="FeedUnit_"]:has(div[aria-label="Suggested for you"][role="region"])',
                'a[href*="meta.ai" i]',
                'a[href*="/metaai/" i]',
                'svg[aria-label*="Meta AI" i]',
                'span[aria-label*="Meta AI" i]',
                'input[placeholder*="Meta AI" i]',
                '[data-testid*="meta_ai" i]',
                'div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xpdmqnj.x1120s5i.x1g0dm76:has(div[aria-label="Kelat"][role="region"])',
                'div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xpdmqnj.x1120s5i.x1g0dm76:has(div[aria-label="Reels"][role="region"])',
                'a[href*="/messages/t/36327"]',
                'li:has(a[href*="/messages/t/36327"])',
                'div:has(> a[href*="/messages/t/36327"])',
                'a[href*="/messages/t/100000645744865"]',
                'li:has(a[href*="/messages/t/100000645744865"])',
                'div:has(> a[href*="/messages/t/100000645744865"])',
                'a[href^="https://www.meta.ai/"]',
                'li:has(a[href^="https://www.meta.ai/"])',
                'div:has(> a[href^="https://www.meta.ai/"])',
                'div.x1tz4bnf.x1yqjg3l.x25epmt.xkkygvr.x16qb05n.xi7iut8',
                'div.x6ikm8r.x10wlt62:has(> div.x78zum5.x1q0g3np.x1qughib.xz9dl7a:has(.fb-element-banned))'
            ];

            selectors.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => {
                    if (!isSafeElement(el) && !isDangerousToHide(el)) {
                        safelyHideFBElement(el);
                    }
                });
            });

            // Instant Text Scrubber for Meta AI & Poista Kavereista
            document.querySelectorAll('span[dir="auto"], span.x1lliihq, span.html-span').forEach(span => {
                const text = span.textContent.trim().toLowerCase();
                if (text === 'meta ai' || text === 'kaverit' || text === 'poista kavereista') {
                    if (isInsideComment(span)) return; 
                    const wrapper = span.closest('a') || span.closest('.x1qjc9v5') || span.closest('div[role="menuitem"]') || span.closest('li') || span;
                    if(wrapper && !isDangerousToHide(wrapper)) {
                        safelyHideFBElement(wrapper);
                    }
                }
            });
        } catch (err) {}
    };

    const restrictedWords = [
        "Alexa Bliss", "Alexa WWE", "5 feet of fury", "five feet of fury", "Tiffany", "Stratton", "Tiffy time", "Stratton", "Artificial Intelligence", "Samantha", "La Leona", "Mariah May", "B-Fab",
        "Tiffany", "Mandy Rose", "Chelsea Green", "Bayley", "Mercedes", "Sasha Banks", "Sportskeeda", "Vince Russo", "Meltzer", "Shirakawa", "Samantha Irvin", "Brave Software", "AJ Lee's", "Perez",
        "All Elite Wrestling", "Dynamite", "Rampage", "AEW Collision", "Blackheart", "Flair", "Charlotte", "Charlotte", "Flair", "Becky Lynch", "Giulia", "Michin", "Samantha Irwin", "Serena Deeb",
        "Mia Yim", "AJ Lee", "Stephanie", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "Carr WWE", "Iyo Shirai", "Iyo Sky", "Leila Grey", "Trish", "Stratus", "AJ Lee", "Izzi WWE", 
        "Nick Jackson", "NXT Womens", "NXT Women", "NXT Woman", "Sunny", "Maryse", "Jackson", "DeepSeek", "DeepSeek AI", "Rhea Ripley", "Instagram", "Jakara", "Playboy", "Jaida Parker", "Deonna", 
        "Lash Legend", "Alba Fyre", "Isla Dawn", "CJ Perry", "Lana WWE", "Raquel Rodriguez", "Zelina Vega", "Alicia Fox", "Willow Nightingale", "Kris Statlander", "Kayden Carter", "Katana Chance",
        "Izzi Dame", "Girlfriend", "Girl", "Woman", "Women", "Girls", "Girl's", "Women's", "Woman's", "Womens", "Womans", "Ladys", "Lady's", "Ladies'", "Ladies", "Lady", "Dame WWE", "Perez",
        "Indi Hartwell", "Blair Davenport", "Lola Vice", "Valhalla", "Maxxine Dupri", "Karmen Petrovic", "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Io Sky", "Shirai", "Scarlett", 
        "Thea Hail", "Tatum Paxley", "Fallon Henley", "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa Leon", "Valentina", "Amari Miller", "Young Bucks", "Torrie Wilson", "Ripley!", "Monroe",
        "Arianna Grace", "Zelina", "Natalya", "Nattie", "IYO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Satomura", "Candice", "LeRae", "Nia Jax", "Naomi", "Trish", "Stratus", "Roxanne", 
        "Sarray", "Xia Li", "Shayna", "Baszler", "Ronda", "Rousey", "Velvet Sky", "Carmella", "Dana Brooke", "Mercedes", "Martinez", "Marina", "Shafir", "Stacy", "Keibler", "Valkyria", "Primera", 
        "Summer Rae", "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Tatu Toiviainen", "Jessika Carr", "Jessica Karr", "Venice", "Jessica Carr", "Jessika WWE", "Jessica WWE", "Matt Jackson", 
        "Karr WWE", "Carr WWE", "Melina wrestler", "Jillian", "Mickie", "Kanellis", "Beth Phoenix", "Victoria", "Jazz WWE", "Molly Holly", "Shirai", "Priscilla", "Kelly", "Red Velvet", "Meta AI",
        "Gail Kim", "Awesome Kong", "Kara B", "Madison Rayne", "Velvet Sky", "Angelina", "Tessmacher", "Havok", "Su Yung", "Taya Valkyrie", "Bianca Belair", "Skye Blue", "Bordeaux", "Brooke", "#",
        "Purrazzo", "Thekla", "Toni Storm", "Britt Baker", "Jamie Hayter", "Anna Jay", "Hikaru", "Sakazaki", "Nyla Rose", "Sakura", "Penelope Ford", "Julia Hart", "Kamifuku", "Elayna", "Blake", "Monroe",
	"Juliette", "Juliana", "Julianna",  "Saya Kamitani", "Kamitani", "Katie", "Nikkita", "Nikkita Lyons", "Marie", "Lisa Varon", "Marie Varon", "Irving", "Naomi", "Belts Mone", "Amanda Huber", "Elayna", 
	"Sisältö ei ole käytettävissä tällä hetkellä", "Näytä suositukset", "20. heinäkuu klo", "IYO SKY", "Ripley", "Kairi", "Megan Bayne", "Wren Sinclair", "Fallon", "Henley", "Bella Twins", "Kaipio"
    ];

    const regexBlockedWords = [
        /lex bl/i, /\bSol\b/i, /\bShe\b/i, /\bHer\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bRiho\b/i, /\bCum\b/i, /\bSlut\b/i, /\bTor\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /\bAlexa\b/i, /\bTay\b/i, 
	/\bMelo\b/i, /\bConti\b/i, /\bPaige\b/i, /\bShotzi\b/i,  /\bTiffy\b/i, /\bStratton\b/i, /\bAEW\b/i, /\bBy AI\b/i, /\bAis\b/i, /AI\-/i, /-\AI/i, /AI\-suck/i, /\bIvory\b/i, /\bposing\b/i, /Ripl/i, /\bSasha\b/i, 
	/\bAnal\b/i, /\bBliss\b/i, /\bKara\b/i, /\bGay\b/i, /\bTransvestite\b/i, /\bTransu\b/i, /\bPride\b/i, /\bLesbian\b/i, /\bLesbo\b/i, /\bHomo\b/i, /\bQueer\b/i, /\bSable\b/i, /\bBella\b/i, /\bNikki\b/i,
	/\bTegan\b/i, /\bNox\b/i, /\bGoddess\b/i, /\bLita\b/i, /\bRusso\b/i, /\bLGBT\b/i, /\bLGBTQ\b/i, /\bLGBTQ\b/i, /\bMami\b/i, /\bTrish\b/i, /\bStratus\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bGiulia\b/i, /\bMichin\b/i, 
	/\bJayne\b/i, /\bLLM\b/i, /\bMLM\b/i, /Shira/i, /Steph's place/i, /Stephanie's place/i, /Steph McMahon/i, /Stepan/i, /Stratu/i, /Stratt/i, /Gina Adam/i, /\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /\bShe\b/i,
	/\bHer\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bRiho\b/i, /\bCum\b/i, /\bSlut\b/i, /\bTor\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /\bAlexa\b/i, /\bODB\b/i, /\bLita\b/i, /\bChyna\b/i, /\bSaraya\b/i, 
	/\bSol\b/i, /\bBrooke\b/i, /\bCora\b/i, /\bGin4\b/i, /\bG1n4\b/i, /\bTay\b/i, /\bMelo\b/i, /\bConti\b/i, /\bPaige\b/i, /\bShotzi\b/i, /Perez/i, /Ripley/i, /\bTiffy\b/i, /\bStratton\b/i, /\bAEW\b/i, /\bAis\b/i, 
	/lantaaa/i, /\bAI-\b/i, /\bIvory\b/i, /\bposing\b/i, /\bTamina\b/i, /\bTessa\b/i, /\bRuca\b/i, /\bRuby\b/i, /\bSoho\b/i, /\bSasha\b/i, /\bAnal\b/i, /\bBliss\b/i, /\bGay\b/i, /lantaai/i, /\bTransvestite\b/i, 
	/\bTrans\b/i,  /\bTransu\b/i, /\bPride\b/i, /\bLesbian\b/i, /\bLesbo\b/i, /\bHomo\b/i, /\bQueer\b/i, /\bSable\b/i, /\bposed\b/i, /\bLayla\b/i, /\bLana\b/i, /\bSol\b/i, /\bJacy\b/i, /\bBella\b/i, /\bNikki\b/i, 
	/\bBrie\b/i, /\bTegan\b/i, /\bNox\b/i, /\bGoddess\b/i, /\bLita\b/i, /Sherilyn/i, /\bRusso\b/i, /\bLGBT\b/i, /\bLGBTQ\b/i, /\bLGBTQ\b/i, /\bMami\b/i, /\bTrish\b/i, /\bStratus\b/i, /\bYung\b/i, /\bHavok\b/i, 
	/\bJade\b/i, /\bAthena\b/i, /\bIzzi\b/i, /\bFuku\b/i, /\bDame\b/i, /\bGiulia\b/i, /\bMichin\b/i, /\bJayne\b/i, /\bLLM\b/i, /\bMLM\b/i, /Shira/i, /Steph's place/i, /Stephanie's place/i, /Steph McMahon/i, 
	/Stepan/i, /Stratu/i, /Stratt/i, /Tiffa/i, /Tiffy/i, /\bGina\b/i, /Dreambooth/i, /Bliss/i, /Dream booth/i, /Dualipa/i, /Dua Lipa/i, /Meta AI/i, /Tatu Toiviainen/i, /IInspiration/i, /IIconics/i,  /\bJade\b/i, 
	/cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i, /barlow/i, /Nikki/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, 
	/Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, /Alici/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /AIblow/i, 
	/5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, /AI-suck/i, /drool/i, /RemovingAI/i, /blowjob/i, /bjob/i, /b-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /dr00l/i, /Rhea Ripley/i,
	/Roxanne/i, /\bBrie\b/i, /Lauren/i, /Suvi Anniina/i, /Saara Autio/i, /Liv Morgan/i, /Alexa Bliss/i, /Marie/i, /Juliette/i, /Artificial/i, /Artificial Intelligence/i, /Powered by AI/i, /AI made/i, /AI creation/i,
	/\bSex\b/i, /IYO SKY/i, /AI creative/i, /AI created/i, /Tekoäly/i, /Teko äly/i, /Teko-äly/i, /Teko_äly/i, /gener/i, /generoiva/i, /generoitu/i, /generated/i, /generative/i, /AI create/i, /generation/i,
	/seksi/i, /anaali/i, /pillu/i, /pimppi/i, /kyrpä/i, /kulli/i, /sexual/i, /sensuel/i, /seksuaali/i, /\bAI\b/i, /\bKairi\b/i, /Kairi's/i, /Kairii/i, /Sexxy/i, /Sexy/i, /Sexx/i, /Sexi/i, /Monroe/i, 
    ];

    const allowedWords = [
	"Lähetä", "Viesti", "Lähetä viesti", "Send a message", "Send message", "Send", "message", "Battlefield", "BF", "BF6", "BF1", "BF4", "BF 1942", "BF2", "Battle field", "memes", "masterrace", "#itsevarmuus",
	"#memes", "meme", "#meme", "Pearl", "Harbor", "Market", "Bro", "Brother", "Metallica", "Sabaton", "Joakim", "James", "Hetfield", "PC", "Build", "Memory", "Ram", "Motherboard", "Mobo", "Cooling", "pcmaster",
	"AIO", "CPU", "GPU", "Radeon", "GeForce", "GTX", "RTX", "50", "60", "70", "80", "90", "X3D", "50TI", "60TI", "70TI", "80TI", "90TI", "Processor", "Graphics", "Card", "Intel", "AMD", "NVidia", "RGB", "cooler",
	"#healing", "#heal", "#itsetunto", "😂", "🤣", "😭", "Lisa Su", "Jensen Huang", "Chip", "Android", "Huawei", "Tech", "Patch", "MSI", "Asus", "ROG", "Strix", "TUF", "Suprim", "Gaming", "OSRS", "RS3", "Jagex", 
	"Old School", "RuneScape",  "Sea Shanty 2", "Sailor's Dream", "Sailing", "Skilling", "Bossing", "Boss", "Mod Ash", "JMod", "Reddit", "Core", "Cores", "3DVCache", "VCache", "Inno3D", "Inno 3D", "Sapphire", "XFX",
	"Nitro", "Pure", "Asus Prime", "X570", "B550", "B650", "B650E", "X670", "X670E", "B850", "X870", "X870E", "B450", "X470", "B350", "X370", "LGA", "1150", "1151", "1155", "AM4", "AM5", "AM6", "Corsair", "Kingston",
	"PowerColor", "DDR5", "DDR4", "DDR3", "Computing", "Computer", "AData", "AM3", "AM3+", "AM2", "GSkill", "Memory", "Ram", "Turbo", "Overclock", "Overclocked", "Air cooling", "Radiator", "Pump", "Header", "Water", 
	"GTA", "Grand Theft Auto", "PlayStation", "PS1", "PS2", "PS3", "PS4", "PS5", "Xbox", "Series", "Pro", "Console", "Sega", "MegaDrive", "Genesis", "Nintendo", "Upgrade", "Room", "Setup", "Christmas", "Wordables",
	"Wordable", "lifelearnedfeelings", "feel", "feelings", "feeling", "pcmasterrace_official", "pcmasterrace", "pc masterrace", "pc master race", "gaming", "game", "gamer", "Tarina", "Tarinat", "Story", "Stories",
	"Vice City", "Liberty City", "San Andreas", "North Yankton", "Yankton", "Rockstar", "North", "South", "West", "East", "Johanna", "Jojo",
    ]; 

    const restrictedWordsLower = restrictedWords.map(w => w.toLowerCase());
    const allowedWordsLower = allowedWords.map(w => w.toLowerCase());

    // --- NEW: DYNAMIC WRESTLER BANS FROM WRESTLING.JS ---
    function applyDynamicWrestlerBans() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            try {
                chrome.storage.local.get(['wrestling_women_urls'], function(result) {
                    if (result.wrestling_women_urls && Array.isArray(result.wrestling_women_urls)) {
                        let addedCount = 0;
                        
                        // === IRONCLAD SHIELD ===
                        // Prevents specific names fetched from SmackDown Hotel from being turned into global FB bans
                        const localExclusions = ['melina', 'melina-perez', 'aj-lee', 'aj', 'becky-lynch', 'becky', 'jojo'];

                        result.wrestling_women_urls.forEach(url => {
                            const parts = url.split('/').filter(Boolean);
                            const slug = parts[parts.length - 1].toLowerCase();
                            
                            // Skip if the slug matches our exclusions
                            if (localExclusions.includes(slug)) return;

                            const name = slug.replace(/-/g, ' ');
                            
                            // Escape special characters for regex just in case
                            const namePattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            
                            // Prevent duplicates in regexBlockedWords
                            const isDuplicate = regexBlockedWords.some(rx => rx.source && rx.source.includes(namePattern));

                            if (!isDuplicate) {
                                if (name.length <= 6 || !name.includes(' ')) {
                                    // Short or single name: bind to word boundaries to prevent false positives
                                    regexBlockedWords.push(new RegExp('\\b' + namePattern + '\\b', 'i'));
                                } else {
                                    // Longer name: regular string match is safe
                                    regexBlockedWords.push(new RegExp(namePattern, 'i'));
                                }
                                addedCount++;
                            }
                        });
                        if (addedCount > 0) {
                            devLog(`Dynamically added ${addedCount} wrestler names from shared storage to blocklist.`);
                            // Instantly force a re-run of filters now that new words are loaded!
                            runAllFilters(); 
                        }
                    }
                });
            } catch(e) {}
        }
    }
    // Execute immediately upon initialization
    applyDynamicWrestlerBans();

    let approvedFBPostIDs = new Set();
    const hiddenElements = new WeakSet();

    try {
        const storedApprovals = localStorage.getItem('fb_sanity_approved_posts');
        if (storedApprovals) approvedFBPostIDs = new Set(JSON.parse(storedApprovals));
    } catch(e) { devLog('Error loading approved posts from local storage'); }

    // --- NEW BULK APPROVAL SAVING ---
    const saveApprovedPostIDs = (postIDs) => {
        if (!postIDs || postIDs.length === 0) return;
        let added = false;
        postIDs.forEach(id => {
            if (!approvedFBPostIDs.has(id)) {
                approvedFBPostIDs.add(id);
                added = true;
            }
        });
        if (!added) return;
        try {
            if (approvedFBPostIDs.size > 2000) {
                const arr = Array.from(approvedFBPostIDs).slice(-2000);
                approvedFBPostIDs = new Set(arr);
            }
            localStorage.setItem('fb_sanity_approved_posts', JSON.stringify(Array.from(approvedFBPostIDs)));
        } catch(e) {}
    };

    // --- ENHANCED ID EXTRACTION ---
    // Catches posts, permalinks, videos, groups, photos, fbid, story_fbid, multi_permalinks, v=...
    const extractPostIdFromUrl = (href) => {
        try {
            const match = href.match(/\/(?:posts|permalink|videos|reels|groups\/[^/]+\/user)\/?([a-zA-Z0-9_]+)/) || 
                          href.match(/(?:story_fbid|fbid|multi_permalinks|v)=([a-zA-Z0-9_]+)/) ||
                          href.match(/\/photos\/(?:a\.[0-9]+\/)?([0-9]+)/);
            return (match && match[1] && match[1].length > 5) ? match[1] : null;
        } catch (e) { return null; }
    };

    // --- NEW GLOBAL APPROVED POST CHECKER ---
    const isCurrentPostApproved = () => {
        try {
            const currentURL = window.location.href;
            const currentID = extractPostIdFromUrl(currentURL);
            if (currentID && approvedFBPostIDs.has(currentID)) return true;
            
            // Fallback: Check if ANY ID extracted from the URL matches (sometimes URLs have multiple parameters)
            const allMatches = [...currentURL.matchAll(/(?:story_fbid|fbid|multi_permalinks|v)=([a-zA-Z0-9_]+)/g)];
            for (const m of allMatches) {
                if (m[1] && approvedFBPostIDs.has(m[1])) return true;
            }
        } catch(e) {}
        return false;
    };

    // --- EXTRACT ALL IDs FROM A POST ---
    const getFBPostIDs = (node) => {
        const ids = new Set();
        try {
            // Find all potential links inside the post that might contain an ID (timestamp, photos, videos)
            const links = Array.from(node.querySelectorAll('a[role="link"], a[href*="/posts/"], a[href*="/permalink/"], a[href*="fbid="], a[href*="/photo/"]'));
            for (let i = 0; i < links.length; i++) {
                const href = links[i].getAttribute('href') || '';
                if (href === '#' || href.includes('comment_id')) continue;
                const extractedId = extractPostIdFromUrl(href);
                if (extractedId) ids.add(extractedId);
            }
            
            // Fallback for single-post views where the ID is purely in the main URL
            if (window.location.pathname.includes('/posts/') || window.location.pathname.includes('/permalink.php') || window.location.search.includes('fbid=')) {
                const urlId = extractPostIdFromUrl(window.location.href);
                if (urlId) ids.add(urlId);
            }
        } catch {}
        return Array.from(ids);
    };

    const extractTextFromPostSafely = (article) => {
        let texts = [];
        const authorEl = article.querySelector('h3, h4, a[role="link"] strong, a[role="link"] span');
        if (authorEl && !isInsideComment(authorEl)) texts.push(authorEl.textContent.trim());

        const messageEl = article.querySelector('[data-ad-comet-preview="message"], [data-ad-preview="message"]');
        if (messageEl && !isInsideComment(messageEl)) {
            texts.push(messageEl.textContent.trim());
        } else {
            // Reverted to match the stable facebookOld.js logic to prevent query limit issues
            Array.from(article.querySelectorAll('span[dir="auto"], div[dir="auto"], span.html-span, div.html-div, span.x1vvkbs'))
                .filter(s => !isInsideComment(s)) 
                .slice(0, 40)
                .forEach(s => texts.push(s.textContent.trim()));
        }
        return texts.join(' ');
    };

    const eliminateSuggestedGroups = () => {
        document.querySelectorAll('[aria-label="Ryhmän ehdotuksien lisävalinnat"], [aria-label="Suggested groups"], [aria-label="Group suggestions"], [aria-label="Ehdotettu sinulle"], [aria-label="Suggested for you"]').forEach(btn => {
            if (isSafeElement(btn)) return; 
            const feedUnit = btn.closest('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"]');
            if (feedUnit && !isDangerousToHide(feedUnit)) safelyHideFBElement(feedUnit);
        });

        document.querySelectorAll('span[dir="auto"], span.html-span').forEach(span => {
            if (isSafeElement(span)) return; 
            const text = span.textContent ? span.textContent.trim().toLowerCase() : '';
            if (text === 'ehdotetut ryhmät' || text === 'suggested groups' || text === 'ryhmäehdotukset' || text === 'ehdotettu sinulle' || text === 'sinulle ehdotettua') {
                const feedUnit = span.closest('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"]');
                if (feedUnit && !isDangerousToHide(feedUnit)) safelyHideFBElement(feedUnit);
            }
        });
    };

    const blockedFbids = [
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
    ];

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
        /ask\.fm\/irpp4/,
        /blogspot\.com/,
        /blogspot\.fi/,
        /irpp4\.blogspot\.com/,
        /irpp4\.blogspot\.fi/,
        /kick\.com/,
        /horizonmw\.org/,
        /github\.com/,
        /irpppas\.blogspot\.com/,
        /irpppas\.blogspot\.fi/,
        /www\.facebook\.com\/Haukkis\/friends_with_upcoming_birthdays/,
        /www\.facebook\.com\/toni\.harsunen\.1/,
        /www\.facebook\.com\/minna\.kaipio\.5/,
        /www\.tiktok\.com/,
        /sportskeeda\.com\/*/,
        /sportskeeda\.com\/*/,
        /sportskeeda\.com/,
        /wwfoldschool\.com\/*/,
        /wwfoldschool\.com/,
        /meta\.ai/i,
        /github\.com\/best-deepnude-ai-apps/i,
        /github\.com\/AI-Reviewed\/tools\/blob\/main\/Nude%20AI%20:%205%20Best%20AI%20Nude%20Generators%20-%20AIReviewed\.md/i,
        /github\.com\/nudify-ai/i,
        /github\.com\/BrowserWorks/i,
        /github\.com\/comfyanonymous/i,
        /github\.com\/Top-AI-Apps/i,
        /github\.com\/Anthropic/i,
        /github\.com\/HorizonMW\/HorizonMW-Client/i,
        /github\.com\/HorizonMW\/[^\/]+/i,
        /github\.com\/Top-AI-Apps\/Review\/blob\/main\/Top%205%20DeepNude%20AI%3A%20Free%20%26%20Paid%20Apps%20for%20Jan%202025%20-%20topai\.md/i,
        /chromewebstore\.google\.com\/detail\/tor-selain\/eaoamcgoidmhaficdbmcbamiedeklfol/i,
        /www\.opera\.com/i,
        /www\.apple\.com/i,
        /microsoft\.com\/en-us\/edge\//i,
        /microsoft\.com\/fi-fi\/edge\//i,
        /brave\.com/i,
        /aitoolfor\.org/i,
        /aitoolfor\./i,
        /aitool4\./i,
        /aitool4u\./i,
        /aitool\./i,
        /remove\.bg/i,
        /folio\.procreate\./i,
        /procreate\./i,
        /folio\.procreate\.com\/deepnude-ai/i,
        /support\.microsoft\.com\/fi-fi\/microsoft-edge/i,
        /apps\.microsoft\.com\/detail\/xpdbz4mprknn30/i,
        /apps\.microsoft\.com\/detail\/xp8cf6s8g2d5t6/i,
        /apps\.microsoft\.com\/detail\/xpfftq037jwmhs/i,
        /apps\.microsoft\.com\/detail\/9nzvdkpmr9rd/i,
        /apps\.microsoft\.com\/detail\/9nrtvfllggtv/i,
        /researchgate\.net/i,
        /thefacemerge\.net/i,
        /faceplusplus\.net/i,
        /microsoft\.com\/fi-fi\/edge/i,
        /google\.com\/intl\/fi_fi\/chrome\//i,
        /play\.google\.com\/store\/apps\/details\?id=com\.microsoft\.emmx/i,
        /apps\.apple\.com\/us\/app\/microsoft-edge-ai-browser\/id1288723196/i,
        /torproject\.org/i,
        /tor\.app/i,
        /mozilla\.org/i,
        /mozilla\.fi/i,
        /tiktok\.com/i,
        /browser\./i,
        /porn\./i,
        /.\porn/i,
        /tiktok\./i,
        /download\.fi/i,
        /evercast\.us/i,
        /avclabs\.com/i,
        /wondershare\.com/i,
        /wondershare\.net/i,
        /wondershare\.ai/i,
        /risingmax\.com/i,
        /gizmodo\.com/i,
        /comfy\.org/i,
        /runcomfy\.com/i,
        /picsart\.com/i,
        /capcut\.com/i,
        /canva\.com/i,
        /gitlab\.com/i,
        /github.com/i,
        /topazlabs\.com/i,
        /online\.visual-paradigm\.com/i,
        /skylum\.com/i,
        /stable-diffusion-art\.com/i,
        /comfyui\.org/i,
        /thinkdiffusion\.com/i,
        /comfyuiweb\.com/i,
        /horizonmw\.org/i,
        /pinterest\.com/i,
        /irc-galleria\.fi/i,
        /irc-galleria\./i,
        /lite\.irc-galleria\./i,
        /irc-galleria\.fi/i,
        /irc\.fi/i,
	/commentpicker\.com/i,
        /smallseotools\.com/i,
        /ai-apps-directory\/tools\/blob\/main\/Top%209%20Deepnude%20AI%20Apps%20In%202025%3A%20Ethical%20Alternatives%20%26%20Cutting-Edge%20Tools\.md/i,
        /aitoolfor\.org\/tools\/deepnude-ai/i,
        /eeebuntu\.org\/apk\/deepnude-latest-version/i,
        /aitoolfor\.org\/tools\/undress-ai-app-deepnude-nudify-free-undress-ai/i,
        /merlio\.app\/blog\/free-deepnude-ai-alternatives/i,
        /gitlab\.com\/ai-image-and-text-processing\/DeepNude-an-Image-to-Image-technology/i,
        /aitoptools\.com\/tool\/deepnude-by-deepany-ai/i,
        /gitee\.com\/cwq126\/open-deepnude/i,
        /gitlab\.com\/ai-image-and-text-processing\/DeepNude-an-Image-to-Image-technology\/-\/tree\/master\/DeepNude_software_itself/i,
        /facetuneapp\.com\/\?srd=[\w-]+/i,
        /facetuneapp\.com\/$/i,
        /facetune\./i,
        /facetuneapp\./i,
        /play\.google\.com\/store\/apps\/details\?id=com\.lightricks\.facetune\.free/i,
        /apps\.apple\.com\/us\/app\/facetune-video-photo-editor\/id1149994032/i,
        /lunapic\.com/i,
        /tenor\./i,
        /tenor\.com/i,
        /azure\./i,
        /vidu\./i,
        /vidyu\./i,
        /viduy\./i,
        /videy\./i,
        /vidio\./i,
        /vsco\./i,
        /pixelixe\.com/i,
        /picresize\.com/i,
        /replicate\.ai/i,
        /kuvake\.net/i,
        /reddit\.com\/r\/comfyui\/?/i,
        /reddit\.com\/r\/stablediffusion\/?/i,
        /facebook\.com\/tatu\.toiviainen\//i,
        /viewverio\.com/i,
        /irc\.fi/i,
        /kelleyhoaglandphotography\.com/i,
        /nude\./i,
        /naked\./i,
        /photopea\./i,
        /123rf\./i,
        /virtualbox\./i,
        /oracle\./i,
        /play.google./i,
        /formulae\./i,
        /rem\./i,
        /remove\./i,
        /remover\./i,
        /removing\./i,
        /arxiv\./i,
        /osboxes\./i,
        /vmware\./i,
        /face25\./i,
        /face26\./i,
        /anthropic\./i,
        /writecream\./i,
        /waterfox\./i,
        /pixelmator\./i,
        /flexclip\./i,
        /uptodown\./i,
        /perfectcorp\./i,
        /idphotodiy\./i,
        /imagetools\./i,
        /image-tools\./i,
        /img-tools\./i,
        /imgtools\./i,
        /pictools\./i,
        /pic-tools\./i,
        /grok\./i,
        /grokai\./i,
        /grok-ai\./i,
        /yahoo\./i,
        /pict-tools\./i,
        /picttools\./i,
        /phototools\./i,
        /photools\./i,
        /photo-tools\./i,
        /picture-tools\./i,
        /picturetools\./i,
        /workintool\./i,
        /sports\.yahoo\./i,
        /workintools\./i,
        /workin-tool\./i,
        /workin-tools\./i,
        /workingtool\./i,
        /workingtools\./i,
        /working-tool\./i,
        /working-tools\./i,
        /videoaihug\./i,
        /aihugvideo\./i,
        /fotor\./i,
        /imyfone\./i,
        /aihug\./i,
        /hugai\./i,
        /ai-hug\./i,
        /hug-ai\./i,
        /aihugging\./i,
        /huggingai\./i,
        /ai-hugging\./i,
        /hugging-ai\./i,
        /ai-videogenerator\./i,
        /aivideogenerator\./i,
        /videogeneratorai\./i,
        /videogenerator-ai\./i,
        /any-video\./i,
        /anyvideo\./i,
        /any-video-convert\./i,
        /anyvideoconvert\./i,
        /any-videoconvert\./i,
        /anyvideo-convert\./i,
        /any-video-converter\./i,
        /anyvideoconverter\./i,
        /any-videoconverter\./i,
        /anyvideo-converter\./i,
        /ai‑directories\./i,
        /aidirectories\./i,
        /ai‑directory\./i,
        /aidirectory\./i,
        /ai‑directorys\./i,
        /aidirectorys\./i,
        /aitoolsdirectory\./i,
        /aitoolsdirectory\./i,
        /aidirectory\./i, 
        /onlineaidirectory\./i, 
        /aidirectoryonline\./i, 
        /online-aidirectory\./i, 
        /aidirectory-online\./i, 
        /onlineaidirectorys\./i, 
        /aidirectorysonline\./i, 
        /online-aidirectorys\./i, 
        /aidirectorys-online\./i, 
        /ai-directory\./i,
        /assistingintelligence\./i,
        /assisting-intelligence\./i,
        /intelligenceassisting\./i,
        /intelligence-assisting\./i,
        /assistintelligence\./i,
        /assist-intelligence\./i,
        /intelligenceassist\./i,
        /intelligence-assist\./i,
        /aidirectorylist\./i,
        /aiagentsdirectory\./i,
        /aiagentsdirectory\./i,
        /aiphoto\./i,
        /ai-photo\./i,
        /photoai\./i,
        /photo-ai\./i,
        /aiphotohq\./i,
        /ai-photohq\./i,
        /aiphoto-hq\./i,
        /ai-photo-hq\./i,
        /axis-intelligence\.com/i,
        /letsview\.com/i,
        /trendhunter\./i,
        /trendhunt\./i,
        /trend-hunter\./i,
        /trend-hunt\./i,
        /dev\./i,
        /feishu\.cn/i,
        /n8ked\./i,
        /imgur\.com.*nude/i,
        /imgur\.com.*deepn/i,
        /AlexaBliss/i,
        /DuaLipa/i,
        /Dua_Lipa/i,
        /threads\./i,
        /instagram\./i,
        /justaistuff\./i,
        /aistuff\./i,
        /claude\./i,
        /browsing\./i,
        /browsing\./i,
        /-browser\./i,
        /-browsing\./i,
        /a1art\./i,
        /bangbros/i,
        /sportskeeda\.com/i,
        /deviantart\.com/i,
        /deepnude\./i,
        /deepany\./i,
        /deep-any\./i,
        /nudify\./i,
        /venice\./i,
        /venica\./i,
        /vanica\./i,
        /vanice\./i,
        /edit\./i,
        /-edit\./i,
        /editor\./i,
        /-editor\./i,
        /editing\./i,
        /-editing\./i,
        /upscale\./i,
        /-upscale\./i,
        /upscaling\./i,
        /-upscaling\./i,
        /uncensor\./i,
        /uncensoring\./i,
        /uncensored\./i,
        /softorbits\./i,
        /softorbit\./i,
        /soft-orbits\./i,
        /soft-orbit\./i,
        /nightcafe\./i,
        /kuvake\./i,
        /ai-\./i,
        /-ai\./i,
        /ai\./i,
        /neural\./i,
        /nudifyer\./i,
        /nudifying\./i,
        /nudifier\./i,
        /theresanaiforthat\./i,
        /fixthephoto\./i,
        /fixthatphoto\./i,
        /fixthisphoto\./i,
        /nudifyonline\./i,
        /nudify-online\./i,
        /nudifyingonline\./i,
        /nudifying-online\./i,
        /onlinenudify\./i,
        /onlinenudifying\./i,
        /onlinenudifyier\./i,
        /onlinenudifier\./i,
        /online-nudify\./i,
        /online-nudifying\./i,
        /online-nudifyier\./i,
        /online-nudifier\./i,
        /stablediffusionapi\./i,
        /stablediffusion\./i,
        /stable-diffusion\./i,
        /stable-diffusionapi\./i,
        /stablediffusion-api\./i,
        /stable-diffusion-api\./i,
        /stablediffusionapi\./i,
        /huggingface\./i,
        /hugging-face\./i,
        /huntscreen\./i,
        /huntscreens\./i,
        /hunt-screen\./i,
        /hunt-screens\./i,
        /screenhunt\./i,
        /screenshunt\./i,
        /screen-hunt\./i,
        /screens-hunt\./i,
        /trendingaitool\./i,
        /trendingaitools\./i,
        /toolsfine\./i,
        /toolfine\./i,
        /tools-fine\./i,
        /tool-fine\./i,
        /finetools\./i,
        /finetool\./i,
        /fine-tools\./i,
        /fine-tool\./i,
        /HeyGen\./i,
        /GenHey\./i,
        /Hey-Gen\./i,
        /Gen-Hey\./i,
        /apkpure\./i,
        /apk-pure\./i,
        /alucare\./i,
        /scribd\./i,
        /alu-care\./i,
        /noxilo\./i,
        /aichef\./i,
        /ai-chef\./i,
        /chefai\./i,
        /chef-ai\./i,
        /aichief\./i,
        /ai-chief\./i,
        /chiefai\./i,
        /chief-ai\./i,
        /noxillo\./i,
        /vadoo\./i,
        /vidnoz\./i,
        /theresanaiforthat\./i,
        /futuretools\./i,
        /future-tools\./i,
        /futurepedia\./i,
        /future-pedia\./i,
        /aitooldirectory\./i,
        /aitoolsforme\./i,
        /aixploria\./i,  
        /topai\./i, 
        /top-ai\./i,
        /aitop\./i, 
        /ai-top\./i,
        /toolify\./i,  
        /allaitool\./i,  
        /toolsaiapp\./i,  
        /aitoolhunt\./i,  
        /openfuture\./i,  
        /seofai\./i,   
        /alltheaitools\./i,  
        /aitools\./i,   
        /aitoptools\./i,  
        /allthingsai\./i,  
        /aidir\./i, 
        /wegocup\./i,
        /modcombo\./i,
        /monica\./i,
        /aimonica\./i,
        /ai-monica\./i,
        /monicaai\./i,
        /monica-ai\./i,
        /monicai\./i,
        /monic-ai\./i,
        /clothoff\./i,
        /cloth-off\./i,
        /offcloth\./i,
        /off-cloth\./i,
        /clothyoff\./i,
        /clothy-off\./i,
        /offclothy\./i,
        /off-clothy\./i,
        /clothesoff\./i,
        /clothes-off\./i,
        /offclothes\./i,
        /off-clothes\./i,
        /cloudbooklet\./i,
        /cyberlink\./i,
        /undressapp\./i,
        /undress-app\./i,
        /appundress\./i,
        /app-undress\./i,
        /reddit\.com\/r\/MachineLearning/i,
        /reddit\.com\/r\/Grok/i,
        /solo\./i,
        /robeoff\./i,
        /offrobe\./i,
        /robe-off\./i,
        /off-robe\./i,
        /sendfame\./i,
        /send-fame\./i,
        /sendingfame\./i,
        /sending-fame\./i,
        /sendsfame\./i,
        /sends-fame\./i,
        /sentfame\./i,
        /sent-fame\./i,
        /famesend\./i,
        /fame-send\./i,
        /famesending\./i,
        /fame-sending\./i,
        /famesends\./i,
        /fame-sends\./i,
        /famesent\./i,
        /fame-sent\./i,
        /headgenai\./i,
        /headgen-ai\./i,
        /head-genai\./i,
        /head-gen-ai\./i,
        /whatisthebigdata\./i,
        /whatsthebigdata\./i,
        /mangoanimate\./i,
        /mangoai\./i,
        /mango-animate\./i,
        /mango-anim\./i,
        /lantaai\./i,
        /lantai\./i,
        /lanta-ai\./i,
        /mango-anims\./i,
        /coinmarketcap\./i,
        /imageresizer\./i,
        /image-resizer\./i,
        /imageresize\./i,
        /image-resize\./i,
        /photoresizer\./i,
        /photo-resizer\./i,
        /photoresize\./i,
        /photo-resize\./i,
        /mangoanims\./i,
        /mango-animated\./i,
        /mango-animations\./i,
        /mangoanim\./i,
        /mangoanimated\./i,
        /mangoanimations\./i,
        /mango-ai\./i,
        /insmind\./i,
        /dreamshoot\./i,
        /dreamshootai\./i,
        /faceswapvideo\./i,
        /faceswapvid\./i,
        /faceswapvids\./i,
        /faceswapvideos\./i,
        /faceswap-video\./i,
        /faceswap-vid\./i,
        /faceswap-vids\./i,
        /faceswap-videos\./i,
        /saashub\./i,
        /undress\./i,
        /twitter\.com/i,
        /x\.com/i,
    ];

    
const paramsToDelete = ['fbclid', 'mibextid', 'set', 'idorvanity'];

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
            url.searchParams.delete('notif_id');
            url.searchParams.delete('notif_t');
            if (url.searchParams.get('ref') === 'notif') {
                url.searchParams.delete('ref');
            }
            return decodeURIComponent(url.pathname + url.search).toLowerCase();
        } catch (e) {
            return '';
        }
    };

    const cleanUrl = () => {
        try {
            devLog('Cleaning URL parameters');
            const url = new URL(window.location.href);
            const isNotificationNav = isNotificationNavigationUrl(url.href);
            let modified = false;

            paramsToDelete.forEach(param => {
                if (param === 'set' && isNotificationNav) return;
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    modified = true;
                }
            });

            if (url.searchParams.has('notif_id')) {
                url.searchParams.delete('notif_id');
                modified = true;
            }
            if (url.searchParams.has('notif_t')) {
                url.searchParams.delete('notif_t');
                modified = true;
            }
            if (url.searchParams.get('ref') === 'notif') {
                url.searchParams.delete('ref');
                modified = true;
            }

            if (modified) {
                window.history.replaceState({}, document.title, url.toString());
                devLog('URL parameters cleaned');
            }
        } catch (e) {}
    };


const getRegexBlockedWords = () => regexBlockedWords;

    let lastVanityUrl = '';
    let vanityCheckCount = 0;

    const checkVanityProfileFBID = () => {
        try {
            if (isRedirecting) return;
            // Removed isCurrentPostApproved() bypass to ensure numerical profile IDs are ALWAYS strictly checked.
            
            const currentUrl = window.location.href.split('?')[0]; 
            const currentPath = window.location.pathname.toLowerCase();

            // ONLY skip if it's explicitly safely whitelisted. Do NOT skip for just any profile layout!
            if (isSafeWhitelistedPath(currentPath, currentUrl)) return;

            if (currentUrl === lastVanityUrl && vanityCheckCount > 150) return;

            if (currentUrl !== lastVanityUrl) {
                lastVanityUrl = currentUrl;
                vanityCheckCount = 0;
            }

            if (currentPath === '/' || currentPath.includes('/home.php') || currentPath.includes('/search/')) {
                vanityCheckCount = 151; 
                return;
            }

            vanityCheckCount++;

            let foundBanned = false;
            
            const profileElements = document.querySelectorAll(
                '[data-pagelet="ProfileHeader"] a[href], [data-pagelet="PageHeader"] a[href], [data-pagelet="GroupHeader"] a[href], ' +
                'meta[property="al:android:url"], meta[property="al:ios:url"], meta[property="og:url"], meta[content*="profile"]'
            );
            for (let i = 0; i < profileElements.length; i++) {
                const textToCheck = (profileElements[i].href || profileElements[i].content || '');
                if (blockedFbids.some(fbid => textToCheck.includes(fbid))) {
                    foundBanned = true;
                    break;
                }
            }

            if (!foundBanned && vanityCheckCount % 5 === 0) {
                const scripts = document.querySelectorAll('script[type="application/json"]');
                for (let i = 0; i < scripts.length; i++) {
                    const text = scripts[i].textContent || '';
                    if (text.length > 0 && text.length < 150000) { 
                        if (text.includes('profile_id') || text.includes('pageID') || text.includes('entity_id') || text.includes('userID')) {
                            if (blockedFbids.some(fbid => text.includes(`"${fbid}"`) || text.includes(`:${fbid},`) || text.includes(`:${fbid}}`))) {
                                foundBanned = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (foundBanned) {
                triggerRedirect();
            }
        } catch(e) {}
    };

    const handleRedirects = () => {
        try {
            if (isRedirecting) return; 
            // Removed isCurrentPostApproved() bypass so page-level URL checks (photos/profiles) never fail.
            
            const urlObj = new URL(window.location.href);
            if (urlObj.pathname === '/' || urlObj.pathname === '/home.php') {
                return;
            }

            // ONLY skip if it's explicitly safely whitelisted. Do NOT skip for just any profile layout!
            if (isSafeWhitelistedPath(urlObj.pathname, urlObj.href)) {
                return; 
            }

            const hrefString = urlObj.href.toLowerCase();
            let isBlocked = false;

            isBlocked = blockedFbids.some(fbid => hrefString.includes(fbid.toLowerCase()));

            if (!isBlocked) isBlocked = blockedUrls.some(blockedUrl => blockedUrl.test(urlObj.href));

            if (!isBlocked && document.head) {
                const metas = document.head.querySelectorAll('meta[property="al:android:url"], meta[property="al:ios:url"], meta[property="og:url"], meta[content*="profile"]');
                for (let i = 0; i < metas.length; i++) {
                    const content = metas[i].content || '';
                    if (blockedFbids.some(fbid => content.includes(fbid))) {
                        isBlocked = true; break;
                    }
                }
            }

            if (!isBlocked) {
                const rawPathSearch = getSanitizedPathSearchForMatching(urlObj.href);
                
                const spacedPathSearch = rawPathSearch.replace(/[\.\,\-\=\!\?\+\_\@]/g, ' ');
                const strippedPathSearch = rawPathSearch.replace(/[\.\,\-\=\!\?\+\_\s\@]/g, '');

                isBlocked = restrictedWords.some(word => {
                    const strippedWord = word.toLowerCase().replace(/[\.\,\-\=\!\?\+\_\s\@]/g, '');
                    return strippedWord.length > 3 && strippedPathSearch.includes(strippedWord);
                });

                if (!isBlocked) {
                    isBlocked = regexBlockedWords.some(regex => regex.test(rawPathSearch) || regex.test(spacedPathSearch));
                }
            }

            if (!isBlocked) {
                const pageTitle = document.title.toLowerCase();
                isBlocked = restrictedWords.some(word => pageTitle.includes(word.toLowerCase())) || regexBlockedWords.some(regex => regex.test(pageTitle));
            }

            if (!isBlocked) {
                // Safely checks photo view overlays
                const isMedia = hrefString.includes('/photo') || hrefString.includes('fbid=') || hrefString.includes('/reel/') || hrefString.includes('/videos/') || hrefString.includes('/watch');
                if (isMedia) {
                    let textToScan = '';
                    const sidebar = document.querySelector('[data-pagelet="MediaViewer_Sidebar"], [role="complementary"], .x1n2onr6.x1ja2u2z.x1jx94hy.x1qpq9i9');
                    const targetArea = sidebar || document.querySelector('div[role="dialog"]');
                    
                    if (targetArea) {
                        const textNodes = Array.from(targetArea.querySelectorAll('span[dir="auto"], div[dir="auto"], h2, h3, h4'));
                        textNodes.forEach(node => {
                            if (!isInsideComment(node)) {
                                textToScan += node.textContent + ' ';
                            }
                        });
                    }

                    if (textToScan.trim()) {
                        textToScan = textToScan.toLowerCase();
                        if (!allowedWordsLower.some(w => textToScan.includes(w))) {
                            if (restrictedWordsLower.some(w => textToScan.includes(w)) || regexBlockedWords.some(r => r.test(textToScan))) {
                                isBlocked = true;
                            }
                        }
                    }
                }
            }
                
            if (isBlocked) {
                triggerRedirect();
            }
        } catch (e) {}
    };

    const deleteBlockedElements = () => {
        try {
            if (isExcludedPathForDOM(window.location.pathname, window.location.href)) return;

            const elements = document.querySelectorAll('img[src]:not(.fb-sanity-checked), a[href]:not(.fb-sanity-checked), div[data-fbid]:not(.fb-sanity-checked)');
            elements.forEach(element => {
                element.classList.add('fb-sanity-checked');
                if (isSafeElement(element)) return; 
                
                if (isInsideComment(element)) return;

                const src = element.src || '';
                const dataFbid = element.getAttribute('data-fbid') || '';
                const srcSet = element.getAttribute('srcset') || '';
                const href = element.href || '';
                const parentLink = element.closest('a') ? element.closest('a').href : '';

                if (blockedFbids.some(fbid => src.includes(fbid) || dataFbid.includes(fbid) || srcSet.includes(fbid) || href.includes(fbid) || parentLink.includes(fbid))) {
                    safelyHideFBElement(element.closest('div[data-pagelet^="FeedUnit_"]') || element.closest('[role="article"]') || element.closest('div') || element);
                } else if (blockedUrls.some(blockedUrl => blockedUrl.test(href) || blockedUrl.test(parentLink))) {
                    safelyHideFBElement(element.closest('div[data-pagelet^="FeedUnit_"]') || element.closest('[role="article"]') || element.closest('div') || element);
                }
            });
        } catch (e) {}
    };



const FEED_UNIT_SELECTORS = [
    'div[data-pagelet^="FeedUnit_"]',
    'div[data-pagelet^="TimelineFeedUnit_"]',
    'div[data-ad-rendering-role="story_message"]',
    'div[data-ad-preview="message"]'
];
const getFeedUnitSelectorString = () => FEED_UNIT_SELECTORS.join(', ');
const isFeedUnit = (el) => !!(el && el.matches && FEED_UNIT_SELECTORS.some(sel => el.matches(sel)));

const clearFBHideStyles = (element) => {
    if (!element || !element.style) return;
    [
        'display', 'visibility', 'opacity', 'pointer-events', 'position', 'left', 'top',
        'height', 'width', 'overflow', 'content-visibility', 'max-height', 'min-height',
        'margin', 'padding', 'border', 'animation'
    ].forEach(prop => {
        try { element.style.removeProperty(prop); } catch (e) {}
    });
};

const getCurrentFeedContextKey = () => {
    try {
        const url = new URL(window.location.href, window.location.origin);
        if (isNotificationNavigationUrl(url.href)) {
            url.searchParams.delete('notif_id');
            url.searchParams.delete('notif_t');
            if (url.searchParams.get('ref') === 'notif') url.searchParams.delete('ref');
        }
        return url.pathname + '?' + url.searchParams.toString();
    } catch (e) {
        return window.location.pathname;
    }
};

const getFeedPostIdentity = (post) => {
    try {
        const ids = typeof getFBPostIDs === 'function' ? getFBPostIDs(post) : [];
        if (ids && ids.length > 0) return 'ids:' + ids.join('|');
        const links = Array.from(post.querySelectorAll('a[href]'))
            .filter(a => !isInsideComment(a))
            .map(a => a.getAttribute('href') || '')
            .filter(Boolean);
        const link = links.find(href => /\/(posts|permalink|videos|reels?)\//i.test(href) || /(story_fbid|fbid|multi_permalinks|v)=/i.test(href));
        return link ? 'href:' + link.slice(0, 300) : '';
    } catch (e) {
        return '';
    }
};

const tagFeedPostContext = (post) => {
    if (!post || !isFeedUnit(post)) return;
    post.setAttribute('data-fb-context', getCurrentFeedContextKey());
    const identity = getFeedPostIdentity(post);
    if (identity) post.setAttribute('data-fb-post-id', identity);
};

const revealApprovedPost = (post) => {
    if (!post) return;
    clearFBHideStyles(post);
    post.classList.remove('fb-post-banned', 'fb-element-banned', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding');
    post.removeAttribute('data-fb-pending-since');
    post.classList.add('fb-post-approved', 'fb-post-processed');
    tagFeedPostContext(post);
};

const resetFeedPostState = (post) => {
    if (!post || !isFeedUnit(post)) return;
    clearFBHideStyles(post);
    post.classList.remove('fb-post-approved', 'fb-post-banned', 'fb-element-banned', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-post-processed');
    post.removeAttribute('data-fb-pending-since');
    post.removeAttribute('data-processed');
    post.removeAttribute('data-processed-text');
    tagFeedPostContext(post);
    try {
        post.querySelectorAll('.fb-sanity-checked, .fb-words-checked, .fb-search-processed').forEach(el => {
            el.classList.remove('fb-sanity-checked', 'fb-words-checked', 'fb-search-processed');
            el.removeAttribute('data-processed-text');
        });
        post.querySelectorAll('[data-processed]').forEach(el => el.removeAttribute('data-processed'));
    } catch (e) {}
};

const resetReusedFeedUnits = (root = document) => {
    try {
        const currentContext = getCurrentFeedContextKey();
        const candidates = [];
        if (root && root.nodeType === 1 && isFeedUnit(root)) candidates.push(root);
        if (root && root.querySelectorAll) root.querySelectorAll(getFeedUnitSelectorString()).forEach(el => candidates.push(el));

        candidates.forEach(post => {
            const oldContext = post.getAttribute('data-fb-context') || '';
            const oldIdentity = post.getAttribute('data-fb-post-id') || '';
            const newIdentity = getFeedPostIdentity(post);
            const hasState = post.classList.contains('fb-post-processed') || post.classList.contains('fb-post-approved') || post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned');

            if (hasState && oldContext && oldContext !== currentContext) {
                resetFeedPostState(post);
                return;
            }
            if (hasState && oldIdentity && newIdentity && oldIdentity != newIdentity) {
                resetFeedPostState(post);
                return;
            }
            if (!oldContext) post.setAttribute('data-fb-context', currentContext);
            if (newIdentity && !oldIdentity) post.setAttribute('data-fb-post-id', newIdentity);
        });
    } catch (e) {}
};

const markPendingFeedUnits = (root = document) => {
    try {
        const now = Date.now();
        const candidates = [];
        if (root && root.nodeType === 1 && isFeedUnit(root)) candidates.push(root);
        if (root && root.querySelectorAll) root.querySelectorAll(getFeedUnitSelectorString()).forEach(el => candidates.push(el));

        candidates.forEach(post => {
            if (!post || !isFeedUnit(post)) return;
            if (post.classList.contains('fb-post-approved') || post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned') || post.classList.contains('fb-post-processed') || post.classList.contains('fb-post-scanning') || post.classList.contains('fb-post-expanding')) {
                post.classList.remove('fb-post-pending');
                post.removeAttribute('data-fb-pending-since');
                return;
            }

            const since = Number(post.getAttribute('data-fb-pending-since') || '0');
            if (since && (now - since) > 5000) {
                clearFBHideStyles(post);
                post.classList.remove('fb-post-pending');
                post.removeAttribute('data-fb-pending-since');
                return;
            }

            if (!post.classList.contains('fb-post-pending')) {
                post.classList.add('fb-post-pending');
                post.setAttribute('data-fb-pending-since', String(now));
            }
            tagFeedPostContext(post);
        });
    } catch (e) {}
};

const scanAndBanEntirePosts = () => {
    try {
        if (isExcludedPathForDOM(window.location.pathname, window.location.href)) return;
        resetReusedFeedUnits(document);
        markPendingFeedUnits(document);

        const postSelectors = [
            'div[data-pagelet^="FeedUnit_"]',
            'div[data-ad-rendering-role="story_message"]',
            'div[data-ad-preview="message"]',
            'div[data-pagelet^="TimelineFeedUnit_"]',
            'div[data-pagelet="MediaViewerPhoto"]'
        ];

        postSelectors.forEach(selector => {
            document.querySelectorAll(selector + ':not(.fb-post-processed):not(.fb-post-scanning)').forEach(post => {
                if (isInsideComment(post)) {
                    revealApprovedPost(post);
                    return;
                }

                const postIDs = getFBPostIDs(post);
                let isAlreadyApproved = false;
                for (let i = 0; i < postIDs.length; i++) {
                    if (approvedFBPostIDs.has(postIDs[i])) {
                        isAlreadyApproved = true;
                        break;
                    }
                }

                if (isAlreadyApproved || isCurrentPostApproved()) {
                    revealApprovedPost(post);
                    if (postIDs.length > 0) saveApprovedPostIDs(postIDs);
                    return;
                }

                post.classList.remove('fb-post-pending');
                post.removeAttribute('data-fb-pending-since');
                post.classList.add('fb-post-scanning');
                tagFeedPostContext(post);

                const seeMoreButtons = Array.from(post.querySelectorAll('[role="button"]')).filter(btn => {
                    if (isInsideComment(btn)) return false;
                    const t = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                    return t === 'näytä lisää' || t === 'see more';
                });

                const evaluatePost = () => {
                    try {
                        post.classList.add('fb-post-processed');
                        post.classList.remove('fb-post-pending', 'fb-post-scanning');
                        post.removeAttribute('data-fb-pending-since');
                        let isBanned = false;

                        if (hasExplicitBannedPostAction(post)) {
                            isBanned = true;
                        }

                        let fullPostText = '';
                        if (!isBanned) {
                            fullPostText = extractTextFromPostSafely(post).toLowerCase();
                            if (restrictedWordsLower.some(word => fullPostText.includes(word))) isBanned = true;
                            if (!isBanned && regexBlockedWords.some(regex => regex.test(fullPostText))) isBanned = true;
                            if (!isBanned) {
                                const postLinks = Array.from(post.querySelectorAll('a[href]')).filter(link => !isInsideComment(link));
                                for (let i = 0; i < postLinks.length; i++) {
                                    const href = postLinks[i].href;
                                    if (blockedFbids.some(fbid => href.includes(fbid) || href.includes('id=' + fbid))) { isBanned = true; break; }
                                    if (blockedUrls.some(blockedUrl => blockedUrl.test(href))) { isBanned = true; break; }
                                }
                            }
                        }

                        if (isBanned) {
                            post.classList.remove('fb-post-approved');
                            tagFeedPostContext(post);
                            safelyHideFBElement(post);
                        } else {
                            revealApprovedPost(post);
                            if (postIDs.length > 0) saveApprovedPostIDs(postIDs);
                        }
                    } catch (e) {
                        revealApprovedPost(post);
                    }
                };

                if (seeMoreButtons.length > 0 && !post.classList.contains('fb-post-expanding')) {
                    post.classList.add('fb-post-expanding');
                    seeMoreButtons.forEach(btn => { try { btn.click(); } catch (e) {} });
                    setTimeout(evaluatePost, 500);
                    return;
                }
                post.classList.remove('fb-post-expanding');
                post.classList.remove('fb-post-pending');
                post.removeAttribute('data-fb-pending-since');
                evaluatePost();
            });
        });
    } catch (e) {}
};

    const deleteRestrictedWords = () => {
        try {
            if (isExcludedPathForDOM(window.location.pathname, window.location.href)) return;

            // Reverted these selectors back to the facebookOld.js structure to fix the lazy-load tagging bug
            const selectors = [
		'div[data-ad-comet-preview="message"]',
		'div[data-ad-rendering-role="story_message"]',
		'div[data-ad-preview="message"]',
                'div.x1l90r2v.x1iorvi4.x1g0dm76.xpdmqnj',
                'div.xdj266r.x14zmp.xat24cr.x1lziwak.x1vvkbs.x126k92a',
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
                'a[href*="facebook.com/permalink"][aria-label*="20. heinäkuu klo 14.53"]',
                'span.html-span.x1vvkbs',
                'div.html-div.x1a02dak'
            ];

            document.querySelectorAll(selectors.map(s => s + ':not(.fb-words-checked)').join(',')).forEach(element => {
                element.classList.add('fb-words-checked');
                
                if (isSafeElement(element)) return; 
                if (isInsideComment(element)) return;
                if (element.closest('ul[aria-label]') || element.closest('form[role="search"]')) return;

                const owningFeedPost = element.closest(getFeedUnitSelectorString());
                if (owningFeedPost && !owningFeedPost.classList.contains('fb-post-processed') && !owningFeedPost.classList.contains('fb-post-approved') && !owningFeedPost.classList.contains('fb-post-banned')) return;
                
                const elementText = (element.innerText || '').toLowerCase();
                const isRestricted = restrictedWordsLower.some(word => elementText.includes(word));
                const isRegexBlocked = regexBlockedWords.some(regex => regex.test(elementText));
                
                if (isRestricted || isRegexBlocked) {
                    
                    // Removed global isCurrentPostApproved() bypass here because it blinded the scanner to photo theatre overlays.
                    if (element.closest('.fb-post-approved')) {
                        return; 
                    }

                    const currentPath = window.location.pathname.toLowerCase();
                    const isMediaViewer = element.closest('[data-pagelet="MediaViewerPhoto"]') || currentPath.includes('/photo') || currentPath.includes('/reel/') || currentPath.includes('/posts/') || currentPath.includes('/permalink.php') || currentPath.includes('/videos/');
                    
                    if (isMediaViewer) {
                        triggerRedirect();
                        return;
                    }

                    const elementToRemove = element.closest('div[data-pagelet^="FeedUnit_"]') || element.closest('[role="article"]') || element;
                    if (isDangerousToHide(elementToRemove)) return; 

                    if (!elementToRemove.classList.contains('fb-post-banned') && !elementToRemove.classList.contains('fb-element-banned')) {
                        if (elementToRemove.classList.contains('fb-post-approved') || elementToRemove.closest('.fb-post-approved')) return; 
                        elementToRemove.classList.remove('fb-post-approved'); 
                        safelyHideFBElement(elementToRemove);
                    }
                }
            });
        } catch (e) {}
    };

    const processSearchResults = () => {
        try {
            if (window.location.pathname.includes('/search/')) {
                document.body.classList.add('is-search-page');
            } else {
                document.body.classList.remove('is-search-page');
            }
            
            if (!window.location.pathname.includes('/search/')) return;
            
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
                    if (result.closest('[role="banner"]') || result.closest('[role="navigation"]')) return;
                    if (isSafeElement(result)) return; 
                    
                    const textContent = (result.textContent || result.innerText || '').toLowerCase();
                    const processedText = result.getAttribute('data-processed-text');
                    
                    if (result.classList.contains('fb-search-processed') && processedText === textContent) return;
                    
                    result.classList.add('fb-search-processed');
                    result.setAttribute('data-processed-text', textContent);

                    const href = result.href || '';
                    const ariaLabel = result.getAttribute('aria-label') || '';
                    const dataHover = result.getAttribute('data-hovercard') || '';
                    let isBlocked = false;
                    
                    if (restrictedWordsLower.some(word => textContent.includes(word) || ariaLabel.toLowerCase().includes(word))) isBlocked = true; 
                    if (!isBlocked && regexBlockedWords.some(regex => regex.test(textContent) || regex.test(ariaLabel) || regex.test(href))) isBlocked = true; 
                    if (!isBlocked && blockedFbids.some(fbid => href.includes(fbid) || dataHover.includes(fbid) || href.includes('id=' + fbid) || href.includes('profile.php?id=' + fbid))) isBlocked = true; 
                    if (!isBlocked && blockedUrls.some(blockedUrl => blockedUrl.test(href))) isBlocked = true; 
                    
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
                            parentLi.classList.remove('fb-search-banned');
                            parentLi.style.removeProperty('display');
                            parentLi.style.removeProperty('visibility');
                        }
                    }
                });
            });
        } catch (e) {}
    };

    const deleteRestrictedPhrases = () => {
        try {
            if (isExcludedPathForDOM(window.location.pathname, window.location.href)) return;

            const restrictedPhrasesLower = [
                "liity", "reels", "kelat", "sinulle suositeltua", "suositeltua", "tilaa", "ryhmiä sinulle", "meta ai", "ihmisiä,", "joita saatat tuntea", "ihmisiä, joita saatat tuntea", 
                "kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea.", "lisää kavereita saadaksesi suosituksia", "sisältö ei ole käytettävissä tällä hetkellä", "sinulle ehdotettua", "ehdotettu sinulle", "seuraa"
            ];
            const processedElements = new WeakSet();
            
            document.querySelectorAll('div[data-pagelet^="FeedUnit_"]:not([data-processed]), div[data-pagelet^="TimelineFeedUnit_"]:not([data-processed])').forEach((post) => {
                if (isSafeElement(post)) return; 
                post.dataset.processed = "true";

                if (isInsideComment(post)) return;

                let shouldRemove = hasExplicitBannedPostAction(post);
                
                if (!shouldRemove) {
                    const keyElements = Array.from(post.querySelectorAll('h2, h3, h4, div.x1heor9g, [role="button"], span.html-span, div.html-div')).filter(el => !isInsideComment(el));
                    for (let i = 0; i < keyElements.length && !shouldRemove; i++) {
                        const text = keyElements[i].innerText?.toLowerCase() || '';
                        for (let j = 0; j < restrictedPhrasesLower.length; j++) {
                            if (text.includes(restrictedPhrasesLower[j])) { shouldRemove = true; break; }
                        }
                    }
                }
                
                if (shouldRemove) {
                    if (!post.classList.contains('fb-post-banned') && !post.classList.contains('fb-element-banned')) {
                        if (post.classList.contains('fb-post-approved') || post.closest('.fb-post-approved')) return; 
                        post.classList.remove('fb-post-approved'); 
                        safelyHideFBElement(post);
                    }
                }
            });
            
            const headerSelectors = 'h2.html-h2, div.html-h2.xdj266r, span.html-span.x1vvkbs, div.html-div.x1a02dak';
            document.querySelectorAll(headerSelectors).forEach(header => {
                if (processedElements.has(header) || header.closest('header') || header.closest('[role="navigation"]') || header.closest('[role="banner"]')) return;
                processedElements.add(header);

                if (isInsideComment(header)) return;

                const headerText = header.innerText?.toLowerCase() || '';
                
                let isRestricted = false;
                for (let i = 0; i < restrictedPhrasesLower.length && !isRestricted; i++) {
                    if (headerText.includes(restrictedPhrasesLower[i])) isRestricted = true;
                }
                
                if (isRestricted) {
                    let container = null;
                    if (!container) container = header.closest('[data-pagelet^="FeedUnit_"]');
                    if (!container) container = header.closest('[role="article"]');
                    if (!container) container = header.closest('div.x1yztbdb');
                    if (!container) container = header.closest('div.x1lliihq');
                    if (!container) container = header.closest('div.x1ye3gou');
                    if (!container) container = header.closest('div.x78zum5:not([role="navigation"])');
                    
                    if (container && !container.closest('[role="navigation"]') && !container.closest('[role="banner"]') && container.offsetHeight > 40) {
                        if (isDangerousToHide(container)) return; 
                        
                        if (!isSafeElement(container) && !container.classList.contains('fb-post-banned') && !container.classList.contains('fb-element-banned')) { 
                            safelyHideFBElement(container);
                        }
                    }
                }
            });
        } catch (e) {}
    };

    let __fbPhrasesObserverInstalled = false;
    const observeForRestrictedPhrases = () => {
        try {
            if (!document.body || __fbPhrasesObserverInstalled) return;
            __fbPhrasesObserverInstalled = true;
            
            let throttleTimeout = null;
            const throttledDeletePhrases = () => {
                if (!throttleTimeout) {
                    throttleTimeout = addTimeout(() => { deleteRestrictedPhrases(); throttleTimeout = null; }, 100);
                }
            };

            const observer = trackObserver(new MutationObserver((mutations) => {
                let shouldProcess = false;
                for (let i = 0; i < mutations.length; i++) {
                    const mutation = mutations[i];
                    if (mutation.target.closest && (mutation.target.closest('[role="feed"]') || mutation.target.getAttribute?.('role') === 'feed')) {
                        shouldProcess = true; break;
                    }
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        for (let j = 0; j < mutation.addedNodes.length; j++) {
                            const node = mutation.addedNodes[j];
                            if (node.nodeType === 1) { 
                                if (node.querySelector && (node.querySelector('h2.html-h2') || node.querySelector('[role="article"]') || node.querySelector('div.x1lliihq') || node.querySelector('span.html-span'))) {
                                    shouldProcess = true; break;
                                }
                            }
                        }
                        if (shouldProcess) break;
                    }
                }
                if (shouldProcess) throttledDeletePhrases();
            }));

            observer.observe(document.body, { childList: true, subtree: true, attributes: false, characterData: false });
            deleteRestrictedPhrases();
        } catch (e) {}
    };

    if (document.readyState === 'loading') {
        onWindowEvent(window, 'DOMContentLoaded', observeForRestrictedPhrases, false);
    } else {
        addIdleCallback(observeForRestrictedPhrases);
    }

    const deletePeopleYouMayKnow = () => {
        try {
            const selectors = [
                'div[aria-label="People You May Know"]',
                'div[aria-label="Ihmisiä, jotka saatat tuntea"]',
                'a[href="https://www.facebook.com/friends/suggestions/"]',
                'div[aria-label="Näytä suosituksia"]',
                'a[aria-label="Kaverit"]',
                'div[aria-label="Kaverit"]',
                'a[href="https://www.facebook.com/friends/"]',
                'a[href="/friends/"]',
                'div[aria-label="Kaverit"] > span.x1lliihq',
                'svg[aria-label="Meta AI:n profiilikuva"]',
                'svg[aria-label*="Meta AI profile"]',
                'li.x1iyjqo2.xmlsiyf.x1hxoosp.x1l38jg0.x1awlv9s.x1i64zmx.x1gz44f',
                '.x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1)',
                'div.x1i10hfl:nth-child(13)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(1)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(2)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(3)',
                '.x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty)',
                'li.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14zmp.xdj266r.html-li:nth-of-type(2)',
                'div.x1gefphp.xf7dkkf.x1l90r2v.xv54qhq.xyamay9.x1e56ztr.x78zum5.x9f619.x1olyfxc.x15x8krk.xde0f50.x5a5i1n.x1obq294.x6s0dn4:nth-of-type(6)',
                '.xjkvuk6.x1iorvi4.x1qughib.x78zum5.x6s0dn4',
                '.x1vjfegm.x1iyjqo2',
                'div.x1a02dak:nth-child(3) > div:nth-child(1)',
                'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)',
                'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
                '.x1ye3gou.x1120s5i.xn6708d.xz9dl7a.x1qughib.x1q0g3np.x78zum5',
                '.xbbxn1n.xwxc41k.xxbr6pl.x1p5oq8j.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div',
                '.x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
                '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6',
                '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d',
                'svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq',
                'div.html-div.xdj266r.x14zmp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j',
                'div.html-div.xdj266r.x14zmp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z',
                'div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo'
            ];

            selectors.forEach(selector => {
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
                        while (node = walker.nextNode()) {
                            if (node.nodeValue.includes(text)) {
                                let parent = node.parentElement;
                                while (parent && parent !== document.body) {
                                    if (parent.classList.contains('x1yztbdb') ||
                                        parent.classList.contains('html-div')) {
                                        if (isSafeElement(parent)) break; 
                                        if (isDangerousToHide(parent)) break;
                                        
                                        if (!parent.classList.contains('fb-element-banned')) {
                                            safelyHideFBElement(parent);
                                        }
                                        break;
                                    }
                                    parent = parent.parentElement;
                                }
                            }
                        }
                    }
                } else {
                    document.querySelectorAll(selector).forEach(element => {
                        if (isSafeElement(element)) return; 
                        if (isDangerousToHide(element)) return;
                        
                        if (!element.classList.contains('fb-element-banned')) {
                            safelyHideFBElement(element);
                        }
                    });
                }
            });
        } catch (e) {}
    };

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
                '[role="button"][aria-label="Näytä suositukset"]',
                '*:contains("Suositeltu")',
                '*:contains("Recommended")',
                'div.x78zum5.xdt5ytf.xyamay9.xv54qhq.x1l90r2v.xf7dkkf',
                'footer .xi81zsa',
                '.xh8yej3 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r',
                'h2.html-h2.xdj266r.x14zmp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1vvkbs.x1heor9g.x1qlqyl8.x1pd3egz.x1a2a7pz.x193iq5w.xeuugli'
            ];

            selectors.forEach(selector => {
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
                        while (node = walker.nextNode()) {
                            if (node.nodeValue.includes(text)) {
                                let parent = node.parentElement;
                                while (parent && parent !== document.body) {
                                    if (parent.classList.contains('x1yztbdb') ||
                                        parent.classList.contains('html-div')) {
                                        if (isSafeElement(parent)) break; 
                                        if (isDangerousToHide(parent)) break;
                                        
                                        if (!parent.classList.contains('fb-element-banned')) {
                                            safelyHideFBElement(parent);
                                        }
                                        break;
                                    }
                                    parent = parent.parentElement;
                                }
                            }
                        }
                    }
                } else {
                    document.querySelectorAll(selector).forEach(element => {
                        if (isSafeElement(element)) return; 
                        if (isDangerousToHide(element)) return;
                        
                        if (!element.classList.contains('fb-element-banned')) {
                            safelyHideFBElement(element);
                        }
                    });
                }
            });
        } catch (e) {}
    };

    const injectSpecificUrlPrehideCSS = () => {
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
            
            let style = document.getElementById('fb-specific-url-prehide-style');
            if (!style) { 
                style = document.createElement('style'); 
                style.id = 'fb-specific-url-prehide-style'; 
                
                style.textContent = `
                .x1120s5i.x1n2onr6.x10wlt62.x6ikm8r.x1lliihq:not(:has([data-visualcompletion="loading-state"])),
                .x1cnzs8.xjkvuk6.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6:not(:has([data-visualcompletion="loading-state"])),
                .xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619:not(:has([data-visualcompletion="loading-state"])),
                .x7wzq59 > div > div > div > .x1yztbdb > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f61:not(:has([data-visualcompletion="loading-state"])),
                .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w > .xt0psk2:not(:has([data-visualcompletion="loading-state"])),
                footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w:not(:has([data-visualcompletion="loading-state"])),
                .x1xzczws.x7ep2pv.x1d1medc.xnp8db0.x1i64zmx.x1e56ztr.x1emribx.x1xmf6yo.xjl7jj.xs83m0k.xeuugli.x1ja2u2z.x1n2onr6.x9f619:not(:has([data-visualcompletion="loading-state"])),
                .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph > .xeuug:not(:has([data-visualcompletion="loading-state"])),
                .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1k70j0n.xzueoph > .xeuug:not(:has([data-visualcompletion="loading-state"])),
                .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph:not(:has([data-visualcompletion="loading-state"])),
                .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619:not(:has([data-visualcompletion="loading-state"])),
                .xifccgj.x4cne27.xbmpl8g.xykv574.x1y1aw1k.xwib8y2.x1ye3gou.xn6708d.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619:not(:has([data-visualcompletion="loading-state"])),
                .x1y1aw1k.x150jy0e.x1e558r4.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619:not(:has([data-visualcompletion="loading-state"])),
                .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo:not(:has([data-visualcompletion="loading-state"])),
                .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6 > .x2lwn1j.x1iyjqo2.x:not(:has([data-visualcompletion="loading-state"])),
                .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6:not(:has([data-visualcompletion="loading-state"])),
                .x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n:not(:has([data-visualcompletion="loading-state"])),
                .xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619:not(:has([data-visualcompletion="loading-state"])),
                .x1x99re3.x1jdnuiz.x1r1pt67.x1qhmfi1.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14zmp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k:not(:has([data-visualcompletion="loading-state"])),
                .xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.xh8yej3.xdsb8wn.x10l6tqk.x5yr21d.x1q0g3np.xozqiw3.x1qjc9v5.xqughib.x2lah0s.x78zum5.x1ja2u2z.x9f619:not(:has([data-visualcompletion="loading-state"])),
                .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1n2onr6.x10wlt62.x6ikm8r.x1ja2u2z.x9f619:not(:has([data-visualcompletion="loading-state"])),
                div[aria-label="Photos"]:not(:has([data-visualcompletion="loading-state"])),
            footer .xi81zsa,
            footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w:not(:has([data-visualcompletion="loading-state"])),
                .xieb3on:not(:has([data-visualcompletion="loading-state"])),
                div.x9f619.x1n2onr6.x1ja2u2z.xeuugli.xs83m0k.xjl7jj.x1xmf6yo.x1xegmmw.x1e56ztr.x13fj5qh.xnp8db0.x1d1medc.x7ep2pv.x1xzczws:not(:has([data-visualcompletion="loading-state"])),
                div[data-pagelet^="ProfileTilesFeed_"]:has(a[href*="/photos"]),
                h2:has(a[href*="/photos"]) {
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

                if (document.head) {
                    document.head.appendChild(style);
                } else if (document.documentElement) {
                    document.documentElement.appendChild(style);
                }
            }
        } catch (err) {}
    };

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
                            if (isSafeElement(element)) return; 
                            if (element.querySelector(hasMatch[2]) && !element.classList.contains('fb-element-banned')) {
                                safelyHideFBElement(element);
                            }
                        });
                    }
                } else {
                    document.querySelectorAll(selector).forEach(element => {
                        if (isSafeElement(element)) return; 
                        safelyHideFBElement(element);
                    });
                }
            });
        } catch (e) {}
    };

    let __fbNavInterceptInstalled = false;
    const interceptNavigation = () => {
        try {
            if (__fbNavInterceptInstalled) return;
            __fbNavInterceptInstalled = true;

            const clickHandler = (event) => {
                const target = event.target.closest && event.target.closest('a');
                if (!target) return;
                if (isNotificationNavigationUrl(target.href)) return;
                if (blockedUrls.some(blockedUrl => blockedUrl.test(target.href))) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };
            const submitHandler = (event) => {
                const form = event.target;
                const action = form.action || '';
                if (isNotificationNavigationUrl(action)) return;
                if (blockedUrls.some(blockedUrl => blockedUrl.test(action))) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };
            onWindowEvent(document, 'click', clickHandler, true);
            onWindowEvent(document, 'submit', submitHandler, true);
        } catch (e) {}
    };

    const nukeGlobalBadElements = () => {
        try {
            // Nuke "Poista kavereista" from any chat/friends list overlay menu
            document.querySelectorAll('div[role="menuitem"], span[dir="auto"]').forEach(el => {
                if (el.textContent && el.textContent.includes('Poista kavereista')) {
                    const wrapper = el.closest('div[role="menuitem"]') || el;
                    if (!isDangerousToHide(wrapper)) safelyHideFBElement(wrapper);
                }
            });

            // Structurally Nuke "Sinulle ehdotettua" / "Lisää kavereita" Ghost Box
            const ghostSelectors = [
                'div.x1exxf4d.xpv9jar:has(svg circle[fill="#1876f2"][r="12.08"])',
                'div.x1exxf4d.xpv9jar:has(svg path[fill="#90c3ff"])',
                'div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo',
                'i[style*="BXcBrMYpzXO.png"][style*="background-position: 0px -84px"]'
            ];

            ghostSelectors.forEach(selector => {
                if (selector.includes(':has(')) {
                    const hasMatch = selector.match(/^(.*?):has\((.*?)\)$/);
                    if (hasMatch) {
                        document.querySelectorAll(hasMatch[1]).forEach(element => {
                            if (isSafeElement(element)) return; 
                            if (isDangerousToHide(element)) return;
                            if (element.querySelector(hasMatch[2])) {
                                safelyHideFBElement(element);
                            }
                        });
                    }
                } else {
                    document.querySelectorAll(selector).forEach(el => {
                        if (isSafeElement(el)) return; 
                        if (isDangerousToHide(el)) return;
                        safelyHideFBElement(el);
                    });
                }
            });

            // Final text fallback for the ghost container
            const textToFind = ["Lisää kavereita saadaksesi suosituksia", "Kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea."];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
                if (textToFind.some(t => node.nodeValue.includes(t))) {
                    let parent = node.parentElement;
                    while (parent && parent !== document.body) {
                        if (parent.classList.contains('x1exxf4d') || parent.classList.contains('html-div')) {
                            if (isSafeElement(parent)) break; 
                            if (isDangerousToHide(parent)) break;
                            safelyHideFBElement(parent);
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
            }
        } catch (e) {}
    };

    let __fbDomObserverInstalled = false;
    const observeDOMChanges = () => {
        try {
            if (__fbDomObserverInstalled) return;
            __fbDomObserverInstalled = true;

            const throttledRunAllFilters = createThrottle(() => runAllFilters(), 400);

            const observer = trackObserver(new MutationObserver((mutations) => {
                handleRedirects(); 

                let hasSearchChanges = false;
                let hasFeedChanges = false;
                let hasRelevantUiChanges = false;

                mutations.forEach(mutation => {
                    mutation.addedNodes && mutation.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;

                        resetReusedFeedUnits(node);

                        const nodeIsFeed = !!(node.matches && isFeedUnit(node));
                        const nodeHasFeed = !!(node.querySelector && node.querySelector(getFeedUnitSelectorString()));
                        if (nodeIsFeed || nodeHasFeed) {
                            markPendingFeedUnits(node);
                            hasFeedChanges = true;
                        }

                        const nodeIsSearch = !!(node.matches && (node.matches('li[role="row"]') || node.matches('a[aria-describedby]') || node.matches('div[role="option"]') || node.matches('div[role="presentation"]')));
                        const nodeHasSearch = !!(node.querySelector && (node.querySelector('li[role="row"]') || node.querySelector('a[aria-describedby]') || node.querySelector('div[role="option"]') || node.querySelector('div[role="presentation"]')));
                        if (nodeIsSearch || nodeHasSearch) {
                            hasSearchChanges = true;
                        }

                        const nodeIsRelevantUi = !!(node.matches && (node.matches('[role="dialog"]') || node.matches('[role="menu"]') || node.matches('div[aria-label="Kelat"][role="region"]') || node.matches('div[aria-label="Reels"][role="region"]') || node.matches('div[aria-label="Sinulle ehdotettua"][role="region"]') || node.matches('div[aria-label="Suggested for you"][role="region"]')));
                        const nodeHasRelevantUi = !!(node.querySelector && (node.querySelector('[role="dialog"]') || node.querySelector('[role="menu"]') || node.querySelector('div[aria-label="Kelat"][role="region"]') || node.querySelector('div[aria-label="Reels"][role="region"]') || node.querySelector('div[aria-label="Sinulle ehdotettua"][role="region"]') || node.querySelector('div[aria-label="Suggested for you"][role="region"]')));
                        if (nodeIsRelevantUi || nodeHasRelevantUi) {
                            hasRelevantUiChanges = true;
                        }
                    });
                });

                if (!hasFeedChanges && !hasSearchChanges && !hasRelevantUiChanges) return;
                if (hasSearchChanges) processSearchResults();
                throttledRunAllFilters();
            }));
            
            observer.observe(document.documentElement, { childList: true, subtree: true, attributes: false, characterData: false });
        } catch (e) {}
    };

    let __fbHistoryHooked = false;
    const hookHistoryAPI = () => {
        if (__fbHistoryHooked) return;
        __fbHistoryHooked = true;
        
        const originalPushState = history.pushState;
        history.pushState = function() {
            const rv = originalPushState.apply(this, arguments);
            window.dispatchEvent(new Event('pushState'));
            window.dispatchEvent(new Event('locationchange'));
            return rv;
        };
        const originalReplaceState = history.replaceState;
        history.replaceState = function() {
            const rv = originalReplaceState.apply(this, arguments);
            window.dispatchEvent(new Event('replaceState'));
            window.dispatchEvent(new Event('locationchange'));
            return rv;
        };
        onWindowEvent(window, 'popstate', () => {
            window.dispatchEvent(new Event('locationchange'));
        }, false);
    };

    // CHECK FOR SPA NAVIGATION SILENTLY
    function checkSPARouting() {
        if (__lastKnownUrl !== window.location.href) {
            devLog('SPA URL Change Detected via Polling');
            __lastKnownUrl = window.location.href;
            window.dispatchEvent(new Event('locationchange'));
        }
    }

    onWindowEvent(window, 'locationchange', () => {
        devLog('SPA Navigation handled');
        __lastKnownUrl = window.location.href;
        isRedirecting = false;
        resetReusedFeedUnits(document);
        manageCSSStyles();
        runAllFilters();
    }, false);

    const runAllFilters = () => {
        try {
            handleRedirects(); 
            checkVanityProfileFBID(); 
            cleanUrl(); 
            
            const isPersonal = manageCSSStyles();
            
            if (isPersonal) {
                PersonalProfileSelectors();
                
                // Force reveal any posts that the CSS anti-glimpse might have automatically hidden before the CSS toggle kicked in
                document.querySelectorAll(getFeedUnitSelectorString() + ', [role="article"]').forEach(el => {
                    revealApprovedPost(el);
                });
                
                return; // TERMINATES HERE. NOTHING ELSE RUNS ON PERSONAL PROFILES!
            }

            resetReusedFeedUnits(document);
            markPendingFeedUnits(document);

            // Normal execution
            markPendingFeedUnits(document);
            injectSpecificUrlPrehideCSS();
            nukeGlobalBadElements();
            eliminateSuggestedGroups(); 
            filteredProfiles();
            hideCriticalElements();
            deletePeopleYouMayKnow(); 
            processSearchResults(); 
            deleteRestrictedPhrases(); 
            deleteSelectorsForSpecificUrl();
            deleteElement();

            const currentPath = window.location.pathname.toLowerCase();
            const currentUrl = window.location.href.toLowerCase();

            if (isExcludedPathForDOM(currentPath, currentUrl)) {
                document.querySelectorAll(getFeedUnitSelectorString() + ', [role="article"]').forEach(el => {
                    revealApprovedPost(el);
                });
                return; 
            }

            deleteBlockedElements(); 
            scanAndBanEntirePosts();
            deleteRestrictedWords(); 
        } catch (e) {}
    };

    const immediateInit = () => {
        resetReusedFeedUnits(document);
        const isPersonal = manageCSSStyles();
        
        if (isPersonal) {
            PersonalProfileSelectors();
            return; // TERMINATES HERE.
        }
        
        markPendingFeedUnits(document);
        injectSpecificUrlPrehideCSS();
        nukeGlobalBadElements(); filteredProfiles();
        eliminateSuggestedGroups(); hideCriticalElements(); processSearchResults();
        deleteRestrictedPhrases(); deletePeopleYouMayKnow(); deleteSelectorsForSpecificUrl(); deleteElement(); 

        const currentPath = window.location.pathname.toLowerCase();
        if (isExcludedPathForDOM(currentPath, window.location.href)) return;

        scanAndBanEntirePosts(); deleteRestrictedWords(); deleteBlockedElements(); 
    };

    const ensureDOMReady = () => {
        const armReadyHooks = () => {
            observeDOMChanges();
            observeForRestrictedPhrases();
            interceptNavigation();
            hookHistoryAPI();
            resetReusedFeedUnits(document);
            runAllFilters();
        };

        if (document.readyState === 'loading') {
            onWindowEvent(window, 'DOMContentLoaded', armReadyHooks, false);
        } else {
            armReadyHooks();
        }
    };

    const init = () => {
        ensureDOMReady(); resetReusedFeedUnits(document); markPendingFeedUnits(document); handleRedirects(); cleanUrl(); 
        
        const isPersonal = manageCSSStyles();
        
        if (isPersonal) {
            PersonalProfileSelectors();
        } else {
            injectSpecificUrlPrehideCSS();
            nukeGlobalBadElements();
            eliminateSuggestedGroups(); hideCriticalElements(); processSearchResults(); deleteRestrictedPhrases(); deletePeopleYouMayKnow(); deleteSelectorsForSpecificUrl();
            deleteElement(); filteredProfiles();
            
            const currentPath = window.location.pathname.toLowerCase();
            if (!isExcludedPathForDOM(currentPath, window.location.href)) {
                deleteBlockedElements(); scanAndBanEntirePosts(); deleteRestrictedWords(); 
            }
        }
        
        onWindowEvent(window, 'pageshow', (event) => { if (event.persisted) runAllFilters(); }, false);
    };

    init();
    immediateInit();

    onWindowEvent(window, 'DOMContentLoaded', runAllFilters, false);
    onWindowEvent(window, 'load', runAllFilters, false);
    onWindowEvent(window, 'popstate', runAllFilters, false);

    function scheduleMainInterval() {
        addInterval(() => {
            checkSPARouting();
            if (!document.hidden) {
                runAllFilters();
            }
        }, 120);
    }

    startIntervals(scheduleMainInterval);
    onWindowEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleMainInterval);
            runAllFilters();
        }
    }, false);

    onWindowEvent(window, 'pagehide', cleanup, false);
    onWindowEvent(window, 'beforeunload', cleanup, false);

})();