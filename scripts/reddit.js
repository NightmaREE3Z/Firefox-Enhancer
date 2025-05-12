(function () {
    'use strict';

    // --- CSS PRE-HIDING for posts: use .prehide, not global ---
    const style = document.createElement('style');
    style.textContent = `
        article.prehide {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: none !important;
        }
        article {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: none !important;
        }
        body.reddit-filter-ready article:not(.prehide) {
            visibility: visible !important;
            opacity: 1 !important;
        }
    `;
    document.documentElement.appendChild(style);

    const allowedUrls = [
        "https://www.reddit.com/user/birppis/"
    ];

    const keywordsToHide = [
        "NSFW", "18+", "porn", "sex", "nude", "penetration", "naked", "xxx", "rule34", "r34", "r_34", "rule 34", "ChatGPT", "get hard",
        "deepnude", "nudify", "nudifier", "nudifying", "nudity", "undress", "undressing", "undressifying", "undressify", "getdisciplined",
        "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley", "Cameron", "Hayter", "Britt Baker", "Ripley", "Rhea Ripley", "cum",
        "trans", "transvestite", "queer", "LGBT", "LGBTQ", "Pride", "Jessika Carr", "Carr WWE"," Jessica Carr", "Jessika Karr", "Jessika WWE",
        "prostitute", "escort", "fetish", "adult", "erotic", "explicit", "mature", "blowjob", "anal", "sexual", "Jessica WWE", "Jessica Karr",
        "vagina", "pussy", "tushy", "tushi", "genital", "vagena", "butt", "booty", "derriere", "busty", "cum", "slut", "Karr WWE", "CJ Lana", "dick", 
        "whore", "camgirl", "celeb", "cumslut", "Tiffany Stratton", "Lillian", "Garcia", "Jordynne", "Trish", "Stratus", "Lana Del Rey", "cock",
        "DeepSeek", "DeepSeek AI", "nudyi", "ai app", "onlyfans", "fantime", "fansly", "justforfans", "patreon", "CJ Perry", "Lana Perry", "penis",
        "manyvids", "chaturbate", "myfreecams", "cam4", "fat fetish", "camsoda", "stripchat", "bongacams", "livejasmin", "Lana WWE", "anus", "rape",
        "WWE woman", "WWE women", "WWE Xoxo", "Liv Xoxo", "Xoxo", "Chelsey", "Chelsea", "Niven", "Hardwell", "Indi", "Del Rey", "Del Ray", "sex", "breast",
        "amateur", "alexa", "bliss", "alexa bliss", "her ass", "she ass", "her's ass", "hers ass", "Alexa WWE", "5 feet of fury", "Morgan Xoxo", "raped",
        "Tiffany Stratton", "Tiffy time", "Stratton", "Tiffany", "Mandy Rose", "Chelsea Green", "Zelina Vega", "Valhalla", "poses", "posing", "vagene",
        "IYO SKY", "Io Shirai", "Iyo Shirai", "IO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Meiko Satomura", "playboy", "Dynamite", "jizz",
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Emma", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge", "jizzed",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina WWE", "Melina wrestler", "Jillian Hall", "five feet of fury", "Rampage", "raepd",
        "Mickie James", "Maria", "Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess", "Rampaige", "breasts",
        "Madison Rayne", "Velvet Sky", "Angelina Love", "ODB", "Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX", "Sweeney", "Brooke", "No nut",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", "Opera Browser", "nofap",
        "Willow Nightingale", "Kris Statlander", "Hikaru Shida", "Riho", "Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", "Fatal Influence", "Aubert",
        "Penelope Ford", "Shotzi", "Blackheart", "Tegan", "Nox", "Charlotte", "Charlotte Flair", "Sarray", "Xia Li", "OperaGX", "Sky Wrestling", "steph",
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Alicia", "Atout", "stephanie",
        "Stephanie", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Renee",
        "Sunny", "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Izzi Dame", "Alba Fyre", "Isla Dawn", "Tamina", "Sydney",
        "Raquel Rodriguez", "B-Fab", "Scarlett Bordeaux", "Kayden Carter", "Katana Chance", "Lyra Valkyria", "Tamina Snuka", "Renee Young", "Sydney Sweeney",
        "Roxanne Perez", "Indi Hartwell", "Hartwell", "Blair Davenport", "Lola Vice", "Maxxine Dupri", "Karmen Petrovic", "Brittany", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum", "Paxley", "Fallon Henley", "Sky wrestle", "Women’s", "Girl", "Women",
        "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa Leon", "Valentina Feroz", "Amari Miller", "Sky WWE", "Woman", "Lady", "Girls", "Girl's",
        "Sol Ruca", "Arianna Grace", "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW", "Woman’s", "Lady's", "Girl's", "Mandy",
        "Mercedes", "Sasha", "Banks", "Russo", "Vince Russo", "Dave Meltzer", "Sportskeeda", "Liv Xoxo", "Roxanne", "Kristen Stewart", "Vladimir", "Putin",
        "jerking", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "Join now",
    ];
    const redgifsKeyword = "www.redgifs.com";

    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro"
    ];

    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i, /virtual touchup/i,
        /morph/i, /inpaint/i, /art intel/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /\bbra\b/i, /\bass\b/i, /soulgen/i, /ismartta/i, /editor/i, /image enhanced/i, /image enhancing/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /Blis/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhanced image/i, /kuvankäsittely/i,
        /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i, /fingering/i, 
        /vegi/i, /vege/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /izzi dame/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i, /Trish/i,
        /Tiffa/i, /Strat/i, /puz/i, /Sweee/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /\bSlut\b/i, /3dit/i, /ed1t/i, /playboy/i, /poses/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bAMX\b/i, /posing/i,
        /Sydney Sweeney/i, /Sweeney/i, /fap/i, /Sydnee/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bedit\b/i, /Feikki/i, /syväväärennös/i,
        /\bAnal-\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i, /\bHer\b/i, /\bShe\b/i, /\bADMX\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /\bAi-\b/i, /syvä väärennös/i, /5yvä/i,
        /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /Chel5/i, /\bTay\b/i, /\balexa wwe\b/i, /\bazz\b/i, /\bjaida\b/i, /Steph/i, /St3ph/i, /editation/i, /3d!7/i, /3d!t/i, /ed!t/i,
        /P4IG3/i, /Paig3/i, /P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /CJ Perry/i, /Lana WWE/i, /Lana Del Rey/i, /\bLana\b/i, /CJ WWE/i, /image app/i, /edi7/i, /3d17/i, /ed!7/i,
        /Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /picture app/i, /edit app/i, /pic app/i, /photo app/i, /syvavaarennos/i, /Perry WWE/i,
        /pillu/i, /perse/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /\bPeba\b/i, /\bBeba\b/i, /\bBabe\b/i, /\bBepa\b/i, /\bAnaali\b/i, /\bAnus\b/i, /sexuaali/i, /\bAnal\b/i, /\bSeksi\b/i, /yhdyntä/i, /play boy/i,
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i, /sexual/i, /seksuaali/i,
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /seksi kuvia/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i, /seksuaalisuus/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synthetic model/i, /uncover/i,
        /Margot/i, /Robbie/i, /Johansson/i, /Ana de Armas/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i, /läpinäkyvä/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /enhanced image/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /alaston/i, /erotiikka/i,
        /vaatepoisto/i, /poista vaatteet/i, /vaatteiden poisto/i, /tekoäly/i, /panee/i, /panevat/i, /paneminen/i, /panemis/i, /paneskelu/i, /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimista/i, /exclusive leak/i,
        /Stratusfaction/i, /yhdynnässä/i, /seksikuva/i, /seksi kuvia/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i, /panokuva/i, /pano kuva/i, /pano kuvia/i, /panokuvia/i, /banned app/i,
        /\bFAP\b/i, /fapping/i, /wanking/i, /masturbating/i, /masturbation/i, /masturboida/i, /masturbaatio/i, /masturboin/i, /runkata/i, /runkkaus/i, /runkkaaminen/i, /runkku/i, /masturbointi/i, /jerking/i,        
    ];

    const unifiedSelectors = [
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex > .items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap.text-neutral-content > span",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap.text-neutral-content",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible",
        ".\\32 xs.gap.items-center.flex",
        ".mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        ".row-end-2.row-start-1.col-end-3.col-start-1 > .mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
    ];

    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel",
    ];

    const isUrlAllowed = () => {
        const currentUrl = window.location.href;
        return allowedUrls.some(url => currentUrl.startsWith(url));
    };

    const removeElementAndRelated = (element) => {
        element.remove();
    };

    const checkContentForSubreddits = (content) => {
        const contentText = content.innerText.toLowerCase();
        const contentHtml = content.innerHTML.toLowerCase();

        return adultSubreddits.some(subreddit =>
            contentText.includes(subreddit.toLowerCase()) || contentHtml.includes(subreddit.toLowerCase())
        );
    };

    // Filter out articles/posts in the feed containing "Join now" button
    const hideJoinNowPosts = () => {
        const posts = document.querySelectorAll('article');
        posts.forEach(post => {
            // Only consider "Join now" buttons (not generic "Join" buttons)
            let joinNowFound = false;
            // Look for "Join now" visible button/text in this post
            // This is the selector you posted, but let's look for the text as well to be robust
            const joinNowSelectors = [
                '#t3_1kklihk > div.flex.gap-2xs.items-center.justify-between.min-h-\\[32px\\].mt-xs',
                'button', // check all buttons as a fallback
            ];

            joinNowSelectors.forEach(selector => {
                const elements = post.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el.innerText && el.innerText.trim().toLowerCase() === 'join now') {
                        joinNowFound = true;
                    }
                });
            });
            // Also check for any button/link with exact text "Join now"
            const btns = post.querySelectorAll('button, a');
            btns.forEach(el => {
                if (el.innerText && el.innerText.trim().toLowerCase() === 'join now') {
                    joinNowFound = true;
                }
            });

            if (joinNowFound) {
                removeElementAndRelated(post);
            }
        });
    };

    const hideSubredditPosts = () => {
        const posts = document.querySelectorAll('article');
        posts.forEach(post => {
            let containsSubredditToHide = false;

            const selectorsToCheck = [
                'a[data-click-id="subreddit"]',
                '.subreddit',
                ...unifiedSelectors
            ];

            selectorsToCheck.forEach(selector => {
                const elements = post.querySelectorAll(selector);
                elements.forEach(element => {
                    if (checkContentForSubreddits(element)) {
                        containsSubredditToHide = true;
                    }
                });
            });

            if (containsSubredditToHide) {
                removeElementAndRelated(post);
            }
        });
    };

    const checkContentForKeywords = (content) => {
        const contentText = content.innerText.toLowerCase();
        const contentHtml = content.innerHTML.toLowerCase();

        // Check for exact keyword matches
        const exactMatch = keywordsToHide.some(keyword =>
            contentText.includes(keyword.toLowerCase()) || contentHtml.includes(keyword.toLowerCase())
        );

        if (exactMatch) return true;

        // Check for regex pattern matches
        return regexKeywordsToHide.some(pattern =>
            pattern.test(contentText) || pattern.test(contentHtml)
        );
    };

    const hideKeywordPosts = () => {
        const posts = document.querySelectorAll('article');
        posts.forEach(post => {
            let containsKeywordToHide = false;

            const selectorsToCheck = [
                'a[data-click-id="body"]',
                '.inset-0.absolute'
            ];

            selectorsToCheck.forEach(selector => {
                const elements = post.querySelectorAll(selector);
                elements.forEach(element => {
                    if (checkContentForKeywords(element)) {
                        containsKeywordToHide = true;
                    }
                });
            });

            if (containsKeywordToHide) {
                removeElementAndRelated(post);
            } else {
                post.classList.remove('prehide');
            }
        });

        checkForAdultContentTag();
    };

    const checkForAdultContentTag = () => {
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    };

    const interceptSearchInputChanges = () => {
        const searchInput = document.querySelector('input[name="q"]');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase();

                // Check for exact keyword matches
                const exactMatch = keywordsToHide.some(keyword =>
                    query.includes(keyword.toLowerCase())
                );

                // Check for regex pattern matches
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(query)
                );

                if ((exactMatch || regexMatch) || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    window.location.replace('https://www.reddit.com');
                }
            });
        }
    };

    const interceptSearchFormSubmit = () => {
        const searchForm = document.querySelector('form[action="/search"]');

        if (searchForm) {
            searchForm.addEventListener('submit', (event) => {
                const searchParams = new URLSearchParams(new FormData(searchForm));
                const query = (searchParams.get('q') || '').toLowerCase();

                // Check for exact keyword matches
                const exactMatch = keywordsToHide.some(keyword =>
                    query.includes(keyword.toLowerCase())
                );

                // Check for regex pattern matches
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(query)
                );

                if ((exactMatch || regexMatch) || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    event.preventDefault();
                    window.location.replace('https://www.reddit.com');
                }
            });
        }
    };

    const checkUrlForKeywordsToHide = () => {
        const currentUrl = window.location.href.toLowerCase();

        // Check for exact keyword matches
        const exactMatch = keywordsToHide.some(keyword =>
            currentUrl.includes(keyword.toLowerCase())
        );

        // Check for regex pattern matches
        const regexMatch = regexKeywordsToHide.some(pattern =>
            pattern.test(currentUrl)
        );

        if ((exactMatch || regexMatch) && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    };

    const clearRecentPages = () => {
        const recentPagesStore = localStorage.getItem('recent-subreddits-store');
        if (recentPagesStore) {
            const recentPages = JSON.parse(recentPagesStore);
            const filteredPages = recentPages.filter(page => {
                if (typeof page !== 'string') return true;

                // Check for exact keyword matches
                const exactMatch = keywordsToHide.some(keyword =>
                    page.toLowerCase().includes(keyword.toLowerCase())
                );

                // Check for regex pattern matches
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(page.toLowerCase())
                );

                // Check for adult subreddits
                const subredditMatch = adultSubreddits.some(subreddit =>
                    page.toLowerCase().includes(subreddit.toLowerCase())
                );

                return !exactMatch && !regexMatch && !subredditMatch;
            });

            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
        }
    };

    const runAllChecks = () => {
        try {
            if (!isUrlAllowed()) {
                // Pre-hide all posts before filtering, for flicker-free experience
                document.body.classList.remove('reddit-filter-ready');
                document.querySelectorAll('article').forEach(post => post.classList.add('prehide'));

                hideJoinNowPosts(); // Hide posts with "Join now" in the feed!
                hideSubredditPosts();
                hideKeywordPosts();
                checkForAdultContentTag();
                checkUrlForKeywordsToHide();
                clearRecentPages();

                // Now show only allowed posts
                document.body.classList.add('reddit-filter-ready');
            } else {
                // Unhide all articles just in case (for allowed pages)
                document.body.classList.add('reddit-filter-ready');
                document.querySelectorAll('article.prehide').forEach(post => post.classList.remove('prehide'));
            }
        } catch (error) {
            // Ignore, but log for dev
            // console.error('Error running all checks:', error);
        }
    };

    const checkAndHideNSFWClassElements = () => {
        const nsfwClasses = ['NSFW', 'nsfw-tag', 'nsfw-content'];
        nsfwClasses.forEach(className => {
            const elements = document.querySelectorAll(`.${className}`);
            elements.forEach(element => {
                removeElementAndRelated(element);
            });
        });
    };

    const removeHrElements = () => {
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        hrElements.forEach((element) => {
            element.remove();
        });
    };

    const removeSelectorsToDelete = () => {
        selectorsToDelete.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                removeElementAndRelated(element);
            });
        });
    };

    const init = () => {
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        runAllChecks();

        removeHrElements();
        removeSelectorsToDelete();

        const observer = new MutationObserver(runAllChecks);

        const mainContent = document.querySelector('body');
        if (mainContent) {
            observer.observe(mainContent, {
                childList: true,
                subtree: true
            });
        }

        setInterval(() => {
            runAllChecks();
            checkAndHideNSFWClassElements();
            removeHrElements();
            removeSelectorsToDelete();
        }, 20);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    const hrElements = node.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
                    hrElements.forEach(element => {
                        element.remove();
                    });
                    selectorsToDelete.forEach(selector => {
                        const elements = node.querySelectorAll(selector);
                        elements.forEach(element => {
                            removeElementAndRelated(element);
                        });
                    });
                }
            });
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

})();