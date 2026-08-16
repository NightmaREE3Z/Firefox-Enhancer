import { parseListText, serializeListForKind } from './csv.js';
import { loadBundledFallbackLists, loadDataset, saveDataset } from './storage.js';
import { normalizeLinkForStorage, normalizeTerm, normalizeTldForStorage, uniqueInOrder } from './shared.js';
import { normalizeTrustedSiteEntry } from './trusted-sites.js';

const browser = globalThis.browser ?? globalThis.chrome;
const LOG_PREFIX = '[BraveFox Focus Master GitHub Sync]';
const CONFIG_KEY = 'bfb:github-sync-config';
const TOKEN_VAULT_KEY = 'bfb:github-token-vault-v1';
const TOKEN_VAULT_VERSION = 1;
const TOKEN_RECOVERY_KEY = 'bfb:github-token-recovery-v1';
const TOKEN_RECOVERY_VERSION = 1;
const STATE_KEY = 'bfb:github-sync-state';
const AUTO_SYNC_ALARM = 'bfb-github-auto-sync';
const DEBOUNCED_SYNC_ALARM = 'bfb-github-debounced-sync';
const AUTO_SYNC_INTERVAL_MINUTES = 15;
const DEBOUNCE_MS = 5000;
const REQUIRED_DATA_COLLECTION = Object.freeze(['authenticationInfo', 'browsingActivity', 'searchTerms']);

export const SYNC_PROFILES = Object.freeze({
  haukkis: Object.freeze({
    id: 'haukkis', label: 'Haukkis', termsFile: 'blockedTerms.csv',
    emails: Object.freeze(['xanaronnosucks@gmail.com', 'ripxanaronnov6@gmail.com'])
  }),
  tapsa: Object.freeze({
    id: 'tapsa', label: 'Tapsa', termsFile: 'blockedTermsDad.csv',
    emails: Object.freeze(['tapsa.hauki@gmail.com'])
  })
});

export const GITHUB_SYNC_TARGET = Object.freeze({
  owner: 'NightmaREE3Z', repository: 'Focus-Master', branch: 'BraveFox',
  files: Object.freeze({
    links: Object.freeze({ path: 'blocker/lists/blockedLinks.csv', rawUrl: 'https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/blocker/lists/blockedLinks.csv' }),
    tlds: Object.freeze({ path: 'blocker/lists/blockedTLDs.csv', rawUrl: 'https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/blocker/lists/blockedTLDs.csv' }),
    trustedSites: Object.freeze({ path: 'blocker/lists/TrustedSites.csv', rawUrl: 'https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/blocker/lists/TrustedSites.csv' })
  })
});

const DEFAULT_CONFIG = Object.freeze({
  autoSync: true, token: '', tokenRecovery: true, activeProfile: 'haukkis', profileExplicit: false,
  profileSwitchPending: false, previousProfile: '', detectedEmail: '',
  suggestedProfile: '', detectionAvailable: false
});
const DEFAULT_STATE = Object.freeze({
  termsProfile: 'haukkis', initializedProfiles: { haukkis: false, tapsa: false },
  initializedLinks: false, initializedTlds: false, initializedTrustedSites: false, pending: [],
  forceSnapshot: { links: false, tlds: false, trustedSites: false, terms: { haukkis: false, tapsa: false } },
  lastSyncAt: 0, lastAction: '', lastError: ''
});
let syncPromise = null;

function normalizeProfile(value) { return Object.hasOwn(SYNC_PROFILES, value) ? value : 'haukkis'; }
function profileForEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  for (const profile of Object.values(SYNC_PROFILES)) if (profile.emails.includes(normalized)) return profile.id;
  return '';
}
function normalizerFor(kind) {
  if (kind === 'links') return normalizeLinkForStorage;
  if (kind === 'tlds') return normalizeTldForStorage;
  if (kind === 'trustedSites') return normalizeTrustedSiteEntry;
  return normalizeTerm;
}
function normalizeKind(kind) {
  if (kind === 'terms' || kind === 'links' || kind === 'tlds' || kind === 'trustedSites') return kind;
  throw new Error('Unknown GitHub Focus Master list type.');
}
function termsTarget(profileId) {
  const profile = SYNC_PROFILES[normalizeProfile(profileId)];
  const path = `blocker/lists/${profile.termsFile}`;
  return { path, rawUrl: `https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/${path}` };
}
function fileFor(kind, profileId) { return kind === 'terms' ? termsTarget(profileId) : GITHUB_SYNC_TARGET.files[normalizeKind(kind)]; }

function normalizeConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    autoSync: source.autoSync !== false,
    token: String(source.token || '').trim(),
    tokenRecovery: source.tokenRecovery !== false,
    activeProfile: normalizeProfile(source.activeProfile),
    profileExplicit: Boolean(source.profileExplicit),
    profileSwitchPending: Boolean(source.profileSwitchPending),
    previousProfile: Object.hasOwn(SYNC_PROFILES, source.previousProfile) ? source.previousProfile : '',
    detectedEmail: String(source.detectedEmail || '').trim().toLowerCase(),
    suggestedProfile: Object.hasOwn(SYNC_PROFILES, source.suggestedProfile) ? source.suggestedProfile : '',
    detectionAvailable: Boolean(source.detectionAvailable)
  };
}

function normalizeState(value, activeProfile = 'haukkis') {
  const source = value && typeof value === 'object' ? value : {};
  const termsProfile = normalizeProfile(source.termsProfile || activeProfile);
  const pending = [];
  for (const item of Array.isArray(source.pending) ? source.pending : []) {
    if (!item || !['terms', 'links', 'tlds', 'trustedSites'].includes(item.kind)) continue;
    if (item.action !== 'add' && item.action !== 'remove') continue;
    const normalized = normalizerFor(item.kind)(item.value);
    if (!normalized) continue;
    pending.push({
      id: String(item.id || `${Date.now()}-${Math.random()}`),
      kind: item.kind,
      profile: item.kind === 'terms' ? normalizeProfile(item.profile || termsProfile) : 'global',
      action: item.action,
      value: normalized,
      createdAt: Number(item.createdAt) || Date.now()
    });
  }
  const initializedProfiles = {
    haukkis: Boolean(source.initializedProfiles?.haukkis),
    tapsa: Boolean(source.initializedProfiles?.tapsa)
  };
  if (source.initialized === true) initializedProfiles[termsProfile] = true;
  return {
    termsProfile,
    initializedProfiles,
    initializedLinks: Boolean(source.initializedLinks ?? source.initialized),
    initializedTlds: Boolean(source.initializedTlds),
    initializedTrustedSites: Boolean(source.initializedTrustedSites),
    pending,
    forceSnapshot: {
      links: Boolean(source.forceSnapshot?.links),
      tlds: Boolean(source.forceSnapshot?.tlds),
      trustedSites: Boolean(source.forceSnapshot?.trustedSites),
      terms: {
        haukkis: Boolean(source.forceSnapshot?.terms?.haukkis ?? (source.forceSnapshot?.terms === true && termsProfile === 'haukkis')),
        tapsa: Boolean(source.forceSnapshot?.terms?.tapsa ?? (source.forceSnapshot?.terms === true && termsProfile === 'tapsa'))
      }
    },
    lastSyncAt: Number(source.lastSyncAt) || 0,
    lastAction: String(source.lastAction || ''),
    lastError: String(source.lastError || '')
  };
}

function normalizeToken(value) { return String(value || '').trim(); }
function tokenVaultRecord(token) {
  return {
    version: TOKEN_VAULT_VERSION,
    token: normalizeToken(token),
    updatedAt: Date.now()
  };
}
function tokenRecoveryRecord(token) {
  return {
    version: TOKEN_RECOVERY_VERSION,
    token: normalizeToken(token),
    updatedAt: Date.now(),
    extensionId: String(browser.runtime?.id || '')
  };
}
function syncStorageArea() {
  const area = browser.storage?.sync;
  return area && typeof area.get === 'function' && typeof area.set === 'function' && typeof area.remove === 'function'
    ? area
    : null;
}
async function restrictRecoveryStorage(area) {
  if (!area || typeof area.setAccessLevel !== 'function') return;
  try { await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }); } catch {}
}
async function readTokenRecovery() {
  const area = syncStorageArea();
  if (!area) return { supported: false, hasRecord: false, token: '', error: '' };
  try {
    await restrictRecoveryStorage(area);
    const result = await area.get(TOKEN_RECOVERY_KEY);
    const record = result?.[TOKEN_RECOVERY_KEY];
    const hasRecord = Boolean(record && typeof record === 'object' && Object.hasOwn(record, 'token'));
    return { supported: true, hasRecord, token: hasRecord ? normalizeToken(record.token) : '', error: '' };
  } catch (error) {
    return { supported: true, hasRecord: false, token: '', error: String(error?.message || error) };
  }
}
async function writeTokenRecovery(token) {
  const area = syncStorageArea();
  if (!area) return { supported: false, ready: false, error: 'Browser sync storage is unavailable.' };
  try {
    await restrictRecoveryStorage(area);
    await area.set({ [TOKEN_RECOVERY_KEY]: tokenRecoveryRecord(token) });
    return { supported: true, ready: Boolean(normalizeToken(token)), error: '' };
  } catch (error) {
    return { supported: true, ready: false, error: String(error?.message || error) };
  }
}
async function clearTokenRecovery() {
  const area = syncStorageArea();
  if (!area) return { supported: false, ready: false, error: '' };
  try {
    await restrictRecoveryStorage(area);
    await area.remove(TOKEN_RECOVERY_KEY);
    return { supported: true, ready: false, error: '' };
  } catch (error) {
    return { supported: true, ready: false, error: String(error?.message || error) };
  }
}

async function readConfigRecord() {
  const [result, recovery] = await Promise.all([
    browser.storage.local.get([CONFIG_KEY, TOKEN_VAULT_KEY]),
    readTokenRecovery()
  ]);
  const raw = result[CONFIG_KEY];
  const vault = result[TOKEN_VAULT_KEY];
  const hasVaultRecord = Boolean(vault && typeof vault === 'object' && Object.hasOwn(vault, 'token'));
  const legacyToken = normalizeToken(raw?.token);
  const vaultToken = hasVaultRecord ? normalizeToken(vault.token) : '';
  const recoveryEnabled = raw?.tokenRecovery !== false;
  const recoveryToken = recoveryEnabled && recovery.hasRecord ? normalizeToken(recovery.token) : '';
  const recoveredFromBrowserSync = !hasVaultRecord && !legacyToken && Boolean(recoveryToken);
  const resolvedToken = hasVaultRecord ? vaultToken : (legacyToken || recoveryToken);
  const config = normalizeConfig({ ...(raw || DEFAULT_CONFIG), token: resolvedToken, tokenRecovery: recoveryEnabled });
  const repairs = {};

  // Local storage remains authoritative while the extension is installed. The
  // browser-sync copy is only a reinstall recovery layer for the same add-on ID.
  // An intentionally empty local vault also clears a stale recovery copy.
  if (!hasVaultRecord && resolvedToken) repairs[TOKEN_VAULT_KEY] = tokenVaultRecord(resolvedToken);
  if (normalizeToken(raw?.token) !== resolvedToken || raw?.tokenRecovery !== config.tokenRecovery) repairs[CONFIG_KEY] = config;
  if (Object.keys(repairs).length) await browser.storage.local.set(repairs);

  let recoveryState = recovery;
  if (config.tokenRecovery) {
    if (resolvedToken && recovery.token !== resolvedToken) recoveryState = await writeTokenRecovery(resolvedToken);
    else if (!resolvedToken && recovery.hasRecord) recoveryState = await clearTokenRecovery();
  } else if (recovery.hasRecord) recoveryState = await clearTokenRecovery();

  return {
    config,
    hasProfileSetting: Boolean(raw && Object.hasOwn(raw, 'activeProfile')),
    tokenVaultReady: hasVaultRecord || Boolean(resolvedToken),
    recoveredFromBrowserSync,
    recoverySupported: recoveryState.supported !== false,
    recoveryReady: Boolean(config.tokenRecovery && resolvedToken && (recoveryState.ready || recoveryState.hasRecord || recovery.token === resolvedToken)),
    recoveryError: String(recoveryState.error || '')
  };
}
async function readConfig() { return (await readConfigRecord()).config; }
async function writeConfig(config, { persistToken = false, reconcileRecovery = false } = {}) {
  const clean = normalizeConfig(config);
  const changes = { [CONFIG_KEY]: clean };
  if (persistToken) changes[TOKEN_VAULT_KEY] = tokenVaultRecord(clean.token);
  await browser.storage.local.set(changes);
  if (persistToken || reconcileRecovery) {
    if (clean.tokenRecovery && clean.token) await writeTokenRecovery(clean.token);
    else await clearTokenRecovery();
  }
  return clean;
}
async function readState(config = null) { const current = config || await readConfig(); const result = await browser.storage.local.get(STATE_KEY); return normalizeState(result[STATE_KEY] || DEFAULT_STATE, current.activeProfile); }
async function writeState(state, config = null) { const current = config || await readConfig(); const clean = normalizeState(state, current.activeProfile); await browser.storage.local.set({ [STATE_KEY]: clean }); return clean; }

async function detectBrowserProfileEmail() {
  const identity = browser.identity;
  if (!identity?.getProfileUserInfo) return { available: false, email: '', profile: '' };
  const info = await new Promise(resolve => {
    let finished = false;
    const done = value => { if (!finished) { finished = true; resolve(value || {}); } };
    try {
      const maybe = identity.getProfileUserInfo({ accountStatus: 'ANY' }, done);
      if (maybe?.then) maybe.then(done).catch(() => done({}));
    } catch {
      try { identity.getProfileUserInfo(done); } catch { done({}); }
    }
    setTimeout(() => done({}), 1500);
  });
  const email = String(info?.email || '').trim().toLowerCase();
  return { available: true, email, profile: profileForEmail(email) };
}

async function refreshProfileDetection({ allowInitialSelection = false, includeRecord = false } = {}) {
  const record = await readConfigRecord();
  let config = record.config;
  const detected = await detectBrowserProfileEmail();
  const patch = { ...config, detectionAvailable: detected.available, detectedEmail: detected.email };
  if (detected.profile) {
    if (allowInitialSelection && !record.hasProfileSetting && !config.profileExplicit) {
      patch.activeProfile = detected.profile;
      patch.suggestedProfile = '';
    } else if (detected.profile !== config.activeProfile) patch.suggestedProfile = detected.profile;
    else patch.suggestedProfile = '';
  } else patch.suggestedProfile = '';
  config = await writeConfig(patch);
  return includeRecord ? { config, record } : config;
}

function apiUrl(kind, profileId) {
  const file = fileFor(normalizeKind(kind), profileId);
  const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(GITHUB_SYNC_TARGET.owner)}/${encodeURIComponent(GITHUB_SYNC_TARGET.repository)}/contents/${encodedPath}`;
}
function githubHeaders(token = '') { const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; if (token) headers.Authorization = `Bearer ${token}`; return headers; }
function encodeBase64Utf8(text) { const bytes = new TextEncoder().encode(String(text || '')); let binary=''; for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(binary); }
function decodeBase64Utf8(base64) { const binary=atob(String(base64||'').replace(/\s+/g,'')); const bytes=new Uint8Array(binary.length); for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i); return new TextDecoder().decode(bytes); }

async function fetchRawKind(kind, profileId) {
  const file = fileFor(normalizeKind(kind), profileId);
  const response = await fetch(`${file.rawUrl}?bravefox_refresh=${Date.now()}`, { cache:'no-store', credentials:'omit', headers:{Accept:'text/plain'} });
  if (!response.ok) {
    const error = new Error(`GitHub raw ${kind} download failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return parseListText(await response.text(), kind);
}
async function fetchRawLists({ profileId = 'haukkis', bundledFallback = false } = {}) {
  const profile = normalizeProfile(profileId);
  const kinds = ['terms', 'links', 'tlds', 'trustedSites'];
  const results = await Promise.allSettled(kinds.map(kind => fetchRawKind(kind, profile)));
  const output = { profile, usedBundledFallback: false };
  let bundled = null;
  for (let index = 0; index < kinds.length; index += 1) {
    const kind = kinds[index];
    if (results[index].status === 'fulfilled') output[kind] = results[index].value;
    else if (bundledFallback) {
      bundled ||= await loadBundledFallbackLists(profile);
      output[kind] = bundled[kind];
      output.usedBundledFallback = true;
    } else {
      throw results[index].reason || new Error(`GitHub ${kind} download failed.`);
    }
  }
  return output;
}

async function fetchApiKind(kind, token, profileId) {
  const response = await fetch(`${apiUrl(kind, profileId)}?ref=${encodeURIComponent(GITHUB_SYNC_TARGET.branch)}`, { cache:'no-store', credentials:'omit', headers:githubHeaders(token) });
  if (response.status === 404) return { exists:false, sha:'', values:[] };
  if (!response.ok) { const detail=await response.text().catch(()=> ''); throw new Error(`GitHub API ${kind} read failed (HTTP ${response.status})${detail?`: ${detail.slice(0,180)}`:''}`); }
  const payload=await response.json();
  if (payload?.type !== 'file' || typeof payload.content !== 'string') throw new Error(`GitHub ${kind} path is not a readable file.`);
  return { exists:true, sha:String(payload.sha||''), values:parseListText(decodeBase64Utf8(payload.content),kind) };
}
async function putApiKind(kind, token, values, sha, profileId) {
  const file=fileFor(kind,profileId);
  const body={ message:`Sync BraveFox Focus Master ${file.path.split('/').pop()}`, content:encodeBase64Utf8(serializeListForKind(values, kind)), branch:GITHUB_SYNC_TARGET.branch };
  if (sha) body.sha=sha;
  const response=await fetch(apiUrl(kind,profileId),{method:'PUT',credentials:'omit',headers:{...githubHeaders(token),'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (response.status===409 || response.status===422) { const error=new Error(`GitHub ${kind} update conflicted with a newer revision.`); error.code='conflict'; throw error; }
  if (!response.ok) { const detail=await response.text().catch(()=> ''); throw new Error(`GitHub ${kind} upload failed (HTTP ${response.status})${detail?`: ${detail.slice(0,180)}`:''}`); }
  return response.json();
}
function arraysEqual(left,right){return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((v,i)=>v===right[i]);}
async function saveDatasetIfChanged(current, next, profile) {
  const terms = uniqueInOrder(next.terms, normalizeTerm);
  const links = uniqueInOrder(next.links, normalizeLinkForStorage);
  const tlds = uniqueInOrder(next.tlds, normalizeTldForStorage);
  const trustedSites = uniqueInOrder(next.trustedSites, normalizeTrustedSiteEntry);
  const normalizedProfile = normalizeProfile(profile || current?.profile);
  if (
    arraysEqual(current?.terms, terms) &&
    arraysEqual(current?.links, links) &&
    arraysEqual(current?.tlds, tlds) &&
    arraysEqual(current?.trustedSites, trustedSites) &&
    current?.profile === normalizedProfile
  ) return current;
  return saveDataset({ terms, links, tlds, trustedSites, profile: normalizedProfile });
}
function scopeFor(kind, profile) { return kind === 'terms' ? normalizeProfile(profile) : 'global'; }
function pendingFor(state, kind, profile) {
  const scope = scopeFor(kind, profile);
  return state.pending.filter(item => item.kind === kind && item.profile === scope);
}
function forceFor(state, kind, profile) {
  if (kind === 'terms') return Boolean(state.forceSnapshot.terms[normalizeProfile(profile)]);
  return Boolean(state.forceSnapshot[kind]);
}
function setForce(state, kind, profile, value) {
  const next = {
    ...state,
    forceSnapshot: {
      links: Boolean(state.forceSnapshot.links),
      tlds: Boolean(state.forceSnapshot.tlds),
      trustedSites: Boolean(state.forceSnapshot.trustedSites),
      terms: { ...state.forceSnapshot.terms }
    }
  };
  if (kind === 'terms') next.forceSnapshot.terms[normalizeProfile(profile)] = Boolean(value);
  else next.forceSnapshot[kind] = Boolean(value);
  return next;
}
function clearPending(state, kind, profile) {
  const scope = scopeFor(kind, profile);
  return setForce({ ...state, pending: state.pending.filter(item => !(item.kind === kind && item.profile === scope)) }, kind, profile, false);
}
function applyOperations(values, kind, operations) {
  const normalize = normalizerFor(kind);
  let next = uniqueInOrder(values, normalize);
  for (const op of operations) {
    const value = normalize(op.value);
    if (!value) continue;
    if (op.action === 'remove') next = next.filter(item => normalize(item) !== value);
    else if (!next.some(item => normalize(item) === value)) next.push(value);
  }
  return next;
}

async function hasRequiredDataConsent(){const manifest=browser.runtime.getManifest();if(!manifest?.browser_specific_settings?.gecko)return true;try{const permissions=await browser.permissions.getAll();const granted=new Set(Array.isArray(permissions.data_collection)?permissions.data_collection:[]);return REQUIRED_DATA_COLLECTION.every(item=>granted.has(item));}catch{return false;}}
async function uploadExactKind(kind,token,values,profile){for(let attempt=0;attempt<3;attempt++){const remote=await fetchApiKind(kind,token,profile);try{await putApiKind(kind,token,uniqueInOrder(values,normalizerFor(kind)),remote.sha,profile);return uniqueInOrder(values,normalizerFor(kind));}catch(error){if(error.code!=='conflict'||attempt===2)throw error;}}return values;}
async function uploadMergedKind(kind,token,current,state,profile){for(let attempt=0;attempt<3;attempt++){const remote=await fetchApiKind(kind,token,profile);const values=forceFor(state,kind,profile)?uniqueInOrder(current,normalizerFor(kind)):applyOperations(remote.values,kind,pendingFor(state,kind,profile));try{await putApiKind(kind,token,values,remote.sha,profile);return values;}catch(error){if(error.code!=='conflict'||attempt===2)throw error;}}return current;}
async function setStatus(state,{action='',error='',synced=false}={}){return writeState({...state,lastAction:action||state.lastAction,lastError:String(error||''),lastSyncAt:synced?Date.now():state.lastSyncAt});}

export async function getGitHubSyncStatus(){
  const refreshed=await refreshProfileDetection({includeRecord:true});
  const config=refreshed.config;
  const record=refreshed.record;
  const state=await readState(config);
  const profile=SYNC_PROFILES[config.activeProfile];
  return {
    autoSync:config.autoSync,hasToken:Boolean(config.token),tokenRecovery:config.tokenRecovery,recoverySupported:record.recoverySupported,recoveryReady:record.recoveryReady,recoveredFromBrowserSync:record.recoveredFromBrowserSync,recoveryError:record.recoveryError,activeProfile:config.activeProfile,activeProfileLabel:profile.label,
    termsProfile:state.termsProfile,termsProfileLabel:SYNC_PROFILES[state.termsProfile].label,
    profileSwitchPending:config.profileSwitchPending,suggestedProfile:config.suggestedProfile,
    suggestedProfileLabel:config.suggestedProfile?SYNC_PROFILES[config.suggestedProfile].label:'',
    detectedEmail:config.detectedEmail,detectionAvailable:config.detectionAvailable,
    profiles:Object.values(SYNC_PROFILES).map(item=>({id:item.id,label:item.label,termsFile:item.termsFile,emails:[...item.emails]})),
    pendingCount:state.pending.length+
      Number(state.forceSnapshot.links)+Number(state.forceSnapshot.tlds)+Number(state.forceSnapshot.trustedSites)+
      Number(state.forceSnapshot.terms.haukkis)+Number(state.forceSnapshot.terms.tapsa),
    lastSyncAt:state.lastSyncAt,lastAction:state.lastAction,lastError:state.lastError,
    target:{owner:GITHUB_SYNC_TARGET.owner,repository:GITHUB_SYNC_TARGET.repository,branch:GITHUB_SYNC_TARGET.branch,files:{
      terms:termsTarget(config.activeProfile),
      links:GITHUB_SYNC_TARGET.files.links,
      tlds:GITHUB_SYNC_TARGET.files.tlds,
      trustedSites:GITHUB_SYNC_TARGET.files.trustedSites
    }}
  };
}

export async function saveGitHubSyncConfig(patch={}){
  let config=await readConfig();
  const next={...config};
  if(Object.hasOwn(patch,'autoSync'))next.autoSync=patch.autoSync!==false;
  const tokenRecoveryChanged=Object.hasOwn(patch,'tokenRecovery')&&Boolean(patch.tokenRecovery)!==config.tokenRecovery;
  if(Object.hasOwn(patch,'tokenRecovery'))next.tokenRecovery=Boolean(patch.tokenRecovery);
  let tokenChanged=false;
  if(patch.clearToken){next.token='';tokenChanged=true;}
  else if(String(patch.token||'').trim()){next.token=String(patch.token).trim();tokenChanged=true;}
  if(Object.hasOwn(SYNC_PROFILES, patch.activeProfile)){
    const requested=normalizeProfile(patch.activeProfile);
    if(requested!==config.activeProfile){
      if(!patch.confirmProfileSwitch)throw new Error(`Confirm switching Sync Profile from ${SYNC_PROFILES[config.activeProfile].label} to ${SYNC_PROFILES[requested].label}.`);
      next.previousProfile=config.activeProfile; next.activeProfile=requested; next.profileSwitchPending=true; next.profileExplicit=true; next.suggestedProfile='';
    } else if(patch.profileExplicit) next.profileExplicit=true;
  }
  config=await writeConfig(next,{persistToken:tokenChanged,reconcileRecovery:tokenChanged||tokenRecoveryChanged}); setupGitHubSyncAlarms(config); return getGitHubSyncStatus();
}

export async function queueRemoteOperation(kind,action,value){
  normalizeKind(kind); if(action!=='add'&&action!=='remove')throw new Error('Unknown GitHub queue operation.');
  const config=await readConfig(); let state=await readState(config); const profile=kind==='terms'?state.termsProfile:'global'; const normalized=normalizerFor(kind)(value); if(!normalized)return state;
  state.pending=state.pending.filter(item=>!(item.kind===kind&&item.profile===profile&&normalizerFor(kind)(item.value)===normalized));
  state.pending.push({id:`${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`,kind,profile,action,value:normalized,createdAt:Date.now()});
  state=await writeState(state,config); if(config.autoSync)scheduleAutomaticGitHubSync(); return state;
}
export async function queueRemoteSnapshot(kind){
  normalizeKind(kind); const config=await readConfig(); let state=await readState(config); const profile=kind==='terms'?state.termsProfile:'global';
  state=setForce(state,kind,profile,true); state.pending=state.pending.filter(item=>!(item.kind===kind&&item.profile===profile)); state=await writeState(state,config); if(config.autoSync)scheduleAutomaticGitHubSync(); return state;
}
export function scheduleAutomaticGitHubSync(){try{browser.alarms.clear(DEBOUNCED_SYNC_ALARM);browser.alarms.create(DEBOUNCED_SYNC_ALARM,{when:Date.now()+DEBOUNCE_MS});}catch{}}

export async function downloadGitHubLists({allowBundledFallback=true}={}){
  let config=await readConfig();
  const profile=config.activeProfile;
  const downloaded=await fetchRawLists({profileId:profile,bundledFallback:allowBundledFallback});
  const dataset=await saveDataset({
    terms:downloaded.terms,links:downloaded.links,tlds:downloaded.tlds,
    trustedSites:downloaded.trustedSites,profile
  });
  let state=await readState(config);
  for(const kind of ['terms','links','tlds','trustedSites']) state=clearPending(state,kind,kind==='terms'?profile:'global');
  state.termsProfile=profile;
  state.initializedProfiles[profile]=true;
  state.initializedLinks=true;
  state.initializedTlds=true;
  state.initializedTrustedSites=true;
  state=await setStatus(state,{action:downloaded.usedBundledFallback?'Loaded packaged fallback lists':'Downloaded from GitHub',synced:true});
  config=await writeConfig({...config,profileSwitchPending:false,previousProfile:''});
  return {dataset,state,usedBundledFallback:downloaded.usedBundledFallback};
}

export async function uploadGitHubLists(){
  let config=await readConfig();
  if(!config.token)throw new Error('Enter and save a fine-grained GitHub token before uploading.');
  if(!(await hasRequiredDataConsent()))throw new Error('GitHub upload permission has not been granted.');
  const profile=config.activeProfile;
  const local=await loadDataset({force:true});
  let state=await readState(config);
  const uploaded={};
  for(const kind of ['terms','links','tlds','trustedSites']){
    const scope=kind==='terms'?profile:'global';
    uploaded[kind]=await uploadExactKind(kind,config.token,local[kind],scope);
    state=clearPending(state,kind,scope);
    await writeState(state,config);
  }
  state.termsProfile=profile;
  state.initializedProfiles[profile]=true;
  state.initializedLinks=true;
  state.initializedTlds=true;
  state.initializedTrustedSites=true;
  state=await setStatus(state,{action:'Uploaded to GitHub',synced:true});
  config=await writeConfig({...config,profileSwitchPending:false,previousProfile:''});
  const dataset=await saveDatasetIfChanged(local,uploaded,profile);
  return {dataset,state};
}

function isInitializedKind(state,kind,profile){
  if(kind==='terms') return Boolean(state.initializedProfiles[normalizeProfile(profile)]);
  if(kind==='links') return Boolean(state.initializedLinks);
  if(kind==='tlds') return Boolean(state.initializedTlds);
  if(kind==='trustedSites') return Boolean(state.initializedTrustedSites);
  return false;
}
function markInitializedKind(state,kind,profile){
  if(kind==='terms') state.initializedProfiles[normalizeProfile(profile)]=true;
  else if(kind==='links') state.initializedLinks=true;
  else if(kind==='tlds') state.initializedTlds=true;
  else if(kind==='trustedSites') state.initializedTrustedSites=true;
  return state;
}

async function initializeKind(kind,profile,current,state,canUpload){
  let remote;
  let missingRemote=false;
  try {
    remote=await fetchRawKind(kind,profile);
  } catch(error) {
    const bundled=await loadBundledFallbackLists(profile);
    remote=bundled[kind];
    missingRemote=Number(error?.status)===404;
  }
  const normalize=normalizerFor(kind);
  const merged=uniqueInOrder([...remote,...current],normalize);
  const remoteSet=new Set(remote.map(normalize));
  const hasLocalExtra=current.some(value=>!remoteSet.has(normalize(value)));
  state=setForce(state,kind,profile,hasLocalExtra);
  state=markInitializedKind(state,kind,profile);
  if((hasLocalExtra||missingRemote)&&canUpload){
    const uploaded=await uploadExactKind(kind,(await readConfig()).token,merged,profile);
    state=clearPending(state,kind,profile);
    return{values:uploaded,state,uploaded:true};
  }
  return{
    values:merged,
    state,
    warning:missingRemote?'The GitHub list does not exist yet; the packaged/local copy remains active until an upload creates it.':''
  };
}

async function syncKind(kind,profile,current,state,canUpload){
  const hasPending=forceFor(state,kind,profile)||pendingFor(state,kind,profile).length>0;
  if(hasPending&&canUpload){
    const values=await uploadMergedKind(kind,(await readConfig()).token,current,state,profile);
    return{values,state:clearPending(state,kind,profile),uploaded:true};
  }
  let remote;
  try {
    remote=await fetchRawKind(kind,profile);
  } catch(error) {
    if(Number(error?.status)!==404) throw error;
    if(canUpload){
      const values=await uploadExactKind(kind,(await readConfig()).token,current,profile);
      return{values,state:clearPending(state,kind,profile),uploaded:true};
    }
    return{values:current,state,warning:'The GitHub list does not exist yet; the current local copy remains active until an upload creates it.'};
  }
  if(hasPending){
    const values=forceFor(state,kind,profile)?current:applyOperations(remote,kind,pendingFor(state,kind,profile));
    return{values,state,warning:'Pending changes are local until a token and upload consent are available.'};
  }
  return{values:remote,state};
}

async function runAutomaticSyncInternal(){
  let config=await refreshProfileDetection();
  if(!config.autoSync)return{skipped:true,reason:'Automatic sync is disabled.'};
  let state=await readState(config);
  const local=await loadDataset({force:true});
  const canUpload=Boolean(config.token)&&await hasRequiredDataConsent();
  const termsEnabled=!config.profileSwitchPending&&state.termsProfile===config.activeProfile;
  const next={terms:local.terms,links:local.links,tlds:local.tlds,trustedSites:local.trustedSites};
  let warning='';
  let uploaded=false;
  try{
    if(termsEnabled){
      const kind='terms';
      const profile=config.activeProfile;
      const result=!isInitializedKind(state,kind,profile)
        ? await initializeKind(kind,profile,next[kind],state,canUpload)
        : await syncKind(kind,profile,next[kind],state,canUpload);
      next[kind]=result.values;state=result.state;warning=warning||result.warning||'';uploaded=uploaded||Boolean(result.uploaded);
    } else if(config.profileSwitchPending) {
      warning=`Sync Profile changed to ${SYNC_PROFILES[config.activeProfile].label}; terms remain on ${SYNC_PROFILES[state.termsProfile].label} until manual Download or Upload.`;
    }

    for(const kind of ['links','tlds','trustedSites']){
      const result=!isInitializedKind(state,kind,'global')
        ? await initializeKind(kind,'global',next[kind],state,canUpload)
        : await syncKind(kind,'global',next[kind],state,canUpload);
      next[kind]=result.values;state=result.state;warning=warning||result.warning||'';uploaded=uploaded||Boolean(result.uploaded);
    }

    state=await writeState(state,config);
    const dataset=await saveDatasetIfChanged(local,next,state.termsProfile);
    state=await setStatus(state,{action:uploaded?'Automatic GitHub upload':'Automatic GitHub download',error:warning,synced:true});
    return{dataset,state,direction:uploaded?'upload':'download'};
  }catch(error){
    state=await setStatus(state,{action:state.lastAction||'Automatic GitHub sync',error:String(error?.message||error),synced:false});
    throw error;
  }
}
export async function runAutomaticGitHubSync(){if(syncPromise)return syncPromise;syncPromise=runAutomaticSyncInternal().finally(()=>{syncPromise=null;});return syncPromise;}
function setupGitHubSyncAlarms(config=DEFAULT_CONFIG){if(config.autoSync)browser.alarms.create(AUTO_SYNC_ALARM,{periodInMinutes:AUTO_SYNC_INTERVAL_MINUTES});else{void browser.alarms.clear(AUTO_SYNC_ALARM);void browser.alarms.clear(DEBOUNCED_SYNC_ALARM);}}
export async function initializeGitHubSync(){const config=await refreshProfileDetection({allowInitialSelection:true});const state=await readState(config);if(!state.termsProfile)state.termsProfile=config.activeProfile;await writeState(state,config);setupGitHubSyncAlarms(config);if(config.autoSync)scheduleAutomaticGitHubSync();return getGitHubSyncStatus();}
browser.alarms.onAlarm.addListener(alarm=>{if(alarm.name!==AUTO_SYNC_ALARM&&alarm.name!==DEBOUNCED_SYNC_ALARM)return;void runAutomaticGitHubSync().catch(error=>console.warn(`${LOG_PREFIX} Automatic sync failed; the last valid local lists remain active:`,error));});
browser.runtime.onStartup.addListener(()=>{void initializeGitHubSync();});
browser.runtime.onInstalled.addListener(()=>{void initializeGitHubSync();});
