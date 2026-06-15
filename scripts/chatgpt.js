(function () {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    /* ============================
       MAIN INITIALIZER
    ============================ */
    function init() {
        injectStyles();
        cleanModelMenu();
        cleanUIElements();
        observeDOM();
        console.log("[BraveFox Enhancer] Model cleanup active (no renaming).");
    }

    /* ============================
       CSS (your original)
    ============================ */
    function injectStyles() {
        const style = document.createElement("style");
        style.textContent = `

        /* --- REMOVE GRAY SLAB BEHIND USER CONTENT --- */
        [data-message-author-role="user"] .bg-token-main-surface-secondary {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
        }

        /* --- CSS HIDE OF UNWANTED MODELS (fallback layer) --- */

        div.truncate:contains("GPT-5 Instant") { display: none !important; }
        div.truncate:contains("GPT-5 Thinking mini") { display: none !important; }
        div.truncate:contains("GPT-5 Thinking") { display: none !important; }
        div.truncate:contains("o3") { display: none !important; }
        div.truncate:contains("o4-mini") { display: none !important; }

        /* --- USER BUBBLE --- */
        .user-message-bubble-color {
            background-color: #cce4ff !important;
            border-radius: 16px !important;
            border: 1px solid #a0b8c8 !important;
            margin-left: auto !important;
            margin-right: 2% !important;
            max-width: 98% !important;
            padding: 12px !important;
            box-sizing: border-box !important;
        }

        /* --- ASSISTANT BUBBLE --- */
        [data-message-author-role="assistant"] .prose.markdown {
            background-color: #e9eaea !important;
            border: 1px solid #cfcfcf !important;
            border-radius: 16px !important;
            margin-left: 2% !important;
            max-width: 98% !important;
            padding: 12px !important;
            box-sizing: border-box !important;
            color: #222 !important;
        }

        /* --- ASSISTANT FEEDBACK BAR --- */
        [data-message-author-role="assistant"] .text-token-text-secondary {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin-top: 4px !important;
        }

        /* --- CODE BLOCK OVERRIDES --- */
        .CodeBlock-module__code--KUcqT div {
            background-color: #ffffff !important;
            border: none !important;
            border-radius: 0 !important;
        }

        .CodeBlock-module__code--KUcqT code {
            font-family: "Courier New", monospace !important;
            font-size: 1rem !important;
            color: #222 !important;
        }

        `;
        document.head.appendChild(style);
    }

    /* ============================
       CLEANUP ONLY (NO RENAMING)
    ============================ */

    const MODELS_TO_REMOVE = [
        "GPT-5 Instant",
        "GPT-5 Thinking mini",
        "GPT-5 Thinking",
        "o3",
        "o4-mini",
    ];

    function cleanModelMenu() {
        const items = document.querySelectorAll("div[role='menuitem']");
        items.forEach(item => {
            const text = item.innerText.trim().split("\n")[0];
            if (MODELS_TO_REMOVE.includes(text)) {
                item.remove();
            }
        });
    }

    /* ============================
       CLEAN UI ELEMENTS (NEW: Hide upgrade/free/memory/update elements)
    ============================ */

    const ELEMENTS_TO_HIDE = [
        { selector: 'button[type="button"].flex.items-center.gap-1.bg-transparent.ps-2\\.5.text-current.focus\\:outline-none.pe-3', textMatch: 'Hanki Plus' },
        { selector: 'div.truncate[dir="auto"]', textMatch: 'Free' },
        { selector: 'div.flex.items-center.gap-1.text-sm.font-semibold.opacity-70', textMatch: 'Muisti täynnä' },
        { selector: 'button[aria-label="Päivitä"]', textMatch: 'Päivitä' },
    ];

    function cleanUIElements() {
        ELEMENTS_TO_HIDE.forEach(({ selector, textMatch }) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element.textContent.trim().includes(textMatch)) {
                    element.style.display = 'none';
                }
            });
        });
    }

    /* ============================
       OBSERVER
       (re-applies cleanup after renders)
    ============================ */
    function observeDOM() {
        const obs = new MutationObserver(() => {
            cleanModelMenu();
            cleanUIElements();
        });
        obs.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

})();