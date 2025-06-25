(function () {
    'use strict';

    // --- NUCLEAR CSS INJECTION FOR IMMEDIATE HIDING ---
    function addNuclearCSS() {
        const style = document.createElement('style');
        style.textContent = `
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
            
            /* Search dropdown hiding */
            .reddit-search-item-prehide, .reddit-search-shadow-prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* NUCLEAR CONTENT SETTINGS HIDING */
            .reddit-content-settings-hidden {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
                z-index: -9999 !important;
            }
            
            /* Hide NSFW search banners and toggles */
            .reddit-nsfw-search-hidden {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
                z-index: -9999 !important;
            }
            
            /* Hide Answers button elements */
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
            
            /* COMPLETE SHOW MATURE CONTENT REMOVAL - NUCLEAR OPTION */
            label[data-testid="is-nsfw-shown"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
                z-index: -9999 !important;
            }

            /* HIDE NSFW CONFIRMATION BUTTONS */
            button[slot="primary-button"],
            button.button-primary[slot="primary-button"],
            button[rpl][slot="primary-button"],
            button.button-medium.button-primary {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                pointer-events: none !important;
                z-index: -9999 !important;
            }

            /* FALLBACK DISABLED STYLING IF REMOVAL FAILS */
            .reddit-nsfw-forced-disabled {
                opacity: 0.6 !important;
                pointer-events: none !important;
                cursor: default !important;
            }
            
            .reddit-nsfw-forced-disabled,
            .reddit-nsfw-forced-disabled * {
                pointer-events: none !important;
                cursor: default !important;
            }
            
            .reddit-nsfw-forced-disabled .text-14,
            .reddit-nsfw-forced-disabled .text-12,
            .reddit-nsfw-forced-disabled span,
            .reddit-nsfw-forced-disabled div {
                color: var(--color-secondary, #6b7280) !important;
            }
            
            .reddit-nsfw-forced-disabled faceplate-switch-input {
                opacity: 0.6 !important;
                pointer-events: none !important;
                cursor: default !important;
            }
        `;
        
        try {
            const head = document.head || document.documentElement;
            head.insertBefore(style, head.firstChild);
        } catch (e) {
            document.addEventListener('DOMContentLoaded', function() {
                (document.head || document.documentElement).appendChild(style);
            });
        }
    }

    addNuclearCSS();

    const style = document.createElement('style');
    style.textContent = `
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
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Emma", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge", "jizzed",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina WWE", "Melina wrestler", "Jillian Hall", "five feet of fury", "Rampage", "raepd",
        "Mickie James", "Maria", "Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess", "Rampaige", "breasts",
        "Madison Rayne", "Velvet Sky", "Angelina", "ODB", "filmora", "wondershare", "Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX", "Sweeney", "Mickie",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Vaquer", "Vaqueer", "Vaguer", "Vagueer", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", 
        "Nightingale", "Statlander", "Hikaru Shida", "Riho", "Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", "Fatal Influence", "Aubert", "*ape", "Brooke", "Hikaru",
        "Penelope Ford", "Shotzi", "Blackheart", "Tegan", "Nox", "Charlotte", "Charlotte", "Sarray", "Xia Li", "OperaGX", "Sky Wrestling", "steph", "r*pe", "Opera Browser", 
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Alicia", "Atout", "stephanie", "ra*e", "nofap", "No nut",
        "Stephanie", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Renee", "rap*", "Answers BETA",
        "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Izzi Dame", "Alba Fyre", "Isla Dawn", "Tamina", "Sydney", "Gina Adams", "Kelly2",
        "Raquel Rodriguez", "B-Fab", "Scarlett", "Bordeaux", "Kayden", "Carter", "Katana Chance", "Valkyria", "Tamina Snuka", "Renee Young", "Sydney Sweeney", "Priscilla",
        "Roxanne Perez", "Indi Hartwell", "Hartwell", "Blair", "Davenport", "wonder share", "Lola Vice", "Maxxine Dupri", "Karmen", "Karmen Petrovic", "Brittany", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum", "Paxley", "Fallon Henley", "Sky wrestle", "Women's", "Girl", "Women", "venoisi",  "rawdog", "rawdogging", 
        "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa", "Valentina", "Valentine", "Amari Miller", "Sky WWE", "Woman", "Lady", "Girls", "Girl's", "venoise", "AlexaBliss", "AlexaPearl",
        "Sol Ruca", "Arianna Grace", "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW", "Woman's", "Lady's", "Girl's", "Mandy", "org@$m", "0rga$m", "orga$m",
        "Mercedes", "Sasha", "Banks", "Russo", "Vince Russo", "Dave Meltzer", "Sportskeeda", "Liv Xoxo", "Roxanne", "orgasm", "0rgasm", "org@sm", "orga5m", "org@5m", "org@sm", "orga5m", "0rg@sm", "0rg@5m"
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
        /vegi/i, /vege/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /izzi dame/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i,
        /Tiffa/i, /Strat/i, /puz/i, /Sweee/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /\bSlut\b/i, /3dit/i, /ed1t/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bAi\b/i,
        /Sydney Sweeney/i, /Sweeney/i, /fap/i, /Sydnee/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bedit\b/i, /Feikki/i,
        /\bAnall\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i, /\bHer\b/i, /\bShe\b/i, /\bADMX\b/i, /\bAss\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /\bAi-\b/i,
        /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /Chel5/i, /\bTay\b/i, /\balexa wwe\b/i, /\bazz\b/i, /\bjaida\b/i, /Steph/i, /St3ph/i, /editation/i, /3d!7/i,
        /P4IG3/i, /Paig3/i, /P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /Lana WWE/i, /Lana Del Rey/i, /\bLana\b/i, /CJ WWE/i, /image app/i, /edi7/i, /syvavaarennos/i,
        /Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /picture app/i, /edit app/i, /pic app/i, /photo app/i, /syvävääre/i,
        /pillu/i, /perse/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /\bPeba\b/i, /\bBeba\b/i, /\bBabe\b/i, /\bBepa\b/i, /\bAnaali\b/i, /\bAnus\b/i, /sexuaali/i, /\bSeksi\b/i, /yhdyntä/i, /\bGina\b/i, 
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i, /seksikuva/i,
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /seksi kuvia/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synth/i,
        /Margot/i, /Robbie/i, /Johansson/i, /Ana de Armas/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /panee/i, /paneva/i,
        /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimis/i, /Stratusfaction/i, /yhdynnässä/i, /seksivideo/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i,
        /pano kuva/i, /panokuvat/i, /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpittä/i,
        /sormetus/i, /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkkyvid/i,
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuissivusto/i, /homo/i, /lesbo/i, /transu/i, /pervo/i, /5yvä/i, /\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /face plus/i,  /face\+/i, /face+/i, /fac\+/i,
        /bg remover/i, /\bMina\b/i, /Shir/i, /kawa/i, /perver/i, /Mariah/i, /\bAva\b/i, /\bAnal-\b/i, /\b-Anal\b/i, /\bAnal\b/i, 
    ];

    const unifiedSelectors = [
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-weak",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-weak",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap.rounded.px-xs.text-neutral-content",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader",
        ".\\32 xs.gap.items-center.flex",
        ".mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        ".row-end-2.row-start-1.col-end-3.col-start-1 > .mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        'span.text-global-admin.font-semibold.text-12',
        'a[href="/answers/"]',
        'a.flex.justify-between.relative.px-md[href="/answers/"]',
        'faceplate-tracker[noun="gen_guides_sidebar"]',
        'faceplate-tracker[source="nav"][action="click"][noun="gen_guides_sidebar"]',
        'svg[icon-name="answers-outline"]',
        'svg[rpl][icon-name="answers-outline"]'
    ];

    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel"
    ];

    const answersButtonSelectors = [
        'a[href="/answers/"]',
        'a.flex.justify-between.relative.px-md[href="/answers/"]',
        'faceplate-tracker[noun="gen_guides_sidebar"]',
        'faceplate-tracker[source="nav"][action="click"][noun="gen_guides_sidebar"]',
        'svg[icon-name="answers-outline"]',
        'svg[rpl][icon-name="answers-outline"]',
        'span.text-global-admin.font-semibold.text-12'
    ];

    const nsfwConfirmationSelectors = [
        'button[slot="primary-button"]',
        'button.button-primary[slot="primary-button"]',
        'button[rpl][slot="primary-button"]',
        'button.button-medium.button-primary',
        'button.button-primary.items-center.justify-center',
        'button.button-medium.px-\\[var\\(--rem14\\)\\].button-primary'
    ];

    // Optimized caches and performance variables
    const processedElements = new WeakSet();
    const processedSearchItems = new WeakSet();
    const bannedSubredditCache = new Map();
    const contentBannedCache = new Map();
    const shadowRootsProcessed = new WeakSet();
    let lastFilterTime = 0;
    let pendingOperations = false;
    let isCurrentlyFiltering = false;

    // Cache page type checks
    let pageTypeCache = {
        lastCheck: 0,
        isAnswers: false,
        isPreferences: false,
        isAccount: false,
        isSearch: false,
        isPost: false
    };

    function updatePageTypeCache() {
        const now = performance.now();
        if (now - pageTypeCache.lastCheck < 500) return;
        
        const url = window.location.href;
        pageTypeCache.lastCheck = now;
        pageTypeCache.isAnswers = url.includes('reddit.com/answers');
        pageTypeCache.isPreferences = url.includes('reddit.com/settings/preferences') || 
                                      (url.includes('reddit.com/settings/') && url.includes('preferences'));
        pageTypeCache.isAccount = url.includes('reddit.com/settings/account') || 
                                  (url.includes('reddit.com/settings/') && url.includes('account'));
        pageTypeCache.isSearch = url.includes('/search');
        pageTypeCache.isPost = url.includes('/comments/') || 
                               window.location.pathname.match(/^\/r\/[^\/]+\/comments\//) ||
                               window.location.pathname.match(/^\/u\/[^\/]+\/comments\//) ||
                               window.location.pathname.match(/^\/user\/[^\/]+\/comments\//);
    }

    function isRedditAnswersPage() {
        updatePageTypeCache();
        return pageTypeCache.isAnswers;
    }

    function isRedditPreferencesPage() {
        updatePageTypeCache();
        return pageTypeCache.isPreferences;
    }

    function isRedditAccountPage() {
        updatePageTypeCache();
        return pageTypeCache.isAccount;
    }

    function isSearchResultsPage() {
        updatePageTypeCache();
        return pageTypeCache.isSearch;
    }

    function isPostPage() {
        updatePageTypeCache();
        return pageTypeCache.isPost;
    }

    // Optimized throttle with RAF
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
                requestId = requestAnimationFrame(() => {
                    requestId = null;
                    lastCall = performance.now();
                    fn.apply(context, args);
                });
            }
        };
    }

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

    function batchProcess(fn) {
        if (pendingOperations) return;
        pendingOperations = true;
        
        requestAnimationFrame(() => {
            fn();
            pendingOperations = false;
        });
    }

    // --- ULTIMATE NUCLEAR NSFW DISABLING SYSTEM ---
    function forceNSFWDisabled() {
        try {
            // Force set NSFW preferences to disabled in localStorage
            const nsfwSettings = {
                'nsfw_enabled': false,
                'blur_nsfw': true,
                'safe_search': true,
                'show_nsfw': false,
                'nsfw_filter': true,
                'show_mature_content': false,
                'mature_content_enabled': false,
                'is_nsfw_shown': false,
                'over_18': false,
                'nsfw_age_verification': false
            };
            
            for (const [key, value] of Object.entries(nsfwSettings)) {
                try {
                    localStorage.setItem(key, value.toString());
                    sessionStorage.setItem(key, value.toString());
                } catch (e) {
                    // Handle storage errors silently
                }
            }
            
            // Intercept and override any NSFW setting changes
            if (!window.__nsfwOverrideAttached) {
                const originalSetItem = localStorage.setItem;
                localStorage.setItem = function(key, value) {
                    if (key.toLowerCase().includes('nsfw') || key.toLowerCase().includes('mature') || key.toLowerCase().includes('over_18') || key.toLowerCase().includes('age')) {
                        if (key.includes('enabled') || key.includes('show') || key.includes('over') || key.includes('verification')) {
                            value = 'false';
                        } else if (key.includes('blur') || key.includes('filter') || key.includes('safe')) {
                            value = 'true';
                        }
                    }
                    return originalSetItem.call(this, key, value);
                };
                
                const originalSessionSetItem = sessionStorage.setItem;
                sessionStorage.setItem = function(key, value) {
                    if (key.toLowerCase().includes('nsfw') || key.toLowerCase().includes('mature') || key.toLowerCase().includes('over_18') || key.toLowerCase().includes('age')) {
                        if (key.includes('enabled') || key.includes('show') || key.includes('over') || key.includes('verification')) {
                            value = 'false';
                        } else if (key.includes('blur') || key.includes('filter') || key.includes('safe')) {
                            value = 'true';
                        }
                    }
                    return originalSessionSetItem.call(this, key, value);
                };
                
                window.__nsfwOverrideAttached = true;
            }
            
            // Override forms and prevent NSFW settings
            const forms = document.querySelectorAll('form');
            for (let i = 0; i < forms.length; i++) {
                const form = forms[i];
                if (!form.__nsfwOverrideAttached) {
                    form.addEventListener('submit', function(e) {
                        const formData = new FormData(form);
                        const entries = Array.from(formData.entries());
                        
                        for (let j = 0; j < entries.length; j++) {
                            const [name, value] = entries[j];
                            if (name.toLowerCase().includes('nsfw') || name.toLowerCase().includes('mature') || name.toLowerCase().includes('over_18')) {
                                formData.set(name, 'false');
                            }
                        }
                        
                        // Block NSFW form submissions
                        const formAction = form.action || '';
                        const formHTML = form.outerHTML || '';
                        if (formAction.includes('nsfw') || formAction.includes('mature') || 
                            formHTML.includes('nsfw') || formHTML.includes('mature') || 
                            formHTML.includes('over 18') || formHTML.includes('adult')) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }
                    });
                    form.__nsfwOverrideAttached = true;
                }
            }
            
            // Force toggle switches to disabled state
            const switches = document.querySelectorAll('button[role="switch"], faceplate-switch-input, input[type="checkbox"]');
            const allEvents = ['mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'keyup', 'focus', 'change', 'click'];
            
            for (let i = 0; i < switches.length; i++) {
                const switchEl = switches[i];
                const ariaLabel = switchEl.getAttribute('aria-label') || '';
                const id = switchEl.getAttribute('id') || '';
                
                if (ariaLabel.toLowerCase().includes('mature') ||
                    ariaLabel.toLowerCase().includes('18+') ||
                    ariaLabel.toLowerCase().includes('nsfw') ||
                    ariaLabel.toLowerCase().includes('over 18') ||
                    id.toLowerCase().includes('nsfw') ||
                    id.toLowerCase().includes('mature')) {
                    
                    if (switchEl.tagName === 'INPUT') {
                        switchEl.checked = false;
                        switchEl.disabled = true;
                    } else {
                        switchEl.setAttribute('aria-checked', 'false');
                        switchEl.setAttribute('disabled', '');
                        switchEl.setAttribute('aria-disabled', 'true');
                    }
                    
                    // Block all interactions
                    for (let k = 0; k < allEvents.length; k++) {
                        switchEl.addEventListener(allEvents[k], function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            if (allEvents[k] === 'focus') this.blur();
                            return false;
                        }, { capture: true, passive: false });
                    }
                }
            }
            
            // Block NSFW confirmation buttons
            const confirmationButtons = document.querySelectorAll('button');
            for (let i = 0; i < confirmationButtons.length; i++) {
                const button = confirmationButtons[i];
                const buttonText = button.textContent || '';
                const buttonHTML = button.outerHTML || '';
                
                if (buttonText.includes('Yes, I\'m Over 18') || 
                    buttonText.includes('I\'m over 18') ||
                    buttonText.includes('Continue') ||
                    buttonHTML.includes('primary-button') ||
                    button.hasAttribute('slot') && button.getAttribute('slot') === 'primary-button') {
                    
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        return false;
                    }, { capture: true, passive: false });
                    
                    button.disabled = true;
                    button.style.setProperty('pointer-events', 'none', 'important');
                    button.style.setProperty('opacity', '0.5', 'important');
                }
            }
            
        } catch (e) {
            console.warn('Force NSFW disabled failed:', e);
        }
    }

    // --- NUCLEAR ANSWERS BUTTON HIDING FUNCTIONS ---
    function hideAnswersButton() {
        const answersHrefs = [
            'a[href="/answers/"]',
            'a[href="/answers"]',
            'a[href*="/answers"]',
            'a[href^="/answers"]'
        ];
        
        for (let h = 0; h < answersHrefs.length; h++) {
            const answersLinks = document.querySelectorAll(answersHrefs[h]);
            for (let i = 0; i < answersLinks.length; i++) {
                const link = answersLinks[i];
                
                if (!link.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                    link.classList.add('reddit-answers-hidden');
                    let parent = link.parentElement;
                    let parentLevels = 0;
                    while (parent && parentLevels < 5) {
                        if (!parent.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                            parent.classList.add('reddit-answers-hidden');
                        }
                        parent = parent.parentElement;
                        parentLevels++;
                    }
                    link.remove();
                }
            }
        }

        const specificAnswersLinks = document.querySelectorAll('a.flex.justify-between.relative.px-md[href="/answers/"], a.flex.justify-between.relative.px-md[href="/answers"], a.flex.justify-between.relative.px-md[href*="/answers"]');
        for (let i = 0; i < specificAnswersLinks.length; i++) {
            const link = specificAnswersLinks[i];
            if (!link.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                link.classList.add('reddit-answers-hidden');
                let parent = link.parentElement;
                let parentLevels = 0;
                while (parent && parentLevels < 5) {
                    if (!parent.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                        parent.classList.add('reddit-answers-hidden');
                    }
                    parent = parent.parentElement;
                    parentLevels++;
                }
                link.remove();
            }
        }

        for (let i = 0; i < answersButtonSelectors.length; i++) {
            const elements = document.querySelectorAll(answersButtonSelectors[i]);
            for (let j = 0; j < elements.length; j++) {
                const element = elements[j];
                if (!element.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                    element.classList.add('reddit-answers-hidden');
                    let parent = element.parentElement;
                    let parentLevels = 0;
                    while (parent && parentLevels < 5) {
                        if (!parent.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                            parent.classList.add('reddit-answers-hidden');
                        }
                        parent = parent.parentElement;
                        parentLevels++;
                    }
                    element.remove();
                }
            }
        }

        const answersIcons = document.querySelectorAll('svg[icon-name="answers-outline"], svg[rpl][icon-name="answers-outline"], svg[viewBox*="24"], *[data-icon="answers"], *[aria-label*="answers"]');
        for (let i = 0; i < answersIcons.length; i++) {
            const icon = answersIcons[i];
            if (!icon.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                let current = icon;
                for (let level = 0; level < 10; level++) {
                    if (current && !current.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                        current.classList.add('reddit-answers-hidden');
                        current = current.parentElement;
                    } else {
                        break;
                    }
                }
                icon.remove();
            }
        }

        const textSearchElements = document.querySelectorAll('*');
        for (let i = 0; i < textSearchElements.length; i++) {
            const element = textSearchElements[i];
            
            if (element.hasAttribute('data-answers-processed') || 
                element.textContent.length > 500 ||
                element.classList.contains('reddit-answers-hidden') ||
                element.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) continue;
            
            const textContent = element.textContent || '';
            const lowerText = textContent.toLowerCase();
            
            if ((lowerText.includes('answers') && lowerText.includes('beta')) ||
                (lowerText === 'answers beta') ||
                (lowerText === 'answers') ||
                (element.tagName === 'SPAN' && element.classList.contains('text-global-admin') && element.classList.contains('font-semibold') && lowerText.includes('beta'))) {
                
                element.setAttribute('data-answers-processed', 'true');
                element.classList.add('reddit-answers-hidden');
                
                let parent = element.parentElement;
                let parentLevels = 0;
                while (parent && parentLevels < 8) {
                    if (!parent.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                        parent.classList.add('reddit-answers-hidden');
                    }
                    parent = parent.parentElement;
                    parentLevels++;
                }
                element.remove();
            }
        }

        const allSpans = document.querySelectorAll('span');
        for (let i = 0; i < allSpans.length; i++) {
            const span = allSpans[i];
            if (span.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) continue;
            
            const spanText = span.textContent ? span.textContent.trim().toLowerCase() : '';
            
            if (spanText === 'beta' || 
                spanText.includes('beta') ||
                (span.classList.contains('text-global-admin') && span.classList.contains('font-semibold') && span.classList.contains('text-12'))) {
                
                span.classList.add('reddit-answers-hidden');
                
                let parent = span.parentElement;
                let parentLevels = 0;
                while (parent && parentLevels < 10) {
                    if (!parent.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                        parent.classList.add('reddit-answers-hidden');
                    }
                    parent = parent.parentElement;
                    parentLevels++;
                }
                span.remove();
            }
        }

        const gapElements = document.querySelectorAll('a[class*="gap"][href*="/answers"]');
        for (let i = 0; i < gapElements.length; i++) {
            const element = gapElements[i];
            if (!element.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                element.classList.add('reddit-answers-hidden');
                let parent = element.parentElement;
                let parentLevels = 0;
                while (parent && parentLevels < 8) {
                    if (!parent.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                        parent.classList.add('reddit-answers-hidden');
                    }
                    parent = parent.parentElement;
                    parentLevels++;
                }
                element.remove();
            }
        }

        const navContainers = document.querySelectorAll('aside, menu, ul, li, faceplate-tracker, div[role="menu"]');
        for (let i = 0; i < navContainers.length; i++) {
            const container = navContainers[i];
            if (container.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) continue;
            
            if (container.querySelector && (
                container.querySelector('a[href*="/answers"]') ||
                container.querySelector('svg[icon-name="answers-outline"]') ||
                (container.textContent && container.textContent.toLowerCase().includes('answers') && container.textContent.toLowerCase().includes('beta'))
            )) {
                container.classList.add('reddit-answers-hidden');
                container.remove();
            }
        }
        
        const hiddenElements = document.querySelectorAll('.reddit-answers-hidden');
        for (let i = 0; i < hiddenElements.length; i++) {
            hiddenElements[i].remove();
        }
    }

    // --- HIDE NSFW CONFIRMATION BUTTONS ---
    function hideNSFWConfirmationButtons() {
        // Hide by selectors
        for (let i = 0; i < nsfwConfirmationSelectors.length; i++) {
            const buttons = document.querySelectorAll(nsfwConfirmationSelectors[i]);
            for (let j = 0; j < buttons.length; j++) {
                const button = buttons[j];
                button.classList.add('reddit-nsfw-search-hidden');
                button.remove();
            }
        }
        
        // Hide by text content
        const allButtons = document.querySelectorAll('button');
        for (let i = 0; i < allButtons.length; i++) {
            const button = allButtons[i];
            const buttonText = button.textContent || '';
            
            if (buttonText.includes('Yes, I\'m Over 18') || 
                buttonText.includes('I\'m over 18') ||
                buttonText.includes('Continue') ||
                (buttonText.includes('Yes') && buttonText.includes('18'))) {
                
                button.classList.add('reddit-nsfw-search-hidden');
                button.remove();
            }
        }
        
        // Hide entire modals containing NSFW content
        const modals = document.querySelectorAll('rpl-dialog, rpl-dialog-sheet, [role="dialog"], .modal, [data-testid*="modal"]');
        for (let i = 0; i < modals.length; i++) {
            const modal = modals[i];
            const modalText = modal.textContent || '';
            
            if (modalText.includes('mature content') || 
                modalText.includes('over 18') ||
                modalText.includes('NSFW') ||
                modalText.includes('adult content')) {
                
                modal.classList.add('reddit-nsfw-search-hidden');
                modal.remove();
            }
        }
    }

    // --- OPTIMIZED ELEMENT DELETION ---
    function deleteElementsAutomatically() {
        if (!isRedditPreferencesPage() || isRedditAccountPage()) {
            return;
        }
        
        try {
            // Batch all selector-based deletions
            const selectorsToDelete = [
                'faceplate-switch-input[aria-label="Show mature content (I\'m over 18)"]',
                'div.flex.justify-between.gap-\\[0\\.5rem\\].text-secondary.py-xs',
                'label[data-testid="is-nsfw-shown"]',
                'label.block.normal-case.cursor-pointer[data-testid="is-nsfw-shown"]'
            ];
            
            for (let i = 0; i < selectorsToDelete.length; i++) {
                const elements = document.querySelectorAll(selectorsToDelete[i]);
                for (let j = 0; j < elements.length; j++) {
                    elements[j].remove();
                }
            }
            
            // Find and delete by text content efficiently
            const spanElements = document.querySelectorAll('span.text-14.break-normal');
            for (let i = 0; i < spanElements.length; i++) {
                const span = spanElements[i];
                if (span.textContent === 'Show mature content (I\'m over 18)') {
                    const containerToDelete = span.closest('div.flex.justify-between') || span.closest('div');
                    if (containerToDelete) {
                        containerToDelete.remove();
                    }
                }
            }
            
        } catch (e) {
            console.warn('Automated element deletion failed:', e);
        }
    }

    // --- OPTIMIZED CONTENT SETTINGS DESTRUCTION ---
    function hideContentSettings() {
        if (!isRedditPreferencesPage() || isRedditAccountPage()) {
            return;
        }
        
        try {
            forceNSFWDisabled();
            hideNSFWConfirmationButtons();
            deleteElementsAutomatically();
            
            // Remove by data-testid efficiently
            const nsfwElements = document.querySelectorAll('label[data-testid="is-nsfw-shown"], label.block.normal-case.cursor-pointer[data-testid="is-nsfw-shown"]');
            for (let i = 0; i < nsfwElements.length; i++) {
                nsfwElements[i].remove();
            }
            
            // Force disable remaining switches
            const nsfwSwitches = document.querySelectorAll('faceplate-switch-input[aria-label="Show mature content (I\'m over 18)"]');
            for (let i = 0; i < nsfwSwitches.length; i++) {
                const switchEl = nsfwSwitches[i];
                const parentLabel = switchEl.closest('label[data-testid="is-nsfw-shown"]') || switchEl.closest('label');
                if (parentLabel) {
                    parentLabel.remove();
                }
            }
            
            // Apply disabled styling as fallback
            const remainingNsfwLabels = document.querySelectorAll('label[data-testid="is-nsfw-shown"]');
            for (let i = 0; i < remainingNsfwLabels.length; i++) {
                const label = remainingNsfwLabels[i];
                const innerDiv = label.querySelector('div.flex.justify-between');
                if (innerDiv) {
                    innerDiv.classList.add('opacity-60', 'pointer-events-none');
                    label.classList.remove('cursor-pointer');
                    
                    const switchInput = innerDiv.querySelector('faceplate-switch-input');
                    if (switchInput) {
                        switchInput.setAttribute('disabled', '');
                        switchInput.setAttribute('aria-disabled', 'true');
                        switchInput.setAttribute('aria-checked', 'false');
                        
                        const allEvents = ['click', 'change', 'keydown', 'keyup', 'focus', 'blur'];
                        for (let eventType of allEvents) {
                            switchInput.addEventListener(eventType, function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                if (eventType === 'focus') this.blur();
                                if (eventType === 'change') this.setAttribute('aria-checked', 'false');
                                return false;
                            }, { capture: true, passive: false });
                        }
                    }
                }
            }
            
            // Remove modals and dialog sheets
            const nsfwModals = document.querySelectorAll('settings-preferences-nsfw-modal, rpl-dialog-sheet[dialog-id="nsfw"]');
            for (let i = 0; i < nsfwModals.length; i++) {
                nsfwModals[i].remove();
            }
            
        } catch (e) {
            console.warn('Content settings destruction failed:', e);
        }
    }

    function hideNSFWSearchElements() {
        try {
            const nsfwToggleSelectors = [
                'settings-preferences-nsfw-modal',
                'rpl-dialog-sheet[dialog-id="nsfw"]',
                'rpl-dialog-sheet[overlay-blur]',
                'label[data-testid="is-nsfw-shown"]',
                'label[data-testid="safe-browsing-mode"]',
                'label.block.normal-case.cursor-pointer[data-testid="is-nsfw-shown"]',
                'label.block.normal-case[data-testid="safe-browsing-mode"]',
                'search-sort-dropdown-menu#search_modifier_safe_search',
                'search-banner#banner',
                'search-telemetry-tracker search-banner',
                'safe-search-option-click-handler',
                'button[aria-label*="NSFW"]',
                'button[aria-label*="Safe Search"]',
                '[data-testid*="nsfw"]',
                '[data-testid*="safe-search"]',
                'faceplate-switch-input[aria-label*="mature"]',
                'faceplate-switch-input[aria-label*="18"]',
                'faceplate-switch-input[aria-label*="Blur mature"]',
                'faceplate-switch-input[aria-label*="Show mature content"]',
                'faceplate-switch-input[aria-label*="I\'m over 18"]',
                'faceplate-switch-input.flex-col.mr-xs.pointer-events-none',
                'button[slot="primary-button"]',
                'button.button-primary[slot="primary-button"]',
                'button[rpl][slot="primary-button"]',
                'button.button-medium.button-primary',
                'button.button-primary.items-center.justify-center',
                'button.button-medium.px-\\[var\\(--rem14\\)\\].button-primary',
                '#nsfw-rpl-modal-card',
                'div[part="base"].dialog',
                'div[part="overlay"]',
                'div[part="panel"]',
                'div.dialog.dialog-variant-default.dialog-open',
                'div.dialog-overlay',
                'div.dialog-overlay-blur',
                'div.dialog-overlay.dialog-overlay-blur',
                'div.dialog-panel',
                'div[part="overlay"].dialog-overlay-blur',
                'div[part="overlay"][tabindex="-1"]',
                'div.dialog-overlay[tabindex="-1"]',
                'div.dialog-overlay-blur[tabindex="-1"]',
                'div[role="dialog"]',
                'div[aria-modal="true"]',
                'div > div.dialog-overlay.dialog-overlay-blur',
                '#nsfw',
                'div:nth-child(2) > label:nth-child(3) > div > span.flex.items-center.gap-xs.min-w-0.shrink > span',
                'div:nth-child(2) > label:nth-child(3) > div > span.flex.items-center.gap-xs.min-w-0.shrink',
                'div:nth-child(2) > label:nth-child(3) > div',
                'div:nth-child(2) > label:nth-child(3)'
            ];
            
            for (let i = 0; i < nsfwToggleSelectors.length; i++) {
                try {
                    const elements = document.querySelectorAll(nsfwToggleSelectors[i]);
                    for (let j = 0; j < elements.length; j++) {
                        elements[j].classList.add('reddit-nsfw-search-hidden');
                        elements[j].remove();
                    }
                } catch (selectorError) {
                    // Ignore selector errors
                }
            }
            
            const nsfwBannerTexts = [
                'NSFW search results are hidden',
                'You have NSFW filter active',
                'NSFW filter is active',
                'Safe search is on',
                'You won\'t see mature NSFW',
                'Update Settings',
                'NSFW search results',
                'Safe Search On',
                'Yes, I\'m Over 18',
                'mature content',
                'adult content',
                'over 18'
            ];
            
            for (let i = 0; i < nsfwBannerTexts.length; i++) {
                const text = nsfwBannerTexts[i];
                const allElements = document.querySelectorAll('*');
                
                for (let j = 0; j < allElements.length; j++) {
                    const element = allElements[j];
                    
                    if (element.textContent && element.textContent.includes(text)) {
                        let targetElement = element;
                        
                        while (targetElement) {
                            if (targetElement.matches && (
                                targetElement.matches('div[role="alert"]') ||
                                targetElement.matches('search-banner') ||
                                targetElement.matches('search-telemetry-tracker') ||
                                targetElement.matches('div[class*="banner"]') ||
                                targetElement.matches('rpl-dialog') ||
                                targetElement.matches('rpl-dialog-sheet') ||
                                targetElement.matches('[role="dialog"]') ||
                                targetElement.matches('div')
                            )) {
                                targetElement.classList.add('reddit-nsfw-search-hidden');
                                targetElement.remove();
                                break;
                            }
                            targetElement = targetElement.parentElement;
                        }
                    }
                }
            }
            
            const updateButtons = document.querySelectorAll('button, a');
            for (let i = 0; i < updateButtons.length; i++) {
                const button = updateButtons[i];
                if (button.textContent && 
                    (button.textContent.includes('Update Settings') ||
                     button.textContent.includes('Safe Search') ||
                     button.textContent.includes('NSFW') ||
                     button.textContent.includes('Yes, I\'m Over 18') ||
                     button.textContent.includes('Continue'))) {
                    
                    let container = button.closest('div[role="alert"]') ||
                                  button.closest('search-banner') ||
                                  button.closest('rpl-dialog') ||
                                  button.closest('rpl-dialog-sheet') ||
                                  button.closest('[role="dialog"]') ||
                                  button.closest('div');
                    if (container) {
                        container.classList.add('reddit-nsfw-search-hidden');
                        container.remove();
                    }
                }
            }
            
        } catch (e) {
            console.warn('NSFW search element hiding failed:', e);
        }
    }

    // --- OPTIMIZED SUBREDDIT CHECKING ---
    function isSubredditNameBanned(subName) {
        if (!subName) return false;
        const lowerSub = subName.toLowerCase();
        
        if (bannedSubredditCache.has(lowerSub)) {
            return bannedSubredditCache.get(lowerSub);
        }
        
        // Check adult subreddits first (fastest)
        for (let i = 0; i < adultSubreddits.length; i++) {
            if (lowerSub === adultSubreddits[i].toLowerCase()) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        // Check keywords
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerSub.includes(keywordsToHide[i].toLowerCase())) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        // Check regex (most expensive)
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerSub)) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        bannedSubredditCache.set(lowerSub, false);
        return false;
    }

    // Optimized content checking with early returns and better caching
    function checkContentForKeywords(content) {
        if (!content) return false;
        
        const contentText = content.textContent || content.innerText || '';
        if (!contentText || contentText.length < 3) return false;
        
        const lowerText = contentText.toLowerCase();
        const cacheKey = lowerText.substring(0, 100).trim();
        
        if (contentBannedCache.has(cacheKey)) {
            return contentBannedCache.get(cacheKey);
        }
        
        let isBanned = false;
        
        // Optimized keyword check
        const commonWords = ['her', 'she', 'the', 'and', 'for', 'app', 'main'];
        for (let i = 0; i < keywordsToHide.length && !isBanned; i++) {
            const keyword = keywordsToHide[i].toLowerCase();
            
            // Skip common words that are too short
            if (keyword.length < 4 && commonWords.includes(keyword)) {
                continue;
            }
            
            if (lowerText.includes(keyword)) {
                // Context check for 'main' keyword
                if (keyword === 'main') {
                    const index = lowerText.indexOf(keyword);
                    const before = lowerText.substring(Math.max(0, index - 10), index);
                    const after = lowerText.substring(index + keyword.length, index + keyword.length + 10);
                    
                    if (before.includes('domain') || after.includes('stream')) {
                        continue;
                    }
                }
                
                isBanned = true;
            }
        }
        
        // Regex check only if keyword check failed
        if (!isBanned) {
            for (let i = 0; i < regexKeywordsToHide.length && !isBanned; i++) {
                if (regexKeywordsToHide[i].test(lowerText)) {
                    isBanned = true;
                }
            }
        }
        
        contentBannedCache.set(cacheKey, isBanned);
        return isBanned;
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

    // Optimized subreddit extraction
    function getSubredditForAnyRedditPost(el) {
        const prefixedName = el.getAttribute && el.getAttribute('subreddit-prefixed-name');
        if (prefixedName) return prefixedName.startsWith('r/') ? prefixedName : 'r/' + prefixedName;
        
        const subredditName = el.getAttribute && el.getAttribute('subreddit-name');
        if (subredditName) return 'r/' + subredditName;
        
        const dataSubreddit = el.getAttribute && el.getAttribute('data-subreddit');
        if (dataSubreddit) return dataSubreddit.startsWith('r/') ? dataSubreddit : 'r/' + dataSubreddit;
        
        const subredditLink = el.querySelector && el.querySelector('a[data-testid="subreddit-name"]');
        if (subredditLink && subredditLink.textContent) return subredditLink.textContent.trim();
        
        const rLink = el.querySelector && el.querySelector('a[href^="/r/"]');
        if (rLink && rLink.textContent) return rLink.textContent.trim();
        
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

    // Optimized search result filtering - SKIP ON POST PAGES
    function filterSearchResultPosts() {
        if (!isSearchResultsPage() || isCurrentlyFiltering || isPostPage()) return;
        
        isCurrentlyFiltering = true;
        
        try {
            const searchPosts = document.querySelectorAll('article, shreddit-post, [data-testid*="post"], div[slot="post"]');
            
            for (let i = 0; i < searchPosts.length; i++) {
                const post = searchPosts[i];
                if (processedElements.has(post)) continue;
                processedElements.add(post);
                
                let shouldHide = false;
                
                const subreddit = getSubredditForAnyRedditPost(post);
                if (subreddit && isSubredditNameBanned(subreddit)) {
                    shouldHide = true;
                } else {
                    // Check title only
                    const titleElement = post.querySelector('h1, h2, h3, a[data-click-id="body"], .title, [data-testid*="title"], a[href*="/comments/"]');
                    if (titleElement && checkContentForKeywords(titleElement)) {
                        shouldHide = true;
                    } else {
                        // Check post content excluding title
                        const postContentElements = post.querySelectorAll('p, div:not(:has(h1, h2, h3, a[data-click-id="body"], .title, [data-testid*="title"]))');
                        for (let j = 0; j < postContentElements.length && !shouldHide; j++) {
                            if (checkContentForKeywords(postContentElements[j])) {
                                shouldHide = true;
                            }
                        }
                    }
                }
                
                if (shouldHide) {
                    post.classList.add('reddit-banned');
                    post.remove();
                }
            }
        } finally {
            isCurrentlyFiltering = false;
        }
    }

    function filterAdultSubredditPostsAndComments() {
        if (isPostPage()) return;
        
        const posts = document.querySelectorAll('article:not(.reddit-processed), shreddit-post:not(.reddit-processed), [subreddit-prefixed-name]:not(.reddit-processed)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            post.classList.add('reddit-processed');
            
            if (isElementFromAdultSubreddit(post)) {
                post.classList.add('reddit-banned');
                removeElementAndRelated(post);
            }
        }
        
        const comments = document.querySelectorAll('.Comment:not(.reddit-processed)');
        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            comment.classList.add('reddit-processed');
            
            if (isElementFromAdultSubreddit(comment)) {
                comment.classList.add('reddit-banned');
                removeElementAndRelated(comment);
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
        if (isPostPage()) return;
        
        const posts = document.querySelectorAll('article:not(.reddit-processed), shreddit-post:not(.reddit-processed)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            
            let joinNowFound = false;
            
            const btns = post.querySelectorAll('button, a');
            for (let j = 0; j < btns.length && !joinNowFound; j++) {
                if (btns[j].textContent && btns[j].textContent.trim().toLowerCase() === 'join now') {
                    joinNowFound = true;
                }
            }
            
            if (joinNowFound) {
                post.classList.add('reddit-banned');
                removeElementAndRelated(post);
            }
        }
    }

    function getSubredditFromPost(post) {
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
        if (isPostPage()) return;
        
        const posts = document.querySelectorAll('article:not(.reddit-processed)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            
            const subName = getSubredditFromPost(post);
            if (subName && isSubredditNameBanned(subName)) {
                post.classList.add('reddit-banned');
                removeElementAndRelated(post);
            }
        }
    }

    function hideKeywordPosts() {
        if (isPostPage()) return;
        
        const posts = document.querySelectorAll('article:not(.reddit-processed)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            post.classList.add('reddit-processed');
            
            let containsKeywordToHide = false;
            
            const subreddit = getSubredditFromPost(post);
            if (subreddit && isSubredditNameBanned(subreddit)) {
                containsKeywordToHide = true;
            }
            
            if (!containsKeywordToHide) {
                const titleElement = post.querySelector('h1, h2, h3, a[data-click-id="body"], .title');
                if (titleElement && checkContentForKeywords(titleElement)) {
                    containsKeywordToHide = true;
                }
                
                if (!containsKeywordToHide) {
                    const contentElement = post.querySelector('.post-content, .md-container, p');
                    if (contentElement && checkContentForKeywords(contentElement)) {
                        containsKeywordToHide = true;
                    }
                }
            }
            
            if (containsKeywordToHide) {
                post.classList.add('reddit-banned');
                removeElementAndRelated(post);
            }
        }
    }

    function filterPostsByContent() {
        if (isPostPage()) return;
        
        const posts = document.querySelectorAll('article:not(.reddit-processed), shreddit-post:not(.reddit-processed)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            post.classList.add('reddit-processed');
            
            let hasBannedContent = false;
            
            if (isElementFromAdultSubreddit(post)) {
                hasBannedContent = true;
            }
            
            if (!hasBannedContent && checkContentForKeywords(post)) {
                hasBannedContent = true;
            }
            
            if (hasBannedContent) {
                post.classList.add('reddit-banned');
                removeElementAndRelated(post);
            }
        }
    }

    function checkForAdultContentTag() {
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    // --- OPTIMIZED SEARCH FILTERING FUNCTIONS ---
    function hideBannedSubredditsFromSearch() {
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
            
            if (item.classList.contains('text-category-nsfw') || 
                (item.textContent && item.textContent.trim().toUpperCase() === "NSFW")) {
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                }
                continue;
            }
            
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const textContent = item.textContent || '';
            const label = ariaLabel + ' ' + textContent;
            
            if (isSubredditNameBanned(label)) {
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                } else if (item.parentElement) {
                    item.parentElement.style.display = 'none';
                } else {
                    item.style.display = 'none';
                }
            } else {
                item.classList.add('reddit-search-approved');
                let parent = item.closest('li[role="presentation"], li, a, div');
                if (parent) parent.classList.add('reddit-search-approved');
            }
        }
    }

    function processShadowSearchItems(root) {
        if (!root || !root.querySelectorAll) return;
        
        const searchItems = root.querySelectorAll('li[role="presentation"], div[role="presentation"], li, a[role="option"], div[data-testid="search-dropdown-item"]');
        
        for (let i = 0; i < searchItems.length; i++) {
            const item = searchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            const text = item.textContent || '';
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const fullText = text + ' ' + ariaLabel;
            
            let hasNSFWBadge = false;
            const spans = item.querySelectorAll('span, div');
            for (let j = 0; j < spans.length && !hasNSFWBadge; j++) {
                if (spans[j].textContent && spans[j].textContent.trim().toUpperCase() === 'NSFW') {
                    hasNSFWBadge = true;
                }
            }
            
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
            
            if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                shadowRootsProcessed.add(node.shadowRoot);
                processShadowSearchItems(node.shadowRoot);
                
                const shadowObserver = new MutationObserver(throttledShadowRootHandler);
                shadowObserver.observe(node.shadowRoot, { 
                    childList: true, 
                    subtree: true,
                    attributes: false,
                    characterData: false
                });
                
                const shadowChildren = node.shadowRoot.querySelectorAll('*');
                for (let i = 0; i < shadowChildren.length; i++) {
                    processShadowRoots(shadowChildren[i]);
                }
            }
            
            if (node.children) {
                for (let i = 0; i < node.children.length; i++) {
                    processShadowRoots(node.children[i]);
                }
            }
        }
        
        hideBannedSubredditsFromSearch();
        
        if (document.body) {
            processShadowRoots(document.body);
        }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            processShadowRoots(searchDropdowns[i]);
        }
    }

    const throttledShadowRootHandler = throttle((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    processShadowSearchItems(mutation.target);
                    
                    if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                        shadowRootsProcessed.add(node.shadowRoot);
                        processShadowSearchItems(node.shadowRoot);
                    }
                }
            }
        }
    }, 100);

    function observeSearchDropdown() {
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
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            const dropdown = searchDropdowns[i];
            if (dropdown.__searchObserved) continue;
            dropdown.__searchObserved = true;
            
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
                    window.location.replace('https://www.reddit.com');
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
                    window.location.replace('https://www.reddit.com');
                }
            });
            searchForm.__filterListener = true;
        }
    }

    function checkUrlForKeywordsToHide() {
        if (isSafeSubredditUrl()) return;
        
        const currentUrl = window.location.href.toLowerCase();
        
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (currentUrl.includes(keywordsToHide[i].toLowerCase())) {
                if (!isUrlAllowed()) {
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }
        }
        
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(currentUrl)) {
                if (!isUrlAllowed()) {
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }
        }
    }

    function clearRecentPages() {
        try {
            const recentPagesStore = localStorage.getItem('recent-subreddits-store');
            if (!recentPagesStore) return;
            
            let recentPages;
            try {
                recentPages = JSON.parse(recentPagesStore);
            } catch (parseError) {
                localStorage.setItem('recent-subreddits-store', '[]');
                return;
            }
            
            if (!Array.isArray(recentPages)) {
                localStorage.setItem('recent-subreddits-store', '[]');
                return;
            }
            
            const filteredPages = [];
            for (let i = 0; i < recentPages.length; i++) {
                const page = recentPages[i];
                if (typeof page === 'string' && !isSubredditNameBanned(page)) {
                    filteredPages.push(page);
                } else if (typeof page !== 'string') {
                    filteredPages.push(page);
                }
            }
            
            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
        } catch (e) {
            try {
                localStorage.setItem('recent-subreddits-store', '[]');
            } catch (storageError) {
                // Handle localStorage errors
            }
        }
    }

    function hideRecentCommunitiesSection() {
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
        
        try {
            localStorage.setItem('recent-subreddits-store', '[]');
        } catch (e) {
            // Handle localStorage errors
        }
    }

    function checkAndHideNSFWClassElements() {
        const nsfwClasses = ['NSFW', 'nsfw-tag', 'nsfw-content'];
        for (let i = 0; i < nsfwClasses.length; i++) {
            const elements = document.querySelectorAll(`.${nsfwClasses[i]}`);
            for (let j = 0; j < elements.length; j++) {
                removeElementAndRelated(elements[j]);
            }
        }
    }

    function removeHrElements() {
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        for (let i = 0; i < hrElements.length; i++) {
            hrElements[i].remove();
        }
    }

    function removeSelectorsToDelete() {
        for (let i = 0; i < selectorsToDelete.length; i++) {
            const elements = document.querySelectorAll(selectorsToDelete[i]);
            for (let j = 0; j < elements.length; j++) {
                removeElementAndRelated(elements[j]);
            }
        }
    }

    function processShadowDOM() {
        const elements = document.querySelectorAll('shreddit-post, shreddit-feed, shreddit-comments');
        
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!element.shadowRoot || shadowRootsProcessed.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            for (let j = 0; j < posts.length; j++) {
                const post = posts[j];
                if (processedElements.has(post)) continue;
                processedElements.add(post);
                
                if (isPostPage()) continue;
                
                if (checkContentForKeywords(post) || isElementFromAdultSubreddit(post)) {
                    post.classList.add('reddit-banned');
                    post.remove();
                }
            }
            
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
        const now = performance.now();
        if (now - lastFilterTime < 100) return;
        lastFilterTime = now;
        
        checkAndRedirectFromAnswers();
        checkAndRedirectFromPreferences();
        hideAnswersButton();
        
        if (isRedditPreferencesPage() && !isRedditAccountPage()) {
            hideContentSettings();
            forceNSFWDisabled();
        }
        
        if (isSearchResultsPage()) {
            hideNSFWSearchElements();
            filterSearchResultPosts();
        }
        
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
        observeSearchDropdown();
        processShadowDOM();
        
        filterAdultSubredditPostsAndComments();
        hideKeywordPosts();
        filterPostsByContent();
        
        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            hideSubredditPosts();
            checkForAdultContentTag();
            checkUrlForKeywordsToHide();
            clearRecentPages();
            hideRecentCommunitiesSection();
        }
        
        removeHrElements();
        removeSelectorsToDelete();
        checkAndHideNSFWClassElements();
    }

    // --- INITIALIZATION AND EVENT HANDLING ---
    function init() {
        checkAndRedirectFromAnswers();
        checkAndRedirectFromPreferences();
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        runAllChecks();
        
        const throttledRunChecks = throttle(runAllChecks, 150);
        const observer = new MutationObserver(throttledRunChecks);
        
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }
        
        setInterval(hideAnswersButton, 100);
        setInterval(hideAnswersButton, 500);
        setInterval(hideAnswersButton, 1000);
        
        if (isRedditPreferencesPage() && !isRedditAccountPage()) {
            setInterval(hideContentSettings, 100);
            setInterval(hideContentSettings, 500);
            setInterval(hideContentSettings, 1000);
            setInterval(forceNSFWDisabled, 200);
            setInterval(forceNSFWDisabled, 1000);
            setTimeout(hideContentSettings, 50);
            setTimeout(hideContentSettings, 100);
            setTimeout(hideContentSettings, 500);
            setTimeout(hideContentSettings, 1000);
            setTimeout(forceNSFWDisabled, 100);
            setTimeout(forceNSFWDisabled, 500);
        }
        
        if (isSearchResultsPage()) {
            setInterval(hideNSFWSearchElements, 500);
            setInterval(filterSearchResultPosts, 1000);
        }
        
        setInterval(hideBannedSubredditsFromSearch, 1000);
        
        if (window.requestIdleCallback) {
            const idleCallback = () => {
                if (document.hidden) {
                    runAllChecks();
                } else {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                    
                    if (isRedditPreferencesPage() && !isRedditAccountPage()) {
                        hideContentSettings();
                        forceNSFWDisabled();
                    }
                    
                    if (isSearchResultsPage()) {
                        hideNSFWSearchElements();
                        setTimeout(filterSearchResultPosts, 200);
                    }
                }
                
                window.requestIdleCallback(idleCallback, { timeout: 2000 });
            };
            
            window.requestIdleCallback(idleCallback, { timeout: 2000 });
        } else {
            setInterval(() => {
                batchProcess(() => {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                    
                    if (isRedditPreferencesPage() && !isRedditAccountPage()) {
                        hideContentSettings();
                        forceNSFWDisabled();
                    }
                    
                    if (isSearchResultsPage()) {
                        hideNSFWSearchElements();
                        setTimeout(filterSearchResultPosts, 200);
                    }
                });
            }, 2000);
        }
        
        setInterval(() => {
            if (contentBannedCache.size > 1000) {
                contentBannedCache.clear();
            }
            if (bannedSubredditCache.size > 1000) {
                bannedSubredditCache.clear();
            }
        }, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    const processNewElements = throttle((mutations) => {
        let needsSearchUpdate = false;
        let needsContentSettingsUpdate = false;
        let needsNSFWSearchUpdate = false;
        
        for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            
            checkAndRedirectFromAnswers();
            checkAndRedirectFromPreferences();
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
            }
            
            if (isRedditPreferencesPage() && !isRedditAccountPage() && mutation.target.textContent) {
                const textContent = mutation.target.textContent;
                if (textContent.includes('Show mature content') ||
                    textContent.includes('Blur mature') ||
                    textContent.includes("I'm over 18") ||
                    textContent.includes('Content')) {
                    needsContentSettingsUpdate = true;
                }
            }
            
            if (isSearchResultsPage() && mutation.target.textContent) {
                const textContent = mutation.target.textContent;
                if (textContent.includes('NSFW search results') ||
                    textContent.includes('NSFW filter') ||
                    textContent.includes('Safe search')) {
                    needsNSFWSearchUpdate = true;
                }
            }
            
            for (let j = 0; j < mutation.addedNodes.length; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType !== 1) continue;
                
                if (node.tagName === 'A' && (node.getAttribute('href') === '/answers/' || 
                    node.getAttribute('href') === '/answers' || 
                    (node.getAttribute('href') && node.getAttribute('href').includes('/answers')))) {
                    if (!node.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                        hideAnswersButton();
                    }
                }
                
                if (node.tagName === 'FACEPLATE-TRACKER' || 
                    (node.querySelector && (node.querySelector('faceplate-tracker[noun="gen_guides_sidebar"]') ||
                                         node.querySelector('a[href="/answers/"]') ||
                                         node.querySelector('a[href="/answers"]') ||
                                         node.querySelector('a[href*="/answers"]') ||
                                         node.querySelector('svg[icon-name="answers-outline"]')))) {
                    if (!node.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header')) {
                        hideAnswersButton();
                    }
                }
                
                if (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST') {
                    if (!processedElements.has(node)) {
                        processedElements.add(node);
                        
                        if (!isPostPage() && (checkContentForKeywords(node) || isElementFromAdultSubreddit(node))) {
                            node.classList.add('reddit-banned');
                            removeElementAndRelated(node);
                        }
                    }
                } else if (node.hasAttribute && (
                    node.hasAttribute('role') || 
                    node.hasAttribute('data-testid') || 
                    node.classList.contains('recent-search-item')
                )) {
                    needsSearchUpdate = true;
                }
                
                if (isRedditPreferencesPage() && !isRedditAccountPage() && node.hasAttribute && 
                    (node.hasAttribute('data-testid') && 
                    (node.getAttribute('data-testid') === 'is-nsfw-shown' || 
                     node.getAttribute('data-testid') === 'safe-browsing-mode' ||
                     node.getAttribute('data-testid') === 'enable-feed-recommendation' ||
                     node.getAttribute('data-testid') === 'muted-communities'))) {
                    needsContentSettingsUpdate = true;
                }
                
                if (isRedditPreferencesPage() && !isRedditAccountPage() && node.textContent && 
                    !node.closest('nav, header, [role="navigation"], [role="banner"], shreddit-header, aside')) {
                    const textContent = node.textContent;
                    if (textContent.includes('Show mature content') ||
                        textContent.includes('Blur mature') ||
                        textContent.includes("I'm over 18") ||
                        textContent.includes('Not Safe for Work') ||
                        textContent.includes('Show recommendations in home feed') ||
                        textContent.includes('Muted communities') ||
                        (textContent.trim() === 'Content' && node.tagName === 'H2')) {
                        setTimeout(hideContentSettings, 50);
                        setTimeout(forceNSFWDisabled, 100);
                    }
                }
                
                if (isSearchResultsPage() && 
                    (node.tagName === 'SEARCH-BANNER' || 
                     node.tagName === 'SEARCH-TELEMETRY-TRACKER' ||
                     node.tagName === 'SEARCH-SORT-DROPDOWN-MENU')) {
                    needsNSFWSearchUpdate = true;
                }
                
                if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                    shadowRootsProcessed.add(node.shadowRoot);
                    processShadowSearchItems(node.shadowRoot);
                    
                    const shadowObserver = new MutationObserver(throttledShadowRootHandler);
                    shadowObserver.observe(node.shadowRoot, {
                        childList: true,
                        subtree: true,
                        attributes: false,
                        characterData: false
                    });
                }
                
                if (node.querySelectorAll) {
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
        
        if (needsSearchUpdate) {
            batchProcess(() => {
                hideBannedSubredditsFromSearch();
                hideBannedSubredditsFromAllSearchDropdowns();
            });
        }
        
        if (needsContentSettingsUpdate) {
            setTimeout(hideContentSettings, 50);
            setTimeout(hideContentSettings, 100);
            setTimeout(forceNSFWDisabled, 75);
        }
        
        if (needsNSFWSearchUpdate) {
            setTimeout(hideNSFWSearchElements, 100);
        }
        
        hideAnswersButton();
        hideNSFWSearchElements();
        
        if (isRedditPreferencesPage() && !isRedditAccountPage()) {
            setTimeout(hideContentSettings, 100);
            setTimeout(forceNSFWDisabled, 150);
        }
    }, 100);

    const observer = new MutationObserver(processNewElements);
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    hideBannedSubredditsFromSearch();
    hideBannedSubredditsFromAllSearchDropdowns();
    
    if (isRedditPreferencesPage() && !isRedditAccountPage()) {
        hideContentSettings();
        forceNSFWDisabled();
        setTimeout(hideContentSettings, 50);
        setTimeout(hideContentSettings, 100);
        setTimeout(hideContentSettings, 500);
        setTimeout(forceNSFWDisabled, 100);
        setTimeout(forceNSFWDisabled, 300);
        setTimeout(forceNSFWDisabled, 1000);
    }
    
    if (isSearchResultsPage()) {
        hideNSFWSearchElements();
        setTimeout(hideNSFWSearchElements, 500);
        setTimeout(hideNSFWSearchElements, 1000);
    }

    let currentUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            
            checkAndRedirectFromAnswers();
            checkAndRedirectFromPreferences();
            hideAnswersButton();
            
            if (isRedditPreferencesPage() && !isRedditAccountPage()) {
                setTimeout(hideContentSettings, 50);
                setTimeout(hideContentSettings, 100);
                setTimeout(hideContentSettings, 500);
                setTimeout(forceNSFWDisabled, 100);
                setTimeout(forceNSFWDisabled, 300);
                setTimeout(forceNSFWDisabled, 1000);
            }
            
            if (isSearchResultsPage()) {
                setTimeout(hideNSFWSearchElements, 200);
                setTimeout(filterSearchResultPosts, 500);
            }
            
            setTimeout(interceptSearchFormSubmit, 1000);
        }
    }, 200);

})();