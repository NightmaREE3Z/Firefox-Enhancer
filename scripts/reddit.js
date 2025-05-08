(function () {
    'use strict';

    const allowedUrls = [
        "https://www.reddit.com/user/birppis/"
    ];

    const keywordsToHide = [
        "nsfw", "18+", "porn", "sex", "nude", "penetration", "naked", "xxx", "rule34", "r34", "r_34", "rule 34",
        "deepnude", "nudify", "nudifier", "nudifying", "nudity", "undress", "undressing", "undressifying", "undressify",
        "Toni Storm", "Skye Blue", "Carmella", "Mariah May", "Harley", "Cameron", "Hayter", "Britt Baker", "Ripley", "Rhea Ripley",
        "trans", "transvestite", "queer", "LGBT", "LGBTQ", "Pride", "Jessika Carr", "Carr WWE"," Jessica Carr", "Jessika Karr", "Jessika WWE", 
        "prostitute", "escort", "fetish", "adult", "erotic", "explicit", "mature", "blowjob", "anal", "sexual", "Jessica WWE", "Jessica Karr",
        "vagina", "pussy", "tushy", "tushi", "genital", "butt", "booty", "derriere", "busty", "cum", "slut", "Karr WWE",
        "whore", "camgirl", "celeb", "cumslut", "Tiffany Stratton", "Lillian", "Garcia", "Jordynne", "Trish", "Stratus",
        "DeepSeek", "DeepSeek AI", "nudyi", "ai app", "onlyfans", "fantime", "fansly", "justforfans", "patreon", 
        "manyvids", "chaturbate", "myfreecams", "cam4", "fat fetish", "camsoda", "stripchat", "bongacams", "livejasmin",
        "WWE woman", "WWE women", "WWE Xoxo", "Liv Xoxo", "Xoxo", "Chelsey", "Chelsea", "Niven", "Hardwell", "Indi", 
        "amateur", "alexa", "bliss", "alexa bliss", "her ass", "she ass", "her's ass", "hers ass", "Alexa WWE", "5 feet of fury",
        "Tiffany Stratton", "Tiffy time", "Stratton", "Tiffany", "Mandy Rose", "Chelsea Green", "Zelina Vega", "Valhalla",
        "IYO SKY", "Io Shirai", "Iyo Shirai", "IO SKY", "Dakota Kai", "Asuka", "Perez", "Kairi Sane", "Meiko Satomura", 
        "Shayna Baszler", "Ronda Rousey", "Carmella", "Emma", "Dana Brooke", "Tamina", "Alicia Fox", "Summer Rae", "MS Edge", "Microsoft Edge",
        "Layla", "Michelle McCool", "Eve Torres", "Kelly Kelly", "Melina WWE", "Melina wrestler", "Jillian Hall", "five feet of fury",
        "Mickie James", "Maria Kanellis", "Beth Phoenix", "Victoria", "Jazz", "Molly Holly", "Gail Kim", "Awesome Kong", "Goddess WWE",
        "Madison Rayne", "Velvet Sky", "Angelina Love", "ODB", "Brooke Tessmacher", "Havok", "Su Yung", "Miko Satomura", "Opera GX",
        "Taya", "Valkyrie", "Deonna", "Purrazzo", "Saraya", "Britt Baker", "Jamie Hayter", "Anna Jay", "Tay Conti", "Tay Melo", "Opera Browser",
        "Willow Nightingale", "Kris Statlander", "Hikaru Shida", "Riho", "Yuka Sakazaki", "Nyla Rose", "Emi Sakura", "Brave", 
        "Penelope Ford", "Shotzi", "Blackheart", "Tegan", "Nox", "Charlotte", "Charlotte Flair", "Sarray", "Xia Li", "OperaGX", 
        "Becky Lynch", "Bayley", "Bailey", "Giulia", "Michin", "Mia Yim", "AJ Lee", "Paige", "Bella", "Bianca", "Belair", "Atout",
        "Stephanie", "Liv Morgan", "Piper Niven", "Jordynne Grace", "Jordynne", "NXT Womens", "NXT Women", "NXT Woman", "Aubrey", "Edwards", "Alicia",
        "Sunny", "Maryse", "Tessa", "Brooke", "Jackson", "Jakara", "Lash Legend", "Velvet Sky", "Alba Fyre", "Isla Dawn", "Tamina", "Renee",
        "Raquel Rodriguez", "B-Fab", "Scarlett Bordeaux", "Kayden Carter", "Katana Chance", "Lyra Valkyria", "Tamina Snuka", "Renee Young",
        "Roxanne Perez", "Indi Hartwell", "Blair Davenport", "Lola Vice", "Maxxine Dupri", "Karmen Petrovic", "Brittany", "Aubert", "Renee Paquette",
        "Ava Raine", "Cora Jade", "Jacy Jayne", "Gigi Dolin", "Thea Hail", "Tatum Paxley", "Fallon Henley", "Sky wrestle",
        "Kelani Jordan", "Electra Lopez", "Wendy Choo", "Yulisa Leon", "Valentina Feroz", "Amari Miller", "Sky WWE", 
        "Sol Ruca", "Arianna Grace", "Natalya", "Nattie", "Young Bucks", "Matt Jackson", "Nick Jackson", "AEW",
        "Mercedes", "Sasha", "Banks", "Russo", "Vince Russo", "Dave Meltzer", "Sportskeeda", "Mandy", "Roxanne",
        "China", "Russia", "Liv Xoxo", "Morgan Xoxo", "All Elite Wrestling", "Dynamite", "Rampage", "Rampaige",
        "Sydney Sweeney", "Sweeney", "Sydney", "Kristen Stewart", "stephanie", "steph", "Sky Wrestling", 
    ];
    const redgifsKeyword = "www.redgifs.com";

    const adultSubreddits = [
        "r/fat_fetish", "r/ratemyboobs", "r/chubby", "r/jumalattaretPro"
    ];

    const unifiedSelectors = [
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block",
        "faceplate-batch > article.w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex > .items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.cursor-pointer.a.undefined.h-\\[24px\\].whitespace-nowrap.font-semibold.text-tone-1.items-center.flex",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader > .nd\\:visible",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block > shreddit-async-loader",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow > .visible.h-lg.float-left.inline-block",
        "faceplate-batch > shreddit-feed-load-more-observer > .w-full.mb-0 > .nd\\:visible.w-full > .relative.hover\\:bg-neutral-background-hover > .p-md > .w-fit.relative.text-12 > .items-center.flex > .text-neutral-content-strong.leading-6.grow",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap.text-neutral-content > span",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible > .hover\\:no-underline.no-underline.no-visited.font-semibold.text-12.cursor-pointer.a.h-xl.items-center.flex.whitespace-nowrap.text-neutral-content",
        ".\\32 xs.gap.items-center.flex > shreddit-async-loader > .nd\\:visible",
        ".\\32 xs.gap.items-center.flex",
        ".mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex",
        ".row-end-2.row-start-1.col-end-3.col-start-1 > .mt-\\[-4px\\].mb-2xs.min-h-\\[32px\\].text-12.justify-between.flex > .relative.min-w-0.items-center.gap-2xs.text-12.flex-wrap.flex"
    ];

    const selectorsToDelete = [
        "community-highlight-carousel",
        "community-highlight-carousel h3",
        "community-highlight-carousel shreddit-gallery-carousel",
    ];

    const isUrlAllowed = () => {
        const currentUrl = window.location.href;
        return allowedUrls.some(url => currentUrl.startsWith(url));
    };

    const removeElementAndRelated = (element) => {
        console.log('Removing element and related elements', element);
        element.remove();
    };

    const checkContentForSubreddits = (content) => {
        const contentText = content.innerText.toLowerCase();
        const contentHtml = content.innerHTML.toLowerCase();

        return adultSubreddits.some(subreddit => 
            contentText.includes(subreddit.toLowerCase()) || contentHtml.includes(subreddit.toLowerCase())
        );
    };

    const hideSubredditPosts = () => {
        console.log('Running hideSubredditPosts function');
        const posts = document.querySelectorAll('article');
        console.log(`Found ${posts.length} posts to check`);

        posts.forEach(post => {
            let containsSubredditToHide = false;

            const selectorsToCheck = [
                'a[data-click-id="subreddit"]',
                '.subreddit',
                ...unifiedSelectors
            ];

            selectorsToCheck.forEach(selector => {
                const elements = post.querySelectorAll(selector);
                elements.forEach(element => {
                    if (checkContentForSubreddits(element)) {
                        containsSubredditToHide = true;
                    }
                });
            });

            if (containsSubredditToHide) {
                console.log('Removing post due to subreddit to hide');
                removeElementAndRelated(post);
            }
        });
    };

    const checkContentForKeywords = (content) => {
        const contentText = content.innerText.toLowerCase();
        const contentHtml = content.innerHTML.toLowerCase();

        return keywordsToHide.some(keyword => 
            contentText.includes(keyword.toLowerCase()) || contentHtml.includes(keyword.toLowerCase())
        );
    };

    const hideKeywordPosts = () => {
        console.log('Running hideKeywordPosts function');
        const posts = document.querySelectorAll('article');
        console.log(`Found ${posts.length} posts to check`);

        posts.forEach(post => {
            let containsKeywordToHide = false;

            const selectorsToCheck = [
                'a[data-click-id="body"]',
                '.inset-0.absolute'
            ];

            selectorsToCheck.forEach(selector => {
                const elements = post.querySelectorAll(selector);
                elements.forEach(element => {
                    if (checkContentForKeywords(element)) {
                        containsKeywordToHide = true;
                    }
                });
            });

            if (containsKeywordToHide) {
                console.log('Removing post due to keyword to hide');
                removeElementAndRelated(post);
            }
        });

        checkForAdultContentTag();
    };

    const checkForAdultContentTag = () => {
        console.log('Running checkForAdultContentTag function');
        const adultContentTags = document.querySelectorAll('.flex.items-center svg[icon-name="nsfw-outline"]');
        if (adultContentTags.length > 0 && !isUrlAllowed()) {
            console.log('Redirecting to Reddit home due to 18+ Adult Content tag');
            window.location.replace('https://www.reddit.com');
        }
    };

    const interceptSearchInputChanges = () => {
        console.log('Running interceptSearchInputChanges function');
        const searchInput = document.querySelector('input[name="q"]');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase();

                const containsKeywordToHide = keywordsToHide.some(keyword => 
                    query.includes(keyword.toLowerCase())
                );

                if (containsKeywordToHide || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    console.log(`Redirecting to Reddit home due to forbidden search: ${query}`);
                    window.location.replace('https://www.reddit.com');
                }
            });
        }
    };

    const interceptSearchFormSubmit = () => {
        console.log('Running interceptSearchFormSubmit function');
        const searchForm = document.querySelector('form[action="/search"]');

        if (searchForm) {
            searchForm.addEventListener('submit', (event) => {
                const searchParams = new URLSearchParams(new FormData(searchForm));
                const query = (searchParams.get('q') || '').toLowerCase();

                const containsKeywordToHide = keywordsToHide.some(keyword => 
                    query.includes(keyword.toLowerCase())
                );

                if (containsKeywordToHide || (!isUrlAllowed() && query.includes(redgifsKeyword))) {
                    console.log(`Redirecting to Reddit home due to forbidden search: ${query}`);
                    event.preventDefault();
                    window.location.replace('https://www.reddit.com');
                }
            });
        }
    };

    const checkUrlForKeywordsToHide = () => {
        console.log('Running checkUrlForKeywordsToHide function');
        const currentUrl = window.location.href.toLowerCase();
        const containsKeywordToHide = keywordsToHide.some(keyword => 
            currentUrl.includes(keyword.toLowerCase())
        );

        if (containsKeywordToHide && !isUrlAllowed()) {
            console.log('Redirecting to Reddit home due to keywords to hide in URL');
            window.location.replace('https://www.reddit.com');
        }
    };

    const clearRecentPages = () => {
        console.log('Running clearRecentPages function');
        const recentPagesStore = localStorage.getItem('recent-subreddits-store');
        if (recentPagesStore) {
            const recentPages = JSON.parse(recentPagesStore);
            const filteredPages = recentPages.filter(page => 
                typeof page === 'string' && !keywordsToHide.some(keyword => 
                    page.toLowerCase().includes(keyword.toLowerCase())
                ) && !adultSubreddits.some(subreddit => 
                    page.toLowerCase().includes(subreddit.toLowerCase())
                )
            );
            localStorage.setItem('recent-subreddits-store', JSON.stringify(filteredPages));
        }
    };

    const runAllChecks = () => {
        console.log('Running all checks');
        try {
            hideSubredditPosts();
            
            if (!isUrlAllowed()) {
                hideKeywordPosts();
                checkForAdultContentTag();
                checkUrlForKeywordsToHide();
                clearRecentPages();
            }
        } catch (error) {
            console.error('Error running all checks:', error);
        }
    };

    const checkAndHideNSFWClassElements = () => {
        console.log('Checking for elements with NSFW-indicating classes');
        const nsfwClasses = ['NSFW', 'nsfw-tag', 'nsfw-content'];
        nsfwClasses.forEach(className => {
            const elements = document.querySelectorAll(`.${className}`);
            elements.forEach(element => {
                removeElementAndRelated(element);
            });
        });
    };

    const removeHrElements = () => {
        console.log('Removing specific <hr> elements');
        const hrElements = document.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
        hrElements.forEach((element) => {
            element.remove();
        });
    };

    const removeSelectorsToDelete = () => {
        console.log('Removing elements matching selectorsToDelete');
        selectorsToDelete.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                removeElementAndRelated(element);
            });
        });
    };

    const init = () => {
        console.log('Initializing script');
        interceptSearchInputChanges();
        interceptSearchFormSubmit();
        runAllChecks();

        // Remove elements as soon as possible
        removeHrElements();
        removeSelectorsToDelete();

        const observer = new MutationObserver(runAllChecks);

        const mainContent = document.querySelector('body');
        if (mainContent) {
            observer.observe(mainContent, {
                childList: true,
                subtree: true
            });
        }

        setInterval(() => {
            runAllChecks();
            checkAndHideNSFWClassElements();
            removeHrElements();
            removeSelectorsToDelete();
        }, 250);
    };

    // Run the script as soon as possible before the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Use MutationObserver to ensure elements are removed as soon as they are added to the DOM
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    const hrElements = node.querySelectorAll('hr.border-b-neutral-border-weak.border-solid.border-b-sm.border-0');
                    hrElements.forEach(element => {
                        element.remove();
                    });
                    selectorsToDelete.forEach(selector => {
                        const elements = node.querySelectorAll(selector);
                        elements.forEach(element => {
                            removeElementAndRelated(element);
                        });
                    });
                }
            });
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

})();