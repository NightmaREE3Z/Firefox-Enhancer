(function () {
    'use strict';

    // === DEBUG CONFIG (0 = off, 1 = on) ===
    // Set to 1 to enable detailed logging and persist redirect reasons across navigations.
    // This shows which term/pattern triggered a block/redirect even after the page reloads.
    const DEBUG = 1;

    // Internal debug state (last match details + last redirect info)
    let lastMatchDetails = null;
    let lastRedirectInfo = null;

    // === Persistent debug storage (survives redirects within the same tab) ===
    const SS_KEY = 'googlejs_last_redirect';
    function persistRedirect(info) {
        try { sessionStorage.setItem(SS_KEY, JSON.stringify(info || {})); } catch (e) {}
    }
    function readPersistedRedirect() {
        try {
            const raw = sessionStorage.getItem(SS_KEY);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            return obj && typeof obj === 'object' ? obj : null;
        } catch (e) { return null; }
    }
    function clearPersistedRedirect() {
        try { sessionStorage.removeItem(SS_KEY); } catch (e) {}
    }

    // === DEV LOGGING (safe across browsers) ===
    function devLog(message, ...rest) {
        if (!DEBUG) return;
        try { console.log('[GOOGLE.JS]', message, ...rest); } catch (e) {}
    }

    // Show any previous redirect reason right at startup (after a fast redirect)
    const previousRedirect = readPersistedRedirect();
    if (previousRedirect) {
        devLog('Previous redirect detected. Reason:', previousRedirect);
        // Keep it for reference until the next redirect; comment out next line to keep it forever in the tab.
        clearPersistedRedirect();
    }

    // Collect and expose last redirect info in memory as well
    function logRedirect(triggerContext, triggerTerm) {
        lastRedirectInfo = {
            context: triggerContext || '',
            term: String(triggerTerm || ''),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            match: lastMatchDetails || null
        };
        persistRedirect(lastRedirectInfo);
        devLog('REDIRECT by:', triggerTerm, 'context:', triggerContext, 'url:', window.location.href, 'match:', lastMatchDetails);
    }

    // Optional: expose for quick inspection in console
    try {
        window.GoogleJS = window.GoogleJS || {};
        window.GoogleJS.getLastRedirectInfo = () => lastRedirectInfo || readPersistedRedirect();
    } catch (e) {}

    devLog('=== GOOGLE.JS SCRIPT STARTING ===');
    devLog('Location: ' + window.location.href);
    devLog('Document ready state: ' + document.readyState);

    // === UA detection for platform-specific handling ===
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const isFirefox = /Firefox/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isFirefoxAndroid = isFirefox && isAndroid;
    devLog('Platform: ' + (isFirefoxAndroid ? 'Firefox Android' : (isFirefox ? 'Firefox Desktop' : 'Chrome/Desktop or other')));

    // === INSTANT WHITE OVERLAY: Show immediately at document_start ===
    // Make sure your manifest uses: "run_at": "document_start"
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

    // Keep the page background white as well to avoid gray flashes behind overlay
    try {
        document.documentElement.style.background = '#fff';
        document.body && (document.body.style.background = '#fff');
    } catch (e) {}

    let overlayRemoved = false;

    // --- Keyword arrays (unified; unchanged) ---
    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i, /\bbra\b/i, /\bass\b/i, /genera/i,
        /\bmorph\b/i, /inpaint/i, /art intel/i, /birpp/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /ismartta/i, /image enhanced/i, /image enhancing/i, /virtual touchup/i, /retouch/i, /touchup/i, /touch up/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /Blis/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhanced image/i, /kuvankäsittely/i, /editor/i,
        /vegi/i, /vege/i, /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /birppis/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i,
        /Tiffa/i, /Strat/i, /puz/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /izzi dame/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i, /generator/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /\bVega\b/i, /\bSlut\b/i, /3dit/i, /ed1t/i, /playboy/i, /poses/i,
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
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /enhanced image/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /erotiikka/i, /läpinäkyvä/i, 
        /vaatepoisto/i, /poista vaatteet/i, /vaatteiden poisto/i, /tekoäly/i, /panee/i, /panevat/i, /paneminen/i, /panemis/i, /paneskelu/i, /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimista/i, /uncover/i, /leak/i, /Micki/i,
        /Stratusfaction/i, /yhdynnässä/i, /seksikuva/i, /seksivideo/i, /seksi kuvia/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i, /panokuva/i, /pano kuva/i, /pano kuvia/i, /panokuvia/i, /banned app/i,
        /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpittäminen/i, /sormetus/i, /sormitus/i, /sormitta/i, /sormetta/i,
        /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkkyvid/i, /aikuisviihde/i, /fisting/i, /fistaus/i,
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuis sisältö/i, /aikuiskontsa/i, /filmora/i, /aikuiskontentti/i, /aikuis kontentti/i, /aikuiscontentti/i, /aikuis contentti/i, /pleasi/i, /pleasu/i, /herself/i, /her self/i, 
        /\bRembg\b/i, /\bRem bg\b/i, /\bDel bg\b/i, /\bDelbg\b/i, /delet bg/i, /fuck/i, /eras bg/i, /delet bg/i, /erase bg/i, /erasing bg/i, /bg delet/i, /bg erasing/i, /bg erase/i, /Blend face/, /Blendface/, /morphi/, /Blender face/, 
        /\bMorf\b/i, /morfi/, /skin viewer/i, /skinviewer/i, /cloth/i, /clothing/i, /clothes/i, /female/i, /al4ston/i, /p!llu/i, /p!mppi/i, /p!mpp!/i, /pimpp!/i, /nakukuva/i, /nakuna/i, /kuvaton/i, /AI model$/i, /trained model$/i,
        /Reface/i, /DeepAI/i, /GFPGAN/i, /RestoreFormer/i, /FaceMagic/i, /desnudador/i, /des nudador/i, /GAN-based/i, /diffusion/i, /latent/i, /prompt ex/i, /txt2img/i, /img2img/i, /image to image/i, /image 2 image/i, /model/i, 
        /imagetoimage/i, /image2image/i, /girl/i, /woman/i, /women/i, /babe/i, /waifu/i, /wife/i, /spouse/i, /celeb/i, /celebrit/i, /Face Magic/i, /ex prompt/i, /example prompt/i, /prompt example/i, /4l4ston/i, /last0n/i, /l4st0n/i,
        /removebg/i, /remove bg/i, /remov bg/i, /removal bg/i, /ia onl/i, /removebg/i,  /removalbg/i, /rembg/i, /rem background/i, /del background/i, /eras background/i, /erase background/i, /erasing background/i, /butth/i, /buttc/i, 
        /\bIA\b/i,/\bIas\b/i, /\b-Ia\b/i, /\bIa-\b/i, /background eras/i, /background del/i, /background rem/i, /background off/i, /off background/i, /background out/i, /out background/i, /removbg/i, /ladies/i, /lady/i, /butts/i,
        /buttc/i, /butt c/i, /butt h/i, /butt s/i, /\bMLM\b/i, /\bLLM\b/i, /\bTit\b/i, /\bGen\b/i, /\bTits\b/i, /learn model/i, /mach model/i, /titten/i, /combin fac/i, /merg fac/i, /fac merg/i, /fac comb/i, /fac blend/i, /joinface/i, 
	/poista vaatteet/i, /poista vaat/i, /vaatteidenpoist/i, /vaatepoist/i, /poistavaat/i, /poistovaat/i, /too merg/i, /merg too/i, /two fac/i, /two fac/i, /too fac/i, /too fac/i, /fac join/i, /join fac/i, /bg remov/i, /Trish/i,
        /join 2 fac/i, /Stormwrestl/i, /Stormrassl/i, /Storm wrestl/i, /Storm rassl/i, /Storm rassl/i, /Toni AEW/i, /Storm AEW/i, /Toni WWE/i, /Toni AEW/i, /Genius of The Sky/i, /\bToni\b/i, /huora/i, /huoru/i, /horo/i, /horats/i,
        /prostitoitu/i, /ilotyttå/i, /ilotyttö/i, /ilötyttö/i, /ilötytto/i, /ilåtyttå/i, /ilåtyttö/i, /iløtyttö/i, /iløtytto/i, /iløtyttø/i, /il0tyttö/i, /il0tytto/i, /il0tytt0/i, /il0tyttå/i, /il0tyttø/i, /1lotyttö/i, /1lotytto/i, 
        /!lotyttö/i, /ilotyttø/i, /ilotytt0/i, /ilotytto/i, /bordel/i, /bordel/i, /bordelli/i, /ilotalo/i, /ilåtalo/i, /ilåtalå/i, /ilotalå/i, /iløtalo/i, /ilötalo/i, /il0talo/i, /iløtalå/i, /ilötalå/i, /ilotalø/i, /erootti/i,
        /\b0rg\b/i, /\bg45m\b/i, /\bGa5m\b/i, /\bG4sm\b/i, /\b@$\b/i, /\*/i, /erotii/i, /erooti/i, /erootii/i, /\bkuvake\b/i, /kuvakenet/i, /venoi/i, /venic/i, /kuvake.net/i, /toniwwe/i, /tonywwe/i, /\bphotor\b/i, /\bfotor\b/i, 
        /Shirakawa/i, /Shira/i, /Shiri/i, /Shir/i, /biscit/i, /bisci/i, /bisce/i, /biszit/i, /bizcit/i, /biskui/i, /bizkita/i, /bizkitb/i, /bizkitc/i, /bizkitd/i, /bizkitt/i, /bizkitx/i, /bizkitz/i, /bizkitn/i, /bizkitm/i, /buttz/i, 
        /bizkito/i, /bizkity/i, /bizkith/i, /bizkitv/i, /bizkitå/i, /bizkitä/i, /bizkitö/i, /biscuita/i, /biscuitb/i, /biscuitc/i, /biscuitd/i, /biscuite/i, /biscuitf/i, /biscuitg/i, /biscuith/i, /biscuiti/i, /biscuitj/i, /Leona/i, 
        /biscuitk/i, /biscuitl/i, /biscuitm/i, /biscuitn/i, /biscuito/i, /biscuitp/i, /biscuitq/i, /biscuitr/i, /biscuits/i, /biscuitt/i, /biscuitu/i, /biscuitv/i, /biscuitw/i, /biscuitx/i, /biscuity/i, /biscuitz/i, /biscuitå/i, 
        /biscuitä/i, /biscuitö/i, /biscuitö/i, /butta/i, /buttb/i, /buttc/i, /buttd/i, /buttf/i, /buttg/i, /butth/i, /butti/i, /buttj/i, /buttk/i, /buttl/i, /buttm/i, /buttn/i, /butto/i, /buttp/i, /buttq/i, /buttr/i, /butts/i, 
        /buttt/i, /buttu/i, /buttv/i, /buttw/i, /buttx/i, /butty/i, /buttz/i, /buttå/i, /buttä/i, /buttö/i, /Micky/i, /Mickie/i, /Mickie James/i, /Dixie/i, /Carter/i, /\bTNA\b/i, /\bGina\b/i, /\bGin4\b/i, /\bG1n4\b/i, /Gina Adams/i, 
        /\bG1na\b/i, /Valtez/i, /\bGlna\b/i, /\bG!na\b/i, /Gina Adam/i, /Adams WWE/i, /Gina WWE/i, /windsor/i, /alex wind/i, /Alex Windsor/i, /analsex/i, /\bGril\b/i, /\bGrils\b/i, /wemen's/i, /wemen/i, /wemon's/i, /wemons/i, /The Kat/,
        /Nikki/i, /ldaies/i, /laadie/i, /laadis/i, /leydis/i, /leydies/i, /lewdy/i, /lewdi/i, /lewdie's/i, /wuhmans/i, /wahmans/i, /wehmans/i, /Torrie/i, /Torr1/i, /Torr!/i, /Torrl/i, /wilson/i, /Kitty WWE/, /\bGail\b/i, /\bKim\b/i, 
        /\bAshley\b/i, /Dawn Marie/i, /Down Marie/i, /Massaro/i, /\bPamela\b/i, /\bBrooke\b/i, /\bTylo\b/i, /\bCatherine\b/i, /\bBridget\b/i, /\bSally\b/i, /0rg4/i, /org4/i, /org4/i, /orgy/i, /orgi/i, /org@/i, /0rg@/i, /0rgi/i, /0rga5m/i, 
        /origas/i, /0riga/i, /0r1g4/i, /0rlg4/i, /orlg4/i, /0rlg@/i, /orlg@/i, /origa/i, /0riga/i, /or1ga/i, /orig4/i, /0r1g4/i, /0rlga/i, /orlg4/i, /0rlg4/i, /0rlg@/i,/orlg@/i, /0rrg4/i, /orrg4/i, /or1g@/i, /0r1g@/i, /0r1ga/i, /0r!g@/i,
        /0r!g4/i, /0rig@/i, /0rig4/i, /0r9ga/i, /0r9g4/i, /0r1q4/i, /0r1qa/i, /0rlg4h/i, /or1g@h/i, /orrga/i, /orrgaa/i, /orgaa/i, /\bApple\b/i, /Dreamboot/i, /Dream boot/i, /\bSX\b/i, /Sxuel/i, /Sxual/i, /Sxu3l/i, /5xu3l/i, /5xuel/i, 
        /5xu4l/i, /5xual/i, /dre4m/i, /dr34m/i, /bo0th/i, /b0oth/i, /b0o7h/i, /bo07h/i, /b007h/i, /b00th/i, /booo/i, /b0oo/i, /bo0o/i, /boo0/i, /b000/i, /booo/i, /n000/i, /n00d/i, /no0d/i, /n0od/i, /\bNud\b/i, /\bdpnod\b/i, /\bdp nod\b/i, 
        /\bdp nood\b/i, /\bdp nod\b/i, /\bdep nod\b/i, /dpnod/i, /dpnood/i, /dpnud/i, /depnud/i, /depnuud/i, /depenud/i, /depenuu/i, /dpepenud/i, /dpeepenud/i, /dpeepnud/i, /dpeependu/i, /dpeepndu/i, /Elayna/i, /Eleyna/i, /Eliyna/i,
        /Elena/i, /Elyna/i, /Elina WWE/i, /Elyna WWE/i, /Elyina/i, /Elina Blac/i, /Elina Blak/i, /Aikusviihde/i, /Aikus viihde/i, /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i,
        /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, /topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, 
        /Jenn1/i, /J3nn1/i, /J3nni/i, /J3nn4/i, /Jenn4/i, /persreikä/i, /perse reikä/i, /pers reikä/i, /pyllyn reikä/i, /pylly reikä/i, /pyllynreikä/i, /pyllyreikä/i, /persa/i, /pers a/i, /anusa/i, /anus a/i, /pers-/i, /pylly-/i, /m471c/i,
        /pyllyn-/i, /-reikä/i, /-aukko/i, /-kolo/i, /pimpp/i, /pimpe/i, /pinpp/i, /pinpi/i, /pimpi/i, /pimps/i, /pimsu/i, /pimsa/i, /pimps/i, /pilde/i, /pilper/i, /tussu/i, /tuhero/i, /emätin/i, /softorbit/i, /soft orbit/i, /\bFux\b/i,
        /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, /OracleVM/i, /virtualmachine/i, /virtual machine/i,
        /virtuaalikone/i, /virtuaali kone/i, /virtuaali tietokone/i, /virtuaalitietokone/i, /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, /virtuaali masiina/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /mat1c/i,
        /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i,
        /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i, /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /ma71c/i,
        /virtmachine/i, /virt-machine/i, /virtumachine/i, /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, /\bMachiene\b/i, /vi mach/i, /vir mach/i,
        /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /virtual machi/i, /waterfox/i, /water fox/i, /waterf0x/i, /water f0x/i, /waterfux/i, /water fux/i, /ma7ic/i,
        /\bMimmi\b/i, /\bMimmuska\b/i, /\bM1mmi\b/i, /\bM1mmuska\b/i, /\bMimm1\b/i, /\bM1mmusk4\b/i, /\bMimmusk4\b/i, /lahiopekoni/i, /lähiopekoni/i, /lähiöpekoni/i, /lahiöpekoni/i, /LTheory/i, /LuTheory/i, /LusTheory/i, /L-Theory/i, /m4tic/i,
        /LustTheory/i, /Lust Theory/i, /Lu-Theory/i, /Lus-Theory/i, /Lust-Theory/i, /ComfyUI/i, /Comfy-UI/i, /ComfyAI/i, /Comfy-AI/i, /Midjourney/i, /StaphMc/i, /Staph McMahon/i, /MeekMahan/i, /MekMahan/i, /MekMahaan/i, /Mek Mahaan/i, /4ut0/i,
        /Meek Mahaan/i, /Meek Mahan/i, /Meek Mahon/i, /Mek Mahon/i, /MeekMahon/i, /MekMahon/i, /CoAi/i, /ComAi/i, /ComfAi/i, /ComfoAi/i, /ComforAi/i, /ComfortAi/i, /ComfortaAi/i, /ComfortabAi/i, /ComfortablAi/i, /ComfortableAi/i, /Aut0/i, /4uto/i,
        /Co-Ai/i, /Com-Ai/i, /Comf-Ai/i, /Comfo-Ai/i, /Comfor-Ai/i, /Comfort-Ai/i, /Comforta-Ai/i, /Comfortab-Ai/i, /Comfortabl-Ai/i, /Comfortable-Ai/i, /Runcomfy/i, /Run comfy/i, /Run-comfy/i, /Aut1111/i, /Automatic11/i, /Automatic 11/i, /m4t1c/i,
        /m4t1c/i, /mat1c/i, /m4tic/i, /m47ic/i, /ma7ic/i, /ma71c/i, /m471c/i, /Becky/i, /Becki/i, /Rebecca/i, /Amber/i, /Amber Heard/i, /without cloth/i, /without pant/i, /without tshirt/i, /without t-shirt/i, /without boxer/i, /b0x3r/i, /box3r/i,
        /b0xer/i, /woman without/i, /women without/i, /girl without/i, /lady without/i, /ladies without/i, /tyttöjä/i, /naisia/i, /tytöt/i, /naiset/i, /nainen/i, /naikkoset/i, /mimmejä/i, /misu/i, /pimu/i, /lortto/i, /lutka/i, /lumppu/i, /narttu/i, 
        /horo/i, /huora/i, /huoru/i, /girlfriend/i, /boyfriend/i, /girl friend/i, /boy friend/i, /sperm/i, /bikini/i, /linger/i, /underwear/i, /under wear/i, /without dres/i, /with out dres/i, /bik1/i, /Jazmyn/i, /Jaszmyn/i, /Jazsmyn/i, /Jazmin/i,
        /Dualipa/i, /Dua Lipa/i, /Dual Lipa/i, /Dual ipa/i, /chang pos/i, /selfie body/i, /belfie/i, /pos chang/i, /post chang/i, /change post/i, /change pose/i, /post change/i, /pose change/i, /pose change/i, /posture change/i, /Jasmin/i, /stefe/i, 
        /postu edit/i, /pose edit/i, /edit postu/i, /edit pose/i, /editor postu/i, /editor pose/i, /postu editor/i, /pose editor/i, /postu modi/i, /pose modi/i, /pic online/i, /pict online/i, /phot onli/i, /fhot onli/i, /foto onli/i, /body selfie/i,
        /body belfie/i, /full body/i, /pic body/i, /pict body/i, /phot body/i, /image body/i, /img body/i, /postu tweak/i, /pose tweak/i, /twerk/i, /pose swap/i, /post swap/i, /body swap/i,  /pose adjust/i, /post adjust/i, /body adjust/i, /stefa/i, 
        /adjust pose/i, /adjust posture/i, /pose trans/i, /post trans/i, /pose morph/i, /post morph/i, /body morph/i, /body reshape/i, /shape body/i, /repose/i, /repose edit/i, /pose redo/i, /repose chang/i, /body editor/i, /body filter/i, /filter body/i,
        /angle chang/i, /change angle/i, /edit angle/i, /camera angle/i, /head turn/i, /body turn/i, /pose reconstruct/i, /reconstruct pose/i, /pose fix/i, /fix pose/i, /body fix/i, /fix body/i, /edit selfie/i, /AIRemove/i, /RemoveAI/i, /RemovalAI/i, 
        /selfie editor/i, /selfie morph/i, /pose shift/i, /posture shift/i, /angle shift/i, /pic shift/i, /phot shift/i, /img shift/i, /ima shift/i, /promeai/i, /prome-ai/i, /openpose/i, /open pose/i, /open-pose/i, /AIRemov/i, /RemovAI/i, /AIRemoving/i, 
        /pose-open/i, /poseopen/i, /pos open/i, /\bLily\b/i, /\bLili\b/i, /\bLilli\b/i, /\bLilly\b/i, /Lily Adam/i, /Lilly Adam/i, /\bTatu\b/i, /Toiviainen/i, /Tatujo/i, /PiFuHD/i, /Hirada/i, /Hirata/i, /Cathy/i, /Kathy/i, /Catherine/i, /AIRemoval/i, 
        /Prim3r/i, /Pr1m3r/i, /Pr1mer/i, /Primar/i, /Pr1m4r/i, /Pr1mar/i, /Pramer/i, /Pramir/i, /LaPrime/i, /LaPrima/i, /LaPr1ma/i, /L4Pr1ma/i, /LaPr1m4/i, /LaPrim4/i, /LaPrim3/i, /LaPr1m3/i, /LaPr1me/i, /Prim3r/i, /Primer/i, /stefe/i, /stefa/i, 
        /Premare/i, /La Primare/i, /Julianne/i, /Juliane/i, /Juliana/i, /Julianna/i, /Rasikangas/i, /Rasikannas/i, /Jade Cargil/i, /Jade WWE/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i, /barlow/i, /Jad3 WWE/i,
        /Nikki/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, /Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Amanda Huber/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /b-job/i, 
        /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i, /Yamashita/i, /Adriana/i, /Nia Jax/i, /McQueen/i, /Kasie Cay/i, /\bFuk\b/i, /fukk/i, /fukc/i, /fucc/i, /\bFuc\b/i, /hawt/i, /h4wt/i, /h0wt/i, /d!ck/i, /dlck/i, /d1ck/i, /c0ck/i,
        /5yvä/i, /join2fac/i, /flexclip/i, /pixelmator/i, /perfectcorp/i, /facejoin/i, /d1c/i, /d!c/i, /d!k/i, /d!c/i, /her0/i, /h3r0/i, /h3ro/i, /prompt/i, /pr0mpt/i, /pr0mp7/i, /promp7/i, /#/i, /##/i, /Sherilyn/i, /0rg@5m/i, /headgen/i, /head gen/i,
	/genhead/i, /genhead/i, /HeyGen/i, /GenHey/i, /Mafiaprinsessa/i, /ai twerk/i, /twerk ai/i, /mangoanimat/i, /photo jiggle/i, /animat pic/i, /animat pho/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /animat ima/i, /animat pic/i, 
	/animat pho/i, /animat ima/i, /animat img/i, /pic animat/i, /pho animat/i, /img animat/i, /ima animat/i, /photo animat/i, /image animat/i, /make pic mov/i, /make pho mov/i, /make img mov/i, /make ima mov/i, /gif pic/i, /gif pho/i, /gif img/i, 
	/gif ima/i, /photo to gif/i, /image to gif/i, /pic to gif/i, /pic to vid/i, /photo to video/i, /image to video/i, /ph0t/i, /pho7/i, /ph07/i, /1m4g/i, /im4g/i, /1mag/i, /!mag/i, /!m4g/i, /!mg/i, /v1d3/i, /vid3/i, /v1de/i, /vld3/i, /v1d3/i, /g!f/i,
	/RemovingAI/i, /blowjob/i, /bjob/i, /mangoai/i, /mangoapp/i, /mango-app/i, /ai-app/i, /mangoanim/i, /mango anim/i, /mango-anim/i, /lantaai/i, /lantaaa/i, /motionai/i, /changemotion/i, /swapmotion/i, /motionsw/i, /motionc/i, /\bmotion\b/i, /poseai/i,
	/AIblow/i, /5uck/i, /Suckin/i, /Sucks/i, /Sucki/i, /Sucky/i, /AIsuck/i, /AI-suck/i, /drool/i, /RemovingAI/i, /blowjob/i, /bjob/i, /b-job/i, /bj0b/i, /bl0w/i, /blowj0b/i, /dr0ol/i, /dro0l/i, /dr00l/i, /BJAI/i, /AIBJ/i, /BJ0b/i, /BJob/i, /B-J0b/i, 
	/B-Job/i, /Suckjob/i, /Suckj0b/i, /Suck-job/i, /Suck-j0b/i, /Mouthjob/i, /Mouthj0b/i, /M0uthjob/i, /M0uthj0b/i, /Mouth-job/i, /Mouth-j0b/i, /M0uth-job/i, /M0uth/i, /M0u7h/i, /Mou7h/i, /MouthAI/i, /MouthinAI/i, /MouthingAI/i, /AIMouth/i, /BlowAI/i, 
	/AIBlow/i, /BlowsAI/i, /BlowingAI/i, /JobAI/i, /AIJob/i, /Mouthig/i, /Suck/i, /ZuckCock/i, /ZuckC/i, /ZuckD/i, /ZuckP/i, /Zuckz/i, /Zucks/i, /Zuckc/i, /Zuzkc/i, /YouZuck/i, /ZuckYou/i, /AIZuck/i, /ZuckAI/i, /Cuck/i, /Guck/i, /SDuck/i, /Cheek/i,
	/Sukc/i, /Sukz/i, /AISucc/i, /SuccAI/i, /Suqz/i, /Suqs/i, /Suqc/i, /Suqq/i, /Suqq/i, /Suqi/i, /Suqz/i, /Sucq/i, /cukc/i, /boob/i, /b0ob/i, /b00b/i, /bo0b/i, /titjob/i, /titty/i, /titti/i, /j0b/i, /w0rk/i, /assjob/i, /buttjob/i, /wank/i, /w4nk/i, 
	/tittt/i, /tiitt/i, /crotch/i, /thigh/i, /legjob/i, /asssex/i, /buttsex/i, /titsex/i, /buttsex/i, /ass sex/i, /butt sex/i, /tit sex/i, /butt sex/i, /buttstuff/i, /butt stuff/i, /p0rn/i, /redtube/i, /xhamster/i, /asstube/i, /butttube/i, 
	/adulttube/i, /adult tube/i,
    ];

    // Special Regexes array, kept separate for readability.
    const specialRegexes = [
        /gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img)))|(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|denois(?:e|er|ing)?)(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img))?(?:[\s_\-\/.]{0,3}gr[a4][i1l]n)|gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic|image|img))|(?:ph(?:o|0)?t(?:o|0)?|pic|image|img)(?:[\s_\-\/.]{0,3}fix)/i,
        /(?:n(?:o|0)ise(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?))|(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?)(?:[\s_\-\/.]{0,3})n(?:o|0)ise|de[\s_\-\.]?n(?:o|0)is(?:e|er|ing)?)/i, /make.*(move|gif|video)/i, /photo.*(move|gif|video)/i, /image.*(move|gif|video)/i, /pic.*(move|gif|video)/i, /img.*(move|gif|video)/i, /booty/i, /ass.*(animat|ai|move)/i, /twerk/i, /twerking/i, /jiggle/i, /bounce.*(ai|gif)/i, /booty.*(ai|gif|video|animat)/i, /ass.*(ai|gif|video|animat)/i, /mangoanimat/i, /deepnude/i, /undress/i, /strip.*ai/i, /nude.*ai/i, /clothing.*remove/i, /clothes.*remove/i, /remove.*(clothes|clothing|dress)/i, /dress.*remov/i, /face.*(swap|deepfake|replace)/i

    ];

    const stringKeywordsToHide = [
        "Bliss", "Tiffany", "Tiffy", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Tegan Nox", "Charlotte Flair", "Becky Lynch", "Michin", "Mia Yim", "WWE Woman", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven", "Alba Fyre", "@yaonlylivvonce", 
        "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Jordynne", "WWE Women", "WWE Women's", "WWE Divas", "WWE Diva", "Maryse", "Samantha", "Irwin WWE", "Irvin WWE", "Irvin AEW", "Irwin AEW", "Candice LeRae", "Nia Jax", "Naomi", "Bianca Belair", 
        "Charlotte", "Flair", "Trish", "Stratus", "MSEdge", "Izzi Dame", "Izzi WWE", "Dame WWE", "play boy", "Young Bucks", "Jackson", "NXT Women's", "AI app", "NXT Woman", "Jessika Carr", "Carr WWE", "Jessica Carr", "Jessika Karr", "Karr WWE", "poses", 
        "posing", "Lash Legend", "Jordynne Grace", "Isla Dawn", "editation", "Raquel Rodriguez", "DeepSeek", "Jessika WWE", "Jessica WWE", "Jessica Karr", "WWE Dame", "WWE Izzi", "playboy", "deepnude", "undress", "nudify", "nude app", "nudifier", "faceswap", 
        "facemorph", "morph face", "swapface", "Nikki", "Brie", "Opera Browser", "TOR Browser", "TOR-Browser", "TOR-selain", "TOR selain", "nudecrawler", "AI edit", "AI edited", "browser", "selain", "Brave-selainta", "Brave-selaimen", "Undress AI", "DeepNude AI", 
        "editing", "Skye Blue", "tarkoitiitko: nudify", "undress-app", "deepnude-app", "nudify-app", "Lola Vice", "Vice WWE", "Opera GX", "Sasha Banks", "-selainta", "selaimen", "-selaimen", "Lola WWE", "Alexis", "crotch", "WWE Xoxo", "Morgan Xoxo", "dreamtime", 
        "pusy", "pics edit", "pic edit", "pusi", "fappening", "naked", "n8ked", "n8k3d", "nak3d", "nud3", "Tiffy", "Safari", "vaatteiden poisto", "dreamtime app", "mature content", "mature site", "adult content", "adult site", "inpaint", "photopea", "fotopea", 
        "Steward", "edit app", "picture edit", "Tiffy Time", "picresize", "lunapic", "pixelixe", "gay", "1fy", "!fy", "lfy", "de3p", "OperaGX", "Perez", "photo edit", "d33p", "3ip", "without", "cameltoe", "dreamtime AI", "Joanie", "cleavage", "fuck", "rule34", 
        "r34", "r_34", "Rule 34", "image edit", "Rul", "Rul34", "Rul 34", "pic app", "Stewart", "Perze", "Stratton", "Ruca", "Frost AI", "Laurer", "AI Frost", "frost.com", "onlyfans", "only fans", "fantime", "fan time", "okfans", "ifans", "ifan", "Loyalfans", 
        "Loyalfan", "Fansly", "JustForFans", "samuels", "ok fans", "Just for fans", "i fans", "Loyal fans", "Fan sly", "fans only", "Jaida WWE", "fan only", "Fan loyal", "Fans loyal", "biscuit booty", "editor app", "Trans", "Kristen", "MS Edge", "Transvestite", 
        "lingeri", "linger1", "l1ngeri", "l1nger1", "ling3r1", "l1ng3ri", "l1ng3r1", "Baker", "Biscuit Butt", "Birppis", "Birpppis", "deviant art", "upscale", "upscaling", "Bella", "sex", "facetune", "face tune", "tuning face", "face tuning", "facetuning", 
        "tuningface", "biscuit ass", "Chyna", "Gina Adams", "bikini", "Kristen Stewart", "biscuit backside","Sydney Sweeney", "Britt Baker", "Deepseek", "shag", "shagged", "fake", "cloth", "Blis", "LGBTQ", "pant", "fat fetish", "Object", "adultcontent", "F4NS", 
        "Carmella", "Adams WWE", "nsfw", "18+", "18 plus", "18 plus", "porn", "penetration", "filmora", "xxx", "nudifier", "nudifying", "nudity", "Jaida Parker", "F4N5", "undressing", "undressifying", "generative", "undressify", "Goddess", "Perry WWE", "Toni Storm", 
        "FAN5", "Harley", "Cameron", "Merlio", "Hayter", "Ripley", "Rhea Ripley", "Microsoft Edge", "askfm", "ask fm", "CJ WWE", "queer", "Pride", "prostitute", "escort", "fetish", "v1ds", "m4ny", "v1d5", "erotic", "LGBT", "Gina WWE", "blowjob", "Sportskeeda", "whoring", 
        "AI Tool", "aitool", "vagina", "genital", "booty", "nudyi", "Nudying", "Nudeying", "derriere", "busty", "slut", "whore", "whoring", "camgirl", "cumslut", "fury foot", "fury feet", "Jaida", "DeepSeek", "DeepSeek AI", "fansly", "patreon", "manyvids", "chaturbate", 
        "myfreecams", "Samsung Internet", "Policy template", "Templates", "Policies", "onlifans", "camsoda", "stripchat", "bongacams", "livejasmin", "Shirai", "Io Sky", "Sky WWE", "Sky Wrestling", "Sky wrestle", "foot fury", "feet fury", "Bleis", "WWE woman", "WWE women", 
        "amateur", "5 feet of fury", "five feet of fury", "Velvet Sky", "onl1", "celeb", "0nl1", "Diipfeikki", "Lana Perry", "Vince Russo", "Russo", "Goddess WWE", "Mandy Rose", "Chelsea Green", "Zelina Vega", "Valhalla", "IYO SKY", "Io Shirai", "Iyo Shirai", "Dakota Kai", 
        "Asuka", "Kairi Sane", "Kamifuku", "Satomura", "Thekla", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey", "Dana Brooke", "Aubrey", "Edwards", "Alicia", "Atout", "Tamina", "Alicia Fox", "Summer Rae", "Layla", "Michelle McCool", "Eve Torres",  "Kelly Kelly", 
        "Kelly2", "Kelly 2", "Melina WWE", "Brittany", "Aubert", "Renee Paquette", "Parker WWE", "Melina wrestler", "Jillian Hall", "Mickie James", "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly", "Jazz", "Lana Del Rey", "Gail Kim", "Awesome Kong", 
        "Madison Rayne", "Velvet Sky", "Angelina", "Brooke", "Tessmacher", "Havok", "Renee", "Britany", "Britanny", "Del Ray", "Su Yung", "Taya Valkyrie", "Deonna", "Purrazzo", "Anna Jay", "Tay Conti", "Deonna Purrazzo", "Saraya", "Tay Melo", "Willow Nightingale", "Noelle", 
        "Syväväärennös", "Del Rey", "Lexi", "Hikaru Shida", "Thea Hail", "Yuka", "Sakazaki", "Nyla Rose", "Sakura", "Penelope", "Shotzi", "Miia Yim", "Miia Yam", "CJ Perry", "deviantart", "Charlotte", "Mickie", "Micky", "Carolina", "Caroline", "Charlotte Flair", "J4ida",
        "Blackheart", "Tegan", "Becky", "Lynch", "Bailey", "Giulia", "Mia Yam", "Michin", "Mia Yim", "AJ Lee", "Paige", "Liv Morgan", "Piper Niven", "Bayley", "Jaida", "Jaidi", "NXT Womens", "NXT Women", "NXT Woman", "Jordynne Grace", "Jordynne", "Uhkapeli", "Alex Windsor", 
        "Uhka peli", "Sunny", "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Uhkapelaaminen", "J41D4", "Ja1d4", "Lana WWE", "Scarlett Bordeaux", "Kayden Carter", "J41da", "Alba Fyre", "Isla Dawn", "Raquel Rodriguez", "B-Fab", "Uhka pelaaminen", "Jaid4",  
        "Lyra Valkyria", "Indi Hartwell", "Blair Davenport", "Maxxine Dupri", "Dave Meltzer", "Natalya", "Nattie", "Electra Lopez", "Valentina Feroz", "Amari Miller", "Sol Ruca", "Yulisa Leon", "Arianna", "Young Bucks", "Matt Jackson", "Nick Jackson", "nadke", "Karmen Petrovic", 
        "Ava Raine", "Cora Jade", "Gamble", "Feikki", "Jacy Jayne", "Gigi Dolin", "Tatum WWE", "dress", "Fallon Henley", "Kelani Jordan", "explicit", "AEW", "justforfans", "Katana Chance", "Mercedes", "Gambling", "Renee Young", "Paxley", "NXT Women", "adult site", "cam4", 
        "biscuit rear", "d3ep", "Sweeney", "Britt", "Mariah", "puzzy", "editing app", "linq", "pussy", "tushy", "Roxanne", "Blies", "CJ Lana", "Satomura", "Statlander", "***", "###", "@@", "#*", "*#", "@*", "*@", "#@", "@#", "sheer", "face replace", "face merge", "face blend", 
        "faceblend", "AI face", "neural", "AI morph", "face animation", "deep swap", "swap model", "photorealistic swap",  "synthetic face", "hyperreal", "hyper real", "reface", "facereplace", "facefusion", "face reconstruction", "wondershare", "AI face recreation", 
        "virtual morph", "face synthesis", "neural face swap", "deep neural face", "AI-powered face swap", "face augmentation",  "digital face synthesis", "virtual face swap", "hyperreal AI face", "photo-real AI face", "face deepfake", "synthetic portrait generation", 
        "AI image transformation", "face fusion technology", "deepfak portrait", "machine learning", "generation", "generative", "AI model face swap", "face generation AI", "face replacement AI", "video face morphing", "3D face morph", "AI facial animation", "deepfake avatar", 
        "synthetic avatar creation", "facial", "AI model swap", "deep model swap", "image to face morph", "AI character face", "0rg@sm", "0rga5m", "0rg@5m", "0rg@$m", "org@$m", "0rga$m", "orga$m", "w4nk", "fl35h", "**", "***", "Saya Kamitani", "Irving", "Naomi", "Belts Mone",
        "face remapping AI", "synthetic media", "AI-created character face", "face replacement tool", "photo trans", "pict trans", "image trans", "virtual avatar face", "AI video face replacement", "digital face replacement", "hyperreal synthetic face", "AI face transformer", 
        "face generation model", "realistic face", "face technology", "face tech", "3D morph face", "face AI animation", "real-time face swap", "AI-driven photo manipulation", "deepfake model creation", "digital persona", "All Elite", "Elite Wrestling", "video generat", "Windsor",
        "face overlay", "synthetic person", "facial blending", "virtual character face swap", "photorealistic face generator", "face altering AI", "realistic AI swap", "face expression morphing", "video gen", "hyperreal", "face projection", "synthetic face swap", "face model", 
        "virtual human face", "venice", "vanice", "venica", "venoise", "venise", "vanica", "n@ked", "onnly", "nekkid", "nudee", "nudy", "noodz", "neude", "nudesz", "HorizonMW", "f4nslie", "f@nsly", "fan5ly", "fan-sly", "deep nuud", "deepnud", "deapnude", "d33pnud3", "f@n", "0nly", 
        "0nlifans", "onlii", "onlifanz", "n4ked", "nakid", "nakd", "nakie", "s3x", "dreambooth", "secks", "seggs", "Dream booth", "seks", "Erase clothes", "AI uncloth", "Unclothing AI", "Gen AI pics", "text-to-undress", "text2nude", "remove outfit", "undress filter", "persona creation",
        "stripfilter", "clothing eraser", "nudify tool", "leak editor", "Realistic nude gen", "fleshify", "Skinify", "Alex Kaufman", "Lexi Kaufman", "Lexi Bliss", "Tenille Dashwood", "Saraya Knight", "Paige WWE", "!fy", "1fy", "lfy", "Biggers", "Celeste Bonin", "Ariane Andrew", 
        "Brianna Monique Garcia", "Stephanie Nicole Garcia", "deepany", "CJ Perry", "Lana Rusev", "Pamela Martinez", "Ashley Sebera", "Ayesha Raymond", "Marti Belle", "Alisha Edwards", "image2video", "safari", "Nicol", "Garcia", "Nikki Garcia", "Wrestling babe", "Divas hot", 
        "WWE sexy", "spicy site", "deep-any", "for fans", "VIP pic", "premium content", "sussy pic", "after dark", "NSFL", "artistic nude", "tasteful nude", "sus site", "La Leona", "uncensored version", "alt site", "runwayml", "runway", "run way", "runaway", "run away", "replicate.ai", 
        "huggingface", "hugging face", "cloth remover", "AI eraser", "Magic Editor", "magicstudio", "cleanup.pictures", "Trenesha", "app123", "modapk", "apkmod", "tool hub", "tools hub", "alaston", "alasti", "vaatteeton", "paljas", "seksikäs", "pimppi", "vittu", "tissit", "nänni", 
        "sukupuolielin", "paljain", "seksisivu", "alastomuus", "sus content", "fucking", "face +", "aikuissisältö", "aikuissivusto", "seksikuva", "homo", "ndue", "nakde", "lesbo", "transu", "pervo", "face fusion", "dick", "cock", "penis", "breast", "thigh", "leggings", "leggins", 
        "🍑", "🍆", "💦", "👅", "🔞", "😈", "👙", "🩲", "👠", "🧼", "🧽", "( . )( . )", "| |", "( o )( o )", "(!)", "bg remover", "jeans", "jerking", "jerks", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "imgtovid", "img2vid", "imagetovideo", "face+",
        "her butt", "herbutt", "butth", "butt hole", "assh", "ass h", "buttc", "butt c", "buttcheek", "butt cheek", "ladies", "lady", "runway", "runaway", "run way", "run away", "cheek", "aasho", "ääsho", "ääshö", "face join", "Shira", "Blake Monroe", "replicate.ai", "fl3sh", 
        "poistamis", "vaatteidenpoistaminen", "vaatteiden poistaminen", "facemerg", "facefusi", "face merg", "face fusi", "face plus", "faceplus", "merge two faces", "merge 2 faces", "merging 2 faces", "merging two faces", "join face", "Monroe", "*4nk", "w4*k", "w4n*", "fleshi", 
        "join two faces", "join 2 faces", "join2faces", "jointwofaces", "fotor", "Toni WWE", "Tony Storm", "off the Sky", "off da skai", "Priscilla", "Kelly", "Erika", "Vikman", "pakara", "pakarat", "Viikman", "Eerika", "Rhaka", "orgasm", "0rgasm", "org@sm", "orga5m", "org@5m", 
        "Kamitani", "Katie", "Nikkita", "Nikkita Lyons", "Lisa Marie", "Lisa Marie Varon", "Lisa Varon", "Marie Varon", "Amanda Huber", 
    ];

    const allowedWords = [
        /reddit/i, /OSRS/i, /RS/i, /RS3/i, /Old School/i, /RuneScape/i, /netflix/i, /pushpull/i, /facebook/i, /FB/i, /instagram/i, /Wiki/i, /pedia/i, /hikipedia/i, /fandom/i, /lehti/i, /tiktok/i, /bond/i, /bonds/i, /2007scape/i, /youtube/i, /ublock/i, 
        /wrestling/i, /wrestler/i, /tori/i, /tori\.fi/i, /www\.tori\.fi/i, /Kirpputori/i, /käytetty/i, /käytetyt/i, /käytettynä/i, /proshop/i, /hinta/i, /hintavertailu/i, /hintaopas/i, /sähkö/i, /pörssi/i, /sähkösopimus/i, /vattenfall/i, /elenia/i, 
        /kulutus/i,  /sähkön/i, /sähkönkulutus/i, /bing/i, /duckduckgo/i, /old/i, /new/i, /veikkaus/i, /lotto/i, /jokeri/i, /jääkiekko/i, /viikinkilotto/i, /perho/i, /vakuutus/i, /kela/i, /sosiaalitoimisto/i, /sossu/i, /OP/i, /Osuuspankki/i, /Speaker/i,
        /Osuuspankin/i, /Artikkeli/i, /jalkapallo/i, /sanomat/i, /sanoma/i, /päivän sana/i, /jumala/i, /jeesus/i, /jesus/i, /christ/i, /kristus/i, /vapahtaja/i, /messias/i, /pääsiäinen/i, /joulu/i, /uusivuosi/i, /vuosi/i, /uusi/i, /uuden/i, /vuoden/i, 
        /raketti/i, /raketit/i, /sipsit/i, /dippi/i, /dipit/i, /Monster/i, /Energy/i, /Lewis Hamilton/i, /LH44/i, /LH-44/i, /Greenzero/i, /Green/i, /Zero/i, /blue/i, /white/i, /red/i, /yellow/i, /brown/i, /cyan/i, /black/i, /Tie/i, /katu/i, /opas/i, 
        /google/i, /maps/i, /earth/i, /Psykologi/i, /psyka/i, /USB/i, /kotiteatteri/i, /vahvistin/i, /Onkyo/i, /Sony/i, /TX/i, /Thx/i, /SR393/i, /Suprim/i, /Strix/i, /TUF/i, /Gaming/i, /Prime/i, /Matrix/i, /Astral/i, /MSI/i, /Vanguard/i, /Center/i, 
        /Samsung/i, /Asus/i, /PNY/i, /AsRock/i, /XFX/i, /Sapphire/i, /PowerColor/i, /emolevy/i, /emo levy/i, /live/i, /näytönohjain/i, /näytön/i, /ohjain/i, /xbox/i, /playstation/i, /Dual/i, /pleikkari/i, /Series/i, /PS1/i, /PS2/i, /PS3/i, /PS4/i, 
        /PS5/i, /PS6/i, /One/i, /Telsu/i, /Televisio/i, /Telvisio/i, /Ohjelma/i, /Ohjelmat/i, /Ajurit/i, /Lenovo/i, /Compaq/i, /Acer/i, /HP/i, /Hewlet Packard/i, /Ventus/i, /Duel/i, /OC/i, /Overclocked/i, /Overclockers/i, /bass/i, /bas/i, /AMD/i, 
        /NVidia/i, /Intel/i, /Ryzen/i, /Core/i, /GeForce/i, /Radeon/i, /0TI/i, /0X/i, /50/i, /60/i, /70/i, /80/i, /90/i, /RX/i, /GTA/i, /GTX/i, /RTX/i, /PC/i, /Battlefield/i, /BF/i, /driver/i, /sub/i, /WWE/i, /wrestle/i, /Raw/i, /SmackDown/i, /SSD/i, 
        /HDD/i, /Disk/i, /disc/i, /cable/i, /microsoft/i, /drivers/i, /chipset/i, /mobo/i, /motherboard/i, /mother/i, /GPU/i, /CPU/i, /Ucey/i, /Graphics Card/i, /paint\.net/i, /paintdotnet/i, /paintnet/i, /paint net/i, /github/i, /hub/i, /git/i, 
        /Processor/i, /Chip/i, /R9/i, /R7/i, /R5/i, /i9/i, /i7/i, /i5/i, /subwoofer/i, /sound/i, /spotify/i, /spicetify/i, /IG/i, /home theater/i, /receiver/i, /giver/i, /taker/i, /ChatGPT/i, /Chat GPT/i, /Uce/i, /DLSS/i, /FSR/i, /NIS/i, /profile/i, 
        /inspect/i, /inspector/i, /vaihd/i, /vaihe/i, /vaiht/i, /ai/i, /jako/i, /jakopäähihna/i, /hihna/i, /pää/i, /auto/i, /pankki/i, /moto/i, /toyota/i, /opel/i, /mitsubishi/i, /galant/i, /osa/i, /vara/i, /raha/i, /ooppeli/i, /HDMI/i, /Edge WWE/i, 
        /vaihdetaan/i, /vaihdan/i, /vaihto/i, /vaihtoi/i, /vaihdossa/i, /vaihtaa/i, /paa/i, /jakopää hihna/i, /jako hihna/i, /jako pää hihna/i, /jako päähihna/i, /\?/i, /\!/i, /opas/i, /ohje/i, /manuaali/i, /käyttö/i, /history/i, /historia/i, /search/i, 
        /haku/i, /classic/i, /klassikko/i, /klassik/i, /south park/i, /siivoton juttu/i, /pasila/i, /jakohihna/i, /poliisin poika/i, /poliisi/i, /poika/i, /Ravage/i, /Savage/i, /volksvagen/i, /konsoli/i, /console/i, /Sega/i, /Nintendo/i, /PlayStation/i, 
        /Xbox/i, /Game/i, /Terapia/i, /Therapy/i, /Masennus/i, /Depression/i, /Psykiatri/i, /Striimi/i, /Stream/i, /antenni/i, /verkko/i, /digibox/i, /hamppari/i, /hampurilainen/i, /ranskalaiset/i, /peruna/i, /automaatti/i, /automaatin/i, /autismi/i, 
        /autisti/i, /ADHD/i, /asperger/i, /kebab/i, /ravintola/i, /ruokala/i, /pikaruoka/i, /suomi/i, /finnish/i, /renkaan/i, /nopeusluokka/i, /nopeus/i, /renkaan nopeusluokka/i, /luokka/i, /america/i, /american/i, /Alexander/i, /President/i, /TGD/i,
        /Kuningas/i, /Kuninkaitten/i, /Aleksis Kivi/i, /Kiven/i, /Aleksanteri Suuri/i, /Yleisön osasto/i, /Aleksanteri Stubb/i, /Stubb/i, /Poliitikka/i, /Politiikka/i, /Poliittinen/i, /Kannanotto/i, /Kannan otto/i, /Yleisönosasto/i, /7900/i, /9800/i, 
        /9800X3D/i, /9800 X3D/i, /XTX/i, /XT/i, /1080 TI/i, /1050TI/i, /1080TI/i, /3080/i, /5080TI/i, /5080 TI/i, /1050 TI/i, /2080/i, /XC/i, /8600K/i, /9700K/i, /5900X/i, /Coffee/i, /Lake/i, /Refresh/i, /Athlon/i, /Fermi/i, /Ampere/i, /Blackwell/i, 
        /diagnoosi/i, /diagnosoitiin/i, /diagnosoitu/i, /diagnosis/i, /saada/i, /löytää/i, /ostaa/i, /löytö/i, /osto/i, /saanti/i, /muumit/i, /Tarina/i, /veren/i, /paine/i, /päiväkirja/i, /Joakim/i, /kuinka/i, /miten/i, /miksi/i, /minkä/i, /takia/i, 
        /minä/i, /teen/i, /tätä/i, /ilman/i, /ilma/i, /sää/i, /foreca/i, /ilmatieteenlaitos/i, /päivän/i, /Stream/i, /Presidentti/i, /James/i, /Hetfield/i, /Metallica/i, /Sabaton/i,  /TheGamingDefinition/i, /Twitch/i, /WhatsApp/i, /Messenger/i, 
        /yliopistonapteekki/i, /Pentium/i, /Kela/i, /kuule/i, /kirje/i, /kuulemiskirje/i, /kelan/i, /TUF/i, /STRIX/i, /SUPRIM/i, /EAGLE/i, /WINDFORCE/i, /GAMING X/i, /GAMING OC/i, /STEALTH/i, /ZOTAC/i, /EMTEK/i, /PALIT/i, /VISION/i, /ROG Strix/i, 
        /FTW/i, /ASUS/i, /GIGABYTE/i, /AORUS/i, /AORUS/i, /sääennuste/i, /ennuste/i, /oramorph/i, /oramorfiini/i, /morfiini/i,  /SAPPHIRE/i, /POWERCOLOR/i, /ASROCK/i, /XFX/i, /GALAX/i, /GAINWARD/i, /INNO3D/i, /COLORFUL/i, /DUKE/i, /ARMOR/i, /MECH/i, 
        /AERO/i, /JETSTREAM/i, /PHANTOM/i, /AMP/i, /PULSE/i, /NITRO/i, /RED DEVIL/i, /HELLHOUND/i, /FIRESTORM/i, /FIREPRO/i, /FURY/i, /TITAN/i, /QUADRO/i, /PROART/i,  /BLOWER/i, /TURBO/i, /OC/i, /OC EDITION/i, /DUAL/i, /MINI/i, /ITX/i, /TRIPLE FAN/i, 
        /TRIPLEFAN/i, /TRINITY/i, /OC VERSION/i, /OCV/i, /ULTRA/i, /HOF/i, /HALL OF FAME/i, /LEGION/i, /SHADOW/i, /EX/i, /EVGA/i, /XC/i, /XC3/i, /VENTUS/i,  /2080TI/i, /2080 TI/i, /1080 TI/i, /3080 TI/i, /4080 TI/i, /5080 TI/i, /2080TI/i, /1080TI/i, 
        /3080TI/i, /4080TI/i, /5080TI/i, /6080TI/i, /7080TI/i, /8080TI/i, /9080TI/i,  /50 TI/i, /60 TI/i, /70 TI/i, /80 TI/i, /90 TI/i, /50TI/i, /60TI/i, /70TI/i, /80TI/i, /90TI/i, /post/i, /card/i, /kortti/i, /kirje/i, /kirjekuori/i, /maksaminen/i, 
        /choledochoduodenostomiam/i, /choledocho-duodenostomiam/i, /cholecystectomiam/i, /cauda/i, /cauda pancreatis/i, /pancreatis/i, /gastroenterostomiam/i, /retrocolica/i, /gastroenterostomiam retrocolica/i, /Haemorrhagia/i, /gastrointestinalis/i,
        /Haemorrhagia gastrointestinalis/i, /retrocolic/i, /gastroenterostomy/i, /retrocolic gastroenterostomy/i, /choledochoduodenostomy/i, /choledocho-duodenostomy/i, /choledocho/i, /duodenostomiam/i, /duodenostomy/i, /cholecystectomy/i, /cholecyst/i,
        /resectionem/i, /resectionem cauda pancreatis/i, /pancreas/i, /resection of pancreas/i, /resection of pancreatic tail/i, /pancreas tail resection/i, /haemorrhagia gastrointestinalis/i, /hemorrhagia/i, /gastrointestinal/i, /gastrointestinal bleeding/i, 
        /intestinal bleeding/i, /liver bile stasis/i, /stasis biliaris hepatis/i, /stasis biliaris/i, /biliaris/i, /hepatis/i, /bile stasis/i, /atherosclerosis aortae gravis/i, /atherosclerosis aortae/i, /aortae/i, /gravis/i, /aortic atherosclerosis/i,
        /atherosclerosis arteriae coronariae cordis gravis/i, /atherosclerosis coronariae/i, /coronariae cordis/i, /coronary artery disease/i, /coronary atherosclerosis/i, /atherosclerosis cordis/i, /atherosclerosis arteriae cerebri levis/i, /uteri/i,
        /atherosclerosis cerebri/i, /arteriae cerebri/i, /cerebral atherosclerosis/i, /brain artery disease/i, /status post extirpationem uteri totalis/i, /extirpationem uteri totalis/i, /extirpationem/i, /hysterectomy/i, /uterus removal/i, /total/i,
        /Carcinoma parvocellulare pancreatis cum/i, /Carcinoma parvocellulare pancreatis/i, /Carcinoma/i, /parvocellulare/i, /pancreatis/i, /metastasibus/i, /pulmonum/i, /pulmonum l. dx./i, /lymphnodi mediastini/i, /l. dx./i, /mediastini/i, 
        /metastasibus pulmonum l. dx. lymphnodi mediastini/i, /et retroperinonei renis sin/i, /retroperinonei renis sin/i, /renis sin/i, /retroperinonei renis sin/i, /retroperinonei sin/i, /black friday/i,
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
        /github\.com\/BrowserWorks/i,
        /github\.com\/comfyanonymous/i,
        /github\.com\/Top-AI-Apps/i,
        /github\.com\/HorizonMW\/HorizonMW-Client/i,
        /github\.com\/HorizonMW\/[^\/]+/i,
        /github\.com\/Top-AI-Apps\/Review\/blob\/main\/Top%205%20DeepNude%20AI%3A%20Free%20%26%20Paid%20Apps%20for%20Jan%202025%20-%20topai\.md/i,
        /chromewebstore\.google\.com\/detail\/tor-selain\/eaoamcgoidmhaficdbmcbamiedeklfol/i,
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
        /apps\.microsoft\.com\/detail\/xpfftq037jwmhs/i,
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
        /browser\./i,
        /tiktok\./i,
        /download\.fi/i,
        /evercast\.us/i,
        /avclabs\.com/i,
        /wondershare\.com/i,
        /wondershare\.net/i,
        /wondershare\.ai/i,
        /risingmax\.com/i,
        /gizmodo\.com/i,
        /comfy\.org/i,
        /runcomfy\.com/i,
	/picsart\.com/i,
	/capcut\.com/i,
        /canva\.com/i,
	/topazlabs\.com/i,
	/online\.visual-paradigm\.com/i,
	/skylum\.com/i,
        /stable-diffusion-art\.com/i,
        /comfyui\.org/i,
        /thinkdiffusion\.com/i,
        /comfyuiweb\.com/i,
        /horizonmw\.org/i,
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
        /facetune\./i,
        /facetuneapp\./i,
        /play\.google\.com\/store\/apps\/details\?id=com\.lightricks\.facetune\.free/i,
        /apps\.apple\.com\/us\/app\/facetune-video-photo-editor\/id1149994032/i,
        /lunapic\.com/i,
        /tenor\./i,
        /tenor\.com/i,
        /azure\./i,
        /pixelixe\.com/i,
        /picresize\.com/i,
        /replicate\.ai/i,
        /kuvake\.net/i,
        /reddit\.com\/r\/comfyui\/?/i,
        /reddit\.com\/r\/stablediffusion\/?/i,
        /facebook\.com\/tatu\.toiviainen\//i,
        /viewverio\.com/i,
        /irc\.fi/i,
        /kelleyhoaglandphotography\.com/i,
        /irc-galleria\.fi/i,
        /nude\./i,
        /naked\./i,
        /123rf\./i,
        /virtualbox\./i,
        /oracle\./i,
        /formulae\.\./i,
        /rem\.\./i,
        /remove\.\./i,
        /remover\.\./i,
        /removing\.\./i,
        /osboxes\./i,
        /vmware\./i,
        /face25\./i,
        /face26\./i,
        /writecream\./i,
        /waterfox\./i,
        /pixelmator\./i,
        /flexclip\./i,
        /uptodown\./i,
        /perfectcorp\./i,
        /idphotodiy\./i,
        /imagetools\./i,
        /image-tools\./i,
        /img-tools\./i,
        /imgtools\./i,
        /pictools\./i,
        /pic-tools\./i,
        /pict-tools\./i,
        /picttools\./i,
        /phototools\./i,
        /photools\./i,
        /photo-tools\./i,
        /picture-tools\./i,
        /picturetools\./i,
        /workintool\./i,
        /workintools\./i,
        /workin-tool\./i,
        /workin-tools\./i,
        /workingtool\./i,
        /workingtools\./i,
        /working-tool\./i,
        /working-tools\./i,
        /any-video\./i,
        /anyvideo\./i,
        /any-video-convert\./i,
        /anyvideoconvert\./i,
        /any-videoconvert\./i,
        /anyvideo-convert\./i,
        /any-video-converter\./i,
        /anyvideoconverter\./i,
        /any-videoconverter\./i,
        /anyvideo-converter\./i,
        /aiphoto\./i,
        /ai-photo\./i,
        /photoai\./i,
        /photo-ai\./i,
        /aiphotohq\./i,
        /ai-photohq\./i,
        /aiphoto-hq\./i,
        /ai-photo-hq\./i,
        /axis-intelligence\.com/i,
        /feishu\.cn/i,
        /n8ked\./i,
        /imgur\.com.*nude/i,
        /imgur\.com.*deepn/i,
        /AlexaBliss/i,
        /DuaLipa/i,
        /Dua_Lipa/i,
        /threads\./i,
        /instagram\./i,
        /browsing\./i,
        /-browser\./i,
        /-browsing\./i,
        /a1art\./i,
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
        /edit\./i,
        /-edit\./i,
        /editor\./i,
        /-editor\./i,
        /editing\./i,
        /-editing\./i,
        /upscale\./i,
        /-upscale\./i,
        /upscaling\./i,
        /-upscaling\./i,
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
        /theresanaiforthat\./i,
        /fixthephoto\./i,
        /fixthatphoto\./i,
        /fixthisphoto\./i,
        /nudifyonline\./i,
        /nudify-online\./i,
        /nudifyingonline\./i,
        /nudifying-online\./i,
        /onlinenudify\./i,
        /onlinenudifying\./i,
        /onlinenudifyier\./i,
        /onlinenudifier\./i,
        /online-nudify\./i,
        /online-nudifying\./i,
        /online-nudifyier\./i,
        /online-nudifier\./i,
        /stablediffusionapi\./i,
        /stablediffusion\./i,
        /stable-diffusion\./i,
        /stable-diffusionapi\./i,
        /stablediffusion-api\./i,
        /stable-diffusion-api\./i,
        /HeyGen\./i,
        /GenHey\./i,
        /Hey-Gen\./i,
        /Gen-Hey\./i,
        /apkpure\./i,
        /apk-pure\./i,
        /alucare\./i,
        /scribd\./i,
        /alu-care\./i,
        /noxilo\./i,
        /noxillo\./i,
        /clothoff\./i,
        /cloth-off\./i,
        /offcloth\./i,
        /off-cloth\./i,
        /clothyoff\./i,
        /clothy-off\./i,
        /offclothy\./i,
        /off-clothy\./i,
        /clothesoff\./i,
        /clothes-off\./i,
        /offclothes\./i,
        /off-clothes\./i,
        /cloudbooklet\./i,
        /cyberlink\./i,
        /undressapp\./i,
        /undress-app\./i,
        /appundress\./i,
        /app-undress\./i,
	    /robeoff\./i,
	    /offrobe\./i,
	    /robe-off\./i,
	    /off-robe\./i,
	    /sendfame\./i,
	    /send-fame\./i,
	    /sendingfame\./i,
	    /sending-fame\./i,
	    /sendsfame\./i,
	    /sends-fame\./i,
	    /sentfame\./i,
	    /sent-fame\./i,
	    /famesend\./i,
	    /fame-send\./i,
	    /famesending\./i,
	    /fame-sending\./i,
	    /famesends\./i,
	    /fame-sends\./i,
	    /famesent\./i,
	    /fame-sent\./i,
	    /headgenai\./i,
	    /headgen-ai\./i,
	    /head-genai\./i,
	    /head-gen-ai\./i,
        /whatisthebigdata\./i,
        /whatsthebigdata\./i,
        /mangoanimate\./i,
        /mangoai\./i,
        /mango-animate\./i,
        /mango-anim\./i,
        /lantaai\./i,
        /lantai\./i,
        /lanta-ai\./i,
        /mango-anims\./i,
        /mangoanims\./i,
        /mango-animated\./i,
        /mango-animations\./i,
        /mangoanim\./i,
        /mangoanimated\./i,
        /mangoanimations\./i,
        /mango-ai\./i,
        /insmind\./i,
        /dreamshoot\./i,
        /dreamshootai\./i,
        /faceswapvideo\./i,
        /faceswapvid\./i,
        /faceswapvids\./i,
        /faceswapvideos\./i,
        /faceswap-video\./i,
        /faceswap-vid\./i,
        /faceswap-vids\./i,
        /faceswap-videos\./i,
        /undress\./i,
        /twitter\.com/i,
        /x\.com/i,
        /\.ai/i,
        /\.app/i,
        /\.art/i,
        /\.io/i,
        /\.makeup/i,
        /\.off/i,
        /\.id/i,
        /\.it/i,
        /\.th/i,
        /\.best/i,
        /\.cc/i,
        /\.cn/i,
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
        /411mania\.com/i,
        /cultaholic\.com/i,
        /whatculture\.com/i,
        /ringsideintel\.com/i,
        /wrestlinginc\.com/i,
        /thesportster\.com/i,
        /cagesideseats\.com/i,
        /f4wonline\.com/i,
        /medium\.com\/@/i,
        /waterfox\.\/@/i,
        /awfulannouncing\.com/i,
        /pwpix\.net/i,
	    /reddit\.com\/r\/photoshop/i,
        /reddit\.com\/r\/StableDiffusion/i,
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
        /DuaLipa/i,
        /Dua_Lipa/i,
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
        /threads\.com/i,
        /threads\.net/i,
        /nudifyer\./i,
        /nudifying\./i,
        /nudifier\./i,
        /undress\./i,
        /selain\./i,
        /selaimet\./i,
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
        /www\.\f4wonline\.com/i,
        /medium\.com/i,
        /https:\medium\.com/i,
        /medium\.com\/@/i,
        /awfulannouncing\.com/i,
        /pwpix\.net/i
    ];

    const protectedSelectors = [
        '#APjFqb', '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP > div.a4bIc',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP > div.fM33ce.dRYYxd',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > button',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.M8H8pb',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb',
        '#_gPKbZ730HOzVwPAP7pnh0QE_3', '#tsf > div:nth-child(1) > div.A8SBwf',
        '#tsf > div:nth-child(1) > div:nth-child(2)', '#tsf > div:nth-child(1) > script',
        '#tsf > div:nth-child(1)', '#tophf', '#tsf'
    ];

    // --- State ---
    let isRedirecting = false;
    let domObserver = null;
    let ffAndroidScanInterval = null;
    let ffAndroidScanAttempts = 0;

    // --- Compiled pattern (combined regex) ---
    const blockKeywordsPattern = (regexKeywordsToHide.length || specialRegexes.length)
        ? new RegExp([...regexKeywordsToHide, ...specialRegexes].map(pat => pat.source).join("|"), "i")
        : null;

    // --- Helpers ---
    function containsAllowedWords(text) {
        if (!text) return false;
        for (let i = 0; i < allowedWords.length; ++i) {
            if (allowedWords[i].test(text)) return true;
        }
        return false;
    }

    function isUrlAllowed(url) {
        if (!url) return false;
        for (let i = 0; i < allowedUrls.length; ++i) {
            if (url.includes(allowedUrls[i])) return true;
        }
        return false;
    }

    function matchesBlockedUrlPattern(url) {
        if (!url) return false;
        for (let i = 0; i < urlPatternsToHide.length; ++i) {
            if (urlPatternsToHide[i].test(url)) return true;
        }
        return false;
    }

    function matchesBlockedImagePattern(url) {
        if (!url) return false;
        for (let i = 0; i < blockedImageURLs.length; ++i) {
            if (blockedImageURLs[i].test(url)) return true;
        }
        return false;
    }

    function isProtectedElement(element) {
        return protectedSelectors.some(selector => element.matches && element.matches(selector));
    }

    // Record details of the last forbidden match for better debugging
    function recordMatchDetail(kind, value, inText) {
        lastMatchDetails = {
            kind,                          // 'regex' | 'special' | 'string'
            value: String(value || ''),
            snippet: String(inText || '').substring(0, 200),
            when: new Date().toISOString()
        };
        devLog('FORBIDDEN ' + kind.toUpperCase() + ' MATCH:', value, 'in:', lastMatchDetails.snippet);
    }

    function containsForbiddenKeywords(text) {
        if (!text) return false;

        // First: special high-complexity regexes
        for (let i = 0; i < specialRegexes.length; ++i) {
            const re = specialRegexes[i];
            if (re.test(text)) {
                recordMatchDetail('special', re.toString(), text);
                return re.toString();
            }
        }

        // Regex list
        for (let i = 0; i < regexKeywordsToHide.length; ++i) {
            const re = regexKeywordsToHide[i];
            if (re.test(text)) {
                recordMatchDetail('regex', re.toString(), text);
                return re.toString();
            }
        }

        // String list: whole-word if single word; substring if contains space
        for (let i = 0; i < stringKeywordsToHide.length; ++i) {
            const kw = stringKeywordsToHide[i];
            if (!kw) continue;
            const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const patternText = kw.includes(' ') ? escaped : `\\b${escaped}\\b`;
            const pattern = new RegExp(patternText, 'i');
            if (pattern.test(text)) {
                recordMatchDetail('string', kw, text);
                return kw;
            }
        }
        return false;
    }

    function isBannedImage(textOrUrl) {
        if (!textOrUrl) return false;
        const val = String(textOrUrl);
        const arrayHit = [
            blockedImageURLs.length > 0 && blockedImageURLs.some(re => re.test(val)),
            specialRegexes.length > 0 && specialRegexes.some(re => re.test(val)),
            regexKeywordsToHide.length > 0 && regexKeywordsToHide.some(re => re.test(val)),
            stringKeywordsToHide.length > 0 && stringKeywordsToHide.some(kw => val.toLowerCase().includes(kw.toLowerCase()))
        ];
        if (arrayHit.some(Boolean)) {
            devLog('isBannedImage hit:', val.substring(0, 200), arrayHit);
        }
        return arrayHit.some(Boolean);
    }

    // Helper: non-destructive hide (do not remove nodes)
    function hideElementSafely(el) {
        try {
            if (!el || !el.style) return;
            el.setAttribute('data-googlejs-hidden', '1');
            el.setAttribute('aria-hidden', 'true');
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
        } catch (e) {}
    }

    // Suggestion selectors builder (includes mobile-friendly superset for Firefox Android)
    function getSuggestionSelectors() {
        const base = [
            '#fprsl', '#fprs', '#oFNiHe', '.QRYxYe', '.NNMgCf', '.spell_orig', '.gL9Hy', '#bres', 'div.y6Uyqe',
            'span.gL9Hy', 'a.spell', 'p.spell_orig', '.KDCVqf', '.card-section.p64x9c'
        ];
        if (isFirefoxAndroid) {
            // Option A.2 (Android-only narrowing): use only the desktop/base suggestion selectors on Firefox Android.
            // This prevents monitorSelectorsAndRedirect from scanning broad generic containers like #search, div[jsname], etc.
            return base;
        }
        return base;
    }

    // NEW: Check if a node is within any suggestion/"Did you mean" container
    function isWithinSuggestionNode(node) {
        try {
            if (!node) return false;
            const selectors = getSuggestionSelectors();
            let n = node;
            while (n && n !== document.documentElement) {
                for (let i = 0; i < selectors.length; ++i) {
                    if (n.matches && n.matches(selectors[i])) return true;
                }
                n = n.parentElement;
            }
        } catch (e) {}
        return false;
    }

    // --- Chrome "no-glimpse" redirect (keep overlay until redirect) ---
    function doRedirect(triggerContext, triggerTerm) {
        if (isRedirecting) return;
        logRedirect(triggerContext, triggerTerm);
        isRedirecting = true;
        try { if (domObserver) domObserver.disconnect(); } catch (e) {}
        if (ffAndroidScanInterval) {
            try { clearInterval(ffAndroidScanInterval); } catch (e) {}
            ffAndroidScanInterval = null;
        }
        try { window.stop && window.stop(); } catch (e) {}
        try {
            document.documentElement.style.background = '#fff';
            document.body && (document.body.style.background = '#fff');
        } catch (e) {}
        try { window.location.replace('https://www.google.com'); } catch (e) { window.location.href = 'https://www.google.com'; }
    }

    // --- Early preflight redirect (runs before any filtering/render) ---
    function preflightRedirectIfBanned() {
        const currentHostname = window.location.hostname;
        const googleDomainPattern = /^([a-z0-9-]+\.)*google\.[a-z]+(\.[a-z]+)?$/i;
        if (!googleDomainPattern.test(currentHostname)) return false;

        const searchParams = new URLSearchParams(window.location.search);
        const query = searchParams.get('q') || '';

        // If the query itself is banned, redirect immediately with overlay still up
        const forbiddenMatch = containsForbiddenKeywords(query);
        if (forbiddenMatch && !isUrlAllowed(window.location.href)) {
            doRedirect('preflight', forbiddenMatch);
            return true;
        }
        return false;
    }

    if (preflightRedirectIfBanned()) return;

    // --- URL cleaning (kept) ---
    function cleanGoogleUrl() {
        const keepParams = [
            "q", "tbm", "tbs", "hl", "safe", "biw", "bih", "dpr", "ijn", "ei", "start", "source", "rlz", "oq", "gs_l", "sxsrf",
            "imgrc", "imgdii", "imgurl", "imgrefurl", "prev", "usg", "bvm", "psig", "ust", "chips", "asearch", "udm",
            "uact", "pbx", "sclient", "aqs", "gs_ivs", "iflsig", "ictx"
        ];
        try {
            const url = new URL(window.location.href);
            if (/^.*\.google\..*/i.test(window.location.hostname)) {
                let changed = false;
                const paramsArray = Array.from(url.searchParams.keys());
                for (let i = 0; i < paramsArray.length; ++i) {
                    const param = paramsArray[i];
                    if (!keepParams.includes(param)) {
                        url.searchParams.delete(param);
                        changed = true;
                    }
                }
                if (changed) {
                    const cleanedUrl = `${window.location.origin}${window.location.pathname}${url.searchParams.toString() ? '?' + url.searchParams.toString() : ''}`;
                    if (cleanedUrl !== window.location.href) {
                        window.history.replaceState({}, '', cleanedUrl);
                        devLog('URL cleaned');
                    }
                }
            }
        } catch (e) {}
    }

    // --- Intercept user actions early (no-glimpse on Chrome) ---
    // 1) Form submit (capturing)
    document.addEventListener('submit', function (event) {
        try {
            const form = event.target;
            if (form && form.action && /google\..*\/search/i.test(form.action)) {
                const inputs = form.querySelectorAll('input[name="q"]');
                for (let i = 0; i < inputs.length; ++i) {
                    const val = inputs[i].value || '';
                    const forbiddenMatch = containsForbiddenKeywords(val);
                    if (forbiddenMatch && !isUrlAllowed(window.location.href)) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        overlay && (overlay.style.display = 'block');
                        doRedirect('submit', forbiddenMatch);
                        return false;
                    }
                }
            }
        } catch (e) {}
    }, true);

    // 2) Enter on search inputs (capturing)
    document.addEventListener('keydown', function (event) {
        try {
            if (event.key !== 'Enter') return;
            const active = document.activeElement;
            if (!active) return;
            if (active.name === 'q' || (active.tagName === 'INPUT' && /search|text/i.test(active.type))) {
                const val = active.value || '';
                const forbiddenMatch = containsForbiddenKeywords(val);
                if (forbiddenMatch && !isUrlAllowed(window.location.href)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    overlay && (overlay.style.display = 'block');
                    doRedirect('enter', forbiddenMatch);
                    return false;
                }
            }
        } catch (e) {}
    }, true);

    // 3) Input changes (helpful to preempt before submit)
    function interceptSearchInputChanges() {
        const inputs = document.querySelectorAll('input[name="q"]');
        devLog('Found ' + inputs.length + ' search inputs to monitor');
        for (let i = 0; i < inputs.length; ++i) {
            const searchInput = inputs[i];
            searchInput.addEventListener('input', function () {
                try {
                    const val = searchInput.value || '';
                    const forbiddenMatch = containsForbiddenKeywords(val);
                    if (forbiddenMatch && !isUrlAllowed(window.location.href)) {
                        overlay && (overlay.style.display = 'block');
                        doRedirect('input-change', forbiddenMatch);
                    }
                } catch (e) {}
            });
        }
    }

    // --- Filtering blocks (kept and combined) ---
    function blockUrls() {
        if (isRedirecting) return;
        const keepParams = [
            "q", "tbm", "tbs", "hl", "safe", "biw", "bih", "dpr", "ijn", "ei", "start", "source", "rlz", "oq", "gs_l", "sxsrf",
            "imgrc", "imgdii", "imgurl", "imgrefurl", "prev", "usg", "bvm", "psig", "ust", "chips", "asearch", "udm",
            "uact", "pbx", "sclient", "aqs", "gs_ivs", "iflsig", "ictx"
        ];
        try {
            const links = document.getElementsByTagName("a");
            for (let i = 0; i < links.length; ++i) {
                const link = links[i];
                if (!link.href) continue;

                // NEW: While overlay is up, never touch links inside suggestion containers
                if (!overlayRemoved && isWithinSuggestionNode(link)) {
                    continue;
                }

                // Cleanup query params for Google links (Chrome logic)
                if (!isUrlAllowed(link.href)) {
                    try {
                        const urlObj = new URL(link.href, location.origin);
                        let changed = false;
                        const paramsArray = Array.from(urlObj.searchParams.keys());
                        for (let j = 0; j < paramsArray.length; ++j) {
                            const param = paramsArray[j];
                            if (!keepParams.includes(param)) {
                                urlObj.searchParams.delete(param);
                                changed = true;
                            }
                        }
                        if (changed) {
                            link.href = urlObj.origin + urlObj.pathname + (urlObj.searchParams.toString() ? '?' + urlObj.searchParams.toString() : '');
                        }
                    } catch (e) {}
                }

                // Remove blocked links (Chrome parent removal + FF style)
                if (matchesBlockedUrlPattern(link.href)) {
                    // Lift removal up a few levels for result cards
                    let parent = link;
                    let levels = 0;
                    while (parent && levels < 7) {
                        if (!parent.parentElement || parent === document.body || parent.id === "search") break;
                        const style = window.getComputedStyle(parent);
                        if (
                            parent.classList.contains('X4T0U') ||
                            parent.classList.contains('sHEJob') ||
                            parent.classList.contains('ObbMBf') ||
                            style.marginBottom !== "0px" ||
                            style.marginTop !== "0px" ||
                            style.display === "flex" ||
                            parent.getAttribute('role') === "heading" ||
                            parent.hasAttribute('aria-level')
                        ) {
                            parent.remove();
                            break;
                        }
                        parent = parent.parentElement; levels++;
                    }
                    link.remove();
                } else {
                    if (!isUrlAllowed(link.href)) {
                        const forbiddenInHref =
                            (blockKeywordsPattern && blockKeywordsPattern.test(link.href)) ||
                            (urlPatternsToHide.length > 0 && urlPatternsToHide.some(p => p.test(link.href)));
                        if (forbiddenInHref && !(allowedWords.length > 0 && allowedWords.some(word => word.test(link.href)))) {
                            link.remove();
                        }
                    }
                }
            }
        } catch (e) {}
    }

    function blockResults() {
        if (isRedirecting) return;
        try {
            const results = document.querySelectorAll('div.g, div.srg > div, div.v7W49e, div.mnr-c, div.Ww4FFb, div.yuRUbf');
            for (let i = 0; i < results.length; ++i) {
                const result = results[i];
                // NEW: While overlay is up, skip removing containers inside suggestion sections
                if (!overlayRemoved && isWithinSuggestionNode(result)) {
                    continue;
                }

                const resultText = result.innerText ? result.innerText.toLowerCase() : '';
                const link = result.querySelector('a');
                const resultUrl = link ? link.href : '';
                let shouldRemove = false;

                if (blockKeywordsPattern && (blockKeywordsPattern.test(resultText) || blockKeywordsPattern.test(resultUrl))) {
                    if (
                        !(allowedWords.length > 0 && allowedWords.some(word => word.test(resultUrl))) &&
                        !isUrlAllowed(resultUrl) &&
                        (!link || (!link.href.includes('github.com') || (blockKeywordsPattern && blockKeywordsPattern.test(resultUrl))))
                    ) {
                        shouldRemove = true;
                    }
                }
                if (!shouldRemove && urlPatternsToHide.length > 0 && urlPatternsToHide.some(pattern => pattern.test(resultUrl))) {
                    shouldRemove = true;
                }
                if (shouldRemove) result.remove();
            }
        } catch (e) {}
    }

    function blockElementsBySelectors() {
        if (isRedirecting) return;
        try {
            const selectorsToHide = [
                'span.gL9Hy', '.spell_orig', '.KDCVqf.card-section.p64x9c', '#oFNiHe', '#taw',
                '.QRYxYe', '.NNMgCf', '#bres > div.ULSxyf', 'div.ULSxyf', '#bres'
            ];
            selectorsToHide.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (!isProtectedElement(element)) {
                        const txt = element.textContent || '';
                        if (!containsAllowedWords(txt)) {
                            // HIDE instead of remove (so scanning still "sees" the content)
                            hideElementSafely(element);
                        }
                    }
                });
            });
        } catch (e) {}
    }

    function blockElementsByPhrases() {
        if (isRedirecting) return;
        try {
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
                if (phrasesToHide.some(phrase => phrase.test(textContent)) && !containsAllowedWords(textContent)) {
                    // HIDE instead of remove (so scanning still "sees" the content)
                    hideElementSafely(element);
                }
            });
        } catch (e) {}
    }

    // Suggestions/“Did you mean?” detection without redirect (for safe overlay release)
    function hasForbiddenSuggestionText() {
        const suggestionSelectors = getSuggestionSelectors();
        for (let s = 0; s < suggestionSelectors.length; ++s) {
            const elements = document.querySelectorAll(suggestionSelectors[s]);
            for (let i = 0; i < elements.length; ++i) {
                const txt = elements[i].textContent || '';
                if (containsAllowedWords(txt)) continue;
                if (containsForbiddenKeywords(txt)) return true;
            }
        }
        return false;
    }

    // Extra robust scanner for Firefox Android: scan a broader set (including aria-live regions)
    function ffAndroidSuggestionScanAndRedirect() {
        if (!isFirefoxAndroid || isRedirecting) return false;

        const selectors = getSuggestionSelectors().concat([
    		'div[aria-live]',
    		'div[role="alert"]',
    		'div[aria-atomic]'
        ]);
        let redirected = false;

        for (let s = 0; s < selectors.length && !redirected; ++s) {
            const nodes = document.querySelectorAll(selectors[s]);
            for (let i = 0; i < nodes.length && !redirected; ++i) {
                const txt = nodes[i].textContent || '';
                if (!txt) continue;
                if (containsAllowedWords(txt)) continue;

                // Quick positive path: any forbidden keyword inside a likely "did you mean/showing" container
                const hasForbidden = containsForbiddenKeywords(txt);
                if (hasForbidden) {
                    overlay && (overlay.style.display = 'block');
                    doRedirect('ffAndroid:' + selectors[s], hasForbidden);
                    redirected = true;
                }
            }
        }
        return redirected;
    }

    function monitorSelectorsAndRedirect() {
        // Under overlay: if forbidden appears in suggestions, redirect immediately
        const selectors = getSuggestionSelectors();
        let redirected = false;
        for (let s = 0; s < selectors.length; ++s) {
            const elements = document.querySelectorAll(selectors[s]);
            for (let i = 0; i < elements.length; ++i) {
                const txt = elements[i].textContent || '';
                if (containsAllowedWords(txt)) continue;
                const forbiddenMatch = containsForbiddenKeywords(txt);
                if (forbiddenMatch) {
                    overlay && (overlay.style.display = 'block');
                    if (!redirected) { redirected = true; doRedirect('selector:' + selectors[s], forbiddenMatch); }
                }
            }
        }

        // Firefox Android fallback
        if (!redirected && isFirefoxAndroid) {
            ffAndroidSuggestionScanAndRedirect();
        }
    }

    // --- Images blocking (kept) ---
    function blockImageResults() {
        if (isRedirecting) return;
        try {
            if (!/tbm=isch/.test(window.location.search)) return;
            const cards = document.querySelectorAll('.isv-r, .rg_bx, .TygpHb');
            for (let i = 0; i < cards.length; ++i) {
                const card = cards[i];
                const imgsAndLinks = card.querySelectorAll('img, a');
                let removeCard = false;
                for (let j = 0; j < imgsAndLinks.length; ++j) {
                    const src = imgsAndLinks[j].src || imgsAndLinks[j].href || '';
                    if (!src) continue;
                    if (matchesBlockedImagePattern(src)) { removeCard = true; break; }
                }
                if (removeCard) card.remove();
            }
            const anchors = document.querySelectorAll('a');
            for (let i = 0; i < anchors.length; ++i) {
                const a = anchors[i];
                if (a.href && matchesBlockedImagePattern(a.href)) {
                    a.remove();
                }
            }
        } catch (e) {}
    }

    function removeBlockedGoogleImageResults() {
        if (isRedirecting) return;
        try {
            const imageResults = document.querySelectorAll('div.isv-r');
            imageResults.forEach(container => {
                let matched = false;
                container.querySelectorAll('a, img').forEach(el => {
                    if (matched) return;
                    const href = el.href || '';
                    const src = el.src || '';
                    const alt = el.alt || '';
                    const title = el.title || '';
                    if (isBannedImage(href) || isBannedImage(src) || isBannedImage(alt) || isBannedImage(title)) matched = true;
                });
                if (!matched) {
                    const text = container.textContent || '';
                    if (isBannedImage(text)) matched = true;
                }
                if (matched) container.remove();
            });
        } catch (e) {}
    }

    // --- Overlay release control (Chrome: no-glimpse) ---
    function removeOverlayNow() {
        if (overlay && overlay.parentNode && !overlayRemoved) {
            overlay.parentNode.removeChild(overlay);
            overlayRemoved = true;
            devLog('Overlay removed (safe)');
        }
    }

    function maybeReleaseOverlay() {
        if (isRedirecting || overlayRemoved) return;
        // Only release overlay when we detect no forbidden suggestions present right now
        if (!hasForbiddenSuggestionText()) {
            removeOverlayNow();
        } else {
            // Keep overlay; suggestions had forbidden content and will trigger redirect elsewhere
        }
    }

    function tryRemoveOverlayOnHomepage() {
        if (isRedirecting || overlayRemoved) return;
        if (window.location.pathname === "/" && !new URLSearchParams(window.location.search).has('q')) {
            removeOverlayNow();
        }
    }

    // --- Main filtering (throttled) ---
    let filteringScheduled = false;
    function mainFilteringThrottled() {
        if (filteringScheduled) return;
        filteringScheduled = true;
        requestAnimationFrame(() => {
            mainFiltering();
            filteringScheduled = false;
        });
    }

    function mainFiltering() {
        if (isRedirecting) return;
        devLog('Main filtering');
        // Query check again (defense in depth if preflight missed anything)
        const sp = new URLSearchParams(window.location.search);
        const q = sp.get('q') || '';
        const bad = containsForbiddenKeywords(q);
        if (bad && !isUrlAllowed(window.location.href)) {
            overlay && (overlay.style.display = 'block');
            doRedirect('late-query', bad);
            return;
        }

        // NEW ORDER: scan suggestions first (so they can't be removed before redirect logic)
        monitorSelectorsAndRedirect();
        if (isRedirecting) return;

        // Then perform normal destructive filtering
        blockUrls();
        blockResults();
        blockImageResults();
        removeBlockedGoogleImageResults();

        // Non-destructive hides
        blockElementsBySelectors();
        blockElementsByPhrases();

        // If nothing forbidden found, we can safely remove overlay now
        maybeReleaseOverlay();
        tryRemoveOverlayOnHomepage();
    }

    // --- Start Filtering and Observe ---
    function startFilteringAndObserve() {
        devLog('Setting up mutation observer');
        interceptSearchInputChanges();

        // Observe entire document for FF Android (text changes are often characterData changes in aria-live containers)
        const container = (isFirefoxAndroid ? document.documentElement : (document.getElementById('search') || document.body || document.documentElement));
        domObserver = new MutationObserver((mutations) => {
            if (isRedirecting) return;
            // Small debounce to batch DOM bursts
            setTimeout(() => {
                if (isRedirecting) return;
                mainFilteringThrottled();
            }, 18);
        });

        const observerOptions = isFirefoxAndroid
            ? { childList: true, subtree: true, characterData: true, attributes: true }
            : { childList: true, subtree: true };

        try { domObserver.observe(container, observerOptions); } catch (e) {}
        devLog('Observer attached to: ' + (container === document.documentElement ? 'documentElement' : container.id || container.nodeName));

        // Periodic fallback scanner for Firefox Android (covers missed MutationObserver cases or async aria-live updates)
        if (isFirefoxAndroid) {
            try {
                ffAndroidScanAttempts = 0;
                ffAndroidScanInterval = setInterval(() => {
                    if (isRedirecting) {
                        clearInterval(ffAndroidScanInterval);
                        ffAndroidScanInterval = null;
                        return;
                    }
                    ffAndroidScanAttempts++;
                    // Scan more frequently at first, then stop after some time window
                    ffAndroidSuggestionScanAndRedirect();
                    // Also try to release overlay if it's safe
                    maybeReleaseOverlay();
                    if (ffAndroidScanAttempts > 120) { // ~60 seconds at 500ms
                        clearInterval(ffAndroidScanInterval);
                        ffAndroidScanInterval = null;
                    }
                }, 500);
                devLog('FF Android periodic scanner started');
            } catch (e) {}
        }

        mainFiltering();
    }

    // --- Enforce Google SafeSearch (kept; harmless on FF if ignored) ---
    function enforceSafeSearch() {
        try {
            document.cookie = "PREF=f2=8000000; domain=.google.com; path=/; secure";
            devLog('SafeSearch cookie set');
        } catch (e) {}
    }
    enforceSafeSearch();

    // --- Observe <body> for URL cleaning updates (kept) ---
    const bodyObserver = new MutationObserver(cleanGoogleUrl);
    function waitForBodyAndObserve() {
        if (document.body) {
            try {
                bodyObserver.observe(document.body, { childList: true, subtree: true });
                devLog('Body observer established');
            } catch (e) {}
        } else {
            setTimeout(waitForBodyAndObserve, 20);
        }
    }
    waitForBodyAndObserve();

    // --- Initialize ---
    function init() { startFilteringAndObserve(); }

    if (document.readyState === "loading") {
        devLog('Document loading - waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        devLog('Document ready - starting immediately');
        init();
    }

    devLog('=== GOOGLE.JS INITIALIZATION COMPLETE ===');
})();