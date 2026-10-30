// BraveFox Enhancer 29.6.7 — passive Facebook caption observer, MAIN world.
// Reads bounded feed GraphQL responses and initial Relay JSON; never changes
// requests, cursors, response objects, post DOM, scroll position, or approvals.
(() => {
'use strict';
const INSTALLED = '__bravefoxFbPassiveCaptionWorldV295';
if (window[INSTALLED]) return;
Object.defineProperty(window, INSTALLED, { value: true });

const TYPE = 'bravefox-fb-passive-caption-v295';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_POSTS = 70;
const PAGE = /^(?:(?:Profile|Page|CometPage).*(?:TimelineFeed|TilesFeed|PostsFeed|PagePosts)|CometSinglePage.*Feed).*(?:Query|Pagination|Refetch)$/i;
const HOME = /^(?:(?:Comet|Home|News).*(?:Feed|Timeline)|(?:Feed|NewsFeed)).*(?:Query|Pagination|Refetch)$/i;

function route() {
    const path = location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    if (path === '/' || path === '/home.php') return '/';
    if (['/four3four', '/itsstillrealtousdammit', '/prowrestlingworld',
        '/weirdimagesworthseeing'].includes(path)) return path;
    return '';
}
function isGraphQL(url) {
    try { return new URL(String(url), location.origin).pathname === '/api/graphql/'; }
    catch { return false; }
}
function friendly(body) {
    try {
        if (typeof body === 'string') {
            if (!body.includes('fb_api_req_friendly_name=')) return '';
            return new URLSearchParams(body).get('fb_api_req_friendly_name') || '';
        }
        if (body instanceof URLSearchParams || body instanceof FormData) {
            return String(body.get('fb_api_req_friendly_name') || '');
        }
    } catch {}
    return '';
}
function observe(url, body) {
    if (!isGraphQL(url)) return '';
    const r = route();
    if (!r) return '';
    const name = friendly(body);
    return name && (r === '/' ? HOME.test(name) : PAGE.test(name)) ? r : '';
}
function urlKey(value) {
    try {
        const u = new URL(String(value), location.origin);
        if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return '';
        const m = u.pathname.match(/\/(?:posts|permalink|videos|reel)\/([^/?#]+)/i);
        return m ? 'post:' + m[1].toLowerCase() : '';
    } catch { return ''; }
}
function extract(obj, records) {
    let walked = 0;
    const seen = new Set();
    function visit(node, depth) {
        if (++walked > 5000 || depth > 22 || !node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length && i < 140; i++) visit(node[i], depth + 1);
            return;
        }
        const message = node.message?.text;
        if (typeof message === 'string' && message.length && message.length <= 16000) {
            const keys = [];
            const id = String(node.post_id || '');
            if (/^\d{8,25}$/.test(id)) keys.push('post:' + id);
            for (const url of [node.wwwURL, node.permalink_url, node.url]) {
                const key = urlKey(url);
                if (key && !keys.includes(key)) keys.push(key);
            }
            if (keys.length) {
                // Facebook repeats the SAME complete caption in an inner message renderer.
                // Its renderer may have only the pfbid permalink, while the outer story
                // also carries the numeric post_id. Merge equal-text records sharing an
                // exact key so the consumer never mistakes them for two different posts.
                const existing = records.find(record => record.text === message &&
                    record.keys.some(key => keys.includes(key)));
                if (existing) {
                    for (const key of keys) {
                        if (!existing.keys.includes(key) && existing.keys.length < 6) existing.keys.push(key);
                    }
                } else {
                    const signature = keys.join('|');
                    if (!seen.has(signature) && records.length < MAX_POSTS) {
                        seen.add(signature);
                        records.push({ keys: keys.slice(0, 6), text: message });
                    }
                }
            }
        }
        if (records.length >= MAX_POSTS || walked > 5000) return;
        // Follow only the structured feed tree; never search arbitrary tracking blobs.
        for (const key of ['data', 'node', 'edges', 'comet_sections', 'content',
            'story', 'feedback', 'story_ufi_container', 'timeline_list_feed_units',
            'feed_units', 'home_feed', 'attachments', 'attached_story', 'nodes']) {
            if (node[key] !== undefined) visit(node[key], depth + 1);
        }
    }
    visit(obj, 0);
}
// v316: publish complete GraphQL JSON lines as soon as they arrive, not at EOF.
// Partial lines are buffered and NEVER inspected for post content. The parser is
// per-response and bounded; it cannot alter, consume or delay Facebook's stream.
function makeCaptionStreamV316(fromRoute, source) {
    let pending = '';
    let seenChars = 0;
    let seenPosts = 0;
    let ended = false;
    const seenRecords = new Set();
    return {
        append(part = '', final = false) {
            try {
                if (ended || !fromRoute || route() !== fromRoute) { ended = true; return; }
                seenChars += part.length;
                if (seenChars > MAX_BYTES) { ended = true; pending = ''; return; }
                pending += part;
                const posts = [];
                const handleLine = line => {
                    if (!line || !line.startsWith('{') || seenPosts >= MAX_POSTS) return;
                    const extracted = [];
                    try { extract(JSON.parse(line), extracted); } catch { return; }
                    for (const record of extracted) {
                        if (seenPosts >= MAX_POSTS) break;
                        const signature = record.keys.join('|') + '\n' + record.text;
                        if (seenRecords.has(signature)) continue;
                        seenRecords.add(signature);
                        posts.push(record);
                        seenPosts++;
                    }
                };
                let newline;
                while ((newline = pending.indexOf('\n')) >= 0 && seenPosts < MAX_POSTS) {
                    const line = pending.slice(0, newline).replace(/\r$/, '');
                    pending = pending.slice(newline + 1);
                    handleLine(line);
                }
                if (final && seenPosts < MAX_POSTS) handleLine(pending);
                if (posts.length && route() === fromRoute) window.postMessage({
                    type: TYPE, route: fromRoute, posts,
                    captureSource: source, capturePhase: final ? 'complete' : 'stream'
                }, location.origin);
                if (final || seenPosts >= MAX_POSTS) { ended = true; pending = ''; }
            } catch { ended = true; pending = ''; }
        }
    };
}

function publish(payload, fromRoute) {
    try {
        if (!fromRoute || route() !== fromRoute || !payload || payload.length > MAX_BYTES) return;
        const stream = makeCaptionStreamV316(fromRoute, 'relay-bootstrap');
        stream.append(payload, true);
    } catch {}
}

try {
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    const requestUrls = new WeakMap();
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        requestUrls.set(this, String(method).toUpperCase() === 'POST' && isGraphQL(url));
        return open.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
        const fromRoute = requestUrls.get(this) ? observe('/api/graphql/', body) : '';
        if (fromRoute) {
            const stream = makeCaptionStreamV316(fromRoute, 'xhr');
            let readChars = 0;
            // readyState 3 and progress can reveal completed JSON lines before loadend.
            // Read only responseText; never touch Facebook's handlers or response data.
            const onChunk = (final = false) => {
                try {
                    if (!final && this.readyState !== 3) return;
                    if (this.status < 200 || this.status >= 300 ||
                        (this.responseType && this.responseType !== 'text')) return;
                    const value = this.responseText;
                    if (typeof value !== 'string' || value.length > MAX_BYTES || value.length < readChars) return;
                    if (!final && value.length === readChars) return;
                    const fragment = value.slice(readChars);
                    readChars = value.length;
                    // Let Facebook's own progress/readyState handlers finish first.
                    // Microtasks preserve fragment order without waiting for loadend.
                    Promise.resolve().then(() => stream.append(fragment, final)).catch(() => {});
                } catch {}
            };
            const onProgress = () => onChunk(false);
            const onStateChange = () => onChunk(false);
            this.addEventListener('progress', onProgress);
            this.addEventListener('readystatechange', onStateChange);
            this.addEventListener('loadend', () => {
                onChunk(true);
                this.removeEventListener('progress', onProgress);
                this.removeEventListener('readystatechange', onStateChange);
            }, { once: true });
        }
        return send.apply(this, arguments);
    };
} catch {}

try {
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') window.fetch = function(input, init) {
        let fromRoute = '';
        try { fromRoute = observe(typeof input === 'string' ? input : input?.url, init?.body); }
        catch {}
        const result = originalFetch.apply(this, arguments);
        if (!fromRoute) return result;
        // Read only an independent clone. Its streaming JSON lines can be published
        // before EOF; the original fetch promise/body are never awaited or changed.
        result.then(response => {
            try {
                const size = Number(response.headers?.get('content-length') || 0);
                if (!response.ok || size > MAX_BYTES) return response;
                const clone = response.clone();
                Promise.resolve().then(async () => {
                    let reader;
                    try {
                        if (!clone.body?.getReader) return;
                        reader = clone.body.getReader();
                        const decoder = new TextDecoder();
                        const stream = makeCaptionStreamV316(fromRoute, 'fetch');
                        let length = 0;
                        while (true) {
                            const part = await reader.read();
                            if (part.done) break;
                            length += part.value.byteLength;
                            if (length > MAX_BYTES) { await reader.cancel(); return; }
                            stream.append(decoder.decode(part.value, { stream: true }), false);
                        }
                        stream.append(decoder.decode(), true);
                    } catch { try { await reader?.cancel(); } catch {} }
                });
            } catch {}
        }).catch(() => {});
        return result;
    };
} catch {}

// v302/v316: initial full-page loads may hydrate stories from inline Relay JSON.
// Inspect once at readystatechange=interactive (just after HTML parsing) and
// again at DOMContentLoaded for scripts inserted between these stages. Never
// execute/eval scripts, and don't reprocess the same successfully parsed node.
const inspectedRelayScriptsV316 = new WeakSet();
function scanInitialRelayBootstrap() {
    try {
        const r = route();
        if (!r) return;
        let bytes = 0;
        let inspected = 0;
        const scripts = document.querySelectorAll('script[type="application/json"], script[data-sjs]');
        for (const script of scripts) {
            if (++inspected > 180 || bytes > 6 * 1024 * 1024) break;
            if (inspectedRelayScriptsV316.has(script)) continue;
            const value = script.textContent || '';
            if (!value || value.length > MAX_BYTES) continue;
            bytes += value.length;
            if (!/post_id|timeline_list_feed_units/i.test(value)) continue;
            let parsed;
            try { parsed = JSON.parse(value); } catch { continue; }
            inspectedRelayScriptsV316.add(script);
            const posts = [];
            let walked = 0;
            const visit = (value, depth = 0) => {
                if (++walked > 12000 || depth > 28 || posts.length >= MAX_POSTS || !value) return;
                if (typeof value === 'string') {
                    if (value.length < MAX_BYTES && value.startsWith('{') &&
                        /post_id|timeline_list_feed_units/.test(value)) {
                        try { visit(JSON.parse(value), depth + 1); } catch {}
                    }
                    return;
                }
                if (Array.isArray(value)) {
                    for (const item of value.slice(0, 160)) visit(item, depth + 1);
                    return;
                }
                if (typeof value !== 'object') return;
                // Reuse the exact post-key extraction; never publish arbitrary text
                // without an intrinsic post_id or Facebook post permalink.
                if (value.post_id || value.wwwURL || value.permalink_url) extract(value, posts);
                for (const key of ['require', '__bbox', 'result', 'payload', 'response',
                    'data', 'node', 'edges', 'timeline_list_feed_units', 'feed_units',
                    'comet_sections', 'content', 'story', 'message_container']) {
                    if (value[key] !== undefined) visit(value[key], depth + 1);
                }
            };
            visit(parsed);
            if (posts.length && route() === r)
                window.postMessage({ type: TYPE, route: r, posts,
                    captureSource: 'relay-bootstrap', capturePhase: 'complete' }, location.origin);
        }
    } catch {}
}
if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') scanInitialRelayBootstrap();
    }, { once: true });
    document.addEventListener('DOMContentLoaded', scanInitialRelayBootstrap, { once: true });
} else {
    scanInitialRelayBootstrap();
    if (document.readyState === 'interactive')
        document.addEventListener('DOMContentLoaded', scanInitialRelayBootstrap, { once: true });
}
})();
