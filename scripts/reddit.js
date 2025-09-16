// --- EARLY PRE-HIDE + MAIN-WORLD SHADOW-SAFE HOOK (keep this at the very top; run at document_start) ---
(() => {
  'use strict';

  if (window.__nrAnswersEarlyInstalled) return;
  window.__nrAnswersEarlyInstalled = true;

  // Inject a tiny script into the page's MAIN world so we can hook attachShadow
  function injectIntoPage(fn) {
    try {
      const el = document.createElement('script');
      el.type = 'text/javascript';
      el.textContent = `;(${fn})();`;
      (document.documentElement || document.head).appendChild(el);
      el.remove();
    } catch {}
  }

  // Early pre-hide CSS for light DOM (shadow roots require JS removal)
  (function injectPrehideCss() {
    try {
      const id = 'nr-answers-prehide-css';
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        /* Hide Answers quickly in light DOM (cannot penetrate shadow DOM) */
        nav a[href="/answers"],
        nav a[href="/answers/"],
        nav a[href^="/answers"],
        nav li:has(> a[href^="/answers"]),
        faceplate-tracker[source="nav"] a[href="/answers"],
        faceplate-tracker[source="nav"] a[href^="/answers"],
        faceplate-tracker[source="nav"] li:has(> a[href^="/answers"]),
        nav a:has(> svg[icon-name="answers-outline"]),
        faceplate-tracker[source="nav"] a:has(> svg[icon-name="answers-outline"]),
        a[aria-label="Answers"],
        a[aria-label*="Answers" i],
        /* Keep exact matches too */
        a[href="/answers"],
        a[href="/answers/"],
        a[href^="/answers"],
        /* Old version: BETA badge span that visually reveals the entry */
        span.text-global-admin.font-semibold.text-12 {
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

  // MAIN world hook: remove "Answers" from light DOM and any shadow roots (open/closed) created after this point
  injectIntoPage(function pageWorldHook() {
    'use strict';

    if (window.__nrAnswersPageHooked) return;
    window.__nrAnswersPageHooked = true;

    function killNodeContainer(node) {
      if (!node) return;
      try {
        const li = node.closest && node.closest('li[role="presentation"]');
        const target = li || (node.closest && node.closest('a, div, faceplate-tracker, nav')) || node;
        target && target.remove && target.remove();
      } catch {}
    }

    function removeAnswersIn(root) {
      try {
        if (!root || !root.querySelectorAll) return;

        // Href-based
        root.querySelectorAll('a[href="/answers"], a[href="/answers/"], a[href^="/answers"]').forEach(killNodeContainer);

        // Aria-based
        root.querySelectorAll('a[aria-label="Answers"], a[aria-label*="Answers" i]').forEach(killNodeContainer);

        // Icon-based
        root.querySelectorAll('svg[icon-name="answers-outline"]').forEach(svg => killNodeContainer(svg.closest('a') || svg));

        // BETA badge span (old version indicator)
        root.querySelectorAll('span.text-global-admin.font-semibold.text-12').forEach(span => {
          const txt = (span.textContent || '').trim();
          const parent = span.closest && span.closest('a, li, div, faceplate-tracker, nav');
          if (parent && /answers/i.test(parent.textContent || '') || /^beta$/i.test(txt)) {
            killNodeContainer(parent || span);
          }
        });

        // Text-based (scoped to nav-like containers)
        root.querySelectorAll('nav, aside, [id*="nav"], [class*="nav"], faceplate-tracker[source="nav"], faceplate-tracker[noun="gen_guides_sidebar"]').forEach(scope => {
          const items = scope.querySelectorAll('a, li[role="presentation"], button, span');
          for (let i = 0; i < items.length; i++) {
            const t = (items[i].textContent || '').trim();
            if (t && /(^|\s)answers(\s|$)/i.test(t)) {
              killNodeContainer(items[i]);
            }
          }
        });
      } catch {}
    }

    // Expose a lightweight remover for the Firefox fallback to call from content script
    try {
      if (!window.__nrRemoveAnswersIn_forFF) {
        window.__nrRemoveAnswersIn_forFF = function(root) {
          try { removeAnswersIn(root); } catch {}
        };
      }
    } catch {}

    // Process existing open shadow roots (covers Declarative Shadow DOM with mode="open")
    (function scanExistingOpenShadows() {
      try {
        const all = document.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          if (el && el.shadowRoot) {
            removeAnswersIn(el.shadowRoot);
            try {
              const mo = new MutationObserver(() => removeAnswersIn(el.shadowRoot));
              mo.observe(el.shadowRoot, { childList: true, subtree: true });
            } catch {}
          }
        }
      } catch {}
    })();

    // Observe nav-like containers in page world
    (function observeNav() {
      try {
        const observeOne = (nav) => {
          if (!nav || nav.__nrAnswersObserved) return;
          nav.__nrAnswersObserved = true;
          const mo = new MutationObserver(() => removeAnswersIn(nav));
          mo.observe(nav, { childList: true, subtree: true });
        };

        document.querySelectorAll('nav, aside, faceplate-tracker[source="nav"], [id*="nav"], [class*="nav"]').forEach(observeOne);

        const docMo = new MutationObserver(muts => {
          for (let i = 0; i < muts.length; i++) {
            const m = muts[i];
            for (let j = 0; j < m.addedNodes.length; j++) {
              const n = m.addedNodes[j];
              if (!n || n.nodeType !== 1) continue;
              if (n.matches?.('nav, aside, faceplate-tracker[source="nav"], [id*="nav"], [class*="nav"]')) {
                removeAnswersIn(n);
                observeOne(n);
              } else if (n.querySelector) {
                const lateNav = n.querySelector('nav, aside, faceplate-tracker[source="nav"], [id*="nav"], [class*="nav"]');
                if (lateNav) {
                  removeAnswersIn(lateNav);
                  observeOne(lateNav);
                }
              }
            }
          }
        });
        docMo.observe(document.documentElement, { childList: true, subtree: true });
      } catch {}
    })();

    // Hook attachShadow so we can watch every shadow root (open or closed) created after this point
    (function hookAttachShadow() {
      try {
        const proto = Element.prototype;
        if (proto.__nrAttachShadowHooked) return;
        const orig = proto.attachShadow;
        if (!orig) return;
        proto.__nrAttachShadowHooked = true;

        proto.attachShadow = function(init) {
          const root = orig.call(this, init);
          try {
            window.__nrRemoveAnswersIn_forFF && window.__nrRemoveAnswersIn_forFF(root);
            const mo = new MutationObserver(() => window.__nrRemoveAnswersIn_forFF && window.__nrRemoveAnswersIn_forFF(root));
            mo.observe(root, { childList: true, subtree: true });
          } catch {}
          return root;
        };
      } catch {}
    })();

    // Short burst to catch very early async renders
    (function shortBurst() {
      let count = 0;
      const id = setInterval(() => {
        try { window.__nrRemoveAnswersIn_forFF && window.__nrRemoveAnswersIn_forFF(document); } catch {}
        if (++count >= 40) clearInterval(id); // ~4s @ 100ms
      }, 100);
    })();

    // Initial sweep (page world)
    window.__nrRemoveAnswersIn_forFF && window.__nrRemoveAnswersIn_forFF(document);
  });

  // Firefox-only attachShadow fallback (if CSP blocks injection); auto-detected
  (function installFirefoxAttachShadowFallback() {
    try {
      const isFirefox = !!window.wrappedJSObject && typeof exportFunction === 'function' && typeof cloneInto === 'function';
      if (!isFirefox) { window.__nrFFAttachShadowInstalled = false; return; }

      const w = window.wrappedJSObject;

      // Ensure a page-world remover exists (if the injection above was blocked)
      if (!w.__nrRemoveAnswersIn_forFF) {
        try {
          const remover = function(root) {
            try {
              if (!root || !root.querySelectorAll) return;
              // Minimal subset used during very early fallback
              const qsa = root.querySelectorAll.bind(root);
              qsa && qsa('a[href="/answers"], a[href="/answers/"], a[href^="/answers"], a[aria-label="Answers"], a[aria-label*="Answers" i], svg[icon-name="answers-outline"]').forEach?.((el) => {
                try {
                  let target = el.closest && (el.closest('li[role="presentation"]') || el.closest('a, div, faceplate-tracker, nav'));
                  (target || el).remove?.();
                } catch {}
              });
            } catch {}
          };
          w.__nrRemoveAnswersIn_forFF = exportFunction(remover, w);
        } catch {}
      }

      // If the page hook already installed, nothing else to do
      if (w.Element?.prototype?.__nrAttachShadowHooked) { window.__nrFFAttachShadowInstalled = true; return; }

      const orig = w.Element?.prototype?.attachShadow;
      if (!orig) { window.__nrFFAttachShadowInstalled = false; return; }

      const wrapper = exportFunction(function(init) {
        const root = orig.call(this, init);
        try {
          w.__nrRemoveAnswersIn_forFF && w.__nrRemoveAnswersIn_forFF(root);
          const mo = new w.MutationObserver(exportFunction(function() {
            try { w.__nrRemoveAnswersIn_forFF && w.__nrRemoveAnswersIn_forFF(root); } catch(e) {}
          }, w));
          mo.observe(root, cloneInto({ childList: true, subtree: true }, w));
        } catch(e) {}
        return root;
      }, w);

      try {
        Object.defineProperty(w.Element.prototype, 'attachShadow', {
          value: wrapper,
          writable: true,
          configurable: true
        });
        w.Element.prototype.__nrAttachShadowHooked = true;
        window.__nrFFAttachShadowInstalled = true;
      } catch (e) {
        window.__nrFFAttachShadowInstalled = false;
      }
    } catch {
      window.__nrFFAttachShadowInstalled = false;
    }
  })();

})();

// --- SCRIPT STARTS HERE ---
(function () {
    'use strict';

    // === CHROME DEV CONSOLE LOGGING ===
    function devLog(message) {
        console.log('[REDDIT.JS]', message);
    }

    // --- RUNTIME TOGGLES (safe defaults) ---
    const DEBUG_MODE = false;
    const WATCHDOG_ENABLED = false;       // set true to enable timed re-evaluation of undecided hosts
    const WATCHDOG_HARD_MODE = false;     // if true, can temporarily mark as approved on timeout (kept false by default)
    const WATCHDOG_TIMEOUT_MS = 1000;     // 0.8s–1.5s typical
    const FEED_GUARDRAIL_ENABLED = true;  // re-check once if visible approved count hits zero

    // --- IMMEDIATE PRE-HIDING CSS (Applied before any content loads) ---
    function addPreHidingCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Hide ALL posts immediately until approved */
            article:not(.reddit-approved),
            shreddit-post:not(.reddit-approved),
            [subreddit-prefixed-name]:not(.reddit-approved) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Show only approved content */
            article.reddit-approved,
            shreddit-post.reddit-approved,
            [subreddit-prefixed-name].reddit-approved {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            /* Hide search dropdown items until filtered */
            li[role="presentation"]:not(.reddit-search-approved),
            div[role="presentation"]:not(.reddit-search-approved),
            li[data-testid="search-sdui-query-autocomplete"]:not(.reddit-search-approved),
            li.recent-search-item:not(.reddit-search-approved),
            a[role="option"]:not(.reddit-search-approved),
            div[data-testid="search-dropdown-item"]:not(.reddit-search-approved) {
                display: none !important;
                visibility: hidden !important;
            }
            
            /* Hide community suggestions permanently */
            reddit-recent-pages,
            shreddit-recent-communities,
            div[data-testid="community-list"],
            [data-testid="recent-communities"],
            .recent-communities,
            community-highlight-carousel {
                display: none !important;
            }

            /* Answers BETA: Robust early pre-hide (works even if your later JS doesn't run yet) */
            nav a[href="/answers"],
            nav a[href="/answers/"],
            nav a[href^="/answers"],
            nav li:has(> a[href^="/answers"]),
            faceplate-tracker[source="nav"] a[href="/answers"],
            faceplate-tracker[source="nav"] a[href^="/answers"],
            faceplate-tracker[source="nav"] li:has(> a[href^="/answers"]),
            a[aria-label="Answers"],
            a[aria-label*="Answers" i],
            nav a:has(> svg[icon-name="answers-outline"]),
            faceplate-tracker[source="nav"] a:has(> svg[icon-name="answers-outline"]),
            a[href="/answers"],
            a[href="/answers/"],
            a[href^="/answers"] {
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
        try {
            const head = document.head || document.documentElement;
            head.insertBefore(style, head.firstChild);
        } catch (e) {
            document.addEventListener('DOMContentLoaded', function() {
                (document.head || document.documentElement).appendChild(style);
            });
        }
    }

    // Apply CSS immediately before any other code runs
    addPreHidingCSS();

    // --- CSS PRE-HIDING for posts ---
    const style = document.createElement('style');
    style.textContent = `
        article.prehide, shreddit-post.prehide {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: none !important;
        }
        body.reddit-filter-ready article:not(.prehide),
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

    // --- PREFERENCES REDIRECT ---
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
    ];

    const keywordsToHide = [
        "porn", "nude", "Alexa", "penetration", "naked", "xxx", "rule34", "r34", "r_34", "rule 34", "ChatGPT", "get hard", "Vince Russo", "Dave Meltzer",
        "deepnude", "nudify", "nudifier", "nudifying", "nudity", "undress", "undressing", "undressifying", "undressify", "getdisciplined", "Mariah",
        "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley", "Cameron", "Hayter", "Britt Baker", "Ripley", "Rhea Ripley", "Mariah May", "Blake",
        "transv", "transvestite", "queer", "LGBT", "LGBTQ", "Pride", "Jessika Carr", "Carr"," Jessica Carr", "Jessika Karr", "Jessika", "sexy", "Monroe",
        "prostitute", "escort", "fetish", "adult", "erotic", "explicit", "mature", "blowjob", "sexual", "Jessica", "Jessica Karr", "Analsex", "orgasm",
        "vagina", "pussy", "tushy", "tushi", "genital", "vagena", "booty", "derriere", "busty", "slut", "Karr", "CJ Lana", "raped", "orga5m", "org@sm", 
        "whore", "camgirl", "celeb", "cumslut", "Tiffany Stratton", "Lillian", "Garcia", "Jordynne", "Trish", "Stratus", "Lana Del Rey", "orga$m", "0rg@sm", 
        "DeepSeek", "DeepSeek AI", "nudyi", "ai app", "onlyfans", "fantime", "fansly", "justforfans", "patreon", "CJ Perry", "Lana Perry", "orga5m", "org@5m", 
        "manyvids", "chaturbate", "myfreecams", "cam4", "fat fetish", "camsoda", "stripchat", "bongacams", "livejasmin", "Mandy", "0rgasm", "org@sm", "0rga$m",
        "woman", "women", "Liv Xoxo", "Xoxo", "Chelsey", "Chelsea", "Piper Niven", "Hardwell", "Del Rey", "Del Ray", "breast", "5 feet of fury", "0rg@5m",
        "amateur", "alexa", "bliss", "alexa bliss", "her ass", "she ass", "her's ass", "hers ass", "venice", "Alexa", "Morgan Xoxo", "poses", "posing", 
        "Tiffany Stratton", "Tiffy time", "Stratton", "Tiffany", "Mandy Rose", "Chelsea Green", "Zelina", "Zelina Vega", "Valhalla", "vagene", "Sportskeeda",
        "IYO SKY", "Io Shirai", "Iyo Shirai", "IO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Meiko", "Satomura", "playboy", "Dynamite", "jizz", 
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge", "jizzed", "Torrie", "Sasha", 
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina", "Melina wrestler", "Jillian Hall", "five feet of fury", "Rampage", "raepd", "Wilson",
        "Mickie James", "Maria", "Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess", "Rampaige", "breasts", "Liv Xoxo",
        "Madison Rayne", "Velvet Sky", "Angelina", "filmora", "wondershare", "Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX", "Sweeney", "Mickie", "Mercedes",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Vaquer", "Vaqueer", "Vaguer", "Vagueer", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", 
        "Nightingale", "Statlander", "Hikaru Shida", "Riho", "Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", "Fatal Influence", "Aubert", "*ape", "Brooke", "Hikaru", "Roxanne", 
        "Penelope", "Shotzi", "Blackheart", "Tegan", "Charlotte", "Kamifuku", "Charlotte", "Sarray", "Xia Li", "OperaGX", "Sky Wrestling", "steph", "r*pe", "Opera Browser", 
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Alicia", "Atout", "stephanie", "ra*e", "nofap", "No nut",
        "Stephanie", "Thekla", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Renee", "rap*", "Sasha Banks", 
        "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Izzi Dame", "Alba Fyre", "Isla Dawn", "Tamina", "Sydney", "Gina Adams", "Kelly2", "Russo", 
        "Raquel Rodriguez", "Scarlett", "Bordeaux", "Kayden", "Carter", "Katana Chance", "Valkyria", "Tamina Snuka", "Renee Young", "Sydney Sweeney", "Priscilla", "Cathalina",
        "Roxanne Perez", "Indi Hartwell", "Hartwell", "Blair", "Davenport", "wonder share", "Lola Vice", "Maxxine Dupri", "Karmen", "Karmen Petrovic", "Brittany", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum", "Paxley", "Fallon Henley", "Sky wrestle", "Women's", "Women", "venoisi",  "rawdog", "rawdogging", 
        "Kelani Jordan", "Electra", "Wendy Choo", "Yulisa", "Valentina", "Valentine", "Amari Miller", "Woman", "Lady", "Girls", "Girl's", "venoise", "AlexaBliss", "Cathy", "Kathy",
        "Sol Ruca", "lexi", "AlexaPearl", "Arianna", "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW", "Woman's", "Lady's", "Girl's", "HorizonMW", "Horizon MW",
        "Horizon Modern Warfare", "HorizonModern", "HorizonWarfare", "Horizon ModernWarfare", "Diffusion", "StableDiffusion", "UnStableDiffusion", "Dreambooth", "Dream booth", "comfyui",
        "sperm", "boyfriend", "girlfriend", "AI generated", "AI-generated", "generated", "artificial intelligence", "machine learning", "neural network", "deep learning",
        "Kazuki", "Midjourney", "stable diffusion", "artificial", "synthetic", "computer generated", "algorithm", "chatbot", "automated", "text to image", "Answers BETA", "Birppis",
    ];

    const redgifsKeyword = "www.redgifs.com";

    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro", "r/AlexaBliss", "r/AlexaPearl", "r/comfyui"
    ];

    const regexKeywordsToHide = [
        /deepn/i, /deepf/i, /deeph/i, /deeps/i, /deepm/i, /deepb/i, /deept/i, /deepa/i, /nudi/i, /nude/i, /nude app/i, /undre/i, /dress/i, /deepnude/i, /face swap/i, /Stacy/i, /Staci/i, /Keibler/i,
        /morph/i, /inpaint/i, /art intel/i, /safari/i, /Opera Browser/i, /Mozilla/i, /Firefox/i, /Firefux/i, /\bbra\b/i, /soulgen/i, /ismartta/i, /editor/i, /image enhanced/i, /image enhancing/i,
        /tush/i, /lex bl/i, /image ai/i, /edit ai/i, /deviant/i, /Lex Cabr/i, /Lex Carb/i, /Lex Kauf/i, /Lex Man/i, /Blis/i, /nudecrawler/i, /photo AI/i, /pict AI/i, /pics app/i, /enhanced image/i,
        /AI edit/i, /faceswap/i, /DeepSeek/i, /deepnude ai/i, /deepnude-ai/i, /object/i, /unc1oth/i, /Opera GX/i, /Perez/i, /Mickie/i, /Micky/i, /Brows/i, /vagena/i, /ed17/i, /Lana Perry/i, /Del Rey/i,
        /vegi/i, /vege/i, /vulv/i, /clit/i, /cl1t/i, /cloth/i, /uncloth/i, /decloth/i, /rem cloth/i, /del cloth/i, /eras cloth/i, /Bella/i, /Tiffy/i, /vagi/i, /vagene/i, /Del Ray/i, /CJ Lana/i,
        /Tiffa/i, /Strat/i, /puz/i, /Sweee/i, /Kristen Stewart/i, /Steward/i, /Perze/i, /Brave/i, /Roxan/i, /Browser/i, /Selain/i, /TOR-Selain/i, /Brit Bake/i, /vega/i, /\bSlut\b/i, /3dit/i, /ed1t/i,
        /Liv org/i, /pant/i, /off pant/i, /rem pant/i, /del pant/i, /eras pant/i, /her pant/i, /she pant/i, /pussy/i, /adult content/i, /content adult/i, /porn/i, /\bTor\b/i, /editing/i, /3d1t/i, /\bAi\b/i,
        /Sydney Sweeney/i, /Sweeney/i, /fap/i, /Sydnee/i, /Stee/i, /Waaa/i, /Stewart/i, /MS Edge/i, /TOR-browser/i, /Opera/i, /\bAi\b/i, /\bADM\b/i, /\bAis\b/i, /\b-Ai\b/i, /\bedit\b/i, /Feikki/i,
        /\bAnall\b/i, /\bAlexa\b/i, /\bAleksa\b/i, /AI Tool/i, /aitool/i, /\bHer\b/i, /\bShe\b/i, /\bADMX\b/i, /\bSol\b/i, /\bEmma\b/i, /\bRiho\b/i, /\bJaida\b/i, /\bCum\b/i, /Amber/i, /\bAi-\b/i, /\bAi\b/i,
        /\bIzzi\b/i, /\bDame\b/i, /\bNox\b/i, /\bLiv\b/i, /Chelsey/i, /Zel Veg/i, /Ch3l/i, /Chel5/i, /\bTay\b/i, /\balexa\b/i, /\bazz\b/i, /\bjaida\b/i, /Steph/i, /St3ph/i, /editation/i, /3d!7/i, 
        /P4IG3/i, /Paig3/i, /P4ige/i, /pa1g/i, /pa!g/i, /palg3/i, /palge/i, /Br1tt/i, /Br!tt/i, /Brltt/i, /Lana Del Rey/i, /\bLana\b/i, /image app/i, /edi7/i, /syvavaarennos/i, /boy friend/i, /photo app/i,
        /Diipfeikki/i, /Diipfeik/i, /deep feik/i, /deepfeik/i, /Diip feik/i, /Diip feikki/i, /syva vaarennos/i, /syvä vaarennos/i, /picture app/i, /edit app/i, /pic app/i, /syvävääre/i, /girl friend/i, 
        /pillu/i, /perse/i, /pylly/i, /peppu/i, /pimppi/i, /pinppi/i, /\bPeba\b/i, /\bBeba\b/i, /\bBabe\b/i, /\bBepa\b/i, /\bAnaali\b/i, /\bAnus\b/i, /sexuaali/i, /\bSeksi\b/i, /yhdyntä/i, /\bGina\b/i,
        /application/i, /sukupuoliyhteys/i, /penetraatio/i, /penetration/i, /vaatepoisto/i, /vaatteidenpoisto/i, /poista vaatteet/i, /(?:poista|poisto|poistaminen)[ -]?(?:vaatteet|vaatteiden)/i, /seksi/i,
        /vaateiden poisto/i, /kuvankäsittely/i, /paneminen/i, /seksikuva/i, /seksi kuvia/i, /uncensor app/i, /xray/i, /see[- ]?through/i, /clothes remover/i, /nsfw/i, /not safe for work/i, /alaston/i,
        /scanner/i, /AI unblur/i, /deblur/i, /nsfwgen/i, /nsfw gen/i, /image enhancer/i, /skin view/i, /erotic/i, /eroottinen/i, /AI fantasy/i, /Fantasy AI/i, /fantasy edit/i, /AI recreation/i, /synth/i,
        /Margot/i, /Robbie/i, /Johansson/i, /Ana de Armas/i, /Emily/i, /Emilia/i, /Ratajkowski/i, /Zendaya/i, /Doja Cat/i, /Madelyn/i, /Salma Hayek/i, /Megan Fox/i, /Addison/i, /Emma Watson/i, /Taylor/i,
        /Nicki/i, /Minaj/i, /next-gen face/i, /smooth body/i, /photo trick/i, /edit for fun/i, /realistic AI/i, /dream girl/i, /\bButt\b/i, /Derriere/i, /Backside/i, /läpinäkyvä/i, /panee/i, /panev/i,
        /nussi/i, /nussinta /i, /nussia/i, /nussiminen/i, /nussimis/i, /Stratusfaction/i, /yhdynnässä/i, /seksivideo/i, /seksikuvia/i, /yhdyntäkuvia/i, /yhdyntä kuvia/i, /panovideo/i, /pano video/i,
        /pano kuva/i, /panokuvat/i, /masturb/i, /itsetyydy/i, /itse tyydytys/i, /itsetyydytysvid/i, /itsetyydytyskuv/i, /runkkualbumi/i, /runkku/i, /runkkaus/i, /runkata/i, /runkka/i, /näpitys/i, /näpi/i,
        /sormetus/i, /sormettamiskuv/i, /sormittamiskuv/i, /sormettamiskuv/i, /fistaaminen/i, /näpityskuv/i, /näpittämiskuv/i, /sormettamisvid/i, /näpitysvid/i, /kotijynkky/i, /jynkkykuv/i, /jynkky/i, 
        /sheer/i, /aikuis viihde/i, /aikuissisältö/i, /aikuissivusto/i, /homo/i, /lesbo/i, /transu/i, /pervo/i, /5yvä/i, /\|\s*\|/i, /\(o\)\(o\)/i, /\(!\)/i, /face plus/i,  /face\+/i, /face+/i, /face\-/i,
        /bg remover/i, /lexi/i, /\bMina\b/i, /Shir/i, /kawa/i, /perver/i, /Mariah/i, /\bAva\b/i, /\bAnal-\b/i, /\b-Anal\b/i, /\bAnal\b/i, /\bCum\b/i, /\bNox\b/i, /\bButt\b/i, /\bNiven\b/i, /\bODB\b/i,
        /\bAnswers BETA\b/i, /\bFuku\b/i, /\bDick\b/i, /\bCock\b/i, /\bCock\b/i, /\bRape\b/i, /\bEmma\b/i, /\bIndi\b/i, /\bTegan\b/i, /\bGirl\b/i, /\bPenis\b/i, /\bLady\b/i, /\bAnus\b/i, /\bNSFW\b/i, 
        /\bsex\b/i, /\bAdult\b/i, /\bB-Fab\b/i, /Elayna/i, /Eleyna/i, /Eliyna/i, /Elina Black/i, /Elena Black/i, /Elyna Black/i, /Elina/i, /Elyna/i, /Elyina/i, /Aikusviihde/i, /Aikus viihde/i, 
        /Fantop/i, /Fan top/i, /Fan-top/i, /Topfan/i, /Top fan/i, /Top-fan/i, /Top-fans/i, /fanstopia/i, /Jenni/i,  /fans top/i, /topiafan/i, /topia fan/i, /topia-fan/i, /topifan/i, /topi fan/i, 
        /topi-fan/i, /topaifan/i, /topai fan/i, /topai-fan/i, /fans-topia/i, /fans-topai/i, /Henni/i, /Lawren/i, /Lawrenc/i, /Lawrence/i, /Jenny/i, /Jenna/i, /softorbit/i, /softorbits/i, /soft-orbit/i, 
        /soft-orbits/i, /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper-v/i,
        /VMWare/i, /VM Ware/i, /\bVM\b/i, /Virtual Machine/i, /\bVMs\b/i, /Virtualbox/i, /Virtual box/i, /Virtual laatikko/i, /Virtuaali laatikko/i, /Virtuaalilaatikko/i, /hyper-v/i, /hyper v/i, /\bLilly\b/i, 
        /virtuaalimasiini/i, /virtuaali masiini/i, /virtuaali workstation/i, /virtual workstation/i, /virtualworkstation/i, /virtual workstation/i, /virtuaaliworkstation/i, /hypervisor/i, /hyper visor/i, 
        /hyperv/i, /vbox/i, /virbox/i, /virtbox/i, /vir box/i, /virt box/i, /virtual box/i, /vrbox/i, /vibox/i, /virbox virtual/i, /virtbox virtual/i, /vibox virtual/i, /vbox virtual/i, /v-machine/i, /\bLilli\b/i,
        /vmachine/i, /v machine/i, /vimachine/i, /vi-machine/i, /vi machine/i, /virmachine/i, /vir-machine/i, /vir machine/i, /virt machine/i, /virtmachine/i, /virt-machine/i, /virtumachine/i, /vir mach/i,
        /virtu-machine/i, /virtu machine/i, /virtuamachine/i, /virtua-machine/i, /virtua machine/i, /\bMachaine\b/i, /\bMachiine\b/i, /\bMacheine\b/i, /\bMachiene\b/i, /vi mach/i, /virtual machi/i, /\bLily\b/i,
        /virtuaali masiina/i, /virtuaalimasiina/i,  /virt mach/i, /virtu mach/i, /virtua mach/i, /virtual mach/i, /vi mac/i, /vir mac/i, /virt mac/i, /virtu mac/i, /virtua mac/i, /virtuaali masiina/i, /\bLili\b/i,
        /Cathy/i, /Kathy/i, /Katherine/i, /Kazuki/i, /Kathy/i, /Yoshiko/i, /Yoshihiko/i, /Hirata/i, /birppis/i, /irpp4/i, /b1rppis/i, /birpp1s/i, /b1rpp1s/i, /comfyui/i, /Lily Adam/i, /Lilly Adam/i, /Dualipa/i,
        /comfy ui/i, /comfy ai/i, /comfyai/i, /comfy-ui/i, /comfy-ai/i, /comfy-ai/i, /Becky/i, /Becki/i, /Rebecca/i, /Amber Heard/i, /girlfriend/i, /boyfriend/i, /mid journey/i, /unstable diffusion/i, /Dua Lipa/i, 
        /AI[ -]?generated/i, /generated[ -]?by[ -]?AI/i, /artificial[ -]?intelligence/i, /machine[ -]?learning/i, /neural[ -]?network/i, /deep[ -]?learning/i, /midjourney/i, /dall[ -]?e/i, /stable[ -]?diffusion/i,
        /computer[ -]?generated/i, /text[ -]?to[ -]?image/i, /image[ -]?generation/i, /AI[ -]?art/i, /synthetic[ -]?media/i, /algorithmically/i, /bot[ -]?generated/i, /automated[ -]?content/i, /stablediffused/i, 
        /Hirada/i, /Hirata/i, 
    ];

    const unifiedSelectors = [
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-weak",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-weak",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader",
        ".\\32 xs.gap.items-center.flex",
        ".mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        ".row-end-2.row-start-1.col-end-3.col-start-1 > .mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        'span.text-global-admin.font-semibold.text-12',

    // Added robust nav-scoped selectors for "Answers" (kept as additions only)
    	'faceplate-tracker[source="nav"] a[href="/answers/"]',
    	'li[role="presentation"] a[href="/answers/"]',
    	'svg[icon-name="answers-outline"]',
	'span.text-global-admin.font-semibold.text-12',
	".text-14 > div.flex.gap-xs.items-baseline",
    ];

    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel",
        "span.text-global-admin.font-semibold.text-12",
	".text-14 > div.flex.gap-xs.items-baseline",
    ];

    // Simplified and more effective Answers button selectors
    const answersButtonSelectors = [
        'a[href="/answers/"]',
        'a[href^="/answers"]',
        'faceplate-tracker[noun="gen_guides_sidebar"]',
        'span.text-global-admin.font-semibold.text-12',
	'.text-14 > div.flex.gap-xs.items-baseline',
	'faceplate-tracker[source="nav"] a[href="/answers/"]',
    	'li[role="presentation"] a[href="/answers/"]',
    	'svg[icon-name="answers-outline"]'
    ];

    // --- OPTIMIZED MEMORY MANAGEMENT WITH ZERO LEAKS ---
    const MEMORY_CAP_GB = 4;
    const MEMORY_WARNING_GB = 3;
    const MAX_CACHE_SIZE = 40;
    const MAX_APPROVAL_PERSISTENCE = 20;
    const CLEANUP_INTERVAL = 8000;
    const MEMORY_CHECK_INTERVAL = 4000;
    const CRITICAL_MEMORY_THRESHOLD = 0.6;
    const CACHE_TTL_MS = 300000; // 5 minutes TTL for cache entries

    // Enhanced caches with TTL and automatic expiration
    class TTLCache extends Map {
        constructor(maxSize = 50, ttlMs = CACHE_TTL_MS) {
            super();
            this.maxSize = maxSize;
            this.ttlMs = ttlMs;
            this.timers = new Map();       // key -> timeoutId (number)
            this.expirations = new Map();  // key -> timestamp (ms)
        }
        
        set(key, value) {
            // Clear existing timer if key exists
            if (this.timers.has(key)) {
                const oldId = this.timers.get(key);
                clearTimeout(oldId);
                timeoutIds.delete(oldId);
                this.timers.delete(key);
                this.expirations.delete(key);
            }
            
            // Enforce size limit (simple FIFO)
            if (this.size >= this.maxSize && !this.has(key)) {
                const firstKey = this.keys().next().value;
                this.delete(firstKey);
            }
            
            // Set with TTL
            super.set(key, value);
            const expiry = Date.now() + this.ttlMs;
            this.expirations.set(key, expiry);

            const timerId = setTimeout(() => {
                this.delete(key);
            }, this.ttlMs);
            
            timeoutIds.add(timerId);
            this.timers.set(key, timerId);
            
            return this;
        }
        
        delete(key) {
            if (this.timers.has(key)) {
                const id = this.timers.get(key);
                clearTimeout(id);
                timeoutIds.delete(id);
                this.timers.delete(key);
            }
            this.expirations.delete(key);
            return super.delete(key);
        }
        
        clear() {
            // Properly clear all timers and remove from global tracking
            for (const id of this.timers.values()) {
                clearTimeout(id);
                timeoutIds.delete(id);
            }
            this.timers.clear();
            this.expirations.clear();
            return super.clear();
        }
        
        cleanup() {
            // Force cleanup of expired entries using stored expirations
            const now = Date.now();
            for (const [key, expiry] of this.expirations.entries()) {
                if (now >= expiry) {
                    this.delete(key);
                }
            }
        }
    }

    // Memory-efficient caches with automatic cleanup
    const processedElements = new WeakSet();
    const processedSearchItems = new WeakSet();
    const shadowRootsProcessed = new WeakSet();
    const permanentlyApprovedElements = new WeakSet();
    const eventListenersAdded = new WeakSet();
    
    // TTL caches for content that can expire
    const bannedSubredditCache = new TTLCache(MAX_CACHE_SIZE);
    const contentBannedCache = new TTLCache(MAX_CACHE_SIZE);
    const approvalPersistence = new TTLCache(MAX_APPROVAL_PERSISTENCE);

    // Enhanced tracking for complete cleanup
    const intervalIds = new Set();
    const timeoutIds = new Set();   // setTimeout/cancelIdleCallback IDs
    const rafIds = new Set();       // requestAnimationFrame IDs
    const idleCallbackIds = new Set(); // requestIdleCallback IDs
    const observerInstances = new Set();

    // NEW: track per-ShadowRoot observers without preventing GC
    const shadowRootObservers = new WeakMap(); // ShadowRoot -> MutationObserver

    const eventListenerCleanupFunctions = new Set();
    const throttledFunctions = new Map(); // Changed from WeakMap to Map for proper cleanup
    const watchdogTimers = new WeakMap();

    let lastFilterTime = 0;
    let pendingOperations = false;
    let memoryCleanupCount = 0;
    let lastMemoryWarning = 0;
    let isCleaningUp = false;
    let isShuttingDown = false;

    // Enhanced memory monitoring
    function getMemoryUsage() {
        if (performance && performance.memory) {
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

    // Enhanced cache cleanup with leak prevention
    function cleanupCaches(force = false) {
        if (isCleaningUp || isShuttingDown) return;
        isCleaningUp = true;
        
        try {
            const memInfo = getMemoryUsage();
            const isOverCap = memInfo ? memInfo.usedGB > MEMORY_CAP_GB : false;
            const isWarning = memInfo ? memInfo.usedGB > MEMORY_WARNING_GB : false;
            const isCritical = memInfo ? memInfo.percentage > CRITICAL_MEMORY_THRESHOLD * 100 : false;
            
            if (force || isOverCap || isCritical) {
                const beforeContent = contentBannedCache.size;
                const beforeSubreddit = bannedSubredditCache.size;
                const beforeApproval = approvalPersistence.size;
                
                contentBannedCache.clear();
                bannedSubredditCache.clear();
                
                if (isCritical || isOverCap) {
                    approvalPersistence.clear();
                }
                
                for (const [func, cleanup] of throttledFunctions.entries()) {
                    if (cleanup && typeof cleanup.cleanup === 'function') {
                        cleanup.cleanup();
                    }
                }
                throttledFunctions.clear();
                
                for (const observer of observerInstances) {
                    try {
                        if (observer && typeof observer.disconnect === 'function') {
                            observer.disconnect();
                        }
                    } catch {}
                }
                observerInstances.clear();
                
                const after = getMemoryUsage();
                if (after) {
                    devLog(`🧹 AGGRESSIVE CLEANUP - Memory now: ${after.usedGB}GB`);
                }
                
            } else if (isWarning) {
                bannedSubredditCache.cleanup();
                contentBannedCache.cleanup();
                approvalPersistence.cleanup();
                
                if (memInfo) {
                    devLog(`🧹 TTL cleanup - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB (${memInfo.percentage}%)`);
                }
            }

            memoryCleanupCount++;
            
            if (window.gc && (force || isOverCap || memoryCleanupCount % 5 === 0)) {
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

    // Enhanced memory monitoring with smarter thresholds
    function monitorMemoryPressure() {
        const memInfo = getMemoryUsage();
        if (!memInfo) return;
        
        const now = Date.now();
        
        if (memInfo.usedGB > MEMORY_CAP_GB) {
            if (now - lastMemoryWarning > 3000) {
                devLog(`🚨 MEMORY CAP EXCEEDED: ${memInfo.usedGB}GB > ${MEMORY_CAP_GB}GB - FORCING CLEANUP`);
                lastMemoryWarning = now;
            }
            cleanupCaches(true);
            
        } else if (memInfo.usedGB > MEMORY_WARNING_GB) {
            if (now - lastMemoryWarning > 10000) {
                devLog(`⚠️ Memory warning: ${memInfo.usedGB}GB / ${MEMORY_CAP_GB}GB cap (${memInfo.percentage}%)`);
                lastMemoryWarning = now;
            }
            cleanupCaches();
        }
    }

    // Enhanced global cleanup with complete resource deallocation
    function cleanup() {
        if (isShuttingDown) return;
        isShuttingDown = true;
        
        devLog('🧹 Performing complete cleanup...');
        
        try {
            intervalIds.forEach(id => { try { clearInterval(id); } catch {} });
            intervalIds.clear();

            timeoutIds.forEach(id => { try { clearTimeout(id); } catch {} });
            timeoutIds.clear();

            rafIds.forEach(id => { try { cancelAnimationFrame(id); } catch {} });
            rafIds.clear();

            if (window.cancelIdleCallback) {
                idleCallbackIds.forEach(id => { try { window.cancelIdleCallback(id); } catch {} });
                idleCallbackIds.clear();
            }

            observerInstances.forEach(observer => { try { observer.disconnect?.(); } catch {} });
            observerInstances.clear();

            eventListenerCleanupFunctions.forEach(cleanup => { try { cleanup(); } catch {} });
            eventListenerCleanupFunctions.clear();

            cleanupCaches(true);
            
            for (const [func, cleanup] of throttledFunctions.entries()) {
                if (cleanup && typeof cleanup.cleanup === 'function') {
                    cleanup.cleanup();
                }
            }
            throttledFunctions.clear();
            
            const memInfo = getMemoryUsage();
            if (memInfo) devLog(`🧹 Complete cleanup finished - Memory: ${memInfo.usedGB}GB`);
            
            if (window.gc) { try { window.gc(); } catch {} }
        } catch (e) {
            devLog(`❌ Error during cleanup: ${e.message}`);
        }
    }

    // Enhanced page visibility cleanup
    const visibilityHandler = () => {
        if (document.hidden) {
            cleanupCaches();
            monitorMemoryPressure();
        }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    eventListenerCleanupFunctions.add(() => {
        document.removeEventListener('visibilitychange', visibilityHandler);
    });

    // Enhanced cleanup before page unload
    const unloadHandler = () => cleanup();
    const pagehideHandler = () => cleanup();
    
    window.addEventListener('beforeunload', unloadHandler);
    window.addEventListener('pagehide', pagehideHandler);
    
    eventListenerCleanupFunctions.add(() => {
        window.removeEventListener('beforeunload', unloadHandler);
        window.removeEventListener('pagehide', pagehideHandler);
    });

    // Check if we're on a single post page (not feed or subreddit)
    function isPostPage() {
        const url = window.location.href;
        return url.includes('/comments/') && !url.includes('/s/') && !url.includes('?') && url.split('/').length >= 7;
    }

    // --- SIMPLIFIED ANSWERS BUTTON HIDING FUNCTIONS ---
    function hideAnswersButton() {
        // Method 0: Most reliable - search in likely nav/aside containers for "Answers" link or icon, case-insensitive
        try {
            const navScopes = document.querySelectorAll('nav, aside, [id*="nav"], [class*="nav"], faceplate-tracker[source="nav"], faceplate-tracker[noun="gen_guides_sidebar"]');
            const tryHideAnchorContainer = (el) => {
                if (!el) return;
                const li = el.closest('li[role="presentation"]');
                const container = li || el.closest('a, div, faceplate-tracker') || el;
                container.classList.add('reddit-answers-hidden');
                container.remove();
            };
            navScopes.forEach(scope => {
                // By href
                scope.querySelectorAll('a[href="/answers/"], a[href="/answers"], a[href^="/answers"]').forEach(tryHideAnchorContainer);
                // By aria-label
                scope.querySelectorAll('a[aria-label="Answers"], a[aria-label*="Answers" i]').forEach(tryHideAnchorContainer);
                // By icon -> climb
                scope.querySelectorAll('svg[icon-name="answers-outline"]').forEach(svg => {
                    const a = svg.closest('a');
                    tryHideAnchorContainer(a || svg);
                });
                // By visible text (cheap check limited to links and list items)
                const candidates = scope.querySelectorAll('a, li[role="presentation"], button');
                candidates.forEach(node => {
                    const t = (node.textContent || '').trim();
                    if (!t) return;
                    // Require "Answers" presence; "BETA" optional (A/B sometimes missing)
                    if (/answers/i.test(t)) {
                        tryHideAnchorContainer(node);
                    }
                });
            });
        } catch (e) {}

        // Method 1: Direct removal by href (most effective generic)
        try {
            document.querySelectorAll('a[href="/answers/"], a[href="/answers"], a[href^="/answers"]').forEach(el => {
                const li = el.closest('li[role="presentation"]');
                (li || el).classList.add('reddit-answers-hidden');
                (li || el).remove();
            });
        } catch (e) {}

        // Method 2: Remove by faceplate-tracker scope
        try {
            document.querySelectorAll('faceplate-tracker[noun="gen_guides_sidebar"], faceplate-tracker[source="nav"]').forEach(scope => {
                const anchor = scope.querySelector('a[href="/answers"], a[href="/answers/"], a[href^="/answers"], a[aria-label="Answers"], a[aria-label*="Answers" i]');
                const icon = scope.querySelector('svg[icon-name="answers-outline"]');
                const target = anchor || (icon && icon.closest('a')) || icon;
                if (target) {
                    const li = target.closest('li[role="presentation"]');
                    (li || target).classList.add('reddit-answers-hidden');
                    (li || target).remove();
                }
            });
        } catch (e) {}

        // Method 3: Remove BETA spans and their parents
        try {
            document.querySelectorAll('span.text-global-admin.font-semibold.text-12').forEach(span => {
                const txt = (span.textContent || '').trim();
                if (txt.toUpperCase() === 'BETA') {
                    const parent = span.closest('a, li, div, faceplate-tracker, nav');
                    if (parent && /answers/i.test(parent.textContent || '')) {
                        parent.classList.add('reddit-answers-hidden');
                        parent.remove();
                    }
                }
            });
        } catch (e) {}

        // Method 4: Text-based removal for "Answers" (+ optional "BETA") — scoped to nav-like containers to avoid false positives
        try {
            const scopes = document.querySelectorAll('nav, aside, [id*="nav"], [class*="nav"]');
            scopes.forEach(scope => {
                scope.querySelectorAll('a, li[role="presentation"], button').forEach(element => {
                    if (element.children && element.children.length > 0) return;
                    const text = (element.textContent || '').trim();
                    if (!text) return;
                    if (/answers/i.test(text)) {
                        const container = element.closest('a, li, div, faceplate-tracker') || element;
                        container.classList.add('reddit-answers-hidden');
                        container.remove();
                    }
                });
            });
        } catch (e) {}

        // Method 5: Add CSS class to hide any remaining answers elements
        try {
            document.querySelectorAll('a[href*="answers"], *[class*="answers"], *[data-testid*="answers"]').forEach(el => {
                el.classList.add('reddit-answers-hidden');
            });
        } catch (e) {}
    }

    // Enhanced performance functions with leak prevention
    function createThrottle(fn, wait) {
        let lastCall = 0;
        let timeoutId = null;
        
        const throttled = function(...args) {
            const now = performance.now();
            const context = this;
            
            const cleanup = () => {
                if (timeoutId) {
                    timeoutIds.delete(timeoutId);
                    timeoutId = null;
                }
            };
            
            if (now - lastCall >= wait) {
                lastCall = now;
                cleanup();
                return fn.apply(context, args);
            } else if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    cleanup();
                    lastCall = performance.now();
                    return fn.apply(context, args);
                }, wait - (now - lastCall));
                timeoutIds.add(timeoutId);
            }
        };
        
        // Store reference for cleanup
        throttledFunctions.set(throttled, { 
            fn, 
            cleanup: () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutIds.delete(timeoutId);
                }
            }
        });
        
        return throttled;
    }

    function createDebounce(fn, wait, immediate = false) {
        let timeoutId = null;
        
        const debounced = function(...args) {
            const context = this;
            const callNow = immediate && !timeoutId;
            
            const cleanup = () => {
                if (timeoutId) {
                    timeoutIds.delete(timeoutId);
                    timeoutId = null;
                }
            };
            
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutIds.delete(timeoutId);
            }
            
            timeoutId = setTimeout(() => {
                cleanup();
                if (!immediate) fn.apply(context, args);
            }, wait);
            timeoutIds.add(timeoutId);
            
            if (callNow) return fn.apply(context, args);
        };
        
        // Store reference for cleanup
        throttledFunctions.set(debounced, { 
            fn, 
            cleanup: () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutIds.delete(timeoutId);
                }
            }
        });
        
        return debounced;
    }

    function batchProcess(fn) {
        if (pendingOperations || isShuttingDown) return;
        pendingOperations = true;
        
        const processFrame = (callback) => {
            if (window.requestIdleCallback) {
                const id = window.requestIdleCallback(callback, { timeout: 1000 });
                idleCallbackIds.add(id);
                return { type: 'idle', id };
            } else {
                const id = requestAnimationFrame(callback);
                rafIds.add(id);
                return { type: 'raf', id };
            }
        };
        
        processFrame(() => {
            try {
                if (!isShuttingDown) {
                    fn();
                }
            } finally {
                pendingOperations = false;
            }
        });
    }

    // Helper: if approving a host, also mark inner article when present
    function markInnerArticleApprovedIfAny(host) {
        try {
            if (host && host.tagName === 'SHREDDIT-POST' && host.shadowRoot) {
                const art = host.shadowRoot.querySelector('article');
                if (art) art.classList.add('reddit-approved');
            }
        } catch {}
    }

    // ENHANCED: Function to scan FULL post content - now with better extraction and memory management
    function extractCompletePostContent(element) {
        try {
            const root = element && element.shadowRoot ? element.shadowRoot : element;

            // Early return for safe subreddits to save processing
            if (isElementInSafeSubreddit(element)) {
                const basicContent = (root?.textContent || element.textContent || element.innerText || '');
                return basicContent.substring(0, 2000); // Limit to prevent memory bloat
            }
            
            // Use a more memory-efficient approach
            const textParts = [];
            const maxContentLength = 5000; // Prevent excessive memory usage
            let totalLength = 0;
            
            // Method 1: Get main element text content (truncated)
            const mainText = (root?.textContent || element.textContent || element.innerText || '');
            if (mainText.trim() && totalLength < maxContentLength) {
                const chunk = mainText.substring(0, Math.min(1000, maxContentLength - totalLength));
                textParts.push(chunk);
                totalLength += chunk.length;
            }
            
            // Method 2: Get specific content from key selectors only if we haven't hit limit
            if (totalLength < maxContentLength && root && root.querySelectorAll) {
                const contentSelectors = [
                    'h1, h2, h3, h4, h5, h6',
                    '[slot="title"]',
                    '.md',
                    '[slot="text-body"]',
                    'p',
                    '[data-testid="post-content"]'
                ];
                
                for (let i = 0; i < contentSelectors.length && totalLength < maxContentLength; i++) {
                    const elements = root.querySelectorAll(contentSelectors[i]);
                    for (let j = 0; j < Math.min(elements.length, 5) && totalLength < maxContentLength; j++) {
                        const elem = elements[j];
                        let text = elem.textContent || elem.innerText || '';
                        
                        if (text.trim() && text.length > 2) {
                            const chunk = text.substring(0, Math.min(500, maxContentLength - totalLength));
                            textParts.push(chunk);
                            totalLength += chunk.length;
                        }
                    }
                }
            }
            
            const combinedContent = textParts.join(' ').trim();
            
            if (combinedContent.toLowerCase().includes('ai') && Math.random() < 0.1) {
                devLog(`🔍 FOUND AI CONTENT: "${combinedContent.substring(0, 100)}..." (${combinedContent.length} chars total)`);
            }
            
            return combinedContent;
            
        } catch (error) {
            devLog(`❌ Error in extractCompletePostContent: ${error.message}`);
            // Fallback to basic text content
            return (element.textContent || element.innerText || '').substring(0, 1000);
        }
    }

    // ENHANCED: Text checking with improved keyword matching and memory-efficient caching
    function checkTextForKeywords(textContent) {
        if (!textContent || textContent.length < 2) return false;
        
        // Normalize text for better matching (memory-efficient)
        const lowerText = textContent.toLowerCase()
            .substring(0, 2000) // Limit to prevent memory bloat
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Check cache first
        if (contentBannedCache.has(lowerText)) {
            return contentBannedCache.get(lowerText);
        }
        
        // Check for exact keyword matches
        for (let i = 0; i < keywordsToHide.length; i++) {
            const keyword = keywordsToHide[i].toLowerCase();
            
            if (lowerText.includes(keyword)) {
                if (keyword.length <= 3) {
                    const wordBoundaryRegex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
                    if (wordBoundaryRegex.test(lowerText)) {
                        contentBannedCache.set(lowerText, true);
                        return true;
                    }
                } else {
                    contentBannedCache.set(lowerText, true);
                    return true;
                }
            }
        }
        
        // Check regex patterns (limited for performance)
        for (let i = 0; i < Math.min(regexKeywordsToHide.length, 20); i++) {
            try {
                if (regexKeywordsToHide[i].test(lowerText)) {
                    contentBannedCache.set(lowerText, true);
                    return true;
                }
            } catch (e) {
                // Skip problematic regex
                continue;
            }
        }
        
        contentBannedCache.set(lowerText, false);
        return false;
    }

    // Better post identifier that works across feed and post pages
    function getPostIdentifier(element) {
        try {
            const root = element && element.shadowRoot ? element.shadowRoot : element;

            // Check data-ks-id first (most reliable)
            const dataKsElement = root?.querySelector && root.querySelector('[data-ks-id*="t3_"]');
            if (dataKsElement) {
                const dataKsId = dataKsElement.getAttribute('data-ks-id');
                const match = dataKsId && dataKsId.match(/t3_([a-zA-Z0-9]+)/);
                if (match) {
                    return `post_${match[1]}`;
                }
            }
            
            const postLinks = root?.querySelectorAll && root.querySelectorAll('a[href*="/comments/"]');
            if (postLinks && postLinks.length > 0) {
                for (let i = 0; i < Math.min(postLinks.length, 3); i++) { // Limit iterations
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
            
            const subreddit = getSubredditForAnyRedditPost(element);
            const titleElement = root?.querySelector && root.querySelector('h1, h2, h3, [data-testid="post-content"] h1, [slot="title"]');
            const title = titleElement ? titleElement.textContent : '';
            
            if (subreddit && title) {
                return `${subreddit}:${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    function wasElementPreviouslyApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier && approvalPersistence.has(identifier)) {
            if (isPostPage()) {
                devLog(`✅ Post was previously approved: ${identifier}`);
            }
            return approvalPersistence.get(identifier);
        }
        return false;
    }

    function markElementAsApproved(element) {
        const identifier = getPostIdentifier(element);
        if (identifier) {
            approvalPersistence.set(identifier, true);
            if (isPostPage()) {
                devLog(`✅ Marked post as approved: ${identifier}`);
            }
        }
        element.classList.add('reddit-approved');
        permanentlyApprovedElements.add(element);
    }

    // --- CORE FILTERING FUNCTIONS ---
    function isSubredditNameBanned(subName) {
        if (!subName) return false;
        const lowerSub = subName.toLowerCase();
        
        if (bannedSubredditCache.has(lowerSub)) {
            return bannedSubredditCache.get(lowerSub);
        }
        
        for (let i = 0; i < adultSubreddits.length; i++) {
            if (lowerSub === adultSubreddits[i].toLowerCase()) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`🚫 Blocked by banned subreddit: ${subName}`);
                }
                return true;
            }
        }
        
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (lowerSub.includes(keywordsToHide[i].toLowerCase())) {
                bannedSubredditCache.set(lowerSub, true);
                if (isPostPage()) {
                    devLog(`🚫 Blocked subreddit "${subName}" by keyword: "${keywordsToHide[i]}"`);
                }
                return true;
            }
        }
        
        for (let i = 0; i < Math.min(regexKeywordsToHide.length, 20); i++) {
            try {
                if (regexKeywordsToHide[i].test(lowerSub)) {
                    bannedSubredditCache.set(lowerSub, true);
                    if (isPostPage()) {
                        devLog(`🚫 Blocked subreddit "${subName}" by regex: ${regexKeywordsToHide[i]}`);
                    }
                    return true;
                }
            } catch (e) {
                continue;
            }
        }
        
        bannedSubredditCache.set(lowerSub, false);
        return false;
    }

    function checkContentForKeywords(content) {
        if (!content) return false;
        
        const contentText = content.textContent || content.innerText || content.nodeValue || '';
        if (!contentText) return false;
        
        return checkTextForKeywords(contentText);
    }

    // Enhanced to work for both feed pages and individual post pages
    function isSafeSubredditUrl() {
        const url = window.location.href.toLowerCase();
        
        // Check if current page is in a safe subreddit
        for (let i = 0; i < safeSubreddits.length; i++) {
            const safeSub = safeSubreddits[i].replace(/^r\//, '').toLowerCase();
            // Match both feed pages (/r/subreddit) and post pages (/r/subreddit/comments/...)
            if (url.match(new RegExp(`/r/${safeSub}([/?#]|$|/comments/)`))) {
                return true;
            }
        }
        
        return false;
    }

    function isUrlAllowed() {
        const currentUrl = window.location.href;
        return allowedUrls.some(url => currentUrl.startsWith(url)) || isSafeSubredditUrl();
    }

    function removeElementAndRelated(element) {
        if (element && element.parentNode) {
            element.remove();
        }
    }

    function getSubredditForAnyRedditPost(el) {
        const prefixedName = el.getAttribute && el.getAttribute('subreddit-prefixed-name');
        if (prefixedName) return prefixedName.startsWith('r/') ? prefixedName : 'r/' + prefixedName;
        
        const subredditName = el.getAttribute && el.getAttribute('subreddit-name');
        if (subredditName) return 'r/' + subredditName;
        
        const dataSubreddit = el.getAttribute && el.getAttribute('data-subreddit');
        if (dataSubreddit) return dataSubreddit.startsWith('r/') ? dataSubreddit : 'r/' + dataSubreddit;
        
        const subredditLink = (el.shadowRoot || el).querySelector && (el.shadowRoot || el).querySelector('a[data-testid="subreddit-name"]');
        if (subredditLink && subredditLink.textContent) return subredditLink.textContent.trim();
        
        const root = el.shadowRoot || el;
        const rLink = root.querySelector && root.querySelector('a[href^="/r/"]');
        if (rLink && rLink.textContent) return rLink.textContent.trim();
        
        const links = root.querySelectorAll && root.querySelectorAll('a[href*="/r/"]');
        if (links) {
            for (let i = 0; i < Math.min(links.length, 5); i++) { // Limit iterations
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

    // ENHANCED: Enhanced safe subreddit detection that works on both URL and element
    function isElementInSafeSubreddit(element) {
        // Method 1: Check current URL first
        if (isSafeSubredditUrl()) {
            return true;
        }
        
        // Method 2: Check element attributes
        const subredditPrefixedName = element.getAttribute && element.getAttribute('subreddit-prefixed-name');
        if (subredditPrefixedName) {
            const normalizedName = subredditPrefixedName.startsWith('r/') ? subredditPrefixedName : 'r/' + subredditPrefixedName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        // Method 3: Check subreddit-name attribute
        const subredditName = element.getAttribute && element.getAttribute('subreddit-name');
        if (subredditName) {
            const normalizedName = 'r/' + subredditName;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        // Method 4: Check through getSubredditForAnyRedditPost
        const subreddit = getSubredditForAnyRedditPost(element);
        if (subreddit) {
            const normalizedName = subreddit.startsWith('r/') ? subreddit : 'r/' + subreddit;
            if (safeSubreddits.some(safeSub => safeSub.toLowerCase() === normalizedName.toLowerCase())) {
                return true;
            }
        }
        
        return false;
    }

    // ENHANCED: Content evaluation function - now with complete content scanning
    function evaluateElementForBanning(element) {
        if (permanentlyApprovedElements.has(element) || wasElementPreviouslyApproved(element)) {
            return false;
        }
        
        const identifier = getPostIdentifier(element);
        if (isPostPage() && identifier) {
            devLog(`🔍 Evaluating element: ${identifier}`);
        }

        // Check if element is in a safe subreddit FIRST
        if (isElementInSafeSubreddit(element)) {
            return false; // Auto-approve safe subreddit posts
        }

        // For non-safe subreddits, do COMPLETE content scanning
        const fullContent = extractCompletePostContent(element);

        // Check if element is from a banned subreddit
        if (isElementFromAdultSubreddit(element)) {
            if (isPostPage()) {
                const sub = getSubredditForAnyRedditPost(element);
                devLog(`🚫 Blocked by subreddit: ${sub}`);
            }
            return true;
        }
        
        // Check ALL keywords using COMPLETE content scan
        if (checkTextForKeywords(fullContent)) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by full content scan`);
            }
            return true;
        }
        
        // Also check individual elements for thorough scanning
        const root = element && element.shadowRoot ? element.shadowRoot : element;

        const titleElement = root?.querySelector && root.querySelector('h1, h2, h3, a[data-click-id="body"], .title, [slot="title"]');
        if (titleElement && checkContentForKeywords(titleElement)) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by title content`);
            }
            return true;
        }
        
        // Check post body content
        const contentElement = root?.querySelector && root.querySelector('.post-content, .md-container, p, [slot="text-body"], [data-testid="post-content"]');
        if (contentElement && checkContentForKeywords(contentElement)) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by post content`);
            }
            return true;
        }
        
        // Check for NSFW indicators
        const nsfwIndicators = root?.querySelectorAll && root.querySelectorAll('.nsfw, [data-nsfw="true"], svg[icon-name="nsfw-outline"], .text-category-nsfw');
        if (nsfwIndicators && nsfwIndicators.length > 0) {
            if (isPostPage()) {
                devLog(`🚫 Blocked by NSFW indicator`);
            }
            return true;
        }
        
        if (isPostPage() && identifier) {
            devLog(`✅ Element passed all checks: ${identifier}`);
        }
        
        return false;
    }

    // OPTIMIZED: Main filtering functions with synchronous processing
    function filterAdultSubredditPosts() {
        // Only filter posts, NOT comments - optimized for performance
        const postSelectors = [
            'article:not(.prehide):not(.reddit-approved)',
            'shreddit-post:not(.prehide):not(.reddit-approved)', 
            '[subreddit-prefixed-name]:not(.prehide):not(.reddit-approved)'
        ];
        
        for (let selectorIndex = 0; selectorIndex < postSelectors.length; selectorIndex++) {
            const elements = document.querySelectorAll(postSelectors[selectorIndex]);
            
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                if (processedElements.has(element)) continue;
                processedElements.add(element);
                
                const shouldBan = evaluateElementForBanning(element);
                if (shouldBan) {
                    element.classList.add('prehide', 'reddit-banned');
                    removeElementAndRelated(element);
                } else {
                    markElementAsApproved(element);
                    markInnerArticleApprovedIfAny(element);
                }
            }
        }
    }

    function checkContentForSubreddits(content) {
        const contentText = content.textContent ? content.textContent.toLowerCase() : '';
        return adultSubreddits.some(subreddit =>
            contentText.includes(subreddit.toLowerCase())
        );
    }

    function hideJoinNowPosts() {
        const posts = document.querySelectorAll('article:not(.prehide), shreddit-post:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            
            let joinNowFound = false;
            
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

    function getSubredditFromPost(post) {
        const sub = post.getAttribute && post.getAttribute('data-subreddit');
        if (sub) return sub.startsWith('r/') ? sub : 'r/' + sub;
        
        const aTags = (post.shadowRoot || post).querySelectorAll && (post.shadowRoot || post).querySelectorAll('a[href*="/r/"]');
        if (aTags) {
            for (let i = 0; i < Math.min(aTags.length, 3); i++) { // Limit iterations
                const match = aTags[i].getAttribute('href').match(/\/r\/([A-Za-z0-9_]+)/);
                if (match) return 'r/' + match[1];
            }
        }
        
        return null;
    }

    function hideSubredditPosts() {
        const posts = document.querySelectorAll('article:not(.prehide)');
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            
            const subName = getSubredditFromPost(post);
            if (subName && isSubredditNameBanned(subName)) {
                post.classList.add('prehide');
                removeElementAndRelated(post);
            }
        }
    }

    function hideKeywordPosts() {
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            const shouldBan = evaluateElementForBanning(post);
            if (shouldBan) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                markElementAsApproved(post);
                markInnerArticleApprovedIfAny(post);
            }
        }
    }

    function filterPostsByContent() {
        const posts = document.querySelectorAll('article:not(.prehide):not(.reddit-approved), shreddit-post:not(.prehide):not(.reddit-approved)');
        
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (processedElements.has(post)) continue;
            processedElements.add(post);
            
            const shouldBan = evaluateElementForBanning(post);
            if (shouldBan) {
                post.classList.add('prehide', 'reddit-banned');
                removeElementAndRelated(post);
            } else {
                markElementAsApproved(post);
                markInnerArticleApprovedIfAny(post);
            }
        }
    }

    function checkForAdultContentTag() {
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            window.location.replace('https://www.reddit.com');
        }
    }

    // --- SEARCH FILTERING FUNCTIONS ---
    function hideBannedSubredditsFromSearch() {
        const allSearchItems = [
            ...Array.from(document.querySelectorAll('[data-type="search-dropdown-item-label-text"]')),
            ...Array.from(document.querySelectorAll('span.font-semibold.text-12.uppercase, span.text-category-nsfw')),
            ...Array.from(document.querySelectorAll('li[data-testid="search-sdui-query-autocomplete"], li.recent-search-item')),
            ...Array.from(document.querySelectorAll('li[role="presentation"], a[role="option"], div[data-testid="search-dropdown-item"]'))
        ];
        
        for (let i = 0; i < allSearchItems.length; i++) {
            const item = allSearchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            if (item.classList.contains('text-category-nsfw') || 
                (item.textContent && item.textContent.trim().toUpperCase() === "NSFW")) {
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                }
                continue;
            }
            
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const textContent = item.textContent || '';
            const label = ariaLabel + ' ' + textContent;
            
            if (isSubredditNameBanned(label)) {
                let toHide = item.closest('li[role="presentation"], li, a, div');
                if (toHide) {
                    toHide.style.display = 'none';
                } else if (item.parentElement) {
                    item.parentElement.style.display = 'none';
                } else {
                    item.style.display = 'none';
                }
            } else {
                item.classList.add('reddit-search-approved');
                let parent = item.closest('li[role="presentation"], li, a, div');
                if (parent) parent.classList.add('reddit-search-approved');
            }
        }
    }

    function processShadowSearchItems(root) {
        if (!root || !root.querySelectorAll) return;
        
        const searchItems = root.querySelectorAll('li[role="presentation"], div[role="presentation"], li, a[role="option"], div[data-testid="search-dropdown-item"]');
        
        for (let i = 0; i < searchItems.length; i++) {
            const item = searchItems[i];
            if (processedSearchItems.has(item)) continue;
            processedSearchItems.add(item);
            
            const text = item.textContent || '';
            const ariaLabel = item.getAttribute ? (item.getAttribute('aria-label') || '') : '';
            const fullText = text + ' ' + ariaLabel;
            
            let hasNSFWBadge = false;
            const spans = item.querySelectorAll('span, div');
            for (let j = 0; j < spans.length && !hasNSFWBadge; j++) {
                if (spans[j].textContent && spans[j].textContent.trim().toUpperCase() === 'NSFW') {
                    hasNSFWBadge = true;
                }
            }
            
            if (isSubredditNameBanned(fullText) || hasNSFWBadge) {
                item.style.display = 'none';
            } else {
                item.classList.add('reddit-search-approved');
            }
        }
    }

    // Fixed: Recursion depth limit and proper memory management
    function hideBannedSubredditsFromAllSearchDropdowns() {
        // Memory leak fix: Track processed elements to avoid infinite recursion
        const processedNodes = new WeakSet();
        
        function processShadowRoots(node, depth = 0) {
            if (!node || processedNodes.has(node) || depth > 5) return; // Limit recursion depth
            processedNodes.add(node);
            
            if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                shadowRootsProcessed.add(node.shadowRoot);
                processShadowSearchItems(node.shadowRoot);
                
                // NEW: attach or reuse a single observer per ShadowRoot
                observeShadowRootOnce(node.shadowRoot);
                
                // Limit depth of shadow DOM traversal
                const shadowChildren = node.shadowRoot.querySelectorAll('*');
                for (let i = 0; i < Math.min(shadowChildren.length, 20); i++) {
                    processShadowRoots(shadowChildren[i], depth + 1);
                }
            }
            
            if (node.children && depth < 3) { // Limit depth for performance
                for (let i = 0; i < Math.min(node.children.length, 20); i++) {
                    processShadowRoots(node.children[i], depth + 1);
                }
            }
        }
        
        hideBannedSubredditsFromSearch();
        
        if (document.body) {
            processShadowRoots(document.body);
        }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < Math.min(searchDropdowns.length, 5); i++) { // Limit processing
            processShadowRoots(searchDropdowns[i]);
        }
    }

    const throttledShadowRootHandler = createThrottle((mutations) => {
        // Memory leak fix: Limit mutation processing
        const processedMutationNodes = new WeakSet();
        const maxMutations = Math.min(mutations.length, 10);
        
        for (let i = 0; i < maxMutations; i++) {
            const mutation = mutations[i];
            const addedNodesLimit = Math.min(mutation.addedNodes.length, 5);
            
            for (let j = 0; j < addedNodesLimit; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType !== 1 || processedMutationNodes.has(node)) continue;
                processedMutationNodes.add(node);
                
                processShadowSearchItems(mutation.target);
                
                if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                    shadowRootsProcessed.add(node.shadowRoot);
                    processShadowSearchItems(node.shadowRoot);
                }
            }
        }
    }, 100);

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
            observer.observe(container, { 
                childList: true, 
                subtree: true
            });
            container.__searchObserved = true;
        }
        
        const searchDropdowns = document.querySelectorAll('faceplate-search-dropdown, shreddit-search-dropdown');
        for (let i = 0; i < searchDropdowns.length; i++) {
            const dropdown = searchDropdowns[i];
            if (dropdown.__searchObserved) continue;
            dropdown.__searchObserved = true;
            
            const observer = new MutationObserver(() => {
                batchProcess(() => {
                    if (dropdown.shadowRoot) {
                        processShadowSearchItems(dropdown.shadowRoot);
                    }
                });
            });
            
            observerInstances.add(observer);
            observer.observe(dropdown, {
                childList: true,
                subtree: true
            });
        }
    }

    // --- UTILITY: observe a ShadowRoot exactly once, reuse observer, and auto-clean on detach ---
    function observeShadowRootOnce(root) {
        if (!root) return;
        if (shadowRootObservers.has(root)) return;
        try {
            const mo = new MutationObserver(throttledShadowRootHandler);
            mo.observe(root, { childList: true, subtree: true, attributes: false, characterData: false });
            shadowRootObservers.set(root, mo);
        } catch {}
    }

    // --- UTILITY: disconnect any shadow observers found in a removed subtree (auto cleanup) ---
    function disconnectShadowObserversInSubtree(node, depth = 0) {
        if (!node || node.nodeType !== 1 || depth > 6) return; // safety limit
        try {
            // If this element hosts a shadow root we've observed, disconnect it
            if (node.shadowRoot && shadowRootObservers.has(node.shadowRoot)) {
                const mo = shadowRootObservers.get(node.shadowRoot);
                try { mo && mo.disconnect && mo.disconnect(); } catch {}
                shadowRootObservers.delete(node.shadowRoot);
            }
            // Recurse into children (limited)
            const children = node.children;
            if (children && children.length) {
                const max = Math.min(children.length, 200);
                for (let i = 0; i < max; i++) {
                    disconnectShadowObserversInSubtree(children[i], depth + 1);
                }
            }
        } catch {}
    }

    // Observe DOM removals to auto-disconnect shadow observers (prevents accumulation)
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
    try {
        domDetachObserver.observe(document.documentElement, { childList: true, subtree: true });
        observerInstances.add(domDetachObserver);
    } catch {}

    // --- UTILITY FUNCTIONS ---
    function interceptSearchInputChanges() {
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && !eventListenersAdded.has(searchInput)) {
            const inputHandler = createDebounce(() => {
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
            }, 200);
            
            searchInput.addEventListener('input', inputHandler);
            eventListenersAdded.add(searchInput);
            
            // Store cleanup function
            eventListenerCleanupFunctions.add(() => {
                searchInput.removeEventListener('input', inputHandler);
            });
        }
    }

    function interceptSearchFormSubmit() {
        const searchForm = document.querySelector('form[action="/search"]');
        if (searchForm && !eventListenersAdded.has(searchForm)) {
            const submitHandler = (event) => {
                const formData = new FormData(searchForm);
                const query = (formData.get('q') || '').toLowerCase();
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
            };
            
            searchForm.addEventListener('submit', submitHandler);
            eventListenersAdded.add(searchForm);
            
            // Store cleanup function
            eventListenerCleanupFunctions.add(() => {
                searchForm.removeEventListener('submit', submitHandler);
            });
        }
    }

    function checkUrlForKeywordsToHide() {
        if (isSafeSubredditUrl()) return;
        
        const currentUrl = window.location.href.toLowerCase();
        
        for (let i = 0; i < keywordsToHide.length; i++) {
            if (currentUrl.includes(keywordsToHide[i].toLowerCase())) {
                if (!isUrlAllowed()) {
                    window.location.replace('https://www.reddit.com');
                    return;
                }
            }
        }
        
        for (let i = 0; i < Math.min(regexKeywordsToHide.length, 20); i++) { // Limit regex checks for performance
            try {
                if (regexKeywordsToHide[i].test(currentUrl)) {
                    if (!isUrlAllowed()) {
                        window.location.replace('https://www.reddit.com');
                        return;
                    }
                }
            } catch (e) {
                continue;
            }
        }
    }

    function clearRecentPages() {
        try {
            const recentPagesStore = localStorage.getItem('recent-subreddits-store');
            if (!recentPagesStore) return;
            
            const recentPages = JSON.parse(recentPagesStore);
            if (!Array.isArray(recentPages)) return;
            
            const filteredPages = recentPages.filter(page => {
                if (typeof page !== 'string') return true;
                return !isSubredditNameBanned(page);
            });
            
            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
        } catch (e) {
            console.error("Error clearing recent pages:", e);
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
        
        for (let i = 0; i < selectors.length; i++) {
            const elements = document.querySelectorAll(selectors[i]);
            for (let j = 0; j < elements.length; j++) {
                elements[j].style.display = 'none';
            }
        }
        
        try {
            localStorage.setItem('recent-subreddits-store', '[]');
        } catch (e) {
            // Handle localStorage errors
        }
    }

    function checkAndHideNSFWClassElements() {
        const nsfwClasses = ['NSFW', 'nsfw-tag', 'nsfw-content'];
        for (let i = 0; i < nsfwClasses.length; i++) {
            const elements = document.querySelectorAll(`.${nsfwClasses[i]}`);
            for (let j = 0; j < elements.length; j++) {
                removeElementAndRelated(elements[j]);
            }
        }
    }

    function removeHrElements() {
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        for (let i = 0; i < hrElements.length; i++) {
            hrElements[i].remove();
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

    // Watchdog: schedule re-evaluation for a host that hasn't been decided
    function scheduleWatchdogForHost(host) {
        if (!WATCHDOG_ENABLED || !host || watchdogTimers.has(host)) return;
        const id = setTimeout(() => {
            timeoutIds.delete(id);
            watchdogTimers.delete(host);
            try {
                const approved = host.classList.contains('reddit-approved');
                const removed = !document.contains(host);
                if (!approved && !removed) {
                    if (DEBUG_MODE) devLog('🕒 Watchdog re-evaluating undecided host');
                    const shouldBan = evaluateElementForBanning(host);
                    if (shouldBan) {
                        host.classList.add('prehide', 'reddit-banned');
                        removeElementAndRelated(host);
                    } else {
                        if (WATCHDOG_HARD_MODE) {
                            host.classList.add('reddit-approved');
                            markInnerArticleApprovedIfAny(host);
                        } else {
                            markElementAsApproved(host);
                            markInnerArticleApprovedIfAny(host);
                        }
                    }
                }
            } catch {}
        }, WATCHDOG_TIMEOUT_MS);
        timeoutIds.add(id);
        watchdogTimers.set(host, id);
    }

    // Guardrail: if approved hosts drop to 0 and no spinner, re-run once
    function guardrailRecheck() {
        if (!FEED_GUARDRAIL_ENABLED) return;
        try {
            const approvedCount = document.querySelectorAll('shreddit-post.reddit-approved, article.reddit-approved').length;
            const loading = document.querySelector('[data-testid="feed-spinner"], faceplate-loading, [slot="skeleton"]');
            if (approvedCount === 0 && !loading) {
                if (DEBUG_MODE) devLog('🛟 Guardrail: 0 approved posts detected, re-running checks');
                runAllChecks();
            }
        } catch {}
    }

    // Fixed: Limited recursion depth and node processing in shadow DOM
    function processShadowDOM() {
        const elements = document.querySelectorAll('shreddit-post, shreddit-feed');
        const maxElements = Math.min(elements.length, 20); // Limit to prevent excessive processing
        
        for (let i = 0; i < maxElements; i++) {
            const element = elements[i];
            if (!element.shadowRoot || shadowRootsProcessed.has(element.shadowRoot)) continue;
            
            shadowRootsProcessed.add(element.shadowRoot);
            
            // Process ONLY posts in shadow DOM, NOT comments - with limits
            const posts = element.shadowRoot.querySelectorAll('article, shreddit-post');
            const maxPosts = Math.min(posts.length, 10); // Limit post processing
            
            for (let j = 0; j < maxPosts; j++) {
                const post = posts[j];
                if (processedElements.has(post)) continue;
                processedElements.add(post);
                
                const shouldBan = evaluateElementForBanning(post);
                if (shouldBan) {
                    post.classList.add('prehide', 'reddit-banned');
                    post.remove();
                } else {
                    markElementAsApproved(post);
                    markInnerArticleApprovedIfAny(post);
                }

                if (post.tagName === 'SHREDDIT-POST') {
                    scheduleWatchdogForHost(post);
                }
            }
            
            // Memory leak fix: Create (or reuse) shadow-root observer with proper tracking
            observeShadowRootOnce(element.shadowRoot);
        }
    }

    // --- NEW: Observe nav containers specifically to nuke "Answers" ASAP with minimal work ---
    function observeNavForAnswers() {
        const navs = document.querySelectorAll('nav, aside, faceplate-tracker[source="nav"]');
        navs.forEach((nav) => {
            if (nav.__answersObserved) return;
            nav.__answersObserved = true;
            const obs = new MutationObserver(createThrottle(() => hideAnswersButton(), 50));
            observerInstances.add(obs);
            obs.observe(nav, { childList: true, subtree: true });
        });
    }

    // --- MAIN FILTER FUNCTION ---
    function runAllChecks() {
        const now = performance.now();
        if (now - lastFilterTime < 50 || isShuttingDown) return;
        lastFilterTime = now;
        
        if (document.body && !document.body.classList.contains('reddit-filter-ready')) {
            document.body.classList.add('reddit-filter-ready');
        }
        
        hideAnswersButton();
        observeNavForAnswers();
        
        hideBannedSubredditsFromSearch();
        hideBannedSubredditsFromAllSearchDropdowns();
        observeSearchDropdown();
        
        processShadowDOM();
        
        // Filter ONLY posts, NOT comments - optimized performance
        filterAdultSubredditPosts();
        hideKeywordPosts();
        filterPostsByContent();
        
        if (!isUrlAllowed()) {
            hideJoinNowPosts();
            hideSubredditPosts();
            checkForAdultContentTag();
            checkUrlForKeywordsToHide();
            clearRecentPages();
            hideRecentCommunitiesSection();
        }
        
        removeHrElements();
        removeSelectorsToDelete();
        checkAndHideNSFWClassElements();

        guardrailRecheck();
    }

    // --- INITIALIZATION AND EVENT HANDLING ---
    function init() {
        interceptSearchInputChanges();
        interceptSearchFormSubmit();

        // Startup status log
        const isFirefox = !!window.wrappedJSObject && typeof exportFunction === 'function';
        if (isFirefox) {
            devLog(`Platform: Firefox; attachShadow fallback: ${window.__nrFFAttachShadowInstalled ? 'ACTIVE' : 'INACTIVE'}`);
        } else {
            devLog('Platform: Chrome/Chromium; page-world injection active');
        }
        
        runAllChecks();
        
        const throttledRunChecks = createThrottle(() => runAllChecks(), 75);
        const observer = new MutationObserver(throttledRunChecks);
        
        if (document.body) {
            observerInstances.add(observer);
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }
        
        // Memory leak fix: Track interval IDs for cleanup
        const minimalInterval = setInterval(hideBannedSubredditsFromSearch, 1000);
        intervalIds.add(minimalInterval);
        
        const answersButtonInterval = setInterval(hideAnswersButton, 150);
        intervalIds.add(answersButtonInterval);
        
        // Memory leak fix: Better idle callback handling
        if (window.requestIdleCallback) {
            let idleCallbackId;
            
            const idleCallback = () => {
                if (isShuttingDown) return;
                
                if (document.hidden) {
                    runAllChecks();
                } else {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                }
                
                idleCallbackId = window.requestIdleCallback(idleCallback, { timeout: 3000 });
                idleCallbackIds.add(idleCallbackId);
            };
            
            idleCallbackId = window.requestIdleCallback(idleCallback, { timeout: 3000 });
            idleCallbackIds.add(idleCallbackId);
            
            // Add cleanup function
            eventListenerCleanupFunctions.add(() => {
                if (idleCallbackId && window.cancelIdleCallback) {
                    window.cancelIdleCallback(idleCallbackId);
                    idleCallbackIds.delete(idleCallbackId);
                }
            });
        } else {
            const backgroundInterval = setInterval(() => {
                if (isShuttingDown) return;
                batchProcess(() => {
                    hideBannedSubredditsFromAllSearchDropdowns();
                    filterPostsByContent();
                    hideAnswersButton();
                });
            }, 3000);
            intervalIds.add(backgroundInterval);
        }
        
        // Memory monitoring every 4 seconds
        const memoryMonitorInterval = setInterval(() => {
            if (!isShuttingDown) {
                monitorMemoryPressure();
            }
        }, MEMORY_CHECK_INTERVAL);
        intervalIds.add(memoryMonitorInterval);
        
        // Cache cleanup every 8 seconds
        const cleanupInterval = setInterval(() => {
            if (!isShuttingDown) {
                cleanupCaches();
            }
        }, CLEANUP_INTERVAL);
        intervalIds.add(cleanupInterval);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        // Memory leak fix: Add cleanup for this event listener
        eventListenerCleanupFunctions.add(() => {
            document.removeEventListener('DOMContentLoaded', init);
        });
    } else {
        init();
    }

    // Fixed: Better mutation processing with limits
    const processNewElements = createThrottle((mutations) => {
        let needsSearchUpdate = false;
        // Memory leak fix: Limit mutations to process
        const limitedMutations = mutations.slice(0, 20);
        
        for (let i = 0; i < limitedMutations.length; i++) {
            const mutation = limitedMutations[i];
            
            if (mutation.target.id === 'search-dropdown-results-container' ||
                mutation.target.tagName === 'FACEPLATE-SEARCH-DROPDOWN' ||
                mutation.target.tagName === 'SHREDDIT-SEARCH-DROPDOWN') {
                needsSearchUpdate = true;
            }
            
            // Memory leak fix: Limit nodes to process
            const addedNodesLimit = Math.min(mutation.addedNodes.length, 10);
            for (let j = 0; j < addedNodesLimit; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType !== 1) continue;
                
                if (node.tagName === 'A' && (node.getAttribute('href') === '/answers/' || node.getAttribute('href') === '/answers')) {
                    hideAnswersButton();
                }
                
                if (node.tagName === 'FACEPLATE-TRACKER' || 
                    (node.querySelector && (node.querySelector('faceplate-tracker[noun="gen_guides_sidebar"]') ||
                                         node.querySelector('a[href^="/answers"]') ||
                                         node.querySelector('svg[icon-name="answers-outline"]')))) {
                    hideAnswersButton();
                }
                
                // Process ONLY posts, NOT comments - optimized
                if (node.tagName === 'ARTICLE' || node.tagName === 'SHREDDIT-POST') {
                    if (!processedElements.has(node)) {
                        processedElements.add(node);
                        
                        const shouldBan = evaluateElementForBanning(node);
                        if (shouldBan) {
                            node.classList.add('prehide', 'reddit-banned');
                            removeElementAndRelated(node);
                        } else {
                            markElementAsApproved(node);
                            markInnerArticleApprovedIfAny(node);
                        }

                        if (node.tagName === 'SHREDDIT-POST') {
                            scheduleWatchdogForHost(node);
                        }
                    }
                } else if (node.hasAttribute && (
                    node.hasAttribute('role') || 
                    node.hasAttribute('data-testid') || 
                    (node.classList && node.classList.contains('recent-search-item'))
                )) {
                    needsSearchUpdate = true;
                }
                
                // Memory leak fix: Avoid deep shadow DOM processing, but attach observer safely
                if (node.shadowRoot && !shadowRootsProcessed.has(node.shadowRoot)) {
                    shadowRootsProcessed.add(node.shadowRoot);
                    
                    processShadowSearchItems(node.shadowRoot);
                    
                    // Process ONLY posts in shadow DOM, NOT comments - with limits
                    const shadowPosts = node.shadowRoot.querySelectorAll('article, shreddit-post');
                    const maxShadowPosts = Math.min(shadowPosts.length, 5);
                    
                    for (let k = 0; k < maxShadowPosts; k++) {
                        const shadowPost = shadowPosts[k];
                        if (!processedElements.has(shadowPost)) {
                            processedElements.add(shadowPost);
                            
                            const shouldBan = evaluateElementForBanning(shadowPost);
                            if (shouldBan) {
                                shadowPost.classList.add('prehide', 'reddit-banned');
                                shadowPost.remove();
                            } else {
                                markElementAsApproved(shadowPost);
                                markInnerArticleApprovedIfAny(shadowPost);
                            }

                            if (shadowPost.tagName === 'SHREDDIT-POST') {
                                scheduleWatchdogForHost(shadowPost);
                            }
                        }
                    }
                    
                    // NEW: observe the shadow root once
                    observeShadowRootOnce(node.shadowRoot);
                }
                
                if (node.querySelectorAll) {
                    const hrElements = node.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
                    for (let k = 0; k < Math.min(hrElements.length, 10); k++) {
                        hrElements[k].remove();
                    }
                    
                    for (let k = 0; k < selectorsToDelete.length; k++) {
                        const elements = node.querySelectorAll(selectorsToDelete[k]);
                        for (let l = 0; l < Math.min(elements.length, 10); l++) {
                            removeElementAndRelated(elements[l]);
                        }
                    }
                }
            }
        }
        
        if (needsSearchUpdate) {
            batchProcess(() => {
                hideBannedSubredditsFromSearch();
                hideBannedSubredditsFromAllSearchDropdowns();
            });
        }
        
        hideAnswersButton();
        guardrailRecheck();
    }, 20);

    const observer = new MutationObserver(processNewElements);
    observerInstances.add(observer);
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    hideBannedSubredditsFromSearch();
    hideBannedSubredditsFromAllSearchDropdowns();

    // URL change detection with optimized memory cleanup
    let currentUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            
            // Gentle cache cleanup on navigation
            cleanupCaches();
            
            const memInfo = getMemoryUsage();
            if (memInfo) {
                devLog(`🔄 URL changed - Memory: ${memInfo.usedGB}GB/${MEMORY_CAP_GB}GB`);
            }
        }
    }, 100);
    intervalIds.add(urlCheckInterval);

})();