import { browser } from './api.js';
import { isCompletelyExcludedHostname, isCompletelyExcludedUrl } from './shared.js';

const LOG_PREFIX = '[BraveFox Focus Master Hosts]';
const META_KEY = 'bfb:hosts-meta:v1';
const CHUNK_PREFIX = 'bfb:hosts-chunk:v1:';
const ALARM_NAME = 'bfb-hosts-refresh';
const CHUNK_SIZE = 5000;
const REMOTE_TIMEOUT_MS = 4500;
const REMOTE_RETRIES_WITH_FALLBACK = 1;
const REMOTE_RETRIES_NO_FALLBACK = 2;
const REMOTE_RETRY_DELAY_MS = 750;
const SOURCES = [
  { id: 'BraveFoxHosts', url: 'https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/blocker/lists/BraveFoxHosts', fallbackPath: 'blocker/lists/BraveFoxHosts' },
  { id: 'StevenBlack', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-porn/hosts' },
  { id: 'legacyFox', url: 'https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/blocker/lists/legacyFox', fallbackPath: 'blocker/lists/legacyFox' }
];

let cachedHosts = null;
let updatePromise = null;
let bundledBaselineMergedIntoCache = false;

function normalizeHost(value) {
  return String(value || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
}

function isIPAddress(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(':');
}

function parseHostsText(text) {
  const result = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const candidate = normalizeHost(parts.length > 1 ? parts[1] : parts[0]);
    if (!candidate || candidate === 'localhost' || isIPAddress(candidate) || !candidate.includes('.')) continue;
    result.push(candidate);
  }
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchText(url, timeoutMs = REMOTE_TIMEOUT_MS) {
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : 0;
  try {
    const response = await fetch(url, {
      signal: controller?.signal,
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'text/plain' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function fetchSource(source) {
  const attempts = source.fallbackPath ? REMOTE_RETRIES_WITH_FALLBACK : REMOTE_RETRIES_NO_FALLBACK;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const text = await fetchText(`${source.url}?bravefox_refresh=${Date.now()}`);
      const hosts = parseHostsText(text);
      if (!hosts.length) throw new Error('Remote list contained no usable hosts.');
      return { hosts, origin: 'remote' };
    } catch (remoteError) {
      console.warn(`${LOG_PREFIX} ${source.id} remote attempt ${attempt}/${attempts} failed:`, remoteError);
      if (attempt < attempts) await sleep(REMOTE_RETRY_DELAY_MS);
    }
  }

  if (source.fallbackPath) {
    try {
      const hosts = parseHostsText(await fetchText(browser.runtime.getURL(source.fallbackPath), 0));
      if (hosts.length) {
        console.warn(`${LOG_PREFIX} ${source.id}: remote unavailable, using bundled fallback.`);
        return { hosts, origin: 'bundled-fallback' };
      }
    } catch (fallbackError) {
      console.warn(`${LOG_PREFIX} ${source.id} bundled fallback failed:`, fallbackError);
    }
  }

  return { hosts: [], origin: 'unavailable' };
}

async function loadBundledBaseline() {
  const seen = new Set();
  for (const source of SOURCES) {
    if (!source.fallbackPath) continue;
    try {
      const hosts = parseHostsText(await fetchText(browser.runtime.getURL(source.fallbackPath), 0));
      for (const host of hosts) {
        if (!isCompletelyExcludedHostname(host)) seen.add(host);
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} Bundled ${source.id} baseline failed:`, error);
    }
  }
  return [...seen].sort();
}

async function mergeWithBundledBaseline(hosts) {
  const seen = new Set(Array.isArray(hosts) ? hosts : []);
  const bundled = await loadBundledBaseline();
  for (const host of bundled) {
    if (!isCompletelyExcludedHostname(host)) seen.add(host);
  }
  return [...seen].sort();
}

async function saveHosts(hosts, sourceStats = null) {
  const old = await browser.storage.local.get(null);
  const oldKeys = Object.keys(old).filter(key => key.startsWith(CHUNK_PREFIX));
  const payload = {};
  let chunks = 0;
  for (let index = 0; index < hosts.length; index += CHUNK_SIZE) {
    payload[`${CHUNK_PREFIX}${chunks}`] = hosts.slice(index, index + CHUNK_SIZE);
    chunks += 1;
  }
  payload[META_KEY] = { chunks, count: hosts.length, updatedAt: Date.now(), sourceStats };
  await browser.storage.local.set(payload);
  const keep = new Set(Object.keys(payload));
  const stale = oldKeys.filter(key => !keep.has(key));
  if (stale.length) await browser.storage.local.remove(stale);
}

async function loadHosts() {
  const metaResult = await browser.storage.local.get(META_KEY);
  const meta = metaResult[META_KEY];
  if (!meta?.chunks) return [];
  const keys = Array.from({ length: Number(meta.chunks) }, (_, index) => `${CHUNK_PREFIX}${index}`);
  const data = await browser.storage.local.get(keys);
  const hosts = [];
  for (const key of keys) {
    if (Array.isArray(data[key])) hosts.push(...data[key]);
  }
  return hosts;
}

export async function updateHosts() {
  if (updatePromise) return updatePromise;
  updatePromise = (async () => {
    const seen = new Set();
    const sourceStats = {};
    let partialRefresh = false;

    for (const source of SOURCES) {
      const result = await fetchSource(source);
      sourceStats[source.id] = { origin: result.origin, count: result.hosts.length };
      if (result.origin === 'unavailable') partialRefresh = true;
      for (const host of result.hosts) {
        if (!isCompletelyExcludedHostname(host) && !seen.has(host)) seen.add(host);
      }
    }

    const existing = cachedHosts || await loadHosts();
    if (partialRefresh && existing.length) {
      for (const host of existing) {
        if (!isCompletelyExcludedHostname(host)) seen.add(host);
      }
      console.warn(`${LOG_PREFIX} Partial refresh: previous cached generation was merged to avoid an offline gap.`);
    }

    if (!seen.size) {
      if (existing.length) {
        const mergedExisting = await mergeWithBundledBaseline(existing);
        cachedHosts = mergedExisting;
        bundledBaselineMergedIntoCache = true;
        return mergedExisting;
      }
      throw new Error('No hosts source or bundled fallback could be loaded.');
    }

    // The packaged BraveFoxHosts + legacyFox files are an authoritative baseline,
    // not merely an offline fallback. Always union them with the fetched generation.
    const hosts = await mergeWithBundledBaseline([...seen]);
    await saveHosts(hosts, sourceStats);
    cachedHosts = hosts;
    bundledBaselineMergedIntoCache = true;
    return hosts;
  })().finally(() => { updatePromise = null; });
  return updatePromise;
}

async function ensureHosts() {
  if (!cachedHosts) cachedHosts = await loadHosts();

  if (!cachedHosts.length) {
    cachedHosts = await updateHosts();
    bundledBaselineMergedIntoCache = true;
    return cachedHosts;
  }

  if (!bundledBaselineMergedIntoCache) {
    cachedHosts = await mergeWithBundledBaseline(cachedHosts);
    bundledBaselineMergedIntoCache = true;
  }

  return cachedHosts;
}

function binaryHas(sorted, value) {
  let low = 0, high = sorted.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const current = sorted[mid];
    if (current === value) return true;
    if (current < value) low = mid + 1; else high = mid - 1;
  }
  return false;
}

export async function findBlockedHost(urlValue) {
  if (isCompletelyExcludedUrl(urlValue)) return '';
  let host;
  try { host = normalizeHost(new URL(String(urlValue || '')).hostname); } catch { return ''; }
  if (!host) return '';
  const hosts = await ensureHosts();
  const labels = host.split('.');
  for (let index = 0; index < labels.length - 1; index += 1) {
    const candidate = labels.slice(index).join('.');
    if (binaryHas(hosts, candidate)) return candidate;
  }
  return '';
}

export async function getHostsStatus() {
  if (!cachedHosts) {
    try { cachedHosts = await loadHosts(); } catch { cachedHosts = []; }
  }
  let meta = null;
  try { meta = (await browser.storage.local.get(META_KEY))[META_KEY] || null; } catch {}
  return {
    count: cachedHosts?.length || 0,
    lastUpdated: Number(meta?.updatedAt || 0),
    sourceStats: meta?.sourceStats || null
  };
}

export async function initializeHosts() {
  try { cachedHosts = await loadHosts(); } catch {}

  // The packaged baseline is authoritative even when an older cached generation exists.
  // Merge it immediately so freshly bundled entries take effect on PC and Android without
  // waiting for GitHub or the next scheduled refresh.
  try {
    const beforeCount = Array.isArray(cachedHosts) ? cachedHosts.length : 0;
    cachedHosts = await mergeWithBundledBaseline(cachedHosts || []);
    bundledBaselineMergedIntoCache = true;

    if (cachedHosts.length && cachedHosts.length !== beforeCount) {
      await saveHosts(cachedHosts, {
        startup: {
          origin: beforeCount ? 'cache+bundled-baseline' : 'bundled-baseline',
          count: cachedHosts.length
        }
      });
    }

    if (!beforeCount && cachedHosts.length) {
      console.log(`${LOG_PREFIX} Loaded ${cachedHosts.length} bundled hosts as the immediate PC/Android baseline.`);
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Bundled startup baseline failed:`, error);
  }

  if (!cachedHosts?.length) {
    try {
      cachedHosts = await updateHosts();
      bundledBaselineMergedIntoCache = true;
    } catch (error) {
      console.warn(`${LOG_PREFIX} Initial hosts refresh failed:`, error);
    }
  }

  browser.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
  void updateHosts().catch(error => console.warn(`${LOG_PREFIX} Refresh failed; cached/bundled hosts remain active:`, error));
}

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) void updateHosts().catch(error => console.warn(`${LOG_PREFIX} Refresh failed:`, error));
});
