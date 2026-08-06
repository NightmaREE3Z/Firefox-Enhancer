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
const AMO_API_URL = 'https://addons.mozilla.org/api/v5/addons/addon/bravefox-enhancer/';
const updateButton = document.querySelector('#checkExtensionUpdate');
const updateStatus = document.querySelector('#extensionUpdateStatus');
let updateButtonMode = 'check';

function showUpdateStatus(message, state = '') {
  if (!updateStatus) return;
  updateStatus.textContent = message;
  if (state) updateStatus.dataset.state = state;
  else delete updateStatus.dataset.state;
}

function compareVersions(left, right) {
  const leftParts = String(left || '').split('.').map(part => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || '').split('.').map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

async function fetchLatestAmoVersion() {
  const response = await fetch(AMO_API_URL, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`AMO returned HTTP ${response.status}.`);
  }

  const addon = await response.json();
  const latestVersion = String(addon?.current_version?.version || '').trim();
  if (!latestVersion) throw new Error('AMO did not return a current version.');
  return latestVersion;
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

    updateButton.disabled = true;
    updateButton.textContent = 'Checking AMO…';
    showUpdateStatus(`Comparing installed ${installedVersion} with AMO…`);

    try {
      const latestVersion = await fetchLatestAmoVersion();
      const comparison = compareVersions(installedVersion, latestVersion);

      if (comparison < 0) {
        showUpdateStatus(
          `AMO version ${latestVersion} is available. Firefox will install approved updates automatically.`,
          'success'
        );
        updateButtonMode = 'amo';
        updateButton.textContent = 'Open BraveFox on AMO';
        return;
      }

      if (comparison > 0) {
        showUpdateStatus(
          `Installed ${installedVersion} is newer than AMO version ${latestVersion}.`,
          'success'
        );
      } else {
        showUpdateStatus(`BraveFox Enhancer ${installedVersion} is up to date on AMO.`, 'success');
      }

      updateButton.textContent = 'Check again';
    } catch (updateError) {
      showUpdateStatus(
        `${updateError?.message || 'The AMO version check failed.'} You can open the listing instead.`,
        'error'
      );
      updateButtonMode = 'amo';
      updateButton.textContent = 'Open BraveFox on AMO';
    } finally {
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
