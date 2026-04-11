// ==UserScript==
// @name         YTClean
// @version      2026-03-24
// @description  Enhances my YouTube experience by blocking trackers and hiding garbage, such as shorts.
// @match        https://*.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        console.log('[YOUTUBE.JS]', message);
    }

    // ===== Memory/observer/timer lifecycle tracking (added) =====
    const __ytTimers = { intervals: new Set(), timeouts: new Set() };
    const __ytObservers = new Set();
    const __ytEventCleanups = new Set();
    let __ytCleanupRan = false;
    let __ytIntervalsRunning = false;
    let isRedirecting = false; // Global redirect flag to prevent loops

    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        __ytTimers.intervals.add(id);
        return id;
    }
    function addTimeout(fn, ms) {
        const id = setTimeout(() => {
            __ytTimers.timeouts.delete(id);
            fn();
        }, ms);
        __ytTimers.timeouts.add(id);
        return id;
    }
    function onEvent(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        __ytEventCleanups.add(() => target.removeEventListener(type, handler, options));
    }
    function trackObserver(observer) {
        __ytObservers.add(observer);
        return observer;
    }
    function stopIntervals() {
        __ytTimers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
        __ytTimers.intervals.clear();
        __ytIntervalsRunning = false;
    }
    function startIntervals(schedulerFn) {
        if (__ytIntervalsRunning) return;
        schedulerFn();
        __ytIntervalsRunning = true;
    }
    function cleanup() {
        if (__ytCleanupRan) return;
        __ytCleanupRan = true;
        try {
            stopIntervals();
            __ytTimers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __ytTimers.timeouts.clear();
            __ytObservers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __ytObservers.clear();
            __ytEventCleanups.forEach(fn => { try { fn(); } catch {} });
            __ytEventCleanups.clear();
            devLog('Cleanup complete.');
        } catch (e) {
            console.log('[YOUTUBE.JS] cleanup error: ' + e.message);
        }
    }

    // List of known YouTube tracker domains or URL patterns
    const trackerPatterns = [
        /google-analytics\.com/,
        /youtube\.com\/watch/,
        /www\.youtube\.com\/set_video/,
        /ytimg\.com/,
        /adservices\.google\.com/,
        /youtube\.com\/api\/stats/,
        /youtube\.com\/pixel/,
        /youtube\.com\/v_/,
    ];

    // List of keywords or phrases to block in search queries and page content
    const blockKeywords = [
	 


	//Names and nicknames
	/\balexa\b/i, /Bliss/i, /Alexa Bliss/i, /lex kauf/i, /lex cabr/i, /lex carbr/i, /Liv Morgan/i, /Tiffany/i, /Tiffy/i, /Stratton/i, /Chelsea Green/i, /Dua Lipa/i, /Dualipa/i,
        /Jordynne/i, /Maryse/i, /Women's/i, /Woman's/i, /Summer Rae/i, /Naomi/i, /Bianca Belair/i, /Charlotte/i, /Jessika Carr/i, /Mercedes/i, /cabrera/i, /leks bl/i, /leks kauf/i,
        /Carr WWE/i, /Jessica Karr/i, /bikini/i, /Kristen Stewart/i, /Sydney Sweeney/i, /Nia Jax/i, /Young Bucks/i, /Vice WWE/i, /Candice LeRae/i, /Trish/i, /Stratus/i, /lex kaufman/i,
	/Lola Vice/i, /Velvet Sky/i, /deviantart/i, /leks cabr/i, /leks carbr/i, /Elyina/i, /Elyna WWE/i, /Tiffy Time/i, /Steward/i, /Roxanne/i, /Joanie/i, /Stewart/i, /Isla Dawn/i, 
        /Alexa WWE/i, /AJ Lee/i, /deepfake/i, /ring gear/i, /Lexi/i, /Aleksa/i, /Giulia/i, /Paige/i, /Chyna/i, /\bToni\b/i, /\bLin\b/i, /\blana\b/i, /Jackson/i, /Lash Legend/i, 
	/Jordynne Grace/i, /Sweeney/i, /Alexis/i, /Sydney/i, /Zelina Vega/i, /Mandy Rose/i, /Nikki/i, /Brie/i, /Bella/i,  /Skye Blue/i, /Carmella/i, /Mariah May/i, /Harley Cameron/i, 
	/Hayter/i, /Ripley/i, /five feet of fury/i, /5 feet of fury/i, /Tay Conti/i, /Valhalla/i, /IYO SKY/i, /Shirai/i, /Io Sky/i, /Iyo Shirai/i, /Dakota Kai/i, /Asuka/i, /Tamina/i,
        /Kairi Sane/i, /Meiko Satomura/i, /NXT Women/i, /Russo/i, /Miko Satomura/i, /Sarray/i, /Xia Li/i, /Shayna Baszler/i, /Ronda Rousey/i, /Dana Brooke/i, /Izzi Dame/i, /Lana WWE/i,	
	/Alicia Fox/i, /Madison Rayne/i, /Saraya/i, /attire/i, /Layla/i, /Michelle McCool/i, /Eve Torres/i, /Kelly/i, /Melina WWE/i, /Jillian Hall/i, /Mickie James/i, /Su Yung/i, /Britt/i, 
	/Nick Jackson/i, /Matt Jackson/i, /Maria Kanellis/i, /Beth Phoenix/i, /Victoria WWE/i, /Kristen/i, /\bLin\b/i, /Watchorn/i, /@LinWatchorn/i, /Courtney Ryan/i, /Elina WWE/i, 
        /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i, /Deonna Purrazzo/i, /Anna Jay/i, /\bRiho\b/i, /Britney/i, /Nyla Rose/i, /Angelina Love/i, /Tessmacher/i, /Havok/i, /Toni Storm/i, 
        /Taya Valkyrie/i, /Valkyria/i, /Tay Melo/i, /Willow Nightingale/i, /Statlander/i, /Hikaru Shida/i, /Sasha/i, /Penelope Ford/i, /Shotzi/i, /Tegan/i, /Stephanie/i, /Becky Lynch/i,
        /Sasha Banks/i, /Sakura/i, /Tessa/i, /Brooke/i, /Jakara/i, /Alba Fyre/i, /Isla Dawn/i, /Scarlett Bordeaux/i, /\bB-Fab\b/i, /Kayden Carter/i, /Katana Chance/i, /Valentina Feroz/i,
        /Bayley/i, /Lyra Valkyria/i, /Indi Hartwell/i, /Blair Davenport/i, /Maxxine Dupri/i, /Natalya/i, /Sakazaki/i, /Karmen Petrovic/i, /Ava Raine/i, /CJ Perry/i, /Shira/i, /Piper Niven/i,
        /Cora Jade/i, /Jacy Jayne/i, /Gigi Dolin/i, /Thea Hail/i, /Tatum WWE/i, /Paxley/i, /Fallon Henley/i, /Nattie/i, /escort/i, /Sol Ruca/i, /Kelani Jordan/i, /CJ Lana/i, /Lana Perry/i,
        /Electra Lopez/i, /Wendy Choo/i, /Yulisa Leon/i, /Gina Adam/i,  /Amari Miller/i, /Arianna Grace/i, /carbrera/i, /Michin/i, /Mia Yim/i, /\bMina\b/i, /Alba Fyre/i, /\bBlackheart\b/i, 


	//Misc stuff
	/deepnude/i, /undress/i, /nudify/i, /nude/i, /nudifier/i, /faceswap/i, /facemorph/i, /epnud/i, /udify/i, /udifi/i, /ndres/i, /deepfak/i, /\bBra\b/i, /diffusion/i, /trunks/i, /pant/i,
	/fantime/i, /clothes/i, /crotch/i, /dress/i, /dreamtime/i, /panties/i, /panty/i, /cloth/i, /ndfy/i, /nd1f/i, /nd!f/i, /ndlf/i, /dreambooth/i, /dream booth/i, /dream boot/i, /dreamboot/i,
	/cleavage/i, /LGBTQ/i, /\bbooty\b/i, /sexy/i, /inpaint/i, /photopea/i, /lingerie/i, /underwear/i, /Rule 34/i, /cameltoe/i, /dreamtime/i, /Venice/i, /Venoice/i, /Venise/i, /Venoise/i, 
	/ndif/i, /undressifying/i, /prostitut/i, /sensuel/i, /onlyfans/i, /fansly/i, /justforfans/i, /manyvids/i, /fan time/i, /queer/i, /\bTrans\b/i, /Transvestite/i, /wonder share/i,
	/VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, 
	/OracleVM/i, /virtualmachine/i, /virtual machine/i, /virtuaalikone/i, /virtuaali kone/i, /virtuaali tietokone/i, /virtuaalitietokone/i, /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, 
	/virtuaali masiina/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /hypervisor/i, 
	/hyper visor/i, /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, /virt machine/i, 
	/virtmachine/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i,  /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /virt mac/i,
        /virt-machine/i, /virtumachine/i, /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, 
        /\bMachiene\b/i,  /vi mach/i, /vir mach/i, /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /vir machine/i, /virtu mac/i, /virtual machi/i, 
	/\bai\b/i, /AI model/i, /AI-generated/i, /generated/i, /\bAI Art\b/i, /\bBy AI\b/i, /AI edited/i, /upscaling/i, /p41n/i, /pa1n/i, /p4in/i, /filmora/i, /wondershare/i, /AI app/i,
        /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Anthr/i, /Antro/i, /\bS0ft\b/i, /s0ftw/i, /softw/i, /\b50ft\b/i, /w4re/i, /war3/i, /w4r3/i, /upscaled/i,
	/Sharia/i, /Pride/i, /\bshe\b/i, /\bher\b/i, /Woman/i, /Women/i, /NXT Womens/i, /beta male/i, /alpha male/i, /DeepSeek/i, /Grok-AI/i, /Elon Musk/i, /\bElon\b/i, /\bMusk\b/i,
	/selain/i, /Safari/i, /OperaGX/i, /MS Edge/i, /Microsoft Edge/i, /TOR-Browser/i, /TOR-selain/i, /Opera GX/i, /\btor\b/i, /browser/i, /Opera Browser/i, /Vivaldi/i, /Brave-Browser/i,
    ];

    // --- Dynamic Banned List from Chrome Storage ---
    function applyDynamicWrestlerBans() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            try {
                chrome.storage.local.get(['wrestling_women_urls'], function(result) {
                    if (result.wrestling_women_urls && Array.isArray(result.wrestling_women_urls)) {
                        let addedCount = 0;
                        
                        // Local Exclusions from filtering:
                        const localExclusions = ['aj-lee', 'aj lee', 'becky-lynch', 'becky'];

                        result.wrestling_women_urls.forEach(url => {
                            const parts = url.split('/').filter(Boolean);
                            const slug = parts[parts.length - 1].toLowerCase();
                            
                            if (localExclusions.includes(slug)) return;

                            const name = slug.replace(/-/g, ' ');
                            const namePattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            
                            const isDuplicate = blockKeywords.some(rx => rx.source && rx.source.includes(namePattern));

                            if (!isDuplicate) {
                                if (name.length <= 6 || !name.includes(' ')) {
                                    blockKeywords.push(new RegExp('\\b' + namePattern + '\\b', 'i'));
                                } else {
                                    blockKeywords.push(new RegExp(namePattern, 'i'));
                                }
                                addedCount++;
                            }
                        });
                        
                        if (addedCount > 0) {
                            devLog(`Dynamically added ${addedCount} wrestler names from shared storage to blocklist.`);
                            // Force an immediate re-check to catch dynamically loaded names before SPA renders them
                            enforceSanity();
                            hideBannedVideoCards();
                        }
                    }
                });
            } catch(e) {}
        }
    }
    applyDynamicWrestlerBans();

    // List of keywords or phrases to allow
    const allowedWords = [
        /tutorial/i, /how to/i, /review/i, /setup/i, /guide/i, /educational/i, /coding/i, /programming/i, /course/i, /demo/i, /learning/i, /Sampsa/i, /Kurri/i, /iotech/i, /Jimms/i, /verkkokauppa/i, /learning/,
        /reddit/i, /OSRS/i, /RS/i, /RS3/i, /Old School/i, /RuneScape/i, /netflix/i, /pushpull/i, /facebook/i, /instagram/i, /Wiki/i, /pedia/i, /hikipedia/i, /fandom/i, /lehti/i, /bond/i, /bonds/i, /2007scape/,
        /vaihdetaan/i, /vaihdan/i, /vaihto/i, /vaihtoi/i, /vaihdossa/i, /vaihtaa/i, /paa/i, /jakohihna/i, /jakopää hihna/i, /jako hihna/i, /jako pää hihna/i, /jako päähihna/i, /\?/i, /\!/i, /opas/i, /oh/,
        /south park/i, /siivoton juttu/i, /poliisin poika/i, /poliisi/i, /poika/i, /Edge WWE/i, /Ravage/i, /Savage/i, /volksvagen/i, /GTA/i, /Grand Theft Auto/i, /videopeli/i, /videogame/i, /video game/i, /ra/,
    ];

    // === Safe Channels Whitelist ===
    const safeChannels = [
        /chrissmoove/i,
        /NerosCinema/i
    ];

    const adblockWarningPatterns = [
        /mainostenestoa ei sallita/i,
        /mainostenesto/i,
        /ad.?block/i,
        /adblocker/i,
        /turn off.*ad.?block/i,
        /disable.*ad.?block/i,
        /ads blocked/i,
        /please disable/i,
        /whitelist.*site/i,
        /allow.*ads/i,
        /enable.*ads/i,
        /advertisement.*blocked/i,
        /support.*creator/i,
        /youtube premium/i,
        /try youtube premium/i,
        /get youtube premium/i
    ];

    const redirectUrl = "https://www.youtube.com/";

    const videoContainers = [
        "ytd-rich-item-renderer",             
        "ytd-video-renderer",                 
        "ytd-grid-video-renderer",            
        "ytd-compact-video-renderer",         
        "ytd-compact-autoplay-renderer",      
        "ytd-compact-radio-renderer",         
        "ytd-playlist-video-renderer",        
        "ytd-playlist-panel-video-renderer",  
        "ytm-rich-item-renderer",             
        "ytm-video-renderer",
        "ytm-video-with-context-renderer",
        "ytm-compact-video-renderer",
        "ytm-compact-radio-renderer",
        "ytm-compact-autoplay-renderer",
        "ytd-miniplayer"                      
    ];

    const adblockPopupSelectors = [
        "ytd-popup-container",
        "tp-yt-paper-dialog",
        "ytd-enforcement-message-view-model",
        "ytd-message-renderer",
        "yt-confirm-dialog-renderer"
    ];

    function removeAdblockPopups() {
        try {
            let removedCount = 0;
            
            adblockPopupSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent?.toLowerCase() || "";
                    if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                        devLog(`Removing adblock popup: ${selector}`);
                        el.style.display = "none";
                        el.style.visibility = "hidden";
                        removedCount++;
                        
                        const backdrop = el.closest('[role="presentation"]') || 
                                       el.closest('.scrim') || 
                                       el.closest('[class*="backdrop"]');
                        if (backdrop) {
                            backdrop.style.display = "none";
                        }
                    }
                });
            });

            const dialogs = document.querySelectorAll('[role="dialog"]');
            dialogs.forEach(dialog => {
                const text = dialog.textContent?.toLowerCase() || "";
                if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                    devLog('Hiding adblock warning dialog');
                    dialog.style.display = "none";
                    dialog.style.visibility = "hidden";
                    removedCount++;
                    
                    const parent = dialog.parentElement;
                    if (parent && (parent.classList.contains('scrim') || 
                                  parent.hasAttribute('aria-modal') ||
                                  parent.getAttribute('role') === 'presentation')) {
                        parent.style.display = "none";
                    }
                }
            });

            const body = document.body;
            if (body && body.style.overflow === 'hidden') {
                const visibleDialogs = document.querySelectorAll('[role="dialog"]:not([style*="display: none"])');
                if (visibleDialogs.length === 0) {
                    body.style.overflow = '';
                }
            }
            
            if (removedCount > 0) {
                devLog(`Removed ${removedCount} adblock popups`);
            }
        } catch (err) {}
    }

    // === THE ULTIMATE SANITY ENFORCER ===
    // Strictly scans the fully decoded URL parameters and Watch page details
    function enforceSanity() {
        try {
            if (isRedirecting) return;

            let textToScan = '';

            // 1. Get query directly from URL parameters (automatically handles special chars, +, %20)
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('search_query');
            if (query) {
                textToScan += ' ' + query;
            }

            // 2. Get Watch Page Title and Channel
            if (window.location.pathname.startsWith('/watch')) {
                textToScan += ' ' + (document.title || '');
                const channelLink = document.querySelector('ytd-video-owner-renderer a.yt-simple-endpoint, ytm-slim-owner-renderer a');
                if (channelLink) textToScan += ' ' + (channelLink.textContent || '');
            }

            textToScan = textToScan.toLowerCase().trim();
            if (!textToScan) return;

            // Check Whitelists exclusively against the clean text
            if (safeChannels.some(sc => sc.test(textToScan))) return;
            if (allowedWords.some(aw => aw.test(textToScan))) return;

            // Check Blocklist
            if (blockKeywords.some(kw => kw.test(textToScan))) {
                devLog(`Banned content detected! Redirecting out...`);
                isRedirecting = true;
                window.location.replace(redirectUrl);
            }
        } catch (err) {
            console.log('Error enforcing sanity: ' + err.message);
        }
    }

    // Hide Banned Video Cards (Playlists, Suggestions, Feeds)
    function hideBannedVideoCards() {
        try {
            const elements = document.querySelectorAll(videoContainers.join(', '));
            let hiddenCount = 0;

            elements.forEach(el => {
                if (el.style.display === "none") return; 

                const visibleText = el.textContent?.toLowerCase() || "";
                
                // ONLY test the visible text against the allowed list to prevent the `?` loophole!
                const isAllowed = allowedWords.some(aw => aw.test(visibleText)) || safeChannels.some(sc => sc.test(visibleText));

                if (!isAllowed) {
                    // Test BOTH visible text and URLs against the ban list
                    const hrefs = Array.from(el.querySelectorAll('a')).map(a => a.href).join(' ').toLowerCase();
                    const combinedText = visibleText + " " + hrefs; 
                    
                    if (blockKeywords.some(keyword => keyword.test(combinedText))) {
                        el.style.display = "none";
                        el.style.visibility = "hidden";
                        hiddenCount++;
                    }
                }
            });
            
            if (hiddenCount > 0) {
                devLog(`Hidden ${hiddenCount} video cards/playlist items with banned content`);
            }
        } catch (err) {
            console.log('Error hiding video cards: ' + err.message);
        }
    }

    function handlePopupButtons() {
        try {
            const buttons = document.querySelectorAll('button, [role="button"]');
            let clickedCount = 0;
            
            buttons.forEach(button => {
                const text = button.textContent?.toLowerCase() || "";
                const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || "";
                
                if (text.includes('skip') || text.includes('continue') || 
                    text.includes('ohita') || text.includes('jatka') ||
                    ariaLabel.includes('skip') || ariaLabel.includes('continue')) {
                    
                    const popup = button.closest('[role="dialog"], ytd-popup-container, tp-yt-paper-dialog');
                    if (popup) {
                        const popupText = popup.textContent?.toLowerCase() || "";
                        if (adblockWarningPatterns.some(pattern => pattern.test(popupText))) {
                            devLog('Auto-clicking skip button in adblock popup');
                            button.click();
                            clickedCount++;
                        }
                    }
                }
            });
            
            if (clickedCount > 0) {
                devLog(`Clicked ${clickedCount} popup buttons`);
            }
        } catch (err) {}
    }

    let __ytUrlObsInstalled = false;
    function observeUrlChanges() {
        try {
            if (__ytUrlObsInstalled) return;
            __ytUrlObsInstalled = true;

            let currentUrl = window.location.href;
            const observer = trackObserver(new MutationObserver(() => {
                if (currentUrl !== window.location.href) {
                    currentUrl = window.location.href;
                    enforceSanity();
                    enforceShortsRedirect();
                }
            }));

            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
                devLog('URL observer started');
            } else {
                addTimeout(observeUrlChanges, 100);
            }
        } catch (err) {}
    }

    let __ytPopupObsInstalled = false;
    function observePopupChanges() {
        try {
            if (__ytPopupObsInstalled) return;
            __ytPopupObsInstalled = true;

            const observer = trackObserver(new MutationObserver((mutations) => {
                let sawNewCards = false;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { 
                                if (node.matches && (
                                    node.matches('[role="dialog"]') ||
                                    node.matches('ytd-popup-container') ||
                                    node.matches('tp-yt-paper-dialog') ||
                                    node.matches('ytd-enforcement-message-view-model')
                                )) {
                                    const text = node.textContent?.toLowerCase() || "";
                                    if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                                        devLog('Hiding newly added adblock popup');
                                        node.style.display = "none";
                                        node.style.visibility = "hidden";
                                    }
                                }
                                
                                const popupChildren = node.querySelectorAll ? 
                                    node.querySelectorAll('[role="dialog"], ytd-popup-container, tp-yt-paper-dialog') : 
                                    [];
                                popupChildren.forEach(child => {
                                    const text = child.textContent?.toLowerCase() || "";
                                    if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                                        devLog('Hiding adblock popup in new content');
                                        child.style.display = "none";
                                        child.style.visibility = "hidden";
                                    }
                                });

                                if (!sawNewCards && node.querySelectorAll) {
                                    if (videoContainers.some(selector => node.matches(selector) || node.querySelector(selector))) {
                                        sawNewCards = true;
                                    }
                                }
                            }
                        });
                    }
                });
                if (sawNewCards) {
                    hideBannedVideoCards();
                }
            }));

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                devLog('Popup/suggestion observer started');
            }
        } catch (err) {}
    }

    let __ytHistoryHooksInstalled = false;
    function installUrlChangeHooks() {
        if (__ytHistoryHooksInstalled) return;
        __ytHistoryHooksInstalled = true;

        try {
            const wrap = (type) => {
                const orig = history[type];
                return function() {
                    const rv = orig.apply(this, arguments);
                    try { window.dispatchEvent(new Event('locationchange')); } catch {}
                    return rv;
                };
            };
            history.pushState = wrap('pushState');
            history.replaceState = wrap('replaceState');
            onEvent(window, 'popstate', () => window.dispatchEvent(new Event('locationchange')), false);

            onEvent(window, 'locationchange', () => {
                enforceSanity();
                hideBannedVideoCards();
                enforceShortsRedirect();
                removeShortsOnPage();
                addOpenInWatchButton();
                hideShortsGuideEntries();
            }, false);

            onEvent(window, 'yt-navigate-finish', () => {
                enforceSanity();
                hideBannedVideoCards();
                enforceShortsRedirect();
                removeShortsOnPage();
                addOpenInWatchButton();
                hideShortsGuideEntries();
            }, false);
            onEvent(window, 'yt-navigate-start', () => {
                stopIntervals();
            }, false);
        } catch (e) {}
    }

    const __shortsConfig = {
        enable: true,
        hideTabs: true,
        hideShortsVideos: true
    };

    function logf(message, style) {
        const composed = `[Youtube-shorts block] ${message}`;
        if (style === "error") {
            console.error(composed);
        } else {
            console.log(composed);
        }
    }
    async function querySelectorPromise(selectors, limit = 5, interval = 100) {
        let element;
        for (let i = 0; i < limit; i++) {
            element = document.querySelector(selectors);
            if (element) return element;
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
        return null;
    }
    async function querySelectorAllPromise(selectors, limit = 5, interval = 100) {
        let elements = document.querySelectorAll(selectors);
        if (elements.length !== 0) return elements;
        for (let i = 0; i < limit - 1; i++) {
            await new Promise((resolve) => setTimeout(resolve, interval));
            elements = document.querySelectorAll(selectors);
            if (elements.length !== 0) return elements;
        }
        return elements;
    }

    function reelShelfFilter() {
        const reels = document.querySelectorAll(
            "ytd-reel-shelf-renderer, ytm-reel-shelf-renderer"
        );
        for (const reel of reels) {
            reel.remove();
        }
    }
    async function richShelfFilter() {
        const selectors = [
            "ytd-rich-shelf-renderer:has(h2>yt-icon:not([hidden]))",
            "grid-shelf-view-model:has(ytm-shorts-lockup-view-model)"
        ];
        for (const s of selectors) {
            const shelfs = await querySelectorAllPromise(s);
            for (const shelf of shelfs) {
                shelf.remove();
            }
        }
    }
    function shortsFilter() {
        const shorts = document.querySelectorAll(
            "ytd-video-renderer ytd-thumbnail a, ytd-grid-video-renderer ytd-thumbnail a, ytm-video-with-context-renderer a.media-item-thumbnail-container"
        );
        const tags = [
            "YTD-VIDEO-RENDERER",
            "YTD-GRID-VIDEO-RENDERER",
            "YTM-VIDEO-WITH-CONTEXT-RENDERER"
        ];
        for (const i of shorts) {
            if (i.href.indexOf("shorts") != -1) {
                let node = i.parentNode;
                while (node) {
                    if (tags.includes(node.nodeName)) {
                        node.remove();
                        break;
                    }
                    node = node.parentNode;
                }
            }
        }
    }

    function convertShortsToVideoURL(url) {
        const result = url.match(/shorts\/([A-Za-z0-9_-]{11})/);
        if (result) {
            return `https://www.youtube.com/watch?v=${result[1]}`;
        }
    }

    function enforceShortsRedirect() {
        try {
            if (!__shortsConfig.enable) return;
            if (location.pathname.startsWith('/watch')) return; 
            const url = convertShortsToVideoURL(location.href);
            if (url && location.href !== url) {
                devLog(`Redirecting Shorts to watch: ${url}`);
                try { history.replaceState(null, '', url); } catch {}
                location.replace(url);
            }
        } catch (e) {}
    }

    function addOpenInWatchButton() {
        try {
            if (location.href.indexOf('/shorts/') === -1) return;
            const elements = document.querySelectorAll("#actions.ytd-reel-player-overlay-renderer");
            elements.forEach((element) => {
                const parent = element.parentNode;
                if (!parent) return;
                if (parent.querySelector(".youtube-shorts-block")) return;

                const container = document.createElement('div');
                container.id = 'block';
                container.className = 'youtube-shorts-block';
                container.title = 'Open in watch';

                const svgNS = "http://www.w3.org/2000/svg";
                const svg = document.createElementNS(svgNS, 'svg');
                svg.setAttribute('xmlns', svgNS);
                svg.setAttribute('height', '24px');
                svg.setAttribute('width', '24px');
                svg.setAttribute('viewBox', '0 -960 960 960');
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', 'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z');
                svg.appendChild(path);

                const textNode = document.createElement('span');
                textNode.appendChild(document.createTextNode('Open in new tab'));

                container.appendChild(svg);
                container.appendChild(textNode);

                container.addEventListener('click', () => {
                    document.querySelectorAll('video').forEach((e) => {
                        try { e.pause(); } catch {}
                    });
                    const to = convertShortsToVideoURL(location.href);
                    if (to) window.open(to);
                });

                element.insertAdjacentElement('afterbegin', container);
            });
        } catch (e) {}
    }

    function injectShortsCSS() {
        try {
            if (document.documentElement.querySelector('style[data-ytenhancer-shorts-css]')) return;
            const css = `
:root{
    --iron-icon-color: #606060;
}
.youtube-shorts-block a[title='Shorts']{
    display: none !important;
    pointer-events: none !important;
}
.youtube-shorts-block ytm-pivot-bar-item-renderer:has(.pivot-bar-item-tab.pivot-shorts){
    display: none !important;
}
#block.youtube-shorts-block{
    color: white;
    margin: 6px 0;
    display: flex;
    flex-flow: column;
    text-align: center;
    font-size: 14px;
    user-select: none;
    cursor: pointer;
}
#block.youtube-shorts-block>svg{
    fill: white;
    margin: auto;
}
ytd-continuation-item-renderer:not(:last-child){
    display: none;
}
@media screen and (min-width:600px){
    #block.youtube-shorts-block{
        color: var(--iron-icon-color);
    }
    #block.youtube-shorts-block>svg{
        fill: var(--iron-icon-color);
    }
}`;
            const style = document.createElement('style');
            style.type = 'text/css';
            style.setAttribute('data-ytenhancer-shorts-css', '');
            style.appendChild(document.createTextNode(css));
            (document.head || document.documentElement).appendChild(style);

            if (__shortsConfig.hideTabs) {
                if (document.body) {
                    document.body.classList.add('youtube-shorts-block');
                } else {
                    addTimeout(() => { if (document.body) document.body.classList.add('youtube-shorts-block'); }, 100);
                }
            }
        } catch (e) {}
    }

    async function removeShortsOnPage() {
        try {
            if (!__shortsConfig.hideShortsVideos) return;
            reelShelfFilter();
            await richShelfFilter();
            shortsFilter();
        } catch (e) {}
    }

    function hideShortsGuideEntries() {
        try {
            const anchors = document.querySelectorAll('a#endpoint.yt-simple-endpoint[href*="/shorts"], a#endpoint.yt-simple-endpoint[title="Shorts"]');
            anchors.forEach(a => {
                const entry = a.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
                if (entry) {
                    entry.style.display = 'none';
                    entry.style.visibility = 'hidden';
                } else {
                    a.style.display = 'none';
                    a.style.visibility = 'hidden';
                }
            });
            document.querySelectorAll('ytm-pivot-bar-item-renderer .pivot-bar-item-tab.pivot-shorts')
                .forEach(tab => {
                    const pivot = tab.closest('ytm-pivot-bar-item-renderer');
                    if (pivot) {
                        pivot.style.display = 'none';
                        pivot.style.visibility = 'hidden';
                    }
                });
        } catch (e) {}
    }

    let __ytShortsObsInstalled = false;
    function observeShortsDomChanges() {
        try {
            if (__ytShortsObsInstalled) return;
            __ytShortsObsInstalled = true;

            const install = async () => {
                const target = await querySelectorPromise('#content, #app') || document.body || document.documentElement;
                if (!target) return;
                const observer = trackObserver(new MutationObserver(() => {
                    removeShortsOnPage();
                    addOpenInWatchButton();
                    hideShortsGuideEntries();
                }));
                observer.observe(target, { childList: true, subtree: true });
                removeShortsOnPage();
                hideShortsGuideEntries();
                devLog('Shorts DOM observer started');
            };
            install();
        } catch (e) {}
    }

    devLog('YouTube Enhancer initializing');

    // Initial checks
    enforceSanity();
    enforceShortsRedirect();
    installUrlChangeHooks();

    observeUrlChanges();
    observePopupChanges();
    injectShortsCSS();
    observeShortsDomChanges();
    addOpenInWatchButton();
    hideShortsGuideEntries();

    // Periodic tasks with lifecycle tracking
    function scheduleMainIntervals() {
        addInterval(() => { if (!document.hidden) hideBannedVideoCards(); }, 250);
        addInterval(() => { if (!document.hidden) enforceSanity(); }, 500); 
        addInterval(() => { if (!document.hidden) removeShortsOnPage(); }, 300);
        addInterval(() => { if (!document.hidden) removeAdblockPopups(); }, 500);
        addInterval(() => { if (!document.hidden) addOpenInWatchButton(); }, 600);
        addInterval(() => { if (!document.hidden) handlePopupButtons(); }, 1000);
        addInterval(() => { if (!document.hidden) hideShortsGuideEntries(); }, 1200);
        addInterval(() => { if (!document.hidden) enforceShortsRedirect(); }, 1500);
    }
    startIntervals(scheduleMainIntervals);

    addTimeout(removeAdblockPopups, 1000);
    addTimeout(handlePopupButtons, 2000);
    addTimeout(removeShortsOnPage, 750);
    addTimeout(hideShortsGuideEntries, 800);

    onEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleMainIntervals);
            hideBannedVideoCards();
            enforceSanity();
            removeShortsOnPage();
            addOpenInWatchButton();
            hideShortsGuideEntries();
            enforceShortsRedirect();
        }
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

    devLog('YouTube Enhancer loaded');
})();