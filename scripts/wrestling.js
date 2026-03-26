// ==UserScript==
// @name         Wrestling Filter
// @version      2026-03-26
// @description  So Pro, much wrestling, wow.
// @match        https://*.thesmackdownhotel.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // === ENVIRONMENT DETECTOR ===
    const isAndroid = /Android/i.test(navigator.userAgent);

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        console.log('[WRESTLING.JS]', message);
    }

    const CACHE_KEY = 'wrestling_women_urls';
    const CACHE_TIME_KEY = 'wrestling_women_urls_time';
    const CACHE_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

    // === MANUAL SAFETY NET (EXPANDED WITH HTML HARDCODES) ===
    const manualBans = [
        // Original Core
        '/wrestlers/lainey-reid', '/wrestlers/kellyanne', '/wrestlers/kellyanne-english',
        '/wrestlers/nikita-naridian', '/wrestlers/riho', '/wrestlers/thekla',
        '/wrestlers/dani-sekelsky', '/wrestlers/kelly-kelly', '/wrestlers/alba-fyre', 
        '/roster/wwe2k26/alundra-blayze',
        
        // User Targets & Single Names (From HTML)
        '/wrestlers/roxxi', '/wrestlers/zelina-vega', '/wrestlers/rosita', 
        '/wrestlers/lita', '/wrestlers/chyna', '/wrestlers/maryse', '/wrestlers/aksana', 
        '/wrestlers/kaitlyn', '/wrestlers/layla', '/wrestlers/tamina', '/wrestlers/melina', 
        '/wrestlers/jacqueline', '/wrestlers/odb', '/wrestlers/asya', '/wrestlers/debra', 
        '/wrestlers/lana', '/wrestlers/sable', '/wrestlers/tori', '/wrestlers/carmella', 
        '/wrestlers/raquel', '/wrestlers/kamille', '/wrestlers/maxine', '/wrestlers/cherry', 
        '/wrestlers/sarita', '/wrestlers/shaniqua', '/wrestlers/francine', '/wrestlers/trinity',
        
        // Short First Names (4 Letters or Less - From HTML)
        '/wrestlers/ivy-nile', '/wrestlers/aj-lee', '/wrestlers/mia-yim', '/wrestlers/gail-kim', 
        '/wrestlers/eve-torres', '/wrestlers/dawn-marie', '/wrestlers/joy-giovanni', 
        '/wrestlers/cora-jade', '/wrestlers/taya-valkyrie', '/wrestlers/brie-bella', '/wrestlers/su-yung'
    ];

    // === ANTI-COLLATERAL DAMAGE LIST ===
    // Slugs that shouldn't be sent to Facebook/YouTube to prevent collateral damage.
    const doNotBroadcast = [
        '/wrestlers/melina',
        '/wrestlers/melina-perez',
        '/wrestlers/aj-lee',
        '/wrestlers/aj',
        '/wrestlers/becky-lynch',
        '/wrestlers/becky',
        '/wrestlers/katarina'
    ];

    let newlyDiscovered = [];

    // --- BULLETPROOF CROSS-PLATFORM BROADCAST ---
    function broadcastToExtensions(urls) {
        const safeUrls = urls.filter(url => {
            const slug = url.toLowerCase();
            return !doNotBroadcast.some(blocked => slug.includes(blocked));
        });
        
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            browser.storage.local.set({'wrestling_women_urls': safeUrls})
                .then(() => devLog(`Successfully broadcasted ${safeUrls.length} safe URLs to Firefox storage.`))
                .catch(e => devLog('Error broadcasting to Firefox storage: ' + e.message));
        } 
        else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({'wrestling_women_urls': safeUrls}, () => {
                if (chrome.runtime.lastError) {
                    devLog('Error broadcasting to Chrome storage: ' + chrome.runtime.lastError.message);
                } else {
                    devLog(`Successfully broadcasted ${safeUrls.length} safe URLs to Chrome storage.`);
                }
            });
        } else {
            devLog('WARNING: No cross-extension storage API found in this context.');
        }
    }

    // Function to inject safe CSS to hide the roster tabs and panels for women
    function hideUIElements() {
        const style = document.createElement('style');
        style.textContent = `
            #rlta-women, 
            #rlta-panel-women, 
            .gender-female {
                display: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
        devLog('Injected CSS to hide women tabs and categories.');
    }

    // Function to retrieve the cached list synchronously, merged with manual bans
    function getCachedWomenUrls() {
        let urls = [...manualBans];
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                urls = [...new Set([...urls, ...parsed])]; 
            } catch (e) {
                devLog('Failed to parse cached URLs.');
            }
        }
        return urls;
    }

    // Function to extract aliases from known banned blocks and learn them
    function learnAliases(element) {
        if (!element || !element.querySelectorAll) return;
        try {
            const h1s = Array.from(element.querySelectorAll('.page-header h1, h2.contentheading, .roster_name'));
            if (element.matches && element.matches('.page-header h1, h2.contentheading, .roster_name')) h1s.push(element);
            
            h1s.forEach(h1 => {
                const name = h1.textContent.replace(/[\n\r]/g, ' ').trim();
                if (name) newlyDiscovered.push('/wrestlers/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
            });

            const dls = Array.from(element.querySelectorAll('dl.article-info'));
            if (element.matches && element.matches('dl.article-info')) dls.push(element);
            
            dls.forEach(dl => {
                const text = dl.textContent || '';
                if (text.includes('Known as:')) {
                    const afterKnown = text.split('Known as:')[1];
                    if (afterKnown) {
                        const line = afterKnown.split('\n')[0]; 
                        const names = line.split(',').map(n => n.trim().replace(/[^a-zA-Z0-9 ]/g, ''));
                        names.forEach(n => {
                            if (n) newlyDiscovered.push('/wrestlers/' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                        });
                    }
                }
            });
        } catch(e) {
            devLog('Error learning aliases: ' + e);
        }
    }

    // Function to push newly learned aliases to the global browser storage
    function flushDiscoveredAliases(currentBlockedUrls) {
        if (newlyDiscovered.length === 0) return currentBlockedUrls;
        
        let updatedUrls = [...currentBlockedUrls];
        let added = false;
        
        newlyDiscovered.forEach(slug => {
            if (slug !== '/wrestlers/' && slug.length > 12 && !updatedUrls.includes(slug)) {
                updatedUrls.push(slug);
                added = true;
            }
        });
        
        if (added) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(updatedUrls));
            broadcastToExtensions(updatedUrls); 
            devLog(`Learned and broadcasted new aliases! Global list is now: ${updatedUrls.length} profiles.`);
        }
        
        newlyDiscovered = []; 
        return updatedUrls;
    }

    function chunkArray(array, chunkSize) {
        const results = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            results.push(array.slice(i, i + chunkSize));
        }
        return results;
    }

    // --- HYBRID FETCHING ENGINE ---
    async function updateWomenUrls() {
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const now = Date.now();

        const currentCache = getCachedWomenUrls();
        broadcastToExtensions(currentCache);

        if (cachedTime && (now - parseInt(cachedTime, 10)) < CACHE_LIFETIME_MS) {
            devLog('Using recently cached list of women profiles.');
            return currentCache;
        }

        let pagesToFetch = [];

        if (isAndroid) {
            devLog('Android Environment Detected: Using perfectly tuned 3-page Regex fetcher...');
            pagesToFetch = [
                'https://www.thesmackdownhotel.com/wrestlers/?sort=attr.ct176.frontend_value&sortdir=asc&attr.ct8.value=female&page=1',
                'https://www.thesmackdownhotel.com/wrestlers/?sort=attr.ct176.frontend_value&sortdir=asc&attr.ct8.value=female&page=2',
                'https://www.thesmackdownhotel.com/wrestlers/?sort=attr.ct176.frontend_value&sortdir=asc&attr.ct8.value=female&page=3'
            ];
        } else {
            devLog('PC Environment Detected: Using heavy DOMParser fetcher...');
            pagesToFetch = [
                'https://www.thesmackdownhotel.com/wrestlers/?sort=attr.ct176.frontend_value&sortdir=asc&attr.ct8.value=female&page=1',
                'https://www.thesmackdownhotel.com/wrestlers/?sort=attr.ct176.frontend_value&sortdir=asc&attr.ct8.value=female&page=2',
                'https://www.thesmackdownhotel.com/wrestlers/?sort=attr.ct176.frontend_value&sortdir=asc&attr.ct8.value=female&page=3',
            ];
        }

        let combinedUrls = [...currentCache];

        try {
            const chunks = chunkArray(pagesToFetch, isAndroid ? 2 : 4);
            
            for (const chunk of chunks) {
                const fetchPromises = chunk.map(async (url) => {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) return;
                        const html = await response.text();

                        if (isAndroid) {
                            const linkRegex = /href="(\/wrestlers\/[^"]+)"/gi;
                            let match;
                            while ((match = linkRegex.exec(html)) !== null) {
                                combinedUrls.push(match[1]);
                            }
                        } else {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');

                            if (url.includes('/roster/')) {
                                const womenPanel = doc.querySelector('#rlta-panel-women');
                                if (womenPanel) {
                                    womenPanel.querySelectorAll('a[href^="/wrestlers/"]').forEach(link => {
                                        const path = new URL(link.getAttribute('href'), window.location.origin).pathname;
                                        combinedUrls.push(path);
                                    });
                                }
                            } else {
                                doc.querySelectorAll('.items-row a[href^="/wrestlers/"], .roster a[href^="/wrestlers/"], .contentheading a[href^="/wrestlers/"]').forEach(link => {
                                    const path = new URL(link.getAttribute('href'), window.location.origin).pathname;
                                    combinedUrls.push(path);
                                });
                            }
                        }
                    } catch(e) {
                        devLog(`Failed to fetch ${url}: ${e}`);
                    }
                });

                await Promise.all(fetchPromises);
                if (isAndroid) await new Promise(resolve => setTimeout(resolve, 300)); 
            }

            combinedUrls = [...new Set(combinedUrls)]; 

            if (combinedUrls.length > 0) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(combinedUrls));
                localStorage.setItem(CACHE_TIME_KEY, now.toString());
                
                broadcastToExtensions(combinedUrls);
                
                devLog(`Successfully fetched and cached ${combinedUrls.length} women profile URLs.`);
            }

            return combinedUrls;
        } catch (error) {
            devLog('Error fetching women profiles: ' + error);
            return getCachedWomenUrls(); 
        }
    }

    // Function to process all links on the current page and wipe the banned ones
    function obliterateBlockedElements(blockedUrls) {
        if (!blockedUrls || blockedUrls.length === 0) return blockedUrls;

        let removedCount = 0;
        
        const isFemaleDatabasePage = window.location.href.toLowerCase().includes('attr.ct8.value=female');

        if (isFemaleDatabasePage) {
            const allLinksOnPage = document.querySelectorAll('a[href^="/wrestlers/"]');
            allLinksOnPage.forEach(link => {
                try {
                    const urlPath = new URL(link.getAttribute('href'), window.location.origin).pathname.toLowerCase();
                    if (!blockedUrls.includes(urlPath)) {
                        newlyDiscovered.push(urlPath); 
                    }
                    const parentCard = link.closest('.items-row') || link.closest('.roster') || link.closest('[data-id="blogPost"]') || link;
                    if (parentCard.isConnected) {
                        learnAliases(parentCard); 
                        parentCard.remove();
                        removedCount++;
                    }
                } catch (e) {}
            });

            if (removedCount > 0) {
                devLog(`Aggressive Context Scanner: Auto-nuked and learned ${removedCount} female profiles from database search page.`);
                return flushDiscoveredAliases(blockedUrls);
            }
        }

        const bannedProfiles = blockedUrls.map(url => {
            const parts = url.split('/').filter(Boolean);
            const slug = parts[parts.length - 1].toLowerCase();
            return { slug: slug, name: slug.replace(/-/g, ' ') };
        });

        const rosterLinks = document.querySelectorAll('a[href^="/wrestlers/"], a[href*="/roster/"]');
        rosterLinks.forEach(link => {
            try {
                const urlPath = new URL(link.getAttribute('href'), window.location.origin).pathname.toLowerCase();
                let shouldRemove = false;

                if (blockedUrls.includes(urlPath)) {
                    shouldRemove = true;
                } else {
                    for (let i = 0; i < bannedProfiles.length; i++) {
                        if (urlPath.includes('/' + bannedProfiles[i].slug)) {
                            shouldRemove = true;
                            break;
                        }
                    }
                }

                if (shouldRemove) {
                    const parentCard = link.closest('[data-id="blogPost"]') || 
                                       link.closest('.items-row') || 
                                       link.closest('.roster_section > a') || 
                                       link;
                                       
                    if (parentCard && parentCard.isConnected) {
                        learnAliases(parentCard);
                        parentCard.remove();
                        removedCount++;
                    }
                }
            } catch (e) {}
        });

        const searchItems = document.querySelectorAll('.items-row, .roster, tr.title-reign, [data-id="blogPost"], .item-info, h2.contentheading, p.result__description, .roster_name, img, .page-header, dl.article-info');
        searchItems.forEach(item => {
            if (!item.isConnected) return;

            const textContent = item.textContent.toLowerCase();
            const rawHtml = item.outerHTML.toLowerCase(); 
            
            let shouldRemove = false;

            for (let i = 0; i < bannedProfiles.length; i++) {
                const profile = bannedProfiles[i];
                if (profile.name.length > 3 && (textContent.includes(profile.name) || rawHtml.includes(profile.slug))) {
                    shouldRemove = true;
                    break;
                }
            }

            if (shouldRemove) {
                learnAliases(item);

                const parentCard = item.closest('[data-id="blogPost"]') || 
                                   item.closest('tr.title-reign') || 
                                   item.closest('.items-row') || 
                                   item.closest('a[href*="/roster/"], a[href*="/wrestlers/"]') || 
                                   item.closest('.roster') || 
                                   (item.matches('.page-header, dl.article-info') ? item : null) ||
                                   item;
                                   
                if (parentCard && parentCard.isConnected) {
                    parentCard.remove();
                    removedCount++;
                }
            }
        });

        if (removedCount > 0) {
            devLog(`Removed ${removedCount} banned profile cards/search results from the current view.`);
        }

        return flushDiscoveredAliases(blockedUrls);
    }

    // Main execution function
    async function initFilter() {
        hideUIElements();

        // BUMP TO V10: Clears old caches and locks in the new expanded HTML hardcodes
        if (!localStorage.getItem('wrestling_cache_v10')) {
             localStorage.removeItem(CACHE_TIME_KEY); 
             localStorage.setItem('wrestling_cache_v10', 'true');
        }

        let blockedUrls = getCachedWomenUrls();
        const currentPath = window.location.pathname.toLowerCase();
        
        const pageHeader = document.querySelector('.page-header h1');
        const articleInfo = document.querySelector('dl.article-info');
        const pageText = ((pageHeader ? pageHeader.textContent : '') + ' ' + (articleInfo ? articleInfo.textContent : '')).toLowerCase();
        
        let shouldRedirect = false;
        
        if (blockedUrls.length > 0) {
            if (blockedUrls.some(url => currentPath.startsWith(url))) {
                shouldRedirect = true;
            } else {
                const bannedNames = blockedUrls.map(url => url.split('/').filter(Boolean).pop().replace(/-/g, ' '));
                for (let i = 0; i < bannedNames.length; i++) {
                    if (bannedNames[i].length > 3 && pageText.includes(bannedNames[i])) {
                        shouldRedirect = true;
                        break;
                    }
                }
            }
        }

        if (shouldRedirect) {
            learnAliases(document.body); 
            flushDiscoveredAliases(blockedUrls);
            devLog(`Blocked access to ${currentPath}. Redirecting away.`);
            window.location.replace('https://www.thesmackdownhotel.com/');
            return; 
        }

        blockedUrls = obliterateBlockedElements(blockedUrls);

        const updatedUrls = await updateWomenUrls();
        
        if (updatedUrls.some(url => currentPath.startsWith(url))) {
            devLog(`Late catch: Blocked access to ${currentPath}. Redirecting away.`);
            window.location.replace('https://www.thesmackdownhotel.com/');
            return;
        }
        
        blockedUrls = obliterateBlockedElements(updatedUrls);

        const observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            for (let mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldProcess = true;
                    break;
                }
            }
            
            if (shouldProcess) {
                obliterateBlockedElements(getCachedWomenUrls());
            }
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
        devLog('Mutation observer actively listening for new profile cards.');
    }

    // Start the script
    initFilter();

})();