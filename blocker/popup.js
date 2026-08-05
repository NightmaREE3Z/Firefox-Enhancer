import { MESSAGE } from './constants.js';

const form = document.querySelector('#unlockForm');
const input = document.querySelector('#passwordInput');
const button = document.querySelector('#unlockButton');
const errorText = document.querySelector('#errorText');
const panel = document.querySelector('.lock-panel');

const versionLabel = document.querySelector('#enhancerVersion');
if (versionLabel) {
  const version = browser.runtime.getManifest().version;
  versionLabel.textContent = `Via BraveFox Enhancer v${version}`;
}


const AMO_LISTING_URL = 'https://addons.mozilla.org/firefox/addon/bravefox-enhancer/';
const updateButton = document.querySelector('#checkExtensionUpdate');
const updateStatus = document.querySelector('#extensionUpdateStatus');
let updateButtonMode = 'check';

function showUpdateStatus(message, state = '') {
  if (!updateStatus) return;
  updateStatus.textContent = message;
  if (state) updateStatus.dataset.state = state;
  else delete updateStatus.dataset.state;
}

async function openAmoListing() {
  try {
    await browser.tabs.create({ url: AMO_LISTING_URL });
  } catch {
    window.location.href = AMO_LISTING_URL;
  }
}

if (updateButton) {
  const installedVersion = browser.runtime.getManifest().version;
  showUpdateStatus(`Installed version: ${installedVersion}`);

  updateButton.addEventListener('click', async () => {
    if (updateButtonMode === 'amo') {
      await openAmoListing();
      return;
    }

    if (typeof browser.runtime.requestUpdateCheck !== 'function') {
      showUpdateStatus('Direct update checks are unavailable here. Opening the AMO page…');
      await openAmoListing();
      return;
    }

    updateButton.disabled = true;
    updateButton.textContent = 'Checking for update…';
    showUpdateStatus(`Checking from version ${installedVersion}…`);

    try {
      const result = await browser.runtime.requestUpdateCheck();
      const resultStatus = result?.status || 'no_update';

      if (resultStatus === 'update_available') {
        const nextVersion = result?.version ? ` ${result.version}` : '';
        showUpdateStatus(`Update${nextVersion} found. Applying it now…`, 'success');
        updateButton.textContent = 'Applying update…';
        setTimeout(() => browser.runtime.reload(), 900);
        return;
      }

      if (resultStatus === 'throttled') {
        showUpdateStatus('Firefox throttled the update check. You can open the AMO page instead.', 'error');
        updateButtonMode = 'amo';
        updateButton.textContent = 'Open BraveFox on AMO';
        updateButton.disabled = false;
        return;
      }

      showUpdateStatus(`BraveFox Enhancer ${installedVersion} is up to date.`, 'success');
      updateButton.textContent = 'Check again';
      updateButton.disabled = false;
    } catch (updateError) {
      showUpdateStatus(`${updateError?.message || 'Firefox could not complete the update check.'} Open the AMO page instead.`, 'error');
      updateButtonMode = 'amo';
      updateButton.textContent = 'Open BraveFox on AMO';
      updateButton.disabled = false;
    }
  });
}

async function send(payload) {
  const response = await browser.runtime.sendMessage(payload);
  if (!response?.ok) {
    throw new Error(response?.error || 'BraveFox Focus Master request failed.');
  }
  return response;
}

function shake(message) {
  errorText.textContent = message;
  panel.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(0)' }
    ],
    { duration: 180 }
  );
  input.focus();
  input.select();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorText.textContent = '';
  button.disabled = true;
  input.disabled = true;

  try {
    const response = await send({
      type: MESSAGE.popupUnlockOpen,
      password: input.value
    });
    if (!response.unlocked) {
      shake('Incorrect password. Try again.');
      return;
    }
    if (document.body.dataset.bravefoxLauncher === 'options') {
      errorText.textContent = 'Manager opened.';
      input.value = '';
    } else {
      window.close();
    }
  } catch (error) {
    shake(error.message);
  } finally {
    button.disabled = false;
    input.disabled = false;
  }
});

const quickBlockButton = document.querySelector('#openQuickBlock');
if (quickBlockButton) {
  quickBlockButton.addEventListener('click', async () => {
    try {
      await browser.runtime.openOptionsPage();
      window.close();
    } catch (error) {
      shake(String(error?.message || error));
    }
  });
}

setTimeout(() => input.focus(), 0);


const redirectLoggerArea = document.querySelector('#redirectLoggerArea');
const redirectLoggerButton = document.querySelector('#enableRedirectLogger');
const redirectLoggerStatus = document.querySelector('#redirectLoggerStatus');

function showRedirectLoggerStatus(message, state = '') {
  if (!redirectLoggerStatus) return;
  redirectLoggerStatus.textContent = message;
  if (state) redirectLoggerStatus.dataset.state = state;
  else delete redirectLoggerStatus.dataset.state;
}

(async () => {
  if (!redirectLoggerArea || !redirectLoggerButton) return;
  try {
    const platform = await browser.runtime.getPlatformInfo();
    if (platform?.os === 'android') return;
    redirectLoggerArea.hidden = false;
    const enabled = await browser.permissions.contains({ permissions: ['nativeMessaging'] });
    redirectLoggerButton.textContent = enabled ? 'PC Redirect Logger enabled' : 'Enable PC Redirect Logger';
    redirectLoggerButton.disabled = enabled;
    showRedirectLoggerStatus(enabled
      ? 'Firefox may now send local redirect entries to the installed BraveFox Redirect Logger.'
      : 'One-time permission required for Firefox PC. Android remains unaffected.', enabled ? 'success' : '');
  } catch (error) {
    redirectLoggerArea.hidden = false;
    showRedirectLoggerStatus(String(error?.message || error), 'error');
  }
})();

if (redirectLoggerButton) {
  redirectLoggerButton.addEventListener('click', async () => {
    // Start both requests directly inside the click handler so Fenix/Firefox does
    // not discard the user-gesture context before the permission prompt opens.
    const permissionRequest = browser.permissions.request({
      permissions: ['nativeMessaging'],
      data_collection: ['browsingActivity', 'searchTerms', 'technicalAndInteraction']
    });
    redirectLoggerButton.disabled = true;
    showRedirectLoggerStatus('Requesting Firefox PC logger permission…');
    try {
      const granted = await permissionRequest;
      if (!granted) {
        redirectLoggerButton.disabled = false;
        showRedirectLoggerStatus('Permission was not granted. Redirect logging remains disabled.', 'error');
        return;
      }
      redirectLoggerButton.textContent = 'PC Redirect Logger enabled';
      showRedirectLoggerStatus('Enabled. Run the Redirect Logger installer on this PC if it is not installed yet.', 'success');
    } catch (error) {
      redirectLoggerButton.disabled = false;
      showRedirectLoggerStatus(String(error?.message || error), 'error');
    }
  });
}
