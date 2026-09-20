// BraveFox Enhancer Master Password Protection Module — Firefox parity 2026-09-20

(function() {
    'use strict';

    // === BRAVEFOX COMPLETE SITE EXCLUSIONS ===
    // These sites must run exactly as if BraveFox Enhancer were disabled.
    function braveFoxIsCompletelyExcludedSite() {
        const hosts = [];
        const addHost = value => {
            const host = String(value || '').toLowerCase().replace(/\.$/, '');
            if (host && !hosts.includes(host)) hosts.push(host);
        };

        try { addHost(window.location.hostname); } catch (e) {}
        try {
            const origins = window.location.ancestorOrigins;
            if (origins) {
                for (let i = 0; i < origins.length; i++) {
                    try { addHost(new URL(origins[i]).hostname); } catch (e) {}
                }
            }
        } catch (e) {}
        try {
            if (window.top === window) addHost(window.location.hostname);
            else addHost(window.top.location.hostname);
        } catch (e) {}

        return hosts.some(host =>
            host === 'is.fi' || host.endsWith('.is.fi') ||
            host === 'iltalehti.fi' || host.endsWith('.iltalehti.fi') ||
            /^translate\.google\./i.test(host)
        );
    }

    if (braveFoxIsCompletelyExcludedSite()) return;

    
    // Password Protection Configuration
    const PASSWORD_CONFIG = {
        enabled: true,
        password: '5u89asyadhy2adhg9uh3572y1',
        sessionKey: 'bravefox_auth', 
        navigationKey: 'bravefox_navigation', 
        maxAttempts: 15,
        lockoutDuration: 300000, 
        lockoutKey: 'bravefox_lockout', 
        authTTL: 300000,
        
        targetDomains: [
            'example.com',
            'gemini.google.com'
        ],
        
        exactPaths: [
            { hostname: 'reddit.com', pathname: '/settings/preferences' },
            { hostname: 'www.reddit.com', pathname: '/settings/preferences' },
            { hostname: 'old.reddit.com', pathname: '/prefs' },
            { hostname: 'reddit.com', pathname: '/answers' },
            { hostname: 'www.reddit.com', pathname: '/answers' },
        ],
        
        urlPatterns: [
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
            'wiseoldman.net/*',
            'github.com/NightmaREE3Z*',
            '*github.com/NightmaREE3Z*',
            '*github.com/ungoogled-software*',
            'github.com/copilot*',
            'github.com/features/copilot*',
            '*gemini.google.com/gem/7b575190249c*',
            '*gemini.google.com/app/7b575190249c*',
            'gist.github.com/',
            'chrome.google.com/webstore/devconsole*', 
            '*blocksite.co/options*',
            '*blocksite.co/*BLOCK_SITES*'
        ],
        
        exactUrls: [],
        
        queryParams: [
            { param: 'tab', value: 'blocking', hostname: 'www.facebook.com', pathname: '/settings/' },
            { param: 'tab', value: 'blocking', hostname: 'facebook.com', pathname: '/settings/' },
        ]
    };
    
    let isAuthenticated = false;
    let initializationComplete = false;
    let contentHidingStyleSheet = null;
    let urlCheckInterval = null;
    let lastCheckedUrl = '';
    let facebookNavigationObserver = null;
    let facebookMutationObserver = null;
    let githubMutationObserver = null;
    let geminiMutationObserver = null;
    let chromeDevConsoleMutationObserver = null;
    let pageGateRequestInFlight = false;
    let pageGateRequestUrl = '';
    let actionGateRequestInFlight = false;

    function matchesPattern(pattern, url) {
        const cleanUrl = url.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
        const cleanPattern = pattern.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
        
        let regexPattern = cleanPattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') 
            .replace(/\\\*/g, '.*'); 
        
        if (cleanPattern.includes('github.com/nightmareee3z')) {
            if (cleanPattern === 'github.com/nightmareee3z*') {
                regexPattern = 'github\\.com/nightmareee3z($|/.*|\\?.*)';
            }
        }
        
        const regex = new RegExp('^' + regexPattern + '$', 'i');
        return regex.test(cleanUrl);
    }
    
    function shouldProtectPage() {
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        const href = window.location.href.toLowerCase();
        const search = window.location.search.toLowerCase();
        
        const isDomainMatch = PASSWORD_CONFIG.targetDomains.some(domain => {
            return hostname.includes(domain.toLowerCase());
        });
        
        const isExactPathMatch = PASSWORD_CONFIG.exactPaths.some(pathConfig => {
            const targetHostname = pathConfig.hostname.toLowerCase();
            const targetPathname = pathConfig.pathname.toLowerCase();
            
            const hostnameMatches = 
                hostname === targetHostname || 
                hostname === `www.${targetHostname}` ||
                (hostname.startsWith('www.') && hostname.substring(4) === targetHostname) ||
                (targetHostname.startsWith('www.') && targetHostname.substring(4) === hostname);
            
            return hostnameMatches && pathname === targetPathname;
        });
        
        const isPatternMatch = PASSWORD_CONFIG.urlPatterns.some(pattern => {
            return matchesPattern(pattern, href);
        });
        
        const isExactUrlMatch = PASSWORD_CONFIG.exactUrls.some(exactUrl => {
            return href === exactUrl.toLowerCase();
        });
        
        const isQueryParamMatch = PASSWORD_CONFIG.queryParams.some(paramConfig => {
            const urlParams = new URLSearchParams(search);
            const paramValue = urlParams.get(paramConfig.param);
            const paramMatches = paramValue && paramValue.toLowerCase() === paramConfig.value.toLowerCase();
            
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
                pathnameMatches = pathname === paramConfig.pathname.toLowerCase();
            }
            
            return paramMatches && hostnameMatches && pathnameMatches;
        });
        
        const isRedditSpecialCase = (
            (hostname.includes('reddit.com') || hostname.includes('old.reddit.com')) &&
            (pathname === '/settings/preferences' || pathname === '/prefs' || pathname === '/answers')
        );
        
        const isGitHubProfileMatch = (
            hostname === 'github.com' && 
            (pathname === '/nightmareee3z' || pathname === '/nightmareee3z/' || pathname.startsWith('/nightmareee3z/') || pathname.startsWith('/nightmareee3z?'))
        );
        
        return PASSWORD_CONFIG.enabled && (
            isDomainMatch || 
            isExactPathMatch || 
            isPatternMatch || 
            isExactUrlMatch || 
            isQueryParamMatch ||
            isRedditSpecialCase ||
            isGitHubProfileMatch
        );
    }
    
    function sendRuntimeMessage(message, callback) {
        try {
            const api = globalThis.browser ?? globalThis.chrome;
            if (!api?.runtime?.sendMessage) {
                callback?.(null, new Error('BraveFox runtime messaging is unavailable.'));
                return false;
            }

            if (globalThis.browser?.runtime?.sendMessage) {
                Promise.resolve(globalThis.browser.runtime.sendMessage(message)).then(response => {
                    callback?.(response || null, null);
                }).catch(error => {
                    callback?.(null, error instanceof Error ? error : new Error(String(error)));
                });
                return true;
            }

            api.runtime.sendMessage(message, response => {
                const runtimeError = api.runtime.lastError;
                callback?.(response || null, runtimeError ? new Error(runtimeError.message) : null);
            });
            return true;
        } catch (error) {
            callback?.(null, error);
            return false;
        }
    }

    function requestPagePasswordGate() {
        const currentUrl = window.location.href;

        if (pageGateRequestInFlight && pageGateRequestUrl === currentUrl) {
            hidePageContent();
            return false;
        }

        pageGateRequestInFlight = true;
        pageGateRequestUrl = currentUrl;
        isAuthenticated = false;
        hidePageContent();

        const started = sendRuntimeMessage({
            type: 'BRAVEFOX_WEB_AUTH_GATE',
            returnUrl: currentUrl,
            title: 'Saatana! Sivu salasanasuojattu'
        }, (response, error) => {
            pageGateRequestInFlight = false;

            if (error) {
                console.warn('BraveFox: Password gate request failed:', error.message);
                hidePageContent();
                setTimeout(() => {
                    if (shouldProtectPage() && window.location.href === currentUrl) {
                        requestPagePasswordGate();
                    }
                }, 1000);
                return;
            }

            if (response?.unlocked) {
                isAuthenticated = true;
                showPageContent();
                window.dispatchEvent(new CustomEvent('bravefoxAuthenticated'));
                return;
            }

            // The background owns the top-level navigation to the internal password page.
            // Keep this page blank until it is replaced.
            hidePageContent();
        });

        if (!started) {
            pageGateRequestInFlight = false;
            hidePageContent();
        }

        return false;
    }

    window.BraveFoxPasswordGate = {
        requestAction(callback, title = 'Password required', actionKey = 'generic-action') {
            if (typeof callback !== 'function') return false;
            if (actionGateRequestInFlight) return true;

            actionGateRequestInFlight = true;

            const started = sendRuntimeMessage({
                type: 'BRAVEFOX_WEB_ACTION_GATE',
                returnUrl: window.location.href,
                title: String(title || 'Password required'),
                actionKey: String(actionKey || 'generic-action')
            }, (response, error) => {
                actionGateRequestInFlight = false;

                if (error) {
                    console.warn('BraveFox: Action password gate request failed:', error.message);
                    return;
                }

                if (response?.unlocked) {
                    try { callback(); } catch {}
                    window.dispatchEvent(new CustomEvent('bravefoxActionAuthenticated'));
                }
                // If not unlocked, the background replaces this tab with the top-level
                // password page. After approval it returns here; the next protected
                // action consumes the one-time action grant.
            });

            if (!started) {
                actionGateRequestInFlight = false;
                return false;
            }

            return true;
        }
    };

    function hidePageContent() {
        if (contentHidingStyleSheet && document.contains(contentHidingStyleSheet)) {
            return;
        }

        const cssRules = [
            'body > * { visibility: hidden !important; opacity: 0 !important; }',
            'body { background: #000 !important; }',
            'nav, header, .header, .navigation, .navbar { visibility: hidden !important; opacity: 0 !important; }',
            'main, .main, .content, .container, #root, #app { visibility: hidden !important; opacity: 0 !important; }',
            '[data-reactroot], [data-vue-app] { visibility: hidden !important; opacity: 0 !important; }',
            '[data-testid], [data-click-id], .Post, .Comment, [id*="AppRouter"], [class*="Layout"] { visibility: hidden !important; opacity: 0 !important; }',
            '[role="main"], [data-pagelet], .fb_content, #content, [id*="mount"], [class*="mount"] { visibility: hidden !important; opacity: 0 !important; }',
            '[data-turbo-permanent], [data-turbo-body], [data-turbo-nav], .js-header-wrapper, .application-main, #js-repo-pjax-container, #js-pjax-container, [data-hpc] { visibility: hidden !important; opacity: 0 !important; }',
            'chat-app, .gemini-chat-app, [class*="chat-app"], [class*="gemini"], model-response, user-query { visibility: hidden !important; opacity: 0 !important; }',
            'cws-developer-console, cws-dashboard, [class*="cws-"], c-wiz { visibility: hidden !important; opacity: 0 !important; }'
        ];

        contentHidingStyleSheet = document.createElement('style');
        contentHidingStyleSheet.type = 'text/css';
        contentHidingStyleSheet.id = 'bfx-gate-style-' + Math.random().toString(36).substring(2, 8);
        contentHidingStyleSheet.textContent = cssRules.join('\n');

        const target = document.head || document.documentElement;
        target.appendChild(contentHidingStyleSheet);
    }

    function showPageContent() {
        if (contentHidingStyleSheet && contentHidingStyleSheet.parentNode) {
            contentHidingStyleSheet.parentNode.removeChild(contentHidingStyleSheet);
            contentHidingStyleSheet = null;
        }

        document.documentElement.style.visibility = 'visible';
        document.documentElement.style.opacity = '1';

        if (document.body) {
            document.body.style.visibility = 'visible';
            document.body.style.opacity = '1';
            document.body.style.display = '';
            document.body.style.background = '';
        }
    }

    function handleUrlChange() {
        const currentUrl = window.location.href;

        if (currentUrl !== lastCheckedUrl) {
            lastCheckedUrl = currentUrl;

            if (shouldProtectPage()) {
                requestPagePasswordGate();
            } else {
                isAuthenticated = true;
                showPageContent();
            }
        }
    }

    function setupGitHubNavigation() {
        if (!window.location.hostname.toLowerCase().includes('github.com')) return;
        
        document.addEventListener('turbo:visit', () => {
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 300);
        });
        
        document.addEventListener('turbo:load', () => {
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
            setTimeout(handleUrlChange, 300);
        });
        
        document.addEventListener('turbo:render', () => {
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
        });
        
        if (githubMutationObserver) githubMutationObserver.disconnect();
        
        githubMutationObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && (
                                node.matches('[data-turbo-permanent]') ||
                                node.matches('[data-turbo-body]') ||
                                node.matches('[data-turbo-nav]') ||
                                node.matches('.js-header-wrapper') ||
                                node.matches('.application-main') ||
                                node.matches('#js-repo-pjax-container') ||
                                node.matches('.js-navigation-item') ||
                                node.classList.contains('Layout')
                            )) shouldCheck = true;
                        }
                    });
                }
            });
            if (shouldCheck) {
                setTimeout(handleUrlChange, 10);
                setTimeout(handleUrlChange, 100);
            }
        });
        
        githubMutationObserver.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-turbo-permanent', 'class'] });
        
        const originalReplaceState = history.replaceState;
        const originalPushState = history.pushState;
        
        history.replaceState = function() {
            originalReplaceState.apply(history, arguments);
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
        };
        history.pushState = function() {
            originalPushState.apply(history, arguments);
            setTimeout(handleUrlChange, 10);
            setTimeout(handleUrlChange, 100);
        };
        
        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('hashchange', handleUrlChange);
        
        let rafId;
        const checkUrlWithRAF = () => {
            if (window.location.href !== lastCheckedUrl) handleUrlChange();
            rafId = requestAnimationFrame(checkUrlWithRAF);
        };
        checkUrlWithRAF();
        window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));
    }
    
    function setupFacebookNavigation() {
        if (!window.location.hostname.toLowerCase().includes('facebook.com')) return;
        
        const intervals = [100, 200, 500, 1000];
        intervals.forEach(interval => {
            setInterval(() => {
                if (window.location.href !== lastCheckedUrl) handleUrlChange();
            }, interval);
        });
        
        if (facebookMutationObserver) facebookMutationObserver.disconnect();
        
        facebookMutationObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && (node.matches('[data-pagelet]') || node.matches('[role="main"]'))) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
            });
            if (shouldCheck) {
                setTimeout(handleUrlChange, 10);
                setTimeout(handleUrlChange, 100);
            }
        });
        
        facebookMutationObserver.observe(document, { childList: true, subtree: true });
        
        const originalReplaceState = history.replaceState;
        const originalPushState = history.pushState;
        
        history.replaceState = function() {
            originalReplaceState.apply(history, arguments);
            setTimeout(handleUrlChange, 50);
        };
        history.pushState = function() {
            originalPushState.apply(history, arguments);
            setTimeout(handleUrlChange, 50);
        };
        
        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('hashchange', handleUrlChange);
    }

    function setupGeminiNavigation() {
        if (!window.location.hostname.toLowerCase().includes('gemini.google.com')) return;
        
        let rafId;
        const checkUrlWithRAF = () => {
            if (window.location.href !== lastCheckedUrl) handleUrlChange();
            rafId = requestAnimationFrame(checkUrlWithRAF);
        };
        checkUrlWithRAF();
        window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));

        if (geminiMutationObserver) geminiMutationObserver.disconnect();

        geminiMutationObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) shouldCheck = true;
            });
            if (shouldCheck) {
                setTimeout(handleUrlChange, 100);
            }
        });

        if (document.body) {
            geminiMutationObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    function setupChromeDevConsoleNavigation() {
        if (!window.location.hostname.toLowerCase().includes('chrome.google.com')) return;
        
        let rafId;
        const checkUrlWithRAF = () => {
            if (window.location.href !== lastCheckedUrl) handleUrlChange();
            rafId = requestAnimationFrame(checkUrlWithRAF);
        };
        checkUrlWithRAF();
        window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));

        if (chromeDevConsoleMutationObserver) chromeDevConsoleMutationObserver.disconnect();

        chromeDevConsoleMutationObserver = new MutationObserver((mutations) => {
            let shouldCheck = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) shouldCheck = true;
            });
            if (shouldCheck) {
                setTimeout(handleUrlChange, 100);
            }
        });

        if (document.body) {
            chromeDevConsoleMutationObserver.observe(document.body, { childList: true, subtree: true });
        }
    }
    
    function setupUrlMonitoring() {
        if (urlCheckInterval) clearInterval(urlCheckInterval);
        
        urlCheckInterval = setInterval(handleUrlChange, 200);
        window.addEventListener('popstate', handleUrlChange);
        
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
        
        window.addEventListener('hashchange', handleUrlChange);
    }
    
    function handlePasswordProtection() {
        if (!shouldProtectPage()) {
            isAuthenticated = true;
            showPageContent();
            return true;
        }

        requestPagePasswordGate();
        return false;
    }

    function initialize() {
        if (initializationComplete) return;
        initializationComplete = true;

        setupUrlMonitoring();
        setupFacebookNavigation();
        setupGitHubNavigation();
        setupGeminiNavigation(); 
        setupChromeDevConsoleNavigation(); 
        
        handlePasswordProtection();
        
        const antiTamperObserver = new MutationObserver(() => {
            if (!isAuthenticated && shouldProtectPage()) {
                if (!contentHidingStyleSheet || !document.contains(contentHidingStyleSheet)) {
                    contentHidingStyleSheet = null;
                    hidePageContent();
                }
            }
        });

        antiTamperObserver.observe(document.documentElement, { childList: true, subtree: true });

        const spaNavigationObserver = new MutationObserver(() => {
            setTimeout(handleUrlChange, 100);
        });
        
        if (document.body) {
            spaNavigationObserver.observe(document.body, {
                childList: true, subtree: true, attributes: true,
                attributeFilter: ['data-testid', 'class', 'data-pagelet', 'role', 'data-turbo-permanent']
            });
        }
    }
    
    function isSPASite() {
        const hostname = window.location.hostname.toLowerCase();
        return hostname.includes('reddit.com') || 
               hostname.includes('facebook.com') || 
               hostname.includes('fb.com') ||
               hostname.includes('github.com') ||
               hostname.includes('gemini.google.com') ||
               hostname.includes('chrome.google.com'); 
    }
    
    window.addEventListener('beforeunload', () => {
        if (urlCheckInterval) clearInterval(urlCheckInterval);
        if (facebookMutationObserver) facebookMutationObserver.disconnect();
        if (githubMutationObserver) githubMutationObserver.disconnect();
        if (geminiMutationObserver) geminiMutationObserver.disconnect();
        if (chromeDevConsoleMutationObserver) chromeDevConsoleMutationObserver.disconnect();
        
        if (contentHidingStyleSheet && contentHidingStyleSheet.parentNode) {
            contentHidingStyleSheet.parentNode.removeChild(contentHidingStyleSheet);
        }
    });
    
    if (shouldProtectPage()) {
        document.documentElement.style.background = '#000';
        document.documentElement.style.visibility = 'hidden';
        if (document.body) {
            document.body.style.background = '#000';
            document.body.style.visibility = 'hidden';
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            setTimeout(initialize, 0);
        }
        
        window.addEventListener('load', () => {
            if (!initializationComplete) initialize();
        });
        
        setTimeout(() => {
            if (!initializationComplete) initialize();
        }, 100);
    }
    
    if (isSPASite()) {
        setTimeout(() => {
            if (!initializationComplete) initialize();
            setupUrlMonitoring();
            setupFacebookNavigation();
            setupGitHubNavigation();
            setupGeminiNavigation();
            setupChromeDevConsoleNavigation(); 
        }, 500);
    }
    
})();