(function () {
    'use strict';

    const DEFAULTS = {
        'pch_editor_enabled': true,
        'pch_hide_chat': false,
        'pch_hide_banner': false,
        'pch_hide_lectures': false,
        'pch_hide_ac': false,
        'pch_only_wrong': false,
        'pch_cph_id_format': 'UPPER',
        'pch_cph_name_format': 'NONE',
        'pch_disable_autosave': false,
        'pch_autosave_interval': 15,
        'pch_autosave_on_change': false,
        'pch_autodelete_time': 24,
        'pch_autodelete_enabled': true
    };

    const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const CPH_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.15 2.587L18.21.22a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>`;
    const GITHUB_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`;

    const TABLE_REGEX = /^\s*(input|output)\s*[:.]?\s*$/i;
    const NBSP_REGEX = /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;

    const isProblemPage = () => !!document.querySelector('.submit__des') || !!document.querySelector('.problem-content');

    chrome.storage.sync.get(DEFAULTS, (syncItems) => {
        chrome.storage.local.get(['pch_drafts'], (localItems) => {
            const items = { ...syncItems };
            const drafts = localItems.pch_drafts || {};

            if (items.pch_hide_chat) hideChat();
            if (items.pch_hide_banner) hideBanner();
            if (items.pch_hide_lectures) hideLectures();
            filterProblems();

            if (items.pch_autodelete_enabled) {
                const HOURS = items.pch_autodelete_time || 24;
                const EXPIRATION = HOURS * 60 * 60 * 1000;
                const now = Date.now();
                let changed = false;

                Object.keys(drafts).forEach(key => {
                    if (now - drafts[key].timestamp > EXPIRATION) {
                        delete drafts[key];
                        changed = true;
                    }
                });

                if (changed) chrome.storage.local.set({ pch_drafts: drafts });
            }

            if (isProblemPage()) {
                const problemId = location.pathname.split('/').pop().toUpperCase();
                items.draftContent = drafts[problemId]?.content || "";

                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("PCH_CONFIG", { detail: items }));
                }, 500);
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

                if (settings.pch_autodelete_enabled !== false) {
                    const HOURS = settings.pch_autodelete_time || 24;
                    const EXPIRATION = HOURS * 60 * 60 * 1000;
                    const now = Date.now();

                    Object.keys(drafts).forEach(key => {
                        if (now - drafts[key].timestamp > EXPIRATION) {
                            delete drafts[key];
                        }
                    });
                }

                chrome.storage.local.set({ pch_drafts: drafts });
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
    }

    window.addEventListener("PCH_REQ_CLIPBOARD", () => {
        navigator.clipboard.readText()
            .then(text => {
                window.dispatchEvent(new CustomEvent("PCH_PASTE_DATA", { detail: text }));
            })
            .catch(err => alert("Không thể đọc bộ nhớ đệm!"));
    });



    function showFeedback(btn) {
        const original = btn.innerHTML;
        btn.innerHTML = CHECK_ICON;
        setTimeout(() => btn.innerHTML = original, 1500);
    }

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
                            btn.innerHTML = COPY_ICON;

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
        const titleEl = document.querySelector(".submit__nav p span a.link--red") || document.querySelector("h3.font-medium");
        if (!titleEl) return;

        const parent = titleEl.parentNode;
        if (parent.querySelector('.pch-title-actions')) return;

        const container = document.createElement('span');
        container.className = 'pch-title-actions';

        const copyBtn = document.createElement('span');
        copyBtn.className = 'pch-icon-btn';
        copyBtn.title = "Sao chép bài tập";
        copyBtn.innerHTML = COPY_ICON;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(generateProblemText());
            showFeedback(copyBtn);
        };

        const dlBtn = document.createElement('span');
        dlBtn.className = 'pch-icon-btn';
        dlBtn.title = "Tải bài tập (.txt)";
        dlBtn.innerHTML = DOWNLOAD_ICON;
        dlBtn.onclick = () => {
            const text = generateProblemText();
            const info = getProblemInfo({ idFormat: 'UPPER', nameFormat: 'NONE' });
            downloadString(text, `${info.code}.txt`);
            showFeedback(dlBtn);
        };

        const cphBtn = document.createElement('span');
        cphBtn.className = 'pch-icon-btn';
        cphBtn.title = "Nhập vào CPH";
        cphBtn.innerHTML = CPH_ICON;
        cphBtn.onclick = async () => {
            const original = cphBtn.innerHTML;
            cphBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
            const success = await sendToCPH();
            if (success) {
                cphBtn.innerHTML = CHECK_ICON;
                setTimeout(() => cphBtn.innerHTML = original, 1500);
            } else {
                cphBtn.innerHTML = original;
            }
        };

        container.appendChild(copyBtn);
        container.appendChild(dlBtn);
        container.appendChild(cphBtn);

        const problemId = location.pathname.split('/').pop().toUpperCase();
        const githubRepos = {
            'CPP': 'anvu17/PTIT-C-CPP',
            'C': 'anvu17/PTIT-C-CPP',
            'CTDL': 'anvu17/PTIT-DSA',
            'DSA': 'anvu17/PTIT-DSA'
        };

        const prefixes = Object.keys(githubRepos).sort((a, b) => b.length - a.length);
        const matchedPrefix = prefixes.find(prefix => problemId.startsWith(prefix));

        if (matchedPrefix) {
            const ghBtn = document.createElement('span');
            ghBtn.className = 'pch-icon-btn';
            ghBtn.title = "Tìm bài giải mẫu (GitHub)";
            ghBtn.innerHTML = GITHUB_ICON;
            ghBtn.onclick = () => {
                window.open(`https://github.com/${githubRepos[matchedPrefix]}/search?q=${problemId}`, '_blank');
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

    function getProblemDescription() {
        const container = document.querySelector('.submit__des') || document.querySelector('.problem-content');
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
        chrome.storage.sync.get(['pch_only_wrong', 'pch_hide_ac'], (items) => {
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

    function checkForUpdate(storageKey, onUpdateFound) {
        chrome.runtime.sendMessage({ action: "checkUpdate" }, (response) => {
            if (!response || response.error) return;

            const current = response.current;
            const remote = response.remote;

            chrome.storage.sync.get([storageKey], (items) => {
                const dismissedVersion = items[storageKey] || '';

                if (remote.version !== current && remote.version !== dismissedVersion) {
                    onUpdateFound(remote);
                }
            });
        });
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
            chrome.storage.sync.set({ pch_dismissed_version_web: info.version });
        };

        closeBtn.onclick = close;

        setTimeout(close, 15000);
    }

    function getProblemInfo(config) {
        const problemId = location.pathname.split('/').pop().toUpperCase();
        const titleEl = document.querySelector(".submit__nav p span a.link--red") || document.querySelector("h3.font-medium");
        const fullTitle = titleEl ? titleEl.textContent : problemId;

        let nameRaw = fullTitle;
        if (fullTitle.includes('-')) {
            const parts = fullTitle.split('-');
            if (parts[0].trim().toUpperCase() === problemId.toUpperCase()) {
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

        let formattedName = '';
        if (nameFormat !== 'NONE') {
            const normalized = nameRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const words = normalized.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/);

            if (nameFormat === 'UPPER') {
                formattedName = words.join('_').toUpperCase();
            } else if (nameFormat === 'LOWER') {
                formattedName = words.join('_').toLowerCase();
            } else if (nameFormat === 'CAMEL') {
                formattedName = words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            } else if (nameFormat === 'PASCAL') {
                formattedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            } else if (nameFormat === 'SNAKE') {
                formattedName = words.join('_').toLowerCase();
            }
        }

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
            chrome.storage.sync.get(['pch_cph_id_format', 'pch_cph_name_format'], async (items) => {
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
                    name: info.name,
                    group: "PTIT Code Helper",
                    url: info.url,
                    interactive: false,
                    memoryLimit: 128,
                    timeLimit: 1000,
                    tests: tests,
                    testType: "single",
                    input: { type: "stdin" },
                    output: { type: "stdout" },
                    languages: { java: { mainClass: "Main", taskClass: info.name } }
                };

                try {
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
                    resolve(false);
                }
            });
        });
    }
})();
