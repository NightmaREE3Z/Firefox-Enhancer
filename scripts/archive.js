// ==UserScript==
// @name         ArchiveRedirect
// @version      1.4
// @description  Redirects specific archive pages to the Wayback Machine front page
// @match        *://web.archive.org/*
// @match        *://archive.org/*
// @match        *://web.archive.org/web/*
// @match        *://wayback.archive.org/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const currentURL = window.location.href.toLowerCase();

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
        "Jacy Jayne", "Gigi Dolin", "Tatum WWE", "dress", "Fallon Henley", "Kelani Jordan", "explicit", "AEW", "justforfans", "Katana Chance", "Mercedes", "Gambling", "Renee Young", "anaaliseksi", "Sasha", "Wendy Choo",
        "Paxley", "cam4", "biscuit rear", "d3ep", "Britt", "Mariah", "puzzy", "editing app", "linq", "pussy", "tushy", "Roxanne", "Blies", "CJ Lana", "Statlander", "f*cking", "f*cked", "f*cks", "f*ckup", "f**kery", "f*ckface", "f*ckwit",
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
        "face blend", "virtual reality face", "face technology", "face tech", "3D morph face", "face AI animation", "real-time face swap", "AI-driven photo manipulation", "deepfake model creation", "digital persona", "Blake",
        "face overlay", "synthetic person", "facial blending", "face swap", "virtual character face swap", "photorealistic face generator", "face altering AI", "realistic AI swap", "face expression morphing", "video gen", "Monroe",
        "face transformation AI", "virtual human face swap", "synthetic media generation", "3D face recreation", "AI-generated face animation", "neural network face replacement", "deepfake face morphing", "video generat", "Windsor",
        "face projection", "synthetic face swap", "face model", "virtual human face", "venice", "real-time deepfake", "photorealistic deepfake", "neural face transformation", "AI-generated face morph", "face render", "Thekla",
        "machine-generated face swap", "face image manipulation", "video face animation", "virtual morphing tool", "AI-powered video face swap", "digital face recreation", "AI-based facial replacement", "neural face", "All Elite",
        "machine learning face generator", "face recognition swap", "AI face animation tool", "synthetic media face", "AI character morphing", "deepfake avatar generation", "photoreal face synthesis", "synthetic face", "n@ked", "onnly",
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
	"lingerie", "Harley Cameron", "trunks", "pants", "underwear", "attire", "Vladimir", "Putin", "Trump", "Saraya", "kuvake", "irc-galleria", "irc galleria", "girl", "girls", "woman", "womans", "La Leona", "girl's", "dic*", "face +", "HorizonMW",
    ];

    // Define the regex patterns to search for in the URL or content
    const regexTerms = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i, /\bbra\b/i, /\bass\b/i, /genera/i,
        /\bmorph\b/i, /inpaint/i, /art intel/i, /birpp/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /ismartta/i, /image enhanced/i, /image enhancing/i, /virtual touchup/i, /retouch/i, /touchup/i, /touch up/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /Blis/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhanced image/i, /kuvankäsittely/i, /editor/i,
        /vegi/i, /vege/i, /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /birppis/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i,
        /Tiffa/i, /Strat/i, /puz/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /izzi dame/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i, /generator/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /\bSlut\b/i, /3dit/i, /ed1t/i, /playboy/i, /poses/i,
        /Sydney Sweeney/i, /Sweeney/i, /fap/i, /Sydnee/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bAMX\b/i, /posing/i, /Sweee/i,
        /\bAnal-\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bedit\b/i, /Feikki/i, /syväväärennös/i,
        /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /\bShe\b/i, /\bADMX\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /\bAi-\b/i, /syvä väärennös/i, /alaston/i, /\bHer\b/i,
        /P4IG3/i, /Paig3/i, /P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /\bTay\b/i, /\balexa wwe\b/i, /\bazz\b/i, /\bjaida\b/i, /Steph/i, /St3ph/i, /editation/i, /3d!7/i, /3d!t/i, /ed!t/i, /Chel5/i,
        /Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /CJ Perry/i, /Lana WWE/i, /Lana Del Rey/i, /\bLana\b/i, /CJ WWE/i, /image app/i, /edi7/i, /3d17/i, /ed!7/i,
        /pillu/i, /perse/i, /\bFuku\b/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /Peba/i, /Beba/i, /Bepa/i, /Babe/i, /baby/i, /\bAnaali\b/i, /\bSeksi\b/i, /picture app/i, /edit app/i, /pic app/i, /photo app/i, /syvavaarennos/i, /Perry WWE/i,
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen|poistamis)[ -]?(?:vaatteet|vaatteiden)/i, /\bAnus\b/i, /sexuaali/i, /\bAnal\b/i, 
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i, /sexual/i, /seksuaali/i, /play boy/i, /yhdyntä/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /\bMina\b/i, /fantasy edit/i, /AI recreation/i, /seksuaalisuus/i, /synthetic model/i,
        /Margot/i, /Robbie/i, /Ana de Armas/i, /soulgen/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Generated/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i, /artificial model/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /enhanced image/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /erotiikka/i, /läpinäkyvä/i, /Trish/i,
        /vaatepoisto/i, /poista vaatteet/i, /vaatteiden poisto/i, /tekoäly/i, /panee/i, /panevat/i, /paneminen/i, /panemis/i, /paneskelu/i, /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimista/i, /uncover/i, /leak/i, /Micki/i,
        /Stratusfaction/i, /yhdynnässä/i, /seksikuva/i, /seksivideo/i, /seksi kuvia/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i, /panokuva/i, /pano kuva/i, /pano kuvia/i, /panokuvia/i, /banned app/i,
	/masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpittäminen/i, /sormetus/i, /sormitus/i, /sormitta/i, /sormetta/i,
	/sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkkyvid/i, /aikuisviihde/i, /fisting/i, /fistaus/i,
	/sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuis sisältö/i, /aikuiskontsa/i, /filmora/i, /aikuiskontentti/i, /aikuis kontentti/i, /aikuiscontentti/i, /aikuis contentti/i, /pleasi/i, /pleasu/i, /herself/i, /her self/i, /bg remov/i, 
	/\bRembg\b/i, /\bRem bg\b/i, /\bDel bg\b/i, /\bDelbg\b/i, /delet bg/i, /fuck/i, /eras bg/i, /delet bg/i, /erase bg/i, /erasing bg/i, /bg delet/i, /bg erasing/i, /bg erase/i, /Blend face/, /Blendface/, /morphi/, /Blender face/, /5yvä/i,
	/\bMorf\b/i, /morfi/, /skin viewer/i, /skinviewer/i, /cloth/i, /clothing/i, /clothes/i, /female/i, /al4ston/i, /p!llu/i, /p!mppi/i, /p!mpp!/i, /pimpp!/i, /nakukuva/i, /nakuna/i, /kuvaton/i, /AI model$/i, /trained model$/i,
	/Reface/i, /DeepAI/i, /GFPGAN/i, /RestoreFormer/i, /FaceMagic/i, /desnudador/i, /des nudador/i, /GAN-based/i, /diffusion/i, /latent/i, /prompt ex/i, /txt2img/i, /img2img/i, /image to image/i, /image 2 image/i, /model/i, 
	/imagetoimage/i, /image2image/i, /girl/i, /woman/i, /women/i, /babe/i, /waifu/i, /wife/i, /spouse/i, /celeb/i, /celebrit/i, /Face Magic/i, /ex prompt/i, /example prompt/i, /prompt example/i, /4l4ston/i, /last0n/i, /l4st0n/i,
	/removebg/i, /remove bg/i, /remov bg/i, /removal bg/i, /ia onl/i, /removebg/i,  /removalbg/i, /rembg/i, /rem background/i, /del background/i, /eras background/i, /erase background/i, /erasing background/i, /butth/i, /buttc/i, 
	/\bIA\b/i,/\bIas\b/i, /\b-Ia\b/i, /\bIa-\b/i, /background eras/i, /background del/i, /background rem/i, /background off/i, /off background/i, /background out/i, /out background/i, /removbg/i, /ladies/i, /lady/i, /butts/i,
	/buttc/i, /butt c/i, /butt h/i, /butt s/i, /\bMLM\b/i, /\bLLM\b/i, /\bTit\b/i, /\bGen\b/i, /\bTits\b/i, /learn model/i, /mach model/i, /titten/i, /combin fac/i, /merg fac/i, /fac merg/i, /fac comb/i, /fac blend/i, /joinface/i, 
	/poista vaatteet/i, /poista vaat/i, /vaatteidenpoist/i, /vaatepoist/i, /poistavaat/i, /poistovaat/i, /too merg/i, /merg too/i, /two fac/i, /two fac/i, /too fac/i, /too fac/i, /fac join/i, /join fac/i, /join2fac/i, /facejoin/i, 
	/join 2 fac/i, /Stormwrestl/i, /Stormrassl/i, /Storm wrestl/i, /Storm rassl/i, /Storm rassl/i, /Toni AEW/i, /Storm AEW/i, /Toni WWE/i, /Toni AEW/i, /Genius of The Sky/i, /\bToni\b/i, /huora/i, /huoru/i, /horo/i, /horats/i,
	/prostitoitu/i, /ilotyttå/i, /ilotyttö/i, /ilötyttö/i, /ilötytto/i, /ilåtyttå/i, /ilåtyttö/i, /iløtyttö/i, /iløtytto/i, /iløtyttø/i, /il0tyttö/i, /il0tytto/i, /il0tytt0/i, /il0tyttå/i, /il0tyttø/i, /1lotyttö/i, /1lotytto/i, 
	/!lotyttö/i, /ilotyttø/i, /ilotytt0/i, /ilotytto/i, /bordel/i, /bordel/i, /bordelli/i, /ilotalo/i, /ilåtalo/i, /ilåtalå/i, /ilotalå/i, /iløtalo/i, /ilötalo/i, /il0talo/i, /iløtalå/i, /ilötalå/i, /ilotalø/i, /erootti/i,
	/\b0rg\b/i, /\bg45m\b/i, /\bGa5m\b/i, /\bG4sm\b/i, /\b@$\b/i, /erotii/i, /erooti/i, /erootii/i, /\bkuvake\b/i, /kuvakenet/i, /venoi/i, /venic/i, /kuvake.net/i, /toniwwe/i, /tonywwe/i, /\bphotor\b/i, /\bfotor\b/i, /buttz/i, 
	/Shirakawa/i, /Shira/i, /Shiri/i, /Shir/i, /biscit/i, /bisci/i, /bisce/i, /biszit/i, /bizcit/i, /biskui/i, /bizkita/i, /bizkitb/i, /bizkitc/i, /bizkitd/i, /bizkitt/i, /bizkitx/i, /bizkitz/i, /bizkitn/i, /bizkitm/i, 
	/bizkito/i, /bizkity/i, /bizkith/i, /bizkitv/i, /bizkitå/i, /bizkitä/i, /bizkitö/i, /biscuita/i, /biscuitb/i, /biscuitc/i, /biscuitd/i, /biscuite/i, /biscuitf/i, /biscuitg/i, /biscuith/i, /biscuiti/i, /biscuitj/i, /Leona/i, 
	/biscuitk/i, /biscuitl/i, /biscuitm/i, /biscuitn/i, /biscuito/i, /biscuitp/i, /biscuitq/i, /biscuitr/i, /biscuits/i, /biscuitt/i, /biscuitu/i, /biscuitv/i, /biscuitw/i, /biscuitx/i, /biscuity/i, /biscuitz/i, /biscuitå/i, 
	/biscuitä/i, /biscuitö/i, /biscuitö/i, /butta/i, /buttb/i, /buttc/i, /buttd/i, /buttf/i, /buttg/i, /butth/i, /butti/i, /buttj/i, /buttk/i, /buttl/i, /buttm/i, /buttn/i, /butto/i, /buttp/i, /buttq/i, /buttr/i, /butts/i, 
	/buttt/i, /buttu/i, /buttv/i, /buttw/i, /buttx/i, /butty/i, /buttz/i, /buttå/i, /buttä/i, /buttö/i, /Micky/i, /Mickie/i, /Mickie James/i, /Dixie/i, /Carter/i, /\bTNA\b/i, /\bGina\b/i, /\bGin4\b/i, /\bG1n4\b/i, /Gina Adams/i, 
	/\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /Gina Adam/i, /Adams WWE/i, /Gina WWE/i, /windsor/i, /alex wind/i, /Alex Windsor/i, /analsex/i, /\bGril\b/i, /\bGrils\b/i, /wemen's/i, /wemen/i, /wemon's/i, /wemons/i, /The Kat/,
	/Nikki/i, /ldaies/i, /laadie/i, /laadis/i, /leydis/i, /leydies/i, /lewdy/i, /lewdi/i, /lewdie's/i, /wuhmans/i, /wahmans/i, /wehmans/i, /Torrie/i, /Torr1/i, /Torr!/i, /Torrl/i, /wilson/i, /Kitty WWE/, /\bGail\b/i, /\bKim\b/i, 
	/\bAshley\b/i, /Dawn Marie/i, /Down Marie/i, /Massaro/i, /\bPamela\b/i, /\bBrooke\b/i, /\bTylo\b/i, /\bCatherine\b/i, /\bBridget\b/i, /\bSally\b/i, /0rg4/i, /org4/i, /org4/i, /orgy/i, /orgi/i, /org@/i, /0rg@/i, /0rg1/i, /0rgi/i, 
	/origas/i, /0riga/i, /0r1g4/i, /0rlg4/i, /orlg4/i, /0rlg@/i, /orlg@/i, /origa/i, /0riga/i, /or1ga/i, /orig4/i, /0r1g4/i, /0rlga/i, /orlg4/i, /0rlg4/i, /0rlg@/i,/orlg@/i, /0rrg4/i, /orrg4/i, /or1g@/i, /0r1g@/i, /0r1ga/i, /0r!g@/i,
	/0r!g4/i, /0rig@/i, /0rig4/i, /0r9ga/i, /0r9g4/i, /0r1q4/i, /0r1qa/i, /0rlg4h/i, /or1g@h/i, /orrga/i, /orrgaa/i, /orgaa/i, /HorizonMW/i, /Horizon MW/i, /Horizon Modern Warfare/i, /HorizonModern Warfare/i, /HorizonModernWarfare/i, 
	/Horizon ModernWarfare/i, /\bHMW\b/i, /\bApple\b/i, /Dreamboot/i, /Dream boot/i, /\bSX\b/i, /Sxuel/i, /Sxual/i, /Sxu3l/i, /5xu3l/i, /5xuel/i, /5xu4l/i, /5xual/i, /dre4m/i, /dr34m/i, /bo0th/i, /b0oth/i, /b0o7h/i, /bo07h/i, /b007h/i,
	/b00th/i, /booo/i, /b0oo/i, /bo0o/i, /boo0/i, /b000/i, /booo/i, /n000/i, /n00d/i, /no0d/i, /n0od/i, /\bNud\b/i, /\bdpnod\b/i, /\bdp nod\b/i,  /\bdp nood\b/i, /\bdp nod\b/i, /\bdep nod\b/i, /dpnod/i, /dpnood/i, /dpnud/i, /depnud/i, 
	/depnuud/i, /depenud/i, /depenuu/i, /dpepenud/i, /dpeepenud/i, /dpeepnud/i, /dpeependu/i, /dpeepndu/i, /Elayna/i, /Eleyna/i, /Eliyna/i, /Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elina WWE/i, /Elyna WWE/i, /Elyina/i, 
	/Aikusviihde/i, /Aikus viihde/i, /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i,
    ];

    // Function to check for terms in the URL and redirect
    const checkTermsAndRedirect = () => {
        for (let term of terms) {
            if (currentURL.includes(term.toLowerCase())) {
                console.log(`Term found in URL: ${term}. Redirecting to Wayback Machine front page.`);
                redirectToWayback();
                return true;
            }
        }
        return false;
    };

    // Function to check for regex patterns in the URL and redirect
    const checkRegexAndRedirect = () => {
        for (let regex of regexTerms) {
            if (regex.test(currentURL)) {
                console.log(`Regex pattern found in URL: ${regex}. Redirecting to Wayback Machine front page.`);
                redirectToWayback();
                return true;
            }
        }
        return false;
    };

    // Centralized redirect function
    const redirectToWayback = () => {
        try {
            window.stop(); // Stop loading the current page
            window.location.replace("https://web.archive.org/"); // Use replace instead of href
        } catch (e) {
            // Fallback if window.stop() fails
            window.location.href = "https://web.archive.org/";
        }
    };

    // Perform the checks and redirect immediately if necessary
    if (checkTermsAndRedirect()) return;
    if (checkRegexAndRedirect()) return;

    // Additional function to check for banned URLs with or without "www."
    const bannedURLs = ["blogspot.com", "blogger.com", "ask.fm", "reddit.com", "reddit.com/r/", "kuvake.net", "irc-galleria.net", "irc-galleria.fi", "irc.fi", "wondershare.com", "wondershare.net"];

    const isBannedURL = (url) => {
        for (let bannedURL of bannedURLs) {
            if (url.includes(bannedURL) || url.includes(`www.${bannedURL}`)) {
                return true;
            }
        }
        return false;
    };

    // Check for banned URLs and prevent loading if necessary
    if (isBannedURL(currentURL)) {
        console.log(`Banned URL detected: ${currentURL}. Preventing page load.`);
        redirectToWayback();
        return;
    }

    // Wait for DOM to be ready before checking content
    const waitForDOM = () => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initContentChecking);
        } else {
            initContentChecking();
        }
    };

    // Initialize content checking
    const initContentChecking = () => {
        // Selectors to check the page content for restricted words
        const selectors = [
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
            "input[aria-expanded='false']"
        ];

        // Function to check page content for restricted words
        const checkContentForRestrictedWords = () => {
            let redirected = false;

            for (let selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);

                    elements.forEach((element) => {
                        if (redirected) return;
                        
                        const content = element.value || element.textContent || element.innerText || "";
                        const lowerContent = content.toLowerCase();

                        // Check string terms
                        for (let term of terms) {
                            if (lowerContent.includes(term.toLowerCase())) {
                                console.log(`Get the fuck out of here with that! ${term} is banned for a reason. Redirecting you to Wayback Machine front page.`);
                                redirectToWayback();
                                redirected = true;
                                return;
                            }
                        }

                        // Check regex patterns
                        for (let regex of regexTerms) {
                            if (regex.test(content)) {
                                console.log(`Get the fuck out of here with that! ${regex} is banned for a reason. Redirecting you to Wayback Machine front page.`);
                                redirectToWayback();
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

            return redirected;
        };

        // Run once immediately
        checkContentForRestrictedWords();

        // Also listen for input events on form elements
        document.addEventListener('input', (e) => {
            if (e.target.matches('input, textarea')) {
                setTimeout(() => checkContentForRestrictedWords(), 100);
            }
        });

        // Run periodically in case elements load late
        let checkCount = 0;
        const maxChecks = 30; // Stop after 30 seconds
        
        const interval = setInterval(() => {
            checkCount++;
            if (checkContentForRestrictedWords() || checkCount >= maxChecks) {
                clearInterval(interval);
            }
        }, 1000);
    };

    // Start the content checking process
    waitForDOM();

})();