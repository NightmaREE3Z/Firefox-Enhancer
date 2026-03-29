// BraveFox Enhancer - BlockSite Word Import/Export Assembly Line & UI Control Center

(function() {
    'use strict';

    console.log('BraveFox: Word Import/Export Assembly Line initialized.');

    // Global variable to track the currently selected batch size
    let currentBatchSize = 10;

    // --- HELPER UTILITIES ---
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Smart Waiter: Waits for an element to appear in the DOM
    async function waitForElement(selector, timeout = 15000) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`BraveFox: Timeout waiting for ${selector}`));
            }, timeout);
        });
    }

    // Smart Waiter: Waits for an element to be completely removed from the DOM
    async function waitForElementToDisappear(selector, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (!document.querySelector(selector)) {
                return resolve();
            }

            const observer = new MutationObserver(() => {
                if (!document.querySelector(selector)) {
                    observer.disconnect();
                    resolve();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`BraveFox: Timeout waiting for ${selector} to close`));
            }, timeout);
        });
    }

    // Smart Waiter: Hyper-specific observer to snipe the React dropdown item
    async function waitForDropdownItem(word, timeout = 3000) {
        return new Promise((resolve) => {
            const exactSelector = `[data-automation="item-${word}"]`;
            
            if (document.querySelector(exactSelector)) {
                return resolve(document.querySelector(exactSelector));
            }

            const checkText = () => {
                const allItemTexts = document.querySelectorAll('[data-automation="item"]');
                for (let el of allItemTexts) {
                    if (el.textContent && el.textContent.trim().toLowerCase() === word.toLowerCase()) {
                        return el.closest('[data-automation^="item-"]');
                    }
                }
                return null;
            };

            let found = checkText();
            if (found) return resolve(found);

            const observer = new MutationObserver(() => {
                let el = document.querySelector(exactSelector) || checkText();
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true, characterData: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    // --- THE EXPORT HEIST ---
    function exportWords() {
        console.log('BraveFox: Initiating Word Export...');
        const wordElements = document.querySelectorAll('[data-automation="item"]');
        
        if (wordElements.length === 0) {
            alert('BraveFox: No blocked terms found on screen to export!');
            return;
        }

        let wordsList = [];
        wordElements.forEach(el => {
            if (el.textContent && el.textContent.trim() !== '') {
                wordsList.push(el.textContent.trim());
            }
        });

        const blob = new Blob([wordsList.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'BraveFox-Blocksite-Terms.csv';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
        
        console.log(`BraveFox: Successfully exported ${wordsList.length} terms.`);
    }

    // --- THE BATCH PROCESSOR (ASSEMBLY LINE) ---
    async function processInBatches(words, batchSize = 10) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        let currentIndex = 0;

        while (currentIndex < words.length) {
            const currentBatch = words.slice(currentIndex, currentIndex + batchSize);
            console.log(`\nBraveFox: Starting batch ${currentIndex + 1} to ${currentIndex + currentBatch.length} of ${words.length}...`);

            try {
                // Step 1: Open the modal
                const addItemsBtn = await waitForElement('[data-automation="add-items-button"]');
                console.log('BraveFox: Opening modal...');
                addItemsBtn.click();

                // Step 2: Wait for search input
                const targetInput = await waitForElement('[data-automation="add-items-search-input"]');

                // Step 3: Find and click the "Avainsanat" (Keywords) tab instantly
                const tabs = document.querySelectorAll('button[data-automation="tab"]');
                for (let tab of tabs) {
                    if (tab.textContent.trim().toLowerCase().includes('avainsanat') || tab.textContent.trim().toLowerCase().includes('keyword')) {
                        tab.click();
                        console.log('BraveFox: Switched to Keywords tab.');
                        break;
                    }
                }

                // Step 4: Inject words for this specific batch
                for (let i = 0; i < currentBatch.length; i++) {
                    const word = currentBatch[i];
                    
                    nativeInputValueSetter.call(targetInput, word);
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));

                    let listItem = await waitForDropdownItem(word);

                    if (listItem) {
                        listItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        listItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        listItem.click();
                    }

                    targetInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    targetInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

                    console.log(`BraveFox: Injected -> ${word}`);

                    // Required 1500ms cooldown
                    await sleep(1500); 
                }

                // Step 5: Save the batch
                console.log('BraveFox: Batch injected. Saving...');
                const doneBtn = document.querySelector('[data-automation="add-items-done-btn"]');
                if (doneBtn) {
                    doneBtn.click();
                } else {
                    console.error('BraveFox: Could not find TEHTY button!');
                    alert('BraveFox: Fatal Error. Could not find the save button. Stopping script.');
                    return;
                }

                // Step 6: Smart transition
                console.log('BraveFox: Waiting for modal to close...');
                await waitForElementToDisappear('[data-automation="add-items-search-input"]');
                await waitForElement('[data-automation="add-items-button"]');
                
                currentIndex += batchSize;

            } catch (error) {
                console.error('BraveFox: Batch process error:', error);
                alert('BraveFox: The assembly line hit a snag. Check the console.');
                return;
            }
        }

        alert(`BraveFox: Assembly line finished! Successfully imported all ${words.length} terms.`);
    }

    // --- THE FILE HANDLER ---
    async function handleFileUpload(file) {
        if (!file) return;

        const text = await file.text();
        let words = text.split(/[\r\n,]+/).map(w => w.replace(/^"|"$/g, '').trim()).filter(w => w.length > 0);
        words = [...new Set(words)]; 

        if (words.length === 0) {
            alert('BraveFox: The file was empty or unreadable!');
            return;
        }

        console.log(`BraveFox: Preparing to batch import ${words.length} terms using a batch size of ${currentBatchSize}...`);
        // We now pass the dynamically selected currentBatchSize instead of the hardcoded 10
        processInBatches(words, currentBatchSize);
    }

    // --- THE COMMAND CENTER INJECTOR ---
    function injectControlCenter() {
        // Find the native "Lisää estoluetteloon" button
        const addBtn = document.querySelector('[data-automation="add-items-button"]');
        if (!addBtn) return;

        // Check if our control center is physically on the screen (fixes the SPA refresh bug)
        const existingGroup = document.getElementById('bravefox-control-center');
        if (existingGroup && document.body.contains(existingGroup)) return;

        console.log('BraveFox: Building Central UI Command Center...');

        // 1. Hide the native bottom buttons globally so they never show up
        if (!document.getElementById('bravefox-styles')) {
            const style = document.createElement('style');
            style.id = 'bravefox-styles';
            style.textContent = `
                [data-automation="export-button"],
                [data-automation="import-button"] {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }

        // 2. Build our container
        const btnGroup = document.createElement('div');
        btnGroup.id = 'bravefox-control-center';
        btnGroup.style.cssText = 'display: flex; gap: 12px; margin-left: 20px; align-items: center;';

        // Base button style
        const btnStyle = 'padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; border: 2px solid; display: flex; align-items: center; justify-content: center; background: transparent; transition: opacity 0.2s;';

        // Menu E: Dynamic Batch Size Selector
        const batchSelect = document.createElement('select');
        batchSelect.style.cssText = btnStyle + 'background: transparent; color: #333; cursor: pointer; border-color: #ccc; appearance: auto; padding-right: 10px; margin-right: 4px;';
        batchSelect.innerHTML = `
            <option value="7">Small - Batch of 7</option>
            <option value="10">Medium - Batch of 10</option>
            <option value="20">Large - Batch of 20</option>
        `;
        // Ensures the UI always matches our internal memory if the SPA rebuilds the DOM
        batchSelect.value = currentBatchSize.toString(); 
        batchSelect.onchange = (e) => {
            currentBatchSize = parseInt(e.target.value, 10);
            console.log(`BraveFox: Batch size dynamically set to ${currentBatchSize}`);
        };

        // Button A: Import Links (Native Proxy)
        const impLinks = document.createElement('div');
        impLinks.style.cssText = btnStyle + 'color: #616161; border-color: #616161; position: relative;';
        impLinks.innerHTML = `<div>Import Links</div>`;
        impLinks.onclick = () => {
            const nativeImp = document.querySelector('[data-automation="import-file-input"]');
            if (nativeImp) nativeImp.click();
            else alert('BraveFox: Native Link Import input not found in DOM!');
        };

        // Button B: Export Links (Native Proxy)
        const expLinks = document.createElement('div');
        expLinks.style.cssText = btnStyle + 'color: #616161; border-color: #616161;';
        expLinks.textContent = 'Export Links';
        expLinks.onclick = () => {
            const nativeExp = document.querySelector('[data-automation="export-button"]');
            if (nativeExp) nativeExp.click();
            else alert('BraveFox: Native Link Export button not found in DOM!');
        };

        // Button C: Import Terms (Custom Automation)
        const impTerms = document.createElement('div');
        impTerms.style.cssText = btnStyle + 'color: #16a34a; border-color: #16a34a; position: relative;';
        impTerms.innerHTML = `
            <div>Import Terms</div>
            <input type="file" accept=".txt,.csv" style="position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;">
        `;
        const fileInput = impTerms.querySelector('input');
        fileInput.addEventListener('click', e => { e.stopPropagation(); e.stopImmediatePropagation(); });
        fileInput.addEventListener('mousedown', e => { e.stopPropagation(); e.stopImmediatePropagation(); });
        fileInput.addEventListener('change', (e) => {
            e.stopPropagation();
            if (e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
                e.target.value = ''; 
            }
        });

        // Button D: Export Terms (Custom Scraper)
        const expTerms = document.createElement('div');
        expTerms.style.cssText = btnStyle + 'color: #2563eb; border-color: #2563eb;';
        expTerms.textContent = 'Export Terms';
        expTerms.onclick = exportWords;

        // Assemble the group (Drop the new menu in right at the front)
        btnGroup.appendChild(batchSelect);
        btnGroup.appendChild(impLinks);
        btnGroup.appendChild(expLinks);
        btnGroup.appendChild(impTerms);
        btnGroup.appendChild(expTerms);

        // 3. Inject it directly next to the "Lisää estoluetteloon" wrapper
        const addItemsWrapper = addBtn.closest('.add-items-btn-wrapper');
        if (addItemsWrapper && addItemsWrapper.parentElement) {
            const parentFlex = addItemsWrapper.parentElement;
            parentFlex.style.display = 'flex';
            parentFlex.style.alignItems = 'center';
            parentFlex.appendChild(btnGroup);
        }
    }

    // Observer constantly checks if the DOM needs our Command Center rebuilt
    const domObserver = new MutationObserver(() => {
        injectControlCenter();
    });

    domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // HEARTBEAT FIX: Pulse every 500ms to ensure the UI is restored immediately after a refresh
    setInterval(injectControlCenter, 500);

})();