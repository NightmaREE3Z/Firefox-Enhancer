// ==UserScript==
// @name         ExtraRedirect-Instagram
// @version      1.6.59-walker-root-guard
// @description  Instagram/Threads/Reels specific logic split from Extra.js (pre-unload + first-paint shields + approve-gates + targeted bans; core-container safe)
// @match        *://www.instagram.com/*
// @match        *://instagram.com/*
// @match        *://www.instagram.com/?next=%2F/*
// @match        *://www.instagram.com/accounts/onetap/?next=%2F/*
// @match        *://www.threads.net/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
'use strict';

    // ===== Lightweight lifecycle/memory tracking =====
    const __timers = { intervals: new Set(), timeouts: new Set() };
    const __observers = new Set();
    const __eventCleanups = new Set();
    const __rafIds = new Set(); // track requestAnimationFrame ids
    let __cleanupRan = false;
    let __intervalsRunning = false;
    let __isRedirectingFast = false; // guard against double redirects
    let __observerTimeoutId = null; // FIX: declare to avoid ReferenceError

    // pacing/throttle config to reduce GC churn and peak memory, keeping UI snappy
    const PACE = {
        mainMinMs: 400,         // minimum spacing between heavy "main" runs
        genericMinMs: 1500,     // min spacing between genericAggressiveHider runs
        myosMinMs: 400,         // min spacing between "Myös Metalta" sweeps
        settingsMinMs: 2500,    // min spacing between settings-page sweeps
        searchMinMs: 180        // min spacing for search suggestion sweeps
    };

    // timestamps/state for throttling
    let lastMainHandlerRun = 0;
    let lastGenericAggressiveRun = 0;
    let lastMyosSweep = 0;
    let lastSettingsSweep = 0;
    let lastSearchSweep = 0;
    let settingsSweepPath = '';

    let __searchSweepScheduled = false;

    // attributes
    const HIDE_ATTR = 'data-ig-hide';
    const APPROVE_ATTR = 'data-ig-approve';
    const SEARCH_ROOT_ATTR = 'data-ig-search-root';
    const SEARCH_ROW_ATTR = 'data-ig-row';
    const IG_SEARCH_HIDDEN_ATTR = 'data-ig-search-hidden-reason';
    const IG_SEARCH_APPROVE_ATTR = APPROVE_ATTR; // legacy alias from Old (diagnostics)

    // Startup and unload shields
    const STARTUP_SHIELD_ID = 'ig-startup-shield';
    let __readyMarked = false;

    function applyInlineShield() {
        try {
            const de = document.documentElement;
            de.style.setProperty('visibility', 'hidden', 'important');
            de.style.setProperty('opacity', '0', 'important');
            de.style.setProperty('background', '#fff', 'important');
        } catch {}
    }
    function removeInlineShield() {
        try {
            const de = document.documentElement;
            de.style.removeProperty('visibility');
            de.style.removeProperty('opacity');
            de.style.removeProperty('background');
        } catch {}
    }
    function installStartupShield() {
        if (!location.hostname.endsWith('instagram.com')) return;
        try {
            applyInlineShield();
            let s = document.getElementById(STARTUP_SHIELD_ID);
            if (!s) {
                s = document.createElement('style');
                s.id = STARTUP_SHIELD_ID;
                s.textContent = `
                    html, body { background: #fff !important; }
                    html[data-ig-startup="1"] body > * { display: none !important; }
                `;
                (document.documentElement || document.head).prepend(s);
            }
            document.documentElement.setAttribute('data-ig-startup', '1');
        } catch {}
    }
    function markReady() {
        if (__readyMarked) return;
        __readyMarked = true;
        try {
            document.documentElement.removeAttribute('data-ig-startup');
            document.getElementById(STARTUP_SHIELD_ID)?.remove();
            removeInlineShield();
        } catch {}
    }
    installStartupShield();

    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        __timers.intervals.add(id);
        return id;
    }
    function addTimeout(fn, ms) {
        const id = setTimeout(() => {
            __timers.timeouts.delete(id);
            try { fn(); } catch {}
        }, ms);
        __timers.timeouts.add(id);
        return id;
    }
    function stopIntervals() {
        __timers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
        __timers.intervals.clear();
        __intervalsRunning = false;
    }
    function startIntervals(schedulerFn) {
        if (__intervalsRunning) return;
        schedulerFn();
        __intervalsRunning = true;
    }
    function trackObserver(observer) { __observers.add(observer); return observer; }
    function onEvent(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        __eventCleanups.add(() => target.removeEventListener(type, handler, options));
    }
    function cleanup() {
        if (__cleanupRan) return;
        __cleanupRan = true;
        try {
            stopIntervals();
            __timers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __timers.timeouts.clear();
            __rafIds.forEach(id => { try { cancelAnimationFrame(id); } catch {} });
            __rafIds.clear();
            __observers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __observers.clear();
            __eventCleanups.forEach(fn => { try { fn(); } catch {} });
            __eventCleanups.clear();
            try { document.getElementById('extra-redirect-style')?.remove(); } catch {}
            try { document.getElementById('reels-navigation-hider')?.remove(); } catch {}
            try { document.getElementById('ig-blank-style')?.remove(); } catch {}
            try { document.getElementById(STARTUP_SHIELD_ID)?.remove(); } catch {}
        } catch {}
    }

    // ======== Keyword arrays ========
    const bannedKeywords = [
        "Bliss", "Alexa Bliss", "Tiffany", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Mercedes", "Alba Fyre", "sensuel", "Maryse", "Meta AI", "Del Rey", "CJ Perry", 
        "Becky Lynch", "Michin", "Mia Yim", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven", "sensuel", "queer", "Pride", "NXT Womens", "model", "Perry", "Henley", "Nattie", 
        "Jordynne", "Woman", "Women", "@tiffanywwe", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Women's", "Woman's", "Summer Rae", "Mia Yim",
        "Naomi", "Bianca Belair", "Jessika Carr", "Carr WWE", "Jessica Karr", "bikini", "Kristen Stewart", "Sydney Sweeney", "Piper Niven", "Nia Jax", "Meta AI", "AI generated",
        "Young Bucks", "Jackson", "Lash Legend", "Jordynne Grace", "generated", "DeepSeek", "TOR-Browser", "TOR-selain", "Opera GX", "prostitute", "AI-generated", "Arianna Grace", 
        "deepnude", "undress", "nudify", "nude", "nudifier", "faceswap", "facemorph", "AI app", "Sweeney", "Alexis", "Sydney", "Zelina Vega", "Mandy Rose", "playboy", "#AI",
        "Nikki", "Brie", "Bella", "Opera Browser", "by AI", "AI edited", "Safari", "OperaGX", "MS Edge", "Microsoft Edge", "clothes", "Lola Vice", "Vice WWE", "Candice LeRae",
        "crotch", "dress", "dreamtime", "Velvet Sky", "LGBTQ", "panties", "panty", "cloth", "AI art", "cleavage", "deviantart", "All Elite Wrestling", "Trish", "Stratus", "Tutki",
        "Tiffy Time", "Steward", "Roxanne", "cameltoe", "dreamtime AI", "Joanie", "Stewart", "Isla Dawn", "escort", "inpaint", "photopea", "onlyfans", "fantime", "Amari Miller", 
        "upscale", "upscaling", "upscaled", "sexy", "Alexa WWE", "AJ Lee", "deepfake", "ring gear", "Lexi", "Trans", "Transvestite", "Aleksa", "Giulia", "Rodriguez", "Elite Wrestling",
        "booty", "Paige", "Chyna", "lingerie", "venice", "AI model", "deep fake", "nudifying", "nudifier", "undressing", "undressed", "undressifying", "undressify", "Kristen",
        "Vladimir Putin", "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley Cameron", "Hayter", "trunks", "pants", "Ripley", "manyvids", "Del Ray", "Sinulle ehdotettua",
        "five feet of fury", "5 feet of fury", "selain", "browser", "DeepSeek", "DeepSeek AI", "fansly", "justforfans", "patreon", "Vince Russo", "Tay Conti", "CJ WWE", "AdvancingAI",
        "Valhalla", "IYO SKY", "Shirai", "Io Sky", "Iyo Shirai", "Dakota Kai", "wiikmaaan", "Asuka", "Kairi Sane", "Meiko Satomura", "NXT Women", "Russo", "underwear", "Rule 34",
        "Miko Satomura", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey", "Dana Brooke", "Izzi Dame", "Tamina", "Alicia Fox", "Madison Rayne", "Saraya", "attire", "only fans",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly", "Melina WWE", "Jillian Hall", "Mickie James", "Su Yung", "Britt", "Nick Jackson", "Matt Jackson", "fan time", "Sol Ruca",
        "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly", "Gail Kim", "Awesome Kong", "Deonna", "Purrazzo", "Anna Jay", "Riho", "Britney", "Nyla Rose", "All Elite",
        "Angelina Love", "Tessmacher", "Havok", "Taya Valkyrie", "Valkyria", "Tay Melo", "Willow Nightingale", "Statlander", "Hikaru Shida", "rule34", "Sasha", "AEW", "lesbian",
        "Penelope Ford", "Shotzi", "Tegan", "Nox", "Stephanie", "Sasha Banks", "Sakura", "Tessa", "Brooke", "Jakara", "Alba Fyre", "Isla Dawn", "Scarlett Bordeaux", "lesbo",
        "B-Fab", "Kayden Carter", "Katana Chance", "Lyra Valkyria", "Indi Hartwell", "Blair", "Davenport", "Maxxine Dupri", "China", "Russia", "Natalya", "Sakazaki", "homo",
        "Karmen Petrovic", "Ava Raine", "Yulisa Leon", "Cora Jade", "Gina Adams", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum WWE", "Paxley", "Fallon", "Valentina Feroz", 
        "wondershare", "filmora", "Kelani Jordan", "Electra Lopez", "Wendy Choo", "HorizonMW", "Horizon Modern Warfare", "Horizon MW", "Black Ops 7", "Black Ops 6", "lottapupu",
        "#ass", "#perse", "#pylly", "#tissit", "#tit", "#tits", "#boob", "#boobs", "#boobies", "#boobie", "#booty", "#butt", "#babe", "Primera", "Roxanne", "Roxan", "lotta",
        "#belfie", "belfie", "Natalia", "Natasha", "#rack", "#finnishgirl", "#girl", "#women", "#woman", "#ladies", "#girls", "#womens", "#womans", "miska", "m1ska", "m1sk4", 
        "misk4", "misk3", "m1sk3", "m1ske", "m1mmuska", "misk33", "misk33waaa", "misk33waa", "misk33wa", "misk3waa", "misk3waaa", "misk3wa", "Myös Metalta", "Amanda Huber", 
	"Saya Kamitani", "Kamitani", "Nikkita", "Nikkita Lyons", "Lisa Marie", "Lisa Marie Varon", "Lisa Varon", "Marie Varon", "Irving", "Naomi", "Belts Mone", 
    ];

    const bannedRegexes = [
        /Steph's/i, /Stephanie's/i, /Steph/i, /Stephanie/i, /Stepan/i, /Stratu/i, /Stratt/i, /Tiffa/i, /Tiffy/i, /Trish/i, /Sasha/i, /lex bl/i, /lesb/i, /homo/i, /transvestite/i, /Myös Metalta/i,  
        /\bHer\b/i, /\bShe\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bHers\b/i, /\bShes\b/i, /\bBy AI\b/i, /\bAlexa\b/i, /\bTiffy\b/i, /Shirai/i, /\bCharlotte\b/i, /\bGina\b/i, /\bGin4\b/i, 
        /\bG1n4\b/i, /Gina Adam/i, /Gina Adams/i, /\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /\bGina\b/i, /\bGigi\b/i, /\bDolin\b/i, /\bSarah\b/i, /pride/i, /transve/i, /\bAI-generated\b/i, 
        /\bHMW\b/i, /\bBO6\b/i, /\bBO7\b/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenn1/i, /J3nn1/i, /J3nni/i, /J3nn4/i, /Jenn4/i, /Dua Lipa/i, /Dualipa/i, /Jenna/i, 
        /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /Rasikangas/i, /jjulia/i, /juuliska/i, /Roxanne/i, /Roxanna/i, /Noelle/i, /\bErika\b/i, /\bErica\b/i, /\bEerica\b/i, /\bEerika\b/i,
        /\bIra\b/i, /irppa/i, /irpp4/i, /iragay/i, /juliana/i, /julianna/i, /juulianna/i, /juuliana/i, /juulia/i, /rasikannas/i, /rasikangas/i, /\bBra\b/i, /\bLana\b/i, /\bAI\b/i, /\bNea\b/i, /Neea/i,
        /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, 
	/Alici/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /\bNikki\b/i,
    ]; 

    const allowedWords = [
        "Lähetä", "Viesti", "Lähetä viesti", "Send a message", "Send message", "Send", "message", "Battlefield", "BF", "BF6", "BF1", "BF4", "BF 1942", "BF2", "Battle field", "memes", "masterrace",
        "#memes", "meme", "#meme", "Pearl", "Harbor", "Market", "Bro", "Brother", "Metallica", "Sabaton", "Joakim", "James", "Hetfield", "PC", "Build", "Memory", "Ram", "Motherboard", "Mobo", "AIO", "Cooling",
        "CPU", "GPU", "Radeon", "GeForce", "GTX", "RTX", "50", "60", "70", "80", "90", "X3D", "50TI", "60TI", "70TI", "80TI", "90TI", "Processor", "Graphics", "Card", "Intel", "AMD", "NVidia", "RGB", "pcmaster",
    ];

    const instagramAccountsToHide = [
        'karabrannbacka',
        'piia_oksanen',
        'wiikmaaan',
        'julmakira',
        'yaonlylivvonce',
        'alexa_bliss_wwe_',
        'samanthathebomb',
        'tiffanywwe',
        'beckylynchwwe',
        'charlottewwe',
        'wwe_queen_charlotte',
        'biancabelairwwe',
        'thetrishstratuscom',
        'thebriebella',
        'thenikkibella',
        'niajaxwwe',
        'mandysacs',
        'sonyadevillewwe',
        'natbynature',
        'zelinavegawwe',
        'carmellawwe',
        'itsmebayley',
        'sashabankswwe',
        'mercedesmone',
        'saraya',
        'theajmendez',
        'livmorganwwe',
        'candicelerae',
        'indihartwell',
        'raquelwwe',
        'dakotakaiwwe',
        'kairi_sane_wwe',
        'asuka_wwe',
        'meiko_satomura',
        'roxanne_wwe',
        'pipernivenwwe',
        'nikki_cross_wwe',
        'jacyjaynewwe',
        'gigidxdolinnxt',
        'avawwe_',
        'blairdavenportwwe',
        'lyravalkyria',
        'katana_chance',
        'kaydenwwe',
        'maxxinedupri',
        'chelseaagreen',
        'fallonhenleywwe',
        'karmenpetrovicwwe',
        'danabrookewwe',
        'valhallawwe',
        'laceyevanswwe',
        'shotziwwe',
        'tegan_nox_wwe',
        'mia_yim',
        'candicewwe',
        'emmalution',
        'tenille_dashwood',
        'brittbaker',
        'jaderedeww',
        'krisstatlander',
        'jamiehayter',
        'thunderrosa22',
        'serenadeeb',
        'nylarosebeast',
        'thepenelopeford',
        'sylviliukkonen',
        'sylviorvokki',
        'willowwrestles',
        'skye_by_wrestling',
        'redvelvett',
        'anna_jay_aew',
        'tayconti_',
        'tayconti',
        'taymelo',
        'erikavikman',
        'erika.helin',
        'hikaru_shida',
        'riho_ringstar',
        'gailkimitsme',
        'deonnapurrazzo',
        'jordynnegrace',
        'mickiejames',
        'trinity_fatu',
        'm1mmuska',
        'mimmi',
        'dvondivawwe',
        'suyung',
        'madisonraynewrestling',
        'angelinalove',
        'velvet_sky',
        'brookeadams',
        'tessblanchard',
        'thetayavalkyrie',
        'havokdeathmachine',
        'killerkellywrestling',
        'kierahogan',
        'diamante_lax',
        'ladyfrost',
        'taryn_terrell',
        'rebeltanea',
        'martimichellewwe',
        'alishawrestling',
        'savannah_evanswrestling',
        'jazzygabert',
        'masha_slamovich',
        'paigewwe',
        'kayfabe_kayla',
        'roxanne_perez',
        'cora.jade',
        'piia_barlund',
        'lottapupu',
        'giuliawrestler',
        'starkz_wrestler',
        'thedollhousewrestling',
        'holidead',
        'tessafblanchard',
        'theviperwrestling',
        'shellymartinez',
        'amberoneal1',
        'melinaperez',
        'realtrinity_fatu',
        'cheerleadermelissa',
        'allysin_kkay',
        'sumerraywwe',
        'rhearipley_wwe',
        'kacycatanzaro',
        'nikkistormwwe',
        'nxt_indi_hartwell',
        'zoeystarkwwe',
        'thetayavalkyrie',
        'brandiwwe',
        'lufistowrestling',
        'kaseykatal',
        'martibelle',
        'kylierae',
        'savannahevanswrestling',
        'stephdelander',
        'gisele.shaw',
        'jjuliakristiina_',
        'rachelellering',
        'tanyaraymond',
        'tessablanchard',
        'thealliebunny',
        'taya_valkyrie',
        'thedemonbunny',
        'rosemarythehive',
        'siennawrestling',
        'madisonrayne',
        'kimber_lee90',
        'kiera_hogan',
        'diamantelax',
        'realtenille',
        'stephaniemcmahon',
        'stephanie_buttermore',
        'stephanie.vaquer',
        'julianarasikannas',
        'wwe_asuka',
        'kairi_sane_wwe',
        'wwe_mandyrose',
        'stephaniesanzo',
        'shaqwrestling',
        'jadecargill',
        'emimatsumoto',
        'yukisakazaki',
        'mizuki_wrestler',
        'gina.adams',
        'misk33',
        'misk33waaa',
        'misk33waa',
        'misk33wa',
        'misk3waa',
        'misk3waaa',
        'misk3wa',
        'misk4',
    ];

    const instagramBannedPosts = [
        'p/Cpz9H4UtG1Q',
        'p/Cu6cV9zN-CH',
        'p/CyA6BJpNzgu',
        'p/B3RXztzhj6E',
    ];

    const instagramBannedPaths = [
        ...instagramAccountsToHide,
        ...instagramBannedPosts,
        'instagram.com/explore',
        'instagram.com/reels',
        'instagram.com/accounts/blocked_accounts',
        'accounts/settings/v2/hidden_words',
        'accounts/restricted_accounts',
    ];

    const excludedPaths = [
        'direct/t/',
        'inbox',
        'direct/t',
        'stories/nightmaree3z/',
        'stories/m1mmuska/',
    ];

    // UNION protectedElements (Old superset + New)
    const protectedElements = [
        // Messaging and compose areas
        'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
        'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate[role="textbox"][spellcheck="true"]',
        'textarea[placeholder="Message..."]',
        'button[type="submit"]',
        'div.x1qjc9v5.x1yvgwvq.x1dqoszc.x1ixjvfu.xhk4uv.x1ke7ulo.x3jqge.x1i7howy.x4y8mfe.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.x78zum5.xdt5ytf.xw7yly9.xktsk01.x1yztbdb.x1d',
        'div.x6s0dn4.x78zum5.x1gg8mnh.x1pi30zi.xlu9dua',

        // Large containers / layout cores
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'div.x1i10hfl.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x16tdsg8.x1hl2dhg.xggy1nq.x1a2a7pz.x6s0dn4.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x1ypdohk.x',
        'main[role="main"]',
        'section[role="main"]',
        'div[role="main"]',
        'main',
        'article',
        'div[data-testid="post"]',
        'div[data-testid="story"]',
        'div[data-testid="feed"]',
        'section.x6s0dn4.xrvj5dj.x1o61qjw.x12nagc.x1gslohp',
        'div.xh8yej3.x1gryazu.x10o80wk.x14k21rp.x1porb0y',
        'nav[aria-label*="Primary"]',
        'nav[role="navigation"]',
        'html',
        'body',
        '#mount_0_0_Ie',

        // Emojis / inputs
        'svg[aria-label="Valitse emoji"]',
        'div[aria-label="Viesti"]',
        'div[role="textbox"]',

        // Old extra compose protections
        'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.xexx8yu.x18d9i69.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd',
        'svg[aria-label="Äänileike"]',
        'input[accept="audio/*,.mp4,.mov,.png,.jpg,.jpeg"]',
        'svg[aria-label="Lisää kuva tai video"]',
        'svg[aria-label="Valitse GIF-animaatio tai tarra"]',
        'svg[aria-label="Tykkää"]',
        'div.x1qjc9v5.x1yvgwvq.x1dqoszc.x1ixjvfu.xhk4uv.x1ke7ulo.x3jqge.x1i7howy.x4y8mfe.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.x78zum5.xdt5ytf.xw7yly9.xktsk01.x1yztbdb',
        'div.x1n2onr6 > div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
        'div[aria-hidden="true"] > div.xi81zsa.x17qophe.x6ikm8r.x10wlt62.x47corl.x10l6tqk.xlyipyv.x13vifvy.x87ps6o.xuxw1ft.xh8yej3',

        // Legacy protected send buttons
        'div[role="dialog"] [role="button"][aria-label="Lähetä"]',
        '[role="button"][aria-label="Lähetä"]',
        'div[role="dialog"] [role="button"][aria-label="Send"]',
        '[role="button"][aria-label="Send"]',
        'div[role="dialog"] div[role="button"][aria-label="Lähetä"]',
        'div[role="dialog"] div[role="button"][aria-label="Send"]',
        'div[role="dialog"] div[role="button"].x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x10w94by.x1qhh985.x14e42zd.xdl72j9.x2lah0s.x3ct3a4.xdj266r.x14z9mp.xat24cr.x1lziwak.x2lwn1j.xeuugli.xexx8yu.x18d9i69.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1obq294.x5a5i1n.xde0f50.x15x8krk.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x9f619.x9bdzbf.x1ypdohk.x1f6kntn.xwhw2v2.x10w6t97.xl56j7k.x17ydfre.xf7dkkf.xv54qhq.x1n2onr6.x2b8uid.xlyipyv.x87ps6o.x5c86q.x18br7mf.x1i0vuye.xh8yej3.x18cabeq.x158me93.xk4oym4.x1uugd1q.x3nfvp2'
    ];

    // UNION selectorsToHide (Old + New). Duplicates are harmless.
    const selectorsToHide = [
        '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x1n2onr6 > ._a6hd.x1a2a7pz.xggy1nq.x1hl2dhg.x16',
        '.xvbhtw8.x1j7kr1c.x169t7cy.xod5an3.x11i5rnm.xdj266r.xdt5ytf.x78zum5',
        '.wbloks_79.wbloks_1 > .wbloks_1 > .wbloks_1 > .wbloks_1 > div.wbloks_1',
        '.x1ye3gou.x1l90r2v.xn6708d.x1y1aw1k.xl56j7k.x1qx5ct2.x78zum5.x6s0dn4',
        '.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.xo71vjh.x5pf9jr.x13lgxp2.x168nmei.x78zum5.xjbqb8w.x9f619 > div > div > .xnc8uc2.x11aubdm.xso031l.x1q0g3np.x1bs97v',
        'div.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.x1emribx.x1i64zmx.xod5an3.xo71vjh.x5pf9jr.x13lgxp2.x168nmei.x78zum5.xjbqb8w.x9f619:nth-of-type(11)',
        '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x78zum5.x6s0dn4.x1n2onr6 > ._a6hd.x1a2a7pz.xggy',
        '.xfex06f > div:nth-child(3)',
        'div.x1i10hfl:nth-child(8)',
        'mount_0_0_Ie > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div:nth-child(2) > div > div.x1gryazu.xh8yej3.x10o80wk.x14k21rp',
        'div.x6bk1ks:nth-child(3) > div:nth-child(4) > a:nth-child(1)',
        'div.x6bk1ks:nth-child(3) > div:nth-child(3)',
        '.x1xgvd2v > div:nth-child(2) > div:nth-child(4) > span:nth-child(1)',
        '.x1xgvd2v > div:nth-child(2) > div:nth-child(3) > span:nth-child(1) > a:nth-child(1) > div:nth-child(1)',
        'svg[aria-label="Tutki"]',
        'div[aria-label="Käyttäjän julmakira tarina"]',
        'div[aria-label="Käyttäjän julmakira tarina, nähty"]',
        'img[alt="Käyttäjän julmakira profiilikuva"]',
        'div[class^="x9f619 xjbqb8w x78zum5 x168nmei x13lgxp2 x5pf9jr xo71vjh"][style*="height: 250px;"]',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xdj266r.x1yztbdb.x4uap5.xkhd6sd.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x1q0g3np.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1uhb9sk.x1plvlek.xryxfnj.x1iyjqo2.x2lwn1j.xeuugli.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'h4.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10wh',
        'a.x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tds',
        'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10',
        'div[role="button"][tabindex][aria-label="Reels"]',
        'div[role="button"][tabindex][aria-label="Threads"]',
        'div[role="button"][tabindex][aria-label="Tutki"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"]',
        'span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'a[href="/ai/"], a[href="/meta-ai/"], a[aria-label*="Meta AI"], *[aria-label="Meta AI"]',
        'a.x1i10hfl[href*="threads"]',
        'svg[aria-label="Threads"]',
        'div.x78zum5.xdt5ytf.xdj266r.x14z9mp.xod5an3.x162z183.x1j7kr1c.xvbhtw8',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xv54qhq.xf7dkkf.xjkvuk6.x1iorvi4.x1n2onr6.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x1q0g3np.xqjyukv.x6s0dn4.x1oa3qoh.x1nhvcw1',
        'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x1roi4f4.x1t',
        'a.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16t',
        'div.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.xdj266r.x1yztbdb.xyri2b.x1c1uobl.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'a.x1i10hfl[href*="blocked"]','a.x1i10hfl[href*="estetty"]','a.x1i10hfl[href*="Rajoitetut tilit"]','a.x1i10hfl[href*="Restricted accounts"]','a.x1i10hfl[href*="Piiloitetut sanat"]','a.x1i10hfl[href*="Hidden Words"]','a.x1i10hfl[href*="hide_story_and_live"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="blocked"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="estetty"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Rajoitetut tilit"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Restricted accounts"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Piiloitetut sanat"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Hidden Words"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="hide_story_and_live"]',
        '[aria-label*="Myös Metalta"]','[title*="Myös Metalta"]','svg[aria-label*="Myös Metalta"]',
        '[role="navigation"] a[href^="/explore"]','nav[aria-label*="Primary"] a[href^="/explore"]','a[href="/explore/"]','a[href="/explore/?next=%2F"]','a[role="link"][href^="/explore"]',

        // “Sinulle Ehdotettua” targets (Old)
        'section:has(> div > a._a6hd[href*="?next=%2F"])',
        'a._a6hd[href*="?next=%2F"] ~ div[style*="--x-height: 230px"]',
        'section:has(> div > a._a6hd[href*="?next=%2F"]) div[style*="--x-height: 230px"]',
        'section.xc3tme8.xcrlgei.x1tmp44o.xwqlbqq.x7y0ge5.xhayw2b',

        // New extra carousel selector
        'section.xqui205.x172qv1o'
    ];

    // UNION selectorsToMonitor (Old + New)
    const selectorsToMonitor = [
        'div.x1qjc9v5.x9f619.x78zum5.xg7h5cd.x1mfogq2.xsfy40s.x1bhewko.xgv127d.xh8yej3.xl56j7k',
        'div.x78zum5.xedcshv',
        'div.x78zum5.xl56j7k.x1n2onr6.xh8yej3',
        'img.xz74otr.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1bs05mj.x5yr21d',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x12nagc.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'div.html-div',
        'article','video','span','div','p','h1','h2','h3','h4','h5','h6','a','button',
        'div[role="button"][tabindex][aria-label="Threads"]',
        'div[role="button"][tabindex][aria-label="Tutki"]',
        'div[class*="x1nhvcw1"][class*="xqjyukv"][class*="xdt5ytf"]',
        'a.x1i10hfl[href*="threads"]',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x12nagc.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'canvas.x1upo8f9.xpdipgo.x87ps6o',

        // Old extra monitors
        'span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]'
    ];

    const selectorsForExcludedPaths = [
        'div[role="button"][tabindex][aria-label="Reels"]',
        'div[role="button"][tabindex][aria-label="Threads"]',
        'div[role="button"][tabindex][aria-label="Tutki"]',
        'div[role="button"][tabindex][aria-label="Myös Metalta"]',
        'a.x1i10hfl[href*="ai"]',
        'a.x1i10hfl[href*="Myös Metalta"]',
        'a.x1i10hfl[href*="threads"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/reels/"]',
        'a.x1i10hfl[href*="blocked"]',
        'a.x1i10hfl[href*="estetty"]',
        'a.x1i10hfl[href*="hide_story_and_live"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="blocked"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="estetty"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="hide_story_and_live"]'
    ];

    const selectorsToMonitorAndRedirect = [
        'svg.x1lliihq.x1n2onr6.x5n08af[height="48"][width="48"][viewBox="0 0 96 96"]',
        'svg[aria-label=""][height="48"][width="48"][viewBox="0 0 96 96"] circle[cx="48"][cy="48"][r="47"]',
        'svg[viewBox="0 0 96 96"] path[d*="M60.931 70.001H35.065"]',
    ];

    const bannedPhrases = [
        "Sinulle Ehdotettua", "Meta AI", "Threads", "Näytä kaikki", "Myös Metalta", "Piiloitetut sanat", "Rajoitetut tilit", "Restricted accounts", "Hidden Words", "Piilota tarinat ja livet", "Hide stories and live",
    ].map(s => s.toLowerCase());

    const textBasedTargets = [
        { selector: 'button', text: 'Estä' },
        { selector: 'button', text: 'Block' },
        { selector: 'span', text: 'Estetty' },
        { selector: 'span', text: 'Blocked' },
        { selector: 'button', text: 'Rajoitetut tilit' },
        { selector: 'button', text: 'Restricted accounts' },
        { selector: 'span', text: 'Rajoitetut tilit' },
        { selector: 'span', text: 'Restricted accounts' },
        { selector: 'button', text: 'Piilota tarinat ja livet' },
        { selector: 'button', text: 'Hidden Words' },
        { selector: 'span', text: 'Piilota tarinat ja livet' },
        { selector: 'span', text: 'Hide stories and live' },
        { selector: 'a', text: 'Meta AI' },
        { selector: 'div', text: 'Sinulle ehdotettua' },
        { selector: 'h2', text: 'Suggested for you' },
        { selector: 'span', text: 'Threads' }
    ];

    const bannedKeywordsLower = bannedKeywords.map(k => k.toLowerCase());
    const instagramBannedPathsLower = instagramBannedPaths.map(p => p.toLowerCase());
    const allowedWordsLower = allowedWords.map(w => w.toLowerCase());
    const instagramAccountsToHideLower = instagramAccountsToHide.map(a => a.toLowerCase());
    const instagramAccountsSet = new Set(instagramAccountsToHideLower);

    let currentURL = window.location.href;
    const hiddenElements = new WeakSet();
    let reelsStyleInjected = false;

    // Helpers
    function isCoreContainer(el) {
        try {
            if (!el) return false;
            if (el === document.documentElement || el === document.body) return true;
            if (el.matches('main, [role="main"], [role="feed"]')) return true;
            const count = el.querySelectorAll?.('article').length || 0;
            if (count >= 2) return true;
            const r = el.getBoundingClientRect?.();
            if (r && r.width > innerWidth * 0.7 && r.height > innerHeight * 0.6) return true;
            return false;
        } catch { return false; }
    }
    function stripImagesWithin(el) {
        try {
            el.querySelectorAll('img, source, video').forEach(node => {
                if (node.tagName === 'IMG') {
                    node.removeAttribute('srcset'); node.removeAttribute('src');
                    node.loading = 'lazy'; node.decoding = 'async';
                    node.style.setProperty('display', 'none', 'important');
                    node.style.setProperty('visibility', 'hidden', 'important');
                } else if (node.tagName === 'SOURCE') {
                    node.removeAttribute('srcset'); node.removeAttribute('src');
                } else if (node.tagName === 'VIDEO') {
                    node.pause?.(); node.removeAttribute('src'); node.removeAttribute('poster');
                }
            });
        } catch {}
    }

    // Old helper retained intact (not strictly used by New flow, but restored per request)
    function getSearchRoots() {
        const rootsSet = new Set();
        document.querySelectorAll('[role="listbox"]').forEach(el => rootsSet.add(el));
        document.querySelectorAll('[role="dialog"]').forEach(d => {
            if (d.querySelector('form[role="search"], input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"]')) {
                rootsSet.add(d);
            }
        });
        document.querySelectorAll('form[role="search"]').forEach(f => {
            let c = f;
            for (let i = 0; i < 5 && c && c !== document.body && c !== document.documentElement; i++) {
                rootsSet.add(c);
                c = c.parentElement;
            }
        });
        document.querySelectorAll('[aria-label*="Search"], [aria-label*="Haku"], [aria-label*="Hae"]').forEach(el => {
            if (el.querySelector('input, form')) rootsSet.add(el);
        });
        return Array.from(rootsSet);
    }

    // Build CSS to pre-hide search hits for banned accounts/posts
    // RESTORED: include both New scope ([data-ig-search-root="1"]) and Old scope ([role="listbox"])
    function buildSearchBanCSS() {
        try {
            const scopes = [`[${SEARCH_ROOT_ATTR}="1"]`, '[role="listbox"]'];
            const chunks = [];
            for (const scope of scopes) {
                const rules = instagramAccountsToHideLower.map(acc => {
                    const p = `${scope} a[href*="/${acc}/"]`;
                    return `
${p}, ${p} * {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  pointer-events: none !important;
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  overflow: hidden !important;
}`;
                }).join('\n');

                const postRules = instagramBannedPosts.map(seg => {
                    const p = `${scope} a[href*="/${seg}"]`;
                    return `
${p}, ${p} * {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  pointer-events: none !important;
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  overflow: hidden !important;
}`;
                }).join('\n');

                chunks.push(rules, postRules);
            }
            return chunks.join('\n');
        } catch { return ''; }
    }

    function isSearchSurfacePresent() {
        return !!(document.querySelector('form[role="search"]')
               || document.querySelector('input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"], input[aria-label*="Haku"]')
               || document.querySelector('[role="listbox"]')
               || document.querySelector('[role="menu"]'));
    }
    function getSearchBox() {
        return document.querySelector('input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"], input[aria-label*="Haku"]');
    }

    // Mark explicit roots AND the entire ancestor chain above the search input (up to body)
    function markSearchRoots() {
        const rootsSet = new Set();

        ['[role="listbox"]', '[role="menu"]', 'div[role="dialog"] [role="listbox"]'].forEach(sel => {
            document.querySelectorAll(sel).forEach(el => { el.setAttribute(SEARCH_ROOT_ATTR, '1'); rootsSet.add(el); });
        });

        const sb = getSearchBox();
        if (sb) {
            let node = sb;
            // mark up to 8 ancestors to reliably include the left-rail container and its sibling wrapper
            for (let i = 0; i < 8 && node && node !== document.body && node !== document.documentElement; i++) {
                node = node.parentElement;
                if (!node) break;
                node.setAttribute(SEARCH_ROOT_ATTR, '1');
                rootsSet.add(node);
            }
            // also mark body if we still don't have many roots; CSS is conservative (only specific banned anchors)
            if (rootsSet.size < 2) {
                document.body?.setAttribute(SEARCH_ROOT_ATTR, '1');
                if (document.body) rootsSet.add(document.body);
            }
        }

        return Array.from(rootsSet);
    }

    function scheduleSearchSweep(immediate = false) {
        if (!isSearchSurfacePresent()) return;
        const now = performance.now();
        if (immediate || (now - lastSearchSweep) >= PACE.searchMinMs) {
            lastSearchSweep = now;
            hideInstagramSearchResults();
            __searchSweepScheduled = false;
            return;
        }
        if (__searchSweepScheduled) return;
        __searchSweepScheduled = true;
        addTimeout(() => {
            __searchSweepScheduled = false;
            if (!__cleanupRan && isSearchSurfacePresent()) {
                lastSearchSweep = performance.now();
                hideInstagramSearchResults();
            }
        }, PACE.searchMinMs);
    }

    function getScanRoots() {
        const roots = [];
        const pushIf = el => { if (el) roots.push(el); };
        pushIf(document.querySelector('[role="feed"]'));
        pushIf(document.querySelector('main[role="main"]'));
        pushIf(document.querySelector('section[role="main"]'));
        document.querySelectorAll('[role="dialog"], [role="listbox"], [role="menu"]').forEach(el => roots.push(el));
        return roots.length ? roots : (document.body ? [document.body] : []);
    }

    function usernameFromHref(rawHref) {
        if (!rawHref) return '';
        try {
            let pathname = '';
            try { pathname = new URL(rawHref, location.origin).pathname || ''; }
            catch { pathname = (rawHref.split('#')[0].split('?')[0] || ''); }
            const parts = pathname.split('/').filter(Boolean);
            if (!parts.length) return '';
            const first = parts[0];
            if (first === 'stories' && parts[1]) return parts[1].toLowerCase().replace(/^@+/, '');
            if (['explore','reels','p','accounts','direct','ai','meta-ai'].includes(first)) return '';
            return first.toLowerCase().replace(/^@+/, '');
        } catch { return ''; }
    }

    function getSearchRowElement(node) {
        let row = node.closest('[role="option"], li, a[role="link"], a._a6hd, a, div[role="link"], div[role="button"][tabindex], div[role="menuitem"], div[role="option"]');
        if (!row) row = node;
        row.setAttribute(SEARCH_ROW_ATTR, '1');
        return row;
    }

    function collectRowTexts(row) {
        const texts = [];
        try {
            const add = (v) => { if (v && typeof v === 'string') { const t = v.trim(); if (t) texts.push(t); } };
            add(row.textContent || '');
            row.querySelectorAll('[alt],[title],[aria-label]').forEach(el => {
                add(el.getAttribute('alt'));
                add(el.getAttribute('title'));
                add(el.getAttribute('aria-label'));
            });
        } catch {}
        return texts;
    }

    function matchesAnyBanned(text) {
        if (!text) return false;
        const low = text.toLowerCase();
        if (allowedWordsLower.some(w => low.includes(w))) return false;
        if (bannedKeywordsLower.some(k => k && low.includes(k))) return true;
        for (const rx of bannedRegexes) { try { if (rx.test(text)) return true; } catch {} }
        return false;
    }
    function matchesBannedByText(texts) {
        if (!texts || !texts.length) return '';
        for (const raw of texts) {
            if (matchesAnyBanned(raw)) return 'text-match';
        }
        return '';
    }

    function isLikelySearchSuggestionAnchor(a) {
        try {
            const row = getSearchRowElement(a);
            const r = row.getBoundingClientRect?.();
            if (!r || r.width < 120 || r.height < 36) return false;
            // stay on the left rail area
            if (r.left > 680) return false;
            // structural hints: avatar image or close icon inside
            const hasAvatar = !!row.querySelector('img[alt*="profiilikuva" i], img[alt*="profile picture" i], img[alt*="profiil" i]');
            const hasClose = !!row.querySelector('svg[aria-label="Sulje"], svg[aria-label="Close"]');
            // requires at least username-like text somewhere
            const nameSpan = row.querySelector('span');
            const hasText = !!((nameSpan?.textContent || '').trim() || (row.textContent || '').trim());
            return (hasAvatar || hasClose) && hasText;
        } catch { return false; }
    }

    function extractUserCandidatesFromRow(row) {
        const out = new Set();
        try {
            const a = row.matches('a[href]') ? row : row.querySelector('a[href]');
            const href = a ? a.getAttribute('href') : '';
            const uFromHref = usernameFromHref(href || '');
            if (uFromHref) out.add(uFromHref);

            const texts = collectRowTexts(row).join(' ');
            const attrDump = [];
            for (const attr of row.attributes || []) {
                if (!attr || !attr.name) continue;
                if (/user|name|aria-label|title/i.test(attr.name)) attrDump.push(attr.value || '');
            }
            const hay = [texts, attrDump.join(' ')].join(' ').trim();

            const re = /@?([A-Za-z0-9._]{2,30})/g;
            let m;
            while ((m = re.exec(hay)) !== null) {
                const cand = (m[1] || '').toLowerCase();
                if (!cand) continue;
                if (!/[a-z]/i.test(cand)) continue;
                out.add(cand);
            }

            row.querySelectorAll('img[alt]').forEach(img => {
                const alt = (img.getAttribute('alt') || '').trim();
                const parts = alt.split(/\s+/);
                parts.forEach(p => {
                    const t = p.replace(/^@+/, '').toLowerCase();
                    if (/^[a-z0-9._]{2,30}$/.test(t) && /[a-z]/i.test(t)) out.add(t);
                });
            });
            for (const attr of row.attributes || []) {
                try {
                    const n = attr.name || '';
                    const v = (attr.value || '').trim();
                    if (!v) continue;
                    if (/user|name|handle/i.test(n) && /^[A-Za-z0-9._@]{2,40}$/.test(v)) {
                        out.add(v.replace(/^@+/, '').toLowerCase());
                    }
                } catch {}
            }
        } catch {}
        return Array.from(out);
    }

    function collapseElement(element, force = false) {
        if (!element) return;
        if (hiddenElements.has(element)) return;
        if (!force && isCoreContainer(element)) return;
        stripImagesWithin(element);
        element.setAttribute(HIDE_ATTR, '1');
        hiddenElements.add(element);
    }
    function blockRow(row, reason) {
        collapseElement(row, true);
        row.setAttribute(IG_SEARCH_HIDDEN_ATTR, reason || 'blocked');
    }
    function approveRow(row) {
        row.removeAttribute(HIDE_ATTR);
        row.removeAttribute(IG_SEARCH_HIDDEN_ATTR);
        row.setAttribute(APPROVE_ATTR, '1'); // used by approve-gate CSS to reveal
    }

    // Collect rows from explicit roots, left-rail chain, and a global heuristic
    function collectSearchRows() {
        const rows = new Set();

        // Ensure roots are marked (includes left-rail chain)
        markSearchRoots();

        // Explicit widgets + marked roots
        document.querySelectorAll(
            `[${SEARCH_ROOT_ATTR}="1"] [role="option"], [${SEARCH_ROOT_ATTR}="1"] li, [${SEARCH_ROOT_ATTR}="1"] a[role="link"], [${SEARCH_ROOT_ATTR}="1"] a._a6hd, [${SEARCH_ROOT_ATTR}="1"] a[href]`
        ).forEach(n => rows.add(getSearchRowElement(n)));
        document.querySelectorAll(
            `[${SEARCH_ROOT_ATTR}="1"] div[role="link"], [${SEARCH_ROOT_ATTR}="1"] div[role="button"][tabindex], [${SEARCH_ROOT_ATTR}="1"] div[role="menuitem"], [${SEARCH_ROOT_ATTR}="1"] div[role="option"]`
        ).forEach(n => rows.add(getSearchRowElement(n)));

        // Heuristic fallback: search-suggestion anchors anywhere (covers nested/pressable)
        document.querySelectorAll('a[href^="/"][role="link"], a._a6hd[href^="/"]').forEach(a => {
            if (isLikelySearchSuggestionAnchor(a)) rows.add(getSearchRowElement(a));
        });

        return Array.from(rows);
    }

    function currentQueryIsBanned() {
        const sb = getSearchBox();
        if (!sb) return false;
        const q = (sb.value || '').trim();
        if (!q) return false;
        if (matchesAnyBanned(q)) return true;
        const qUser = q.replace(/^@+/, '');
        if (instagramAccountsSet.has(qUser.toLowerCase())) return true;
        return false;
    }

    function hideInstagramSearchResults() {
        if (!location.hostname.endsWith('instagram.com')) return;

        const rows = collectSearchRows();
        if (!rows.length) return;

        // If typed query itself is banned, hide all visible rows
        if (currentQueryIsBanned()) {
            rows.forEach(r => blockRow(r, 'query-is-banned'));
            return;
        }

        const limit = 1400;
        for (let i = 0; i < rows.length && i < limit; i++) {
            const row = rows[i];
            try {
                if (row.hasAttribute(IG_SEARCH_HIDDEN_ATTR)) continue;

                let a = row.matches('a[href]') ? row : row.querySelector('a[href]');
                const href = a ? (a.getAttribute('href') || '') : '';
                let normalizedPath = '';
                if (href) {
                    try { normalizedPath = new URL(href, location.origin).pathname.toLowerCase(); }
                    catch { normalizedPath = (href.split('?')[0] || '').toLowerCase(); }
                }

                let decided = false;

                // Explicit banned posts
                if (!decided && normalizedPath.startsWith('/p/')) {
                    for (let i2 = 0; i2 < instagramBannedPosts.length; i2++) {
                        const pid = instagramBannedPosts[i2].toLowerCase();
                        if (normalizedPath.includes(`/${pid}`)) {
                            blockRow(row, `post:${pid}`); decided = true; break;
                        }
                    }
                }

                // Banned accounts / username contains banned keywords/regex
                if (!decided) {
                    const userFromHref = href ? usernameFromHref(href) : '';
                    if (userFromHref) {
                        if (instagramAccountsSet.has(userFromHref)) { blockRow(row, `user:${userFromHref}`); decided = true; }
                        else if (matchesAnyBanned(userFromHref)) { blockRow(row, `user-keyword:${userFromHref}`); decided = true; }
                    }
                }

                // If still undecided, extract username-like tokens from row text/labels/attrs
                if (!decided) {
                    const cands = extractUserCandidatesFromRow(row);
                    for (const cand of cands) {
                        if (instagramAccountsSet.has(cand)) { blockRow(row, `user:${cand}`); decided = true; break; }
                        if (matchesAnyBanned(cand)) { blockRow(row, `user-keyword:${cand}`); decided = true; break; }
                    }
                }

                // Text-based fallback on row content/labels
                if (!decided) {
                    const t = collectRowTexts(row);
                    const why = matchesBannedByText(t);
                    if (why) { blockRow(row, why); decided = true; }
                }

                if (!decided) approveRow(row);
                else row.removeAttribute(APPROVE_ATTR); // ensure blocked rows aren't approved
            } catch {}
        }
    }

    // “Myös Metalta” hard hider
    function hideMyosMetaltaElements() {
        const now = performance.now();
        if ((now - lastMyosSweep) < PACE.myosMinMs) return;
        lastMyosSweep = now;

        document.querySelectorAll('svg[aria-label*="Myös Metalta" i]').forEach(svg => {
            let c = svg.closest('a, button, div[role="button"], div[role="link"], [tabindex]') || svg.parentElement;
            let hops = 0;
            while (c && hops < 6 && !isCoreContainer(c)) {
                if (c.matches('a, button, div[role="button"], div[role="link"], [tabindex]')) { collapseElement(c, true); break; }
                c = c.parentElement; hops++;
            }
        });
        document.querySelectorAll('[aria-label*="Myös Metalta" i], [title*="Myös Metalta" i]').forEach(el => {
            if (hiddenElements.has(el)) return;
            let c = el.closest('a, button, div[role="button"], div[role="link"], [tabindex]') || el.parentElement;
            let hops = 0;
            while (c && hops < 6 && !isCoreContainer(c)) {
                if (c.matches('a, button, div[role="button"], div[role="link"], [tabindex]')) { collapseElement(c, true); return; }
                c = c.parentElement; hops++;
            }
            collapseElement(el, true);
        });

        // SAFE walker root (fixes "parameter 1 is not of type 'Node'" when body is null)
        const root = document.body || document.documentElement;
        if (!root || !(root instanceof Node)) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            const txt = (node.nodeValue || '').trim();
            if (!txt) continue;
            if (/myös metalta/i.test(txt)) {
                const el = node.parentElement;
                if (!el) continue;
                const clickable = el.closest('a, button, div[role="button"], div[role="link"], [tabindex]') || el;
                if (!isCoreContainer(clickable)) collapseElement(clickable, true);
            }
        }
    }

    function hideSettingsPageElements() {
        if (!location.pathname.includes('/accounts/') && !location.pathname.includes('/settings/')) return;

        const now = performance.now();
        if (settingsSweepPath === location.pathname && (now - lastSettingsSweep) < PACE.settingsMinMs) return;
        settingsSweepPath = location.pathname;
        lastSettingsSweep = now;

        const hiddenWordsSelectors = [
            'a[href*="hidden_words"]',
            'a[href*="piiloitetut_sanat"]',
            'a[href*="settings/v2/hidden_words"]',
            'a[href*="accounts/settings/v2/hidden_words"]',
            'a[href*="hide_story_and_live"]',
            'a[href*="/accounts/hide_story_and_live/"]',
            '[href*="hidden_words"]',
            '[href*="piiloitetut_sanat"]',
            '[href*="hide_story_and_live"]'
        ];
        hiddenWordsSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                let container = element;
                let level = 0;
                while (container && level < 8) {
                    if (container.tagName === 'DIV' && 
                        (container.classList.contains('x9f619') || 
                         container.classList.contains('x1i10hfl') ||
                         container.classList.contains('x1n2onr6'))) {
                        const childCount = container.querySelectorAll('*').length;
                        if (childCount < 50) { collapseElement(container, true); break; }
                    }
                    container = container.parentElement; level++;
                }
            });
        });
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (hiddenElements.has(element)) return;
            const text = element.textContent ? element.textContent.trim() : '';
            if (text === 'Piiloitetut sanat' || text === 'Hidden Words' || text === 'Restricted accounts' || text === 'Rajoitetut tilit' || text === 'Piilota tarinat ja livet' || text === 'Hide stories and live') {
                let container = element;
                let level = 0;
                while (container && level < 8) {
                    if (container.tagName === 'A' || 
                        container.getAttribute('role') === 'button' ||
                        container.classList.contains('x1i10hfl') ||
                        (container.tagName === 'DIV' && container.classList.contains('x9f619') && container.onclick)) {
                        const siblingCount = container.parentElement ? container.parentElement.children.length : 0;
                        const childCount = container.querySelectorAll('*').length;
                        if (siblingCount > 1 && childCount < 100) { collapseElement(container, true); break; }
                    }
                    container = container.parentElement; level++;
                }
            }
        });
        const allTextElements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6, a, button');
        allTextElements.forEach(element => {
            if (hiddenElements.has(element)) return;
            const text = element.textContent ? element.textContent.trim() : '';
            if ((text === 'Piiloitetut sanat' || text === 'Hidden Words' || text === 'Piilota tarinat ja livet' || text === 'Hide stories and live')
                && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0) {
                collapseElement(element, true);
                const parent = element.parentElement;
                if (parent && parent.querySelectorAll('*').length < 20) collapseElement(parent, true);
            }
        });
    }

    // Inject CSS
    const injectInlineCSS = () => {
        try {
            const styleId = 'extra-redirect-style';
            let style = document.getElementById(styleId);
            if (!style) { style = document.createElement('style'); style.id = styleId; }
            const searchBanCSS = buildSearchBanCSS();

            // RESTORED approve-gate CSS for search and feed
            const approveGateCSS = `
/* Approve-gate: hide all suggestion rows by default inside listbox */
[role="listbox"] [role="option"]:not([${APPROVE_ATTR}="1"]),
[role="listbox"] li:not([${APPROVE_ATTR}="1"]),
[role="listbox"] a[role="link"]:not([${APPROVE_ATTR}="1"]),
[role="listbox"] a._a6hd:not([${APPROVE_ATTR}="1"]),
[role="listbox"] a.x1i10hfl:not([${APPROVE_ATTR}="1"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
    left: -9999px !important;
    top: -9999px !important;
    height: 0 !important;
    width: 0 !important;
}
/* Approve-gate: approved rows become visible and clickable */
[role="listbox"] [${APPROVE_ATTR}="1"] {
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    position: static !important;
    height: auto !important;
    width: auto !important;
    overflow: visible !important;
}
/* Feed approve-gate: hide all articles by default; we mark approved after filtering */
article:not([${APPROVE_ATTR}="1"]) {
    visibility: hidden !important;
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
    left: -9999px !important;
    top: -9999px !important;
    height: 0 !important;
    width: 0 !important;
    max-height: 0 !important;
    max-width: 0 !important;
    overflow: hidden !important;
}
`;

            const attrHideCSS = `
[${HIDE_ATTR}="1"] {
  visibility: hidden !important;
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  height: 0 !important;
  width: 0 !important;
  max-height: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  flex: 0 0 0px !important;
  grid: none !important;
  transition: none !important;
}
`;
            style.textContent = `
${attrHideCSS}

${selectorsToHide.join(',\n')} {
  visibility: hidden !important;
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  height: 0 !important;
  width: 0 !important;
  max-height: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  flex: 0 0 0px !important;
  grid: none !important;
  transition: none !important;
}

/* Settings-page explicit links */
[href*="hidden_words"], [href*="piiloitetut_sanat"], [href*="restricted_accounts"], [href*="rajoitetut_tilit"], [href*="hide_story_and_live"] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  overflow: hidden !important;
}

/* Pre-hide banned accounts inside ALL search roots (roles + left-rail chain) AND classic listboxes */
${searchBanCSS}

/* RESTORED approve-gates for search + feed */
${approveGateCSS}
`;
            if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
        } catch {}
    };
    injectInlineCSS();

    function hasFollowButtons(scope) {
        return !!Array.from(scope.querySelectorAll('button, div[role="button"]')).find(b => /Seuraa|Following|Follow/i.test(b.textContent || ''));
    }

    function hideRecommendedSections() {
        try {
            ['Sinulle ehdotettua', 'Suggested for you'].forEach(txt => {
                document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span').forEach(el => {
                    if (hiddenElements.has(el)) return;
                    if ((el.textContent || '').trim() === txt) {
                        const sec = el.closest('section');
                        if (sec && (sec.querySelector('ul._acay') || hasFollowButtons(sec) || sec.querySelector('svg[aria-label="Ohita"]'))) collapseElement(sec);
                    }
                });
            });
            ['Näytä kaikki', 'Show all'].forEach(txt => {
                document.querySelectorAll('a._a6hd, a[role="link"], button, span').forEach(el => {
                    if (hiddenElements.has(el)) return;
                    if ((el.textContent || '').trim() === txt) {
                        const sec = el.closest('section');
                        if (sec && (sec.querySelector('ul._acay') || hasFollowButtons(sec))) collapseElement(sec);
                    }
                });
            });
            document.querySelectorAll('section').forEach(sec => {
                if (hiddenElements.has(sec)) return;
                const hasCarousel = !!sec.querySelector('ul._acay');
                const hasClose = !!sec.querySelector('svg[aria-label="Ohita"]');
                const manyFollows = Array.from(sec.querySelectorAll('button, div[role="button"]')).filter(b=>/Seuraa|Following|Follow/i.test(b.textContent||'')).length >= 3;
                if (hasCarousel && (hasClose || manyFollows)) collapseElement(sec);
            });
        } catch {}
    }

    // Helper: is element inside ANY protected container?
    function isInsideProtected(el) {
        try {
            for (let i = 0; i < protectedElements.length; i++) {
                const sel = protectedElements[i];
                try { if (el.closest(sel)) return true; } catch {}
            }
        } catch {}
        return false;
    }

    function collapseElementsBySelectors(selectors) {
        if (isReelsPage()) return;
        if (!selectors || !selectors.length) return;
        const roots = getScanRoots();
        const allSelectors = selectors.join(',');
        roots.forEach(root => {
            root.querySelectorAll(allSelectors).forEach(element => {
                if (hiddenElements.has(element)) return;
                if (isCoreContainer(element)) return;
                if (element.querySelector && element.querySelector('article')) return;
                const isProtected = protectedElements.some(protectedSelector => { try { return element.matches(protectedSelector) || !!element.closest(protectedSelector); } catch { return false; } });
                const containsAllowedWords = allowedWordsLower.some(word => element.textContent && element.textContent.toLowerCase().includes(word));
                if (!isProtected && !containsAllowedWords && !isExcludedPath()) collapseElement(element);
            });
        });
        scheduleSearchSweep();
    }

    function collapseElementsByKeywordsOrPaths(keywords, paths, selectors) {
        if (isReelsPage()) return;
        if (!selectors || !selectors.length) return;
        const roots = getScanRoots();
        const allSelectors = selectors.join(',');
        roots.forEach(root => {
            root.querySelectorAll(allSelectors).forEach(element => {
                if (hiddenElements.has(element)) return;
                if (isCoreContainer(element)) return;
                const isProtected = protectedElements.some(protectedSelector => { try { return element.matches(protectedSelector) || !!element.closest(protectedSelector); } catch { return false; } });
                if (isProtected) return;
                if (isExcludedPath()) return;
                const textContent = element.textContent ? element.textContent.toLowerCase() : "";
                if (allowedWordsLower.some(word => textContent.includes(word))) return;
                let matched = false;
                for (let i = 0; i < bannedKeywordsLower.length; ++i) { if (textContent.includes(bannedKeywordsLower[i])) { matched = true; break; } }
                for (let i = 0; i < instagramBannedPathsLower.length; ++i) { if (textContent.includes(instagramBannedPathsLower[i])) { matched = true; break; } }
                if (!matched) { for (let i = 0; i < bannedRegexes.length; ++i) { if (bannedRegexes[i].test(element.textContent)) { matched = true; break; } } }
                if (matched) {
                    const parentArticle = element.closest('article');
                    if (parentArticle && !hiddenElements.has(parentArticle)) {
                        const containsAllowedWords2 = allowedWordsLower.some(word => parentArticle.textContent && parentArticle.textContent.toLowerCase().includes(word));
                        if (!containsAllowedWords2) {
                            Array.from(parentArticle.children).forEach(child => { child.style.setProperty('display', 'none', 'important'); });
                            hiddenElements.add(parentArticle);
                        }
                    } else if (!isInsideProtected(element)) {
                        collapseElement(element);
                    }
                }
            });
        });
        textBasedTargets.forEach(target => {
            document.querySelectorAll(target.selector).forEach(element => {
                if ((element.textContent || '').trim() === target.text) {
                    if (!hiddenElements.has(element) && !isCoreContainer(element) && !isInsideProtected(element)) {
                        const isProtected = protectedElements.some(protectedSelector => { try { return element.matches(protectedSelector) || !!element.closest(protectedSelector); } catch { return false; } });
                        if (!isProtected) collapseElement(element);
                    }
                }
            });
        });
        scheduleSearchSweep();
    }

    function collapseReelsElementsByKeywordsOrPaths() { return; }
    function collapseElementsOnExcludedPaths() {
        if (!isExcludedPath()) return;
        if (!selectorsForExcludedPaths.length) return;
        const allSelectors = selectorsForExcludedPaths.join(',');
        document.querySelectorAll(allSelectors).forEach(element => { collapseElement(element); });
    }
    function isExcludedPath() { return excludedPaths.some(path => currentURL.indexOf(path) !== -1); }

    function checkForRedirectElements() {
        if (!location.hostname.endsWith('instagram.com')) return;
        if (!/\/(ai|meta-ai|threads|explore|reels)\b/.test(location.pathname)) return;
        const foundElements = document.querySelectorAll(selectorsToMonitorAndRedirect.join(','));
        if (foundElements.length > 0) fastRedirect('https://www.instagram.com');
    }
    function forceHideRecommendedCarousels() {
        try {
            document.querySelectorAll('section').forEach(sec => {
                if (hiddenElements.has(sec)) return;
                const hasCarousel = !!sec.querySelector('ul._acay');
                const hasClose = !!sec.querySelector('svg[aria-label="Ohita"]');
                const manyFollows = Array.from(sec.querySelectorAll('button, div[role="button"]')).filter(b=>/Seuraa|Following|Follow/i.test(b.textContent||'')).length >= 3;
                if (hasCarousel && (hasClose || manyFollows)) collapseElement(sec);
            });
        } catch {}
    }

    // Additional helper: detect and redirect from private profile pages (restored behavior)
    function isLikelyProfilePage() {
        try {
            const parts = (location.pathname || '').split('/').filter(Boolean);
            if (!parts.length) return false;
            const first = parts[0];
            if (['explore','reels','p','accounts','direct','stories','ai','meta-ai'].includes(first)) return false;
            return true;
        } catch { return false; }
    }
    function shouldRedirectPrivatePageFast() {
        if (!location.hostname.endsWith('instagram.com')) return false;
        if (!isLikelyProfilePage()) return false;
        if (isExcludedPath()) return false;
        // Look for common "private account" strings across locales
        const needles = [
            'this account is private', // EN
            'tili on yksityinen', 'tämä tili on yksityinen', 'yksityinen tili', // FI variants
            'este perfil es privado', // ES
            'cet compte est privé', 'ce compte est privé', // FR
            'dieses konto ist privat', // DE
            'questo account è privato', // IT
            'este conta é privada', 'esta conta é privada', // PT
            'このアカウントは非公開です', // JA
            'этот аккаунт закрыт', // RU
        ];
        try {
            const hay = (document.body?.innerText || document.body?.textContent || '').toLowerCase();
            if (!hay) return false;
            return needles.some(s => hay.includes(s));
        } catch { return false; }
    }
    function checkAndRedirectPrivatePage() {
        try {
            if (shouldRedirectPrivatePageFast()) {
                window.stop?.();
                fastRedirect('https://www.instagram.com');
                return true;
            }
        } catch {}
        return false;
    }

    // SAFEGUARD: Always remove the startup shield once DOM is ready to avoid "stuck" blank states.
    onEvent(document, 'DOMContentLoaded', () => { try { markReady(); } catch {} }, { once: true });

    const hideCriticalElements = () => {
        // Avoid aggressive critical hides on DMs/inbox routes to protect the left users menu.
        if (isExcludedPath()) {
            // still keep search filtering responsive
            markSearchRoots();
            scheduleSearchSweep(true);
            return;
        }

        const roots = getScanRoots();

        // Never collapse top-level navigation in the critical pass (prevents left-rail/nav vanishing)
        const SKIP_ALWAYS_IN_CRITICAL = new Set([
            'nav[aria-label*="Primary"]',
            'nav[role="navigation"]'
        ]);

        selectorsToHide.forEach(selector => {
            if (SKIP_ALWAYS_IN_CRITICAL.has(selector)) return;
            roots.forEach(root => {
                root.querySelectorAll(selector).forEach((el) => {
                    if (!hiddenElements.has(el) && !isCoreContainer(el)) collapseElement(el);
                });
            });
        });
        hideRecommendedSections();
        forceHideRecommendedCarousels();
        hideMyosMetaltaElements();
        hideSettingsPageElements();
        markSearchRoots();
        scheduleSearchSweep(true);
    };
    hideCriticalElements();

    function isReelsPage() { return location.pathname.includes('/reels/') || location.pathname.startsWith('/reels'); }
    function injectReelsCSS() {
        if (!isReelsPage()) return;
        if (reelsStyleInjected && document.getElementById('reels-navigation-hider')) return;
        const css = `
            a[href="/ai/"], a[href="/meta-ai/"], a[aria-label*="Meta AI"], *[aria-label="Meta AI"],
            [data-testid*="meta-ai"], [data-testid*="metaai"],
            [aria-label*="Myös Metalta"], [title*="Myös Metalta"], svg[aria-label*="Myös Metalta"],
            div[role="button"][tabindex][aria-label="Tutki"], svg[aria-label="Tutki"],
            a[href="/explore/"], a.x1i10hfl[href*="threads"], a[href*="/threads"] {
                display: none !important; visibility: hidden !important; opacity: 0 !important;
                height: 0 !important; width: 0 !important; max-height: 0 !important; max-width: 0 !important;
                overflow: hidden !important; position: absolute !important; left: -9999px !important; top: -9999px !important;
            }
        `;
        let style = document.getElementById('reels-navigation-hider');
        if (!style) { style = document.createElement('style'); style.id = 'reels-navigation-hider'; }
        style.textContent = css;
        if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
        reelsStyleInjected = true;
    }
    function removeReelsCSS() { try { document.getElementById('reels-navigation-hider')?.remove(); } catch {} reelsStyleInjected = false; }

    function igBlankOutPage() {
        try {
            let s = document.getElementById('ig-blank-style');
            if (!s) {
                s = document.createElement('style'); s.id = 'ig-blank-style';
                s.textContent = `html, body { background: #fff !important; } body > * { display: none !important; visibility: hidden !important; }`;
                (document.head || document.documentElement).appendChild(s);
            }
            document.documentElement.style.background = '#fff';
            if (document.body) document.body.style.background = '#fff';
        } catch {}
    }
    function fastRedirect(target) {
        if (__isRedirectingFast) return;
        __isRedirectingFast = true;
        try { if (typeof window.stop === "function") window.stop(); } catch(e){}
        igBlankOutPage();
        try { window.location.replace(target); return; } catch(e){}
        try { window.location.assign(target); return; } catch(e){}
        try { window.location.href = target; } catch(e){}
    }

    // URL-level ban matching and redirect
    function hasBannedMatchInToken(token, useAllowedWords = true) {
        if (!token || typeof token !== 'string') return false;
        const raw = token; const low = raw.toLowerCase();
        if (useAllowedWords && allowedWordsLower.some(w => low.includes(w))) return false;
        if (bannedKeywordsLower.some(kw => kw && low.includes(kw))) return true;
        for (const rx of bannedRegexes) { try { if (rx.test(raw)) return true; } catch {} }
        return false;
    }
    function extractRelevantURLTokensFromLocation(rawUrl) {
        const tokens = [];
        try {
            const u = new URL(rawUrl, location.origin);
            const pathname = u.pathname || '';
            const parts = pathname.split('/').filter(Boolean);
            if (parts.length) {
                const first = parts[0];
                if (!['explore','reels','p','accounts','direct','stories','ai','meta-ai'].includes(first)) tokens.push(parts[0]); // username
                if (first === 'explore' && parts[1] === 'tags' && parts[2]) tokens.push(parts[2]);
                if (first === 'stories' && parts[1]) tokens.push(parts[1]);
            }
            const keys = ['q','query','keyword','search'];
            for (const k of keys) {
                const v = u.searchParams.get(k);
                if (v) tokens.push(v);
            }
        } catch {}
        return tokens;
    }
    function shouldRedirectByBannedInURL(rawUrl) {
        try {
            const u = new URL(rawUrl, location.origin);
            const host = u.hostname || '';
            if (!host.endsWith('instagram.com') && !host.endsWith('threads.net')) return false;

            const tokens = extractRelevantURLTokensFromLocation(rawUrl);
            for (const t of tokens) {
                try {
                    const tok = decodeURIComponent(t).trim();
                    if (!tok) continue;
                    if (instagramAccountsSet.has(tok.toLowerCase())) return true;
                    if (hasBannedMatchInToken(tok, true)) return true;
                } catch {
                    if (t && hasBannedMatchInToken(t, true)) return true;
                }
            }

            if (isExcludedPath()) return false;

            const pathLike = (u.pathname || '');
            if (pathLike.startsWith('/p/') || pathLike.startsWith('/explore') || pathLike.includes('/search')) {
                let full = '';
                try { full = decodeURIComponent((u.pathname || '') + (u.search || '') + (u.hash || '')); }
                catch { full = (u.pathname || '') + (u.search || '') + (u.hash || ''); }
                if (hasBannedMatchInToken(full, true)) return true;
            }
            return false;
        } catch { return false; }
    }
    function shouldInstagramRedirect() {
        const url = window.location.href;
        for (let i = 0; i < instagramBannedPaths.length; ++i) if (url.includes(instagramBannedPaths[i])) return true;
        if (shouldRedirectByBannedInURL(url)) return true;
        return false;
    }
    if (location.hostname.endsWith('instagram.com') && shouldInstagramRedirect()) { fastRedirect("https://www.instagram.com"); return; }
    if (isReelsPage()) injectReelsCSS();

    function querySelectorAllWithContains(selector, containsText) {
        const elements = document.querySelectorAll(selector); const matching = [];
        for (let i = 0; i < elements.length; i++) if ((elements[i].textContent || '').trim() === containsText) matching.push(elements[i]);
        return matching;
    }

    // RESTORED from Old
    function approveAllNonHiddenArticles() {
        document.querySelectorAll('article').forEach(a => {
            if (!a.hasAttribute(HIDE_ATTR)) {
                a.setAttribute(APPROVE_ATTR, '1');
            }
        });
    }

    function genericAggressiveHider() {
        if (!location.hostname.endsWith('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;
        if (!document.body) return;
        const now = performance.now();
        if ((now - lastGenericAggressiveRun) < PACE.genericMinMs) return;
        lastGenericAggressiveRun = now;

        const scopes = [];
        document.querySelectorAll('article').forEach(el => scopes.push(el));
        document.querySelectorAll(`[${SEARCH_ROOT_ATTR}="1"], [role="listbox"], [role="menu"]`).forEach(el => scopes.push(el));
        if (!scopes.length) return;

        scopes.forEach(root => {
            if (!root || !(root instanceof Node)) return; // Added check to prevent TypeError
            const nodes = [];
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            let node; while ((node = walker.nextNode())) nodes.push(node);
            nodes.forEach(n => {
                const low = (n.nodeValue || '').toLowerCase(); if (!low) return;
                if (allowedWordsLower.some(word => low.includes(word))) return;
                if (bannedKeywordsLower.some(keyword => low.includes(keyword))) {
                    const el = n.parentElement;
                    if (el && el.offsetParent !== null && !isCoreContainer(el) && !isInsideProtected(el)) collapseElement(el);
                }
            });
            nodes.forEach(n => {
                const txt = n.nodeValue || ''; if (allowedWordsLower.some(word => txt.toLowerCase().includes(word))) return;
                if (bannedRegexes.some(re => re.test(txt))) {
                    const el = n.parentElement;
                    if (el && el.offsetParent !== null && !isCoreContainer(el) && !isInsideProtected(el)) collapseElement(el);
                }
            });
        });
    }

    function handleRedirectionsAndContentHiding() {
        currentURL = window.location.href;

        if (currentURL.includes('www.threads.')) { window.stop(); fastRedirect('https://www.instagram.com'); return; }
        if (instagramBannedPaths.some(path => currentURL.includes(path))) { window.stop(); fastRedirect('https://www.instagram.com'); return; }
        if (shouldRedirectByBannedInURL(currentURL)) { window.stop(); fastRedirect('https://www.instagram.com'); return; }

        // RESTORED: redirect away from private profile pages
        if (checkAndRedirectPrivatePage()) return;

        if (location.hostname.endsWith('instagram.com') && location.pathname.match(/\/(followers|following)/)) return;
        if (isReelsPage()) { injectReelsCSS(); return; }
        if (isExcludedPath()) { collapseElementsOnExcludedPaths(); return; }

        collapseElementsBySelectors(selectorsToHide);
        hideRecommendedSections();
        collapseElementsByKeywordsOrPaths(bannedKeywords, instagramBannedPaths, selectorsToMonitor);
        checkForRedirectElements();
        hideMyosMetaltaElements();
        hideSettingsPageElements();
        markSearchRoots();
        scheduleSearchSweep();
    }

    function hideInstagramAccountsFromList() {}

    function hideInstagramBannedContent() {
        if (!location.hostname.endsWith('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;

        instagramBannedPosts.forEach(postId => {
            if (location.pathname.toLowerCase().includes(postId.toLowerCase())) {
                document.querySelectorAll('article, div[data-testid="post"]').forEach(element => { collapseElement(element, true); });
            }
        });
        instagramAccountsToHideLower.forEach(account => {
            if (location.pathname.toLowerCase() === `/${account}/` || location.pathname.toLowerCase().startsWith(`/${account}/`)) {
                const main = document.querySelector('main'); if (main) collapseElement(main, true);
            }
        });

        scheduleSearchSweep();
    }

    function runThrottledMain(force = false) {
        const now = performance.now();
        if (!force && (now - lastMainHandlerRun) < PACE.mainMinMs) { scheduleSearchSweep(); return; }
        lastMainHandlerRun = now;

        handleRedirectionsAndContentHiding();
        if (isReelsPage()) { markReady(); return; }
        if (location.hostname.endsWith('instagram.com') && location.pathname.match(/\/(followers|following)/)) { hideInstagramAccountsFromList(); markReady(); return; }
        if (location.hostname.endsWith('instagram.com')) {
            hideInstagramBannedContent();
            hideRecommendedSections();
            genericAggressiveHider();
            checkForRedirectElements();
            hideMyosMetaltaElements();
            hideSettingsPageElements();

            // RESTORED approve pattern and kept New’s marking
            document.querySelectorAll('article').forEach(a => { if (!a.hasAttribute(HIDE_ATTR)) a.setAttribute(APPROVE_ATTR, '1'); });
            approveAllNonHiddenArticles();

            scheduleSearchSweep(true);
        }
        markReady();
    }

    function observerCallback() {
        if (__observerTimeoutId !== null) { try { clearTimeout(__observerTimeoutId); __timers.timeouts.delete(__observerTimeoutId); } catch {} __observerTimeoutId = null; }
        __observerTimeoutId = setTimeout(() => {
            try { __timers.timeouts.delete(__observerTimeoutId); } catch {}
            __observerTimeoutId = null;

            // Check private page on dynamic changes too
            if (checkAndRedirectPrivatePage()) return;

            if (isReelsPage()) return;
            if (location.hostname.endsWith('instagram.com') && location.pathname.match(/\/(followers|following)/)) { hideInstagramAccountsFromList(); return; }
            if (isExcludedPath()) { collapseElementsOnExcludedPaths(); return; }
            collapseElementsBySelectors(selectorsToHide);
            hideRecommendedSections();
            collapseElementsByKeywordsOrPaths(bannedKeywords, instagramBannedPaths, selectorsToMonitor);
            if (location.hostname.endsWith('instagram.com')) {
                hideInstagramBannedContent();
                genericAggressiveHider();
                checkForRedirectElements();
                hideMyosMetaltaElements();
                hideSettingsPageElements();
                markSearchRoots();
                scheduleSearchSweep();

                // RESTORED approve helper
                approveAllNonHiddenArticles();
            }
        }, 120);
        __timers.timeouts.add(__observerTimeoutId);
    }

    function initObserver() {
        const observer = trackObserver(new MutationObserver(observerCallback));
        function startObserve() {
            if (document.body) observer.observe(document.body, { childList: true, subtree: true });
            else onEvent(document, 'DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), false);
        }
        startObserve();
    }

    function mainHandler() { runThrottledMain(false); }

    mainHandler();
    initObserver();

    // Search sweeps while typing and when focusing the search box
    onEvent(document, 'input', (e) => {
        const t = e.target;
        if (t && t.matches?.('input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"], input[aria-label*="Haku"]')) scheduleSearchSweep(true);
    }, true);
    onEvent(document, 'focusin', (e) => {
        const t = e.target;
        if (t && t.matches?.('input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"], input[aria-label*="Haku"]')) scheduleSearchSweep(true);
    }, true);

    function scheduleIntervals() {
        addInterval(() => {
            if (__cleanupRan) return;
            if (!isReelsPage() && !document.hidden) runThrottledMain(false);
        }, 220);
    }
    startIntervals(scheduleIntervals);

    function preUnloadShield() {
        applyInlineShield();
        try { document.documentElement.setAttribute('data-ig-startup', '1'); } catch {}
    }
    window.addEventListener('beforeunload', preUnloadShield, true);

    function handleVisibilityChange() {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleIntervals);
            runThrottledMain(true);
        }
    }
    onEvent(document, 'visibilitychange', handleVisibilityChange, false);

    (function() {
        var _wr = function(type) { var orig = history[type];
            return function() { var rv = orig.apply(this, arguments); window.dispatchEvent(new Event(type)); window.dispatchEvent(new Event('locationchange')); return rv; };
        };
        history.pushState = _wr('pushState');
        history.replaceState = _wr('replaceState');
        onEvent(window, 'popstate', function() { window.dispatchEvent(new Event('locationchange')); }, false);
    })();

    onEvent(window, 'locationchange', function() {
        reelsStyleInjected = false;
        currentURL = window.location.href;
        injectInlineCSS();
        if (isReelsPage()) injectReelsCSS();
        else { removeReelsCSS(); runThrottledMain(true); }
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

    addTimeout(() => { try { markReady(); } catch {} }, 12000);

})();