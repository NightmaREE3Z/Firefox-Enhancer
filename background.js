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
        "https://gist.githubusercontent.com/NightmaREE3Z/2ba1f0f59633ae221214595ede2b590a/raw/f58fbbf5f6adf2e66867fbbcfd639adfffb1d339/PersonalHostz",
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

// Function to check for terms in the URL and redirect
const checkTermsAndRedirect = (url) => {
    const terms = ["irpp4", "irpppas", "blogspot", "blogger", "birppis", "birpppis", "pushpull", "ask.fm", "deepseek", "deepseek ai", "reddit", "/r",
        "Alexa", "Bliss", "Alexa Bliss", "Tiffany", "Tiffy", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Mercedes", "Alba Fyre", "sensuel",
        "Becky Lynch", "Michin", "Mia Yim", "#satan666", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven", "sensuel", "queer", "Pride", "NXT Womens", "model",
        "Jordynne", "Woman", "Women", "Maryse", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Women's", "Woman's", "Summer Rae", "Mia Yim",
        "Naomi", "Bianca Belair", "Charlotte", "Jessika Carr", "Carr WWE", "Jessica Karr", "bikini", "Kristen Stewart", "Sydney Sweeney", "Piper Niven", "Nia Jax",
        "Young Bucks", "Jackson", "Lash Legend", "Jordynne Grace", "DeepSeek", "TOR-Browser", "TOR-selain", "Opera GX", "prostitute", "AI-generated", "AI generated",
        "deepnude", "undress", "nudify", "nude", "nudifier", "faceswap", "facemorph", "AI app", "Sweeney", "Alexis", "Sydney", "Zelina Vega", "Mandy Rose",
        "Nikki", "Brie", "Bella", "Opera Browser", "by AI", "AI edited", "Safari", "OperaGX", "MS Edge", "Microsoft Edge", "clothes", "Lola Vice", "Vice WWE", "Candice LeRae",
        "crotch", "dress", "dreamtime", "Velvet Sky", "LGBTQ", "panties", "panty", "cloth", "AI art", "cleavage", "deviantart", "All Elite Wrestling", "Trish", "Stratus",
        "Tiffy Time", "Steward", "Roxanne", "cameltoe", "dreamtime AI", "Joanie", "bra", "Stewart", "Isla Dawn", "inpaint", "photopea", "onlyfans", "fantime",
        "upscale", "upscaling", "upscaled", "sexy", "Alexa WWE", "AJ Lee", "deepfake", "ring gear", "Lexi", "Trans", "Transvestite", "Aleksa", "Giulia", "Rodriguez",
        "booty", "Paige", "Chyna", "lingerie", "AI model", "deep fake", "nudifying", "nudifier", "undressing", "undressed", "undressifying", "undressify", "Kristen",
        "Vladimir Putin", "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley Cameron", "Hayter", "trunks", "pants", "Ripley", "manyvids",
        "five feet of fury", "5 feet of fury", "selain", "browser", "DeepSeek", "DeepSeek AI", "fansly", "justforfans", "patreon", "Vince Russo", "Tay Conti",
        "Valhalla", "IYO SKY", "Shirai", "Io Sky", "Iyo Shirai", "Dakota Kai", "Asuka", "Kairi Sane", "Meiko Satomura", "NXT Women", "Russo", "underwear", "Rule 34",
        "Miko Satomura", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey", "Dana Brooke", "Izzi Dame", "Tamina", "Alicia Fox", "Madison Rayne", "Saraya", "attire", "only fans",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly", "Melina WWE", "Jillian Hall", "Mickie James", "Su Yung", "Britt", "Nick Jackson", "Matt Jackson", "fan time",
        "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly", "Gail Kim", "Awesome Kong", "Deonna Purrazzo", "Anna Jay", "Riho", "Britney", "Nyla Rose",
        "Angelina Love", "Tessmacher", "Havok", "Taya Valkyrie", "Valkyria", "Tay Melo", "Willow Nightingale", "Statlander", "Hikaru Shida", "rule34", "Sasha", "AEW",
        "Penelope Ford", "Shotzi", "Tegan", "Nox", "Stephanie", "Sasha Banks", "Sakura", "Tessa", "Brooke", "Jakara", "Alba Fyre", "Isla Dawn", "Scarlett Bordeaux",
        "B-Fab", "Kayden Carter", "Katana Chance", "Lyra Valkyria", "Indi Hartwell", "Blair Davenport", "Maxxine Dupri", "China", "Russia", "Natalya", "Sakazaki",
        "Karmen Petrovic", "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum WWE", "Paxley", "Fallon Henley", "Nattie", "escort", "Sol Ruca",
        "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa Leon", "Valentina Feroz", "Amari Miller", "Arianna Grace"];
    for (let term of terms) {
        if (url.includes(term)) {
            console.log(`Term found in URL: ${term}. Redirecting to Wayback Machine front page.`);
            return { redirectUrl: "https://web.archive.org/" };
        }
    }
    return null;
};

// Function to check for banned URLs
const isBannedURL = (url) => {
    const bannedURLs = ["blogspot.com", "blogger.com", "ask.fm", "reddit.com", "reddit.com/r/"];
    for (let bannedURL of bannedURLs) {
        if (url.includes(bannedURL) || url.includes(`www.${bannedURL}`)) {
            console.log(`Banned URL detected: ${bannedURL}`);
            return true;
        }
    }
    return false;
};

browser.webRequest.onBeforeRequest.addListener(
    function(details) {
        const url = details.url.toLowerCase();
        const redirectResult = checkTermsAndRedirect(url);
        if (redirectResult) {
            return redirectResult;
        }
        if (isBannedURL(url)) {
            console.log(`Banned URL detected in request: ${url}. Redirecting to Wayback Machine front page.`);
            return { redirectUrl: "https://web.archive.org/" };
        }
    },
    {
        urls: [
            "*://web.archive.org/*",
            "*://archive.org/*",
            "*://web.archive.org/web/*",
            "*://wayback.archive.org/*"
        ]
    },
    ["blocking"]
);

browser.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        console.log(`Checking headers for URL: ${details.url}`);
        const url = details.url.toLowerCase();
        if (checkTermsAndRedirect(url) || isBannedURL(url)) {
            console.log(`Redirecting due to detected term or banned URL in request headers for: ${url}`);
            return { cancel: true };
        }
    },
    {
        urls: [
            "*://web.archive.org/*",
            "*://archive.org/*",
            "*://web.archive.org/web/*",
            "*://wayback.archive.org/*"
        ]
    },
    ["blocking", "requestHeaders"]
);

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