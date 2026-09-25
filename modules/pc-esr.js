// Firefox PC/ESR-only background adapter.
// Shared fetching, storage, policies, alarms and blocking decisions live in /background.js.

const registrations = [];

async function registerPcOnlyContentScripts() {
  if (!browser.contentScripts || typeof browser.contentScripts.register !== "function") {
    console.warn("[BraveFox PC] Dynamic content-script registration is unavailable.");
    return;
  }

  registrations.push(await browser.contentScripts.register({
    matches: ["https://www.facebook.com/*", "https://m.facebook.com/*"],
    js: [{ file: "scripts/facebook.js" }],
    runAt: "document_start"
  }));

  registrations.push(await browser.contentScripts.register({
    matches: ["https://www.instagram.com/*", "https://www.threads.net/*"],
    js: [{ file: "scripts/instagram.js" }],
    runAt: "document_start"
  }));

  console.log("[BraveFox PC] PC-only Facebook and Instagram content scripts registered from scripts/.");
}

export async function initializePlatform() {
  await registerPcOnlyContentScripts();

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
