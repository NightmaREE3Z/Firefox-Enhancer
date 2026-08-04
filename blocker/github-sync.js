import { parseListText, serializeListCsv } from './csv.js';
import { loadBundledFallbackLists, loadDataset, saveDataset } from './storage.js';
import { normalizeLinkForStorage, normalizeTerm, uniqueInOrder } from './shared.js';

const LOG_PREFIX = '[BraveFox Focus Master GitHub Sync]';
const CONFIG_KEY = 'bfb:github-sync-config';
const STATE_KEY = 'bfb:github-sync-state';
const AUTO_SYNC_ALARM = 'bfb-github-auto-sync';
const DEBOUNCED_SYNC_ALARM = 'bfb-github-debounced-sync';
const AUTO_SYNC_INTERVAL_MINUTES = 15;
const DEBOUNCE_MS = 5000;
const REQUIRED_DATA_COLLECTION = Object.freeze([
  'authenticationInfo',
  'browsingActivity',
  'searchTerms'
]);

export const GITHUB_SYNC_TARGET = Object.freeze({
  owner: 'NightmaREE3Z',
  repository: 'Firefox-Enhancer',
  branch: 'v27-release',
  files: Object.freeze({
    terms: Object.freeze({
      path: 'blocker/lists/blockedTerms.csv',
      rawUrl: 'https://raw.githubusercontent.com/NightmaREE3Z/Firefox-Enhancer/refs/heads/v27-release/blocker/lists/blockedTerms.csv'
    }),
    links: Object.freeze({
      path: 'blocker/lists/blockedLinks.csv',
      rawUrl: 'https://raw.githubusercontent.com/NightmaREE3Z/Firefox-Enhancer/refs/heads/v27-release/blocker/lists/blockedLinks.csv'
    })
  })
});

const DEFAULT_CONFIG = Object.freeze({
  autoSync: true,
  token: ''
});

const DEFAULT_STATE = Object.freeze({
  initialized: false,
  pending: [],
  forceSnapshot: { terms: false, links: false },
  lastSyncAt: 0,
  lastAction: '',
  lastError: ''
});

let syncPromise = null;

function normalizerFor(kind) {
  return kind === 'links' ? normalizeLinkForStorage : normalizeTerm;
}

function normalizeKind(kind) {
  if (kind === 'terms' || kind === 'links') return kind;
  throw new Error('Unknown GitHub blocklist type.');
}

function normalizeConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    autoSync: source.autoSync !== false,
    token: String(source.token || '').trim()
  };
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const pending = [];
  for (const item of Array.isArray(source.pending) ? source.pending : []) {
    if (!item || (item.kind !== 'terms' && item.kind !== 'links')) continue;
    if (item.action !== 'add' && item.action !== 'remove') continue;
    const normalized = normalizerFor(item.kind)(item.value);
    if (!normalized) continue;
    pending.push({
      id: String(item.id || `${Date.now()}-${Math.random()}`),
      kind: item.kind,
      action: item.action,
      value: normalized,
      createdAt: Number(item.createdAt) || Date.now()
    });
  }
  return {
    initialized: Boolean(source.initialized),
    pending,
    forceSnapshot: {
      terms: Boolean(source.forceSnapshot?.terms),
      links: Boolean(source.forceSnapshot?.links)
    },
    lastSyncAt: Number(source.lastSyncAt) || 0,
    lastAction: String(source.lastAction || ''),
    lastError: String(source.lastError || '')
  };
}

async function readConfig() {
  const result = await browser.storage.local.get(CONFIG_KEY);
  return normalizeConfig(result[CONFIG_KEY] || DEFAULT_CONFIG);
}

async function writeConfig(config) {
  const clean = normalizeConfig(config);
  await browser.storage.local.set({ [CONFIG_KEY]: clean });
  return clean;
}

async function readState() {
  const result = await browser.storage.local.get(STATE_KEY);
  return normalizeState(result[STATE_KEY] || DEFAULT_STATE);
}

async function writeState(state) {
  const clean = normalizeState(state);
  await browser.storage.local.set({ [STATE_KEY]: clean });
  return clean;
}

function apiUrl(kind) {
  const file = GITHUB_SYNC_TARGET.files[normalizeKind(kind)];
  const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(GITHUB_SYNC_TARGET.owner)}/${encodeURIComponent(GITHUB_SYNC_TARGET.repository)}/contents/${encodedPath}`;
}

function githubHeaders(token = '') {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64Utf8(base64) {
  const binary = atob(String(base64 || '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

async function fetchRawKind(kind) {
  const file = GITHUB_SYNC_TARGET.files[normalizeKind(kind)];
  const response = await fetch(file.rawUrl, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'text/plain' }
  });
  if (!response.ok) throw new Error(`GitHub raw ${kind} download failed (HTTP ${response.status}).`);
  return parseListText(await response.text(), kind);
}

async function fetchRawLists({ bundledFallback = false } = {}) {
  const results = await Promise.allSettled([
    fetchRawKind('terms'),
    fetchRawKind('links')
  ]);

  let terms = results[0].status === 'fulfilled' ? results[0].value : null;
  let links = results[1].status === 'fulfilled' ? results[1].value : null;
  let usedBundledFallback = false;

  if ((terms === null || links === null) && bundledFallback) {
    const bundled = await loadBundledFallbackLists();
    if (terms === null) terms = bundled.terms;
    if (links === null) links = bundled.links;
    usedBundledFallback = true;
  }

  if (terms === null) throw results[0].reason || new Error('GitHub terms download failed.');
  if (links === null) throw results[1].reason || new Error('GitHub links download failed.');
  return { terms, links, usedBundledFallback };
}

async function fetchApiKind(kind, token) {
  const response = await fetch(`${apiUrl(kind)}?ref=${encodeURIComponent(GITHUB_SYNC_TARGET.branch)}`, {
    cache: 'no-store',
    credentials: 'omit',
    headers: githubHeaders(token)
  });

  if (response.status === 404) return { exists: false, sha: '', values: [] };
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub API ${kind} read failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }

  const payload = await response.json();
  if (payload?.type !== 'file' || typeof payload.content !== 'string') {
    throw new Error(`GitHub ${kind} path is not a readable file.`);
  }
  return {
    exists: true,
    sha: String(payload.sha || ''),
    values: parseListText(decodeBase64Utf8(payload.content), kind)
  };
}

async function putApiKind(kind, token, values, sha = '') {
  const body = {
    message: `Sync BraveFox Focus Master blocked ${kind}`,
    content: encodeBase64Utf8(serializeListCsv(values)),
    branch: GITHUB_SYNC_TARGET.branch
  };
  if (sha) body.sha = sha;

  const response = await fetch(apiUrl(kind), {
    method: 'PUT',
    credentials: 'omit',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (response.status === 409 || response.status === 422) {
    const error = new Error(`GitHub ${kind} update conflicted with a newer revision.`);
    error.code = 'conflict';
    throw error;
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub ${kind} upload failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }
  return response.json();
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function saveDatasetIfChanged(current, next) {
  const terms = uniqueInOrder(next.terms, normalizeTerm);
  const links = uniqueInOrder(next.links, normalizeLinkForStorage);
  if (arraysEqual(current?.terms, terms) && arraysEqual(current?.links, links)) return current;
  return saveDataset({ terms, links });
}

function pendingForKind(state, kind) {
  return state.pending.filter(item => item.kind === kind);
}

function applyOperations(values, kind, operations) {
  const normalize = normalizerFor(kind);
  let next = uniqueInOrder(values, normalize);
  for (const operation of operations) {
    const value = normalize(operation.value);
    if (!value) continue;
    if (operation.action === 'remove') {
      next = next.filter(item => normalize(item) !== value);
    } else if (!next.some(item => normalize(item) === value)) {
      next.push(value);
    }
  }
  return next;
}

function clearKindPending(state, kind) {
  return {
    ...state,
    pending: state.pending.filter(item => item.kind !== kind),
    forceSnapshot: { ...state.forceSnapshot, [kind]: false }
  };
}

async function hasRequiredDataConsent() {
  try {
    const permissions = await browser.permissions.getAll();
    const granted = new Set(Array.isArray(permissions.data_collection) ? permissions.data_collection : []);
    return REQUIRED_DATA_COLLECTION.every(permission => granted.has(permission));
  } catch {
    return false;
  }
}

async function uploadExactKind(kind, token, values) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remote = await fetchApiKind(kind, token);
    try {
      await putApiKind(kind, token, uniqueInOrder(values, normalizerFor(kind)), remote.sha);
      return uniqueInOrder(values, normalizerFor(kind));
    } catch (error) {
      if (error.code !== 'conflict' || attempt === 2) throw error;
    }
  }
  throw new Error(`GitHub ${kind} upload could not resolve a revision conflict.`);
}

async function uploadMergedKind(kind, token, localValues, state) {
  const operations = pendingForKind(state, kind);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remote = await fetchApiKind(kind, token);
    const target = state.forceSnapshot[kind]
      ? uniqueInOrder(localValues, normalizerFor(kind))
      : applyOperations(remote.values, kind, operations);
    try {
      await putApiKind(kind, token, target, remote.sha);
      return target;
    } catch (error) {
      if (error.code !== 'conflict' || attempt === 2) throw error;
    }
  }
  throw new Error(`GitHub ${kind} merge could not resolve a revision conflict.`);
}

async function setStatus(state, { action = '', error = '', synced = false } = {}) {
  return writeState({
    ...state,
    lastAction: action || state.lastAction,
    lastError: error,
    lastSyncAt: synced ? Date.now() : state.lastSyncAt
  });
}

export async function getGitHubSyncStatus() {
  const [config, state, consentGranted] = await Promise.all([
    readConfig(),
    readState(),
    hasRequiredDataConsent()
  ]);
  return {
    autoSync: config.autoSync,
    hasToken: Boolean(config.token),
    consentGranted,
    pendingCount: state.pending.length + Number(state.forceSnapshot.terms) + Number(state.forceSnapshot.links),
    initialized: state.initialized,
    lastSyncAt: state.lastSyncAt,
    lastAction: state.lastAction,
    lastError: state.lastError,
    target: GITHUB_SYNC_TARGET
  };
}

export async function saveGitHubSyncConfig({ autoSync, token, clearToken = false } = {}) {
  const current = await readConfig();
  const nextToken = clearToken ? '' : String(token || '').trim() || current.token;
  const config = await writeConfig({
    autoSync: autoSync !== false,
    token: nextToken
  });
  setupGitHubSyncAlarms(config);
  if (config.autoSync) scheduleAutomaticGitHubSync();
  return getGitHubSyncStatus();
}

export async function queueRemoteOperation(kind, action, value) {
  normalizeKind(kind);
  if (action !== 'add' && action !== 'remove') throw new Error('Unknown GitHub sync operation.');
  const normalized = normalizerFor(kind)(value);
  if (!normalized) return readState();

  const state = await readState();
  const pending = state.pending.filter(item => !(item.kind === kind && normalizerFor(kind)(item.value) === normalized));
  pending.push({
    id: `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,
    kind,
    action,
    value: normalized,
    createdAt: Date.now()
  });
  const saved = await writeState({ ...state, pending, lastError: '' });
  scheduleAutomaticGitHubSync();
  return saved;
}

export async function queueRemoteSnapshot(kind) {
  normalizeKind(kind);
  const state = await readState();
  const saved = await writeState({
    ...state,
    pending: state.pending.filter(item => item.kind !== kind),
    forceSnapshot: { ...state.forceSnapshot, [kind]: true },
    lastError: ''
  });
  scheduleAutomaticGitHubSync();
  return saved;
}

export function scheduleAutomaticGitHubSync() {
  void readConfig().then(config => {
    if (!config.autoSync) return;
    browser.alarms.create(DEBOUNCED_SYNC_ALARM, { when: Date.now() + DEBOUNCE_MS });
  }).catch(error => console.warn(`${LOG_PREFIX} Could not schedule automatic sync:`, error));
}

export async function downloadGitHubLists({ allowBundledFallback = true } = {}) {
  const downloaded = await fetchRawLists({ bundledFallback: allowBundledFallback });
  const current = await loadDataset({ force: true });
  const dataset = await saveDatasetIfChanged(current, { terms: downloaded.terms, links: downloaded.links });
  let state = await readState();
  state = await writeState({
    ...state,
    initialized: true,
    pending: [],
    forceSnapshot: { terms: false, links: false },
    lastSyncAt: Date.now(),
    lastAction: downloaded.usedBundledFallback ? 'Loaded bundled fallback lists' : 'Downloaded from GitHub',
    lastError: ''
  });
  return { dataset, state, usedBundledFallback: downloaded.usedBundledFallback };
}

export async function uploadGitHubLists() {
  const config = await readConfig();
  if (!config.token) throw new Error('Enter and save a fine-grained GitHub token before uploading.');
  if (!(await hasRequiredDataConsent())) {
    throw new Error('GitHub upload permission has not been granted in Firefox.');
  }

  const local = await loadDataset({ force: true });
  let state = await readState();
  const uploaded = { terms: local.terms, links: local.links };

  uploaded.terms = await uploadExactKind('terms', config.token, local.terms);
  state = clearKindPending(state, 'terms');
  await writeState(state);

  uploaded.links = await uploadExactKind('links', config.token, local.links);
  state = clearKindPending(state, 'links');
  state = await writeState({
    ...state,
    initialized: true,
    lastSyncAt: Date.now(),
    lastAction: 'Uploaded to GitHub',
    lastError: ''
  });

  const dataset = await saveDatasetIfChanged(local, uploaded);
  return { dataset, state };
}

async function runAutomaticSyncInternal() {
  const config = await readConfig();
  if (!config.autoSync) return { skipped: true, reason: 'Automatic sync is disabled.' };

  let state = await readState();
  const local = await loadDataset({ force: true });
  const hasPending = state.pending.length > 0 || state.forceSnapshot.terms || state.forceSnapshot.links;
  const canUpload = Boolean(config.token) && await hasRequiredDataConsent();

  try {
    if (!state.initialized) {
      const remote = await fetchRawLists({ bundledFallback: true });
      const merged = {
        terms: uniqueInOrder([...remote.terms, ...local.terms], normalizeTerm),
        links: uniqueInOrder([...remote.links, ...local.links], normalizeLinkForStorage)
      };
      const dataset = await saveDatasetIfChanged(local, merged);

      state = await writeState({
        ...state,
        initialized: true,
        forceSnapshot: {
          terms: local.terms.some(value => !remote.terms.includes(value)),
          links: local.links.some(value => !remote.links.includes(value))
        },
        lastAction: remote.usedBundledFallback ? 'Initialized from bundled fallback lists' : 'Merged local and GitHub lists',
        lastError: ''
      });

      if (!canUpload || (!state.forceSnapshot.terms && !state.forceSnapshot.links)) {
        state = await setStatus(state, {
          action: state.lastAction,
          error: canUpload ? '' : (state.forceSnapshot.terms || state.forceSnapshot.links ? 'Local additions are waiting for a GitHub token and upload consent.' : ''),
          synced: true
        });
        return { dataset, state, initialized: true };
      }
    }

    state = await readState();
    const current = await loadDataset({ force: true });
    const pendingNow = state.pending.length > 0 || state.forceSnapshot.terms || state.forceSnapshot.links;

    if (!pendingNow) {
      const remote = await fetchRawLists({ bundledFallback: false });
      const dataset = await saveDatasetIfChanged(current, { terms: remote.terms, links: remote.links });
      state = await setStatus(state, { action: 'Automatic GitHub download', synced: true });
      return { dataset, state, direction: 'download' };
    }

    if (!canUpload) {
      const remote = await fetchRawLists({ bundledFallback: false });
      const merged = {
        terms: state.forceSnapshot.terms ? current.terms : applyOperations(remote.terms, 'terms', pendingForKind(state, 'terms')),
        links: state.forceSnapshot.links ? current.links : applyOperations(remote.links, 'links', pendingForKind(state, 'links'))
      };
      const dataset = await saveDatasetIfChanged(current, merged);
      state = await setStatus(state, {
        action: 'Automatic GitHub download with local pending changes preserved',
        error: config.token ? 'GitHub upload consent is required.' : 'A GitHub token is required to upload pending changes.',
        synced: true
      });
      return { dataset, state, direction: 'download-pending' };
    }

    const result = { terms: current.terms, links: current.links };
    let uploadError = null;

    for (const kind of ['terms', 'links']) {
      if (!state.forceSnapshot[kind] && !pendingForKind(state, kind).length) continue;
      try {
        result[kind] = await uploadMergedKind(kind, config.token, current[kind], state);
        state = clearKindPending(state, kind);
        await writeState(state);
      } catch (error) {
        uploadError = error;
        break;
      }
    }

    const dataset = await saveDatasetIfChanged(current, result);
    if (uploadError) {
      state = await setStatus(state, {
        action: 'Automatic GitHub upload partially completed',
        error: String(uploadError?.message || uploadError),
        synced: false
      });
      throw uploadError;
    }

    state = await writeState({
      ...state,
      initialized: true,
      lastSyncAt: Date.now(),
      lastAction: 'Automatic GitHub upload',
      lastError: ''
    });
    return { dataset, state, direction: 'upload' };
  } catch (error) {
    const currentState = await readState();
    await setStatus(currentState, {
      action: currentState.lastAction || 'Automatic GitHub sync',
      error: String(error?.message || error),
      synced: false
    });
    throw error;
  }
}

export async function runAutomaticGitHubSync() {
  if (syncPromise) return syncPromise;
  syncPromise = runAutomaticSyncInternal().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

function setupGitHubSyncAlarms(config = DEFAULT_CONFIG) {
  if (config.autoSync) {
    browser.alarms.create(AUTO_SYNC_ALARM, { periodInMinutes: AUTO_SYNC_INTERVAL_MINUTES });
  } else {
    void browser.alarms.clear(AUTO_SYNC_ALARM);
    void browser.alarms.clear(DEBOUNCED_SYNC_ALARM);
  }
}

export async function initializeGitHubSync() {
  const config = await readConfig();
  setupGitHubSyncAlarms(config);
  if (config.autoSync) scheduleAutomaticGitHubSync();
}

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== AUTO_SYNC_ALARM && alarm.name !== DEBOUNCED_SYNC_ALARM) return;
  void runAutomaticGitHubSync().catch(error => {
    console.warn(`${LOG_PREFIX} Automatic sync failed; the last valid local lists remain active:`, error);
  });
});

browser.runtime.onStartup.addListener(() => {
  void initializeGitHubSync();
});

browser.runtime.onInstalled.addListener(() => {
  void initializeGitHubSync();
});
