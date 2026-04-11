// ==UserScript==
// @name         InstaTolerable
// @version      2026-03-26
// @description  Trying to make my Instagram experience tolerable. 
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
    const __rafIds = new Set(); 
    let __cleanupRan = false;
    let __intervalsRunning = false;
    let __isRedirectingFast = false; 
    let __lastKnownUrl = window.location.href; 

    function devLog(message) {
        // console.log('[INSTAGRAM.JS]', message);
    }

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

// ======== Keyword arrays ========
const bannedKeywords = [
   "Bliss", "Alexa Bliss", "Tiffany", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Mercedes", "Alba Fyre", "sensuel", "Maryse", "Meta AI", "Del Rey", "CJ Perry", 
   "Becky Lynch", "Michin", "Mia Yim", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven", "sensuel", "queer", "Pride", "NXT Womens", "Perry", "Henley", "Nattie", 
   "Jordynne", "Woman", "Women", "@tiffanywwe", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Women's", "Woman's", "Summer Rae", "Mia Yim",
   "Naomi", "Bianca Belair", "Jessika Carr", "Carr WWE", "Jessica Karr", "bikini", "Kristen Stewart", "Sydney Sweeney", "Piper Niven", "Nia Jax", "Meta AI", "AI generated",
   "Young Bucks", "Jackson", "Lash Legend", "Jordynne Grace", "generated", "DeepSeek", "TOR-Browser", "TOR-selain", "Opera GX", "prostitute", "AI-generated", "Arianna Grace", 
   "deepnude", "undress", "nudify", "nude", "nudifier", "faceswap", "facemorph", "Sweeney", "Alexis", "Sydney", "Zelina Vega", "Mandy Rose", "playboy", "Irving", "IYO SKY", 
   "Nikki", "Bella", "Opera Browser", "Safari", "OperaGX", "MS Edge", "Microsoft Edge", "clothes", "Lola Vice", "Vice WWE", "Candice LeRae", "attire", "only fans", "miska",
   "crotch", "dress", "dreamtime", "Velvet Sky", "LGBTQ", "panties", "panty", "cloth", "cleavage", "deviantart", "Trish", "Stratus", "Tutki", "AdvancingAI", "Paxley", "misk33",
   "Tiffy Time", "Steward", "Roxanne", "cameltoe", "dreamtime AI", "Joanie", "Stewart", "Isla Dawn", "escort", "inpaint", "photopea", "onlyfans", "fantime", "Amari Miller", 
   "upscale", "upscaling", "upscaled", "AJ Lee", "deepfake", "ring gear", "Transvestite", "Aleksa", "Giulia", "Rodriguez", "Lisa Marie Varon", "Kristen", "Natasha", "Natalia",
   "booty", "Paige", "Mafiaprinsessa", "Chyna", "lingerie", "venice", "AI model", "deepfake", "nudifying", "nudifier", "undressing", "undressed", "undressifying", "undressify", 
   "Vladimir Putin", "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley Cameron", "Hayter", "trunks", "pants", "Ripley", "manyvids", "Del Ray", "Belts Mone", "Cargill", 
   "five feet of fury", "5 feet of fury", "selain", "browser", "DeepSeek", "DeepSeek AI", "fansly", "justforfans", "patreon", "Vince Russo", "Tay Conti", "Valhalla", "lotta",  
   "Shirai", "Io Sky", "Iyo Shirai", "Dakota Kai", "wiikmaaan", "Asuka", "Kairi Sane", "Meiko Satomura", "NXT Women", "Russo", "underwear", "Rule 34", "Nikkita Lyons", "belfie", 
   "Miko Satomura", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey", "Dana Brooke", "Izzi Dame", "Tamina", "Alicia Fox", "Madison Rayne", "Saraya", "Sol Ruca", "Roxanne", 
   "Layla", "Michelle McCool", "Eve Torres", "Kelly", "Melina WWE", "Jillian Hall", "Mickie James", "Su Yung", "Britt", "Nick Jackson", "Matt Jackson", "Sakazaki", "Primera", 
   "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly", "Gail Kim", "Awesome Kong", "Deonna", "Purrazzo", "Anna Jay", "Riho", "Britney", "Nyla Rose", "Naomi",
   "Angelina Love", "Tessmacher", "Havok", "Taya Valkyrie", "Valkyria", "Tay Melo", "Nightingale", "Statlander", "Hikaru Shida", "ZELINA!", "rule34", "Sasha", "lesbian",
   "Penelope Ford", "Shotzi", "Tegan", "Stephanie", "Sasha Banks", "Sakura", "Tessa", "Brooke", "Jakara", "Alba Fyre", "Isla Dawn", "Scarlett Bordeaux", "lesbo", "Roxan", 
   "B-Fab", "Kayden Carter", "Katana Chance", "Lyra Valkyria", "Indi Hartwell", "Blair", "Davenport", "Maxxine Dupri", "Russia", "China",  "Natalya", "Lisa Varon", "Vilma", 
   "Karmen Petrovic", "Ava Raine", "Yulisa Leon", "Cora Jade", "Gina Adams", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum WWE", "Fallon", "Valentina Feroz", "Wilma", 
   "wondershare", "filmora", "Kelani Jordan", "Electra Lopez", "Wendy Choo", "lottapupu", "m1ska", "m1sk4", "Milli", "Niina", "Jasmin", "Saana", "Veera", "Saya Kamitani", 
   "misk4", "misk3", "m1sk3", "m1ske", "m1mmuska", "misk33waaa", "misk33waa", "misk33wa", "misk3waa", "misk3waaa", "miskaawq9", "misk3wa", "Matilda", "Malla", "Kamitani", 
   "Nikkita", "linktr.ee", "vsco.co", "Sinulle ehdotettua", "Sinulle ehdotettu", "Suggested for you", "Myös Metalta", 

// String hashtags
   "#perse", "#pylly", "#tissit", "#takapuoli", "#takamus", "#boobs", "#boobies", "#boobie", "#booty", "#butt", "#babe", "#aigen", "#aigenerated", "#aigeneration", "#artificial",  
   "#aiapplication", "#aiedit", "#rack", "#finnishgirl", "#girl", "#women", "#woman", "#ladies", "#girls", "#womens", "#womans", "#belfie", "#artificialintelligence", "#bestie", 
   "#gym", "#gymgirl", "#gymwoman", "#belfie", "#heru", "#heruu", "#heruhoro", "#slut", "#horny", "#horni", "#bitch", "#pants", "#panties", "#pajama", "#pyjama", "#bikini", 
   "#lingerie", "#girly", "#girlie", "#finnishwoman", "#boudoir",
];

// ======== Regexes and Literals ========
const bannedRegexes = [
   /tiliehdotuksia/i, /linktr.ee/i, /vsco.co/i, /Sinulle ehdotettu/i, /Myös Metalta/i, /AI\-/i, /-\AI/i, /AI\-suck/i, /AIblow/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, 
   /ZELINA!/i, /motionsw/i, /motionc/i, /poseai/i, /RemovingAI/i, /blowjob/i, /b\-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /AIblow/i, /bjob/i, /5uck/i, /lex bl/i, 
   /Steph's/i, /Stephanie's/i, /Stepha/i, /Stephanie/i, /Stepan/i, /Stratu/i, /Stratt/i, /Tiffa/i, /Tiffy/i, /Trish/i, /Sasha/i, /lex bl/i, /katj/i, /lesb/i, /homo/i, /transvestite/i, 
   /Henriikka/i,  /Shirai/i, /Cargill/i, /Gina Adam/i, /Gina Adams/i, /pride/i, /transve/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Valtez/i, /Lawrence/i, /Jenny/i, /Jenn1/i, /J3nn1/i, 
   /J3nni/i, /J3nn4/i, /Jenn4/i, /Dua Lipa/i, /Dualipa/i, /Jenna/i, /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /Rasikangas/i, /jjulia/i, /juuliska/i, /Roxanne/i, /Roxanna/i, 
   /Wilm/i, /Noelle/i, /Kristiina/i, /Reetta/i, /Saana/i, /Veera/i, /irpp4/i, /juliana/i, /julianna/i, /juulianna/i, /juulianna/i, /juuliana/i, /juulia/i, /rasikannas/i, /rasikangas/i,  
   /Saya Kamitani/i, /Kamitani/i, /Ansku/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /Nia Jax/i, /McQueen/i, /5uck/i, 
   /Lash Legend/i, /motionai/i, /Dolli/i, /Dolly/i, /Aliisa/i, /maarit/i, /taija/i, /saija/i, /seija/i, /tiina/i, /teija/i, /Miska/i, /Saara/i, /Saaru/i,  /Lumikki/i, /Laura/i, /Noora/i,
   /Lumiikki/i, /Noora/i, /Elina/i,  /Nooru/i, /Camila/i, /Tiinu/i, /Henni/i, /Jasmin/i, /Katherin/i, /Janita/i, /Susan/i, /Sirja/i, /Venla/i, /Jenn/i, /Irene/i, /Milana/i, /Milena/i, 
   /Milene/i, /Minea/i, /Anette/i, /Tytti/i, /Elisa/i, /Elise/i, /Johanna/i, /Jossu/i, /Rebecca/i, /Jonna/i, /Janna/i, /Janet/i, /Aleksiina/i, /Alexiina/i, /Maria/i, /Marie/i, /Katja/i,  
   /Minna/i, /Janika/i, /Janica/i, /Janissa/i, /Pauliina/i, /Janisa/i, /Miisa/i, /Vilma/i, /Kaisa/i, /Pinj/i, /Jemina/i, /Moona/i, /Viivi/i, /Annika/i, /Marissa/i, /Jutta/i, /Amalia/i, 
   /Nelli/i, /Anniina/i, /Marjut/i, /Siiri/i, /Kamila/i, /Kamilla/i, /Kamilia/i, /Lauren/i, /Janika/i, /Camilla/i, /Camilia/i, /Krisse/i, /Malla/i, /Miina/i, /Merja/i, /Alina/i, /Alina/i,
   /Mirkku/i, /Irkku/i, /zelina/i,  /Aliina/i, /Shirai/i, /Vilhel/i, /Wilhel/i, /Aurora/i, /Joana/i, /Iiris/i, /Erika/i, /Janina/i, /Kasie Cay/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, 
   /With Grok/i, /By Grok/i, /minja/i,  /Grok's/i, /Elon Musk/i, /ElonMusk/i, /Sam Altman/i, /SamAltman/i, /changemotion/i, /swapmotion/i, /Huuska/i, /Sakurai/i, /Cargill/i, /Nikkita/i, 
   /Lyons/i, /IYO SKY/i, /AI creative/i, /AI created/i, /Tekoäly/i, /Teko äly/i, /Teko-äly/i, /Teko_äly/i, /gener/i, /generoiva/i, /generoitu/i, /generated/i, /generative/i, /AI create/i, 
   /seksi/i, /anaali/i, /pillu/i, /pimppi/i, /kyrpä/i, /kulli/i, /sexual/i, /sensuel/i, /seksuaali/i, /Kairi's/i, /Kairii/i, /Sexxy/i, /Sexy/i, /Sexx/i, /Sexi/i,

// Literal regex hashtags
   /\b#ass\b/i, /\b#tit\b/i, /\b#tits\b/i, /\b#boob\b/i, /\b#AI\b/i, /\b#Nox\b/i,

// Literal regexes (Boundaries, bro) 
   /\bCharlotte\b/i, /\bGina\b/i, /\bGin4\b/i, /\bHer\b/i, /\bShe\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bHers\b/i, /\bShes\b/i, /\bAlexa\b/i, /\bTiffy\b/i, /\bAI\b/i, /\bNeea\b/i, /\bHepe\b/i, 
   /\bIris\b/i, /\bMiia\b/i, /\bMira\b/i, /\bTiia\b/i, /\bKara\b/i, /\bEllu\b/i, /\bEeva\b/i, /\bEevi\b/i, /\bEssi\b/i, /\bKira\b/i, /\bSusu\b/i, /\bBra\b/i, /\bLana\b/i, /\bNea\b/i, /\bNeea\b/i, 
   /\bSara\b/i, /\bAnni\b/i, /\bNikki\b/i, /\bNia\b/i, /\bJax\b/i, /\bElla\b/i, /\bElli\b/i, /\bRosa\b/i, /\bMari\b/i, /\bmotion\b/i, /\bDoll\b/i, /\bOona\b/i, /\bIra\b/i, /\bIrppa\b/i, /\bG1na\b/i,  
   /\bG!na\b/i, /\bGina\b/i, /\bGigi\b/i, /\bDolin\b/i, /\bSarah\b/i, /\bG1n4\b/i, /\bEmmi\b/i, /\bAI-generated\b/i, /\bKati\b/i, /\bKiia\b/i, /\bIda\b/i, /\bIida\b/i, /\bVera\b/i, /\bAI art\b/i, 
   /\bLexi\b/i, /\bBy AI\b/i, /\bAI edited\b/i, /\bAI edit\b/i, /\bModel\b/i, /\bSexy\b/i, /\bSex\b/i, /\bAlexa\b/i, /\bAlexis\b/i, /\bHomo\b/i, /\bGay\b/i, /\bDeep\b/i, /\bFake\b/i, /\bBrie\b/i, 
   /\bGirls\b/i, /\bGirly\b/i, /\bGirlie\b/i, /\bGirl's\b/i, /\bTorres\b/i, /\bEve WWE\b/i, /\bNikki\b/i, /\bManna\b/i, /\bNanna\b/i, /\bAava\b/i, /\bAva\b/i, /\bRaine\b/i, /\bGrok\b/i, /\bJensku\b/i, 
   /\bSanna\b/i, /\bHanna\b/i, /\bHenna\b/i, /\bAss\b/i, /\bNiina\b/i, /\bSandra\b/i, /\bViola\b/i, /\bMinka\b/i, /\bMilla\b/i, /\bMirka\b/i, /\bRoosa\b/i, /\bPeppi\b/i, /\bEveliina\b/i, /\bJulle\b/i,  
   /\bBy AI\b/i, /\bNikki\b/i, /\bNox\b/i, /\bMenni\b/i, /\bGlna\b/i, /\bvsco\b/i, /\bElon\b/i, /\bMusk\b/i, /\bJimi\b/i, /\bAltman\b/i, /\bTara\b/i, /\bKairi\b/i,
]; 

// String allowed words
const allowedWords = [
   "Lähetä", "Viesti", "Lähetä viesti", "Send a message", "Send message", "Send", "message", "Battlefield", "BF", "BF6", "BF1", "BF4", "BF 1942", "BF2", "Battle field", "memes", "masterrace", "#itsevarmuus",
   "#memes", "meme", "#meme", "Pearl", "Harbor", "Market", "Bro", "Brother", "Metallica", "Sabaton", "Joakim", "James", "Hetfield", "PC", "Build", "Memory", "Ram", "Motherboard", "Mobo", "Cooling", "pcmaster",
   "AIO", "CPU", "GPU", "Radeon", "GeForce", "GTX", "RTX", "50", "60", "70", "80", "90", "X3D", "50TI", "60TI", "70TI", "80TI", "90TI", "Processor", "Graphics", "Card", "Intel", "AMD", "NVidia", "RGB", "cooler",
   "#healing", "#heal", "#itsetunto", "😂", "🤣", "😭", "Lisa Su", "Jensen Huang", "Chip", "Android", "Huawei", "Tech", "Patch", "MSI", "Asus", "ROG", "Strix", "TUF", "Suprim", "Gaming", "OSRS", "RS3", "Jagex", 
   "Old School", "RuneScape",  "Sea Shanty 2", "Sailor's Dream", "Sailing", "Skilling", "Bossing", "Boss", "Mod Ash", "JMod", "Reddit", "Core", "Cores", "3DVCache", "VCache", "Inno3D", "Inno 3D", "Sapphire", "XFX",
   "Nitro", "Pure", "Asus Prime", "X570", "B550", "B650", "B650E", "X670", "X670E", "B850", "X870", "X870E", "B450", "X470", "B350", "X370", "LGA", "1150", "1151", "1155", "AM4", "AM5", "AM6", "Corsair", "Kingston",
   "PowerColor", "DDR5", "DDR4", "DDR3", "Computing", "Computer", "AData", "AM3", "AM3+", "AM2", "GSkill", "Memory", "Ram", "Turbo", "Overclock", "Overclocked", "Air cooling", "Radiator", "Pump", "Header", "Water", 
   "GTA", "Grand Theft Auto", "PlayStation", "PS1", "PS2", "PS3", "PS4", "PS5", "Xbox", "Series", "Pro", "Console", "Sega", "MegaDrive", "Genesis", "Nintendo", "Upgrade", "Room", "Setup", "Christmas", "Wordables",
   "Wordable", "lifelearnedfeelings", "feel", "feelings", "feeling", "pcmasterrace_official", "pcmasterrace", "pc masterrace", "pc master race", "gaming", "game",
];

// Instagram accounts to hide
const instagramAccountsToHide = [
  'karabrannbacka', 'piia_oksanen', 'wiikmaaan', 'julmakira', 'yaonlylivvonce', 'alexa_bliss_wwe_',
  'samanthathebomb', 'tiffanywwe', 'beckylynchwwe', 'charlottewwe', 'biancabelairwwe', 'thetrishstratuscom',
  'thebriebella', 'thenikkibella', 'niajaxwwe', 'mandysacs', 'sonyadevillewwe', 'natbynature',
  'zelinavegawwe', 'carmellawwe', 'itsmebayley', 'sashabankswwe', 'mercedesmone', 'saraya',
  'theajmendez', 'livmorganwwe', 'candicelerae', 'indihartwell', 'raquelwwe', 'dakotakaiwwe',
  'kairi_sane_wwe', 'asuka_wwe', 'meiko_satomura', 'roxanne_wwe', 'pipernivenwwe', 'nikki_cross_wwe',
  'jacyjaynewwe', 'gigidxdolinnxt', 'avawwe_', 'blairdavenportwwe', 'lyravalkyria', 'katana_chance',
  'kaydenwwe', 'maxxinedupri', 'chelseaagreen', 'fallonhenleywwe', 'karmenpetrovicwwe', 'danabrookewwe',
  'valhallawwe', 'laceyevanswwe', 'shotziwwe', 'dejwujs_', 'dejwujs', 'tegan_nox_wwe', 'mia_yim',
  'candicewwe', 'emmalution', 'tenille_dashwood', 'brittbaker', 'jaderedeww', 'taijamaarit',
  'krisstatlander', 'jamiehayter', 'thunderrosa22', 'serenadeeb', 'nylarosebeast', 'lashlegendwwe',
  'thepenelopeford', 'sylviliukkonen', 'sylviorvokki', 'willowwrestles', 'skye_by_wrestling', 'redvelvett',
  'anna_jay_aew', 'tayconti_', 'tayconti', 'taymelo', 'heidika', 'heidik', 'heidih', 'heidit',
  'grok', 'erikavikman', 'erika.helin', 'hikaru_shida', 'jjuliakristiina_', 'mafiaprinsessa',
  'riho_ringstar', 'gailkimitsme', 'deonnapurrazzo', 'jordynnegrace', 'mickiejames', 'trinity_fatu',
  'm1mmuska', 'mimmi', 'juliaerikaaz', 'dvondivawwe', 'suyung', 'madisonraynewrestling',
  'katariinapohjoiskangas', 'angelinalove', 'velvet_sky', 'brookeadams', 'tessblanchard',
  'thetayavalkyrie', 'havokdeathmachine', 'killerkellywrestling', 'kierahogan', 'diamante_lax',
  'ladyfrost', 'taryn_terrell', 'rebeltanea', 'martimichellewwe', 'alishawrestling',
  'savannah_evanswrestling', 'jazzygabert', 'masha_slamovich', 'paigewwe', 'kayfabe_kayla',
  'roxanne_perez', 'cora.jade', 'piia_barlund', 'lottapupu', 'giuliawrestler', 'starkz_wrestler',
  'thedollhousewrestling', 'holidead', 'tessafblanchard', 'thealliebunny', 'taya_valkyrie',
  'thedemonbunny', 'rhearipley_wwe', 'rosemarythehive', 'siennawrestling', 'madisonrayne',
  'kimber_lee90', 'kiera_hogan', 'diamantelax', 'realtenille', 'stephaniemcmahon',
  'stephanie_buttermore', 'stephanie.vaquer', 'julianarasikannas', 'wwe_asuka', 'kairi_sane_wwe',
  'wwe_mandyrose', 'stephaniesanzo', 'shaqwrestling', 'jadecargill', 'emimatsumoto',
  'yukisakazaki', 'mizuki_wrestler', 'gina.adams', 'miskaawq9', 'misk33', 'misk33waaa',
  'misk33waa', 'misk33wa', 'misk3waa', 'misk3waaa', 'misk3wa', 'misk4',
];

    const instagramBannedPaths = [
        ...instagramAccountsToHide,
        'instagram.com/explore',
        'instagram.com/reels',
        'instagram.com/accounts/blocked_accounts',
        'accounts/settings/v2/hidden_words',
        'accounts/restricted_accounts',
    ];

// === DYNAMIC WRESTLING SYNC ENGINE ===
const dynamicWrestlingKeywords = [];
const dynamicWrestlingSlugs = [];

function loadDynamicWrestlingData() {
    const storageApi = (typeof browser !== 'undefined' && browser.storage) ? browser.storage.local : (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null);
    if (storageApi) {
        storageApi.get(['wrestling_women_urls'], (data) => {
            if (data && data.wrestling_women_urls) {
                data.wrestling_women_urls.forEach(url => {
                    const parts = url.split('/').filter(Boolean);
                    const slug = parts[parts.length - 1]; 
                    if (slug) {
                        dynamicWrestlingSlugs.push(slug.toLowerCase());
                        const name = slug.replace(/-/g, ' ').toLowerCase(); 
                        if (name.length > 2) dynamicWrestlingKeywords.push(name);
                    }
                });
                
                dynamicWrestlingKeywords.forEach(kw => {
                    if (!bannedKeywords.includes(kw)) {
                        bannedKeywords.push(kw);
                        bannedKeywordsLower.push(kw.toLowerCase());
                    }
                });
                devLog(`Loaded ${dynamicWrestlingSlugs.length} dynamic wrestling names from SmackDownHotel cache.`);
            }
        });
        
        if (storageApi.onChanged) {
            storageApi.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.wrestling_women_urls) {
                    loadDynamicWrestlingData();
                }
            });
        }
    }
}
loadDynamicWrestlingData();
// ===================================

const bannedKeywordsLower = bannedKeywords.map(k => k.toLowerCase());
const instagramBannedPathsLower = instagramBannedPaths.map(p => p.toLowerCase());
const allowedWordsLower = allowedWords.map(w => w.toLowerCase());
const instagramAccountsToHideLower = instagramAccountsToHide.map(a => a.toLowerCase());
const instagramAccountsSet = new Set(instagramAccountsToHideLower);

const approvedPostIDs = new Set(); 
const scannedPostsCache = new Map(); 
const feedApprovedPostIDs = new Set(); 
let isFeedScanPhase = true; 

function findPostWrapper(node) {
    if (!node) return null;
    const article = node.closest('article');
    if (article) return article;

    let candidate = node.parentElement;
    let bestCandidate = null;
    let lvl = 0;

    while (candidate && lvl < 12) {
        if (candidate.tagName === 'MAIN' || candidate.getAttribute('role') === 'main' || candidate.tagName === 'BODY' || candidate.tagName === 'HTML' || candidate.tagName === 'NAV' || candidate.tagName === 'FOOTER') {
            break;
        }

        const articleCount = candidate.querySelectorAll('article').length;
        if (articleCount > 1) {
            break;
        }

        const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
        if (rect) {
            const area = rect.width * rect.height;
            if (rect.width > 100 && rect.width <= 800 && rect.height > 100 && rect.height <= 2500) {
                bestCandidate = candidate;
            }
            if (rect.width > 800 || rect.height > 3000 || area > 2000000) {
                break;
            }
        }

        if (candidate.parentElement) {
            const siblings = Array.from(candidate.parentElement.children);
            const hasArticleSibling = siblings.some(sib => sib !== candidate && sib.tagName === 'ARTICLE');
            if (hasArticleSibling) {
                bestCandidate = candidate;
                break; 
            }
        }

        candidate = candidate.parentElement;
        lvl++;
    }

    return bestCandidate;
}

function getPostIDFromArticle(article) {
    try {
        const postLink = article.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
        if (postLink) {
            const href = postLink.getAttribute('href') || '';
            const match = href.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
            if (match && match[2]) return match[2];
        }
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            const href = canonical.getAttribute('href') || '';
            const match = href.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
            if (match && match[2]) return match[2];
        }
    } catch {}
    return null;
}

    const excludedPaths = [
        'direct/t/',
        'inbox',
        'direct/t',
        'stories/nightmaree3z/',
        'stories/nightmaree3z',
    ];

    const protectedElements = [
    // STRUCTURAL PROTECTION (CRITICAL)
    'footer',
    'div:has(> footer)',
    'nav',
    'div:has(> a[href="/"])', 
    'svg[aria-label="Lisää"]', 
    'div:has(> div > div > div > svg[aria-label="Lisää"])',
    'div:has(> div > div > svg[aria-label="Lisää"])',
    'svg[aria-label="Asetukset"]',
    'div:has(> article)', 
    'div:has(> div > article)', 

    // === SEARCH SIDEBAR PROTECTION ===
    'input[type="text"]',
    'input[type="search"]',
    'input[placeholder*="Search"]',
    'input[placeholder*="Haku"]',
    'input[placeholder*="Hae"]',
    'form[role="search"]',
    '[role="listbox"]',
    'div:has(> [role="listbox"])',
    'div:has(> div > [role="listbox"])',
    'div:has(> form[role="search"])',
    'div:has(> input[placeholder*="Search"])',
    'div:has(> input[placeholder*="Haku"])',
    'div:has(> input[placeholder*="Hae"])',
    // ==================================

    // Messaging and compose areas
    'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate',
    'div[aria-describedby="Viesti"][aria-label="Viesti"].xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate[role="textbox"][spellcheck="true"]',
    'textarea[placeholder="Message..."]',
    'button[type="submit"]',
    'div.x1qjc9v5.x1yvgwvq.x1dqoszc.x1ixjvfu.xhk4uv.x1ke7ulo.x3jqge.x1i7howy.x4y8mfe.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.x78zum5.xdt5ytf.xw7yly9.xktsk01.x1yztbdb.x1d',
    'div.x6s0dn4.x78zum5.x1gg8mnh.x1pi30zi.xlu9dua',

    // Large containers / layout cores
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
    'div[role="dialog"] div[role="button"].x1i10hfl.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x10w94by.x1qhh985.x14z9mp.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.x4uap5.x18d9i69.xkhd6sd',

    // NEW: Direct inbox containers to protect the thread list in the left sidebar
    'div[aria-label="Viestiketjun lista"][role="navigation"]',
    '[data-pagelet="IGDThreadList"]',
    '[data-pagelet="IGDThreadList"] ul',
    '[data-pagelet="IGDThreadList"] li',
    'div[role="presentation"] > ul',
    '[data-pagelet="IGDThreadList"] [role="presentation"]',

    // Profile Edit Protections (Biografia)
    'textarea#pepBio',
    'label[for="pepBio"]',
    'div:has(> textarea#pepBio)',
    'div:has(> label[for="pepBio"])',

    // Protect Likes / Tykkäykset sections
    'a[href*="/liked_by/"]',
    'section:has(a[href*="/liked_by/"])',
    'span[role="button"][tabindex="0"]',
    'div[role="button"][tabindex="0"]:has(> span.html-span)',
    'section:has(div[role="button"][tabindex="0"]:has(> span.html-span))',
];

function isElementProtected(element) {
    if (!element || element.nodeType !== 1) return false;
    
    if (element.tagName === 'FOOTER' || element.tagName === 'NAV' || element.tagName === 'MAIN' || element.tagName === 'BODY') return true;
    if (element.getAttribute('role') === 'feed' || element.getAttribute('role') === 'main' || element.getAttribute('role') === 'listbox') return true;
    
    // === SEARCH SIDEBAR PROTECTION ===
    if (element.tagName === 'INPUT' || element.tagName === 'FORM') return true;
    if (element.closest('form[role="search"]') || element.closest('[role="listbox"]')) return true;
    if (element.querySelector('form[role="search"], [role="listbox"], input[placeholder*="Search"], input[placeholder*="Haku"], input[placeholder*="Hae"]')) return true;
    // === END SEARCH PROTECTION ===

    if (element.tagName !== 'ARTICLE' && element.querySelector('article')) return true;

    if (element.querySelector('footer, nav, svg[aria-label="Lisää"], svg[aria-label="Asetukset"], svg[aria-label="More"], svg[aria-label="Settings"]')) return true;
    if (element.matches('svg[aria-label="Lisää"], svg[aria-label="Asetukset"], svg[aria-label="More"], svg[aria-label="Settings"]')) return true;

    return protectedElements.some(selector => {
        try { return element.matches(selector); } catch { return false; }
    });
}

    const selectorsToHide = [
    '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x1n2onr6 > ._a6hd.x1a2a7pz.xggy1nq.x1hl2dhg.x16',
    '.xvbhtw8.x1j7kr1c.x169t7cy.xod5an3.x11i5rnm.xdj266r.xdt5ytf.x78zum5',
    '.wbloks_79.wbloks_1 > .wbloks_1 > .wbloks_1 > .wbloks_1 > div.wbloks_1',
    '.x1ye3gou.x1l90r2v.xn6708d.x1y1aw1k.xl56j7k.x1qx5ct2.x78zum5.x6s0dn4',
    '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x78zum5.x6s0dn4.x1n2onr6 > ._a6hd.x1a2a7pz.xggy',
    '.xfex06f > div:nth-child(3)',
    'div.x1i10hfl:nth-child(8)',
    'mount_0_0_Ie > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div:nth-child(2) > div > div.x1gryazu.xh8yej3.x10o80wk.x14k21rp',
    'div.x6bk1ks:nth-child(3) > div:nth-child(4) > a:nth-child(1)',
    'div.x6bk1ks:nth-child(3) > div:nth-child(3)',
    '.x1xgvd2v > div:nth-child(2) > div:nth-child(4) > span:nth-child(1)',
    '.x1xgvd2v > div:nth-child(2) > div:nth-child(3) > span:nth-child(1) > a:nth-child(1) > div:nth-child(1)',
    'svg[aria-label="Tutki"]',
    'div[class^="x9f619 xjbqb8w x78zum5 x168nmei x13lgxp2 x5pf9jr xo71vjh"][style*="height: 250px;"]',
    'h4.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10wh',
    'a.x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tds',
    'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10',
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
    'svg[aria-label="reels"]',
    'a[href="/reels/"]',
    'a[href*="reels"] *',
    'a[href*="reels"]',
    'span:has(a[href*="help.instagram.com/347751748650214"])',
    'div.x78zum5.xdt5ytf.xdj266r.x14z9mp.xod5an3.x162z183.x1j7kr1c.xvbhtw8',
    'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x12nagc.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
    'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10',
    'a.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16t',
    'a.x1i10hfl[href*="blocked"]','a.x1i10hfl[href*="estetty"]','a.x1i10hfl[href*="Rajoitetut tilit"]','a.x1i10hfl[href*="Restricted accounts"]','a.x1i10hfl[href*="Piiloitetut sanat"]','a.x1i10hfl[href*="Hidden Words"]','a.x1i10hfl[href*="hide_story_and_live"]',
    'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="blocked"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="estetty"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Rajoitetut tilit"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Restricted accounts"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="Piiloitetut sanat"]','div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="hide_story_and_live"]',
    '[aria-label*="Myös Metalta"]','[title*="Myös Metalta"]','svg[aria-label*="Myös Metalta"]',
    '[role="navigation"] a[href^="/explore"]','nav[aria-label*="Primary"] a[href^="/explore"]','a[href="/explore/"]','a[href="/explore/?next=%2F"]','a[role="link"][href^="/explore"]',
    'section:has(> div > a._a6hd[href*="?next=%2F"])',
    'a._a6hd[href*="?next=%2F"] ~ div[style*="--x-height: 230px"]',
    'section:has(> div > a._a6hd[href*="?next=%2F"]) div[style*="--x-height: 230px"]',
    'section.xc3tme8.xcrlgei.x1tmp44o.xwqlbqq.x7y0ge5.xhayw2b',
    'section.xqui205.x172qv1o',
    // Link selectors
    'svg[aria-label="Linkin kuvake"]',
    'a[href*="linktr.ee"]',
    'a[href*="linktr.ee"] *',
    'a[href*="vsco.co"]',
    'a[href*="vsco.co"] *',
    'button:has(svg[aria-label="Linkin kuvake"])',
    'a[href*="linktr.ee"], a[href*="linktr.ee"] > div',
    'button:has(div[dir="auto"] a[href*="linktr.ee"])',
    'div:has(div[dir="auto"] a[href*="linktr.ee"])',
    'a[href*="vsco.co"], a[href*="vsco.co"] > div',
    'button:has(div[dir="auto"] a[href*="vsco.co"])',
    'div:has(div[dir="auto"] a[href*="vsco.co"])',
    'div:nth-of-type(4) > div > span',
    'form > div:nth-of-type(3) > div > span',
    'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(6) > div > a',
'div:nth-of-type(7) > div > a',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(5) > div:nth-of-type(7) > div',
'div:nth-of-type(6) > div > a',
'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'form > div:nth-of-type(3)',
'form > div:nth-of-type(4) > div',
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
        'div[role="button"][tabindex][aria-label="Reels"]',
        'div[class*="x1nhvcw1"][class*="xqjyukv"][class*="xdt5ytf"]',
        'span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_bmt5bb9klrj5ipd5aq_"]',
        'div.x1azxncr span[aria-describedby*="_R_rmt5bb9klrj5ipd5aq_"]',
        'a.x1i10hfl[href*="threads"]',
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
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href*="hide_story_and_live"]',

//New and shiny, random spaghetti selectors from IG, yey!
    'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(6) > div > a',
'div:nth-of-type(7) > div > a',
'div:nth-of-type(4) > div:nth-of-type(4) > div > a',
'div:nth-of-type(5) > div:nth-of-type(7) > div',
'div:nth-of-type(6) > div > a',
'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x9f619.xjbqb8w.x78zum5.xv54qhq.xf7dkkf.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1.x5ur3kl.x6usi7g.x1bs97v6.x18dxpii.x12ol6y4.x180vkcf.x1khw62d.x709u02.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.xt8cgyo.x128c8uf.x1co6499.xc5fred.x1a8lsjc.x889kno',
'form > div:nth-of-type(3)',
'form > div:nth-of-type(4) > div',
    ];

    const selectorsToMonitorAndRedirect = [
        'svg.x1lliihq.x1n2onr6.x5n08af[height="48"][width="48"][viewBox="0 0 96 96"]',
        'svg[aria-label=""][height="48"][width="48"][viewBox="0 0 96 96"] circle[cx="48"][cy="48"][r="47"]',
        'svg[viewBox="0 0 96 96"] path[d*="M60.931 70.001H35.065"]',
        // Empty profile (Ei vielä julkaisuja) selectors
        'svg[aria-label="Kamera"]',
        'svg[aria-label="Kamera"][viewBox="0 0 96 96"]',
        'svg[aria-label="Kamera"][height="62"][width="62"]',
    ];

    const bannedPhrases = [
        "Sinulle Ehdotettu", "tiliehdotuksia", "Sinulle Ehdotettua", "Meta AI", "Threads", "Näytä kaikki", "Myös Metalta", "Piiloitetut sanat", "Rajoitetut tilit", "Restricted accounts", "Hidden Words", "Piilota tarinat ja livet", "Hide stories and live",
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
        { selector: 'span', text: 'Tietyt profiilitiedot' },
        { selector: 'button', text: 'Piilota tarinat ja livet' },
        { selector: 'button', text: 'Hidden Words' },
        { selector: 'span', text: 'Piilota tarinat ja livet' },
        { selector: 'span', text: 'Hide stories and live' },
        { selector: 'a', text: 'Meta AI' },
        { selector: 'div', text: 'Sinulle ehdotettua' },
        { selector: 'div', text: 'tiliehdotuksia' },
        { selector: 'div', text: 'Sinulle ehdotettu' },
        { selector: 'h2', text: 'Suggested for you' },
        { selector: 'span', text: 'Threads' }
    ];

    let currentURL = window.location.href;
    const hiddenElements = new WeakSet();
    let reelsStyleInjected = false;

    const IG_SEARCH_HIDDEN_ATTR = 'data-ig-search-hidden-reason';
    const IG_SEARCH_APPROVE_ATTR = 'data-ig-approve';
    const IG_SEARCH_ROW_ATTR = 'data-ig-row';

    // Helper to unhide nodes
    const unhideNode = (n) => {
        if (n) {
            n.style.removeProperty('display');
            if (hiddenElements.has(n)) hiddenElements.delete(n);
        }
    };

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

    function isInPostOverlay(node) {
        try {
            return !!(node && node.closest('div[role="dialog"], section[role="dialog"], div[aria-modal="true"]'));
        } catch { return false; }
    }
    function isPostOverlayOpen() {
        return !!document.querySelector('div[role="dialog"] article, section[role="dialog"] article, div[aria-modal="true"] article, div[role="dialog"] [data-testid="post"]');
    }
    function updateOverlayState() {
        try {
            const hasOverlay = isPostOverlayOpen();
            const target = document.body || document.documentElement;
            if (!target) return;
            if (hasOverlay) {
                target.classList.add('ig-overlay-open');
                document.querySelectorAll('div[role="dialog"], section[role="dialog"], div[aria-modal="true"]').forEach(dlg => {
                    dlg.querySelectorAll('*').forEach(el => {
                        if (hiddenElements.has(el)) {
                            el.style.removeProperty('display');
                            el.style.removeProperty('visibility');
                            el.style.removeProperty('opacity');
                            el.style.removeProperty('position');
                            el.style.removeProperty('left');
                            el.style.removeProperty('top');
                            hiddenElements.delete(el);
                        }
                    });
                });
            } else {
                target.classList.remove('ig-overlay-open');
            }
        } catch {}
    }

    const POST_PATH_RE = /^\/(?:[^/]+\/)?(reel|p|tv)\/([A-Za-z0-9_-]+)\/?$/i;
    const EXCLUDE_SUBPATH_RE = /\/c\/|\/comments\/|\/liked_by(?:\/|$)/i;

    function findPermalink(root) {
        const scope = root || document;
        try {
            const inScopeAnchors = scope.querySelectorAll('a[href]');
            for (const a of inScopeAnchors) {
                const href = a.getAttribute('href');
                if (!href || EXCLUDE_SUBPATH_RE.test(href)) continue;
                try {
                    const url = new URL(href, location.origin);
                    if (POST_PATH_RE.test(url.pathname)) {
                        return url.href;
                    }
                } catch {}
            }
            const canonical = document.querySelector('link[rel="canonical"]');
            if (canonical && canonical.href) {
                try {
                    const url = new URL(canonical.href, location.origin);
                    if (!EXCLUDE_SUBPATH_RE.test(url.pathname) && POST_PATH_RE.test(url.pathname)) {
                        return url.href;
                    }
                } catch {}
            }
            if (scope !== document) {
                const docAnchors = document.querySelectorAll('a[href]');
                for (const a of docAnchors) {
                    const href = a.getAttribute('href');
                    if (!href || EXCLUDE_SUBPATH_RE.test(href)) continue;
                    try {
                        const url = new URL(href, location.origin);
                        if (POST_PATH_RE.test(url.pathname)) {
                            return url.href;
                        }
                    } catch {}
                }
            }
        } catch {}
        return null;
    }

    window.__getIgPermalinkForBannedCaption = function __getIgPermalinkForBannedCaption(containerEl) {
        return findPermalink(containerEl || document);
    };

    window.__redirectToPermalink = function __redirectToPermalink(containerEl) {
        const target = findPermalink(containerEl || document);
        if (!target) return false;
        try {
            const current = new URL(location.href);
            const targetUrl = new URL(target, location.origin);
            const alreadyOnPost =
                POST_PATH_RE.test(current.pathname) &&
                current.origin === targetUrl.origin &&
                current.pathname.replace(/\/+$/, "") === targetUrl.pathname.replace(/\/+$/, "");
            if (alreadyOnPost) return false;
            location.assign(targetUrl.href);
            return true;
        } catch {
            return false;
        }
    };

    function isPermalinkView() {
        try {
            const p = location.pathname;
            return /^\/(?:[^/]+\/)?(?:p|reel|tv)\/[A-Za-z0-9_\-]+/.test(p);
        } catch { return false; }
    }
    
    function extractHandlesFromText(text) {
        const out = new Set();
        if (!text || typeof text !== 'string') return [];
        try {
            const re = /@([A-Za-z0-9._]{2,30})/g;
            let m;
            while ((m = re.exec(text)) !== null) {
                const h = (m[1] || '').toLowerCase();
                if (h) out.add(h);
            }
        } catch {}
        return Array.from(out);
    }
    
    function getAuthorFromNode(node) {
        if (!node) return '';
        const RESERVED = new Set(['p','reel','tv','explore','reels','accounts','stories','direct','meta-ai','ai', 'about', 'help', 'legal']);
        
        try {
            const profileLinks = Array.from(node.querySelectorAll('a[role="link"][href^="/"]'));
            for (const a of profileLinks) {
                const href = a.getAttribute('href') || '';
                const parts = href.split('/').filter(Boolean);
                if (parts.length === 1 && !RESERVED.has(parts[0]) && !href.includes('?')) {
                    if (a.querySelector('img') || a.querySelector('svg')) {
                        return parts[0].toLowerCase();
                    }
                }
            }
            
            const allLinks = Array.from(node.querySelectorAll('a[href^="/"]'));
            for (const a of allLinks) {
                const href = a.getAttribute('href') || '';
                const parts = href.split('/').filter(Boolean);
                if (parts.length === 1 && !RESERVED.has(parts[0]) && !href.includes('?')) {
                    return parts[0].toLowerCase();
                }
            }
        } catch {}
        return '';
    }

    function getTargetCaptionNode(rootNode) {
        if (!rootNode) return null;

        const article = rootNode.tagName === 'ARTICLE' ? rootNode : rootNode.querySelector('article');
        if (article) return article;

        const h1 = rootNode.querySelector('h1');
        if (h1 && h1.textContent.trim().length > 0) {
            let parent = h1;
            for (let i=0; i<3; i++) { if (parent.parentElement) parent = parent.parentElement; }
            return parent;
        }

        const timeEls = Array.from(rootNode.querySelectorAll('time'));
        if (timeEls.length > 0) {
            const firstTime = timeEls[0];
            let parent = firstTime.parentElement;
            for (let i = 0; i < 7; i++) {
                if (parent && parent.parentElement && parent.tagName !== 'MAIN' && parent.getAttribute('role') !== 'dialog') {
                    parent = parent.parentElement;
                }
            }
            return parent;
        }

        return null; 
    }

    function collectCaptionTextsFromArticle(article) {
        const texts = [];
        const add = v => { if (v && typeof v === 'string') { const t = v.trim(); if (t) texts.push(t); } };
        try {
            article.querySelectorAll('span, div, p').forEach(el => {
                if (el.closest('ul[role="list"]')) return;
                const t = (el.textContent || '').trim();
                if (t && /[A-Za-z]/.test(t)) add(t);
            });
        } catch {}
        return texts;
    }

    function articleHasBannedCaption(article) {
        try {
            const texts = collectCaptionTextsFromArticle(article);
            const combinedText = texts.join(' ');
            for (const t of texts) {
                const low = t.toLowerCase();
                if (!allowedWordsLower.some(w => low.includes(w))) {
                    for (const kw of bannedKeywordsLower) {
                        if (kw && low.includes(kw)) return true;
                    }
                    for (const rx of bannedRegexes) {
                        try { if (rx.test(t)) return true; } catch {}
                    }
                }
            }
            const handles = extractHandlesFromText(combinedText);
            for (const h of handles) {
                if (instagramAccountsSet.has(h)) return true;
                if (!allowedWordsLower.some(w => h.includes(w))) {
                    for (const kw of bannedKeywordsLower) {
                        if (kw && h.includes(kw)) return true;
                    }
                    for (const rx of bannedRegexes) {
                        try { if (rx.test(h)) return true; } catch {}
                    }
                }
            }
            const attrNodes = article.querySelectorAll('[alt],[title],[aria-label]');
            for (const node of attrNodes) {
                ['alt','title','aria-label'].forEach(attr => {
                    const val = node.getAttribute(attr);
                    if (!val) return;
                    const low = val.toLowerCase();
                    if (!allowedWordsLower.some(w => low.includes(w))) {
                        for (const kw of bannedKeywordsLower) {
                            if (kw && low.includes(kw)) { throw 'BANNED_FOUND'; }
                        }
                        for (const rx of bannedRegexes) {
                            if (rx.test(val)) { throw 'BANNED_FOUND'; }
                        }
                        extractHandlesFromText(val).forEach(h => {
                            if (instagramAccountsSet.has(h)) { throw 'BANNED_FOUND'; }
                            if (!allowedWordsLower.some(w => h.includes(w))) {
                                for (const kw of bannedKeywordsLower) {
                                    if (kw && h.includes(kw)) { throw 'BANNED_FOUND'; }
                                }
                                for (const rx of bannedRegexes) {
                                    if (rx.test(h)) { throw 'BANNED_FOUND'; }
                                }
                            }
                        });
                    }
                });
            }
            const links = article.querySelectorAll('a[href]');
            for (const a of links) {
                const hrefRaw = a.getAttribute('href') || '';
                let pathname = '';
                try {
                    const u = new URL(hrefRaw, location.origin);
                    pathname = u.pathname.toLowerCase();
                } catch {
                    pathname = hrefRaw.split('?')[0].split('#')[0].toLowerCase();
                }
                const parts = pathname.split('/').filter(Boolean);
                if (parts.length) {
                    const candidateUser = parts[0];
                    if (instagramAccountsSet.has(candidateUser)) return true;
                }
                const hrefLow = hrefRaw.toLowerCase();
                if (!allowedWordsLower.some(w => hrefLow.includes(w))) {
                    for (const kw of bannedKeywordsLower) {
                        if (kw && hrefLow.includes(kw)) return true;
                    }
                    for (const rx of bannedRegexes) {
                        if (rx.test(hrefRaw)) return true;
                    }
                }
            }
        } catch (e) {
            if (e === 'BANNED_FOUND') return true;
        }
        return false;
    }

    function closeOverlayIfPossible() {
        try {
            const closeBtn = document.querySelector('div[role="dialog"] [aria-label="Sulje"], div[role="dialog"] [aria-label="Close"], div[role="dialog"] svg[aria-label="Sulje"], div[role="dialog"] svg[aria-label="Close"]');
            closeBtn?.click();
        } catch {}
    }

    function expandAndScanNode(node, postID) {
        return new Promise((resolve) => {
            try {
                if (!node) return resolve(true);

                if (postID && scannedPostsCache.has(postID)) {
                    const isBanned = scannedPostsCache.get(postID);
                    return resolve(!isBanned);
                }

                if (articleHasBannedCaption(node)) {
                    if (postID) scannedPostsCache.set(postID, true);
                    return resolve(false); 
                }

                const moreBtns = Array.from(node.querySelectorAll('[role="button"], span, div')).filter(el => {
                    if (!el || !el.textContent) return false;
                    const txt = el.textContent.trim().toLowerCase();
                    return txt === 'more' || txt === 'lisää' || txt === 'more...' || txt === 'lisää...';
                });
                
                const moreBtn = moreBtns[0];

                if (moreBtn) {
                    const origOpacity = node.style.opacity;
                    node.style.setProperty('opacity', '0', 'important');
                    
                    moreBtn.click();
                    
                    setTimeout(() => {
                        const hasBanned = articleHasBannedCaption(node);
                        if (!hasBanned && postID) {
                            feedApprovedPostIDs.add(postID); 
                            approvedPostIDs.add(postID);
                        }
                        if (postID) scannedPostsCache.set(postID, hasBanned);
                        
                        if (!hasBanned) {
                            node.style.setProperty('opacity', origOpacity || '1');
                        }
                        resolve(!hasBanned);
                    }, 300);
                    return;
                }

                if (postID) {
                    feedApprovedPostIDs.add(postID); 
                    approvedPostIDs.add(postID);
                }
                if (postID) scannedPostsCache.set(postID, false);
                resolve(true); 
            } catch (e) {
                resolve(true); 
            }
        });
    }

    function safelyHideFeedArticle(article) {
        if (!article) return;
        article.style.setProperty('max-height', '1px', 'important');
        article.style.setProperty('height', '1px', 'important');
        article.style.setProperty('min-height', '1px', 'important');
        article.style.setProperty('margin', '0px', 'important');
        article.style.setProperty('padding', '0px', 'important');
        article.style.setProperty('opacity', '0', 'important');
        article.style.setProperty('pointer-events', 'none', 'important');
        article.style.setProperty('border', 'none', 'important');
        article.style.setProperty('overflow', 'hidden', 'important');
        article.style.removeProperty('visibility'); 
        hiddenElements.add(article);
        
        stripImagesWithin(article);
    }

    function processFeedPostsForScanning() {
        try {
            if (isReelsPage() || isExcludedPath()) return;
            
            const articles = document.querySelectorAll('article');
            if (articles.length === 0) return;
            
            articles.forEach(article => {
                const postID = getPostIDFromArticle(article);
                
                const scannedID = article.getAttribute('data-scanned-post-id');
                if (postID && scannedID && scannedID !== postID) {
                    article.removeAttribute('data-banned-scan');
                    article.removeAttribute('data-feed-scan-done');
                }

                if (article.hasAttribute('data-feed-scan-done')) return;
                
                article.setAttribute('data-feed-scan-done', '1');
                if (postID) {
                    article.setAttribute('data-scanned-post-id', postID);
                }
                
                expandAndScanNode(article, postID).then(isClean => {
                    if (isClean) {
                        article.setAttribute('data-banned-scan', 'safe');
                    } else {
                        article.setAttribute('data-banned-scan', 'banned');
                        safelyHideFeedArticle(article);
                    }
                }).catch(() => {
                    article.setAttribute('data-banned-scan', 'safe');
                });
            });
            
            addTimeout(() => { isFeedScanPhase = false; }, 2000);
        } catch {}
    }

    let permalinkScanAttempts = 0;
    const MAX_PERMALINK_SCAN_ATTEMPTS = 80;
    const PERMALINK_RESCAN_DELAY = 60;

    function scanPermalinkArticleAndAct() {
        try {
            let postID = null;
            const match = location.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
            if (match) postID = match[2];

            if (isPermalinkView()) {
                const root = document.querySelector('main') || document.body;
                
                const captionNode = getTargetCaptionNode(root);
                
                if (!captionNode) return;
                if (captionNode.getAttribute('data-caption-scanned') === '1') return;
                
                captionNode.setAttribute('data-caption-scanned', '1');
                
                expandAndScanNode(captionNode, postID).then(isClean => {
                    if (!isClean) {
                        let author = getAuthorFromNode(root) || (location.pathname.match(/^\/([^/]+)\//)?.[1]?.toLowerCase() || '');
                        const RESERVED = new Set(['p','reel','tv','explore','reels','accounts','stories','direct','meta-ai','ai']);
                        if (RESERVED.has(author)) author = ''; 

                        if (author) {
                            fastRedirect(`https://www.instagram.com/${author}/`);
                        } else {
                            fastRedirect('https://www.instagram.com/');
                        }
                    } else {
                        const article = root.tagName === 'ARTICLE' ? root : root.querySelector('article');
                        if (article) article.setAttribute('data-banned-scan', 'safe');
                    }
                });
                return;
            }
            
            if (isPostOverlayOpen()) {
                const overlay = document.querySelector('div[role="dialog"], section[role="dialog"], div[aria-modal="true"]');
                if (!overlay) return;
                
                const captionNode = getTargetCaptionNode(overlay);
                if (!captionNode) return;

                if (captionNode.getAttribute('data-caption-scanned') === '1') return;
                captionNode.setAttribute('data-caption-scanned', '1');
                
                expandAndScanNode(captionNode, postID).then(isClean => {
                    if (!isClean) {
                        closeOverlayIfPossible();
                        safelyHideFeedArticle(overlay);
                    } else {
                        const article = overlay.querySelector('article');
                        if (article) article.setAttribute('data-banned-scan', 'safe');
                    }
                });
            }
        } catch {}
    }

    function makeOverlayLikesClickable() {
        if (!isPostOverlayOpen()) return;
        
        const overlay = document.querySelector('div[role="dialog"] article, section[role="dialog"] article, div[aria-modal="true"] article');
        if (!overlay) return;

        const buttons = overlay.querySelectorAll('span[role="button"][tabindex="0"], div[role="button"][tabindex="0"]');
        
        buttons.forEach(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            if (/^[0-9,.\s]+(?:t\.|m|tykkäystä|likes|k)?$/.test(txt)) {
                if (!btn.hasAttribute('data-ig-likes-fixed')) {
                    btn.setAttribute('data-ig-likes-fixed', '1');
                    btn.style.setProperty('cursor', 'pointer', 'important');
                    btn.title = "View Likes (Redirects to post)";
                    
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const postLink = findPermalink(overlay);
                        if (postLink) {
                            const url = new URL(postLink);
                            const likedByUrl = url.origin + url.pathname.replace(/\/$/, '') + '/liked_by/';
                            fastRedirect(likedByUrl);
                        } else {
                            closeOverlayIfPossible();
                        }
                    }, true);
                }
            }
        });
    }

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

        return rules;
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
        document.querySelectorAll('[role="dialog"], section[role="dialog"], div[aria-modal="true"]').forEach(d => {
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

                const user = usernameFromHref(href);
                if (user && instagramAccountsSet.has(user)) {
                    blockRow(row, `user:${user}`);
                    decided = true;
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
                if (!container) break;

                if (container.classList.contains('x9f619') && 
                    container.classList.contains('x3nfvp2') && 
                    container.classList.contains('xr9ek0c') &&
                    container.textContent.includes('Myös Metalta')) {

                    collapseElement(container);
                    break;
                }

                if (container.textContent.includes('Myös Metalta')) {
                    const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
                    const area = rect ? rect.width * rect.height : 0;
                    if (area > 80 && area < 60000 &&
                        !isElementProtected(container) &&
                        !container.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                        collapseElement(container);
                        break;
                    }
                }
            }
        });

        const allDivs = document.querySelectorAll('div');
        allDivs.forEach(div => {
            if (!div.textContent) return;
            const txt = div.textContent.trim();
            if (txt !== 'Myös Metalta') return;

            const strict = div.closest('div.x9f619.x3nfvp2.xr9ek0c');
            if (strict) {
                if (!hiddenElements.has(strict) && !isElementProtected(strict)) {
                    collapseElement(strict);
                }
                return;
            }

            let container = div;
            let level = 0;
            while (container && level < 4) {
                const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
                const area = rect ? rect.width * rect.height : 0;
                if (area > 80 && area < 60000 &&
                    !isElementProtected(container) &&
                    !container.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                    collapseElement(container);
                    break;
                }
                container = container.parentElement;
                level++;
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
            'span:has(a[href*="help.instagram.com/347751748650214"])',
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
                text === 'Hide stories and live' ||
                text === 'Näytä tiliehdotuksia profiileissa' ||
                text === 'Show account suggestions on profiles') {
                let container = element;
                let level = 0;
                while (container && level < 8) {
                    if (container.tagName === 'A' || 
                        container.getAttribute('role') === 'button' ||
                        container.classList.contains('x1i10hfl') ||
                        (container.tagName === 'DIV' && 
                         container.classList.contains('x9f619') &&
                         container.onclick) ||
                        (container.tagName === 'DIV' && container.querySelector('input[role="switch"]'))) {
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
                 text === 'Hide stories and live' ||
                 text === 'Näytä tiliehdotuksia profiileissa' ||
                 text === 'Show account suggestions on profiles') && 
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

    function hideSinulleEhdotettuaBlock() {
        try {
            const spans = document.querySelectorAll('span');
            spans.forEach(span => {
                if (!span.textContent) return;
                const txt = span.textContent.trim();
                if (txt !== 'Sinulle ehdotettua') return;

                let container = span.closest('div.html-div') || span.parentElement;
                if (!container) return;

                const scope = container.closest('div') || container;
                const hasShowAllLink =
                    !!scope.querySelector('a[href="/explore/people/"] span') ||
                    !!scope.querySelector('a[href^="/explore/people"]');

                if (!hasShowAllLink) return;

                let lvl = 0;
                let candidate = container;
                while (candidate && lvl < 6) {
                    const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
                    const area = rect ? rect.width * rect.height : 0;

                    const plausibleSize = area > 200 && area < 300000;
                    const isHtmlDiv = candidate.classList.contains('html-div');

                    if (isHtmlDiv &&
                        plausibleSize &&
                        !isElementProtected(candidate) && 
                        !candidate.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                        if (candidate.querySelector('article')) break;

                        collapseElement(candidate);
                        return;
                    }

                    candidate = candidate.parentElement;
                    lvl++;
                }

                const rect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
                const area = rect ? rect.width * rect.height : 0;
                if (area > 80 && area < 150000 &&
                    !isElementProtected(container) &&
                    !container.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                    collapseElement(container);
                }
            });
        } catch {}
    }

const injectInlineCSS = () => {
    try {
        const styleId = 'extra-redirect-style';
        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
        }
        const searchBanCSS = buildSearchBanCSS();

        const articleProtectionCSS = `
        main article:not([data-banned-scan]),
        div[role="dialog"] article:not([data-banned-scan]),
        section[role="dialog"] article:not([data-banned-scan]) {
            opacity: 0 !important;
            pointer-events: none !important;
            transition: opacity 0.1s ease-in !important;
        }
        main article[data-banned-scan="safe"],
        div[role="dialog"] article[data-banned-scan="safe"],
        section[role="dialog"] article[data-banned-scan="safe"] {
            opacity: 1 !important;
            pointer-events: auto !important;
        }
        main article[data-banned-scan="banned"],
        div[role="dialog"] article[data-banned-scan="banned"],
        section[role="dialog"] article[data-banned-scan="banned"] {
            height: 1px !important;
            min-height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            border: none !important;
            pointer-events: none !important;
            visibility: hidden !important;
        }
        `;

        const approveGateCSS = `
[role="listbox"] [role="option"]:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] li:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] a[role="link"]:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
[role="listbox"] a._a6hd:not([${IG_SEARCH_APPROVE_ATTR}="1"]),
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

        const safeSuffix = `:not(:has(nav)):not(:has(footer)):not(:has(svg[aria-label="Lisää"])):not(:has(svg[aria-label="Asetukset"])):not(:has(svg[aria-label="More"])):not(:has(a[href*="about.instagram.com"])):not(:has(article)):not(:has(a[href*="instagram.com/direct"]))`;
        const overlayGuardedSelectors = selectorsToHide.map(s => `html:not(.ig-overlay-open) ${s}${safeSuffix}`).join(',\n');

        style.textContent = `
        ${articleProtectionCSS}

        ${overlayGuardedSelectors} {
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

        /* === CSS SLEDGEHAMMER FOR "POISTA SEURAAJA" MENUS === */
        html:not(.safe-story-zone) [role="dialog"] button.xjbqb8w.x1qhh985.x10w94by.x14e42zd.x1yvgwvq.x13fuv20.x178xt8z.x1ypdohk.xvs91rp.x1evy7pa.xdj266r.x14z9mp.xat24cr.x1lziwak.x1wxaq2x.x1iorvi4.xf159sx.xjkvuk6.xmzvs34.x2b8uid.x87ps6o.xxymvpz.xh8yej3.x52vrxo.x4gyw5p.xkmlbd1.x1xlr1w8 {
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

        /* 1. PUSH THE RIGHT SIDEBAR PROFILE DOWN & KILL THE GHOST GAP */
        div[style*="--x-width: 100%;"]:has(a[role="link"]),
        div[style*="--x-width:100%"]:has(a[role="link"]) {
            margin-top: 26px !important; 
            gap: 0px !important; 
            transition: none !important;
        }

        /* 2. PUSH THE FOOTER UP */
        div:has(> nav ul li a[href*="about.instagram.com"]) {
            margin-top: -20px !important; 
            padding-top: 0px !important;
            gap: 0px !important;
            transition: none !important;
        }

        /* INSTANTLY HIDE "SUGGESTED FOR YOU" TO STABILIZE SIDEBAR */
        div:has(> div > div > a[href^="/explore/people"]) {
            display: none !important;
        }

        /* ADJUST STORIES TRAY PLACEMENT */
        div[data-pagelet="story_tray"] {
            margin-top: -16px !important; 
        }

        ${searchBanCSS}
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

injectInlineCSS();

    const hideCriticalElements = () => {
        selectorsToHide.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                if (isInPostOverlay(el)) return;
                if (!hiddenElements.has(el)) {
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                    hiddenElements.add(el);
                }
            });
        });
        processFeedPostsForScanning();
        hideMyosMetaltaElements();
        hideSettingsPageElements();
        hideSinulleEhdotettuaBlock();
        hideUnwantedUIButtons();
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
    };
    hideCriticalElements();
    updateOverlayState();
    scanPermalinkArticleAndAct();

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
            a[href="/ai/"],
            a[href="/meta-ai/"],
            a[aria-label*="Meta AI"],
            *[aria-label="Meta AI"],
            [data-testid*="meta-ai"],
            [data-testid*="metaai"],
            [aria-label*="Myös Metalta"],
            [title*="Myös Metalta"],
            svg[aria-label*="Myös Metalta"],
            div[role="button"][tabindex][aria-label="Tutki"],
            svg[aria-label="Tutki"],
            div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"],
            a[href="/explore/"],
	    span:has(a[href*="help.instagram.com/347751748650214"]),
            div[role="button"][tabindex][aria-label="Threads"],
            svg[aria-label="Threads"],
            a.x1i10hfl[href*="threads"],
            a[href="/explore/"],
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

    function igBlankOutPage() {
        try {
            let s = document.getElementById('ig-blank-style');
            if (!s) {
                s = document.createElement('style');
                s.id = 'ig-blank-style';
                s.textContent = `
                    html, body { background = '#fff !important; }
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
        try {
            const urlObj = new URL(url);
            const parts = urlObj.pathname.split('/').filter(Boolean);
            if (parts.length > 0) {
                const username = parts[0].toLowerCase();
                const RESERVED = new Set(['p','reel','tv','explore','reels','accounts','stories','direct','meta-ai','ai', 'about', 'help', 'legal', 'archive']);
                if (!RESERVED.has(username)) {
                    if (instagramAccountsSet.has(username)) return true;
                    if (dynamicWrestlingSlugs.some(slug => username === slug || username.includes(slug.replace(/-/g, '')))) return true;
                }
            }
        } catch(e){}
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
            if (isElementProtected(element)) return;

            stripImagesWithin(element);
            
            const isArticle = element.tagName === 'ARTICLE';
            
            if (isArticle) {
                element.style.setProperty('max-height', '1px', 'important');
                element.style.setProperty('height', '1px', 'important');
                element.style.setProperty('min-height', '1px', 'important');
                element.style.setProperty('margin', '0', 'important'); 
                element.style.setProperty('overflow', 'hidden', 'important');
                element.style.setProperty('padding', '0', 'important');
                element.style.setProperty('border', 'none', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('pointer-events', 'none', 'important');
                Array.from(element.children).forEach(child => {
                    child.style.setProperty('display', 'none', 'important');
                });
            } else {
                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('position', 'absolute', 'important');
                element.style.setProperty('height', '0', 'important');
                element.style.setProperty('width', '0', 'important');
                element.style.setProperty('pointer-events', 'none', 'important');
            }
            
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
        if (isPostOverlayOpen()) return;
        if (!selectors || !selectors.length) return;
        const allSelectors = selectors.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            if (isInPostOverlay(element)) return;
            if (hiddenElements.has(element)) return;
            
            const isProtected = isElementProtected(element);
            
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
        if (isPostOverlayOpen()) return;
        if (!selectors || !selectors.length) return;
        const allSelectors = selectors.join(',');
        document.querySelectorAll(allSelectors).forEach(element => {
            if (isInPostOverlay(element)) return;
            if (hiddenElements.has(element)) return;
            
            const isProtected = isElementProtected(element);
            if (isProtected) return;
            if (isExcludedPath()) return;
            const textContent = element.textContent ? element.textContent.toLowerCase() : "";
            
            const exactTrimmed = element.textContent ? element.textContent.trim().toLowerCase() : "";
            const currentPathLow = location.pathname.toLowerCase();
            const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
            const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];
            if (isNightmareStory && storySafeWords.includes(exactTrimmed)) return;
            if (['peruuta', 'cancel'].includes(exactTrimmed)) return;

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
                let postWrapper = findPostWrapper(element);
                if (!postWrapper) postWrapper = element.closest('article');

                if (postWrapper && postWrapper.getAttribute('data-banned-scan') === 'safe') {
                    // This post is globally safe, do not hide!
                } else if (postWrapper && isInPostOverlay(postWrapper)) {
                    // skip
                } else if (postWrapper && !hiddenElements.has(postWrapper)) {
                    const containsAllowedWords = allowedWordsLower.some(word =>
                        postWrapper.textContent && postWrapper.textContent.toLowerCase().includes(word)
                    );
                    if (!containsAllowedWords) {
                        collapseElement(postWrapper);
                    }
                } else if (!postWrapper) {
                    collapseElement(element);
                }
            }
        });

        textBasedTargets.forEach(target => {
            querySelectorAllWithContains(target.selector, target.text).forEach(element => {
                if (isInPostOverlay(element)) return;
                if (!hiddenElements.has(element)) {
                    const isProtected = isElementProtected(element);
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

        // === THE SAFE ZONE TOGGLE ===
        const currentPathLow = location.pathname.toLowerCase();
        if (currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/')) {
            document.documentElement.classList.add('safe-story-zone');
        } else {
            document.documentElement.classList.remove('safe-story-zone');
        }
        // ============================

        if (shouldInstagramRedirect()) {
            window.stop();
            fastRedirect('https://www.instagram.com');
            return;
        }

        if (currentURL.includes('www.threads.')) {
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
        hideSinulleEhdotettuaBlock();
        hideUnwantedUIButtons();
        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
        updateOverlayState();
        scanPermalinkArticleAndAct();
    }

    function hideInstagramAccountsFromList() {}

    function hideInstagramBannedContent() {
        if (!location.hostname.includes('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;
        
        instagramAccountsToHideLower.forEach(account => {
            if (location.pathname.toLowerCase() === `/${account}/` || location.pathname.toLowerCase().startsWith(`/${account}/`)) {
                const main = document.querySelector('main');
                if (main) {
                    collapseElement(main);
                }
            }
        });

        hideSinulleEhdotettuaBlock();

        if (isSearchSurfacePresent()) {
            hideInstagramSearchResults();
        }
        updateOverlayState();
        scanPermalinkArticleAndAct();
    }

    function genericAggressiveHider() {
        if (!location.hostname.includes('instagram.com')) return;
        if (location.pathname.match(/\/(followers|following)/)) return;
        if (isExcludedPath()) return;
        if (isReelsPage()) return;
        if (isPostOverlayOpen()) return;
        if (!document.body) return;
        
        const allTextNodes = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
            allTextNodes.push(node);
        }
        
        const nukeTargets = ['sponsoroitu', 'sponsored', 'sinulle ehdotettu', 'sinulle ehdotettua', 'suggested for you'];

        allTextNodes.forEach(node => {
            let txtRaw = node.nodeValue || '';
            let txt = txtRaw.toLowerCase();
            let exactTrimmed = txtRaw.trim().toLowerCase();
            
            const currentPathLow = location.pathname.toLowerCase();
            const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
            const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];
            if (isNightmareStory && storySafeWords.includes(exactTrimmed)) return;
            if (['peruuta', 'cancel'].includes(exactTrimmed)) return;

            if (allowedWordsLower.some(word => txt.includes(word))) return;
            
            if (nukeTargets.includes(exactTrimmed)) {
                const wrapper = findPostWrapper(node.parentElement);
                if (wrapper && !isElementProtected(wrapper) && !wrapper.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                    collapseElement(wrapper);
                }
                return; 
            }

            if (bannedKeywordsLower.some(keyword => txt.includes(keyword))) {
                let el = node.parentElement;
                if (el && isInPostOverlay(el)) return;
                if (el && el.closest('article[data-banned-scan="safe"]')) return;
                if (el && el.offsetParent !== null && 
                    !el.matches('main, section[role="main"], div[role="main"], body, html, nav') &&
                    !isElementProtected(el)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width * rect.height > 150000)) return;
                    collapseElement(el);
                }
            }
        });
        
        allTextNodes.forEach(node => {
            let txtRaw = node.nodeValue || '';
            let txt = txtRaw.toLowerCase();
            let exactTrimmed = txtRaw.trim().toLowerCase();
            
            const currentPathLow = location.pathname.toLowerCase();
            const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
            const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];
            if (isNightmareStory && storySafeWords.includes(exactTrimmed)) return;
            if (['peruuta', 'cancel'].includes(exactTrimmed)) return;

            if (allowedWordsLower.some(word => txt.includes(word))) return;
            if (bannedRegexes.some(re => re.test(txtRaw))) {
                let el = node.parentElement;
                if (el && isInPostOverlay(el)) return;
                if (el && el.closest('article[data-banned-scan="safe"]')) return;
                if (el && el.offsetParent !== null && 
                    !el.matches('main, section[role="main"], div[role="main"], body, html, nav') &&
                    !isElementProtected(el)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width * rect.height > 150000)) return;
                    collapseElement(el);
                }
            }
        });
        hideSinulleEhdotettuaBlock();
        hideUnwantedUIButtons();
        updateOverlayState();
        scanPermalinkArticleAndAct();
    }

    function hideUnfollowRowInProfileDialog() {
        try {
            const dlg = document.querySelector('[role="dialog"]');
            if (!dlg) return;
            dlg.querySelectorAll('button, div[role="button"][tabindex]').forEach(btn => {
                const txt = (btn.textContent || '').trim().toLowerCase();
                if (txt === 'unfollow' || txt === 'lopeta seuraaminen' || txt === 'estä' || txt === 'block') {
                    collapseElement(btn);
                }
            });
        } catch {}
    }

    function hideUnwantedUIButtons() {
        const currentPathLow = location.pathname.toLowerCase();
        const isNightmareStory = currentPathLow.includes('/stories/nightmaree3z') || currentPathLow.includes('/archive/');
        const targets = ['poista', 'delete', 'remove', 'poista seuraaja', 'remove follower', 'lopeta seuraaminen', 'unfollow', 'estä', 'block'];
        const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];
        
        document.querySelectorAll('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div').forEach(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            if (targets.includes(txt)) {
                if (btn.tagName === 'DIV' || btn.tagName === 'SPAN') {
                    if (btn.children.length > 2) return; 
                }
                
                if (isNightmareStory && storySafeWords.includes(txt)) {
                    unhideNode(btn);
                    let pBtn = btn.closest('button, [role="button"], a, .x1i10hfl');
                    unhideNode(pBtn);
                    return; 
                }
                
                collapseElement(btn);
                const parentBtn = btn.closest('button, [role="button"], a, .x1i10hfl');
                if (parentBtn && parentBtn !== btn) {
                    collapseElement(parentBtn);
                }
            }
        });
    }

    function fastSynchronousHider(mutations) {
        const path = location.pathname.toLowerCase();
        const isNightmareStory = path.includes('/stories/nightmaree3z') || path.includes('/archive/');
        const targets = ['poista', 'delete', 'remove', 'poista seuraaja', 'remove follower', 'lopeta seuraaminen', 'unfollow', 'estä', 'block'];
        const nukeTargets = ['sponsoroitu', 'sponsored', 'sinulle ehdotettu', 'sinulle ehdotettua', 'suggested for you'];
        const storySafeWords = ['poista', 'delete', 'remove', 'poista julkaisu', 'delete post', 'poista tarina', 'delete story'];

        for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];

            if (m.type === 'childList' && m.target) {
                let nodeForArticle = m.target.nodeType === 1 ? m.target : m.target.parentElement;
                if (nodeForArticle && nodeForArticle.closest) {
                    const article = nodeForArticle.closest('article');
                    if (article && article.hasAttribute('data-banned-scan')) {
                        const currentId = getPostIDFromArticle(article);
                        const scannedId = article.getAttribute('data-scanned-post-id');
                        if (currentId && scannedId && currentId !== scannedId) {
                            article.removeAttribute('data-banned-scan');
                            article.removeAttribute('data-feed-scan-done');
                            article.removeAttribute('data-scanned-post-id');
                        }
                    }
                }
            }

            const added = m.addedNodes;
            for (let j = 0; j < added.length; j++) {
                const node = added[j];
                if (node.nodeType !== 1) continue;
                
                let elements;
                try {
                    elements = node.matches('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div') 
                        ? [node, ...node.querySelectorAll('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div')]
                        : node.querySelectorAll('button, [role="button"], a, .x1i10hfl, [tabindex="0"], span, div');
                } catch { continue; }

                for (let k = 0; k < elements.length; k++) {
                    const el = elements[k];
                    if (el.tagName === 'DIV' || el.tagName === 'SPAN') {
                        if (el.children.length > 2) continue;
                    }
                    const txt = (el.textContent || '').trim().toLowerCase();
                    
                    if (nukeTargets.includes(txt)) {
                        el.style.setProperty('opacity', '0', 'important');
                        const wrapper = findPostWrapper(el);
                        if (wrapper && !isElementProtected(wrapper) && !wrapper.matches('main, section[role="main"], div[role="main"], body, html, nav')) {
                            collapseElement(wrapper);
                        }
                        continue;
                    }

                    if (targets.includes(txt)) {
                        if (isNightmareStory && storySafeWords.includes(txt)) {
                            unhideNode(el);
                            const pBtn = el.closest('button, [role="button"], a, .x1i10hfl');
                            unhideNode(pBtn);
                            continue; 
                        }
                        
                        if (!isElementProtected(el)) {
                            collapseElement(el);
                        }
                        
                        const parentBtn = el.closest('button, [role="button"], a, .x1i10hfl');
                        if (parentBtn && parentBtn !== el && !isElementProtected(parentBtn)) {
                            collapseElement(parentBtn);
                        }
                    }
                }
            }
        }
    }

    function checkSPARouting() {
        if (__lastKnownUrl !== window.location.href) {
            __lastKnownUrl = window.location.href;
            window.dispatchEvent(new Event('locationchange'));
        }
    }

    let observerScheduled = false;
    function observerCallback(mutationsList) {
        updateOverlayState();
        makeOverlayLikesClickable(); 
        fastSynchronousHider(mutationsList); 
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
            
            processFeedPostsForScanning();
            
            collapseElementsByKeywordsOrPaths(bannedKeywords, instagramBannedPaths, selectorsToMonitor);
            if (location.hostname.includes('instagram.com')) {
                hideInstagramBannedContent();
                checkForRedirectElements();
                hideMyosMetaltaElements();
                hideSettingsPageElements();
                hideSinulleEhdotettuaBlock();
                hideUnwantedUIButtons();
                if (isSearchSurfacePresent()) {
                    hideInstagramSearchResults();
                }
            }
            hideUnfollowRowInProfileDialog();
            updateOverlayState();
            scanPermalinkArticleAndAct();
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
            updateOverlayState();
            return;
        }
        if (location.hostname.includes('instagram.com') && location.pathname.match(/\/(followers|following)/)) {
            hideInstagramAccountsFromList();
            updateOverlayState();
            return;
        }
        
        processFeedPostsForScanning();

        if (location.hostname.includes('instagram.com')) {
            hideInstagramBannedContent();
            genericAggressiveHider();
            checkForRedirectElements();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            hideSinulleEhdotettuaBlock();
            hideUnwantedUIButtons();
            if (isSearchSurfacePresent()) {
                hideInstagramSearchResults();
            }
        }
        hideUnfollowRowInProfileDialog();
        updateOverlayState();
        scanPermalinkArticleAndAct();
        makeOverlayLikesClickable(); 
    }

    mainHandler();
    initObserver();

    function scheduleIntervals() {
        addInterval(() => {
            checkSPARouting(); 
            updateOverlayState();
            makeOverlayLikesClickable(); 
            if (!isReelsPage() && !document.hidden) {
                hideUnwantedUIButtons();
                if (isSearchSurfacePresent()) hideInstagramSearchResults();
                if (Math.random() < 0.3) genericAggressiveHider(); 
            }
        }, 250); 
    }
    startIntervals(scheduleIntervals);

    onEvent(document, 'visibilitychange', () => {
        updateOverlayState();
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleIntervals);
            mainHandler();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
    }, false);

    onEvent(document, 'click', (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href^="/p/"], a[href^="/reel/"], a[href^="/tv/"]');
        if (a) {
            addTimeout(() => { updateOverlayState(); scanPermalinkArticleAndAct(); }, 150);
            addTimeout(() => { updateOverlayState(); scanPermalinkArticleAndAct(); }, 300);
        }
    }, true);

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
        isFeedScanPhase = true; 
        reelsStyleInjected = false;
        currentURL = window.location.href;
        injectInlineCSS();
        updateOverlayState();
        permalinkScanAttempts = 0;
        if (isReelsPage()) {
            injectReelsCSS();
        } else {
            mainHandler();
            hideMyosMetaltaElements();
            hideSettingsPageElements();
            hideSinulleEhdotettuaBlock();
            hideUnwantedUIButtons();
            if (isSearchSurfacePresent()) hideInstagramSearchResults();
        }
        scanPermalinkArticleAndAct();
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

})();