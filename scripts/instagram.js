// ==UserScript==
// @name         ExtraRedirect-Instagram
// @version      1.6.40-instagram-search-approve-gate-split
// @description  Instagram/Threads/Reels specific logic split from Extra.js
// @match        *://www.instagram.com/*
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
    function addRAF(fn) {
        const id = requestAnimationFrame((ts) => {
            __rafIds.delete(id);
            try { fn(ts); } catch {}
        });
        __rafIds.add(id);
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
    function trackObserver(observer) {
        __observers.add(observer);
        return observer;
    }
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
        } catch {}
    }

    const bannedKeywords = [
        "Bliss", "Alexa Bliss", "Tiffany", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Mercedes", "Alba Fyre", "sensuel", "Maryse", "Meta AI", "Del Rey", "CJ Perry", 
        "Becky Lynch", "Michin", "Mia Yim", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven", "sensuel", "queer", "Pride", "NXT Womens", "model", "Perry", "Henley", "Nattie", 
        "Jordynne", "Woman", "Women", "@tiffanywwe", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Women's", "Woman's", "Summer Rae", "Mia Yim",
        "Naomi", "Bianca Belair", "Jessika Carr", "Carr WWE", "Jessica Karr", "bikini", "Kristen Stewart", "Sydney Sweeney", "Piper Niven", "Nia Jax", "Meta AI", "AI generated",
        "Young Bucks", "Jackson", "Lash Legend", "Jordynne Grace", "generated", "DeepSeek", "TOR-Browser", "TOR-selain", "Opera GX", "prostitute", "AI-generated", "Arianna Grace", 
        "deepnude", "undress", "nudify", "nude", "nudifier", "faceswap", "facemorph", "AI app", "Sweeney", "Alexis", "Sydney", "Zelina Vega", "Mandy Rose", "playboy", "Lana", "#AI",
        "Nikki", "Brie", "Bella", "Opera Browser", "by AI", "AI edited", "Safari", "OperaGX", "MS Edge", "Microsoft Edge", "clothes", "Lola Vice", "Vice WWE", "Candice LeRae",
        "crotch", "dress", "dreamtime", "Velvet Sky", "LGBTQ", "panties", "panty", "cloth", "AI art", "cleavage", "deviantart", "All Elite Wrestling", "Trish", "Stratus", "Tutki",
        "Tiffy Time", "Steward", "Roxanne", "cameltoe", "dreamtime AI", "Joanie", "bra", "Stewart", "Isla Dawn", "escort", "inpaint", "photopea", "onlyfans", "fantime", "Amari Miller", 
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
        "#ass", "#perse", "#pylly", "#tissit", "#tit", "#tits", "#boob", "#boobs", "#boobies", "#boobie", "#booty", "#butt", "#babe",
    ];

    const bannedRegexes = [
        /Steph's/i, /Stephanie's/i, /Steph/i, /Stephanie/i, /Stepan/i, /Stratu/i, /Stratt/i, /Tiffa/i, /Tiffy/i, /Trish/i, /Sasha/i, /lex bl/i, /lesb/i, /homo/i, /transvestite/i,  
        /\bHer\b/i, /\bShe\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bHers\b/i, /\bShes\b/i, /\bBy AI\b/i, /\bAlexa\b/i, /\bTiffy\b/i, /Shirai/i, /\bCharlotte\b/i, /\bGina\b/i, /\bGin4\b/i, 
        /\bG1n4\b/i, /Gina Adam/i, /Gina Adams/i, /\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /\bGina\b/i, /\bGigi\b/i, /\bDolin\b/i, /\bSarah\b/i, /pride/i, /transve/i, /\bAI-generated\b/i, 
        /\bHMW\b/i, /\bBO6\b/i, /\bBO7\b/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenn1/i, /J3nn1/i, /J3nni/i, /J3nn4/i, /Jenn4/i, /Dua Lipa/i, /Dualipa/i, /Jenna/i, 
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
        'taymelo',
        'hikaru_shida',
        'riho_ringstar',
        'gailkimitsme',
        'deonnapurrazzo',
        'jordynnegrace',
        'mickiejames',
        'trinity_fatu',
        'm1mmuska',
        'mimmi',
        'coupleskink',
        'relationshipkink',
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
        'cheerleadermelissa',
        'kaseykatal',
        'martibelle',
        'brittbaker',
        'kylierae',
        'savannahevanswrestling',
        'martibelle',
        'holidead',
        'ladyfrost',
        'rebeltanea',
        'diamante_lax',
        'stephdelander',
        'killerkellywrestling',
        'alishawrestling',
        'gisele.shaw',
        'rachelellering',
        'tanyaraymond',
        'tessablanchard',
        'tessablanchard',
        'thealliebunny',
        'taya_valkyrie',
        'thedemonbunny',
        'rosemarythehive',
        'siennawrestling',
        'madisonrayne',
        'jordynnegrace',
        'suyung',
        'kimber_lee90',
        'kiera_hogan',
        'diamantelax',
        'savannahevanswrestling',
        'ladyfrost',
        'alishawrestling',
        'realtenille',
        'stephaniemcmahon',
        'stephanie_buttermore',
        'stephanie.vaquer',
        'theajmendez',
        'saraya',
        'itsmebayley',
        'biancabelairwwe',
        'charlottewwe',
        'wwe_asuka',
        'kairi_sane_wwe',
        'wwe_mandyrose',
        'mandysacs',
        'sonyadevillewwe',
        'stephaniesanzo',
        'natbynature',
        'laceyevanswwe',
        'shaqwrestling',
        'giuliawrestler',
        'starkz_wrestler',
        'holidead',
        'kylie_rae',
        'brittbaker',
        'krisstatlander',
        'jamiehayter',
        'willowwrestles',
        'skye_by_wrestling',
        'redvelvett',
        'anna_jay_aew',
        'taymelo',
        'tayconti_',
        'serenadeeb',
        'nylarosebeast',
        'thepenelopeford',
        'jadecargill',
        'thunderrosa22',
        'riho_ringstar',
        'emimatsumoto',
        'hikaru_shida',
        'yukisakazaki',
        'mizuki_wrestler',
        'gina.adams',
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

    const protectedElements = [
        'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
        'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate[role="textbox"][spellcheck="true"]',
        'textarea[placeholder="Message..."]',
        'button[type="submit"]',
        'div.x1qjc9v5.x1yvgwvq.x1dqoszc.x1ixjvfu.xhk4uv.x1ke7ulo.x3jqge.x1i7howy.x4y8mfe.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.x78zum5.xdt5ytf.xw7yly9.xktsk01.x1yztbdb.x1d',
        'div.x6s0dn4.x78zum5.x1gg8mnh.x1pi30zi.xlu9dua',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1nhvcw1.xpvyfi4.xzueoph',
        'div.x1i10hfl.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x16tdsg8.x1hl2dhg.xggy1nq.x1a2a7pz.x6s0dn4.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x1ypdohk.x',
        'svg[aria-label="Valitse emoji"]',
        'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
        'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd',
        'svg[aria-label="Äänileike"]',
        'input[accept="audio/*,.mp4,.mov,.png,.jpg,.jpeg"]',
        'svg[aria-label="Lisää kuva tai video"]',
        'svg[aria-label="Valitse GIF-animaatio tai tarra"]',
        'svg[aria-label="Tykkää"]',
        'div[aria-label="Viesti"]',
        'div[role="textbox"]',
        'div.x1qjc9v5.x1yvgwvq.x1dqoszc.x1ixjvfu.xhk4uv.x1ke7ulo.x3jqge.x1i7howy.x4y8mfe.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.x78zum5.xdt5ytf.xw7yly9.xktsk01.x1yztbdb',
        'div.x1n2onr6 > div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
        'div[aria-hidden="true"] > div.xi81zsa.x17qophe.x6ikm8r.x10wlt62.x47corl.x10l6tqk.xlyipyv.x13vifvy.x87ps6o.xuxw1ft.xh8yej3',
        'div.x1i10hfl.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x1mh8g0r.x2lwn1j.xeuugli.x1hl2dhg.xggy1nq.x1a2a7pz.x6s0dn4.xjyslct.x1ejq31n.xd',
        'svg[aria-label="Äänileike"]',
        'div.x6s0dn4.x78zum5 > div.x1i10hfl.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x16tdsg8.x1hl2dhg.xggy1nq.x1a2a7pz.x6s0dn4.xjbqb8w.xd10rxx.x1sy0etr.x17r0t',
        'div.x6s0dn4.x78zum5.x1r8uery.xdt5ytf.x1iyjqo2.x6ikm8r.x10wlt62',
        'div[aria-label="Viesti"], textarea[placeholder="Message..."], svg[aria-label="Valitse emoji"]',
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
        'div[role="dialog"] [role="button"][aria-label="Lähetä"]',
        '[role="button"][aria-label="Lähetä"]',
        'div[role="dialog"] [role="button"][aria-label="Send"]',
        '[role="button"][aria-label="Send"]',
        'div[role="dialog"] div[role="button"][tabindex="0"]:not([aria-disabled="true"])',
        'div[role="dialog"] div[role="button"].x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x10w94by.x1qhh985.x14e42zd.xdl72j9.x2lah0s.x3ct3a4.xdj266r.x14z9mp.xat24cr.x1lziwak.x2lwn1j.xeuugli.xexx8yu.x18d9i69.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1obq294.x5a5i1n.xde0f50.x15x8krk.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x9f619.x9bdzbf.x1ypdohk.x1f6kntn.xwhw2v2.x10w6t97.xl56j7k.x17ydfre.xf7dkkf.xv54qhq.x1n2onr6.x2b8uid.xlyipyv.x87ps6o.x5c86q.x18br7mf.x1i0vuye.xh8yej3.x18cabeq.x158me93.xk4oym4.x1uugd1q.x3nfvp2',

        /* NEW protected selectors for IG share dialog "Lähetä" (Send) button */
        'div[role="button"][tabindex="0"].x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x972fbf.x10w94by.x1qhh985.x14e42zd.xdl72j9.x2lah0s.x3ct3a4.xdj266r.x14z9mp.xat24cr.x1lziwak.x2lwn1j.xeuugli.xexx8yu.x18d9i69.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1obq294.x5a5i1n.xde0f50.x15x8krk.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x9f619.x9bdzbf.x1ypdohk.x1f6kntn.xwhw2v2.x10w6t97.xl56j7k.x17ydfre.xf7dkkf.xv54qhq.x1n2onr6.x2b8uid.xlyipyv.x87ps6o.x5c86q.x18br7mf.x1i0vuye.xh8yej3.x18cabeq.x158me93.xk4oym4.x1uugd1q.x3nfvp2',
        'div.html-div.xexx8yu.x18d9i69.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.x1ys307a.x1yztbdb.xyqm7xq.xdj266r.xpdmqnj.x1g0dm76.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 div > div[role="button"][tabindex="0"].x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x972fbf.x10w94by.x1qhh985.x14e42zd.xdl72j9.x2lah0s.x3ct3a4.xdj266r.x14z9mp.xat24cr.x1lziwak.x2lwn1j.xeuugli.xexx8yu.x18d9i69.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x1lku1pv.x1a2a7pz.x6s0dn4.xjyslct.x1obq294.x5a5i1n.xde0f50.x15x8krk.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x9f619.x9bdzbf.x1ypdohk.x1f6kntn.xwhw2v2.x10w6t97.xl56j7k.x17ydfre.xf7dkkf.xv54qhq.x1n2onr6.x2b8uid.xlyipyv.x87ps6o.x5c86q.x18br7mf.x1i0vuye.xh8yej3.x18cabeq.x158me93.xk4oym4.x1uugd1q.x3nfvp2'
    ];

    const selectorsToHide = [
        '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x1n2onr6 > ._a6hd.x1a2a7pz.xggy1nq.x1hl2dhg.x16',
        '.xvbhtw8.x1j7kr1c.x169t7cy.xod5an3.x11i5rnm.xdj266r.xdt5ytf.x78zum5',
        '.wbloks_79.wbloks_1 > .wbloks_1 > .wbloks_1 > .wbloks_1 > div.wbloks_1',
        '.x1ye3gou.x1l90r2v.xn6708d.x1y1aw1k.xl56j7k.x1qx5ct2.x78zum5.x6s0dn4',
        '.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.xo71vjh.x5pf9jr.x13lgxp2.x168nmei.x78zum5.xjbqb8w.x9f619 > div > div > .xnc8uc2.x11aubdm.xso031l.x1q0q8m5.x1bs97v',
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
        'a.x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x13fuv20.x18b5jzi x1q0g3np x1t7ytsu x972fbf x10w94by x1qhh985 x14e42zd x9f619 x1ypdohk xdl72j9 x2lah0s xe8uvvx xdj266r x14z9mp xat24cr x1lziwak x2lwn1j xe',
        'svg[aria-label="Threads"]',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xyqm7xq.x1ys307a.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'div.x78zum5.xdt5ytf.xdj266r.x14z9mp.xod5an3.x162z183.x1j7kr1c.xvbhtw8',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xv54qhq.xf7dkkf.xjkvuk6.x1iorvi4.x1n2onr6.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x1q0g3np.xqjyukv.x6s0dn4.x1oa3qoh.x1nhvcw1',
        'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x1roi4f4.x1t',
        'a.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16t',
        'div.x9f619.xjbqb8w.x78zum5.xdj266r.x1yztbdb.xyri2b.x1c1uobl.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'div.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1[style*="height: 250px"]',
        'a.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.x1',
        'div.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.xdj266r.x1yztbdb.xyri2b.x1c1uobl.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'a.x1i10hfl[href*="blocked"]',
        'a.x1i10hfl[href*="estetty"]',
        'a.x1i10hfl[href*="Rajoitetut tilit"]',
        'a.x1i10hfl[href*="Restricted accounts"]',
        'a.x1i10hfl[href*="Piiloitetut sanat"]',
        'a.x1i10hfl[href*="Hidden Words"]',
        'a.x1i10hfl[href*="hide_story_and_live"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="blocked"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="estetty"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Rajoitetut tilit"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Restricted accounts"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Piiloitetut sanat"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Hidden Words"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="hide_story_and_live"]',
        '[aria-label*="Myös Metalta"]',
        '[title*="Myös Metalta"]',
        'svg[aria-label*="Myös Metalta"]',
        '[role="navigation"] a[href^="/explore"]',
        'nav[aria-label*="Primary"] a[href^="/explore"]',
        'a[href="/explore/"]',
        'a[href="/explore/?next=%2F"]',
        'a[role="link"][href^="/explore"]'
    ];

    const selectorsToMonitor = [
        'div.x1qjc9v5.x9f619.x78zum5.xg7h5cd.x1mfogq2.xsfy40s.x1bhewko.xgv127d.xh8yej3.xl56j7k',
        'div.x78zum5.xedcshv',
        'div.x78zum5.xl56j7k.x1n2onr6.xh8yej3',
        'img.xz74otr.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1bs05mj.x5yr21d',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x12nagc.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x6s0dn4.x1oa3qoh.x13a6bvl.x1diwwjn.x1247r65',
        'div.html-div',
        'article',
        'video',
        'span',
        'div',
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'a',
        'button',
        'div[role="button"][tabindex][aria-label="Threads"]',
        'div[role="button"][tabindex][aria-label="Tutki"]',
        'div[class*="x1nhvcw1"][class*="xqjyukv"][class*="xdt5ytf"]',
        'span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'a.x1i10hfl[href*="threads"]',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xdj266r.x1yztbdb.xyri2b.x1c1uobl.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'canvas.x1upo8f9.xpdipgo.x87ps6o'
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
        { selector: 'button', text: 'Piiloitetut sanat' },
        { selector: 'button', text: 'Hidden Words' },
        { selector: 'span', text: 'Piiloitetut sanat' },
        { selector: 'span', text: 'Hidden Words' },
        { selector: 'button', text: 'Piilota tarinat ja livet' },
        { selector: 'button', text: 'Hide stories and live' },
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

    // attributes for search gating diagnostics
    const IG_SEARCH_HIDDEN_ATTR = 'data-ig-search-hidden-reason';
    const IG_SEARCH_APPROVE_ATTR = 'data-ig-approve';
    const IG_SEARCH_ROW_ATTR = 'data-ig-row';

    // Helper: remove image/network loads from a container
    function stripImagesWithin(el) {
        try {
            el.querySelectorAll('img, source, video').forEach(node => {
                if (node.tagName === 'IMG') {
                    node.removeAttribute('srcset');
                    node.removeAttribute('src');
                    node.loading = 'lazy';
                    node.decoding = 'async';
                    node.style.setProperty('display', 'none', 'important');
                    node.style.setProperty('visibility', 'hidden', 'important');
                } else if (node.tagName === 'SOURCE') {
                    node.removeAttribute('srcset');
                    node.removeAttribute('src');
                } else if (node.tagName === 'VIDEO') {
                    node.pause?.();
                    node.removeAttribute('src');
                    node.removeAttribute('poster');
                }
            });
        } catch {}
    }

    // Build CSS to pre-hide search hits for banned accounts/posts (runs at doc-start)
    function buildSearchBanCSS() {
        try {
            const scope = '[role="listbox"]';
            const rules = instagramAccountsToHideLower.map(acc => {
                const p = `${scope} a[href*="/${acc}/"]`;
                return `
/* hide search result for /${acc}/ (scoped to listbox) */
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
/* hide search result for ${seg} (scoped to listbox) */
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

            return `${rules}\n${postRules}`;
        } catch { return ''; }
    }

    function isSearchSurfacePresent() {
        return !!(
            document.querySelector('form[role="search"]') ||
            document.querySelector('input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"], input[aria-label*="Search"]') ||
            document.querySelector('[role="listbox"]')
        );
    }

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

    function usernameFromHref(rawHref) {
        if (!rawHref) return '';
        try {
            let pathname = '';
            try {
                const u = new URL(rawHref, location.origin);
                pathname = u.pathname || '';
            } catch {
                pathname = (rawHref.split('#')[0].split('?')[0] || '');
            }
            const parts = pathname.split('/').filter(Boolean);
            if (!parts.length) return '';
            const first = parts[0];
            if (
                first === 'explore' ||
                first === 'reels' ||
                first === 'p' ||
                first === 'accounts' ||
                first === 'direct' ||
                first === 'stories' ||
                first === 'ai' ||
                first === 'meta-ai'
            ) {
                return '';
            }
            return first.toLowerCase().replace(/^@+/, '');
        } catch {
            return '';
        }
    }

    function getSearchRowElement(anchor) {
        let row = anchor.closest('[role="option"], li, a[role="link"], a._a6hd, a.x1i10hfl, a');
        if (!row) row = anchor;
        row.setAttribute(IG_SEARCH_ROW_ATTR, '1');
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

    function matchesBannedByText(texts) {
        if (!texts || !texts.length) return '';
        for (const raw of texts) {
            const low = raw.toLowerCase();
            if (!allowedWordsLower.some(w => low.includes(w))) {
                for (const kw of bannedKeywordsLower) {
                    if (kw && low.includes(kw)) return `keyword:${kw}`;
                }
                for (const rx of bannedRegexes) {
                    try { if (rx.test(raw)) return `regex:${String(rx)}`; } catch {}
                }
            }
        }
        return '';
    }

    function blockRow(row, reason) {
        row.removeAttribute(IG_SEARCH_APPROVE_ATTR);
        row.setAttribute(IG_SEARCH_HIDDEN_ATTR, reason || 'blocked');
        row.style.setProperty('display', 'none', 'important');
        row.style.setProperty('visibility', 'hidden', 'important');
        row.style.setProperty('opacity', '0', 'important');
        row.style.setProperty('height', '0', 'important');
        row.style.setProperty('width', '0', 'important');
        row.style.setProperty('position', 'absolute', 'important');
        row.style.setProperty('left', '-9999px', 'important');
        row.style.setProperty('top', '-9999px', 'important');
        row.style.setProperty('pointer-events', 'none', 'important');
        hiddenElements.add(row);
    }

    function approveRow(row) {
        row.style.removeProperty('display');
        row.style.removeProperty('visibility');
        row.style.removeProperty('opacity');
        row.style.removeProperty('height');
        row.style.removeProperty('width');
        row.style.removeProperty('position');
        row.style.removeProperty('left');
        row.style.removeProperty('top');
        row.style.removeProperty('pointer-events');
        row.removeAttribute(IG_SEARCH_HIDDEN_ATTR);
        row.setAttribute(IG_SEARCH_APPROVE_ATTR, '1');
    }

    function hideInstagramSearchResults() {
        if (!location.hostname.includes('instagram.com')) return;

        const anchorSet = new Set(Array.from(document.querySelectorAll('[role="listbox"] a[href]')));
        const roots = getSearchRoots();
        if (roots.length) {
            roots.forEach(root => {
                root.querySelectorAll('a[href]').forEach(a => anchorSet.add(a));
            });
        }
        if (!anchorSet.size) {
            document.querySelectorAll('a[href]').forEach(a => {
                try {
                    const rect = a.getBoundingClientRect();
                    if (rect && rect.width >= 220 && rect.width <= 480 && rect.left >= 0 && rect.left <= 420 && rect.height >= 44 && rect.height <= 160) {
                        anchorSet.add(a);
                    }
                } catch {}
            });
        }
        if (!anchorSet.size) return;

        anchorSet.forEach(a => {
            try {
                const row = getSearchRowElement(a);
                if (!row) return;
                if (row.getAttribute(IG_SEARCH_APPROVE_ATTR) === '1' || row.hasAttribute(IG_SEARCH_HIDDEN_ATTR)) return;

                const href = a.getAttribute('href') || '';
                let normalizedPath = '';
                try {
                    const u = new URL(href, location.origin);
                    normalizedPath = (u.pathname || '').toLowerCase();
                } catch {
                    normalizedPath = (href.split('?')[0] || '').toLowerCase();
                }

                let decided = false;

                if (normalizedPath.startsWith('/p/')) {
                    for (let i = 0; i < instagramBannedPosts.length; i++) {
                        const pid = instagramBannedPosts[i].toLowerCase();
                        if (normalizedPath.includes(`/${pid}`)) {
                            blockRow(row, `post:${pid}`);
                            decided = true;
                            break;
                        }
                    }
                }

                if (!decided) {
                    const user = usernameFromHref(href);
                    if (user && instagramAccountsSet.has(user)) {
                        blockRow(row, `user:${user}`);
                        decided = true;
                    }
                }

                if (!decided) {
                    const immediateTexts = collectRowTexts(row);
                    const immediateReason = matchesBannedByText(immediateTexts);
                    if (immediateReason) {
                        blockRow(row, immediateReason);
                        decided = true;
                    }
                }

                if (!decided) {
                    addRAF(() => {
                        if (row.getAttribute(IG_SEARCH_APPROVE_ATTR) === '1' || row.hasAttribute(IG_SEARCH_HIDDEN_ATTR)) return;
                        const laterTexts = collectRowTexts(row);
                        const laterReason = matchesBannedByText(laterTexts);
                        if (laterReason) {
                            blockRow(row, laterReason);
                        } else {
                            approveRow(row);
                        }
                    });
                }

                if (decided && !row.hasAttribute(IG_SEARCH_HIDDEN_ATTR)) {
                    approveRow(row);
                }
            } catch {}
        });
    }

    function hideMyosMetaltaElements() {
        const metaSvgs = document.querySelectorAll('svg[aria-label*="Myös Metalta"]');
        metaSvgs.forEach(svg => {
            let container = svg;
            let level = 0;
            while (container && level < 10) {
                container = container.parentElement;
                level++;
                if (container && container.classList.contains('x9f619') && 
                    container.classList.contains('x3nfvp2') && 
                    container.classList.contains('xr9ek0c') &&
                    container.textContent.includes('Myös Metalta')) {
                    container.style.setProperty('display', 'none', 'important');
                    container.style.setProperty('visibility', 'hidden', 'important');
                    container.style.setProperty('opacity', '0', 'important');
                    container.style.setProperty('height', '0', 'important');
                    container.style.setProperty('width', '0', 'important');
                    container.style.setProperty('position', 'absolute', 'important');
                    container.style.setProperty('left', '-9999px', 'important');
                    container.style.setProperty('top', '-9999px', 'important');
                    container.style.setProperty('overflow', 'hidden', 'important');
                    hiddenElements.add(container);
                    break;
                }
            }
        });
        const allDivs = document.querySelectorAll('div');
        allDivs.forEach(div => {
            if (div.textContent && div.textContent.trim() === 'Myös Metalta' && 
                div.closest('div.x9f619.x3nfvp2.xr9ek0c')) {
                const container = div.closest('div.x9f619.x3nfvp2.xr9ek0c');
                if (container && !hiddenElements.has(container)) {
                    container.style.setProperty('display', 'none', 'important');
                    container.style.setProperty('visibility', 'hidden', 'important');
                    container.style.setProperty('opacity', '0', 'important');
                    container.style.setProperty('height', '0', 'important');
                    container.style.setProperty('width', '0', 'important');
                    container.style.setProperty('position', 'absolute', 'important');
                    container.style.setProperty('left', '-9999px', 'important');
                    container.style.setProperty('top', '-9999px', 'important');
                    container.style.setProperty('overflow', 'hidden', 'important');
                    hiddenElements.add(container);
                }
            }
        });
    }

    function hideSettingsPageElements() {
        if (!window.location.pathname.includes('/accounts/') && !window.location.pathname.includes('/settings/')) return;
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
                        if (childCount < 50) {
                            container.style.setProperty('display', 'none', 'important');
                            container.style.setProperty('visibility', 'hidden', 'important');
                            container.style.setProperty('opacity', '0', 'important');
                            container.style.setProperty('height', '0', 'important');
                            container.style.setProperty('width', '0', 'important');
                            container.style.setProperty('position', 'absolute', 'important');
                            container.style.setProperty('left', '-9999px', 'important');
                            container.style.setProperty('top', '-9999px', 'important');
                            container.style.setProperty('overflow', 'hidden', 'important');
                            hiddenElements.add(container);
                            break;
                        }
                    }
                    container = container.parentElement;
                    level++;
                }
            });
        });
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (hiddenElements.has(element)) return;
            const text = element.textContent ? element.textContent.trim() : '';
            if (text === 'Piiloitetut sanat' || 
                text === 'Hidden Words' || 
                text === 'Restricted accounts' || 
                text === 'Rajoitetut tilit' ||
                text === 'Piilota tarinat ja livet' ||
                text === 'Hide stories and live') {
                let container = element;
                let level = 0;
                while (container && level < 8) {
                    if (container.tagName === 'A' || 
                        container.getAttribute('role') === 'button' ||
                        container.classList.contains('x1i10hfl') ||
                        (container.tagName === 'DIV' && 
                         container.classList.contains('x9f619') &&
                         container.onclick)) {
                        const siblingCount = container.parentElement ? container.parentElement.children.length : 0;
                        const childCount = container.querySelectorAll('*').length;
                        if (siblingCount > 1 && childCount < 100) {
                            container.style.setProperty('display', 'none', 'important');
                            container.style.setProperty('visibility', 'hidden', 'important');
                            container.style.setProperty('opacity', '0', 'important');
                            container.style.setProperty('height', '0', 'important');
                            container.style.setProperty('width', '0', 'important');
                            container.style.setProperty('position', 'absolute', 'important');
                            container.style.setProperty('left', '-9999px', 'important');
                            container.style.setProperty('top', '-9999px', 'important');
                            container.style.setProperty('overflow', 'hidden', 'important');
                            hiddenElements.add(container);
                            break;
                        }
                    }
                    container = container.parentElement;
                    level++;
                }
            }
        });
        const allTextElements = document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6, a, button');
        allTextElements.forEach(element => {
            if (hiddenElements.has(element)) return;
            const text = element.textContent ? element.textContent.trim() : '';
            if ((text === 'Piiloitetut sanat' || 
                 text === 'Hidden Words' || 
                 text === 'Piilota tarinat ja livet' || 
                 text === 'Hide stories and live') && 
                element.getBoundingClientRect().width > 0 &&
                element.getBoundingClientRect().height > 0) {
                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('height', '0', 'important');
                element.style.setProperty('width', '0', 'important');
                element.style.setProperty('position', 'absolute', 'important');
                element.style.setProperty('left', '-9999px', 'important');
                element.style.setProperty('top', '-9999px', 'important');
                element.style.setProperty('overflow', 'hidden', 'important');
                hiddenElements.add(element);
                const parent = element.parentElement;
                if (parent && parent.querySelectorAll('*').length < 20) {
                    parent.style.setProperty('display', 'none', 'important');
                    parent.style.setProperty('visibility', 'hidden', 'important');
                    hiddenElements.add(parent);
                }
            }
        });
    }

    // Inject CSS immediately for instant hiding (search bans + APPROVE GATE)
    const injectInlineCSS = () => {
        try {
            const styleId = 'extra-redirect-style';
            let style = document.getElementById(styleId);
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
            }
            const searchBanCSS = buildSearchBanCSS();

            const approveGateCSS = `
/* Approve-gate: hide all suggestion rows by default */
[role="listbox"] [role="option"]:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] li:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] a[role="link"]:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] a._a6hd:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="navigation"] a[href^="/explore"],
nav[aria-label*="Primary"] a[href^="/explore"],
a[href="/explore/"],
a[href="/explore/?next=%2F"],
a[role="link"][href^="/explore"],
[role="listbox"] a.x1i10hfl:not([${IG_SEARCH_APPROVE_ATTR}="1"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
    left: -9999px !important;
    top: -9999px !important;
    height: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
}

/* Approve-gate: approved rows become visible and clickable */
[role="listbox"] [${IG_SEARCH_APPROVE_ATTR}="1"] {
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    position: static !important;
    height: auto !important;
    width: auto !important;
    overflow: visible !important;
}
`;

            style.textContent = `
            /* Immediately hide Instagram elements */
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
            
            /* Aggressive hiding for settings page elements */
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

            /* Instagram search pre-hide for banned accounts/posts (scoped to listbox only) */
            ${searchBanCSS}

            /* Instagram search APPROVE GATE */
            ${approveGateCSS}
            `;
            
            if (!style.isConnected) {
                if (document.head) {
                    document.head.appendChild(style);
                } else if (document.documentElement) {
                    document.documentElement.insertBefore(style, document.documentElement.firstChild);
                }
            }
        } catch (err) {
            try {
                const styleTag = document.createElement('style');
                styleTag.textContent = `${selectorsToHide.slice(0, 10).join(', ')} { display: none !important; }`;
                (document.head || document.documentElement).appendChild(styleTag);
            } catch (e) {}
        }
    };
    
    // Run CSS injection immediately
    injectInlineCSS();

    const hideCriticalElements = () => {
        selectorsToHide.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                if (!hiddenElements.has(el)) {
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                    hiddenElements.add(el);
                }
            });
        });
        hideMyosMetaltaElements();
        hideSettingsPageElements();
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    };
    hideCriticalElements();

    function checkForRedirectElements() {
        if (!location.hostname.includes('instagram.com')) return;
        const allSelectors = selectorsToMonitorAndRedirect.join(',');
        const foundElements = document.querySelectorAll(allSelectors);
        if (foundElements.length > 0) {
            fastRedirect('https://www.instagram.com');
        }
    }

    function isReelsPage() {
        return location.pathname.includes('/reels/') || location.pathname.startsWith('/reels');
    }

    function injectReelsCSS() {
        if (!isReelsPage()) return;
        if (reelsStyleInjected && document.getElementById('reels-navigation-hider')) return;
        
        const css = `
            /* Hide Meta AI navigation elements immediately */
            a[href="/ai/"],
            a[href="/meta-ai/"],
            a[aria-label*="Meta AI"],
            *[aria-label="Meta AI"],
            [data-testid*="meta-ai"],
            [data-testid*="metaai"],
            [aria-label*="Myös Metalta"],
            [title*="Myös Metalta"],
            svg[aria-label*="Myös Metalta"],
            
            /* Hide Explore/Tutki navigation elements immediately */
            div[role="button"][tabindex][aria-label="Tutki"],
            svg[aria-label="Tutki"],
            div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"],
            a[href="/explore/"],
            
            /* Hide Threads navigation elements immediately */
            div[role="button"][tabindex][aria-label="Threads"],
            svg[aria-label="Threads"],
            a.x1i10hfl[href*="threads"],
            a[href*="/threads"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                max-height: 0 !important;
                max-width: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
            }
        `;
        
        let style = document.getElementById('reels-navigation-hider');
        if (!style) {
            style = document.createElement('style');
            style.id = 'reels-navigation-hider';
        }
        style.textContent = css;
        
        if (document.head) {
            if (!style.isConnected) document.head.appendChild(style);
        } else {
            onEvent(document, 'DOMContentLoaded', () => {
                if (!style.isConnected) document.head.appendChild(style);
            }, false);
        }
        
        reelsStyleInjected = true;
    }

    // Safe page whiteout (no document.write)
    function igBlankOutPage() {
        try {
            let s = document.getElementById('ig-blank-style');
            if (!s) {
                s = document.createElement('style');
                s.id = 'ig-blank-style';
                s.textContent = `
                    html, body { background: #fff !important; }
                    body > * { display: none !important; visibility: hidden !important; }
                `;
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

    function shouldInstagramRedirect() {
        const url = window.location.href;
        for (let i = 0; i < instagramBannedPaths.length; ++i) {
            if (url.includes(instagramBannedPaths[i])) return true;
        }
        return false;
    }

    if (
        window.location.hostname === "www.instagram.com" &&
        shouldInstagramRedirect()
    ) {
        fastRedirect("https://www.instagram.com");
        return;
    }

    if (isReelsPage()) {
        injectReelsCSS();
    }

    function collapseElement(element) {
        if (!hiddenElements.has(element)) {
            stripImagesWithin(element);
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('max-height', '0', 'important');
            element.style.setProperty('height', '0', 'important');
            element.style.setProperty('min-height', '0', 'important');
            element.style.setProperty('overflow', 'hidden', 'important');
            element.style.setProperty('padding', '0', 'important');
            element.style.setProperty('margin', '0', 'important');
            element.style.setProperty('border', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('flex', '0 0 0px', 'important');
            element.style.setProperty('grid', 'none', 'important');
            element.style.setProperty('transition', 'none', 'important');
            element.style.setProperty('opacity', '0', 'important');
            element.style.setProperty('position', 'absolute', 'important');
            element.style.setProperty('left', '-9999px', 'important');
            element.style.setProperty('top', '-9999px', 'important');
            hiddenElements.add(element);
        }
    }

    function querySelectorAllWithContains(selector, containsText) {
        const elements = document.querySelectorAll(selector);
        const matchingElements = [];
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].textContent && elements[i].textContent.trim() === containsText) {
                matchingElements.push(elements[i]);
            }
        }
        return matchingElements;
    }

    function collapseElementsBySelectors(selectors) {
        if (isReelsPage()) return;
        if (!selectors || !selectors.length) return;
        const allSelectors = selectors.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            if (hiddenElements.has(element)) return;
            const isProtected = protectedElements.some(protectedSelector => {
                try { return element.matches(protectedSelector); } catch { return false; }
            });
            const containsAllowedWords = allowedWordsLower.some(word =>
                element.textContent && element.textContent.toLowerCase().includes(word)
            );
            if (!isProtected && !containsAllowedWords && !isExcludedPath()) {
                collapseElement(element);
            }
        });
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    }

    function collapseElementsByKeywordsOrPaths(keywords, paths, selectors) {
        if (isReelsPage()) return;
        if (!selectors || !selectors.length) return;
        const allSelectors = selectors.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            if (hiddenElements.has(element)) return;
            const isProtected = protectedElements.some(protectedSelector => {
                try { return element.matches(protectedSelector); } catch { return false; }
            });
            if (isProtected) return;
            if (isExcludedPath()) return;
            const textContent = element.textContent ? element.textContent.toLowerCase() : "";
            const containsAllowed = allowedWordsLower.some(word => textContent.includes(word));
            if (containsAllowed) return;
            let matched = false;
            for (let i = 0; i < bannedKeywordsLower.length; ++i) {
                if (textContent.includes(bannedKeywordsLower[i])) {
                    matched = true;
                    break;
                }
            }
            for (let i = 0; i < instagramBannedPathsLower.length; ++i) {
                if (textContent.includes(instagramBannedPathsLower[i])) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                for (let i = 0; i < bannedRegexes.length; ++i) {
                    if (bannedRegexes[i].test(element.textContent)) {
                        matched = true;
                        break;
                    }
                }
            }
            if (matched) {
                const parentArticle = element.closest('article');
                if (parentArticle && !hiddenElements.has(parentArticle)) {
                    const containsAllowedWords = allowedWordsLower.some(word =>
                        parentArticle.textContent && parentArticle.textContent.toLowerCase().includes(word)
                    );
                    if (!containsAllowedWords) {
                        Array.from(parentArticle.children).forEach(child => {
                            child.style.setProperty('display', 'none', 'important');
                        });
                        hiddenElements.add(parentArticle);
                    }
                }
            }
        });

        textBasedTargets.forEach(target => {
            querySelectorAllWithContains(target.selector, target.text).forEach(element => {
                if (!hiddenElements.has(element)) {
                    const isProtected = protectedElements.some(protectedSelector => {
                        try { return element.matches(protectedSelector); } catch { return false; }
                    });
                    if (!isProtected) {
                        collapseElement(element);
                    }
                }
            });
        });

        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    }

    function collapseReelsElementsByKeywordsOrPaths(keywords, paths, selectors) {
        return;
    }

    function collapseElementsOnExcludedPaths() {
        if (!isExcludedPath()) return;
        if (!selectorsForExcludedPaths.length) return;
        const allSelectors = selectorsForExcludedPaths.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            collapseElement(element);
        });
    }

    function isExcludedPath() {
        return excludedPaths.some(path => currentURL.indexOf(path) !== -1);
    }

    function handleRedirectionsAndContentHiding() {
        currentURL = window.location.href;

        // Redirect Threads to Instagram (if needed)
        if (currentURL.includes('www.threads.')) {
            window.stop();
            fastRedirect('https://www.instagram.com');
            return;
        }

        if (instagramBannedPaths.some(path => currentURL.includes(path))) {
            window.stop();
            fastRedirect('https://www.instagram.com');
            return;
        }

        if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
            return;
        }

        if (isReelsPage()) {
            injectReelsCSS();
            return;
        }

        if (isExcludedPath()) {
            collapseElementsOnExcludedPaths();
            return;
        }

        collapseElementsBySelectors(selectorsToHide);
        collapseElementsByKeywordsOrPaths(bannedKeywords, instagramBannedPaths, selectorsToMonitor);
        checkForRedirectElements();
        hideMyosMetaltaElements();
        hideSettingsPageElements();
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    }

    function hideInstagramAccountsFromList() {}

    function hideInstagramBannedContent() {
        if (!location.hostname.includes('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;
        
        instagramBannedPosts.forEach(postId => {
            if (location.pathname.toLowerCase().includes(postId.toLowerCase())) {
                document.querySelectorAll('article, div[data-testid="post"]').forEach(element => {
                    collapseElement(element);
                });
            }
        });
        
        instagramAccountsToHideLower.forEach(account => {
            if (location.pathname.toLowerCase() === `/${account}/` || location.pathname.toLowerCase().startsWith(`/${account}/`)) {
                const main = document.querySelector('main');
                if (main) {
                    collapseElement(main);
                }
            }
        });

        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    }

    function genericAggressiveHider() {
        if (!location.hostname.includes('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;
        if (!document.body) return;
        
        const allTextNodes = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            allTextNodes.push(node);
        }
        
        allTextNodes.forEach(node => {
            let txt = node.nodeValue.toLowerCase();
            if (allowedWordsLower.some(word => txt.includes(word))) return;
            if (bannedKeywordsLower.some(keyword => txt.includes(keyword))) {
                let el = node.parentElement;
                if (el && el.offsetParent !== null && 
                    !el.matches('main, section[role="main"], div[role="main"], body, html, nav') &&
                    !protectedElements.some(selector => {
                        try { return el.matches(selector); } catch { return false; }
                    })) {
                    collapseElement(el);
                }
            }
        });
        
        allTextNodes.forEach(node => {
            let txt = node.nodeValue;
            if (allowedWordsLower.some(word => txt.toLowerCase().includes(word))) return;
            if (bannedRegexes.some(re => re.test(txt))) {
                let el = node.parentElement;
                if (el && el.offsetParent !== null && 
                    !el.matches('main, section[role="main"], div[role="main"], body, html, nav') &&
                    !protectedElements.some(selector => {
                        try { return el.matches(selector); } catch { return false; }
                    })) {
                    collapseElement(el);
                }
            }
        });
    }

    let observerScheduled = false;
    function observerCallback(mutationsList) {
        if (observerScheduled) return;
        observerScheduled = true;
        addTimeout(() => {
            observerScheduled = false;
            if (isReelsPage()) {
                return;
            }
            if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
                hideInstagramAccountsFromList();
                return;
            }
            if (isExcludedPath()) {
                collapseElementsOnExcludedPaths();
                return;
            }
            collapseElementsBySelectors(selectorsToHide);
            collapseElementsByKeywordsOrPaths(bannedKeywords, instagramBannedPaths, selectorsToMonitor);
            if (location.hostname.includes('instagram.com')) {
                hideInstagramBannedContent();
                genericAggressiveHider();
                checkForRedirectElements();
                hideMyosMetaltaElements();
                hideSettingsPageElements();
                if (isSearchSurfacePresent()) {
                    hideInstagramSearchResults();
                }
            }
        }, 80);
    }

    function initObserver() {
        const observer = trackObserver(new MutationObserver(observerCallback));
        function startObserve() {
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                onEvent(document, 'DOMContentLoaded', () => {
                    observer.observe(document.body, { childList: true, subtree: true });
                }, false);
            }
        }
        startObserve();
    }

    function mainHandler() {
        handleRedirectionsAndContentHiding();
        if (isReelsPage()) {
            return;
        }
        if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
            hideInstagramAccountsFromList();
            return;
        }
        if (location.hostname.includes('instagram.com')) {
            hideInstagramBannedContent();
            genericAggressiveHider();
            checkForRedirectElements();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            if (isSearchSurfacePresent()) {
                hideInstagramSearchResults();
            }
        }
    }

    mainHandler();
    initObserver();

    function scheduleIntervals() {
        addInterval(() => {
            if (!isReelsPage() && !document.hidden) {
                mainHandler();
                hideMyosMetaltaElements();
                hideSettingsPageElements();
                if (isSearchSurfacePresent()) hideInstagramSearchResults();
            }
        }, 70);
    }
    startIntervals(scheduleIntervals);

    onEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleIntervals);
            mainHandler();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
    }, false);

    onEvent(document, 'visibilitychange', () => {
        if (!document.hidden && !isReelsPage()) {
            mainHandler();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
    }, false);

    (function() {
        var _wr = function(type) {
            var orig = history[type];
            return function() {
                var rv = orig.apply(this, arguments);
                window.dispatchEvent(new Event(type));
                window.dispatchEvent(new Event('locationchange'));
                return rv;
            };
        };
        history.pushState = _wr('pushState');
        history.replaceState = _wr('replaceState');
        onEvent(window, 'popstate', function() {
            window.dispatchEvent(new Event('locationchange'));
        }, false);
    })();

    onEvent(window, 'locationchange', function() {
        reelsStyleInjected = false;
        currentURL = window.location.href;
        injectInlineCSS();
        if (isReelsPage()) {
            injectReelsCSS();
        } else {
            mainHandler();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
    }, false);

    onEvent(document, 'visibilitychange', function() {
        if (!document.hidden && !isReelsPage()) {
            mainHandler();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

})();