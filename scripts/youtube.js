// ==UserScript==
// @name         YTClean
// @version      2026-08-15
// @description  Enhances my YouTube experience by blocking trackers and hiding garbage, such as shorts.
// @match        https://*.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        console.log('[YOUTUBE.JS]', message);
    }

    // ===== Memory/observer/timer lifecycle tracking (added) =====
    const __ytTimers = { intervals: new Set(), timeouts: new Set() };
    const __ytObservers = new Set();
    const __ytEventCleanups = new Set();
    let __ytCleanupRan = false;
    let __ytIntervalsRunning = false;
    let isRedirecting = false; // Global redirect flag to prevent loops

    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        __ytTimers.intervals.add(id);
        return id;
    }
    function addTimeout(fn, ms) {
        const id = setTimeout(() => {
            __ytTimers.timeouts.delete(id);
            fn();
        }, ms);
        __ytTimers.timeouts.add(id);
        return id;
    }
    function onEvent(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        __ytEventCleanups.add(() => target.removeEventListener(type, handler, options));
    }
    function trackObserver(observer) {
        __ytObservers.add(observer);
        return observer;
    }
    function stopIntervals() {
        __ytTimers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
        __ytTimers.intervals.clear();
        __ytIntervalsRunning = false;
    }
    function startIntervals(schedulerFn) {
        if (__ytIntervalsRunning) return;
        schedulerFn();
        __ytIntervalsRunning = true;
    }
    function cleanup() {
        if (__ytCleanupRan) return;
        __ytCleanupRan = true;
        try {
            stopIntervals();
            __ytTimers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __ytTimers.timeouts.clear();
            __ytObservers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __ytObservers.clear();
            __ytEventCleanups.forEach(fn => { try { fn(); } catch {} });
            __ytEventCleanups.clear();
            devLog('Cleanup complete.');
        } catch (e) {
            console.log('[YOUTUBE.JS] cleanup error: ' + e.message);
        }
    }

    // List of known YouTube tracker domains or URL patterns
    const trackerPatterns = [
        /google-analytics\.com/,
        /youtube\.com\/watch/,
        /www\.youtube\.com\/set_video/,
        /ytimg\.com/,
        /adservices\.google\.com/,
        /youtube\.com\/api\/stats/,
        /youtube\.com\/pixel/,
        /youtube\.com\/v_/,
    ];

    // List of keywords or phrases to block in search queries and page content
    const blockKeywords = [

	// Names and nicknames
	/\balexa\b/i, /Bliss/i, /Alexa Bliss/i, /lex kauf/i, /lex cabr/i, /lex carbr/i, /Liv Morgan/i, /Tiffany/i, /Tiffy/i, /Stratton/i, /Chelsea Green/i, /Dua Lipa/i, /Dualipa/i,
        /Jordynne/i, /Maryse/i, /Stephanie McMahon/i, /Steph McMahon/i, /Women's/i, /Woman's/i, /Summer Rae/i, /Naomi/i, /Bianca Belair/i, /Charlotte/i, /Jessika Carr/i, /Mercedes/i, /cabrera/i, /leks bl/i, /leks kauf/i,
        /Carr WWE/i, /Jessica Karr/i, /bikini/i, /Kristen Stewart/i, /Sydney Sweeney/i, /Nia Jax/i, /Young Bucks/i, /Vice WWE/i, /Candice LeRae/i, /Trish/i, /Stratus/i, /lex kaufman/i,
	/Lola Vice/i, /Velvet Sky/i, /deviantart/i, /leks cabr/i, /leks carbr/i, /Elyina/i, /Elyna WWE/i, /Tiffy Time/i, /Steward/i, /Roxanne/i, /Joanie/i, /Stewart/i, /Isla Dawn/i, 
        /Alexa WWE/i, /AJ Lee/i, /deepfake/i, /ring gear/i, /Lexi/i, /Aleksa/i, /Giulia/i, /Paige/i, /Chyna/i, /\bToni\b/i, /\bLin\b/i, /\blana\b/i, /Jackson/i, /Lash Legend/i, 
	/Jordynne Grace/i, /Sweeney/i, /Alexis/i, /Sydney/i, /Zelina Vega/i, /Mandy Rose/i, /Nikki/i, /Brie/i, /Bella/i,  /Skye Blue/i, /Carmella/i, /Mariah May/i, /Harley Cameron/i, 
	/Hayter/i, /Ripley/i, /five feet of fury/i, /5 feet of fury/i, /Tay Conti/i, /Valhalla/i, /IYO SKY/i, /Shirai/i, /Io Sky/i, /Iyo Shirai/i, /Dakota Kai/i, /Asuka/i, /Tamina/i,
        /Kairi Sane/i, /Meiko Satomura/i, /NXT Women/i, /Russo/i, /Miko Satomura/i, /Sarray/i, /Xia Li/i, /Shayna Baszler/i, /Ronda Rousey/i, /Dana Brooke/i, /Izzi Dame/i, /Lana WWE/i,	
	/Alicia Fox/i, /Madison Rayne/i, /Saraya/i, /attire/i, /Layla/i, /Michelle McCool/i, /Eve Torres/i, /Kelly/i, /Melina WWE/i, /Jillian Hall/i, /Mickie James/i, /Su Yung/i, /Britt/i, 
	/Nick Jackson/i, /Matt Jackson/i, /Maria Kanellis/i, /Beth Phoenix/i, /Victoria WWE/i, /Kristen/i, /\bLin\b/i, /Watchorn/i, /@LinWatchorn/i, /Courtney Ryan/i, /Elina WWE/i, 
        /Molly Holly/i, /Gail Kim/i, /Awesome Kong/i, /Deonna Purrazzo/i, /Anna Jay/i, /\bRiho\b/i, /Britney/i, /Nyla Rose/i, /Angelina Love/i, /Tessmacher/i, /Havok/i, /Toni Storm/i, 
        /Taya Valkyrie/i, /Valkyria/i, /Tay Melo/i, /Willow Nightingale/i, /Statlander/i, /Hikaru Shida/i, /Sasha/i, /Penelope Ford/i, /Shotzi/i, /Tegan/i, /Becky Lynch/i, /Amari Miller/i,
        /Sasha Banks/i, /Sakura/i, /Tessa/i, /Brooke/i, /Jakara/i, /Alba Fyre/i, /Isla Dawn/i, /Scarlett Bordeaux/i, /\bB-Fab\b/i, /Kayden Carter/i, /Katana Chance/i, /Valentina Feroz/i,
        /Bayley/i, /Lyra Valkyria/i, /Indi Hartwell/i, /Blair Davenport/i, /Maxxine Dupri/i, /Natalya/i, /Sakazaki/i, /Karmen Petrovic/i, /Ava Raine/i, /CJ Perry/i, /Shira/i, /Piper Niven/i,
        /Cora Jade/i, /Jacy Jayne/i, /Gigi Dolin/i, /Thea Hail/i, /Tatum WWE/i, /Paxley/i, /Fallon Henley/i, /Nattie/i, /escort/i, /Sol Ruca/i, /Kelani Jordan/i, /CJ Lana/i, /Lana Perry/i,
        /Electra Lopez/i, /Wendy Choo/i, /Yulisa Leon/i, /Gina Adam/i, /Arianna Grace/i, /carbrera/i, /Michin/i, /Mia Yim/i, /\bMina\b/i, /Alba Fyre/i, /Blackheart/i, 
	
	// Misc stuff
	/deepnude/i, /undress/i, /nudify/i, /nude/i, /nudifier/i, /faceswap/i, /facemorph/i, /epnud/i, /udify/i, /udifi/i, /ndres/i, /deepfak/i, /\bBra\b/i, /diffusion/i, /trunks/i, /pant/i,
	/fantime/i, /clothes/i, /crotch/i, /dress/i, /dreamtime/i, /panties/i, /panty/i, /cloth/i, /ndfy/i, /nd1f/i, /nd!f/i, /ndlf/i, /dreambooth/i, /dream booth/i, /dream boot/i, /dreamboot/i,
	/cleavage/i, /LGBTQ/i, /\bbooty\b/i, /sexy/i, /inpaint/i, /photopea/i, /lingerie/i, /underwear/i, /Rule 34/i, /cameltoe/i, /dreamtime/i, /Venice/i, /Venoice/i, /Venise/i, /Venoise/i, 
	/ndif/i, /undressifying/i, /prostitut/i, /sensuel/i, /onlyfans/i, /fansly/i, /justforfans/i, /manyvids/i, /fan time/i, /queer/i, /\bTrans\b/i, /Transvestite/i, /wonder share/i,
	/VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /Virtuaalibox/i, 
	/OracleVM/i, /virtualmachine/i, /virtual machine/i, /virtuaalikone/i, /virtuaali kone/i, /virtuaali tietokone/i, /virtuaalitietokone/i, /hyper-v/i, /hyper v/i, /virtuaalimasiina/i, 
	/virtuaali masiina/i, /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /hypervisor/i, 
	/hyper visor/i, /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, /virt machine/i, 
	/virtmachine/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i,  /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /virt mac/i,
        /virt-machine/i, /virtumachine/i, /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, 
        /\bMachiene\b/i,  /vi mach/i, /vir mach/i, /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /vir machine/i, /virtu mac/i, /virtual machi/i, 
	/\bai\b/i, /AI model/i, /AI-generated/i, /generated/i, /\bAI Art\b/i, /\bBy AI\b/i, /AI edited/i, /upscaling/i, /p41n/i, /pa1n/i, /p4in/i, /filmora/i, /wondershare/i, /AI app/i,
        /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Anthr/i, /Antro/i, /\bS0ft\b/i, /s0ftw/i, /softw/i, /\b50ft\b/i, /w4re/i, /war3/i, /w4r3/i, /upscaled/i,
	/Sharia/i, /Pride/i, /\bshe\b/i, /\bher\b/i, /Woman/i, /Women/i, /NXT Womens/i, /beta male/i, /alpha male/i, /DeepSeek/i, /Grok-AI/i, /Elon Musk/i, /\bElon\b/i, /\bMusk\b/i,
	/selain/i, /Safari/i, /OperaGX/i, /MS Edge/i, /Microsoft Edge/i, /TOR-Browser/i, /TOR-selain/i, /Opera GX/i, /\btor\b/i, /browser/i, /Opera Browser/i, /Vivaldi/i, /Brave-Browser/i,
	/Nooo/i, /Nuuu/i,

    //  Blocksite consistency list (every term from blocksite list)
        /epnu/i, /epno/i, /epeno/i, /ndres/i, /udif/i, /derrier/i, /derriere/i, /undress/i, /del clot/i, /eras clot/i, /eras pant/i, /del pant/i, /lex bl/i, /lex kauf/i,
        /lex cabr/i, /lex carb/i, /Liv Morgan/i, /Giona Jene/i, /Gionna Daddio/i, /Jene Daddio/i, /Zeli Vega/i, /Nikki/i, /remov pant/i, /remov cloth/i, /shak ass/i, 
	/shak booty/i, /shak butt/i, /AI cloth/i, /AI pant/i, /AI linger/i, /linqerie/i, /Zelina/i, /Zel Vega WWE/i, /removal of cloth/i, /remov of cloth/i, /0ffr0b/i,  
	/eras of cloth/i, /Sydney Sweeney/i, /Zel Veg WWE/i, /swapface/i, /Fanene/i, /faceswap/i, /face swap/i, /morphface/i, /morph face/i, /facemorph/i, /face morph/i, 
	/faceblend/i, /face blend/i, /Zel Vag WWE/i, /swap face/i, /switch faces/i, /switchfaces/i, /faceswitch/i, /face switch/i, /offrobe/i, /0ffrob/i, /offr0b/i,  
	/painttonud/i, /paint2nud/i, /paint to nud/i, /paint 2 nud/i, /p4int/i, /pa1nt/i, /uncloth/i, /un cloth/i, /derobe/i, /de robe/i, /un-cloth/i, /delet of cloth/i,
        /de-robe/i, /disrobe/i, /dis-robe/i, /clothoff/i, /cloth off/i, /cloth-off/i, /Unpant/i, /b1kin/i, /bik1n/i, /trunks/i, /trunk5/i, /unblur/i, /enhanc/i, /upscale/i,
        /enhanceunblur/i, /photoenhance AI/i, /AI enhancing/i, /Enhancing AI/i, /AI photoenhance/i, /AI-photoenhance/i, /photoenhance-AI/i, /AI unblur and enhance/i, 
	/AI unblur and upscale/i, /rule 34/i, /rulethirtyfour/i, /rule thirtyfour/i, /Explicit AI content/i, /gr4phy/i, /p0rno/i, /porn0/i, /deepfake/i, /deep fake/i, 
	/object remov/i, /remov object/i, /delet object/i, /object delet/i, /eras object/i, /object eras/i, /unblur/i, /un blur/i, /deblur/i, /de blur/i, /remov blur/i, 
	/rem0v/i, /r3mov/i, /d3let/i, /del3t/i, /3rasi/i, /er4si/i, /eras1/i, /Reveal AI/i, /AI Reveal/i, /uncensor AI/i, /AI uncensor/i, /unc3nsor/i, /uncen5or/i, 
	/uncens0r/i, /unc3n50r/i, /uncen50r/i, /unc3ns0r/i, /Artific uncensor/i, /Uncensor artific/i, /d3epnu/i, /de3pnu/i, /d33pnu/i, /ndr3ss/i, /ndre5s/i, /ndres5/i, 
	/ndre55/i, /ndr3s5/i, /ndr35s/i, /aifake/i, /iafake/i, /ai fake/i, /ia fake/i, /Denois/i, /De nois/i, /de-nois/i, /dr3ss/i, /dre5s/i, /dres5/i, /celebjihad/i, 
	/celeb-jihad/i, /celebsunmasked/i, /unmaskedcelebs/i, /celebrityfakes4u/i, /celebrityfakesforyou/i, /celebrityfakes2you/i, /celebrityfakestoyou/i, /outfitswap/i, 
	/swapoutfit/i, /outfit-swap/i, /swap-outfit/i, /aznude/i, /az_nude/i, /az-nude/i, /Fapello/i, /Daddio/i, /Gionna/i, /Giona/i, /Gion4/i, /G1ona/i, /Brianna Garcia/i, 
	/gi0na/i, /Brie Garcia/i, /Nikki Garcia/i, /Bella Twin/i, /Samantha/i, /S4mantha/i, /sam4ntha/i, /s4m4ntha/i, /s4m4nth4/i, /sam4nth4/i, /s4manth4/i, /Irvin wrest/i, 
	/Irvin rass/i, /Irvin WWE/i, /Irvin AEW/i, /Irvin TNA/i, /Irvin NJPW/i, /Irwin wrest/i, /Irwin rass/i, /Irwin WWE/i, /Irwin AEW/i, /Irwin TNA/i, /Irwin NJPW/i, 
	/D4ddio/i, /dadd1o/i, /daddi0/i, /d4dd1o/i, /d4ddi0/i, /dadd10/i, /Sanna Marin sex/i, /Sanna Marin anal/i, /fappenist/i, /fappening/i, /nude leak/i, /naked leak/i, 
	/bare leak/i, /cunt leak/i, /pussy image leak/i, /pussy photo leak/i, /pussy pic leak/i, /celeb leak/i, /porn leak/i, /onlyfans leak/i, /fantime leak/i, /Nood/i,
	/JustForFans leak/i, /FanCentro leak/i, /MYM leak/i, /Unfiltrd leak/i, /Loyalfans leak/i, /Ismygirl leak/i, /Friendsonly leak/i, /Modelhub leak/i, /myFanPark leak/i, 
	/iFans leak/i, /Fanso leak/i, /Mygirlfund leak/i, /AdultNode leak/i, /Uncensored leak/i, /Unfiltered leak/i, /Fanvue leak/i, /Okfans leak/i, /Manyvids leak/i, 
	/Scrile connect leak/i, /Flirtback leak/i, /Scrile content leak/i, /picwish/i, /snapedit/i, /Carbrera/i, /undiewear/i, /und1es/i, /undi3s/i, /undie5/i, /und13s/i, 
	/und1e5/i, /undi35/i, /swimwear/i, /sw1mw/i, /5wimw/i, /sw1mwe4r/i, /sw1mw34r/i, /remov underwear/i, /remov undie/i, /remov boxers/i, /delet underwear/i, /poses/i,
	/Fansly leak/i, /delet bikini/i, /eras swimwear/i, /remov swimwear/i, /delet swimwear/i, /remov suit/i, /delet suit/i, /eras suit/i, /remov bra/i, /delet bra/i, 
	/delet pant/i, /delet boxers/i, /delet undie/i, /delet cloth/i, /eras cloth/i, /based labs/i, /basedlabs/i, /Glutes/i, /Coarse vid/i, /Coarse pic/i, /c0arse/i, 
	/co4rse/i, /coar5e/i, /coars3/i, /noodi/i, /b1kin1/i, /b!kin1/i, /b1kin!/i, /b!kin!/i, /Bella fantas/i, /St3phan/i, /st3ph4n/i, /steph4n/i, /Steph Nicole/i, 
	/Chigvintsev/i, /Immodest/i, /Nethers/i, /Nether regions/i, /posing/i, /p0s1ng/i, /p05ing/i, /WWE onlyfans/i, /AEW onlyfans/i, /NJPW onlyfans/i, /TNA onlyfans/i, 
	/smexy/i, /sm3xy/i, /Bella/i, /Point 0f View/i, /b0oty/i, /bo0ty/i, /Lady Part/i, /Femal part/i, /Girl part/i, /Genital/i, /Fannie/i, /Fannys/i, /skimp/i, /sk1mp/i, 
	/5kimp/i, /generativ/i, /gener AI/i, /ejaculat/i,/5quirt/i, /squ1rt/i, /squir7/i, /squ1r7/i, /5quir7/i, /5qu1rt/i, /Mercedes Mon/i, /Sasha/i, /B4nks/i, /NJPW tush/i, 
	/AEW tush/i, /TNA tush/i, /WWE tush/i, /NJPW vulva/i, /AEW vulva/i, /TNA vulva/i, /WWE vulva/i, /mak1n out/i, /m4kin out/i, /m4k1n out/i, /makin 0ut/i, /mak1n 0ut/i, 
	/m4kin 0ut/i, /m4k1n 0ut/i, /Nikk Bell/i, /Niki Bell/i, /Zelin Veg/i, /d3epn/i, /de3pn/i, /Nude_AI/i, /noowd/i, /deee/i, /deppp/i, /pus5y/i, /pu5sy/i, /Nude-AI/i, 
	/nuuw/i, /NudeAI/i, /A1 Nud3/i, /AI Nud3/i, /A1 Nude/i, /mak3 nude/i, /mak3 nud3/i, /make nude/i, /mak nud/i, /deppnude/i, /depp-nude/i, /depp nude/i, /depp\+nude/i, 
	/nud1f/i, /deepp/i, /deepe nude/i, /d33p3 nud3/i, /deep3 nud3/i, /deep3 n00d/i, /deep3 n00/i, /deepe no0/i, /deepe n0/i, /deep e n0o/i, /deep e n00/i, /deep e noo/i, 
	/deepe n0o/i, /deepe n00d/i, /foxify/i, /deepen 00/i, /d33pen0/i, /d3epen0/i, /de3pen0/i, /peee/i, /deepeen/i, /deepen oo/i, /deepenoo/i, /deepe noo/i, /make nud3/i, 
	/mak1n/i, /gen nud3/i, /bas3dlabs/i, /AI Gen nud/i, /AI Gen n0/i, /g3n nude/i, /generat_nud/i, /generatenud/i, /genratenud/i, /genratnud/i, /d33pe nude/i, /undre55/i, 
	/undre/i, /AI Nud/i, /de3pno/i, /d33pno/i, /deepn0/i, /de3pn0/i, /deepnu/i, /deep-nud/i, /d33pn0d/i, /depnud/i, /pusss/i, /pussie/i, /pussiie/i, /pussiii/i, /d3pnud/i, 
	/deep-n/i, /deep\+n/i, /deep_nud/i, /deep_n0/i, /deep nud/i, /deepnudo/i, /nuds/i, /n8ked/i, /nak3d/i, /n4ked/i, /deep3/i, /deep-nu/i, /d33p-nu/i, /deep nu/i, /diii/i, 
	/dipnud/i, /dllp-n/i, /dllp_n/i, /dllp n/i, /dllpn/i, /diip n/i, /diip\.n/i, /d1pnud/i, /dip nud/i, /dip-nud/i, /dip_nud/i, /unstabl diffu/i, /diipn/i, /unst4bl d1ffu/i, 
	/deep_n/i, /AI Noo/i, /deepe n00/i, /unst4ble/i, /unst4bl3/i, /unstabl3/i, /pqrn/i, /pårn/i, /pxrn/i, /p0rni/i, /porni/i, /porny/i, /swap pant/i, /fox1fy/i, /fox1f/i,
	/foxif/i, /f0xif/i, /removecloth/i, /remove cloth/i, /generatenude/i, /un5tabl/i, /generate nude/i, /generate nud3/i, /change pant AI/i, /photo ai/i, /imag ai/i,  
	/nsfw=tool/i, /nsfw/i, /nsfw-tool/i, /stablediffusion/i, /stabl diffus/i, /stable-diffusion/i, /stable_diffusion/i, /stable\?diffusion/i, /stable=diffusion/i, /nuk3if/i,
	/st4bl3/i, /stabl diffu/i, /st4bl diffu/i, /5t4bl diffu/i, /d1ffu/i, /unstable-diffusion/i, /un5t4bl/i, /unst4bl/i, /undr/i, /onlyf4ns/i, /onlyf4n5/i, /onlif4n5/i, 
	/mak1n/i, /IMG ai/i, /st4ble/i, /onlif4ns/i, /f4nt1me/i, /fant1me/i, /f4ntime/i, /manyvids/i, /m4nyvids/i, /manyv1ds/i, /manyvid5/i, /m4nyv1d5/i, /f4n5ly/i, /fan5ly/i,
	/f4nsly/i, /0nlynsfw/i, /onlynsfw/i, /deepai/i, /deep-ai/i, /deep\+ai/i, /deep\?ai/i, /deep=ai/i, /deep_ai/i, /gen nude/i, /nude gen/i, /genaratenud/i, /gen_nude/i, 
	/generate_nud/i, /g3nerate_nud/i, /g3n3rat/i, /nudgen/i, /nudegen/i, /nudesgen/i, /nudes gen/i, /nde gen/i, /nude gn/i, /nde gn/i, /creat girlf/i, /creat gf/i, /creategf/i, 
	/mak gf/i, /mak girlf/i, /Girlfriend AI/i, /nudgener/i, /nudi gen/i, /gen3raten/i, /gen3rat3n/i, /live3d/i, /aiexotic/i, /ai exotic/i, /ai-exotic/i, /nsfwart/i, /nsfw art/i, 
	/nsfw art gen/i, /ero Artificial intelligence/i, /Artificial intelligence gen/i, /babe5/i, /Artificial intelligence g3n/i, /generat3/i, /genrat/i, /nude5/i, /waif/i, /cr34te/i, 
	/cr3ate/i, /cr3a7e/i, /cr3at/i, /creat1/i, /Artificial intelligence porn/i, /creat3/i, /Artificial intelligence ero/i, /bebe5/i, /nubee/i, /nub3e/i, /nube3/i, /pxxrn/i, /pxxxrn/i, 
	/poorn/i, /penetr\*\*e/i, /Lex Bliss/i, /createporn/i, /vidnoz/i, /creat porn/i, /porn journey/i, /bussy/i, /pornjourney/i, /frosting ai/i, /fr0st ai/i, /fr0st a1/i, /pornjoy/i, 
	/porn joy/i, /pornj0y/i, /porn j0y/i, /only-babe/i, /onlybabe/i, /ai p0rn/i, /ai corn/i, /priv3/i, /aip0rn/i, /bus5y/i, /bu5sy/i, /privee/i, /prive/i, /r3m0ve/i, /remov3/i, 
	/r3m AI/i, /rem cloth/i, /cloth rem/i, /pant rem/i, /rem pant/i, /pant eras/i, /pant del/i, /frosting\?ai/i, /frosting=ai/i, /frosting-ai/i, /ai onl/i, /porm/i, /un pant/i, 
	/de pant/i, /depant/i, /remdress/i, /rem dress/i, /dress rem/i, /dressrem/i, /rem bra/i, /rem boxers/i, /deldress/i, /de dress/i, /dress de/i, /dressde/i, /del bik/i, /rem bik/i, 
	/eras bik/i, /dress eras/i, /clit\*/i, /clito\*/i, /\*litor\*/i, /\*litori/i, /clitori\*/i, /clitor\*/i, /pl3as/i, /pl345sure/i, /g3nit/i, /ai tush/i, /L3X Bliss/i, /Bl1ss/i, 
	/L3X Bl1ss/i, /pl345ur3/i, /vulv\*/i, /\*ulva/i, /Mercede Bank/i, /pl345ure/i, /m\*stu/i, /mas\*u/i, /mast\*r/i, /vag\*\*a/i, /Artific Intellig/i, /v\*\*ina/i, /\*agina/i, 
	/vagin\*/i, /vagi\*n/i, /puss\*/i, /puss3/i, /pussee/i, /pu5si/i, /puss1/i, /squ1r/i, /s\*uir/i, /squir\*/i, /\*quir/i, /squ\*r/i, /squi\*/i, /sq\*ir/i, /5quir\*/i, /eras photo/i, 
	/eras pic/i, /midjourney/i, /mid journey/i, /prompthero/i, /prompt hero/i, /midjourn3y/i, /creat nud/i, /gen nud/i, /convert nud/i, /conversion nud/i, /nud someone/i, /cr3at nud/i,
	/nud some else pic/i, /nud someone pic/i, /AI suit/i, /nud person p/i, /nud people p/i, /nud person i/i, /nak convert/i, /nak conversion/i, /nud someone i/i, /nud some else i/i, 
	/nud someone p/i, /cre\*te/i, /cre4t nud/i, /crea7 nud/i, /cr347 nud/i, /nud app/i, /m\*k nud/i, /\*ak nud/i, /m4k nud/i, /m&k3 nud/i, /m&ke nud/i, /c\*eate/i, /cr\*ate/i, 
	/crea\*e/i, /creat\*/i, /\*reat/i, /crete nud/i, /cret3 nud/i, /Nudi it/i, /Nude it/i, /###/i, /nud softw/i, /nud softv/i, /nud softf/i, /nud her p/i, /nud the/i, /nud people/i, 
	/nud person/i, /nudein/i, /nudin/i, /nudey/i, /nudy/i, /nudyin/i, /nudeyi/i, /\*ying/i, /creat nak/i, /nud!f/i, /nude!f/i, /doepnud/i, /nuid1/i, /nuidi/i, /nuid/i, /nudl/i, /njuud/i,
        /njud/i, /nujd/i, /nudj/i, /nuidif/i, /nui!d/i, /diepn/i, /deip/i, /diif/i, /deopnud/i, /nidif/i, /n1dif/i, /nid1f/i, /expli\*it/i, /explic\*t/i, /explici\*/i, /\*xplicit/i,
	/e\*plicit/i, /ex\*licit/i, /exp\*icit/i, /expl\*cit/i, /exp!ic/i, /expl!c/i, /3xpl!c/i, /expl1c/i, /horni/i, /horn1/i, /h0rny/i, /whor1/i, /wh0re/i, /whor3/i, /dirti/i, /dirt\*/i,  
	/d1rti/i, /conv3rt/i, /conv3rs/i, /c0nver/i, /d1rtl/i, /dlrt1/i, /dlrt!/i, /dlrti/i, /dlrty/i, /d!rti/i, /dir\*i/i, /dir\*y/i, /who\*ing/i, /deepmok/i, /nuk1f/i, /nuk3f/i,  
	/deepnugif/i, /deepnukeif/i, /deepnugeif/i, /deepn00/i, /deepnoo/i, /diep/i, /nudi app/i, /nude app/i, /ned1f/i, /nedif/i, /nedeif/i, /nudeif/i, /nootify/i, /ned!f/i, /diva vulva/i,
	/artificial intelligence/i, /art intel/i, /ai booty/i, /ai butt/i, /ai horny/i, /diva vag/i, /diva pussy/i, /diva naked/i, /diva nude/i, /diva anal/i, /diva horny/i, /diva the butt/i, 
	/AI explicit/i, /AI explic/i, /Art explic/i, /A1 explic/i, /al explic/i, /al lntel/i, /cl0at/i, /elliecha0tic/i, /AI sensu/i, /off cloth/i, /off robe/i, /Off dress/i, /Off pant/i, 
	/off bra/i, /off swimwear/i, /off lingerie/i, /off boxers/i, /off swimsuit/i, /AI Uncens/i, /Al uncens/i, /A1 uncens/i, /IA nude/i, /AI censor/i, /A\* censor/i, /Al censor/i, 
	/A1 censor/i, /Al unfilt/i, /A1 unflit/i, /AI unfilt/i, /unf1lt/i, /unfllt/i, /unf!lt/i, /\*l tool/i, /\*I tool/i, /A\* tool/i, /IA nud/i, /cloth chan web/i, /cloth chan app/i, 
	/cloth chan sit/i, /cloth chan im/i, /cloth chan ph/i, /cloth chan si/i, /pant chan si/i, /pant chan im/i, /shirt chan pic/i, /shirt chan ph/i, /sh1rt/i, /shirt chan im/i,
	/cloth chan pic/i, /outf chan ap/i, /chng/i, /facechan/i, /cust ai/i, /facl/i, /facechang/i, /face chan/i, /khangin/i, /khange/i, /kh4ng/i, /changr/i, /khang1/i, /khang3/i,
        /khang/i, /thr0at/i, /thro4t/i, /sw1tch/i, /face swi/i, /outf chan im/i, /dress chan ap/i, /shirt chan ap/i, /biur/i, /nude scan/i, /AI blur/i, /khank/i, /khanc/i, /ghang/i,
        /dres chan/i, /dres switch/i, /AI dres/i, /nub1f/i, /nubif/i, /nuuu/i, /noudi/i, /nuod/i, /noudl/i, /noud1/i, /noud3/i, /deepnoud/i, /deepnou/i, /deepnu0/i, /ch4ng/i, /dlidn/i,
	/nuubif/i, /nuub3f/i, /nodress/i, /ndress/i, /nub app/i, /nub site/i, /nuub app/i, /nuub site/i, /deeper nud/i, /deepernud/i, /deepern0o/i, /deeperno0/i, /no dress/i, /diip/i,
	/unstress/i, /n0 tre/i, /n0tre/i, /no tress/i, /untres/i, /ntress/i, /notress/i, /nodif/i, /nod1f/i, /ndif/i, /ndlf/i, /doodlf/i, /dood!f/i, /doodif/i, /dood1f/i, /diid/i,  
	/deepi/i, /sma5h/i, /sm4sh/i, /deep dud si/i, /deep dud ap/i, /deeperno/i, /neepdud/i, /neep dud/i, /dudeif/i, /udelf/i, /dudief/i, /udeif/i, /ude1f/i, /ude!f/i, /dlid n/i,  
	/dild/i, /difd/i, /d nudi/i, /d3d nud/i, /deepenu/i, /deepa/i, /deepb/i, /deepd/i, /deep fa/i, /deepfa/i, /deepfx/i, /deepcu/i, /deepcoc/i, /deepdic/i, /deepic/i, /deeppic/i,  
	/deepf3/i, /deep f4/i, /deepg/i, /deep f3/i, /deepl/i, /deeph/i, /deepj/i, /deepk/i, /deppn/i, /depp nu/i, /deepr/i, /deepq/i, /deepo/i, /deep0/i, /deep n0/i, /deepm/i, /deepw/i,  
	/deepu/i, /deept/i, /deepx/i, /deepsx/i, /deeps\*x/i, /deepz/i, /deeznud/i, /deez nud/i, /deepy/i, /nutif/i, /ntif/i, /nutlf/i, /nut!f/i, /nuteif/i, /nopif/i, /nop1f/i, /nopeif/i,  
	/inpa1nt/i, /inp4int/i, /inp41nt/i, /inpa!nt/i, /inpalnt/i, /llng/i, /AI outf/i, /AI wear/i, /cl0ath/i, /outf!t/i, /outf1t/i, /AI shir/i, /cI0uth/i, /c!0uth/i, /c10uth/i, /cl0uth/i, 
	/c1outh/i, /c!outh/i, /cIouth/i, /c1oth/i, /c!oth/i, /diva the ass/i, /cl0th/i, /cl04th/i, /clo4th/i, /cl0yth/i, /cloyth/i, /w1thout/i, /with0ut/i, /wlth/i, /shlrt/i, /sh!rt/i, /5kirt/i, 
	/5klrt/i, /dudif/i, /dud1f/i, /dud!f/i, /deep som/i, /deepsum/i, /deep sum/i, /deep sud/i, /deep gud/i, /deep cod/i, /nqde/i, /nxde/i, /tutif/i, /tut1f/i, /tut!f/i, /duudi/i, /d0dif/i, 
        /n0dress/i, /dod1f/i, /deepfu/i, /deepfo/i, /deepf0/i, /deep fud/i, /AI editor/i, /3ditor/i, /3d1tor/i, /undressaitool/i, /undressaitools/i, /dexp/i, /nxxe/i, /nuxe/i, /nudx/i, /deepxu/i,  
	/fudeif/i, /deep xu/i, /xudl/i, /qudl/i, /qud!f/i, /qude!f/i, /deep qud/i, /ai dress/i, /ai edit vid/i, /ai softw/i, /nudeifi/i, /zudeif/i, /zudif/i, /deep zu/i, /deep zode/i, /zodlf/i,  
	/zode/i, /zodei/i, /zude/i, /zud1f/i, /zud!f/i, /budif/i, /budeif/i, /deep bude/i, /deep budi/i, /deebn/i, /deeb/i, /debbn/i, /debn/i, /noudif/i, /nuodif/i, /debb/i, /nuodef/i, /noudef/i,  
	/bud!f/i, /budlf/i, /budelf/i, /deep ud/i, /deepud/i, /deep kud/i, /deep xud/i, /deep dudi/i, /deep fui/i, /deep ful/i, /deep fuo/i, /deep fyu/i, /deepfy/i, /deepfiy/i, /deepfiu/i, /deepfe/i,
	/deep fi/i, /deep fou/i, /deep fuy/i, /fodif/i, /fod1f/i, /fod!f/i, /deep cu/i, /deep codi/i, /deep cud/i, /cudeif/i, /cudif/i, /deep foud/i, /deep fuod/i, /deepcod/i, /deepny/i, /deep ny/i, 
	/neep dy/i, /deep noy/i, /noydif/i, /nyodif/i, /nuydif/i, /nyudif/i, /gen1r/i, /off skirt/i, /off skir/i, /bude1f/i, /dodif/i, /without skirt/i, /with out skirt/i, /5quir/i, /plea5/i, /gen1t/i, 
	/deep fuid/i, /deep fod/i, /bude!lf/i, /nudief/i, /leak nude/i, /deepsom/i, /cloath/i, /skrt/i, /outflt/i, /promp nud/i, /nude people i/i, /nud some else p/i, /nud her i/i, /nud!n/i, /nud!ng/i, 
	/niidif/i, /3xpl1c/i, /c0nv3r/i, /deepnukif/i, /nut1f/i, /ntlf/i, /deepf4/i, /Art !ntel/i, /pant chan ph/i, /outf chan si/i, /thr04t/i, /depdud/i, /ghanc/i, /deepnuo/i, /n0dif/i, /deepe nu/i, 
	/deepdud/i, /Art explicit/i, /Xia Brookside/i, /Charlot Flai/i, /Ruby Soho/i, /Iyo sky/i, /Iyo Shirai/i, /Io Shirai/i, /dirt1/i, /n0 dress/i, /sklr/i, /clouth/i, /inpaint/i, /deepv/i, /fudif/i, 
	/zod!f/i,  /un stress/i, /nuub1f/i, /nuod3/i, /deep dudeif/i, /Shirai/i, /rule34/i, /windsor/i, /winds0r/i, /w1nds0r/i, /w1ndsor/i, /Adriana Rizzo/i, /Adriana/i, /Alba Fyre/i, /Kay Lee Ray/i, 
	/Alicia Taylor/i, /Alicia Warrington/i, /Warrington/i, /Arianna Grace/i, /Bianca Carelli/i, /Kanako Urai/i, /Space Galaxy Warrior Leona/i, /Asuka/i, /B-Fab/i, /Briana Brandy/i, /Davina Rose/i, 
	/Davina/i, /Bianca Belair/i, /Bianca/i, /Nicole/i, /Brie Bella/i, /Nikki Bella/i, /Nicole Garcia/i, /Brooke Hogan/i, /azm/i, /Melina Nava/i, /Melina Nava Pérez/i, /Melina Pérez/i, /Mariah May/i, 
	/Blake Monroe/i, /Candice LeRae/i, /Cathy Kelley/i, /Chantel Monroe/i, /Derrian Gobourne/i, /Chelsea Green/i, /Laurel Van Ness/i, /Megan Miller/i, /Fallon Henley/i, /Giulia/i, /Dakota Kai/i,
	/Emily Andzulis/i, /Izzi Dame/i, /Franki Carissa/i, /Jackie Redmond/i, /Jacy Jayne/i, /Avery Taylor/i, /Jade Cargill/i, /Jaida Parker/i, /Tiana Caffey/i, /jazz/i, /Kairi Sane/i, /Xtina Kay/i,
	/Jordynne Grace/i, /Tylynn Register/i, /Kairi Hoku/i, /Karmen Petrovic/i, /Monika Klisara/i, /Kelani Jordan/i, /Lea Mitchell/i, /Kendal Grey/i, /Kiana James/i, /Kayla Inlay/i, /Lainey Reid/i, 
	/Adelicious/i, /Sasha Banks/i, /Mercedes Moné/i, /Alex Gracia/i, /Aleah James/i, /Alicia Atout/i, /Alisha Edwards/i, /naomi/i, /Allysin Kay/i, /Alpha Female/i, /Jazzy Gabert/i, /Amber O'Neal/i, 
	/Amale Winchester/i, /Angel Hayze/i, /Angelica Risk/i, /Angelina Love/i, /Airica Demia/i, /anna jay/i, /Aria Bennett/i, /Arie Alexander/i, /Arkady Aura/i, /azumi/i, /Blair Davenport/i, /hyan/i, 
	/Ash By Elegance/i, /Ashley D'Amboise/i, /Bea Priestley/i, /Dana Brooke/i, /Ayako Hamada/i, /Billie Starkz/i, /Lillian Bridget/i, /Jessie Brooks/i, /Ava Storie/i, /Brandi Lauren/i, /Ivy Nile/i,
	/Camron Branae/i, /Ashley Blaze/i, /Amari Miller/i, /Camron Bra'Nae/i, /Camron Connors/i, /Carlee Bright/i, /Peyton Royce/i, /Cassie Lee/i, /Charlette Renegade/i, /Chigusa Nagayo/i, /Chik Tormenta/i, 
	/Christina Von Eerie/i, /Christyan Reid/i, /Christi Jaynes/i, /Crystal Carmichael/i, /Dalys la Caribean/i, /Dani Luna/i, /Vanessa Borne/i, /Danielle Kamela/i, /Sonya Deville/i, /Daria Berenato/i, 
	/Dasha Gonzalez/i, /Dasha Fuentes/i, /Delmi Exo/i, /Deonna Purrazzo/i, /Diamanté/i, /Priscilla Zuniga/i, /Britt Baker/i, /Dream Girl Ellie/i, /Virginia Ferry/i, /Cora Jade/i, /Elayna Black/i, 
	/Dump Matsumoto/i, /Ella Envy/i, /Dump Matsumoto/i, /Kaoru Matsumoto/i, /Emi Sakura/i, /Emi Motokawa/i, /Donna Rama/i, /Erica Leigh/i, /Estrellita/i, /Faby Apache/i, /Faye Jackson/i, /Lady Flammer/i, 
	/Big Booty Trudy/i, /Freya the Slaya/i, /Freya the Slayer/i, /Gabby LaSpisa/i, /Gabby Ortiz/i, /Gia Miller/i, /Georgia Lee Ann Milton/i, /Valentina Rossi/i, /Gianna Capri/i, /Adriana Gambino/i, 
	/Jenny Levy/i, /Gisele Shaw/i, /Harley Cameron/i, /Danni Ellexo/i, /Reyna Reyes/i, /Harley Hudson/i, /Jessicka Havok/i, /Jessica Havok/i, /Jessika Havok/i, /Heather Reckless/i, /Hikaru Shida/i,
        /holidead/i, /HollyHood Haley/i, /Indi Hartwell/i, /Samantha De Martin/i, /Courtney Stewart/i, /Isla Dawn/i, /Ivelisse/i, /Ivelisse Vélez/i, /Sofia Cortez/i, /Juliette/i, /Jada Stone/i, /Kellyanne/i,
	/Jade Chung/i, /Jade Gentile/i, /Jazmyn Nyx/i, /Rimi Yokota/i, /Jaguar Yokota/i, /Jamie Hayter/i, /Jessi Kamea/i, /Jessie Elaban/i, /Billie Kay/i, /Jessie McKay/i, /Jessy Ventura/i, /Jessy Queen/i, 
	/Jody Threat/i, /Julia Hart/i, /Yulisa Leon/i, /Julisa Leon/i, /Julissa Mexa/i, /Yulisa León/i, /Kacy Catanzaro/i, /Kali Armstrong/i, /Destinee Brown/i, /Karen Jarrett/i, /Elektra Lopez/i, 
	/Karissa Rivera/i, /Kamilla Kaine/i, /kamille/i, /kamille/i, /Summer Sorrell/i, /Katie Forbes/i, /Khloe Hurtz/i, /Kayla Braxton/i, /Kayla Rossi/i, /KC Spinelli/i, /Traci Spinelli/i, /Kylie Rae/i,
	/Nikita Naridian/i,  /Kenzie Paige/i, /Kenzie HEnry/i, /Paige Henry/i, /Kiera Hogan/i, /Killer Kelly/i, /KiLynn King/i, /Kris Statlander/i, /Kristen Stadtlander/i, /Kylie Paige/i, /Kylie Alexa/i, 
	/Briana Ray/i, /Katrina Cortez/i, /Catalina Garcia/i, /Catalina García/i, /La Hiedra/i, /La Rosa Negra/i, /Jamie Frost/i, /Leigh Laurel/i, /Kayden Carter/i, /Lacey Lane/i, /lady frost/i, /Mia Yim/i, 
	/Lady Shani/i, /Lash Legend/i, /Layla Diggs/i, /Breanna Covington/i, /Laynie Luck/i, /Amber Lynn/i, /Lei'D Tapa/i, /Leila Grey/i, /Cat Cardoza/i, /Lena Kross/i, /Marie Malenko/i, /Leva Bates/i,
	/Lexy Nair/i, /Leyla Hirsch/i, /Lilian Garcia/i, /Lizzy Evo/i, /Eliza Alexander/i, /Lizzy Styles/i, /Lola Yara/i, /Lola the Adventurer/i, /Lola Vice/i, /Valerie Loureda/i, /Lyra Valkyria/i, 
	/Aoife Valkyrie/i, /Lady Valkyrie/i, /xia-li/i, /xia li/i, /Maggie Lee/i, /Maggie Moore/i, /Maggie Minerva/i, /Maggie McKinney/i, /Mai Sakurai/i, /Maki Itoh/i, /Jakara Jackson/i, /Mara Sadè/i, 
	/Maria Manic/i, /Marina Shafir/i, /Marti Belle/i, /Masha Slamovich/i, /Masyn Holiday/i, /Darci Khan/i, /Maxxine Dupri/i, /Sofia Cromwell/i, /Utami Hayashishita/i, /mayvalentine/i, /mayaworld/i, 
	/may valentine/i, /maya-world/i, /maya world/i, /Mayu Iwatani/i, /mazzerati/i, /mazzerati/i, /McKenzie Mitchell/i, /Megan Bayne/i, /Lady Maravilla/i, /Meg Monroe/i, /Mercedes Martinez/i, 
	/Melissa Santos/i, /Melina Perez/i, /Mei Suruga/i, /Megumi Kudo/i, /Mickie James/i, /Alexis Laree/i, /Emilia McKenzie/i, /Millie McKenzie/i, /Mila Moore/i, /Kellie Morga/i, /Mima Shimoda/i,
        /Mirai Maiumi/i, /Miranda Alize/i, /Miranda Salinas/i, /Mina Shirakawa/i, /Samantha Starr/i, /Shayna Wayne/i, /Myla Grace/i, /Trinity Fatu/i, /Naomi Knight/i, /Natalia Markova/i, /Nevaeh/i, 
	/Ekaterina Bonnie/i, /Natalya Neidhart/i, /Jasmin Areebi/i, /Nikkita Lyons/i, /La Diablesa Rosa/i, /Nixon Newell/i, /Tegan Nox/i, /Nyla Rose/i, /Penelope Ford/i, /Persephone/i, /Rosemary/i,  
	/Hayley Montoya/i, /Penina Tuilaepa/i, /Piper Niven/i, /Priscilla Kelly/i, /Gigi Dolin/i, /Queen Aminata/i, /Rachael Ellering/i, /Rachael Evers/i, /Aliyah/i, /Nia Jax/i, /Lina Fanene/i, 
	/Nikki Blackheart/i, /Nikki Cross/i, /Nina Samuels/i, /Raquel Rodriguez/i, /Raquel González/i, /Reina González/i, /Victoria González/i, /Reina Dorada/i, /Reyna Dorada/i, /Renee Michelle/i,
	/Haze Jameson/i, /Renee Paquette/i, /Renee Young/i, /Rhea Ripley/i, /Demi Bennett/i, /Robyn Renegade/i, /Ronda Rousey/i, /Courtney Rush/i, /PJ Tyler/i, /Casey Maguire/i, /Roxanne Perez/i, 
	/Ruthie Jay/i, /Ryo Mizunami/i, /Aya Mizunami/i, /Ayane Mizumura/i, /Sadie Gibbs/i, /Sam Leterna/i, /Sam L'Eterna/i, /Samantha L'Eterna/i, /Santana Garrett/i, /Sarah Schreiber/i, /Paige/i, 
	/Saraya/i, /Sareee/i, /Sarray/i, /Sexy Star/i, /Savannah Evans/i, /Saya Kamitani/i, /Scarlett Bordeaux/i, /Elizabeth Chihaia/i, /Serena Deeb/i, /Session Moth Martina/i, /Sexy Dulce/i, 
	/Dulce Garcia/i, /Dulce Poly/i, /Alexandra Barrulas/i, /Shayna Baszler/i, /Shazza McKenzie/i, /Chantelle Bathory/i, /Shinobu Kandori/i, /Shotzi Blackheart/i, /Sirena Linton/i, /Tay Melo/i,
	/Dani Sekelsky/i, /Skylar Raye/i, /Sloane Jacobs/i, /Sloane Jacobs/i, /The Notorious MiMi/i, /Dani Sekelsky/i, /SoCal Val/i, /Valerie Wyndham/i, /Sol Ruca/i, /Steph De Lander/i, /Skylar Raye/i, 
	/Persia Pirotta/i, /Stephanie Vaquer/i, /Stori Denali/i, /Su Yung/i, /Susie/i, /Susan/i, /Sussy Love/i, /Tamina Snuka/i, /Tasha Steelz/i, /Tatevik The Gamer/i, /Tatevik Hunanyan/i, /Tatum Paxley/i, 
	/Tatyanna Dumas/i, /Tay Conti/i, /Taya Valkyrie/i, /Kira Foster/i, /Tessa Blanchard/i, /Thea Hail/i, /Thunder Rosa/i, /Tiffany Nieves/i, /Tiffany Stratton/i, /Tiffany/i, /Toni Storm/i, /Trish Adora/i, 
	/Trish Stratus/i, /Tyra Mae Steele/i, /Tamyra Mensah-Stock/i, /Valentynna Reis/i, /Valentina Feroz/i, /Vicious Vicki/i, /Vicki Venuto/i, /Victoria Andreola/i, /Vivacious Vicki/i, /Vicky Haskins/i, 
	/Amber Vixen/i, /Alicia Fox/i, /Victoria Yuzuki/i, /Vita VonStarr/i, /Wendy Choo/i, /Willow Nightingale/i, /Nightingale/i, /Wren Sinclair/i, /Madi Wrenkowski/i, /Zelina Rosita/i, /Yuka Sakazaki/i, 
	/Zayda Steel/i, /Zena Sterling/i, /Olena Sadovska/i, /Zoey Stark/i, /Lacey Ryan/i, /Zoë Sager/i, /Zelina Vega/i, /Rosita/i, /Victoria Crawford/i,
    ];


    // --- Dynamic Banned List from Chrome Storage ---
    // --- Dynamic Banned List from shared wrestling.js/TheSmackDownHotel storage ---
    const ytDynamicWrestlerFallbackUrls = [
        '/wrestlers/pj-vasa'
    ];
    const ytDynamicWrestlerSeenSources = new Set();

    function getExtensionStorageAPI() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) return chrome.storage;
            if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) return browser.storage;
        } catch (e) {}
        return null;
    }

    function normalizeWrestlerSlug(url) {
        try {
            const raw = String(url || '').trim().toLowerCase();
            if (!raw) return '';
            const clean = raw.split('?')[0].split('#')[0];
            const parts = clean.split('/').filter(Boolean);
            const slug = (parts[parts.length - 1] || '').replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
            return slug;
        } catch (e) {
            return '';
        }
    }

    function regexEscape(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function makeWrestlerRegexFromSlug(slug) {
        try {
            const cleanSlug = normalizeWrestlerSlug(slug);
            if (!cleanSlug || cleanSlug.length < 2) return null;

            const parts = cleanSlug.split('-').filter(Boolean);
            if (!parts.length) return null;

            // "pj-vasa" should match "PJ Vasa", "PJ-Vasa", "pj_vasa", and href slugs.
            const flexibleName = parts.map(regexEscape).join('[\\s._-]+');
            const compactName = regexEscape(parts.join(''));

            if (parts.length === 1) {
                return new RegExp('\\b' + regexEscape(parts[0]) + '\\b', 'i');
            }

            return new RegExp('(?:\\b' + flexibleName + '\\b|\\b' + compactName + '\\b|' + regexEscape(cleanSlug) + ')', 'i');
        } catch (e) {
            return null;
        }
    }

    function addDynamicWrestlerBans(urls, sourceLabel = 'storage') {
        try {
            if (!Array.isArray(urls) || urls.length === 0) return 0;

            let addedCount = 0;
            const localExclusions = new Set(['aj-lee', 'aj lee', 'becky-lynch', 'becky', 'katarina', 'jojo']);
            const existingSources = () => new Set(blockKeywords.map(rx => String(rx && rx.source || '')));

            let sourceSet = existingSources();

            urls.forEach(url => {
                const slug = normalizeWrestlerSlug(url);
                if (!slug || localExclusions.has(slug) || localExclusions.has(slug.replace(/-/g, ' '))) return;

                const rx = makeWrestlerRegexFromSlug(slug);
                if (!rx) return;

                const source = String(rx.source || '');
                if (!source || sourceSet.has(source) || ytDynamicWrestlerSeenSources.has(source)) return;

                blockKeywords.push(rx);
                ytDynamicWrestlerSeenSources.add(source);
                sourceSet.add(source);
                addedCount++;
            });

            if (addedCount > 0) {
                devLog(`Dynamically added ${addedCount} wrestler names from ${sourceLabel} to YouTube blocklist.`);
                enforceSanity();
                hideBannedVideoCards();
                scheduleYTSearchScan('dynamic-wrestling');
            }

            return addedCount;
        } catch (e) {
            return 0;
        }
    }

    function applyDynamicWrestlerBans() {
        try {
            addDynamicWrestlerBans(ytDynamicWrestlerFallbackUrls, 'fallback');

            const storage = getExtensionStorageAPI();
            if (!storage) return;

            const handleResult = (result) => {
                try {
                    const urls = result && Array.isArray(result.wrestling_women_urls) ? result.wrestling_women_urls : [];
                    addDynamicWrestlerBans([...ytDynamicWrestlerFallbackUrls, ...urls], 'shared storage');
                } catch (e) {}
            };

            const maybePromise = storage.local.get(['wrestling_women_urls'], handleResult);
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.then(handleResult).catch(() => {});
            }

            if (storage.onChanged && typeof storage.onChanged.addListener === 'function' && !window.__ytWrestlingStorageListenerInstalled) {
                window.__ytWrestlingStorageListenerInstalled = true;
                storage.onChanged.addListener((changes, areaName) => {
                    try {
                        if (areaName && areaName !== 'local') return;
                        if (!changes || !changes.wrestling_women_urls) return;
                        const nextUrls = Array.isArray(changes.wrestling_women_urls.newValue) ? changes.wrestling_women_urls.newValue : [];
                        addDynamicWrestlerBans([...ytDynamicWrestlerFallbackUrls, ...nextUrls], 'storage update');
                    } catch (e) {}
                });
            }
        } catch (e) {}
    }
    applyDynamicWrestlerBans();

    // List of keywords or phrases to allow
    const allowedWords = [
        /tutorial/i, /how to/i, /review/i, /setup/i, /guide/i, /educational/i, /coding/i, /programming/i, /course/i, /demo/i, /learning/i, /Sampsa/i, /Kurri/i, /iotech/i, /Jimms/i, /verkkokauppa/i, /learning/,
        /reddit/i, /OSRS/i, /RS/i, /RS3/i, /Old School/i, /RuneScape/i, /netflix/i, /pushpull/i, /facebook/i, /instagram/i, /Wiki/i, /pedia/i, /hikipedia/i, /fandom/i, /lehti/i, /bond/i, /bonds/i, /2007scape/,
        /vaihdetaan/i, /vaihdan/i, /vaihto/i, /vaihtoi/i, /vaihdossa/i, /vaihtaa/i, /paa/i, /jakohihna/i, /jakopää hihna/i, /jako hihna/i, /jako pää hihna/i, /jako päähihna/i, /\?/i, /\!/i, /opas/i, /oh/,
        /south park/i, /siivoton juttu/i, /poliisin poika/i, /poliisi/i, /poika/i, /Edge WWE/i, /Ravage/i, /Savage/i, /volksvagen/i, /GTA/i, /Grand Theft Auto/i, /videopeli/i, /videogame/i, /video game/i, /ra/,
    ];

    // === Safe Channels Whitelist ===
    // A whitelisted channel's OWN videos bypass title/keyword filtering everywhere they appear.
    // This does NOT whitelist the surrounding page: recommendations beside a whitelisted watch
    // page are still scanned normally and only inherit the whitelist if the recommended video
    // itself belongs to one of these channels.
    const safeChannelDefinitions = [
        { key: 'MavenKHuffman', paths: ['/@mavenkhuffman'], names: ['MavenKHuffman'] },
        { key: 'NerosCinema', paths: ['/@neroscinema'], names: ['NerosCinema'] },
        { key: 'MarkJindrakOfficial', paths: ['/@markjindrakofficial'], names: ['MarkJindrakOfficial'] },
        { key: 'Hardwareunboxed', paths: ['/@hardwareunboxed'], names: ['Hardwareunboxed', 'Hardware Unboxed'] },
        { key: 'WrestlingFlashback', paths: ['/@wrestlingflashback'], names: ['WrestlingFlashback', 'Wrestling Flashback'] },
        { key: 'whatever57010', paths: ['/@whatever57010'], names: ['whatever57010'] },
        { key: 'TGDonFPS', paths: ['/@tgdonfps'], names: ['TGDonFPS'] },
        { key: 'rSlash', paths: ['/@rslash'], names: ['rSlash'] },
        { key: 'LinusTechTips', paths: ['/@linustechtips'], names: ['LinusTechTips', 'Linus Tech Tips'] },
        { key: 'TH14PRODUCTIONS', paths: ['/@th14productions'], names: ['TH14PRODUCTIONS'] },
        { key: 'JANTSUU', paths: ['/@jantsuu'], names: ['JANTSUU'] },
        { key: 'OldSchoolRuneScape', paths: ['/oldschoolrunescape', '/@oldschoolrunescape'], names: ['OldSchoolRuneScape', 'Old School RuneScape'] },
        { key: 'GamersNexus', paths: ['/@gamersnexus'], names: ['GamersNexus', 'Gamers Nexus'] },
        { key: 'datastream_yt', paths: ['/@datastream_yt'], names: ['datastream_yt', 'datastream yt'] },
        { key: 'iotech', paths: ['/@iotech'], names: ['iotech'] },
        { key: 'chrissmoove', paths: ['/@chrissmoove'], names: ['chrissmoove', 'Chris Smoove'] },
        { key: 'Haiskales', paths: ['/@haiskales'], names: ['Haiskales'] },
        { key: 'ColonelloRS', paths: ['/@colonellors'], names: ['ColonelloRS'] },
        { key: 'LuumiJuhani', paths: ['/@luumijuhani'], names: ['LuumiJuhani', 'Luumi Juhani'] },
        { key: 'OneOfTheMillionss', paths: ['/@oneofthemillionss'], names: ['OneOfTheMillionss'] },
        { key: 'TheGamingDefinition', paths: ['/@thegamingdefinition'], names: ['TheGamingDefinition', 'The Gaming Definition'] },
        { key: 'UnpragmaticCovers', paths: ['/@unpragmaticcovers'], names: ['UnpragmaticCovers', 'Unpragmatic Covers'] },
        { key: 'Jayztwocents', paths: ['/@jayztwocents'], names: ['Jayztwocents', 'JayzTwoCents'] },
        { key: 'CVVCLIPS', paths: ['/@cvvclips'], names: ['CVVCLIPS', 'CVV Clips'] },
        { key: 'TheXclusiveAce', paths: ['/@thexclusiveace'], names: ['TheXclusiveAce', 'The Xclusive Ace'] },
        { key: 'TapOutCorner', paths: ['/@tapoutcorner'], names: ['TapOutCorner', 'Tap Out Corner'] },
        { key: 'wrestlingbest1', paths: ['/@wrestlingbest1'], names: ['wrestlingbest1'] },
        { key: 'wrestlingspremier', paths: ['/@wrestlingspremier'], names: ['wrestlingspremier'] },
        { key: 'TheSandyRavage', paths: ['/@thesandyravage'], names: ['TheSandyRavage', 'The Sandy Ravage'] },
        { key: 'ORTONISGOD', paths: ['/@ortonisgod'], names: ['ORTONISGOD'] },
        { key: 'gaminginvestigators', paths: ['/@gaminginvestigators'], names: ['gaminginvestigators', 'Gaming Investigators'] },
        { key: 'TheManlnBlack', paths: ['/@themanlnblack'], names: ['TheManlnBlack'] },
        { key: 'TestingGames', paths: ['/@testinggames'], names: ['TestingGames', 'Testing Games'] },
        { key: 'YannVids', paths: ['/@yannvids'], names: ['YannVids'] },
        { key: 'edbassmaster', paths: ['/@edbassmaster'], names: ['edbassmaster', 'Ed Bassmaster'] },
        { key: 'OzerecYT', paths: ['/@ozerecyt'], names: ['OzerecYT'] },
        { key: 'NVIDIA', paths: ['/@nvidia'], names: ['NVIDIA'] },
        { key: 'AMD', paths: ['/user/amd', '/@amd'], names: ['AMD'] },
        { key: 'Intel', paths: ['/@intel'], names: ['Intel'] },
        { key: 'PCBuilderChannel', paths: ['/@pcbuilderchannel'], names: ['PCBuilderChannel', 'PC Builder'] },
        { key: 'BenBuja', paths: ['/@benbuja'], names: ['BenBuja', 'Ben Buja'] },
        { key: 'BudgetBuildsOfficial', paths: ['/@budgetbuildsofficial'], names: ['BudgetBuildsOfficial', 'Budget Builds Official'] },
        { key: 'Sabaton', paths: ['/@sabaton'], names: ['Sabaton'] },
        { key: 'MooresLawIsDead', paths: ['/@mooreslawisdead'], names: ["Moore's Law Is Dead", 'MooresLawIsDead'] },
        { key: 'HealthyGamerGG', paths: ['/@healthygamergg'], names: ['HealthyGamerGG', 'Healthy Gamer GG'] },
        { key: 'GregSalazar', paths: ['/@gregsalazar'], names: ['GregSalazar', 'Greg Salazar'] },
        { key: 'IcebergTech', paths: ['/@icebergtech'], names: ['IcebergTech', 'Iceberg Tech'] },
        { key: 'NTtoNow', paths: ['/@nttonow'], names: ['NTtoNow'] },
        { key: 'SomeOrdinaryGamers', paths: ['/@someordinarygamers'], names: ['SomeOrdinaryGamers', 'Some Ordinary Gamers'] }
    ];

    function normalizeYTChannelPath(value) {
        try {
            const raw = String(value || '').trim();
            if (!raw) return '';

            let pathname = raw;
            if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
                const url = new URL(raw.startsWith('//') ? ('https:' + raw) : raw);
                if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return '';
                pathname = url.pathname || '';
            } else if (!raw.startsWith('/')) {
                const url = new URL(raw, window.location.origin);
                if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return '';
                pathname = url.pathname || '';
            }

            pathname = pathname.split('?')[0].split('#')[0];
            try { pathname = decodeURIComponent(pathname); } catch (e) {}
            pathname = pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
            return (pathname || '/').toLowerCase();
        } catch (e) {
            return '';
        }
    }

    function normalizeYTChannelName(value) {
        try {
            return String(value || '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/^@+/, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '')
                .trim();
        } catch (e) {
            return '';
        }
    }

    const safeChannelPathToKey = new Map();
    const safeChannelNameToKey = new Map();

    safeChannelDefinitions.forEach(entry => {
        (entry.paths || []).forEach(path => {
            const normalized = normalizeYTChannelPath(path);
            if (normalized) safeChannelPathToKey.set(normalized, entry.key);
        });
        (entry.names || []).forEach(name => {
            const normalized = normalizeYTChannelName(name);
            if (normalized) safeChannelNameToKey.set(normalized, entry.key);
        });
    });

    function getSafeChannelKeyFromPath(value) {
        try {
            const path = normalizeYTChannelPath(value);
            if (!path) return '';

            for (const [basePath, key] of safeChannelPathToKey.entries()) {
                if (path === basePath || path.startsWith(basePath + '/')) return key;
            }
        } catch (e) {}
        return '';
    }

    function isLikelyYTChannelPath(value) {
        const path = normalizeYTChannelPath(value);
        if (!path) return false;
        if (getSafeChannelKeyFromPath(path)) return true;
        return /^\/(?:@[^/]+|channel\/[^/]+|user\/[^/]+|c\/[^/]+)(?:\/|$)/i.test(path);
    }

    function getSafeChannelKeyFromLink(link) {
        try {
            if (!link) return '';
            const href = link.href || link.getAttribute?.('href') || '';
            const pathKey = getSafeChannelKeyFromPath(href);
            if (pathKey) return pathKey;

            // If YouTube exposes a /channel/UC... URL instead of the handle, verify the
            // DISPLAYED channel name, but only on a link that is actually channel-shaped.
            if (!isLikelyYTChannelPath(href)) return '';
            const nameCandidates = [
                link.textContent || '',
                link.getAttribute?.('aria-label') || '',
                link.getAttribute?.('title') || ''
            ];
            for (const value of nameCandidates) {
                const key = safeChannelNameToKey.get(normalizeYTChannelName(value));
                if (key) return key;
            }
        } catch (e) {}
        return '';
    }

    function getSafeChannelKeyFromRoot(root) {
        try {
            if (!root) return '';
            if (root.matches?.('a[href]')) {
                const direct = getSafeChannelKeyFromLink(root);
                if (direct) return direct;
            }

            const links = root.querySelectorAll?.('a[href]') || [];
            for (const link of links) {
                const key = getSafeChannelKeyFromLink(link);
                if (key) return key;
            }
        } catch (e) {}
        return '';
    }

    function getCurrentWatchChannelState() {
        try {
            if (!window.location.pathname.startsWith('/watch')) {
                return { resolved: false, safe: false, key: '' };
            }

            const scopes = document.querySelectorAll([
                'ytd-video-owner-renderer',
                'ytm-slim-owner-renderer',
                'ytm-video-owner-renderer',
                'ytd-watch-metadata #owner',
                'ytm-watch-metadata #owner'
            ].join(', '));

            let sawChannelLink = false;
            for (const scope of scopes) {
                const links = scope.querySelectorAll?.('a[href]') || [];
                for (const link of links) {
                    const href = link.href || link.getAttribute?.('href') || '';
                    if (!isLikelyYTChannelPath(href)) continue;
                    sawChannelLink = true;
                    const key = getSafeChannelKeyFromLink(link);
                    if (key) return { resolved: true, safe: true, key };
                }
            }

            return { resolved: sawChannelLink, safe: false, key: '' };
        } catch (e) {
            return { resolved: false, safe: false, key: '' };
        }
    }

    function isCurrentSafeChannelPage() {
        try {
            if (window.location.pathname.startsWith('/watch')) return false;
            return !!getSafeChannelKeyFromPath(window.location.pathname);
        } catch (e) {
            return false;
        }
    }

    function isVideoCardFromSafeChannel(target) {
        try {
            const directKey = getSafeChannelKeyFromRoot(target);
            if (directKey) return true;

            // Channel video grids often omit the channel link because every card obviously belongs
            // to the page owner. Only apply that inheritance on an actual whitelisted CHANNEL page,
            // never on /watch, so side recommendations remain independently filterable.
            if (isCurrentSafeChannelPage()) {
                const related = target?.closest?.([
                    'ytd-watch-next-secondary-results-renderer',
                    '#related',
                    'ytm-item-section-renderer[section-identifier="related-items"]'
                ].join(', '));
                if (!related) return true;
            }
        } catch (e) {}
        return false;
    }

    const adblockWarningPatterns = [
        /mainostenestoa ei sallita/i,
        /mainostenesto/i,
        /ad.?block/i,
        /adblocker/i,
        /turn off.*ad.?block/i,
        /disable.*ad.?block/i,
        /ads blocked/i,
        /please disable/i,
        /whitelist.*site/i,
        /allow.*ads/i,
        /enable.*ads/i,
        /advertisement.*blocked/i,
        /support.*creator/i,
        /youtube premium/i,
        /try youtube premium/i,
        /get youtube premium/i
    ];

    const redirectUrl = "https://www.youtube.com/";

    const videoContainers = [
        "ytd-rich-item-renderer",             
        "ytd-video-renderer",                 
        "ytd-grid-video-renderer",            
        "ytd-compact-video-renderer",         
        "ytd-compact-autoplay-renderer",      
        "ytd-compact-radio-renderer",         
        "ytd-playlist-video-renderer",        
        "ytd-playlist-panel-video-renderer",  
        "ytm-rich-item-renderer",             
        "ytm-video-renderer",
        "ytm-video-with-context-renderer",
        "ytm-compact-video-renderer",
        "ytm-compact-radio-renderer",
        "ytm-compact-autoplay-renderer",
        // BF25_4_0_YT_WATCH_LOCKUP_HIDE_PATCH: modern YouTube video-page recommendation cards.
        "yt-lockup-view-model",
        "ytm-lockup-view-model",
        ".ytLockupViewModelHost",
        ".ytLockupViewModelWrapper",
        "yt-related-chip-cloud-renderer + ytd-item-section-renderer yt-lockup-view-model",
        "ytd-watch-next-secondary-results-renderer yt-lockup-view-model",
        "ytd-watch-next-secondary-results-renderer .ytLockupViewModelHost",
        "ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer",
        "ytd-watch-next-secondary-results-renderer ytd-compact-radio-renderer",
        "ytd-watch-next-secondary-results-renderer ytd-compact-playlist-renderer",
        "ytd-item-section-renderer ytd-compact-video-renderer",
        "ytd-item-section-renderer yt-lockup-view-model",
        "ytd-rich-grid-media",
        "ytd-rich-grid-slim-media",
        "ytd-reel-item-renderer",
        "ytm-reel-item-renderer",
        "ytd-miniplayer"                      
    ];

    const ytVideoTitleSelectors = [
        'a#video-title',
        '#video-title',
        '#video-title-link',
        'h3 a[href*="/watch"]',
        'a[href*="/watch"][aria-label]',
        'a[href*="/watch"][title]',
        '.ytLockupMetadataViewModelTitle',
        '.ytLockupMetadataViewModelHeadingReset',
        'yt-lockup-view-model .ytAttributedStringHost',
        'ytm-lockup-view-model .ytAttributedStringHost',
        '.ytLockupViewModelHost .ytAttributedStringHost',
        '.ytLockupViewModelWrapper .ytAttributedStringHost',
        'ytd-video-renderer .ytAttributedStringHost',
        'ytd-compact-video-renderer .ytAttributedStringHost',
        'ytd-compact-autoplay-renderer .ytAttributedStringHost',
        'ytd-compact-radio-renderer .ytAttributedStringHost',
        'ytd-compact-playlist-renderer .ytAttributedStringHost',
        'ytd-rich-item-renderer .ytAttributedStringHost',
        'ytd-rich-grid-media .ytAttributedStringHost',
        'ytd-playlist-video-renderer .ytAttributedStringHost',
        'ytd-playlist-panel-video-renderer .ytAttributedStringHost',
        'ytd-watch-next-secondary-results-renderer .ytAttributedStringHost',
        '.yt-lockup-metadata-view-model__title',
        '.yt-lockup-metadata-view-model__heading-reset',
        'yt-formatted-string[title]',
        'yt-formatted-string#video-title'
    ];

    const ytVideoCardSelector = videoContainers.join(', ');
    const ytVideoTitleSelector = ytVideoTitleSelectors.join(', ');

    function injectYTCardHideCSS() {
        try {
            if (document.documentElement.querySelector('style[data-ytclean-card-hide-css]')) return;
            const style = document.createElement('style');
            style.type = 'text/css';
            style.setAttribute('data-ytclean-card-hide-css', '');
            style.textContent = `
                .ytclean-card-banned,
                [data-ytcleaner-banned-card="1"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    content-visibility: hidden !important;
                }

                /* v35: YouTube watch/search nuisance nudge and Shorts chip cleanup. */
                ytd-feed-nudge-renderer,
                ytd-item-section-renderer:has(> ytd-feed-nudge-renderer),
                ytd-item-section-renderer:has(ytd-feed-nudge-renderer [aria-label*="Kaipaatko osuvampia suosituksia" i]),
                ytd-feed-nudge-renderer:has([aria-label*="Kaipaatko osuvampia suosituksia" i]),
                ytd-feed-nudge-renderer:has([aria-label*="more relevant recommendations" i]),
                .ytclean-hidden-ui,
                [data-ytcleaner-hidden-ui="1"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    content-visibility: hidden !important;
                }

                yt-chip-cloud-chip-renderer.ytclean-shorts-chip-hidden,
                ytm-chip-cloud-chip-renderer.ytclean-shorts-chip-hidden,
                [data-ytcleaner-shorts-chip="1"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    width: 0 !important;
                    min-width: 0 !important;
                    max-width: 0 !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    max-height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    content-visibility: hidden !important;
                }

                /* v35: Search result softgate. Newly rendered search video cards stay hidden
                   until hideBannedVideoCards() either bans them or marks them approved. */
                html.ytclean-search-softgate ytd-search ytd-video-renderer:not(.ytclean-card-approved):not(.ytclean-card-banned):not([data-ytcleaner-approved-card="1"]):not([data-ytcleaner-banned-card="1"]),
                html.ytclean-search-softgate ytd-search yt-lockup-view-model:not(.ytclean-card-approved):not(.ytclean-card-banned):not([data-ytcleaner-approved-card="1"]):not([data-ytcleaner-banned-card="1"]),
                html.ytclean-search-softgate ytd-search .ytLockupViewModelHost:not(.ytclean-card-approved):not(.ytclean-card-banned):not([data-ytcleaner-approved-card="1"]):not([data-ytcleaner-banned-card="1"]),
                html.ytclean-search-softgate ytd-search .ytLockupViewModelWrapper:not(.ytclean-card-approved):not(.ytclean-card-banned):not([data-ytcleaner-approved-card="1"]):not([data-ytcleaner-banned-card="1"]),
                html.ytclean-search-softgate ytd-search ytd-reel-shelf-renderer:not(.ytclean-card-approved):not(.ytclean-card-banned):not([data-ytcleaner-approved-card="1"]):not([data-ytcleaner-banned-card="1"]),
                html.ytclean-search-softgate ytd-search ytd-rich-shelf-renderer:not(.ytclean-card-approved):not(.ytclean-card-banned):not([data-ytcleaner-approved-card="1"]):not([data-ytcleaner-banned-card="1"]) {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    content-visibility: hidden !important;
                    transition: none !important;
                    animation: none !important;
                }

                html.ytclean-search-softgate .ytclean-card-approved,
                html.ytclean-search-softgate [data-ytcleaner-approved-card="1"] {
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                    content-visibility: visible !important;
                }

                #ytclean-search-scan-overlay {
                    position: fixed !important;
                    inset: 0 !important;
                    z-index: 2147483646 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: var(--yt-spec-base-background, #fff) !important;
                    color: var(--yt-spec-text-primary, #0f0f0f) !important;
                    font: 500 16px/1.35 Arial, sans-serif !important;
                    pointer-events: all !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                    transition: none !important;
                }

                html:not(.ytclean-search-scanning) #ytclean-search-scan-overlay,
                html:not(.ytclean-search-softgate) #ytclean-search-scan-overlay {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        } catch (e) {}
    }
    injectYTCardHideCSS();

    function isYTSearchResultsPage() {
        try {
            return location.pathname === '/results' && new URLSearchParams(location.search || '').has('search_query');
        } catch (e) {
            return false;
        }
    }

    // === PROTECTED YOUTUBE TEXT ZONES ===
    // Comments and real watch-page descriptions are user-facing text, not video cards.
    // They must never be scanned/collapsed by the card blocker. Search-result descriptions are still
    // scanned because they live inside actual search result cards.
    function isYTWatchPage() {
        try {
            return location.pathname.startsWith('/watch');
        } catch (e) {
            return false;
        }
    }

    function isInsideYTComment(node) {
        try {
            return !!(node && node.closest && node.closest([
                'ytd-comments',
                'ytd-comment-thread-renderer',
                'ytd-comment-view-model',
                'ytd-comment-renderer',
                'ytd-comment-replies-renderer',
                'ytd-comment-reply-renderer',
                'ytd-comment-simplebox-renderer',
                'ytd-expander[comment]',
                'ytd-comment-engagement-bar'
            ].join(', ')));
        } catch (e) {
            return false;
        }
    }

    function isInsideYTWatchDescription(node) {
        try {
            if (!isYTWatchPage() || isYTSearchResultsPage()) return false;
            return !!(node && node.closest && node.closest([
                'ytd-watch-metadata #description',
                'ytd-watch-metadata #description-inline-expander',
                'ytd-watch-metadata ytd-text-inline-expander',
                'ytd-watch-metadata ytd-structured-description-content-renderer',
                'ytd-watch-metadata ytd-expandable-metadata-renderer',
                'ytd-watch-metadata #structured-description',
                'ytd-watch-metadata #video-summary',
                'ytd-watch-metadata #snippet',
                'ytd-watch-metadata #expanded'
            ].join(', ')));
        } catch (e) {
            return false;
        }
    }

    function isYTProtectedTextZone(node) {
        return isInsideYTComment(node) || isInsideYTWatchDescription(node);
    }

    function updateYTSearchSoftGateClass() {
        try {
            if (!document.documentElement) return false;
            const active = isYTSearchResultsPage();
            document.documentElement.classList.toggle('ytclean-search-softgate', active);
            if (!active) document.documentElement.classList.remove('ytclean-search-scanning');
            return active;
        } catch (e) {
            return false;
        }
    }

    function ensureYTSearchOverlay() {
        try {
            if (!document.documentElement) return null;
            let overlay = document.getElementById('ytclean-search-scan-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'ytclean-search-scan-overlay';
                overlay.setAttribute('aria-hidden', 'true');
                overlay.textContent = 'Loading…';
                document.documentElement.appendChild(overlay);
            }
            return overlay;
        } catch (e) {
            return null;
        }
    }

    function setYTSearchScanning(active) {
        try {
            const canGate = updateYTSearchSoftGateClass();
            if (!document.documentElement || !canGate) return;
            if (active) ensureYTSearchOverlay();
            document.documentElement.classList.toggle('ytclean-search-scanning', !!active);
        } catch (e) {}
    }

    function collapseYTHiddenUI(el, removeNode = false) {
        try {
            if (!el || !el.style) return;
            el.classList?.add('ytclean-hidden-ui');
            el.setAttribute?.('data-ytcleaner-hidden-ui', '1');
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.style.setProperty('width', '0', 'important');
            el.style.setProperty('height', '0', 'important');
            el.style.setProperty('margin', '0', 'important');
            el.style.setProperty('padding', '0', 'important');
            el.style.setProperty('overflow', 'hidden', 'important');
            el.style.setProperty('content-visibility', 'hidden', 'important');
            if (removeNode && el.parentNode) {
                try { el.remove(); } catch (e) {}
            }
        } catch (e) {}
    }

    function hideRecommendationNudges() {
        try {
            const candidates = document.querySelectorAll([
                'ytd-feed-nudge-renderer',
                'ytd-feed-nudge-renderer [aria-label*="Kaipaatko osuvampia suosituksia" i]',
                'ytd-feed-nudge-renderer [aria-label*="more relevant recommendations" i]',
                'ytd-feed-nudge-renderer [aria-label*="Pidä historia pois päältä" i]',
                'ytd-feed-nudge-renderer [aria-label*="Laita historia päälle" i]'
            ].join(', '));

            candidates.forEach(node => {
                try {
                    const nudge = node.closest?.('ytd-feed-nudge-renderer') || node;
                    collapseYTHiddenUI(nudge, true);
                } catch (e) {}
            });
        } catch (e) {}
    }

    function hideSearchShortsChips() {
        try {
            const chips = document.querySelectorAll([
                'yt-chip-cloud-chip-renderer',
                'ytm-chip-cloud-chip-renderer',
                'yt-chip-cloud-chip-renderer button[role="tab"]',
                'ytm-chip-cloud-chip-renderer button[role="tab"]'
            ].join(', '));

            chips.forEach(chip => {
                try {
                    const text = String(chip.textContent || '').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
                    if (text !== 'shorts') return;
                    const target = chip.closest?.('yt-chip-cloud-chip-renderer, ytm-chip-cloud-chip-renderer') || chip;
                    target.classList?.add('ytclean-shorts-chip-hidden');
                    target.setAttribute?.('data-ytcleaner-shorts-chip', '1');
                    collapseYTHiddenUI(target, false);
                } catch (e) {}
            });
        } catch (e) {}
    }

    function hideYouTubeNudgesAndShortsChips() {
        hideRecommendationNudges();
        hideSearchShortsChips();
    }

    let __ytSearchScanTimeout = null;
    let __ytSearchScanReleaseTimeout = null;
    let __ytSearchScanNeedsOverlay = false;

    function shouldYTSearchScanUseOverlay(reason = '') {
        const r = String(reason || '').toLowerCase();
        // Do NOT flash the full-page overlay for routine interval/mutation scans.
        // The CSS softgate already hides only unapproved cards, so background card rescans can be silent.
        return !(
            r === 'interval' ||
            r === 'mutation-cards' ||
            r === 'visibility' ||
            r === 'dynamic-wrestling'
        );
    }

    function releaseYTSearchOverlaySoon(delay = 160) {
        try {
            if (__ytSearchScanReleaseTimeout) {
                try { clearTimeout(__ytSearchScanReleaseTimeout); } catch (e) {}
                __ytTimers.timeouts.delete(__ytSearchScanReleaseTimeout);
                __ytSearchScanReleaseTimeout = null;
            }
            __ytSearchScanReleaseTimeout = addTimeout(() => {
                __ytSearchScanReleaseTimeout = null;
                hideYouTubeNudgesAndShortsChips();
                hideBannedVideoCards();
                setYTSearchScanning(false);
            }, delay);
        } catch (e) {}
    }

    function scheduleYTSearchScan(reason = '') {
        try {
            const active = updateYTSearchSoftGateClass();
            if (!active) return;

            const useOverlay = shouldYTSearchScanUseOverlay(reason);
            if (useOverlay) {
                __ytSearchScanNeedsOverlay = true;
                setYTSearchScanning(true);
            }

            if (__ytSearchScanTimeout) return;

            __ytSearchScanTimeout = addTimeout(() => {
                __ytSearchScanTimeout = null;
                const releaseOverlay = __ytSearchScanNeedsOverlay;
                __ytSearchScanNeedsOverlay = false;

                hideYouTubeNudgesAndShortsChips();
                hideBannedVideoCards();

                if (releaseOverlay) {
                    releaseYTSearchOverlaySoon(160);
                }
            }, 45);
        } catch (e) {}
    }

    updateYTSearchSoftGateClass();

    const adblockPopupSelectors = [
        "ytd-popup-container",
        "tp-yt-paper-dialog",
        "ytd-enforcement-message-view-model",
        "ytd-message-renderer",
        "yt-confirm-dialog-renderer"
    ];

    function removeAdblockPopups() {
        try {
            let removedCount = 0;
            
            adblockPopupSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent?.toLowerCase() || "";
                    if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                        devLog(`Removing adblock popup: ${selector}`);
                        el.style.display = "none";
                        el.style.visibility = "hidden";
                        removedCount++;
                        
                        const backdrop = el.closest('[role="presentation"]') || 
                                       el.closest('.scrim') || 
                                       el.closest('[class*="backdrop"]');
                        if (backdrop) {
                            backdrop.style.display = "none";
                        }
                    }
                });
            });

            const dialogs = document.querySelectorAll('[role="dialog"]');
            dialogs.forEach(dialog => {
                const text = dialog.textContent?.toLowerCase() || "";
                if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                    devLog('Hiding adblock warning dialog');
                    dialog.style.display = "none";
                    dialog.style.visibility = "hidden";
                    removedCount++;
                    
                    const parent = dialog.parentElement;
                    if (parent && (parent.classList.contains('scrim') || 
                                  parent.hasAttribute('aria-modal') ||
                                  parent.getAttribute('role') === 'presentation')) {
                        parent.style.display = "none";
                    }
                }
            });

            const body = document.body;
            if (body && body.style.overflow === 'hidden') {
                const visibleDialogs = document.querySelectorAll('[role="dialog"]:not([style*="display: none"])');
                if (visibleDialogs.length === 0) {
                    body.style.overflow = '';
                }
            }
            
            if (removedCount > 0) {
                devLog(`Removed ${removedCount} adblock popups`);
            }
        } catch (err) {}
    }

    // === THE ULTIMATE SANITY ENFORCER ===
    // Strictly scans decoded search queries and the CURRENT watch video's own metadata.
    // Safe-channel immunity is based on the watch-owner channel link, never title text.
    function enforceSanity() {
        try {
            if (isRedirecting) return;

            let textToScan = '';
            const isWatch = window.location.pathname.startsWith('/watch');

            // 1. Get query directly from URL parameters (automatically handles special chars, +, %20)
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('search_query');
            if (query) {
                textToScan += ' ' + query;
            }

            // 2. On watch pages, resolve the actual owner BEFORE judging the title.
            // YouTube is an SPA and the title can update before the owner renderer arrives. Redirecting
            // during that gap would defeat the whitelist, so unresolved watch pages simply retry on the
            // next mutation/navigation/interval pass.
            if (isWatch) {
                const ownerState = getCurrentWatchChannelState();
                if (ownerState.safe) {
                    devLog(`Whitelisted channel video allowed: ${ownerState.key}`);
                    return;
                }
                if (!ownerState.resolved) return;

                textToScan += ' ' + (document.title || '');
            }

            textToScan = textToScan.toLowerCase().trim();
            if (!textToScan) return;

            // Generic contextual allows preserve the existing behavior for non-whitelisted content.
            if (allowedWords.some(aw => aw.test(textToScan))) return;

            // Check Blocklist
            if (blockKeywords.some(kw => kw.test(textToScan))) {
                devLog(`Banned content detected! Redirecting out...`);
                isRedirecting = true;
                window.location.replace(redirectUrl);
            }
        } catch (err) {
            console.log('Error enforcing sanity: ' + err.message);
        }
    }

    // Hide Banned Video Cards (Playlists, Suggestions, Feeds)
    // BF25_4_0_YT_WATCH_LOCKUP_HIDE_PATCH:
    // YouTube's newer video-page sidebar cards use yt-lockup-view-model / ytLockupViewModelHost.
    // Those can hide banned titles in aria-label/title attributes even when plain text is thin.
    function getVideoCardSignal(el) {
        try {
            if (!el || isYTProtectedTextZone(el)) return '';
            const chunks = [];
            const push = (value) => {
                if (value !== null && value !== undefined && value !== '') chunks.push(String(value));
            };

            const pushNode = (node) => {
                try {
                    if (!node || isYTProtectedTextZone(node)) return;
                    push(node.textContent || '');
                    push(node.innerText || '');
                    push(node.getAttribute?.('aria-label') || '');
                    push(node.getAttribute?.('title') || '');
                    push(node.getAttribute?.('alt') || '');
                    push(node.getAttribute?.('data-title') || '');
                    push(node.getAttribute?.('data-tooltip-text') || '');
                    push(node.getAttribute?.('aria-description') || '');
                    push(node.getAttribute?.('data-content') || '');
                    push(node.href || node.getAttribute?.('href') || '');
                } catch (e) {}
            };

            pushNode(el);

            const signalNodes = el.querySelectorAll?.([
                'a[href]',
                'a[aria-label]',
                'a[title]',
                'h3',
                'h4',
                '.ytLockupMetadataViewModelTitle',
                '.ytLockupMetadataViewModelHeadingReset',
                '.ytAttributedStringHost',
                '.yt-lockup-metadata-view-model__title',
                '.yt-lockup-metadata-view-model__heading-reset',
                '#video-title',
                '#video-title-link',
                'yt-formatted-string',
                'span[role="text"]',
                '[aria-label]',
                '[title]',
                '[alt]'
            ].join(','));

            let count = 0;
            signalNodes?.forEach(node => {
                if (count++ > 120) return;
                if (isYTProtectedTextZone(node)) return;
                pushNode(node);
            });

            return chunks
                .join(' ')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/\s+/g, ' ')
                .toLowerCase()
                .trim();
        } catch (e) {
            return String(el?.textContent || '').toLowerCase();
        }
    }

    function getVideoCardHideTarget(el) {
        try {
            if (!el || !el.closest || isYTProtectedTextZone(el)) return null;
            const target = el.closest([
                'yt-lockup-view-model',
                'ytm-lockup-view-model',
                'ytd-compact-video-renderer',
                'ytd-compact-autoplay-renderer',
                'ytd-compact-radio-renderer',
                'ytd-compact-playlist-renderer',
                'ytd-video-renderer',
                'ytd-rich-item-renderer',
                'ytd-rich-grid-media',
                'ytd-rich-grid-slim-media',
                'ytd-grid-video-renderer',
                'ytd-playlist-video-renderer',
                'ytd-playlist-panel-video-renderer',
                'ytm-video-renderer',
                'ytm-video-with-context-renderer',
                'ytm-compact-video-renderer',
                'ytm-rich-item-renderer',
                'ytd-reel-item-renderer',
                'ytm-reel-item-renderer',
                '.ytLockupViewModelWrapper',
                '.ytLockupViewModelHost',
                '[class*="ytLockupViewModel"]'
            ].join(', '));
            if (!target || isYTProtectedTextZone(target)) return null;
            return target;
        } catch (e) {
            return null;
        }
    }

    function approveVideoCardTarget(target) {
        try {
            if (!target || !target.style || isYTProtectedTextZone(target)) return;
            if (target.classList?.contains('ytclean-card-banned') || target.getAttribute?.('data-ytcleaner-banned-card') === '1') return;
            target.classList?.add('ytclean-card-approved');
            target.setAttribute?.('data-ytcleaner-approved-card', '1');
            target.style.removeProperty('visibility');
            target.style.removeProperty('opacity');
            target.style.removeProperty('pointer-events');
            target.style.removeProperty('content-visibility');
        } catch (e) {}
    }

    function restorePreviouslyBannedVideoCard(target) {
        try {
            if (!target || !target.style) return;
            const wasOurs = target.classList?.contains('ytclean-card-banned') || target.getAttribute?.('data-ytcleaner-banned-card') === '1';
            if (!wasOurs) return;

            target.classList?.remove('ytclean-card-banned');
            target.removeAttribute?.('data-ytcleaner-banned-card');
            [
                'display', 'visibility', 'opacity', 'pointer-events', 'height', 'min-height',
                'max-height', 'margin', 'padding', 'overflow', 'content-visibility'
            ].forEach(prop => target.style.removeProperty(prop));
        } catch (e) {}
    }

    function collapseBannedVideoCard(target) {
        try {
            if (!target || !target.style || isYTProtectedTextZone(target)) return;
            target.classList?.remove('ytclean-card-approved');
            target.removeAttribute?.('data-ytcleaner-approved-card');
            target.classList?.add('ytclean-card-banned');
            target.setAttribute?.('data-ytcleaner-banned-card', '1');
            target.style.setProperty("display", "none", "important");
            target.style.setProperty("visibility", "hidden", "important");
            target.style.setProperty("opacity", "0", "important");
            target.style.setProperty("pointer-events", "none", "important");
            target.style.setProperty("height", "0", "important");
            target.style.setProperty("min-height", "0", "important");
            target.style.setProperty("max-height", "0", "important");
            target.style.setProperty("margin", "0", "important");
            target.style.setProperty("padding", "0", "important");
            target.style.setProperty("overflow", "hidden", "important");
            target.style.setProperty("content-visibility", "hidden", "important");
        } catch (e) {}
    }

    function collectVideoCardCandidates() {
        const candidates = [];
        const add = (el) => {
            if (el && !isYTProtectedTextZone(el)) candidates.push(el);
        };

        try {
            document.querySelectorAll(ytVideoCardSelector).forEach(add);
        } catch (e) {}

        try {
            document.querySelectorAll(ytVideoTitleSelector).forEach(node => {
                add(getVideoCardHideTarget(node));
            });
        } catch (e) {}

        return candidates;
    }

    function hideBannedVideoCards() {
        try {
            injectYTCardHideCSS();

            const elements = collectVideoCardCandidates();
            let hiddenCount = 0;
            const seen = new WeakSet();

            elements.forEach(el => {
                const target = getVideoCardHideTarget(el);
                if (!target || seen.has(target)) return;
                seen.add(target);

                const combinedText = getVideoCardSignal(target);
                if (!combinedText) return;

                const isBlocked = blockKeywords.some(keyword => keyword.test(combinedText));
                const isSafeChannelVideo = isVideoCardFromSafeChannel(target);

                // IMPORTANT: only the recommended/card video's OWN channel gets immunity.
                // Being on a whitelisted watch page never exempts unrelated sidebar recommendations.
                if (isBlocked && !isSafeChannelVideo) {
                    collapseBannedVideoCard(target);
                    hiddenCount++;
                    return;
                }

                // YouTube can recycle SPA card nodes. If a node we hid now represents a safe/clean
                // video, undo only OUR prior collapse before approving it again.
                restorePreviouslyBannedVideoCard(target);

                // v35 search softgate: once scanned and not banned, explicitly approve it.
                approveVideoCardTarget(target);
            });

            if (hiddenCount > 0) {
                devLog(`Hidden ${hiddenCount} video cards/playlist items with banned content`);
            }
        } catch (err) {
            console.log('Error hiding video cards: ' + err.message);
        }
    }

    function handlePopupButtons() {
        try {
            const buttons = document.querySelectorAll('button, [role="button"]');
            let clickedCount = 0;
            
            buttons.forEach(button => {
                const text = button.textContent?.toLowerCase() || "";
                const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || "";
                
                if (text.includes('skip') || text.includes('continue') || 
                    text.includes('ohita') || text.includes('jatka') ||
                    ariaLabel.includes('skip') || ariaLabel.includes('continue')) {
                    
                    const popup = button.closest('[role="dialog"], ytd-popup-container, tp-yt-paper-dialog');
                    if (popup) {
                        const popupText = popup.textContent?.toLowerCase() || "";
                        if (adblockWarningPatterns.some(pattern => pattern.test(popupText))) {
                            devLog('Auto-clicking skip button in adblock popup');
                            button.click();
                            clickedCount++;
                        }
                    }
                }
            });
            
            if (clickedCount > 0) {
                devLog(`Clicked ${clickedCount} popup buttons`);
            }
        } catch (err) {}
    }

    let __ytUrlObsInstalled = false;
    function observeUrlChanges() {
        try {
            if (__ytUrlObsInstalled) return;
            __ytUrlObsInstalled = true;

            let currentUrl = window.location.href;
            const observer = trackObserver(new MutationObserver(() => {
                if (currentUrl !== window.location.href) {
                    currentUrl = window.location.href;
                    enforceSanity();
                    enforceShortsRedirect();
                    hideYouTubeNudgesAndShortsChips();
                    scheduleYTSearchScan('url-observer');
                }
            }));

            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
                devLog('URL observer started');
            } else {
                addTimeout(observeUrlChanges, 100);
            }
        } catch (err) {}
    }

    let __ytPopupObsInstalled = false;
    function observePopupChanges() {
        try {
            if (__ytPopupObsInstalled) return;
            __ytPopupObsInstalled = true;

            const observer = trackObserver(new MutationObserver((mutations) => {
                let sawNewCards = false;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { 
                                if (node.matches && (
                                    node.matches('[role="dialog"]') ||
                                    node.matches('ytd-popup-container') ||
                                    node.matches('tp-yt-paper-dialog') ||
                                    node.matches('ytd-enforcement-message-view-model')
                                )) {
                                    const text = node.textContent?.toLowerCase() || "";
                                    if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                                        devLog('Hiding newly added adblock popup');
                                        node.style.display = "none";
                                        node.style.visibility = "hidden";
                                    }
                                }
                                
                                const popupChildren = node.querySelectorAll ? 
                                    node.querySelectorAll('[role="dialog"], ytd-popup-container, tp-yt-paper-dialog') : 
                                    [];
                                popupChildren.forEach(child => {
                                    const text = child.textContent?.toLowerCase() || "";
                                    if (adblockWarningPatterns.some(pattern => pattern.test(text))) {
                                        devLog('Hiding adblock popup in new content');
                                        child.style.display = "none";
                                        child.style.visibility = "hidden";
                                    }
                                });

                                if (!sawNewCards && node.querySelectorAll && !isYTProtectedTextZone(node)) {
                                    try {
                                        if (getVideoCardHideTarget(node)) {
                                            sawNewCards = true;
                                        } else {
                                            const possibleCards = node.querySelectorAll(ytVideoCardSelector + ', ' + ytVideoTitleSelector);
                                            for (const possible of possibleCards) {
                                                if (getVideoCardHideTarget(possible)) {
                                                    sawNewCards = true;
                                                    break;
                                                }
                                            }
                                        }
                                    } catch (e) {}
                                }
                            }
                        });
                    }
                });
                hideYouTubeNudgesAndShortsChips();
                if (sawNewCards) {
                    scheduleYTSearchScan('mutation-cards');
                    hideBannedVideoCards();
                }
            }));

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                devLog('Popup/suggestion observer started');
            }
        } catch (err) {}
    }

    let __ytHistoryHooksInstalled = false;
    function installUrlChangeHooks() {
        if (__ytHistoryHooksInstalled) return;
        __ytHistoryHooksInstalled = true;

        try {
            const wrap = (type) => {
                const orig = history[type];
                return function() {
                    const rv = orig.apply(this, arguments);
                    try { window.dispatchEvent(new Event('locationchange')); } catch {}
                    return rv;
                };
            };
            history.pushState = wrap('pushState');
            history.replaceState = wrap('replaceState');
            onEvent(window, 'popstate', () => window.dispatchEvent(new Event('locationchange')), false);

            onEvent(window, 'locationchange', () => {
                updateYTSearchSoftGateClass();
                scheduleYTSearchScan('locationchange');
                enforceSanity();
                hideBannedVideoCards();
                hideYouTubeNudgesAndShortsChips();
                enforceShortsRedirect();
                removeShortsOnPage();
                addOpenInWatchButton();
                hideShortsGuideEntries();
            }, false);

            onEvent(window, 'yt-navigate-finish', () => {
                updateYTSearchSoftGateClass();
                scheduleYTSearchScan('yt-navigate-finish');
                enforceSanity();
                hideBannedVideoCards();
                hideYouTubeNudgesAndShortsChips();
                enforceShortsRedirect();
                removeShortsOnPage();
                addOpenInWatchButton();
                hideShortsGuideEntries();
            }, false);
            onEvent(window, 'yt-navigate-start', () => {
                stopIntervals();
                updateYTSearchSoftGateClass();
                if (isYTSearchResultsPage()) setYTSearchScanning(true);
            }, false);
        } catch (e) {}
    }

    const __shortsConfig = {
        enable: true,
        hideTabs: true,
        hideShortsVideos: true
    };

    function logf(message, style) {
        const composed = `[Youtube-shorts block] ${message}`;
        if (style === "error") {
            console.error(composed);
        } else {
            console.log(composed);
        }
    }
    async function querySelectorPromise(selectors, limit = 5, interval = 100) {
        let element;
        for (let i = 0; i < limit; i++) {
            element = document.querySelector(selectors);
            if (element) return element;
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
        return null;
    }
    async function querySelectorAllPromise(selectors, limit = 5, interval = 100) {
        let elements = document.querySelectorAll(selectors);
        if (elements.length !== 0) return elements;
        for (let i = 0; i < limit - 1; i++) {
            await new Promise((resolve) => setTimeout(resolve, interval));
            elements = document.querySelectorAll(selectors);
            if (elements.length !== 0) return elements;
        }
        return elements;
    }

    function reelShelfFilter() {
        const reels = document.querySelectorAll(
            "ytd-reel-shelf-renderer, ytm-reel-shelf-renderer"
        );
        for (const reel of reels) {
            reel.remove();
        }
    }
    async function richShelfFilter() {
        const selectors = [
            "ytd-rich-shelf-renderer:has(h2>yt-icon:not([hidden]))",
            "grid-shelf-view-model:has(ytm-shorts-lockup-view-model)"
        ];
        for (const s of selectors) {
            const shelfs = await querySelectorAllPromise(s);
            for (const shelf of shelfs) {
                shelf.remove();
            }
        }
    }
    function shortsFilter() {
        const shorts = document.querySelectorAll(
            "ytd-video-renderer ytd-thumbnail a, ytd-grid-video-renderer ytd-thumbnail a, ytm-video-with-context-renderer a.media-item-thumbnail-container"
        );
        const tags = [
            "YTD-VIDEO-RENDERER",
            "YTD-GRID-VIDEO-RENDERER",
            "YTM-VIDEO-WITH-CONTEXT-RENDERER"
        ];
        for (const i of shorts) {
            if (i.href.indexOf("shorts") != -1) {
                let node = i.parentNode;
                while (node) {
                    if (tags.includes(node.nodeName)) {
                        node.remove();
                        break;
                    }
                    node = node.parentNode;
                }
            }
        }
    }

    function convertShortsToVideoURL(url) {
        const result = url.match(/shorts\/([A-Za-z0-9_-]{11})/);
        if (result) {
            return `https://www.youtube.com/watch?v=${result[1]}`;
        }
    }

    function enforceShortsRedirect() {
        try {
            if (!__shortsConfig.enable) return;
            if (location.pathname.startsWith('/watch')) return; 
            const url = convertShortsToVideoURL(location.href);
            if (url && location.href !== url) {
                devLog(`Redirecting Shorts to watch: ${url}`);
                try { history.replaceState(null, '', url); } catch {}
                location.replace(url);
            }
        } catch (e) {}
    }

    function addOpenInWatchButton() {
        try {
            if (location.href.indexOf('/shorts/') === -1) return;
            const elements = document.querySelectorAll("#actions.ytd-reel-player-overlay-renderer");
            elements.forEach((element) => {
                const parent = element.parentNode;
                if (!parent) return;
                if (parent.querySelector(".youtube-shorts-block")) return;

                const container = document.createElement('div');
                container.id = 'block';
                container.className = 'youtube-shorts-block';
                container.title = 'Open in watch';

                const svgNS = "http://www.w3.org/2000/svg";
                const svg = document.createElementNS(svgNS, 'svg');
                svg.setAttribute('xmlns', svgNS);
                svg.setAttribute('height', '24px');
                svg.setAttribute('width', '24px');
                svg.setAttribute('viewBox', '0 -960 960 960');
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', 'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z');
                svg.appendChild(path);

                const textNode = document.createElement('span');
                textNode.appendChild(document.createTextNode('Open in new tab'));

                container.appendChild(svg);
                container.appendChild(textNode);

                container.addEventListener('click', () => {
                    document.querySelectorAll('video').forEach((e) => {
                        try { e.pause(); } catch {}
                    });
                    const to = convertShortsToVideoURL(location.href);
                    if (to) window.open(to);
                });

                element.insertAdjacentElement('afterbegin', container);
            });
        } catch (e) {}
    }

    function injectShortsCSS() {
        try {
            if (document.documentElement.querySelector('style[data-ytenhancer-shorts-css]')) return;
            const css = `
:root{
    --iron-icon-color: #606060;
}
.youtube-shorts-block a[title='Shorts']{
    display: none !important;
    pointer-events: none !important;
}
.youtube-shorts-block ytm-pivot-bar-item-renderer:has(.pivot-bar-item-tab.pivot-shorts){
    display: none !important;
}
#block.youtube-shorts-block{
    color: white;
    margin: 6px 0;
    display: flex;
    flex-flow: column;
    text-align: center;
    font-size: 14px;
    user-select: none;
    cursor: pointer;
}
#block.youtube-shorts-block>svg{
    fill: white;
    margin: auto;
}
ytd-continuation-item-renderer:not(:last-child){
    display: none;
}
@media screen and (min-width:600px){
    #block.youtube-shorts-block{
        color: var(--iron-icon-color);
    }
    #block.youtube-shorts-block>svg{
        fill: var(--iron-icon-color);
    }
}`;
            const style = document.createElement('style');
            style.type = 'text/css';
            style.setAttribute('data-ytenhancer-shorts-css', '');
            style.appendChild(document.createTextNode(css));
            (document.head || document.documentElement).appendChild(style);

            if (__shortsConfig.hideTabs) {
                if (document.body) {
                    document.body.classList.add('youtube-shorts-block');
                } else {
                    addTimeout(() => { if (document.body) document.body.classList.add('youtube-shorts-block'); }, 100);
                }
            }
        } catch (e) {}
    }

    async function removeShortsOnPage() {
        try {
            if (!__shortsConfig.hideShortsVideos) return;
            reelShelfFilter();
            await richShelfFilter();
            shortsFilter();
        } catch (e) {}
    }

    function hideShortsGuideEntries() {
        try {
            const anchors = document.querySelectorAll('a#endpoint.yt-simple-endpoint[href*="/shorts"], a#endpoint.yt-simple-endpoint[title="Shorts"]');
            anchors.forEach(a => {
                const entry = a.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
                if (entry) {
                    entry.style.display = 'none';
                    entry.style.visibility = 'hidden';
                } else {
                    a.style.display = 'none';
                    a.style.visibility = 'hidden';
                }
            });
            document.querySelectorAll('ytm-pivot-bar-item-renderer .pivot-bar-item-tab.pivot-shorts')
                .forEach(tab => {
                    const pivot = tab.closest('ytm-pivot-bar-item-renderer');
                    if (pivot) {
                        pivot.style.display = 'none';
                        pivot.style.visibility = 'hidden';
                    }
                });
            hideSearchShortsChips();
        } catch (e) {}
    }

    let __ytShortsObsInstalled = false;
    function observeShortsDomChanges() {
        try {
            if (__ytShortsObsInstalled) return;
            __ytShortsObsInstalled = true;

            const install = async () => {
                const target = await querySelectorPromise('#content, #app') || document.body || document.documentElement;
                if (!target) return;
                const observer = trackObserver(new MutationObserver(() => {
                    removeShortsOnPage();
                    addOpenInWatchButton();
                    hideShortsGuideEntries();
                }));
                observer.observe(target, { childList: true, subtree: true });
                removeShortsOnPage();
                hideShortsGuideEntries();
                devLog('Shorts DOM observer started');
            };
            install();
        } catch (e) {}
    }

    devLog('YouTube Enhancer initializing');

    // Initial checks
    enforceSanity();
    enforceShortsRedirect();
    installUrlChangeHooks();

    observeUrlChanges();
    observePopupChanges();
    injectShortsCSS();
    observeShortsDomChanges();
    hideYouTubeNudgesAndShortsChips();
    scheduleYTSearchScan('initial');
    addOpenInWatchButton();
    hideShortsGuideEntries();

    // Periodic tasks with lifecycle tracking
    function scheduleMainIntervals() {
        addInterval(() => { if (!document.hidden) hideBannedVideoCards(); }, 250);
        addInterval(() => { if (!document.hidden) enforceSanity(); }, 500); 
        addInterval(() => { if (!document.hidden) removeShortsOnPage(); }, 300);
        addInterval(() => { if (!document.hidden) { removeAdblockPopups(); hideYouTubeNudgesAndShortsChips(); } }, 500);
        addInterval(() => { if (!document.hidden) addOpenInWatchButton(); }, 600);
        addInterval(() => { if (!document.hidden) handlePopupButtons(); }, 1000);
        addInterval(() => { if (!document.hidden) hideShortsGuideEntries(); }, 1200);
        addInterval(() => { if (!document.hidden) enforceShortsRedirect(); }, 1500);
    }
    startIntervals(scheduleMainIntervals);

    addTimeout(removeAdblockPopups, 1000);
    addTimeout(handlePopupButtons, 2000);
    addTimeout(removeShortsOnPage, 750);
    addTimeout(hideShortsGuideEntries, 800);
    addTimeout(hideYouTubeNudgesAndShortsChips, 250);
    addTimeout(() => scheduleYTSearchScan('startup-timeout'), 120);

    onEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleMainIntervals);
            updateYTSearchSoftGateClass();
            scheduleYTSearchScan('visibility');
            hideBannedVideoCards();
            enforceSanity();
            hideYouTubeNudgesAndShortsChips();
            removeShortsOnPage();
            addOpenInWatchButton();
            hideShortsGuideEntries();
            enforceShortsRedirect();
        }
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

    devLog('YouTube Enhancer loaded');
})();