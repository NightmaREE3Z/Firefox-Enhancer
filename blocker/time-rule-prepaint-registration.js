// BraveFox Focus Master Time Rule pre-paint registration — 2026-08-21
// Firefox MV2 / Firefox Android equivalent of the standalone Chromium v1.2.0 guard.
// Registers only on configured Time Rule hosts, preserving instant full-navigation
// webRequest enforcement while covering document-start and SPA/history transitions.

import { browser } from './api.js';

const SCRIPT_FILE = 'blocker/time-rule-prepaint.js';
let registeredScript = null;
let refreshPromise = null;
let queuedSettings = null;

const WRAPPER_MATCHES = Object.freeze([
  '*://web.archive.org/*',
  '*://*.archive-it.org/*',
  '*://r.jina.ai/*',
  '*://12ft.io/*',
  '*://webcache.googleusercontent.com/*',
  '*://arquivo.pt/*',
  '*://*.arquivo.pt/*',
  '*://timetravel.mementoweb.org/*',
  '*://*.mementoweb.org/*',
  '*://translate.google.com/*',
  '*://translate.google.fi/*',
  '*://translate.google.co.uk/*',
  '*://translate.google.de/*',
  '*://translate.google.fr/*',
  '*://translate.google.nl/*',
  '*://translate.google.com.br/*'
]);

function rawRuleHost(link) {
  let raw = String(link || '').trim().toLocaleLowerCase('en-US');
  if (!raw) return '';
  raw = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return raw.split(/[/?#]/, 1)[0].replace(/:\d+$/, '').trim();
}

function isIpv4(host) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function matchPatternForHost(host) {
  const value = String(host || '').trim().toLocaleLowerCase('en-US');
  if (!value) return '';
  if (value.startsWith('*.') && !value.slice(2).includes('*')) return `*://${value}/*`;
  if (value.includes('*')) return '<all_urls>';
  if (value === 'localhost' || isIpv4(value) || value.startsWith('[')) return `*://${value}/*`;
  return `*://*.${value}/*`;
}

export function timeRulePrepaintMatches(settings) {
  const rules = [
    ...(Array.isArray(settings?.scheduledRules) ? settings.scheduledRules : []),
    ...(Array.isArray(settings?.quotaRules) ? settings.quotaRules : [])
  ].filter(rule => rule && rule.enabled !== false && rule.link);

  if (!rules.length) return [];
  const matches = new Set();
  for (const rule of rules) {
    const pattern = matchPatternForHost(rawRuleHost(rule.link));
    if (pattern === '<all_urls>') return ['<all_urls>'];
    if (pattern) matches.add(pattern);
  }
  for (const pattern of WRAPPER_MATCHES) matches.add(pattern);
  return [...matches];
}

async function unregisterCurrent() {
  if (!registeredScript) return;
  const current = registeredScript;
  registeredScript = null;
  try { await current.unregister(); } catch {}
}

async function applyRegistration(settings) {
  await unregisterCurrent();
  const matches = timeRulePrepaintMatches(settings);
  if (!matches.length) return true;
  if (!browser.contentScripts?.register) return false;

  registeredScript = await browser.contentScripts.register({
    matches,
    excludeMatches: ['*://twitch.tv/*', '*://*.twitch.tv/*'],
    js: [{ file: SCRIPT_FILE }],
    runAt: 'document_start',
    allFrames: false
  });
  return true;
}

export function refreshTimeRulePrepaintRegistration(settings) {
  queuedSettings = settings;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      while (queuedSettings) {
        const next = queuedSettings;
        queuedSettings = null;
        try {
          await applyRegistration(next);
        } catch (error) {
          console.warn('[BraveFox Focus Master] Firefox Time Rule pre-paint registration failed:', error);
        }
      }
    })().finally(() => {
      refreshPromise = null;
      if (queuedSettings) void refreshTimeRulePrepaintRegistration(queuedSettings);
    });
  }
  return refreshPromise;
}
