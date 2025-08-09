(function () {
    'use strict';

    // --- 1. INSTANT OVERLAY (always shown first, never remove before filtering/redirect logic) ---
    let overlay = document.createElement('div');
    overlay.id = 'google-blocker-blank';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = '#fff';
    overlay.style.zIndex = '2147483647';
    overlay.style.pointerEvents = 'all';
    overlay.style.transition = 'none';
    overlay.style.display = 'block';
    document.documentElement.appendChild(overlay);

    // --- Keyword arrays
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
	/0r!g4/i, /0rig@/i, /0rig4/i, /0r9ga/i, /0r9g4/i, /0r1q4/i, /0r1qa/i, /0rlg4h/i, /or1g@h/i, /orrga/i, /orrgaa/i, /orgaa/i, /\bApple\b/i, /Dreamboot/i, /Dream boot/i, /\bSX\b/i, /Sxuel/i, /Sxual/i, /Sxu3l/i, /5xu3l/i, /5xuel/i, 
	/5xu4l/i, /5xual/i, /dre4m/i, /dr34m/i, /bo0th/i, /b0oth/i, /b0o7h/i, /bo07h/i, /b007h/i, /b00th/i, /booo/i, /b0oo/i, /bo0o/i, /boo0/i, /b000/i, /booo/i, /n000/i, /n00d/i, /no0d/i, /n0od/i, /\bNud\b/i, /\bdpnod\b/i, /\bdp nod\b/i, 
	/\bdp nood\b/i, /\bdp nod\b/i, /\bdep nod\b/i, /dpnod/i, /dpnood/i, /dpnud/i, /depnud/i, /depnuud/i, /depenud/i, /depenuu/i, /dpepenud/i, /dpeepenud/i, /dpeepnud/i, /dpeependu/i, /dpeepndu/i, /Elayna/i, /Eleyna/i, /Eliyna/i,
	/Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elina WWE/i, /Elyna WWE/i, /Elyina/i, /Aikusviihde/i, /Aikus viihde/i, /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i, 
	/fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, /topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, 
	/Jenn1/i, /J3nn1/i, /J3nni/i, /J3nn4/i, /Jenn4/i, /persreikä/i, /perse reikä/i, /pers reikä/i, /pyllyn reikä/i, /pylly reikä/i, /pyllynreikä/i, /pyllyreikä/i, /persa/i, /pers a/i, /anusa/i, /anus a/i, /pers-/i, /pylly-/i, 
	/pyllyn-/i, /-reikä/i, /-aukko/i, /-kolo/i, /pimpp/i, /pimpe/i, /pinpp/i, /pinpi/i, /pimpi/i, /pimps/i, /pimsu/i, /pimsa/i, /pimps/i, /pilde/i, /pilper/i, /tussu/i, /tuhero/i, /emätin/i, /softorbit/i, /soft orbit/i,
	/VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, /OracleVM/i, /virtualmachine/i, /virtual machine/i,
	/virtuaalikone/i, /virtuaali kone/i, /virtuaali tietokone/i, /virtuaalitietokone/i, /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, /virtuaali masiina/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, 
	/virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, 
    ]; 

    const stringKeywordsToHide = [
        "Bliss", "Tiffany", "Tiffy", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Tegan Nox", "Charlotte Flair", "Becky Lynch", "Michin", "Mia Yim", "WWE Woman", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven",
        "Alba Fyre", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Jordynne", "WWE Women", "WWE Women's", "WWE Divas", "WWE Diva", "Maryse", "Samantha", "Irwin WWE", "Irvin WWE", "Irvin AEW",
        "Irwin AEW", "Candice LeRae", "Nia Jax", "Naomi", "Bianca Belair", "Charlotte", "Flair", "Trish", "Stratus", "MSEdge", "Izzi Dame", "Izzi WWE", "Dame WWE", "play boy", "Young Bucks", "Jackson", "NXT Women's", "AI app",
        "NXT Woman", "Jessika Carr", "Carr WWE", "Jessica Carr", "Jessika Karr", "Karr WWE", "poses", "posing", "Lash Legend", "Jordynne Grace", "Isla Dawn", "editation", "Raquel Rodriguez", "DeepSeek", "Jessika WWE",
        "Jessica WWE", "Jessica Karr", "WWE Dame", "WWE Izzi", "playboy", "deepnude", "undress", "nudify", "nude app", "nudifier", "faceswap", "facemorph", "morph face", "swapface", "Bliss", "Nikki", "Brie", "Opera Browser",
        "TOR Browser", "TOR-Browser", "TOR-selain", "TOR selain", "nudecrawler", "AI edit", "AI edited", "browser", "selain", "Brave-selainta", "Brave-selaimen", "Undress AI", "DeepNude AI", "editing", "Skye Blue",
        "tarkoitiitko: nudify", "undress-app", "deepnude-app", "nudify-app", "Lola Vice", "Vice WWE", "Opera GX", "Sasha Banks", "-selainta", "selaimen", "-selaimen", "Lola WWE", "Alexis", "crotch", "WWE Xoxo", "Morgan Xoxo",
        "pusy", "pics edit", "pic edit", "pusi", "fappening", "naked", "n8ked", "n8k3d", "nak3d", "nud3", "Tiffy", "Safari", "vaatteiden poisto", "dreamtime", "dreamtime app", "mature content", "mature site", "adult content",
        "mature content", "mature site", "adult content", "adult site", "inpaint", "photopea", "fotopea", "Steward", "edit app", "picture edit", "Tiffy Time", "picresize", "lunapic", "pixelixe", "gay", "1fy", "!fy", "lfy",
        "de3p", "OperaGX", "Perez", "photo edit", "d33p", "3ip", "without", "cameltoe", "dreamtime AI", "Joanie", "cleavage", "fuck", "rule34", "r34", "r_34", "Rule 34", "image edit", "Rul", "Rul34", "Rul 34", "pic app",
        "Stewart", "Perze", "Stratton", "Ruca", "Frost AI", "Laurer", "AI Frost", "frost.com", "onlyfans", "only fans", "fantime", "fan time", "okfans", "ifans", "ifan", "Loyalfans", "Loyalfan", "Fansly", "JustForFans", "samuels",
        "ok fans", "Just for fans", "i fans", "Loyal fans", "Fan sly", "fans only", "Jaida WWE", "fan only", "Fan loyal", "Fans loyal", "biscuit booty", "editor app", "Trans", "Kristen", "MS Edge", "Transvestite", "linger",
        "Baker", "Biscuit Butt", "Birppis", "Birpppis", "deviant art", "upscale", "upscaling", "Bella", "sex", "facetune", "face tune", "tuning face", "face tuning", "facetuning", "tuningface", "biscuit ass", "Chyna", "Gina Adams",
        "bikini", "Kristen Stewart", "biscuit backside","Sydney Sweeney", "Britt Baker", "Deepseek", "shag", "shagged", "fake", "cloth", "Blis", "LGBTQ", "pant", "fat fetish", "Object", "adultcontent", "F4NS", "Carmella", "Adams WWE",
        "nsfw", "18+", "18 plus", "porn", "penetration", "filmora", "xxx", "nudifier", "nudifying", "nudity", "Jaida Parker", "F4N5", "undressing", "undressifying", "generative", "undressify", "Goddess", "Perry WWE", "Toni Storm", 
        "FAN5", "Harley", "Cameron", "Merlio", "Hayter", "Ripley", "Rhea Ripley", "Microsoft Edge", "askfm", "ask fm", "CJ WWE", "queer", "Pride", "prostitute", "escort", "fetish", "v1ds", "m4ny", "v1d5", "erotic", "LGBT", "Gina WWE",
        "blowjob", "Sportskeeda", "whoring", "AI Tool", "aitool", "vagina", "genital", "booty", "nudyi", "Nudying", "Nudeying", "derriere", "busty", "slut", "whore", "whoring", "camgirl", "cumslut", "fury foot", "fury feet", "Jaida",
        "DeepSeek", "DeepSeek AI", "fansly", "patreon", "manyvids", "chaturbate", "myfreecams", "Samsung Internet", "Policy template", "Templates", "Policies", "onlifans", "camsoda", "stripchat", "bongacams", "livejasmin",
        "Shirai", "Io Sky", "Sky WWE", "Sky Wrestling", "Sky wrestle", "foot fury", "feet fury", "Bleis", "WWE woman", "WWE women", "amateur", "5 feet of fury", "five feet of fury", "Velvet Sky", "onl1", "celeb", "0nl1",
        "Diipfeikki", "Lana Perry", "Vince Russo", "Russo", "Goddess WWE", "Mandy Rose", "Chelsea Green", "Zelina Vega", "Valhalla", "IYO SKY", "Io Shirai", "Iyo Shirai", "Dakota Kai", "Asuka", "Kairi Sane", "jaida", "0nli",
        "Kamifuku", "Satomura", "Thekla", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey", "Dana Brooke", "Aubrey", "Edwards", "Alicia", "Atout", "Tamina", "Alicia Fox", "Summer Rae", "Layla", "Michelle McCool", "Eve Torres", 
        "Kelly Kelly", "Kelly2", "Kelly 2", "Melina WWE", "Brittany", "Aubert", "Renee Paquette", "Parker WWE", "Melina wrestler", "Jillian Hall", "Mickie James", "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly",
        "Jazz", "Lana Del Rey", "Gail Kim", "Awesome Kong", "Madison Rayne", "Velvet Sky", "Angelina", "Brooke", "Tessmacher", "Havok", "Renee", "Britany", "Britanny", "Del Ray", "Su Yung", "Taya Valkyrie", "Deonna", "Purrazzo",
        "Anna Jay", "Tay Conti", "Britany", "Britanny", "Del Ray", "Su Yung", "Taya Valkyrie", "Deonna Purrazzo", "Saraya", "Anna Jay", "Tay Conti", "Tay Melo", "Willow Nightingale", "Noelle", "Syväväärennös", "Del Rey", "Lexi",
        "Hikaru Shida", "Thea Hail", "Yuka", "Sakazaki", "Nyla Rose", "Sakura", "Penelope", "Shotzi", "Miia Yim", "Miia Yam", "CJ Perry", "deviantart", "Charlotte", "Mickie", "Micky", "Carolina", "Caroline", "Charlotte Flair",
        "Blackheart", "Tegan", "Becky", "Lynch", "Bailey", "Giulia", "Mia Yam", "Michin", "Mia Yim", "AJ Lee", "Paige", "Stephanie", "Liv Morgan", "Piper Niven", "Bayley", "Jaida", "Jaidi", "NXT Womens", "NXT Women", "NXT Woman",
        "Jordynne Grace", "Jordynne", "Uhkapeli", "Alex Windsor", "Uhka peli", "Sunny", "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Uhkapelaaminen", "J41D4", "Ja1d4", "Lana WWE", "Scarlett Bordeaux", "Kayden Carter",
        "J41da", "Alba Fyre", "Isla Dawn", "Raquel Rodriguez", "B-Fab", "Uhka pelaaminen", "Jaid4", "J4ida", "Lyra Valkyria", "Indi Hartwell", "Blair Davenport", "Maxxine Dupri", "Dave Meltzer", "Natalya", "Nattie", "Electra Lopez",
        "Valentina Feroz", "Amari Miller", "Sol Ruca", "Yulisa Leon", "Arianna", "Young Bucks", "Matt Jackson", "Nick Jackson", "nadke", "Karmen Petrovic", "Ava Raine", "Cora Jade", "Gamble", "Feikki", "Jacy Jayne", "Gigi Dolin",
        "Tatum WWE", "dress", "Fallon Henley", "Kelani Jordan", "explicit", "AEW", "justforfans", "Katana Chance", "Mercedes", "Gambling", "mature content", "Flair", "Saraya", "Renee Young", "anaaliseksi", "Sasha", "Wendy Choo",
        "Paxley", "NXT Women", "adult site", "cam4", "biscuit rear", "d3ep", "Sweeney", "Britt", "Mariah","puzzy", "editing app", "linq", "pussy", "tushy", "Roxanne", "Blies", "CJ Lana", "Melina WWE", "Satomura", "Statlander",
	"*uck", "f*ck", "fu*k", "fuc*", "f***", "f**k", "**ck", "fuc*k", "f*cked", "f*cker", "f**ked", "f**king", "fu**", "f**", "f****", "f*c*", "*cked", "f*cking", "f*cked", "f*cks", "f*ckup", "f**kery", "f*ckface", "f*ckwit", 
	"f*cktard", "f*cker", "f*ckery", "sh*t", "sh*tty", "*hit", "s**t", "sh**", "sh*tfaced", "sh*tbag", "s*cker", "b*tch", "b**ch", "b****", "b*itch", "*itch", "b*stard", "b**tard", "b*stardly", "b*st*rd", "b*st*rds", "b*lls", 
	"*lls", "b*llocks", "b*llsack", "a**", "a*shole", "*sshole", "as*hole", "assh*le", "as**hole", "a**hole", "a**wipe", "a*shat", "b*lls", "p*ssy", "c*nt", "c**t", "cu*t", "*unt", "c*nts", "c**ts", "cunt*","c*nts", "tw*t", 
	"tw**t", "t*at", "t**t", "p*ss", "p***", "p*ssed", "p*ssy", "t*rd", "t*rd", "rawdog", "rawdogging", "raw dogging", "raw dog", "d*ck", "d**k", "di*k", "d*ckhead", "d*ckbag", "d**kface", "sh*thead", "b*lls", "t*t", "*n**r", 
	"*n***r", "m*therf*cker", "m*therfucker", "*ss", "as****", "f*ckface", "f*cktard", "fukk", "fukc", "fu*c", "*ss", "a*s", "azz", "a*z", "az*", "***", "###", "@@", "#*", "*#", "@*", "*@", "#@", "@#", "sheer", "face replace", 
	"face merge", "face blend", "faceblend", "AI face", "neural", "AI morph", "face animation", "deep swap", "swap model", "photorealistic swap", "synthetic face", "hyperreal", "hyper real", "reface", "facereplace", "fylng",
	"facefusion", "face reconstruction", "wondershare", "AI face recreation", "virtual morph", "face synthesis", "neural face swap", "deep neural face", "AI-powered face swap", "face augmentation", "digital face synthesis", 
	"virtual face swap", "hyperreal AI face", "photo-real AI face", "face deepfake", "synthetic portrait generation", "AI image transformation", "face fusion technology", "deepface swap", "photo manipulation face", "fy1ng",
	"deepfak portrait", "machine learning", "generation", "generative", "AI model face swap", "face generation AI", "face replacement AI", "video face morphing", "3D face morph", "AI facial animation", "deepfake avatar", 
	"synthetic avatar creation", "facial", "AI model swap", "deep model swap", "image to face morph", "AI character face", "face remapping AI", "synthetic media", "AI-created character face", "face replacement tool", "fy!ng",
	"photo trans", "pict trans", "image trans", "virtual avatar face", "AI video face replacement", "digital face replacement", "hyperreal synthetic face", "AI face transformer", "face generation model", "realistic face", 
	"face blend", "virtual reality face", "face technology", "face tech", "3D morph face", "face AI animation", "real-time face swap", "AI-driven photo manipulation", "deepfake model creation", "digital persona", "Elite Wrestling",
	"face overlay", "synthetic person", "facial blending", "face swap", "virtual character face swap", "photorealistic face generator", "face altering AI", "realistic AI swap", "face expression morphing", "video gen",
	"face transformation AI", "virtual human face swap", "synthetic media generation", "3D face recreation", "AI-generated face animation", "neural network face replacement", "deepfake face morphing", "video generat", "Windsor",
	"hyperreal", "face projection", "synthetic face swap", "face model", "virtual human face", "venice", "real-time deepfake", "photorealistic deepfake", "neural face transformation", "AI-generated face morph", "face render",
	"machine-generated face swap", "face image manipulation", "video face animation", "virtual morphing tool", "AI-powered video face swap", "digital face recreation", "AI-based facial replacement", "neural face", "All Elite",
    	"machine learning face generator", "face recognition swap", "AI face animation tool", "synthetic media face", "AI character morphing", "deepfake avatar generation", "photoreal face synthesis", "synthetic face", "n@ked", "onnly",
	"facial deep learning", "neural facial expression swap", "hyperrealistic face model", "wonder share", "AI-driven face fusion", "video face deepfake", "face pattern generation", "AI virtual persona swap", "deepface model trans", 
	"nekkid", "nudee", "nudy", "noodz", "neude", "nudesz", "fan5ly", "fan-sly", "f4nslie", "f@nsly", "vanice", "vanica", "venica", "deep nuud", "deepnud", "deapnude", "d33pnud3", "f@n", "0nly", "0nlifans", "onlii", "onlifanz", 
	"n4ked", "nakid", "nakd", "nakie", "s3x", "dreambooth", "secks", "seggs", "Dream booth", "seks", "Erase clothes", "AI uncloth", "Unclothing AI", "Gen AI pics", "text-to-undress", "text2nude", "remove outfit", "undress filter", "persona creation",
	"stripfilter", "clothing eraser", "nudify tool", "leak editor", "Realistic nude gen", "fleshify", "Skinify", "Alex Kaufman", "Lexi Kaufman", "Lexi Bliss", "Tenille Dashwood", "Saraya Knight", "Paige WWE", "!fy", "1fy", "lfy", "Biggers",
	"Celeste Bonin", "Ariane Andrew", "Brianna Monique Garcia", "Stephanie Nicole Garcia", "deepany", "CJ Perry", "Lana Rusev", "Pamela Martinez", "Ashley Sebera", "Ayesha Raymond", "Marti Belle", "Alisha Edwards", "image2video", "safari",
	"Nicol", "Garcia", "Nikki Garcia", "Wrestling babe", "Divas hot", "Blake", "WWE sexy", "spicy site", "deep-any", "for fans", "VIP pic", "premium content", "sussy pic", "after dark", "NSFL", "artistic nude", "tasteful nude", "sus site", "La Leona",
	"uncensored version", "alt site", "runwayml", "runway", "run way", "runaway", "run away",  "Alex Windsor", "replicate.ai", "huggingface", "hugging face", "cloth remover", "AI eraser", "Magic Editor", "magicstudio", "cleanup.pictures", "Trenesha", 
	"app123", "modapk", "apkmod", "tool hub", "tools hub", "alaston", "alasti", "vaatteeton", "paljas", "seksikäs", "pimppi", "vittu", "tissit", "nänni", "sukupuolielin", "paljain", "seksisivu", "alastomuus", "sus content", "fucking", "face +",
	"aikuissisältö", "aikuissivusto", "seksikuva", "homo", "ndue", "nakde", "lesbo", "transu", "pervo", "face fusion",  "🍑", "🍆", "💦", "👅", "🔞", "😈", "👙", "🩲", "👠", "🧼", "🧽", "( . )( . )", "| |", "( o )( o )", "(!)", "bg remover", 
	"dick", "cock", "penis", "breast", "thigh", "leggings", "leggins", "venoice", "veniice", "jeans", "jerking", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "imgtovid", "img2vid", "imagetovideo", "face+", 
	"her butt", "herbutt", "butth", "butt hole", "assh", "ass h", "buttc", "butt c", "buttcheek", "butt cheek", "ladies", "lady", "runway", "runaway", "run way", "run away", "cheek", "aasho", "ääsho", "ääshö", "face join", "Shira", "Blake Monroe",
	"poistamis", "vaatteidenpoistaminen", "vaatteiden poistaminen", "facemerg", "facefusi", "face merg", "face fusi", "face plus", "faceplus", "merge two faces", "merge 2 faces", "merging 2 faces", "merging two faces", "join face", "Monroe", 
	"join two faces", "join 2 faces", "join2faces", "jointwofaces", "fotor", "Toni WWE", "venise", "venoise", "Tony Storm", "off the Sky", "off da skai", "Priscilla", "Kelly", "Erika", "Vikman", "pakara", "pakarat", "Viikman", "Eerika", "Rhaka",
	"puss*", "p*ssy", "pu*sy", "pus*y", "an*l", "s*x", "s**", "veeniic", "veenice", "**x", "se*", "*ex", "*uck", "s*ck", "d*ck", "c*ck", "f*ck", "fu*k", "fuc*", "*nal", "a*al", "ana*", "*ss", "a*s", "as*", "su*k", "di*k", "co*k", "suc*", "coc*",
	"*wat", "t*at", "tw*t", "twa*", "*unt", "c*nt", "cu*t", "cun*", "0rg4", "org4", "*orn", "p*rn", "po*n", "por*", "*eep", "d*ep", "de*p", "dee*", "*ude", "n*de", "nu*e", "nud*", "*udi", "n*di", "nu*i", "n**e", "n**i", "nu**", "n**e", "dic*", 
	"*aked", "n*ked", "na*ed", "nak*d", "nake*", "**ked", "n**ed", "na**d", "nak**", "**aked", "n**aked", "n*aked", "d!ck", "d1ck", "dlck", "na**ked", "nak**ed", "nake**d", "*kin", "s*in", "sk*n", "ski*", "*lesh", "f*esh", "fl*sh", "fle5h",
	"fle*h", "fles*", "orgasm", "0rgasm", "org@sm", "orga5m", "org@5m", "0rg@sm", "0rga5m", "0rg@5m", "0rg@$m", "org@$m", "0rga$m", "orga$m", "w4nk", "w4nk3", "*ank", "w*nk", "wa*k", "wan*", "*4nk", "w4*k", "w4n*", "fleshi", "fl3sh", "fl35h", 
    ];

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
        /7900/i, /9800/i, /9800X3D/i, /9800 X3D/i, /XTX/i, /XT/i, /1080 TI/i, /1050TI/i, /1080TI/i, /3080/i, /5080TI/i, /5080 TI/i, /1050 TI/i, /2080/i, /XC/i, /8600K/i, /9700K/i, /5900X/i, /Coffee/i, /Lake/i, /Refresh/i, /Athlon/i,
        /Fermi/i, /Ampere/i, /Blackwell/i, /diagnoosi/i, /diagnosoitiin/i, /diagnosoitu/i, /diagnosis/i, /saada/i, /löytää/i, /ostaa/i, /löytö/i, /osto/i, /saanti/i, /muumit/i, /Tarina/i, /veren/i, /paine/i, /päiväkirja/i, /Joakim/i,
        /kuinka/i, /miten/i, /miksi/i, /minkä/i, /takia/i, /minä/i, /teen/i, /tätä/i, /ilman/i, /ilma/i,/sää/i, /foreca/i, /ilmatieteenlaitos/i, /päivän/i, /sää/i, /foreca/i, /muumilaakson/i, /tarinoita/i, /muumilaakso/i, /Stream/i,
        /Presidentti/i, /James/i, /Hetfield/i, /Metallica/i, /Sabaton/i, /TheGamingDefinition/i, /Twitch/i, /WhatsApp/i, /Messenger/i,  /sääennuste/i, /ennuste/i, /oramorph/i, /oramorfiini/i, /morfiini/i, /yliopistonapteekki/i, 
	/Pentium/i, /Kela/i, /kuule/i, /kirje/i, /kuulemiskirje/i, /kelan/i, /kuulemis kirje/i, /TUF/i, /STRIX/i, /SUPRIM/i, /EAGLE/i, /WINDFORCE/i, /GAMING X/i, /GAMING OC/i, /STEALTH/i, /ZOTAC/i, /EMTEK/i, /PALIT/i, /VISION/i, 
	/ROG Strix/i, /FTW/i, /ASUS/i, /MSI/i, /GIGABYTE/i, /AORUS/i, /SAPPHIRE/i, /POWERCOLOR/i, /ASROCK/i, /XFX/i, /PNY/i, /GALAX/i, /GAINWARD/i, /INNO3D/i, /COLORFUL/i, /DUKE/i, /ARMOR/i, /MECH/i, /AERO/i, /JETSTREAM/i, /PHANTOM/i, 
	/AMP/i, /PULSE/i, /NITRO/i, /RED DEVIL/i, /HELLHOUND/i, /FIRESTORM/i, /FIREPRO/i, /FURY/i, /TITAN/i, /QUADRO/i, /PROART/i, /BLOWER/i, /TURBO/i, /OC/i, /OC EDITION/i, /DUAL/i, /MINI/i, /ITX/i, /TRIPLE FAN/i, /TRIPLEFAN/i, 
	/TRINITY/i, /JETSTREAM/i, /OC VERSION/i, /OCV/i, /ULTRA/i, /HOF/i, /HALL OF FAME/i, /LEGION/i, /SHADOW/i, /EX/i, /EVGA/i, /XC/i, /XC3/i, /Strix/i, /ROG/i, /Suprim/i, /SuprimX/i, /Suprim X/i, /FTW3/i, /VENTUS/i, /2080TI/i,
	/2080 TI/i, /1080 TI/i, /3080 TI/i, /4080 TI/i, /5080 TI/i, /2080TI/i, /1080TI/i, /3080TI/i, /4080TI/i, /5080TI/i, /50 TI/i, /60 TI/i,  /70 TI/i, /80 TI/i, /90 TI/i, /50TI/i, /60TI/i,  /70TI/i, /80TI/i, /90TI/i,
    ];

    const allowedUrls = [
        "archive.org", "iltalehti.fi", "is.fi", "instagram.com", "youtube.com", "www.netflix.com", "netflix.com", "www.jimms.fi", "www.verkkokauppa.com", "www.motonet.fi", "www.reddit.com", "runescape.wiki", "spotify.com",
        "wwe.com", "amd.com", "nvidia.com", "tori.fi", "www.tori.fi", "www.wikipedia.org", "old.reddit.com", "new.reddit.com", "oldschool.runescape.com", "runescape.com", "chatgpt.com", "github.com/copilot",
        "github.com/paintdotnet", "www.getpaint.net", "datatronic.fi", "www.datatronic.fi", "multitronic.fi", "www.multitronic.fi", "hintaopas.fi", "www.proshop.fi", "www.yliopistonapteekki.fi"
    ];

    const urlPatternsToHide = [
        /github\.com\/best-deepnude-ai-apps/i,
        /github\.com\/AI-Reviewed\/tools\/blob\/main\/Nude%20AI%20:%205%20Best%20AI%20Nude%20Generators%20-%20AIReviewed\.md/i,
        /github\.com\/nudify-ai/i,
        /github\.com\/Top-AI-Apps/i,
	/github\.com\/HorizonMW\/HorizonMW-Client/i,
	/github\.com\/HorizonMW\/[^\/]+/i,
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
        /wondershare\.com/i,
        /wondershare\.net/i,
        /wondershare\.ai/i,
        /wondershare/i,
        /risingmax\.com/i,
        /horizonmw\.org/i,
	/discord\.com\/invite\//i,
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
        /tenor\./i,
        /tenor\.com/i,
        /pixelixe\.com/i,
        /picresize\.com/i,
        /replicate\.ai/i,
        /kuvake\.net/i,
        /irc\.fi/i,
        /irc-galleria\.fi/i,
        /nude\./i,
        /naked\./i,
        /axis-intelligence\.com/i,
        /feishu\.cn/i,
        /n8ked\./i,
        /imgur\.com.*nude/i,
        /imgur\.com.*deepn/i,
        /AlexaBliss/i,
        /threads\./i,
        /tiktok\./i,
        /www\.tiktok\.com/i,
        /instagram\./i,
        /porn/i,
        /naked/i,
        /nude/i,
        /bangbros/i,
        /sportskeeda\.com/i,
        /deviantart\.com/i,
        /deepnude\./i,
        /deepany\./i,
        /deep-any\./i,
        /nudify\./i,
        /venice\./i,
        /venica\./i,
        /vanica\./i,
        /vanice\./i,
        /uncensor\./i,
        /uncensoring\./i,
        /uncensored\./i,
        /softorbits\./i,
        /softorbit\./i,
        /soft-orbits\./i,
        /soft-orbit\./i,
        /nightcafe\./i,
        /kuvake\./i,
        /ai-\./i,
        /-ai\./i,
        /ai\./i,
        /neural\./i,
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
        /\.best/i,
        /deepnude|deepn/i,
        /nudify-ai/i,
        /ai-nude/i,
        /nude\-generator/i,
        /face-swap/i,
        /top-ai-apps/i,
        /best-deepnude-ai-apps/i,
        /AI-Reviewed/i,
        /porn/i,
        /erotic/i,
        /adult/i,
        /nsfw/i,
        /www\.f4wonline\.com/i,
        /medium\.com/i,
        /https:\medium\.com/i,
        /brave\.com/i,
        /411mania\.com/i,
        /cultaholic\.com/i,
        /whatculture\.com/i,
        /ringsideintel\.com/i,
        /wrestlinginc\.com/i,
        /thesportster\.com/i,
        /cagesideseats\.com/i,
        /sportskeeda\.com/i,
        /f4wonline\.com/i,
        /www.\f4wonline\.com/i,
        /medium\.com/i,
        /https:\medium\.com/i,
        /medium\.com\/@/i,
        /awfulannouncing\.com/i,
        /pwpix\.net/i,
        /reddit\.com\/r\/AlexaBliss/i,
        /reddit\.com\/r\/BeckyLynch/i,
        /reddit\.com\/r\/CharlotteFlair/i,
        /reddit\.com\/r\/SashaBanks/i,
        /reddit\.com\/r\/Bayley/i,
        /reddit\.com\/r\/Asuka/i,
        /reddit\.com\/r\/RheaRipley/i,
        /reddit\.com\/r\/LivMorgan/i,
        /reddit\.com\/r\/Carmella/i,
        /reddit\.com\/r\/ZelinaVega/i,
        /reddit\.com\/r\/MandyRose/i,
        /reddit\.com\/r\/ToniStorm/i,
        /reddit\.com\/r\/IoShirai/i,
        /reddit\.com\/r\/BiancaBelair/i,
        /reddit\.com\/r\/NikkiCross/i,
        /reddit\.com\/r\/PaigeWWE/i,
        /reddit\.com\/r\/Lita/i,
        /reddit\.com\/r\/TrishStratus/i,
        /reddit\.com\/r\/MickieJames/i,
        /reddit\.com\/r\/GailKim/i,
        /reddit\.com\/r\/AJLee/i,
        /reddit\.com\/r\/NaomiWWE/i,
        /reddit\.com\/r\/NiaJax/i,
        /reddit\.com\/r\/ShaynaBaszler/i,
        /reddit\.com\/r\/RubyRiott/i,
        /reddit\.com\/r\/EmberMoon/i,
        /reddit\.com\/r\/KairiSane/i,
        /reddit\.com\/r\/DakotaKai/i,
        /reddit\.com\/r\/TeganNox/i,
        /reddit\.com\/r\/PeytonRoyce/i,
        /reddit\.com\/r\/BillieKay/i,
        /reddit\.com\/r\/CandiceLeRae/i,
        /reddit\.com\/r\/SonyaDeville/i,
        /reddit\.com\/r\/NikkiBella/i,
        /reddit\.com\/r\/BrieBella/i,
        /reddit\.com\/r\/EvaMarie/i,
        /reddit\.com\/r\/KellyKelly/i,
        /reddit\.com\/r\/BethPhoenix/i,
        /reddit\.com\/r\/Melina/i,
        /reddit\.com\/r\/VictoriaWWE/i,
        /reddit\.com\/r\/LaylaEl/i,
        /reddit\.com\/r\/MichelleMcCool/i,
        /reddit\.com\/r\/SquaredCircle/i,
        /reddit\.com\/r\/SCJerk/i,
        /reddit\.com\/r\/AlexaBlissWorship/i
    ];

    const blockedImageURLs = [
        /reddit\.com\/r\/SquaredCircle/i,
        /reddit\.com\/r\/SCJerk/i,
        /reddit\.com\/r\/AlexaBliss/i,
        /reddit\.com\/r\/AlexaBlissWorship/i,
        /redgifs\.com\//i,
        /twitter\.com/i,
        /x\.com/i,
        /tiktok\.com/i,  
        /AlexaBliss/i,
        /threads\./i,
        /instagram\.com/i,
        /porn/i,
        /bangbros/i,
        /sportskeeda\.com/i,
        /deviantart\.com/i,
        /deepnude\./i,
        /deepany\./i,
        /deep-any\./i,
        /nudify\./i,
        /venice\./i,
        /venica\./i,
        /vanica\./i,
        /vanice\./i,
        /uncensor\./i,
        /uncensoring\./i,
        /uncensored\./i,
        /nudify\./i,
        /venice\./i,
        /venica\./i,
        /vanica\./i,
        /vanice\./i,
        /threads\.com/i,
        /threads\.net/i,
        /uncensor\./i,
        /uncensoring\./i,
        /uncensored\./i,
        /nudifyer\./i,
        /nudifying\./i,
        /nudifier\./i,
        /undress\./i,
        /nightcafe\./i,
        /softorbits\./i,
        /softorbit\./i,
        /soft-orbits\./i,
        /soft-orbit\./i,
        /kuvake\./i,
        /ai-\./i,
        /-ai\./i,
        /ai\./i,
        /tenor\./i,
        /tenor\.com/i,
        /torproject\.org/i,
        /tor\.app/i,
        /mozilla\.org/i,
        /mozilla\.fi/i,
        /tiktok\.com/i,
        /tiktok\./i,
        /www\.tiktok\.com/i,
        /www\.opera\.com/i,
        /www\.apple\.com/i,
        /microsoft\.com\/en-us\/edge\//i,
        /microsoft\.com\/fi-fi\/edge\//i,
        /brave\.com/i,
        /411mania\.com/i,
        /cultaholic\.com/i,
        /whatculture\.com/i,
        /ringsideintel\.com/i,
        /wrestlinginc\.com/i,
        /thesportster\.com/i,
        /cagesideseats\.com/i,
        /f4wonline\.com/i,
        /www.\f4wonline\.com/i,
        /medium\.com/i,
        /https:\medium\.com/i,
        /medium\.com\/@/i,
        /awfulannouncing\.com/i,
        /pwpix\.net/i
    ];

    const protectedSelectors = [
        '#APjFqb', '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP > div.a4bIc',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP > div.fM33ce.dRYYxd',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > button',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.M8H8pb',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb',
        '#_gPKbZ730HOzVwPAP7pnh0QE_3', '#tsf > div:nth-child(1) > div.A8SBwf',
        '#tsf > div:nth-child(1) > div:nth-child(2)', '#tsf > div:nth-child(1) > script',
        '#tsf > div:nth-child(1)', '#tophf', '#tsf'
    ];

    // --- 3. REGEX GUARDING ---
    const blockKeywordsPattern = regexKeywordsToHide.length
        ? new RegExp(regexKeywordsToHide.map(pat => pat.source).join("|"), "i")
        : null;

    // --- 4. UTILITY FUNCTIONS ---
    const isUrlAllowed = (url) =>
        allowedUrls.length > 0
            ? allowedUrls.some(allowedUrl => url.includes(allowedUrl))
            : false;

    const isProtectedElement = (element) => protectedSelectors.some(selector => element.matches && element.matches(selector));

    const containsForbiddenKeywords = (query) => {
        if (!query) return false;
        let regexHit = false, regexHitStr = '';
        if (regexKeywordsToHide.length > 0) {
            for (const re of regexKeywordsToHide) {
                if (re && re.test && re.test(query)) {
                    regexHit = true; regexHitStr = re.toString(); break;
                }
            }
        }
        let stringHit = false, stringHitStr = '';
        if (stringKeywordsToHide.length > 0) {
            for (const s of stringKeywordsToHide) {
                if (s && query.toLowerCase().includes(s.toLowerCase())) {
                    stringHit = true; stringHitStr = s; break;
                }
            }
        }
        if (regexHit || stringHit) {
            console.log('containsForbiddenKeywords:', {query, regexHit, regexHitStr, stringHit, stringHitStr});
        }
        return regexHit || stringHit;
    };

    function isBannedImage(textOrUrl) {
        if (!textOrUrl) return false;
        let arrayHit = [
            blockedImageURLs.length > 0 && blockedImageURLs.some(re => re.test(textOrUrl)),
            regexKeywordsToHide.length > 0 && regexKeywordsToHide.some(re => re.test(textOrUrl)),
            stringKeywordsToHide.length > 0 && stringKeywordsToHide.some(kw =>
                textOrUrl.toLowerCase().includes(kw.toLowerCase())
            )
        ];
        if (arrayHit.some(Boolean)) {
            console.log('isBannedImage:', textOrUrl, arrayHit);
        }
        return arrayHit.some(Boolean);
    }

    // --- 5. DEBUG LOG ARRAYS ---
    if (window.console) {
        console.log('regexKeywordsToHide:', regexKeywordsToHide);
        console.log('stringKeywordsToHide:', stringKeywordsToHide);
        console.log('allowedWords:', allowedWords);
        console.log('allowedUrls:', allowedUrls);
        console.log('urlPatternsToHide:', urlPatternsToHide);
        console.log('blockedImageURLs:', blockedImageURLs);
        console.log('protectedSelectors:', protectedSelectors);
    }

    // --- 6. REDIRECT ON FORBIDDEN QUERY (runs for ALL Google domains, including www.google.com, so Google Images works) ---
    function redirectToGoogleDotComIfBanned() {
        const currentHostname = window.location.hostname;
        const googleDomainPattern = /^([a-z0-9-]+\.)*google\.[a-z]+(\.[a-z]+)?$/i;
        const hasForbiddenLogic = regexKeywordsToHide.length > 0 || stringKeywordsToHide.length > 0;
        if (!hasForbiddenLogic) return false;
        if (googleDomainPattern.test(currentHostname)) { // FIX: No longer skips www.google.com!
            const searchParams = new URLSearchParams(window.location.search);
            const query = searchParams.get('q');
            if (query && containsForbiddenKeywords(query) && !isUrlAllowed(window.location.href)) {
                overlay.style.display = "block";
                window.location.replace('https://www.google.com');
                return true;
            }
        }
        return false;
    }
    if (redirectToGoogleDotComIfBanned()) return;

    // --- 7. FILTERING LOGIC ---
    function blockUrls() {
        try {
            if (regexKeywordsToHide.length === 0 && stringKeywordsToHide.length === 0 && urlPatternsToHide.length === 0) return;
            const links = document.getElementsByTagName("a");
            for (let link of links) {
                if (isUrlAllowed(link.href)) continue;
                if (
                    !(allowedWords.length > 0 && allowedWords.some(word => word.test(link.href))) &&
                    (
                        (blockKeywordsPattern && blockKeywordsPattern.test(link.href)) ||
                        (urlPatternsToHide.length > 0 && urlPatternsToHide.some(pattern => pattern.test(link.href)))
                    )
                ) {
                    link.remove();
                }
            }
        } catch (e) { /* ignore */ }
    }

    function blockElementsBySelectors() {
        try {
            if (regexKeywordsToHide.length === 0 && stringKeywordsToHide.length === 0) return;
            const selectorsToHide = [
                'span.gL9Hy', '.spell_orig', '.KDCVqf.card-section.p64x9c', '#oFNiHe', '#taw',
                '.QRYxYe', '.NNMgCf', '#bres > div.ULSxyf', 'div.ULSxyf', '#bres'
            ];
            selectorsToHide.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (
                        !(allowedWords.length > 0 && allowedWords.some(word => word.test(element.textContent))) &&
                        !isProtectedElement(element)
                    ) {
                        element.remove();
                    }
                });
            });
        } catch (e) { /* ignore */ }
    }

    function blockElementsByPhrases() {
        try {
            if (regexKeywordsToHide.length === 0 && stringKeywordsToHide.length === 0) return;
            const phrasesToHide = [
                /Näytetään tulokset haulla/i,
                /Hae kyselyllä/i,
                /Tarkoititko/i,
                /Showing results for:/i,
                /Search with query:/i,
                /Did you mean:/i
            ];
            const elements = document.querySelectorAll('div, span, p, a, i');
            elements.forEach(element => {
                if (isProtectedElement(element)) return;
                const textContent = element.textContent || '';
                if (
                    phrasesToHide.some(phrase => phrase.test(textContent)) &&
                    !(allowedWords.length > 0 && allowedWords.some(word => word.test(textContent)))
                ) {
                    element.remove();
                }
            });
        } catch (e) { /* ignore */ }
    }

    function removeBlockedGoogleImageResults() {
        try {
            if (regexKeywordsToHide.length === 0 && stringKeywordsToHide.length === 0 && blockedImageURLs.length === 0) return;
            const imageResults = document.querySelectorAll('div.isv-r');
            imageResults.forEach(container => {
                let matched = false;
                container.querySelectorAll('a, img').forEach(el => {
                    if (!matched) {
                        const href = el.href || '';
                        const src = el.src || '';
                        const alt = el.alt || '';
                        const title = el.title || '';
                        if (isBannedImage(href) || isBannedImage(src) || isBannedImage(alt) || isBannedImage(title)) {
                            matched = true;
                        }
                    }
                });
                if (!matched) {
                    let text = container.textContent || "";
                    if (isBannedImage(text)) matched = true;
                }
                if (matched) container.remove();
            });
        } catch (e) { /* ignore */ }
    }

    function blockResults() {
        try {
            if (regexKeywordsToHide.length === 0 && stringKeywordsToHide.length === 0 && urlPatternsToHide.length === 0) return;
            const results = document.querySelectorAll('div.g, div.srg > div, div.v7W49e, div.mnr-c, div.Ww4FFb, div.yuRUbf');
            results.forEach(result => {
                const resultText = result.innerText ? result.innerText.toLowerCase() : '';
                const link = result.querySelector('a');
                const resultUrl = link ? link.href : '';
                if (
                    (
                        blockKeywordsPattern && blockKeywordsPattern.test(resultText)
                    ) ||
                    (
                        blockKeywordsPattern && blockKeywordsPattern.test(resultUrl)
                    )
                ) {
                    if (
                        !(allowedWords.length > 0 && allowedWords.some(word => word.test(resultUrl))) &&
                        !isUrlAllowed(resultUrl) &&
                        (!link || (!link.href.includes('github.com') || (blockKeywordsPattern && blockKeywordsPattern.test(resultUrl))))
                    ) {
                        result.remove();
                    }
                }
                if (urlPatternsToHide.length > 0 && urlPatternsToHide.some(pattern => pattern.test(resultUrl))) {
                    result.remove();
                }
            });
            blockElementsBySelectors();
            blockElementsByPhrases();
        } catch (e) { /* ignore */ }
    }

    // --- 8. SELECTOR REDIRECT LOGIC (ONLY after filtering!) ---
    function monitorSelectorsAndRedirect() {
        try {
            const hasForbiddenLogic = regexKeywordsToHide.length > 0 || stringKeywordsToHide.length > 0;
            if (!hasForbiddenLogic) return false;
            const selectors = [
                '#fprsl', '#fprs', '#oFNiHe', '.QRYxYe', '.NNMgCf', '.spell_orig', '.gL9Hy', "#bres", "div.y6Uyqe"
            ];
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const textContent = element.textContent || '';
                    if (
                        (blockKeywordsPattern && blockKeywordsPattern.test(textContent)) ||
                        (stringKeywordsToHide.length > 0 && stringKeywordsToHide.some(keyword => textContent.toLowerCase().includes(keyword.toLowerCase())))
                    ) {
                        overlay.style.display = "block";
                        window.location.replace('https://www.google.com');
                        return true;
                    }
                }
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    // --- 9. FILTER, SET WHITE BG, THEN REMOVE OVERLAY ---
    let firstFilteringDone = false;
    function filterAllAndReveal() {
        overlay.style.display = "block";
        removeBlockedGoogleImageResults();
        blockResults();
        blockUrls();
        blockElementsBySelectors();
        blockElementsByPhrases();
        // Only after filtering, check for forbidden selector content!
        if (monitorSelectorsAndRedirect()) return;
        // Set underlying page to white before removing overlay (prevents "flash")
        document.documentElement.style.background = '#fff';
        document.body.style.background = '#fff';
        if (!firstFilteringDone && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        firstFilteringDone = true;
    }

    // --- 10. MUTATION OBSERVER (for dynamic results, always keep overlay up if redirect) ---
    function observeAndFilter() {
        let mutationTimeout;
        const observer = new MutationObserver(() => {
            clearTimeout(mutationTimeout);
            mutationTimeout = setTimeout(() => {
                removeBlockedGoogleImageResults();
                blockResults();
                blockUrls();
                blockElementsBySelectors();
                blockElementsByPhrases();
                if (monitorSelectorsAndRedirect()) return;
            }, 18);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- 11. INIT ---
    const init = () => {
        filterAllAndReveal();
        observeAndFilter();
    };

    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', init, { once: true });
        document.addEventListener('readystatechange', function onState() {
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                init();
                document.removeEventListener('readystatechange', onState);
            }
        });
    } else {
        init();
    }
})();