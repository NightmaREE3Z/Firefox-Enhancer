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


const updateButton = document.querySelector('#checkExtensionUpdate');
const updateStatus = document.querySelector('#extensionUpdateStatus');
const installedVersion = browser.runtime.getManifest().version;
let updateCheckRunning = false;

function showUpdateStatus(message, state = '') {
  if (!updateStatus) return;
  updateStatus.textContent = message;
  updateStatus.hidden = !message;
  if (state) updateStatus.dataset.state = state;
  else delete updateStatus.dataset.state;
}

function recentMatchingReceipt(receipt, currentVersion) {
  if (!receipt || receipt.currentVersion !== currentVersion) return null;
  const age = Date.now() - Number(receipt.updatedAt || 0);
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000 ? receipt : null;
}

async function requestExtensionUpdateStatus(force = false) {
  const response = await browser.runtime.sendMessage({
    type: 'bravefox:extension-update-status',
    force
  });
  if (!response?.ok) throw new Error(response?.error || 'Firefox could not check AMO.');
  return response;
}

function renderExtensionUpdateStatus(result) {
  const receipt = recentMatchingReceipt(result.receipt, result.installedVersion);
  const updatePrefix = receipt?.previousVersion
    ? `Updated successfully from ${receipt.previousVersion} to ${receipt.currentVersion}. `
    : '';

  if (result.state === 'update_available') {
    showUpdateStatus(
      `Update available! Firefox will install version ${result.latestVersion} automatically. Installed version: ${result.installedVersion}.`,
      'success'
    );
    return;
  }

  if (result.state === 'ahead') {
    showUpdateStatus(
      `Installed version ${result.installedVersion} is newer than AMO version ${result.latestVersion}.`,
      'success'
    );
    return;
  }

  showUpdateStatus(
    `${updatePrefix}You are on the latest version. Version ${result.installedVersion}.`,
    'success'
  );
}

async function checkForExtensionUpdate() {
  if (!updateButton || updateCheckRunning) return;

  updateCheckRunning = true;
  updateButton.disabled = true;
  updateButton.textContent = 'Checking for updates…';
  showUpdateStatus(`Version ${installedVersion}. Checking AMO…`);

  try {
    const result = await requestExtensionUpdateStatus(true);
    renderExtensionUpdateStatus(result);
  } catch (error) {
    showUpdateStatus(`Update check failed: ${error?.message || error}`, 'error');
  } finally {
    updateCheckRunning = false;
    updateButton.disabled = false;
    updateButton.textContent = 'Check for updates';
  }
}

if (updateButton) {
  showUpdateStatus('');
  updateButton.textContent = 'Check for updates';
  updateButton.addEventListener('click', () => checkForExtensionUpdate());
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
