(() => {
    'use strict';

    const paramsToDelete = ["set", "type"]; // Parameters to clean
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
        '100006231940849',
        '100079421143598',
        '100002140178481',
        '100007491272181',
        '100000404984016',
        '100000407754247',
        '100046099231198',
        '1014542354035878',
        '1014535897369857',
        '1340482475983050',
        '1344030092294955',
        '895923403772295',
        '895814217116547',
        '1062802150417752',
        '1060897693941531',
        '462339497310048',
        '1014126078618693',
        '973601849337783',
        '970049886359646',
        '940194702678498',
	'9761862833844930',
        '936445033053465',
        '907980612566574',
        '895381147159854',
        '1080918508606116',
        '1072683142762986',
        '1079952645369369',
        '1209351935762772',
        '1178535568844409',
        '1166215320076434',
        '1109723022392331',
        '1099222803442353',
        '1090312024333431',
        '867521339945835',
        '855022637862372',
        '843081002389869',
        '642842945747010',
        '629932107038094',
        '602713353093303',
        '616352621729376',
        '615068318524473',
	'9759657687398778',
	'9817473061617240',
        'pfbid06VXAEGvWCcsPbk553v88NMB8uWRnRGHffB5s9kEpKRyYmfEJtt4fULTnQ82LnieDl',
        '1473251876',
        '1495428881',
	'Cultaholic',
        'AionicMusic',
        'toni.harsunen.1',
        'juho.leskinen',
        'melina.jokimaki',
        'johanna.jokimaki.18'
    ];

    // Blocked URLs with regular expressions
    const blockedUrls = [
        /profile\.php\?id=100000639309471&sk=photos/,
        /profile\.php\?id=100000639309471&sk=photos_by/,
        /profile\.php\?id=100000639309471&sk=videos/,
        /permalink\.php\?story_fbid=pfbid0xgBFRfVFGyiwt9b1eibHLQG2vin9NADySKrZm8aPvENT9GWMg3dt8VA6eGHxZjWCl/,
        /permalink\.php\?story_fbid=pfbid0pMgpCH4wjuyq3smimT5ULEmQFzZugx9o3kBraHLJ5Y37toTEn1415Z7L8FpTh135l/,
        /permalink\.php\?story_fbid=pfbid02QrdmwZKfKxAiZm3k41FgqM6FEyRx1eLAB1UiJPc7z9CT3RxL9a4X12qKKyykkfw5l/,
        /permalink\.php\?story_fbid=pfbid02f5iZ2iLyAA4o4PLoreUSQ7EJi19fSmYYUbCqxFEKMZv89VmiKfBtS1hqAErjzdQZl/,
        /permalink\.php\?story_fbid=836447305302755/,
        /permalink\.php\?story_fbid=pfbid022bSh3R6FDVHjTomfKqRremW2dg8fiWb5xaRzpqAJXdQHPkwBvsfJgicom5Vi3hKml/,
        /permalink\.php\?story_fbid=pfbid0abuaonjJ1417W5MUrmpGgo4pJt5kJGL9hYcGYz8J392z3PjjVjhrZhgcK2fz6pZcl/,
        /permalink\.php\?story_fbid=pfbid02rX4RcxF9v5YB1xAq36u9bndbyiW535dgjuTnbCxJjjRHzPCKDzQyvPAtdN23T4Kzl/,
        /permalink\.php\?story_fbid=1236875833901235/,
        /permalink\.php\?story_fbid=pfbid02cVLMUQSCxQzznzkH5X9BPsUDusdBKc9fzuiGsoJHSXDWqYMKBBXHd8xj6EFKmdivl/,
        /permalink\.php\?story_fbid=583915704973068/,
        /permalink\.php\?story_fbid=pfbid0xWnWWEadSE4BToaorWjEVgAkTLRvckK9y5BoXVYrPF9jsSGUBdHEwvDTRxDX7yJVl/,
        /posts\/pfbid02LXtamB1X9aJrRsMDxkcbNLFk2g9eeYBNii6HzaLLZVamDMnaAG4AvZU1VYfVHvn9l/,
	/posts\/pfbid0XXH5hPZ4kU6y6zm4eeyqYkUMZhCdXsKuMzCRbkZptgEGNTk8UVYT9UEEYinKvXLWl/,
        /story_fbid=164225553736969/,
        /permalink.php?story_fbid=pfbid06VXAEGvWCcsPbk553v88NMB8uWRnRGHffB5s9kEpKRyYmfEJtt4fULTnQ82LnieDl/,
        /permalink.php?story_fbid=642842945747010/,
        /permalink.php?story_fbid=895381147159854/,
        /permalink.php?story_fbid=936445033053465/,
        /permalink\.php\?story_fbid=pfbid05g1GaBBRjHMhXfekDtUEmRbP98Q4N9kdHhCrUUfp6LGdsQQMmShBYT8KfkSH938pl/,
        /permalink.php?story_fbid=pfbid02ZLJve5megHVfot9Ezfyr5z5m531kDh4TYzysgUZ3J2622PtM5Xb4NpJ9yiJqjfDNl/,
        /permalink.php?story_fbid=pfbid035WcvrEubf1RjAAXbYonu4smUnnSEYPcrY4Qz78v8jk3hv44aLbyikR4y2jboocztl/,
        /permalink.php?story_fbid=pfbid02QLcVYhmA1qEtvnHG986MyGR55duicYgvoykzXa2Vj6n4dUskKQ4FqojZtdQyAm3fl/,
        /permalink.php?story_fbid=1340482475983050/,
        /permalink.php?story_fbid=pfbid0qThHq9yVbKEMUe63CGVZ6BnCy9kDAak1qAMG22if857TPCJX6FpVpNCFeBwEzuRYl/,
        /permalink.php?story_fbid=pfbid0EPSNtptR1iDJzSakNGr5u1yacxF3wEXcHVSrkp7z68K87xDtzABc5LU7dGv4frL7l/,
	/permalink.php?story_fbid=pfbid0LfgFUf7LJRweuE69QHd3DSuyrDV8RVUudEojMa9a96qPasVBoN1pNzPco1KVd9Vkl/,
        /permalink.php?story_fbid=pfbid0qThHq9yVbKEMUe63CGVZ6BnCy9kDAak1qAMG22if857TPCJX6FpVpNCFeBwEzuRYl/,
        /permalink.php?story_fbid=pfbid0efp4yfb77ATKq5vRjB3o3dMGvw9yvagaTz21j4SmbUeeYvNHanjqjGBVpFnCMibBl/,
        /permalink.php?story_fbid=pfbid0EAzJgxVD1zCF6THJ1pKtS6kEe9L1TiLbo2sEKHUqUXJRF899FkUkBH4MNjM22sKpl/,
	/permalink\.php\?story_fbid=pfbid0Xq5bxtrXkWA9gWqcBt2aT8sDMeCDG5XN6hWVHE7axKu3jbn9LfiYfADgWHLtBfEUl/,
        /permalink.php?story_fbid=907980612566574/,
        /permalink.php?story_fbid=907631116865858/,
        /permalink.php?story_fbid=895923403772295/,
        /permalink.php?story_fbid=895381147159854/,
        /permalink.php?story_fbid=855022637862372/,
        /permalink.php?story_fbid=843081002389869/,
        /permalink.php?story_fbid=1178535568844409/,
        /permalink.php?story_fbid=1062802150417752/,
        /permalink.php?story_fbid=1014126078618693/,
        /permalink.php?story_fbid=970049886359646/,
        /permalink.php?story_fbid=940194702678498/,
        /permalink.php?story_fbid=pfbid0xh4ZoQA4XvgYL7iXe238V7o1sxEyULXGhr6Ufk2YeWFMwD4Ct4UYixF5UbycsCyEl/,
        /permalink.php?story_fbid=1209351935762772/,
        /permalink.php?story_fbid=108091850860611/,
        /permalink.php?story_fbid=1080918508606116/,
        /permalink.php?story_fbid=116621532007643/,
        /permalink.php?story_fbid=1109723022392331/,
        /permalink.php?story_fbid=1099222803442353/,
        /permalink.php?story_fbid=1090312024333431/,
        /permalink.php?story_fbid=867521339945835/,
        /permalink.php?story_fbid=615068318524473/,
        /permalink.php?story_fbid=pfbid06VXAEGvWCcsPbk553v88NMB8uWRnRGHffB5s9kEpKRyYmfEJtt4fULTnQ82LnieDl/,
        /ask\.fm/,
        /ask\.fm\/irpp4/,
        /blogspot\.com/,
        /blogspot\.fi/,
        /irpp4\.blogspot\.com/,
        /irpp4\.blogspot\.fi/,
        /irpppas\.blogspot\.com/,
        /irpppas\.blogspot\.fi/,
        /www\.facebook\.com\/toni\.harsunen\.1/,
        /www\.tiktok\.com/,
        /sportskeeda\.com\/.*/,
        /sportskeeda\.com/,
        /wwfoldschool\.com\/.*/,
        /wwfoldschool\.com/
    ];

    // Restricted words to look for
    const restrictedWords = [
        "Alexa",
        "Bliss",
        "Alexa Bliss",
        "Alexa WWE",
        "5 feet of fury",
        "five feet of fury",
        "Goddess WWE",
        "Tiffany Stratton",
        "Tiffy time",
        "Stratton",
        "Tiffany",
        "Mandy Rose",
        "Chelsea Green",
        "Bayley",
        "Mercedes",
        "Sasha",
        "Banks",
        "Sportskeeda",
        "Vince Russo",
	'Dave Meltzer',
        "Russo",
        "Bella",
        "Nikki",
        "Brie",
        "AEW",
        "All Elite Wrestling",
        "Dynamite",
        "Rampage",
	"AEW Collision",
        "Shotzi",
        "Blackheart",
        "Tegan",
        "Nox",
        "Flair",
        "Charlotte",
	"Charlotte Flair",
        "Becky Lynch",
        "Bayley",
        "Bailey",
        "Giulia",
        "Michin",
        "Mia Yim",
        "AJ Lee",
        "Paige",
        "Bella",
        "Stephanie",
        "Liv Morgan",
        "Piper Niven",
        "Chelsea Green",
	"Jordynne Grace",
	"Jordynne",
	"Carr WWE",
	"Iyo Shirai",
	"Iyo Sky",
	"Io Sky",
	"Shirai",
	"Woman",
	"Woman's",
	"Womans",
        "Women's",
        "Women",
	"woman",
	"woman's",
	"womans",
        "women's",
        "women",
	"girl",
	"girls",
	"girl's",
	"lady",
	"ladys",
	"ladies",
	"lady's",
        "her.",
        "her,",
        "her?",
        "her!",
        "her's",
        "her´s",
        "she's",
        "she´s",
	"she is",
	"she?",
	"she!",
	"she,",
	"she.",
	"Trish",
	"Stratus",
        "Candice LeRae",
        "Nia Jax",
        "Naomi",
        "Bianca Belair",
        "Young Bucks",
        "Matt Jackson",
        "Nick Jackson",
        "NXT Womens",
        "NXT Women",
        "NXT Woman",
        "Sunny",
        "Maryse",
        "Tessa",
        "Brooke",
        "Jackson",
	"Instagram",
        "Jakara",
        "Lash Legend",
        "Alba Fyre",
        "Isla Dawn",
        "trans",
        "Raquel Rodriguez",
        "transvestite",
        "queer",
        "LGBT",
        "LGBTQ",
        "Pride",
        "DeepSeek",
        "DeepSeek AI",
        "China",
        "Russia",
        "Liv Xoxo",
        "Morgan Xoxo",
        "WWE Xoxo",
	"Ihmisiä,",
        "Ihmisiä, joita saatat tuntea",
        "Joita saatat tuntea",
        "Lisää kavereita saadaksesi suosituksia",
        "Kun lisäät kavereita, näet tässä listan ihmisistä, jotka saatat tuntea.",
        "Rhea Ripley",
        "Mami",
	"Liity",
	"Seuraa",
	"Follow",
	"Join",
	"Reels",
        "Zelina Vega",
	"Izzi Dame",
	"Girlfriend",
	"Dame WWE",
	"Izzi WWE",
        "B-Fab",
        "Scarlett Bordeaux",
        "Kayden Carter",
        "Katana Chance",
        "Lyra Valkyria",
        "Roxanne Perez",
        "Indi Hartwell",
        "Blair Davenport",
        "Lola Vice",
        "Valhalla",
        "Maxxine Dupri",
        "Karmen Petrovic",
        "Ava Raine",
        "Cora Jade",
        "Jacy Jayne",
        "Gigi Dolin",
        "Thea Hail",
        "Tatum Paxley",
        "Fallon Henley",
        "Kelani Jordan",
        "Electra Lopez",
        "Wendy Choo",
        "Yulisa Leon",
        "Valentina Feroz",
        "Amari Miller",
        "Sol Ruca",
        "Arianna Grace",
        "Natalya",
        "Nattie",
        "IYO SKY",
        "Dakota Kai",
        "Asuka",
        "Perez",
        "Kairi Sane",
        "Meiko Satomura",
        "Miko Satomura",
        "Sarray",
        "Xia Li",
        "Shayna Baszler",
        "Ronda Rousey",
	"Velvet Sky",
        "Carmella",
        "Emma",
        "Dana Brooke",
        "Tamina",
        "Alicia Fox",
        "Summer Rae",
        "Layla",
        "Michelle McCool",
        "Eve Torres",
        "Kelly Kelly",
        "Melina WWE",
	"Jessika Carr",
	"Jessica Karr",
	"Jessica Carr",
	"Jessika Carr",
	"Jessika WWE",
	"Jessica WWE",
	"Karr WWE",
	"Carr WWE",
        "Melina wrestler",
        "Jillian Hall",
        "Mickie James",
        "Maria Kanellis",
        "Beth Phoenix",
        "Victoria",
        "Jazz",
        "Molly Holly",
        "Gail Kim",
        "Awesome Kong",
        "Madison Rayne",
        "Velvet Sky",
        "Angelina Love",
        "ODB",
        "Brooke Tessmacher",
        "Havok",
        "Su Yung",
        "Taya Valkyrie",
        "Deonna Purrazzo",
        "Toni Storm",
        "Saraya",
        "Britt Baker",
        "Jamie Hayter",
        "Anna Jay",
        "Tay Conti",
        "Tay Melo",
        "Willow Nightingale",
        "Kris Statlander",
        "Hikaru Shida",
        "Riho",
        "Yuka Sakazaki",
        "Nyla Rose",
        "Emi Sakura",
        "Penelope Ford",
        "Skye Blue",
        "Red Velvet",
        "Julia Hart",
        "Serena Deeb",
        "Ruby Soho",
        "Athena",
        "Mercedes Martinez",
        "Marina Shafir",
        "Leila Grey",
        "Trish Stratus",
        "Lita",
        "Ivory",
        "Debra",
        "Sable",
        "Torrie Wilson",
        "Stacy Keibler",
        "Chyna",
    ];

    // Function to remove unwanted query parameters
    const removeQueryParams = (url, paramsToDelete) => {
        const params = url.searchParams;
        let modified = false;

        paramsToDelete.forEach(param => {
            if (params.has(param)) {
                params.delete(param);
                modified = true;
            }
        });

        return modified ? url : null;
    };

    // Function to clean the current URL
    const cleanUrl = () => {
        const url = new URL(window.location.href);
        const cleanedUrl = removeQueryParams(url, paramsToDelete);
        if (cleanedUrl && cleanedUrl.toString() !== window.location.href) {
            window.history.replaceState({}, document.title, cleanedUrl.toString());
        }
    };

    // Enhanced function to handle deleting images with blocked FBIDs and URLs
    const deleteBlockedElements = () => {
        const elements = document.querySelectorAll('img, a, div'); // Target images, links, and divs (other elements as necessary)
        elements.forEach(element => {
            const src = element.src || '';
            const dataFbid = element.getAttribute('data-fbid') || '';
            const srcSet = element.getAttribute('srcset') || '';
            const parentLink = element.closest('a') ? element.closest('a').href : ''; // Get parent <a> tag's href if exists
            const href = element.href || ''; // For <a> tag

            // Check if any of these attributes or parent link contains a blocked FBID
            if (blockedFbids.some(fbid => src.includes(fbid) || dataFbid.includes(fbid) || srcSet.includes(fbid) || parentLink.includes(fbid))) {
                const elementToDelete = element.closest('[role="article"]') || element.closest('div') || element; // Delete the parent article or div if it exists, else delete the element
                if (elementToDelete && !elementToDelete.closest('[role="banner"]') && !elementToDelete.closest('[role="navigation"]')) {
                    elementToDelete.remove(); // Delete element
                }
            }

            // Check if the element’s URL matches any blocked URL
            if (blockedUrls.some(blockedUrl => blockedUrl.test(href) || blockedUrl.test(parentLink))) {
                const elementToDelete = element.closest('[role="article"]') || element.closest('div') || element; // Delete the parent article or div if it exists, else delete the element
                if (elementToDelete && !elementToDelete.closest('[role="banner"]') && !elementToDelete.closest('[role="navigation"]')) {
                    elementToDelete.remove(); // Delete element
                }
            }
        });
    };

    // Function to intercept navigation to blocked URLs
    const interceptNavigation = () => {
        // Intercept click events
        document.addEventListener('click', (event) => {
            const target = event.target.closest('a');
            if (target && blockedUrls.some(blockedUrl => blockedUrl.test(target.href))) {
                event.preventDefault();
                event.stopPropagation();
                console.log('Blocked navigation to:', target.href);
            }
        }, true);

        // Intercept form submissions
        document.addEventListener('submit', (event) => {
            const form = event.target;
            const action = form.action || '';
            if (blockedUrls.some(blockedUrl => blockedUrl.test(action))) {
                event.preventDefault();
                event.stopPropagation();
                console.log('Blocked form submission to:', action);
            }
        }, true);
    };

    // Function to handle redirects for specific FBIDs or URLs
    const handleRedirects = () => {
        const url = new URL(window.location.href);

        // Check if the URL contains blocked FBID as part of the path or query parameter
        const isBlockedFbid = blockedFbids.some(fbid => {
            return url.pathname.includes(fbid) || url.search.includes(`fbid=${fbid}`);
        });

        if (isBlockedFbid) {
            window.location.replace('https://www.facebook.com'); // Redirect to Facebook home page
        }

        // Check if the URL matches any blocked URL
        const isBlockedUrl = blockedUrls.some(blockedUrl => blockedUrl.test(url.href));

        if (isBlockedUrl) {
            window.location.replace('https://www.facebook.com'); // Redirect to Facebook home page
        }
    };

    // Function to delete posts with restricted words
    const deleteRestrictedWords = () => {
        // Selectors to monitor for restricted words
        const selectors = [
        '[role="article"]', 
        '[role="article"].x1lliihq',
        '[role="article"] .x1yztbdb',
        '[role="article"] .x1hc1fzr',
        '.x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1)',
        'div.x1i10hfl:nth-child(13)',
        'div.x1i10hfl:nth-child(13) > div:nth-child(1)',
        'div.x1i10hfl:nth-child(13) > div:nth-child(2)',
        'div.x1i10hfl:nth-child(13) > div:nth-child(3)',
        'div.x1n2onr6.x1ja2u2z.x1jx94hy.x1qpq9i9.xdney7k.xu5ydu1.xt3gfkd.x9f619',
        'div.x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo',
        'div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xn6708d.x1120s5i.x1ye3gou',
        'div.x1iyjqo2.x1vjfegm',
        'div.x6s0dn4.x78zum5.x1qughib.x1iorvi4.xjkvuk6',
        'div.html-h2.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1vvkbs.x1heor9g.x1qlqyl8.x1pd3egz.x1a2a7pz.x193iq5w.x1vvkbs',
        'div.html-h2.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1vvkbs.x1heor9g.x1qlqyl8.x1pd3egz.x1a2a7pz.x193iq5w',
        'div.x1iyjqo2.x1vjfegm',
        'div.x78zum5.x1q0g3np.x1qughib.xz9dl7a.xn6708d.x1120s5i.x1ye3gou',
        'div.x10l6tqk.xwa60dl.x1d8287x.x19991ni.xwji4o3.x1vjfegm.xg01cxk.x47corl',
        'div.x1iyjqo2.x1vjfegm',
        'div.x6s0dn4.x78zum5.x1qughib.x1iorvi4.xjkvuk6',
        '.x1y71gwh',
        '.x1p5oq8j',
        'div.xieb3on:nth-child(1)',
        'div.xieb3on:nth-child(1) > svg:nth-child(1)',
        '.x1p5oq8j > div:nth-child(2)'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const elementText = element.innerText || '';

                // Check if the element contains any restricted words
                if (restrictedWords.some(word => elementText.includes(word))) {
                    element.remove(); // Delete the element
                    console.log(`Deleted post containing restricted word: ${elementText}`);
                }
            });
        });
    };

    // Observe DOM changes for dynamically loaded content
    const observeDOMChanges = () => {
        const observer = new MutationObserver(() => {
            deleteRestrictedWords(); // Delete restricted words whenever the DOM changes
            deletePeopleYouMayKnow(); // Delete "People You May Know" section whenever the DOM changes
            deleteElement(); // Delete specific elements whenever the DOM changes
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('MutationObserver initialized to observe DOM changes.');
    };

    // Function to delete the "People You May Know" section
    const deletePeopleYouMayKnow = () => {
        const selectors = [
            'div[aria-label="People You May Know"]',
            'div[aria-label="Ihmisiä, jotka saatat tuntea"]',
            'a[href="https://www.facebook.com/friends/suggestions/"]',
            'div[aria-label="Näytä suositukset"]',
            'a[aria-label="Friends"]',
            'div[aria-label="Friends"]',
            '.x1us19tq > div:nth-child(1) > div:nth-child(1) > ul:nth-child(1) > li:nth-child(2) > div:nth-child(1) > a:nth-child(1)',
            'div.x1i10hfl:nth-child(13)',
            'div.x1i10hfl:nth-child(13) > div:nth-child(1)',
            'div.x1i10hfl:nth-child(13) > div:nth-child(2)',
            'div.x1i10hfl:nth-child(13) > div:nth-child(3)',
            '.xjkvuk6.x1iorvi4.x1qughib.x78zum5.x6s0dn4',
            '.x1vjfegm.x1iyjqo2',
            '.x1ye3gou.x1120s5i.xn6708d.xz9dl7a.x1qughib.x1q0g3np.x78zum5',
            '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x10wlt62.x6ikm8r',
            '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d > .xh8yej3.x1n2onr6.x78zum5.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6',
            '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d > .xh8yej3.x1n2onr6.x78zum5.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div',
            '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d',
            '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d',
            '.xbbxn1n.xwxc41k.xxbr6pl.x1p5oq8j.xl56j7k.xdt5ytf.x78zum5.x6s0dn4.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div',
            '.x1xmf6yo.xev17xk.xy80clv.xso031l.xm81vs4.x178xt8z.x26u7qi.x1q0q8m5.xu3j5b3.x13fuv20.x9jhf4c.x30kzoy.xgqcy7u.x1lq5wgf.xu1343h.x1nb4dca.x1y71gwh.x1exxf4d'
        ];

        const elements = document.querySelectorAll(selectors.join(','));

        console.log(`Found ${elements.length} elements to check for deletion.`);

        elements.forEach(element => {
            // Additional condition to ensure we are on the front page and not on a profile page
            if (window.location.pathname === '/') {
                // Ensure we do not remove the "Stories" section
                if (!element.closest('div[aria-label="Stories"]') && !element.closest('div[aria-label="Tarinat"]')) {
                    element.remove(); // Delete element
                    console.log('Deleted element:', element);
                } else {
                    console.log('Skipped element (likely "Stories" section):', element);
                }
            } else {
                console.log('Skipped element (not on front page):', element);
            }
        });
    };

    // Function to delete specific elements
    const deleteElement = () => {
        const selectors = [
            'div[aria-label="Näytä suositukset"].x1i10hfl.xjbqb8w.x1ejq31n.xd10rxx.x1sy0etr.x17r0tee.x972fbf.xcfux6l.x1qhh985.xm0m39n.x1ypdohk.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tdsg8.x1hl2dhg.xggy1nq.x1o1ewxj.x3x9cwd.x1e5q0jg.x13rtm0m.x87ps6o.x1lku1pv.x1a2a7pz.x9f619.x3nfvp2.xdt5ytf.xl56j7k.x1n2onr6.xh8yej3',
            'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suositukset"]',
            'div[aria-label="Näytä suositukset"] .x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1qhmfi1.x1r1pt67.x1jdnuiz.x1x99re3',
            'div[aria-label="Näytä suositukset"] .x1ey2m1c.xds687c.x17qophe.xg01cxk.x47corl.x10l6tqk.x13vifvy.x1ebt8du.x19991ni.x1dhq9h.x1o1ewxj.x3x9cwd.x1e5q0jg.x13rtm0m',
            'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suositukset"] .x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.xi112ho.x17zwfj4.x585lrc.x1403ito.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1qhmfi1.x1r1pt67.x1jdnuiz.x1x99re3',
            'div.xsgj6o6.xw3qccf.x1xmf6yo.x1w6jkce.xusnbm3 div[aria-label="Näytä suositukset"] .x1ey2m1c.xds687c.x17qophe.xg01cxk.x47corl.x10l6tqk.x13vifvy.x1ebt8du.x19991ni.x1dhq9h.x1o1ewxj.x3x9cwd.x1e5q0jg.x13rtm0m',
            'div.x1w6jkce:nth-child(3)',
            'div.x1w6jkce:nth-child(3) > div:nth-child(1)',
            'div.x1w6jkce:nth-child(3) > div:nth-child(1) > div:nth-child(1)',
            'div.x1w6jkce:nth-child(3) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
            'div.x1w6jkce:nth-child(3) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
            'div.x1w6jkce:nth-child(3) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > i:nth-child(1)',
            'div.x1w6jkce:nth-child(3) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2)',
            'div.x1exxf4d.x1y71gwh.x1nb4dca.xu1343h.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x178xt8z.xm81vs4.xso031l.xy80clv.xev17xk.x1xmf6yo'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.remove(); // Delete element
                console.log('Deleted element:', element);
            });
        });
    };

    // Function to delete specific selectors on the page below.
    const deleteSelectorsForSpecificUrl = () => {
        const currentUrl = window.location.href;
        const specificUrl = 'https://www.facebook.com/four3four';
        const selectorsToDelete = [
            // General class selectors
            '.x1120s5i.x1n2onr6.x10wlt62.x6ikm8r.x1lliihq',
            '.x1cnzs8.xjkvuk6.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6',
            '.xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
            '.x7wzq59 > div > div > div > .x1yztbdb > .xh8yej3.x1n2onr6.x78zum5.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-div > .xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6',
            '.xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w > .xt0psk2',
            'footer > .xi81zsa.xo1l8bm.x1sibtaa.x1nxh6w3.x676frb.x4zkp8e.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w',
            '.x1xzczws.x7ep2pv.x1d1medc.xnp8db0.x1i64zmx.x1e56ztr.x1emribx.x1xmf6yo.xjl7jj.xs83m0k.xeuugli.x1ja2u2z.x1n2onr6.x9f619',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph > .xeuugli.x193iq5w.x1a2a7pz.x1pd3egz.x1qlqyl8.x1heor9g.x1vvkbs.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-h2 > .x1yc453h.xzsf02u.x1xlr1w8',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph > .xeuugli.x193iq5w.x1a2a7pz.x1pd3egz.x1qlqyl8.x1heor9g.x1vvkbs.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.html-h2',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5 > .x1k70j0n.xzueoph',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .xifccgj.x4cne27.xdt5ytf.x78zum5',
            '.x1yrsyyn.x10b6aqq.x16hj40l.xsyo7zv.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
            '.xifccgj.x4cne27.xbmpl8g.xykv574.x1y1aw1k.xwib8y2.x1ye3gou.xn6708d.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
            '.x1y1aw1k.x150jy0e.x1e558r4.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
            '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6 > .x2lwn1j.x1iyjqo2.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
            '.xquyuld.x10wlt62.x6ikm8r.xh8yej3.x9f619.xt3gfkd.xu5ydu1.xdney7k.x1qpq9i9.x1jx94hy.x1ja2u2z.x1n2onr6 > .x193iq5w.x2lah0s.xdt5ytf.x78zum5.x9f619.x1ja2u2z.x1n2onr6',
            '.x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n',
            '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
            '.x1x99re3.x1jdnuiz.x1r1pt67.x1qhmfi1.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x1403ito.x585lrc.x17zwfj4.xi112ho.x1q0g3np.xozqiw3.x6s0dn4.xl56j7k.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z',
            '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
            '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.xh8yej3.xdsb8wn.x10l6tqk.x5yr21d.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x2lah0s.x78zum5.x1ja2u2z.x9f619',
            '.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1n2onr6.x10wlt62.x6ikm8r.x1ja2u2z.x9f619',
            // Footer and nested elements
            'footer .xi81zsa',
            '.xh8yej3 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.xe8uvvx.x1ypdohk.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.xd10rxx.x1ejq31n.xjbqb8w.x1i10hfl > .x1r1pt67.x1qhmfi1.x1ye3gou.xn6708d.x9f619.xm0m39n.x1qhh985.xcfux6l.x972fbf.x1403ito.x585lrc.x17zwfj4.xi112ho.x1q0g3np.xozqiw3.x6s0dn4.xl56j7k.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z > .x1e0frkt.xljgi0e.x1608yet.xl56j7k.x78zum5.x6s0dn4 > div.xl8fo4v.x1fbi1t2.x2lah0s.x78zum5.x6s0dn4.xeuugli.x193iq5w.x1ja2u2z.x1n2onr6.x9f619 > .x1dem4cn.x1s688f.xvq8zen.x6prxxf.x3x7a5m.xudqn12.x1943h6x.x1fgarty.x1cpjm7i.x1gmr53x.xhkezso.x1s928wv.x1lliihq.x1xmvt09.x1vvkbs.x13faqbe.xeuugli.x193iq5w > .xuxw1ft.xlyipyv.x1n2onr6.x10wlt62.x6ikm8r.x1lliihq'
        ];

        if (currentUrl.includes(specificUrl)) {
            selectorsToDelete.forEach((selector) => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element) => {
                    element.remove();
                });
                console.log(`Deleted elements for selector: ${selector}`);
            });
        }
    };

    // Function to delete specific selectors on a facebook profile.
    const deleteSelectorsForSpecificProfile = () => {
        const currentUrl = window.location.href;
        const profileId = '100000639309471';
        const selectorsToDelete = [
        '.x1a2a7pz.x1ja2u2z.xh8yej3.x1n2onr6.x10wlt62.x6ikm8r.x1itg65n',
        '.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > div > .x1jfb8zj.x1qrby5j.x1n2onr6.x7ja8zs.x1t2pt76.x1lytzrv.xedcshv.xarpa2k.x3igimt.x12ejxvf.xaigb6o.x1beo9mf.x1h91t0o',
        '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > div',
        '.xu06nn8.x1jl3cmp.x2r5gy4.xnpuxes.x1hc1fzr.x879a55.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xs83m0k.x1iyjqo2.x1r8uery.xeuugli.x193iq5w.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
        '.x78zum5 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.xe8uvvx.x1ypdohk.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.xd10rxx.x1ejq31n.xjbqb8w.x1i10hfl',
        '.x78zum5 > .xh8yej3.x1n2onr6.xl56j7k.xdt5ytf.x3nfvp2.x9f619.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.x16tdsg8.xkhd6sd.x18d9i69.x4uap5.xexx8yu.x1mh8g0r.xat24cr.x11i5rnm.xdj266r.xe8uvvx.x1ypdohk.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.xd10rxx.x1ejq31n.xjbqb8w.x1i10hfl',
        '.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xamitd3.xeuugli.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x78zum5',
        '.x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619 > .xamitd3.xeuugli.x193iq5w.x2lah0s.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
        '.x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619 > .x1q0g3np.xozqiw3.x6s0dn4.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619',
        '.x2lah0s.xvo6coq.x1ve1bff.x1q0g3np.xozqiw3.x1qjc9v5.xl56j7k.x1n2onr6.x78zum5.x1ja2u2z.x9f619 > .x1y5dvz6.x16i7wwg.xqdwrps.x1pi30zi.x1swvt13.xs83m0k.x1iyjqo2.x1r8uery.xeuugli.xdt5ytf.x78zum5.x1ja2u2z.x1n2onr6.x9f619',
        '.x2lah0s.xvo6coq.x1ve1bff.x1q0g3np.xozqiw3.x1qjc9v5.xl56j7k.x1n2onr6.x78zum5.x1ja2u2z.x9f619',
        '.x7wzq59.x1xzczws.x1ja2u2z.x9f619',
        'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.xe8uvvx.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.xd10rxx.x1ejq31n.xjbqb8w.x1i10hfl:nth-of-type(4)',
        // Hiding these, until the INBRED DICKWAD is gone from that relationship status.
        '.x7wzq59 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2)',
        '.x7wzq59 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)',
        '.x7wzq59 > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > ul:nth-child(1)',
        'div.x1nhvcw1:nth-child(1)',
        'div.x1nhvcw1:nth-child(1) > div:nth-child(1)',
        'div.x1nhvcw1:nth-child(1) > div:nth-child(2)',
        'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1)',
        'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1)',
        'div.x1nhvcw1:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > span:nth-child(1)',
        'div.xifccgj.x4cne27.xbmpl8g.xykv574.xyamay9.x1swvt13.x1pi30zi.x1q0g3np.xozqiw3.x1qjc9v5.x1qughib.x1n2onr6.x2lah0s.x78zum5.x1ja2u2z.x9f619:nth-of-type(2)',
        // Added later on, removing "filters" section.
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
        'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > span:nth-child(1) > span:nth-child(1)',
        'div.xamitd3:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2)',
	'.x6d00yu'
        ];

        if (currentUrl.includes(profileId)) {
            selectorsToDelete.forEach((selector) => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element) => {
                    element.remove();
                });
                console.log(`Deleted elements for selector: ${selector}`);
            });
        }
    };

    // Function to delete selectors on another Facebook profile using MutationObserver
    const deleteSelectorsForPersonalProfile = () => {
        const currentUrl = window.location.href;
        const targetUrls = [
            'https://www.facebook.com/Haukkis/friends'
        ];
        const selectorsToDelete = [
            'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.xe8uvvx.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.xd10rxx.x1ejq31n.xjbqb8w.x1i10hfl:nth-of-type(3)',
            'div.xnjli0.x1q8cg2c.xwib8y2.x1y1aw1k.x6s0dn4.x1ja2u2z.x16tdsg8.x1n2onr6.x1gh759c.xnqzcj9.xfvfia3.x1i6fsjq.x2lah0s.x1q0g3np.x78zum5.x1ypdohk.x9f619.xjyslct.x1a2a7pz.x1lku1pv.x87ps6o.x13rtm0m.x1e5q0jg.x3x9cwd.x1o1ewxj.xggy1nq.x1hl2dhg.xe8uvvx.xm0m39n.x1qhh985.xcfux6l.x972fbf.x17r0tee.x1sy0etr.xd10rxx.x1ejq31n.xjbqb8w.x1i10hfl:nth-of-type(4)'
        ];

        if (targetUrls.includes(currentUrl)) {
            // Function to remove elements matching the selectors
            const removeElements = () => {
                selectorsToDelete.forEach((selector) => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length === 0) {
                            console.log(`No elements found for selector: ${selector}`);
                        } else {
                            elements.forEach((element) => element.remove());
                            console.log(`Deleted elements for selector: ${selector}`);
                        }
                    } catch (error) {
                        console.error(`Error processing selector: ${selector}`, error);
                    }
                });
            };

            // Initial removal of elements
            removeElements();

            // Observe DOM changes to remove elements dynamically
            const observer = new MutationObserver(removeElements);
            observer.observe(document.body, { childList: true, subtree: true });
            console.log('MutationObserver initialized to observe DOM changes.');
        } else {
            console.log(`Current URL does not match any of the target URLs.`);
        }
    };

    // Initialize the script
    const init = () => {
        console.log('Initializing script...');
        cleanUrl(); // Clean unwanted parameters
        deleteBlockedElements(); // Delete blocked elements
        handleRedirects();
        deletePeopleYouMayKnow(); // Delete "People You May Know" section
        deleteRestrictedWords(); // Delete posts with restricted words
        observeDOMChanges();
        interceptNavigation();
        deleteSelectorsForSpecificUrl();
        deleteSelectorsForSpecificProfile();
        deleteSelectorsForPersonalProfile();
    };

    // Attach event listeners
    window.addEventListener('DOMContentLoaded', init);
    window.addEventListener('load', init);

    // Handle history and dynamic content changes
    window.addEventListener('popstate', () => {
        console.log('popstate event detected.');
        cleanUrl();
        deleteBlockedElements(); // Delete blocked elements
        handleRedirects();
        deletePeopleYouMayKnow(); // Delete "People You May Know" section
        deleteRestrictedWords(); // Delete posts with restricted words
        deleteSelectorsForSpecificUrl();
        deleteSelectorsForSpecificProfile();
        deleteSelectorsForPersonalProfile();
    });

    // Regularly check the URL and reapply rules for SPAs
    setInterval(() => {
        console.log('Interval check to delete "People You May Know" section.');
        cleanUrl();
        deleteBlockedElements(); // Delete blocked elements
        handleRedirects();
        deletePeopleYouMayKnow(); // Delete "People You May Know" section
        deleteRestrictedWords(); // Delete posts with restricted words
        deleteSelectorsForSpecificUrl();
        deleteSelectorsForSpecificProfile();
        deleteSelectorsForPersonalProfile();
    }, 20); // Set frequency to 20ms

})();