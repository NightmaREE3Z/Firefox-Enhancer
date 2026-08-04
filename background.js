// BraveFox Enhancer unified Firefox background entry point.
// Shared by Firefox PC/ESR and Firefox Android/Fenix Nightly.
// Platform-exclusive behavior lives in modules/pc-esr.js and modules/fenix-nightly.js.

import "./blocker/service.js";

const LOG_PREFIX = "[BraveFox Background]";
const HOSTS_META_KEY = "bravefoxHostsMetaV2";
const HOSTS_CHUNK_PREFIX = "bravefoxHostsChunkV2";
const HOSTS_SCHEMA_VERSION = 2;
const HOSTS_STORAGE_CHUNK_SIZE = 5000;
const HOSTS_PARSE_YIELD_EVERY = 1000;
const HOSTS_UPDATE_INTERVAL_MINUTES = 60;
const WRESTLING_UPDATE_INTERVAL_MINUTES = 12 * 60;
const MAX_FETCH_RETRIES = 3;
const HOSTS_UPDATE_ALARM = "bravefox-hosts-update";
const WRESTLING_UPDATE_ALARM = "bravefox-wrestling-update";

// Canonical source priority. First source wins when a hostname appears more than once.
const HOSTS_SOURCES = [
  {
    id: "BraveFoxHosts",
    url: "https://raw.githubusercontent.com/NightmaREE3Z/BraveFox-Enhancer/refs/heads/v27-release/hosts/BraveFoxHosts"
  },
  {
    id: "StevenBlack",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-porn/hosts"
  },
  {
    id: "LegacyFox",
    url: "https://raw.githubusercontent.com/NightmaREE3Z/BraveFox-Enhancer/refs/heads/v27-release/hosts/Legacy/legacyFox"
  }
];

const ALLOWED_SITES = new Set([
  "sieni.us",
  "sieni.es"
]);

// Canonical union of the former PC and Android TLD lists so both platforms enforce the same policy.
const BLOCKED_TLDS = [
  ".ai",
  ".art",
  ".io",
  ".makeup",
  ".off",
  ".club",
  ".id",
  ".it",
  ".best",
  ".cc",
  ".cn",
  ".click",
  ".you",
  ".to",
  ".top",
  ".me",
  ".us",
  ".ru",
  ".vip",
  ".online",
  ".hot",
  ".her",
  ".sex",
  ".xxx",
  ".nsfw",
  ".porn",
  ".show",
  ".work",
  ".fit",
  ".tool",
  ".tools",
  ".system",
  ".systems",
  ".surf",
  ".review",
  ".asia",
  ".tokyo",
  ".monster",
  ".info",
  ".机构",
  ".xn--nqv7f",
  ".one",
  ".ee",
  ".in",
  ".gf",
  ".fox",
  ".fun",
  ".exposed",
  ".fyi",
  ".fr",
  ".life",
  ".now",
  ".today",
  ".world",
  ".xyz",
  ".zone",
  ".nude",
  ".cat",
  ".bot",
  ".moe"
];

// Existing PC static URL policy, now shared by both Firefox platforms.
const STATIC_BLOCK_PATTERNS = [
  "*://www.lunapic.com/*",
  "*://www9.lunapic.com/*",
  "*://www9.lunapic.com/editor/*",
  "*://pixelixe.com/*",
  "*://picresize.com/*",
  "*://microsoft365.com/*",
  "*://microsoft.com/fi-fi/edge/business/download*",
  "*://microsoft.com/fi-fi/edge/business*",
  "*://microsoft.com/fi-fi/edge/*",
  "*://microsoft.com/fi-fi/edge/business/download?cs=3457492030&form=MA13FJ*",
  "*://uptodown.com/windows/browsing*",
  "*://uptodown.com/windows/internet*",
  "*://uptodown.com/windows/web-browsers*",
  "*://en.uptodown.com/windows/web-browsers*",
  "*://uptodown.com/windows/browsers*",
  "*://uptodown.com/windows/internet-browsers*",
  "*://uptodown.com/windows/browser*",
  "*://uptodown.com/windows/web-navigators*",
  "*://uptodown.com/windows/navigators*",
  "*://uptodown.com/windows/networking*",
  "*://uptodown.com/windows/networking/browsers*",
  "*://uptodown.com/windows/google-chrome*",
  "*://google-chrome.uptodown.com/*",
  "*://google-chrome.en.uptodown.com/*",
  "*://google-chrome.en.uptodown.com/windows*",
  "*://google-chrome-portable.uptodown.com/*",
  "*://google-chrome-portable.en.uptodown.com/*",
  "*://uptodown.com/windows/mozilla-firefox*",
  "*://mozilla-firefox.uptodown.com/*",
  "*://mozilla-firefox.en.uptodown.com/*",
  "*://mozilla-firefox.en.uptodown.com/windows*",
  "*://uptodown.com/windows/microsoft-edge*",
  "*://microsoft-edge.uptodown.com/*",
  "*://microsoft-edge.en.uptodown.com/*",
  "*://microsoft-edge.en.uptodown.com/windows*",
  "*://uptodown.com/windows/opera*",
  "*://opera.uptodown.com/*",
  "*://opera.en.uptodown.com/*",
  "*://opera.en.uptodown.com/windows*",
  "*://uptodown.com/windows/brave*",
  "*://uptodown.com/windows/brave-browser*",
  "*://brave-browser.uptodown.com/*",
  "*://brave-browser.en.uptodown.com/*",
  "*://brave-browser-nightly.uptodown.com/*",
  "*://brave-browser-nightly.en.uptodown.com/*",
  "*://uptodown.com/windows/tor-browser*",
  "*://tor.uptodown.com/*",
  "*://tor.en.uptodown.com/*",
  "*://tor.uptodown.com/windows*",
  "*://tor.en.uptodown.com/windows*",
  "*://safari.uptodown.com/*",
  "*://safari.en.uptodown.com/*",
  "*://safari.en.uptodown.com/windows*",
  "*://uptodown.com/windows/cent-browser*",
  "*://cent-browser.uptodown.com/*",
  "*://cent-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/librewolf*",
  "*://librewolf.uptodown.com/*",
  "*://librewolf.en.uptodown.com/*",
  "*://uptodown.com/windows/internet-explorer*",
  "*://internet-explorer.uptodown.com/*",
  "*://internet-explorer.en.uptodown.com/*",
  "*://uptodown.com/windows/ccleaner-browser*",
  "*://ccleaner-browser.uptodown.com/*",
  "*://ccleaner-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/chromium*",
  "*://chromium.uptodown.com/*",
  "*://chromium.en.uptodown.com/*",
  "*://chromium.uptodown.com/windows*",
  "*://chromium.en.uptodown.com/windows*",
  "*://uptodown.com/windows/epic-browser*",
  "*://epic-browser.uptodown.com/*",
  "*://epic-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/theworld-browser*",
  "*://theworld-browser.uptodown.com/*",
  "*://theworld-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/avant-browser*",
  "*://avant-browser.uptodown.com/*",
  "*://avant-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/thorium-browser*",
  "*://thorium-browser.uptodown.com/*",
  "*://thorium-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/square-1-web-browser*",
  "*://square-1-web-browser.uptodown.com/*",
  "*://square-1-web-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/netscape-navigator*",
  "*://netscape-navigator.uptodown.com/*",
  "*://netscape-navigator.en.uptodown.com/*",
  "*://uptodown.com/windows/vivaldi*",
  "*://vivaldi.uptodown.com/*",
  "*://vivaldi.en.uptodown.com/*",
  "*://vivaldi.en.uptodown.com/windows*",
  "*://uptodown.com/windows/waterfox*",
  "*://waterfox.uptodown.com/*",
  "*://waterfox.en.uptodown.com/*",
  "*://waterfox.en.uptodown.com/windows*",
  "*://uptodown.com/windows/uc-browser*",
  "*://guthib.com/*",
  "*://uc-browser-pc.uptodown.com/*",
  "*://uc-browser-pc.en.uptodown.com/*",
  "*://uc-browser-pc.en.uptodown.com/windows*",
  "*://uptodown.com/windows/yandex-browser*",
  "*://yandex-browser.uptodown.com/*",
  "*://yandex-browser.en.uptodown.com/*",
  "*://uptodown.com/windows/maxthon*",
  "*://maxthon.uptodown.com/*",
  "*://maxthon.en.uptodown.com/*",
  "*://apps.microsoft.com/detail/9mxbp1fb84cq*",
  "*://apps.microsoft.com/detail/9nh2gph4jzs4*",
  "*://viamaker.uptodown.com/*",
  "*://viamaker.en.uptodown.com/*",
  "*://capcut.uptodown.com/*",
  "*://capcut.en.uptodown.com/*",
  "*://catcut-video-editor-and-maker.uptodown.com/*",
  "*://catcut-video-editor-and-maker.en.uptodown.com/*",
  "*://oracle.com/*",
  "*://virtualbox.org/*",
  "*://virtualbox.net/*",
  "*://vmware.com/*",
  "*://osboxes.org/*",
  "*://horizonmw.org/*",
  "*://reddit.com/answers*",
  "*://fantopia.mystrikingly.com/*",
  "*://www.softorbits.net/*",
  "*://softorbits.net/*",
  "*://virtualbox.com/*",
  "*://virtualbox.net/*",
  "*://vmware.com/*",
  "*://uptodown.com/*",
  "*://horizonmw.org/*",
  "*://ira-amanda.blogspot.com/*",
  "*://irpp4.blogspot.com/*",
  "*://irppas.blogspot.com/*",
  "*://jiujau.blogspot.com/*",
  "*://perttas.blogspot.com/*",
  "*://ira-amanda.blogspot.fi/*",
  "*://irpp4.blogspot.fi/*",
  "*://irppas.blogspot.fi/*",
  "*://jiujau.blogspot.fi/*",
  "*://perttas.blogspot.fi/*",
  "*://vsco.co/*",
  "*://threads.com/*",
  "*://threads.net/*",
  "*://instagram.com/*",
  "*://m.instagram.com/*",
  "*://osboxes.org/*",
  "*://oracle.com/*",
  "*://oracle.org/*",
  "*://oracle.net/*",
  "*://waterfox.net/*",
  "*://download.fi/*",
  "*://pwpix.net/*",
  "*://tiktok.com/@m1mmuska*",
  "*://tiktok.com/@just.se.mimmi*",
  "*://instagram.com/m1mmuska*",
  "*://tiktok.com/@karabrannbacka*",
  "*://instagram.com/karabrannbacka*",
  "*://instagram.com/piia_barlund*",
  "*://instagram.com/julmakira*",
  "*://reddit.com/r/comfyui*",
  "*://comfy.org/*",
  "*://runcomfy.com/*",
  "*://stable-diffusion-art.com/*",
  "*://comfyui.org/*",
  "*://thinkdiffusion.com/*",
  "*://github.com/copilot*",
  "*://snapchat.com/*",
  "*://snapchat.com/web*",
  "*://snapchat.com/*",
  "*://www.snapchat.com/*",
  "*://www.snapchat.com/web/*",
  "*://web.snapchat.com/*",
  "*://*.snapchat.com/*"
];

const WRESTLING_CACHE_TIME_KEY = "wrestling_women_urls_time";
const WRESTLING_CACHE_LIFETIME_MS = 12 * 60 * 60 * 1000;
const WRESTLING_CACHE_BUMP_KEY = "v38_wrestling_roster_dynamic_bump";
const WRESTLING_MANUAL_BANS = [
  "/wrestlers/lainey-reid",
  "/wrestlers/kellyanne",
  "/wrestlers/kellyanne-english",
  "/wrestlers/nikita-naridian",
  "/wrestlers/riho",
  "/wrestlers/thekla",
  "/wrestlers/pj-vasa",
  "/wrestlers/dani-sekelsky",
  "/wrestlers/kelly-kelly",
  "/wrestlers/alba-fyre",
  "/roster/wwe2k26/alundra-blayze",
  "/wrestlers/roxxi",
  "/wrestlers/zelina-vega",
  "/wrestlers/rosita",
  "/wrestlers/lita",
  "/wrestlers/chyna",
  "/wrestlers/maryse",
  "/wrestlers/aksana",
  "/wrestlers/kaitlyn",
  "/wrestlers/layla",
  "/wrestlers/tamina",
  "/wrestlers/melina",
  "/wrestlers/jacqueline",
  "/wrestlers/odb",
  "/wrestlers/asya",
  "/wrestlers/debra",
  "/wrestlers/lana",
  "/wrestlers/sable",
  "/wrestlers/tori",
  "/wrestlers/carmella",
  "/wrestlers/raquel",
  "/wrestlers/kamille",
  "/wrestlers/maxine",
  "/wrestlers/cherry",
  "/wrestlers/sarita",
  "/wrestlers/shaniqua",
  "/wrestlers/francine",
  "/wrestlers/trinity",
  "/wrestlers/ivy-nile",
  "/wrestlers/aj-lee",
  "/wrestlers/mia-yim",
  "/wrestlers/gail-kim",
  "/wrestlers/eve-torres",
  "/wrestlers/dawn-marie",
  "/wrestlers/joy-giovanni",
  "/wrestlers/cora-jade",
  "/wrestlers/taya-valkyrie",
  "/wrestlers/brie-bella",
  "/wrestlers/su-yung"
];
const WRESTLING_DO_NOT_BROADCAST = [
  "/wrestlers/melina",
  "/wrestlers/melina-perez",
  "/wrestlers/aj-lee",
  "/wrestlers/aj",
  "/wrestlers/becky-lynch",
  "/wrestlers/becky",
  "/wrestlers/katarina",
  "/wrestlers/jojo",
  "wrestlers/jojo",
  "jojo"
];

const WRESTLING_PAGES = [
  "https://www.thesmackdownhotel.com/roster/?promotion=wwe&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=aew&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=tna&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=njpw&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=wcw&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=ecw&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=aaa&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=roh&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=awa&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=nwa&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=lucha-underground&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=ovw&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=ajpw&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=noah&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=cmll&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=mlw&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/?promotion=czw&date=all-time#women",
  "https://www.thesmackdownhotel.com/roster/hall-of-fame/#women"
];

let platformModule = null;
let hostsCache = [];
let hostsMeta = null;
let hostsUpdatePromise = null;
let wrestlingUpdatePromise = null;
let requestListenerInstalled = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeHostname(hostname) {
  if (!hostname || typeof hostname !== "string") return "";
  try {
    return new URL(`http://${hostname.trim().replace(/\.$/, "")}`).hostname
      .toLowerCase()
      .replace(/\.$/, "");
  } catch (_) {
    return hostname.trim().toLowerCase().replace(/\.$/, "");
  }
}

function hostnameMatchesSet(hostname, domains) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  for (const domain of domains) {
    const candidate = normalizeHostname(domain);
    if (normalized === candidate || normalized.endsWith(`.${candidate}`)) return true;
  }
  return false;
}

function isAllowlistedHostname(hostname) {
  return hostnameMatchesSet(hostname, ALLOWED_SITES);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globPathToRegex(pathGlob) {
  const escaped = String(pathGlob || "/*")
    .split("*")
    .map(escapeRegex)
    .join(".*");
  return new RegExp(`^${escaped}$`, "i");
}

function compileStaticBlockRules(patterns) {
  const exactHosts = new Map();
  const wildcardHosts = [];

  for (const pattern of patterns) {
    const match = String(pattern).match(/^\*:\/\/([^/]+)(\/.*)$/i);
    if (!match) continue;
    const hostPattern = match[1].toLowerCase();
    const pathRegex = globPathToRegex(match[2]);

    if (hostPattern.startsWith("*.")) {
      wildcardHosts.push({ suffix: hostPattern.slice(2), pathRegex });
      continue;
    }

    if (!exactHosts.has(hostPattern)) exactHosts.set(hostPattern, []);
    exactHosts.get(hostPattern).push(pathRegex);
  }

  return { exactHosts, wildcardHosts };
}

const STATIC_BLOCK_RULES = compileStaticBlockRules(STATIC_BLOCK_PATTERNS);

function matchesStaticBlockRule(urlObject) {
  const hostname = normalizeHostname(urlObject.hostname);
  const path = `${urlObject.pathname || "/"}${urlObject.search || ""}${urlObject.hash || ""}`;

  const exactRules = STATIC_BLOCK_RULES.exactHosts.get(hostname);
  if (exactRules && exactRules.some(regex => regex.test(path))) return true;

  for (const rule of STATIC_BLOCK_RULES.wildcardHosts) {
    if ((hostname === rule.suffix || hostname.endsWith(`.${rule.suffix}`)) && rule.pathRegex.test(path)) {
      return true;
    }
  }

  return false;
}

function isBlockedTld(hostname) {
  return BLOCKED_TLDS.some(tld => hostname.endsWith(tld));
}

function binarySearch(sortedValues, target) {
  let low = 0;
  let high = sortedValues.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const value = sortedValues[mid];
    if (value === target) return true;
    if (value < target) low = mid + 1;
    else high = mid - 1;
  }
  return false;
}

function isBlockedByHosts(hostname) {
  if (!hostsCache.length) return false;
  let candidate = normalizeHostname(hostname);
  while (candidate) {
    if (binarySearch(hostsCache, candidate)) return true;
    const dot = candidate.indexOf(".");
    if (dot < 0) break;
    candidate = candidate.slice(dot + 1);
  }
  return false;
}

async function shouldBlockUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname || isAllowlistedHostname(hostname)) return false;
    if (matchesStaticBlockRule(parsed)) return true;
    if (isBlockedTld(hostname)) return true;
    return isBlockedByHosts(hostname);
  } catch (_) {
    return false;
  }
}

function parseHostsLine(rawLine) {
  if (!rawLine) return "";
  const uncommented = rawLine.split("#", 1)[0].trim();
  if (!uncommented) return "";

  const parts = uncommented.split(/\s+/);
  let candidate = "";
  if (parts.length >= 2 && /^(?:0\.0\.0\.0|127\.0\.0\.1|::1|::|255\.255\.255\.255)$/i.test(parts[0])) {
    candidate = parts[1];
  } else if (parts.length === 1) {
    candidate = parts[0];
  } else {
    candidate = parts[1] || parts[0];
  }

  candidate = String(candidate || "").trim().replace(/^\|\|/, "").replace(/\^$/, "");
  if (!candidate || candidate.includes("/") || candidate.includes(":")) return "";
  const normalized = normalizeHostname(candidate);
  if (!normalized || normalized === "localhost" || !normalized.includes(".")) return "";
  if (/^\d+(?:\.\d+){3}$/.test(normalized)) return "";
  return normalized;
}

async function consumeResponseLines(response, onLine) {
  if (response.body && typeof response.body.getReader === "function" && typeof TextDecoder !== "undefined") {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let carry = "";
    let processed = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = carry + decoder.decode(value, { stream: true });
      const lines = text.split(/\r?\n/);
      carry = lines.pop() || "";
      for (const line of lines) {
        onLine(line);
        processed++;
        if (processed % HOSTS_PARSE_YIELD_EVERY === 0) await sleep(0);
      }
    }

    carry += decoder.decode();
    if (carry) onLine(carry);
    return;
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    onLine(lines[index]);
    if (index > 0 && index % HOSTS_PARSE_YIELD_EVERY === 0) await sleep(0);
  }
}

async function fetchSourceIntoSet(source, seenHosts) {
  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(source.url, {
        cache: "no-store",
        credentials: "omit",
        headers: { "Accept": "text/plain" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      let parsedCount = 0;
      let uniqueAdded = 0;
      await consumeResponseLines(response, line => {
        const host = parseHostsLine(line);
        if (!host || isAllowlistedHostname(host)) return;
        parsedCount++;
        if (!seenHosts.has(host)) {
          seenHosts.add(host);
          uniqueAdded++;
        }
      });

      console.log(`${LOG_PREFIX} ${source.id}: parsed ${parsedCount}, added ${uniqueAdded} unique hosts.`);
      return { parsedCount, uniqueAdded };
    } catch (error) {
      console.warn(`${LOG_PREFIX} ${source.id} fetch attempt ${attempt} failed:`, error);
      if (attempt < MAX_FETCH_RETRIES) await sleep(2000);
    }
  }
  return { parsedCount: 0, uniqueAdded: 0 };
}

function chunkKey(generation, index) {
  return `${HOSTS_CHUNK_PREFIX}:${generation}:${index}`;
}

async function removeGeneration(meta) {
  if (!meta || !meta.generation || !Number.isInteger(meta.chunkCount)) return;
  const keys = [];
  for (let index = 0; index < meta.chunkCount; index++) keys.push(chunkKey(meta.generation, index));
  if (keys.length) await browser.storage.local.remove(keys);
}

async function storeHostsAtomically(sortedHosts, sourceStats) {
  const previous = (await browser.storage.local.get(HOSTS_META_KEY))[HOSTS_META_KEY] || null;
  const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const writtenKeys = [];

  try {
    let chunkCount = 0;
    for (let offset = 0; offset < sortedHosts.length; offset += HOSTS_STORAGE_CHUNK_SIZE) {
      const key = chunkKey(generation, chunkCount);
      const chunk = sortedHosts.slice(offset, offset + HOSTS_STORAGE_CHUNK_SIZE);
      await browser.storage.local.set({ [key]: chunk });
      writtenKeys.push(key);
      chunkCount++;
      await sleep(0);
    }

    const meta = {
      schema: HOSTS_SCHEMA_VERSION,
      generation,
      chunkCount,
      count: sortedHosts.length,
      lastUpdated: Date.now(),
      sourceStats,
      sourceOrder: HOSTS_SOURCES.map(source => source.id)
    };

    await browser.storage.local.set({
      [HOSTS_META_KEY]: meta,
      hostsCount: sortedHosts.length,
      lastUpdated: meta.lastUpdated
    });

    hostsMeta = meta;
    hostsCache = sortedHosts;

    // Remove the old giant single-value list after the new generation has committed.
    await browser.storage.local.remove(["hostsList", "chunksCount", "compressionRatio"]);
    if (previous && previous.generation !== generation) await removeGeneration(previous);
    return meta;
  } catch (error) {
    if (writtenKeys.length) await browser.storage.local.remove(writtenKeys);
    throw error;
  }
}

async function migrateLegacyHostsList(legacyList) {
  if (!Array.isArray(legacyList) || !legacyList.length) return false;
  const unique = Array.from(new Set(legacyList.map(normalizeHostname).filter(Boolean))).sort();
  if (!unique.length) return false;
  console.log(`${LOG_PREFIX} Migrating legacy hostsList storage into real chunks.`);
  await storeHostsAtomically(unique, { migratedLegacy: unique.length });
  return true;
}

async function loadHostsCache() {
  const data = await browser.storage.local.get([HOSTS_META_KEY, "hostsList"]);
  const meta = data[HOSTS_META_KEY];

  if (!meta || meta.schema !== HOSTS_SCHEMA_VERSION || !meta.generation || !Number.isInteger(meta.chunkCount)) {
    if (await migrateLegacyHostsList(data.hostsList)) return hostsCache;
    hostsCache = [];
    hostsMeta = null;
    return hostsCache;
  }

  const loaded = [];
  for (let index = 0; index < meta.chunkCount; index++) {
    const key = chunkKey(meta.generation, index);
    const chunk = (await browser.storage.local.get(key))[key];
    if (!Array.isArray(chunk)) {
      console.warn(`${LOG_PREFIX} Missing hosts chunk ${index}; keeping the cache empty until refresh.`);
      hostsCache = [];
      hostsMeta = null;
      return hostsCache;
    }
    loaded.push(...chunk);
    await sleep(0);
  }

  hostsCache = loaded;
  hostsMeta = meta;
  console.log(`${LOG_PREFIX} Loaded ${loaded.length} hosts from ${meta.chunkCount} storage chunks.`);
  return hostsCache;
}

async function updateBlocklist() {
  if (hostsUpdatePromise) return hostsUpdatePromise;

  hostsUpdatePromise = (async () => {
    const started = Date.now();
    const seenHosts = new Set();
    const sourceStats = {};

    for (const source of HOSTS_SOURCES) {
      sourceStats[source.id] = await fetchSourceIntoSet(source, seenHosts);
      await sleep(250);
    }

    if (!seenHosts.size) {
      console.warn(`${LOG_PREFIX} No hosts fetched; retaining the previous valid generation.`);
      return false;
    }

    // A single sorted array is retained for low-memory binary searches on both PC and Android.
    const sortedHosts = Array.from(seenHosts).sort();
    seenHosts.clear();
    await storeHostsAtomically(sortedHosts, sourceStats);

    console.log(`${LOG_PREFIX} Hosts update complete: ${sortedHosts.length} unique entries in ${((Date.now() - started) / 1000).toFixed(2)}s.`);
    return true;
  })().catch(error => {
    console.error(`${LOG_PREFIX} Hosts update failed; previous generation retained:`, error);
    return false;
  }).finally(() => {
    hostsUpdatePromise = null;
  });

  return hostsUpdatePromise;
}

async function updateWrestlingRoster() {
  if (wrestlingUpdatePromise) return wrestlingUpdatePromise;

  wrestlingUpdatePromise = (async () => {
    const data = await browser.storage.local.get([
      WRESTLING_CACHE_TIME_KEY,
      "wrestling_women_urls",
      "v27_chrome_bump",
      WRESTLING_CACHE_BUMP_KEY
    ]);

    const now = Date.now();
    const lastFetch = Number(data[WRESTLING_CACHE_TIME_KEY] || 0);

    if (!data.v27_chrome_bump) {
      await browser.storage.local.remove([WRESTLING_CACHE_TIME_KEY, "wrestling_women_urls"]);
      await browser.storage.local.set({ v27_chrome_bump: true, [WRESTLING_CACHE_BUMP_KEY]: true });
    } else if (!data[WRESTLING_CACHE_BUMP_KEY]) {
      await browser.storage.local.remove([WRESTLING_CACHE_TIME_KEY, "wrestling_women_urls"]);
      await browser.storage.local.set({ [WRESTLING_CACHE_BUMP_KEY]: true });
    } else if (Array.isArray(data.wrestling_women_urls) && data.wrestling_women_urls.length && now - lastFetch < WRESTLING_CACHE_LIFETIME_MS) {
      return false;
    }

    let combinedUrls = [...WRESTLING_MANUAL_BANS];
    if (Array.isArray(data.wrestling_women_urls)) combinedUrls.push(...data.wrestling_women_urls);

    for (const url of WRESTLING_PAGES) {
      try {
        const response = await fetch(url.split("#")[0], {
          credentials: "omit",
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
          }
        });
        if (!response.ok) continue;
        const html = await response.text();

        const femaleChunks = html.split("gender-female");
        for (let index = 1; index < femaleChunks.length; index++) {
          const match = /href="(\/wrestlers\/[^"]+)"/i.exec(femaleChunks[index].substring(0, 1500));
          if (match) combinedUrls.push(new URL(match[1], "https://www.thesmackdownhotel.com").pathname);
        }

        const panelChunks = html.split(/id=["']?(?:rlta-panel-women|rlta-women|roster-women)["']?/i);
        for (let index = 1; index < panelChunks.length; index++) {
          let chunk = panelChunks[index];
          const endIndex = chunk.search(/id=["']?(?:rlta|ja-sidebar|<footer)/i);
          if (endIndex !== -1) chunk = chunk.substring(0, endIndex);
          const regex = /href="(\/wrestlers\/[^"]+)"/gi;
          let match;
          while ((match = regex.exec(chunk)) !== null) {
            combinedUrls.push(new URL(match[1], "https://www.thesmackdownhotel.com").pathname);
          }
        }
      } catch (_) {}
      await sleep(800);
    }

    const safeUrls = Array.from(new Set(combinedUrls)).filter(url => {
      const slug = String(url).toLowerCase();
      return !WRESTLING_DO_NOT_BROADCAST.some(blocked => slug.includes(blocked));
    });

    await browser.storage.local.set({
      wrestling_women_urls: safeUrls,
      [WRESTLING_CACHE_TIME_KEY]: now,
      [WRESTLING_CACHE_BUMP_KEY]: true
    });
    console.log(`${LOG_PREFIX} Wrestling roster cache updated: ${safeUrls.length} entries.`);
    return true;
  })().catch(error => {
    console.error(`${LOG_PREFIX} Wrestling roster update failed:`, error);
    return false;
  }).finally(() => {
    wrestlingUpdatePromise = null;
  });

  return wrestlingUpdatePromise;
}

function getRequestDecision(details) {
  const platformDecision = platformModule?.beforeRequest?.(details);
  if (platformDecision) return platformDecision;

  return shouldBlockUrl(details.url).then(blocked => {
    if (!blocked) return { cancel: false };
    return platformModule?.blockedResponse?.(details) || { cancel: true };
  }).catch(error => {
    console.warn(`${LOG_PREFIX} Request decision failed:`, error);
    return { cancel: false };
  });
}

function installRequestListener() {
  if (requestListenerInstalled) return;
  browser.webRequest.onBeforeRequest.addListener(
    getRequestDecision,
    { urls: ["<all_urls>"] },
    ["blocking"]
  );
  requestListenerInstalled = true;
}

function setupAlarms() {
  browser.alarms.create(HOSTS_UPDATE_ALARM, { periodInMinutes: HOSTS_UPDATE_INTERVAL_MINUTES });
  browser.alarms.create(WRESTLING_UPDATE_ALARM, { periodInMinutes: WRESTLING_UPDATE_INTERVAL_MINUTES });
}

async function runStartupUpdates(forceHosts = false) {
  const hostsAge = Date.now() - Number(hostsMeta?.lastUpdated || 0);
  if (forceHosts || !hostsCache.length || hostsAge >= HOSTS_UPDATE_INTERVAL_MINUTES * 60 * 1000) {
    void updateBlocklist();
  }
  void updateWrestlingRoster();
}

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === HOSTS_UPDATE_ALARM) void updateBlocklist();
  if (alarm.name === WRESTLING_UPDATE_ALARM) void updateWrestlingRoster();
});

browser.runtime.onInstalled.addListener(() => {
  setupAlarms();
  void runStartupUpdates(true);
});

browser.runtime.onStartup.addListener(() => {
  setupAlarms();
  void runStartupUpdates(false);
});

browser.runtime.onMessage.addListener(message => {
  if (message?.type === "bravefox:update-hosts") return updateBlocklist();
  if (message?.type === "bravefox:hosts-status") {
    return Promise.resolve({
      count: hostsCache.length,
      lastUpdated: hostsMeta?.lastUpdated || 0,
      sourceStats: hostsMeta?.sourceStats || null
    });
  }
  return undefined;
});

async function main() {
  const manifest = browser.runtime.getManifest();
  const platformInfo = await browser.runtime.getPlatformInfo();
  const isAndroid = platformInfo?.os === "android";

  platformModule = isAndroid
    ? await import("./modules/fenix-nightly.js")
    : await import("./modules/pc-esr.js");

  await platformModule.initializePlatform?.();
  await loadHostsCache();
  installRequestListener();
  setupAlarms();
  await runStartupUpdates(false);

  console.log(`${LOG_PREFIX} BraveFox Enhancer ${manifest.version} initialized for ${isAndroid ? "Fenix Nightly" : "Firefox PC/ESR"}.`);
}

main().catch(error => {
  console.error(`${LOG_PREFIX} Fatal initialization failure:`, error);
});
