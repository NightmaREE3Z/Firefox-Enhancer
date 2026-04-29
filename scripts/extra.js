(function() {
'use strict';

    // ===== Lightweight lifecycle/memory tracking =====
    const __timers = { intervals: new Set(), timeouts: new Set() };
    const __observers = new Set();
    const __eventCleanups = new Set();
    const __rafIds = new Set(); // track requestAnimationFrame ids
    let __cleanupRan = false;
    let __intervalsRunning = false;
    let __isRedirectingFast = false; // new: guards double redirects

    // Track the context of the last clicked 3-dot menu in Gemini
    let lastClickedWasGem = false;

    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        __timers.intervals.add(id);
        return id;
    }
    function addTimeout(fn, ms) {
        const id = setTimeout(() => {
            __timers.timeouts.delete(id);
            try { fn(); } catch {}
        }, ms);
        __timers.timeouts.add(id);
        return id;
    }
    function addRAF(fn) {
        const id = requestAnimationFrame((ts) => {
            __rafIds.delete(id);
            try { fn(ts); } catch {}
        });
        __rafIds.add(id);
        return id;
    }
    function stopIntervals() {
        __timers.intervals.forEach(id => { try { clearInterval(id); } catch {} });
        __timers.intervals.clear();
        __intervalsRunning = false;
    }
    function startIntervals(schedulerFn) {
        if (__intervalsRunning) return;
        schedulerFn();
        __intervalsRunning = true;
    }
    function trackObserver(observer) {
        __observers.add(observer);
        return observer;
    }
    function onEvent(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        __eventCleanups.add(() => target.removeEventListener(type, handler, options));
    }
    function cleanup() {
        if (__cleanupRan) return;
        __cleanupRan = true;
        try {
            stopIntervals();
            __timers.timeouts.forEach(id => { try { clearTimeout(id); } catch {} });
            __timers.timeouts.clear();
            __rafIds.forEach(id => { try { cancelAnimationFrame(id); } catch {} });
            __rafIds.clear();
            __observers.forEach(obs => { try { obs.disconnect(); } catch {} });
            __observers.clear();
            __eventCleanups.forEach(fn => { try { fn(); } catch {} });
            __eventCleanups.clear();
            try { document.getElementById('extra-redirect-style')?.remove(); } catch {}
            try { document.getElementById('extra-blank-style')?.remove(); } catch {}
        } catch {}
    }

    // ===== Protected Snapchat Chat Sidebar Selectors (never hide/delete these) =====
    const snapchatProtectedSelectors = [
        '.BL7do',
        '.XlW_1',
        '.AbUJt',
        '.Titq2',
        '.FBTDE',
        '.D8ovh',
        '.lzKDW',
        '.vbVAI',
        '.JM4Qm',
        '.yLNNg',
        '.toJ1p',
        '.KcY9t',
        '.kwuI_',
        '.eKaL7',
        '.Bnaur',
        '.zUzvu',
        '.LsbRg',
        '.n6VkK',
        '.wHvEy',
        '.xGUM5',
        '.PrUqm',
        '.XLCCn',
        '.cJcor',
        '.zwwmh',
        '.yC1EG',
        '._S446',
        '.POnGV',
        '.DkxOl',
        '.C5Sux',
        '.dmsdi',
        '.Vhq_T',
        '.deg2K',
        '.ReactVirtualized__Grid',
        '.ReactVirtualized__List',
        '.QAr02',
        '.ReactVirtualized__Grid__innerScrollContainer',
        '.O4POs',
        '.LNwMF',
        '.yOCPc',
        '.RGJQE',
        '.sTfiC',
        '.xllKA',
        '.Dozhe',
        '.uALhC',
        '.BbZFb',
        '.mYSR9',
        '.FiLwP',
        '.PWxCe',
        '.nmvCS',
        '.k2F9c',
        '.Hzb7k',
        '.aXdlm',
        '.Gq3RH',
        '.ovUsZ',
        '.GQKvA',
        '.rNemx',
        '.w15C2',
        '.HEkDJ',
        '.resize-triggers',
        '.expand-trigger',
        '.contract-trigger',
        '#comma1',
        'div.UZxw_ button.Rknx9',
        'button.Rknx9',
        'svg[viewBox="0 0 10 14"]',
        'path[fill-rule="evenodd"]'
    ];

    // NEW: IRC Galleria selectors to hide immediately
    const ircGalleriaSelectorsToHide = [
        '#thumb_div_129640995',
        '#thumb_div_129640994',
        '#thumb_div_129640992',
        '#thumb_div_129580627',
        '#thumb_div_129559690',
        '#thumb_div_129640997',
        '#thumb_div_129640991',
        '#thumb_div_129684375',
        '#thumb_div_130016541',
        '#thumb_div_129804009',
        '#thumb_div_129262368',
        '#thumb_div_128593982',
        '#image-129684375-image',
        '#image-129640994-image',
        '#image-129640992-image',
        '#image-129580627-image',
        '#image-129640995-image',
        '#image-129262368-image',
        '#image-129559690-image',
        '#image-128593982-image',
        '#image-131040158-image',
        '#talk-contacts-header',
        '#talk-conversations',
        '#talk-contacts',
        '#submenu-profile',
        '#h2-icon > a > img',
        '#user-information > div.center > div > dl > dd.fn.first.last',
        '#profile-image',
        '#submenu-album',
        '#submenu-album > a',
        '#profile-image > div.center > div > div.prevnext.mode-classic > a',
        '#profile-image > div.center > div > div.prevnext.mode-classic > span',
        '#profile-image > div.center > div > div.prevnext.mode-classic'
    ];

    const ircGalleriaBannedPatterns = [
        'irpp4/album?page=1', 'irpp4/album?page=0', 'irpp4/album', 'irpp4',
        'picture/129640994', 'picture/129640992', 'picture/129262368', 'picture/129580627',
        'picture/129640995', 'picture/129559690', 'picture/129640997', 'picture/129640991',
        'picture/130016541', 'picture/129804009', 'picture/129684375', 'picture/128593982'
    ];

    // NEW: Snapchat unwanted elements to hide (e.g., Spotlight menu button)
    const snapchatUnwantedSelectors = [
        '.OwWqx[title="Katso valokeilatarinoita"]',  
    ];

    // NEW: Gemini unwanted elements to hide (Delete button removed from global hide list to allow context-based logic)
    const geminiUnwantedSelectors = [
        '[data-test-id="bard-g1-dynamic-upsell-menu-button"]',
        '[data-test-id="desktop-upgrade-tier2-button"]',
        '[data-test-id="notebook-lm-button"]',
        '.g1-upsell-container',
        '.upgrade-container',
	'g1-dynamic-upsell-button.ng-star-inserted',
        '.upgrade-button-container',
        'button.upsell-button',
        '.upgrade-text-container',
        'div.safety-disclaimer-container-for-medical.ng-star-inserted',
        // New selectors to nuke the "Päivitä Google AI Pro -tilaukseen" button
        'upsell-button',
	'#chat-history > infinite-scroller > zs-advanced-upsell > div > div',
        '[data-test-id="upsell-button"]',
        '[data-test-id="bard-upsell-menu-button"]'
    ];

    // NEW: Snapchat Camera selector to expand to fill available space (not full screen)
    const snapchatCameraSelector = '.G3Z4U.Xg7U0';

    // NEW: Snapchat Minimize Button selector (to auto-click for collapsing spotlight)
    const snapchatMinimizeButtonSelector = 'button.Rknx9';  

    // === NEXTDNS IMPORT/EXPORT SYSTEM ===
    const NextDNSManager = {
        isListPage: function() {
            const url = window.location.href;
            return url.includes('my.nextdns.io') && (url.includes('/denylist') || url.includes('/allowlist'));
        },

        isLogsPage: function() {
            const url = window.location.href;
            return url.includes('my.nextdns.io') && url.includes('/logs');
        },

        isTargetPage: function() {
            return this.isListPage() || this.isLogsPage();
        },
        
        setupInterceptors: function() {
            // Only set this up once
            if (this._interceptorsSetup) return;
            this._interceptorsSetup = true;

            // Capture phase click listener to intercept React events before they happen
            document.addEventListener('click', (e) => {
                if (!this.isTargetPage()) return;
                
                // Find if the click originated from or inside the X button
                const btn = e.target.closest('button.btn-link');
                if (btn && btn.querySelector('svg[data-icon="xmark"]')) {
                    
                    // If we already confirmed it, let the click pass through to React
                    if (btn.dataset.bravefoxConfirmed === 'true') {
                        delete btn.dataset.bravefoxConfirmed;
                        return;
                    }
                    
                    // Stop React from seeing this click
                    e.preventDefault();
                    e.stopPropagation();

                    // Find the domain name for the confirmation prompt
                    const listItem = btn.closest('.list-group-item');
                    let domain = "this domain";
                    if (listItem) {
                        const span = listItem.querySelector('span.notranslate');
                        if (span) domain = span.textContent.replace(/^\*\./, '').trim();
                    }

                    // Prompt user
                    if (confirm(`BraveFox:\nAre you sure you want to delete: ${domain}?`)) {
                        // Mark as confirmed and programmatically click it to trigger React's native handler
                        btn.dataset.bravefoxConfirmed = 'true';
                        btn.click();
                    }
                }
            }, true); // TRUE = Capture phase! Extremely important for bypassing React.
            
            console.log('BraveFox: NextDNS Delete interceptor active.');
        },

        exportList: function() {
            try {
                const items = document.querySelectorAll('.list-group-item span.notranslate');
                const domains = [];
                
                items.forEach(item => {
                    let text = item.textContent || '';
                    // Clean up NextDNS formatting like "*.domain.com"
                    text = text.replace(/^\*\./, '').trim();
                    if (text) domains.push(text);
                });
                
                if (domains.length === 0) {
                    alert('BraveFox: No domains found to export!');
                    return;
                }
                
                const listType = window.location.href.includes('denylist') ? 'denylist' : 'allowlist';
                const blob = new Blob([domains.join('\n')], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `nextdns_${listType}_export.txt`;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                console.log(`BraveFox: Successfully exported ${domains.length} domains from ${listType}.`);
            } catch (err) {
                console.error('BraveFox: Error exporting list:', err);
            }
        },

        exportLogs: function() {
            try {
                // Collect domains specifically from the logs stream
                const items = document.querySelectorAll('.list-group-item span.notranslate, div span.notranslate');
                const domains = new Set(); // Use Set to automatically remove duplicates
                
                items.forEach(item => {
                    let text = item.textContent || '';
                    text = text.replace(/^\*\./, '').trim();
                    
                    // Basic validation to ensure it's a domain (has a dot, no spaces)
                    if (text && text.includes('.') && !text.includes(' ')) {
                        domains.add(text);
                    }
                });
                
                if (domains.size === 0) {
                    alert('BraveFox: No domains found to export! (Make sure the logs are loaded on screen)');
                    return;
                }
                
                const blob = new Blob([Array.from(domains).join('\n')], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `nextdns_logs_export.txt`;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                console.log(`BraveFox: Successfully exported ${domains.size} unique domains from logs.`);
            } catch (err) {
                console.error('BraveFox: Error exporting logs:', err);
            }
        },
        
        importList: async function(file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                const domains = text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !line.startsWith('#')); // Ignore empties and comments
                    
                if (domains.length === 0) {
                    alert('BraveFox: No valid domains found in file.');
                    return;
                }
                
                if (!confirm(`BraveFox is about to import ${domains.length} domains. Please don't touch the page until it finishes. Proceed?`)) return;

                const form = document.querySelector('form[action="#submit"]');
                const input = form ? form.querySelector('input') : null;
                
                if (!form || !input) {
                    alert('BraveFox: Could not find the input form! Make sure you are on the Denylist/Allowlist page.');
                    return;
                }

                // Get React native setter to bypass synthetic events proxy
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

                let successCount = 0;
                
                for (let i = 0; i < domains.length; i++) {
                    const domain = domains[i];
                    try {
                        // 1. Focus the input box
                        input.focus();

                        // 2. Add URL directly via native setter
                        nativeInputValueSetter.call(input, domain);
                        
                        // Dispatch input/change events for React to register the value
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // 3. Short wait to let React internally register the state change
                        await new Promise(r => setTimeout(r, 100));
                        
                        // 4. Simulate the enter press
                        const enterEventOpts = {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        };
                        input.dispatchEvent(new KeyboardEvent('keydown', enterEventOpts));
                        input.dispatchEvent(new KeyboardEvent('keypress', enterEventOpts));
                        input.dispatchEvent(new KeyboardEvent('keyup', enterEventOpts));
                        
                        // Hard dispatch the form submission as a final fallback
                        if (typeof form.requestSubmit === 'function') {
                            form.requestSubmit();
                        } else {
                            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                        }

                        // Blur input
                        input.blur();
                        
                        successCount++;
                        console.log(`BraveFox: Imported ${successCount}/${domains.length}: ${domain}`);
                        
                        // 5. Long wait to let the server respond and React clear the input field
                        await new Promise(r => setTimeout(r, 600));
                    } catch (err) {
                        console.error(`BraveFox: Failed to import domain ${domain}:`, err);
                    }
                }
                
                alert(`BraveFox: Successfully imported ${successCount} domains!`);
            };
            reader.readAsText(file);
        },

        injectUI: function() {
            if (!this.isTargetPage()) return;
            
            // Ensure interceptors are active
            this.setupInterceptors();
            
            // Check if we already injected
            if (document.getElementById('bravefox-nextdns-tools')) return;
            
            if (this.isListPage()) {
                // Find the form container. We are targeting the div.card-header that wraps it.
                const form = document.querySelector('form[action="#submit"]');
                if (!form) return;
                
                const cardHeader = form.closest('.card-header');
                if (!cardHeader) return;

                // Create tools container
                const container = document.createElement('div');
                container.id = 'bravefox-nextdns-tools';
                container.style.display = 'flex';
                container.style.gap = '10px';
                container.style.marginTop = '12px';
                container.style.paddingTop = '12px';
                container.style.borderTop = '1px solid rgba(0,0,0,0.05)';
                container.style.justifyContent = 'flex-start';

                // Create Export Button
                const btnExport = document.createElement('button');
                btnExport.textContent = '📥 Export List';
                btnExport.className = 'btn btn-light btn-sm';
                btnExport.style.backgroundColor = '#f8f9fa';
                btnExport.style.border = '1px solid #ddd';
                btnExport.style.borderRadius = '6px';
                btnExport.style.padding = '4px 10px';
                btnExport.style.cursor = 'pointer';
                btnExport.style.fontWeight = '500';
                btnExport.style.color = '#333';
                
                btnExport.addEventListener('mouseenter', () => btnExport.style.backgroundColor = '#e2e6ea');
                btnExport.addEventListener('mouseleave', () => btnExport.style.backgroundColor = '#f8f9fa');
                btnExport.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.exportList();
                });

                // Create Import wrapper (hidden file input + button)
                const importWrapper = document.createElement('div');
                importWrapper.style.position = 'relative';
                
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.txt';
                fileInput.style.display = 'none';
                
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        this.importList(e.target.files[0]);
                        e.target.value = ''; // Reset input
                    }
                });

                const btnImport = document.createElement('button');
                btnImport.textContent = '📤 Import List';
                btnImport.className = 'btn btn-light btn-sm';
                btnImport.style.backgroundColor = '#f8f9fa';
                btnImport.style.border = '1px solid #ddd';
                btnImport.style.borderRadius = '6px';
                btnImport.style.padding = '4px 10px';
                btnImport.style.cursor = 'pointer';
                btnImport.style.fontWeight = '500';
                btnImport.style.color = '#333';

                btnImport.addEventListener('mouseenter', () => btnImport.style.backgroundColor = '#e2e6ea');
                btnImport.addEventListener('mouseleave', () => btnImport.style.backgroundColor = '#f8f9fa');
                btnImport.addEventListener('click', (e) => {
                    e.preventDefault();
                    fileInput.click();
                });

                importWrapper.appendChild(fileInput);
                importWrapper.appendChild(btnImport);

                container.appendChild(btnExport);
                container.appendChild(importWrapper);

                // Safely append directly into the card header
                cardHeader.appendChild(container);
                console.log('BraveFox: Injected NextDNS Import/Export tools');
                
            } else if (this.isLogsPage()) {
                // Target the header wrapper that contains the search bar for the Logs page
                const searchInput = document.querySelector('input.form-control');
                const cardHeader = searchInput ? searchInput.closest('.card-header') : document.querySelector('.card-header');
                
                if (!cardHeader) return;

                const container = document.createElement('div');
                container.id = 'bravefox-nextdns-tools';
                container.style.display = 'flex';
                container.style.gap = '10px';
                container.style.marginTop = '12px';
                container.style.paddingTop = '12px';
                container.style.borderTop = '1px solid rgba(0,0,0,0.05)';
                container.style.justifyContent = 'flex-start';

                const btnExportLogs = document.createElement('button');
                btnExportLogs.textContent = '📥 Export Logs (Visible)';
                btnExportLogs.className = 'btn btn-light btn-sm';
                btnExportLogs.style.backgroundColor = '#f8f9fa';
                btnExportLogs.style.border = '1px solid #ddd';
                btnExportLogs.style.borderRadius = '6px';
                btnExportLogs.style.padding = '4px 10px';
                btnExportLogs.style.cursor = 'pointer';
                btnExportLogs.style.fontWeight = '500';
                btnExportLogs.style.color = '#333';
                
                btnExportLogs.addEventListener('mouseenter', () => btnExportLogs.style.backgroundColor = '#e2e6ea');
                btnExportLogs.addEventListener('mouseleave', () => btnExportLogs.style.backgroundColor = '#f8f9fa');
                btnExportLogs.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.exportLogs();
                });
                
                container.appendChild(btnExportLogs);
                cardHeader.appendChild(container);
                console.log('BraveFox: Injected NextDNS Logs tools');
            }
        }
    };

    let currentURL = window.location.href;
    let kuvakeRedirected = false;
    const hiddenElements = new WeakSet();
    let githubRedirected = false;

    // Tracker for Gemini 3-dot menus
    function trackGeminiMenuTrigger(e) {
        try {
            if (!window.location.hostname.includes('gemini.google.com')) return;
            
            const trigger = e.target.closest('button');
            if (!trigger) return;

            // Ensure we are actually clicking the 3-dot actions menu
            const isActionsMenu = trigger.getAttribute('data-test-id')?.includes('actions-menu') || 
                                  trigger.classList.contains('conversation-actions-menu-button');
            if (!isActionsMenu) return;

            let isGem = false;

            // Method 1: Check the physical link sitting next to the button in the sidebar
            const container = trigger.closest('.conversation-items-container, .nav-item, mat-list-item, .ng-star-inserted');
            if (container) {
                const link = container.querySelector('a[href]');
                if (link) {
                    const href = link.getAttribute('href') || '';
                    if (href.includes('/g/') || href.includes('/gem')) {
                        isGem = true;
                    } else if (href.includes('/app/')) {
                        isGem = false;
                    }
                }
            }

            // Method 2: Fallback DOM climbing for headers
            if (!isGem) {
                let ancestor = trigger.parentElement;
                while(ancestor && ancestor !== document.body) {
                    let label = (ancestor.getAttribute('aria-label') || '').toLowerCase();
                    if (label.includes('gemit') || label.includes('gems')) {
                        isGem = true; break;
                    }
                    if (label.includes('keskustelut') || label.includes('chats') || label.includes('recent')) {
                        isGem = false; break;
                    }
                    
                    let prev = ancestor.previousElementSibling;
                    if (prev && prev.textContent) {
                        let text = prev.textContent.toLowerCase();
                        if (text.includes('gemit') || text.includes('gems')) {
                            isGem = true; break;
                        }
                        if (text.includes('keskustelut') || text.includes('chat') || text.includes('recent')) {
                            isGem = false; break;
                        }
                    }
                    ancestor = ancestor.parentElement;
                }
            }
            
            lastClickedWasGem = isGem;

            // Instantly apply or remove the "No Glimpse" CSS class on the HTML tag
            if (isGem) {
                document.documentElement.classList.add('gemini-gem-menu-active');
            } else {
                document.documentElement.classList.remove('gemini-gem-menu-active');
            }

        } catch(err) {}
    }

    onEvent(document, 'mousedown', trackGeminiMenuTrigger, true);
    onEvent(document, 'keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') trackGeminiMenuTrigger(e);
    }, true);

    // Helper: remove image/network loads from a container (best-effort)
    function stripImagesWithin(el) {
        try {
            el.querySelectorAll('img, source, video').forEach(node => {
                if (node.tagName === 'IMG') {
                    node.removeAttribute('srcset');
                    node.removeAttribute('src');
                    node.loading = 'lazy';
                    node.decoding = 'async';
                    node.style.setProperty('display', 'none', 'important');
                    node.style.setProperty('visibility', 'hidden', 'important');
                } else if (node.tagName === 'SOURCE') {
                    node.removeAttribute('srcset');
                    node.removeAttribute('src');
                } else if (node.tagName === 'VIDEO') {
                    node.pause?.();
                    node.removeAttribute('src');
                    node.removeAttribute('poster');
                }
            });
        } catch {}
    }

    // Helper: Check if an element is protected (should never be hidden/deleted)
    function isElementProtected(element) {
        try {
            return snapchatProtectedSelectors.some(selector => element.matches && element.matches(selector));
        } catch {
            return false;
        }
    }

    // Inject CSS for IRC Galleria immediate hiding, Snapchat unwanted elements, and Gemini
    const injectInlineCSS = () => {
        try {
            const styleId = 'extra-redirect-style';
            let style = document.getElementById(styleId);
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
            }
            const ircGalleriaCSS = currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4') ? 
                ircGalleriaSelectorsToHide.map(selector => `${selector}`).join(',\n') + ' {' +
                    'display: none !important;' +
                    'visibility: hidden !important;' +
                    'opacity: 0 !important;' +
                    'height: 0 !important;' +
                    'width: 0 !important;' +
                    'max-height: 0 !important;' +
                    'max-width: 0 !important;' +
                    'overflow: hidden !important;' +
                    'position: absolute !important;' +
                    'left: -9999px !important;' +
                    'top: -9999px !important;' +
                    'margin: 0 !important;' +
                    'padding: 0 !important;' +
                    'border: none !important;' +
                    'transition: none !important;' +
                '}' : '';

            const snapchatUnwantedCSS = window.location.hostname.includes('snapchat.com') ? 
                snapchatUnwantedSelectors.map(selector => `${selector}`).join(',\n') + ' {' +
                    'display: none !important;' +
                    'visibility: hidden !important;' +
                    'opacity: 0 !important;' +
                    'height: 0 !important;' +
                    'width: 0 !important;' +
                    'max-height: 0 !important;' +
                    'max-width: 0 !important;' +
                    'overflow: hidden !important;' +
                    'position: absolute !important;' +
                    'left: -9999px !important;' +
                    'top: -9999px !important;' +
                    'margin: 0 !important;' +
                    'padding: 0 !important;' +
                    'border: none !important;' +
                    'transition: none !important;' +
                '}' : '';

            const geminiUnwantedCSS = window.location.hostname.includes('gemini.google.com') ? 
                geminiUnwantedSelectors.map(selector => `${selector}`).join(',\n') + ' {' +
                    'display: none !important;' +
                    'visibility: hidden !important;' +
                    'opacity: 0 !important;' +
                    'height: 0 !important;' +
                    'width: 0 !important;' +
                    'max-height: 0 !important;' +
                    'max-width: 0 !important;' +
                    'overflow: hidden !important;' +
                    'position: absolute !important;' +
                    'left: -9999px !important;' +
                    'top: -9999px !important;' +
                    'margin: 0 !important;' +
                    'padding: 0 !important;' +
                    'border: none !important;' +
                    'transition: none !important;' +
                    'pointer-events: none !important;' +
                '}' : '';

            // The NO GLIMPSE fix for the "Poista" button specifically on Gems.
            // When html has gemini-gem-menu-active, CSS will instantly hide the button before painting.
            const geminiGemMenuCSS = window.location.hostname.includes('gemini.google.com') ? `
                html.gemini-gem-menu-active .cdk-overlay-container button[data-test-id*="delete"],
                html.gemini-gem-menu-active .cdk-overlay-container [mat-menu-item][data-test-id*="delete"],
                html.gemini-gem-menu-active .cdk-overlay-container [aria-label*="Poista" i],
                html.gemini-gem-menu-active .cdk-overlay-container [aria-label*="Delete" i] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    position: absolute !important;
                    pointer-events: none !important;
                    height: 0 !important;
                    width: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
            ` : '';

            style.textContent = `
            /* IRC Galleria pre-hide CSS for immediate thumbnail deletion */
            ${ircGalleriaCSS}
            /* Snapchat unwanted elements pre-hide CSS (e.g., Spotlight button) */
            ${snapchatUnwantedCSS}
            /* Gemini unwanted elements pre-hide CSS */
            ${geminiUnwantedCSS}
            /* Gemini No-Glimpse Gem Delete Button CSS */
            ${geminiGemMenuCSS}
            `;
            
            if (!style.isConnected) {
                if (document.head) {
                    document.head.appendChild(style);
                } else if (document.documentElement) {
                    document.documentElement.insertBefore(style, document.documentElement.firstChild);
                }
            }
        } catch {}
    };

    function collapseElement(element) {
        if (!hiddenElements.has(element)) {
            stripImagesWithin(element);
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('max-height', '0', 'important');
            element.style.setProperty('height', '0', 'important');
            element.style.setProperty('min-height', '0', 'important');
            element.style.setProperty('overflow', 'hidden', 'important');
            element.style.setProperty('padding', '0', 'important');
            element.style.setProperty('margin', '0', 'important');
            element.style.setProperty('border', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('flex', '0 0 0px', 'important');
            element.style.setProperty('grid', 'none', 'important');
            element.style.setProperty('transition', 'none', 'important');
            element.style.setProperty('opacity', '0', 'important');
            element.style.setProperty('position', 'absolute', 'important');
            element.style.setProperty('left', '-9999px', 'important');
            element.style.setProperty('top', '-9999px', 'important');
            hiddenElements.add(element);
        }
    }

    function handleIRCGalleriaThumbDeletion() {
        if (!currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) return;
        ircGalleriaSelectorsToHide.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!hiddenElements.has(element)) {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('visibility', 'hidden', 'important');
                    element.style.setProperty('opacity', '0', 'important');
                    element.style.setProperty('height', '0', 'important');
                    element.style.setProperty('width', '0', 'important');
                    element.style.setProperty('max-height', '0', 'important');
                    element.style.setProperty('max-width', '0', 'important');
                    element.style.setProperty('position', 'absolute', 'important');
                    element.style.setProperty('left', '-9999px', 'important');
                    element.style.setProperty('top', '-9999px', 'important');
                    element.style.setProperty('overflow', 'hidden', 'important');
                    element.style.setProperty('margin', '0', 'important');
                    element.style.setProperty('padding', '0', 'important');
                    element.style.setProperty('border', 'none', 'important');
                    element.style.setProperty('transition', 'none', 'important');
                    hiddenElements.add(element);
                    try {
                        element.remove();
                    } catch (e) {
                        try {
                            while (element.firstChild) element.removeChild(element.firstChild);
                        } catch {}
                    }
                }
            });
        });
    }

    function handleSnapchatUnwantedHiding() {
        if (!window.location.hostname.includes('snapchat.com')) return;
        snapchatUnwantedSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!hiddenElements.has(element) && !isElementProtected(element)) {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('visibility', 'hidden', 'important');
                    element.style.setProperty('opacity', '0', 'important');
                    element.style.setProperty('height', '0', 'important');
                    element.style.setProperty('width', '0', 'important');
                    element.style.setProperty('max-height', '0', 'important');
                    element.style.setProperty('max-width', '0', 'important');
                    element.style.setProperty('position', 'absolute', 'important');
                    element.style.setProperty('left', '-9999px', 'important');
                    element.style.setProperty('top', '-9999px', 'important');
                    element.style.setProperty('overflow', 'hidden', 'important');
                    element.style.setProperty('margin', '0', 'important');
                    element.style.setProperty('padding', '0', 'important');
                    element.style.setProperty('border', 'none', 'important');
                    element.style.setProperty('transition', 'none', 'important');
                    hiddenElements.add(element);
                    try {
                        element.remove();
                    } catch (e) {
                        try {
                            while (element.firstChild) element.removeChild(element.firstChild);
                        } catch {}
                    }
                }
            });
        });
    }

    function handleGeminiUnwantedHiding() {
        if (!window.location.hostname.includes('gemini.google.com')) return;
        
        // Hide standard unwanted promos / UI elements
        geminiUnwantedSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!hiddenElements.has(element)) {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('visibility', 'hidden', 'important');
                    element.style.setProperty('opacity', '0', 'important');
                    element.style.setProperty('height', '0', 'important');
                    element.style.setProperty('width', '0', 'important');
                    element.style.setProperty('max-height', '0', 'important');
                    element.style.setProperty('max-width', '0', 'important');
                    element.style.setProperty('position', 'absolute', 'important');
                    element.style.setProperty('left', '-9999px', 'important');
                    element.style.setProperty('top', '-9999px', 'important');
                    element.style.setProperty('overflow', 'hidden', 'important');
                    element.style.setProperty('margin', '0', 'important');
                    element.style.setProperty('padding', '0', 'important');
                    element.style.setProperty('border', 'none', 'important');
                    element.style.setProperty('transition', 'none', 'important');
                    element.style.setProperty('pointer-events', 'none', 'important');
                    hiddenElements.add(element);
                    try { element.remove(); } catch (e) {
                        try { while (element.firstChild) element.removeChild(element.firstChild); } catch {}
                    }
                }
            });
        });

        // Context-aware logic for the "Poista" (Delete) button inside the teleported Angular menu.
        // Even with the dynamic CSS handling the glimpse, we keep this as a JavaScript safety net to cleanup elements.
        document.querySelectorAll('button[data-test-id="delete-button"], button[data-test-id="delete-gem-button"], [mat-menu-item]').forEach(element => {
            
            // Check if this specific element is actually the delete/poista button
            let isDeleteBtn = false;
            const testId = element.getAttribute('data-test-id') || '';
            if (testId.includes('delete')) {
                isDeleteBtn = true;
            } else if (element.hasAttribute('mat-menu-item')) {
                const txt = (element.textContent || '').toLowerCase().trim();
                if (txt === 'poista' || txt === 'delete' || txt.includes('poista') || txt.includes('delete')) {
                    isDeleteBtn = true;
                }
            }

            if (isDeleteBtn) {
                if (lastClickedWasGem) {
                    // It's a Gem, hide the delete button permanently
                    if (!hiddenElements.has(element)) {
                        element.style.setProperty('display', 'none', 'important');
                        element.style.setProperty('visibility', 'hidden', 'important');
                        element.style.setProperty('opacity', '0', 'important');
                        element.style.setProperty('pointer-events', 'none', 'important');
                        element.style.setProperty('height', '0', 'important');
                        hiddenElements.add(element);
                    }
                } else {
                    // It's a Chat! Because Angular re-uses DOM elements, we MUST remove the hiding styles
                    // if it was previously hidden during a Gem click.
                    if (hiddenElements.has(element) || element.style.display === 'none') {
                        element.style.removeProperty('display');
                        element.style.removeProperty('visibility');
                        element.style.removeProperty('opacity');
                        element.style.removeProperty('pointer-events');
                        element.style.removeProperty('height');
                        hiddenElements.delete(element);
                    }
                }
            }
        });
    }

    function handleSnapchatSpotlightAutoMinimize() {
        if (!window.location.hostname.includes('snapchat.com')) return;
        const tryMinimize = () => {
            try {
                const minimizeButton = document.querySelector(snapchatMinimizeButtonSelector);
                if (minimizeButton && !hiddenElements.has(minimizeButton)) {
                    minimizeButton.click();
                    console.log('Auto-minimized Snapchat spotlight immediately.');
                } else {
                    addTimeout(tryMinimize, 50);
                }
            } catch (e) {
                console.warn('Failed to auto-minimize Snapchat spotlight:', e);
            }
        };
        tryMinimize();
        onEvent(document, 'DOMContentLoaded', tryMinimize, false);
    }

    function handleSnapchatCameraExpansion() {
        if (!window.location.hostname.includes('snapchat.com')) return;
        const cameraElement = document.querySelector(snapchatCameraSelector);
        if (cameraElement && !hiddenElements.has(cameraElement)) {
            cameraElement.style.setProperty('width', '100%', 'important');
            cameraElement.style.setProperty('height', '100%', 'important');
            cameraElement.style.setProperty('margin', '0', 'important');
            cameraElement.style.setProperty('padding', '0', 'important');
            cameraElement.style.setProperty('border', 'none', 'important');
            cameraElement.style.setProperty('transition', 'none', 'important');
            cameraElement.querySelectorAll('img').forEach(img => {
                img.style.setProperty('width', '100%', 'important');
                img.style.setProperty('height', '100%', 'important');
                img.style.setProperty('object-fit', 'cover', 'important');
            });
        }
    }

    function handleIrcGalleriaRedirect2() {
        const url = window.location.href.toLowerCase();
        if (url === 'https://irc-galleria.net/user/irpp4' || url === 'https://irc-galleria.net/user/irpp4/') {
            fastRedirect('https://irc-galleria.net/user/Irpp4/blogs');
            return true;
        }
        return false;
    }

    function blankOutPage() {
        try {
            let s = document.getElementById('extra-blank-style');
            if (!s) {
                s = document.createElement('style');
                s.id = 'extra-blank-style';
                s.textContent = `
                    html, body { background: #fff !important; }
                    body > * { display: none !important; visibility: hidden !important; }
                `;
                (document.head || document.documentElement).appendChild(s);
            }
            document.documentElement.style.background = '#fff';
            if (document.body) document.body.style.background = '#fff';
        } catch {}
    }

    function fastRedirect(target) {
        if (__isRedirectingFast) return;
        __isRedirectingFast = true;
        try { if (typeof window.stop === "function") window.stop(); } catch {}
        blankOutPage();
        try { window.location.replace(target); return; } catch(e) {}
        try { window.location.assign(target); return; } catch(e) {}
        try { window.location.href = target; } catch(e) {}
    }

    function handleGitHubRedirect() {
        if (githubRedirected) return;
        const currentURL = window.location.href;

        const blockedUsers = [
            'HorizonMW',
        ];

        const blockedRepos = [
            'HorizonMW-Client',
        ];

        const blockedPatterns = [
            /github\.com\/best-deepnude-ai-apps/i,
            /github\.com\/AI-Reviewed\/tools\/blob\/main\/Nude%20AI%20:%205%20Best%20AI%20Nude%20Generators%20-%20AIReviewed\.md/i,
            /github\.com\/nudify-ai/i,
            /github\.com\/Top-AI-Apps/i,
            /github\.com\/HorizonMW\/HorizonMW-Client/i,
            /github\.com\/HorizonMW\/[^\/]+/i,
            /github\.com\/Top-AI-Apps\/Review\/blob\/main\/Top%205%20DeepNude%20AI%3A%20Free%20%26%20Paid%20Apps%20for%20Jan%202025%20-%20topai\.md/i,
            /github\.com\/comfyanonymous/i,
        ];

        const userPattern = blockedUsers.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const isProfileRoot = new RegExp(`^https://github\\.com/(${userPattern})/?$`).test(currentURL);
        const repoMatch = currentURL.match(new RegExp(`^https://github\\.com/(${userPattern})/([^/#?]+)`));
        const matchesBlockedPattern = blockedPatterns.some(pattern => pattern.test(currentURL));

        if (isProfileRoot || matchesBlockedPattern) {
            githubRedirected = true;
            fastRedirect('https://github.com');
            return;
        }
        if (repoMatch && blockedRepos.includes(repoMatch[2])) {
            githubRedirected = true;
            fastRedirect('https://github.com');
            return;
        }
    }

    function preflightEarlyRedirect() {
        try {
            const hrefLower = location.href.toLowerCase();
            const hostLower = location.hostname.toLowerCase();

            if (hostLower.includes('irc-galleria.net') && hrefLower.includes('/user/irpp4')) {
                for (let i = 0; i < ircGalleriaBannedPatterns.length; i++) {
                    if (hrefLower.includes(ircGalleriaBannedPatterns[i].toLowerCase())) {
                        fastRedirect('https://irc-galleria.net');
                        return true;
                    }
                }
                if (hrefLower === 'https://irc-galleria.net/user/irpp4' || hrefLower === 'https://irc-galleria.net/user/irpp4/') {
                    fastRedirect('https://irc-galleria.net/user/Irpp4/blogs');
                    return true;
                }
            }
            if (hrefLower.includes('@karabrannbacka')) {
                fastRedirect('https://www.tiktok.com');
                return true;
            }
        } catch {}
        return false;
    }

    if (preflightEarlyRedirect()) {
        return;
    }

    injectInlineCSS();

    function handleRedirectionsAndContentHiding() {
        if (__isRedirectingFast) return;
        currentURL = window.location.href;

        if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
            for (let pattern of ircGalleriaBannedPatterns) {
                if (currentURL.toLowerCase().includes(pattern.toLowerCase())) {
                    fastRedirect('https://irc-galleria.net');
                    return;
                }
            }
            if (handleIrcGalleriaRedirect2()) return;
        }

        handleIRCGalleriaThumbDeletion();
        handleSnapchatUnwantedHiding();  
        handleGeminiUnwantedHiding();    
        handleSnapchatSpotlightAutoMinimize();  
        handleSnapchatCameraExpansion();  

        if (currentURL.includes('github.com')) {
            handleGitHubRedirect();
        }

        if (window.location.hostname.includes('kuvake.net')) {
            var kuvakeRedirectUsers = [
                "iräö", "iraö", "ira", "irpp4",
                "m1mmuska", "just.se.mimmi", "mimmuska", "mimmusk4", "m1mmusk4"
            ];
            var pathname = window.location.pathname;
            var decodedPath = decodeURIComponent(pathname).toLowerCase();
            for (var i = 0; i < kuvakeRedirectUsers.length; ++i) {
                var u = kuvakeRedirectUsers[i];
                if (
                    decodedPath === '/user/' + u ||
                    pathname.toLowerCase() === '/user/' + u
                ) {
                    if (!kuvakeRedirected) {
                        kuvakeRedirected = true;
                        fastRedirect('https://kuvake.net');
                    }
                    return;
                }
            }
        }

        if (currentURL.includes('@karabrannbacka')) {
            try { window.stop(); } catch {}
            fastRedirect('https://www.tiktok.com');
            return;
        }
    }

    let observerScheduled = false;
    function observerCallback(mutationsList) {
        if (observerScheduled) return;
        observerScheduled = true;
        addTimeout(() => {
            observerScheduled = false;
            handleIRCGalleriaThumbDeletion();
            handleGeminiUnwantedHiding();
            
            // Re-check and inject NextDNS UI if React dynamically loaded the form
            if (NextDNSManager.isTargetPage()) {
                NextDNSManager.injectUI();
            }
        }, 80);
    }

    function initObserver() {
        if (__isRedirectingFast) return;
        const observer = trackObserver(new MutationObserver(observerCallback));
        function startObserve() {
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                onEvent(document, 'DOMContentLoaded', () => {
                    observer.observe(document.body, { childList: true, subtree: true });
                }, false);
            }
        }
        startObserve();
    }

    function mainHandler() {
        if (__isRedirectingFast) return;
        handleRedirectionsAndContentHiding();
        if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
            handleIRCGalleriaThumbDeletion();
        }
        
        // Inject NextDNS tools
        if (NextDNSManager.isTargetPage()) {
            NextDNSManager.injectUI();
        }
    }

    mainHandler();
    initObserver();

    function scheduleIntervals() {
        addInterval(() => {
            if (!document.hidden && !__isRedirectingFast) {
                mainHandler();
                if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
                    handleIRCGalleriaThumbDeletion();
                }
            }
        }, 120);
    }
    startIntervals(scheduleIntervals);

    onEvent(document, 'visibilitychange', () => {
        if (document.hidden) {
            stopIntervals();
        } else {
            startIntervals(scheduleIntervals);
            mainHandler();
        }
    }, false);

    (function() {
        var _wr = function(type) {
            var orig = history[type];
            return function() {
                var rv = orig.apply(this, arguments);
                window.dispatchEvent(new Event(type));
                return rv;
            };
        };
        history.pushState = _wr('pushState');
        history.replaceState = _wr('replaceState');
        onEvent(window, 'popstate', function() {
            window.dispatchEvent(new Event('locationchange'));
        }, false);
    })();

    onEvent(window, 'locationchange', function() {
        if (__isRedirectingFast) return;
        currentURL = window.location.href;
        injectInlineCSS();
        mainHandler();
        if (currentURL.toLowerCase().includes('irc-galleria.net/user/irpp4')) {
            handleIRCGalleriaThumbDeletion();
        }
    }, false);

    onEvent(window, 'pagehide', cleanup, false);
    onEvent(window, 'beforeunload', cleanup, false);

})();