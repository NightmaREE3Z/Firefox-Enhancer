// ==UserScript==
// @name         IGCleaner 29.5.5
// @version	 29.5.5
// @date	 2026-10-22
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

    // ===== HOME FEED PRE-RENDER SANITIZER (MAIN WORLD) =====
    // V6H keeps Instagram's ordinary Home inventory (variant=home). The sanitizer
    // removes unwanted connection edges before Relay/React creates feed slots.
    // Relationship-aware exceptions preserve collaborative/tag-connected posts when
    // Instagram exposes an explicit followed participant. page_info/end_cursor stay
    // exactly as supplied by Instagram; no scroll or DOM geometry is touched here.
    // Pagination requests are widened from 12 to 24 raw edges, then up to 36 after
    // very sparse sanitized pages, without changing cursors or feed variants.
    function __bfInstallHomeFeedNetworkSanitizer() {
        try {
            if (!location.hostname.includes('instagram.com')) return;
            if (window.__bfInstagramFeedNetworkSanitizerInstalled) return;
            window.__bfInstagramFeedNetworkSanitizerInstalled = true;

            const FEED_DOC_ID = '28744841435121707';
            const FEED_FRIENDLY_NAME = 'PolarisFeedRootPaginationCachedQuery_subscribe';
            const FEED_ROOT_FIELD = 'xdt_api__v1__feed__timeline__connection';
            const FEED_URL_RE = /\/graphql\/query(?:[/?]|$)/i;
            const CONFIG_REQUEST_TYPE = 'ig-mainworld-config-request';
            const CLASSIFICATION_TYPE = 'ig-feed-classifications';
            const OWN = Object.prototype.hasOwnProperty;
            const PAGINATION_FIRST_MIN = 24;
            const PAGINATION_FIRST_SPARSE = 36;
            const CONFIG_SEND_GRACE_MS = 450;
            const feedPageStats = [];
            // Diagnostic-only counters. No URLs, usernames, captions, tokens or Post IDs.
            // Nothing in this object changes filtering, request bodies, or pagination.
            const bfFeedTelemetryV1 = {
                version: 1,
                startedAt: Date.now(),
                network: {
                    recognizedXHR: 0,
                    completedXHR: 0,
                    recognizedFetch: 0,
                    otherHomeGraphqlXHR: 0,
                    otherHomeGraphqlFetch: 0,
                    homeGraphqlStarted: 0,
                    homeGraphqlCompleted: 0,
                    homeGraphqlFailed: 0,
                    latestHomeGraphqlAt: 0,
                    latestHomeGraphqlDoneAt: 0,
                    matchedConnections: 0,
                    completeCaptionsSeen: 0,
                    completeCaptionsBlocked: 0,
                    verifiedCaptionEvidence: 0,
                    originalEdges: 0,
                    deliveredEdges: 0,
                    lastFeedRequestAt: 0,
                    lastFeedResponseAt: 0,
                    lastConnectionAt: 0,
                    payloadsWithoutConnection: 0,
                    parseFailures: 0,
                    otherHomeStarted: 0,
                    otherHomeCompleted: 0,
                    otherHomeFailed: 0,
                    lastOtherHomeAt: 0,
                    lastOtherHomeDoneAt: 0,
                    homeFeedAPIStarted: 0,
                    // Zero-delivery continuation recovery; counters only, no cursor data.
                    emptyContinuationPages: 0,
                    rearmCycles: 0,
                    rearmAttempts: 0,
                    rearmFollowupsSeen: 0,
                    rearmExhausted: 0,
                    rearmSkippedOffscreen: 0,
                    lastRearmAt: 0,
                    rearmState: 'idle',
                    // Sparse initial bootstrap: DOM is exhausted before any recognized
                    // feed pagination response. Kept separate from empty-page counts.
                    initialSparseStalls: 0,
                    initialSparseRearmCycles: 0,
                    initialSparseRearmAttempts: 0,
                    initialSparseRearmFollowupsSeen: 0,
                    initialSparseRearmExhausted: 0,
                    initialSparseRearmState: 'idle'
                },
                pages: feedPageStats,
                // Capped metadata only. Never retain URLs, variables, cursors, response
                // text, account names, post identities, headers or auth tokens here.
                requestHistory: [],
                operationCounts: {},
                // v3: categorized first-party XHR/fetch metadata, never request URLs.
                otherRequestHistory: [],
                otherRequestCategories: {},
                dom: null,
                domHistory: [],
                recentDecisions: []
            };
            try { window.__bfInstagramFeedDiagnosticsV1 = bfFeedTelemetryV1; } catch {}
            try {
                window.__IGCleanerPrepaintV2955 = () => ({
                    route: location.pathname || '/',
                    mode: 'MAIN-world structured-caption/pre-render audit',
                    feedConnections: bfFeedTelemetryV1.network.matchedConnections,
                    feedEdgesReceived: bfFeedTelemetryV1.network.originalEdges,
                    feedEdgesDelivered: bfFeedTelemetryV1.network.deliveredEdges,
                    completeCaptionsInspected: bfFeedTelemetryV1.network.completeCaptionsSeen,
                    captionsBlockedByContent: bfFeedTelemetryV1.network.completeCaptionsBlocked,
                    completeCaptionEvidencePublished: bfFeedTelemetryV1.network.verifiedCaptionEvidence,
                    dom: bfFeedTelemetryV1.dom ? {
                        articles: bfFeedTelemetryV1.dom.articles,
                        pendingNear: bfFeedTelemetryV1.dom.pendingNear,
                        collapsedNear: bfFeedTelemetryV1.dom.collapsedNear,
                        decisionReasons: bfFeedTelemetryV1.dom.decisionReasons
                    } : null,
                    note: 'Aggregate, read-only; network counters refer to recognized Home feed responses, not every Instagram post.'
                });
            } catch {}

            // ===== v2 passive Home GraphQL operation census =====
            // Capture request *metadata* across GraphQL formats, not just the one
            // pagination operation we know how to sanitize. No request/response
            // rewrites, no extra network calls, and no body/URL logging.
            const BF_DIAG_REQUEST_LIMIT = 48;
            const BF_DIAG_OP_LIMIT = 48;

            function bfIsHomeDiagV2() {
                try { return location.hostname === 'www.instagram.com' && (location.pathname === '/' || !location.pathname); }
                catch { return false; }
            }

            function bfIsGraphqlRequestV2(value) {
                try {
                    const url = new URL(String(value || ''), location.origin);
                    if (url.hostname !== 'www.instagram.com') return false;
                    return /^\/(?:api\/)?graphql(?:\/query)?\/?$/i.test(url.pathname);
                } catch { return false; }
            }

            function bfSafeOperationNameV2(value) {
                try {
                    const name = String(value || '').trim();
                    // GraphQL friendly names, never arbitrary URL/body fragments.
                    if (!/^[A-Za-z][A-Za-z0-9_]{2,95}$/.test(name)) return '';
                    if (!/(?:Polaris|Query|Mutation|Subscription|_subscribe|Feed)/i.test(name)) return '';
                    return name;
                } catch { return ''; }
            }

            function bfFormParamsV2(value) {
                try {
                    if (value instanceof URLSearchParams) return value;
                    if (typeof value === 'string' && value.length <= 180000) return new URLSearchParams(value);
                } catch {}
                return null;
            }

            function bfGraphqlMetadataV2(url, body, friendlyHeader, method) {
                const data = {
                    operation: '(unlabeled)',
                    transportMethod: /^(GET|POST)$/i.test(String(method || '')) ? String(method).toUpperCase() : 'other',
                    kind: 'unknown',
                    hasCursor: false,
                    hasDocId: false,
                    first: null
                };
                try {
                    const query = new URL(String(url || ''), location.origin).searchParams;
                    const form = bfFormParamsV2(body);
                    const read = (key) => form?.get(key) || query.get(key) || '';
                    const friendly = bfSafeOperationNameV2(friendlyHeader) || bfSafeOperationNameV2(read('fb_api_req_friendly_name'));
                    if (friendly) data.operation = friendly;
                    data.hasDocId = !!read('doc_id');
                    const rawVariables = read('variables');
                    if (rawVariables && rawVariables.length <= 120000) {
                        const vars = JSON.parse(rawVariables);
                        if (vars && typeof vars === 'object' && !Array.isArray(vars)) {
                            data.hasCursor = typeof vars.after === 'string' && !!vars.after;
                            if (Number.isInteger(vars.first) && vars.first >= 0 && vars.first <= 200) data.first = vars.first;
                            if (vars.variant === 'home') data.kind = data.hasCursor ? 'home-pagination' : 'home-initial';
                            else data.kind = data.hasCursor ? 'other-pagination' : 'other-query';
                        }
                    }
                } catch {}
                return data;
            }

            function bfRegisterGraphqlV2(transport, method, url, body, friendlyHeader) {
                try {
                    if (!bfIsHomeDiagV2() || !bfIsGraphqlRequestV2(url)) return null;
                    const n = bfFeedTelemetryV1.network;
                    n.homeGraphqlStarted++;
                    n.latestHomeGraphqlAt = Date.now();
                    const record = {
                        time: n.latestHomeGraphqlAt,
                        transport,
                        ...bfGraphqlMetadataV2(url, body, friendlyHeader, method),
                        status: 'pending',
                        elapsedMs: null
                    };
                    bfFeedTelemetryV1.requestHistory.push(record);
                    while (bfFeedTelemetryV1.requestHistory.length > BF_DIAG_REQUEST_LIMIT) bfFeedTelemetryV1.requestHistory.shift();
                    const counts = bfFeedTelemetryV1.operationCounts;
                    const name = record.operation;
                    if (!Object.prototype.hasOwnProperty.call(counts, name) && Object.keys(counts).length >= BF_DIAG_OP_LIMIT) {
                        counts['(other operations)'] = (counts['(other operations)'] || 0) + 1;
                    } else {
                        counts[name] = (counts[name] || 0) + 1;
                    }
                    return record;
                } catch { return null; }
            }

            function bfCompleteGraphqlV2(record, status) {
                try {
                    if (!record || record.status !== 'pending') return;
                    const n = bfFeedTelemetryV1.network;
                    n.homeGraphqlCompleted++;
                    n.latestHomeGraphqlDoneAt = Date.now();
                    record.elapsedMs = Math.max(0, n.latestHomeGraphqlDoneAt - record.time);
                    // Status code only; no server responses or error text.
                    record.status = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
                    if (record.status < 200 || record.status >= 400) n.homeGraphqlFailed++;
                } catch {}
            }

            // ===== v3 passive Home request-path census =====
            // Attach to the *existing* XHR/fetch wrappers. Only classify fixed,
            // first-party endpoint families; never expose URL paths, params, headers,
            // variables, bodies, responses, cookies, or identifiers. No rewrites.
            const BF_DIAG_OTHER_LIMIT_V3 = 48;
            function bfClassifyOtherHomeRequestV3(rawUrl) {
                try {
                    if (!bfIsHomeDiagV2()) return '';
                    const url = new URL(String(rawUrl || ''), location.origin);
                    if (url.hostname !== 'www.instagram.com' && url.hostname !== 'i.instagram.com') return '';
                    const path = url.pathname || '/';
                    if (bfIsGraphqlRequestV2(rawUrl) || /^\/(?:api\/)?graphql(?:\/|$)/i.test(path)) return '';
                    if (/^\/api\/v1\/feed(?:\/|$)/i.test(path)) return 'feed-api';
                    if (/^\/api\/v1\/stories(?:\/|$)/i.test(path)) return 'stories-api';
                    if (/^\/api\/v1\//i.test(path)) return 'other-api-v1';
                    if (/^\/api\//i.test(path)) return 'other-api';
                    if (/^\/ajax\//i.test(path)) return 'ajax';
                    if (/^\/web\//i.test(path)) return 'web-api';
                    if (/^\/(?:async|feed)\//i.test(path)) return 'other-dynamic';
                } catch {}
                return '';
            }

            function bfRegisterOtherHomeRequestV3(transport, method, url) {
                try {
                    const category = bfClassifyOtherHomeRequestV3(url);
                    if (!category) return null;
                    const n = bfFeedTelemetryV1.network;
                    n.otherHomeStarted++;
                    n.lastOtherHomeAt = Date.now();
                    if (category === 'feed-api') n.homeFeedAPIStarted++;
                    const record = {
                        time: n.lastOtherHomeAt,
                        transport,
                        category,
                        method: /^(GET|POST)$/i.test(String(method || '')) ? String(method).toUpperCase() : 'other',
                        status: 'pending', elapsedMs: null
                    };
                    bfFeedTelemetryV1.otherRequestHistory.push(record);
                    while (bfFeedTelemetryV1.otherRequestHistory.length > BF_DIAG_OTHER_LIMIT_V3) bfFeedTelemetryV1.otherRequestHistory.shift();
                    const counts = bfFeedTelemetryV1.otherRequestCategories;
                    counts[category] = (counts[category] || 0) + 1;
                    return record;
                } catch { return null; }
            }

            function bfCompleteOtherHomeRequestV3(record, status) {
                try {
                    if (!record || record.status !== 'pending') return;
                    const n = bfFeedTelemetryV1.network;
                    n.otherHomeCompleted++;
                    n.lastOtherHomeDoneAt = Date.now();
                    record.elapsedMs = Math.max(0, n.lastOtherHomeDoneAt - record.time);
                    record.status = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
                    if (record.status < 200 || record.status >= 400) n.otherHomeFailed++;
                } catch {}
            }
            let paginationFirstTarget = PAGINATION_FIRST_MIN;

            // ===== Bounded native feed-trigger recovery =====
            // Both an all-filtered pagination response and an exhausted bootstrap
            // feed can strand Instagram's loader. Test evidence confirms a native
            // scroll event can wake the bootstrap loader without moving the page.
            // We never construct network requests, change cursors, or show blocked posts.
            const EMPTY_REARM_DELAYS_MS = [900, 2500, 4800];
            const INITIAL_SPARSE_STABLE_MS = 3000;
            const INITIAL_SPARSE_MIN_UPTIME_MS = 6500;
            let emptyRearmGeneration = 0;
            const emptyRearmCycleTimes = [];
            let initialSparseSince = 0;
            let initialSparseRearmStarted = false;
            let activeRearmFollowupCheck = null;

            function bfStartNativeFeedRearm(source) {
                try {
                    const n = bfFeedTelemetryV1.network;
                    const isInitial = source === 'initial-sparse';
                    const now = Date.now();
                    while (emptyRearmCycleTimes.length && now - emptyRearmCycleTimes[0] > 60000) {
                        emptyRearmCycleTimes.shift();
                    }
                    // Shared limit: an initial rearm plus an empty-page follow-up
                    // cannot cause an unbounded sequence of synthetic scrolls.
                    if (emptyRearmCycleTimes.length >= 2) {
                        n.rearmState = 'rate-limited';
                        if (isInitial) n.initialSparseRearmState = 'rate-limited';
                        return false;
                    }
                    emptyRearmCycleTimes.push(now);
                    n.rearmCycles++;
                    n.rearmState = isInitial ? 'initial-sparse-scheduled' : 'scheduled';
                    if (isInitial) {
                        n.initialSparseStalls++;
                        n.initialSparseRearmCycles++;
                        n.initialSparseRearmState = 'scheduled';
                    }
                    const generation = ++emptyRearmGeneration;
                    const baselineRequests = n.recognizedXHR + n.recognizedFetch;
                    let attempted = false;
                    let followupRecorded = false;
                    let skipped = false;
                    // Record follow-ups at request start as well as at timer checks.
                    // Fast empty replies can otherwise start a second cycle before
                    // the first cycle's next scheduled check gets to run.
                    const noteFollowup = () => {
                        if (generation !== emptyRearmGeneration || followupRecorded ||
                            n.recognizedXHR + n.recognizedFetch <= baselineRequests) return false;
                        n.rearmFollowupsSeen++;
                        if (isInitial) n.initialSparseRearmFollowupsSeen++;
                        followupRecorded = true;
                        n.rearmState = 'new-feed-request-observed';
                        if (isInitial) n.initialSparseRearmState = 'new-feed-request-observed';
                        return true;
                    };
                    activeRearmFollowupCheck = noteFollowup;

                    for (let index = 0; index < EMPTY_REARM_DELAYS_MS.length; index++) {
                        setTimeout(() => {
                            try {
                                if (generation !== emptyRearmGeneration) return;
                                if (location.hostname !== 'www.instagram.com' || location.pathname !== '/' ||
                                    document.hidden) {
                                    n.rearmState = 'inactive';
                                    if (isInitial) n.initialSparseRearmState = 'inactive';
                                    return;
                                }
                                if (n.recognizedXHR + n.recognizedFetch > baselineRequests) {
                                    noteFollowup();
                                    return;
                                }
                                const snap = bfFeedTelemetryV1.dom;
                                // An initial-feed wake must stop once the DOM has
                                // viable content or the scanner has resumed work.
                                if (isInitial && (!snap || Number(snap.displayCandidatesNear) > 0 ||
                                    Number(snap.pendingNear) > 0 || Number(snap.queued) > 0 ||
                                    snap.scanning === true || Number(snap.nearLoadingIndicators) < 1 ||
                                    Number(snap.collapsedNear) < 1)) {
                                    n.rearmState = 'initial-sparse-resolved';
                                    n.initialSparseRearmState = 'resolved';
                                    return;
                                }
                                const viewport = Math.max(1, window.innerHeight || 900);
                                const remaining = Number(snap?.scrollRemainingPx);
                                if (!snap || !Number.isFinite(remaining) ||
                                    remaining > Math.max(1200, viewport * 1.5)) {
                                    skipped = true;
                                    n.rearmSkippedOffscreen++;
                                    n.rearmState = 'not-near-bottom';
                                    if (isInitial) n.initialSparseRearmState = 'not-near-bottom';
                                    return;
                                }
                                attempted = true;
                                n.rearmAttempts++;
                                if (isInitial) n.initialSparseRearmAttempts++;
                                n.lastRearmAt = Date.now();
                                n.rearmState = 'native-scroll-event-dispatched';
                                if (isInitial) n.initialSparseRearmState = 'native-scroll-event-dispatched';
                                window.dispatchEvent(new Event('scroll'));
                                if (index === EMPTY_REARM_DELAYS_MS.length - 1) {
                                    setTimeout(() => {
                                        try {
                                            if (generation !== emptyRearmGeneration) return;
                                            if (n.recognizedXHR + n.recognizedFetch > baselineRequests) {
                                                noteFollowup();
                                                return;
                                            }
                                            if (attempted) {
                                                n.rearmExhausted++;
                                                n.rearmState = 'no-new-feed-request';
                                                if (isInitial) {
                                                    n.initialSparseRearmExhausted++;
                                                    n.initialSparseRearmState = 'no-new-feed-request';
                                                }
                                            } else if (skipped) {
                                                n.rearmState = 'not-near-bottom';
                                            }
                                        } catch {}
                                    }, 600);
                                }
                            } catch {}
                        }, EMPTY_REARM_DELAYS_MS[index]);
                    }
                    return true;
                } catch { return false; }
            }

            function bfStartEmptyContinuationRearm(item) {
                try {
                    if (!item || item.received < 1 || item.delivered !== 0 ||
                        item.hasNextPage !== true || item.hasEndCursor !== true) return;
                    bfFeedTelemetryV1.network.emptyContinuationPages++;
                    bfStartNativeFeedRearm('empty-continuation');
                } catch {}
            }

            function bfMaybeRearmSparseInitialFeed(snap) {
                try {
                    if (initialSparseRearmStarted) return;
                    const n = bfFeedTelemetryV1.network;
                    const eligible = location.hostname === 'www.instagram.com' &&
                        location.pathname === '/' && !document.hidden &&
                        n.recognizedXHR + n.recognizedFetch === 0 && n.matchedConnections === 0 &&
                        snap && Number(snap.articles) >= 2 && Number(snap.collapsedNear) >= 1 &&
                        Number(snap.displayCandidatesNear) === 0 && Number(snap.pendingNear) === 0 &&
                        Number(snap.queued) === 0 && snap.scanning === false &&
                        snap.scrollSettling !== true && Number(snap.nearLoadingIndicators) > 0 &&
                        Number.isFinite(Number(snap.scrollRemainingPx)) &&
                        Number(snap.scrollRemainingPx) <= Math.max(1200, (window.innerHeight || 900) * 1.5);
                    if (!eligible) {
                        initialSparseSince = 0;
                        return;
                    }
                    const now = Date.now();
                    if (!initialSparseSince) initialSparseSince = now;
                    if (now - bfFeedTelemetryV1.startedAt < INITIAL_SPARSE_MIN_UPTIME_MS ||
                        now - initialSparseSince < INITIAL_SPARSE_STABLE_MS) return;
                    // Once per document. If it fails, do not repeatedly nudge a
                    // settled feed on each 1.8-second diagnostic snapshot.
                    initialSparseRearmStarted = true;
                    bfStartNativeFeedRearm('initial-sparse');
                } catch {}
            }
            try { window.__bfInstagramFeedSanitizerStatsV6H = feedPageStats; } catch {}

            let configuredKeywordRegexes = [];
            let configuredKeywordRegexFallback = [];
            let configuredAllowedWords = [];
            let configuredBannedAccounts = new Set();
            let configuredTrustedAuthorsV326 = new Set();
            let friendConfigReadyV326 = false;
            let keywordConfigReady = false;
            let allowedConfigReady = false;
            let accountConfigReady = false;
            let classificationSequence = 0;
            let isolatedWorldReady = false;
            const pendingClassificationBatches = [];
            const learnedFollowingUsernames = new Set();

            const builtInCriticalRegexes = [
                /tekoälysisältö/i,
                /luotu todennäköisesti tekoälyllä/i,
                /(?<![\p{L}\p{N}])ai[ -]?generated(?![\p{L}\p{N}])/iu,
                /(?<![\p{L}\p{N}])ai[ -]?created(?![\p{L}\p{N}])/iu,
                /(?<![\p{L}\p{N}])ai[ -]?generated content(?![\p{L}\p{N}])/iu,
                /(?<![\p{L}\p{N}])ai[ -]?created content(?![\p{L}\p{N}])/iu,
                /(?<![\p{L}\p{N}])ai[ -]?art(?![\p{L}\p{N}])/iu,
                /(?<![\p{L}\p{N}])ai[ -]?edited(?![\p{L}\p{N}])/iu,
                /(?<![\p{L}\p{N}])AI(?![\p{L}\p{N}])/iu
            ];

            function normalizeUsername(value) {
                return String(value || '').trim().replace(/^@+/, '').toLowerCase();
            }

            function normalizeText(value) {
                return String(value || '').replace(/\s+/g, ' ').trim();
            }

            // ===== v29.5.5: keep MAIN-world matching aligned with the DOM matcher =====
            // Full structured caption.text is already inspected BEFORE React renders Home
            // pagination. Only improve matcher semantics; never alter feed cursors or DOM.
            function ig2955NetworkRegexSource(source) {
                const compact = source.replace(/\\-/g, '-');
                if (compact === 'AI-') return '(?<![\\p{L}\\p{N}])AI-';
                if (compact === '-\\AI' || compact === '-AI') return '-AI(?![\\p{L}\\p{N}])';
                if (source === '\\bAI\\b') return '(?<![\\p{L}\\p{N}])AI(?![\\p{L}\\p{N}])';
                if (source === '\\b#AI\\b') return '(?<![\\p{L}\\p{N}_])#AI(?![\\p{L}\\p{N}_])';
                if (source.toLowerCase() === 'gener') return '(?<![\\p{L}\\p{N}])(?:generat(?:e|ed|ing|ion|ions|ive|or|ors)|generoi(?:va|tu|da|nti)[\\p{L}]*)(?![\\p{L}\\p{N}])';
                if (source.toLowerCase() === 'generative' || source.toLowerCase() === 'generated') return '(?<![\\p{L}\\p{N}])' + source + '(?![\\p{L}\\p{N}])';
                if (/^AI(?:[ -](?:generated|created|creative|create|model|art|edit|edited|suck)|blow|suck)$/i.test(compact)) return '(?<![\\p{L}\\p{N}])' + source;
                return source;
            }

            function ig2955NetworkHashtagSource(source) {
                const literal = source.replace(/\\([.\-])/g, '$1');
                if (!/^[\p{L}\p{N}]+(?:[ ._-][\p{L}\p{N}]+)+$/u.test(literal)) return '';
                const parts = literal.split(/[ ._-]+/);
                if (parts.join('').length < 6) return '';
                return '(?<![\\p{L}\\p{N}_])#' + parts.join('[._-]?') + '(?![\\p{L}\\p{N}_])';
            }

            function compileKeywordRegex(patterns) {
                try {
                    configuredKeywordRegexes = [];
                    configuredKeywordRegexFallback = [];
                    if (!Array.isArray(patterns) || !patterns.length) return;
                    const sources = [];
                    const hashtags = [];
                    for (const item of patterns) {
                        if (!item || typeof item.source !== 'string' || !item.source) continue;
                        try {
                            const flags = typeof item.flags === 'string' && item.flags ? item.flags : 'i';
                            const source = ig2955NetworkRegexSource(item.source);
                            const unicodeFlags = source !== item.source && !flags.includes('u') ? flags + 'u' : flags;
                            const test = new RegExp(source, unicodeFlags);
                            if (test.flags === 'i') sources.push(`(?:${source})`);
                            else configuredKeywordRegexFallback.push(test);
                            const tag = ig2955NetworkHashtagSource(item.source);
                            if (tag) hashtags.push(tag);
                        } catch {}
                    }
                    const CHUNK_SIZE = 48;
                    for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
                        try { configuredKeywordRegexes.push(new RegExp(sources.slice(i, i + CHUNK_SIZE).join('|'), 'i')); } catch {}
                    }
                    for (let i = 0; i < hashtags.length; i += CHUNK_SIZE) {
                        try { configuredKeywordRegexFallback.push(new RegExp(hashtags.slice(i, i + CHUNK_SIZE).join('|'), 'iu')); } catch {}
                    }
                } catch {
                    configuredKeywordRegexes = [];
                    configuredKeywordRegexFallback = [];
                }
            }

            function updateKeywordConfig(patterns) {
                compileKeywordRegex(patterns);
                keywordConfigReady = true;
            }

            function updateAllowedConfig(words) {
                try {
                    configuredAllowedWords = Array.isArray(words)
                        ? words.map(value => String(value || '').trim().toLowerCase()).filter(Boolean)
                        : [];
                } catch { configuredAllowedWords = []; }
                allowedConfigReady = true;
            }

            function updateAccountConfig(accounts) {
                try {
                    const next = new Set();
                    if (Array.isArray(accounts)) {
                        for (const account of accounts) {
                            const value = normalizeUsername(account);
                            if (value) next.add(value);
                        }
                    }
                    configuredBannedAccounts = next;
                } catch { configuredBannedAccounts = new Set(); }
                accountConfigReady = true;
            }

            function updateFriendAuthorConfigV326(accounts) {
                const next = new Set();
                if (Array.isArray(accounts)) {
                    for (const account of accounts.slice(0, 128)) {
                        const username = normalizeUsername(account);
                        if (/^[a-z0-9._]{1,30}$/.test(username)) next.add(username);
                    }
                }
                configuredTrustedAuthorsV326 = next;
                friendConfigReadyV326 = true;
            }

            function allConfigsReady() {
                return keywordConfigReady && allowedConfigReady && accountConfigReady && friendConfigReadyV326;
            }

            function textHasAllowedWord(value) {
                try {
                    const text = String(value || '').toLowerCase();
                    if (!text || !configuredAllowedWords.length) return false;
                    for (const word of configuredAllowedWords) {
                        if (word && text.includes(word)) return true;
                    }
                } catch {}
                return false;
            }


            // Allow-list exceptions belong to the overlapping matched word, not to
            // the entire caption. An unrelated emoji must not cancel "Sweeney".
            function regexMatchesOutsideAllowedSpan(regex, text) {
                try {
                    const value = String(text || '');
                    const lower = value.toLowerCase();
                    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
                    const matcher = new RegExp(regex.source, flags);
                    let match;
                    let inspected = 0;
                    while ((match = matcher.exec(value)) && inspected++ < 256) {
                        const start = match.index;
                        const end = start + Math.max(1, match[0].length);
                        const overlapsAllowed = configuredAllowedWords.some(word => {
                            if (!word) return false;
                            const at = lower.indexOf(word, Math.max(0, start - word.length + 1));
                            return at >= 0 && at < end && at + word.length > start;
                        });
                        if (!overlapsAllowed) return true;
                        if (!match[0].length) matcher.lastIndex++;
                    }
                } catch {}
                return false;
            }

            function configuredKeywordMatches(value) {
                try {
                    const text = String(value || '');
                    if (!text) return false;

                    for (const regex of builtInCriticalRegexes) {
                        try {
                            if (regexMatchesOutsideAllowedSpan(regex, text)) return true;
                        } catch {}
                    }
                    if (!keywordConfigReady) return false;
                    for (const regex of configuredKeywordRegexes) {
                        try {
                            if (regexMatchesOutsideAllowedSpan(regex, text)) return true;
                        } catch {}
                    }
                    for (const regex of configuredKeywordRegexFallback) {
                        try {
                            if (regexMatchesOutsideAllowedSpan(regex, text)) return true;
                        } catch {}
                    }
                } catch {}
                return false;
            }

            function flushPendingClassifications() {
                try {
                    if (!isolatedWorldReady || !pendingClassificationBatches.length) return;
                    while (pendingClassificationBatches.length) {
                        const items = pendingClassificationBatches.shift();
                        if (!Array.isArray(items) || !items.length) continue;
                        window.postMessage({
                            __metamanglerType: CLASSIFICATION_TYPE,
                            sequence: ++classificationSequence,
                            items
                        }, location.origin);
                    }
                } catch {}
            }

            window.addEventListener('message', (event) => {
                try {
                    if (event.source !== window) return;
                    const data = event.data;
                    if (!data || typeof data !== 'object') return;
                    if (data.__metamanglerType === 'ig-keyword-config') {
                        updateKeywordConfig(data.patterns);
                        isolatedWorldReady = true;
                        flushPendingClassifications();
                    } else if (data.__metamanglerType === 'ig-allowed-config') {
                        updateAllowedConfig(data.words);
                        isolatedWorldReady = true;
                        flushPendingClassifications();
                    } else if (data.__metamanglerType === 'ig-account-config') {
                        updateAccountConfig(data.accounts);
                        isolatedWorldReady = true;
                        flushPendingClassifications();
                    } else if (data.__metamanglerType === 'ig-friend-author-config-v326') {
                        updateFriendAuthorConfigV326(data.accounts);
                    } else if (data.__metamanglerType === 'ig-feed-classifier-ready') {
                        isolatedWorldReady = true;
                        flushPendingClassifications();
                    } else if (data.__metamanglerType === 'ig-home-feed-diagnostics-v1') {
                        // Read-only aggregate handoff from the isolated DOM coordinator.
                        // Deliberately exclude post identity and content from exposed diagnostics.
                        const snapshot = data.snapshot;
                        if (!snapshot || snapshot.version !== 1 || typeof snapshot !== 'object') return;
                        const allowed = [
                            'time', 'articles', 'nearViewport', 'collapsedNear', 'pendingNear',
                            'displayCandidatesNear', 'unknownIDNear', 'queued', 'scanning',
                            'networkRejectedMounted', 'cachedRejectedMounted',
                            'recentRejections', 'recentApprovals', 'recentProvisionals',
                            'decisionReasons', 'lastDecisionAt',
                            // v3: purely numerical, bounded layout/sentinel measurements.
                            'viewportHeightPx', 'scrollTopPx', 'scrollRemainingPx',
                            'documentHeightPx', 'feedRootBottomPx', 'lastArticleBottomPx',
                            'lastArticleGapPx', 'nativeLoadingIndicators',
                            'nearLoadingIndicators', 'nearestLoadingTopPx',
                            'scrollSettling'
                        ];
                        const safe = { version: 1 };
                        for (const key of allowed) {
                            if (key === 'decisionReasons') {
                                const reasons = snapshot.decisionReasons;
                                if (reasons && typeof reasons === 'object') {
                                    safe.decisionReasons = {};
                                    for (const name of ['network', 'cached', 'badge-or-follow', 'visible-text', 'full-scan', 'other']) {
                                        safe.decisionReasons[name] = Math.max(0, Number(reasons[name]) || 0);
                                    }
                                }
                            } else if (typeof snapshot[key] === 'number' || typeof snapshot[key] === 'boolean') {
                                safe[key] = snapshot[key];
                            }
                        }
                        bfFeedTelemetryV1.dom = safe;
                        bfFeedTelemetryV1.domHistory.push({
                            time: safe.time, articles: safe.articles, nearViewport: safe.nearViewport,
                            collapsedNear: safe.collapsedNear, pendingNear: safe.pendingNear,
                            displayCandidatesNear: safe.displayCandidatesNear,
                            unknownIDNear: safe.unknownIDNear, queued: safe.queued,
                            feedRequests: bfFeedTelemetryV1.network.recognizedXHR + bfFeedTelemetryV1.network.recognizedFetch,
                            homeGraphqlRequests: bfFeedTelemetryV1.network.homeGraphqlStarted,
                            latestHomeGraphqlAt: bfFeedTelemetryV1.network.latestHomeGraphqlAt,
                            otherHomeRequests: bfFeedTelemetryV1.network.otherHomeStarted,
                            latestOtherHomeAt: bfFeedTelemetryV1.network.lastOtherHomeAt,
                            feedAPIRequests: bfFeedTelemetryV1.network.homeFeedAPIStarted,
                            scrollRemainingPx: safe.scrollRemainingPx,
                            lastArticleGapPx: safe.lastArticleGapPx,
                            nearLoadingIndicators: safe.nearLoadingIndicators,
                            nearestLoadingTopPx: safe.nearestLoadingTopPx,
                            connections: bfFeedTelemetryV1.network.matchedConnections
                        });
                        while (bfFeedTelemetryV1.domHistory.length > 36) bfFeedTelemetryV1.domHistory.shift();
                        bfMaybeRearmSparseInitialFeed(safe);
                        if (Array.isArray(snapshot.recentTransitions)) {
                            bfFeedTelemetryV1.recentDecisions = snapshot.recentTransitions.slice(-24).map(item => ({
                                time: Number(item?.time) || 0,
                                decision: ['reject', 'approve', 'provisional'].includes(item?.decision) ? item.decision : 'other',
                                reason: ['network', 'cached', 'badge-or-follow', 'visible-text', 'full-scan'].includes(item?.reason) ? item.reason : 'other'
                            }));
                        }
                    }
                } catch {}
            });

            function requestMainWorldConfig() {
                try { window.postMessage({ __metamanglerType: CONFIG_REQUEST_TYPE }, location.origin); } catch {}
            }

            function startConfigHandshake() {
                try {
                    const delays = [0, 50, 150, 350, 750, 1500, 3000, 6000];
                    for (const delay of delays) setTimeout(requestMainWorldConfig, delay);
                } catch {}
            }

            function friendshipFollowing(user) {
                try {
                    if (!user || typeof user !== 'object') return null;
                    if (typeof user.friendship_status?.following === 'boolean') return user.friendship_status.following;
                    if (typeof user.followed_by_viewer === 'boolean') return user.followed_by_viewer;
                } catch {}
                return null;
            }

            function rememberExplicitFollow(user) {
                try {
                    if (!user || typeof user !== 'object') return;
                    if (friendshipFollowing(user) !== true) return;
                    const username = normalizeUsername(user.username);
                    if (username) learnedFollowingUsernames.add(username);
                } catch {}
            }

            function userObjectsForMedia(media) {
                const users = [];
                try {
                    if (!media || typeof media !== 'object') return users;
                    if (media.user && typeof media.user === 'object') users.push(media.user);
                    if (media.owner && typeof media.owner === 'object') users.push(media.owner);
                    const arrayKeys = ['coauthor_producers', 'invited_coauthor_producers', 'all_previous_submitters'];
                    for (const key of arrayKeys) {
                        const value = media[key];
                        if (!Array.isArray(value)) continue;
                        for (const user of value) if (user && typeof user === 'object') users.push(user);
                    }
                    if (media.previous_submitter && typeof media.previous_submitter === 'object') users.push(media.previous_submitter);
                    const tags = media.usertags?.in;
                    if (Array.isArray(tags)) {
                        for (const tag of tags) {
                            const user = tag?.user;
                            if (user && typeof user === 'object') users.push(user);
                        }
                    }
                } catch {}
                return users;
            }

            function learnFollowingFromMedia(media) {
                try {
                    if (!media || typeof media !== 'object') return;
                    for (const user of userObjectsForMedia(media)) rememberExplicitFollow(user);
                    if (Array.isArray(media.carousel_media)) {
                        for (const child of media.carousel_media) if (child && typeof child === 'object') learnFollowingFromMedia(child);
                    }
                } catch {}
            }

            function mediaHasFollowConnection(media) {
                try {
                    if (!media || typeof media !== 'object') return false;
                    for (const user of userObjectsForMedia(media)) {
                        if (friendshipFollowing(user) === true) return true;
                        const username = normalizeUsername(user.username);
                        if (username && learnedFollowingUsernames.has(username)) return true;
                    }
                    if (Array.isArray(media.carousel_media)) {
                        for (const child of media.carousel_media) {
                            if (child && mediaHasFollowConnection(child)) return true;
                        }
                    }
                } catch {}
                return false;
            }

            function mediaOwnerFollowingState(media) {
                try {
                    if (!media || typeof media !== 'object') return null;
                    if (media.user && typeof media.user === 'object') {
                        const state = friendshipFollowing(media.user);
                        if (state !== null) return state;
                    }
                    if (typeof media.friendship_status?.following === 'boolean') return media.friendship_status.following;
                    if (typeof media.owner?.followed_by_viewer === 'boolean') return media.owner.followed_by_viewer;
                } catch {}
                return null;
            }

            function mediaHasAiLabel(media) {
                try {
                    if (!media || typeof media !== 'object') return false;
                    const info = media.ai_label_info;
                    if (info && typeof info === 'object') {
                        if (info.has_ai_label === true || info.is_ai_generated === true || info.ai_generated === true || info.is_generated_by_ai === true) return true;
                        const text = [
                            info.label,
                            info.text,
                            info.title,
                            info.description,
                            info.attribution_label_text,
                            info.subtitle_text,
                            info.attribution_label,
                            info.subtitle
                        ].filter(Boolean).join(' ');
                        if (/(tekoälysisältö|luotu todennäköisesti tekoälyllä|tekoäly|artificial intelligence|ai info|made with ai|ai[ -]?(generated|created|edited|content|label))/i.test(text)) return true;
                        const detectionMethod = String(info.gen_ai_detection_method || info.detection_method || '').trim();
                        if (/^(?:AI_CREATED|AI_GENERATED|GENERATIVE_AI|CLASSIFIER_SCORE_(?:HIGH|MEDIUM))$/i.test(detectionMethod)) return true;
                    }
                    if (media.is_ai_generated === true || media.ai_generated === true || media.is_generated_by_ai === true) return true;
                    if (media.user?.is_ai_user === true) return true;
                    if (media.user?.aigm_account_label_info && typeof media.user.aigm_account_label_info === 'object') {
                        const accountAiText = Object.values(media.user.aigm_account_label_info).filter(value => typeof value === 'string').join(' ');
                        if (/(tekoäly|artificial intelligence|ai info|ai[ -]?(generated|created|content|agent))/i.test(accountAiText)) return true;
                    }
                    if (Array.isArray(media.carousel_media)) {
                        for (const child of media.carousel_media) if (child && mediaHasAiLabel(child)) return true;
                    }
                } catch {}
                return false;
            }

            function inspectUserForBannedAccount(user) {
                try {
                    if (!accountConfigReady || !user || typeof user !== 'object') return false;
                    const username = normalizeUsername(user.username);
                    return !!username && configuredBannedAccounts.has(username);
                } catch { return false; }
            }

            function mediaHasBannedAccount(media) {
                try {
                    if (!media || typeof media !== 'object') return false;
                    for (const user of userObjectsForMedia(media)) {
                        if (inspectUserForBannedAccount(user)) return true;
                    }
                    if (Array.isArray(media.carousel_media)) {
                        for (const child of media.carousel_media) if (child && mediaHasBannedAccount(child)) return true;
                    }
                } catch {}
                return false;
            }

            function inspectMediaText(media) {
                try {
                    if (!media || typeof media !== 'object') return false;
                    const values = [];
                    const caption = media.caption;
                    if (caption && typeof caption === 'object') values.push(caption.text);
                    values.push(
                        media.accessibility_caption,
                        media.alt_text,
                        media.link_text,
                        media.headline,
                        media.title,
                        media.description
                    );
                    if (media.user && typeof media.user === 'object') {
                        values.push(media.user.username, media.user.full_name, media.user.name);
                    }
                    for (const user of userObjectsForMedia(media)) {
                        values.push(user.username, user.full_name, user.name);
                    }
                    if (media.location && typeof media.location === 'object') values.push(media.location.name);
                    if (media.explore && typeof media.explore === 'object') values.push(media.explore.title, media.explore.subtitle);
                    for (const value of values) if (configuredKeywordMatches(value)) return true;
                    if (Array.isArray(media.carousel_media)) {
                        for (const child of media.carousel_media) if (child && inspectMediaText(child)) return true;
                    }
                } catch {}
                return false;
            }

            function inspectMediaForBannedContent(media) {
                try {
                    if (!media || typeof media !== 'object') return false;
                    if (mediaHasAiLabel(media)) return true;
                    if (mediaHasBannedAccount(media)) return true;
                    if (inspectMediaText(media)) return true;
                } catch {}
                return false;
            }

            function mediaCode(media) {
                try { return String(media?.code || media?.shortcode || '').trim(); } catch { return ''; }
            }

            function mediaUsername(media) {
                try { return normalizeUsername(media?.user?.username); } catch { return ''; }
            }

            function mediaProjectionComplete(media) {
                try {
                    if (!media || typeof media !== 'object') return false;
                    const required = [
                        'caption', 'ai_label_info', 'accessibility_caption', 'carousel_media',
                        'user', 'usertags', 'coauthor_producers', 'invited_coauthor_producers',
                        'all_previous_submitters', 'is_paid_partnership', 'sponsor_tags'
                    ];
                    for (const key of required) if (!OWN.call(media, key)) return false;
                    if (!media.user || typeof media.user !== 'object' ||
                        !OWN.call(media.user, 'is_ai_user') || !OWN.call(media.user, 'aigm_account_label_info')) return false;
                    if (Array.isArray(media.carousel_media)) {
                        for (const child of media.carousel_media) {
                            if (!child || typeof child !== 'object') continue;
                            const childRequired = ['caption', 'accessibility_caption', 'carousel_media', 'user', 'usertags'];
                            for (const key of childRequired) if (!OWN.call(child, key)) return false;
                        }
                    }
                    return true;
                } catch { return false; }
            }

            function addClassification(classifications, media, decision, reasons) {
                try {
                    const code = mediaCode(media);
                    if (!code) return;
                    const nextReasons = Array.isArray(reasons) ? reasons.map(value => String(value || '').trim()).filter(Boolean) : [];
                    const current = classifications.get(code);
                    if (current && current.decision === 'reject') {
                        for (const reason of nextReasons) if (!current.reasons.includes(reason)) current.reasons.push(reason);
                        return;
                    }
                    if (decision === 'reject' || !current) {
                        classifications.set(code, {
                            id: code,
                            decision,
                            reasons: nextReasons.slice(0, 12),
                            username: mediaUsername(media),
                            following: mediaOwnerFollowingState(media),
                            connected: mediaHasFollowConnection(media)
                        });
                    }
                } catch {}
            }

            function isRecommendationMedia(node, media, fromExploreStory) {
                try {
                    if (fromExploreStory) return true;
                    if (node?.is_suggested === true || node?.suggested === true) return true;
                    if (node?.social_context?.social_context_type === 'suggested') return true;
                    const nodeInventory = String(node?.inventory_source || node?.inventorySource || '').trim().toLowerCase();
                    const mediaInventory = String(media?.inventory_source || media?.inventorySource || '').trim().toLowerCase();
                    const recommendationInventories = new Set([
                        'explore_story',
                        'mixed_unconnected',
                        'suggested',
                        'suggested_post',
                        'suggested_posts',
                        'recommended',
                        'recommendation'
                    ]);
                    if (recommendationInventories.has(nodeInventory) || recommendationInventories.has(mediaInventory)) return true;
                    const title = String(media?.explore?.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
                    return title === 'sinulle ehdotettua' || title === 'sinulle ehdotettu' ||
                        title === 'ehdotettu sinulle' || title === 'suositeltu sinulle' || title === 'sinulle suositeltua' ||
                        title === 'suggested for you' || title === 'suggested post' || title === 'suggested posts' ||
                        title === 'recommended for you' || title === 'recommended post' || title === 'recommended posts';
                } catch { return false; }
            }

            function decideMedia(node, media, options = null) {
                try {
                    if (!media || typeof media !== 'object') return { keep: true, reasons: ['unknown-media'] };
                    // Exact author-only whitelist. A friend sharing a different
                    // account's media does not whitelist that account globally.
                    if (configuredTrustedAuthorsV326.has(normalizeUsername(media?.user?.username || media?.owner?.username)))
                        return { keep: true, reasons: ['trusted-author'] };
                    const reasons = [];
                    if (mediaHasAiLabel(media)) reasons.push('ai-content');
                    if (mediaHasBannedAccount(media)) reasons.push('banned-account');
                    if (inspectMediaText(media)) reasons.push('banned-content');
                    if (media.is_paid_partnership === true || (Array.isArray(media.sponsor_tags) && media.sponsor_tags.length > 0)) reasons.push('sponsored-content');
                    if (options?.ad === true || media.is_ad === true || media.is_sponsored === true || media.sponsored === true) reasons.push('ad');
                    if (reasons.length) return { keep: false, reasons };

                    const connected = mediaHasFollowConnection(media);
                    const ownerFollowing = mediaOwnerFollowingState(media);
                    const recommendation = isRecommendationMedia(node, media, options?.exploreStory === true);

                    if (recommendation) return { keep: false, reasons: ['recommendation'] };
                    if (ownerFollowing === false && !connected) return { keep: false, reasons: ['unfollowed'] };

                    const keepReasons = [];
                    if (connected && ownerFollowing !== true) keepReasons.push('follow-connected');
                    else if (ownerFollowing === true) keepReasons.push('followed');
                    else keepReasons.push('unknown-relationship');
                    return { keep: true, reasons: keepReasons };
                } catch { return { keep: true, reasons: ['decision-error'] }; }
            }

            function mediaFromAd(ad) {
                try {
                    if (!ad || typeof ad !== 'object') return null;
                    if (ad.media && typeof ad.media === 'object') return ad.media;
                    if (Array.isArray(ad.items)) {
                        for (const item of ad.items) {
                            if (item && typeof item === 'object') return item.media && typeof item.media === 'object' ? item.media : item;
                        }
                    }
                } catch {}
                return null;
            }

            function edgePrimaryMedia(edge) {
                try {
                    const node = edge?.node;
                    if (!node || typeof node !== 'object') return null;
                    if (node.media && typeof node.media === 'object') return { media: node.media, kind: 'media' };
                    if (node.explore_story?.media && typeof node.explore_story.media === 'object') return { media: node.explore_story.media, kind: 'explore_story' };
                    if (node.suggested_users?.media && typeof node.suggested_users.media === 'object') return { media: node.suggested_users.media, kind: 'suggested_users' };
                    const adMedia = mediaFromAd(node.ad) || mediaFromAd(node.ad4ad_in_webfeed);
                    if (adMedia) return { media: adMedia, kind: 'ad' };
                } catch {}
                return null;
            }

            function prelearnFollowingFromEdges(edges) {
                try {
                    if (!Array.isArray(edges)) return;
                    for (const edge of edges) {
                        const primary = edgePrimaryMedia(edge);
                        if (primary?.media) learnFollowingFromMedia(primary.media);
                    }
                } catch {}
            }

            function recordFeedPageStats(originalCount, deliveredCount, connection, reasonCounts) {
                try {
                    const item = {
                        time: Date.now(),
                        received: Number(originalCount) || 0,
                        delivered: Number(deliveredCount) || 0,
                        removed: Math.max(0, (Number(originalCount) || 0) - (Number(deliveredCount) || 0)),
                        hasNextPage: connection?.page_info?.has_next_page ?? null,
                        hasEndCursor: !!connection?.page_info?.end_cursor,
                        reasons: reasonCounts && typeof reasonCounts === 'object' ? { ...reasonCounts } : {}
                    };
                    feedPageStats.push(item);
                    while (feedPageStats.length > 40) feedPageStats.shift();
                    bfFeedTelemetryV1.network.matchedConnections++;
                    bfFeedTelemetryV1.network.originalEdges += item.received;
                    bfFeedTelemetryV1.network.deliveredEdges += item.delivered;
                    bfFeedTelemetryV1.network.lastConnectionAt = item.time;
                    bfStartEmptyContinuationRearm(item);

                    // If a sanitized page contributes almost no usable geometry, ask
                    // Instagram for a larger *next* native page. The server still owns
                    // the cursor and page_info; this only changes Relay's `first` input.
                    if (item.hasNextPage === true && item.received >= 4 && item.delivered <= 2) {
                        paginationFirstTarget = PAGINATION_FIRST_SPARSE;
                    } else if (item.delivered >= 6) {
                        paginationFirstTarget = PAGINATION_FIRST_MIN;
                    }
                } catch {}
            }

            function sanitizeConnection(connection, classifications) {
                try {
                    if (!connection || typeof connection !== 'object' || !Array.isArray(connection.edges)) return false;
                    const originalEdges = connection.edges;
                    prelearnFollowingFromEdges(originalEdges);
                    const filtered = [];
                    const reasonCounts = Object.create(null);
                    let changed = false;

                    for (const edge of originalEdges) {
                        const node = edge?.node;
                        if (!node || typeof node !== 'object') { filtered.push(edge); continue; }

                        let keep = true;
                        let media = null;
                        let decision = null;

                        if (node.ad != null || node.ad4ad_in_webfeed != null) {
                            media = mediaFromAd(node.ad) || mediaFromAd(node.ad4ad_in_webfeed);
                            keep = false;
                            decision = { keep: false, reasons: ['ad'] };
                        } else if (node.suggested_users != null) {
                            media = node.suggested_users?.media || null;
                            keep = false;
                            decision = { keep: false, reasons: ['suggested-users'] };
                        } else if (node.explore_story && typeof node.explore_story === 'object') {
                            media = node.explore_story.media;
                            if (!media || typeof media !== 'object') {
                                keep = false;
                                decision = { keep: false, reasons: ['recommendation-unit'] };
                            } else {
                                decision = decideMedia(node, media, { exploreStory: true });
                                keep = decision.keep;
                            }
                        } else if (node.media && typeof node.media === 'object') {
                            media = node.media;
                            decision = decideMedia(node, media, null);
                            keep = decision.keep;
                        }

                        if (media && typeof media.caption?.text === 'string' && media.caption.text.trim()) {
                            bfFeedTelemetryV1.network.completeCaptionsSeen++;
                            if (!keep && decision?.reasons?.includes('banned-content'))
                                bfFeedTelemetryV1.network.completeCaptionsBlocked++;
                        }
                        if (!keep) {
                            changed = true;
                            const reasons = decision?.reasons || ['filtered'];
                            for (const reason of reasons) {
                                const key = String(reason || 'filtered');
                                reasonCounts[key] = (reasonCounts[key] || 0) + 1;
                            }
                            if (media) addClassification(classifications, media, 'reject', reasons);
                            continue;
                        }

                        filtered.push(edge);
                        if (media && allConfigsReady() && !inspectMediaForBannedContent(media)) {
                            const ownerFollowing = mediaOwnerFollowingState(media);
                            const connected = mediaHasFollowConnection(media);
                            // A verified complete caption is not the same as an ALLOW for the
                            // entire post. Publish just this evidence when the response has
                            // actual caption.text; the DOM coordinator still checks visible
                            // text, labels, account links and other article metadata.
                            if (mediaProjectionComplete(media) && (ownerFollowing === true || connected)) {
                                addClassification(classifications, media, 'allow', decision?.reasons || ['network-safe']);
                            }
                            if (typeof media.caption?.text === 'string' && media.caption.text.trim()) {
                                bfFeedTelemetryV1.network.verifiedCaptionEvidence++;
                                const code = mediaCode(media);
                                const current = code && classifications.get(code);
                                if (current && current.decision === 'allow') {
                                    current.captionVerified = true;
                                } else if (code && !current) {
                                    classifications.set(code, {
                                        id: code,
                                        decision: 'caption-verified',
                                        reasons: ['network-full-caption-checked']
                                    });
                                }
                            }
                        }
                    }

                    if (changed) connection.edges = filtered;
                    recordFeedPageStats(originalEdges.length, filtered.length, connection, reasonCounts);
                    return changed;
                } catch { return false; }
            }

            function sanitizeInjectedAds(object) {
                try {
                    const injected = object?.xdt_injected_story_units;
                    if (!injected || typeof injected !== 'object') return false;
                    let changed = false;
                    if (Array.isArray(injected.ad_media_items) && injected.ad_media_items.length) {
                        injected.ad_media_items = [];
                        changed = true;
                    }
                    return changed;
                } catch { return false; }
            }

            function sanitizePayloadObject(payload) {
                const classifications = new Map();
                let changed = false;
                try {
                    if (!payload || typeof payload !== 'object') return { payload, changed: false, items: [] };
                    const seen = new WeakSet();
                    let budget = 320;

                    function walk(value, depth) {
                        if (!value || typeof value !== 'object' || depth > 11 || budget <= 0) return;
                        if (seen.has(value)) return;
                        seen.add(value);
                        budget--;

                        if (sanitizeInjectedAds(value)) changed = true;
                        const direct = value[FEED_ROOT_FIELD];
                        if (direct && typeof direct === 'object' && Array.isArray(direct.edges)) {
                            if (sanitizeConnection(direct, classifications)) changed = true;
                        }

                        const keys = ['data', 'result', '__bbox', 'payload', 'body', 'response'];
                        for (const key of keys) {
                            const child = value[key];
                            if (child && typeof child === 'object') walk(child, depth + 1);
                        }
                        const required = value.require;
                        if (Array.isArray(required)) {
                            for (const entry of required) {
                                if (Array.isArray(entry)) {
                                    for (const child of entry) if (child && typeof child === 'object') walk(child, depth + 1);
                                } else if (entry && typeof entry === 'object') walk(entry, depth + 1);
                            }
                        }
                    }

                    walk(payload, 0);
                } catch {}
                const items = Array.from(classifications.values());
                if (items.length) publishFeedClassifications(items);
                return { payload, changed, items };
            }

            function publishFeedClassifications(items) {
                try {
                    if (!Array.isArray(items) || !items.length) return;
                    if (!isolatedWorldReady) {
                        pendingClassificationBatches.push(items);
                        while (pendingClassificationBatches.length > 32) pendingClassificationBatches.shift();
                        return;
                    }
                    window.postMessage({
                        __metamanglerType: CLASSIFICATION_TYPE,
                        sequence: ++classificationSequence,
                        items
                    }, location.origin);
                } catch {}
            }

            function rawTextLooksLikeFeed(rawText) {
                if (typeof rawText !== 'string' || !rawText) return false;
                return rawText.includes(FEED_ROOT_FIELD) || rawText.includes(FEED_FRIENDLY_NAME);
            }

            function sanitizeJsonText(rawText) {
                try {
                    if (!rawTextLooksLikeFeed(rawText)) return { changed: false, text: rawText, payload: null };
                    let raw = String(rawText || '');
                    let prefix = '';
                    let text = raw.trim();
                    if (!text) return { changed: false, text: rawText, payload: null };
                    if (text.startsWith('for (;;);')) {
                        const prefixIndex = raw.indexOf('for (;;);');
                        const after = prefixIndex >= 0 ? raw.slice(prefixIndex + 9) : text.slice(9);
                        prefix = raw.slice(0, prefixIndex >= 0 ? prefixIndex + 9 : 9);
                        text = after.trimStart();
                    }
                    const payload = JSON.parse(text);
                    const result = sanitizePayloadObject(payload);
                    if (!result.changed) return { changed: false, text: rawText, payload };
                    return { changed: true, text: prefix + JSON.stringify(payload), payload };
                } catch {
                    bfFeedTelemetryV1.network.parseFailures++;
                    return { changed: false, text: rawText, payload: null };
                }
            }

            function tuneHomePaginationBody(body) {
                try {
                    if (typeof body !== 'string' && !(body instanceof URLSearchParams)) return body;
                    const params = body instanceof URLSearchParams ? new URLSearchParams(body) : new URLSearchParams(String(body || ''));
                    if (params.get('doc_id') !== FEED_DOC_ID && params.get('fb_api_req_friendly_name') !== FEED_FRIENDLY_NAME) return body;
                    const rawVariables = params.get('variables');
                    if (!rawVariables) return body;
                    const variables = JSON.parse(rawVariables);
                    if (!variables || typeof variables !== 'object' || variables.variant !== 'home') return body;

                    // Only widen true pagination requests. Initial Home loading remains
                    // completely native; the server still creates the cursor/page_info.
                    if (!variables.after || !Number.isFinite(Number(variables.first))) return body;
                    const first = Number(variables.first);
                    const target = Math.max(PAGINATION_FIRST_MIN, paginationFirstTarget);
                    if (first >= target) return body;
                    variables.first = target;
                    params.set('variables', JSON.stringify(variables));
                    return body instanceof URLSearchParams ? params : params.toString();
                } catch { return body; }
            }

            function bodyLooksLikeFeed(body) {
                try {
                    if (typeof body === 'string') return body.includes(FEED_DOC_ID) || body.includes(FEED_FRIENDLY_NAME);
                    if (body instanceof URLSearchParams) return body.get('doc_id') === FEED_DOC_ID || body.get('fb_api_req_friendly_name') === FEED_FRIENDLY_NAME;
                } catch {}
                return false;
            }

            function isFeedRequestUrl(url) {
                try {
                    if (typeof url !== 'string') return false;
                    const value = url.trim();
                    if (!value || !FEED_URL_RE.test(value)) return false;
                    return /instagram\.com/i.test(value) || /^\/\//.test(value) || /^\/graphql\/query(?:[/?]|$)/i.test(value) || /^(?:https?:)?\/\/www\.instagram\.com\/graphql\/query(?:[/?]|$)/i.test(value);
                } catch { return false; }
            }

            function patchXHR() {
                try {
                    const XHR = window.XMLHttpRequest;
                    const proto = XHR?.prototype;
                    if (!proto || proto.__bfInstagramSanitizerPatched) return;
                    const nativeOpen = proto.open;
                    const nativeSend = proto.send;
                    const nativeSetRequestHeader = proto.setRequestHeader;
                    const responseTextDescriptor = Object.getOwnPropertyDescriptor(proto, 'responseText');
                    const responseDescriptor = Object.getOwnPropertyDescriptor(proto, 'response');

                    function nativeResponseText(xhr) {
                        try { return responseTextDescriptor?.get ? responseTextDescriptor.get.call(xhr) : ''; } catch { return ''; }
                    }
                    function nativeResponse(xhr) {
                        try { return responseDescriptor?.get ? responseDescriptor.get.call(xhr) : null; } catch { return null; }
                    }

                    function processFeedResponseIfReady(xhr, state) {
                        try {
                            if (!state || !state.isFeed || state.processed || xhr.readyState !== 4) return;
                            state.processed = true;
                            bfFeedTelemetryV1.network.completedXHR++;
                            bfFeedTelemetryV1.network.lastFeedResponseAt = Date.now();
                            const connectionCountBefore = bfFeedTelemetryV1.network.matchedConnections;
                            if (xhr.responseType === 'json') {
                                const payload = nativeResponse(xhr);
                                if (payload && typeof payload === 'object') {
                                    sanitizePayloadObject(payload);
                                    state.sanitizedJson = payload;
                                }
                                if (connectionCountBefore === bfFeedTelemetryV1.network.matchedConnections) {
                                    bfFeedTelemetryV1.network.payloadsWithoutConnection++;
                                }
                                return;
                            }
                            if (xhr.responseType === '' || xhr.responseType === 'text') {
                                const raw = nativeResponseText(xhr);
                                const result = sanitizeJsonText(raw);
                                if (result.changed) state.sanitizedText = result.text;
                            }
                            if (connectionCountBefore === bfFeedTelemetryV1.network.matchedConnections) {
                                bfFeedTelemetryV1.network.payloadsWithoutConnection++;
                            }
                        } catch {}
                    }

                    function installLazyFeedResponseView(xhr, state) {
                        try {
                            if (!xhr || !state || state.responseViewInstalled) return false;
                            Object.defineProperty(xhr, 'responseText', {
                                configurable: true,
                                enumerable: false,
                                get() {
                                    const current = this.__bfFeedRequestStateV6H;
                                    if (current?.isFeed && this.readyState === 4) processFeedResponseIfReady(this, current);
                                    if (current?.isFeed && typeof current.sanitizedText === 'string') return current.sanitizedText;
                                    return nativeResponseText(this);
                                }
                            });
                            Object.defineProperty(xhr, 'response', {
                                configurable: true,
                                enumerable: false,
                                get() {
                                    const current = this.__bfFeedRequestStateV6H;
                                    if (current?.isFeed && this.readyState === 4) processFeedResponseIfReady(this, current);
                                    if (current?.isFeed && (this.responseType === '' || this.responseType === 'text') &&
                                        typeof current.sanitizedText === 'string') return current.sanitizedText;
                                    if (current?.isFeed && this.responseType === 'json' && current.sanitizedJson && typeof current.sanitizedJson === 'object') {
                                        return current.sanitizedJson;
                                    }
                                    return nativeResponse(this);
                                }
                            });
                            state.responseViewInstalled = true;
                            return true;
                        } catch { return false; }
                    }

                    function ensureSanitizerListener(xhr) {
                        try {
                            if (!xhr || xhr.__bfFeedSanitizerListenerInstalled) return;
                            xhr.__bfFeedSanitizerListenerInstalled = true;
                            xhr.addEventListener('readystatechange', function() {
                                try {
                                    const state = this.__bfFeedRequestStateV6H;
                                    if (!state || this.readyState !== 4) return;
                                    bfCompleteGraphqlV2(state.diagRecord, this.status);
                                    bfCompleteOtherHomeRequestV3(state.otherDiagRecord, this.status);
                                    if (state.isFeed) processFeedResponseIfReady(this, state);
                                } catch {}
                            });
                        } catch {}
                    }

                    proto.open = function(method, url) {
                        let result;
                        try {
                            const priorSerial = Number(this.__bfFeedRequestStateV6H?.serial || 0);
                            this.__bfFeedDiagMethodV2 = typeof method === 'string' ? method : '';
                            this.__bfFeedRequestStateV6H = {
                                serial: priorSerial + 1,
                                url: String(url || ''),
                                friendlyName: '',
                                rootField: '',
                                isFeed: false,
                                processed: false,
                                sanitizedText: null,
                                sanitizedJson: null,
                                responseViewInstalled: false,
                                diagRecord: null,
                                otherDiagRecord: null
                            };
                            try { delete this.responseText; } catch {}
                            try { delete this.response; } catch {}
                        } catch {}
                        result = nativeOpen.apply(this, arguments);
                        try { ensureSanitizerListener(this); } catch {}
                        return result;
                    };

                    proto.setRequestHeader = function(name, value) {
                        try {
                            const state = this.__bfFeedRequestStateV6H;
                            if (state) {
                                const lower = String(name || '').toLowerCase();
                                if (lower === 'x-fb-friendly-name') state.friendlyName = String(value || '');
                                if (lower === 'x-root-field-name') state.rootField = String(value || '');
                            }
                        } catch {}
                        return nativeSetRequestHeader.apply(this, arguments);
                    };

                    proto.send = function(body) {
                        let sendBody = body;
                        try {
                            const state = this.__bfFeedRequestStateV6H;
                            if (state) {
                                const urlMatch = isFeedRequestUrl(state.url || '');
                                const friendly = state.friendlyName === FEED_FRIENDLY_NAME;
                                const root = state.rootField === FEED_ROOT_FIELD;
                                state.isFeed = !!(urlMatch && (friendly || root || bodyLooksLikeFeed(body)));
                                state.diagRecord = bfRegisterGraphqlV2('xhr', this.__bfFeedDiagMethodV2 || 'POST', state.url, body, state.friendlyName);
                                state.otherDiagRecord = bfRegisterOtherHomeRequestV3('xhr', this.__bfFeedDiagMethodV2 || 'POST', state.url);
                                if (state.isFeed) {
                                    bfFeedTelemetryV1.network.recognizedXHR++;
                                    bfFeedTelemetryV1.network.lastFeedRequestAt = Date.now();
                                    try { activeRearmFollowupCheck?.(); } catch {}
                                } else if (urlMatch && (location.pathname === '/' || location.pathname === '')) {
                                    bfFeedTelemetryV1.network.otherHomeGraphqlXHR++;
                                }
                                state.processed = false;
                                state.sanitizedText = null;
                                state.sanitizedJson = null;
                                if (state.isFeed) {
                                    sendBody = tuneHomePaginationBody(body);
                                    installLazyFeedResponseView(this, state);

                                    // Give the isolated-world policy bridge a very short chance
                                    // to deliver keyword/account/allow-list config before the feed
                                    // request leaves. This targets first-load DOM fallback holes
                                    // without adding latency once config is already ready.
                                    if (!allConfigsReady()) {
                                        const xhr = this;
                                        const args = [sendBody];
                                        const started = Date.now();
                                        const serial = state.serial;
                                        const flush = () => {
                                            let shouldSend = false;
                                            try {
                                                const current = xhr.__bfFeedRequestStateV6H;
                                                if (!current || current.serial !== serial || xhr.readyState !== 1) return;
                                                if (allConfigsReady() || Date.now() - started >= CONFIG_SEND_GRACE_MS) {
                                                    shouldSend = true;
                                                } else {
                                                    setTimeout(flush, 8);
                                                }
                                            } catch {
                                                shouldSend = true;
                                            }
                                            if (shouldSend) {
                                                try { nativeSend.apply(xhr, args); } catch {}
                                            }
                                        };
                                        setTimeout(flush, 0);
                                        return;
                                    }
                                }
                            }
                        } catch {}
                        return nativeSend.call(this, sendBody);
                    };

                    try { Object.defineProperty(proto, '__bfInstagramSanitizerPatched', { value: true, configurable: true }); } catch { proto.__bfInstagramSanitizerPatched = true; }
                } catch {}
            }

            function patchFetchClassifierFallback() {
                try {
                    if (typeof window.fetch !== 'function' || window.fetch.__bfInstagramSanitizerPatched) return;
                    const nativeFetch = window.fetch.bind(window);
                    const wrappedFetch = function(input, init) {
                        const promise = nativeFetch(input, init);
                        try {
                            let url = '';
                            let headers = null;
                            let body = init && init.body;
                            if (input instanceof Request) {
                                url = input.url || '';
                                try { headers = input.headers; } catch {}
                            } else {
                                url = String(input || '');
                                try { headers = new Headers((init && init.headers) || {}); } catch {}
                            }
                            const friendlyHeader = headers?.get?.('x-fb-friendly-name') || '';
                            const diagRecord = bfRegisterGraphqlV2('fetch', init?.method || input?.method || 'GET', url, body, friendlyHeader);
                            const otherDiagRecord = bfRegisterOtherHomeRequestV3('fetch', init?.method || input?.method || 'GET', url);
                            if (otherDiagRecord) {
                                promise.then(response => bfCompleteOtherHomeRequestV3(otherDiagRecord, response?.status))
                                    .catch(() => bfCompleteOtherHomeRequestV3(otherDiagRecord, 0));
                            }
                            if (diagRecord) {
                                promise.then(response => bfCompleteGraphqlV2(diagRecord, response?.status))
                                    .catch(() => bfCompleteGraphqlV2(diagRecord, 0));
                                if (!((friendlyHeader === FEED_FRIENDLY_NAME) ||
                                    headers?.get?.('x-root-field-name') === FEED_ROOT_FIELD || bodyLooksLikeFeed(body))) {
                                    bfFeedTelemetryV1.network.otherHomeGraphqlFetch++;
                                }
                            }
                            const friendly = friendlyHeader === FEED_FRIENDLY_NAME;
                            const root = headers?.get?.('x-root-field-name') === FEED_ROOT_FIELD;
                            const direct = bodyLooksLikeFeed(body);
                            if (isFeedRequestUrl(url) && (friendly || root || direct)) {
                                bfFeedTelemetryV1.network.recognizedFetch++;
                                bfFeedTelemetryV1.network.lastFeedRequestAt = Date.now();
                                try { activeRearmFollowupCheck?.(); } catch {}
                                // Captured Home traffic uses XHR. Fetch stays read-only rather than
                                // reconstructing Response objects; it still publishes classifications
                                // if Instagram switches transports so the DOM verifier remains safe.
                                promise.then(response => {
                                    try {
                                        if (!response?.ok) return;
                                        response.clone().text().then(raw => {
                                            try {
                                                if (!rawTextLooksLikeFeed(raw)) return;
                                                let text = String(raw || '').trim();
                                                if (text.startsWith('for (;;);')) text = text.slice(9).trim();
                                                const payload = JSON.parse(text);
                                                sanitizePayloadObject(payload);
                                            } catch {}
                                        }).catch(() => {});
                                    } catch {}
                                }).catch(() => {});
                            }
                        } catch {}
                        return promise;
                    };
                    try { Object.defineProperty(wrappedFetch, '__bfInstagramSanitizerPatched', { value: true }); } catch { wrappedFetch.__bfInstagramSanitizerPatched = true; }
                    window.fetch = wrappedFetch;
                } catch {}
            }

            patchXHR();
            patchFetchClassifierFallback();
            startConfigHandshake();
        } catch {}
    }

    __bfInstallHomeFeedNetworkSanitizer();

    // ===== V325: read-only exact-shortcode captions for NON-HOME galleries =====
    // The Home feed sanitizer above is deliberately untouched. Instagram's
    // media thumbnails often carry a shorter alt than the real caption; only
    // pair a network caption with a verified media code/shortcode from the SAME
    // JSON object. This never creates requests or rewrites responses.
    function __bfInstallRelatedCaptionObserverV325() {
        try {
            if (location.hostname !== 'www.instagram.com' || window.__bfIGRelatedCaptionsV325) return;
            window.__bfIGRelatedCaptionsV325 = true;
            const MSG = 'ig-related-full-caption-v325';
            const seen = new Map();
            const isNonHome = () => location.pathname !== '/' && !!location.pathname;
            const isEligible = raw => {
                try {
                    const url = new URL(String(raw || ''), location.origin);
                    return url.hostname === 'www.instagram.com' &&
                        (/^\/(?:api\/)?graphql(?:\/|$)/i.test(url.pathname) ||
                        /^\/api\/v1\/(?:feed|media)\//i.test(url.pathname));
                } catch { return false; }
            };
            function collect(payload, batch) {
                const queue = [[payload, 0]];
                const visited = new WeakSet();
                let inspected = 0;
                while (queue.length && inspected++ < 30000 && batch.length < 48) {
                    const [obj, depth] = queue.pop();
                    if (!obj || typeof obj !== 'object' || visited.has(obj) || depth > 23) continue;
                    visited.add(obj);
                    if (!Array.isArray(obj)) {
                        const id = String(obj.code || obj.shortcode || '').trim();
                        let caption = typeof obj.caption?.text === 'string' ? obj.caption.text : '';
                        if (!caption && typeof obj.caption === 'string') caption = obj.caption;
                        if (!caption && obj.edge_media_to_caption?.edges?.[0]?.node &&
                            typeof obj.edge_media_to_caption.edges[0].node.text === 'string') {
                            caption = obj.edge_media_to_caption.edges[0].node.text;
                        }
                        const username = String(obj.user?.username || obj.owner?.username || '').toLowerCase();
                        if (/^[A-Za-z0-9_-]{5,40}$/.test(id) && caption.trim() && caption.length <= 12000 &&
                            (!username || /^[a-z0-9._]{1,30}$/.test(username))) {
                            const key = caption + '\u0000' + username;
                            if (seen.get(id) !== key) {
                                seen.set(id, key);
                                while (seen.size > 480) seen.delete(seen.keys().next().value);
                                batch.push({ id, caption, username });
                            }
                        }
                    }
                    for (const child of Object.values(obj)) {
                        if (child && typeof child === 'object') queue.push([child, depth + 1]);
                    }
                }
            }
            function processRaw(raw) {
                try {
                    if (!isNonHome() || typeof raw !== 'string' || raw.length < 20 || raw.length > 3500000) return;
                    let stripped = raw.trim();
                    if (stripped.startsWith('for (;;);')) stripped = stripped.slice(9).trim();
                    const batch = [];
                    const parse = line => {
                        try { collect(JSON.parse(line), batch); } catch {}
                    };
                    if (stripped.startsWith('{') || stripped.startsWith('[')) parse(stripped);
                    if (!batch.length && stripped.includes('\n')) {
                        for (const line of stripped.split(/\r?\n/).slice(0, 36)) {
                            let text = line.trim();
                            if (text.startsWith('for (;;);')) text = text.slice(9).trim();
                            if (text.startsWith('{') || text.startsWith('[')) parse(text);
                            if (batch.length >= 48) break;
                        }
                    }
                    if (batch.length) window.postMessage({ __metamanglerType: MSG, items: batch }, location.origin);
                } catch {}
            }
            // Observe XHR without changing open/send semantics or response access.
            const nativeSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function() {
                try {
                    const url = this.__bfFeedRequestStateV6H?.url || this.responseURL || '';
                    if (isNonHome() && isEligible(url)) {
                        this.addEventListener('readystatechange', () => {
                            try {
                                if (this.readyState !== 4 || this.status < 200 || this.status >= 400) return;
                                if (this.responseType && this.responseType !== 'text') return;
                                const raw = this.responseText;
                                if (typeof raw === 'string' && raw.length <= 3500000) {
                                    setTimeout(() => processRaw(raw), 0);
                                }
                            } catch {}
                        }, { once: false });
                    }
                } catch {}
                return nativeSend.apply(this, arguments);
            };
            // Passive cloned response reader: caller receives the original Promise
            // and the original Response object, never a replacement.
            const nativeFetch = window.fetch;
            window.fetch = function(input, init) {
                const result = nativeFetch.apply(this, arguments);
                try {
                    const url = typeof input === 'string' ? input : input?.url || '';
                    if (isNonHome() && isEligible(url)) {
                        result.then(response => {
                            try {
                                const length = Number(response.headers?.get('content-length'));
                                if (!response.ok || (length > 0 && length > 3500000)) return;
                                response.clone().text().then(processRaw).catch(() => {});
                            } catch {}
                        }).catch(() => {});
                    }
                } catch {}
                return result;
            };
        } catch {}
    }
    __bfInstallRelatedCaptionObserverV325();

    // ===== V337: native GraphQL Search using this page's own live Relay metadata =====
    // HAR verification (2026-10-22): /api/graphql POST,
    // PolarisSearchBoxRefetchableQuery / doc_id 27706427925724183,
    // response data.xdt_api__v1__fbsearch__topsearch_connection.users.
    // Retain auth/CSRF metadata strictly in MAIN-world memory during this page
    // lifetime. Never persist or post tokens, captured form bodies or cookies.
    function __bfInstallNativeGraphQLSearchV337() {
        try {
            if (location.hostname !== 'www.instagram.com' || window.__bfIGSearchGraphQLV337) return;
            window.__bfIGSearchGraphQLV337 = true;
            const OP = 'PolarisSearchBoxRefetchableQuery';
            const DOC_ID = '27706427925724183';
            const ROOT = 'xdt_api__v1__fbsearch__topsearch_connection';
            const cache = { body:'', headers:{}, at:0 };
            let inAdapter = false;

            const isRelay = url => {
                try { const u = new URL(String(url||''), location.origin);
                    return u.origin === location.origin &&
                        /^\/(?:api\/graphql|graphql\/query)\/?$/i.test(u.pathname);
                } catch { return false; }
            };
            const headersSafeInMemory = headers => {
                const out = {};
                try {
                    const iter = headers instanceof Headers ? headers.entries() :
                        Array.isArray(headers) ? headers : Object.entries(headers || {});
                    for (const [k,v] of iter) {
                        const name = String(k).toLowerCase();
                        if (['x-csrftoken','x-fb-lsd','x-asbd-id','x-ig-app-id'].includes(name) &&
                            typeof v === 'string' && v.length < 512) out[name] = v;
                    }
                } catch {}
                return out;
            };
            function remember(method, url, body, headers) {
                try {
                    if (inAdapter || String(method).toUpperCase() !== 'POST' || !isRelay(url) ||
                        typeof body !== 'string' || body.length > 45000) return;
                    const fields = new URLSearchParams(body);
                    if (!fields.has('doc_id') || !fields.has('fb_api_req_friendly_name') ||
                        (!fields.has('fb_dtsg') && !fields.has('lsd'))) return;
                    cache.body = fields.toString();
                    cache.headers = { ...cache.headers, ...headersSafeInMemory(headers) };
                    cache.at = Date.now();
                } catch {}
            }
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method,url) {
                try { this.__bfGraphQLCapture337 = !inAdapter && isRelay(url) ?
                    {method:String(method),url:String(url),headers:{}} : null; } catch {}
                return originalOpen.apply(this,arguments);
            };
            const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
            if (typeof originalSetHeader === 'function') {
                XMLHttpRequest.prototype.setRequestHeader = function(k,v) {
                    try { if (this.__bfGraphQLCapture337) this.__bfGraphQLCapture337.headers[String(k)] = String(v); } catch {}
                    return originalSetHeader.apply(this,arguments);
                };
            }
            const originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(body) {
                try { const s = this.__bfGraphQLCapture337;
                    if (s) remember(s.method,s.url,body,s.headers);
                } catch {}
                return originalSend.apply(this,arguments);
            };
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
                try {
                    const url = typeof input === 'string' ? input : input?.url;
                    const method = String(init?.method || input?.method || 'GET');
                    if (!inAdapter && isRelay(url) && method.toUpperCase() === 'POST') {
                        const data = init?.body;
                        const headers = init?.headers || input?.headers;
                        if (typeof data === 'string') remember(method,url,data,headers);
                        else if (data instanceof URLSearchParams) remember(method,url,data.toString(),headers);
                        else if (data == null && input?.clone && typeof input?.text === 'function') {
                            input.clone().text().then(body => remember(method,url,body,headers)).catch(()=>{});
                        }
                    }
                } catch {}
                return originalFetch.apply(this,arguments);
            };

            window.addEventListener('message', async e => {
                if (e.source !== window || e.origin !== location.origin ||
                    e.data?.__metamanglerType !== 'ig-search-graphql-request-v337') return;
                const id = e.data.id;
                const query = String(e.data.query || '').trim();
                if (typeof id !== 'string' || !/^ig337-[0-9]+-[a-z0-9]+$/i.test(id) ||
                    query.length < 1 || query.length > 100) return;
                const reply = (ok,status,error,data) => {
                    window.postMessage({ __metamanglerType:'ig-search-graphql-result-v337',
                        id, ok:!!ok, status:Number(status)||0, error:String(error||''),
                        data: data || null }, location.origin);
                };
                if (!cache.body) {
                    reply(false,0,'no-live-relay-template'); return;
                }
                try {
                    const payload = new URLSearchParams(cache.body);
                    payload.set('fb_api_caller_class', 'RelayModern');
                    payload.set('fb_api_req_friendly_name', OP);
                    payload.set('doc_id', DOC_ID);
                    payload.set('server_timestamps', 'true');
                    payload.delete('fb_api_analytics_tags');
                    payload.set('variables', JSON.stringify({
                        data: { context:'blended', include_reel:'true', query,
                            rank_token:'', search_session_id: typeof crypto?.randomUUID === 'function' ?
                                crypto.randomUUID() : 'ig-' + Date.now() + '-' + Math.random().toString(36).slice(2),
                            search_surface:'web_top_search' }, hasQuery:true
                    }));
                    const headers = { ...cache.headers, 'Accept':'application/json',
                        'Content-Type':'application/x-www-form-urlencoded',
                        'X-FB-Friendly-Name':OP };
                    inAdapter = true;
                    let request;
                    try { request = originalFetch.call(window, '/api/graphql', {
                        method:'POST', body:payload.toString(), headers,
                        credentials:'same-origin', redirect:'error'
                    }); } finally { inAdapter = false; }
                    const response = await request;
                    if (!response.ok) { reply(false,response.status,'http-' + response.status); return; }
                    const raw = await response.text();
                    if (raw.length > 1900000) { reply(false,response.status,'oversized-response'); return; }
                    const json = JSON.parse(raw.replace(/^for \(;;\);/, ''));
                    const rows = json?.data?.[ROOT];
                    if (!rows || !Array.isArray(rows.users)) {
                        reply(false,response.status,'no-search-results-field'); return;
                    }
                    // Never expose upstream response objects or private metadata:
                    // only the account and hashtag display fields required by UI.
                    const users = rows.users.slice(0,60).map(entry => {
                        const user = entry?.user || entry;
                        const username = String(user?.username || '').slice(0,30);
                        if (!/^[a-z0-9._]{1,30}$/i.test(username)) return null;
                        // The HAR's native Search response includes profile_pic_url.
                        // Forward only a validated CDN URL, never account metadata.
                        const picture = String(user?.profile_pic_url || '');
                        let profile_pic_url = '';
                        try {
                            const url = new URL(picture);
                            const host = url.hostname.toLowerCase();
                            if (url.protocol === 'https:' && picture.length < 2200 &&
                                (host === 'cdninstagram.com' || host.endsWith('.cdninstagram.com') ||
                                 host === 'fbcdn.net' || host.endsWith('.fbcdn.net')))
                                profile_pic_url = url.href;
                        } catch {}
                        return { user:{ username, full_name:String(user?.full_name||'').slice(0,140),
                            profile_pic_url } };
                    }).filter(Boolean);
                    const hashtags = (rows.hashtags || []).slice(0,20).map(entry => {
                        const name = String((entry?.hashtag || entry)?.name || '').slice(0,100);
                        return /^[\p{L}\p{N}_]{1,100}$/u.test(name) ? { hashtag:{name} } : null;
                    }).filter(Boolean);
                    reply(true,response.status,'', {users,hashtags});
                } catch { reply(false,0,'request-error'); }
            },false);
        } catch {}
    }
    __bfInstallNativeGraphQLSearchV337();

})();
