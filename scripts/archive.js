// ==UserScript==
// @name         ArchiveRedirect
// @version      1.4
// @description  Redirects specific archive pages to the Wayback Machine front page
// @match        *://web.archive.org/*
// @match        *://archive.org/*
// @match        *://web.archive.org/web/*
// @match        *://wayback.archive.org/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const currentURL = window.location.href.toLowerCase();

    // Define the terms to search for in the URL
    const terms = [
        "irpp4", "irpppas", "blogspot", "blogger", "birppis", "birpppis", "pushpull", "ask.fm", "deepseek", "deepseek ai", "reddit", "/r", "playboy",
        "Alexa", "Bliss", "Alexa Bliss", "Tiffany", "Tiffy", "Stratton", "Chelsea Green", "Bayley", "Blackheart", "Mercedes", "Alba Fyre", "sensuel",
        "Becky Lynch", "Michin", "Mia Yim", "#satan666", "julmakira", "Stephanie", "Liv Morgan", "Piper Niven", "sensuel", "queer", "Pride", "NXT Womens", "model",
        "Jordynne", "Woman", "Women", "Maryse", "@yaonlylivvonce", "@alexa_bliss_wwe_", "@alexa_bliss", "@samanthathebomb", "Women's", "Woman's", "Summer Rae", "Mia Yim",
        "Naomi", "Bianca Belair", "Charlotte", "Jessika Carr", "Carr WWE", "Jessica Karr", "bikini", "Kristen Stewart", "Sydney Sweeney", "Piper Niven", "Nia Jax", "play boy",
        "Young Bucks", "Jackson", "Lash Legend", "Jordynne Grace", "DeepSeek", "TOR-Browser", "TOR-selain", "Opera GX", "prostitute", "AI-generated", "AI generated",
        "deepnude", "undress", "nudify", "nude", "nudifier", "faceswap", "facemorph", "AI app", "Sweeney", "Alexis", "Sydney", "Zelina Vega", "Mandy Rose", "Del Ray",
        "Nikki", "Brie", "Bella", "Opera Browser", "by AI", "AI edited", "Safari", "OperaGX", "MS Edge", "Microsoft Edge", "clothes", "Lola Vice", "Vice WWE", "Candice LeRae",
        "crotch", "dress", "dreamtime", "Velvet Sky", "LGBTQ", "panties", "panty", "cloth", "AI art", "cleavage", "deviantart", "All Elite Wrestling", "Trish", "Stratus",
        "Tiffy Time", "Steward", "Roxanne", "cameltoe", "dreamtime AI", "Joanie", "bra", "Stewart", "Isla Dawn", "inpaint", "photopea", "onlyfans", "fantime", "Del Rey",
        "upscale", "upscaling", "upscaled", "sexy", "Alexa WWE", "AJ Lee", "deepfake", "ring gear", "Lexi", "Trans", "Transvestite", "Aleksa", "Giulia", "Rodriguez", "Lana Perry",
        "booty", "Paige", "Chyna", "lingerie", "AI model", "deep fake", "nudifying", "nudifier", "undressing", "undressed", "undressifying", "undressify", "Kristen", "CJ Lana",
        "Vladimir Putin", "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley Cameron", "Hayter", "trunks", "pants", "Ripley", "manyvids", "Lana WWE", "CJ Perry",
        "five feet of fury", "5 feet of fury", "selain", "browser", "DeepSeek", "DeepSeek AI", "fansly", "justforfans", "patreon", "Vince Russo", "Tay Conti", "Perry WWE",
        "Valhalla", "IYO SKY", "Shirai", "Io Sky", "Iyo Shirai", "Dakota Kai", "Asuka", "Kairi Sane", "Meiko Satomura", "NXT Women", "Russo", "underwear", "Rule 34",
        "Miko Satomura", "Sarray", "Xia Li", "Shayna Baszler", "Ronda Rousey", "Dana Brooke", "Izzi Dame", "Tamina", "Alicia Fox", "Madison Rayne", "Saraya", "attire", "only fans",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly", "Melina WWE", "Jillian Hall", "Mickie James", "Su Yung", "Britt", "Nick Jackson", "Matt Jackson", "fan time",
        "Maria Kanellis", "Beth Phoenix", "Victoria WWE", "Molly Holly", "Gail Kim", "Awesome Kong", "Deonna Purrazzo", "Anna Jay", "Riho", "Britney", "Nyla Rose",
        "Angelina Love", "Tessmacher", "Havok", "Taya Valkyrie", "Valkyria", "Tay Melo", "Willow Nightingale", "Statlander", "Hikaru Shida", "rule34", "Sasha", "AEW",
        "Penelope Ford", "Shotzi", "Tegan", "Nox", "Stephanie", "Sasha Banks", "Sakura", "Tessa", "Brooke", "Jakara", "Alba Fyre", "Isla Dawn", "Scarlett Bordeaux",
        "B-Fab", "Kayden Carter", "Katana Chance", "Lyra Valkyria", "Indi Hartwell", "Blair Davenport", "Maxxine Dupri", "China", "Russia", "Natalya", "Sakazaki",
        "Karmen Petrovic", "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum WWE", "Paxley", "Fallon Henley", "Nattie", "escort", "Sol Ruca",
        "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa Leon", "Valentina Feroz", "Amari Miller", "Arianna Grace"
    ];

    // Function to check for terms in the URL and redirect
    const checkTermsAndRedirect = () => {
        for (let term of terms) {
            if (currentURL.includes(term.toLowerCase())) {
                console.log(`Term found in URL: ${term}. Redirecting to Wayback Machine front page.`);
                window.stop(); // Stop loading the current page
                window.location.href = "https://web.archive.org/";
                return true;
            }
        }
        return false;
    };

    // Perform the check and redirect immediately if necessary
    if (checkTermsAndRedirect()) return;

    // Additional function to check for banned URLs with or without "www."
    const bannedURLs = ["blogspot.com", "blogger.com", "ask.fm", "reddit.com", "reddit.com/r/"];

    const isBannedURL = (url) => {
        for (let bannedURL of bannedURLs) {
            if (url.includes(bannedURL) || url.includes(`www.${bannedURL}`)) {
                return true;
            }
        }
        return false;
    };

    // Check for banned URLs and prevent loading if necessary
    if (isBannedURL(currentURL)) {
        console.log(`Banned URL detected: ${currentURL}. Preventing page load.`);
        window.stop();
    }

    // Selectors to check the page content for restricted words
    const selectors = [
        "input.rbt-input-main",
        "input.hidden-submit-btn",
        "div.rbt",
        "input.rbt-input-hint",
        "#search-input-item-0",
        ".rbt-input-main",
        ".rbt-input-main.form-control.rbt-input",
        "input[type='text']",
        "input[placeholder='Enter a URL or words related to a site’s home page']",
        "input[aria-autocomplete='both']",
        "input[role='combobox']",
        "input[aria-expanded='false']"
    ];

    // Function to check page content for restricted words
    const checkContentForRestrictedWords = () => {
        let redirected = false;

        for (let selector of selectors) {
            const elements = document.querySelectorAll(selector);

            elements.forEach((element) => {
                const content = element.value || element.textContent || "";
                const lowerContent = content.toLowerCase();

                for (let term of terms) {
                    if (lowerContent.includes(term.toLowerCase())) {
                        console.log(`Restricted term found in content: ${term}. Redirecting to Wayback Machine front page.`);
                        window.stop();
                        window.location.href = "https://web.archive.org/";
                        redirected = true;
                    }
                }
            });

            if (redirected) return true;
        }

        return false;
    };

    // Run once immediately
    checkContentForRestrictedWords();

    // Run periodically in case elements load late
    const interval = setInterval(() => {
        if (checkContentForRestrictedWords()) {
            clearInterval(interval);
        }
    }, 1000);

})();
