(function () {
    'use strict';

    // --- IMMEDIATE PRE-HIDING CSS (Applied before any content loads) ---
    function addPreHidingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Hide ALL posts/comments immediately until approved */
            article:not(.reddit-approved),
            .Comment:not(.reddit-approved),
            shreddit-post:not(.reddit-approved),
            [subreddit-prefixed-name]:not(.reddit-approved) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Show only approved content */
            article.reddit-approved,
            .Comment.reddit-approved,
            shreddit-post.reddit-approved,
            [subreddit-prefixed-name].reddit-approved {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            /* Hide search dropdown items until filtered */
            li[role="presentation"]:not(.reddit-search-approved),
            div[role="presentation"]:not(.reddit-search-approved),
            li[data-testid="search-sdui-query-autocomplete"]:not(.reddit-search-approved),
            li.recent-search-item:not(.reddit-search-approved),
            a[role="option"]:not(.reddit-search-approved),
            div[data-testid="search-dropdown-item"]:not(.reddit-search-approved) {
                display: none !important;
                visibility: hidden !important;
            }
            
            /* Hide community suggestions permanently */
            reddit-recent-pages,
            shreddit-recent-communities,
            div[data-testid="community-list"],
            [data-testid="recent-communities"],
            .recent-communities,
            community-highlight-carousel {
                display: none !important;
            }
            
            /* Hide Answers BETA button - Using improved selectors */
            span.text-global-admin.font-semibold.text-12,
            a[href="/answers/"],
            a.flex.justify-between.relative.px-md[href="/answers/"],
            a[href="/answers/"][class*="gap-[0.5rem]"],
            a.gap-\\[0\\.5rem\\][href="/answers/"],
            faceplate-tracker[noun="gen_guides_sidebar"],
            faceplate-tracker[source="nav"][action="click"][noun="gen_guides_sidebar"],
            svg[icon-name="answers-outline"],
            svg[rpl][icon-name="answers-outline"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
            }
            
            /* Hide by class for Answers button */
            .reddit-answers-hidden {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
            }
            
            /* Banned content - permanent hiding */
            .reddit-banned {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* Specific prehiding classes for banned content */
            article.prehide, .Comment.prehide, shreddit-post.prehide, [subreddit-prefixed-name].prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                pointer-events: none !important;
            }
            
            /* Search dropdown hiding */
            .reddit-search-item-prehide, .reddit-search-shadow-prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Hide potentially NSFW thumbnails until approved */
            article:not(.reddit-approved) img, 
            .Comment:not(.reddit-approved) img, 
            shreddit-post:not(.reddit-approved) img,
            [subreddit-prefixed-name]:not(.reddit-approved) img {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            article.reddit-approved img, 
            .Comment.reddit-approved img, 
            shreddit-post.reddit-approved img,
            [subreddit-prefixed-name].reddit-approved img {
                visibility: visible !important;
                opacity: 1 !important;
            }
        `;
        
        // Inject style at the earliest possible moment
        try {
            // Create and inject before DOM is ready for fastest application
            const head = document.head || document.documentElement;
            head.insertBefore(style, head.firstChild);
        } catch (e) {
            // Fallback: wait for document ready and try again
            document.addEventListener('DOMContentLoaded', function() {
                (document.head || document.documentElement).appendChild(style);
            });
        }
    }

    // Apply CSS immediately before any other code runs
    addPreHidingCSS();

    // --- CSS PRE-HIDING for posts ---
    const style = document.createElement('style');
    style.textContent = `
        article.prehide, .Comment.prehide, shreddit-post.prehide {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: none !important;
        }
        body.reddit-filter-ready article:not(.prehide),
        body.reddit-filter-ready .Comment:not(.prehide),
        body.reddit-filter-ready shreddit-post:not(.prehide) {
            visibility: visible !important;
            opacity: 1 !important;
        }
        reddit-recent-pages,
        shreddit-recent-communities,
        div[data-testid="community-list"],
        [data-testid="recent-communities"],
        .recent-communities {
            display: none !important;
        }
    `;
    document.documentElement.appendChild(style);

    // --- ANSWERS PAGE REDIRECT ---
    function checkAndRedirectFromAnswers() {
        if (window.location.href.includes('reddit.com/answers')) {
            window.location.href = 'https://www.reddit.com/';
        }
    }

    checkAndRedirectFromAnswers();

    // --- PREFERENCES REDIRECT ---
    function checkAndRedirectFromPreferences() {
        if (window.location.href.includes('reddit.com/settings/preferences')) {
            window.location.href = 'https://www.reddit.com/settings/';
        }
    }

    checkAndRedirectFromPreferences();

    // Immediate redirect check
    checkAndRedirectFromAnswers();

    const allowedUrls = [
        "https://www.reddit.com/user/birppis/"
    ];

    const safeSubreddits = [
        "r/AmItheAsshole",
        "r/AmItheButtface",
        "r/AskReddit",
        "r/DimensionJumping",
        "r/BestofRedditorUpdates",
        "r/Glitch_in_the_Matrix"
    ];

    const keywordsToHide = [
        "NSFW", "18+", "porn", "nude", "Alexa", "penetration", "naked", "xxx", "rule34", "r34", "r_34", "rule 34", "ChatGPT", "get hard",
        "deepnude", "nudify", "nudifier", "nudifying", "nudity", "undress", "undressing", "undressifying", "undressify", "getdisciplined", "Mariah",
        "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley", "Cameron", "Hayter", "Britt Baker", "Ripley", "Rhea Ripley", "cum", "Mariah May",
        "trans", "transvestite", "queer", "LGBT", "LGBTQ", "Pride", "Jessika Carr", "Carr WWE"," Jessica Carr", "Jessika Karr", "Jessika WWE", "sexy",
        "prostitute", "escort", "fetish", "adult", "erotic", "explicit", "mature", "blowjob", "sexual", "Jessica WWE", "Jessica Karr", "Analsex",
        "vagina", "pussy", "tushy", "tushi", "genital", "vagena", "butt", "booty", "derriere", "busty", "cum", "slut", "Karr WWE", "CJ Lana", "dick", 
        "whore", "camgirl", "celeb", "cumslut", "Tiffany Stratton", "Lillian", "Garcia", "Jordynne", "Trish", "Stratus", "Lana Del Rey", "cock", "raped",
        "DeepSeek", "DeepSeek AI", "nudyi", "ai app", "onlyfans", "fantime", "fansly", "justforfans", "patreon", "CJ Perry", "Lana Perry", "penis",
        "manyvids", "chaturbate", "myfreecams", "cam4", "fat fetish", "camsoda", "stripchat", "bongacams", "livejasmin", "Lana WWE", "anus", "rape",
        "WWE woman", "WWE women", "WWE Xoxo", "Liv Xoxo", "Xoxo", "Chelsey", "Chelsea", "Niven", "Hardwell", "Indi", "Del Rey", "Del Ray", "breast",
        "amateur", "alexa", "bliss", "alexa bliss", "her ass", "she ass", "her's ass", "hers ass", "venice", "Alexa WWE", "5 feet of fury", "Morgan Xoxo",
        "Tiffany Stratton", "Tiffy time", "Stratton", "Tiffany", "Mandy Rose", "Chelsea Green", "Zelina", "Zelina Vega", "Valhalla", "poses", "posing", "vagene",
        "IYO SKY", "Io Shirai", "Iyo Shirai", "IO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Meiko", "Satomura", "playboy", "Dynamite", "jizz",
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Emma", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge", "jizzed", "Torrie",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina WWE", "Melina wrestler", "Jillian Hall", "five feet of fury", "Rampage", "raepd", "Wilson",
        "Mickie James", "Maria", "Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess", "Rampaige", "breasts",
        "Madison Rayne", "Velvet Sky", "Angelina", "ODB", "filmora", "wondershare", "Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX", "Sweeney", "Mickie",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Vaquer", "Vaqueer", "Vaguer", "Vagueer", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", 
        "Nightingale", "Statlander", "Hikaru Shida", "Riho", "Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", "Fatal Influence", "Aubert", "*ape", "Brooke", "Hikaru",
        "Penelope", "Shotzi", "Blackheart", "Tegan", "Nox", "Charlotte", "Charlotte", "Sarray", "Xia Li", "OperaGX", "Sky Wrestling", "steph", "r*pe", "Opera Browser", 
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Alicia", "Atout", "stephanie", "ra*e", "nofap", "No nut",
        "Stephanie", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Renee", "rap*", "Answers BETA",
        "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Izzi Dame", "Alba Fyre", "Isla Dawn", "Tamina", "Sydney", "Gina Adams", "Kelly2",
        "Raquel Rodriguez", "B-Fab", "Scarlett", "Bordeaux", "Kayden", "Carter", "Katana Chance", "Valkyria", "Tamina Snuka", "Renee Young", "Sydney Sweeney", "Priscilla",
        "Roxanne Perez", "Indi Hartwell", "Hartwell", "Blair", "Davenport", "wonder share", "Lola Vice", "Maxxine Dupri", "Karmen", "Karmen Petrovic", "Brittany", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum", "Paxley", "Fallon Henley", "Sky wrestle", "Women's", "Girl", "Women", "venoisi",  "rawdog", "rawdogging", 
        "Kelani Jordan", "Electra", "Wendy Choo", "Yulisa", "Valentina", "Valentine", "Amari Miller", "Sky WWE", "Woman", "Lady", "Girls", "Girl's", "venoise", "AlexaBliss", "AlexaPearl",
        "Sol Ruca", "Arianna" "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW", "Woman's", "Lady's", "Girl's", "Mandy", "org@$m", "0rga$m", "orga$m",
        "Mercedes", "Sasha", "Banks", "Russo", "Vince Russo", "Dave Meltzer", "Sportskeeda", "Liv Xoxo", "Roxanne", "orgasm", "0rgasm", "org@sm", "orga5m", "org@5m", "org@sm", "orga5m", "0rg@sm", "0rga5m"
    ];

    const redgifsKeyword = "www.redgifs.com";

    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro", "r/AlexaBliss", "r/AlexaPearl"
    ];

    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i,
        /morph/i, /inpaint/i, /art intel/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /\bbra\b/i, /soulgen/i, /ismartta/i, /editor/i, /image enhanced/i, /image enhancing/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /Blis/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhanced image/i,
        /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i,
        /vegi/i, /vege/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /izzi dame/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Perry/i,
        /Tiffa/i, /Strat/i, /puz/i, /Sweee/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /\bSlut\b/i, /3dit/i, /ed1t/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bApp\b/i,
        /Sydney Sweeney/i, /Sweeney/i, /fap/i, /Sydnee/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bedit\b/i, /Feikki/i,
        /\bAnall\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i, /\bHer\b/i, /\bShe\b/i, /\bADMX\b/i, /\bAss\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /\bAi-\b/i,
        /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /Chel5/i, /\bTay\b/i, /\balexa wwe\b/i, /\bazz\b/i, /\bjaida\b/i, /Steph/i, /St3ph/i, /editation/i, /3d!7/i,
        /P4IG3/i, /Paig3/i, /P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /Lana WWE/i, /Lana Del Rey/i, /\bLana\b/i, /CJ WWE/i, /image app/i, /edi7/i, /syvavaarennos/i,
        /Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /picture app/i, /edit app/i, /pic app/i, /photo app/i, /syvävääre/i,
        /pillu/i, /perse/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /\bPeba\b/i, /\bBeba\b/i, /\bBabe\b/i, /\bBepa\b/i, /\bAnaali\b/i, /\bAnus\b/i, /sexuaali/i, /\bSeksi\b/i, /yhdyntä/i, /\bGina\b/i,
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i, /seksi/i,
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /seksi kuvia/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synthetic/i,
        /Margot/i, /Robbie/i, /Johansson/i, /Ana de Armas/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor Swift/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /panee/i, /paneva/i,
        /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimis/i, /Stratusfaction/i, /yhdynnässä/i, /seksivideo/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i,
        /pano kuva/i, /panokuvat/i, /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpitä/i,
        /sormetus/i, /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkkyvi/i,
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuissivusto/i, /homo/i, /lesbo/i, /transu/i, /pervo/i, /5yvä/i, /\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /face plus/i,  /face\+/i, /face+/i, /face_plus/i,
        /bg remover/i, /\bMina\b/i, /Shir/i, /kawa/i, /perver/i, /Mariah/i, /\bAva\b/i, /\bAnal-\b/i, /\b-Anal\b/i, /\bAnal\b/i
    ];

    const unifiedSelectors = [
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.shrink-0 > .ml-2xs.text-12.font-semibold.text-neutral-content-strong",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.shrink-0",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.shrink-0 > .ml-2xs.text-12.font-semibold.text-neutral-content-strong",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.shrink-0",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap.text-12.font-semibold.text-neutral-content-strong",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader",
        ".\\32 xs.gap.items-center.flex",
        ".mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        ".row-end-2.row-start-1.col-end-3.col-start-1 > .mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        'span.text-global-admin.font-semibold.text-12'
    ];

    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel"
    ];

    // Specific selectors for Answers button based on your HTML
    const answersButtonSelectors = [
        'a[href="/answers/"]',
        'a.flex.justify-between.relative.px-md[href="/answers/"]',
        'faceplate-tracker[noun="gen_guides_sidebar"]',
        'faceplate-tracker[source="nav"][action="click"][noun="gen_guides_sidebar"]',
        'svg[icon-name="answers-outline"]',
        'svg[rpl][icon-name="answers-outline"]',
        'span.text-global-admin.font-semibold.text-12',
    ];

    // Reddit Answers page selectors to monitor text content only
    const redditAnswersSelectors = [
        "#response-heading",
        "label",
        "label > div > span",
        "label > div > span > span.input-container.activated > span",
        "label > div > span > span.input-container.activated > div",
        "#innerTextArea",
        "label > div > span > span.input-container.activated",
        "label > div",
    ];

    // --- PERFORMANCE OPTIMIZATIONS ---
    // Caches for better performance
    const processedElements = new WeakSet();
    const processedSearchItems = new WeakSet();
    const bannedSubredditCache = new Map();
    const contentBannedCache = new Map();
    const shadowRootsProcessed = new WeakSet();
    const permanentlyApprovedElements = new WeakSet(); // NEW: Track permanently approved elements
    let lastFilterTime = 0;
    let pendingOperations = false;

    // Check if we're on Reddit Answers page
    function isRedditAnswersPage() {
        return window.location.href.includes('reddit.com/answers');
    }

    // --- ANSWERS BUTTON HIDING FUNCTIONS ---
    function hideAnswersButton() {
        // Method 1: Hide by href="/answers/" (most specific)
        const answersLinks = document.querySelectorAll('a[href="/answers/"]');
        for (let i = 0; i < answersLinks.length; i++) {
            answersLinks[i].remove();
        }

        // Method 2: Hide by full class + href combination
        const specificAnswersLinks = document.querySelectorAll('a.flex.justify-between.relative.px-md[href="/answers/"]');
        for (let i = 0; i < specificAnswersLinks.length; i++) {
            specificAnswersLinks[i].remove();
        }

        // Method 3: Hide using your original selectors
        for (let i = 0; i < answersButtonSelectors.length; i++) {
            const elements = document.querySelectorAll(answersButtonSelectors[i]);
            for (let j = 0; j < elements.length; j++) {
                elements[j].remove();
            }
        }

        // Method 4: Hide by answers icon and traverse up
        const answersIcons = document.querySelectorAll('svg[icon-name="answers-outline"], svg[rpl][icon-name="answers-outline"]');
        for (let i = 0; i < answersIcons.length; i++) {
            const icon = answersIcons[i];
            // Traverse up to find the link
            const linkElement = icon.closest('a[href="/answers/"]');
            if (linkElement) {
                linkElement.remove();
                continue;
            }
            
            // Fallback: traverse up to other containers
            const containers = [
                icon.closest('faceplate-tracker[noun="gen_guides_sidebar"]'),
                icon.closest('faceplate-tracker'),
                icon.closest('li[role="presentation"]'),
                icon.closest('a'),
                icon.closest('div'),
                icon.closest('section'),
                icon.closest('nav')
            ];
            
            for (let k = 0; k < containers.length; k++) {
                const container = containers[k];
                if (container) {
                    container.remove();
                    break;
                }
            }
        }

        // Method 5: Hide elements containing "Answers" and "BETA" text
        const allElements = document.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i];
            
            // Skip if already processed or if it's a large container
            if (element.hasAttribute('data-answers-processed') || 
                element.textContent.length > 200) continue;
            
            const textContent = element.textContent || '';
            
            if (textContent.includes('Answers') && textContent.includes('BETA')) {
                element.setAttribute('data-answers-processed', 'true');
                
                // Check if this element is inside a link to /answers/
                const parentLink = element.closest('a[href="/answers/"]');
                if (parentLink) {
                    parentLink.remove();
                    continue;
                }
                
                // Find the root navigation container
                const rootContainer = element.closest('faceplate-tracker, li[role="presentation"], nav, section, div[class*="nav"]');
                if (rootContainer) {
                    rootContainer.remove();
                } else {
                    element.remove();
                }
            }
        }

        // Method 6: Hide BETA spans specifically
        const betaSpans = document.querySelectorAll('span.text-global-admin.font-semibold.text-12');
        for (let i = 0; i < betaSpans.length; i++) {
            const span = betaSpans[i];
            if (span.textContent.trim() === 'BETA') {
                // Check if this BETA span is inside an answers link
                const parentLink = span.closest('a[href="/answers/"]');
                if (parentLink) {
                    parentLink.remove();
                    continue;
                }
                
                const rootContainer = span.closest('faceplate-tracker, li[role="presentation"], div, section, nav');
                if (rootContainer) {
                    rootContainer.remove();
                } else {
                    span.remove();
                }
            }
        }

        // Method 7: Target the exact gap class structure
        const gapElements = document.querySelectorAll('a.gap-\\[0\\.5rem\\][href="/answers/"]');
        for (let i = 0; i < gapElements.length; i++) {
            gapElements[i].remove();
        }
    }

    // Improved throttle with idle callback for smoother performance
    function throttle(fn, wait) {
        let lastCall = 0;
        let requestId = null;
        
        return function(...args) {
            const now = performance.now();
            const context = this;
            
            if (now - lastCall >= wait) {
                lastCall = now;
                fn.apply(context, args);
            } else if (!requestId) {
                // Use requestIdleCallback for better performance if available
                requestId = (window.requestIdleCallback || window.requestAnimationFrame)(() => {
                    requestId = null;
                    lastCall = performance.now();
                    fn.apply(context, args);
                });
            }
        };
    }

    // Improved debounce function
    function debounce(fn, wait, immediate = false) {
        let timeout;
        return function(...args) {
            const context = this;
            const callNow = immediate && !timeout;
            
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                timeout = null;
                if (!immediate) fn.apply(context, args);
            }, wait);
            
            if (callNow) fn.apply(context, args);
        };
    }

    // Batch DOM operations for smoother performance
    function batchProcess(fn) {
        if (pendingOperations) return;
        pendingOperations = true;
        
        // Use requestAnimationFrame for better performance with visual updates
        requestAnimationFrame(() => {
            fn();
            pendingOperations = false;
        });
    }

    // --- REDDIT ANSWERS PAGE FILTERING ---
    function checkRedditAnswersTextContent() {
        // Only run on Reddit Answers pages
        if (!isRedditAnswersPage()) return;
        
        // Check text content within monitored selectors without breaking functionality
        for (let i = 0; i < redditAnswersSelectors.length; i++) {
            const elements = document.querySelectorAll(redditAnswersSelectors[i]);
            
            for (let j = 0; j < elements.length; j++) {
                const element = elements[j];
                if (!element || processedElements.has(element)) continue;
                
                // Check only text content, not the element structure
                const textContent = element.textContent || element.innerText || '';
                if (textContent && checkTextForKeywords(textContent)) {
                    console.log('Banned text content found in Reddit Answers, redirecting to answers page');
                    window.location.href = 'https://www.reddit.com/answers';
                    return;
                }
                
                processedElements.add(element);
            }
        }
    }

    // Separate function to check only text content
    function checkTextForKeywords(textContent) {
        if (!textContent) return false;
        
        const lowerText = textContent.toLowerCase();
        
        // Check cache first
        if (contentBannedCache.has(lowerText)) {
            return contentBannedCache.get(lowerText);
        }
        
        // Check for exact keyword matches (most efficient)
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerText.includes(keywordsToHide[i].toLowerCase())) {
                contentBannedCache.set(lowerText, true);
                return true;
            }
        }
        
        // Only check regex patterns if needed (more expensive)
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerText)) {
                contentBannedCache.set(lowerText, true);
                return true;
            }
        }
        
        contentBannedCache.set(lowerText, false);
        return false;
    }

    // Process Reddit Answers shadow DOM text content only
    function processAnswersShadowDOMText() {
        if (!isRedditAnswersPage()) return;
        
        // Look for Reddit Answers specific web components
        const answersComponents = document.querySelectorAll('guides-header-panel, guides-response-container-realtime, guides-search-input');
        
        for (let i = 0; i < answersComponents.length; i++) {
            const component = answersComponents[i];
            if (!component.shadowRoot || shadowRootsProcessed.has(component.shadowRoot)) continue;
            
            shadowRootsProcessed.add(component.shadowRoot);
            
            // Check shadow DOM text content only
            const shadowTextContent = component.shadowRoot.textContent || '';
            if (shadowTextContent && checkTextForKeywords(shadowTextContent)) {
                console.log('Banned text content found in Reddit Answers shadow DOM, redirecting to answers page');
                window.location.href = 'https://www.reddit.com/answers';
                return;
            }
            
            // Set up observer for this shadow root
            const shadowObserver = new MutationObserver(throttledAnswersTextHandler);
            shadowObserver.observe(component.shadowRoot, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: true // Important for Reddit Answers as content is streamed
            });
        }
    }

    // Handler for Reddit Answers shadow root mutations - text content only
    const throttledAnswersTextHandler = throttle((mutations) => {
        for (const mutation of mutations) {
            // Check for text content changes (streaming responses)
            if (mutation.type === 'characterData') {
                const textContent = mutation.target.nodeValue || '';
                if (textContent && checkTextForKeywords(textContent)) {
                    console.log('Banned text content found in Reddit Answers text mutation, redirecting to answers page');
                    window.location.href = 'https://www.reddit.com/answers';
                    return;
                }
            }
            
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 3) { // Text node
                        const textContent = node.nodeValue || '';
                        if (textContent && checkTextForKeywords(textContent)) {
                            console.log('Banned text content found in Reddit Answers added text node, redirecting to answers page');
                            window.location.href = 'https://www.reddit.com/answers';
                            return;
                        }
                    } else if (node.nodeType === 1) { // Element node
                        const elementText = node.textContent || '';
                        if (elementText && checkTextForKeywords(elementText)) {
                            console.log('Banned text content found in Reddit Answers added element, redirecting to answers page');
                            window.location.href = 'https://www.reddit.com/answers';
                            return;
                        }
                    }
                }
            }
        }
    }, 50);

    // Throttled version for frequent checks
    const throttledRedditAnswersCheck = throttle(() => {
        checkRedditAnswersTextContent();
        processAnswersShadowDOMText();
    }, 100);

    // --- CORE FILTERING FUNCTIONS ---
    function isSubredditNameBanned(subName) {
        if (!subName) return false;
        const lowerSub = subName.toLowerCase();
        
        // Check cache first
        if (bannedSubredditCache.has(lowerSub)) {
            return bannedSubredditCache.get(lowerSub);
        }
        
        // First check against adult subreddits list (most efficient)
        for (let i = 0; i < adultSubreddits.length; i++) {
            if (lowerSub === adultSubreddits[i].toLowerCase()) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        // Check for exact keyword matches
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerSub.includes(keywordsToHide[i].toLowerCase())) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        // Check regex patterns
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerSub)) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        bannedSubredditCache.set(lowerSub, false);
        return false;
    }

    function checkContentForKeywords(content) {
        if (!content) return false;
        
        const contentText = content.textContent || content.innerText || content.nodeValue || '';
        if (!contentText) return false;
        
        return checkTextForKeywords(contentText);
    }

    function isSafeSubredditUrl() {
        const url = window.location.href.toLowerCase();
        return safeSubreddits.some(sub =>
            url.match(new RegExp(`/r/${sub.replace(/^r\//, '').toLowerCase()}([/?#]|$)`))
        );
    }

    function isUrlAllowed() {
        const currentUrl = window.location.href;
        return allowedUrls.some(url => currentUrl.startsWith(url)) || isSafeSubredditUrl();
    }

    function removeElementAndRelated(element) {
        if (element && element.parentNode) {
            element.remove();
        }
    }

    function getSubredditForAnyRedditPost(el) {
        // Check for attributes first (most efficient)
        const prefixedName = el.getAttribute && el.getAttribute('subreddit-prefixed-name');
        if (prefixedName) return prefixedName.startsWith('r/') ? prefixedName : 'r/' + prefixedName;
        
        const subredditName = el.getAttribute && el.getAttribute('subreddit-name');
        if (subredditName) return 'r/' + subredditName;
        
        const dataSubreddit = el.getAttribute && el.getAttribute('data-subreddit');
        if (dataSubreddit) return dataSubreddit.startsWith('r/') ? dataSubreddit : 'r/' + dataSubreddit;
        
        // Check for subreddit links (less efficient)
        const subredditLink = el.querySelector && el.querySelector('a[data-testid="subreddit-name"]');
        if (subredditLink && subredditLink.textContent) return subredditLink.textContent.trim();
        
        const rLink = el.querySelector && el.querySelector('a[href^="/r/"]');
        if (rLink && rLink.textContent) return rLink.textContent.trim();
        
        // Check all links as last resort
        const links = el.querySelectorAll && el.querySelectorAll('a[href*="/r/"]');
        if (links) {
            for (let i = 0; i < links.length; i++) {
                const href = links[i].getAttribute('href');
                const match = href && href.match(/\/r\/([A-Za-z0-9_]+)/);
                if (match) {
                    return "r/" + match[1];
                }
            }
        }
        
        return null;
    }

    function isElementFromAdultSubreddit(el) {
        const sub = getSubredditForAnyRedditPost(el);
        if (!sub) return false;
        return isSubredditNameBanned(sub);
    }

    // NEW: Comprehensive content evaluation function
    function evaluateElementForBanning(element) {
        // Skip if permanently approved
        if (permanentlyApprovedElements.has(element)) {
            return false;
        }
        
        // Check subreddit first (most reliable)
        if (isElementFromAdultSubreddit(element)) {
            return true;
        }
        
        // Check content for keywords
        if (checkContentForKeywords(element)) {
            return true;
        }
        
        // Check specific areas more thoroughly
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, a[data-click-id="body"], .title, [slot="title"]');
        if (titleElement && checkContentForKeywords(titleElement)) {
            return true;
        }
        
        // Check post content/body
        const contentElement = element.querySelector && element.querySelector('.post-content, .md-container, p, [slot="text-body"], [data-testid="post-content"]');
        if (contentElement && checkContentForKeywords(contentElement)) {
            return true;
        }
        
        // Check for NSFW indicators
        const nsfwIndicators = element.querySelectorAll && element.querySelectorAll('.nsfw, [data-nsfw="true"], svg[icon-name="nsfw-outline"], .text-category-nsfw');
        if (nsfwIndicators && nsfwIndicators.length > 0) {
            return true;
        }
        
        return false;
    }

    // --- MAIN FILTERING FUNCTIONS ---
    function filterAdultSubredditPostsAndComments() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        // Get all post and comment elements, including those in various containers
        const allSelectors = [
            'article:not(.prehide):not(.reddit-approved)',
            'shreddit-post:not(.prehide):not(.reddit-approved)', 
            '[subreddit-prefixed-name]:not(.prehide):not(.reddit-approved)',
            '.Comment:not(.prehide):not(.reddit-approved)',
            'shreddit-comment:not(.prehide):not(.reddit-approved)'
        ];
        
        for (let selectorIndex = 0; selectorIndex < allSelectors.length; selectorIndex++) {
            const elements = document.querySelectorAll(allSelectors[selectorIndex]);
            
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                if (processedElements.has(element)) continue;
                processedElements.add(element);
                
                // Comprehensive evaluation
                if (evaluateElementForBanning(element)) {
                    element.classList.add('prehide', 'reddit-banned');
                    removeElementAndRelated(element);
                } else {
                    element.classList.add('reddit-approved');
                    // Mark as permanently approved to avoid re-checking
                    permanentlyApprovedElements.add(element);
                }
            }
        }
    }

    function checkContentForSubreddits(content) {
        const contentText = content.textContent ? content.textContent.toLowerCase() : '';
        return adultSubreddits.some(subreddit =>
            contentText.includes(subreddit.toLowerCase())
        );
    }

    function hideJoinNowPosts() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        const posts = document.querySelectorAll('article:not(.prehide), shreddit-post:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            
            let joinNowFound = false;
            
            // Check buttons
            const btns = post.querySelectorAll('button, a');
            for (let j = 0; j < btns.length && !joinNowFound; j++) {
                if (btns[j].textContent && btns[j].textContent.trim().toLowerCase() === 'join now') {
                    joinNowFound = true;
                }
            }
            
            if (joinNowFound) {
                post.classList.add('prehide');
                removeElementAndRelated(post);
            }
        }
    }

    function getSubredditFromPost(post) {
        // More efficient version of getSubredditForAnyRedditPost focused on posts
        const sub = post.getAttribute && post.getAttribute('data-subreddit');
        if (sub) return sub.startsWith('r/') ? sub : 'r/' + sub;
        
        const aTags = post.querySelectorAll && post.querySelectorAll('a[href*="/r/"]');
        if (aTags) {
            for (let i = 0; i < aTags.length; i++) {
                const match = aTags[i].getAttribute('href').match(/\/r\/([A-Za-z0-9_]+)/);
                if (match) return 'r/' + match[1];
            }
        }
        
        return null;
    }

    function hideSubredditPosts() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        const posts = document.querySelectorAll('article:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            
            const subName = getSubredditFromPost(post);
            if (subName && isSubredditNameBanned(subName)) {
                post.classList.add('prehide');
                removeElementAndRelated(post);
            }
        }
    }

    function hideKeywordPosts() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        // More efficient implementation that checks fewer elements and uses caching
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            // Use comprehensive evaluation
            if (evaluateElementForBanning(post)) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                post.classList.add('reddit-approved');
                permanentlyApprovedElements.add(post);
            }
        }
    }

    function filterPostsByContent() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        // More targeted approach with reduced DOM operations
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved), shreddit-post:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            // Use comprehensive evaluation
            if (evaluateElementForBanning(post)) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                post.classList.add('reddit-approved');
                permanentlyApprovedElements.add(post);
            }
        }
    }

    function checkForAdultContentTag() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    // --- SEARCH FILTERING FUNCTIONS ---
    function hideBannedSubredditsFromSearch() {
        // Process all search dropdown items
        const allSearchItems = [
            ...Array.from(document.querySelectorAll('[data-type="search-dropdown-item-label-text"]')),
            ...Array.from(document.querySelectorAll('span.font-semibold.text-12.uppercase, span.text-category-nsfw')),
            ...Array.from(document.querySelectorAll('li[data-testid="search-sdui-query-autocomplete"], li.recent-search-item')),
            ...Array.from(document.querySelectorAll('li[role="presentation"], a[role="option"], div[data-testid="search-dropdown-item"]'))
        ];
        
        for (let i = 0; i < allSearchItems.length; i++) {
            const item = allSearchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            // Process different types of items
            if (item.classList.contains('text-category-nsfw') || 
                (item.textContent && item.textContent.trim().toUpperCase() === "NSFW")) {
                // NSFW badge - hide parent element
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                }
                continue;
            }
            
            // Check item text for banned content
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const textContent = item.textContent || '';
            const label = ariaLabel + ' ' + textContent;
            
            if (isSubredditNameBanned(label)) {
                // Find nearest parent to hide
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                } else if (item.parentElement) {
                    item.parentElement.style.display = 'none';
                } else {
                    item.style.display = 'none';
                }
            } else {
                // Mark as approved
                item.classList.add('reddit-search-approved');
                let parent = item.closest('li[role="presentation"], li, a, div');
                if (parent) parent.classList.add('reddit-search-approved');
            }
        }
    }

    function processShadowSearchItems(root) {
        if (!root || !root.querySelectorAll) return;
        
        // Process all relevant search items in shadow DOM
        const searchItems = root.querySelectorAll('li[role="presentation"], div[role="presentation"], li, a[role="option"], div[data-testid="search-dropdown-item"]');
        
        for (let i = 0; i < searchItems.length; i++) {
            const item = searchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            // Get item text
            const text = item.textContent || '';
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const fullText = text + ' ' + ariaLabel;
            
            // Check for NSFW badge
            let hasNSFWBadge = false;
            const spans = item.querySelectorAll('span, div');
            for (let j = 0; j < spans.length && !hasNSFWBadge; j++) {
                if (spans[j].textContent && spans[j].textContent.trim().toUpperCase() === 'NSFW') {
                    hasNSFWBadge = true;
                }
            }
            
            // Hide if banned content
            if (isSubredditNameBanned(fullText) || hasNSFWBadge) {
                item.style.display = 'none';
            } else {
                item.classList.add('reddit-search-approved');
            }
        }
    }

    function hideBannedSubredditsFromAllSearchDropdowns() {
        function processShadowRoots(node) {
            if (!node) return;
            
            // Process shadow root if it exists
            if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                shadowRootsProcessed.add(node.shadowRoot);
                processShadowSearchItems(node.shadowRoot);
                
                // Set up observer for this shadow root
                const shadowObserver = new MutationObserver(throttledShadowRootHandler);
                shadowObserver.observe(node.shadowRoot, { 
                    childList: true, 
                    subtree: true,
                    attributes: false,
                    characterData: false
                });
                
                // Process children in shadow root
                const shadowChildren = node.shadowRoot.querySelectorAll('*');
                for (let i = 0; i < shadowChildren.length; i++) {
                    processShadowRoots(shadowChildren[i]);
                }
            }
            
            // Process children
            if (node.children) {
                for (let i = 0; i < node.children.length; i++) {
                    processShadowRoots(node.children[i]);
                }
            }
        }
        
        // First process light DOM
        hideBannedSubredditsFromSearch();
        
        // Then process shadow DOM
        if (document.body) {
            processShadowRoots(document.body);
        }
        
        // Direct processing of search dropdowns
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            processShadowRoots(searchDropdowns[i]);
        }
    }

    // Handler for shadow root mutations
    const throttledShadowRootHandler = throttle((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // Element node
                    processShadowSearchItems(mutation.target);
                    
                    // Process shadow root if it exists
                    if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                        shadowRootsProcessed.add(node.shadowRoot);
                        processShadowSearchItems(node.shadowRoot);
                    }
                }
            }
        }
    }, 100);

    function observeSearchDropdown() {
        // Observe search dropdown container
        const container = document.getElementById('search-dropdown-results-container');
        if (container && !container.__searchObserved) {
            const observer = new MutationObserver(() => {
                batchProcess(() => {
                    hideBannedSubredditsFromSearch();
                    hideBannedSubredditsFromAllSearchDropdowns();
                });
            });
            
            observer.observe(container, { 
                childList: true, 
                subtree: true
            });
            container.__searchObserved = true;
        }
        
        // Observe all search dropdowns directly
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            const dropdown = searchDropdowns[i];
            if (dropdown.__searchObserved) continue;
            dropdown.__searchObserved = true;
            
            // Observe the dropdown itself
            const observer = new MutationObserver(() => {
                batchProcess(() => {
                    if (dropdown.shadowRoot) {
                        processShadowSearchItems(dropdown.shadowRoot);
                    }
                });
            });
            
            observer.observe(dropdown, {
                childList: true,
                subtree: true
            });
        }
    }

    // --- UTILITY FUNCTIONS ---
    function interceptSearchInputChanges() {
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && !searchInput.__filterListener) {
            searchInput.addEventListener('input', debounce(() => {
                const query = searchInput.value.toLowerCase();
                const exactMatch = keywordsToHide.some(keyword =>
                    query.includes(keyword.toLowerCase())
                );
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(query)
                );
                
                if ((exactMatch || regexMatch) || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    if (isRedditAnswersPage()) {
                        window.location.href = 'https://www.reddit.com/answers';
                    } else {
                        window.location.replace('https://www.reddit.com');
                    }
                }
            }, 200));
            searchInput.__filterListener = true;
        }
    }

    function interceptSearchFormSubmit() {
        const searchForm = document.querySelector('form[action="/search"]');
        if (searchForm && !searchForm.__filterListener) {
            searchForm.addEventListener('submit', (event) => {
                const formData = new FormData(searchForm);
                const query = (formData.get('q') || '').toLowerCase();
                const exactMatch = keywordsToHide.some(keyword =>
                    query.includes(keyword.toLowerCase())
                );
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(query)
                );
                
                if ((exactMatch || regexMatch) || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    event.preventDefault();
                    if (isRedditAnswersPage()) {
                        window.location.href = 'https://www.reddit.com/answers';
                    } else {
                        window.location.replace('https://www.reddit.com');
                    }
                }
            });
            searchForm.__filterListener = true;
        }
    }

    function checkUrlForKeywordsToHide() {
        if (isSafeSubredditUrl()) return;
        
        const currentUrl = window.location.href.toLowerCase();
        
        // Check exact keywords first (most efficient)
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (currentUrl.includes(keywordsToHide[i].toLowerCase())) {
                if (!isUrlAllowed()) {
                    if (isRedditAnswersPage()) {
                        window.location.href = 'https://www.reddit.com/answers';
                    } else {
                        window.location.replace('https://www.reddit.com');
                    }
                    return;
                }
            }
        }
        
        // Check regex patterns if needed
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(currentUrl)) {
                if (!isUrlAllowed()) {
                    if (isRedditAnswersPage()) {
                        window.location.href = 'https://www.reddit.com/answers';
                    } else {
                        window.location.replace('https://www.reddit.com');
                    }
                    return;
                }
            }
        }
    }

    function clearRecentPages() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        try {
            const recentPagesStore = localStorage.getItem('recent-subreddits-store');
            if (!recentPagesStore) return;
            
            const recentPages = JSON.parse(recentPagesStore);
            if (!Array.isArray(recentPages)) return;
            
            const filteredPages = recentPages.filter(page => {
                if (typeof page !== 'string') return true;
                return !isSubredditNameBanned(page);
            });
            
            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
        } catch (e) {
            // Handle localStorage errors safely
            console.error("Error clearing recent pages:", e);
        }
    }

    function hideRecentCommunitiesSection() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        const selectors = [
            'reddit-recent-pages', 
            'shreddit-recent-communities',
            'div[data-testid="community-list"]',
            '[data-testid="recent-communities"]',
            '.recent-communities'
        ];
        
        for (let i = 0; i < selectors.length; i++) {
            const elements = document.querySelectorAll(selectors[i]);
            for (let j = 0; j < elements.length; j++) {
                elements[j].style.display = 'none';
            }
        }
        
        // Clear stored communities
        try {
            localStorage.setItem('recent-subreddits-store', '[]');
        } catch (e) {
            // Handle localStorage errors
        }
    }

    function checkAndHideNSFWClassElements() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        const nsfwClasses = ['NSFW', 'nsfw-tag', 'nsfw-content'];
        for (let i = 0; i < nsfwClasses.length; i++) {
            const elements = document.querySelectorAll(`.${nsfwClasses[i]}`);
            for (let j = 0; j < elements.length; j++) {
                removeElementAndRelated(elements[j]);
            }
        }
    }

    function removeHrElements() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        for (let i = 0; i < hrElements.length; i++) {
            hrElements[i].remove();
        }
    }

    function removeSelectorsToDelete() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        for (let i = 0; i < selectorsToDelete.length; i++) {
            const elements = document.querySelectorAll(selectorsToDelete[i]);
            for (let j = 0; j < elements.length; j++) {
                removeElementAndRelated(elements[j]);
            }
        }
    }

    function processShadowDOM() {
        // Skip on Reddit Answers pages
        if (isRedditAnswersPage()) return;
        
        const elements = document.querySelectorAll('shreddit-post, shreddit-feed, shreddit-comments');
        
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!element.shadowRoot || shadowRootsProcessed.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            
            // Process posts in shadow DOM
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            for (let j = 0; j < posts.length; j++) {
                const post = posts[j];
                if (processedElements.has(post)) continue;
                processedElements.add(post);
                
                // Use comprehensive evaluation for consistency
                if (evaluateElementForBanning(post)) {
                    post.classList.add('prehide', 'reddit-banned');
                    post.remove();
                } else {
                    post.classList.add('reddit-approved');
                    permanentlyApprovedElements.add(post);
                }
            }
            
            // Set up observer for shadow root
            const shadowObserver = new MutationObserver(throttledShadowRootHandler);
            shadowObserver.observe(element.shadowRoot, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }
    }

    // --- MAIN FILTER FUNCTION ---
    function runAllChecks() {
        // Skip if we just ran recently (for performance)
        const now = performance.now();
        if (now - lastFilterTime < 50) return;
        lastFilterTime = now;
        
        // Apply body class for CSS transitions
        if (document.body && !document.body.classList.contains('reddit-filter-ready')) {
            document.body.classList.add('reddit-filter-ready');
        }
        
        // Check for answers page redirect first
        checkAndRedirectFromAnswers();
        
        // Hide Answers button
        hideAnswersButton();
        
        // Check Reddit Answers pages first
        if (isRedditAnswersPage()) {
            checkRedditAnswersTextContent();
            processAnswersShadowDOMText();
            return; // Only run Reddit Answers filtering on those pages
        }
        
        // Handle search filtering first (to prevent flashes)
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
        observeSearchDropdown();
        
        // Process shadow DOM
        processShadowDOM();
        
        // Filter posts and comments with consistent logic
        filterAdultSubredditPostsAndComments();
        hideKeywordPosts();
        filterPostsByContent();
        
        // Other checks
        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            hideSubredditPosts();
            checkForAdultContentTag();
            checkUrlForKeywordsToHide();
            clearRecentPages();
            hideRecentCommunitiesSection();
        }
        
        // Cleanup
        removeHrElements();
        removeSelectorsToDelete();
        checkAndHideNSFWClassElements();
    }

    // --- INITIALIZATION AND EVENT HANDLING ---
    function init() {
        // Check for answers page redirect immediately
        checkAndRedirectFromAnswers();
        
        // Set up search interception
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        
        // Run initial checks
        runAllChecks();
        
        // Set up observer for DOM changes
        const throttledRunChecks = throttle(runAllChecks, 50);
        const observer = new MutationObserver(throttledRunChecks);
        
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }
        
        // Use minimal intervals to reduce lag
        if (!isRedditAnswersPage()) {
            const minimalInterval = setInterval(hideBannedSubredditsFromSearch, 500);
            const answersButtonInterval = setInterval(hideAnswersButton, 50);
        }
        
        // Use requestIdleCallback for background tasks
        if (window.requestIdleCallback) {
            const idleCallback = () => {
                if (document.hidden) {
                    runAllChecks();
                } else {
                    if (isRedditAnswersPage()) {
                        throttledRedditAnswersCheck();
                    } else {
                        hideBannedSubredditsFromAllSearchDropdowns();
                        filterPostsByContent();
                        hideAnswersButton();
                    }
                }
                
                window.requestIdleCallback(idleCallback, { timeout: 1000 });
            };
            
            window.requestIdleCallback(idleCallback, { timeout: 1000 });
        } else {
            setInterval(() => {
                batchProcess(() => {
                    if (isRedditAnswersPage()) {
                        throttledRedditAnswersCheck();
                    } else {
                        hideBannedSubredditsFromAllSearchDropdowns();
                        filterPostsByContent();
                        hideAnswersButton();
                    }
                });
            }, 1000);
        }
        
        // Clear caches periodically to prevent memory leaks
        setInterval(() => {
            if (contentBannedCache.size > 1000) {
                contentBannedCache.clear();
            }
            if (bannedSubredditCache.size > 1000) {
                bannedSubredditCache.clear();
            }
        }, 60000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Process elements as they're added to the DOM
    const processNewElements = throttle((mutations) => {
        let needsSearchUpdate = false;
        let needsAnswersCheck = false;
        
        for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            
            checkAndRedirectFromAnswers();
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
            }
            
            if (isRedditAnswersPage()) {
                for (let k = 0; k < redditAnswersSelectors.length; k++) {
                    const selector = redditAnswersSelectors[k];
                    if (mutation.target.id && selector.includes(mutation.target.id)) {
                        needsAnswersCheck = true;
                        break;
                    }
                }
                
                if (mutation.target.tagName === 'GUIDES-HEADER-PANEL' ||
                    mutation.target.tagName === 'GUIDES-RESPONSE-CONTAINER-REALTIME' ||
                    mutation.target.tagName === 'GUIDES-SEARCH-INPUT') {
                    needsAnswersCheck = true;
                }
            }
            
            for (let j = 0; j < mutation.addedNodes.length; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType !== 1) continue;
                
                if (node.tagName === 'A' && node.getAttribute('href') === '/answers/') {
                    hideAnswersButton();
                }
                
                if (node.tagName === 'FACEPLATE-TRACKER' || 
                    node.querySelector && (node.querySelector('faceplate-tracker[noun="gen_guides_sidebar"]') ||
                                         node.querySelector('a[href="/answers/"]'))) {
                    hideAnswersButton();
                }
                
                if (!isRedditAnswersPage() && (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST')) {
                    if (!processedElements.has(node)) {
                        processedElements.add(node);
                        
                        // Use consistent evaluation logic
                        if (evaluateElementForBanning(node)) {
                            node.classList.add('prehide', 'reddit-banned');
                            removeElementAndRelated(node);
                        } else {
                            node.classList.add('reddit-approved');
                            permanentlyApprovedElements.add(node);
                        }
                    }
                } else if (node.hasAttribute && (
                    node.hasAttribute('role') || 
                    node.hasAttribute('data-testid') || 
                    node.classList.contains('recent-search-item')
                )) {
                    needsSearchUpdate = true;
                }
                
                if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                    shadowRootsProcessed.add(node.shadowRoot);
                    
                    if (isRedditAnswersPage()) {
                        const shadowText = node.shadowRoot.textContent || '';
                        if (shadowText && checkTextForKeywords(shadowText)) {
                            console.log('Banned text content found in added node shadow DOM, redirecting to answers page');
                            window.location.href = 'https://www.reddit.com/answers';
                            return;
                        }
                        
                        const shadowObserver = new MutationObserver(throttledAnswersTextHandler);
                        shadowObserver.observe(node.shadowRoot, {
                            childList: true,
                            subtree: true,
                            attributes: false,
                            characterData: true
                        });
                    } else {
                        processShadowSearchItems(node.shadowRoot);
                        
                        // Apply consistent filtering to shadow DOM content
                        const shadowPosts = node.shadowRoot.querySelectorAll('article, shreddit-post');
                        for (let k = 0; k < shadowPosts.length; k++) {
                            const shadowPost = shadowPosts[k];
                            if (!processedElements.has(shadowPost)) {
                                processedElements.add(shadowPost);
                                
                                if (evaluateElementForBanning(shadowPost)) {
                                    shadowPost.classList.add('prehide', 'reddit-banned');
                                    shadowPost.remove();
                                } else {
                                    shadowPost.classList.add('reddit-approved');
                                    permanentlyApprovedElements.add(shadowPost);
                                }
                            }
                        }
                        
                        const shadowObserver = new MutationObserver(throttledShadowRootHandler);
                        shadowObserver.observe(node.shadowRoot, {
                            childList: true,
                            subtree: true,
                            attributes: false,
                            characterData: false
                        });
                    }
                }
                
                if (!isRedditAnswersPage() && node.querySelectorAll) {
                    const hrElements = node.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
                    for (let k = 0; k < hrElements.length; k++) {
                        hrElements[k].remove();
                    }
                    
                    for (let k = 0; k < selectorsToDelete.length; k++) {
                        const elements = node.querySelectorAll(selectorsToDelete[k]);
                        for (let l = 0; l < elements.length; l++) {
                            removeElementAndRelated(elements[l]);
                        }
                    }
                }
            }
        }
        
        if (!isRedditAnswersPage() && needsSearchUpdate) {
            batchProcess(() => {
                hideBannedSubredditsFromSearch();
                hideBannedSubredditsFromAllSearchDropdowns();
            });
        }
        
        if (needsAnswersCheck) {
            throttledRedditAnswersCheck();
        }
        
        hideAnswersButton();
    }, 30);

    const observer = new MutationObserver(processNewElements);
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    if (!isRedditAnswersPage()) {
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
    }

    // Set up URL change detection for redirect
    let currentUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            checkAndRedirectFromAnswers();
        }
    }, 100);

})();