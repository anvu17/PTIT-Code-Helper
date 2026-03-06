(function () {
    'use strict';

    let configTimeout = null;
    let parsingTimeout = null;
    window.addEventListener('beforeunload', () => {
        if (configTimeout) clearTimeout(configTimeout);
        if (parsingTimeout) clearTimeout(parsingTimeout);
    });



    chrome.storage.sync.get(DEFAULTS, (syncItems) => {
        chrome.storage.local.get(['pch_drafts'], (localItems) => {
            const items = { ...DEFAULTS, ...syncItems };
            const drafts = localItems.pch_drafts || {};

            injectCSS(`
                body.pch-hide-chat .chat__icon__wrapper, body.pch-hide-chat .chat__icon, body.pch-hide-chat #fb-root, body.pch-hide-chat .fb_dialog, body.pch-hide-chat iframe[title*="chat"] { display: none !important; }
                body.pch-hide-beta-banner .username.container-fluid:has(a[href^="/beta"]) { display: none !important; }
                body.pch-hide-contest-banner .username.container-fluid:has(#timeleft) { display: none !important; }
                body.pch-hide-lectures table:has(a[href*="/student/unit/"]) { display: none !important; }
            `);

            if (items.pch_hide_chat) document.body.classList.add('pch-hide-chat');
            if (items.pch_hide_beta_banner) document.body.classList.add('pch-hide-beta-banner');
            if (items.pch_hide_lectures) document.body.classList.add('pch-hide-lectures');
            if (items.pch_hide_contest_banner) document.body.classList.add('pch-hide-contest-banner');
            filterProblems();

            if (items.pch_autodelete_enabled) {
                const cleaned = cleanExpiredDrafts(drafts, {
                    pch_autodelete_time: items.pch_autodelete_time,
                    pch_autodelete_enabled: items.pch_autodelete_enabled
                });
                if (Object.keys(cleaned).length !== Object.keys(drafts).length) {
                    chrome.storage.local.set({ pch_drafts: cleaned });
                }
            }
            if (isProblemPage()) {
                const problemId = PROBLEM_ID;
                items.draftContent = drafts[problemId]?.content || "";
                runWhenReady('.monaco-editor, .CodeMirror, #editor, .submit__des', () => {
                    window.dispatchEvent(new CustomEvent("PCH_CONFIG", { detail: items }));
                }, PCH_CONFIG.EDITOR_INJECT_DELAY);
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    init();
                    window.Analytics.fireEvent('page_view', { page_location: location.href });
                });
            } else {
                init();
                window.Analytics.fireEvent('page_view', { page_location: location.href });
            }
        });
    });
    window.addEventListener('PCH_SAVE_DRAFT', (e) => {
        const { problemId, content } = e.detail;
        if (!problemId || !content) return;
        chrome.storage.local.get(['pch_drafts'], (result) => {
            chrome.storage.sync.get(['pch_autodelete_time', 'pch_autodelete_enabled'], (settings) => {
                const drafts = result.pch_drafts || {};
                drafts[problemId] = {
                    content: content,
                    timestamp: Date.now()
                };
                const cleaned = cleanExpiredDrafts(drafts, settings);
                chrome.storage.local.set({ pch_drafts: cleaned });
            });
        });
    });
    window.addEventListener('PCH_DELETE_DRAFT', (e) => {
        const { problemId } = e.detail;
        if (!problemId) return;
        chrome.storage.local.get(['pch_drafts'], (result) => {
            const drafts = result.pch_drafts || {};
            delete drafts[problemId];
            chrome.storage.local.set({ pch_drafts: drafts });
        });
    });
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            if (changes.pch_only_wrong || changes.pch_hide_ac) filterProblems();

            if (changes.pch_infinite_scroll) {
                infiniteScrollEnabled = changes.pch_infinite_scroll.newValue === true;
                if (infiniteScrollEnabled) {
                    window.addEventListener('scroll', debouncedHandleScroll);
                } else {
                    window.removeEventListener('scroll', debouncedHandleScroll);
                }
            }
            if (changes.pch_hide_chat) document.body.classList.toggle('pch-hide-chat', changes.pch_hide_chat.newValue);
            if (changes.pch_hide_beta_banner) document.body.classList.toggle('pch-hide-beta-banner', changes.pch_hide_beta_banner.newValue);
            if (changes.pch_hide_lectures) document.body.classList.toggle('pch-hide-lectures', changes.pch_hide_lectures.newValue);
            if (changes.pch_hide_contest_banner) document.body.classList.toggle('pch-hide-contest-banner', changes.pch_hide_contest_banner.newValue);
        }
    });

    function init() {
        injectPermanentCopyButtons();
        injectTitleButtons();
        fetchAndShowNotifications();
        if (isProblemPage()) {
            runWhenReady('.submit__des', () => {
                const description = getProblemDescription();
                const tests = getTests();
                if (!description) window.Analytics.fireErrorEvent({ message: 'Parsing failed: Description not found', problem_id: PROBLEM_ID });
                if (!tests || tests.length === 0) window.Analytics.fireErrorEvent({ message: 'Parsing failed: No test cases found', problem_id: PROBLEM_ID });
            }, PCH_CONFIG.PARSING_CHECK_DELAY);
        }
        initInfiniteScroll();
    }
    window.addEventListener('PCH_REQ_CLIPBOARD', () => {
        navigator.clipboard.readText()
            .then(text => {
                window.dispatchEvent(new CustomEvent('PCH_PASTE_DATA', { detail: text }));
            })
            .catch(() => showToast('Không thể đọc bộ nhớ đệm!', 'error'));
    });
    const Analytics = window.Analytics;
    let longTaskCount = 0;
    const MAX_LONG_TASK_EVENTS = 50;
    const observer = new PerformanceObserver((list) => {
        if (longTaskCount >= MAX_LONG_TASK_EVENTS) return;
        list.getEntries().forEach((entry) => {
            if (entry.duration > PCH_CONFIG.LONG_TASK_THRESHOLD && longTaskCount < MAX_LONG_TASK_EVENTS) {
                longTaskCount++;
                window.Analytics.fireEvent('long_task_detected', {
                    duration_ms: Math.round(entry.duration),
                    page: location.pathname
                });
                if (longTaskCount >= MAX_LONG_TASK_EVENTS) {
                    observer.disconnect();
                }
            }
        });
    });
    observer.observe({ entryTypes: ['longtask'] });
    window.addEventListener('error', (event) => {
        window.Analytics.fireErrorEvent({
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? event.error.toString() : ''
        });
    });
    window.addEventListener('unhandledrejection', (event) => {
        window.Analytics.fireEvent('js_unhandled_rejection', {
            reason: event.reason ? event.reason.toString() : 'Unknown'
        });
    });
    window.addEventListener('PCH_ANALYTICS', (e) => {
        const { name, params } = e.detail;
        if (name) {
            window.Analytics.fireEvent(name, params || {});
        }
    });
    window.addEventListener('PCH_SHOW_TOAST', (e) => {
        const { message, type } = e.detail;
        if (message) showToast(message, type);
    });

})();
