// BraveFox Enhancer 29.5.0 — passive Facebook caption observer, MAIN world.
// Reads ONLY bounded feed GraphQL response text; never changes requests, cursors,
// Facebook response objects, the DOM, scroll position, or post approvals.
(() => {
'use strict';
const INSTALLED = '__bravefoxFbPassiveCaptionWorldV295';
if (window[INSTALLED]) return;
Object.defineProperty(window, INSTALLED, { value: true });

const TYPE = 'bravefox-fb-passive-caption-v295';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_POSTS = 70;
const PAGE = /^(?:ProfileCometTimelineFeed|ProfileCometTilesFeed|PageCometTimelineFeed|CometPageTimelineFeed).*(?:Query|Pagination|Refetch)$/i;
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
                const signature = keys.join('|');
                if (!seen.has(signature) && records.length < MAX_POSTS) {
                    seen.add(signature);
                    records.push({ keys: keys.slice(0, 6), text: message });
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
function publish(payload, fromRoute) {
    try {
        if (!fromRoute || route() !== fromRoute || !payload || payload.length > MAX_BYTES) return;
        const posts = [];
        for (const line of payload.split(/\r?\n/)) {
            if (!line || !line.startsWith('{')) continue;
            try { extract(JSON.parse(line), posts); } catch {}
            if (posts.length >= MAX_POSTS) break;
        }
        if (posts.length) window.postMessage({ type: TYPE, route: fromRoute, posts }, location.origin);
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
        if (fromRoute) this.addEventListener('loadend', () => {
            try {
                if (this.status < 200 || this.status >= 300 ||
                    (this.responseType && this.responseType !== 'text')) return;
                const response = this.responseText;
                if (response && response.length <= MAX_BYTES) setTimeout(() => publish(response, fromRoute), 0);
            } catch {}
        }, { once: true });
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
        // Observe an independent clone asynchronously. The original response is NEVER
        // consumed, changed or delayed; stop reading if size exceeds the hard limit.
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
                        const chunks = [];
                        let length = 0;
                        while (true) {
                            const part = await reader.read();
                            if (part.done) break;
                            length += part.value.byteLength;
                            if (length > MAX_BYTES) { await reader.cancel(); return; }
                            chunks.push(part.value);
                        }
                        const all = new Uint8Array(length);
                        let pos = 0;
                        for (const c of chunks) { all.set(c, pos); pos += c.length; }
                        publish(new TextDecoder().decode(all), fromRoute);
                    } catch { try { await reader?.cancel(); } catch {} }
                });
            } catch {}
        }).catch(() => {});
        return result;
    };
} catch {}
})();
