// ==UserScript==
// @name         YoutubEnhancer
// @version      3.8
// @description  Enhances my YouTube experience by blocking trackers and hiding garbage.
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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
        /crotch/i, /dress/i, /dreamtime/i, /Velvet Sky/i, /LGBTQ/i, /panties/i, /panty/i, /cloth/i, /AI art/i, /cleavage/i, /deviantart/i, /All Elite Wrestling/i, /leks cabr/i, /leks carbr/i,
        /Tiffy Time/i, /Steward/i, /Roxanne/i, /cameltoe/i, /dreamtime AI/i, /Joanie/i, /bra/i, /Stewart/i, /Isla Dawn/i, /inpaint/i, /photopea/i, /onlyfans/i, /fantime/i, /lingerie/i, 
        /upscale/i, /sexy/i, /Alexa WWE/i, /AJ Lee/i, /deepfake/i, /ring gear/i, /Lexi/i, /\bTrans\b/i, /Transvestite/i, /Aleksa/i, /Giulia/i, /\bbooty\b/i, /Paige/i, /Chyna/i, /\bToni\b/i,
        /Skye Blue/i, /Carmella/i, /Mariah May/i, /Harley Cameron/i, /Hayter/i, /trunks/i, /pant/i, /Ripley/i, /manyvids/i, /five feet of fury/i, /5 feet of fury/i, /selain/i, /\blana\b/i, 
        /browser/i, /fansly/i, /justforfans/i, /Vince Russo/i, /Tay Conti/i, /Valhalla/i, /IYO SKY/i, /Shirai/i, /Io Sky/i, /Iyo Shirai/i, /Dakota Kai/i, /Asuka/i, /AI model/i, /deep fake/i,
        /Kairi Sane/i, /Meiko Satomura/i, /NXT Women/i, /Russo/i, /underwear/i, /Rule 34/i, /Miko Satomura/i, /Sarray/i, /Xia Li/i, /Shayna Baszler/i, /Ronda Rousey/i, /nudifying/i, /undressing/i,
        /Dana Brooke/i, /Izzi Dame/i, /Tamina/i, /Alicia Fox/i, /Madison Rayne/i, /Saraya/i, /attire/i, /Layla/i, /Michelle McCool/i, /Eve Torres/i, /Kelly/i, /Melina WWE/i, /undressifying/i, 
        /Jillian Hall/i, /Mickie James/i, /Su Yung/i, /Britt/i, /Nick Jackson/i, /Matt Jackson/i, /fan time/i, /Maria Kanellis/i, /Beth Phoenix/i, /Victoria WWE/i, /Kristen/i, /Lana WWE/i,
        /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i, /Deonna Purrazzo/i, /Anna Jay/i, /\bRiho\b/i, /Britney/i, /Nyla Rose/i, /Angelina Love/i, /Tessmacher/i, /Havok/i, /Toni Storm/i, /Watchorn/i,
        /Taya Valkyrie/i, /Valkyria/i, /Tay Melo/i, /Willow Nightingale/i, /Statlander/i, /Hikaru Shida/i, /Sasha/i, /\bAEW\b/i, /Penelope Ford/i, /Shotzi/i, /Tegan/i, /Vladimir Putin/i, /beta male/i,
        /Nox/i, /Sasha Banks/i, /Sakura/i, /Tessa/i, /Brooke/i, /Jakara/i, /Alba Fyre/i, /Isla Dawn/i, /Scarlett Bordeaux/i, /\bB-Fab\b/i, /Kayden Carter/i, /Katana Chance/i, /\bMina\b/i, /alpha male/i,
        /Lyra Valkyria/i, /Indi Hartwell/i, /Blair Davenport/i, /Maxxine Dupri/i, /China/i, /Russia/i, /Natalya/i, /Sakazaki/i, /Karmen Petrovic/i, /Ava Raine/i, /CJ Perry/i, /Shira/i,
        /Cora Jade/i, /Jacy Jayne/i, /Gigi Dolin/i, /Thea Hail/i, /Tatum WWE/i, /Paxley/i, /Fallon Henley/i, /Nattie/i, /escort/i, /Sol Ruca/i, /Kelani Jordan/i, /CJ Lana/i, /Lana Perry/i,
        /Electra Lopez/i, /Wendy Choo/i, /Yulisa Leon/i, /Gina Adam/i, /Valentina Feroz/i, /Amari Miller/i, /Arianna Grace/i, /Courtney Ryan/i, /Venice/i, /Venoice/i, /Venise/i, /Venoise/i, /Sharia/i,
        /\bLin\b/i, /Watchorn/i, /@LinWatchorn/i, /HorizonMW/i, /Horizon MW/i, /MW2 Remaster/i, /MW3 Remaster/i, /MW2 Multiplayer Remaster/i, /MW3 Multiplayer Remastered/i, /Horizon Modern Warfare/i,
	/MW2 MP Remaster/i, /MW3 MP Remaster/i, /\bBO6\b/i, /\bBO7\b/i, /Black Ops 6/i, /Black Ops 7/i, /Black Ops VI/i, /Black Ops VII/i, /wondershare/i, /wonder share/i, /filmora/i, /dreambooth/i,
	/dream booth/i, /dream boot/i, /dreamboot/i, /diffusion/i, 
    ];

    // List of keywords or phrases to allow (overrides blockKeywords in search queries)
    const allowedWords = [
        /tutorial/i, /how to/i, /review/i, /setup/i, /guide/i, /educational/i, /coding/i, /programming/i, /course/i, /demo/i, /learning/i, /Sampsa/i, /Kurri/i, /iotech/i, /Jimms/i, /verkkokauppa/i, /learning/,
        /reddit/i, /OSRS/i, /RS/i, /RS3/i, /Old School/i, /RuneScape/i, /netflix/i, /pushpull/i, /facebook/i, /instagram/i, /Wiki/i, /pedia/i, /hikipedia/i, /fandom/i, /lehti/i, /bond/i, /bonds/i, /2007scape/,
        /vaihdetaan/i, /vaihdan/i, /vaihto/i, /vaihtoi/i, /vaihdossa/i, /vaihtaa/i, /paa/i, /jakohihna/i, /jakopää hihna/i, /jako hihna/i, /jako pää hihna/i, /jako päähihna/i, /\?/i, /\!/i, /opas/i, /oh/,
        /south park/i, /siivoton juttu/i, /poliisin poika/i, /poliisi/i, /poika/i, /Edge WWE/i, /Ravage/i, /Savage/i, /volksvagen/i, /GTA/i, /Grand Theft Auto/i, /videopeli/i, /videogame/i, /video game/i, /ra/,
    ];

    // Redirect URL (YouTube homepage)
    const redirectUrl = "https://www.youtube.com/";

    // Array of selectors to hide elements
    const selectors = [
        "ytd-rich-item-renderer", // Use the container for videos
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
        "#contents > yt-lockup-view-model > div > div > yt-lockup-metadata-view-model > div.yt-lockup-metadata-view-model-wiz__text-container > h3 > a > span"
    ];

    // Function to check the current search query
    function checkSearchQuery() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('search_query') || '';

        if (blockKeywords.some(keyword => keyword.test(query)) && !allowedWords.some(word => word.test(query))) {
            console.log(`Blocked search query: ${query}`); // Log blocked query
            window.location.href = redirectUrl; // Redirect to homepage
        } else {
            console.log(`Allowed search query: ${query}`); // Log allowed query
        }
    }

    // Function to hide elements based on selectors and banned words in their content
    function hideElementsBySelectors() {
        const elements = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)));

        elements.forEach(el => {
            const text = el.textContent?.toLowerCase() || "";
            if (blockKeywords.some(keyword => keyword.test(text))) {
                console.log(`Hiding element containing banned word: ${text}`);
                el.style.display = "none"; // Hide the element
                el.style.visibility = "hidden"; // Ensure no ghosting or rendering artifacts
                const parent = el.closest("ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer");
                if (parent) {
                    parent.style.display = "none"; // Hide the parent container to collapse space
                }
            }
        });
    }

    // Observe URL changes to check for search queries
    function observeUrlChanges() {
        let currentUrl = window.location.href;
        const observer = new MutationObserver(() => {
            if (currentUrl !== window.location.href) {
                currentUrl = window.location.href;
                checkSearchQuery(); // Recheck the search query on URL change
            }
        });

        // Check if document.body exists before calling observe
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            // Retry after a short delay if document.body isn't available
            setTimeout(observeUrlChanges, 100); // Retry after 100ms
        }
    }

    // Initial check for search query
    checkSearchQuery();

    // Start observing URL changes
    observeUrlChanges();

    // Periodically hide elements matching selectors
    setInterval(hideElementsBySelectors, 250);
})();