/* pwprotected.js
 * Controls the overlay displayed on your internal password-protected.html.
 * Supports native top-level protection flows; legacy iframe callers remain compatible.
 */

(() => {
  'use strict';

  const BRAND_NAME = 'BraveFox Enhancer';
  const ICON_PATH = 'icons/48.png';
  const FIXED_PASSWORD = '5u89asyadhy2adhg9uh3572y1';
  const PAGE_PARAMS = new URLSearchParams(window.location.search);
  const BLOCKER_MANAGER_TARGET = PAGE_PARAMS.get('target') === 'blocker-manager';
  const CHATGPT_AUTH_TARGET = PAGE_PARAMS.get('target') === 'chatgpt';
  const CHATGPT_AUTH_REQUEST_ID = String(PAGE_PARAMS.get('request') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
  const BLOCKER_TARGET = BLOCKER_MANAGER_TARGET;
  const CUSTOM_PROMPT_TITLE = String(PAGE_PARAMS.get('title') || '').trim();
  const COMPACT_PROMPT = PAGE_PARAMS.get('compact') === '1';

  // Build a minimal full-page scaffold in case the HTML is empty.
  function ensureBase() {
    if (!document.body) {
      const body = document.createElement('body');
      document.documentElement.appendChild(body);
    }
    if (!document.title) {
      document.title = BLOCKER_TARGET
        ? 'BraveFox Focus Master — Saatana! Sivu salasanasuojattu.'
        : `${BRAND_NAME} — Saatana! Sivu salasanasuojattu.`;
    }
  }

  function createStyle() {
    const style = document.createElement('style');
    style.textContent = `
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        height: 100%;
      }
      .bf-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .bf-topbar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 18px 22px;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;
      }
      .bf-logo {
        width: 28px;
        height: 28px;
        border-radius: 6px;
      }
      .bf-brand {
        font-weight: 800;
        font-size: 18px;
      }
      .bf-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .bf-card {
        width: min(720px, 92vw);
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.12);
        padding: 28px;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: #111827;
      }
      .bf-title {
        font-size: 36px;
        font-weight: 800;
        margin: 8px 0 18px 0;
      }
      .bf-input-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 8px 8px 8px 14px;
      }
      .bf-input {
        border: none;
        outline: none;
        background: transparent;
        font-size: 16px;
        padding: 12px 6px;
        width: 100%;
      }
      .bf-btn {
        appearance: none;
        border: none;
        outline: none;
        border-radius: 10px;
        height: 40px;
        width: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .bf-btn-submit {
        background: #2563eb;
        color: #fff;
      }
      .bf-update-area {
        margin-top: 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .bf-update-btn {
        appearance: none;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #f8fafc;
        color: #0f172a;
        min-height: 42px;
        padding: 10px 16px;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
      }
      .bf-update-btn:hover { background: #f1f5f9; }
      .bf-update-btn:disabled { cursor: wait; opacity: 0.68; }
      .bf-update-status {
        min-height: 18px;
        color: #64748b;
        font-size: 12px;
        font-weight: 650;
        text-align: center;
      }
      .bf-update-status[data-state="success"] { color: #047857; }
      .bf-update-status[data-state="error"] { color: #b91c1c; }
      .bf-version { margin-top: 12px; text-align: center; color: #94a3b8; font-size: 12px; font-weight: 700; }
      @media (max-width: 600px) {
        .bf-card { width: min(720px, 92vw); padding: 22px 18px; }
        .bf-title { font-size: 28px; }
        .bf-update-btn { width: 100%; }
      }
      .bf-error {
        margin-top: 10px;
        color: #b91c1c;
        font-size: 13px;
        min-height: 18px;
      }
    `;
    return style;
  }

  function iconURL() {
    try {
      return (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL(ICON_PATH)
        : ICON_PATH;
    } catch {
      return ICON_PATH;
    }
  }

  function svg(ns, name, attrs) {
    const el = document.createElementNS(ns, name);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }

  function arrowIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const s = svg(ns, 'svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    s.appendChild(svg(ns, 'path', { d: 'M5 12h14' }));
    s.appendChild(svg(ns, 'path', { d: 'M12 5l7 7-7 7' }));
    return s;
  }

  function render() {
    ensureBase();

    document.head.appendChild(createStyle());

    const page = document.createElement('div');
    page.className = 'bf-page';

    // Topbar (logo + brand)
    const topbar = document.createElement('div');
    topbar.className = 'bf-topbar';

    const logo = document.createElement('img');
    logo.className = 'bf-logo';
    logo.src = iconURL();
    logo.alt = `${BRAND_NAME} logo`;
    logo.referrerPolicy = 'no-referrer';

    const brand = document.createElement('div');
    brand.className = 'bf-brand';
    brand.textContent = BLOCKER_TARGET ? 'BraveFox Focus Master' : BRAND_NAME;

    topbar.appendChild(logo);
    topbar.appendChild(brand);

    // Card
    const container = document.createElement('div');
    container.className = 'bf-container';

    const card = document.createElement('div');
    card.className = 'bf-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const title = document.createElement('div');
    title.className = 'bf-title';
    title.textContent = CUSTOM_PROMPT_TITLE || (BLOCKER_MANAGER_TARGET
      ? 'BraveFox Focus Master salasanasuojattu'
      : 'Saatana! Sivu salasanasuojattu');

    const form = document.createElement('form');
    form.setAttribute('autocomplete', 'off');
    form.setAttribute('spellcheck', 'false');

    const inputRow = document.createElement('div');
    inputRow.className = 'bf-input-row';

    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'bf-input';
    input.placeholder = 'Anna se perhanan salasana';
    input.setAttribute('aria-label', 'Anna se perhanan salasana');

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'bf-btn bf-btn-submit';
    submit.appendChild(arrowIcon());

    inputRow.appendChild(input);
    inputRow.appendChild(submit);

    const error = document.createElement('div');
    error.className = 'bf-error';
    error.setAttribute('aria-live', 'polite');

    form.appendChild(inputRow);
    form.appendChild(error);

    const api = [globalThis.browser, globalThis.chrome].find(candidate =>
      candidate?.runtime?.getManifest && candidate?.runtime?.sendMessage
    ) || null;
    let installedVersion = '';
    try {
      installedVersion = api?.runtime?.getManifest?.().version || '';
    } catch {
      installedVersion = '';
    }

    const updateArea = document.createElement('div');
    updateArea.className = 'bf-update-area';

    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'bf-update-btn';
    updateButton.textContent = 'Check for updates';

    const updateStatus = document.createElement('div');
    updateStatus.className = 'bf-update-status';
    updateStatus.setAttribute('role', 'status');
    updateStatus.setAttribute('aria-live', 'polite');
    updateStatus.textContent = installedVersion ? `Version ${installedVersion}. Checking AMO…` : '';

    const setUpdateStatus = (message, state = '') => {
      updateStatus.textContent = message;
      if (state) updateStatus.dataset.state = state;
      else delete updateStatus.dataset.state;
    };

    const recentMatchingReceipt = (receipt, currentVersion) => {
      if (!receipt || receipt.currentVersion !== currentVersion) return null;
      const age = Date.now() - Number(receipt.updatedAt || 0);
      return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000 ? receipt : null;
    };

    const requestExtensionUpdateStatus = async (force = false) => {
      if (!api?.runtime?.sendMessage) throw new Error('Firefox extension runtime is unavailable.');
      const response = await api.runtime.sendMessage({
        type: 'bravefox:extension-update-status',
        force
      });
      if (!response?.ok) throw new Error(response?.error || 'Firefox could not check AMO.');
      return response;
    };

    let updateCheckRunning = false;
    let updateWatchTimer = 0;
    let reloadScheduled = false;

    const scheduleReloadForAppliedUpdate = () => {
      if (reloadScheduled) return;
      reloadScheduled = true;
      setUpdateStatus('Update installed. Reloading this page to apply the new BraveFox scripts…', 'success');
      window.setTimeout(() => window.location.reload(), 900);
    };

    const stopUpdateWatcher = () => {
      if (!updateWatchTimer) return;
      window.clearInterval(updateWatchTimer);
      updateWatchTimer = 0;
    };

    const startUpdateWatcher = (targetVersion) => {
      if (updateWatchTimer || !targetVersion) return;
      updateWatchTimer = window.setInterval(async () => {
        try {
          const result = await requestExtensionUpdateStatus(false);
          if (result.installedVersion !== installedVersion || result.installedVersion === targetVersion) {
            stopUpdateWatcher();
            scheduleReloadForAppliedUpdate();
          }
        } catch {
          // Firefox invalidates old content-script runtimes when the extension is
          // replaced. Once an update was known to exist, that is our signal to
          // refresh the page and load the newly installed BraveFox scripts.
          stopUpdateWatcher();
          scheduleReloadForAppliedUpdate();
        }
      }, 5000);
    };

    const renderExtensionUpdateStatus = (result) => {
      const receipt = recentMatchingReceipt(result.receipt, result.installedVersion);
      const updatePrefix = receipt?.previousVersion
        ? `Updated successfully from ${receipt.previousVersion} to ${receipt.currentVersion}. `
        : '';

      if (result.state === 'update_available') {
        setUpdateStatus(
          `Update available! Firefox will install version ${result.latestVersion} automatically. Installed version: ${result.installedVersion}.`,
          'success'
        );
        startUpdateWatcher(result.latestVersion);
        return;
      }

      stopUpdateWatcher();
      if (result.state === 'ahead') {
        setUpdateStatus(
          `Installed version ${result.installedVersion} is newer than AMO version ${result.latestVersion}.`,
          'success'
        );
        return;
      }

      setUpdateStatus(
        `${updatePrefix}You are on the latest version. Version ${result.installedVersion}.`,
        'success'
      );
    };

    const checkForExtensionUpdate = async ({ automatic = false } = {}) => {
      if (updateCheckRunning) return;
      updateCheckRunning = true;
      updateButton.disabled = true;
      updateButton.textContent = automatic ? 'Checking automatically…' : 'Checking for updates…';
      setUpdateStatus(installedVersion ? `Version ${installedVersion}. Checking AMO…` : 'Checking AMO…');

      try {
        const result = await requestExtensionUpdateStatus(!automatic);
        renderExtensionUpdateStatus(result);
        updateButton.textContent = 'Check again';
      } catch (checkError) {
        setUpdateStatus(`Update check failed: ${checkError?.message || checkError}`, 'error');
        updateButton.textContent = 'Check again';
      } finally {
        updateCheckRunning = false;
        updateButton.disabled = false;
      }
    };

    updateButton.addEventListener('click', () => checkForExtensionUpdate());
    if (!COMPACT_PROMPT) void checkForExtensionUpdate({ automatic: true });

    const version = document.createElement('div');
    version.className = 'bf-version';
    version.textContent = installedVersion
      ? `Via BraveFox Enhancer v${installedVersion}`
      : 'Powered by BraveFox Enhancer';

    updateArea.appendChild(updateButton);
    updateArea.appendChild(updateStatus);

    card.appendChild(title);
    card.appendChild(form);
    if (!COMPACT_PROMPT) card.appendChild(updateArea);
    card.appendChild(version);

    container.appendChild(card);

    // Always append topbar now, regardless of iframe status
    page.appendChild(topbar);
    page.appendChild(container);

    // Clear existing body and mount our page
    document.body.replaceChildren(page);

    function showIncorrectPassword(message = 'Incorrect password. Try again.') {
      error.textContent = message;
      card.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 180 }
      );
      input.focus();
      input.select();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (input.value !== FIXED_PASSWORD) {
        showIncorrectPassword();
        return;
      }

      // ChatGPT Personalization/actions use this page as a real top-level extension
      // page. The background owns a one-time return grant, so ChatGPT cannot dismiss
      // or bypass its own password prompt.
      if (CHATGPT_AUTH_TARGET) {
        if (!CHATGPT_AUTH_REQUEST_ID || window !== window.parent || !api?.runtime?.sendMessage) {
          showIncorrectPassword('ChatGPT password request is invalid or expired.');
          return;
        }

        submit.disabled = true;
        input.disabled = true;
        error.textContent = '';

        Promise.resolve(api.runtime.sendMessage({
          type: 'BRAVEFOX_CHATGPT_AUTH_APPROVE',
          requestId: CHATGPT_AUTH_REQUEST_ID
        })).then(response => {
          if (!response?.ok) throw new Error(response?.error || 'ChatGPT password request expired.');
          // On success the background navigates this tab back to ChatGPT.
        }).catch(authError => {
          submit.disabled = false;
          input.disabled = false;
          showIncorrectPassword(authError?.message || 'ChatGPT password request failed.');
        });
        return;
      }

      // BraveFox Focus Master deliberately reuses this established native password page.
      if (BLOCKER_MANAGER_TARGET) {
        submit.disabled = true;
        input.disabled = true;
        error.textContent = 'Unlocking BraveFox Focus Master…';

        browser.runtime.sendMessage({ type: 'BFB_UNLOCK', password: input.value })
          .then((response) => {
            if (!response?.ok || !response?.unlocked) {
              throw new Error(response?.error || 'BraveFox Focus Master could not verify this trusted manager tab. Open it once from the add-on menu.');
            }
            window.location.replace(browser.runtime.getURL('blocker/manager.html'));
          })
          .catch((requestError) => {
            submit.disabled = false;
            input.disabled = false;
            showIncorrectPassword(requestError?.message || 'BraveFox Focus Master could not be unlocked.');
          });
        return;
      }

      // Existing BraveFox Enhancer password behavior remains unchanged.
      if (window !== window.parent) {
        window.parent.postMessage('BraveFox-Unlock', '*');
      } else {
        chrome.runtime.sendMessage({ type: 'BRAVEFOX_EXT_UNLOCK' }, () => {
          chrome.runtime.sendMessage({ type: 'BRAVEFOX_GO_TO_EXTENSIONS' });
        });
      }
    });

    // Autofocus
    setTimeout(() => input.focus(), 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();