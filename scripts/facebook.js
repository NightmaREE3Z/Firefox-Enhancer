// ==UserScript==
// @name         FBCleaner 27.3.5
// @date      	 2026-08-23
// @description  Makes my Facebook experience less terrible.
// @match        *://*.facebook.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
'use strict';

// ============================================================
// BRAVEFOX FACEBOOK.JS NAVIGATION INDEX (v50)
// Search these exact labels to jump around this single-file build:
//   [LIFECYCLE]        timers, observers, cleanup, throttling
//   [NATIVE-SURFACES]  notifications, comments, dialogs, Stories
//   [PROFILE-POLICY]   own/Dad/trusted/isolated profile decisions
//   [ZERO-GLIMPSE]     friends cards, likes rows, profile screening
//   [POST-SCANNER]     one-shot feed hydration and post decisions
//   [SEARCH]           Facebook search result filtering
//   [COSMETICS]        recommendations, Meta AI, Reels, sidebars
//   [SPA-RUNTIME]      history hooks, MutationObserver, scheduler
// ============================================================

// === CHROME DEV CONSOLE LOGGING ===
const DEBUG = false;
function devLog(message) {
    if (DEBUG) console.log('[FACEBOOK.JS]', message);
}

// ===== v37: shared-PC account scope =====
// Dad is fine with recommended/suggested Facebook cruft. Keep safety filtering global,
// but only run cosmetic/quality-of-life element deletion on Haukkis' account or on
// explicitly supported high-risk pages/profiles.
const FB_STRICT_ELEMENT_ACCOUNT_IDS = new Set(['100005050653554']);
const FB_SPECIFIC_URL_SURFACES = [
    'https://www.facebook.com/four3four',
    'https://www.facebook.com/ItsStillRealToUsDammit',
    'https://www.facebook.com/prowrestlingworld',
    'https://www.facebook.com/weirdimagesworthseeing'
];
const FB_SPECIFIC_PROFILE_IDS = new Set(['100000639309471', '1150630468']);
let __fbElementHidingAccountEnabled = false;

// v43: account identity is stable for the life of the page. Cookie lookup stays cheap,
// while the expensive HTML fallback is cached and rate-limited instead of serializing
// 160-250 KB of the document from every scanner.
let __fbCachedLoggedInAccountFbid = '';
let __fbNextAccountHtmlProbeAt = 0;

const getCachedLoggedInFacebookAccountFbid = (htmlLimit = 180000) => {
    try {
        const cookieMatch = String(document.cookie || '').match(/(?:^|;\s*)c_user=(\d+)/);
        if (cookieMatch && cookieMatch[1]) {
            __fbCachedLoggedInAccountFbid = cookieMatch[1];
            return cookieMatch[1];
        }
    } catch (e) {}

    if (__fbCachedLoggedInAccountFbid) return __fbCachedLoggedInAccountFbid;

    const now = Date.now();
    if (now < __fbNextAccountHtmlProbeAt) return '';
    __fbNextAccountHtmlProbeAt = now + 8000;

    try {
        const html = document.documentElement
            ? String(document.documentElement.innerHTML || '').slice(0, htmlLimit)
            : '';
        const patterns = [
            /["']ACCOUNT_ID["']\s*[:=]\s*["'](\d+)["']/i,
            /["']USER_ID["']\s*[:=]\s*["'](\d+)["']/i,
            /["']actorID["']\s*[:=]\s*["'](\d+)["']/i,
            /["']userID["']\s*[:=]\s*["'](\d+)["']/i,
            /["']viewerID["']\s*[:=]\s*["'](\d+)["']/i
        ];
        for (let i = 0; i < patterns.length; i++) {
            const match = html.match(patterns[i]);
            if (match && match[1]) {
                __fbCachedLoggedInAccountFbid = match[1];
                return match[1];
            }
        }
    } catch (e) {}
    return '';
};

const getEarlyLoggedInFacebookAccountFbid = () =>
    getCachedLoggedInFacebookAccountFbid(160000);

// ===== v54: Messenger full-page native territory =====
// All facebook.com/messages* and facebook.com/messenger* routes are Facebook-owned UI.
// Only the explicitly allowed top-navigation cleanup and Haukkis-only hidden-contact rows
// may be touched there; feed/post/profile/content scanners must stay completely out.
function isFBMessengerPath(inputUrl = window.location.href) {
    try {
        const url = new URL(inputUrl, window.location.origin);
        const host = String(url.hostname || '').toLowerCase();
        if (!/(^|\.)facebook\.com$/.test(host)) return false;
        return /^\/(?:messages|messenger)(?:\/|$)/i.test(String(url.pathname || '/'));
    } catch (e) {
        return /^\/(?:messages|messenger)(?:\/|$)/i.test(String(inputUrl || ''));
    }
}

// ===== v56: embedded Messenger chat tabs are native territory too =====
// Facebook's small bottom-right chat tabs reuse role="article" for individual messages.
// Feed scanners must never claim those rows merely because the current URL is still /.
const FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56 = [
    '[data-pagelet="MWChatTabHeader"]',
    '[data-pagelet="MAWSecureThreadDetailWrapper"]',
    '[data-pagelet="MWV2MessageList"]',
    '[data-pagelet="MWMessageRow"]',
    '[role="log"][aria-label*="Viestit keskustelussa" i]',
    '[role="log"][aria-label*="Messages in conversation" i]'
].join(',');

const isFBInsideEmbeddedChatSurfaceV56 = (element) => {
    try {
        const node = element?.nodeType === 1 ? element : element?.parentElement;
        return !!(node?.closest && node.closest(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56));
    } catch (e) {
        return false;
    }
};

const getFBEmbeddedChatRootV56 = (element) => {
    try {
        const seed = element?.nodeType === 1 ? element : element?.parentElement;
        if (!seed) return null;
        let marker = seed.closest?.(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56) || null;
        if (!marker && seed.matches?.(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56)) marker = seed;
        if (!marker && seed.querySelector) marker = seed.querySelector(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56);
        if (!marker) return null;

        let node = marker;
        let fallback = marker.closest?.('[data-pagelet="MAWSecureThreadDetailWrapper"], [data-pagelet="MWV2MessageList"]') || marker;
        for (let depth = 0; node && node !== document.body && depth < 12; depth++, node = node.parentElement) {
            if (!node.querySelector) continue;
            const hasHeader = !!node.querySelector('[data-pagelet="MWChatTabHeader"]');
            const hasThread = !!node.querySelector('[data-pagelet="MAWSecureThreadDetailWrapper"]');
            if (hasHeader && hasThread) return node;
        }
        return fallback;
    } catch (e) {
        return null;
    }
};

const isFBEmbeddedChatMutationNodeV56 = (element) => {
    try {
        if (!element || element.nodeType !== 1) return false;
        if (isFBInsideEmbeddedChatSurfaceV56(element)) return true;
        const marker = element.matches?.(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56)
            ? element
            : element.querySelector?.(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56);
        if (!marker) return false;

        // Do not classify a huge page wrapper as "chat-only" just because one chat tab is open.
        const articles = element.querySelectorAll?.('[role="article"]') || [];
        for (let i = 0; i < articles.length && i < 80; i++) {
            if (!isFBInsideEmbeddedChatSurfaceV56(articles[i])) return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};

const containsNonEmbeddedChatFeedCandidateV56 = (root, selector) => {
    try {
        if (!root || root.nodeType !== 1) return false;
        if (root.matches?.(selector) && !isFBInsideEmbeddedChatSurfaceV56(root)) return true;
        const nodes = root.querySelectorAll?.(selector) || [];
        for (let i = 0; i < nodes.length && i < 120; i++) {
            if (!isFBInsideEmbeddedChatSurfaceV56(nodes[i])) return true;
        }
    } catch (e) {}
    return false;
};

const isFBStrictElementAccount = () => {
    try { return FB_STRICT_ELEMENT_ACCOUNT_IDS.has(getEarlyLoggedInFacebookAccountFbid()); }
    catch (e) { return false; }
};

const isSupportedFacebookPage = (inputUrl, pages) => {
    try {
        const url = new URL(inputUrl || window.location.href, window.location.origin);
        return pages.some(pageUrl => {
            try {
                const page = new URL(pageUrl, window.location.origin);
                if (url.host !== page.host) return false;
                const basePath = page.pathname.replace(/\/+$/, '');
                const currentPath = url.pathname.replace(/\/+$/, '');
                return currentPath === basePath || currentPath.startsWith(basePath + '/');
            } catch (e) { return false; }
        });
    } catch (e) { return false; }
};

const isCurrentSpecificProfileSurface = (inputUrl = window.location.href) => {
    try {
        const url = new URL(inputUrl, window.location.origin);
        for (const profileId of FB_SPECIFIC_PROFILE_IDS) {
            if ((url.pathname === '/profile.php' && url.searchParams.get('id') === profileId) ||
                url.pathname === `/${profileId}` || url.pathname === `/${profileId}/`) {
                return true;
            }
        }
    } catch (e) {}
    return false;
};

const isCurrentSpecificUrlSurface = (inputUrl = window.location.href) => {
    try { return isSupportedFacebookPage(inputUrl, FB_SPECIFIC_URL_SURFACES); }
    catch (e) { return false; }
};

const refreshFBElementHidingAccountScope = () => {
    try {
        __fbElementHidingAccountEnabled = isFBStrictElementAccount();
        if (document.documentElement) {
            const messengerNative = isFBMessengerPath(window.location.href);
            document.documentElement.classList.toggle('fb-messenger-native-v54', messengerNative);
            document.documentElement.classList.toggle('fb-strict-element-hiding-v37', __fbElementHidingAccountEnabled && !messengerNative);
            document.documentElement.classList.toggle('fb-isolated-identity-prehide-v56', __fbElementHidingAccountEnabled);
        }
        return __fbElementHidingAccountEnabled;
    } catch (e) {
        return false;
    }
};

const isFBCosmeticElementHidingAllowed = () => {
    try {
        // v54: full-page Messenger is native territory. Its tiny allow-list is handled by
        // runFBMessengerNativeMaintenance(), never by the broad cosmetic scrubbers.
        if (isFBMessengerPath(window.location.href)) return false;
        // Always keep the hard/supported page scrubbers alive, regardless of account.
        if (isCurrentSpecificUrlSurface(window.location.href) || isCurrentSpecificProfileSurface(window.location.href)) return true;
        if (refreshFBElementHidingAccountScope()) return true;
    } catch (e) {}
    return false;
};

refreshFBElementHidingAccountScope();

if (DEBUG) {
console.log('[FBCleaner] chrome.storage.local available inside facebook.js:',
    typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local
);

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['wrestling_women_urls'], (result) => {
        console.log('[FBCleaner] wrestling_women_urls from extension storage:', result);
    });
}
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
function addIdleCallback(fn, options) {
    // Track requestIdleCallback so we can cancel on cleanup (prevents leaks on SPA navigations)
    if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(() => {
            try { fn(); } finally { __fbTimers.idleCallbacks.delete(id); }
        }, options);
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
        try {
            const s11 = document.getElementById('fb-video-overlay-smooth-style-v42');
            if (s11) s11.remove();
        } catch {}
        try {
            const profileOverlay = document.getElementById('fb-profile-screening-overlay-v44');
            if (profileOverlay) profileOverlay.remove();
        } catch {}
        try {
            const embeddedChatIdentityStyle = document.getElementById('fb-embedded-chat-identity-style-v56');
            if (embeddedChatIdentityStyle) embeddedChatIdentityStyle.remove();
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

// v25.4.23: notification-opened post/photo/reel/video URLs are Facebook-native territory.
// They must never be redirected back home or scanned as ordinary post/media pages.
function isNotificationOpenedPostUrl(inputUrl = window.location.href) {
    try {
        const url = new URL(inputUrl, window.location.origin);
        const hasNotifSignal =
            url.searchParams.has('notif_id') ||
            url.searchParams.has('notif_t') ||
            url.searchParams.get('ref') === 'notif' ||
            /(?:^|[?&])notif_/i.test(String(inputUrl || ''));
        if (!hasNotifSignal) return false;

        const path = (url.pathname || '').toLowerCase();
        if (/\/(notifications|ilmoitukset)(?:\/|$)/i.test(path)) return true;

        return (
            /\/(photo|photos|posts|permalink|videos|video|watch|reel|share|story\.php)(?:\/|$|\?)/i.test(path) ||
            url.searchParams.has('fbid') ||
            url.searchParams.has('story_fbid') ||
            url.searchParams.has('v')
        );
    } catch (e) {
        const raw = String(inputUrl || '').toLowerCase();
        return raw.includes('notif_id=') || raw.includes('notif_t=') || raw.includes('ref=notif');
    }
}

// ===== v25.4.25: notification panel hard immunity =====
// Notification dropdowns/pages are Facebook-native territory. They should never be scanned,
// hidden, approved/denied, or redirected by post/profile/link scrubbers.
const fbNotifNorm = (value = '') => {
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

const clearFBHideStyles = (element) => {
    try {
        if (!element || !element.style) return;
        [
            'display', 'visibility', 'opacity', 'pointer-events', 'position',
            'left', 'right', 'top', 'bottom', 'inset', 'height', 'width',
            'min-height', 'min-width', 'max-height', 'max-width',
            'overflow', 'content-visibility', 'margin', 'padding', 'border'
        ].forEach(prop => {
            try { element.style.removeProperty(prop); } catch (e) {}
        });
    } catch (e) {}
};

// v34 layout-safe unhide for native FB territory.
// Do NOT strip position/display/width/margins from notification/comment containers unless
// FBCleaner itself previously hard-collapsed that exact node. Facebook uses inline/layout
// rules all over these surfaces; removing them turns the UI into cursed plain text soup.
const hasFBCleanerHardHideClass = (element) => {
    try {
        if (!element || !element.classList) return false;
        return element.classList.contains('fb-element-banned') ||
               element.classList.contains('fb-post-banned') ||
               element.classList.contains('fb-search-banned') ||
               element.classList.contains('fb-profile-card-banned') ||
               element.classList.contains('fb-group-suggestions-banned') ||
               element.classList.contains('fb-specific-url-nonfeed-hidden-v26');
    } catch (e) {
        return false;
    }
};

const clearFBCleanerHideStylesOnly = (element) => {
    try {
        if (!element || !element.style) return;
        if (!hasFBCleanerHardHideClass(element)) return;
        [
            'display', 'visibility', 'opacity', 'pointer-events', 'position',
            'left', 'right', 'top', 'bottom', 'inset', 'height', 'width',
            'min-height', 'min-width', 'max-height', 'max-width',
            'overflow', 'content-visibility', 'margin', 'padding', 'border'
        ].forEach(prop => {
            try { element.style.removeProperty(prop); } catch (e) {}
        });
    } catch (e) {}
};

const notificationTextLooksLikePanel = (text) => {
    const t = fbNotifNorm(text);
    if (!t) return false;
    const hasHeader = t.includes('ilmoitukset') || t.includes('notifications');
    if (!hasHeader) return false;
    return t.includes('kaikki') || t.includes('lukematon') || t.includes('aiemmat') ||
           t.includes('näytä kaikki') || t.includes('unread') || t.includes('earlier') ||
           t.includes('see all') || t.includes('all');
};

const isNotificationPanelElement = (element) => {
    try {
        if (!element || !element.closest) return false;

        // Full notifications page.
        if (/\/(notifications|ilmoitukset)(?:\/|$)/i.test(location.pathname || '')) {
            if (element.closest('[role="main"], main, [data-pagelet*="Notification" i]')) return true;
        }

        // Direct aria/data signals.
        if (element.closest('[data-pagelet*="Notification" i], [aria-label*="Ilmoitukset" i], [aria-label*="Notifications" i]')) return true;

        // Top-right popup/dialog: detect by local text only, not by current URL.
        let node = element;
        for (let depth = 0; node && node !== document.body && node !== document.documentElement && depth < 10; depth++, node = node.parentElement) {
            if (!node || node.nodeType !== 1) continue;
            const aria = node.getAttribute ? (node.getAttribute('aria-label') || '') : '';
            const role = node.getAttribute ? (node.getAttribute('role') || '') : '';
            const localText = (aria + ' ' + (node.innerText || node.textContent || '')).slice(0, 2500);
            const plausibleContainer = /^(dialog|menu|list|region|complementary)$/i.test(role) ||
                (node.matches && node.matches('[role="dialog"], [role="menu"], [role="list"], [role="region"], div'));
            if (plausibleContainer && notificationTextLooksLikePanel(localText)) return true;
        }
    } catch (e) {}
    return false;
};

const protectNotificationSurfaces = (root = document) => {
    try {
        const scanRoot = (root && root.querySelectorAll) ? root : document;
        const panels = [];
        const fullNotificationsPage = /\/(notifications|ilmoitukset)(?:\/|$)/i.test(location.pathname || '');
        const add = (panel) => {
            if (!panel || panels.includes(panel)) return;
            panels.push(panel);
        };

        if (fullNotificationsPage) {
            add(document.querySelector('[role="main"], main') || document.body);
        }

        if (scanRoot.nodeType === 1 && isNotificationPanelElement(scanRoot)) {
            add(scanRoot.closest?.('[data-pagelet*="Notification" i], [aria-label*="Ilmoitukset" i], [aria-label*="Notifications" i], [role="dialog"], [role="menu"], [role="region"], [role="list"]') || scanRoot);
        }

        // The full notifications route already has one authoritative root. Avoid walking the
        // entire page again looking for nested dialog/list/region candidates inside that root.
        if (!fullNotificationsPage || scanRoot.nodeType === 1) {
            const selector = '[data-pagelet*="Notification" i], [aria-label*="Ilmoitukset" i], [aria-label*="Notifications" i], [role="dialog"], [role="menu"], [role="region"], [role="list"]';
            const candidates = scanRoot.querySelectorAll ? scanRoot.querySelectorAll(selector) : [];
            for (let i = 0; i < candidates.length && panels.length < 8; i++) {
                const candidate = candidates[i];
                if (isNotificationPanelElement(candidate)) add(candidate);
            }
        }

        panels.slice(0, 8).forEach(panel => {
            try {
                const panelWasIdentityHidden = panel.getAttribute?.('data-fb-isolated-identity-hide-v56') === '1';
                const panelWasHardHidden = hasFBCleanerHardHideClass(panel) || panelWasIdentityHidden;
                if (panelWasHardHidden) clearFBCleanerHideStylesOnly(panel);
                panel.removeAttribute?.('data-fb-isolated-identity-hide-v56');
                panel.classList.add('fb-notifications-protected', 'fb-post-approved');
                panel.classList.remove('fb-element-banned', 'fb-post-banned', 'fb-search-banned', 'fb-profile-card-banned');

                // Root-level protection is enough for CSS inheritance. Only repair descendants
                // that this script actually marked; never stamp every node in Facebook's panel.
                const touched = panel.querySelectorAll?.([
                    '.fb-element-banned', '.fb-post-banned', '.fb-search-banned', '.fb-profile-card-banned',
                    '.fb-post-pending', '.fb-post-scanning', '.fb-post-expanding',
                    '.fb-specific-url-nonfeed-hidden-v26', '[data-fb-isolated-identity-hide-v56="1"]'
                ].join(',')) || [];
                for (let i = 0; i < touched.length && i < 120; i++) {
                    const el = touched[i];
                    try {
                        const hadHardHide = hasFBCleanerHardHideClass(el);
                        if (hadHardHide) clearFBCleanerHideStylesOnly(el);
                        el.removeAttribute?.('data-fb-isolated-identity-hide-v56');
                        el.classList.add('fb-post-approved');
                        el.classList.remove(
                            'fb-element-banned', 'fb-post-banned', 'fb-search-banned', 'fb-profile-card-banned',
                            'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding',
                            'fb-specific-url-nonfeed-hidden-v26'
                        );
                    } catch (e) {}
                }
            } catch (e) {}
        });
    } catch (e) {}
};

// ===== v33: Comments / notification-opened post hard immunity =====
// Facebook uses role="article" for comments too. The feed no-glimpse gate must never
// collapse comments or notification-opened posts, but nav/top/side-button cleanup can still run.
const fbSafeUrl = (inputUrl = window.location.href) => {
    try { return new URL(inputUrl, window.location.origin); }
    catch (e) { return null; }
};

const isFBNotificationsPath = (inputUrl = window.location.href) => {
    try {
        const url = fbSafeUrl(inputUrl);
        if (!url) return false;
        return /\/(notifications|ilmoitukset)(?:\/|$)/i.test(url.pathname || '');
    } catch (e) {
        return /\/(notifications|ilmoitukset)(?:\/|$)/i.test(String(inputUrl || ''));
    }
};

const isFBCommentUrl = (inputUrl = window.location.href) => {
    try {
        const raw = String(inputUrl || '').toLowerCase();
        const url = fbSafeUrl(inputUrl);
        if (!url) return raw.includes('comment_id') || raw.includes('reply_comment_id') || raw.includes('focused_comment_id') || raw.includes('comment_tracking') || raw.includes('/comments');
        const combined = (url.pathname + ' ' + url.search + ' ' + url.hash + ' ' + raw).toLowerCase();
        return url.searchParams.has('comment_id') ||
               url.searchParams.has('reply_comment_id') ||
               url.searchParams.has('focused_comment_id') ||
               url.searchParams.has('comment_tracking') ||
               /(?:^|[?&#])comment_id=/i.test(raw) ||
               /(?:^|[?&#])reply_comment_id=/i.test(raw) ||
               /(?:^|[?&#])focused_comment_id=/i.test(raw) ||
               combined.includes('comment_tracking') ||
               /\/(comments|comment)(?:\/|$)/i.test(url.pathname || '');
    } catch (e) {
        const raw = String(inputUrl || '').toLowerCase();
        return raw.includes('comment_id') || raw.includes('reply_comment_id') || raw.includes('focused_comment_id') || raw.includes('comment_tracking') || raw.includes('/comments');
    }
};

const isFBNoPostScanUrl = (inputUrl = window.location.href) => {
    try {
        return isNotificationOpenedPostUrl(inputUrl) || isFBNotificationsPath(inputUrl) || isFBMessengerPath(inputUrl);
    } catch (e) {
        return false;
    }
};

const updateFBCommentImmunityClasses = () => {
    try {
        if (!document.documentElement) return;
        const commentUrl = isFBCommentUrl(window.location.href);
        const noPostScan = isFBNoPostScanUrl(window.location.href);
        document.documentElement.classList.toggle('fb-comment-url-immunity-v33', commentUrl);
        document.documentElement.classList.toggle('fb-native-post-noscan-v33', noPostScan);
    } catch (e) {}
};

// v35: active comment overlay detector and low-cost handoff.
// Opening comments from the feed often keeps the URL as /, so URL checks alone miss it.
// When this is true, active post/comment crawlers pause; nav/side cleanup remains alive.
const isFBActiveCommentOverlay = (root = document) => {
    try {
        const scanRoot = (root && root.querySelectorAll) ? root : document;
        const dialogs = [];
        if (scanRoot.nodeType === 1 && scanRoot.matches?.('[role="dialog"]')) dialogs.push(scanRoot);
        scanRoot.querySelectorAll?.('[role="dialog"]').forEach(dialog => dialogs.push(dialog));

        for (let i = 0; i < dialogs.length; i++) {
            const dialog = dialogs[i];
            if (!dialog || isNotificationPanelElement(dialog)) continue;
            const aria = dialog.getAttribute?.('aria-label') || '';
            const text = String(dialog.textContent || '').slice(0, 1800);
            if (commentTextLooksLikeCommentUI(aria + ' ' + text)) return true;
            if (dialog.querySelector?.('[aria-label*="comment" i], [aria-label*="komment" i], [aria-label*="reply" i], [aria-label*="vastaa" i], [contenteditable="true"]')) return true;
        }
    } catch (e) {}
    return false;
};

const isInsideFBActiveCommentOverlay = (element) => {
    try {
        const dialog = element && element.closest ? element.closest('[role="dialog"]') : null;
        return !!(dialog && isFBActiveCommentOverlay(dialog));
    } catch (e) { return false; }
};

const updateFBCommentOverlayClass = () => {
    try {
        if (!document.documentElement) return false;
        const active = isFBActiveCommentOverlay(document);
        document.documentElement.classList.toggle('fb-comment-overlay-active-v35', active);
        return active;
    } catch (e) { return false; }
};

const clearFBHideAndScanClasses = (element) => {
    try {
        if (!element || !element.classList) return;
        const hadFBCleanerHardHide = hasFBCleanerHardHideClass(element);
        if (hadFBCleanerHardHide) clearFBCleanerHideStylesOnly(element);
        element.classList.add('fb-comments-protected', 'fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed');
        element.classList.remove(
            'fb-element-banned', 'fb-post-banned', 'fb-search-banned', 'fb-profile-card-banned',
            'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-group-suggestions-banned',
            'fb-specific-url-nonfeed-hidden-v26'
        );
        if (element.removeAttribute) {
            element.removeAttribute('data-fb-v25-scan-complete');
            element.removeAttribute('data-fb-v31-cache-decision');
        }
    } catch (e) {}
};

const commentTextLooksLikeCommentUI = (text = '') => {
    try {
        const t = fbNotifNorm(text);
        if (!t) return false;
        return /\b(comment|comments|reply|replies|write a comment|view more comments|most relevant|newest|all comments)\b/i.test(t) ||
               /\b(kommentti|kommentit|kommentoi|vastaa|vastaukset|kirjoita kommentti|näytä lisää kommentteja|osuvimmat|uusimmat|kaikki kommentit)\b/i.test(t);
    } catch (e) {
        return false;
    }
};

const isFBCommentSurfaceElement = (element) => {
    try {
        if (!element || !element.closest) return false;
        // v36: On real /search/ pages, [role="article"] means a search result/post result.
        // Do not let comment immunity protect these from search filtering.
        if (/\/search(?:\/|$)/i.test(location.pathname || '') && element.closest('[role="main"]')) return false;
        if (element.classList && element.classList.contains('fb-comments-protected')) return true;
        // Notifications have their own native-protection layer. Do not also mark them as
        // comment surfaces, or we risk forcing hidden notification internals visible.
        if (isNotificationPanelElement(element)) return false;

        // Direct comment/reply UI signals.
        if (element.closest('[data-testid*="comment" i], [aria-label*="comment" i], [aria-label*="komment" i], [title*="comment" i], [title*="komment" i]')) return true;
        if (element.closest('[aria-label*="reply" i], [aria-label*="vastaa" i], [title*="reply" i], [title*="vastaa" i]')) return true;

        // Facebook comment rows are commonly role=article nested under the post article.
        const article = element.closest('[role="article"]');
        if (article && article.parentElement && article.parentElement.closest('[role="article"]')) return true;

        // Comment dialogs / media sidebars: detect locally so background feed can keep filtering.
        const dialog = element.closest('[role="dialog"], [data-pagelet="MediaViewer_Sidebar"], [data-pagelet="TahoeRightRail"]');
        if (dialog) {
            const localText = ((dialog.getAttribute && dialog.getAttribute('aria-label')) || '') + ' ' + String(dialog.textContent || '').slice(0, 2600);
            if (commentTextLooksLikeCommentUI(localText)) return true;
            if (element.closest('ul[role="list"], [role="list"], [role="listitem"]')) return true;
        }

        // Full comment/permalink URLs: the opened post/comment surface is native territory.
        if (isFBCommentUrl(window.location.href)) {
            if (element.closest('[role="dialog"], [data-pagelet="MediaViewer_Sidebar"], [data-pagelet="TahoeRightRail"], [data-pagelet="MediaViewerPhoto"]')) return true;
            if (element.closest('[role="main"]') && !element.closest('[role="feed"]')) return true;
        }

        // Notification-opened posts/pages are also native territory.
        if (isFBNoPostScanUrl(window.location.href)) {
            if (element.closest('[role="main"], [role="dialog"], [data-pagelet="MediaViewer_Sidebar"], [data-pagelet="TahoeRightRail"], [data-pagelet="MediaViewerPhoto"]')) return true;
        }
    } catch (e) {}
    return false;
};

const protectFBCommentSurfaces = (root = document) => {
    try {
        if (/\/search(?:\/|$)/i.test(location.pathname || '')) return;
        updateFBCommentImmunityClasses();

        const nativeUrl = isFBNoPostScanUrl(window.location.href) || isFBCommentUrl(window.location.href);
        const activeOverlay = !!(
            document.documentElement?.classList.contains('fb-comment-overlay-active-v35') ||
            isFBActiveCommentOverlay(root)
        );

        // Feed comments are already excluded by isInsideComment/isFBCommentSurfaceElement.
        // Avoid re-querying every nested article on ordinary pages.
        if (root === document && !nativeUrl && !activeOverlay) return;

        const scanRoot = (root && root.querySelectorAll) ? root : document;
        if (isFBNotificationsPath(window.location.href)) return;
        if (scanRoot.nodeType === 1 && isNotificationPanelElement(scanRoot)) return;

        const scopes = [];
        const addScope = (el) => {
            if (!el || scopes.includes(el) || isNotificationPanelElement(el)) return;
            scopes.push(el);
        };

        if (scanRoot.nodeType === 1 && isFBCommentSurfaceElement(scanRoot)) {
            addScope(scanRoot.closest?.('[role="dialog"], [data-pagelet="MediaViewer_Sidebar"], [data-pagelet="TahoeRightRail"], [role="main"]') || scanRoot);
        }

        if (activeOverlay) {
            const dialogs = scanRoot.querySelectorAll ? scanRoot.querySelectorAll('[role="dialog"]') : [];
            for (let i = 0; i < dialogs.length && scopes.length < 6; i++) {
                if (isFBActiveCommentOverlay(dialogs[i])) addScope(dialogs[i]);
            }
        }

        if (nativeUrl) {
            const nativeScopes = scanRoot.querySelectorAll ? scanRoot.querySelectorAll([
                '[role="main"]', '[role="dialog"]',
                '[data-pagelet="MediaViewer_Sidebar"]', '[data-pagelet="TahoeRightRail"]',
                '[data-pagelet="MediaViewerPhoto"]'
            ].join(',')) : [];
            for (let i = 0; i < nativeScopes.length && scopes.length < 8; i++) addScope(nativeScopes[i]);
        }

        const selectors = [
            '[data-testid*="comment" i]', '[aria-label*="comment" i]', '[aria-label*="komment" i]',
            '[title*="comment" i]', '[title*="komment" i]', '[aria-label*="reply" i]',
            '[aria-label*="vastaa" i]', '[role="article"] [role="article"]'
        ].join(',');

        scopes.slice(0, 8).forEach(scope => {
            try {
                if (isFBCommentSurfaceElement(scope)) clearFBHideAndScanClasses(scope);
                const candidates = scope.querySelectorAll?.(selectors) || [];
                let repaired = 0;
                for (let i = 0; i < candidates.length && repaired < 60; i++) {
                    const candidate = candidates[i];
                    if (!isFBCommentSurfaceElement(candidate)) continue;
                    const row = candidate.closest?.('[role="article"]') || candidate;
                    clearFBHideAndScanClasses(row);
                    repaired++;
                }

                const touched = scope.querySelectorAll?.('.fb-element-banned, .fb-post-banned, .fb-post-pending, .fb-post-scanning, .fb-post-expanding, .fb-specific-url-nonfeed-hidden-v26') || [];
                for (let i = 0; i < touched.length && i < 80; i++) clearFBHideAndScanClasses(touched[i]);
            } catch (e) {}
        });
    } catch (e) {}
};

updateFBCommentImmunityClasses();

const triggerRedirect = (reason = '') => {
    try {
        if (isNotificationOpenedPostUrl(window.location.href)) {
            devLog('Skipping redirect on notification-opened post/photo/reel/video page' + (reason ? ': ' + reason : ''));
            return;
        }
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

// ============================================================
// [PROFILE-POLICY] v50: one authoritative profile trust/isolation layer
// ============================================================
// The same facebook.js runs on both PCs. Own/Dad profiles are built-in trusted
// timelines. The two named friends lists teach a persistent union of profile keys.
// Haukkis-only isolated identities override that trust, including learned vanity aliases.
const FB_PROFILE_POLICY = {
    storageKey: 'bravefox_fb_trusted_profile_keys_v50',
    isolatedAliasStorageKey: 'bravefox_fb_isolated_alias_keys_v50',
    syncMetaKey: 'bravefox_fb_profile_policy_sync_meta_v50',
    syncTrustedPrefix: 'bravefox_fb_trusted_chunk_v50_',
    syncAliasPrefix: 'bravefox_fb_isolated_alias_chunk_v50_',
    cacheVersion: 1,
    maxKeys: 3000,
    syncChunkSize: 120,
    savePending: false,
    sanitizePending: false,
    loaded: false
};

const FB_BUILTIN_TRUSTED_PROFILE_KEYS = new Set([
    'id:100005050653554', 'user:haukkis',
    'id:1267550854', 'user:tapio.haukirauma'
]);
const FB_FRIEND_LIST_OWNER_KEYS = new Set(FB_BUILTIN_TRUSTED_PROFILE_KEYS);
const __fbTrustedProfileKeys = new Set(FB_BUILTIN_TRUSTED_PROFILE_KEYS);
const __fbIsolatedProfileKeys = new Set();
const __fbIsolatedAliasKeys = new Set();

const normalizeFBProfileKey = (value = '') => {
    try {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return '';
        if (/^(?:id|user):/.test(raw)) return raw;
        if (/^\d{5,}$/.test(raw)) return 'id:' + raw;
        return 'user:' + raw.replace(/^\/+|\/+$/g, '');
    } catch (e) { return ''; }
};

const FB_RESERVED_PROFILE_SEGMENTS = new Set([
    '', 'home.php', 'profile.php', 'friends', 'friends_all', 'friends_mutual',
    'friends_with_upcoming_birthdays', 'groups', 'pages', 'marketplace',
    'messages', 'messenger', 'notifications', 'ilmoitukset', 'search', 'photo',
    'photos', 'videos', 'video', 'watch', 'reel', 'reels', 'stories', 'events',
    'gaming', 'settings', 'help', 'share', 'people', 'permalink.php', 'story.php'
]);

const getFBProfileKeysFromUrl = (inputUrl = window.location.href) => {
    const keys = new Set();
    try {
        const url = new URL(inputUrl, window.location.origin);
        const queryId = url.searchParams.get('id');
        if (queryId && /^\d{5,}$/.test(queryId)) keys.add('id:' + queryId);

        const parts = (url.pathname || '/').split('/').filter(Boolean).map(part => {
            try { return decodeURIComponent(part); } catch (e) { return part; }
        });
        const first = String(parts[0] || '').toLowerCase();
        if (first && !first.endsWith('.php') && !FB_RESERVED_PROFILE_SEGMENTS.has(first)) {
            if (/^\d{5,}$/.test(first)) keys.add('id:' + first);
            else keys.add('user:' + first);
        }
        if (first === 'people' && parts.length >= 3) {
            const last = String(parts[parts.length - 1] || '');
            if (/^\d{5,}$/.test(last)) keys.add('id:' + last);
        }
    } catch (e) {}
    return keys;
};

// v57: explicit high-risk/specific surfaces must never be promoted into the
// learned trusted-profile pool. This is intentionally key-based as well as route-based so
// /posts and /timeline subroutes cannot inherit a stale trusted alias from storage.
const FB_NEVER_TRUSTED_PROFILE_KEYS = (() => {
    const keys = new Set();
    try {
        FB_SPECIFIC_URL_SURFACES.forEach(surfaceUrl => {
            getFBProfileKeysFromUrl(surfaceUrl).forEach(key => keys.add(normalizeFBProfileKey(key)));
        });
        FB_SPECIFIC_PROFILE_IDS.forEach(profileId => {
            const raw = String(profileId || '').trim();
            if (!raw) return;
            const key = normalizeFBProfileKey(/^\d{5,}$/.test(raw) ? ('id:' + raw) : ('user:' + raw));
            if (key) keys.add(key);
        });
    } catch (e) {}
    return keys;
})();

const isFBNeverTrustedProfileKey = (key) => {
    try { return FB_NEVER_TRUSTED_PROFILE_KEYS.has(normalizeFBProfileKey(key)); }
    catch (e) { return false; }
};

const getFBProfileKeysFromElement = (element) => {
    const keys = new Set();
    const addKey = (key) => { const normalized = normalizeFBProfileKey(key); if (normalized) keys.add(normalized); };
    const addUrl = (value) => getFBProfileKeysFromUrl(value).forEach(addKey);
    const inspect = (node) => {
        try {
            if (!node) return;
            addUrl(node.href || node.getAttribute?.('href') || '');
            const attrs = ['data-fbid', 'data-profileid', 'data-profile-id', 'data-userid', 'data-ownerid', 'data-pageid', 'data-page-id'];
            attrs.forEach(attr => {
                const value = node.getAttribute?.(attr) || '';
                if (/^\d{5,}$/.test(value)) addKey('id:' + value);
            });
            const packed = [node.getAttribute?.('data-hovercard'), node.getAttribute?.('data-store'), node.getAttribute?.('data-ft')].filter(Boolean).join(' ');
            const idPattern = /(?:profile_?id|user_?id|actor_?id|owner_?id|fbid|id)[^0-9]{0,12}(\d{5,})/gi;
            let match;
            let count = 0;
            while ((match = idPattern.exec(packed)) && count++ < 8) addKey('id:' + match[1]);
        } catch (e) {}
    };
    inspect(element);
    try {
        const nodes = element?.querySelectorAll?.('a[href], [data-fbid], [data-profileid], [data-profile-id], [data-userid], [data-ownerid], [data-pageid], [data-page-id], [data-hovercard], [data-store], [data-ft]') || [];
        for (let i = 0; i < nodes.length && i < 80; i++) inspect(nodes[i]);
    } catch (e) {}
    return keys;
};

const isFBFriendsSurfacePath = (inputUrl = window.location.href) => {
    try {
        const url = new URL(inputUrl, window.location.origin);
        const value = `${url.pathname || ''}${url.search || ''}${url.hash || ''}`;
        return /\/(?:friends|friends_all|friends_mutual|friends_with_upcoming_birthdays)(?:[/?#]|$)/i.test(value) ||
               (url.pathname === '/profile.php' && /^(?:friends|friends_all|friends_mutual|friends_with_upcoming_birthdays)$/i.test(url.searchParams.get('sk') || ''));
    } catch (e) { return false; }
};

const getFBFriendsListOwnerKeys = (inputUrl = window.location.href) => {
    try {
        if (!isFBFriendsSurfacePath(inputUrl)) return new Set();
        return getFBProfileKeysFromUrl(inputUrl);
    } catch (e) { return new Set(); }
};

const isSupportedFriendListOwner = (inputUrl = window.location.href) => {
    try {
        const keys = getFBFriendsListOwnerKeys(inputUrl);
        for (const key of keys) if (FB_FRIEND_LIST_OWNER_KEYS.has(key)) return true;
    } catch (e) {}
    return false;
};

const initializeFBIsolatedProfileIds = (ids = []) => {
    try {
        ids.forEach(id => {
            const key = normalizeFBProfileKey('id:' + String(id || '').trim());
            if (key) __fbIsolatedProfileKeys.add(key);
        });
    } catch (e) {}
};

const getFBStorageArea = (name) => {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage[name]) return chrome.storage[name];
    } catch (e) {}
    return null;
};

const mergeFBProfilePolicyPayload = (payload) => {
    try {
        const trusted = Array.isArray(payload?.[FB_PROFILE_POLICY.storageKey]) ? payload[FB_PROFILE_POLICY.storageKey] : [];
        const aliases = Array.isArray(payload?.[FB_PROFILE_POLICY.isolatedAliasStorageKey]) ? payload[FB_PROFILE_POLICY.isolatedAliasStorageKey] : [];
        trusted.slice(0, FB_PROFILE_POLICY.maxKeys).forEach(key => {
            const normalized = normalizeFBProfileKey(key);
            if (!normalized) return;
            if (isFBNeverTrustedProfileKey(normalized)) {
                // v57: ignore stale learned trust for explicitly protected/high-risk surfaces
                // and rewrite storage once loading has completed.
                FB_PROFILE_POLICY.sanitizePending = true;
                return;
            }
            __fbTrustedProfileKeys.add(normalized);
        });
        aliases.slice(0, FB_PROFILE_POLICY.maxKeys).forEach(key => {
            const normalized = normalizeFBProfileKey(key);
            if (normalized) __fbIsolatedAliasKeys.add(normalized);
        });
    } catch (e) {}
};

const chunkFBProfilePolicyKeys = (values = []) => {
    const chunks = [];
    const size = FB_PROFILE_POLICY.syncChunkSize;
    for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
    return chunks;
};

const loadFBProfilePolicyCache = () => {
    let pending = 0;
    const done = () => {
        pending--;
        if (pending > 0) return;
        FB_PROFILE_POLICY.loaded = true;
        try {
            if (FB_PROFILE_POLICY.sanitizePending) {
                FB_PROFILE_POLICY.sanitizePending = false;
                saveFBProfilePolicyCache();
            }
        } catch (e) {}
        try { updateFBHomeFeedGateClass(); } catch (e) {}
        try { scheduleRunAllFilters(); } catch (e) {}
    };

    const local = getFBStorageArea('local');
    if (local?.get) {
        pending++;
        try {
            local.get([FB_PROFILE_POLICY.storageKey, FB_PROFILE_POLICY.isolatedAliasStorageKey], payload => {
                try { mergeFBProfilePolicyPayload(payload || {}); } finally { done(); }
            });
        } catch (e) { done(); }
    }

    const sync = getFBStorageArea('sync');
    if (sync?.get) {
        pending++;
        const baseKeys = [FB_PROFILE_POLICY.storageKey, FB_PROFILE_POLICY.isolatedAliasStorageKey, FB_PROFILE_POLICY.syncMetaKey];
        try {
            sync.get(baseKeys, payload => {
                try { mergeFBProfilePolicyPayload(payload || {}); } catch (e) {}
                const meta = payload?.[FB_PROFILE_POLICY.syncMetaKey];
                const trustedCount = Math.max(0, Number(meta?.trustedChunks) || 0);
                const aliasCount = Math.max(0, Number(meta?.aliasChunks) || 0);
                const chunkKeys = [];
                for (let i = 0; i < trustedCount; i++) chunkKeys.push(FB_PROFILE_POLICY.syncTrustedPrefix + i);
                for (let i = 0; i < aliasCount; i++) chunkKeys.push(FB_PROFILE_POLICY.syncAliasPrefix + i);
                if (!chunkKeys.length) {
                    done();
                    return;
                }
                try {
                    sync.get(chunkKeys, chunkPayload => {
                        try {
                            const merged = {
                                [FB_PROFILE_POLICY.storageKey]: [],
                                [FB_PROFILE_POLICY.isolatedAliasStorageKey]: []
                            };
                            for (let i = 0; i < trustedCount; i++) {
                                const chunk = chunkPayload?.[FB_PROFILE_POLICY.syncTrustedPrefix + i];
                                if (Array.isArray(chunk)) merged[FB_PROFILE_POLICY.storageKey].push(...chunk);
                            }
                            for (let i = 0; i < aliasCount; i++) {
                                const chunk = chunkPayload?.[FB_PROFILE_POLICY.syncAliasPrefix + i];
                                if (Array.isArray(chunk)) merged[FB_PROFILE_POLICY.isolatedAliasStorageKey].push(...chunk);
                            }
                            mergeFBProfilePolicyPayload(merged);
                        } finally { done(); }
                    });
                } catch (e) { done(); }
            });
        } catch (e) { done(); }
    }

    if (!pending) FB_PROFILE_POLICY.loaded = true;
};

const saveFBProfilePolicyCache = () => {
    try {
        if (FB_PROFILE_POLICY.savePending) return;
        FB_PROFILE_POLICY.savePending = true;
        addTimeout(() => {
            FB_PROFILE_POLICY.savePending = false;
            const trusted = Array.from(__fbTrustedProfileKeys)
                .filter(key => !isFBNeverTrustedProfileKey(key))
                .slice(0, FB_PROFILE_POLICY.maxKeys);
            const aliases = Array.from(__fbIsolatedAliasKeys).slice(0, FB_PROFILE_POLICY.maxKeys);
            const localPayload = {
                [FB_PROFILE_POLICY.storageKey]: trusted,
                [FB_PROFILE_POLICY.isolatedAliasStorageKey]: aliases
            };

            const local = getFBStorageArea('local');
            try { local?.set?.(localPayload, () => { try { void chrome.runtime?.lastError; } catch (e) {} }); } catch (e) {}

            const sync = getFBStorageArea('sync');
            if (!sync?.set || !sync?.get) return;
            const trustedChunks = chunkFBProfilePolicyKeys(trusted);
            const aliasChunks = chunkFBProfilePolicyKeys(aliases);
            try {
                sync.get(FB_PROFILE_POLICY.syncMetaKey, previousPayload => {
                    const previous = previousPayload?.[FB_PROFILE_POLICY.syncMetaKey] || {};
                    const data = {
                        [FB_PROFILE_POLICY.syncMetaKey]: {
                            version: FB_PROFILE_POLICY.cacheVersion,
                            trustedChunks: trustedChunks.length,
                            aliasChunks: aliasChunks.length
                        }
                    };
                    trustedChunks.forEach((chunk, index) => { data[FB_PROFILE_POLICY.syncTrustedPrefix + index] = chunk; });
                    aliasChunks.forEach((chunk, index) => { data[FB_PROFILE_POLICY.syncAliasPrefix + index] = chunk; });
                    sync.set(data, () => {
                        try { if (chrome.runtime?.lastError) return; } catch (e) {}
                        const stale = [FB_PROFILE_POLICY.storageKey, FB_PROFILE_POLICY.isolatedAliasStorageKey];
                        const oldTrusted = Math.max(0, Number(previous.trustedChunks) || 0);
                        const oldAliases = Math.max(0, Number(previous.aliasChunks) || 0);
                        for (let i = trustedChunks.length; i < oldTrusted; i++) stale.push(FB_PROFILE_POLICY.syncTrustedPrefix + i);
                        for (let i = aliasChunks.length; i < oldAliases; i++) stale.push(FB_PROFILE_POLICY.syncAliasPrefix + i);
                        try { sync.remove?.(stale, () => { try { void chrome.runtime?.lastError; } catch (e) {} }); } catch (e) {}
                    });
                });
            } catch (e) {}
        }, 350);
    } catch (e) {}
};

const isFBProfileKeyIsolatedForCurrentAccount = (key) => {
    try {
        const accountId = getCachedLoggedInFacebookAccountFbid(160000);
        if (accountId !== '100005050653554') return false;
        const normalized = normalizeFBProfileKey(key);
        return __fbIsolatedProfileKeys.has(normalized) || __fbIsolatedAliasKeys.has(normalized);
    } catch (e) { return false; }
};

const isFBProfileUrlIsolatedForCurrentAccount = (inputUrl = window.location.href) => {
    try {
        for (const key of getFBProfileKeysFromUrl(inputUrl)) {
            if (isFBProfileKeyIsolatedForCurrentAccount(key)) return true;
        }
    } catch (e) {}
    return false;
};

const isFBTrustedProfileRoute = (inputUrl = window.location.href) => {
    try {
        // v57: explicit protected/high-risk surfaces always beat learned or built-in trust.
        // This prevents pages such as /four3four from bypassing the post/link scanner.
        if (isCurrentSpecificUrlSurface(inputUrl) || isCurrentSpecificProfileSurface(inputUrl)) return false;

        const keys = getFBProfileKeysFromUrl(inputUrl);
        if (!keys.size) return false;
        for (const key of keys) if (isFBNeverTrustedProfileKey(key)) return false;
        for (const key of keys) if (FB_BUILTIN_TRUSTED_PROFILE_KEYS.has(key)) return true;

        // Unknown logged-in account at document-start: fail closed for learned profiles.
        const accountId = getCachedLoggedInFacebookAccountFbid(160000);
        if (!accountId) return false;
        for (const key of keys) {
            if (isFBProfileKeyIsolatedForCurrentAccount(key)) return false;
        }
        for (const key of keys) if (__fbTrustedProfileKeys.has(key)) return true;
    } catch (e) {}
    return false;
};

const isFBTrustedProfileTimelineSurface = (inputUrl = window.location.href) => {
    try {
        if (!isFBTrustedProfileRoute(inputUrl) || isFBProfileUrlIsolatedForCurrentAccount(inputUrl)) return false;
        const url = new URL(inputUrl, window.location.origin);
        if (url.pathname === '/profile.php') {
            const sk = String(url.searchParams.get('sk') || '').toLowerCase();
            return !sk || sk === 'timeline' || sk === 'posts';
        }
        const parts = (url.pathname || '/').split('/').filter(Boolean);
        if (parts.length <= 1) return true;
        const sub = String(parts[1] || '').toLowerCase();
        return sub === 'posts' || sub === 'timeline';
    } catch (e) { return false; }
};

const releaseFBTrustedTimelinePosts = (root = document) => {
    try {
        if (!isFBTrustedProfileTimelineSurface()) return false;
        document.documentElement?.classList.add('fb-trusted-profile-timeline-v50');
        const scanRoot = root?.querySelectorAll ? root : document;
        const selector = [
            'div[data-pagelet^="FeedUnit_"]:not(.fb-trusted-profile-post-v50)',
            'div[data-pagelet^="TimelineFeedUnit_"]:not(.fb-trusted-profile-post-v50)',
            '[role="feed"] > [role="article"]:not(.fb-trusted-profile-post-v50)',
            '[role="feed"] .fb-post-screening-v47',
            '[role="feed"] .fb-post-banned',
            '[role="feed"] .fb-element-banned'
        ].join(',');
        const nodes = [];
        if (scanRoot.nodeType === 1 && scanRoot.matches?.(selector)) nodes.push(scanRoot);
        scanRoot.querySelectorAll?.(selector).forEach(node => { if (nodes.length < 160) nodes.push(node); });
        const seen = new WeakSet();
        nodes.forEach(seed => {
            try {
                const post = getFBFeedUnitWrapper(seed) || seed;
                if (!post || seen.has(post)) return;
                seen.add(post);
                const alreadyClean = post.classList?.contains('fb-trusted-profile-post-v50') &&
                    post.getAttribute?.('data-fb-v25-scan-complete') === 'trusted-profile-v50' &&
                    !post.matches?.('.fb-post-banned, .fb-element-banned, .fb-post-screening-v47, .fb-post-pending, .fb-post-scanning, .fb-post-expanding');
                if (alreadyClean) return;

                // Canonical posts under the trusted profile's feed cannot be notification or
                // comment panels. Avoid repeatedly reading ancestor/feed text to rediscover that.
                if (!post.closest?.('[role="feed"]') &&
                    (isNotificationPanelElement(post) || isFBCommentSurfaceElement(post))) return;
                const wasHardHidden = hasFBCleanerHardHideClass(post);
                if (wasHardHidden) clearFBCleanerHideStylesOnly(post);
                releaseFBFeedSlot(post);
                post.classList.remove(
                    'fb-post-banned', 'fb-element-banned', 'fb-group-suggestions-banned',
                    'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-post-screening-v47'
                );
                post.classList.add('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed', 'fb-trusted-profile-post-v50');
                post.setAttribute('data-fb-v25-scan-complete', 'trusted-profile-v50');
                post.removeAttribute('data-fb-v47-screen-start');
                post.removeAttribute('data-fb-v31-cache-type');
                post.removeAttribute('data-fb-v31-cache-decision');
                post.style?.removeProperty('--fb-v47-screen-height');
                post.querySelectorAll?.([
                    '[role="article"]:not(.fb-trusted-profile-post-v50)',
                    '[role="article"].fb-post-banned',
                    '[role="article"].fb-element-banned',
                    '[role="article"].fb-post-screening-v47'
                ].join(',')).forEach(article => {
                    try {
                        const hidden = hasFBCleanerHardHideClass(article);
                        if (hidden) clearFBCleanerHideStylesOnly(article);
                        article.classList.remove('fb-post-banned', 'fb-element-banned', 'fb-post-screening-v47', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding');
                        article.classList.add('fb-post-approved', 'fb-trusted-profile-post-v50');
                    } catch (e) {}
                });
                try { __fbElementDecisionCache.delete(post); } catch (e) {}
                try { __fbPostHydrationState.delete(post); } catch (e) {}
            } catch (e) {}
        });
        return true;
    } catch (e) { return false; }
};

const isLikelyFBPersonProfileUrl = (inputUrl = '') => {
    try {
        const url = new URL(inputUrl, window.location.origin);
        if (!/(^|\.)facebook\.com$/i.test(url.hostname || '')) return false;
        const keys = getFBProfileKeysFromUrl(url.href);
        if (!keys.size) return false;
        const first = String((url.pathname || '/').split('/').filter(Boolean)[0] || '').toLowerCase();
        return first === 'people' || first === 'profile.php' ||
               Array.from(keys).some(key => key.startsWith('id:') || key.startsWith('user:'));
    } catch (e) { return false; }
};

const findFBFriendCardForTrust = (link) => {
    try {
        if (!link?.closest || !isLikelyFBPersonProfileUrl(link.href || link.getAttribute?.('href') || '')) return null;
        const main = link.closest('[role="main"], main');
        if (!main) return null;
        const modern = link.closest('div.x78zum5.xdt5ytf.x12upk82');
        if (modern && modern !== main && !modern.querySelector('h1, [role="feed"], [role="navigation"]')) return modern;

        let node = link;
        let best = null;
        for (let depth = 0; node && node !== main && depth < 10; depth++, node = node.parentElement) {
            if (!node.matches?.('div, li, [role="listitem"], [role="row"]')) continue;
            if (node.querySelector?.('h1, [role="feed"], [role="navigation"], [data-pagelet="ProfileHeader"]')) break;
            const profileLinks = Array.from(node.querySelectorAll?.('a[href]') || [])
                .filter(anchor => isLikelyFBPersonProfileUrl(anchor.href || anchor.getAttribute?.('href') || ''));
            if (profileLinks.length >= 1 && profileLinks.length <= 4) best = node;
            if (profileLinks.length > 4) break;
        }
        return best;
    } catch (e) { return null; }
};

const learnFBTrustedProfilesFromFriendsSurface = (root = document) => {
    try {
        if (!isSupportedFriendListOwner()) return 0;
        const scanRoot = root?.querySelectorAll ? root : document;
        const main = scanRoot.nodeType === 1 && scanRoot.matches?.('[role="main"], main')
            ? scanRoot
            : scanRoot.querySelector?.('[role="main"], main') || document.querySelector('[role="main"], main');
        if (!main) return 0;

        const links = main.querySelectorAll?.('a[href]') || [];
        const cards = new Set();
        for (let i = 0; i < links.length && i < 1800; i++) {
            const card = findFBFriendCardForTrust(links[i]);
            if (card) cards.add(card);
        }

        let changed = 0;
        for (const card of cards) {
            const keys = getFBProfileKeysFromElement(card);
            if (!keys.size) continue;
            const hasIsolatedId = Array.from(keys).some(key => __fbIsolatedProfileKeys.has(key));
            if (hasIsolatedId) {
                keys.forEach(key => {
                    if (!__fbIsolatedAliasKeys.has(key)) {
                        __fbIsolatedAliasKeys.add(key);
                        changed++;
                    }
                });
            }
            keys.forEach(key => {
                // v57: never learn explicit high-risk/specific pages as trusted friends.
                if (isFBNeverTrustedProfileKey(key)) return;
                if (!__fbTrustedProfileKeys.has(key)) {
                    __fbTrustedProfileKeys.add(key);
                    changed++;
                }
            });
        }
        if (changed) saveFBProfilePolicyCache();
        return changed;
    } catch (e) { return 0; }
};

loadFBProfilePolicyCache();

// ===== HOME FEED ZERO-GLIMPSE GATE v23 =====
// Keep this narrow: home feed only. Profile/timeline pages have their own protections.
const isFBHomeFeedSurface = () => {
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

const updateFBHomeFeedGateClass = () => {
    try {
        if (!document.documentElement) return;
        document.documentElement.classList.toggle('fb-home-feed-unit-softgate-v23', isFBHomeFeedSurface());

        // v50: trusted own/Dad/friend timelines are native territory. They never enter
        // the one-shot post screening lane, preventing empty virtual slots and profile-post loss.
        const trustedTimeline = isFBTrustedProfileTimelineSurface(window.location.href);
        const messengerNative = isFBMessengerPath(window.location.href);
        const feedGateAllowed = !messengerNative && !trustedTimeline && !isFBSearchPagePath() && !isFBNoPostScanUrl(window.location.href);
        document.documentElement.classList.toggle('fb-messenger-native-v54', messengerNative);
        document.documentElement.classList.toggle('fb-feed-screening-gate-v46', feedGateAllowed);
        document.documentElement.classList.toggle('fb-trusted-profile-timeline-v50', trustedTimeline);
        if (trustedTimeline) releaseFBTrustedTimelinePosts(document);
    } catch (e) {}
};

updateFBHomeFeedGateClass();

// ===== SAFE ZERO-GLIMPSE BOOTSTRAP v2 =====
// This replaces the too-broad "hide feed until approved" idea.
// It does NOT hide the whole feed/page. It only prehides the Friends/Kaverit nav entry
// and, on friends-list surfaces, keeps unprocessed profile cards invisible until the scanner approves/bans them.

const updateFBFriendsSoftGate = () => {
    try {
        if (!document.documentElement) return;
        document.documentElement.classList.toggle('fb-friends-card-softgate-v2', refreshFBElementHidingAccountScope() && isFBFriendsSurfacePath());
    } catch (e) {}
};

const injectFBSafeNoGlimpseBootstrap = () => {
    try {
        let style = document.getElementById('fb-safe-noglimpse-bootstrap-v2');
        if (!style) {
            style = document.createElement('style');
            style.id = 'fb-safe-noglimpse-bootstrap-v2';
        }

        style.textContent = `
            /* Zero-glimpse for the Friends/Kaverit left-nav button, but scoped to actual friend links. */
            html.fb-strict-element-hiding-v37 a[aria-label="Kaverit"][href*="/friends"],
            html.fb-strict-element-hiding-v37 a[aria-label="Friends"][href*="/friends"],
            html.fb-strict-element-hiding-v37 a[href="/friends/"],
            html.fb-strict-element-hiding-v37 a[href^="/friends/"],
            html.fb-strict-element-hiding-v37 a[href*="facebook.com/friends"],
            html.fb-strict-element-hiding-v37 li:has(> div a[aria-label="Kaverit"][href*="/friends"]),
            html.fb-strict-element-hiding-v37 li:has(> div a[aria-label="Friends"][href*="/friends"]),
            html.fb-strict-element-hiding-v37 li:has(> div a[href^="/friends/"]),
            html.fb-strict-element-hiding-v37 div[role="navigation"] [role="listitem"]:has(a[aria-label="Kaverit"][href*="/friends"]),
            html.fb-strict-element-hiding-v37 div[role="navigation"] [role="listitem"]:has(a[aria-label="Friends"][href*="/friends"]),
            html.fb-strict-element-hiding-v37 div[role="navigation"] [role="listitem"]:has(a[href^="/friends/"]),
            html.fb-strict-element-hiding-v37 div[role="navigation"] li:has(a[aria-label="Kaverit"][href*="/friends"]),
            html.fb-strict-element-hiding-v37 div[role="navigation"] li:has(a[aria-label="Friends"][href*="/friends"]),
            html.fb-strict-element-hiding-v37 div[role="navigation"] li:has(a[href^="/friends/"]) {
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
                if (document.documentElement && !isFBFriendsSurfacePath()) {
                    document.documentElement.classList.remove('fb-friends-card-softgate-v2');
                }
            } catch (e) {}
        }, 1800);
    } catch (e) {
        try {
            setTimeout(() => {
                if (document.documentElement && !isFBFriendsSurfacePath()) document.documentElement.classList.remove('fb-friends-card-softgate-v2');
            }, 1800);
        } catch (ignored) {}
    }
};

updateFBFriendsSoftGate();
injectFBSafeNoGlimpseBootstrap();
releaseFBFriendsSoftGateV2Soon();

// v43: one authoritative classifier for reaction/likes dialogs.
// Notifications and comments can also contain profile links and the word "like";
// require row-list/message/reaction controls before enabling the softgate.
const isFBLikesOverlayDialog = (dialog) => {
    try {
        if (!dialog || !dialog.isConnected || !dialog.querySelectorAll) return false;
        if (isNotificationPanelElement(dialog) || isFBActiveCommentOverlay(dialog)) return false;

        const profileLinks = dialog.querySelectorAll('a[href*="facebook.com/"]');
        if (profileLinks.length < 2) return false;

        const hasMessageAction = !!dialog.querySelector('[aria-label="Viesti"], [aria-label="Message"], [role="button"][aria-label*="viesti" i], [role="button"][aria-label*="message" i]');
        const hasReactionControl = !!dialog.querySelector('[aria-label*="reaction" i], [aria-label*="reaktio" i], [aria-label*="like" i], [aria-label*="tykkä" i]');
        const headingText = Array.from(dialog.querySelectorAll('[role="heading"], h1, h2, h3'))
            .slice(0, 6)
            .map(el => String(el.textContent || ''))
            .join(' ')
            .toLowerCase();
        const headingLooksRight = /reaction|reacted|likes|people who|reaktio|tykkä|kaikki/.test(headingText);

        return (hasMessageAction && (hasReactionControl || headingLooksRight)) ||
               (hasReactionControl && headingLooksRight);
    } catch (e) {
        return false;
    }
};

const markFBLikesOverlayDialogs = () => {
    try {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        let marked = 0;
        for (let i = 0; i < dialogs.length && i < 12; i++) {
            const dialog = dialogs[i];
            const active = isFBLikesOverlayDialog(dialog);
            dialog.classList.toggle('fb-likes-overlay-dialog-v43', active);
            if (active) marked++;
        }
        return marked;
    } catch (e) {
        return 0;
    }
};

// ===== LIKES / REACTIONS OVERLAY SOFTGATE v5 =====
// Narrow softgate: only compact profile rows inside reaction/likes dialogs are hidden while being scanned.
// Safe rows are approved immediately. Banned rows stay hard-hidden. The gate auto-releases to avoid blank overlays.
const injectFBLikesOverlaySoftGateCSS = () => {
    try {
        let style = document.getElementById('fb-likes-overlay-softgate-style-v5');
        if (!style) {
            style = document.createElement('style');
            style.id = 'fb-likes-overlay-softgate-style-v5';
        }

        style.textContent = `
            html.fb-likes-overlay-softgate-v5 [role="dialog"].fb-likes-overlay-dialog-v43 div[data-visualcompletion="ignore-dynamic"]:has(a[href*="facebook.com/"]):not(.fb-likes-overlay-row-approved):not(.fb-likes-overlay-row-banned):not(.fb-element-banned) {
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

const activateFBLikesOverlaySoftGate = () => {
    try {
        injectFBLikesOverlaySoftGateCSS();
        if (!markFBLikesOverlayDialogs()) {
            document.documentElement?.classList.remove('fb-likes-overlay-softgate-v5');
            return false;
        }

        document.documentElement?.classList.add('fb-likes-overlay-softgate-v5');
        const release = () => document.documentElement?.classList.remove('fb-likes-overlay-softgate-v5');
        addTimeout(release, 650);
        addTimeout(release, 1200);
        return true;
    } catch (e) {
        return false;
    }
};

injectFBLikesOverlaySoftGateCSS();

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
        body.is-search-page [role="main"] [role="article"]:not(.fb-search-approved),
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
        body.is-search-page [role="main"] [role="article"].fb-search-approved,
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

        /* v49: Facebook can keep a virtualized feed slot at the banned post's old
           media height even after the inner FeedUnit is display:none or removed.
           Collapse the safe one-post slot as well; JS releases this class whenever
           Facebook recycles that slot for a newly approved post. */
        /* v50 trusted profile timelines: JS removes stale scanner state; this CSS is the
           paint-time safety net so a recycled approved profile post cannot remain transparent. */
        html.fb-trusted-profile-timeline-v50 [role="feed"] .fb-trusted-profile-post-v50,
        html.fb-trusted-profile-timeline-v50 [role="feed"] .fb-post-approved,
        html.fb-trusted-profile-timeline-v50 div[data-pagelet^="TimelineFeedUnit_"].fb-post-approved,
        html.fb-trusted-profile-timeline-v50 div[data-pagelet^="FeedUnit_"].fb-post-approved {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            content-visibility: visible !important;
        }

        /* v52: keep pending/hydrating virtual slots as a one-pixel in-flow anchor.
           The anchor remains observable by Facebook's lazy loader, but the 300px fallback
           card and Facebook's own empty skeleton slot never become visible. Native sizing
           returns as soon as hydration/scanning reaches a terminal state. */
        .fb-feed-slot-screening-v51:not(.fb-feed-slot-banned-v49):not(.fb-post-approved[data-fb-v25-scan-complete="1"]):not(:has(.fb-post-approved[data-fb-v25-scan-complete="1"])),
        .fb-feed-slot-hydrating-v52:not(.fb-feed-slot-banned-v49):not(.fb-post-approved[data-fb-v25-scan-complete="1"]):not(:has(.fb-post-approved[data-fb-v25-scan-complete="1"])),
        .fb-native-post-hydrating-v52:not(.fb-feed-slot-banned-v49):not(.fb-post-approved[data-fb-v25-scan-complete="1"]),
        html.fb-trusted-profile-timeline-v50 [role="feed"] .fb-feed-slot-hydrating-v52:not(.fb-feed-slot-banned-v49):not(.fb-post-approved[data-fb-v25-scan-complete="1"]):not(:has(.fb-post-approved[data-fb-v25-scan-complete="1"])),
        html.fb-trusted-profile-timeline-v50 [role="feed"] .fb-native-post-hydrating-v52:not(.fb-feed-slot-banned-v49):not(.fb-post-approved[data-fb-v25-scan-complete="1"]) {
            position: relative !important;
            height: 1px !important;
            min-height: 1px !important;
            max-height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            content-visibility: hidden !important;
            contain: strict !important;
            transition: none !important;
            animation: none !important;
        }

        /* Trusted timelines bypass content scanning, but their initial Facebook skeletons
           still need the same no-slot treatment. Restrict this synchronous CSS fallback to
           hydration-only cards so loading comments/media inside a real post stay untouched. */
        html.fb-trusted-profile-timeline-v50 div[data-pagelet^="FeedUnit_"]:has([data-visualcompletion="loading-state"]):not(:has([data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-ad-comet-preview="message"], video)),
        html.fb-trusted-profile-timeline-v50 div[data-pagelet^="TimelineFeedUnit_"]:has([data-visualcompletion="loading-state"]):not(:has([data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-ad-comet-preview="message"], video)),
        html.fb-trusted-profile-timeline-v50 [role="feed"] > [role="article"]:has([data-visualcompletion="loading-state"]):not(:has([data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-ad-comet-preview="message"], video)) {
            position: relative !important;
            height: 1px !important;
            min-height: 1px !important;
            max-height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            content-visibility: hidden !important;
            contain: strict !important;
            transition: none !important;
            animation: none !important;
        }

        .fb-feed-slot-banned-v49 {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            width: 0 !important;
            height: 0 !important;
            min-width: 0 !important;
            min-height: 0 !important;
            max-width: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            content-visibility: hidden !important;
        }

        /* ANTI-FLASHING: Hide critical elements by default immediately with content-visibility */
        html.fb-strict-element-hiding-v37 div[aria-label="People You May Know"],
        html.fb-strict-element-hiding-v37 div[aria-label="Ihmisiä, jotka saatat tuntea"],
        html.fb-strict-element-hiding-v37 [role="article"]:has([aria-label="Liity ryhmään"]):has([aria-label*="Poista ehdotettu ryhmä"]),
        html.fb-strict-element-hiding-v37 [role="article"]:has([aria-label="Join group"]):has([aria-label*="Remove suggested group"]),
        html.fb-strict-element-hiding-v37 [role="article"]:has([aria-label="Liity ryhmään"]):has(a[href*="/groups/"]),
        html.fb-strict-element-hiding-v37 [role="article"]:has([aria-label="Join group"]):has(a[href*="/groups/"]),
        html.fb-strict-element-hiding-v37 div[aria-label="Sinulle ehdotettua"]:has([aria-label="Liity ryhmään"]),
        html.fb-strict-element-hiding-v37 div[aria-label="Suggested for you"]:has([aria-label="Join group"]),
        html.fb-strict-element-hiding-v37 div[role="none"].x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.x14ldlfn.x1b1wa69.xws8118.x5fzff1.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1qhmfi1.x1r1pt67.x7at6mh.xkde5i4,
        html.fb-strict-element-hiding-v37 div[role="none"]:has(svg[viewBox="0 0 16 16"] path[d^="M6.938 5.647"]),
        html.fb-strict-element-hiding-v37 a[href="https://www.facebook.com/friends/suggestions/"],
        html.fb-strict-element-hiding-v37 div[aria-label="Näytä suosituksia"],
        html.fb-strict-element-hiding-v37 [aria-label="Näytä suositukset"],
        html.fb-strict-element-hiding-v37 [role="button"][aria-label="Näytä suositukset"],
        /* v19: zero-glimpse hide the Finnish "Remove from friends" menu item.
           html.fb-strict-element-hiding-v37 Facebook exposes this dropdown as role="menuitem" with a specific remove-person SVG,
           html.fb-strict-element-hiding-v37 so hide by structure/icon before JS text scanning gets a paint chance. */
        html.fb-strict-element-hiding-v37 div[role="menuitem"]:has(svg path[d^="M9.248 1a4.248"]),
        html.fb-strict-element-hiding-v37 div[role="menuitem"]:has(svg path[d*="18.78 17.72"]),
        html.fb-strict-element-hiding-v37 a[aria-label="Meta AI"],
        html.fb-strict-element-hiding-v37 div[aria-label="Meta AI"],
        html.fb-strict-element-hiding-v37 a[href="/Meta AI/"],
        html.fb-strict-element-hiding-v37 li:has(a[aria-label="Kaverit"][href*="/friends"]),
        html.fb-strict-element-hiding-v37 li:has(a[aria-label="Friends"][href*="/friends"]),
        html.fb-strict-element-hiding-v37 a[href="/friends/"],
        html.fb-strict-element-hiding-v37 div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12 2.5a9.5"]),
        html.fb-strict-element-hiding-v37 div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12%202.5a9.5"]),
        html.fb-strict-element-hiding-v37 a[aria-label="Näytä kaikki"] > span.x193iq5w.xeuugli.x13faqbe,
        /* More specific Meta AI selectors */
        html.fb-strict-element-hiding-v37 a[aria-label="Meta AI"],
        html.fb-strict-element-hiding-v37 div[aria-label="Meta AI"],
        html.fb-strict-element-hiding-v37 span[aria-label="Meta AI"],
        /* v20: Meta AI refresh-time sprite fallback, narrowed to the 36px shortcut row.
           html.fb-strict-element-hiding-v37 The same 7Md5shK5dH8.webp sprite is reused by harmless profile-header controls
           html.fb-strict-element-hiding-v37 (for example the "Näytä kaikki" friend-strip button at 16px), so do NOT hide the raw sprite globally. */
        html.fb-strict-element-hiding-v37 div.html-div[style*="--x-rowGap"]:has(i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"]),
        html.fb-strict-element-hiding-v37 div.x9f619.x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.x1qughib.x6s0dn4.xozqiw3.x1q0g3np:has(i[data-visualcompletion="css-img"][style*="7Md5shK5dH8.webp"][style*="width:36px"][style*="height:36px"]),
        /* Meta AI contact links */
        html.fb-strict-element-hiding-v37 a[href*="/messages/t/36327,2227039302/"],
        html.fb-strict-element-hiding-v37 a[href*="messages/t/36327"],
        /* Friends-related links */
        html.fb-strict-element-hiding-v37 a[href*="meta.ai"], html.fb-strict-element-hiding-v37 a[href="/Meta AI/"], html.fb-strict-element-hiding-v37 a[href="/friends/"],
        html.fb-strict-element-hiding-v37 a[role="link"][href="/friends/"], html.fb-strict-element-hiding-v37 a[role="link"][aria-label="Kaverit"], html.fb-strict-element-hiding-v37 a[role="link"][aria-label="Friends"],
        html.fb-strict-element-hiding-v37 img[src*="w5I9ktz_3Ib.png"],
        html.fb-strict-element-hiding-v37 li.x1iyjqo2.xmlsiyf.x1hxoosp.x1l38jg0.x1awlv9s.x1i64zmx.x1gz44f,
        html.fb-strict-element-hiding-v37 .x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1),
        html.fb-strict-element-hiding-v37 div.x1i10hfl:nth-child(13),
        html.fb-strict-element-hiding-v37 div.x1i10hfl:nth-child(13) > div:nth-child(1),
        html.fb-strict-element-hiding-v37 div.x1i10hfl:nth-child(13) > div:nth-child(2),
        html.fb-strict-element-hiding-v37 div.x1i10hfl:nth-child(13) > div:nth-child(3),
        html.fb-strict-element-hiding-v37 .x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty),
        html.fb-strict-element-hiding-v37 svg[aria-label="Meta AI:n profiilikuva"],
        html.fb-strict-element-hiding-v37 svg[aria-label*="Meta AI profile"],
        html.fb-strict-element-hiding-v37 div.x1cy8zhl.x78zum5.xl56j7k.x1fns5xo:has(> img[width="24"][height="24"][aria-hidden="true"][src^="data:image/svg+xml"][src*="M12%202.5a9.5"]),
        html.fb-strict-element-hiding-v37 div.x1gefphp.xf7dkkf.x1l90r2v.xv54qhq.xyamay9.x1e56ztr.x78zum5.x9f619.x1olyfxc.x15x8krk.xde0f50.x5a5i1n.x1obq294.x6s0dn4:nth-of-type(6),
        html.fb-strict-element-hiding-v37 .xjkvuk6.x1iorvi4.x1qughib.x78zum5.x6s0dn4,
        html.fb-strict-element-hiding-v37 .x1vjfegm.x1iyjqo2,
        html.fb-strict-element-hiding-v37 div.x1a02dak:nth-child(3) > div:nth-child(1),
        html.fb-strict-element-hiding-v37 div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1),
        html.fb-strict-element-hiding-v37 div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1),
        html.fb-strict-element-hiding-v37 .x1ye3gou.x1120s5i.xn6708d.xz9dl7a.x1qughib.x1q0g3np.x78zum5,
        html.fb-strict-element-hiding-v37 .xbbxn1n.xwxc41k.xxbr6pl.x1p5oq8j.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div,
        html.fb-strict-element-hiding-v37 .x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo,
        /* ENHANCED: All PYMK selectors for instant hiding */
        html.fb-strict-element-hiding-v37 .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6,
        html.fb-strict-element-hiding-v37 .x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d,
        html.fb-strict-element-hiding-v37 svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq,
        html.fb-strict-element-hiding-v37 div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j,
        html.fb-strict-element-hiding-v37 div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z,
        html.fb-strict-element-hiding-v37 div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo {
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
        html.fb-strict-element-hiding-v37 a[href="/friends/"],
        html.fb-strict-element-hiding-v37 a[aria-label="Meta AI"],
        html.fb-strict-element-hiding-v37 div[aria-label="Meta AI"] {
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
        /* v45: do not paint a veil merely because a nested Facebook article lacks our
           approval class. Facebook frequently replaces inner [role=article] nodes after the
           canonical FeedUnit has already been approved. The veil is now driven only by the
           explicit .fb-post-screening-v47 state on the canonical post wrapper below. */

        /* v25.4.27 surgical-r5: keep native FB interaction islands alive inside approved posts.
           This is deliberately scoped to approved, non-banned posts and dialogs/menus, so blocked
           feed items still stay dead while Like/Comment/Share hover behavior stays native. */
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) [role="button"]:not(.fb-element-banned):not(.fb-post-banned),
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) a[role="link"]:not(.fb-element-banned):not(.fb-post-banned),
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) [aria-label*="Tykkää" i]:not(.fb-element-banned):not(.fb-post-banned),
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) [aria-label*="Like" i]:not(.fb-element-banned):not(.fb-post-banned),
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) [aria-label*="Kommentoi" i]:not(.fb-element-banned):not(.fb-post-banned),
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) [aria-label*="Comment" i]:not(.fb-element-banned):not(.fb-post-banned),
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) [aria-label*="Jaa" i]:not(.fb-element-banned):not(.fb-post-banned),
        .fb-post-approved:not(.fb-post-banned):not(.fb-element-banned) [aria-label*="Share" i]:not(.fb-element-banned):not(.fb-post-banned),
        [role="dialog"] [role="button"]:not(.fb-element-banned):not(.fb-likes-overlay-row-banned),
        [role="dialog"] [role="menuitem"]:not(.fb-element-banned):not(.fb-likes-overlay-row-banned),
        [role="menu"] [role="menuitem"]:not(.fb-element-banned):not(.fb-likes-overlay-row-banned),
        [role="dialog"] [aria-label*="Tykkää" i]:not(.fb-element-banned):not(.fb-likes-overlay-row-banned),
        [role="dialog"] [aria-label*="Like" i]:not(.fb-element-banned):not(.fb-likes-overlay-row-banned) {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            content-visibility: visible !important;
        }

        /* v45: wrapper screening is also explicit-state only. This prevents a newly hydrated
           child/wrapper from receiving a second independent white layer after its canonical
           FeedUnit was already approved. */

        html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"].fb-feed-unit-approved,
        html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"].fb-post-approved,
        html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"].fb-feed-unit-approved,
        html.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"].fb-post-approved {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            content-visibility: visible !important;
        }

        /* v38 immediate structural nukes from captured HTML.
           Reels are no longer CSS-hidden by raw /reel/ links; Facebook also uses those
           inside normal everyday posts. JS now verifies real mid-feed Reels carousels.
           Join/Follow cards: inline small CTA button wrappers from captured Liity/Seuraa snippets. */
        html.fb-strict-element-hiding-v37.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has(span.xdwrcjd.xuxw1ft > div[role="button"] > span.x1fey0fg),
        html.fb-strict-element-hiding-v37.fb-home-feed-unit-softgate-v23 div[data-pagelet^="FeedUnit_"]:has(span.x3nfvp2 > div[role="button"] > span.x1fey0fg),
        html.fb-strict-element-hiding-v37.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:has(span.xdwrcjd.xuxw1ft > div[role="button"] > span.x1fey0fg),
        html.fb-strict-element-hiding-v37.fb-home-feed-unit-softgate-v23 div[data-pagelet^="TimelineFeedUnit_"]:has(span.x3nfvp2 > div[role="button"] > span.x1fey0fg) {
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

        /* v54: full-page Messenger hard immunity.
           Facebook uses role=article for message groups. Any stale feed-screening state must
           be visually neutralized immediately while JS removes it. Keep the allow-list tiny:
           only top-navigation Friends/Meta-AI shortcuts and explicitly hidden inbox rows are
           handled elsewhere. */
        html.fb-messenger-native-v54 [role="main"] .fb-post-screening-v47,
        html.fb-messenger-native-v54 [role="main"] .fb-post-pending,
        html.fb-messenger-native-v54 [role="main"] .fb-post-scanning,
        html.fb-messenger-native-v54 [role="main"] .fb-post-expanding,
        html.fb-messenger-native-v54 [role="main"] .fb-post-banned,
        html.fb-messenger-native-v54 [role="main"] [role="article"].fb-element-banned,
        html.fb-messenger-native-v54 [role="main"] .fb-feed-slot-screening-v51,
        html.fb-messenger-native-v54 [role="main"] .fb-feed-slot-hydrating-v52,
        html.fb-messenger-native-v54 [role="main"] .fb-native-post-hydrating-v52,
        html.fb-messenger-native-v54 [role="main"] .fb-feed-slot-banned-v49 {
            display: revert !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            height: auto !important;
            min-width: 0 !important;
            min-height: 0 !important;
            max-width: none !important;
            max-height: none !important;
            margin: revert !important;
            padding: revert !important;
            border: revert !important;
            overflow: visible !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            content-visibility: visible !important;
            contain: none !important;
            isolation: auto !important;
            transition: revert !important;
            animation: revert !important;
        }

        html.fb-messenger-native-v54 [role="main"] .fb-post-screening-v47 > * {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            transition: revert !important;
            animation: revert !important;
        }

        html.fb-messenger-native-v54 [role="banner"] a[href="/friends/"],
        html.fb-messenger-native-v54 [role="banner"] a[href*="facebook.com/friends/"],
        html.fb-messenger-native-v54 [role="banner"] a[aria-label="Kaverit"][href*="/friends"],
        html.fb-messenger-native-v54 [role="banner"] a[aria-label="Friends"][href*="/friends"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }

        /* v25.4.25: Notifications are sacred territory.
           The global post/search gates must never hide notification rows in the top-right popup
           or the full notifications page. JS also adds fb-post-approved to these rows. */
        .fb-notifications-protected,
        .fb-notifications-protected [role="article"],
        .fb-notifications-protected [role="listitem"],
        .fb-notifications-protected [role="row"],
        .fb-notifications-protected li,
        .fb-notifications-protected a,
        .fb-notifications-protected img {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            content-visibility: visible !important;
            transition: none !important;
            animation: none !important;
        }

        /* v33 comments / notification-opened post hard immunity.
           Facebook renders comments as role="article", so the global feed prehide must not
           collapse comment rows or notification-opened post surfaces. JS also removes any old
           hard-hide classes/inline styles from these nodes. */
        html.fb-native-post-noscan-v33 [role="main"] [role="article"],
        html.fb-native-post-noscan-v33 [role="dialog"] [role="article"],
        html.fb-native-post-noscan-v33 [data-pagelet="MediaViewer_Sidebar"] [role="article"],
        html.fb-native-post-noscan-v33 [data-pagelet="TahoeRightRail"] [role="article"],
        html.fb-comment-url-immunity-v33 [role="dialog"] [role="article"],
        html.fb-comment-url-immunity-v33 [data-pagelet="MediaViewer_Sidebar"] [role="article"],
        html.fb-comment-url-immunity-v33 [data-pagelet="TahoeRightRail"] [role="article"],
        [role="dialog"] [role="article"],
        [role="dialog"] [aria-label*="comment" i],
        [role="dialog"] [aria-label*="komment" i],
        [role="dialog"] [aria-label*="reply" i],
        [role="dialog"] [aria-label*="vastaa" i],
        [aria-label*="comment" i] [role="article"],
        [aria-label*="komment" i] [role="article"],
        [title*="comment" i] [role="article"],
        [title*="komment" i] [role="article"],
        [data-testid*="comment" i] [role="article"],
        [role="article"] [role="article"],
        .fb-comments-protected {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            content-visibility: visible !important;
            transition: none !important;
            animation: none !important;
        }

        .fb-comments-protected * {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            content-visibility: visible !important;
            transition: none !important;
            animation: none !important;
        }

        /* v52 CSS-FIRST ZERO-SLOT GATE.
           Every undecided canonical FeedUnit becomes a one-pixel, invisible lazy-load anchor
           before JavaScript's mutation queue can run. This covers both Facebook skeletons and
           real content awaiting the one-shot scan, so neither phase paints an empty card. */
        html.fb-feed-screening-gate-v46 div[data-pagelet^="FeedUnit_"]:not(.fb-post-approved):not(.fb-feed-unit-approved):not(.fb-post-banned):not(.fb-element-banned):not([data-fb-v25-scan-complete="1"]),
        html.fb-feed-screening-gate-v46 div[data-pagelet^="TimelineFeedUnit_"]:not(.fb-post-approved):not(.fb-feed-unit-approved):not(.fb-post-banned):not(.fb-element-banned):not([data-fb-v25-scan-complete="1"]),
        html.fb-feed-screening-gate-v46 [role="feed"] > [role="article"]:not(.fb-post-approved):not(.fb-feed-unit-approved):not(.fb-post-banned):not(.fb-element-banned):not([data-fb-v25-scan-complete="1"]),
        .fb-post-screening-v47:not([data-fb-v25-scan-complete="1"]):not(.fb-post-banned):not(.fb-element-banned) {
            position: relative !important;
            isolation: isolate !important;
            height: 1px !important;
            min-height: 1px !important;
            max-height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            content-visibility: hidden !important;
            contain: strict !important;
            transition: none !important;
            animation: none !important;
        }

        .fb-post-screening-v47:not([data-fb-v25-scan-complete="1"]):not(.fb-post-banned):not(.fb-element-banned) > * {
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            transition: none !important;
            animation: none !important;
        }

        /* Patch 1's generated 300px placeholder was itself the visible empty post slot. */
        .fb-post-screening-v47::after {
            content: none !important;
            display: none !important;
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
            styleTag.textContent = `html.fb-strict-element-hiding-v37 a[aria-label="Kaverit"][href*="/friends"], html.fb-strict-element-hiding-v37 a[aria-label="Friends"][href*="/friends"], html.fb-strict-element-hiding-v37 a[href="/friends/"] { display: none !important; }`;
            (document.head || document.documentElement).appendChild(styleTag);
            devLog('Fallback CSS injected (safe append)');
        } catch (e) {
            console.log('Fallback CSS injection failed: ' + e.message);
        }
    }
};

// Run CSS injection immediately
injectInlineCSS();

// v25.4.27 surgical-r5: refresh no-glimpse guard.
// F5/Ctrl+R can leave the old, already-approved feed visible for a few frames before the browser
// actually tears the page down. Add a tiny pre-reload class immediately on refresh intent so the
// old feed/page modules cannot flash banned or odd content during that gap.
const injectFBRefreshPrehideCSS = () => {
    try {
        let style = document.getElementById('fb-refresh-prehide-style-v28');
        if (!style) {
            style = document.createElement('style');
            style.id = 'fb-refresh-prehide-style-v28';
        }
        style.textContent = `
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="feed"],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [data-pagelet="ProfileTimeline"],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 div[data-pagelet^="FeedUnit_"],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 div[data-pagelet^="TimelineFeedUnit_"],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [data-pagelet*="ProfileTiles" i],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [data-pagelet*="ProfileIntro" i],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [data-pagelet*="ProfileAbout" i],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [data-pagelet*="ProfileFeatured" i],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [aria-label*="Photos" i],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [aria-label*="Kuvat" i],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [aria-label*="Recommended" i],
            html.fb-strict-element-hiding-v37.fb-refresh-prehide-v28 [role="main"] [aria-label*="Suosit" i] {
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                content-visibility: hidden !important;
                transition: none !important;
                animation: none !important;
            }
        `;
        if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    } catch (e) {}
};

const armFBRefreshPrehide = () => {
    try {
        injectFBRefreshPrehideCSS();
        if (document.documentElement) document.documentElement.classList.add('fb-refresh-prehide-v28');
    } catch (e) {}
};

const installFBRefreshPrehide = () => {
    try {
        injectFBRefreshPrehideCSS();
        onWindowEvent(document, 'keydown', (event) => {
            try {
                const key = String(event.key || '').toLowerCase();
                const isRefresh = key === 'f5' || ((event.ctrlKey || event.metaKey) && key === 'r');
                if (isRefresh && !event.altKey) armFBRefreshPrehide();
            } catch (e) {}
        }, true);
        onWindowEvent(window, 'beforeunload', armFBRefreshPrehide, true);
        onWindowEvent(window, 'pageshow', () => {
            try { document.documentElement?.classList.remove('fb-refresh-prehide-v28'); } catch (e) {}
        }, true);
    } catch (e) {}
};

installFBRefreshPrehide();

// v20: early profile header safe island.
// Protects profile/page name, profile picture, friend count, and ProfileActions from early
// critical/zero-glimpse hiders. The captured header has no stable outer data-pagelet in every
// render, but it reliably contains ProfileActions, h1 title, large 168px profile SVG/image,
// friends_all/friends_mutual links, and profile action buttons.
const isProbablyProfileHeaderSafeElement = (el) => {
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
const isProbablyNativeTopSearchDropdownNodeEarly = (el) => {
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
const findMetaAIRowWrapper = (seed) => {
    try {
        if (!seed) return null;
        let node = seed;
        let best = null;
        const looksLikeMetaAIText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'meta ai';

        for (let depth = 0; node && node !== document.body && node !== document.documentElement && depth < 9; depth++, node = node.parentElement) {
            if (!node || !node.querySelector) continue;
            if (node.matches && node.matches('main, [role="main"], [role="feed"], header, [role="banner"], nav, [role="navigation"]')) break;
            if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(node)) return null;
            if (isProbablyProfileHeaderSafeElement(node)) return null;

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

const hideMetaAITextRows = () => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return;
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

                const wrapper = findMetaAIRowWrapper(candidate);
                if (!wrapper) return;
                if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(wrapper)) return;
                if (isProbablyProfileHeaderSafeElement(wrapper)) return;
                collapseElementHard(wrapper);
            } catch (e) {}
        });
    } catch (e) {}
};

// v19: fast no-glimpse scrubber for the "Poista kavereista" dropdown menu item.
// CSS handles the first paint by matching the remove-person SVG; this JS catches
// text-only/late React renders and keeps the item hidden during menu updates.
const findRemoveFriendMenuItem = (seed) => {
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

const hideRemoveFriendMenuItems = () => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return;
        const candidates = document.querySelectorAll([
            'div[role="menuitem"] span[dir="auto"]',
            'div[role="menuitem"] span.x1lliihq',
            'div[role="menuitem"] svg path[d^="M9.248 1a4.248"]',
            'div[role="menuitem"] svg path[d*="18.78 17.72"]'
        ].join(','));

        candidates.forEach((candidate) => {
            try {
                const wrapper = findRemoveFriendMenuItem(candidate);
                if (wrapper) collapseElementHard(wrapper);
            } catch (e) {}
        });
    } catch (e) {}
};

// Directly hide specific elements based on their unique selectors - Enhanced for persistence and anti-flashing
const hideCriticalElements = () => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return;
        devLog('Hiding critical elements with permanent banning and anti-flashing');
        hideMetaAITextRows();
        hideRemoveFriendMenuItems();
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
                if (isProbablyNativeTopSearchDropdownNodeEarly(el)) return;
                if (isProbablyProfileHeaderSafeElement(el)) return;
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

const hideCriticalNavOnly = () => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return;
        hideMetaAITextRows();
        hideRemoveFriendMenuItems();
        const selectors = [
            'a[href="https://www.facebook.com/friends/"]',
            'a[aria-label="Kaverit"][href*="/friends"]',
            'a[aria-label="Friends"][href*="/friends"]',
            'a[href="/friends/"]',
            'li:has(a[aria-label="Kaverit"][href*="/friends"])',
            'li:has(a[aria-label="Friends"][href*="/friends"])',
            'a[aria-label="Meta AI"]',
            'div[aria-label="Meta AI"]',
            'span[aria-label="Meta AI"]',
            'a[href="https://www.meta.ai/"]',
            'a[href="https://meta.ai/"]',
            'a[href="/Meta AI/"]',
            'svg[aria-label="Meta AI:n profiilikuva"]',
            'svg[aria-label*="Meta AI profile"]',
            'a[href*="/messages/t/36327,2227039302/"]',
            'a[href*="messages/t/36327"]'
        ];
        selectors.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    try {
                        if (isProbablyNativeTopSearchDropdownNodeEarly(el)) return;
                        if (isProbablyProfileHeaderSafeElement(el)) return;
                        if (isNotificationPanelElement(el)) return;
                        if (isInsideFBActiveCommentOverlay(el)) return;
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
                            el.style.setProperty('content-visibility', 'hidden', 'important');
                        }
                    } catch (e) {}
                });
            } catch (e) {}
        });
    } catch (e) {}
};

// Run immediately
hideCriticalElements();

function collapseElementHard(el) {
if (!el || !el.style) return;
try {
    if (typeof isFBCommentSurfaceElement === 'function' && isFBCommentSurfaceElement(el)) {
        protectFBCommentSurfaces(el.closest?.('[role="dialog"], [role="main"], [role="article"]') || el);
        return;
    }
} catch (e) {}

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

// ===== v31 decision cache: avoid rescanning unchanged approved/banned units =====
// This is intentionally conservative: it never trusts only the old CSS/classes.
// A cached decision is reused only when a cheap text/link/attribute fingerprint is unchanged.
const FB_DECISION_CACHE_VERSION = 'fb-decision-cache-2026-06-13-v38-reels-surgical';
const __fbElementDecisionCache = new WeakMap();

const hashFBString = (value) => {
    try {
        const str = String(value || '');
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(36);
    } catch (e) {
        return '0';
    }
};

const sampleFBTextForSignature = (value) => {
    try {
        const raw = String(value || '');
        const len = raw.length;
        if (len <= 760) return raw;
        const mid = Math.max(0, Math.floor(len / 2) - 160);
        return raw.slice(0, 300) + '\n…\n' + raw.slice(mid, mid + 320) + '\n…\n' + raw.slice(-300);
    } catch (e) {
        return '';
    }
};

const buildFBElementDecisionSignature = (element, cacheType = 'generic') => {
    try {
        if (!element || !element.isConnected) return '';

        const rawText = String(element.textContent || '');
        const sampledText = fbNotifNorm(sampleFBTextForSignature(rawText));
        const attrSignals = [];
        const selectors = [
            'a[href]',
            'img[alt]',
            'img[src]',
            '[aria-label]',
            '[title]',
            '[data-fbid]',
            '[data-profileid]',
            '[data-profile-id]',
            '[data-pageid]',
            '[data-page-id]',
            '[data-userid]',
            '[data-ownerid]',
            '[data-hovercard]',
            '[data-store]',
            '[data-ft]',
            '[data-fbcleaner-urlsig]'
        ].join(',');

        const nodes = element.querySelectorAll ? element.querySelectorAll(selectors) : [];
        const limit = cacheType === 'post' ? 95 : 55;
        const capped = Math.min(nodes.length, limit);
        for (let i = 0; i < capped; i++) {
            const node = nodes[i];
            if (!node || isNotificationPanelElement(node) || isInsideComment(node)) continue;
            attrSignals.push([
                node.tagName || '',
                node.href || '',
                node.src || '',
                node.getAttribute && node.getAttribute('href') || '',
                node.getAttribute && node.getAttribute('src') || '',
                node.getAttribute && node.getAttribute('alt') || '',
                node.getAttribute && node.getAttribute('aria-label') || '',
                node.getAttribute && node.getAttribute('title') || '',
                node.getAttribute && node.getAttribute('data-fbid') || '',
                node.getAttribute && node.getAttribute('data-profileid') || '',
                node.getAttribute && node.getAttribute('data-profile-id') || '',
                node.getAttribute && node.getAttribute('data-pageid') || '',
                node.getAttribute && node.getAttribute('data-page-id') || '',
                node.getAttribute && node.getAttribute('data-userid') || '',
                node.getAttribute && node.getAttribute('data-ownerid') || '',
                node.getAttribute && node.getAttribute('data-hovercard') || '',
                node.getAttribute && node.getAttribute('data-store') || '',
                node.getAttribute && node.getAttribute('data-ft') || '',
                node.getAttribute && node.getAttribute('data-fbcleaner-urlsig') || ''
            ].join('~'));
        }

        const strictFlag = (typeof __fbStrictAccountEnabled !== 'undefined' && __fbStrictAccountEnabled) ? 'strict' : 'normal';
        return [
            FB_DECISION_CACHE_VERSION,
            cacheType,
            strictFlag,
            location.pathname || '',
            element.childElementCount || 0,
            rawText.length,
            hashFBString(sampledText),
            nodes.length,
            hashFBString(attrSignals.join('|')),
            element.getAttribute && element.getAttribute('data-fb-v25-showmore-clicked') || ''
        ].join('¦');
    } catch (e) {
        return '';
    }
};

const rememberFBElementDecision = (element, cacheType, decision, reason = '') => {
    try {
        if (!element || !element.isConnected) return;
        const signature = buildFBElementDecisionSignature(element, cacheType);
        if (!signature) return;
        __fbElementDecisionCache.set(element, {
            cacheType,
            decision,
            reason: String(reason || ''),
            signature,
            time: Date.now()
        });
        if (element.setAttribute) {
            element.setAttribute('data-fb-v31-cache-type', cacheType);
            element.setAttribute('data-fb-v31-cache-decision', decision);
        }
    } catch (e) {}
};

const getFBElementDecision = (element, cacheType) => {
    try {
        if (!element || !element.isConnected) return null;
        const cached = __fbElementDecisionCache.get(element);
        if (!cached || cached.cacheType !== cacheType) return null;
        const signature = buildFBElementDecisionSignature(element, cacheType);
        if (!signature || signature !== cached.signature) return null;
        return cached;
    } catch (e) {
        return null;
    }
};

const applyCachedFBPostDecision = (post) => {
    try {
        let cached = getFBElementDecision(post, 'post');
        if (!cached && typeof getFBStablePostDecisionV55 === 'function') {
            cached = getFBStablePostDecisionV55(post);
        }
        if (!cached) return false;

        post.classList.remove('fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-post-screening-v47');
        post.setAttribute('data-fb-v25-scan-complete', '1');
        post.removeAttribute('data-fb-v47-screen-start');

        if (cached.decision === 'banned') {
            post.classList.remove('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed');
            post.removeAttribute('data-fb-v46-approved-key');
            post.style?.removeProperty('--fb-v47-screen-height');
            post.querySelectorAll?.('[role="article"]').forEach(article => {
                try { article.classList.remove('fb-post-approved'); } catch (e) {}
            });
            hideElementHard(post, 'fb-post-banned');
            collapseFBFeedSlot(post);
            return true;
        }

        if (cached.decision === 'approved') {
            releaseFBFeedSlot(post);
            try { if (typeof releaseFBNativeHydrationSlotV53 === 'function') releaseFBNativeHydrationSlotV53(post); } catch (e) {}
            const wasHardHiddenByFBCleaner = hasFBCleanerHardHideClass(post);
            post.classList.remove('fb-post-banned', 'fb-element-banned', 'fb-group-suggestions-banned');
            post.classList.add('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed');
            const approvedKey = typeof getFBStablePostIdentity === 'function' ? getFBStablePostIdentity(post) : '';
            if (approvedKey) post.setAttribute('data-fb-v46-approved-key', approvedKey);
            post.style?.removeProperty('--fb-v47-screen-height');
            if (wasHardHiddenByFBCleaner) clearFBHideStyles(post);
            post.querySelectorAll?.('[role="article"]').forEach(article => {
                try { article.classList.add('fb-post-approved'); } catch (e) {}
            });
            if (typeof markFBFeedUnitApproved === 'function') markFBFeedUnitApproved(post);
            if (typeof rememberApprovedPostForBrowsing === 'function') rememberApprovedPostForBrowsing(post);
            try { if (typeof rememberFBStablePostDecisionV55 === 'function') rememberFBStablePostDecisionV55(post, 'approved'); } catch (e) {}
            return true;
        }
    } catch (e) {}
    return false;
};

const applyCachedFBFeedUnitRestrictionDecision = (unit) => {
    try {
        const cached = getFBElementDecision(unit, 'feed-unit-restriction');
        if (!cached) return false;
        if (cached.decision === 'banned') {
            hideFBFeedUnitHard(unit, cached.reason || 'cached restricted feed unit');
            return true;
        }
        if (cached.decision === 'approved') {
            return true;
        }
    } catch (e) {}
    return false;
};

const applyCachedFBProfileCardDecision = (card) => {
    try {
        const cached = getFBElementDecision(card, 'profile-card');
        if (!cached) return false;
        if (cached.decision === 'banned') {
            hideElementHard(card, 'fb-profile-card-banned');
        } else if (cached.decision === 'approved') {
            card.classList.add('fb-profile-card-approved');
        }
        return true;
    } catch (e) {}
    return false;
};

// ===== HOME FEED CTA / REELS SCRUBBER v23 =====
const FB_RESTRICTED_FEED_CTA_TEXT = new Set(['liity', 'join', 'seuraa', 'follow']);

const getFBFeedUnitWrapper = (seed) => {
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

// ===== v49 FEED VIRTUAL-SLOT COLLAPSE =====
// A hidden/removed article is not always the node that owns its layout height.
// Walk outward only while the candidate contains a single canonical FeedUnit;
// this reaches Facebook's one-post virtualization slot without ever hiding the
// feed container or a wrapper shared by neighbouring posts.
const getFBFeedSlotWrapper = (seed) => {
    try {
        const unit = getFBFeedUnitWrapper(seed) || seed;
        if (!unit || !unit.closest || !unit.parentElement) return unit || null;

        const feed = unit.closest('[role="feed"]');
        if (!feed) return unit;

        const unitSelector = 'div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"]';
        let best = unit;
        let current = unit.parentElement;
        let depth = 0;

        while (current && current !== feed && depth < 6) {
            if (current.matches?.('main, [role="main"], [role="feed"], [role="dialog"], [role="region"]')) break;

            const nestedUnits = current.querySelectorAll?.(unitSelector) || [];
            if (nestedUnits.length > 1) break;

            // For Facebook layouts that omit data-pagelet, reject an ancestor
            // containing multiple peer articles. Nested comment articles do not
            // count because they live inside another role=article.
            const articles = Array.from(current.querySelectorAll?.('[role="article"]') || []);
            const peerArticles = articles.filter(article => {
                const parentArticle = article.parentElement?.closest?.('[role="article"]');
                return !parentArticle || !current.contains(parentArticle);
            });
            if (nestedUnits.length === 0 && peerArticles.length > 1) break;

            best = current;
            current = current.parentElement;
            depth++;
        }

        return best;
    } catch (e) {
        return getFBFeedUnitWrapper(seed) || seed || null;
    }
};

const collapseFBFeedSlot = (seed) => {
    try {
        if (isFBTrustedProfileTimelineSurface()) return null;
        const unit = getFBFeedUnitWrapper(seed) || seed;
        const slot = getFBFeedSlotWrapper(unit);
        if (!slot?.classList) return;

        // Clear any earlier screening owner first. Facebook may have inserted/replaced a
        // wrapper during hydration, so the final slot is not guaranteed to be the same node.
        let current = unit;
        let depth = 0;
        while (current && depth < 7) {
            current.classList?.remove('fb-feed-slot-screening-v51');
            current.style?.removeProperty('--fb-v51-screen-height');
            if (current.getAttribute?.('role') === 'feed') break;
            current = current.parentElement;
            depth++;
        }

        slot.classList.add('fb-feed-slot-banned-v49');
        slot.setAttribute('data-fb-v49-collapsed-slot', '1');
        unit?.style?.removeProperty('--fb-v47-screen-height');
    } catch (e) {}
};

const releaseFBFeedSlot = (seed) => {
    try {
        const unit = getFBFeedUnitWrapper(seed) || seed;
        if (!unit) return;

        // v55: terminal approval owns the slot. Native hydration tracking used to leave an
        // outer fb-feed-slot-hydrating-v52 class behind after React recycled/reinserted the
        // post. The approved post remained correct, but its parent was still CSS-collapsed.
        try { if (typeof releaseFBNativeHydrationSlotV53 === 'function') releaseFBNativeHydrationSlotV53(unit); } catch (e) {}

        let current = unit;
        let depth = 0;
        while (current && depth < 7) {
            if (current.classList?.contains('fb-feed-slot-banned-v49')) {
                current.classList.remove('fb-feed-slot-banned-v49');
                current.removeAttribute?.('data-fb-v49-collapsed-slot');
            }
            if (current.classList?.contains('fb-feed-slot-screening-v51')) {
                current.classList.remove('fb-feed-slot-screening-v51');
                current.style?.removeProperty('--fb-v51-screen-height');
            }
            if (current.classList?.contains('fb-feed-slot-hydrating-v52')) {
                current.classList.remove('fb-feed-slot-hydrating-v52');
                current.removeAttribute?.('data-fb-v52-hydrating-slot');
            }
            if (current === unit && current.classList?.contains('fb-native-post-hydrating-v52')) {
                current.classList.remove('fb-native-post-hydrating-v52');
            }
            if (current.getAttribute?.('role') === 'feed') break;
            current = current.parentElement;
            depth++;
        }
    } catch (e) {}
};

// ===== v53 NATIVE POST-HYDRATION SLOT SUPPRESSOR =====
// Facebook's skeleton can live inside a one-post virtualization wrapper whose height is
// independent of the FeedUnit. Keep that wrapper as a one-pixel lazy-load anchor until real
// post structure arrives. This lane also runs on trusted timelines, where content scanning is
// deliberately bypassed, and it never treats a loading comment/media control as a whole-post load.
//
// Patch 2 scanned up to 180 complete FeedUnits from several overlapping 140ms/240ms/2s paths.
// On a long feed those repeated deep queries monopolized the main thread. Patch 3 tracks only
// actual loading-marker owners and their already-collapsed slots, with a short release debounce
// to prevent Facebook's recycled DOM from bouncing the layout between loading/real states.
const FB_NATIVE_POST_LOADING_SELECTOR_V52 = '[data-visualcompletion="loading-state"], [role="progressbar"]';
const FB_NATIVE_FEED_UNIT_SELECTOR_V53 = 'div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"] > [role="article"]';
const FB_NATIVE_POST_LOADING_MARKER_QUERY_V53 = [
    '[role="feed"] [data-visualcompletion="loading-state"]',
    '[role="feed"] [role="progressbar"]',
    'div[data-pagelet^="FeedUnit_"] [data-visualcompletion="loading-state"]',
    'div[data-pagelet^="TimelineFeedUnit_"] [data-visualcompletion="loading-state"]'
].join(',');
const FB_STABLE_POST_CONTENT_SELECTOR_V52 = [
    '[data-ad-rendering-role="story_message"]',
    '[data-ad-preview="message"]',
    '[data-ad-comet-preview="message"]',
    'video',
    'a[href*="/posts/"]',
    'a[href*="/permalink/"]',
    'a[href*="/photo/"]',
    'a[href*="/videos/"]',
    'a[href*="/reel/"]',
    '[aria-label*="Like" i]',
    '[aria-label*="Tykkää" i]',
    '[aria-label*="Comment" i]',
    '[aria-label*="Kommentoi" i]'
].join(',');

const __fbNativeHydrationTrackedPostsV53 = new Set();
const __fbNativeHydrationSlotByPostV53 = new WeakMap();
const __fbNativeHydrationSlotRefCountV53 = new Map();
const __fbNativeHydrationReleaseQueuedV53 = new WeakSet();
const __fbNativeHydrationSyncRootsV53 = new Set();
let __fbNativeHydrationSyncPendingV53 = false;

const isFBNativeHydrationOnlyPost = (post, alreadyTracked = false) => {
    try {
        if (!post?.querySelector || isNotificationPanelElement(post) || isFBCommentSurfaceElement(post)) return false;
        const loadingState = post.querySelector('[data-visualcompletion="loading-state"]');
        const progressbar = post.querySelector('[role="progressbar"]');
        if (!loadingState && !progressbar) return false;

        // A normally approved post is terminal. Later comment/video spinners must not collapse it.
        const scanComplete = post.getAttribute?.('data-fb-v25-scan-complete') || '';
        if (scanComplete === '1' && post.classList?.contains('fb-post-approved')) return false;

        // Once an initial whole-post skeleton owns a slot, keep that decision stable until its
        // loading-state marker is actually gone. Facebook often inserts real children shortly
        // before removing the marker; treating that overlap as completion caused layout thrash.
        if (alreadyTracked && loadingState) return true;

        const stableContent = !!post.querySelector(FB_STABLE_POST_CONTENT_SELECTOR_V52);
        if (stableContent) return false;

        const compactText = String(post.textContent || '').replace(/\s+/g, ' ').trim();
        if (loadingState) return compactText.length < 220;

        // A bare progressbar is a weaker signal than Facebook's loading-state marker.
        return compactText.length < 90 && !post.querySelector('img[src], a[href], video');
    } catch (e) {
        return false;
    }
};

const retainFBNativeHydrationSlotV53 = (post) => {
    try {
        if (!post?.classList || !post.isConnected) return false;
        post.classList.add('fb-native-post-hydrating-v52');
        __fbNativeHydrationTrackedPostsV53.add(post);

        let slot = __fbNativeHydrationSlotByPostV53.get(post);
        if (!slot?.isConnected || (slot !== post && !slot.contains?.(post))) {
            const previousSlot = slot;
            slot = getFBFeedSlotWrapper(post);
            if (previousSlot && previousSlot !== slot) {
                const previousCount = (__fbNativeHydrationSlotRefCountV53.get(previousSlot) || 1) - 1;
                if (previousCount <= 0) {
                    __fbNativeHydrationSlotRefCountV53.delete(previousSlot);
                    previousSlot.classList?.remove('fb-feed-slot-hydrating-v52');
                    previousSlot.removeAttribute?.('data-fb-v52-hydrating-slot');
                } else {
                    __fbNativeHydrationSlotRefCountV53.set(previousSlot, previousCount);
                }
            }

            if (slot?.classList && slot.getAttribute?.('role') !== 'feed') {
                __fbNativeHydrationSlotByPostV53.set(post, slot);
                __fbNativeHydrationSlotRefCountV53.set(slot, (__fbNativeHydrationSlotRefCountV53.get(slot) || 0) + 1);
            } else {
                slot = null;
                __fbNativeHydrationSlotByPostV53.delete(post);
            }
        }

        if (slot?.classList) {
            slot.classList.add('fb-feed-slot-hydrating-v52');
            slot.setAttribute('data-fb-v52-hydrating-slot', '1');
        }
        return true;
    } catch (e) {
        return false;
    }
};

const releaseFBNativeHydrationSlotV53 = (post) => {
    try {
        if (!post) return;
        post.classList?.remove('fb-native-post-hydrating-v52');
        __fbNativeHydrationTrackedPostsV53.delete(post);
        const slot = __fbNativeHydrationSlotByPostV53.get(post);
        __fbNativeHydrationSlotByPostV53.delete(post);
        if (!slot) return;

        const count = (__fbNativeHydrationSlotRefCountV53.get(slot) || 1) - 1;
        if (count <= 0) {
            __fbNativeHydrationSlotRefCountV53.delete(slot);
            slot.classList?.remove('fb-feed-slot-hydrating-v52');
            slot.removeAttribute?.('data-fb-v52-hydrating-slot');
        } else {
            __fbNativeHydrationSlotRefCountV53.set(slot, count);
        }
    } catch (e) {}
};

const addFBNativeHydrationCandidatesV53 = (root, candidates, documentWide = false) => {
    try {
        if (!root || !candidates) return;
        const doc = root.nodeType === 9 ? root : (root.ownerDocument || document);

        const addPost = (seed) => {
            try {
                if (!seed?.closest || isFBInsideEmbeddedChatSurfaceV56(seed)) return;
                const post = getFBFeedUnitWrapper(seed) || seed.closest('[role="feed"] [role="article"]');
                if (post?.isConnected && !isFBInsideEmbeddedChatSurfaceV56(post) && !isProfileHeaderProtectedArea(post)) candidates.add(post);
            } catch (e) {}
        };

        if (root.nodeType === 9 || documentWide) {
            __fbNativeHydrationTrackedPostsV53.forEach(post => candidates.add(post));
            const markers = doc.querySelectorAll(FB_NATIVE_POST_LOADING_MARKER_QUERY_V53);
            for (let i = 0; i < markers.length && i < 80; i++) addPost(markers[i]);
            return;
        }

        if (root.nodeType !== 1) return;
        addPost(root);
        if (root.matches?.(FB_NATIVE_FEED_UNIT_SELECTOR_V53)) candidates.add(getFBFeedUnitWrapper(root) || root);

        const markers = root.querySelectorAll?.(FB_NATIVE_POST_LOADING_SELECTOR_V52) || [];
        for (let i = 0; i < markers.length && i < 24; i++) addPost(markers[i]);

        // A removed loading marker leaves no marker to discover. Include a few canonical
        // descendants of the mutation root so a previously tracked owner can be released.
        const units = root.querySelectorAll?.(FB_NATIVE_FEED_UNIT_SELECTOR_V53) || [];
        for (let i = 0; i < units.length && i < 12; i++) candidates.add(getFBFeedUnitWrapper(units[i]) || units[i]);

        __fbNativeHydrationTrackedPostsV53.forEach(post => {
            try { if (root === post || root.contains?.(post)) candidates.add(post); } catch (e) {}
        });
    } catch (e) {}
};

function syncFBNativePostHydrationSlots(root = document) {
    try {
        if (isFBMessengerPath(window.location.href)) return 0;
        const candidates = new Set();
        addFBNativeHydrationCandidatesV53(root, candidates, root?.nodeType === 9);

        candidates.forEach(post => {
            try {
                if (isFBInsideEmbeddedChatSurfaceV56(post)) {
                    try { releaseFBNativeHydrationSlotV53(post); } catch (e) {}
                    return;
                }
                if (!post?.isConnected) {
                    releaseFBNativeHydrationSlotV53(post);
                    return;
                }

                const wasHydrating = __fbNativeHydrationTrackedPostsV53.has(post);
                if (isFBNativeHydrationOnlyPost(post, wasHydrating)) {
                    retainFBNativeHydrationSlotV53(post);
                    return;
                }

                if (!wasHydrating) {
                    post.classList?.remove('fb-native-post-hydrating-v52');
                    return;
                }

                const terminalApproved = post.getAttribute?.('data-fb-v25-scan-complete') === '1' &&
                    post.classList?.contains('fb-post-approved');
                if (terminalApproved) {
                    releaseFBNativeHydrationSlotV53(post);
                    return;
                }

                // Confirm the marker stayed absent for one quiet paint window. This absorbs
                // Facebook's remove/reinsert recycle burst without expanding/collapsing twice.
                if (!__fbNativeHydrationReleaseQueuedV53.has(post)) {
                    __fbNativeHydrationReleaseQueuedV53.add(post);
                    addTimeout(() => {
                        __fbNativeHydrationReleaseQueuedV53.delete(post);
                        if (post?.isConnected && isFBNativeHydrationOnlyPost(post, true)) {
                            retainFBNativeHydrationSlotV53(post);
                        } else {
                            releaseFBNativeHydrationSlotV53(post);
                        }
                    }, 160);
                }
            } catch (e) {}
        });

        return __fbNativeHydrationTrackedPostsV53.size;
    } catch (e) {
        return 0;
    }
}

const queueFBNativePostHydrationSyncV53 = (root) => {
    try {
        if (isFBMessengerPath(window.location.href) || isFBInsideEmbeddedChatSurfaceV56(root) || isFBEmbeddedChatMutationNodeV56(root)) return;
        const candidates = new Set();
        addFBNativeHydrationCandidatesV53(root, candidates, false);
        candidates.forEach(post => {
            if (__fbNativeHydrationSyncRootsV53.size < 32) __fbNativeHydrationSyncRootsV53.add(post);
        });

        if (__fbNativeHydrationSyncPendingV53 || __fbNativeHydrationSyncRootsV53.size === 0) return;
        __fbNativeHydrationSyncPendingV53 = true;
        addTimeout(() => {
            __fbNativeHydrationSyncPendingV53 = false;
            const roots = Array.from(__fbNativeHydrationSyncRootsV53);
            __fbNativeHydrationSyncRootsV53.clear();
            roots.forEach(post => syncFBNativePostHydrationSlots(post));
        }, 48);
    } catch (e) {}
};

const isProbablyHomeFeedUnit = (el) => {
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

const getCompactLowerText = (el, fallback = '') => {
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

// v38: surgical Reels carousel detector.
// Facebook puts /reel/ links inside normal posts too, so a raw reel URL is NOT enough
// to delete a FeedUnit. Only hide obvious mid-feed Reels/Kelat carousel modules.
const isFBMidFeedReelsCarousel = (seed) => {
    try {
        const unit = getFBFeedUnitWrapper(seed) || seed;
        if (!unit || !isProbablyHomeFeedUnit(unit)) return false;
        if (isNotificationPanelElement(unit) || isFBCommentSurfaceElement(unit) || isInsideComment(unit)) return false;
        if (isProfileHeaderProtectedArea(unit) || isTopLeftSearchDropdownElement(unit)) return false;

        const reelLinkSelector = [
            'a[href^="/reel/"]',
            'a[href*="facebook.com/reel/"]',
            'a[data-fbcleaner-urlsig^="/reel/"]',
            'a[data-fbcleaner-urlsig*="facebook.com/reel/"]',
            'a[aria-label^="Kela käyttäjältä"]',
            'a[aria-label^="Reel by"]'
        ].join(',');

        const countReelLinks = (root) => {
            try {
                const links = root && root.querySelectorAll ? root.querySelectorAll(reelLinkSelector) : [];
                return Math.min(links.length, 4);
            } catch (e) {
                return 0;
            }
        };

        // Actual Reels shelf/carousel usually exposes its own labelled region.
        const reelRegions = unit.querySelectorAll?.('[aria-label="Kelat"][role="region"], [aria-label="Reels"][role="region"]') || [];
        for (let i = 0; i < reelRegions.length; i++) {
            const region = reelRegions[i];
            const localHeading = getCompactLowerText(region).slice(0, 500);
            if (countReelLinks(region) >= 1 || localHeading === 'reels' || localHeading === 'kelat' || /\b(reels|kelat)\b/.test(localHeading)) {
                return true;
            }
        }

        // Heading-only shelves: require the heading itself to be exactly Reels/Kelat.
        // This avoids killing a normal post whose text merely says "reels".
        const headings = unit.querySelectorAll ? unit.querySelectorAll('h2, h3, h4, [role="heading"]') : [];
        for (let i = 0; i < headings.length; i++) {
            const heading = headings[i];
            if (!heading || heading.closest?.('[role="button"], [role="link"], [role="navigation"], [role="banner"]')) continue;
            const headingText = getCompactLowerText(heading);
            if (headingText === 'reels' || headingText === 'kelat') return true;
        }

        // Fallback: a horizontal shelf with multiple reel cards is a carousel.
        // A single /reel/ permalink is treated as a normal post/status and allowed.
        if (countReelLinks(unit) >= 2) {
            const carouselish = unit.querySelector?.('[aria-orientation="horizontal"], [role="list"], [data-pagelet*="Reels" i], [aria-label*="Reels" i], [aria-label*="Kelat" i]');
            if (carouselish) return true;
        }

        return false;
    } catch (e) {
        return false;
    }
};

// ===== v44: AI-info post rejection =====
// Captured Facebook markup exposes the disclosure as an exact role=button label:
// "Tekoälytiedot". Match only exact button/ARIA/title labels so ordinary discussion
// about AI, computers, games, or generated-content policy is not collateral damage.
const FB_AI_INFO_BUTTON_LABELS = new Set([
    'tekoälytiedot',
    'ai info',
    'ai information'
]);

const postHasAIInfoTag = (seed) => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return false;
        const post = getFBFeedUnitWrapper(seed) || seed;
        if (!post || !post.querySelectorAll) return false;
        if (isNotificationPanelElement(post) || isFBCommentSurfaceElement(post) || isInsideComment(post)) return false;

        const buttons = post.querySelectorAll('[role="button"], button');
        for (let i = 0; i < buttons.length && i < 180; i++) {
            const button = buttons[i];
            if (!button || isInsideComment(button) || isNotificationPanelElement(button)) continue;

            const labels = [
                button.textContent || button.innerText || '',
                button.getAttribute?.('aria-label') || '',
                button.getAttribute?.('title') || ''
            ];

            for (let j = 0; j < labels.length; j++) {
                const label = fbNotifNorm(labels[j]);
                if (FB_AI_INFO_BUTTON_LABELS.has(label)) return true;
            }
        }
    } catch (e) {}
    return false;
};

const hasRestrictedFeedCTAOrReels = (seed) => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return false;
        const unit = getFBFeedUnitWrapper(seed) || seed;
        if (!unit || !isProbablyHomeFeedUnit(unit)) return false;

        if (postHasAIInfoTag(unit)) return true;

        // v38: only real mid-feed Reels/Kelat carousels are removed.
        // Normal posts/statuses that Facebook links as /reel/ are allowed through.
        if (isFBMidFeedReelsCarousel(unit)) return true;

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
            const txt = getCompactLowerText(btn);
            if (FB_RESTRICTED_FEED_CTA_TEXT.has(txt)) return true;

            // Extra structural path from uploaded snippets: exact inline text span inside the button.
            const labelSpan = btn.querySelector?.('span.x1fey0fg, span.x193iq5w');
            if (labelSpan) {
                const label = getCompactLowerText(labelSpan);
                if (FB_RESTRICTED_FEED_CTA_TEXT.has(label)) return true;
            }
        }

        return false;
    } catch (e) {
        return false;
    }
};

const markFBFeedUnitApproved = (seed) => {
    try {
        const unit = getFBFeedUnitWrapper(seed) || seed;
        if (!unit || !unit.classList) return;
        releaseFBFeedSlot(unit);
        unit.classList.add('fb-feed-unit-approved', 'fb-post-approved');
        unit.classList.remove('fb-post-banned', 'fb-element-banned', 'fb-group-suggestions-banned', 'fb-post-screening-v47');
        unit.querySelectorAll?.('[role="article"]').forEach(article => {
            try { article.classList.add('fb-post-approved'); } catch (e) {}
        });
    } catch (e) {}
};

const hideFBFeedUnitHard = (seed, reason = 'restricted feed unit') => {
    try {
        const unit = getFBFeedUnitWrapper(seed) || seed;
        if (!unit || !unit.style) return false;
        unit.classList.remove('fb-feed-unit-approved', 'fb-post-approved', 'fb-post-screening-v47');
        unit.querySelectorAll?.('[role="article"]').forEach(article => {
            try { article.classList.remove('fb-post-approved'); } catch (e) {}
        });
        hideElementHard(unit, 'fb-post-banned');
        collapseFBFeedSlot(unit);
        devLog(`🚫 Feed unit hidden by v23: ${reason}`);
        return true;
    } catch (e) {
        return false;
    }
};

const scrubRestrictedFeedUnits = () => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return;
        updateFBHomeFeedGateClass();
        if (!isFBHomeFeedSurface()) return;

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
                    const unit = getFBFeedUnitWrapper(candidate) || candidate;
                    if (!unit || seen.has(unit)) return;
                    seen.add(unit);
                    if (unit.classList?.contains('fb-post-banned') || unit.classList?.contains('fb-element-banned')) return;
                    if (unit.getAttribute?.('data-fb-v25-scan-complete') === '1' && unit.classList?.contains('fb-post-approved')) return;
                    if (applyCachedFBFeedUnitRestrictionDecision(unit)) return;
                    if (hasRestrictedFeedCTAOrReels(unit)) {
                        rememberFBElementDecision(unit, 'feed-unit-restriction', 'banned', 'AI-info tag, Liity/Join, Seuraa/Follow, or verified mid-feed Reels carousel');
                        if (hideFBFeedUnitHard(unit, 'AI-info tag, Liity/Join, Seuraa/Follow, or verified mid-feed Reels carousel')) hidden++;
                    } else {
                        rememberFBElementDecision(unit, 'feed-unit-restriction', 'approved');
                    }
                });
            } catch (e) {}
        });

        if (hidden > 0) devLog(`v23 scrubbed ${hidden} restricted home-feed unit(s)`);
    } catch (e) {
        console.log('Error scrubbing restricted feed units v23: ' + e.message);
    }
};

// v25.4.23: hide the "Ryhmäehdotuksesi" / group suggestions carousel as a whole feed card.
const hideGroupSuggestionsOnFeed = () => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return;
        if (!isFBHomeFeedSurface()) return;
        const candidates = document.querySelectorAll([
            '[role="feed"] [role="article"]',
            'div[data-pagelet^="FeedUnit_"]',
            'div[data-pagelet^="TimelineFeedUnit_"]'
        ].join(','));

        candidates.forEach((card) => {
            try {
                if (!card || card.classList.contains('fb-element-banned') || card.classList.contains('fb-group-suggestions-banned')) return;
                if (card.getAttribute?.('data-fb-v25-scan-complete') === '1' && card.classList.contains('fb-post-approved')) return;
                const text = normalizeFBText(card.textContent || card.innerText || '');
                const hasGroupSuggestionText =
                    text.includes('ryhmäehdotuksesi') ||
                    text.includes('group suggestions') ||
                    text.includes('suggested groups');
                const hasGroupJoinControls = !!(card.querySelector && card.querySelector('[aria-label="Liity ryhmään"], [aria-label="Join group"], a[href*="/groups/"]'));
                const hasSuggestedGroupRemove = !!(card.querySelector && card.querySelector('[aria-label*="Poista ehdotettu ryhmä"], [aria-label*="Remove suggested group"]'));
                if (hasGroupSuggestionText || (hasGroupJoinControls && hasSuggestedGroupRemove)) {
                    const unit = getFBFeedUnitWrapper(card) || card.closest('[role="article"]') || card;
                    hideElementHard(unit, 'fb-group-suggestions-banned');
                }
            } catch (e) {}
        });
    } catch (e) {
        console.log('Error hiding group suggestions feed card: ' + e.message);
    }
};

// --- ARRAYS AND CONFIGURATION ---
const paramsToDelete = ["set", "type"];    // ===== ACCOUNT-SCOPED STRICT FILTERS =====
// FBID/person filtering is only active for explicitly supported logged-in accounts.
const SUPPORTED_FBID_LIST = [
    '100005050653554'
];

const getLoggedInFacebookAccountFbid = () =>
    getCachedLoggedInFacebookAccountFbid(250000);

const isStrictAccountEnabled = () => {
    try {
        const accountFbid = getLoggedInFacebookAccountFbid();

        // Personal scrubbers are Haukkis-only.
        // If Facebook has not exposed the logged-in account ID yet, fail open/off.
        // Dad's account must not inherit the isolated/contact/profile filters.
        if (!accountFbid) return false;

        return SUPPORTED_FBID_LIST.includes(accountFbid);
    } catch (e) {
        return false;
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
	'100002140178481',
	'8062936260404271',
	'2717246041744548',
	'100084859553388',
	'100079684276475',
	'100007491272181',
	'100000404984016',
	'100046099231198',
	'1738029402',
	'779432839',
	'1139183121',
	'610250511',
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
	'292715294181170',
	'505428986169752',
	'100002030632206',
	'100000873315103',
	'100027515703287',
	'100005784843977',
	'100002556506206',
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


initializeFBIsolatedProfileIds(isolatedFbids);

// ===== v57: lean paint-time identity hide =====
// Exact identity shells are decided by the document-start MutationObserver before paint.
// Keep CSS intentionally tiny: large generated FBID/:has() selector sets made Facebook's
// constantly mutating DOM much more expensive to style and could overlap native dialogs.
let __fbEmbeddedChatIdentityCSSInstalledV56 = false;
const installFBEmbeddedChatAndIdentityCSSV56 = () => {
    try {
        let style = document.getElementById('fb-embedded-chat-identity-style-v56');
        if (!style) {
            style = document.createElement('style');
            style.id = 'fb-embedded-chat-identity-style-v56';
        }
        style.textContent = `
            html.fb-isolated-identity-prehide-v56 [data-fb-isolated-identity-hide-v56="1"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                width: 0 !important;
                min-width: 0 !important;
                max-width: 0 !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                overflow: hidden !important;
                content-visibility: hidden !important;
                contain: strict !important;
                transition: none !important;
                animation: none !important;
            }
        `;
        if (!style.isConnected) (document.head || document.documentElement)?.appendChild(style);
        document.documentElement?.classList.toggle('fb-isolated-identity-prehide-v56', isFBStrictElementAccount());
        __fbEmbeddedChatIdentityCSSInstalledV56 = true;
    } catch (e) {
        __fbEmbeddedChatIdentityCSSInstalledV56 = false;
    }
};

installFBEmbeddedChatAndIdentityCSSV56();

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
    /Riituska%20/,
    /Rupaska%20/,
    /Laura%20Karhu/,
    /Mira%20Immonen/,
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
const fbNativeTopSearchSafeSelectors = [
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
    ...fbNativeTopSearchSafeSelectors,
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
	/gareta/i, /\bkati\b/i, /juutilainen/i, /harjula/i, /taisto/i, /riituska/i, /rupaska/i,
];

const globalRegex = [
// Classic Regexes (Might cause Meta to push more AI slop onto us)
	/lex bl/i, /AI-/i, /-AI/i, /AI-suck/i, /Ripl/i, /Shira/i, /Steph's place/i, /Stephanie's place/i, /Steph McMahon/i, /Stepan/i, /Stratu/i, /Stratt/i, /Gina Adam/i, /lantaaa/i, /lantaai/i, /Sherilyn/i, /Tiffa/i,
	/Tiffy/i, /Dreambooth/i, /Dream booth/i, /Dualipa/i, /Dua Lipa/i, /Meta AI/i, /Tatu Toiviainen/i, /IInspiration/i, /IIconics/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i,
	/barlow/i, /Nikki/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i,
	/Alicy/i, /Alici/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /AIblow/i, /5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, /AI-suck/i, /drool/i,
	/RemovingAI/i, /blowjob/i, /bjob/i, /b-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /dr00l/i, /Rhea Ripley/i, /Roxanne/i, /Lauren/i, /Liv Morgan/i, /Alexa Bliss/i, /Cathy/i, /Kelley/i, /Cathy Kelley/i,
	/\bMarie\b/i, /Juliette/i, /Artificial/i, /Artificial Intelligence/i, /Powered by AI/i, /AI made/i, /AI creation/i, /IYO SKY/i, /AI creative/i, /AI created/i, /Tekoäly/i, /Teko äly/i, /Teko-äly/i, /Teko_äly/i,
	/gener/i, /generoiva/i, /generoitu/i, /generated/i, /generative/i, /AI create/i, /generation/i, /seksi/i, /anaali/i, /pillu/i, /pimppi/i, /kyrpä/i, /kulli/i, /sexual/i, /sensuel/i, /seksuaali/i, /Kairi's/i,
    	/Alexa Bliss/i, /Alexa WWE/i, /5 feet of fury/i, /five feet of fury/i, /Tiffy time/i, /Mercedes/i, /Samantha/i, /La Leona/i, /livmorgan/i, /Mariah May/i, /Mandy Rose/i, /Chelsea Green/i, /liv morgan/i, /sexual/i,
    	/Sportskeeda/i, /Vince Russo/i, /Samantha Irvin/i, /Brave Software/i, /Shirakawa/i, /Nikkita/i, /All Elite Wrestling/i, /Dynamite/i, /Rampage/i, /AEW Collision/i, /Blackheart/i, /Charlotte/i, /Becky Lynch/i,
    	/Samantha Irwin/i, /Serena Deeb/i, /Mia Yim/i, /AJ Lee/i, /Stephanie/i, /Liv Morgan/i, /Piper Niven/i, /Jordynne Grace/i, /Jordynne/i, /Carr WWE/i, /Iyo Shirai/i, /Izzi Dame/i, /Iyo Sky/i, /Playboy/i, /goddess/i,
    	/Izzi WWE/i, /Nick Jackson/i, /NXT Womens/i, /NXT Women/i, /NXT Woman/i, /Jackson/i, /DeepSeek/i, /DeepSeek AI/i, /Rhea Ripley/i, /Instagram/i, /Jakara/i, /Lash Legend/i, /Alba Fyre/i, /Isla Dawn/i, /CJ Perry/i,
	/Lana WWE/i, /Raquel Rodriguez/i, /Zelina Vega/i, /Alicia Fox/i, /Willow Nightingale/i, /Kris Statlander/i, /Kayden Carter/i, /Katana Chance/i, /Izzi Dame/i, /Dame WWE/i, /Indi Hartwell/i, /Blair Davenport/i,
	/Lola Vice/i, /\bValhalla\b/i, /Maxxine Dupri/i, /Karmen Petrovic/i, /Ava Raine/i, /Cora Jade/i, /Jacy Jayne/i, /Gigi Dolin/i, /Io Sky/i, /Shirai/i, /Scarlett/i, /Thea Hail/i, /Tatum Paxley/i, /Dakota Kai/i,
	/Kelani Jordan/i, /Electra Lopez/i, /Wendy Choo/i, /Yulisa Leon/i, /Valentina/i, /Amari Miller/i, /Young Bucks/i, /Torrie Wilson/i, /Ripley!/i, /Monroe/i, /Arianna Grace/i, /Zelina/i, /Natalya/i, /Sexy/i,
	/Kairi Sane/i, /Satomura/i, /Candice/i, /Nia Jax/i, /\bNaomi\b/i, /Roxanne/i, /Xia Li/i, /Shayna/i, /Baszler/i, /Rousey/i, /Velvet Sky/i, /Carmella/i, /Dana Brooke/i, /Martinez/i, /Marina/i, /goddess/i,
	/Sasha Banks/i, /Valkyria/i, /arabra/i, /Primera/i, /Summer Rae/i, /Michelle McCool/i, /Eve Torres/i, /Kelly Kelly/i, /Tatu Toiviainen/i, /Jessika Carr/i, /Jessica Karr/i, /Venice/i, /Jessica Carr/i,
    	/Jessica WWE/i, /Matt Jackson/i, /Karr WWE/i, /Melina wrestler/i, /bKanellis/i, /Beth Phoenix/i, /Kaipio/i, /Victoria/i, /Jazz WWE/i, /Molly Holly/i, /Priscilla/i, /Red Velvet/i, /Meta AI/i, /sasha/i,
    	/Awesome Kong/i, /Madison Rayne/i, /Angelina/i, /Tessmacher/i, /Su Yung/i, /woman/i, /women/i,  /Taya Valkyrie/i, /Bianca Belair/i, /Skye Blue/i, /Bordeaux/i, /Brooke/i, /Purrazzo/i, /Toni Storm/i,
    	/Jamie Hayter/i, /Anna Jay/i, /Hikaru/i, /Sakazaki/i, /Nyla Rose/i, /Sakura/i, /Penelope Ford/i, /Julia Hart/i, /Kamifuku/i, /Elayna/i, /Juliette/i, /Juliana/i, /Julianna/i, /Henley/i, /Saya Kamitani/i,
    	/AJ Lee's/i, /Nikkita Lyons/i, /Lisa Varon/i, /Marie Varon/i, /Irving/i, /Belts Mone/i, /Amanda Huber/i, /Megan Bayne/i, /Wren Sinclair/i, /Bella Twins/i, /Britt Baker/i,  /Kairii/i, /Sexxy/i, /Xia Li/i,
	/Sexx/i, /Sexi/i, /Monroe/i, /Girlfriend/i, /Girl's/i, /Women's/i, /Woman's/i, /Lady's/i, /Ladies'/i, /Toni Harsunen/i, /Wikman/i, /Vikman/i, /Jaida Parker/i, /suositukset/i, /ehdotukset/i, /Kamitani/i, 
	/Artificial Intelligence/i, /20\. heinäkuu klo/i, /Sisältö ei ole käytettävissä tällä hetkellä/i, /sinulle ehdotettu/i, /kendal.*(grey|gray)/i, /leila.*(grey|gray)/i, /Jessika WWE/i, /Fallon Henley/i,
	/Kiana/i, /Kiana James/i, /QTCinderella/i, /KaliArmstrong/i, /Kali Armstrong/i, /#KaliArmstrong/i, /#Kali/i, /Gail Kim/i, /Eerika/i, /Mira Immo/i,

// Boundaried regexes (separated for clarity)
	/\bVaughn\b/i, /\bEvelyn\b/i,
	/\bSol\b/i, /\bShe\b/i, /\bHer\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bRiho\b/i, /\bCum\b/i, /\bSlut\b/i, /\bTor\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /\bAlexa\b/i, /\bTay\b/i, /\bMelo\b/i,
	/\bConti\b/i, /\bPaige\b/i, /\bShotzi\b/i, /\bTiffy\b/i, /\bStratton\b/i, /\bAEW\b/i, /\bBy AI\b/i, /\bAis\b/i, /\bIvory\b/i, /\bposing\b/i, /\bSasha\b/i, /\bAnal\b/i, /\bBliss\b/i, /\bKara\b/i, /\bGay\b/i,
	/\bTransvestite\b/i, /\bTransu\b/i, /\bPride\b/i, /\bLesbian\b/i, /\bLesbo\b/i, /\bHomo\b/i, /\bQueer\b/i, /\bSable\b/i, /\bBella\b/i, /\bNikki\b/i, /\bTegan\b/i, /\bGoddess\b/i, /\bLita\b/i, /\bRusso\b/i,
	/\bLGBT\b/i, /\bLGBTQ\b/i, /\bMami\b/i, /\bTrish\b/i, /\bStratus\b/i, /\bGiulia\b/i, /\bMichin\b/i, /\bJayne\b/i, /\bLLM\b/i, /\bMLM\b/i, /\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /\bODB\b/i, /\bChyna\b/i,
	/\bSaraya\b/i, /\bBrooke\b/i, /\bCora\b/i, /\bGin4\b/i, /\bG1n4\b/i, /\bKara\b/i, /\bTessa\b/i, /\bRuca\b/i, /\bRuby\b/i, /\bSoho\b/i, /\bTrans\b/i, /\bposed\b/i, /\bLayla\b/i, /\bLana\b/i, /\bJacy\b/i,
	/\bBrie\b/i, /\bYung\b/i, /\bHavok\b/i, /\bJade\b/i, /\bAthena\b/i, /\bFuku\b/i, /\bGina\b/i, /\bSex\b/i, /\bAI\b/i, /\bKairi\b/i, /\bKiana\b/i, /\bGirl\b/i, /\bGirls\b/i, /\bWoman\b/i, /\bWomen\b/i,
	/\bWomens\b/i, /\bWomans\b/i, /\bLady\b/i, /\bLadies\b/i, /\bLadys\b/i, /\bMarie\b/i, /\bKairi\b/i, /\bAsuka\b/i, /\bB-Fab\b/i, /\b#\b/i, /\bTiffany\b/i, /\bStratton\b/i, /\bPerez\b/i, /\bPerze\b/i,
	/\bHavok\b/i, /\bJillian\b/i, /\bMickie\b/i, /\bFlair\b/i, /\bMeltzer\b/i, /\bLayla\b/i, /\bBlake\b/i, /\bRipley\b/i, /\bKatie\b/i, /\bShafir\b/i, /\bStacy\b/i, /\bKeibler\b/i, /\bMaryse\b/i, /\bTrish\b/i,
	/\bSarray\b/i, /\bXia\b/i, /\bRonda\b/i, /\bNattie\b/i, /\bBayley\b/i, /\bGiulia\b/i, /\bFallon\b/i, /\bMichin\b/i, /\bStratus\b/i, /\bKelly\b/i, /\bKarr\b/i, /\bFallon\b/i, /\bDeonna\b/i, /\bThekla\b/i,
	/\bErika\b/i, /\bLeRae\b/i, /\bTamina\b/i, 
];

// v32: Dynamic wrestler names from wrestling.js/background storage.
// Facebook did not previously consume wrestling_women_urls, so names only present in
// SmackDownHotel dynamic storage were invisible to FB search/feed filtering.
const FB_DYNAMIC_WRESTLER_FALLBACK_URLS = [
    // v36: local fallback mirrors the important SmackDownHotel manual bans so FB search
    // still has useful wrestler-name coverage before extension storage arrives.
    '/wrestlers/pj-vasa',
    '/wrestlers/lainey-reid', '/wrestlers/kellyanne', '/wrestlers/kellyanne-english',
    '/wrestlers/nikita-naridian', '/wrestlers/riho', '/wrestlers/thekla',
    '/wrestlers/dani-sekelsky', '/wrestlers/kelly-kelly', '/wrestlers/alba-fyre',
    '/roster/wwe2k26/alundra-blayze', '/wrestlers/roxxi', '/wrestlers/zelina-vega',
    '/wrestlers/rosita', '/wrestlers/lita', '/wrestlers/chyna', '/wrestlers/maryse',
    '/wrestlers/aksana', '/wrestlers/kaitlyn', '/wrestlers/layla', '/wrestlers/tamina',
    '/wrestlers/jacqueline', '/wrestlers/odb', '/wrestlers/asya',
    '/wrestlers/debra', '/wrestlers/lana', '/wrestlers/sable', '/wrestlers/tori',
    '/wrestlers/carmella', '/wrestlers/raquel', '/wrestlers/kamille', '/wrestlers/maxine',
    '/wrestlers/cherry', '/wrestlers/sarita', '/wrestlers/shaniqua', '/wrestlers/francine',
    '/wrestlers/trinity', '/wrestlers/ivy-nile', '/wrestlers/mia-yim',
    '/wrestlers/gail-kim', '/wrestlers/eve-torres', '/wrestlers/dawn-marie', '/wrestlers/joy-giovanni',
    '/wrestlers/cora-jade', '/wrestlers/taya-valkyrie', '/wrestlers/brie-bella', '/wrestlers/su-yung'
];
let fbDynamicWrestlerRegexes = [];
let fbDynamicWrestlerRegexSources = new Set();
let fbDynamicWrestlerVersion = 0;

const buildFBWrestlerRegexes = (urls) => {
    try {
        const escapeRegexLiteral = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const makeFlexibleNamePattern = (name) => String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(escapeRegexLiteral)
            .join('[\\s_\\-]+');
        const visibleLetterCount = (name) => String(name || '').replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]/g, '').length;
        const localExclusions = new Set(['melina', 'aj']);

        const combinedUrls = Array.from(new Set([
            ...FB_DYNAMIC_WRESTLER_FALLBACK_URLS,
            ...((Array.isArray(urls) ? urls : []))
        ].filter(Boolean)));

        const next = [];
        const nextSources = new Set();
        combinedUrls.forEach(url => {
            try {
                const raw = String(url || '').trim();
                if (!raw) return;
                const parts = raw.split('/').filter(Boolean);
                const slug = String(parts[parts.length - 1] || '').toLowerCase();
                if (!slug || localExclusions.has(slug)) return;
                const name = slug.replace(/-/g, ' ').trim();
                const namePattern = makeFlexibleNamePattern(name);
                if (!namePattern) return;
                const shouldBoundary = visibleLetterCount(name) <= 5;
                const source = shouldBoundary ? ('\\b' + namePattern + '\\b') : namePattern;
                if (nextSources.has(source)) return;
                nextSources.add(source);
                next.push(new RegExp(source, 'i'));
            } catch (e) {}
        });

        fbDynamicWrestlerRegexes = next;
        fbDynamicWrestlerRegexSources = nextSources;
        fbDynamicWrestlerVersion++;
        return true;
    } catch (e) {
        return false;
    }
};

const clearFBSearchProcessedCache = () => {
    try {
        document.querySelectorAll('.fb-search-processed,[data-processed-text]').forEach(node => {
            try {
                node.classList.remove('fb-search-processed');
                node.removeAttribute('data-processed-text');
                node.removeAttribute('data-processed-key-v32');
            } catch (e) {}
        });
    } catch (e) {}
};

const applyFBDynamicWrestlerBans = (urls) => {
    try {
        buildFBWrestlerRegexes(urls);
        refreshAccountScopedFilters();
        clearFBSearchProcessedCache();

        // These scanners are declared later in the file as consts, so touching them too early can
        // hit the TDZ. Defer one tick; if the script is still initializing, the try/catch keeps it safe.
        addTimeout(() => {
            // Storage refreshes may arrive while the full Messenger app is open.
            // Update the lists, but never wake content/profile scanners on that surface.
            if (isFBMessengerPath(window.location.href)) return;
            try { processSearchResults(); } catch (e) {}
            try { if (!updateFBCommentOverlayClass() && !isFBNoPostScanUrl(window.location.href)) scanAndBanEntirePosts(); } catch (e) {}
            try { if (!updateFBCommentOverlayClass()) scanAndBanProfileCards(); } catch (e) {}
        }, 0);
    } catch (e) {}
};

// Fallback is active immediately; storage strengthens it when available.
buildFBWrestlerRegexes([]);

let regexBlockedWords = [];
let __fbLastStrictScope = null;
let __fbLastWrestlerVersion = -1;
const refreshAccountScopedFilters = () => {
    try {
        const nextStrictScope = isStrictAccountEnabled();
        if (__fbLastStrictScope === nextStrictScope && __fbLastWrestlerVersion === fbDynamicWrestlerVersion) {
            __fbStrictAccountEnabled = nextStrictScope;
            return nextStrictScope;
        }
        __fbLastStrictScope = nextStrictScope;
        __fbLastWrestlerVersion = fbDynamicWrestlerVersion;
        __fbStrictAccountEnabled = nextStrictScope;
        __fbElementHidingAccountEnabled = __fbStrictAccountEnabled;
        try {
            if (document.documentElement) {
                const messengerNative = isFBMessengerPath(window.location.href);
                document.documentElement.classList.toggle('fb-messenger-native-v54', messengerNative);
                document.documentElement.classList.toggle('fb-strict-element-hiding-v37', __fbElementHidingAccountEnabled && !messengerNative);
                document.documentElement.classList.toggle('fb-isolated-identity-prehide-v56', __fbElementHidingAccountEnabled);
            }
        } catch (e) {}
        blockedFbids = __fbStrictAccountEnabled ? isolatedFbids : [];
        const baseRegexWords = __fbStrictAccountEnabled ? globalRegex.concat(isolatedRegex) : globalRegex;
        regexBlockedWords = baseRegexWords.concat(fbDynamicWrestlerRegexes);
        return __fbStrictAccountEnabled;
    } catch (e) {
        __fbStrictAccountEnabled = false;
        __fbElementHidingAccountEnabled = false;
        try { document.documentElement?.classList.remove('fb-strict-element-hiding-v37'); } catch (e) {}
        blockedFbids = [];
        regexBlockedWords = globalRegex.concat(fbDynamicWrestlerRegexes);
    }
};
refreshAccountScopedFilters();

// v36: consume SmackDownHotel dynamic bans from both Chromium and Firefox-style
// extension storage APIs. The old FB side only read chrome.storage.local, so Firefox/Android
// or timing weirdness could leave FB search running on the static regex list only.
const consumeFBWrestlingStoragePayload = (payload) => {
    try {
        const urls = payload && Array.isArray(payload.wrestling_women_urls) ? payload.wrestling_women_urls : [];
        applyFBDynamicWrestlerBans(urls);
    } catch (e) {}
};

try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['wrestling_women_urls'], consumeFBWrestlingStoragePayload);
        if (chrome.storage.onChanged && !window.__fbWrestlingChromeStorageListenerV36Installed) {
            window.__fbWrestlingChromeStorageListenerV36Installed = true;
            chrome.storage.onChanged.addListener((changes, areaName) => {
                try {
                    if (areaName !== 'local' || !changes.wrestling_women_urls) return;
                    applyFBDynamicWrestlerBans(Array.isArray(changes.wrestling_women_urls.newValue) ? changes.wrestling_women_urls.newValue : []);
                } catch (e) {}
            });
        }
    }
} catch (e) {}

try {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get(['wrestling_women_urls'])
            .then(consumeFBWrestlingStoragePayload)
            .catch(() => {});
        if (browser.storage.onChanged && !window.__fbWrestlingBrowserStorageListenerV36Installed) {
            window.__fbWrestlingBrowserStorageListenerV36Installed = true;
            browser.storage.onChanged.addListener((changes, areaName) => {
                try {
                    if (areaName !== 'local' || !changes.wrestling_women_urls) return;
                    applyFBDynamicWrestlerBans(Array.isArray(changes.wrestling_women_urls.newValue) ? changes.wrestling_women_urls.newValue : []);
                } catch (e) {}
            });
        }
    }
} catch (e) {}

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
        if (typeof isFBCommentSurfaceElement === 'function' && isFBCommentSurfaceElement(element)) {
            protectFBCommentSurfaces(element.closest?.('[role="dialog"], [role="main"], [role="article"]') || element);
            return;
        }
    } catch (e) {}
    try {
        if (isNotificationPanelElement(element)) {
            protectNotificationSurfaces(element.closest('[role="dialog"], [role="menu"], [role="region"], [role="list"]') || element);
            return;
        }
    } catch (e) {}
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

    // v49: when this exact node is a canonical home-feed unit, also collapse
    // Facebook's one-post virtualization slot that owns the reserved height.
    // The identity check prevents a hidden child/profile row from taking down
    // an otherwise valid post around it.
    try {
        const feedUnit = getFBFeedUnitWrapper(element);
        if (feedUnit === element && element.closest?.('[role="feed"]')) {
            collapseFBFeedSlot(element);
        }
    } catch (e) {}
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

const isFBNativeTopSearchSafeIsland = (element) => {
    try {
        if (!element || !element.closest) return false;

        // Never let this helper immunize real search result pages or feed content.
        if (isFBSearchPagePath && isFBSearchPagePath()) return false;
        if (element.closest('[role="main"]') && !element.closest('[role="banner"]')) return false;

        if (matchesClosestSelectorSafe(element, fbNativeTopSearchSafeSelectors)) return true;

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
        if (isFBInsideEmbeddedChatSurfaceV56(element)) return true;
        if (isNotificationPanelElement(element)) return true;
        if (isFBNativeTopSearchSafeIsland(element)) return true;
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

const isTopLeftSearchDropdownElement = (element) => isFBNativeTopSearchSafeIsland(element) || !!getFBTopSearchDropdownContainer(element);

// ===== FACEBOOK NATIVE TOP-LEFT SEARCH SAFE ISLAND v16 =====
// This intentionally copies the stable 25.1.5 philosophy instead of trying to micro-manage the dropdown:
// - filter real /search/ result pages;
// - do not scan, approve, restyle, repair, or hard-hide the native header search dropdown;
// - keep scanners/CSS alive; only treat the native dropdown itself as a safe Facebook-owned surface.
let __fbNativeTopSearchActiveUntil = 0;

const markFBNativeTopSearchActive = () => {
    try {
        if (isFBMessengerPath(window.location.href)) return;
        __fbNativeTopSearchActiveUntil = Math.max(__fbNativeTopSearchActiveUntil, performance.now() + 3000);
        refreshFBNativeTopSearchHandoff();
        addTimeout(refreshFBNativeTopSearchHandoff, 400);
        addTimeout(refreshFBNativeTopSearchHandoff, 1200);
        addTimeout(refreshFBNativeTopSearchHandoff, 3200);
    } catch (e) {}
};

const fbNativeTopSearchDropdownExists = () => {
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

const activeElementIsNativeTopSearch = () => {
    try {
        const el = document.activeElement;
        if (!el || !el.closest) return false;
        if (el === document.body || el === document.documentElement) return false;
        return !!(
            el.closest('input[placeholder*="Hae Facebookista" i], input[placeholder*="Search Facebook" i], [role="searchbox"], [role="combobox"]') ||
            el.closest('[role="banner"] form[role="search"], [role="banner"] div[role="search"]') ||
            isTopLeftSearchDropdownElement(el)
        );
    } catch (e) {
        return false;
    }
};

const isFBNativeTopSearchActive = () => {
    try {
        if (isFBSearchPagePath()) return false;
        if (performance.now() < __fbNativeTopSearchActiveUntil) return true;
        if (activeElementIsNativeTopSearch()) return true;
        // v53: focus/pointer/input listeners and the mutation router mark this surface when
        // it opens. Do not run a document-wide pack of :has() selectors on every filter tick
        // merely to prove that the dropdown is absent.
    } catch (e) {}
    return false;
};

const setFBInlineStylePausedForNativeSearch = (_active) => {
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

const refreshFBNativeTopSearchHandoff = () => {
    try {
        if (isFBMessengerPath(window.location.href)) {
            document.documentElement?.classList.remove('fb-native-top-search-handoff-v15');
            return false;
        }
        const active = isFBNativeTopSearchActive();
        if (document.documentElement) {
            document.documentElement.classList.toggle('fb-native-top-search-handoff-v15', active);
        }
        setFBInlineStylePausedForNativeSearch(active);
        return active;
    } catch (e) {
        return false;
    }
};

const installFBNativeTopSearchHandoff = () => {
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

        const removeFBCleanerHardHideFromNativeDropdownNode = (el) => {
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

        const repairFBTopSearchDropdownOnce = () => {
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
                        if (row) removeFBCleanerHardHideFromNativeDropdownNode(row);
                        removeFBCleanerHardHideFromNativeDropdownNode(el);
                    } catch (e) {}
                });
            } catch (e) {}
        };

        const schedulePassiveNativeDropdownRepair = () => {
            // v16: intentionally no-op.
            // The old v15 repair walked every dropdown descendant and removed inline width/height/display,
            // which broke Facebook's native row layout into avatars/black squares. Protection now happens by
            // exempting the native search surface from scanners before they touch it.
            try { refreshFBNativeTopSearchHandoff(); } catch (e) {}
        };

        const maybeNativeSearchInteraction = (event) => {
            try {
                if (isFBMessengerPath(window.location.href)) return;
                const target = event && event.target;
                if (!target || !target.closest) return;
                if (
                    target.closest('input[placeholder*="Hae Facebookista" i], input[placeholder*="Search Facebook" i], [role="searchbox"], [role="combobox"]') ||
                    target.closest('[role="banner"] form[role="search"], [role="banner"] div[role="search"]') ||
                    isTopLeftSearchDropdownElement(target)
                ) {
                    markFBNativeTopSearchActive();
                }
            } catch (e) {}
        };

        onWindowEvent(document, 'focusin', maybeNativeSearchInteraction, true);
        onWindowEvent(document, 'pointerdown', maybeNativeSearchInteraction, true);
        onWindowEvent(document, 'click', maybeNativeSearchInteraction, true);
        onWindowEvent(document, 'input', maybeNativeSearchInteraction, true);
        onWindowEvent(document, 'keydown', maybeNativeSearchInteraction, true);
        onWindowEvent(document, 'focusout', () => {
            if (!isFBMessengerPath(window.location.href)) addTimeout(refreshFBNativeTopSearchHandoff, 250);
        }, true);
        onWindowEvent(document, 'keyup', () => {
            if (!isFBMessengerPath(window.location.href)) addTimeout(refreshFBNativeTopSearchHandoff, 250);
        }, true);
        refreshFBNativeTopSearchHandoff();
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
        if (isNotificationOpenedPostUrl(window.location.href)) return;
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

// ===== v40: native Stories overlay light-lane =====
// URL-only by design: the light-lane must only activate on /stories and sub-URLs.
// Earlier DOM/aria detection was too broad because Facebook can keep Stories widgets
// mounted on normal pages, which made heavy profile/contact scrubbers bail out there.
const isFBStoriesPath = (inputUrl = window.location.href) => {
    try {
        const url = new URL(inputUrl, window.location.origin);
        const path = String(url.pathname || '').toLowerCase().replace(/\/+$/, '');
        return path === '/stories' || path.startsWith('/stories/');
    } catch (e) {
        const raw = String(inputUrl || '').toLowerCase();
        try {
            const match = raw.match(/facebook\.com(\/[^?#]*)/i);
            const path = match && match[1] ? match[1].replace(/\/+$/, '') : '';
            return path === '/stories' || path.startsWith('/stories/');
        } catch (ignored) {
            return raw.includes('facebook.com/stories/');
        }
    }
};

const isFBStoriesNativeSurface = (inputUrl = window.location.href) => {
    try { return isFBStoriesPath(inputUrl); } catch (e) { return false; }
};

const updateFBStoriesNativeClass = () => {
    try {
        const active = isFBStoriesNativeSurface(window.location.href);
        if (document.documentElement) {
            document.documentElement.classList.toggle('fb-stories-native-surface-v40', active);
        }
        return active;
    } catch (e) {
        return false;
    }
};

const runFBStoriesNativeMaintenance = () => {
    try {
        if (!updateFBStoriesNativeClass()) return false;

        // Keep only the cheap/native-safe pieces alive. This preserves nav hiding and native handoffs,
        // but avoids scanning/crawling the whole animated Stories overlay every interval/mutation.
        try { refreshFBNativeTopSearchHandoff(); } catch (e) {}
        try { runFBNativeTransientMenuMaintenance(); } catch (e) {}
        hideCriticalNavOnly();
        return true;
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

const currentFBSearchUrlHasBlockedQuery = (inputUrl = window.location.href) => {
    try {
        const url = new URL(inputUrl, window.location.origin);
        if (!/\/search(?:\/|$)/i.test(url.pathname || '')) return false;

        const qValues = [];
        ['q', 'query', 'keyword'].forEach(param => {
            try {
                const value = url.searchParams.get(param);
                if (value) qValues.push(value);
            } catch (e) {}
        });

        const rawSignal = [
            String(inputUrl || ''),
            url.href,
            url.pathname + url.search,
            ...qValues
        ].join(' ');
        const decodedSignal = safeDecodeFBValue(rawSignal);
        const normalizedSignal = normalizeFBText(decodedSignal);

        return matchesDirectFacebookBlockedUrlForRedirect(url.href) ||
               matchesAnyActiveRegex(normalizedSignal) ||
               matchesBlockedUrlCandidates(decodedSignal) ||
               matchesAnyBlockedFbid(decodedSignal);
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
        if (typeof isInsideFBActiveCommentOverlay === 'function' && isInsideFBActiveCommentOverlay(element)) return true;
        if (typeof isFBCommentSurfaceElement === 'function' && isFBCommentSurfaceElement(element)) return true;
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
            el.classList.remove('fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-post-screening-v47');
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
        if (isFBNoPostScanUrl(currentUrlFull) || isFBCommentUrl(currentUrlFull)) return;
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

// ===== v52: non-allowlisted profile screening veil =====
// Explicitly allowlisted/self/family profile routes remain immediate. Every other profile/page
// route is covered with a lightweight white veil while the existing identity/URL/header filters
// get three clean hydration passes plus one bounded deep identity scan. The veil fails open after a short window.
const FB_PROFILE_SCREENING = {
    routeKey: '',
    completedRouteKey: '',
    startedAt: 0,
    cleanPasses: 0,
    timerPending: false,
    deepScanDone: false
};

const getFBProfileRouteKey = (inputUrl = window.location.href) => {
    try {
        const url = new URL(inputUrl, window.location.origin);
        return `${url.pathname || '/'}${url.search || ''}`;
    } catch (e) {
        return String(inputUrl || '');
    }
};

const isExplicitlyAllowedProfileRoute = (inputUrl = window.location.href) => {
    try {
        if (isFBProfileUrlIsolatedForCurrentAccount(inputUrl)) return false;
        if (isFBTrustedProfileRoute(inputUrl)) return true;
        const url = new URL(inputUrl, window.location.origin);
        return isSafeWhitelistedPath(url.pathname, url.href);
    } catch (e) {
        return isSafeWhitelistedPath('', inputUrl);
    }
};

const shouldScreenCurrentProfile = (inputUrl = window.location.href) => {
    try {
        // Exact supported pages already have the stricter specific-URL no-glimpse lane.
        // Stacking the full-page profile veil on top only creates a second competing gate.
        if (isCurrentSpecificUrlSurface(inputUrl)) return false;
        return isLikelyProfileOrPageRoute(inputUrl) && !isExplicitlyAllowedProfileRoute(inputUrl);
    } catch (e) {
        return false;
    }
};

const ensureFBProfileScreeningOverlay = () => {
    try {
        let overlay = document.getElementById('fb-profile-screening-overlay-v44');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'fb-profile-screening-overlay-v44';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'width:100vw',
                'height:100vh',
                'z-index:2147483647',
                'display:block',
                'visibility:visible',
                'background:#ffffff',
                'background-color:#ffffff',
                'pointer-events:auto',
                'opacity:1',
                'transition:none',
                'animation:none',
                'mix-blend-mode:normal',
                'filter:none',
                'backdrop-filter:none',
                'isolation:isolate',
                'transform:translateZ(0)',
                'backface-visibility:hidden',
                'contain:strict',
                'cursor:progress',
                'overscroll-behavior:contain',
                'color-scheme:light'
            ].join(';') + ';';
            overlay.style.setProperty('background', '#ffffff', 'important');
            overlay.style.setProperty('background-color', '#ffffff', 'important');
            overlay.style.setProperty('opacity', '1', 'important');
            overlay.style.setProperty('visibility', 'visible', 'important');
            overlay.style.setProperty('transition', 'none', 'important');
            overlay.style.setProperty('z-index', '2147483647', 'important');
        }
        if (!overlay.isConnected) (document.documentElement || document.body).appendChild(overlay);
        return overlay;
    } catch (e) {
        return null;
    }
};

const releaseFBProfileScreeningOverlay = () => {
    try {
        const overlay = document.getElementById('fb-profile-screening-overlay-v44');
        if (overlay) overlay.remove();
    } catch (e) {}
};

const isFBProfileIdentityHydrated = () => {
    try {
        if (document.querySelector('[data-pagelet="ProfileHeader"], [data-pagelet="PageHeader"], [data-pagelet="ProfileActions"], [role="main"] h1')) {
            return true;
        }
        const title = fbNotifNorm(document.title || '');
        return !!title && !/^(facebook|log in|kirjaudu|loading|ladataan)(?:\s*[-|].*)?$/.test(title);
    } catch (e) {
        return false;
    }
};

const scheduleFBProfileScreeningPass = (delay = 180) => {
    try {
        if (FB_PROFILE_SCREENING.timerPending) return;
        FB_PROFILE_SCREENING.timerPending = true;
        const expectedRoute = FB_PROFILE_SCREENING.routeKey;
        addTimeout(() => {
            FB_PROFILE_SCREENING.timerPending = false;
            if (expectedRoute !== getFBProfileRouteKey()) {
                updateFBProfileScreening(true);
                return;
            }
            evaluateFBProfileScreening();
        }, delay);
    } catch (e) {}
};

const evaluateFBProfileScreening = () => {
    try {
        const currentUrl = window.location.href;
        const routeKey = getFBProfileRouteKey(currentUrl);

        if (!shouldScreenCurrentProfile(currentUrl)) {
            releaseFBProfileScreeningOverlay();
            return false;
        }

        if (routeKey !== FB_PROFILE_SCREENING.routeKey) {
            FB_PROFILE_SCREENING.routeKey = routeKey;
            FB_PROFILE_SCREENING.completedRouteKey = '';
            FB_PROFILE_SCREENING.startedAt = Date.now();
            FB_PROFILE_SCREENING.cleanPasses = 0;
            FB_PROFILE_SCREENING.deepScanDone = false;
        }

        // Screening is terminal for the current route. Without this guard every normal
        // filter tick recreated the white veil immediately after a successful release.
        if (FB_PROFILE_SCREENING.completedRouteKey === routeKey) {
            releaseFBProfileScreeningOverlay();
            return false;
        }

        ensureFBProfileScreeningOverlay();
        refreshAccountScopedFilters();

        const elapsed = Date.now() - FB_PROFILE_SCREENING.startedAt;
        let deepIdentityBlocked = false;
        if (elapsed >= 450 && !FB_PROFILE_SCREENING.deepScanDone) {
            FB_PROFILE_SCREENING.deepScanDone = true;
            deepIdentityBlocked = fbScopedDocumentHasBlockedIdentity(true);
        }

        const blocked =
            fbValueHasBlockedFbid(currentUrl) ||
            matchesDirectFacebookBlockedUrlForRedirect(currentUrl) ||
            urlPathOrTitleHasBlockedTerms(currentUrl) ||
            fbScopedDocumentHasBlockedIdentity(false) ||
            deepIdentityBlocked ||
            currentProfileOrPageHasBlockedIdentityOrTerms();

        if (blocked) {
            triggerRedirect('blocked profile/page during v44 screened hydration');
            return true;
        }

        if (isFBProfileIdentityHydrated()) {
            FB_PROFILE_SCREENING.cleanPasses++;
        } else {
            FB_PROFILE_SCREENING.cleanPasses = 0;
        }

        if ((FB_PROFILE_SCREENING.cleanPasses >= 3 && elapsed >= 540) || elapsed >= 3000) {
            FB_PROFILE_SCREENING.completedRouteKey = routeKey;
            releaseFBProfileScreeningOverlay();
            return false;
        }

        scheduleFBProfileScreeningPass(180);
        return true;
    } catch (e) {
        try { FB_PROFILE_SCREENING.completedRouteKey = getFBProfileRouteKey(); } catch (ignored) {}
        releaseFBProfileScreeningOverlay();
        return false;
    }
};

const updateFBProfileScreening = (force = false) => {
    try {
        const currentUrl = window.location.href;
        const routeKey = getFBProfileRouteKey(currentUrl);

        if (!shouldScreenCurrentProfile(currentUrl)) {
            FB_PROFILE_SCREENING.routeKey = routeKey;
            FB_PROFILE_SCREENING.completedRouteKey = '';
            FB_PROFILE_SCREENING.startedAt = 0;
            FB_PROFILE_SCREENING.cleanPasses = 0;
            FB_PROFILE_SCREENING.deepScanDone = false;
            releaseFBProfileScreeningOverlay();
            return false;
        }

        if (routeKey !== FB_PROFILE_SCREENING.routeKey) {
            FB_PROFILE_SCREENING.routeKey = routeKey;
            FB_PROFILE_SCREENING.completedRouteKey = '';
            FB_PROFILE_SCREENING.startedAt = Date.now();
            FB_PROFILE_SCREENING.cleanPasses = 0;
            FB_PROFILE_SCREENING.deepScanDone = false;
        }

        if (FB_PROFILE_SCREENING.completedRouteKey === routeKey) {
            releaseFBProfileScreeningOverlay();
            return false;
        }

        ensureFBProfileScreeningOverlay();
        if (force) return evaluateFBProfileScreening();
        scheduleFBProfileScreeningPass(0);
        return true;
    } catch (e) {
        return false;
    }
};

// Initial direct profile load: install the veil synchronously before Facebook paints.
updateFBProfileScreening(true);

const currentMediaOrPostViewHasBlockedCaption = () => {
    try {
        if (!isPostLikeContentUrl(window.location.href)) return false;
        if (isFBNoPostScanUrl(window.location.href) || isFBCommentUrl(window.location.href)) return false;

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
        if (isFBNoPostScanUrl(url.href)) {
            devLog('Notification/notification-opened post surface: redirect logic bypassed');
            return;
        }
        if (isFBCommentUrl(url.href)) {
            devLog('Comment URL surface: redirect logic bypassed');
            return;
        }
        const isHome = url.pathname === '/' || url.pathname === '/home.php';
        if (isHome) return;
        if (lastRedirect === url.href) return;
        if (isSafeWhitelistedPath(url.pathname, url.href)) return;

        // v36: Real /search/ pages should redirect if the query itself is blocked
        // by active regexes/dynamic SDH wrestler names/direct blocked search URLs.
        if (currentFBSearchUrlHasBlockedQuery(url.href)) {
            triggerRedirect('blocked Facebook search URL/query');
            return;
        }

        // 1. Hard current-URL redirects only:
        //    - scoped blocked FBIDs anywhere in the current URL
        //    - blockedUrls only when the current Facebook URL itself is a directly-blocked FB URL
        if (fbValueHasBlockedFbid(url.href) || matchesDirectFacebookBlockedUrlForRedirect(url.href)) {
            triggerRedirect('blocked current URL/direct FB URL');
            return;
        }

        // v50 trusted profile policy: own, Dad, and learned friend profiles are native
        // territory. Haukkis-only isolated identities have already been rejected above.
        if (isFBTrustedProfileRoute(url.href)) return;

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
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(document);
            return;
        }
        if (isFBNoPostScanUrl(window.location.href)) return;
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
            const approvedPost = element.closest?.('.fb-post-approved[data-fb-v25-scan-complete="1"]');
            if (approvedPost && !approvedPost.classList.contains('fb-post-banned') && !approvedPost.classList.contains('fb-element-banned')) return;

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

// v25.4.25: full post scanner with behind-the-scenes Show More expansion.
// Runs on feed AND page/timeline posts, but never inside notifications or comments.
const collectPostTextForScan = (post) => {
    try {
        const chunks = [];
        const push = (value) => {
            if (value !== null && value !== undefined && value !== '') chunks.push(String(value));
        };

        const walker = document.createTreeWalker(post, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                try {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (isInsideComment(parent) || isNotificationPanelElement(parent)) return NodeFilter.FILTER_REJECT;
                    if (parent.closest('[role="banner"], [role="navigation"], [aria-label*="Ilmoitukset" i], [aria-label*="Notifications" i]')) return NodeFilter.FILTER_REJECT;
                    const value = String(node.nodeValue || '').trim();
                    if (!value) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                } catch (e) {
                    return NodeFilter.FILTER_REJECT;
                }
            }
        });

        let node;
        let count = 0;
        let total = 0;
        while ((node = walker.nextNode()) && count < 300 && total < 24000) {
            const value = String(node.nodeValue || '');
            push(value);
            total += value.length;
            count++;
        }

        const attrNodes = post.querySelectorAll([
            'a[href]', 'img[alt]', '[aria-label]', '[title]', '[data-ad-comet-preview="message"]',
            '[data-ad-preview="message"]', '[data-ad-rendering-role="story_message"]', '[data-store]', '[data-ft]'
        ].join(','));

        for (let i = 0; i < attrNodes.length && i < 180; i++) {
            const el = attrNodes[i];
            if (!el || isInsideComment(el) || isNotificationPanelElement(el)) continue;
            push(el.getAttribute && el.getAttribute('aria-label'));
            push(el.getAttribute && el.getAttribute('title'));
            push(el.getAttribute && el.getAttribute('alt'));
            push(el.getAttribute && el.getAttribute('href'));
            push(el.href || '');
            push(el.getAttribute && el.getAttribute('data-store'));
            push(el.getAttribute && el.getAttribute('data-ft'));
        }

        return fbNotifNorm(safeDecodeFBValue(chunks.join(' ')));
    } catch (e) {
        try { return fbNotifNorm(post.innerText || post.textContent || ''); }
        catch (ignored) { return ''; }
    }
};

const isExactPostShowMoreControl = (btn) => {
    try {
        if (!btn || isInsideComment(btn) || isNotificationPanelElement(btn)) return false;
        const text = fbNotifNorm([
            btn.textContent || btn.innerText || '',
            btn.getAttribute && btn.getAttribute('aria-label') || '',
            btn.getAttribute && btn.getAttribute('title') || ''
        ].join(' '));
        if (!/^(näytä lisää|see more|show more)$/.test(text)) return false;
        const realLink = btn.closest && btn.closest('a[href]');
        if (realLink) {
            const href = String(realLink.getAttribute('href') || realLink.href || '').toLowerCase();
            if (href && href !== '#' && !href.startsWith('javascript:')) return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};

const getShowMoreButtonsForPost = (post) => {
    try {
        if (!post || !post.querySelectorAll) return [];
        return Array.from(post.querySelectorAll('[role="button"], button, div[role="button"], span[role="button"]'))
            .filter(btn => post.contains(btn) && isExactPostShowMoreControl(btn));
    } catch (e) {
        return [];
    }
};

// ===== v46 ONE-SHOT POST HYDRATION STATE =====
// A post is either waiting/hydrating, approved, or banned. Normal mutations inside an
// approved post never send it back through the scanner. Only a clearly different stable
// post identity inside a recycled FeedUnit can reopen the state machine.
const __fbPostHydrationState = new WeakMap();

const hasFBNativePostSkeleton = (post) => {
    try {
        return !!post?.querySelector?.('[data-visualcompletion="loading-state"], [role="progressbar"]');
    } catch (e) { return false; }
};

const rememberFBPostScreenHeight = (post) => {
    try {
        if (!post?.style) return;
        // v52: preserve only a one-pixel in-flow lazy-load anchor. Patch 1 measured and kept
        // 220-360px here, which was the empty card visible in the recordings.
        post.style.setProperty('--fb-v47-screen-height', '1px');

        // The visible gap is usually owned by Facebook's outer virtualization slot, not the
        // FeedUnit itself. Collapse that safe one-post wrapper during the one-shot scan.
        const slot = getFBFeedSlotWrapper(post);
        if (slot?.classList && slot.getAttribute?.('role') !== 'feed') {
            slot.classList.add('fb-feed-slot-screening-v51');
            slot.style?.setProperty('--fb-v51-screen-height', '1px');
        }
    } catch (e) {}
};

const getFBStablePostIdentity = (post) => {
    try {
        if (!post?.querySelectorAll) return '';
        const strong = new Set();
        const weak = new Set();
        const addStrong = (prefix, value) => {
            const clean = safeDecodeFBValue(String(value || '')).replace(/[\s"'<>]+$/g, '').trim();
            if (clean) strong.add(`${prefix}:${clean}`);
        };
        const inspectUrl = (value) => {
            const raw = safeDecodeFBValue(String(value || '')).trim();
            if (!raw) return;
            try {
                const url = new URL(raw, location.origin);
                const path = url.pathname || '';
                let match = path.match(/\/groups\/[^/]+\/(?:permalink|posts)\/([^/?#]+)/i);
                if (match?.[1]) addStrong('group-post', match[1]);
                match = path.match(/\/(?:posts|permalink)\/([^/?#]+)/i);
                if (match?.[1]) addStrong('post', match[1]);
                match = path.match(/\/reel\/([^/?#]+)/i);
                if (match?.[1]) addStrong('reel', match[1]);
                match = path.match(/\/videos\/([^/?#]+)/i);
                if (match?.[1]) addStrong('video', match[1]);
                const story = url.searchParams.get('story_fbid');
                if (story) addStrong('post', story);
                const video = url.searchParams.get('v');
                if (video) addStrong('video', video);
                url.searchParams.getAll('multi_permalinks').forEach(value => {
                    safeDecodeFBValue(String(value || '')).split(/[,.]/).map(v => v.trim()).filter(Boolean)
                        .forEach(v => addStrong('post', v));
                });
            } catch (e) {}
        };
        const inspectPacked = (value) => {
            const raw = safeDecodeFBValue(String(value || ''));
            if (!raw) return;
            const pattern = /(?:top_level_post_id|mf_story_key|story_fbid|post_id)[^0-9]{0,20}(\d{8,})/gi;
            let match;
            let count = 0;
            while ((match = pattern.exec(raw)) && count++ < 8) addStrong('post', match[1]);
        };

        const pagelet = post.getAttribute?.('data-pagelet') || '';
        const pageletId = pagelet.match(/(\d{8,})/);
        if (pageletId?.[1]) weak.add('pagelet:' + pageletId[1]);
        inspectPacked(post.getAttribute?.('data-ft'));
        inspectPacked(post.getAttribute?.('data-store'));

        const nodes = post.querySelectorAll('a[href], [data-ft], [data-store]');
        for (let i = 0; i < nodes.length && i < 120 && strong.size < 16; i++) {
            const node = nodes[i];
            // Ignore nested comment/reply articles. Their permalinks are not the FeedUnit identity.
            const ownerArticle = node.closest?.('[role="article"]');
            const parentArticle = ownerArticle?.parentElement?.closest?.('[role="article"]');
            if (parentArticle && post.contains?.(parentArticle)) continue;
            inspectUrl(node.href || node.getAttribute?.('href'));
            inspectPacked(node.getAttribute?.('data-ft'));
            inspectPacked(node.getAttribute?.('data-store'));
        }

        if (strong.size) return 'v55:' + Array.from(strong).sort().slice(0, 16).join('|');
        if (weak.size) return 'weak-v55:' + Array.from(weak).sort().join('|');
        return '';
    } catch (e) { return ''; }
};

const parseFBStablePostIdentityV55 = (value = '') => {
    try {
        const raw = String(value || '');
        if (!raw.startsWith('v55:')) return [];
        return raw.slice(4).split('|').map(v => v.trim()).filter(Boolean);
    } catch (e) { return []; }
};

const getFBIntrinsicStablePostKeysV55 = (post) => {
    const keys = new Set();
    try {
        if (!post) return [];
        const inspectPacked = (value) => {
            const raw = safeDecodeFBValue(String(value || ''));
            if (!raw) return;
            const pattern = /(?:top_level_post_id|mf_story_key|story_fbid|post_id)[^0-9]{0,20}(\d{8,})/gi;
            let match;
            let count = 0;
            while ((match = pattern.exec(raw)) && count++ < 6) keys.add('post:' + match[1]);
        };
        inspectPacked(post.getAttribute?.('data-ft'));
        inspectPacked(post.getAttribute?.('data-store'));

        // Only inspect the canonical top-level article wrappers. Never borrow IDs from quoted
        // posts, comments, recommendations, or other links inside the post body.
        const articles = post.matches?.('[role="article"]')
            ? [post]
            : Array.from(post.querySelectorAll?.('[role="article"]') || []).filter(article => {
                const parentArticle = article.parentElement?.closest?.('[role="article"]');
                return !parentArticle || !post.contains?.(parentArticle);
            }).slice(0, 3);
        articles.forEach(article => {
            inspectPacked(article.getAttribute?.('data-ft'));
            inspectPacked(article.getAttribute?.('data-store'));
        });
    } catch (e) {}
    return Array.from(keys).sort().slice(0, 6);
};

const __fbStablePostDecisionCacheV55 = new Map();
const FB_STABLE_POST_DECISION_TTL_V55 = 6 * 60 * 60 * 1000;
const FB_STABLE_POST_DECISION_LIMIT_V55 = 2400;

const rememberFBStablePostDecisionV55 = (post, decision) => {
    try {
        const keys = getFBIntrinsicStablePostKeysV55(post);
        if (!keys.length || (decision !== 'approved' && decision !== 'banned')) return;
        const now = Date.now();
        keys.forEach(key => __fbStablePostDecisionCacheV55.set(key, { decision, time: now }));
        if (__fbStablePostDecisionCacheV55.size > FB_STABLE_POST_DECISION_LIMIT_V55) {
            const ordered = Array.from(__fbStablePostDecisionCacheV55.entries()).sort((a, b) => a[1].time - b[1].time);
            ordered.slice(0, Math.max(1, ordered.length - FB_STABLE_POST_DECISION_LIMIT_V55)).forEach(([key]) => {
                __fbStablePostDecisionCacheV55.delete(key);
            });
        }
    } catch (e) {}
};

const getFBStablePostDecisionV55 = (post) => {
    try {
        if (!post?.isConnected || hasFBNativePostSkeleton(post)) return null;
        const keys = getFBIntrinsicStablePostKeysV55(post);
        if (!keys.length) return null;
        const now = Date.now();
        let decision = '';
        let hit = false;
        for (const key of keys) {
            const cached = __fbStablePostDecisionCacheV55.get(key);
            if (!cached) continue;
            if (now - cached.time > FB_STABLE_POST_DECISION_TTL_V55) {
                __fbStablePostDecisionCacheV55.delete(key);
                continue;
            }
            if (decision && decision !== cached.decision) return null;
            decision = cached.decision;
            hit = true;
        }
        return hit ? { cacheType: 'post', decision, reason: 'stable post identity v55', time: now } : null;
    } catch (e) { return null; }
};

const reopenFBRecycledPost = (post) => {
    try {
        if (!post?.classList) return false;
        releaseFBFeedSlot(post);
        post.classList.remove('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed');
        post.classList.add('fb-post-screening-v47');
        post.removeAttribute('data-fb-v25-scan-complete');
        post.removeAttribute('data-fb-v25-showmore-clicked');
        post.removeAttribute('data-fb-v46-approved-key');
        post.removeAttribute('data-fb-v47-screen-start');
        post.removeAttribute('data-fb-v31-cache-type');
        post.removeAttribute('data-fb-v31-cache-decision');
        __fbElementDecisionCache.delete(post);
        __fbPostHydrationState.delete(post);
        try { __fbApprovedIdentityMismatchV55.delete(post); } catch (e) {}
        post.querySelectorAll?.('[role="article"]').forEach(article => {
            try { article.classList.remove('fb-post-approved'); } catch (e) {}
        });
        rememberFBPostScreenHeight(post);
        return true;
    } catch (e) { return false; }
};

const __fbApprovedIdentityMismatchV55 = new WeakMap();
const approvedPostIdentityChanged = (post) => {
    try {
        // Background tabs and native loading overlap are not evidence of a recycled post.
        // React can temporarily remove/reinsert permalink nodes while the page is hidden.
        if (document.hidden || hasFBNativePostSkeleton(post)) return false;
        const previous = post?.getAttribute?.('data-fb-v46-approved-key') || '';
        if (!previous) return false;
        const current = getFBStablePostIdentity(post);
        if (!current) return false;

        const previousKeys = parseFBStablePostIdentityV55(previous);
        const currentKeys = parseFBStablePostIdentityV55(current);
        // Upgrade an old v46 hash/weak key in place without revoking approval.
        if (!previousKeys.length || !currentKeys.length) {
            if (currentKeys.length) post.setAttribute?.('data-fb-v46-approved-key', current);
            __fbApprovedIdentityMismatchV55.delete(post);
            return false;
        }

        const previousSet = new Set(previousKeys);
        const overlap = currentKeys.some(key => previousSet.has(key));
        if (overlap) {
            const merged = Array.from(new Set([...previousKeys, ...currentKeys])).sort().slice(0, 16);
            post.setAttribute?.('data-fb-v46-approved-key', 'v55:' + merged.join('|'));
            __fbApprovedIdentityMismatchV55.delete(post);
            return false;
        }

        // A genuine recycled FeedUnit must present the same completely different canonical
        // identity for several visible, non-loading observations. One transient mutation is not enough.
        const now = Date.now();
        const state = __fbApprovedIdentityMismatchV55.get(post);
        if (!state || state.identity !== current || now - state.lastSeen > 1600) {
            __fbApprovedIdentityMismatchV55.set(post, { identity: current, firstSeen: now, lastSeen: now, observations: 1 });
            return false;
        }
        state.lastSeen = now;
        state.observations++;
        if (state.observations < 3 || now - state.firstSeen < 650) return false;
        __fbApprovedIdentityMismatchV55.delete(post);
        return true;
    } catch (e) { return false; }
};

const getFBPostHydrationSignature = (post) => {
    try {
        const textLength = Math.min(20000, String(post?.textContent || '').trim().length);
        const childCount = post?.childElementCount || 0;
        const articleCount = Math.min(12, post?.querySelectorAll?.('[role="article"]').length || 0);
        const linkCount = Math.min(80, post?.querySelectorAll?.('a[href]').length || 0);
        const imageCount = Math.min(40, post?.querySelectorAll?.('img, video').length || 0);
        const showMoreCount = Math.min(6, getShowMoreButtonsForPost(post).length);
        return [childCount, textLength, articleCount, linkCount, imageCount, showMoreCount].join('|');
    } catch (e) { return ''; }
};

const queueFBPostForSingleScan = (seed, delay = 90) => {
    try {
        if (isFBMessengerPath(window.location.href) || isFBInsideEmbeddedChatSurfaceV56(seed) || isFBEmbeddedChatMutationNodeV56(seed)) {
            try { releaseFBEmbeddedChatPostScannerStateV56(seed?.ownerDocument || document); } catch (e) {}
            return;
        }
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(seed?.ownerDocument || document);
            return;
        }
        const post = getFBFeedUnitWrapper(seed) || seed?.closest?.('[role="article"]') || seed;
        if (!post?.isConnected || !post.classList || isFBInsideEmbeddedChatSurfaceV56(post)) return;
        if (isNotificationPanelElement(post) || isInsideComment(post) || isFBCommentSurfaceElement(post)) return;
        if (post.closest?.('[role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"]')) return;
        if (isFBSearchPagePath() && post.closest?.('[role="main"]')) return;
        if (isProfileHeaderProtectedArea(post) || isTopLeftSearchDropdownElement(post)) return;
        if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) return;

        if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) {
            if (!approvedPostIdentityChanged(post)) return;
            reopenFBRecycledPost(post);
        }

        rememberFBPostScreenHeight(post);
        post.classList.add('fb-post-screening-v47', 'fb-post-scanning');
        if (!post.hasAttribute('data-fb-v47-screen-start')) {
            post.setAttribute('data-fb-v47-screen-start', String(Date.now()));
        }

        let state = __fbPostHydrationState.get(post);
        if (!state) {
            state = { queued: false, queuedAt: 0, attempts: 0, stableTurns: 0, lastSignature: '', expanded: false };
            __fbPostHydrationState.set(post, state);
        }
        // A canceled/throttled callback must not strand the card forever at its loading anchor.
        if (state.queued && (Date.now() - (state.queuedAt || 0)) < 1400) return;
        state.queued = true;
        state.queuedAt = Date.now();

        addTimeout(() => {
            state.queued = false;
            state.queuedAt = 0;
            if (isFBMessengerPath(window.location.href) || isFBInsideEmbeddedChatSurfaceV56(post)) {
                try {
                    if (isFBMessengerPath(window.location.href)) releaseFBMessengerPostScannerState(post.ownerDocument || document);
                    else releaseFBEmbeddedChatPostScannerStateV56(post.ownerDocument || document);
                } catch (e) {}
                __fbPostHydrationState.delete(post);
                return;
            }
            if (!post.isConnected) {
                __fbPostHydrationState.delete(post);
                return;
            }
            if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) {
                __fbPostHydrationState.delete(post);
                return;
            }
            if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) {
                __fbPostHydrationState.delete(post);
                return;
            }

            rememberFBPostScreenHeight(post);
            state.attempts++;
            const screenStartedAt = Number(post.getAttribute('data-fb-v47-screen-start') || Date.now());
            const screenElapsed = Math.max(0, Date.now() - screenStartedAt);

            // Facebook owns this phase. Keep its one-pixel hydration anchor (not the painted
            // skeleton) until it hands the FeedUnit over to real content. The bounded wait keeps
            // a stale loading marker from holding the scanner forever.
            if (hasFBNativePostSkeleton(post) && state.attempts < 18 && screenElapsed < 5000) {
                queueFBPostForSingleScan(post, 140);
                return;
            }

            // Clear any legacy/provisional skeleton approval. Once hydration finishes, the real
            // content stays in the hidden one-shot lane until the scanner decides it.
            if (post.getAttribute('data-fb-v25-scan-complete') !== '1') {
                post.classList.remove('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed', 'fb-specific-url-loading-skeleton-v27');
                post.classList.add('fb-post-screening-v47', 'fb-post-scanning');
            }

            const signature = getFBPostHydrationSignature(post);
            if (signature && signature === state.lastSignature) state.stableTurns++;
            else {
                state.lastSignature = signature;
                state.stableTurns = 0;
            }

            // Two quiet turns normally land around 300–500 ms. The bounded fallback prevents a
            // permanently animated/video post from sitting at the loading anchor forever.
            if (state.stableTurns < 2 && state.attempts < 12 && screenElapsed < 5000) {
                queueFBPostForSingleScan(post, 150);
                return;
            }

            if (applyCachedFBPostDecision(post)) {
                __fbPostHydrationState.delete(post);
                return;
            }

            const showMoreButtons = getShowMoreButtonsForPost(post);
            if (showMoreButtons.length > 0 && post.getAttribute('data-fb-v25-showmore-clicked') !== '1') {
                post.classList.add('fb-post-expanding');
                post.setAttribute('data-fb-v25-showmore-clicked', '1');
                showMoreButtons.forEach(btn => {
                    try { btn.click(); } catch (e) {}
                });
                // Expanded is the final display state. We deliberately never click "Show less".
                state.expanded = true;
                state.attempts = 0;
                state.stableTurns = 0;
                state.lastSignature = '';
                queueFBPostForSingleScan(post, 360);
                return;
            }

            evaluatePostForBan(post);
        }, Math.max(0, delay));
    } catch (e) {}
};

const approvePostAfterScan = (post) => {
    try {
        releaseFBFeedSlot(post);
        try { releaseFBNativeHydrationSlotV53(post); } catch (e) {}
        const wasHardHiddenByFBCleaner = hasFBCleanerHardHideClass(post);
        post.classList.remove('fb-post-banned', 'fb-element-banned', 'fb-group-suggestions-banned', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-post-screening-v47');
        post.classList.add('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed');
        post.setAttribute('data-fb-v25-scan-complete', '1');
        post.removeAttribute('data-fb-v47-screen-start');
        const approvedKey = getFBStablePostIdentity(post);
        if (approvedKey) post.setAttribute('data-fb-v46-approved-key', approvedKey);
        __fbPostHydrationState.delete(post);
        post.style?.removeProperty('--fb-v47-screen-height');
        if (wasHardHiddenByFBCleaner) clearFBHideStyles(post);
        post.querySelectorAll?.('[role="article"]').forEach(article => {
            try { article.classList.add('fb-post-approved'); } catch (e) {}
        });
        markFBFeedUnitApproved(post);
        rememberApprovedPostForBrowsing(post);
        rememberFBElementDecision(post, 'post', 'approved');
        rememberFBStablePostDecisionV55(post, 'approved');
    } catch (e) {}
};

const banPostAfterScan = (post, reason = 'blocked post content') => {
    try {
        post.classList.remove('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-post-screening-v47');
        post.querySelectorAll?.('[role="article"]').forEach(article => {
            try { article.classList.remove('fb-post-approved'); } catch (e) {}
        });
        post.setAttribute('data-fb-v25-scan-complete', '1');
        post.removeAttribute('data-fb-v47-screen-start');
        post.removeAttribute('data-fb-v46-approved-key');
        __fbPostHydrationState.delete(post);
        post.style?.removeProperty('--fb-v47-screen-height');
        rememberFBElementDecision(post, 'post', 'banned', reason);
        rememberFBStablePostDecisionV55(post, 'banned');
        hideElementHard(post, 'fb-post-banned');
        collapseFBFeedSlot(post);
        devLog('🚫 Post hidden by v25.4.25 scanner: ' + reason);
    } catch (e) {}
};

const postHasBlockedLinksOrFbids = (post) => {
    try {
        const links = post.querySelectorAll('a[href], [data-fbid], [data-profileid], [data-pageid], [data-hovercard], [data-store], [data-ft]');
        for (let i = 0; i < links.length && i < 220; i++) {
            const el = links[i];
            if (!el || isInsideComment(el) || isNotificationPanelElement(el)) continue;
            const signal = safeDecodeFBValue([
                el.href || '',
                el.getAttribute && el.getAttribute('href') || '',
                el.getAttribute && el.getAttribute('data-fbid') || '',
                el.getAttribute && el.getAttribute('data-profileid') || '',
                el.getAttribute && el.getAttribute('data-pageid') || '',
                el.getAttribute && el.getAttribute('data-hovercard') || '',
                el.getAttribute && el.getAttribute('data-store') || '',
                el.getAttribute && el.getAttribute('data-ft') || ''
            ].join(' '));
            if (matchesAnyBlockedFbid(signal) || matchesAnyBlockedUrl(signal)) return true;
        }
    } catch (e) {}
    return false;
};

const evaluatePostForBan = (post) => {
    try {
        if (isFBInsideEmbeddedChatSurfaceV56(post)) {
            try { releaseFBEmbeddedChatPostScannerStateV56(post?.ownerDocument || document); } catch (e) {}
            return;
        }
        if (isFBMessengerPath(window.location.href)) {
            try { releaseFBMessengerPostScannerState(post?.ownerDocument || document); } catch (e) {}
            return;
        }
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(post?.ownerDocument || document);
            return;
        }
        if (!post || isNotificationPanelElement(post) || isInsideComment(post)) return;
        if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) return;
        if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) return;
        post.classList.remove('fb-post-pending', 'fb-post-scanning', 'fb-post-expanding');

        if (postHasAIInfoTag(post)) {
            banPostAfterScan(post, 'Facebook AI-info disclosure tag');
            return;
        }

        if (hasRestrictedFeedCTAOrReels(post)) {
            banPostAfterScan(post, 'restricted CTA or verified Reels carousel');
            return;
        }

        const fullPostText = collectPostTextForScan(post);
        if (matchesAnyActiveRegex(fullPostText)) {
            banPostAfterScan(post, 'blocked words/regex after Show More scan');
            return;
        }

        if (postHasBlockedLinksOrFbids(post)) {
            banPostAfterScan(post, 'blocked FBID/URL in post');
            return;
        }

        approvePostAfterScan(post);
    } catch (e) {
        try { approvePostAfterScan(post); } catch (ignored) {}
    }
};

// v45: Facebook often swaps an inner [role=article] after the outer FeedUnit has already
// received its final approval. Inherit that terminal approval onto replacement descendants
// instead of treating them as brand-new posts and leaving a ghost-white pseudo overlay behind.
const inheritApprovedPostState = (candidate) => {
    try {
        if (!candidate || candidate.nodeType !== 1 || !candidate.closest || isFBInsideEmbeddedChatSurfaceV56(candidate) || isFBEmbeddedChatMutationNodeV56(candidate)) return false;
        const approvedRoot = candidate.closest([
            'div[data-pagelet^="FeedUnit_"].fb-post-approved',
            'div[data-pagelet^="TimelineFeedUnit_"].fb-post-approved',
            '[role="feed"] [role="article"].fb-post-approved'
        ].join(','));
        if (!approvedRoot || approvedRoot.classList.contains('fb-post-banned') || approvedRoot.classList.contains('fb-element-banned')) return false;
        if (approvedPostIdentityChanged(approvedRoot)) {
            reopenFBRecycledPost(approvedRoot);
            return false;
        }

        const stampApproved = (node) => {
            try {
                if (!node || !node.classList) return;
                if (node.matches?.('[role="article"]')) node.classList.add('fb-post-approved');
                node.classList.remove('fb-post-screening-v47', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding');
            } catch (e) {}
        };

        stampApproved(candidate);
        candidate.querySelectorAll?.('[role="article"], .fb-post-screening-v47').forEach(stampApproved);
        return true;
    } catch (e) {
        return false;
    }
};

const markUnapprovedPostScreens = (root = document) => {
    try {
        if (isFBMessengerPath(window.location.href) || isFBInsideEmbeddedChatSurfaceV56(root) || isFBEmbeddedChatMutationNodeV56(root)) {
            try { releaseFBEmbeddedChatPostScannerStateV56(root?.ownerDocument || document); } catch (e) {}
            return;
        }
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(root);
            return;
        }
        const scanRoot = (root && root.querySelectorAll) ? root : document;
        const selectors = [
            'div[data-pagelet^="FeedUnit_"]',
            'div[data-pagelet^="TimelineFeedUnit_"]',
            '[role="feed"] [role="article"]',
            '[role="article"]'
        ].join(',');

        const candidates = [];
        if (scanRoot.nodeType === 1 && scanRoot.matches?.(selectors)) candidates.push(scanRoot);
        scanRoot.querySelectorAll?.(selectors).forEach(node => {
            if (candidates.length < 80) candidates.push(node);
        });

        const seen = new WeakSet();
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            if (isFBInsideEmbeddedChatSurfaceV56(candidate)) continue;
            if (inheritApprovedPostState(candidate)) continue;
            const post = getFBFeedUnitWrapper(candidate) || candidate.closest?.('[role="article"]') || candidate;
            if (!post || seen.has(post) || isFBInsideEmbeddedChatSurfaceV56(post)) continue;
            seen.add(post);
            if (post.classList.contains('fb-post-approved') || post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) continue;
            if (applyCachedFBPostDecision(post)) continue;
            if (post.closest?.('[role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"]')) continue;
            if (isFBSearchPagePath() && post.closest?.('[role="main"]')) continue;
            if (isNotificationPanelElement(post) || isInsideComment(post) || isFBCommentSurfaceElement(post)) continue;
            if (isProfileHeaderProtectedArea(post) || isTopLeftSearchDropdownElement(post)) continue;
            rememberFBPostScreenHeight(post);
            post.classList.add('fb-post-screening-v47');
        }
    } catch (e) {}
};

const scanAndBanEntirePosts = () => {
    try {
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(document);
            return;
        }
        if (isFBNoPostScanUrl(window.location.href)) return;
        if (updateFBCommentOverlayClass()) return;
        // v50: post expansion/scanning runs only outside trusted profile timelines.
        // Trusted own/Dad/friend timelines are released as native Facebook territory.
        protectNotificationSurfaces(document);
        protectFBCommentSurfaces(document);

        const postSelectors = [
            'div[data-pagelet^="FeedUnit_"]',
            'div[data-pagelet^="TimelineFeedUnit_"]',
            'div[data-ad-rendering-role="story_message"]',
            'div[data-ad-preview="message"]',
            '[role="feed"] [role="article"]',
            '[role="article"]'
        ];

        const seenPosts = new WeakSet();
        const candidates = document.querySelectorAll(postSelectors.join(','));
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            if (isFBInsideEmbeddedChatSurfaceV56(candidate)) continue;
            const post = getFBFeedUnitWrapper(candidate) || (candidate.closest && candidate.closest('[role="article"]')) || candidate;
            if (!post || seenPosts.has(post) || isFBInsideEmbeddedChatSurfaceV56(post)) continue;
            seenPosts.add(post);

            // Terminal decisions are overwhelmingly the common case on a settled feed. Test
            // them before notification/comment helpers that inspect ancestors and local text.
            if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) continue;
            if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) continue;
            if (applyCachedFBPostDecision(post)) continue;
            const inFeed = !!post.closest?.('[role="feed"]');
            if ((!inFeed && isNotificationPanelElement(post)) || isInsideComment(post)) continue;
            if (isFBSearchPagePath() && post.closest?.('[role="main"]')) continue;
            if (isProfileHeaderProtectedArea(post) || isTopLeftSearchDropdownElement(post)) continue;

            // v52: one owner, one queue, one final decision. The CSS gate keeps both native
            // skeletons and real unapproved content behind the one-pixel anchor.
            queueFBPostForSingleScan(post, 70);
        }
    } catch (e) {
        console.log('Error scanning entire posts v25.4.25: ' + e.message);
    }
};

// v25.4.30: visible-feed fast lane.
// Full post scanning still exists and still runs, but the first visible home-feed posts are
// evaluated immediately so the main feed does not sit blank waiting for the general cadence.
const scanVisibleHomeFeedPostsFast = () => {
    try {
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(document);
            return;
        }
        if (!isFBHomeFeedSurface()) return;
        if (isFBNoPostScanUrl(window.location.href)) return;
        if (isSafeWhitelistedPath(window.location.pathname, window.location.href)) return;

        const selectors = [
            'div[data-pagelet^="FeedUnit_"]',
            'div[data-pagelet^="TimelineFeedUnit_"]',
            '[role="feed"] [role="article"]',
            '[role="article"]'
        ];

        const seen = new WeakSet();
        const viewportBottom = (window.innerHeight || 900) + 1400;
        const viewportTop = -700;
        let processed = 0;

        const nodes = document.querySelectorAll(selectors.join(','));
        for (let i = 0; i < nodes.length && processed < 14; i++) {
            const candidate = nodes[i];
            if (isFBInsideEmbeddedChatSurfaceV56(candidate)) continue;
            const post = getFBFeedUnitWrapper(candidate) || (candidate.closest && candidate.closest('[role="article"]')) || candidate;
            if (!post || seen.has(post) || isFBInsideEmbeddedChatSurfaceV56(post)) continue;
            seen.add(post);

            // Most virtualized cards are already terminal. Keep their hot path to class/attribute
            // reads instead of ancestor text inspection and cache reconstruction.
            if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) continue;
            if (post.classList.contains('fb-post-scanning') || post.classList.contains('fb-post-expanding')) continue;
            if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) continue;
            if (applyCachedFBPostDecision(post)) continue;

            const inFeed = !!post.closest?.('[role="feed"]');
            if ((!inFeed && isNotificationPanelElement(post)) || isInsideComment(post)) continue;
            if (isProfileHeaderProtectedArea(post) || isTopLeftSearchDropdownElement(post)) continue;

            try {
                const rect = post.getBoundingClientRect && post.getBoundingClientRect();
                if (rect && (rect.top > viewportBottom || rect.bottom < viewportTop)) continue;
            } catch (e) {}

            processed++;
            queueFBPostForSingleScan(post, 35);
        }
    } catch (e) {}
};


// ===== v55 BACKGROUND-TAB FEED RECOVERY =====
// Background throttling lets Facebook recycle/rehydrate FeedUnits without normal paint timing.
// Terminal approvals must win over stale outer slot classes, while genuinely new units still
// remain behind the normal one-shot gate until scanned.
let __fbFeedMutatedWhileHiddenV55 = false;
const recoverFBFeedAfterVisibilityReturnV55 = () => {
    try {
        if (document.hidden || isFBMessengerPath(window.location.href) || isFBNoPostScanUrl(window.location.href)) return;
        const selector = [
            'div[data-pagelet^="FeedUnit_"].fb-post-approved[data-fb-v25-scan-complete="1"]',
            'div[data-pagelet^="TimelineFeedUnit_"].fb-post-approved[data-fb-v25-scan-complete="1"]',
            '[role="feed"] > [role="article"].fb-post-approved[data-fb-v25-scan-complete="1"]',
            '.fb-feed-slot-screening-v51:has(.fb-post-approved[data-fb-v25-scan-complete="1"])',
            '.fb-feed-slot-hydrating-v52:has(.fb-post-approved[data-fb-v25-scan-complete="1"])'
        ].join(',');
        const seen = new WeakSet();
        const seeds = Array.from(document.querySelectorAll(selector)).slice(0, 180);
        seeds.forEach(seed => {
            try {
                const approvedDescendant = seed.matches?.('.fb-post-approved[data-fb-v25-scan-complete="1"]')
                    ? seed
                    : seed.querySelector?.('.fb-post-approved[data-fb-v25-scan-complete="1"]');
                const post = getFBFeedUnitWrapper(approvedDescendant || seed) || approvedDescendant || seed;
                if (!post || seen.has(post) || post.classList?.contains('fb-post-banned') || post.classList?.contains('fb-element-banned')) return;
                seen.add(post);
                releaseFBFeedSlot(post);
                try { releaseFBNativeHydrationSlotV53(post); } catch (e) {}
                post.classList?.remove('fb-post-screening-v47', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-native-post-hydrating-v52');
                post.classList?.add('fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed');
                post.setAttribute?.('data-fb-v25-scan-complete', '1');
                post.style?.removeProperty('--fb-v47-screen-height');
                post.querySelectorAll?.('[role="article"], .fb-post-screening-v47').forEach(node => {
                    try {
                        node.classList?.remove('fb-post-screening-v47', 'fb-post-pending', 'fb-post-scanning', 'fb-post-expanding', 'fb-native-post-hydrating-v52');
                        if (node.matches?.('[role="article"]')) node.classList.add('fb-post-approved');
                    } catch (e) {}
                });
            } catch (e) {}
        });

        syncFBNativePostHydrationSlots(document);
        scanVisibleHomeFeedPostsFast();
        if (__fbFeedMutatedWhileHiddenV55) scheduleFBPostHydrationRetry();
        __fbFeedMutatedWhileHiddenV55 = false;
    } catch (e) {}
};

// IMPORTANT: This function must stay separate for focused restricted-word cleanup
const deleteRestrictedWords = () => {
    try {
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(document);
            return;
        }
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
                if (isFBCommentSurfaceElement(element)) return;
                if (isProfileHeaderProtectedArea(element)) return;
                if (__fbRestrictedWordsChecked.has(element)) return;
                __fbRestrictedWordsChecked.add(element);

                const elementToRemove = element.closest('[role="article"]') || element;
                // Approved/banned posts are intentionally final decisions; do not re-scan them here.
                if (elementToRemove.classList.contains('fb-post-approved') || elementToRemove.classList.contains('fb-post-banned') || elementToRemove.classList.contains('fb-element-banned')) return;

                const shouldUseCommentSafePostText = !!(
                    elementToRemove && elementToRemove.matches && elementToRemove.matches('[role="article"], div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"]')
                );
                let elementText = shouldUseCommentSafePostText
                    ? collectPostTextForScan(elementToRemove)
                    : normalizeFBText(element.innerText || element.textContent || '');
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
const FB_SEARCH_FILTER_VERSION = 'search-strict-v36';

const stripFBSearchResultFalseNativeImmunity = (result) => {
    try {
        if (!result || !result.classList) return;
        result.classList.remove(
            'fb-comments-protected',
            'fb-post-approved',
            'fb-feed-unit-approved',
            'fb-post-processed',
            'fb-post-pending',
            'fb-post-scanning',
            'fb-post-expanding'
        );
    } catch (e) {}
};

const processSearchResults = () => {
    try {
        updateFBSearchPageClass();

        if (!isFBSearchPagePath()) return;
        refreshAccountScopedFilters();

        const searchSelectors = [
            '[role="main"] [role="article"]',
            '[role="main"] li[role="row"]',
            '[role="main"] div[role="option"]',
            '[role="main"] div[data-testid="search-result"]',
            '[role="main"] div[role="presentation"]',
            '[role="main"] a[aria-describedby]',
            '[role="main"] a[href*="facebook.com/profile.php"]',
            '[role="main"] a[href*="facebook.com/"][aria-describedby]'
        ];

        const seenContainers = new WeakSet();
        const pushAttrs = (el, chunks) => {
            if (!el || !el.getAttribute) return;
            [
                'href', 'src', 'alt', 'aria-label', 'title', 'id', 'aria-describedby',
                'data-hovercard', 'data-profileid', 'data-profile-id', 'data-pageid',
                'data-page-id', 'data-fbid', 'data-userid', 'data-ownerid',
                'data-store', 'data-ft', 'data-fbcleaner-urlsig'
            ].forEach(attr => {
                try {
                    const value = el.getAttribute(attr);
                    if (value) chunks.push(value);
                } catch (e) {}
            });
        };

        const getSearchResultContainer = (seed) => {
            try {
                if (!seed || !seed.closest) return seed;
                return seed.closest('[role="main"] [role="article"], [role="main"] li[role="row"], [role="main"] div[data-testid="search-result"], [role="main"] div[role="option"], [role="main"] div[role="presentation"]') || seed;
            } catch (e) {
                return seed;
            }
        };

        searchSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(seed => {
                try {
                    // 25.1.5 behavior: do not process top/header/nav search UI.
                    // This is the key part for the native recent-search dropdown.
                    if (seed.closest('[role="banner"]') || seed.closest('[role="navigation"]') || isTopLeftSearchDropdownElement(seed)) return;

                    const result = getSearchResultContainer(seed);
                    if (!result || seenContainers.has(result)) return;
                    seenContainers.add(result);
                    if (result.closest('[role="banner"]') || result.closest('[role="navigation"]') || isTopLeftSearchDropdownElement(result)) return;

                    // v36: previous comment-overlay protection may have blessed search posts as
                    // fb-comments-protected/fb-post-approved because FB reuses nested role=article.
                    // Search gets its own decision here, always.
                    stripFBSearchResultFalseNativeImmunity(result);

                    const chunks = [];
                    chunks.push(result.textContent || result.innerText || '');
                    pushAttrs(result, chunks);
                    if (result.querySelectorAll) {
                        result.querySelectorAll('a[href], img[src], img[alt], [aria-label], [title], [data-hovercard], [data-profileid], [data-profile-id], [data-pageid], [data-page-id], [data-fbid], [data-userid], [data-ownerid], [data-store], [data-ft], [data-fbcleaner-urlsig]')
                            .forEach(el => pushAttrs(el, chunks));
                    }

                    const signalRaw = chunks.join(' ');
                    const signal = normalizeFBText(signalRaw);
                    const hrefs = Array.from(result.querySelectorAll ? result.querySelectorAll('a[href]') : [])
                        .map(a => a.href || a.getAttribute('href') || '')
                        .join(' ');
                    const processedKey = `${FB_SEARCH_FILTER_VERSION}|${fbDynamicWrestlerVersion}|${signal.length}|${hrefs.length}|${signal.slice(0, 900)}`;

                    if (result.classList.contains('fb-search-processed') && result.getAttribute('data-processed-key-v32') === processedKey) return;

                    result.classList.add('fb-search-processed');
                    result.setAttribute('data-processed-key-v32', processedKey);
                    // v39: the full normalized search signal can be large. It is only used for
                    // processing in this function; keep a tiny marker instead of duplicating it in the DOM.
                    result.setAttribute('data-processed-text', '1');

                    let isBlocked = false;

                    // Important: active regexes, including dynamic wrestler names, must override search-result
                    // safe-word shields. Otherwise descriptions containing banned names can slip through.
                    if (matchesAnyActiveRegex(signal)) isBlocked = true;
                    if (!isBlocked && matchesAnyBlockedFbid(`${signal} ${hrefs}`)) isBlocked = true;
                    if (!isBlocked && matchesAnyBlockedUrl(`${signal} ${hrefs}`)) isBlocked = true;
                    if (!isBlocked && matchesBlockedUrlCandidates(`${hrefs} ${signal}`)) isBlocked = true;

                    if (isBlocked) {
                        hideElementHard(result, 'fb-search-banned');
                        result.classList.remove('fb-search-approved');
                    } else {
                        if (isSafeElement(result)) return;
                        result.classList.add('fb-search-approved');
                        result.classList.remove('fb-search-banned');
                        result.style.removeProperty('display');
                        result.style.removeProperty('visibility');
                        result.style.removeProperty('opacity');
                        result.style.removeProperty('pointer-events');
                        result.style.removeProperty('position');
                        result.style.removeProperty('left');
                        result.style.removeProperty('top');
                        result.style.removeProperty('height');
                        result.style.removeProperty('width');
                        result.style.removeProperty('overflow');
                    }
                } catch (e) {}
            });
        });
    } catch (e) {
        console.log('Error processing search results: ' + e.message);
    }
};

// IMPORTANT: This function must stay separate for focused restricted-phrase cleanup
const deleteRestrictedPhrases = () => {
    try {
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(document);
            return;
        }
        if (!isFBCosmeticElementHidingAllowed()) return;
        // Cache restricted phrases in lowercase for faster matching
        const restrictedPhrasesLower = [
            "liity", "sinulle suositeltua", "suositeltua", "tilaa", "ryhmiä sinulle", "Meta AI", "ihmisiä,", "joita saatat tuntea", "ihmisiä, joita saatat tuntea",
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
            if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) return;
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
                if (FB_RESTRICTED_FEED_CTA_TEXT.has(normalizedBtnText)) {
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

            if (!shouldRemove && hasRestrictedFeedCTAOrReels(post)) {
                shouldRemove = true;
            }

            if (shouldRemove) {
                // Hide/remove the whole FeedUnit wrapper when possible so blank shells do not remain.
                const targetPost = getFBFeedUnitWrapper(post) || post;
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
                if (!container) container = getFBFeedUnitWrapper(header);
                if (!container) container = header.closest('[role="article"]');
                if (!container) container = header.closest('div.x1lliihq');
                if (!container) container = header.closest('div.x1ye3gou');
                if (!container) container = header.closest('div.x78zum5:not([role="navigation"])');

                // Only remove if it's a valid container (not navigation and has size)
                if (container &&
                    !(container.getAttribute('data-fb-v25-scan-complete') === '1' && container.classList.contains('fb-post-approved')) &&
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

// v43: restricted-phrase work is owned by the main observer/cadence router.
// Keep this entry point for compatibility, but do not install a second body-wide observer.
let __fbPhrasesObserverInstalled = false;
const observeForRestrictedPhrases = () => {
    try {
        if (!isFBCosmeticElementHidingAllowed()) return;
        if (!document.body || __fbPhrasesObserverInstalled) return;
        __fbPhrasesObserverInstalled = true;
        addIdleCallback(() => {
            try {
                if (!runFBStoriesNativeMaintenance() &&
                    !(typeof runFBNativeInteractiveLightLane === 'function' && runFBNativeInteractiveLightLane()) &&
                    !updateFBCommentOverlayClass()) {
                    deleteRestrictedPhrases();
                }
            } catch (e) {}
        });
    } catch (e) {}
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
        if (!isFBCosmeticElementHidingAllowed()) return;
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
        if (!isFBCosmeticElementHidingAllowed()) return;
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

const updateSpecificUrlNoGlimpseClass = () => {
    try {
        if (!document.documentElement) return false;
        const active = isCurrentSpecificUrlSurface();
        document.documentElement.classList.toggle('fb-specific-url-noglimpse-v26', active);
        return active;
    } catch (e) {
        return false;
    }
};

const isSpecificUrlNonFeedModule = (element) => {
    try {
        if (!element || !element.closest) return false;
        if (!isCurrentSpecificUrlSurface()) return false;
        if (isSpecificUrlDangerousGlobal(element)) return false;

        const main = element.closest('[role="main"], main');
        if (!main) return false;

        // Never classify the actual feed / feed cards as profile chrome.
        if (element.closest('[role="feed"], [data-pagelet="ProfileTimeline"], div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="article"]')) return false;

        const aria = fbNotifNorm(element.getAttribute?.('aria-label') || '');
        const pagelet = String(element.getAttribute?.('data-pagelet') || '').toLowerCase();
        const text = fbNotifNorm((element.innerText || element.textContent || '').slice(0, 900));
        const href = fbNotifNorm(element.getAttribute?.('href') || '');

        if (pagelet.includes('profiletiles') || pagelet.includes('profileintro') || pagelet.includes('profileabout') || pagelet.includes('profilefeatured')) return true;
        if (/^(photos|kuvat|recommended|suositeltua|suositellut|suositukset)$/.test(aria)) return true;
        if (href.includes('/photos') || href.includes('/media_set') || href.includes('/videos')) return true;

        // Profile-page side modules often expose these headings but do not have stable aria labels.
        if (text) {
            const looksLikePhotos = /^(photos|kuvat)(\s|$)/i.test(text) || text.includes('photo album') || text.includes('kuva-album');
            const looksRecommended = text.includes('recommended') || text.includes('suositeltua') || text.includes('sinulle suositeltua');
            if ((looksLikePhotos || looksRecommended) && !element.closest('[role="feed"], [role="article"]')) return true;
        }
    } catch (e) {}
    return false;
};

const hideSpecificUrlNonFeedModule = (element) => {
    try {
        if (!element || !element.style || !isSpecificUrlNonFeedModule(element)) return false;
        element.classList.add('fb-specific-url-nonfeed-hidden-v26');
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        element.style.setProperty('position', 'absolute', 'important');
        element.style.setProperty('left', '-9999px', 'important');
        element.style.setProperty('top', '-9999px', 'important');
        element.style.setProperty('width', '0', 'important');
        element.style.setProperty('height', '0', 'important');
        element.style.setProperty('overflow', 'hidden', 'important');
        element.style.setProperty('content-visibility', 'hidden', 'important');
        return true;
    } catch (e) {}
    return false;
};

const markSpecificUrlLoadingSkeletons = (root = document) => {
    try {
        if (!isCurrentSpecificUrlSurface()) return;
        syncFBNativePostHydrationSlots(root);
        const scanRoot = (root && root.querySelectorAll) ? root : document;
        const skeletons = scanRoot.querySelectorAll([
            '[role="feed"] [data-visualcompletion="loading-state"]',
            '[role="feed"] [role="progressbar"]',
            '[data-pagelet^="FeedUnit_"] [data-visualcompletion="loading-state"]',
            '[data-pagelet^="TimelineFeedUnit_"] [data-visualcompletion="loading-state"]',
            '[data-pagelet="ProfileTimeline"] [data-visualcompletion="loading-state"]'
        ].join(','));

        skeletons.forEach(node => {
            try {
                const host = node.closest('[data-pagelet^="FeedUnit_"], [data-pagelet^="TimelineFeedUnit_"], [role="feed"] [role="article"]');
                if (!host || isSpecificUrlDangerousGlobal(host)) return;
                host.classList.add('fb-specific-url-loading-skeleton-v27');
            } catch (e) {}
        });

        scanRoot.querySelectorAll('.fb-specific-url-loading-skeleton-v27').forEach(host => {
            try {
                if (!host.querySelector(FB_NATIVE_POST_LOADING_SELECTOR_V52)) {
                    host.classList.remove('fb-specific-url-loading-skeleton-v27');
                }
            } catch (e) {}
        });
    } catch (e) {}
};

const scrubSpecificUrlNonFeedModules = (root = document) => {
    try {
        if (!updateSpecificUrlNoGlimpseClass()) return;
        markSpecificUrlLoadingSkeletons(root);
        const scanRoot = (root && root.querySelectorAll) ? root : document;
        const selectors = [
            '[role="main"] [data-pagelet*="ProfileTiles" i]',
            '[role="main"] [data-pagelet*="ProfileIntro" i]',
            '[role="main"] [data-pagelet*="ProfileAbout" i]',
            '[role="main"] [data-pagelet*="ProfileFeatured" i]',
            '[role="main"] [aria-label*="Photos" i]',
            '[role="main"] [aria-label*="Kuvat" i]',
            '[role="main"] [aria-label*="Recommended" i]',
            '[role="main"] [aria-label*="Suosit" i]',
            '[role="main"] a[href*="/photos"]',
            '[role="main"] a[href*="/media_set"]',
            '[role="main"] a[href*="/videos"]',
            '[role="main"] h2, [role="main"] h3, [role="main"] [role="heading"]'
        ];

        scanRoot.querySelectorAll(selectors.join(',')).forEach(el => {
            try {
                // Hide a sensible module wrapper, not just the heading/link itself.
                let target = el;
                const module = el.closest('[data-pagelet], [aria-label], div.x1yztbdb, div.x78zum5.xdt5ytf, div.x9f619.x1n2onr6.x1ja2u2z');
                if (module && !module.closest('[role="feed"], [role="article"]')) target = module;
                hideSpecificUrlNonFeedModule(target);
            } catch (e) {}
        });
    } catch (e) {}
};

const isSpecificUrlDangerousGlobal = (el) => {
    try {
        if (!el || el === document.body || el === document.documentElement) return true;
        if (el.matches?.('html, body, head, script, style, link, meta, header, nav, [role="banner"], [role="navigation"], [role="feed"], [role="article"]')) return true;
        if (el.closest?.('header, nav, [role="banner"], [role="navigation"], [role="feed"], [role="article"]')) return true;
    } catch (e) {}
    return false;
};

// ENHANCED: Inject CSS for specific URL prehide to prevent flashes on supported pages
const injectSpecificUrlPrehideCSS = () => {
    try {
        const currentUrl = window.location.href;
        const supportedUrls = FB_SPECIFIC_URL_SURFACES;

        // Only inject on supported heavy pages; remove the sheet/class after SPA navigation away.
        if (!isSupportedFacebookPage(currentUrl, supportedUrls)) {
            try {
                if (document.documentElement) document.documentElement.classList.remove('fb-specific-url-noglimpse-v26');
                const oldStyle = document.getElementById('fb-specific-url-prehide-style');
                if (oldStyle) oldStyle.remove();
            } catch (e) {}
            return;
        }
        updateSpecificUrlNoGlimpseClass();

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
        div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so.xau1kf4.x9f619.xh8yej3.x6ikm8r.x10wlt62.xquyuld:has(.x1k70j0n.xzueoph),
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

        /* v25.4.26 supported-page no-glimpse: hide profile chrome/modules immediately,
           but leave the actual timeline/feed cards for the normal approved-feed scanner. */
        html.fb-specific-url-noglimpse-v26 [role="main"] [data-pagelet*="ProfileTiles" i],
        html.fb-specific-url-noglimpse-v26 [role="main"] [data-pagelet*="ProfileIntro" i],
        html.fb-specific-url-noglimpse-v26 [role="main"] [data-pagelet*="ProfileAbout" i],
        html.fb-specific-url-noglimpse-v26 [role="main"] [data-pagelet*="ProfileFeatured" i],
        html.fb-specific-url-noglimpse-v26 [role="main"] [aria-label*="Photos" i],
        html.fb-specific-url-noglimpse-v26 [role="main"] [aria-label*="Kuvat" i],
        html.fb-specific-url-noglimpse-v26 [role="main"] [aria-label*="Recommended" i],
        html.fb-specific-url-noglimpse-v26 [role="main"] [aria-label*="Suosit" i] {
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

        /* v52 supported-page zero-slot lane. Loading and real unapproved FeedUnits use the
           same one-pixel anchor until the normal scanner supplies a terminal decision. */
        html.fb-specific-url-noglimpse-v26 div[data-pagelet^="FeedUnit_"]:not(.fb-feed-unit-approved):not(.fb-post-approved):not(.fb-post-banned):not(.fb-element-banned),
        html.fb-specific-url-noglimpse-v26 div[data-pagelet^="TimelineFeedUnit_"]:not(.fb-feed-unit-approved):not(.fb-post-approved):not(.fb-post-banned):not(.fb-element-banned),
        html.fb-specific-url-noglimpse-v26 .fb-specific-url-loading-skeleton-v27 {
            position: relative !important;
            height: 1px !important;
            min-height: 1px !important;
            max-height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            content-visibility: hidden !important;
            contain: strict !important;
            transition: none !important;
            animation: none !important;
        }

        html.fb-specific-url-noglimpse-v26 div[data-pagelet^="FeedUnit_"].fb-feed-unit-approved,
        html.fb-specific-url-noglimpse-v26 div[data-pagelet^="FeedUnit_"].fb-post-approved,
        html.fb-specific-url-noglimpse-v26 div[data-pagelet^="TimelineFeedUnit_"].fb-feed-unit-approved,
        html.fb-specific-url-noglimpse-v26 div[data-pagelet^="TimelineFeedUnit_"].fb-post-approved {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            content-visibility: visible !important;
        }

        /* Supported-page skeleton guard. Patch 1 reopened feed skeletons below; Patch 2 keeps
           every loading marker hidden while the one-pixel host remains available to hydration. */
        html.fb-specific-url-noglimpse-v26 [role="main"] [data-visualcompletion="loading-state"],
        html.fb-specific-url-noglimpse-v26 [role="main"] [role="progressbar"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            content-visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            min-width: 0 !important;
            min-height: 0 !important;
            max-width: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            transition: none !important;
            animation: none !important;
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
        const supportedUrls = FB_SPECIFIC_URL_SURFACES;
        updateSpecificUrlNoGlimpseClass();

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

                // Keep FEED/TIMELINE loading DOM alive so Facebook can finish hydration. Patch 2's
                // CSS/slot lane makes it invisible and one pixel tall; deleting it here could cancel
                // or repeatedly restart Facebook's lazy loader.
                const inFeedSkeletonArea = !!element.closest('[role="feed"], [data-pagelet="ProfileTimeline"], div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="article"]');
                if (inFeedSkeletonArea) {
                    if (element.hasAttribute('data-visualcompletion') && element.getAttribute('data-visualcompletion') === 'loading-state') return true;
                    if (element.getAttribute('role') === 'progressbar') return true;
                    if (element.querySelector && (element.querySelector('[data-visualcompletion="loading-state"]') || element.querySelector('[role="progressbar"]'))) return true;
                }
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
            'h2:has(a[href*="/photos"])',
            '[role="main"] [data-pagelet*="ProfileTiles" i]',
            '[role="main"] [data-pagelet*="ProfileIntro" i]',
            '[role="main"] [data-pagelet*="ProfileAbout" i]',
            '[role="main"] [data-pagelet*="ProfileFeatured" i]',
            '[role="main"] [aria-label*="Photos" i]',
            '[role="main"] [aria-label*="Kuvat" i]',
            '[role="main"] [aria-label*="Recommended" i]',
            '[role="main"] [aria-label*="Suosit" i]'
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

        scrubSpecificUrlNonFeedModules(document);
    } catch (e) {}
};

// FIXED: Function to delete elements for specific profiles - now with proper URL restriction
const deleteSelectorsForSpecificProfile = () => {
    try {
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        const profileIds = [
            '100000639309471',
            '1150630468'
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
        if (!isFBCosmeticElementHidingAllowed()) return;
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

// v25.4.26: Facebook emits /reel/?s=tab for Reels/Kelat nav buttons, which can bounce home.
// Canonicalize those anchors and clicks to /reel instead.
const FB_REELS_CANONICAL_URL = 'https://www.facebook.com/reel';
let __fbReelsLinkPatchInstalled = false;

const isFBReelTabUrl = (value = '') => {
    try {
        const url = new URL(String(value || ''), window.location.origin);
        const host = (url.hostname || '').toLowerCase();
        const path = (url.pathname || '').replace(/\/+$/, '').toLowerCase();
        if (!host.endsWith('facebook.com')) return false;
        if (path !== '/reel') return false;
        return url.searchParams.get('s') === 'tab' || url.search === '?s=tab' || String(value || '').includes('/reel/?s=tab');
    } catch (e) {
        return String(value || '').toLowerCase().includes('/reel/?s=tab');
    }
};

const isFBReelsCanonicalUrl = (value = '') => {
    try {
        const url = new URL(String(value || ''), window.location.origin);
        const host = (url.hostname || '').toLowerCase();
        const path = (url.pathname || '').replace(/\/+$/, '').toLowerCase();
        return host.endsWith('facebook.com') && path === '/reel';
    } catch (e) {
        return /^\/?reel\/?(?:[?#].*)?$/i.test(String(value || '').trim());
    }
};

const isFBReelsNavAnchor = (anchor) => {
    try {
        if (!anchor) return false;
        const href = anchor.getAttribute?.('href') || anchor.href || '';
        const sig = anchor.getAttribute?.('data-fbcleaner-urlsig') || '';
        const aria = fbNotifNorm(anchor.getAttribute?.('aria-label') || '');
        const text = fbNotifNorm((anchor.innerText || anchor.textContent || '').slice(0, 80));
        if (isFBReelTabUrl(href) || isFBReelTabUrl(sig)) return true;
        if (anchor.getAttribute?.('data-fbcleaner-reels-canonical-v27') === '1') return true;
        if ((aria === 'kelat' || aria === 'reels') && isFBReelsCanonicalUrl(href || sig || '/reel')) return true;
        if ((text === 'kelat' || text === 'reels') && isFBReelsCanonicalUrl(href || sig || '/reel')) return true;
        return false;
    } catch (e) {
        return false;
    }
};

const normalizeFBReelsLinks = (root = document) => {
    try {
        const scanRoot = (root && root.querySelectorAll) ? root : document;
        const selector = [
            'a[href="/reel/?s=tab"]',
            'a[href="https://www.facebook.com/reel/?s=tab"]',
            'a[href*="/reel/?s=tab"]',
            'a[data-fbcleaner-urlsig*="/reel/?s=tab"]',
            'a[aria-label="Kelat"]',
            'a[aria-label="Reels"]'
        ].join(',');

        scanRoot.querySelectorAll(selector).forEach(anchor => {
            try {
                const rawHref = anchor.getAttribute('href') || anchor.href || '';
                const urlSig = anchor.getAttribute('data-fbcleaner-urlsig') || '';
                if (!isFBReelTabUrl(rawHref) && !isFBReelTabUrl(urlSig)) return;
                anchor.setAttribute('href', FB_REELS_CANONICAL_URL);
                anchor.href = FB_REELS_CANONICAL_URL;
                anchor.setAttribute('data-fbcleaner-reels-canonical-v27', '1');
                if (urlSig) {
                    anchor.setAttribute('data-fbcleaner-urlsig', urlSig.replaceAll('https://www.facebook.com/reel/?s=tab', FB_REELS_CANONICAL_URL).replaceAll('/reel/?s=tab', '/reel'));
                }
            } catch (e) {}
        });
    } catch (e) {}
};

const installFBReelsLinkPatch = () => {
    try {
        if (!isFBMessengerPath(window.location.href)) {
            normalizeFBReelsLinks(document);
            protectFBReelsCurrentLocation();
        }
        if (__fbReelsLinkPatchInstalled) return;
        __fbReelsLinkPatchInstalled = true;
        const hardCanonicalizeReelsClick = (event) => {
            try {
                if (isFBMessengerPath(window.location.href)) return;
                const anchor = getBestNavigationAnchor(event.target);
                if (!anchor) return;
                if (!isFBReelsNavAnchor(anchor)) return;
                anchor.setAttribute('href', FB_REELS_CANONICAL_URL);
                anchor.href = FB_REELS_CANONICAL_URL;
                anchor.setAttribute('data-fbcleaner-reels-canonical-v27', '1');
                if (event.type !== 'click') return;
                if (!isPlainLeftClick(event)) return;
                event.preventDefault();
                event.stopPropagation();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                // Force a real browser navigation. Facebook's left-click SPA handler can ignore the cleaned href
                // and use its stale internal /reel/?s=tab route metadata, which is why middle-click worked but
                // left-click bounced home.
                window.location.href = FB_REELS_CANONICAL_URL;
            } catch (e) {}
        };

        onWindowEvent(document, 'pointerdown', hardCanonicalizeReelsClick, true);
        onWindowEvent(document, 'mousedown', hardCanonicalizeReelsClick, true);
        onWindowEvent(document, 'click', hardCanonicalizeReelsClick, true);
    } catch (e) {}
};

const protectFBReelsCurrentLocation = () => {
    try {
        if (!isFBReelTabUrl(window.location.href)) return false;
        try {
            window.history.replaceState(window.history.state || {}, document.title, '/reel');
            return true;
        } catch (e) {
            try { window.location.replace(FB_REELS_CANONICAL_URL); } catch (ignored) {}
            return true;
        }
    } catch (e) {
        return false;
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
            if (isFBMessengerPath(window.location.href)) return;
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
            if (isFBMessengerPath(window.location.href)) return;
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

// v53: interaction quiet lane.
// Facebook virtualizes/recycles feed cards while wheel, touch, keyboard and scrollbar input is
// still active. Running document-wide policy passes inside that burst can block the browser from
// painting the scroll for seconds. Keep the CSS/local mutation guards active, then perform one
// consolidated safety pass after the input stream has been quiet for a short window.
const FB_USER_INTERACTION_QUIET_MS_V53 = 320;
let __fbLastUserInteractionAtV53 = 0;
let __fbInteractionSettlePendingV53 = false;
let __fbInteractionQuietLaneInstalledV53 = false;

const isFBUserInteractionHotV53 = () => {
    try {
        return (Date.now() - __fbLastUserInteractionAtV53) < FB_USER_INTERACTION_QUIET_MS_V53;
    } catch (e) {
        return false;
    }
};

const scheduleFBInteractionSettledPassV53 = () => {
    try {
        if (__fbInteractionSettlePendingV53) return;
        __fbInteractionSettlePendingV53 = true;

        const finishWhenQuiet = () => {
            const remaining = FB_USER_INTERACTION_QUIET_MS_V53 - (Date.now() - __fbLastUserInteractionAtV53);
            if (remaining > 0) {
                addTimeout(finishWhenQuiet, remaining + 24);
                return;
            }

            __fbInteractionSettlePendingV53 = false;
            if (document.hidden || __fbCleanupRan) return;
            if (runFBMessengerNativeMaintenance()) return;
            try { syncFBNativePostHydrationSlots(document); } catch (e) {}
            scheduleRunAllFilters();
        };

        addTimeout(finishWhenQuiet, FB_USER_INTERACTION_QUIET_MS_V53 + 24);
    } catch (e) {
        __fbInteractionSettlePendingV53 = false;
    }
};

const noteFBUserInteractionV53 = (event) => {
    // Messenger scrolling/typing must not schedule the feed quiet-lane at all.
    if (isFBMessengerPath(window.location.href) || isFBInsideEmbeddedChatSurfaceV56(event?.target)) return;
    __fbLastUserInteractionAtV53 = Date.now();
    scheduleFBInteractionSettledPassV53();
};

const installFBUserInteractionQuietLaneV53 = () => {
    try {
        if (__fbInteractionQuietLaneInstalledV53) return;
        __fbInteractionQuietLaneInstalledV53 = true;
        const passiveCapture = { passive: true, capture: true };
        onWindowEvent(window, 'wheel', noteFBUserInteractionV53, passiveCapture);
        onWindowEvent(window, 'touchstart', noteFBUserInteractionV53, passiveCapture);
        onWindowEvent(window, 'pointerdown', noteFBUserInteractionV53, passiveCapture);
        onWindowEvent(window, 'scroll', noteFBUserInteractionV53, passiveCapture);
        onWindowEvent(window, 'keydown', event => {
            const key = String(event?.key || '');
            if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'PageDown' || key === 'PageUp' ||
                key === 'Home' || key === 'End' || key === ' ' || event?.code === 'Space') {
                noteFBUserInteractionV53();
            }
        }, true);
    } catch (e) {}
};

// v39/v53: coalesced full-filter scheduler.
// Several FB lifecycle events can fire back-to-back for the same visual update. Queueing one
// run on the next timer tick keeps behavior identical while avoiding duplicate full-page sweeps.
let __fbRunAllFiltersQueued = false;
const scheduleRunAllFilters = () => {
    try {
        if (__fbRunAllFiltersQueued) return;
        __fbRunAllFiltersQueued = true;
        addTimeout(() => {
            __fbRunAllFiltersQueued = false;
            try {
                if (runFBMessengerNativeMaintenance()) return;
                if (isFBUserInteractionHotV53()) {
                    scheduleFBInteractionSettledPassV53();
                    return;
                }
                if (runFBNativeInteractiveLightLane()) return;
                runAllFilters();
            } catch (e) {}
        }, 0);
    } catch (e) {
        try { runAllFilters(); } catch (ignored) {}
    }
};

let __fbHistoryHooked = false;
const hookHistoryAPI = () => {
    try {
        if (__fbHistoryHooked) return;
        __fbHistoryHooked = true;

        const originalPushState = history.pushState;
        history.pushState = function() {
            const previousProfileRoute = getFBProfileRouteKey();
            const rv = originalPushState.apply(this, arguments);
            try {
                if (previousProfileRoute !== getFBProfileRouteKey()) updateFBProfileScreening(true);
            } catch (e) {}
            try { refreshFBSpecificSurfaceHydrationObserverV58(); } catch (e) {}
            if (isFBMessengerPath(window.location.href)) {
                try { runFBMessengerNativeMaintenance(true); } catch (e) {}
            } else {
                try { protectFBReelsCurrentLocation(); } catch (e) {}
                try { injectSpecificUrlPrehideCSS(); } catch (e) {}
                try { scrubSpecificUrlNonFeedModules(document); } catch (e) {}
            }
            scheduleRunAllFilters();
            return rv;
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function() {
            const previousProfileRoute = getFBProfileRouteKey();
            const rv = originalReplaceState.apply(this, arguments);
            try {
                if (previousProfileRoute !== getFBProfileRouteKey()) updateFBProfileScreening(true);
            } catch (e) {}
            try { refreshFBSpecificSurfaceHydrationObserverV58(); } catch (e) {}
            if (isFBMessengerPath(window.location.href)) {
                try { runFBMessengerNativeMaintenance(true); } catch (e) {}
            } else {
                try { protectFBReelsCurrentLocation(); } catch (e) {}
                try { injectSpecificUrlPrehideCSS(); } catch (e) {}
                try { scrubSpecificUrlNonFeedModules(document); } catch (e) {}
            }
            scheduleRunAllFilters();
            return rv;
        };

        onWindowEvent(window, 'popstate', () => {
            try { updateFBProfileScreening(true); } catch (e) {}
            try { refreshFBSpecificSurfaceHydrationObserverV58(); } catch (e) {}
            if (isFBMessengerPath(window.location.href)) {
                try { runFBMessengerNativeMaintenance(true); } catch (e) {}
            } else {
                try { protectFBReelsCurrentLocation(); } catch (e) {}
                try { injectSpecificUrlPrehideCSS(); } catch (e) {}
            }
            scheduleRunAllFilters();
        }, false);
    } catch (e) {}
};

// v38: lightweight handoff for Facebook's native transient menus/dropdowns.
// Menus should open and scroll without waking the whole feed/search scanner stack.
const isFBNativeTransientMenuElement = (element) => {
    try {
        if (!element || !element.closest) return false;
        if (isNotificationPanelElement(element)) return false;
        if (isFBCommentSurfaceElement(element) || isInsideFBActiveCommentOverlay(element)) return false;
        const menu = element.closest('[role="menu"], [role="listbox"], [role="tooltip"]');
        if (!menu) return false;
        if (menu.closest('[role="feed"], [role="main"] [role="article"]')) return false;
        return true;
    } catch (e) {
        return false;
    }
};

const isFBNativeTransientMenuOpen = () => {
    try {
        // v39: callers already refresh the comment-overlay class before this check.
        // Re-scanning every dialog here made menu/open ticks do duplicate DOM work.
        if (document.documentElement && document.documentElement.classList.contains('fb-comment-overlay-active-v35')) return false;
        return !!document.querySelector('[role="menu"], [role="listbox"], [role="tooltip"]');
    } catch (e) {
        return false;
    }
};

const runFBNativeTransientMenuMaintenance = () => {
    try {
        if (typeof refreshFBNativeTopSearchHandoff === 'function') refreshFBNativeTopSearchHandoff();
        protectNotificationSurfaces(document);
        hideCriticalNavOnly();
    } catch (e) {}
};

// ENHANCED: DOM observer with instant search result processing and full post scanning
let __fbDomObserverInstalled = false;

// v25.4.29 smoothness pass:
// Keep all existing scanners, but coalesce duplicate observer wakeups. Facebook can fire dozens
// of tiny mutations for one visual update; running the same maintenance stack for every micro-mutation
// is wasted work and causes stutter.
let __fbHydrationRetryPending = false;
const scheduleFBPostHydrationRetry = () => {
    try {
        if (__fbHydrationRetryPending) return;
        __fbHydrationRetryPending = true;
        addTimeout(() => {
            __fbHydrationRetryPending = false;
            try {
                if (runFBMessengerNativeMaintenance()) return;
                if (isFBUserInteractionHotV53()) {
                    scheduleFBInteractionSettledPassV53();
                    return;
                }
                syncFBNativePostHydrationSlots(document);
                markSpecificUrlLoadingSkeletons(document);
                scrubSpecificUrlNonFeedModules(document);
                protectFBCommentSurfaces(document);
                scanVisibleHomeFeedPostsFast();
                scanAndBanEntirePosts();
            } catch (e) {}
        }, 140);
    } catch (e) {}
};

const runFBObserverMaintenance = createThrottle(() => {
    try {
        if (runFBMessengerNativeMaintenance()) return;
        releaseFBEmbeddedChatPostScannerStateV56(document);
        if (typeof refreshFBNativeTopSearchHandoff === 'function') refreshFBNativeTopSearchHandoff();
        normalizeFBReelsLinks(document);
        protectFBReelsCurrentLocation();
        markSpecificUrlLoadingSkeletons(document);
        scrubSpecificUrlNonFeedModules(document);
        if (isFBNotificationsPath(window.location.href)) protectNotificationSurfaces(document);
        protectFBCommentSurfaces(document);
    } catch (e) {}
}, 360);

// ===== v58: SPECIFIC-SURFACE LIVE HYDRATION WATCH =====
// Facebook can finish a TimelineFeedUnit after the initial child insertion by changing an
// existing link's href/labels or a text node. The main observer intentionally ignores attribute
// and characterData churn for performance, so explicit high-risk pages get a narrow observer of
// their own. It is attached ONLY while one of those configured surfaces is active.
let __fbSpecificSurfaceHydrationObserverV58 = null;
let __fbSpecificSurfaceHydrationObserverActiveV58 = false;
const __fbSpecificApprovedRecheckPendingV58 = new WeakSet();

const isFBSpecificSafetySurfaceV58 = () => {
    try {
        return isCurrentSpecificUrlSurface(window.location.href) ||
               isCurrentSpecificProfileSurface(window.location.href);
    } catch (e) {
        return false;
    }
};

const getFBPostFromHydrationMutationV58 = (seed) => {
    try {
        const element = seed?.nodeType === 1 ? seed : seed?.parentElement;
        if (!element?.closest) return null;
        if (isFBInsideEmbeddedChatSurfaceV56(element) || isFBEmbeddedChatMutationNodeV56(element)) return null;
        if (isNotificationPanelElement(element) || isInsideComment(element) || isFBCommentSurfaceElement(element)) return null;
        const post = getFBFeedUnitWrapper(element) ||
            element.closest('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"] [role="article"], [role="article"]');
        if (!post?.isConnected || isFBInsideEmbeddedChatSurfaceV56(post)) return null;
        if (isNotificationPanelElement(post) || isInsideComment(post) || isFBCommentSurfaceElement(post)) return null;
        if (post.closest?.('[role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"]')) return null;
        if (isProfileHeaderProtectedArea(post) || isTopLeftSearchDropdownElement(post)) return null;
        return post;
    } catch (e) {
        return null;
    }
};

const scheduleFBSpecificApprovedPostRecheckV58 = (post) => {
    try {
        if (!post?.isConnected || __fbSpecificApprovedRecheckPendingV58.has(post)) return;
        __fbSpecificApprovedRecheckPendingV58.add(post);
        addTimeout(() => {
            __fbSpecificApprovedRecheckPendingV58.delete(post);
            try {
                if (!isFBSpecificSafetySurfaceV58() || document.hidden || !post.isConnected) return;
                if (isFBMessengerPath(window.location.href) || isFBTrustedProfileTimelineSurface()) return;
                if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) return;

                // Only late-hydrated posts that were already terminally approved need this audit.
                // Unapproved/recycled units stay in the ordinary one-shot hydration scanner below.
                if (!(post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved'))) {
                    markUnapprovedPostScreens(post);
                    queueFBPostForSingleScan(post, 20);
                    return;
                }

                if (postHasAIInfoTag(post)) {
                    banPostAfterScan(post, 'late-hydrated Facebook AI-info disclosure tag');
                    return;
                }
                if (hasRestrictedFeedCTAOrReels(post)) {
                    banPostAfterScan(post, 'late-hydrated restricted CTA or verified Reels carousel');
                    return;
                }

                const fullPostText = collectPostTextForScan(post);
                if (matchesAnyActiveRegex(fullPostText)) {
                    banPostAfterScan(post, 'late-hydrated blocked words/regex');
                    return;
                }
                if (postHasBlockedLinksOrFbids(post)) {
                    banPostAfterScan(post, 'late-hydrated blocked FBID/URL');
                }
            } catch (e) {}
        }, 45);
    } catch (e) {}
};

const handleFBSpecificSurfaceHydrationMutationsV58 = (mutations) => {
    try {
        if (!isFBSpecificSafetySurfaceV58() || document.hidden || isFBMessengerPath(window.location.href)) return;
        const posts = new Set();
        const collect = (seed) => {
            if (posts.size >= 24) return;
            const post = getFBPostFromHydrationMutationV58(seed);
            if (post) posts.add(post);
        };

        for (let i = 0; i < mutations.length && posts.size < 24; i++) {
            const mutation = mutations[i];
            collect(mutation.target);
            if (mutation.type === 'childList') {
                const added = mutation.addedNodes || [];
                for (let n = 0; n < added.length && posts.size < 24; n++) collect(added[n]);
            }
        }

        posts.forEach(post => {
            try {
                if (post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) return;
                if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) {
                    scheduleFBSpecificApprovedPostRecheckV58(post);
                } else {
                    // High-risk timeline posts should never wait for the home-feed-only fast lane.
                    markUnapprovedPostScreens(post);
                    queueFBPostForSingleScan(post, 20);
                }
            } catch (e) {}
        });
    } catch (e) {}
};

const refreshFBSpecificSurfaceHydrationObserverV58 = () => {
    try {
        const shouldObserve = isFBSpecificSafetySurfaceV58() && !isFBMessengerPath(window.location.href);
        if (!shouldObserve) {
            if (__fbSpecificSurfaceHydrationObserverV58 && __fbSpecificSurfaceHydrationObserverActiveV58) {
                try { __fbSpecificSurfaceHydrationObserverV58.disconnect(); } catch (e) {}
            }
            __fbSpecificSurfaceHydrationObserverActiveV58 = false;
            return false;
        }

        if (!document.documentElement) return false;
        if (!__fbSpecificSurfaceHydrationObserverV58) {
            __fbSpecificSurfaceHydrationObserverV58 = trackObserver(new MutationObserver(handleFBSpecificSurfaceHydrationMutationsV58));
        }
        if (!__fbSpecificSurfaceHydrationObserverActiveV58) {
            __fbSpecificSurfaceHydrationObserverV58.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['href', 'src', 'srcset', 'alt', 'aria-label', 'title']
            });
            __fbSpecificSurfaceHydrationObserverActiveV58 = true;
        }
        return true;
    } catch (e) {
        return false;
    }
};

const observeDOMChanges = () => {
    try {
        if (__fbDomObserverInstalled) return;
        __fbDomObserverInstalled = true;

        devLog('Setting up DOM observer with coalesced search/feed processing');

        const throttledRunAllFilters = createThrottle(() => runAllFilters(), 650);
        const feedNodeSelector = 'div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"] [role="article"], [role="article"]';
        const feedDeepSelector = 'div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"] [role="article"], [role="article"], [aria-label="Kelat"][role="region"], [aria-label="Reels"][role="region"]';

        const isIgnoredMutationNode = (node) => {
            try {
                return !node ||
                    node === document.documentElement ||
                    node === document.body ||
                    node.id === 'fb-profile-screening-overlay-v44' ||
                    (node.closest && !!node.closest('#fb-profile-screening-overlay-v44')) ||
                    (node.matches && node.matches('script, style, link, meta'));
            } catch (e) {
                return false;
            }
        };

        // The profile veil is our own DOM. Its insertion/removal must not wake the filter
        // stack and recreate itself in an observer feedback loop.
        const mutationBatchOnlyIgnoredNodes = (mutations) => {
            try {
                let sawElement = false;
                const checkNode = (node) => {
                    if (!node || node.nodeType !== 1) return true;
                    sawElement = true;
                    return isIgnoredMutationNode(node);
                };

                for (let mi = 0; mi < mutations.length; mi++) {
                    const mutation = mutations[mi];
                    if (!checkNode(mutation.target)) return false;
                    const added = mutation.addedNodes || [];
                    for (let ni = 0; ni < added.length; ni++) {
                        if (!checkNode(added[ni])) return false;
                    }
                    const removed = mutation.removedNodes || [];
                    for (let ni = 0; ni < removed.length; ni++) {
                        if (!checkNode(removed[ni])) return false;
                    }
                }
                return sawElement;
            } catch (e) {
                return false;
            }
        };

        const mutationBatchOnlyMatches = (mutations, matcher) => {
            try {
                let sawMatch = false;
                let sawOther = false;
                const checkNode = (node) => {
                    if (!node || node.nodeType !== 1) return;
                    if (matcher(node)) {
                        sawMatch = true;
                    } else if (!isIgnoredMutationNode(node)) {
                        sawOther = true;
                    }
                };
                for (let mi = 0; mi < mutations.length && !(sawMatch && sawOther); mi++) {
                    const m = mutations[mi];
                    checkNode(m.target);
                    const added = m.addedNodes;
                    for (let ni = 0; added && ni < added.length && !(sawMatch && sawOther); ni++) {
                        checkNode(added[ni]);
                    }
                }
                return sawMatch && !sawOther;
            } catch (e) {
                return false;
            }
        };

        const observer = trackObserver(new MutationObserver((mutations) => {
            // v57: the document-start micro-observer owns exact identity/chat-shell work.
            // Do not duplicate those scans in the already-busy main Facebook observer.
            if (mutationBatchOnlyIgnoredNodes(mutations)) return;

            // v54: the full Messenger app is native territory. Do not even classify its
            // role=article message mutations as feed changes.
            if (runFBMessengerNativeMaintenance()) return;

            // v55: while backgrounded, Facebook may dehydrate/recycle visible FeedUnits.
            // Do not revoke terminal decisions or attach one-pixel gates to that transient DOM.
            if (document.hidden) {
                __fbFeedMutatedWhileHiddenV55 = true;
                return;
            }

            // v40: Stories are Facebook-native/animated. Keep the overlay smooth by not
            // waking full feed/search crawlers for every progress/DOM tick.
            if (runFBStoriesNativeMaintenance()) return;
            const interactionHot = isFBUserInteractionHotV53();
            if (!interactionHot && runFBNativeInteractiveLightLane()) return;

            // v39: same notification/menu fast paths as before, but without building throwaway
            // arrays for every mutation batch. Less garbage collection, same decisions.
            if (mutationBatchOnlyMatches(mutations, isNotificationPanelElement)) {
                protectNotificationSurfaces(document);
                return;
            }

            if (mutationBatchOnlyMatches(mutations, isFBNativeTransientMenuElement)) {
                runFBNativeTransientMenuMaintenance();
                return;
            }

            if (!interactionHot) {
                runFBObserverMaintenance();
                if (isFBFriendsSurfacePath()) learnFBTrustedProfilesFromFriendsSurface(document);
                if (isFBTrustedProfileTimelineSurface()) releaseFBTrustedTimelinePosts(document);
                if (updateFBCommentOverlayClass()) {
                    hideCriticalNavOnly();
                    return;
                }
                if (isFBNoPostScanUrl(window.location.href)) {
                    hideCriticalNavOnly();
                    return;
                }
            }

            // Check for search/feed-related changes first for instant processing.
            // Classic loops let us stop scanning the mutation batch once both flags are known.
            let hasSearchChanges = false;
            let hasHomeFeedUnitChanges = false;

            for (let m = 0; m < mutations.length; m++) {
                const mutation = mutations[m];

                const targetTouchesFeed = mutation.target && mutation.target.closest &&
                    !isFBInsideEmbeddedChatSurfaceV56(mutation.target) &&
                    !isNotificationPanelElement(mutation.target) && !isFBCommentSurfaceElement(mutation.target) && (
                    mutation.target.closest('div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [role="feed"], [role="feed"] [role="article"]') ||
                    mutation.target.getAttribute?.('role') === 'feed'
                );
                if (targetTouchesFeed) {
                    queueFBNativePostHydrationSyncV53(mutation.target);
                    hasHomeFeedUnitChanges = true;
                }

                const addedNodes = mutation.addedNodes;
                if (addedNodes && addedNodes.length) {
                    for (let n = 0; n < addedNodes.length; n++) {
                        const node = addedNodes[n];
                        if (!node || node.nodeType !== 1) continue;

                        if (isFBInsideEmbeddedChatSurfaceV56(node) || isFBEmbeddedChatMutationNodeV56(node)) {
                            // Native chat mutations are simply ignored here. The small observer
                            // performs a one-time cleanup only when a chat shell itself opens.
                            continue;
                        }

                        if (!hasSearchChanges && node.matches && (
                            node.matches('li[role="row"]') ||
                            node.matches('a[aria-describedby]') ||
                            node.matches('div[role="option"]') ||
                            node.matches('div[role="presentation"]')
                        )) {
                            hasSearchChanges = true;
                        }

                        const looksLikePostMutation = !isNotificationPanelElement(node) && !isFBCommentSurfaceElement(node) &&
                            containsNonEmbeddedChatFeedCandidateV56(node, feedDeepSelector);
                        if (looksLikePostMutation) {
                            queueFBNativePostHydrationSyncV53(node);
                            // Facebook may have replaced only an inner article of a FeedUnit whose
                            // final decision is already approved. Propagate that terminal state first;
                            // otherwise claim the canonical new post for one-time screening.
                            if (!inheritApprovedPostState(node)) {
                                markUnapprovedPostScreens(node);
                            }
                            hasHomeFeedUnitChanges = true;
                        }

                        if (hasSearchChanges && hasHomeFeedUnitChanges) break;
                    }
                }

                if (hasSearchChanges && hasHomeFeedUnitChanges) break;
            }

            // Process search results immediately if detected.
            if (hasSearchChanges) {
                processSearchResults();
            }

            // Home feed FeedUnits are softgated; approve/ban them without waiting for the 650ms cadence.
            if (hasHomeFeedUnitChanges) {
                updateFBHomeFeedGateClass();
                if (interactionHot) {
                    // New/recycled cards were locally soft-gated above. Let Facebook paint the
                    // scroll now; the trailing quiet pass makes the final approve/ban decision.
                    scheduleFBInteractionSettledPassV53();
                } else {
                    scanVisibleHomeFeedPostsFast();
                    // Coalesced hydration retry: one pending retry per burst instead of one timeout per mutation callback.
                    scheduleFBPostHydrationRetry();
                }
            }

            if (interactionHot) {
                scheduleFBInteractionSettledPassV53();
                return;
            }

            // Then run other filtering functions only when the mutation mattered.
            if (hasSearchChanges || hasHomeFeedUnitChanges || isCurrentSpecificUrlSurface() || isFBReelTabUrl(window.location.href)) {
                throttledRunAllFilters();
            }
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
        learnFBTrustedProfilesFromFriendsSurface(document);
        if (!__fbStrictAccountEnabled) return;

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
            if (isFBCommentSurfaceElement(element)) return '';

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

        // v50: use the single canonical friends-surface classifier.

        const isUnsafeToUseAsFriendCard = (element) => {
            try {
                if (!element || element === document.body || element === document.documentElement) return true;
                if (typeof isTopLeftSearchDropdownElement === 'function' && isTopLeftSearchDropdownElement(element)) return true;
                if (typeof isFBCommentSurfaceElement === 'function' && isFBCommentSurfaceElement(element)) return true;
                if (typeof isProbablyProfileHeaderSafeElement === 'function' && isProbablyProfileHeaderSafeElement(element)) return true;
                if (element.matches && element.matches('main, [role="main"], [role="feed"], header, [role="banner"], nav, [role="navigation"], [data-pagelet="ProfileHeader"], [data-pagelet="ProfileActions"]')) return true;
                if (element.querySelector && element.querySelector('[data-pagelet="ProfileActions"], h1, [role="feed"], [role="main"]')) return true;
            } catch (e) {}
            return false;
        };

        const profileHrefLooksLikeFriendListPerson = (href = '') => {
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

        const findFriendListCardShell = (element) => {
            try {
                if (!element) return null;

                const modernCard = element.closest && element.closest(modernProfileCardSelector);
                if (modernCard && !isUnsafeToUseAsFriendCard(modernCard)) return modernCard;

                const explicitCard = element.closest && element.closest('[role="listitem"], li, [role="row"]');
                if (explicitCard && !isUnsafeToUseAsFriendCard(explicitCard)) return explicitCard;

                let current = element;
                let best = null;
                for (let depth = 0; depth < 12 && current && current !== document.body && current !== document.documentElement; depth++) {
                    if (isUnsafeToUseAsFriendCard(current)) break;
                    if (current.matches && current.matches('div, li, [role="listitem"], [role="row"]')) {
                        const profileLinks = current.querySelectorAll ? Array.from(current.querySelectorAll('a[href]')).filter(a => profileHrefLooksLikeFriendListPerson(a.getAttribute('href') || a.href || '')).length : 0;
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

        const refreshRecycledProfileCard = (card) => {
            try {
                if (!card?.isConnected) return;
                const signature = buildFBElementDecisionSignature(card, 'profile-card');
                const previous = card.getAttribute('data-fb-profile-card-signature-v50') || '';
                if (previous && signature && previous !== signature) {
                    const wasHardHidden = hasFBCleanerHardHideClass(card);
                    if (wasHardHidden) clearFBCleanerHideStylesOnly(card);
                    card.classList.remove('fb-profile-card-processed', 'fb-profile-card-approved', 'fb-profile-card-banned', 'fb-element-banned');
                    card.removeAttribute('data-fb-v31-cache-type');
                    card.removeAttribute('data-fb-v31-cache-decision');
                    __fbElementDecisionCache.delete(card);
                }
                if (signature) card.setAttribute('data-fb-profile-card-signature-v50', signature);
            } catch (e) {}
        };

        document.querySelectorAll('.fb-profile-card-processed, .fb-profile-card-approved, .fb-profile-card-banned').forEach(refreshRecycledProfileCard);

        // Modern friends/profile cards, including x78zum5/xdt5ytf/x12upk82 and x12upk82/xod5an3 structures.
        document.querySelectorAll(modernProfileCardSelector + ':not(.fb-profile-card-processed)').forEach((card) => {
            if (isFBCommentSurfaceElement(card)) return;
            card.classList.add('fb-profile-card-processed');

            // Do not let the broader v22 selector grab profile headers, main wrappers, or large friend grids.
            if (isUnsafeToUseAsFriendCard(card)) {
                card.classList.add('fb-profile-card-approved');
                approvedCount++;
                return;
            }

            const profileLinkCount = card.querySelectorAll
                ? Array.from(card.querySelectorAll('a[href]')).filter(a => profileHrefLooksLikeFriendListPerson(a.getAttribute('href') || a.href || '')).length
                : 0;
            if (profileLinkCount > 4) {
                card.classList.add('fb-profile-card-approved');
                approvedCount++;
                return;
            }

            if (applyCachedFBProfileCardDecision(card)) {
                if (card.classList.contains('fb-profile-card-banned')) hiddenCount++;
                else approvedCount++;
                return;
            }

            const signal = collectSignals(card);
            if (isBlockedSignal(signal)) {
                rememberFBElementDecision(card, 'profile-card', 'banned', 'blocked profile card signal');
                hideElementHard(card, 'fb-profile-card-banned');
                hiddenCount++;
            } else {
                rememberFBElementDecision(card, 'profile-card', 'approved');
                card.classList.add('fb-profile-card-approved');
                approvedCount++;
            }
        });

        // Friends-page cards and their leftover empty shells expose the target name in the options button aria-label.
        document.querySelectorAll(optionSelector + ':not(.fb-profile-card-processed)').forEach((button) => {
            if (isFBCommentSurfaceElement(button)) return;
            button.classList.add('fb-profile-card-processed');
            const card = findSingleFriendCardShell(button);
            if (!card || card.classList.contains('fb-profile-card-banned')) return;
            if (applyCachedFBProfileCardDecision(card)) {
                if (card.classList.contains('fb-profile-card-banned')) hiddenCount++;
                else approvedCount++;
                return;
            }

            const signal = collectSignals(card) + ' ' + collectSignals(button);
            if (isBlockedSignal(signal)) {
                rememberFBElementDecision(card, 'profile-card', 'banned', 'blocked friend/options signal');
                hideElementHard(card, 'fb-profile-card-banned');
                hiddenCount++;
            } else {
                rememberFBElementDecision(card, 'profile-card', 'approved');
                card.classList.add('fb-profile-card-approved');
                approvedCount++;
            }
        });

        // v21: Any Facebook friend-list page, not just the logged-in user's own friends page.
        // This catches blocked people by FBID, vanity URL, aria-label/name, profile-picture alt/aria, and URL signals.
        if (isFBFriendsSurfacePath()) {
            document.querySelectorAll('a[href][aria-label], a[href*="profile.php?id="], a[href*="facebook.com/"]').forEach((link) => {
                try {
                    if (!link || link.classList.contains('fb-profile-card-processed')) return;
                    if (isFBCommentSurfaceElement(link)) return;
                    if (!profileHrefLooksLikeFriendListPerson(link.getAttribute('href') || link.href || '')) return;

                    const card = findFriendListCardShell(link);
                    if (!card || card.classList.contains('fb-profile-card-banned')) return;
                    if (card.classList.contains('fb-profile-card-processed')) return;
                    card.classList.add('fb-profile-card-processed');
                    if (applyCachedFBProfileCardDecision(card)) {
                        if (card.classList.contains('fb-profile-card-banned')) hiddenCount++;
                        else approvedCount++;
                        return;
                    }

                    const signal = collectSignals(card) + ' ' + collectSignals(link);
                    if (isBlockedSignal(signal)) {
                        rememberFBElementDecision(card, 'profile-card', 'banned', 'blocked friend-list signal');
                        hideElementHard(card, 'fb-profile-card-banned');
                        hiddenCount++;
                    } else {
                        rememberFBElementDecision(card, 'profile-card', 'approved');
                        card.classList.add('fb-profile-card-approved');
                        approvedCount++;
                    }
                } catch (e) {}
            });
        }

        // Right-rail chat/contact rows usually expose FBIDs through /messages/t/<id> links.
        document.querySelectorAll('a[href*="/messages/t/"], a[href*="messenger.com/t/"]').forEach((link) => {
            if (isFBCommentSurfaceElement(link)) return;
            const row = link.closest('[role="listitem"], li, [role="row"], [role="button"]') || link.closest('div') || link;
            if (!row || row.classList.contains('fb-profile-card-banned')) return;
            if (applyCachedFBProfileCardDecision(row)) return;
            const signal = collectSignals(row) + ' ' + collectSignals(link);
            if (isBlockedSignal(signal)) {
                rememberFBElementDecision(row, 'profile-card', 'banned', 'blocked messenger/contact signal');
                hideElementHard(row, 'fb-profile-card-banned');
                hiddenCount++;
            } else {
                rememberFBElementDecision(row, 'profile-card', 'approved');
            }
        });

        // v25.4.23: Facebook's right-side contacts can render as plain text/button rows before
        // useful /messages/t/ hrefs appear. Scan individual rows only, scoped to Haukkis strict account.
        const rightRailRoots = Array.from(document.querySelectorAll('[data-pagelet="RightRail"], [role="complementary"]'));
        rightRailRoots.forEach((rail) => {
            try {
                rail.querySelectorAll('[role="button"], [role="listitem"], [role="row"], a[href*="/messages/t/"], a[href*="profile.php?id="], a[href*="facebook.com/"]').forEach((seed) => {
                    try {
                        if (!seed || seed.classList.contains('fb-profile-card-banned')) return;
                        if (isFBCommentSurfaceElement(seed)) return;
                        const row = seed.closest('[role="listitem"], [role="row"], [role="button"]') || seed;
                        if (!row || row === rail || row.classList.contains('fb-profile-card-banned')) return;
                        if (row.closest('[aria-label*="Syntymäpäiv" i], [aria-label*="Birthday" i]')) return;

                        const visibleText = normalizeFBText(row.textContent || row.innerText || '');
                        if (!visibleText || visibleText.length > 180) return;
                        if (/^(yhteystiedot|contacts|ryhmäkeskustelut|group chats|luo ryhmäkeskustelu|create group chat|syntymäpäivät|birthdays)$/.test(visibleText)) return;

                        if (applyCachedFBProfileCardDecision(row)) return;
                        const signal = collectSignals(row) + ' ' + collectSignals(seed);
                        if (isBlockedSignal(signal)) {
                            rememberFBElementDecision(row, 'profile-card', 'banned', 'blocked right-rail contact signal');
                            hideElementHard(row, 'fb-profile-card-banned');
                            hiddenCount++;
                        } else {
                            rememberFBElementDecision(row, 'profile-card', 'approved');
                        }
                    } catch (e) {}
                });
            } catch (e) {}
        });

        if (hiddenCount > 0) devLog(`Hidden ${hiddenCount} blocked friend/contact/profile cards`);
        if (approvedCount > 0) devLog(`Approved ${approvedCount} friend/contact/profile cards`);
    } catch (e) {
        console.log('Error scrubbing friend/contact cards: ' + e.message);
    }
};


// ===== v56: embedded chat-tab native lane + exact identity micro-pass =====
const FB_EMBEDDED_CHAT_SCANNER_STATE_SELECTOR_V56 = [
    '.fb-post-screening-v47', '.fb-post-pending', '.fb-post-scanning',
    '.fb-post-expanding', '.fb-post-banned', '.fb-element-banned',
    '.fb-post-approved', '.fb-feed-unit-approved', '.fb-post-processed',
    '.fb-feed-slot-screening-v51', '.fb-feed-slot-hydrating-v52',
    '.fb-native-post-hydrating-v52', '.fb-feed-slot-banned-v49',
    '[data-fb-v25-scan-complete]', '[data-fb-v46-approved-key]',
    '[data-fb-v47-screen-start]', '[data-fb-v49-collapsed-slot]',
    '[data-fb-v52-hydrating-slot]'
].join(',');

const releaseFBEmbeddedChatPostScannerStateV56 = (root = document) => {
    try {
        const scanRoot = root?.querySelectorAll ? root : document;
        const surfaces = [];
        const addSurface = marker => {
            try {
                const surface = getFBEmbeddedChatRootV56(marker);
                if (surface && !surfaces.includes(surface) && surfaces.length < 12) surfaces.push(surface);
            } catch (e) {}
        };

        if (scanRoot.nodeType === 1) {
            if (isFBInsideEmbeddedChatSurfaceV56(scanRoot) || scanRoot.matches?.(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56)) addSurface(scanRoot);
            if (scanRoot.querySelector?.(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56)) {
                const markers = scanRoot.querySelectorAll(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56);
                for (let i = 0; i < markers.length && i < 24; i++) addSurface(markers[i]);
            }
        } else {
            const markers = document.querySelectorAll(FB_EMBEDDED_CHAT_MARKER_SELECTOR_V56);
            for (let i = 0; i < markers.length && i < 24; i++) addSurface(markers[i]);
        }

        let released = 0;
        const seen = new WeakSet();
        surfaces.forEach(surface => {
            try {
                surface.classList?.add('fb-embedded-chat-native-v56');
                const nodes = [];
                if (surface.matches?.(FB_EMBEDDED_CHAT_SCANNER_STATE_SELECTOR_V56)) nodes.push(surface);
                surface.querySelectorAll?.(FB_EMBEDDED_CHAT_SCANNER_STATE_SELECTOR_V56).forEach(node => {
                    if (nodes.length < 1200) nodes.push(node);
                });

                nodes.forEach(node => {
                    try {
                        if (!node?.classList || seen.has(node)) return;
                        seen.add(node);

                        // A whole chat tab hidden for an isolated FBID is intentional identity policy.
                        if (node.getAttribute?.('data-fb-isolated-identity-hide-v56') === '1') return;

                        const hadHardHide = hasFBCleanerHardHideClass(node);
                        if (hadHardHide) clearFBCleanerHideStylesOnly(node);
                        try { releaseFBNativeHydrationSlotV53(node); } catch (e) {}

                        node.classList.remove(
                            'fb-post-screening-v47', 'fb-post-pending', 'fb-post-scanning',
                            'fb-post-expanding', 'fb-post-banned', 'fb-element-banned',
                            'fb-post-approved', 'fb-feed-unit-approved', 'fb-post-processed',
                            'fb-feed-slot-screening-v51', 'fb-feed-slot-hydrating-v52',
                            'fb-native-post-hydrating-v52', 'fb-feed-slot-banned-v49'
                        );
                        [
                            'data-fb-v25-scan-complete', 'data-fb-v46-approved-key',
                            'data-fb-v47-screen-start', 'data-fb-v49-collapsed-slot',
                            'data-fb-v52-hydrating-slot', 'data-fb-v31-cache-type',
                            'data-fb-v31-cache-decision'
                        ].forEach(attr => node.removeAttribute?.(attr));
                        node.style?.removeProperty('--fb-v47-screen-height');
                        node.style?.removeProperty('--fb-v51-screen-height');
                        try { __fbPostHydrationState.delete(node); } catch (e) {}
                        released++;
                    } catch (e) {}
                });
            } catch (e) {}
        });
        return released;
    } catch (e) {
        return 0;
    }
};

const collectFBExactIdentityCarrierSignalV56 = (carrier) => {
    try {
        const chunks = [];
        const push = value => {
            const text = String(value || '').trim();
            if (text) chunks.push(text.slice(0, 1000));
        };
        const inspect = node => {
            if (!node) return;
            push(node.href || node.getAttribute?.('href'));
            [
                'data-fbid', 'data-profileid', 'data-profile-id', 'data-userid',
                'data-ownerid', 'data-hovercard', 'data-store', 'data-ft'
            ].forEach(attr => push(node.getAttribute?.(attr)));
        };
        inspect(carrier);
        const parentLink = carrier?.closest?.('a[href]');
        if (parentLink && parentLink !== carrier) inspect(parentLink);
        return chunks.join(' ');
    } catch (e) {
        return '';
    }
};

const isFBNotificationIdentityImmuneV57 = (element) => {
    try {
        const node = element?.nodeType === 1 ? element : element?.parentElement;
        if (!node?.closest) return false;
        if (node.closest('.fb-notifications-protected, [data-pagelet*="Notification" i], [aria-label*="Notifications" i], [aria-label*="Ilmoitukset" i]')) return true;
        const popup = node.closest('[role="dialog"], [role="menu"], [role="list"], [role="region"]');
        return !!(popup && isNotificationPanelElement(node));
    } catch (e) {
        return false;
    }
};

const findFBIsolatedIdentityShellV56 = (carrier) => {
    try {
        if (!carrier?.closest || isFBNotificationIdentityImmuneV57(carrier)) return null;

        const chatHeader = carrier.closest('[data-pagelet="MWChatTabHeader"]');
        if (chatHeader) return getFBEmbeddedChatRootV56(chatHeader);

        const href = String(carrier.href || carrier.getAttribute?.('href') || '');
        const isThreadCarrier = /\/(?:messages(?:\/e2ee)?|messenger)\/t\//i.test(href);
        const strictSurfaceSelector = [
            '[data-pagelet="RightRail"]', '[role="complementary"]',
            '[data-pagelet*="Messenger" i]', '[data-pagelet*="MWChat" i]',
            '[aria-label*="Yhteystiedot" i]', '[aria-label*="Contacts" i]',
            '[aria-label*="Keskustelut" i]', '[aria-label*="Chats" i]'
        ].join(',');

        let surface = carrier.closest(strictSurfaceSelector);
        if (!surface && isFBMessengerPath(window.location.href)) {
            surface = carrier.closest('[role="main"], main');
        }
        // Some Messenger dropdown builds expose only a thread href under a generic dialog.
        // This fallback is thread-link-only, so ordinary notification profile links cannot enter it.
        if (!surface && isThreadCarrier) {
            surface = carrier.closest('[role="dialog"], [role="menu"], [role="listbox"]');
        }
        if (!surface || isFBNotificationIdentityImmuneV57(surface)) return null;

        const explicit = carrier.closest('[role="listitem"], [role="row"], li');
        if (explicit && explicit !== surface && !explicit.querySelector?.('[role="textbox"], textarea, form')) return explicit;

        let node = carrier;
        let best = carrier.closest('a[href*="/messages/"], a[href*="/messenger/"]') || carrier;
        for (let depth = 0; node && node !== surface && depth < 8; depth++, node = node.parentElement) {
            if (!node.matches?.('div, li, a, [role="button"], [role="listitem"], [role="row"]')) continue;
            if (node.querySelector?.('[role="textbox"], textarea, form, h1')) break;
            const links = node.querySelectorAll?.('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"], a[href*="/messenger/t/"]') || [];
            if (links.length === 1) best = node;
            if (links.length > 2) break;
        }
        return best && best !== surface && !isFBNotificationIdentityImmuneV57(best) ? best : null;
    } catch (e) {
        return null;
    }
};

// One shared carrier selector for both the document-start precheck and the focused scrub.
// Generic profile anchors are only queried after the node is proven to be inside Contacts/Messenger.
const FB_EXACT_IDENTITY_CARRIER_SELECTOR_V56 = [
    'a[href*="/messages/t/"]', 'a[href*="/messages/e2ee/t/"]',
    'a[href*="/messenger/t/"]', '[data-pagelet="MWChatTabHeader"] a[href]',
    'a[href^="/"]', 'a[href*="facebook.com/"]',
    '[data-fbid]', '[data-profileid]', '[data-profile-id]',
    '[data-userid]', '[data-ownerid]'
].join(',');

const scrubFBIsolatedIdentityCarriersNowV56 = (root = document) => {
    try {
        // Account scope is already cached by refreshAccountScopedFilters(). Calling it for
        // every mutation was needlessly waking the whole regex/filter setup.
        if (!__fbStrictAccountEnabled && !isFBStrictElementAccount()) return 0;
        if (root?.nodeType === 1 && isFBNotificationIdentityImmuneV57(root)) return 0;

        const scanRoot = root?.querySelectorAll ? root : document;
        const carriers = [];
        if (scanRoot.nodeType === 1 && scanRoot.matches?.(FB_EXACT_IDENTITY_CARRIER_SELECTOR_V56)) carriers.push(scanRoot);
        scanRoot.querySelectorAll?.(FB_EXACT_IDENTITY_CARRIER_SELECTOR_V56).forEach(node => {
            if (carriers.length < 420) carriers.push(node);
        });

        let hidden = 0;
        const seenShells = new WeakSet();
        carriers.forEach(carrier => {
            try {
                if (isFBNotificationIdentityImmuneV57(carrier)) return;
                const signal = collectFBExactIdentityCarrierSignalV56(carrier);
                const shell = findFBIsolatedIdentityShellV56(carrier);
                if (!shell || seenShells.has(shell)) return;
                seenShells.add(shell);

                if (!matchesAnyBlockedFbid(signal)) {
                    if (shell.getAttribute?.('data-fb-isolated-identity-hide-v56') === '1') {
                        clearFBCleanerHideStylesOnly(shell);
                        shell.classList.remove('fb-profile-card-banned', 'fb-element-banned');
                        shell.removeAttribute('data-fb-isolated-identity-hide-v56');
                    }
                    return;
                }

                shell.setAttribute?.('data-fb-isolated-identity-hide-v56', '1');
                try { rememberFBElementDecision(shell, 'profile-card', 'banned', 'exact isolated FBID no-glimpse v56'); } catch (e) {}
                hideElementHard(shell, 'fb-profile-card-banned');
                hidden++;
            } catch (e) {}
        });
        return hidden;
    } catch (e) {
        return 0;
    }
};

// Paint-time precheck for the small identity/chat observer. The main Facebook observer is
// installed at DOMContentLoaded; this one attaches immediately at document-start so initial
// contact rows cannot paint first and get removed a moment later.
const FB_IDENTITY_NATIVE_SCOPE_SELECTOR_V57 = [
    '[data-pagelet="RightRail"]', '[role="complementary"]',
    '[data-pagelet*="Messenger" i]', '[data-pagelet*="MWChat" i]',
    '[aria-label*="Yhteystiedot" i]', '[aria-label*="Contacts" i]',
    '[aria-label*="Keskustelut" i]', '[aria-label*="Chats" i]'
].join(',');

const FB_EMBEDDED_CHAT_ROOT_INSERT_SELECTOR_V57 = [
    '[data-pagelet="MWChatTabHeader"]',
    '[data-pagelet="MAWSecureThreadDetailWrapper"]'
].join(',');

const fbNodeMayContainIsolatedIdentityV56 = (node) => {
    try {
        if (!node || node.nodeType !== 1 || isFBNotificationIdentityImmuneV57(node)) return false;

        // Check the narrow surface first. Feed posts commonly carry data-fbid attributes;
        // searching those before knowing we are inside Contacts/Messenger was the hot path.
        const nativeScope = isFBMessengerPath(window.location.href) ||
            !!node.closest?.(FB_IDENTITY_NATIVE_SCOPE_SELECTOR_V57) ||
            !!node.matches?.(FB_IDENTITY_NATIVE_SCOPE_SELECTOR_V57) ||
            !!node.querySelector?.(FB_IDENTITY_NATIVE_SCOPE_SELECTOR_V57);
        if (nativeScope) {
            return !!(
                node.matches?.(FB_EXACT_IDENTITY_CARRIER_SELECTOR_V56) ||
                node.querySelector?.(FB_EXACT_IDENTITY_CARRIER_SELECTOR_V56)
            );
        }

        // Allow generic popup handling only when the inserted subtree contains an actual
        // Messenger thread URL. Profile/data IDs alone are not enough—notifications have those.
        const thread = node.matches?.('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"], a[href*="/messenger/t/"]')
            ? node
            : node.querySelector?.('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"], a[href*="/messenger/t/"]');
        return !!(thread && thread.closest?.('[role="dialog"], [role="menu"], [role="listbox"]') && !isFBNotificationIdentityImmuneV57(thread));
    } catch (e) {
        return false;
    }
};

let __fbIdentityChatMicroObserverInstalledV56 = false;
const installFBIdentityChatMicroObserverV56 = () => {
    try {
        if (__fbIdentityChatMicroObserverInstalledV56 || !document.documentElement) return;
        __fbIdentityChatMicroObserverInstalledV56 = true;

        const observer = trackObserver(new MutationObserver(mutations => {
            if (document.hidden) return;
            const identityRoots = new Set();
            const chatRoots = new Set();

            for (let mi = 0; mi < mutations.length; mi++) {
                const added = mutations[mi].addedNodes || [];
                for (let ni = 0; ni < added.length; ni++) {
                    const node = added[ni];
                    if (!node || node.nodeType !== 1 || isFBNotificationIdentityImmuneV57(node)) continue;

                    // Only a newly opened chat shell needs cleanup. Individual MWMessageRow
                    // insertions are already excluded by the main feed observer and must not
                    // trigger a 1,200-node chat-tree sweep for every incoming message.
                    const chatMarker = node.matches?.(FB_EMBEDDED_CHAT_ROOT_INSERT_SELECTOR_V57)
                        ? node
                        : node.querySelector?.(FB_EMBEDDED_CHAT_ROOT_INSERT_SELECTOR_V57);
                    if (chatMarker && chatRoots.size < 8) chatRoots.add(chatMarker);

                    if (__fbStrictAccountEnabled && identityRoots.size < 24 && fbNodeMayContainIsolatedIdentityV56(node)) {
                        identityRoots.add(node);
                    }
                }
            }

            chatRoots.forEach(root => {
                try { releaseFBEmbeddedChatPostScannerStateV56(root); } catch (e) {}
            });
            identityRoots.forEach(root => {
                try { scrubFBIsolatedIdentityCarriersNowV56(root); } catch (e) {}
            });
        }));
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // Catch only existing native identity/chat roots. A document-wide data-* scan here was
        // expensive and unnecessary; the document-start observer covers new rows before paint.
        try {
            const roots = document.querySelectorAll(FB_IDENTITY_NATIVE_SCOPE_SELECTOR_V57);
            for (let i = 0; i < roots.length && i < 16; i++) scrubFBIsolatedIdentityCarriersNowV56(roots[i]);
        } catch (e) {}
        try {
            const chats = document.querySelectorAll(FB_EMBEDDED_CHAT_ROOT_INSERT_SELECTOR_V57);
            for (let i = 0; i < chats.length && i < 8; i++) releaseFBEmbeddedChatPostScannerStateV56(chats[i]);
        } catch (e) {}
    } catch (e) {
        __fbIdentityChatMicroObserverInstalledV56 = false;
    }
};


installFBIdentityChatMicroObserverV56();


// ===== v54: MESSENGER FULL-PAGE NATIVE LANE =====
// No feed/post/search/profile/content filtering on /messages* or /messenger*.
// The only allowed identity action is hiding a blocked person's inbox/contact row,
// based on identity-facing attributes/name fields rather than the message preview text.
const collectFBMessengerRowIdentitySignal = (row, link) => {
    try {
        const chunks = [];
        const push = value => {
            const text = String(value || '').trim();
            if (text) chunks.push(text.slice(0, 500));
        };
        const inspect = node => {
            if (!node) return;
            push(node.href || node.getAttribute?.('href'));
            push(node.src || node.getAttribute?.('src'));
            [
                'aria-label', 'title', 'alt', 'data-fbid', 'data-profileid', 'data-profile-id',
                'data-userid', 'data-ownerid', 'data-hovercard', 'data-store', 'data-ft'
            ].forEach(attr => push(node.getAttribute?.(attr)));
        };

        inspect(link);
        inspect(row);
        const identityNodes = row?.querySelectorAll?.([
            'img[alt]', 'img[aria-label]', '[role="img"][aria-label]',
            'a[aria-label]', 'a[title]', '[data-fbid]', '[data-profileid]',
            '[data-profile-id]', '[data-userid]', '[data-ownerid]', '[data-hovercard]'
        ].join(',')) || [];
        for (let i = 0; i < identityNodes.length && i < 24; i++) inspect(identityNodes[i]);

        // Messenger's first short dir=auto label is normally the conversation/person name.
        // Do not feed the whole row text to regexes: it contains the latest message preview.
        const labels = row?.querySelectorAll?.('span[dir="auto"], strong, h3, h4') || [];
        for (let i = 0, kept = 0; i < labels.length && kept < 1; i++) {
            const value = String(labels[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (!value || value.length > 120) continue;
            push(value);
            kept++;
        }
        return chunks.join(' ');
    } catch (e) {
        return '';
    }
};

const findFBMessengerInboxRow = (link) => {
    try {
        if (!link?.closest) return null;
        const direct = link.closest('[role="listitem"], [role="row"], li, [role="button"]');
        if (direct && !direct.matches?.('main, [role="main"]')) return direct;

        let node = link;
        let best = null;
        for (let depth = 0; node && node !== document.body && depth < 7; depth++, node = node.parentElement) {
            if (!node.matches?.('div, li, [role="listitem"], [role="row"], [role="button"]')) continue;
            if (node.matches?.('main, [role="main"], [role="navigation"], [role="banner"]')) break;
            if (node.querySelector?.('[role="textbox"], textarea, form')) break;
            const threadLinks = node.querySelectorAll?.('a[href*="/messages/"]') || [];
            if (threadLinks.length === 1) best = node;
            if (threadLinks.length > 2) break;
        }
        return best;
    } catch (e) {
        return null;
    }
};

const scrubBlockedMessengerInboxRows = (root = document) => {
    try {
        if (!isFBMessengerPath(window.location.href)) return 0;
        refreshAccountScopedFilters();
        if (!__fbStrictAccountEnabled) return 0;

        const scanRoot = root?.querySelectorAll ? root : document;
        const links = [];
        if (scanRoot.nodeType === 1 && scanRoot.matches?.('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"], a[href*="/messenger/t/"]')) links.push(scanRoot);
        scanRoot.querySelectorAll?.('a[href*="/messages/t/"], a[href*="/messages/e2ee/t/"], a[href*="/messenger/t/"]').forEach(link => {
            if (links.length < 300) links.push(link);
        });

        let hidden = 0;
        const seen = new WeakSet();
        links.forEach(link => {
            try {
                const row = findFBMessengerInboxRow(link);
                if (!row || seen.has(row)) return;
                seen.add(row);
                if (row.closest?.('[role="banner"], [role="navigation"]')) return;
                if (row.querySelector?.('[role="textbox"], textarea, form')) return;

                const signal = collectFBMessengerRowIdentitySignal(row, link);
                const href = String(link.href || link.getAttribute?.('href') || '');
                const explicitlyHiddenMessengerThread = /\/messages\/(?:e2ee\/)?t\/36327(?:,2227039302)?(?:\/|$|[?#])/i.test(href);
                // Messenger is not a content-filtering surface. Match only Haukkis' explicit
                // isolated identities/names here; global feed keywords and post URL bans are irrelevant.
                const isolatedNameMatch = isolatedRegex.some(pattern => testRegexPattern(pattern, signal));
                const blocked = explicitlyHiddenMessengerThread || matchesAnyBlockedFbid(signal) || isolatedNameMatch;
                if (!blocked) {
                    // Virtualized inbox rows are recycled. Release only prior profile-card state.
                    if (row.classList.contains('fb-profile-card-banned')) {
                        clearFBCleanerHideStylesOnly(row);
                        row.classList.remove('fb-profile-card-banned', 'fb-element-banned');
                    }
                    row.classList.add('fb-profile-card-approved');
                    return;
                }

                rememberFBElementDecision(row, 'profile-card', 'banned', 'blocked Messenger inbox identity');
                hideElementHard(row, 'fb-profile-card-banned');
                hidden++;
            } catch (e) {}
        });
        return hidden;
    } catch (e) {
        return 0;
    }
};

const releaseFBMessengerPostScannerState = (root = document) => {
    try {
        if (!isFBMessengerPath(window.location.href)) return 0;
        const scanRoot = root?.querySelectorAll ? root : document;
        const selector = [
            '.fb-post-screening-v47', '.fb-post-pending', '.fb-post-scanning',
            '.fb-post-expanding', '.fb-post-banned', '[role="article"].fb-element-banned',
            '.fb-post-approved', '.fb-feed-unit-approved', '.fb-post-processed',
            '.fb-feed-slot-screening-v51', '.fb-feed-slot-hydrating-v52',
            '.fb-native-post-hydrating-v52', '.fb-feed-slot-banned-v49',
            '[data-fb-v25-scan-complete]', '[data-fb-v46-approved-key]'
        ].join(',');
        const nodes = [];
        if (scanRoot.nodeType === 1 && scanRoot.matches?.(selector)) nodes.push(scanRoot);
        scanRoot.querySelectorAll?.(selector).forEach(node => { if (nodes.length < 800) nodes.push(node); });

        let released = 0;
        nodes.forEach(node => {
            try {
                if (!node?.classList) return;
                const wasHardHidden = hasFBCleanerHardHideClass(node);
                if (wasHardHidden) clearFBCleanerHideStylesOnly(node);
                const releaseArticleElementBan = node.matches?.('[role="article"].fb-element-banned');
                node.classList.remove(
                    'fb-post-screening-v47', 'fb-post-pending', 'fb-post-scanning',
                    'fb-post-expanding', 'fb-post-banned', 'fb-post-approved',
                    'fb-feed-unit-approved', 'fb-post-processed', 'fb-feed-slot-screening-v51',
                    'fb-feed-slot-hydrating-v52', 'fb-native-post-hydrating-v52',
                    'fb-feed-slot-banned-v49'
                );
                if (releaseArticleElementBan) node.classList.remove('fb-element-banned');
                node.removeAttribute?.('data-fb-v49-collapsed-slot');
                node.removeAttribute?.('data-fb-v47-screen-start');
                node.removeAttribute?.('data-fb-v25-scan-complete');
                node.removeAttribute?.('data-fb-v46-approved-key');
                node.style?.removeProperty('--fb-v47-screen-height');
                node.style?.removeProperty('--fb-v51-screen-height');
                try { __fbPostHydrationState.delete(node); } catch (e) {}
                released++;
            } catch (e) {}
        });
        return released;
    } catch (e) {
        return 0;
    }
};

let __fbMessengerNativeLastMaintenanceV54 = 0;
let __fbMessengerNativeWasActiveV54 = false;
const runFBMessengerNativeMaintenance = (force = false) => {
    try {
        const active = isFBMessengerPath(window.location.href);
        const entered = active && !__fbMessengerNativeWasActiveV54;
        __fbMessengerNativeWasActiveV54 = active;
        document.documentElement?.classList.toggle('fb-messenger-native-v54', active);
        document.documentElement?.classList.toggle('fb-isolated-identity-prehide-v56', isFBStrictElementAccount());
        if (!active) return false;

        // Broad account CSS must stay off here. Hidden inbox people are handled narrowly below.
        document.documentElement?.classList.remove(
            'fb-strict-element-hiding-v37', 'fb-home-feed-unit-softgate-v23',
            'fb-feed-screening-gate-v46', 'fb-specific-url-noglimpse-v26',
            'fb-friends-card-softgate-v2', 'is-search-page',
            'fb-comment-overlay-active-v35', 'fb-native-top-search-handoff-v15'
        );
        document.body?.classList.remove('is-search-page');

        const now = Date.now();
        // One full cleanup on entry is enough. Every feed/post writer is route-guarded below,
        // so doing a document-wide marker query for every Messenger DOM mutation would merely
        // replace the old stutter with a new one.
        if (force || entered) releaseFBMessengerPostScannerState(document);
        if (force || now - __fbMessengerNativeLastMaintenanceV54 >= 500) {
            __fbMessengerNativeLastMaintenanceV54 = now;
            scrubFBIsolatedIdentityCarriersNowV56(document);
            scrubBlockedMessengerInboxRows(document);
        }
        return true;
    } catch (e) {
        return isFBMessengerPath(window.location.href);
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

        const isLikesOverlayDialog = (dialog) => isFBLikesOverlayDialog(dialog);

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

// v43: coalesced likes/reactions observer. Any dialog mutation may wake this cheap
// classifier, but the softgate and expensive row scrubber run only for verified likes dialogs.
let __fbLikesOverlayScanQueued = false;
const scheduleFBLikesOverlayScan = () => {
    try {
        if (isFBMessengerPath(window.location.href)) return;
        if (__fbLikesOverlayScanQueued) return;
        __fbLikesOverlayScanQueued = true;
        addTimeout(() => {
            __fbLikesOverlayScanQueued = false;
            try {
                if (!markFBLikesOverlayDialogs()) return;
                if (isFBCosmeticElementHidingAllowed()) activateFBLikesOverlaySoftGate();
                scrubBlockedLikesOverlayRows();
                addTimeout(() => {
                    try {
                        if (isFBMessengerPath(window.location.href)) return;
                        if (markFBLikesOverlayDialogs()) scrubBlockedLikesOverlayRows();
                    } catch (e) {}
                }, 280);
            } catch (e) {}
        }, 90);
    } catch (e) {}
};

const likesOverlayFastObserver = trackObserver(new MutationObserver((mutations) => {
    try {
        if (isFBMessengerPath(window.location.href)) return;
        for (let m = 0; m < mutations.length; m++) {
            const added = mutations[m].addedNodes;
            for (let i = 0; added && i < added.length; i++) {
                const node = added[i];
                if (!node || node.nodeType !== 1) continue;
                if (
                    node.matches?.('[role="dialog"], div[data-visualcompletion="ignore-dynamic"]') ||
                    node.closest?.('[role="dialog"]') ||
                    node.querySelector?.('[role="dialog"], [role="dialog"] div[data-visualcompletion="ignore-dynamic"]')
                ) {
                    scheduleFBLikesOverlayScan();
                    return;
                }
            }
        }
    } catch (e) {}
}));

try {
    likesOverlayFastObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
} catch (e) {}

// ===== v42: native interaction light-lane + video play overlay smoother =====
// Goal: keep Facebook's own animated/native surfaces responsive (reactions, likes,
// notifications, messages, media dialogs) without removing any existing blockers/lists.
// Heavy feed/search/profile crawlers still run normally when those overlays are closed.
const FB_NATIVE_LIGHTLANE = {
    lastLightMaintenance: 0,
    lastNavMaintenance: 0,
    lastLikesScrub: 0,
    lastVideoSync: 0,
    videoCssInjected: false
};

const fbNow = () => {
    try { return (performance && performance.now) ? performance.now() : Date.now(); }
    catch (e) { return Date.now(); }
};

const injectFBVideoOverlaySmoothCSS = () => {
    try {
        if (FB_NATIVE_LIGHTLANE.videoCssInjected && document.getElementById('fb-video-overlay-smooth-style-v42')) return;
        let style = document.getElementById('fb-video-overlay-smooth-style-v42');
        if (!style) {
            style = document.createElement('style');
            style.id = 'fb-video-overlay-smooth-style-v42';
        }

        style.textContent = `
            /* v42: Facebook can leave the 72px play sprite mounted after playback starts.
               Hide only nodes JS marks while their nearby <video> is actively playing. */
            .fb-video-play-overlay-hidden-v42,
            .fb-video-play-overlay-hidden-v42 *,
            [role="dialog"] .fb-video-play-overlay-hidden-v42,
            [role="dialog"] .fb-video-play-overlay-hidden-v42 *,
            [role="article"] .fb-video-play-overlay-hidden-v42,
            [role="article"] .fb-video-play-overlay-hidden-v42 *,
            [data-pagelet^="FeedUnit_"] .fb-video-play-overlay-hidden-v42,
            [data-pagelet^="FeedUnit_"] .fb-video-play-overlay-hidden-v42 *,
            [data-pagelet^="TimelineFeedUnit_"] .fb-video-play-overlay-hidden-v42,
            [data-pagelet^="TimelineFeedUnit_"] .fb-video-play-overlay-hidden-v42 * {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                content-visibility: hidden !important;
                transition: none !important;
                animation: none !important;
            }
        `;

        if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
        FB_NATIVE_LIGHTLANE.videoCssInjected = true;
    } catch (e) {}
};

const isFBVideoActuallyPlaying = (video) => {
    try {
        return !!(video && !video.paused && !video.ended && video.readyState >= 2);
    } catch (e) {
        return false;
    }
};

const getFBVideoSurface = (video) => {
    try {
        if (!video || !video.closest) return null;
        return video.closest('[role="dialog"], [role="article"], div[data-pagelet^="FeedUnit_"], div[data-pagelet^="TimelineFeedUnit_"], [data-pagelet="MediaViewerPhoto"], [data-pagelet="TahoeRightRail"]') || video.parentElement;
    } catch (e) {
        return null;
    }
};

const syncFBVideoPlayOverlay = (root = document, force = false) => {
    try {
        const now = fbNow();
        if (!force && (now - FB_NATIVE_LIGHTLANE.lastVideoSync) < 160) return;
        FB_NATIVE_LIGHTLANE.lastVideoSync = now;
        injectFBVideoOverlaySmoothCSS();

        const scanRoot = (root && root.querySelectorAll) ? root : document;
        const videos = [];
        if (scanRoot.nodeType === 1 && scanRoot.matches?.('video')) videos.push(scanRoot);
        scanRoot.querySelectorAll?.('video').forEach(video => videos.push(video));
        if (!videos.length) return;

        videos.slice(0, 8).forEach(video => {
            try {
                const surface = getFBVideoSurface(video);
                if (!surface || !surface.querySelectorAll) return;
                const playing = isFBVideoActuallyPlaying(video);
                const buttons = surface.querySelectorAll([
                    '[role="button"][aria-label="Toista video"]',
                    '[role="button"][aria-label="Play video"]',
                    '[role="button"][aria-label*="Toista video" i]',
                    '[role="button"][aria-label*="Play video" i]'
                ].join(','));

                buttons.forEach(button => {
                    try {
                        const wrapper = (button.parentElement && button.parentElement.tagName === 'I') ? button.parentElement : button;
                        if (playing) {
                            button.classList.add('fb-video-play-overlay-hidden-v42');
                            wrapper.classList.add('fb-video-play-overlay-hidden-v42');
                        } else {
                            button.classList.remove('fb-video-play-overlay-hidden-v42');
                            wrapper.classList.remove('fb-video-play-overlay-hidden-v42');
                        }
                    } catch (e) {}
                });
            } catch (e) {}
        });
    } catch (e) {}
};

const isFBLikesOrReactionDialog = (dialog) => isFBLikesOverlayDialog(dialog);

const isFBMessengerDialog = (dialog) => {
    try {
        if (!dialog || !dialog.querySelector) return false;
        const aria = String(dialog.getAttribute?.('aria-label') || '');
        const text = String(dialog.textContent || '').slice(0, 2000);
        const combo = `${aria} ${text}`.toLowerCase();
        return combo.includes('messenger') || combo.includes('keskustelu') || combo.includes('chat') ||
               combo.includes('viesti') || combo.includes('message') ||
               !!dialog.querySelector('[aria-label="Messenger"], [aria-label*="Messenger" i], [aria-label="Viesti"], [aria-label="Message"], [role="textbox"]');
    } catch (e) {
        return false;
    }
};

const isFBMediaDialog = (dialog) => {
    try {
        if (!dialog || !dialog.querySelector) return false;
        return !!dialog.querySelector('video, [role="button"][aria-label="Toista video"], [role="button"][aria-label="Play video"], [data-pagelet="MediaViewerPhoto"], [data-pagelet="TahoeRightRail"]');
    } catch (e) {
        return false;
    }
};

const isFBNativeInteractionDialog = (dialog) => {
    try {
        if (!dialog || !dialog.isConnected) return false;
        if (isNotificationPanelElement(dialog)) return true;
        if (isFBActiveCommentOverlay(dialog)) return true;
        if (isFBLikesOrReactionDialog(dialog)) return true;
        if (isFBMessengerDialog(dialog)) return true;
        if (isFBMediaDialog(dialog)) return true;

        const rect = dialog.getBoundingClientRect ? dialog.getBoundingClientRect() : null;
        if (rect && rect.width >= 260 && rect.height >= 140) {
            const text = String(dialog.textContent || '').slice(0, 1600).toLowerCase();
            if (text.includes('notifications') || text.includes('ilmoitukset') || text.includes('share') || text.includes('jaa')) return true;
        }
    } catch (e) {}
    return false;
};

const isFBNativeInteractiveSurfaceOpen = () => {
    try {
        if (isFBStoriesNativeSurface(window.location.href)) return true;
        if (document.documentElement?.classList.contains('fb-comment-overlay-active-v35')) return true;

        const activeElement = document.activeElement;
        const activeSurface = activeElement?.closest?.('[role="menu"], [role="listbox"], [role="tooltip"], [role="dialog"]');
        if (activeSurface && activeSurface.getAttribute?.('aria-hidden') !== 'true' && !activeSurface.hidden) return true;

        // A newly created dialog must enter the native light lane before its text/labels finish
        // hydrating. Waiting to classify it as comments/notifications/likes creates the race that
        // lets feed scanners touch the half-built overlay.
        // One combined selector walk replaces the old menu probe plus separate dialog walk.
        const surfaces = document.querySelectorAll('[role="menu"], [role="listbox"], [role="tooltip"], [role="dialog"]');
        for (let i = 0; i < surfaces.length && i < 12; i++) {
            const surface = surfaces[i];
            if (!surface || !surface.isConnected || surface.getAttribute?.('aria-hidden') === 'true') continue;
            if (surface.hidden) continue;
            if (surface.getAttribute?.('role') !== 'dialog') return true;
            const rects = surface.getClientRects ? surface.getClientRects() : null;
            if (!rects || rects.length > 0) return true;
        }
    } catch (e) {}
    return false;
};

const updateFBNativeInteractiveClass = () => {
    try {
        const active = isFBNativeInteractiveSurfaceOpen();
        if (document.documentElement) document.documentElement.classList.toggle('fb-native-interaction-lightlane-v42', active);
        return active;
    } catch (e) {
        return false;
    }
};

const runFBNativeInteractiveLightLane = (force = false) => {
    try {
        if (runFBStoriesNativeMaintenance()) return true;
        if (!updateFBNativeInteractiveClass()) return false;

        const now = fbNow();
        if (force || (now - FB_NATIVE_LIGHTLANE.lastLightMaintenance) >= 550) {
            FB_NATIVE_LIGHTLANE.lastLightMaintenance = now;
            try { if (typeof refreshFBNativeTopSearchHandoff === 'function') refreshFBNativeTopSearchHandoff(); } catch (e) {}
            try { protectNotificationSurfaces(document); } catch (e) {}
        }

        if (force || (now - FB_NATIVE_LIGHTLANE.lastNavMaintenance) >= 1200) {
            FB_NATIVE_LIGHTLANE.lastNavMaintenance = now;
            try { hideCriticalNavOnly(); } catch (e) {}
        }

        syncFBVideoPlayOverlay(document, force);

        // Likes/reactions filtering remains alive, but only after the dialog passes the
        // authoritative classifier. Ordinary notifications/comments never receive the gate.
        if ((force || (now - FB_NATIVE_LIGHTLANE.lastLikesScrub) >= 650) && markFBLikesOverlayDialogs()) {
            FB_NATIVE_LIGHTLANE.lastLikesScrub = now;
            try {
                if (isFBCosmeticElementHidingAllowed()) activateFBLikesOverlaySoftGate();
                scrubBlockedLikesOverlayRows();
            } catch (e) {}
        }
        return true;
    } catch (e) {
        return false;
    }
};

try {
    injectFBVideoOverlaySmoothCSS();
    onWindowEvent(document, 'play', (event) => syncFBVideoPlayOverlay(event.target || document, true), true);
    onWindowEvent(document, 'pause', (event) => syncFBVideoPlayOverlay(event.target || document, true), true);
    onWindowEvent(document, 'ended', (event) => syncFBVideoPlayOverlay(event.target || document, true), true);
} catch (e) {}

// ===== TOP FEED SETTLING AUDITOR v45 (retained compatibility fallback; v46 does not schedule it) =====
// Audits only still-unapproved top units. Once a post receives the final approved decision,
// it is never re-evaluated; this avoids repeated scans and menu/input stutter.
const auditTopFeedPostsForLateBlockedSignals = () => {
    try {
        if (isFBMessengerPath(window.location.href)) return;
        if (isFBTrustedProfileTimelineSurface()) {
            releaseFBTrustedTimelinePosts(document);
            return;
        }
        if (isFBSearchPagePath()) return;
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
                    const canonicalPost = getFBFeedUnitWrapper(el) || el;
                    if (!canonicalPost || seen.has(canonicalPost)) return;
                    seen.add(canonicalPost);
                    posts.push(canonicalPost);
                });
            } catch (e) {}
        });

        let hidden = 0;
        posts.slice(0, 8).forEach(post => {
            if (!post || post.classList.contains('fb-post-banned') || post.classList.contains('fb-element-banned')) return;
            if (post.getAttribute('data-fb-v25-scan-complete') === '1' && post.classList.contains('fb-post-approved')) return;
            if (isSafeElement(post) || isProfileHeaderProtectedArea(post)) return;
            post.classList.add('fb-post-screening-v47');

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
            const blocked = postHasAIInfoTag(post) || hasRestrictedFeedCTAOrReels(post) || matchesAnyActiveRegex(signal) || matchesAnyBlockedFbid(signal) || matchesAnyBlockedUrl(signal);

            if (blocked) {
                banPostAfterScan(post, postHasAIInfoTag(post) ? 'Facebook AI-info disclosure tag settling audit' : 'late hydrated blocked signal');
                hidden++;
            } else {
                approvePostAfterScan(post);
            }
        });

        if (hidden > 0) devLog(`Late-audited and hidden ${hidden} hydrated top feed post(s)`);
    } catch (e) {
        console.log('Error auditing top feed posts: ' + e.message);
    }
};

const scrubBlockedProfileHeaderBits = () => {
    try {
        if (isFBTrustedProfileRoute(window.location.href)) return;
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

const FB_PERSONAL_PROFILE_URLS = [
    'https://www.facebook.com/Haukkis/friends',
    'https://www.facebook.com/Haukkis/friends_all',
    'https://www.facebook.com/Haukkis/friends_with_upcoming_birthdays'
];

const __fbPerf = {
    routeKey: '',
    last: Object.create(null),
    lastPrehideRouteKey: ''
};

const getFBRouteKey = () => {
    try { return `${location.pathname || '/'}${location.search || ''}`; }
    catch (e) { return ''; }
};

const shouldRunCadenced = (key, ms, force = false) => {
    try {
        const now = (performance && performance.now) ? performance.now() : Date.now();
        const routeKey = getFBRouteKey();
        const scopedKey = `${key}::${routeKey}`;
        const last = __fbPerf.last[scopedKey] || 0;
        if (force || !last || (now - last) >= ms) {
            __fbPerf.last[scopedKey] = now;
            return true;
        }
    } catch (e) {
        return true;
    }
    return false;
};

const isCurrentPersonalProfileSurface = () => {
    try { return isSupportedFacebookPage(window.location.href, FB_PERSONAL_PROFILE_URLS); }
    catch (e) { return false; }
};

const refreshSpecificUrlPrehide = (force = false) => {
    try {
        const routeKey = getFBRouteKey();
        if (!force && __fbPerf.lastPrehideRouteKey === routeKey) return;
        __fbPerf.lastPrehideRouteKey = routeKey;
        injectSpecificUrlPrehideCSS();
    } catch (e) {}
};

const runSpecificSurfaceFilters = (force = false) => {
    try {
        refreshSpecificUrlPrehide(force);

        const specificUrlSurface = isCurrentSpecificUrlSurface();
        const specificProfileSurface = isCurrentSpecificProfileSurface();
        const personalProfileSurface = isCurrentPersonalProfileSurface();
        if (!specificUrlSurface && !specificProfileSurface && !personalProfileSurface) return;

        // These selector packs are the expensive ones. Run immediately on route changes/init,
        // then at a calmer cadence while the user stays on that same heavy page.
        if (!shouldRunCadenced('specificSurfaces', 1000, force)) return;

        if (specificUrlSurface) {
            deleteSelectorsForSpecificUrl();
            scrubSpecificUrlNonFeedModules(document);
        }
        if (specificProfileSurface) deleteSelectorsForSpecificProfile();
        if (personalProfileSurface) deleteSelectorsForPersonalProfile();
    } catch (e) {
        console.log('Error running optimized specific surface filters: ' + e.message);
    }
};

const runGeneralHeavyFilters = (force = false) => {
    try {
        if (runFBNativeInteractiveLightLane()) return;
        if (updateFBCommentOverlayClass()) {
            hideCriticalNavOnly();
            return;
        }
        if (isFBNoPostScanUrl(window.location.href)) return;

        const trustedTimeline = isFBTrustedProfileTimelineSurface();
        if (trustedTimeline) {
            updateFBHomeFeedGateClass();
            releaseFBTrustedTimelinePosts(document);
        } else {
            // Core feed/post safety lane. This is the only frequent heavy lane.
            if (shouldRunCadenced('corePostSafety', 1250, force)) {
                updateFBHomeFeedGateClass();
                scanAndBanEntirePosts();
            }

            // URL/FBID carriers are cached per element, so a slower fallback sweep is enough.
            if (shouldRunCadenced('identityCarrierFallback', 2800, force)) {
                deleteBlockedElements();
                scrubBlockedProfileHeaderBits();
            }

            // Legacy text scanner remains available as a compatibility fallback, not as a
            // second full post scanner on every cycle.
            if (shouldRunCadenced('legacyTextFallback', 4800, force)) {
                deleteRestrictedWords();
            }
        }

        // Haukkis/supported-surface cosmetics are a separate module and never run on Dad's
        // ordinary account. All original functions and selector arrays remain intact.
        if (isFBCosmeticElementHidingAllowed() && shouldRunCadenced('accountCosmetics', 2400, force)) {
            hideGroupSuggestionsOnFeed();
            scrubBlockedFriendAndContactCards();
            if (markFBLikesOverlayDialogs()) scrubBlockedLikesOverlayRows();
            deleteRestrictedPhrases();
            deletePeopleYouMayKnow();
            deleteElement();
        }
    } catch (e) {
        console.log('Error running optimized heavy filters: ' + e.message);
    }
};

// ENHANCED: Run all filtering functions with full post scanning

// v25.4.27: Conservative RAM trim.
// Does not change filtering decisions; it only removes nodes already hard-banned by this script
// after Facebook has had a moment to settle. This keeps long-lived FB tabs from hoarding junk DOM.
const markAndPruneBannedNodes = () => {
    try {
        const now = Date.now();
        const selectors = [
            '[role="feed"] .fb-post-banned',
            '[role="feed"] .fb-search-banned',
            '[role="feed"] .fb-profile-card-banned',
            '[role="main"] .fb-post-banned',
            '[role="main"] .fb-search-banned',
            '[role="main"] .fb-profile-card-banned',
            '[role="main"] .fb-specific-url-nonfeed-hidden-v26'
        ].join(',');

        const nodes = Array.from(document.querySelectorAll(selectors)).slice(0, 80);
        let removed = 0;
        nodes.forEach(node => {
            try {
                if (!node || !node.isConnected) return;
                if (isNotificationPanelElement(node)) return;
                if (node.closest('header, nav, [role="banner"], [role="navigation"], [role="dialog"], [role="menu"]')) return;
                if (node.querySelector?.('input, textarea, [contenteditable="true"], video[controls]')) return;

                const marked = Number(node.getAttribute('data-fbcleaner-prune-at-v27') || '0');
                if (!marked) {
                    node.setAttribute('data-fbcleaner-prune-at-v27', String(now));
                    return;
                }
                if (now - marked < 1800) return;

                collapseFBFeedSlot(node);
                node.remove();
                removed++;
            } catch (e) {}
        });

        if (removed > 0) devLog(`Pruned ${removed} already-banned FB nodes`);
    } catch (e) {}
};

const pauseFarOffscreenMedia = () => {
    try {
        const media = Array.from(document.querySelectorAll('video, audio')).slice(0, 80);
        media.forEach(el => {
            try {
                if (!el || el.paused) return;
                const rect = el.getBoundingClientRect();
                const farAway = rect.bottom < -900 || rect.top > (window.innerHeight + 900);
                if (farAway) el.pause();
            } catch (e) {}
        });
    } catch (e) {}
};

const runFBRamSaver = (force = false) => {
    try {
        if (!force && !shouldRunCadenced('ramSaverV27', 4500, false)) return;
        markAndPruneBannedNodes();
        pauseFarOffscreenMedia();
    } catch (e) {}
};

// v53: heavy selector packs run only when the browser offers an idle slice. Mutation-local
// gating and the visible-feed fast lane still make the immediate safety decision; this pass is
// the slower compatibility/audit layer and no longer sits between input and the next paint.
let __fbHeavyFilterPassPendingV53 = false;
const scheduleFBHeavyFilterPassV53 = () => {
    try {
        if (runFBMessengerNativeMaintenance()) return;
        if (__fbHeavyFilterPassPendingV53 || __fbCleanupRan) return;
        __fbHeavyFilterPassPendingV53 = true;
        addIdleCallback(() => {
            __fbHeavyFilterPassPendingV53 = false;
            if (__fbCleanupRan) return;
            if (runFBMessengerNativeMaintenance()) return;
            if (isFBUserInteractionHotV53()) {
                scheduleFBInteractionSettledPassV53();
                return;
            }
            runGeneralHeavyFilters(false);
            runSpecificSurfaceFilters(false);
            runFBRamSaver(false);
        }, { timeout: 1100 });
    } catch (e) {
        __fbHeavyFilterPassPendingV53 = false;
    }
};

const runAllFilters = () => {
    try {
        refreshFBSpecificSurfaceHydrationObserverV58();
        if (runFBMessengerNativeMaintenance()) return;
        releaseFBEmbeddedChatPostScannerStateV56(document);
        scrubFBIsolatedIdentityCarriersNowV56(document);
        if (isFBUserInteractionHotV53()) {
            scheduleFBInteractionSettledPassV53();
            return;
        }
        updateFBProfileScreening(false);
        updateFBSearchPageClass();
        updateFBHomeFeedGateClass();
        updateFBCommentImmunityClasses();
        if (isFBNoPostScanUrl(window.location.href)) {
            protectNotificationSurfaces(document);
            protectFBCommentSurfaces(document);
            hideCriticalNavOnly();
            return;
        }
        if (runFBStoriesNativeMaintenance()) return;
        if (runFBNativeInteractiveLightLane()) return;
        const commentOverlayActive = updateFBCommentOverlayClass();
        if (typeof refreshFBNativeTopSearchHandoff === 'function') refreshFBNativeTopSearchHandoff();
        updateSpecificUrlNoGlimpseClass();
        markSpecificUrlLoadingSkeletons(document);
        normalizeFBReelsLinks(document);
        protectFBReelsCurrentLocation();
        refreshAccountScopedFilters();
        learnFBTrustedProfilesFromFriendsSurface(document);
        if (commentOverlayActive) {
            hideCriticalNavOnly();
            return;
        }
        protectFBCommentSurfaces(document);
        checkVanityProfileFBID();
        handleRedirects();
        approveCurrentApprovedBrowseSurface();
        cleanUrl();

        // Fast critical pass: small/important stuff still runs every tick.
        hideCriticalElements();
        processSearchResults();
        scanVisibleHomeFeedPostsFast();

        // Heavy passes remain active, but are coalesced behind the browser's next idle slice.
        scheduleFBHeavyFilterPassV53();
    } catch (e) {
        console.log('Error running all filters: ' + e.message);
    }
};

// v50: startup is consolidated below; the old duplicate immediateInit pass was removed.

// Ensure DOM is ready before initializing
const ensureDOMReady = () => {
    const installLiveHooks = () => {
        observeDOMChanges();
        observeForRestrictedPhrases();
        installFBReelsLinkPatch();
        interceptNavigation();
        hookHistoryAPI();
    };

    if (document.readyState === 'loading') {
        onWindowEvent(window, 'DOMContentLoaded', installLiveHooks, false);
    } else {
        installLiveHooks();
    }
};

// [SPA-RUNTIME] v50 canonical one-pass initialization.
const initializeFacebookCleaner = () => {
    devLog('Initializing BraveFox Facebook policy engine v58');
    refreshFBSpecificSurfaceHydrationObserverV58();
    installFBUserInteractionQuietLaneV53();
    updateFBProfileScreening(true);
    updateFBSearchPageClass();
    updateFBHomeFeedGateClass();
    updateFBCommentImmunityClasses();
    updateFBFriendsSoftGate();
    refreshAccountScopedFilters();
    installFBEmbeddedChatAndIdentityCSSV56();
    scrubFBIsolatedIdentityCarriersNowV56(document);
    releaseFBEmbeddedChatPostScannerStateV56(document);
    learnFBTrustedProfilesFromFriendsSurface(document);

    if (typeof installFBNativeTopSearchHandoff === 'function') installFBNativeTopSearchHandoff();
    installFBReelsLinkPatch();
    protectFBReelsCurrentLocation();
    ensureDOMReady();

    if (runFBMessengerNativeMaintenance(true)) return;
    if (runFBStoriesNativeMaintenance() || runFBNativeInteractiveLightLane()) return;
    protectNotificationSurfaces(document);
    if (updateFBCommentOverlayClass()) {
        hideCriticalNavOnly();
        return;
    }
    protectFBCommentSurfaces(document);
    if (isFBNoPostScanUrl(window.location.href)) {
        hideCriticalNavOnly();
        return;
    }

    checkVanityProfileFBID();
    handleRedirects();
    approveCurrentApprovedBrowseSurface();
    cleanUrl();
    hideCriticalElements();
    processSearchResults();
    syncFBNativePostHydrationSlots(document);

    if (isFBTrustedProfileTimelineSurface()) releaseFBTrustedTimelinePosts(document);
    else {
        markUnapprovedPostScreens(document);
        scanVisibleHomeFeedPostsFast();
    }

    hideGroupSuggestionsOnFeed();
    runGeneralHeavyFilters(true);
    runSpecificSurfaceFilters(true);
    runFBRamSaver(true);

    onWindowEvent(window, 'pageshow', event => {
        if (event.persisted) scheduleRunAllFilters();
    }, false);
};

initializeFacebookCleaner();

// Attach event listeners for changes (tracked for cleanup)
onWindowEvent(window, 'DOMContentLoaded', scheduleRunAllFilters, false);
onWindowEvent(window, 'load', scheduleRunAllFilters, false);
onWindowEvent(window, 'popstate', scheduleRunAllFilters, false);

// Main interval scheduler
function scheduleMainInterval() {
    addInterval(() => {
        if (!document.hidden) {
            if (runFBMessengerNativeMaintenance()) {
                // Full-page Messenger: native UI plus narrow hidden-inbox-row cleanup only.
            } else if (runFBStoriesNativeMaintenance()) {
                // Native Stories overlay: cheap maintenance only.
            } else if (isFBUserInteractionHotV53()) {
                // Do not interrupt an active scroll/click/key stream with a document sweep.
                scheduleFBInteractionSettledPassV53();
            } else if (runFBNativeInteractiveLightLane()) {
                // Native menus/dialogs/video overlays: cheap maintenance only.
            } else if (updateFBCommentOverlayClass()) {
                hideCriticalNavOnly();
            } else if (isFBNativeTransientMenuOpen()) {
                runFBNativeTransientMenuMaintenance();
            } else {
                runAllFilters();
            }
        }
    }, 3000);
}

// Start intervals now (foreground), pause/resume on visibility changes
startIntervals(scheduleMainInterval);
onWindowEvent(document, 'visibilitychange', () => {
    if (document.hidden) {
        stopIntervals();

        // Facebook freely dehydrates/recycles FeedUnits in background tabs. The one-pixel
        // screening gate has no visual job while hidden, and leaving it armed lets transient
        // class loss turn previously approved posts into collapsed slots before we return.
        document.documentElement?.classList.remove('fb-feed-screening-gate-v46');
    } else {
        // Restore terminal decisions first, then re-arm the gate synchronously so genuinely
        // new/unapproved units still cannot glimpse on the first visible paint.
        recoverFBFeedAfterVisibilityReturnV55();
        updateFBHomeFeedGateClass();

        // React often performs one or two late resume-hydration bursts after visibilitychange.
        // Re-run only the focused recovery lane; do not sweep the whole document repeatedly.
        addTimeout(() => {
            if (!document.hidden) {
                recoverFBFeedAfterVisibilityReturnV55();
                updateFBHomeFeedGateClass();
            }
        }, 120);
        addTimeout(() => {
            if (!document.hidden) {
                recoverFBFeedAfterVisibilityReturnV55();
                updateFBHomeFeedGateClass();
            }
        }, 520);

        startIntervals(scheduleMainInterval);
        scheduleRunAllFilters();
    }
}, false);

// Teardown on pagehide/beforeunload to avoid leaks
onWindowEvent(window, 'pagehide', cleanup, false);
onWindowEvent(window, 'beforeunload', cleanup, false);

// ===== FACEBOOK TOP-LEFT SEARCH DROPDOWN HANDOFF v15 =====
// Already installed before init so the native dropdown can stay Facebook-owned.
refreshFBNativeTopSearchHandoff();

})();
