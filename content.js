(function () {
    'use strict';
    const TABLE_REGEX = /(input|output)/i;
    const NBSP_REGEX = /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;
    const GITHUB_REPOS = {
        'CPP': 'anvu17/PTIT-C-CPP',
        'C': 'anvu17/PTIT-C-CPP',
        'CTDL': 'anvu17/PTIT-DSA',
        'DSA': 'anvu17/PTIT-DSA'
    };
    const CPH_CONFIG = {
        group: "PTIT Code Helper",
        interactive: false,
        memoryLimit: 128,
        timeLimit: 1000,
        testType: "single",
        input: { type: "stdin" },
        output: { type: "stdout" },
        languages: { java: { mainClass: "Main", taskClass: null } }
    };
    const PROBLEM_ID = location.pathname.split('/').pop().toUpperCase();
    const SELECTOR_TITLE = ".submit__nav p span a.link--red";
    const SELECTOR_CONTENT = ".submit__des";
    const isProblemPage = () => !!document.querySelector(SELECTOR_CONTENT);
    chrome.storage.sync.get(DEFAULTS, (syncItems) => {
        chrome.storage.local.get(['pch_drafts'], (localItems) => {
            const items = { ...DEFAULTS, ...syncItems };
            const drafts = localItems.pch_drafts || {};
            if (items.pch_hide_chat) hideChat();
            if (items.pch_hide_banner) hideBanner();
            if (items.pch_hide_lectures) hideLectures();
            filterProblems();
            if (items.pch_autodelete_enabled) {
                chrome.storage.sync.get(['pch_autodelete_time', 'pch_autodelete_enabled'], (settings) => {
                    const cleaned = cleanExpiredDrafts(drafts, settings);
                    if (Object.keys(cleaned).length !== Object.keys(drafts).length) {
                        chrome.storage.local.set({ pch_drafts: cleaned });
                    }
                });
            }
            if (isProblemPage()) {
                const problemId = PROBLEM_ID;
                items.draftContent = drafts[problemId]?.content || "";
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("PCH_CONFIG", { detail: items }));
                }, PCH_CONFIG.EDITOR_INJECT_DELAY);
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
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
            setTimeout(() => {
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
    window.addEventListener("PCH_REQ_CLIPBOARD", () => {
        navigator.clipboard.readText()
            .then(text => {
                window.dispatchEvent(new CustomEvent("PCH_PASTE_DATA", { detail: text }));
            })
            .catch(err => {
                console.error("Clipboard read error:", err);
                alert("Không thể đọc bộ nhớ đệm!");
            });
    });
    const Analytics = self.Analytics;
    const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
            if (entry.duration > PCH_CONFIG.LONG_TASK_THRESHOLD) {
                Analytics.fireEvent('long_task_detected', {
                    duration_ms: Math.round(entry.duration),
                    page: location.pathname
                });
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
        brs.forEach(br => br.replaceWith('\n'));
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
            parts.push(`--- Output ---\n${t.output}\n`);
        });
        return parts.join('\n');
    }
    function injectPermanentCopyButtons() {
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            if (table.querySelector('.pch-copy-btn')) return;
            const headerCells = table.querySelectorAll('th, td');
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
            try {
                navigator.clipboard.writeText(generateProblemText());
                showFeedback(copyBtn);
            } catch (err) {
                console.error("Copy error:", err);
                alert("Không thể sao chép!");
            }
        };
        const dlBtn = document.createElement('span');
        dlBtn.className = 'pch-icon-btn';
        dlBtn.title = "Tải bài tập (.txt)";
        dlBtn.innerHTML = PCH_ICONS.download;
        dlBtn.onclick = () => {
            try {
                const text = generateProblemText();
                const info = getProblemInfo({ idFormat: 'UPPER', nameFormat: 'NONE' });
                downloadString(text, `${info.code}.txt`);
                showFeedback(dlBtn);
            } catch (err) {
                console.error("Download error:", err);
                alert("Không thể tải về!");
            }
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
        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Ensure filename is not empty after sanitization
        const finalFilename = sanitizedFilename || 'download.txt';
        
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFilename;
        a.click();
        URL.revokeObjectURL(url);
    }
    function getProblemDescription() {
        const container = document.querySelector(SELECTOR_CONTENT);
        if (!container) return "";
        const clone = container.cloneNode(true);
        const tables = clone.querySelectorAll('table');
        tables.forEach(t => {
            const text = t.innerText.toLowerCase();
            if (text.includes('input') || text.includes('output')) {
                t.remove();
            }
        });
        const paragraphs = clone.querySelectorAll('p, b, strong');
        paragraphs.forEach(p => {
            if (p.innerText.trim() === 'Ví dụ:') p.remove();
        });
        let text = clone.innerText;
        return text.replace(/\n\s*\n/g, '\n\n').trim();
    }
    function hideChat() {
        const css = `.chat__icon__wrapper, .chat__icon, #fb-root, .fb_dialog, iframe[title*="chat"] { display: none !important; }`;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
    function hideBanner() {
        const links = document.querySelectorAll('a');
        for (let a of links) {
            if (a.innerText.includes("THỬ NGHIỆM PHIÊN BẢN MỚI")) {
                const container = a.closest('div') || a;
                container.style.display = 'none';
                break;
            }
        }
    }
    function hideLectures() {
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            if (table.querySelector('a[href*="/student/unit/"]')) {
                table.style.display = 'none';
            }
        });
    }
    function filterProblems() {
        SYNC.get(['pch_only_wrong', 'pch_hide_ac'], (items) => {
            const rows = document.querySelectorAll('.ques__table tbody tr');
            if (!rows.length) return;
            const onlyWrong = items.pch_only_wrong;
            const hideAc = items.pch_hide_ac;
            rows.forEach(row => {
                row.style.display = '';
                if (onlyWrong) {
                    const isIncorrect = row.classList.contains('bg--50th');
                    if (!isIncorrect) {
                        row.style.display = 'none';
                    }
                } else if (hideAc) {
                    const isCorrect = row.classList.contains('bg--10th');
                    if (isCorrect) {
                        row.style.display = 'none';
                    }
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
        const problemId = PROBLEM_ID;
        const titleEl = document.querySelector(SELECTOR_TITLE);
        const fullTitle = titleEl ? titleEl.textContent : problemId;
        let nameRaw = fullTitle;
        if (fullTitle.includes('-')) {
            const parts = fullTitle.split('-');
            if (parts[0].trim().toUpperCase() === problemId) {
                nameRaw = parts.slice(1).join('-').trim();
            }
        }
        const idFormat = config?.idFormat || 'UPPER';
        const nameFormat = config?.nameFormat || 'NONE';
        let formattedId = '';
        if (idFormat === 'UPPER') {
            formattedId = problemId.toUpperCase();
        } else if (idFormat === 'LOWER') {
            formattedId = problemId.toLowerCase();
        }
        let formattedName = formatProblemName(nameRaw, nameFormat);
        let final = '';
        if (formattedId && formattedName) {
            final = `${formattedId}_${formattedName}`;
        } else if (formattedId) {
            final = formattedId;
        } else if (formattedName) {
            final = formattedName;
        } else {
            final = problemId.toUpperCase();
        }
        return { code: problemId.toUpperCase(), name: final, nameRaw, url: location.href };
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
        const tests = [];
        const tables = document.querySelectorAll('table');
        tables.forEach(t => {
            const headerCells = t.querySelectorAll('th, td');
            const targetCols = [];
            headerCells.forEach(cell => {
                if (TABLE_REGEX.test(cell.innerText)) {
                    targetCols.push(cell.cellIndex);
                }
            });
            if (targetCols.length >= 2) {
                const trs = t.querySelectorAll('tr');
                for (let i = 1; i < trs.length; i++) {
                    const row = trs[i];
                    if (row.cells.length > Math.max(...targetCols)) {
                        const inputCell = row.cells[targetCols[0]];
                        const outputCell = row.cells[targetCols[1]];
                        if (TABLE_REGEX.test(inputCell.innerText)) continue;
                        const input = getTextFromElement(inputCell);
                        const output = getTextFromElement(outputCell);
                        if (input || output) tests.push({ input, output });
                    }
                }
            }
        });
        return tests;
    }
    function sendToCPH() {
        return new Promise((resolve) => {
            SYNC.get(['pch_cph_id_format', 'pch_cph_name_format'], async (items) => {
                try {
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
                    const data = {
                        ...CPH_CONFIG,
                        name: info.name,
                        url: info.url,
                        tests: tests,
                        languages: {
                            ...CPH_CONFIG.languages,
                            java: { ...CPH_CONFIG.languages.java, taskClass: info.name }
                        }
                    };
                    const res = await chrome.runtime.sendMessage({
                        action: "sendToCPH",
                        data: data
                    });
                    if (!res || !res.success) {
                        alert("Không thể kết nối với CPH!");
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                } catch (e) {
                    console.error("CPH error:", e);
                    alert("Lỗi khi gửi đến CPH!");
                    resolve(false);
                }
            });
        });
    }
})();
