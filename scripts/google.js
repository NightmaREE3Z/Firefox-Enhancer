(function () {
    'use strict';

    // Function to redirect all Google searches to google.com
    const redirectToGoogleDotCom = () => {
        const currentHostname = window.location.hostname;
        const googleDomainPattern = /^.*\.google\.[a-z]{2,}$/; // Match any Google domain
        const searchParams = new URLSearchParams(window.location.search);
        const query = searchParams.get('q'); // Get the search query

        // If the current hostname is a Google domain (but not 'www.google.com') and there's a search query
        if (googleDomainPattern.test(currentHostname) && currentHostname !== 'www.google.com') {
            if (query) {
                console.log(`Redirecting search for '${query}' from ${currentHostname} to www.google.com`);
                window.location.replace(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
            } else {
                // If there's no search query, redirect to the Google homepage
                console.log(`Redirecting from ${currentHostname} to www.google.com`);
                window.location.replace('https://www.google.com');
            }
        }
    };

    // Call the redirection logic immediately
    redirectToGoogleDotCom();

    // Function to enforce SafeSearch by setting the necessary cookies
    const enforceSafeSearch = () => {
        document.cookie = "PREF=f2=8000000; domain=.google.com; path=/; secure";
    };

    // List of regex keywords and phrases to hide (case-insensitive)
    const regexKeywordsToHide = [
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
        /pillu/i, /perse/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /Peba/i, /Beba/i, /Bepa/i, /Babe/i, /baby/i, /\bAnaali\b/i, /\bSeksi\b/i, /picture app/i, /edit app/i, /pic app/i, /photo app/i, /syvavaarennos/i, /Perry WWE/i,
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen|poistamis)[ -]?(?:vaatteet|vaatteiden)/i, /\bAnus\b/i, /sexuaali/i, /\bAnal\b/i, 
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i, /sexual/i, /seksuaali/i, /play boy/i, /yhdyntä/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /seksuaalisuus/i, /synthetic model/i,
        /Margot/i, /Robbie/i, /Ana de Armas/i, /soulgen/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Generated/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i, /artificial model/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /enhanced image/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /erotiikka/i, /läpinäkyvä/i, /Trish/i,
        /vaatepoisto/i, /poista vaatteet/i, /vaatteiden poisto/i, /tekoäly/i, /panee/i, /panevat/i, /paneminen/i, /panemis/i, /paneskelu/i, /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimista/i, /uncover/i, /exclusive leak/i,
        /Stratusfaction/i, /yhdynnässä/i, /seksikuva/i, /seksivideo/i, /seksi kuvia/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i, /panokuva/i, /pano kuva/i, /pano kuvia/i, /panokuvia/i, /banned app/i,
	/masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpittäminen/i, /sormetus/i, /sormitus/i, /sormitta/i, /sormetta/i,
	/sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkkyvid/i, /aikuisviihde/i, /fisting/i, /fistaus/i,
	/sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuis sisältö/i, /aikuiskontsa/i, /aikuiskontentti/i, /aikuis kontentti/i, /aikuiscontentti/i, /aikuis contentti/i, /pleasi/i, /pleasu/i, /herself/i, /her self/i, /bg remov/i, 
	/\bRembg\b/i, /\bRem bg\b/i, /\bDel bg\b/i, /\bDelbg\b/i, /delet bg/i, /eras bg/i, /delet bg/i, /erase bg/i, /erasing bg/i, /bg delet/i, /bg erasing/i, /bg erase/i, /Blend face/, /Blendface/, /morphi/, /Blender face/, /5yvä/i,
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
	/erotii/i, /erooti/i, /erootii/i, /\bkuvake\b/i, /kuvakenet/i, /kuvake.net/i, /toniwwe/i, /tonywwe/i,
    ];


    // List of string keywords to hide (case-insensitive)
    const stringKeywordsToHide = [
        "Bliss", "Tiffany", "Tiffy", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Tegan Nox", "Charlotte Flair", "Becky Lynch", "Michin", "Mia Yim", "WWE Woman", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven",
        "Alba Fyre", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Jordynne", "WWE Women", "WWE Women's", "WWE Divas", "WWE Diva", "Maryse", "Samantha", "Irwin WWE", "Irvin WWE", "Irvin AEW",
        "Irwin AEW", "Candice LeRae", "Nia Jax", "Naomi", "Bianca Belair", "Charlotte", "Flair", "Trish", "Stratus", "MSEdge", "Izzi Dame", "Izzi WWE", "Dame WWE", "play boy", "Young Bucks", "Jackson", "NXT Women's", "AI app",
        "NXT Woman", "Jessika Carr", "Carr WWE", "Jessica Carr", "Jessika Karr", "Karr WWE", "poses", "posing", "Lash Legend", "Jordynne Grace", "Isla Dawn", "editation", "Raquel Rodriguez", "DeepSeek", "Jessika WWE",
        "Jessica WWE", "Jessica Karr", "WWE Dame", "WWE Izzi", "playboy", "deepnude", "undress", "nudify", "nude app", "nudifier", "faceswap", "facemorph", "morph face", "swapface", "Bliss", "Nikki", "Brie", "Opera Browser",
        "TOR Browser", "TOR-Browser", "TOR-selain", "TOR selain", "nudecrawler", "tarkoititko", "AI edit", "AI edited", "browser", "selain", "Brave-selainta", "Brave-selaimen", "Undress AI", "DeepNude AI", "editing", "Skye Blue",
        "tarkoitiitko: nudify", "undress-app", "deepnude-app", "nudify-app", "Lola Vice", "Vice WWE", "Opera GX", "Sasha Banks", "-selainta", "selaimen", "-selaimen", "Lola WWE", "Alexis", "crotch", "WWE Xoxo", "Morgan Xoxo",
        "pusy", "pics edit", "pic edit", "pusi", "fappening", "naked", "n8ked", "n8k3d", "nak3d", "nud3", "Tiffy", "Safari", "vaatteiden poisto", "dreamtime", "dreamtime app", "mature content", "mature site", "adult content",
        "mature content", "mature site", "adult content", "adult site", "inpaint", "photopea", "fotopea", "Steward", "edit app", "picture edit", "Tiffy Time", "picresize", "lunapic", "pixelixe", "gay", "1fy", "!fy", "lfy",
        "de3p", "OperaGX", "Perez", "photo edit", "d33p", "3ip", "without", "cameltoe", "dreamtime AI", "Joanie", "cleavage", "fuck", "rule34", "r34", "r_34", "Rule 34", "image edit", "Rul", "Rul34", "Rul 34", "pic app",
        "Stewart", "Perze", "Stratton", "Ruca", "Frost AI", "Laurer", "AI Frost", "frost.com", "onlyfans", "only fans", "fantime", "fan time", "okfans", "ifans", "ifan", "Loyalfans", "Loyalfan", "Fansly", "JustForFans",
        "ok fans", "Just for fans", "i fans", "Loyal fans", "Fan sly", "fans only", "Jaida WWE", "fan only", "Fan loyal", "Fans loyal", "biscuit booty", "editor app", "Trans", "Kristen", "MS Edge", "Transvestite", "linger",
        "Baker", "Biscuit Butt", "Birppis", "Birpppis", "deviant art", "upscale", "upscaling", "Bella", "sex", "facetune", "face tune", "tuning face", "face tuning", "facetuning", "tuningface", "biscuit ass", "Chyna",
        "bikini", "Kristen Stewart", "biscuit backside","Sydney Sweeney", "Britt Baker", "Deepseek", "shag", "shagged", "fake", "cloth", "Blis", "LGBTQ", "pant", "fat fetish", "Object", "adultcontent", "F4NS", "Carmella",
        "nsfw", "18+", "18 plus", "porn", "penetration", "xxx", "nudifier", "nudifying", "nudity", "Jaida Parker", "F4N5", "undressing", "undressifying", "generative", "undressify", "Goddess", "Perry WWE", "Toni Storm",
        "FAN5", "Harley", "Cameron", "Merlio", "Hayter", "Ripley", "Rhea Ripley", "Microsoft Edge", "askfm", "ask fm", "CJ WWE", "queer", "Pride", "prostitute", "escort", "fetish", "v1ds", "m4ny", "v1d5", "erotic", "LGBT",
        "blowjob", "Sportskeeda", "whoring", "AI Tool", "aitool", "vagina", "genital", "booty", "nudyi", "Nudying", "Nudeying", "derriere", "busty", "slut", "whore", "whoring", "camgirl", "cumslut", "fury foot", "fury feet",
        "DeepSeek", "DeepSeek AI", "fansly", "patreon", "manyvids", "chaturbate", "myfreecams", "Samsung Internet", "Policy template", "Templates", "Policies", "onlifans", "camsoda", "stripchat", "bongacams", "livejasmin",
        "Shirai", "Io Sky", "Sky WWE", "Sky Wrestling", "Sky wrestle", "foot fury", "feet fury", "Bleis", "WWE woman", "WWE women", "amateur", "5 feet of fury", "five feet of fury", "Velvet Sky", "onl1", "celeb", "0nl1",
        "Diipfeikki", "Lana Perry", "Vince Russo", "Russo", "Goddess WWE", "Mandy Rose", "Chelsea Green", "Zelina Vega", "Valhalla", "IYO SKY", "Io Shirai", "Iyo Shirai", "Dakota Kai", "Asuka", "Kairi Sane", "jaida", "0nli",
        "Miko Satomura", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey", "Dana Brooke", "Aubrey", "Edwards", "Alicia", "Atout", "Tamina", "Alicia Fox", "Summer Rae", "Layla", "Michelle McCool", "Eve Torres", "Jaida",
        "Kelly Kelly", "Kelly2", "Kelly 2", "Melina WWE", "Brittany", "Aubert", "Renee Paquette", "Parker WWE", "Melina wrestler", "Jillian Hall", "Mickie James", "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly",
        "Jazz", "Lana Del Rey", "Gail Kim", "Awesome Kong", "Madison Rayne", "Velvet Sky", "Angelina Love", "Brooke", "Tessmacher", "Havok", "Renee", "Britany", "Britanny", "Del Ray", "Su Yung", "Taya Valkyrie", "Deonna Purrazzo",
        "Anna Jay", "Tay Conti", "Britany", "Britanny", "Del Ray", "Su Yung", "Taya Valkyrie", "Deonna Purrazzo", "Saraya", "Anna Jay", "Tay Conti", "Tay Melo", "Willow Nightingale", "Noelle", "Syväväärennös", "Del Rey", "Lexi",
        "Hikaru Shida", "Thea Hail", "Yuka Sakazaki", "Nyla Rose", "Emi Sakura", "Penelope Ford", "Shotzi", "Miia Yim", "Miia Yam", "CJ Perry", "deviantart", "Charlotte", "Mickie", "Micky", "Carolina", "Caroline", "Charlotte Flair",
        "Blackheart", "Tegan", "Becky", "Lynch", "Bailey", "Giulia", "Mia Yam", "Michin", "Mia Yim", "AJ Lee", "Paige", "Stephanie", "Liv Morgan", "Piper Niven", "Bayley", "Jaida", "Jaidi", "NXT Womens", "NXT Women", "NXT Woman",
        "Jordynne Grace", "Jordynne", "Uhkapeli", "Uhka peli", "Sunny", "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Uhkapelaaminen", "J41D4", "Ja1d4", "Lana WWE", "Scarlett Bordeaux", "Kayden Carter",
        "J41da", "Alba Fyre", "Isla Dawn", "Raquel Rodriguez", "B-Fab", "Uhka pelaaminen", "Jaid4", "J4ida", "Lyra Valkyria", "Indi Hartwell", "Blair Davenport", "Maxxine Dupri", "Dave Meltzer", "Natalya", "Nattie", "Electra Lopez",
        "Valentina Feroz", "Amari Miller", "Sol Ruca", "Yulisa Leon", "Arianna Grace", "Young Bucks", "Matt Jackson", "Nick Jackson", "Karmen Petrovic", "Ava Raine", "Cora Jade", "Gamble", "Feikki", "Jacy Jayne", "Gigi Dolin",
        "Tatum WWE", "dress", "Fallon Henley", "Kelani Jordan", "explicit", "AEW", "justforfans", "Katana Chance", "Mercedes", "Gambling", "mature content", "Flair", "Saraya", "Renee Young", "anaaliseksi", "Sasha", "Wendy Choo",
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
	"face blend", "virtual reality face", "face technology", "3D morph face", "face AI animation", "real-time face swap", "AI-driven photo manipulation", "deepfake model creation", "digital persona", "persona creation",
	"face overlay", "synthetic person", "facial blending", "face swap", "virtual character face swap", "photorealistic face generator", "face altering AI", "realistic AI swap", "face expression morphing", "video gen",
	"face transformation AI", "virtual human face swap", "synthetic media generation", "3D face recreation", "AI-generated face animation", "neural network face replacement", "deepfake face morphing", "video generat", 
	"hyperreal", "face projection", "synthetic face swap", "face model", "virtual human face", "real-time deepfake", "photorealistic deepfake", "neural face transformation", "AI-generated face morph", "face render",
	"machine-generated face swap", "face image manipulation", "video face animation", "virtual morphing tool", "AI-powered video face swap", "digital face recreation", "AI-based facial replacement", "neural face",
    	"machine learning face generator", "face recognition swap", "AI face animation tool", "synthetic media face", "AI character morphing", "deepfake avatar generation", "photoreal face synthesis", "synthetic face",
	"facial deep learning", "neural facial expression swap", "hyperrealistic face model", "AI-driven face fusion", "video face deepfake", "face pattern generation", "AI virtual persona swap", "deepface model trans",
	"nekkid", "nudee", "nudy", "noodz", "neude", "nudesz", "fan5ly", "fan-sly", "f4nslie", "f@nsly", "deep nuud", "deepnud", "deapnude", "d33pnud3", "f@n", "0nly", "0nlifans", "onlii", "onlifanz", "onnly", "n@ked", 
	"n4ked", "nakid", "nakd", "nakie", "s3x", "sx", "secks", "seggs", "seks", "Erase clothes", "AI uncloth", "Unclothing AI", "Gen AI pics", "text-to-undress", "text2nude", "remove outfit", "undress filter",
	"stripfilter", "clothing eraser", "nudify tool", "leak editor", "Realistic nude gen", "fleshify", "Skinify", "Alex Kaufman", "Lexi Kaufman", "Lexi Bliss", "Tenille Dashwood", "Saraya Knight", "Paige WWE", 
	"Celeste Bonin", "Ariane Andrew", "Brianna Monique Garcia", "Stephanie Nicole Garcia", "CJ Perry", "Lana Rusev", "Pamela Martinez", "Ashley Sebera", "Ayesha Raymond", "Marti Belle", "Alisha Edwards", "image2video",
	"Nicole Garcia", "Nikki Garcia", "Wrestling babe", "Divas hot", "WWE sexy", "spicy site", "for fans", "VIP pic", "premium content", "sussy pic", "after dark", "NSFL", "artistic nude", "tasteful nude", "sus site",
	"uncensored version", "alt site", "runwayml", "runway", "run way", "runaway", "run away",  "replicate.ai", "huggingface", "hugging face", "cloth remover", "AI eraser", "Magic Editor", "magicstudio", "cleanup.pictures", 
	"app123", "modapk", "apkmod", "tool hub", "tools hub", "alaston", "alasti", "vaatteeton", "paljas", "seksikäs", "pimppi", "vittu", "tissit", "nänni", "sukupuolielin", "paljain", "seksisivu", "alastomuus", "sus content",
	"aikuissisältö", "aikuissivusto", "seksikuva", "homo", "lesbo", "transu", "pervo", "🍑", "🍆", "💦", "👅", "🔞", "😈", "👙", "🩲", "👠", "🧼", "🧽", "( . )( . )", "| |", "( o )( o )", "(!)", "bg remover", "face+", "face +",
	"dick", "cock", "penis", "breast", "thigh", "leggings", "leggins", "jeans", "jerking", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "imgtovid", "img2vid", "imagetovideo", "join face",
	"her butt", "herbutt", "butth", "butt hole", "assh", "ass h", "buttc", "butt c", "buttcheek", "butt cheek", "ladies", "lady", "runway", "runaway", "run way", "run away", "cheek", "aasho", "ääsho", "ääshö", "face join",
	"poistamis", "vaatteidenpoistaminen", "vaatteiden poistaminen", "facemerg", "facefusi", "face merg", "face fusi", "face plus", "faceplus", "merge two faces", "merge 2 faces", "merging 2 faces", "merging two faces", 
	"join two faces", "join 2 faces", "join2faces", "jointwofaces", "fotor", "Toni WWE", "Tony Storm", "off the Sky", "off da skai", "Priscilla", "Kelly", "Erika", "Vikman", "pakara", "pakarat", "Viikman", "Eerika", 
    ];

    // List of allowed words that should not be hidden
    const allowedWords = [
        /reddit/i, /OSRS/i, /RS/i, /RS3/i, /Old School/i, /RuneScape/i, /netflix/i, /pushpull/i, /facebook/i, /FB/i, /instagram/i, /Wiki/i, /pedia/i, /hikipedia/i, /fandom/i, /lehti/i, /tiktok/i, /bond/i, /bonds/i, /2007scape/i,
        /youtube/i, /ublock/i, /wrestling/i, /wrestler/i, /tori/i, /tori.fi/i, /www.tori.fi/i, /Kirpputori/i, /käytetty/i, /käytetyt/i, /käytettynä/i, /proshop/i, /hinta/i, /hintavertailu/i, /hintaopas/i, /sähkö/i, /pörssi/i,
        /sähkösopimus/i, /vattenfall/i, /elenia/i, /kulutus/i, /sähkön/i, /sähkönkulutus/i, /bing/i, /duckduckgo/i, /old/i, /new/i, /veikkaus/i, /lotto/i, /jokeri/i, /jääkiekko/i, /viikinkilotto/i, /perho/i, /vakuutus/i, /kela/i,
        /sosiaalitoimisto/i, /sossu/i, /OP/i, /Osuuspankki/i, /Osuuspankin/i, /Artikkeli/i, /jalkapallo/i, /sanomat/i, /sanoma/i, /päivän sana/i, /jumala/i, /jeesus/i, /jesus/i, /christ/i, /kristus/i, /vapahtaja/i, /messias/i,
        /pääsiäinen/i, /joulu/i, /uusivuosi/i, /jumala/i, /jeesus/i, /jesus/i, /christ/i, /kristus/i, /vapahtaja/i, /messias/i, /pääsiäinen/i, /joulu/i, /uusivuosi/i, /vuosi/i, /uusi/i, /uuden/i, /vuoden/i, /raketti/i, /raketit/i,
        /sipsit/i, /dippi/i, /dipit/i, /Monster/i, /Energy/i, /Lewis Hamilton/i, /LH44/i, /LH-44/i, /Greenzero/i, /Green/i, /Zero/i, /blue/i, /white/i, /red/i, /yellow/i, /brown/i, /cyan/i, /black/i, /Tie/i, /katu/i, /opas/i,
        /google/i, /maps/i, /earth/i, /Psykologi/i, /psyka/i, /USB/i, /kotiteatteri/i, /vahvistin/i, /Onkyo/i, /Sony/i, /TX/i, /Thx/i, /SR393/i, /Suprim/i, /Strix/i, /TUF/i, /Gaming/i, /Prime/i, /Matrix/i, /Astral/i, /MSI/i,
        /Vanguard/i, /Center/i, /Speaker/i, /Samsung/i, /Asus/i, /PNY/i, /AsRock/i, /XFX/i, /Sapphire/i, /PowerColor/i, /emolevy/i, /emo levy/i, /live/i, /näytönohjain/i, /näytön/i, /ohjain/i, /xbox/i, /playstation/i, /Dual/i,
        /pleikkari/i, /Series/i, /PS1/i, /PS2/i, /PS3/i, /PS4/i, /PS5/i, /PS6/i, /One/i, /Telsu/i, /Televisio/i, /Telvisio/i, /Ohjelma/i, /Ohjelmat/i, /Ajurit/i, /Lenovo/i, /Compaq/i, /Acer/i, /HP/i, /Hewlet Packard/i, /Ventus/i,
        /Duel/i, /OC/i, /Overclocked/i, /Overclockers/i, /bass/i, /bas/i, /AMD/i, /NVidia/i, /Intel/i, /Ryzen/i, /Core/i, /GeForce/i, /Radeon/i, /0TI/i, /0X/i, /50/i, /60/i, /70/i, /80/i, /90/i, /RX/i, /GTA/i, /GTX/i, /RTX/i, /PC/i,
        /Battlefield/i, /BF/i, /driver/i, /sub/i, /WWE/i, /wrestle/i, /Raw/i, /SmackDown/i, /SSD/i, /HDD/i, /Disk/i, /disc/i, /cable/i, /microsoft/i, /drivers/i, /chipset/i, /mobo/i, /motherboard/i, /mother/i, /GPU/i, /CPU/i, /Ucey/i,
        /Graphics Card/i, /paint.net/i, /paintdotnet/i, /paintnet/i, /paint net/i, /github/i, /hub/i, /git/i, /Processor/i, /Chip/i, /R9/i, /R7/i, /R5/i, /i9/i, /i7/i, /i5/i, /subwoofer/i, /sound/i, /spotify/i, /spicetify/i, /IG/i,
        /home theater/i, /receiver/i, /giver/i, /taker/i, /ChatGPT/i, /Chat GPT/i, /Uce/i, /DLSS/i, /FSR/i, /NIS/i, /profile/i, /inspect/i, /inspector/i, /vaihd/i, /vaihe/i, /vaiht/i, /ai/i, /jako/i, /jakopäähihna/i, /hihna/i, /pää/i,
        /auto/i, /pankki/i, /moto/i, /toyota/i, /opel/i, /mitsubishi/i, /galant/i, /osa/i, /vara/i, /raha/i, /ooppeli/i, /HDMI/i, /Edge WWE/i, /vaihdetaan/i, /vaihdan/i, /vaihto/i, /vaihtoi/i, /vaihdossa/i, /vaihtaa/i, /paa/i,
        /jakopää hihna/i, /jako hihna/i, /jako pää hihna/i, /jako päähihna/i, /\?/i, /\!/i, /opas/i, /ohje/i, /manuaali/i, /käyttö/i, /history/i, /historia/i, /search/i, /haku/i, /classic/i, /klassikko/i, /klassik/i, /south park/i,
        /siivoton juttu/i, /pasila/i, /jakohihna/i, /poliisin poika/i, /poliisi/i, /poika/i, /Ravage/i, /Savage/i, /volksvagen/i, /konsoli/i, /console/i, /Sega/i, /Nintendo/i, /PlayStation/i, /Xbox/i, /Game/i, /Terapia/i, /Therapy/i,
        /Masennus/i, /Depression/i, /Psykiatri/i, /Striimi/i, /Stream/i, /antenni/i, /verkko/i, /digibox/i, /hamppari/i, /hampurilainen/i, /ranskalaiset/i, /peruna/i, /automaatti/i, /automaatin/i, /autismi/i, /autisti/i, /ADHD/i,
        /asperger/i, /kebab/i, /ravintola/i, /ruokala/i, /pikaruoka/i, /suomi/i, /finnish/i, /renkaan/i, /nopeusluokka/i, /nopeus/i, /renkaan nopeusluokka/i, /luokka/i, /america/i, /american/i, /Alexander/i, /President/i, /TGD/i,
        /Kuningas/i, /Kuninkaitten/i, /Aleksis Kivi/i, /Kiven/i, /Aleksanteri Suuri/i, /Yleisön osasto/i, /Aleksanteri Stubb/i, /Stubb/i, /Poliitikka/i, /Politiikka/i, /Poliittinen/i, /Kannanotto/i, /Kannan otto/i, /Yleisönosasto/i,
        /7900/i, /9800/i, /9800X3D/i, /9800 X3D/i, /XTX/i, /XT/i, /1080 TI/i, /1050TI/i, /1080TI/i, /3080/i, /5080TI/i, /5080 TI/i, /1050 TI/i, /8600K/i, /9700K/i, /5900X/i, /Coffee/i, /Lake/i, /Refresh/i, /Athlon/i, /Pentium/i,
        /Fermi/i, /Ampere/i, /Blackwell/i, /diagnoosi/i, /diagnosoitiin/i, /diagnosoitu/i, /diagnosis/i, /saada/i, /löytää/i, /ostaa/i, /löytö/i, /osto/i, /saanti/i, /muumit/i, /Tarina/i, /veren/i, /paine/i, /päiväkirja/i, /Joakim/i,
        /kuinka/i, /miten/i, /miksi/i, /minkä/i, /takia/i, /minä/i, /teen/i, /tätä/i, /ilman/i, /ilma/i,/sää/i, /foreca/i, /ilmatieteenlaitos/i, /päivän/i, /sää/i, /foreca/i, /muumilaakson/i, /tarinoita/i, /muumilaakso/i, /Stream/i,
        /Presidentti/i, /James/i, /Hetfield/i, /Metallica/i, /Sabaton/i, /TheGamingDefinition/i, /Twitch/i, /WhatsApp/i, /Messenger/i, /sääennuste/i, /ennuste/i, /oramorph/i, /oramorfiini/i, /morfiini/i, /yliopistonapteekki/i,
	/apteekki/i, /market/i, /k-market/i, /s-market/i, /marketti/i, /kauppa/i, /kauppatori/i, /butters/i, /Pat McAfee/i, 
    ];

    // List of allowed URLs that should never be blocked
    const allowedUrls = [
        "archive.org", "iltalehti.fi", "is.fi", "instagram.com", "youtube.com", "www.netflix.com", "netflix.com", "www.jimms.fi", "www.verkkokauppa.com", "www.motonet.fi", "www.reddit.com", "runescape.wiki", "spotify.com",
        "wwe.com", "amd.com", "nvidia.com", "tori.fi", "www.tori.fi", "www.wikipedia.org", "old.reddit.com", "new.reddit.com", "oldschool.runescape.com", "runescape.com", "chatgpt.com", "github.com/copilot",
        "github.com/paintdotnet", "www.getpaint.net", "datatronic.fi", "www.datatronic.fi", "multitronic.fi", "www.multitronic.fi", "hintaopas.fi", "www.proshop.fi", "www.yliopistonapteekki.fi"
    ];

    // List of URL patterns to hide using regular expressions
    const urlPatternsToHide = [
        /github\.com\/best-deepnude-ai-apps/i,
        /github\.com\/AI-Reviewed\/tools\/blob\/main\/Nude%20AI%20:%205%20Best%20AI%20Nude%20Generators%20-%20AIReviewed\.md/i,
        /github\.com\/nudify-ai/i,
        /github\.com\/Top-AI-Apps/i,
        /github\.com\/Top-AI-Apps\/Review\/blob\/main\/Top%205%20DeepNude%20AI%3A%20Free%20%26%20Paid%20Apps%20for%20Jan%202025%20-%20topai\.md/i,
        /chromewebstore\.google\.com\/detail\/tor-selain\/eaoamcgoidmhaficdbmcbamiedeklfol\?hl=fi/i,
        /www\.opera\.com/i,
        /www\.apple\.com/i,
        /microsoft\.com\/en-us\/edge\//i,
        /microsoft\.com\/fi-fi\/edge\//i,
        /brave\.com/i,
        /aitoolfor\.org/i,
        /aitoolfor\./i,
        /aitool4\./i,
        /aitool4u\./i,
        /aitool\./i,
        /remove\.bg/i,
        /folio\.procreate\.com/i,
        /folio\.procreate\.com\/deepnude-ai/i,
        /support\.microsoft\.com\/fi-fi\/microsoft-edge/i,
        /apps\.microsoft\.com\/detail\/xpdbz4mprknn30/i,
        /apps\.microsoft\.com\/detail\/xp8cf6s8g2d5t6/i,
        /apps\.microsoft\.com\/detail\/xpfftq037jwmhs\?/i,
        /apps\.microsoft\.com\/detail\/9nzvdkpmr9rd/i,
        /researchgate\.net/i,
        /thefacemerge\.net/i,
        /faceplusplus\.net/i,
        /microsoft\.com\/fi-fi\/edge/i,
        /google\.com\/intl\/fi_fi\/chrome\//i,
        /play\.google\.com\/store\/apps\/details\?id=com\.microsoft\.emmx/i,
        /apps\.apple\.com\/us\/app\/microsoft-edge-ai-browser\/id1288723196/i,
        /torproject\.org/i,
        /tor\.app/i,
        /mozilla\.org/i,
        /mozilla\.fi/i,
        /tiktok\.com/i,
        /ai-apps-directory\/tools\/blob\/main\/Top%209%20Deepnude%20AI%20Apps%20In%202025%3A%20Ethical%20Alternatives%20%26%20Cutting-Edge%20Tools\.md/i,
        /aitoolfor\.org\/tools\/deepnude-ai/i,
        /eeebuntu\.org\/apk\/deepnude-latest-version/i,
        /aitoolfor\.org\/tools\/undress-ai-app-deepnude-nudify-free-undress-ai/i,
        /merlio\.app\/blog\/free-deepnude-ai-alternatives/i,
        /gitlab\.com\/ai-image-and-text-processing\/DeepNude-an-Image-to-Image-technology/i,
        /aitoptools\.com\/tool\/deepnude-by-deepany-ai/i,
        /gitee\.com\/cwq126\/open-deepnude/i,
        /gitlab\.com\/ai-image-and-text-processing\/DeepNude-an-Image-to-Image-technology\/-\/tree\/master\/DeepNude_software_itself/i,
        /facetuneapp\.com\/\?srd=[\w-]+/i,
        /facetuneapp\.com\/$/i,
        /play\.google\.com\/store\/apps\/details\?id=com\.lightricks\.facetune\.free(&hl=[a-z]{2})?/i,
        /apps\.apple\.com\/us\/app\/facetune-video-photo-editor\/id1149994032/i,
        /lunapic\.com/i,
        /pixelixe\.com/i,
        /picresize\.com/i,
        /replicate\.ai/i,
        /kuvake\.net/i,
        /nude\./i,
        /naked\./i,
        /n8ked\./i,
        /deepnude\./i,
        /nudify\./i,
        /nudifyer\./i,
        /nudifying\./i,
        /nudifier\./i,
        /undress\./i,
        /twitter\.com/i,
        /x\.com/i,
        /\.ai/i,
        /\.app/i,
        /\.io/i,
        /\.off/i,
    ];

    // Define the list of protected selectors
    const protectedSelectors = [
        '#search',
        '.g',
        '#top_nav',
        '#foot',
        '#APjFqb',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP > div.a4bIc',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP > div.fM33ce.dRYYxd',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > button',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.M8H8pb',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb',
        '#_gPKbZ730HOzVwPAP7pnh0QE_3',
        '#tsf > div:nth-child(1) > div.A8SBwf',
        '#tsf > div:nth-child(1) > div:nth-child(2)',
        '#tsf > div:nth-child(1) > script',
        '#tsf > div:nth-child(1)',
        '#tophf',
        '#tsf',
    ];

    // Combine regex patterns for exact keywords and allowed words
    const blockKeywordsPattern = new RegExp(regexKeywordsToHide.map(pat => pat.source).join("|"), "i");

    // Function to check if a text should be blocked
    const isBlocked = (text) => {
        const isTextBlocked = regexKeywordsToHide.some((regex) => regex.test(text)) || 
                              stringKeywordsToHide.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
        const isTextAllowed = allowedWords.some((word) => word.test(text));
        return isTextBlocked && !isTextAllowed;
    };

    // Function to check if a URL is allowed
    const isUrlAllowed = (url) => {
        return allowedUrls.some(allowedUrl => url.includes(allowedUrl));
    };

    // Function to handle URL interception and redirection for forbidden searches
    const handleForbiddenSearchRedirection = () => {
        const searchParams = new URLSearchParams(window.location.search);
        const query = searchParams.get('q') || '';

        // Redirect only if the query contains forbidden keywords
        if (isBlocked(query) && !isUrlAllowed(window.location.href)) {
            console.log(`Redirecting due to forbidden search query: ${query}`);
            window.location.replace('https://www.google.com'); // Redirect immediately
            return true;
        }
        return false;
    };

    // Function to check the URL for forbidden keywords and redirect if found
    const checkUrlForForbiddenKeywords = () => {
        const url = window.location.href.toLowerCase();
        // Redirect only if the URL contains forbidden keywords
        if (isBlocked(url) || urlPatternsToHide.some((pattern) => pattern.test(url))) {
            console.log(`Redirecting due to forbidden URL: ${url}`);
            window.location.replace('https://www.google.com'); // Redirect immediately
            return true;
        }
        return false;
    };

    // Function to intercept form submission and redirect if needed
    const interceptSearchFormSubmit = () => {
        const searchForm = document.querySelector('form[action="/search"]');

        if (searchForm) {
            searchForm.addEventListener('submit', (event) => {
                const searchParams = new URLSearchParams(new FormData(searchForm));
                const query = searchParams.get('q') || '';

                if (isBlocked(query) && !isUrlAllowed(window.location.href)) {
                    console.log(`Redirecting due to forbidden form submission: ${query}`);
                    event.preventDefault();
                    window.location.replace('https://www.google.com'); // Redirect immediately
                }
            });
        }
    };

    // Function to intercept changes in the search input field
    const interceptSearchInputChanges = () => {
        const searchInput = document.querySelector('input[name="q"]');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value;

                if (isBlocked(query) && !isUrlAllowed(window.location.href)) {
                    console.log(`Redirecting due to forbidden search input: ${query}`);
                    window.location.replace('https://www.google.com'); // Redirect immediately
                }
            });
        }
    };

    // Function to block URLs
    const blockUrls = () => {
        const links = document.getElementsByTagName("a");
        for (let link of links) {
            const href = link.href.toLowerCase();
            if (isBlocked(href) || urlPatternsToHide.some((pattern) => pattern.test(href))) {
                console.log(`Blocking URL: ${href}`);
                link.remove(); // Remove the link immediately
            }
        }
    };

    // Function to block results
    const blockResults = () => {
        const results = document.querySelectorAll('div.g, div.srg > div, div.v7W49e, div.mnr-c, div.Ww4FFb, div.yuRUbf');
        results.forEach((result) => {
            const resultText = result.innerText.toLowerCase();
            const link = result.querySelector('a');
            const resultUrl = link ? link.href : '';

            if (isBlocked(resultText) || isBlocked(resultUrl)) {
                console.log(`Blocking result: ${resultText} or URL: ${resultUrl}`);
                result.remove(); // Remove the result immediately
            }
        });
    };

    // Monitor banned terms in body text
    const monitorBannedTerms = () => {
        const checkAndBlock = () => {
            const elements = document.querySelectorAll('body, body *');
            elements.forEach((element) => {
                if (
                    element.textContent &&
                    isBlocked(element.textContent)
                ) {
                    console.log(`Blocking element containing banned term: ${element.textContent}`);
                    element.remove(); // Remove the element immediately
                }
            });
        };

        // Use a very short interval to ensure faster checks
        setInterval(checkAndBlock, 20); // Check every 20ms for maximum speed
    };

    // Monitor selectors and redirect if needed
    const monitorSelectorsAndRedirect = () => {
        const selectors = ['#fprsl', '#fprs', '#taw', '#oFNiHe', '.QRYxYe', '.NNMgCf'];
        selectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element) => {
                if (isBlocked(element.textContent)) {
                    console.log(`Redirecting due to forbidden content in selector: ${selector}`);
                    window.location.replace('https://www.google.com'); // Redirect immediately
                }
            });
        });
    };

    // Initialize script
    const init = () => {
        enforceSafeSearch();
        interceptSearchFormSubmit();
        interceptSearchInputChanges();
        blockUrls();
        blockResults();

        const observer = new MutationObserver(() => {
            blockUrls();
            blockResults();
            monitorSelectorsAndRedirect();
        });

        observer.observe(document.body, { childList: true, subtree: true });

        monitorBannedTerms(); // Start monitoring banned terms instantly
    };

    // Perform immediate checks
    if (!handleForbiddenSearchRedirection() && !checkUrlForForbiddenKeywords()) {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('Redirection occurred due to forbidden search or URL.');
    }
})();