/* BraveFox Element Picker — shared Chromium MV3 / Firefox MV2 module.
 * Runs as a document-start content script, the extension-owned manager page,
 * or (when imported) the background coordinator. No web-page auth overlays.
 */
(() => {
  'use strict';

  const api = globalThis.browser || globalThis.chrome;
  if (!api?.runtime?.id) return;
  const KEY = 'bravefox.elementselect.rules.v1';
  const MENU_KEY = 'bravefox.elementselect.contextMenu.v1';
  const AUTH_KEY = 'bravefox.elementselect.auth.v1';
  const MENU_ID = 'bravefox-elementselect-pick';
  const SCHEME = globalThis.location?.protocol || '';
  const IS_WEB = SCHEME === 'http:' || SCHEME === 'https:';
  const IS_MANAGER = !IS_WEB && globalThis.location?.pathname === '/html/elementselect.html';
  // Chrome 148+ exposes browser.* too. These builds use MV3 on Chromium,
  // MV2 on Firefox, so presence of browser.* is NOT a browser detector.
  const IS_FIREFOX = api.runtime.getManifest().manifest_version === 2;
  const replyError = error => ({ ok: false, error: String(error?.message || error || 'Unknown error') });
  const now = () => Date.now();
  const hostOf = value => {
    try { return new URL(value).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); }
    catch (_) { return ''; }
  };
  const normalizePath = value => {
    let path = String(value || '/').replace(/\/{2,}/g, '/');
    if (!path.startsWith('/')) path = '/' + path;
    return path.length > 1 ? path.replace(/\/$/, '') : path;
  };
  const scopeUrl = rule => `https://${rule.host}${rule.path || '/'}${rule.query || ''}`;
  const pathMatches = (locationPath, rulePath, hostname = '') => {
    if (!rulePath) return true;
    let actual = normalizePath(locationPath);
    let expected = normalizePath(rulePath);
    if (expected === '/') return true;
    if (hostname === 'reddit.com' || hostname.endsWith('.reddit.com')) {
      actual = actual.toLowerCase();
      expected = expected.toLowerCase();
    }
    return actual === expected || actual.startsWith(expected + '/');
  };
  const exactPathMatches = (actualPath, expectedPath, hostname = '') => {
    let actual = normalizePath(actualPath);
    let expected = normalizePath(expectedPath);
    if (hostname === 'reddit.com' || hostname.endsWith('.reddit.com')) {
      actual = actual.toLowerCase();
      expected = expected.toLowerCase();
    }
    return actual === expected;
  };
  const validSelector = value => {
    const selector = String(value || '').trim();
    return selector.length >= 2 && selector.length <= 450 &&
      !/\u0000|[{};]/.test(selector) && !/^\s*(?:\*|html|body|:root)\s*$/i.test(selector) &&
      !/(?:^|,)\s*(?:html|body|:root)(?:\s|$|>)/i.test(selector) &&
      !/::(?:before|after|part|slotted)/i.test(selector);
  };
  function normalizedRule(source) {
    if (!source || typeof source !== 'object') return null;
    const host = hostOf(`https://${String(source.host || '').trim()}/`);
    const selector = String(source.selector || '').trim();
    if (!host || (host !== 'localhost' && !host.includes('.')) ||
      !/^[a-z0-9.-]+$/i.test(host) || host.split('.').some(part => !part || part.startsWith('-') || part.endsWith('-')) ||
      !validSelector(selector)) return null;
    // Older 29.9.0 rules with a path remain section-scoped after this update.
    const scope = ['site', 'path', 'exact'].includes(source.scope)
      ? source.scope : (source.path ? 'path' : 'site');
    const path = scope === 'site' ? '' : normalizePath(source.path || '/');
    const query = scope === 'exact' ? String(source.query || '').slice(0, 1000) : '';
    if (query && !query.startsWith('?')) return null;
    return {
      id: String(source.id || crypto.randomUUID()).slice(0, 100),
      host, path, query, scope, selector,
      label: String(source.label || '').slice(0, 160),
      enabled: source.enabled !== false,
      createdAt: Number(source.createdAt) || now()
    };
  }
  async function readRules() {
    const result = await api.storage.local.get(KEY);
    return (Array.isArray(result[KEY]) ? result[KEY] : []).map(normalizedRule).filter(Boolean).slice(0, 5000);
  }
  const send = async data => {
    const response = await api.runtime.sendMessage(data);
    if (!response?.ok) throw new Error(response?.error || 'Element Picker request failed.');
    return response;
  };

  if (IS_WEB) {
    let rules = [];
    let picker = null;
    let selected = null;
    let clickedTarget = null;
    let suggestedTarget = null;
    let suggestedLabel = '';
    let depthNodes = [];
    let specificityChoices = [];
    let picking = false;
    let currentHover = null;
    let ancestorOffset = 0;
    let previewStyles = [];
    let mainStyle = null;
    let currentUrl = location.href;
    const shadowStyles = new Map();

    function applicableRules() {
      const host = hostOf(location.href);
      return rules.filter(rule => rule.enabled && rule.host === host &&
        (rule.scope === 'exact'
          ? exactPathMatches(location.pathname, rule.path, host) && location.search === rule.query
          : pathMatches(location.pathname, rule.path, host)));
    }
    const shadowObservers = new Map();
    const discoveryRoots = new Set();
    const repairRoots = new Set();
    let activeDiscovery = null;
    let discoveryTimer = null;
    let pruneTimer = null;
    let currentCss = '';

    function rootConnected(root) {
      return root === document || (root.host ? root.host.isConnected : root.isConnected);
    }
    function styleRoots() {
      return [document, ...[...shadowStyles.keys()].filter(rootConnected)];
    }
    function applyRootStyle(root) {
      if (!rootConnected(root)) return;
      let style = root === document ? mainStyle : shadowStyles.get(root);
      // Empty styles in hundreds of shadow roots do not hide anything.
      if (!style && root !== document && !currentCss) return;
      if (!style) {
        style = document.createElement('style');
        if (root === document) {
          mainStyle = style;
          style.id = 'bravefox-elementselect-rules';
        } else {
          style.setAttribute('data-bravefox-elementselect', '');
          shadowStyles.set(root, style);
        }
      }
      if (style.textContent !== currentCss) style.textContent = currentCss;
      const target = root === document ? (document.head || document.documentElement) : root;
      if (target && !style.isConnected) target.appendChild(style);
    }
    function renderRules() {
      currentCss = applicableRules().map(rule =>
        `:is(${rule.selector}) { display: none !important; }`).join('\n');
      // Rules change infrequently. Apply to known roots once, then discover any
      // newly relevant open roots incrementally.
      applyRootStyle(document);
      for (const [root, style] of shadowStyles) {
        if (rootConnected(root)) applyRootStyle(root);
        else if (style && style.textContent !== currentCss) style.textContent = currentCss;
      }
      if (currentCss || picker) discoverShadowRoots(document);
    }
    function scheduleDiscovery() {
      if (discoveryTimer !== null) return;
      discoveryTimer = setTimeout(drainDiscovery, 8);
    }
    function discoverShadowRoots(scope) {
      if (!scope || !rootConnected(scope)) return;
      discoveryRoots.add(scope);
      scheduleDiscovery();
    }
    function inspectShadowHost(node) {
      if (node?.nodeType === 1 && node.shadowRoot) registerShadowRoot(node.shadowRoot);
    }
    function drainDiscovery() {
      discoveryTimer = null;
      const started = performance.now();
      let steps = 0;
      while (steps++ < 240 && performance.now() - started < 6) {
        if (repairRoots.size) {
          const root = repairRoots.values().next().value;
          repairRoots.delete(root);
          applyRootStyle(root);
        }
        if (activeDiscovery && !rootConnected(activeDiscovery.root)) activeDiscovery = null;
        if (!activeDiscovery && discoveryRoots.size) {
          const scope = discoveryRoots.values().next().value;
          discoveryRoots.delete(scope);
          if (rootConnected(scope)) {
            inspectShadowHost(scope);
            activeDiscovery = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
          }
        }
        if (activeDiscovery) {
          const node = activeDiscovery.nextNode();
          if (node) inspectShadowHost(node);
          else activeDiscovery = null;
        }
        if (!activeDiscovery && !discoveryRoots.size && !repairRoots.size) break;
      }
      if (activeDiscovery || discoveryRoots.size || repairRoots.size) scheduleDiscovery();
    }
    function registerShadowRoot(root) {
      if (shadowStyles.has(root) || !rootConnected(root)) return;
      shadowStyles.set(root, null);
      const shadowObserver = new MutationObserver(handleMutations);
      shadowObservers.set(root, shadowObserver);
      shadowObserver.observe(root, { childList: true, subtree: true });
      applyRootStyle(root);
      discoverShadowRoots(root);
    }
    function schedulePrune() {
      if (pruneTimer !== null) return;
      pruneTimer = setTimeout(() => {
        pruneTimer = null;
        for (const [root, observer] of shadowObservers) {
          if (rootConnected(root)) continue;
          observer.disconnect();
          shadowObservers.delete(root);
          // A detached host can later be reinserted. Remove our old style so
          // rediscovery cannot leave duplicate or stale rules in that root.
          shadowStyles.get(root)?.remove();
          shadowStyles.delete(root);
          discoveryRoots.delete(root);
          repairRoots.delete(root);
        }
      }, 1000);
    }
    function checkRoute() {
      if (location.href === currentUrl) return;
      currentUrl = location.href;
      renderRules();
    }
    function handleMutations(records) {
      checkRoute();
      const needsDiscovery = !!(currentCss || picker);
      for (const record of records) {
        if (needsDiscovery) {
          for (const node of record.addedNodes) {
            if (node.nodeType === 1 || node.nodeType === 11) discoverShadowRoots(node);
          }
        }
        if (record.removedNodes.length) {
          if (shadowStyles.size) schedulePrune();
          const root = record.target.getRootNode();
          const style = root === document ? mainStyle : shadowStyles.get(root);
          if (style && !style.isConnected) {
            repairRoots.add(root);
            scheduleDiscovery();
          }
        }
      }
      if (mainStyle && !mainStyle.isConnected) {
        repairRoots.add(document);
        scheduleDiscovery();
      }
    }
    // Explicit picking needs complete selector counts immediately. This is
    // user-triggered only, not a repeated background mutation scan.
    function discoverForPicker() {
      const roots = [document];
      for (let i = 0; i < roots.length; i++) {
        const walker = document.createTreeWalker(roots[i], NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.shadowRoot) continue;
          registerShadowRoot(node.shadowRoot);
          roots.push(node.shadowRoot);
        }
      }
    }
    api.storage.local.get(KEY).then(result => {
      rules = (Array.isArray(result[KEY]) ? result[KEY] : []).map(normalizedRule).filter(Boolean);
      renderRules();
    }).catch(error => console.warn('[BraveFox Picker] Cosmetic rules:', error));
    // Create the styling node immediately, before asynchronous storage resolves.
    renderRules();
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[KEY]) return;
      rules = (Array.isArray(changes[KEY].newValue) ? changes[KEY].newValue : [])
        .map(normalizedRule).filter(Boolean);
      renderRules();
    });
    const observer = new MutationObserver(handleMutations);
    observer.observe(document, { childList: true, subtree: true });
    window.addEventListener('popstate', checkRoute, { passive: true });
    window.addEventListener('hashchange', checkRoute, { passive: true });

    function qs(selector) {
      try {
        return styleRoots().reduce((count, root) => count + root.querySelectorAll(selector).length, 0);
      }
      catch (_) { return 0; }
    }
    function acceptableAttribute(element, key) {
      const value = element.getAttribute(key);
      return value && value.length < 90 && !/^[0-9a-f-]{18,}$/i.test(value) ? value : '';
    }
    function attrSelector(key, value) {
      const quoted = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        .replace(/[\n\r\f]/g, '\\a ');
      return `[${key}="${quoted}"]`;
    }
    function fragment(element) {
      const tag = element.localName;
      if (!tag || /^(html|body)$/i.test(tag)) return '';
      const id = acceptableAttribute(element, 'id');
      if (id && !/^(?:ember|react|radix|:r)[-:_\d]/i.test(id)) {
        const candidate = '#' + CSS.escape(id);
        if (qs(candidate) === 1) return candidate;
      }
      // Content identifiers are more useful than repeated data-testid values:
      // hide one Reddit post, not every search card on the results page.
      for (const name of ['data-thingid', 'data-post-id', 'data-fullname', 'data-item-id', 'data-id']) {
        const value = acceptableAttribute(element, name);
        if (value) {
          const candidate = tag + attrSelector(name, value);
          if (qs(candidate) === 1) return candidate;
        }
      }
      for (const name of ['data-testid', 'data-test', 'data-qa', 'data-automation-id', 'aria-label']) {
        const value = acceptableAttribute(element, name);
        if (value) {
          const candidate = tag + attrSelector(name, value);
          if (qs(candidate) >= 1 && qs(candidate) < 80) return candidate;
        }
      }
      const classes = [...element.classList].filter(value => value.length < 45 &&
        /^[a-z_][a-z0-9_-]*$/i.test(value) && !/\d{4,}|^(?:active|selected|hover|focus|open|hidden)$/i.test(value));
      for (const className of classes.slice(0, 5)) {
        const candidate = tag + '.' + CSS.escape(className);
        if (qs(candidate) > 0 && qs(candidate) <= 12) return candidate;
      }
      const parent = element.parentElement;
      if (!parent) return tag;
      const siblings = [...parent.children].filter(node => node.localName === tag);
      return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
    }
    function selectorFor(element) {
      const parts = [];
      for (let node = element, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
        const piece = fragment(node);
        if (!piece) break;
        parts.unshift(piece);
        const candidate = parts.join(' > ');
        if (validSelector(candidate) && qs(candidate) === 1) return candidate;
        if (piece.startsWith('#')) break;
      }
      return parts.join(' > ');
    }
    function rectFor(element) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) return rect;
      // Custom tracker wrappers sometimes use display: contents and therefore
      // have no box even though display: none will hide their full subtree.
      return element.firstElementChild?.getBoundingClientRect() ||
        element.children?.[0]?.getBoundingClientRect() || rect;
    }
    function suggestedContainer(element) {
      let best = { node: element, score: 0, label: 'element' };
      let depth = 0;
      for (let node = element; node && depth <= 9 &&
        !/^(html|body)$/i.test(node.localName); node = node.parentElement, depth++) {
        const tag = node.localName.toLowerCase();
        const testid = String(node.getAttribute('data-testid') || '').toLowerCase();
        const role = String(node.getAttribute('role') || '').toLowerCase();
        let score = 0;
        let label = '';
        if (testid === 'search-sdui-post') { score = 160; label = 'search post card'; }
        else if (tag === 'shreddit-post') { score = 155; label = 'Reddit post card'; }
        else if (/^(?:post-container|post-card|feed-post|post-unit|search-post-unit|search-sdui-comment)$/.test(testid)) {
          score = 135; label = 'post container';
        } else if (/(?:post-card|feed-item|result-card|ad-card|promoted-post)/.test(testid)) {
          score = 125; label = 'content card';
        } else if (tag === 'article' || role === 'article') {
          score = 95; label = 'article/card';
        } else if (node.classList.contains('Post') || node.classList.contains('thing')) {
          score = 85; label = 'post card';
        }
        const rect = rectFor(node);
        if (score && rect.width > 30 && rect.height > 20 && score - depth * 4 > best.score) {
          best = { node, score: score - depth * 4, label };
        }
      }
      return best;
    }
    function selectorChoices(element) {
      const selectors = new Map();
      const add = selector => {
        if (!validSelector(selector) || selectors.has(selector)) return;
        try {
          if (!element.matches(selector)) return;
          const count = qs(selector);
          if (count < 1 || count > 5000) return;
          selectors.set(selector, { selector, count });
        } catch (_) {}
      };
      const tag = element.localName;
      // A broadly matching tag is offered only for structural elements. A bare
      // "div" or "a" would be much too destructive as a suggested filter.
      if (!/^(div|span|a|p|li|button|label|section)$/i.test(tag)) add(tag);
      const testid = acceptableAttribute(element, 'data-testid');
      if (testid) add(tag + attrSelector('data-testid', testid));
      for (const name of ['data-test', 'data-qa', 'role']) {
        const value = acceptableAttribute(element, name);
        if (value) add(tag + attrSelector(name, value));
      }
      for (const className of [...element.classList].filter(value =>
        /^[a-z_][a-z0-9_-]*$/i.test(value) && value.length < 45 && !/\d{4,}/.test(value)).slice(0, 4)) {
        add(tag + '.' + CSS.escape(className));
      }
      for (const name of ['data-thingid', 'data-post-id', 'data-fullname', 'data-item-id', 'data-id']) {
        const value = acceptableAttribute(element, name);
        if (value) add(tag + attrSelector(name, value));
      }
      const stableId = acceptableAttribute(element, 'id');
      if (stableId) add('#' + CSS.escape(stableId));
      add(selectorFor(element));
      return [...selectors.values()].sort((a, b) =>
        b.count - a.count || a.selector.length - b.selector.length);
    }
    function parentAt(element, offset) {
      let node = element;
      for (let i = 0; i < offset && node?.parentElement &&
        !/^(body|html)$/i.test(node.parentElement.localName); i++) node = node.parentElement;
      return node;
    }
    function elementAtPoint(x, y) {
      let element = document.elementFromPoint(x, y);
      for (let depth = 0; element?.shadowRoot && depth < 16; depth++) {
        registerShadowRoot(element.shadowRoot);
        const inner = element.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === element) break;
        element = inner;
      }
      return element;
    }
    function inspectAt(x, y, keepCurrent = false) {
      if (!picker) return;
      picker.host.style.pointerEvents = 'none';
      const element = keepCurrent ? currentHover : elementAtPoint(x, y);
      picker.host.style.pointerEvents = '';
      if (!element || element === picker.host || picker.host.contains(element)) return;
      currentHover = element;
      const node = parentAt(element, ancestorOffset);
      const rect = rectFor(node);
      const outline = picker.shadow.getElementById('outline');
      Object.assign(outline.style, { left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`, display: 'block' });
      picker.shadow.getElementById('hint').textContent =
        `${node.localName}${node.id ? '#' + node.id.slice(0, 50) : ''} · ${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    }
    function stopPicking() {
      picking = false;
      picker?.shadow.getElementById('outline')?.style.setProperty('display', 'none');
    }
    function removePreview() {
      for (const style of previewStyles) style.remove();
      previewStyles = [];
    }
    function closePicker() {
      stopPicking(); removePreview();
      picker?.host.remove(); picker = null; selected = null;
      document.removeEventListener('pointermove', pointerMoved, true);
      document.removeEventListener('click', pickClicked, true);
      document.removeEventListener('keydown', pickerKeys, true);
      document.removeEventListener('wheel', pickerWheel, { capture: true });
    }
    function startPicking() {
      if (!picker) return;
      removePreview(); selected = null; clickedTarget = null;
      suggestedTarget = null; depthNodes = []; specificityChoices = [];
      ancestorOffset = 0; picking = true;
      picker.shadow.getElementById('controls').hidden = true;
      picker.shadow.getElementById('hint').textContent = 'Hover, click an element, or use Alt + mouse wheel for its parent';
    }
    function updateChoice(element) {
      stopPicking(); clickedTarget = element;
      const suggestion = suggestedContainer(element);
      suggestedTarget = suggestion.node;
      suggestedLabel = suggestion.label;
      depthNodes = [];
      for (let node = element; node && depthNodes.length <= 9 &&
        !/^(body|html)$/i.test(node.localName); node = node.parentElement) {
        depthNodes.push(node);
      }
      const depth = picker.shadow.getElementById('depth');
      depth.max = String(Math.max(0, depthNodes.length - 1));
      depth.value = String(Math.max(0, depthNodes.indexOf(suggestedTarget)));
      setSelectedTarget(depthNodes[Number(depth.value)]);
      picker.shadow.getElementById('controls').hidden = false;
    }
    function setSelectedTarget(element) {
      removePreview(); selected = element;
      const depth = picker.shadow.getElementById('depth');
      const level = Number(depth.value);
      picker.shadow.getElementById('depthValue').textContent =
        `${level === 0 ? 'Clicked element' : level + ' parent level' + (level === 1 ? '' : 's')} · ${element.localName}`;
      specificityChoices = selectorChoices(element);
      const specificity = picker.shadow.getElementById('specificity');
      specificity.max = String(Math.max(0, specificityChoices.length - 1));
      specificity.value = specificity.max;
      specificity.disabled = specificityChoices.length <= 1;
      setSpecificity();
      const rect = rectFor(element);
      const outline = picker.shadow.getElementById('outline');
      Object.assign(outline.style, { left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`, display: 'block' });
      picker.shadow.getElementById('hint').textContent = element === suggestedTarget && element !== clickedTarget
        ? `Suggested ${suggestedLabel}; adjust depth and specificity as needed.`
        : `Selected ${element.localName}; adjust both sliders before hiding.`;
    }
    function setSpecificity() {
      removePreview();
      const input = picker.shadow.getElementById('selector');
      const slider = picker.shadow.getElementById('specificity');
      const chosen = specificityChoices[Number(slider.value)];
      input.value = chosen?.selector || selectorFor(selected);
      picker.shadow.getElementById('specificityValue').textContent = chosen
        ? `${Number(slider.value) + 1}/${specificityChoices.length} · ${chosen.count} matching`
        : 'No generated selector';
      updateCount();
    }
    function updateCount() {
      const value = picker.shadow.getElementById('selector').value.trim();
      const count = qs(value);
      picker.shadow.getElementById('count').textContent = count
        ? `${count} element${count === 1 ? '' : 's'} matched — ${count > 1 ? 'all matches will be hidden' : 'this element will be hidden'}`
        : 'No matching elements (or invalid CSS)';
      const saveButton = picker.shadow.getElementById('save');
      saveButton.disabled = !validSelector(value) || count < 1;
      saveButton.textContent = count > 1 ? `Hide ${count} elements` : 'Hide element';
      return count;
    }
    function pointerMoved(event) { if (picking) inspectAt(event.clientX, event.clientY); }
    function pickClicked(event) {
      if (!picking || event.composedPath().includes(picker.host)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      inspectAt(event.clientX, event.clientY);
      if (currentHover) updateChoice(parentAt(currentHover, ancestorOffset));
    }
    function pickerKeys(event) {
      if (event.key === 'Escape') { event.preventDefault(); closePicker(); return; }
      if (!picking || !currentHover) return;
      if (event.key === '[' || event.key === ']') {
        event.preventDefault(); ancestorOffset = Math.max(0, Math.min(8,
          ancestorOffset + (event.key === '[' ? 1 : -1)));
        inspectAt(0, 0, true);
      }
    }
    function pickerWheel(event) {
      if (!picking || !event.altKey || !currentHover) return;
      event.preventDefault();
      ancestorOffset = Math.max(0, Math.min(8, ancestorOffset + (event.deltaY < 0 ? 1 : -1)));
      inspectAt(0, 0, true);
    }
    function widget(tag, attrs = {}, parent) {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'text') node.textContent = value;
        else node.setAttribute(key, value);
      }
      parent.append(node);
      return node;
    }
    function openPicker() {
      if (picker) { startPicking(); return; }
      discoverForPicker();
      const host = document.createElement('div');
      host.id = 'bravefox-element-picker';
      const shadow = host.attachShadow({ mode: 'closed' });
      const css = widget('link', { rel: 'stylesheet', href: api.runtime.getURL('css/elementselect.css') }, shadow);
      void css;
      widget('div', { id: 'outline' }, shadow);
      const box = widget('section', { id: 'picker-panel' }, shadow);
      const top = widget('header', { class: 'picker-head' }, box);
      widget('strong', { text: 'BraveFox Element Picker' }, top);
      const close = widget('button', { type: 'button', text: '×', title: 'Close (Esc)' }, top);
      const hint = widget('p', { id: 'hint', text: 'Choose an element to hide' }, box);
      void hint;
      const controls = widget('div', { id: 'controls' }, box);
      const sliders = widget('div', { id: 'sliders' }, controls);
      const depthGroup = widget('div', { class: 'slider-group' }, sliders);
      widget('label', { for: 'depth', text: 'Element depth' }, depthGroup);
      const depth = widget('input', { id: 'depth', type: 'range', min: '0', max: '0', value: '0', step: '1' }, depthGroup);
      widget('small', { id: 'depthValue', text: 'Clicked element' }, depthGroup);
      const specificityGroup = widget('div', { class: 'slider-group' }, sliders);
      widget('label', { for: 'specificity', text: 'Selector specificity' }, specificityGroup);
      const specificity = widget('input', { id: 'specificity', type: 'range', min: '0', max: '0', value: '0', step: '1' }, specificityGroup);
      widget('small', { id: 'specificityValue', text: 'Precise' }, specificityGroup);
      widget('label', { for: 'selector', text: 'CSS selector' }, controls);
      const input = widget('input', { id: 'selector', spellcheck: 'false', autocomplete: 'off' }, controls);
      widget('small', { id: 'count' }, controls);
      widget('label', { for: 'scopeMode', text: 'Where to hide it' }, controls);
      const scopeMode = widget('select', { id: 'scopeMode' }, controls);
      const pageDescription = (location.pathname + location.search).slice(0, 64);
      widget('option', { value: 'exact', text: `Only this URL (${pageDescription})` }, scopeMode);
      widget('option', { value: 'path', text: `This section (${location.pathname} and subpages)` }, scopeMode);
      widget('option', { value: 'site', text: `Entire website (${hostOf(location.href)})` }, scopeMode);
      scopeMode.value = 'exact';
      const buttons = widget('div', { class: 'picker-actions' }, controls);
      const preview = widget('button', { type: 'button', text: 'Preview' }, buttons);
      const save = widget('button', { type: 'button', id: 'save', text: 'Hide element', class: 'primary' }, buttons);
      const foot = widget('div', { class: 'picker-actions' }, box);
      const again = widget('button', { type: 'button', text: 'Pick another' }, foot);
      const manage = widget('button', { type: 'button', text: 'Manage' }, foot);
      (document.documentElement || document.body).appendChild(host);
      picker = { host, shadow };
      close.addEventListener('click', closePicker);
      again.addEventListener('click', startPicking);
      depth.addEventListener('input', () => setSelectedTarget(depthNodes[Number(depth.value)]));
      specificity.addEventListener('input', setSpecificity);
      manage.addEventListener('click', () => send({ type: 'ESELECT_MANAGE', site: location.href })
        .catch(error => { picker.shadow.getElementById('hint').textContent = error.message; }));
      input.addEventListener('input', () => { removePreview(); updateCount(); });
      preview.addEventListener('click', () => {
        removePreview();
        if (!validSelector(input.value) || !updateCount()) return;
        for (const root of styleRoots()) {
          const style = document.createElement('style');
          style.textContent = `:is(${input.value.trim()}) { display: none !important; }`;
          (root === document ? (document.head || document.documentElement) : root)?.appendChild(style);
          previewStyles.push(style);
        }
      });
      save.addEventListener('click', async () => {
        if (!validSelector(input.value) || !updateCount()) return;
        save.disabled = true;
        try {
          await send({ type: 'ESELECT_ADD', rule: { host: hostOf(location.href),
            path: scopeMode.value === 'site' ? '' : location.pathname,
            query: scopeMode.value === 'exact' ? location.search : '', scope: scopeMode.value,
            selector: input.value.trim(),
            label: selected === suggestedTarget && selected !== clickedTarget
              ? suggestedLabel : selected?.localName || 'Selected element' } });
          // Apply the confirmed storage update before dismissing the picker.
          const saved = await api.storage.local.get(KEY);
          rules = (Array.isArray(saved[KEY]) ? saved[KEY] : []).map(normalizedRule).filter(Boolean);
          renderRules();
          closePicker();
        } catch (error) {
          picker.shadow.getElementById('hint').textContent = error.message;
          save.disabled = false;
        }
      });
      document.addEventListener('pointermove', pointerMoved, true);
      document.addEventListener('click', pickClicked, true);
      document.addEventListener('keydown', pickerKeys, true);
      document.addEventListener('wheel', pickerWheel, { capture: true, passive: false });
      startPicking();
    }
    api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'ESELECT_PICK') {
        openPicker();
        if (typeof sendResponse === 'function') sendResponse({ ok: true });
        else return { ok: true };
        return false;
      }
      return undefined;
    });
    return;
  }

  if (IS_MANAGER) {
    // This page is extension-owned. Website scripts never receive edit controls.
    const $ = id => document.getElementById(id);
    let rules = [];
    let currentHost = '';
    const params = new URLSearchParams(location.search);
    const incomingSite = params.get('site') || '';
    const setStatus = (message, bad = false) => {
      $('status').textContent = message;
      $('status').dataset.error = bad ? '1' : '0';
    };
    function el(tag, attrs = {}, parent) {
      const node = document.createElement(tag);
      for (const [key, val] of Object.entries(attrs)) {
        if (key === 'text') node.textContent = val;
        else node.setAttribute(key, String(val));
      }
      if (parent) parent.append(node);
      return node;
    }
    function groupedHosts() { return [...new Set(rules.map(rule => rule.host))].sort(); }
    async function refresh() {
      rules = await readRules();
      const stored = await api.storage.local.get(MENU_KEY);
      $('contextEnabled').checked = stored[MENU_KEY] === true;
      if (!currentHost || !groupedHosts().includes(currentHost)) {
        currentHost = hostOf(incomingSite) || groupedHosts()[0] || '';
      }
      render();
    }
    function render() {
      const hosts = $('hosts');
      hosts.replaceChildren();
      const query = $('search').value.trim().toLowerCase();
      for (const host of groupedHosts().filter(value => value.includes(query))) {
        const count = rules.filter(rule => rule.host === host).length;
        const button = el('button', { type: 'button', class: host === currentHost ? 'selected' : '' }, hosts);
        el('span', { text: host }, button);
        el('small', { text: `${count}` }, button);
        button.addEventListener('click', () => { currentHost = host; render(); });
      }
      if (!hosts.children.length) el('p', { text: 'No saved sites yet.' }, hosts);
      $('selectedSite').textContent = currentHost || 'Select a website';
      const rows = $('rules');
      rows.replaceChildren();
      for (const rule of rules.filter(value => value.host === currentHost)) {
        const row = el('div', { class: 'rule-row' }, rows);
        const top = el('div', { class: 'rule-top' }, row);
        const checkbox = el('input', { type: 'checkbox', title: 'Enable or disable rule' }, top);
        checkbox.checked = rule.enabled;
        const desc = el('div', { class: 'rule-description' }, top);
        el('strong', { text: rule.label || 'Hidden element' }, desc);
        const scopeText = rule.scope === 'exact'
          ? `${rule.host}${rule.path}${rule.query} · exact URL`
          : rule.scope === 'path'
            ? `${rule.host}${rule.path} · section and subpages`
            : `${rule.host} · entire website`;
        el('small', { text: scopeText }, desc);
        const edit = el('button', { type: 'button', class: 'action', text: 'Edit' }, top);
        const del = el('button', { type: 'button', class: 'danger', text: 'Delete' }, top);
        const selector = el('code', { text: rule.selector, title: rule.selector }, row);
        void selector;
        edit.addEventListener('click', () => {
          if (row.querySelector('.rule-edit')) return;
          const form = el('form', { class: 'rule-edit' }, row);
          const input = el('input', { type: 'text', value: rule.selector, spellcheck: 'false',
            'aria-label': 'Edit CSS selector' }, form);
          const save = el('button', { type: 'submit', class: 'action primary', text: 'Save selector' }, form);
          const cancel = el('button', { type: 'button', class: 'action', text: 'Cancel' }, form);
          void save;
          cancel.addEventListener('click', () => form.remove());
          form.addEventListener('submit', event => {
            event.preventDefault();
            if (!validSelector(input.value)) { setStatus('Enter a valid CSS selector.', true); return; }
            mutate({ action: 'edit', id: rule.id, selector: input.value.trim() }).catch(() => {});
          });
          input.focus();
        });
        checkbox.addEventListener('change', async () => {
          try { await mutate({ action: 'update', id: rule.id, enabled: checkbox.checked }); }
          catch (_) { checkbox.checked = rule.enabled; }
        });
        del.addEventListener('click', () => mutate({ action: 'delete', id: rule.id }).catch(() => {}));
      }
      if (!rows.children.length) el('p', { class: 'empty', text: 'No rules for this site.' }, rows);
    }
    async function mutate(change) {
      try {
        const result = await send({ type: 'ESELECT_MUTATE', ...change });
        setStatus(result.message || 'Saved.');
        await refresh();
      } catch (error) {
        setStatus(error.message, true);
        throw error;
      }
    }
    $('search').addEventListener('input', render);
    $('contextEnabled').addEventListener('change', async event => {
      try { await send({ type: 'ESELECT_MENU', enabled: event.target.checked });
        setStatus(event.target.checked ? 'Right-click entry enabled.' : 'Right-click entry disabled.'); }
      catch (error) { event.target.checked = !event.target.checked; setStatus(error.message, true); }
    });
    $('addForm').addEventListener('submit', async event => {
      event.preventDefault();
      const host = hostOf('https://' + $('newHost').value.trim());
      const selector = $('newSelector').value.trim();
      if (!host || !validSelector(selector)) { setStatus('Enter a valid host and CSS selector.', true); return; }
      try {
        const scope = $('newScope').value;
        await send({ type: 'ESELECT_ADD', rule: { host, selector, scope,
          path: scope === 'site' ? '' : $('newPath').value.trim(),
          query: scope === 'exact' ? $('newQuery').value.trim() : '', label: 'Manual rule' } });
        currentHost = host;
        $('newSelector').value = '';
        setStatus('Rule added.');
        await refresh();
      } catch (error) { setStatus(error.message, true); }
    });
    $('export').addEventListener('click', async () => {
      const blob = new Blob([JSON.stringify({ format: 'bravefox-elementselect-v1', rules: await readRules() }, null, 2)],
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = 'BraveFox-Hidden-Elements.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    });
    $('import').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (file.size > 4 * 1024 * 1024) throw new Error('Backup is too large.');
        const parsed = JSON.parse(await file.text());
        if (parsed.format !== 'bravefox-elementselect-v1' || !Array.isArray(parsed.rules))
          throw new Error('Not a compatible BraveFox Elements backup.');
        const result = await send({ type: 'ESELECT_IMPORT', rules: parsed.rules });
        setStatus(`Merged ${result.added} new rules. Existing rules were left intact.`);
        await refresh();
      } catch (error) { setStatus(error.message, true); }
      event.target.value = '';
    });
    $('newHost').value = hostOf(incomingSite);
    // The extension-owned manager remains invisible until the background has
    // verified this tab's one-time password session.
    send({ type: 'ESELECT_AUTH_CHECK' }).then(async result => {
      if (!result.authorized) {
        await send({ type: 'ESELECT_AUTH_START', site: incomingSite });
        return;
      }
      document.documentElement.classList.add('bravefox-elementselect-unlocked');
      await refresh();
    }).catch(error => setStatus(error.message, true));
    return;
  }

  // Background context, loaded explicitly by background.js (one portable file).
  const activeAuth = new Map();
  const pendingAuth = new Map();
  let trustSource = [];
  let trustFetchedAt = 0;
  let trustPromise = null;
  const managerPage = api.runtime.getURL('html/elementselect.html');
  const passwordPage = api.runtime.getURL('html/password-protected.html');
  const isManagerSender = sender => Boolean(sender?.tab?.id >= 0 &&
    String(sender.url || '').split('?')[0] === managerPage);
  const isPasswordSender = sender => Boolean(sender?.tab?.id >= 0 &&
    String(sender.url || '').startsWith(passwordPage + '?target=element&'));
  async function sessionFor(sender) {
    if (!isManagerSender(sender)) return false;
    const id = sender.tab.id;
    if (IS_FIREFOX) return activeAuth.get(id) === true;
    const result = await api.storage.session.get(AUTH_KEY);
    return result[AUTH_KEY]?.[id] === true;
  }
  async function setSession(id) {
    if (IS_FIREFOX) { activeAuth.set(id, true); return; }
    const result = await api.storage.session.get(AUTH_KEY);
    await api.storage.session.set({ [AUTH_KEY]: { ...(result[AUTH_KEY] || {}), [id]: true } });
  }
  async function readPending() {
    if (IS_FIREFOX) return Object.fromEntries(pendingAuth);
    const result = await api.storage.session.get(AUTH_KEY + '.pending');
    return result[AUTH_KEY + '.pending'] || {};
  }
  async function savePending(map) {
    if (IS_FIREFOX) {
      pendingAuth.clear();
      for (const [id, entry] of Object.entries(map)) pendingAuth.set(id, entry);
      return;
    }
    await api.storage.session.set({ [AUTH_KEY + '.pending']: map });
  }
  async function promptManagerPassword(tabId, site) {
    const requestId = crypto.randomUUID();
    const stored = await readPending();
    const map = Object.fromEntries(Object.entries(stored).filter(([, entry]) => entry.until > now()));
    map[requestId] = { tabId, site: /^https?:/.test(site) ? site : '', until: now() + 10 * 60 * 1000 };
    await savePending(map);
    const prompt = passwordPage + '?target=element&request=' + encodeURIComponent(requestId) +
      '&compact=1&title=' + encodeURIComponent('Unlock Element Picker settings');
    await api.tabs.update(tabId, { url: prompt });
  }
  async function writeRules(rules) { await api.storage.local.set({ [KEY]: rules }); }
  let writeQueue = Promise.resolve();
  function serial(fn) {
    const job = writeQueue.then(fn, fn);
    writeQueue = job.catch(() => {});
    return job;
  }
  async function addRule(input) {
    const rule = normalizedRule(input);
    if (!rule) throw new Error('Invalid CSS rule.');
    return serial(async () => {
      const rules = await readRules();
      if (rules.length >= 5000) throw new Error('Element rule limit reached.');
      if (rules.some(old => old.host === rule.host && old.path === rule.path &&
        old.query === rule.query && old.scope === rule.scope && old.selector === rule.selector))
        return { ok: true, message: 'Rule already exists.' };
      rule.id = crypto.randomUUID();
      rules.push(rule);
      await writeRules(rules);
      return { ok: true, message: 'Element hidden.' };
    });
  }
  async function mutate(message) {
    return serial(async () => {
      const rules = await readRules();
      const index = rules.findIndex(rule => rule.id === message.id);
      if (index < 0) throw new Error('Rule no longer exists.');
      if (message.action === 'delete') rules.splice(index, 1);
      else if (message.action === 'update' && typeof message.enabled === 'boolean') rules[index].enabled = message.enabled;
      else if (message.action === 'edit' && validSelector(message.selector)) rules[index].selector = String(message.selector).trim();
      else throw new Error('Unsupported rule change.');
      await writeRules(rules);
      return { ok: true, message: message.action === 'delete' ? 'Rule deleted.' : 'Rule updated.' };
    });
  }
  async function importRules(data) {
    if (!Array.isArray(data) || data.length > 5000) throw new Error('Invalid or oversized backup.');
    const proposed = data.map(normalizedRule);
    if (proposed.some(rule => !rule)) throw new Error('Backup contains invalid rules.');
    return serial(async () => {
      const rules = await readRules();
      const existing = new Set(rules.map(rule => [rule.host, rule.scope, rule.path, rule.query, rule.selector].join('|')));
      let added = 0;
      for (const rule of proposed) {
        const key = [rule.host, rule.scope, rule.path, rule.query, rule.selector].join('|');
        if (existing.has(key)) continue;
        if (rules.length >= 5000) throw new Error('Rule limit reached.');
        existing.add(key); rules.push({ ...rule, id: crypto.randomUUID() }); added++;
      }
      if (added) await writeRules(rules);
      return { ok: true, added };
    });
  }
  async function updateMenu() {
    if (!api.contextMenus) return;
    const stored = await api.storage.local.get(MENU_KEY);
    try { await api.contextMenus.remove(MENU_ID); } catch (_) {}
    if (stored[MENU_KEY] !== true) return;
    api.contextMenus.create({ id: MENU_ID, title: 'Elementinvalitsin',
      contexts: ['page', 'selection', 'link', 'image', 'video', 'editable'] });
  }
  api.contextMenus?.onClicked?.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || tab?.id == null) return;
    // Right-clicking inside an iframe must open the picker in that frame.
    api.tabs.sendMessage(tab.id, { type: 'ESELECT_PICK' },
      { frameId: Number.isInteger(info.frameId) ? info.frameId : 0 })
      .catch(error => console.warn('[BraveFox Picker] Cannot open in frame:', error));
  });
  api.runtime.onInstalled.addListener(() => updateMenu().catch(console.warn));
  updateMenu().catch(console.warn);
  api.tabs.onRemoved.addListener(tabId => {
    activeAuth.delete(tabId);
    if (IS_FIREFOX) {
      for (const [requestId, entry] of pendingAuth) {
        if (entry.tabId === tabId) pendingAuth.delete(requestId);
      }
      return;
    }
    api.storage.session.get([AUTH_KEY, AUTH_KEY + '.pending']).then(stored => {
      const sessions = stored[AUTH_KEY] || {};
      delete sessions[tabId];
      const pending = stored[AUTH_KEY + '.pending'] || {};
      for (const [requestId, entry] of Object.entries(pending)) {
        if (entry.tabId === tabId) delete pending[requestId];
      }
      return api.storage.session.set({ [AUTH_KEY]: sessions, [AUTH_KEY + '.pending']: pending });
    }).catch(() => {});
  });

  async function handle(message, sender) {
    if (message.type === 'ESELECT_START') {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const tab = tabs.find(value => /^https?:/.test(value.url || ''));
      if (!tab?.id) throw new Error('Open an ordinary website tab first.');
      await api.tabs.sendMessage(tab.id, { type: 'ESELECT_PICK' }, { frameId: 0 });
      return { ok: true };
    }
    if (message.type === 'ESELECT_MANAGE') {
      if (!/^https?:/.test(sender?.url || sender?.tab?.url || ''))
        throw new Error('Manager can only be opened from a website.');
      const tab = await api.tabs.create({ url: 'about:blank' });
      await promptManagerPassword(tab.id, message.site || sender.url || '');
      return { ok: true };
    }
    if (message.type === 'ESELECT_AUTH_CHECK') {
      if (!isManagerSender(sender)) throw new Error('Not an Element Picker manager page.');
      return { ok: true, authorized: await sessionFor(sender) };
    }
    if (message.type === 'ESELECT_ADD') {
      const rule = normalizedRule(message.rule);
      if (!rule) throw new Error('Invalid rule.');
      if (isManagerSender(sender)) {
        if (!(await sessionFor(sender))) throw new Error('Element Picker settings are locked.');
      } else {
        const source = /^https?:/.test(sender?.url || '') ? new URL(sender.url) : null;
        if (!source || hostOf(source.href) !== rule.host ||
          (rule.scope === 'path' && !pathMatches(source.pathname, rule.path, rule.host)) ||
          (rule.scope === 'exact' && (!exactPathMatches(source.pathname, rule.path, rule.host) ||
            source.search !== rule.query)))
          throw new Error('Rule scope does not match the current website.');
      }
      return addRule(rule);
    }
    if (message.type === 'ESELECT_MUTATE') {
      if (!(await sessionFor(sender))) throw new Error('Element Picker settings are locked.');
      return mutate(message);
    }
    if (message.type === 'ESELECT_IMPORT') {
      if (!(await sessionFor(sender))) throw new Error('Element Picker settings are locked.');
      return importRules(message.rules);
    }
    if (message.type === 'ESELECT_MENU') {
      if (!(await sessionFor(sender))) throw new Error('Element Picker settings are locked.');
      await api.storage.local.set({ [MENU_KEY]: message.enabled === true });
      await updateMenu();
      return { ok: true };
    }
    if (message.type === 'ESELECT_AUTH_START') {
      if (!isManagerSender(sender)) throw new Error('Unauthorized authentication request.');
      await promptManagerPassword(sender.tab.id, String(message.site || ''));
      return { ok: true, redirected: true };
    }
    if (message.type === 'ESELECT_AUTH_APPROVE') {
      if (!isPasswordSender(sender)) throw new Error('Unauthorized password approval.');
      const requestId = new URL(sender.url).searchParams.get('request');
      if (!requestId || requestId !== message.request) throw new Error('Mismatched password request.');
      const map = await readPending();
      const request = map[requestId];
      if (!request || request.until < now() || request.tabId !== sender.tab.id)
        throw new Error('Password request expired.');
      delete map[requestId];
      await savePending(map);
      await setSession(sender.tab.id);
      await api.tabs.update(sender.tab.id, { url: managerPage + '?site=' + encodeURIComponent(request.site) });
      return { ok: true };
    }
    throw new Error('Unknown Element Picker request.');
  }
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string' || !message.type.startsWith('ESELECT_')) return undefined;
    if (IS_FIREFOX) return handle(message, sender).catch(replyError);
    handle(message, sender).then(sendResponse, error => sendResponse(replyError(error)));
    return true;
  });
})();
