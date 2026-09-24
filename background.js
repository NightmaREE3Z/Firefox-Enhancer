// BraveFox Enhancer unified Firefox background entry point.
// Shared by Firefox PC/ESR and Firefox Android/Fenix Nightly.
// Platform-exclusive behavior lives in modules/pc-esr.js and modules/fenix-nightly.js.

import "./blocker/service.js";
import { isCompletelyExcludedHostname, isCompletelyExcludedUrl } from "./blocker/shared.js";
import { getSettings, loadDataset } from "./blocker/storage.js";
import { findTimeRuleBlock } from "./blocker/timers.js";

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
const BRAVEFOX_AMO_API_URL = "https://addons.mozilla.org/api/v5/addons/addon/bravefox-enhancer/";
const BRAVEFOX_UPDATE_RECEIPT_KEY = "bravefoxExtensionUpdateReceiptV1";
const BRAVEFOX_AMO_CACHE_MS = 60 * 1000;
let braveFoxAmoVersionCache = { version: "", checkedAt: 0 };

// Canonical source priority. First source wins when a hostname appears more than once.
const HOSTS_SOURCES = [
  {
    id: "BraveFoxHosts",
    url: "https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/blocker/lists/BraveFoxHosts",
    fallbackPath: "blocker/lists/BraveFoxHosts"
  },
  {
    id: "StevenBlack",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-porn/hosts"
  },
  {
    id: "LegacyFox",
    url: "https://raw.githubusercontent.com/NightmaREE3Z/Focus-Master/refs/heads/BraveFox/blocker/lists/legacyFox",
    fallbackPath: "blocker/lists/legacyFox"
  }
];

const ALLOWED_SITES = new Set([
  "sieni.us",
  "sieni.es"
]);

// Editable TLD enforcement is owned by the built-in Focus Master blockedTLDs.csv dataset.
// Keep this background layer focused on the Enhancer's legacy static URL rules.

// Existing PC static URL policy, now shared by both Firefox platforms.
// Blocklist for other domains if needed
const blockedSites = [
   "microsoft365.com",
   "microsoft.com/fi-fi/edge/business/download", 
   "microsoft.com/fi-fi/edge/business", 
   "microsoft.com/fi-fi/edge/", 
   "microsoft.com/fi-fi/edge/business/download?cs=3457492030&form=MA13FJ",
   "uptodown.com/windows/browsing",
   "uptodown.com/windows/internet",
   "uptodown.com/windows/web-browsers",
   "en.uptodown.com/windows/web-browsers",
   "uptodown.com/windows/browsers",
   "uptodown.com/windows/internet-browsers",
   "uptodown.com/windows/browser",
   "uptodown.com/windows/web-navigators",
   "uptodown.com/windows/navigators",
   "uptodown.com/windows/networking",
   "uptodown.com/windows/networking/browsers",
   "uptodown.com/windows/google-chrome",
   "google-chrome.uptodown.com",
   "google-chrome.en.uptodown.com",
   "google-chrome.en.uptodown.com/windows",
   "google-chrome-portable.uptodown.com",
   "google-chrome-portable.en.uptodown.com",
   "uptodown.com/windows/mozilla-firefox",
   "mozilla-firefox.uptodown.com",
   "mozilla-firefox.en.uptodown.com",
   "mozilla-firefox.en.uptodown.com/windows",
   "firefox.com/fi/",
   "mozilla.fi",
   "mozilla.org/fi/",
   "brave.com/",
   "brave.com",
   "instagram.com/popular",
   "download.fi/verkko",
   "uptodown.com/windows/microsoft-edge",
   "microsoft-edge.uptodown.com",
   "microsoft-edge.en.uptodown.com",
   "microsoft-edge.en.uptodown.com/windows",
   "uptodown.com/windows/opera",
   "opera.uptodown.com",
   "opera.en.uptodown.com",
   "opera.en.uptodown.com/windows",
   "uptodown.com/windows/brave",
   "brave-browser.uptodown.com",
   "brave-browser.en.uptodown.com",
   "brave-browser-nightly.uptodown.com",
   "brave-browser-nightly.en.uptodown.com",
   "uptodown.com/windows/tor-browser",
   "github.com/mozilla-firefox",
   "softonic.com",
   "en.softonic.com",
   "download.it",
   "taplink.cc",
   "tor.uptodown.com",
   "tor.en.uptodown.com",
   "tor.uptodown.com/windows",
   "tor.en.uptodown.com/windows",
   "safari.uptodown.com",
   "safari.en.uptodown.com",
   "safari.en.uptodown.com/windows",
   "uptodown.com/windows/cent-browser",
   "cent-browser.uptodown.com",
   "cent-browser.en.uptodown.com",
   "uptodown.com/windows/librewolf",
   "apps.microsoft.com/detail/9nzvdkpmr9rd",
   "librewolf.uptodown.com",
   "librewolf.en.uptodown.com",
   "uptodown.com/windows/internet-explorer",
   "internet-explorer.uptodown.com",
   "internet-explorer.en.uptodown.com",
   "uptodown.com/windows/ccleaner-browser",
   "ccleaner-browser.uptodown.com",
   "ccleaner-browser.en.uptodown.com",
   "uptodown.com/windows/chromium",
   "chromium.uptodown.com",
   "instagram.com/explore",
   "chromium.en.uptodown.com",
   "chromium.uptodown.com/windows",
   "chromium.en.uptodown.com/windows",
   "uptodown.com/windows/epic-browser",
   "epic-browser.uptodown.com",
   "epic-browser.en.uptodown.com",
   "uptodown.com/windows/theworld-browser",
   "theworld-browser.uptodown.com",
   "theworld-browser.en.uptodown.com",
   "uptodown.com/windows/avant-browser",
   "avant-browser.uptodown.com",
   "avant-browser.en.uptodown.com",
   "uptodown.com/windows/thorium-browser",
   "thorium-browser.uptodown.com",
   "thorium-browser.en.uptodown.com",
   "uptodown.com/windows/square-1-web-browser",
   "square-1-web-browser.uptodown.com",
   "square-1-web-browser.en.uptodown.com",
   "blocked.html?type=term&trigger=user%2F3ws1lu2bwli971gvhv28yemrm&source=https%3A%2F%2Fopen.spotify.com%2Fuser%2F3ws1lu2bwli971gvhv28yemrm&attempted=",
   "https://scontent-hel3-1.cdninstagram.com/v/t51.82787-15/625469698_18528894469069282_4159101025682725824_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=MTA5OTQzMDg5ODEzOTYxMzg0MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuNDE0LnNkci5yZWd1bGFyX3Bob3RvLkMzIn0%3D&_nc_ohc=x3EmvxyyzQ0Q7kNvwEMliDa&_nc_oc=Adq47sggBK-OipwPSfQYfj4GoWNsWkDhJsyykEFLnooi21eGjYmTgOT5qcB9e2Bns-jYq6ImXYoq2zT6Gy55rrte&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-hel3-1.cdninstagram.com&_nc_gid=DJiKr0I4IZBECZYqwSVB-g&_nc_ss=7a22e&oh=00_AQIU1S2NemJ_ccgVGsokuNC56Xo3eRWFA3INpFXkyTusOg&oe=6ABA7AA2",
   "p/9B9pOqs0qQ",
   "uptodown.com/windows/netscape-navigator",
   "netscape-navigator.uptodown.com",
   "netscape-navigator.en.uptodown.com",
   "uptodown.com/windows/vivaldi",
   "vivaldi.uptodown.com",
   "vivaldi.en.uptodown.com",
   "vivaldi.en.uptodown.com/windows",
   "uptodown.com/windows/waterfox",
   "waterfox.uptodown.com",
   "github.com/Lateralus138",
   "waterfox.en.uptodown.com",
   "m365.cloud.microsoft",
   "m365.cloud",
   "m365.microsoft",
   "?origindomain=microsoft365",
   "m365.cloud.microsoft/?origindomain=microsoft365",
   "waterfox.en.uptodown.com/windows",
   "uptodown.com/windows/uc-browser",
   "uc-browser-pc.uptodown.com",
   "uc-browser-pc.en.uptodown.com",
   "uc-browser-pc.en.uptodown.com/windows",
   "uptodown.com/windows/yandex-browser",
   "yandex-browser.uptodown.com",
   "yandex-browser.en.uptodown.com",
   "apps.microsoft.com/detail/9mxbp1fb84cq",
   "apps.microsoft.com/detail/9nh2gph4jzs4",
   "apps.microsoft.com/detail/9nrtvfllggtv",
   "viamaker.uptodown.com",
   "viamaker.en.uptodown.com",
   "capcut.uptodown.com",
   "capcut.en.uptodown.com",
   "catcut-video-editor-and-maker.uptodown.com",
   "catcut-video-editor-and-maker.en.uptodown.com",
   "reddit.com/answers",
   "fantopia.mystrikingly.com",
   "www.softorbits.net",
   "softorbits.net",
   "virtualbox.com",
   "virtualbox.net",
   "vmware.com",
   "oracle.com",
   "oracle.org",
   "oracle.net",
   "waterfox.net",
   "download.fi",
   "vsco.co",
   "pinterest.com",
   "gemini.google.com",
   "instagram.com/m1mmuska",
   "tiktok.com/@karabr",
   "tiktok.com/@kara",
   "tiktok.com/@karts",
   "tiktok.com/@just.se.mimmi",
   "tiktok.com/@m1mmuska",
   "instagram.com/karabr",
   "instagram.com/piia_barlund",
   "tiktok.com/@bulgaru",
   "tiktok.com/@laur",
   "instagram.com/julmakira",
   "lite.irc-galleria.net",
   "irc-galleria.fi",
   "irc.fi",
   "reddit.com/r/comfyui",
   "xvideos.com/c/AI-239",
   "comfy.org",
   "runcomfy.com",
   "facebook.com/prowrestlingworld",
   "stable-diffusion-art.com",
   "comfyui.org",
   "thinkdiffusion.com",
   "threads.com",
   "threads.net",
   "grok.com",
   "grok.ai",
   "pwpix.net",
   "reveddit.com/v/jumalattaretPro",
   "reddit.com/media?url=https%3A%2F%2Fi.redd.it%2F418s0mmtpve81.jpg",
   "reddit.com/media?url=https%3A%2F%2Fi.redd.it%2F5sj5dp809wg71.jpg",
   "reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fqc3dwb3zpmm81.jpg",
   "reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fkwfiq6v52dp81.jpg",
   "reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fmh3mrxsf4cg91.jpg",
   "reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fcl2le6iawhk71.jpg",
   "reddit.com/u/birppis",
   "reveddit.com/y/birppis",
   "jiujau.blogspot.com",
   "jiujau.blogspot.fi",
   "perttas.blogspot.com",
   "perttas.blogspot.fi",
   "instagram.com/nickiminaj",
   "instagram.com/ninnuliin11",
   "instagram.com/n1nnul11n11.real",
   "instagram.com/n1nnul11n11_reels",
   "facebook.com/profile.php?id=100000639309471",
   "irc-galleria.net/user/irpp4/album?page=0",
   "irc-galleria.net/user/irpp4/album?page=1",
   "instagram.com/accounts/hide_story_and_live",
   "www.reddit.com/user/birppis/comments/",
   "www.reddit.com/user/birppis/submitted/",
   "www.reddit.com/user/birppis/posts/",
   "www.reddit.com/user/birppis/comments",
   "www.reddit.com/user/birppis/submitted",
   "www.reddit.com/user/birppis/posts",
   "studio.creativefabrica.com",
   "www.creativefabrica.com",
   "tiktok.com/@juliana.rasikannas",
   "reddit.com/user/JulianaRasikannas",
   "reddit.com/r/snappijuorut",
   "reddit.com/r/snappisensuroimat0n",
   "snapchat.com/@",
   "pinterest.com",
   "snapchat.com/spotlight",
   "instagram.com/misk33waaa",
   "instagram.com/mafiaprinsessa",
   "dashboard.g2a.com/support/conversations/view/M-VJYS-724654",
   "dashboard.g2a.com/support/conversations/view/M-LSMI-906369",
   "tiktok.com/search?q=katarii",
   "tiktok.com/search?q=kara",
   "tiktok.com/search?q=kart",
   "tiktok.com/search?q=bränn",
   "tiktok.com/search?q=brann",
   "tiktok.com/search?q=br4nn",
   "tiktok.com/search?q=just",
   "tiktok.com/search?q=m1mm",
   "tiktok.com/search?q=mimm",
   "tiktok.com/search?q=ira",
   "tiktok.com/search?q=alexa",
   "tiktok.com/search?q=blis",
   "tiktok.com/@katarii",
   "instagram.com/katarii"
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

function braveFoxIsTwitchUrl(value) {
  try {
    const host = new URL(String(value || '')).hostname.toLowerCase();
    return host === 'twitch.tv' || host.endsWith('.twitch.tv');
  } catch (_) {
    return false;
  }
}

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
  return hostnameMatchesSet(hostname, ALLOWED_SITES) || isCompletelyExcludedHostname(hostname);
}

function matchesStaticBlockedSite(url) {
  return blockedSites.some(site => String(url || "").includes(site));
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
    if (isCompletelyExcludedUrl(url)) return false;
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname || isAllowlistedHostname(hostname)) return false;
    if (matchesStaticBlockedSite(url)) return true;
    // Focus Master 1.2.0 owns fetched-host enforcement in blocker/service.js so
    // manual Blocker rules and TrustedSites can outrank the blunt host fallback.
    return false;
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

async function consumeHostsResponse(source, response, seenHosts, origin) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  let parsedCount = 0;
  let uniqueAdded = 0;
  await consumeResponseLines(response, line => {
    const host = parseHostsLine(line);
    if (!host || isAllowlistedHostname(host) || isCompletelyExcludedHostname(host)) return;
    parsedCount++;
    if (!seenHosts.has(host)) {
      seenHosts.add(host);
      uniqueAdded++;
    }
  });

  console.log(`${LOG_PREFIX} ${source.id} (${origin}): parsed ${parsedCount}, added ${uniqueAdded} unique hosts.`);
  return { parsedCount, uniqueAdded, origin };
}

async function fetchSourceIntoSet(source, seenHosts) {
  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(source.url, {
        cache: "no-store",
        credentials: "omit",
        headers: { "Accept": "text/plain" }
      });
      return await consumeHostsResponse(source, response, seenHosts, "remote");
    } catch (error) {
      console.warn(`${LOG_PREFIX} ${source.id} fetch attempt ${attempt} failed:`, error);
      if (attempt < MAX_FETCH_RETRIES) await sleep(2000);
    }
  }

  if (source.fallbackPath) {
    try {
      const response = await fetch(browser.runtime.getURL(source.fallbackPath), {
        cache: "no-store",
        credentials: "omit",
        headers: { "Accept": "text/plain" }
      });
      console.warn(`${LOG_PREFIX} ${source.id}: remote unavailable, using bundled fallback.`);
      return await consumeHostsResponse(source, response, seenHosts, "bundled-fallback");
    } catch (error) {
      console.warn(`${LOG_PREFIX} ${source.id} bundled fallback failed:`, error);
    }
  }

  return { parsedCount: 0, uniqueAdded: 0, origin: "unavailable" };
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

function focusMasterEffectiveSettings(settings, incognito = false) {
  if (!incognito) return settings;
  return { ...settings, enabled: true };
}

function focusMasterTimeBlockedPage(reason, sourceUrl) {
  const params = new URLSearchParams({
    type: reason.type,
    trigger: reason.trigger || '',
    source: sourceUrl || '',
    attempted: reason.attemptedSearch || ''
  });
  if (reason?.type === 'schedule' && reason?.rule?.endTime) params.set('until', reason.rule.endTime);
  return browser.runtime.getURL(`blocker/blocked.html?${params.toString()}`);
}

async function getFocusMasterTimeRuleRequestDecision(details) {
  if (details?.type !== 'main_frame') return null;
  const url = String(details?.url || '');
  if (!/^https?:\/\//i.test(url)) return null;

  const [dataset, storedSettings] = await Promise.all([loadDataset(), getSettings()]);
  const settings = focusMasterEffectiveSettings(storedSettings, Boolean(details?.incognito));
  const reason = await findTimeRuleBlock(url, settings, dataset.profile);
  if (!reason) return null;

  return { redirectUrl: focusMasterTimeBlockedPage(reason, url) };
}

async function getRequestDecision(details) {
  try {
    // Focus Master Priority 2 Time Rules intentionally outrank Trusted Sites.
    // Firefox's blocking webRequest API lets us redirect before the destination
    // document renders, which is stronger than the Chromium pre-paint fallback.
    const timeDecision = await getFocusMasterTimeRuleRequestDecision(details);
    if (timeDecision) return timeDecision;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Focus Master Time Rule request check failed:`, error);
  }

  if (isCompletelyExcludedUrl(details?.url)) return { cancel: false };
  const platformDecision = platformModule?.beforeRequest?.(details);
  if (platformDecision) return platformDecision;

  try {
    const blocked = await shouldBlockUrl(details.url);
    if (!blocked) return { cancel: false };
    return platformModule?.blockedResponse?.(details) || { cancel: true };
  } catch (error) {
    console.warn(`${LOG_PREFIX} Request decision failed:`, error);
    return { cancel: false };
  }
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

function compareExtensionVersions(left, right) {
  const leftParts = String(left || "").split(".").map(part => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || "").split(".").map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

async function fetchLatestBraveFoxAmoVersion(force = false) {
  const now = Date.now();
  if (!force && braveFoxAmoVersionCache.version && now - braveFoxAmoVersionCache.checkedAt < BRAVEFOX_AMO_CACHE_MS) {
    return braveFoxAmoVersionCache.version;
  }

  const response = await fetch(BRAVEFOX_AMO_API_URL, {
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`AMO returned HTTP ${response.status}.`);

  const addon = await response.json();
  const latestVersion = String(addon?.current_version?.version || "").trim();
  if (!latestVersion) throw new Error("AMO did not return a current BraveFox version.");

  braveFoxAmoVersionCache = { version: latestVersion, checkedAt: now };
  return latestVersion;
}

async function getBraveFoxExtensionUpdateStatus(force = false) {
  const installedVersion = browser.runtime.getManifest().version;
  const latestVersion = await fetchLatestBraveFoxAmoVersion(force);
  const comparison = compareExtensionVersions(installedVersion, latestVersion);
  const stored = await browser.storage.local.get(BRAVEFOX_UPDATE_RECEIPT_KEY);
  const receipt = stored?.[BRAVEFOX_UPDATE_RECEIPT_KEY] || null;

  return {
    ok: true,
    installedVersion,
    latestVersion,
    state: comparison < 0 ? "update_available" : comparison > 0 ? "ahead" : "latest",
    receipt
  };
}

function setupAlarms() {
  // Focus Master 1.0.1 owns fetched-host refresh/enforcement via blocker/hosts.js.
  // Keep only the Firefox Enhancer wrestling-roster alarm here.
  browser.alarms.create(WRESTLING_UPDATE_ALARM, { periodInMinutes: WRESTLING_UPDATE_INTERVAL_MINUTES });
}

async function runStartupUpdates(_forceHosts = false) {
  void updateWrestlingRoster();
}

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === WRESTLING_UPDATE_ALARM) void updateWrestlingRoster();
});

browser.runtime.onInstalled.addListener(details => {
  setupAlarms();
  void runStartupUpdates(true);

  if (details?.reason === "update") {
    const currentVersion = browser.runtime.getManifest().version;
    void browser.storage.local.set({
      [BRAVEFOX_UPDATE_RECEIPT_KEY]: {
        previousVersion: String(details.previousVersion || ""),
        currentVersion,
        updatedAt: Date.now()
      }
    });
  }
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
  if (message?.type === "bravefox:extension-update-status") {
    return getBraveFoxExtensionUpdateStatus(Boolean(message.force)).catch(error => ({
      ok: false,
      error: String(error?.message || error)
    }));
  }
  return undefined;
});


// ---------------------------------------------------------------------------
// Firefox/Fenix protected browser-management page password gate
// ---------------------------------------------------------------------------
const BRAVEFOX_FIREFOX_SYSTEM_BYPASS_TTL_MS = 5 * 60 * 1000;
const braveFoxFirefoxSystemBypassTabs = new Map();
const braveFoxFirefoxSystemOriginalUrls = new Map();
const braveFoxFirefoxSystemRedirectingTabs = new Set();

function braveFoxIsProtectedFirefoxSystemUrl(rawUrl) {
  const url = String(rawUrl || "").trim().toLowerCase();
  if (!url) return false;

  if (/^about:(?:addons|debugging|config|profiles|support)(?:$|[/?#])/.test(url)) return true;

  // Firefox for Android stable builds have historically exposed the GeckoView
  // configuration editor through this chrome URL when about:config is blocked.
  return /^chrome:\/\/geckoview\/content\/config\.xhtml(?:$|[/?#])/.test(url);
}

function braveFoxIsFirefoxSystemBypassed(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return false;
  const expiresAt = Number(braveFoxFirefoxSystemBypassTabs.get(tabId) || 0);
  if (!expiresAt) return false;
  if (Date.now() <= expiresAt) return true;
  braveFoxFirefoxSystemBypassTabs.delete(tabId);
  return false;
}

function braveFoxGrantFirefoxSystemBypass(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return false;
  braveFoxFirefoxSystemBypassTabs.set(tabId, Date.now() + BRAVEFOX_FIREFOX_SYSTEM_BYPASS_TTL_MS);
  return true;
}

function braveFoxIsFirefoxSystemPasswordPage(sender) {
  try {
    const url = new URL(String(sender?.url || sender?.tab?.url || ""));
    const extensionOrigin = new URL(browser.runtime.getURL("/")).origin;
    return url.origin === extensionOrigin &&
      url.pathname === "/html/password-protected.html" &&
      url.searchParams.get("target") === "firefox-system";
  } catch (_) {
    return false;
  }
}

async function braveFoxRedirectFirefoxSystemTab(tabId, originalUrl) {
  if (!Number.isInteger(tabId) || tabId < 0 || !braveFoxIsProtectedFirefoxSystemUrl(originalUrl)) return false;
  if (braveFoxIsFirefoxSystemBypassed(tabId) || braveFoxFirefoxSystemRedirectingTabs.has(tabId)) return false;

  braveFoxFirefoxSystemRedirectingTabs.add(tabId);
  braveFoxFirefoxSystemOriginalUrls.set(tabId, String(originalUrl));

  const params = new URLSearchParams({
    target: "firefox-system",
    compact: "1",
    title: "Saatana! Sivu salasanasuojattu"
  });

  try {
    await browser.tabs.update(tabId, {
      url: browser.runtime.getURL(`html/password-protected.html?${params.toString()}`),
      loadReplace: false
    });
    return true;
  } catch (error) {
    braveFoxFirefoxSystemOriginalUrls.delete(tabId);
    console.warn(`${LOG_PREFIX} Could not redirect protected Firefox system page:`, error);
    return false;
  } finally {
    braveFoxFirefoxSystemRedirectingTabs.delete(tabId);
  }
}

function braveFoxCheckFirefoxSystemNavigation(tabId, rawUrl) {
  if (!Number.isInteger(tabId) || tabId < 0 || !braveFoxIsProtectedFirefoxSystemUrl(rawUrl)) return;
  if (braveFoxIsFirefoxSystemBypassed(tabId)) return;
  void braveFoxRedirectFirefoxSystemTab(tabId, rawUrl);
}

async function braveFoxCheckActivatedFirefoxSystemTab(activeInfo) {
  const tabId = activeInfo?.tabId;
  if (!Number.isInteger(tabId) || tabId < 0) return;
  try {
    const tab = await browser.tabs.get(tabId);
    braveFoxCheckFirefoxSystemNavigation(tabId, tab?.url || "");
  } catch (_) {}
}

async function braveFoxScanOpenFirefoxSystemTabs() {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      braveFoxCheckFirefoxSystemNavigation(tab?.id, tab?.url || "");
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Could not scan protected Firefox system pages:`, error);
  }
}

if (browser.tabs?.onCreated) {
  browser.tabs.onCreated.addListener(tab => {
    braveFoxCheckFirefoxSystemNavigation(tab?.id, tab?.url || "");
  });
}

if (browser.tabs?.onUpdated) {
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    braveFoxCheckFirefoxSystemNavigation(tabId, changeInfo?.url || tab?.url || "");
  });
}

if (browser.tabs?.onActivated) {
  browser.tabs.onActivated.addListener(activeInfo => {
    void braveFoxCheckActivatedFirefoxSystemTab(activeInfo);
  });
}

if (browser.tabs?.onRemoved) {
  browser.tabs.onRemoved.addListener(tabId => {
    braveFoxFirefoxSystemBypassTabs.delete(tabId);
    braveFoxFirefoxSystemOriginalUrls.delete(tabId);
    braveFoxFirefoxSystemRedirectingTabs.delete(tabId);
  });
}

function braveFoxHandleFirefoxSystemWebNavigation(details) {
  if (details?.frameId !== 0) return;
  braveFoxCheckFirefoxSystemNavigation(details?.tabId, details?.url || "");
}

if (browser.webNavigation?.onBeforeNavigate) {
  browser.webNavigation.onBeforeNavigate.addListener(braveFoxHandleFirefoxSystemWebNavigation);
}
if (browser.webNavigation?.onCommitted) {
  browser.webNavigation.onCommitted.addListener(braveFoxHandleFirefoxSystemWebNavigation);
}
if (browser.webNavigation?.onHistoryStateUpdated) {
  browser.webNavigation.onHistoryStateUpdated.addListener(braveFoxHandleFirefoxSystemWebNavigation);
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object") return undefined;
  if (message.type !== "BRAVEFOX_EXT_UNLOCK" && message.type !== "BRAVEFOX_GO_TO_EXTENSIONS") return undefined;

  return (async () => {
    const tabId = sender?.tab?.id;
    if (!Number.isInteger(tabId) || tabId < 0 || !braveFoxIsFirefoxSystemPasswordPage(sender)) {
      return { ok: false, error: "Firefox system-page unlock request denied." };
    }

    if (message.type === "BRAVEFOX_EXT_UNLOCK") {
      if (!braveFoxFirefoxSystemOriginalUrls.has(tabId)) {
        return { ok: false, error: "Firefox system-page unlock request expired." };
      }
      braveFoxGrantFirefoxSystemBypass(tabId);
      return {
        ok: true,
        ttlMs: BRAVEFOX_FIREFOX_SYSTEM_BYPASS_TTL_MS
      };
    }

    if (!braveFoxIsFirefoxSystemBypassed(tabId) || !braveFoxFirefoxSystemOriginalUrls.has(tabId)) {
      return { ok: false, error: "Firefox system-page return request expired." };
    }

    try {
      await browser.tabs.goBack(tabId);
      braveFoxFirefoxSystemOriginalUrls.delete(tabId);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  })();
});



// ---------------------------------------------------------------------------
// addons.mozilla.org password gate — Firefox/Fenix restricted-domain fallback
// ---------------------------------------------------------------------------
// AMO is a Firefox restricted domain. Do not inject into it or rely on webRequest/DNR.
// Instead, identify AMO navigation from tab metadata, open our trusted extension password
// page, close the AMO tab, and let the trusted password page navigate back only after a
// successful unlock. This mirrors the Chromium build's addons.mozilla.org/* protection.
const BRAVEFOX_AMO_BYPASS_TTL_MS = 5 * 60 * 1000;
let braveFoxAmoBypassUntil = 0;
const braveFoxAmoPendingRequests = new Map();
const braveFoxAmoRedirectingTabs = new Set();
let braveFoxAmoPollTimer = 0;

function braveFoxIsProtectedAmoUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    return url.protocol === "https:" && url.hostname.toLowerCase() === "addons.mozilla.org";
  } catch (_) {
    return false;
  }
}

function braveFoxAmoLocaleFallbackUrl() {
  try {
    const raw = String(browser.i18n?.getUILanguage?.() || "en-US").trim();
    const locale = /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(raw) ? raw : "en-US";
    return `https://addons.mozilla.org/${locale}/android/addon/bravefox-enhancer/`;
  } catch (_) {
    return "https://addons.mozilla.org/en-US/android/addon/bravefox-enhancer/";
  }
}

function braveFoxGetProtectedAmoTargetFromTab(tab) {
  try {
    const url = String(tab?.url || "");
    if (braveFoxIsProtectedAmoUrl(url)) return url;

    // Fenix may withhold/sanitize URL details for Mozilla-restricted pages. In that case,
    // require both a BraveFox-specific title and an AMO-origin signal before treating it
    // as our listing. This avoids gating unrelated AMO pages.
    const title = String(tab?.title || "").toLowerCase();
    const favIconUrl = String(tab?.favIconUrl || "").toLowerCase();
    const urlLower = url.toLowerCase();
    const titleMatches = title.includes("bravefox enhancer");
    const amoSignal = urlLower.includes("addons.mozilla.org") || favIconUrl.includes("addons.mozilla.org");
    if (titleMatches && amoSignal) return braveFoxAmoLocaleFallbackUrl();
  } catch (_) {}
  return "";
}

function braveFoxIsAmoBypassed(tabId) {
  if (Date.now() <= braveFoxAmoBypassUntil) return true;
  braveFoxAmoBypassUntil = 0;
  // Stronger Firefox-system authorization inherits downward when the same tab carries it.
  return braveFoxIsFirefoxSystemBypassed(tabId);
}

function braveFoxGrantAmoBypass() {
  braveFoxAmoBypassUntil = Date.now() + BRAVEFOX_AMO_BYPASS_TTL_MS;
  return braveFoxAmoBypassUntil;
}

function braveFoxMakeAmoRequestId() {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  } catch (_) {
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function braveFoxIsAmoPasswordPage(sender, requestId = "") {
  try {
    const url = new URL(String(sender?.url || sender?.tab?.url || ""));
    const extensionOrigin = new URL(browser.runtime.getURL("/")).origin;
    return url.origin === extensionOrigin &&
      url.pathname === "/html/password-protected.html" &&
      url.searchParams.get("target") === "bravefox-amo" &&
      (!requestId || url.searchParams.get("request") === requestId);
  } catch (_) {
    return false;
  }
}

function braveFoxPruneAmoRequests() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [requestId, pending] of braveFoxAmoPendingRequests) {
    if (!pending || Number(pending.createdAt || 0) < cutoff) braveFoxAmoPendingRequests.delete(requestId);
  }
}

async function braveFoxOpenAmoPasswordGate(tabId, originalUrl) {
  if (!Number.isInteger(tabId) || tabId < 0 || !originalUrl) return false;
  if (braveFoxIsAmoBypassed(tabId) || braveFoxAmoRedirectingTabs.has(tabId)) return false;

  braveFoxAmoRedirectingTabs.add(tabId);
  braveFoxPruneAmoRequests();

  const requestId = braveFoxMakeAmoRequestId();
  braveFoxAmoPendingRequests.set(requestId, {
    originalUrl: String(originalUrl),
    sourceTabId: tabId,
    createdAt: Date.now()
  });

  const params = new URLSearchParams({
    target: "bravefox-amo",
    request: requestId,
    compact: "1",
    title: "addons.mozilla.org is password protected"
  });
  const gateUrl = browser.runtime.getURL(`html/password-protected.html?${params.toString()}`);

  try {
    // Fenix is more reliable when a trusted extension tab is created normally than when
    // an already-restricted AMO tab is navigated in place by tabs.update(). New tabs open
    // selected by default on Android, so no unsupported `active` flag is required here.
    const gateTab = await browser.tabs.create({ url: gateUrl });
    if (!gateTab?.id) throw new Error("Firefox did not create the BraveFox password tab.");

    try { await browser.tabs.remove(tabId); } catch (_) {}
    return true;
  } catch (error) {
    braveFoxAmoPendingRequests.delete(requestId);
    console.warn(`${LOG_PREFIX} Could not open BraveFox AMO password gate:`, error);
    return false;
  } finally {
    braveFoxAmoRedirectingTabs.delete(tabId);
  }
}

function braveFoxCheckAmoTab(tab) {
  try {
    const tabId = tab?.id;
    if (!Number.isInteger(tabId) || tabId < 0 || braveFoxIsAmoBypassed(tabId)) return;
    const targetUrl = braveFoxGetProtectedAmoTargetFromTab(tab);
    if (!targetUrl) return;
    void braveFoxOpenAmoPasswordGate(tabId, targetUrl);
  } catch (_) {}
}

async function braveFoxCheckAmoTabById(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  try {
    const tab = await browser.tabs.get(tabId);
    braveFoxCheckAmoTab(tab);
  } catch (_) {}
}

async function braveFoxPollActiveAmoTabs() {
  try {
    const tabs = await browser.tabs.query({ active: true });
    for (const tab of tabs || []) braveFoxCheckAmoTab(tab);
  } catch (_) {}
}

if (browser.tabs?.onCreated) {
  browser.tabs.onCreated.addListener(tab => braveFoxCheckAmoTab(tab));
}
if (browser.tabs?.onUpdated) {
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    braveFoxCheckAmoTab({
      ...(tab || {}),
      id: tabId,
      url: changeInfo?.url || tab?.url || "",
      title: changeInfo?.title || tab?.title || "",
      favIconUrl: changeInfo?.favIconUrl || tab?.favIconUrl || ""
    });
  });
}
if (browser.tabs?.onActivated) {
  browser.tabs.onActivated.addListener(activeInfo => {
    void braveFoxCheckAmoTabById(activeInfo?.tabId);
  });
}
if (browser.tabs?.onRemoved) {
  browser.tabs.onRemoved.addListener(tabId => {
    braveFoxAmoRedirectingTabs.delete(tabId);
  });
}

// Android/Fenix fallback: restricted-domain navigation can be quiet. Poll only active
// tab metadata at a low rate; this does not inspect page DOM or run code on AMO itself.
try {
  const braveFoxBackgroundIsAndroid = /Android/i.test(String(globalThis.navigator?.userAgent || ""));
  if (braveFoxBackgroundIsAndroid && !braveFoxAmoPollTimer) {
    braveFoxAmoPollTimer = setInterval(() => {
      void braveFoxPollActiveAmoTabs();
    }, 700);
  }
} catch (_) {}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object" || message.type !== "BRAVEFOX_AMO_UNLOCK") return undefined;

  return (async () => {
    const requestId = String(message.requestId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
    if (!requestId || !braveFoxIsAmoPasswordPage(sender, requestId)) {
      return { ok: false, error: "BraveFox AMO unlock request denied." };
    }

    braveFoxPruneAmoRequests();
    const pending = braveFoxAmoPendingRequests.get(requestId);
    if (!pending?.originalUrl) {
      return { ok: false, error: "BraveFox AMO unlock request expired." };
    }

    braveFoxAmoPendingRequests.delete(requestId);
    braveFoxGrantAmoBypass();
    return {
      ok: true,
      ttlMs: BRAVEFOX_AMO_BYPASS_TTL_MS,
      returnUrl: pending.originalUrl
    };
  })();
});

// ---------------------------------------------------------------------------
// BraveFox top-level web/action password bridge — Firefox parity 2026-09-20
// ---------------------------------------------------------------------------
// Protected web pages use the same native top-level extension password screen as
// the Chromium build. Timed grants last five minutes, while Gemini, GitHub Copilot,
// and Wise Old Man use browser-session grants. Sensitive in-page actions stay one-shot.
const BRAVEFOX_WEB_AUTH_STATE_KEY = "bravefoxWebAuthState_v1";
const BRAVEFOX_WEB_AUTH_REQUEST_TTL_MS = 2 * 60 * 1000;
const BRAVEFOX_WEB_PAGE_GRANT_TTL_MS = 5 * 60 * 1000;
const BRAVEFOX_WEB_ACTION_GRANT_TTL_MS = 60 * 1000;
const braveFoxWebAuthMemoryFallback = { requests: {}, pageGrants: {}, actionGrants: {} };

const BRAVEFOX_WEB_SESSION_PAGE_SCOPES = Object.freeze({
  GITHUB_COPILOT: "github-copilot",
  GEMINI: "gemini-google",
  WISEOLDMAN: "wiseoldman-net"
});

const BRAVEFOX_WEB_ONE_TIME_PAGE_SCOPES = Object.freeze({
  GEMINI_SAVED_INFO: "gemini-saved-info"
});

function braveFoxNewWebAuthRequestId() {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  } catch (_) {}
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

function braveFoxNormalizeWebGateUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch (_) {
    return "";
  }
}

function braveFoxWebGateHost(rawUrl) {
  try {
    return new URL(String(rawUrl || "")).hostname.toLowerCase();
  } catch (_) {
    return "";
  }
}

function braveFoxWebOneTimePageScope(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    const host = url.hostname.toLowerCase();
    const path = (url.pathname || "/").replace(/\/+$/, "") || "/";

    if (host === "gemini.google.com" && (path === "/saved-info" || path.startsWith("/saved-info/"))) {
      return BRAVEFOX_WEB_ONE_TIME_PAGE_SCOPES.GEMINI_SAVED_INFO;
    }
  } catch (_) {}

  return "";
}

function braveFoxWebSessionPageScope(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    const host = url.hostname.toLowerCase();
    const path = url.pathname || "/";

    if (host === "gemini.google.com") {
      if (braveFoxWebOneTimePageScope(rawUrl)) return "";
      return BRAVEFOX_WEB_SESSION_PAGE_SCOPES.GEMINI;
    }

    if (host === "github.com" && (/^\/copilot(?:\/|$)/i.test(path) || /^\/features\/copilot(?:\/|$)/i.test(path))) {
      return BRAVEFOX_WEB_SESSION_PAGE_SCOPES.GITHUB_COPILOT;
    }

    if (host === "wiseoldman.net" || host === "www.wiseoldman.net") {
      return BRAVEFOX_WEB_SESSION_PAGE_SCOPES.WISEOLDMAN;
    }
  } catch (_) {}

  return "";
}

function braveFoxWebPageGrantKey(tabId, rawUrl) {
  const oneTimeScope = braveFoxWebOneTimePageScope(rawUrl);
  if (oneTimeScope) return Number.isInteger(tabId) ? `one-time:${tabId}:${oneTimeScope}` : "";

  const sessionScope = braveFoxWebSessionPageScope(rawUrl);
  if (sessionScope) return `session:${sessionScope}`;

  const host = braveFoxWebGateHost(rawUrl);
  return Number.isInteger(tabId) && host ? `${tabId}:${host}` : "";
}

function braveFoxWebPageGrantIsActive(grant) {
  if (!grant || typeof grant !== "object") return false;
  if (grant.mode === "session") return true;
  return Number(grant.expiresAt) > Date.now();
}

function braveFoxWebActionGrantKey(tabId, rawUrl, actionKey) {
  const host = braveFoxWebGateHost(rawUrl);
  const action = String(actionKey || "").trim().toLowerCase().slice(0, 160);
  return Number.isInteger(tabId) && host && action ? `${tabId}:${host}:${action}` : "";
}

async function braveFoxLoadWebAuthState() {
  try {
    if (!browser.storage?.session) {
      return structuredClone(braveFoxWebAuthMemoryFallback);
    }
    const stored = await browser.storage.session.get(BRAVEFOX_WEB_AUTH_STATE_KEY);
    const state = stored?.[BRAVEFOX_WEB_AUTH_STATE_KEY];
    return {
      requests: state?.requests && typeof state.requests === "object" ? state.requests : {},
      pageGrants: state?.pageGrants && typeof state.pageGrants === "object" ? state.pageGrants : {},
      actionGrants: state?.actionGrants && typeof state.actionGrants === "object" ? state.actionGrants : {}
    };
  } catch (_) {
    return structuredClone(braveFoxWebAuthMemoryFallback);
  }
}

async function braveFoxSaveWebAuthState(state) {
  const normalized = {
    requests: state?.requests || {},
    pageGrants: state?.pageGrants || {},
    actionGrants: state?.actionGrants || {}
  };

  if (!browser.storage?.session) {
    braveFoxWebAuthMemoryFallback.requests = structuredClone(normalized.requests);
    braveFoxWebAuthMemoryFallback.pageGrants = structuredClone(normalized.pageGrants);
    braveFoxWebAuthMemoryFallback.actionGrants = structuredClone(normalized.actionGrants);
    return;
  }

  try {
    await browser.storage.session.set({ [BRAVEFOX_WEB_AUTH_STATE_KEY]: normalized });
  } catch (_) {
    braveFoxWebAuthMemoryFallback.requests = structuredClone(normalized.requests);
    braveFoxWebAuthMemoryFallback.pageGrants = structuredClone(normalized.pageGrants);
    braveFoxWebAuthMemoryFallback.actionGrants = structuredClone(normalized.actionGrants);
  }
}

function braveFoxPruneWebAuthState(state) {
  const now = Date.now();

  for (const [id, request] of Object.entries(state.requests || {})) {
    if (!request || Number(request.expiresAt) <= now) delete state.requests[id];
  }

  for (const [key, grant] of Object.entries(state.pageGrants || {})) {
    if (!grant || typeof grant !== "object") {
      delete state.pageGrants[key];
      continue;
    }
    if (grant.mode === "session") continue;
    if (Number(grant.expiresAt) <= now) delete state.pageGrants[key];
  }

  for (const [key, grant] of Object.entries(state.actionGrants || {})) {
    if (!grant || Number(grant.expiresAt) <= now) delete state.actionGrants[key];
  }

  return state;
}

function braveFoxIsWebPasswordPage(sender, requestId = "") {
  try {
    const url = new URL(String(sender?.url || sender?.tab?.url || ""));
    const extensionOrigin = new URL(browser.runtime.getURL("/")).origin;
    return url.origin === extensionOrigin &&
      url.pathname === "/html/password-protected.html" &&
      url.searchParams.get("target") === "web" &&
      (!requestId || url.searchParams.get("request") === requestId);
  } catch (_) {
    return false;
  }
}

function braveFoxFindPendingWebAuthRequest(state, kind, tabId, returnUrl, actionKey = "") {
  for (const request of Object.values(state.requests || {})) {
    if (!request || request.kind !== kind || request.tabId !== tabId || request.returnUrl !== returnUrl) continue;
    if (kind === "action" && request.actionKey !== actionKey) continue;
    if (Number(request.expiresAt) <= Date.now()) continue;
    return request;
  }
  return null;
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object") return undefined;
  if (!String(message.type || "").startsWith("BRAVEFOX_WEB_")) return undefined;

  return (async () => {
    const tabId = sender?.tab?.id;
    if (!Number.isInteger(tabId)) throw new Error("BraveFox password gate could not identify the tab.");

    if (message.type === "BRAVEFOX_WEB_AUTH_GATE") {
      const senderUrl = braveFoxNormalizeWebGateUrl(sender?.tab?.url || sender?.url || "");
      const returnUrl = braveFoxNormalizeWebGateUrl(message.returnUrl || senderUrl);
      if (!senderUrl || !returnUrl || braveFoxWebGateHost(senderUrl) !== braveFoxWebGateHost(returnUrl)) {
        throw new Error("BraveFox password gate return URL was denied.");
      }

      const state = braveFoxPruneWebAuthState(await braveFoxLoadWebAuthState());
      const grantKey = braveFoxWebPageGrantKey(tabId, returnUrl);
      const grant = state.pageGrants[grantKey];

      if (braveFoxWebPageGrantIsActive(grant)) {
        const oneTime = grant.mode === "one-time";
        if (oneTime) delete state.pageGrants[grantKey];
        await braveFoxSaveWebAuthState(state);
        return {
          ok: true,
          unlocked: true,
          session: grant.mode === "session",
          oneTime,
          expiresAt: grant.mode === "session" || oneTime ? null : grant.expiresAt
        };
      }

      let request = braveFoxFindPendingWebAuthRequest(state, "page", tabId, returnUrl);
      if (!request) {
        const requestId = braveFoxNewWebAuthRequestId();
        request = {
          requestId,
          kind: "page",
          tabId,
          returnUrl,
          host: braveFoxWebGateHost(returnUrl),
          title: String(message.title || "Password required").slice(0, 180),
          createdAt: Date.now(),
          expiresAt: Date.now() + BRAVEFOX_WEB_AUTH_REQUEST_TTL_MS
        };
        state.requests[requestId] = request;
      }

      await braveFoxSaveWebAuthState(state);
      const params = new URLSearchParams({
        target: "web",
        request: request.requestId,
        compact: "1",
        title: request.title
      });
      await browser.tabs.update(tabId, {
        url: browser.runtime.getURL(`html/password-protected.html?${params.toString()}`)
      });
      return { ok: true, unlocked: false, redirecting: true };
    }

    if (message.type === "BRAVEFOX_WEB_ACTION_GATE") {
      const senderUrl = braveFoxNormalizeWebGateUrl(sender?.tab?.url || sender?.url || "");
      const returnUrl = braveFoxNormalizeWebGateUrl(message.returnUrl || senderUrl);
      const actionKey = String(message.actionKey || "generic-action")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .slice(0, 160);

      if (!senderUrl || !returnUrl || !actionKey || braveFoxWebGateHost(senderUrl) !== braveFoxWebGateHost(returnUrl)) {
        throw new Error("BraveFox action password request was denied.");
      }

      const state = braveFoxPruneWebAuthState(await braveFoxLoadWebAuthState());
      const grantKey = braveFoxWebActionGrantKey(tabId, returnUrl, actionKey);
      const grant = state.actionGrants[grantKey];

      if (grant && Number(grant.expiresAt) > Date.now()) {
        delete state.actionGrants[grantKey];
        await braveFoxSaveWebAuthState(state);
        return { ok: true, unlocked: true };
      }

      let request = braveFoxFindPendingWebAuthRequest(state, "action", tabId, returnUrl, actionKey);
      if (!request) {
        const requestId = braveFoxNewWebAuthRequestId();
        request = {
          requestId,
          kind: "action",
          actionKey,
          tabId,
          returnUrl,
          host: braveFoxWebGateHost(returnUrl),
          title: String(message.title || "Password required").slice(0, 180),
          createdAt: Date.now(),
          expiresAt: Date.now() + BRAVEFOX_WEB_AUTH_REQUEST_TTL_MS
        };
        state.requests[requestId] = request;
      }

      await braveFoxSaveWebAuthState(state);
      const params = new URLSearchParams({
        target: "web",
        request: request.requestId,
        compact: "1",
        title: request.title
      });
      await browser.tabs.update(tabId, {
        url: browser.runtime.getURL(`html/password-protected.html?${params.toString()}`)
      });
      return { ok: true, unlocked: false, redirecting: true };
    }

    if (message.type === "BRAVEFOX_WEB_AUTH_APPROVE") {
      const requestId = String(message.requestId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
      if (!requestId || !braveFoxIsWebPasswordPage(sender, requestId)) {
        throw new Error("BraveFox password approval was denied.");
      }

      const state = braveFoxPruneWebAuthState(await braveFoxLoadWebAuthState());
      const request = state.requests[requestId];
      if (!request || request.tabId !== tabId) throw new Error("BraveFox password request expired.");

      if (request.kind === "action") {
        const grantKey = braveFoxWebActionGrantKey(tabId, request.returnUrl, request.actionKey);
        state.actionGrants[grantKey] = {
          actionKey: request.actionKey,
          expiresAt: Date.now() + BRAVEFOX_WEB_ACTION_GRANT_TTL_MS
        };
      } else {
        const grantKey = braveFoxWebPageGrantKey(tabId, request.returnUrl);
        const oneTimeScope = braveFoxWebOneTimePageScope(request.returnUrl);
        const sessionScope = braveFoxWebSessionPageScope(request.returnUrl);

        if (oneTimeScope) {
          state.pageGrants[grantKey] = {
            mode: "one-time",
            scope: oneTimeScope,
            host: request.host,
            expiresAt: Date.now() + BRAVEFOX_WEB_AUTH_REQUEST_TTL_MS
          };
        } else if (sessionScope) {
          state.pageGrants[grantKey] = {
            mode: "session",
            scope: sessionScope,
            host: request.host,
            grantedAt: Date.now()
          };
        } else {
          state.pageGrants[grantKey] = {
            mode: "timed",
            host: request.host,
            expiresAt: Date.now() + BRAVEFOX_WEB_PAGE_GRANT_TTL_MS
          };
        }
      }

      delete state.requests[requestId];
      await braveFoxSaveWebAuthState(state);
      await browser.tabs.update(tabId, { url: request.returnUrl });
      return { ok: true };
    }

    return { ok: false, error: "Unknown BraveFox web password message." };
  })().catch(error => ({ ok: false, error: String(error?.message || error) }));
});


// ---------------------------------------------------------------------------
// ChatGPT secondary-browser route closure + native password-page bridge
// ---------------------------------------------------------------------------
const BRAVEFOX_CHATGPT_AUTH_KEY = "bravefoxChatGptAuthRequests_v1";
const BRAVEFOX_CHATGPT_AUTH_TTL_MS = 2 * 60 * 1000;
const braveFoxChatGptAuthRequests = new Map();
const braveFoxChatGptTabsClosing = new Set();

function braveFoxNormalizeChatGptPath(pathname) {
  const path = String(pathname || "/").toLowerCase().replace(/\/+$/, "");
  return path || "/";
}

function braveFoxIsRestrictedChatGptUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "chatgpt.com") return false;
    const path = braveFoxNormalizeChatGptPath(url.pathname);
    return ["/plugins", "/gpts", "/images"].some(base => path === base || path.startsWith(`${base}/`));
  } catch (_) {
    return false;
  }
}

function braveFoxChatGptProtectedRouteKey(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "chatgpt.com") return "";
    const path = braveFoxNormalizeChatGptPath(url.pathname);
    const hash = decodeURIComponent(url.hash || "").toLowerCase();
    if (path === "/library/d/6ab47ad73fe88191b5861b9b1f45132a" || path.startsWith("/library/d/6ab47ad73fe88191b5861b9b1f45132a/")) return "library-protected-files";
    if (hash.startsWith("#settings/personalization")) return "personalization";
    return "";
  } catch (_) {
    return "";
  }
}

async function braveFoxLoadChatGptAuthRequests() {
  try {
    if (browser.storage?.session) {
      const state = await browser.storage.session.get([BRAVEFOX_CHATGPT_AUTH_KEY]);
      const requests = state?.[BRAVEFOX_CHATGPT_AUTH_KEY];
      if (requests && typeof requests === "object") return requests;
    }
  } catch (_) {}

  const requests = {};
  for (const [id, request] of braveFoxChatGptAuthRequests.entries()) requests[id] = request;
  return requests;
}

async function braveFoxSaveChatGptAuthRequests(requests) {
  braveFoxChatGptAuthRequests.clear();
  for (const [id, request] of Object.entries(requests || {})) braveFoxChatGptAuthRequests.set(id, request);

  try {
    if (browser.storage?.session) {
      await browser.storage.session.set({ [BRAVEFOX_CHATGPT_AUTH_KEY]: requests || {} });
    }
  } catch (_) {}
}

function braveFoxPruneChatGptAuthRequests(requests) {
  const now = Date.now();
  for (const [id, request] of Object.entries(requests || {})) {
    if (!request || Number(request.expiresAt) <= now) delete requests[id];
  }
  return requests;
}

function braveFoxIsChatGptPasswordPage(sender, requestId = "") {
  try {
    const url = new URL(String(sender?.url || sender?.tab?.url || ""));
    const extensionOrigin = new URL(browser.runtime.getURL("/")).origin;
    return url.origin === extensionOrigin &&
      url.pathname === "/html/password-protected.html" &&
      url.searchParams.get("target") === "chatgpt" &&
      (!requestId || url.searchParams.get("request") === requestId);
  } catch (_) {
    return false;
  }
}

async function braveFoxCloseChatGptTab(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0 || braveFoxChatGptTabsClosing.has(tabId)) return false;
  braveFoxChatGptTabsClosing.add(tabId);
  try {
    await browser.tabs.remove(tabId);
    return true;
  } catch (_) {
    return false;
  } finally {
    braveFoxChatGptTabsClosing.delete(tabId);
  }
}

function braveFoxHandleRestrictedChatGptNavigation(details) {
  if (braveFoxIsTwitchUrl(details?.url)) return;
  if (details?.frameId !== 0 || details?.tabId < 0 || !braveFoxIsRestrictedChatGptUrl(details.url)) return;
  void braveFoxCloseChatGptTab(details.tabId);
}

if (browser.webNavigation?.onCommitted) {
  browser.webNavigation.onCommitted.addListener(braveFoxHandleRestrictedChatGptNavigation);
}
if (browser.webNavigation?.onHistoryStateUpdated) {
  browser.webNavigation.onHistoryStateUpdated.addListener(braveFoxHandleRestrictedChatGptNavigation);
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object") return undefined;

  if (message.type === "BRAVEFOX_CHATGPT_CLOSE_RESTRICTED") {
    const tabId = sender?.tab?.id;
    const targetUrl = String(message.targetUrl || sender?.tab?.url || sender?.url || "");
    if (!Number.isInteger(tabId) || !braveFoxIsRestrictedChatGptUrl(targetUrl)) {
      return Promise.resolve({ ok: false, error: "Restricted ChatGPT close request denied." });
    }
    return braveFoxCloseChatGptTab(tabId).then(ok => ({ ok, error: ok ? "" : "Firefox could not close the tab." }));
  }

  if (!String(message.type || "").startsWith("BRAVEFOX_CHATGPT_AUTH_")) return undefined;

  return (async () => {
    const tabId = sender?.tab?.id;
    if (!Number.isInteger(tabId)) throw new Error("ChatGPT auth tab could not be identified.");

    if (message.type === "BRAVEFOX_CHATGPT_AUTH_BEGIN") {
      const senderUrl = String(sender?.url || sender?.tab?.url || "");
      if (!senderUrl.startsWith("https://chatgpt.com/")) throw new Error("ChatGPT auth request denied.");

      const returnUrl = String(message.returnUrl || "").trim();
      const routeKey = braveFoxChatGptProtectedRouteKey(returnUrl);
      if (!routeKey) throw new Error("ChatGPT auth return route is not protected.");

      const requestId = String(message.requestId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
      if (!requestId) throw new Error("ChatGPT auth request id is missing.");

      const kind = ["protected-route", "memory-summary", "plugin-install", "library-file-delete", "library-edit-mode"].includes(message.kind)
        ? message.kind
        : "protected-route";
      const sourcePayload = message.payload && typeof message.payload === "object" ? message.payload : {};
      const payload = {
        pluginKey: String(sourcePayload.pluginKey || "").slice(0, 300),
        fileName: String(sourcePayload.fileName || "").slice(0, 500),
        href: String(sourcePayload.href || "").slice(0, 1200),
        rowText: String(sourcePayload.rowText || "").slice(0, 1200)
      };
      const title = String(message.title || "ChatGPT page is password protected").slice(0, 180);

      const requests = braveFoxPruneChatGptAuthRequests(await braveFoxLoadChatGptAuthRequests());
      requests[requestId] = {
        requestId,
        tabId,
        returnUrl,
        routeKey,
        kind,
        payload,
        title,
        approved: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + BRAVEFOX_CHATGPT_AUTH_TTL_MS
      };
      await braveFoxSaveChatGptAuthRequests(requests);

      const params = new URLSearchParams({
        target: "chatgpt",
        request: requestId,
        compact: "1",
        title
      });
      await browser.tabs.update(tabId, {
        url: browser.runtime.getURL(`html/password-protected.html?${params.toString()}`)
      });
      return { ok: true };
    }

    if (message.type === "BRAVEFOX_CHATGPT_AUTH_APPROVE") {
      const requestId = String(message.requestId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
      if (!requestId || !braveFoxIsChatGptPasswordPage(sender, requestId)) {
        throw new Error("ChatGPT auth approval denied.");
      }

      const requests = braveFoxPruneChatGptAuthRequests(await braveFoxLoadChatGptAuthRequests());
      const request = requests[requestId];
      if (!request || request.tabId !== tabId) throw new Error("ChatGPT auth request expired.");
      request.approved = true;
      request.expiresAt = Date.now() + 60 * 1000;
      requests[requestId] = request;
      await braveFoxSaveChatGptAuthRequests(requests);
      await browser.tabs.update(tabId, { url: request.returnUrl });
      return { ok: true };
    }

    if (message.type === "BRAVEFOX_CHATGPT_AUTH_CONSUME") {
      const currentUrl = String(sender?.url || sender?.tab?.url || "");
      const routeKey = braveFoxChatGptProtectedRouteKey(currentUrl);
      if (!routeKey) return { ok: true, unlocked: false };

      const requests = braveFoxPruneChatGptAuthRequests(await braveFoxLoadChatGptAuthRequests());
      let matchId = "";
      let match = null;
      for (const [id, request] of Object.entries(requests)) {
        if (!request?.approved || request.tabId !== tabId || request.routeKey !== routeKey) continue;
        if (!match || Number(request.createdAt) > Number(match.createdAt)) {
          matchId = id;
          match = request;
        }
      }
      if (!match) {
        await braveFoxSaveChatGptAuthRequests(requests);
        return { ok: true, unlocked: false };
      }

      delete requests[matchId];
      await braveFoxSaveChatGptAuthRequests(requests);
      return {
        ok: true,
        unlocked: true,
        routeKey: match.routeKey,
        kind: match.kind,
        payload: match.payload || {}
      };
    }

    return { ok: false, error: "Unknown ChatGPT auth message." };
  })().catch(error => ({ ok: false, error: String(error?.message || error) }));
});

// ---------------------------------------------------------------------------
// Firefox-PC redirect logger bridge for BraveFox Enhancer (BFE) content scripts
// ---------------------------------------------------------------------------
const NATIVE_REDIRECT_LOG_TYPE = 'BRAVEFOX_REDIRECT_LOG';
const NATIVE_REDIRECT_LOG_HOST = 'com.bravefox.redirect_logger';
let nativeRedirectBrowserInfoPromise = null;

function cleanNativeRedirectText(value, maxLength = 1000) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function highlightNativeRedirectSearch(value, trigger) {
  const text = cleanNativeRedirectText(value, 1000);
  const term = cleanNativeRedirectText(trigger, 240);
  if (!text || !term) return text;
  try {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\*${escaped}\\*`, 'i').test(text)) return text;
    return text.replace(new RegExp(escaped, 'ig'), match => `*${match}*`);
  } catch {
    return text;
  }
}

function getFirefoxRedirectBrowserInfo() {
  if (!nativeRedirectBrowserInfoPromise) {
    nativeRedirectBrowserInfoPromise = (async () => {
      const platform = await browser.runtime.getPlatformInfo();
      if (platform?.os === 'android') return null;
      const info = typeof browser.runtime.getBrowserInfo === 'function'
        ? await browser.runtime.getBrowserInfo()
        : { name: 'Firefox', version: '' };
      return {
        browserName: info?.name || 'Firefox',
        browserVersion: info?.version || '',
        browserEdition: 'ESR',
        browserBuildId: info?.buildID || '',
        browserPlatform: platform?.os || 'desktop'
      };
    })();
  }
  return nativeRedirectBrowserInfoPromise;
}

async function canUseFirefoxRedirectLogger() {
  try {
    const info = await getFirefoxRedirectBrowserInfo();
    if (!info || typeof browser.runtime.sendNativeMessage !== 'function') return false;
    return await browser.permissions.contains({ permissions: ['nativeMessaging'] });
  } catch {
    return false;
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== NATIVE_REDIRECT_LOG_TYPE) return undefined;

  return (async () => {
    if (!(await canUseFirefoxRedirectLogger())) return { ok: false, error: 'native-logger-not-enabled' };
    const manifest = browser.runtime.getManifest();
    const detector = cleanNativeRedirectText(message.source || '', 120);
    const context = cleanNativeRedirectText(message.context || '', 300);
    const payload = {
      type: NATIVE_REDIRECT_LOG_TYPE,
      source: 'BraveFox Enhancer (BFE)',
      sourceCode: 'BFE',
      extensionName: manifest.name || '',
      extensionVersion: manifest.version || '',
      reasonType: message.reasonType || 'term',
      reasonDetail: message.reasonDetail || [detector, context].filter(Boolean).join(' — ') || 'BraveFox Enhancer content filter',
      blockedWord: cleanNativeRedirectText(message.blockedWord, 240),
      attemptedSearch: highlightNativeRedirectSearch(message.attemptedSearch, message.blockedWord),
      context,
      pageUrl: cleanNativeRedirectText(message.pageUrl || sender?.tab?.url || '', 1000),
      referrer: cleanNativeRedirectText(message.referrer, 1000),
      timestamp: cleanNativeRedirectText(message.timestamp || new Date().toISOString(), 80),
      ...(await getFirefoxRedirectBrowserInfo())
    };
    try {
      return await browser.runtime.sendNativeMessage(NATIVE_REDIRECT_LOG_HOST, payload);
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  })();
});

async function main() {
  const manifest = browser.runtime.getManifest();
  // Load the unified Focus Master dataset before request interception so
  // TrustedSites DOMAIN/PATH exceptions are live from the first request.
  await loadDataset({ force: true });
  const platformInfo = await browser.runtime.getPlatformInfo();
  const isAndroid = platformInfo?.os === "android";

  platformModule = isAndroid
    ? await import("./modules/fenix-nightly.js")
    : await import("./modules/pc-esr.js");

  await platformModule.initializePlatform?.();
  await loadHostsCache();
  installRequestListener();
  void braveFoxScanOpenFirefoxSystemTabs();
  setupAlarms();
  await runStartupUpdates(false);

  console.log(`${LOG_PREFIX} BraveFox Enhancer ${manifest.version} initialized for ${isAndroid ? "Fenix Nightly" : "Firefox PC/ESR"}.`);
}

main().catch(error => {
  console.error(`${LOG_PREFIX} Fatal initialization failure:`, error);
});
