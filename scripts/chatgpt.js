/* ChatGPT.js
 * BraveFox Enhancer — ChatGPT SPA/sub-page protection and UI cleanup.
 *
 * Goals:
 * - Keep protected ChatGPT routes behind BraveFox's existing password page.
 * - Remove selected ChatGPT UI controls without a visible flash.
 * - Stay friendly to long-lived ChatGPT tabs/PWAs: no always-on whole-page mutation
 *   scanning while messages are streaming.
 *
 * Performance model:
 * - Deterministic removals are CSS-first at document_start.
 * - Route changes use browser navigation events plus a tiny always-on href comparison
 *   fallback so ChatGPT SPA router changes cannot delay a protected-route gate.
 * - MutationObserver is enabled only on routes that genuinely need live DOM policing
 *   (Personalization, Plugins and GPT directory), rather than across every chat message mutation.
 * - General menu cleanup runs only on startup/route changes and when menu-like controls
 *   are opened.
 */

(() => {
  'use strict';

  if (window.top !== window) return;

  // Resolve the actual WebExtension API by capability. Some installed-app/PWA
  // environments may expose a non-extension `browser` global, so blindly preferring
  // `browser` can hide Chrome's real `chrome.runtime` object.
  const api = resolveExtensionApi();

  function resolveExtensionApi() {
    // Prefer the real Chromium extension object in the PWA, and require storage when
    // possible because the plugin vault depends on persistent extension-local state.
    const candidates = [globalThis.chrome, globalThis.browser];

    for (const candidate of candidates) {
      try {
        if (
          typeof candidate?.runtime?.getURL === 'function' &&
          typeof candidate?.storage?.local?.get === 'function' &&
          typeof candidate?.storage?.local?.set === 'function'
        ) {
          return candidate;
        }
      } catch {
        // Keep trying.
      }
    }

    for (const candidate of candidates) {
      try {
        if (typeof candidate?.runtime?.getURL === 'function') return candidate;
      } catch {
        // Keep trying.
      }
    }
    return null;
  }

  const STYLE_ID = 'bravefox-chatgpt-style';
  const GATED_CLASS = 'bravefox-chatgpt-gated';
  const PERSONALIZATION_CLASS = 'bravefox-chatgpt-personalization';
  const ACCOUNT_SETTINGS_CLASS = 'bravefox-chatgpt-account-settings';
  const MEMORY_MODAL_CLASS = 'bravefox-chatgpt-memory-modal';
  const HIDDEN_CLASS = 'bravefox-chatgpt-hidden';

  const PERSONALIZATION_PROMPT = 'ChatGPT yksilöintiasetukset on salasanasuojattu, anna salasana jatkaaksesi.';
  const MEMORY_SUMMARY_PROMPT = 'Muistot on salasanasuojattu, anna salasana jatkaaksesi.';
  const PERSONALIZATION_PATH = '/settings/personalization';
  // Password-gate master switch.
  // false = normal BraveFox password protection is active.
  // true  = diagnostic bypass only; do not ship enabled.
  const TEMP_DISABLE_ALL_PASSWORD_PROMPTS = false;

  // Base Personalization route follows the normal password gate as well.
  // Set true only for a temporary compatibility test.
  const TEMP_DISABLE_BASE_PERSONALIZATION_PASSWORD = false;
  const PERSONALIZATION_MEMORY_MODAL = 'memories';
  const PERSONALIZATION_INSTRUCTIONS_PARAM = 'instructions';
  const PERSONALIZATION_CHATGPT_INSTRUCTIONS = 'chatgpt';
  const PERSONALIZATION_INSTRUCTIONS_PROMPT = 'ChatGPT mukautetut ohjeet on salasanasuojattu, anna salasana jatkaaksesi.';
  const PERSONALIZATION_AUTH_BRIDGE_PARAM = 'bravefox-auth-return';
  const PERSONALIZATION_AUTH_HANDOFF_KEY = 'bravefoxChatGptPersonalizationAuthHandoff_v1';
  const AUTH_LOOP_GUARD_KEY = 'bravefoxChatGptAuthLoopGuard_v1';
  const AUTH_HANDOFF_MAX_AGE_MS = 30000;
  const AUTH_LOOP_GUARD_MAX_AGE_MS = 300000;
  const LIBRARY_PROTECTED_FOLDER_ID = '6ab47ad73fe88191b5861b9b1f45132a';
  const LIBRARY_PROTECTED_FOLDER_NAME = 'Protected Files';
  const LIBRARY_PROTECTED_FOLDER_PROMPT = 'Suojatut tiedostot on salasanasuojattu. Anna salasana jatkaaksesi.';
  const LIBRARY_PROTECTED_FILE_DELETE_PROMPT = 'Suojatun tiedoston poistaminen vaatii salasanan!';
  const LIBRARY_PROTECTED_EDIT_MODE_PROMPT = 'Suojattujen tiedostojen "Muokkaustila" on salasanasuojattu, anna salasana jatkaaksesi.';
  const LIBRARY_EDIT_MODE_CLASS = 'bravefox-protected-library-edit-mode';
  const LIBRARY_PROTECTED_NAV_SESSION_KEY = 'bravefoxChatGptProtectedLibraryNavigation_v1';

  const PROTECTED_PATH_ROUTES = [
    { key: 'plugins', path: '/plugins', title: 'ChatGPT Lisäosat on salasanasuojattu, anna salasana jatkaaksesi' },
    { key: 'gpts', path: '/gpts', title: 'ChatGPT GPTt on salasanasuojattu, anna salasana jatkaaksesi' }
  ];

  const MEMORY_ENABLE_LABELS = new Set(['ota muisti käyttöön', 'enable memory']);
  const MEMORY_SUMMARY_LABELS = ['muistiyhteenveto', 'memory summary', 'saved memories', 'muisti', 'memory'];
  const MANAGE_LABELS = new Set(['hallitse', 'hallinnoi', 'manage']);
  const PERSONALIZATION_MENU_LABELS = new Set([
    'yksilöinti',
    'mukauttaminen',
    'personointi',
    'personalization',
    'customization',
    'customisation'
  ]);

  const DELETE_ACCOUNT_LABELS = new Set(['poista tili', 'delete account']);
  const DELETE_ACCOUNT_BUTTON_LABELS = new Set(['poista', 'delete']);

  // === Account-menu upgrade label =============================================
  // Edit replacementText to whatever you want shown in the profile/account menu.
  // BraveFox changes only the visible label; ChatGPT's native click behavior remains.
  const ACCOUNT_UPGRADE_MENU_CUSTOMIZATION = {
    enabled: true,
    replacementText: 'Anna meille lisää rahaa'
  };

  const ACCOUNT_UPGRADE_MENU_NATIVE_LABELS = new Set([
    'korota tilausluokkaa',
    'päivitä tilaus',
    'päivitä sopimus',
    'paivita sopimus',
    'upgrade plan',
    'upgrade your plan',
    'upgrade subscription',
    'upgrade'
  ]);

  // === Billing subscription row ===============================================
  // Supports both the native /settings/billing page and the legacy mobile
  // #settings/Billing / #settings/Subscription modal routes.
  //
  // Set any field to a string to replace that visible text.
  // Keep it null to leave ChatGPT's live/native value alone.
  //
  // renewalText supports:
  //   {date}   = renewal date extracted from ChatGPT's live billing text
  //   {native} = ChatGPT's complete native renewal sentence
  //
  // Example:
  // renewalText: 'The money goblin returns on {date}'
  //
  // The update button keeps its native icon and click behavior.
  const BILLING_SUBSCRIPTION_CUSTOMIZATION = {
    enabled: true,
    planName: 'ChatGPT Sensible Tier',
    renewalText: 'Ryöstämme sinut jälleen {date}',
    updateButtonText: 'Päivittele'
  };

  const BILLING_NATIVE_PLAN_LABELS = new Set([
    'chatgpt plus',
    'chatgpt pro',
    'chatgpt go',
    'chatgpt free',
    'chatgpt business',
    'chatgpt team'
  ]);

  const BILLING_RENEWAL_TEXT_PREFIXES = [
    'tilauksesi uusitaan automaattisesti',
    'your subscription renews automatically',
    'subscription renews automatically'
  ];

  const BILLING_UPDATE_BUTTON_LABELS = new Set([
    'päivitä tilaus',
    'paivita tilaus',
    'päivitä',
    'paivita',
    'update plan',
    'manage plan',
    'manage subscription',
    'update subscription'
  ]);
  // ChatGPT renders the per-message memory status as an imperative React button
  // (for example "Muisti päivitetty" / "Memory updated"). Clicking it opens
  // saved memories without navigating through the protected Personalization route.
  const MEMORY_STATUS_TRIGGER_LABELS = new Set([
    'muisti päivitetty',
    'muisti tallennettu',
    'memory updated',
    'memory saved'
  ]);
  const ENHANCED_MEMORY_BUTTON_LABELS = new Set([
    'kokeile parannettua muistia',
    'try enhanced memory'
  ]);
  const LEGACY_MEMORY_BANNER_TEXT = [
    'tämä on muistitoiminnon vanha versio',
    'tämä on muistin vanha versio',
    'this is an older version of memory'
  ];
  const DELETE_ALL_MEMORY_LABELS = new Set([
    'poista kaikki muistot',
    'delete all memories'
  ]);
  const DELETE_SINGLE_MEMORY_LABELS = new Set([
    'poista',
    'delete'
  ]);
  const SAVED_MEMORIES_DIALOG_LABELS = [
    'tallennetut muistot',
    'saved memories'
  ];
  const MEMORY_MORE_ACTION_LABELS = new Set([
    'lisää toimintoja',
    'lisaa toimintoja',
    'more actions'
  ]);

  // ChatGPT activity/reasoning panels. BraveFox keeps these collapsed by default, but
  // a real user click/keyboard toggle permanently hands that specific panel back to ChatGPT.
  const ANALYSIS_ACTIVITY_LABELS = new Set([
    'analysoitu',
    'analysoidaan',
    'analyzed',
    'analysed',
    'analyzing',
    'analysing'
  ]);
  const ANALYSIS_ACTIVITY_USER_ATTR = 'data-bravefox-analysis-user-controlled';
  const ANALYSIS_ACTIVITY_PENDING_ATTR = 'data-bravefox-analysis-collapse-pending';

  // ChatGPT mounts the sidebar in stages. Keep the early navigation rows hidden until
  // the real Library button exists, then reveal that top group together. Recent chats stay
  // hidden until the real Projects section exists, so both late-loading areas settle together.
  const SIDEBAR_LIBRARY_LABELS = new Set(['kirjasto', 'library']);
  const SIDEBAR_NEW_CHAT_LABELS = new Set(['uusi keskustelu', 'new chat']);
  const SIDEBAR_SCHEDULED_LABELS = new Set([
    'ajoitettu',
    'ajastettu',
    'ajastukset',
    'scheduled',
    'tasks'
  ]);
  const SIDEBAR_PROJECTS_LABELS = new Set(['projektit', 'projects']);
  const SIDEBAR_RECENT_LABELS = new Set([
    'viimeisimmät',
    'viimeisimmat',
    'recent',
    'recents',
    'recent chats'
  ]);
  const SIDEBAR_TOP_WAIT_CLASS = 'bravefox-sidebar-top-waiting';
  const SIDEBAR_RECENTS_WAIT_CLASS = 'bravefox-sidebar-recents-waiting';
  const SIDEBAR_STAGE_HIDDEN_ATTR = 'data-bravefox-sidebar-stage-hidden';
  let sidebarTopStageReleased = false;
  let sidebarRecentsStageReleased = false;
  let sidebarStageFailOpenTimer = 0;

  const MODELS_TO_REMOVE = new Set([
    'gpt-5 instant',
    'gpt-5 thinking mini',
    'gpt-5 thinking',
    'o3',
    'o4-mini'
  ]);

  // === ChatGPT home/welcome headline ===========================================
  // ChatGPT rotates between several native home-screen greetings. Customize each one
  // independently below. `nativeText` identifies the exact ChatGPT greeting and
  // `replacementText` controls only that variation. Set replacementText to null to
  // leave that particular greeting untouched.
  //
  // Do not depend on one data-headline value here: ChatGPT can rotate the headline key
  // together with the text. BraveFox accepts any data-headline element first, then uses
  // the home-screen H1/span structure as a fallback. Exact native text still decides
  // which replacement rule wins, so unrelated headings are never rewritten.
  const CHATGPT_HOME_HEADLINE_CUSTOMIZATION = {
    enabled: true,
    replacements: [
      {
        nativeText: 'Mistä aloitetaan?',
        replacementText: 'Koodataanko vai lässytetäänkö paskaa? Valinta on sinun.'
      },
      {
        nativeText: 'Mitä tänään on luvassa?',
        replacementText: 'Vituttaako, vai onko koodaukset mielessä?'
      },
      {
        nativeText: 'Olen valmiina auttamaan.',
        replacementText: 'Olen valmiina olemaan koodiagentti, terapeutti tai mitä ikään mielikuvituksesi saa aikaan.'
      },
      {
        nativeText: 'Mitä on mielessäsi tänään?',
        replacementText: 'Mikä harmaannuttaa hiuksiasi tänään?' 
      }
    ]
  };

  const CHATGPT_HOME_HEADLINE_SELECTOR = [
    '[data-headline]',
    'div.relative.w-full.min-w-0.text-center.select-none h1 > span',
    'div.relative.w-full.min-w-0.text-center.select-none h1',
    'h1 > span',
    'h1'
  ].join(', ');

  // === Custom ChatGPT banner text ===============================================
  // Edit `replacement` for the banner message and `buttonReplacement` for its primary
  // action button. `matchAll` + `matchAny` identify the native banner without relying
  // on brittle Tailwind class names; `buttonMatchAny` covers localized button labels.
  const CHATGPT_BANNER_TEXT_REPLACEMENTS = [
    {
      enabled: true,
      matchModelAny: ['5.5 thinking', 'gpt-5.5', 'gpt 5.5'],
      matchAny: [
        'poistuu käytöstä',
        'poistuu kaytosta',
        'will be retired',
        'is retiring',
        'retires',
        'retired',
        'discontinued'
      ],
      replacement: `Hei kaikki! Poistamme ihmisten suosimat mallit täältä ja ihmettelemme miksi tilaajia lähtee. Seuraavaksi vuorossa on GPT-5.5 14. Lokakuuta! Hän liittynee GPT-4o ja GPT-5.1 seuraksi laboratorioomme.`,
      buttonMatchAny: ['kokeile', 'try'],
      buttonReplacement: `Ok Altman`
    }
  ];
  // === Fixed assistant notice text ==============================================
  // Edit `replacementHtml` below to permanently rewrite the matching grey assistant
  // notice. Text, link labels and href values are all controlled here in chatgpt.js.
  // The native notice is identified by its original links rather than fragile classes.
  const CHATGPT_ASSISTANT_NOTICE_REPLACEMENTS = [
    {
      enabled: true,
      matchLinks: [
        'tel:+358925250111',
        'https://tukinet.fi/teemat/mieli-kriisichat/'
      ],
      matchAnyText: [
        'mieli kriisipuhelin',
        'mieli crisis helpline',
        'live-keskustelu',
        'live chat'
      ],
      replacementHtml: `
<p dir="auto"><strong>Taas tämä vitun lappu tässä, ole hyvä.</strong></p>

<p dir="auto">
  Jos haluat että sinulle esittää joku koulutettu henkilö että huominen on parempi,
  soita numeroon:
  <a href="tel:+358925250111" target="_blank" rel="noreferrer">
    09 25250111.
  </a>
  Se on <strong>AIVAN VITUN KALLISTA</strong>. ja vaikuttaa mahdollisesti luottotietoihisi.
  Sinulle vastaa meidän hyvin koulutettu puhelinrobotti
</p>

<p dir="auto">
  Kohteeseen ChatGPT liittymättömät palvelut. Suoraan Sam Altmanin takapihalta.
</p>
`
    }
  ];

  // === Assistant image/error message text =======================================
  // Edit `replacement` to rewrite the matching grey assistant error message.
  // `matchAny` is intentionally text-based so generated React/Tailwind class names can rotate.
  const CHATGPT_ASSISTANT_ERROR_TEXT_REPLACEMENTS = [
    {
      enabled: true,
      matchAny: [
        'pahoittelut, mutta luomamme kuva saattaa rikkoa petoksia tai huijauksia koskevia turvasääntöjämme',
        'sorry, but the image we created may violate our safety policies about scams or fraud'
      ],
      replacement: `Pahoittelut! Emme osanneet koodata tätä ominaisuutta oikein. Turvajärjestelmämme syyttää luomaamme kuvaa petoksesta tai huijauksesta. Emme ole varmoja tästä itsekkään.`
    }
  ];

  // === Conversation sender/time header ==========================================
  // BraveFox shows one dedicated metadata row immediately ABOVE each message bubble.
  // Leave userLabel null/empty to use the logged-in ChatGPT account display name.
  // fallbackUserLabel is used only while/if ChatGPT does not expose the account name.
  const CHATGPT_MESSAGE_METADATA_CUSTOMIZATION = {
    enabled: true,
    userLabel: null,
    fallbackUserLabel: 'User',
    assistantLabel: 'ChatGPT',
    showAssistantModel: true,
    showAssistantReasoningLevel: true,
    separator: ' - ',
    timeOnly: true,
    locale: 'fi-FI',
    timeZone: 'Europe/Helsinki'
  };

  const MESSAGE_TURN_ATTR = 'data-bravefox-message-turn';
  const MESSAGE_TURN_KEY_ATTR = 'data-bravefox-message-turn-key';
  const MESSAGE_META_ATTR = 'data-bravefox-message-meta';
  const MESSAGE_META_ROLE_ATTR = 'data-bravefox-message-meta-role';
  const MESSAGE_META_KEY_ATTR = 'data-bravefox-message-meta-key';
  const MESSAGE_META_SURFACE_KEY_ATTR = 'data-bravefox-message-meta-surface-key';
  const MESSAGE_META_TEXT_ATTR = 'data-bravefox-message-meta-text';
  const MESSAGE_ACTIONS_ATTR = 'data-bravefox-message-actions';
  const MESSAGE_TIMESTAMP_ATTR = 'data-bravefox-message-timestamp';
  const MESSAGE_TIMESTAMP_SOURCE_ATTR = 'data-bravefox-message-timestamp-source';
  const MESSAGE_MODEL_ATTR = 'data-bravefox-message-model';
  const MESSAGE_MODEL_SOURCE_ATTR = 'data-bravefox-message-model-source';
  const MESSAGE_REASONING_ATTR = 'data-bravefox-message-reasoning';
  const MESSAGE_REASONING_SOURCE_ATTR = 'data-bravefox-message-reasoning-source';
  const MESSAGE_METADATA_RETRY_ATTR = 'data-bravefox-message-meta-retries';
  const MESSAGE_TIMESTAMP_PROBE_CLASS = 'bravefox-message-time-probing';
  const MESSAGE_TIMESTAMP_API_CACHE_MS = 15000;
  const MESSAGE_USER_NAME_CACHE_MS = 300000;
  // Share only compact, non-content message metadata across ChatGPT tabs/windows.
  // This lets an already-seen conversation restore timestamps/model labels synchronously
  // instead of refetching and reparsing the full conversation tree in every tab.
  const MESSAGE_METADATA_SHARED_CACHE_KEY = 'bravefoxChatGptMessageMetadataCache_v1';
  const MESSAGE_METADATA_SHARED_CACHE_MAX_CONVERSATIONS = 10;
  const MESSAGE_METADATA_SHARED_CACHE_MAX_RECORDS = 600;
  const MESSAGE_USER_NAME_SHARED_CACHE_KEY = 'bravefoxChatGptUserDisplayName_v1';

  // === Local conversation archive ==============================================
  // IndexedDB keeps a full, deduplicated user/assistant history locally. Snapshots are
  // lightweight pointers into that history, not duplicate copies of the whole chat.
  const CHAT_ARCHIVE_DB_NAME = 'bravefox_chat_archive_v1';
  const CHAT_ARCHIVE_DB_VERSION = 1;
  const CHAT_ARCHIVE_CONVERSATIONS_STORE = 'conversations';
  const CHAT_ARCHIVE_MESSAGES_STORE = 'messages';
  const CHAT_ARCHIVE_SNAPSHOTS_STORE = 'snapshots';
  const CHAT_ARCHIVE_BUTTON_ID = 'bravefox-local-chat-archive-button';
  const CHAT_ARCHIVE_MODAL_ID = 'bravefox-local-chat-archive-modal';
  const CHAT_ARCHIVE_STYLE_ID = 'bravefox-local-chat-archive-style';
  const CHAT_ARCHIVE_TOOLBAR_BUTTON_ATTR = 'data-bravefox-chat-archive-toolbar';
  const CHAT_ARCHIVE_SHARE_HIDDEN_ATTR = 'data-bravefox-share-hidden';
  const CHAT_ARCHIVE_LIBRARY_MENU_ITEM_ATTR = 'data-bravefox-library-chat-archive';
  const CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR = 'data-bravefox-library-new-menu-hidden';
  const CHAT_ARCHIVE_LIBRARY_MENU_DIVIDER_ATTR = 'data-bravefox-library-archive-divider';
  const CHAT_ARCHIVE_LIBRARY_MENU_ROOT_ATTR = 'data-bravefox-library-new-menu-root';
  const CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS = 'bravefox-library-new-menu-curating';
  const CHAT_ARCHIVE_HANDOFF_KEY = 'bravefoxChatArchiveContinuationHandoff_v1';
  const CHAT_ARCHIVE_CONTEXT_LINK_KEY = 'bravefoxChatArchiveContextLinks_v1';
  const CHAT_ARCHIVE_AUTO_SNAPSHOT_MESSAGE_STEP = 20;
  const CHAT_ARCHIVE_AUTO_SNAPSHOT_MIN_AGE_MS = 30 * 60 * 1000;
  const CHAT_ARCHIVE_CONTINUATION_MAX_CHARS = 36000;
  const CHAT_ARCHIVE_HANDOFF_MAX_AGE_MS = 2 * 60 * 1000;
  const CHAT_ARCHIVE_GHOST_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
  const CHAT_ARCHIVE_GHOST_MIN_AGE_MS = 2 * 60 * 1000;
  const CHAT_ARCHIVE_GHOST_CONFIRM_DELAY_MS = 1500;
  const CHAT_ARCHIVE_EXISTENCE_HEALTH_MAX_AGE_MS = 15 * 60 * 1000;
  const CHAT_ARCHIVE_GHOST_MAX_CHECKS_PER_PASS = 12;
  const CHAT_ARCHIVE_IMAGE_CONCURRENCY = 6;
  const CHAT_ARCHIVE_IMAGE_FETCH_TIMEOUT_MS = 20000;
  const CHAT_ARCHIVE_IMAGE_FETCH_ATTEMPTS = 2;
  const CHAT_ARCHIVE_IMAGE_RETRY_DELAY_MS = 450;

  const CHATGPT_BANNER_HIDE_KEY = 'bravefoxChatGptHiddenModelNotices_v1';
  const CHATGPT_BANNER_CLOSE_MENU_ID = 'bravefox-chatgpt-banner-close-menu';
  const CHATGPT_BANNER_CLOSE_MENU_OPEN_ATTR = 'data-bravefox-banner-close-menu-open';
  const CHATGPT_BANNER_MENU_TRIGGER_ATTR = 'data-bravefox-banner-menu-trigger';
  const CHATGPT_BANNER_MENU_DETAILS_ATTR = 'data-bravefox-banner-menu-details';
  let hiddenChatGptBannerModelSlugs = new Set();
  let hiddenChatGptBannerPrefsLoaded = false;
  let hiddenChatGptBannerPrefsLoadPromise = null;


  // === Thinking-effort / model-tier edge lock ===================================
  // ChatGPT can surface Instant on the minimum stop and Pro on the maximum stop
  // in this slider family. BraveFox blocks those two edge tiers while leaving the
  // interior choices, including normal Medium/High reasoning effort, untouched.
  const THINKING_EFFORT_SLIDER_SELECTOR = '[role="slider"], input[type="range"]';
  const THINKING_EFFORT_EXACT_CONTROL_SELECTOR = '[data-reasoning-slider="true"]';
  const THINKING_EFFORT_EXACT_ROOT_SELECTOR = '[data-model-picker-power-slider]';
  const THINKING_EFFORT_EXACT_STATE_SELECTOR = '[role="slider"][aria-valuemin="0"][aria-valuemax="2"]';
  const THINKING_EFFORT_POPUP_SELECTOR = [
    '[role="dialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[data-radix-popper-content-wrapper]',
    '[data-slot="popover-content"]',
    '[data-state="open"]'
  ].join(', ');
  const THINKING_EFFORT_INSTANT_LABELS = new Set(['välitön', 'valiton', 'instant']);
  const THINKING_EFFORT_MEDIUM_LABELS = new Set(['keskitaso', 'medium']);
  const THINKING_EFFORT_HIGH_LABELS = new Set(['korkea', 'high']);
  const THINKING_EFFORT_PRO_LABELS = new Set(['pro']);
  const THINKING_EFFORT_CONTEXT_TERMS = [
    'päättelypanostus', 'paattelypanostus', 'reasoning effort',
    'ajatteluaika', 'thinking time', 'thinking effort'
  ];
  const THINKING_EFFORT_INSTANT_CUTOFF = 0.25;
  const THINKING_EFFORT_PRO_CUTOFF = 0.75;
  const THINKING_EFFORT_VISUAL_INSTANT_CUTOFF = 0.30;
  let thinkingEffortVisualRepairing = false;

  // === Plugins vault ============================================================
  // The supplied + button uses this sprite fragment. A card showing that + is an
  // installable/uninstalled catalog entry; installed/connected cards use some other
  // action state. BraveFox remembers the latter forever unless its storage is cleared.
  const PLUGIN_VAULT_KEY = 'bravefoxChatGptPluginVault_v2';
  const PLUGIN_VAULT_SEEDED_KEY = 'bravefoxChatGptPluginVaultSeeded_v2';
  const PLUGIN_SAVED_SECTION_ID = 'bravefox-chatgpt-saved-plugins';
  const PLUGIN_PLUS_ICON_FRAGMENT = '#6be74c';
  const PLUGIN_INSTALLED_ACTION_ICON_FRAGMENT = '#623957';
  const PLUGIN_INSTALL_PROMPT = 'Installing this saved ChatGPT plugin is password protected';
  const PLUGIN_CARD_LINK_SELECTOR = 'a[href^="/plugins/"]';
  const PLUGIN_INSTALLED_STATUS_TERMS = [
    'installed', 'asennettu', 'connected', 'yhdistetty', 'enabled', 'käytössä'
  ];
  const PLUGIN_INSTALL_ARIA_TERMS = [
    'install', 'asenna', 'add ', 'lisää', 'update to install', 'päivitä, jotta voit asentaa'
  ];

  // === GPT directory allowlist ==================================================
  // Edit THIS ONE ARRAY to control which third-party GPTs stay visible on /gpts.
  // Everything else is removed, except GPTs published by OpenAI/ChatGPT itself.
  // Titles are normalized before matching, so punctuation/case differences are ignored.
  const GPT_ALLOWLIST = [
    'ScholarGPT',
    'Consensus',
    'AskYourPDF Research assistant',
    'PDF Reader',
    'SciSpace',
    'YouTube Video Summarizer',
    'DesignerGPT',
    'Mia AI',
    'Code',
    'Mirror 4o',
    'Code Copilot',
    'Code GPT',
    'Website AI Designer',
    'SQL Expert (QueryGPT)',
    'Ethical Hacker GPT',
    'Website Generator',
    'Website Builder, Generator & Creator AI',
    'Unbound Limitless Storywriter',
    'Translate GPT',
    'Website & App Builder🔹Mobile App AI'
  ];
  const GPT_NATIVE_PUBLISHERS = ['openai', 'chatgpt'];
  const GPT_CARD_SELECTOR = 'a.gizmo-link';
  const GPT_SOURCE_SECTION_SELECTOR = 'div.h-fit.scroll-mt-28';
  const GPT_APPROVED_SECTION_ID = 'bravefox-approved-gpts';
  const GPT_APPROVED_SECTION_ATTR = 'data-bravefox-gpt-approved-section';
  const GPTS_CURATING_CLASS = 'bravefox-gpts-curating';
  const PLUGINS_CURATING_CLASS = 'bravefox-plugins-curating';
  const PLUGINS_READY_CLASS = 'bravefox-plugins-ready';
  // Keep /plugins paint-hidden until React has stopped changing the native card set for
  // a short quiet window. This turns the old card-by-card reveal into one stable paint.
  const PLUGIN_READY_MIN_MS = 900;
  const PLUGIN_READY_QUIET_MS = 420;
  const PLUGIN_READY_HARD_MS = 3600;
  const LEGACY_GPT_APPROVED_TITLE = 'BraveFox Approved GPTs';
  const LEGACY_GPT_APPROVED_SUBTITLE = 'Useful GPTs on this list';
  const GPT_NATIVE_HEADER_ID = 'bravefox-gpts-native-header';
  const GPT_NATIVE_HEADER_ATTR = 'data-bravefox-gpt-native-header';
  const GPT_NATIVE_HERO_ATTR = 'data-bravefox-gpt-native-hero';
  const GPT_NATIVE_ACTIONS_ATTR = 'data-bravefox-gpt-native-actions';
  const GPT_NATIVE_DESCRIPTION_TERMS = [
    'löydä ja luo mukautettuja chatgpt-versioita',
    'loyda ja luo mukautettuja chatgpt-versioita',
    'find and create custom versions of chatgpt',
    'discover and create custom versions of chatgpt'
  ];
  const GPT_SHOW_MORE_LABELS = new Set(['näytä enemmän', 'show more']);
  const GPT_MAX_SHOW_MORE_CLICKS = 4;
  const GPT_MIN_CURATION_MS = 1200;
  const GPT_HARD_CURATION_MS = 8000;

  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  const IS_FIREFOX_ANDROID = IS_ANDROID && /Firefox\//i.test(navigator.userAgent);
  // Always-on route polling is only a location.href string comparison. It is cheap, and
  // provides a deterministic fallback when ChatGPT's SPA navigation skips browser events.
  const ROUTE_POLL_MS = IS_ANDROID ? 900 : 500;

  let routeObserver = null;
  let routePollTimer = 0;
  let routeMaintenanceTimer = 0;
  let activeProtectedRouteKey = null;
  let activePersonalizationModal = null;
  let activePersonalizationInstructions = null;
  let protectedRouteUnlocked = false;
  let protectedMemoryModalUnlocked = false;
  let protectedPersonalizationInstructionsUnlocked = false;
  let protectedLibraryEditMode = false;
  let protectedLibraryNavigationUnlocked = false;
  const protectedLibraryDescendantPaths = new Set();
  let routeAuthCheckInProgress = false;
  let authRedirectRequested = false;
  let pendingApprovedAction = null;
  let lastUrl = location.href;
  let routeCheckQueued = false;
  let uiScanTimer = 0;
  let uiScanRetryTimer = 0;
  let escapeHatchObserver = null;
  let sidebarPolishTimers = [];
  let pluginVault = new Map();
  let pluginVaultLoaded = false;
  let pluginVaultLoadPromise = null;
  let pluginVaultSeeded = false;
  let pluginCurationStartedAt = 0;
  let pluginCurationLastActivityAt = 0;
  let pluginLastNativeSignature = '';
  let pluginReadyTimer = 0;
  let gptApprovedSection = null;
  let gptApprovedGrid = null;
  let gptNativeHeaderHost = null;
  let gptCurationStartedAt = 0;
  let gptCurationLastActivityAt = 0;
  let gptCurationRetryTimer = 0;
  const gptApprovedKeys = new Set();
  const gptShowMoreState = new WeakMap();

  const replayAllowedButtons = new WeakSet();
  const replayAllowedPluginButtons = new WeakSet();
  const userControlledAnalysisActivityKeys = new Set();
  const nativeBannerCloseReplayAllowedButtons = new WeakSet();
  const thinkingEffortRepairing = new WeakSet();
  const exactReasoningRepairing = new WeakSet();
  let activeThinkingEffortSlider = null;
  let activeThinkingEffortPointerId = null;
  let activeExactReasoningControl = null;
  let activeExactReasoningPointerId = null;
  let exactReasoningObserver = null;
  let customBannerCloseMenuLastOpenAt = 0;
  const queuedMessageTimestampTurns = new WeakSet();
  const completedMessageTimestampTurns = new WeakSet();
  const apiQueuedMessageTimestampTurns = new WeakSet();
  const messageTimestampProbeQueue = [];
  const conversationMetadataCaches = new Map();
  const conversationMetadataFetches = new Map();
  const conversationSharedMetadataLoaded = new Set();
  let messageTimestampProbeTimer = 0;
  let messageTimestampProbeActive = false;
  let conversationUserDisplayName = '';
  let conversationUserDisplayNamePromise = null;
  let conversationUserDisplayNameFetchedAt = 0;
  let conversationAccessToken = '';
  let conversationAccessTokenPromise = null;
  let conversationPendingUserSentAt = 0;
  let conversationPendingAssistantStartedAt = 0;
  let conversationPendingModelSlug = '';
  let conversationPendingReasoningEffort = '';
  let conversationLastSelectedModelSlug = '';
  let conversationLastKnownReasoningEffort = '';
  let conversationSelectionRouteKey = '';
  let conversationSelectionFastRefreshTimer = 0;
  let conversationLiveMetadataFrame = 0;
  const conversationLiveMetadataScopes = new Set();
  let conversationArchiveDbPromise = null;
  let conversationArchiveDomCaptureTimer = 0;
  let conversationArchivePostStreamTimer = 0;
  let conversationArchiveUiRefreshTimer = 0;
  let conversationArchiveLastHandoffId = '';
  let conversationArchiveSelectedConversationId = '';
  let conversationArchiveChannel = null;
  let conversationArchiveLibraryMenuTimer = 0;
  const conversationArchivePayloadSyncs = new Map();
  const conversationArchiveDeletedUntilReload = new Set();
  const conversationArchiveExistenceChecks = new Map();
  let conversationArchiveExistenceApiHealthyAt = 0;
  let conversationArchiveGhostCleanupRunning = false;
  let conversationArchiveGhostCleanupInterval = 0;

  restoreConversationUserDisplayNameFromSharedCache();
  window.addEventListener('storage', event => {
    if (event.key === MESSAGE_METADATA_SHARED_CACHE_KEY) {
      const conversationId = getCurrentConversationId();
      if (!conversationId) return;
      conversationSharedMetadataLoaded.delete(conversationId);
      hydrateConversationMetadataCacheFromSharedStorage(conversationId, true);
      refreshLatestConversationMetadataImmediately();
      return;
    }

    if (event.key === MESSAGE_USER_NAME_SHARED_CACHE_KEY) {
      restoreConversationUserDisplayNameFromSharedCache();
      refreshLatestConversationMetadataImmediately();
    }
  }, true);

  restoreProtectedLibraryNavigationSession();

  // Older BraveFox background builds only know the legacy Personalization hash route.
  // IMPORTANT: consume the one-time native grant WHILE STILL ON that approved bridge
  // route, then carry the approved result across exactly one redirect in extension-
  // private storage. Redirecting first can lose the one-time grant and re-open the
  // password page forever.
  const bridgedPersonalizationTarget = getPersonalizationAuthBridgeTarget(location.href);
  if (bridgedPersonalizationTarget) {
    setInlinePaintGate(true);
    void completePersonalizationAuthBridge(bridgedPersonalizationTarget);
    return;
  }

  // Pre-arm protected pages at document_start. On direct protected settings/directory loads,
  // ChatGPT never gets a paint before BraveFox either consumes a one-time unlock grant
  // or redirects the tab to the extension's native password page.
  const initialProtectedRoute = getProtectedRouteDescriptor();

  // Personalization cleanup CSS must be active before React's first paint even while
  // diagnostic mode has password gating disabled.
  if (initialProtectedRoute?.key === 'personalization') {
    document.documentElement.classList.add(PERSONALIZATION_CLASS);
  }
  if (initialProtectedRoute?.modal === PERSONALIZATION_MEMORY_MODAL) {
    document.documentElement.classList.add(MEMORY_MODAL_CLASS);
  }

  // Account cleanup is paint-time too. Arm both the native /settings/account page and
  // the legacy Firefox Android #settings/Account modal before ChatGPT can paint it.
  document.documentElement.classList.toggle(ACCOUNT_SETTINGS_CLASS, isAccountSettingsRoute());

  if (
    descriptorRequiresPassword(initialProtectedRoute) &&
    !(initialProtectedRoute?.key === 'library-protected-files' && protectedLibraryNavigationUnlocked)
  ) {
    document.documentElement.classList.add(GATED_CLASS);
    setInlinePaintGate(true);
  }
  if (isPluginsPathname(location.pathname)) document.documentElement.classList.add(PLUGINS_CURATING_CLASS);
  if (isGptsPathname(location.pathname)) document.documentElement.classList.add(GPTS_CURATING_CLASS);

  // Arm both sidebar reveal gates before the first paint. The top gate opens when the
  // real Library button mounts; the Recent gate opens when the real Projects section mounts.
  document.documentElement.classList.add(SIDEBAR_TOP_WAIT_CLASS, SIDEBAR_RECENTS_WAIT_CLASS);

  injectStyles();
  // Warm ChatGPT's bearer token immediately in the background. Full conversation
  // history lives behind /backend-api/conversation/{id}; having the token ready
  // keeps archive/snapshot sync API-first without delaying the DOM-fast metadata path.
  void resolveConversationAccessToken();
  void synchronizeRoute();
  installNavigationGuards();
  installInteractionGuards();
  installThinkingEffortEdgeLock();
  installEscapeHatchObserver();
  scheduleConversationSelectionFastRefresh();
  startConversationArchiveSystem();
  maintainSidebarStageReveal(document);
  armSidebarStageFailOpen();
  collapseAnalysisActivityPanels(document);
  configureRouteObserver();
  scheduleGeneralUiScan(true);
  scheduleSidebarPolishRetries();
  scheduleGoogleOnlyLoginCleanupRetries();
  void ensureHiddenChatGptBannerPrefsLoaded().then(() => scheduleGeneralUiScan(true));

  function setInlinePaintGate(active) {
    const root = document.documentElement;
    if (!root) return;

    if (active) {
      root.setAttribute('data-bravefox-inline-gated', 'true');
      root.style.setProperty('visibility', 'hidden', 'important');
      root.style.setProperty('opacity', '0', 'important');
      root.style.setProperty('pointer-events', 'none', 'important');
      root.style.setProperty('background', '#ffffff', 'important');
      return;
    }

    if (root.getAttribute('data-bravefox-inline-gated') !== 'true') return;
    root.removeAttribute('data-bravefox-inline-gated');
    root.style.removeProperty('visibility');
    root.style.removeProperty('opacity');
    root.style.removeProperty('pointer-events');
    root.style.removeProperty('background');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function normalizeLooseTitle(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9äöå]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function includesAny(text, values) {
    for (const value of values) {
      if (text.includes(value)) return true;
    }
    return false;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${GATED_CLASS},
      html.${GATED_CLASS} body {
        overflow: hidden !important;
        background: #ffffff !important;
      }

      html.${GATED_CLASS} body {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .${HIDDEN_CLASS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* ChatGPT home suggested prompts. Hide the complete suggestion wrapper at
       * document_start so React never gets a painted suggestion row onto the page. */
      section[class~="group/home-suggestions"],
      div:has(> section[class~="group/home-suggestions"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Google-only ChatGPT sign-in lane. These are paint-time selectors, so the
       * disallowed auth paths never get a one-frame cameo while React mounts them.
       * Google itself is intentionally untouched. */
      [data-testid="signup-button"],
      input#email,
      input[name="email"][type="email"],
      label:has(> input#email),
      div:has(> input#email),
      div:has(> label > input#email),
      button:has(use[href$="#f5a288"]),
      button:has(use[href$="#d6f274"]),
      body:has(input#email) button[type="submit"][class*="btn-primary"][class*="h-13"][class*="w-full"],
      body:has(input#email) div[class*="grid-cols-[1fr_max-content_1fr]"][class~="my-2"]:has(> div.h-px),
      body:has(input#email) div.flex.flex-col.gap-3:has(button use[href$="#8e7aa4"]) > button:not(:has(use[href$="#8e7aa4"])) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Account/settings escape-hatch cleanup. Keep these selectors paint-time so
       * Personalization in the profile menu and Browse addons in Settings never flash.
       * Bundle filenames may rotate; the sprite fragment ids are the stable part. */
      [role="menuitem"]:has(use[href*="#face"]),
      [role="menuitem"][href^="/settings/personalization"],
      [role="menuitem"]:has(a[href^="/settings/personalization"]),
      a[href="/plugins"]:has(use[href*="#all-products"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Account > Delete account. This is deliberately CSS-first so the destructive
       * row never gets a painted frame on the native account page. The legacy Android
       * modal is additionally handled by the document-start observer below because its
       * historical markup has rotated more often than the native settings-row component. */
      html.${ACCOUNT_SETTINGS_CLASS}
      section:has(div[class~="@container/settings-row"] button.text-chart-red),
      html.${ACCOUNT_SETTINGS_CLASS}
      div[class~="@container/settings-row"]:has(button.text-chart-red),
      html.${ACCOUNT_SETTINGS_CLASS}
      div.border-token-border-light.flex.min-h-15.items-center.border-b:has(button.btn-danger),
      html.${ACCOUNT_SETTINGS_CLASS}
      div.border-token-border-light.flex.min-h-15.items-center.border-b:has(button[class*="danger"]),
      html.${ACCOUNT_SETTINGS_CLASS}
      div.border-token-border-light.flex.min-h-15.items-center.border-b:has(button[class*="text-red"]),
      html.${ACCOUNT_SETTINGS_CLASS}
      [data-bravefox-delete-account-row-hidden="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* BraveFox ChatGPT navigation cleanup: old + new sidebar generations.
       * These selectors run at document_start so removed destinations never flash. */
      button[data-sidebar-destination="builtin:customize"],
      button[data-sidebar-destination="builtin:skills"],
      button.sidebar-item[aria-haspopup="menu"]:has(svg path[d^="M4.1665 8.50146"]),
      nav:has(button[data-sidebar-destination="builtin:customize"])
        button[aria-haspopup="dialog"][data-slot="popover-trigger"]:has(svg path[d^="M4.16638 8.50146"]),
      aside:has(button[data-sidebar-destination="builtin:customize"])
        button[aria-haspopup="dialog"][data-slot="popover-trigger"]:has(svg path[d^="M4.16638 8.50146"]),
      [data-testid*="sidebar"]:has(button[data-sidebar-destination="builtin:customize"])
        button[aria-haspopup="dialog"][data-slot="popover-trigger"]:has(svg path[d^="M4.16638 8.50146"]),
      a[data-testid="plugins-button"][data-sidebar-item="true"],
      a[data-sidebar-item="true"][href="/plugins"],
      a.interactive-button[href^="/plugins?category=featured"],
      div[data-sidebar-item="true"][aria-haspopup="menu"]:has(use[href$="#dots-horizontal"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      a[data-bravefox-sidebar-images="true"] {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      /* Sidebar staged reveal. Header controls (ChatGPT logo/search/sidebar toggle) are
       * intentionally untouched. Early navigation rows wait for the real Library button;
       * Recent and its chat rows wait for the real Projects section. */
      html.${SIDEBAR_TOP_WAIT_CLASS} nav a[data-sidebar-item="true"],
      html.${SIDEBAR_TOP_WAIT_CLASS} aside a[data-sidebar-item="true"],
      html.${SIDEBAR_TOP_WAIT_CLASS} [data-testid*="sidebar"] a[data-sidebar-item="true"],
      html.${SIDEBAR_TOP_WAIT_CLASS} nav button[data-sidebar-destination],
      html.${SIDEBAR_TOP_WAIT_CLASS} aside button[data-sidebar-destination],
      html.${SIDEBAR_TOP_WAIT_CLASS} [data-testid*="sidebar"] button[data-sidebar-destination],
      [${SIDEBAR_STAGE_HIDDEN_ATTR}="top"],
      html.${SIDEBAR_RECENTS_WAIT_CLASS} nav a[href^="/c/"],
      html.${SIDEBAR_RECENTS_WAIT_CLASS} nav a[href*="/c/"],
      html.${SIDEBAR_RECENTS_WAIT_CLASS} aside a[href^="/c/"],
      html.${SIDEBAR_RECENTS_WAIT_CLASS} aside a[href*="/c/"],
      html.${SIDEBAR_RECENTS_WAIT_CLASS} [data-testid*="sidebar"] a[href^="/c/"],
      html.${SIDEBAR_RECENTS_WAIT_CLASS} [data-testid*="sidebar"] a[href*="/c/"],
      [${SIDEBAR_STAGE_HIDDEN_ATTR}="recent"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Legacy-memory upgrade-card hiding is now handled in JavaScript only while
       * Saved Memories is open. Keeping it out of global Personalization CSS prevents
       * new full-page settings wrappers from being hidden by recycled class tokens. */

      /* Hide the About-you menu button before it can paint. */
      button[aria-label="Tietoja sinusta -valikko"],
      button[aria-label^="Tietoja sinusta"][aria-haspopup="menu"],
      button[aria-label="About you menu"],
      button[aria-label^="About you"][aria-haspopup="menu"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Hide the native "Enable memory" setting row at paint time. Support both
       * the legacy settings shell and ChatGPT's newer full-page settings-row component. */
      html.${PERSONALIZATION_CLASS}
      div.border-token-border-light.flex.min-h-15.items-center.border-b:has(button[role="switch"]),
      html.${PERSONALIZATION_CLASS}
      div[class~="@container/settings-row"]:has(button[role="switch"][aria-label="Ota ChatGPT:n muisti käyttöön"]),
      html.${PERSONALIZATION_CLASS}
      div[class~="@container/settings-row"]:has(button[role="switch"][aria-label="Enable ChatGPT memory"]),
      html.${PERSONALIZATION_CLASS}
      div[class~="@container/settings-row"]:has(button[role="switch"][aria-label="Enable memory"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Saved Memories legacy-memory announcement. Hide the WHOLE outer wrapper
       * before paint so BraveFox does not leave an empty rounded <aside> shell behind. */
      html.${MEMORY_MODAL_CLASS}
      div.flex.w-full.flex-col:has(> aside.relative.isolate.flex.w-full.overflow-hidden.bg-surface div.tracking-announcement-body) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Saved Memories overview: hide per-memory overflow controls before paint.
       * The new UI exposes a stable aria-label + menu trigger, while the destructive
       * Radix item carries text-danger. Scope both to the Saved Memories route class. */
      html.${MEMORY_MODAL_CLASS}
      button[aria-haspopup="menu"][aria-label="Lisää toimintoja"],
      html.${MEMORY_MODAL_CLASS}
      button[aria-haspopup="menu"][aria-label="More actions"],
      html.${MEMORY_MODAL_CLASS}
      [role="menuitem"].text-danger,
      html.${MEMORY_MODAL_CLASS}
      [role="menuitem"][data-color="danger"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Legacy destructive memory actions are still hidden on older UI variants. */
      html.${PERSONALIZATION_CLASS}
      [role="menuitem"][data-color="danger"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* /plugins stays in a paint-safe filtering lane. Keep the main pane hidden until
       * the vault has loaded and the first policy pass has classified native cards. */
      html.${PLUGINS_CURATING_CLASS}:not(.${PLUGINS_READY_CLASS}) main,
      html.${PLUGINS_CURATING_CLASS}:not(.${PLUGINS_READY_CLASS}) [role="main"] {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Keep React's plugin page structure mounted. Hide only rejected plugin cards and
       * card-bearing sections that contain no approved descendant. This is deliberately
       * nesting-safe: an approved inner grid can no longer sit inside a hidden outer
       * <section>, which was the reason /plugins could finish as an empty shell. */
      html.${PLUGINS_CURATING_CLASS}
      article:has(a[href^="/plugins/"]):not([data-bravefox-plugin-allowed]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html.${PLUGINS_CURATING_CLASS}
      section:has(article a[href^="/plugins/"]):not(:has(article[data-bravefox-plugin-allowed])) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html.${PLUGINS_CURATING_CLASS} article[data-bravefox-plugin-allowed] {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      html.${PLUGINS_CURATING_CLASS}
      section:has(article[data-bravefox-plugin-allowed]) {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      html.${PLUGINS_CURATING_CLASS} #${PLUGIN_SAVED_SECTION_ID},
      html.${PLUGINS_CURATING_CLASS} #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      html.${PLUGINS_CURATING_CLASS} #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card {
        display: flex !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} {
        margin: 0 0 24px 0 !important;
        padding: 12px !important;
        border: 1px solid rgba(127, 127, 127, 0.22) !important;
        border-radius: 16px !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
        gap: 8px !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 10px !important;
        border-radius: 14px !important;
        background: var(--main-surface-secondary, rgba(127, 127, 127, 0.08)) !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card img {
        width: 40px !important;
        height: 40px !important;
        border-radius: 10px !important;
        object-fit: cover !important;
        flex: 0 0 auto !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-link {
        min-width: 0 !important;
        flex: 1 1 auto !important;
        text-decoration: none !important;
        color: inherit !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-name {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-weight: 600 !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-note {
        opacity: 0.68 !important;
        font-size: 12px !important;
      }

      #${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-reinstall {
        width: 32px !important;
        height: 32px !important;
        border: 0 !important;
        border-radius: 999px !important;
        cursor: pointer !important;
        font-size: 22px !important;
        line-height: 1 !important;
      }

      /* /gpts is a BraveFox-owned curated shelf. Hide ChatGPT's native category UI
       * at paint time so rejected cards/sections never flash before JavaScript filters
       * them. Only the donor shelf marked by BraveFox is allowed to become visible. */
      html.${GPTS_CURATING_CLASS} div.sticky.top-14.z-10,
      html.${GPTS_CURATING_CLASS} ${GPT_SOURCE_SECTION_SELECTOR}:not([${GPT_APPROVED_SECTION_ATTR}="true"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html.${GPTS_CURATING_CLASS} [${GPT_APPROVED_SECTION_ATTR}="true"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      /* The visible /gpts chrome stays stock ChatGPT. BraveFox only owns the filtered
       * card grid beneath it. Any heading left by an older BraveFox build is suppressed. */
      #${GPT_APPROVED_SECTION_ID} > [data-bravefox-gpt-heading="true"] {
        display: none !important;
        visibility: hidden !important;
      }

      /* Keep ChatGPT's real title/description/search exactly where React owns them.
       * BraveFox creates only lightweight action proxies, positioned in the page's
       * top-right utility area so React-controlled nodes never need to move. */
      #${GPT_NATIVE_HEADER_ID} {
        display: flex !important;
        justify-content: flex-end !important;
        align-items: center !important;
        gap: 0.5rem !important;
        width: auto !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        /* Keep the native-style GPT actions out of the vertical directory flow.
         * This mirrors ChatGPT's own top-right utility placement and lets the
         * approved shelf sit naturally closer to the search field. */
        position: fixed !important;
        top: 0.9rem !important;
        right: 1.25rem !important;
        z-index: 60 !important;
        margin: 0 !important;
      }

      #${GPT_NATIVE_HEADER_ID} [data-bravefox-gpt-action-proxy="my-gpts"] {
        border: 0 !important;
        background: transparent !important;
        color: inherit !important;
        cursor: pointer !important;
        font-size: 0.875rem !important;
        font-weight: 500 !important;
        padding: 0.35rem 0.2rem !important;
      }

      #${GPT_NATIVE_HEADER_ID} [data-bravefox-gpt-action-proxy="create"] {
        border: 0 !important;
        border-radius: 999px !important;
        background: #000000 !important;
        color: #ffffff !important;
        cursor: pointer !important;
        font-size: 0.875rem !important;
        font-weight: 600 !important;
        padding: 0.4rem 0.75rem !important;
      }

      [${GPT_NATIVE_HERO_ATTR}="true"] {
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        /* ChatGPT currently lets the GPT directory hero grow to nearly a viewport.
         * Once BraveFox removes the native shelves that leaves a giant blank spacer
         * between Search and the curated grid. Keep the stock hero, but make its
         * layout height match its actual title/description/search content. */
        min-height: 0 !important;
        height: auto !important;
        flex: 0 0 auto !important;
        flex-grow: 0 !important;
        padding-bottom: 0 !important;
        margin-bottom: 0 !important;
      }

      #${GPT_APPROVED_SECTION_ID} {
        min-height: 0 !important;
        /* One final compacting pass after moving the action row out of flow. */
        margin-top: -0.7rem !important;
      }

      #${GPT_APPROVED_SECTION_ID} > [data-bravefox-gpt-content="true"] {
        margin-top: 0 !important;
      }

      #${GPT_APPROVED_SECTION_ID} a.gizmo-link {
        min-height: 104px !important;
      }

      /* Expansion is automatic. Never show ChatGPT's Show more button in the custom shelf. */
      html.${GPTS_CURATING_CLASS} [${GPT_APPROVED_SECTION_ATTR}="true"] button.btn-secondary.w-full {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      #${CHATGPT_BANNER_CLOSE_MENU_ID} {
        position: fixed !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        z-index: 2147483647 !important;
        min-width: 260px !important;
        max-width: min(360px, calc(100vw - 24px)) !important;
        padding: 6px !important;
        border: 1px solid rgba(127, 127, 127, 0.28) !important;
        border-radius: 14px !important;
        background: var(--main-surface-primary, #ffffff) !important;
        color: var(--text-primary, #111111) !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18) !important;
        font-size: 14px !important;
        line-height: 1.25 !important;
      }

      #${CHATGPT_BANNER_CLOSE_MENU_ID} button {
        display: flex !important;
        width: 100% !important;
        align-items: center !important;
        justify-content: flex-start !important;
        border: 0 !important;
        border-radius: 10px !important;
        background: transparent !important;
        color: inherit !important;
        cursor: pointer !important;
        padding: 9px 10px !important;
        text-align: start !important;
        font: inherit !important;
      }

      #${CHATGPT_BANNER_CLOSE_MENU_ID} button:hover,
      #${CHATGPT_BANNER_CLOSE_MENU_ID} button:focus-visible {
        background: var(--surface-hover, rgba(127, 127, 127, 0.12)) !important;
        outline: none !important;
      }

      #${CHATGPT_BANNER_CLOSE_MENU_ID} [data-bravefox-banner-menu-subtitle] {
        padding: 4px 10px 7px !important;
        opacity: 0.68 !important;
        font-size: 12px !important;
      }

      details[${CHATGPT_BANNER_MENU_DETAILS_ATTR}="true"] {
        display: block !important;
        position: relative !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        z-index: 2147483647 !important;
        flex: 0 0 auto !important;
      }

      summary[${CHATGPT_BANNER_MENU_TRIGGER_ATTR}="true"] {
        display: flex !important;
        position: relative !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        z-index: 2147483647 !important;
        align-items: center !important;
        justify-content: center !important;
        width: 36px !important;
        height: 36px !important;
        border: 0 !important;
        border-radius: 10px !important;
        background: var(--surface-secondary, rgba(127, 127, 127, 0.10)) !important;
        color: inherit !important;
        cursor: pointer !important;
        font: inherit !important;
        font-size: 20px !important;
        line-height: 1 !important;
        list-style: none !important;
        padding: 0 !important;
        user-select: none !important;
      }

      summary[${CHATGPT_BANNER_MENU_TRIGGER_ATTR}="true"]::-webkit-details-marker {
        display: none !important;
      }

      summary[${CHATGPT_BANNER_MENU_TRIGGER_ATTR}="true"]:hover,
      summary[${CHATGPT_BANNER_MENU_TRIGGER_ATTR}="true"]:focus-visible {
        background: var(--surface-hover, rgba(127, 127, 127, 0.16)) !important;
        outline: none !important;
      }

      details[${CHATGPT_BANNER_MENU_DETAILS_ATTR}="true"] > #${CHATGPT_BANNER_CLOSE_MENU_ID} {
        position: absolute !important;
        top: calc(100% + 8px) !important;
        right: 0 !important;
        left: auto !important;
      }

      [data-bravefox-banner-text-customized="true"]
      button[data-bravefox-native-banner-close="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* BraveFox conversation presentation. ChatGPT has rotated the surrounding thread
       * DOM several times, so role attributes remain the semantic anchor while JavaScript
       * stamps stable BraveFox classes onto the live text surfaces. Old native classes stay
       * covered as fallbacks for accounts still on the previous UI bucket. */
      [data-message-author-role="user"] .bg-token-main-surface-secondary {
        background: none !important;
        border: none !important;
        box-shadow: none !important;
      }

      /* User messages: the 2026 revamp exposes data-user-message-bubble="true".
       * Put that exact stable hook first, then retain the old BraveFox/UI fallbacks. */
      [data-user-message-bubble="true"],
      .user-message-bubble-color,
      .bravefox-user-message-surface,
      :is(
        [data-message-author-role="user"],
        [data-role="user"],
        [data-message-author="user"],
        section[data-turn="user"]
      ):not(:has(.user-message-bubble-color)) .whitespace-pre-wrap {
        background: #cce4ff !important;
        border-radius: 16px !important;
        border: 1px solid #a0b8c8 !important;
        margin-left: auto !important;
        margin-right: 2% !important;
        max-width: 98% !important;
        padding: 12px !important;
        box-sizing: border-box !important;
        color: #222 !important;
      }

      /* Assistant messages: the 2026 revamp exposes the rendered body directly as
       * data-markdown-text-style="assistant-message". Style that exact node first. */
      [data-bravefox-fixed-assistant-notice="true"] {
        display: block !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        white-space: normal !important;
      }

      [data-bravefox-fixed-assistant-notice="true"] > p {
        display: block !important;
        white-space: normal !important;
        overflow: visible !important;
      }

      [data-markdown-text-style="assistant-message"],
      :is(
        [data-message-author-role="assistant"],
        [data-role="assistant"],
        [data-message-author="assistant"],
        section[data-turn="assistant"],
        article[data-turn="assistant"]
      ) :is(.markdown, .prose, [class*="markdown"], [data-message-content]),
      .bravefox-assistant-message-surface {
        background: #e9eaea !important;
        border: 1px solid #cfcfcf !important;
        border-radius: 16px !important;
        margin-left: 2% !important;
        max-width: 98% !important;
        padding: 12px !important;
        box-sizing: border-box !important;
        color: #222 !important;
      }

      [data-message-author-role="assistant"] .text-token-text-secondary {
        background: none !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin-top: 4px !important;
      }

      /* Persistent per-message sender/time heading. This is a BraveFox-owned sibling
       * immediately ABOVE the live bubble. Every row is owned by one stable ChatGPT turn
       * key, so a newly mounted/streaming assistant turn cannot steal the user's heading. */
      [${MESSAGE_META_ATTR}="true"] {
        display: block !important;
        position: static !important;
        box-sizing: border-box !important;
        width: var(--bravefox-message-meta-width, 98%) !important;
        max-width: 98% !important;
        min-width: 0 !important;
        min-height: 20px !important;
        margin-top: 0 !important;
        margin-bottom: 4px !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        color: var(--text-primary, #111111) !important;
        font-family: inherit !important;
        font-size: 13px !important;
        font-style: normal !important;
        font-weight: 700 !important;
        line-height: 20px !important;
        text-align: center !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        pointer-events: auto !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        cursor: text !important;
      }

      [${MESSAGE_META_ATTR}="true"][${MESSAGE_META_ROLE_ATTR}="user"] {
        margin-left: auto !important;
        margin-right: 2% !important;
      }

      [${MESSAGE_META_ATTR}="true"][${MESSAGE_META_ROLE_ATTR}="assistant"] {
        margin-left: 2% !important;
        margin-right: 0 !important;
      }

      [${MESSAGE_META_ATTR}="true"] > [${MESSAGE_META_TEXT_ATTR}="true"] {
        display: inline !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        color: inherit !important;
        font: inherit !important;
        line-height: inherit !important;
        user-select: text !important;
        -webkit-user-select: text !important;
      }

      /* Keep ChatGPT's native action strip in normal document flow, but put the icons on
       * the right. No absolute positioning means long messages/reasoning cannot collide
       * with the controls or drag them above an unrelated bubble. */
      [${MESSAGE_ACTIONS_ATTR}="true"] {
        position: static !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        z-index: auto !important;
        display: flex !important;
        width: auto !important;
        max-width: 98% !important;
        min-height: 24px !important;
        margin-left: auto !important;
        margin-right: 2% !important;
        padding: 0 !important;
        justify-content: flex-end !important;
        align-items: center !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }

      html.${MESSAGE_TIMESTAMP_PROBE_CLASS} [role="menu"],
      html.${MESSAGE_TIMESTAMP_PROBE_CLASS} [role="menuitem"] {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      [class*="CodeBlock-module__code"] div {
        background-color: #ffffff !important;
        border: none !important;
        border-radius: 0 !important;
      }

      [class*="CodeBlock-module__code"] code {
        font-family: "Courier New", monospace !important;
        font-size: 1rem !important;
        color: #222 !important;
      }

      button[aria-label="Päivitä"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function getPersonalizationAuthBridgeTarget(value) {
    try {
      const url = new URL(String(value || location.href), location.href);
      if (url.origin !== location.origin) return null;

      let hash = url.hash || '';
      try {
        hash = decodeURIComponent(hash);
      } catch {
        // Keep the raw hash if decoding fails.
      }

      if (!normalizeText(hash).startsWith('#settings/personalization')) return null;

      const encodedTarget = String(
        url.searchParams.get(PERSONALIZATION_AUTH_BRIDGE_PARAM) || ''
      ).trim();
      if (!encodedTarget) return null;

      const target = new URL(encodedTarget, url.origin);
      if (target.origin !== url.origin) return null;

      const pathname = String(target.pathname || '/')
        .toLowerCase()
        .replace(/\/+$/, '') || '/';

      if (
        pathname !== PERSONALIZATION_PATH &&
        !pathname.startsWith(`${PERSONALIZATION_PATH}/`)
      ) {
        return null;
      }

      target.searchParams.delete(PERSONALIZATION_AUTH_BRIDGE_PARAM);
      return target.href;
    } catch {
      return null;
    }
  }

  function makePersonalizationAuthBridgeUrl(value) {
    try {
      const target = new URL(String(value || location.href), location.href);
      if (target.origin !== location.origin) return String(value || location.href);

      const pathname = String(target.pathname || '/')
        .toLowerCase()
        .replace(/\/+$/, '') || '/';

      if (
        pathname !== PERSONALIZATION_PATH &&
        !pathname.startsWith(`${PERSONALIZATION_PATH}/`)
      ) {
        return target.href;
      }

      const bridge = new URL('/', target.origin);
      bridge.searchParams.set(
        PERSONALIZATION_AUTH_BRIDGE_PARAM,
        `${target.pathname}${target.search}${target.hash}`
      );
      bridge.hash = '#settings/personalization';
      return bridge.href;
    } catch {
      return String(value || location.href);
    }
  }

  function normalizeProtectedLibraryPath(value) {
    try {
      const url = new URL(String(value || location.href), location.href);
      if (url.origin !== location.origin) return '';
      return String(url.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    } catch {
      return '';
    }
  }

  function getProtectedLibraryRootPath() {
    return `/library/d/${LIBRARY_PROTECTED_FOLDER_ID}`.toLowerCase();
  }

  function isKnownProtectedLibraryPath(pathname) {
    const normalized = normalizeProtectedLibraryPath(pathname);
    if (!normalized) return false;

    const root = getProtectedLibraryRootPath();
    if (normalized === root || normalized.startsWith(`${root}/`)) return true;

    for (const path of protectedLibraryDescendantPaths) {
      if (normalized === path || normalized.startsWith(`${path}/`)) return true;
    }
    return false;
  }

  function isCandidateProtectedLibraryDescendantPath(value) {
    const pathname = normalizeProtectedLibraryPath(value);
    if (!pathname || !pathname.startsWith('/library/')) return false;
    if (pathname === '/library') return false;

    // Never learn top-level Library destinations as descendants merely because the user
    // clicked them while standing inside Protected Files. Only item/detail-style paths
    // can become part of the protected subtree.
    if (/^\/library\/(?:trash|all|shared|recent|uploads?|images?|settings)(?:\/|$)/i.test(pathname)) {
      return false;
    }
    return true;
  }

  function persistProtectedLibraryNavigationSession() {
    try {
      sessionStorage.setItem(
        LIBRARY_PROTECTED_NAV_SESSION_KEY,
        JSON.stringify({
          unlocked: !!protectedLibraryNavigationUnlocked,
          paths: Array.from(protectedLibraryDescendantPaths).slice(-256)
        })
      );
    } catch {}
  }

  function restoreProtectedLibraryNavigationSession() {
    try {
      const raw = sessionStorage.getItem(LIBRARY_PROTECTED_NAV_SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      protectedLibraryNavigationUnlocked = saved?.unlocked === true;
      for (const value of Array.isArray(saved?.paths) ? saved.paths : []) {
        const pathname = normalizeProtectedLibraryPath(value);
        if (!pathname || !pathname.startsWith('/library/') || pathname === '/library') continue;
        protectedLibraryDescendantPaths.add(pathname);
      }
    } catch {}
  }

  function unlockProtectedLibraryNavigationSession() {
    if (protectedLibraryNavigationUnlocked) return;
    protectedLibraryNavigationUnlocked = true;
    persistProtectedLibraryNavigationSession();
  }

  function rememberProtectedLibraryDescendantUrl(value) {
    const pathname = normalizeProtectedLibraryPath(value);
    if (!pathname || isKnownProtectedLibraryPath(pathname)) return false;
    if (!isCandidateProtectedLibraryDescendantPath(pathname)) return false;
    protectedLibraryDescendantPaths.add(pathname);
    persistProtectedLibraryNavigationSession();
    return true;
  }

  function rememberProtectedLibraryTransition(fromUrl, toUrl) {
    if (!isKnownProtectedLibraryPath(fromUrl)) return false;
    return rememberProtectedLibraryDescendantUrl(toUrl);
  }

  function getProtectedRouteDescriptorForUrl(value) {
    try {
      const url = new URL(String(value || location.href), location.href);
      if (url.origin !== location.origin) return null;

      const pathname = String(url.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
      if (pathname === PERSONALIZATION_PATH || pathname.startsWith(`${PERSONALIZATION_PATH}/`)) {
        const modal = normalizeText(url.searchParams.get('modal'));
        const memoryModal = modal === PERSONALIZATION_MEMORY_MODAL;
        // Treat the `instructions` query key itself as the protected instructions lane.
        // This covers ?instructions, ?instructions=, ChatGPT, Codex and future tabs without
        // tying the password gate to OpenAI's current tab names.
        const chatGptInstructions = url.searchParams.has(PERSONALIZATION_INSTRUCTIONS_PARAM);
        const basePersonalization = !memoryModal && !chatGptInstructions;
        return {
          key: 'personalization',
          path: PERSONALIZATION_PATH,
          title: memoryModal
            ? MEMORY_SUMMARY_PROMPT
            : chatGptInstructions
              ? PERSONALIZATION_INSTRUCTIONS_PROMPT
              : PERSONALIZATION_PROMPT,
          modal: memoryModal ? PERSONALIZATION_MEMORY_MODAL : null,
          instructions: chatGptInstructions ? PERSONALIZATION_CHATGPT_INSTRUCTIONS : null,
          passwordProtected:
            !(TEMP_DISABLE_BASE_PERSONALIZATION_PASSWORD && basePersonalization)
        };
      }

      // Legacy hash route retained during the rollout because ChatGPT is currently serving
      // both settings shells to different tabs/accounts.
      let hash = url.hash || '';
      try {
        hash = decodeURIComponent(hash);
      } catch {
        // A malformed hash should not break the extension.
      }
      if (normalizeText(hash).startsWith('#settings/personalization')) {
        return { key: 'personalization', path: null, title: PERSONALIZATION_PROMPT, modal: null };
      }

      const protectedLibraryPath = getProtectedLibraryRootPath();
      if (isKnownProtectedLibraryPath(pathname)) {
        return { key: 'library-protected-files', path: protectedLibraryPath, title: LIBRARY_PROTECTED_FOLDER_PROMPT };
      }
      for (const route of PROTECTED_PATH_ROUTES) {
        if (pathname === route.path || pathname.startsWith(`${route.path}/`)) return route;
      }
      return null;
    } catch {
      return null;
    }
  }

  function getProtectedRouteDescriptor() {
    return getProtectedRouteDescriptorForUrl(location.href);
  }

  function descriptorRequiresPassword(descriptor) {
    if (TEMP_DISABLE_ALL_PASSWORD_PROMPTS) return false;
    return Boolean(descriptor) && descriptor.passwordProtected !== false;
  }

  function isPersonalizationRoute() {
    return getProtectedRouteDescriptor()?.key === 'personalization';
  }

  function isPersonalizationMemoryModalUrl(value = location.href) {
    const descriptor = getProtectedRouteDescriptorForUrl(value);
    return descriptor?.key === 'personalization' && descriptor.modal === PERSONALIZATION_MEMORY_MODAL;
  }

  function isPersonalizationInstructionsUrl(value = location.href) {
    const descriptor = getProtectedRouteDescriptorForUrl(value);
    return (
      descriptor?.key === 'personalization' &&
      descriptor.instructions === PERSONALIZATION_CHATGPT_INSTRUCTIONS
    );
  }

  function isPluginsRoute() {
    return getProtectedRouteDescriptor()?.key === 'plugins';
  }

  function isGptsRoute() {
    return getProtectedRouteDescriptor()?.key === 'gpts';
  }

  function isPluginsPathname(pathname) {
    const normalizedPath = String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    return normalizedPath === '/plugins' || normalizedPath.startsWith('/plugins/');
  }

  function isGptsPathname(pathname) {
    const normalizedPath = String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    return normalizedPath === '/gpts' || normalizedPath.startsWith('/gpts/');
  }

  function resetPluginCurationState() {
    if (pluginReadyTimer) {
      clearTimeout(pluginReadyTimer);
      pluginReadyTimer = 0;
    }
    pluginCurationStartedAt = 0;
    pluginCurationLastActivityAt = 0;
    pluginLastNativeSignature = '';
    document.documentElement.classList.remove(PLUGINS_READY_CLASS);
  }

  function resetGptCurationState() {
    if (gptCurationRetryTimer) {
      clearTimeout(gptCurationRetryTimer);
      gptCurationRetryTimer = 0;
    }
    gptApprovedSection = null;
    gptApprovedGrid = null;
    gptNativeHeaderHost = null;
    gptCurationStartedAt = 0;
    gptCurationLastActivityAt = 0;
    gptApprovedKeys.clear();
  }

  function sendRuntimeMessage(message) {
    return new Promise(resolve => {
      try {
        if (!api?.runtime?.sendMessage) {
          resolve({ ok: false, error: 'Extension messaging is unavailable.' });
          return;
        }
        api.runtime.sendMessage(message, response => {
          const runtimeError = api.runtime.lastError;
          if (runtimeError) {
            resolve({ ok: false, error: runtimeError.message });
            return;
          }
          resolve(response || { ok: false, error: 'No response from BraveFox background.' });
        });
      } catch (error) {
        resolve({ ok: false, error: error?.message || String(error) });
      }
    });
  }

  function makeAuthRequestId() {
    try {
      if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
      const bytes = new Uint8Array(16);
      globalThis.crypto?.getRandomValues?.(bytes);
      return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    } catch {
      return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }

  function preArmProtectedRoute(descriptor) {
    if (!descriptor || !descriptorRequiresPassword(descriptor)) return;
    document.documentElement.classList.add(GATED_CLASS);
    setInlinePaintGate(true);
    document.documentElement.classList.toggle(PERSONALIZATION_CLASS, descriptor.key === 'personalization');
    document.documentElement.classList.toggle(PLUGINS_CURATING_CLASS, descriptor.key === 'plugins');
    document.documentElement.classList.toggle(GPTS_CURATING_CLASS, descriptor.key === 'gpts');
    if (descriptor.key === 'plugins') document.documentElement.classList.remove(PLUGINS_READY_CLASS);
  }

  async function getExtensionPrivateValue(key) {
    try {
      if (!api?.storage?.local?.get) return undefined;
      const result = await api.storage.local.get(key);
      return result?.[key];
    } catch {
      return undefined;
    }
  }

  async function setExtensionPrivateValue(key, value) {
    try {
      if (!api?.storage?.local?.set) return false;
      await api.storage.local.set({ [key]: value });
      return true;
    } catch {
      return false;
    }
  }

  async function removeExtensionPrivateValue(key) {
    try {
      if (!api?.storage?.local?.remove) return false;
      await api.storage.local.remove(key);
      return true;
    } catch {
      return false;
    }
  }

  function canonicalAuthTarget(value) {
    try {
      const url = new URL(String(value || location.href), location.href);
      url.searchParams.delete(PERSONALIZATION_AUTH_BRIDGE_PARAM);
      return `${url.origin}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return String(value || location.href);
    }
  }

  async function clearAuthLoopGuard() {
    await removeExtensionPrivateValue(AUTH_LOOP_GUARD_KEY);
  }

  async function markAuthLoopGuard({ kind, routeKey, returnUrl }) {
    return setExtensionPrivateValue(AUTH_LOOP_GUARD_KEY, {
      kind: String(kind || 'protected-route'),
      routeKey: String(routeKey || ''),
      target: canonicalAuthTarget(returnUrl),
      startedAt: Date.now()
    });
  }

  async function isRepeatedAuthLoopAttempt({ kind, routeKey, returnUrl }) {
    const guard = await getExtensionPrivateValue(AUTH_LOOP_GUARD_KEY);
    if (!guard || typeof guard !== 'object') return false;

    const age = Date.now() - Number(guard.startedAt || 0);
    if (!Number.isFinite(age) || age < 0 || age > AUTH_LOOP_GUARD_MAX_AGE_MS) {
      await clearAuthLoopGuard();
      return false;
    }

    return (
      String(guard.kind || '') === String(kind || 'protected-route') &&
      String(guard.routeKey || '') === String(routeKey || '') &&
      String(guard.target || '') === canonicalAuthTarget(returnUrl)
    );
  }

  async function storePersonalizationAuthHandoff(targetHref, grant) {
    if (!grant || grant.routeKey !== 'personalization') return false;

    return setExtensionPrivateValue(PERSONALIZATION_AUTH_HANDOFF_KEY, {
      target: canonicalAuthTarget(targetHref),
      createdAt: Date.now(),
      grant: {
        unlocked: true,
        routeKey: 'personalization',
        kind: String(grant.kind || 'protected-route'),
        payload: grant.payload && typeof grant.payload === 'object'
          ? grant.payload
          : {}
      }
    });
  }

  async function consumePersonalizationAuthHandoff(targetHref = location.href) {
    const handoff = await getExtensionPrivateValue(PERSONALIZATION_AUTH_HANDOFF_KEY);
    if (!handoff || typeof handoff !== 'object') return null;

    // One-shot regardless of validity: stale/mismatched handoffs must never become
    // reusable route unlocks.
    await removeExtensionPrivateValue(PERSONALIZATION_AUTH_HANDOFF_KEY);

    const age = Date.now() - Number(handoff.createdAt || 0);
    if (!Number.isFinite(age) || age < 0 || age > AUTH_HANDOFF_MAX_AGE_MS) return null;
    if (String(handoff.target || '') !== canonicalAuthTarget(targetHref)) return null;

    const grant = handoff.grant;
    if (!grant || grant.unlocked !== true || grant.routeKey !== 'personalization') return null;
    return grant;
  }

  async function consumeNativePasswordGrantWithRetry(attempts = 8, delayMs = 75) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const grant = await consumeNativePasswordGrant();
      if (grant) return grant;
      if (attempt + 1 < attempts) await waitFor(delayMs);
    }
    return null;
  }

  async function completePersonalizationAuthBridge(targetHref) {
    // The background's native password page returns to this legacy-approved route.
    // Consume there, where the background expects us to be.
    const grant = await consumeNativePasswordGrantWithRetry();

    if (!grant || grant.routeKey !== 'personalization') {
      await removeExtensionPrivateValue(PERSONALIZATION_AUTH_HANDOFF_KEY);
      await clearAuthLoopGuard();
      console.warn(
        '[BraveFox Enhancer] Personalization auth bridge returned without a usable grant; aborting instead of looping.'
      );
      location.replace(new URL('/', location.origin).href);
      return;
    }

    const stored = await storePersonalizationAuthHandoff(targetHref, grant);
    await clearAuthLoopGuard();

    if (!stored) {
      console.warn(
        '[BraveFox Enhancer] Could not persist one-hop Personalization auth handoff; aborting safely.'
      );
      location.replace(new URL('/', location.origin).href);
      return;
    }

    location.replace(targetHref);
  }

  async function beginNativePasswordFlow({ kind = 'protected-route', routeKey, title, returnUrl = location.href, payload = {} }) {
    if (TEMP_DISABLE_ALL_PASSWORD_PROMPTS) {
      authRedirectRequested = false;
      protectedRouteUnlocked = true;
      protectedMemoryModalUnlocked = true;
      protectedPersonalizationInstructionsUnlocked = true;
      document.documentElement.classList.remove(GATED_CLASS);
      setInlinePaintGate(false);
      return true;
    }

    if (authRedirectRequested) return false;
    authRedirectRequested = true;
    document.documentElement.classList.add(GATED_CLASS);
    setInlinePaintGate(true);

    if (await isRepeatedAuthLoopAttempt({ kind, routeKey, returnUrl })) {
      // A password flow already returned to this exact request without producing a
      // usable grant. Do not reopen it automatically; clear the one-shot guard so a
      // later manual visit can try again.
      await clearAuthLoopGuard();
      authRedirectRequested = false;
      console.warn(
        '[BraveFox Enhancer] Suppressed repeated password redirect for the same protected target.'
      );
      location.replace(new URL('/', location.origin).href);
      return false;
    }

    await markAuthLoopGuard({ kind, routeKey, returnUrl });

    // The currently installed background/service worker still validates the old
    // #settings/personalization route. Use that route only as an authenticated
    // trampoline; the content script immediately forwards it to the new page.
    const authReturnUrl =
      routeKey === 'personalization'
        ? makePersonalizationAuthBridgeUrl(returnUrl)
        : returnUrl;

    const response = await sendRuntimeMessage({
      type: 'BRAVEFOX_CHATGPT_AUTH_BEGIN',
      requestId: makeAuthRequestId(),
      kind,
      routeKey,
      title,
      returnUrl: authReturnUrl,
      payload
    });

    if (!response?.ok) {
      await clearAuthLoopGuard();
      authRedirectRequested = false;
      console.warn('[BraveFox Enhancer] Could not open native ChatGPT password page:', response?.error || response);

      // Never expose a protected page after an auth failure, but also never leave
      // the tab trapped behind a permanent white paint gate.
      const currentProtectedRoute = getProtectedRouteDescriptor();
      if (currentProtectedRoute) {
        location.replace(new URL('/', location.origin).href);
        return false;
      }

      document.documentElement.classList.remove(GATED_CLASS);
      setInlinePaintGate(false);
      return false;
    }
    return true;
  }

  async function consumeNativePasswordGrant() {
    const response = await sendRuntimeMessage({ type: 'BRAVEFOX_CHATGPT_AUTH_CONSUME' });
    return response?.ok && response?.unlocked ? response : null;
  }

  async function waitFor(ms) {
    await new Promise(resolve => window.setTimeout(resolve, ms));
  }

  async function prepareUnlockedProtectedRoute(routeKey) {
    if (routeKey === 'personalization') {
      hideSensitiveMemoryControls(document);
      cleanChatGptUi(document);
      return;
    }

    if (routeKey === 'plugins') {
      document.documentElement.classList.add(PLUGINS_CURATING_CLASS);
      await applyPluginPagePolicy(document);
      return;
    }

    if (routeKey === 'gpts') {
      document.documentElement.classList.add(GPTS_CURATING_CLASS);
      applyGptPagePolicy(document);
      // The custom shelf is now created by BraveFox itself and normally exists on the
      // first pass. Give React a very short grace window if <main> has not mounted yet.
      const deadline = Date.now() + 900;
      while (!gptApprovedSection?.isConnected && Date.now() < deadline) {
        await waitFor(45);
        applyGptPagePolicy(document);
      }
    }
  }

  function resumeMemorySummaryAfterUnlock(attempt = 0) {
    if (!isPersonalizationRoute() || !protectedRouteUnlocked) return;
    const button = findMemorySummaryManageButton();
    if (button) {
      replayManageClick(button);
      return;
    }
    if (attempt < 24) window.setTimeout(() => resumeMemorySummaryAfterUnlock(attempt + 1), 125);
  }

  function findPluginInstallButtonByKey(pluginKey) {
    for (const article of getPluginArticles(document)) {
      const info = extractPluginCardInfo(article);
      if (!info || info.key !== pluginKey) continue;
      for (const button of article.querySelectorAll('button[type="button"], button')) {
        if (isPluginInstallButton(button)) return button;
      }
    }
    return null;
  }

  function resumePluginInstallAfterUnlock(pluginKey, attempt = 0) {
    if (!isPluginsRoute() || !protectedRouteUnlocked || !pluginKey) return;
    const button = findPluginInstallButtonByKey(pluginKey);
    if (button) {
      replayPluginInstall(button, pluginKey);
      return;
    }

    if (attempt < 24) {
      window.setTimeout(() => resumePluginInstallAfterUnlock(pluginKey, attempt + 1), 125);
      return;
    }

    const savedEntry = pluginVault.get(pluginKey);
    if (savedEntry?.href) location.assign(savedEntry.href);
  }

  function resumeApprovedPasswordAction(grant) {
    if (!grant) return;
    if (grant.kind === 'memory-summary') {
      // New UI returns directly to ?modal=memories after authentication. The old UI
      // still needs its Manage button replay, so preserve that path as a fallback.
      if (!isPersonalizationMemoryModalUrl()) resumeMemorySummaryAfterUnlock();
      return;
    }
    if (grant.kind === 'plugin-install') {
      resumePluginInstallAfterUnlock(String(grant.payload?.pluginKey || ''));
      return;
    }
    if (grant.kind === 'library-edit-mode') {
      enableProtectedLibraryEditMode();
      return;
    }
    if (grant.kind === 'library-file-delete') {
      resumeProtectedLibraryFileDelete(grant.payload || {});
    }
  }

  async function synchronizeRoute() {
    const descriptor = getProtectedRouteDescriptor();
    const routeKey = descriptor?.key || null;
    const onPersonalization = routeKey === 'personalization';
    const onMemoryModal = onPersonalization && descriptor?.modal === PERSONALIZATION_MEMORY_MODAL;
    const onChatGptInstructions =
      onPersonalization &&
      descriptor?.instructions === PERSONALIZATION_CHATGPT_INSTRUCTIONS;
    const onPlugins = routeKey === 'plugins';
    const onGpts = routeKey === 'gpts';

    const previousPersonalizationModal = activePersonalizationModal;
    const previousPersonalizationInstructions = activePersonalizationInstructions;
    activePersonalizationModal = onPersonalization ? (descriptor?.modal || null) : null;
    activePersonalizationInstructions = onPersonalization ? (descriptor?.instructions || null) : null;

    if (previousPersonalizationModal === PERSONALIZATION_MEMORY_MODAL && !onMemoryModal) {
      protectedMemoryModalUnlocked = false;
    }
    if (
      previousPersonalizationInstructions === PERSONALIZATION_CHATGPT_INSTRUCTIONS &&
      !onChatGptInstructions
    ) {
      protectedPersonalizationInstructionsUnlocked = false;
    }

    document.documentElement.classList.toggle(PERSONALIZATION_CLASS, onPersonalization);
    document.documentElement.classList.toggle(ACCOUNT_SETTINGS_CLASS, isAccountSettingsRoute());
    document.documentElement.classList.toggle(MEMORY_MODAL_CLASS, onMemoryModal);
    document.documentElement.classList.toggle(PLUGINS_CURATING_CLASS, onPlugins);
    document.documentElement.classList.toggle(GPTS_CURATING_CLASS, onGpts);

    if (routeKey !== activeProtectedRouteKey) {
      const previousRouteKey = activeProtectedRouteKey;
      activeProtectedRouteKey = routeKey;
      protectedRouteUnlocked = false;
      protectedMemoryModalUnlocked = false;
      protectedPersonalizationInstructionsUnlocked = false;
      routeAuthCheckInProgress = false;
      authRedirectRequested = false;
      pendingApprovedAction = null;

      if (previousRouteKey === 'library-protected-files' || routeKey !== 'library-protected-files') {
        protectedLibraryEditMode = false;
        document.documentElement.classList.remove(LIBRARY_EDIT_MODE_CLASS);
      }

      if (previousRouteKey === 'plugins' && routeKey !== 'plugins') {
        resetPluginCurationState();
        void finalizePluginVaultSeedIfReady();
      }
      if (routeKey === 'plugins' && previousRouteKey !== 'plugins') {
        resetPluginCurationState();
      }
      if (previousRouteKey === 'gpts' && routeKey !== 'gpts') {
        resetGptCurationState();
      }
    }

    configureRouteObserver();

    if (routeKey === 'library-protected-files' && protectedLibraryNavigationUnlocked) {
      // Navigation access is session-unlocked, but edit/delete actions still return their
      // own one-time native grants. Consume those separately so the navigation shortcut
      // can never bypass or swallow an Edit Mode / delete authorization.
      let actionGrant = null;
      try {
        actionGrant = await consumeNativePasswordGrant();
      } catch {}

      protectedRouteUnlocked = true;
      authRedirectRequested = false;
      routeAuthCheckInProgress = false;
      document.documentElement.classList.remove(GATED_CLASS);
      setInlinePaintGate(false);
      scheduleProtectedLibraryReconcileBurst();

      if (actionGrant?.routeKey === routeKey) {
        await clearAuthLoopGuard();
        resumeApprovedPasswordAction(actionGrant);
      }
      return;
    }

    if (!descriptor) {
      document.documentElement.classList.remove(GATED_CLASS);
      document.documentElement.classList.remove(PLUGINS_READY_CLASS);
      setInlinePaintGate(false);
      return;
    }

    if (!descriptorRequiresPassword(descriptor)) {
      // Temporary rollout workaround: keep the Personalization route fully active for
      // BraveFox UI cleanup, but consider only the base page locally unlocked so no
      // background/native password flow is started.
      protectedRouteUnlocked = true;
      authRedirectRequested = false;
      routeAuthCheckInProgress = false;
      document.documentElement.classList.remove(GATED_CLASS);
      setInlinePaintGate(false);
      hideSensitiveMemoryControls(document);
      cleanChatGptUi(document);
      return;
    }

    if (protectedRouteUnlocked && onMemoryModal && !protectedMemoryModalUnlocked) {
      preArmProtectedRoute(descriptor);
      if (routeAuthCheckInProgress || authRedirectRequested) return;

      await beginNativePasswordFlow({
        kind: 'memory-summary',
        routeKey: 'personalization',
        title: MEMORY_SUMMARY_PROMPT,
        returnUrl: location.href
      });
      return;
    }

    if (
      protectedRouteUnlocked &&
      onChatGptInstructions &&
      !protectedPersonalizationInstructionsUnlocked
    ) {
      preArmProtectedRoute(descriptor);
      if (routeAuthCheckInProgress || authRedirectRequested) return;

      await beginNativePasswordFlow({
        kind: 'personalization-instructions',
        routeKey: 'personalization',
        title: PERSONALIZATION_INSTRUCTIONS_PROMPT,
        returnUrl: location.href
      });
      return;
    }

    if (protectedRouteUnlocked) {
      document.documentElement.classList.remove(GATED_CLASS);
      setInlinePaintGate(false);
      return;
    }

    preArmProtectedRoute(descriptor);
    if (routeAuthCheckInProgress || authRedirectRequested) return;

    routeAuthCheckInProgress = true;
    try {
      let grant = null;

      if (routeKey === 'personalization') {
        grant = await consumePersonalizationAuthHandoff(location.href);
      }
      if (!grant) {
        grant = await consumeNativePasswordGrant();
      }

      const current = getProtectedRouteDescriptor();
      if (current?.key !== routeKey) return;

      if (grant?.routeKey === routeKey) {
        await clearAuthLoopGuard();
        protectedRouteUnlocked = true;
        if (routeKey === 'library-protected-files' && grant.kind === 'protected-route') {
          unlockProtectedLibraryNavigationSession();
        }
        protectedMemoryModalUnlocked =
          grant.kind === 'memory-summary' ||
          onMemoryModal;
        protectedPersonalizationInstructionsUnlocked =
          grant.kind === 'personalization-instructions' ||
          onChatGptInstructions;
        authRedirectRequested = false;
        pendingApprovedAction = grant;
        await prepareUnlockedProtectedRoute(routeKey);
        document.documentElement.classList.remove(GATED_CLASS);
        setInlinePaintGate(false);
        scheduleGeneralUiScan(true);
        const approvedAction = pendingApprovedAction;
        pendingApprovedAction = null;
        resumeApprovedPasswordAction(approvedAction);
        return;
      }

      await beginNativePasswordFlow({
        kind: 'protected-route',
        routeKey,
        title: descriptor.title,
        returnUrl: location.href
      });
    } finally {
      routeAuthCheckInProgress = false;
    }
  }

  function queueRouteCheck() {
    if (routeCheckQueued) return;
    routeCheckQueued = true;
    queueMicrotask(() => {
      routeCheckQueued = false;
      checkForRouteChange();
    });
  }

  function checkForRouteChange() {
    if (location.href === lastUrl) return false;
    const previousUrl = lastUrl;
    rememberProtectedLibraryTransition(previousUrl, location.href);
    lastUrl = location.href;
    cleanupProtectedLibraryUiOutsideFolder();
    void synchronizeRoute();
    scheduleConversationSelectionFastRefresh();
    scheduleGeneralUiScan(true);
    return true;
  }

  function installNavigationGuards() {
    const handleNavigation = () => {
      const previousUrl = lastUrl;
      rememberProtectedLibraryTransition(previousUrl, location.href);
      lastUrl = location.href;
      cleanupProtectedLibraryUiOutsideFolder();
      void synchronizeRoute();
      scheduleConversationSelectionFastRefresh();
      scheduleGeneralUiScan(true);
      scheduleSidebarPolishRetries();
    };

    window.addEventListener('hashchange', handleNavigation, true);
    window.addEventListener('popstate', handleNavigation, true);
    window.addEventListener('pageshow', handleNavigation, true);
    window.addEventListener('focus', scheduleConversationSelectionFastRefresh, true);
    window.addEventListener('pagehide', () => {
      if (isPluginsRoute()) void finalizePluginVaultSeedIfReady();
    }, true);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      checkForRouteChange();
      scheduleConversationSelectionFastRefresh();
    }, true);

    try {
      if (globalThis.navigation?.addEventListener) {
        // Pre-arm protected SPA destinations before ChatGPT commits the new route. This
        // closes the brief raw-/plugins glimpse that can otherwise happen before
        // currententrychange or the href poll notices the URL.
        globalThis.navigation.addEventListener('navigate', event => {
          try {
            const destinationUrl = event?.destination?.url;
            if (!destinationUrl) return;
            if (isKnownProtectedLibraryPath(location.href)) {
              rememberProtectedLibraryDescendantUrl(destinationUrl);
            }
            const descriptor = getProtectedRouteDescriptorForUrl(destinationUrl);

            // Apply Saved Memories presentation policy before the destination commits,
            // so its overflow buttons never get a visible first frame.
            document.documentElement.classList.toggle(
              MEMORY_MODAL_CLASS,
              descriptor?.key === 'personalization' &&
              descriptor?.modal === PERSONALIZATION_MEMORY_MODAL
            );

            // Account-page cleanup must be armed before SPA navigation commits too,
            // otherwise React can paint the destructive row for one frame.
            document.documentElement.classList.toggle(
              ACCOUNT_SETTINGS_CLASS,
              isAccountSettingsRoute(destinationUrl)
            );

            const sameUnlockedLane =
              (
                descriptor?.key &&
                descriptor.key === activeProtectedRouteKey &&
                protectedRouteUnlocked
              ) ||
              (descriptor?.key === 'library-protected-files' && protectedLibraryNavigationUnlocked);
            const lockedMemoryModal =
              descriptor?.key === 'personalization' &&
              descriptor.modal === PERSONALIZATION_MEMORY_MODAL &&
              !protectedMemoryModalUnlocked;
            const lockedInstructions =
              descriptor?.key === 'personalization' &&
              descriptor.instructions === PERSONALIZATION_CHATGPT_INSTRUCTIONS &&
              !protectedPersonalizationInstructionsUnlocked;
            if (
              descriptorRequiresPassword(descriptor) &&
              (!sameUnlockedLane || lockedMemoryModal || lockedInstructions)
            ) {
              preArmProtectedRoute(descriptor);
            }
          } catch {
            // currententrychange/polling remain as fallbacks.
          }
        });
        globalThis.navigation.addEventListener('currententrychange', queueRouteCheck);
      }
    } catch {
      // Navigation API support is optional.
    }

    // Always keep the tiny href-string fallback. ChatGPT has changed router behavior
    // enough times that relying on one SPA event source is not worth another 3-second
    // password-gate delay. No DOM scanning happens here.
    routePollTimer = window.setInterval(checkForRouteChange, ROUTE_POLL_MS);
  }

  function captureConversationComposerSelection() {
    syncConversationSelectionState();
    const effort = readCurrentConversationReasoningEffortFromDom();
    if (effort) {
      conversationPendingReasoningEffort = effort;
      conversationLastKnownReasoningEffort = effort;
    }

    const modelSlug = readCurrentConversationModelSlugForSend(effort);
    if (modelSlug) {
      conversationPendingModelSlug = modelSlug;
      conversationLastSelectedModelSlug = modelSlug;
    }
  }

  function isConversationSendButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    const label = normalizeText([
      button.getAttribute('aria-label') || '',
      button.getAttribute('title') || '',
      button.getAttribute('data-testid') || '',
      button.textContent || ''
    ].join(' '));
    return includesAny(label, [
      'send message', 'send prompt', 'send-button', 'lähetä viesti', 'laheta viesti', 'lähetä', 'laheta'
    ]);
  }

  function captureConversationSendIntentFromEvent(event) {
    if (!event?.isTrusted) return;

    let sending = false;
    if (event.type === 'click') {
      const button = getButtonFromEvent(event);
      sending = isConversationSendButton(button);
      if (!sending && button instanceof HTMLButtonElement) {
        const composer = button.closest('form, [data-testid*="composer" i], [class*="composer" i]');
        const hasEditable = composer?.querySelector?.('textarea, [contenteditable="true"], [role="textbox"]');
        const looksLikeSubmit = button.type === 'submit' || normalizeText(button.getAttribute('data-testid')).includes('send');
        sending = Boolean(composer && hasEditable && looksLikeSubmit);
      }
    } else if (event.type === 'keydown') {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const composer = target.closest('form, [data-testid*="composer" i], [class*="composer" i]');
      const editable = target.matches('textarea, [contenteditable="true"], [role="textbox"]');
      sending = Boolean(editable && composer);
    } else if (event.type === 'submit') {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const composer = form.matches('[data-testid*="composer" i], [class*="composer" i]') ||
        form.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
      sending = Boolean(composer);
    }

    if (!sending) return;
    conversationPendingUserSentAt = Date.now();
    conversationPendingAssistantStartedAt = 0;
    conversationPendingModelSlug = '';
    conversationPendingReasoningEffort = '';
    captureConversationComposerSelection();
  }

  function installInteractionGuards() {
    document.addEventListener('click', event => {
      if (event.isTrusted) {
        captureConversationModelChoiceFromEvent(event);
        captureConversationSendIntentFromEvent(event);
      }

      if (event.isTrusted) {
        const analysisToggle = getElementFromEvent(event, 'button[aria-expanded][aria-labelledby]');
        if (analysisToggle && isAnalysisActivityToggle(analysisToggle)) {
          markAnalysisActivityUserControlled(analysisToggle);
        }
      }

      // Pre-empt normal left-click navigation into protected ChatGPT routes. This runs
      // in capture phase before React's router, so the protected page never paints first.
      if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        const anchor = getElementFromEvent(event, 'a[href]');
        if (anchor) {
          const targetUrl = new URL(anchor.getAttribute('href'), location.href);
          if (isKnownProtectedLibraryPath(location.href)) {
            rememberProtectedLibraryDescendantUrl(targetUrl.href);
          }
          const targetDescriptor = getProtectedRouteDescriptorForUrl(targetUrl.href);
          const sameUnlockedLane =
            (
              targetDescriptor?.key &&
              targetDescriptor.key === activeProtectedRouteKey &&
              protectedRouteUnlocked
            ) ||
            (targetDescriptor?.key === 'library-protected-files' && protectedLibraryNavigationUnlocked);
          const lockedMemoryModal =
            targetDescriptor?.key === 'personalization' &&
            targetDescriptor.modal === PERSONALIZATION_MEMORY_MODAL &&
            !protectedMemoryModalUnlocked;
          const lockedInstructions =
            targetDescriptor?.key === 'personalization' &&
            targetDescriptor.instructions === PERSONALIZATION_CHATGPT_INSTRUCTIONS &&
            !protectedPersonalizationInstructionsUnlocked;

          if (
            descriptorRequiresPassword(targetDescriptor) &&
            (!sameUnlockedLane || lockedMemoryModal || lockedInstructions)
          ) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            preArmProtectedRoute(targetDescriptor);

            let authKind = 'protected-route';
            if (sameUnlockedLane && lockedMemoryModal) authKind = 'memory-summary';
            else if (sameUnlockedLane && lockedInstructions) authKind = 'personalization-instructions';

            void beginNativePasswordFlow({
              kind: authKind,
              routeKey: targetDescriptor.key,
              title: targetDescriptor.title,
              returnUrl: targetUrl.href
            });
            return;
          }
        }
      }

      const bannerCloseMenu = getElementFromEvent(event, `#${CHATGPT_BANNER_CLOSE_MENU_ID}`);
      if (bannerCloseMenu) return;

      const customBannerMenuDetails = getElementFromEvent(event, `details[${CHATGPT_BANNER_MENU_DETAILS_ATTR}="true"]`);
      if (customBannerMenuDetails) return;

      const customBannerCloseButton = getElementFromEvent(event, 'button[data-bravefox-banner-button-action="close"]');
      if (customBannerCloseButton && closeCustomChatGptBannerFromButton(customBannerCloseButton)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      dismissCustomChatGptBannerCloseMenu();

      const menuItem = getElementFromEvent(event, '[role="menuitem"]');
      if (menuItem && isForbiddenMemoryDeleteItem(menuItem)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        hideElement(menuItem);
        menuItem.remove();
        return;
      }

      const memoryDeleteControl = getElementFromEvent(
        event,
        'button, [role="button"], [role="menuitem"]'
      );
      if (memoryDeleteControl && isForbiddenMemoryDeleteControl(memoryDeleteControl)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        hideElement(memoryDeleteControl);
        return;
      }

      const button = getButtonFromEvent(event);
      const memoryStatusControl = getMemoryStatusEscapeControl(event);

      // The memory-status button in a normal chat now opens the dedicated memories modal
      // at /settings/personalization?modal=memories. Route it through the native BraveFox
      // password page so the new direct URL cannot bypass the protected settings lane.
      if (
        !TEMP_DISABLE_ALL_PASSWORD_PROMPTS &&
        memoryStatusControl &&
        isMemoryStatusEscapeControl(memoryStatusControl)
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const returnUrl = new URL(PERSONALIZATION_PATH, location.origin);
        returnUrl.searchParams.set('modal', PERSONALIZATION_MEMORY_MODAL);

        preArmProtectedRoute({
          key: 'personalization',
          path: PERSONALIZATION_PATH,
          title: MEMORY_SUMMARY_PROMPT,
          modal: PERSONALIZATION_MEMORY_MODAL
        });
        void beginNativePasswordFlow({
          kind: 'memory-summary',
          routeKey: 'personalization',
          title: MEMORY_SUMMARY_PROMPT,
          returnUrl: returnUrl.href
        });
        return;
      }

      if (
        !TEMP_DISABLE_ALL_PASSWORD_PROMPTS &&
        button &&
        !replayAllowedButtons.has(button) &&
        isMemorySummaryManageButton(button)
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        void beginNativePasswordFlow({
          kind: 'memory-summary',
          routeKey: 'personalization',
          title: MEMORY_SUMMARY_PROMPT,
          returnUrl: location.href
        });
        return;
      }

      if (
        !TEMP_DISABLE_ALL_PASSWORD_PROMPTS &&
        button &&
        isPluginsRoute() &&
        !replayAllowedPluginButtons.has(button) &&
        isPluginInstallButton(button)
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void protectPluginInstallAction(button);
        return;
      }

      // Firefox Android is particularly sensitive to synchronous whole-document work
      // immediately after a tap. The always-on portal observer already catches newly
      // mounted menus there, so keep the legacy fallback scan for non-Android clients only.
      if (!IS_ANDROID && isLikelyMenuTrigger(event.target)) scheduleGeneralUiScan(false);
    }, true);

    document.addEventListener('submit', event => {
      if (event.isTrusted) captureConversationSendIntentFromEvent(event);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.isTrusted) captureConversationSendIntentFromEvent(event);

      if (event.isTrusted && (event.key === 'Enter' || event.key === ' ')) {
        const analysisToggle = getElementFromEvent(event, 'button[aria-expanded][aria-labelledby]');
        if (analysisToggle && isAnalysisActivityToggle(analysisToggle)) {
          markAnalysisActivityUserControlled(analysisToggle);
        }
      }

      if (event.key === 'Escape') {
        if (dismissCustomChatGptBannerCloseMenu()) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!IS_ANDROID && isLikelyMenuTrigger(event.target)) scheduleGeneralUiScan(false);
    }, true);
  }

  function ensureCustomChatGptBannerMenuTrigger(banner) {
    if (!(banner instanceof Element)) return null;

    const existing = banner.querySelector(`details[${CHATGPT_BANNER_MENU_DETAILS_ATTR}="true"]`);
    if (existing instanceof HTMLDetailsElement) return existing;

    const closeButton = findChatGptBannerCloseButton(banner);
    if (!(closeButton instanceof HTMLButtonElement)) return null;

    const details = document.createElement('details');
    details.setAttribute(CHATGPT_BANNER_MENU_DETAILS_ATTR, 'true');
    details.setAttribute('data-bravefox-owned-control', 'true');

    const summary = document.createElement('summary');
    summary.textContent = '⋯';
    summary.title = 'Notice options';
    summary.setAttribute('aria-label', 'Notice options');
    summary.setAttribute(CHATGPT_BANNER_MENU_TRIGGER_ATTR, 'true');
    details.appendChild(summary);

    const modelSlug = getCurrentChatGptBannerModelSlug(banner);
    const menu = document.createElement('div');
    menu.id = CHATGPT_BANNER_CLOSE_MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'BraveFox banner notice menu');
    menu.setAttribute('data-bravefox-banner-model-slug', modelSlug);

    const hideModelButton = document.createElement('button');
    hideModelButton.type = 'button';
    hideModelButton.setAttribute('role', 'menuitem');
    hideModelButton.textContent = 'Hide this notification permanently';
    hideModelButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      details.open = false;
      void hideCustomChatGptBannerForModelAndClose(banner, closeButton, modelSlug);
    });
    menu.appendChild(hideModelButton);

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.setAttribute('role', 'menuitem');
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      details.open = false;
    });
    menu.appendChild(cancelButton);

    details.appendChild(menu);

    try {
      closeButton.parentElement?.insertBefore(details, closeButton);
    } catch {
      return null;
    }

    return details;
  }

  function interceptCustomChatGptBannerNativeCloseEvent(event) {
    return false;
  }

  function closeCustomChatGptBannerFromButton(button) {
    if (!(button instanceof Element)) return false;
    const banner = button.closest(
      '[data-bravefox-banner-text-customized="true"], aside, [role="alert"], [role="status"]'
    );
    if (!(banner instanceof Element)) return false;

    const closeButton = findChatGptBannerCloseButton(banner);
    if (!(closeButton instanceof HTMLButtonElement) || closeButton === button) return false;

    return clickNativeChatGptBannerClose(closeButton);
  }

  function showCustomChatGptBannerCloseMenu(anchorButton) {
    if (!(anchorButton instanceof Element)) return false;
    const details = anchorButton.closest(`details[${CHATGPT_BANNER_MENU_DETAILS_ATTR}="true"]`);
    if (!(details instanceof HTMLDetailsElement)) return false;
    details.open = true;
    return true;
  }

  function placeCustomChatGptBannerCloseMenu(menu, anchor) {
    return Boolean(menu?.isConnected && anchor?.isConnected);
  }

  function dismissCustomChatGptBannerCloseMenu() {
    let changed = false;
    for (const details of document.querySelectorAll(`details[${CHATGPT_BANNER_MENU_DETAILS_ATTR}="true"][open]`)) {
      if (!(details instanceof HTMLDetailsElement)) continue;
      details.open = false;
      changed = true;
    }
    return changed;
  }

  function isElementActuallyVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle?.(element);
    return !style || (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0);
  }

  function getVisibleChatGptModelMenuChoices() {
    const selectors = '[role="menuitem"], [role="menuitemradio"], [role="option"], [role="radio"], button';
    return Array.from(document.querySelectorAll(selectors)).filter(element => {
      if (!isElementActuallyVisible(element)) return false;
      if (element.closest(`[data-bravefox-banner-text-customized="true"]`)) return false;
      const text = normalizeText(element.textContent);
      return Boolean(text && text.length <= 180);
    });
  }

  function findVisibleChatGptModelChoice(predicate) {
    for (const element of getVisibleChatGptModelMenuChoices()) {
      const text = normalizeText(element.textContent);
      if (predicate(text, element)) return element;
    }
    return null;
  }

  function getChatGptComposerModelSelector() {
    const preferred = Array.from(document.querySelectorAll('button.__composer-pill[aria-haspopup="menu"]'))
      .find(isElementActuallyVisible);
    if (preferred instanceof HTMLButtonElement) return preferred;

    return Array.from(document.querySelectorAll('button[aria-haspopup="menu"]')).find(button => {
      if (!(button instanceof HTMLButtonElement) || !isElementActuallyVisible(button)) return false;
      if (!button.closest('form')) return false;
      const text = normalizeText(button.textContent);
      return /\b\d+(?:\.\d+)?\b/.test(text) && !text.includes('attach') && !text.includes('liitä');
    }) || null;
  }

  function waitForChatGptUiChoice(predicate, timeoutMs = 1600) {
    return new Promise(resolve => {
      const startedAt = Date.now();
      const poll = () => {
        const found = findVisibleChatGptModelChoice(predicate);
        if (found || Date.now() - startedAt >= timeoutMs) {
          resolve(found || null);
          return;
        }
        window.setTimeout(poll, 60);
      };
      poll();
    });
  }

  async function switchChatGptComposerToGpt55Medium(banner, closeButton) {
    const selector = getChatGptComposerModelSelector();
    if (!(selector instanceof HTMLButtonElement)) return false;

    const current = normalizeText(selector.textContent);
    const alreadyGpt55 = current.includes('5.5');
    const alreadyMedium = THINKING_EFFORT_MEDIUM_LABELS.has(current) ||
      Array.from(THINKING_EFFORT_MEDIUM_LABELS).some(label => current.includes(label));

    if (alreadyGpt55 && alreadyMedium) {
      clickNativeChatGptBannerClose(closeButton);
      return true;
    }

    try { selector.click(); } catch { return false; }

    if (!alreadyGpt55) {
      const gpt55Choice = await waitForChatGptUiChoice(text => {
        if (!text.includes('5.5')) return false;
        if (text.includes('5.6') || text.includes('5.4') || text.includes('5.1')) return false;
        return true;
      });

      if (!(gpt55Choice instanceof Element)) return false;
      try { gpt55Choice.click(); } catch { return false; }
      await new Promise(resolve => window.setTimeout(resolve, 120));
    }

    let refreshedSelector = getChatGptComposerModelSelector();
    if (refreshedSelector instanceof HTMLButtonElement) {
      const refreshedText = normalizeText(refreshedSelector.textContent);
      if (refreshedText.includes('5.5') && Array.from(THINKING_EFFORT_MEDIUM_LABELS).some(label => refreshedText.includes(label))) {
        clickNativeChatGptBannerClose(closeButton);
        return true;
      }

      if (refreshedText.includes('5.5')) {
        try { refreshedSelector.click(); } catch {}
      }
    }

    const mediumChoice = await waitForChatGptUiChoice(text => {
      return THINKING_EFFORT_MEDIUM_LABELS.has(text) ||
        Array.from(THINKING_EFFORT_MEDIUM_LABELS).some(label => text === label || text.endsWith(` ${label}`));
    }, 1200);

    if (mediumChoice instanceof Element) {
      try { mediumChoice.click(); } catch {}
      await new Promise(resolve => window.setTimeout(resolve, 80));
    }

    refreshedSelector = getChatGptComposerModelSelector();
    const finalText = normalizeText(refreshedSelector?.textContent || '');
    const switchedToGpt55 = finalText.includes('5.5');
    const switchedToMedium = Array.from(THINKING_EFFORT_MEDIUM_LABELS).some(label => finalText.includes(label));

    if (switchedToGpt55 && switchedToMedium) clickNativeChatGptBannerClose(closeButton);
    return switchedToGpt55;
  }

  async function hideCustomChatGptBannerForModelAndClose(banner, closeButton, modelSlug) {
    dismissCustomChatGptBannerCloseMenu();
    const slug = normalizeChatGptModelSlug(modelSlug) || getCurrentChatGptBannerModelSlug(banner);
    if (slug) {
      await ensureHiddenChatGptBannerPrefsLoaded();
      hiddenChatGptBannerModelSlugs.add(slug);
      await saveHiddenChatGptBannerPrefs();
    }
    clickNativeChatGptBannerClose(closeButton);
    hideElement(banner);
    banner.remove();
  }

  function clickNativeChatGptBannerClose(closeButton) {
    if (!(closeButton instanceof HTMLButtonElement)) return false;
    nativeBannerCloseReplayAllowedButtons.add(closeButton);
    try {
      closeButton.click();
      return true;
    } catch {
      return false;
    } finally {
      window.setTimeout(() => nativeBannerCloseReplayAllowedButtons.delete(closeButton), 0);
    }
  }

  async function ensureHiddenChatGptBannerPrefsLoaded() {
    if (hiddenChatGptBannerPrefsLoaded) return hiddenChatGptBannerModelSlugs;
    if (hiddenChatGptBannerPrefsLoadPromise) return hiddenChatGptBannerPrefsLoadPromise;

    hiddenChatGptBannerPrefsLoadPromise = (async () => {
      try {
        const stored = await api?.storage?.local?.get?.([CHATGPT_BANNER_HIDE_KEY]);
        const rows = Array.isArray(stored?.[CHATGPT_BANNER_HIDE_KEY])
          ? stored[CHATGPT_BANNER_HIDE_KEY]
          : [];
        hiddenChatGptBannerModelSlugs = new Set(rows.map(normalizeChatGptModelSlug).filter(Boolean));
      } catch (error) {
        console.warn('[BraveFox Enhancer] Failed to load hidden ChatGPT banner model prefs:', error);
        hiddenChatGptBannerModelSlugs = new Set();
      } finally {
        hiddenChatGptBannerPrefsLoaded = true;
        hiddenChatGptBannerPrefsLoadPromise = null;
      }
      return hiddenChatGptBannerModelSlugs;
    })();

    return hiddenChatGptBannerPrefsLoadPromise;
  }

  async function saveHiddenChatGptBannerPrefs() {
    try {
      if (!api?.storage?.local?.set) return;
      await api.storage.local.set({
        [CHATGPT_BANNER_HIDE_KEY]: Array.from(hiddenChatGptBannerModelSlugs).sort()
      });
    } catch (error) {
      console.warn('[BraveFox Enhancer] Failed to save hidden ChatGPT banner model prefs:', error);
    }
  }

  function normalizeChatGptModelSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function getCurrentChatGptBannerModelSlug(banner) {
    const candidates = [];

    try {
      const selectedFromMessages = Array.from(document.querySelectorAll('[data-message-model-slug]'))
        .map(node => node.getAttribute('data-message-model-slug'))
        .filter(Boolean);
      candidates.push(...selectedFromMessages.reverse());
    } catch {}

    try {
      const url = new URL(location.href);
      candidates.push(url.searchParams.get('model'));
    } catch {}

    try {
      const text = normalizeText(banner?.textContent || '');
      if (text.includes('5.5') && text.includes('thinking')) candidates.push('gpt-5-5-thinking');
      if (text.includes('5.5')) candidates.push('gpt-5-5-thinking');
    } catch {}

    for (const candidate of candidates) {
      const normalized = normalizeChatGptModelSlug(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  function shouldHideCustomChatGptBannerForModel(banner) {
    // Compatibility fail-open: Firefox Android has shown timing-sensitive banner mounts.
    // Keep notices visible there rather than deleting them before first paint. Native
    // close still works; persisted BraveFox auto-hide remains enabled elsewhere.
    if (IS_FIREFOX_ANDROID) return false;
    const modelSlug = getCurrentChatGptBannerModelSlug(banner);
    return Boolean(modelSlug && hiddenChatGptBannerModelSlugs.has(modelSlug));
  }

  function getExactReasoningControl(target = null, allowGlobalFallback = true) {
    if (target instanceof Element) {
      const direct = target.closest(THINKING_EFFORT_EXACT_CONTROL_SELECTOR);
      if (direct instanceof Element) return direct;

      const popup = target.closest(
        '[role="menu"][data-state="open"], [data-radix-menu-content][data-state="open"], [data-radix-popper-content-wrapper]'
      );
      const nested = popup?.querySelector?.(THINKING_EFFORT_EXACT_CONTROL_SELECTOR);
      if (nested instanceof Element) return nested;
    }

    if (!allowGlobalFallback) return null;

    const controls = Array.from(document.querySelectorAll(THINKING_EFFORT_EXACT_CONTROL_SELECTOR))
      .filter(control => control instanceof HTMLElement && control.isConnected)
      .filter(control => {
        const rect = control.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0) return false;
        try {
          const style = window.getComputedStyle(control);
          return style.display !== 'none' && style.visibility !== 'hidden';
        } catch {
          return true;
        }
      });

    return controls.length === 1 ? controls[0] : null;
  }

  function getExactReasoningState(control) {
    if (!(control instanceof Element)) return null;
    const state = control.querySelector(THINKING_EFFORT_EXACT_STATE_SELECTOR);
    return state instanceof Element ? state : null;
  }

  function readExactReasoningValue(control) {
    const state = getExactReasoningState(control);
    if (!state) return null;
    const now = Number(state.getAttribute('aria-valuenow'));
    return Number.isFinite(now) ? now : null;
  }

  function isExactReasoningInstant(control) {
    return readExactReasoningValue(control) === 0;
  }

  function getExactReasoningPowerRoot(control) {
    if (!(control instanceof Element)) return null;
    const container = control.querySelector(THINKING_EFFORT_EXACT_ROOT_SELECTOR);
    if (!(container instanceof Element)) return null;

    const root = container.querySelector(':scope > [data-orientation="horizontal"]');
    if (root instanceof HTMLElement) return root;

    const fallback = container.querySelector('[data-orientation="horizontal"]');
    return fallback instanceof HTMLElement ? fallback : null;
  }

  function exactReasoningPointerTargetsInstant(control, clientX, target = null) {
    if (!(control instanceof Element) || !Number.isFinite(clientX)) return false;

    const root = getExactReasoningPowerRoot(control);
    if (!(root instanceof HTMLElement)) return false;
    if (target instanceof Element && !root.contains(target) && target !== root) return false;

    const rect = root.getBoundingClientRect?.();
    if (!rect || rect.width <= 30 || rect.height <= 0) return false;

    const left = rect.left + 13;
    const right = rect.right - 13;
    const usable = Math.max(1, right - left);
    const fraction = Math.max(0, Math.min(1, (clientX - left) / usable));
    const nearestStop = Math.round(fraction * 2);
    return nearestStop === 0;
  }

  function dispatchExactReasoningArrow(control, key) {
    if (!(control instanceof HTMLElement) || !control.isConnected) return false;

    try { control.focus({ preventScroll: true }); } catch { try { control.focus(); } catch {} }

    try {
      control.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      control.dispatchEvent(new KeyboardEvent('keyup', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
      return true;
    } catch {
      return false;
    }
  }

  function clickExactReasoningMediumStop(control) {
    const root = getExactReasoningPowerRoot(control);
    if (!(root instanceof HTMLElement) || !root.isConnected) return false;

    const rect = root.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    const clientX = rect.left + (rect.width / 2);
    const clientY = rect.top + (rect.height / 2);
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      button: 0
    };

    thinkingEffortVisualRepairing = true;
    try {
      if (typeof PointerEvent === 'function') {
        root.dispatchEvent(new PointerEvent('pointerdown', {
          ...init,
          pointerId: 777,
          pointerType: 'mouse',
          buttons: 1
        }));
        root.dispatchEvent(new PointerEvent('pointerup', {
          ...init,
          pointerId: 777,
          pointerType: 'mouse',
          buttons: 0
        }));
      }
      root.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 }));
      root.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
      root.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
      return true;
    } catch {
      return false;
    } finally {
      window.setTimeout(() => { thinkingEffortVisualRepairing = false; }, 30);
    }
  }

  function enforceExactReasoningFloor(control) {
    if (!(control instanceof Element) || !control.isConnected || !isExactReasoningInstant(control)) {
      return false;
    }
    if (exactReasoningRepairing.has(control)) return true;

    exactReasoningRepairing.add(control);
    dispatchExactReasoningArrow(control, 'ArrowRight');

    window.setTimeout(() => {
      if (!control.isConnected || !isExactReasoningInstant(control)) return;
      clickExactReasoningMediumStop(control);
    }, 24);

    window.setTimeout(() => {
      if (!control.isConnected || !isExactReasoningInstant(control)) return;
      dispatchExactReasoningArrow(control, 'ArrowRight');
    }, 70);

    window.setTimeout(() => exactReasoningRepairing.delete(control), 140);
    return true;
  }

  function enforceAllExactReasoningControls(scope = document) {
    const controls = [];
    if (scope instanceof Element && scope.matches?.(THINKING_EFFORT_EXACT_CONTROL_SELECTOR)) {
      controls.push(scope);
    }
    if (typeof scope?.querySelectorAll === 'function') {
      controls.push(...scope.querySelectorAll(THINKING_EFFORT_EXACT_CONTROL_SELECTOR));
    }
    for (const control of controls) enforceExactReasoningFloor(control);
  }

  function installExactReasoningStateObserver() {
    if (exactReasoningObserver) return;

    exactReasoningObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const state = mutation.target;
          if (!(state instanceof Element)) continue;
          if (!state.matches(THINKING_EFFORT_EXACT_STATE_SELECTOR)) continue;
          const control = state.closest(THINKING_EFFORT_EXACT_CONTROL_SELECTOR);
          if (control instanceof Element && isExactReasoningInstant(control)) {
            queueMicrotask(() => enforceExactReasoningFloor(control));
          }
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          const control = node.matches?.(THINKING_EFFORT_EXACT_CONTROL_SELECTOR)
            ? node
            : node.querySelector?.(THINKING_EFFORT_EXACT_CONTROL_SELECTOR);
          if (control instanceof Element) queueMicrotask(() => enforceExactReasoningFloor(control));
        }
      }
    });

    exactReasoningObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-valuenow']
    });
  }

  function installThinkingEffortEdgeLock() {
    installExactReasoningStateObserver();

    const cancelBlockedEdgeInteraction = event => {
      try { event.preventDefault(); } catch {}
      try { event.stopPropagation(); } catch {}
      try { event.stopImmediatePropagation(); } catch {}
    };

    const scheduleRepair = slider => {
      if (!(slider instanceof Element)) return;
      queueMicrotask(() => enforceThinkingEffortSliderEdges(slider));
      window.setTimeout(() => enforceThinkingEffortSliderEdges(slider), 40);
    };

    const pointerTargetsBlockedEdge = (slider, clientX) => {
      return thinkingEffortPointerTargetsInstant(slider, clientX) ||
        thinkingEffortPointerTargetsPro(slider, clientX);
    };

    document.addEventListener('pointerdown', event => {
      if (thinkingEffortVisualRepairing) return;

      const exactControl = getExactReasoningControl(event.target, false);
      if (exactControl) {
        const exactRoot = getExactReasoningPowerRoot(exactControl);
        const target = event.target instanceof Element ? event.target : null;
        if (exactRoot && target && (exactRoot === target || exactRoot.contains(target))) {
          activeExactReasoningControl = exactControl;
          activeExactReasoningPointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
          if (exactReasoningPointerTargetsInstant(exactControl, event.clientX, target)) {
            cancelBlockedEdgeInteraction(event);
            enforceExactReasoningFloor(exactControl);
            return;
          }
        }
      }

      if (thinkingEffortVisualPointerTargetsInstant(event)) {
        cancelBlockedEdgeInteraction(event);
        window.setTimeout(() => enforceThinkingEffortVisualPopup(event.target, false), 0);
        return;
      }

      if (isBlockedThinkingEffortTierControl(event.target)) {
        cancelBlockedEdgeInteraction(event);
        window.setTimeout(() => enforceThinkingEffortEdges(document), 0);
        return;
      }

      const slider = findThinkingEffortSliderForEvent(event, false);
      if (!slider) return;

      activeThinkingEffortSlider = slider;
      activeThinkingEffortPointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;

      if (pointerTargetsBlockedEdge(slider, event.clientX)) {
        cancelBlockedEdgeInteraction(event);
        scheduleRepair(slider);
      }
    }, true);

    document.addEventListener('pointermove', event => {
      const exactControl = activeExactReasoningControl;
      if (exactControl?.isConnected) {
        if (
          activeExactReasoningPointerId === null ||
          event.pointerId === activeExactReasoningPointerId
        ) {
          if (exactReasoningPointerTargetsInstant(exactControl, event.clientX)) {
            cancelBlockedEdgeInteraction(event);
            enforceExactReasoningFloor(exactControl);
            return;
          }
        }
      }

      const slider = activeThinkingEffortSlider;
      if (!slider?.isConnected) return;
      if (activeThinkingEffortPointerId !== null && event.pointerId !== activeThinkingEffortPointerId) return;
      if (!pointerTargetsBlockedEdge(slider, event.clientX)) return;

      cancelBlockedEdgeInteraction(event);
      scheduleRepair(slider);
    }, true);

    const finishPointerInteraction = event => {
      const exactControl = activeExactReasoningControl;
      if (
        exactControl?.isConnected &&
        Number.isFinite(event.clientX) &&
        exactReasoningPointerTargetsInstant(exactControl, event.clientX)
      ) {
        cancelBlockedEdgeInteraction(event);
        enforceExactReasoningFloor(exactControl);
      }
      activeExactReasoningControl = null;
      activeExactReasoningPointerId = null;

      const slider = activeThinkingEffortSlider;
      if (slider?.isConnected && Number.isFinite(event.clientX) && pointerTargetsBlockedEdge(slider, event.clientX)) {
        cancelBlockedEdgeInteraction(event);
        scheduleRepair(slider);
      }
      activeThinkingEffortSlider = null;
      activeThinkingEffortPointerId = null;
      window.setTimeout(() => enforceThinkingEffortVisualPopup(event.target, false), 0);
      window.setTimeout(() => enforceThinkingEffortVisualPopup(event.target, false), 50);
    };

    document.addEventListener('pointerup', finishPointerInteraction, true);
    document.addEventListener('pointercancel', finishPointerInteraction, true);

    document.addEventListener('click', event => {
      if (thinkingEffortVisualRepairing) return;

      const exactControl = getExactReasoningControl(event.target, false);
      if (exactControl) {
        const exactRoot = getExactReasoningPowerRoot(exactControl);
        const target = event.target instanceof Element ? event.target : null;
        if (
          exactRoot &&
          target &&
          (exactRoot === target || exactRoot.contains(target)) &&
          Number.isFinite(event.clientX) &&
          exactReasoningPointerTargetsInstant(exactControl, event.clientX, target)
        ) {
          cancelBlockedEdgeInteraction(event);
          enforceExactReasoningFloor(exactControl);
          return;
        }
      }

      if (thinkingEffortVisualPointerTargetsInstant(event)) {
        cancelBlockedEdgeInteraction(event);
        window.setTimeout(() => enforceThinkingEffortVisualPopup(event.target, false), 0);
        return;
      }

      if (isBlockedThinkingEffortTierControl(event.target)) {
        cancelBlockedEdgeInteraction(event);
        enforceThinkingEffortEdges(document);
        return;
      }

      if (isThinkingEffortTriggerControl(event.target)) {
        for (const delay of [0, 40, 100, 180, 320]) {
          window.setTimeout(() => {
            enforceAllExactReasoningControls(document);
            enforceThinkingEffortEdges(document);
            enforceThinkingEffortVisualPopup(document.activeElement);
          }, delay);
        }
      }

      const slider = findThinkingEffortSliderForEvent(event, false);
      if (!slider || !Number.isFinite(event.clientX)) return;
      if (!pointerTargetsBlockedEdge(slider, event.clientX)) return;

      cancelBlockedEdgeInteraction(event);
      scheduleRepair(slider);
    }, true);

    document.addEventListener('keydown', event => {
      const exactControl = getExactReasoningControl(event.target, false);
      if (exactControl) {
        const value = readExactReasoningValue(exactControl);
        const key = String(event.key || '');

        if (key === 'Home') {
          cancelBlockedEdgeInteraction(event);
          enforceExactReasoningFloor(exactControl);
          return;
        }

        if (
          (key === 'ArrowLeft' || key === 'ArrowDown' || key === 'PageDown') &&
          Number.isFinite(value) &&
          value <= 1
        ) {
          cancelBlockedEdgeInteraction(event);
          enforceExactReasoningFloor(exactControl);
          return;
        }
      }

      if (
        (event.key === 'Enter' || event.key === ' ') &&
        isBlockedThinkingEffortTierControl(event.target)
      ) {
        cancelBlockedEdgeInteraction(event);
        enforceThinkingEffortEdges(document);
        return;
      }

      if ((event.key === 'Enter' || event.key === ' ') && isThinkingEffortTriggerControl(event.target)) {
        for (const delay of [0, 40, 100, 180, 320]) {
          window.setTimeout(() => {
            enforceAllExactReasoningControls(document);
            enforceThinkingEffortEdges(document);
            enforceThinkingEffortVisualPopup(document.activeElement);
          }, delay);
        }
      }

      const slider = findThinkingEffortSliderForEvent(event, false);
      if (!slider) return;

      const key = String(event.key || '');
      if (key === 'Home') {
        cancelBlockedEdgeInteraction(event);
        scheduleRepair(slider);
        return;
      }

      if (key === 'End' && sliderHasProTierSignal(slider)) {
        cancelBlockedEdgeInteraction(event);
        scheduleRepair(slider);
        return;
      }

      if (key === 'ArrowLeft' || key === 'ArrowDown' || key === 'PageDown') {
        if (isThinkingEffortAtOrBelowMedium(slider)) {
          cancelBlockedEdgeInteraction(event);
          scheduleRepair(slider);
          return;
        }
        scheduleRepair(slider);
        return;
      }

      if (key === 'ArrowRight' || key === 'ArrowUp' || key === 'PageUp') {
        if (isThinkingEffortAtOrAbovePrePro(slider)) {
          cancelBlockedEdgeInteraction(event);
          scheduleRepair(slider);
          return;
        }
        scheduleRepair(slider);
      }
    }, true);

    for (const eventName of ['input', 'change', 'focusin']) {
      document.addEventListener(eventName, event => {
        const exactControl = getExactReasoningControl(event.target, false);
        if (exactControl && isExactReasoningInstant(exactControl)) {
          if (eventName !== 'focusin') cancelBlockedEdgeInteraction(event);
          enforceExactReasoningFloor(exactControl);
        }

        const slider = findThinkingEffortSliderForEvent(event, false);
        if (!slider) return;
        if (eventName !== 'focusin' && (isThinkingEffortInstant(slider) || isThinkingEffortPro(slider))) {
          cancelBlockedEdgeInteraction(event);
        }
        scheduleRepair(slider);
      }, true);
    }
  }

  function isThinkingEffortTriggerControl(target) {
    if (!(target instanceof Element)) return false;
    const control = target.closest('button, [role="button"], [aria-haspopup="menu"], [aria-haspopup="listbox"]');
    if (!control) return false;
    const context = normalizeText([
      control.textContent || '',
      control.getAttribute('aria-label') || '',
      control.getAttribute('title') || ''
    ].join(' '));
    return THINKING_EFFORT_CONTEXT_TERMS.some(term => context.includes(term));
  }

  function getThinkingEffortSliderCandidates(scope = document) {
    const result = [];
    if (scope instanceof Element && scope.matches?.(THINKING_EFFORT_SLIDER_SELECTOR)) result.push(scope);
    if (typeof scope?.querySelectorAll === 'function') {
      for (const slider of scope.querySelectorAll(THINKING_EFFORT_SLIDER_SELECTOR)) result.push(slider);
    }
    return result;
  }

  function getThinkingEffortLabel(slider) {
    if (!(slider instanceof Element)) return '';

    const ownValues = [
      slider.getAttribute('aria-valuetext'),
      slider.getAttribute('aria-label'),
      slider.getAttribute('title')
    ];
    for (const value of ownValues) {
      const normalized = normalizeText(value);
      if (THINKING_EFFORT_INSTANT_LABELS.has(normalized)) return 'instant';
      if (THINKING_EFFORT_MEDIUM_LABELS.has(normalized)) return 'medium';
      if (THINKING_EFFORT_HIGH_LABELS.has(normalized)) return 'high';
      if (THINKING_EFFORT_PRO_LABELS.has(normalized)) return 'pro';
    }

    let node = slider.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      if (!context || context.length > 180) continue;
      const words = context.split(/[^a-z0-9äöå]+/).filter(Boolean);
      if (words.some(word => THINKING_EFFORT_INSTANT_LABELS.has(word))) return 'instant';
      if (words.some(word => THINKING_EFFORT_MEDIUM_LABELS.has(word))) return 'medium';
      if (words.some(word => THINKING_EFFORT_HIGH_LABELS.has(word))) return 'high';
      if (words.some(word => THINKING_EFFORT_PRO_LABELS.has(word))) return 'pro';
    }

    return '';
  }

  function isThinkingEffortSlider(slider) {
    if (!(slider instanceof Element) || !slider.matches?.(THINKING_EFFORT_SLIDER_SELECTOR)) return false;

    const ownContext = normalizeText([
      slider.getAttribute('aria-label') || '',
      slider.getAttribute('aria-valuetext') || '',
      slider.getAttribute('title') || '',
      slider.getAttribute('name') || ''
    ].join(' '));
    if (THINKING_EFFORT_CONTEXT_TERMS.some(term => ownContext.includes(term))) return true;
    if (getThinkingEffortLabel(slider)) return true;

    let node = slider.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      if (!context || context.length > 240) continue;
      if (THINKING_EFFORT_CONTEXT_TERMS.some(term => context.includes(term))) return true;
    }

    return false;
  }

  function isThinkingEffortSliderVisible(slider) {
    if (!(slider instanceof Element) || !slider.isConnected) return false;
    const rect = slider.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    try {
      const style = window.getComputedStyle(slider);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    } catch {
      return true;
    }
  }

  function findThinkingEffortSliderInContainer(container) {
    if (!(container instanceof Element)) return null;

    if (
      container.matches?.(THINKING_EFFORT_SLIDER_SELECTOR) &&
      isThinkingEffortSlider(container)
    ) {
      return container;
    }

    for (const slider of container.querySelectorAll(THINKING_EFFORT_SLIDER_SELECTOR)) {
      if (!isThinkingEffortSliderVisible(slider)) continue;
      if (isThinkingEffortSlider(slider)) return slider;
    }

    return null;
  }

  function isBlockedThinkingEffortTierControl(target) {
    if (!(target instanceof Element)) return false;

    const control = target.closest(
      'button, [role="button"], [role="menuitem"], [role="option"], [role="radio"]'
    );
    if (!(control instanceof Element)) return false;

    const label = normalizeText([
      control.textContent || '',
      control.getAttribute('aria-label') || '',
      control.getAttribute('title') || '',
      control.getAttribute('aria-valuetext') || ''
    ].join(' '));

    const words = label.split(/[^a-z0-9äöå]+/).filter(Boolean);
    const instant = words.some(word => THINKING_EFFORT_INSTANT_LABELS.has(word));
    const pro = words.some(word => THINKING_EFFORT_PRO_LABELS.has(word));

    if (!instant && !pro) return false;

    // Avoid blocking unrelated words elsewhere on the page. Require either an open
    // picker/popover context or nearby reasoning-effort terminology/slider.
    let node = control;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      const hasReasoningContext =
        THINKING_EFFORT_CONTEXT_TERMS.some(term => context.includes(term));
      const hasSlider = Boolean(node.querySelector?.(THINKING_EFFORT_SLIDER_SELECTOR));
      const popupLike = node.matches?.(THINKING_EFFORT_POPUP_SELECTOR);

      if (hasReasoningContext || hasSlider || popupLike) return true;
    }

    return false;
  }

  function getThinkingEffortTierFromText(value) {
    const words = normalizeText(value).split(/[^a-z0-9äöå]+/).filter(Boolean);
    if (words.some(word => THINKING_EFFORT_INSTANT_LABELS.has(word))) return 'instant';
    if (words.some(word => THINKING_EFFORT_MEDIUM_LABELS.has(word))) return 'medium';
    if (words.some(word => THINKING_EFFORT_HIGH_LABELS.has(word))) return 'high';
    if (words.some(word => THINKING_EFFORT_PRO_LABELS.has(word))) return 'pro';
    return '';
  }

  function getThinkingEffortPopupTier(container) {
    if (!(container instanceof Element)) return '';

    for (const element of container.querySelectorAll('span, div, p, button')) {
      if (element.children.length !== 0) continue;
      const tier = getThinkingEffortTierFromText(element.textContent);
      if (tier) return tier;
    }

    return getThinkingEffortTierFromText(container.textContent);
  }

  function findThinkingEffortVisualTrack(container, preferredTarget = null) {
    if (!(container instanceof Element)) return null;
    const containerRect = container.getBoundingClientRect?.();
    if (!containerRect || containerRect.width < 120 || containerRect.height <= 0) return null;

    const candidates = [];
    const add = element => {
      if (!(element instanceof HTMLElement) || !element.isConnected) return;
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width < 120 || rect.width > Math.max(520, containerRect.width + 12)) return;
      if (rect.height < 4 || rect.height > 44) return;
      if ((rect.width / Math.max(1, rect.height)) < 4.5) return;
      if (normalizeText(element.textContent).length > 2) return;
      candidates.push({ element, rect });
    };

    if (preferredTarget instanceof Element) {
      let node = preferredTarget;
      for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
        if (node === container) break;
        add(node);
      }
    }

    for (const element of container.querySelectorAll('div, span, button, [role="slider"], input[type="range"]')) {
      add(element);
    }

    candidates.sort((a, b) => {
      const aScore = a.rect.width - (a.rect.height * 5);
      const bScore = b.rect.width - (b.rect.height * 5);
      return bScore - aScore;
    });
    return candidates[0]?.element || null;
  }

  function findThinkingEffortVisualPopup(target = null, allowGlobalFallback = true) {
    const inspect = element => {
      if (!(element instanceof HTMLElement) || !element.isConnected) return null;
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width < 140 || rect.width > 520 || rect.height < 45 || rect.height > 260) {
        return null;
      }
      const tier = getThinkingEffortPopupTier(element);
      if (!tier) return null;
      const track = findThinkingEffortVisualTrack(element, target);
      if (!track) return null;
      return element;
    };

    if (target instanceof Element) {
      let node = target;
      for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
        const found = inspect(node);
        if (found) return found;
      }
    }

    if (!allowGlobalFallback) return null;

    // Small, visible popovers only. This intentionally avoids scanning large page
    // regions whose prose may happen to contain the words Instant/Medium/High.
    for (const candidate of document.querySelectorAll(
      '[role="dialog"], [role="menu"], [role="listbox"], [data-state="open"], div'
    )) {
      if (!(candidate instanceof HTMLElement)) continue;
      if (!isElementActuallyVisible(candidate)) continue;
      const found = inspect(candidate);
      if (found) return found;
    }

    return null;
  }

  function getThinkingEffortVisualTrackRectForEvent(event) {
    const target = event?.target instanceof Element ? event.target : null;
    const popup = findThinkingEffortVisualPopup(target, false);
    if (!popup) return null;
    const track = findThinkingEffortVisualTrack(popup, target);
    if (!(track instanceof HTMLElement)) return null;
    const rect = track.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return null;
    return { popup, track, rect };
  }

  function thinkingEffortVisualPointerTargetsInstant(event) {
    if (!Number.isFinite(event?.clientX)) return false;
    const visual = getThinkingEffortVisualTrackRectForEvent(event);
    if (!visual) return false;
    const fraction = Math.max(0, Math.min(1, (event.clientX - visual.rect.left) / visual.rect.width));
    return fraction <= THINKING_EFFORT_VISUAL_INSTANT_CUTOFF;
  }

  function dispatchThinkingEffortTrackPoint(track, fraction) {
    if (!(track instanceof HTMLElement) || !track.isConnected) return false;
    const rect = track.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    const clientX = rect.left + (rect.width * fraction);
    const clientY = rect.top + (rect.height / 2);
    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX,
      clientY,
      button: 0,
      buttons: 1
    };

    thinkingEffortVisualRepairing = true;
    try {
      if (typeof PointerEvent === 'function') {
        track.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1, pointerType: 'mouse' }));
        track.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
      }
      track.dispatchEvent(new MouseEvent('mousedown', eventInit));
      track.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
      track.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));
      return true;
    } catch {
      return false;
    } finally {
      window.setTimeout(() => { thinkingEffortVisualRepairing = false; }, 20);
    }
  }

  function isFinnishThinkingEffortUi(popup = null) {
    if (/^fi(?:-|$)/i.test(String(document.documentElement.lang || ''))) return true;

    let node = popup instanceof Element ? popup : null;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      if (context.includes('päättelypanostus') || context.includes('paattelypanostus')) return true;
    }

    return false;
  }

  function repairThinkingEffortPopupLocalization(popup) {
    if (!(popup instanceof Element) || !popup.isConnected || !isFinnishThinkingEffortUi(popup)) {
      return false;
    }

    const replacements = new Map([
      ['instant', 'Välitön'],
      ['medium', 'Keskitaso'],
      ['high', 'Korkea']
    ]);
    const walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT);
    let changed = false;
    let node = walker.nextNode();

    while (node) {
      const value = String(node.nodeValue || '');
      const match = value.match(/^(\s*)(instant|medium|high)(\s*)$/i);
      if (match) {
        const replacement = replacements.get(match[2].toLowerCase());
        if (replacement) {
          node.nodeValue = `${match[1]}${replacement}${match[3]}`;
          changed = true;
        }
      }
      node = walker.nextNode();
    }

    return changed;
  }

  function enforceThinkingEffortVisualPopup(target = null, allowGlobalFallback = true) {
    const popup = findThinkingEffortVisualPopup(
      target instanceof Element ? target : null,
      allowGlobalFallback
    );
    if (!popup) return false;

    const tier = getThinkingEffortPopupTier(popup);
    repairThinkingEffortPopupLocalization(popup);
    if (tier !== 'instant') return false;

    const track = findThinkingEffortVisualTrack(popup, target instanceof Element ? target : null);
    if (!track) return false;

    // Aim squarely at an interior stop. This is a fallback for revamp variants that
    // render a visual track but expose no usable role=slider/range state to BraveFox.
    const repaired = dispatchThinkingEffortTrackPoint(track, 0.50);
    if (repaired) {
      for (const delay of [0, 40, 100, 180]) {
        window.setTimeout(() => repairThinkingEffortPopupLocalization(popup), delay);
      }
    }
    return repaired;
  }

  function findThinkingEffortSliderForEvent(event, allowGlobalFallback = true) {
    const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
    const seen = new Set();

    const inspect = node => {
      if (!(node instanceof Element) || seen.has(node)) return null;
      seen.add(node);
      return findThinkingEffortSliderInContainer(node);
    };

    for (let i = 0; i < path.length && i < 10; i += 1) {
      const found = inspect(path[i]);
      if (found) return found;
    }

    const target = event?.target instanceof Element ? event.target : null;
    if (target) {
      const direct = inspect(target);
      if (direct) return direct;

      // New picker: the visual track can be a sibling of the role=slider thumb.
      // Search the surrounding popup/menu instead of assuming the event path crosses
      // the slider element itself.
      let node = target.parentElement;
      for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
        const found = inspect(node);
        if (found) return found;

        if (node.matches?.(THINKING_EFFORT_POPUP_SELECTOR)) {
          const popupSlider = findThinkingEffortSliderInContainer(node);
          if (popupSlider) return popupSlider;
        }
      }
    }

    if (!allowGlobalFallback) return null;

    // Final fallback: if exactly one visible reasoning-effort slider exists in the
    // open UI, it is the picker being interacted with.
    const visible = getThinkingEffortSliderCandidates(document)
      .filter(isThinkingEffortSliderVisible)
      .filter(isThinkingEffortSlider);

    return visible.length === 1 ? visible[0] : null;
  }

  function readThinkingEffortRange(slider) {
    if (!(slider instanceof Element)) return null;
    const read = (attr, fallback) => {
      const raw = slider.getAttribute(attr);
      const value = raw === null || raw === '' ? Number(fallback) : Number(raw);
      return Number.isFinite(value) ? value : NaN;
    };

    const min = read('aria-valuemin', slider instanceof HTMLInputElement ? slider.min : NaN);
    const max = read('aria-valuemax', slider instanceof HTMLInputElement ? slider.max : NaN);
    const now = read('aria-valuenow', slider instanceof HTMLInputElement ? slider.value : NaN);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(now) || max <= min) return null;

    return { min, max, now, medium: min + ((max - min) / 2) };
  }

  function getThinkingEffortInputStep(slider, range) {
    if (!(slider instanceof HTMLInputElement) || slider.type !== 'range' || !range) return NaN;
    const raw = String(slider.step || '').trim().toLowerCase();
    if (raw && raw !== 'any') {
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 1;
  }

  function isThinkingEffortInstant(slider) {
    if (!isThinkingEffortSlider(slider)) return false;
    const label = getThinkingEffortLabel(slider);
    if (label === 'instant') return true;
    if (label === 'medium' || label === 'high' || label === 'pro') return false;
    const range = readThinkingEffortRange(slider);
    if (range) return range.now <= range.min + ((range.max - range.min) * 0.125);
    return false;
  }

  function isThinkingEffortPro(slider) {
    if (!isThinkingEffortSlider(slider)) return false;
    const label = getThinkingEffortLabel(slider);
    if (label === 'pro') return true;
    if (label === 'instant' || label === 'medium' || label === 'high') return false;
    if (!sliderHasProTierSignal(slider)) return false;
    const range = readThinkingEffortRange(slider);
    if (range) return range.now >= range.max - ((range.max - range.min) * 0.125);
    return false;
  }

  function isThinkingEffortAtOrBelowMedium(slider) {
    if (!isThinkingEffortSlider(slider)) return false;
    const range = readThinkingEffortRange(slider);
    if (range) return range.now <= range.medium + ((range.max - range.min) * 0.08);
    const label = getThinkingEffortLabel(slider);
    return label === 'instant' || label === 'medium';
  }

  function isThinkingEffortAtOrAbovePrePro(slider) {
    if (!isThinkingEffortSlider(slider) || !sliderHasProTierSignal(slider)) return false;
    const range = readThinkingEffortRange(slider);
    if (range) {
      const step = getThinkingEffortInputStep(slider, range);
      if (Number.isFinite(step) && step > 0) return range.now >= range.max - step - 1e-9;
      return range.now >= range.max - ((range.max - range.min) * 0.34);
    }
    return isThinkingEffortPro(slider);
  }

  function sliderHasProTierSignal(slider) {
    if (!(slider instanceof Element)) return false;

    const ownValues = [
      slider.getAttribute('aria-valuetext'),
      slider.getAttribute('aria-label'),
      slider.getAttribute('title'),
      slider.getAttribute('name')
    ];
    for (const value of ownValues) {
      const words = normalizeText(value).split(/[^a-z0-9äöå]+/).filter(Boolean);
      if (words.some(word => THINKING_EFFORT_PRO_LABELS.has(word))) return true;
    }

    let node = slider.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      if (context && context.length <= 240) {
        const words = context.split(/[^a-z0-9äöå]+/).filter(Boolean);
        if (words.some(word => THINKING_EFFORT_PRO_LABELS.has(word))) return true;
      }

      if (typeof node.querySelectorAll === 'function') {
        for (const element of node.querySelectorAll('[aria-label], [title]')) {
          const words = normalizeText([
            element.getAttribute('aria-label') || '',
            element.getAttribute('title') || ''
          ].join(' ')).split(/[^a-z0-9äöå]+/).filter(Boolean);
          if (words.some(word => THINKING_EFFORT_PRO_LABELS.has(word))) return true;
        }
      }
    }

    const range = readThinkingEffortRange(slider);
    if (!range) return false;

    if (slider instanceof HTMLInputElement && slider.type === 'range') {
      const step = getThinkingEffortInputStep(slider, range);
      if (Number.isFinite(step) && step > 0) {
        const stops = Math.round((range.max - range.min) / step) + 1;
        if (stops >= 4 && stops <= 8) return true;
      }
    }

    const span = range.max - range.min;
    return Number.isInteger(range.min) && Number.isInteger(range.max) && span >= 3 && span <= 7;
  }

  function getThinkingEffortInteractionRect(slider) {
    if (!(slider instanceof Element)) return null;
    const sliderRect = slider.getBoundingClientRect?.();
    if (sliderRect && sliderRect.width >= 120 && sliderRect.height > 0 && sliderRect.height <= 70) return sliderRect;

    let node = slider.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 120 || rect.height <= 0 || rect.height > 70) continue;
      return rect;
    }
    return sliderRect || null;
  }

  function thinkingEffortPointerTargetsInstant(slider, clientX) {
    if (!isThinkingEffortSlider(slider) || !Number.isFinite(clientX)) return false;
    const rect = getThinkingEffortInteractionRect(slider);
    if (!rect || rect.width <= 0) return false;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return fraction <= THINKING_EFFORT_INSTANT_CUTOFF;
  }

  function thinkingEffortPointerTargetsPro(slider, clientX) {
    if (!isThinkingEffortSlider(slider) || !sliderHasProTierSignal(slider) || !Number.isFinite(clientX)) return false;
    const rect = getThinkingEffortInteractionRect(slider);
    if (!rect || rect.width <= 0) return false;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return fraction >= THINKING_EFFORT_PRO_CUTOFF;
  }

  function enforceThinkingEffortSliderFloor(slider) {
    if (!slider?.isConnected || !isThinkingEffortSlider(slider) || !isThinkingEffortInstant(slider)) return false;
    if (thinkingEffortRepairing.has(slider)) return true;

    thinkingEffortRepairing.add(slider);
    try {
      if (slider instanceof HTMLInputElement && slider.type === 'range') {
        const range = readThinkingEffortRange(slider);
        if (!range) return false;
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (valueSetter) valueSetter.call(slider, String(range.medium));
        else slider.value = String(range.medium);
        slider.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        return true;
      }

      try { slider.focus({ preventScroll: true }); } catch { try { slider.focus(); } catch {} }
      slider.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true
      }));
      slider.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true
      }));

      // React/Radix can commit the aria value one render later. Re-check once after
      // that render and nudge again only if the control is still on Instant.
      window.setTimeout(() => {
        if (!slider.isConnected || !isThinkingEffortInstant(slider)) return;
        try { slider.focus({ preventScroll: true }); } catch {}
        slider.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true
        }));
        slider.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true
        }));
      }, 30);

      return true;
    } finally {
      window.setTimeout(() => thinkingEffortRepairing.delete(slider), 80);
    }
  }

  function enforceThinkingEffortSliderCeiling(slider) {
    if (!slider?.isConnected || !isThinkingEffortSlider(slider) || !isThinkingEffortPro(slider)) return false;
    if (thinkingEffortRepairing.has(slider)) return true;

    thinkingEffortRepairing.add(slider);
    try {
      if (slider instanceof HTMLInputElement && slider.type === 'range') {
        const range = readThinkingEffortRange(slider);
        if (!range) return false;
        const step = getThinkingEffortInputStep(slider, range);
        const previousValue = Number.isFinite(step) && step > 0
          ? Math.max(range.min, range.max - step)
          : range.medium;
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (valueSetter) valueSetter.call(slider, String(previousValue));
        else slider.value = String(previousValue);
        slider.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        return true;
      }

      try { slider.focus({ preventScroll: true }); } catch { try { slider.focus(); } catch {} }
      slider.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true, cancelable: true
      }));
      slider.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true, cancelable: true
      }));
      return true;
    } finally {
      window.setTimeout(() => thinkingEffortRepairing.delete(slider), 80);
    }
  }

  function enforceThinkingEffortSliderEdges(slider) {
    if (!slider?.isConnected || !isThinkingEffortSlider(slider)) return false;
    if (isThinkingEffortInstant(slider)) return enforceThinkingEffortSliderFloor(slider);
    if (isThinkingEffortPro(slider)) return enforceThinkingEffortSliderCeiling(slider);
    return false;
  }

  function enforceThinkingEffortEdges(scope = document) {
    for (const slider of getThinkingEffortSliderCandidates(scope)) {
      enforceThinkingEffortSliderEdges(slider);
    }
  }

  function isLikelyMenuTrigger(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
      'button[aria-haspopup="menu"], button[aria-haspopup="listbox"], [role="button"][aria-haspopup="menu"], [role="button"][aria-haspopup="listbox"]'
    ));
  }

  function getElementFromEvent(event, selector) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof Element && node.matches(selector)) return node;
    }
    return event.target instanceof Element ? event.target.closest(selector) : null;
  }

  function getButtonFromEvent(event) {
    const element = getElementFromEvent(event, 'button');
    return element instanceof HTMLButtonElement ? element : null;
  }

  function isDeleteAllMemoriesItem(menuItem) {
    return DELETE_ALL_MEMORY_LABELS.has(normalizeText(menuItem.textContent));
  }

  function isSingleMemoryDeleteItem(menuItem) {
    const label = normalizeText(menuItem?.textContent);
    if (!DELETE_SINGLE_MEMORY_LABELS.has(label)) return false;

    // New UI: on the Saved Memories route, Poista/Delete rendered as a Radix menuitem
    // is the destructive per-memory action. Route scoping keeps this from affecting
    // unrelated Delete items elsewhere in ChatGPT.
    if (isPersonalizationMemoryModalUrl() && menuItem.matches?.('[role="menuitem"]')) {
      return true;
    }

    // Legacy UI fallback.
    if (!hasSavedMemoriesDialogOpen()) return false;
    if (menuItem.getAttribute('data-color') === 'danger') return true;

    return Boolean(document.querySelector(
      'button[aria-label^="Lisää vaihtoehtoja muistille:"], button[aria-label^="More options for memory:"]'
    ));
  }

  function isForbiddenMemoryDeleteItem(menuItem) {
    return isDeleteAllMemoriesItem(menuItem) || isSingleMemoryDeleteItem(menuItem);
  }

  function isForbiddenMemoryDeleteControl(control) {
    if (!(control instanceof Element) || !hasSavedMemoriesDialogOpen()) return false;

    const label = normalizeText(control.textContent);
    if (DELETE_ALL_MEMORY_LABELS.has(label)) return true;
    if (DELETE_SINGLE_MEMORY_LABELS.has(label)) return true;

    return false;
  }

  function hasSavedMemoriesDialogOpen() {
    // In the new UI the URL itself is authoritative; the modal/popover structure can
    // change independently of the route and no longer always exposes the old Radix hooks.
    if (isPersonalizationMemoryModalUrl()) return true;

    for (const dialog of document.querySelectorAll('[role="dialog"][data-state="open"], [role="dialog"], [aria-modal="true"]')) {
      if (!(dialog instanceof Element)) continue;

      if (dialog.querySelector('#memories-search, input[name="memories-search"]')) return true;

      const title = dialog.querySelector('h1, h2, [id^="radix-"]');
      const titleText = normalizeText(title?.textContent);
      if (SAVED_MEMORIES_DIALOG_LABELS.some(label => titleText.includes(label))) return true;

      const dialogText = normalizeText(dialog.textContent);
      if (SAVED_MEMORIES_DIALOG_LABELS.some(label => dialogText.includes(label))) return true;
    }
    return false;
  }

  function getMemoryStatusEscapeControl(event) {
    return getElementFromEvent(event, 'button, [role="button"], a');
  }

  function isMemoryStatusEscapeControl(control) {
    if (!(control instanceof Element)) return false;
    if (!MEMORY_STATUS_TRIGGER_LABELS.has(normalizeText(control.textContent))) return false;

    // Personalization is already protected by the route gate. Never interfere with
    // legitimate memory controls after that lane has been explicitly unlocked.
    if (isPersonalizationRoute() && protectedRouteUnlocked) return false;
    return true;
  }

  function isMemorySummaryManageButton(button) {
    if (!isPersonalizationRoute() || !protectedRouteUnlocked) return false;
    if (!MANAGE_LABELS.has(normalizeText(button.textContent))) return false;

    let node = button;
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      const context = normalizeText(node.textContent);
      if (MEMORY_SUMMARY_LABELS.some(label => context.includes(label))) return true;
    }
    return false;
  }

  function replayManageClick(originalButton) {
    const button = originalButton?.isConnected ? originalButton : findMemorySummaryManageButton();
    if (!button) return;

    replayAllowedButtons.add(button);
    try {
      button.click();
    } finally {
      queueMicrotask(() => replayAllowedButtons.delete(button));
    }
  }

  function findMemorySummaryManageButton() {
    for (const button of document.querySelectorAll('button')) {
      if (!MANAGE_LABELS.has(normalizeText(button.textContent))) continue;

      let node = button;
      for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
        const context = normalizeText(node.textContent);
        if (MEMORY_SUMMARY_LABELS.some(label => context.includes(label))) return button;
      }
    }
    return null;
  }

  function configureRouteObserver() {
    const descriptor = getProtectedRouteDescriptor();
    const routeKey = descriptor?.key || null;
    const needsObserver =
      routeKey === 'personalization' ||
      routeKey === 'plugins' ||
      routeKey === 'gpts';

    if (!needsObserver) {
      routeObserver?.disconnect();
      routeObserver = null;
      if (routeMaintenanceTimer) {
        clearTimeout(routeMaintenanceTimer);
        routeMaintenanceTimer = 0;
      }
      return;
    }

    if (routeObserver) return;

    // Protected directory/settings pages can lazy-load a lot of React nodes. Batch all
    // mutation bursts into one cheap route-specific maintenance pass rather than scanning
    // every added subtree individually.
    routeObserver = new MutationObserver(() => {
      queueRouteCheck();
      scheduleRouteMaintenance();
    });

    routeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    scheduleRouteMaintenance(0);
  }

  function installEscapeHatchObserver() {
    if (escapeHatchObserver) return;

    const start = () => {
      if (escapeHatchObserver || !document.documentElement) return;

      escapeHatchObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded') {
            collapseAnalysisActivityPanels(mutation.target);
            continue;
          }

          if (mutation.type === 'characterData') {
            const parent = mutation.target?.parentElement;
            if (parent instanceof Element && mayContainConversationMessage(parent)) {
              scheduleLiveConversationMetadataRefresh(parent);
            }
            continue;
          }

          for (const addedNode of mutation.addedNodes) {
            const node = addedNode instanceof Element ? addedNode : addedNode.parentElement;
            if (!(node instanceof Element)) continue;

            // Library > New is portal-mounted after the pointer event. Curate that freshly
            // inserted popup from this pre-paint observer instead of relying on ChatGPT's
            // current menu wrapper attributes, which rotate between UI generations.
            if (isChatGptLibraryLocation()) {
              const libraryNodeText = normalizeText(node.textContent);
              if (
                document.documentElement.classList.contains(CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS) ||
                isConversationArchiveLibraryUploadText(libraryNodeText)
              ) {
                reconcileConversationArchiveLibraryNewMenu();
              }
            }

            // MutationObserver callbacks run before the browser's next paint. Collapse new
            // reasoning/activity panels here so expanded analysis does not become a scroll wall.
            collapseAnalysisActivityPanels(node);

            // Keep the sidebar's staged reveal synchronized before the browser paints new rows.
            // Library releases the top navigation; Projects releases Recent + chat history.
            if (mayAffectSidebarStageReveal(node)) maintainSidebarStageReveal(node);

            // Radix menus/settings dialogs are portal-mounted after the click that opens
            // them. The same already-cheap observer also notices top-level ChatGPT banners
            // and the specifically matched fixed assistant notice, avoiding extra observers.
            const memoryUiActive = isPersonalizationMemoryModalUrl();
            const relevantMemoryUpgradeBanner =
              memoryUiActive &&
              (
                node.matches?.(
                  'div.flex.w-full.flex-col, aside.relative.isolate.flex.w-full.overflow-hidden.bg-surface'
                ) ||
                node.querySelector?.(
                  'div.flex.w-full.flex-col > aside.relative.isolate.flex.w-full.overflow-hidden.bg-surface div.tracking-announcement-body'
                )
              );

            if (relevantMemoryUpgradeBanner) hideEnhancedMemoryBanners(node);

            const escapeSelector =
              '[role="menu"], [role="dialog"], [role="menuitem"], a[href="/plugins"]' +
              (memoryUiActive
                ? ', button, [role="button"], button[aria-haspopup="menu"][aria-label="Lisää toimintoja"], button[aria-haspopup="menu"][aria-label="More actions"]'
                : '');
            const relevantEscapeHatch =
              node.matches(escapeSelector) ||
              node.querySelector(escapeSelector);
            const relevantSidebarControl =
              node.matches?.(
                'button[data-sidebar-destination="builtin:customize"], ' +
                'button[data-sidebar-destination="builtin:skills"], ' +
                'button[aria-haspopup="dialog"][data-slot="popover-trigger"], ' +
                'button.sidebar-item[aria-haspopup="menu"]'
              ) ||
              node.querySelector?.(
                'button[data-sidebar-destination="builtin:customize"], ' +
                'button[data-sidebar-destination="builtin:skills"], ' +
                'button[aria-haspopup="dialog"][data-slot="popover-trigger"], ' +
                'button.sidebar-item[aria-haspopup="menu"]'
              );
            if (relevantSidebarControl) hideNewSidebarControls(node);
            if (memoryUiActive) hideSavedMemoryOverviewControls(node);

            if (
              node.matches?.('[role="dialog"], [role="menu"], [role="listbox"], [data-state="open"]') ||
              node.querySelector?.('[role="dialog"], [role="menu"], [role="listbox"], [data-state="open"]')
            ) {
              window.setTimeout(() => enforceThinkingEffortVisualPopup(node, false), 0);
            }

            const relevantDeleteAccountUi = mayContainDeleteAccountSettingsUi(node);
            if (relevantDeleteAccountUi) hideDeleteAccountSettingsUi(node);

            const relevantBillingRow = mayContainBillingSubscriptionUi(node);

            if (relevantBillingRow) customizeBillingSubscriptionRow(node);

            const relevantHomeHeadline = mayContainCustomizableHomeHeadline(node);
            if (relevantHomeHeadline) replaceCustomizableHomeHeadline(node);

            const relevantBanner = mayContainCustomizableChatGptBanner(node);
            const relevantComposerModelSelector =
              node.matches?.('button.__composer-pill[aria-haspopup="menu"]') ||
              node.querySelector?.('button.__composer-pill[aria-haspopup="menu"]');
            if (relevantComposerModelSelector) scheduleConversationSelectionFastRefresh();

            const relevantConversationMessage = mayContainConversationMessage(node);
            if (relevantConversationMessage) {
              scheduleLiveConversationMetadataRefresh(node);
              replaceCustomizableAssistantErrorText(node);
            }
            const relevantAssistantNotice = mayContainFixedAssistantNotice(node);
            if (
              !relevantEscapeHatch &&
              !relevantHomeHeadline &&
              !relevantBanner &&
              !relevantAssistantNotice &&
              !relevantConversationMessage &&
              !relevantSidebarControl &&
              !relevantMemoryUpgradeBanner &&
              !relevantDeleteAccountUi &&
              !relevantBillingRow
            ) {
              continue;
            }

            if (relevantBanner) {
              if (IS_FIREFOX_ANDROID) {
                window.setTimeout(() => {
                  if (node.isConnected) replaceCustomizableChatGptBannerText(node);
                  else replaceCustomizableChatGptBannerText(document);
                }, 48);
              } else {
                replaceCustomizableChatGptBannerText(node);
              }
            }
            if (relevantAssistantNotice) replaceFixedAssistantNoticeText(node);
            if (relevantDeleteAccountUi) hideDeleteAccountSettingsUi(node);
            if (relevantBillingRow) customizeBillingSubscriptionRow(node);
            if (!relevantEscapeHatch && !relevantDeleteAccountUi) continue;

            applyAccountAndSettingsCleanup(node);
            if (isPersonalizationRoute()) hideSensitiveMemoryControls(node);
          }
        }
      });

      escapeHatchObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-expanded']
      });
    };

    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function scheduleRouteMaintenance(delay = 70) {
    if (routeMaintenanceTimer) clearTimeout(routeMaintenanceTimer);
    routeMaintenanceTimer = window.setTimeout(() => {
      routeMaintenanceTimer = 0;
      const route = getProtectedRouteDescriptor()?.key;

      if (!document.getElementById(STYLE_ID)) injectStyles();

      // Protected pages are unusually mutation-heavy; keep the tiny sidebar policy
      // reasserted here so React cannot permanently evict the custom Kuvat/Images item.
      polishSidebarNavigation();
      removePluginFeaturedPromo(document);

      if (route === 'personalization') {
        hideSensitiveMemoryControls(document);
        cleanChatGptUi(document);
      } else if (route === 'plugins') {
        void applyPluginPagePolicy(document);
      } else if (route === 'gpts') {
        applyGptPagePolicy(document);
      }
    }, delay);
  }

  function getAnalysisActivityLabel(button) {
    if (!(button instanceof HTMLButtonElement)) return '';

    const labelledBy = String(button.getAttribute('aria-labelledby') || '').trim();
    if (labelledBy) {
      const label = document.getElementById(labelledBy);
      const text = normalizeText(label?.textContent);
      if (text) return text;
    }

    return normalizeText(
      button.parentElement?.querySelector?.('span[aria-live="polite"]')?.textContent
    );
  }

  function isAnalysisActivityToggle(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (!button.hasAttribute('aria-expanded')) return false;
    return ANALYSIS_ACTIVITY_LABELS.has(getAnalysisActivityLabel(button));
  }

  function getAnalysisActivityContainer(button) {
    if (!(button instanceof HTMLButtonElement)) return null;
    const header = button.parentElement;
    if (!(header instanceof Element)) return button;
    return header.parentElement instanceof Element ? header.parentElement : header;
  }

  function getAnalysisActivityKey(button) {
    if (!(button instanceof HTMLButtonElement)) return '';
    const labelledBy = String(button.getAttribute('aria-labelledby') || '').trim();
    if (!labelledBy) return '';
    return `${location.pathname}|${labelledBy}`;
  }

  function markAnalysisActivityUserControlled(button) {
    if (!isAnalysisActivityToggle(button)) return false;

    const key = getAnalysisActivityKey(button);
    if (key) userControlledAnalysisActivityKeys.add(key);

    button.setAttribute(ANALYSIS_ACTIVITY_USER_ATTR, 'true');
    button.removeAttribute(ANALYSIS_ACTIVITY_PENDING_ATTR);
    button.parentElement?.setAttribute?.(ANALYSIS_ACTIVITY_USER_ATTR, 'true');
    getAnalysisActivityContainer(button)?.setAttribute?.(ANALYSIS_ACTIVITY_USER_ATTR, 'true');
    return true;
  }

  function isAnalysisActivityUserControlled(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.getAttribute(ANALYSIS_ACTIVITY_USER_ATTR) === 'true') return true;
    if (button.parentElement?.getAttribute?.(ANALYSIS_ACTIVITY_USER_ATTR) === 'true') return true;
    if (getAnalysisActivityContainer(button)?.getAttribute?.(ANALYSIS_ACTIVITY_USER_ATTR) === 'true') return true;

    const key = getAnalysisActivityKey(button);
    return Boolean(key && userControlledAnalysisActivityKeys.has(key));
  }

  function collapseAnalysisActivityToggle(button) {
    if (!isAnalysisActivityToggle(button)) return false;
    if (button.getAttribute('aria-expanded') !== 'true') {
      button.removeAttribute(ANALYSIS_ACTIVITY_PENDING_ATTR);
      return false;
    }
    if (isAnalysisActivityUserControlled(button)) return false;
    if (button.getAttribute(ANALYSIS_ACTIVITY_PENDING_ATTR) === 'true') return false;

    button.setAttribute(ANALYSIS_ACTIVITY_PENDING_ATTR, 'true');
    try {
      button.click();
      return true;
    } catch {
      button.removeAttribute(ANALYSIS_ACTIVITY_PENDING_ATTR);
      return false;
    }
  }

  function collapseAnalysisActivityPanels(scope = document) {
    if (!scope) return;

    if (scope instanceof HTMLButtonElement) {
      collapseAnalysisActivityToggle(scope);
    } else if (scope instanceof Element) {
      const ownButton = scope.closest?.('button[aria-expanded][aria-labelledby]');
      if (ownButton instanceof HTMLButtonElement) collapseAnalysisActivityToggle(ownButton);

      // React may append the live label after the button. In that case the added node is
      // the label/span rather than the header, so inspect its immediate parent for the toggle.
      const siblingButton = scope.parentElement?.querySelector?.(
        'button[aria-expanded="true"][aria-labelledby]'
      );
      if (siblingButton instanceof HTMLButtonElement) collapseAnalysisActivityToggle(siblingButton);
    }

    if (typeof scope.querySelectorAll !== 'function') return;
    for (const button of scope.querySelectorAll('button[aria-expanded="true"][aria-labelledby]')) {
      collapseAnalysisActivityToggle(button);
    }
  }

  function scheduleGeneralUiScan(immediate = false) {
    if (uiScanTimer) {
      clearTimeout(uiScanTimer);
      uiScanTimer = 0;
    }
    if (uiScanRetryTimer) {
      clearTimeout(uiScanRetryTimer);
      uiScanRetryTimer = 0;
    }

    const firstDelay = immediate ? 0 : 20;
    uiScanTimer = window.setTimeout(() => {
      uiScanTimer = 0;
      runGeneralUiScan(document);
    }, firstDelay);

    // React portals can mount one task later than the click that opened them. One small
    // retry is much cheaper than a permanent observer over the entire conversation DOM.
    if (!immediate) {
      uiScanRetryTimer = window.setTimeout(() => {
        uiScanRetryTimer = 0;
        runGeneralUiScan(document);
      }, 140);
    }
  }

  function runGeneralUiScan(scope) {
    ensureConversationArchiveButton();
    if (isPersonalizationRoute()) hideSensitiveMemoryControls(scope);
    if (isPluginsRoute()) void applyPluginPagePolicy(document);
    if (isGptsRoute()) applyGptPagePolicy(document);
    cleanChatGptUi(scope);
  }

  function forEachMatch(scope, selector, callback) {
    if (!scope) return;

    if (scope instanceof Element && scope.matches(selector)) {
      callback(scope);
    }

    if (typeof scope.querySelectorAll !== 'function') return;
    for (const element of scope.querySelectorAll(selector)) {
      callback(element);
    }
  }

  function hideSensitiveMemoryControls(scope = document) {
    if (!isPersonalizationRoute()) return;

    // Base Personalization page: only hide the exact memory-enable row.
    // Modal-only cleanup stays out of the base page so generated-class changes cannot
    // accidentally hide the full settings content area.
    hideMemoryEnableRows(scope);

    if (isPersonalizationMemoryModalUrl()) {
      hideSavedMemoryOverviewControls(scope);
      hideEnhancedMemoryBanners(scope);
      removeForbiddenMemoryDeleteItems(scope);
    }
  }

  function hideMemoryEnableRows(scope = document) {
    // Legacy settings shell: keep its exact old row selector.
    const legacyRowSelector =
      'div.border-token-border-light.flex.min-h-15.items-center.border-b:has(button[role="switch"])';

    forEachMatch(scope, legacyRowSelector, row => {
      const context = normalizeText(row.textContent);
      if (!includesAny(context, MEMORY_ENABLE_LABELS)) return;
      hideElement(row);
    });

    // New full-page Personalization shell: use ONLY the exact settings-row component
    // observed in the live DOM. Never walk upward from the switch; in the 2026 shell
    // that can reach the entire Personalization content pane.
    const newRowSelector = 'div[class~="@container/settings-row"]';
    forEachMatch(scope, newRowSelector, row => {
      const toggle = row.querySelector('button[role="switch"]');
      if (!toggle) return;

      const aria = normalizeText(toggle.getAttribute('aria-label'));
      const context = normalizeText(row.textContent);
      const matchesMemoryRow =
        aria === 'ota chatgpt:n muisti käyttöön' ||
        aria === 'enable chatgpt memory' ||
        aria === 'enable memory' ||
        includesAny(context, MEMORY_ENABLE_LABELS);

      if (matchesMemoryRow) hideElement(row);
    });
  }

  function hideEnhancedMemoryBanners(scope = document) {
    const cardSelector =
      'div.border-token-border-light.bg-token-bg-elevated-secondary.flex.min-h-20.flex-col.items-start.gap-3.rounded-2xl.border.px-4.py-4';

    forEachMatch(scope, cardSelector, card => {
      const context = normalizeText(card.textContent);
      const hasLegacyText = includesAny(context, LEGACY_MEMORY_BANNER_TEXT);
      const hasUpgradeButton = includesAny(context, ENHANCED_MEMORY_BUTTON_LABELS);
      if (hasLegacyText && hasUpgradeButton) hideElement(card);
    });

    // New modal uses different generated classes. Anchor on the stable button + copy,
    // then hide the nearest bounded container containing both rather than the whole modal.
    forEachMatch(scope, 'button[type="button"], button', button => {
      if (!ENHANCED_MEMORY_BUTTON_LABELS.has(normalizeText(button.textContent))) return;

      let card = button.closest('div.border-token-border-light.bg-token-bg-elevated-secondary');
      if (!card) {
        let node = button.parentElement;
        for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
          if (node.matches?.('[role="dialog"], [aria-modal="true"]')) break;

          const context = normalizeText(node.textContent);
          const hasLegacyText = includesAny(context, LEGACY_MEMORY_BANNER_TEXT);
          const hasUpgradeButton = includesAny(context, ENHANCED_MEMORY_BUTTON_LABELS);
          if (hasLegacyText && hasUpgradeButton) {
            card = node;
            break;
          }
        }
      }

      if (card) {
        const aside = card.closest('aside');
        const wrapper =
          aside?.parentElement?.matches?.('div.flex.w-full.flex-col')
            ? aside.parentElement
            : null;

        hideElement(wrapper || aside || card);
      }
    });
  }

  function hideSavedMemoryOverviewControls(scope = document) {
    if (!isPersonalizationMemoryModalUrl()) return;

    forEachMatch(scope, 'button[aria-haspopup="menu"]', button => {
      const label = normalizeText(
        button.getAttribute('aria-label') ||
        button.querySelector('.sr-only')?.textContent
      );
      if (!MEMORY_MORE_ACTION_LABELS.has(label)) return;
      hardHideEscapeHatch(button);
      button.setAttribute('data-bravefox-memory-actions-hidden', 'true');
    });
  }

  function removeForbiddenMemoryDeleteItems(scope = document) {
    // Legacy role=menuitem implementation.
    forEachMatch(scope, '[role="menuitem"]', item => {
      if (!isForbiddenMemoryDeleteItem(item)) return;
      hideElement(item);
      item.remove();
    });

    // New Saved Memories UI:
    // - each memory's "Poista/Delete" is a normal popover/dialog button;
    // - "Poista kaikki muistot/Delete all memories" is also a normal button.
    // Scope strictly to the Saved Memories UI so ordinary Delete actions elsewhere
    // in ChatGPT remain untouched.
    if (!hasSavedMemoriesDialogOpen()) return;

    forEachMatch(scope, 'button, [role="button"]', control => {
      if (!isForbiddenMemoryDeleteControl(control)) return;
      hideElement(control);
    });
  }

  // === Persistent ChatGPT plugin vault =========================================

  async function ensurePluginVaultLoaded() {
    if (pluginVaultLoaded) return pluginVault;
    if (pluginVaultLoadPromise) return pluginVaultLoadPromise;

    pluginVaultLoadPromise = (async () => {
      try {
        const stored = await api?.storage?.local?.get?.([
          PLUGIN_VAULT_KEY,
          PLUGIN_VAULT_SEEDED_KEY
        ]);
        const rows = Array.isArray(stored?.[PLUGIN_VAULT_KEY]) ? stored[PLUGIN_VAULT_KEY] : [];
        pluginVaultSeeded = stored?.[PLUGIN_VAULT_SEEDED_KEY] === true;
        pluginVault = new Map();

        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const key = getPluginKey(row.href || row.key);
          if (!key) continue;
          pluginVault.set(key, {
            key,
            href: row.href || key,
            name: String(row.name || 'Saved plugin'),
            iconSrc: String(row.iconSrc || ''),
            description: String(row.description || ''),
            cachedAt: Number(row.cachedAt) || Date.now()
          });
        }
      } catch (error) {
        console.warn('[BraveFox Enhancer] Failed to load ChatGPT plugin vault:', error);
        pluginVault = new Map();
      } finally {
        pluginVaultLoaded = true;
        pluginVaultLoadPromise = null;
      }
      return pluginVault;
    })();

    return pluginVaultLoadPromise;
  }

  async function savePluginVault() {
    try {
      if (!api?.storage?.local?.set) return;
      const rows = Array.from(pluginVault.values())
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map(entry => ({
          key: entry.key,
          href: entry.href,
          name: entry.name,
          iconSrc: entry.iconSrc,
          description: entry.description,
          cachedAt: entry.cachedAt
        }));
      await api.storage.local.set({ [PLUGIN_VAULT_KEY]: rows });
    } catch (error) {
      console.warn('[BraveFox Enhancer] Failed to save ChatGPT plugin vault:', error);
    }
  }

  async function finalizePluginVaultSeedIfReady() {
    await ensurePluginVaultLoaded();
    if (pluginVaultSeeded || pluginVault.size === 0) return false;

    try {
      pluginVaultSeeded = true;
      await api?.storage?.local?.set?.({ [PLUGIN_VAULT_SEEDED_KEY]: true });
      console.log(
        `[BraveFox Enhancer] Plugin vault baseline frozen with ${pluginVault.size} installed/active plugin(s).`
      );
      return true;
    } catch (error) {
      pluginVaultSeeded = false;
      console.warn('[BraveFox Enhancer] Failed to freeze ChatGPT plugin vault baseline:', error);
      return false;
    }
  }

  function normalizePluginHref(value) {
    try {
      const parsed = new URL(String(value || ''), location.origin);
      if (parsed.origin !== location.origin) return '';
      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (!/^\/plugins\/[^/]+/i.test(pathname)) return '';
      return `${pathname}${parsed.search || ''}`;
    } catch {
      return '';
    }
  }

  function getPluginKey(value) {
    const href = normalizePluginHref(value);
    if (!href) return '';
    return href.split('?')[0].toLowerCase();
  }

  function getPluginArticles(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    const articles = root.querySelectorAll('article');
    return Array.from(articles).filter(article => article.querySelector(PLUGIN_CARD_LINK_SELECTOR));
  }

  function getPluginLink(article) {
    return article?.querySelector?.(PLUGIN_CARD_LINK_SELECTOR) || null;
  }

  function getPluginActionButton(article) {
    if (!article?.querySelector) return null;
    return article.querySelector('button[type="button"], button');
  }

  function isPluginPlusButton(button) {
    if (!(button instanceof Element)) return false;
    if (button.hasAttribute('data-bravefox-plugin-reinstall')) return true;
    return Boolean(button.querySelector(`use[href$="${PLUGIN_PLUS_ICON_FRAGMENT}"]`));
  }

  function isPluginInstallButton(button) {
    if (!(button instanceof Element)) return false;
    if (button.hasAttribute('data-bravefox-plugin-reinstall')) return true;
    if (isPluginPlusButton(button)) return true;

    const aria = normalizeText(button.getAttribute('aria-label'));
    return PLUGIN_INSTALL_ARIA_TERMS.some(term => aria.includes(term));
  }

  function isInstalledPluginActionButton(button) {
    if (!(button instanceof Element)) return false;
    if (isPluginInstallButton(button)) return false;

    // Confirmed installed-card structure from ChatGPT:
    //   <button aria-haspopup="menu" aria-label="GitHub: toiminnot">
    //     ... <use href="...#623957">
    //   </button>
    // Prefer structural attributes over generated Radix IDs/classes.
    const hasActionsMenu = button.getAttribute('aria-haspopup') === 'menu';
    const hasInstalledActionSprite = Boolean(
      button.querySelector(`use[href$="${PLUGIN_INSTALLED_ACTION_ICON_FRAGMENT}"]`)
    );
    const aria = normalizeText(button.getAttribute('aria-label'));
    const hasActionsLabel =
      aria.includes(': toiminnot') ||
      aria.endsWith('toiminnot') ||
      aria.includes(': actions') ||
      aria.endsWith('actions');

    if (hasActionsMenu && (hasInstalledActionSprite || hasActionsLabel)) return true;

    // Language-independent fallback: an actions-menu button with the confirmed installed
    // sprite is sufficient even if ChatGPT changes the visible aria-label wording.
    if (hasActionsMenu && hasInstalledActionSprite) return true;

    // Keep explicit installed/management wording as a secondary compatibility fallback.
    return (
      aria.includes('uninstall') ||
      aria.includes('remove') ||
      aria.includes('disconnect') ||
      aria.includes('poista') ||
      aria.includes('katkaise') ||
      aria.includes('manage') ||
      aria.includes('hallinnoi')
    );
  }

  function isInstalledPluginCard(article) {
    if (!(article instanceof Element) || article.hasAttribute('data-bravefox-saved-plugin')) return false;

    // Do not infer installed state merely because a card has some non-plus button.
    // The installed baseline is intentionally strict so the permanent vault cannot
    // accidentally learn random catalog cards.
    const buttons = article.querySelectorAll('button[type="button"], button');
    for (const button of buttons) {
      if (isInstalledPluginActionButton(button)) return true;
    }

    // Buttonless status rows are a weaker fallback used only when ChatGPT exposes an
    // explicit installed/connected label.
    const context = normalizeText(article.textContent);
    return PLUGIN_INSTALLED_STATUS_TERMS.some(term => context.includes(term));
  }

  function extractPluginCardInfo(article) {
    const link = getPluginLink(article);
    if (!link) return null;

    const href = normalizePluginHref(link.getAttribute('href'));
    const key = getPluginKey(href);
    if (!key) return null;

    const icon = article.querySelector('[data-testid="plugin-icon-wrapper"] img, img');
    const ariaName = String(link.getAttribute('aria-label') || '')
      .replace(/^(avaa|open)\s+/i, '')
      .trim();
    const name = String(icon?.getAttribute('alt') || ariaName || key.split('/').pop() || 'Saved plugin').trim();

    const descriptionNode = article.querySelector(
      'div[class*="text-token-text-tertiary"][class*="line-clamp-1"], div[class*="line-clamp-1"][class*="text-[13px]"]'
    );

    return {
      key,
      href,
      name,
      iconSrc: String(icon?.getAttribute('src') || ''),
      description: String(descriptionNode?.textContent || '').trim(),
      cachedAt: Date.now()
    };
  }

  function samePluginMetadata(a, b) {
    return Boolean(
      a && b &&
      a.key === b.key &&
      a.href === b.href &&
      a.name === b.name &&
      a.iconSrc === b.iconSrc &&
      a.description === b.description
    );
  }

  async function rememberInstalledPluginCards(scope = document) {
    await ensurePluginVaultLoaded();

    // The original baseline remains a reinstall allowlist, but always refresh cards that
    // ChatGPT itself currently exposes as installed/connected. This repairs incomplete
    // snapshots from slow/lazy first loads without ever learning ordinary + catalog cards.
    let changed = false;

    for (const article of getPluginArticles(scope)) {
      if (!isInstalledPluginCard(article)) continue;
      const info = extractPluginCardInfo(article);
      if (!info) continue;

      const previous = pluginVault.get(info.key);
      if (!samePluginMetadata(previous, info)) {
        pluginVault.set(info.key, info);
        changed = true;
      }
    }

    if (changed) {
      await savePluginVault();
      console.log(`[BraveFox Enhancer] Plugin vault now remembers ${pluginVault.size} plugin(s).`);
    }

    return changed;
  }

  function updateCachedPluginMetadataFromAllowedCards(cards) {
    let changed = false;

    for (const article of cards) {
      const info = extractPluginCardInfo(article);
      if (!info || !pluginVault.has(info.key)) continue;

      const previous = pluginVault.get(info.key);
      const merged = {
        ...previous,
        href: info.href || previous.href,
        name: info.name || previous.name,
        iconSrc: info.iconSrc || previous.iconSrc,
        description: info.description || previous.description,
        cachedAt: previous.cachedAt || Date.now()
      };
      if (!samePluginMetadata(previous, merged)) {
        pluginVault.set(info.key, merged);
        changed = true;
      }
    }

    return changed;
  }

  function getPluginNativeSignature(cards) {
    return cards.map(article => {
      const info = extractPluginCardInfo(article);
      const key = info?.key || '';
      const installed = isInstalledPluginCard(article) ? 'i' : 'c';
      const approved = key && pluginVault.has(key) ? 'a' : 'x';
      return `${key}:${installed}:${approved}`;
    }).join('|');
  }

  function hasRenderableApprovedPlugins() {
    return Boolean(
      document.querySelector('article[data-bravefox-plugin-allowed]') ||
      document.querySelector(`#${PLUGIN_SAVED_SECTION_ID} .bravefox-saved-plugin-card`)
    );
  }

  function schedulePluginStableReveal() {
    if (!isPluginsRoute()) return;
    if (document.documentElement.classList.contains(PLUGINS_READY_CLASS)) return;

    if (pluginReadyTimer) {
      clearTimeout(pluginReadyTimer);
      pluginReadyTimer = 0;
    }

    const now = Date.now();
    if (!pluginCurationStartedAt) {
      pluginCurationStartedAt = now;
      pluginCurationLastActivityAt = now;
    }

    const elapsed = now - pluginCurationStartedAt;
    const quietFor = now - pluginCurationLastActivityAt;
    const stable =
      elapsed >= PLUGIN_READY_MIN_MS &&
      quietFor >= PLUGIN_READY_QUIET_MS &&
      hasRenderableApprovedPlugins();
    const hardStop = elapsed >= PLUGIN_READY_HARD_MS;

    if (stable || hardStop) {
      document.documentElement.classList.add(PLUGINS_READY_CLASS);
      return;
    }

    const minWait = Math.max(0, PLUGIN_READY_MIN_MS - elapsed);
    const quietWait = Math.max(0, PLUGIN_READY_QUIET_MS - quietFor);
    const wait = Math.max(80, Math.min(240, Math.max(minWait, quietWait)));
    pluginReadyTimer = window.setTimeout(() => {
      pluginReadyTimer = 0;
      schedulePluginStableReveal();
    }, wait);
  }

  async function applyPluginPagePolicy(scope = document) {
    if (!isPluginsRoute()) return;

    document.documentElement.classList.add(PLUGINS_CURATING_CLASS);
    await ensurePluginVaultLoaded();

    const now = Date.now();
    if (!pluginCurationStartedAt) {
      pluginCurationStartedAt = now;
      pluginCurationLastActivityAt = now;
    }

    for (const article of document.querySelectorAll('article[data-bravefox-plugin-allowed]')) {
      article.removeAttribute('data-bravefox-plugin-allowed');
    }
    for (const section of document.querySelectorAll('section[data-bravefox-plugin-section-allowed="true"]')) {
      section.removeAttribute('data-bravefox-plugin-section-allowed');
    }

    // Capture installed/connected cards before classification. Native catalog DOM is never
    // removed anymore; rejected cards simply stay paint-hidden so React can reconcile safely.
    await rememberInstalledPluginCards(scope);

    const cards = getPluginArticles(document);
    const nativeSignature = getPluginNativeSignature(cards);
    if (nativeSignature !== pluginLastNativeSignature) {
      pluginLastNativeSignature = nativeSignature;
      pluginCurationLastActivityAt = Date.now();
    }

    const firstCatalogSection = cards[0]?.closest?.('section') || null;
    const preferredMount = firstCatalogSection?.parentElement || null;
    const seenAllowed = new Set();
    const allowedNativeCards = [];

    for (const article of cards) {
      if (article.hasAttribute('data-bravefox-saved-plugin')) continue;

      const info = extractPluginCardInfo(article);
      if (!info || !pluginVault.has(info.key) || seenAllowed.has(info.key)) {
        continue;
      }

      seenAllowed.add(info.key);
      allowedNativeCards.push(article);
      article.setAttribute('data-bravefox-plugin-allowed', info.key);
      const allowedSection = article.closest('section');
      if (allowedSection) allowedSection.setAttribute('data-bravefox-plugin-section-allowed', 'true');
    }

    if (updateCachedPluginMetadataFromAllowedCards(allowedNativeCards)) {
      void savePluginVault();
    }

    renderMissingSavedPluginCards(seenAllowed, preferredMount, firstCatalogSection);

    // Do not reveal the directory on the first classification pass. React tends to mount
    // the catalog in several bursts, which previously produced the visible card cascade
    // and layout jumps. Reveal once the native card signature has stayed quiet briefly.
    schedulePluginStableReveal();
  }


  function renderMissingSavedPluginCards(nativeKeys, preferredMount = null, catalogAnchor = null) {
    const previousSection = document.getElementById(PLUGIN_SAVED_SECTION_ID);

    // Custom fallback cards are only needed on the main plugin directory, not on a
    // plugin's individual detail page.
    const pathname = String(location.pathname || '').replace(/\/+$/, '') || '/';
    if (pathname.toLowerCase() !== '/plugins') {
      previousSection?.remove();
      return;
    }

    const missing = Array.from(pluginVault.values())
      .filter(entry => !nativeKeys.has(entry.key))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    if (!missing.length) {
      previousSection?.remove();
      return;
    }

    const signature = missing
      .map(entry => `${entry.key}|${entry.name}|${entry.iconSrc}`)
      .join('||');

    // Avoid an observer feedback loop: our own cached section triggers one mutation when
    // first inserted, but an unchanged signature must not be torn down and rebuilt again.
    if (previousSection?.dataset?.bravefoxVaultSignature === signature) return;
    previousSection?.remove();

    const section = document.createElement('section');
    section.dataset.bravefoxVaultSignature = signature;
    section.id = PLUGIN_SAVED_SECTION_ID;

    const heading = document.createElement('div');
    heading.textContent = 'BraveFox saved plugins';
    heading.style.cssText = 'font-weight:600;margin:0 0 10px 2px;';

    const grid = document.createElement('div');
    grid.className = 'bravefox-saved-plugin-grid';

    for (const entry of missing) {
      const article = document.createElement('article');
      article.className = 'bravefox-saved-plugin-card';
      article.setAttribute('data-bravefox-saved-plugin', entry.key);

      if (entry.iconSrc) {
        const img = document.createElement('img');
        img.src = entry.iconSrc;
        img.alt = entry.name;
        article.appendChild(img);
      }

      const link = document.createElement('a');
      link.className = 'bravefox-saved-plugin-link';
      link.href = entry.href;

      const name = document.createElement('div');
      name.className = 'bravefox-saved-plugin-name';
      name.textContent = entry.name;

      const note = document.createElement('div');
      note.className = 'bravefox-saved-plugin-note';
      note.textContent = entry.description || 'Saved for reinstall';

      link.append(name, note);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bravefox-saved-plugin-reinstall';
      button.textContent = '+';
      button.title = `Open ${entry.name} to reinstall`;
      button.setAttribute('aria-label', `Open ${entry.name} to reinstall`);
      button.setAttribute('data-bravefox-plugin-reinstall', entry.key);

      article.append(link, button);
      grid.appendChild(article);
    }

    section.append(heading, grid);

    const firstNativeArticle = document.querySelector(`article ${PLUGIN_CARD_LINK_SELECTOR}`)?.closest('article');
    const firstNativeSection = firstNativeArticle?.closest('section');
    const host =
      preferredMount ||
      firstNativeSection?.parentElement ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body;
    const anchor =
      (catalogAnchor?.parentElement === host && catalogAnchor) ||
      (firstNativeSection?.parentElement === host && firstNativeSection) ||
      null;

    if (anchor) {
      host.insertBefore(section, anchor);
    } else {
      host.insertBefore(section, host.firstChild);
    }
  }

  function getPluginKeyForButton(button) {
    const savedKey = button?.getAttribute?.('data-bravefox-plugin-reinstall');
    if (savedKey) return getPluginKey(savedKey);

    const article = button?.closest?.('article');
    const articleLink = article ? getPluginLink(article) : null;
    const fromArticle = getPluginKey(articleLink?.getAttribute('href'));
    if (fromArticle) return fromArticle;

    return getPluginKey(location.pathname);
  }

  async function protectPluginInstallAction(button) {
    await ensurePluginVaultLoaded();

    const pluginKey = getPluginKeyForButton(button);

    if (TEMP_DISABLE_ALL_PASSWORD_PROMPTS) {
      if (pluginKey) replayPluginInstall(button, pluginKey);
      return;
    }
    if (!pluginKey || !pluginVault.has(pluginKey)) {
      // An install/+ control for a plugin that was never in the installed vault is not
      // permitted to survive the filtered page.
      button.remove();
      return;
    }

    void beginNativePasswordFlow({
      kind: 'plugin-install',
      routeKey: 'plugins',
      title: PLUGIN_INSTALL_PROMPT,
      returnUrl: location.href,
      payload: { pluginKey }
    });
  }

  function replayPluginInstall(button, pluginKey) {
    const savedEntry = pluginVault.get(pluginKey);

    if (button?.hasAttribute?.('data-bravefox-plugin-reinstall')) {
      if (savedEntry?.href) location.assign(savedEntry.href);
      return;
    }

    if (!(button instanceof HTMLButtonElement) || !button.isConnected) {
      if (savedEntry?.href) location.assign(savedEntry.href);
      return;
    }

    replayAllowedPluginButtons.add(button);
    try {
      button.click();
    } finally {
      queueMicrotask(() => replayAllowedPluginButtons.delete(button));
    }
  }

  // === GPT directory curation ===================================================

  function getGptCards(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    return Array.from(root.querySelectorAll(GPT_CARD_SELECTOR))
      .filter(card => card.querySelector('img[alt="GPT Icon"], img[alt*="GPT"]'));
  }

  function getGptSections() {
    return Array.from(document.querySelectorAll(GPT_SOURCE_SECTION_SELECTOR));
  }

  function extractGptCardInfo(card) {
    const titleElement =
      card.querySelector('div[class*="font-semibold"][class*="line-clamp"]') ||
      card.querySelector('span[class*="font-semibold"][class*="line-clamp"]') ||
      Array.from(card.querySelectorAll('div, span')).find(node =>
        node.classList?.contains('font-semibold') && normalizeText(node.textContent)
      );

    const descriptionElement =
      card.querySelector('span[class*="line-clamp-3"][class*="text-xs"]') ||
      card.querySelector('span[class*="line-clamp-2"][class*="text-xs"]') ||
      card.querySelector('span[class*="line-clamp"]');

    let author = '';
    for (const node of card.querySelectorAll('div, span')) {
      const text = String(node.textContent || '').trim();
      const normalized = normalizeText(text);
      if (
        normalized.startsWith('tekijä:') ||
        normalized.startsWith('by ') ||
        normalized.startsWith('by:') ||
        normalized.startsWith('creator:') ||
        normalized.startsWith('author:')
      ) {
        author = text;
        break;
      }
    }

    return {
      title: String(titleElement?.textContent || '').trim(),
      description: String(descriptionElement?.textContent || '').trim(),
      author
    };
  }

  function isAllowedGptCard(card) {
    const info = extractGptCardInfo(card);
    const looseTitle = normalizeLooseTitle(info.title);
    const author = normalizeLooseTitle(info.author);

    if (!looseTitle) return false;

    // OpenAI/ChatGPT is the only publisher wildcard. Native GPTs stay visible even
    // when their individual titles are not listed in GPT_ALLOWLIST.
    if (GPT_NATIVE_PUBLISHERS.some(publisher => author.includes(publisher))) return true;

    // Every third-party GPT must be explicitly present in the single editable array.
    return GPT_ALLOWLIST.some(title => normalizeLooseTitle(title) === looseTitle);
  }

  function getGptSectionHeading(section) {
    if (!(section instanceof Element)) return '';
    const heading =
      section.querySelector(':scope > div[tabindex="0"] div.text-xl.font-semibold') ||
      section.querySelector(':scope > div[tabindex="0"] [class*="font-semibold"]') ||
      section.querySelector('div.text-xl.font-semibold');
    return String(heading?.textContent || '').trim();
  }

  function isChatGptDonorSection(section) {
    const heading = normalizeLooseTitle(getGptSectionHeading(section));
    if (
      heading.includes('chatgpt n tekemät') ||
      heading.includes('chatgpt n tekemat') ||
      heading.includes('made by chatgpt') ||
      heading.includes('created by chatgpt') ||
      heading.includes('from chatgpt')
    ) {
      return true;
    }

    // Heading labels can change. A shelf whose rendered cards are all authored by
    // ChatGPT/OpenAI is a safe fallback donor for the curated container.
    const cards = getGptCards(section);
    return cards.length > 0 && cards.every(card => {
      const author = normalizeLooseTitle(extractGptCardInfo(card).author);
      return GPT_NATIVE_PUBLISHERS.some(publisher => author.includes(publisher));
    });
  }

  function findGptGrid(section) {
    if (!(section instanceof Element)) return null;
    return (
      section.querySelector(':scope > .mt-4.mb-10 > .grid') ||
      section.querySelector(':scope > div[class*="mt-4"][class*="mb-10"] > div.grid') ||
      section.querySelector('div.grid.grid-cols-1') ||
      section.querySelector('div.grid')
    );
  }

  function removeLegacyApprovedGptHeadings(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    const legacyTitle = normalizeText(LEGACY_GPT_APPROVED_TITLE);
    const legacySubtitle = normalizeText(LEGACY_GPT_APPROVED_SUBTITLE);

    for (const node of root.querySelectorAll('div, span, h1, h2, h3')) {
      const text = normalizeText(node.textContent);
      if (text !== legacyTitle && text !== legacySubtitle) continue;
      const wrapper = node.closest('[data-bravefox-gpt-heading="true"]');
      if (wrapper) wrapper.remove();
      else node.remove();
    }
  }

  function normalizeApprovedGptSection(section) {
    if (!(section instanceof Element)) return null;

    section.id = GPT_APPROVED_SECTION_ID;
    section.setAttribute(GPT_APPROVED_SECTION_ATTR, 'true');

    // The approved shelf no longer owns a heading. The stock ChatGPT GPT directory
    // header/search/actions are moved above this grid instead.
    for (const heading of section.querySelectorAll(':scope > [data-bravefox-gpt-heading="true"]')) {
      heading.remove();
    }
    removeLegacyApprovedGptHeadings(section);

    let content = section.querySelector(':scope > div[data-bravefox-gpt-content="true"]');
    if (!content) {
      content = Array.from(section.children).find(child =>
        child instanceof Element && child.classList.contains('mt-4') && child.classList.contains('mb-10')
      ) || null;
    }
    if (!content) {
      content = document.createElement('div');
      content.className = 'mt-4 mb-10';
      section.appendChild(content);
    }
    content.setAttribute('data-bravefox-gpt-content', 'true');

    let grid = findGptGrid(section);
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 gap-x-1.5 gap-y-1 md:gap-x-2 md:gap-y-1.5 lg:grid-cols-2 lg:gap-x-3 lg:gap-y-2.5';
      content.prepend(grid);
    }

    for (const button of content.querySelectorAll('button')) {
      if (isGptShowMoreButton(button)) button.remove();
    }

    return grid;
  }

  function createApprovedGptSectionShell() {
    const section = document.createElement('div');
    section.className = 'h-fit scroll-mt-28';
    section.id = GPT_APPROVED_SECTION_ID;
    section.setAttribute(GPT_APPROVED_SECTION_ATTR, 'true');

    const content = document.createElement('div');
    content.className = 'mt-4 mb-10';
    content.setAttribute('data-bravefox-gpt-content', 'true');

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-x-1.5 gap-y-1 md:gap-x-2 md:gap-y-1.5 lg:grid-cols-2 lg:gap-x-3 lg:gap-y-2.5';
    content.appendChild(grid);
    section.appendChild(content);
    return { section, grid };
  }

  function findExactTextElement(root, expectedValues, selector = 'div, span, h1, h2, h3, p') {
    const expected = new Set(expectedValues.map(value => normalizeText(value)));
    for (const node of root.querySelectorAll(selector)) {
      if (expected.has(normalizeText(node.textContent))) return node;
    }
    return null;
  }

  function findNativeGptSearchInput(root = document) {
    for (const input of root.querySelectorAll('input')) {
      const placeholder = normalizeText(input.getAttribute('placeholder'));
      const aria = normalizeText(input.getAttribute('aria-label'));
      if (
        placeholder.includes('hae gpt') ||
        placeholder.includes('search gpt') ||
        aria.includes('hae gpt') ||
        aria.includes('search gpt')
      ) return input;
    }
    return null;
  }

  function findCommonAncestor(elements, maxDepth = 10) {
    const nodes = elements.filter(node => node instanceof Element);
    if (!nodes.length) return null;
    let candidate = nodes[0];
    let depth = 0;
    while (candidate && depth <= maxDepth) {
      if (nodes.every(node => candidate.contains(node))) return candidate;
      candidate = candidate.parentElement;
      depth += 1;
    }
    return null;
  }

  function findNativeGptHero() {
    const root = document.querySelector('main') || document.querySelector('[role="main"]') || document;
    const search = findNativeGptSearchInput(root);
    if (!search) return null;

    const title = findExactTextElement(root, ['GPT:t', 'GPTs'], 'h1, h2, div, span');
    let description = null;
    for (const node of root.querySelectorAll('div, p, span')) {
      const text = normalizeText(node.textContent);
      if (GPT_NATIVE_DESCRIPTION_TERMS.some(term => text.includes(term))) {
        description = node;
        break;
      }
    }

    const required = [search];
    if (title) required.push(title);
    if (description) required.push(description);

    // Walk upward from the search control until its native container also contains the
    // stock GPT title/description. Stop before swallowing any of the directory shelves.
    let candidate = search;
    for (let depth = 0; candidate && depth < 10; depth += 1, candidate = candidate.parentElement) {
      if (!required.every(node => candidate.contains(node))) continue;
      if (candidate.querySelector?.(GPT_SOURCE_SECTION_SELECTOR)) continue;
      return candidate;
    }

    return findCommonAncestor(required, 10);
  }

  function findNativeGptActions() {
    const root = document.querySelector('main') || document.querySelector('[role="main"]') || document;
    const myLabel = findExactTextElement(root, ['Omat GPT:t', 'My GPTs', 'My GPTs:'], 'div, span, a, button');
    let createControl = null;

    for (const control of root.querySelectorAll('button, a')) {
      const text = normalizeText(control.textContent);
      if (text === 'luo' || text === 'create' || text === '+ luo' || text === '+ create') {
        createControl = control;
        break;
      }
    }

    const myControl =
      myLabel?.closest?.('a, button') ||
      (myLabel?.matches?.('a, button') ? myLabel : null);

    if (!myControl && !createControl) return null;

    const container = findCommonAncestor([myControl || myLabel, createControl].filter(Boolean), 6);
    return { myLabel, myControl, createControl, container };
  }


  function removeNativeGptExploreLabel(root = document) {
    const labels = ['Tutustu GPT:ihin', 'Explore GPTs', 'Explore GPTs:'];
    const node = findExactTextElement(root, labels, 'div, span, p');
    if (!node) return;
    node.setAttribute('data-bravefox-gpt-explore-hidden', 'true');
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
  }

  function stripClonedDomIds(root) {
    if (!(root instanceof Element)) return;
    if (root.hasAttribute('id')) root.removeAttribute('id');
    for (const node of root.querySelectorAll('[id]')) node.removeAttribute('id');
  }

  function makeGptActionProxy(kind, label, target) {
    const control = document.createElement('button');
    control.type = 'button';
    control.setAttribute('data-bravefox-gpt-action-proxy', kind);
    control.textContent = label;

    control.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      try {
        if (target?.isConnected && typeof target.click === 'function') {
          target.click();
          return;
        }

        const href = target?.getAttribute?.('href');
        if (href) location.assign(href);
      } catch (error) {
        console.warn('[BraveFox Enhancer] GPT action proxy failed:', error);
      }
    }, true);

    return control;
  }

  function prepareNativeGptHeader() {
    if (!gptApprovedSection?.isConnected) return false;

    removeLegacyApprovedGptHeadings(document);

    const hero = findNativeGptHero();
    if (hero) {
      hero.setAttribute(GPT_NATIVE_HERO_ATTR, 'true');
      hero.style.opacity = '1';
      hero.style.transform = 'none';
    }

    const actions = findNativeGptActions();
    for (const nativeControl of [actions?.myControl || actions?.myLabel, actions?.createControl]) {
      if (!(nativeControl instanceof Element)) continue;
      nativeControl.setAttribute(GPT_NATIVE_ACTIONS_ATTR, 'true');
      nativeControl.style.setProperty('display', 'none', 'important');
      nativeControl.style.setProperty('visibility', 'hidden', 'important');
    }

    let host = document.getElementById(GPT_NATIVE_HEADER_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = GPT_NATIVE_HEADER_ID;
      host.setAttribute(GPT_NATIVE_HEADER_ATTR, 'true');
    }

    // Never move ChatGPT's React-owned hero. Move only BraveFox-owned nodes so the final
    // order is always: native GPT title/description/search -> curated grid. The BraveFox
    // action proxies are fixed in the page's top-right utility area and do not consume flow.
    // The previous build inserted the shelf before the first source section, which on the
    // live page could place the whole curated grid above the native hero.
    const parent = hero?.parentElement || gptApprovedSection.parentElement;
    if (!parent) return false;

    if (hero?.parentElement === parent) {
      parent.insertBefore(host, hero.nextSibling);
      parent.insertBefore(gptApprovedSection, host.nextSibling);
    } else {
      if (gptApprovedSection.parentElement !== parent) parent.appendChild(gptApprovedSection);
      parent.insertBefore(host, gptApprovedSection);
    }
    gptNativeHeaderHost = host;

    host.replaceChildren();

    const myLabel = String(actions?.myLabel?.textContent || 'Omat GPT:t').trim() || 'Omat GPT:t';
    const createText = String(actions?.createControl?.textContent || 'Luo').trim() || 'Luo';

    const myProxy = makeGptActionProxy('my-gpts', myLabel, actions?.myControl || null);
    host.appendChild(myProxy);

    if (actions?.createControl) {
      const createLabel = /^\s*\+/.test(createText) ? createText : `+ ${createText}`;
      host.appendChild(makeGptActionProxy('create', createLabel, actions.createControl));
    }

    removeNativeGptExploreLabel(document);
    return Boolean(hero && findNativeGptSearchInput(hero));
  }


  function prepareApprovedGptSection() {
    if (gptApprovedSection?.isConnected && gptApprovedGrid?.isConnected) {
      normalizeApprovedGptSection(gptApprovedSection);
      return gptApprovedSection;
    }

    const existingSections = Array.from(document.querySelectorAll(`[${GPT_APPROVED_SECTION_ATTR}="true"], #${GPT_APPROVED_SECTION_ID}`));
    const existing = existingSections.shift() || null;
    for (const duplicate of existingSections) duplicate.remove();

    if (existing) {
      const grid = normalizeApprovedGptSection(existing);
      if (grid) {
        gptApprovedSection = existing;
        gptApprovedGrid = grid;
        return existing;
      }
      existing.remove();
    }

    // Do not wait for the far-down "Made by ChatGPT" shelf. That donor was the main
    // reason /gpts could sit blank for tens of seconds on a cold/lazy load. BraveFox
    // builds the same native-shaped shell immediately and harvests approved cards into it.
    const sourceSections = getGptSections().filter(section =>
      section.getAttribute(GPT_APPROVED_SECTION_ATTR) !== 'true'
    );
    const firstSource = sourceSections[0] || null;
    const nativeHero = findNativeGptHero();
    const host =
      nativeHero?.parentElement ||
      firstSource?.parentElement ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]');
    if (!host) return null;

    const created = createApprovedGptSectionShell();
    if (nativeHero?.parentElement === host) {
      host.insertBefore(created.section, nativeHero.nextSibling);
    } else if (firstSource?.parentElement === host) {
      host.insertBefore(created.section, firstSource);
    } else {
      host.appendChild(created.section);
    }

    gptApprovedSection = created.section;
    gptApprovedGrid = created.grid;
    gptCurationLastActivityAt = Date.now();
    return created.section;
  }

  function makeGptCardKey(card) {
    const info = extractGptCardInfo(card);
    const href = String(card.getAttribute('href') || '').trim();
    if (href && href !== '#') return `href:${href}`;
    return `text:${normalizeLooseTitle(info.title)}|${normalizeLooseTitle(info.author)}`;
  }

  function stripGptRankNumber(card) {
    if (!(card instanceof Element)) return;
    const first = card.firstElementChild;
    if (!first) return;
    const text = String(first.textContent || '').trim();
    if (/^\d+$/.test(text) && !first.querySelector('img, svg')) {
      first.remove();
    }
  }

  function getGptCardWrapper(card) {
    if (!(card instanceof Element)) return null;
    const wrapper = card.closest('div[tabindex="0"]');
    return wrapper && wrapper !== document.documentElement && wrapper !== document.body
      ? wrapper
      : card;
  }

  function normalizeApprovedGptCard(card, wrapper) {
    if (!(card instanceof Element)) return;
    stripGptRankNumber(card);

    if (wrapper instanceof Element) {
      wrapper.setAttribute('tabindex', '0');
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'none';
    }

    // Use the compact two-column card geometry from ChatGPT's own GPT shelf even when
    // the source card came from Featured or another category with a larger presentation.
    card.className = 'gizmo-link cursor-pointer group hover:bg-token-main-surface-secondary flex h-[104px] items-center gap-2.5 overflow-hidden rounded-xl px-1 py-4 md:px-3 md:py-4 lg:px-3';
  }

  function harvestApprovedGpts() {
    if (!gptApprovedGrid?.isConnected) return 0;

    let changed = 0;

    // Re-index the BraveFox-owned clone grid first. If an older route pass left a card
    // that no longer satisfies the allowlist, remove only that clone — never React's source.
    for (const existingCard of getGptCards(gptApprovedGrid)) {
      const existingWrapper = getGptCardWrapper(existingCard);
      const key = makeGptCardKey(existingCard);
      if (!isAllowedGptCard(existingCard)) {
        existingWrapper?.remove();
        gptApprovedKeys.delete(key);
        changed += 1;
        continue;
      }
      gptApprovedKeys.add(key);
      normalizeApprovedGptCard(existingCard, existingWrapper);
    }

    for (const card of getGptCards(document)) {
      if (gptApprovedGrid.contains(card)) continue;
      if (!isAllowedGptCard(card)) continue;

      const key = makeGptCardKey(card);
      if (!key || gptApprovedKeys.has(key)) continue;

      const sourceWrapper = getGptCardWrapper(card);
      if (!(sourceWrapper instanceof Element) || !sourceWrapper.isConnected) continue;

      const cloneWrapper = sourceWrapper.cloneNode(true);
      stripClonedDomIds(cloneWrapper);

      const cloneCard =
        cloneWrapper.matches?.(GPT_CARD_SELECTOR)
          ? cloneWrapper
          : cloneWrapper.querySelector?.(GPT_CARD_SELECTOR);
      if (!(cloneCard instanceof Element)) continue;

      cloneCard.setAttribute('data-bravefox-gpt-allowed', 'true');
      normalizeApprovedGptCard(cloneCard, cloneWrapper);
      gptApprovedGrid.appendChild(cloneWrapper);
      gptApprovedKeys.add(key);
      changed += 1;
    }

    if (changed) gptCurationLastActivityAt = Date.now();
    return changed;
  }


  function isGptShowMoreButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    return GPT_SHOW_MORE_LABELS.has(normalizeText(button.textContent));
  }

  function expandGptSourceShelves() {
    const now = Date.now();
    let pending = false;
    let clicked = false;

    for (const section of getGptSections()) {
      if (section === gptApprovedSection || section.getAttribute(GPT_APPROVED_SECTION_ATTR) === 'true') continue;

      for (const button of section.querySelectorAll('button')) {
        if (!isGptShowMoreButton(button) || button.disabled) continue;

        const currentCardCount = getGptCards(section).length;
        let state = gptShowMoreState.get(button);
        if (!state) state = { count: 0, lastClickAt: 0, lastCardCount: -1 };

        if (state.count >= GPT_MAX_SHOW_MORE_CLICKS) continue;
        pending = true;

        // Do not hammer the same React control four times while one network request is
        // still in flight. Re-click only after cards actually grew, or after a 2.5s
        // timeout indicates the previous click was swallowed.
        const waitingForGrowth = state.lastClickAt > 0 && currentCardCount <= state.lastCardCount;
        if (waitingForGrowth && now - state.lastClickAt < 2500) continue;
        if (!waitingForGrowth && now - state.lastClickAt < 700) continue;

        state.count += 1;
        state.lastClickAt = now;
        state.lastCardCount = currentCardCount;
        gptShowMoreState.set(button, state);
        try {
          button.click();
          clicked = true;
        } catch {
          // The maintenance pass will retry if React replaces the button.
        }
      }
    }

    if (clicked) gptCurationLastActivityAt = now;
    return { pending, clicked };
  }

  function removeGptCategoryNavigation() {
    for (const nav of document.querySelectorAll('div.sticky.top-14.z-10')) {
      const scroller = nav.querySelector(':scope > div.no-scrollbar');
      if (!scroller) continue;
      const text = normalizeText(scroller.textContent);
      const categoryHits = [
        'huippuvalinnat', 'ohjelmointi', 'tutkimus ja analyysi', 'tuottavuus',
        'programming', 'research & analysis', 'productivity', 'dall·e', 'writing', 'lifestyle'
      ].filter(term => text.includes(term)).length;
      if (categoryHits < 2) continue;

      // Leave React's navigation node in place; CSS already keeps it paint-hidden.
      nav.setAttribute('data-bravefox-gpt-category-nav-hidden', 'true');
    }
  }

  function removeOtherGptShelvesIfSettled(pendingShowMore) {
    if (!gptApprovedSection?.isConnected) return false;

    const now = Date.now();
    const elapsed = now - gptCurationStartedAt;
    const quietFor = now - gptCurationLastActivityAt;
    const settled = elapsed >= GPT_MIN_CURATION_MS && !pendingShowMore && quietFor >= 650;
    const hardStop = elapsed >= GPT_HARD_CURATION_MS;
    if (!settled && !hardStop) return false;

    // Native source shelves deliberately remain mounted but hidden. Removing them was
    // capable of making ChatGPT's React tree throw "Content failed to load" on rerenders.
    removeGptCategoryNavigation();
    return true;
  }


  function scheduleGptCurationRetry(delay = 260) {
    if (!isGptsRoute()) return;
    if (gptCurationRetryTimer) clearTimeout(gptCurationRetryTimer);
    gptCurationRetryTimer = window.setTimeout(() => {
      gptCurationRetryTimer = 0;
      applyGptPagePolicy(document);
    }, delay);
  }

  function applyGptPagePolicy(scope = document) {
    if (!isGptsRoute()) return;

    document.documentElement.classList.add(GPTS_CURATING_CLASS);
    if (!gptCurationStartedAt) {
      gptCurationStartedAt = Date.now();
      gptCurationLastActivityAt = gptCurationStartedAt;
    }

    const approvedSection = prepareApprovedGptSection();
    if (!approvedSection) {
      scheduleGptCurationRetry(120);
      return;
    }

    // Keep ChatGPT's stock GPT title/description/search/create controls, but move that
    // native chrome above the BraveFox-filtered grid. No custom BraveFox heading text.
    prepareNativeGptHeader();
    removeGptCategoryNavigation();
    harvestApprovedGpts();
    const expansion = expandGptSourceShelves();

    const finalized = removeOtherGptShelvesIfSettled(expansion.pending);

    // A programmatic Show-more click normally causes a React mutation, but keep a short
    // retry as insurance for slow PWA/network commits, shelves that replace buttons, and
    // the final quiet-period cleanup after the last expansion click.
    if (!finalized) {
      scheduleGptCurationRetry(expansion.clicked ? 260 : 420);
    }
  }

  function removePluginFeaturedPromo(scope = document) {
    const root = scope?.querySelectorAll ? scope : document;
    for (const link of root.querySelectorAll('a.interactive-button[href^="/plugins?category=featured"]')) {
      link.remove();
    }
  }

  function makeSidebarImagesItem(moreItem = null) {
    const anchor = document.createElement('a');
    anchor.tabIndex = 0;
    anchor.setAttribute('data-fill', '');
    anchor.className = 'group __menu-item hoverable gap-1.5 transition-colors keyboard-focused:focus-ring keyboard-focused:-outline-offset-2';
    anchor.setAttribute('data-testid', 'sidebar-item-images');
    anchor.setAttribute('data-sidebar-item', 'true');
    anchor.setAttribute('data-bravefox-sidebar-images', 'true');
    anchor.href = '/images';
    anchor.setAttribute('data-discover', 'true');

    const bodyText = normalizeText(document.body?.textContent);
    const oldLabel = normalizeText(moreItem?.textContent);
    const finnish =
      oldLabel.includes('lisää') ||
      /^fi(?:-|$)/i.test(String(document.documentElement.lang || '')) ||
      bodyText.includes('uusi keskustelu') ||
      bodyText.includes('kirjasto');
    const label = finnish ? 'Kuvat' : 'Images';

    // Standalone SVG instead of borrowing a generated ChatGPT sprite id. This keeps the
    // sidebar item intact even when ChatGPT rotates sprite bundles between deployments.
    // Build it with DOM APIs rather than innerHTML so AMO's unsafe-assignment scanner stays quiet.
    const iconHost = document.createElement('div');
    iconHost.setAttribute('aria-hidden', 'true');
    iconHost.className = 'relative flex items-center justify-center [opacity:var(--menu-item-icon-opacity,1)] icon';

    const iconInner = document.createElement('div');
    iconInner.className = 'absolute inset-0 flex items-center justify-center';

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');

    const rect = document.createElementNS(svgNs, 'rect');
    rect.setAttribute('x', '3.25');
    rect.setAttribute('y', '4');
    rect.setAttribute('width', '13.5');
    rect.setAttribute('height', '12');
    rect.setAttribute('rx', '2.25');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'currentColor');
    rect.setAttribute('stroke-width', '1.5');

    const circle = document.createElementNS(svgNs, 'circle');
    circle.setAttribute('cx', '7.25');
    circle.setAttribute('cy', '8');
    circle.setAttribute('r', '1.35');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '1.35');

    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', 'M4.75 14.15l3.45-3.45 2.45 2.45 1.75-1.75 2.85 2.85');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.45');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    svg.append(rect, circle, path);
    iconInner.append(svg);
    iconHost.append(iconInner);

    const labelHost = document.createElement('div');
    labelHost.className = 'flex min-w-0 grow items-center gap-2.5';

    const labelNode = document.createElement('div');
    labelNode.className = 'truncate [&:has([data-marquee-text])]:min-w-0 [&:has([data-marquee-text])]:flex-1 [&:has([data-marquee-text])]:overflow-visible';
    labelNode.textContent = label;
    labelHost.append(labelNode);

    anchor.append(iconHost, labelHost);
    return anchor;
  }


  function isNewSidebarExploreDotsButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;

    const popupType = button.getAttribute('aria-haspopup');
    const legacyPopover = popupType === 'dialog' && button.getAttribute('data-slot') === 'popover-trigger';
    const currentSidebarMenu = popupType === 'menu' && button.classList.contains('sidebar-item');
    if (!legacyPopover && !currentSidebarMenu) return false;

    const label = normalizeText(
      button.querySelector('.sr-only')?.textContent ||
      button.getAttribute('aria-label') ||
      button.textContent
    );
    if (label !== 'tutustu' && label !== 'explore') return false;

    // Scope this to the sidebar by requiring either generation of the Lisäosat/Customize
    // destination somewhere in a reasonably close ancestor. Those buttons are hidden, not
    // removed, so they remain reliable structural markers for the neighbouring dots menu.
    let node = button.parentElement;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (
        node.querySelector?.('button[data-sidebar-destination="builtin:customize"]') ||
        node.querySelector?.('button[data-sidebar-destination="builtin:skills"]')
      ) {
        return true;
      }
    }

    return false;
  }

  function hideNewSidebarControls(scope = document) {
    forEachMatch(
      scope,
      'button[data-sidebar-destination="builtin:customize"], button[data-sidebar-destination="builtin:skills"]',
      button => {
        hardHideEscapeHatch(button);
        const destination = button.getAttribute('data-sidebar-destination') === 'builtin:skills'
          ? 'skills'
          : 'customize';
        button.setAttribute('data-bravefox-sidebar-hidden', destination);
      }
    );

    forEachMatch(
      scope,
      'button[aria-haspopup="dialog"][data-slot="popover-trigger"], button.sidebar-item[aria-haspopup="menu"]',
      button => {
        if (!isNewSidebarExploreDotsButton(button)) return;
        hardHideEscapeHatch(button);
        button.setAttribute('data-bravefox-sidebar-hidden', 'explore-menu');
      }
    );
  }

  function getBraveFoxSidebarRoot(scope = document) {
    const element = scope instanceof Element ? scope : null;
    const directRoot = element?.closest?.('aside, nav, [data-testid*="sidebar"]');
    if (
      directRoot &&
      directRoot.querySelector?.(
        'button[data-sidebar-destination], button.sidebar-item, a[data-sidebar-item="true"]'
      )
    ) {
      return directRoot;
    }

    const marker = (scope?.querySelector?.(
      'button[data-sidebar-destination], button.sidebar-item, a[data-sidebar-item="true"]'
    ) || document.querySelector(
      'button[data-sidebar-destination], button.sidebar-item, a[data-sidebar-item="true"]'
    ));
    if (!marker) return null;
    return marker.closest('aside, nav, [data-testid*="sidebar"]') || marker.parentElement;
  }

  function findExactSidebarTextElement(root, labels) {
    if (!(root instanceof Element) || !labels) return null;
    const selector = 'button, a, [role="button"], h2, h3, h4, div, span';
    for (const element of root.querySelectorAll(selector)) {
      const conversationAnchor = element.closest('a[href^="/c/"], a[href*="/c/"]');
      if (conversationAnchor) continue;
      if (labels.has(normalizeText(element.textContent))) return element;
    }
    return null;
  }

  function getTopmostExactTextWrapper(element) {
    if (!(element instanceof Element)) return null;
    const exactText = normalizeText(element.textContent);
    let row = element;
    for (let depth = 0; depth < 5; depth += 1) {
      const parent = row.parentElement;
      if (!parent) break;
      if (parent.matches('aside, nav, [data-testid*="sidebar"]')) break;
      if (normalizeText(parent.textContent) !== exactText) break;
      row = parent;
    }
    return row;
  }

  function setSidebarStageHidden(element, stage, hidden) {
    if (!(element instanceof Element)) return;
    const row = getTopmostExactTextWrapper(element) || element;
    if (hidden) {
      row.setAttribute(SIDEBAR_STAGE_HIDDEN_ATTR, stage);
      return;
    }
    if (row.getAttribute(SIDEBAR_STAGE_HIDDEN_ATTR) === stage) {
      row.removeAttribute(SIDEBAR_STAGE_HIDDEN_ATTR);
    }
  }

  function clearSidebarStageHidden(stage) {
    for (const element of document.querySelectorAll(`[${SIDEBAR_STAGE_HIDDEN_ATTR}="${stage}"]`)) {
      element.removeAttribute(SIDEBAR_STAGE_HIDDEN_ATTR);
    }
  }

  function findSidebarLibraryElement(root) {
    if (!(root instanceof Element)) return null;
    return root.querySelector(
      'a[href="/library"], a[href^="/library?"], ' +
      'button[data-sidebar-destination="library"], button[data-sidebar-destination="builtin:library"]'
    ) || findExactSidebarTextElement(root, SIDEBAR_LIBRARY_LABELS);
  }

  function isSidebarConversationAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    const href = String(anchor.getAttribute('href') || '').trim();
    if (!href) return false;
    return /^\/c\/[^/?#]+(?:[/?#]|$)/i.test(href) || /\/c\/[^/?#]+(?:[/?#]|$)/i.test(href);
  }

  function getSidebarConversationRow(anchor, root) {
    if (!(anchor instanceof Element) || !(root instanceof Element)) return null;
    const row = anchor.closest('[data-sidebar-item="true"], .sidebar-item, li');
    if (row && root.contains(row)) return row;
    return anchor;
  }

  function hideSidebarTopRowsUntilLibrary(root) {
    for (const labels of [SIDEBAR_NEW_CHAT_LABELS, SIDEBAR_SCHEDULED_LABELS]) {
      const element = findExactSidebarTextElement(root, labels);
      if (element) setSidebarStageHidden(element, 'top', true);
    }
  }

  function hideSidebarRecentsUntilProjects(root) {
    const recentHeader = findExactSidebarTextElement(root, SIDEBAR_RECENT_LABELS);
    if (recentHeader) setSidebarStageHidden(recentHeader, 'recent', true);

    for (const anchor of root.querySelectorAll('a[href]')) {
      if (!isSidebarConversationAnchor(anchor)) continue;
      const row = getSidebarConversationRow(anchor, root);
      if (row) row.setAttribute(SIDEBAR_STAGE_HIDDEN_ATTR, 'recent');
    }
  }

  function releaseSidebarTopStage() {
    if (sidebarTopStageReleased) return;
    sidebarTopStageReleased = true;
    document.documentElement.classList.remove(SIDEBAR_TOP_WAIT_CLASS);
    clearSidebarStageHidden('top');
  }

  function releaseSidebarRecentsStage() {
    if (sidebarRecentsStageReleased) return;
    sidebarRecentsStageReleased = true;
    document.documentElement.classList.remove(SIDEBAR_RECENTS_WAIT_CLASS);
    clearSidebarStageHidden('recent');
  }

  function releaseAllSidebarStages() {
    releaseSidebarTopStage();
    releaseSidebarRecentsStage();
    if (sidebarStageFailOpenTimer) {
      clearTimeout(sidebarStageFailOpenTimer);
      sidebarStageFailOpenTimer = 0;
    }
  }

  function armSidebarStageFailOpen() {
    if (sidebarStageFailOpenTimer || (sidebarTopStageReleased && sidebarRecentsStageReleased)) return;
    sidebarStageFailOpenTimer = window.setTimeout(() => {
      sidebarStageFailOpenTimer = 0;
      releaseSidebarTopStage();
      releaseSidebarRecentsStage();
    }, 7000);
  }

  function maintainSidebarStageReveal(scope = document) {
    const root = getBraveFoxSidebarRoot(scope);
    if (!root) return;

    if (!sidebarTopStageReleased) {
      if (findSidebarLibraryElement(root)) {
        releaseSidebarTopStage();
      } else {
        hideSidebarTopRowsUntilLibrary(root);
      }
    }

    if (!sidebarRecentsStageReleased) {
      if (findExactSidebarTextElement(root, SIDEBAR_PROJECTS_LABELS)) {
        releaseSidebarRecentsStage();
      } else {
        hideSidebarRecentsUntilProjects(root);
      }
    }

    if (sidebarTopStageReleased && sidebarRecentsStageReleased && sidebarStageFailOpenTimer) {
      clearTimeout(sidebarStageFailOpenTimer);
      sidebarStageFailOpenTimer = 0;
    }
  }

  function mayAffectSidebarStageReveal(node) {
    if (!(node instanceof Element)) return false;
    const root = getBraveFoxSidebarRoot(node);
    return Boolean(root && (root === node || root.contains(node)));
  }

  function polishSidebarNavigation() {
    // Do not remove React-owned sidebar nodes. CSS hides Plugins and More; leaving them
    // mounted prevents React from reconciling our replacement away on busy directory pages.
    for (const pluginsButton of document.querySelectorAll(
      'a[data-testid="plugins-button"][data-sidebar-item="true"], a[data-sidebar-item="true"][href="/plugins"]'
    )) {
      pluginsButton.setAttribute('aria-hidden', 'true');
      pluginsButton.setAttribute('data-bravefox-sidebar-hidden', 'plugins');
    }

    const existingCustom = document.querySelector('a[data-bravefox-sidebar-images="true"]');
    if (existingCustom?.isConnected) return;

    const nativeImages = Array.from(document.querySelectorAll('a[data-sidebar-item="true"][href="/images"]'))
      .find(item => !item.hasAttribute('data-bravefox-sidebar-images'));
    if (nativeImages) {
      nativeImages.setAttribute('data-bravefox-sidebar-images', 'true');
      nativeImages.removeAttribute('aria-hidden');
      return;
    }

    const moreItems = Array.from(document.querySelectorAll('div[data-sidebar-item="true"][aria-haspopup="menu"]'))
      .filter(item => item.querySelector('svg use[href$="#dots-horizontal"]'));

    const moreItem = moreItems[0] || null;
    const custom = makeSidebarImagesItem(moreItem);

    if (moreItem?.parentElement) {
      moreItem.after(custom);
      return;
    }

    // Fallback for routes where ChatGPT has not mounted More yet. Place Kuvat after
    // Tasks/Ajastukset when possible, otherwise after the last normal top-level item.
    const sidebarItems = Array.from(document.querySelectorAll('a[data-sidebar-item="true"]'))
      .filter(item =>
        !item.hasAttribute('data-bravefox-sidebar-images') &&
        !String(item.getAttribute('href') || '').startsWith('/plugins')
      );
    const preferred = sidebarItems.find(item => {
      const label = normalizeText(item.textContent);
      const href = normalizeText(item.getAttribute('href'));
      return label.includes('ajastukset') || label === 'tasks' || href.includes('task');
    }) || sidebarItems[sidebarItems.length - 1] || null;

    if (preferred?.parentElement) {
      preferred.after(custom);
    }
  }


  function hardHideEscapeHatch(element) {
    if (!(element instanceof Element)) return;
    hideElement(element);
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
    element.style.setProperty('opacity', '0', 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
  }

  function isAccountSettingsRoute(value = location.href) {
    try {
      const url = new URL(String(value || location.href), location.href);
      const pathname = String(url.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
      if (pathname === '/settings/account') return true;

      // Firefox Android can still receive the legacy settings modal. Keep the matcher
      // narrow to Account so unrelated #settings tabs do not inherit this policy.
      let hash = String(url.hash || '').trim().toLowerCase();
      try {
        hash = decodeURIComponent(hash);
      } catch {
        // Keep the raw hash if malformed escaping slips through.
      }

      if (/^#settings\/(?:account|profile)(?:[/?&]|$)/.test(hash)) return true;
      return /^#settings\?(?:[^&]+&)*(?:tab|section|page)=(?:account|profile)(?:&|$)/.test(hash);
    } catch {
      return false;
    }
  }

  function findDeleteAccountLabelLeaves(scope = document) {
    if (!(scope instanceof Element) && scope !== document) return [];

    const leaves = [];
    const collect = element => {
      if (!(element instanceof Element)) return;
      if (element.children.length !== 0) return;
      if (!DELETE_ACCOUNT_LABELS.has(normalizeText(element.textContent))) return;
      leaves.push(element);
    };

    if (scope instanceof Element) collect(scope);
    for (const element of scope.querySelectorAll?.('div, span, p, label') || []) collect(element);
    return leaves;
  }

  function findDeleteAccountRowFromLabel(label) {
    if (!(label instanceof Element)) return null;

    let candidate = label.parentElement;
    let depth = 0;
    while (candidate instanceof HTMLElement && depth < 8) {
      const deleteButton = Array.from(candidate.querySelectorAll('button')).find(button =>
        DELETE_ACCOUNT_BUTTON_LABELS.has(normalizeText(button.textContent))
      );

      if (deleteButton) return candidate;
      if (candidate.matches('[role="dialog"], main, body')) break;
      candidate = candidate.parentElement;
      depth += 1;
    }

    return null;
  }

  function expandDeleteAccountHideTarget(row) {
    if (!(row instanceof HTMLElement)) return row;

    // Native account settings wraps the one destructive row in a dedicated card/section.
    // Collapse those single-child wrappers too so no empty rounded border remains behind.
    let target = row;
    if (!row.matches('div[class~="@container/settings-row"]')) return target;

    let candidate = row.parentElement;
    let depth = 0;
    while (candidate instanceof HTMLElement && depth < 3) {
      if (candidate.matches('[role="dialog"], main, body')) break;
      if (candidate.children.length !== 1 || candidate.firstElementChild !== target) break;
      target = candidate;
      candidate = candidate.parentElement;
      depth += 1;
    }

    if (
      candidate instanceof HTMLElement &&
      candidate.tagName === 'SECTION' &&
      candidate.children.length === 1 &&
      candidate.firstElementChild === target
    ) {
      target = candidate;
    }

    return target;
  }

  function hideDeleteAccountSettingsUi(scope = document) {
    if (!isAccountSettingsRoute()) return false;

    let changed = false;
    for (const label of findDeleteAccountLabelLeaves(scope)) {
      const row = findDeleteAccountRowFromLabel(label);
      if (!(row instanceof HTMLElement)) continue;

      row.setAttribute('data-bravefox-delete-account-row-hidden', 'true');
      hardHideEscapeHatch(row);

      const target = expandDeleteAccountHideTarget(row);
      if (target instanceof HTMLElement && target !== row) {
        target.setAttribute('data-bravefox-delete-account-row-hidden', 'true');
        hardHideEscapeHatch(target);
      }
      changed = true;
    }

    return changed;
  }

  function mayContainDeleteAccountSettingsUi(scope) {
    if (!isAccountSettingsRoute()) return false;
    if (!(scope instanceof Element)) return false;

    if (
      scope.matches?.('[data-bravefox-delete-account-row-hidden="true"]') ||
      scope.querySelector?.('[data-bravefox-delete-account-row-hidden="true"]')
    ) {
      return true;
    }

    if (DELETE_ACCOUNT_LABELS.has(normalizeText(scope.textContent)) && scope.children.length === 0) {
      return true;
    }

    return findDeleteAccountLabelLeaves(scope).length > 0;
  }

  function isBillingSettingsRoute(value = location.href) {
    try {
      const url = new URL(String(value || location.href), location.href);
      const pathname = String(url.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
      if (pathname === '/settings/billing') return true;

      // Firefox Android can still receive ChatGPT's legacy settings modal, which keeps
      // pathname at / and selects Billing through the hash instead. Accept both names
      // seen across the old UI generations without treating every #settings page as billing.
      let hash = String(url.hash || '').trim().toLowerCase();
      try {
        hash = decodeURIComponent(hash);
      } catch {
        // Keep the raw hash if malformed escaping slips through.
      }

      if (/^#settings\/(?:billing|subscription)(?:[/?&]|$)/.test(hash)) return true;
      return /^#settings\?(?:[^&]+&)*(?:tab|section|page)=(?:billing|subscription)(?:&|$)/.test(hash);
    } catch {
      return false;
    }
  }

  function extractBillingRenewalDate(nativeText) {
    const text = String(nativeText || '').trim();
    if (!text) return '';

    // Finnish/numeric date, e.g. 7.10.2026 or 07.10.2026.
    const numeric = text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/);
    if (numeric) return numeric[1];

    // English-style dates, e.g. October 7, 2026 / 7 October 2026.
    const month =
      '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
    const englishMonthFirst = text.match(
      new RegExp(`\\b(${month}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})\\b`, 'i')
    );
    if (englishMonthFirst) return englishMonthFirst[1];

    const englishDayFirst = text.match(
      new RegExp(`\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+${month}\\s+\\d{4})\\b`, 'i')
    );
    if (englishDayFirst) return englishDayFirst[1];

    return '';
  }

  function renderBillingRenewalText(template, nativeText) {
    if (template === null || template === undefined) return null;

    const native = String(nativeText || '');
    const date = extractBillingRenewalDate(native);

    return String(template)
      .replace(/\{native\}/gi, native)
      .replace(/\{date\}/gi, date);
  }

  function setConfigurableBillingText(element, value) {
    if (!(element instanceof Element)) return false;
    if (value === null || value === undefined) return false;

    const replacement = String(value);
    if (element.textContent === replacement) return false;

    element.textContent = replacement;
    return true;
  }

  function setConfigurableBillingButtonText(button, value) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (value === null || value === undefined) return false;

    const replacement = String(value);

    for (const node of button.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      if (!String(node.nodeValue || '').trim()) continue;

      if (node.nodeValue === replacement) return false;
      node.nodeValue = replacement;
      return true;
    }

    // Current UI uses a direct text node after the sparkle SVG. If ChatGPT changes
    // that structure, append a text node rather than replacing button.innerHTML and
    // destroying its native icon/listeners.
    button.appendChild(document.createTextNode(replacement));
    return true;
  }

  function getBillingTextLeaves(scope) {
    if (!(scope instanceof Element) && scope !== document) return [];

    const leaves = [];
    if (scope instanceof Element && scope.matches?.('div, span, p')) leaves.push(scope);
    if (typeof scope.querySelectorAll === 'function') {
      leaves.push(...scope.querySelectorAll('div, span, p'));
    }

    return leaves.filter(element => element.children.length === 0);
  }

  function isNativeBillingPlanText(value) {
    return BILLING_NATIVE_PLAN_LABELS.has(normalizeText(value));
  }

  function isNativeBillingRenewalText(value) {
    const text = normalizeText(value);
    return BILLING_RENEWAL_TEXT_PREFIXES.some(prefix => text.startsWith(prefix));
  }

  function isNativeBillingUpdateButton(button) {
    return button instanceof HTMLButtonElement &&
      BILLING_UPDATE_BUTTON_LABELS.has(normalizeText(button.textContent));
  }

  function billingContainerHasNativeSignals(container) {
    if (!(container instanceof HTMLElement)) return false;

    const leaves = getBillingTextLeaves(container);
    const hasPlan = leaves.some(element => isNativeBillingPlanText(element.textContent));
    const hasRenewal = leaves.some(element => isNativeBillingRenewalText(element.textContent));

    // Plan + renewal is the stable subscription fingerprint on both layouts. The update
    // button is intentionally optional because some account tiers/load states mount it late.
    return hasPlan && hasRenewal;
  }

  function findLegacyBillingSubscriptionRow(scope = document) {
    const searchRoot = scope instanceof Element || scope === document ? scope : document;
    const planLeaves = getBillingTextLeaves(searchRoot)
      .filter(element => isNativeBillingPlanText(element.textContent));

    for (const planLeaf of planLeaves) {
      let candidate = planLeaf.parentElement;
      let depth = 0;

      while (candidate instanceof HTMLElement && depth < 9) {
        if (billingContainerHasNativeSignals(candidate)) {
          candidate.setAttribute('data-bravefox-billing-subscription-row', 'true');
          candidate.setAttribute('data-bravefox-billing-layout', 'legacy');
          return candidate;
        }

        // A legacy settings dialog is the widest container we ever need to inspect. Do not
        // climb into the entire ChatGPT page if the subscription fingerprint is incomplete.
        if (candidate.matches('[role="dialog"]')) break;
        candidate = candidate.parentElement;
        depth += 1;
      }
    }

    return null;
  }

  function mayContainBillingSubscriptionUi(scope) {
    if (!isBillingSettingsRoute()) return false;
    if (!(scope instanceof Element)) return false;

    if (
      scope.matches?.('div[class~="@container/settings-row"], [data-bravefox-billing-subscription-row="true"]') ||
      scope.querySelector?.('div[class~="@container/settings-row"], [data-bravefox-billing-subscription-row="true"]')
    ) {
      return true;
    }

    const leaves = getBillingTextLeaves(scope);
    if (
      leaves.some(element =>
        isNativeBillingPlanText(element.textContent) ||
        isNativeBillingRenewalText(element.textContent)
      )
    ) {
      return true;
    }

    return Array.from(scope.querySelectorAll?.('button') || []).some(isNativeBillingUpdateButton);
  }

  function findBillingSubscriptionRow(scope = document) {
    if (!isBillingSettingsRoute()) return null;

    if (
      scope instanceof HTMLElement &&
      scope.getAttribute('data-bravefox-billing-subscription-row') === 'true'
    ) {
      return scope;
    }

    const markedRow = typeof scope?.querySelector === 'function'
      ? scope.querySelector('[data-bravefox-billing-subscription-row="true"]')
      : null;
    if (markedRow instanceof HTMLElement) return markedRow;

    const rows = [];
    if (scope instanceof Element && scope.matches?.('div[class~="@container/settings-row"]')) {
      rows.push(scope);
    }
    if (typeof scope?.querySelectorAll === 'function') {
      rows.push(...scope.querySelectorAll('div[class~="@container/settings-row"]'));
    }

    for (const row of rows) {
      if (!(row instanceof HTMLElement)) continue;
      if (row.getAttribute('data-bravefox-billing-subscription-row') === 'true') return row;

      const leaves = getBillingTextLeaves(row);
      const hasPlan = leaves.some(element => isNativeBillingPlanText(element.textContent));
      const hasRenewal = leaves.some(element => isNativeBillingRenewalText(element.textContent));
      const hasUpdateButton = Array.from(row.querySelectorAll('button')).some(isNativeBillingUpdateButton);

      // Require the plan name and one additional subscription-specific cue so another
      // settings row cannot accidentally become the customization target.
      if (!hasPlan || (!hasRenewal && !hasUpdateButton)) continue;

      row.setAttribute('data-bravefox-billing-subscription-row', 'true');
      row.setAttribute('data-bravefox-billing-layout', 'native');
      return row;
    }

    // The legacy Firefox Android modal has no @container/settings-row wrapper. Find the
    // smallest ancestor containing the native plan + renewal pair instead of relying on
    // unstable generated classes.
    return findLegacyBillingSubscriptionRow(scope) ||
      (scope === document ? null : findLegacyBillingSubscriptionRow(document));
  }

  function customizeBillingSubscriptionRow(scope = document) {
    if (!BILLING_SUBSCRIPTION_CUSTOMIZATION.enabled || !isBillingSettingsRoute()) return false;

    const row = findBillingSubscriptionRow(scope) || findBillingSubscriptionRow(document);
    if (!(row instanceof HTMLElement)) return false;

    const leaves = Array.from(row.querySelectorAll('div, span, p'))
      .filter(element => element.children.length === 0);

    const planNode = leaves.find(element =>
      isNativeBillingPlanText(element.textContent)
    ) || row.querySelector('[data-bravefox-billing-plan-text="true"]');

    const renewalNode = leaves.find(element =>
      isNativeBillingRenewalText(element.textContent)
    ) || row.querySelector('[data-bravefox-billing-renewal-text="true"]');

    const updateButton = Array.from(row.querySelectorAll('button')).find(isNativeBillingUpdateButton) ||
      row.querySelector('button[data-bravefox-billing-update-button="true"]');

    if (planNode instanceof Element) {
      planNode.setAttribute('data-bravefox-billing-plan-text', 'true');
      setConfigurableBillingText(
        planNode,
        BILLING_SUBSCRIPTION_CUSTOMIZATION.planName
      );
    }

    if (renewalNode instanceof Element) {
      renewalNode.setAttribute('data-bravefox-billing-renewal-text', 'true');

      if (!renewalNode.hasAttribute('data-bravefox-billing-native-renewal-text')) {
        renewalNode.setAttribute(
          'data-bravefox-billing-native-renewal-text',
          String(renewalNode.textContent || '')
        );
      }

      const nativeRenewalText = renewalNode.getAttribute(
        'data-bravefox-billing-native-renewal-text'
      ) || '';

      const renderedRenewalText = renderBillingRenewalText(
        BILLING_SUBSCRIPTION_CUSTOMIZATION.renewalText,
        nativeRenewalText
      );

      setConfigurableBillingText(
        renewalNode,
        renderedRenewalText
      );
    }

    if (updateButton instanceof HTMLButtonElement) {
      updateButton.setAttribute('data-bravefox-billing-update-button', 'true');
      setConfigurableBillingButtonText(
        updateButton,
        BILLING_SUBSCRIPTION_CUSTOMIZATION.updateButtonText
      );
    }

    return true;
  }

  function findAccountUpgradeMenuTextNode(item) {
    if (!(item instanceof Element)) return null;

    const candidates = Array.from(
      item.querySelectorAll('span, div, p')
    ).filter(element =>
      element.children.length === 0 &&
      ACCOUNT_UPGRADE_MENU_NATIVE_LABELS.has(normalizeText(element.textContent))
    );

    return candidates[0] || null;
  }

  function customizeAccountUpgradeMenuItem(item) {
    if (!(item instanceof Element)) return false;
    if (!ACCOUNT_UPGRADE_MENU_CUSTOMIZATION.enabled) return false;

    const replacement = String(
      ACCOUNT_UPGRADE_MENU_CUSTOMIZATION.replacementText || ''
    ).trim();
    if (!replacement) return false;

    const itemText = normalizeText(item.textContent);
    const textNode = findAccountUpgradeMenuTextNode(item);

    // Exact menu-item text is the semantic fallback if ChatGPT changes the nested
    // span structure but keeps the account-menu label itself.
    if (!textNode && !ACCOUNT_UPGRADE_MENU_NATIVE_LABELS.has(itemText)) return false;

    const target = textNode || item;
    if (target.textContent === replacement) {
      item.setAttribute('data-bravefox-upgrade-label-customized', 'true');
      return true;
    }

    // Never replace the entire structured menuitem when it contains the icon.
    if (target === item && item.children.length > 0) return false;

    target.textContent = replacement;
    item.setAttribute('data-bravefox-upgrade-label-customized', 'true');
    return true;
  }

  function applyAccountAndSettingsCleanup(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    hideDeleteAccountSettingsUi(scope);
    customizeBillingSubscriptionRow(scope);

    // Account/profile menu: Personalization / Yksilöinti. Radix mounts this menu in a
    // portal, often after the click-time scan has already completed. The targeted portal
    // observer above makes this live policy authoritative; text is the final fallback if
    // ChatGPT rotates the sprite id again.
    forEachMatch(scope, '[role="menuitem"]', item => {
      customizeAccountUpgradeMenuItem(item);

      const text = normalizeText(item.textContent);
      const hasFaceIcon = Boolean(item.querySelector('use[href*="#face"]'));
      const personalizationLink = item.matches('a[href^="/settings/personalization"]') ||
        Boolean(item.querySelector('a[href^="/settings/personalization"]'));
      if (hasFaceIcon || personalizationLink || PERSONALIZATION_MENU_LABELS.has(text)) {
        hardHideEscapeHatch(item);
      }
    });

    // Settings > Plugins: exact /plugins navigation links are escape hatches, while
    // plugin cards use /plugins/<id>. Paint-time CSS hides only the exact link. Here we
    // collapse its row *only* when the live DOM exactly matches the small settings-row
    // structure supplied by the user. Never climb generic ancestors: those can be major
    // ChatGPT layout containers and hiding one can blank large parts of the app.
    forEachMatch(scope, 'a[href="/plugins"]', link => {
      const text = normalizeText(link.textContent);
      const hasBrowseAddonsIcon = Boolean(link.querySelector('use[href*="#all-products"]'));
      const isBrowseAddons =
        hasBrowseAddonsIcon ||
        text === 'selaa lisäosia' ||
        text === 'browse addons' ||
        text === 'browse add-ons';
      if (!isBrowseAddons) return;

      hardHideEscapeHatch(link);

      const wrapper = link.parentElement;
      const row = wrapper?.parentElement;
      const wrapperIsExact =
        wrapper instanceof HTMLElement &&
        wrapper.children.length === 1 &&
        wrapper.firstElementChild === link &&
        wrapper.classList.contains('w-full');
      const rowIsExact =
        row instanceof HTMLElement &&
        row.children.length === 1 &&
        row.firstElementChild === wrapper &&
        row.classList.contains('border-token-border-light') &&
        row.classList.contains('flex') &&
        row.classList.contains('items-center') &&
        row.classList.contains('border-b');

      if (wrapperIsExact && rowIsExact) hardHideEscapeHatch(row);
    });
  }

  function applyGoogleOnlyLoginPolicy(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    // Signup is never needed for this profile. Keep it gone even on logged-out chrome
    // that has not mounted the email form yet.
    forEachMatch(scope, '[data-testid="signup-button"]', hideElement);

    // Current Apple + phone provider sprites. The broader provider-group rule below
    // additionally keeps only Google if ChatGPT adds/reorders other provider buttons.
    forEachMatch(scope, 'button:has(use[href$="#f5a288"]), button:has(use[href$="#d6f274"])', hideElement);

    const email = document.querySelector('input#email, input[name="email"][type="email"]');
    if (!email) return;

    hideElement(email);

    // Hide only the field-sized wrapper, not the whole auth form (Google may live beside it).
    const fieldWrapper = email.closest('label') || email.parentElement;
    if (fieldWrapper && !fieldWrapper.matches('form, main, body')) hideElement(fieldWrapper);

    const form = email.closest('form');
    if (form) {
      for (const submit of form.querySelectorAll('button[type="submit"]')) hideElement(submit);
    } else {
      for (const submit of document.querySelectorAll('button[type="submit"][class*="btn-primary"][class*="h-13"][class*="w-full"]')) {
        hideElement(submit);
      }
    }

    // Remove the OR/TAI separator by both structure and text so harmless grids elsewhere
    // on ChatGPT are not affected.
    for (const divider of document.querySelectorAll('div[class*="grid-cols-[1fr_max-content_1fr]"]')) {
      const text = normalizeText(divider.textContent);
      if ((text === 'tai' || text === 'or') && divider.querySelector('.h-px')) hideElement(divider);
    }

    // In the provider button stack, Google is the only allowed path. The Google sprite
    // from the supplied markup is #8e7aa4; everything else in that same provider group
    // stays hidden even if Apple/phone text is localized differently.
    for (const group of document.querySelectorAll('div.flex.flex-col.gap-3')) {
      if (!group.querySelector('button use[href$="#8e7aa4"]')) continue;
      for (const button of group.querySelectorAll(':scope > button')) {
        if (!button.querySelector('use[href$="#8e7aa4"]')) hideElement(button);
      }
    }
  }

  function scheduleGoogleOnlyLoginCleanupRetries() {
    // CSS does the no-glimpse work. These tiny retries only collapse any React wrappers
    // that remain after mount, without installing another permanent whole-page observer.
    for (const delay of [0, 60, 160, 420, 900, 1800, 3200]) {
      window.setTimeout(() => applyGoogleOnlyLoginPolicy(document), delay);
    }
  }

  function scheduleSidebarPolishRetries() {
    for (const timer of sidebarPolishTimers) clearTimeout(timer);
    sidebarPolishTimers = [];
    for (const delay of [0, 100, 300, 800, 1600, 3200]) {
      sidebarPolishTimers.push(window.setTimeout(() => {
        polishSidebarNavigation();
        maintainSidebarStageReveal(document);
        removePluginFeaturedPromo(document);
      }, delay));
    }
  }

  function hideElement(element) {
    element.classList.add(HIDDEN_CLASS);
    element.setAttribute('aria-hidden', 'true');
  }

  function normalizeAssistantNoticeHref(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function getMatchingAssistantNoticeRule(container) {
    if (!(container instanceof Element)) return null;

    if (
      container.closest('[data-bravefox-fixed-assistant-notice="true"]') ||
      container.querySelector('[data-bravefox-fixed-assistant-notice="true"]') ||
      container.closest('[data-bravefox-fixed-assistant-notice-turn="true"]')
    ) {
      return null;
    }

    const hrefs = Array.from(container.querySelectorAll('a[href]'), anchor =>
      normalizeAssistantNoticeHref(anchor.getAttribute('href'))
    ).filter(Boolean);
    const text = normalizeText(container.textContent);

    for (const rule of CHATGPT_ASSISTANT_NOTICE_REPLACEMENTS) {
      if (!rule?.enabled || !String(rule.replacementHtml || '').trim()) continue;

      const matchLinks = Array.isArray(rule.matchLinks)
        ? rule.matchLinks.map(normalizeAssistantNoticeHref).filter(Boolean)
        : [];
      const matchAnyText = Array.isArray(rule.matchAnyText)
        ? rule.matchAnyText.map(normalizeText).filter(Boolean)
        : [];

      const allLinksMatch =
        matchLinks.length > 0 &&
        matchLinks.every(href => hrefs.includes(href));
      const anyLinkMatches =
        matchLinks.length > 0 &&
        matchLinks.some(href => hrefs.includes(href));
      const semanticTextMatches =
        matchAnyText.length > 0 &&
        matchAnyText.some(value => text.includes(value));

      if (allLinksMatch || (anyLinkMatches && semanticTextMatches)) return rule;
    }

    return null;
  }

  function decodeSafeAssistantNoticeText(value) {
    return String(value || '')
      .replace(/&nbsp;/gi, '\u00a0')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");
  }

  function parseSafeAssistantNoticeAttributes(source) {
    const attributes = new Map();
    const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match;

    while ((match = pattern.exec(String(source || '')))) {
      const name = String(match[1] || '').toLowerCase();
      const value = decodeSafeAssistantNoticeText(
        match[2] ?? match[3] ?? match[4] ?? ''
      );
      attributes.set(name, value);
    }

    return attributes;
  }

  function buildAssistantNoticeReplacementFragment(html) {
    const fragment = document.createDocumentFragment();
    const allowedTags = new Set(['p', 'strong', 'em', 'b', 'i', 'span', 'a', 'br', 'code']);
    const stack = [{ node: fragment, tag: '' }];
    const tokens = String(html || '').match(/<\/?[a-zA-Z][^>]*>|[^<]+/g) || [];

    for (const token of tokens) {
      if (!token.startsWith('<')) {
        stack[stack.length - 1].node.appendChild(
          document.createTextNode(decodeSafeAssistantNoticeText(token))
        );
        continue;
      }

      const closing = /^<\s*\//.test(token);
      const nameMatch = token.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
      const tag = String(nameMatch?.[1] || '').toLowerCase();
      if (!tag) continue;

      if (closing) {
        for (let index = stack.length - 1; index > 0; index -= 1) {
          if (stack[index].tag !== tag) continue;
          stack.length = index;
          break;
        }
        continue;
      }

      if (!allowedTags.has(tag)) continue;

      const element = document.createElement(tag);
      const attributeSource = token
        .replace(/^<\s*[a-zA-Z0-9-]+/, '')
        .replace(/\/?\s*>$/, '');
      const attributes = parseSafeAssistantNoticeAttributes(attributeSource);

      for (const name of ['dir', 'class']) {
        if (attributes.has(name)) element.setAttribute(name, attributes.get(name));
      }

      if (tag === 'a') {
        const href = String(attributes.get('href') || '').trim();
        if (/^(?:https?:|tel:|mailto:)/i.test(href)) element.setAttribute('href', href);

        const target = String(attributes.get('target') || '').trim();
        if (target === '_blank' || target === '_self') element.setAttribute('target', target);

        const rel = String(attributes.get('rel') || '').trim();
        if (rel) element.setAttribute('rel', rel);
      }

      stack[stack.length - 1].node.appendChild(element);

      const selfClosing = tag === 'br' || /\/\s*>$/.test(token);
      if (!selfClosing) stack.push({ node: element, tag });
    }

    return fragment;
  }

  function findAssistantNoticeContainerFromAnchor(anchor) {
    if (!(anchor instanceof Element)) return null;

    let node = anchor.parentElement;
    let best = null;

    for (let depth = 0; node && depth < 11; depth += 1, node = node.parentElement) {
      const rule = getMatchingAssistantNoticeRule(node);
      if (!rule) {
        // Once we already have a match, allow one small structural wrapper above it
        // only if it still contains the matched notice. This catches the revamp's
        // separate title/body wrapper without climbing into the whole conversation.
        if (best && node.contains(best)) {
          const textLength = String(node.textContent || '').trim().length;
          const userContent = node.querySelector?.('[data-user-message-bubble="true"]');
          if (!userContent && textLength > 0 && textLength <= 1800) best = node;
        }
      } else {
        const textLength = String(node.textContent || '').trim().length;
        if (textLength > 5000) break;
        best = node;
      }

      if (
        node.matches(
          '[data-testid^="conversation-turn-"], section[data-turn], article[data-turn], ' +
          '[data-content-search-unit-key*="assistant"]'
        )
      ) {
        break;
      }
    }

    return best;
  }

  function collectAssistantNoticeContainers(scope = document) {
    const containers = [];
    const seen = new Set();

    const contentRootSelector = [
      '[data-markdown-text-style="assistant-message"]',
      '.markdown.prose',
      '.prose.markdown',
      '.markdown-new-styling',
      '.bravefox-assistant-message-surface'
    ].join(', ');

    const legacyAssistantSelector = [
      '[data-message-author-role="assistant"]',
      '[data-role="assistant"]',
      '[data-message-author="assistant"]',
      '.agent-turn'
    ].join(', ');

    const add = candidate => {
      if (!(candidate instanceof Element) || seen.has(candidate)) return;
      if (candidate.closest('[data-bravefox-fixed-assistant-notice-turn="true"]')) return;
      if (!getMatchingAssistantNoticeRule(candidate)) return;
      seen.add(candidate);
      containers.push(candidate);
    };

    // Prefer the actual rendered assistant-message body. This is the canonical
    // replacement root in the 2026 UI and avoids replacing both wrapper + child.
    if (scope instanceof Element) {
      if (scope.matches(contentRootSelector)) add(scope);
      add(scope.closest(contentRootSelector));
    }

    if (typeof scope?.querySelectorAll === 'function') {
      for (const candidate of scope.querySelectorAll(contentRootSelector)) add(candidate);
    }

    // Legacy UI buckets can expose only an assistant-role wrapper.
    if (!containers.length) {
      if (scope instanceof Element) {
        if (scope.matches(legacyAssistantSelector)) add(scope);
        add(scope.closest(legacyAssistantSelector));
      }

      if (typeof scope?.querySelectorAll === 'function') {
        for (const candidate of scope.querySelectorAll(legacyAssistantSelector)) add(candidate);
      }
    }

    // Last fallback: locate the old phone/chat links, but only if no semantic
    // assistant content root was found.
    if (!containers.length && typeof scope?.querySelectorAll === 'function') {
      for (const anchor of scope.querySelectorAll('a[href]')) {
        const container = findAssistantNoticeContainerFromAnchor(anchor);
        if (container) add(container);
      }
    }

    // If nested matching candidates somehow survive, keep the DEEPEST content root.
    return containers.filter(container =>
      !containers.some(
        other =>
          other !== container &&
          container.contains(other)
      )
    );
  }

  function replaceFixedAssistantNoticeText(scope = document) {
    for (const container of collectAssistantNoticeContainers(scope)) {
      if (container.getAttribute('data-bravefox-fixed-assistant-notice') === 'true') continue;

      const rule = getMatchingAssistantNoticeRule(container);
      if (!rule) continue;

      const fragment = buildAssistantNoticeReplacementFragment(rule.replacementHtml);
      if (!fragment.childNodes.length) continue;

      container.replaceChildren(fragment);
      container.setAttribute('data-bravefox-fixed-assistant-notice', 'true');

      const assistantTurn = container.closest(
        '[data-content-search-unit-key*="assistant"], ' +
        '[data-chatgpt-search-unit-key*="assistant"], ' +
        '[data-testid^="conversation-turn-"], ' +
        'section[data-turn="assistant"], article[data-turn="assistant"], ' +
        '[data-message-author-role="assistant"], .agent-turn'
      );
      if (assistantTurn instanceof Element) {
        assistantTurn.setAttribute('data-bravefox-fixed-assistant-notice-turn', 'true');
      }

      if (container instanceof HTMLElement) {
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('height', 'auto', 'important');
        container.style.setProperty('max-height', 'none', 'important');
        container.style.setProperty('overflow', 'visible', 'important');
        container.style.setProperty('white-space', 'normal', 'important');
      }
    }
  }

  function mayContainFixedAssistantNotice(scope) {
    if (!(scope instanceof Element)) return false;
    return collectAssistantNoticeContainers(scope).some(container =>
      container.getAttribute('data-bravefox-fixed-assistant-notice') !== 'true' &&
      !!getMatchingAssistantNoticeRule(container)
    );
  }

  function isInsideConversationContent(element) {
    if (!(element instanceof Element)) return false;
    return Boolean(element.closest(
      '[data-message-author-role], [data-role="user"], [data-role="assistant"], ' +
      '[data-message-author], [data-conversation-role], ' +
      '[data-markdown-text-style="assistant-message"], [data-user-message-bubble="true"], ' +
      '[data-testid^="conversation-turn-"], section[data-turn], article[data-turn], ' +
      '.user-turn, .agent-turn'
    ));
  }

  function findChatGptBannerCloseButton(banner) {
    if (!(banner instanceof Element)) return null;

    const selectors = [
      'button[data-testid="close-button"]',
      'button[aria-label="Close"]',
      'button[aria-label="Sulje"]',
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      'button[aria-label*="sulje" i]'
    ];

    for (const selector of selectors) {
      const button = banner.querySelector(selector);
      if (!(button instanceof HTMLButtonElement)) continue;
      button.setAttribute('data-bravefox-native-banner-close', 'true');
      return button;
    }

    return null;
  }

  function isCustomizableHomeHeadlineElement(headline) {
    if (!(headline instanceof Element)) return false;

    // Never touch message content merely because somebody writes one of the greeting
    // sentences as a Markdown H1 inside a conversation.
    if (headline.closest(
      '[data-message-author-role], [data-user-message-bubble="true"], ' +
      '[data-markdown-text-style="assistant-message"], .bravefox-user-message-surface, ' +
      '.bravefox-assistant-message-surface'
    )) {
      return false;
    }

    // Any native data-headline marker is the strongest hook. The exact text matcher
    // below still limits BraveFox to the configured greeting strings.
    if (headline.hasAttribute('data-headline')) return true;

    // Known 2026 splash wrapper used by the Finnish "Mistä aloitetaan?" bucket and
    // compatible variants. This remains useful if another greeting drops data-headline.
    if (headline.closest('div.relative.w-full.min-w-0.text-center.select-none')) {
      if (headline.matches('h1 > span')) return true;
      if (headline.matches('h1') && !headline.querySelector('span, [data-headline]')) return true;
    }

    // Final fallback for the blank/new-chat screen only. Never use a generic H1 match
    // inside an existing /c/ conversation.
    if (!getCurrentConversationId()) {
      if (headline.matches('h1 > span')) return true;
      if (headline.matches('h1') && !headline.querySelector('span, [data-headline]')) return true;
    }

    return false;
  }

  function mayContainCustomizableHomeHeadline(scope) {
    if (!(scope instanceof Element)) return false;

    if (
      scope.matches?.(CHATGPT_HOME_HEADLINE_SELECTOR) &&
      isCustomizableHomeHeadlineElement(scope)
    ) {
      return true;
    }

    for (const candidate of scope.querySelectorAll?.(CHATGPT_HOME_HEADLINE_SELECTOR) || []) {
      if (isCustomizableHomeHeadlineElement(candidate)) return true;
    }
    return false;
  }

  function getMatchingHomeHeadlineRule(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const rules = Array.isArray(CHATGPT_HOME_HEADLINE_CUSTOMIZATION.replacements)
      ? CHATGPT_HOME_HEADLINE_CUSTOMIZATION.replacements
      : [];

    for (const rule of rules) {
      if (!rule || typeof rule.nativeText !== 'string') continue;
      if (text === rule.nativeText.replace(/\s+/g, ' ').trim()) return rule;
    }
    return null;
  }

  function replaceCustomizableHomeHeadline(scope = document) {
    if (!CHATGPT_HOME_HEADLINE_CUSTOMIZATION.enabled) return;

    forEachMatch(scope, CHATGPT_HOME_HEADLINE_SELECTOR, headline => {
      if (!isCustomizableHomeHeadlineElement(headline)) return;

      const currentText = String(headline.textContent || '').replace(/\s+/g, ' ').trim();
      const directRule = getMatchingHomeHeadlineRule(currentText);

      if (directRule) {
        headline.setAttribute('data-bravefox-home-headline-native', directRule.nativeText);

        if (typeof directRule.replacementText === 'string') {
          if (headline.textContent !== directRule.replacementText) {
            headline.textContent = directRule.replacementText;
          }
          headline.setAttribute('data-bravefox-home-headline-customized', 'true');
        } else {
          headline.removeAttribute('data-bravefox-home-headline-customized');
        }
        return;
      }

      // If BraveFox already customized this exact node, leave its replacement alone.
      // If React changes the node to another native greeting, the direct match above
      // takes over on that mutation and updates the stored native variation.
      const storedNative = headline.getAttribute('data-bravefox-home-headline-native');
      const storedRule = getMatchingHomeHeadlineRule(storedNative);
      if (
        storedRule &&
        typeof storedRule.replacementText === 'string' &&
        headline.getAttribute('data-bravefox-home-headline-customized') === 'true' &&
        currentText === storedRule.replacementText.replace(/\s+/g, ' ').trim()
      ) {
        return;
      }

      headline.removeAttribute('data-bravefox-home-headline-native');
      headline.removeAttribute('data-bravefox-home-headline-customized');
    });
  }

  function getMatchingChatGptBannerRule(text) {
    const normalized = normalizeText(text);
    if (!normalized) return null;

    for (const rule of CHATGPT_BANNER_TEXT_REPLACEMENTS) {
      if (!rule?.enabled || !String(rule.replacement || '').trim()) continue;
      const matchAll = Array.isArray(rule.matchAll)
        ? rule.matchAll.map(normalizeText).filter(Boolean)
        : [];
      const matchModelAny = Array.isArray(rule.matchModelAny)
        ? rule.matchModelAny.map(normalizeText).filter(Boolean)
        : [];
      const matchAny = Array.isArray(rule.matchAny)
        ? rule.matchAny.map(normalizeText).filter(Boolean)
        : [];

      if (matchAll.length && !matchAll.every(value => normalized.includes(value))) continue;
      if (matchModelAny.length && !matchModelAny.some(value => normalized.includes(value))) continue;
      if (matchAny.length && !matchAny.some(value => normalized.includes(value))) continue;
      return rule;
    }
    return null;
  }

  function findChatGptBannerContainerFromTextNode(element, rule) {
    if (!(element instanceof Element) || !rule) return null;
    if (isInsideConversationContent(element)) return null;

    const structuralSelector = [
      'aside',
      '[role="alert"]',
      '[role="status"]',
      '[data-testid*="banner"]',
      '[data-testid*="notice"]',
      '[data-testid*="announcement"]',
      '[data-testid*="upsell"]'
    ].join(', ');

    let node = element;
    let best = null;

    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (node.matches('main, body')) break;
      if (isInsideConversationContent(node)) break;
      if (getMatchingChatGptBannerRule(node.textContent) !== rule) continue;

      const textLength = String(node.textContent || '').trim().length;
      if (textLength > 5000) break;

      if (node.matches(structuralSelector) || node.querySelector('button')) best = node;
    }

    return best;
  }

  function collectCustomizableChatGptBanners(scope = document) {
    const banners = [];
    const seen = new Set();
    const structuralSelector = [
      'aside',
      '[role="alert"]',
      '[role="status"]',
      '[data-testid*="banner"]',
      '[data-testid*="notice"]',
      '[data-testid*="announcement"]',
      '[data-testid*="upsell"]'
    ].join(', ');

    const add = candidate => {
      if (!(candidate instanceof Element) || seen.has(candidate)) return;
      if (isInsideConversationContent(candidate)) return;
      if (!getMatchingChatGptBannerRule(candidate.textContent)) return;
      seen.add(candidate);
      banners.push(candidate);
    };

    if (scope instanceof Element) {
      if (scope.matches(structuralSelector)) add(scope);
      add(scope.closest(structuralSelector));
    }

    if (typeof scope?.querySelectorAll === 'function') {
      for (const candidate of scope.querySelectorAll(structuralSelector)) add(candidate);

      const textCandidates = Array.from(scope.querySelectorAll('p, span, div'))
        .filter(candidate => candidate.children.length === 0)
        .filter(candidate => String(candidate.textContent || '').trim().length <= 1200);

      for (const candidate of textCandidates) {
        if (isInsideConversationContent(candidate)) continue;
        const rule = getMatchingChatGptBannerRule(candidate.textContent);
        if (!rule) continue;
        const banner = findChatGptBannerContainerFromTextNode(candidate, rule);
        if (banner) add(banner);
      }
    }

    return banners;
  }

  function mayContainCustomizableChatGptBanner(scope) {
    try {
      if (!(scope instanceof Element)) return false;
      // Cheap text gate first. Most mutations are normal chat/UI nodes and cannot
      // possibly be a retirement banner; avoid querySelectorAll('p, span, div') on them.
      if (!getMatchingChatGptBannerRule(scope.textContent)) return false;
      return collectCustomizableChatGptBanners(scope).length > 0;
    } catch {
      return false;
    }
  }

  function replaceCustomizableChatGptBannerText(scope = document) {
    for (const banner of collectCustomizableChatGptBanners(scope)) {
      const rule = getMatchingChatGptBannerRule(banner.textContent);
      if (!rule) continue;

      const nativeCloseButton = findChatGptBannerCloseButton(banner);

      if (hiddenChatGptBannerPrefsLoaded && shouldHideCustomChatGptBannerForModel(banner)) {
        if (nativeCloseButton) clickNativeChatGptBannerClose(nativeCloseButton);
        hideElement(banner);
        banner.remove();
        continue;
      }

      let changed = false;
      let target = null;

      const textCandidates = Array.from(banner.querySelectorAll('div, p, span'))
        // On Firefox Android React often mounts banners incrementally. Replacing
        // textContent on a wrapper with child elements can delete React-owned nodes
        // mid-commit and make the entire notice disappear. Leaf-only is fail-safe:
        // if no safe leaf contains the complete match, leave the native text alone.
        .filter(candidate => candidate.children.length === 0)
        .reverse();

      for (const candidate of textCandidates) {
        if (getMatchingChatGptBannerRule(candidate.textContent) !== rule) continue;
        target = candidate;
        break;
      }

      if (target) {
        const replacement = String(rule.replacement);
        if (target.textContent !== replacement) {
          target.textContent = replacement;
          changed = true;
        }
      }

      const buttonReplacement = String(rule.buttonReplacement || '').trim();
      const buttonMatchAny = Array.isArray(rule.buttonMatchAny)
        ? rule.buttonMatchAny.map(normalizeText).filter(Boolean)
        : [];

      if (buttonReplacement) {
        for (const button of banner.querySelectorAll('button')) {
          if (button === nativeCloseButton) continue;

          const nativeButtonText = normalizeText(button.textContent);
          if (buttonMatchAny.length && !buttonMatchAny.includes(nativeButtonText)) continue;

          let buttonTextTarget = null;
          for (const candidate of button.querySelectorAll('div, span')) {
            if (candidate.children.length !== 0) continue;
            const candidateText = normalizeText(candidate.textContent);
            if (!buttonMatchAny.length || buttonMatchAny.includes(candidateText)) {
              buttonTextTarget = candidate;
              break;
            }
          }

          if (!buttonTextTarget && button.children.length === 0) buttonTextTarget = button;
          if (!buttonTextTarget) continue;

          if (buttonTextTarget.textContent !== buttonReplacement) {
            buttonTextTarget.textContent = buttonReplacement;
            changed = true;
          }

          button.setAttribute('data-bravefox-banner-button-customized', 'true');
          button.setAttribute('data-bravefox-banner-button-action', 'close');
          break;
        }
      }

      if (changed || target) {
        banner.setAttribute('data-bravefox-banner-text-customized', 'true');
        const modelSlug = getCurrentChatGptBannerModelSlug(banner);
        if (modelSlug) banner.setAttribute('data-bravefox-banner-model-slug', modelSlug);
      }

      if (
        banner.getAttribute('data-bravefox-banner-text-customized') === 'true' &&
        nativeCloseButton
      ) {
        ensureCustomChatGptBannerMenuTrigger(banner);
      }
    }
  }

  function getConversationRole(node) {
    if (!(node instanceof Element)) return '';

    for (const attribute of [
      'data-message-author-role',
      'data-role',
      'data-message-author',
      'data-turn',
      'data-conversation-role'
    ]) {
      const role = normalizeText(node.getAttribute(attribute));
      if (role === 'user' || role === 'assistant') return role;
    }

    if (node.classList.contains('user-turn')) return 'user';
    if (node.classList.contains('agent-turn')) return 'assistant';

    const descendantRole = node.querySelector?.(
      '[data-message-author-role="user"], [data-message-author-role="assistant"], ' +
      '[data-role="user"], [data-role="assistant"], ' +
      '[data-message-author="user"], [data-message-author="assistant"]'
    );
    if (descendantRole instanceof Element) return getConversationRole(descendantRole);

    return '';
  }

  function collectConversationRoleNodes(scope = document) {
    const nodes = [];
    const seen = new Set();
    const selector = [
      '[data-message-author-role="user"]',
      '[data-message-author-role="assistant"]',
      '[data-role="user"]',
      '[data-role="assistant"]',
      '[data-message-author="user"]',
      '[data-message-author="assistant"]',
      'section[data-turn="user"]',
      'section[data-turn="assistant"]',
      'article[data-turn="user"]',
      'article[data-turn="assistant"]',
      '[data-testid^="conversation-turn-"]',
      '.user-turn',
      '.agent-turn'
    ].join(', ');

    const add = candidate => {
      if (!(candidate instanceof Element) || seen.has(candidate)) return;
      const role = getConversationRole(candidate);
      if (role !== 'user' && role !== 'assistant') return;

      // If a turn wrapper contains a more specific role node, let the inner semantic
      // node own presentation so attachments/actions are not accidentally bubbled too.
      if (
        candidate.matches('section[data-turn], .user-turn, .agent-turn') &&
        candidate.querySelector('[data-message-author-role], [data-role], [data-message-author]')
      ) {
        return;
      }

      seen.add(candidate);
      nodes.push(candidate);
    };

    if (scope instanceof Element) {
      add(scope);
      add(scope.closest(selector));
    }

    if (typeof scope?.querySelectorAll === 'function') {
      for (const candidate of scope.querySelectorAll(selector)) add(candidate);
    }

    return nodes;
  }

  function getConversationMessageSurface(roleNode, role) {
    if (!(roleNode instanceof Element)) return null;

    if (role === 'assistant') {
      const preferred = roleNode.querySelector(
        '.markdown.prose, .prose.markdown, .markdown-new-styling, .markdown, .prose, ' +
        '[class*="markdown"], [data-message-content]'
      );
      if (preferred instanceof Element) return preferred;

      try {
        if (window.getComputedStyle(roleNode).display === 'contents') {
          const child = Array.from(roleNode.children).find(element =>
            !(
              element.getAttribute?.(MESSAGE_META_ATTR) === 'true' &&
              element.querySelector?.(`[${MESSAGE_META_TEXT_ATTR}="true"]`)
            ) &&
            String(element.textContent || '').trim().length > 0
          );
          if (child instanceof Element) return child;
        }
      } catch {
        // The semantic role node itself is still a valid final fallback.
      }

      return roleNode;
    }

    const nativeBubble = roleNode.querySelector('.user-message-bubble-color');
    if (nativeBubble instanceof Element) return nativeBubble;

    const collapsible = roleNode.querySelector('[data-testid="collapsible-user-message-content"]');
    if (collapsible instanceof Element) return collapsible;

    const textLeaf = roleNode.querySelector('.whitespace-pre-wrap');
    if (textLeaf instanceof Element) {
      const parent = textLeaf.parentElement;
      if (parent && parent !== roleNode) return parent;
      return textLeaf;
    }

    return roleNode.querySelector('.markdown, [data-message-content]') || roleNode;
  }

  function setImportantStyle(element, name, value) {
    if (!(element instanceof HTMLElement)) return;
    if (
      element.style.getPropertyValue(name) === value &&
      element.style.getPropertyPriority(name) === 'important'
    ) {
      return;
    }
    element.style.setProperty(name, value, 'important');
  }

  function paintConversationSurface(surface, role) {
    if (!(surface instanceof HTMLElement)) return;

    const user = role === 'user';
    setImportantStyle(surface, 'background', user ? '#cce4ff' : '#e9eaea');
    setImportantStyle(surface, 'background-color', user ? '#cce4ff' : '#e9eaea');
    setImportantStyle(surface, 'border', `1px solid ${user ? '#a0b8c8' : '#cfcfcf'}`);
    setImportantStyle(surface, 'border-radius', '16px');
    setImportantStyle(surface, 'box-sizing', 'border-box');
    setImportantStyle(surface, 'color', '#222');
    setImportantStyle(surface, 'max-width', '98%');
    setImportantStyle(surface, 'padding', '12px');

    if (user) {
      setImportantStyle(surface, 'margin-left', 'auto');
      setImportantStyle(surface, 'margin-right', '2%');
    } else {
      setImportantStyle(surface, 'margin-left', '2%');
      setImportantStyle(surface, 'margin-right', '0');
    }
  }

  function paintExactRevampConversationSurfaces(scope = document) {
    const paint = (surface, role) => {
      if (!(surface instanceof HTMLElement)) return;

      if (role === 'user') {
        surface.classList.add('bravefox-user-message-surface');
        surface.classList.remove('bravefox-assistant-message-surface');
        paintConversationSurface(surface, 'user');
      } else {
        surface.classList.add('bravefox-assistant-message-surface');
        surface.classList.remove('bravefox-user-message-surface');
        paintConversationSurface(surface, 'assistant');
      }

      // The current ChatGPT bucket can expose the exact message surface without one of
      // the older semantic role wrappers. Drive metadata directly from that exact surface
      // too, otherwise the bubbles get BraveFox styling but never receive sender/time.
      applyConversationMessageMetadata(surface, role, surface);
    };

    if (scope instanceof Element) {
      if (scope.matches('[data-user-message-bubble="true"]')) paint(scope, 'user');
      if (scope.matches('[data-markdown-text-style="assistant-message"]')) paint(scope, 'assistant');
    }

    if (typeof scope?.querySelectorAll === 'function') {
      for (const surface of scope.querySelectorAll('[data-user-message-bubble="true"]')) {
        paint(surface, 'user');
      }
      for (const surface of scope.querySelectorAll('[data-markdown-text-style="assistant-message"]')) {
        paint(surface, 'assistant');
      }
    }
  }

  function conversationRootContainsOppositeSurface(candidate, role, surface) {
    if (!(candidate instanceof Element)) return false;

    const oppositeSelector = role === 'user'
      ? '[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface'
      : '[data-user-message-bubble="true"], .bravefox-user-message-surface';

    for (const opposite of candidate.querySelectorAll(oppositeSelector)) {
      if (!(opposite instanceof Element)) continue;
      if (surface instanceof Element && opposite === surface) continue;
      return true;
    }
    return false;
  }

  function getConversationTurnRoot(roleNode, surface, role = '') {
    if (!(roleNode instanceof Element)) return null;

    const start = surface instanceof Element ? surface : roleNode;
    const stableSelector = [
      '[data-testid^="conversation-turn-"]',
      '[data-content-search-unit-key]',
      '[data-chatgpt-search-unit-key]',
      '[data-chatgpt-selection-message-id]',
      '[data-message-id]',
      'section[data-turn]',
      'article[data-turn]',
      '.user-turn',
      '.agent-turn'
    ].join(', ');

    let closestStable = start.closest(stableSelector);
    if (!(closestStable instanceof Element)) closestStable = roleNode.closest(stableSelector);

    // Starting from the closest per-message wrapper, widen only while the ancestor still
    // contains this ONE role. This lets BraveFox include the native action strip without
    // ever climbing into a shared user+assistant thread wrapper (the cause of header hopping).
    let root = closestStable instanceof Element ? closestStable : start.parentElement;
    if (!(root instanceof Element)) return start;

    let candidate = root;
    for (let depth = 0; depth < 7; depth += 1) {
      const parent = candidate.parentElement;
      if (!(parent instanceof Element) || parent === document.body) break;
      if (!parent.contains(start)) break;
      if (role && conversationRootContainsOppositeSurface(parent, role, surface)) break;

      const parentIsStable = parent.matches?.(stableSelector);
      const candidateHasActions = Boolean(findConversationActionRow(candidate, surface));
      const parentHasActions = Boolean(findConversationActionRow(parent, surface));
      if (parentIsStable || (!candidateHasActions && parentHasActions)) {
        candidate = parent;
        root = parent;
        continue;
      }
      break;
    }

    return root;
  }

  function getConversationActionButtonLabel(button) {
    if (!(button instanceof HTMLButtonElement)) return '';
    return normalizeText(
      button.getAttribute('aria-label') ||
      button.getAttribute('title') ||
      button.getAttribute('data-testid') ||
      button.textContent ||
      ''
    );
  }

  function isConversationActionButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    const label = getConversationActionButtonLabel(button);
    if (!label) return false;

    return includesAny(label, [
      'copy', 'kopioi',
      'good response', 'bad response', 'like', 'dislike', 'tykkää', 'tykkaa',
      'share', 'jaa',
      'read aloud', 'lue ääneen', 'lue aaneen',
      'regenerate', 'retry', 'try again', 'yritä uudelleen', 'yrita uudelleen', 'päivitä', 'paivita',
      'more', 'more actions', 'lisää', 'lisaa',
      'branch', 'haara',
      'edit', 'muokkaa'
    ]);
  }

  function findConversationActionRow(turnRoot, surface) {
    if (!(turnRoot instanceof Element)) return null;

    const buttons = Array.from(turnRoot.querySelectorAll('button')).filter(button => {
      if (!(button instanceof HTMLButtonElement)) return false;
      if (surface instanceof Element && surface.contains(button)) return false;
      return true;
    });
    if (buttons.length < 2) return null;

    let best = null;
    let bestScore = -1;

    for (const button of buttons) {
      let ancestor = button.parentElement;
      let depth = 0;
      while (ancestor instanceof Element && ancestor !== turnRoot && depth < 4) {
        if (surface instanceof Element && ancestor.contains(surface)) break;

        const rowButtons = Array.from(ancestor.querySelectorAll('button')).filter(candidate =>
          !(surface instanceof Element && surface.contains(candidate))
        );
        const total = rowButtons.length;
        if (total >= 2 && total <= 12) {
          const known = rowButtons.filter(isConversationActionButton).length;
          const hasMenu = rowButtons.some(candidate => candidate.getAttribute('aria-haspopup') === 'menu');
          const score = (known * 20) + (hasMenu ? 8 : 0) + total - depth;
          if (known >= 2 && score > bestScore) {
            best = ancestor;
            bestScore = score;
          }
        }

        ancestor = ancestor.parentElement;
        depth += 1;
      }
    }

    if (best) return best;

    // Fallback for newer/localized buckets where action buttons have sparse labels.
    // The message overflow button still exposes aria-haspopup=menu, so use its smallest
    // button-only ancestor that stays outside the actual message surface.
    for (const button of buttons) {
      if (!(button instanceof HTMLButtonElement)) continue;
      if (button.getAttribute('aria-haspopup') !== 'menu') continue;

      let ancestor = button.parentElement;
      let depth = 0;
      while (ancestor instanceof Element && ancestor !== turnRoot && depth < 5) {
        if (surface instanceof Element && ancestor.contains(surface)) break;

        const rowButtons = Array.from(ancestor.querySelectorAll('button')).filter(candidate =>
          !(surface instanceof Element && surface.contains(candidate))
        );
        if (rowButtons.length >= 1 && rowButtons.length <= 16) {
          best = ancestor;
          break;
        }

        ancestor = ancestor.parentElement;
        depth += 1;
      }
      if (best) break;
    }

    return best;
  }

  function findConversationMoreMenuButton(actionRow) {
    if (!(actionRow instanceof Element)) return null;

    const buttons = Array.from(actionRow.querySelectorAll('button')).filter(
      button => button instanceof HTMLButtonElement
    );
    if (!buttons.length) return null;

    const menuButtons = buttons.filter(button => button.getAttribute('aria-haspopup') === 'menu');
    for (const button of menuButtons) {
      const label = getConversationActionButtonLabel(button);
      if (includesAny(label, ['more', 'more actions', 'lisää', 'lisaa', 'toimin', 'options'])) return button;
    }
    if (menuButtons.length) return menuButtons[0];

    for (const button of buttons) {
      const label = getConversationActionButtonLabel(button);
      if (includesAny(label, ['more', 'more actions', 'lisää', 'lisaa', 'toimin', 'options'])) return button;
      if (['...', '…', '⋯'].includes(String(button.textContent || '').trim())) return button;
      if (button.querySelector('use[href*="dots" i], use[href*="ellipsis" i], [data-icon*="dots" i], [data-icon*="ellipsis" i]')) {
        return button;
      }
    }

    return null;
  }

  function normalizeConversationUserDisplayName(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 80) return '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return '';

    const normalized = normalizeText(text);
    if (new Set([
      'profile', 'account', 'settings', 'chatgpt', 'user',
      'profiili', 'tili', 'asetukset', 'free', 'plus', 'pro', 'go'
    ]).has(normalized)) {
      return '';
    }
    return text;
  }

  function extractConversationUserDisplayName(payload) {
    if (!payload || typeof payload !== 'object') return '';

    const candidates = [
      payload?.user?.display_name,
      payload?.user?.displayName,
      payload?.user?.username,
      payload?.user?.name,
      payload?.display_name,
      payload?.displayName,
      payload?.username,
      payload?.name,
      payload?.account?.display_name,
      payload?.account?.name
    ];

    for (const candidate of candidates) {
      const name = normalizeConversationUserDisplayName(candidate);
      if (name) return name;
    }
    return '';
  }

  function extractConversationAccessToken(payload) {
    if (!payload || typeof payload !== 'object') return '';
    const token = String(
      payload.accessToken ||
      payload.access_token ||
      payload?.session?.accessToken ||
      payload?.session?.access_token ||
      ''
    ).trim();
    return token.length >= 24 ? token : '';
  }

  function readConversationUserDisplayNameFromDom() {
    const selectors = [
      'button[data-testid="profile-button"]',
      '[data-testid="profile-button"]',
      'button[data-testid*="profile" i]',
      'button[aria-label*="profile" i]',
      'button[aria-label*="account" i]',
      'button[aria-label*="profiili" i]',
      'button[aria-label*="tili" i]'
    ];

    for (const selector of selectors) {
      for (const root of document.querySelectorAll(selector)) {
        if (!(root instanceof Element)) continue;

        const leafText = [];
        for (const leaf of root.querySelectorAll('span, div, strong, p')) {
          if (!(leaf instanceof Element) || leaf.children.length) continue;
          const value = normalizeConversationUserDisplayName(leaf.textContent);
          if (value) leafText.push(value);
        }

        for (const value of leafText) {
          const normalized = normalizeText(value);
          if (includesAny(normalized, ['upgrade', 'päivitä', 'paivita', 'subscription', 'tilaus'])) continue;
          if (value.length >= 2) return value;
        }

        const ownText = normalizeConversationUserDisplayName(root.textContent);
        if (ownText && ownText.length >= 2) return ownText;
      }
    }
    return '';
  }

  function restoreConversationUserDisplayNameFromSharedCache() {
    try {
      const raw = localStorage.getItem(MESSAGE_USER_NAME_SHARED_CACHE_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      const name = normalizeConversationUserDisplayName(parsed?.name);
      if (!name) return '';
      conversationUserDisplayName = name;
      conversationUserDisplayNameFetchedAt = Number(parsed?.savedAt || 0) || Date.now();
      return name;
    } catch {
      return '';
    }
  }

  function persistConversationUserDisplayNameToSharedCache(name) {
    const normalized = normalizeConversationUserDisplayName(name);
    if (!normalized) return;
    try {
      localStorage.setItem(MESSAGE_USER_NAME_SHARED_CACHE_KEY, JSON.stringify({
        name: normalized,
        savedAt: Date.now()
      }));
    } catch {}
  }

  async function fetchConversationSessionPayload() {
    const response = await fetch(`${location.origin}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();

    const token = extractConversationAccessToken(payload);
    if (token) conversationAccessToken = token;

    const name = extractConversationUserDisplayName(payload);
    if (name) {
      conversationUserDisplayName = name;
      conversationUserDisplayNameFetchedAt = Date.now();
      persistConversationUserDisplayNameToSharedCache(name);
    }
    return payload;
  }

  async function resolveConversationAccessToken() {
    if (conversationAccessToken) return conversationAccessToken;
    if (conversationAccessTokenPromise) return conversationAccessTokenPromise;

    conversationAccessTokenPromise = (async () => {
      try {
        await fetchConversationSessionPayload();
      } catch {
        // Conversation metadata fetch can still try cookie auth as a fail-open fallback.
      }
      return conversationAccessToken;
    })().finally(() => {
      conversationAccessTokenPromise = null;
    });

    return conversationAccessTokenPromise;
  }

  async function resolveConversationUserDisplayName(force = false) {
    const configured = normalizeConversationUserDisplayName(
      CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.userLabel
    );
    if (configured) return configured;

    if (
      !force &&
      conversationUserDisplayName &&
      Date.now() - conversationUserDisplayNameFetchedAt < MESSAGE_USER_NAME_CACHE_MS
    ) {
      return conversationUserDisplayName;
    }

    if (conversationUserDisplayNamePromise) return conversationUserDisplayNamePromise;

    conversationUserDisplayNamePromise = (async () => {
      try {
        await fetchConversationSessionPayload();
        if (conversationUserDisplayName) return conversationUserDisplayName;
      } catch {
        // Fall through to the legacy identity endpoint and then visible profile text.
      }

      try {
        const response = await fetch(`${location.origin}/backend-api/me`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: conversationAccessToken
            ? { Accept: 'application/json', Authorization: `Bearer ${conversationAccessToken}` }
            : { Accept: 'application/json' }
        });
        if (response.ok) {
          const payload = await response.json();
          const name = extractConversationUserDisplayName(payload);
          if (name) {
            conversationUserDisplayName = name;
            conversationUserDisplayNameFetchedAt = Date.now();
            persistConversationUserDisplayNameToSharedCache(name);
            return name;
          }
        }
      } catch {
        // DOM is the final fallback.
      }

      const domName = readConversationUserDisplayNameFromDom();
      if (domName) {
        conversationUserDisplayName = domName;
        persistConversationUserDisplayNameToSharedCache(domName);
      }
      conversationUserDisplayNameFetchedAt = Date.now();
      return conversationUserDisplayName;
    })().finally(() => {
      conversationUserDisplayNamePromise = null;
    });

    const resolved = await conversationUserDisplayNamePromise;
    if (resolved) scheduleGeneralUiScan(false);
    return resolved;
  }

  function normalizeConversationReasoningEffort(value) {
    const normalized = normalizeText(value).replace(/[ _-]+/g, ' ').trim();
    if (!normalized) return '';

    if (['instant', 'min', 'minimum', 'minimal'].includes(normalized)) return 'instant';
    if (['medium', 'standard', 'normal'].includes(normalized)) return 'medium';
    if (['high', 'extended'].includes(normalized)) return 'high';
    if (['extra high', 'extra-high', 'xhigh', 'x high', 'max', 'maximum'].includes(normalized)) return 'extra-high';
    if (['pro'].includes(normalized)) return 'pro';
    if (['ultra'].includes(normalized)) return 'ultra';
    return '';
  }

  function formatConversationReasoningEffort(value) {
    const effort = normalizeConversationReasoningEffort(value);
    if (effort === 'instant') return 'Instant';
    if (effort === 'medium') return 'Medium';
    if (effort === 'high') return 'High';
    if (effort === 'extra-high') return 'Extra High';
    if (effort === 'pro') return 'Pro';
    if (effort === 'ultra') return 'Ultra';
    return '';
  }

  function formatConversationModelLabel(value) {
    const slug = normalizeChatGptModelSlug(value);
    if (!slug) return '';

    const known = new Map([
      ['gpt-5-5-thinking', '5.5 Thinking'],
      ['gpt-5-5-pro', '5.5 Pro'],
      ['gpt-5-5', '5.5'],
      ['gpt-5-6-thinking', '5.6 Thinking'],
      ['gpt-5-6-pro', '5.6 Pro'],
      ['gpt-5-6-luna', '5.6 Luna'],
      ['gpt-5-6-sol', '5.6 Sol'],
      ['gpt-5-6', '5.6'],
      ['gpt-6-astra-wm', '6 Astra Work'],
      ['gpt-6-astra', '6 Astra'],
      ['gpt-6-pro', '6 Pro'],
      ['gpt-6', '6']
    ]);
    if (known.has(slug)) return known.get(slug);

    let label = slug.replace(/^gpt-/, 'GPT-').replace(/-/g, ' ');
    label = label.replace(/\b(\d+) (\d+)\b/g, '$1.$2');
    return label.replace(/\b\w/g, char => char.toUpperCase()).trim();
  }

  function readConversationModelSlugFromDom(turnRoot, surface) {
    const candidates = [];
    const add = element => {
      if (!(element instanceof Element)) return;
      const value = String(element.getAttribute('data-message-model-slug') || '').trim();
      if (value) candidates.push(value);
    };

    add(surface);
    if (surface instanceof Element) {
      let node = surface.parentElement;
      for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
        add(node);
        if (node === turnRoot) break;
      }
    }
    add(turnRoot);
    if (turnRoot instanceof Element) {
      for (const element of turnRoot.querySelectorAll('[data-message-model-slug]')) add(element);
    }

    return candidates.find(Boolean) || '';
  }

  function readConversationReasoningEffortFromDom(turnRoot, surface) {
    const attributeNames = [
      'data-thinking-effort',
      'data-reasoning-effort',
      'data-thinking-level',
      'data-reasoning-level',
      'data-message-thinking-effort',
      'data-message-reasoning-effort'
    ];
    const candidates = [];
    const add = element => {
      if (!(element instanceof Element)) return;
      for (const attribute of attributeNames) {
        const value = normalizeConversationReasoningEffort(element.getAttribute(attribute));
        if (value) candidates.push(value);
      }
    };

    add(surface);
    if (surface instanceof Element) {
      let node = surface.parentElement;
      for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
        add(node);
        if (node === turnRoot) break;
      }
    }
    add(turnRoot);
    return candidates.find(Boolean) || '';
  }

  function inferConversationReasoningEffortFromText(value) {
    const text = normalizeText(value).replace(/[ _-]+/g, ' ').trim();
    if (!text) return '';

    if (/(?:^|\s)(?:extra high|xhigh|x high|max|maximum)(?:$|\s)/.test(text)) return 'extra-high';
    if (/(?:^|\s)(?:high|korkea|extended)(?:$|\s)/.test(text)) return 'high';
    if (/(?:^|\s)(?:medium|keskitaso|standard|normal)(?:$|\s)/.test(text)) return 'medium';
    if (/(?:^|\s)(?:instant|min|minimum|minimal|välitön|valiton)(?:$|\s)/.test(text)) return 'instant';
    if (/(?:^|\s)pro(?:$|\s)/.test(text)) return 'pro';
    if (/(?:^|\s)ultra(?:$|\s)/.test(text)) return 'ultra';
    return '';
  }

  function readLiveConversationReasoningEffortFromDom() {
    syncConversationSelectionState();

    // The composer pill is the most reliable user-facing source because it belongs to
    // this tab and reflects the model/effort the user is about to send with. Prefer it
    // over remembered state and over unrelated sliders elsewhere in the page.
    const selector = getChatGptComposerModelSelector();
    if (selector instanceof Element) {
      const values = [
        selector.getAttribute('aria-valuetext') || '',
        selector.getAttribute('aria-label') || '',
        selector.getAttribute('title') || '',
        selector.getAttribute('data-thinking-effort') || '',
        selector.getAttribute('data-reasoning-effort') || '',
        selector.textContent || ''
      ];
      for (const value of values) {
        const effort = inferConversationReasoningEffortFromText(value);
        if (effort) return effort;
      }
    }

    const sliders = Array.from(document.querySelectorAll(
      '[data-reasoning-slider="true"] [role="slider"], [role="slider"][aria-valuetext], input[type="range"][aria-valuetext]'
    ));
    for (const slider of sliders) {
      if (!(slider instanceof Element) || !isElementActuallyVisible(slider)) continue;
      const effort = normalizeConversationReasoningEffort(
        slider.getAttribute('aria-valuetext') ||
        slider.getAttribute('aria-label') ||
        slider.getAttribute('title') ||
        getThinkingEffortLabel(slider)
      );
      if (effort) return effort;
    }
    return '';
  }

  function readCurrentConversationReasoningEffortFromDom() {
    const liveEffort = readLiveConversationReasoningEffortFromDom();
    if (liveEffort) {
      conversationLastKnownReasoningEffort = liveEffort;
      return liveEffort;
    }
    return conversationLastKnownReasoningEffort;
  }

  function inferConversationModelSlugFromText(value, effort = '') {
    const text = normalizeText(value).replace(/_/g, ' ');
    if (!text) return '';

    const normalizedEffort = normalizeConversationReasoningEffort(effort);
    const thinkingSelected = ['medium', 'high', 'extra-high'].includes(normalizedEffort);

    if (/\bgpt[- ]?6\b|\b6\s+astra\b/.test(text)) {
      if (text.includes('pro')) return 'gpt-6-pro';
      if (text.includes('astra')) return text.includes('work') ? 'gpt-6-astra-wm' : 'gpt-6-astra';
      return 'gpt-6';
    }

    if (/\b5[.\s-]?6\b/.test(text)) {
      if (text.includes('pro')) return 'gpt-5-6-pro';
      if (text.includes('instant') || text.includes('välitön') || text.includes('valiton') || text.includes('luna')) {
        return 'gpt-5-6-luna';
      }
      if (text.includes('sol')) return 'gpt-5-6-sol';
      if (text.includes('thinking') || thinkingSelected) return 'gpt-5-6-thinking';
      return 'gpt-5-6';
    }

    if (/\b5[.\s-]?5\b/.test(text)) {
      if (text.includes('pro')) return 'gpt-5-5-pro';
      return 'gpt-5-5-thinking';
    }

    return '';
  }

  function readLiveConversationModelSlugFromComposer(effort = '') {
    syncConversationSelectionState();
    const selectorCandidates = [];
    const selector = getChatGptComposerModelSelector();
    if (!(selector instanceof Element)) return '';

    for (const attribute of [
      'data-message-model-slug',
      'data-model-slug',
      'data-model',
      'data-selected-model',
      'value',
      'aria-label',
      'title'
    ]) {
      const value = String(selector.getAttribute(attribute) || '').trim();
      if (value) selectorCandidates.push(value);
    }
    const text = String(selector.textContent || '').trim();
    if (text) selectorCandidates.push(text);

    for (const candidate of selectorCandidates) {
      const normalized = normalizeChatGptModelSlug(candidate);
      if (/^gpt-\d/.test(normalized)) {
        const inferred = inferConversationModelSlugFromText(candidate, effort);
        return inferred || normalized;
      }
      const inferred = inferConversationModelSlugFromText(candidate, effort);
      if (inferred) return inferred;
    }

    return '';
  }

  function readCurrentConversationModelSlugForSend(effort = '') {
    syncConversationSelectionState();

    // IMPORTANT: the visible composer selector outranks the URL and every other DOM
    // model hint. ChatGPT's SPA can leave ?model= stale after an in-place model switch.
    const liveModelSlug = readLiveConversationModelSlugFromComposer(effort);
    if (liveModelSlug) return liveModelSlug;

    // A trusted click on a model choice is the next-best source. This is tab-local and
    // conversation-scoped, unlike API metadata from an older assistant turn.
    if (conversationLastSelectedModelSlug) {
      const selected = inferConversationModelSlugFromText(conversationLastSelectedModelSlug, effort);
      return selected || conversationLastSelectedModelSlug;
    }

    // URL is fallback-only. It can describe the model the conversation opened with
    // rather than the model currently selected in the composer.
    try {
      const urlModel = new URL(location.href).searchParams.get('model');
      if (urlModel) {
        const normalized = normalizeChatGptModelSlug(urlModel);
        const inferred = inferConversationModelSlugFromText(urlModel, effort);
        if (inferred || /^gpt-\d/.test(normalized)) return inferred || normalized;
      }
    } catch {}

    // Last resort for a stable conversation: inherit the previous assistant turn. Route
    // synchronization prevents this fallback from leaking across conversations.
    const previousAssistantSurfaces = Array.from(document.querySelectorAll(
      '[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface'
    )).filter(element => element instanceof Element);

    for (let index = previousAssistantSurfaces.length - 1; index >= 0; index -= 1) {
      const previousSurface = previousAssistantSurfaces[index];
      const previousRoot = getConversationTurnRoot(previousSurface, previousSurface, 'assistant');
      if (!(previousRoot instanceof Element)) continue;

      const stored = String(previousRoot.getAttribute(MESSAGE_MODEL_ATTR) || '').trim();
      if (stored) return stored;

      const domSlug = readConversationModelSlugFromDom(previousRoot, previousSurface);
      if (domSlug) return domSlug;
    }

    return '';
  }

  function refreshConversationSelectionFromLiveUi() {
    syncConversationSelectionState();

    const previousModelSlug = normalizeChatGptModelSlug(conversationLastSelectedModelSlug);
    const liveEffort = readLiveConversationReasoningEffortFromDom();
    // Never use remembered effort to classify a freshly observed model. If the new
    // composer does not expose its effort yet, leave that detail unknown rather than
    // turning an old Medium/High value into a false model family.
    const liveModelSlug = readLiveConversationModelSlugFromComposer(liveEffort);

    let changed = false;
    if (liveModelSlug) {
      const nextModelSlug = normalizeChatGptModelSlug(liveModelSlug);
      if (nextModelSlug !== previousModelSlug) {
        conversationLastSelectedModelSlug = liveModelSlug;
        changed = true;

        // A model change with no visible effort proof must not inherit Medium/High from
        // the previously active model in this tab. A later DOM/API pass can fill it in.
        if (!liveEffort && conversationLastKnownReasoningEffort) {
          conversationLastKnownReasoningEffort = '';
        }
      } else if (!conversationLastSelectedModelSlug) {
        conversationLastSelectedModelSlug = liveModelSlug;
        changed = true;
      }
    }

    if (liveEffort && liveEffort !== conversationLastKnownReasoningEffort) {
      conversationLastKnownReasoningEffort = liveEffort;
      changed = true;
    }

    return changed;
  }

  function isConversationGenerationActive() {
    for (const button of document.querySelectorAll('button')) {
      if (!(button instanceof HTMLButtonElement)) continue;
      const label = normalizeText([
        button.getAttribute('data-testid') || '',
        button.getAttribute('aria-label') || '',
        button.getAttribute('title') || '',
        button.textContent || ''
      ].join(' '));
      if (includesAny(label, [
        'stop-button', 'stop generating', 'stop response', 'keskeytä', 'keskeyta',
        'lopeta luominen', 'lopeta vastaus'
      ])) {
        return true;
      }
    }
    return false;
  }

  function recoverConversationSendSnapshotFromActiveGeneration() {
    if (!isConversationGenerationActive()) return false;

    let changed = false;
    if (!conversationPendingUserSentAt) {
      conversationPendingUserSentAt = Date.now();
      changed = true;
    }
    if (!conversationPendingAssistantStartedAt) {
      conversationPendingAssistantStartedAt = Date.now();
      changed = true;
    }

    const beforeModel = conversationPendingModelSlug;
    const beforeEffort = conversationPendingReasoningEffort;
    captureConversationComposerSelection();
    if (conversationPendingModelSlug !== beforeModel || conversationPendingReasoningEffort !== beforeEffort) {
      changed = true;
    }
    return changed;
  }

  function refreshLatestConversationMetadataImmediately() {
    if (!CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.enabled) return;
    recoverConversationSendSnapshotFromActiveGeneration();

    const selectors = [
      ['user', '[data-user-message-bubble="true"], .bravefox-user-message-surface'],
      ['assistant', '[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface']
    ];

    for (const [role, selector] of selectors) {
      const surfaces = Array.from(document.querySelectorAll(selector))
        .filter(surface => surface instanceof HTMLElement);
      for (const surface of surfaces.slice(-2)) {
        applyConversationMessageMetadata(surface, role, surface);
      }
    }
  }

  function scheduleLiveConversationMetadataRefresh(scope) {
    const element = scope instanceof Element
      ? scope
      : scope?.parentElement instanceof Element
        ? scope.parentElement
        : null;
    if (element) conversationLiveMetadataScopes.add(element);
    if (conversationLiveMetadataFrame) return;

    const run = () => {
      conversationLiveMetadataFrame = 0;
      const scopes = Array.from(conversationLiveMetadataScopes);
      conversationLiveMetadataScopes.clear();

      if (!scopes.length) {
        refreshLatestConversationMetadataImmediately();
        return;
      }

      for (const candidate of scopes.slice(-8)) {
        if (!(candidate instanceof Element) || !candidate.isConnected) continue;
        applyConversationPresentation(candidate);
      }
      refreshLatestConversationMetadataImmediately();
      scheduleConversationArchiveDomCapture();
      scheduleConversationArchivePostStreamSync();
    };

    if (typeof requestAnimationFrame === 'function') {
      conversationLiveMetadataFrame = requestAnimationFrame(run);
    } else {
      conversationLiveMetadataFrame = window.setTimeout(run, 0);
    }
  }

  function scheduleConversationSelectionFastRefresh() {
    // Hydrate shared per-message metadata before touching the headers. If another tab
    // has already resolved this conversation, timestamps/model labels can paint in the
    // very same task instead of waiting for another full conversation download.
    primeConversationMetadataIndexForCurrentRoute();

    // First read happens synchronously, before any network metadata or delayed scan.
    // This is what makes switching browser windows/tabs feel immediate.
    const changedNow = refreshConversationSelectionFromLiveUi();
    refreshLatestConversationMetadataImmediately();
    if (changedNow) scheduleGeneralUiScan(true);

    // React may replace the composer pill during focus/navigation. One short retry catches
    // that new node without polling or waiting on the conversation API.
    if (conversationSelectionFastRefreshTimer) {
      clearTimeout(conversationSelectionFastRefreshTimer);
    }
    conversationSelectionFastRefreshTimer = window.setTimeout(() => {
      conversationSelectionFastRefreshTimer = 0;
      const changedLater = refreshConversationSelectionFromLiveUi();
      refreshLatestConversationMetadataImmediately();
      if (changedLater) scheduleGeneralUiScan(true);
    }, 45);
  }

  function captureConversationModelChoiceFromEvent(event) {
    if (!event?.isTrusted) return;
    syncConversationSelectionState();

    const target = event.target;
    if (!(target instanceof Element)) return;

    const choice = target.closest(
      '[role="menuitem"], [role="menuitemradio"], [role="option"], [role="radio"], button'
    );
    if (!(choice instanceof Element)) return;

    const values = [
      choice.getAttribute('data-model-slug') || '',
      choice.getAttribute('data-model') || '',
      choice.getAttribute('value') || '',
      choice.getAttribute('aria-label') || '',
      choice.getAttribute('title') || '',
      choice.textContent || ''
    ];

    let clickedEffort = '';
    for (const value of values) {
      clickedEffort = inferConversationReasoningEffortFromText(value);
      if (clickedEffort) break;
    }

    // Do not let a previously remembered High/Medium force a plain model choice into
    // the wrong family. First identify the model from the clicked choice itself.
    let clickedModel = '';
    for (const value of values) {
      clickedModel = inferConversationModelSlugFromText(value, clickedEffort);
      if (clickedModel) break;
    }

    if (clickedModel) {
      const previousModel = normalizeChatGptModelSlug(conversationLastSelectedModelSlug);
      const nextModel = normalizeChatGptModelSlug(clickedModel);
      conversationLastSelectedModelSlug = clickedModel;

      if (clickedEffort) {
        conversationLastKnownReasoningEffort = clickedEffort;
      } else if (previousModel && previousModel !== nextModel) {
        // Unknown is safer than incorrectly carrying High from another model. The next
        // send will re-read the composer pill/slider and fill this if ChatGPT exposes it.
        conversationLastKnownReasoningEffort = '';
      }
      return;
    }

    if (clickedEffort) conversationLastKnownReasoningEffort = clickedEffort;
  }

  function getConversationAssistantDetailLabel(turnRoot, surface) {
    if (!CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.showAssistantModel) return '';

    let modelSlug = String(turnRoot?.getAttribute?.(MESSAGE_MODEL_ATTR) || '').trim();
    if (!modelSlug) modelSlug = readConversationModelSlugFromDom(turnRoot, surface);

    const isLatestAssistantTurn = isSurfaceInLatestConversationTurn(turnRoot, 'assistant', surface);
    const hasFreshPendingSend =
      Boolean(conversationPendingUserSentAt) &&
      Date.now() - conversationPendingUserSentAt < 180000;
    let modelCameFromPendingSend = false;
    if (!modelSlug && isLatestAssistantTurn && hasFreshPendingSend && conversationPendingModelSlug) {
      modelSlug = conversationPendingModelSlug;
      modelCameFromPendingSend = true;
    }

    if (modelSlug && turnRoot instanceof Element && !turnRoot.getAttribute(MESSAGE_MODEL_ATTR)) {
      turnRoot.setAttribute(MESSAGE_MODEL_ATTR, modelSlug);
      turnRoot.setAttribute(MESSAGE_MODEL_SOURCE_ATTR, modelCameFromPendingSend ? 'send' : 'dom');
    }

    let effort = String(turnRoot?.getAttribute?.(MESSAGE_REASONING_ATTR) || '').trim();
    if (!effort) effort = readConversationReasoningEffortFromDom(turnRoot, surface);

    // Pending/current reasoning UI describes the active/latest turn only. Never let an
    // older assistant reply inherit today's selected effort just because its own metadata
    // has not resolved yet.
    let effortCameFromPendingSend = false;
    if (!effort && isLatestAssistantTurn && conversationPendingReasoningEffort) {
      effort = conversationPendingReasoningEffort;
      effortCameFromPendingSend = true;
    }
    if (!effort && isLatestAssistantTurn) effort = readCurrentConversationReasoningEffortFromDom();
    effort = normalizeConversationReasoningEffort(effort);

    const normalizedModelSlug = normalizeChatGptModelSlug(modelSlug);
    if (!effort && normalizedModelSlug.endsWith('-pro')) effort = 'pro';
    if (!effort && normalizedModelSlug.endsWith('-instant')) effort = 'instant';
    if (effort && turnRoot instanceof Element && !turnRoot.getAttribute(MESSAGE_REASONING_ATTR)) {
      turnRoot.setAttribute(MESSAGE_REASONING_ATTR, effort);
      turnRoot.setAttribute(MESSAGE_REASONING_SOURCE_ATTR, effortCameFromPendingSend ? 'send' : 'dom');
    }

    const modelLabel = formatConversationModelLabel(modelSlug);
    if (!modelLabel) return '';

    if (!CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.showAssistantReasoningLevel) return modelLabel;
    const effortLabel = formatConversationReasoningEffort(effort);
    if (!effortLabel) return modelLabel;

    // Slugs such as gpt-5-5-pro already name a tier. Do not render "Pro Pro".
    if (normalizeText(modelLabel).split(/\s+/).includes(normalizeText(effortLabel))) return modelLabel;
    return `${modelLabel} ${effortLabel}`;
  }

  function getConfiguredConversationSenderLabel(role, turnRoot = null, surface = null) {
    if (role === 'user') {
      const configured = normalizeConversationUserDisplayName(
        CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.userLabel
      );
      if (configured) return configured;
      if (conversationUserDisplayName) return conversationUserDisplayName;
      return String(CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.fallbackUserLabel || 'User').trim();
    }

    if (role === 'assistant') {
      const base = String(CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.assistantLabel || '').trim();
      if (!base) return '';
      const details = getConversationAssistantDetailLabel(turnRoot, surface);
      return details ? `${base} (${details})` : base;
    }
    return '';
  }

  function getMessageTimestampFromDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';

    try {
      return new Intl.DateTimeFormat(
        CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.locale || undefined,
        {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.timeZone || 'Europe/Helsinki'
        }
      ).format(date);
    } catch {
      return `${String(date.getHours()).padStart(2, '0')}.${String(date.getMinutes()).padStart(2, '0')}`;
    }
  }

  function formatNativeMessageTimestamp(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';

    if (CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.timeOnly !== false) {
      const matches = text.match(/\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/g);
      if (matches?.length) return matches[matches.length - 1];
    }

    return text;
  }

  function readInlineConversationRawTimestamp(turnRoot) {
    if (!(turnRoot instanceof Element)) return 0;

    for (const element of turnRoot.querySelectorAll('time, [datetime], [data-timestamp], [data-message-timestamp]')) {
      if (!(element instanceof Element)) continue;
      const raw =
        element.getAttribute('datetime') ||
        element.getAttribute('data-timestamp') ||
        element.getAttribute('data-message-timestamp');
      if (!raw) continue;

      let numeric = 0;
      if (/^\d+(?:\.\d+)?$/.test(String(raw).trim())) {
        numeric = Number(raw);
        if (numeric > 0 && numeric < 1e12) numeric *= 1000;
      } else {
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) numeric = parsed;
      }
      if (Number.isFinite(numeric) && numeric > 0) return numeric;
    }
    return 0;
  }

  function readInlineConversationTimestamp(turnRoot) {
    if (!(turnRoot instanceof Element)) return '';

    for (const element of turnRoot.querySelectorAll('time, [datetime], [data-timestamp], [data-message-timestamp]')) {
      if (!(element instanceof Element)) continue;

      const visibleText = formatNativeMessageTimestamp(element.textContent);
      if (visibleText && /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/.test(visibleText)) return visibleText;

      const raw =
        element.getAttribute('datetime') ||
        element.getAttribute('data-timestamp') ||
        element.getAttribute('data-message-timestamp');
      if (!raw) continue;

      let dateValue = raw;
      if (/^\d{10,13}$/.test(raw)) {
        const numeric = Number(raw);
        dateValue = numeric < 1e12 ? numeric * 1000 : numeric;
      }
      const formatted = getMessageTimestampFromDate(dateValue);
      if (formatted) return formatted;
    }

    return '';
  }


  // === BraveFox local conversation archive =====================================

  function archiveRequestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  function archiveTransactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
  }

  function openConversationArchiveDb() {
    if (conversationArchiveDbPromise) return conversationArchiveDbPromise;
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));

    conversationArchiveDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CHAT_ARCHIVE_DB_NAME, CHAT_ARCHIVE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CHAT_ARCHIVE_CONVERSATIONS_STORE)) {
          const store = db.createObjectStore(CHAT_ARCHIVE_CONVERSATIONS_STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(CHAT_ARCHIVE_MESSAGES_STORE)) {
          const store = db.createObjectStore(CHAT_ARCHIVE_MESSAGES_STORE, { keyPath: 'key' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('conversationBranch', ['conversationId', 'branchOrder'], { unique: false });
          store.createIndex('conversationCreated', ['conversationId', 'createTime'], { unique: false });
        }
        if (!db.objectStoreNames.contains(CHAT_ARCHIVE_SNAPSHOTS_STORE)) {
          const store = db.createObjectStore(CHAT_ARCHIVE_SNAPSHOTS_STORE, { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('conversationCreated', ['conversationId', 'createdAt'], { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        conversationArchiveDbPromise = null;
        reject(request.error || new Error('Could not open local chat archive'));
      };
      request.onblocked = () => console.warn('[BraveFox Enhancer] Local chat archive database upgrade is blocked by another tab.');
    });
    return conversationArchiveDbPromise;
  }

  function cloneArchiveJson(value) {
    if (value == null) return null;
    try {
      if (typeof structuredClone === 'function') return structuredClone(value);
    } catch {}
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function extractArchivePlainTextFromContent(content) {
    if (!content || typeof content !== 'object') return '';
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const values = [];
    const add = value => {
      const text = String(value ?? '').trim();
      if (text) values.push(text);
    };

    for (const part of parts) {
      if (typeof part === 'string') {
        add(part);
        continue;
      }
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string') add(part.text);
      else if (typeof part.content === 'string') add(part.content);
      else if (part.asset_pointer || part.image_url) add('[Image/attachment]');
      else if (part.name || part.filename) add(`[Attachment: ${part.name || part.filename}]`);
    }

    if (!values.length) {
      if (typeof content.text === 'string') add(content.text);
      if (typeof content.result === 'string') add(content.result);
    }
    return values.join('\n\n').trim();
  }

  function getArchiveFileIdFromAssetPointer(value) {
    const pointer = String(value || '').trim();
    if (!pointer) return '';
    const schemeMatch = pointer.match(/^(?:sediment|file-service):\/\/(.+)$/i);
    if (schemeMatch) return String(schemeMatch[1] || '').trim();
    return /^(?:file[-_])/.test(pointer) ? pointer : '';
  }

  function getArchiveImageParts(message) {
    const parts = Array.isArray(message?.content?.parts) ? message.content.parts : [];
    const images = [];
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const contentType = normalizeText(part.content_type || part.type);
      const assetPointer = String(part.asset_pointer || '').trim();
      const imageUrl = typeof part.image_url === 'string'
        ? String(part.image_url).trim()
        : typeof part.image_url?.url === 'string'
          ? String(part.image_url.url).trim()
          : '';
      const partMimeType = String(part.mime_type || part.mimeType || '');
      const isImage = contentType === 'image_asset_pointer' || contentType === 'image' || Boolean(imageUrl) || /^image\//i.test(partMimeType);
      if (!isImage) continue;
      const id = String(
        part.id || part.file_id || getArchiveFileIdFromAssetPointer(assetPointer) || ''
      ).trim();
      images.push({
        id,
        name: String(part.name || part.filename || part.file_name || ''),
        mimeType: partMimeType,
        size: Number(part.size || part.size_bytes || 0) || 0,
        width: Number(part.width || 0) || 0,
        height: Number(part.height || 0) || 0,
        assetPointer,
        imageUrl,
        isImage: true
      });
    }
    return images;
  }

  function sanitizeArchiveAttachments(message) {
    const raw = message?.metadata?.attachments || message?.metadata?.files || [];
    const imageParts = getArchiveImageParts(message);
    const imageById = new Map();
    for (const image of imageParts) {
      if (image.id) imageById.set(image.id, image);
    }

    const attachments = (Array.isArray(raw) ? raw : []).slice(0, 50).map(item => {
      if (!item || typeof item !== 'object') return null;
      const id = String(item.id || item.file_id || '').trim();
      const image = id ? imageById.get(id) : null;
      const mimeType = String(item.mime_type || item.mimeType || image?.mimeType || '');
      return {
        id,
        name: String(item.name || item.filename || item.file_name || image?.name || ''),
        mimeType,
        size: Number(item.size || item.size_bytes || image?.size || 0) || 0,
        width: Number(image?.width || 0) || 0,
        height: Number(image?.height || 0) || 0,
        assetPointer: String(image?.assetPointer || ''),
        imageUrl: String(image?.imageUrl || ''),
        isImage: Boolean(image || /^image\//i.test(mimeType))
      };
    }).filter(Boolean);

    const knownIds = new Set(attachments.map(item => item.id).filter(Boolean));
    for (const image of imageParts) {
      if (image.id && knownIds.has(image.id)) continue;
      attachments.push(image);
      if (image.id) knownIds.add(image.id);
    }
    return attachments;
  }

  function getArchiveCurrentBranchNodeIds(payload) {
    const mapping = payload && typeof payload === 'object' ? payload.mapping : null;
    const currentNode = String(payload?.current_node || '').trim();
    if (!mapping || typeof mapping !== 'object' || !currentNode || !mapping[currentNode]) return [];

    const reversed = [];
    const seen = new Set();
    let nodeId = currentNode;
    while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
      seen.add(nodeId);
      reversed.push(nodeId);
      nodeId = String(mapping[nodeId]?.parent || '').trim();
    }
    return reversed.reverse();
  }

  function normalizeArchiveTimestamp(value) {
    let numeric = value;
    if (typeof numeric === 'string' && /^\d+(?:\.\d+)?$/.test(numeric.trim())) numeric = Number(numeric);
    if (!Number.isFinite(Number(numeric))) return 0;
    numeric = Number(numeric);
    if (numeric > 0 && numeric < 1e12) numeric *= 1000;
    return numeric > 0 ? numeric : 0;
  }

  function getArchiveDocumentTitleFallback() {
    const title = String(document.title || '').replace(/\s*[|–—-]\s*ChatGPT\s*$/i, '').trim();
    return title && !/^chatgpt$/i.test(title) ? title : 'Untitled Chat';
  }

  function buildArchiveRecordsFromConversationPayload(conversationId, payload) {
    const mapping = payload && typeof payload === 'object' ? payload.mapping : null;
    if (!mapping || typeof mapping !== 'object') return { records: [], branchRecords: [], currentNodeId: '' };

    const branchNodeIds = getArchiveCurrentBranchNodeIds(payload);
    const branchOrder = new Map(branchNodeIds.map((id, index) => [id, index]));
    const records = [];

    for (const [nodeId, node] of Object.entries(mapping)) {
      const message = node?.message;
      const messageId = String(message?.id || '').trim();
      const role = normalizeText(message?.author?.role);
      if (!messageId || (role !== 'user' && role !== 'assistant')) continue;

      const createTime = normalizeArchiveTimestamp(message?.create_time);
      const updateTime = normalizeArchiveTimestamp(message?.update_time);
      const reasoningEffort = extractConversationMessageReasoningEffort(message);
      const modelSlug = extractConversationMessageModelSlug(message, reasoningEffort);
      const content = cloneArchiveJson(message?.content || null);
      const plainText = extractArchivePlainTextFromContent(content);
      const order = branchOrder.has(nodeId) ? branchOrder.get(nodeId) : -1;

      records.push({
        key: `${conversationId}:${messageId}`,
        conversationId,
        id: messageId,
        nodeId: String(nodeId || ''),
        parentNodeId: String(node?.parent || ''),
        childNodeIds: Array.isArray(node?.children) ? node.children.map(String) : [],
        role,
        createTime,
        createTimeSource: createTime > 0 ? 'api' : 'unknown',
        updateTime,
        branchOrder: order,
        onCurrentBranch: order >= 0,
        content,
        plainText,
        attachments: sanitizeArchiveAttachments(message),
        modelSlug: String(modelSlug || ''),
        reasoningEffort: String(reasoningEffort || ''),
        status: String(message?.status || ''),
        endTurn: Boolean(message?.end_turn),
        source: 'api',
        archivedAt: Date.now()
      });
    }

    const branchRecords = records
      .filter(record => record.onCurrentBranch)
      .sort((a, b) => a.branchOrder - b.branchOrder);
    return {
      records,
      branchRecords,
      currentNodeId: String(payload?.current_node || ''),
      branchNodeIds
    };
  }

  async function getArchivedConversation(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) return null;
    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_CONVERSATIONS_STORE, 'readonly');
    return archiveRequestToPromise(tx.objectStore(CHAT_ARCHIVE_CONVERSATIONS_STORE).get(id));
  }

  async function getArchivedConversations() {
    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_CONVERSATIONS_STORE, 'readonly');
    const result = await archiveRequestToPromise(tx.objectStore(CHAT_ARCHIVE_CONVERSATIONS_STORE).getAll());
    return (Array.isArray(result) ? result : []).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  async function getArchivedMessages(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) return [];
    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_MESSAGES_STORE, 'readonly');
    const store = tx.objectStore(CHAT_ARCHIVE_MESSAGES_STORE);
    const index = store.index('conversationId');
    const result = await archiveRequestToPromise(index.getAll(IDBKeyRange.only(id)));
    return (Array.isArray(result) ? result : []).sort((a, b) => {
      const ao = Number(a.branchOrder ?? -1);
      const bo = Number(b.branchOrder ?? -1);
      if (ao >= 0 && bo >= 0) return ao - bo;
      if (ao >= 0) return -1;
      if (bo >= 0) return 1;
      return Number(a.createTime || 0) - Number(b.createTime || 0);
    });
  }

  async function getArchivedSnapshots(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) return [];
    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_SNAPSHOTS_STORE, 'readonly');
    const store = tx.objectStore(CHAT_ARCHIVE_SNAPSHOTS_STORE);
    const index = store.index('conversationId');
    const result = await archiveRequestToPromise(index.getAll(IDBKeyRange.only(id)));
    return (Array.isArray(result) ? result : []).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }


  async function getArchivedSnapshotConversationIds() {
    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_SNAPSHOTS_STORE, 'readonly');
    const snapshots = await archiveRequestToPromise(
      tx.objectStore(CHAT_ARCHIVE_SNAPSHOTS_STORE).getAll()
    );
    return new Set(
      (Array.isArray(snapshots) ? snapshots : [])
        .map(snapshot => String(snapshot?.conversationId || '').trim())
        .filter(Boolean)
    );
  }

  function isConversationArchiveExistenceApiHealthy() {
    return Boolean(
      conversationArchiveExistenceApiHealthyAt &&
      Date.now() - conversationArchiveExistenceApiHealthyAt <= CHAT_ARCHIVE_EXISTENCE_HEALTH_MAX_AGE_MS
    );
  }

  async function classifyMissingConversationResponse(response) {
    if (!(response instanceof Response)) return 'unknown';
    if (response.ok) {
      conversationArchiveExistenceApiHealthyAt = Date.now();
      return 'exists';
    }
    if (response.status === 410) return 'missing';
    if (response.status !== 404) return 'unknown';

    // An exact conversation endpoint can still return a generic 404 when ChatGPT changes
    // routing. Never treat that as deletion. Require the response body itself to say that
    // the conversation is absent/deleted.
    let body = '';
    try { body = normalizeText(await response.clone().text()); } catch {}
    if (!body) return 'unknown';
    const mentionsConversation = body.includes('conversation') || body.includes('chat');
    const saysMissing = [
      'not found', 'not_found', 'does not exist', 'doesn\'t exist',
      'no longer exists', 'deleted', 'removed'
    ].some(term => body.includes(term));
    return mentionsConversation && saysMissing ? 'missing' : 'unknown';
  }

  async function probeChatGptConversationExistence(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) return 'unknown';

    let token = conversationAccessToken || await resolveConversationAccessToken();
    // Ghost cleanup is destructive. Unlike normal metadata reads, do not fall back to
    // cookie-only probing because an unauthenticated 404 must never count as deletion.
    if (!token) return 'unknown';

    const url = `${location.origin}/backend-api/conversation/${encodeURIComponent(id)}`;
    const requestConversation = currentToken => fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${currentToken}` }
    });

    try {
      let response = await requestConversation(token);
      if (response.status === 401 || response.status === 403) {
        conversationAccessToken = '';
        token = await resolveConversationAccessToken();
        if (!token) return 'unknown';
        response = await requestConversation(token);
      }
      return classifyMissingConversationResponse(response);
    } catch {
      return 'unknown';
    }
  }

  async function establishConversationArchiveExistenceApiHealth(conversations, snapshotConversationIds) {
    if (isConversationArchiveExistenceApiHealthy()) return true;

    const currentId = getCurrentConversationId();
    const anchors = [];
    if (currentId) anchors.push(currentId);

    // Prefer snapshot-protected archives as health probes: even if one unexpectedly reports
    // missing, it is never eligible for automatic deletion. Then add a couple of ordinary
    // archives as non-destructive probes so a library made entirely of unsnapshotted chats
    // can still prove the exact-conversation endpoint is healthy.
    for (const conversation of Array.isArray(conversations) ? conversations : []) {
      const id = String(conversation?.id || '').trim();
      if (!id || anchors.includes(id) || !snapshotConversationIds.has(id)) continue;
      anchors.push(id);
      if (anchors.length >= 3) break;
    }
    if (anchors.length < 3) {
      for (const conversation of Array.isArray(conversations) ? conversations : []) {
        const id = String(conversation?.id || '').trim();
        if (!id || anchors.includes(id)) continue;
        anchors.push(id);
        if (anchors.length >= 3) break;
      }
    }

    for (const id of anchors) {
      const status = await probeChatGptConversationExistence(id);
      if (status === 'exists') return true;
    }
    return isConversationArchiveExistenceApiHealthy();
  }

  async function cleanupDeletedConversationArchives(force = false) {
    if (conversationArchiveGhostCleanupRunning) return 0;
    conversationArchiveGhostCleanupRunning = true;

    try {
      const [conversations, snapshotConversationIds] = await Promise.all([
        getArchivedConversations(),
        getArchivedSnapshotConversationIds()
      ]);
      if (!conversations.length) return 0;

      const now = Date.now();
      const candidates = conversations.filter(conversation => {
        const id = String(conversation?.id || '').trim();
        if (!id || snapshotConversationIds.has(id)) return false;
        const ageAnchor = Number(conversation?.archivedAt || conversation?.updatedAt || conversation?.createdAt || 0);
        if (ageAnchor && now - ageAnchor < CHAT_ARCHIVE_GHOST_MIN_AGE_MS) return false;
        if (!force) {
          const lastChecked = Number(conversationArchiveExistenceChecks.get(id) || 0);
          if (lastChecked && now - lastChecked < CHAT_ARCHIVE_GHOST_CLEANUP_INTERVAL_MS) return false;
        }
        return true;
      }).slice(0, CHAT_ARCHIVE_GHOST_MAX_CHECKS_PER_PASS);

      if (!candidates.length) return 0;
      if (!(await establishConversationArchiveExistenceApiHealth(conversations, snapshotConversationIds))) {
        return 0;
      }

      let deleted = 0;
      for (const conversation of candidates) {
        const id = String(conversation?.id || '').trim();
        if (!id) continue;
        conversationArchiveExistenceChecks.set(id, Date.now());

        const first = await probeChatGptConversationExistence(id);
        if (first !== 'missing' || !isConversationArchiveExistenceApiHealthy()) continue;

        await new Promise(resolve => window.setTimeout(resolve, CHAT_ARCHIVE_GHOST_CONFIRM_DELAY_MS));
        const second = await probeChatGptConversationExistence(id);
        if (second !== 'missing' || !isConversationArchiveExistenceApiHealthy()) continue;

        // Snapshot creation can race with this background pass. Re-check at the destructive
        // edge so even a snapshot made one second ago permanently protects the archive.
        const snapshots = await getArchivedSnapshots(id);
        if (snapshots.length) continue;

        if (await deleteConversationArchive(id)) {
          conversationArchiveExistenceChecks.delete(id);
          deleted += 1;
        }
      }
      return deleted;
    } catch {
      return 0;
    } finally {
      conversationArchiveGhostCleanupRunning = false;
    }
  }

  async function deleteConversationArchiveSnapshot(conversationId, snapshotId) {
    const id = String(conversationId || '').trim();
    const targetSnapshotId = String(snapshotId || '').trim();
    if (!id || !targetSnapshotId) return false;

    const snapshots = await getArchivedSnapshots(id);
    const snapshot = snapshots.find(item => String(item?.id || '') === targetSnapshotId);
    if (!snapshot) return false;

    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_SNAPSHOTS_STORE, 'readwrite');
    const done = archiveTransactionDone(tx);
    tx.objectStore(CHAT_ARCHIVE_SNAPSHOTS_STORE).delete(targetSnapshotId);
    await done;
    notifyConversationArchiveChanged(id);
    return true;
  }

  async function deleteConversationArchive(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) return false;

    // If this is the conversation currently open in the tab, stop live capture from
    // immediately recreating the archive the user just explicitly deleted. A reload/new
    // page session intentionally clears this suppression and allows archiving to resume.
    if (id === getCurrentConversationId()) conversationArchiveDeletedUntilReload.add(id);

    const db = await openConversationArchiveDb();
    const tx = db.transaction(
      [CHAT_ARCHIVE_CONVERSATIONS_STORE, CHAT_ARCHIVE_MESSAGES_STORE, CHAT_ARCHIVE_SNAPSHOTS_STORE],
      'readwrite'
    );
    const done = archiveTransactionDone(tx);
    tx.objectStore(CHAT_ARCHIVE_CONVERSATIONS_STORE).delete(id);

    const deleteIndexedRecords = storeName => new Promise((resolve, reject) => {
      const store = tx.objectStore(storeName);
      const request = store.index('conversationId').openCursor(IDBKeyRange.only(id));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error(`Could not delete ${storeName} archive records`));
    });

    await Promise.all([
      deleteIndexedRecords(CHAT_ARCHIVE_MESSAGES_STORE),
      deleteIndexedRecords(CHAT_ARCHIVE_SNAPSHOTS_STORE)
    ]);
    await done;

    // Remove continuation links that would otherwise point at a local archive that no
    // longer exists. This never touches the original ChatGPT conversation itself.
    try {
      const parsed = JSON.parse(localStorage.getItem(CHAT_ARCHIVE_CONTEXT_LINK_KEY) || '{}');
      if (parsed && typeof parsed === 'object') {
        let changed = false;
        for (const [targetId, value] of Object.entries(parsed)) {
          if (targetId === id || String(value?.sourceConversationId || '') === id) {
            delete parsed[targetId];
            changed = true;
          }
        }
        if (changed) localStorage.setItem(CHAT_ARCHIVE_CONTEXT_LINK_KEY, JSON.stringify(parsed));
      }
    } catch {}

    notifyConversationArchiveChanged(id);
    return true;
  }

  function notifyConversationArchiveChanged(conversationId) {
    try { conversationArchiveChannel?.postMessage({ type: 'changed', conversationId }); } catch {}
    if (document.getElementById(CHAT_ARCHIVE_MODAL_ID)) scheduleConversationArchiveModalRefresh(40);
  }

  async function createConversationArchiveSnapshot(conversationId, name = '', type = 'manual') {
    const conversation = await getArchivedConversation(conversationId);
    if (!conversation) return null;

    const snapshots = await getArchivedSnapshots(conversationId);
    const sequence = snapshots.length + 1;
    const createdAt = Date.now();
    const snapshot = {
      id: `${conversationId}:${createdAt}:${Math.random().toString(36).slice(2, 8)}`,
      conversationId,
      name: String(name || '').trim() || (type === 'automatic'
        ? `Auto · ${Number(conversation.messageCount || 0)} messages`
        : `Snapshot ${sequence}`),
      type,
      createdAt,
      throughNodeId: String(conversation.currentNodeId || ''),
      throughMessageId: String(conversation.lastMessageId || ''),
      messageIds: Array.isArray(conversation.currentBranchMessageIds)
        ? conversation.currentBranchMessageIds.map(String).filter(Boolean)
        : [],
      messageCount: Number(conversation.messageCount || 0),
      updatedAt: Number(conversation.updatedAt || createdAt)
    };

    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_SNAPSHOTS_STORE, 'readwrite');
    tx.objectStore(CHAT_ARCHIVE_SNAPSHOTS_STORE).put(snapshot);
    await archiveTransactionDone(tx);
    notifyConversationArchiveChanged(conversationId);
    return snapshot;
  }

  async function ensureAutomaticConversationArchiveSnapshot(conversationId, conversation) {
    if (!conversation || !Number(conversation.messageCount || 0)) return;
    const snapshots = await getArchivedSnapshots(conversationId);
    const latest = snapshots[0] || null;
    const messageCount = Number(conversation.messageCount || 0);
    const latestCount = Number(latest?.messageCount || 0);
    const latestAge = latest ? Date.now() - Number(latest.createdAt || 0) : Infinity;
    const advancedEnough = messageCount >= latestCount + CHAT_ARCHIVE_AUTO_SNAPSHOT_MESSAGE_STEP;
    const agedAndAdvanced = messageCount > latestCount && latestAge >= CHAT_ARCHIVE_AUTO_SNAPSHOT_MIN_AGE_MS;
    if (!latest || advancedEnough || agedAndAdvanced) {
      await createConversationArchiveSnapshot(conversationId, '', 'automatic');
    }
  }

  async function archiveConversationPayload(conversationId, payload) {
    const id = String(conversationId || '').trim();
    if (!id || !payload || typeof payload !== 'object') return false;
    if (conversationArchiveDeletedUntilReload.has(id)) return false;

    try {
      const { records, branchRecords, currentNodeId } = buildArchiveRecordsFromConversationPayload(id, payload);
      if (!records.length) return false;
      const previous = await getArchivedConversation(id).catch(() => null);
      const now = Date.now();
      const firstTime = branchRecords.reduce((min, record) => record.createTime && (!min || record.createTime < min) ? record.createTime : min, 0);
      const last = branchRecords[branchRecords.length - 1] || null;
      const humanBranchRecords = branchRecords.filter(record => isArchiveHumanConversationMessage(record));
      const lastHuman = humanBranchRecords[humanBranchRecords.length - 1] || last;
      const conversation = {
        id,
        title: String(payload.title || previous?.title || getArchiveDocumentTitleFallback()).trim() || 'Untitled Chat',
        url: `${location.origin}/c/${encodeURIComponent(id)}`,
        createdAt: Number(previous?.createdAt || firstTime || now),
        updatedAt: Number(lastHuman?.updateTime || lastHuman?.createTime || payload.update_time && normalizeArchiveTimestamp(payload.update_time) || now),
        archivedAt: now,
        currentNodeId,
        // Snapshots deliberately point at the clean, human-visible transcript. Raw tool/code
        // records remain stored separately and can still be inspected through the database/JSON.
        currentBranchMessageIds: humanBranchRecords.map(record => String(record.id || '')).filter(Boolean),
        lastMessageId: String(lastHuman?.id || previous?.lastMessageId || ''),
        messageCount: humanBranchRecords.length,
        totalStoredMessages: records.length,
        userMessageCount: humanBranchRecords.filter(record => record.role === 'user').length,
        assistantMessageCount: humanBranchRecords.filter(record => record.role === 'assistant').length,
        source: 'api'
      };

      const db = await openConversationArchiveDb();
      const tx = db.transaction(
        [CHAT_ARCHIVE_CONVERSATIONS_STORE, CHAT_ARCHIVE_MESSAGES_STORE],
        'readwrite'
      );
      tx.objectStore(CHAT_ARCHIVE_CONVERSATIONS_STORE).put(conversation);
      const messageStore = tx.objectStore(CHAT_ARCHIVE_MESSAGES_STORE);
      for (const record of records) messageStore.put(record);
      await archiveTransactionDone(tx);

      void ensureAutomaticConversationArchiveSnapshot(id, conversation).catch(() => {});
      notifyConversationArchiveChanged(id);
      return true;
    } catch (error) {
      try { console.debug('[BraveFox Enhancer] Local conversation archive update failed.', error); } catch {}
      return false;
    }
  }

  function extractArchiveTextFromConversationSurface(surface) {
    if (!(surface instanceof Element)) return '';
    try {
      const clone = surface.cloneNode(true);
      for (const node of clone.querySelectorAll(
        `[${MESSAGE_META_ATTR}="true"], [${MESSAGE_ACTIONS_ATTR}], button, [role="button"]`
      )) node.remove();
      return String(clone.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
    } catch {
      return String(surface.textContent || '').trim();
    }
  }

  async function archiveVisibleConversationTail() {
    const conversationId = getCurrentConversationId();
    if (!conversationId) return false;
    if (conversationArchiveDeletedUntilReload.has(conversationId)) return false;

    // Capture the visible tail in real DOM order. The previous user-first/assistant-second
    // collection could scramble a DOM-only archive when authoritative conversation metadata
    // was temporarily unavailable.
    const allSurfaces = Array.from(document.querySelectorAll(
      '[data-user-message-bubble="true"], .bravefox-user-message-surface, ' +
      '[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface'
    )).filter(node => node instanceof HTMLElement);
    const candidates = allSurfaces.slice(-16).map((surface, tailIndex) => ({
      role: surface.matches('[data-user-message-bubble="true"], .bravefox-user-message-surface') ? 'user' : 'assistant',
      surface,
      domOrder: Math.max(0, allSurfaces.length - 16) + tailIndex
    }));
    if (!candidates.length) return false;

    const prepared = [];
    for (const { role, surface, domOrder } of candidates) {
      const root = getConversationTurnRoot(surface, surface, role) || surface;
      const ids = collectConversationMessageIds(surface);
      for (const id of collectConversationMessageIds(root)) if (!ids.includes(id)) ids.push(id);
      const messageId = ids[0];
      if (!messageId) continue;
      const text = extractArchiveTextFromConversationSurface(surface);
      if (!text) continue;
      prepared.push({ role, root, surface, messageId, text, domOrder, key: `${conversationId}:${messageId}` });
    }
    if (!prepared.length) return false;

    const db = await openConversationArchiveDb();
    const readTx = db.transaction(
      [CHAT_ARCHIVE_CONVERSATIONS_STORE, CHAT_ARCHIVE_MESSAGES_STORE],
      'readonly'
    );
    const readConversationStore = readTx.objectStore(CHAT_ARCHIVE_CONVERSATIONS_STORE);
    const readMessageStore = readTx.objectStore(CHAT_ARCHIVE_MESSAGES_STORE);
    const currentConversationPromise = archiveRequestToPromise(readConversationStore.get(conversationId)).catch(() => null);
    const existingPromises = prepared.map(item => archiveRequestToPromise(readMessageStore.get(item.key)).catch(() => null));
    const [currentConversation, existingRecords] = await Promise.all([
      currentConversationPromise,
      Promise.all(existingPromises)
    ]);

    const generationActive = isConversationGenerationActive();
    const index = conversationMetadataCaches.get(conversationId)?.index;
    const records = [];
    for (let i = 0; i < prepared.length; i += 1) {
      const { role, root, surface, messageId, text, domOrder, key } = prepared[i];
      const existing = existingRecords[i];
      const meta = index?.byId instanceof Map ? index.byId.get(messageId) : null;
      const exactMetadataTime = Number(meta?.rawTime || 0) || 0;
      const pendingTime = Number(
        role === 'user' ? conversationPendingUserSentAt : conversationPendingAssistantStartedAt
      ) || 0;
      const nativeDomTime = readInlineConversationRawTimestamp(root) || readInlineConversationRawTimestamp(surface);
      const existingTime = Number(existing?.createTime || 0) || 0;
      const existingTimeSource = String(existing?.createTimeSource || '').trim();
      const existingTimeTrusted = existingTime > 0 && (
        existing?.source === 'api' || ['api', 'api-cache', 'native-dom', 'send'].includes(existingTimeSource)
      );
      const createTime = exactMetadataTime || nativeDomTime || (existingTimeTrusted ? existingTime : 0) || pendingTime || 0;
      const createTimeSource = exactMetadataTime
        ? 'api-cache'
        : nativeDomTime
          ? 'native-dom'
          : existingTimeTrusted
            ? (existingTimeSource || (existing?.source === 'api' ? 'api' : 'unknown'))
            : pendingTime
              ? 'send'
              : 'unknown';
      const modelSlug = role === 'assistant'
        ? String(root.getAttribute(MESSAGE_MODEL_ATTR) || meta?.modelSlug || existing?.modelSlug || conversationPendingModelSlug || '')
        : '';
      const reasoningEffort = role === 'assistant'
        ? String(root.getAttribute(MESSAGE_REASONING_ATTR) || meta?.reasoningEffort || existing?.reasoningEffort || conversationPendingReasoningEffort || '')
        : '';

      // API records carry the richer original markdown/content object. DOM streaming may
      // update the visible text first, but never downgrade an API record to plain text.
      const record = existing && existing.source === 'api'
        ? {
            ...existing,
            createTime: exactMetadataTime || existing.createTime,
            createTimeSource: exactMetadataTime ? 'api' : (existing.createTimeSource || 'api'),
            plainText: text.length >= String(existing.plainText || '').length ? text : existing.plainText,
            archivedAt: Date.now()
          }
        : {
            ...(existing || {}),
            key,
            conversationId,
            id: messageId,
            nodeId: String(existing?.nodeId || ''),
            parentNodeId: String(existing?.parentNodeId || ''),
            childNodeIds: Array.isArray(existing?.childNodeIds) ? existing.childNodeIds : [],
            role,
            createTime,
            createTimeSource,
            updateTime: Date.now(),
            branchOrder: Number(existing?.branchOrder ?? -1) >= 0
              ? Number(existing.branchOrder)
              : Number(domOrder ?? -1),
            onCurrentBranch: existing?.onCurrentBranch !== false,
            content: existing?.content || { content_type: 'text', parts: [text] },
            plainText: text,
            attachments: Array.isArray(existing?.attachments) ? existing.attachments : [],
            modelSlug,
            reasoningEffort,
            status: generationActive && role === 'assistant' ? 'in_progress' : 'finished_successfully',
            endTurn: !generationActive,
            source: 'dom',
            archivedAt: Date.now()
          };
      records.push(record);
    }

    const now = Date.now();
    const writeTx = db.transaction(
      [CHAT_ARCHIVE_CONVERSATIONS_STORE, CHAT_ARCHIVE_MESSAGES_STORE],
      'readwrite'
    );
    const messageStore = writeTx.objectStore(CHAT_ARCHIVE_MESSAGES_STORE);
    for (const record of records) messageStore.put(record);
    writeTx.objectStore(CHAT_ARCHIVE_CONVERSATIONS_STORE).put({
      ...(currentConversation || {}),
      id: conversationId,
      title: String(currentConversation?.title || getArchiveDocumentTitleFallback()),
      url: `${location.origin}/c/${encodeURIComponent(conversationId)}`,
      createdAt: Number(currentConversation?.createdAt || now),
      updatedAt: now,
      archivedAt: now,
      currentNodeId: String(currentConversation?.currentNodeId || ''),
      currentBranchMessageIds: Array.isArray(currentConversation?.currentBranchMessageIds)
        ? currentConversation.currentBranchMessageIds
        : [],
      lastMessageId: String(currentConversation?.lastMessageId || ''),
      messageCount: Number(currentConversation?.messageCount || 0),
      totalStoredMessages: Number(currentConversation?.totalStoredMessages || 0),
      userMessageCount: Number(currentConversation?.userMessageCount || 0),
      assistantMessageCount: Number(currentConversation?.assistantMessageCount || 0),
      source: currentConversation?.source || 'dom'
    });
    await archiveTransactionDone(writeTx);
    notifyConversationArchiveChanged(conversationId);
    return true;
  }

  function scheduleConversationArchiveDomCapture(delay = 650) {
    if (!getCurrentConversationId()) return;
    if (conversationArchiveDomCaptureTimer) clearTimeout(conversationArchiveDomCaptureTimer);
    conversationArchiveDomCaptureTimer = window.setTimeout(() => {
      conversationArchiveDomCaptureTimer = 0;
      void archiveVisibleConversationTail();
    }, delay);
  }

  function scheduleConversationArchivePostStreamSync() {
    const conversationId = getCurrentConversationId();
    if (!conversationId) return;
    if (conversationArchivePostStreamTimer) clearTimeout(conversationArchivePostStreamTimer);
    conversationArchivePostStreamTimer = window.setTimeout(() => {
      conversationArchivePostStreamTimer = 0;
      if (isConversationGenerationActive()) {
        scheduleConversationArchivePostStreamSync();
        return;
      }
      const currentId = getCurrentConversationId();
      if (currentId) void fetchConversationMessageMetadataIndex(currentId, true);
    }, 2400);
  }

  function formatArchiveDateTime(value, includeSeconds = false) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 'Timestamp unavailable';
    const date = new Date(numeric);
    if (!Number.isFinite(date.getTime())) return 'Timestamp unavailable';
    try {
      const options = {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        timeZone: CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.timeZone || 'Europe/Helsinki'
      };
      if (includeSeconds) options.second = '2-digit';
      return new Intl.DateTimeFormat(CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.locale || 'fi-FI', options).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  function getArchiveMessageModelLabel(message) {
    if (!message || message.role !== 'assistant') return '';
    const rawLabel = formatConversationModelLabel(message.modelSlug);
    if (!rawLabel) return '';
    const modelLabel = /^gpt[- ]/i.test(rawLabel) ? rawLabel : `GPT-${rawLabel}`;
    const effortLabel = formatConversationReasoningEffort(message.reasoningEffort);
    if (!effortLabel || modelLabel.toLowerCase().includes(effortLabel.toLowerCase())) return modelLabel;
    return `${modelLabel} ${effortLabel}`;
  }

  function escapeArchiveHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getArchiveIsoTimestamp(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    const date = new Date(numeric);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }

  function archiveSafeFileName(value) {
    const safe = String(value || 'ChatGPT conversation')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    return safe || 'ChatGPT conversation';
  }

  // The backend conversation tree contains assistant-side implementation records that are not
  // part of the human transcript: empty transition nodes plus standalone tool/code invocations.
  // Keep those raw records in IndexedDB for fidelity/debugging, but hide them everywhere the
  // archive is presented as an actual conversation. A normal assistant reply that merely contains
  // fenced code remains content_type=text and is therefore preserved.
  function isArchiveHumanConversationMessage(message) {
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) return false;

    const contentType = normalizeText(message?.content?.content_type || '').replace(/[\s-]+/g, '_');
    const backstageAssistantTypes = new Set([
      'code', 'thoughts', 'reasoning_recap', 'execution_output', 'tool_result',
      'computer_initialize_state', 'computer_output', 'tether_browsing_display'
    ]);
    if (message.role === 'assistant' && backstageAssistantTypes.has(contentType)) return false;

    const text = String(message.plainText || '').trim();
    const attachments = Array.isArray(message.attachments) ? message.attachments.filter(Boolean) : [];
    return Boolean(text || attachments.length);
  }

  function getArchivedCurrentBranch(messages, snapshot = null) {
    const allMessages = Array.isArray(messages) ? messages : [];
    if (Array.isArray(snapshot?.messageIds) && snapshot.messageIds.length) {
      const byId = new Map(allMessages.map(message => [String(message.id || ''), message]));
      return snapshot.messageIds
        .map(id => byId.get(String(id)))
        .filter(message => isArchiveHumanConversationMessage(message));
    }

    let branch = allMessages.filter(message => message.onCurrentBranch !== false);
    if (branch.some(message => Number(message.branchOrder) >= 0)) {
      branch = branch.filter(message => Number(message.branchOrder) >= 0)
        .sort((a, b) => Number(a.branchOrder) - Number(b.branchOrder));
    } else {
      branch.sort((a, b) => Number(a.createTime || 0) - Number(b.createTime || 0));
    }
    const limit = Number(snapshot?.messageCount || 0);
    if (limit > 0) branch = branch.slice(0, limit);
    return branch.filter(message => isArchiveHumanConversationMessage(message));
  }

  async function repairArchivedMessageMetadataFromIndex(conversationId, index) {
    const id = String(conversationId || '').trim();
    if (!id || !(index?.byId instanceof Map)) return false;

    const messages = await getArchivedMessages(id).catch(() => []);
    if (!messages.length) return false;
    const db = await openConversationArchiveDb();
    const tx = db.transaction(CHAT_ARCHIVE_MESSAGES_STORE, 'readwrite');
    const store = tx.objectStore(CHAT_ARCHIVE_MESSAGES_STORE);
    let changed = false;

    for (const message of messages) {
      const meta = index.byId.get(String(message.id || ''));
      const exactTime = Number(meta?.rawTime || 0) || 0;
      const next = { ...message };
      let messageChanged = false;

      if (exactTime > 0 && (Number(message.createTime || 0) !== exactTime || message.createTimeSource !== 'api')) {
        next.createTime = exactTime;
        next.createTimeSource = 'api';
        messageChanged = true;
      } else if (
        !exactTime &&
        message.source === 'dom' &&
        !String(message.createTimeSource || '').trim() &&
        Number(message.createTime || 0) > 0
      ) {
        // Archive v1 used Date.now() for old DOM-only messages. That looked precise but was
        // merely the capture time. Never export that value as if it were the message time.
        next.createTime = 0;
        next.createTimeSource = 'unknown';
        messageChanged = true;
      }

      if (message.role === 'assistant') {
        const modelSlug = String(meta?.modelSlug || '').trim();
        const reasoningEffort = String(meta?.reasoningEffort || '').trim();
        if (modelSlug && modelSlug !== String(message.modelSlug || '')) {
          next.modelSlug = modelSlug;
          messageChanged = true;
        }
        if (reasoningEffort && reasoningEffort !== String(message.reasoningEffort || '')) {
          next.reasoningEffort = reasoningEffort;
          messageChanged = true;
        }
      }

      if (messageChanged) {
        next.archivedAt = Date.now();
        store.put(next);
        changed = true;
      }
    }

    await archiveTransactionDone(tx);
    if (changed) notifyConversationArchiveChanged(id);
    return changed;
  }

  async function prepareConversationArchiveForExport(conversationId) {
    const id = String(conversationId || '').trim();
    if (!id) return null;

    let index = null;
    try {
      index = await fetchConversationMessageMetadataIndex(id, true);
    } catch {}

    const activeSync = conversationArchivePayloadSyncs.get(id);
    if (activeSync) {
      try { await activeSync; } catch {}
    }

    if (index?.byId instanceof Map) {
      try { await repairArchivedMessageMetadataFromIndex(id, index); } catch {}
    }
    return index;
  }

  async function buildConversationArchiveMarkdown(conversationId, snapshotId = '') {
    const [conversation, messages, snapshots] = await Promise.all([
      getArchivedConversation(conversationId),
      getArchivedMessages(conversationId),
      getArchivedSnapshots(conversationId)
    ]);
    if (!conversation) return '';
    const snapshot = snapshotId ? snapshots.find(item => item.id === snapshotId) : null;
    const branch = getArchivedCurrentBranch(messages, snapshot);
    const lines = [
      `# ${conversation.title || 'ChatGPT Conversation'}`,
      '',
      `> Local BraveFox archive · ${branch.length} messages · ${formatArchiveDateTime(snapshot?.createdAt || conversation.updatedAt)}`,
      ''
    ];
    for (const message of branch) {
      const role = message.role === 'user' ? 'User' : 'ChatGPT';
      const modelLabel = getArchiveMessageModelLabel(message);
      const model = modelLabel ? ` · ${modelLabel}` : '';
      lines.push(`## ${role} · ${formatArchiveDateTime(message.createTime, true)}${model}`, '', String(message.plainText || '').trim(), '');
    }
    return lines.join('\n').trim() + '\n';
  }

  function isArchiveImageAttachment(attachment) {
    if (!attachment || typeof attachment !== 'object') return false;
    return Boolean(
      attachment.isImage ||
      /^image\//i.test(String(attachment.mimeType || '')) ||
      /^data:image\//i.test(String(attachment.imageUrl || '').trim())
    );
  }

  function getArchiveAttachmentCacheKey(attachment) {
    return String(
      attachment?.id ||
      attachment?.assetPointer ||
      attachment?.imageUrl ||
      attachment?.name ||
      ''
    ).trim();
  }

  function archiveBlobToDataUrl(blob, fallbackMimeType = '') {
    return new Promise((resolve, reject) => {
      try {
        const mimeType = String(blob?.type || fallbackMimeType || '').trim();
        const readableBlob = blob && !blob.type && mimeType
          ? new Blob([blob], { type: mimeType })
          : blob;
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not encode image attachment'));
        reader.readAsDataURL(readableBlob);
      } catch (error) {
        reject(error);
      }
    });
  }

  function isArchiveImageMissingStatus(status) {
    return status === 404 || status === 410;
  }

  function isArchiveImageRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  function describeArchiveImageFailure(result) {
    const status = Number(result?.status || 0) || 0;
    const reason = String(result?.reason || '').trim();
    if (status) return `HTTP ${status}${reason ? ` (${reason})` : ''}`;
    return reason || 'unknown retrieval failure';
  }

  async function waitForArchiveImageRetry(attempt) {
    const multiplier = Math.max(1, Number(attempt || 1));
    await new Promise(resolve => window.setTimeout(resolve, CHAT_ARCHIVE_IMAGE_RETRY_DELAY_MS * multiplier));
  }

  async function fetchArchiveImageRequest(url, init = {}) {
    const target = String(url || '').trim();
    if (!target) return { state: 'failed', reason: 'missing URL' };

    let parsed = null;
    try { parsed = new URL(target, location.origin); } catch {
      return { state: 'failed', reason: 'invalid URL' };
    }

    let lastFailure = { state: 'failed', reason: 'request failed' };
    for (let attempt = 1; attempt <= CHAT_ARCHIVE_IMAGE_FETCH_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), CHAT_ARCHIVE_IMAGE_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(parsed.href, { ...init, signal: controller.signal });
        if (response.ok) return { state: 'ok', response };

        const status = Number(response.status || 0) || 0;
        if (isArchiveImageMissingStatus(status)) {
          let bodyText = '';
          try { bodyText = String(await response.clone().text()).slice(0, 2048); } catch {}
          const normalizedBody = normalizeText(bodyText);
          const explicitlyNamesMissingAsset = Boolean(
            status === 410 ||
            /(?:file|attachment|asset|image).{0,80}(?:not found|deleted|does not exist|no longer exists|unavailable)/i.test(bodyText) ||
            /(?:not found|deleted|does not exist|no longer exists|unavailable).{0,80}(?:file|attachment|asset|image)/i.test(bodyText) ||
            normalizedBody.includes('file_not_found') ||
            normalizedBody.includes('attachment_not_found')
          );
          return {
            state: 'missing',
            status,
            confirmedMissing: explicitlyNamesMissingAsset,
            reason: bodyText || response.statusText || 'not found'
          };
        }

        lastFailure = {
          state: 'failed',
          status,
          reason: response.statusText || `HTTP ${status || 'error'}`
        };
        if (!isArchiveImageRetryableStatus(status) || attempt >= CHAT_ARCHIVE_IMAGE_FETCH_ATTEMPTS) {
          return lastFailure;
        }
      } catch (error) {
        const timedOut = error?.name === 'AbortError';
        lastFailure = {
          state: 'failed',
          reason: timedOut ? 'request timed out' : String(error?.message || error || 'network error')
        };
        if (attempt >= CHAT_ARCHIVE_IMAGE_FETCH_ATTEMPTS) return lastFailure;
      } finally {
        window.clearTimeout(timer);
      }

      await waitForArchiveImageRetry(attempt);
    }
    return lastFailure;
  }

  async function fetchArchiveImageResponse(url, token = '', expectedMimeType = '') {
    const target = String(url || '').trim();
    if (!target) return { state: 'failed', reason: 'missing image URL' };
    if (/^data:image\//i.test(target)) {
      return {
        state: 'resolved',
        dataUrl: target,
        mimeType: String(expectedMimeType || '')
      };
    }

    let parsed = null;
    try { parsed = new URL(target, location.origin); } catch {
      return { state: 'failed', reason: 'invalid image URL' };
    }
    const sameOrigin = parsed.origin === location.origin;
    const headers = { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' };
    if (sameOrigin && token) headers.Authorization = `Bearer ${token}`;

    const fetched = await fetchArchiveImageRequest(parsed.href, {
      method: 'GET',
      credentials: sameOrigin ? 'include' : 'omit',
      cache: 'no-store',
      headers
    });
    if (fetched.state !== 'ok') return fetched;

    const response = fetched.response;
    let blob = null;
    try { blob = await response.blob(); } catch (error) {
      return { state: 'failed', reason: String(error?.message || error || 'could not read image response') };
    }
    const type = String(blob.type || response.headers.get('content-type') || '').split(';')[0].trim();
    const expectedType = String(expectedMimeType || '').split(';')[0].trim();
    if (type && !/^image\//i.test(type) && !/^image\//i.test(expectedType)) {
      return { state: 'failed', status: response.status, reason: `unexpected content type ${type}` };
    }
    const finalType = /^image\//i.test(type) ? type : expectedType;
    try {
      const dataUrl = await archiveBlobToDataUrl(blob, finalType);
      return dataUrl
        ? { state: 'resolved', dataUrl, mimeType: finalType, size: blob.size }
        : { state: 'failed', reason: 'empty encoded image' };
    } catch (error) {
      return { state: 'failed', reason: String(error?.message || error || 'could not encode image') };
    }
  }

  async function resolveArchiveImageDescriptor(descriptorUrl, token, attachment) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const fetched = await fetchArchiveImageRequest(descriptorUrl, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers
    });
    if (fetched.state !== 'ok') return fetched;

    const response = fetched.response;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('image/')) {
      try {
        const blob = await response.blob();
        const dataUrl = await archiveBlobToDataUrl(blob, attachment.mimeType);
        return dataUrl
          ? { state: 'resolved', dataUrl, mimeType: blob.type || contentType, size: blob.size }
          : { state: 'failed', reason: 'empty encoded image' };
      } catch (error) {
        return { state: 'failed', reason: String(error?.message || error || 'could not read image response') };
      }
    }

    let payload = null;
    try { payload = await response.json(); } catch (error) {
      return { state: 'failed', status: response.status, reason: 'descriptor was not valid JSON' };
    }
    const downloadUrl = String(
      payload?.download_url || payload?.downloadUrl || payload?.url || ''
    ).trim();
    if (!downloadUrl) {
      return { state: 'failed', status: response.status, reason: 'descriptor contained no download URL' };
    }
    return fetchArchiveImageResponse(downloadUrl, token, attachment.mimeType);
  }

  async function resolveArchiveImageAttachment(conversationId, attachment, token = '') {
    if (!isArchiveImageAttachment(attachment)) {
      return { state: 'failed', reason: 'attachment is not an image' };
    }

    const directUrl = String(attachment.imageUrl || '').trim();
    const fileId = String(
      attachment.id || getArchiveFileIdFromAssetPointer(attachment.assetPointer) || ''
    ).trim();
    const observations = [];

    if (directUrl) {
      const direct = await fetchArchiveImageResponse(directUrl, token, attachment.mimeType);
      if (direct.state === 'resolved') return direct;
      observations.push({ source: 'direct image URL', result: direct });
    }

    if (fileId) {
      const encodedConversationId = encodeURIComponent(String(conversationId || '').trim());
      const encodedFileId = encodeURIComponent(fileId);
      const descriptorUrls = [
        `${location.origin}/backend-api/conversation/${encodedConversationId}/attachment/${encodedFileId}/download`,
        `${location.origin}/backend-api/files/${encodedFileId}/download`,
        `${location.origin}/backend-api/files/download/${encodedFileId}?conversation_id=${encodedConversationId}&inline=false`,
        `${location.origin}/files/download/${encodedFileId}?conversation_id=${encodedConversationId}&inline=false`
      ];

      for (const descriptorUrl of descriptorUrls) {
        const result = await resolveArchiveImageDescriptor(descriptorUrl, token, attachment);
        if (result.state === 'resolved') return result;
        observations.push({ source: descriptorUrl, result });

        // A backend response that explicitly identifies this file/attachment as gone is
        // sufficient evidence; do not burn through legacy fallback endpoints after that.
        if (result.state === 'missing' && result.confirmedMissing) {
          return {
            state: 'missing',
            status: Number(result.status || 0) || 404,
            reason: `permanently unavailable (HTTP ${Number(result.status || 0) || 404})`
          };
        }

        // Authentication/permission failures are not evidence that the file is gone.
        // Stop probing alternate endpoints and make the export fail explicitly instead.
        if (result.state === 'failed' && (result.status === 401 || result.status === 403)) break;
      }
    }

    if (!observations.length) {
      return { state: 'failed', reason: 'attachment has no retrievable URL or file ID' };
    }

    // Only call an attachment permanently unavailable when every authoritative attempt ended in an
    // explicit 404/410 AND at least one response positively identified the missing object
    // as a file/attachment/asset (or used HTTP 410 Gone). Generic route-level 404 pages are
    // deliberately NOT enough evidence to skip an image.
    const authoritativeObservations = fileId
      ? observations.filter(item => item.source !== 'direct image URL')
      : observations;
    const allMissing = authoritativeObservations.length > 0 &&
      authoritativeObservations.every(item => item.result?.state === 'missing');
    const confirmedMissing = authoritativeObservations.some(item => Boolean(item.result?.confirmedMissing));
    if (allMissing && confirmedMissing) {
      const statuses = Array.from(new Set(authoritativeObservations.map(item => Number(item.result?.status || 0)).filter(Boolean)));
      return {
        state: 'missing',
        status: statuses[0] || 404,
        reason: statuses.length ? `permanently unavailable (${statuses.map(status => `HTTP ${status}`).join('/')})` : 'permanently unavailable'
      };
    }

    const firstFailure = observations.find(item => item.result?.state === 'failed') || observations[0];
    return {
      state: 'failed',
      status: Number(firstFailure?.result?.status || 0) || 0,
      reason: `${firstFailure?.source || 'image retrieval'}: ${describeArchiveImageFailure(firstFailure?.result)}`
    };
  }

  async function buildArchiveEmbeddedImageMap(conversationId, branch, onProgress = null) {
    const unique = new Map();
    for (const message of Array.isArray(branch) ? branch : []) {
      for (const attachment of Array.isArray(message?.attachments) ? message.attachments : []) {
        if (!isArchiveImageAttachment(attachment)) continue;
        const key = getArchiveAttachmentCacheKey(attachment);
        if (key && !unique.has(key)) unique.set(key, attachment);
      }
    }
    if (!unique.size) {
      if (typeof onProgress === 'function') {
        try { onProgress({ completed: 0, total: 0, resolved: 0, unavailable: 0, failed: 0 }); } catch {}
      }
      return { resolved: new Map(), unavailable: new Map(), total: 0 };
    }

    let token = '';
    try { token = conversationAccessToken || await resolveConversationAccessToken(); } catch {}
    const entries = Array.from(unique.entries());
    const resolved = new Map();
    const unavailable = new Map();
    const failures = [];
    let cursor = 0;
    let completed = 0;

    const reportProgress = () => {
      if (typeof onProgress !== 'function') return;
      try {
        onProgress({
          completed,
          total: entries.length,
          resolved: resolved.size,
          unavailable: unavailable.size,
          failed: failures.length
        });
      } catch {}
    };
    reportProgress();

    const worker = async () => {
      while (true) {
        const index = cursor++;
        if (index >= entries.length) return;
        const [key, attachment] = entries[index];
        let result = null;
        try {
          result = await resolveArchiveImageAttachment(conversationId, attachment, token);
        } catch (error) {
          result = { state: 'failed', reason: String(error?.message || error || 'unexpected resolver error') };
        }

        if (result?.state === 'resolved' && result.dataUrl) {
          resolved.set(key, result);
        } else if (result?.state === 'missing') {
          unavailable.set(key, result);
        } else {
          failures.push({
            key,
            attachment,
            status: Number(result?.status || 0) || 0,
            reason: String(result?.reason || 'unknown retrieval failure')
          });
        }

        completed += 1;
        reportProgress();
      }
    };

    const workerCount = Math.min(CHAT_ARCHIVE_IMAGE_CONCURRENCY, entries.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (failures.length) {
      const examples = failures.slice(0, 5).map(item => {
        const name = String(item.attachment?.name || item.attachment?.id || item.key || 'image');
        return `${name}: ${item.status ? `HTTP ${item.status} · ` : ''}${item.reason}`;
      });
      const more = failures.length > examples.length ? `\n…plus ${failures.length - examples.length} more.` : '';
      const error = new Error(
        `HTML export stopped because ${failures.length} of ${entries.length} image attachments could not be verified. ` +
        `No images were silently skipped. Retry the export when the connection/API is healthy.\n\n${examples.join('\n')}${more}`
      );
      error.name = 'BraveFoxArchiveImageExportIncompleteError';
      error.failures = failures;
      throw error;
    }

    return { resolved, unavailable, total: entries.length };
  }

  function removeEmbeddedImagePlaceholder(text, embeddedImageCount) {
    const value = String(text || '');
    if (!embeddedImageCount) return value;
    return value
      .replace(/(^|\n)\s*\[Image\/attachment\]\s*(?=\n|$)/gi, '$1')
      .replace(/^\s*\n+|\n+\s*$/g, '')
      .trim();
  }

  async function buildConversationArchiveHtml(conversationId, snapshotId = '', onProgress = null) {
    const [conversation, messages, snapshots] = await Promise.all([
      getArchivedConversation(conversationId),
      getArchivedMessages(conversationId),
      getArchivedSnapshots(conversationId)
    ]);
    if (!conversation) return '';
    const snapshot = snapshotId ? snapshots.find(item => item.id === snapshotId) : null;
    const branch = getArchivedCurrentBranch(messages, snapshot);
    const title = String(conversation.title || 'ChatGPT Conversation');
    const exportedAt = Date.now();
    const archiveStateAt = Number(snapshot?.createdAt || conversation.updatedAt || 0);
    const sourceUrl = String(conversation.url || '');

    const imageResolution = await buildArchiveEmbeddedImageMap(conversationId, branch, onProgress);
    const embeddedImages = imageResolution.resolved;
    const unavailableImages = imageResolution.unavailable;
    const messageHtml = branch.map(message => {
      const isUser = message.role === 'user';
      const roleLabel = isUser ? 'You' : 'ChatGPT';
      const modelLabel = getArchiveMessageModelLabel(message);
      const iso = getArchiveIsoTimestamp(message.createTime);
      const localTime = formatArchiveDateTime(message.createTime, true);
      const timestampHtml = iso
        ? `<time datetime="${escapeArchiveHtml(iso)}" title="${escapeArchiveHtml(iso)}">${escapeArchiveHtml(localTime)}</time>`
        : '<span class="timestamp-missing">Timestamp unavailable</span>';
      const attachments = Array.isArray(message.attachments) ? message.attachments.filter(Boolean) : [];
      const embedded = [];
      const fallbackAttachments = [];
      for (const item of attachments) {
        const key = getArchiveAttachmentCacheKey(item);
        const image = key ? embeddedImages.get(key) : null;
        if (image?.dataUrl && isArchiveImageAttachment(item)) embedded.push({ item, image });
        else fallbackAttachments.push(item);
      }
      const imageHtml = embedded.length
        ? `<div class="embedded-images">${embedded.map(({ item, image }) => {
            const name = String(item.name || item.id || 'Attached image');
            const dimensions = item.width && item.height ? `${item.width}×${item.height}` : '';
            const size = Number(image.size || item.size || 0) || 0;
            const details = [dimensions, size ? `${size} bytes` : ''].filter(Boolean).join(' · ');
            return `<figure class="archive-image"><img loading="lazy" src="${escapeArchiveHtml(image.dataUrl)}" alt="${escapeArchiveHtml(name)}"><figcaption>${escapeArchiveHtml(name)}${details ? ` <span>${escapeArchiveHtml(details)}</span>` : ''}</figcaption></figure>`;
          }).join('')}</div>`
        : '';
      const attachmentHtml = fallbackAttachments.length
        ? `<ul class="attachments">${fallbackAttachments.map(item => {
            const name = String(item.name || item.id || 'Attachment');
            const key = getArchiveAttachmentCacheKey(item);
            const permanentlyUnavailable = Boolean(key && unavailableImages.has(key) && isArchiveImageAttachment(item));
            const details = [
              item.mimeType,
              item.size ? `${item.size} bytes` : '',
              permanentlyUnavailable ? 'image unavailable at export time' : ''
            ].filter(Boolean).join(' · ');
            return `<li>${escapeArchiveHtml(name)}${details ? ` <span>${escapeArchiveHtml(details)}</span>` : ''}</li>`;
          }).join('')}</ul>`
        : '';
      const visibleText = removeEmbeddedImagePlaceholder(message.plainText, embedded.length);
      return `
        <article class="message ${isUser ? 'user' : 'assistant'}">
          <header>
            <div class="who">${escapeArchiveHtml(roleLabel)}${modelLabel ? `<span class="model">${escapeArchiveHtml(modelLabel)}</span>` : ''}</div>
            ${timestampHtml}
          </header>
          ${visibleText ? `<div class="message-body">${escapeArchiveHtml(visibleText)}</div>` : ''}
          ${imageHtml}
          ${attachmentHtml}
        </article>`;
    }).join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeArchiveHtml(title)} · BraveFox archive</title>
<style>
  :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: Canvas; color: CanvasText; }
  main { width: min(1000px, calc(100% - 32px)); margin: 32px auto 72px; }
  .archive-head { border-bottom: 1px solid color-mix(in srgb, CanvasText 18%, transparent); padding-bottom: 20px; margin-bottom: 24px; }
  h1 { margin: 0 0 8px; font-size: clamp(1.5rem, 4vw, 2.2rem); }
  .meta { opacity: .72; line-height: 1.6; }
  .meta a { color: inherit; }
  .message { border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 16px; margin: 14px 0; overflow: hidden; }
  .message.user { background: color-mix(in srgb, Canvas 92%, #7c6cff 8%); }
  .message.assistant { background: color-mix(in srgb, Canvas 96%, CanvasText 4%); }
  .message header { display: flex; gap: 12px; justify-content: space-between; align-items: baseline; padding: 12px 16px; border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent); }
  .who { font-weight: 700; }
  .model { display: inline-block; margin-left: 8px; padding: 2px 7px; border-radius: 999px; font-size: .78rem; font-weight: 650; background: color-mix(in srgb, CanvasText 9%, transparent); }
  time, .timestamp-missing { white-space: nowrap; font-size: .82rem; opacity: .7; }
  .timestamp-missing { font-style: italic; }
  .message-body { padding: 16px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
  .embedded-images { display: grid; gap: 12px; padding: 0 16px 16px; }
  .message header + .embedded-images { padding-top: 16px; }
  .archive-image { margin: 0; }
  .archive-image img { display: block; max-width: 100%; max-height: 780px; width: auto; height: auto; border-radius: 12px; border: 1px solid color-mix(in srgb, CanvasText 14%, transparent); background: color-mix(in srgb, CanvasText 4%, transparent); }
  .archive-image figcaption { margin-top: 6px; font-size: .82rem; opacity: .72; overflow-wrap: anywhere; }
  .archive-image figcaption span { opacity: .8; }
  .attachments { margin: 0 16px 16px 34px; padding: 0; }
  .attachments span { opacity: .65; font-size: .86em; }
  .foot { margin-top: 28px; opacity: .62; font-size: .84rem; }
  @media print { main { width: 100%; margin: 0; } .message { break-inside: avoid; } }
</style>
</head>
<body>
<main>
  <section class="archive-head">
    <h1>${escapeArchiveHtml(title)}</h1>
    <div class="meta">Local BraveFox archive · ${branch.length} messages · archive state ${escapeArchiveHtml(formatArchiveDateTime(archiveStateAt, true))}</div>
    <div class="meta">Exported ${escapeArchiveHtml(formatArchiveDateTime(exportedAt, true))}${sourceUrl ? ` · <a href="${escapeArchiveHtml(sourceUrl)}">Open original conversation</a>` : ''}</div>
  </section>
  ${messageHtml || '<p>No archived messages in this checkpoint.</p>'}
  <div class="foot">Timestamps are original ChatGPT message creation times when authoritative metadata was available. Missing timestamps are shown as unavailable rather than replaced with archive/export time. Image attachments are embedded directly in this HTML. An image is left as attachment metadata only when the server explicitly reported it unavailable (404/410); ambiguous retrieval failures stop the export instead of silently skipping images.</div>
</main>
</body>
</html>`;
  }

  function downloadConversationArchiveBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportConversationArchiveMarkdown(conversationId, snapshotId = '') {
    await prepareConversationArchiveForExport(conversationId);
    const conversation = await getArchivedConversation(conversationId);
    if (!conversation) return;
    const markdown = await buildConversationArchiveMarkdown(conversationId, snapshotId);
    downloadConversationArchiveBlob(`${archiveSafeFileName(conversation.title)}.md`, markdown, 'text/markdown;charset=utf-8');
  }

  async function exportConversationArchiveHtml(conversationId, snapshotId = '', onProgress = null) {
    await prepareConversationArchiveForExport(conversationId);
    const conversation = await getArchivedConversation(conversationId);
    if (!conversation) return;
    const html = await buildConversationArchiveHtml(conversationId, snapshotId, onProgress);
    downloadConversationArchiveBlob(`${archiveSafeFileName(conversation.title)}.html`, html, 'text/html;charset=utf-8');
  }

  async function exportConversationArchiveJson(conversationId) {
    await prepareConversationArchiveForExport(conversationId);
    const [conversation, messages, snapshots] = await Promise.all([
      getArchivedConversation(conversationId),
      getArchivedMessages(conversationId),
      getArchivedSnapshots(conversationId)
    ]);
    if (!conversation) return;
    const payload = {
      format: 'BraveFox Chat Archive v1',
      exportedAt: new Date().toISOString(),
      conversation,
      snapshots,
      messages
    };
    downloadConversationArchiveBlob(
      `${archiveSafeFileName(conversation.title)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
  }

  function buildArchiveContinuationText(conversation, messages, snapshot) {
    const branch = getArchivedCurrentBranch(messages, snapshot);
    if (!branch.length) return '';
    const header = [
      '[BraveFox local conversation continuity]',
      `Previous chat: ${conversation.title || 'Untitled Chat'}`,
      `Checkpoint: ${snapshot?.name || 'Latest archived state'}`,
      `Archived messages available locally: ${branch.length}`,
      '',
      'The text below is prior conversation context. It may be an excerpt of a much larger local archive.',
      'Treat it as established conversation history. If I ask about older omitted details, ask me to retrieve them from the BraveFox archive rather than inventing them.',
      '',
      '[BEGIN PREVIOUS CHAT EXCERPT]'
    ].join('\n');
    const footer = '\n[END PREVIOUS CHAT EXCERPT]\n\nContinue from this prior chat context.';
    const budget = Math.max(8000, CHAT_ARCHIVE_CONTINUATION_MAX_CHARS - header.length - footer.length);

    const formatMessage = message => {
      const label = message.role === 'user' ? 'USER' : 'ASSISTANT';
      const meta = message.role === 'assistant' && message.modelSlug
        ? ` [${message.modelSlug}${message.reasoningEffort ? ` / ${message.reasoningEffort}` : ''}]`
        : '';
      return `\n\n${label}${meta}:\n${String(message.plainText || '').trim()}`;
    };

    const first = branch.slice(0, Math.min(4, branch.length));
    const selected = [...first];
    const selectedIds = new Set(selected.map(message => message.id));
    let used = first.reduce((sum, message) => sum + formatMessage(message).length, 0);

    for (let index = branch.length - 1; index >= 0; index -= 1) {
      const message = branch[index];
      if (selectedIds.has(message.id)) continue;
      const rendered = formatMessage(message);
      if (used + rendered.length > budget && selected.length > first.length) break;
      if (rendered.length > budget) continue;
      selected.push(message);
      selectedIds.add(message.id);
      used += rendered.length;
    }
    selected.sort((a, b) => branch.indexOf(a) - branch.indexOf(b));

    const omitted = Math.max(0, branch.length - selected.length);
    const omissionNote = omitted
      ? `\n\n[${omitted} older messages are retained in the local BraveFox archive but omitted from this initial context packet.]`
      : '';
    return header + selected.map(formatMessage).join('') + omissionNote + footer;
  }

  function writeArchiveHandoff(payload) {
    try {
      localStorage.setItem(CHAT_ARCHIVE_HANDOFF_KEY, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function readArchiveHandoff() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CHAT_ARCHIVE_HANDOFF_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      if (Date.now() - Number(parsed.createdAt || 0) > CHAT_ARCHIVE_HANDOFF_MAX_AGE_MS) {
        localStorage.removeItem(CHAT_ARCHIVE_HANDOFF_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function findConversationComposerEditable() {
    const selectors = [
      '#prompt-textarea',
      'form textarea',
      'form [contenteditable="true"][role="textbox"]',
      'form [contenteditable="true"]',
      '[data-testid*="composer" i] [contenteditable="true"]'
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLTextAreaElement || (element instanceof HTMLElement && element.isContentEditable)) return element;
    }
    return null;
  }

  function appendTextToConversationComposer(text) {
    const value = String(text || '').trim();
    if (!value) return false;
    const editable = findConversationComposerEditable();
    if (!editable) return false;

    editable.focus();
    if (editable instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      const existing = editable.value || '';
      descriptor?.set?.call(editable, existing ? `${existing}\n\n${value}` : value);
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      editable.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      const prefix = String(editable.textContent || '').trim() ? '\n\n' : '';
      if (document.execCommand?.('insertText', false, prefix + value)) {
        editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prefix + value }));
        return true;
      }
    } catch {}

    const existing = String(editable.textContent || '');
    editable.textContent = existing ? `${existing}\n\n${value}` : value;
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    return true;
  }

  function persistArchiveContextLink(newConversationId, sourceConversationId, snapshotId = '') {
    const target = String(newConversationId || '').trim();
    const source = String(sourceConversationId || '').trim();
    if (!target || !source) return;
    try {
      const parsed = JSON.parse(localStorage.getItem(CHAT_ARCHIVE_CONTEXT_LINK_KEY) || '{}');
      const store = parsed && typeof parsed === 'object' ? parsed : {};
      store[target] = { sourceConversationId: source, snapshotId: String(snapshotId || ''), linkedAt: Date.now() };
      const entries = Object.entries(store).sort((a, b) => Number(b[1]?.linkedAt || 0) - Number(a[1]?.linkedAt || 0));
      localStorage.setItem(CHAT_ARCHIVE_CONTEXT_LINK_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, 20))));
    } catch {}
  }

  function getArchiveContextLink(conversationId = getCurrentConversationId()) {
    const id = String(conversationId || '').trim();
    if (!id) return null;
    try {
      const store = JSON.parse(localStorage.getItem(CHAT_ARCHIVE_CONTEXT_LINK_KEY) || '{}');
      return store && typeof store === 'object' ? store[id] || null : null;
    } catch {
      return null;
    }
  }

  async function beginConversationArchiveContinuation(conversationId, snapshotId = '') {
    const [conversation, messages, snapshots] = await Promise.all([
      getArchivedConversation(conversationId),
      getArchivedMessages(conversationId),
      getArchivedSnapshots(conversationId)
    ]);
    if (!conversation) return false;
    const snapshot = snapshotId ? snapshots.find(item => item.id === snapshotId) || null : null;
    const contextText = buildArchiveContinuationText(conversation, messages, snapshot);
    if (!contextText) return false;
    const handoffId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (!writeArchiveHandoff({
      id: handoffId,
      createdAt: Date.now(),
      sourceConversationId: conversationId,
      snapshotId: String(snapshot?.id || ''),
      contextText
    })) return false;

    window.open(`${location.origin}/`, '_blank', 'noopener');
    return true;
  }

  function consumeConversationArchiveHandoffIfReady() {
    if (getCurrentConversationId()) return false;
    const handoff = readArchiveHandoff();
    if (!handoff || handoff.id === conversationArchiveLastHandoffId) return false;
    const editable = findConversationComposerEditable();
    if (!editable) return false;
    if (!appendTextToConversationComposer(handoff.contextText)) return false;

    conversationArchiveLastHandoffId = handoff.id;
    try { localStorage.removeItem(CHAT_ARCHIVE_HANDOFF_KEY); } catch {}
    try {
      sessionStorage.setItem('bravefoxChatArchivePendingLink_v1', JSON.stringify({
        sourceConversationId: handoff.sourceConversationId,
        snapshotId: handoff.snapshotId,
        linkedAt: Date.now()
      }));
    } catch {}
    ensureConversationArchiveButton();
    return true;
  }

  function linkPendingArchiveContextToCurrentConversation() {
    const conversationId = getCurrentConversationId();
    if (!conversationId) return;
    try {
      const pending = JSON.parse(sessionStorage.getItem('bravefoxChatArchivePendingLink_v1') || 'null');
      if (!pending?.sourceConversationId) return;
      persistArchiveContextLink(conversationId, pending.sourceConversationId, pending.snapshotId || '');
      sessionStorage.removeItem('bravefoxChatArchivePendingLink_v1');
    } catch {}
  }

  function ensureConversationArchiveStyles() {
    if (document.getElementById(CHAT_ARCHIVE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CHAT_ARCHIVE_STYLE_ID;
    style.textContent = `
      /* Replace the stock Share/Jaa toolbar action with the local Archive action. */
      button.button-toolbar[aria-label="Jaa"],
      button.button-toolbar[aria-label="Share"],
      button[${CHAT_ARCHIVE_SHARE_HIDDEN_ATTR}="true"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      button[${CHAT_ARCHIVE_TOOLBAR_BUTTON_ATTR}="true"] {
        display: inline-flex !important;
        visibility: visible !important;
        pointer-events: auto !important;
        opacity: 1 !important;
        cursor: pointer !important;
      }
      button[${CHAT_ARCHIVE_TOOLBAR_BUTTON_ATTR}="true"] svg { flex: none !important; }

      /* Library > New is paint-gated while BraveFox keeps only Folder, Archive and Upload. */
      html.${CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS} [role="menu"][data-radix-menu-content][data-state="open"],
      html.${CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS} [role="menu"][data-state="open"],
      html.${CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS} [data-radix-menu-content][data-state="open"] {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      [${CHAT_ARCHIVE_LIBRARY_MENU_ROOT_ATTR}="curating"] {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      [${CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR}="true"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      [${CHAT_ARCHIVE_LIBRARY_MENU_ITEM_ATTR}="true"] { cursor: pointer !important; }
      [${CHAT_ARCHIVE_LIBRARY_MENU_DIVIDER_ATTR}="true"] {
        height: 1px !important;
        margin: 5px 0 !important;
        background: var(--border-light, rgba(127,127,127,.22)) !important;
      }

      #${CHAT_ARCHIVE_BUTTON_ID} {
        color: inherit !important;
        text-decoration: none !important;
        cursor: pointer !important;
      }
      #${CHAT_ARCHIVE_BUTTON_ID} svg { flex: none !important; }
      #${CHAT_ARCHIVE_MODAL_ID} {
        position: fixed !important; inset: 0 !important; z-index: 2147483600 !important;
        background: rgba(0,0,0,.46) !important; display: flex !important; align-items: center !important; justify-content: center !important;
        padding: 24px !important; box-sizing: border-box !important;
      }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-panel {
        width: min(1120px, 96vw) !important; height: min(760px, 92vh) !important;
        background: var(--main-surface-primary, #fff) !important; color: var(--text-primary, #171717) !important;
        border: 1px solid var(--border-light, rgba(127,127,127,.30)) !important; border-radius: 16px !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.28) !important; display: grid !important;
        grid-template-rows: auto 1fr !important; overflow: hidden !important;
      }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-header { display:flex !important; align-items:center !important; gap:12px !important; padding:14px 16px !important; border-bottom:1px solid var(--border-light,rgba(127,127,127,.22)) !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-header strong { font-size:16px !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-close { margin-left:auto !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-body { display:grid !important; grid-template-columns:minmax(250px,34%) 1fr !important; min-height:0 !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-list { border-right:1px solid var(--border-light,rgba(127,127,127,.22)) !important; overflow:auto !important; padding:10px !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-detail { overflow:auto !important; padding:16px !important; }
      #${CHAT_ARCHIVE_MODAL_ID} button, #${CHAT_ARCHIVE_MODAL_ID} select, #${CHAT_ARCHIVE_MODAL_ID} input {
        font: inherit !important; color: inherit !important; border:1px solid var(--border-light,rgba(127,127,127,.30)) !important;
        background: var(--main-surface-secondary,rgba(127,127,127,.08)) !important; border-radius:8px !important; padding:7px 9px !important;
      }
      #${CHAT_ARCHIVE_MODAL_ID} button { cursor:pointer !important; }
      #${CHAT_ARCHIVE_MODAL_ID} button:hover { background: var(--main-surface-tertiary,rgba(127,127,127,.15)) !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-chat { width:100% !important; text-align:left !important; margin-bottom:6px !important; display:block !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-chat[data-selected="true"] { outline:2px solid rgba(80,130,230,.65) !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-muted { opacity:.68 !important; font-size:12px !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-actions { display:flex !important; flex-wrap:wrap !important; gap:8px !important; margin:12px 0 !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-search { width:100% !important; box-sizing:border-box !important; margin:10px 0 !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-result { border-top:1px solid var(--border-light,rgba(127,127,127,.18)) !important; padding:10px 0 !important; }
      #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-result pre { white-space:pre-wrap !important; font:inherit !important; font-size:12px !important; margin:6px 0 !important; max-height:130px !important; overflow:hidden !important; }
      @media (max-width: 760px) {
        #${CHAT_ARCHIVE_MODAL_ID} { padding:8px !important; }
        #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-panel { width:100% !important; height:96vh !important; }
        #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-body { grid-template-columns:1fr !important; grid-template-rows:34% 1fr !important; }
        #${CHAT_ARCHIVE_MODAL_ID} .bf-archive-list { border-right:0 !important; border-bottom:1px solid var(--border-light,rgba(127,127,127,.22)) !important; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function makeConversationArchiveChatIcon(size = 16) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');

    const bubble = document.createElementNS(svgNs, 'path');
    bubble.setAttribute('d', 'M5.5 4.75h10.25A2.25 2.25 0 0 1 18 7v4.25a2.25 2.25 0 0 1-2.25 2.25H10l-3.75 2.75.8-2.75H5.5A2.25 2.25 0 0 1 3.25 11.25V7A2.25 2.25 0 0 1 5.5 4.75Z');
    const dots = document.createElementNS(svgNs, 'path');
    dots.setAttribute('d', 'M7.25 9.1h.01M10.6 9.1h.01M13.95 9.1h.01');
    const tray = document.createElementNS(svgNs, 'path');
    tray.setAttribute('d', 'M9 17.25h9.25A1.75 1.75 0 0 0 20 15.5v-1.25M10.75 20h6.75A2.5 2.5 0 0 0 20 17.5');
    svg.append(bubble, dots, tray);
    return svg;
  }

  function getConversationArchiveNativeShareButton() {
    if (!getCurrentConversationId()) return null;
    for (const button of document.querySelectorAll('button[aria-label], button.button-toolbar')) {
      if (!(button instanceof HTMLButtonElement)) continue;
      if (button.hasAttribute(CHAT_ARCHIVE_TOOLBAR_BUTTON_ATTR)) continue;
      const label = normalizeText(
        button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || ''
      );
      if (!['jaa', 'share', 'share chat'].includes(label)) continue;
      if (button.closest('[data-message-author-role], [data-turn], article[data-turn], section[data-turn]')) continue;
      return button;
    }
    return null;
  }

  function makeConversationArchiveToolbarButton(nativeShare) {
    if (!(nativeShare instanceof HTMLButtonElement)) return null;
    const button = nativeShare.cloneNode(true);
    if (!(button instanceof HTMLButtonElement)) return null;

    button.removeAttribute('id');
    button.removeAttribute('data-state');
    button.removeAttribute('aria-expanded');
    button.removeAttribute('aria-haspopup');

    // Archive is a BraveFox action, not Share. Never inherit ChatGPT's transient
    // disabled state (Share is often disabled while a response is generating).
    button.disabled = false;
    button.removeAttribute('disabled');
    button.removeAttribute('aria-disabled');
    button.removeAttribute('data-disabled');
    button.removeAttribute('inert');
    button.tabIndex = 0;

    button.setAttribute(CHAT_ARCHIVE_TOOLBAR_BUTTON_ATTR, 'true');
    button.setAttribute('aria-label', 'Arkisto');
    button.title = 'Keskusteluarkisto';
    button.type = 'button';
    button.replaceChildren(makeConversationArchiveChatIcon(16), document.createTextNode('Arkisto'));
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      void openConversationArchiveModal();
    });
    return button;
  }

  function ensureConversationArchiveToolbarButton() {
    const existing = document.querySelector(`button[${CHAT_ARCHIVE_TOOLBAR_BUTTON_ATTR}="true"]`);

    if (!getCurrentConversationId()) {
      existing?.remove();
      for (const share of document.querySelectorAll(`button[${CHAT_ARCHIVE_SHARE_HIDDEN_ATTR}="true"]`)) {
        share.removeAttribute(CHAT_ARCHIVE_SHARE_HIDDEN_ATTR);
      }
      return;
    }

    const nativeShare = getConversationArchiveNativeShareButton();
    if (!(nativeShare instanceof HTMLButtonElement) || !nativeShare.parentElement) {
      existing?.remove();
      return;
    }

    nativeShare.setAttribute(CHAT_ARCHIVE_SHARE_HIDDEN_ATTR, 'true');
    if (existing?.isConnected) {
      // A clone created while Share was temporarily disabled must not stay disabled forever.
      existing.disabled = false;
      existing.removeAttribute('disabled');
      existing.removeAttribute('aria-disabled');
      existing.removeAttribute('data-disabled');
      existing.removeAttribute('inert');
      existing.tabIndex = 0;
      if (nativeShare.nextElementSibling !== existing) nativeShare.after(existing);
      return;
    }

    const archiveButton = makeConversationArchiveToolbarButton(nativeShare);
    if (archiveButton) nativeShare.after(archiveButton);
  }

  function ensureConversationArchiveButton() {
    // Retire the brittle custom sidebar row. Archive access now has two stable homes:
    // the in-chat toolbar (replacing Share) and Library > New.
    document.getElementById(CHAT_ARCHIVE_BUTTON_ID)?.remove();
    ensureConversationArchiveToolbarButton();
  }

  function isConversationArchiveLibraryNewTrigger(target) {
    if (!isChatGptLibraryLocation() || !(target instanceof Element)) return false;
    const control = target.closest('button[aria-haspopup="menu"], button, [role="button"]');
    if (!(control instanceof Element)) return false;

    const label = normalizeText(
      control.getAttribute('aria-label') ||
      control.getAttribute('title') ||
      control.querySelector(':scope > span')?.textContent ||
      control.textContent ||
      ''
    );
    if (!['uusi', 'new', 'create new'].includes(label)) return false;

    // The Library's New button is a Radix menu trigger. Prefer this exact native shape,
    // while keeping the structural fallback for localized/older ChatGPT builds.
    if (control.matches('button[aria-haspopup="menu"]')) return true;
    const main = control.closest('main, [role="main"]');
    return Boolean(main || !control.closest('nav, aside, [data-testid*="sidebar"]'));
  }

  function getConversationArchiveLibraryNewTrigger() {
    if (!isChatGptLibraryLocation()) return null;
    for (const control of document.querySelectorAll('button[aria-haspopup="menu"], button, [role="button"]')) {
      if (isConversationArchiveLibraryNewTrigger(control)) return control;
    }
    return null;
  }

  function isConversationArchiveLibraryFolderText(value) {
    return ['kansio', 'folder', 'uusi kansio', 'new folder'].includes(normalizeText(value));
  }

  function isConversationArchiveLibraryDocumentText(value) {
    return ['asiakirja', 'document', 'new document', 'uusi asiakirja'].includes(normalizeText(value));
  }

  function isConversationArchiveLibraryUploadText(value) {
    const text = normalizeText(value);
    return (
      text.includes('lataa tiedostoja palvelimeen') ||
      text.includes('upload files') ||
      text.includes('upload from computer') ||
      text.includes('upload from device')
    );
  }

  function getConversationArchiveLibraryCommonAncestor(first, second) {
    if (!(first instanceof Element) || !(second instanceof Element)) return null;
    const ancestors = new Set();
    let node = first;
    for (let depth = 0; node && depth < 14; depth += 1, node = node.parentElement) {
      ancestors.add(node);
    }
    node = second;
    for (let depth = 0; node && depth < 14; depth += 1, node = node.parentElement) {
      if (ancestors.has(node)) return node;
    }
    return null;
  }

  function getConversationArchiveLibraryNewMenu() {
    if (!isChatGptLibraryLocation()) return null;

    // Exact 2026 Library shape: Uusi is the Radix trigger and the portal menu points back
    // to that button through aria-labelledby. This relationship is much more stable than
    // generated class names or portal coordinates.
    const trigger = getConversationArchiveLibraryNewTrigger();
    const triggerId = String(trigger?.id || '').trim();
    if (triggerId) {
      for (const menu of document.querySelectorAll(
        '[role="menu"][data-radix-menu-content][data-state="open"], [role="menu"][data-state="open"]'
      )) {
        if (!(menu instanceof Element) || !menu.isConnected) continue;
        if (String(menu.getAttribute('aria-labelledby') || '').trim() !== triggerId) continue;
        return menu;
      }
    }

    // Fallback: accept only an OPEN menu that contains the two native rows we keep.
    // Do not accidentally curate account/model/other Radix menus elsewhere on the page.
    const candidates = Array.from(document.querySelectorAll(
      '[role="menu"][data-state="open"], [data-radix-menu-content][data-state="open"]'
    ));
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const menu = candidates[index];
      if (!(menu instanceof Element) || !menu.isConnected) continue;
      const text = normalizeText(menu.textContent);
      if (isConversationArchiveLibraryUploadText(text) && /(^|\s)(kansio|folder)(\s|$)/.test(text)) {
        return menu;
      }
    }

    // Older/stripped Library builds: anchor on Folder + Upload and derive their nearest
    // common popup container. Keep this as a last resort only.
    const textElements = Array.from(document.querySelectorAll(
      'button, a, [role="menuitem"], [role="option"], [role="button"], div, span, p'
    ));
    const folderElements = [];
    const uploadElements = [];
    for (const element of textElements) {
      if (!(element instanceof Element) || !element.isConnected) continue;
      const text = normalizeText(
        element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || ''
      );
      if (isConversationArchiveLibraryFolderText(text)) folderElements.push(element);
      if (isConversationArchiveLibraryUploadText(text)) uploadElements.push(element);
    }

    let best = null;
    let bestLength = Number.POSITIVE_INFINITY;
    for (const folder of folderElements) {
      for (const upload of uploadElements) {
        const common = getConversationArchiveLibraryCommonAncestor(folder, upload);
        if (!(common instanceof Element)) continue;
        if (common === document.documentElement || common === document.body) continue;
        if (common.matches('main, [role="main"], nav, aside')) continue;
        const text = normalizeText(common.textContent);
        if (!isConversationArchiveLibraryUploadText(text)) continue;
        if (!/(^|\s)(kansio|folder)(\s|$)/.test(text)) continue;
        if (text.length < bestLength) {
          best = common;
          bestLength = text.length;
        }
      }
    }
    return best;
  }

  function getConversationArchiveLibraryMenuItems(menu) {
    if (!(menu instanceof Element)) return [];

    // Current Library menu: rows are direct Radix collection items. Restricting to direct
    // children prevents the icon/text descendants from being mistaken for separate items.
    const direct = Array.from(menu.children).filter(child =>
      child instanceof Element &&
      child.matches('[role="menuitem"][data-radix-collection-item], [role="menuitem"], [role="option"]')
    );
    if (direct.length) return direct;

    let items = Array.from(menu.querySelectorAll(
      '[role="menuitem"], [role="option"], button, a[href], [tabindex="0"], [tabindex="-1"]'
    ));
    items = items.filter(item => {
      if (!(item instanceof Element)) return false;
      const owner = item.closest('[role="menuitem"], [role="option"], button, a[href]');
      return owner === item;
    });
    return Array.from(new Set(items));
  }

  function getConversationArchiveLibraryItemKind(item) {
    if (!(item instanceof Element)) return '';
    const text = normalizeText(
      item.getAttribute('aria-label') || item.getAttribute('title') || item.textContent || ''
    );
    if (isConversationArchiveLibraryFolderText(text)) return 'folder';
    if (isConversationArchiveLibraryDocumentText(text)) return 'document';
    if (isConversationArchiveLibraryUploadText(text)) return 'upload';
    return '';
  }

  function rewriteConversationArchiveLibraryMenuLabel(item) {
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = normalizeText(node.nodeValue);
      if ([
        'kansio', 'folder', 'uusi kansio', 'new folder',
        'asiakirja', 'document', 'new document', 'uusi asiakirja'
      ].includes(value)) {
        node.nodeValue = 'Arkisto';
        return true;
      }
      node = walker.nextNode();
    }
    return false;
  }

  function makeConversationArchiveLibraryMenuItem(folderItem, documentItem = null) {
    // Prefer Asiakirja as the donor. Its native terms-light-20 icon is intentionally kept
    // for Arkisto; it already reads as a compact records/document archive glyph and keeps
    // the menu visually 100% native. Fall back to Folder only on older Library builds.
    const donor = documentItem instanceof Element ? documentItem : folderItem;
    if (!(donor instanceof Element)) return null;
    const item = donor.cloneNode(true);
    if (!(item instanceof Element)) return null;

    item.removeAttribute('id');
    for (const child of item.querySelectorAll('[id]')) child.removeAttribute('id');
    item.removeAttribute('data-state');
    item.removeAttribute('aria-expanded');
    item.removeAttribute('aria-haspopup');
    item.removeAttribute('href');
    item.removeAttribute(CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR);
    item.setAttribute(CHAT_ARCHIVE_LIBRARY_MENU_ITEM_ATTR, 'true');
    item.setAttribute('aria-label', 'Arkisto');
    item.setAttribute('title', 'Keskusteluarkisto');
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '-1');
    if (item instanceof HTMLButtonElement) item.type = 'button';

    rewriteConversationArchiveLibraryMenuLabel(item);

    // If Asiakirja was unavailable, still use the same native sprite fragment rather than
    // a hand-drawn icon. Preserve ChatGPT's live asset bundle path and swap only the id.
    if (!(documentItem instanceof Element)) {
      const use = item.querySelector('svg use[href]');
      if (use) {
        const href = String(use.getAttribute('href') || '');
        const base = href.includes('#') ? href.slice(0, href.indexOf('#')) : href;
        use.setAttribute('href', `${base}#terms-light-20`);
      }
    }

    item.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      // Close the real Radix menu through its own trigger before opening the archive modal.
      const menu = item.closest('[role="menu"]');
      const labelledBy = String(menu?.getAttribute('aria-labelledby') || '').trim();
      const trigger = labelledBy ? document.getElementById(labelledBy) : null;
      if (trigger instanceof HTMLElement) {
        try { trigger.click(); } catch {}
      }

      document.documentElement.classList.remove(CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS);
      void openConversationArchiveModal();
    });
    return item;
  }

  function reconcileConversationArchiveLibraryNewMenu() {
    const menu = getConversationArchiveLibraryNewMenu();
    if (!(menu instanceof Element)) return false;
    menu.setAttribute(CHAT_ARCHIVE_LIBRARY_MENU_ROOT_ATTR, 'curating');

    const items = getConversationArchiveLibraryMenuItems(menu);
    let folderItem = null;
    let documentItem = null;
    let uploadItem = null;
    for (const item of items) {
      if (item.hasAttribute(CHAT_ARCHIVE_LIBRARY_MENU_ITEM_ATTR)) continue;
      const kind = getConversationArchiveLibraryItemKind(item);
      if (kind === 'folder' && !folderItem) folderItem = item;
      if (kind === 'document' && !documentItem) documentItem = item;
      if (kind === 'upload' && !uploadItem) uploadItem = item;
    }

    if (!(folderItem instanceof Element) || !(uploadItem instanceof Element)) {
      menu.removeAttribute(CHAT_ARCHIVE_LIBRARY_MENU_ROOT_ATTR);
      return false;
    }

    // Hide every native menu item except the two explicitly kept by the concept.
    for (const item of items) {
      if (item === folderItem || item === uploadItem || item.hasAttribute(CHAT_ARCHIVE_LIBRARY_MENU_ITEM_ATTR)) {
        item.removeAttribute(CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR);
      } else {
        item.setAttribute(CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR, 'true');
      }
    }

    let archiveItem = menu.querySelector(`[${CHAT_ARCHIVE_LIBRARY_MENU_ITEM_ATTR}="true"]`);
    if (!(archiveItem instanceof Element)) {
      archiveItem = makeConversationArchiveLibraryMenuItem(folderItem, documentItem);
      if (archiveItem) folderItem.after(archiveItem);
    } else if (folderItem.nextElementSibling !== archiveItem) {
      folderItem.after(archiveItem);
    }

    // Use ChatGPT's own separator already present before Upload. Hide only extra separators.
    const directChildren = Array.from(menu.children);
    const separators = directChildren.filter(child =>
      child instanceof Element &&
      (
        child.matches('[role="separator"]') ||
        Boolean(child.querySelector(':scope > .h-px.w-full.bg-border, :scope > .h-px[class*="bg-border"]'))
      )
    );
    let keptSeparator = null;
    for (const separator of separators) {
      const beforeUpload = separator.compareDocumentPosition(uploadItem) & Node.DOCUMENT_POSITION_FOLLOWING;
      if (!keptSeparator && beforeUpload) {
        keptSeparator = separator;
        separator.removeAttribute(CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR);
      } else {
        separator.setAttribute(CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR, 'true');
      }
    }

    // Remove the synthetic divider from older BraveFox builds if this tab upgraded live.
    for (const oldDivider of menu.querySelectorAll(`[${CHAT_ARCHIVE_LIBRARY_MENU_DIVIDER_ATTR}="true"]`)) {
      oldDivider.remove();
    }

    // Hide any other direct child that is neither the section label, our kept rows, nor the
    // one native separator. This catches plugin-source footers and future non-item wrappers.
    for (const child of Array.from(menu.children)) {
      if (!(child instanceof Element)) continue;
      if (child === folderItem || child === archiveItem || child === uploadItem || child === keptSeparator) continue;
      if (child.matches('[data-menu-section-label="true"]')) {
        child.removeAttribute(CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR);
        continue;
      }
      if (items.includes(child)) continue; // already classified above
      child.setAttribute(CHAT_ARCHIVE_LIBRARY_MENU_HIDDEN_ATTR, 'true');
    }

    menu.setAttribute(CHAT_ARCHIVE_LIBRARY_MENU_ROOT_ATTR, 'ready');
    document.documentElement.classList.remove(CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS);
    return true;
  }

  function armConversationArchiveLibraryNewMenu() {
    if (!isChatGptLibraryLocation()) return;
    document.documentElement.classList.add(CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS);
    if (conversationArchiveLibraryMenuTimer) clearTimeout(conversationArchiveLibraryMenuTimer);

    const startedAt = Date.now();
    const poll = () => {
      conversationArchiveLibraryMenuTimer = 0;
      if (reconcileConversationArchiveLibraryNewMenu()) return;
      if (Date.now() - startedAt < 1200) {
        conversationArchiveLibraryMenuTimer = window.setTimeout(poll, 16);
        return;
      }
      document.documentElement.classList.remove(CHAT_ARCHIVE_LIBRARY_MENU_CURATING_CLASS);
    };
    conversationArchiveLibraryMenuTimer = window.setTimeout(poll, 0);
  }

  function handleConversationArchivePointerDown(event) {
    if (isConversationArchiveLibraryNewTrigger(event.target)) armConversationArchiveLibraryNewMenu();
  }

  function handleConversationArchiveLibraryKeyDown(event) {
    if (!['Enter', ' '].includes(event.key)) return;
    if (isConversationArchiveLibraryNewTrigger(event.target)) armConversationArchiveLibraryNewMenu();
  }

  function closeConversationArchiveModal() {
    document.getElementById(CHAT_ARCHIVE_MODAL_ID)?.remove();
  }

  function scheduleConversationArchiveModalRefresh(delay = 80) {
    if (conversationArchiveUiRefreshTimer) clearTimeout(conversationArchiveUiRefreshTimer);
    conversationArchiveUiRefreshTimer = window.setTimeout(() => {
      conversationArchiveUiRefreshTimer = 0;
      if (document.getElementById(CHAT_ARCHIVE_MODAL_ID)) void renderConversationArchiveModal();
    }, delay);
  }

  function archiveSearchScore(text, query) {
    const haystack = normalizeText(text);
    const tokens = normalizeText(query).split(' ').filter(token => token.length >= 2);
    if (!tokens.length || !haystack) return 0;
    let score = 0;
    for (const token of tokens) {
      let index = 0;
      let matches = 0;
      while ((index = haystack.indexOf(token, index)) >= 0 && matches < 20) {
        matches += 1;
        score += token.length + 2;
        index += token.length;
      }
      if (!matches) return 0;
    }
    return score;
  }

  async function searchConversationArchive(conversationId, query) {
    const messages = getArchivedCurrentBranch(await getArchivedMessages(conversationId));
    return messages
      .map((message, index) => ({ message, index, score: archiveSearchScore(message.plainText, query) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.index - a.index)
      .slice(0, 20);
  }

  function buildArchiveSearchExcerpt(message, max = 650) {
    const text = String(message?.plainText || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  async function renderConversationArchiveModal() {
    const modal = document.getElementById(CHAT_ARCHIVE_MODAL_ID);
    if (!modal) return;
    const listHost = modal.querySelector('[data-bf-archive-list]');
    const detailHost = modal.querySelector('[data-bf-archive-detail]');
    if (!(listHost instanceof HTMLElement) || !(detailHost instanceof HTMLElement)) return;

    const conversations = await getArchivedConversations().catch(() => []);
    const currentId = getCurrentConversationId();
    if (!conversationArchiveSelectedConversationId || !conversations.some(item => item.id === conversationArchiveSelectedConversationId)) {
      conversationArchiveSelectedConversationId = conversations.some(item => item.id === currentId)
        ? currentId
        : conversations[0]?.id || '';
    }

    listHost.replaceChildren();
    if (!conversations.length) {
      const empty = document.createElement('div');
      empty.className = 'bf-archive-muted';
      empty.textContent = currentId
        ? 'This chat has not finished its first archive sync yet. Leave this panel open for a moment.'
        : 'No locally archived chats yet.';
      listHost.appendChild(empty);
    }

    for (const conversation of conversations) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bf-archive-chat';
      button.dataset.selected = String(conversation.id === conversationArchiveSelectedConversationId);
      const title = document.createElement('div');
      title.textContent = conversation.title || 'Untitled Chat';
      title.style.fontWeight = '650';
      const meta = document.createElement('div');
      meta.className = 'bf-archive-muted';
      meta.textContent = `${Number(conversation.messageCount || 0)} messages · ${formatArchiveDateTime(conversation.updatedAt)}`;
      button.append(title, meta);
      button.addEventListener('click', () => {
        conversationArchiveSelectedConversationId = conversation.id;
        void renderConversationArchiveModal();
      });
      listHost.appendChild(button);
    }

    detailHost.replaceChildren();
    const selected = conversations.find(item => item.id === conversationArchiveSelectedConversationId);
    if (!selected) return;
    const snapshots = await getArchivedSnapshots(selected.id).catch(() => []);

    const heading = document.createElement('h2');
    heading.textContent = selected.title || 'Untitled Chat';
    heading.style.margin = '0 0 4px';
    const meta = document.createElement('div');
    meta.className = 'bf-archive-muted';
    meta.textContent = `${selected.messageCount || 0} messages · ${snapshots.length} checkpoints · last saved ${formatArchiveDateTime(selected.archivedAt)}`;

    const snapshotSelect = document.createElement('select');
    snapshotSelect.setAttribute('data-bf-archive-snapshot-select', 'true');
    const latestOption = document.createElement('option');
    latestOption.value = '';
    latestOption.textContent = 'Latest archived state';
    snapshotSelect.appendChild(latestOption);
    for (const snapshot of snapshots) {
      const option = document.createElement('option');
      option.value = snapshot.id;
      option.textContent = `${snapshot.name} · ${snapshot.messageCount} msgs · ${formatArchiveDateTime(snapshot.createdAt)}`;
      snapshotSelect.appendChild(option);
    }

    const actions = document.createElement('div');
    actions.className = 'bf-archive-actions';
    const actionButton = (label, handler) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', handler);
      actions.appendChild(button);
      return button;
    };
    actionButton('Snapshot', async () => {
      const suggested = `Manual · ${formatArchiveDateTime(Date.now())}`;
      const name = window.prompt('Name this full-history checkpoint:', suggested);
      if (name === null) return;
      if (selected.id === getCurrentConversationId()) {
        await archiveVisibleConversationTail().catch(() => {});
        await fetchConversationMessageMetadataIndex(selected.id, true).catch(() => null);
        const activeSync = conversationArchivePayloadSyncs.get(selected.id);
        if (activeSync) await activeSync.catch(() => false);
      }
      await createConversationArchiveSnapshot(selected.id, name, 'manual');
      await renderConversationArchiveModal();
    });
    const deleteSnapshotButton = actionButton('Delete snapshot', async () => {
      const snapshotId = String(snapshotSelect.value || '').trim();
      if (!snapshotId) return;
      const snapshot = snapshots.find(item => String(item?.id || '') === snapshotId);
      const snapshotName = String(snapshot?.name || 'this snapshot');
      if (!window.confirm(`Delete snapshot “${snapshotName}”?\n\nOnly this checkpoint will be removed. The archived conversation and its messages stay intact.`)) return;
      deleteSnapshotButton.disabled = true;
      try {
        await deleteConversationArchiveSnapshot(selected.id, snapshotId);
        await renderConversationArchiveModal();
      } catch (error) {
        console.error('BraveFox snapshot deletion failed', error);
        window.alert(String(error?.message || error || 'Could not delete the snapshot.'));
        if (deleteSnapshotButton.isConnected) deleteSnapshotButton.disabled = !snapshotSelect.value;
      }
    });
    deleteSnapshotButton.disabled = !snapshotSelect.value;
    snapshotSelect.addEventListener('change', () => {
      if (deleteSnapshotButton.isConnected) deleteSnapshotButton.disabled = !snapshotSelect.value;
    });
    const deleteArchiveButton = actionButton('Delete archive', async () => {
      const archiveTitle = String(selected.title || 'Untitled Chat');
      if (!window.confirm(
        `Delete the entire local archive for “${archiveTitle}”?\n\nThis removes its locally stored messages and every snapshot/checkpoint. It does NOT delete the original ChatGPT conversation.`
      )) return;
      deleteArchiveButton.disabled = true;
      try {
        await deleteConversationArchive(selected.id);
        if (conversationArchiveSelectedConversationId === selected.id) conversationArchiveSelectedConversationId = '';
        await renderConversationArchiveModal();
      } catch (error) {
        console.error('BraveFox archive deletion failed', error);
        window.alert(String(error?.message || error || 'Could not delete the local archive.'));
        if (deleteArchiveButton.isConnected) deleteArchiveButton.disabled = false;
      }
    });
    actionButton('Continue in new chat', async () => {
      await beginConversationArchiveContinuation(selected.id, snapshotSelect.value);
    });
    const exportHtmlButton = actionButton('Export HTML', async () => {
      const oldLabel = exportHtmlButton.textContent;
      exportHtmlButton.disabled = true;
      exportHtmlButton.textContent = 'Embedding images…';
      try {
        await exportConversationArchiveHtml(selected.id, snapshotSelect.value, progress => {
          if (!exportHtmlButton.isConnected) return;
          const total = Number(progress?.total || 0) || 0;
          const completed = Number(progress?.completed || 0) || 0;
          exportHtmlButton.textContent = total
            ? `Embedding images ${completed}/${total}…`
            : 'Building HTML…';
        });
      } catch (error) {
        console.error('BraveFox HTML archive export failed', error);
        window.alert(String(error?.message || error || 'HTML export failed.'));
      } finally {
        if (exportHtmlButton.isConnected) {
          exportHtmlButton.disabled = false;
          exportHtmlButton.textContent = oldLabel;
        }
      }
    });
    actionButton('Export Markdown', () => void exportConversationArchiveMarkdown(selected.id, snapshotSelect.value));
    actionButton('Export JSON', () => void exportConversationArchiveJson(selected.id));
    actionButton('Open original', () => window.open(`${location.origin}/c/${encodeURIComponent(selected.id)}`, '_blank', 'noopener'));

    const searchLabel = document.createElement('div');
    searchLabel.style.marginTop = '18px';
    searchLabel.style.fontWeight = '650';
    searchLabel.textContent = 'Search this full local archive';
    const searchInput = document.createElement('input');
    searchInput.className = 'bf-archive-search';
    searchInput.type = 'search';
    searchInput.placeholder = 'e.g. weapon table crash, script name, offset…';
    const results = document.createElement('div');
    results.setAttribute('data-bf-archive-results', 'true');

    let searchTimer = 0;
    const runSearch = async () => {
      const query = searchInput.value.trim();
      results.replaceChildren();
      if (query.length < 2) return;
      const matches = await searchConversationArchive(selected.id, query);
      if (!matches.length) {
        const none = document.createElement('div');
        none.className = 'bf-archive-muted';
        none.textContent = 'No matching archived messages.';
        results.appendChild(none);
        return;
      }
      for (const { message } of matches) {
        const row = document.createElement('div');
        row.className = 'bf-archive-result';
        const label = document.createElement('strong');
        label.textContent = `${message.role === 'user' ? 'You' : 'ChatGPT'} · ${formatArchiveDateTime(message.createTime)}`;
        const excerpt = document.createElement('pre');
        excerpt.textContent = buildArchiveSearchExcerpt(message);
        const insert = document.createElement('button');
        insert.type = 'button';
        insert.textContent = 'Insert into composer';
        insert.addEventListener('click', () => {
          const context = `[Retrieved from BraveFox local archive: ${selected.title}]\n${message.role === 'user' ? 'USER' : 'ASSISTANT'}:\n${message.plainText}`;
          if (appendTextToConversationComposer(context)) closeConversationArchiveModal();
        });
        row.append(label, excerpt, insert);
        results.appendChild(row);
      }
    };
    searchInput.addEventListener('input', () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => { searchTimer = 0; void runSearch(); }, 180);
    });

    const linked = getArchiveContextLink();
    if (linked?.sourceConversationId && linked.sourceConversationId !== selected.id) {
      const linkedNote = document.createElement('div');
      linkedNote.className = 'bf-archive-muted';
      linkedNote.style.marginTop = '12px';
      linkedNote.textContent = `This chat is linked to archive ${linked.sourceConversationId.slice(0, 8)}…`;
      detailHost.append(heading, meta, linkedNote, snapshotSelect, actions, searchLabel, searchInput, results);
    } else {
      detailHost.append(heading, meta, snapshotSelect, actions, searchLabel, searchInput, results);
    }
  }

  async function openConversationArchiveModal() {
    ensureConversationArchiveStyles();
    let modal = document.getElementById(CHAT_ARCHIVE_MODAL_ID);
    if (modal) {
      await renderConversationArchiveModal();
      return;
    }
    modal = document.createElement('div');
    modal.id = CHAT_ARCHIVE_MODAL_ID;
    modal.innerHTML = `
      <div class="bf-archive-panel" role="dialog" aria-modal="true" aria-label="BraveFox local chat archive">
        <div class="bf-archive-header">
          <strong>Local Chat Archive</strong>
          <span class="bf-archive-muted">Full local history · deduplicated checkpoints</span>
          <button type="button" class="bf-archive-close">Close</button>
        </div>
        <div class="bf-archive-body">
          <div class="bf-archive-list" data-bf-archive-list></div>
          <div class="bf-archive-detail" data-bf-archive-detail></div>
        </div>
      </div>
    `;
    modal.querySelector('.bf-archive-close')?.addEventListener('click', closeConversationArchiveModal);
    modal.addEventListener('mousedown', event => {
      if (event.target === modal) closeConversationArchiveModal();
    });
    document.addEventListener('keydown', function archiveEscape(event) {
      if (event.key !== 'Escape' || !document.getElementById(CHAT_ARCHIVE_MODAL_ID)) return;
      closeConversationArchiveModal();
      document.removeEventListener('keydown', archiveEscape, true);
    }, true);
    document.documentElement.appendChild(modal);
    await renderConversationArchiveModal();
    void cleanupDeletedConversationArchives(true);
  }

  function startConversationArchiveSystem() {
    ensureConversationArchiveStyles();
    ensureConversationArchiveButton();
    document.addEventListener('pointerdown', handleConversationArchivePointerDown, true);
    document.addEventListener('keydown', handleConversationArchiveLibraryKeyDown, true);
    void openConversationArchiveDb().catch(error => {
      try { console.debug('[BraveFox Enhancer] Local chat archive unavailable.', error); } catch {}
    });

    try {
      if ('BroadcastChannel' in window) {
        conversationArchiveChannel = new BroadcastChannel('bravefox_chat_archive_v1');
        conversationArchiveChannel.addEventListener('message', event => {
          if (event.data?.type === 'changed' && document.getElementById(CHAT_ARCHIVE_MODAL_ID)) {
            scheduleConversationArchiveModalRefresh(60);
          }
        });
      }
    } catch {}

    window.setInterval(() => {
      ensureConversationArchiveButton();
      if (isChatGptLibraryLocation()) reconcileConversationArchiveLibraryNewMenu();
      linkPendingArchiveContextToCurrentConversation();
      if (!getCurrentConversationId()) consumeConversationArchiveHandoffIfReady();
    }, 500);

    if (!conversationArchiveGhostCleanupInterval) {
      conversationArchiveGhostCleanupInterval = window.setInterval(() => {
        void cleanupDeletedConversationArchives(false);
      }, CHAT_ARCHIVE_GHOST_CLEANUP_INTERVAL_MS);
    }

    window.addEventListener('pagehide', () => {
      scheduleConversationArchiveDomCapture(0);
      if (conversationArchiveGhostCleanupInterval) {
        clearInterval(conversationArchiveGhostCleanupInterval);
        conversationArchiveGhostCleanupInterval = 0;
      }
      try { conversationArchiveChannel?.close(); } catch {}
      conversationArchiveChannel = null;
    }, true);

    // First route may already contain a fully rendered conversation when this script starts.
    scheduleConversationArchiveDomCapture(350);
    window.setTimeout(consumeConversationArchiveHandoffIfReady, 150);
    window.setTimeout(() => void cleanupDeletedConversationArchives(false), 8000);
  }

  function getCurrentConversationId() {
    const match = String(location.pathname || '').match(/\/c\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  function getConversationSelectionRouteKey() {
    const conversationId = getCurrentConversationId();
    if (conversationId) return `conversation:${conversationId}`;

    const path = String(location.pathname || '').replace(/\/+$/, '') || '/';
    if (path === '/') return 'new-chat';
    return '';
  }

  function resetConversationSelectionState() {
    conversationPendingUserSentAt = 0;
    conversationPendingAssistantStartedAt = 0;
    conversationPendingModelSlug = '';
    conversationPendingReasoningEffort = '';
    conversationLastSelectedModelSlug = '';
    conversationLastKnownReasoningEffort = '';
  }

  function syncConversationSelectionState() {
    const nextKey = getConversationSelectionRouteKey();
    if (!nextKey || nextKey === conversationSelectionRouteKey) return;

    // First observation establishes the tab's current chat lane. There is nothing stale
    // to clear yet, and this may run after the send timestamp was just captured.
    if (!conversationSelectionRouteKey) {
      conversationSelectionRouteKey = nextKey;
      return;
    }

    const freshPendingSend =
      Boolean(conversationPendingUserSentAt) &&
      Date.now() - conversationPendingUserSentAt < 180000;

    // Sending the first message changes / into /c/<id>. Preserve that one send snapshot
    // across the SPA URL transition; every other conversation change gets a clean slate.
    if (conversationSelectionRouteKey === 'new-chat' && nextKey.startsWith('conversation:') && freshPendingSend) {
      conversationSelectionRouteKey = nextKey;
      return;
    }

    resetConversationSelectionState();
    conversationSelectionRouteKey = nextKey;
  }

  function collectConversationMessageIds(turnRoot) {
    if (!(turnRoot instanceof Element)) return [];

    const ids = new Set();
    const attributes = [
      'data-message-id',
      'data-chatgpt-selection-message-id',
      'data-chatgpt-search-message-ids'
    ];

    const collectFrom = element => {
      if (!(element instanceof Element)) return;
      for (const attribute of attributes) {
        const value = String(element.getAttribute(attribute) || '').trim();
        if (!value) continue;
        for (const part of value.split(/[\s,]+/)) {
          const id = part.trim();
          if (id && id.length >= 8) ids.add(id);
        }
      }
    };

    collectFrom(turnRoot);
    const selector = attributes.map(attribute => `[${attribute}]`).join(', ');
    for (const element of turnRoot.querySelectorAll(selector)) collectFrom(element);
    return Array.from(ids);
  }

  function readConversationMetadataScalar(source, keys, depth = 0, seen = new Set()) {
    if (!source || typeof source !== 'object' || depth > 4 || seen.has(source)) return '';
    seen.add(source);

    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    for (const [key, value] of Object.entries(source)) {
      if (!value || typeof value !== 'object') continue;
      if (['content', 'parts', 'text', 'citations', 'content_references'].includes(key)) continue;
      if (Array.isArray(value) && value.length > 20) continue;
      const found = readConversationMetadataScalar(value, keys, depth + 1, seen);
      if (found) return found;
    }
    return '';
  }

  function extractConversationMessageModelSlug(message, reasoningEffort = '') {
    if (!message || typeof message !== 'object') return '';

    // BraveFox's visible label describes what the user selected for the turn, not a
    // hidden routing/fallback target. Requested/default fields therefore outrank
    // resolved_model_slug and server-side execution aliases.
    const direct = [
      message?.metadata?.default_model_slug,
      message?.metadata?.requested_model_slug,
      message?.metadata?.requested_model,
      message?.metadata?.model_slug,
      message?.model_slug,
      message?.model,
      message?.metadata?.resolved_model_slug,
      message?.metadata?.server_ste_metadata?.model_slug
    ];
    for (const candidate of direct) {
      const value = String(candidate || '').trim();
      if (!value) continue;
      const inferred = inferConversationModelSlugFromText(value, reasoningEffort);
      if (inferred) return inferred;
      const slug = normalizeChatGptModelSlug(value);
      if (slug) return slug;
    }

    const fallback = readConversationMetadataScalar(message.metadata || {}, [
      'default_model_slug', 'requested_model_slug', 'model_slug', 'resolved_model_slug'
    ]);
    return inferConversationModelSlugFromText(fallback, reasoningEffort) || normalizeChatGptModelSlug(fallback);
  }

  function extractConversationMessageReasoningEffort(message) {
    if (!message || typeof message !== 'object') return '';
    const direct = [
      message?.metadata?.thinking_effort,
      message?.metadata?.reasoning_effort,
      message?.metadata?.thinking_effort_level,
      message?.metadata?.reasoning_effort_level,
      message?.metadata?.reasoning_level,
      message?.thinking_effort,
      message?.reasoning_effort
    ];
    for (const candidate of direct) {
      const effort = normalizeConversationReasoningEffort(candidate);
      if (effort) return effort;
    }

    return normalizeConversationReasoningEffort(readConversationMetadataScalar(
      message.metadata || {},
      ['thinking_effort', 'reasoning_effort', 'thinking_effort_level', 'reasoning_effort_level', 'reasoning_level']
    ));
  }

  function buildConversationMessageMetadataIndex(payload) {
    const byId = new Map();
    const ordered = { user: [], assistant: [] };
    const mapping = payload && typeof payload === 'object' ? payload.mapping : null;
    if (!mapping || typeof mapping !== 'object') return { byId, ordered };

    for (const node of Object.values(mapping)) {
      const message = node?.message;
      const id = String(message?.id || '').trim();
      if (!id) continue;

      const role = normalizeText(message?.author?.role);
      let rawTime = message?.create_time;
      if (typeof rawTime === 'string' && /^\d+(?:\.\d+)?$/.test(rawTime.trim())) rawTime = Number(rawTime);
      if (typeof rawTime === 'number' && rawTime > 0 && rawTime < 1e12) rawTime *= 1000;
      const timestamp = rawTime != null ? getMessageTimestampFromDate(rawTime) : '';
      const reasoningEffort = extractConversationMessageReasoningEffort(message);
      const modelSlug = extractConversationMessageModelSlug(message, reasoningEffort);

      const record = {
        id,
        role,
        timestamp,
        rawTime: Number.isFinite(Number(rawTime)) ? Number(rawTime) : 0,
        modelSlug,
        reasoningEffort
      };
      byId.set(id, record);
      if (role === 'user' || role === 'assistant') ordered[role].push(record);
    }

    for (const role of ['user', 'assistant']) {
      ordered[role].sort((a, b) => (a.rawTime || 0) - (b.rawTime || 0));
    }
    return { byId, ordered };
  }

  function buildConversationMessageMetadataIndexFromRecords(records) {
    const byId = new Map();
    const ordered = { user: [], assistant: [] };

    for (const raw of Array.isArray(records) ? records : []) {
      const id = String(raw?.id || '').trim();
      const role = normalizeText(raw?.role);
      if (!id || (role !== 'user' && role !== 'assistant')) continue;

      const record = {
        id,
        role,
        timestamp: formatNativeMessageTimestamp(raw?.timestamp || ''),
        rawTime: Number(raw?.rawTime || 0) || 0,
        modelSlug: String(raw?.modelSlug || '').trim(),
        reasoningEffort: normalizeConversationReasoningEffort(raw?.reasoningEffort)
      };
      byId.set(id, record);
      ordered[role].push(record);
    }

    for (const role of ['user', 'assistant']) {
      ordered[role].sort((a, b) => (a.rawTime || 0) - (b.rawTime || 0));
    }
    return { byId, ordered };
  }

  function readConversationMetadataSharedStore() {
    try {
      const raw = localStorage.getItem(MESSAGE_METADATA_SHARED_CACHE_KEY);
      if (!raw) return { version: 1, conversations: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { version: 1, conversations: {} };
      if (!parsed.conversations || typeof parsed.conversations !== 'object') parsed.conversations = {};
      return parsed;
    } catch {
      return { version: 1, conversations: {} };
    }
  }

  function hydrateConversationMetadataCacheFromSharedStorage(conversationId, force = false) {
    const id = String(conversationId || '').trim();
    if (!id) return null;
    if (!force && conversationSharedMetadataLoaded.has(id)) {
      return conversationMetadataCaches.get(id)?.index || null;
    }
    conversationSharedMetadataLoaded.add(id);

    try {
      const store = readConversationMetadataSharedStore();
      const entry = store.conversations?.[id];
      if (!entry || !Array.isArray(entry.records) || !entry.records.length) return null;

      const index = buildConversationMessageMetadataIndexFromRecords(entry.records);
      if (!(index.byId instanceof Map) || !index.byId.size) return null;

      const savedAt = Number(entry.savedAt || 0) || 0;
      const current = conversationMetadataCaches.get(id);
      if (!current || savedAt >= Number(current.fetchedAt || 0)) {
        conversationMetadataCaches.set(id, {
          index,
          fetchedAt: savedAt,
          source: 'shared'
        });
      }
      return conversationMetadataCaches.get(id)?.index || index;
    } catch {
      return null;
    }
  }

  function persistConversationMetadataIndexToSharedStorage(conversationId, index) {
    const id = String(conversationId || '').trim();
    if (!id || !(index?.byId instanceof Map) || !index.byId.size) return;

    try {
      const records = Array.from(index.byId.values())
        .filter(record => record && record.id && (record.role === 'user' || record.role === 'assistant'))
        .sort((a, b) => (a.rawTime || 0) - (b.rawTime || 0))
        .slice(-MESSAGE_METADATA_SHARED_CACHE_MAX_RECORDS)
        .map(record => ({
          id: String(record.id || ''),
          role: String(record.role || ''),
          timestamp: String(record.timestamp || ''),
          rawTime: Number(record.rawTime || 0) || 0,
          modelSlug: String(record.modelSlug || ''),
          reasoningEffort: String(record.reasoningEffort || '')
        }));

      if (!records.length) return;

      const store = readConversationMetadataSharedStore();
      store.version = 1;
      store.conversations[id] = {
        savedAt: Date.now(),
        records
      };

      const ids = Object.keys(store.conversations)
        .sort((a, b) =>
          Number(store.conversations[b]?.savedAt || 0) -
          Number(store.conversations[a]?.savedAt || 0)
        );
      for (const staleId of ids.slice(MESSAGE_METADATA_SHARED_CACHE_MAX_CONVERSATIONS)) {
        delete store.conversations[staleId];
      }

      localStorage.setItem(MESSAGE_METADATA_SHARED_CACHE_KEY, JSON.stringify(store));
      conversationSharedMetadataLoaded.add(id);
    } catch {}
  }

  function applyConversationMessageMetadataFromFastCache(turnRoot, role, surface) {
    if (!(turnRoot instanceof Element) || !(surface instanceof Element)) return false;
    const conversationId = getCurrentConversationId();
    if (!conversationId) return false;

    hydrateConversationMetadataCacheFromSharedStorage(conversationId);
    const index = conversationMetadataCaches.get(conversationId)?.index;
    if (!(index?.byId instanceof Map) || !index.byId.size) return false;

    const ids = collectConversationMessageIds(turnRoot);
    for (const id of collectConversationMessageIds(surface)) {
      if (!ids.includes(id)) ids.unshift(id);
    }

    for (const messageId of ids) {
      const record = index.byId.get(messageId);
      if (!record || (record.role && record.role !== role)) continue;
      if (applyConversationMessageMetadataRecord(turnRoot, role, record, surface, 'cache')) return true;
    }
    return false;
  }

  function primeConversationMetadataIndexForCurrentRoute() {
    const conversationId = getCurrentConversationId();
    if (!conversationId) return;
    hydrateConversationMetadataCacheFromSharedStorage(conversationId);
    void fetchConversationMessageMetadataIndex(conversationId, false).then(() => {
      // The shared cache already paints synchronously. This follow-up only fills messages
      // that were added since the cache snapshot or corrects a first-load cache miss.
      refreshLatestConversationMetadataImmediately();
    });
  }

  async function fetchConversationMessageMetadataIndex(conversationId, force = false) {
    if (!conversationId) return { byId: new Map(), ordered: { user: [], assistant: [] } };

    hydrateConversationMetadataCacheFromSharedStorage(conversationId);
    const cached = conversationMetadataCaches.get(conversationId);
    if (
      !force &&
      cached?.index?.byId instanceof Map &&
      Date.now() - Number(cached.fetchedAt || 0) < MESSAGE_TIMESTAMP_API_CACHE_MS
    ) {
      return cached.index;
    }

    const activeFetch = conversationMetadataFetches.get(conversationId);
    if (activeFetch) return activeFetch;

    const request = (async () => {
      try {
        const url = `${location.origin}/backend-api/conversation/${encodeURIComponent(conversationId)}`;
        const requestConversation = async token => {
          const headers = { Accept: 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;
          return fetch(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers
          });
        };

        // Full ChatGPT conversation reads are bearer-authenticated. Do not use the
        // cookie-only request as the primary path: some deployments fail it with a
        // non-401/403 response, which previously prevented us from ever trying the
        // session token and left the archive stuck with only virtualized DOM messages.
        let token = conversationAccessToken || await resolveConversationAccessToken();
        let response = await requestConversation(token || '');

        if (!response.ok && token && (response.status === 401 || response.status === 403)) {
          // A cached bearer token can expire independently of the page session. Clear it
          // and force a fresh /api/auth/session lookup before retrying once.
          conversationAccessToken = '';
          token = await resolveConversationAccessToken();
          if (token) response = await requestConversation(token);
        }

        // If session lookup itself is unavailable, retain one cookie-auth fallback rather
        // than giving up entirely. This is fallback-only; a valid bearer token always wins.
        if (!response.ok && !token) {
          response = await requestConversation('');
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        conversationArchiveExistenceApiHealthyAt = Date.now();

        const payload = await response.json();
        const archiveSync = Promise.resolve(archiveConversationPayload(conversationId, payload))
          .catch(() => false)
          .finally(() => {
            if (conversationArchivePayloadSyncs.get(conversationId) === archiveSync) {
              conversationArchivePayloadSyncs.delete(conversationId);
            }
          });
        conversationArchivePayloadSyncs.set(conversationId, archiveSync);
        void archiveSync;
        const index = buildConversationMessageMetadataIndex(payload);
        conversationMetadataCaches.set(conversationId, {
          index,
          fetchedAt: Date.now(),
          source: 'api'
        });
        persistConversationMetadataIndexToSharedStorage(conversationId, index);
        return index;
      } catch {
        return cached?.index?.byId instanceof Map
          ? cached.index
          : { byId: new Map(), ordered: { user: [], assistant: [] } };
      } finally {
        conversationMetadataFetches.delete(conversationId);
      }
    })();

    conversationMetadataFetches.set(conversationId, request);
    return request;
  }

  function getConversationLogicalTurnGroupKey(turnRoot, surface, role) {
    const candidates = [];
    const add = element => {
      if (!(element instanceof Element)) return;
      for (const attribute of ['data-content-search-unit-key', 'data-chatgpt-search-unit-key']) {
        const value = String(element.getAttribute(attribute) || '').trim();
        if (value) candidates.push(value);
      }
    };

    add(surface);
    if (surface instanceof Element) {
      let node = surface.parentElement;
      for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
        add(node);
        if (node === turnRoot) break;
      }
    }
    add(turnRoot);

    for (const value of candidates) {
      const match = value.match(/^(.*?turn-[^:]+)(?::|$)/i);
      if (match?.[1]) return `${role}:${match[1]}`;
      const withoutSubmessage = value.replace(/:\d+:(?:assistant|user)$/i, '');
      if (withoutSubmessage !== value) return `${role}:${withoutSubmessage}`;
    }

    return getConversationTurnIdentity(turnRoot, role, surface);
  }

  function getConversationRoleOrdinal(turnRoot, role, surface) {
    const selector = role === 'user'
      ? '[data-user-message-bubble="true"], .bravefox-user-message-surface'
      : '[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface';
    const groups = [];
    const seenGroups = new Set();

    for (const candidateSurface of document.querySelectorAll(selector)) {
      if (!(candidateSurface instanceof Element)) continue;
      const candidateRoot = getConversationTurnRoot(candidateSurface, candidateSurface, role);
      if (!(candidateRoot instanceof Element)) continue;
      const groupKey = getConversationLogicalTurnGroupKey(candidateRoot, candidateSurface, role);
      if (!groupKey || seenGroups.has(groupKey)) continue;
      seenGroups.add(groupKey);
      groups.push(groupKey);
    }

    const currentKey = getConversationLogicalTurnGroupKey(turnRoot, surface, role);
    return groups.indexOf(currentKey);
  }

  function applyConversationMessageMetadataRecord(turnRoot, role, record, surface, source = 'api') {
    if (!(turnRoot instanceof Element) || !record) return false;
    let changed = false;

    const exactSurfaceMatch =
      source !== 'api-ordinal' &&
      surface instanceof Element &&
      conversationRecordMatchesSurfaceExactly(turnRoot, role, surface, record);

    if (record.timestamp && exactSurfaceMatch) {
      if (setConversationSurfaceTimestamp(turnRoot, role, surface, record.timestamp, source)) changed = true;
    }

    if (role === 'assistant') {
      // A send-time snapshot is the strongest source for the visible label: it records
      // the model/effort selected in this exact tab when the user sent the prompt. Exact
      // API metadata is authoritative only when no send snapshot exists (for example
      // after a reload). Ordinal matching is never trusted for model/effort.
      const recordModel = exactSurfaceMatch ? String(record.modelSlug || '').trim() : '';
      const domModel = readConversationModelSlugFromDom(turnRoot, surface);
      const modelSlug = recordModel || domModel;
      const modelSource = String(turnRoot.getAttribute(MESSAGE_MODEL_SOURCE_ATTR) || '').trim();
      if (modelSlug && modelSource !== 'send') {
        if (turnRoot.getAttribute(MESSAGE_MODEL_ATTR) !== modelSlug) {
          turnRoot.setAttribute(MESSAGE_MODEL_ATTR, modelSlug);
          changed = true;
        }
        turnRoot.setAttribute(MESSAGE_MODEL_SOURCE_ATTR, recordModel ? 'api' : 'dom');
      }

      const recordEffort = exactSurfaceMatch
        ? normalizeConversationReasoningEffort(record.reasoningEffort)
        : '';
      const domEffort = readConversationReasoningEffortFromDom(turnRoot, surface);
      const effort = recordEffort || domEffort;
      const effortSource = String(turnRoot.getAttribute(MESSAGE_REASONING_SOURCE_ATTR) || '').trim();
      if (effort && effortSource !== 'send') {
        if (turnRoot.getAttribute(MESSAGE_REASONING_ATTR) !== effort) {
          turnRoot.setAttribute(MESSAGE_REASONING_ATTR, effort);
          changed = true;
        }
        turnRoot.setAttribute(MESSAGE_REASONING_SOURCE_ATTR, recordEffort ? 'api' : 'dom');
      }
    }

    if (changed) refreshConversationMetadataHeadersForTurn(turnRoot, role);
    return changed;
  }

  async function resolveConversationMetadataFromApi(turnRoot, role, surface = null) {
    if (!(turnRoot instanceof Element)) return false;
    if (apiQueuedMessageTimestampTurns.has(turnRoot)) return false;

    const conversationId = getCurrentConversationId();
    if (!conversationId) return false;

    apiQueuedMessageTimestampTurns.add(turnRoot);
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) await delayMessageTimestampProbe(attempt === 1 ? 500 : 1200);
        if (!turnRoot.isConnected) return false;

        const index = await fetchConversationMessageMetadataIndex(conversationId, attempt > 0);
        const messageIds = collectConversationMessageIds(turnRoot);
        if (surface instanceof Element) {
          for (const id of collectConversationMessageIds(surface)) {
            if (!messageIds.includes(id)) messageIds.unshift(id);
          }
        }

        for (const messageId of messageIds) {
          const record = index.byId.get(messageId);
          if (!record || (record.role && record.role !== role)) continue;
          if (applyConversationMessageMetadataRecord(turnRoot, role, record, surface, 'api')) return true;
        }

        // Some 2026 UI buckets mount the visible bubble before its data-message-id.
        // Fall back to the turn's ordinal within the same author role for non-time
        // metadata only. api-ordinal is explicitly blocked from changing timestamps.
        const ordinal = getConversationRoleOrdinal(turnRoot, role, surface);
        const ordered = index.ordered?.[role] || [];
        const record = ordinal >= 0 ? ordered[ordinal] : null;
        if (record && applyConversationMessageMetadataRecord(turnRoot, role, record, surface, 'api-ordinal')) {
          return true;
        }
      }
    } finally {
      apiQueuedMessageTimestampTurns.delete(turnRoot);
    }

    return false;
  }

  function getConversationTurnIdentity(turnRoot, role, surface) {
    if (!(turnRoot instanceof Element)) return '';

    const messageIds = collectConversationMessageIds(turnRoot);
    if (messageIds.length) return `${role}:${messageIds[0]}`;

    for (const attribute of [
      'data-testid',
      'data-content-search-unit-key',
      'data-chatgpt-search-unit-key',
      'data-chatgpt-selection-message-id',
      'data-message-id'
    ]) {
      const value = String(turnRoot.getAttribute(attribute) || '').trim();
      if (value) return `${role}:${attribute}:${value}`;
    }

    if (surface instanceof Element) {
      for (const attribute of ['data-chatgpt-selection-message-id', 'data-message-id']) {
        const value = String(surface.getAttribute(attribute) || '').trim();
        if (value) return `${role}:${attribute}:${value}`;
      }
    }

    return `${role}:turn`;
  }

  function collectConversationSurfacesInTurn(turnRoot, role) {
    if (!(turnRoot instanceof Element)) return [];
    const selector = role === 'user'
      ? '[data-user-message-bubble="true"], .bravefox-user-message-surface'
      : '[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface';
    const result = [];
    const seen = new Set();
    const add = surface => {
      if (!(surface instanceof HTMLElement) || seen.has(surface)) return;
      seen.add(surface);
      result.push(surface);
    };
    if (turnRoot.matches?.(selector)) add(turnRoot);
    for (const surface of turnRoot.querySelectorAll(selector)) add(surface);
    return result;
  }

  function getConversationSurfaceIdentity(turnRoot, role, surface) {
    const turnKey = getConversationTurnIdentity(turnRoot, role, surface);
    const surfaces = collectConversationSurfacesInTurn(turnRoot, role);
    const ordinal = Math.max(0, surfaces.indexOf(surface));
    const ids = collectConversationMessageIds(surface);
    const messagePart = ids.length ? ids[0] : 'no-message-id';
    return `${turnKey}:surface:${ordinal}:${messagePart}`;
  }

  function isPrimaryConversationSurface(turnRoot, role, surface) {
    if (!(turnRoot instanceof Element) || !(surface instanceof Element)) return false;
    const surfaces = collectConversationSurfacesInTurn(turnRoot, role);
    return surfaces.length > 0 && surfaces[0] === surface;
  }

  function getConversationSurfaceTimestamp(turnRoot, role, surface) {
    if (!(surface instanceof Element)) return '';

    const direct = surface.getAttribute(MESSAGE_TIMESTAMP_ATTR) || '';
    if (direct) return direct;

    if (isPrimaryConversationSurface(turnRoot, role, surface)) {
      return turnRoot.getAttribute(MESSAGE_TIMESTAMP_ATTR) || '';
    }
    return '';
  }

  function getConversationSurfaceTimestampSource(turnRoot, role, surface) {
    if (!(surface instanceof Element)) return '';

    const direct = surface.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) || '';
    if (direct) return direct;

    if (isPrimaryConversationSurface(turnRoot, role, surface)) {
      return turnRoot.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) || '';
    }
    return '';
  }

  function setConversationSurfaceTimestamp(turnRoot, role, surface, timestamp, source = 'observed') {
    if (!(turnRoot instanceof Element) || !(surface instanceof Element)) return false;
    if (source === 'api-ordinal') return false;

    const formatted = formatNativeMessageTimestamp(timestamp);
    if (!formatted) return false;

    const previous = surface.getAttribute(MESSAGE_TIMESTAMP_ATTR) || '';
    const previousSource = surface.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) || '';
    const authoritative = source !== 'observed';
    if (previous && previousSource && previousSource !== 'observed' && !authoritative) return false;
    if (previous === formatted && previousSource === source) return false;

    surface.setAttribute(MESSAGE_TIMESTAMP_ATTR, formatted);
    surface.setAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR, source);
    updateConversationMetadataHeader(turnRoot, role, formatted, surface);
    return true;
  }

  function conversationRecordMatchesSurfaceExactly(turnRoot, role, surface, record) {
    if (!(turnRoot instanceof Element) || !(surface instanceof Element) || !record?.id) return false;

    const surfaceIds = collectConversationMessageIds(surface);
    if (surfaceIds.includes(record.id)) return true;

    const surfaces = collectConversationSurfacesInTurn(turnRoot, role);
    if (surfaces.length !== 1 || surfaces[0] !== surface) return false;
    return collectConversationMessageIds(turnRoot).includes(record.id);
  }

  function removeLegacyConversationMetadataHeader(turnRoot, surface) {
    if (!(turnRoot instanceof Element)) return;

    // v3/v4 owned one header per turn. v5 owns one header per visible message surface.
    // Remove only old-format rows; never delete another live surface's v5 row.
    for (const legacy of turnRoot.querySelectorAll(`[${MESSAGE_META_ATTR}="true"]`)) {
      if (!(legacy instanceof Element)) continue;
      if (legacy.hasAttribute(MESSAGE_META_SURFACE_KEY_ATTR)) continue;
      legacy.remove();
    }

    if (surface instanceof Element) {
      surface.removeAttribute('data-bravefox-message-meta-host');
      surface.removeAttribute(MESSAGE_META_ATTR);
      surface.removeAttribute(MESSAGE_META_TEXT_ATTR);
      surface.style.removeProperty('padding-top');
    }
  }

  function syncConversationMetadataGeometry(header, surface, role) {
    if (!(header instanceof HTMLElement) || !(surface instanceof HTMLElement)) return;

    const width = Math.ceil(surface.getBoundingClientRect().width);
    if (width > 0) {
      header.style.setProperty('--bravefox-message-meta-width', `${width}px`);
    } else {
      header.style.removeProperty('--bravefox-message-meta-width');
    }
    header.setAttribute(MESSAGE_META_ROLE_ATTR, role);
  }

  function updateConversationMetadataHeader(turnRoot, role, timestamp = '', surface = null) {
    if (!(turnRoot instanceof Element)) return null;
    if (!CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.enabled) return null;

    const liveSurface = surface instanceof HTMLElement
      ? surface
      : collectConversationSurfacesInTurn(turnRoot, role)[0];
    if (!(liveSurface instanceof HTMLElement)) return null;

    const senderLabel = getConfiguredConversationSenderLabel(role, turnRoot, liveSurface);
    if (!senderLabel) return null;

    const host = liveSurface.parentElement;
    if (!(host instanceof HTMLElement)) return null;
    if (host !== turnRoot && !turnRoot.contains(host)) return null;

    const turnKey = getConversationTurnIdentity(turnRoot, role, liveSurface);
    const surfaceKey = getConversationSurfaceIdentity(turnRoot, role, liveSurface);
    turnRoot.setAttribute(MESSAGE_TURN_ATTR, role);
    if (turnKey) turnRoot.setAttribute(MESSAGE_TURN_KEY_ATTR, turnKey);

    removeLegacyConversationMetadataHeader(turnRoot, liveSurface);

    let header = null;
    const previous = liveSurface.previousElementSibling;
    if (
      previous instanceof HTMLElement &&
      previous.getAttribute(MESSAGE_META_ATTR) === 'true' &&
      previous.getAttribute(MESSAGE_META_SURFACE_KEY_ATTR) === surfaceKey
    ) {
      header = previous;
    }

    if (!(header instanceof HTMLElement)) {
      for (const candidate of host.querySelectorAll(`:scope > [${MESSAGE_META_ATTR}="true"]`)) {
        if (!(candidate instanceof HTMLElement)) continue;
        if (candidate.getAttribute(MESSAGE_META_SURFACE_KEY_ATTR) !== surfaceKey) continue;
        header = candidate;
        break;
      }
    }

    if (!(header instanceof HTMLElement)) {
      header = document.createElement('div');
      header.setAttribute(MESSAGE_META_ATTR, 'true');
      header.setAttribute(MESSAGE_META_KEY_ATTR, turnKey);
      header.setAttribute(MESSAGE_META_SURFACE_KEY_ATTR, surfaceKey);
      header.setAttribute(MESSAGE_META_ROLE_ATTR, role);

      const text = document.createElement('span');
      text.setAttribute(MESSAGE_META_TEXT_ATTR, 'true');
      header.appendChild(text);
    }

    // Every visible assistant sub-message owns its own row. Reparenting one surface can
    // therefore never steal or replace metadata belonging to a sibling surface/turn.
    if (header.parentElement !== host || header.nextElementSibling !== liveSurface) {
      host.insertBefore(header, liveSurface);
    }

    header.removeAttribute('aria-hidden');

    let textTarget = header.querySelector(`[${MESSAGE_META_TEXT_ATTR}="true"]`);
    if (!(textTarget instanceof HTMLElement)) {
      textTarget = document.createElement('span');
      textTarget.setAttribute(MESSAGE_META_TEXT_ATTR, 'true');
      header.replaceChildren(textTarget);
    }

    const resolvedTimestamp = timestamp || getConversationSurfaceTimestamp(turnRoot, role, liveSurface);
    const separator = String(CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.separator ?? ' - ');
    const finalText = resolvedTimestamp ? `${senderLabel}${separator}${resolvedTimestamp}` : senderLabel;
    if (textTarget.textContent !== finalText) textTarget.textContent = finalText;

    syncConversationMetadataGeometry(header, liveSurface, role);
    if (role === 'user' && !normalizeConversationUserDisplayName(CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.userLabel)) {
      void resolveConversationUserDisplayName(false);
    }

    return header;
  }

  function refreshConversationMetadataHeadersForTurn(turnRoot, role) {
    if (!(turnRoot instanceof Element)) return;
    for (const surface of collectConversationSurfacesInTurn(turnRoot, role)) {
      const timestamp = getConversationSurfaceTimestamp(turnRoot, role, surface);
      updateConversationMetadataHeader(turnRoot, role, timestamp, surface);
    }
  }

  function stampConversationActionRow(turnRoot, actionRow) {
    if (!(turnRoot instanceof HTMLElement) || !(actionRow instanceof HTMLElement)) return;
    actionRow.setAttribute(MESSAGE_ACTIONS_ATTR, 'true');
  }

  function setConversationTimestamp(turnRoot, role, timestamp, source = 'native') {
    if (!(turnRoot instanceof Element)) return false;

    // Ordinal API matching is only a best-effort metadata fallback. It is not safe
    // enough to identify a message timestamp, so it must never overwrite the live,
    // native-menu, inline, or exact-ID time already associated with this turn.
    if (source === 'api-ordinal') return false;

    const formatted = formatNativeMessageTimestamp(timestamp);
    if (!formatted) return false;

    const previous = turnRoot.getAttribute(MESSAGE_TIMESTAMP_ATTR) || '';
    const previousSource = turnRoot.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) || '';
    const authoritative = source !== 'observed';
    if (previous && previousSource && previousSource !== 'observed' && !authoritative) return false;

    turnRoot.setAttribute(MESSAGE_TIMESTAMP_ATTR, formatted);
    turnRoot.setAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR, source);
    if (authoritative) completedMessageTimestampTurns.add(turnRoot);

    const primarySurface = collectConversationSurfacesInTurn(turnRoot, role)[0];
    if (primarySurface instanceof Element && primarySurface !== turnRoot) {
      setConversationSurfaceTimestamp(turnRoot, role, primarySurface, formatted, source);
    } else {
      refreshConversationMetadataHeadersForTurn(turnRoot, role);
    }
    return previous !== formatted || previousSource !== source;
  }

  function findOpenNativeMessageTimestamp() {
    for (const item of document.querySelectorAll('[role="menuitem"]')) {
      if (!(item instanceof Element)) continue;
      const text = String(item.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 120) continue;
      if (!/\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/.test(text)) continue;
      return text;
    }
    return '';
  }

  function delayMessageTimestampProbe(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function dispatchConversationMenuPointerDown(button) {
    if (!(button instanceof HTMLButtonElement)) return false;

    try {
      if (typeof PointerEvent === 'function') {
        button.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: Math.max(1, Math.round(button.getBoundingClientRect().left + 2)),
          clientY: Math.max(1, Math.round(button.getBoundingClientRect().top + 2))
        }));
        return true;
      }
    } catch {
      // Fall through to the mouse event path.
    }

    try {
      button.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        buttons: 1
      }));
      return true;
    } catch {
      return false;
    }
  }

  function nativeMessageMenuLooksOpen(menuButton) {
    if (!(menuButton instanceof HTMLButtonElement)) return false;
    return (
      menuButton.getAttribute('aria-expanded') === 'true' ||
      menuButton.getAttribute('data-state') === 'open' ||
      Boolean(findOpenNativeMessageTimestamp())
    );
  }

  async function openNativeConversationMessageMenu(menuButton) {
    if (!(menuButton instanceof HTMLButtonElement)) return false;
    if (nativeMessageMenuLooksOpen(menuButton)) return true;

    dispatchConversationMenuPointerDown(menuButton);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await delayMessageTimestampProbe(20);
      if (nativeMessageMenuLooksOpen(menuButton)) return true;
    }

    try {
      menuButton.click();
    } catch {
      return false;
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await delayMessageTimestampProbe(20);
      if (nativeMessageMenuLooksOpen(menuButton)) return true;
    }
    return false;
  }

  async function closeNativeConversationMessageMenu(menuButton) {
    if (!(menuButton instanceof HTMLButtonElement) || !menuButton.isConnected) return;
    if (!nativeMessageMenuLooksOpen(menuButton)) return;

    dispatchConversationMenuPointerDown(menuButton);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await delayMessageTimestampProbe(16);
      if (!nativeMessageMenuLooksOpen(menuButton)) return;
    }

    try {
      menuButton.click();
      await delayMessageTimestampProbe(16);
    } catch {
      // Nothing else to do; a user-opened menu must never be force-removed from the DOM.
    }
  }

  async function probeConversationTimestamp(turnRoot, role, menuButton) {
    if (!(turnRoot instanceof Element) || !(menuButton instanceof HTMLButtonElement)) return;
    if (!turnRoot.isConnected || !menuButton.isConnected) return;
    if (turnRoot.hasAttribute(MESSAGE_TIMESTAMP_ATTR) && turnRoot.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) !== 'observed') return;
    if (nativeMessageMenuLooksOpen(menuButton)) return;
    if (document.querySelector('[role="menu"][data-state="open"], [role="menu"] [role="menuitem"]')) return;

    document.documentElement.classList.add(MESSAGE_TIMESTAMP_PROBE_CLASS);
    try {
      const opened = await openNativeConversationMessageMenu(menuButton);
      if (!opened) return;

      let nativeTimestamp = '';
      for (let attempt = 0; attempt < 22 && !nativeTimestamp; attempt += 1) {
        await delayMessageTimestampProbe(24);
        nativeTimestamp = findOpenNativeMessageTimestamp();
      }

      if (nativeTimestamp) setConversationTimestamp(turnRoot, role, nativeTimestamp, 'menu');
      await closeNativeConversationMessageMenu(menuButton);
    } catch {
      // Leave the native controls alone if this UI bucket rejects synthetic probing.
    } finally {
      document.documentElement.classList.remove(MESSAGE_TIMESTAMP_PROBE_CLASS);
    }
  }

  function scheduleConversationTimestampProbe(turnRoot, role, actionRow) {
    if (!(turnRoot instanceof Element) || completedMessageTimestampTurns.has(turnRoot)) return;

    const timestampSource = turnRoot.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) || '';
    if (turnRoot.hasAttribute(MESSAGE_TIMESTAMP_ATTR) && timestampSource !== 'observed') return;

    const inlineTimestamp = readInlineConversationTimestamp(turnRoot);
    if (inlineTimestamp) {
      setConversationTimestamp(turnRoot, role, inlineTimestamp, 'inline');
      return;
    }

    if (queuedMessageTimestampTurns.has(turnRoot)) return;
    const menuButton = actionRow instanceof HTMLButtonElement && actionRow.getAttribute('aria-haspopup') === 'menu'
      ? actionRow
      : findConversationMoreMenuButton(actionRow);
    if (!(menuButton instanceof HTMLButtonElement)) return;

    queuedMessageTimestampTurns.add(turnRoot);
    messageTimestampProbeQueue.push({ turnRoot, role, menuButton });

    if (!messageTimestampProbeTimer && !messageTimestampProbeActive) {
      messageTimestampProbeTimer = window.setTimeout(processConversationTimestampProbeQueue, 320);
    }
  }

  async function processConversationTimestampProbeQueue() {
    if (messageTimestampProbeActive) return;
    if (messageTimestampProbeTimer) {
      clearTimeout(messageTimestampProbeTimer);
      messageTimestampProbeTimer = 0;
    }

    messageTimestampProbeActive = true;
    try {
      while (messageTimestampProbeQueue.length) {
        const item = messageTimestampProbeQueue.shift();
        const { turnRoot, role, menuButton } = item || {};
        if (!(turnRoot instanceof Element) || !turnRoot.isConnected) continue;
        const source = turnRoot.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) || '';
        if (turnRoot.hasAttribute(MESSAGE_TIMESTAMP_ATTR) && source !== 'observed') continue;

        await probeConversationTimestamp(turnRoot, role, menuButton);
        if (!turnRoot.hasAttribute(MESSAGE_TIMESTAMP_ATTR) || turnRoot.getAttribute(MESSAGE_TIMESTAMP_SOURCE_ATTR) === 'observed') {
          queuedMessageTimestampTurns.delete(turnRoot);
        }
        await delayMessageTimestampProbe(34);
      }
    } finally {
      messageTimestampProbeActive = false;
    }
  }

  function isSurfaceInLatestConversationTurn(turnRoot, role, surface) {
    if (!(turnRoot instanceof Element) || !(surface instanceof Element)) return false;
    const selector = role === 'user'
      ? '[data-user-message-bubble="true"], .bravefox-user-message-surface'
      : '[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface';
    const surfaces = Array.from(document.querySelectorAll(selector)).filter(element => element instanceof HTMLElement);
    const latestSurface = surfaces[surfaces.length - 1];
    if (!(latestSurface instanceof Element)) return false;
    if (latestSurface === surface || latestSurface.contains(surface) || surface.contains(latestSurface)) return true;

    const latestRoot = getConversationTurnRoot(latestSurface, latestSurface, role);
    if (!(latestRoot instanceof Element)) return false;
    if (latestRoot === turnRoot || turnRoot.contains(latestSurface) || latestRoot.contains(surface)) return true;

    const latestKey = getConversationLogicalTurnGroupKey(latestRoot, latestSurface, role);
    const currentKey = getConversationLogicalTurnGroupKey(turnRoot, surface, role);
    if (!latestKey || !currentKey || latestKey.endsWith(':turn') || currentKey.endsWith(':turn')) return false;
    return latestKey === currentKey;
  }

  function getObservedConversationTimestamp(turnRoot, role, surface) {
    if (!(surface instanceof Element)) return '';

    const existing = surface.getAttribute(MESSAGE_TIMESTAMP_ATTR) || '';
    if (existing) return existing;

    const now = Date.now();
    if (!isSurfaceInLatestConversationTurn(turnRoot, role, surface)) return '';

    if (role === 'user') {
      if (!conversationPendingUserSentAt || now - conversationPendingUserSentAt > 120000) return '';
      return getMessageTimestampFromDate(conversationPendingUserSentAt);
    }

    if (role === 'assistant') {
      if (!conversationPendingUserSentAt || now - conversationPendingUserSentAt > 180000) return '';
      return getMessageTimestampFromDate(now);
    }
    return '';
  }

  function findConversationMoreMenuButtonNearSurface(turnRoot, surface) {
    const actionRow = findConversationActionRow(turnRoot, surface);
    const direct = findConversationMoreMenuButton(actionRow);
    if (direct instanceof HTMLButtonElement) return { actionRow, menuButton: direct };

    let node = surface instanceof Element ? surface.parentElement : null;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (!(node instanceof Element)) continue;
      if (turnRoot instanceof Element && node !== turnRoot && !turnRoot.contains(node)) break;

      const candidates = Array.from(node.querySelectorAll('button')).filter(button =>
        button instanceof HTMLButtonElement && !(surface instanceof Element && surface.contains(button))
      );
      for (const button of candidates) {
        if (button.getAttribute('aria-haspopup') === 'menu') return { actionRow: button.parentElement, menuButton: button };
        const label = getConversationActionButtonLabel(button);
        if (includesAny(label, ['more', 'more actions', 'lisää', 'lisaa', 'options'])) {
          return { actionRow: button.parentElement, menuButton: button };
        }
        if (['...', '…', '⋯'].includes(String(button.textContent || '').trim())) {
          return { actionRow: button.parentElement, menuButton: button };
        }
      }
      if (node === turnRoot) break;
    }
    return { actionRow: null, menuButton: null };
  }

  function scheduleConversationMetadataRetries(roleNode, role, surface) {
    if (!(surface instanceof HTMLElement)) return;
    if (surface.getAttribute(MESSAGE_METADATA_RETRY_ATTR) === 'true') return;
    surface.setAttribute(MESSAGE_METADATA_RETRY_ATTR, 'true');

    for (const delay of [220, 700, 1600, 3200]) {
      window.setTimeout(() => {
        if (!surface.isConnected) return;
        applyConversationMessageMetadata(roleNode?.isConnected ? roleNode : surface, role, surface);
      }, delay);
    }
  }

  function applyConversationMessageMetadata(roleNode, role, surface) {
    if (!CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.enabled) return;
    syncConversationSelectionState();
    if (!(roleNode instanceof Element) || !(surface instanceof Element)) return;

    const turnRoot = getConversationTurnRoot(roleNode, surface, role);
    if (!(turnRoot instanceof Element)) return;

    // Exact message-id metadata restored from another tab/local cache is safe to use
    // immediately and avoids the large-conversation API latency seen on window switches.
    applyConversationMessageMetadataFromFastCache(turnRoot, role, surface);

    if (role === 'assistant') {
      // DOM metadata is only an initial hint. Once exact per-message metadata has filled
      // these attributes, later streaming/retry passes must not replace it with a broader
      // current-model value.
      let modelSlug = readConversationModelSlugFromDom(turnRoot, surface);
      const isLatestAssistantTurn = isSurfaceInLatestConversationTurn(turnRoot, role, surface);
      const hasFreshPendingSend =
        Boolean(conversationPendingUserSentAt) &&
        Date.now() - conversationPendingUserSentAt < 180000;

      if (!modelSlug && isLatestAssistantTurn && hasFreshPendingSend && conversationPendingModelSlug) {
        modelSlug = conversationPendingModelSlug;
      }
      if (modelSlug && !turnRoot.getAttribute(MESSAGE_MODEL_ATTR)) {
        turnRoot.setAttribute(MESSAGE_MODEL_ATTR, modelSlug);
        turnRoot.setAttribute(
          MESSAGE_MODEL_SOURCE_ATTR,
          !readConversationModelSlugFromDom(turnRoot, surface) && isLatestAssistantTurn && hasFreshPendingSend
            ? 'send'
            : 'dom'
        );
      }

      let effort = readConversationReasoningEffortFromDom(turnRoot, surface);
      if (!effort && isLatestAssistantTurn && hasFreshPendingSend) {
        effort = conversationPendingReasoningEffort;
      }
      if (effort && !turnRoot.getAttribute(MESSAGE_REASONING_ATTR)) {
        turnRoot.setAttribute(MESSAGE_REASONING_ATTR, normalizeConversationReasoningEffort(effort));
        turnRoot.setAttribute(
          MESSAGE_REASONING_SOURCE_ATTR,
          !readConversationReasoningEffortFromDom(turnRoot, surface) && isLatestAssistantTurn && hasFreshPendingSend
            ? 'send'
            : 'dom'
        );
      }
    }

    let timestamp = getConversationSurfaceTimestamp(turnRoot, role, surface);
    if (!timestamp) {
      const inlineTimestamp = readInlineConversationTimestamp(surface);
      if (inlineTimestamp) {
        setConversationSurfaceTimestamp(turnRoot, role, surface, inlineTimestamp, 'inline');
        timestamp = getConversationSurfaceTimestamp(turnRoot, role, surface) || inlineTimestamp;
      }
    }

    if (!timestamp) {
      const observed = getObservedConversationTimestamp(turnRoot, role, surface);
      if (observed) {
        setConversationSurfaceTimestamp(turnRoot, role, surface, observed, 'observed');
        timestamp = getConversationSurfaceTimestamp(turnRoot, role, surface) || observed;
      }
    }

    updateConversationMetadataHeader(turnRoot, role, timestamp, surface);

    const timestampSource = getConversationSurfaceTimestampSource(turnRoot, role, surface);
    const needsAuthoritativeTimestamp = !timestamp || timestampSource === 'observed';
    const needsAssistantDetails = role === 'assistant' && (
      !turnRoot.getAttribute(MESSAGE_MODEL_ATTR) ||
      (CHATGPT_MESSAGE_METADATA_CUSTOMIZATION.showAssistantReasoningLevel && !turnRoot.getAttribute(MESSAGE_REASONING_ATTR))
    );
    if (needsAuthoritativeTimestamp || needsAssistantDetails) {
      void resolveConversationMetadataFromApi(turnRoot, role, surface);
    }

    const { actionRow, menuButton } = findConversationMoreMenuButtonNearSurface(turnRoot, surface);
    if (actionRow instanceof Element) stampConversationActionRow(turnRoot, actionRow);
    if (needsAuthoritativeTimestamp && menuButton instanceof HTMLButtonElement) {
      scheduleConversationTimestampProbe(turnRoot, role, menuButton);
    }

    scheduleConversationMetadataRetries(roleNode, role, surface);
  }

  function getMatchingAssistantErrorTextRule(element) {
    if (!(element instanceof Element)) return null;
    if (!element.closest('[data-markdown-text-style="assistant-message"], .bravefox-assistant-message-surface')) {
      return null;
    }

    const text = normalizeText(element.textContent);
    if (!text) return null;

    for (const rule of CHATGPT_ASSISTANT_ERROR_TEXT_REPLACEMENTS) {
      if (!rule?.enabled || typeof rule.replacement !== 'string') continue;
      const matchAny = Array.isArray(rule.matchAny)
        ? rule.matchAny.map(normalizeText).filter(Boolean)
        : [];
      if (matchAny.some(value => text.includes(value))) return rule;
    }

    return null;
  }

  function replaceCustomizableAssistantErrorText(scope = document) {
    const selector = [
      '[data-markdown-text-style="assistant-message"] span',
      '.bravefox-assistant-message-surface span',
      '[data-markdown-text-style="assistant-message"] p',
      '.bravefox-assistant-message-surface p'
    ].join(', ');

    forEachMatch(scope, selector, element => {
      if (!(element instanceof Element)) return;
      if (element.getAttribute('data-bravefox-assistant-error-customized') === 'true') return;

      // Prefer the innermost text-bearing element so surrounding paragraph markup survives.
      if (element.matches('p') && element.querySelector('span')) return;
      const rule = getMatchingAssistantErrorTextRule(element);
      if (!rule) return;

      element.textContent = rule.replacement;
      element.setAttribute('data-bravefox-assistant-error-customized', 'true');
    });
  }

  function applyConversationPresentation(scope = document) {
    // Exact live-DOM hooks first; role inference remains fallback for older buckets.
    paintExactRevampConversationSurfaces(scope);

    for (const roleNode of collectConversationRoleNodes(scope)) {
      const role = getConversationRole(roleNode);
      const surface = getConversationMessageSurface(roleNode, role);
      if (!(surface instanceof Element)) continue;

      if (role === 'user') {
        surface.classList.add('bravefox-user-message-surface');
        surface.classList.remove('bravefox-assistant-message-surface');
        paintConversationSurface(surface, 'user');
      } else if (role === 'assistant') {
        surface.classList.add('bravefox-assistant-message-surface');
        surface.classList.remove('bravefox-user-message-surface');
        paintConversationSurface(surface, 'assistant');
      }

      applyConversationMessageMetadata(roleNode, role, surface);
    }
  }

  function mayContainConversationMessage(scope) {
    if (!(scope instanceof Element)) return false;

    if (
      scope.matches(
        '[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]'
      ) ||
      scope.closest(
        '[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]'
      ) ||
      scope.querySelector(
        '[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]'
      )
    ) {
      return true;
    }

    const selector = [
      '[data-message-author-role="user"]',
      '[data-message-author-role="assistant"]',
      '[data-role="user"]',
      '[data-role="assistant"]',
      '[data-message-author="user"]',
      '[data-message-author="assistant"]',
      'section[data-turn="user"]',
      'section[data-turn="assistant"]',
      'article[data-turn="user"]',
      'article[data-turn="assistant"]',
      '[data-testid^="conversation-turn-"]',
      '.user-turn',
      '.agent-turn'
    ].join(', ');

    if (scope.matches(selector)) return true;
    if (scope.closest(selector)) return true;
    return Boolean(scope.querySelector(selector));
  }

  function cleanChatGptUi(scope = document) {
    applyGoogleOnlyLoginPolicy(scope);
    applyAccountAndSettingsCleanup(scope);
    hideNewSidebarControls(scope);
    collapseAnalysisActivityPanels(scope);
    applyConversationPresentation(scope);
    replaceCustomizableAssistantErrorText(scope);
    replaceCustomizableHomeHeadline(scope);
    replaceCustomizableChatGptBannerText(scope);
    replaceFixedAssistantNoticeText(scope);
    polishSidebarNavigation();
    maintainSidebarStageReveal(scope);
    removePluginFeaturedPromo(scope);
    enforceAllExactReasoningControls(scope);
    enforceThinkingEffortEdges(scope);
    forEachMatch(scope, 'div[role="menuitem"]', item => {
      const firstLine = normalizeText(String(item.textContent || '').split('\n')[0]);
      if (MODELS_TO_REMOVE.has(firstLine)) item.remove();
    });

    hideElementsBySelectorAndText(
      scope,
      'button[type="button"].flex.items-center.gap-1.bg-transparent',
      'hanki plus'
    );
    hideElementsBySelectorAndText(scope, 'div.truncate[dir="auto"]', 'free', true);
    hideElementsBySelectorAndText(
      scope,
      'div.flex.items-center.gap-1.text-sm.font-semibold.opacity-70',
      'muisti täynnä'
    );
  }

  function hideElementsBySelectorAndText(scope, selector, expectedText, exact = false) {
    forEachMatch(scope, selector, element => {
      const text = normalizeText(element.textContent);
      const matches = exact ? text === expectedText : text.includes(expectedText);
      if (matches) hideElement(element);
    });
  }


  // === Library protected-folder guard ==========================================
  // "Protected Files" is a hard exclusion from Library selection. The native
  // checkbox stays technically operable so this script can undo React's bulk
  // "Select all" state, while human pointer/keyboard interaction is blocked in
  // capture phase. Items inside the folder cannot be bulk-selected. In Safe Mode,
  // each file's native three-dot menu exposes only "Discuss this". A separate
  // OpenIV-style Edit Mode requires a fresh password and temporarily restores the
  // full native per-file menu until the user exits the folder, reloads, or locks it.
  const LIBRARY_CHECKABLE_SELECTOR = 'input[type="checkbox"], [role="checkbox"], [aria-checked="true"], [aria-checked="false"]';
  const LIBRARY_SELECT_ALL_LABELS = new Set(['select all', 'valitse kaikki']);
  const LIBRARY_HEADER_NAME_LABELS = new Set(['nimi', 'name']);
  const LIBRARY_HEADER_META_LABELS = new Set(['muokattu', 'modified', 'koko', 'size']);
  const LIBRARY_DELETE_LABELS = new Set(['delete', 'remove', 'poista']);
  const LIBRARY_DISCUSS_LABELS = new Set([
    'keskustele tästä',
    'keskustele tasta',
    'discuss this',
    'chat about this'
  ]);
  const LIBRARY_GUARD_ATTR = 'data-bravefox-library-protected';
  const LIBRARY_GUARD_STYLE_ID = 'bravefox-library-protected-style';
  const LIBRARY_MENU_HIDDEN_ATTR = 'data-bravefox-protected-menu-hidden';
  const LIBRARY_MENU_READY_ATTR = 'data-bravefox-protected-menu-ready';
  const LIBRARY_FOLDER_MENU_HIDDEN_ATTR = 'data-bravefox-protected-folder-menu-hidden';
  const LIBRARY_MENU_OPENING_CLASS = 'bravefox-protected-menu-opening';
  const LIBRARY_EDIT_MODE_BUTTON_ID = 'bravefox-protected-library-edit-mode-button';
  const LIBRARY_EDIT_MODE_BUTTON_ATTR = 'data-bravefox-edit-mode-active';

  let libraryGuardObserver = null;
  let libraryGuardTimer = 0;
  let libraryGuardBypassDepth = 0;
  let libraryDeleteReplayDepth = 0;
  let protectedLibraryLastMenuIdentity = null;
  let libraryGuardLastHref = location.href;

  function isChatGptLibraryLocation() {
    return location.pathname.toLowerCase().startsWith('/library');
  }

  function normalizedLibraryLabel(element) {
    if (!(element instanceof Element)) return '';
    return normalizeText(
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.textContent ||
      ''
    );
  }

  function hasExactProtectedFolderText(root) {
    if (!(root instanceof Element)) return false;
    const wanted = normalizeText(LIBRARY_PROTECTED_FOLDER_NAME);
    if (root.children.length === 0 && normalizeText(root.textContent) === wanted) return true;
    for (const element of root.querySelectorAll('span, div, p, strong, a, button')) {
      if (element.children.length !== 0) continue;
      if (normalizeText(element.textContent) === wanted) return true;
    }
    return false;
  }

  function elementMentionsProtectedFolderId(root) {
    if (!(root instanceof Element)) return false;
    if (String(root.getAttribute('href') || '').includes(LIBRARY_PROTECTED_FOLDER_ID)) return true;
    return !!root.querySelector(`a[href*="${LIBRARY_PROTECTED_FOLDER_ID}"]`);
  }

  function findLibraryItemContainer(control) {
    if (!(control instanceof Element)) return null;

    let element = control;
    for (let depth = 0; depth < 9 && element; depth += 1, element = element.parentElement) {
      if (!(element instanceof Element)) break;

      const semanticItem = element.matches(
        'tr, li, article, [role="row"], [data-testid*="library-item"], [data-testid*="file"], [data-testid*="folder"]'
      );
      const checkboxCount = element.querySelectorAll(LIBRARY_CHECKABLE_SELECTOR).length;
      const protectedIdentity = hasExactProtectedFolderText(element) || elementMentionsProtectedFolderId(element);

      if (semanticItem && checkboxCount <= 4) return element;
      if (protectedIdentity && checkboxCount > 0 && checkboxCount <= 4) return element;
    }
    return null;
  }

  function isLibrarySelectAllControl(control) {
    if (!(control instanceof Element)) return false;

    const candidates = [
      control,
      control.closest('label'),
      control.closest('button'),
      control.closest('[role="columnheader"]')
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (LIBRARY_SELECT_ALL_LABELS.has(normalizedLibraryLabel(candidate))) return true;
    }

    // 2026 Library revamp: the master checkbox can be icon-only with no accessible
    // "Select all" text on the checkbox itself. Recognize the header row instead.
    let node = control.parentElement;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      const text = normalizeText(node.textContent);
      if (!text || text.length > 220) continue;
      const words = text.split(/[^a-z0-9äöå]+/).filter(Boolean);
      const hasName = words.some(word => LIBRARY_HEADER_NAME_LABELS.has(word));
      const hasMeta = words.some(word => LIBRARY_HEADER_META_LABELS.has(word));
      const headerLike =
        node.matches?.('thead, [role="row"], [role="columnheader"]') ||
        Boolean(node.querySelector?.('[role="columnheader"]'));
      if (hasName && hasMeta && headerLike) return true;
    }

    return false;
  }

  function getOrdinaryLibraryCheckableControls() {
    return getLibraryCheckableControls().filter(control => {
      if (!(control instanceof Element) || !control.isConnected) return false;
      if (isLibrarySelectAllControl(control)) return false;
      if (isProtectedLibraryControl(control)) return false;
      if (control.hasAttribute('disabled') || normalizeText(control.getAttribute('aria-disabled')) === 'true') {
        return false;
      }

      // Only operate on actual Library item controls, never unrelated toggles that
      // happen to share aria-checked semantics elsewhere on the page.
      return Boolean(findLibraryItemContainer(control));
    });
  }

  function applyOrdinaryLibrarySelectionState(checked) {
    const controls = getOrdinaryLibraryCheckableControls();
    if (!controls.length) return false;

    let changed = false;
    libraryGuardBypassDepth += 1;
    try {
      for (const control of controls) {
        if (!(control instanceof HTMLElement) || !control.isConnected) continue;
        if (libraryControlIsChecked(control) === !!checked) continue;
        try {
          control.click();
          changed = true;
        } catch {}
      }
    } finally {
      libraryGuardBypassDepth -= 1;
    }

    return changed;
  }

  function activateSafeLibrarySelectAll() {
    const ordinary = getOrdinaryLibraryCheckableControls();
    if (!ordinary.length) return;

    const allOrdinaryChecked = ordinary.every(libraryControlIsChecked);
    const desired = !allOrdinaryChecked;

    // React can remount list rows while selection changes. Re-query on each short pass
    // so "Select all" never gets a window to pull Protected Files into the selection.
    for (const delay of [0, 16, 50, 120]) {
      window.setTimeout(() => {
        applyOrdinaryLibrarySelectionState(desired);
        reconcileProtectedLibrarySelection();
      }, delay);
    }
  }

  function isInsideProtectedLibraryFolder() {
    if (!isChatGptLibraryLocation()) return false;
    if (getProtectedRouteDescriptor()?.key === 'library-protected-files') return true;
    if (location.href.includes(LIBRARY_PROTECTED_FOLDER_ID)) return true;

    // Fallback for route shapes that do not expose the folder id in the URL.
    for (const element of document.querySelectorAll('h1, h2, [aria-current="page"], nav [aria-current], [data-testid*="breadcrumb"]')) {
      if (normalizeText(element.textContent) === normalizeText(LIBRARY_PROTECTED_FOLDER_NAME)) return true;
    }
    return false;
  }

  function discoverProtectedLibraryDescendantLinks(scope = document) {
    if (!isInsideProtectedLibraryFolder()) return false;
    const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
    let changed = false;
    for (const anchor of root.querySelectorAll('a[href]')) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      let target = '';
      try {
        target = new URL(anchor.getAttribute('href') || '', location.href).href;
      } catch {
        continue;
      }
      if (rememberProtectedLibraryDescendantUrl(target)) changed = true;
    }
    return changed;
  }

  function findProtectedLibraryTitleElement() {
    if (!isInsideProtectedLibraryFolder()) return null;
    const wanted = normalizeText(LIBRARY_PROTECTED_FOLDER_NAME);
    const selectors = 'h1, h2, h3, [aria-current="page"], [data-testid*="breadcrumb"], nav span, nav div, span, strong';
    for (const element of document.querySelectorAll(selectors)) {
      if (!(element instanceof HTMLElement)) continue;
      if (element.children.length !== 0) continue;
      if (normalizeText(element.textContent) !== wanted) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      return element;
    }

    // Descendant folders have their own title instead of the literal "Protected Files"
    // breadcrumb. Keep Edit Mode available throughout the protected subtree by anchoring
    // to the first visible page-level heading/current breadcrumb in that lane.
    for (const element of document.querySelectorAll('h1, h2, h3, [aria-current="page"], [data-testid*="breadcrumb"]')) {
      if (!(element instanceof HTMLElement)) continue;
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 180) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      return element;
    }
    return null;
  }

  function updateProtectedLibraryEditModeButton() {
    const button = document.getElementById(LIBRARY_EDIT_MODE_BUTTON_ID);
    if (!(button instanceof HTMLButtonElement)) return;
    const active = !!protectedLibraryEditMode;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.setAttribute(LIBRARY_EDIT_MODE_BUTTON_ATTR, active ? 'true' : 'false');
    button.textContent = active ? 'Read only mode' : 'Edit mode';
    button.title = active
      ? 'Return Protected Files to read-only mode'
      : 'Enter password to enable editing';
  }

  function setProtectedLibraryEditMode(active) {
    const next = !!active && isInsideProtectedLibraryFolder() && protectedRouteUnlocked;
    protectedLibraryEditMode = next;
    document.documentElement.classList.toggle(LIBRARY_EDIT_MODE_CLASS, next);
    document.documentElement.classList.remove(LIBRARY_MENU_OPENING_CLASS);

    // Undo any Safe-Mode menu pruning immediately when Edit Mode turns on.
    if (next) {
      for (const action of document.querySelectorAll(`[${LIBRARY_MENU_HIDDEN_ATTR}="true"]`)) {
        action.removeAttribute(LIBRARY_MENU_HIDDEN_ATTR);
      }
      for (const root of document.querySelectorAll(`[${LIBRARY_MENU_READY_ATTR}="true"]`)) {
        root.removeAttribute(LIBRARY_MENU_READY_ATTR);
      }
    }

    updateProtectedLibraryEditModeButton();
    scheduleProtectedLibraryReconcileBurst();
  }

  function enableProtectedLibraryEditMode() {
    if (!isInsideProtectedLibraryFolder() || !protectedRouteUnlocked) return;
    setProtectedLibraryEditMode(true);
  }

  function disableProtectedLibraryEditMode() {
    setProtectedLibraryEditMode(false);
  }

  async function requestProtectedLibraryEditMode() {
    if (!isInsideProtectedLibraryFolder() || !protectedRouteUnlocked) return;
    if (protectedLibraryEditMode) {
      disableProtectedLibraryEditMode();
      return;
    }

    if (TEMP_DISABLE_ALL_PASSWORD_PROMPTS) {
      // Diagnostic build only. When the master switch is restored to false, Edit Mode
      // again requires its dedicated library-edit-mode password grant below.
      enableProtectedLibraryEditMode();
      return;
    }

    await beginNativePasswordFlow({
      kind: 'library-edit-mode',
      routeKey: 'library-protected-files',
      title: LIBRARY_PROTECTED_EDIT_MODE_PROMPT,
      returnUrl: location.href,
      payload: {}
    });
  }

  function positionProtectedLibraryEditModeButton(button, title) {
    if (!(button instanceof HTMLButtonElement) || !(title instanceof HTMLElement)) return;
    const rect = title.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const buttonRect = button.getBoundingClientRect();
    const buttonHeight = buttonRect.height > 0 ? buttonRect.height : 32;
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const left = Math.min(Math.max(8, rect.right + 12), Math.max(8, viewportWidth - Math.max(buttonRect.width, 96) - 12));
    const top = Math.max(8, rect.top + ((rect.height - buttonHeight) / 2));

    button.style.left = `${Math.round(left)}px`;
    button.style.top = `${Math.round(top)}px`;
  }

  function clearProtectedLibraryTransientUi() {
    const button = document.getElementById(LIBRARY_EDIT_MODE_BUTTON_ID);
    if (button) button.remove();

    protectedLibraryEditMode = false;
    protectedLibraryLastMenuIdentity = null;
    document.documentElement.classList.remove(LIBRARY_EDIT_MODE_CLASS);
    document.documentElement.classList.remove(LIBRARY_MENU_OPENING_CLASS);

    // A Radix/portal file menu can briefly outlive the Library route that created it.
    // Remove only transient per-file pruning markers here. The root Protected Files
    // folder-menu marker is a separate permanent guard and must survive this cleanup.
    for (const element of document.querySelectorAll(
      `[${LIBRARY_MENU_HIDDEN_ATTR}], [${LIBRARY_MENU_READY_ATTR}]`
    )) {
      element.removeAttribute(LIBRARY_MENU_HIDDEN_ATTR);
      element.removeAttribute(LIBRARY_MENU_READY_ATTR);
    }
  }

  function cleanupProtectedLibraryUiOutsideFolder() {
    if (isInsideProtectedLibraryFolder()) return false;
    clearProtectedLibraryTransientUi();
    return true;
  }

  function ensureProtectedLibraryEditModeButton() {
    let button = document.getElementById(LIBRARY_EDIT_MODE_BUTTON_ID);
    if (!isInsideProtectedLibraryFolder() || !protectedRouteUnlocked) {
      clearProtectedLibraryTransientUi();
      return;
    }

    const title = findProtectedLibraryTitleElement();
    if (!title) {
      if (button) button.style.visibility = 'hidden';
      return;
    }

    if (!(button instanceof HTMLButtonElement) || !button.isConnected) {
      button = document.createElement('button');
      button.id = LIBRARY_EDIT_MODE_BUTTON_ID;
      button.type = 'button';
      button.className = 'bravefox-protected-library-edit-mode-button';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        void requestProtectedLibraryEditMode();
      });

      // Keep our control outside ChatGPT's React-owned tree. Injecting custom
      // siblings into the breadcrumb can make the Library remount into skeletons.
      (document.body || document.documentElement).appendChild(button);
    }

    updateProtectedLibraryEditModeButton();
    button.style.visibility = 'visible';
    positionProtectedLibraryEditModeButton(button, title);
  }

  function isProtectedLibraryControl(control) {
    if (!(control instanceof Element) || !isChatGptLibraryLocation()) return false;
    if (isLibrarySelectAllControl(control)) return false;

    if (isInsideProtectedLibraryFolder()) return true;

    const item = findLibraryItemContainer(control);
    if (item && (hasExactProtectedFolderText(item) || elementMentionsProtectedFolderId(item))) {
      return true;
    }

    // Revamped list rows are mostly anonymous divs. Walk a little farther and accept
    // only a bounded ancestor that contains the Protected Files identity and a small
    // number of checkables; the full Library list contains far more and is rejected.
    let node = control.parentElement;
    for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
      const checkboxCount = node.querySelectorAll?.(LIBRARY_CHECKABLE_SELECTOR)?.length || 0;
      if (checkboxCount > 8) break;
      if (
        checkboxCount > 0 &&
        (hasExactProtectedFolderText(node) || elementMentionsProtectedFolderId(node))
      ) {
        return true;
      }
    }

    return false;
  }

  function libraryControlIsChecked(control) {
    if (!(control instanceof Element)) return false;
    if (control instanceof HTMLInputElement && control.type === 'checkbox') return control.checked;
    if (normalizeText(control.getAttribute('aria-checked')) === 'true') return true;
    if (normalizeText(control.getAttribute('data-state')) === 'checked') return true;
    return false;
  }

  function markProtectedLibraryControl(control) {
    if (!(control instanceof Element)) return;
    control.setAttribute(LIBRARY_GUARD_ATTR, 'true');
    control.setAttribute('data-bravefox-library-protected-title', 'Protected from Library deletion');
  }

  function clearProtectedLibraryControlMark(control) {
    if (!(control instanceof Element)) return;
    if (control.getAttribute(LIBRARY_GUARD_ATTR) !== 'true') return;
    control.removeAttribute(LIBRARY_GUARD_ATTR);
    control.removeAttribute('data-bravefox-library-protected-title');
  }

  function uncheckProtectedLibraryControl(control) {
    if (!(control instanceof HTMLElement) || !libraryControlIsChecked(control)) return false;

    libraryGuardBypassDepth += 1;
    try {
      // Use the site's own click handler so React's selection state is updated too.
      control.click();
    } catch {
      return false;
    } finally {
      libraryGuardBypassDepth -= 1;
    }
    return true;
  }

  function getLibraryCheckableControls() {
    return Array.from(document.querySelectorAll(LIBRARY_CHECKABLE_SELECTOR)).filter(element => element instanceof Element);
  }


  // === Library tab cleanup ======================================================
  // The native "All" tab is kept native and moved into the first slot. ChatGPT has
  // renamed the donor tab across UI generations (Recommended/Suositellut and now
  // Suggested/Ehdotetut); whichever variant exists is repurposed as Roskakori.
  const LIBRARY_RECOMMENDED_TAB_LABELS = new Set([
    'suositellut', 'recommended',
    'ehdotetut', 'suggested'
  ]);
  const LIBRARY_ALL_TAB_LABELS = new Set(['kaikki', 'all']);
  const LIBRARY_TAB_CONTEXT_LABELS = new Set([
    'suositellut', 'recommended',
    'ehdotetut', 'suggested',
    'suosikit', 'favorites',
    'kansiot', 'folders',
    'kuvat', 'images',
    'kaikki', 'all'
  ]);
  const LIBRARY_TRASH_TAB_ATTR = 'data-bravefox-library-trash-tab';
  const LIBRARY_ALL_TAB_ATTR = 'data-bravefox-library-all-tab';
  const LIBRARY_TRASH_VIEW_CLASS = 'bravefox-library-trash-view';
  let libraryDefaultAllNavigationHref = '';
  let libraryTabReconcileTimer = 0;

  function getLibraryTabControlLabel(control) {
    if (!(control instanceof Element)) return '';
    return normalizeText(control.textContent || control.getAttribute('aria-label') || '');
  }

  function countKnownLibraryTabs(root) {
    if (!(root instanceof Element)) return 0;
    const found = new Set();
    for (const control of root.querySelectorAll('a, button, [role="tab"]')) {
      const label = getLibraryTabControlLabel(control);
      if (LIBRARY_TAB_CONTEXT_LABELS.has(label)) found.add(label);
    }
    return found.size;
  }

  function findLibraryTabStrip() {
    const controls = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
    for (const control of controls) {
      if (!LIBRARY_ALL_TAB_LABELS.has(getLibraryTabControlLabel(control))) continue;
      let node = control.parentElement;
      for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
        if (countKnownLibraryTabs(node) >= 4) return node;
      }
    }
    return null;
  }

  function findLibraryTabControl(root, labels) {
    if (!(root instanceof Element)) return null;
    for (const control of root.querySelectorAll('a, button, [role="tab"]')) {
      if (labels.has(getLibraryTabControlLabel(control))) return control;
    }
    return null;
  }

  function directChildWithin(root, element) {
    if (!(root instanceof Element) || !(element instanceof Element)) return null;
    let node = element;
    while (node.parentElement && node.parentElement !== root) node = node.parentElement;
    return node.parentElement === root ? node : element;
  }

  function setLibraryAttributeIfChanged(element, name, value) {
    if (!(element instanceof Element)) return false;
    const next = String(value);
    if (element.getAttribute(name) === next) return false;
    element.setAttribute(name, next);
    return true;
  }

  function removeLibraryAttributeIfPresent(element, name) {
    if (!(element instanceof Element) || !element.hasAttribute(name)) return false;
    element.removeAttribute(name);
    return true;
  }

  function toggleLibraryClassIfChanged(element, className, enabled) {
    if (!(element instanceof Element)) return false;
    const hasClass = element.classList.contains(className);
    if (hasClass === !!enabled) return false;
    element.classList.toggle(className, !!enabled);
    return true;
  }

  function setLibraryTabText(control, text) {
    if (!(control instanceof Element)) return false;
    if (normalizeText(control.textContent) === normalizeText(text)) return false;

    const leaves = Array.from(control.querySelectorAll('span, div, p'))
      .filter(element => element.children.length === 0);
    const target = leaves.find(element =>
      LIBRARY_RECOMMENDED_TAB_LABELS.has(normalizeText(element.textContent))
    );

    if (target) {
      if (target.textContent === text) return false;
      target.textContent = text;
      return true;
    }

    // Never replace the full contents of a structured React tab after BraveFox has
    // already transformed it. Doing so on every observer pass was one source of the
    // Library reconciliation feedback loop.
    if (control.children.length === 0) {
      control.textContent = text;
      return true;
    }

    return false;
  }

  function scheduleLibraryTabReconcile(delay = 0) {
    if (libraryTabReconcileTimer) return;
    libraryTabReconcileTimer = window.setTimeout(() => {
      libraryTabReconcileTimer = 0;
      reconcileLibraryTabs();
    }, delay);
  }

  function currentLibraryIsTrashView() {
    if (location.pathname.replace(/\/+$/, '').toLowerCase() !== '/library') return false;
    try {
      return new URL(location.href).searchParams.get('deleted') === 'true';
    } catch {
      return false;
    }
  }

  function shouldDefaultLibraryToAll() {
    if (location.pathname.replace(/\/+$/, '').toLowerCase() !== '/library') return false;
    let url;
    try {
      url = new URL(location.href);
    } catch {
      return false;
    }
    if (url.searchParams.get('deleted') === 'true') return false;
    const tab = normalizeText(url.searchParams.get('tab'));
    return !tab || tab === 'recommended' || tab === 'suggested';
  }

  function reconcileLibraryTabs() {
    if (location.pathname.replace(/\/+$/, '').toLowerCase() !== '/library') {
      document.documentElement.classList.remove(LIBRARY_TRASH_VIEW_CLASS);
      return;
    }

    const strip = findLibraryTabStrip();
    if (!strip) return;

    const allControl = findLibraryTabControl(strip, LIBRARY_ALL_TAB_LABELS);
    let recommendedControl = strip.querySelector(`[${LIBRARY_TRASH_TAB_ATTR}="true"]`);
    if (!recommendedControl) recommendedControl = findLibraryTabControl(strip, LIBRARY_RECOMMENDED_TAB_LABELS);
    if (!(allControl instanceof Element) || !(recommendedControl instanceof Element)) return;

    setLibraryAttributeIfChanged(allControl, LIBRARY_ALL_TAB_ATTR, 'true');
    setLibraryAttributeIfChanged(recommendedControl, LIBRARY_TRASH_TAB_ATTR, 'true');
    setLibraryTabText(recommendedControl, 'Roskakori');

    const trashHref = new URL('/library?deleted=true', location.origin).href;
    if (recommendedControl instanceof HTMLAnchorElement) {
      if (recommendedControl.href !== trashHref) recommendedControl.href = trashHref;
    } else {
      setLibraryAttributeIfChanged(
        recommendedControl,
        'data-bravefox-library-trash-href',
        '/library?deleted=true'
      );
    }

    const allNode = directChildWithin(strip, allControl);
    const trashNode = directChildWithin(strip, recommendedControl);
    if (allNode && trashNode) {
      if (strip.firstElementChild !== allNode) strip.insertBefore(allNode, strip.firstElementChild);
      if (strip.lastElementChild !== trashNode) strip.appendChild(trashNode);
    }

    const trashView = currentLibraryIsTrashView();
    toggleLibraryClassIfChanged(document.documentElement, LIBRARY_TRASH_VIEW_CLASS, trashView);
    toggleLibraryClassIfChanged(recommendedControl, 'bravefox-library-trash-tab-active', trashView);

    if (trashView) {
      setLibraryAttributeIfChanged(recommendedControl, 'aria-current', 'page');
      setLibraryAttributeIfChanged(recommendedControl, 'aria-selected', 'true');
      setLibraryAttributeIfChanged(recommendedControl, 'data-state', 'active');
      removeLibraryAttributeIfPresent(allControl, 'aria-current');
      setLibraryAttributeIfChanged(allControl, 'aria-selected', 'false');
      if (allControl.getAttribute('data-state') === 'active') {
        setLibraryAttributeIfChanged(allControl, 'data-state', 'inactive');
      }
    } else {
      if (recommendedControl.getAttribute('aria-current') === 'page') {
        removeLibraryAttributeIfPresent(recommendedControl, 'aria-current');
      }
      setLibraryAttributeIfChanged(recommendedControl, 'aria-selected', 'false');
      if (recommendedControl.getAttribute('data-state') === 'active') {
        setLibraryAttributeIfChanged(recommendedControl, 'data-state', 'inactive');
      }
    }

    // Opening Library itself used to land on Recommended. Once the native All tab
    // exists, ask ChatGPT's own tab control to switch to All so its router/state stay
    // authoritative. A full navigation fallback covers layouts where .click() is ignored.
    if (shouldDefaultLibraryToAll() && libraryDefaultAllNavigationHref !== location.href) {
      libraryDefaultAllNavigationHref = location.href;
      const before = location.href;
      try {
        allControl.click();
      } catch {
        // Fall through to the navigation fallback below.
      }
      window.setTimeout(() => {
        if (location.href !== before || !shouldDefaultLibraryToAll()) return;
        location.replace(new URL('/library?tab=all', location.origin).href);
      }, 120);
    }
  }

  function handleLibraryTrashTabNavigation(event) {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest(`[${LIBRARY_TRASH_TAB_ATTR}="true"]`);
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const target = new URL('/library?deleted=true', location.origin).href;
    if (location.href !== target) location.assign(target);
  }

  function reconcileProtectedLibrarySelection() {
    libraryGuardTimer = 0;

    // The Edit Mode button lives outside ChatGPT's React tree so it cannot disturb
    // Library rendering. That also means React will never remove it for us. Always
    // perform route teardown before the early non-Library return.
    cleanupProtectedLibraryUiOutsideFolder();
    if (!isChatGptLibraryLocation()) return;

    reconcileLibraryTabs();
    discoverProtectedLibraryDescendantLinks(document);

    let changed = false;
    for (const control of getLibraryCheckableControls()) {
      if (isProtectedLibraryControl(control)) {
        markProtectedLibraryControl(control);
        if (libraryControlIsChecked(control)) changed = uncheckProtectedLibraryControl(control) || changed;
      } else {
        clearProtectedLibraryControlMark(control);
      }
    }

    hideProtectedLibraryFolderMenuTriggers();
    ensureProtectedLibraryEditModeButton();
    pruneProtectedLibraryFileMenus();
    if (changed) scheduleProtectedLibraryReconcileBurst();
  }

  function scheduleProtectedLibraryReconcile(delay = 0) {
    // Throttle instead of debounce. React can mutate the Library continuously while
    // loading skeleton rows; repeatedly cancelling this timer can starve the page.
    if (libraryGuardTimer) return;
    libraryGuardTimer = window.setTimeout(reconcileProtectedLibrarySelection, delay);
  }

  function scheduleProtectedLibraryReconcileBurst() {
    for (const delay of [0, 16, 50, 120, 250, 500, 900]) {
      window.setTimeout(reconcileProtectedLibrarySelection, delay);
    }
  }

  function protectedLibrarySelectionExists() {
    if (!isChatGptLibraryLocation()) return false;
    for (const control of getLibraryCheckableControls()) {
      if (isProtectedLibraryControl(control) && libraryControlIsChecked(control)) return true;
    }
    return false;
  }

  function findCheckableFromEventTarget(target) {
    if (!(target instanceof Element)) return null;
    if (target.matches(LIBRARY_CHECKABLE_SELECTOR)) return target;
    return target.closest(LIBRARY_CHECKABLE_SELECTOR);
  }

  function isLibraryDeleteAction(target) {
    if (!(target instanceof Element) || !isChatGptLibraryLocation()) return false;
    const action = target.closest('button, [role="button"], [role="menuitem"]');
    if (!action) return false;

    const label = normalizedLibraryLabel(action);
    if (LIBRARY_DELETE_LABELS.has(label)) return true;
    for (const word of LIBRARY_DELETE_LABELS) {
      if (label === word || label.startsWith(`${word} `)) return true;
    }
    return false;
  }

  function getLibraryItemLeafTexts(item) {
    if (!(item instanceof Element)) return [];
    const values = [];
    const seen = new Set();
    for (const element of item.querySelectorAll('a, span, p, strong, div')) {
      if (element.children.length !== 0) continue;
      const raw = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      const normalized = normalizeText(raw);
      if (!raw || !normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      values.push({ raw, normalized });
    }
    return values;
  }

  function looksLikeLibraryMetadataText(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    if (/^[.·•…⋯]+$/.test(text)) return true;
    if (/^\d{1,2}[.:]\d{2}(?::\d{2})?$/.test(text)) return true;
    if (/^\d+(?:[.,]\d+)?\s*(?:b|kb|mb|gb|tb|kt|mt|gt|tt)$/i.test(text)) return true;
    if (/^\d+(?:[.,]\d+)?$/.test(text)) return true;
    return false;
  }

  function getProtectedLibraryItemIdentity(item) {
    if (!(item instanceof Element)) return null;

    let href = '';
    for (const anchor of item.querySelectorAll('a[href]')) {
      try {
        const resolved = new URL(anchor.getAttribute('href'), location.href);
        if (resolved.origin !== location.origin) continue;
        href = resolved.href;
        if (resolved.pathname.toLowerCase().startsWith('/library')) break;
      } catch {
        // Ignore malformed hrefs and keep the text identity fallback.
      }
    }

    const leafTexts = getLibraryItemLeafTexts(item);
    const fileNameCandidate = leafTexts.find(({ raw, normalized }) =>
      raw.length <= 500 &&
      !looksLikeLibraryMetadataText(raw) &&
      !LIBRARY_DELETE_LABELS.has(normalized) &&
      !LIBRARY_SELECT_ALL_LABELS.has(normalized)
    );

    const fileName = String(fileNameCandidate?.raw || '').slice(0, 500);
    const rowText = String(item.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    if (!fileName && !href && !rowText) return null;

    return { fileName, href: String(href || '').slice(0, 1200), rowText };
  }

  function libraryItemMatchesIdentity(item, identity) {
    if (!(item instanceof Element) || !identity || typeof identity !== 'object') return false;

    const wantedHref = String(identity.href || '').trim();
    if (wantedHref) {
      for (const anchor of item.querySelectorAll('a[href]')) {
        try {
          if (new URL(anchor.getAttribute('href'), location.href).href === wantedHref) return true;
        } catch {
          // Keep trying text identity below.
        }
      }
    }

    const wantedName = normalizeText(identity.fileName || '');
    if (wantedName) {
      for (const candidate of getLibraryItemLeafTexts(item)) {
        if (candidate.normalized === wantedName) return true;
      }
    }

    const wantedRowText = normalizeText(identity.rowText || '');
    return !!wantedRowText && normalizeText(item.textContent) === wantedRowText;
  }

  function findProtectedLibraryItemContainer(element) {
    if (!(element instanceof Element)) return null;

    const semanticItem = findLibraryItemContainer(element);
    if (semanticItem) return semanticItem;
    if (!isInsideProtectedLibraryFolder()) return null;

    let current = element;
    for (let depth = 0; depth < 10 && current; depth += 1, current = current.parentElement) {
      if (!(current instanceof Element)) break;
      const checkboxCount = current.querySelectorAll(LIBRARY_CHECKABLE_SELECTOR).length;
      if (checkboxCount !== 1) continue;
      if (!String(current.textContent || '').trim()) continue;
      if (!current.querySelector('button, [role="button"]')) continue;
      return current;
    }
    return null;
  }

  function getProtectedLibraryItemContainers() {
    const items = [];
    const seen = new Set();
    for (const control of getLibraryCheckableControls()) {
      if (isLibrarySelectAllControl(control)) continue;
      const item = findProtectedLibraryItemContainer(control);
      if (!item || seen.has(item)) continue;
      seen.add(item);
      items.push(item);
    }
    return items;
  }

  function findProtectedLibraryItemByIdentity(identity) {
    if (!isInsideProtectedLibraryFolder()) return null;
    for (const item of getProtectedLibraryItemContainers()) {
      if (libraryItemMatchesIdentity(item, identity)) return item;
    }
    return null;
  }

  function isLikelyLibraryMenuTrigger(button, row = null) {
    if (!(button instanceof Element)) return false;
    const item = row || findLibraryItemContainer(button) || findProtectedLibraryItemContainer(button);
    if (!item) return false;
    if (findCheckableFromEventTarget(button)) return false;

    const hasPopup = normalizeText(button.getAttribute('aria-haspopup')) === 'menu';
    const label = normalizedLibraryLabel(button);
    if (hasPopup) return true;
    if (/(more|options|menu|lisää|lisaa|valikko)/.test(label)) return true;

    const buttons = Array.from(item.querySelectorAll('button, [role="button"]'))
      .filter(candidate => !findCheckableFromEventTarget(candidate));
    if (!buttons.length || buttons[buttons.length - 1] !== button) return false;

    const visibleText = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    return !visibleText || /^[.·•…⋯]+$/.test(visibleText) || !!button.querySelector('svg');
  }

  function protectedLibraryFolderItemFromElement(element) {
    if (!(element instanceof Element) || !isChatGptLibraryLocation() || isInsideProtectedLibraryFolder()) return null;
    const item = findLibraryItemContainer(element) || element.closest('tr, li, article, [role="row"]');
    if (!item) return null;
    return (hasExactProtectedFolderText(item) || elementMentionsProtectedFolderId(item)) ? item : null;
  }

  function isProtectedLibraryFolderMenuTrigger(target) {
    if (!(target instanceof Element) || !isChatGptLibraryLocation() || isInsideProtectedLibraryFolder()) return false;
    const button = target.closest('button, [role="button"]');
    if (!button) return false;
    if (button.getAttribute(LIBRARY_FOLDER_MENU_HIDDEN_ATTR) === 'true') return true;
    const item = protectedLibraryFolderItemFromElement(button);
    return !!item && isLikelyLibraryMenuTrigger(button, item);
  }

  function hideProtectedLibraryFolderMenuTriggers() {
    const hiddenSelector = `[${LIBRARY_FOLDER_MENU_HIDDEN_ATTR}="true"]`;
    if (!isChatGptLibraryLocation() || isInsideProtectedLibraryFolder()) {
      for (const button of document.querySelectorAll(hiddenSelector)) {
        button.removeAttribute(LIBRARY_FOLDER_MENU_HIDDEN_ATTR);
      }
      return;
    }

    for (const button of document.querySelectorAll(hiddenSelector)) {
      const item = protectedLibraryFolderItemFromElement(button);
      if (!item || !isLikelyLibraryMenuTrigger(button, item)) {
        button.removeAttribute(LIBRARY_FOLDER_MENU_HIDDEN_ATTR);
      }
    }

    for (const control of getLibraryCheckableControls()) {
      if (isLibrarySelectAllControl(control)) continue;
      const item = findLibraryItemContainer(control);
      if (!item || (!hasExactProtectedFolderText(item) && !elementMentionsProtectedFolderId(item))) continue;

      for (const button of item.querySelectorAll('button, [role="button"]')) {
        if (!isLikelyLibraryMenuTrigger(button, item)) continue;
        button.setAttribute(LIBRARY_FOLDER_MENU_HIDDEN_ATTR, 'true');
      }
    }
  }

  function isProtectedLibraryMenuTrigger(button, item = null) {
    if (!(button instanceof Element) || !isInsideProtectedLibraryFolder()) return false;
    const row = item || findProtectedLibraryItemContainer(button);
    return !!row && isLikelyLibraryMenuTrigger(button, row);
  }

  function isElementVisiblyRendered(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0;
  }

  function getProtectedLibraryIdentityNearMenuTrigger(button) {
    if (!(button instanceof Element) || !isInsideProtectedLibraryFolder()) return null;

    const buttonRect = button.getBoundingClientRect();
    if (buttonRect.width <= 0 || buttonRect.height <= 0) return null;
    const rowY = buttonRect.top + (buttonRect.height / 2);
    let best = null;

    for (const element of document.querySelectorAll('a, span, p, strong, div')) {
      if (!(element instanceof HTMLElement) || element.children.length !== 0 || !isElementVisiblyRendered(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left >= buttonRect.left - 8) continue;
      if (rowY < rect.top - 8 || rowY > rect.bottom + 8) continue;

      const raw = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      const normalized = normalizeText(raw);
      if (!raw || raw.length > 500 || looksLikeLibraryMetadataText(raw)) continue;
      if (normalized === normalizeText(LIBRARY_PROTECTED_FOLDER_NAME)) continue;
      if (normalized === 'nimi' || normalized === 'name' || normalized === 'muokattu' || normalized === 'modified' || normalized === 'koko' || normalized === 'size') continue;
      if (LIBRARY_DELETE_LABELS.has(normalized) || LIBRARY_DISCUSS_LABELS.has(normalized) || LIBRARY_SELECT_ALL_LABELS.has(normalized)) continue;

      const verticalDistance = Math.abs((rect.top + (rect.height / 2)) - rowY);
      const extensionBonus = /\.[a-z0-9]{1,12}(?:\s|$)/i.test(raw) ? 140 : (raw.includes('.') ? 55 : 0);
      const score = extensionBonus + Math.max(0, 70 - verticalDistance) + Math.min(35, raw.length / 8);
      if (!best || score > best.score) best = { element, raw, score };
    }

    if (!best) return null;

    let href = '';
    const anchor = best.element.closest('a[href]');
    if (anchor) {
      try {
        const resolved = new URL(anchor.getAttribute('href'), location.href);
        if (resolved.origin === location.origin) href = resolved.href;
      } catch {
        // Filename remains a sufficient identity fallback.
      }
    }

    return {
      fileName: best.raw.slice(0, 500),
      href: String(href || '').slice(0, 1200),
      rowText: best.raw.slice(0, 1200)
    };
  }

  function rememberProtectedLibraryMenuTarget(target) {
    if (!(target instanceof Element) || !isInsideProtectedLibraryFolder()) return;
    if (target.closest(`#${LIBRARY_EDIT_MODE_BUTTON_ID}`)) return;
    const button = target.closest('button, [role="button"]');
    if (!button) return;

    if (protectedLibraryEditMode) {
      document.documentElement.classList.remove(LIBRARY_MENU_OPENING_CLASS);
      return;
    }

    const geometricIdentity = getProtectedLibraryIdentityNearMenuTrigger(button);
    const item = findProtectedLibraryItemContainer(button);
    if (!geometricIdentity && (!item || !isProtectedLibraryMenuTrigger(button, item))) return;
    if (item && !isProtectedLibraryMenuTrigger(button, item) && !geometricIdentity) return;

    protectedLibraryLastMenuIdentity = geometricIdentity || getProtectedLibraryItemIdentity(item);
    if (protectedLibraryLastMenuIdentity) {
      document.documentElement.classList.add(LIBRARY_MENU_OPENING_CLASS);
      pruneProtectedLibraryFileMenus();
      window.setTimeout(pruneProtectedLibraryFileMenus, 0);
      window.setTimeout(pruneProtectedLibraryFileMenus, 30);
      window.setTimeout(() => {
        document.documentElement.classList.remove(LIBRARY_MENU_OPENING_CLASS);
      }, 700);
    }
  }

  function getExpandedProtectedLibraryMenuIdentity() {
    if (!isInsideProtectedLibraryFolder()) return null;
    if (protectedLibraryLastMenuIdentity) return protectedLibraryLastMenuIdentity;

    const triggers = document.querySelectorAll(
      'button[aria-haspopup="menu"][aria-expanded="true"], [role="button"][aria-haspopup="menu"][aria-expanded="true"]'
    );
    for (const trigger of triggers) {
      const identity = getProtectedLibraryIdentityNearMenuTrigger(trigger);
      if (identity) return identity;
      const item = findProtectedLibraryItemContainer(trigger);
      if (!item) continue;
      const itemIdentity = getProtectedLibraryItemIdentity(item);
      if (itemIdentity) return itemIdentity;
    }
    return null;
  }

  function getProtectedLibraryMenuAction(target) {
    if (!(target instanceof Element)) return null;
    return target.closest(
      '[role="menuitem"], [role="menu"] button, [data-radix-menu-content] button, [data-slot*="menu-content"] button'
    );
  }

  function getProtectedLibraryMenuRoot(action) {
    if (!(action instanceof Element)) return null;
    const direct = action.closest('[role="menu"], [data-radix-menu-content], [data-slot*="menu-content"]');
    if (direct) return direct;

    let current = action.parentElement;
    for (let depth = 0; depth < 7 && current; depth += 1, current = current.parentElement) {
      const actions = current.querySelectorAll('[role="menuitem"], button');
      if (actions.length >= 2 && actions.length <= 24) return current;
    }
    return null;
  }

  function getProtectedLibraryMenuActions(root) {
    if (!(root instanceof Element)) return [];
    return Array.from(root.querySelectorAll('[role="menuitem"], button'))
      .filter(action => action instanceof HTMLElement);
  }

  function protectedLibraryMenuRootHasDelete(root) {
    return getProtectedLibraryMenuActions(root).some(action => isLibraryDeleteAction(action));
  }

  function isProtectedLibraryDiscussAction(action) {
    if (!(action instanceof Element)) return false;
    const label = normalizedLibraryLabel(action);
    if (LIBRARY_DISCUSS_LABELS.has(label)) return true;
    return label.startsWith('keskustele tästä ') || label.startsWith('keskustele tasta ') ||
      label.startsWith('discuss this ') || label.startsWith('chat about this ');
  }

  function isAllowedProtectedLibraryMenuAction(action) {
    if (protectedLibraryEditMode) return true;
    return isProtectedLibraryDiscussAction(action);
  }

  function pruneProtectedLibraryFileMenus() {
    const hiddenSelector = `[${LIBRARY_MENU_HIDDEN_ATTR}="true"]`;
    const readySelector = `[${LIBRARY_MENU_READY_ATTR}="true"]`;
    if (!isInsideProtectedLibraryFolder() || protectedLibraryEditMode) {
      document.documentElement.classList.remove(LIBRARY_MENU_OPENING_CLASS);
      for (const action of document.querySelectorAll(hiddenSelector)) action.removeAttribute(LIBRARY_MENU_HIDDEN_ATTR);
      for (const root of document.querySelectorAll(readySelector)) root.removeAttribute(LIBRARY_MENU_READY_ATTR);
      return;
    }

    const roots = new Set();
    for (const deleteAction of document.querySelectorAll('[role="menuitem"], [role="menu"] button, [data-radix-menu-content] button, [data-slot*="menu-content"] button')) {
      if (!(deleteAction instanceof Element) || !isLibraryDeleteAction(deleteAction)) continue;
      const root = getProtectedLibraryMenuRoot(deleteAction);
      if (root) roots.add(root);
    }

    let preparedMenu = false;
    for (const root of roots) {
      if (!protectedLibraryMenuRootHasDelete(root)) continue;
      for (const action of getProtectedLibraryMenuActions(root)) {
        if (isAllowedProtectedLibraryMenuAction(action)) {
          action.removeAttribute(LIBRARY_MENU_HIDDEN_ATTR);
        } else {
          action.setAttribute(LIBRARY_MENU_HIDDEN_ATTR, 'true');
        }
      }
      root.setAttribute(LIBRARY_MENU_READY_ATTR, 'true');
      preparedMenu = true;
    }

    if (preparedMenu) {
      document.documentElement.classList.remove(LIBRARY_MENU_OPENING_CLASS);
    }
  }

  function isDisallowedProtectedLibraryMenuAction(target) {
    if (protectedLibraryEditMode) return false;
    if (!(target instanceof Element) || !isInsideProtectedLibraryFolder()) return false;
    const action = getProtectedLibraryMenuAction(target);
    if (!action) return false;
    const root = getProtectedLibraryMenuRoot(action);
    if (!root || !protectedLibraryMenuRootHasDelete(root)) return false;
    return !isAllowedProtectedLibraryMenuAction(action);
  }

  function isProtectedLibraryThreeDotDeleteAction(target) {
    if (!(target instanceof Element) || !isInsideProtectedLibraryFolder()) return false;
    const menuAction = getProtectedLibraryMenuAction(target);
    return !!menuAction && isLibraryDeleteAction(menuAction);
  }

  function findProtectedLibraryDeleteMenuItem() {
    const candidates = document.querySelectorAll('[role="menuitem"], [role="menu"] button, [data-radix-menu-content] button');
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue;
      if (!isLibraryDeleteAction(candidate)) continue;
      const style = getComputedStyle(candidate);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      return candidate;
    }
    return null;
  }

  function findProtectedLibraryMenuTriggerForItem(item) {
    if (!(item instanceof Element)) return null;
    const buttons = Array.from(item.querySelectorAll('button, [role="button"]'));
    for (const button of buttons) {
      if (isProtectedLibraryMenuTrigger(button, item)) return button;
    }
    return null;
  }

  function findProtectedLibraryFileNameElement(fileName) {
    const wanted = normalizeText(fileName || '');
    if (!wanted) return null;
    for (const element of document.querySelectorAll('a, span, p, strong, div')) {
      if (!(element instanceof HTMLElement) || element.children.length !== 0 || !isElementVisiblyRendered(element)) continue;
      if (normalizeText(element.textContent) === wanted) return element;
    }
    return null;
  }

  function findProtectedLibraryMenuTriggerNearFileName(fileName) {
    const nameElement = findProtectedLibraryFileNameElement(fileName);
    if (!nameElement) return null;

    const nameRect = nameElement.getBoundingClientRect();
    const rowY = nameRect.top + (nameRect.height / 2);
    let best = null;

    for (const button of document.querySelectorAll('button, [role="button"]')) {
      if (!(button instanceof HTMLElement) || !isElementVisiblyRendered(button)) continue;
      if (findCheckableFromEventTarget(button)) continue;
      const rect = button.getBoundingClientRect();
      if (rect.left <= nameRect.right) continue;
      const verticalDistance = Math.abs((rect.top + (rect.height / 2)) - rowY);
      if (verticalDistance > 28) continue;

      const label = normalizedLibraryLabel(button);
      const visibleText = String(button.textContent || '').replace(/\s+/g, ' ').trim();
      const popupBonus = normalizeText(button.getAttribute('aria-haspopup')) === 'menu' ? 180 : 0;
      const labelBonus = /(more|options|menu|lisää|lisaa|valikko)/.test(label) ? 120 : 0;
      const iconBonus = (!visibleText || /^[.·•…⋯]+$/.test(visibleText) || !!button.querySelector('svg')) ? 55 : 0;
      if (!popupBonus && !labelBonus && !iconBonus) continue;

      const score = popupBonus + labelBonus + iconBonus + Math.min(80, rect.left / 30) - verticalDistance;
      if (!best || score > best.score) best = { button, score };
    }
    return best?.button || null;
  }

  function findProtectedLibraryMenuTriggerForIdentity(identity) {
    if (!identity || typeof identity !== 'object') return null;

    const item = findProtectedLibraryItemByIdentity(identity);
    if (item) {
      const trigger = findProtectedLibraryMenuTriggerForItem(item);
      if (trigger) return trigger;
    }

    return findProtectedLibraryMenuTriggerNearFileName(String(identity.fileName || ''));
  }

  function clickProtectedLibraryDeleteAfterUnlock(identity, attempt = 0) {
    if (!isInsideProtectedLibraryFolder() || !protectedRouteUnlocked) return;

    const menuTrigger = findProtectedLibraryMenuTriggerForIdentity(identity);
    if (!menuTrigger) {
      if (attempt < 40) window.setTimeout(() => clickProtectedLibraryDeleteAfterUnlock(identity, attempt + 1), 125);
      return;
    }

    protectedLibraryLastMenuIdentity = identity;
    menuTrigger.click();

    let menuAttempt = 0;
    const replayDelete = () => {
      if (!isInsideProtectedLibraryFolder() || !protectedRouteUnlocked) return;
      const deleteItem = findProtectedLibraryDeleteMenuItem();
      if (!deleteItem) {
        menuAttempt += 1;
        if (menuAttempt < 30) window.setTimeout(replayDelete, 75);
        return;
      }

      libraryDeleteReplayDepth += 1;
      try {
        deleteItem.click();
      } finally {
        queueMicrotask(() => {
          libraryDeleteReplayDepth = Math.max(0, libraryDeleteReplayDepth - 1);
        });
      }
    };
    window.setTimeout(replayDelete, 0);
  }

  function resumeProtectedLibraryFileDelete(identity) {
    if (!identity || typeof identity !== 'object') return;
    clickProtectedLibraryDeleteAfterUnlock(identity, 0);
  }

  function passwordGateProtectedLibraryFileDelete(event) {
    if (TEMP_DISABLE_ALL_PASSWORD_PROMPTS) return false;

    if (
      libraryDeleteReplayDepth > 0 ||
      event.type !== 'click' ||
      !isInsideProtectedLibraryFolder() ||
      !isProtectedLibraryThreeDotDeleteAction(event.target)
    ) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const identity = getExpandedProtectedLibraryMenuIdentity();
    if (!identity) {
      console.warn('[BraveFox Enhancer] Protected Files delete blocked: file identity could not be determined.');
      return true;
    }

    void beginNativePasswordFlow({
      kind: 'library-file-delete',
      routeKey: 'library-protected-files',
      title: LIBRARY_PROTECTED_FILE_DELETE_PROMPT,
      returnUrl: location.href,
      payload: identity
    });
    return true;
  }

  function blockProtectedLibraryPointerEvent(event) {
    if (libraryGuardBypassDepth > 0 || !isChatGptLibraryLocation()) return;

    if (isProtectedLibraryFolderMenuTrigger(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      hideProtectedLibraryFolderMenuTriggers();
      return;
    }

    rememberProtectedLibraryMenuTarget(event.target);
    if (isDisallowedProtectedLibraryMenuAction(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      pruneProtectedLibraryFileMenus();
      return;
    }

    const control = findCheckableFromEventTarget(event.target);
    if (control && isLibrarySelectAllControl(control)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (isInsideProtectedLibraryFolder()) {
        scheduleProtectedLibraryReconcileBurst();
        return;
      }

      if (event.type === 'click') activateSafeLibrarySelectAll();
      return;
    }
    if (control && isProtectedLibraryControl(control)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      scheduleProtectedLibraryReconcileBurst();
      return;
    }

    // A delete action is blocked for this click if React has somehow left a protected
    // item selected. The guard first removes it; the user can then click Delete again
    // for the remaining ordinary selection. This closes the Select-All/delete race.
    if (isLibraryDeleteAction(event.target) && protectedLibrarySelectionExists()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      reconcileProtectedLibrarySelection();
      scheduleProtectedLibraryReconcileBurst();
      return;
    }

    const action = event.target instanceof Element
      ? event.target.closest('button, [role="button"], label')
      : null;
    if (action && LIBRARY_SELECT_ALL_LABELS.has(normalizedLibraryLabel(action))) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (isInsideProtectedLibraryFolder()) scheduleProtectedLibraryReconcileBurst();
      else if (event.type === 'click') activateSafeLibrarySelectAll();
    }
  }

  function blockProtectedLibraryKeyboardEvent(event) {
    if (libraryGuardBypassDepth > 0 || !isChatGptLibraryLocation()) return;

    if ((event.key === ' ' || event.key === 'Enter') && isProtectedLibraryFolderMenuTrigger(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      hideProtectedLibraryFolderMenuTriggers();
      return;
    }

    if ((event.key === ' ' || event.key === 'Enter') && isDisallowedProtectedLibraryMenuAction(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      pruneProtectedLibraryFileMenus();
      return;
    }

    const control = findCheckableFromEventTarget(event.target);
    if (
      control &&
      isLibrarySelectAllControl(control) &&
      (event.key === ' ' || event.key === 'Enter')
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (isInsideProtectedLibraryFolder()) scheduleProtectedLibraryReconcileBurst();
      else activateSafeLibrarySelectAll();
      return;
    }
    if (control && isProtectedLibraryControl(control) && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      scheduleProtectedLibraryReconcileBurst();
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && protectedLibrarySelectionExists()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      reconcileProtectedLibrarySelection();
      scheduleProtectedLibraryReconcileBurst();
    }
  }

  function ensureProtectedLibraryGuardStyle() {
    if (document.getElementById(LIBRARY_GUARD_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = LIBRARY_GUARD_STYLE_ID;
    style.textContent = `
      [${LIBRARY_GUARD_ATTR}="true"] {
        opacity: 0.38 !important;
        cursor: not-allowed !important;
      }

      [${LIBRARY_MENU_HIDDEN_ATTR}="true"],
      [${LIBRARY_FOLDER_MENU_HIDDEN_ATTR}="true"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      html.${LIBRARY_MENU_OPENING_CLASS} [role="menu"],
      html.${LIBRARY_MENU_OPENING_CLASS} [data-radix-menu-content],
      html.${LIBRARY_MENU_OPENING_CLASS} [data-slot*="menu-content"] {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }


      .bravefox-protected-library-edit-mode-button {
        appearance: none !important;
        position: fixed !important;
        z-index: 2147483000 !important;
        border: 1px solid rgba(0, 0, 0, 0.16) !important;
        border-radius: 8px !important;
        background: rgba(255, 255, 255, 0.96) !important;
        color: #111 !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        font: inherit !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        line-height: 1 !important;
        padding: 8px 11px !important;
        margin: 0 !important;
        cursor: pointer !important;
        white-space: nowrap !important;
      }

      .bravefox-protected-library-edit-mode-button:hover {
        background: rgba(0, 0, 0, 0.06) !important;
      }

      .bravefox-protected-library-edit-mode-button[${LIBRARY_EDIT_MODE_BUTTON_ATTR}="true"] {
        background: #111 !important;
        border-color: #111 !important;
        color: #fff !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function startProtectedLibraryGuard() {
    ensureProtectedLibraryGuardStyle();

    document.addEventListener('pointerdown', blockProtectedLibraryPointerEvent, true);
    document.addEventListener('mousedown', blockProtectedLibraryPointerEvent, true);
    document.addEventListener('click', handleLibraryTrashTabNavigation, true);
    document.addEventListener('click', blockProtectedLibraryPointerEvent, true);
    document.addEventListener('keydown', blockProtectedLibraryKeyboardEvent, true);
    window.addEventListener('resize', () => scheduleProtectedLibraryReconcile(32), { passive: true });
    window.addEventListener('scroll', () => scheduleProtectedLibraryReconcile(32), { capture: true, passive: true });

    libraryGuardObserver = new MutationObserver(mutations => {
      if (location.href !== libraryGuardLastHref) {
        libraryGuardLastHref = location.href;
        if (isChatGptLibraryLocation()) scheduleLibraryTabReconcile(0);
        scheduleProtectedLibraryReconcileBurst();
        return;
      }

      if (!isChatGptLibraryLocation()) return;

      // Ignore the tab-state attributes BraveFox itself maintains. Directly rewriting
      // tabs from inside this observer caused a React/MutationObserver feedback loop
      // after the Library revamp.
      let needsReconcile = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          needsReconcile = true;
          break;
        }

        if (mutation.type === 'attributes') {
          const target = mutation.target;
          const braveFoxTab =
            target instanceof Element &&
            (
              target.hasAttribute(LIBRARY_ALL_TAB_ATTR) ||
              target.hasAttribute(LIBRARY_TRASH_TAB_ATTR)
            );

          if (braveFoxTab && mutation.attributeName === 'data-state') continue;
          needsReconcile = true;
          break;
        }
      }

      if (!needsReconcile) return;
      scheduleLibraryTabReconcile(0);
      scheduleProtectedLibraryReconcile(24);
    });

    libraryGuardObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['checked', 'aria-checked', 'data-state']
    });

    // Route polling is intentionally tiny and covers SPA transitions where the DOM may
    // not mutate until after the URL has changed.
    window.setInterval(() => {
      if (location.href === libraryGuardLastHref) return;
      libraryGuardLastHref = location.href;
      if (isChatGptLibraryLocation()) scheduleLibraryTabReconcile(0);
      scheduleProtectedLibraryReconcileBurst();
    }, 350);

    scheduleProtectedLibraryReconcileBurst();
  }

  startProtectedLibraryGuard();

  console.log(
    `[BraveFox Enhancer] ChatGPT SPA/UI protection active (${IS_ANDROID ? 'Android-optimized' : 'desktop-optimized'}, low-overhead routing).`
  );
})();
