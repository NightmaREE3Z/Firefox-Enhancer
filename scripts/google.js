(function () {
    'use strict';

    // === INSTANT GEMINI ABORT ===
    // Gemini's React router hates URL parameter stripping. 
    // Since we don't need filtering here, we kill the script immediately.
    if (window.location.hostname.includes('gemini.google.com')) {
    return;
    }

    // === DEBUG CONFIG (0 = off, 1 = on) ===
    const DEBUG = 1;

    // --- State (Moved to top to prevent ReferenceError) ---
    let isRedirecting = false;
    let domObserver = null;
    let ffAndroidScanInterval = null;
    let ffAndroidScanAttempts = 0;
    
    let lastMatchDetails = null;
    let lastRedirectInfo = null;
    let __lastKnownUrl = window.location.href; // Track URL for strict SPA awareness

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

    function devLog(message, ...rest) {
        if (!DEBUG) return;
        try { console.log('[GOOGLE.JS]', message, ...rest); } catch (e) {}
    }

    const previousRedirect = readPersistedRedirect();
    if (previousRedirect) {
        devLog('Previous redirect detected. Reason:', previousRedirect);
    }

    function logRedirect(triggerContext, triggerTerm) {
        try {
            console.log('[GOOGLE.JS] *** logRedirect CALLED ***', triggerContext, triggerTerm);
        } catch (e) {}
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

    try {
        window.GoogleJS = window.GoogleJS || {};
        window.GoogleJS.getLastRedirectInfo = () => lastRedirectInfo || readPersistedRedirect();
    } catch (e) {}

    devLog('=== GOOGLE.JS SCRIPT STARTING ===');
    devLog('Location: ' + window.location.href);

    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const isFirefox = /Firefox/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isFirefoxAndroid = isFirefox && isAndroid;
    devLog('Platform: ' + (isFirefoxAndroid ? 'Firefox Android' : (isFirefox ? 'Firefox Desktop' : 'Chrome/Desktop or other')));

    // === INSTANT WHITE OVERLAY ===
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

    try {
        document.documentElement.style.background = '#fff';
        document.body && (document.body.style.background = '#fff');
    } catch (e) {}

    let overlayRemoved = false;

    // === HELPER: DETECT GOOGLE IMAGE SEARCH ===
    function isGoogleImageSearch() {
        try {
            return /tbm=isch|udm=2/i.test(window.location.search) || 
                   window.location.pathname.includes('/imgres') || 
                   !!document.querySelector('.isv-r, #islsp, [data-b-rn="isch"]');
        } catch(e) { return false; }
    }

    // === CLICK LOCK FOR GRID ITEMS ===
    const clickedSignatures = new Set();

    function getClickSignatures(node) {
        if (!node || node.nodeType !== 1) return [];
        let sigs = [];
        const ved = node.getAttribute('data-ved');
        if (ved) sigs.push('ved:' + ved);
        
        const docid = node.getAttribute('data-docid') || node.getAttribute('data-id');
        if (docid) sigs.push('docid:' + docid);
        
        const ri = node.getAttribute('data-ri');
        if (ri) sigs.push('ri:' + ri);

        return sigs;
    }

    function isNodeClicked(node) {
        if (!node || node.nodeType !== 1) return false;
        if (node.dataset && node.dataset.googlejsClicked === '1') return true;
        if (node.closest && node.closest('[data-googlejs-clicked="1"]')) return true;
        
        const sigs = getClickSignatures(node);
        for (let i = 0; i < sigs.length; i++) {
            if (clickedSignatures.has(sigs[i])) {
                try { node.setAttribute('data-googlejs-clicked', '1'); } catch(e){}
                return true;
            }
        }
        
        if (node.closest) {
            const parent = node.closest('.isv-r, .rg_bx, .eA0Zlc, .wXeWr');
            if (parent) {
                if (parent.dataset && parent.dataset.googlejsClicked === '1') return true;
                const pSigs = getClickSignatures(parent);
                for (let i = 0; i < pSigs.length; i++) {
                    if (clickedSignatures.has(pSigs[i])) {
                        try { parent.setAttribute('data-googlejs-clicked', '1'); } catch(e){}
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function markAsClicked(target) {
        try {
            if (!isGoogleImageSearch()) return;
            const gridItem = target.closest('.isv-r, .rg_bx, .eA0Zlc, .wXeWr, a');
            if (gridItem) {
                gridItem.setAttribute('data-googlejs-clicked', '1');
                getClickSignatures(gridItem).forEach(s => clickedSignatures.add(s));
                
                const parent = gridItem.closest('.isv-r, .rg_bx, .eA0Zlc');
                if (parent) {
                    parent.setAttribute('data-googlejs-clicked', '1');
                    getClickSignatures(parent).forEach(s => clickedSignatures.add(s));
                }
            }
        } catch (err) {}
    }

    document.addEventListener('mousedown', function(e) {
        markAsClicked(e.target);
    }, true);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') markAsClicked(e.target);
    }, true);

    // === HIDE IMAGE RABBIT HOLES ===
    try {
        const hideStyle = document.createElement('style');
        hideStyle.textContent = `
            div.AnpO2b.bO5LNb, div.gx72we, div.VKHL9c, div.kC8B4e.Zjtggb.U48fD,
            div[role="listitem"]:has(a[href*="udm=39"]),
            div[role="listitem"]:has(a[href*="udm=50"]) {
                display: none !important; visibility: hidden !important;
                opacity: 0 !important; pointer-events: none !important; height: 0 !important;
            }
        `;
        document.documentElement.appendChild(hideStyle);
    } catch (e) {}

    // === REGIONAL TLD REDIRECTOR ===
    function forceGoogleComAndFi() {
        try {
            const urlObj = new URL(window.location.href);
            const hostname = urlObj.hostname.toLowerCase();
            const match = hostname.match(/^(?:(.*)\.)?google\.([a-z]+(\.[a-z]+)?)$/i);
            
            if (match) {
                const subdomain = match[1] ? match[1] + '.' : '';
                const tld = match[2];
                if (tld !== 'com' && tld !== 'fi') {
                    if (!isFirefox) {
                        const targetHref = urlObj.protocol + '//' + subdomain + 'google.com' + urlObj.pathname + urlObj.search + urlObj.hash;
                        try { window.stop && window.stop(); } catch(e) {}
                        window.location.replace(targetHref);
                        return true;
                    } else if (isFirefoxAndroid) {
                        const targetHref = urlObj.protocol + '//' + subdomain + 'google.com' + urlObj.pathname + urlObj.search + urlObj.hash;
                        let attempts = 0;
                        const ffTimer = setInterval(() => {
                            attempts++;
                            try { window.location.replace(targetHref); } catch(e) {}
                            try { window.location.href = targetHref; } catch(e) {}
                            if (attempts > 50) clearInterval(ffTimer);
                        }, 20);
                        return true;
                    } else {
                        const doFFRedirect = () => {
                            const freshUrl = new URL(window.location.href);
                            const targetHref = freshUrl.protocol + '//' + subdomain + 'google.com' + freshUrl.pathname + freshUrl.search + freshUrl.hash;
                            window.location.replace(targetHref);
                        };
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', doFFRedirect, { once: true });
                        } else {
                            doFFRedirect();
                        }
                        return true; 
                    }
                }
            }
        } catch (e) {}
        return false;
    }

    // === FORCE WEB SEARCH DEFAULT ===
    function forceWebSearchDefault() {
        if (isRedirecting) return false;
        try {
            const url = new URL(window.location.href);
            if (url.pathname.includes('/search') && url.searchParams.has('q')) {
                if (!url.searchParams.has('udm') && !url.searchParams.has('tbm')) {
                    if (url.searchParams.get('source') !== 'lnms') {
                        isRedirecting = true;
                        url.searchParams.set('udm', '14'); 
                        
                        if (overlay) overlay.style.display = 'block';
                        
                        window.location.replace(url.toString());
                        return true;
                    }
                }
            }
        } catch (e) {}
        return false;
    }

    if (forceGoogleComAndFi()) return;
    if (forceWebSearchDefault()) return;

    // === TLD HIDER LOGIC ===
    const blockedTLDs = [
        '.ai', '.app', '.art', '.io', '.makeup', '.off', '.club', '.id', '.it', '.best', '.cc', '.cn', '.click',
        '.you', '.to', '.top', '.me', '.us', '.ru', '.vip', '.online', '.hot', '.her', '.sex', '.xxx', '.nsfw',
        '.porn', '.show', '.work', '.fit', '.tool', '.tools', '.system', '.systems', '.surf', '.review', '.asia',
        '.tokyo', '.monster', '.info', '.机构', '.xn--nqv7f', '.one', '.ee', '.in', '.gf', '.fox', '.fun', '.exposed',
        '.fyi', '.fr', '.life', '.now', '.today', '.world', '.xyz', '.zone'
    ];

    function isBannedTLD(urlStr) {
        if (!urlStr) return false;
        try {
            const hostname = new URL(urlStr, window.location.origin).hostname.toLowerCase();
            return blockedTLDs.some(tld => hostname.endsWith(tld));
        } catch(e) { return false; }
    }

    // --- Keyword arrays ---
    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i, /\bbra\b/i, /\bass\b/i, /generat/i,
        /\bmorph\b/i, /inpaint/i, /art intel/i, /birpp/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /ismartta/i, /image enhanced/i, /image enhancing/i, /virtual touchup/i, /retouch/i, /touchup/i, /touch up/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /v5co/i, /v5c0/i, /vsc0/i, /riisu/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhance image/i, /erootti/i,
        /vegi/i, /vege/i, /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /birppis/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i,
        /Tiffa/i, /Stratt/i, /puzz/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /izzi dame/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i, /generator/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /\bVega\b/i, /\bSlut\b/i, /3dit/i, /ed1t/i, /playboy/i, /poses/i,
        /Sydney Sweeney/i, /Sweeney/i, /\bFap\b/i, /Sydnee/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bAMX\b/i, /posing/i, /Sweee/i,
        /\bAnal-\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i,  /\bAi-\b/i, /\b-Ai\b/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bADM\b/i, /\bAis\b/i, /\bedit\b/i, /Feikki/i, /syväväärennös/i,
        /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /\bShe\b/i, /\bADMX\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /syvä väärennös/i, /alaston/i, /\bHer\b/i, /\bAnal\b/i, 
        /P4IG3/i, /Paig3/i, /P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /editor/i, /Tw4t/i, /Brltt/i, /\bTay\b/i, /\balexa wwe\b/i, /\bazz\b/i, /\bjaida\b/i, /Steph/i, /St3ph/i, /editation/i, /3d!7/i, /3d!t/i, /ed!t/i, 
        /Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /CJ Perry/i, /Lana WWE/i, /Lana Del Rey/i, /\bLana\b/i, /CJ WWE/i, /image app/i, /edi7/i, /3d17/i, /ed!7/i,
        /pillu/i, /perse/i, /\bFuku\b/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /Peba/i, /Beba/i, /Bepa/i, /Babe/i, /baby/i, /\bAnaali\b/i, /\bSeksi\b/i, /picture app/i, /edit app/i, /pic app/i, /photo app/i, /syvavaarennos/i, /Perry WWE/i,
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen|poistamis)[ -]?(?:vaatteet|vaatteiden)/i, /\bAnus\b/i, /sexuaali/i, /Chel5/i, 
        /arxiv/i, /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i, /sexual/i, /seksuaali/i, /play boy/i, /yhdyntä/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /\bMina\b/i, /fantasy edit/i, /AI recreation/i, /seksuaalisuus/i, /synthetic model/i,
        /Margot/i, /Robbie/i, /Ana de Armas/i, /soulgen/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Generated/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i, /artificial model/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /enhanced image/i, /joinface/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /erotiikka/i, /läpinäkyvä/i, 
        /vaatepoisto/i, /poista vaatteet/i, /vaatteiden poisto/i, /tekoäly/i, /panee/i, /panevat/i, /paneminen/i, /panemis/i, /paneskelu/i, /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimista/i, /uncover/i, /leak/i, /Micki/i,
        /Stratusfaction/i, /yhdynnässä/i, /seksikuva/i, /seksivideo/i, /seksi kuvia/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i, /panokuva/i, /pano kuva/i, /pano kuvia/i, /panokuvia/i, /banned app/i,
        /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpittäminen/i, /sormetus/i, /sormitus/i, /sormitta/i, /sormetta/i,
        /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkkyvid/i, /aikuisviihde/i, /fisting/i, /fistaus/i,
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuis sisältö/i, /aikuiskontsa/i, /filmora/i, /aikuiskontentti/i, /aikuis kontentti/i, /aikuiskontentti/i, /aikuis contentti/i, /mat1c/i, /pleasi/i, /pleasu/i, /herself/i, /her self/i, 
        /\bRembg\b/i, /\bRem bg\b/i, /\bDel bg\b/i, /\bDelbg\b/i, /delet bg/i, /fuck/i, /eras bg/i, /delet bg/i, /erase bg/i, /erasing bg/i, /bg delet/i, /bg erasing/i, /bg erase/i, /Blend face/, /Blendface/, /morphi/, /Blender face/, 
        /\bMorf\b/i, /morfi/, /fappi/i, /skin viewer/i, /skinviewer/i, /cloth/i, /clothing/i, /clothes/i, /female/i, /al4ston/i, /p!llu/i, /p!mppi/i, /p!mpp!/i, /pimpp!/i, /nakukuva/i, /nakuna/i, /kuvaton/i, /AI model$/i, /trained model$/i,
        /Reface/i, /DeepAI/i, /GFPGAN/i, /RestoreFormer/i, /FaceMagic/i, /desnudador/i, /des nudador/i, /pixary/i, /GAN-based/i, /diffusion/i, /latent/i, /prompt ex/i, /txt2img/i, /img2img/i, /image to image/i, /image 2 image/i, /model/i, 
        /imagetoimage/i, /image2image/i, /girl/i, /woman/i, /women/i, /babe/i, /waifu/i, /wife/i, /spouse/i, /celeb/i, /celebrit/i, /Face Magic/i, /ex prompt/i, /example prompt/i, /prompt example/i, /4l4ston/i, /last0n/i, /l4st0n/i,
        /removebg/i, /remove bg/i, /remov bg/i, /removal bg/i, /ia onl/i, /removebg/i, /removalbg/i, /rembg/i, /rem background/i, /del background/i, /eras background/i, /erase background/i, /erasing background/i, /butth/i, /buttc/i, 
        /\bIA\b/i,/\bIas\b/i, /\b-Ia\b/i, /\bIa-\b/i, /background eras/i, /\bHoro\b/i, /background del/i, /background rem/i, /background off/i, /off background/i, /background out/i, /out background/i, /removbg/i, /ladies/i, /lady/i,
        /buttc/i, /butt c/i, /butt h/i, /sugarla/i, /butt s/i, /\bMLM\b/i, /\bLLM\b/i, /\bTit\b/i, /\bGen\b/i, /\bTits\b/i, /learn model/i, /mach model/i, /titten/i, /combin fac/i, /merg fac/i, /fac merg/i, /fac comb/i, /fac blend/i, 
        /poista vaatteet/i, /poista vaat/i, /vaatteidenpoist/i, /vaatepoist/i, /poistavaat/i, /poistovaat/i, /too merg/i, /merg too/i, /two fac/i, /two fac/i, /too fac/i, /too fac/i, /fac join/i, /join fac/i, /bg remov/i, /Trish/i,
        /join 2 fac/i, /Stormwrestl/i, /Stormrassl/i, /\bChaturbate\b/i, /Storm wrestl/i, /Storm rassl/i, /Toni AEW/i, /Storm AEW/i, /Toni WWE/i, /softw/i, /Toni AEW/i, /Genius of The Sky/i, /\bToni\b/i, /huora/i, /huoru/i, /horats/i,
        /prostitoitu/i, /ilotyttå/i, /ilotyttö/i, /ilötyttö/i, /ilötytto/i, /ilåtyttå/i, /ilåtyttö/i, /iløtyttö/i, /iløtytto/i, /iløtyttø/i, /il0tyttö/i, /il0tytto/i, /il0tytt0/i, /il0tyttå/i, /il0tyttø/i, /1lotyttö/i, /1lotytto/i, 
        /!lotyttö/i, /ilotyttø/i, /ilotytt0/i, /ilotytto/i, /\bStripchat\b/i, /bordel/i, /bordel/i,  /bordelli/i, /ilotalo/i, /ilåtalo/i, /ilåtalå/i, /ilotalå/i, /iløtalo/i, /ilötalo/i, /il0talo/i, /iløtalå/i, /ilötalå/i, /ilotalø/i,
        /\b0rg\b/i, /\bg45m\b/i, /\bGa5m\b/i, /\bG4sm\b/i, /\b@$\b/i, /\*/i, /erotii/i, /vercel/i, /erooti/i, /erootii/i, /\bkuvake\b/i, /kuvakenet/i, /venoi/i, /venic/i, /kuvake.net/i, /toniwwe/i, /tonywwe/i, /\bphotor\b/i, /fotor/i, 
        /Shirakawa/i, /Shira/i, /Shiri/i, /Shir/i, /biscit/i, /bisci/i, /bisce/i, /biszit/i, /bizcit/i, /biskui/i, /bizkita/i, /bizkitb/i, /bizkitc/i, /bizkitd/i, /bizkitt/i, /bizkitx/i, /bizkitz/i, /bizkitn/i, /bizkitm/i, /buttz/i, 
        /bizkito/i, /bizkity/i, /bizkith/i, /bizkitv/i, /bizkitå/i, /bizkitä/i, /bizkitö/i, /biscuita/i, /biscuitb/i, /biscuitc/i, /biscuitd/i, /biscuite/i, /biscuitf/i, /biscuitg/i, /biscuith/i, /biscuiti/i, /biscuitj/i, /Leona/i, 
        /biscuitk/i, /biscuitl/i, /biscuitm/i, /biscuitn/i, /biscuito/i, /biscuitp/i, /biscuitq/i, /biscuitr/i, /biscuits/i, /biscuitt/i, /biscuitu/i, /biscuitv/i, /biscuitw/i, /biscuitx/i, /biscuity/i, /biscuitz/i, /biscuitå/i, /butts/i, 
        /cunt/i, /biscuitä/i, /biscuitö/i, /biscuitö/i, /butta/i, /buttb/i, /buttc/i, /buttd/i, /buttf/i, /buttg/i, /butth/i, /butti/i, /buttj/i, /buttk/i, /buttl/i, /buttm/i, /buttn/i, /butto/i, /buttp/i, /buttq/i, /buttr/i, /butts/i, 
        /buttt/i, /buttu/i, /buttv/i, /buttw/i, /buttx/i, /butty/i, /buttz/i, /buttå/i, /buttä/i, /buttö/i, /Micky/i, /Mickie/i, /Mickie James/i, /Dixie/i, /Carter/i, /\bTNA\b/i, /\bGina\b/i, /\bGin4\b/i, /\bG1n4\b/i, /Gina Adams/i, 
        /\bG1na\b/i, /Valtez/i, /\bGlna\b/i, /\bG!na\b/i, /Gina Adam/i, /Adams WWE/i, /Gina WWE/i, /windsor/i, /alex wind/i, /Alex Windsor/i, /analsex/i, /\bGril\b/i, /\bGrils\b/i, /wemen's/i, /wemen/i, /wemon's/i, /wemons/i, /The Kat/,
        /Nikki/i, /ldaies/i, /laadie/i, /laadis/i, /leydis/i, /leydies/i, /lewdy/i, /lewdi/i, /lewdie's/i, /wuhmans/i, /wahmans/i, /wehmans/i, /Torrie/i, /Torr1/i, /Torr!/i, /Torrl/i, /wilson/i, /Kitty WWE/, /\bGail\b/i, /\bKim\b/i, 
        /\bAshley\b/i, /Dawn Marie/i, /Down Marie/i, /Massaro/i, /\bPamela\b/i, /\bBrooke\b/i, /\bTylo\b/i, /\bCatherine\b/i, /\bBridget\b/i, /\bSally\b/i, /0rg4/i, /org4/i, /org4/i, /orgy/i, /orgi/i, /org@/i, /0rg@/i, /0rgi/i, /0rga5m/i, 
        /origas/i, /0riga/i, /0r1g4/i, /0rlg4/i, /orlg4/i, /0rlg@/i, /orlg@/i, /origa/i, /0riga/i, /or1ga/i, /orig4/i, /0r1g4/i, /0rlga/i, /orlg4/i, /0rlg4/i, /0rlg@/i,/orlg@/i, /0rrg4/i, /orrg4/i, /or1g@/i, /0r1g@/i, /0r1ga/i, /0r!g@/i,
        /0r!g4/i, /0rig@/i, /0rig4/i, /0r9ga/i, /0r9g4/i, /0r1q4/i, /0r1qa/i, /0rlg4h/i, /or1g@h/i, /orrga/i, /orrgaa/i, /orgaa/i, /\bApple\b/i, /Dreamboot/i, /Dream boot/i, /\bSX\b/i, /Sxuel/i, /Sxual/i, /Sxu3l/i, /5xu3l/i, /5xuel/i, 
        /5xu4l/i, /5xual/i, /dre4m/i, /dr34m/i, /bo0th/i, /b0oth/i, /b0o7h/i, /bo07h/i, /b007h/i, /b00th/i, /booo/i, /b0oo/i, /bo0o/i, /boo0/i, /b000/i, /booo/i, /n000/i, /n00d/i, /no0d/i, /n0od/i, /\bNud\b/i, /\bdpnod\b/i, /\bdp nod\b/i, 
        /\bvsco\b/i, /\bdp nood\b/i, /\bdp nod\b/i, /\bdep nod\b/i, /dpnod/i, /dpnood/i, /dpnud/i, /depnud/i, /depnuud/i, /depenud/i, /depenuu/i, /dpepenud/i, /dpeepenud/i, /dpeepnud/i, /dpeependu/i, /dpeepndu/i, /Elayna/i, /Eleyna/i, 
        /Elena/i, /Elyna/i, /Elina WWE/i, /Elyna WWE/i, /Elyina/i, /Elina Blac/i, /Elina Blak/i, /Aikusviihde/i, /Aikus viihde/i, /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i,
        /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, /topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, 
        /Jenn1/i, /J3nn1/i, /J3nni/i, /J3nn4/i, /Jenn4/i, /persreikä/i, /perse reikä/i, /pers reikä/i, /pyllyn reikä/i, /pylly reikä/i, /pyllynreikä/i, /pyllyreikä/i, /persa/i, /pers a/i, /anusa/i, /anus a/i, /pers-/i, /pylly-/i, /m471c/i,
        /pyllyn-/i, /Twat/i, /-reikä/i, /-aukko/i, /-kolo/i, /pimpp/i, /pimpe/i, /pinpp/i, /pinpi/i, /pimpi/i, /pimps/i, /pimsu/i, /pimsa/i, /pimps/i, /pilde/i, /pilper/i, /tussu/i, /tuhero/i, /emätin/i, /softorbit/i, /soft orbit/i, /\bFux\b/i,
        /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, /OracleVM/i, /virtualmachine/i, /virtual machine/i,
        /kuvankäsittely/i, /virtuaalikone/i, /virtuaali kone/i, /virtuaali tietokone/i, /virtuaalitietokone/i, /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, /virtuaali masiina/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i,
        /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i,
        /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i, /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /ma71c/i,
        /virtmachine/i, /virt-machine/i, /virtumachine/i, /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, /\bMachiene\b/i, /vi mach/i, /vir mach/i,
        /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /virtual machi/i, /waterfox/i, /water fox/i, /waterf0x/i, /water f0x/i, /waterfux/i, /water fux/i, /ma7ic/i,
        /\bMimmi\b/i, /\bMimmuska\b/i, /\bM1mmi\b/i, /\bM1mmuska\b/i, /\bMimm1\b/i, /\bM1mmusk4\b/i, /\bMimmusk4\b/i, /lahiopekoni/i, /lähiopekoni/i, /lähiöpekoni/i, /lahiöpekoni/i, /LTheory/i, /LuTheory/i, /LusTheory/i, /L-Theory/i, /m4tic/i,
        /LustTheory/i, /Lust Theory/i, /Lu-Theory/i, /Lus-Theory/i, /Lust-Theory/i, /ComfyUI/i, /Comfy-UI/i, /ComfyAI/i, /Comfy-AI/i, /Midjourney/i, /StaphMc/i, /Staph McMahon/i, /MeekMahan/i, /MekMahan/i, /MekMahaan/i, /Mek Mahaan/i, /4ut0/i,
        /Meek Mahaan/i, /Meek Mahan/i, /Meek Mahon/i, /Mek Mahon/i, /MeekMahon/i, /MekMahon/i, /CoAi/i, /ComAi/i, /ComfAi/i, /ComfoAi/i, /ComforAi/i, /ComfortAi/i, /ComfortaAi/i, /ComfortabAi/i, /ComfortablAi/i, /ComfortableAi/i, /Aut0/i, /4uto/i,
        /Co-Ai/i, /Com-Ai/i, /Comf-Ai/i, /Comfo-Ai/i, /Comfor-Ai/i, /Comfort-Ai/i, /Comforta-Ai/i, /Comfortab-Ai/i, /Comfortabl-Ai/i, /Comfortable-Ai/i, /Runcomfy/i, /Run comfy/i, /Run-comfy/i, /Aut1111/i, /Automatic11/i, /Automatic 11/i, /m4t1c/i,
        /m4t1c/i, /mat1c/i, /m4tic/i, /m47ic/i, /ma7ic/i, /ma71c/i, /m471c/i, /Becky/i, /Becki/i, /Rebecca/i, /\bAmber\b/i, /Amber Heard/i, /without cloth/i, /without pant/i, /without tshirt/i, /without t-shirt/i, /without boxer/i, /b0x3r/i, /box3r/i,
        /b0xer/i, /woman without/i, /women without/i, /girl without/i, /lady without/i, /ladies without/i, /tyttöjä/i, /naisia/i, /tytöt/i, /naiset/i, /nainen/i, /naikkoset/i, /mimmejä/i, /misu/i, /pimu/i, /lortto/i, /lutka/i, /lumppu/i, /narttu/i, 
        /huora/i, /huoru/i, /girlfriend/i, /boyfriend/i, /girl friend/i, /boy friend/i, /sperm/i, /bikini/i, /linger/i, /underwear/i, /under wear/i, /without dres/i, /with out dres/i, /Eliyna/i, /bik1/i, /Jazmyn/i, /Jaszmyn/i, /Jazsmyn/i, /Jazmin/i,
        /Dualipa/i, /Dua Lipa/i, /Dual Lipa/i, /Dual ipa/i, /chang pos/i, /selfie body/i, /belfie/i, /pos chang/i, /post chang/i, /change post/i, /change pose/i, /post change/i, /pose change/i, /pose change/i, /posture change/i, /Jasmin/i, /stefe/i, 
        /postu edit/i, /pose edit/i, /edit postu/i, /edit pose/i, /editor postu/i, /editor pose/i, /postu editor/i, /pose editor/i, /postu modi/i, /pose modi/i, /pic online/i, /pict online/i, /phot onli/i, /fhot onli/i, /foto onli/i, /body selfie/i,
        /body belfie/i, /full body/i, /pic body/i, /pict body/i, /phot body/i, /image body/i, /img body/i, /postu tweak/i, /pose tweak/i, /twerk/i, /pose swap/i, /post swap/i, /body swap/i,  /pose adjust/i, /post adjust/i, /body adjust/i, /stefa/i, 
        /adjust pose/i, /adjust posture/i, /pose trans/i, /post trans/i, /pose morph/i, /post morph/i, /body morph/i, /body reshape/i, /shape body/i, /repose/i, /repose edit/i, /pose redo/i, /repose chang/i, /body editor/i, /body filter/i, /filter body/i,
        /angle chang/i, /change angle/i, /edit angle/i, /camera angle/i, /head turn/i, /body turn/i, /pose reconstruct/i, /reconstruct pose/i, /pose fix/i, /fix pose/i, /body fix/i, /fix body/i, /edit selfie/i, /AIRemove/i, /RemoveAI/i, /RemovalAI/i, 
        /selfie editor/i, /selfie morph/i, /pose shift/i, /posture shift/i, /angle shift/i, /pic shift/i, /phot shift/i, /img shift/i, /ima shift/i, /promeai/i, /prome-ai/i, /openpose/i, /open pose/i, /open-pose/i, /AIRemov/i, /RemovAI/i, /AIRemoving/i, 
        /pose-open/i, /poseopen/i, /pos open/i, /\bLily\b/i, /\bLili\b/i, /\bLilli\b/i, /\bLilly\b/i, /Lily Adam/i, /Lilly Adam/i, /\bTatu\b/i, /Toiviainen/i, /Tatujo/i, /PiFuHD/i, /Hirada/i, /Hirata/i, /Cathy/i, /Kathy/i, /Catherine/i, /AIRemoval/i, 
        /Prim3r/i, /Pr1m3r/i, /Pr1mer/i, /Primar/i, /Pr1m4r/i, /Pr1mar/i, /Pramer/i, /Pramir/i, /LaPrime/i, /LaPrima/i, /LaPr1ma/i, /L4Pr1ma/i, /LaPr1m4/i, /LaPrim4/i, /LaPrim3/i, /LaPr1m3/i, /grok/i, /LaPr1me/i, /Prim3r/i, /Primer/i, /stefe/i, /stefa/i, 
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
        /tittt/i, /tiitt/i, /crotch/i, /thigh/i, /legjob/i, /asssex/i, /buttsex/i, /titsex/i, /buttsex/i, /ass sex/i, /butt sex/i, /tit sex/i, /butt sex/i, /buttstuff/i, /butt stuff/i, /p0rn/i, /redtube/i, /xhamster/i, /asstube/i, /butttube/i, /FapAI/i, 
        /adulttube/i, /adult tube/i, /HerAi/i, /AiHer/i, /SheAi/i, /AIShe/i, /AroundAI/i, /HerAround/i, /AroundHer/i, /TurnHer/i, /0nl1/i, /HerTurn/i, /SheAround/i, /AroundShe/i, /TurnShe/i, /SheTurn/i, /-her/i, /her-/i, /-she/i, /she-/i, /AIFap/i, /AIHug/i, 
        /FapAI/i, /HugAI/i, /AIAdult/i, /AdultAI/i, /AIContent/i, /ContentAI/i, /AICreate/i, /CreateAI/i, /AICreating/i, /CreatingAI/i, /AICreation/i, /CreationAI/i, /AIMake/i, /MakeAI/i, /AIMaking/i, /MakingAI/i, /AIOut/i, /OutAI/i, /AIStuff/i, /StuffAI/i,
        /t0ol/i, /to0l/i, /t00l/i, /70ol/i, /7o0l/i, /700l/i, /FindAI/i, /FinderAI/i, /FindingAI/i, /AIFind/i, /DirectoryAI/i, /AIDirect/i, /AILook/i, /LookAI/i, /LooksAI/i, /LookupAI/i, /Look-upAI/i, /LookingUpAI/i, /UpLookAI/i, /AIUpLook/i, /ButtAPP/i,
        /APPAI/i, /AIAPP/i, /AssAI/i, /AIAss/i, /AssAPP/i, /AppAss/i, /Ass-/i, /-Ass/i, /Butt-/i, /-Butt/i, /Cooch-/i, /-Cooch/i, /Coochie-/i, /Kewch-/i, /-Kewch/i, /Kewchie-/i, /Coachie/i, /K3wc/i, /cooch/i, /tush/i, /7ush/i, /7u5h/i, /tu5h/i, /AITit/i,
        /TitAI/i, /TitsAI/i, /AIBoob/i, /BoobAI/i, /BoobsAI/i, /BoobieAI/i, /BoobiesAI/i, /BoobyAI/i, /BoobysAI/i, /Boob/i, /titti/i, /titty/i, /ellie/i, /3llie/i, /elli3/i, /3lli3/i, /cha0tic/i, /AISketch/i, /SketchAI/i, /AIDraw/i, /AIDrew/i, /DrawAI/i, 
        /DrewAI/i, /DrawsAI/i, /DrawingAI/i,/DrawingsAI/i, /PaintAI/i, /PaintsAI/i, /PaintingAI/i, /PaintingsAI/i, /AIPain/i, /OpenHerLegs/i, /OpenLegs/i, /OpeningLegs/i, /OpeningHerLegs/i, /OpensLegs/i, /OpensHerLegs/i, /SpreadLeg/i, /SpreadHerLeg/i,
        /cunnt/i, /cunnn/i, /SpreadingLeg/i, /SpreadingHerLeg/i, /SpreadsLeg/i, /SpreadsHerLeg/i, /HerThig/i, /HerLeg/i, /HerThic/i, /SheThig/i, /SheLeg/i, /SheThic/i, /HerLeg/i, /HerThic/i, /LegShe/i, /LegsShe/i, /Thicc/i, /ThickShe/i, /fondl/i, /bdsm/i,
        /4ppli/i, /4ppl1/i, /appl1/i, /pr0gram/i, /progr4m/i, /pr0gr4m/i, /pr0/i, /gr4m/i, /römpsä/i, /römpsä/i, /rompsä/i, /römpsa/i, /rompsa/i, /tussu/i, /tusspa/i, /tuspand/i, /pilde/i, /pilpe/i, /persaus/i, /persvako/i, /persevako/i, /persreikä/i, 
        /penis/i, /kulli/i, /kyrpa/i, /kyrpä/i, /kikkeli/i, /pippeli/i, /persereikä/i, /tekoäly/i, /teko äly/i, /generativ/i, /reveals/i, /reveali/i, /revealing/i, /reveale/i, /stripp/i, /strips/i, /stripz/i, /stripi/i, /striper/i, /stripes/i, /striped/i,
	/shetakeoff/i, /takeoffher/i, /takesoffher/i, /shetakesoff/i, /takingoff/i, /tookoffher/i, /shetookoff/i, /baring/i, /bares/i, /b4re/i, /bar3/i, /b4r3/i, /b4r1/i, /bar1/i, /b4ri/i, /censor/i, /sencor/i, /zencor/i, /zensor/i, /zenzor/i, /cencor/i, 
	/cenzor/i, /cens0/i, /c3ns/i, /cen5/i, /c3n5/i, /cen5o/i, /blisswwe/i, /c3n5o/i, /zen5o/i, /z3n5o/i, /s3n5o/i, /sen5o/i, /s3nso/i, /s3nc/i, /ph0t/i, /p1c/i, /picc/i, /im4g/i, /img online/i, /image online/i, /photo online/i, /pic online/i, /onl1/i, 
	/ungoogl/i, /chromium/i, /chr0m/i, /m1um/i, /fappp/i,/skirt/i, /skirr/i, /skitr/i, /sk1r/i, /5kir/i, /5k1r/i, /5k1r/i, /\bH3r\b/i, /\bsh3\b/i, /\b5he\b/i, /\b5h3\b/i, /v3rc/i, /v3rz/i, /v3rs/i, /v3r5/i, /depn/i, /d3pn/i, /deppn/i, /depenu/i, /depeni/i,
	/deipn/i, /diepn/i, /artifi/i, /artin/i, /iconicto/i, /-tool/i, /d3ppn/i, /d3penu/i, /d3p3nu/i, /dep3nu/i, /depeni/i, /d3peni/i, /d3p3ni/i, /d3p3n1/i, /d3p3n!/i, /dep3n1/i, /dep3n!/i, /d3pen1/i, /d3pen!/i, /p05/i, /po5/i, /p0s/i, /postur/i, /posin/i, 
	/Anthr/i, /\bAnt\b/i, /Antro/i, /\bS0ft\b/i, /s0ftw/i, /softw/i, /\b50ft\b/i, /w4re/i, /war3/i, /w4r3/i, /p41n/i, /pa1n/i, /p4in/i, /ndif/i, /ndfy/i, /nd1f/i, /nd!f/i, /ndlf/i, /shag/i, /5hag/i, /5h4g/i, /sh4g/i, /f4gg/i, /fagg3/i, /fagger/i, /\bFag\b/i,
	/wedgi/i, /wedge/i, /wedgy/i, /wedg1/i, /wedg!/i, /w3dg/i, /w33d/i, /we3d/i, /w3ed/i, /w333d/i, /w3333/i, /we333/i, /w3e33/i, /w33e3/i, /w333e/i, /we33e/i, /we3e3/i, /wee3e/i, /w3e3e/i, /weee/i, /w3333/i, /edgin/i, /3dg1n/i, /edgyi/i, /edgy1/i, /3dgy1/i,
	/vaat.*pois/i, /vaatteet pois/i, /3dgin/i, /edg1n/i, /edg1i/i, /edgi1/i, /3dg1i/i, /3dgi1/i, /edgiy/i, /edgye/i, /bliswwe/i, /\bRinnat\b/i, /\bTissi\b/i, /\bTisu\b/i, /\bTisut\b/i, /rintalii/i, /rinta lii/i, /tissi/i, /r1nta/i, /r1nt4/i, /rint4/i, /l1ivi/i, 
	/sexi/i, /liiv1/i, /l1iv1/i, /li1v1/i, /l11v1/i, /l11vi/i, /bl15s/i, /bl1s5/i, /bl155/i, /bl1ss/i, /bli55/i, /\bAnus\b/i, /anusaukko/i, /anus-aukko/i, /anus aukko/i, /pers aukko/i, /persaukko/i, /perseaukko/i, /perse aukko/i, /perse-aukko/i, /pers-aukko/i,
	/bliswwe/i, /li1vi/i, /p3rs aukko/i, /p3r5 aukko/i, /per5 aukko/i, /0nli/i,/p3rs-aukko/i, /p3r5 aukko/i, /per5 aukko/i, /p3rse/i, /pers3/i, /p3rs3/i, /per5e/i, /per53/i, /p3r5e/i, /p3r53/i, /rints/i, /r1nts/i, /r1nt5/i, /rint5/i, /p1p4r/i, /pip4r/i, /p1par/i, 
	/Stratu/i, /machinelearning/i, /Kairi/i, /sexx/i, /4lexa/i, /al3xa/i, /alex4/i, /4l3xa/i, /al3x4/i, /4l3x4/i, /4lex4/i, /bl15s/i, /bl1s5/i, /bl155/i, /blis5/i, /bli5s/i, /artintel/i,
    ]; 

    // --- NEW: DYNAMIC WRESTLER BANS FROM WRESTLING.JS ---
    function applyDynamicWrestlerBans() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            try {
                chrome.storage.local.get(['wrestling_women_urls'], function(result) {
                    if (result.wrestling_women_urls && Array.isArray(result.wrestling_women_urls)) {
                        let addedCount = 0;
                        
                        // Core exclusions to prevent global bans
                        const localExclusions = ['melina', 'melina-perez', 'aj-lee', 'aj', 'becky-lynch', 'becky'];

                        result.wrestling_women_urls.forEach(url => {
                            const parts = url.split('/').filter(Boolean);
                            const slug = parts[parts.length - 1].toLowerCase();
                            
                            if (localExclusions.includes(slug)) return;

                            const name = slug.replace(/-/g, ' ');
                            const namePattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            
                            // Prevent duplicates
                            const isDuplicate = regexKeywordsToHide.some(rx => rx.source && rx.source.includes(namePattern));

                            if (!isDuplicate) {
                                if (name.length <= 6 || !name.includes(' ')) {
                                    regexKeywordsToHide.push(new RegExp('\\b' + namePattern + '\\b', 'i'));
                                } else {
                                    regexKeywordsToHide.push(new RegExp(namePattern, 'i'));
                                }
                                addedCount++;
                            }
                        });
                        
                        if (addedCount > 0) {
                            devLog(`Dynamically added ${addedCount} wrestler names from shared storage to blocklist.`);
                            // Re-run main filtering immediately to apply new rules
                            if (typeof mainFiltering === 'function') {
                                mainFiltering();
                            }
                        }
                    }
                });
            } catch(e) {}
        }
    }
    // Execute immediately
    applyDynamicWrestlerBans();

    // Special Regexes array, kept separate for readability.
    const specialRegexes = [
        /gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img)))|(?:re(?:mov(?:e|al|ing)?|m)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|denois(?:e|er|ing)?)(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic(?:t(?:ure|ures)?)?|image|img))?(?:[\s_\-\/.]{0,3}gr[a4][i1l]n)|gr[a4][i1l]n(?:[\s_\-\/.]{0,3}(?:ph(?:o|0)?t(?:o|0)?|pic|image|img))|(?:ph(?:o|0)?t(?:o|0)?|pic|image|img)(?:[\s_\-\/.]{0,3}fix)/i, /lex.*bl/i, /liv.*morgan/i, /saad.*pipar/i, /s4ad.*pipar/i, /s44d.*pipar/i, /sa4d.*pipar/i, /rint.*pois/i, /dress.*remov/i,
        /(?:n(?:o|0)ise(?:[\s_\-\/.]{0,3}(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?))|(?:re(?:mov(?:e|al|ing)?|m|duc(?:e|ed|ing|tion)?)|(?:delet(?:e|ing|ion)?|del)|eras(?:e|ing)?|fix|filter(?:ing)?)(?:[\s_\-\/.]{0,3})n(?:o|0)ise|de[\s_\-\.]?n(?:o|0)is(?:e|er|ing)?)/i, /make.*(move|gif|video)/i, /photo.*(move|gif|video)/i, /image.*(move|gif|video)/i, /pic.*(move|gif|video)/i, /img.*(move|gif|video)/i, /booty/i, /ass.*(animat|ai|move)/i, /twerk/i, /twerking/i, /jiggle/i, /bounce.*(ai|gif)/i, /booty.*(ai|gif|video|animat)/i, /ass.*(ai|gif|video|animat)/i, /mangoanimat/i, /deepnude/i, /undress/i, /strip.*ai/i, /nude.*ai/i, /clothes.*remove/i, /remove.*(clothes|clothing|dress)/i, /face.*(swap|deepfake|replace)/i, /vaat.*pois/i, /hous.*pois/i, /pait.*pois/i, /pait.*pois/i, /liiv.*pois/i, /alushous.*pois/i, /alkkarit.*pois/i, /alusvaat.*pois/i, /clothing.*remove/i, 
/alexa.*(wwe|wrest|ras|NXT|pro)/i, /blis.*(wwe|wrest|ras|NXT|pro)/i, /lexa.*(wwe|wrest|ras|NXT|pro)/i, /lexi.*(wwe|wrest|ras|NXT|pro)/i, /blis.*(wwe|wrest|ras|NXT|pro)/i, /bils.*(wwe|wrest|ras|NXT|pro)/i, /lex.*(kauf|cabr|carb)/i, /model.*(mach|langu)/i, /robe.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin)/i,
/robe.*(malf|func)/i, /ring gear|trunk|pant|shirt|jacket.*(malf|func)/i, /malfunc.*(wwe|tna|aew|njpw|wrestl|rasll|rasslin|ring)/i, 

    ];

    const stringKeywordsToHide = [
        "Blis", "Tiffany", "Tiffy", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Tegan Nox", "Charlotte Flair", "Becky Lynch", "Michin", "Mia Yim", "WWE Woman", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven", "Alba Fyre", "@yaonlylivvonce", 
        "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Jordynne", "WWE Women", "WWE Women's", "WWE Divas", "WWE Diva", "Maryse", "Samantha", "Irwin WWE", "Irvin WWE", "Irvin AEW", "Irwin AEW", "Candice LeRae", "Nia Jax", "Naomi", "Bianca Belair", 
        "Charlotte", "Flair", "Trish", "Stratus", "MSEdge", "Izzi Dame", "Izzi WWE", "Dame WWE", "play boy", "Young Bucks", "Jackson", "NXT Women's", "AI appl", "NXT Woman", "Jessika Carr", "Carr WWE", "Jessica Carr", "Jessika Karr", "Karr WWE", "poses", 
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
        "myfreecams", "Samsung Internet", "Policy template", "Templates", "Policies", "onlifans", "camsoda", "strip", "bongacams", "livejasmin", "Shirai", "Io Sky", "Sky WWE", "Sky Wrestling", "Sky wrestle", "foot fury", "feet fury", "Bleis", "WWE woman", "WWE women", 
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
        "face generation model", "realistic face", "face technology", "3D morph face", "face AI animation", "real-time face swap", "AI-driven photo manipulation", "deepfake model creation", "digital persona", "All Elite", "Elite Wrestling", "video generat", "Windsor",
        "face overlay", "synthetic person", "facial blending", "virtual character face swap", "photorealistic face generator", "face altering AI", "realistic AI swap", "face expression morphing", "video gen", "hyperreal", "face projection", "synthetic face swap", "face model", 
        "virtual human face", "venice", "vanice", "venica", "venoise", "venise", "vanica", "n@ked", "onnly", "nekkid", "nudee", "nudy", "noodz", "neude", "nudesz", "HorizonMW", "f4nslie", "f@nsly", "fan5ly", "fan-sly", "deep nuud", "deepnud", "deapnude", "d33pnud3", "f@n", "0nly", 
        "0nlifans", "onlii", "onlifanz", "n4ked", "nakid", "nakd", "nakie", "s3x", "dreambooth", "secks", "seggs", "Dream booth", "seks", "Erase clothes", "AI uncloth", "Unclothing AI", "Gen AI pics", "text-to-undress", "text2nude", "remove outfit", "undress filter", "persona creation",
        "stripfilter", "clothing eraser", "nudify tool", "leak editor", "Realistic nude gen", "fleshify", "Skinify", "Alex Kaufman", "Lexi Kaufman", "Lexi Bliss", "Tenille Dashwood", "Saraya Knight", "Paige WWE", "!fy", "1fy", "lfy", "Biggers", "Celeste Bonin", "Ariane Andrew", 
        "Brianna Monique Garcia", "Stephanie Nicole Garcia", "deepany", "CJ Perry", "Lana Rusev", "Pamela Martinez", "Ashley Sebera", "Ayesha Raymond", "Marti Belle", "Alisha Edwards", "image2video", "safari", "Nicol", "Garcia", "Nikki Garcia", "Wrestling babe", "Divas hot", 
        "WWE sexy", "spicy site", "deep-any", "for fans", "VIP pic", "premium content", "sussy pic", "after dark", "NSFL", "artistic nude", "tasteful nude", "sus site", "La Leona", "uncensored version", "alt site", "runwayml", "runway", "run way", "runaway", "run away", "replicate.ai", 
        "huggingface", "hugging face", "cloth remover", "AI eraser", "Magic Editor", "magicstudio", "cleanup.pictures", "Trenesha", "app123", "modapk", "apkmod", "tool hub", "tools hub", "alaston", "alasti", "vaatteeton", "paljas", "seksikäs", "pimppi", "vittu", "tissit", "nänni", 
        "sukupuolielin", "paljain", "seksisivu", "alastomuus", "sus content", "fucking", "face +", "aikuissisältö", "aikuissivusto", "seksikuva", "homo", "ndue", "nakde", "lesbo", "transu", "pervo", "face fusion", "dick", "cock", "penis", "breast", "thigh", "leggings", "leggins", 
        "🍑", "🍆", "💦", "👅", "🔞", "😈", "👙", "🩲", "👠", "🧼", "🧽", "( . )( . )", "| |", "( o )( o )", "(!)", "bg remover", "jeans", "jerking", "jerks", "jerkmate", "jerk mate", "jerk off", "jerking off", "jack off", "jacking off", "imgtovid", "img2vid", "imagetovideo", "face+",
        "her butt", "herbutt", "butth", "butt hole", "assh", "ass h", "buttc", "butt c", "buttcheek", "butt cheek", "ladies", "vidu ai", "lady", "runway", "runaway", "run way", "run away", "cheek", "aasho", "ääsho", "ääshö", "face join", "Shira", "Blake Monroe", "replicate.ai", "fl3sh", 
        "poistamis", "vaatteidenpoistaminen", "vaatteiden poistaminen", "facemerg", "facefusi", "face merg", "face fusi", "face plus", "faceplus", "merge two faces", "merge 2 faces", "merging 2 faces", "merging two faces", "join face", "Monroe", "*4nk", "w4*k", "w4n*", "fleshi", 
        "join two faces", "join 2 faces", "join2faces", "jointwofaces", "fotor", "Toni WWE", "Tony Storm", "off the Sky", "off da skai", "Priscilla", "Kelly", "Erika", "Vikman", "pakara", "pakarat", "Viikman", "Eerika", "Rhaka", "orgasm", "0rgasm", "org@sm", "orga5m", "org@5m", 
        "Kamitani", "Katie", "Nikkita", "Nikkita Lyons", "Lisa Marie", "Lisa Marie Varon", "Lisa Varon", "Marie Varon", "Amanda Huber",
    ];

    const allowedWords = [
        /reddit/i, /OSRS/i, /RS/i, /RS3/i, /Old School/i, /RuneScape/i, /netflix/i, /pushpull/i, /facebook/i, /FB/i, /instagram/i, /Wiki/i, /pedia/i, /hikipedia/i, /fandom/i, /lehti/i, /tiktok/i, /bond/i, /bonds/i, /2007scape/i, /youtube/i, /ublock/i, 
        /wrestling/i, /wrestler/i, /tori/i, /tori\.fi/i, /www\.tori\.fi/i, /Kirpputori/i, /käytetty/i, /käytetyt/i, /käytettynä/i, /proshop/i, /hinta/i, /hintavertailu/i, /hintaopas/i, /sähkö/i, /pörssi/i, /sähkösopimus/i, /vatfall/i, /elenia/i, 
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
        /vaihdetaan/i, /vaihdan/i, /vaihto/i, /vaihtoi/i, /vaihtoi/i, /vaihdossa/i, /vaihtaa/i, /paa/i, /jakopää hihna/i, /jako hihna/i, /jako pää hihna/i, /jako päähihna/i, /\?/i, /\!/i, /opas/i, /ohje/i, /manuaali/i, /käyttö/i, /history/i, /historia/i, 
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
        /Carcinoma parvocellulare pancreatis cum/i, /Carcinoma parvocellulare pancreatis/i, /Carcinoma/i, /parvocellulare/i, /pancreatis/i, /metastasibus/i, /pulmonum/i, /pulmonum l. dx./i, /lymphnodi mediastini/i, /l. dx./i, /mediastini/i, /GPT-5.1/i,
        /metastasibus pulmonum l. dx. lymphnodi mediastini/i, /et retroperinonei renis sin/i, /retroperinonei renis sin/i, /renis sin/i, /retroperinonei renis sin/i, /retroperinonei sin/i, /black friday/i, /SmackDown/i, /OpenAI/i, /ChatGPT/i, /GPT-4o/i,
	/search/i, /GPT-5.4/i, /lookup/i, /findidfb/i, /fbid/i, /idfb/i, /techpowerup/i, /tech powerup/i, /tech/i, /hardware/i, /powerup/i, /wayback/i, /artifact/i, /dagonhai/i, /Dagon'hai/i, /Dagon´hai/i, /Dagon`hai/i, /Gemini/i, /Google Gemini/i,
    ];

    // === NEW: Firefox Only Allowed Words (Browser Promos) ===
    const firefoxAllowedWords = [
        /Chrome/i, /oletushakukone/i, /hakukone/i, /Lataa/i, /selaimessa Firefox/i, /Käytät Firefoxia/i, /toimii paremmin/i
    ];

    const allowedUrls = [
        "archive.org", "iltalehti.fi", "is.fi", "youtube.com", "www.wikipedia.org", "www.netflix.com", "netflix.com", "runescape.wiki", "github.com/paintdotnet", "www.getpaint.net", "oldschool.runescape.com", "runescape.com", "openai.com", "status.openai.com",
        "www.reddit.com", "old.reddit.com", "new.reddit.com", "spotify.com", "www.thesmackdownhotel.com", "thesmackdownhotel.com", "wwe.com", "amd.com", "nvidia.com", "intel.com", "www.techpowerup.com", "chatgpt.com", "github.com/copilot", "gemini.google.com",
	"www.jimms.fi", "www.verkkokauppa.com", "www.motonet.fi", "datatronic.fi", "www.datatronic.fi", "multitronic.fi", "www.multitronic.fi", "www.proshop.fi", "tori.fi", "www.tori.fi", "hintaopas.fi", "www.yliopistonapteekki.fi", "www.yliopistonapteekki.fi", 
	"techpowerup.com", "findidfb.com", "lookup-id.com", "web.archive.org", "wayback.archive.org", "gemini.google.com/app",
    ];

    const urlPatternsToHide = [
        /github\.com\/best-deepnude-ai-apps/i,
        /github\.com\/AI-Reviewed\/tools\/blob\/main\/Nude%20AI%20:%205%20Best%20AI%20Nude%20Generators%20-%20AIReviewed\.md/i,
        /github\.com\/nudify-ai/i,
        /github\.com\/BrowserWorks/i,
        /github\.com\/comfyanonymous/i,
        /github\.com\/Top-AI-Apps/i,
        /github\.com\/Anthropic/i,
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
        /folio\.procreate\./i,
        /procreate\./i,
        /folio\.procreate\.com\/deepnude-ai/i,
        /support\.microsoft\.com\/fi-fi\/microsoft-edge/i,
        /apps\.microsoft\.com\/detail\/xpdbz4mprknn30/i,
        /apps\.microsoft\.com\/detail\/xp8cf6s8g2d5t6/i,
        /apps\.microsoft\.com\/detail\/xpfftq037jwmhs/i,
        /apps\.microsoft\.com\/detail\/9nzvdkpmr9rd/i,
        /apps\.microsoft\.com\/detail\/9nrtvfllggtv/i,
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
        /porn\./i,
        /.\porn/i,
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
        /pinterest\.com/i,
        /irc-galleria\.fi/i,
        /irc-galleria\.net/i,
        /irc-galleria\./i,
        /lite\.irc-galleria\./i,
        /irc-galleria\.fi/i,
        /irc\.fi/i,
	/commentpicker\.com/i,
        /smallseotools\.com/i,
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
        /vidu\./i,
        /vidyu\./i,
        /viduy\./i,
        /videy\./i,
        /vidio\./i,
        /vsco\./i,
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
        /nude\./i,
        /naked\./i,
        /photopea\./i,
        /123rf\./i,
        /virtualbox\./i,
        /oracle\./i,
        /play.google./i,
        /formulae\./i,
        /rem\./i,
        /remove\./i,
        /remover\./i,
        /removing\./i,
        /arxiv\./i,
        /osboxes\./i,
        /vmware\./i,
        /face25\./i,
        /face26\./i,
        /anthropic\./i,
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
        /grok\./i,
        /grokai\./i,
        /grok-ai\./i,
        /yahoo\./i,
        /pict-tools\./i,
        /picttools\./i,
        /phototools\./i,
        /photools\./i,
        /photo-tools\./i,
        /picture-tools\./i,
        /picturetools\./i,
        /workintool\./i,
        /sports\.yahoo\./i,
        /workintools\./i,
        /workin-tool\./i,
        /workin-tools\./i,
        /workingtool\./i,
        /workingtools\./i,
        /working-tool\./i,
        /working-tools\./i,
        /videoaihug\./i,
        /aihugvideo\./i,
        /fotor\./i,
        /imyfone\./i,
        /aihug\./i,
        /hugai\./i,
        /ai-hug\./i,
        /hug-ai\./i,
        /aihugging\./i,
        /huggingai\./i,
        /ai-hugging\./i,
        /hugging-ai\./i,
        /ai-videogenerator\./i,
        /aivideogenerator\./i,
        /videogeneratorai\./i,
        /videogenerator-ai\./i,
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
        /ai‑directories\./i,
        /aidirectories\./i,
        /ai‑directory\./i,
        /aidirectory\./i,
        /ai‑directorys\./i,
        /aidirectorys\./i,
        /aitoolsdirectory\./i,
        /aitoolsdirectory\./i,
        /aidirectory\./i, 
        /onlineaidirectory\./i, 
        /aidirectoryonline\./i, 
        /online-aidirectory\./i, 
        /aidirectory-online\./i, 
        /onlineaidirectorys\./i, 
        /aidirectorysonline\./i, 
        /online-aidirectorys\./i, 
        /aidirectorys-online\./i, 
        /ai-directory\./i,
        /assistingintelligence\./i,
        /assisting-intelligence\./i,
        /intelligenceassisting\./i,
        /intelligence-assisting\./i,
        /assistintelligence\./i,
        /assist-intelligence\./i,
        /intelligenceassist\./i,
        /intelligence-assist\./i,
        /aidirectorylist\./i,
        /aiagentsdirectory\./i,
        /aiagentsdirectory\./i,
        /aiphoto\./i,
        /ai-photo\./i,
        /photoai\./i,
        /photo-ai\./i,
        /aiphotohq\./i,
        /ai-photohq\./i,
        /aiphoto-hq\./i,
        /ai-photo-hq\./i,
        /axis-intelligence\.com/i,
        /letsview\.com/i,
        /trendhunter\./i,
        /trendhunt\./i,
        /trend-hunter\./i,
        /trend-hunt\./i,
        /dev\./i,
        /feishu\.cn/i,
        /n8ked\./i,
        /imgur\.com.*nude/i,
        /imgur\.com.*deepn/i,
        /AlexaBliss/i,
        /DuaLipa/i,
        /Dua_Lipa/i,
        /threads\./i,
        /instagram\./i,
        /justaistuff\./i,
        /aistuff\./i,
        /claude\./i,
        /browsing\./i,
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
        /stablediffusionapi\./i,
        /huggingface\./i,
        /hugging-face\./i,
        /huntscreen\./i,
        /huntscreens\./i,
        /hunt-screen\./i,
        /hunt-screens\./i,
        /screenhunt\./i,
        /screenshunt\./i,
        /screen-hunt\./i,
        /screens-hunt\./i,
        /trendingaitool\./i,
        /trendingaitools\./i,
        /toolsfine\./i,
        /toolfine\./i,
        /tools-fine\./i,
        /tool-fine\./i,
        /finetools\./i,
        /finetool\./i,
        /fine-tools\./i,
        /fine-tool\./i,
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
        /aichef\./i,
        /ai-chef\./i,
        /chefai\./i,
        /chef-ai\./i,
        /aichief\./i,
        /ai-chief\./i,
        /chiefai\./i,
        /chief-ai\./i,
        /noxillo\./i,
        /vadoo\./i,
        /vidnoz\./i,
        /theresanaiforthat\./i,
        /futuretools\./i,
        /future-tools\./i,
        /futurepedia\./i,
        /future-pedia\./i,
        /aitooldirectory\./i,
        /aitoolsforme\./i,
        /aixploria\./i,  
        /topai\./i, 
        /top-ai\./i,
        /aitop\./i, 
        /ai-top\./i,
        /toolify\./i,  
        /allaitool\./i,  
        /toolsaiapp\./i,  
        /aitoolhunt\./i,  
        /openfuture\./i,  
        /seofai\./i,   
        /alltheaitools\./i,  
        /aitools\./i,   
        /aitoptools\./i,  
        /allthingsai\./i,  
        /aidir\./i, 
        /wegocup\./i,
        /modcombo\./i,
        /monica\./i,
        /aimonica\./i,
        /ai-monica\./i,
        /monicaai\./i,
        /monica-ai\./i,
        /monicai\./i,
        /monic-ai\./i,
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
        /reddit\.com\/r\/MachineLearning/i,
        /reddit\.com\/r\/Grok/i,
        /solo\./i,
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
        /coinmarketcap\./i,
        /imageresizer\./i,
        /image-resizer\./i,
        /imageresize\./i,
        /image-resize\./i,
        /photoresizer\./i,
        /photo-resizer\./i,
        /photoresize\./i,
        /photo-resize\./i,
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
        /saashub\./i,
        /undress\./i,
        /twitter\.com/i,
        /x\.com/i,
    ];

    const blockedImageURLs = [
        /reddit\.com\/r\/SquaredCircle/i,
        /reddit\.com\/r\/SCJerk/i,
        /reddit\.com\/r\/AlexaBliss/i,
        /reddit\.com\/r\/AlexaBlissWorship/i,
        /redgifs\.com\//i,
        /tiktok\.com/i,
        /AlexaBliss/i,
        /DuaLipa/i,
        /Dua_Lipa/i,
        /threads\./i,
        /instagram\.com/i,
        /lite\.irc-galleria\./i,
        /irc-galleria\.fi/i,
        /irc-galleria\.net/i,
        /irc-galleria\./i,
        /irc\.fi/i,
        /brazzers/i,
        /brazzer/i,
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
        /HeyGen\./i,
        /GenHey\./i,
        /Hey-Gen\./i,
        /Gen-Hey\./i,
        /apkpure\./i,
        /apk-pure\./i,
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
        /porn\./i,
        /.\porn/i,
        /softorbits\./i,
        /softorbit\./i,
        /soft-orbits\./i,
        /soft-orbit\./i,
        /nightcafe\./i,
        /kuvake\./i,
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
        /stablediffusionapi\./i,
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
        /coinmarketcap\./i,
        /imageresizer\./i,
        /image-resizer\./i,
        /imageresize\./i,
        /image-resize\./i,
        /photoresizer\./i,
        /photo-resizer\./i,
        /photoresize\./i,
        /photo-resize\./i,
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
        /saashub\./i,
        /undress\./i,
        /twitter\.com/i,
        /x\.com/i,
        /huggingface\./i,
        /hugging-face\./i,
        /tenor\./i,
        /tenor\.com/i,
        /torproject\.org/i,
        /tor\.app/i,
        /mozilla\.org/i,
        /mozilla\.fi/i,
        /cloudbooklet\./i,
        /cyberlink\./i,
        /undressapp\./i,
        /undress-app\./i,
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
        /pwpix\./i,
        /pwpix\.net/i,
        /noxillo\./i,
        /vadoo\./i,
        /vidnoz\./i,
        /reddit\.com\/r\/photoshop/i,
        /reddit\.com\/r\/StableDiffusion/i,
        /reddit\.com\/r\/Grok/i,
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
        /reddit\.com\/r\/AlexaBlissWorship/i,
        /face25\./i,
        /face26\./i,
        /anthropic\./i,
    ];

    const protectedSelectors = [
        '#APjFqb', '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.SDkEP > div.a4bIc',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.fM33ce.dRYYxd',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > button',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div.M8H8pb',
        '#tsf > div:nth-child(1) > div.A8SBwf > div.RNNXgb',
        '#_gPKbZ730HOzVwPAP7pnh0QE_3', '#tsf > div:nth-child(1) > div.A8SBwf',
        '#tsf > div:nth-child(1) > div:nth-child(2)', '#tsf > div:nth-child(1) > script',
        '#tsf > div:nth-child(1)', '#tophf', '#tsf',
        '#hdtb-msb', '#hdtb', '#top_nav', '#slim_appbar', '.MUFPAc', '.hdtb-mitem', '#botabar', '.crJ18e', '.T3mIbg',
        '.EDblX.JpOecb' // Prevent nav bar from being swept
    ];

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
        const lowerUrl = url.toLowerCase();
        for (let i = 0; i < allowedUrls.length; ++i) {
            const safeDomain = allowedUrls[i].toLowerCase().replace(/^www\./, '');
            if (lowerUrl.includes(safeDomain)) return true;
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
        let testUrl = url;
        try {
            if (url.startsWith('http')) testUrl = url.replace(/#imgrc=[^\s]*/g, '');
        } catch(e) {}
        for (let i = 0; i < blockedImageURLs.length; ++i) {
            if (blockedImageURLs[i].test(testUrl)) return true;
        }
        return false;
    }

    function isProtectedElement(element) {
        return protectedSelectors.some(selector => element.matches && element.matches(selector));
    }

    // Record details of the last forbidden match for better debugging
    function recordMatchDetail(kind, value, inText) {
        lastMatchDetails = {
            kind,                          // 'regex' | 'special' | 'string' | 'ai-boundary'
            value: String(value || ''),
            snippet: String(inText || '').substring(0, 200),
            when: new Date().toISOString()
        };
        devLog('FORBIDDEN ' + kind.toUpperCase() + ' MATCH:', value, 'in:', lastMatchDetails.snippet);
    }

    // === BASE KEYWORD CHECKER (NO AI BOUNDARY) ===
    function containsForbiddenKeywordsBase(text) {
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

    // === AI-BOUNDARY FUNCTION (USED FOR QUERIES ETC.) ===
    function containsAiBoundary(text) {
        if (!text) return false;

        function escapeRegExp(s) {
            if (typeof s !== 'string') s = String(s);
            return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

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
            /shap/i, /shape/i, /shapes/i, /shapeing/i, /shaping/i, /POS/i, /position/i, /adjust/i, /change/i, /replaces/i, /replacing/i, /replacement/i, /replac/i, /replace/i,
            /adjustment/i,/adjusted/i, /adjustin/i, /adjusting/i, /change/i, /changes/i, /changin/i, /changing/i, /mod/i, /modify/i, /modif/i, /modification/i, /mods/i, /mode/i,
            /modifyin/i, /modifying/i, /tweak/i, /tweakin/i, /tweaking/i, /back/i, /front/i, /legging/i, /leggings/i, /cloth/i, /clothy/i, /clothes/i, /clothing/i, /clothying/i,
            /\bAI\b/i, /page/i, /pages/i, /site/i, /mango/i, /mangos/i, /mangoing/i, /icegirl/i, /wank/i, /jerk/i, /icegirls/i, /ismartta/i, /ismart/i, /ismartt/i, /gasm/i, /org/i,
            /\bIA\b/i, /stuffed/i, /stuffing/i, /around/i, /off/i, /spin/i, /spins/i, /spun/i, /spinned/i, /spinning/i, /online/i, /on-line/i, /machinelearn/i,
            /-/i, /=/i, /\+/i, /_/i, 
        ];

        const finnishWordsList = [
	//finnish names list:
            /nen/i, /lampi/i, /lehti/i, /mäki/i, /maki/i, /lahti/i, /järvi/i, /jarvi/i, /koski/i, /kallio/i, /niemi/i, /aho/i, /aho/i, /salo/i, /kari/i, /oja/i, /pelto/i, /luoto/i, 
            /saari/i, /ranta/i, /virta/i, /keto/i, /vaara/i, /lä/i, /la/i, /maa/i,  /kosken/i, /pää/i, /paa/i, /mäen/i, /mae/i, /sivu/i, /vieri/i, /kaarto/i, /kaarre/i, /aito/i, /aira/i, 
            /man/i, /hauki/i, /rauma/i, /liite/i, /laine/i, /salmi/i, /harju/i, /kangas/i, /vuori/i, /korpi/i, /suo/i, /tal[oö]/i, /nius/i, /kuiva/i, /timo/i, /olli/i, /nyman/i, /nylund/i, 
            /nygard/i, /aine/i, /nygård/i, /raunio/i, /mies/i, /nainen/i, /aitto/i, /jylhä/i, /anoai/i, /aitto/i, /aino/i, /kaija/i, /anneli/i, 

	//Finnish words list
            /aika/i, /aino/i, /aikuinen/i, /saippua/i, /aisti/i, /aivo/i, /tilaisuus/i, /aikuiskoulutus/i, /paikka/i, /saippua/i, /aivast/i,
            /hais/i, /mais/i, /kais/i, /tais/i, /raiska/i, /raippa/i, /pais/i, /alainen/i, /koululainen/i, /Kuinka/i, /Miten/i, /avain/i,
            /Miksi/i, /Milloin/i, /Milloin/i, /Miksei/i, /aita/i, /aidan/i, /maailma/i, /avoin/i, /avaim/i, /dagonhai/i, /Dagon'hai/i, /Dagon´hai/i, /Dagon`hai/i,
            /maanantai/i, /tiistai/i, /torstai/i, /perjantai/i, /lauantai/i, /sunnuntai/i, 
        ];

        function isFinnishLike(word) {
            const w = word.toLowerCase();
            return finnishWordsList.some(rx => rx.test(w));
        }

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
            if (!tok || tok.length < 1) continue;

            if (/^AI[\.,!?]?$/.test(tok)) {
                return 'AI';
            }

            if (tok.length < 2) continue;

            const originalIsFinnish = isFinnishLike(tok);

            const hasAIAtStart = /^ai[-_]?/i.test(tok);
            const hasAIAtEnd   = /[-_]?ai$/i.test(tok);
    
            if (originalIsFinnish) {
                continue;
            }

            if (hasAIAtStart || hasAIAtEnd) {
                let root = tok;
                if (hasAIAtStart) root = root.replace(/^ai[-_]?/i, '');
                if (hasAIAtEnd) root = root.replace(/[-_]?ai$/i, '');

                if (!root) return 'AI';

                for (let r of AIRegexes) {
                    try {
                        if (r.test(root)) return 'AI';
                    } catch (e) {}
                }
            }

            if (!hasAIAtStart && !hasAIAtEnd) {
                continue;
            }

            let root2 = tok;
            if (hasAIAtStart) root2 = root2.replace(/^ai[-_]?/i, '');
            if (hasAIAtEnd)   root2 = root2.replace(/[-_]?ai$/i, '');
            if (!root2) return 'AI';

            const rootIsFinnish = isFinnishLike(root2);

            if (rootIsFinnish && (hasAIAtStart || hasAIAtEnd)) return 'AI';
            if (originalIsFinnish && !rootIsFinnish) continue;
            if (!rootIsFinnish && (hasAIAtStart || hasAIAtEnd)) return 'AI';
        }
        return false;
    }

    // === UNIFIED HIERARCHY CHECKER ===
    // 1. Banned Terms (Highest) -> 2. Allowed URLs -> 3. Banned URLs/TLDs -> 4. Allowed Words -> 5. Banned URL string
    function shouldRemoveElement(url, text, isImage = false) {
        
        // 1. Banned Terms (Absolute Highest Priority)
        if (containsForbiddenKeywordsBase(text)) return true;

        let queryParamForbidden = false;
        try {
            if (url) {
                const u = new URL(url, window.location.origin);
                const qParam = u.searchParams.get('q');
                if (qParam && containsForbiddenKeywordsBase(qParam)) {
                    queryParamForbidden = true;
                }
            }
        } catch(e) {}
        if (queryParamForbidden) return true;

        // 2. Allowed URLs (Shields against Banned URLs/TLDs and Allowed Words)
        if (isUrlAllowed(url)) return false;

        // 3. Banned URLs & TLDs
        if (matchesBlockedUrlPattern(url) || isBannedTLD(url)) return true;
        if (isImage && matchesBlockedImagePattern(url)) return true;

        // 4. Allowed Words (Weak Shield)
        if (containsAllowedWords(text) || containsAllowedWords(url)) return false;

        // 5. Banned URL string fallback
        if (containsForbiddenKeywordsBase(url)) return true;

        return false;
    }

    // === AI-AWARE FORBIDDEN CHECKER (used for queries, forms, etc.) ===
    function containsForbiddenKeywords(text) {
        if (!text) return false;
        devLog('containsForbiddenKeywords called with:', JSON.stringify(String(text)));

        const aiHit = containsAiBoundary(text);
        if (aiHit) {
            recordMatchDetail('ai-boundary', aiHit, text);
            return aiHit;
        }
        return containsForbiddenKeywordsBase(text);
    }

    if (typeof window !== 'undefined') {
        window.containsAiBoundary = containsAiBoundary;
        window.containsForbiddenKeywords = containsForbiddenKeywords;
        window.GoogleJS = window.GoogleJS || {};
        window.GoogleJS.getLastRedirectInfo = () => lastRedirectInfo || readPersistedRedirect();
    }

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

    function getSuggestionSelectors() {
        const base = [
            '#fprsl', '#fprs', '#oFNiHe', '.QRYxYe', '.NNMgCf', '.spell_orig', '.gL9Hy', '#bres', 'div.y6Uyqe',
            'span.gL9Hy', 'a.spell', 'p.spell_orig', '.KDCVqf', '.card-section.p64x9c', 
        ];
        if (isFirefoxAndroid) {
            return base;
        }
        return base;
    }

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

    function isInsideImagePreviewOrHidden(node) {
        try {
            if (!node || !node.closest) return false;
            if (node.closest('[data-googlejs-hidden="1"]')) return true;
            if (isNodeClicked(node)) return true;
            if (node.closest('#Sva75c, #islsp, .tvh9oe, .OUZ5W, .p7rlpe, .nQvPN, .AnpO2b, .gx72we, .VKHL9c, .kC8B4e, c-wiz[data-region="main"], div[role="region"][aria-label], c-wiz[data-rp]')) return true;
            if (node.closest('.isv-r.ia-active, .isv-r[aria-expanded="true"], .isv-r[data-focused="true"], .isv-r.VmSmrc, .isv-r.B0pnze')) return true;

            if (node.nodeType === 1 && node.offsetWidth === 0 && node.offsetHeight === 0) return true;
        } catch(e) {}
        return false;
    }

    function doRedirect(triggerContext, triggerTerm) {
        if (isRedirecting) return;
        logRedirect(triggerContext, triggerTerm);
        isRedirecting = true;
        try { if (domObserver) domObserver.disconnect(); } catch (e) {}
        if (ffAndroidScanInterval) {
            try { clearInterval(ffAndroidScanInterval); } catch (e) {}
            ffAndroidScanInterval = null;
        }
        
        if (!isFirefoxAndroid) {
            try { window.stop && window.stop(); } catch (e) {}
        }
        
        try {
            document.documentElement.style.background = '#fff';
            document.body && (document.body.style.background = '#fff');
        } catch (e) {}
        
        if (isFirefoxAndroid) {
            try {
                let meta = document.createElement('meta');
                meta.httpEquiv = "refresh";
                meta.content = "0;url=https://www.google.com";
                document.documentElement.appendChild(meta);
            } catch(e) {}
            
            setTimeout(() => {
                try { window.location.replace('https://www.google.com'); } catch (e) {}
                try { window.location.href = 'https://www.google.com'; } catch (e) {}
            }, 10);
        } else {
            try { window.location.replace('https://www.google.com'); } catch (e) { window.location.href = 'https://www.google.com'; }
        }
    }

    function preflightRedirectIfBanned() {
        const currentHostname = window.location.hostname;
        const googleDomainPattern = /^([a-z0-9-]+\.)*google\.[a-z]+(\.[a-z]+)?$/i;
        if (!googleDomainPattern.test(currentHostname)) return false;

        const searchParams = new URLSearchParams(window.location.search);
        const query = searchParams.get('q') || '';

        const forbiddenMatch = containsForbiddenKeywords(query);
        if (forbiddenMatch && !isUrlAllowed(window.location.href)) {
            doRedirect('preflight', forbiddenMatch);
            return true;
        }
        return false;
    }

    if (preflightRedirectIfBanned()) return;

function cleanGoogleUrl() {
    if (isFirefox) return; 
    if (isGoogleImageSearch()) return; 

    // 1. Bulletproof Gemini Abort
    if (window.location.hostname.includes('gemini')) return;

    // 2. Only run cleaning logic if we are actually on a search results page
    // This targets /search, /search/fincore, etc., while ignoring /app or /
    if (!window.location.pathname.includes('/search')) return;
        
        const keepParams = [
            "q", "tbm", "tbs", "hl", "safe", "biw", "bih", "dpr", "ijn", "ei", "start", "source", "rlz", "oq", "gs_l", "sxsrf",
            "imgrc", "imgdii", "imgurl", "imgrefurl", "prev", "usg", "bvm", "psig", "ust", "chips", "asearch", "udm",
            "uact", "pbx", "sclient", "aqs", "gs_ivs", "iflsig", "ictx", "app", "gemini",
        ];
           try {
        const url = new URL(window.location.href);
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
            }
        }
    } catch (e) {}
}

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

    function isPromoBannerText(txt) {
        const promoPhrases = [
            /Lataa Chrome/i, /toimii paremmin/i, /Käytät Firefoxia/i, /oletushakukone/i, 
            /Switch to Chrome/i, /Tee Googlesta/i, /Kokeile Chromea/i, /Google suosittelee/i,
            /parempi selain/i, /Chrome on nopeampi/i, /Siirry Chromeen/i, /nopeampi kuin Firefox/i
        ];
        return promoPhrases.some(p => p.test(txt));
    }

    function isPromoBannerNode(node) {
        if (!node) return false;
        let txt = node.textContent || '';
        if (txt.length < 30 && node.parentElement) {
            txt = node.parentElement.textContent || '';
        }
        if (txt.length < 50 && node.parentElement && node.parentElement.parentElement) {
            txt = node.parentElement.parentElement.textContent || '';
        }
        return isPromoBannerText(txt);
    }

    function removePromoBanners() {
        const elements = document.querySelectorAll('div[role="alert"], div[role="dialog"], .dbsFrd, .gws-promo-pushdown');
        elements.forEach(el => {
            if (isProtectedElement(el)) return;
            const txt = el.textContent || '';
            if (txt.length < 400 && isPromoBannerText(txt)) {
                el.remove();
            }
        });
        
        const cwizElements = document.querySelectorAll('c-wiz');
        cwizElements.forEach(el => {
            if (isProtectedElement(el)) return;
            if (el.querySelector('#hdtb, #hdtb-msb, #top_nav, form[action="/search"]')) return;
            
            const txt = el.textContent || '';
            if (txt.length < 150 && isPromoBannerText(txt)) {
                el.remove();
            }
        });
    }

function swapSearchTabs() {
        if (isRedirecting) return;
        try {
            if (isFirefoxAndroid) {
                // ANDROID FIREFOX LOGIC: Physically swap the tabs and rename 'Kaikki'
                let kaikkiSpan = null;
                let verkkoSpan = null;

                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while ((node = walker.nextNode())) {
                    const txt = node.nodeValue.trim();
                    const parent = node.parentElement;
                    if (!parent || parent.hasAttribute('data-swapped-android')) continue;
                    
                    if (!parent.closest('#hdtb, div[role="list"], .EDblX, .crJ18e, .T3mIbg, header, nav')) continue;

                    if (txt === 'Kaikki') kaikkiSpan = parent;
                    else if (txt === 'Verkkohaku') verkkoSpan = parent;
                }

                if (kaikkiSpan && verkkoSpan) {
                    const getTabNode = (el) => el.closest('div[role="listitem"]') || el.closest('a') || el;
                    const kaikkiTab = getTabNode(kaikkiSpan);
                    const verkkoTab = getTabNode(verkkoSpan);

                    if (kaikkiTab && verkkoTab && kaikkiTab !== verkkoTab) {
                        const parentK = kaikkiTab.parentNode;
                        const parentV = verkkoTab.parentNode;
                        
                        // Physically swap the actual elements in the DOM if they share the same wrapper
                        if (parentK && parentV && parentK === parentV) {
                            const temp = document.createElement('div');
                            parentK.insertBefore(temp, kaikkiTab);
                            parentK.insertBefore(kaikkiTab, verkkoTab);
                            parentK.insertBefore(verkkoTab, temp);
                            temp.remove();
                        }

                        // Rename the text now that they are swapped
                        kaikkiSpan.textContent = 'Virikkeinen haku';

                        kaikkiSpan.setAttribute('data-swapped-android', '1');
                        verkkoSpan.setAttribute('data-swapped-android', '1');
                    }
                }

                // Fallback for other tab text elements
                document.querySelectorAll('[data-target-text]').forEach(tab => {
                    const targetText = tab.getAttribute('data-target-text');
                    const span = tab.querySelector('span.R1QWuf') || tab.querySelector('div.mXwfNd span') || Array.from(tab.querySelectorAll('*')).find(n => n.childNodes.length === 1 && n.firstChild.nodeType === 3);
                    
                    if (span && span.textContent.trim() === 'Kaikki') {
                        span.textContent = 'Virikkeinen haku';
                    } else if (!span && tab.textContent.trim() === 'Kaikki') {
                        tab.textContent = 'Virikkeinen haku';
                    }
                });

            } else {
                // EXACT PC LOGIC FROM BASE FILE
                const kaikkiSpan = Array.from(document.querySelectorAll('span.R1QWuf:not([data-swapped])')).find(el => el.textContent.trim() === 'Kaikki');
                const verkkoSpan = Array.from(document.querySelectorAll('span.R1QWuf:not([data-swapped])')).find(el => el.textContent.trim() === 'Verkkohaku');

                if (kaikkiSpan && verkkoSpan) {
                    const getTabNode = (span) => span.closest('div[role="listitem"]') || span.closest('a') || span.closest('div[jsname="xBNgKe"]');
                    
                    const kaikkiTab = getTabNode(kaikkiSpan);
                    const verkkoTab = getTabNode(verkkoSpan);

                    if (kaikkiTab && verkkoTab && kaikkiTab !== verkkoTab) {
                        const temp = document.createElement('div');
                        kaikkiTab.parentNode.insertBefore(temp, kaikkiTab);
                        verkkoTab.parentNode.insertBefore(kaikkiTab, verkkoTab);
                        temp.parentNode.insertBefore(verkkoTab, temp);
                        temp.remove();

                        verkkoSpan.textContent = 'Verkkohaku';
                        kaikkiSpan.textContent = 'Virikkeinen haku';

                        kaikkiSpan.setAttribute('data-swapped', '1');
                        verkkoSpan.setAttribute('data-swapped', '1');
                    }
                }
            }
        } catch(e) {}
    }

    function blockUrls() {
        if (isRedirecting) return;
        const isImageSearch = isGoogleImageSearch();
        
        try {
            const links = document.getElementsByTagName("a");
            for (let i = 0; i < links.length; ++i) {
                const link = links[i];
                if (!link.href || link.href.startsWith('data:')) continue;
                if (isNodeClicked(link)) continue;
                if (!overlayRemoved && isWithinSuggestionNode(link)) continue;

                if (!isUrlAllowed(link.href) && !isFirefox && !isImageSearch) {
                    try {
                        const urlObj = new URL(link.href, location.origin);
                        if (urlObj.pathname.includes('/search')) {
                            const keepParams = ["q", "tbm", "tbs", "hl", "safe", "biw", "bih", "dpr", "ijn", "ei", "start", "source", "rlz", "oq", "gs_l", "sxsrf", "imgrc", "imgdii", "imgurl", "imgrefurl", "prev", "usg", "bvm", "psig", "ust", "chips", "asearch", "udm", "uact", "pbx", "sclient", "aqs", "gs_ivs", "iflsig", "ictx"];
                            let changed = false;
                            const paramsArray = Array.from(urlObj.searchParams.keys());
                            for (let j = 0; j < paramsArray.length; ++j) {
                                if (!keepParams.includes(paramsArray[j])) {
                                    urlObj.searchParams.delete(paramsArray[j]);
                                    changed = true;
                                }
                            }
                            if (changed) {
                                link.href = urlObj.origin + urlObj.pathname + (urlObj.searchParams.toString() ? '?' + urlObj.searchParams.toString() : '');
                            }
                        }
                    } catch (e) {}
                }

                const linkText = ((link.innerText || link.textContent || '') + ' ' + (link.getAttribute('aria-label') || '') + ' ' + (link.title || '')).toLowerCase();
                const cacheKey = linkText.length + ':' + link.href;
                if (link.getAttribute('data-gj-cache') === cacheKey) continue;

                if (shouldRemoveElement(link.href, linkText, false)) {
                    let parent = link;
                    let levels = 0;
                    while (parent && levels < 15) { 
                        if (!parent.parentElement || parent === document.body || parent.id === "search" || parent.id === "Sva75c" || parent.tagName === "MAIN") break;
                        
                        if (parent.getAttribute('role') === 'listitem' && parent.closest('.JpOecb')) {
                            hideElementSafely(parent);
                            parent.remove();
                            break;
                        }

                        if (
                            parent.classList.contains('X4T0U') ||
                            parent.classList.contains('sHEJob') ||
                            parent.classList.contains('ObbMBf') ||
                            parent.classList.contains('isv-r') ||
                            parent.classList.contains('eA0Zlc') ||
                            parent.classList.contains('vNFaUb') ||
                            parent.classList.contains('XRVJtc') ||
                            parent.classList.contains('b2Rnsc') ||
                            parent.classList.contains('k8X5ve') ||
                            (parent.classList.contains('EDblX') && !parent.classList.contains('JpOecb')) ||
                            parent.classList.contains('PmEWq') || 
                            parent.classList.contains('Ww4FFb') || 
                            parent.classList.contains('vt6azd') || 
                            parent.classList.contains('wHYlTd') || 
                            parent.classList.contains('GKS7s') || 
                            parent.classList.contains('vtSz8d') || 
                            parent.classList.contains('QpPSMb') || 
                            parent.classList.contains('kJSB8')  || 
                            parent.classList.contains('e8Ck0d') || 
                            parent.classList.contains('mW90w')  ||
                            parent.classList.contains('vCUuC')  || 
                            parent.classList.contains('p7bv')   || 
                            parent.classList.contains('kwICDb') || 
                            parent.classList.contains('oYLlHe') ||
                            parent.classList.contains('m3LIae') || 
                            parent.classList.contains('ddkIM')     
                        ) {
                            hideElementSafely(parent);
                            parent.remove();
                            break;
                        }
                        parent = parent.parentElement; levels++;
                    }
                    hideElementSafely(link);
                    link.remove();
                } else {
                    link.setAttribute('data-gj-cache', cacheKey);
                }
            }
        } catch (e) {}
    }

    function blockResults() {
        if (isRedirecting) return;
        try {
            const results = document.querySelectorAll('div.g, div.srg > div, div.v7W49e, div.mnr-c, div.Ww4FFb, div.yuRUbf, .wQiwMc.related-question-pair, .XRVJtc, .b2Rnsc, .sHEJob, .vNFaUb, .EDblX:not(.JpOecb), .k8X5ve, .PmEWq, .vt6azd, .wHYlTd, div.vtSz8d, div.QpPSMb, div.kJSB8, div.e8Ck0d, div.mW90w, div.vCUuC, div.p7bv, div.kwICDb, div.oYLlHe, div.m3LIae, a.ddkIM');
            for (let i = 0; i < results.length; ++i) {
                const result = results[i];
                if (isNodeClicked(result)) continue;
                if (!overlayRemoved && isWithinSuggestionNode(result)) continue;

                let resultText = (result.innerText || result.textContent || '');
                const hiddenNodes = result.querySelectorAll('[aria-label], [title], .PZPZlf');
                for (let j = 0; j < hiddenNodes.length; j++) {
                    resultText += ' ' + (hiddenNodes[j].getAttribute('aria-label') || '') + ' ' + (hiddenNodes[j].title || '') + ' ' + (hiddenNodes[j].innerText || '');
                }
                resultText = resultText.toLowerCase();

                // Advanced link selector to ensure whitelist check gets the MAIN url
                const link = result.querySelector('a[jsname="UWckNb"], h3 a, a:has(h3), .yuRUbf a') || result.querySelector('a');
                const resultUrl = link && !link.href.startsWith('data:') ? link.href : '';
                
                const cacheKey = resultText.length + ':' + resultUrl;
                if (result.getAttribute('data-gj-cache') === cacheKey) continue;

                if (shouldRemoveElement(resultUrl, resultText, false)) {
                    hideElementSafely(result);
                    result.remove();
                } else {
                    result.setAttribute('data-gj-cache', cacheKey);
                }
            }
        } catch (e) {}
    }

    function blockElementsBySelectors() {
        if (isRedirecting) return;
        try {
            const selectorsToHide = [
                'span.gL9Hy', '.spell_orig', '.KDCVqf.card-section.p64x9c', '#oFNiHe', '#taw',
                '.QRYxYe', '.NNMgCf', '#bres > div.ULSxyf', 'div.ULSxyf', '#bres', 
                'div[role="listitem"]:has(a[href*="udm=39"])',
                'div[role="listitem"]:has(a[href*="udm=50"])'
            ];
            selectorsToHide.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (!isProtectedElement(element)) {
                        const txt = element.textContent || '';
                        if (element.getAttribute('data-gj-cache') === String(txt.length)) return;

                        if (!containsAllowedWords(txt)) {
                            hideElementSafely(element);
                        } else {
                            element.setAttribute('data-gj-cache', String(txt.length));
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
                if (element.getAttribute('data-gj-cache') === String(textContent.length)) return;

                if (phrasesToHide.some(phrase => phrase.test(textContent)) && !containsAllowedWords(textContent)) {
                    hideElementSafely(element);
                } else {
                    element.setAttribute('data-gj-cache', String(textContent.length));
                }
            });
        } catch (e) {}
    }

    function hasForbiddenSuggestionText() {
        const suggestionSelectors = getSuggestionSelectors();
        for (let s = 0; s < suggestionSelectors.length; ++s) {
            const elements = document.querySelectorAll(suggestionSelectors[s]);
            for (let i = 0; i < elements.length; ++i) {
                if (isPromoBannerNode(elements[i])) continue;
                const txt = elements[i].textContent || '';
                if (containsAllowedWords(txt)) continue;
                if (containsForbiddenKeywordsBase(txt)) return true;
            }
        }
        return false;
    }

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
                if (isPromoBannerNode(nodes[i])) continue; 
                const txt = nodes[i].textContent || '';
                if (!txt) continue;
                if (containsAllowedWords(txt)) continue;

                const hasForbidden = containsForbiddenKeywordsBase(txt);
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
        const selectors = getSuggestionSelectors();
        let redirected = false;
        for (let s = 0; s < selectors.length; ++s) {
            const elements = document.querySelectorAll(selectors[s]);
            for (let i = 0; i < elements.length; ++i) {
                if (isPromoBannerNode(elements[i])) continue; 
                const txt = elements[i].textContent || '';
                if (containsAllowedWords(txt)) continue;
                
                const forbiddenMatch = containsForbiddenKeywordsBase(txt);
                if (forbiddenMatch) {
                    overlay && (overlay.style.display = 'block');
                    if (!redirected) { redirected = true; doRedirect('selector:' + selectors[s], forbiddenMatch); }
                }
            }
        }

        if (!redirected && isFirefoxAndroid) {
            ffAndroidSuggestionScanAndRedirect();
        }
    }

    function blockImageResults() {
        if (isRedirecting) return;
        try {
            if (!/tbm=isch|udm=2/i.test(window.location.search)) return;
            const cards = document.querySelectorAll('.isv-r, .rg_bx, .TygpHb');
            for (let i = 0; i < cards.length; ++i) {
                const card = cards[i];
                if (isNodeClicked(card)) continue;
                if (card.getAttribute('data-gj-cache') === '1') continue;

                const imgsAndLinks = card.querySelectorAll('img, a');
                let removeCard = false;
                for (let j = 0; j < imgsAndLinks.length; ++j) {
                    const src = (typeof imgsAndLinks[j].src === 'string' ? imgsAndLinks[j].src : '') || 
                                (typeof imgsAndLinks[j].href === 'string' ? imgsAndLinks[j].href : '');
                    if (!src || src.startsWith('data:')) continue; 
                    
                    if (shouldRemoveElement(src, '', true)) { removeCard = true; break; }
                }
                
                if (removeCard) {
                    hideElementSafely(card);
                    card.remove();
                } else {
                    card.setAttribute('data-gj-cache', '1');
                }
            }
            const anchors = document.querySelectorAll('a');
            for (let i = 0; i < anchors.length; ++i) {
                const a = anchors[i];
                if (isNodeClicked(a)) continue;
                if (a.getAttribute('data-gj-cache-img') === '1') continue;

                if (typeof a.href === 'string' && !a.href.startsWith('data:') && shouldRemoveElement(a.href, '', true)) {
                    let p = a.closest('.isv-r, .eA0Zlc, .wXeWr');
                    if (p) {
                        hideElementSafely(p);
                        p.remove();
                    } else {
                        hideElementSafely(a);
                        a.remove();
                    }
                } else {
                    a.setAttribute('data-gj-cache-img', '1');
                }
            }
        } catch (e) {}
    }

    function removeBlockedGoogleImageResults() {
        if (isRedirecting) return;
        try {
            const imageResults = document.querySelectorAll('div.isv-r, div.eA0Zlc, div.vCUuC, div.p7bv, div.kwICDb, div.oYLlHe, div.m3LIae, a.ddkIM');
            imageResults.forEach(container => {
                if (isNodeClicked(container)) return;

                let matched = false;
                
                const text = container.innerText || container.textContent || '';
                const cacheKey = String(text.length);
                if (container.getAttribute('data-gj-cache') === cacheKey) return;
                
                if (shouldRemoveElement('', text, true)) {
                    matched = true;
                } else {
                    const els = container.querySelectorAll('a, img');
                    for (let i = 0; i < els.length; ++i) {
                        const el = els[i];
                        let href = typeof el.href === 'string' ? el.href : '';
                        if (href.startsWith('data:')) href = '';
                        
                        let src = typeof el.src === 'string' ? el.src : '';
                        if (src.startsWith('data:')) src = '';
                        
                        let dSrc = typeof el.dataset?.src === 'string' ? el.dataset.src : '';
                        if (dSrc.startsWith('data:')) dSrc = '';
                        
                        let dSurl = typeof el.dataset?.surl === 'string' ? el.dataset.surl : '';
                        if (dSurl.startsWith('data:')) dSurl = '';
                        
                        let dNav = typeof el.dataset?.nav === 'string' ? el.dataset.nav : '';
                        if (dNav.startsWith('data:')) dNav = '';
                        
                        const urlStr = `${href} ${src} ${dSrc} ${dSurl} ${dNav} ${el.title || ''} ${el.alt || ''}`;
                        if (urlStr.trim() !== '') {
                            if (containsForbiddenKeywordsBase(urlStr) || matchesBlockedImagePattern(href) || isBannedTLD(href)) {
                                matched = true; break;
                            }
                        }
                    }
                }
                
                if (matched) {
                    hideElementSafely(container);
                    container.remove();
                } else {
                    container.setAttribute('data-gj-cache', cacheKey);
                }
            });
        } catch (e) {}
    }

    function removeOverlayNow() {
        if (overlay && overlay.parentNode && !overlayRemoved) {
            overlay.parentNode.removeChild(overlay);
            overlayRemoved = true;
            devLog('Overlay removed (safe)');
        }
    }

    function maybeReleaseOverlay() {
        if (isRedirecting || overlayRemoved) return;
        if (document.readyState === 'loading') return;
        
        if (!hasForbiddenSuggestionText()) {
            setTimeout(removeOverlayNow, 150);
        }
    }

    function tryRemoveOverlayOnHomepage() {
        if (isRedirecting || overlayRemoved) return;
        if (document.readyState === 'loading') return;
        
        if (window.location.pathname === "/" && !new URLSearchParams(window.location.search).has('q')) {
            removeOverlayNow();
        }
    }

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
        
        removePromoBanners();
        swapSearchTabs(); 
        
        const sp = new URLSearchParams(window.location.search);
        const q = sp.get('q') || '';
        const bad = containsForbiddenKeywords(q);
        if (bad && !isUrlAllowed(window.location.href)) {
            overlay && (overlay.style.display = 'block');
            doRedirect('late-query', bad);
            return;
        }

        monitorSelectorsAndRedirect();
        if (isRedirecting) return;

        blockResults();
        blockUrls();
        blockImageResults();
        removeBlockedGoogleImageResults();

        blockElementsBySelectors();
        blockElementsByPhrases();

        maybeReleaseOverlay();
        tryRemoveOverlayOnHomepage();
    }

    function startFilteringAndObserve() {
        devLog('Setting up mutation observer');
        interceptSearchInputChanges();

        const container = (isFirefoxAndroid ? document.documentElement : (document.body || document.documentElement));
        domObserver = new MutationObserver((mutations) => {
            if (isRedirecting) return;
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
                    ffAndroidSuggestionScanAndRedirect();
                    maybeReleaseOverlay();
                    if (ffAndroidScanAttempts > 120) {
                        clearInterval(ffAndroidScanInterval);
                        ffAndroidScanInterval = null;
                    }
                }, 500);
                devLog('FF Android periodic scanner started');
            } catch (e) {}
        }

        mainFiltering();
    }

    function enforceSafeSearch() {
        try {
            document.cookie = "PREF=f2=8000000; domain=.google.com; path=/; secure";
            devLog('SafeSearch cookie set');
        } catch (e) {}
    }
    enforceSafeSearch();

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