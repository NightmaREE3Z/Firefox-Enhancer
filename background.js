(function () {
const timestamp = new Date()
    .toLocaleTimeString('fi-FI', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
    .replace('.', ':');
console.log(`[${timestamp}] BraveFox Enhancer ${browser.runtime.getManifest ? browser.runtime.getManifest().version : 'v_unknown'} initialized!`);

// Memory optimization constants for large hosts files
const MAX_RETRIES = 3;
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_HOSTS_PER_BATCH = 10000;
const STORAGE_COMPRESSION_THRESHOLD = 50000;

// List of URLs to block (Firefox format)
const urlsToBlock = [
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
    "*://*.snapchat.com/*", 
];

// Blocked TLDs for auto-closure
const blockedTLDs = [
    '.ai', '.art', '.makeup', '.off', '.club', '.id', '.it', '.best', '.cc', '.cn', '.click', '.exposed',
    '.you', '.to', '.top', '.me', '.us', '.ru', '.vip', '.online', '.hot', '.her', '.sex', '.xxx', '.nsfw',
    '.porn', '.show', '.work', '.fit', '.tool', '.tools', '.system', '.systems', '.surf', '.review', '.asia',
    '.tokyo', '.monster', '.info', '.机构', '.xn--nqv7f', '.one', '.ee', '.in', '.gf', '.fox', '.fun', '.fyi', 
    '.fr', '.life', '.now', '.today', '.world', '.xyz', '.zone', '.nude'
];

// Dynamically convert TLDs into Match Patterns and inject into urlsToBlock
blockedTLDs.forEach(tld => {
    urlsToBlock.push(`*://*${tld}/*`);
});

// Memory tracking
let memoryCleanupCount = 0;
let currentBlockedUrls = [];

// Optimized function to block requests
function blockRequest(details) {
    console.log(`Blocking access to forbidden URL: ${details.url}`);
    return { cancel: true };
}

// Add listener for blocking URLs
browser.webRequest.onBeforeRequest.addListener(
    blockRequest,
    { urls: urlsToBlock },
    ["blocking"]
);

// Memory-optimized function to fetch and parse hosts file (optimized for 100k+ entries)
const fetchHostsFile = async (url, retries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Fetching hosts file from ${url}, attempt ${attempt}...`);
            const response = await fetch(url, { 
                cache: "no-store",
                headers: {
                    'Accept': 'text/plain',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            console.log(`Raw file size: ${text.length} characters`);
            
            const hosts = [];
            const lines = text.split('\n');
            console.log(`Processing ${lines.length} lines in batches of ${MAX_HOSTS_PER_BATCH}...`);
            
            for (let i = 0; i < lines.length; i += MAX_HOSTS_PER_BATCH) {
                const batch = lines.slice(i, i + MAX_HOSTS_PER_BATCH);
                const batchHosts = batch
                    .filter(line => {
                        const trimmed = line.trim();
                        return trimmed && !trimmed.startsWith('#') && trimmed.includes('.');
                    })
                    .map(line => {
                        const parts = line.trim().split(/\s+/);
                        return parts.length > 1 ? parts[1].toLowerCase() : null;
                    })
                    .filter(Boolean);
                
                hosts.push(...batchHosts);
                
                // Progress logging for large files
                if (i % (MAX_HOSTS_PER_BATCH * 10) === 0 && i > 0) {
                    console.log(`Processed ${i}/${lines.length} lines (${Math.round((i/lines.length)*100)}%)`);
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            console.log(`Successfully fetched and processed ${hosts.length} hosts from ${url}`);
            lines.length = 0;
            return hosts;
        } catch (error) {
            console.error(`Failed to fetch the hosts file from ${url} on attempt ${attempt}:`, error);
            if (attempt === retries) {
                console.error(`All ${retries} attempts to fetch the hosts file from ${url} failed.`);
            } else {
                console.log(`Retrying in 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    return [];
};

// Memory-optimized storage function for large hosts lists
const storeHostsList = (list) => {
    console.log(`Storing hosts list with ${list.length} entries...`);
    const uniqueSortedList = Array.from(new Set(list)).sort();
    const compressionRatio = ((list.length - uniqueSortedList.length) / list.length * 100).toFixed(2);
    console.log(`Compression: ${list.length} → ${uniqueSortedList.length} entries (${compressionRatio}% reduction)`);
    const chunkSize = 10000;
    const chunks = [];
    for (let i = 0; i < uniqueSortedList.length; i += chunkSize) {
        chunks.push(uniqueSortedList.slice(i, i + chunkSize));
    }
    const storageData = {
        hostsList: uniqueSortedList,
        hostsCount: uniqueSortedList.length,
        lastUpdated: Date.now(),
        chunksCount: chunks.length,
        compressionRatio: compressionRatio
    };
    browser.storage.local.set(storageData, () => {
        if (browser.runtime.lastError) {
            console.error("Error storing hosts list:", browser.runtime.lastError);
        } else {
            console.log(`✅ Hosts list stored: ${uniqueSortedList.length} entries in ${chunks.length} logical chunks`);
        }
    });
};

// Enhanced memory cleanup function for large hosts lists
const performMemoryCleanup = () => {
    memoryCleanupCount++;
    console.log(`🧹 Performing memory cleanup #${memoryCleanupCount} for large hosts list...`);
    if (memoryCleanupCount % 3 === 0) {
        browser.storage.local.get(['hostsList', 'hostsCount'], (result) => {
            if (result.hostsList && result.hostsList.length > STORAGE_COMPRESSION_THRESHOLD) {
                console.log(`Large hosts list detected (${result.hostsList.length} entries), re-optimizing storage...`);
                const reOptimized = Array.from(new Set(result.hostsList)).sort();
                const improvement = result.hostsList.length - reOptimized.length;
                if (improvement > 0) {
                    console.log(`Storage re-optimization: removed ${improvement} duplicate entries`);
                    browser.storage.local.set({ 
                        hostsList: reOptimized,
                        hostsCount: reOptimized.length,
                        lastOptimized: Date.now()
                    });
                }
            }
        });
    }
};

// Function to update blocklist with enhanced memory optimization for 100k+ hosts
const updateBlocklist = async () => {
    try {
        console.log("🚀 Starting blocklist update for large hosts file...");
        const startTime = Date.now();

        const urls = [
        "https://raw.githubusercontent.com/NightmaREE3Z/BraveFox-Enhancer/refs/heads/main/hosts/BraveFoxHosts",
	"https://raw.githubusercontent.com/NightmaREE3Z/BraveFox-Enhancer/refs/heads/main/hosts/Legacy/legacyFox",
        "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-porn/hosts"
        ];

        const hostsLists = [];
        for (let i = 0; i < urls.length; i++) {
            console.log(`Fetching hosts file ${i + 1}/${urls.length}...`);
            const hosts = await fetchHostsFile(urls[i]);
            hostsLists.push(hosts);
            if (i < urls.length - 1) {
                console.log("Pausing before next fetch to optimize memory...");
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        console.log("Combining all hosts lists...");
        const allHosts = hostsLists.flat();
        hostsLists.length = 0;

        if (allHosts.length === 0) {
            console.log("❌ No hosts were fetched. Please check the URLs and network connection.");
            return;
        }

        console.log(`Processing ${allHosts.length} total hosts for deduplication...`);
        const uniqueHostsList = Array.from(new Set(allHosts)).sort();
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Processed ${allHosts.length} → ${uniqueHostsList.length} unique hosts in ${processingTime}s`);

        const blockingUrls = uniqueHostsList.map(host => `*://${host}/*`);
        if (browser.webRequest.onBeforeRequest.hasListener(blockRequest)) {
            browser.webRequest.onBeforeRequest.removeListener(blockRequest);
        }
        console.log(`Installing web request blocker for ${blockingUrls.length} + ${urlsToBlock.length} total patterns...`);
        currentBlockedUrls = blockingUrls.concat(urlsToBlock);
        browser.webRequest.onBeforeRequest.addListener(
            blockRequest,
            { urls: currentBlockedUrls },
            ["blocking"]
        );

        storeHostsList(uniqueHostsList);
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 Blocklist update completed in ${totalTime}s - ${uniqueHostsList.length} hosts now blocked`);
        setTimeout(performMemoryCleanup, 1000);
        
    } catch (error) {
        console.error("❌ Error updating blocklist:", error);
    }
};

// ===================================================================================
// === WRESTLING DYNAMIC BACKGROUND FETCHER (THE GENDER-TAG SLICER V27) ===
// ===================================================================================
const WRESTLING_CACHE_TIME_KEY = 'wrestling_women_urls_time';
const WRESTLING_CACHE_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours

const wrestlingManualBans = [
    '/wrestlers/lainey-reid', '/wrestlers/kellyanne', '/wrestlers/kellyanne-english',
    '/wrestlers/nikita-naridian', '/wrestlers/riho', '/wrestlers/thekla',
    '/wrestlers/dani-sekelsky', '/wrestlers/kelly-kelly', '/wrestlers/alba-fyre', 
    '/roster/wwe2k26/alundra-blayze', '/wrestlers/roxxi', '/wrestlers/zelina-vega', 
    '/wrestlers/rosita', '/wrestlers/lita', '/wrestlers/chyna', '/wrestlers/maryse', 
    '/wrestlers/aksana', '/wrestlers/kaitlyn', '/wrestlers/layla', '/wrestlers/tamina', 
    '/wrestlers/melina', '/wrestlers/jacqueline', '/wrestlers/odb', '/wrestlers/asya', 
    '/wrestlers/debra', '/wrestlers/lana', '/wrestlers/sable', '/wrestlers/tori', 
    '/wrestlers/carmella', '/wrestlers/raquel', '/wrestlers/kamille', '/wrestlers/maxine', 
    '/wrestlers/cherry', '/wrestlers/sarita', '/wrestlers/shaniqua', '/wrestlers/francine', 
    '/wrestlers/trinity', '/wrestlers/ivy-nile', '/wrestlers/aj-lee', '/wrestlers/mia-yim', 
    '/wrestlers/gail-kim', '/wrestlers/eve-torres', '/wrestlers/dawn-marie', '/wrestlers/joy-giovanni', 
    '/wrestlers/cora-jade', '/wrestlers/taya-valkyrie', '/wrestlers/brie-bella', '/wrestlers/su-yung'
];

const wrestlingDoNotBroadcast = [
    '/wrestlers/melina', '/wrestlers/melina-perez', '/wrestlers/aj-lee',
    '/wrestlers/aj', '/wrestlers/becky-lynch', '/wrestlers/becky', '/wrestlers/katarina'
];

async function updateWrestlingRoster() {
    try {
        const localApi = (typeof browser !== 'undefined' && browser.storage) ? browser.storage.local : chrome.storage.local;
        
        const data = await new Promise(resolve => {
            if (typeof browser !== 'undefined') {
                localApi.get([WRESTLING_CACHE_TIME_KEY, 'wrestling_women_urls', 'v27_chrome_bump']).then(resolve);
            } else {
                localApi.get([WRESTLING_CACHE_TIME_KEY, 'wrestling_women_urls', 'v27_chrome_bump'], resolve);
            }
        });

        const now = Date.now();
        const lastFetch = data[WRESTLING_CACHE_TIME_KEY] || 0;

        // V27 BUMP: Force-clear John Cena and the men globally!
        if (!data.v27_chrome_bump) {
            console.log('Force-clearing polluted cache via V27 bump...');
            await new Promise(resolve => {
                if (typeof browser !== 'undefined') {
                    localApi.remove([WRESTLING_CACHE_TIME_KEY, 'wrestling_women_urls']).then(resolve);
                } else {
                    localApi.remove([WRESTLING_CACHE_TIME_KEY, 'wrestling_women_urls'], resolve);
                }
            });
            await new Promise(resolve => {
                if (typeof browser !== 'undefined') {
                    localApi.set({ 'v27_chrome_bump': true }).then(resolve);
                } else {
                    localApi.set({ 'v27_chrome_bump': true }, resolve);
                }
            });
        } 
        else if (data.wrestling_women_urls && data.wrestling_women_urls.length > 0 && (now - lastFetch < WRESTLING_CACHE_LIFETIME_MS)) {
            console.log('Wrestling roster cache is fresh. Skipping background fetch.');
            return;
        }

        console.log('Fetching massive Roster pages using strict Gender-Tag Slicer...');
        
        const pagesToFetch = [
            'https://www.thesmackdownhotel.com/roster/?promotion=wwe&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=aew&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=tna&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=njpw&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=wcw&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=ecw&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=aaa&date=all-time#women',    
            'https://www.thesmackdownhotel.com/roster/?promotion=roh&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=awa&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=nwa&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=lucha-underground&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=ovw&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=ajpw&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=noah&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=cmll&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=mlw&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/?promotion=czw&date=all-time#women',
            'https://www.thesmackdownhotel.com/roster/hall-of-fame/#women'
        ];

        let combinedUrls = [...wrestlingManualBans];
        if (data.wrestling_women_urls) {
            combinedUrls = [...combinedUrls, ...data.wrestling_women_urls];
        }

        for (const url of pagesToFetch) {
            try {
                const cleanUrl = url.split('#')[0];
                const response = await fetch(cleanUrl, {
                    credentials: 'omit', 
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
                    }
                });
                
                if (!response.ok) continue;
                const html = await response.text();

                // === THE GENDER-TAG SLICER ===
                const femaleChunks = html.split('gender-female');
                for (let i = 1; i < femaleChunks.length; i++) {
                    const chunk = femaleChunks[i];
                    const isolatedBox = chunk.substring(0, 1500);
                    
                    const match = /href="(\/wrestlers\/[^"]+)"/i.exec(isolatedBox);
                    if (match) {
                        try {
                            combinedUrls.push(new URL(match[1], 'https://www.thesmackdownhotel.com').pathname);
                        } catch(e) {
                            combinedUrls.push(match[1]);
                        }
                    }
                }
                
                // Fallback for Video Game / Specific Roster pages
                const panelChunks = html.split(/id=["']?(?:rlta-panel-women|rlta-women|roster-women)["']?/i);
                for (let i = 1; i < panelChunks.length; i++) {
                    let chunk = panelChunks[i];
                    let endIdx = chunk.search(/id=["']?(?:rlta|ja-sidebar|<footer)/i);
                    if (endIdx !== -1) chunk = chunk.substring(0, endIdx);
                    
                    const regex = /href="(\/wrestlers\/[^"]+)"/gi;
                    let match;
                    while ((match = regex.exec(chunk)) !== null) {
                        try {
                            combinedUrls.push(new URL(match[1], 'https://www.thesmackdownhotel.com').pathname);
                        } catch(e) {
                            combinedUrls.push(match[1]);
                        }
                    }
                }
            } catch(e) {}
            
            await new Promise(resolve => {
                const tid = setTimeout(resolve, 800);
                if (typeof resourceTracker !== 'undefined' && resourceTracker.addTimeout) {
                    resourceTracker.addTimeout(tid);
                }
            });
        }

        combinedUrls = [...new Set(combinedUrls)];

        const safeUrls = combinedUrls.filter(url => {
            const slug = url.toLowerCase();
            return !wrestlingDoNotBroadcast.some(blocked => slug.includes(blocked));
        });

        await new Promise(resolve => {
            const payload = {
                'wrestling_women_urls': safeUrls,
                [WRESTLING_CACHE_TIME_KEY]: now
            };
            if (typeof browser !== 'undefined') {
                localApi.set(payload).then(resolve);
            } else {
                localApi.set(payload, resolve);
            }
        });

        console.log(`✅ Background wrestling roster update complete: ${safeUrls.length} strictly female names cached.`);

    } catch (e) {
        console.error('Wrestling background fetch error:', e);
    }
}
// ===================================================================================

// Add listener for when the extension is installed
browser.runtime.onInstalled.addListener(() => {
    console.log("🚀 BraveFox Enhancer Installed!");
    updateBlocklist();
    updateWrestlingRoster();
});

// Add listener for when the browser starts
browser.runtime.onStartup.addListener(() => {
    console.log("🌅 Browser has started");
    updateBlocklist();
    updateWrestlingRoster();
});

// --- MASTER INTERVALS ---
setInterval(() => {
    updateBlocklist();
    updateWrestlingRoster();
}, 1 * 60 * 60 * 1000);

setInterval(performMemoryCleanup, CLEANUP_INTERVAL);

// Ensure updateBlocklist is called when the extension starts
updateBlocklist();
updateWrestlingRoster();

// Ensure the clearURLsStart function is defined
const clearURLsStart = () => {
    console.log("🔗 ClearURLs initialization started.");
    if (typeof browser.browserAction !== 'undefined') {
        browser.browserAction.setBadgeText({ text: "ON" });
        browser.browserAction.setBadgeBackgroundColor({ color: '#4CAF50' });
    }
};

// Initialize ClearURLs
clearURLsStart();

// Function to remove history entries for specific domains
const removeHistoryForDomains = async (url) => {
    const domains = ["xvideos.com", "instagram.com", "tiktok.com", "google.com", "google.fi", "addons.mozilla.org", "irc-galleria.net", "blogspot.com", "reddit.com"];
    if (domains.some(domain => url.includes(domain))) {
        try {
            await browser.history.deleteUrl({ url: url });
            console.log(`🗑️ Deleted URL ${url} from history.`);
        } catch (error) {
            console.error(`❌ Failed to delete URL ${url} from history:`, error);
        }
    }
};

// Minimal onUpdated: only perform history cleanup when URL changes
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo && changeInfo.url) {
        console.log(`🔍 Checking history entry for: ${changeInfo.url}`);
        removeHistoryForDomains(changeInfo.url);
    }
});

})();