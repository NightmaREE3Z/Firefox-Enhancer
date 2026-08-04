// BraveFox Enhancer Password protection module.

(function() {
    'use strict';
    
    // Password Protection Configuration
    const PASSWORD_CONFIG = {
        enabled: true,
        password: '5u89asyadhy2adhg9uh3572y1', // Main password
        sessionKey: 'bravefox_blocksite_auth',
        navigationKey: 'bravefox_blocksite_navigation',
        maxAttempts: 15,
        lockoutDuration: 300000, // 5 minutes in milliseconds
        lockoutKey: 'bravefox_blocksite_lockout',
        
        // Domain-based protection (hostname contains these)
        targetDomains: [
            'example.com'
        ],
        
        // Exact URL path protection (hostname + exact pathname)
        exactPaths: [
            { hostname: 'reddit.com', pathname: '/settings/preferences' },
            { hostname: 'www.reddit.com', pathname: '/settings/preferences' },
            { hostname: 'old.reddit.com', pathname: '/prefs' },
            { hostname: 'reddit.com', pathname: '/answers' },
            { hostname: 'www.reddit.com', pathname: '/answers' },
        ],
        
        // Pattern-based URL protection (supports wildcards with *)
        urlPatterns: [
            // URL Example:
            	'virtualbox.org/*',
            	'google.com/chrome/*',
            	'chrome.google.com/*', 
            	'chromewebstore.google.com/*',
            	'google.com/intl/fi/chrome/update/*',
            	'google.com/intl/fi/chrome/*',
            	'gist.github.com/*',
            	'gist.github.com/',
            	'partner.microsoft.com/*',
            	'addons.mozilla.org/*',
		'mega.nz*',
        // FIXED: More comprehensive GitHub profile patterns
        'github.com/NightmaREE3Z*', // Matches with or without trailing content
        '*github.com/NightmaREE3Z*', // Matches with any protocol/subdomain
        ],
        
        // Full URL matching (exact href matches)
        exactUrls: [
            // Example URLs:
            // 'https://example.com/admin/dashboard',
            // 'https://site.com/dangerous-page'
        ],
        
        // Query parameter based protection
        queryParams: [
            // FIXED: Only protect Facebook blocking tab specifically
            { param: 'tab', value: 'blocking', hostname: 'www.facebook.com', pathname: '/settings/' },
            { param: 'tab', value: 'blocking', hostname: 'facebook.com', pathname: '/settings/' },
            // Examples:
            // { param: 'admin', value: 'true' },
            // { param: 'debug', value: '1' }
        ]
    };

    // NEW: accept overlay session unlock tokens as valid auth for this host
    const OVERLAY_UNLOCK_PREFIX = 'bravefox_overlay_unlocked:';
    
    let passwordOverlay = null;
    let isAuthenticated = false;
    let attemptCount = 0;
    let initializationComplete = false;
    let contentHidingStyleSheet = null;
    let urlCheckInterval = null;
    let lastCheckedUrl = '';
    let facebookNavigationObserver = null;
    let facebookMutationObserver = null;
    let githubMutationObserver = null;
    
    /**
     * Simple hash function for password comparison
     */
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
    
    /**
     * ENHANCED: Checks if a URL pattern matches current URL (supports wildcards) - IMPROVED LOGIC
     */
    function matchesPattern(pattern, url) {
        // Remove protocol and www for more flexible matching
        const cleanUrl = url.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
        const cleanPattern = pattern.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
        
        console.log('BraveFox: Pattern matching -', {
            originalUrl: url,
            cleanUrl: cleanUrl,
            originalPattern: pattern,
            cleanPattern: cleanPattern
        });
        
        // Convert pattern to regex with enhanced wildcard support
        let regexPattern = cleanPattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\\\*/g, '.*'); // Convert * to .*
        
        // Special handling for GitHub username patterns
        if (cleanPattern.includes('github.com/nightmareee3z')) {
            // Make the pattern more flexible for GitHub profile URLs
            if (cleanPattern === 'github.com/nightmareee3z*') {
                regexPattern = 'github\\.com/nightmareee3z($|/.*|\\?.*)';
            }
        }
        
        const regex = new RegExp('^' + regexPattern + '$', 'i');
        const matches = regex.test(cleanUrl);
        
        console.log('BraveFox: Pattern match result -', {
            regexPattern: regexPattern,
            matches: matches
        });
        
        return matches;
    }
    
    /**
     * Checks if current page should be password protected
     */
    function shouldProtectPage() {
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        const href = window.location.href.toLowerCase();
        const search = window.location.search.toLowerCase();
        
        console.log('BraveFox: Checking URL protection -', {
            hostname,
            pathname,
            href,
            search
        });
        
        // 1. Check for domain-based protection
        const isDomainMatch = PASSWORD_CONFIG.targetDomains.some(domain => {
            const domainLower = domain.toLowerCase();
            const matches = hostname.includes(domainLower);
            console.log(`BraveFox: Domain check - ${domainLower} in ${hostname} = ${matches}`);
            return matches;
        });
        
        // 2. Check for exact path matching
        const isExactPathMatch = PASSWORD_CONFIG.exactPaths.some(pathConfig => {
            const targetHostname = pathConfig.hostname.toLowerCase();
            const targetPathname = pathConfig.pathname.toLowerCase();
            
            // Check if hostname matches (including www variants)
            const hostnameMatches = 
                hostname === targetHostname || 
                hostname === `www.${targetHostname}` ||
                (hostname.startsWith('www.') && hostname.substring(4) === targetHostname) ||
                (targetHostname.startsWith('www.') && targetHostname.substring(4) === hostname);
            
            // Check if pathname matches exactly
            const pathnameMatches = pathname === targetPathname;
            
            const pathMatch = hostnameMatches && pathnameMatches;
            
            console.log(`BraveFox: Exact path check - ${targetHostname}${targetPathname}:`, {
                targetHostname,
                targetPathname,
                currentHostname: hostname,
                currentPathname: pathname,
                hostnameMatches,
                pathnameMatches,
                pathMatch
            });
            
            return pathMatch;
        });
        
        // 3. Check for URL pattern matching - ENHANCED
        const isPatternMatch = PASSWORD_CONFIG.urlPatterns.some(pattern => {
            const matches = matchesPattern(pattern, href);
            console.log(`BraveFox: Pattern check - ${pattern} matches ${href} = ${matches}`);
            return matches;
        });
        
        // 4. Check for exact URL matching
        const isExactUrlMatch = PASSWORD_CONFIG.exactUrls.some(exactUrl => {
            const matches = href === exactUrl.toLowerCase();
            console.log(`BraveFox: Exact URL check - ${exactUrl} === ${href} = ${matches}`);
            return matches;
        });
        
        // 5. Check for query parameter matching (ENHANCED)
        const isQueryParamMatch = PASSWORD_CONFIG.queryParams.some(paramConfig => {
            const urlParams = new URLSearchParams(search);
            const paramValue = urlParams.get(paramConfig.param);
            const paramMatches = paramValue && paramValue.toLowerCase() === paramConfig.value.toLowerCase();
            
            // Check hostname and pathname if specified in the config
            let hostnameMatches = true;
            let pathnameMatches = true;
            
            if (paramConfig.hostname) {
                const targetHostname = paramConfig.hostname.toLowerCase();
                hostnameMatches = 
                    hostname === targetHostname || 
                    hostname === `www.${targetHostname}` ||
                    (hostname.startsWith('www.') && hostname.substring(4) === targetHostname) ||
                    (targetHostname.startsWith('www.') && targetHostname.substring(4) === hostname);
            }
            
            if (paramConfig.pathname) {
                const targetPathname = paramConfig.pathname.toLowerCase();
                pathnameMatches = pathname === targetPathname;
            }
            
            const matches = paramMatches && hostnameMatches && pathnameMatches;
            
            console.log(`BraveFox: Query param check - ${paramConfig.param}=${paramConfig.value}:`, {
                paramValue,
                paramMatches,
                hostnameMatches,
                pathnameMatches,
                matches
            });
            
            return matches;
        });
        
        // 6. Additional Reddit-specific fallback check
        const isRedditSpecialCase = (
            (hostname.includes('reddit.com') || hostname.includes('old.reddit.com')) &&
            (pathname === '/settings/preferences' || pathname === '/prefs' || pathname === '/answers')
        );
        
        console.log('BraveFox: Reddit special case check:', {
            isRedditDomain: hostname.includes('reddit.com') || hostname.includes('old.reddit.com'),
            isProtectedPath: pathname === '/settings/preferences' || pathname === '/prefs' || pathname === '/answers',
            isRedditSpecialCase
        });
        
        // NEW: 7. Additional GitHub-specific fallback check for your profile
        const isGitHubProfileMatch = (
            hostname === 'github.com' && 
            (pathname === '/nightmareee3z' || pathname === '/nightmareee3z/' || pathname.startsWith('/nightmareee3z/') || pathname.startsWith('/nightmareee3z?'))
        );
        
        console.log('BraveFox: GitHub profile check:', {
            isGitHubDomain: hostname === 'github.com',
            isProfilePath: pathname === '/nightmareee3z' || pathname === '/nightmareee3z/' || pathname.startsWith('/nightmareee3z/') || pathname.startsWith('/nightmareee3z?'),
            isGitHubProfileMatch
        });
        
        const shouldProtect = PASSWORD_CONFIG.enabled && (
            isDomainMatch || 
            isExactPathMatch || 
            isPatternMatch || 
            isExactUrlMatch || 
            isQueryParamMatch ||
            isRedditSpecialCase ||
            isGitHubProfileMatch // NEW: Added GitHub profile check
        );
        
        console.log('BraveFox: Protection decision -', {
            enabled: PASSWORD_CONFIG.enabled,
            isDomainMatch,
            isExactPathMatch,
            isPatternMatch,
            isExactUrlMatch,
            isQueryParamMatch,
            isRedditSpecialCase,
            isGitHubProfileMatch, // NEW
            shouldProtect
        });
        
        return shouldProtect;
    }
    
    /**
     * Checks if this is a page refresh vs navigation
     */
    function isPageRefresh() {
        // Check if navigation flag exists (set during SPA navigation)
        const navigationFlag = sessionStorage.getItem(PASSWORD_CONFIG.navigationKey);
        if (navigationFlag) {
            // Clear the flag and return false (this is navigation, not refresh)
            sessionStorage.removeItem(PASSWORD_CONFIG.navigationKey);
            return false;
        }
        // No navigation flag means this is a fresh page load/refresh
        return true;
    }
    
    /**
     * Sets navigation flag for SPA navigation
     */
    function setNavigationFlag() {
        sessionStorage.setItem(PASSWORD_CONFIG.navigationKey, 'true');
    }
    
    /**
     * Checks if user is currently locked out
     */
    function isLockedOut() {
        const lockoutData = sessionStorage.getItem(PASSWORD_CONFIG.lockoutKey);
        if (!lockoutData) return false;
        
        const lockoutTime = parseInt(lockoutData);
        const currentTime = Date.now();
        
        if (currentTime - lockoutTime < PASSWORD_CONFIG.lockoutDuration) {
            return true;
        } else {
            // Lockout expired, clear it
            sessionStorage.removeItem(PASSWORD_CONFIG.lockoutKey);
            return false;
        }
    }
    
    /**
     * Sets lockout timestamp
     */
    function setLockout() {
        sessionStorage.setItem(PASSWORD_CONFIG.lockoutKey, Date.now().toString());
    }
    
    /**
     * Checks if user is already authenticated this session
     */
    function checkAuthentication() {
        const hostname = window.location.hostname;
        const authToken = sessionStorage.getItem(PASSWORD_CONFIG.sessionKey);
        const expectedToken = simpleHash(PASSWORD_CONFIG.password + hostname);
        const overlayUnlocked = !!sessionStorage.getItem(OVERLAY_UNLOCK_PREFIX + hostname);
        const authenticated = (authToken === expectedToken) || overlayUnlocked;
        
        console.log('BraveFox: Authentication check -', {
            authToken: authToken ? 'present' : 'missing',
            expectedToken: expectedToken ? 'calculated' : 'failed',
            overlayUnlocked,
            authenticated
        });
        
        return authenticated;
    }
    
    /**
     * Sets authentication token
     */
    function setAuthentication() {
        const authToken = simpleHash(PASSWORD_CONFIG.password + window.location.hostname);
        sessionStorage.setItem(PASSWORD_CONFIG.sessionKey, authToken);
        isAuthenticated = true;
        console.log('BraveFox: Authentication set successfully');
    }
    
    /**
     * Creates password protection overlay
     * COMBO: Prefer BraveFoxOverlay when available; fallback to inline overlay below.
     */
    function createPasswordOverlay() {
        // If overlay UI exists, use it and return early
        if (window.BraveFoxOverlay && typeof window.BraveFoxOverlay.show === 'function') {
            console.log('BraveFox: Delegating password UI to BraveFoxOverlay');
            hidePageContent();
            try {
                window.BraveFoxOverlay.show({
                    title: 'Saatana! Sivu on salasanasuojattu',
                    onSuccess: () => {
                        try { setAuthentication(); } catch {}
                        try { showPageContent(); } catch {}
                        try { removePasswordOverlay(); } catch {}
                        try { window.dispatchEvent(new CustomEvent('bravefoxAuthenticated')); } catch {}
                    }
                });
                // Also listen as a backup if overlay fires the event instead of callback
                window.addEventListener('BraveFoxOverlay:unlocked', () => {
                    try { setAuthentication(); } catch {}
                    try { showPageContent(); } catch {}
                    try { removePasswordOverlay(); } catch {}
                    try { window.dispatchEvent(new CustomEvent('bravefoxAuthenticated')); } catch {}
                }, { once: true });
            } catch (err) {
                console.warn('BraveFox: Overlay delegation failed, falling back to inline UI:', err);
            }
            return; // important: avoid building the inline UI if delegation succeeded
        }

        if (passwordOverlay) {
            console.log('BraveFox: Password overlay already exists');
            return; // Already exists
        }
        
        console.log('BraveFox: Creating password protection overlay (inline fallback)');
        
        // Create overlay container
        passwordOverlay = document.createElement('div');
        passwordOverlay.id = 'bravefox-password-overlay';
        passwordOverlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.95) !important;
            z-index: 2147483647 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            pointer-events: auto !important;
        `;
        
        // Create dialog container
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white !important;
            border-radius: 8px !important;
            padding: 40px !important;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
            max-width: 400px !important;
            width: 90% !important;
            text-align: center !important;
            position: relative !important;
            z-index: 2147483648 !important;
        `;
        
        // Create title
        const title = document.createElement('h2');
        title.textContent = 'Saatana! Sivusto salasanasuojattu';
        title.style.cssText = `
            margin: 0 0 20px 0 !important;
            color: #333 !important;
            font-size: 24px !important;
            font-weight: 600 !important;
        `;
        
        // Create description
        const description = document.createElement('p');
        description.textContent = 'Tämä sivu on salasuojattu BraveFox Enhancerilla';
        description.style.cssText = `
            margin: 0 0 30px 0 !important;
            color: #666 !important;
            font-size: 16px !important;
            line-height: 1.5 !important;
        `;
        
        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            margin-bottom: 20px !important;
        `;
        
        // Create password input
        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.placeholder = 'Laita se vitun salasana tähän.';
        passwordInput.style.cssText = `
            width: 100% !important;
            padding: 12px 16px !important;
            border: 2px solid #ddd !important;
            border-radius: 6px !important;
            font-size: 16px !important;
            box-sizing: border-box !important;
            outline: none !important;
            transition: border-color 0.2s !important;
        `;
        
        // Create submit button
        const submitButton = document.createElement('button');
        submitButton.textContent = 'Kirjaudu sisään';
        submitButton.style.cssText = `
            width: 100% !important;
            padding: 12px 16px !important;
            background: #007bff !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            font-size: 16px !important;
            cursor: pointer !important;
            transition: background-color 0.2s !important;
            margin-bottom: 10px !important;
        `;
        
        // Create error message container
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            color: #dc3545 !important;
            font-size: 14px !important;
            margin-top: 10px !important;
            min-height: 20px !important;
        `;
        
        // Create lockout message if applicable
        if (isLockedOut()) {
            const lockoutTime = parseInt(sessionStorage.getItem(PASSWORD_CONFIG.lockoutKey));
            const remainingTime = Math.ceil((PASSWORD_CONFIG.lockoutDuration - (Date.now() - lockoutTime)) / 60000);
            errorMessage.textContent = `Odota nyt saatana ${remainingTime} minuuttia, koska yritit äsken liikaa.`;
            passwordInput.disabled = true;
            submitButton.disabled = true;
            submitButton.style.opacity = '0.5';
            submitButton.style.cursor = 'not-allowed';
        }
        
        // Handle form submission
        function handleSubmit() {
            if (isLockedOut()) return;
            
            const enteredPassword = passwordInput.value;
            console.log('BraveFox: Password attempt made');
            
            if (enteredPassword === PASSWORD_CONFIG.password) {
                // Correct password
                console.log('BraveFox: Salasana oikein, kirjaudutaan sisään');
                setAuthentication();
                removePasswordOverlay();
                showPageContent();
                attemptCount = 0;
                // Clear any lockout
                sessionStorage.removeItem(PASSWORD_CONFIG.lockoutKey);
                
                // Trigger custom event to notify main script
                window.dispatchEvent(new CustomEvent('bravefoxAuthenticated'));
            } else {
                // Wrong password
                attemptCount++;
                passwordInput.value = '';
                passwordInput.style.borderColor = '#dc3545';
                console.log(`Voi vittu, väärä salasana! Yritys ${attemptCount}/${PASSWORD_CONFIG.maxAttempts}`);
                
                if (attemptCount >= PASSWORD_CONFIG.maxAttempts) {
                    setLockout();
                    errorMessage.textContent = `Salasanasivu lukittu ${PASSWORD_CONFIG.lockoutDuration / 60000} ajaksi.`;
                    passwordInput.disabled = true;
                    submitButton.disabled = true;
                    submitButton.style.opacity = '0.5';
                    submitButton.style.cursor = 'not-allowed';
                    console.log('Salasana lukittu, koska käyttäjä yritti liian montaa virheellistä salasanaa jollain onnettomalla sivustolla');
                } else {
                    const remaining = PASSWORD_CONFIG.maxAttempts - attemptCount;
                    errorMessage.textContent = `Vittu, väärä salasana! ${remaining} yritystä${remaining > 1 ? '' : ''} jäljellä.`;
                }
                
                setTimeout(() => {
                    passwordInput.style.borderColor = '#ddd';
                }, 2000);
            }
        }
        
        // Event listeners
        submitButton.addEventListener('click', handleSubmit);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        });
        
        passwordInput.addEventListener('focus', () => {
            passwordInput.style.borderColor = '#007bff';
        });
        
        passwordInput.addEventListener('blur', () => {
            passwordInput.style.borderColor = '#ddd';
        });
        
        submitButton.addEventListener('mouseenter', () => {
            if (!submitButton.disabled) {
                submitButton.style.backgroundColor = '#0056b3';
            }
        });
        
        submitButton.addEventListener('mouseleave', () => {
            if (!submitButton.disabled) {
                submitButton.style.backgroundColor = '#007bff';
            }
        });
        
        // Assemble dialog
        inputContainer.appendChild(passwordInput);
        dialog.appendChild(title);
        dialog.appendChild(description);
        dialog.appendChild(inputContainer);
        dialog.appendChild(submitButton);
        dialog.appendChild(errorMessage);
        passwordOverlay.appendChild(dialog);
        
        // Add to page - try multiple attachment points
        const attachmentTarget = document.body || document.documentElement;
        attachmentTarget.appendChild(passwordOverlay);
        
        // Focus password input
        setTimeout(() => {
            passwordInput.focus();
        }, 100);
        
        console.log('BraveFox: Password protection overlay created and added to page (inline fallback)');
    }
    
    /**
     * Removes password protection overlay
     */
    function removePasswordOverlay() {
        if (passwordOverlay && passwordOverlay.parentNode) {
            passwordOverlay.parentNode.removeChild(passwordOverlay);
            passwordOverlay = null;
            console.log('BraveFox: Password protection overlay removed');
        }
    }
    
    /**
     * Hides page content until authenticated using CSS injection
     */
    function hidePageContent() {
        if (contentHidingStyleSheet) {
            return; // Already hidden
        }
        
        console.log('BraveFox: Hiding page content with CSS');
        
        const cssRules = [
            /* Hide all body content but not the password overlay */
            'body > *:not(#bravefox-password-overlay) { visibility: hidden !important; opacity: 0 !important; }',
            'body { background: #000 !important; }',
            /* Ensure password overlay is always visible */
            '#bravefox-password-overlay { visibility: visible !important; opacity: 1 !important; display: flex !important; }',
            /* Hide specific BlockSite elements */
            '[data-automation], .sc-kqGoIF, .sc-gsFSXq, .sc-cscAeM, .sc-dxcDKg { visibility: hidden !important; opacity: 0 !important; }',
            /* Hide navigation and header elements */
            'nav, header, .header, .navigation, .navbar { visibility: hidden !important; opacity: 0 !important; }',
            /* Hide main content areas */
            'main, .main, .content, .container, #root, #app { visibility: hidden !important; opacity: 0 !important; }',
            /* Hide specific React/Vue containers */
            '[data-reactroot], [data-vue-app] { visibility: hidden !important; opacity: 0 !important; }',
            /* Hide Reddit-specific elements */
            '[data-testid], [data-click-id], .Post, .Comment, [id*="AppRouter"], [class*="Layout"] { visibility: hidden !important; opacity: 0 !important; }',
            /* Hide Facebook-specific elements */
            '[role="main"], [data-pagelet], .fb_content, #content, [id*="mount"], [class*="mount"] { visibility: hidden !important; opacity: 0 !important; }',
            /* Hide GitHub-specific elements */
            '[data-turbo-permanent], [data-turbo-body], [data-turbo-nav], .js-header-wrapper, .application-main, #js-repo-pjax-container, #js-pjax-container, [data-hpc] { visibility: hidden !important; opacity: 0 !important; }'
        ];
        
        contentHidingStyleSheet = document.createElement('style');
        contentHidingStyleSheet.type = 'text/css';
        contentHidingStyleSheet.id = 'bravefox-content-hider';
        contentHidingStyleSheet.textContent = cssRules.join('\n');
        
        const target = document.head || document.documentElement;
        target.appendChild(contentHidingStyleSheet);
        
        console.log('BraveFox: Content hiding CSS injected');
    }
    
    /**
     * Shows page content after authentication
     */
    function showPageContent() {
        console.log('BraveFox: Showing page content');
        
        // Remove content hiding stylesheet
        if (contentHidingStyleSheet && contentHidingStyleSheet.parentNode) {
            contentHidingStyleSheet.parentNode.removeChild(contentHidingStyleSheet);
            contentHidingStyleSheet = null;
        }
        
        // Reset any inline styles that might be hiding content
        document.documentElement.style.visibility = 'visible';
        document.documentElement.style.opacity = '1';
        
        if (document.body) {
            document.body.style.visibility = 'visible';
            document.body.style.opacity = '1';
            document.body.style.display = '';
            document.body.style.background = '';
        }
        
        console.log('BraveFox: Page content revealed');
    }
    
    /**
     * Handles URL change detection for SPAs
     */
    function handleUrlChange() {
        const currentUrl = window.location.href;
        
        if (currentUrl !== lastCheckedUrl) {
            lastCheckedUrl = currentUrl;
            console.log('BraveFox: URL change detected in SPA:', currentUrl);
            
            // Set navigation flag for SPA navigation
            setNavigationFlag();
            
            // Check if we need to show password protection
            if (shouldProtectPage()) {
                console.log('BraveFox: Protected page detected after navigation');
                if (!checkAuthentication()) {
                    console.log('BraveFox: Not authenticated, showing password overlay');
                    createPasswordOverlay();
                    hidePageContent();
                } else {
                    console.log('BraveFox: Already authenticated');
                    showPageContent();
                    removePasswordOverlay();
                }
            } else {
                console.log('BraveFox: Not a protected page, ensuring content is visible');
                showPageContent();
                removePasswordOverlay();
            }
        }
    }
    
    /**
     * GitHub-specific navigation detection
     */
    function setupGitHubNavigation() {
        if (!window.location.hostname.toLowerCase().includes('github.com')) {
            return;
        }
        
        console.log('BraveFox: Setting up GitHub-specific navigation detection');
        
        // Strategy 1: Watch for Turbo navigation events (GitHub uses Turbo)
        document.addEventListener('turbo:visit', () => {
            console.log('BraveFox: GitHub Turbo visit detected');
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 300);
        });
        
        document.addEventListener('turbo:load', () => {
            console.log('BraveFox: GitHub Turbo load detected');
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 300);
        });
        
        document.addEventListener('turbo:render', () => {
            console.log('BraveFox: GitHub Turbo render detected');
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
        });
        
        document.addEventListener('turbo:before-cache', () => {
            console.log('BraveFox: GitHub Turbo before-cache detected');
            setTimeout(handleUrlChange, 10);
        });
        
        // Strategy 2: Enhanced MutationObserver for GitHub-specific elements
        if (githubMutationObserver) {
            githubMutationObserver.disconnect();
        }
        
        githubMutationObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach(mutation => {
                // Check for added nodes that might indicate navigation
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // GitHub-specific navigation indicators
                            if (node.matches && (
                                node.matches('[data-turbo-permanent]') ||
                                node.matches('[data-turbo-body]') ||
                                node.matches('[data-turbo-nav]') ||
                                node.matches('.js-header-wrapper') ||
                                node.matches('.application-main') ||
                                node.matches('#js-repo-pjax-container') ||
                                node.matches('#js-pjax-container') ||
                                node.matches('[data-hpc]') ||
                                node.matches('.js-navigation-item') ||
                                node.matches('[data-testid]') ||
                                node.classList.contains('Layout') ||
                                node.classList.contains('Layout-main') ||
                                node.classList.contains('Layout-sidebar')
                            )) {
                                shouldCheck = true;
                            }
                            
                            // Also check child elements for GitHub navigation patterns
                            if (node.querySelector) {
                                const hasNavElements = node.querySelector(`
                                    [data-turbo-permanent], [data-turbo-body], [data-turbo-nav], 
                                    .js-header-wrapper, .application-main, #js-repo-pjax-container, 
                                    #js-pjax-container, [data-hpc], .js-navigation-item, [data-testid],
                                    .Layout, .Layout-main, .Layout-sidebar
                                `);
                                if (hasNavElements) {
                                    shouldCheck = true;
                                }
                            }
                        }
                    });
                }
                
                // Check for removed nodes that might indicate navigation cleanup
                if (mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches) {
                            if (node.matches(`
                                [data-turbo-permanent], [data-turbo-body], [data-turbo-nav], 
                                .js-header-wrapper, .application-main, #js-repo-pjax-container, 
                                #js-pjax-container, [data-hpc], .js-navigation-item
                            `)) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
                
                // Check for attribute changes that might indicate navigation
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'data-turbo-permanent' || 
                     mutation.attributeName === 'data-turbo-body' ||
                     mutation.attributeName === 'data-turbo-nav' ||
                     mutation.attributeName === 'class' ||
                     mutation.attributeName === 'data-hpc' ||
                     mutation.attributeName === 'data-testid')) {
                    shouldCheck = true;
                }
            });
            
            if (shouldCheck) {
                console.log('BraveFox: GitHub DOM change detected, checking URL');
                setTimeout(handleUrlChange, 10);
                setTimeout(handleUrlChange, 100);
                setTimeout(handleUrlChange, 300);
            }
        });
        
        // Start observing the entire document for GitHub with comprehensive options
        githubMutationObserver.observe(document, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-turbo-permanent', 'data-turbo-body', 'data-turbo-nav', 'class', 'data-hpc', 'data-testid', 'id'],
            characterData: false
        });
        
        // Strategy 3: Override GitHub's navigation methods with enhanced detection
        const originalReplaceState = history.replaceState;
        const originalPushState = history.pushState;
        
        history.replaceState = function() {
            originalReplaceState.apply(history, arguments);
            console.log('BraveFox: GitHub history.replaceState called');
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 50);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 200);
        };
        
        history.pushState = function() {
            originalPushState.apply(history, arguments);
            console.log('BraveFox: GitHub history.pushState called');
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 50);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 200);
        };
        
        // Strategy 4: Listen for standard navigation events
        window.addEventListener('popstate', () => {
            console.log('BraveFox: GitHub popstate event fired');
            handleUrlChange();
        });
        
        window.addEventListener('hashchange', () => {
            console.log('BraveFox: GitHub hashchange event fired');
            handleUrlChange();
        });
        
        // Strategy 5: Watch for PJAX navigation (GitHub still uses some PJAX)
        document.addEventListener('pjax:start', () => {
            console.log('BraveFox: GitHub PJAX start detected');
            setTimeout(handleUrlChange, 10);
        });
        
        document.addEventListener('pjax:end', () => {
            console.log('BraveFox: GitHub PJAX end detected');
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 300);
        });
        
        // Strategy 6: Watch for URL changes in the address bar using RAF
        let rafId;
        const checkUrlWithRAF = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastCheckedUrl) {
                console.log('BraveFox: GitHub URL change detected via RAF:', currentUrl);
                handleUrlChange();
            }
            rafId = requestAnimationFrame(checkUrlWithRAF);
        };
        
        checkUrlWithRAF();
        
        // Clean up RAF on page unload
        window.addEventListener('beforeunload', () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
        });
    }
    
    /**
     * Facebook-specific navigation detection
     */
    function setupFacebookNavigation() {
        if (!window.location.hostname.toLowerCase().includes('facebook.com')) {
            return;
        }
        
        console.log('BraveFox: Setting up Facebook-specific navigation detection');
        
        // Strategy 1: Watch for URL changes with multiple intervals
        const intervals = [100, 200, 500, 1000];
        intervals.forEach(interval => {
            setInterval(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastCheckedUrl) {
                    console.log(`BraveFox: Facebook URL change detected (${interval}ms interval):`, currentUrl);
                    handleUrlChange();
                }
            }, interval);
        });
        
        // Strategy 2: Enhanced MutationObserver for Facebook
        if (facebookMutationObserver) {
            facebookMutationObserver.disconnect();
        }
        
        facebookMutationObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach(mutation => {
                // Check for added nodes that might indicate navigation
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Facebook-specific navigation indicators
                            if (node.matches && (
                                node.matches('[data-pagelet]') ||
                                node.matches('[role="main"]') ||
                                node.matches('[data-testid]') ||
                                node.classList.contains('x1n2onr6') || // Facebook class patterns
                                node.classList.contains('x78zum5') ||
                                node.id && node.id.includes('mount')
                            )) {
                                shouldCheck = true;
                            }
                            
                            // Also check child elements for Facebook navigation patterns
                            if (node.querySelector) {
                                const hasNavElements = node.querySelector('[data-pagelet], [role="main"], [data-testid]');
                                if (hasNavElements) {
                                    shouldCheck = true;
                                }
                            }
                        }
                    });
                }
                
                // Check for removed nodes that might indicate navigation cleanup
                if (mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches) {
                            if (node.matches('[data-pagelet], [role="main"], [data-testid]')) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
                
                // Check for attribute changes that might indicate navigation
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'data-pagelet' || 
                     mutation.attributeName === 'class' ||
                     mutation.attributeName === 'role' ||
                     mutation.attributeName === 'data-testid')) {
                    shouldCheck = true;
                }
            });
            
            if (shouldCheck) {
                console.log('BraveFox: Facebook DOM change detected, checking URL');
                setTimeout(handleUrlChange, 10);
                setTimeout(handleUrlChange, 100);
                setTimeout(handleUrlChange, 300);
            }
        });
        
        // Start observing the entire document for Facebook with comprehensive options
        facebookMutationObserver.observe(document, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-pagelet', 'class', 'role', 'data-testid', 'id'],
            characterData: false
        });
        
        // Strategy 3: Override Facebook's navigation methods with enhanced detection
        const originalReplaceState = history.replaceState;
        const originalPushState = history.pushState;
        
        history.replaceState = function() {
            originalReplaceState.apply(history, arguments);
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 50);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 200);
        };
        
        history.pushState = function() {
            originalPushState.apply(history, arguments);
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 50);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 200);
        };
        
        // Strategy 4: Listen for standard navigation events
        window.addEventListener('popstate', () => {
            handleUrlChange();
        });
        
        window.addEventListener('hashchange', () => {
            handleUrlChange();
        });
        
        // Strategy 6: Watch for URL changes in the address bar using RAF
        let rafId;
        const checkUrlWithRAF = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastCheckedUrl) {
                handleUrlChange();
            }
            rafId = requestAnimationFrame(checkUrlWithRAF);
        };
        
        checkUrlWithRAF();
        
        // Clean up RAF on page unload
        window.addEventListener('beforeunload', () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
        });
    }
    
    /**
     * Sets up URL monitoring for SPA navigation
     */
    function setupUrlMonitoring() {
        // Clear existing interval if any
        if (urlCheckInterval) {
            clearInterval(urlCheckInterval);
        }
        
        // Set up more frequent URL checking for better SPA detection
        urlCheckInterval = setInterval(handleUrlChange, 200);
        
        // Also listen for popstate events
        window.addEventListener('popstate', handleUrlChange);
        
        // Override pushState and replaceState to catch programmatic navigation
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function() {
            originalPushState.apply(history, arguments);
            setTimeout(handleUrlChange, 50);
        };
        
        history.replaceState = function() {
            originalReplaceState.apply(history, arguments);
            setTimeout(handleUrlChange, 50);
        };
        
        // Listen for hashchange events as well
        window.addEventListener('hashchange', handleUrlChange);
        
        console.log('BraveFox: SPA URL monitoring set up');
    }
    
    /**
     * Handles password protection logic
     */
    function handlePasswordProtection() {
        console.log('BraveFox: handlePasswordProtection called');
        
        if (!shouldProtectPage()) {
            console.log('BraveFox: Page should not be protected, allowing access');
            isAuthenticated = true;
            showPageContent();
            return true;
        }
        
        console.log('BraveFox: Page should be protected, checking authentication');
        
        // Check if this is navigation vs refresh/first visit
        const isRefresh = isPageRefresh();
        console.log('BraveFox: Page refresh detected:', isRefresh);
        
        if (isRefresh) {
            // Page refresh or first visit - require authentication
            isAuthenticated = checkAuthentication();
            if (!isAuthenticated) {
                console.log('BraveFox: Not authenticated, showing password overlay');
                createPasswordOverlay(); // Delegates to overlay if available, else builds inline fallback
                hidePageContent(); // Then hide content
                return false;
            } else {
                console.log('BraveFox: Already authenticated, showing content');
                showPageContent();
                removePasswordOverlay();
                return true;
            }
        } else {
            // SPA navigation - keep existing authentication
            isAuthenticated = checkAuthentication();
            console.log('BraveFox: SPA navigation, authentication status:', isAuthenticated);
        }
        
        if (isAuthenticated) {
            showPageContent();
            removePasswordOverlay();
            return true;
        } else {
            createPasswordOverlay(); // Delegates to overlay if available, else builds inline
            hidePageContent(); // Then hide content
            return false;
        }
    }
    
    /**
     * Gets current authentication status
     */
    function getAuthenticationStatus() {
        return isAuthenticated;
    }
    
    /**
     * Clears authentication (logout)
     */
    function clearAuthentication() {
        sessionStorage.removeItem(PASSWORD_CONFIG.sessionKey);
        // Also clear overlay unlock token for this host
        try { sessionStorage.removeItem(OVERLAY_UNLOCK_PREFIX + window.location.hostname); } catch {}
        isAuthenticated = false;
        console.log('BraveFox: Authentication cleared');
    }
    
    /**
     * Updates password configuration
     */
    function updatePasswordConfig(newConfig) {
        Object.assign(PASSWORD_CONFIG, newConfig);
        console.log('BraveFox: Password configuration updated');
    }
    
    /**
     * Gets password configuration (without exposing actual password)
     */
    function getPasswordConfig() {
        const config = { ...PASSWORD_CONFIG };
        delete config.password; // Don't expose the actual password
        return config;
    }
    
    /**
     * Initialize password protection
     */
    function initialize() {
        if (initializationComplete) {
            console.log('BraveFox: Password protection already initialized');
            return;
        }
        
        console.log('BraveFox: Initializing password protection');
        initializationComplete = true;

        // If overlay has already been unlocked for this host, mark authed
        try {
            if (sessionStorage.getItem(OVERLAY_UNLOCK_PREFIX + window.location.hostname) === '1') {
                setAuthentication();
            }
        } catch {}
        
        // Listen for overlay unlock events as a universal combo signal
        window.addEventListener('BraveFoxOverlay:unlocked', () => {
            try { setAuthentication(); } catch {}
            try { showPageContent(); } catch {}
            try { removePasswordOverlay(); } catch {}
            try { window.dispatchEvent(new CustomEvent('bravefoxAuthenticated')); } catch {}
        });

        // Set up URL monitoring for SPA navigation
        setupUrlMonitoring();
        
        // Set up site-specific navigation detection
        setupFacebookNavigation();
        setupGitHubNavigation();
        
        // Run password protection immediately
        handlePasswordProtection();
        
        // Set up observers for dynamic content
        const observer = new MutationObserver(() => {
            if (!isAuthenticated && shouldProtectPage()) {
                // Ensure password overlay exists
                if (!passwordOverlay) {
                    createPasswordOverlay();
                }
                // Ensure content is hidden
                if (!contentHidingStyleSheet) {
                    hidePageContent();
                }
            }
        });
        
        // Start observing
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        
        // Additional SPA-specific navigation detection
        const spaNavigationObserver = new MutationObserver(() => {
            // Check for SPA navigation by monitoring URL changes
            setTimeout(handleUrlChange, 100);
        });
        
        // Observe changes to SPA elements
        if (document.body) {
            spaNavigationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-testid', 'class', 'data-pagelet', 'role', 'data-turbo-permanent', 'data-turbo-body', 'data-hpc']
            });
        }
    }
    
    /**
     * Checks if current site is a known SPA
     */
    function isSPASite() {
        const hostname = window.location.hostname.toLowerCase();
        return hostname.includes('reddit.com') || 
               hostname.includes('facebook.com') || 
               hostname.includes('fb.com') ||
               hostname.includes('github.com');
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (urlCheckInterval) {
            clearInterval(urlCheckInterval);
        }
        if (facebookMutationObserver) {
            facebookMutationObserver.disconnect();
        }
        if (githubMutationObserver) {
            githubMutationObserver.disconnect();
        }
        removePasswordOverlay();
        if (contentHidingStyleSheet && contentHidingStyleSheet.parentNode) {
            contentHidingStyleSheet.parentNode.removeChild(contentHidingStyleSheet);
        }
    });
    
    // Expose the password protection API to global scope
    window.BraveFoxPasswordProtection = {
        handlePasswordProtection,
        createPasswordOverlay,
        removePasswordOverlay,
        hidePageContent,
        showPageContent,
        setNavigationFlag,
        getAuthenticationStatus,
        clearAuthentication,
        updatePasswordConfig,
        getPasswordConfig,
        checkAuthentication,
        setAuthentication,
        isPageRefresh,
        isLockedOut,
        shouldProtectPage,
        initialize,
        handleUrlChange,
        setupUrlMonitoring,
        setupFacebookNavigation,
        setupGitHubNavigation,
        matchesPattern,
        isSPASite
    };
    
    console.log('BraveFox: Password protection module loaded');
    
    // Auto-initialize immediately if on target domain
    if (shouldProtectPage()) {
        console.log('BraveFox: Target domain detected, initializing immediately');
        
        // Hide content immediately as emergency measure if not authenticated
        if (!checkAuthentication()) {
            document.documentElement.style.background = '#000';
            if (document.body) {
                document.body.style.background = '#000';
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            setTimeout(initialize, 0);
        }
        
        // Also initialize on window load as backup
        window.addEventListener('load', () => {
            if (!initializationComplete) {
                initialize();
            }
        });
        
        // Emergency initialization after a short delay
        setTimeout(() => {
            if (!initializationComplete) {
                console.log('BraveFox: Emergency initialization triggered');
                initialize();
            }
        }, 100);
    }
    
    // Initialize immediately for known SPA sites (Reddit, Facebook, AND GitHub)
    if (isSPASite()) {
        console.log('BraveFox: SPA site detected, setting up SPA monitoring');
        setTimeout(() => {
            if (!initializationComplete) {
                initialize();
            }
            // Always set up URL monitoring for SPA sites
            setupUrlMonitoring();
            // Set up site-specific navigation detection
            setupFacebookNavigation();
            setupGitHubNavigation();
        }, 500);
    }
    
})();