// ==UserScript==
// @name         YoutubEnhancer
// @version      3.9
// @description  Enhances my YouTube experience by blocking trackers and hiding garbage.
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
        /\balexa\b/i, /Bliss/i, /Alexa Bliss/i, /lex kauf/i, /lex cabr/i, /lex carbr/i, /Tiffany/i, /Tiffy/i, /Stratton/i, /Chelsea Green/i, /Bayley/i, /Blackheart/i, /Alba Fyre/i, 
        /Becky Lynch/i, /Michin/i, /Mia Yim/i, /#satan666/i, /julmakira/i, /Stephanie/i, /Liv Morgan/i, /Piper Niven/i, /queer/i, /Pride/i, /NXT Womens/i, /model/i, /model/i, /carbrera/i,
        /Jordynne/i, /Woman/i, /Women/i, /Maryse/i, /\bai\b/i, /Women's/i, /Woman's/i, /Summer Rae/i, /Naomi/i, /Bianca Belair/i, /Charlotte/i, /Jessika Carr/i, /Mercedes/i, /cabrera/i,
        /Carr WWE/i, /Jessica Karr/i, /bikini/i, /Kristen Stewart/i, /Sydney Sweeney/i, /Nia Jax/i, /Young Bucks/i, /Vice WWE/i, /Candice LeRae/i, /Trish/i, /Stratus/i, /lex kaufman/i,
        /Jackson/i, /Lash Legend/i, /Jordynne Grace/i, /DeepSeek/i, /TOR-Browser/i, /TOR-selain/i, /Opera GX/i, /prostitute/i, /AI-generated/i, /AI generated/i, /sensuel/i, /\bshe\b/i,
        /deepnude/i, /undress/i, /nudify/i, /nude/i, /nudifier/i, /faceswap/i, /facemorph/i, /AI app/i, /Sweeney/i, /Alexis/i, /Sydney/i, /Zelina Vega/i, /Mandy Rose/i, /\bher\b/i, /\btor\b/i,
        /Nikki/i, /Brie/i, /Bella/i, /Opera Browser/i, /by AI/i, /AI edited/i, /Safari/i, /OperaGX/i, /MS Edge/i, /Microsoft Edge/i, /clothes/i, /Lola Vice/i, /leks bl/i, /leks kauf/i,   
        /crotch/i, /dress/i, /dreamtime/i, /Velvet Sky/i, /LGBTQ/i, /panties/i, /panty/i, /cloth/i, /AI art/i, /cleavage/i, /deviantart/i, /leks cabr/i, /leks carbr/i, /Elyina/i, /Elyna WWE/i, 
        /Tiffy Time/i, /Steward/i, /Roxanne/i, /cameltoe/i, /dreamtime AI/i, /Joanie/i, /bra/i, /Stewart/i, /Isla Dawn/i, /inpaint/i, /photopea/i, /onlyfans/i, /fantime/i, /lingerie/i, 
        /upscale/i, /sexy/i, /Alexa WWE/i, /AJ Lee/i, /deepfake/i, /ring gear/i, /Lexi/i, /\bTrans\b/i, /Transvestite/i, /Aleksa/i, /Giulia/i, /\bbooty\b/i, /Paige/i, /Chyna/i, /\bToni\b/i,
        /Skye Blue/i, /Carmella/i, /Mariah May/i, /Harley Cameron/i, /Hayter/i, /trunks/i, /pant/i, /Ripley/i, /manyvids/i, /five feet of fury/i, /5 feet of fury/i, /selain/i, /\blana\b/i, 
        /browser/i, /fansly/i, /justforfans/i, /Vince Russo/i, /Tay Conti/i, /Valhalla/i, /IYO SKY/i, /Shirai/i, /Io Sky/i, /Iyo Shirai/i, /Dakota Kai/i, /Asuka/i, /AI model/i, /deep fake/i,
        /Kairi Sane/i, /Meiko Satomura/i, /NXT Women/i, /Russo/i, /underwear/i, /Rule 34/i, /Miko Satomura/i, /Sarray/i, /Xia Li/i, /Shayna Baszler/i, /Ronda Rousey/i, /nudifying/i, /undressing/i,
        /Dana Brooke/i, /Izzi Dame/i, /Tamina/i, /Alicia Fox/i, /Madison Rayne/i, /Saraya/i, /attire/i, /Layla/i, /Michelle McCool/i, /Eve Torres/i, /Kelly/i, /Melina WWE/i, /undressifying/i, 
        /Jillian Hall/i, /Mickie James/i, /Su Yung/i, /Britt/i, /Nick Jackson/i, /Matt Jackson/i, /fan time/i, /Maria Kanellis/i, /Beth Phoenix/i, /Victoria WWE/i, /Kristen/i, /Lana WWE/i,
        /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i, /Deonna Purrazzo/i, /Anna Jay/i, /\bRiho\b/i, /Britney/i, /Nyla Rose/i, /Angelina Love/i, /Tessmacher/i, /Havok/i, /Toni Storm/i, /Watchorn/i,
        /Taya Valkyrie/i, /Valkyria/i, /Tay Melo/i, /Willow Nightingale/i, /Statlander/i, /Hikaru Shida/i, /Sasha/i, /Penelope Ford/i, /Shotzi/i, /Tegan/i, /Vladimir Putin/i, /beta male/i,
        /Nox/i, /Sasha Banks/i, /Sakura/i, /Tessa/i, /Brooke/i, /Jakara/i, /Alba Fyre/i, /Isla Dawn/i, /Scarlett Bordeaux/i, /\bB-Fab\b/i, /Kayden Carter/i, /Katana Chance/i, /\bMina\b/i, /alpha male/i,
        /Lyra Valkyria/i, /Indi Hartwell/i, /Blair Davenport/i, /Maxxine Dupri/i, /China/i, /Russia/i, /Natalya/i, /Sakazaki/i, /Karmen Petrovic/i, /Ava Raine/i, /CJ Perry/i, /Shira/i, /Elayna/i, 
        /Cora Jade/i, /Jacy Jayne/i, /Gigi Dolin/i, /Thea Hail/i, /Tatum WWE/i, /Paxley/i, /Fallon Henley/i, /Nattie/i, /escort/i, /Sol Ruca/i, /Kelani Jordan/i, /CJ Lana/i, /Lana Perry/i,
        /Electra Lopez/i, /Wendy Choo/i, /Yulisa Leon/i, /Gina Adam/i, /Valentina Feroz/i, /Amari Miller/i, /Arianna Grace/i, /Courtney Ryan/i, /Venice/i, /Venoice/i, /Venise/i, /Venoise/i, /Sharia/i,
        /\bLin\b/i, /Watchorn/i, /@LinWatchorn/i, /wondershare/i, /wonder share/i, /filmora/i, /dreambooth/i, /dream booth/i, /dream boot/i, /dreamboot/i, /diffusion/i, /Elina WWE/i, /virtual workstation/i, 
        /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, 
        /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, /OracleVM/i, /virtualmachine/i, /virtual machine/i, /virtuaalikone/i, /virtuaali kone/i, /virtuaali tietokone/i, /virtuaalitietokone/i, 
        /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, /virtuaali masiina/i,  /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i,  /virtual workstation/i, /virtualworkstation/i, 
        /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, 
        /vibox virtual/i, /vbox virtual/i, /v-machine/i,  /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /virtmachine/i, 
        /virt-machine/i, /virtumachine/i, /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, /\bMachiene\b/i, 
        /vi mach/i, /vir mach/i, /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /virtual machi/i, /Dua Lipa/i, /Dualipa/i,
    ];

    // List of keywords or phrases to allow (overrides blockKeywords in search queries)
    const allowedWords = [
        /tutorial/i, /how to/i, /review/i, /setup/i, /guide/i, /educational/i, /coding/i, /programming/i, /course/i, /demo/i, /learning/i, /Sampsa/i, /Kurri/i, /iotech/i, /Jimms/i, /verkkokauppa/i, /learning/,
        /reddit/i, /OSRS/i, /RS/i, /RS3/i, /Old School/i, /RuneScape/i, /netflix/i, /pushpull/i, /facebook/i, /instagram/i, /Wiki/i, /pedia/i, /hikipedia/i, /fandom/i, /lehti/i, /bond/i, /bonds/i, /2007scape/,
        /vaihdetaan/i, /vaihdan/i, /vaihto/i, /vaihtoi/i, /vaihdossa/i, /vaihtaa/i, /paa/i, /jakohihna/i, /jakopää hihna/i, /jako hihna/i, /jako pää hihna/i, /jako päähihna/i, /\?/i, /\!/i, /opas/i, /oh/,
        /south park/i, /siivoton juttu/i, /poliisin poika/i, /poliisi/i, /poika/i, /Edge WWE/i, /Ravage/i, /Savage/i, /volksvagen/i, /GTA/i, /Grand Theft Auto/i, /videopeli/i, /videogame/i, /video game/i, /ra/,
    ];

    // Anti-adblock warning text patterns (Finnish and other languages)
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

    // Redirect URL (YouTube homepage)
    const redirectUrl = "https://www.youtube.com/";

    // Array of selectors to hide elements
    const selectors = [
        // Desktop feed/search/video cards
        "ytd-rich-item-renderer",
        "yt-formatted-string#video-title",
        "yt-formatted-string.metadata-snippet-text",
        "ytd-channel-name a",
        "#description-container yt-formatted-string",
        "#contents > ytd-video-renderer:nth-child(4)",
        "#contents > ytd-channel-renderer",
        "#dismissible",
        "#dismissible > ytd-thumbnail",
        "#dismissible > div",
        "#title-wrapper",
        "#title-wrapper > h3",
        "#video-title",
        "#video-title > yt-formatted-string",
        "body > ytd-app > ytd-miniplayer",
        "#contents > yt-lockup-view-model > div > div > yt-lockup-metadata-view-model > div.yt-lockup-metadata-view-model-wiz__text-container",
        "#contents > yt-lockup-view-model > div > div > yt-lockup-metadata-view-model > div.yt-lockup-metadata-view-model-wiz__text-container > h3",
        "#contents > yt-lockup-view-model > div > div > yt-lockup-metadata-view-model > div.yt-lockup-metadata-view-model-wiz__text-container > h3 > a",
        "#contents > yt-lockup-view-model > div > div > yt-lockup-metadata-view-model > div.yt-lockup-metadata-view-model-wiz__text-container > h3 > a > span",

        // Desktop watch-page suggestions
        "ytd-compact-video-renderer",
        "ytd-compact-autoplay-renderer",
        "ytd-compact-radio-renderer",
        "#related ytd-video-renderer",

        // Mobile (ytm-*) feed/search/watch variants
        "ytm-rich-item-renderer",
        "ytm-video-renderer",
        "ytm-video-with-context-renderer",
        "ytm-compact-video-renderer",
        "ytm-compact-radio-renderer",
        "ytm-compact-autoplay-renderer",
        "#related ytm-video-renderer"
    ];

    // Specific selectors for adblock warning popups
    const adblockPopupSelectors = [
        "ytd-popup-container",
        "tp-yt-paper-dialog",
        "ytd-enforcement-message-view-model",
        "ytd-message-renderer",
        "yt-confirm-dialog-renderer"
    ];

    // Function to remove specific adblock warning popups
    function removeAdblockPopups() {
        try {
            let removedCount = 0;
            
            // Check specific popup selectors
            adblockPopupSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent?.toLowerCase() || "";
                    
                    // Only remove if it contains adblock warning text
                    if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                        devLog(`Removing adblock popup: ${selector}`);
                        el.style.display = "none";
                        el.style.visibility = "hidden";
                        removedCount++;
                        
                        // Find and hide the backdrop/overlay
                        const backdrop = el.closest('[role="presentation"]') || 
                                       el.closest('.scrim') || 
                                       el.closest('[class*="backdrop"]');
                        if (backdrop) {
                            backdrop.style.display = "none";
                        }
                    }
                });
            });

            // Check for modal dialogs with role="dialog"
            const dialogs = document.querySelectorAll('[role="dialog"]');
            dialogs.forEach(dialog => {
                const text = dialog.textContent?.toLowerCase() || "";
                if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                    devLog('Hiding adblock warning dialog');
                    dialog.style.display = "none";
                    dialog.style.visibility = "hidden";
                    removedCount++;
                    
                    // Hide parent container if it's a modal wrapper
                    const parent = dialog.parentElement;
                    if (parent && (parent.classList.contains('scrim') || 
                                  parent.hasAttribute('aria-modal') ||
                                  parent.getAttribute('role') === 'presentation')) {
                        parent.style.display = "none";
                    }
                }
            });

            // Restore body scrolling if it was disabled
            const body = document.body;
            if (body && body.style.overflow === 'hidden') {
                // Only restore if there are no visible dialogs left
                const visibleDialogs = document.querySelectorAll('[role="dialog"]:not([style*="display: none"])');
                if (visibleDialogs.length === 0) {
                    body.style.overflow = '';
                }
            }
            
            if (removedCount > 0) {
                devLog(`Removed ${removedCount} adblock popups`);
            }
        } catch (err) {
            console.log('Error removing adblock popups: ' + err.message);
        }
    }

    // Function to check the current search query
    function checkSearchQuery() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('search_query') || '';

            if (query && blockKeywords.some(keyword => keyword.test(query)) && !allowedWords.some(word => word.test(query))) {
                console.log(`Blocked search query: ${query}`);
                window.location.href = redirectUrl;
            } else {
                devLog(`Allowed search query: ${query}`);
            }
        } catch (err) {
            console.log('Error checking search query: ' + err.message);
        }
    }

    // Function to hide elements based on selectors and banned words in their content
    function hideElementsBySelectors() {
        try {
            const elements = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)));
            let hiddenCount = 0;

            elements.forEach(el => {
                const text = el.textContent?.toLowerCase() || "";
                if (blockKeywords.some(keyword => keyword.test(text))) {
                    devLog(`Hiding element containing banned word: ${text.substring(0, 50)}...`);
                    el.style.display = "none";
                    el.style.visibility = "hidden";
                    hiddenCount++;
                    
                    const parent = el.closest([
                        "ytd-rich-item-renderer",
                        "ytd-grid-video-renderer",
                        "ytd-video-renderer",
                        "ytd-compact-video-renderer",
                        "ytd-compact-autoplay-renderer",
                        "ytd-compact-radio-renderer",
                        "ytm-rich-item-renderer",
                        "ytm-video-renderer",
                        "ytm-video-with-context-renderer",
                        "ytm-compact-video-renderer",
                        "ytm-compact-radio-renderer",
                        "ytm-compact-autoplay-renderer"
                    ].join(', '));
                    if (parent) {
                        parent.style.display = "none";
                        parent.style.visibility = "hidden";
                    }
                }
            });
            
            if (hiddenCount > 0) {
                devLog(`Hidden ${hiddenCount} elements with banned content`);
            }
        } catch (err) {
            console.log('Error hiding elements by selectors: ' + err.message);
        }
    }

    // Ensure watch-page suggestions (right sidebar/autoplay/compact) are filtered consistently (desktop + mobile)
    function filterWatchSuggestions() {
        try {
            const suggestionSelectors = [
                // Desktop
                "ytd-compact-video-renderer",
                "ytd-compact-autoplay-renderer",
                "ytd-compact-radio-renderer",
                "#related ytd-video-renderer",
                // Mobile
                "ytm-compact-video-renderer",
                "ytm-compact-radio-renderer",
                "ytm-compact-autoplay-renderer",
                "#related ytm-video-renderer"
            ];
            let hiddenCount = 0;
            document.querySelectorAll(suggestionSelectors.join(',')).forEach(item => {
                if (item.style.display === 'none') return;
                const text = item.textContent?.toLowerCase() || "";
                if (blockKeywords.some(keyword => keyword.test(text))) {
                    item.style.display = "none";
                    item.style.visibility = "hidden";
                    hiddenCount++;
                }
            });
            if (hiddenCount > 0) devLog(`Hidden ${hiddenCount} suggested items on watch page`);
        } catch (err) {
            console.log('Error filtering watch suggestions: ' + err.message);
        }
    }

    // Function to handle clicks on "Skip" or "Continue" buttons in popups
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
                    
                    // Check if this button is in an adblock warning popup
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
        } catch (err) {
            console.log('Error handling popup buttons: ' + err.message);
        }
    }

    // Observe URL changes to check for search queries (kept)
    let __ytUrlObsInstalled = false;
    function observeUrlChanges() {
        try {
            if (__ytUrlObsInstalled) return;
            __ytUrlObsInstalled = true;

            let currentUrl = window.location.href;
            const observer = trackObserver(new MutationObserver(() => {
                if (currentUrl !== window.location.href) {
                    currentUrl = window.location.href;
                    checkSearchQuery();
                }
            }));

            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
                devLog('URL observer started');
            } else {
                addTimeout(observeUrlChanges, 100);
            }
        } catch (err) {
            console.log('Error setting up URL observer: ' + err.message);
        }
    }

    // Enhanced mutation observer for new popup content and suggestions
    let __ytPopupObsInstalled = false;
    function observePopupChanges() {
        try {
            if (__ytPopupObsInstalled) return;
            __ytPopupObsInstalled = true;

            const observer = trackObserver(new MutationObserver((mutations) => {
                let sawNewSuggestions = false;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { // Element node
                                // Check if the new node is a popup
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
                                
                                // Check child elements of the new node
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

                                // Watch-page suggestions can load dynamically (desktop + mobile)
                                if (!sawNewSuggestions && node.querySelectorAll) {
                                    if (
                                        node.matches('ytd-compact-video-renderer, ytd-compact-autoplay-renderer, ytd-compact-radio-renderer, #related ytd-video-renderer, ytm-compact-video-renderer, ytm-compact-radio-renderer, ytm-compact-autoplay-renderer, #related ytm-video-renderer') ||
                                        node.querySelector('ytd-compact-video-renderer, ytd-compact-autoplay-renderer, ytd-compact-radio-renderer, #related ytd-video-renderer, ytm-compact-video-renderer, ytm-compact-radio-renderer, ytm-compact-autoplay-renderer, #related ytm-video-renderer')
                                    ) {
                                        sawNewSuggestions = true;
                                    }
                                }
                            }
                        });
                    }
                });
                if (sawNewSuggestions) {
                    filterWatchSuggestions();
                }
            }));

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                devLog('Popup/suggestion observer started');
            }
        } catch (err) {
            console.log('Error setting up popup observer: ' + err.message);
        }
    }

    // Robust SPA navigation hooks to restore redirect on banned searches
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

            // React when URL changes, regardless of how navigation happened
            onEvent(window, 'locationchange', () => {
                checkSearchQuery();
                hideElementsBySelectors();
                filterWatchSuggestions();
            }, false);

            // YouTube-specific navigation lifecycle events (best-effort)
            onEvent(window, 'yt-navigate-finish', () => {
                checkSearchQuery();
                hideElementsBySelectors();
                filterWatchSuggestions();
            }, false);
            onEvent(window, 'yt-navigate-start', () => {
                // clear pending intervals if leaving page to avoid bursts
                stopIntervals();
            }, false);
        } catch (e) {
            console.log('[YOUTUBE.JS] history hook error: ' + e.message);
        }
    }

    // Intercept search submissions to block before navigating (desktop + mobile)
    function interceptSearchSubmissions() {
        try {
            // Capture submits globally (YouTube re-renders search box often)
            onEvent(document, 'submit', (e) => {
                const form = e.target;
                if (!form) return;

                // Desktop search box and general results forms
                const isSearchForm =
                    form.id === 'search-form' ||
                    form.closest('ytd-searchbox') ||
                    form.getAttribute('action') === '/results' ||
                    form.matches('form[action="/results"]') ||
                    form.closest('form[action="/results"]');

                if (!isSearchForm) return;

                // Gather possible inputs across desktop + mobile variants
                const candidates = [
                    form.querySelector('input[name="search_query"]'),
                    form.querySelector('#search'),
                    form.querySelector('input#search'),
                    form.querySelector('input[type="search"]'),
                    form.querySelector('input[aria-label="Search YouTube"]'),
                    document.querySelector('ytd-searchbox input#search'),
                    document.querySelector('ytm-searchbox input[type="search"]'),
                    document.querySelector('ytm-searchbox input[name="search_query"]')
                ].filter(Boolean);

                const q = (candidates.find(i => (i.value || '').trim().length)?.value || '').trim();

                if (q && blockKeywords.some(rx => rx.test(q)) && !allowedWords.some(rx => rx.test(q))) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`Blocked search submission: ${q}`);
                    window.location.href = redirectUrl;
                }
            }, true);
        } catch (e) {
            console.log('Error intercepting search submissions: ' + e.message);
        }
    }

    devLog('YouTube Enhancer initializing');

    // Initial checks
    checkSearchQuery();
    installUrlChangeHooks();
    interceptSearchSubmissions();

    // Start observing URL changes (kept) and popup/suggestion changes
    observeUrlChanges();
    observePopupChanges();

    // Periodic tasks with lifecycle tracking (unchanged cadence)
    function scheduleMainIntervals() {
        addInterval(() => { if (!document.hidden) hideElementsBySelectors(); }, 250);
        addInterval(() => { if (!document.hidden) filterWatchSuggestions(); }, 350);
        addInterval(() => { if (!document.hidden) removeAdblockPopups(); }, 500);
        addInterval(() => { if (!document.hidden) handlePopupButtons(); }, 1000);
    }
    startIntervals(scheduleMainIntervals);

    // Initial popup removal after page load
    addTimeout(removeAdblockPopups, 1000);
    addTimeout(handlePopupButtons, 2000);

    // Pause/resume intervals on visibility change
    onEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleMainIntervals);
            // quick sweep on resume for fresh DOM
            hideElementsBySelectors();
            filterWatchSuggestions();
        }
    }, false);

    // Teardown on pagehide/beforeunload to avoid leaks
    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

    devLog('YouTube Enhancer with targeted adblock popup removal loaded');
})();