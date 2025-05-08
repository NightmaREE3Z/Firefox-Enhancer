// ==UserScript==
// @name         ExtraRedirect
// @version      1.13
// @description  Extra redirects and removes unwanted elements on Instagram and xvideos.
// @match        *://irc-galleria.net/user/*
// @match        *://www.instagram.com/*
// @match        *://www.threads.net/*
// @match        *://www.xvideos.com/*
// @match        *://www.tiktok.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const currentURL = window.location.href.toLowerCase();
    console.log(`Current URL: ${currentURL}`);

    // IRC-Galleria redirection
    if (currentURL.includes('irc-galleria.net')) {
        console.log('Detected IRC-Galleria site.');

        // List of image IDs to redirect
        const imageIdsToRedirect = [
	'129640994',
	'129640992',
	'129580627',
	'129640995',
	'129559690',
	'129640997',
	'129640991',
	'130016541', 
	'129804009', 
	'129684375'
        ];

        // Function to check if the current URL matches any of the blocked image IDs
        const checkAndRedirectImage = () => {
            const url = window.location.href.toLowerCase();
            console.log(`Checking URL for redirection: ${url}`);

            // Extract the image ID from the URL
            const imageIdMatch = url.match(/\/picture\/(\d+)$/);

            // If a match is found, check if it's one of the IDs to redirect
            if (imageIdMatch) {
                const imageId = imageIdMatch[1];
                if (imageIdsToRedirect.includes(imageId)) {
                    console.log(`Redirecting image ${imageId} to the front page.`);
                    window.location.replace('https://irc-galleria.net'); // Redirect to front page
                } else {
                    console.log(`Image ID ${imageId} is not in the redirect list.`);
                }
            } else {
                console.log('No image ID found in the URL.');
            }
        };

        // Function to delete elements by selectors
        const deleteSelectors = () => {
            const selectorsToDelete = [
            '#thumb_div_129640995',
            '#thumb_div_129640994',
            '#thumb_div_129640992',
            '#thumb_div_129580627',
            '#thumb_div_129640995',
            '#thumb_div_129559690',
            '#thumb_div_129640997',
            '#thumb_div_129640991',
            '#thumb_div_129684375',
            '#thumb_div_130016541',
            '#thumb_div_129804009',
            '#image-129684375-image',
            '#image-129640994-image',
            '#image-129640992-image',
            '#image-129580627-image',
            '#image-129640995-image',
            '#image-129559690-image'
            ];

            selectorsToDelete.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.remove();
                    console.log(`Deleted element with selector: ${selector}`);
                });
            });
        };

        // Initial setup when the page loads
        const init = () => {
            console.log('Initializing redirection check for IRC-Galleria.');
            checkAndRedirectImage(); // Check if the current image URL matches any to redirect
            deleteSelectors(); // Delete elements by selectors
        };

        // Handle page load and new tab openings
        window.addEventListener('DOMContentLoaded', init); // Trigger redirect check on DOM content load
        window.addEventListener('load', init); // Ensure redirect check is done after full page load
    }

    // Threads to Instagram redirection
    if (currentURL.includes('www.threads.net')) {
        console.log('Redirecting from Threads to Instagram.');
        window.location.replace('https://www.instagram.com'); // Redirect to Instagram
    }

    // Instagram homepage redirection
    if (currentURL.includes('karabrannbacka') || currentURL.includes('julmakira') || currentURL.includes('piia_oksanen') || currentURL.includes('p/Cu6cV9zN-CH') || currentURL.includes('p/Cpz9H4UtG1Q') || currentURL.includes('p/B3RXztzhj6E')) {
        console.log('Redirecting to Instagram homepage.');
        window.location.replace('https://www.instagram.com'); // Redirect to Instagram homepage
    }

    // TikTok homepage redirection
    if (currentURL.includes('@karabrannbacka')) {
        console.log('Redirecting to TikTok homepage.');
        window.location.replace('https://www.tiktok.com'); // Redirect to TikTok homepage
    }

        // Handle GitHub redirection 1
        if (currentURL.includes('github.com/NightmaREE3Z')) {
            console.log('Redirecting to GitHub home page.');
            window.location.replace('https://github.com');
        }

        // Handle GitHub redirection 2
        if (currentURL.includes('github.com/NightmaREE3Z/Firefox-Enhancer')) {
            console.log('Redirecting to GitHub home page.');
            window.location.replace('https://github.com');
        }

        // Handle GitHub redirection 3
        if (currentURL.includes('github.com/NightmaREE3Z/BraveFox-Enhancer')) {
            console.log('Redirecting to GitHub home page.');
            window.location.replace('https://github.com');
        }

        // Handle GitHub redirection 4
        if (currentURL.includes('github.com/NightmaREE3Z/MV3-Download-Manager')) {
            console.log('Redirecting to GitHub home page.');
            window.location.replace('https://github.com');
        }

        // Handle GitHub redirection 5
        if (currentURL.includes('github.com/NightmaREE3Z/DownloadsMV2FF')) {
            console.log('Redirecting to GitHub home page.');
            window.location.replace('https://github.com');
        }

    // Instagram content removal or hiding
    if (currentURL.includes('instagram.com')) {
        const selectorsToDelete = [
        '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x1n2onr6 > ._a6hd.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.xe8uvvx.xt0psk2.x1ypdohk.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.x1ejq31n.xjbqb8w.x1i10hfl',
        '.xvbhtw8.x1j7kr1c.x169t7cy.xod5an3.x11i5rnm.xdj266r.xdt5ytf.x78zum5',
        '.wbloks_79.wbloks_1 > .wbloks_1 > .wbloks_1 > .wbloks_1 > div.wbloks_1',
        '.x1ye3gou.x1l90r2v.xn6708d.x1y1aw1k.xl56j7k.x1qx5ct2.x78zum5.x6s0dn4',
        '.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1uhb9sk.xo71vjh.x5pf9jr.x13lgxp2.x168nmei.x78zum5.xjbqb8w.x9f619 > div > div > .xnc8uc2.x11aubdm.xso031l.x1q0q8m5.x1bs97v6',
        '.x2qib4z.xcu9agk.xd7y6wv.x78zum5.xg6i1s1.x1rp6h8o.x1fglp.xdxvlk3.x1hmx34t.x6s0dn4.x1a2a7pz.x1lku1pv.x87ps6o.x1q0g3np.x1t137rt.x1ja2u2z.xggy1nq.x1hl2dhg.x16tdsg8.x1n2onr6.x18d9i69.xexx8yu.xeuugli.x2lah0s.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.xe8uvvx.x2lah0s.xdl72j9.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x2hbi6w.xqeqjp1.xa49m3k.xjqpnuy.x1i10hfl',
        'div.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x1n2onr6.x1emribx.x1i64zmx.xod5an3.xo71vjh.x5pf9jr.x13lgxp2.x168nmei.x78zum5.xjbqb8w.x9f619:nth-of-type(11)',
        '.x1azxncr > .x1qrby5j.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.xv2umb2.x1jfb8zj.x1h9r5lt.x1h91t0o.x4k7w5x > .x78zum5.x6s0dn4.x1n2onr6 > ._a6hd.x1a2a7pz.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.xe8uvvx.xt0psk2.x1ypdohk.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.x1ejq31n.xjbqb8w.x1i10hfl',
        '.xfex06f > div:nth-child(3)',
        'div.x1i10hfl:nth-child(8)',
        'mount_0_0_Ie > div > div > div.x9f619.x1n2onr6.x1ja2u2z > div > div > div.x78zum5.xdt5ytf.x1t2pt76.x1n2onr6.x1ja2u2z.x10cihs4 > div:nth-child(2) > div > div.x1gryazu.xh8yej3.x10o80wk.x14k21rp.x17snn68.x6osk4m.x1porb0y.x8vgawa > section > main > div > header > section.x1xdureb.x1agbcgv.x1lhsz42.xieb3on.xr1yuqi.x6ikm8r.x10wlt62.xs5motx > div > div > div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1n2onr6.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x1q0g3np.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'div.x6bk1ks:nth-child(3) > div:nth-child(4) > a:nth-child(1)',
        'div.x6bk1ks:nth-child(3) > div:nth-child(3)',
        '.x1xgvd2v > div:nth-child(2) > div:nth-child(4) > span:nth-child(1)',
        '.x1xgvd2v > div:nth-child(2) > div:nth-child(3) > span:nth-child(1) > a:nth-child(1) > div:nth-child(1)',
        'svg[aria-label="Tutki"]',
        'div[aria-label="Käyttäjän julmakira tarina"]',
        'div[aria-label="Käyttäjän julmakira tarina, nähty"]',
        'img[alt="Käyttäjän julmakira profiilikuva"]',
        'div[class^="x9f619 xjbqb8w x78zum5 x168nmei x13lgxp2 x5pf9jr xo71vjh"][style*="height: 250px;"]',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.xdj266r.x1yztbdb.x4uap5.xkhd6sd.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.x1q0g3np.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'div.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1uhb9sk.x1plvlek.xryxfnj.x1iyjqo2.x2lwn1j.xeuugli.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1',
        'h4.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10wh9bi.x1wdrske.x8viiok.x18hxmgj',
        'a.x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tdsg8.x1hl2dhg.xggy1nq.x1a2a7pz._ac5x._a6hd',
        'span.x1lliihq.x1plvlek.xryxfnj.x1n2onr6.x1ji0vk5.x18bv5gf.x193iq5w.xeuugli.x1fj9vlw.x13faqbe.x1vvkbs.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x1i0vuye.xvs91rp.x1s688f.x173jzuc.x10wh9bi.x1wdrske.x8viiok.x18hxmgj',
        'div[role="button"][tabindex][aria-label="Reels"]',
        'div[role="button"][tabindex][aria-label="Threads"]',
        'div[role="button"][tabindex][aria-label="Tutki"]',
        'div > span.html-span > div.x1n2onr6 > a.x1i10hfl._a6hd[href="/explore/"]'
        ];

        // Function to delete elements using the CSS selectors
        function deleteElementsBySelectors(selectors) {
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.remove();
                });
            });
        }

        // Choose whether to hide or delete elements
        const handleElementsBySelectors = (selectors, action) => {
            if (action === 'delete') {
                deleteElementsBySelectors(selectors);
            }
        };

        // Initialize the observer to monitor DOM changes
        const initObserver = (selectors, action) => {
            const observer = new MutationObserver(() => {
                handleElementsBySelectors(selectors, action);
            });

            // Ensure the document body is available before observing
            const observeWhenReady = () => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                } else {
                    // Wait until the body is available
                    setTimeout(observeWhenReady, 100);
                }
            };

            observeWhenReady();
        };

        // Initial delete elements
        handleElementsBySelectors(selectorsToDelete, 'delete');

        // Initialize the MutationObserver to continuously delete elements
        initObserver(selectorsToDelete, 'delete');

        // Function to hide specific posts by ID
        function hideSpecificPosts() {
            document.querySelectorAll("article a").forEach(link => {
                const postUrl = link.href;

                // List of posts to block
                const blockedPosts = [
                    "Cpz9H4UtG1Q",
                    "Cu6cV9zN-CH",
                    "B3RXztzhj6E"
                ];

                if (blockedPosts.some(id => postUrl.includes(id))) {
                    const post = link.closest("article"); // Get the whole post container
                    if (post) post.style.display = "none";
                }
            });
        }

        // Run on page load and continuously to catch new posts
        setInterval(hideSpecificPosts, 500);
    }

    // xVideos content removal or hiding
    if (currentURL.includes('xvideos.com')) {
        // List of CSS selectors to hide or delete elements
        const selectorsToHide = [
            '.is-sh',
            '.videoad-title-txt > strong'
        ];

        // Function to hide elements using the CSS selectors
        function hideElementsBySelectors(selectors) {
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.display = 'none';
                });
            });
        }

        // Function to delete elements using the CSS selectors
        function deleteElementsBySelectors(selectors) {
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.remove();
                });
            });
        }

        // Choose whether to hide or delete elements
        const handleElementsBySelectors = (selectors, action) => {
            if (action === 'delete') {
                deleteElementsBySelectors(selectors);
            } else if (action === 'hide') {
                hideElementsBySelectors(selectors);
            }
        };

        // Initialize the observer to monitor DOM changes
        const initObserver = (selectors, action) => {
            const observer = new MutationObserver(() => {
                handleElementsBySelectors(selectors, action);
            });

            // Ensure the document body is available before observing
            const observeWhenReady = () => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                } else {
                    // Wait until the body is available
                    setTimeout(observeWhenReady, 100);
                }
            };

            observeWhenReady();
        };

        // Initial delete elements
        handleElementsBySelectors(selectorsToHide, 'delete');

        // Initialize the MutationObserver to continuously delete elements
        initObserver(selectorsToHide, 'delete');
    }
})();