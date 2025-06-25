(function () {
    const style = document.createElement('style');
    style.textContent = `
        /* User messages color (no gray highlight) */
        .py-2\\.5.px-5.bg-token-message-surface.rounded-3xl.max-w-\\[var\\(--user-chat-width\\,70\\%\\)\\].relative {
            background-color: #cce4ff !important; /* Light blue for user messages */
            border: 1px solid #a0b8c8 !important; /* Light gray border */
            border-radius: 16px !important;
            margin-left: 2% !important; /* Start 2% from left edge */
            box-sizing: border-box !important;
            max-width: 98% !important; /* Increase max-width to 98% */
            padding: 12px !important; /* Add padding on all sides */
        }

        /* ChatGPT messages color */
        .\\[\\.text-message\\+\\&\\]\\:mt-5.text-start.break-words.whitespace-normal.gap-2.items-end.flex-col.w-full.flex.text-message.min-h-8 > .first\\:pt-\\[3px\\].empty\\:hidden.gap-1.flex-col.w-full.flex > .light.dark\\:prose-invert.break-words.w-full.prose.markdown {
            background-color: #e6eaf0 !important; /* Light gray for ChatGPT messages */
            border-radius: 16px !important; /* Rounded corners */
            max-width: 98% !important; /* Increase max-width to 98% */
            margin-left: 4% !important; /* Start 4% from left edge */
            box-sizing: border-box !important;
            padding: 12px !important; /* Add padding on all sides */
        }

        /* Code block color */
        .CodeBlock-module__code--KUcqT div {
            background-color: white !important; /* Set background to white */
            border: none !important; /* Remove borders */
            border-radius: 0 !important;
        }

        .CodeBlock-module__code--KUcqT code {
            font-family: 'Courier New', monospace !important;
            font-size: 1rem !important;
            color: #222 !important;
        }
    `;
    document.head.appendChild(style);
    console.log("ChatGPT custom colors and widths injected successfully.");
})();
