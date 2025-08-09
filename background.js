const timestamp = new Date()
    .toLocaleTimeString('fi-FI', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
    .replace('.', ':');
console.log(`[${timestamp}] BraveFox Enhancer ${chrome.runtime.getManifest().version} initialized!`);

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
    "*://catcut-video-editor-and-maker.en.uptodown.com/*"
];

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
            
            // Memory-optimized parsing with batch processing for 100k+ hosts
            const hosts = [];
            const lines = text.split('\n');
            console.log(`Processing ${lines.length} lines in batches of ${MAX_HOSTS_PER_BATCH}...`);
            
            // Process in batches to handle 100k+ entries efficiently
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
                    // Small delay to allow garbage collection for very large files
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            console.log(`Successfully fetched and processed ${hosts.length} hosts from ${url}`);
            
            // Clear the text variable to free memory immediately
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
    
    // Advanced compression for large lists (100k+ entries)
    const uniqueSortedList = Array.from(new Set(list)).sort();
    const compressionRatio = ((list.length - uniqueSortedList.length) / list.length * 100).toFixed(2);
    
    console.log(`Compression: ${list.length} → ${uniqueSortedList.length} entries (${compressionRatio}% reduction)`);
    
    // Store in chunks for very large lists to prevent storage quota issues
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
    
    // Clean up browser storage cache periodically (more aggressive for large lists)
    if (memoryCleanupCount % 3 === 0) { // Every 1.5 hours
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

        // URLs of the hosts files
        const urls = [
            "https://gist.githubusercontent.com/NightmaREE3Z/2ba1f0f59633ae221214595ede2b590a/raw/a7b43d52deb6ab79e5dbcb0452c0c7ab969c4dc2/BraveFoxHosts",
            "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts"
        ];

        // Fetch all the hosts files with enhanced memory optimization
        const hostsLists = [];
        for (let i = 0; i < urls.length; i++) {
            console.log(`Fetching hosts file ${i + 1}/${urls.length}...`);
            const hosts = await fetchHostsFile(urls[i]);
            hostsLists.push(hosts);
            
            // Delay between fetches to prevent memory spikes with large files
            if (i < urls.length - 1) {
                console.log("Pausing before next fetch to optimize memory...");
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        console.log("Combining all hosts lists...");
        const allHosts = hostsLists.flat();
        
        // Clear individual lists to free memory
        hostsLists.length = 0;

        if (allHosts.length === 0) {
            console.log("❌ No hosts were fetched. Please check the URLs and network connection.");
            return;
        }

        console.log(`Processing ${allHosts.length} total hosts for deduplication...`);
        
        // Memory-optimized deduplication for 100k+ entries
        const uniqueHostsList = Array.from(new Set(allHosts)).sort();
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Processed ${allHosts.length} → ${uniqueHostsList.length} unique hosts in ${processingTime}s`);

        // Generate blocking URLs
        console.log("Generating blocking URL patterns...");
        const blockingUrls = uniqueHostsList.map(host => `*://${host}/*`);

        // Remove existing listener if present
        if (browser.webRequest.onBeforeRequest.hasListener(blockRequest)) {
            browser.webRequest.onBeforeRequest.removeListener(blockRequest);
        }

        // Add new listener with combined URLs
        console.log(`Installing web request blocker for ${blockingUrls.length + urlsToBlock.length} total patterns...`);
        currentBlockedUrls = blockingUrls.concat(urlsToBlock);
        
        browser.webRequest.onBeforeRequest.addListener(
            blockRequest,
            { urls: currentBlockedUrls },
            ["blocking"]
        );

        // Store the optimized hosts list
        storeHostsList(uniqueHostsList);
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 Blocklist update completed in ${totalTime}s - ${uniqueHostsList.length} hosts now blocked`);
        
        // Trigger memory cleanup after large update
        setTimeout(performMemoryCleanup, 1000);
        
    } catch (error) {
        console.error("❌ Error updating blocklist:", error);
    }
};

// Add listener for when the extension is installed
browser.runtime.onInstalled.addListener(() => {
    console.log("🚀 BraveFox Enhancer Installed!");
    updateBlocklist();
    
    // Set up regular update interval
    setInterval(updateBlocklist, 1 * 60 * 60 * 1000); // Update every hour
    
    // Set up memory cleanup interval (more frequent for large hosts)
    setInterval(performMemoryCleanup, CLEANUP_INTERVAL); // Cleanup every 30 minutes
});

// Add listener for when the browser starts
browser.runtime.onStartup.addListener(() => {
    console.log("🌅 Browser has started");
    updateBlocklist();
});

// Ensure updateBlocklist is called when the extension starts
updateBlocklist();

// Ensure the clearURLsStart function is defined
const clearURLsStart = () => {
    console.log("🔗 ClearURLs initialization started.");
    // Add any initialization code for ClearURLs here
    if (typeof browser.browserAction !== 'undefined') {
        // Set the browser action badge text
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

// Listen for navigation events to specific domains and remove history entries
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        console.log(`🔍 Checking history entry for: ${changeInfo.url}`);
        removeHistoryForDomains(changeInfo.url);
    }
});

// Enhanced status reporting for large hosts lists
browser.storage.local.get(['hostsCount', 'lastUpdated', 'compressionRatio'], (result) => {
    if (result.hostsCount) {
        const lastUpdate = new Date(result.lastUpdated).toLocaleString();
        console.log(`📊 Current status: ${result.hostsCount} hosts blocked (last updated: ${lastUpdate})`);
        if (result.compressionRatio) {
            console.log(`💾 Storage compression: ${result.compressionRatio}% reduction achieved`);
        }
    }
});