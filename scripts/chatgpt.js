(function () {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectStyles);
    } else {
        injectStyles();
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* --- REMOVE GRAY SLAB BEHIND USER CONTENT --- */
            [data-message-author-role="user"] .bg-token-main-surface-secondary {
                background: none !important;
                border: none !important;
                box-shadow: none !important;
            }

            /* --- USER BUBBLE --- */
            .user-message-bubble-color {
                background-color: #cce4ff !important; /* Light blue */
                border-radius: 16px !important;
                border: 1px solid #a0b8c8 !important;
                margin-left: auto !important;   /* right-align */
                margin-right: 2% !important;
                max-width: 98% !important;
                padding: 12px !important;
                box-sizing: border-box !important;
            }

            /* --- ASSISTANT BUBBLE (Hybrid) --- */
            [data-message-author-role="assistant"] .prose.markdown {
                background-color: #e9eaea !important; /* Hybrid gray-beige + cool tint */
                border: 1px solid #cfcfcf !important; /* Slightly cooler border */
                border-radius: 16px !important;
                margin-left: 2% !important;
                max-width: 98% !important;
                padding: 12px !important;
                box-sizing: border-box !important;
                color: #222 !important; /* Still crisp for readability */
            }

            /* --- ASSISTANT FEEDBACK BAR (remove odd rectangle) --- */
            [data-message-author-role="assistant"] .text-token-text-secondary {
                background: none !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin-top: 4px !important; /* keep small gap for icons */
            }

            /* --- CODE BLOCKS --- */
            .CodeBlock-module__code--KUcqT div {
                background-color: #ffffff !important;
                border: none !important;
                border-radius: 0 !important;
            }

            .CodeBlock-module__code--KUcqT code {
                font-family: 'Courier New', monospace !important;
                font-size: 1rem !important;
                color: #222 !important;
            }
        `;
        document.head.appendChild(style);
        console.log("ChatGPT bubble restyle injected.");
    }
})();
