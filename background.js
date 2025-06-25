console.log("BraveFox Enhancer Service Worker Loaded!");

// List of URLs to block
const urlsToBlock = [
    "*://www.lunapic.com/*",
    "*://www9.lunapic.com/*",
    "*://www9.lunapic.com/editor/*",
    "*://pixelixe.com/*",
    "*://picresize.com/*"
];

// Function to block requests
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

// Function to fetch and parse hosts file with retries
const fetchHostsFile = async (url, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Fetching hosts file from ${url}, attempt ${attempt}...`);
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const hosts = text.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => {
                    const parts = line.split(/\s+/);
                    return parts.length > 1 ? parts[1] : null;
                })
                .filter(Boolean);
            console.log(`Fetched ${hosts.length} hosts from ${url}`);
            return hosts;
        } catch (error) {
            console.error(`Failed to fetch the hosts file from ${url} on attempt ${attempt}:`, error);
            if (attempt === retries) {
                console.error(`All ${retries} attempts to fetch the hosts file from ${url} failed.`);
            } else {
                console.log(`Retrying...`);
            }
        }
    }
    return [];
};

// Store the fetched hosts list in local storage
const storeHostsList = (list) => {
    browser.storage.local.set({ hostsList: list }, () => {
        console.log("Hosts list has been stored.");
    });
};

// Function to update blocklist
const updateBlocklist = async () => {
    try {
        console.log("Fetching hosts list...");

        // URLs of the hosts files (added new URLs)
        const urls = [
        "https://gist.githubusercontent.com/NightmaREE3Z/2ba1f0f59633ae221214595ede2b590a/raw/3d83a28614aed5f7c9f1b02c2264f77db0cc0bab/BraveFoxHosts",
        "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts"
        ];

        // Fetch all the hosts files
        const hostsLists = await Promise.all(urls.map(url => fetchHostsFile(url)));
        const allHosts = hostsLists.flat();

        if (allHosts.length === 0) {
            console.log("No hosts were fetched. Please check the URLs and network connection.");
            return;
        }

        const uniqueHostsList = Array.from(new Set(allHosts));
        console.log(`Unique hosts list has ${uniqueHostsList.length} hosts`);

        const blockingUrls = uniqueHostsList.map(host => `*://${host}/*`);
        console.log(blockingUrls);

        if (browser.webRequest.onBeforeRequest.hasListener(blockRequest)) {
            browser.webRequest.onBeforeRequest.removeListener(blockRequest);
        }

        browser.webRequest.onBeforeRequest.addListener(
            blockRequest,
            { urls: blockingUrls.concat(urlsToBlock) }, // Include initial URLs to block
            ["blocking"]
        );

        storeHostsList(uniqueHostsList);
        console.log("Blocklist has been updated.");
    } catch (error) {
        console.error("Error updating blocklist:", error);
    }
};

// Add listener for when the extension is installed
browser.runtime.onInstalled.addListener(() => {
    console.log("BraveFox Enhancer Installed!");
    updateBlocklist();
    setInterval(updateBlocklist, 1 * 60 * 60 * 1000); // Update every hour
});

// Add listener for when the browser starts
browser.runtime.onStartup.addListener(() => {
    console.log("Browser has started");
    updateBlocklist();
});

// Ensure updateBlocklist is called when the extension starts
updateBlocklist();

// Ensure the clearURLsStart function is defined
const clearURLsStart = () => {
    console.log("ClearURLs initialization started.");
    // Add any initialization code for ClearURLs here
    if (typeof browser.browserAction !== 'undefined') {
        // Example: Set the browser action badge text
        browser.browserAction.setBadgeText({ text: "ON" });
    }
    // Other initialization code
};

// Initialize ClearURLs
clearURLsStart();

// Function to remove history entries for specific domains
const removeHistoryForDomains = async (url) => {
    const domains = ["xvideos.com", "instagram.com", "tiktok.com", "google.com", "google.fi", "addons.mozilla.org", "irc-galleria.net", "blogspot.com", "reddit.com"];
    if (domains.some(domain => url.includes(domain))) {
        try {
            await browser.history.deleteUrl({ url: url });
            console.log(`Deleted URL ${url} from history.`);
        } catch (error) {
            console.error(`Failed to delete URL ${url} from history:`, error);
        }
    }
};

// Listen for navigation events to specific domains and remove history entries
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        console.log(`Checking history entry for: ${changeInfo.url}`);
        removeHistoryForDomains(changeInfo.url);
    }
});