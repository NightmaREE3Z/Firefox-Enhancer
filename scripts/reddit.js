(function () {
    'use strict';

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        console.log('[REDDIT.JS]', message);
    }

    // --- IMMEDIATE PRE-HIDING CSS (Applied before any content loads) ---
    function addPreHidingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Hide ALL posts immediately until approved */
            article:not(.reddit-approved),
            shreddit-post:not(.reddit-approved),
            [subreddit-prefixed-name]:not(.reddit-approved) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Show only approved content */
            article.reddit-approved,
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
            article.prehide, shreddit-post.prehide, [subreddit-prefixed-name].prehide {
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
            shreddit-post:not(.reddit-approved) img,
            [subreddit-prefixed-name]:not(.reddit-approved) img {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            article.reddit-approved img, 
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
        article.prehide, shreddit-post.prehide {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: none !important;
        }
        body.reddit-filter-ready article:not(.prehide),
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

    // --- PREFERENCES REDIRECT ---
    function checkAndRedirectFromPreferences() {
        if (window.location.href.includes('reddit.com/settings/preferences')) {
            window.location.href = 'https://www.reddit.com/settings/';
        }
    }

    checkAndRedirectFromPreferences();

    const allowedUrls = [
        "https://www.reddit.com/user/NightmaREE3Z/"
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
        "porn", "nude", "Alexa", "penetration", "naked", "xxx", "rule34", "r34", "r_34", "rule 34", "ChatGPT", "get hard", "Vince Russo", "Dave Meltzer",
        "deepnude", "nudify", "nudifier", "nudifying", "nudity", "undress", "undressing", "undressifying", "undressify", "getdisciplined", "Mariah",
        "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley", "Cameron", "Hayter", "Britt Baker", "Ripley", "Rhea Ripley", "Mariah May", "Blake",
        "trans", "transvestite", "queer", "LGBT", "LGBTQ", "Pride", "Jessika Carr", "Carr WWE"," Jessica Carr", "Jessika Karr", "Jessika WWE", "sexy", "Monroe",
        "prostitute", "escort", "fetish", "adult", "erotic", "explicit", "mature", "blowjob", "sexual", "Jessica WWE", "Jessica Karr", "Analsex", "orgasm",
        "vagina", "pussy", "tushy", "tushi", "genital", "vagena", "booty", "derriere", "busty", "slut", "Karr WWE", "CJ Lana", "raped", "orga5m", "org@sm", 
        "whore", "camgirl", "celeb", "cumslut", "Tiffany Stratton", "Lillian", "Garcia", "Jordynne", "Trish", "Stratus", "Lana Del Rey", "orga$m", "0rg@sm", 
        "DeepSeek", "DeepSeek AI", "nudyi", "ai app", "onlyfans", "fantime", "fansly", "justforfans", "patreon", "CJ Perry", "Lana Perry", "orga5m", "org@5m", 
        "manyvids", "chaturbate", "myfreecams", "cam4", "fat fetish", "camsoda", "stripchat", "bongacams", "livejasmin", "Lana WWE", "Mandy", "0rgasm", "org@sm",  
        "WWE woman", "WWE women", "WWE Xoxo", "Liv Xoxo", "Xoxo", "Chelsey", "Chelsea", "Piper Niven", "Hardwell", "Indi WWE", "Del Rey", "Del Ray", "breast",
        "amateur", "alexa", "bliss", "alexa bliss", "her ass", "she ass", "her's ass", "hers ass", "venice", "Alexa WWE", "5 feet of fury", "Morgan Xoxo", "0rga$m", 
        "Tiffany Stratton", "Tiffy time", "Stratton", "Tiffany", "Mandy Rose", "Chelsea Green", "Zelina", "Zelina Vega", "Valhalla", "poses", "posing", "vagene",
        "IYO SKY", "Io Shirai", "Iyo Shirai", "IO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Meiko", "Satomura", "playboy", "Dynamite", "jizz", "Sportskeeda",
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge", "jizzed", "Torrie", "Sasha", 
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina WWE", "Melina wrestler", "Jillian Hall", "five feet of fury", "Rampage", "raepd", "Wilson",
        "Mickie James", "Maria", "Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess", "Rampaige", "breasts", "Liv Xoxo",
        "Madison Rayne", "Velvet Sky", "Angelina", "filmora", "wondershare", "Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX", "Sweeney", "Mickie", "Mercedes",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Vaquer", "Vaqueer", "Vaguer", "Vagueer", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", 
        "Nightingale", "Statlander", "Hikaru Shida", "Riho", "Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", "Fatal Influence", "Aubert", "*ape", "Brooke", "Hikaru", "Roxanne", 
        "Penelope", "Shotzi", "Blackheart", "Tegan", "Charlotte", "Kamifuku", "Charlotte", "Sarray", "Xia Li", "OperaGX", "Sky Wrestling", "steph", "r*pe", "Opera Browser", 
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Alicia", "Atout", "stephanie", "ra*e", "nofap", "No nut",
        "Stephanie", "Thekla", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Renee", "rap*", "Sasha Banks", 
        "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Izzi Dame", "Alba Fyre", "Isla Dawn", "Tamina", "Sydney", "Gina Adams", "Kelly2", "Russo", 
        "Raquel Rodriguez", "Scarlett", "Bordeaux", "Kayden", "Carter", "Katana Chance", "Valkyria", "Tamina Snuka", "Renee Young", "Sydney Sweeney", "Priscilla", "0rg@5m",
        "Roxanne Perez", "Indi Hartwell", "Hartwell", "Blair", "Davenport", "wonder share", "Lola Vice", "Maxxine Dupri", "Karmen", "Karmen Petrovic", "Brittany", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum", "Paxley", "Fallon Henley", "Sky wrestle", "Women's", "Women", "venoisi",  "rawdog", "rawdogging", 
        "Kelani Jordan", "Electra", "Wendy Choo", "Yulisa", "Valentina", "Valentine", "Amari Miller", "Sky WWE", "Woman", "Lady", "Girls", "Girl's", "venoise", "AlexaBliss", 
        "Sol Ruca", "lexi", "AlexaPearl", "Arianna", "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW", "Woman's", "Lady's", "Girl's", "HorizonMW", "Horizon MW",
	"Horizon Modern Warfare", "HorizonModern", "HorizonWarfare", "Horizon ModernWarfare", "Diffusion", "StableDiffusion", "UnStableDiffusion", "Dreambooth", "Dream booth", "comfyui"
    ];

    const redgifsKeyword = "www.redgifs.com";

    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro", "r/AlexaBliss", "r/AlexaPearl", "r/comfyui"
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
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i, /seksi/i,
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /seksi kuvia/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synth/i,
        /Margot/i, /Robbie/i, /Johansson/i, /Ana de Armas/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /panee/i, /panev/i,
        /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimis/i, /Stratusfaction/i, /yhdynnässä/i, /seksivideo/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i,
        /pano kuva/i, /panokuvat/i, /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpi/i,
        /sormetus/i, /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkky/i, 
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuissivusto/i, /homo/i, /lesbo/i, /transu/i, /pervo/i, /5yvä/i, /\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /face plus/i,  /face\+/i, /face+/i, /face\-/i,
        /bg remover/i, /lexi/i, /\bMina\b/i, /Shir/i, /kawa/i, /perver/i, /Mariah/i, /\bAva\b/i, /\bAnal-\b/i, /\b-Anal\b/i, /\bAnal\b/i, /\bCum\b/i, /\bNox\b/i, /\bButt\b/i, /\bNiven\b/i, /\bODB\b/i,
        /\bAnswers BETA\b/i, /\bFuku\b/i, /\bDick\b/i, /\bCock\b/i, /\bCock\b/i, /\bRape\b/i, /\bEmma\b/i, /\bIndi\b/i, /\bTegan\b/i, /\bGirl\b/i, /\bPenis\b/i, /\bLady\b/i, /\bAnus\b/i, /\bNSFW\b/i, 
	/\bsex\b/i, /\bAdult\b/i, /\bB-Fab\b/i, /Elayna/i, /Eleyna/i, /Eliyna/i, /Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elina WWE/i, /Elyna WWE/i, /Elyina/i, /Aikusviihde/i, /Aikus viihde/i, 
	/Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i,  /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, 
	/topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, /softorbit/i, /softorbits/i, /soft-orbit/i, 
	/soft-orbits/i, /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper-v/i,
	/VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, /OracleVM/i, 
	/virtualmachine/i, /virtual machine/i, /virtuaalikone/i, /virtuaali kone/i, /virtuaali tietokone/i, /virtuaalitietokone/i, /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, /virtuaali masiina/i, 
	/virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, 
	/hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i, 
	/vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /virtmachine/i, /virt-machine/i, /virtumachine/i, /vir mach/i,
	/virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, /\bMachiene\b/i, /vi mach/i, /virtual machi/i,
	/virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /birppis/i, /irpp4/i, /b1rppis/i, /birpp1s/i, /b1rpp1s/i, /comfyui/i,
	/comfy ui/i, /comfy ai/i, /comfyai/i, /comfy-ui/i, /comfy-ai/i, /comfy-ai/i,
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
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap",
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
        'div > faceplate-tracker:nth-child(4) > li > a',
    ];

    // --- OPTIMIZED MEMORY MANAGEMENT FOR ORIGINAL REDDIT PERFORMANCE ---
    // Memory caps designed to keep usage close to original Reddit (5-8GB)
    const MEMORY_CAP_GB = 8; // Hard cap at 8GB
    const MEMORY_WARNING_GB = 6; // Warning at 6GB
    const MAX_CACHE_SIZE = 100; // Increased for better performance but manageable
    const MAX_APPROVAL_PERSISTENCE = 50; // Increased for better user experience
    const CLEANUP_INTERVAL = 30000; // 30 seconds cleanup time
    const MEMORY_CHECK_INTERVAL = 15000; // Check memory every 15 seconds
    const CRITICAL_MEMORY_THRESHOLD = 0.85; // 85% of heap limit

    // Lightweight caches - minimal memory footprint with WeakSet/WeakMap for automatic cleanup
    const processedElements = new WeakSet();
    const processedSearchItems = new WeakSet();
    const bannedSubredditCache = new Map();
    const contentBannedCache = new Map();
    const shadowRootsProcessed = new WeakSet();
    const permanentlyApprovedElements = new WeakSet();
    const approvalPersistence = new Map();
    const eventListenersAdded = new WeakSet();

    // Tracking for cleanup with automatic disposal
    const intervalIds = new Set();
    const observerInstances = new Set();
    const mutationObservers = new WeakMap();

    let lastFilterTime = 0;
    let pendingOperations = false;
    let memoryCleanupCount = 0;
    let lastMemoryWarning = 0;
    let isCleaningUp = false;

    // Memory monitoring optimized for Reddit-like performance
    function getMemoryUsage() {
        if (performance.memory) {
            const memInfo = performance.memory;
            const usedGB = memInfo.usedJSHeapSize / (1024 * 1024 * 1024);
            const limitGB = memInfo.jsHeapSizeLimit / (1024 * 1024 * 1024);
            const percentage = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
            
            return {
                usedGB: Math.round(usedGB * 100) / 100,
                limitGB: Math.round(limitGB * 100) / 100,
                percentage: Math.round(percentage * 100),
                usedMB: Math.round(memInfo.usedJSHeapSize / (1024 * 1024)),
                limitMB: Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024))
            };
        }
        return null;
    }

    // Enhanced cache cleanup with better memory leak prevention
    function cleanupCaches(force = false) {
        if (isCleaningUp) return;
        isCleaningUp = true;
        
        try {
            const memInfo = getMemoryUsage();
            const isOverCap = memInfo ? memInfo.usedGB > MEMORY_CAP_GB : false;
            const isWarning = memInfo ? memInfo.usedGB > MEMORY_WARNING_GB : false;
            const isCritical = memInfo ? memInfo.percentage > CRITICAL_MEMORY_THRESHOLD * 100 : false;
            
            if (force || isOverCap || isCritical) {
                // Aggressive cleanup when over cap
                const beforeContent = contentBannedCache.size;
                const beforeSubreddit = bannedSubredditCache.size;
                const beforeApproval = approvalPersistence.size;
                
                contentBannedCache.clear();
                bannedSubredditCache.clear();
                
                // Keep only last 15 approvals when critical
                if (isCritical || isOverCap) {
                    const entries = Array.from(approvalPersistence.entries()).slice(-15);
                    approvalPersistence.clear();
                    entries.forEach(([key, value]) => approvalPersistence.set(key, value));
                }
                
                // Clean up any stale observers
                observerInstances.forEach(observer => {
                    try {
                        if (observer && typeof observer.disconnect === 'function') {
                            observer.disconnect();
                        }
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                });
                
                if (memInfo) {
                    devLog(`🧹 MEMORY CAP CLEANUP - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB | Cleared: Content(${beforeContent}), Subreddit(${beforeSubreddit}), Approval(${beforeApproval}→${approvalPersistence.size})`);
                }
                
            } else if (isWarning || contentBannedCache.size > MAX_CACHE_SIZE || bannedSubredditCache.size > MAX_CACHE_SIZE) {
                // Gentle cleanup when approaching limits
                if (contentBannedCache.size > MAX_CACHE_SIZE) {
                    const entries = Array.from(contentBannedCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.7));
                    contentBannedCache.clear();
                    entries.forEach(([key, value]) => contentBannedCache.set(key, value));
                }
                if (bannedSubredditCache.size > MAX_CACHE_SIZE) {
                    const entries = Array.from(bannedSubredditCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.7));
                    bannedSubredditCache.clear();
                    entries.forEach(([key, value]) => bannedSubredditCache.set(key, value));
                }
                if (approvalPersistence.size > MAX_APPROVAL_PERSISTENCE) {
                    const entries = Array.from(approvalPersistence.entries()).slice(-Math.floor(MAX_APPROVAL_PERSISTENCE * 0.8));
                    approvalPersistence.clear();
                    entries.forEach(([key, value]) => approvalPersistence.set(key, value));
                }
                
                if (memInfo) {
                    devLog(`🧹 Gentle cleanup - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB (${memInfo.percentage}%)`);
                }
            }

            memoryCleanupCount++;
            
            // Force garbage collection only when necessary
            if (window.gc && (force || isOverCap || memoryCleanupCount % 10 === 0)) {
                try {
                    window.gc();
                    const afterMemInfo = getMemoryUsage();
                    if (afterMemInfo && memInfo) {
                        devLog(`🗑️ GC - Memory: ${afterMemInfo.usedGB}GB (was ${memInfo.usedGB}GB)`);
                    }
                } catch (e) {
                    // Ignore GC errors
                }
            }
        } finally {
            isCleaningUp = false;
        }
    }

    // Memory pressure monitoring optimized for Reddit performance
    function monitorMemoryPressure() {
        const memInfo = getMemoryUsage();
        if (!memInfo) return;
        
        const now = Date.now();
        
        if (memInfo.usedGB > MEMORY_CAP_GB) {
            if (now - lastMemoryWarning > 15000) { // Only warn every 15 seconds
                devLog(`🚨 MEMORY CAP EXCEEDED: ${memInfo.usedGB}GB > ${MEMORY_CAP_GB}GB - FORCING CLEANUP`);
                lastMemoryWarning = now;
            }
            cleanupCaches(true);
            
        } else if (memInfo.usedGB > MEMORY_WARNING_GB) {
            if (now - lastMemoryWarning > 45000) {
                devLog(`⚠️ Memory warning: ${memInfo.usedGB}GB / ${MEMORY_CAP_GB}GB cap (${memInfo.percentage}% of heap)`);
                lastMemoryWarning = now;
            }
            cleanupCaches();
        }
    }

    // Enhanced global cleanup function
    function cleanup() {
        devLog('🧹 Performing cleanup...');
        
        // Clear all intervals
        intervalIds.forEach(id => {
            try {
                clearInterval(id);
            } catch (e) {
                // Ignore cleanup errors
            }
        });
        intervalIds.clear();

        // Disconnect all observers
        observerInstances.forEach(observer => {
            try {
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        });
        observerInstances.clear();

        // Force cache cleanup
        cleanupCaches(true);
        
        const memInfo = getMemoryUsage();
        if (memInfo) {
            devLog(`🧹 Cleanup completed - Memory: ${memInfo.usedGB}GB`);
        }
    }

    // Enhanced page visibility cleanup
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cleanupCaches();
            monitorMemoryPressure();
        }
    });

    // Enhanced cleanup before page unload
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    // Check if we're on a single post page (not feed or subreddit)
    function isPostPage() {
        const url = window.location.href;
        return url.includes('/comments/') && !url.includes('/s/') && !url.includes('?') && url.split('/').length >= 7;
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
            const linkElement = icon.closest('a[href="/answers/"]');
            if (linkElement) {
                linkElement.remove();
                continue;
            }
            
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
            
            if (element.hasAttribute('data-answers-processed') || 
                element.textContent.length > 200) continue;
            
            const textContent = element.textContent || '';
            
            if (textContent.includes('Answers') && textContent.includes('BETA')) {
                element.setAttribute('data-answers-processed', 'true');
                
                const parentLink = element.closest('a[href="/answers/"]');
                if (parentLink) {
                    parentLink.remove();
                    continue;
                }
                
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

    // Performance functions with memory monitoring
    function throttle(fn, wait) {
        let lastCall = 0;
        let requestId = null;
        
        return function(...args) {
            const now = performance.now();
            const context = this;
            
            if (now - lastCall >= wait) {
                lastCall = now;
                return fn.apply(context, args);
            } else if (!requestId) {
                requestId = (window.requestIdleCallback || window.requestAnimationFrame)(() => {
                    requestId = null;
                    lastCall = performance.now();
                    return fn.apply(context, args);
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
            
            if (callNow) return fn.apply(context, args);
        };
    }

    function batchProcess(fn) {
        if (pendingOperations) return;
        pendingOperations = true;
        
        requestAnimationFrame(() => {
            try {
                fn();
            } finally {
                pendingOperations = false;
            }
        });
    }

    // Optimized text checking with memory-conscious caching
    function checkTextForKeywords(textContent) {
        if (!textContent) return false;
        
        const lowerText = textContent.toLowerCase();
        
        // Check cache first
        if (contentBannedCache.has(lowerText)) {
            return contentBannedCache.get(lowerText);
        }
        
        // Prevent cache from growing too large
        if (contentBannedCache.size >= MAX_CACHE_SIZE) {
            // Keep only most recent entries
            const entries = Array.from(contentBannedCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.7));
            contentBannedCache.clear();
            entries.forEach(([key, value]) => contentBannedCache.set(key, value));
        }
        
        // Check for exact keyword matches (most efficient)
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerText.includes(keywordsToHide[i].toLowerCase())) {
                contentBannedCache.set(lowerText, true);
                if (isPostPage()) {
                    devLog(`Blocked by keyword: "${keywordsToHide[i]}" in text: "${textContent.substring(0, 100)}..."`);
                }
                return true;
            }
        }
        
        // Only check regex patterns if needed (more expensive)
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerText)) {
                contentBannedCache.set(lowerText, true);
                if (isPostPage()) {
                    devLog(`Blocked by regex: ${regexKeywordsToHide[i]} in text: "${textContent.substring(0, 100)}..."`);
                }
                return true;
            }
        }
        
        contentBannedCache.set(lowerText, false);
        return false;
    }

    // Better post identifier that works across feed and post pages
    function getPostIdentifier(element) {
        const postLinks = element.querySelectorAll && element.querySelectorAll('a[href*="/comments/"]');
        if (postLinks && postLinks.length > 0) {
            for (let i = 0; i < postLinks.length; i++) {
                const href = postLinks[i].getAttribute('href');
                if (href) {
                    const match = href.match(/\/comments\/([a-zA-Z0-9]+)/);
                    if (match) {
                        return `post_${match[1]}`;
                    }
                }
            }
        }
        
        if (isPostPage()) {
            const currentUrl = window.location.href;
            const match = currentUrl.match(/\/comments\/([a-zA-Z0-9]+)/);
            if (match) {
                return `post_${match[1]}`;
            }
        }
        
        const permalink = element.getAttribute && element.getAttribute('data-permalink');
        if (permalink) return permalink;
        
        const postId = element.getAttribute && element.getAttribute('data-post-id');
        if (postId) return `post_${postId}`;
        
        const allLinks = element.querySelectorAll && element.querySelectorAll('a[href]');
        if (allLinks) {
            for (let i = 0; i < allLinks.length; i++) {
                const href = allLinks[i].getAttribute('href');
                if (href && href.includes('/r/') && href.includes('/comments/')) {
                    const match = href.match(/\/comments\/([a-zA-Z0-9]+)/);
                    if (match) {
                        return `post_${match[1]}`;
                    }
                }
            }
        }
        
        const subreddit = getSubredditForAnyRedditPost(element);
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, [data-testid="post-content"] h1, [data-testid="post-content"] h2, [data-testid="post-content"] h3');
        const title = titleElement ? titleElement.textContent : '';
        
        if (subreddit && title) {
            return `${subreddit}:${title.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        
        return null;
    }

    function wasElementPreviouslyApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier && approvalPersistence.has(identifier)) {
            if (isPostPage()) {
                devLog(`Post was previously approved: ${identifier}`);
            }
            return approvalPersistence.get(identifier);
        }
        return false;
    }

    function markElementAsApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier) {
            // Prevent approval persistence from growing too large
            if (approvalPersistence.size >= MAX_APPROVAL_PERSISTENCE) {
                const entries = Array.from(approvalPersistence.entries()).slice(-Math.floor(MAX_APPROVAL_PERSISTENCE * 0.8));
                approvalPersistence.clear();
                entries.forEach(([key, value]) => approvalPersistence.set(key, value));
            }
            
            approvalPersistence.set(identifier, true);
            if (isPostPage()) {
                devLog(`Marked post as approved: ${identifier}`);
            }
        }
        element.classList.add('reddit-approved');
        permanentlyApprovedElements.add(element);
    }

    // --- CORE FILTERING FUNCTIONS ---
    function isSubredditNameBanned(subName) {
        if (!subName) return false;
        const lowerSub = subName.toLowerCase();
        
        if (bannedSubredditCache.has(lowerSub)) {
            return bannedSubredditCache.get(lowerSub);
        }
        
        // Prevent cache from growing too large
        if (bannedSubredditCache.size >= MAX_CACHE_SIZE) {
            const entries = Array.from(bannedSubredditCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.7));
            bannedSubredditCache.clear();
            entries.forEach(([key, value]) => bannedSubredditCache.set(key, value));
        }
        
        for (let i = 0; i < adultSubreddits.length; i++) {
            if (lowerSub === adultSubreddits[i].toLowerCase()) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`Blocked by banned subreddit: ${subName}`);
                }
                return true;
            }
        }
        
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerSub.includes(keywordsToHide[i].toLowerCase())) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`Blocked subreddit "${subName}" by keyword: "${keywordsToHide[i]}"`);
                }
                return true;
            }
        }
        
        for (let i = 0; i < regexKeywordsToHide.length; i++) {
            if (regexKeywordsToHide[i].test(lowerSub)) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`Blocked subreddit "${subName}" by regex: ${regexKeywordsToHide[i]}`);
                }
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

    // Enhanced content evaluation function - POSTS ONLY (NO COMMENT FILTERING)
    function evaluateElementForBanning(element) {
        if (permanentlyApprovedElements.has(element) || wasElementPreviouslyApproved(element)) {
            return false;
        }
        
        const identifier = getPostIdentifier(element);
        if (isPostPage() && identifier) {
            devLog(`Evaluating element: ${identifier}`);
        }
        
        if (isElementFromAdultSubreddit(element)) {
            if (isPostPage()) {
                const sub = getSubredditForAnyRedditPost(element);
                devLog(`Blocked by subreddit: ${sub}`);
            }
            return true;
        }
        
        if (checkContentForKeywords(element)) {
            return true;
        }
        
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, a[data-click-id="body"], .title, [slot="title"]');
        if (titleElement && checkContentForKeywords(titleElement)) {
            if (isPostPage()) {
                devLog('Blocked by title content');
            }
            return true;
        }
        
        const contentElement = element.querySelector && element.querySelector('.post-content, .md-container, p, [slot="text-body"], [data-testid="post-content"]');
        if (contentElement && checkContentForKeywords(contentElement)) {
            if (isPostPage()) {
                devLog('Blocked by post content');
            }
            return true;
        }
        
        const nsfwIndicators = element.querySelectorAll && element.querySelectorAll('.nsfw, [data-nsfw="true"], svg[icon-name="nsfw-outline"], .text-category-nsfw');
        if (nsfwIndicators && nsfwIndicators.length > 0) {
            if (isPostPage()) {
                devLog('Blocked by NSFW indicator');
            }
            return true;
        }
        
        if (isPostPage() && identifier) {
            devLog(`Element passed all checks: ${identifier}`);
        }
        
        return false;
    }

    // --- MAIN FILTERING FUNCTIONS (POSTS ONLY - NO COMMENT FILTERING) ---
    function filterAdultSubredditPosts() {
        // Only filter posts, NOT comments
        const postSelectors = [
            'article:not(.prehide):not(.reddit-approved)',
            'shreddit-post:not(.prehide):not(.reddit-approved)', 
            '[subreddit-prefixed-name]:not(.prehide):not(.reddit-approved)'
        ];
        
        for (let selectorIndex = 0; selectorIndex < postSelectors.length; selectorIndex++) {
            const elements = document.querySelectorAll(postSelectors[selectorIndex]);
            
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                if (processedElements.has(element)) continue;
                processedElements.add(element);
                
                if (evaluateElementForBanning(element)) {
                    element.classList.add('prehide', 'reddit-banned');
                    removeElementAndRelated(element);
                } else {
                    markElementAsApproved(element);
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
        const posts = document.querySelectorAll('article:not(.prehide), shreddit-post:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            
            let joinNowFound = false;
            
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
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            if (evaluateElementForBanning(post)) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                markElementAsApproved(post);
            }
        }
    }

    function filterPostsByContent() {
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved), shreddit-post:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            if (evaluateElementForBanning(post)) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                markElementAsApproved(post);
            }
        }
    }

    function checkForAdultContentTag() {
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    // --- SEARCH FILTERING FUNCTIONS ---
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
                observerInstances.add(shadowObserver);
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
            
            observerInstances.add(observer);
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
            
            observerInstances.add(observer);
            observer.observe(dropdown, {
                childList: true,
                subtree: true
            });
        }
    }

    // --- UTILITY FUNCTIONS ---
    function interceptSearchInputChanges() {
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && !eventListenersAdded.has(searchInput)) {
            const inputHandler = debounce(() => {
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
            }, 200);
            
            searchInput.addEventListener('input', inputHandler);
            eventListenersAdded.add(searchInput);
        }
    }

    function interceptSearchFormSubmit() {
        const searchForm = document.querySelector('form[action="/search"]');
        if (searchForm && !eventListenersAdded.has(searchForm)) {
            const submitHandler = (event) => {
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
            };
            
            searchForm.addEventListener('submit', submitHandler);
            eventListenersAdded.add(searchForm);
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
            
            const recentPages = JSON.parse(recentPagesStore);
            if (!Array.isArray(recentPages)) return;
            
            const filteredPages = recentPages.filter(page => {
                if (typeof page !== 'string') return true;
                return !isSubredditNameBanned(page);
            });
            
            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
        } catch (e) {
            console.error("Error clearing recent pages:", e);
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
        const elements = document.querySelectorAll('shreddit-post, shreddit-feed');
        
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!element.shadowRoot || shadowRootsProcessed.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            
            // Process ONLY posts in shadow DOM, NOT comments
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            for (let j = 0; j < posts.length; j++) {
                const post = posts[j];
                if (processedElements.has(post)) continue;
                processedElements.add(post);
                
                if (evaluateElementForBanning(post)) {
                    post.classList.add('prehide', 'reddit-banned');
                    post.remove();
                } else {
                    markElementAsApproved(post);
                }
            }
            
            const shadowObserver = new MutationObserver(throttledShadowRootHandler);
            observerInstances.add(shadowObserver);
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
        if (now - lastFilterTime < 50) return;
        lastFilterTime = now;
        
        if (document.body && !document.body.classList.contains('reddit-filter-ready')) {
            document.body.classList.add('reddit-filter-ready');
        }
        
        hideAnswersButton();
        
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
        observeSearchDropdown();
        
        processShadowDOM();
        
        // Filter ONLY posts, NOT comments
        filterAdultSubredditPosts();
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
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        
        runAllChecks();
        
        const throttledRunChecks = throttle(runAllChecks, 50);
        const observer = new MutationObserver(throttledRunChecks);
        
        if (document.body) {
            observerInstances.add(observer);
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }
        
        const minimalInterval = setInterval(hideBannedSubredditsFromSearch, 500);
        intervalIds.add(minimalInterval);
        
        const answersButtonInterval = setInterval(hideAnswersButton, 50);
        intervalIds.add(answersButtonInterval);
        
        if (window.requestIdleCallback) {
            const idleCallback = () => {
                if (document.hidden) {
                    runAllChecks();
                } else {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                }
                
                window.requestIdleCallback(idleCallback, { timeout: 1000 });
            };
            
            window.requestIdleCallback(idleCallback, { timeout: 1000 });
        } else {
            const backgroundInterval = setInterval(() => {
                batchProcess(() => {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                });
            }, 1000);
            intervalIds.add(backgroundInterval);
        }
        
        // Memory monitoring every 20 seconds
        const memoryMonitorInterval = setInterval(() => {
            monitorMemoryPressure();
        }, MEMORY_CHECK_INTERVAL);
        intervalIds.add(memoryMonitorInterval);
        
        // Cache cleanup every 45 seconds
        const cleanupInterval = setInterval(() => {
            cleanupCaches();
        }, CLEANUP_INTERVAL);
        intervalIds.add(cleanupInterval);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    const processNewElements = throttle((mutations) => {
        let needsSearchUpdate = false;
        
        for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
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
                
                // Process ONLY posts, NOT comments
                if (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST') {
                    if (!processedElements.has(node)) {
                        processedElements.add(node);
                        
                        if (evaluateElementForBanning(node)) {
                            node.classList.add('prehide', 'reddit-banned');
                            removeElementAndRelated(node);
                        } else {
                            markElementAsApproved(node);
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
                    
                    processShadowSearchItems(node.shadowRoot);
                    
                    // Process ONLY posts in shadow DOM, NOT comments
                    const shadowPosts = node.shadowRoot.querySelectorAll('article, shreddit-post');
                    for (let k = 0; k < shadowPosts.length; k++) {
                        const shadowPost = shadowPosts[k];
                        if (!processedElements.has(shadowPost)) {
                            processedElements.add(shadowPost);
                            
                            if (evaluateElementForBanning(shadowPost)) {
                                shadowPost.classList.add('prehide', 'reddit-banned');
                                shadowPost.remove();
                            } else {
                                markElementAsApproved(shadowPost);
                            }
                        }
                    }
                    
                    const shadowObserver = new MutationObserver(throttledShadowRootHandler);
                    observerInstances.add(shadowObserver);
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
        
        hideAnswersButton();
    }, 50);

    const observer = new MutationObserver(processNewElements);
    observerInstances.add(observer);
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    hideBannedSubredditsFromSearch();
    hideBannedSubredditsFromAllSearchDropdowns();

    // URL change detection with optimized memory cleanup
    let currentUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            
            // Gentle cache cleanup on navigation
            cleanupCaches();
            
            const memInfo = getMemoryUsage();
            if (memInfo) {
                devLog(`🔄 URL changed - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB`);
            }
        }
    }, 200);
    intervalIds.add(urlCheckInterval);

})();