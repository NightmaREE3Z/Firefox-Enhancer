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
            const CONFIG_SEND_GRACE_MS = 120;
            const feedPageStats = [];
            let paginationFirstTarget = PAGINATION_FIRST_MIN;
            try { window.__bfInstagramFeedSanitizerStatsV6H = feedPageStats; } catch {}

            let configuredKeywordRegexes = [];
            let configuredKeywordRegexFallback = [];
            let configuredAllowedWords = [];
            let configuredBannedAccounts = new Set();
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
                /ai[ -]?generated/i,
                /ai[ -]?created/i,
                /ai[ -]?generated content/i,
                /ai[ -]?created content/i,
                /ai[ -]?art/i,
                /ai[ -]?edited/i,
                /\bAI\b/i
            ];

            function normalizeUsername(value) {
                return String(value || '').trim().replace(/^@+/, '').toLowerCase();
            }

            function normalizeText(value) {
                return String(value || '').replace(/\s+/g, ' ').trim();
            }

            function compileKeywordRegex(patterns) {
                try {
                    configuredKeywordRegexes = [];
                    configuredKeywordRegexFallback = [];
                    if (!Array.isArray(patterns) || !patterns.length) return;
                    const sources = [];
                    for (const item of patterns) {
                        if (!item || typeof item.source !== 'string' || !item.source) continue;
                        try {
                            const flags = typeof item.flags === 'string' && item.flags ? item.flags : 'i';
                            const test = new RegExp(item.source, flags);
                            if (test.flags === 'i') sources.push(`(?:${item.source})`);
                            else configuredKeywordRegexFallback.push(test);
                        } catch {}
                    }
                    const CHUNK_SIZE = 48;
                    for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
                        try { configuredKeywordRegexes.push(new RegExp(sources.slice(i, i + CHUNK_SIZE).join('|'), 'i')); } catch {}
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

            function allConfigsReady() {
                return keywordConfigReady && allowedConfigReady && accountConfigReady;
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

            function configuredKeywordMatches(value) {
                try {
                    const text = String(value || '');
                    if (!text || textHasAllowedWord(text)) return false;

                    for (const regex of builtInCriticalRegexes) {
                        try {
                            regex.lastIndex = 0;
                            if (regex.test(text)) { regex.lastIndex = 0; return true; }
                            regex.lastIndex = 0;
                        } catch {}
                    }
                    if (!keywordConfigReady) return false;
                    for (const regex of configuredKeywordRegexes) {
                        try {
                            regex.lastIndex = 0;
                            if (regex.test(text)) { regex.lastIndex = 0; return true; }
                            regex.lastIndex = 0;
                        } catch {}
                    }
                    for (const regex of configuredKeywordRegexFallback) {
                        try {
                            regex.lastIndex = 0;
                            if (regex.test(text)) { regex.lastIndex = 0; return true; }
                            regex.lastIndex = 0;
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
                    } else if (data.__metamanglerType === 'ig-feed-classifier-ready') {
                        isolatedWorldReady = true;
                        flushPendingClassifications();
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
                        if (media && allConfigsReady() && mediaProjectionComplete(media) && !inspectMediaForBannedContent(media)) {
                            const ownerFollowing = mediaOwnerFollowingState(media);
                            const connected = mediaHasFollowConnection(media);
                            if (ownerFollowing === true || connected) addClassification(classifications, media, 'allow', decision?.reasons || ['network-safe']);
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
                } catch { return { changed: false, text: rawText, payload: null }; }
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
                            if (xhr.responseType === 'json') {
                                const payload = nativeResponse(xhr);
                                if (payload && typeof payload === 'object') {
                                    sanitizePayloadObject(payload);
                                    state.sanitizedJson = payload;
                                }
                                return;
                            }
                            if (xhr.responseType === '' || xhr.responseType === 'text') {
                                const raw = nativeResponseText(xhr);
                                const result = sanitizeJsonText(raw);
                                if (result.changed) state.sanitizedText = result.text;
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
                                    if (!state || !state.isFeed || this.readyState !== 4) return;
                                    processFeedResponseIfReady(this, state);
                                } catch {}
                            });
                        } catch {}
                    }

                    proto.open = function(method, url) {
                        let result;
                        try {
                            const priorSerial = Number(this.__bfFeedRequestStateV6H?.serial || 0);
                            this.__bfFeedRequestStateV6H = {
                                serial: priorSerial + 1,
                                url: String(url || ''),
                                friendlyName: '',
                                rootField: '',
                                isFeed: false,
                                processed: false,
                                sanitizedText: null,
                                sanitizedJson: null,
                                responseViewInstalled: false
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
                            const friendly = headers?.get?.('x-fb-friendly-name') === FEED_FRIENDLY_NAME;
                            const root = headers?.get?.('x-root-field-name') === FEED_ROOT_FIELD;
                            const direct = bodyLooksLikeFeed(body);
                            if (isFeedRequestUrl(url) && (friendly || root || direct)) {
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

})();
