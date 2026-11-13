(function () {
    'use strict';

    // SHARED Reddit + Arctic Shift matching rules. One list, no duplicated
    // keyword definitions and no alternate AI-term exceptions.
    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro", "r/AlexaBliss", "r/AlexaPearl", "r/comfyui", "r/grok", "r/artificialintelligence", "r/AI", "r/WrestlingBotches"
    ];

    const explicitBlockedSubredditSearchPatterns = adultSubreddits.map(sub => {
        const name = sub.replace(/^r\//i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(?:^|[^a-z0-9_])(?:r/)?' + name + '(?=$|[^a-z0-9_])', 'i');
    });


    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, 
	/Alexa/i, /Blis/i, /Keibler/i, /morph/i, /inpaint/i, /art intel/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /soulgen/i, /ismartta/i,
	/image enhancing/i, /Stacy/i, /Staci/i, /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /photo AI/i, 
	/nudecrawler/i, /pict AI/i, /Del Ray/i, /enhanced image/i, /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /Opera GX/i, /Perez/i, 
	/unc1oth/i, /Mickie/i, /Micky/i, /Brows/i, /pics app/i, /ed17/i, /Lana Perry/i, /Del Rey/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /eras cloth/i, 
	/La Premare/i, /GenHey/i, /arxiv/i, /Bella/i, /Tiffy/i, /CJ Lana/i, /Tiffa/i, /Strat/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /Brit Bake/i, /vega/i, 
	/TOR-Selain/i, /3dit/i, /ed1t/i, /Liv org/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /editing/i, /3d1t/i, /3d!7/i, /nofap/i, /TOR-browser/i, /Feikki/i, 
	/MS Edge/i, /AI Tool/i, /aitool/i, /Valtez/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /Chel5/i, /Steph/i, /St3ph/i, /editation/i, /penetration/i, /Paig3/i, /P4ige/i, /pa1g/i, 
	/pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /Lana Del Rey/i, /\bLana\b/i, /image app/i, /edi7/i, /syvavaarennos/i, /boy friend/i, /pic app/i, /Opera/i,  
	/Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /picture app/i, /edit app/i, /photo app/i, 
	/P4IG3/i, /syvävääre/i, /uncensor app/i, /clothes remover/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /AI fantasy/i, 
	/Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synth/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /photo trick/i,
	/Nicki/i, /Minaj/i, /Taylor/i,  /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /Derriere/i, /Stratusfaction/i, /face plus/i, /lexi/i,
	/homo/i, /transu/i, /5yvä/i, /face\+/i, /face+/i, /face\-/i, /bg remover/i, /Elayna/i, /Eleyna/i, /Eliyna/i, /Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elyina/i, 
	/Elina/i, /Elyna/i, /Aikusviihde/i, /Aikus viihde/i, /La Primare/i, /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i, 
	/fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, /twat/i, /topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, 
	/softorbit/i, /softorbits/i, /VMWare/i, /soft-orbit/i, /soft-orbits/i, /VM Ware/i, /Virtual Machine/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /hypervisor/i, 
	/Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper v/i, /hyperv/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /\*/i,
	/virtualworkstation/i, /virtuaaliworkstation/i, /hyper-v/i, /hyper visor/i,  /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /vrbox/i, /vibox/i, /virbox virtual/i, 
	/virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, /Cathy/i,  /virtmachine/i, /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, 
	/vir-machine/i, /vir machine/i, /virt machine/i, /v-machine/i, /Kathy/i, /virt-machine/i, /virtumachine/i, /vir mach/i, /virtu-machine/i, /virtu machine/i, /virtuamachine/i, 
	/virtua-machine/i, /virtua machine/i, /vi mach/i, /virtual machi/i, /virtuaali masiina/i, /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, 
	/virt mac/i, /virtu mac/i, /virtua mac/i, /virtuaalimasiina/i, /Katherine/i, /Kazuki/i, /Yoshiko/i, /Yoshihiko/i, /Hirata/i, /birppis/i, /irpp4/i, /b1rppis/i, /birpp1s/i, 
	/b1rpp1s/i, /comfyui/i, /Lily Adam/i, /Lilly Adam/i, /Dualipa/i, /comfy ui/i, /comfy ai/i, /comfyai/i, /comfy-ui/i, /comfy-ai/i, /Becky/i, /Becki/i, /Rebecca/i, /Amber Heard/i, 
	/mid journey/i, /unstable diffusion/i, /Dua Lipa/i, /Jasmin/i, /ElonMusk/i, /stablediffused/i, /Hirada/i, /Mizubi/i, /Mizupi/i, /Mizuki/i, /Watanabe/i, /Watanaba/i, /Wakana/i, 
	/Kana Urai/i, /Uehara/i, /Sherilyn/i, /jazmyn/i, /Jazmin/i, /Jasmyn/i, /Primera/i, /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /rasikangas/i, /rasikannas/i, /cargil/i, 
	/cargirl/i, /Lisa Varon/i, /Elon Musk/i, /Marie Varon/i, /gargirl/i, /garcirl/i, /barlow/i, /Nikki/i, /HeyGen/i, /cargril/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, 
	/Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /gargril/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, /Alici/i, /headgen/i, /head gen/i, /genhead/i, 
	/Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /Nia Jax/i, /McQueen/i, /Kasie Cay/i, /Mafiaprinsessa/i, 
	/mangoanimat/i, /photo jiggle/i, /animat pic/i, /animat pho/i, /ai-app/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /ai twerk/i, /twerk ai/i, /img animat/i, 
	/ima animat/i, /photo animat/i, /image animat/i, /make pic mov/i, /make pho mov/i, /make img mov/i, /make ima mov/i, /gif pic/i, /gif pho/i, /gif img/i, /gif ima/i, /photo to gif/i, 
	/image to gif/i, /pic to gif/i, /pic to vid/i, /photo to video/i, /image to video/i, /ph0t/i, /pho7/i, /ph07/i, /1m4g/i, /im4g/i, /!mag/i, /!m4g/i, /!mg/i, /v1d3/i, /vid3/i, /v1de/i, 
	/vld3/i, /g!f/i, /mangoai/i, /mangoapp/i, /mango-app/i, /mangoanim/i, /mango anim/i, /mango-anim/i, /lantaai/i, /lantaaa/i, /motionai/i, /changemotion/i, /swapmotion/i, /motionsw/i, 
	/motionc/i, /poseAI/i, /AI-/i, /-AI/i, /AIblow/i, /5uck/i, /AIsuck/i, /AI-suck/i, /drool/i, /RemovingAI/i, /bj0b/i, /BJAI/i, /BJ-AI/i, /MouthAI/i, /MouthinAI/i, /MouthingAI/i, 
	/AIMouth/i, /BlowAI/i, /BlowsAI/i, /BlowingAI/i, /JobAI/i, /AIJob/i, /ZuckCock/i, /ZuckC/i, /AroundHer/i, /ZuckP/i, /Zuckz/i, /Zucks/i, /Zuzkc/i, /YouZuck/i, /ZuckYou/i, /AIZuck/i, 
	/ZuckAI/i, /M0u7h/i, /ZuckD/i, /AISucc/i, /SuccAI/i, /FapAI/i, /HerAi/i, /AiHer/i, /SheAi/i, /AIShe/i, /AroundAI/i, /AIFap/i, /AIHug/i, /HugAI/i, /AIOut/i, /AIAdult/i, /AIContent/i, 
	/AdultAI/i, /ContentAI/i, /AIMake/i, /AICreate/i, /CreateAI/i, /AICreating/i, /CreatingAI/i, /AICreation/i, /CreationAI/i, /MakeAI/i, /AIMaking/i, /MakingAI/i, /OutAI/i, /t0ol/i, 
	/AIStuff/i, /StuffAI/i, /to0l/i, /t00l/i, /70ol/i, /7o0l/i, /700l/i, /FindAI/i, /FinderAI/i, /FindingAI/i, /AIFind/i, /DirectoryAI/i, /AIDirect/i, /AILook/i, /LookAI/i, /LooksAI/i, 
	/LookupAI/i, /Look-upAI/i, /LookingUpAI/i, /UpLookAI/i, /AIUpLook/i, /ButtAPP/i, /DrawingsAI/i, /AIAPP/i, /AssAI/i, /AIAss/i, /AssAPP/i, /AppAss/i, /BoobysAI/i, /AITit/i, /TitAI/i, 
	/BoobiesAI/i, /TitsAI/i, /AIBoob/i, /BoobAI/i, /BoobsAI/i, /BoobieAI/i, /BoobyAI/i, /APPAI/i, /AISketch/i, /SketchAI/i, /AIDraw/i, /AIDrew/i, /DrawAI/i, /DrewAI/i, /DrawsAI/i, 
	/DrawingAI/i, /PaintingAI/i, /PaintingsAI/i, /PaintAI/i, /depn/i, /d3pn/i, /deppn/i, /depenu/i, /depeni/i, /d3ppn/i, /d3penu/i, /d3p3nu/i, /dep3nu/i, /d3peni/i, /d3p3ni/i, /d3p3n1/i, 
	/d3p3n!/i, /dep3n1/i, /dep3n!/i, /d3pen1/i, /d3pen!/i, /p05/i, /po5/i, /p0s/i, /postur/i, /iconicto/i, /diepn/i, /artif/i, /artin/i, /-tool/i, /deipn/i, /Claude/i, /Anthropic/i,
	/Grok-AI/i, /TwitterAI/i, /Anthr/i, /Antro/i, /s0ftw/i, /softw/i, /w4re/i, /war3/i, /w4r3/i, /p41n/i, /pa1n/i, /p4in/i, /ndif/i, /ndfy/i, /bliswwe/i, /nd!f/i, /ndlf/i, /Kairi/i, 
	/vaat.*pois/i, /vaatteet pois/i,/edgye/i, /bl15s/i, /bl1s5/i, /bl155/i, /bl1ss/i, /bli55/i, /anusaukko/i, /anus-aukko/i, /anus aukko/i, /pers aukko/i, /nd1f/i, /Redmond/i, /Jackie/i, 
	/Kiana/i,  /Jiana/i, /Kairi Sane/i, /Kairi's/i, /Kairii/i, /Kendal Grey/i, /Kayla/i, /Braxton/i, /alex4/i, /Samantha/i, /Samantha Irvin/i, /Samantha Irwin/i, /4lexa/i, /al3xa/i, 
	/alex4/i, /4l3xa/i, /al3x4/i, /4l3x4/i, /4lex4/i, /blis5/i, /bli5s/i, /artintel/i, /artifi intel/i, /ardrob/i, /wardrobe/i, /robe malfunc/i, /ring gear malfunc/i, /ring malfunc/i, 
	/solrvca/i, /billieeilish/i, /billie eilish/i, /ivynile/i, /Ivy Nile/, /UnderRatedLadies/i, /Ivy+Nile/i, /SkylarRaye/i, /Serrano/i, /Zerrano/i, /windsor/i, /winds0r/i, /w1nds0r/i, 
	/w1ndsor/i, /Vince Russo/i, /Xia Li/i, /Dave Meltzer/i, /nudify/i, /nudifier/i, /nudifying/i, /Jessika Carr/i, /undressify/i, /getdisciplined/i, /Toni Storm/i, /Britt Baker/i, 
	/Skye Blue/i, /Carmella/i, /Mariah May/i, /Harley/i, /Hayter/i, /Cameron/i, /Ripley/i, /Rhea Ripley/i, /Blake/i, /transv/i, /transvestite/i, /queer/i, /undressing/i, /undressifying/i, 
	/LGBTQ/i, /Pride/i, /Jessica Carr/i, /Jessika Karr/i, /Jessika/i, /Jessica Karr/i, /camgirl/i, /onlyfans/i, /Jessica WWE/i, /Tiffany Stratton/i, /Lillian/i, /Garcia/i, /Jordynne/i, 
	/Trish/i, /Stratus/i, /DeepSeek AI/i, /ai app/i, /nudyi/i, /fantime/i, /fansly/i, /justforfans/i, /patreon/i, /CJ Perry/i, /manyvids/i, /chaturbate/i, /myfreecams/i, /stripchat/i,
	/camsoda/i, /bongacams/i, /Mandy Rose/i, /Chelsea Green/i, /Liv Xoxo/i, /livejasmin/i, /Chelsea/i, /Piper Niven/i, /Hardwell/i, /5 feet of fury/i, /bliss/i, /alexa bliss/i, /venice/i, 
	/Morgan Xoxo/i, /Tiffy time/i, /Stratton/i, /Tiffany/i, /Zelina/i, /Zelina Vega/i, /Valhalla/i, /Sportskeeda/i, /IYO SKY/i, /Io Shirai/i, /Iyo Shirai/i, /IO SKY/i, /Asuka/i, /Meiko/i, 
	/Dakota Kai/i, /Satomura/i, /Kelly Kelly/i, /Dynamite/i, /Shayna Baszler/i, /Ronda Rousey/i, /Dana Brooke/i, /Alicia Fox/i, /Summer Rae/i, /Microsoft Edge/i, /jizzed/i, /Torrie/i, 
	/Sasha/i, /Layla/i, /Michelle McCool/i, /Eve Torres/i, /Melina/i, /Melina wrestler/i, /Jillian Hall/i, /five feet of fury/i, /raepd/i, /Wilson/i, /Mickie James/i, /Maria/i, /Kanellis/i, 
	/Beth Phoenix/i, /Victoria/i, /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i, /Rampaige/i, /Madison Rayne/i, /Velvet Sky/i, /Jamie Hayter/i, /Saraya/i, /filmora/i, /wondershare/i, /Havok/i, 
	/Tessmacher/i, /Su Yung/i, /Miko Satomura/i, /Mercedes/i, /Valkyrie/i, /Deonna/i, /Purrazzo/i, /Vaquer/i, /Vaqueer/i, /Vaguer/i, /Vagueer/i, /Tamina/i, /Anna Jay/i, /Tay Conti/i, /No nut/i,
	/Tay Melo/i, /Nightingale/i, /Statlander/i, /Hikaru Shida/i, /Tessa/i, /Sakazaki/i, /Nyla Rose/i, /Emi Sakura/i, /Fatal Influence/i, /Aubert/i, /Brooke/i, /Hikaru/i, /aivideo/i, /Penelope/i, 
	/Roxanne/i, /Shotzi/i, /Blackheart/i, /Tegan/i, /Charlotte/i, /Kamifuku/i, /Sarray/i, /OperaGX/i, /Sky Wrestling/i, /Becky Lynch/i, /Bayley/i, /Bailey/i, /Giulia/i, /Michin/i, /nofap/i, 
	/Mia Yim/i, /AJ Lee/i, /Paige/i, /Bianca/i, /Belair/i,  /Liv Morgan/i, /stephanie/i, /Thekla/i, /Jordynne Grace/i, /NXT Womens/i, /Alicia/i, /Atout/i, /NXT Women/i, /NXT Woman/i, /Aubrey/i, 
	/Edwards/i, /Renee/i, /Maryse/i, /Sasha Banks/i, /Jackson/i, /Jakara/i,  /Lash Legend/i, /Izzi Dame/i, /Alba Fyre/i, /Isla Dawn/i, /Sydney/i, /Gina Adams/i, /Kelly2/i, /Russo/i, /Scarlett/i, 
	/Raquel Rodriguez/i, /Bordeaux/i, /Kayden/i, /Katana Chance/i,  /Carter/i, /Valkyria/i, /Tamina Snuka/i, /Renee Young/i, /Priscilla/i, /Cathalina/i, /Roxanne Perez/i, /Indi Hartwell/i, 
	/Hartwell/i, /Karmen/i, /Davenport/i, /wonder share/i, /Lola Vice/i, /Maxxine Dupri/i, /Karmen Petrovic/i, /Brittany/i, /Renee Paquette/i, /Ava Raine/i, /Cora Jade/i, /Jacy Jayne/i, 
	/Gigi Dolin/i, /Thea Hail/i, /Tatum/i, /Paxley/i, /Fallon Henley/i, /Sky wrestle/i, /Kelani Jordan/i, /Blair/i, /venoisi/i, /Electra/i, /Wendy Choo/i, /Yulisa/i, /Valentina/i, /Valentine/i, 
	/Amari Miller/i, /venoise/i, /AlexaBliss/i, /Sol Ruca/i, /AlexaPearl/i, /Arianna/i, /Natalya/i, /Nattie/i, /Diffusion/i, /StableDiffusion/i, /UnStableDiffusion/i, /Dreambooth/i, /Dream booth/i, 
	/AI generated/i, /AI-generated/i, /generated/i, /machine learning/i, /artificial intelligence/i, /AI girl/i, /neural network/i, /deep learning/i, /Naomi/i, /Jazmyn Nyx/i, /stable diffusion/i, 
	/artificial/i, /synthetic/i, /computer generated/i, /algorithm/i, /Angelina/i, /automated/i, /editor/i, /text to image/i, /image enhanced/i, /Answers BETA/i, /ai video/i, /Belts Mone/i, /Shir/i,
	/Irving/i, /Amanda Huber/i, /Ivy Nile/i, /kawa/i, /perver/i, /Mariah/i, /Kairi/i,


   // Boundaried Regexes
    	/\bAmber\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /\blexi\b/i, /\bButt\b/i, /\bsexy\b/i, /\bKarr\b/i, /\bMina\b/i, /\bTisu\b/i, /\bTisut\b/i, /\bRinnat\b/i, /\bXoxo\b/i, /\bLGBT\b/i, /\bJazz\b/i, /\bKaina\b/i, 
	/\bZoey\b/i, /\bKairi\b/i, /\bxAI\b/i,/\b50ft\b/i, /\bVidu\b/i, /\bJade\b/i, /\bmotion\b/i, /\bMachaine\b/i, /\bNyx\b/i, /\bMachiine\b/i, /\bLily\b/i, /\bMacheine\b/i, /\bLili\b/i, /\bAnt\b/i, /\bAva\b/i, 
	/\bNox\b/i, /\bFuku\b/i, /\bAnswers BETA\b/i, /\bCarr\b/i, /\bTaya\b/i, /\bMachiene\b/i, /\bcam4\b/i, /\bGrok\b/i, /\bVM\b/i, /\bVMs\b/i, /\bTegan\b/i, /\bS0ft\b/i, /\bVMs\b/i, /\bRape\b/i, /\bEmma\b/i, 
	/\bNiven\b/i,  /\bB-Fab\b/i, /\bB-Fab\b/i, /\bVM\b/i, /\bJaida\b/i, /\bSeksi\b/i, /\bRiho\b/i, /\bIzzi\b/i, /\bbra\b/i, /\bSlut\b/i, /\bTor\b/i,  /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bLita\b/i,
	/\bJaida\b/i, /\bedit\b/i, /\bADMX\b/i, /\bSol\b/i, /\bAi-\b/i, /\bGina\b/i, /\bLiv\b/i, /\bDame\b/i, /\bTay\b/i, /\bIndi\b/i,


   // Nuclear/special regexes
/gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img)))|(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|denois(?:e|er|ing)?)(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img))?(?:[\s_\-\/.]{0,3}gr[a4][i1l]n)|gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic|image|img))|(?:ph(?:o|0)?t(?:o|0)?|pic|image|img)(?:[\s_\-\/.]{0,3}fix)/i, /lex.*bl/i, /liv.*morgan/i, /saad.*pipar/i, /s4ad.*pipar/i, /s44d.*pipar/i, /sa4d.*pipar/i, /rint.*pois/i, /dress.*remov/i,
        /(?:n(?:o|0)ise(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?))|(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?)(?:[\s_\-\/.]{0,3})n(?:o|0)ise|de[\s_\-\.]?n(?:o|0)is(?:e|er|ing)?)/i, /make.*(move|gif|video)/i, /photo.*(move|gif|video)/i, /image.*(move|gif|video)/i, /pic.*(move|gif|video)/i, /img.*(move|gif|video)/i, /booty/i, /ass.*(animat|ai|move)/i, /twerk/i, /twerking/i, /jiggle/i, /bounce.*(ai|gif)/i, /booty.*(ai|gif|video|animat)/i, /ass.*(ai|gif|video|animat)/i, /undress/i, /strip.*ai/i, /nude.*ai/i, /clothes.*remove/i, /remove.*(clothes|clothing|dress)/i, /face.*(swap|deepfake|replace)/i, /hous.*pois/i, /pait.*pois/i, /liiv.*pois/i, /alushous.*pois/i, /alkkarit.*pois/i, /alusvaat.*pois/i, /clothing.*remove/i, /\bra\*e\b/i,/\br\*pe\b/i, /\*ape/i, /rap\*/i, /0rga\$m/i,
/alexa.*(wwe|wrest|ras|NXT|pro)/i, /blis.*(wwe|wrest|ras|NXT|pro)/i, /lexa.*(wwe|wrest|ras|NXT|pro)/i, /lexi.*(wwe|wrest|ras|NXT|pro)/i, /bils.*(wwe|wrest|ras|NXT|pro)/i, /lex.*(kauf|cabr|carb)/i, /model.*(mach|langu)/i, /robe.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin)/i,
/robe.*(malf|func)/i, /ring gear|trunk|pant|shirt|jacket.*(malf|func)/i, /malfunc.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin|ring)/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i,  /\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /see[- ]?through/i, /AI[ -]?generated/i, /generated[ -]?by[ -]?AI/i, /artificial[ -]?intelligence/i, /machine[ -]?learning/i, /neural[ -]?network/i, /deep[ -]?learning/i, /midjourney/i, /dall[ -]?e/i, /stable[ -]?diffusion/i, /computer[ -]?generated/i, /text[ -]?to[ -]?image/i, /image[ -]?generation/i, /AI[ -]?art/i, /synthetic[ -]?media/i, /algorithmically/i, /bot[ -]?generated/i, /automated[ -]?content/i,

    ];


    // v29.5.0: One authoritative regex list, with a compiled fast lane for simple
    // literals. Complex regexes (boundaries, lookarounds, wildcards, etc.) are
    // executed unchanged; no keywords are removed or given different semantics.
    // Rebuild when the existing dynamic wrestler-name feature extends the list.
    // Ordinary adult-language matches must not erase otherwise acceptable
    // posts, comments, communities or search results outside the home feed.
    // Keep the original patterns above for the strictly filtered front page.
    // Specific people, AI/deepfake terms and premium-content services remain
    // blocked by the rest of the original list everywhere outside post pages.
    const ordinaryAdultKeywordSources = new Set([
        '/nudi/i', '/nude/i', '/dress/i', '/tush/i', '/erotic/i',
        '/penetration/i', '/booty/i', '/twerk/i', '/twerking/i', '/jiggle/i',
        '/twat/i', '/jizzed/i', '/\\bsexy\\b/i', '/\\bSlut\\b/i',
        '/\\bbra\\b/i', '/\\*/i'
    ]);

    const premiumAdultHosts = [
        'onlyfans.com', 'fansly.com', 'fanvue.com', 'justforfans.com',
        'fantime.com', 'fanstopia.com', 'fancentro.com', 'manyvids.com',
        'chaturbate.com', 'myfreecams.com', 'stripchat.com', 'camsoda.com',
        'bongacams.com', 'livejasmin.com', 'patreon.com'
    ];
    const premiumAdultTextPattern = /\b(?:only[\s._-]*fans|fansly|fanvue|just[\s._-]*for[\s._-]*fans|fantime|fans[\s._-]*topia|fancentro|manyvids|chaturbate|myfreecams|stripchat|camsoda|bongacams|livejasmin|patreon)\b/i;

    function mentionsPremiumAdultPlatform(text) {
        return !!text && premiumAdultTextPattern.test(String(text).slice(0, 16000));
    }

    function isPremiumAdultLink(anchor) {
        if (!anchor?.getAttribute) return false;
        const href = anchor.getAttribute('href') || '';
        if (mentionsPremiumAdultPlatform(href) || mentionsPremiumAdultPlatform(anchor.textContent) ||
            mentionsPremiumAdultPlatform(anchor.getAttribute('aria-label')) ||
            mentionsPremiumAdultPlatform(anchor.getAttribute('title'))) return true;
        try {
            const hostname = new URL(href, location.href).hostname.toLowerCase();
            return premiumAdultHosts.some(domain => hostname === domain || hostname.endsWith('.' + domain));
        } catch { return false; }
    }

    function screenPremiumAdultLinks(root = document) {
        const links = [];
        if (root.matches?.('a[href]')) links.push(root);
        if (root.querySelectorAll) links.push(...root.querySelectorAll('a[href]'));
        for (const link of links) {
            const shouldHide = isPremiumAdultLink(link);
            if (shouldHide) {
                if (!link.classList.contains('nr-premium-link-hidden')) {
                    link.classList.add('nr-premium-link-hidden');
                    link.style.setProperty('display', 'none', 'important');
                }
            } else if (link.classList.contains('nr-premium-link-hidden')) {
                link.classList.remove('nr-premium-link-hidden');
                if (link.style.getPropertyValue('display') === 'none' &&
                    link.style.getPropertyPriority('display') === 'important') {
                    link.style.removeProperty('display');
                }
            }
        }
    }

    let redditCompiledRegexCountV295 = -1;
    let redditLiteralRegexGroupsV295 = [];
    let redditComplexRegexesV295 = [];
    let redditAdultLiteralRegexGroupsV295 = [];
    let redditAdultComplexRegexesV295 = [];

    function rebuildRedditRegexMatcherV295() {
        const literals = [];
        const complex = [];
        const adultLiterals = [];
        const adultComplex = [];
        for (const expression of regexKeywordsToHide) {
            // Only combine pure, case-insensitive literal RegExp sources. Do not
            // reinterpret regex syntax, flags or matching order within a pattern.
            if (expression instanceof RegExp && expression.flags === 'i' &&
                !/[.*+?^${}()|[\]\\]/.test(expression.source)) {
                literals.push(expression.source);
                if (!ordinaryAdultKeywordSources.has(expression.toString())) adultLiterals.push(expression.source);
            } else {
                complex.push(expression);
                if (!ordinaryAdultKeywordSources.has(expression.toString())) adultComplex.push(expression);
            }
        }
        // Small alternation groups avoid an excessively large compiled regex.
        const compileGroups = values => {
            const groups = [];
            for (let i = 0; i < values.length; i += 96) {
                groups.push(new RegExp('(?:' + values.slice(i, i + 96).join('|') + ')', 'i'));
            }
            return groups;
        };
        redditLiteralRegexGroupsV295 = compileGroups(literals);
        redditComplexRegexesV295 = complex;
        redditAdultLiteralRegexGroupsV295 = compileGroups(adultLiterals);
        redditAdultComplexRegexesV295 = adultComplex;
        redditCompiledRegexCountV295 = regexKeywordsToHide.length;
    }

    function isBlockedByRedditRegexesV295(text, allowOrdinaryAdultWords = false) {
        if (!text) return false;
        if (redditCompiledRegexCountV295 !== regexKeywordsToHide.length) {
            rebuildRedditRegexMatcherV295();
        }
        const literals = allowOrdinaryAdultWords ? redditAdultLiteralRegexGroupsV295 : redditLiteralRegexGroupsV295;
        const complex = allowOrdinaryAdultWords ? redditAdultComplexRegexesV295 : redditComplexRegexesV295;
        for (const group of literals) {
            if (group.test(text)) return true;
        }
        for (const expression of complex) {
            if (expression.test(text)) return true;
        }
        return false;
    }

    function isSafeAcronymSuffix(word) {
        const safeAiWords = ['samurai', 'bonsai', 'mumbai', 'thai', 'dubai', 'shanghai', 'hawaii', 'chai', 'sinai', 'kawaii', 'hentai', 'senpai'];
        for (let i=0; i<safeAiWords.length; i++) {
            if (word.endsWith(safeAiWords[i])) return true;
        }
        return false;
    }

    function isSearchTextBanned(text) {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        const strippedText = lowerText.replace(/[^a-zäöå\s]/g, ' ').replace(/\s+/g, ' ').trim();
        
        const textVariants = [lowerText, strippedText];

        for (let t = 0; t < textVariants.length; t++) {
            const textToTest = textVariants[t];
            if (!textToTest) continue;

            if (mentionsPremiumAdultPlatform(textToTest)) return true;
            

            if (explicitBlockedSubredditSearchPatterns.some(pattern => pattern.test(textToTest))) return true;

            if (isBlockedByRedditRegexesV295(textToTest, true)) return true;
            
            const words = textToTest.split(/\s+/);
            const exactMatches = ['ai', 'llm', 'mlm'];
            for (let w = 0; w < words.length; w++) {
                const word = words[w];
                if (!word) continue;
                
                for (let a = 0; a < exactMatches.length; a++) {
                    const ac = exactMatches[a];
                    if (word === ac || (word.endsWith(ac) && !isSafeAcronymSuffix(word))) return true;
                }
                
                if (word.startsWith('ai') && word.length > 2) {
                    const rest = word.substring(2);
                    const badSuffixes = ['video', 'art', 'gen', 'chat', 'bot', 'girl', 'porn', 'xxx'];
                    if (badSuffixes.some(s => rest.startsWith(s))) return true;
                }
            }
        }
        return false;
    }

    function isNameBannedByPrefixSuffix(name) {
        if (!name) return false;
        const lowerName = name.toLowerCase();
        const strippedName = lowerName.replace(/[^a-zäöå]/g, ''); 
        
        const variants = [lowerName, strippedName];
        
        for (let t=0; t<variants.length; t++) {
            const textToTest = variants[t];
            if (!textToTest) continue;
            

            const exactMatches = ['ai', 'llm', 'mlm'];
            for (let i = 0; i < exactMatches.length; i++) {
                const acronym = exactMatches[i];
                if (textToTest === acronym || (textToTest.endsWith(acronym) && !isSafeAcronymSuffix(textToTest))) return true;
            }
            
            if (textToTest.startsWith('ai') && textToTest.length > 2) {
                const rest = textToTest.substring(2);
                const badSuffixes = ['video', 'art', 'gen', 'chat', 'bot', 'girl', 'porn', 'xxx'];
                if (badSuffixes.some(s => rest.startsWith(s))) return true;
            }
            
            if (mentionsPremiumAdultPlatform(textToTest) || isBlockedByRedditRegexesV295(textToTest, true)) return true;
        }
        return false;
    }

        // Existing final name block applies on BOTH supported sites.
    try { regexKeywordsToHide.push(/Lisa Mar(?:ie|ia) Varon/i); } catch {}

    // === Arctic Shift: same reddit.js and blocklists, separate site-specific DOM ===
    // This is deliberately isolated from the Reddit-side hooks/observers. No
    // Reddit nav logic, page-world shadow patches, or Reddit-only redirects run
    // on arctic-shift.photon-reddit.com.
    function installArcticShiftFiltering() {
        if (window.__nrArcticShiftFilterInstalled) return;
        const ROOT = document.documentElement;
        if (!ROOT) {
            // Defensive document_start fallback: do not mark the filter booted
            // before there is an html node to own its prehide stylesheet.
            document.addEventListener('readystatechange', installArcticShiftFiltering, { once: true });
            return;
        }
        window.__nrArcticShiftFilterInstalled = true;
        ROOT.classList.add('nr-as-active');
        let redirecting = false;
        let scheduled = false;
        let lastUrl = location.href;
        // Arctic Shift search interception is submit-only. Never redirect for
        // a partially typed term or a URL already present on page load.

        // Applied at document_start: Svelte posts and comment bodies stay
        // invisible before the first inspection, including lazy loaded cards.
        const style = document.createElement('style');
        style.id = 'nr-as-filter-prehide';
        style.textContent = `
            a.nr-premium-link-hidden,
            a[href*="onlyfans" i], a[href*="fansly" i],
            a[href*="fanvue" i], a[href*="justforfans" i],
            a[href*="fantime" i], a[href*="fanstopia" i],
            a[href*="fancentro" i], a[href*="manyvids" i],
            a[href*="chaturbate" i], a[href*="myfreecams" i],
            a[href*="stripchat" i], a[href*="camsoda" i],
            a[href*="bongacams" i], a[href*="livejasmin" i],
            a[href*="patreon.com" i] {
                display: none !important;
            }
            html.nr-as-active .reddit-thread > .post-container:not(.nr-as-approved),
            html.nr-as-active .reddit-thread > .post-container.nr-as-banned,
            html.nr-as-active .comment-node:not(.nr-as-approved),
            html.nr-as-active .comment-node.nr-as-banned {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            html.nr-as-active.nr-as-redirecting .reddit-thread,
            html.nr-as-active .nr-as-banned {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        (document.head || ROOT).appendChild(style);

        const targets = 'input[type="text"], input[type="search"], input:not([type])';
        const fieldNames = new Set(['author', 'subreddit', 'title', 'selftext', 'url', 'ids', 'q', 'query']);
        const textBlocked = value => {
            const text = String(value || '').trim().slice(0, 12000);
            return !!text && isSearchTextBanned(text);
        };
        function subredditBlocked(value) {
            const name = String(value || '').trim().replace(/^r\//i, '');
            if (!name) return false;
            return adultSubreddits.some(sub => sub.replace(/^r\//i, '').toLowerCase() === name.toLowerCase()) ||
                isNameBannedByPrefixSuffix(name) || textBlocked(name);
        }
        function authorBlocked(value) {
            const name = String(value || '').trim().replace(/^(?:u|user)\//i, '');
            return !!name && (isNameBannedByPrefixSuffix(name) || textBlocked(name));
        }
        function fieldBlocked(kind, value) {
            if (!value) return false;
            if (kind === 'subreddit') return subredditBlocked(value);
            if (kind === 'author') return authorBlocked(value);
            return textBlocked(value);
        }
        function kindForInput(input) {
            if (!input || !input.matches?.(targets)) return null;
            const label = input.closest('label');
            const displayLabel = label?.querySelector('.label')?.textContent?.trim().toLowerCase() || '';
            if (/^subreddit\b/.test(displayLabel)) return 'subreddit';
            if (/^author\b/.test(displayLabel)) return 'author';
            if (/^title\b/.test(displayLabel)) return 'title';
            if (/^selftext\b/.test(displayLabel)) return 'selftext';
            if (/^url\b/.test(displayLabel)) return 'url';
            if (/ids?\s+or\s+urls?/i.test(input.getAttribute('placeholder') || '')) return 'ids';
            const key = (input.getAttribute('name') || '').toLowerCase();
            return fieldNames.has(key) ? key : null;
        }
        function inputsHaveBannedTerms() {
            for (const input of document.querySelectorAll(targets)) {
                const kind = kindForInput(input);
                if (kind && fieldBlocked(kind, input.value)) return true;
            }
            return false;
        }
        function redirectToPreviousPage() {
            if (redirecting) return;
            redirecting = true;
            ROOT.classList.add('nr-as-redirecting');
            const blockedHref = location.href;
            // A fresh tab cannot go back. Fall back to the actual Arctic
            // Shift search homepage rather than the archive domain root.
            if (history.length > 1) {
                history.back();
                setTimeout(() => {
                    if (location.href === blockedHref) location.replace(location.origin + '/search');
                }, 750);
            } else {
                location.replace(location.origin + '/search');
            }
        }
        function setScreened(card, banned) {
            if (banned) {
                card.classList.remove('nr-as-approved');
                card.classList.add('nr-as-banned');
            } else {
                card.classList.remove('nr-as-banned');
                card.classList.add('nr-as-approved');
            }
        }
        function urlValueFrom(anchor) {
            if (!anchor) return '';
            return anchor.getAttribute('href') || '';
        }
        function checkPost(outer) {
            const inner = outer.querySelector(':scope > .post-container') || outer;
            for (const attribute of ['url', 'href', 'content-href', 'domain', 'data-url']) {
                if (mentionsPremiumAdultPlatform(inner.getAttribute(attribute))) return true;
            }
            const header = inner.querySelector(':scope > .header');
            const subreddit = header?.querySelector('a[href*="/r/"]');
            const author = header?.querySelector('a.author-link, a[href*="/u/"], a[href*="/user/"]');
            if (subreddit && subredditBlocked(subreddit.textContent || urlValueFrom(subreddit))) return true;
            if (author && authorBlocked(author.textContent || urlValueFrom(author))) return true;
            const title = inner.querySelector(':scope > .title');
            if (title && textBlocked(title.textContent)) return true;
            // Link target is the post's URL, not the UI's unrelated buttons.
            for (const link of inner.querySelectorAll(':scope > .url-row a')) {
                if (isPremiumAdultLink(link) || textBlocked(urlValueFrom(link)) || textBlocked(link.textContent)) return true;
            }
            // Selftext / markdown, if supplied by the archive's result layout.
            for (const body of inner.querySelectorAll(':scope > .selftext, :scope > .body, :scope > .md, :scope > .text, :scope > .markdown, :scope > .long-text')) {
                if (textBlocked(body.textContent)) return true;
            }
            return false;
        }
        function checkComment(node) {
            const main = node.querySelector(':scope > .comment-main');
            const content = main?.querySelector(':scope > .comment-content');
            if (!content) return false;
            const header = content.querySelector(':scope > .header');
            const subreddit = header?.querySelector('a[href*="/r/"]');
            const author = header?.querySelector('a.author-link, a[href*="/u/"], a[href*="/user/"]');
            if (subreddit && subredditBlocked(subreddit.textContent || urlValueFrom(subreddit))) return true;
            if (author && authorBlocked(author.textContent || urlValueFrom(author))) return true;
            const body = content.querySelector(':scope > .body');
            if (body && textBlocked(body.textContent)) return true;
            return false;
        }
        function scan() {
            if (redirecting) return;
            if (location.href !== lastUrl) lastUrl = location.href;
            screenPremiumAdultLinks(ROOT);
            // Do not reject ordinary adult topics just for being NSFW. Explicit
            // banned names, subreddits and regex terms still apply everywhere.
            for (const outer of document.querySelectorAll('.reddit-thread > .post-container')) {
                setScreened(outer, checkPost(outer));
            }
            // Screen comments independently of posts, so a single rejected
            // comment cannot blank an otherwise acceptable post or its siblings.
            for (const comment of document.querySelectorAll('.comment-node')) {
                setScreened(comment, checkComment(comment));
            }
        }
        function scheduleScan() {
            if (scheduled || redirecting) return;
            scheduled = true;
            queueMicrotask(() => {
                scheduled = false;
                scan();
            });
        }
        function blockSubmittedSearch(event) {
            if (!inputsHaveBannedTerms()) return false;
            event.preventDefault();
            event.stopImmediatePropagation();
            redirectToPreviousPage();
            return true;
        }
        function isArcticSearchButton(button) {
            return !!button && button.matches?.('button.submit-button, button[type="submit"]') &&
                /^search$/i.test((button.textContent || '').trim());
        }
        // Svelte can handle the Search button's click without dispatching a
        // native form submit. Capture the click before its own handler runs.
        document.addEventListener('click', event => {
            const button = event.target?.closest?.('button');
            if (!isArcticSearchButton(button)) return;
            blockSubmittedSearch(event);
        }, true);
        // Native form submissions (including keyboard Enter) are guarded too.
        // No input/change listeners: editing a field NEVER causes navigation.
        document.addEventListener('submit', event => {
            const form = event.target;
            if (!form?.querySelector?.('button.submit-button, button[type="submit"]')) return;
            blockSubmittedSearch(event);
        }, true);
        const watcher = new MutationObserver(scheduleScan);
        watcher.observe(ROOT, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ['href', 'value', 'title', 'alt']
        });
        window.addEventListener('popstate', scheduleScan, true);
        window.addEventListener('pageshow', scheduleScan, true);
        // Svelte may push/replace a URL without mutating visible DOM.
        const urlPoll = setInterval(() => {
            if (location.href !== lastUrl) scheduleScan();
        }, 450);
        window.addEventListener('pagehide', () => {
            clearInterval(urlPoll);
            watcher.disconnect();
        }, { once: true });

        // Preserve the Reddit script's storage-fed additional banned names too.
        try {
            const api = typeof chrome !== 'undefined' ? chrome :
                (typeof browser !== 'undefined' ? browser : null);
            if (api?.storage?.local?.get) {
                api.storage.local.get(['wrestling_women_urls'], result => {
                    if (!Array.isArray(result?.wrestling_women_urls)) return;
                    const existing = new Set(regexKeywordsToHide.map(rx => rx.toString()));
                    for (const item of result.wrestling_women_urls) {
                        const slug = String(item || '').split('/').filter(Boolean).pop()?.toLowerCase() || '';
                        if (!slug || ['aj-lee', 'aj', 'becky-lynch', 'becky'].includes(slug)) continue;
                        const name = slug.replace(/-/g, ' ');
                        for (const form of [name, name.replace(/\s+/g, '')]) {
                            const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp('\\b' + escaped + '\\b', 'i');
                            if (!existing.has(regex.toString())) {
                                regexKeywordsToHide.push(regex);
                                existing.add(regex.toString());
                            }
                        }
                    }
                    scheduleScan();
                });
            }
        } catch (_) {}
        scan();
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
    }

    // Only the Arctic Shift bootstrap runs on the archive. Reddit starts below.
    if (location.hostname.toLowerCase() === 'arctic-shift.photon-reddit.com') {
        installArcticShiftFiltering();
        return;
    }


    // ---- RUNTIME + FIREFOX GUARDS ----
    const IS_FIREFOX = typeof InstallTrigger !== 'undefined' || /\bFirefox\//.test(navigator.userAgent);
    let HEAVY_OBSERVERS_ACTIVE = false;       // track whether main MOs are attached
    let INITIAL_BURST_DONE = false;           // taper aggressive timers after startup
    let PAGE_WORLD_HOOKED = false;            // page-world Answers hook installed flag
    let START_TS = performance.now();
    let isRedirecting = false;                // global flag to prevent redirect loops

    // Enforce hard, no-bypass blocking of all lists (subreddits, strings, regex)
    const STRICT_BLOCKING = true;

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        try { console.log('[REDDIT.JS]', message); } catch {}
    }

    // === Click-through guarantee + author allowlist globals ===
    const WHITELIST_AUTHORS = ['u/NightmaREE3Z', 'NightmaREE3Z', 'u/nightmareee3z', 'nightmareee3z'];
    const APPROVED_SS_KEY = '__nrApprovedPostsV1';
    const APPROVED_LS_KEY = '__nrApprovedPostsV1_ls';
    let CURRENT_POST_ID = null;               
    let ALWAYS_ALLOW_CURRENT_POST = false;    

    function getCurrentPostIdFromUrl() {
        try {
            const m = window.location.href.match(/\/comments\/([a-zA-Z0-9]+)/);
            return m ? `post_${m[1]}` : null;
        } catch { return null; }
    }
    function getApprovedPostsArray() {
        try {
            const ssRaw = sessionStorage.getItem(APPROVED_SS_KEY);
            const lsRaw = localStorage.getItem(APPROVED_LS_KEY);
            const ssArr = ssRaw ? JSON.parse(ssRaw) : [];
            const lsArr = lsRaw ? JSON.parse(lsRaw) : [];
            const set = new Set();
            if (Array.isArray(ssArr)) { for (let i = 0; i < ssArr.length; i++) set.add(ssArr[i]); }
            if (Array.isArray(lsArr)) { for (let i = 0; i < lsArr.length; i++) set.add(lsArr[i]); }
            return Array.from(set);
        } catch { return []; }
    }
    function setApprovedPostsArray(arr) {
        try {
            const safeArr = Array.isArray(arr) ? arr : [];
            const json = JSON.stringify(safeArr);
            try { sessionStorage.setItem(APPROVED_SS_KEY, json); } catch {}
            try { localStorage.setItem(APPROVED_LS_KEY, json); } catch {}
        } catch {}
    }
    function getApprovedPostIdsFromSession() {
        return new Set(getApprovedPostsArray());
    }
    function rememberApprovedPostId(id) {
        if (!id) return;
        const canonical = /^post_[a-zA-Z0-9]+$/.test(String(id));
        if (!canonical) return;
        const arr = getApprovedPostsArray();
        // Already remembered IDs require no storage writes. Reading and
        // rewriting both storage areas for every feed approval causes jank.
        if (arr.includes(id)) return;
        arr.push(id);
        if (arr.length > 100) arr.splice(0, arr.length - 100);
        setApprovedPostsArray(arr);
    }
    function isWhitelistedAuthorName(name) {
        if (!name) return false;
        const n = String(name).trim().replace(/^u\//i, '').toLowerCase();
        return WHITELIST_AUTHORS.some(a => a.replace(/^u\//i, '').toLowerCase() === n);
    }
    function getAuthorFromElement(el) {
        try {
            const attrAuthor = (el.getAttribute && (el.getAttribute('author') || el.getAttribute('data-author') || el.getAttribute('data-username'))) || '';
            if (attrAuthor) return attrAuthor;

            const sel = el.querySelector && el.querySelector(
                'a[data-testid="post_author_link"], ' +
                'a[href^="/user/"], a[href^="/u/"], ' +
                '[slot="author"] a, faceplate-username, ' +
                '[data-testid="post-author"], ' +
                'a[data-testid="comment_author_link"]'
            );
            if (sel && sel.textContent) return sel.textContent.trim();

            const postEl = el.closest && el.closest('shreddit-post');
            if (postEl) {
                const pAuthor = postEl.getAttribute('author') || postEl.getAttribute('data-author') || '';
                if (pAuthor) return pAuthor;
            }
        } catch {}
        return '';
    }
    function isElementFromWhitelistedAuthor(el) {
        try {
            const name = getAuthorFromElement(el);
            return isWhitelistedAuthorName(name);
        } catch { return false; }
    }
    function isCurrentPageWhitelistedAuthor() {
        try {
            if (!/\/comments\//.test(window.location.href)) return false;
            const el = document.querySelector(
                'a[data-testid="post_author_link"], ' +
                '[data-testid="post-author"], ' +
                'a[href^="/user/"], a[href^="/u/"], ' +
                'shreddit-post'
            );
            if (!el) return false;
            const name = getAuthorFromElement(el);
            return isWhitelistedAuthorName(name);
        } catch { return false; }
    }

    try {
        CURRENT_POST_ID = getCurrentPostIdFromUrl();
        if (CURRENT_POST_ID) {
            const set = getApprovedPostIdsFromSession(); 
            ALWAYS_ALLOW_CURRENT_POST = set.has(CURRENT_POST_ID);
        }
    } catch {}

    function extractCanonicalPostIdFromHref(href) {
        if (!href || typeof href !== 'string') return null;
        try {
            const m = href.match(/\/comments\/([a-zA-Z0-9]+)/);
            return m ? `post_${m[1]}` : null;
        } catch { return null; }
    }
    function tryGetCanonicalPostId(el) {
        if (!el) return null;
        try {
            const dataKsElement = (el.matches?.('[data-ks-id*="t3_"]') ? el : el.querySelector?.('[data-ks-id*="t3_"]'));
            if (dataKsElement) {
                const dataKsId = dataKsElement.getAttribute('data-ks-id') || '';
                const m = dataKsId.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
            }
            const postIdEl = (el.hasAttribute?.('data-post-id') ? el : el.querySelector?.('[data-post-id]'));
            if (postIdEl) {
                const pid = postIdEl.getAttribute('data-post-id');
                if (pid && /^[a-zA-Z0-9]+$/.test(pid)) return `post_${pid}`;
            }
            const postWrapper = el.closest?.('shreddit-post');
            if (postWrapper) {
                const idAttr = postWrapper.getAttribute('id') || '';
                const m = idAttr.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
                const pid2 = postWrapper.getAttribute('data-post-id') || postWrapper.getAttribute('post-id') || '';
                if (pid2 && /^[a-zA-Z0-9]+$/.test(pid2)) return `post_${pid2}`;
            }
            const a = el.querySelector?.('a[href*="/comments/"]');
            if (a) {
                const href = a.getAttribute('href') || '';
                const id = extractCanonicalPostIdFromHref(href);
                if (id) return id;
            }
            const searchTitleId = el.querySelector && el.querySelector('[id^="search-post-title-t3_"]');
            if (searchTitleId && searchTitleId.id) {
                const m = searchTitleId.id.match(/t3_([a-zA-Z0-9]+)/);
                if (m) return `post_${m[1]}`;
            }
            return null;
        } catch { return null; }
    }
    function rememberApprovalByHref(href) {
        const id = extractCanonicalPostIdFromHref(href);
        if (id) {
            rememberApprovedPostId(id);
            devLog(`🧷 Captured approval via click: ${id}`);
        }
    }
    (function installClickThroughCapture() {
        try {
            if (window.__nrClickCaptureInstalled) return;
            window.__nrClickCaptureInstalled = true;
            const capture = (evt) => {
                try {
                    let el = evt.target;
                    const anchor = el?.closest?.('a[href*="/comments/"]');
                    if (anchor) {
                        rememberApprovalByHref(anchor.getAttribute('href') || '');
                        return;
                    }
                    const card = el?.closest?.('article, shreddit-post, [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]');
                    const cid = tryGetCanonicalPostId(card || el);
                    if (cid) rememberApprovedPostId(cid);
                } catch {}
            };
            const keyCapture = (evt) => {
                try {
                    if (evt.key !== 'Enter' && evt.key !== ' ') return;
                    const el = document.activeElement;
                    if (!el) return;
                    const anchor = el.matches?.('a[href*="/comments/"]') ? el : el.closest?.('a[href*="/comments/"]');
                    if (anchor) {
                        rememberApprovalByHref(anchor.getAttribute('href') || '');
                    } else {
                        const card = el.closest?.('article, shreddit-post, [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]');
                        const cid = tryGetCanonicalPostId(card || el);
                        if (cid) rememberApprovedPostId(cid);
                    }
                } catch {}
            };
            document.addEventListener('click', capture, true);
            document.addEventListener('auxclick', capture, true);
            document.addEventListener('mousedown', capture, true);
            document.addEventListener('contextmenu', capture, true);
            document.addEventListener('keydown', keyCapture, true);
            window.addEventListener('storage', () => {
                try {
                    CURRENT_POST_ID = getCurrentPostIdFromUrl();
                    if (!CURRENT_POST_ID) return;
                    const set = getApprovedPostIdsFromSession();
                    const allow = set.has(CURRENT_POST_ID);
                    ALWAYS_ALLOW_CURRENT_POST = allow;
                    if (allow) {
                        document.documentElement.classList.add('nr-allow-current-post');
                        document.body && document.body.classList.add('nr-allow-current-post');
                    } else {
                        document.documentElement.classList.remove('nr-allow-current-post');
                        document.body && document.body.classList.remove('nr-allow-current-post');
                    }
                } catch {}
            });
        } catch {}
    })();

    // React-Safe Hide Function (replaces .remove())
    function safelyHideElement(el) {
        if (!el) return;
        try {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('height', '0', 'important');
            el.style.setProperty('padding', '0', 'important');
            el.style.setProperty('margin', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.style.setProperty('position', 'absolute', 'important');
            el.style.setProperty('z-index', '-9999', 'important');
            el.classList.add('reddit-banned', 'prehide');
        } catch (e) {}
    }

    // === ANSWERS PAGE-WORLD HOOK ===
    (function installAnswersPageHook() {
        try {
            if (window.__nrAnswersEarlyInstalled) return;
            window.__nrAnswersEarlyInstalled = true;

            function getRedditPageNonce() {
                try {
                    const scripts = document.querySelectorAll('script[nonce]');
                    for (let i = 0; i < scripts.length; i++) {
                        const nonce = scripts[i].nonce || scripts[i].getAttribute('nonce') || '';
                        if (nonce) return nonce;
                    }
                } catch {}
                return '';
            }

            function injectIntoPage(fn) {
                try {
                    // Reddit's /media utility page has no nav/Answers surface and enforces a
                    // nonce-only script CSP. Never create an inline script there.
                    if (/^\/media(?:\/|$)/i.test(location.pathname || '')) return false;

                    const nonce = getRedditPageNonce();
                    if (!nonce) return false;

                    const el = document.createElement('script');
                    el.type = 'text/javascript';
                    el.nonce = nonce;
                    el.textContent = `;(${fn})();`;
                    (document.documentElement || document.head).appendChild(el);
                    el.remove();
                    return true;
                } catch {}
                return false;
            }

            (function injectPrehideCss() {
                try {
                    const id = 'nr-answers-prehide-css';
                    if (document.getElementById(id)) return;
                    const style = document.createElement('style');
                    style.id = id;
                    style.textContent = `
                      nav a[href="/answers"],
                      nav a[href="/answers/"],
                      nav a[href^="/answers"],
                      header a[href="/answers"],
                      header a[href="/answers/"],
                      header a[href^="/answers"],
                      aside a[href="/answers"],
                      aside a[href="/answers/"],
                      aside a[href^="/answers"],
                      [role="navigation"] a[href="/answers"],
                      [role="navigation"] a[href^="/answers"],
                      faceplate-tracker[source="nav"] a[href="/answers"],
                      faceplate-tracker[source="nav"] a[href^="/answers"],
                      svg[icon-name="answers-outline"] {
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
                    `;
                    (document.head || document.documentElement).prepend(style);
                } catch {}
            })();

            const installAnswersRuntime = function pageWorldAnswersHook() {
                if (window.__nrAnswersPageHooked) return;
                window.__nrAnswersPageHooked = true;

                const OBS = new Set();
                function addObs(mo) { try { if (mo) OBS.add(mo); } catch(e){} }
                function disconnectAll() { try { OBS.forEach(o => { try { o.disconnect(); } catch {} }); OBS.clear(); } catch {} }

                function safeHide(el) {
                    if(!el) return;
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('pointer-events', 'none', 'important');
                    el.style.setProperty('height', '0', 'important');
                    el.style.setProperty('margin', '0', 'important');
                }

                function removeAnswersAnchor(a) {
                    try {
                        const navScope = a.closest('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        if (!navScope) { safeHide(a); return; }
                        const li = a.closest('li[role="presentation"], li');
                        if (li) { safeHide(li); } else { safeHide(a); }
                    } catch {}
                }

                function removeAnswersIcon(svg) {
                    try {
                        const navScope = svg.closest && svg.closest('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        if (!navScope) return;
                        const a = svg.closest('a');
                        if (a) { removeAnswersAnchor(a); } else { safeHide(svg); }
                    } catch {}
                }

                function removeAnswersTextNodes(scopeRoot) {
                    try {
                        const scopes = scopeRoot.querySelectorAll('nav, header, aside, [role="navigation"], faceplate-tracker[source="nav"]');
                        for (let s = 0; s < scopes.length; s++) {
                            const scope = scopes[s];
                            const items = scope.querySelectorAll('a, button, li[role="presentation"], li, span, div');
                            for (let i = 0; i < items.length; i++) {
                                const el = items[i];
                                const t = (el.textContent || '').trim();
                                if (!t) continue;
                                if (/(^|\s)answers(\s|$)/i.test(t)) {
                                    const anchor = el.closest('a, button');
                                    if (anchor) {
                                        removeAnswersAnchor(anchor.tagName === 'A' ? anchor : anchor.closest('a') || anchor);
                                        continue;
                                    }
                                    const li = el.closest('li[role="presentation"], li');
                                    if (li) { safeHide(li); continue; }
                                    const fpt = el.closest('faceplate-tracker');
                                    if (fpt) { safeHide(fpt); continue; }
                                    safeHide(el);
                                }
                            }
                        }
                    } catch {}
                }

                function removeAnswersIn(root) {
                    try {
                        if (!root || !root.querySelectorAll) return;

                        const anchors = root.querySelectorAll('a[href="/answers"], a[href="/answers/"], a[href^="/answers"]');
                        for (let i = 0; i < anchors.length; i++) removeAnswersAnchor(anchors[i]);

                        const aria = root.querySelectorAll('a[aria-label="Answers"], a[aria-label*="Answers" i]');
                        for (let i = 0; i < aria.length; i++) removeAnswersAnchor(aria[i]);

                        const icons = root.querySelectorAll('svg[icon-name="answers-outline"]');
                        for (let i = 0; i < icons.length; i++) removeAnswersIcon(icons[i]);

                        removeAnswersTextNodes(root);
                    } catch {}
                }

                try {
                    window.__nrRemoveAnswersIn_forAnswers = function(root) {
                        try { removeAnswersIn(root || document); } catch {}
                    };
                } catch {}

                (function targetedInitialSweep() {
                  try {
                    removeAnswersIn(document);
                    const seeds = document.querySelectorAll(
                      'nav, header, aside, [role="navigation"], ' +
                      'faceplate-tracker[source="nav"], faceplate-tracker[noun="gen_guides_sidebar"], ' +
                      'reddit-sidebar-nav, #left-sidebar-container, flex-left-nav-container#left-sidebar-container'
                    );
                    const max = Math.min(seeds.length, 160);
                    for (let i = 0; i < max; i++) {
                      const el = seeds[i];
                      if (el && el.shadowRoot) {
                        removeAnswersIn(el.shadowRoot);
                        try {
                          const mo = new MutationObserver(() => removeAnswersIn(el.shadowRoot));
                          mo.observe(el.shadowRoot, { childList: true, subtree: true });
                          addObs(mo);
                        } catch {}
                      }
                    }
                  } catch {}
                })();

                (function hookAttachShadow() {
                    try {
                        const proto = Element.prototype;
                        if (proto.__nrAttachShadowHooked) return;
                        const orig = proto.attachShadow;
                        if (!orig) return;
                        proto.__nrAttachShadowHooked = true;

                        proto.attachShadow = function(init) {
                            const root = orig.call(this, init);
                            // Reddit creates shadow roots for posts, feeds, menus and icons.
                            // Watching every root delays hydration and has no benefit for Answers.
                            try {
                                const navScope = 'nav, header, aside, [role="navigation"], ' +
                                    'reddit-sidebar-nav, #left-sidebar-container, ' +
                                    'flex-left-nav-container#left-sidebar-container, ' +
                                    'faceplate-tracker[source="nav"], ' +
                                    'faceplate-tracker[noun="gen_guides_sidebar"]';
                                if (!this.matches?.(navScope) && !this.closest?.(navScope)) return root;
                                removeAnswersIn(root);
                                const mo = new MutationObserver(() => removeAnswersIn(root));
                                mo.observe(root, { childList: true, subtree: true });
                                addObs(mo);
                            } catch {}
                            return root;
                        };
                    } catch {}
                })();

                window.addEventListener('pagehide', disconnectAll, { once: true });
                window.addEventListener('beforeunload', disconnectAll, { once: true });

                try { removeAnswersIn(document); } catch {}
            };

            // Install the same helper in the extension/content-script world so reddit.js and
            // redditleftnav.js can cooperate without relying on page-world globals.
            try { installAnswersRuntime(); } catch {}

            // Closed Shadow DOM interception still needs the real page world. Reuse Reddit's
            // own CSP nonce when it becomes available; if no nonce is exposed, fail quietly
            // instead of deliberately generating a CSP violation.
            const pageHookDelays = [0, 40, 120, 260, 520, 900];
            pageHookDelays.forEach(delay => {
                setTimeout(() => {
                    try {
                        if (!PAGE_WORLD_HOOKED) PAGE_WORLD_HOOKED = injectIntoPage(installAnswersRuntime);
                    } catch {}
                }, delay);
            });
        } catch {}
    })();

    // --- IMMEDIATE PRE-HIDING CSS ---
    function addPreHidingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Premium adult promotion links disappear everywhere, including on
               native post pages. Only links disappear there, never their post. */
            a.nr-premium-link-hidden,
            a[href*="onlyfans" i], a[href*="fansly" i],
            a[href*="fanvue" i], a[href*="justforfans" i],
            a[href*="fantime" i], a[href*="fanstopia" i],
            a[href*="fancentro" i], a[href*="manyvids" i],
            a[href*="chaturbate" i], a[href*="myfreecams" i],
            a[href*="stripchat" i], a[href*="camsoda" i],
            a[href*="bongacams" i], a[href*="livejasmin" i],
            a[href*="patreon.com" i] {
                display: none !important;
            }
            html:not(.nr-post-page) article:has(> shreddit-post):not(.reddit-approved),
            html:not(.nr-post-page) article[data-testid="post-container"]:not(.reddit-approved),
            html:not(.nr-post-page) shreddit-post:not(.reddit-approved),
            html:not(.nr-post-page) [data-testid="search-post-unit"]:not(.reddit-approved),
            html:not(.nr-post-page) [data-id="search-media-post-unit"]:not(.reddit-approved),
            html:not(.nr-post-page) [data-testid="search-post-with-content-preview"]:not(.reddit-approved) {
                /* Keep Reddit's own post geometry while the policy scanner decides it.
                   display:none can starve Shreddit's feed virtualization/hydration. */
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* Logged-out feed markup lacks Reddit's user-logged-in flag and
               sometimes never receives our wrapper approval. Keep public feed
               cards available unless they are explicitly banned by the scan.
               NSFW and Join rules below still use display:none on matches. */
            html.nr-home-feed.nr-guest-feed-rescue article.nr-guest-verified:has(> shreddit-post:not([user-logged-in])):not(.reddit-banned):not(.prehide),
            html.nr-home-feed.nr-guest-feed-rescue shreddit-post.nr-guest-verified:not([user-logged-in]):not(.reddit-banned):not(.prehide) {
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }

            html:not(.nr-post-page) article:has(> shreddit-post).reddit-approved,
            html:not(.nr-post-page) article[data-testid="post-container"].reddit-approved,
            html:not(.nr-post-page) shreddit-post.reddit-approved,
            html:not(.nr-post-page) [data-testid="search-post-unit"].reddit-approved,
            html:not(.nr-post-page) [data-id="search-media-post-unit"].reddit-approved,
            html:not(.nr-post-page) [data-testid="search-post-with-content-preview"].reddit-approved {
                /* Restore paint without overriding Reddit's native layout display type. */
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }

            /* A Join control in the credit bar indicates a suggested community
               card. Hide its entire feed card without waiting for shadow-DOM
               hydration or the normal scanner pass. Keep direct posts/search usable. */
            /* Guest popular-feed posts all have Join controls. Apply this
               no-glimpse gate only when Reddit marks the post logged in. */
            html.nr-join-feed article:has(> shreddit-post[user-logged-in] shreddit-join-button[data-testid="credit-bar-join-button"]),
            html.nr-join-feed shreddit-post[user-logged-in]:has(shreddit-join-button[data-testid="credit-bar-join-button"]) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                margin: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }

            /* A remembered click is never permission to override a blocked post. */
            html.nr-home-feed article:has(> shreddit-post[nsfw]),
            html.nr-home-feed article:has(> shreddit-post[subreddit-nsfw]),
            html.nr-home-feed shreddit-post[nsfw],
            html.nr-home-feed shreddit-post[subreddit-nsfw],
            html.nr-home-feed article:has(shreddit-content-tags[nsfw]) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }

            /* Don't let late comment hydration re-anchor the entire post view
               to an initially empty comment section. Never trigger scrolling. */
            html.nr-post-page, html.nr-post-page body {
                overflow-anchor: none;
            }

            /* Leave the comment's shell and layout visible during hydration.
               Only hide a hydrated direct-slot body until that individual
               comment has been checked; this avoids blank comment sections and
               the huge layout jumps caused by masking every parent comment. */
            shreddit-comment:not(.reddit-comment-approved):not(.reddit-comment-banned) > [slot="comment"],
            shreddit-comment:not(.reddit-comment-approved):not(.reddit-comment-banned) > [id$="-comment-rtjson-content"] {
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            shreddit-comment.reddit-comment-banned {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }
            
            #search-dropdown-results-container li[role="presentation"]:not(.reddit-search-approved),
            #search-dropdown-results-container div[role="presentation"]:not(.reddit-search-approved),
            li[data-testid="search-sdui-query-autocomplete"]:not(.reddit-search-approved),
            li.recent-search-item:not(.reddit-search-approved),
            #search-dropdown-results-container a[role="option"]:not(.reddit-search-approved),
            div[data-testid="search-dropdown-item"]:not(.reddit-search-approved),
            [data-testid="search-community"]:not(.reddit-search-approved) {
                display: none !important;
                visibility: hidden !important;
            }
            
            recent-posts,
            reddit-recent-pages,
            shreddit-recent-communities,
            div[data-testid="community-list"],
            [data-testid="recent-communities"],
            .recent-communities,
            in-feed-community-recommendations,
            community-recommendation,
            #recent-communities-section,
            div#recent-communities-section,
            faceplate-expandable-section-helper#recent-communities-section,
            summary[aria-controls="RECENT"],
            [aria-controls="RECENT"],
            #RECENT {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
            }
            
            a[href="/answers/"],
            a[href^="/answers"],
            faceplate-tracker[noun="gen_guides_sidebar"],
            a[href="/answers/"],
            svg[icon-name="answers-outline"],
            *[href="/answers/"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
            }
            
            .reddit-banned, .reddit-search-banned, .reddit-answers-hidden {
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
            
            article.prehide, shreddit-post.prehide, [data-testid="search-post-unit"].prehide, [data-testid="search-community"].prehide, [data-id="search-media-post-unit"].prehide, [data-testid="search-post-with-content-preview"].prehide {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: none !important;
            }
            
            html:not(.nr-post-page) article:has(> shreddit-post):not(.reddit-approved) img,
            html:not(.nr-post-page) article[data-testid="post-container"]:not(.reddit-approved) img,
            html:not(.nr-post-page) shreddit-post:not(.reddit-approved) img,
            html:not(.nr-post-page) [data-testid="search-post-unit"]:not(.reddit-approved) img,
            html:not(.nr-post-page) [data-id="search-media-post-unit"]:not(.reddit-approved) img,
            html:not(.nr-post-page) [data-testid="search-post-with-content-preview"]:not(.reddit-approved) img {
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* A public-feed card must not remain transparent just because an
               approval was attached to a nested or recycled wrapper. */
            html.nr-home-feed.nr-guest-feed-rescue article.nr-guest-verified:has(> shreddit-post:not([user-logged-in])):not(.reddit-banned):not(.prehide) img,
            html.nr-home-feed.nr-guest-feed-rescue shreddit-post.nr-guest-verified:not([user-logged-in]):not(.reddit-banned):not(.prehide) img {
                visibility: visible !important;
                opacity: 1 !important;
            }

            html:not(.nr-post-page) article:has(> shreddit-post).reddit-approved img,
            html:not(.nr-post-page) article[data-testid="post-container"].reddit-approved img,
            html:not(.nr-post-page) shreddit-post.reddit-approved img,
            html:not(.nr-post-page) [data-testid="search-post-unit"].reddit-approved img,
            html:not(.nr-post-page) [data-id="search-media-post-unit"].reddit-approved img,
            html:not(.nr-post-page) [data-testid="search-post-with-content-preview"].reddit-approved img {
                visibility: visible !important;
                opacity: 1 !important;
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

    document.documentElement.classList.toggle('nr-post-page', isPostPage());
    addPreHidingCSS();
    document.documentElement.classList.toggle('nr-home-feed', isHomeFeedContext());
    document.documentElement.classList.toggle('nr-join-feed', isRedditJoinFeedContext());

    try {
        if (ALWAYS_ALLOW_CURRENT_POST) {
            document.documentElement.classList.add('nr-allow-current-post');
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    try { document.body && document.body.classList.add('nr-allow-current-post'); } catch {}
                });
            } else {
                try { document.body && document.body.classList.add('nr-allow-current-post'); } catch {}
            }
        }
    } catch {}

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
        "r/Glitch_in_the_Matrix",
        "r/niceguys",
        "r/nicegirls",
        "r/ChatGPT",
        "r/ChatGPTcomplaints",
        "r/OpenAI",
        "r/NVidia",
        "r/AMD",
        "r/Intel",
        "r/AyyMD",
	"r/buildapc",
	"r/buildmeapc",
	"r/RealHomePorn",
	"r/AmateursDoingIt",
    ];



    // Adult/NSFW is NOT a global ban. Existing explicit subreddit/domain and
    // keyword/AI rules above and below still apply in every context.
    // The extra topic rules below apply ONLY on broad/front-page feeds.
    function isHomeFeedContext() {
        const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
        return /^(?:\/|\/(?:best|hot|new|top)|\/r\/(?:all|popular))$/i.test(path);
    }

    function isRedditJoinFeedContext() {
        // A Join button on a direct post or search result is normal navigation,
        // not necessarily a recommendation. Feed cards are the target.
        if (isPostPage()) return false;
        const path = window.location.pathname || '/';
        return !/(?:\/comments\/|^\/search(?:\/|$)|^\/user\/|^\/u\/|^\/settings(?:\/|$))/i.test(path);
    }

    function isSuggestedJoinFeedCard(element) {
        if (!isRedditJoinFeedContext()) return false;
        // On Reddit's logged-out popular feed EVERY post receives a Join control.
        // It is not evidence of a suggestion unless the card belongs to a
        // logged-in session. The user-logged-in marker lives on SHREDDIT-POST.
        const post = element?.matches?.('shreddit-post') ? element :
            element?.querySelector?.('shreddit-post') || element?.closest?.('shreddit-post');
        if (!post?.hasAttribute?.('user-logged-in')) return false;
        return !!post.querySelector(
            'shreddit-join-button[data-testid="credit-bar-join-button"]'
        );
    }

    const homeFeedTopicFilters = [
        /\b(?:nsfw|not\s+safe\s+for\s+work|18\+|adult\s+content|gone\s?wild|only\s?fans|fansly)\b/i,
        /\b(?:sex|sexes|sexy|sexual(?:ly|ity)?|sext(?:ing|s)?|horny|horniness|arous(?:al|ed|ing)|erotic(?:a|ism)?|fetish(?:es|ism)?|kink(?:y|s)?|lust(?:ful)?|lewd|seduct(?:ion|ive)|libido)\b/i,
        /\b(?:porn(?:ography|ographic|hub)?|porno|xxx|nudes?|nudity|naked|topless|strip(?:per|ping|tease)?|masturbat(?:e|ion|ing)|orgasms?|hookups?|one[ -]?night[ -]?stands?|friends[ -]?with[ -]?benefits)\b/i,
        /\b(?:boobs?|breasts?|tits?|nipples?|pussy|vagina(?:l)?|penis|dicks?|cocks?|genitals?|erections?|ejaculat(?:e|ion|ing)|intimacy|intimate|virgin(?:ity)?|celiba(?:te|cy)|bikinis?|lingerie|thongs?|pantyhose|seduction|escorts?|sugar[ -]?(?:daddy|baby))\b/i,
        /\b(?:dating|date\s?night|first\s?date|going\s+on\s+a\s+date|courtship|court(?:ing|ed)|romanc(?:e|es|ing)|romantic|relationship(?:s)?|flirt(?:ing|ation|s)?|crush(?:es)?|boyfriends?|girlfriends?|ex[ -]?(?:wife|husband|boyfriend|girlfriend)|wives|wife|husbands?|fianc(?:e|ee|é|ée)s?|partners?\s+(?:in\s+love|in\s+a\s+relationship))\b/i,
        /\b(?:women|woman|womans|woman's|womens|women's|girls?|girly|ladies|lady|females?|feminine|femininity|chicks?|babes?|brides?|bachelorettes?|milfs?|cougars?)\b/i,
        /\b(?:tinder|bumble|hinge|grindr|okcupid|match\.com|badoo|happn|feeld|dating\s?apps?)\b/i,
        /(?:^|[^a-zäöå])(?:seks(?:i|uaal)[a-zäöå]*|porno[a-zäöå]*|alasto[a-zäöå]*|kiima[a-zäöå]*|fetissi[a-zäöå]*|treffi[a-zäöå]*|seurustel[a-zäöå]*|romanttinen|romantiikka)(?=$|[^a-zäöå])/i,
        /(?:^|[^a-zäöå])(?:nain[a-zäöå]*|nais[a-zäöå]*|tyttö[a-zäöå]*|tytö[a-zäöå]*|poikaystävä[a-zäöå]*|vaimo[a-zäöå]*|morsia[a-zäöå]*)(?=$|[^a-zäöå])/i
    ];

    function hasHomeFeedTopic(text) {
        if (!text) return false;
        const candidate = String(text).slice(0, 12000);
        return homeFeedTopicFilters.some(pattern => pattern.test(candidate));
    }

    function hasHomeFeedSubredditTopic(element) {
        const name = (getSubredditForAnyRedditPost(element) || '').toLowerCase()
            .replace(/^r\//, '').replace(/[_\-\s]/g, '');
        return /(?:women|woman|girls?|ladies|lady|female|dating|relationship|romance|sex|porn|nsfw|gonewild|onlyfans|fansly|twoxchromosomes|femaledatingstrategy)/i.test(name);
    }

    function isExplicitlyNSFWPost(element) {
        if (!element || !element.querySelector) return false;
        const candidates = [element, ...element.querySelectorAll('shreddit-post, shreddit-content-tags')];
        for (const node of candidates) {
            if (node.hasAttribute?.('nsfw') || node.hasAttribute?.('subreddit-nsfw') ||
                node.getAttribute?.('data-nsfw') === 'true' ||
                node.getAttribute?.('over-18') === 'true') return true;
        }
        return !!element.querySelector(
            '.text-category-nsfw, .nsfw, .nsfw-tag, .nsfw-content, ' +
            'svg[icon-name="nsfw-outline"], svg[icon-name="nsfw-fill-12"], ' +
            '[data-testid="search-warnings"] .text-category-nsfw'
        );
    }

    function postHasFailedMedia(element) {
        if (!element || !element.querySelectorAll) return false;
        const mediaSlots = element.querySelectorAll('[slot="post-media-container"]');
        for (const media of mediaSlots) {
            // The sample HTML has <slot name="error"> placeholders for lazy
            // loaders; those are NOT errors unless real error UI materializes.
            if (media.querySelector(
                '[data-testid*="media-error" i], [data-testid*="video-error" i], ' +
                '[class*="media-error" i], [class*="video-error" i]'
            )) return true;
            const msg = (media.innerText || media.textContent || '').slice(0, 2500);
            if (/\b(?:video|media|image|embed|content)\s+(?:is\s+)?(?:unavailable|not\s+available|failed\s+to\s+load|could\s+not\s+be\s+loaded|cannot\s+be\s+(?:played|loaded)|can.t\s+be\s+(?:played|loaded))\b/i.test(msg) ||
                /\b(?:failed|unable)\s+to\s+(?:load|play)\s+(?:this\s+)?(?:video|media|image|embed|content)\b/i.test(msg)) return true;
        }
        return false;
    }

    // --- Dynamic Banned List from Chrome Storage ---
    function applyDynamicWrestlerBans() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            try {
                chrome.storage.local.get(['wrestling_women_urls'], function(result) {
                    if (result.wrestling_women_urls && Array.isArray(result.wrestling_women_urls)) {
                        let addedCount = 0;
                        const localExclusions = ['aj-lee', 'aj', 'becky-lynch', 'becky'];

                        result.wrestling_women_urls.forEach(url => {
                            const parts = url.split('/').filter(Boolean);
                            const slug = parts[parts.length - 1].toLowerCase();
                            
                            if (localExclusions.includes(slug)) return;

                            const name = slug.replace(/-/g, ' ');
                            const namePattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                            const noSpacePattern = namePattern.replace(/\s+/g, '');
                            const boundariedRegex = new RegExp('\\b' + namePattern + '\\b', 'i');

                            let isDuplicate = false;
                            for (let i = 0; i < regexKeywordsToHide.length; i++) {
                                if (regexKeywordsToHide[i].toString() === boundariedRegex.toString()) {
                                    isDuplicate = true; break;
                                }
                            }
                            if (!isDuplicate) {
                                regexKeywordsToHide.push(boundariedRegex);
                                addedCount++;
                            }

                            if (namePattern !== noSpacePattern) {
                                const spacelessRegex = new RegExp('\\b' + noSpacePattern + '\\b', 'i');
                                let isSpacelessDuplicate = false;
                                for (let i = 0; i < regexKeywordsToHide.length; i++) {
                                    if (regexKeywordsToHide[i].toString() === spacelessRegex.toString()) {
                                        isSpacelessDuplicate = true; break;
                                    }
                                }
                                if (!isSpacelessDuplicate) {
                                    regexKeywordsToHide.push(spacelessRegex);
                                    addedCount++;
                                }
                            }
                        });

                        if (addedCount > 0) {
                            devLog(`Dynamically added ${addedCount} wrestler names from shared storage to blocklist as boundaried regexes.`);
                            try { enforceSanity(); runAllChecks(); } catch(e) {}
                        }
                    }
                });
            } catch(e) {}
        }
    }
    applyDynamicWrestlerBans();


    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel",
        "in-feed-community-recommendations",
        "in-feed-community-recommendations h3",
        "community-recommendation"
    ];

    // --- OPTIMIZED MEMORY MANAGEMENT ---
    const MEMORY_CAP_GB = IS_FIREFOX ? 3.5 : 6;         
    const MEMORY_WARNING_GB = IS_FIREFOX ? 2.2 : 3;
    const MAX_CACHE_SIZE = IS_FIREFOX ? 320 : 512;         
    const MAX_APPROVAL_PERSISTENCE = IS_FIREFOX ? 30 : 40;
    const CLEANUP_INTERVAL = IS_FIREFOX ? 7000 : 10000;  
    const MEMORY_CHECK_INTERVAL = 4000;                  
    const CRITICAL_MEMORY_THRESHOLD = 0.65;              

    const processedElements = new WeakSet();
    const processedSearchItems = new WeakSet();
    const bannedSubredditCache = new Map();
    const contentBannedCache = new Map();
    const shadowRootsProcessed = new WeakSet();
    const permanentlyApprovedElements = new WeakSet();
    const approvalPersistence = new Map();
    const eventListenersAdded = new WeakSet();

    const intervalIds = new Set();
    const observerInstances = new Set();
    const searchDropdownObserverTargetsV295 = new Set();

    const shadowRootObservers = new Map();

    let lastFilterTime = -Infinity;
    let pendingOperations = false;
    let memoryCleanupCount = 0;
    let lastMemoryWarning = 0;
    let isCleaningUp = false;

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

    function cleanupCaches(force = false) {
        if (isCleaningUp) return;
        isCleaningUp = true;
        
        try {
            const memInfo = getMemoryUsage();
            const isOverCap = memInfo ? memInfo.usedGB > MEMORY_CAP_GB : false;
            const isWarning = memInfo ? memInfo.usedGB > MEMORY_WARNING_GB : false;
            const isCritical = memInfo ? (memInfo.usedMB / memInfo.limitMB) > CRITICAL_MEMORY_THRESHOLD : false;
            
            if (force || isOverCap || isCritical) {
                const beforeContent = contentBannedCache.size;
                const beforeSubreddit = bannedSubredditCache.size;
                const beforeApproval = approvalPersistence.size;
                
                contentBannedCache.clear();
                bannedSubredditCache.clear();

                const keep = IS_FIREFOX ? 8 : 10;
                if (isCritical || isOverCap) {
                    const entries = Array.from(approvalPersistence.entries()).slice(-keep);
                    approvalPersistence.clear();
                    entries.forEach(([key, value]) => approvalPersistence.set(key, value));
                }
                
                observerInstances.forEach(observer => {
                    try { if (observer && typeof observer.disconnect === 'function') observer.disconnect(); } catch {}
                });
                observerInstances.clear();
                for (const target of searchDropdownObserverTargetsV295) {
                    try { delete target.__searchObserved; } catch {}
                }
                searchDropdownObserverTargetsV295.clear();
                HEAVY_OBSERVERS_ACTIVE = false; 

                if (memInfo) {
                    devLog(`🧹 MEMORY CAP CLEANUP - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB | Cleared: Content(${beforeContent}), Subreddit(${beforeSubreddit}), Approval(${beforeApproval}→${approvalPersistence.size})`);
                }
                
            } else if (isWarning || contentBannedCache.size > MAX_CACHE_SIZE || bannedSubredditCache.size > MAX_CACHE_SIZE) {
                if (contentBannedCache.size > MAX_CACHE_SIZE) {
                    const entries = Array.from(contentBannedCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
                    contentBannedCache.clear();
                    entries.forEach(([key, value]) => contentBannedCache.set(key, value));
                }
                if (bannedSubredditCache.size > MAX_CACHE_SIZE) {
                    const entries = Array.from(bannedSubredditCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
                    bannedSubredditCache.clear();
                    entries.forEach(([key, value]) => bannedSubredditCache.set(key, value));
                }
                if (approvalPersistence.size > MAX_APPROVAL_PERSISTENCE) {
                    const entries = Array.from(approvalPersistence.entries()).slice(-Math.floor(MAX_APPROVAL_PERSISTENCE * 0.7));
                    approvalPersistence.clear();
                    entries.forEach(([key, value]) => approvalPersistence.set(key, value));
                }
                
                if (memInfo) {
                    devLog(`🧹 Gentle cleanup - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB (${memInfo.percentage}%)`);
                }
            }

            memoryCleanupCount++;
            
            if (window.gc && (force || isOverCap || (IS_FIREFOX && memoryCleanupCount % 2 === 0))) {
                try {
                    window.gc();
                    const afterMemInfo = getMemoryUsage();
                    if (afterMemInfo && memInfo) {
                        devLog(`🗑️ GC - Memory: ${afterMemInfo.usedGB}GB (was ${memInfo.usedGB}GB)`);
                    }
                } catch {}
            }
        } finally {
            isCleaningUp = false;
        }
    }

    function suspendHeavyObservers() {
        if (!HEAVY_OBSERVERS_ACTIVE) return;
        try {
            observerInstances.forEach(mo => { try { mo.disconnect(); } catch {} });
            observerInstances.clear();
            for (const target of searchDropdownObserverTargetsV295) {
                try { delete target.__searchObserved; } catch {}
            }
            searchDropdownObserverTargetsV295.clear();
            HEAVY_OBSERVERS_ACTIVE = false;
            devLog('🛌 Observers hibernated');
        } catch {}
    }

    function attachMainObservers() {
        try {
            const observer = new MutationObserver(processNewElements);
            observerInstances.add(observer);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });

            const domDetachObserver = new MutationObserver((muts) => {
                for (let i = 0; i < muts.length; i++) {
                    const m = muts[i];
                    if (m.removedNodes && m.removedNodes.length) {
                        const maxRemoved = Math.min(m.removedNodes.length, 50);
                        for (let j = 0; j < maxRemoved; j++) {
                            const n = m.removedNodes[j];
                            if (n && n.nodeType === 1) {
                                disconnectShadowObserversInSubtree(n, 0);
                            }
                        }
                    }
                }
            });
            observerInstances.add(domDetachObserver);
            domDetachObserver.observe(document.documentElement, { childList: true, subtree: true });

            // Also restore previously observed shadow roots after a real suspend.
            for (const [root, mo] of shadowRootObservers) {
                if (root.host?.isConnected) {
                    mo.observe(root, { childList: true, subtree: true, attributes: false, characterData: false });
                    observerInstances.add(mo);
                } else {
                    shadowRootObservers.delete(root);
                }
            }
            HEAVY_OBSERVERS_ACTIVE = true;
        } catch {}
    }

    function resumeHeavyObservers() {
        if (HEAVY_OBSERVERS_ACTIVE) return;
        try {
            attachMainObservers();
            observeSearchDropdown();
            HEAVY_OBSERVERS_ACTIVE = true;
            devLog('🌙 Observers resumed');
        } catch {}
    }

    function monitorMemoryPressure() {
        const memInfo = getMemoryUsage();
        const now = Date.now();

        if (memInfo) {
            const pct = (memInfo.usedMB / memInfo.limitMB);
            if (memInfo.usedGB > MEMORY_CAP_GB || pct > CRITICAL_MEMORY_THRESHOLD) {
                if (now - lastMemoryWarning > 4000) {
                    devLog(`🚨 memory pressure: ${memInfo.usedGB}GB (${Math.round(pct*100)}%) — hibernating observers`);
                    lastMemoryWarning = now;
                }
                cleanupCaches(true);
                suspendHeavyObservers();
                return;
            }
        } else if (IS_FIREFOX) {
            if (document.visibilityState === 'hidden') {
                suspendHeavyObservers();
                return;
            }
        }

        if (document.visibilityState === 'visible' && !HEAVY_OBSERVERS_ACTIVE) {
            resumeHeavyObservers();
        }
    }

    function cleanup() {
        devLog('🧹 Performing cleanup...');
        
        intervalIds.forEach(id => {
            try { clearInterval(id); } catch {}
        });
        intervalIds.clear();

        observerInstances.forEach(observer => {
            try { if (observer && typeof observer.disconnect === 'function') observer.disconnect(); } catch {}
        });
        observerInstances.clear();
        HEAVY_OBSERVERS_ACTIVE = false;

        cleanupCaches(true);
        
        const memInfo = getMemoryUsage();
        if (memInfo) {
            devLog(`🧹 Cleanup completed - Memory: ${memInfo.usedGB}GB`);
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cleanupCaches();
            suspendHeavyObservers();
        } else {
            resumeHeavyObservers();
            runAllChecks();
        }
    });

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    function isPostPage() {
        // Reddit post permalinks are /comments/<id>/..., including routes with
        // query parameters, comment anchors, and client-side navigation.
        // Detect the PATH, not the entire URL (where a query can be misleading).
        return /\/comments\/[a-z0-9]+(?:\/|$)/i.test(window.location.pathname || '');
    }

    // Answers markup is immediately concealed by document-start CSS. The expensive
    // navigation text sweep is only a fallback, not a 150ms whole-page workload.
    let lastAnswersNavigationSweepV295 = -Infinity;
    function hideAnswersButton() {
        const now = performance.now();
        if (now - lastAnswersNavigationSweepV295 < 1800) return;
        lastAnswersNavigationSweepV295 = now;
        try { window.__nrRemoveAnswersIn_forAnswers && window.__nrRemoveAnswersIn_forAnswers(document); } catch {}
        try { document.querySelectorAll('a[href="/answers/"], a[href^="/answers"]').forEach(el => safelyHideElement(el)); } catch {}
        try { document.querySelectorAll('faceplate-tracker[noun="gen_guides_sidebar"]').forEach(el => safelyHideElement(el)); } catch {}
        try {
            document.querySelectorAll('span.text-global-admin.font-semibold.text-12').forEach(span => {
                if (span.textContent && span.textContent.trim() === 'BETA') {
                    const parent = span.closest('a, li, div, faceplate-tracker');
                    if (parent) safelyHideElement(parent); else safelyHideElement(span);
                }
            });
        } catch {}
    }

    function throttle(fn, wait) {
        // Both callers are MutationObservers. Previously a queued idle callback
        // held only the FIRST mutation array and silently discarded later DOM
        // insertions. Keep a bounded queue and flush promptly on the main thread.
        let lastCall = -Infinity;
        let timer = null;
        let pending = [];

        function flush() {
            timer = null;
            if (!pending.length) return;
            lastCall = performance.now();
            const next = pending.splice(0, 30);
            fn(next);
            if (pending.length) timer = setTimeout(flush, wait);
        }

        return function(mutations) {
            if (Array.isArray(mutations)) pending.push(...mutations);
            else if (mutations) pending.push(mutations);
            // Bound backlog during unusually large React commits. The overflow
            // gets a full post scan (still fail-closed) rather than keeping the
            // renderer blocked by an unlimited queue of old mutation records.
            if (pending.length > 180) {
                pending = pending.slice(-180);
                queueRedditOverflowSweepV295();
                queueRedditCommentOverflowSweep();
            }
            if (timer === null && pending.length) {
                const remaining = Math.max(0, wait - (performance.now() - lastCall));
                if (remaining === 0) flush();
                else timer = setTimeout(flush, remaining);
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

    function extractCompletePostContent(element) {
        try {
            // textContent includes Reddit's inline hydration scripts. Their
            // opaque JavaScript IDs sometimes accidentally match banned words,
            // resulting in entire harmless posts being removed. Screen text
            // nodes belonging to the post, not SCRIPT/STYLE/TEMPLATE payloads.
            const chunks = [];
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node;
            let totalLength = 0;
            while ((node = walker.nextNode()) && totalLength < 6000) {
                if (node.parentElement?.closest('script, style, noscript, template')) continue;
                const value = node.nodeValue || '';
                if (!value.trim()) continue;
                chunks.push(value);
                totalLength += value.length;
            }

            // Preserve the existing attribute/metadata screening, which can
            // catch blocked terms not printed as visible text in the post.
            const metadataElements = element.querySelectorAll(
                '[aria-label], [title], [alt], [data-permalink], [data-testid]'
            );
            const targets = [element, ...element.querySelectorAll('shreddit-post, [author], [post-title], [subreddit-prefixed-name], [slot="authorName"]'), ...metadataElements];
            for (const target of targets) {
                if (target.closest?.('script, style, noscript, template')) continue;
                for (const attribute of ['data-permalink', 'data-testid', 'aria-label', 'title', 'alt',
                                         'author', 'data-author', 'post-title', 'subreddit-prefixed-name',
                                         'subreddit-name', 'permalink']) {
                    const value = target.getAttribute?.(attribute);
                    if (value && value.length > 2) chunks.push(value);
                }
            }
            return chunks.join(' ').trim();
        } catch (error) {
            // Never fall back to script-inclusive textContent on error.
            return element.innerText || '';
        }
    }

    function checkTextForKeywords(textContent, isSafeSub = false) {
        if (!textContent) return false;
        
        let lowerText = textContent.toLowerCase();
        if (lowerText.length > 2000) lowerText = lowerText.substring(0, 2000); 
        
        const allowOrdinaryAdultWords = !isHomeFeedContext();
        const cacheKey = (isSafeSub ? 'safe:' : 'global:') +
            (allowOrdinaryAdultWords ? 'adult:' : 'home:') + lowerText;
        if (contentBannedCache.has(cacheKey)) return contentBannedCache.get(cacheKey);
        
        if (contentBannedCache.size >= MAX_CACHE_SIZE) {
            const entries = Array.from(contentBannedCache.entries()).slice(-Math.floor(MAX_CACHE_SIZE * 0.5));
            contentBannedCache.clear();
            entries.forEach(([key, value]) => contentBannedCache.set(key, value));
        }

        let strippedText = lowerText.replace(/[^a-zäöå\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const textVariants = [lowerText, strippedText];

        for (let t = 0; t < textVariants.length; t++) {
            const textToTest = textVariants[t];
            if (!textToTest) continue;

            if (mentionsPremiumAdultPlatform(textToTest) ||
                isBlockedByRedditRegexesV295(textToTest, allowOrdinaryAdultWords)) {
                contentBannedCache.set(cacheKey, true);
                return true;
            }
        }
        
        contentBannedCache.set(cacheKey, false);
        return false;
    }

    function getPostIdentifier(element) {
        const dataKsElement = element.querySelector && element.querySelector('[data-ks-id*="t3_"]');
        if (dataKsElement) {
            const dataKsId = dataKsElement.getAttribute('data-ks-id');
            const match = dataKsId.match(/t3_([a-zA-Z0-9]+)/);
            if (match) {
                return `post_${match[1]}`;
            }
        }
        
        const searchTitleId = element.querySelector && element.querySelector('[id^="search-post-title-t3_"]');
        if (searchTitleId && searchTitleId.id) {
            const m = searchTitleId.id.match(/t3_([a-zA-Z0-9]+)/);
            if (m) return `post_${m[1]}`;
        }
        
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
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, [data-testid="post-content"] h1, [data-testid="post-content"] h2, [data-testid="post-content"] h3, [slot="title"]');
        const title = titleElement ? titleElement.textContent : '';
        
        if (subreddit && title) {
            return `${subreddit}:${title.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        
        return null;
    }

    function wasElementPreviouslyApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier && approvalPersistence.has(identifier)) {
            return approvalPersistence.get(identifier);
        }
        return false;
    }

    function markElementAsApproved(element) {
        // The CSS prehide gate applies independently to ARTICLE and its inner
        // SHREDDIT-POST. Approval of just one is not enough to paint the card.
        // Callers screen the canonical card root before using this function.
        const root = getRedditScreeningRootV295(element);
        const related = [element];
        if (root?.tagName === 'ARTICLE' && root.querySelector?.('shreddit-post')) {
            related.push(root);
            for (const nested of root.querySelectorAll('shreddit-post')) related.push(nested);
        }
        // Do not resurrect an explicitly banned card or any banned descendant,
        // and do not save an approval for one that has already been rejected.
        if (related.some(node => node.classList.contains('reddit-banned') ||
                node.classList.contains('prehide') ||
                node.closest?.('.reddit-banned, .prehide'))) return;

        const identifier = getPostIdentifier(root || element);
        if (identifier) {
            if (approvalPersistence.size >= MAX_APPROVAL_PERSISTENCE) {
                const entries = Array.from(approvalPersistence.entries()).slice(-Math.floor(MAX_APPROVAL_PERSISTENCE * 0.7));
                approvalPersistence.clear();
                entries.forEach(([key, value]) => approvalPersistence.set(key, value));
            }

            approvalPersistence.set(identifier, true);
            try { rememberApprovedPostId(identifier); } catch {}
        }

        try {
            const canonical = tryGetCanonicalPostId(root || element);
            if (canonical && canonical !== identifier) rememberApprovedPostId(canonical);
        } catch {}

        for (const node of new Set(related)) {
            node.classList.add('reddit-approved');
            permanentlyApprovedElements.add(node);
            processedElements.add(node);
        }
    }

    function isSubredditNameBanned(subName) {
        if (!subName) return false;
        const lowerSub = subName.toLowerCase();
        
        if (bannedSubredditCache.has(lowerSub)) {
            return bannedSubredditCache.get(lowerSub);
        }
        
        const cleanName = lowerSub.replace(/^(r\/|u\/|user\/)/i, '');
        
        if (isNameBannedByPrefixSuffix(cleanName)) {
            bannedSubredditCache.set(lowerSub, true);
            return true;
        }
        
        for (let i = 0; i < adultSubreddits.length; i++) {
            if (lowerSub === adultSubreddits[i].toLowerCase()) {
                bannedSubredditCache.set(lowerSub, true);
                return true;
            }
        }
        
        if (isBlockedByRedditRegexesV295(lowerSub, true)) {
            bannedSubredditCache.set(lowerSub, true);
            return true;
        }
        
        bannedSubredditCache.set(lowerSub, false);
        return false;
    }

    function isSafeSubredditUrl() {
        const url = window.location.href.toLowerCase();
        for (let i = 0; i < safeSubreddits.length; i++) {
            const safeSub = safeSubreddits[i].replace(/^r\//, '').toLowerCase();
            if (url.match(new RegExp(`/r/${safeSub}([/?#]|$|/comments/)`))) {
                return true;
            }
        }
        return false;
    }

    function isUrlAllowed() {
        const currentUrl = window.location.href;
        if (ALWAYS_ALLOW_CURRENT_POST || isCurrentPageWhitelistedAuthor()) return true;
        return allowedUrls.some(url => currentUrl.startsWith(url)) || isSafeSubredditUrl();
    }

    function hideSearchElement(el) {
        if (!el) return;
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('reddit-search-banned', 'prehide');
        
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName.includes('TRACKER') && parent.getAttribute('click-events')?.includes('search/click/')) {
                parent.style.setProperty('display', 'none', 'important');
                parent.classList.add('reddit-search-banned');
            }
            if (parent.getAttribute('data-testid') === 'search-community' || 
                parent.getAttribute('data-testid') === 'search-post-unit' ||
                parent.getAttribute('data-id') === 'search-media-post-unit') {
                parent.style.setProperty('display', 'none', 'important');
                parent.classList.add('reddit-search-banned', 'prehide');
                break; 
            }
            parent = parent.parentElement;
        }
    }

    function removeElementAndRelated(element) {
        if (!element) return;
        let tracker = element.closest('search-telemetry-tracker');
        if (tracker && tracker.parentElement && tracker.parentElement.tagName !== 'BODY') {
            safelyHideElement(tracker);
        } else if (element.parentNode) {
            safelyHideElement(element);
        }
    }

    function getSubredditForAnyRedditPost(el) {
        // Feed cards are usually ARTICLE > SHREDDIT-POST. Read the child's
        // actual community metadata before relying on visible link text.
        const nestedPost = el.tagName === 'SHREDDIT-POST' ? el : el.querySelector?.('shreddit-post[subreddit-prefixed-name], shreddit-post[subreddit-name]');
        if (nestedPost && nestedPost !== el) {
            const childSub = nestedPost.getAttribute('subreddit-prefixed-name') || nestedPost.getAttribute('subreddit-name');
            if (childSub) return childSub.startsWith('r/') ? childSub : 'r/' + childSub;
        }
        const prefixedName = el.getAttribute && el.getAttribute('subreddit-prefixed-name');
        if (prefixedName) return prefixedName.startsWith('r/') ? prefixedName : 'r/' + prefixedName;
        
        const subredditName = el.getAttribute && el.getAttribute('subreddit-name');
        if (subredditName) return 'r/' + subredditName;
        
        const dataSubreddit = el.getAttribute && el.getAttribute('data-subreddit');
        if (dataSubreddit) return dataSubreddit.startsWith('r/') ? dataSubreddit : 'r/' + dataSubreddit;
        
        const subredditLink = el.querySelector && el.querySelector('a[data-testid="subreddit-name"]');
        if (subredditLink && el.textContent) return subredditLink.textContent.trim();
        
        const rLink = el.querySelector && el.querySelector('a[href^="/r/"]');
        if (rLink && el.textContent) return rLink.textContent.trim();
        
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

    function isElementInSafeSubreddit(element) {
        if (isSafeSubredditUrl()) return true;
        
        const subredditPrefixedName = element.getAttribute && element.getAttribute('subreddit-prefixed-name');
        if (subredditPrefixedName) {
            const normalizedName = subredditPrefixedName.startsWith('r/') ? subredditPrefixedName : 'r/' + subredditPrefixedName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        const subredditName = element.getAttribute && element.getAttribute('subreddit-name');
        if (subredditName) {
            const normalizedName = 'r/' + subredditName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        // Modern feed cards put the subreddit metadata on a nested
        // shreddit-post, while the scanner often receives the ARTICLE host.
        const nestedPost = element.querySelector?.('shreddit-post[subreddit-prefixed-name], shreddit-post[subreddit-name]');
        if (nestedPost) {
            const nestedName = nestedPost.getAttribute('subreddit-prefixed-name') ||
                nestedPost.getAttribute('subreddit-name') || '';
            const normalizedNested = nestedName.startsWith('r/') ? nestedName : 'r/' + nestedName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedNested.toLowerCase()))
                return true;
        }

        const subreddit = getSubredditForAnyRedditPost(element);
        if (subreddit) {
            const normalizedName = subreddit.startsWith('r/') ? subreddit : 'r/' + subreddit;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        return false;
    }

    function checkContentForKeywords(content, isSafe = false) {
        if (!content) return false;
        const contentText = content.textContent || content.innerText || content.nodeValue || '';
        if (!contentText) return false;
        return checkTextForKeywords(contentText, isSafe);
    }

    // Safe communities are intentionally readable, including normal AI
    // discussion in r/ChatGPT, r/ChatGPTComplaints and r/OpenAI. The *only*
    // content exception in their posts is explicit generative image/video
    // material. Comments are always screened by the full original list.
    const SAFE_COMMUNITY_GENERATED_MEDIA = [
        /\b(?:ai|a\.?i\.?|artificial\s+intelligence)[\s_-]*(?:generated|generating|generator|generation|made|created)[\s_-]*(?:images?|pictures?|photos?|videos?|artworks?|art)\b/i,
        /\b(?:images?|pictures?|photos?|videos?|artworks?)[\s_-]*(?:generated|generating|generation|generator)[\s_-]*(?:by[\s_-]*)?(?:ai|a\.?i\.?|artificial\s+intelligence)\b/i,
        /\b(?:ai|a\.?i\.?|artificial\s+intelligence)[\s_-]*(?:images?|pictures?|photos?|videos?|artworks?|art)[\s_-]*(?:generation|generator|generating|creation|creator)\b/i,
        /\b(?:image|picture|photo|video|art)[\s_-]*(?:generation|generator|generating|to[\s_-]*video)\b/i,
        /\b(?:text[\s_-]*to[\s_-]*(?:image|video)|image[\s_-]*to[\s_-]*video|img2vid|img2img|txt2img|text2img)\b/i,
        /\b(?:midjourney|stable[\s_-]*diffusion|dall[\s-]*e|flux[\s-]*image|comfy[\s_-]*ui|sora[\s_-]*video|runway[\s_-]*gen[\s-]*[234])\b/i
    ];

    function safeCommunityPostHasGeneratedMedia(element) {
        // Content only: don't scan the URL, unrelated navigation, comments or
        // renderer internals. In particular, "r/OpenAI" is never a match.
        const post = element.matches?.('shreddit-post') ? element :
            element.querySelector?.('shreddit-post') || element;
        const pieces = [post.getAttribute?.('post-title') || ''];
        const title = post.querySelector?.('[slot="title"], h1, h2, h3, [data-testid="post-title-text"]');
        if (title) pieces.push(title.textContent || '');
        const body = post.querySelector?.('[slot="text-body"], [data-testid="post-content"], .post-content');
        if (body) pieces.push(body.textContent || '');
        const content = pieces.join(' ').slice(0, 10000);
        return SAFE_COMMUNITY_GENERATED_MEDIA.some(pattern => pattern.test(content));
    }

    function postMentionsPremiumAdultPlatform(element, content = '') {
        if (mentionsPremiumAdultPlatform(content)) return true;
        const posts = [element, ...element.querySelectorAll('shreddit-post')];
        for (const post of posts) {
            for (const attribute of ['content-href', 'domain', 'post-title', 'url', 'data-url', 'outbound-url']) {
                if (mentionsPremiumAdultPlatform(post.getAttribute?.(attribute))) return true;
            }
        }
        for (const link of element.querySelectorAll('a[href]')) {
            if (isPremiumAdultLink(link)) return true;
        }
        return false;
    }

    function evaluateElementForBanning(element) {
        // A direct post page is never a feed card. Only its comments are
        // subject to the independent comment scanner below.
        if (isPostPage()) return false;
        const wasApprovedBefore = (permanentlyApprovedElements.has(element) || wasElementPreviouslyApproved(element));
        if (!STRICT_BLOCKING && wasApprovedBefore) return false;
        
        // Existing blocklists take priority over approved clicks and authors.
        const isSafe = isElementInSafeSubreddit(element);
        const fullContent = extractCompletePostContent(element);

        // Paid-content promotion is a site-wide listing ban, even in otherwise
        // whitelisted communities. Individual post pages remain exempt.
        if (postMentionsPremiumAdultPlatform(element, fullContent)) return true;

        // The front page remains tech-only regardless of an originating
        // community's safe status; direct subreddit feeds use its exemption.
        if (isHomeFeedContext() &&
            (isExplicitlyNSFWPost(element) || hasHomeFeedSubredditTopic(element) ||
             hasHomeFeedTopic(fullContent + ' ' + (getSubredditForAnyRedditPost(element) || '')))) return true;

        if (isSuggestedJoinFeedCard(element)) return true;
        if (isSafe) return safeCommunityPostHasGeneratedMedia(element);

        if (isElementFromAdultSubreddit(element)) return true;
        if (checkTextForKeywords(fullContent)) return true;
        
        const titleElement = element.querySelector && element.querySelector('h1, h2, h3, a[data-click-id="body"], .title, [slot="title"], [data-testid="post-title-text"]');
        if (titleElement && checkContentForKeywords(titleElement, isSafe)) return true;
        
        const contentElement = element.querySelector && element.querySelector('.post-content, .md-container, p, [slot="text-body"], [data-testid="post-content"]');
        if (contentElement && checkContentForKeywords(contentElement, isSafe)) return true;
        
        // NSFW badges alone are allowed away from the front page.
        return false;
    }

    // The current Reddit /search/ Posts tab uses SDUI preview cards, not
    // shreddit-post or the older search-post-unit element. Treat each card as
    // the screening unit so a matching title/snippet hides the whole result.
    const REDDIT_SEARCH_PREVIEW_SELECTOR_V295 = '[data-testid="search-post-with-content-preview"]';
    const redditSearchPreviewSignaturesV295 = new WeakMap();

    function getRedditSearchPreviewSignatureV295(card) {
        // This fingerprint detects late title/snippet hydration and recycled
        // results. It is never used for actual blocking (which remains script-safe).
        const content = card.querySelector('[data-testid="sdui-post-unit"]');
        const title = card.querySelector('a[data-testid="post-title-text"], a[data-testid="post-title"]');
        return (content?.textContent || card.textContent || '').slice(0, 8000) + '\u0000' +
            (title?.textContent || '') + '\u0000' +
            (title?.getAttribute('aria-label') || '') + '\u0000' +
            (title?.getAttribute('href') || '');
    }

    function screenRedditSearchPreviewV295(card) {
        if (isPostPage()) {
            revealPostCardOnDetailPage(card);
            return;
        }
        // A title is needed before a result is ready to be approved. Until then
        // the initial CSS gate leaves the incomplete card invisible.
        const title = card.querySelector('a[data-testid="post-title-text"], a[data-testid="post-title"], [id^="search-post-title-t3_"]');
        if (!title || !(title.textContent?.trim() || title.getAttribute('aria-label')?.trim())) return;

        const signature = getRedditSearchPreviewSignatureV295(card);
        if (redditSearchPreviewSignaturesV295.get(card) === signature && processedElements.has(card)) return;

        // Re-evaluate a card if Reddit populates its snippet after its title,
        // rather than trusting a previous approval for the changed content.
        const banned = evaluateElementForBanning(card);
        redditSearchPreviewSignaturesV295.set(card, signature);
        processedElements.add(card);
        if (banned) {
            card.classList.remove('reddit-approved');
            card.classList.add('reddit-banned', 'prehide');
            safelyHideElement(card);
            return;
        }

        if (card.classList.contains('reddit-banned') || card.classList.contains('prehide')) {
            card.classList.remove('reddit-banned', 'reddit-search-banned', 'prehide');
            for (const property of ['display', 'visibility', 'opacity', 'height', 'padding',
                                    'margin', 'pointer-events', 'position', 'z-index']) {
                card.style.removeProperty(property);
            }
        }
        if (!card.classList.contains('reddit-approved')) markElementAsApproved(card);
    }

    function getRedditScreeningRootV295(element) {
        if (!element?.tagName) return element;
        const searchCard = element.closest?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295);
        if (searchCard) return searchCard;
        return element.tagName === 'SHREDDIT-POST' && element.parentElement?.tagName === 'ARTICLE'
            ? element.parentElement : element;
    }

    function revealPostCardOnDetailPage(card) {
        if (!card || !isPostPage()) return;
        document.documentElement.classList.add('nr-post-page');
        document.documentElement.classList.remove('nr-home-feed', 'nr-join-feed');
        // A transition from a filtered feed can reuse both ARTICLE and
        // SHREDDIT-POST. Reset BOTH rather than relying on former approvals.
        const nodes = [card];
        if (card.tagName === 'ARTICLE') {
            for (const child of card.querySelectorAll('shreddit-post')) nodes.push(child);
        }
        for (const node of nodes) {
            const wasHidden = node.classList.contains('reddit-banned') ||
                node.classList.contains('reddit-search-banned') ||
                node.classList.contains('prehide');
            node.classList.remove('reddit-banned', 'reddit-search-banned', 'prehide');
            node.classList.add('reddit-approved');
            if (wasHidden) {
                // Clear only properties installed by our own hiding routine.
                // Don't rewrite Reddit's layout styles or comment elements.
                for (const key of ['display', 'visibility', 'opacity', 'height',
                    'padding', 'margin', 'pointer-events', 'position', 'z-index']) {
                    if (node.style.getPropertyPriority(key) === 'important')
                        node.style.removeProperty(key);
                }
            }
            processedElements.add(node);
        }
    }

    function screenRedditPostRootV295(seed) {
        const post = getRedditScreeningRootV295(seed);
        if (!post) return;
        if (isPostPage()) {
            revealPostCardOnDetailPage(post);
            return;
        }
        if (post.matches?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295)) {
            screenRedditSearchPreviewV295(post);
            return;
        }
        if (processedElements.has(post)) {
            if (post.classList.contains('reddit-approved') &&
                (postMentionsPremiumAdultPlatform(post, extractCompletePostContent(post)) ||
                 isSuggestedJoinFeedCard(post) ||
                 (isHomeFeedContext() && (isExplicitlyNSFWPost(post) ||
                    hasHomeFeedSubredditTopic(post) ||
                    hasHomeFeedTopic(extractCompletePostContent(post)))))) {
                post.classList.remove('reddit-approved');
                post.classList.add('reddit-banned', 'prehide');
                safelyHideElement(post);
                return;
            }
            // Shreddit can replace the child custom element without replacing ARTICLE,
            // or a guest-feed mutation can leave an approved inner SHREDDIT-POST under
            // an unapproved outer ARTICLE. Both cases require one fresh card-level
            // policy decision, not an automatic approval inherited from the child.
            if (post.tagName === 'ARTICLE' && post.querySelector('shreddit-post') &&
                (!post.classList.contains('reddit-approved') ||
                 Array.from(post.querySelectorAll('shreddit-post')).some(child =>
                     !child.classList.contains('reddit-approved')))) {
                if (evaluateElementForBanning(post)) {
                    post.classList.remove('reddit-approved');
                    post.classList.add('reddit-banned', 'prehide');
                    safelyHideElement(post);
                } else {
                    markElementAsApproved(post);
                }
            }
            return;
        }
        // Never release a descendant of a banned wrapper on a later mutation pass.
        if (post.closest?.('.reddit-banned, .prehide')) {
            processedElements.add(post);
            return;
        }
        processedElements.add(post);
        if (evaluateElementForBanning(post)) {
            post.classList.add('prehide', 'reddit-banned');
            hideSearchElement(post);
            removeElementAndRelated(post);
            return;
        }
        markElementAsApproved(post);
    }

    function screenRedditComment(comment) {
        if (!comment) return;
        // Only the comment's OWN text counts. A missing parent body must not
        // inherit a banned descendant's content and hide the entire thread.
        const bodies = comment.querySelectorAll('[slot="comment"], [id$="-comment-rtjson-content"]');
        let body = null;
        for (const candidate of bodies) {
            if (candidate.closest('shreddit-comment') === comment) {
                body = candidate;
                break;
            }
        }
        if (!body) {
            // React may attach the text several ticks later. The comment
            // remains present instead of disappearing with its replies.
            return;
        }
        const content = (body.innerText || body.textContent || '').slice(0, 9000);
        const author = comment.getAttribute('author') || comment.getAttribute('data-author') || '';
        const banned = checkTextForKeywords(author + ' ' + content) ||
            isNameBannedByPrefixSuffix(author);
        if (banned) {
            comment.classList.remove('reddit-comment-approved');
            comment.classList.add('reddit-comment-banned');
            safelyHideElement(comment);
            return;
        }
        if (comment.classList.contains('reddit-comment-banned')) {
            comment.classList.remove('reddit-comment-banned', 'reddit-banned', 'prehide');
            // Recycled comment nodes may still have our inline !important
            // styles even after Reddit replaces their author/body.
            for (const property of ['display', 'visibility', 'opacity', 'height',
                'padding', 'margin', 'pointer-events', 'position', 'z-index']) {
                if (comment.style.getPropertyPriority(property) === 'important')
                    comment.style.removeProperty(property);
            }
        }
        comment.classList.add('reddit-comment-approved');
    }

    function processAllUnapprovedComments() {
        const comments = document.querySelectorAll(
            'shreddit-comment:not(.reddit-comment-approved):not(.reddit-comment-banned)'
        );
        for (const comment of comments) screenRedditComment(comment);
    }

    function processAllUnapprovedPosts() {
        if (isPostPage()) {
            // Ignore *every* post-level rule here. Feed-approved posts must not
            // be hidden again just because the user opened their permalink.
            const posts = document.querySelectorAll(
                'article:has(> shreddit-post), article[data-testid="post-container"], shreddit-post'
            );
            for (const post of posts) revealPostCardOnDetailPage(getRedditScreeningRootV295(post));
            return;
        }
        const posts = document.querySelectorAll(`
            article:has(> shreddit-post):not(.prehide):not(.reddit-approved),
            article[data-testid="post-container"]:not(.prehide):not(.reddit-approved),
            shreddit-post:not(.prehide):not(.reddit-approved),
            [data-testid="search-post-unit"]:not(.prehide):not(.reddit-approved),
            [data-id="search-media-post-unit"]:not(.prehide):not(.reddit-approved),
            [data-testid="search-post-with-content-preview"]:not(.prehide):not(.reddit-approved)
        `);
        
        for (let i = 0; i < posts.length; i++) {
            screenRedditPostRootV295(posts[i]);
        }
    }

    function processSearchCommunities() {
        const communities = document.querySelectorAll('[data-testid="search-community"]:not(.reddit-search-approved):not(.prehide)');
        for (let i = 0; i < communities.length; i++) {
            const el = communities[i];
            if (processedSearchItems.has(el)) continue;
            processedSearchItems.add(el);
            
            const link = el.querySelector('a[href^="/r/"]');
            const titleMatch = link ? link.getAttribute('href').match(/^\/r\/([a-zA-Z0-9_]+)\/?$/i) : null;
            const name = titleMatch ? titleMatch[1] : (el.textContent || '');
            
            if (isSubredditNameBanned(name) || isSearchTextBanned(el.textContent)) {
                hideSearchElement(el);
            } else {
                el.classList.add('reddit-search-approved');
            }
        }
    }

    function hideJoinNowPosts() {
        if (isPostPage()) return;
        const posts = document.querySelectorAll('article:not(.prehide), shreddit-post:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            
            // Community suggestions use a custom element with shadow DOM. Its
            // visible Join label cannot be found through post.textContent.
            let joinNowFound = isSuggestedJoinFeedCard(post);
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

    function hideBannedSubredditsFromSearch() {
        // Do not classify the site's normal navigation or feed LI elements as search results.
        const searchUi = '#search-dropdown-results-container, faceplate-search-dropdown, shreddit-search-dropdown';
        const onSearchPage = /^\/search(?:\/|$)/i.test(window.location.pathname);
        if (!onSearchPage && !document.querySelector(searchUi) &&
            !document.querySelector('[data-testid="search-community"], li[data-testid="search-sdui-query-autocomplete"]')) return;
        const allSearchItems = [
            ...Array.from(document.querySelectorAll('[data-type="search-dropdown-item-label-text"]')),
            ...Array.from(document.querySelectorAll('#search-dropdown-results-container span.font-semibold.text-12.uppercase, faceplate-search-dropdown span.font-semibold.text-12.uppercase, shreddit-search-dropdown span.font-semibold.text-12.uppercase')),
            ...Array.from(document.querySelectorAll('li[data-testid="search-sdui-query-autocomplete"], li.recent-search-item')),
            ...Array.from(document.querySelectorAll('#search-dropdown-results-container li[role="presentation"], faceplate-search-dropdown li[role="presentation"], shreddit-search-dropdown li[role="presentation"], #search-dropdown-results-container a[role="option"], faceplate-search-dropdown a[role="option"], shreddit-search-dropdown a[role="option"], div[data-testid="search-dropdown-item"]')),
            ...Array.from(document.querySelectorAll('[data-testid="search-community"]'))
        ];
        
        for (let i = 0; i < allSearchItems.length; i++) {
            const item = allSearchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const textContent = item.textContent || '';
            const label = ariaLabel + ' ' + textContent;
            
            if (isSearchTextBanned(label) || isSubredditNameBanned(label)) {
                hideSearchElement(item);
            } else {
                item.classList.add('reddit-search-approved');
                let parent = item.closest('li[role="presentation"], li, a, div');
                if (parent) parent.classList.add('reddit-search-approved');
            }
        }
    }

    const throttledShadowRootHandler = throttle((mutations) => {
        const maxMutations = Math.min(mutations.length, 20);
        for (let mi = 0; mi < maxMutations; mi++) {
            const mutation = mutations[mi];
            const addedLimit = Math.min(mutation.addedNodes.length, 10);
            for (let ni = 0; ni < addedLimit; ni++) {
                const node = mutation.addedNodes[ni];
                if (node && node.nodeType === 1) {
                    screenPremiumAdultLinks(node);
                    processShadowSearchItems(mutation.target);
                    // A feed's shadow root can receive posts after its initial
                    // scan. Screen those specific new posts instead of leaving
                    // them waiting for an unreachable light-DOM fallback.
                    if (node.matches?.('shreddit-post, article[data-testid="post-container"], [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]') ||
                        (node.tagName === 'ARTICLE' && node.querySelector?.('shreddit-post'))) {
                        screenRedditPostRootV295(node);
                    } else if (node.querySelectorAll) {
                        const nested = node.querySelectorAll('shreddit-post, article[data-testid="post-container"], [data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]');
                        const limit = Math.min(nested.length, 60);
                        for (let k = 0; k < limit; k++) screenRedditPostRootV295(nested[k]);
                        if (nested.length > limit) queueRedditOverflowSweepV295();
                    }
                    if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                        shadowRootsProcessed.add(node.shadowRoot);
                        processShadowSearchItems(node.shadowRoot);
                        observeShadowRootOnce(node.shadowRoot);
                    }
                }
            }
        }
    }, 100);

    function observeShadowRootOnce(root) {
        if (!root || shadowRootObservers.has(root)) return;
        try {
            const mo = new MutationObserver(throttledShadowRootHandler);
            mo.observe(root, { childList: true, subtree: true, attributes: false, characterData: false });
            shadowRootObservers.set(root, mo);
            observerInstances.add(mo);
        } catch (e) {}
    }

    function disconnectShadowObserversInSubtree(node, depth = 0) {
        if (!node || node.nodeType !== 1 || depth > 6) return;
        try {
            if (node.shadowRoot && shadowRootObservers.has(node.shadowRoot)) {
                const mo = shadowRootObservers.get(node.shadowRoot);
                try { mo && mo.disconnect && mo.disconnect(); } catch {}
                observerInstances.delete(mo);
                shadowRootObservers.delete(node.shadowRoot);
            }
            const children = node.children;
            if (children && children.length) {
                const max = Math.min(children.length, 200);
                for (let i = 0; i < max; i++) {
                    disconnectShadowObserversInSubtree(children[i], depth + 1);
                }
            }
        } catch {}
    }

    function processShadowSearchItems(root) {
        if (!root || !root.querySelectorAll) return;
        const host = root.host || (root.nodeType === 1 ? root : null);
        if (host && !host.matches?.('faceplate-search-dropdown, shreddit-search-dropdown, #search-dropdown-results-container') &&
            !host.closest?.('faceplate-search-dropdown, shreddit-search-dropdown, #search-dropdown-results-container')) return;

        const searchItems = root.querySelectorAll('li[role="presentation"], div[role="presentation"], li, a[role="option"], div[data-testid="search-dropdown-item"], [data-testid="search-community"]');
        
        for (let i = 0; i < searchItems.length; i++) {
            const item = searchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            const text = item.textContent || '';
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const fullText = text + ' ' + ariaLabel;
            
            if (isSearchTextBanned(fullText)) {
                hideSearchElement(item);
            } else {
                item.classList.add('reddit-search-approved');
            }
        }
    }

    function hideBannedSubredditsFromAllSearchDropdowns() {
        // Search screening must never recursively walk the entire home feed.
        // Restrict shadow-root discovery to search surfaces and their descendants.
        hideBannedSubredditsFromSearch();
        const dropdowns = document.querySelectorAll(
            'faceplate-search-dropdown, shreddit-search-dropdown, #search-dropdown-results-container'
        );
        const visitedRoots = new Set();
        function scanSearchSubtree(host, depth = 0) {
            if (!host || depth > 8) return;
            const root = host.shadowRoot || host;
            if (visitedRoots.has(root)) return;
            visitedRoots.add(root);
            if (host.shadowRoot && !shadowRootsProcessed.has(host.shadowRoot)) {
                shadowRootsProcessed.add(host.shadowRoot);
                observeShadowRootOnce(host.shadowRoot);
            }
            processShadowSearchItems(root);
            const nodes = root.querySelectorAll?.('faceplate-search-dropdown, shreddit-search-dropdown, *') || [];
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].shadowRoot) scanSearchSubtree(nodes[i], depth + 1);
            }
        }
        for (let i = 0; i < dropdowns.length; i++) scanSearchSubtree(dropdowns[i]);
    }

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
            observer.observe(container, { childList: true, subtree: true });
            container.__searchObserved = true;
            searchDropdownObserverTargetsV295.add(container);
        }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            const dropdown = searchDropdowns[i];
            if (dropdown.__searchObserved) continue;
            dropdown.__searchObserved = true;
            searchDropdownObserverTargetsV295.add(dropdown);
            
            const observer = new MutationObserver(() => {
                batchProcess(() => {
                    if (dropdown.shadowRoot) {
                        processShadowSearchItems(dropdown.shadowRoot);
                    }
                });
            });
            observerInstances.add(observer);
            observer.observe(dropdown, { childList: true, subtree: true });
        }
    }

    // === THE ULTIMATE SANITY ENFORCER (WITH HOMEPAGE GUARD) ===
    function enforceSanity() {
        // Never redirect away from a native post because its subreddit, URL
        // slug or visible content happens to contain a blocked keyword.
        if (isRedirecting || isPostPage()) return;
        try {
            const currentUrl = window.location.href.toLowerCase();
            const urlObj = new URL(window.location.href);
            const isHomePage = urlObj.pathname === '/' || urlObj.pathname === '';

            // 1. Check Search Query in URL
            if (urlObj.pathname.toLowerCase().includes('/search')) {
                const searchQuery = urlObj.searchParams.get('q');
                if (searchQuery && isSearchTextBanned(searchQuery)) {
                    devLog(`Banned search query detected: ${searchQuery}. Redirecting...`);
                    isRedirecting = true;
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }

            // 2. Check Active Search Input Box (Clear it if on homepage, redirect otherwise)
            const searchInputs = document.querySelectorAll('input[name="q"], input[type="search"]');
            for (let i = 0; i < searchInputs.length; i++) {
                if (searchInputs[i].value && isSearchTextBanned(searchInputs[i].value)) {
                    devLog(`Banned text in search box: ${searchInputs[i].value}. Clearing...`);
                    searchInputs[i].value = ''; // Silently clear it
                    if (!isHomePage) {
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                        return;
                    }
                }
            }

            // HOMEPAGE GUARD: Stop checking URL if we are on the homepage to prevent infinite redirect loops
            if (isHomePage) return;

            // 3. Check Subreddit URL
            {
                const subMatch = currentUrl.match(/\/r\/([a-zA-Z0-9_]+)/i);
                if (subMatch && subMatch[1] && (isNameBannedByPrefixSuffix(subMatch[1]) || isSubredditNameBanned(subMatch[1]))) {
                    devLog(`Banned subreddit detected: ${subMatch[1]}. Redirecting...`);
                    isRedirecting = true;
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }

            // 4. Check User URL
            const userMatch = currentUrl.match(/\/(?:u|user)\/([a-zA-Z0-9_-]+)/i);
            if (userMatch && userMatch[1] && isNameBannedByPrefixSuffix(userMatch[1])) {
                devLog(`Banned user detected: ${userMatch[1]}. Redirecting...`);
                isRedirecting = true;
                window.location.replace('https://www.reddit.com');
                return;
            }

            // 5. Fallback URL Check (unified regex policy)
            if (mentionsPremiumAdultPlatform(currentUrl) || isBlockedByRedditRegexesV295(currentUrl, true)) {
                devLog('Banned regex in URL. Redirecting...');
                isRedirecting = true;
                window.location.replace('https://www.reddit.com');
                return;
            }
        } catch (e) {}
    }

    function interceptSearchInputChanges() {
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && !eventListenersAdded.has(searchInput)) {
            const inputHandler = debounce(() => {
                if (isSearchTextBanned(searchInput.value)) {
                    searchInput.value = '';
                    if (window.location.pathname !== '/' && window.location.pathname !== '') {
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                    }
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
                if (isSearchTextBanned(query)) {
                    event.preventDefault();
                    if (window.location.pathname !== '/' && window.location.pathname !== '') {
                        isRedirecting = true;
                        window.location.replace('https://www.reddit.com');
                    }
                }
            };
            searchForm.addEventListener('submit', submitHandler);
            eventListenersAdded.add(searchForm);
        }
    }

    const recentPostsClearState = new WeakMap();

    function hideAndClearRecentPostsPanel(root = document) {
        try {
            const hosts = [];

            if (root && root.nodeType === 1 && root.matches?.('recent-posts')) {
                hosts.push(root);
            }

            if (root && root.querySelectorAll) {
                const found = root.querySelectorAll('recent-posts');
                for (let i = 0; i < found.length; i++) {
                    hosts.push(found[i]);
                }
            }

            for (let i = 0; i < hosts.length; i++) {
                const host = hosts[i];
                if (!host) continue;

                try {
                    host.style.setProperty('display', 'none', 'important');
                    host.style.setProperty('visibility', 'hidden', 'important');
                    host.style.setProperty('opacity', '0', 'important');
                    host.style.setProperty('height', '0', 'important');
                    host.style.setProperty('min-height', '0', 'important');
                    host.style.setProperty('max-height', '0', 'important');
                    host.style.setProperty('overflow', 'hidden', 'important');
                    host.style.setProperty('margin', '0', 'important');
                    host.style.setProperty('padding', '0', 'important');
                    host.style.setProperty('pointer-events', 'none', 'important');
                } catch {}

                const signature = String(host.getAttribute?.('recent-post-ids') || '').trim();
                if (!signature || signature === '[]') continue;

                const shadow = host.shadowRoot;
                if (!shadow) continue;

                const tracker = shadow.querySelector('faceplate-tracker[noun="clear_recent_module"]');
                const button = tracker?.querySelector('button');
                if (!button || typeof button.click !== 'function') continue;

                const now = Date.now();
                const previous = recentPostsClearState.get(host);
                const sameSignature = !!(previous && previous.signature === signature);
                const attempts = sameSignature ? previous.attempts : 0;
                const lastClick = sameSignature ? previous.lastClick : 0;

                if (attempts >= 3 || (sameSignature && now - lastClick < 1500)) continue;

                recentPostsClearState.set(host, {
                    signature,
                    attempts: attempts + 1,
                    lastClick: now
                });

                button.click();
                devLog('🧹 Cleared Reddit Recent Posts module');
            }
        } catch (e) {}
    }

    function hideRecentCommunitiesSection() {
        const selectors = [
            'reddit-recent-pages', 
            'shreddit-recent-communities',
            'div[data-testid="community-list"]',
            '[data-testid="recent-communities"]',
            '.recent-communities',
            'in-feed-community-recommendations',
            'community-recommendation',
            '#recent-communities-section',
            'div#recent-communities-section',
            'faceplate-expandable-section-helper#recent-communities-section',
            'summary[aria-controls="RECENT"]',
            '[aria-controls="RECENT"]',
            '#RECENT'
        ];
        
        for (let i = 0; i < selectors.length; i++) {
            const elements = document.querySelectorAll(selectors[i]);
            for (let j = 0; j < elements.length; j++) {
                const el = elements[j];
                const wrapper =
                    el.closest?.('#recent-communities-section') ||
                    el.closest?.('faceplate-expandable-section-helper#recent-communities-section') ||
                    el.closest?.('details') ||
                    el.closest?.('div.mb-sm.pb-sm') ||
                    el;
                safelyHideElement(wrapper);
            }
        }

        try {
            const navScopes = document.querySelectorAll('nav, aside, [data-testid="left-sidebar"], #left-sidebar-container, reddit-sidebar-nav, flex-left-nav-container');
            for (let i = 0; i < navScopes.length; i++) {
                const scope = navScopes[i];
                const items = scope.querySelectorAll('div, li, span, summary, faceplate-expandable-section-helper');
                for (let j = 0; j < items.length; j++) {
                    const item = items[j];
                    const text = (item.textContent || '').trim();
                    if (!text || !/^RECENT$/i.test(text)) continue;
                    const wrapper =
                        item.closest?.('#recent-communities-section') ||
                        item.closest?.('faceplate-expandable-section-helper#recent-communities-section') ||
                        item.closest?.('details') ||
                        item.closest?.('div.mb-sm.pb-sm') ||
                        item;
                    safelyHideElement(wrapper);
                }
            }
        } catch (e) {}
        
    }

    function checkAndHideNSFWClassElements() {
        if (!isHomeFeedContext()) return;
        const indicators = document.querySelectorAll(
            'shreddit-post[nsfw], shreddit-post[subreddit-nsfw], ' +
            'article .text-category-nsfw, article svg[icon-name="nsfw-fill-12"], ' +
            'article svg[icon-name="nsfw-outline"]'
        );
        for (const indicator of indicators) {
            const card = indicator.closest('article, shreddit-post');
            if (!card) continue;
            const root = getRedditScreeningRootV295(card);
            root.classList.remove('reddit-approved');
            root.classList.add('reddit-banned', 'prehide');
            safelyHideElement(root);
        }
    }

    function removeHrElements() {
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        for (let i = 0; i < hrElements.length; i++) {
            safelyHideElement(hrElements[i]);
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
            if (!element.shadowRoot || shadowRootObservers.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            screenPremiumAdultLinks(element.shadowRoot);
            
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            for (let j = 0; j < posts.length; j++) {
                const post = posts[j];
                screenRedditPostRootV295(post);
            }
            
            observeShadowRootOnce(element.shadowRoot);
        }
    }

    // --- MAIN FILTER FUNCTION ---
    function runAllChecks() {
        if (isPostPage()) {
            document.documentElement.classList.add('nr-post-page');
            document.documentElement.classList.remove('nr-home-feed', 'nr-join-feed');
        }
        const now = performance.now();
        // Newly inserted posts are screened by the mutation handler. Full UI
        // audits need no faster cadence; keeping them below React's commit rate
        // prevents repeated whole-page scans while the initial feed hydrates.
        if (now - lastFilterTime < 450) return;
        lastFilterTime = now;
        
        if (document.body && !document.body.classList.contains('reddit-filter-ready')) {
            document.body.classList.add('reddit-filter-ready');
        }

        screenPremiumAdultLinks(document);
        
        hideAnswersButton();
        
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
        observeSearchDropdown();
        
        processShadowDOM();
        processAllUnapprovedComments();
        processAllUnapprovedPosts();
        processSearchCommunities();
        hideAndClearRecentPostsPanel();
        
        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            hideRecentCommunitiesSection();
        }
        
        enforceSanity();
        
        removeHrElements();
        removeSelectorsToDelete();
        checkAndHideNSFWClassElements();
    }

    function isRedditCardEffectivelyVisible(post) {
        // A visible inner SHREDDIT-POST can be completely invisible when its
        // ARTICLE has opacity:0 or visibility:hidden. Inspect the whole chain,
        // not just the inner component's computed style.
        for (let node = post; node && node.nodeType === 1;
             node = node.parentElement || node.getRootNode?.()?.host || null) {
            const computed = getComputedStyle(node);
            if (node.hidden || computed.display === 'none' ||
                computed.visibility === 'hidden' || computed.visibility === 'collapse' ||
                Number(computed.opacity) <= 0) return false;
            if (node === document.body || node === document.documentElement) break;
        }
        return true;
    }

    function recoverGuestHomeFeed() {
        if (!isHomeFeedContext() || isPostPage()) {
            document.documentElement.classList.remove('nr-guest-feed-rescue');
            return;
        }
        if (document.querySelector('shreddit-post[user-logged-in]')) {
            document.documentElement.classList.remove('nr-guest-feed-rescue');
            return;
        }
        // Work at the ARTICLE level: both it and the inner post are independently
        // subject to the prehide CSS. A prior child-only approval never suffices.
        // Retain a narrow fallback only for *individually re-screened* guest cards.
        const candidates = document.querySelectorAll('shreddit-post:not([user-logged-in])');
        if (!candidates.length) {
            document.documentElement.classList.remove('nr-guest-feed-rescue');
            return;
        }
        let needsVerifiedRescue = false;
        let count = 0;
        const visited = new Set();
        for (const post of candidates) {
            if (++count > 70) break;
            const card = getRedditScreeningRootV295(post);
            if (!card || visited.has(card)) continue;
            visited.add(card);
            if (card.closest?.('.reddit-banned, .prehide') ||
                post.closest('.reddit-banned, .prehide') ||
                isExplicitlyNSFWPost(card) || isSuggestedJoinFeedCard(card)) continue;

            // Verify the complete card *before* re-approving it. The homepage's
            // keyword, AI, NSFW, dating, and Join rules remain authoritative.
            if (!card.classList.contains('reddit-approved') ||
                !post.classList.contains('reddit-approved') ||
                !isRedditCardEffectivelyVisible(post)) {
                if (evaluateElementForBanning(card)) {
                    card.classList.remove('reddit-approved', 'nr-guest-verified');
                    card.classList.add('reddit-banned', 'prehide');
                    safelyHideElement(card);
                    continue;
                }
                markElementAsApproved(card);
            }
            if (!card.classList.contains('reddit-approved') ||
                !post.classList.contains('reddit-approved') ||
                card.classList.contains('reddit-banned') ||
                post.classList.contains('reddit-banned')) continue;

            // CSS rescue is scoped only to cards that passed their own checks;
            // never override a blanket class for unexamined guest posts.
            if (!isRedditCardEffectivelyVisible(post)) {
                card.classList.add('nr-guest-verified');
                post.classList.add('nr-guest-verified');
                needsVerifiedRescue = true;
            }
        }
        document.documentElement.classList.toggle('nr-guest-feed-rescue', needsVerifiedRescue);
    }

    // --- INITIALIZATION AND EVENT HANDLING ---
    function init() {
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        
        runAllChecks();
        setTimeout(recoverGuestHomeFeed, 350);
        const guestFeedRecoveryInterval = setInterval(recoverGuestHomeFeed, 1900);
        intervalIds.add(guestFeedRecoveryInterval);
        
        // The documentElement observer below already watches body mutations,
        // handles fresh posts and performs the periodic full audit. A second
        // subtree observer doubled every startup React mutation's workload.
        
        const minimalInterval = setInterval(hideBannedSubredditsFromSearch, 1000);
        intervalIds.add(minimalInterval);
        
        // Document-start CSS and mutation handling hide Answers immediately;
        // the slower timer is only a fallback for navigation surfaces.
        const answersButtonInterval = setInterval(hideAnswersButton, 1200);
        intervalIds.add(answersButtonInterval);

        // Sanity loop fully unbound from document.hidden to catch background tabs!
        const sanityInterval = setInterval(() => {
            enforceSanity();
        }, 500);
        intervalIds.add(sanityInterval);
        
        // The mutation observers perform immediate screening. Keep the
        // periodic post fallback, but avoid costly peripheral DOM sweeps on
        // every pass while the user is scrolling through an already loaded feed.
        let lastPeripheralAuditV295 = -Infinity;
        function runRedditIdleAuditV295() {
            if (document.hidden) {
                runAllChecks();
                return;
            }
            processAllUnapprovedPosts();
            processAllUnapprovedComments();
            const now = performance.now();
            if (now - lastPeripheralAuditV295 < 8500) return;
            lastPeripheralAuditV295 = now;
            hideBannedSubredditsFromAllSearchDropdowns();
            processSearchCommunities();
            hideAnswersButton();
            hideAndClearRecentPostsPanel();
        }
        if (window.requestIdleCallback) {
            const idleAuditIntervalV295 = setInterval(() => {
                window.requestIdleCallback(runRedditIdleAuditV295, { timeout: 3000 });
            }, 2200);
            intervalIds.add(idleAuditIntervalV295);
        } else {
            const backgroundInterval = setInterval(() => {
                batchProcess(runRedditIdleAuditV295);
            }, 3000);
            intervalIds.add(backgroundInterval);
        }
        
        const memoryMonitorInterval = setInterval(() => {
            monitorMemoryPressure();
        }, MEMORY_CHECK_INTERVAL);
        intervalIds.add(memoryMonitorInterval);
        
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

    let redditCommentOverflowSweepQueued = false;
    function queueRedditCommentOverflowSweep() {
        if (redditCommentOverflowSweepQueued) return;
        redditCommentOverflowSweepQueued = true;
        setTimeout(() => {
            redditCommentOverflowSweepQueued = false;
            processAllUnapprovedComments();
        }, 90);
    }

    let redditOverflowSweepQueuedV295 = false;
    function queueRedditOverflowSweepV295() {
        if (redditOverflowSweepQueuedV295) return;
        redditOverflowSweepQueuedV295 = true;
        setTimeout(() => {
            redditOverflowSweepQueuedV295 = false;
            processAllUnapprovedPosts();
        }, 120);
    }

    const processNewElements = throttle((mutations) => {
        let needsSearchUpdate = false;
        let needsPostSweepV295 = false;

        const limitedMutations = Array.isArray(mutations) ? mutations.slice(0, 30) : mutations;
        
        for (let i = 0; i < limitedMutations.length; i++) {
            const mutation = limitedMutations[i];
            if (mutation.type === 'characterData') {
                const changedLink = mutation.target.parentElement?.closest?.('a[href]');
                if (changedLink) screenPremiumAdultLinks(changedLink);
                const ownComment = mutation.target.parentElement?.closest?.('shreddit-comment');
                if (ownComment) screenRedditComment(ownComment);
                continue;
            }
            if (mutation.type === 'childList') {
                const ownComment = mutation.target.closest?.('shreddit-comment');
                if (ownComment) screenRedditComment(ownComment);
            }
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
            }

            if (mutation.type === 'attributes' && mutation.attributeName === 'recent-post-ids') {
                hideAndClearRecentPostsPanel(mutation.target);
            }

            // The preview shell may be inserted before its title/snippet. Later
            // childList commits must recheck that same card in-place.
            const changedSearchCard = mutation.target.closest?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295);
            if (changedSearchCard) screenRedditSearchPreviewV295(changedSearchCard);
            
            const addedLimit = Math.min(mutation.addedNodes.length, 15);
            for (let j = 0; j < addedLimit; j++) {
                const node = mutation.addedNodes[j];
                if (!node) continue;
                if (node.nodeType === 3) {
                    const comment = node.parentElement?.closest?.('shreddit-comment');
                    if (comment) screenRedditComment(comment);
                    continue;
                }
                if (node.nodeType !== 1) continue;

                screenPremiumAdultLinks(node);

                // Never query each entire added React subtree for unrelated
                // recent-posts markup. Preserve the clearing feature when its
                // actual host arrives (including in a newly inserted fragment).
                if (node.matches?.('recent-posts') || node.querySelector?.('recent-posts')) {
                    hideAndClearRecentPostsPanel(node);
                }

                if (node.tagName && node.matches) {
                    for (let k = 0; k < selectorsToDelete.length; k++) {
                        if (node.matches(selectorsToDelete[k])) {
                            removeElementAndRelated(node);
                        }
                    }
                }

                if (node.tagName === 'A' && node.getAttribute('href') === '/answers/') {
                    hideAnswersButton();
                }
                
                if (node.tagName === 'FACEPLATE-TRACKER' || 
                    (node.querySelector && (node.querySelector('faceplate-tracker[noun="gen_guides_sidebar"]') ||
                                            node.querySelector('a[href="/answers/"]')))) {
                    hideAnswersButton();
                }
                
                const enclosingSearchCard = node.closest?.(REDDIT_SEARCH_PREVIEW_SELECTOR_V295);
                if (enclosingSearchCard) screenRedditSearchPreviewV295(enclosingSearchCard);

                const enclosingComment = node.closest?.('shreddit-comment');
                if (enclosingComment) screenRedditComment(enclosingComment);
                if (node.matches?.('shreddit-comment')) screenRedditComment(node);
                if (node.querySelectorAll) {
                    const nestedComments = node.querySelectorAll('shreddit-comment');
                    for (let k = 0; k < Math.min(nestedComments.length, 90); k++)
                        screenRedditComment(nestedComments[k]);
                }
                // React can add the credit-bar Join host AFTER this post was
                // already approved. Revoke approval as soon as that happens;
                // the :has() CSS gate conceals it before this observer fires.
                const joinPrompt = node.matches?.('shreddit-join-button[data-testid="credit-bar-join-button"]')
                    ? node : node.querySelector?.('shreddit-join-button[data-testid="credit-bar-join-button"]');
                if (joinPrompt && isRedditJoinFeedContext()) {
                    const joinPost = joinPrompt.closest?.('shreddit-post');
                    if (joinPost) screenRedditPostRootV295(joinPost);
                }

                const mediaPost = node.closest?.('shreddit-post');
                if (mediaPost && (node.closest?.('[slot="post-media-container"]') ||
                    node.matches?.('[slot="post-media-container"]'))) {
                    screenRedditPostRootV295(mediaPost);
                }

                if (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST' ||
                   (node.getAttribute && node.getAttribute('data-testid') === 'search-post-unit') ||
                   (node.getAttribute && node.getAttribute('data-id') === 'search-media-post-unit')) {
                    screenRedditPostRootV295(node);
                } else if (node.querySelectorAll) {
                    // Reddit commonly inserts a wrapper containing many posts.
                    // Screen its descendants now; no whole-document pass for
                    // every unrelated navigation, comment or icon mutation.
                    const nestedPosts = node.querySelectorAll(
                        'shreddit-post, article[data-testid="post-container"], ' +
                        '[data-testid="search-post-unit"], [data-id="search-media-post-unit"], [data-testid="search-post-with-content-preview"]'
                    );
                    const limit = Math.min(nestedPosts.length, 60);
                    for (let k = 0; k < limit; k++) screenRedditPostRootV295(nestedPosts[k]);
                    if (nestedPosts.length > limit) needsPostSweepV295 = true;
                }
                // Ordinary feed posts also have role/data-testid attributes.
                // They must not trigger a whole search-dropdown sweep for each
                // React commit. Actual dropdowns and search results still do.
                if (node.matches?.(
                    '#search-dropdown-results-container, faceplate-search-dropdown, ' +
                    'shreddit-search-dropdown, [data-testid="search-community"], ' +
                    '[data-testid="search-dropdown-item"], ' +
                    'li[data-testid="search-sdui-query-autocomplete"], ' +
                    'li.recent-search-item, [data-type="search-dropdown-item-label-text"]'
                ) || node.closest?.(
                    '#search-dropdown-results-container, faceplate-search-dropdown, shreddit-search-dropdown'
                ) || node.querySelector?.(
                    '#search-dropdown-results-container, faceplate-search-dropdown, ' +
                    'shreddit-search-dropdown, [data-testid="search-community"], ' +
                    '[data-testid="search-dropdown-item"], ' +
                    'li[data-testid="search-sdui-query-autocomplete"]'
                )) {
                    needsSearchUpdate = true;
                }
                
                if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                    shadowRootsProcessed.add(node.shadowRoot);
                    
                    processShadowSearchItems(node.shadowRoot);
                    
                    const shadowPosts = node.shadowRoot.querySelectorAll('article, shreddit-post');
                    const maxShadowPosts = Math.min(shadowPosts.length, 10);
                    for (let k = 0; k < maxShadowPosts; k++) {
                        const shadowPost = shadowPosts[k];
                        screenRedditPostRootV295(shadowPost);
                    }
                    
                    observeShadowRootOnce(node.shadowRoot);
                }
                
                if (node.querySelectorAll) {
                    // Keep cosmetic removals reactive, but traverse only once
                    // instead of running separate DOM searches for each selector.
                    const disposable = node.querySelectorAll(
                        'hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0, ' +
                        selectorsToDelete.join(', ')
                    );
                    for (let k = 0; k < disposable.length; k++) {
                        const target = disposable[k];
                        if (target.matches('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0')) {
                            safelyHideElement(target);
                        } else {
                            removeElementAndRelated(target);
                        }
                    }
                }
            }
        }
        
        // The targeted fragment scan above handles fresh posts. A bounded
        // fallback is retained if one React commit exceeded its per-pass limit.
        if (needsPostSweepV295) queueRedditOverflowSweepV295();

        if (needsSearchUpdate) {
            batchProcess(() => {
                hideBannedSubredditsFromSearch();
                hideBannedSubredditsFromAllSearchDropdowns();
                processSearchCommunities();
            });
        }
        
        hideAnswersButton();
    }, 75);

    const observer = new MutationObserver(processNewElements);
    observerInstances.add(observer);
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['recent-post-ids'],
        characterData: true
    });

    const domDetachObserver = new MutationObserver((muts) => {
        for (let i = 0; i < muts.length; i++) {
            const m = muts[i];
            if (m.removedNodes && m.removedNodes.length) {
                const maxRemoved = Math.min(m.removedNodes.length, 50);
                for (let j = 0; j < maxRemoved; j++) {
                    const n = m.removedNodes[j];
                    if (n && n.nodeType === 1) {
                        disconnectShadowObserversInSubtree(n, 0);
                    }
                }
            }
        }
    });
    observerInstances.add(domDetachObserver);
    try {
        domDetachObserver.observe(document.documentElement, { childList: true, subtree: true });
        // These primary observers are already active at document-start. Without
        // this state flag the 4-second memory monitor installed a duplicate pair.
        HEAVY_OBSERVERS_ACTIVE = true;
    } catch (e) {}

    hideBannedSubredditsFromSearch();
    hideBannedSubredditsFromAllSearchDropdowns();
    hideAndClearRecentPostsPanel();

    function syncRedditFeedPolicyForRoute() {
        document.documentElement.classList.toggle('nr-post-page', isPostPage());
        document.documentElement.classList.remove('nr-guest-feed-rescue');
        const home = isHomeFeedContext();
        document.documentElement.classList.toggle('nr-home-feed', home);
        document.documentElement.classList.toggle('nr-join-feed', isRedditJoinFeedContext());

        // Reddit sometimes RECYCLES the same cards when navigating from home
        // to a subreddit/search. An old home-only ban must not follow a safe
        // adult card there, and an old approval must not bypass the home rules.
        function resetHiddenCard(node) {
            const previouslyBanned = node.classList.contains('reddit-banned') ||
                                     node.classList.contains('reddit-search-banned') ||
                                     node.classList.contains('reddit-comment-banned');
            node.classList.remove('reddit-approved', 'reddit-banned',
                'reddit-search-banned', 'reddit-comment-approved',
                'reddit-comment-banned', 'nr-guest-verified', 'prehide');
            if (previouslyBanned) {
                for (const property of ['display', 'visibility', 'opacity', 'height',
                        'padding', 'margin', 'pointer-events', 'position', 'z-index']) {
                    if (node.style.getPropertyPriority(property) === 'important')
                        node.style.removeProperty(property);
                }
            }
            processedElements.delete(node);
            processedSearchItems.delete(node);
            permanentlyApprovedElements.delete(node);
        }
        for (const card of document.querySelectorAll(
            'article.reddit-approved, article.reddit-banned, article.prehide, ' +
            'shreddit-post.reddit-approved, shreddit-post.reddit-banned, shreddit-post.prehide, ' +
            '[data-testid="search-post-unit"], [data-id="search-media-post-unit"], ' +
            '[data-testid="search-post-with-content-preview"], ' +
            '#search-dropdown-results-container .reddit-search-approved, ' +
            '#search-dropdown-results-container .reddit-search-banned'
        )) resetHiddenCard(card);
        approvalPersistence.clear();
        lastFilterTime = -Infinity;
    }

    let currentUrl = window.location.href;
    document.documentElement.classList.toggle('nr-post-page', isPostPage());
    document.documentElement.classList.toggle('nr-home-feed', isHomeFeedContext());
    document.documentElement.classList.toggle('nr-join-feed', isRedditJoinFeedContext());
    const urlCheckInterval = setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            syncRedditFeedPolicyForRoute();
            
            cleanupCaches();
            
            const memInfo = getMemoryUsage();
            if (memInfo) {
                devLog(`🔄 URL changed - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB`);
            }

            try {
                CURRENT_POST_ID = (function () {
                    const m = window.location.href.match(/\/comments\/([a-zA-Z0-9]+)/);
                    return m ? `post_${m[1]}` : null;
                })();
                const approvedSet = (function(){
                    try {
                        const arr = getApprovedPostsArray();
                        return new Set(Array.isArray(arr) ? arr : []);
                    } catch { return new Set(); }
                })();
                ALWAYS_ALLOW_CURRENT_POST = !!(CURRENT_POST_ID && approvedSet.has(CURRENT_POST_ID));
                if (ALWAYS_ALLOW_CURRENT_POST) {
                    document.documentElement.classList.add('nr-allow-current-post');
                    document.body && document.body.classList.add('nr-allow-current-post');
                } else {
                    document.documentElement.classList.remove('nr-allow-current-post');
                    document.body && document.body.classList.remove('nr-allow-current-post');
                }
            } catch {}
            
            // Force immediate check on URL change
            runAllChecks();
        }
    }, 500);
    intervalIds.add(urlCheckInterval);

})();
