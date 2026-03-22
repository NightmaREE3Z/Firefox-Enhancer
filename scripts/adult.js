(function () {
    'use strict';

    console.log("XVideos Tracker Blocking and Content Filtering script is running.");

    // List of blocked content selectors (optional, adjust as needed)
    const blockSelectors = [
        // Leftovers from "extra.js"
        '.is-sh',

        // Existing selectors
        '.h89F20Be33CbCbbc86A39FAC9Ecdb7Eaa',
        '.ntvbb39f1a4fbfB7BC3598CbD224f8e2BB9',
        '.videoad-title-txt > strong',
        '.h91229b450eb7B15bC39f3DE0F015F9ef > p > span',
        '.h91229b450eb7B15bC39f3DE0F015F9ef > p',
        '.h91229b450eb7B15bC39f3DE0F015F9ef',
        '.ntv6AB7a9eB4c8BB21B0178A95feCDAB1Ec',
        '.ntv6AB7a9eB4c8BB21B0178A95feCDAB1Ec > .btn',
        '.videoad-title-txt',
        '.sheer-sponsor.noselect.videoad-title-invideo.videoad-title',
        '.hA895aBD4d64A2Fa4c4F8420cf8B662fC',
        '.hABa422d7CeD4318EC3FB5fa0DdD4FFD6',
        '.ntvdb927B1C2b659fEFAAEAccdb27c8cFeb',
        '.msC25cDba3aa02D065E7fAF726D8BE444d',
        '.ntv5cEBb4DA8Cab53861deC68948d20D82a',
        '.ntvA4bceECc91D5CD0f99E4F2c88a196f44',
        '.ntv91a5B3aA73ea5Eb47CEb0c4906B81fF9',
        '.ntv27afEb15E80d296aCc2aEf2c81Ced8d7',
        '.msC25cDba3aa02D065E7fAF726D8BE444d',
        '.ntv4AC658c95df05A57A3fa6D8Eb2f3a5e0',
        '.ntv3Ff9a2974c0C2e11bDdf7C9df1A945Ca',
        '.ntvAFf474a6Edfdbb5179e7Ac3ef478FF2D',
        '.ntvc24718ABeAEcdeEA1e2cB75C89B0Fd9c',
        '.ntv5FAb56c4D2759E0a5Ec1BEE9ea8A6F8F',
    ];

    // List of blocked keywords
    const blockedKeywords = [
        "deepnude", "nudify", "undress", "alexa_poshspisy", "Alexa_poshspisy", "alexa", "alexaposhspicy-model", "alexaposhspicy", "whore", "slut", "dreamtime AI", "face swap", "Lana", "playboy", "Monroe",
        "deviantart", "deviant art", "Bella", "Nikki", "Brie", "Chyna", "China", "Hulk", "Joanie Laurer", "NJPW", "pride", "McMahon", "Zelina Vega", "Stewart", "Sydney", "facemorph", "Del Rey", "shirakawa",
        "undress-app", "deepnude-app", "nudify-app", "deepseek", "Lola Vice", "WWE", "poshspicy", "Alexa", "Lexi", "TNA", "AEW", "bitch", "LGBT", "Sydney Sweeney", "faceswap", "face morph", "CJ Perry", "Blake",
        "lex bl", "leks bl", "Hogan", "Alexa Bliss", "Tiffy", "app", "new app", "Bliss", "Tiffy Time", "Sol", "Liv Morgan", "Liv Xoxo", "Morgan Xoxo", "Kristen Stewart", "swapface", "morph face", "wondershare",
        "rule34", "r34", "r_34", "Rule 34", "Rul", "Rul34", "Rul 34", "Stratton", "Ruca", "AI", "LGBTQ", "Gay", "Trans", "Transvestite", "anorexic", "Kristen", "Steward", "swap face", "morphface", "filmora",
	"Saya Kamitani", "Kamitani", "Katie", "Nikkita", "Nikkita Lyons", "Lisa Marie", "Lisa Marie Varon", "Lisa Varon", "Marie Varon", "Irving", "Naomi", "Belts Mone", "Amanda Huber", 
    ];

    // List of blocked regex keywords
    const blockedRegexWords = [
        /deepn/i, /deepf/i, /deeps/i, /udif/i, /nudif/i, /alexa/i, /ndres/i, /poshspisy/i, /alexa_poshspisy/i, /Liv Morgan/i, /Liv Xoxo/i, /Morgan Xoxo/i, /Sweeney/i, /Sydne/i, /Kristen Stewart/i, /Steward/i, /facemorph/i, /face morph/i, /morphface/i, /morph face/i, 
        /Bella/i, /Nikki/i, /Brie/i, /Chyna/i, /China/i, /Hulk/i, /lex bl/i, /leks bl/i, /Hogan/i, /Alexa Bliss/i, /Tiffy/i, /Bliss/i, /app/i, /Sydney Sweeney/i, /Sweee/i, /Stee/i, /Waaa/i, /Stewart/i, /face swap/i, /swap face/i, /faceswap/i, /swapface/i, /Sweee/i, /Kriis/i, 
        /LGBT/i, /wondershare/i, /filmora/i, /dreambooth/i, /dream booth/i, /Marg Robb/i, /Margo/i, /Robbie/i, /Elina/i, /Elyna/i, /Elyina/i, /Eliyna/i, /Eliyina/i, /Dualipa/i, /Dua Lipa/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, 
	/Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, /Alici/i, /Arisu Endo/i, /Crowley/i,  /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Lily Adam/i, /\bAi\b/i, /\bMLM\b/i, /\bLLM\b/i,
    ];

    // List of selectors to check for blocked keywords on video pages
    const videoPageSelectors = [
        '.cropped.ordered-label-list.video-tags-list.video-metadata > ul',
        '.btn-default.btn.is-keyword',
        '.is-pornstar.hover-name.profile.label.btn-default.btn > .name',
        '.is-pornstar.hover-name.profile.label.btn-default.btn',
        'li.model:nth-of-type(2)',
        'div.thumb-under > p.metadata > span > span:nth-child(2) > a > span',
        '.hover-name.uploader-tag.main.label.btn-default.btn > .name',
        '.hover-name.uploader-tag.main.label.btn-default.btn',
        '.main-uploader',
        '.cropped.ordered-label-list.video-tags-list.video-metadata',
        'span.name',
        'div.thumb-under > p.metadata',
        'div.thumb-under > p.metadata > span',
        'div.thumb-under > p.metadata > span > span:nth-child(2)',
        'div.thumb-under > p.metadata > span > span:nth-child(2) > a',
        'div.thumb-under > p.metadata > span > span:nth-child(2) > a > span',
        'div.thumb-under > p.metadata > span > span:nth-child(2) > a',
        'div.thumb-under > p.metadata > span > span:nth-child(2)',
        'div.thumb-under > p.metadata > span',
        'div.thumb-under > p.metadata',
    ];

    // Function to check for blocked content and redirect if found on video pages
    function checkAndRedirectVideoPageBlockedContent() {
        const elements = document.querySelectorAll(videoPageSelectors.join(', '));
        let blockedContentFound = false;

        elements.forEach(element => {
            if (blockedKeywords.some(keyword => element.innerText.toLowerCase().includes(keyword.toLowerCase())) ||
                blockedRegexWords.some(keyword => keyword.test(element.innerText))) {
                blockedContentFound = true;
                console.log(`Blocked content found in element: ${element.innerText}`); // Optional: Logging for debugging
            }
        });

        if (blockedContentFound) {
            console.log('Redirecting due to blocked content on video page');
            window.location.href = 'https://www.xvideos.com'; // Redirect to home page.
        }
    }

    // Function to check the URL for blocked keywords and redirect if found
    function checkAndRedirectUrlBlockedContent() {
        const urlParams = new URLSearchParams(window.location.search);
        const searchTerm = urlParams.get('k');
        if (searchTerm && (blockedKeywords.some(keyword => searchTerm.toLowerCase().includes(keyword.toLowerCase())) ||
            blockedRegexWords.some(keyword => keyword.test(searchTerm)))) {
            console.log(`Blocked keyword found in URL: ${searchTerm}`); // Optional: Logging for debugging
            console.log('Redirecting due to blocked keyword in URL');
            window.location.href = 'https://www.xvideos.com'; // Redirect to home page.
        }
    }

    // Function to hide elements containing blocked keywords
    function hideBlockedContent() {
        // Target specific elements that are likely to contain titles, usernames, or keywords
        const elements = document.querySelectorAll(
            '.thumb-title a, .title a, .username, .user-profile-name, .thumb-block, .thumb, .thumb-inside, .video-title, ' +
            '.is-pornstar.hover-name.profile.label.btn-default.btn > .name, .is-pornstar.hover-name.profile.label.btn-default.btn, ' +
            'li.model:nth-of-type(2), .hover-name.uploader-tag.main.label.btn-default.btn > .name, .hover-name.uploader-tag.main.label.btn-default.btn, ' +
            '.main-uploader, .cropped.ordered-label-list.video-tags-list.video-metadata, #video_83607657 > .thumb-under > .metadata > .bg [href] > .name, ' +
            '#video_83607657 > .thumb-under > .metadata > .bg [href], .cropped.ordered-label-list.video-tags-list.video-metadata > ul, .btn-default.btn.is-keyword'
        );
        elements.forEach(element => {
            if (blockedKeywords.some(keyword => element.innerText.toLowerCase().includes(keyword.toLowerCase())) ||
                blockedRegexWords.some(keyword => keyword.test(element.innerText))) {
                const parentElement = element.closest(
                    '.thumb-block, .thumb, .thumb-inside, .video-title, .is-pornstar.hover-name.profile.label.btn-default.btn, ' +
                    'li.model:nth-of-type(2), .hover-name.uploader-tag.main.label.btn-default.btn, .main-uploader, ' +
                    '.cropped.ordered-label-list.video-tags-list.video-metadata, .metadata .bg'
                );
                if (parentElement) {
                    parentElement.style.display = 'none'; // Hide the closest parent div
                    console.log(`Blocked element containing: ${element.innerText}`); // Optional: Logging for debugging
                }
            }
        });
    }

    // Function to delete elements based on selectors
    function deleteContent() {
        blockSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.remove(); // Delete the element from the DOM
                console.log(`Deleted element: ${selector}`); // Optional: Logging for debugging
            });
        });
    }

    // Function to detect if it's the home page and perform actions accordingly
    function handleHomePage() {
        if (document.body) {
            const bodyClass = document.body.className;
            if (bodyClass.includes('home')) {
                console.log("On the home page. Performing home page specific actions.");
                // If on the home page, perform actions here (like hiding certain content, etc.)
                hideBlockedContent();
                deleteContent();
            }
        }
    }

    // Observe URL changes to check for blocked content on video pages and blocked keywords in URL
    function observeUrlChanges() {
        let currentUrl = window.location.href;
        const observer = new MutationObserver(() => {
            if (currentUrl !== window.location.href) {
                currentUrl = window.location.href;
                if (/xvideos\.com\/video/.test(currentUrl)) {
                    checkAndRedirectVideoPageBlockedContent(); // Recheck the video page content on URL change
                }
                checkAndRedirectUrlBlockedContent(); // Check the URL for blocked keywords on URL change
            }
        });

        // Ensure the document body is available before observing
        const observeWhenReady = () => {
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                // Wait until the body is available
                setTimeout(observeWhenReady, 100);
            }
        };

        observeWhenReady();
    }

    // Initial check for blocked content on video pages and blocked keywords in URL
    if (/xvideos\.com\/video/.test(window.location.href)) {
        checkAndRedirectVideoPageBlockedContent();
    }
    checkAndRedirectUrlBlockedContent();

    // Initial checks for blocked content and home page content
    hideBlockedContent();
    deleteContent();
    handleHomePage();

    // Start observing URL changes and applying content filtering
    observeUrlChanges();

    // Observe DOM changes to dynamically apply filters on new content
    const domObserver = new MutationObserver(() => {
        hideBlockedContent();
        deleteContent();
    });

    // Ensure the document body is available before observing
    const observeDOMWhenReady = () => {
        if (document.body) {
            domObserver.observe(document.body, { childList: true, subtree: true });
        } else {
            // Wait until the body is available
            setTimeout(observeDOMWhenReady, 100);
        }
    };

    observeDOMWhenReady();

})();