// ==UserScript==
// @name         CleanArchives
// @version      2026-06-10
// @description  Redirects specific archive pages (and xcancel.com search) to the appropriate front page when banned terms are detected.
// @match        *://web.archive.org/*
// @match        *://archive.org/*
// @match        *://www.archive.org/*
// @match        *://web.archive.org/web/*
// @match        *://wayback.archive.org/*
// @match        *://xcancel.com/*
// @match        *://www.xcancel.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Always resolve a safe reference to top without throwing on cross-origin
    const safeTop = (() => {
        try { return window.top; } catch { return window; }
    })();

    // Proactively clear legacy once-per-session flag if it exists (prevents permanent suppression)
    try { sessionStorage.removeItem('ARD_REDIRECTED_ONCE'); } catch {}

    // --- Simple in-memory logger for debugging containsAiBoundary / containsForbiddenKeywords ---
    // You can inspect this in the devtools console: window.ARD_LAST_MATCH_DETAIL
    function recordMatchDetail(kind, pattern, text) {
        try {
            const detail = {
                kind,
                pattern,
                sample: String(text || '').slice(0, 260),
                ts: Date.now()
            };
            window.ARD_LAST_MATCH_DETAIL = detail;
            // Also log to console for visibility while debugging:
            // console.debug('ARD match:', detail);
        } catch (e) {
            // swallow
        }
    }

    // Safe helpers for page and context info (avoid cross-origin reads)
    const selfURL = String(window.location.href || '');

    // Decode-helpers: scan raw and decoded URL variants for full coverage (handles %20 etc.)
    const tryDecode = (s) => {
        try { return decodeURIComponent(s); } catch {}
        try { return decodeURI(s); } catch {}
        return s;
    };
    const pageURLLower = selfURL.toLowerCase();
    const pageURLDecodedLower = tryDecode(selfURL).toLowerCase();
    const selfHostLower = String(window.location.hostname || '').toLowerCase();

    const contextHostLower = (() => {
        // Prefer true top hostname if same-origin, otherwise use referrer, else fallback to self
        try {
            if (safeTop === window) return selfHostLower;
            return String(safeTop.location.hostname || '').toLowerCase();
        } catch {
            try {
                if (document.referrer) {
                    return new URL(document.referrer).hostname.toLowerCase();
                }
            } catch {}
            return selfHostLower;
        }
    })();

    // Site helpers (based on the browsing context host, not the frame host)
    const isWaybackSite = () =>
        contextHostLower === 'web.archive.org' || contextHostLower === 'wayback.archive.org';

    const isArchiveOrgSite = () =>
        contextHostLower === 'archive.org' || contextHostLower === 'www.archive.org';

    const isArchiveSite = () => isWaybackSite() || isArchiveOrgSite();

    const isXcancelSite = () =>
        contextHostLower === 'xcancel.com' || contextHostLower === 'www.xcancel.com';

    const getHomeURLForCurrentSite = () => {
        if (isWaybackSite()) return 'https://web.archive.org/';
        if (isArchiveOrgSite()) return 'https://archive.org/';
        if (isXcancelSite()) return 'https://xcancel.com/';
        // Default to Archive (Wayback) home if somehow matched elsewhere
        return 'https://web.archive.org/';
    };

    const getSiteLabel = () => {
        if (isWaybackSite()) return 'Wayback Machine front page';
        if (isArchiveOrgSite()) return 'Archive.org home page';
        if (isXcancelSite()) return 'xcancel.com home page';
        return 'front page';
    };

    // Simple, literal-match redirect: If we are exactly on archive.org root, send to web.archive.org
    const isTopContext = (() => { try { return window.top === window; } catch { return true; } })();
    const isExactRoot = (url) => {
        try {
            const u = new URL(url);
            const noPath = u.pathname === '' || u.pathname === '/';
            const noQuery = !u.search || u.search === '';
            const noHash = !u.hash || u.hash === '';
            return noPath && noQuery && noHash;
        } catch { return false; }
    };

    if (isTopContext && isArchiveOrgSite() && isExactRoot(selfURL)) {
        // Redirect only when it's literally archive.org (or www.archive.org) with no path/query/hash.
        try { safeTop.location.replace('https://web.archive.org/'); } catch { window.location.replace('https://web.archive.org/'); }
        return;
    }

    // Define the terms to search for in the URL
    const terms = [
        "Irpp4", "Bliss", "Tiffany", "Tiffy", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Tegan Nox", "Charlotte Flair", "Becky Lynch", "Michin", "Mia Yim", "WWE Woman", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven",
        "Alba Fyre", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Jordynne", "WWE Women", "WWE Women's", "WWE Divas", "WWE Diva", "Maryse", "Samantha", "Irwin WWE", "Irvin WWE", "Irvin AEW", "Irwin AEW",
        "Candice LeRae", "Nia Jax", "Naomi", "Bianca Belair", "Charlotte", "Flair", "Trish", "Stratus", "MSEdge", "Izzi Dame", "Izzi WWE", "Dame WWE", "play boy", "Young Bucks", "Jackson", "NXT Women's", "AI app", "NXT Woman",
        "Jessika Carr", "Carr WWE", "Jessica Carr", "Jessika Karr", "Karr WWE", "poses", "posing", "Lash Legend", "Jordynne Grace", "Isla Dawn", "editation", "Raquel Rodriguez", "DeepSeek", "Jessika WWE", "Jessica WWE", "Jessica Karr",
        "WWE Dame", "WWE Izzi", "playboy", "deepnude", "undress", "nudify", "nude app", "nudifier", "faceswap", "facemorph", "morph face", "swapface", "Nikki", "Brie", "Opera Browser", "TOR Browser", "TOR-Browser", "TOR-selain",
        "TOR selain", "nudecrawler", "AI edit", "AI edited", "browser", "selain", "Brave-selainta", "Brave-selaimen", "Undress AI", "DeepNude AI", "editing", "Skye Blue", "tarkoitiitko: nudify", "undress-app", "deepnude-app", "nudify-app",
        "Lola Vice", "Vice WWE", "Opera GX", "Sasha Banks", "-selainta", "selaimen", "-selaimen", "Lola WWE", "Alexis", "crotch", "WWE Xoxo", "Morgan Xoxo", "pusy", "pics edit", "pic edit", "pusi", "fappening", "naked",
        "n8ked", "n8k3d", "nak3d", "nud3", "Safari", "vaatteiden poisto", "dreamtime", "dreamtime app", "mature content", "mature site", "adult content", "adult site", "inpaint", "photopea", "fotopea", "Steward", "edit app",
        "picture edit", "Tiffy Time", "picresize", "lunapic", "pixelixe", "gay", "1fy", "!fy", "lfy", "de3p", "OperaGX", "Perez", "photo edit", "d33p", "3ip", "without", "cameltoe", "dreamtime AI", "Joanie", "cleavage",
        "fuck", "rule34", "r34", "r_34", "Rule 34", "image edit", "Rul", "Rul34", "Rul 34", "pic app", "Stewart", "Perze", "Ruca", "Frost AI", "Laurer", "AI Frost", "frost.com", "onlyfans", "only fans", "Elite Wrestling",
        "fantime", "fan time", "okfans", "ifans", "ifan", "Loyalfans", "Loyalfan", "Fansly", "JustForFans", "samuels", "ok fans", "Just for fans", "i fans", "Loyal fans", "Fan sly", "fans only", "Jaida WWE", "face fusion technology", 
        "fan only", "Fan loyal", "Fans loyal", "biscuit booty", "editor app", "Trans", "Kristen", "MS Edge", "Transvestite", "linger", "Baker", "Biscuit Butt", "Birppis", "Birpppis", "deviant art", "upscale", "upscaling",
        "Bella", "sex", "facetune", "face tune", "tuning face", "face tuning", "facetuning", "tuningface", "biscuit ass", "Chyna", "Gina Adams", "bikini", "Kristen Stewart", "biscuit backside", "Sydney Sweeney", "Britt Baker",
        "Deepseek", "shag", "shagged", "fake", "cloth", "Blis", "LGBTQ", "pant", "fat fetish", "Object", "adultcontent", "F4NS", "Carmella", "Adams WWE", "nsfw", "18+", "18 plus", "porn", "penetration", "filmora",
        "xxx", "nudifying", "nudity", "Jaida Parker", "F4N5", "undressing", "undressifying", "generative", "undressify", "Goddess", "Perry WWE", "Toni Storm", "FAN5", "Harley", "Cameron", "Merlio", "Hayter", "Ripley",
        "Rhea Ripley", "Microsoft Edge", "askfm", "ask fm", "CJ WWE", "queer", "Pride", "prostitute", "escort", "fetish", "v1ds", "m4ny", "v1d5", "erotic", "LGBT", "Gina WWE", "blowjob", "Sportskeeda", "whoring",
        "AI Tool", "aitool", "vagina", "genital", "booty", "nudyi", "Nudying", "Nudeying", "derriere", "busty", "slut", "whore", "camgirl", "cumslut", "fury foot", "fury feet", "DeepSeek AI", "fansly", "patreon",
        "manyvids", "chaturbate", "myfreecams", "Samsung Internet", "Policy template", "Templates", "Policies", "onlifans", "camsoda", "stripchat", "bongacams", "livejasmin", "Shirai", "Io Sky", "Sky WWE", "Sky Wrestling",
        "Sky wrestle", "foot fury", "feet fury", "Bleis", "WWE woman", "WWE women", "amateur", "5 feet of fury", "five feet of fury", "Velvet Sky", "onl1", "celeb", "0nl1", "Diipfeikki", "Lana Perry", "Vince Russo", "Russo",
        "Goddess WWE", "Mandy Rose", "Zelina Vega", "Valhalla", "IYO SKY", "Io Shirai", "Iyo Shirai", "Dakota Kai", "Asuka", "Kairi Sane", "jaida", "0nli", "Satomura", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey",
        "Dana Brooke", "Aubrey", "Edwards", "Alicia", "Atout", "Tamina", "Alicia Fox", "Summer Rae", "Layla", "Michelle McCool", "Eve Torres", "Jaida", "Kelly Kelly", "Kelly2", "Kelly 2", "Melina WWE", "Brittany", "Aubert",
        "Renee Paquette", "Parker WWE", "Melina wrestler", "Jillian Hall", "Mickie James", "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly", "Jazz", "Lana Del Rey", "Gail Kim", "Awesome Kong", "Madison Rayne",
        "Velvet Sky", "Angelina", "Brooke", "Tessmacher", "Havok", "Renee", "Britany", "Britanny", "Del Ray", "Su Yung", "Taya Valkyrie", "Deonna", "Purrazzo", "Anna Jay", "Tay Conti", "Tay Melo", "Willow Nightingale", "Noelle",
        "Syväväärennös", "Del Rey", "Lexi", "Hikaru Shida", "Thea Hail", "Yuka", "Sakazaki", "Nyla Rose", "Sakura", "Penelope", "Shotzi", "Miia Yim", "Miia Yam", "CJ Perry", "deviantart", "Mickie", "Micky", "Carolina", "Caroline",
        "Becky", "Lynch", "Bailey", "Giulia", "Mia Yam", "AJ Lee", "Paige", "Piper Niven", "Jaidi", "NXT Womens", "NXT Women", "Uhkapeli", "Alex Windsor", "Uhka peli", "Sunny", "Tessa", "Jakara", "Lash Legend", "Uhkapelaaminen",
        "J41D4", "Ja1d4", "Lana WWE", "Scarlett Bordeaux", "Kayden Carter", "J41da", "Isla Dawn", "B-Fab", "Uhka pelaaminen", "Jaid4", "J4ida", "Lyra Valkyria", "Indi Hartwell", "Blair Davenport", "Maxxine Dupri", "Dave Meltzer",
        "Natalya", "Nattie", "Electra Lopez", "Valentina Feroz", "Amari Miller", "Sol Ruca", "Yulisa Leon", "Arianna", "Matt Jackson", "Nick Jackson", "nadke", "Karmen Petrovic", "Ava Raine", "Cora Jade", "Gamble", "Feikki",
        "Jacy Jayne", "Gigi Dolin", "Tatum WWE", "dress", "Fallon Henley", "Kelani Jordan", "explicit", "AEW", "justforfans", "Katana Chance", "Mercedes", "Gambling", "Renee Young", "anaaliseksi", "Sasha", "Wendy Choo", "f*ckwit",
        "Paxley", "horizonMW", "cam4", "biscuit rear", "d3ep", "Britt", "Mariah", "puzzy", "editing app", "linq", "pussy", "tushy", "Roxanne", "Blies", "CJ Lana", "Statlander", "f*cking", "f*cked", "f*cks", "f*ckup", "f**kery", "f*ckface", 
        "*uck", "f*ck", "fu*k", "fuc*", "f***", "f**k", "**ck", "fuc*k", "f*cked", "f*cker", "f**ked", "f**king", "fu**", "f**", "f****", "f*c*", "*cked", "b*tch", "b**ch", "b****", "b*itch", "*itch", "b*stard", "b**tard", 
        "f*cktard", "f*cker", "f*ckery", "sh*t", "sh*tty", "*hit", "s**t", "sh**", "sh*tfaced", "sh*tbag", "s*cker", "b*stardly", "b*st*rd", "b*st*rds", "b*lls", "c**t", "cu*t", "*unt", "c*nts", "c**ts", "cunt*", "tw*t",
        "*lls", "b*llocks", "b*llsack", "a**", "a*shole", "*sshole", "as*hole", "assh*le", "as**hole", "a**hole", "a**wipe", "a*shat", "b*lls", "p*ssy", "c*nt", "d*ckbag", "d**kface", "sh*thead", "t*t", "*n**r", "d*ckhead", 
        "tw**t", "t*at", "t**t", "p*ss", "p***", "p*ssed", "t*rd", "rawdog", "rawdogging", "raw dogging", "raw dog", "d*ck", "d**k", "di*k", "a*s", "azz", "a*z", "az*", "***", "###", "@@", "#*", "*#", "@*", "*@", "#@", "@#", 
        "*n***r", "m*therf*cker", "m*therfucker", "*ss", "as****", "f*ckface", "f*cktard", "fukk", "fukc", "fu*c", "sheer", "face replace", "photorealistic swap", "synthetic face", "hyperreal", "hyper real", "reface", 
        "face merge", "face blend", "faceblend", "AI face", "neural", "AI morph", "face animation", "deep swap", "swap model", "facereplace", "fylng", "face augmentation", "digital face synthesis", "AI-powered face swap",
        "facefusion", "face reconstruction", "wondershare", "AI face recreation", "virtual morph", "face synthesis", "neural face swap", "deep neural face", "deepface swap", "photo manipulation face", "fy1ng", "Kamifuku",
        "virtual face swap", "hyperreal AI face", "photo-real AI face", "face deepfake", "synthetic portrait generation", "AI image transformation", "ladies", "lady", "cheek", "aasho", "ääsho", "ääshö", "face join", "Shira",
        "deepfak portrait", "machine learning", "generation", "generative", "AI model face swap", "face generation AI", "face replacement AI", "video face morphing", "3D face morph", "AI facial animation", "deepfake avatar",
        "synthetic avatar creation", "facial", "AI model swap", "deep model swap", "image to face morph", "AI character face", "face remapping AI", "synthetic media", "AI-created character face", "face replacement tool", "fy!ng",
        "photo trans", "pict trans", "image trans", "virtual avatar face", "AI video face replacement", "digital face replacement", "hyperreal synthetic face", "AI face transformer", "face generation model", "realistic face",
        "face blend", "virtual reality face", "face tech", "face AI animation", "real-time face swap", "AI-driven photo manipulation", "deepfake model creation", "digital persona", "Blake", "face render", "Thekla", "girl's", "dic*",
        "face overlay", "synthetic person", "facial blending", "face swap", "virtual character face swap", "photorealistic face generator", "face altering AI", "realistic AI swap", "face expression morphing", "video gen", "Monroe",
        "face transformation AI", "virtual human face swap", "synthetic media generation", "3D face recreation", "AI-generated face morph",  "machine-generated face swap", "face image manipulation", "video face animation", 
        "virtual morphing tool", "AI-powered video face swap", "digital face recreation", "AI-based facial replacement", "neural face", "All Elite", "machine learning face generator", "face recognition swap", "AI face animation tool", 
        "synthetic media face", "AI character morphing", "deepfake avatar generation", "photoreal face synthesis", "synthetic face", "n@ked", "onnly", "irc-galleria", "irc galleria", "girl", "girls", "woman", "womans", "La Leona", 
        "facial deep learning", "neural facial expression swap", "hyperrealistic face model", "wonder share", "AI-driven face fusion", "video face deepfake", "face pattern generation", "AI virtual persona swap", "deepface model trans",
        "nekkid", "nudee", "nudy", "noodz", "neude", "nudesz", "fan5ly", "fan-sly", "f4nslie", "f@nsly", "vanice", "vanica", "venica", "deep nuud", "deepnud", "deapnude", "d33pnud3", "f@n", "0nly", "0nlifans", "onlii", "onlifanz",
        "n4ked", "nakid", "nakd", "nakie", "s3x", "sx", "secks", "seggs", "seks", "Erase clothes", "AI uncloth", "Unclothing AI", "Gen AI pics", "text-to-undress", "text2nude", "remove outfit", "undress filter", "persona creation",
        "stripfilter", "clothing eraser", "nudify tool", "leak editor", "Realistic nude gen", "fleshify", "Skinify", "Alex Kaufman", "Lexi Kaufman", "Lexi Bliss", "Tenille Dashwood", "Saraya Knight", "Paige WWE", "Celeste Bonin",
        "Ariane Andrew", "Brianna Monique Garcia", "Stephanie Nicole Garcia", "deepany", "Lana Rusev", "Pamela Martinez", "Ashley Sebera", "Ayesha Raymond", "Marti Belle", "Alisha Edwards", "image2video", "merging two faces", "join face",
        "Nicol", "Garcia", "Nikki Garcia", "Wrestling babe", "Divas hot", "WWE sexy", "spicy site", "deep-any", "for fans", "VIP pic", "premium content", "sussy pic", "after dark", "NSFL", "artistic nude", "tasteful nude", "sus site", 
        "uncensored version", "alt site", "runwayml", "runway", "run way", "runaway", "run away", "replicate.ai", "huggingface", "hugging face", "cloth remover", "AI eraser", "Magic Editor", "magicstudio", "cleanup.pictures", "woman's", 
        "app123", "modapk", "apkmod", "tool hub", "tools hub", "alaston", "alasti", "vaatteeton", "paljas", "seksikäs", "pimppi", "vittu", "tissit", "nänni", "sukupuolielin", "paljain", "seksisivu", "alastomuus", "sus content", "fucking", 
        "aikuissisältö", "aikuissivusto", "seksikuva", "homo", "ndue", "nakde", "lesbo", "transu", "pervo", "face fusion", "🍑", "🍆", "💦", "👅", "🔞", "😈", "👙", "🩲", "👠", "🧼", "🧽", "( . )( . )", "| |", "( o )( o )", "(!)", "bg remover",
        "dick", "cock", "penis", "breast", "thigh", "leggings", "leggins", "venoice", "veniice", "jeans", "jerking", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "imgtovid", "img2vid", "imagetovideo", "face+",
        "her butt", "herbutt", "butth", "butt hole", "assh", "ass h", "buttc", "butt c", "buttcheek", "butt cheek", "poistamis", "vaatteidenpoistaminen", "vaatteiden poistaminen", "facemerg", "facefusi", "face merg", "face fusi", "face plus", 
        "faceplus", "merge two faces", "merge 2 faces", "merging 2 faces", "*wat", "t*at", "twa*", "*unt", "cu*t", "cun*", "*orn", "po*n", "por*", "*eep", "d*ep", "de*p", "dee*", "*ude", "n*de", "nu*e", "nud*", "*udi", "n*di", "nu*i", "n**e", 
        "join two faces", "join 2 faces", "join2faces", "jointwofaces", "fotor", "Toni WWE", "venise", "venoise", "Tony Storm", "off the Sky", "off da skai", "Priscilla", "Kelly", "Erika", "Vikman", "pakara", "pakarat", "Viikman", "Eerika",
        "puss*", "pu*sy", "pus*y", "an*l", "s*x", "s**", "veeniic", "veenice", "**x", "se*", "*ex", "*uck", "s*ck", "d*ck", "c*ck", "f*ck", "fu*k", "fuc*", "*nal", "a*al", "ana*", "*ss", "a*s", "as*", "su*k", "po*n", "por*", "women", "womens", 
        "di*k", "co*k", "suc*", "coc*", "*wat", "t*at", "tw*t", "twa*", "*unt", "c*nt", "cu*t", "cun*", "0rg4", "org4", "*orn", "p*rn", "*eep", "d*ep", "de*p", "dee*", "*ude", "n*de", "nu*e", "nud*", "*udi", "n*di", "nu*i", "n**e", "n**i", "nu**", 
        "*aked", "n*ked", "na*ed", "nak*d", "nake*", "**ked", "n**ed", "na**d", "nak**", "**aked", "n**aked", "n*aked", "d!ck", "d1ck", "dlck", "na**ked", "nak**ed", "nake**d", "*kin", "s*in", "sk*n", "blogspot", "blogger", "birppis", "blog", "fl3sh", 
        "irpp4", "irpppas", "Birbbis", "Birbb", "ski*", "*lesh", "f*esh", "fl*sh", "fle5h", "fle*h", "fles*", "orgasm", "0rgasm", "org@sm", "orga5m", "org@5m", "0rg@sm", "0rga5m", "0rg@5m", "0rg@$m", "org@$m", "0rga$m", "lady's", "ladie's", "women's", 
        "pushpull", "ask.fm", "deepseek", "deepseek ai", "reddit", "/r", "shirakawa", "Alexa", "Alexa Bliss", "sensuel", "shira", "model", "Woman", "Women", "Women's", "Woman's", "AI-generated", "undressed", "Vladimir Putin", "AI model", "deep fake",
        "orga$m", "w4nk", "w4nk3", "*ank", "w*nk", "wa*k", "wan*", "*4nk", "w4*k", "w4n*", "fleshi", "fl35h", "AI generated", "by AI", "clothes", "panties", "panty", "AI art", "bra", "sexy", "Alexa WWE", "deepfake", "ring gear", "Aleksa", "Rodriguez", 
        "lingerie", "Harley Cameron", "trunks", "pants", "underwear", "attire", "Vladimir", "Putin", "Trump", "Saraya", "kuvake", "face +", "HorizonMW", "arxiv"
    ];

    // Define the regex patterns to search for in the URL or content
    const regexTerms = [
        /deepnude/i, /deepfake/i, /lex bl/i, /livmorgan/i, /zelina/i, /roxanne/i, /raquel/i, /stephanie/i, /woman/i, /women/i, /ladies/i, /ladye/i, /girls/i, /girly/i, /girli/i, 
	/pussy/i, /vagin/i, /vagen/i, /vegane/i, /pussie/i, /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /naked/i, /undre/i, 
	/nude app/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i, /generat/i, /inpaint/i, /art intel/i, /birpp/i,  /ismartta/i, /image enhanced/i, /palge/i, 
	/deppn/i, /depenu/i, /depeni/i, /deipn/i, /diepn/i, /artifi/i, /artin/i, /iconicto/i, /-tool/i, /d3ppn/i, /d3penu/i, /d3p3nu/i, /dep3nu/i, /depeni/i,  /d3p3ni/i, /d3p3n1/i, 
	/d3p3n!/i, /dep3n1/i, /dep3n!/i, /d3pen1/i, /d3pen!/i, /Br1tt/i, /Br!tt/i, /Sweee/i, /posing/i, /image enhancing/i, /virtual touchup/i, /ndif/i, /ndfy/i, /nd1f/i, 
	/nd!f/i, /ndlf/i, /shag/i, /5hag/i, /5h4g/i, /sh4g/i, /f4gg/i, /fagg3/i, /fagger/i, /wedgi/i, /wedge/i, /wedgy/i, /wedg1/i, /wedg!/i, /w3dg/i, /w33d/i, /we3d/i, /w3ed/i, 
	/w333d/i, /w3333/i, /we333/i, /w3e33/i, /w33e3/i, /w333e/i, /we33e/i, /we3e3/i, /wee3e/i, /w3e3e/i, /weee/i, /w3333/i, /edgin/i, /3dg1n/i, /edgyi/i, /ed!t/i, /d3peni/i, 
	/soulgen/i, /soulgyn/i, /soulkyn/i, /fapif/i, /fappif/i, /b4ri/i, /striped/i, /v3rc/i, /v3rz/i, /v3rs/i, /v3r5/i, /skirt/i, /skirr/i, /skitr/i, /sk1r/i, /5kir/i, /5k1r/i, 
	/edgy1/i, /3dgy1/i, /3dgin/i, /edg1n/i, /edg1i/i, /edgi1/i, /3dg1i/i, /3dgi1/i, /edgiy/i, /edgye/i, /stripp/i, /strips/i, /stripz/i, /stripi/i, /striper/i, /stripes/i,  
	/shetakeoff/i, /takeoffher/i, /takesoffher/i, /shetakesoff/i, /takingoff/i, /tookoffher/i, /shetookoff/i, /baring/i, /bares/i, /b4re/i, /bar3/i, /b4r3/i, /b4r1/i, /bar1/i, 
	/retouch/i, /touchup/i, /touch up/i, /tush/i, /lex bl/i, /image ai/i, /edit ai/i,  /Waaa/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /nudecrawler/i, 
	/unc1oth/i, /photo AI/i, /pict AI/i, /pics app/i, /picsart/i, /enhance image/i, /erootti/i, /vegi/i, /vegen/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, 
	/object/i, /Roxan/i, /Perez/i, /Mickie/i, /Micky/i, /vagena/i, /ed17/i, /birppis/i,  /aitool/i, /Lana Perry/i, /Del Rey/i, /Tiffa/i, /Stratt/i, /puzz/i, /vulv/i, /clito/i, 
	/clita/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /babyg/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i, 
	/generator/i, /Liv org/i,  /pant/i, /off pant/i, /rem pant/i, /Kristen Stewart/i, /Steward/i, /Brit Bake/i, /3dit/i, /ed1t/i, /playboy/i, /poses/i, /Sydney Sweeney/i,  
	/Sydnee/i, /Stee/i,  /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /Babe/i, /content adult/i, /porn/i, /editing/i, /3d1t/i, /AI Tool/i, /Stewart/i, 
	/Chelsey/i, /Zel Veg/i, /Ch3l/i, /Sweeney/i, /P4IG3/i, /input face/i, /upload face/i, /Paig3/i, /P4ige/i, /pa1g/i, /editor/i, /Tw4t/i, /Brltt/i, /Steph/i, /St3ph/i, 
	/editation/i, /3d!7/i, /3d!t/i, /CJ Perry/i, /Lana WWE/i, /Lana Del Rey/i, /CJ WWE/i, /image app/i, /edi7/i, /3d17/i, /ed!7/i, /picture app/i, /edit app/i, /pic app/i, 
	/photo app/i, /Perry WWE/i, /application/i, /izzi dame/i, /Chel5/i, /adult content/i, /penetration/i, /arxiv/i, /AI edit/i, /female/i, /enhanced image/i, /joinface/i, 
	/Derriere/i, /Backside/i, /xray/i, /sheer/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /scanner/i, /bliswwe/i, /play boy/i,
	/uncensor app/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /sexual/i, /image enhancer/i, /skin view/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /leak/i, 
	/AI recreation/i, /synthetic model/i, /Margot/i, /Robbie/i, /Ana de Armas/i, /Ratajkowski/i, /Generated/i, /vaatepoisto/i, /pa!g/i, /Emily/i, /Doja Cat/i, /5k1r/i, /m4tic/i,
	/Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i, /Nicki/i, /artificial model/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, 
	/edit for fun/i, /realistic AI/i, /dream girl/i, /banned app/i, /filmora/i, /uncover/i, /Micki/i, /Stratusfaction/i, /m471c/i, /mat1c/i, /fisting/i, /Twat/i, /pleasi/i, 
	/pleasu/i, /herself/i, /her self/i, /delet bg/i, /fuck/i, /eras bg/i, /delet bg/i, /erase bg/i, /erasing bg/i, /bg delet/i, /bg erasing/i, /bg erase/i, /Blend face/i, 
	/Blendface/i, /morphi/i, /Blender face/i, /morfi/i, /fappi/i, /skin viewer/i, /skinviewer/i,  /cloth/i, /clothing/i, /clothes/i, /AI model$/i, /trained model$/i, /Reface/i, 
	/DeepAI/i, /GFPGAN/i, /RestoreFormer/i, /FaceMagic/i, /desnudador/i, /des nudador/i, /pixary/i, /GAN-based/i, /diffusion/i, /latent/i, /prompt ex/i, /txt2img/i, /img2img/i, 
	/image to image/i, /image 2 image/i, /model/i, /imagetoimage/i, /image2image/i, /girl/i, /woman/i, /women/i, /babe/i, /waifu/i, /wife/i, /spouse/i, /celeb/i, /celebrit/i, 
	/#/i, /##/i,/boobs/i, /Comfy-UI/i, /ComfyAI/i, /Comfy-AI/i, /CoAi/i, /ComAi/i, /ComfAi/i, /ComfoAi/i, /ComforAi/i, /ComfortAi/i, /Midjourney/i, /LTheory/i, /LuTheory/i,
	/Face Magic/i, /ex prompt/i, /example prompt/i, /prompt example/i, /toniwwe/i, /tonywwe/i, /fotor/i, /vercel/i, /venoi/i, /venic/i, /nsfw gen/i, /removebg/i, /remove bg/i,
	/Shiri/i, /remov bg/i, /removal bg/i, /ia onl/i, /removebg/i, /removalbg/i, /rembg/i, /rem background/i, /removbg/i, /del background/i, /eras background/i, /erase background/i, 
	/erasing background/i, /butth/i, /buttc/i, /background eras/i, /background del/i, /background rem/i, /background off/i, /off background/i, /background out/i, /out background/i, 
	/ladies/i, /lady/i, /buttc/i, /butt c/i, /butt h/i, /sugarla/i, /cunt/i, /butt s/i, /learn model/i, /mach model/i, /titten/i, /merg fac/i, /fac merg/i, /fac comb/i, /fac blend/i, 
	/too merg/i, /merg too/i, /two fac/i, /two fac/i, /too fac/i, /too fac/i, /fac join/i, /join fac/i, /bg remov/i, /Trish/i, /Shir/i, /Stormwrestl/i, /Stormrassl/i, /Storm wrestl/i, 
	/Storm rassl/i, /Toni AEW/i, /Storm AEW/i, /Toni WWE/i, /softw/i, /Toni AEW/i, /Genius of The Sky/i, /Shirakawa/i, /Shira/i,  /combin fac/i, /join 2 fac/i, /biscit/i, /bisci/i, 
	/bisce/i, /biszit/i, /bizcit/i, /biskui/i, /bizkita/i, /bizkitb/i, /bizkitc/i, /bizkitd/i, /bizkitt/i, /bizkitx/i, /bizkitz/i, /bizkitn/i, /bizkitm/i, /buttz/i, /bizkito/i, 
	/bizkity/i, /bizkith/i, /bizkitv/i, /bizkitå/i, /bizkitä/i, /bizkitö/i, /biscuita/i, /biscuitb/i, /biscuitc/i, /biscuitd/i, /biscuite/i, /biscuitf/i, /biscuitg/i, /biscuith/i, 
	/biscuiti/i, /biscuitj/i, /Leona/i, /biscuitk/i, /biscuitl/i, /biscuitm/i, /biscuitn/i, /biscuito/i, /biscuitp/i, /biscuitq/i, /biscuitr/i, /biscuits/i, /biscuitt/i, /biscuitu/i, 
	/biscuitv/i, /biscuitw/i, /biscuitx/i, /biscuity/i, /biscuitz/i, /biscuitå/i, /butts/i, /biscuitä/i, /biscuitö/i, /biscuitö/i, /butta/i, /buttb/i, /buttc/i, /buttd/i, /buttf/i, 
	/buttg/i, /butth/i, /butti/i, /buttj/i, /buttk/i, /buttl/i, /buttm/i, /buttn/i, /butto/i, /buttp/i, /buttq/i, /buttr/i, /butts/i, /buttt/i, /buttu/i, /buttv/i, /buttw/i, /buttx/i, 
	/butty/i, /buttz/i, /buttå/i, /buttä/i, /buttö/i, /Micky/i, /Mickie/i, /Mickie James/i, /Dixie/i, /Carter/i, /Gina Adams/i, /Valtez/i, /Gina Adam/i, /Adams WWE/i, /Gina WWE/i, 
	/windsor/i, /alex wind/i, /Alex Windsor/i, /analsex/i, /wemen's/i, /wemen/i, /wemon's/i, /wemons/i, /The Kat/, /Nikki/i, /ldaies/i, /laadie/i, /laadis/i, /leydis/i, /leydies/i, 
	/lewdy/i, /lewdi/i, /lewdie's/i, /wuhmans/i, /wahmans/i, /wehmans/i, /Torrie/i, /Torr1/i, /Torr!/i, /Torrl/i, /wilson/i, /Kitty WWE/, /Dawn Marie/i, /Down Marie/i, /Massaro/i, 
	/Dreamboot/i, /Dream boot/i, /Sxuel/i, /Sxual/i, /Sxu3l/i, /5xu3l/i, /5xuel/i, /5xu4l/i, /5xual/i, /dre4m/i, /dr34m/i, /bo0th/i, /b0oth/i, /b0o7h/i, /bo07h/i, /b007h/i, /b00th/i, 
	/booo/i, /b0oo/i, /bo0o/i, /boo0/i, /b000/i, /booo/i, /n000/i, /n00d/i, /no0d/i, /n0od/i, /dpnod/i, /dpnood/i, /dpnud/i, /depnud/i, /depnuud/i, /depenud/i, /depenuu/i, /dpepenud/i, 
	/dpeepenud/i, /dpeepnud/i, /dpeependu/i, /dpeepndu/i, /Elayna/i, /Eleyna/i, /Elena/i, /Elyna/i, /Elina WWE/i, /Elyna WWE/i, /Elyina/i, /Elina Blac/i, /Elina Blak/i, /Fantop/i, 
	/Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i, /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, 
	/topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jennif/i, /Jenn1/i, /J3nn1/i, /J3nni/i, /J3nn4/i, 
	/chr0m/i, /m1um/i, /Brave/i, /Browser/i, /Selain/i, /TOR-Selain/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /Opera GX/i, /Brows/i, /safari/i, /Opera Browser/i, /Mozilla/i,  /Firefox/i, 
	/Firefux/i, /waterfox/i, /water fox/i, /waterf0x/i, /water f0x/i, /waterfux/i, /water fux/i, /OracleVM/i, /softorbit/i, /soft orbit/i, /VMWare/i, /VM Ware/i, /b0x3r/i, /Jenn4/i,
	/StaphMc/i, /Staph McMahon/i, /MeekMahan/i, /MeekMahon/i, /MekMahon/i, /MekMahan/i, /MekMahaan/i, /Mek Mahaan/i, /4ut0/i, /Meek Mahaan/i, /Meek Mahan/i, /Meek Mahon/i, /Mek Mahon/i, 
	/Virtual Machine/i, /b0xer/i, /Aut0/i, /4uto/i, /Co-Ai/i, /Com-Ai/i, /CoAi/i, /ComAi/i, /ComfAi/i, /ComfoAi/i, /ComforAi/i, /ComfortAi/i, /ComfortaAi/i, /ComfortabAi/i, /ComfortablAi/i, 
	/ComfortableAi/i, /Comf-Ai/i, /Comfo-Ai/i, /Comfor-Ai/i, /Comfort-Ai/i, /Comforta-Ai/i, /Comfortab-Ai/i, /Comfortabl-Ai/i, /Comfortable-Ai/i, /Runcomfy/i, /Run comfy/i, /Run-comfy/i, 
	/Aut1111/i, /Becky/i, /Becki/i, /Rebecca/i, /Amber Heard/i, /without cloth/i, /without pant/i, /without tshirt/i, /without t-shirt/i, /without boxer/i, /b0x3r/i, /woman without/i, 
	/women without/i, /girl without/i, /lady without/i, /ladies without/i, /girlfriend/i, /boyfriend/i, /girl friend/i, /boy friend/i, /bikini/i, /linger/i, /underwear/i, /under wear/i, 
	/without dres/i, /Eliyna/i, /bik1/i, /Jazmyn/i, /Jaszmyn/i, /Jazsmyn/i, /Jazmin/i, /Dualipa/i, /Dua Lipa/i, /Dual Lipa/i, /Dual ipa/i, /chang pos/i, /selfie body/i, /belfie/i, /pos chang/i, 
	/post chang/i, /change post/i, /change pose/i, /post change/i, /pose change/i, /pose change/i, /posture change/i, /Jasmin/i, /stefe/i, /postu edit/i, /pose edit/i, /edit postu/i,
	/editor postu/i, /editor pose/i, /postu editor/i, /pose editor/i, /postu modi/i, /pose modi/i, /pic online/i, /pict online/i, /img body/i, /twerk/i, /phot onli/i, /fhot onli/i, /foto onli/i,
	/body belfie/i, /full body/i, /pic body/i, /pict body/i, /body selfie/i, /phot body/i, /image body/i, /postu tweak/i, /pose tweak/i, /pose swap/i, /post swap/i, /body swap/i, /pose adjust/i, 
	/post adjust/i, /body adjust/i, /stefa/i, /adjust pose/i, /adjust posture/i, /pose trans/i, /post trans/i, /pose morph/i, /post morph/i, /body morph/i, /body reshape/i, /shape body/i, /5yvä/i,
	/repose edit/i, /pose redo/i, /repose chang/i, /body editor/i, /body filter/i, /filter body/i, /angle chang/i, /change angle/i, /edit angle/i, /camera angle/i, /head turn/i, /body turn/i, 
	/pose reconstruct/i, /reconstruct pose/i, /pose fix/i, /fix pose/i, /body fix/i, /repose/i, /fix body/i, /edit selfie/i, /AIRemove/i, /RemoveAI/i, /RemovalAI/i, /selfie editor/i, 
	/pose shift/i, /posture shift/i, /angle shift/i, /pic shift/i, /phot shift/i, /img shift/i, /ima shift/i, /promeai/i, /prome-ai/i, /openpose/i, /open pose/i, /open-pose/i, /AIRemov/i, 
	/AIRemoving/i, /pose-open/i, /poseopen/i, /pos open/i, /Lily Adam/i, /Lilly Adam/i, /Toiviainen/i, /Tatujo/i, /PiFuHD/i, /Hirada/i, /Hirata/i, /Cathy/i, /Kathy/i, /Catherine/i, /AIRemoval/i,
        /Prim3r/i, /Pr1m3r/i, /Pr1mer/i, /Primar/i, /Pr1m4r/i, /Pr1mar/i, /Pramer/i, /Pramir/i, /LaPrime/i, /LaPrima/i, /LaPr1ma/i, /L4Pr1ma/i, /LaPr1m4/i, /LaPrim4/i, /LaPrim3/i, /LaPr1m3/i, /grok/i, 
	/LaPr1me/i, /Prim3r/i, /Primer/i, /stefe/i, /stefa/i, /Premare/i, /La Primare/i, /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /Rasikangas/i, /Rasikannas/i, /Jade Cargil/i, /Jade WWE/i,
        /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i, /barlow/i, /Jad3 WWE/i, /Nikki/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, 
	/Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Amanda Huber/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /b-job/i, /Ruby Soho/i, /Monica/i, 
	/Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /Nia Jax/i, /McQueen/i, /Kasie Cay/i, /fukk/i, /fukc/i, /fucc/i, /hawt/i, /h4wt/i, /h0wt/i, /d!ck/i, /dlck/i, /d1ck/i,  
        /join2fac/i, /flexclip/i, /pixelmator/i, /perfectcorp/i, /facejoin/i, /d1c/i, /d!c/i, /d!k/i, /c0ck/i, /d!c/i, /her0/i, /h3r0/i, /h3ro/i, /prompt/i, /pr0mpt/i, /pr0mp7/i, /promp7/i, /m471c/i,
	/Sherilyn/i, /0rg@5m/i, /headgen/i, /head gen/i, /genhead/i, /genhead/i, /HeyGen/i, /GenHey/i, /Mafiaprinsessa/i, /ai twerk/i, /twerk ai/i, /mangoanimat/i, /photo jiggle/i, /vid3/i, /boobi/i, 
        /animat pho/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /animat ima/i, /animat pic/i, /animat pho/i,/animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /v1de/i,
        /animat pic/i, /img animat/i, /ima animat/i, /photo animat/i, /!mag/i, /image animat/i, /make pic mov/i, /make pho mov/i, /make img mov/i, /make ima mov/i, /gif pic/i, /gif pho/i, /gif img/i, 
	/gif ima/i, /photo to gif/i, /image to gif/i, /pic to gif/i, /pic to vid/i, /photo to video/i, /image to video/i, /ph0t/i, /pho7/i, /ph07/i, /1m4g/i, /im4g/i, /1mag/i, /!m4g/i, /!mg/i, /v1d3/i, 
	/vld3/i, /v1d3/i, /g!f/i, /RemovingAI/i, /blowjob/i, /bjob/i, /mangoai/i, /mangoapp/i, /mango-app/i, /ai-app/i, /mangoanim/i, /mango anim/i, /mango-anim/i, /lantaai/i, /lantaaa/i, /motionai/i, 
	/changemotion/i, /swapmotion/i, /motionsw/i, /motionc/i, /poseai/i, /AIblow/i, /5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, /AI-suck/i, /drool/i, /RemovingAI/i, /bjob/i, 
        /blowjob/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /dr00l/i, /BJAI/i, /AIBJ/i, /BJ0b/i, /BJob/i, /B-J0b/i, /B-Job/i, /Suckjob/i, /Suckj0b/i, /Suck-job/i, /Suck-j0b/i, /SDuck/i, 
	/Mouthjob/i, /Mouthj0b/i, /M0uthjob/i, /M0uthj0b/i, /Mouth-job/i, /Mouth-j0b/i, /M0uth-job/i, /M0uth/i, /M0u7h/i, /Mou7h/i, /MouthAI/i, /MouthinAI/i, /MouthingAI/i, /AIMouth/i, /BlowAI/i,
        /BlowsAI/i, /BlowingAI/i, /JobAI/i, /AIJob/i, /Mouthig/i, /Suck/i, /ZuckCock/i, /ZuckC/i, /ZuckD/i, /ZuckP/i, /Zuckz/i, /Zucks/i, /Zuckc/i, /Zuzkc/i, /YouZuck/i, /ZuckYou/i, /AIZuck/i, 
	/Cuck/i, /Guck/i, /Cheeks/i, /Sukc/i, /AISucc/i, /SuccAI/i, /Suqz/i, /Suqs/i, /Suqc/i, /Suqq/i, /Suqq/i, /Suqi/i, /Suqz/i, /Sucq/i, /cukc/i, /boob/i, /b0ob/i, /b00b/i, /bo0b/i, /titjob/i,  
	/titti/i, /j0b/i, /w0rk/i, /assjob/i, /buttjob/i, /wank/i, /w4nk/i, /tittt/i, /tiitt/i, /crotch/i, /thigh/i, /legjob/i, /asssex/i, /buttsex/i, /titsex/i, /buttsex/i, /ass sex/i, /butt sex/i, 
        /butt sex/i, /buttstuff/i, /butt stuff/i, /p0rn/i, /redtube/i, /xhamster/i, /asstube/i, /butttube/i, /FapAI/i, /adulttube/i, /adult tube/i, /HerAi/i, /AiHer/i, /SheAi/i, /AIShe/i, /AroundAI/i, 
        /HerAround/i, /AroundHer/i, /TurnHer/i, /HerTurn/i, /SheAround/i, /AroundShe/i, /TurnShe/i, /SheTurn/i, /-her/i, /her-/i, /-she/i, /she-/i, /AIFap/i, /AIHug/i, /FapAI/i,/HugAI/i, /AIAdult/i,  
	/AIContent/i, /ContentAI/i, /AICreate/i, /CreateAI/i, /AICreating/i, /CreatingAI/i, /AICreation/i, /CreationAI/i, /AIMake/i, /MakeAI/i, /AIMaking/i, /MakingAI/i, /AIOut/i, /OutAI/i, /AIStuff/i, 
	/StuffAI/i, /AdultAI/i, /LookingUpAI/i, /0nl1/i, /tit sex/i, /titty/i, /ZuckAI/i, /AIBlow/i, /Sukz/i, /b-job/i, /RemovAI/i, /selfie morph/i, /SpreadingHerLeg/i, /SpreadingLeg/i, /AssAI/i, /AIAss/i,
	/t0ol/i, /to0l/i, /t00l/i, /70ol/i, /7o0l/i, /700l/i, /FindAI/i, /FinderAI/i, /FindingAI/i, /AIFind/i, /DirectoryAI/i, /AIDirect/i, /AILook/i, /LookAI/i, /LooksAI/i, /LookupAI/i, /Look-upAI/i,  
	/UpLookAI/i, /AIUpLook/i, /ButtAPP/i, /APPAI/i, /AIAPP/i, /AssAPP/i, /AppAss/i, /Ass-/i, /-Ass/i, /Butt-/i, /-Butt/i, /Cooch-/i, /-Cooch/i, /Coochie-/i, /Kewch-/i, /-Kewch/i, /Kewchie-/i, /K3wc/i, 
        /Coachie/i, /cooch/i, /tush/i, /7ush/i, /7u5h/i, /tu5h/i, /AITit/i, /TitAI/i, /TitsAI/i, /AIBoob/i, /BoobAI/i, /BoobsAI/i, /BoobieAI/i, /BoobiesAI/i, /BoobyAI/i, /BoobysAI/i, /titti/i, /titty/i,
        /ellie/i, /3llie/i, /elli3/i, /3lli3/i, /cha0tic/i, /AISketch/i, /SketchAI/i, /AIDraw/i, /AIDrew/i, /DrawAI/i, /DrewAI/i, /DrawsAI/i, /DrawingAI/i, /DrawingsAI/i, /PaintAI/i, /PaintsAI/i, /4ppli/i,
        /PaintingAI/i, /PaintingsAI/i, /AIPain/i, /OpenHerLegs/i, /OpenLegs/i, /OpeningLegs/i, /OpeningHerLegs/i, /OpensLegs/i, /OpensHerLegs/i, /SpreadLeg/i, /SpreadHerLeg/i, /cunnt/i, /cunnn/i, /strips/i,
	/SpreadsLeg/i, /SpreadsHerLeg/i, /HerThig/i, /HerLeg/i, /HerThic/i, /SheThig/i, /SheLeg/i, /SheThic/i, /HerLeg/i, /HerThic/i, /LegShe/i, /LegsShe/i, /Thicc/i, /ThickShe/i, /fondl/i, /bdsm/i, /bar3/i, 
        /4ppl1/i, /appl1/i, /pr0gram/i, /progr4m/i, /pr0gr4m/i, /pr0/i, /gr4m/i, /palg3/i, /censor/i, /sencor/i, /zencor/i, /zensor/i, /reveals/i, /reveali/i, /revealing/i, /reveale/i, /stripp/i, /b4re/i, 
	/stripz/i, /stripi/i, /striper/i, /stripes/i, /striped/i, /shetakeoff/i, /takeoffher/i, /takesoffher/i, /shetakesoff/i, /takingoff/i, /tookoffher/i, /shetookoff/i, /baring/i, /bares/i, /artintel/i,  
	/zenzor/i, /cencor/i, /cenzor/i, /cens0/i, /c3ns/i, /cen5/i, /c3n5/i, /cen5o/i, /blisswwe/i, /c3n5o/i, /zen5o/i, /z3n5o/i, /s3n5o/i, /sen5o/i, /s3nso/i, /s3nc/i, /ph0t/i, /p1c/i, /picc/i, /im4g/i, 
	/img online/i, /image online/i, /photo online/i, /pic online/i, /onl1/i, /fappp/i, /depn/i, /d3pn/i, /p05/i, /po5/i, /p0s/i, /postur/i, /posin/i, /Anthr/i, /Antro/i, /s0ftw/i, /softw/i, /w4re/i, 
	/war3/i, /w4r3/i, /p41n/i, /pa1n/i, /p4in/i, /bl15s/i, /bl1s5/i, /bl155/i, /bl1ss/i, /bli55/i, /Stratu/i, /machinelearning/i, /Kairi/i, /sexx/i, /4lexa/i, /al3xa/i, /alex4/i,  /4l3xa/i, /al3x4/i, 
	/Virtualbox/i, /Virtual box/i, /4l3x4/i, /4lex4/i, /bl15s/i, /bl1s5/i, /bl155/i, /blis5/i, /bli5s/i, /artintel/i, /LusTheory/i, /L-Theory/i, /LustTheory/i, /Lust Theory/i, /Lu-Theory/i, /mat1c/i, 
	/m4tic/i, /m47ic/i, /ma7ic/i, /ma71c/i, /Lus-Theory/i, /Lust-Theory/i, /LusTheory/i, /L-Theory/i, /m4tic/i, /LustTheory/i, /Lust Theory/i, /Lu-Theory/i, /Lus-Theory/i, /Lust-Theory/i, /ComfyUI/i, 
	/edit pose/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, /virtualmachine/i, /virtual machine/i, /kuvankäsittely/i, /virtuaalikone/i, /virtuaali kone/i, 
	/virtuaali tietokone/i, /virtuaalitietokone/i, /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, /virtuaali masiina/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /hihiai/i,
	/virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /vrbox/i, /vibox/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, /hyperv/i, /vbox/i, /virbox/i, /heheai/i, 
	/virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vi-machine/i, /vi machine/i, /virmachine/i,  /vir-machine/i, /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, 
	/v-machine/i, /vmachine/i, /v machine/i, /vimachine/i, /vir machine/i, /virt machine/i, /ma71c/i, /virtmachine/i, /virt-machine/i, /virtumachine/i, /virtu-machine/i, /virtu machine/i,
        /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /vi mach/i, /vir mach/i, /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /0riga/i,
        /virtu mac/i, /virtua mac/i, /virtual machi/i, /ma7ic/i, /0r9g4/i, /0r1q4/i, /0r1qa/i, /0rlg4h/i, /or1g@h/i, /orrga/i, /orrgaa/i, /orgaa/i, /0rg4/i, /org4/i, /org4/i, /orgy/i, /orgi/i, 
	/org@/i, /0rg@/i, /0rgi/i, /0rga5m/i, /origas/i, /0riga/i, /0r1g4/i, /0rlg4/i, /orlg4/i, /0rlg@/i, /orlg@/i, /origa/i, /or1ga/i, /orig4/i, /0r1g4/i, /0rlga/i, /orlg4/i, /0rlg4/i, /0rlg@/i, 
	/orlg@/i, /0rrg4/i, /orrg4/i, /or1g@/i, /0r1g@/i, /0r1ga/i, /0r!g@/i, /0r!g4/i, /0rig@/i, /0rig4/i, /0r9ga/i, /reveals/i, /reveali/i, /revealing/i, /reveale/i, /booba/i, /hehiai/i, /hiheai/i,


    // Symbols and emojis (Nuclear)
	/🍑/i, /🍆/i, /💦/i, /👅/i, /🔞/i, /😈/i, /👙/i, /🩲/i, /👠/i, /🧼/i, /🧽/i, /\( \. \)\( \. \)/i, /\| \|/i, /\( o \)\( o \)/i, /\(!\)/i, /18\+/i, /\*\*\*/i, /\*\*/i,
	/#/i, /##/i, /###/i, /@@/i, /#\*/i, /\*#/i, /@\*/i, /\*@/i, /#@/i, /@#/i,


    // Boundaried Nuclear regexes
	/\bgirl\b/i, /\blady\b/i, /\bshe\b/i, /\bher\b/i, /\banal\b/i, /\bsex\b/i, /\bbra\b/i, /\bass\b/i, /\bmorph\b/i, /\bVega\b/i, /\bSlut\b/i, /\bFap\b/i, /\bTor\b/i, /\bBoob\b/i, 
	/\bAMX\b/i, /\bAnal-\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /\bAi-\b/i, /\b-Ai\b/i, /\bADM\b/i, /\bADMX\b/i, /\bAis\b/i, /\bedit\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i,  
	/\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /\bAnal\b/i, /\bTay\b/i, /\balexa wwe\b/i, /\bazz\b/i, /\bLana\b/i, /\bFuku\b/i, /\bMina\b/i, /\bMachaine\b/i,
	/\bjaida\b/i, /\bRembg\b/i, /\bRem bg\b/i, /\bDel bg\b/i, /\bDelbg\b/i, /\bMorf\b/i, /\bIA\b/i, /\bIas\b/i, /\b-Ia\b/i, /\bIa-\b/i,  /\bMLM\b/i, /\bLLM\b/i, /\bTit\b/i, /\bGen\b/i, 
	/\bTits\b/i, /\b5he\b/i, /\bChaturbate\b/i, /\bToni\b/i, /\bStripchat\b/i, /\b0rg\b/i, /\bg45m\b/i, /\bSX\b/i, /\bNud\b/i, /\bdpnod\b/i, /\bdp nod\b/i, /\bsh3\b/i, /\bGrils\b/i, 
	/\b5h3\b/i, /\bphotor\b/i, /\bGina\b/i, /\bGin4\b/i, /\bG1n4\b/i, /\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /\bGril\b/i,  /\bGail\b/i, /\bAshley\b/i, /\bPamela\b/i, /\bBrooke\b/i, 
	/\bTylo\b/i, /\bCatherine\b/i, /\bBridget\b/i, /\bSally\b/i, /\bvsco\b/i, /\bdp nood\b/i, /\bdp nod\b/i, /\bdep nod\b/i, /\bFux\b/i, /\bVM\b/i, /\bVMs\b/i, /\bTNA\b/i, /\bButt\b/i,
	/\bMachiine\b/i, /\bLily\b/i, /\bMacheine\b/i, /\bMachiene\b/i, /\bLilly\b/i, /\bAmber\b/i, /\bFuk\b/i, /\bFuc\b/i, /\bmotion\b/i, /\bH3r\b/i, /\bS0ft\b/i, /\b50ft\b/i, /\bFag\b/i,
	/\bSX\b/i, /\bThekla\b/i, /\bDiva\b/i, 

    // Finnish Nuclear regex list
	/paneminen/i, /poista vaatteet/i, /vaatepoisto/i, /vaatteidenpoisto/i, /vaateiden poisto/i, /poista vaatteet/i, /poista vaat/i, /vaatteidenpoist/i, /poistavaat/i, /erotic/i,	
	/poistovaat/i, /seksuaali/i, /sexuaali/i, /seksuaalisuus/i, /eroottinen/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /läpinäkyvä/i, /erotiikka/i, /läpinäkyvä/i, /Emilia/i, /Zendaya/i,
	/sukupuoliyhteys/i, /seksikuva/i, /seksikuvi/i, /yhdyntä/i, /nussimista/i, /panevat/i, /riisu/i, /paneminen/i, /panemis/i, /paneskelu/i, /nussi/i, /nussinta /i, /nussia/i, 
	/nussiminen/i, /poista vaatteet/i, /vaatteiden poisto/i, /tekoäly/i, /panee/i, /yhdynnässä/i, /seksikuva/i, /seksivideo/i, /seksi kuvia/i, /l4st0n/i, /seksikuvia/i, /Beba/i, 
	/panovideo/i,  /pano video/i, /panokuva/i, /pano kuva/i, /pano kuvia/i, /panokuvia/i, /masturb/i, /Bepa/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /tuhero/i, /tissi/i,
	/runkku/i, /runkkaus/i, /runkata/i, /al4ston/i, /p!llu/i, /p!mppi/i,  /pimpp!/i, /runkkualbumi/i, /nakukuva/i, /nakuna/i, /runkka/i, /näpitys/i, /näpittäminen/i, /sormetus/i, 
	/sormitus/i, /sormitta/i, /sormetta/i, /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, 
	/kotijynkky/i, /jynkkykuv/i, /jynkkyvid/i, /aikuisviihde/i, /fistaus/i, /fistaaminen/i, /fistata/i, /fistaus/i, /kuvaton/i, /aikuis viihde/i, /aikuissisältö/i, /aikuis sisältö/i, 
	/aikuiskontsa/i, /aikuiskontentti/i, /aikuis kontentti/i, /aikuiskontentti/i, /aikuis contentti/i, /kuvankäsittely/i, /applikaatio/i, /4l4ston/i, /last0n/i, /pillu/i, /huora/i, 
	/huoru/i, /horats/i, /prostit/i, /ilotyttå/i, /ilotyttö/i, /ilötyttö/i, /ilötytto/i, /ilåtyttå/i, /ilåtyttö/i, /iløtyttö/i, /iløtytto/i, /iløtyttø/i, /il0tyttö/i, /il0tytto/i, 
	/il0tytt0/i, /il0tyttå/i, /il0tyttø/i, /1lotyttö/i, /1lotytto/i, /!lotyttö/i, /ilotyttø/i, /ilotytt0/i, /ilotytto/i, /bordel/i, /bordel/i, /bordelli/i, /ilotalo/i, /ilåtalo/i, 
	/ilåtalå/i, /ilotalå/i, /iløtalo/i, /ilötalo/i, /erooti/i, /erotii/i, /erootii/i, /kuvakenet/i, /il0talo/i, /iløtalå/i, /ilötalå/i, /ilotalø/i, /kuvake.net/i, /Diipfeikki/i, 
	/Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i,  /peppu/i, /pimppi/i, /pinppi/i, /Peba/i, /persreikä/i, /perse reikä/i, /pers reikä/i, /pyllyn reikä/i, 
	/pylly reikä/i, /pyllynreikä/i, /pyllyreikä/i, /persa/i, /vaatepoist/i, /pers a/i, /anusa/i, /anus a/i, /pers-/i, /pylly-/i, /-kolo/i, /syva vaarennos/i, /syvä vaarennos/i, 
	/perse/i, /pylly/i, /pyllyn-/i, /-reikä/i, /-aukko/i, /pimpp/i, /pimpe/i, /pinpp/i, /pinpi/i, /pimpi/i, /pimps/i, /pimsu/i, /pimsa/i, /pimps/i, /pilde/i, /pilper/i, /tussu/i, 
	/emätin/i, /penetraatio/i, /syvavaarennos/i, /syvä väärennös/i, /pimpp!/i, /Feikki/i, /syväväärennös/i, /klita/i, /klito/i, /Perze/i, /huora/i, /huoru/i, /itsetyydytyskuv/i, 
	/alaston/i,  /Aikusviihde/i, /Aikus viihde/i, /erotii/i, /tyttöjä/i, /naisia/i, /tytöt/i, /naiset/i, /nainen/i, /naikkoset/i, /mimmejä/i, /misu/i, /pimu/i, /lortto/i, /lutka/i, 
	/lumppu/i, /narttu/i, /römpsä/i, /römpsä/i, /rompsä/i, /römpsa/i, /rompsa/i, /tussu/i, /tusspa/i, /tuspand/i, /pilde/i, /pilpe/i, /persaus/i, /persvako/i, /persevako/i, /kyrpa/i,
        /persreikä/i, /penis/i, /kulli/i, /kyrpä/i, /kikkeli/i, /pippeli/i, /persereikä/i, /tekoäly/i, /teko äly/i, /generativ/i, /anusaukko/i, /anus-aukko/i, /anus aukko/i, /pers aukko/i,
        /persaukko/i, /perseaukko/i, /perse aukko/i, /perse-aukko/i, /pers-aukko/i, /bliswwe/i, /li1vi/i, /p3rs aukko/i, /p3r5 aukko/i, /per5 aukko/i, /0nli/i, /p3rs-aukko/i, /p3r5 aukko/i, 
	/per5 aukko/i, /p3rse/i, /pers3/i, /p3rs3/i, /per5e/i, /per53/i, /p3r5e/i, /p3r53/i, /rints/i, /r1nts/i, /r1nt5/i, /rint5/i, /p1p4r/i, /pip4r/i, /p1par/i, /rintalii/i, /rinta lii/i,
        /r1nta/i, /r1nt4/i, /rint4/i, /l1ivi/i, /sexi/i, /liiv1/i, /l1iv1/i, /li1v1/i, /l11v1/i, /l11vi/i, /vaatteet pois/i, /lahiopekoni/i, /lähiopekoni/i, /lähiöpekoni/i, /lahiöpekoni/i,
	/diiva/i,


    // Finnish boundaried Nuclear regex list 
	/\bRinnat\b/i, /\bTatu\b/i, /\bTissi\b/i, /\bTisu\b/i, /\bTisut\b/i, /\bM1mmusk4\b/i, /\bMimmusk4\b/i, /\bMimmi\b/i, /\bMimmuska\b/i, /\bM1mmi\b/i, /\bM1mmuska\b/i, /\bMimm1\b/i, 
	/\bAnus\b/i, /\bAnaali\b/i, /\bSeksi\b/i, /\bHoro\b/i, /\bGa5m\b/i, /\bG4sm\b/i, /\b@$\b/i, /\bkuvake\b/i, /\bKim\b/i, /\bLili\b/i, /\bLilli\b/i,  
    ];


    //Special regex array
    const specialRegexes = [
        /gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img)))|(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|denois(?:e|er|ing)?)(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img))?(?:[\s_\-\/.]{0,3}gr[a4][i1l]n)|gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic|image|img))|(?:ph(?:o|0)?t(?:o|0)?|pic|image|img)(?:[\s_\-\/.]{0,3}fix)/i,
        /(?:n(?:o|0)ise(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?))|(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?)(?:[\s_\-\/.]{0,3})n(?:o|0)ise|de[\s_\-\.]?n(?:o|0)is(?:e|er|ing)?)/i,
        /make.*(move|gif|video)/i,
        /photo.*(move|gif|video)/i,
        /image.*(move|gif|video)/i,
        /pic.*(move|gif|video)/i,
        /img.*(move|gif|video)/i,
        /booty/i,
        /ass.*(animat|ai|move)/i,
        /twerk/i,
        /twerking/i,
        /jiggle/i,
        /bounce.*(ai|gif)/i,
        /booty.*(ai|gif|video|animat)/i,
        /ass.*(ai|gif|video|animat)/i,
        /mangoanimat/i,
        /deepnude/i,
        /undress/i,
        /strip.*ai/i,
        /nude.*ai/i,
        /clothing.*remove/i,
        /clothes.*remove/i,
        /remove.*(clothes|clothing|dress)/i,
        /dress.*remov/i,
        /face.*(swap|deepfake|replace)/i,
	/robe.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin)/i, /robe.*(malf|func)/i, /malfunc.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin|ring)/i, /ring gear|trunk|pant|shirt|jacket.*(malf|func)/i, /malfunc.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin|ring)/i,
        /deep\s*[-_ ]?\s*nude/i,
	/deep.*(nude|naked|fake|job|ai)/i,
        /nudif(?:y|ier|ying|ication|ications)?/i, /undress(?:ing|ify|ifying|ified|ed)?/i,
        /un\s*[-_ ]?\s*cloth(?:e|es|ing|ed)?/i, /decloth(?:e|es|ing|ed)?/i,
        /clothes?\s*[-_ ]?\s*(?:remov|eras|delet|del|off|out)/i, /clothing\s*[-_ ]?\s*(?:remov|eras|delet|del|off|out)/i,
        /(?:remov|eras|delet|del)\s*[-_ ]?\s*(?:clothes?|clothing|dress|outfit|garment)/i,
        /(?:strip|stripp|bare|reveal)\s*[-_ ]?\s*(?:ai|app|tool|filter|generator|image|photo|pic)/i,
        /(?:nude|naked|nsfw)\s*[-_ ]?\s*(?:ai|app|tool|generator|gen|filter|editor|site)/i,
        /(?:ai|deep|text\s*2|text\s*to)\s*[-_ ]?\s*(?:nude|nudify|undress|uncloth|decloth)/i,
        /x\s*[-_ ]?\s*ray\s*[-_ ]?\s*(?:cloth|clothes|body|image|photo)/i,
        /see\s*[-_ ]?\s*through\s*[-_ ]?\s*(?:cloth|clothes|clothing|image|photo)/i,
        /deep\s*[-_ ]?\s*fake/i,
        /syv[aä]\s*[-_ ]?\s*v[aä][aä]renn[oö]s/i,
        /diip\s*[-_ ]?\s*feik/i,
        /face\s*[-_ ]?\s*(?:swap|morph|fusion|replace|replacement|merge|blend|join|remap)/i,
        /(?:faceswap|facefusion|facereplace|faceblend|facejoin|joinface)/i,
        /synthetic\s*[-_ ]?\s*(?:face|media|avatar|model|person|portrait)/i,
        /(?:txt2img|img2img|image\s*2\s*image|image\s*to\s*image)/i,
        /(?:image|photo|pic|img)\s*[-_ ]?\s*(?:to|2)\s*[-_ ]?\s*(?:video|vid|gif)/i,
        /(?:video|vid|gif)\s*[-_ ]?\s*(?:image|photo|pic|img)/i,
        /(?:ai|photo|image|body|pose)\s*[-_ ]?\s*(?:twerk|jiggle|bounce|motion|repose|pose\s*change)/i,
        /(?:ai|adult|nsfw)\s*[-_ ]?\s*(?:blow|suck|mouth|fap|boob|tit|ass|porn)/i,
        /(?:porn|adult|nsfw)\s*[-_ ]?\s*(?:ai|generator|tool|app|site|tube)/i,
        /(?:onlyfans|fansly|chaturbate|stripchat|redgifs|xhamster|redtube|brazzers|bangbros)/i,
        /(?:nude|naked|nsfw|porn|adult)\s*[-_ ]?\s*(?:image|photo|pic|video|vid|content|site|app)/i,
        /(?:vaat|vaatte|alusvaat|pait|liiv|hous).*pois/i,
        /(?:poista|poisto|poistaminen|poistamis).*vaat/i,
        /(?:alaston|alasti|vaatteeton|paljas)\s*[-_ ]?\s*(?:kuva|kuvia|video|sivu|app|teko[aä]ly)/i,
        /(?:seksikuva|seksivideo|aikuissis[aä]lt[oö]|aikuisviihde|jynkky|runkku)/i,
        /(?:pillu|pimppi|vittu|em[aä]tin|tussu|r[oö]mps[aä]|kyrp[aä]|kulli|kikkeli)/i,
        /(?:boob|boobs|tits|titty|pussy|vagina|cock|dick|penis|blowjob|handjob|titjob|assjob)/i,
	/(?:poista|poisto|poistaminen|poistamis)[ -]?(?:vaatteet|vaatteiden)/i,
	/see[- ]?through/i,
	/vaat.*pois/i, 
    ];

    // Merge special regexes into the main list without changing existing logic
    try { for (const rx of specialRegexes) { regexTerms.push(rx); } } catch {}

    // --- Dynamic Banned List from Chrome Storage ---
    // Safely retrieves women urls cached by wrestling.js and converts them to regexes/terms
    function applyDynamicWrestlerBans() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            try {
                chrome.storage.local.get(['wrestling_women_urls'], function(result) {
                    if (result.wrestling_women_urls && Array.isArray(result.wrestling_women_urls)) {
                        let addedCount = 0;
                        result.wrestling_women_urls.forEach(url => {
                            const parts = url.split('/').filter(Boolean);
                            const slug = parts[parts.length - 1].toLowerCase();
                            const name = slug.replace(/-/g, ' ');
                            
                            // Prevent duplicates
                            if (!terms.some(t => t.toLowerCase() === name)) {
                                if (name.length <= 6 || !name.includes(' ')) {
                                    // Short or single name: bind to word boundaries to prevent false positives
                                    regexTerms.push(new RegExp('\\b' + name + '\\b', 'i'));
                                } else {
                                    // Longer name: regular string match is safe
                                    terms.push(name);
                                }
                                addedCount++;
                            }
                        });
                        // Uncomment if you want to verify via dev console:
                        // console.log(`[ARCHIVE.JS] Dynamically added ${addedCount} wrestler names from shared storage.`);
                    }
                });
            } catch(e) {}
        }
    }
    // Execute immediately upon initialization
    applyDynamicWrestlerBans();

    // Robust, cross-browser redirect
    function fastRedirect(targetUrl) {
        try { safeTop.location.replace(targetUrl); return; } catch {}
        try { window.location.replace(targetUrl); return; } catch {}
        try { safeTop.location.href = targetUrl; return; } catch {}
        try { window.location.href = targetUrl; } catch {}
    }

    function containsAiBoundary(text) {
        if (!text) return false;

        // -- Sexual/AI keywords regexes --
        const AIRegexes = [
	/sex/i, /porn/i, /nud/i, /naked/i, /nsfw/i, /oral/i, /blow/i, /fell/i, /tit/i, /boob/i, /pussy/i, /vag/i, /veg/i, /cock/i, /trap/i, /boinking/i, /lesbian/i,
	/dick/i, /cum/i, /penis/i, /fuck/i, /suck/i, /mast/i, /jerk/i, /fap/i, /ass/i, /butt/i, /boot/i, /bra/i, /bro/i, /pant/i, /strip/i, /stripping/i, /raping/i,
	/head/i, /give/i, /giving/i, /her/i, /she/i, /him/i, /his/i, /woman/i, /women/i, /fem/i, /male/i, /girl/i, /rassling/i, /gril/i, /cumshots/i, /picture/i,
	/boy/i, /lady/i, /ladi/i, /guy/i, /gal/i, /g4l/i, /tush/i, /anal/i, /penet/i, /anim/i, /mode/i, /LLM/i, /MLM/i, /deep/i, /visuals/i, /visualis/i, /open/i,
	/learn/i, /learning/i, /diff/i, /diffuse/i, /diffusion/i, /cloth/i, /clothing/i, /clothes/i, /wwe/i, /aew/i, /tna/i, /njpw/i, /ajpw/i, /allelite/i, /gene/i,
	/wrestl/i, /wrestle/i, /wrestles/i, /wrestling/i, /rassl/i, /rassle/i, /anal/i, /suck/i, /sucking/i, /sucks/i, /spread/i, /spreads/i, /spreading/i, /generates/i,
	/opens/i, /opening/i, /hole/i, /thigh/i, /leg/i, /legs/i, /toe/i, /toes/i, /pen/i, /penly/i, /pens/i, /pencil/i, /pic/i, /photo/i, /generated/i, /generati/i,
	/imag/i, /img/i, /graph/i, /graphs/i, /graphic/i, /graphics/i, /journey/i, /journal/i, /new/i, /list/i, /listof/i, /lists/i, /listsof/i, /about/i, /fella/i,
	/gf/i, /friend/i, /friends/i, /buddy/i, /buddi/i, /buddies/i, /mate/i, /mates/i, /panty/i, /pantys/i, /panti/i, /panties/i, /ladies/i, /ladys/i, /booby/i,
	/tool/i, /tools/i, /find/i, /finding/i, /finder/i, /twerk/i, /twerks/i, /twerking/i, /jerking/i, /jerks/i, /wank/i, /wanker/i, /wanks/i, /fapp/i, /seksikäs/i,
	/faps/i, /faping/i, /fapping/i, /fappening/i, /leak/i, /leaks/i, /talk/i, /leaked/i, /leaking/i, /leakings/i, /edit/i, /editing/i, /editation/i, /lesbians/i,
	/pictures/i, /photos/i, /image/i, /images/i, /imgs/i, /photograph/i, /photographs/i, /visual/i, /visualiz/i, /visualization/i, /visualize/i, /raped/i, /rape/i,
	/visualisation/i, /visualise/i, /visualic/i, /visualication/i, /visualice/i, /speech/i, /gen/i, /gener/i, /genera/i, /generat/i, /generate/i, /nipple/i, /horny/i, 
	/generativ/i, /generative/i, /vid/i, /vide/i, /vidu/i, /video/i, /tube/i, /tubes/i, /bf/i, /blows/i, /blowing/i, /titti/i, /tittie/i, /titties/i, /hornier/i,
	/fellat/i, /fellati/i, /fellatio/i, /fellation/i, /tits/i, /titty/i, /tittys/i, /tittyes/i, /boob/i, /boobs/i, /boobi/i, /boobie/i, /boobies/i, /handjob/i,
	/boobye/i, /boobyes/i, /pus/i, /puss/i, /pussy/i, /pussi/i, /pussie/i, /pussies/i, /vag/i, /vagi/i, /vagin/i, /vagina/i, /vaginal/i, /vaginall/i, /peeping/i,
	/vaginally/i, /vaginaly/i, /vega/i, /vegana/i, /vegane/i, /vagane/i, /vagene/i, /vagena/i, /anall/i, /anally/i, /analli/i, /anaali/i, /seksi/i, /spanking/i,
	/seksikkyys/i, /masturbate/i, /masturbation/i, /masturbating/i, /jizz/i, /ejaculate/i, /ejaculated/i, /ejaculating/i, /blowjob/i, /blowjobs/i, /underwear/i,
	/stripper/i, /strippers/i, /erotic/i, /erotica/i, /kink/i, /kinky/i, /fetish/i, /fetishes/i, /bdsm/i, /bondage/i, /domination/i, /submission/i, /sexcapade/i,
	/gay/i, /gays/i, /queer/i, /bi/i, /bisexual/i, /trans/i, /transgender/i, /transexual/i, /intersex/i, /nonbinary/i, /genderfluid/i, /ladyboy/i, /fondling/i,
	/screwing/i, /fucking/i, /fuckin/i, /fucks/i, /orgasm/i, /orgasms/i, /threesome/i, /foursome/i, /gangbang/i, /voyeur/i, /voyeurism/i, /peep/i, /cumshot/i,
	/nipples/i, /clit/i, /clitoris/i, /labia/i, /labial/i, /sexed/i, /sexes/i, /sexting/i, /porned/i, /fondled/i, /porning/i, /fetishize/i, /fetishized/i, 
	/spanked/i, /touch/i, /touching/i, /touched/i, /suck/i, /sucks/i, /sucking/i, /lick/i, /licked/i, /licking/i, /panty/i, /panties/i, /briefs/i, /spank/i, 
	/lingerie/i, /bra/i, /bras/i, /corset/i, /corsets/i, /thong/i, /thongs/i, /gstring/i, /gstrings/i, /erot/i, /erotic/i, /erotica/i, /vibrator/i, /scrotum/i,
	/horniest/i, /moan/i, /moaned/i, /moaning/i, /moans/i, /grope/i, /groped/i, /groping/i, /sexually/i, /sensual/i, /seduce/i, /seduced/i, /seducing/i, /mast/i,
	/sexcapades/i, /nudephoto/i, /nudephotos/i, /nudes/i, /bare/i, /barely/i, /bareback/i, /naught/i, /naughty/i, /kissing/i, /kissed/i, /fondle/i, /handjobs/i,
	/thrust/i, /thrusted/i, /thrusting/i, /penetrate/i, /penetrated/i, /penetrating/i, /balls/i, /testicle/i, /testicles/i, /vibrators/i, /spit/i, /spitting/i,
	/squirting/i, /squirt/i, /bdsm/i, /dom/i, /sub/i, /voyeur/i, /exhibitionist/i, /masturb/i, /art/i, /arts/i, /artsy/i, /arti/i, /artis/i, /artist/i, /artisan/i, 
	/creat/i, /creati/i, /creatio/i, /creation/i, /creatin/i, /creating/i, /create/i, /creates/i, /make/i, /makes/i, /maki/i, /makin/i, /making/i, /site/i, /sites/i,
	/app/i, /apps/i, /application/i, /applications/i, /applic/i, /work/i, /works/i, /working/i, /worked/i, /job/i, /jobs/i, /chat/i, /chatt/i, /chatte/i, /chatter/i,
	/anima/i, /animat/i, /animate/i, /animates/i, /animati/i, /animatio/i, /animation/i, /animations/i, /sora/i, /gemini/i, /claude/i, /cunt/i, /twat/i, /dress/i,  
	/pillu/i, /pimppi/i, /pinppi/i, /vittu/i, /pano/i, /pane/i, /ban/i, /mua/i, /mut/i, /riisu/i, /riisua/i, /riisumis/i, /poist/i, /poiso/i, /poistaa/i, /poistam/i, 
	/poistami/i, /poistamis/i, /poistamine/i, /poistamen/i, /sovellus/i, /applikaatio/i, /kuva/i, /kuvia/i, /kuvien/i, /käsittely/i, /käsitellä/i, /banned/i, /pers/i, 
	/bans/i, /perse/i, /persaus/i, /persvako/i, /persevako/i, /persreikä/i, /persereikä/i, /trans/i, /transf/i, /transfo/i, /transfor/i, /transform/i, /transformi/i, 
	/animated/i, /transforming/i, /transforms/i, /transformings/i, /transformed/i, /convert/i, /converted/i, /convers/i, /conversi/i, /conversio/i, /conversion/i,
	/slut/i, /sluts/i, /slutt/i, /slutti/i, /sluttin/i, /slutting/i, /reveal/i, /skin/i, /body/i, /belly/i, /backside/i, /frontside/i, /belf/i, /belfie/i, /bottom/i, 
	/front/i, /frontal/i, /perc/i, /perv/i, /pervert/i, /perverted/i, /strip/i, /strips/i, /stripz/i, /stripe/i, /stripp/i, /takeoff/i, /takesoff/i, /takesoff/i,
	/shap/i, /shape/i, /shapes/i, /shapeing/i, /shaping/i, /POS/i, /position/i, /adjust/i, /change/i, /replaces/i, /replacing/i, /replacement/i, /spinning/i, /mode/i,
	/adjustment/i,/adjusted/i, /adjustin/i, /adjusting/i, /change/i, /changes/i, /changin/i, /changing/i, /mod/i, /modify/i, /modif/i, /modification/i, /mods/i,/spun/i,
	/modifyin/i, /modifying/i, /tweak/i, /tweakin/i, /tweaking/i, /back/i, /front/i, /legging/i, /leggings/i, /cloth/i, /clothy/i, /clothes/i, /clothing/i, /clothying/i,
	/page/i, /pages/i, /site/i, /mango/i, /mangos/i, /mangoing/i, /icegirl/i, /icegirls/i, /ismartta/i, /ismart/i, /ismartt/i, /gasm/i, /org/i, /replac/i, /replace/i,
	/stuffed/i, /stuffing/i, /around/i, /off/i, /spin/i, /spins/i, /spinned/i, 
        /-/i, /=/i, /\+/i, /_/i 
        ];

        // Tokenize text
        let tokens = [];
        try {
            const re = /\p{L}+/gu;
            let m;
            while ((m = re.exec(text)) !== null) tokens.push(m[0]);
        } catch (e) {
            const re2 = /[A-Za-z]+/g;
            let m2;
            while ((m2 = re2.exec(text)) !== null) tokens.push(m2[0]);
        }
        if (tokens.length === 0) tokens = [text];

        for (let tok of tokens) {
            if (!tok || tok.length < 2) continue;
            const lowerTok = tok.toLowerCase();

            // Quick sexual/AI keyword check
            for (let r of AIRegexes) {
                try {
                    if (r.test(tok)) {
                        recordMatchDetail('ai-boundary-airegex', r.toString(), tok);
                        return 'AI';
                    }
                } catch (e) {}
            }

            // Count 'ai' occurrences
            const aiMatches = lowerTok.match(/ai/gi) || [];
            if (aiMatches.length >= 2) {
                recordMatchDetail('ai-boundary-multi-ai', 'ai>=2', tok);
                return 'AI';
            }

            // Check boundary 'ai'
            const startsWithAI = /^ai/i.test(tok);
            const endsWithAI = /ai$/i.test(tok);
            if (!startsWithAI && !endsWithAI) continue;

            if ((startsWithAI && tok.substr(0, 2) === 'AI') || (endsWithAI && tok.substr(tok.length - 2) === 'AI')) {
                recordMatchDetail('ai-boundary-upper-ai', 'AI at edge', tok);
                return 'AI';
            }

            let remainder = startsWithAI ? lowerTok.substring(2)
                : endsWithAI ? lowerTok.substring(0, lowerTok.length - 2)
                    : '';

            if (!remainder) {
                recordMatchDetail('ai-boundary-no-remainder', 'edge-ai', tok);
                return 'AI';
            }

            // Heuristic vowel test
            const vowelCount = (remainder.match(/[aeiouyäöå]/g) || []).length;
            if (remainder.length >= 3 && vowelCount >= 2) continue;

            // If none matched, block conservatively
            recordMatchDetail('ai-boundary-generic', remainder, tok);
            return 'AI';
        }

        return false;
    }

    function containsForbiddenKeywords(text) {
        if (!text) return false;

        // 0) Quick AI-boundary check
        const aiHit = containsAiBoundary(text);
        if (aiHit) {
            recordMatchDetail('ai-boundary', aiHit, text);
            return aiHit;
        }

        // 1) Special high-complexity regexes
        for (let i = 0; i < specialRegexes.length; ++i) {
            const re = specialRegexes[i];
            try {
                if (re.test(text)) {
                    recordMatchDetail('special', re.toString(), text);
                    return re.toString();
                }
            } catch (e) {
                console.warn('Special regex error:', re, e);
            }
        }

        // 2) Regex keywords
        for (let i = 0; i < regexTerms.length; ++i) {
            const re = regexTerms[i];
            try {
                if (re.test(text)) {
                    recordMatchDetail('regex', re.toString(), text);
                    return re.toString();
                }
            } catch (e) {
                console.warn('Regex keywords error:', re, e);
            }
        }

        // 3) String keywords: whole-word if single word, substring if contains space
        for (let i = 0; i < terms.length; ++i) {
            const kw = terms[i];
            if (!kw) continue;
            const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const patternText = kw.includes(' ') ? escaped : `\\b${escaped}\\b`;
            const pattern = new RegExp(patternText, 'i');
            try {
                if (pattern.test(text)) {
                    recordMatchDetail('string', kw, text);
                    return kw;
                }
            } catch (e) {
                console.warn('String keyword regex error:', kw, e);
            }
        }

        return false;
    }

    // Expose function
    if (typeof window !== 'undefined') {
        window.containsAiBoundary = containsAiBoundary;
        window.containsForbiddenKeywords = containsForbiddenKeywords;
    }

    // Prevent redirect loops but allow future redirects (short TTL, per-destination)
    const REDIRECT_FLAG = 'ARD_REDIRECTED_ONCE'; // legacy (kept for backward compatibility; no longer used)
    const LAST_REDIRECT_KEY = 'ARD_LAST_REDIRECT';
    const REDIRECT_TTL_MS = 2500;

    const alreadyRedirected = () => {
        try {
            const s = sessionStorage.getItem(LAST_REDIRECT_KEY);
            if (!s) return false;
            const o = JSON.parse(s);
            if (!o || !o.url || !o.ts) return false;
            const home = getHomeURLForCurrentSite();
            return o.url === home && (Date.now() - o.ts) < REDIRECT_TTL_MS;
        } catch { return false; }
    };
    const markRedirected = () => {
        try {
            const home = getHomeURLForCurrentSite();
            sessionStorage.setItem(LAST_REDIRECT_KEY, JSON.stringify({ url: home, ts: Date.now() }));
        } catch {}
    };

    // Centralized redirect: determines the correct home page per site (Archive vs xcancel),
    // and (safely) force-refreshes if we're already on that exact home, without looping.
    const redirectToHome = () => {
        if (alreadyRedirected()) return;
        const home = getHomeURLForCurrentSite();

        // Mark first, to survive reloads and avoid loops
        markRedirected();

        try {
            const cur = new URL(selfURL);
            const target = new URL(home);

            const normalize = (p) => (!p || p === '' ? '/' : (p.endsWith('/') ? p : p + '/'));
            const sameOrigin = cur.origin === target.origin;
            const samePath = normalize(cur.pathname) === normalize(target.pathname);

            if (sameOrigin && samePath) {
                try { safeTop.location.reload(); return; } catch {}
                fastRedirect(home);
                return;
            }
        } catch {}

        fastRedirect(home);
    };

    // Backward-compatible alias kept intact (do not remove/trim), delegates to redirectToHome
    const redirectToWayback = () => {
        redirectToHome();
    };

    // Helper: check any text for restricted terms (string and regex)
    const containsRestricted = (text) => {
        if (!text) return false;
        const lower = text.toLowerCase();
        if (containsForbiddenKeywords(lower)) {
            return true;
        }
        for (let term of terms) {
            if (lower.includes(term.toLowerCase())) return true;
        }
        for (let regex of regexTerms) {
            try { if (regex.test(text)) return true; } catch {}
        }
        return false;
    };

    // Function to check for terms in the URL and redirect
    const checkTermsAndRedirect = () => {
        // Check both raw and decoded variants
        for (let term of terms) {
            const t = term.toLowerCase();
            if (pageURLLower.includes(t) || pageURLDecodedLower.includes(t)) {
                console.log(`Term found in URL: ${term}. Redirecting to ${getSiteLabel()}.`);
                redirectToHome();
                return true;
            }
        }
        return false;
    };

    // Function to check for regex patterns in the URL and redirect
    const checkRegexAndRedirect = () => {
        // Test both original URL and decoded URL for maximum coverage
        for (let regex of regexTerms) {
            try {
                if (regex.test(selfURL) || regex.test(tryDecode(selfURL))) {
                    console.log(`Regex pattern found in URL: ${regex}. Redirecting to ${getSiteLabel()}.`);
                    redirectToHome();
                    return true;
                }
            } catch (e) {
                // ignore malformed regex application
            }
        }
        return false;
    };

    // Perform the checks and redirect immediately if necessary
    if (checkTermsAndRedirect()) return;
    if (checkRegexAndRedirect()) return;

    // Re-check on URL changes after initial load (hash/popstate)
    window.addEventListener('hashchange', () => {
        if (checkTermsAndRedirect() || checkRegexAndRedirect()) return;
    }, true);
    window.addEventListener('popstate', () => {
        if (checkTermsAndRedirect() || checkRegexAndRedirect()) return;
    }, true);

    // Additional function to check for banned URLs with or without "www."
    const bannedURLs = ["blogspot.com", "blogger.com", "ask.fm", "reddit.com", "reddit.com/r/", "kuvake.net", "lite.irc-galleria.net", "irc-galleria.net", "irc-galleria.fi", "irc.fi", "vsco.co", "wondershare.com", "wondershare.net", "vmware.com", "virtualbox.org", "azure.microsoft.com"];

    const isBannedURL = (urlLower, urlDecodedLower) => {
        for (let bannedURL of bannedURLs) {
            const b = bannedURL.toLowerCase();
            if (urlLower.includes(b) || urlLower.includes(`www.${b}`) || urlDecodedLower.includes(b) || urlDecodedLower.includes(`www.${b}`)) {
                return true;
            }
        }
        return false;
    };

    // Check for banned URLs and prevent loading if necessary
    if (isBannedURL(pageURLLower, pageURLDecodedLower)) {
        console.log(`Banned URL detected: ${selfURL}. Preventing page load.`);
        redirectToHome();
        return;
    }

    // Wait for DOM to be ready before checking content
    const waitForDOM = () => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initContentChecking, { once: true });
        } else {
            initContentChecking();
        }
    };

    // Utility: determine editable fields (inputs, textareas, contenteditable)
    const isContentEditable = (el) => !!el && el.nodeType === 1 && typeof el.isContentEditable === 'boolean' && el.isContentEditable;
    const isEditableField = (el) => {
        if (!el || el.nodeType !== 1) return false;
        if (el instanceof HTMLInputElement) {
            return !el.disabled && !el.readOnly && el.type !== 'hidden';
        }
        if (el instanceof HTMLTextAreaElement) {
            return !el.disabled && !el.readOnly;
        }
        if (isContentEditable(el)) return true;
        return false;
    };
    const getEditableValue = (el) => {
        if (!el) return '';
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value || '';
        if (isContentEditable(el)) return (el.textContent || '').trim();
        return '';
    };

    // Initialize content checking
    const initContentChecking = () => {
        // Selectors to check the page content for restricted words
        const selectors = [
            // Archive.org (existing Wayback search field and variants)
            "input.rbt-input-main",
            "input.hidden-submit-btn",
            "div.rbt",
            "input.rbt-input-hint",
            "#search-input-item-0",
            ".rbt-input-main",
            ".rbt-input-main.form-control.rbt-input",
            "input[type='text']",
            "input[placeholder=\"Enter a URL or words related to a site's home page\"]",
            "input[aria-autocomplete='both']",
            "input[role='combobox']",
            "input[aria-expanded='false']",
            ".search-field",
            "form > fieldset > div",

            // xcancel.com search inputs (added earlier)
            "div.search-bar form[action='/search'][autocomplete='off'] input[type='text'][name='q']",
            "form[action='/search'][autocomplete='off'] input[type='text'][name='q']",
            ".search-bar input[type='text'][name='q']",
            "input[type='text'][name='q'][placeholder='Search...']",
            "input[name='q'][dir='auto']",
            ".panel-container .search-bar form[action='/search'] input[type='text'][name='q']",

            // Wayback Machine input on Archive/Wayback pages (kept)
            "div.search-field input[type='text'][name='url']#url[placeholder='Enter URL or keywords']",
            "input#url[name='url'][type='text'][placeholder='Enter URL or keywords']",
            "input[type='text'][name='url']#url",
            "fieldset .search-field input#url[name='url']",
            "form[method='post'] input#url[name='url']",
            "label[for='url']",
            // Search icon SVG next to the input (exact aria-labelledby attribute)
            "svg[aria-labelledby='searchTitleID searchDescID'][height='40'][width='40']",
            // Fallback: match if aria-labelledby contains the title id (in case attr order varies)
            "svg[aria-labelledby*='searchTitleID'][height='40'][width='40']",
            // Wayback Machine logo link and container (safe to include; textContent check is benign)
            "a[data-event-click-tracking='TopNav|WaybackMachineLogoLink'][aria-label='Visit the Wayback Machine'][href='https://web.archive.org']",
            "fieldset a[data-event-click-tracking='TopNav|WaybackMachineLogoLink']",

            // Generic Archive.org site-wide search inputs (constant scanning on archive.org)
            "input[type='search']",
            "input#search",
            "input#searchbar",
            "input[name='search']",
            "form[action='/search'] input[type='text'], form[action='/search'] input[type='search']",
            "form[action='/search.php'] input[type='text'], form[action='/search.php'] input[type='search']",
            "form[action='/advancedsearch.php'] input[type='text'], form[action='/advancedsearch.php'] input[type='search']",
            "input[placeholder*='Search']",
            "form#searchform input[type='text'], form#searchform input[type='search']",
            ".search-bar input[type='search'], .search-bar input[name='search']"
        ];

        // Function to check page content for restricted words
        const checkContentForRestrictedWords = () => {
            let redirected = false;

            for (let selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);

                    elements.forEach((element) => {
                        if (redirected) return;

                        // Only scan user-editable input/textarea values; ignore static nodes/containers
                        if (!isEditableField(element)) return;

                        const content = getEditableValue(element);
                        const lowerContent = content.toLowerCase();

                        if (!lowerContent) return;

                        if (containsForbiddenKeywords(lowerContent)) {
                            console.log(`Get the fuck out of here with that! (AI boundary / combined rules) Redirecting you to ${getSiteLabel()}.`);
                            redirectToHome();
                            redirected = true;
                            return;
                        }

                        // Check string terms
                        for (let term of terms) {
                            if (lowerContent.includes(term.toLowerCase())) {
                                console.log(`Get the fuck out of here with that! ${term} is banned for a reason. Redirecting you to ${getSiteLabel()}.`);
                                redirectToHome();
                                redirected = true;
                                return;
                            }
                        }

                        // Check regex patterns
                        for (let regex of regexTerms) {
                            if (regex.test(content)) {
                                console.log(`Get the fuck out of here with that! ${regex} is banned for a reason. Redirecting you to ${getSiteLabel()}.`);
                                redirectToHome();
                                redirected = true;
                                return;
                            }
                        }
                    });

                    if (redirected) return true;
                } catch (e) {
                    console.log(`Error checking selector ${selector}:`, e);
                }
            }

            // Additionally scan generic contenteditable elements (not covered by specific selectors)
            if (!redirected) {
                try {
                    const editableNodes = document.querySelectorAll('[contenteditable], [contenteditable="true"], [contenteditable="plaintext-only"]');
                    for (const el of editableNodes) {
                        if (redirected) break;
                        if (!isEditableField(el)) continue;
                        const content = getEditableValue(el);
                        if (!content) continue;

                        if (containsRestricted(content)) {
                            console.log(`Get the fuck out of here with that! (contenteditable) Redirecting you to ${getSiteLabel()}.`);
                            redirectToHome();
                            redirected = true;
                            break;
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }

            return redirected;
        };

        // Run once immediately
        checkContentForRestrictedWords();

        // Debounced checks on user interactions
        let inputTimer = 0;
        const triggerCheck = () => {
            clearTimeout(inputTimer);
            inputTimer = setTimeout(() => checkContentForRestrictedWords(), 120);
        };

        // Use composedPath to reliably find the real editable field (works with shadow DOM)
        const getEditableFromEvent = (e) => {
            const path = (typeof e.composedPath === 'function') ? e.composedPath() : (e.path || []);
            const chain = (path && path.length) ? path : [e.target];
            for (const node of chain) {
                if (isEditableField(node)) return node;
                if (node && typeof node.closest === 'function') {
                    const hit = node.closest('input, textarea, [contenteditable], [contenteditable="true"], [contenteditable="plaintext-only"]');
                    if (hit && isEditableField(hit)) return hit;
                }
            }
            return null;
        };

        const inputHandler = (e) => {
            const field = getEditableFromEvent(e);
            if (field && isEditableField(field)) triggerCheck();
        };

        document.addEventListener('beforeinput', inputHandler, true);
        document.addEventListener('input', inputHandler, true);
        document.addEventListener('keyup', inputHandler, true);
        document.addEventListener('change', inputHandler, true);
        document.addEventListener('paste', inputHandler, true);
        document.addEventListener('compositionend', inputHandler, true);

        // Intercept form submissions early to block navigation and redirect
        document.addEventListener('submit', (e) => {
            try {
                const form = e.target;
                if (!form || !(form instanceof HTMLFormElement)) return;

                // Inspect all inputs, textareas, and contenteditables within the form
                const fields = form.querySelectorAll('input, textarea, [contenteditable], [contenteditable="true"], [contenteditable="plaintext-only"]');
                for (const field of fields) {
                    if (!isEditableField(field)) continue;
                    const val = getEditableValue(field);
                    if (!val) continue;
                    if (containsRestricted(val)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation?.();
                        console.log(`Restricted term detected on form submit. Redirecting you to ${getSiteLabel()}.`);
                        redirectToHome();
                        return;
                    }
                }
            } catch {}
        }, true);

        // Observe DOM changes so late-loaded inputs are covered without relying solely on a timer
        const mo = new MutationObserver(() => triggerCheck());
        try {
            mo.observe(document.documentElement || document.body, { childList: true, subtree: true, characterData: false });
        } catch {}

        // Run periodically in case elements load late (keeps running; stops only after redirect)
        const interval = setInterval(() => {
            if (checkContentForRestrictedWords()) {
                clearInterval(interval);
                try { mo.disconnect(); } catch {}
            }
        }, 1000);

        // Resume checks on bfcache restore (Firefox and Chrome)
        window.addEventListener('pageshow', (ev) => {
            if (ev.persisted) {
                checkContentForRestrictedWords();
            }
        });
    };

    // Start the content checking process
    waitForDOM();

})();

// End of userscript