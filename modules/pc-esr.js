// Firefox PC/ESR-only background adapter.
// Shared fetching, storage, policies, alarms and blocking decisions live in /background.js.
// Shared content scripts are registered once in manifest.json for desktop and Android.

export async function initializePlatform() {
  if (browser.browserAction) {
    await browser.browserAction.setBadgeText({ text: "ON" });
    await browser.browserAction.setBadgeBackgroundColor({ color: "#4CAF50" });
  }
}

export function beforeRequest() {
  return null;
}

export function blockedResponse() {
  return { cancel: true };
}
