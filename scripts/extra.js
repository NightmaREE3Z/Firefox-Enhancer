(function() {
'use strict';

    // ===== Lightweight lifecycle/memory tracking =====
    const __timers = { intervals: new Set(), timeouts: new Set() };
    const __observers = new Set();
    const __eventCleanups = new Set();
    const __rafIds = new Set(); // track requestAnimationFrame ids
    let __cleanupRan = false;
    let __intervalsRunning = false;
    let __isRedirectingFast = false; // new: guards double redirects

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
    function cleanup() {
        if (__cleanupRan) return;
        __cleanupRan = true;
        try {
            stopIntervals();
            __timers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __timers.timeouts.clear();
            __rafIds.forEach(id => { try { cancelAnimationFrame(id); } catch {} });
            __rafIds.clear();
            __observers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __observers.clear();
            __eventCleanups.forEach(fn => { try { fn(); } catch {} });
            __eventCleanups.clear();
            try { document.getElementById('extra-redirect-style')?.remove(); } catch {}
            try { document.getElementById('extra-blank-style')?.remove(); } catch {}
        } catch {}
    }

    // ===== Protected Snapchat Chat Sidebar Selectors (never hide/delete these) =====
    const snapchatProtectedSelectors = [
        '.BL7do',
        '.XlW_1',
        '.AbUJt',
        '.Titq2',
        '.FBTDE',
        '.D8ovh',
        '.lzKDW',
        '.vbVAI',
        '.JM4Qm',
        '.yLNNg',
        '.toJ1p',
        '.KcY9t',
        '.kwuI_',
        '.eKaL7',
        '.Bnaur',
        '.zUzvu',
        '.LsbRg',
        '.n6VkK',
        '.wHvEy',
        '.xGUM5',
        '.PrUqm',
        '.XLCCn',
        '.cJcor',
        '.zwwmh',
        '.yC1EG',
        '._S446',
        '.POnGV',
        '.DkxOl',
        '.C5Sux',
        '.dmsdi',
        '.Vhq_T',
        '.deg2K',
        '.ReactVirtualized__Grid',
        '.ReactVirtualized__List',
        '.QAr02',
        '.ReactVirtualized__Grid__innerScrollContainer',
        '.O4POs',
        '.LNwMF',
        '.yOCPc',
        '.RGJQE',
        '.sTfiC',
        '.xllKA',
        '.Dozhe',
        '.uALhC',
        '.BbZFb',
        '.mYSR9',
        '.FiLwP',
        '.PWxCe',
        '.nmvCS',
        '.k2F9c',
        '.Hzb7k',
        '.aXdlm',
        '.Gq3RH',
        '.ovUsZ',
        '.GQKvA',
        '.rNemx',
        '.w15C2',
        '.HEkDJ',
        '.resize-triggers',
        '.expand-trigger',
        '.contract-trigger',
        '#comma1',
        // NEW: Added selectors from the provided HTML for additional protection
        'div.UZxw_ button.Rknx9',
        'button.Rknx9',
        'svg[viewBox="0 0 10 14"]',
        'path[fill-rule="evenodd"]'
    ];

    // NEW: IRC Galleria selectors to hide immediately
    const ircGalleriaSelectorsToHide = [
        '#thumb_div_129640995',
        '#thumb_div_129640994',
        '#thumb_div_129640992',
        '#thumb_div_129580627',
        '#thumb_div_129559690',
        '#thumb_div_129640997',
        '#thumb_div_129640991',
        '#thumb_div_129684375',
        '#thumb_div_130016541',
        '#thumb_div_129804009',
        '#thumb_div_129262368',
        '#thumb_div_128593982',
        '#image-129684375-image',
        '#image-129640994-image',
        '#image-129640992-image',
        '#image-129580627-image',
        '#image-129640995-image',
        '#image-129262368-image',
        '#image-129559690-image',
        '#image-128593982-image',
        '#image-131040158-image',
        '#talk-contacts-header',
        '#talk-conversations',
        '#talk-contacts',
        '#submenu-profile',
        '#h2-icon > a > img',
        '#user-information > div.center > div > dl > dd.fn.first.last',
        '#profile-image',
        '#submenu-album',
        '#submenu-album > a',
        '#profile-image > div.center > div > div.prevnext.mode-classic > a',
        '#profile-image > div.center > div > div.prevnext.mode-classic > span',
        '#profile-image > div.center > div > div.prevnext.mode-classic'
    ];

    const ircGalleriaBannedPatterns = [
        'irpp4/album?page=1', 'irpp4/album?page=0', 'irpp4/album',
        'picture/129640994', 'picture/129640992', 'picture/129262368', 'picture/129580627',
        'picture/129640995', 'picture/129559690', 'picture/129640997', 'picture/129640991',
        'picture/130016541', 'picture/129804009', 'picture/129684375', 'picture/128593982'
    ];

    // NEW: Snapchat unwanted elements to hide (e.g., Spotlight menu button)
    const snapchatUnwantedSelectors = [
        '.OwWqx[title="Katso valokeilatarinoita"]',  // Spotlight menu button to remove from menu
        // Add other unwanted selectors here if needed
    ];

    // NEW: Snapchat Camera selector to expand to fill available space (not full screen)
    const snapchatCameraSelector = '.G3Z4U.Xg7U0';

    // NEW: Snapchat Minimize Button selector (to auto-click for collapsing spotlight)
    const snapchatMinimizeButtonSelector = 'button.Rknx9';  // Using the protected selector for the button

    let currentURL = window.location.href;
    let kuvakeRedirected = false;
    const hiddenElements = new WeakSet();
    let githubRedirected = false;

    // Helper: remove image/network loads from a container (best-effort)
    function stripImagesWithin(el) {
        try {
            el.querySelectorAll('img, source, video').forEach(node => {
                if (node.tagName === 'IMG') {
                    node.removeAttribute('srcset');
                    node.removeAttribute('src');
                    node.loading = 'lazy';
                    node.decoding = 'async';
                    node.style.setProperty('display', 'none', 'important');
                    node.style.setProperty('visibility', 'hidden', 'important');
                } else if (node.tagName === 'SOURCE') {
                    node.removeAttribute('srcset');
                    node.removeAttribute('src');
                } else if (node.tagName === 'VIDEO') {
                    node.pause?.();
                    node.removeAttribute('src');
                    node.removeAttribute('poster');
                }
            });
        } catch {}
    }

    // Helper: Check if an element is protected (should never be hidden/deleted)
    function isElementProtected(element) {
        try {
            return snapchatProtectedSelectors.some(selector => element.matches && element.matches(selector));
        } catch {
            return false;
        }
    }

    // Inject CSS for IRC Galleria immediate hiding and Snapchat unwanted elements
    const injectInlineCSS = () => {
        try {
            const styleId = 'extra-redirect-style';
            let style = document.getElementById(styleId);
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
            }
            const ircGalleriaCSS = currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4') ? 
                ircGalleriaSelectorsToHide.map(selector => `${selector}`).join(',\n') + ' {' +
                    'display: none !important;' +
                    'visibility: hidden !important;' +
                    'opacity: 0 !important;' +
                    'height: 0 !important;' +
                    'width: 0 !important;' +
                    'max-height: 0 !important;' +
                    'max-width: 0 !important;' +
                    'overflow: hidden !important;' +
                    'position: absolute !important;' +
                    'left: -9999px !important;' +
                    'top: -9999px !important;' +
                    'margin: 0 !important;' +
                    'padding: 0 !important;' +
                    'border: none !important;' +
                    'transition: none !important;' +
                '}' : '';

            const snapchatUnwantedCSS = window.location.hostname.includes('snapchat.com') ? 
                snapchatUnwantedSelectors.map(selector => `${selector}`).join(',\n') + ' {' +
                    'display: none !important;' +
                    'visibility: hidden !important;' +
                    'opacity: 0 !important;' +
                    'height: 0 !important;' +
                    'width: 0 !important;' +
                    'max-height: 0 !important;' +
                    'max-width: 0 !important;' +
                    'overflow: hidden !important;' +
                    'position: absolute !important;' +
                    'left: -9999px !important;' +
                    'top: -9999px !important;' +
                    'margin: 0 !important;' +
                    'padding: 0 !important;' +
                    'border: none !important;' +
                    'transition: none !important;' +
                '}' : '';

            style.textContent = `
            /* IRC Galleria pre-hide CSS for immediate thumbnail deletion */
            ${ircGalleriaCSS}
            /* Snapchat unwanted elements pre-hide CSS (e.g., Spotlight button) */
            ${snapchatUnwantedCSS}
            `;
            
            if (!style.isConnected) {
                if (document.head) {
                    document.head.appendChild(style);
                } else if (document.documentElement) {
                    document.documentElement.insertBefore(style, document.documentElement.firstChild);
                }
            }
        } catch {}
    };

    function collapseElement(element) {
        if (!hiddenElements.has(element)) {
            stripImagesWithin(element);
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('max-height', '0', 'important');
            element.style.setProperty('height', '0', 'important');
            element.style.setProperty('min-height', '0', 'important');
            element.style.setProperty('overflow', 'hidden', 'important');
            element.style.setProperty('padding', '0', 'important');
            element.style.setProperty('margin', '0', 'important');
            element.style.setProperty('border', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('flex', '0 0 0px', 'important');
            element.style.setProperty('grid', 'none', 'important');
            element.style.setProperty('transition', 'none', 'important');
            element.style.setProperty('opacity', '0', 'important');
            element.style.setProperty('position', 'absolute', 'important');
            element.style.setProperty('left', '-9999px', 'important');
            element.style.setProperty('top', '-9999px', 'important');
            hiddenElements.add(element);
        }
    }

    function handleIRCGalleriaThumbDeletion() {
        if (!currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) return;
        ircGalleriaSelectorsToHide.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!hiddenElements.has(element)) {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('visibility', 'hidden', 'important');
                    element.style.setProperty('opacity', '0', 'important');
                    element.style.setProperty('height', '0', 'important');
                    element.style.setProperty('width', '0', 'important');
                    element.style.setProperty('max-height', '0', 'important');
                    element.style.setProperty('max-width', '0', 'important');
                    element.style.setProperty('position', 'absolute', 'important');
                    element.style.setProperty('left', '-9999px', 'important');
                    element.style.setProperty('top', '-9999px', 'important');
                    element.style.setProperty('overflow', 'hidden', 'important');
                    element.style.setProperty('margin', '0', 'important');
                    element.style.setProperty('padding', '0', 'important');
                    element.style.setProperty('border', 'none', 'important');
                    element.style.setProperty('transition', 'none', 'important');
                    hiddenElements.add(element);
                    try {
                        element.remove();
                    } catch (e) {
                        // Firefox/extension-safe: remove children without innerHTML
                        try {
                            while (element.firstChild) element.removeChild(element.firstChild);
                        } catch {}
                    }
                }
            });
        });
    }

    // NEW: Function to hide unwanted Snapchat elements (e.g., Spotlight menu button)
    function handleSnapchatUnwantedHiding() {
        if (!window.location.hostname.includes('snapchat.com')) return;
        snapchatUnwantedSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!hiddenElements.has(element) && !isElementProtected(element)) {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('visibility', 'hidden', 'important');
                    element.style.setProperty('opacity', '0', 'important');
                    element.style.setProperty('height', '0', 'important');
                    element.style.setProperty('width', '0', 'important');
                    element.style.setProperty('max-height', '0', 'important');
                    element.style.setProperty('max-width', '0', 'important');
                    element.style.setProperty('position', 'absolute', 'important');
                    element.style.setProperty('left', '-9999px', 'important');
                    element.style.setProperty('top', '-9999px', 'important');
                    element.style.setProperty('overflow', 'hidden', 'important');
                    element.style.setProperty('margin', '0', 'important');
                    element.style.setProperty('padding', '0', 'important');
                    element.style.setProperty('border', 'none', 'important');
                    element.style.setProperty('transition', 'none', 'important');
                    hiddenElements.add(element);
                    try {
                        element.remove();
                    } catch (e) {
                        try {
                            while (element.firstChild) element.removeChild(element.firstChild);
                        } catch {}
                    }
                }
            });
        });
    }

    // NEW: Function to auto-minimize Snapchat Spotlight as fast as possible
    function handleSnapchatSpotlightAutoMinimize() {
        if (!window.location.hostname.includes('snapchat.com')) return;
        // Minimize as soon as possible - check immediately and on DOMContentLoaded
        const tryMinimize = () => {
            try {
                const minimizeButton = document.querySelector(snapchatMinimizeButtonSelector);
                if (minimizeButton && !hiddenElements.has(minimizeButton)) {
                    minimizeButton.click();
                    console.log('Auto-minimized Snapchat spotlight immediately.');
                } else {
                    // Retry quickly if not found
                    addTimeout(tryMinimize, 50);
                }
            } catch (e) {
                console.warn('Failed to auto-minimize Snapchat spotlight:', e);
            }
        };
        tryMinimize();
        // Also try on DOMContentLoaded for safety
        onEvent(document, 'DOMContentLoaded', tryMinimize, false);
    }

    // NEW: Function to expand Snapchat Camera element to fill available space (not full screen)
    function handleSnapchatCameraExpansion() {
        if (!window.location.hostname.includes('snapchat.com')) return;
        const cameraElement = document.querySelector(snapchatCameraSelector);
        if (cameraElement && !hiddenElements.has(cameraElement)) {
            // Make the camera element fill its container's available space, without overlaying full screen
            cameraElement.style.setProperty('width', '100%', 'important');
            cameraElement.style.setProperty('height', '100%', 'important');
            cameraElement.style.setProperty('margin', '0', 'important');
            cameraElement.style.setProperty('padding', '0', 'important');
            cameraElement.style.setProperty('border', 'none', 'important');
            cameraElement.style.setProperty('transition', 'none', 'important');
            // Ensure inner elements adjust (e.g., images)
            cameraElement.querySelectorAll('img').forEach(img => {
                img.style.setProperty('width', '100%', 'important');
                img.style.setProperty('height', '100%', 'important');
                img.style.setProperty('object-fit', 'cover', 'important');
            });
        }
    }

    function handleIrcGalleriaRedirect2() {
        const url = window.location.href.toLowerCase();
        if (url === 'https://irc-galleria.net/user/irpp4' || url === 'https://irc-galleria.net/user/irpp4/') {
            fastRedirect('https://irc-galleria.net/user/Irpp4/blogs');
            return true;
        }
        return false;
    }

    // New: safe "whiteout" before redirect (no document.write)
    function blankOutPage() {
        try {
            let s = document.getElementById('extra-blank-style');
            if (!s) {
                s = document.createElement('style');
                s.id = 'extra-blank-style';
                s.textContent = `
                    html, body { background: #fff !important; }
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
        try { if (typeof window.stop === "function") window.stop(); } catch {}
        blankOutPage();
        // Prefer replace (no history entry). If it throws, fall back.
        try { window.location.replace(target); return; } catch(e) {}
        try { window.location.assign(target); return; } catch(e) {}
        try { window.location.href = target; } catch(e) {}
    }

    function handleGitHubRedirect() {
        if (githubRedirected) return;
        const currentURL = window.location.href;

        const blockedUsers = [
            'HorizonMW',
        ];

        const blockedRepos = [
            'HorizonMW-Client',
        ];

        const blockedPatterns = [
            /github\.com\/best-deepnude-ai-apps/i,
            /github\.com\/AI-Reviewed\/tools\/blob\/main\/Nude%20AI%20:%205%20Best%20AI%20Nude%20Generators%20-%20AIReviewed\.md/i,
            /github\.com\/nudify-ai/i,
            /github\.com\/Top-AI-Apps/i,
            /github\.com\/HorizonMW\/HorizonMW-Client/i,
            /github\.com\/HorizonMW\/[^\/]+/i,
            /github\.com\/Top-AI-Apps\/Review\/blob\/main\/Top%205%20DeepNude%20AI%3A%20Free%20%26%20Paid%20Apps%20for%20Jan%202025%20-%20topai\.md/i,
            /github\.com\/comfyanonymous/i,
        ];

        const userPattern = blockedUsers.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const isProfileRoot = new RegExp(`^https://github\\.com/(${userPattern})/?$`).test(currentURL);
        const repoMatch = currentURL.match(new RegExp(`^https://github\\.com/(${userPattern})/([^/#?]+)`));
        const matchesBlockedPattern = blockedPatterns.some(pattern => pattern.test(currentURL));

        if (isProfileRoot || matchesBlockedPattern) {
            githubRedirected = true;
            fastRedirect('https://github.com');
            return;
        }
        if (repoMatch && blockedRepos.includes(repoMatch[2])) {
            githubRedirected = true;
            fastRedirect('https://github.com');
            return;
        }
    }

    // NEW: immediate preflight redirect before any other work (Chrome lag killer)
    function preflightEarlyRedirect() {
        try {
            const hrefLower = location.href.toLowerCase();
            const hostLower = location.hostname.toLowerCase();

            // IRC-Galleria: ban-list paths and user root — redirect instantly
            if (hostLower.includes('irc-galleria.net') && hrefLower.includes('/user/irpp4')) {
                for (let i = 0; i < ircGalleriaBannedPatterns.length; i++) {
                    if (hrefLower.includes(ircGalleriaBannedPatterns[i].toLowerCase())) {
                        fastRedirect('https://irc-galleria.net');
                        return true;
                    }
                }
                if (hrefLower === 'https://irc-galleria.net/user/irpp4' || hrefLower === 'https://irc-galleria.net/user/irpp4/') {
                    fastRedirect('https://irc-galleria.net/user/Irpp4/blogs');
                    return true;
                }
            }
            // TikTok specific handle (kept consistent with later handler)
            if (hrefLower.includes('@karabrannbacka')) {
                fastRedirect('https://www.tiktok.com');
                return true;
            }
        } catch {}
        return false;
    }

    // Run the preflight right away at document_start
    if (preflightEarlyRedirect()) {
        // Hard stop: do not set up observers/intervals if we already redirected.
        return;
    }

    // After the preflight, continue with the regular flow
    injectInlineCSS();

    function handleRedirectionsAndContentHiding() {
        if (__isRedirectingFast) return;
        currentURL = window.location.href;

        if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
            for (let pattern of ircGalleriaBannedPatterns) {
                if (currentURL.toLowerCase().includes(pattern.toLowerCase())) {
                    fastRedirect('https://irc-galleria.net');
                    return;
                }
            }
            if (handleIrcGalleriaRedirect2()) return;
        }

        handleIRCGalleriaThumbDeletion();
        handleSnapchatUnwantedHiding();  // NEW: Hide unwanted elements like Spotlight menu button
        handleSnapchatSpotlightAutoMinimize();  // NEW: Auto-minimize spotlight immediately
        handleSnapchatCameraExpansion();  // NEW: Added call to expand Snapchat camera within its container

        if (currentURL.includes('github.com')) {
            handleGitHubRedirect();
        }

        if (window.location.hostname.includes('kuvake.net')) {
            var kuvakeRedirectUsers = [
                "iräö", "iraö", "ira", "irpp4",
                "m1mmuska", "just.se.mimmi", "mimmuska", "mimmusk4", "m1mmusk4"
            ];
            var pathname = window.location.pathname;
            var decodedPath = decodeURIComponent(pathname).toLowerCase();
            for (var i = 0; i < kuvakeRedirectUsers.length; ++i) {
                var u = kuvakeRedirectUsers[i];
                if (
                    decodedPath === '/user/' + u ||
                    pathname.toLowerCase() === '/user/' + u
                ) {
                    if (!kuvakeRedirected) {
                        kuvakeRedirected = true;
                        fastRedirect('https://kuvake.net');
                    }
                    return;
                }
            }
        }

        if (currentURL.includes('@karabrannbacka')) {
            try { window.stop(); } catch {}
            fastRedirect('https://www.tiktok.com');
            return;
        }
    }

    let observerScheduled = false;
    function observerCallback(mutationsList) {
        if (observerScheduled) return;
        observerScheduled = true;
        addTimeout(() => {
            observerScheduled = false;
            handleIRCGalleriaThumbDeletion();
        }, 80);
    }

    function initObserver() {
        if (__isRedirectingFast) return;
        const observer = trackObserver(new MutationObserver(observerCallback));
        function startObserve() {
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                onEvent(document, 'DOMContentLoaded', () => {
                    observer.observe(document.body, { childList: true, subtree: true });
                }, false);
            }
        }
        startObserve();
    }

    function mainHandler() {
        if (__isRedirectingFast) return;
        handleRedirectionsAndContentHiding();
        if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
            handleIRCGalleriaThumbDeletion();
        }
    }

    mainHandler();
    initObserver();

    function scheduleIntervals() {
        addInterval(() => {
            if (!document.hidden && !__isRedirectingFast) {
                mainHandler();
                if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
                    handleIRCGalleriaThumbDeletion();
                }
            }
        }, 120);
    }
    startIntervals(scheduleIntervals);

    onEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleIntervals);
            mainHandler();
        }
    }, false);

    (function() {
        var _wr = function(type) {
            var orig = history[type];
            return function() {
                var rv = orig.apply(this, arguments);
                window.dispatchEvent(new Event(type));
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
        if (__isRedirectingFast) return;
        currentURL = window.location.href;
        injectInlineCSS();
        mainHandler();
        if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
            handleIRCGalleriaThumbDeletion();
        }
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

})();