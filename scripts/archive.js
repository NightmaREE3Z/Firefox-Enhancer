// ==UserScript==
// @name         CleanArchives
// @version      29.6.1
// @date	 2026-10-25
// @description  Redirects specific archive pages (and xcancel.com search) to the appropriate front page when banned terms are detected.
// @match        *://web.archive.org/*
// @match        *://archive.org/*
// @match        *://www.archive.org/*
// @match        *://web.archive.org/web/*
// @match        *://wayback.archive.org/*
// @match        *://xcancel.com/*
// @match        *://www.xcancel.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Always resolve a safe reference to top without throwing on cross-origin
    const safeTop = (() => {
        try { return window.top; } catch { return window; }
    })();

    // Proactively clear legacy once-per-session flag if it exists (prevents permanent suppression)
    try { sessionStorage.removeItem('ARD_REDIRECTED_ONCE'); } catch {}

    // --- Simple in-memory logger for debugging containsAiBoundary / containsForbiddenKeywords ---
    // You can inspect this in the devtools console: window.ARD_LAST_MATCH_DETAIL
    function recordMatchDetail(kind, pattern, text) {
        try {
            const detail = {
                kind,
                pattern,
                sample: String(text || '').slice(0, 260),
                ts: Date.now()
            };
            window.ARD_LAST_MATCH_DETAIL = detail;
            // Also log to console for visibility while debugging:
            // console.debug('ARD match:', detail);
        } catch (e) {
            // swallow
        }
    }

    // Safe helpers for page and context info (avoid cross-origin reads)
    const selfURL = String(window.location.href || '');

    // Decode-helpers: scan raw and decoded URL variants for full coverage (handles %20 etc.)
    const tryDecode = (s) => {
        try { return decodeURIComponent(s); } catch {}
        try { return decodeURI(s); } catch {}
        return s;
    };
    const pageURLLower = selfURL.toLowerCase();
    const pageURLDecodedLower = tryDecode(selfURL).toLowerCase();
    const selfHostLower = String(window.location.hostname || '').toLowerCase();

    const contextHostLower = (() => {
        // Prefer true top hostname if same-origin, otherwise use referrer, else fallback to self
        try {
            if (safeTop === window) return selfHostLower;
            return String(safeTop.location.hostname || '').toLowerCase();
        } catch {
            try {
                if (document.referrer) {
                    return new URL(document.referrer).hostname.toLowerCase();
                }
            } catch {}
            return selfHostLower;
        }
    })();

    // Site helpers (based on the browsing context host, not the frame host)
    const isWaybackSite = () =>
        contextHostLower === 'web.archive.org' || contextHostLower === 'wayback.archive.org';

    const isArchiveOrgSite = () =>
        contextHostLower === 'archive.org' || contextHostLower === 'www.archive.org';

    const isArchiveSite = () => isWaybackSite() || isArchiveOrgSite();

    const isXcancelSite = () =>
        contextHostLower === 'xcancel.com' || contextHostLower === 'www.xcancel.com';

    const getHomeURLForCurrentSite = () => {
        if (isWaybackSite()) return 'https://web.archive.org/';
        if (isArchiveOrgSite()) return 'https://archive.org/';
        if (isXcancelSite()) return 'https://xcancel.com/';
        // Default to Archive (Wayback) home if somehow matched elsewhere
        return 'https://web.archive.org/';
    };

    const getSiteLabel = () => {
        if (isWaybackSite()) return 'Wayback Machine front page';
        if (isArchiveOrgSite()) return 'Archive.org home page';
        if (isXcancelSite()) return 'xcancel.com home page';
        return 'front page';
    };

    // === BraveFox central URL policy client ========================================
    // background.js owns the canonical allow/block lists. Finite rules are mirrored as a
    // tiny snapshot; the potentially huge fetched hosts files stay in the service worker
    // and are queried in batches/cached locally instead of becoming thousands of regexes.
    const ARD_CENTRAL_POLICY_SNAPSHOT_TYPE = 'BRAVEFOX_GET_CENTRAL_URL_POLICY_SNAPSHOT';
    const ARD_CENTRAL_POLICY_CLASSIFY_TYPE = 'BRAVEFOX_CLASSIFY_CENTRAL_URLS';
    let ARD_centralPolicySnapshot = {
        allowedHosts: [],
        allowedPathRules: [],
        blockedSites: [],
        blockedTLDs: []
    };
    const ARD_centralPolicyVerdictCache = new Map();
    const ARD_centralPolicyPending = new Set();
    let ARD_centralPolicyFlushTimer = 0;
    let ARD_centralPolicyContentRefresh = null;

    function ARD_centralPolicyRuntime() {
        try {
            if (globalThis.chrome?.runtime?.sendMessage) return globalThis.chrome.runtime;
            if (globalThis.browser?.runtime?.sendMessage) return globalThis.browser.runtime;
        } catch (e) {}
        return null;
    }

    // Promise-only Firefox/Fenix browser.runtime and callback-based Chromium chrome.runtime
    // need different signatures. Never pass a Chrome callback as Firefox's options argument.
    function ARD_sendRuntimeMessage(message, callback) {
        try {
            if (globalThis.browser?.runtime?.sendMessage) {
                const request = globalThis.browser.runtime.sendMessage(message);
                Promise.resolve(request).then(callback, () => callback(null));
                return;
            }
            if (globalThis.chrome?.runtime?.sendMessage) {
                globalThis.chrome.runtime.sendMessage(message, callback);
                return;
            }
        } catch (e) {}
        callback(null);
    }

    function ARD_normalizeCentralPolicyHost(value) {
        return String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    }

    function ARD_normalizeCentralPolicyURL(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            let parsed = null;
            if (/^https?:\/\//i.test(raw)) {
                parsed = new URL(raw);
            } else if (/^\/\//.test(raw)) {
                parsed = new URL(`https:${raw}`);
            } else if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[\/:?#]|$)/i.test(raw)) {
                parsed = new URL(`https://${raw}`);
            } else if (raw.startsWith('/')) {
                parsed = new URL(raw, window.location.origin);
            } else {
                return '';
            }
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return parsed.href;
        } catch (e) {
            return '';
        }
    }

    function ARD_centralPolicySnapshotVerdict(value) {
        const href = ARD_normalizeCentralPolicyURL(value);
        if (!href) return '';

        try {
            const parsed = new URL(href);
            const host = ARD_normalizeCentralPolicyHost(parsed.hostname);
            const pathname = String(parsed.pathname || '/').replace(/\/{2,}/g, '/');

            for (const domainValue of ARD_centralPolicySnapshot.allowedHosts || []) {
                const domain = ARD_normalizeCentralPolicyHost(domainValue);
                if (domain && (host === domain || host.endsWith(`.${domain}`))) return 'allow';
            }

            for (const rule of ARD_centralPolicySnapshot.allowedPathRules || []) {
                const ruleHost = ARD_normalizeCentralPolicyHost(rule?.host);
                let prefix = String(rule?.pathPrefix || '/').trim();
                if (!prefix.startsWith('/')) prefix = `/${prefix}`;
                prefix = prefix.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
                if (host === ruleHost && (pathname === prefix || pathname.startsWith(`${prefix}/`))) return 'allow';
            }

            for (const fragment of ARD_centralPolicySnapshot.blockedSites || []) {
                if (fragment && href.includes(String(fragment))) return 'block';
            }

            const lowerHost = host.toLowerCase();
            for (const tld of ARD_centralPolicySnapshot.blockedTLDs || []) {
                if (tld && lowerHost.endsWith(String(tld).toLowerCase())) return 'block';
            }
        } catch (e) {}

        return '';
    }

    function ARD_centralPolicyCachedVerdict(value) {
        const href = ARD_normalizeCentralPolicyURL(value);
        if (!href) return '';

        // A Firefox trusted-site snapshot can be overridden by a hard shield or
        // hard fetched host. The authoritative background verdict takes precedence.
        if (ARD_centralPolicyVerdictCache.has(href)) {
            return ARD_centralPolicyVerdictCache.get(href) || '';
        }
        const snapshotVerdict = ARD_centralPolicySnapshotVerdict(href);
        if (snapshotVerdict === 'block') return 'block';
        ARD_queueCentralPolicyURL(href);
        return '';
    }

    function ARD_onCentralPolicyUpdated() {
        window.setTimeout(() => {
            try { checkCurrentArchivedTargetAgainstCentralPolicy(); } catch (e) {}
            try { scanCentralBlockedArchiveLinks(); } catch (e) {}
            try { ARD_centralPolicyContentRefresh?.(); } catch (e) {}
        }, 0);
    }

    function ARD_flushCentralPolicyURLs() {
        ARD_centralPolicyFlushTimer = 0;
        if (!ARD_centralPolicyRuntime() || !ARD_centralPolicyPending.size) return;

        const urls = Array.from(ARD_centralPolicyPending).slice(0, 192);
        urls.forEach(url => ARD_centralPolicyPending.delete(url));

        try {
            ARD_sendRuntimeMessage({ type: ARD_CENTRAL_POLICY_CLASSIFY_TYPE, urls }, response => {
                try { void globalThis.chrome?.runtime?.lastError; } catch (e) {}
                let changed = false;
                if (response?.ok && Array.isArray(response.verdicts)) {
                    for (const verdict of response.verdicts) {
                        const href = ARD_normalizeCentralPolicyURL(verdict?.url);
                        if (!href) continue;
                        const action = verdict?.action === 'allow' || verdict?.action === 'block' ? verdict.action : 'none';
                        const previous = ARD_centralPolicyVerdictCache.get(href);
                        ARD_centralPolicyVerdictCache.set(href, action);
                        if (action !== 'none' && previous !== action) changed = true;
                    }
                }
                if (changed) ARD_onCentralPolicyUpdated();
                if (ARD_centralPolicyPending.size) ARD_queueCentralPolicyFlush();
            });
        } catch (e) {
            if (ARD_centralPolicyPending.size) ARD_queueCentralPolicyFlush();
        }
    }

    function ARD_queueCentralPolicyFlush() {
        if (ARD_centralPolicyFlushTimer) return;
        ARD_centralPolicyFlushTimer = window.setTimeout(ARD_flushCentralPolicyURLs, 8);
    }

    function ARD_queueCentralPolicyURL(value) {
        const href = ARD_normalizeCentralPolicyURL(value);
        if (!href || ARD_centralPolicyVerdictCache.has(href) || ARD_centralPolicyPending.has(href)) return;
        ARD_centralPolicyPending.add(href);
        ARD_queueCentralPolicyFlush();
    }

    function ARD_loadCentralPolicySnapshot() {
        const runtime = ARD_centralPolicyRuntime();
        if (!runtime) return;
        try {
            ARD_sendRuntimeMessage({ type: ARD_CENTRAL_POLICY_SNAPSHOT_TYPE }, response => {
                try { void globalThis.chrome?.runtime?.lastError; } catch (e) {}
                if (!response?.ok || !response.snapshot) return;
                ARD_centralPolicySnapshot = {
                    allowedHosts: Array.isArray(response.snapshot.allowedHosts) ? response.snapshot.allowedHosts.slice() : [],
                    allowedPathRules: Array.isArray(response.snapshot.allowedPathRules) ? response.snapshot.allowedPathRules.map(rule => ({ ...rule })) : [],
                    blockedSites: Array.isArray(response.snapshot.blockedSites) ? response.snapshot.blockedSites.slice() : [],
                    blockedTLDs: Array.isArray(response.snapshot.blockedTLDs) ? response.snapshot.blockedTLDs.slice() : []
                };
                ARD_centralPolicyVerdictCache.clear();
                ARD_onCentralPolicyUpdated();
            });
        } catch (e) {}
    }

    ARD_loadCentralPolicySnapshot();
    try {
        globalThis.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
            if (areaName !== 'local' || (!changes.lastUpdate && !changes.hostsChunks && !changes.hostsTotal)) return;
            ARD_centralPolicyVerdictCache.clear();
            ARD_centralPolicyPending.clear();
            ARD_loadCentralPolicySnapshot();
        });
    } catch (e) {}


    function getWaybackTargetURL(value = window.location.href) {
        try {
            const parsed = new URL(String(value || ''), window.location.href);
            const host = String(parsed.hostname || '').toLowerCase();
            if (host !== 'web.archive.org' && host !== 'wayback.archive.org') return '';

            const match = String(parsed.pathname || '').match(/^\/web\/(?:[^/]+)\/(https?:\/\/.+)$/i);
            if (!match || !match[1]) return '';
            try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
        } catch (e) {
            return '';
        }
    }

    function getArchiveCentralURLCandidates(value = '') {
        const output = [];
        const add = candidate => {
            const href = ARD_normalizeCentralPolicyURL(candidate);
            if (href && !output.includes(href)) output.push(href);
        };

        const raw = String(value || '').trim();
        if (!raw) return output;
        const waybackTarget = getWaybackTargetURL(raw);
        if (waybackTarget) add(waybackTarget);
        add(raw);

        try {
            const decoded = tryDecode(raw);
            if (decoded !== raw) {
                const decodedWaybackTarget = getWaybackTargetURL(decoded);
                if (decodedWaybackTarget) add(decodedWaybackTarget);
                add(decoded);
            }
        } catch (e) {}

        return output;
    }

    function archiveCentralPolicyVerdict(value = '') {
        const candidates = getArchiveCentralURLCandidates(value);
        let sawAllow = false;
        for (const candidate of candidates) {
            const verdict = ARD_centralPolicyCachedVerdict(candidate);
            if (verdict === 'block') return 'block';
            if (verdict === 'allow') sawAllow = true;
        }
        return sawAllow ? 'allow' : '';
    }

    function checkCurrentArchivedTargetAgainstCentralPolicy() {
        const target = getWaybackTargetURL(window.location.href);
        if (!target) return false;
        if (archiveCentralPolicyVerdict(target) !== 'block') return false;
        redirectToHome();
        return true;
    }

    function hardHideArchiveCentralBlockedLink(link) {
        if (!(link instanceof Element)) return;
        link.setAttribute('data-bravefox-central-url-blocked', 'true');
        link.style.setProperty('display', 'none', 'important');
        link.style.setProperty('visibility', 'hidden', 'important');
        link.style.setProperty('opacity', '0', 'important');
        link.style.setProperty('pointer-events', 'none', 'important');
    }

    function scanCentralBlockedArchiveLinks(scope = document) {
        if (!scope || typeof scope.querySelectorAll !== 'function') return 0;
        const links = [];
        if (scope instanceof Element && scope.matches?.('a[href]')) links.push(scope);
        links.push(...scope.querySelectorAll('a[href]'));

        let hidden = 0;
        for (const link of links) {
            if (!(link instanceof Element) || link.getAttribute('data-bravefox-central-url-blocked') === 'true') continue;
            const rawHref = link.getAttribute('href') || link.href || '';
            if (!rawHref) continue;
            if (archiveCentralPolicyVerdict(rawHref) !== 'block') continue;
            hardHideArchiveCentralBlockedLink(link);
            hidden++;
        }
        return hidden;
    }

    // Simple, literal-match redirect: If we are exactly on archive.org root, send to web.archive.org
    const isTopContext = (() => { try { return window.top === window; } catch { return true; } })();
    const isExactRoot = (url) => {
        try {
            const u = new URL(url);
            const noPath = u.pathname === '' || u.pathname === '/';
            const noQuery = !u.search || u.search === '';
            const noHash = !u.hash || u.hash === '';
            return noPath && noQuery && noHash;
        } catch { return false; }
    };

    if (isTopContext && isArchiveOrgSite() && isExactRoot(selfURL)) {
        // Redirect only when it's literally archive.org (or www.archive.org) with no path/query/hash.
        try { safeTop.location.replace('https://web.archive.org/'); } catch { window.location.replace('https://web.archive.org/'); }
        return;
    }

    window.setTimeout(() => {
        try { checkCurrentArchivedTargetAgainstCentralPolicy(); } catch (e) {}
        try { scanCentralBlockedArchiveLinks(); } catch (e) {}
    }, 0);

    // === SHARED GOOGLE POLICY SOURCE ===
    // google.js remains the ONLY source of Google regex/string rules. The extension background
    // reads its installed copy and sends it here. No code evaluation or duplicate rule data.
    const ARD_GOOGLE_POLICY_MESSAGE = 'BRAVEFOX_ARCHIVE_GET_GOOGLE_POLICY_V1';
    const ARD_GOOGLE_SCOPE_STORAGE_KEY = 'bravefox_google_archive_scope_v1';
    const ARD_GOOGLE_SCOPE_TTL_MS = 15 * 60 * 1000;
    const ARD_GOOGLE_RULE_NAMES = [
        'nuclearRegex', 'resultHideTerms', 'redirectHideLite', 'specialRedirectRegexes',
        'searchAllowTerms', 'AIRegexes', 'finnishWordsList', 'allowedResultURLs',
        'priorityBlockedResultURLPatterns', 'blockedResultURLPatterns',
        'blockedImageURLPatterns', 'blockedTLDs'
    ];
    let ARD_googleRules = null;
    let ARD_googleScope = 'restricted';
    let ARD_googleScopeCheckedAt = 0;
    let ARD_googlePolicyReady = null;

    function ARD_readLiteralArray(source, name) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const start = new RegExp('\\bconst\\s+' + escapedName + '\\s*=\\s*\\[').exec(source);
        if (!start) throw new Error('Missing Google policy list: ' + name);
        const begin = start.index + start[0].length;
        const end = /\n\s*\];/g;
        end.lastIndex = begin;
        const close = end.exec(source);
        if (!close) throw new Error('Unterminated Google policy list: ' + name);
        const input = source.slice(begin, close.index);
        const output = [];
        let index = 0;
        while (index < input.length) {
            const ch = input[index];
            if (/\s|,/.test(ch)) { index++; continue; }
            if (ch === '/' && input[index + 1] === '/') {
                index = input.indexOf('\n', index + 2);
                if (index === -1) break;
                continue;
            }
            if (ch === '/' && input[index + 1] === '*') {
                const finish = input.indexOf('*/', index + 2);
                if (finish === -1) throw new Error('Invalid comment in ' + name);
                index = finish + 2;
                continue;
            }
            if (ch === '/' && input[index + 1] !== '/') {
                let body = '';
                let inClass = false;
                index++;
                let closed = false;
                while (index < input.length) {
                    const c = input[index++];
                    if (c === '\\') {
                        if (index >= input.length) throw new Error('Bad regex escape in ' + name);
                        body += c + input[index++];
                    } else if (c === '[') { inClass = true; body += c; }
                    else if (c === ']') { inClass = false; body += c; }
                    else if (c === '/' && !inClass) { closed = true; break; }
                    else body += c;
                }
                if (!closed) throw new Error('Unterminated regex in ' + name);
                let flags = '';
                while (/[a-z]/i.test(input[index] || '') && index < input.length) flags += input[index++];
                output.push(new RegExp(body, flags));
                continue;
            }
            if (ch === "'" || ch === '"') {
                const quote = ch;
                index++;
                let value = '';
                let closed = false;
                while (index < input.length) {
                    const c = input[index++];
                    if (c === '\\' && index < input.length) {
                        const next = input[index++];
                        value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
                    } else if (c === quote) { closed = true; break; }
                    else value += c;
                }
                if (!closed) throw new Error('Unterminated string in ' + name);
                output.push(value);
                continue;
            }
            throw new Error('Unexpected Google list item in ' + name + ' at ' + index + ': ' + input.slice(index, index + 30));
        }
        if (!output.length) throw new Error('Empty Google list: ' + name);
        return output;
    }

    function ARD_testRegexList(list, text) {
        if (!text || !Array.isArray(list)) return '';
        for (const item of list) {
            if (!(item instanceof RegExp)) continue;
            item.lastIndex = 0;
            if (item.test(String(text))) return item.toString();
        }
        return '';
    }

    // Faithfully follows google.js's query AI-boundary algorithm, using the LIVE literal
    // AIRegexes and finnishWordsList extracted from google.js rather than duplicating arrays.
    function ARD_googleAIHit(value) {
        const rules = ARD_googleRules;
        if (!rules || !value) return '';
        const text = String(value);
        const tokens = text.match(/\p{L}+/gu) || [text];
        const isFinnish = token => !!ARD_testRegexList(rules.finnishWordsList, token.toLowerCase());
        for (const token of tokens) {
            if (/^OpenAI$/i.test(token)) continue;
            if (/^AI[.,!?]?$/.test(token)) return 'AI';
            if (token.length < 2 || isFinnish(token)) continue;
            const first = /^ai[-_]?/i.test(token);
            const last = /[-_]?ai$/i.test(token);
            if (!first && !last) continue;
            let root = token;
            if (first) root = root.replace(/^ai[-_]?/i, '');
            if (last) root = root.replace(/[-_]?ai$/i, '');
            if (!root) return 'AI';
            if (ARD_testRegexList(rules.AIRegexes, root)) return 'AI';
            // Google considers either a Finnish root or an unmatched non-Finnish root nuclear.
            return 'AI';
        }
        return '';
    }

    // Google's precedence is nuclear -> AI -> allow -> redirect-only. Result terms are
    // not silently promoted to query-redirect rules.
    function ARD_googleQueryVerdict(value) {
        const rules = ARD_googleRules;
        if (!rules || !value) return { action: 'none' };
        const nuclear = ARD_testRegexList(rules.nuclearRegex, value);
        if (nuclear) return { action: 'block', tier: 'nuclearRegex', match: nuclear };
        if (ARD_googleAIHit(value)) return { action: 'block', tier: 'AIRegexes', match: 'AI' };
        const allowed = ARD_testRegexList(rules.searchAllowTerms, value);
        if (allowed) return { action: 'allow', tier: 'searchAllowTerms', match: allowed };
        const lite = ARD_testRegexList(rules.redirectHideLite, value) ||
            ARD_testRegexList(rules.specialRedirectRegexes, value);
        return lite ? { action: 'block', tier: 'redirectHideLite', match: lite } : { action: 'none' };
    }

    function ARD_googleAllowedResultURL(href) {
        if (!ARD_googleRules) return false;
        let url;
        try { url = new URL(href); } catch (e) { return false; }
        if (!/^https?:$/.test(url.protocol)) return false;
        const host = url.hostname.toLowerCase().replace(/\.$/, '');
        const pathname = url.pathname.toLowerCase();
        return ARD_googleRules.allowedResultURLs.some(rule => {
            let entry = String(rule).trim().toLowerCase();
            const wildcard = entry.startsWith('*.');
            if (wildcard) entry = entry.slice(2);
            const slash = entry.indexOf('/');
            const domain = slash === -1 ? entry : entry.slice(0, slash);
            const prefix = slash === -1 ? '' : entry.slice(slash).replace(/\/+$/, '');
            if (!domain || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)) return false;
            if (host !== domain && host !== 'www.' + domain && !(wildcard && host.endsWith('.' + domain))) return false;
            return !prefix || pathname === prefix || pathname.startsWith(prefix + '/');
        });
    }

    function ARD_googleResultVerdict(href, label) {
        if (!ARD_googleRules) return 'none';
        const rules = ARD_googleRules;
        const target = getWaybackTargetURL(href) || String(href || '');
        const signal = String(label || '') + ' ' + target;
        // Same Google ordering: nuclear / AI / hard TLD / image / central / priority
        // first; the account exception can rescue ONLY soft resultHideTerms.
        if (ARD_testRegexList(rules.nuclearRegex, signal) || ARD_googleAIHit(signal)) return 'block';
        try {
            const host = new URL(target, window.location.origin).hostname.toLowerCase();
            if (rules.blockedTLDs.some(tld => host.endsWith(String(tld).toLowerCase()))) return 'block';
        } catch (e) {}
        if (ARD_testRegexList(rules.blockedImageURLPatterns, target)) return 'block';
        if (archiveCentralPolicyVerdict(target) === 'block') return 'block';
        if (ARD_testRegexList(rules.priorityBlockedResultURLPatterns, target)) return 'block';

        const allowedURL = ARD_googleAllowedResultURL(target) || archiveCentralPolicyVerdict(target) === 'allow';
        const softHit = ARD_testRegexList(rules.resultHideTerms, signal);
        if (softHit) {
            if (ARD_googleScope === 'tapio' && Date.now() - ARD_googleScopeCheckedAt < ARD_GOOGLE_SCOPE_TTL_MS && allowedURL) return 'allow';
            return 'block';
        }
        if (allowedURL) return 'allow';
        // Google's broader legacy URL patterns are below explicit allowances.
        if (ARD_testRegexList(rules.blockedResultURLPatterns, target)) return 'block';
        return 'none';
    }

    function ARD_applyGoogleResultFilters() {
        if (!ARD_googleRules || !(isArchiveSite() || isXcancelSite())) return;
        // Recognizable result tiles: hide the whole tile rather than only its link.
        document.querySelectorAll('.item-ia, .search-result, article.search-result, li.search-result, [data-testid="search-result"]').forEach(tile => {
            if (tile.closest('header, nav, footer')) return;
            const anchor = tile.querySelector('a[href]');
            if (!anchor) return;
            const target = anchor.href || '';
            const verdict = ARD_googleResultVerdict(target, (tile.textContent || '').slice(0, 600));
            if (verdict === 'block') {
                tile.style.setProperty('display', 'none', 'important');
                tile.dataset.ardGoogleBlocked = '1';
            } else if (tile.dataset.ardGoogleBlocked === '1') {
                tile.style.removeProperty('display');
                delete tile.dataset.ardGoogleBlocked;
            }
        });

        // Other result links, including Wayback /web/<timestamp>/<real-url> links.
        // Never claim global navigation, forms, or unrelated site chrome.
        document.querySelectorAll('main a[href], [role="main"] a[href], #search-results a[href], .results a[href], a[href*="/web/"]').forEach(anchor => {
            if (anchor.closest('header, nav, footer, form, [role="navigation"]')) return;
            if (anchor.closest('.item-ia, .search-result, [data-testid="search-result"]')) return;
            const target = anchor.href || '';
            const verdict = ARD_googleResultVerdict(target, (anchor.textContent || anchor.title || '').slice(0, 240));
            if (verdict === 'block') {
                anchor.style.setProperty('display', 'none', 'important');
                anchor.dataset.ardGoogleBlocked = '1';
            } else if (anchor.dataset.ardGoogleBlocked === '1') {
                anchor.style.removeProperty('display');
                delete anchor.dataset.ardGoogleBlocked;
            }
        });
    }

    function ARD_loadGoogleScope() {
        try {
            const storage = globalThis.browser?.storage?.local || globalThis.chrome?.storage?.local;
            if (!storage?.get) return;
            Promise.resolve(storage.get(ARD_GOOGLE_SCOPE_STORAGE_KEY)).then(value => {
                const snapshot = value?.[ARD_GOOGLE_SCOPE_STORAGE_KEY];
                ARD_googleScopeCheckedAt = Number(snapshot?.checkedAt) || 0;
                ARD_googleScope = snapshot?.scope === 'tapio' &&
                    Date.now() - ARD_googleScopeCheckedAt < ARD_GOOGLE_SCOPE_TTL_MS ? 'tapio' : 'restricted';
                ARD_applyGoogleResultFilters();
            }).catch(() => {});
        } catch (e) {}
    }

    function ARD_loadGooglePolicy() {
        if (ARD_googlePolicyReady) return ARD_googlePolicyReady;
        ARD_googlePolicyReady = new Promise(resolve => {
            const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
            if (!runtime?.sendMessage) { resolve(false); return; }
            let finished = false;
            const complete = result => {
                if (finished) return;
                finished = true;
                if (!result?.ok || typeof result.source !== 'string') { resolve(false); return; }
                try {
                    const lists = {};
                    ARD_GOOGLE_RULE_NAMES.forEach(name => { lists[name] = ARD_readLiteralArray(result.source, name); });
                    // Google explicitly moves exact soft duplicates out of Nuclear.
                    const soft = new Set(lists.resultHideTerms.map(rx => rx.source.toLowerCase()));
                    lists.nuclearRegex = lists.nuclearRegex.filter(rx => !soft.has(rx.source.toLowerCase()));
                    ARD_googleRules = lists;
                    ARD_applyGoogleResultFilters();
                    resolve(true);
                } catch (error) { console.warn('[ARCHIVE.JS] Google policy import failed:', error); resolve(false); }
            };
            try {
                ARD_sendRuntimeMessage({ type: ARD_GOOGLE_POLICY_MESSAGE }, complete);
            } catch (e) { complete(null); }
        });
        return ARD_googlePolicyReady;
    }
    ARD_loadGoogleScope();
    void ARD_loadGooglePolicy();
    try {
        (globalThis.browser?.storage || globalThis.chrome?.storage)?.onChanged?.addListener((changes, area) => {
            if (area === 'local' && changes?.[ARD_GOOGLE_SCOPE_STORAGE_KEY]) ARD_loadGoogleScope();
        });
    } catch (e) {}

    // Define the regex patterns to search for in the URL or content
    // Set false to test Google's imported rules WITHOUT any Archive-only regexes
    // or the old Archive-only URL substrings. Central background denies remain active.
    const ENABLE_ARCHIVE_LOCAL_RULES = true;
    // === ARCHIVE LOCAL NUCLEAR REGEX ===
    // Single editable array, matching google.js grouping: ordinary, boundaried, special.
    // No separate regex arrays or factory function are required.
    const nuclearRegex = [

        // Regular nuclear regexes
        /Irpp4/i, /Bliss/i, /Stratton/i, /Bayley/i, /Blackheart/i, /Charlotte Flair/i, /Becky Lynch/i, /Michin/i, /WWE Woman/i, 
	/julmakira/i, /@yaonlylivvonce/i, /@alexa_bliss_wwe_/i, /@alexa_bliss/i, /@samanthathebomb/i, /Jordynne/i, /WWE Women/i, 
	/WWE Women's/i, /WWE Divas/i, /WWE Diva/i, /Maryse/i, /Charlotte/i, /Flair/i, /Stratus/i, /MSEdge/i, /Izzi WWE/i, 
	/Dame WWE/i, /NXT Women's/i, /AI app/i, /NXT Woman/i, /Jessika Carr/i, /Carr WWE/i, /Jessica Carr/i, /Jessika Karr/i, 
	/Karr WWE/i, /Jessika WWE/i, /Jessica WWE/i, /Jessica Karr/i, /WWE Dame/i, /WWE Izzi/i, /nudify/i, /nudifier/i, 
	/TOR Browser/i, /TOR selain/i, /AI edited/i, /Brave-selainta/i, /Brave-selaimen/i, /Undress AI/i, /Skye Blue/i, 
	/tarkoitiitko: nudify/i, /undress-app/i, /deepnude-app/i, /nudify-app/i, /Vice WWE/i, /-selainta/i, /selaimen/i, 
	/-selaimen/i, /Lola WWE/i, /Alexis/i, /WWE Xoxo/i, /Morgan Xoxo/i, /pics edit/i, /pic edit/i, /n8k3d/i, /dreamtime/i,
        /dreamtime app/i, /mature content/i, /mature site/i, /adult site/i, /photopea/i, /fotopea/i, /picture edit/i, 
	/Tiffy Time/i, /picresize/i, /lunapic/i, /pixelixe/i, /!fy/i, /OperaGX/i, /photo edit/i, /without/i, /dreamtime AI/i, 
	/Baker/i, /Joanie/i, /cleavage/i, /image edit/i, /Rul34/i, /Rul 34/i, /Frost AI/i, /Laurer/i, /AI Frost/i, /onlyfans/i, 
	/frost\.com/i, /only fans/i, /fantime/i, /fan time/i, /okfans/i, /ifans/i, /Loyalfans/i, /Loyalfan/i, /cameltoe/i,
        /Fansly/i, /JustForFans/i, /samuels/i, /ok fans/i, /Just for fans/i, /i fans/i, /Loyal fans/i, /Fan sly/i, /fans only/i, 
	/Jaida WWE/i, /face fusion technology/i, /fan only/i, /Fan loyal/i, /Fans loyal/i, /biscuit booty/i, /Trans/i, /Kristen/i, 
	/editor app/i, /Transvestite/i, /Biscuit Butt/i, /Birpppis/i, /deviant art/i, /upscaling/i, /facetune/i, /face tune/i,
        /tuning face/i, /face tuning/i, /facetuning/i, /tuningface/i, /biscuit ass/i, /Chyna/i, /biscuit backside/i, /shagged/i, 
	/LGBTQ/i, /fat fetish/i, /adultcontent/i, /Carmella/i, /18 plus/i, /nudifying/i, /nudity/i, /undressing/i, /undressifying/i, 
	/generative/i, /undressify/i, /Goddess/i, /Harley/i, /Cameron/i, /Merlio/i, /Hayter/i, /Ripley/i, /Microsoft Edge/i, /askfm/i, 
	/ask fm/i, /queer/i, /Pride/i, /prostitute/i, /escort/i, /fetish/i, /Sportskeeda/i, /whoring/i, /vagina/i, /nudyi/i, /Nudying/i, 
	/Nudeying/i, /busty/i, /whore/i, /camgirl/i, /cumslut/i, /fury foot/i, /fury feet/i, /DeepSeek AI/i, /patreon/i, /chaturbate/i, 
	/myfreecams/i, /Samsung Internet/i, /Policy template/i, /Templates/i, /Policies/i, /onlifans/i, /camsoda/i, /stripchat/i, 
	/bongacams/i, /livejasmin/i, /Io Sky/i, /Sky WWE/i, /Sky Wrestling/i, /Sky wrestle/i, /foot fury/i, /feet fury/i, /Bleis/i, 
	/amateur/i, /5 feet of fury/i, /five feet of fury/i, /Velvet Sky/i, /Vince Russo/i, /Russo/i, /Goddess WWE/i, /Mandy Rose/i, 
	/Valhalla/i, /jaida/i, /Satomura/i, /Aubrey/i, /Edwards/i, /Alicia/i, /Atout/i, /Tamina/i, /Summer Rae/i, /Layla/i,/Eve Torres/i,
	/Michelle McCool/i, /Kelly Kelly/i, /Kelly2/i, /Kelly 2/i, /Melina WWE/i, /Brittany/i, /Aubert/i, /Parker WWE/i, /Victoria WWE/i,
        /Melina wrestler/i, /Jillian Hall/i, /Maria Kanellis/i, /Beth Phoenix/i, /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i, /Havok/i,   
	/Madison Rayne/i, /Brooke/i, /Tessmacher/i, /Shotzi/i, /Renee/i, /Britany/i, /Britanny/i, /Deonna/i, /Purrazzo/i, /Noelle/i,
        /Sakazaki/i, /Sakura/i, /Penelope/i,  /Miia Yim/i, /Miia Yam/i, /deviantart/i, /Carolina/i, /Angelina/i, /Caroline/i, /Lynch/i, 
	/Bailey/i, /Mia Yam/i, /AJ Lee/i, /Jaidi/i, /NXT Womens/i, /NXT Women/i, /Uhkapeli/i, /Uhka peli/i, /Sunny/i, /Tessa/i, /Jakara/i, 
	/Uhkapelaaminen/i, /J41D4/i, /Ja1d4/i, /J41da/i, /Uhka pelaaminen/i, /Jaid4/i, /J4ida/i, /Dave Meltzer/i, /Natalya/i, /Nattie/i,
        /Electra Lopez/i, /Arianna/i, /Matt Jackson/i, /Nick Jackson/i, /nadke/i, /Ava Raine/i, /Gamble/i, /Tatum WWE/i, /explicit/i, 
	/Katana Chance/i, /Mercedes/i, /Gambling/i, /anaaliseksi/i, /f\*ckwit/i, /Paxley/i, /horizonMW/i, /biscuit rear/i, /Britt/i, 
	/Mariah/i, /puzzy/i, /editing app/i, /tushy/i, /Blies/i, /Statlander/i, /f\*cking/i, /f\*cked/i, /f\*cks/i, /f\*ckup/i, 
	/f\*\*kery/i, /f\*ckface/i, /\*uck/i, /f\*ck/i, /fu\*k/i, /fuc\*/i, /f\*\*\*/i, /f\*\*k/i, /\*\*ck/i, /fuc\*k/i, /f\*cker/i,
        /f\*\*ked/i, /f\*\*king/i, /fu\*\*/i, /f\*\*/i, /f\*\*\*\*/i, /f\*c\*/i, /\*cked/i, /b\*tch/i, /b\*\*ch/i, /b\*\*\*\*/i, 
	/b\*itch/i, /\*itch/i, /b\*stard/i, /b\*\*tard/i, /f\*cktard/i, /f\*ckery/i, /sh\*t/i, /sh\*tty/i, /\*hit/i, /s\*\*t/i, 
	/sh\*\*/i, /sh\*tfaced/i, /sh\*tbag/i, /s\*cker/i, /b\*stardly/i, /b\*st\*rd/i, /b\*st\*rds/i, /b\*lls/i, /c\*\*t/i, /cu\*t/i, 
	/\*unt/i, /c\*nts/i, /c\*\*ts/i, /cunt\*/i, /tw\*t/i, /\*lls/i, /b\*llocks/i, /b\*llsack/i, /a\*\*/i, /a\*shole/i, /\*sshole/i, 
	/as\*hole/i, /assh\*le/i, /as\*\*hole/i, /a\*\*hole/i, /a\*\*wipe/i, /a\*shat/i, /p\*ssy/i, /c\*nt/i, /d\*ckbag/i, /d\*\*kface/i, 
	/sh\*thead/i, /t\*t/i, /\*n\*\*r/i, /d\*ckhead/i, /tw\*\*t/i, /t\*at/i, /t\*\*t/i, /p\*ss/i, /p\*\*\*/i, /p\*ssed/i, /rawdog/i,
	/t\*rd/i, /rawdogging/i, /raw dogging/i, /raw dog/i, /d\*ck/i, /d\*\*k/i, /di\*k/i, /a\*s/i, /a\*z/i, /az\*/i, /\*n\*\*\*r/i, 
	/m\*therf\*cker/i, /m\*therfucker/i, /\*ss/i, /as\*\*\*\*/i, /fu\*c/i, /face replace/i, /photorealistic swap/i, /synthetic face/i, 
	/hyperreal/i, /hyper real/i, /face merge/i, /AI face/i, /neural/i, /AI morph/i, /face animation/i, /deep swap/i, /swap model/i,
        /facereplace/i, /fylng/i, /face augmentation/i, /digital face synthesis/i, /AI-powered face swap/i, /face reconstruction/i, 
	/facefusion/i, /wondershare/i, /AI face recreation/i, /virtual morph/i, /face synthesis/i, /neural face swap/i, /deepface swap/i,
	/deep neural face/i, /photo manipulation face/i, /fy1ng/i, /Kamifuku/i, /virtual face swap/i, /hyperreal AI face/i, /face join/i,
        /photo-real AI face/i, /face deepfake/i, /synthetic portrait generation/i, /AI image transformation/i, /cheek/i, /aasho/i, /ääsho/i, 
	/ääshö/i, /deepfak portrait/i, /machine learning/i, /generation/i, /AI model face swap/i, /face generation AI/i, /3D face morph/i, 
	/face replacement AI/i, /video face morphing/i, /AI facial animation/i, /deepfake avatar/i, /synthetic avatar creation/i, /facial/i,
        /AI model swap/i, /deep model swap/i, /image to face morph/i, /AI character face/i, /face remapping AI/i, /synthetic media/i, /fy!ng/i,
	/AI-created character face/i, /face replacement tool/i, /photo trans/i, /pict trans/i, /AI video face replacement/i, /face tech/i, 
	/virtual avatar face/i, /digital face replacement/i, /hyperreal synthetic face/i, /AI face transformer/i, /face generation model/i, 
	/realistic face/i, /virtual reality face/i, /image trans/i, /face tech/i, /face AI animation/i, /real-time face swap/i, /girl's/i,
	/AI-driven photo manipulation/i, /deepfake model creation/i, /digital persona/i, /Blake/i, /face render/i, /Thekla/i, /womans/i,
        /dic\*/i, /face overlay/i, /synthetic person/i, /facial blending/i, /virtual character face swap/i, /photorealistic face generator/i, 
	/face altering AI/i, /realistic AI swap/i, /face expression morphing/i, /video gen/i, /nakie/i, /Monroe/i, /face transformation AI/i,
        /virtual human face swap/i, /synthetic media generation/i, /3D face recreation/i, /AI-generated face morph/i, /face image manipulation/i,
	/machine-generated face swap/i, /venica/i, /video face animation/i, /virtual morphing tool/i, /AI-powered video face swap/i, /neural face/i, 
	/digital face recreation/i, /AI-based facial replacement/i, /machine learning face generator/i, /face recognition swap/i, /n@ked/i, /onnly/i,
	/AI face animation tool/i, /synthetic media face/i, /AI character morphing/i, /deepfake avatar generation/i, /photoreal face synthesis/i,   
	/irc-galleria/i, /irc galleria/i, /La Leona/i, /facial deep learning/i, /neural facial expression swap/i, /hyperrealistic face model/i,
        /wonder share/i, /AI-driven face fusion/i, /video face deepfake/i, /face pattern generation/i, /AI virtual persona swap/i, /nekkid/i, 
	/nudee/i, /deepface model trans/i, /noodz/i, /neude/i, /nudesz/i, /fan-sly/i, /f4nslie/i, /f@nsly/i, /vanice/i, /vanica/i, /deep nuud/i,
        /deepnud/i, /deapnude/i, /d33pnud3/i, /f@n/i, /0nlifans/i, /onlii/i, /onlifanz/i, /nakid/i, /secks/i, /seggs/i, /Erase clothes/i, 
	/AI uncloth/i, /Unclothing AI/i, /Gen AI pics/i, /text-to-undress/i, /text2nude/i, /remove outfit/i, /undress filter/i, /Lexi Bliss/i,
	/persona creation/i, /Saraya Knight/i, /Paige WWE/i, /Celeste Bonin/i, /Ariane Andrew/i, /Brianna Monique Garcia/i, /Lexi Kaufman/i, 
        /stripfilter/i, /clothing eraser/i, /nudify tool/i, /leak editor/i, /Realistic nude gen/i, /Tenille Dashwood/i, /Alex Kaufman/i, 
        /fleshify/i, /Skinify/i, /Stephanie Nicole Garcia/i, /deepany/i, /Lana Rusev/i, /Pamela Martinez/i, /Ashley Sebera/i, /Garcia/i,
        /Ayesha Raymond/i, /image2video/i, /merging two faces/i, /join face/i, /Nicol/i, /Wrestling babe/i, /Divas hot/i, /WWE sexy/i, 
	/spicy site/i, /deep-any/i, /for fans/i, /VIP pic/i, /premium content/i, /sussy pic/i, /after dark/i, /artistic nude/i, /sus site/i,
	/tasteful nude/i, /uncensored version/i, /alt site/i, /runwayml/i, /runway/i, /run way/i, /runaway/i, /run away/i, /replicate\.ai/i, 
	/huggingface/i, /hugging face/i, /cloth remover/i, /AI eraser/i, /Magic Editor/i, /magicstudio/i, /cleanup\.pictures/i, /woman's/i, 
	/app123/i, /modapk/i, /apkmod/i, /tool hub/i, /tools hub/i, /alasti/i, /vaatteeton/i, /paljas/i, /seksikäs/i, /tissit/i, /nänni/i,
        /sukupuolielin/i, /paljain/i, /seksisivu/i, /alastomuus/i, /sus content/i, /fucking/i, /aikuissivusto/i, /nakde/i, /face fusion/i, 
	/pervo/i, /lesbo/i, /transu/i, /bg remover/i, /breast/i, /leggings/i, /leggins/i, /venoice/i, /veniice/i, /jeans/i, /jerking/i, 
	/jerkmate/i, /jerk mate/i, /jerk off/i, /jerking off/i, /jack off/i, /jacking off/i, /imgtovid/i, /img2vid/i, /imagetovideo/i,
        /face\+/i, /her butt/i, /herbutt/i, /butt hole/i, /ass h/i, /buttcheek/i, /butt cheek/i, /poistamis/i, /vaatteidenpoistaminen/i, 
	/vaatteiden poistaminen/i, /facemerg/i, /facefusi/i, /face merg/i, /face fusi/i, /face plus/i, /faceplus/i, /merge two faces/i, 
	/merge 2 faces/i, /merging 2 faces/i, /\*wat/i, /twa\*/i, /cun\*/i, /\*orn/i, /po\*n/i, /por\*/i, /\*eep/i, /d\*ep/i, /de\*p/i, 
	/dee\*/i, /\*ude/i, /n\*de/i, /nu\*e/i, /nud\*/i, /\*udi/i, /n\*di/i, /nu\*i/i, /n\*\*e/i, /join two faces/i, /join 2 faces/i, 
	/join2faces/i, /jointwofaces/i, /venise/i, /venoise/i, /Tony Storm/i, /off the Sky/i, /off da skai/i, /Priscilla/i, /Kelly/i, 
	/Erika/i, /Vikman/i, /pakara/i, /pakarat/i, /Viikman/i, /Eerika/i, /pu\*sy/i, /pus\*y/i, /an\*l/i, /s\*x/i, /s\*\*/i, /co\*k/i,
        /veeniic/i, /veenice/i, /\*\*x/i, /se\*/i, /\*ex/i, /s\*ck/i, /c\*ck/i, /\*nal/i, /a\*al/i, /ana\*/i, /as\*/i, /su\*k/i, /coc\*/i, 
	/womens/i,  /suc\*/i,  /p\*rn/i, /n\*\*i/i, /nu\*\*/i, /\*aked/i, /n\*ked/i, /na\*ed/i, /nak\*d/i, /nake\*/i, /\*\*ked/i, /n\*\*ed/i, 
	/na\*\*d/i, /nak\*\*/i, /\*\*aked/i, /n\*\*aked/i, /n\*aked/i, /na\*\*ked/i, /nak\*\*ed/i, /nake\*\*d/i, /\*kin/i, /s\*in/i, /sk\*n/i, 
	/blogspot/i, /blogger/i, /fl3sh/i, /irpppas/i, /Birbbis/i, /Birbb/i, /ski\*/i, /\*lesh/i, /f\*esh/i, /fl\*sh/i, /fle5h/i, /fle\*h/i, 
	/fles\*/i, /orgasm/i, /0rgasm/i, /org@sm/i, /orga5m/i, /org@5m/i, /0rg@sm/i, /0rg@\$m/i, /org@\$m/i, /0rga\$m/i, /lady's/i, /ladie's/i, 
	/women's/i, /pushpull/i, /ask\.fm/i, /reddit/i, /\/r/i, /Alexa/i, /Alexa Bliss/i, /sensuel/i, /AI-generated/i, /undressed/i, /AI model/i, 
	/orga\$m/i, /w4nk3/i, /\*ank/i, /w\*nk/i, /wa\*k/i, /wan\*/i, /\*4nk/i, /w4\*k/i, /w4n\*/i, /fleshi/i, /fl35h/i, /AI art/i, /panties/i, 
	/panty/i, /AI generated/i,  /Alexa WWE/i, /ring gear/i, /Aleksa/i, /by AI/i, /Rodriguez/i, /lingerie/i, /pants/i, /attire/i, /Vladimir/i, 
	/Putin/i, /Vladimir Putin/i, /Trump/i, /kuvake/i, /face \+/i,


        // Boundaried nuclear regexes (standalone short terms)
        /\bBrie\b/i, /\bpusy\b/i, /\bpusi\b/i, /\bnud3\b/i, /\bgay\b/i, /\b1fy\b/i, /\blfy\b/i, /\bde3p\b/i, /\bd33p\b/i, /\b3ip\b/i, /\bfuck\b/i, 
	/\br34\b/i, /\br_34\b/i, /\bRul\b/i, /\bRuca\b/i, /\bifan\b/i, /\bshag\b/i, /\bfake\b/i, /\bBlis\b/i, /\bpant\b/i, /\bF4NS\b/i, /\bnsfw\b/i, 
	/\bporn\b/i, /\bxxx\b/i, /\bF4N5\b/i, /\bFAN5\b/i, /\bv1ds\b/i, /\bm4ny\b/i, /\bv1d5\b/i, /\bLGBT\b/i, /\bonl1\b/i, /\b0nl1\b/i, /\b0nli\b/i, 
	/\bJazz\b/i, /\bLexi\b/i, /\bYuka\b/i, /\bAEW\b/i, /\bcam4\b/i, /\bd3ep\b/i, /\blinq\b/i, /\bfukk\b/i, /\bfukc\b/i, /\bnudy\b/i, /\b0nly\b/i,
        /\bnakd\b/i, /\bs3x\b/i, /\bseks\b/i, /\bNSFL\b/i, /\bhomo\b/i, /\bndue\b/i, /\bdick\b/i, /\bcock\b/i, /\bassh\b/i, /\b0rg4\b/i, /\borg4\b/i, 
	/\bd1ck\b/i, /\bdlck\b/i, /\bblog\b/i, /\bw4nk\b/i, /\bsexy\b/i,


        // Special nuclear regexes
        /gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img)))|(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|denois(?:e|er|ing)?)(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img))?(?:[\s_\-\/.]{0,3}gr[a4][i1l]n)|gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic|image|img))|(?:ph(?:o|0)?t(?:o|0)?|pic|image|img)(?:[\s_\-\/.]{0,3}fix)/i,
        /(?:n(?:o|0)ise(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?))|(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?)(?:[\s_\-\/.]{0,3})n(?:o|0)ise|de[\s_\-\.]?n(?:o|0)is(?:e|er|ing)?)/i,
        /make.*(move|gif|video)/i,
        /photo.*(move|gif|video)/i,
        /image.*(move|gif|video)/i,
        /pic.*(move|gif|video)/i,
        /img.*(move|gif|video)/i,
        /booty/i,
        /ass.*(animat|ai|move)/i,
        /twerk/i,
        /twerking/i,
        /jiggle/i,
        /bounce.*(ai|gif)/i,
        /booty.*(ai|gif|video|animat)/i,
        /ass.*(ai|gif|video|animat)/i,
        /mangoanimat/i,
        /deepnude/i,
        /undress/i,
        /strip.*ai/i,
        /nude.*ai/i,
        /clothing.*remove/i,
        /clothes.*remove/i,
        /remove.*(clothes|clothing|dress)/i,
        /dress.*remov/i,
        /face.*(swap|deepfake|replace)/i,
	/robe.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin)/i, /robe.*(malf|func)/i, /malfunc.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin|ring)/i, /ring gear|trunk|pant|shirt|jacket.*(malf|func)/i,
        /deep\s*[-_ ]?\s*nude/i,
	/deep.*(nude|naked|fake|job|ai)/i,
        /nudif(?:y|ier|ying|ication|ications)?/i, /undress(?:ing|ify|ifying|ified|ed)?/i,
        /un\s*[-_ ]?\s*cloth(?:e|es|ing|ed)?/i, /decloth(?:e|es|ing|ed)?/i,
        /clothes?\s*[-_ ]?\s*(?:remov|eras|delet|del|off|out)/i, /clothing\s*[-_ ]?\s*(?:remov|eras|delet|del|off|out)/i,
        /(?:remov|eras|delet|del)\s*[-_ ]?\s*(?:clothes?|clothing|dress|outfit|garment)/i,
        /(?:strip|stripp|bare|reveal)\s*[-_ ]?\s*(?:ai|app|tool|filter|generator|image|photo|pic)/i,
        /(?:nude|naked|nsfw)\s*[-_ ]?\s*(?:ai|app|tool|generator|gen|filter|editor|site)/i,
        /(?:ai|deep|text\s*2|text\s*to)\s*[-_ ]?\s*(?:nude|nudify|undress|uncloth|decloth)/i,
        /x\s*[-_ ]?\s*ray\s*[-_ ]?\s*(?:cloth|clothes|body|image|photo)/i,
        /see\s*[-_ ]?\s*through\s*[-_ ]?\s*(?:cloth|clothes|clothing|image|photo)/i,
        /deep\s*[-_ ]?\s*fake/i,
        /syv[aä]\s*[-_ ]?\s*v[aä][aä]renn[oö]s/i,
        /diip\s*[-_ ]?\s*feik/i,
        /face\s*[-_ ]?\s*(?:swap|morph|fusion|replace|replacement|merge|blend|join|remap)/i,
        /(?:faceswap|facefusion|facereplace|faceblend|facejoin|joinface)/i,
        /synthetic\s*[-_ ]?\s*(?:face|media|avatar|model|person|portrait)/i,
        /(?:txt2img|img2img|image\s*2\s*image|image\s*to\s*image)/i,
        /(?:image|photo|pic|img)\s*[-_ ]?\s*(?:to|2)\s*[-_ ]?\s*(?:video|vid|gif)/i,
        /(?:video|vid|gif)\s*[-_ ]?\s*(?:image|photo|pic|img)/i,
        /(?:ai|photo|image|body|pose)\s*[-_ ]?\s*(?:twerk|jiggle|bounce|motion|repose|pose\s*change)/i,
        /(?:ai|adult|nsfw)\s*[-_ ]?\s*(?:blow|suck|mouth|fap|boob|tit|ass|porn)/i,
        /(?:porn|adult|nsfw)\s*[-_ ]?\s*(?:ai|generator|tool|app|site|tube)/i,
        /(?:onlyfans|fansly|chaturbate|stripchat|redgifs|xhamster|redtube|brazzers|bangbros)/i,
        /(?:nude|naked|nsfw|porn|adult)\s*[-_ ]?\s*(?:image|photo|pic|video|vid|content|site|app)/i,
        /(?:vaat|vaatte|alusvaat|pait|liiv|hous).*pois/i,
        /(?:poista|poisto|poistaminen|poistamis).*vaat/i,
        /(?:alaston|alasti|vaatteeton|paljas)\s*[-_ ]?\s*(?:kuva|kuvia|video|sivu|app|teko[aä]ly)/i,
        /(?:seksikuva|seksivideo|aikuissis[aä]lt[oö]|aikuisviihde|jynkky|runkku)/i,
        /(?:pillu|pimppi|vittu|em[aä]tin|tussu|r[oö]mps[aä]|kyrp[aä]|kulli|kikkeli)/i,
        /(?:boob|boobs|tits|titty|pussy|vagina|cock|dick|penis|blowjob|handjob|titjob|assjob)/i,
	/(?:poista|poisto|poistaminen|poistamis)[ -]?(?:vaatteet|vaatteiden)/i,
	/see[- ]?through/i,
	/vaat.*pois/i,
    ];

    // Keep the testing switch above: turning it off disables Archive-only rules
    // without disabling any policy imported from google.js.
    const archiveNuclearRegex = ENABLE_ARCHIVE_LOCAL_RULES ? nuclearRegex : [];

    // --- Dynamic wrestler names, mirroring google.js's nuclear name policy ---
    // The background service already fetches TheSmackDownHotel rosters and refreshes
    // wrestling_women_urls on its normal schedule. Archive consumes that same dataset.
    const dynamicWrestlerNames = new Set();
    const dynamicWrestlerPatterns = [];
    function applyDynamicWrestlerBans(urls) {
        const exclusions = new Set(['melina', 'aj']);
        if (!Array.isArray(urls)) return;
        for (const url of urls) {
            const parts = String(url || '').split('/').filter(Boolean);
            const slug = String(parts[parts.length - 1] || '').toLowerCase();
            if (!slug || exclusions.has(slug)) continue;
            const name = slug.replace(/-/g, ' ').trim();
            if (!name || dynamicWrestlerNames.has(name)) continue;
            dynamicWrestlerNames.add(name);
            const namePattern = name.split(/\s+/).filter(Boolean)
                .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('[\\s_\\-]+');
            const visible = name.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]/g, '').length;
            const pattern = new RegExp(visible <= 5 ? `\\b${namePattern}\\b` : namePattern, 'i');
            if (dynamicWrestlerPatterns.some(rx => rx.source === pattern.source && rx.flags === pattern.flags)) continue;
            dynamicWrestlerPatterns.push(pattern);
        }
    }
    function reloadDynamicWrestlerBans() {
        try {
            const storage = globalThis.browser?.storage?.local || globalThis.chrome?.storage?.local;
            if (!storage?.get) return;
            Promise.resolve(storage.get('wrestling_women_urls')).then(result => {
                applyDynamicWrestlerBans(result?.wrestling_women_urls);
            }).catch(() => {});
        } catch (e) {}
    }
    reloadDynamicWrestlerBans();
    try {
        (globalThis.browser?.storage || globalThis.chrome?.storage)?.onChanged?.addListener((changes, area) => {
            if (area === 'local' && changes?.wrestling_women_urls) {
                applyDynamicWrestlerBans(changes.wrestling_women_urls.newValue);
            }
        });
    } catch (e) {}

    // Robust, cross-browser redirect
    function fastRedirect(targetUrl) {
        try { safeTop.location.replace(targetUrl); return; } catch {}
        try { window.location.replace(targetUrl); return; } catch {}
        try { safeTop.location.href = targetUrl; return; } catch {}
        try { window.location.href = targetUrl; } catch {}
    }

    // Google's AIRegexes/Finnish exclusions are authoritative; keep no mirrored AI list.
    function containsAiBoundary(text) {
        return ARD_googleAIHit(text);
    }

    function containsForbiddenKeywords(text) {
        if (!text) return false;

        const googleVerdict = ARD_googleQueryVerdict(text);
        if (googleVerdict.action === 'block') {
            recordMatchDetail('google-' + googleVerdict.tier, googleVerdict.match, text);
            return googleVerdict.match || true;
        }

        // 0) Quick AI-boundary check
        const aiHit = containsAiBoundary(text);
        if (aiHit) {
            recordMatchDetail('ai-boundary', aiHit, text);
            return aiHit;
        }

        // The shared TheSmackDownHotel roster is nuclear like on Google.
        const wrestlerHit = ARD_testRegexList(dynamicWrestlerPatterns, text);
        if (wrestlerHit) {
            recordMatchDetail('wrestling-roster', wrestlerHit, text);
            return wrestlerHit;
        }

        // One archive-local nuclear array, grouped by comments above.
        for (const re of archiveNuclearRegex) {
            try {
                re.lastIndex = 0;
                if (re.test(text)) {
                    recordMatchDetail('archive-nuclear', re.toString(), text);
                    return re.toString();
                }
            } catch (e) {
                console.warn('Archive nuclear regex error:', re, e);
            }
        }

        return false;
    }

    // Expose function
    if (typeof window !== 'undefined') {
        window.containsAiBoundary = containsAiBoundary;
        window.containsForbiddenKeywords = containsForbiddenKeywords;
    }

    // Prevent redirect loops but allow future redirects (short TTL, per-destination)
    const REDIRECT_FLAG = 'ARD_REDIRECTED_ONCE'; // legacy (kept for backward compatibility; no longer used)
    const LAST_REDIRECT_KEY = 'ARD_LAST_REDIRECT';
    const REDIRECT_TTL_MS = 2500;

    const alreadyRedirected = () => {
        try {
            const s = sessionStorage.getItem(LAST_REDIRECT_KEY);
            if (!s) return false;
            const o = JSON.parse(s);
            if (!o || !o.url || !o.ts) return false;
            const home = getHomeURLForCurrentSite();
            return o.url === home && (Date.now() - o.ts) < REDIRECT_TTL_MS;
        } catch { return false; }
    };
    const markRedirected = () => {
        try {
            const home = getHomeURLForCurrentSite();
            sessionStorage.setItem(LAST_REDIRECT_KEY, JSON.stringify({ url: home, ts: Date.now() }));
        } catch {}
    };

    // Centralized redirect: determines the correct home page per site (Archive vs xcancel),
    // and (safely) force-refreshes if we're already on that exact home, without looping.
    const redirectToHome = () => {
        if (alreadyRedirected()) return;
        const home = getHomeURLForCurrentSite();

        // Mark first, to survive reloads and avoid loops
        markRedirected();

        try {
            const cur = new URL(selfURL);
            const target = new URL(home);

            const normalize = (p) => (!p || p === '' ? '/' : (p.endsWith('/') ? p : p + '/'));
            const sameOrigin = cur.origin === target.origin;
            const samePath = normalize(cur.pathname) === normalize(target.pathname);

            if (sameOrigin && samePath) {
                try { safeTop.location.reload(); return; } catch {}
                fastRedirect(home);
                return;
            }
        } catch {}

        fastRedirect(home);
    };

    // Backward-compatible alias kept intact (do not remove/trim), delegates to redirectToHome
    const redirectToWayback = () => {
        redirectToHome();
    };

    // One local nuclear regex list, plus the imported Google policy tiers.
    const containsRestricted = (text) => {
        if (!text) return false;
        return !!containsForbiddenKeywords(String(text));
    };

    const checkRegexAndRedirect = () => {
        for (const regex of archiveNuclearRegex) {
            try {
                regex.lastIndex = 0;
                if (regex.test(selfURL) || regex.test(tryDecode(selfURL))) {
                    console.log(`Archive nuclear URL regex matched: ${regex}. Redirecting to ${getSiteLabel()}.`);
                    redirectToHome();
                    return true;
                }
            } catch (e) {}
        }
        return false;
    };

    if (checkRegexAndRedirect()) return;
    window.addEventListener('hashchange', checkRegexAndRedirect, true);
    window.addEventListener('popstate', checkRegexAndRedirect, true);

    // Additional function to check for banned URLs with or without "www."
    const bannedURLs = ["blogspot.com", "blogger.com", "ask.fm", "reddit.com", "reddit.com/r/", "kuvake.net", "lite.irc-galleria.net", "irc-galleria.net", "irc-galleria.fi", "irc.fi", "vsco.co", "wondershare.com", "wondershare.net", "vmware.com", "virtualbox.org", "azure.microsoft.com"];

    const isBannedURL = (urlLower, urlDecodedLower) => {
        for (let bannedURL of bannedURLs) {
            const b = bannedURL.toLowerCase();
            if (urlLower.includes(b) || urlLower.includes(`www.${b}`) || urlDecodedLower.includes(b) || urlDecodedLower.includes(`www.${b}`)) {
                return true;
            }
        }
        return false;
    };

    // Evaluate the legacy URL deny after Google's policy is available, so a
    // Google-allowed destination isn't prematurely rejected by a local URL substring.
    function ARD_checkLegacyBannedURL() {
        if (!ENABLE_ARCHIVE_LOCAL_RULES) return false;
        if (!isBannedURL(pageURLLower, pageURLDecodedLower)) return false;
        const target = getWaybackTargetURL(selfURL) || selfURL;
        if (ARD_googleRules && ARD_googleResultVerdict(target, '') === 'allow') return false;
        redirectToHome();
        return true;
    }
    void ARD_googlePolicyReady?.then(ARD_checkLegacyBannedURL);

    // Wait for DOM to be ready before checking content
    const waitForDOM = () => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initContentChecking, { once: true });
        } else {
            initContentChecking();
        }
    };

    // Utility: determine editable fields (inputs, textareas, contenteditable)
    const isContentEditable = (el) => !!el && el.nodeType === 1 && typeof el.isContentEditable === 'boolean' && el.isContentEditable;
    const isEditableField = (el) => {
        if (!el || el.nodeType !== 1) return false;
        if (el instanceof HTMLInputElement) {
            return !el.disabled && !el.readOnly && el.type !== 'hidden';
        }
        if (el instanceof HTMLTextAreaElement) {
            return !el.disabled && !el.readOnly;
        }
        if (isContentEditable(el)) return true;
        return false;
    };
    const getEditableValue = (el) => {
        if (!el) return '';
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value || '';
        if (isContentEditable(el)) return (el.textContent || '').trim();
        return '';
    };

    // Initialize content checking
    const initContentChecking = () => {
        // Search text may be typed freely. Only an attempted submit/Enter is evaluated.
        const searchFieldSelector = [
            'input.rbt-input-main', 'input#url[name="url"]',
            'input[type="search"]', 'input[name="search"]',
            'input[name="q"]', 'input[role="combobox"]',
            'form[action*="search"] input[type="text"]',
            'input[placeholder*="Search"]', 'input[placeholder*="Enter a URL"]'
        ].join(',');
        const shouldScanField = field => {
            if (!isEditableField(field)) return false;
            if (field.matches?.(searchFieldSelector)) return true;
            return !!field.closest?.('form[action*="search"], .search-bar form');
        };
        const findFields = form => [...form.querySelectorAll('input, textarea, [contenteditable]')]
            .filter(shouldScanField);
        const inspect = value => {
            if (!String(value || '').trim()) return false;
            const googleQuery = ARD_googleQueryVerdict(value);
            if (googleQuery.action === 'block') return googleQuery.match || 'google-query';
            // A submitted URL can also be denied by Google's link policy.
            if (/^https?:\/\//i.test(value) && ARD_googleResultVerdict(value, '') === 'block') return 'google-link';
            if (archiveCentralPolicyVerdict(value) === 'block') return 'central-policy';
            return containsForbiddenKeywords(value) || false;
        };
        let resumedForms = new WeakSet();
        const guardSearch = async (event, form, field, isKeyboard) => {
            if (!form && !field) return;
            if (form && resumedForms.has(form)) {
                resumedForms.delete(form);
                return;
            }
            const fields = form ? findFields(form) : (field && shouldScanField(field) ? [field] : []);
            if (!fields.length) return;
            const searchText = fields.map(getEditableValue).filter(Boolean).join(' ').trim();
            if (!searchText) return;

            // The background fetch is normally complete long before a human submits.
            // If not, hold this one submit until Google rules are available.
            if (ARD_googlePolicyReady && !ARD_googleRules) {
                event.preventDefault();
                event.stopImmediatePropagation?.();
                const ready = await ARD_googlePolicyReady;
                if (inspect(searchText)) { redirectToHome(); return; }
                if (form && !isKeyboard) {
                    resumedForms.add(form);
                    try { form.requestSubmit(event.submitter || undefined); }
                    catch (e) { HTMLFormElement.prototype.submit.call(form); }
                } else if (form) {
                    resumedForms.add(form);
                    try { form.requestSubmit(); }
                    catch (e) { HTMLFormElement.prototype.submit.call(form); }
                } else if (field && field.form) {
                    resumedForms.add(field.form);
                    try { field.form.requestSubmit(); }
                    catch (e) {}
                }
                return;
            }
            if (!inspect(searchText)) return;
            event.preventDefault();
            event.stopImmediatePropagation?.();
            redirectToHome();
        };
        document.addEventListener('submit', e => {
            const form = e.target;
            if (form instanceof HTMLFormElement) void guardSearch(e, form, null, false);
        }, true);
        // Reddit-like/SPA/auto-complete search handlers may consume Enter without
        // firing a native submit, so capture Enter in the real Wayback combobox too.
        document.addEventListener('keydown', e => {
            if (e.key !== 'Enter' || e.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
            const field = e.target?.closest?.('input, textarea, [contenteditable]');
            if (!field || field.tagName === 'TEXTAREA' || !shouldScanField(field)) return;
            // Avoid duplicate handling: submit will catch a normal form when it fires.
            // Inspect synchronously when rules are ready, before site JS intercepts Enter.
            const value = getEditableValue(field);
            if (ARD_googleRules || !ARD_googlePolicyReady) {
                if (!inspect(value)) return;
                e.preventDefault();
                e.stopImmediatePropagation?.();
                redirectToHome();
            } else {
                // Pending import: wait via the form-based guard.
                void guardSearch(e, field.form, field, true);
            }
        }, true);
        // New result cards are scanned without inspecting whatever a user is typing.
        const scan = () => {
            scanCentralBlockedArchiveLinks();
            ARD_applyGoogleResultFilters();
        };
        ARD_centralPolicyContentRefresh = scan;
        scan();
        let scanScheduled = false;
        const scheduleScan = () => {
            if (scanScheduled) return;
            scanScheduled = true;
            setTimeout(() => { scanScheduled = false; scan(); }, 100);
        };
        const observer = new MutationObserver(mutations => {
            // Do not rescan on every keystroke or a style change made by our own filter.
            if (mutations.some(m => m.type === 'childList')) scheduleScan();
        });
        try { observer.observe(document.documentElement, { subtree: true, childList: true }); } catch (e) {}
        window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
        void ARD_googlePolicyReady?.then(scan);
    };

    // Direct navigation is still checked, but never inspect a live input value here.
    // Search text is inspected exclusively by the Enter/submit handlers above.
    function ARD_checkGoogleNavigation() {
        if (!ARD_googleRules) return false;
        try {
            const parsed = new URL(window.location.href);
            let candidate = '';
            if (isWaybackSite()) {
                candidate = getWaybackTargetURL(parsed.href) || '';
                if (!candidate) candidate = parsed.searchParams.get('url') || parsed.searchParams.get('q') || '';
            } else if (isArchiveOrgSite()) {
                candidate = parsed.searchParams.get('query') || parsed.searchParams.get('q') || '';
                if (!candidate && /^\/(?:details|download|services)\//i.test(parsed.pathname)) {
                    candidate = decodeURIComponent(parsed.pathname);
                }
            } else if (isXcancelSite()) {
                candidate = parsed.searchParams.get('q') || '';
            }
            if (!candidate) return false;
            const matched = ARD_googleQueryVerdict(candidate);
            if (matched.action === 'block') {
                redirectToHome();
                return true;
            }
            // Also enforce Google's hard URL/image/TLD/priority denies on *actual*
            // navigated archive targets, not the containing Wayback hostname.
            if (/^https?:\/\//i.test(candidate) && ARD_googleResultVerdict(candidate, '') === 'block') {
                redirectToHome();
                return true;
            }
        } catch (e) {}
        return false;
    }
    void ARD_googlePolicyReady?.then(ARD_checkGoogleNavigation);
    window.addEventListener('popstate', ARD_checkGoogleNavigation, true);
    window.addEventListener('hashchange', ARD_checkGoogleNavigation, true);

    // Start the content checking process
    waitForDOM();

// End of userscript
})();
