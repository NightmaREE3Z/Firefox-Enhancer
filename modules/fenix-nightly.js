// Firefox Android / Fenix Nightly-only background adapter.
// Shared fetching, storage, policies, alarms and blocking decisions live in /background.js.

const tabsClosing = new Set();

function getRegionalGoogleRedirect(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const match = hostname.match(/^(?:(.*)\.)?google\.([a-z]+(?:\.[a-z]+)?)$/i);
    if (!match) return null;

    const subdomain = match[1] ? `${match[1]}.` : "";
    const tld = match[2].toLowerCase();
    if (tld === "com" || tld === "fi") return null;

    return `${parsed.protocol}//${subdomain}google.com${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_) {
    return null;
  }
}

async function closeTabSafely(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0 || tabsClosing.has(tabId)) return;
  tabsClosing.add(tabId);
  try {
    await browser.tabs.remove(tabId);
  } catch (_) {
  } finally {
    tabsClosing.delete(tabId);
  }
}

export async function initializePlatform() {
  if (browser.webNavigation?.onErrorOccurred) {
    browser.webNavigation.onErrorOccurred.addListener(details => {
      if (details.frameId !== 0 || details.tabId < 0) return;
      const redirectUrl = getRegionalGoogleRedirect(details.url);
      if (redirectUrl) void browser.tabs.update(details.tabId, { url: redirectUrl });
    });
  }
}

export function beforeRequest(details) {
  if (details.type !== "main_frame") return null;
  const redirectUrl = getRegionalGoogleRedirect(details.url);
  return redirectUrl ? { redirectUrl } : null;
}

export function blockedResponse(details) {
  if (details.type === "main_frame") {
    if (details.tabId >= 0) setTimeout(() => void closeTabSafely(details.tabId), 500);
    return { redirectUrl: "about:blank" };
  }
  return { cancel: true };
}
