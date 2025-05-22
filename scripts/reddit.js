(function () {
    'use strict';

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

    // FULL ARRAYS/KEYWORDS
    const allowedUrls = [
        "https://www.reddit.com/user/birppis/"
    ];

    // --- SAFE SUBREDDITS ---
    const safeSubreddits = [
        "r/AmItheAsshole",
        "r/AmItheButtface",
        "r/AskReddit",
        "r/DimensionJumping",
        "r/BestofRedditorUpdates",
        "r/Glitch_in_the_Matrix"
    ];

    const keywordsToHide = [
        "NSFW", "18+", "porn", "sex", "nude", "penetration", "naked", "xxx", "rule34", "r34", "r_34", "rule 34", "ChatGPT", "get hard",
        "deepnude", "nudify", "nudifier", "nudifying", "nudity", "undress", "undressing", "undressifying", "undressify", "getdisciplined",
        "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley", "Cameron", "Hayter", "Britt Baker", "Ripley", "Rhea Ripley", "cum",
        "trans", "transvestite", "queer", "LGBT", "LGBTQ", "Pride", "Jessika Carr", "Carr WWE"," Jessica Carr", "Jessika Karr", "Jessika WWE",
        "prostitute", "escort", "fetish", "adult", "erotic", "explicit", "mature", "blowjob", "anal", "sexual", "Jessica WWE", "Jessica Karr",
        "vagina", "pussy", "tushy", "tushi", "genital", "vagena", "butt", "booty", "derriere", "busty", "cum", "slut", "Karr WWE", "CJ Lana", "dick", 
        "whore", "camgirl", "celeb", "cumslut", "Tiffany Stratton", "Lillian", "Garcia", "Jordynne", "Trish", "Stratus", "Lana Del Rey", "cock", "raped",
        "DeepSeek", "DeepSeek AI", "nudyi", "ai app", "onlyfans", "fantime", "fansly", "justforfans", "patreon", "CJ Perry", "Lana Perry", "penis",
        "manyvids", "chaturbate", "myfreecams", "cam4", "fat fetish", "camsoda", "stripchat", "bongacams", "livejasmin", "Lana WWE", "anus", "rape",
        "WWE woman", "WWE women", "WWE Xoxo", "Liv Xoxo", "Xoxo", "Chelsey", "Chelsea", "Niven", "Hardwell", "Indi", "Del Rey", "Del Ray", "sex", "breast",
        "amateur", "alexa", "bliss", "alexa bliss", "her ass", "she ass", "her's ass", "hers ass", "venice", "Alexa WWE", "5 feet of fury", "Morgan Xoxo",
        "Tiffany Stratton", "Tiffy time", "Stratton", "Tiffany", "Mandy Rose", "Chelsea Green", "Zelina Vega", "Valhalla", "poses", "posing", "vagene",
        "IYO SKY", "Io Shirai", "Iyo Shirai", "IO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Meiko Satomura", "playboy", "Dynamite", "jizz",
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Emma", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge", "jizzed",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina WWE", "Melina wrestler", "Jillian Hall", "five feet of fury", "Rampage", "raepd",
        "Mickie James", "Maria", "Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess", "Rampaige", "breasts",
        "Madison Rayne", "Velvet Sky", "Angelina Love", "ODB", "Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX", "Sweeney", "Brooke", "No nut",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", "Opera Browser", "nofap",
        "Willow Nightingale", "Kris Statlander", "Hikaru Shida", "Riho", "Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", "Fatal Influence", "Aubert", "*ape", 
        "Penelope Ford", "Shotzi", "Blackheart", "Tegan", "Nox", "Charlotte", "Charlotte Flair", "Sarray", "Xia Li", "OperaGX", "Sky Wrestling", "steph", "r*pe",
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Alicia", "Atout", "stephanie", "ra*e",
        "Stephanie", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Renee", "rap*",
        "Sunny", "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Izzi Dame", "Alba Fyre", "Isla Dawn", "Tamina", "Sydney",
        "Raquel Rodriguez", "B-Fab", "Scarlett Bordeaux", "Kayden Carter", "Katana Chance", "Lyra Valkyria", "Tamina Snuka", "Renee Young", "Sydney Sweeney",
        "Roxanne Perez", "Indi Hartwell", "Hartwell", "Blair", "Davenport", "Lola Vice", "Maxxine Dupri", "Karmen", "Karmen Petrovic", "Brittany", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum", "Paxley", "Fallon Henley", "Sky wrestle", "Women's", "Girl", "Women", "venoisi",
        "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa Leon", "Valentina Feroz", "Amari Miller", "Sky WWE", "Woman", "Lady", "Girls", "Girl's", "venoise",
        "Sol Ruca", "Arianna Grace", "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW", "Woman's", "Lady's", "Girl's", "Mandy", "org@$m", "0rga$m", "orga$m",
        "Mercedes", "Sasha", "Banks", "Russo", "Vince Russo", "Dave Meltzer", "Sportskeeda", "Liv Xoxo", "Roxanne", "orgasm", "0rgasm", "org@sm", "orga5m", "org@5m", "0rg@sm", "0rga5m", "0rg@5m", "0rg@$m", 
        "jerking", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "Join now", "a*al", "an*l", "*nal", "ana*", "s*x", "*ex", "se*", "Kristen Stewart", "Vladimir", "Putin",
        "Paxley", "NXT Women", "adult site", "cam4", "biscuit rear", "d3ep", "Sweeney", "Britt", "Mariah","puzzy", "editing app", "linq", "pussy", "tushy", "Roxanne", "Blies", "CJ Lana", "Melina WWE", "Satomura", "Statlander",
        "*uck", "f*ck", "fu*k", "fuc*", "f***", "f**k", "**ck", "fuc*k", "f*cked", "f*cker", "f**ked", "f**king", "fu**", "f**", "f****", "f*c*", "*cked", "f*cking", "f*cked", "f*cks", "f*ckup", "f**kery", "f*ckface", "f*ckwit", 
        "f*cktard", "f*cker", "f*ckery", "sh*t", "sh*tty", "*hit", "s**t", "sh**", "sh*tfaced", "sh*tbag", "s*cker", "b*tch", "b**ch", "b****", "b*itch", "*itch", "b*stard", "b**tard", "b*stardly", "b*st*rd", "b*st*rds", "b*lls", 
        "*lls", "b*llocks", "b*llsack", "a**", "a*shole", "*sshole", "as*hole", "assh*le", "as**hole", "a**hole", "a**wipe", "a*shat", "b*lls", "p*ssy", "c*nt", "c**t", "cu*t", "*unt", "c*nts", "c**ts", "cunt*","c*nts", "tw*t", 
        "tw**t", "t*at", "t**t", "p*ss", "p***", "p*ssed", "p*ssy", "t*rd", "t*rd", "rawdog", "rawdogging", "raw dogging", "raw dog", "d*ck", "d**k", "di*k", "d*ckhead", "d*ckbag", "d**kface", "sh*thead", "b*lls", "t*t", "*n**r", 
        "*n***r", "m*therf*cker", "m*therfucker", "*ss", "as****", "f*ckface", "f*cktard", "fukk", "fukc", "fu*c", "*ss", "a*s", "azz", "a*z", "az*", "***", "###", "@@", "#*", "*#", "@*", "*@", "#@", "@#", "sheer", "face replace", 
        "face merge", "face blend", "faceblend", "AI face", "neural", "AI morph", "face animation", "deep swap", "swap model", "photorealistic swap", "synthetic face", "hyperreal", "hyper real", "reface", "facereplace", 
        "facefusion", "face fusion", "face reconstruction", "AI face recreation", "virtual morph", "face synthesis", "neural face swap", "deep neural face", "AI-powered face swap", "face augmentation", "digital face synthesis", 
        "virtual face swap", "hyperreal AI face", "photo-real AI face", "face deepfake", "synthetic portrait generation", "AI image transformation", "face fusion technology", "deepface swap", "photo manipulation face", 
        "deepfak portrait", "machine learning", "generation", "generative", "AI model face swap", "face generation AI", "face replacement AI", "video face morphing", "3D face morph", "AI facial animation", "deepfake avatar", 
        "synthetic avatar creation", "facial", "AI model swap", "deep model swap", "image to face morph", "AI character face", "face remapping AI", "synthetic media", "AI-created character face", "face replacement tool", 
        "photo trans", "pict trans", "image trans", "virtual avatar face", "AI video face replacement", "digital face replacement", "hyperreal synthetic face", "AI face transformer", "face generation model", "realistic face", 
        "face blend", "virtual reality face", "face technology", "face tech", "3D morph face", "face AI animation", "real-time face swap", "AI-driven photo manipulation", "deepfake model creation", "digital persona",
        "face overlay", "synthetic person", "facial blending", "face swap", "virtual character face swap", "photorealistic face generator", "face altering AI", "realistic AI swap", "face expression morphing", "video gen",
        "face transformation AI", "virtual human face swap", "synthetic media generation", "3D face recreation", "AI-generated face animation", "neural network face replacement", "deepfake face morphing", "video generat", 
        "hyperreal", "face projection", "synthetic face swap", "face model", "virtual human face", "venice", "real-time deepfake", "photorealistic deepfake", "neural face transformation", "AI-generated face morph", "face render",
        "machine-generated face swap", "face image manipulation", "video face animation", "virtual morphing tool", "AI-powered video face swap", "digital face recreation", "AI-based facial replacement", "neural face",
        "machine learning face generator", "face recognition swap", "AI face animation tool", "synthetic media face", "AI character morphing", "deepfake avatar generation", "photoreal face synthesis", "synthetic face",
        "facial deep learning", "neural facial expression swap", "hyperrealistic face model", "AI-driven face fusion", "video face deepfake", "face pattern generation", "AI virtual persona swap", "deepface model trans",
        "nekkid", "nudee", "nudy", "noodz", "neude", "nudesz", "fan5ly", "fan-sly", "f4nslie", "f@nsly", "deep nuud", "deepnud", "deapnude", "d33pnud3", "f@n", "0nly", "0nlifans", "onlii", "onlifanz", "onnly", "n@ked", 
        "n4ked", "nakid", "nakd", "nakie", "s3x", "sx", "secks", "seggs", "seks", "Erase clothes", "AI uncloth", "Unclothing AI", "Gen AI pics", "text-to-undress", "text2nude", "remove outfit", "undress filter", "persona creation",
        "stripfilter", "clothing eraser", "nudify tool", "leak editor", "Realistic nude gen", "fleshify", "Skinify", "Alex Kaufman", "Lexi Kaufman", "Lexi Bliss", "Tenille Dashwood", "Saraya Knight", "Paige WWE",
        "Celeste Bonin", "Ariane Andrew", "Brianna Monique Garcia", "Stephanie Nicole Garcia", "CJ Perry", "Lana Rusev", "Pamela Martinez", "Ashley Sebera", "Ayesha Raymond", "Marti Belle", "Alisha Edwards", "image2video",
        "Nicol", "Garcia", "Nikki Garcia", "Wrestling babe", "Divas hot", "WWE sexy", "spicy site", "for fans", "VIP pic", "premium content", "sussy pic", "after dark", "NSFL", "artistic nude", "tasteful nude", "sus site",
        "uncensored version", "alt site", "runwayml", "runway", "run way", "runaway", "run away",  "replicate.ai", "huggingface", "hugging face", "cloth remover", "AI eraser", "Magic Editor", "magicstudio", "cleanup.pictures", 
        "app123", "modapk", "apkmod", "tool hub", "tools hub", "alaston", "alasti", "vaatteeton", "paljas", "seksikäs", "pimppi", "vittu", "tissit", "nänni", "sukupuolielin", "paljain", "seksisivu", "alastomuus", "sus content",
        "aikuissisältö", "aikuissivusto", "seksikuva", "homo", "lesbo", "transu", "pervo", "🍑", "🍆", "💦", "👅", "🔞", "😈", "👙", "🩲", "👠", "🧼", "🧽", "( . )( . )", "| |", "( o )( o )", "(!)", "bg remover", "face+", "face +",
        "dick", "cock", "penis", "breast", "thigh", "leggings", "leggins", "venoice", "veniice", "jeans", "jerking", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "imgtovid", "img2vid", "imagetovideo", 
        "her butt", "herbutt", "butth", "butt hole", "assh", "ass h", "buttc", "butt c", "buttcheek", "butt cheek", "ladies", "lady", "runway", "runaway", "run way", "run away", "cheek", "aasho", "ääsho", "ääshö", "face join",
        "poistamis", "vaatteidenpoistaminen", "vaatteiden poistaminen", "facemerg", "facefusi", "face merg", "face fusi", "face plus", "faceplus", "merge two faces", "merge 2 faces", "merging 2 faces", "merging two faces", "join face",
        "join two faces", "join 2 faces", "join2faces", "jointwofaces", "fotor", "Toni WWE", "Tony Storm", "off the Sky", "off da skai", "Priscilla", "Kelly", "Erika", "Vikman", "pakara", "pakarat", "Viikman", "Eerika", 
        "puss*", "p*ssy", "pu*sy", "pus*y", "an*l", "s*x", "s**", "veeniic", "veenice", "**x", "se*", "*ex", "*uck", "s*ck", "d*ck", "c*ck", "f*ck", "fu*k", "fuc*", "*nal", "a*al", "ana*", "*ss", "a*s", "as*", "su*k", "di*k", "co*k", "suc*", 
        "*wat", "t*at", "tw*t", "twa*", "*unt", "c*nt", "cu*t", "cun*", "*orn", "p*rn", "po*n", "por*", "*eep", "d*ep", "de*p", "dee*", "*ude", "n*de", "nu*e", "nud*", "*udi", "n*di", "nu*i", "n**e", "n**i", "nu**", "n**e", "dic*", "coc*",
        "*aked", "n*ked", "na*ed", "nak*d", "nake*", "**ked", "n**ed", "na**d", "nak**", "**aked", "n**aked", "n*aked", "d!ck", "d1ck", "dlck", "na**ked", "nak**ed", "nake**d", "*kin", "s*in", "sk*n", "ski*", "*lesh", "f*esh", "fl*sh",
        "fle*h", "fles*"
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
        /\bFAP\b/i, /fapping/i, /wanking/i, /venice/i, /masturbating/i, /masturbation/i, /masturboida/i, /masturbaatio/i, /masturboin/i, /runkata/i, /runkkaus/i, /runkkaaminen/i, /runkku/i, /masturbointi/i, /jerking/i,
        /Stratusfaction/i, /yhdynnässä/i, /seksikuva/i, /seksivideo/i, /seksi kuvia/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i, /panokuva/i, /pano kuva/i, /pano kuvia/i, /panokuvia/i,
        /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpittäminen/i, /sormetus/i, /sormitus/i, /sormitta/i, /sormetta/i,
        /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkkyvid/i, /aikuisviihde/i, /fisting/i, /fistaus/i,
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuissisältö/i, /aikuissivusto/i, /seksikuva/i, /homo/i, /lesbo/i, /transu/i, /pervo/i, /🍑/i, /🍆/i, /💦/i, /👅/i, /🔞/i, /😈/i, /👙/i, /🩲/i, /👠/i, /🧼/i, /🧽/i, /\(\.\s*\)\(\.\s*\)/i, 
	/\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /bg remover/i, /face\+/i, /face \+/i, /fles*/i
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
        "community-highlight-carousel shreddit-gallery-carousel"
    ];

    // --- SAFE SUBREDDIT LOGIC ---
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
        element.remove();
    }

    function getSubredditForAnyRedditPost(el) {
        let attr = el.getAttribute && el.getAttribute('subreddit-prefixed-name');
        if (attr) return attr.startsWith('r/') ? attr : 'r/' + attr;
        let attr2 = el.getAttribute && el.getAttribute('subreddit-name');
        if (attr2) return 'r/' + attr2;
        let attr3 = el.getAttribute && el.getAttribute('data-subreddit');
        if (attr3) return attr3.startsWith('r/') ? attr3 : 'r/' + attr3;
        let a = el.querySelector && el.querySelector('a[data-testid="subreddit-name"]');
        if (a && a.textContent) return a.textContent.trim();
        let a2 = el.querySelector && el.querySelector('a[href^="/r/"]');
        if (a2 && a2.textContent) return a2.textContent.trim();
        let aTags = el.querySelectorAll && el.querySelectorAll('a[href*="/r/"]');
        if (aTags) {
            for (const a3 of aTags) {
                const href = a3.getAttribute('href');
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
        return adultSubreddits.some(asub => sub.toLowerCase() === asub.toLowerCase());
    }

    function filterAdultSubredditPostsAndComments() {
        const posts = document.querySelectorAll('article, shreddit-post, [subreddit-prefixed-name]');
        posts.forEach(post => {
            if (isElementFromAdultSubreddit(post)) {
                post.classList.add('prehide');
                removeElementAndRelated(post);
            } else {
                post.classList.remove('prehide');
            }
        });
        const comments = document.querySelectorAll('.Comment');
        comments.forEach(comment => {
            if (isElementFromAdultSubreddit(comment)) {
                comment.classList.add('prehide');
                removeElementAndRelated(comment);
            } else {
                comment.classList.remove('prehide');
            }
        });
    }

    // --- All your other functions, unchanged, follow here ---
    // (hideJoinNowPosts, getSubredditFromPost, hideSubredditPosts, checkContentForKeywords, etc.)

    function checkContentForSubreddits(content) {
        const contentText = content.textContent ? content.textContent.toLowerCase() : '';
        return adultSubreddits.some(subreddit =>
            contentText.includes(subreddit.toLowerCase())
        );
    }

    function hideJoinNowPosts() {
        const posts = document.querySelectorAll('article, shreddit-post');
        posts.forEach(post => {
            let joinNowFound = false;
            const joinNowSelectors = [
                '#t3_1kklihk > div.flex.gap-2xs.items-center.justify-between.min-h-\\[32px\\].mt-xs',
                'button'
            ];
            joinNowSelectors.forEach(selector => {
                const elements = post.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el.textContent && el.textContent.trim().toLowerCase() === 'join now') {
                        joinNowFound = true;
                    }
                });
            });
            const btns = post.querySelectorAll('button, a');
            btns.forEach(el => {
                if (el.textContent && el.textContent.trim().toLowerCase() === 'join now') {
                    joinNowFound = true;
                }
            });
            if (joinNowFound) {
                removeElementAndRelated(post);
            }
        });
    }

    function getSubredditFromPost(post) {
        let sub = post.getAttribute && post.getAttribute('data-subreddit');
        if (sub) return sub.startsWith('r/') ? sub : 'r/' + sub;
        let aTags = post.querySelectorAll && post.querySelectorAll('a[href*="/r/"]');
        if (aTags) {
            for (let a of aTags) {
                let match = a.getAttribute('href').match(/\/r\/([A-Za-z0-9_]+)/);
                if (match) return 'r/' + match[1];
            }
        }
        let aria = post.getAttribute && post.getAttribute('aria-label');
        if (aria) {
            let match = aria.match(/\/r\/([A-Za-z0-9_]+)/);
            if (match) return 'r/' + match[1];
        }
        let spans = post.querySelectorAll && post.querySelectorAll('span, div');
        if (spans) {
            for (let s of spans) {
                if (s.textContent) {
                    let txt = s.textContent.trim();
                    if (txt.startsWith('r/')) {
                        let check = txt.split(' ')[0];
                        if (check.length > 3 && check.length < 40) return check;
                    }
                }
            }
        }
        let allAs = post.getElementsByTagName && post.getElementsByTagName('a');
        if (allAs) {
            for (let a of allAs) {
                if (a.textContent && a.textContent.trim().startsWith('r/')) {
                    return a.textContent.trim();
                }
            }
        }
        return null;
    }

    function hideSubredditPosts() {
        const posts = document.querySelectorAll('article');
        posts.forEach(post => {
            let foundSubreddit = getSubredditFromPost(post);
            if (foundSubreddit) {
                for (const sub of adultSubreddits) {
                    if (foundSubreddit.toLowerCase() === sub.toLowerCase()) {
                        removeElementAndRelated(post);
                        return;
                    }
                }
            }
        });
    }

    function checkContentForKeywords(content) {
        const contentText = content.textContent ? content.textContent.toLowerCase() : '';
        const exactMatch = keywordsToHide.some(keyword =>
            contentText.includes(keyword.toLowerCase())
        );
        if (exactMatch) return true;
        return regexKeywordsToHide.some(pattern =>
            pattern.test(contentText)
        );
    }

    function hideKeywordPosts() {
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
    }

    function checkForAdultContentTag() {
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    function interceptSearchInputChanges() {
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
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
            });
        }
    }

    function interceptSearchFormSubmit() {
        const searchForm = document.querySelector('form[action="/search"]');
        if (searchForm) {
            searchForm.addEventListener('submit', (event) => {
                const searchParams = new URLSearchParams(new FormData(searchForm));
                const query = (searchParams.get('q') || '').toLowerCase();
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
        }
    }

    function checkUrlForKeywordsToHide() {
        if (isSafeSubredditUrl()) return;
        const currentUrl = window.location.href.toLowerCase();
        const exactMatch = keywordsToHide.some(keyword =>
            currentUrl.includes(keyword.toLowerCase())
        );
        const regexMatch = regexKeywordsToHide.some(pattern =>
            pattern.test(currentUrl)
        );
        if ((exactMatch || regexMatch) && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    function clearRecentPages() {
        const recentPagesStore = localStorage.getItem('recent-subreddits-store');
        if (recentPagesStore) {
            const recentPages = JSON.parse(recentPagesStore);
            const filteredPages = recentPages.filter(page => {
                if (typeof page !== 'string') return true;
                const exactMatch = keywordsToHide.some(keyword =>
                    page.toLowerCase().includes(keyword.toLowerCase())
                );
                const regexMatch = regexKeywordsToHide.some(pattern =>
                    pattern.test(page.toLowerCase())
                );
                const subredditMatch = adultSubreddits.some(subreddit =>
                    page.toLowerCase().includes(subreddit.toLowerCase())
                );
                return !exactMatch && !regexMatch && !subredditMatch;
            });

            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
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
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
            });
        });
        localStorage.setItem('recent-subreddits-store', '[]');
    }

    function checkAndHideNSFWClassElements() {
        const nsfwClasses = ['NSFW', 'nsfw-tag', 'nsfw-content'];
        nsfwClasses.forEach(className => {
            const elements = document.querySelectorAll(`.${className}`);
            elements.forEach(element => {
                removeElementAndRelated(element);
            });
        });
    }

    function removeHrElements() {
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        hrElements.forEach((element) => {
            element.remove();
        });
    }

    function removeSelectorsToDelete() {
        selectorsToDelete.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                removeElementAndRelated(element);
            });
        });
    }

    function runAllChecks() {
        // Always hide adult subreddit posts/comments
        filterAdultSubredditPostsAndComments();

        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            hideSubredditPosts();
            hideKeywordPosts();
            checkForAdultContentTag();
            checkUrlForKeywordsToHide();
            clearRecentPages();
            hideRecentCommunitiesSection();
        }
    }

    function init() {
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
            hideRecentCommunitiesSection();
        }, 100);
    }

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