(() => {
    'use strict';

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        console.log('[FACEBOOK.JS]', message);
    }

    // ===== Memory/observer/timer lifecycle tracking (added) =====
    const __fbTimers = {
        intervals: new Set(),
        timeouts: new Set(),
        idleCallbacks: new Set(), // track rIC ids to avoid leaks in SPAs
    };
    const __fbObservers = new Set();
    const __fbEventCleanups = new Set();
    let __fbCleanupRan = false;

    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        __fbTimers.intervals.add(id);
        return id;
    }
    function addTimeout(fn, ms) {
        const id = setTimeout(() => {
            __fbTimers.timeouts.delete(id);
            fn();
        }, ms);
        __fbTimers.timeouts.add(id);
        return id;
    }
    function addIdleCallback(fn) {
        // Track requestIdleCallback so we can cancel on cleanup (prevents leaks on SPA navigations)
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(() => {
                try { fn(); } finally { __fbTimers.idleCallbacks.delete(id); }
            });
            __fbTimers.idleCallbacks.add(id);
            return id;
        } else {
            // Fallback is tracked via __fbTimers.timeouts
            return addTimeout(fn, 0);
        }
    }
    function trackObserver(observer) {
        __fbObservers.add(observer);
        return observer;
    }
    function onWindowEvent(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        __fbEventCleanups.add(() => target.removeEventListener(type, handler, options));
    }

    function cleanup() {
        if (__fbCleanupRan) return;
        __fbCleanupRan = true;
        try {
            __fbTimers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
            __fbTimers.intervals.clear();

            __fbTimers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __fbTimers.timeouts.clear();

            if (typeof window.cancelIdleCallback === 'function') {
                __fbTimers.idleCallbacks.forEach(id => { try { window.cancelIdleCallback(id); } catch {} });
            }
            __fbTimers.idleCallbacks.clear();

            __fbObservers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __fbObservers.clear();

            __fbEventCleanups.forEach(fn => { try { fn(); } catch {} });
            __fbEventCleanups.clear();

            // Remove injected style to free memory in long-lived SPA sessions
            try {
                const s = document.getElementById('fb-inline-style');
                if (s) s.remove();
            } catch {}
            try {
                const s2 = document.getElementById('fb-specific-url-style');
                if (s2) s2.remove();
            } catch {}
            try {
                const s3 = document.getElementById('fb-specific-profile-style');
                if (s3) s3.remove();
            } catch {}
            try {
                const s4 = document.getElementById('fb-specific-url-prehide-style');
                if (s4) s4.remove();
            } catch {}

            devLog('Cleanup complete.');
        } catch (e) {
            console.log('[FACEBOOK.JS] cleanup error: ' + e.message);
        }
    }

    // Pause background intervals when hidden (saves CPU/memory)
    let __fbIntervalsRunning = false;
    function stopIntervals() {
        __fbTimers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
        __fbTimers.intervals.clear();
        __fbIntervalsRunning = false;
    }
    function startIntervals(schedulerFn) {
        if (__fbIntervalsRunning) return;
        schedulerFn();
        __fbIntervalsRunning = true;
    }

    // Throttle helper (added)
    function createThrottle(fn, wait) {
        let last = 0;
        let trailingTimeout = null;
        return function throttled(...args) {
            const now = performance.now();
            const remaining = wait - (now - last);
            const call = () => { last = performance.now(); fn.apply(this, args); };
            if (remaining <= 0) {
                if (trailingTimeout) { clearTimeout(trailingTimeout); __fbTimers.timeouts.delete(trailingTimeout); trailingTimeout = null; }
                call();
            } else if (!trailingTimeout) {
                trailingTimeout = addTimeout(call, remaining);
            }
        };
    }

    // Variable to cache redirects
    let lastRedirect = null;

    // ENHANCED: Inject CSS immediately for instant hiding - REMOVED body visibility hidden to prevent white screen
    // UPDATED: Re-added broad default hiding to prevent flashes, only show approved posts
    const injectInlineCSS = () => {
        try {
            devLog('Injecting inline CSS with instant search hiding and anti-flashing');
            let style = document.getElementById('fb-inline-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'fb-inline-style';
            }
            style.textContent = `
            /* INSTANT SEARCH HIDING - Hide search results by default until approved */
            li[role="row"]:not(.fb-search-approved),
            a[aria-describedby]:not(.fb-search-approved),
            div[role="option"]:not(.fb-search-approved),
            div[data-testid="search-result"]:not(.fb-search-approved),
            div[role="presentation"] a:not(.fb-search-approved) {
                visibility: hidden !important;
                opacity: 0 !important;
                display: none !important;
                pointer-events: none !important;
            }
            
            /* Show only approved search results */
            li[role="row"].fb-search-approved,
            a[aria-describedby].fb-search-approved,
            div[role="option"].fb-search-approved,
            div[data-testid="search-result"].fb-search-approved,
            div[role="presentation"] a.fb-search-approved {
                visibility: visible !important;
                opacity: 1 !important;
                display: block !important;
                pointer-events: auto !important;
            }
            
            /* Permanently hide banned search results */
            .fb-search-banned {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
            }

            /* Permanently hide banned posts and elements */
            .fb-post-banned,
            .fb-element-banned {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }

            /* ANTI-FLASHING: Hide critical elements by default immediately with content-visibility */
            div[aria-label="People You May Know"],
            div[aria-label="Ihmisiä, jotka saatat tuntea"],
            a[href="https://www.facebook.com/friends/suggestions/"],
            div[aria-label="Näytä suosituksia"],
            [aria-label="Näytä suositukset"],
            [role="button"][aria-label="Näytä suositukset"],  
            a[aria-label="Kaverit"],
            div[aria-label="Kaverit"],
            div[aria-label="Kaverit"] > span.x1lliihq,
            div[aria-label="Kaverit"] span.html-span,
            a[aria-label="Meta AI"],
            div[aria-label="Meta AI"],
            a[href="/Meta AI/"],
            a[href="/friends/"],
            a[aria-label="Näytä kaikki"] > span.x193iq5w.xeuugli.x13faqbe,
            /* More specific Meta AI selectors */
            a[aria-label="Meta AI"],
            div[aria-label="Meta AI"],
            span[aria-label="Meta AI"],
            /* Meta AI contact links */
            a[href*="/messages/t/36327,2227039302/"],
            a[href*="messages/t/36327"],
            /* Friends-related links */
            a[href*="meta.ai"], a[href="/Meta AI/"], a[href="/friends/"],
            a[role="link"][href="/friends/"], a[role="link"][aria-label="Kaverit"], a[role="link"][aria-label="Friends"],
            img[src*="w5I9ktz_3Ib.png"],
            li.x1iyjqo2.xmlsiyf.x1hxoosp.x1l38jg0.x1awlv9s.x1i64zmx.x1gz44f,
            .x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1),
            div.x1i10hfl:nth-child(13),
            div.x1i10hfl:nth-child(13) > div:nth-child(1),
            div.x1i10hfl:nth-child(13) > div:nth-child(2),
            div.x1i10hfl:nth-child(13) > div:nth-child(3),
            .x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty),
            li.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-li:nth-of-type(2),
            svg[aria-label="Meta AI:n profiilikuva"],
            svg[aria-label*="Meta AI profile"],
            div.x1gefphp.xf7dkkf.x1l90r2v.xv54qhq.xyamay9.x1e56ztr.x78zum5.x9f619.x1olyfxc.x15x8krk.xde0f50.x5a5i1n.x1obq294.x6s0dn4:nth-of-type(6),
            .xjkvuk6.x1iorvi4.x1qughib.x78zum5.x6s0dn4,
            .x1vjfegm.x1iyjqo2,
            div.x1a02dak:nth-child(3) > div:nth-child(1),
            div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1),
            div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1),
            .x1ye3gou.x1120s5i.xn6708d.xz9dl7a.x1qughib.x1q0g3np.x78zum5,
            .xbbxn1n.xwxc41k.xxbr6pl.x1p5oq8j.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div,
            .x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo,
            /* ENHANCED: All PYMK selectors for instant hiding */
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6,
            .x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d,
            svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq,
            div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j,
            div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z,
            div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo {
                visibility: hidden !important; /* Instantly make elements invisible */
                display: none !important; /* Fully remove them */
                opacity: 0 !important; /* Triple-layer hiding */
                pointer-events: none !important; /* Prevent interaction */
                content-visibility: hidden !important; /* Prevent rendering until shown */
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
            /* Additional aggressive hiding for persistent elements */
            a[aria-label="Kaverit"],
            div[aria-label="Kaverit"],
            a[href="/friends/"],
            a[aria-label="Meta AI"],
            div[aria-label="Meta AI"] {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                content-visibility: hidden !important; /* Anti-flashing */
            }
            /* ENHANCED: Hide all posts by default to prevent flashes, only show approved ones */
            [role="article"]:not(.fb-post-approved),
            [role="article"].x1lliihq:not(.fb-post-approved),
            [role="article"] .x1yztbdb:not(.fb-post-approved),
            [role="article"] .x1hc1fzr:not(.fb-post-approved),
            div.x1iyjqo2.x1vjfegm:not(.fb-post-approved) {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                content-visibility: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
            `;
            // Safe append (no document.write)
            if (!style.isConnected) {
                if (document.head) {
                    document.head.appendChild(style);
                    devLog('CSS injected to head');
                } else if (document.documentElement) {
                    document.documentElement.appendChild(style);
                    devLog('CSS injected to documentElement');
                }
            } else {
                devLog('CSS updated (reuse existing style node)');
            }
        } catch (err) {
            console.log('Error while injecting CSS: ' + err.message);
            try {
                const styleTag = document.createElement('style');
                styleTag.id = 'fb-inline-style-fallback';
                styleTag.textContent = `a[aria-label="Kaverit"], div[aria-label="Kaverit"], a[href="/friends/"] { display: none !important; }`;
                (document.head || document.documentElement).appendChild(styleTag);
                devLog('Fallback CSS injected (safe append)');
            } catch (e) {
                console.log('Fallback CSS injection failed: ' + e.message);
            }
        }
    };
    
    // Run CSS injection immediately
    injectInlineCSS();

    // Directly hide specific elements based on their unique selectors - Enhanced for persistence and anti-flashing
    const hideCriticalElements = () => {
        try {
            devLog('Hiding critical elements with permanent banning and anti-flashing');
            const selectors = [
                'a[aria-label="Kaverit"]',
                'div[aria-label="Kaverit"]',
                'a[href="https://www.facebook.com/friends/"]',
                'a[href="/friends/"]',
                'a[aria-label="Meta AI"]',
                'div[aria-label="Meta AI"]',
                'a[href="https://www.meta.ai/"]',
                'a[href="https://meta.ai/"]',
                'a[href="/Meta AI/"]',
                'svg[aria-label="Meta AI:n profiilikuva"]',
                'svg[aria-label*="Meta AI profile"]', 
                'a[aria-label="Meta AI"]',
		'div.x78zum5.x12nagc.x1n2onr6.x1s6qhgt:empty',
		'div.x78zum5.x12nagc.x1n2onr6.x1s6qhgt:not(:has(*))',
        	'.x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty)',
		'li.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-li:nth-of-type(2)',
                'div[aria-label="Meta AI"]',
                'span[aria-label="Meta AI"]',
                'svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z',
                'div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo',
                // ENHANCED: Meta AI contact specific selectors
                'a[href*="/messages/t/36327,2227039302/"]',
                'a[href*="messages/t/36327"]',
		'div.x1a02dak:nth-child(3) > div:nth-child(1)',
		'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)',
		'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
            ];

            let hiddenCount = 0;
            selectors.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => {
                    if (!el.classList.contains('fb-element-banned')) {
                        el.classList.add('fb-element-banned');
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('visibility', 'hidden', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        el.style.setProperty('pointer-events', 'none', 'important');
                        el.style.setProperty('position', 'absolute', 'important');
                        el.style.setProperty('left', '-9999px', 'important');
                        el.style.setProperty('top', '-9999px', 'important');
                        el.style.setProperty('height', '0', 'important');
                        el.style.setProperty('width', '0', 'important');
                        el.style.setProperty('overflow', 'hidden', 'important');
                        el.style.setProperty('content-visibility', 'hidden', 'important'); // Anti-flashing
                        hiddenCount++;
                    }
                });
            });
            
            if (hiddenCount > 0) {
                devLog(`Hidden ${hiddenCount} critical elements`);
            }
        } catch (err) {
            console.log('Error hiding critical elements: ' + err.message);
        }
    };
    
    // Run immediately
    hideCriticalElements();

    // --- ARRAYS AND CONFIGURATION ---
    const paramsToDelete = ["set", "type"];
    const blockedFbids = [
        '1211026318928667',
        '537550366276269',
        '623119941052644',
        '576288902402415',
        '545014018863237',
        '434866806544626',
        '577933972237908',
        '568117709886201',
        '577933912237914',
        '247979528654747',
        '623591001005538',
        '578307698867202',
        '8607987962565762',
        '9304570432907508',
        '9434929546538262',
        '8594043307293561',
        '8193551130676116',
        '8187588197939076',
        '100064492520692',
        '8894604553904100',
        '577936375571001',
        '577934212237884',
        '7950002728364292',
        '371861326178508',
        '100006231940849',
        '100079421143598',
        '100002140178481',
        '8062936260404271',
	'2717246041744548',
	'100002704826559',
        '100007491272181',
        '100000404984016',
        '100046099231198',
	'10225004332552385',
	'10219580837008386',
	'10220029018452642',
	'10223968662581283',
	'10221462519169264',
	'10224094556048541',
        '1014542354035878',
        '1014535897369857',
        '1340482475983050',
        '6872722896092286',
        '1344030092294955',
        '895923403772295',
        '895814217116547',
        '1062802150417752',
        '1060897693941531',
        '1458027414228555',
        '100000586987296',
        '292715294181170',
        '505428986169752',
        '444809228883717',
        '462339497310048',
        '1014126078618693',
        '973601849337783',
        '970049886359646',
	'100001581857271',
	'1256224499884112',
        '940194702678498',
        '9761862833844930',
        '936445033053465',
        '907980612566574',
	'8065217176842846',
        '895381147159854',
        '1080918508606116',
        '1072683142762986',
        '630426793655292',
        '609256709105634',
        '555485811149391',
        '548697141828258',
        '1079952645369369',
        '1209351935762772',
        '24185005747770732',
        '24185005784437395',
        '1178535568844409',
        '101371466560830',
        '1166215320076434',
        '1158912826275168',
	'24697494943188474',
	'24697494953188473',
        '1109723022392331',
	'100000639309471',
        '1099222803442353',
        '1090312024333431',
        '867521339945835',
        '371863449511629',
	'156025504001094',
        '371863216178319',
        '368533993177908',
        '509864159059568',
        '504758682903449',
        '2155319098244876',
        '293678390751527',
        '292375400881826',
        '100003019443729',
        '599253748555949',
        '855022637862372',
        '1467275073303789',
        '24332459019692070',
        '843081002389869',
        'heidi.huuska',
        '24329736293297676',
        '642842945747010',
        '629932107038094',
        '602713353093303',
        '616352621729376',
        '615068318524473',
        '2822598764438073',
        '2782340741797209',
        '444809795550327',
        '436177466413560',
        '9759657687398778',
        '9817473061617240',
        '24140067825597858',
        '24027737130164262',
        '1400006907824507',
        '8384654324899128',
        '935807304949049',
        '8812088588802292',
        'kiviahosirja',
	'irrasd',
        '1495428881',
        '1356706889',
        'Cultaholic',
        'AionicMusic',
        'toni.koistinen.90',
        'toni.harsunen.1',
        'juho.leskinen',
        'melina.jokimaki',
        'johanna.jokimaki.18',
	'janica.tamminen',
	'sanni.vuori.5',
        'paivi.sainio.3',
	'minna.kaipio.5'
    ];

    const blockedUrls = [
        /profile\.php\?id=100000639309471&sk=photos/,
        /profile\.php\?id=100000639309471&sk=photos_by/,
        /profile\.php\?id=100000639309471&sk=videos/,
        /permalink\.php\?story_fbid=pfbid0xgBFRfVFGyiwt9b1eibHLQG2vin9NADySKrZm8aPvENT9GWMg3dt8VA6eGHxZjWCl/,
        /permalink\.php\?story_fbid=pfbid0pMgpCH4wjuyq3smimT5ULEmQFzZugx9o3kBraHLJ5Y37toTEn1415Z7L8FpTh135l/,
        /permalink\.php\?story_fbid=pfbid02QrdmwZKfKxAiZm3k41FgqM6FEyRx1eLAB1UiJPc7z9CT3RxL9a4X12qKKyykkfw5l/,
        /permalink\.php\?story_fbid=pfbid02f5iZ2iLyAA4o4PLoreUSQ7EJi19fSmYYUbCqxFEKMZv89VmiKfBtS1hqAErjzdQZl/,
        /permalink\.php\?story_fbid=836447305302755/,
        /permalink\.php\?story_fbid=pfbid022bSh3R6FDVHjTomfKqRremW2dg8fiWb5xaRzpqAJXdQHPkwBvsfJgicom5Vi3RremW2dg8fiWb5xaRzpqAJXdQHPkwBvsfJgicom5Vi3Hml/,
        /permalink\.php\?story_fbid=pfbid0abuaonjJ1417W5MUrmpGgo4pJt5kJGL9hYcGYz8J392z3PjjVjhrZhgcK2fz6pZcl/,
        /permalink\.php\?story_fbid=pfbid02rX4RcxF9v5YB1xAq36u9bndbyiW535dgjuTnbCxJjjRHzPCKDzQyvPAtdN23T4Kzl/,
        /permalink\.php\?story_fbid=1236875833901235/,
        /permalink\.php\?story_fbid=pfbid02cVLMUQSCxQzznzkH5X9BPsUDusdBKc9fzuiGsoJHSXDWqYMKBBXHd8xj6EFKmdivl/,
        /permalink\.php\?story_fbid=583915704973068/,
        /permalink\.php\?story_fbid=pfbid0Xq5bxtrXkWA9gWqcBt2aT8sDMeCDG5XN6hWVHE7axKu3jbn9LfiYfADgWHLtBfEUl/,
        /posts\/pfbid02LXtamB1X9aJrRsMDxkcbNLFk2g9eeYBNii6HzaLLZVamDMnaAG4AvZU1VYfVHvn9l/,
        /posts\/pfbid0XXH5hPZ4kU6y6zm4eeyqYkUMZhCdXsKuMzCRbkZptgEGNTk8UVYT9UEEYinKvXLWl/,
        /posts\/pfbid02LKr4mWRvd45TkNcPfaUFuu3NGkgQb1t8fHD6t9cqigiUkQLuyQRASMMYeH88yDBVl/,
        /story_fbid=164225553736969/,
        /permalink.php?story_fbid=pfbid06VXAEGvWCcsPbk553v88NMB8uWRnRGHffB5s9kEpKRyYmfEJtt4fULTnQ82LnieDl/,
        /permalink.php?story_fbid=pfbid02tTJDFvZ5sfpCUBcnoG1kJvie7dabmLSwHCqVya7XzoZMFc2QX7AU2emUdhE7EeWzl/,
	/permalink.php?story_fbid=pfbid02ApNL79Gp1AKQf55yHVLeQvGAakCwm4STcNQwCVyG26Wk17dt5FZhA3jgAVfgqVt1l/,
	/pfbid02ApNL79Gp1AKQf55yHVLeQvGAakCwm4STcNQwCVyG26Wk17dt5FZhA3jgAVfgqVt1l/,
        /permalink.php?story_fbid=642842945747010/,
        /permalink.php?story_fbid=895381147159854/,
        /permalink.php?story_fbid=936445033053465/,
        /permalink\.php\?story_fbid=pfbid05g1GaBBRjHMhXfekDtUEmRbP98Q4N9kdHhCrUUfp6LGdsQQMmShBYT8KfkSH938pl/,
        /permalink.php?story_fbid=pfbid02ZLJve5megHVfot9Ezfyr5z5m531kDh4TYzysgUZ3J2622PtM5Xb4NpJ9yiJqjfDNl/,
        /permalink.php?story_fbid=pfbid035WcvrEubf1RjAAXbYonu4smUnnSEYPcrY4Qz78v8jk3hv44aLbyikR4y2jboocztl/,
        /permalink.php?story_fbid=pfbid02QLcVYhmA1qEtvnHG986MyGR55duicYgvoykzXa2Vj6n4dUskKQ4FqojZtdQyAm3fl/,
        /permalink.php?story_fbid=1340482475983050/,
        /permalink.php?story_fbid=pfbid0qThHq9yVbKEMUe63CGVZ6BnCy9kDAak1qAMG22if857TPCJX6FpVpNCFeBwEzuRYl/,
        /permalink.php?story_fbid=pfbid02MRkRwJLc6tyeWCMHAw16Z7Y7kQhbFmhk7uui4RV7SRZSXNdL4EYxLgN2ndJriBxel/,
        /permalink.php?story_fbid=pfbid0EPSNtptR1iDJzSakNGr5u1yacxF3wEXcHVSrkp7z68K87xDtzABc5LU7dGv4frL7l/,
        /permalink.php?story_fbid=pfbid0LfgFUf7LJRweuE69QHd3DSuyrDV8RVUudEojMa9a96qPasVBoN1pNzPco1KVd9Vkl/,
        /permalink.php?story_fbid=5666600276704560/,
        /permalink.php?story_fbid=pfbid027gqscS39nkeaTY8cXt7L4RNP1sYuZKoJPu244oxCSvc5z3zxHKNuxNd5MBH5Geool/,
        /permalink.php?story_fbid=pfbid0qThHq9yVbKEMUe63CGVZ6BnCy9kDAak1qAMG22if857TPCJX6FpVpNCFeBwEzuRYl/,
        /permalink.php?story_fbid=pfbid0nkBwAMmJZ8LNs9awZ9tvLRo29tbP9PpW8FZ1cDDFNtVCJJW5Vin8B6QUSqNkqLH5l/,
        /permalink.php?story_fbid=pfbid0efp4yfb77ATKq5vRjB3o3dMGvw9yvagaTz21j4SmbUeeYvNHanjqjGBVpFnCMibBl/,
        /permalink.php?story_fbid=pfbid0EAzJgxVD1zCF6THJ1pKtS6kEe9L1TiLbo2sEKHUqUXJRF899FkUkBH4MNjM22sKpl/,
        /permalink\.php\?story_fbid=pfbid0Xq5bxtrXkWA9gWqcBt2aT8sDMeCDG5XN6hWVHE7axKu3jbn9LfiYfADgWHLtBfEUl/,
        /permalink.php?story_fbid=907980612566574/,
        /permalink.php?story_fbid=pfbid02ERbU7QHGJLQ8CwgMz2wdNjnQJdZ8fJje85i1LcExk5CLCXkDuTyyRp5uat4aKkAYl/,
        /permalink.php?story_fbid=907631116865858/,
	/pfbid0oH97BQX6SJFFD1fVrd5QdFruFfpBMWZp452ZHkxK6arLR68RzbrBuruEye6dwqEl/,
	/pfbid02AeDKp115BTU1qD4QzLZ8V2NWm7NmZUe9V9cghxu5YyasXHDwvJCLgBr9GEtv6qmjl/,
	/permalink\.php\?story_fbid=pfbid02AeDKp115BTU1qD4QzLZ8V2NWm7NmZUe9V9cghxu5YyasXHDwvJCLgBr9GEtv6qmjl/,
	/permalink.php?story_fbid=pfbid02aTQ2VVXnfkxpy38cZ5Ey179t4qcxZugQtAmNU5o4eerHn81h6ETiXcY76XEgAx5ul/,
	/pfbid02aTQ2VVXnfkxpy38cZ5Ey179t4qcxZugQtAmNU5o4eerHn81h6ETiXcY76XEgAx5ul/,
        /permalink.php?story_fbid=10099498386748038/,
        /permalink.php?story_fbid=895923403772295/,
        /permalink.php?story_fbid=895381147159854/,
        /permalink.php?story_fbid=855022637862372/,
        /permalink.php?story_fbid=843081002389869/,
        /permalink.php?story_fbid=1178535568844409/,
        /permalink.php?story_fbid=1062802150417752/,
        /permalink.php?story_fbid=1014126078618693/,
        /permalink.php?story_fbid=970049886359646/,
	/\/facebook\.com\/search\/top\/\?q=Tatu%20Toiviainen/,
	/fbid=10225004332552385/,
	/Tatu%20Toiviainen/,
	/Janica%20Tamminen/,
	/Mimmi%20Wikman/,
	/Ira%20Nyman/,
	/Sanni%20Vuori/,
	/pfbid02s8apN5SvHj2L634nJJmzRZbABC9wZzdChf2kqG6m3h1PrDG5Z5CrVYfWpSim9L5Fl/,
	/pfbid02Eho4BczZu7Vbg2iJDF6jr89KwHBy1iGr3GzAwPREbrNr6gjPDXpSy7JwJqvN4fZdl/,
	/pfbid02AuWMkj4XYtGbaneoq8JWomieFk1UuVTPDTSvL3avK74mXykwe87GSA5G4dsaYJ3rl/,
	/permalink.php?story_fbid=pfbid02AuWMkj4XYtGbaneoq8JWomieFk1UuVTPDTSvL3avK74mXykwe87GSA5G4dsaYJ3rl/,
	/permalink.php?story_fbid=pfbid06xvcvULz9eHgge39HMCS4TYPLs6pM3itRyRqUQGHZAZbZAvR6DbQfAskMFTRm1X8l/,
        /pfbid0237ToPx2orNHBxmeBoRmdKFGvEr56RUTYTHtsaECu7gXwDUeVxhpXmqTt6cTvsDYXl/,
        /pfbid0Y6RdZQAvubSckYrudt3rAeNSx2et4YPUg12nx7Nv7cAKFgcgpBwLfQ8XK43Pryr4l/,
        /pfbid027gqscS39nkeaTY8cXt7L4RNP1sYuZKoJPu244oxCSvc5z3zxHKNuxNd5MBH5Geool/,
        /pfbid02MRkRwJLc6tyeWCMHAw16Z7Y7kQhbFmhk7uui4RV7SRZSXNdL4EYxLgN2ndJriBxel/,
        /pfbid0nkBwAMmJZ8LNs9awZ9tvLRo29tbP9PpW8FZ1cDDFNtVCJJW5Vin8B6QUSqNkqLH5l/,
	/pfbid0C5EFsiXaQ4xYxRsYjTbFdJQ16kvSqtGpAgjWjbfkeGj8AnheyLqn7MfKJyKbRSrBl/,
        /pfbid02aGzvCJefJC5Fh3XUVbvBPCxg55Px15NyDsK4VU3TjXpnnMktss6SEUC622SmQmTWl/,
        /pfbid06qH6x7KFy2KNqqB3j8nnDWJDxGfq11oh3FBBPDgPBn4PasfWGshxReW7gvHfqEHkl/,
        /pfbid0HaJikdQnFY855RTGVzsdJ37A35tfx9bwipQu23jk1wyc3xzCSb9rvgBPUpjsuVZbl/,
        /pfbid036f6zK7fAhXTd4CpkSDtayrMrDW6VSNKcoQoPiR3CMPvVCVuMaNX8jMEoYc6WpkZnl/,
        /pfbid0XkSVwYhGrkQ1wcBZHDqvrTXc3nhYzVNnQ6znaLpxwrGeSrpn3VJ4wSaUt1WeywDMl/,
        /pfbid02r7g7nP7vadRLpCU9jtP4yR8bYJtWt7d9JUqC839QUfaySuyzXzMBcExFufQENKaal/,
	/pfbid02AWZoqdyLzr85gw6zzoPzBmDfjXEWbh9GX7oqHBSVrR4D8bcnYGQoCvWEkybUXcKal/,
	/pfbid02Etv8PekTAr8YPSnTbg6bDjKEcPCBPXFxnFfMPEQv4Qipd7oXqeaTeynt1PxGdQZwl/,
        /permalink.php?story_fbid=pfbid02XysYZFdPcadPVYXqD9SyzmDChrqfcK4kd6haSDo2WrE4thPhn8WemX4n44GKsmdVl/,
        /permalink.php?story_fbid=940194702678498/,
        /permalink.php?story_fbid=pfbid0xh4ZoQA4XvgYL7iXe238V7o1sxEyULXGhr6Ufk2YeWFMwD4Ct4UYixF5UbycsCyEl/,
        /permalink.php?story_fbid=pfbid0237ToPx2orNHBxmeBoRmdKFGvEr56RUTYTHtsaECu7gXwDUeVxhpXmqTt6cTvsDYXl/,
        /permalink.php?story_fbid=1209351935762772/,
        /permalink.php?story_fbid=108091850860611/,
        /permalink.php?story_fbid=1080918508606116/,
        /permalink.php?story_fbid=116621532007643/,
        /permalink.php?story_fbid=1109723022392331/,
        /permalink.php?story_fbid=1099222803442353/,
        /permalink.php?story_fbid=1090312024333431/,
        /permalink.php?story_fbid=867521339945835/,
        /permalink.php?story_fbid=24140067825597858/,
        /permalink.php?story_fbid=700614522353732/,
        /permalink.php?story_fbid=615068318524473/,
        /www\.facebook\.com\/friends.*/,
        /www\.facebook\.com\/notifications.*/,
        /permalink.php?story_fbid=pfbid02gSLE82JdtQ9BNfzGwBy9SvJgozXPR7DJkZJHvCiYXhxL4cjjrV57evFZpnWyTijhl/,
        /permalink.php?story_fbid=pfbid06VXAEGvWCcsPbk553v88NMB8uWRnRGHffB5s9kEpKRyYmfEJtt4fULTnQ82LnieDl/,
        /permalink.php?story_fbid=pfbid0kx58SnWrhM9iBggJ99sLtKBXZ6jKUymj1T3LGXGPg6vMnUbhZTouZ7hkgozWaDePl/,
	/permalink.php?story_fbid=pfbid02FCiefA3vB2vd4u8MSaD6JhB438oZ1o8DB9bhY4xjB8fBXavvtKd87PwE7QCjArp1l/,
	/pfbid02FCiefA3vB2vd4u8MSaD6JhB438oZ1o8DB9bhY4xjB8fBXavvtKd87PwE7QCjArp1l/,
	/permalink.php?story_fbid=pfbid02aC6zYmULJUrbWKVB8MuP2c23ThvKkpR8AhktLykJCdGeas6TA3S8Sgd7sVAWHBByl/,
	/pfbid02aC6zYmULJUrbWKVB8MuP2c23ThvKkpR8AhktLykJCdGeas6TA3S8Sgd7sVAWHBByl/,
        /ask\.fm/,
        /ask\.fm\/irpp4/,
        /blogspot\.com/,
        /blogspot\.fi/,
        /irpp4\.blogspot\.com/,
        /irpp4\.blogspot\.fi/,
        /kick\.com/,
        /horizonmw\.org/,
        /github\.com/,
        /irpppas\.blogspot\.com/,
        /irpppas\.blogspot\.fi/,
        /www\.facebook\.com\/Haukkis\/friends_with_upcoming_birthdays/,
        /www\.facebook\.com\/toni\.harsunen\.1/,
        /www\.facebook\.com\/minna\.kaipio\.5/,
        /www\.tiktok\.com/,
        /sportskeeda\.com\/.*/,
        /sportskeeda\.com/,
        /wwfoldschool\.com\/.*/,
        /wwfoldschool\.com/,
        /meta\.ai/i
    ];

    const allowedUrls = [
        /is\.fi/,
        /youtube\.com/,
        /www\.youtube\.com/,
        /www\.facebook\.com/,
        /iltalehti\.fi/,
        /ks\.fi/,
    ];

    const excludedPaths = [
        '/messages/e2ee/t/',
        '/messages/e2ee/t',
        '/messages/e2ee',
        '/messages',
        '/messenger',
        '/facebook.com/messages',
        '/notifications',
        '/ilmoitukset',
        'ilmoitukset',
        'notifications',
        'messages',
        'messenger',
        'Näytä ilmoitukset',
        '/facebook.com/notifications',
        '/groups/317493608736721/',
        '/groups/342124472533278/',
        '/groups/2484497081612438/',
        '/groups/390555733810362/',
        '/groups/934038190050109/',
        '/facebook.com/Haukkis/posts/',
        '/facebook.com/tapio.haukirauma/posts/',
        'facebook.com/Haukkis/posts/',
        'facebook.com/tapio.haukirauma/posts/',
        '/facebook.com/Haukkis/posts',
        '/facebook.com/tapio.haukirauma/posts',
    ];

    const safeSelectors = [
        '[aria-label="Notifications"]',
        '[aria-label="Marketplace"]',
        '[aria-label="Ilmoitukset"]',
        '[aria-label="Messenger"]',
        '[aria-label="Stories"]',
        '[aria-label="Tarinat"]',
        'div[aria-label="Notifications"]',
        'div[aria-label="Marketplace"]',
        'div[aria-label="Ilmoitukset"]',
        'div[aria-label="Messenger"]',
        'div[aria-label="Stories"]',
        'div[aria-label="Tarinat"]',
        'span[aria-label="Notifications"]',
        'span[aria-label="Marketplace"]',
        'span[aria-label="Ilmoitukset"]',
        'span[aria-label="Messenger"]',
        'span[aria-label="Stories"]',
        'span[aria-label="Tarinat"]',
        '[role="dialog"]',
        '[tabindex="-1"]',
        '[aria-label="Marketplace"]',
        'div[role="none"][data-visualcompletion="ignore"]',
        'div.x6s0dn4.x78zum5.x1s65kcs.x1n2onr6',
        'div.xdj266r.x11i5rnm.xat24cr',
        'a[href="/marketplace/?ref=app_tab"]',
        'svg[viewBox="0 0 24 24"]',
        'span.xdj266r.x11i5rnm.xat24cr'
    ];

    // Keyword arrays
    const restrictedWords = [
        "Alexa Bliss", "Alexa WWE", "5 feet of fury", "five feet of fury", "Tiffany", "Stratton", "Tiffy time", "Stratton", "Artificial Intelligence", "Samantha", "La Leona", "Mariah May", "B-Fab",
        "Tiffany", "Mandy Rose", "Chelsea Green", "Bayley", "Mercedes", "Sasha Banks", "Sportskeeda", "Vince Russo", "Meltzer", "Shirakawa", "Samantha Irvin", "Brave Software", "AJ Lee's", "Perez",
        "All Elite Wrestling", "Dynamite", "Rampage", "AEW Collision", "Blackheart", "Flair", "Charlotte", "Charlotte", "Flair", "Becky Lynch", "Giulia", "Michin", "Samantha Irwin", "Serena Deeb",
        "Mia Yim", "AJ Lee", "Stephanie", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "Carr WWE", "Iyo Shirai", "Iyo Sky", "Leila Grey", "Trish", "Stratus", "AJ Lee", "Izzi WWE", 
        "Nick Jackson", "NXT Womens", "NXT Women", "NXT Woman", "Sunny", "Maryse", "Jackson", "DeepSeek", "DeepSeek AI", "Rhea Ripley", "Instagram", "Jakara", "Playboy", "Jaida Parker", "Deonna", 
        "Lash Legend", "Alba Fyre", "Isla Dawn", "CJ Perry", "Lana WWE", "Raquel Rodriguez", "Zelina Vega", "Alicia Fox", "Willow Nightingale", "Kris Statlander", "Kayden Carter", "Katana Chance",
        "Izzi Dame", "Girlfriend", "Girl", "Woman", "Women", "Girls", "Girl's", "Women's", "Woman's", "Womens", "Womans", "Ladys", "Lady's", "Ladies'", "Ladies", "Lady", "Dame WWE", "Perez",
        "Indi Hartwell", "Blair Davenport", "Lola Vice", "Valhalla", "Maxxine Dupri", "Karmen Petrovic", "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Io Sky", "Shirai", "Scarlett", 
        "Thea Hail", "Tatum Paxley", "Fallon Henley", "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa Leon", "Valentina", "Amari Miller", "Young Bucks", "Torrie Wilson", "Ripley!", 
        "Arianna Grace", "Zelina", "Natalya", "Nattie", "IYO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Satomura", "Candice", "LeRae", "Nia Jax", "Naomi", "Trish", "Stratus", "Roxanne", 
        "Sarray", "Xia Li", "Shayna", "Baszler", "Ronda", "Rousey", "Velvet Sky", "Carmella", "Dana Brooke", "Mercedes", "Martinez", "Marina", "Shafir", "Stacy", "Keibler", "Valkyria", "Primera", 
        "Summer Rae", "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Tatu Toiviainen", "Jessika Carr", "Jessica Karr", "Venice", "Jessica Carr", "Jessika WWE", "Jessica WWE", "Matt Jackson", 
        "Karr WWE", "Carr WWE", "Melina wrestler", "Jillian", "Mickie", "Kanellis", "Beth Phoenix", "Victoria", "Jazz WWE", "Molly Holly", "Shirai", "Priscilla", "Kelly", "Red Velvet", "Meta AI",
        "Gail Kim", "Awesome Kong", "Madison Rayne", "Velvet Sky", "Angelina", "Tessmacher", "Havok", "Su Yung", "Taya Valkyrie", "Bianca Belair", "Skye Blue", "Bordeaux", "Brooke", "Mimmi Wikman",
        "Purrazzo", "Thekla", "Toni Storm", "Britt Baker", "Jamie Hayter", "Anna Jay", "Hikaru", "Sakazaki", "Nyla Rose", "Sakura", "Penelope Ford", "Julia Hart", "Kamifuku", "Elayna", "Blake", "Monroe",
	"Saya Kamitani", "Kamitani", "Katie", "Nikkita", "Nikkita Lyons", "Lisa Marie", "Lisa Marie Varon", "Lisa Varon", "Marie Varon", "Irving", "Naomi", "Belts Mone", "Amanda Huber", "Elayna Black", 
	"Sisältö ei ole käytettävissä tällä hetkellä", "Näytä suositukset", "20. heinäkuu klo",
    ];

    const regexBlockedWords = [
        /lex bl/i, /\bSol\b/i, /\bShe\b/i, /\bHer\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bRiho\b/i, /\bCum\b/i, /\bSlut\b/i, /\bTor\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /\bAlexa\b/i, /\bTay\b/i, /\bMelo\b/i, /\bConti\b/i, /\bPaige\b/i, /\bShotzi\b/i, 
        /\bTiffy\b/i, /\bStratton\b/i, /\bAEW\b/i, /\bAi\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bAi-\b/i, /\bIvory\b/i, /\bposing\b/i, /Ripl/i, /\bSasha\b/i, /\bAnal\b/i, /\bBliss\b/i, /\bGay\b/i, /\bTrans\b/i, /\bTransvestite\b/i, /\bTransu\b/i, /\bPride\b/i, /\bLesbian\b/i, 
        /\bLesbo\b/i, /\bHomo\b/i, /\bQueer\b/i, /\bSable\b/i, /\bBella\b/i, /\bNikki\b/i, /\bBrie\b/i, /\bTegan\b/i, /\bNox\b/i, /\bGoddess\b/i, /\bLita\b/i, /\bRusso\b/i, /\bLGBT\b/i, /\bLGBTQ\b/i, /\bLGBTQ\b/i, /\bMami\b/i, /\bTrish\b/i, /\bStratus\b/i, /\bIzzi\b/i, 
        /\bDame\b/i, /\bGiulia\b/i, /\bMichin\b/i, /\bJayne\b/i, /\bLLM\b/i, /\bMLM\b/i, /Shira/i, /Steph's place/i, /Stephanie's place/i, /Steph McMahon/i, /Stepan/i, /Stratu/i, /Stratt/i, /Gina Adam/i, /\bG1na\b/i, /\bGlna\b/i, /\bG!na\b/i, /\bSol\b/i, /\bShe\b/i, 
        /\bHer\b/i, /\bHer's\b/i, /\bShe's\b/i, /\bRiho\b/i, /\bCum\b/i, /\bSlut\b/i, /\bTor\b/i, /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /\bAlexa\b/i, /\bODB\b/i, /\bLita\b/i, /\bChyna\b/i, /\bSaraya\b/i, /\bBrooke\b/i, /\bCora\b/i, /\bGin4\b/i, /\bG1n4\b/i,
        /\bTay\b/i, /\bMelo\b/i, /\bConti\b/i, /\bPaige\b/i, /\bShotzi\b/i, /\bTiffy\b/i, /\bStratton\b/i, /\bAEW\b/i, /\bAi\b/i, /\bAis\b/i, /\b-Ai\b/i, /lantaaa/i, /\bAi-\b/i, /\bIvory\b/i, /\bposing\b/i, /\bTamina\b/i, /\bTessa\b/i, /\bRuca\b/i, /\bRuby\b/i, /\bSoho\b/i,
        /\bSasha\b/i, /\bAnal\b/i, /\bBliss\b/i, /\bGay\b/i, /lantaai/i, /\bTrans\b/i, /\bTransvestite\b/i, /\bTransu\b/i, /\bPride\b/i, /\bLesbian\b/i, /\bLesbo\b/i, /\bHomo\b/i, /\bQueer\b/i, /\bSable\b/i, /\bposed\b/i, /\bLayla\b/i, /\bLana\b/i, /\bSol\b/i, /\bJacy\b/i,
        /\bBella\b/i, /\bNikki\b/i, /\bBrie\b/i, /\bTegan\b/i, /\bNox\b/i, /\b Goddess\b/i, /\bLita\b/i, /Sherilyn/i, /\bRusso\b/i, /\bLGBT\b/i, /\bLGBTQ\b/i, /\bLGBTQ\b/i, /\bMami\b/i, /\bTrish\b/i, /\bStratus\b/i, /\bYung\b/i, /\bHavok\b/i, /\bJade\b/i, /\bAthena\b/i,
        /\bIzzi\b/i, /\bFuku\b/i, /\bDame\b/i, /\bGiulia\b/i, /\bMichin\b/i, /\bJayne\b/i, /\bLLM\b/i, /\bMLM\b/i, /Shira/i, /Steph's place/i, /Stephanie's place/i, /Steph McMahon/i, /Stepan/i, /Stratu/i, /Stratt/i, /Tiffa/i, /Tiffy/i, /\bGina\b/i, /Dreambooth/i, 
    	/Dream booth/i, /Dualipa/i, /Dua Lipa/i, /Meta AI/i, /Tatu Toiviainen/i, /IInspiration/i, /IIconics/i,  /\bJade\b/i, /cargil/i, /cargirl/i, /cargril/i, /gargril/i, /gargirl/i, /garcirl/i, /watanabe/i, /barlow/i, /Nikki/i, /Saya Kamitani/i, /Kamitani/i, /Katie/i, 
	/Nikkita/i, /Nikkita Lyons/i, /Lisa Marie/i, /Lisa Marie Varon/i, /Lisa Varon/i, /Marie Varon/i, /Takaichi/i, /Sakurai/i, /Arrivederci/i, /Alice/i, /Alicy/i, /Alici/i, /Arisu Endo/i, /Crowley/i, /Ruby Soho/i, /Monica/i, /Castillo/i, /Matsumoto/i, /Shino Suzuki/i,
    ];

    const restrictedPhrases = [
        "Ryhmiä Sinulle", "Liity", "Meta AI", "Ihmisiä,", "Joita saatat tuntea", "Ihmisiä, joita saatat tuntea", "Kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea.", "Lisää kavereita saadaksesi suosituksia", "Sisältö ei ole käytettävissä tällä hetkellä", "Sinulle ehdotettua",
    ].map(s => s.toLowerCase());

    // Function to check if current path is excluded
    const isExcludedPath = (path) => excludedPaths.some(excluded => path.includes(excluded));
    
    // Function to check if element matches any safe selector
    const isSafeElement = (element) => safeSelectors.some(selector => element.closest(selector));
    
    // Function to get regex blocked words (maintain function signature)
    const getRegexBlockedWords = () => regexBlockedWords;

    // Function to get allowed URLs (maintain function signature)
    const getAllowedUrls = () => allowedUrls;

    // Function to clean the current URL
    const cleanUrl = () => {
        try {
            devLog('Cleaning URL parameters');
            const url = new URL(window.location.href);
            let modified = false;
            
            paramsToDelete.forEach(param => {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    modified = true;
                }
            });
            
            if (modified) {
                window.history.replaceState({}, document.title, url.toString());
                devLog('URL parameters cleaned');
            }
        } catch (e) {
            console.log('Error cleaning URL: ' + e.message);
        }
    };

    // Handle redirects for blocked content
    const handleRedirects = () => {
        try {
            const url = new URL(window.location.href);
            
            if (url.href === 'https://www.facebook.com' || lastRedirect === url.href) return;
            
            const isBlocked = 
                blockedFbids.some(fbid => url.pathname.includes(fbid) || url.search.includes(`fbid=${fbid}`)) ||
                blockedUrls.some(blockedUrl => blockedUrl.test(url.href));
                
            if (isBlocked) {
                lastRedirect = url.href;
                console.log('Redirecting blocked URL: ' + url.href);
                window.location.replace('https://www.facebook.com');
            }
        } catch (e) {
            console.log('Error handling redirects: ' + e.message);
        }
    };

    // Enhanced function to handle deleting images with blocked FBIDs and URLs
    const deleteBlockedElements = () => {
        try {
            const elements = document.querySelectorAll('img, a, div');
            let deletedCount = 0;
            
            elements.forEach(element => {
                const src = element.src || '';
                const dataFbid = element.getAttribute('data-fbid') || '';
                const srcSet = element.getAttribute('srcset') || '';
                const parentLink = element.closest('a') ? element.closest('a').href : '';
                const href = element.href || '';

                // Check if any of these attributes or parent link contains a blocked FBID
                if (blockedFbids.some(fbid => src.includes(fbid) || dataFbid.includes(fbid) || srcSet.includes(fbid) || parentLink.includes(fbid))) {
                    const elementToDelete = element.closest('[role="article"]') || element.closest('div') || element;
                    if (elementToDelete && !elementToDelete.closest('[role="banner"]') && !elementToDelete.closest('[role="navigation"]')) {
                        elementToDelete.remove();
                        deletedCount++;
                    }
                }

                // Check if the element's URL matches any blocked URL
                if (blockedUrls.some(blockedUrl => blockedUrl.test(href) || blockedUrl.test(parentLink))) {
                    const elementToDelete = element.closest('[role="article"]') || element.closest('div') || element;
                    if (elementToDelete && !elementToDelete.closest('[role="banner"]') && !elementToDelete.closest('[role="navigation"]')) {
                        elementToDelete.remove();
                        deletedCount++;
                    }
                }
            });
            
            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} blocked elements`);
            }
        } catch (e) {
            console.log('Error deleting blocked elements: ' + e.message);
        }
    };

    // ENHANCED: Function to scan and ban entire posts initially to prevent "Show more" issues
    // UPDATED: Add fb-post-approved class to non-banned posts for immediate visibility
    const scanAndBanEntirePosts = () => {
        try {
            devLog('Scanning entire posts for banned content');
            const postSelectors = [
                '[role="article"]',
                '[role="article"].x1lliihq',
                '[role="article"] .x1yztbdb',
                '[role="article"] .x1hc1fzr',
                'div.x1iyjqo2.x1vjfegm'
            ];

            let bannedCount = 0;
            postSelectors.forEach(selector => {
                document.querySelectorAll(selector + ':not(.fb-post-processed)').forEach(post => {
                    post.classList.add('fb-post-processed');
                    
                    // Collect all text content from the post, including expanded areas
                    const allTextElements = post.querySelectorAll('*');
                    let fullPostText = '';
                    allTextElements.forEach(el => {
                        const text = el.textContent || el.innerText || '';
                        if (text.trim()) fullPostText += text + ' ';
                    });
                    fullPostText = fullPostText.toLowerCase();

                    // Check against all blocking criteria
                    let isBanned = false;
                    
                    // Check restricted words in full post text
                    if (restrictedWords.some(word => fullPostText.includes(word.toLowerCase()))) {
                        isBanned = true;
                        devLog(`🚫 Post banned by restricted word in full content`);
                    }
                    
                    // Check regex blocked words in full post text
                    if (!isBanned && regexBlockedWords.some(regex => regex.test(fullPostText))) {
                        isBanned = true;
                        devLog(`🚫 Post banned by regex in full content`);
                    }
                    
                    // Check for blocked FBIDs in post attributes or links
                    if (!isBanned) {
                        const postLinks = post.querySelectorAll('a[href]');
                        for (let link of postLinks) {
                            const href = link.href;
                            if (blockedFbids.some(fbid => href.includes(fbid) || href.includes(`id=${fbid}`))) {
                                isBanned = true;
                                devLog(`🚫 Post banned by FBID in links`);
                                break;
                            }
                        }
                    }
                    
                    // Check for blocked URLs in post
                    if (!isBanned) {
                        const postLinks = post.querySelectorAll('a[href]');
                        for (let link of postLinks) {
                            if (blockedUrls.some(blockedUrl => blockedUrl.test(link.href))) {
                                isBanned = true;
                                devLog(`🚫 Post banned by URL in post`);
                                break;
                            }
                        }
                    }
                    
                    if (isBanned) {
                        // Permanently ban the post
                        post.classList.add('fb-post-banned');
                        post.style.setProperty('display', 'none', 'important');
                        post.style.setProperty('visibility', 'hidden', 'important');
                        post.style.setProperty('opacity', '0', 'important');
                        post.style.setProperty('pointer-events', 'none', 'important');
                        post.style.setProperty('position', 'absolute', 'important');
                        post.style.setProperty('left', '-9999px', 'important');
                        post.style.setProperty('top', '-9999px', 'important');
                        post.style.setProperty('height', '0', 'important');
                        post.style.setProperty('width', '0', 'important');
                        post.style.setProperty('overflow', 'hidden', 'important');
                        bannedCount++;
                    } else {
                        // Approve the post to ensure it shows
                        post.classList.add('fb-post-approved');
                    }
                });
            });
            
            if (bannedCount > 0) {
                devLog(`Banned ${bannedCount} entire posts initially`);
            }
        } catch (e) {
            console.log('Error scanning entire posts: ' + e.message);
        }
    };

    // IMPORTANT: This function must be separate to ensure reels are removed
    const deleteRestrictedWords = () => {
        try {
            const selectors = [
                '[role="article"]',
                '[role="article"].x1lliihq',
                '[role="article"] .x1yztbdb',
                '[role="article"] .x1hc1fzr',
                'div.x1iyjqo2.x1vjfegm',
        		'svg[aria-label="Meta AI:n profiilikuva"]',
        		'svg[aria-label*="Meta AI profile"]', 
        		'a[aria-label="Meta AI"]',
        		'div[aria-label="Meta AI"]',
        		'span[aria-label="Meta AI"]',
                'div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xn6708d.x1120s5i.x1ye3gou',
                'div.x10l6tqk.xwa60dl.x1d8287x.x19991ni.xwji4o3.x1vjfegm.xg01cxk.x47corl',
                'div.x1iyjqo2.x1vjfegm',
                'div.x6s0dn4.x78zum5.x1qughib.x1iorvi4.xjkvuk6',
                '.x1y71gwh',
                '.x1p5oq8j',
                'div.xieb3on:nth-child(1)',
                'div.xieb3on:nth-child(1) > svg:nth-child(1)',
                '.x1p5oq8j > div:nth-child(2)',
                'div.x6s0dn4.x78zum5.x1qughib.x1iorvi4.xjkvuk6',
        		'a[aria-label*="20. heinäkuu klo 14.53"]',
        		'a[href*="facebook.com/permalink"][aria-label*="20. heinäkuu klo 14.53"]'
            ];

            let removedCount = 0;
            document.querySelectorAll(selectors.join(','))
                .forEach(element => {
                    if (isSafeElement(element)) return;
                    
                    const elementText = (element.innerText || '').toLowerCase();
                    const isRestricted = restrictedWords.some(word => elementText.includes(word.toLowerCase()));
                    const isRegexBlocked = regexBlockedWords.some(regex => regex.test(elementText));
                    
                    if (isRestricted || isRegexBlocked) {
                        const elementToRemove = element.closest('[role="article"]') || element;
                        // UPDATED: Do not hide approved posts (even if comments have banned content)
                        if (!elementToRemove.classList.contains('fb-post-approved') && !elementToRemove.classList.contains('fb-post-banned') && !elementToRemove.classList.contains('fb-element-banned')) {
                            elementToRemove.classList.add('fb-element-banned');
                            elementToRemove.style.setProperty('display', 'none', 'important');
                            elementToRemove.style.setProperty('visibility', 'hidden', 'important');
                            elementToRemove.style.setProperty('opacity', '0', 'important');
                            elementToRemove.style.setProperty('pointer-events', 'none', 'important');
                            elementToRemove.style.setProperty('position', 'absolute', 'important');
                            elementToRemove.style.setProperty('left', '-9999px', 'important');
                            elementToRemove.style.setProperty('top', '-9999px', 'important');
                            elementToRemove.style.setProperty('height', '0', 'important');
                            elementToRemove.style.setProperty('width', '0', 'important');
                            elementToRemove.style.setProperty('overflow', 'hidden', 'important');
                            removedCount++;
                        }
                    }
                });
                
            if (removedCount > 0) {
                devLog(`Removed ${removedCount} elements with restricted words`);
            }
        } catch (e) {
            console.log('Error deleting restricted words: ' + e.message);
        }
    };

    // ENHANCED: Instant search result filtering with comprehensive blocking
    const processSearchResults = () => {
        try {
            devLog('Processing search results with instant filtering');
            const searchSelectors = [
                'li[role="row"]',
                'a[aria-describedby]',
                'div[role="option"]',
                'div[data-testid="search-result"]',
                'div[role="presentation"] a',
                'a[href*="facebook.com/profile.php"]',
                'a[href*="facebook.com/"][aria-describedby]'
            ];

            let processedCount = 0;
            searchSelectors.forEach(selector => {
                document.querySelectorAll(selector + ':not(.fb-search-processed)').forEach(result => {
                    result.classList.add('fb-search-processed');
                    
                    // Extract comprehensive content from search result
                    const textContent = (result.textContent || result.innerText || '').toLowerCase();
                    const href = result.href || '';
                    const ariaLabel = result.getAttribute('aria-label') || '';
                    const dataHover = result.getAttribute('data-hovercard') || '';
                    
                    // Check against all blocking criteria
                    let isBlocked = false;
                    
                    // Check restricted words
                    if (restrictedWords.some(word => 
                        textContent.includes(word.toLowerCase()) || 
                        ariaLabel.toLowerCase().includes(word.toLowerCase())
                    )) {
                        isBlocked = true;
                        devLog(`🚫 Search blocked by restricted word: "${textContent.substring(0, 30)}..."`);
                    }
                    
                    // Check regex blocked words
                    if (!isBlocked && regexBlockedWords.some(regex => 
                        regex.test(textContent) || regex.test(ariaLabel) || regex.test(href)
                    )) {
                        isBlocked = true;
                        devLog(`🚫 Search blocked by regex: "${textContent.substring(0, 30)}..."`);
                    }
                    
                    // Check blocked FBIDs in href or data attributes
                    if (!isBlocked && blockedFbids.some(fbid => 
                        href.includes(fbid) || 
                        dataHover.includes(fbid) ||
                        href.includes(`id=${fbid}`) ||
                        href.includes(`profile.php?id=${fbid}`)
                    )) {
                        isBlocked = true;
                        devLog(`🚫 Search blocked by FBID: "${textContent.substring(0, 30)}..."`);
                    }
                    
                    // Check blocked URLs
                    if (!isBlocked && blockedUrls.some(blockedUrl => 
                        blockedUrl.test(href)
                    )) {
                        isBlocked = true;
                        devLog(`🚫 Search blocked by URL pattern: "${textContent.substring(0, 30)}..."`);
                    }
                    
                    if (isBlocked) {
                        // Apply instant hiding and permanent banning
                        result.style.setProperty('display', 'none', 'important');
                        result.style.setProperty('visibility', 'hidden', 'important');
                        result.style.setProperty('opacity', '0', 'important');
                        result.style.setProperty('pointer-events', 'none', 'important');
                        result.style.setProperty('position', 'absolute', 'important');
                        result.style.setProperty('left', '-9999px', 'important');
                        result.style.setProperty('top', '-9999px', 'important');
                        result.classList.add('fb-search-banned');
                        
                        // Also hide parent containers
                        const parentLi = result.closest('li');
                        if (parentLi && parentLi !== result) {
                            parentLi.style.setProperty('display', 'none', 'important');
                            parentLi.style.setProperty('visibility', 'hidden', 'important');
                            parentLi.classList.add('fb-search-banned');
                        }
                    } else {
                        // Approve and show the search result
                        result.classList.add('fb-search-approved');
                        result.style.removeProperty('display');
                        result.style.removeProperty('visibility');
                        result.style.removeProperty('opacity');
                        result.style.removeProperty('pointer-events');
                        result.style.removeProperty('position');
                        result.style.removeProperty('left');
                    }
                    
                    processedCount++;
                });
            });
            
            if (processedCount > 0) {
                devLog(`Processed ${processedCount} search results with instant filtering`);
            }
        } catch (e) {
            console.log('Error processing search results: ' + e.message);
        }
    };

    // IMPORTANT: This function must be separate to ensure reels are removed from feed
    const deleteRestrictedPhrases = () => {
        try {
            // Cache restricted phrases in lowercase for faster matching
            const restrictedPhrasesLower = [
                "liity", "reels", "kelat", "sinulle suositeltua", "suositeltua", "tilaa", "ryhmiä sinulle", "Meta AI", "ihmisiä,", "joita saatat tuntea", "ihmisiä, joita saatat tuntea", 
                "kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea.", "lisää kavereita saadaksesi suosituksia", "Sisältö ei ole käytettävissä tällä hetkellä", "Sinulle ehdotettua",
            ];

            // Use a Set for faster lookups
            const restrictedPhrasesSet = new Set(restrictedPhrasesLower);
            
            // Cache processed elements to avoid re-processing
            const processedElements = new WeakSet();

            let removedPostCount = 0;
            // Only process new feed articles
            document.querySelectorAll('[role="feed"] [role="article"]:not([data-processed])').forEach((post) => {
                // Mark as processed to avoid re-processing
                post.dataset.processed = "true";
                
                // Check for restricted button text first (fastest check)
                let shouldRemove = false;
                const buttons = post.querySelectorAll('div[role="button"]');
                
                // Use faster forEach loop instead of Array.from.some
                for (let i = 0; i < buttons.length && !shouldRemove; i++) {
                    const btnText = buttons[i].innerText?.toLowerCase();
                    if (btnText === 'liity' || btnText === 'seuraa') {
                        shouldRemove = true;
                    }
                }
                
                // If no restricted buttons, check for phrases in key elements only
                if (!shouldRemove) {
                    // Only check headings and key containers rather than all text
                    const keyElements = post.querySelectorAll('h2, h3, h4, div.x1heor9g, div[role="button"]');
                    
                    for (let i = 0; i < keyElements.length && !shouldRemove; i++) {
                        const text = keyElements[i].innerText?.toLowerCase() || '';
                        
                        // Check for exact restricted phrases
                        for (let i = 0; i < restrictedPhrasesLower.length; i++) {
                            if (text.includes(restrictedPhrasesLower[i])) {
                                shouldRemove = true;
                                break;
                            }
                        }
                    }
                }
                
                if (shouldRemove) {
                    // Hide immediately before removing for better performance
                    if (!post.classList.contains('fb-post-banned') && !post.classList.contains('fb-element-banned')) {
                        post.classList.add('fb-element-banned');
                        post.style.display = 'none';
                        post.style.visibility = 'hidden';
                        
                        // Use a more reliable removal approach
                        const parent = post.parentNode;
                        if (parent) parent.removeChild(post);
                        removedPostCount++;
                    }
                }
            });
            
            // Look for non-article restricted content (like Reels sections)
            // Use more specific selectors and skip already processed elements
            const headerSelectors = 'h2.html-h2, div.html-h2.xdj266r';
            let removedHeaderCount = 0;
            document.querySelectorAll(headerSelectors).forEach(header => {
                // Skip if already processed or in navigation
                if (processedElements.has(header) || 
                    header.closest('header') || 
                    header.closest('[role="navigation"]') || 
                    header.closest('[role="banner"]')) {
                    return;
                }
                
                // Mark as processed
                processedElements.add(header);
                
                const headerText = header.innerText?.toLowerCase() || '';
                
                // Check if this is a restricted header
                let isRestricted = false;
                for (let i = 0; i < restrictedPhrasesLower.length && !isRestricted; i++) {
                    if (headerText.includes(restrictedPhrasesLower[i])) {
                        isRestricted = true;
                    }
                }
                
                if (isRestricted) {
                    // Find the parent section/container
                    let container = null;
                    
                    // Try these containers in order
                    if (!container) container = header.closest('[role="article"]');
                    if (!container) container = header.closest('div.x1lliihq');
                    if (!container) container = header.closest('div.x1ye3gou');
                    if (!container) container = header.closest('div.x78zum5:not([role="navigation"])');
                    
                    // Only remove if it's a valid container (not navigation and has size)
                    if (container && 
                        !container.closest('[role="navigation"]') && 
                        !container.closest('[role="banner"]') &&
                        container.offsetHeight > 40) {
                        
                        // Hide first, then remove
                        if (!container.classList.contains('fb-post-banned') && !container.classList.contains('fb-element-banned')) {
                            container.classList.add('fb-element-banned');
                            container.style.display = 'none';
                            
                            // Use direct parent removal for better performance
                            const parent = container.parentNode;
                            if (parent) parent.removeChild(container);
                            removedHeaderCount++;
                        }
                    }
                }
            });
            
            if (removedPostCount > 0 || removedHeaderCount > 0) {
                devLog(`Removed ${removedPostCount} posts and ${removedHeaderCount} headers with restricted phrases`);
            }
        } catch (e) {
            console.log('Error deleting restricted phrases: ' + e.message);
        }
    };

    // More efficient observer implementation
    let __fbPhrasesObserverInstalled = false;
    const observeForRestrictedPhrases = () => {
        try {
            if (!document.body || __fbPhrasesObserverInstalled) return;
            __fbPhrasesObserverInstalled = true;

            devLog('Setting up restricted phrases observer');
            
            // Use a throttled version of the function for better performance
            let throttleTimeout = null;
            const throttledDeletePhrases = () => {
                if (!throttleTimeout) {
                    throttleTimeout = addTimeout(() => {
                        deleteRestrictedPhrases();
                        throttleTimeout = null;
                    }, 100); // 100ms throttle
                }
            };

            // Observe only essential changes
            const observer = trackObserver(new MutationObserver((mutations) => {
                let shouldProcess = false;
                
                // Check if any mutation is relevant
                for (let i = 0; i < mutations.length; i++) {
                    const mutation = mutations[i];
                    
                    // Check for feed content
                    if (mutation.target.closest && 
                        (mutation.target.closest('[role="feed"]') || 
                         mutation.target.getAttribute?.('role') === 'feed')) {
                        shouldProcess = true;
                        break;
                    }
                    
                    // Check for added nodes with relevant content
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        for (let j = 0; j < mutation.addedNodes.length; j++) {
                            const node = mutation.addedNodes[j];
                            if (node.nodeType === 1) { // Element node
                                if (node.querySelector && (
                                    node.querySelector('h2.html-h2') || 
                                    node.querySelector('[role="article"]') ||
                                    node.querySelector('div.x1lliihq')
                                )) {
                                    shouldProcess = true;
                                    break;
                                }
                            }
                        }
                        if (shouldProcess) break;
                    }
                }
                
                // Only process if relevant mutations were found
                if (shouldProcess) {
                    throttledDeletePhrases();
                }
            }));

            observer.observe(document.body, { 
                childList: true, 
                subtree: true,
                attributes: false,
                characterData: false
            });

            // Run once immediately
            deleteRestrictedPhrases();
        } catch (e) {
            console.log('Error setting up restricted phrases observer: ' + e.message);
        }
    };

    // More efficient initialization
    if (document.readyState === 'loading') {
        onWindowEvent(window, 'DOMContentLoaded', observeForRestrictedPhrases, false);
    } else {
        // Use requestIdleCallback for non-blocking initialization if available (tracked to avoid leaks)
        addIdleCallback(observeForRestrictedPhrases);
    }

    // Function to delete "People You May Know" sections
    const deletePeopleYouMayKnow = () => {
        try {
            const selectors = [
                'div[aria-label="People You May Know"]',
                'div[aria-label="Ihmisiä, jotka saatat tuntea"]',
                'a[href="https://www.facebook.com/friends/suggestions/"]',
                'div[aria-label="Näytä suosituksia"]',
                'a[aria-label="Kaverit"]',
                'div[aria-label="Kaverit"]',
                'a[href="https://www.facebook.com/friends/"]',
                'a[href="/friends/"]',
                'div[aria-label="Kaverit"] > span.x1lliihq',
                'li.x1iyjqo2.xmlsiyf.x1hxoosp.x1l38jg0.x1awlv9s.x1i64zmx.x1gz44f',
                '.x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1)',
                'div.x1i10hfl:nth-child(13)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(1)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(2)',
                'div.x1i10hfl:nth-child(13) > div:nth-child(3)',
                '.x6s0dn4.x1obq294.x5a5i1n:has(.x1gslohp > span:empty)',
                'li.x1c1uobl.x18d9i69.xyri2b.xexx8yu.x1lziwak.xat24cr.x14z9mp.xdj266r.html-li:nth-of-type(2)',
                'svg[aria-label="Meta AI:n profiilikuva"]',
                'svg[aria-label*="Meta AI profile"]',
                'div.x1gefphp.xf7dkkf.x1l90r2v.xv54qhq.xyamay9.x1e56ztr.x78zum5.x9f619.x1olyfxc.x15x8krk.xde0f50.x5a5i1n.x1obq294.x6s0dn4:nth-of-type(6)',
                '.xjkvuk6.x1iorvi4.x1qughib.x78zum5.x6s0dn4',
                '.x1vjfegm.x1iyjqo2',
                'div.x1a02dak:nth-child(3) > div:nth-child(1)',
                'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)',
                'div.xnp8db0:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
                '.x1ye3gou.x1120s5i.xn6708d.xz9dl7a.x1qughib.x1q0g3np.x78zum5',
                '.xbbxn1n.xwxc41k.xxbr6pl.x1p5oq8j.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div',
                '.x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
                /* ENHANCED: All PYMK selectors for instant hiding */
                '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6',
                '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d',
                'svg[viewBox="0 0 112 112"][width="112"][height="112"].xfx01vb.x1lliihq.x1tzjh5l.x1k90msu.x2h7rmj.x1qfuztq',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.x6s0dn4.x78zum5.xdt5ytf.xl56j7k.x1p5oq8j.x64bnmy.xwxc41k.x13jy36j',
                'div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x8cjs6t.x13fuv20.x178xt8z',
                'div.x1exxf4d.xpv9jar.x1nb4dca.x1nmn18.x1obq294.x5a5i1n.xde0f50.x15x8krk.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x178xt8z.x1lun4ml.xso031l.xpilrb4.xev17xk.x1xmf6yo'
            ];

            let deletedCount = 0;
            document.querySelectorAll(selectors.join(','))
                .forEach(element => {
                    if (!element.classList.contains('fb-element-banned')) {
                        element.classList.add('fb-element-banned');
                        element.style.setProperty('display', 'none', 'important');
                        element.style.setProperty('visibility', 'hidden', 'important');
                        element.style.setProperty('opacity', '0', 'important');
                        element.style.setProperty('pointer-events', 'none', 'important');
                        element.style.setProperty('position', 'absolute', 'important');
                        element.style.setProperty('left', '-9999px', 'important');
                        element.style.setProperty('top', '-9999px', 'important');
                        element.style.setProperty('height', '0', 'important');
                        element.style.setProperty('width', '0', 'important');
                        element.style.setProperty('overflow', 'hidden', 'important');
                        deletedCount++;
                    }
                });
                
            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} "People You May Know" elements`);
            }
        } catch (e) {
            console.log('Error deleting People You May Know: ' + e.message);
        }
    };

    // Delete specific elements
    const deleteElement = () => {
        try {
            const selectors = [
                'div[aria-label="Näytä suosituksia"].x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x1ypdohk.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5',
                'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suosituksia"]',
                'div[aria-label="Näytä suosituksia"] .x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x',
                'div[aria-label="Näytä suosituksia"] .x1ey2m1c.xds687c.x17qophe.xg01cxk.x47corl.x10l6tqk.x13vifvy.x1ebt8du.x19991ni.x1dhq9h.x1o1ewxj.x3x9cwd.x1e5q0jg.x3x9cwd',
                'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suosituksia"] .x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x',
                'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suosituksia"] .x1ey2m1c.xds687c.x17qophe.xg01cxk.x47corl.x10l6tqk.x13vifvy.x1ebt8du.x19991ni.x1dhq9h.x1o1ewxj.x3x9cwd',
                'div.x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
        		'[aria-label="Näytä suositukset"]',
                '[role="button"][aria-label="Näytä suositukset"]'
            ];

            let deletedCount = 0;
            document.querySelectorAll(selectors.join(','))
                .forEach(element => {
                    if (!element.classList.contains('fb-element-banned')) {
                        element.classList.add('fb-element-banned');
                        element.style.setProperty('display', 'none', 'important');
                        element.style.setProperty('visibility', 'hidden', 'important');
                        element.style.setProperty('opacity', '0', 'important');
                        element.style.setProperty('pointer-events', 'none', 'important');
                        element.style.setProperty('position', 'absolute', 'important');
                        element.style.setProperty('left', '-9999px', 'important');
                        element.style.setProperty('top', '-9999px', 'important');
                        element.style.setProperty('height', '0', 'important');
                        element.style.setProperty('width', '0', 'important');
                        element.style.setProperty('overflow', 'hidden', 'important');
                        deletedCount++;
                    }
                });
                
            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} specific elements`);
            }
        } catch (e) {
            console.log('Error deleting specific elements: ' + e.message);
        }
    };

    // FIXED: Helper function with proper URL matching
    function isSupportedFacebookPage(currentUrl, supportedPages) {
        try {
            const url = new URL(currentUrl);
            
            return supportedPages.some(pageUrl => {
                try {
                    const page = new URL(pageUrl);
                    // Must be same host
                    if (url.host !== page.host) return false;
                    
                    // Extract the page path (e.g., "/four3four")
                    const basePath = page.pathname.replace(/\/+$/, '');
                    const currentPath = url.pathname.replace(/\/+$/, '');
                    
                    // Exact match OR subpage match
                    return currentPath === basePath || currentPath.startsWith(basePath + '/');
                } catch (e) {
                    return false;
                }
            });
        } catch (e) {
            return false;
        }
    }

    // ENHANCED: Inject CSS for specific URL prehide to prevent flashes on supported pages
    const injectSpecificUrlPrehideCSS = () => {
        try {
            const currentUrl = window.location.href;
            const supportedUrls = [
                "https://www.facebook.com/four3four",
                "https://www.facebook.com/ItsStillRealToUsDammit",
                // Add more URLs here!
            ];

            // Only inject if we're on a supported page
            if (!isSupportedFacebookPage(currentUrl, supportedUrls)) {
                return;
            }

            console.log('Current URL: ' + currentUrl);
            devLog('Injecting specific URL prehide CSS for supported pages');
            let style = document.getElementById('fb-specific-url-prehide-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'fb-specific-url-prehide-style';
            }
            style.textContent = `
            /* PREHIDE CSS: Hide selectors immediately on supported pages to prevent flashes */
            .x1120s5i.x1n2onr6.x10wlt62.x6ikm8r.x1lliihq,
            .x1cnzs8.xjkvuk6.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6,
            .xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619,
            .x7wzq59 > div > div > div > .x1yztbdb > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f61,
            .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w > .xt0psk2,
            footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w,
            .x1xzczws.x7ep2pv.x1d1medc.xnp8db0.x1i64zmx.x1e56ztr.x1emribx.x1xmf6yo.xjl7jj.xs83m0k.xeuugli.x1ja2u2z.x1n2onr6.x9f619,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph > .xeuug,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1k70j0n.xzueoph > .xeuug,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph,
            .x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619,
            .xifccgj.x4cne27.xbmpl8g.xykv574.x1y1aw1k.xwib8y2.x1ye3gou.xn6708d.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619,
            .x1y1aw1k.x150jy0e.x1e558r4.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619,
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo,
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6 > .x2lwn1j.x1iyjqo2.x,
            .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6,
            .x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n,
            .xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619,
            .x1x99re3.x1jdnuiz.x1r1pt67.x1qhmfi1.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k,
            .xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.xh8yej3.xdsb8wn.x10l6tqk.x5yr21d.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x2lah0s.x78zum5.x1ja2u2z.x9f619,
            .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1n2onr6.x10wlt62.x6ikm8r.x1ja2u2z.x9f619,
            div[aria-label="Photos"],
            .xieb3on,
            div.x9f619.x1n2onr6.x1ja2u2z.xeuugli.xs83m0k.xjl7jj.x1xmf6yo.x1xegmmw.x1e56ztr.x13fj5qh.xnp8db0.x1d1medc.x7ep2pv.x1xzczws,
            '*:contains("Suositeltu")',
            '*:contains("Recommended")',
            'div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so.xau1kf4.x9f619.xh8yej3.x6ikm8r.x10wlt62.xquyuld:has(.x1k70j0n.xzueoph)',
            footer .xi81zsa,
            .xh8yej3 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r,
            h2.html-h2.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1vvkbs.x1heor9g.x1qlqyl8.x1pd3egz.x1a2a7pz.x193iq5w.xeuugli {
                visibility: hidden !important;
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
                content-visibility: hidden !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
            `;
            // Safe append (no document.write)
            if (!style.isConnected) {
                if (document.head) {
                    document.head.appendChild(style);
                    devLog('Specific URL prehide CSS injected to head');
                } else if (document.documentElement) {
                    document.documentElement.appendChild(style);
                    devLog('Specific URL prehide CSS injected to documentElement');
                }
            } else {
                devLog('Specific URL prehide CSS updated (reuse existing style node)');
            }
        } catch (err) {
            console.log('Error while injecting specific URL prehide CSS: ' + err.message);
        }
    };

    // Run specific URL prehide CSS injection immediately
    injectSpecificUrlPrehideCSS();

// FIXED: Function to delete elements for specific URLs - now with proper URL restriction
const deleteSelectorsForSpecificUrl = () => {
    try {
        const currentUrl = window.location.href;
        const supportedUrls = [
            "https://www.facebook.com/four3four",
            "https://www.facebook.com/ItsStillRealToUsDammit",
            // Add more URLs here!
        ];

        // FIXED: Only run if we're actually on one of the supported pages
        if (!isSupportedFacebookPage(currentUrl, supportedUrls)) {
            return; // Exit early if not on supported page
        }

        devLog('Applying selectors for supported URLs');
        const selectorsToDelete = [
            '.x1120s5i.x1n2onr6.x10wlt62.x6ikm8r.x1lliihq',
            'div.x1n2onr6.x1ja2u2z.x1jx94hy.xw5cjc7.x1dmpuos.x1vsv7so.xau1kf4.x9f619.xh8yej3.x6ikm8r.x10wlt62.xquyuld:has(.x1k70j0n.xzueoph)',
            '.x1cnzs8.xjkvuk6.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6',
            '.xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
            '.x7wzq59 > div > div > div > .x1yztbdb > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f61',
            '.xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w > .xt0psk2',
            'footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w',
            '.x1xzczws.x7ep2pv.x1d1medc.xnp8db0.x1i64zmx.x1e56ztr.x1emribx.x1xmf6yo.xjl7jj.xs83m0k.xeuugli.x1ja2u2z.x1n2onr6.x9f619',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph > .xeuug',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1k70j0n.xzueoph > .xeuug',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
            '.xifccgj.x4cne27.xbmpl8g.xykv574.x1y1aw1k.xwib8y2.x1ye3gou.xn6708d.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
            '.x1y1aw1k.x150jy0e.x1e558r4.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
            '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
            '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6 > .x2lwn1j.x1iyjqo2.x',
            '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6',
            '.x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n',
            '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
            '.x1x99re3.x1jdnuiz.x1r1pt67.x1qhmfi1.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k',
            '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.xh8yej3.xdsb8wn.x10l6tqk.x5yr21d.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x2lah0s.x78zum5.x1ja2u2z.x9f619',
            '.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1n2onr6.x10wlt62.x6ikm8r.x1ja2u2z.x9f619',
            'div[aria-label="Photos"]',
            '.xieb3on',
            'div.x9f619.x1n2onr6.x1ja2u2z.xeuugli.xs83m0k.xjl7jj.x1xmf6yo.x1xegmmw.x1e56ztr.x13fj5qh.xnp8db0.x1d1medc.x7ep2pv.x1xzczws',
            '*:contains("Suositeltu")',
            '*:contains("Recommended")',
            'footer .xi81zsa',
            'div[style*="border-radius:max(0px, min(var(--card-corner-radius), calc((100vw - 4px - 100%) * 9999))) / var(--card-corner-radius)"]',
            '.xh8yej3 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r',
		'h2.html-h2.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1vvkbs.x1heor9g.x1qlqyl8.x1pd3egz.x1a2a7pz.x193iq5w.xeuugli',
        ];

        let deletedCount = 0;
        selectorsToDelete.forEach(selector => {
            // Handle :has() manually
            if (selector.includes(':has(')) {
                const hasMatch = selector.match(/^(.*?):has\((.*?)\)$/);
                if (hasMatch) {
                    const baseSelector = hasMatch[1];
                    const hasContent = hasMatch[2];
                    document.querySelectorAll(baseSelector).forEach(element => {
                        if (element.querySelector(hasContent) && !element.classList.contains('fb-element-banned')) {
                            element.classList.add('fb-element-banned');
                            element.style.setProperty('display', 'none', 'important');
                            element.style.setProperty('visibility', 'hidden', 'important');
                            element.style.setProperty('opacity', '0', 'important');
                            element.style.setProperty('pointer-events', 'none', 'important');
                            element.style.setProperty('position', 'absolute', 'important');
                            element.style.setProperty('left', '-9999px', 'important');
                            element.style.setProperty('top', '-9999px', 'important');
                            element.style.setProperty('height', '0', 'important');
                            element.style.setProperty('width', '0', 'important');
                            element.style.setProperty('overflow', 'hidden', 'important');
                            deletedCount++;
                        }
                    });
                }
            }
            // Handle :contains() manually
            else if (selector.includes(':contains(')) {
                const text = selector.match(/\:contains\("([^"]+)"\)/)?.[1];
                if (text) {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    let node;
                    while (node = walker.nextNode()) {
                        if (node.nodeValue.includes(text)) {
                            let parent = node.parentElement;
                            while (parent && parent !== document.body) {
                                if (parent.classList.contains('x1yztbdb') ||
                                    parent.classList.contains('html-div')) {
                                    if (!parent.classList.contains('fb-element-banned')) {
                                        parent.classList.add('fb-element-banned');
                                        parent.style.setProperty('display', 'none', 'important');
                                        parent.style.setProperty('visibility', 'hidden', 'important');
                                        parent.style.setProperty('opacity', '0', 'important');
                                        parent.style.setProperty('pointer-events', 'none', 'important');
                                        parent.style.setProperty('position', 'absolute', 'important');
                                        parent.style.setProperty('left', '-9999px', 'important');
                                        parent.style.setProperty('top', '-9999px', 'important');
                                        parent.style.setProperty('height', '0', 'important');
                                        parent.style.setProperty('width', '0', 'important');
                                        parent.style.setProperty('overflow', 'hidden', 'important');
                                        deletedCount++;
                                    }
                                    break;
                                }
                                parent = parentElement;
                            }
                        }
                    }
                }
            } else {
                // Normal selectors
                document.querySelectorAll(selector).forEach(element => {
                    if (!element.classList.contains('fb-element-banned')) {
                        element.classList.add('fb-element-banned');
                        element.style.setProperty('display', 'none', 'important');
                        element.style.setProperty('visibility', 'hidden', 'important');
                        element.style.setProperty('opacity', '0', 'important');
                        element.style.setProperty('pointer-events', 'none', 'important');
                        element.style.setProperty('position', 'absolute', 'important');
                        element.style.setProperty('left', '-9999px', 'important');
                        element.style.setProperty('top', '-9999px', 'important');
                        element.style.setProperty('height', '0', 'important');
                        element.style.setProperty('width', '0', 'important');
                        element.style.setProperty('overflow', 'hidden', 'important');
                        deletedCount++;
                    }
                });
            }
        });

        if (deletedCount > 0) {
            devLog(`Deleted ${deletedCount} elements for supported URLs`);
        }
    } catch (e) {
        console.log('Error deleting selectors for specific URLs: ' + e.message);
    }
};

    // FIXED: Function to delete elements for specific profiles - now with proper URL restriction
    const deleteSelectorsForSpecificProfile = () => {
        try {
            const currentUrl = window.location.href;
            const url = new URL(currentUrl);
            const profileIds = [
                '100000639309471',
        	'jiri.innanen',
            ];

            // FIXED: Strictly match only these profile pages
            const matchesProfile = profileIds.some(profileId => {
                return (
                    (url.pathname === '/profile.php' && url.searchParams.get('id') === profileId) ||
                    (url.pathname === `/${profileId}` || url.pathname === `/${profileId}/`)
                );
            });
            
            // FIXED: Only run if we're actually on one of the specified profiles
            if (!matchesProfile) {
                return; // Exit early if not on specified profile
            }
            
            devLog('Applying selectors for specific profiles');
            const selectorsToDelete = [
                '.x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n',
                '.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > div > .x1jfb8zj.x1qrby5j.x1n2onr6.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.x1qhmfi1.x1pdmqnj.x9f619.x178xt8z.xm81vs4.xso031l.xy80clv.x1xmf6yo',
                '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.x78zum5 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div',
                '.x78zum5 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
                '.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xamitd3.xeuugli.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x78zum5',
                '.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xamitd3.xeuugli.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
                '.x2lah0s.xvo6coq.x1ve1bff.x1q0g3np.xozqiw3.x1qjc9v5.xl56j7k.x1n2onr6.x78zum5.x1ja2u2z.x9f619 > .x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
                '.x2lah0s.xvo6coq.x1ve1bff.x1q0g3np.xozqiw3.x1qjc9v5.xl56j7k.x1n2onr6.x78zum5.x1ja2u2z.x9f619',
                '.x7wzq59.x1xzczws.x1ja2u2z.x9f619',
                'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x13vifvy.x16tdsg8.x1xmf6yo',
                'div.x78zum5.x12nagc.x1n2onr6.x1s6qhgt:empty',
                '.x7wzq59 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2)',
                '.x7wzq59 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)',
                'div.xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619:nth-of-type(2)',
                'div.x1yztbdb:nth-child(2)',
                'div.x1yztbdb:nth-child(2) > div:nth-child(1)',
                'div.x1yztbdb:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.x1yztbdb:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(1)',
                'div.xamitd3:nth-child(2)',
                'div.xamitd3:nth-child(2) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > span:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > span:nth-child(1) > span:nth-child(1) > span:nth-child(1)',
                'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2)',
                '.x6d00yu',
                'mount_0_0_9k > div > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div.x78zum5.xdt5ytf.x1t2pt76 > div > div > div.x6s0dn4.x78zum5.xdt5ytf.x193iq5w > div.x9f619.x193iq5w.x1talbiv.x1sltb1f.x3fxtfs.xf7dkkf.xv54qhq.xw7yly9 > div > div.x9f619.x1n2onr6.x1ja2u2z.xeuugli.xs83m0k.xjl7jj.x1xmf6yo.x1xegmmw.x1e56ztr.x13fj5qh.xnp8db0.x1d1medc.x7ep2pv.x1xzczws > div.x7wzq59 > div > div:nth-child(2) > div > div',
                'div[aria-label="Suodattimet"]',
                'div[aria-label="Filters"]',
                'div[aria-label="Suodattimet"][role="button"]',
                'div[aria-label="Filters"][role="button"]',
                '.x1i10hfl.xjbqb8w.x1ejq31n.x18oe1m7.x1sy0etr.xstzfhl.x972fbf.x10w94by.x1qhh985.x14e42zd.x1ypdohk.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x16tdsg8.xat24cr.x1mh8g0r.x6s0dn4.x78zum5.xdt5ytf.xjy6m2a.xl56j7k',
                '.x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.x14ldlfn.x1b1wa69.xws8118.x5fzff1.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.xpdmqnj.x1g0dm76.x1qhmfi1.x1r1pt67',
                'h2:contains("Julkaisut")',
                'span:contains("Julkaisut")',
                'div:contains("Suodattimet")',
                'span:contains("Suodattimet")'
            ];
            
            let deletedCount = 0;
            selectorsToDelete.forEach(selector => {
                document.querySelectorAll(selector)
                    .forEach(element => {
                        if (!element.classList.contains('fb-element-banned')) {
                            element.classList.add('fb-element-banned');
                            element.style.setProperty('display', 'none', 'important');
                            element.style.setProperty('visibility', 'hidden', 'important');
                            element.style.setProperty('opacity', '0', 'important');
                            element.style.setProperty('pointer-events', 'none', 'important');
                            element.style.setProperty('position', 'absolute', 'important');
                            element.style.setProperty('left', '-9999px', 'important');
                            element.style.setProperty('top', '-9999px', 'important');
                            element.style.setProperty('height', '0', 'important');
                            element.style.setProperty('width', '0', 'important');
                            element.style.setProperty('overflow', 'hidden', 'important');
                            deletedCount++;
                        }
                    });
            });
            
            if (deletedCount > 0) {
                devLog(`Deleted ${deletedCount} elements for specific profiles`);
            }
        } catch (e) {
            console.log('Error deleting selectors for specific profiles: ' + e.message);
        }
    };

// Function to delete elements for a personal profile - now with support for multiple URLs
const deleteSelectorsForPersonalProfile = () => {
    try {
        const currentUrl = window.location.href;

        // Allowed URLs: add strings (exact match, trailing slash ignored) or RegExp patterns.
        const allowedUrls = [
		'https://www.facebook.com/Haukkis/friends',
		'https://www.facebook.com/Haukkis/friends_all',
		'https://www.facebook.com/Haukkis/friends_with_upcoming_birthdays'	
        ];

        // Normalize URL (ignore hash, handle trailing slash) and test against allowlist
        const normalizeForCompare = (u) => {
            try {
                const url = new URL(u);
                url.hash = '';
                return url.toString().replace(/\/+$/, '');
            } catch {
                return String(u).replace(/#.*$/, '').replace(/\/+$/, '');
            }
        };

        const isAllowed = allowedUrls.some((matcher) => {
            if (typeof matcher === 'string') {
                return normalizeForCompare(currentUrl) === normalizeForCompare(matcher);
            } else if (matcher instanceof RegExp) {
                return matcher.test(currentUrl.replace(/\/+$/, ''));
            }
            return false;
        });

        if (!isAllowed) {
            return;
        }

        devLog('Applying selectors for personal profile');

        const personalProfileSelectors = [
            'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x13vifvy.x16tdsg8.x1xmf6yo',
            'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x13vifvy.x16tdsg8.x1xmf6yo',
            'span:contains("Poista kavereista")',
            'div[role="menuitem"] span:contains("Poista kavereista")',
            'i[style*="BXcBrMYpzXO.png"][style*="background-position: 0px -84px"]',
        ];

        let deletedCount = 0;
        personalProfileSelectors.forEach(selector => {
            if (selector.includes(':contains(')) {
                const text = selector.match(/\:contains\("([^"]+)"\)/)?.[1];
                if (text) {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    let node;
                    while ((node = walker.nextNode())) {
                        if (node.nodeValue.includes(text)) {
                            let parent = node.parentElement;
                            while (parent && parent !== document.body) {
                                if (parent.getAttribute('role') === 'menuitem' &&
                                    parent.textContent.includes('Poista kavereista')) {
                                    if (!parent.classList.contains('fb-element-banned')) {
                                        parent.classList.add('fb-element-banned');
                                        parent.style.setProperty('display', 'none', 'important');
                                        parent.style.setProperty('visibility', 'hidden', 'important');
                                        parent.style.setProperty('opacity', '0', 'important');
                                        parent.style.setProperty('pointer-events', 'none', 'important');
                                        parent.style.setProperty('position', 'absolute', 'important');
                                        parent.style.setProperty('left', '-9999px', 'important');
                                        parent.style.setProperty('top', '-9999px', 'important');
                                        parent.style.setProperty('height', '0', 'important');
                                        parent.style.setProperty('width', '0', 'important');
                                        parent.style.setProperty('overflow', 'hidden', 'important');
                                        deletedCount++;
                                    }
                                    break;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }
                }
            } else {
                document.querySelectorAll(selector).forEach(el => {
                    if (!el.classList.contains('fb-element-banned')) {
                        el.classList.add('fb-element-banned');
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('visibility', 'hidden', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        el.style.setProperty('pointer-events', 'none', 'important');
                        el.style.setProperty('position', 'absolute', 'important');
                        el.style.setProperty('left', '-9999px', 'important');
                        el.style.setProperty('top', '-9999px', 'important');
                        el.style.setProperty('height', '0', 'important');
                        el.style.setProperty('width', '0', 'important');
                        el.style.setProperty('overflow', 'hidden', 'important');
                        deletedCount++;
                    }
                });
            }
        });

        if (deletedCount > 0) {
            devLog(`Deleted ${deletedCount} elements for personal profile`);
        }
    } catch (e) {
        console.log('Error deleting selectors for personal profile: ' + e.message);
    }
};

    // Intercept navigation to blocked URLs
    let __fbNavInterceptInstalled = false;
    const interceptNavigation = () => {
        try {
            if (__fbNavInterceptInstalled) return;
            __fbNavInterceptInstalled = true;

            devLog('Setting up navigation interception');

            const clickHandler = (event) => {
                const target = event.target.closest && event.target.closest('a');
                if (target && blockedUrls.some(blockedUrl => blockedUrl.test(target.href))) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log('Blocked navigation to: ' + target.href);
                }
            };
            const submitHandler = (event) => {
                const form = event.target;
                const action = form.action || '';
                if (blockedUrls.some(blockedUrl => blockedUrl.test(action))) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log('Blocked form submission to: ' + action);
                }
            };

            onWindowEvent(document, 'click', clickHandler, true);
            onWindowEvent(document, 'submit', submitHandler, true);
        } catch (e) {
            console.log('Error setting up navigation interception: ' + e.message);
        }
    };

    // ENHANCED: DOM observer with instant search result processing and full post scanning
    let __fbDomObserverInstalled = false;
    const observeDOMChanges = () => {
        try {
            if (__fbDomObserverInstalled) return;
            __fbDomObserverInstalled = true;

            devLog('Setting up DOM observer with instant search processing and full post scanning');

            const throttledRunAllFilters = createThrottle(() => runAllFilters(), 10);

            const observer = trackObserver(new MutationObserver((mutations) => {
                // Check for search-related changes first for instant processing
                let hasSearchChanges = false;
                mutations.forEach(mutation => {
                    mutation.addedNodes && mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.matches && (
                            node.matches('li[role="row"]') ||
                            node.matches('a[aria-describedby]') ||
                            node.matches('div[role="option"]') ||
                            node.matches('div[role="presentation"]')
                        )) {
                            hasSearchChanges = true;
                        }
                    });
                });

                // Process search results immediately if detected
                if (hasSearchChanges) {
                    processSearchResults();
                }

                // Then run other filtering functions (throttled)
                throttledRunAllFilters();
            }));
            
            observer.observe(document.documentElement, { 
                childList: true, 
                subtree: true,
                attributes: false,
                characterData: false
            });
        } catch (e) {
            console.log('Error setting up DOM observer: ' + e.message);
        }
    };

    // ENHANCED: Run all filtering functions with full post scanning
    const runAllFilters = () => {
        try {
            handleRedirects();
            cleanUrl();
            hideCriticalElements();
            deleteBlockedElements();
            scanAndBanEntirePosts(); // Added full post scanning initially
            deleteRestrictedWords();
            processSearchResults(); // Added search result processing
            deleteRestrictedPhrases();
            deletePeopleYouMayKnow();
            // FIXED: These now check URLs internally before running
            deleteSelectorsForSpecificUrl();
            deleteSelectorsForSpecificProfile();
            deleteSelectorsForPersonalProfile();
            deleteElement();
        } catch (e) {
            console.log('Error running all filters: ' + e.message);
        }
    };

    // NEW: Immediate initialization function for zero-glimpse hiding
    const immediateInit = () => {
        devLog('Running immediate init for zero-glimpse hiding');
        hideCriticalElements();
        scanAndBanEntirePosts();
        deleteRestrictedWords();
        processSearchResults();
        deleteRestrictedPhrases();
        deletePeopleYouMayKnow();
        // FIXED: These now check URLs internally
        deleteSelectorsForSpecificUrl();
        deleteSelectorsForSpecificProfile();
        deleteSelectorsForPersonalProfile();
        deleteElement();
    };

    // Ensure DOM is ready before initializing
    const ensureDOMReady = () => {
        if (document.readyState === 'loading') {
            onWindowEvent(window, 'DOMContentLoaded', observeForRestrictedPhrases, false);
        } else {
            observeDOMChanges();
            observeForRestrictedPhrases();
            interceptNavigation();
        }
    };

    // Initialize the script
    const init = () => {
        devLog('Initializing Facebook script with instant search hiding and full post scanning');
        ensureDOMReady();
        handleRedirects();
        cleanUrl();
        deleteBlockedElements();
        scanAndBanEntirePosts(); // Added full post scanning to initialization
        deleteRestrictedWords();
        processSearchResults(); // Added search result processing to initialization
        deleteRestrictedPhrases();
        deletePeopleYouMayKnow();
        // FIXED: These now check URLs internally before running
        deleteSelectorsForSpecificUrl();
        deleteSelectorsForSpecificProfile();
        deleteSelectorsForPersonalProfile();
        deleteElement();

        // ANTI-FLASHING: Add pageshow event to re-hide on navigation (e.g., back/forward cache)
        onWindowEvent(window, 'pageshow', (event) => {
            if (event.persisted) {
                // Page was restored from bfcache, re-run hiding
                runAllFilters();
            }
        }, false);
    };

    // Start initialization
    init();

    // ENHANCED: Run immediate init right after CSS injection for zero-glimpse
    immediateInit();

    // Attach event listeners for changes (tracked for cleanup)
    onWindowEvent(window, 'DOMContentLoaded', runAllFilters, false);
    onWindowEvent(window, 'load', runAllFilters, false);
    onWindowEvent(window, 'popstate', runAllFilters, false);

    // Main interval scheduler (kept at 20ms; paused when tab hidden)
    function scheduleMainInterval() {
        addInterval(() => {
            if (!document.hidden) {
                runAllFilters();
            }
        }, 20);
    }

    // Start intervals now (foreground), pause/resume on visibility changes
    startIntervals(scheduleMainInterval);
    onWindowEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleMainInterval);
            runAllFilters();
        }
    }, false);

    // Teardown on pagehide/beforeunload to avoid leaks
    onWindowEvent(window, 'pagehide', cleanup, false);
    onWindowEvent(window, 'beforeunload', cleanup, false);

})();