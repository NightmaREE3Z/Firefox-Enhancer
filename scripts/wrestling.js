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

    function devLog(message) {
        console.log('[WRESTLING.JS]', message);
    }

    const CACHE_KEY = 'wrestling_women_urls';
    const CACHE_TIME_KEY = 'wrestling_women_urls_time';
    const CACHE_LIFETIME_MS = 12 * 60 * 60 * 1000; 

    const manualBans = [
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

    const doNotBroadcast = [
        '/wrestlers/melina', '/wrestlers/melina-perez', '/wrestlers/aj-lee',
        '/wrestlers/aj', '/wrestlers/becky-lynch', '/wrestlers/becky',
        '/wrestlers/katarina', 'wrestlers/katarina', 'katarina',
	'/wrestlers/jojo', 'wrestlers/jojo', 'jojo',
    ];

    let newlyDiscovered = [];

    function broadcastToExtensions(urls) {
        const safeUrls = urls.filter(url => {
            const slug = url.toLowerCase();
            return !doNotBroadcast.some(blocked => slug.includes(blocked));
        });
        
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            browser.storage.local.set({'wrestling_women_urls': safeUrls}).catch(()=>{});
        } 
        else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({'wrestling_women_urls': safeUrls}, () => {});
        }
    }

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
    }

    function getCachedWomenUrls() {
        let urls = [...manualBans];
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                urls = [...new Set([...urls, ...parsed])]; 
            } catch (e) {}
        }
        return urls;
    }

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
        } catch(e) {}
    }

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

    // --- EXACT MATCH TO BACKGROUND.JS GENDER-TAG SLICER ---
    async function updateWomenUrls() {
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const now = Date.now();

        const currentCache = getCachedWomenUrls();
        broadcastToExtensions(currentCache);

        if (cachedTime && (now - parseInt(cachedTime, 10)) < CACHE_LIFETIME_MS) {
            return currentCache;
        }

        if (isAndroid) return currentCache; 

        devLog('Fetching massive Roster pages using strict Gender-Tag Slicer...');
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

        let combinedUrls = [...currentCache];

        try {
            const chunks = chunkArray(pagesToFetch, 2);
            for (const chunk of chunks) {
                const fetchPromises = chunk.map(async (url) => {
                    try {
                        const cleanUrl = url.split('#')[0];
                        const response = await fetch(cleanUrl);
                        if (!response.ok) return;
                        const html = await response.text();

                        const femaleChunks = html.split('gender-female');
                        for (let i = 1; i < femaleChunks.length; i++) {
                            const htmlChunk = femaleChunks[i];
                            const isolatedBox = htmlChunk.substring(0, 1500);
                            const match = /href="(\/wrestlers\/[^"]+)"/i.exec(isolatedBox);
                            if (match) {
                                try { combinedUrls.push(new URL(match[1], 'https://www.thesmackdownhotel.com').pathname); } 
                                catch(e) { combinedUrls.push(match[1]); }
                            }
                        }

                        const panelChunks = html.split(/id=["']?(?:rlta-panel-women|rlta-women|roster-women)["']?/i);
                        for (let i = 1; i < panelChunks.length; i++) {
                            let pChunk = panelChunks[i];
                            let endIdx = pChunk.search(/id=["']?(?:rlta|ja-sidebar|<footer)/i);
                            if (endIdx !== -1) pChunk = pChunk.substring(0, endIdx);
                            const regex = /href="(\/wrestlers\/[^"]+)"/gi;
                            let match;
                            while ((match = regex.exec(pChunk)) !== null) {
                                try { combinedUrls.push(new URL(match[1], 'https://www.thesmackdownhotel.com').pathname); } 
                                catch(e) { combinedUrls.push(match[1]); }
                            }
                        }
                    } catch(e) {}
                });
                await Promise.all(fetchPromises);
            }

            combinedUrls = [...new Set(combinedUrls)]; 
            if (combinedUrls.length > 0) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(combinedUrls));
                localStorage.setItem(CACHE_TIME_KEY, now.toString());
                broadcastToExtensions(combinedUrls);
            }
            return combinedUrls;
        } catch (error) {
            return getCachedWomenUrls(); 
        }
    }

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
                    // THE FIX: Only target .item! Never delete the .items-row or .roster grid container!
                    const parentCard = link.closest('.item') || link.closest('[data-id="blogPost"]') || link;
                    if (parentCard.isConnected) {
                        learnAliases(parentCard); 
                        parentCard.remove();
                        removedCount++;
                    }
                } catch (e) {}
            });

            if (removedCount > 0) {
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
                    // THE FIX: Strict targeting of .item wrapper to save the grid!
                    const parentCard = link.closest('.item') || link.closest('[data-id="blogPost"]') || link;
                    if (parentCard && parentCard.isConnected) {
                        learnAliases(parentCard);
                        parentCard.remove();
                        removedCount++;
                    }
                }
            } catch (e) {}
        });

        // THE FIX: Swapped .roster and .items-row for .item so we only scan/delete specific cards, not massive grids!
        const searchItems = document.querySelectorAll('.item, tr.title-reign, [data-id="blogPost"], .item-info, h2.contentheading, p.result__description, .roster_name, img, .page-header, dl.article-info');
        searchItems.forEach(item => {
            if (!item.isConnected) return;

            const textContent = item.textContent.toLowerCase();
            const rawHtml = item.outerHTML.toLowerCase(); 
            
            let shouldRemove = false;

            for (let i = 0; i < bannedProfiles.length; i++) {
                const profile = bannedProfiles[i];
                if (profile.name.length > 3) {
                    const nameRegex = new RegExp('\\b' + profile.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\b', 'i');
                    if (nameRegex.test(textContent) || rawHtml.includes('/' + profile.slug + '"') || rawHtml.includes('/' + profile.slug + '/')) {
                        shouldRemove = true;
                        break;
                    }
                }
            }

            if (shouldRemove) {
                learnAliases(item);

                // THE FIX: Safe deletion targeting.
                const parentCard = item.closest('.item') || 
                                   item.closest('[data-id="blogPost"]') || 
                                   item.closest('tr.title-reign') || 
                                   (item.matches('.page-header, dl.article-info') ? item : null) ||
                                   item;
                                   
                if (parentCard && parentCard.isConnected) {
                    parentCard.remove();
                    removedCount++;
                }
            }
        });

        return flushDiscoveredAliases(blockedUrls);
    }

    async function initFilter() {
        hideUIElements();

        // THE MANUAL REFRESH COMMAND
        if (window.location.search.includes('force_refresh=true')) {
             localStorage.removeItem(CACHE_TIME_KEY); 
             localStorage.removeItem(CACHE_KEY); 
             if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                 chrome.storage.local.remove(['wrestling_women_urls_time', 'wrestling_women_urls']);
             }
             devLog('🚨 MANUAL FORCE REFRESH TRIGGERED! All caches wiped.');
             window.history.replaceState({}, document.title, window.location.pathname);
        }

        // BUMP TO V27: PURGE JOHN CENA AND THE MEN FROM THE CACHE!
        if (!localStorage.getItem('wrestling_cache_v27')) {
             localStorage.removeItem(CACHE_TIME_KEY); 
             localStorage.removeItem(CACHE_KEY); 
             localStorage.setItem('wrestling_cache_v27', 'true');
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
                    if (bannedNames[i].length > 3) {
                        const nameRegex = new RegExp('\\b' + bannedNames[i].replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\b', 'i');
                        if (nameRegex.test(pageText)) {
                            shouldRedirect = true;
                            break;
                        }
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
    }

    initFilter();

})();