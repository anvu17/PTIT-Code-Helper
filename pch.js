const PCH_CONFIG = {
    EDITOR_INJECT_DELAY: 500,
    PARSING_CHECK_DELAY: 2000,
    LONG_TASK_THRESHOLD: 50,
    MEMORY_WARNING_THRESHOLD: 70,
    FEEDBACK_DURATION: 1500
};
const PCH_ICONS = {
    check_green: `<svg viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    check_white: `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    cph: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.15 2.587L18.21.22a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>`,
    loading: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`,
    github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg>`
};
const DEFAULTS = {
    'pch_editor_enabled': true,
    'pch_hide_chat': false,
    'pch_hide_banner': false,
    'pch_hide_lectures': false,
    'pch_hide_ac': false,
    'pch_only_wrong': false,
    'pch_cph_id_format': 'UPPER',
    'pch_cph_name_format': 'NONE',
    'pch_autosave_enabled': true,
    'pch_autosave_mode': 'interval',
    'pch_autosave_interval': 15,
    'pch_autodelete_time': 24,
    'pch_autodelete_enabled': true
};
const VERSION = chrome.runtime.getManifest().version;
const FEEDBACK_URL = `https://anvu.web.app/pch/feedback?version=${VERSION}`;
if (typeof window !== 'undefined') {
    window.PCH_CONFIG = PCH_CONFIG;
    window.PCH_ICONS = PCH_ICONS;
    window.DEFAULTS = DEFAULTS;
    window.VERSION = VERSION;
    window.FEEDBACK_URL = FEEDBACK_URL;
    if (typeof chrome !== 'undefined' && chrome.storage) {
        window.SYNC = chrome.storage.sync;
        window.LOCAL = chrome.storage.local;
    }
}
function showFeedback(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = PCH_ICONS.check_green;
    setTimeout(() => btn.innerHTML = original, PCH_CONFIG.FEEDBACK_DURATION);
}
function toggleClass(element, className, show) {
    if (show) {
        element.classList.remove(className);
    } else {
        element.classList.add(className);
    }
}
function cleanExpiredDrafts(drafts, settings) {
    if (settings.pch_autodelete_enabled === false) return drafts;
    const HOURS = settings.pch_autodelete_time || 24;
    const EXPIRATION = HOURS * 60 * 60 * 1000;
    const now = Date.now();
    Object.keys(drafts).forEach(problemId => {
        if (now - drafts[problemId].timestamp > EXPIRATION) {
            delete drafts[problemId];
        }
    });
    return drafts;
}
function checkForUpdate(storageKey, onUpdateFound) {
    chrome.runtime.sendMessage({ action: "checkUpdate" }, (response) => {
        if (!response || response.error) return;
        const current = response.current;
        const remote = response.remote;
        SYNC.get([storageKey], (items) => {
            const dismissedVersion = items[storageKey] || '';
            if (remote.version !== current && remote.version !== dismissedVersion) {
                onUpdateFound(remote);
            }
        });
    });
}
if (typeof window !== 'undefined') {
    window.showFeedback = showFeedback;
    window.toggleClass = toggleClass;
    window.cleanExpiredDrafts = cleanExpiredDrafts;
    window.checkForUpdate = checkForUpdate;
}
