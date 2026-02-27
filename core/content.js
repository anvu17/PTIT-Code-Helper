(function () {
    'use strict';
    const TABLE_REGEX = /(?:\b(?:input|output|in|out|giải thích)\b|\.(?:inp?|out?))/i;
    const NBSP_REGEX = /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;
    const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
    const GITHUB_REPOS = {
        'CPP': 'anvu17/PTIT-C-CPP',
        'C': 'anvu17/PTIT-C-CPP',
        'CTDL': 'anvu17/PTIT-DSA',
        'DSA': 'anvu17/PTIT-DSA'
    };
    const CPH_CONFIG = {
        group: 'PTIT Code Helper',
        interactive: false,
        memoryLimit: 128,
        timeLimit: 1000,
        testType: 'single',
        input: { type: 'stdin' },
        output: { type: 'stdout' },
        languages: { java: { mainClass: 'Main', taskClass: null } }
    };
    const PROBLEM_ID = location.pathname.split('/').pop();
    const SELECTOR_TITLE = '.submit__nav p span a.link--red';
    const SELECTOR_CONTENT = '.submit__des';
    const isProblemPage = () => !!document.querySelector(SELECTOR_CONTENT);
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
            if (items.pch_hide_chat) hideChat();
            if (items.pch_hide_banner) hideBanner();
            if (items.pch_hide_lectures) hideLectures();
            if (items.pch_hide_contest_banner) hideContestBanner();
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
                configTimeout = setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("PCH_CONFIG", { detail: items }));
                }, PCH_CONFIG.EDITOR_INJECT_DELAY);
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    init();
                    Analytics.fireEvent('page_view', { page_location: location.href });
                });
            } else {
                init();
                Analytics.fireEvent('page_view', { page_location: location.href });
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
            if (changes.pch_only_wrong || changes.pch_hide_ac) {
                filterProblems();
            }
        }
    });
    function init() {
        injectPermanentCopyButtons();
        injectTitleButtons();
        checkUpdate();
        if (isProblemPage()) {
            parsingTimeout = setTimeout(() => {
                const description = getProblemDescription();
                const tests = getTests();
                if (!description) {
                    Analytics.fireErrorEvent({
                        message: 'Parsing failed: Description not found',
                        problem_id: PROBLEM_ID
                    });
                }
                if (!tests || tests.length === 0) {
                    Analytics.fireErrorEvent({
                        message: 'Parsing failed: No test cases found',
                        problem_id: PROBLEM_ID
                    });
                }
            }, PCH_CONFIG.PARSING_CHECK_DELAY);
        }
    }
    window.addEventListener('PCH_REQ_CLIPBOARD', () => {
        navigator.clipboard.readText()
            .then(text => {
                window.dispatchEvent(new CustomEvent('PCH_PASTE_DATA', { detail: text }));
            })
            .catch(() => alert('Không thể đọc bộ nhớ đệm!'));
    });
    const Analytics = self.Analytics;
    let longTaskCount = 0;
    const MAX_LONG_TASK_EVENTS = 50;
    const observer = new PerformanceObserver((list) => {
        if (longTaskCount >= MAX_LONG_TASK_EVENTS) return;
        list.getEntries().forEach((entry) => {
            if (entry.duration > PCH_CONFIG.LONG_TASK_THRESHOLD && longTaskCount < MAX_LONG_TASK_EVENTS) {
                longTaskCount++;
                Analytics.fireEvent('long_task_detected', {
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
        Analytics.fireErrorEvent({
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? event.error.toString() : ''
        });
    });
    window.addEventListener('unhandledrejection', (event) => {
        Analytics.fireEvent('js_unhandled_rejection', {
            reason: event.reason ? event.reason.toString() : 'Unknown'
        });
    });
    window.addEventListener('PCH_ANALYTICS', (e) => {
        const { name, params } = e.detail;
        if (name) {
            Analytics.fireEvent(name, params || {});
        }
    });
    function getTextFromElement(element) {
        if (!element) return "";
        const clone = element.cloneNode(true);
        const brs = clone.querySelectorAll('br');
        return clone.innerText.replace(NBSP_REGEX, " ")
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }
    function generateProblemText() {
        const info = getProblemInfo({ idFormat: 'UPPER', nameFormat: 'NONE' });
        const tests = getTests();
        const parts = [
            `PROBLEM: ${info.code} - ${info.nameRaw}`,
            `URL: ${info.url}\n`,
            `DESCRIPTION:`,
            getProblemDescription() + '\n'
        ];
        tests.forEach((t, i) => {
            parts.push(`[TEST ${i + 1}]`);
            parts.push(`--- Input ---\n${t.input}\n`);
            if (t.output) parts.push(`--- Output ---\n${t.output}\n`);
            if (t.explanation) parts.push(`--- Explanation ---\n${t.explanation}\n`);
        });
        parts.push(`Extracted with PTIT Code Helper - https://anvu.web.app/pch`);
        return parts.join('\n');
    }
    function injectPermanentCopyButtons() {
        const tables = document.querySelectorAll('table:not([data-pch-processed])');
        tables.forEach(table => {
            if (!table.rows || table.rows.length === 0) return;
            const headerCells = table.rows[0].querySelectorAll('th, td');
            const targetCols = [];
            headerCells.forEach(cell => {
                if (TABLE_REGEX.test(cell.innerText)) {
                    targetCols.push(cell.cellIndex);
                }
            });
            if (targetCols.length > 0) {
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    targetCols.forEach(colIndex => {
                        if (row.cells.length > colIndex) {
                            const cell = row.cells[colIndex];
                            if (TABLE_REGEX.test(cell.innerText)) return;
                            if (cell.querySelector('.pch-copy-btn')) return;
                            cell.style.position = 'relative';
                            const btn = document.createElement('span');
                            btn.className = 'pch-copy-btn';
                            btn.title = "Copy content";
                            btn.innerHTML = PCH_ICONS.copy;
                            btn.onclick = (e) => {
                                e.stopPropagation(); e.preventDefault();
                                const text = getTextFromElement(cell);
                                navigator.clipboard.writeText(text);
                                showFeedback(btn);
                            };
                            cell.appendChild(btn);
                        }
                    });
                });
                table.dataset.pchProcessed = 'true';
            }
        });
    }
    function injectTitleButtons() {
        const titleEl = document.querySelector(SELECTOR_TITLE);
        if (!titleEl) return;
        const parent = titleEl.parentNode;
        if (parent.querySelector('.pch-title-actions')) return;
        const container = document.createElement('span');
        container.className = 'pch-title-actions';
        const copyBtn = document.createElement('span');
        copyBtn.className = 'pch-icon-btn';
        copyBtn.title = "Sao chép bài tập";
        copyBtn.innerHTML = PCH_ICONS.copy;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(generateProblemText());
            showFeedback(copyBtn);
        };
        const dlBtn = document.createElement('span');
        dlBtn.className = 'pch-icon-btn';
        dlBtn.title = "Tải bài tập (.txt)";
        dlBtn.innerHTML = PCH_ICONS.download;
        dlBtn.onclick = () => {
            const text = generateProblemText();
            const info = getProblemInfo({ idFormat: 'UPPER', nameFormat: 'NONE' });
            downloadString(text, `${info.code}.txt`);
            showFeedback(dlBtn);
        };
        const cphBtn = document.createElement('span');
        cphBtn.className = 'pch-icon-btn';
        cphBtn.title = "Nhập vào CPH";
        cphBtn.innerHTML = PCH_ICONS.cph;
        cphBtn.onclick = async () => {
            const original = cphBtn.innerHTML;
            cphBtn.innerHTML = PCH_ICONS.loading;
            const success = await sendToCPH();
            if (success) {
                cphBtn.innerHTML = PCH_ICONS.check_green;
                setTimeout(() => cphBtn.innerHTML = original, 1500);
            } else {
                cphBtn.innerHTML = original;
                Analytics.fireEvent('cph_failed', { problem_id: PROBLEM_ID });
            }
        };
        container.appendChild(copyBtn);
        container.appendChild(dlBtn);
        container.appendChild(cphBtn);
        const problemId = PROBLEM_ID;
        const prefixes = Object.keys(GITHUB_REPOS).sort((a, b) => b.length - a.length);
        const matchedPrefix = prefixes.find(prefix => problemId.startsWith(prefix));
        if (matchedPrefix) {
            const ghBtn = document.createElement('span');
            ghBtn.className = 'pch-icon-btn';
            ghBtn.title = "Tìm bài giải mẫu (GitHub)";
            ghBtn.innerHTML = PCH_ICONS.github;
            ghBtn.onclick = () => {
                window.open(`https://github.com/${GITHUB_REPOS[matchedPrefix]}/search?q=${problemId}`, '_blank');
            };
            container.appendChild(ghBtn);
        }
        parent.appendChild(container);
    }
    function downloadString(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    const QUERY_CACHE = {
        titleEl: null,
        descriptionContainer: null
    };

    function getProblemDescription() {
        if (!QUERY_CACHE.descriptionContainer) {
            QUERY_CACHE.descriptionContainer = document.querySelector(SELECTOR_CONTENT);
        }
        const container = QUERY_CACHE.descriptionContainer;
        if (!container) return "";
        const clone = container.cloneNode(true);
        Array.from(clone.querySelectorAll('table')).forEach(t => {
            if (!t.rows || t.rows.length === 0) return;
            const hasTarget = Array.from(t.rows[0].querySelectorAll('th, td')).some(cell => TABLE_REGEX.test(cell.innerText));
            if (hasTarget) t.remove();
        });
        Array.from(clone.querySelectorAll('p, b, strong')).forEach(p => {
            if (p.innerText.trim() === 'Ví dụ:') p.remove();
        });
        const text = clone.innerText;
        return text.replace(NBSP_REGEX, ' ')
            .replace(ZERO_WIDTH_REGEX, '')
            .split('\n')
            .map(line => line.trimEnd())
            .filter((line, index, arr) => line !== '' || (index > 0 && arr[index - 1] !== ''))
            .join('\n')
            .replace(/\n{2,}/g, '\n\n')
            .trim();
    }
    function hideChat() {
        injectCSS('.chat__icon__wrapper, .chat__icon, #fb-root, .fb_dialog, iframe[title*="chat"] { display: none !important; }');
    }
    function hideBanner() {
        document.querySelectorAll('.username.container-fluid a[href^="/beta"]').forEach(a => {
            const container = a.closest('.username.container-fluid');
            if (container) container.style.setProperty('display', 'none', 'important');
        });
    }
    function hideContestBanner() {
        document.querySelectorAll('.username.container-fluid #timeleft').forEach(el => {
            const container = el.closest('.username.container-fluid');
            if (container) container.style.setProperty('display', 'none', 'important');
        });
    }
    function injectCSS(cssText) {
        let styleEl = document.getElementById('pch-injected-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'pch-injected-styles';
            document.head.appendChild(styleEl);
        }
        try {
            styleEl.sheet.insertRule(cssText, styleEl.sheet.cssRules.length);
        } catch (e) {
            styleEl.textContent += cssText + '\n';
        }
    }
    function hideLectures() {
        document.querySelectorAll('table a[href*="/student/unit/"]').forEach(a => {
            const table = a.closest('table');
            if (table) table.style.display = 'none';
        });
    }
    let cachedRowsList = null;
    function filterProblems() {
        SYNC.get(['pch_only_wrong', 'pch_hide_ac'], (items) => {
            if (!cachedRowsList) {
                cachedRowsList = Array.from(document.querySelectorAll('.ques__table tbody tr'));
            }
            if (!cachedRowsList.length) return;
            const onlyWrong = items.pch_only_wrong;
            const hideAc = items.pch_hide_ac;
            cachedRowsList.forEach(row => {
                row.style.display = '';
                if (onlyWrong && !row.classList.contains('bg--50th')) {
                    row.style.display = 'none';
                } else if (hideAc && row.classList.contains('bg--10th')) {
                    row.style.display = 'none';
                }
            });
        });
    }
    function checkUpdate() {
        checkForUpdate('pch_dismissed_version_web', showUpdatePopup);
    }
    function showUpdatePopup(info) {
        const div = document.createElement('div');
        div.className = 'pch-update-popup';
        div.innerHTML = `
            <div class="pch-update-header">
                <div class="pch-update-title">PTIT Code Helper v${info.version}</div>
                ${info.release_date ? `
                <div class="pch-update-date">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${info.release_date}</span>
                </div>` : ''}
                <div class="pch-update-close">&times;</div>
            </div>
            <div class="pch-update-content">
                ${info.changelog}
            </div>
            <a href="${info.url}" target="_blank" class="pch-update-link">Tải xuống ngay</a>
        `;
        document.body.appendChild(div);
        const closeBtn = div.querySelector('.pch-update-close');
        const close = () => {
            div.style.animation = 'slideIn 0.5s reverse';
            setTimeout(() => div.remove(), 450);
            SYNC.set({ pch_dismissed_version_web: info.version });
        };
        closeBtn.onclick = close;
        setTimeout(close, 15000);
    }
    function getProblemInfo(config) {
        if (!QUERY_CACHE.titleEl) {
            QUERY_CACHE.titleEl = document.querySelector(SELECTOR_TITLE);
        }
        const titleEl = QUERY_CACHE.titleEl;
        const fullTitle = titleEl ? titleEl.textContent : PROBLEM_ID;
        let nameRaw = fullTitle;
        if (fullTitle.includes('-')) {
            const parts = fullTitle.split('-');
            if (parts[0].trim().toUpperCase() === PROBLEM_ID.toUpperCase()) {
                nameRaw = parts.slice(1).join('-').trim();
            }
        }
        const idFormat = config?.idFormat || 'UPPER';
        const nameFormat = config?.nameFormat || 'NONE';
        const formattedId = idFormat === 'UPPER' ? PROBLEM_ID.toUpperCase() : idFormat === 'LOWER' ? PROBLEM_ID.toLowerCase() : '';
        const formattedName = formatProblemName(nameRaw, nameFormat);

        const final = formattedId && formattedName ? `${formattedId}_${formattedName}`
            : formattedId || formattedName || PROBLEM_ID.toUpperCase();

        return { code: PROBLEM_ID.toUpperCase(), name: final, nameRaw, url: location.href };
    }
    function formatProblemName(nameRaw, format) {
        if (format === 'NONE') return '';
        const normalized = nameRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const words = normalized.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/);
        if (format === 'UPPER') return words.join('_').toUpperCase();
        if (format === 'LOWER') return words.join('_').toLowerCase();
        if (format === 'CAMEL') return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        if (format === 'PASCAL') return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        if (format === 'SNAKE') return words.join('_').toLowerCase();
        return '';
    }
    function getTests() {
        return Array.from(document.querySelectorAll('table')).reduce((tests, t) => {
            if (!t.rows || t.rows.length === 0) return tests;
            const headerCells = Array.from(t.rows[0].querySelectorAll('th, td'));
            const targetCols = headerCells.reduce((acc, cell) => {
                if (TABLE_REGEX.test(cell.innerText)) acc.push(cell.cellIndex);
                return acc;
            }, []);

            if (targetCols.length >= 2) {
                const trs = Array.from(t.querySelectorAll('tr')).slice(1);
                const maxColIndex = Math.max(...targetCols.slice(0, 2));

                trs.forEach(row => {
                    if (row.cells.length > maxColIndex) {
                        const inputCell = row.cells[targetCols[0]];
                        const outputCell = row.cells[targetCols[1]];
                        const explanationCell = targetCols[2] !== undefined ? row.cells[targetCols[2]] : null;

                        if (!TABLE_REGEX.test(inputCell.innerText)) {
                            const input = getTextFromElement(inputCell);
                            const output = getTextFromElement(outputCell);
                            const explanation = explanationCell ? getTextFromElement(explanationCell) : "";

                            if (input || output) tests.push({ input, output, explanation });
                        }
                    }
                });
            }
            return tests;
        }, []);
    }
    function sendToCPH() {
        return new Promise((resolve) => {
            SYNC.get(['pch_cph_id_format', 'pch_cph_name_format'], async (items) => {
                const config = {
                    idFormat: items.pch_cph_id_format || 'UPPER',
                    nameFormat: items.pch_cph_name_format || 'NONE'
                };
                const info = getProblemInfo(config);
                const tests = getTests();
                if (!tests.length) {
                    alert('Không tìm thấy test case!');
                    resolve(false);
                    return;
                }
                const cphName = PROBLEM_ID.length > 10
                    ? `CONTEST_${PROBLEM_ID.slice(0, 3).toUpperCase()}`
                    : info.name;
                const data = {
                    ...CPH_CONFIG,
                    name: cphName,
                    url: info.url,
                    tests: tests,
                    languages: {
                        ...CPH_CONFIG.languages,
                        java: { ...CPH_CONFIG.languages.java, taskClass: cphName }
                    }
                };
                try {
                    const res = await chrome.runtime.sendMessage({
                        action: 'sendToCPH',
                        data: data
                    });
                    if (!res || !res.success) {
                        alert('Không thể kết nối với CPH!');
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                } catch (e) {
                    resolve(false);
                }
            });
        });
    }
})();
