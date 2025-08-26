(function () {
    const style = document.createElement('style');
    style.textContent = `
        /* Main layout container */
        .Layout-module__main--JKQM5 {
            background: #f7f7f7 !important;
        }

        /* Chat container */
        .ImmersiveChat-module__container--Q4j2R.ChatScrollContainer-module__container--b73rS {
            background-color: #f7f7f7 !important;
        }

        /* Sidebar container */
        .Sidebar-module__pinned--e3Nsi.Sidebar-module__container--s585U {
            background-color: #f7f7f7 !important;
        }

        /* Footer container */
        .Layout-module__footer--raJHn {
            background-color: #f7f7f7 !important;
        }

        /* User messages */
        .UserMessage-module__container--cAvvK {
            background-color: #cce4ff !important;
            border: 1px solid #a0b8c8 !important;
            border-radius: 16px !important;
            max-width: 98% !important; /* Increase width */
            padding: 12px 5% 12px 5% !important; /* Add padding on all sides */
            margin-left: 1% !important; /* Start after left edge */
            box-sizing: border-box !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            font-family: 'Arial', sans-serif !important;
        }

        /* CoPilot messages */
        .MarkdownRenderer-module__container--wIGWk.markdown-body.Box-sc-g0xbh4-0 {
            background: #e6eaf0 !important;
            border: 0 !important; /* Remove borders */
            max-width: 98% !important; /* Increase width */
            padding: 12px 5% 12px 5% !important; /* Add padding on all sides */
            margin-left: 1% !important; /* Start after left edge */
            box-sizing: border-box !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            font-family: 'Arial', sans-serif !important;
        }

        /* Code block adjustments */
        .CodeBlock-module__code--KUcqT div {
            background-color: white !important; /* Set background to white */
            border: none !important; /* Remove borders */
            border-radius: 0 !important;
            max-width: 98% !important; /* Increase width */
            padding: 16px 5% 16px 5% !important; /* Add padding on all sides */
            margin-left: 2% !important; /* Start after left edge */
            box-sizing: border-box !important;
            white-space: pre-wrap !important;
        }

        .CodeBlock-module__code--KUcqT code {
            font-family: 'Courier New', monospace !important;
            font-size: 1rem !important;
            color: #222 !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            box-sizing: border-box !important;
        }
    `;
    document.head.appendChild(style);
    console.log("ChatGPT-ish styles injected successfully.");
})();
