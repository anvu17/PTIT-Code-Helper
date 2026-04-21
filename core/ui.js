window.injectPermanentCopyButtons = function injectPermanentCopyButtons() {
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
                        cell.appendChild(btn);
                    }
                });
            });
            table.dataset.pchProcessed = 'true';
            table.addEventListener('click', (e) => {
                const btn = e.target.closest('.pch-copy-btn');
                if (!btn || !table.contains(btn)) return;
                e.stopPropagation(); e.preventDefault();
                const text = getTextFromElement(btn.parentElement);
                navigator.clipboard.writeText(text);
                showFeedback(btn);
            });
        }
    });
}

window.injectTitleButtons = function injectTitleButtons() {
    const titleEl = document.querySelector(window.SELECTOR_TITLE);
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
        window.navigator.clipboard.writeText(window.generateProblemText());
        showFeedback(copyBtn);
    };
    const dlBtn = document.createElement('span');
    dlBtn.className = 'pch-icon-btn';
    dlBtn.title = "Tải bài tập (.txt)";
    dlBtn.innerHTML = PCH_ICONS.download;
    dlBtn.onclick = () => {
        const text = window.generateProblemText();
        const info = window.getProblemInfo({ idFormat: 'UPPER', nameFormat: 'NONE' });
        window.downloadString(text, `${info.code}.txt`);
        showFeedback(dlBtn);
    };
    const cphBtn = document.createElement('span');
    cphBtn.className = 'pch-icon-btn';
    cphBtn.title = "Nhập vào CPH";
    cphBtn.innerHTML = PCH_ICONS.cph;
    cphBtn.onclick = async () => {
        const original = cphBtn.innerHTML;
        cphBtn.innerHTML = PCH_ICONS.loading;
        const success = await window.sendToCPH();
        if (success) {
            cphBtn.innerHTML = PCH_ICONS.check_green;
            setTimeout(() => cphBtn.innerHTML = original, 1500);
        } else {
            cphBtn.innerHTML = original;
            window.Analytics.fireEvent('cph_failed', { problem_id: window.PROBLEM_ID });
        }
    };
    container.appendChild(copyBtn);
    container.appendChild(dlBtn);
    container.appendChild(cphBtn);
    const problemId = window.PROBLEM_ID;
    const prefixes = Object.keys(window.GITHUB_REPOS).sort((a, b) => b.length - a.length);
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

window.showToast = function showToast(message, type = 'info') {
    const title = type === 'error' ? 'Lỗi' : 'Thông báo';
    const toastId = 'toast_' + type + '_' + Date.now();
    window.showNotification({ id: toastId, message, title });
}

window.fetchAndShowNotifications = function fetchAndShowNotifications() {
    SYNC.get(['pch_dismissed_page'], (items) => {
        const dismissed = items.pch_dismissed_page || [];

        chrome.runtime.sendMessage({ action: 'fetchNotifications' }, (response) => {
            if (response && response.remote) {
                const currentVersion = VERSION;
                const toShow = [];

                if (response.remote.version_info && window.compareVersions(response.remote.version_info.latest_version, currentVersion) > 0) {
                    const updateId = 'update_' + response.remote.version_info.latest_version;
                    if (!dismissed.includes(updateId)) {
                        toShow.push({
                            id: updateId,
                            isUpdate: true,
                            title: `Có bản cập nhật: v${response.remote.version_info.latest_version}`,
                            release_date: response.remote.version_info.release_date || '',
                            message: response.remote.version_info.release_notes || '',
                            action_text: 'Tải xuống',
                            action_url: response.remote.version_info.download_url
                        });
                    }
                }

                if (response.remote.notifications && response.remote.notifications.length > 0) {
                    response.remote.notifications.forEach(notif => {
                        if (dismissed.includes(notif.id)) return;

                        if (notif.target) {
                            if (notif.target.browsers && notif.target.browsers.length > 0) {
                                const userAgent = navigator.userAgent.toLowerCase();
                                const isMatch = notif.target.browsers.some(b => userAgent.includes(b.toLowerCase()));
                                if (!isMatch) return;
                            }
                            if (notif.target.min_version && window.compareVersions(currentVersion, notif.target.min_version) < 0) return;
                            if (notif.target.max_version && window.compareVersions(currentVersion, notif.target.max_version) > 0) return;
                        }

                        if (notif.expires_at && new Date() > new Date(notif.expires_at)) return;
                        toShow.push(notif);
                    });
                }

                if (toShow.length > 0) {
                    const newDismissed = [...dismissed, ...toShow.map(n => n.id)];
                    SYNC.set({ pch_dismissed_page: newDismissed });
                    toShow.forEach(notif => showNotification(notif));
                }
            }
        });
    });
}

window.showNotification = function showNotification(info) {
    if (document.getElementById(`pch-notif-\${info.id}`)) return;

    let container = document.getElementById('pch-notif-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pch-notif-container';
        container.className = 'pch-notif-container';
        document.body.appendChild(container);
    }

    const div = document.createElement('div');
    div.id = `pch-notif-${info.id}`;
    div.className = `pch-notif-popup`;
    div.innerHTML = `
        <div class="pch-notif-header">
            <div class="pch-notif-title"><span class="pch-notif-title-text"></span></div>
            ${info.release_date ? `
            <div class="pch-notif-date" style="margin-top: 4px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>${info.release_date}</span>
            </div>` : ''}
            <div class="pch-notif-close">&times;</div>
        </div>
        <div class="pch-notif-content"></div>
        ${info.action_url ? `<a href="${info.action_url}" target="_blank" class="pch-notif-link"></a>` : ''}
    `;

    div.querySelector('.pch-notif-title-text').textContent = info.title || 'Thông báo';
    div.querySelector('.pch-notif-content').textContent = info.message || '';
    if (info.action_url) {
        div.querySelector('.pch-notif-link').textContent = info.action_text || 'Xem chi tiết';
    }

    container.appendChild(div);

    const closeBtn = div.querySelector('.pch-notif-close');
    const close = () => {
        div.style.animation = 'slideInBottom 0.4s reverse cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => div.remove(), 400);

        if (!info.id.startsWith('toast_')) {
            SYNC.get(['pch_dismissed_notifications'], (items) => {
                const dismissed = items.pch_dismissed_notifications || [];
                if (!dismissed.includes(info.id)) {
                    dismissed.push(info.id);
                    SYNC.set({ pch_dismissed_notifications: dismissed });
                }
            });
        }
    };
    closeBtn.onclick = close;

    const timeoutMs = 10000;
    setTimeout(close, timeoutMs);
}

window.filterProblems = function filterProblems() {
    SYNC.get(['pch_only_wrong', 'pch_hide_ac'], (items) => {
        if (!window.cachedRowsList) {
            const tables = Array.from(document.querySelectorAll('.ques__table'));
            const targetTable = tables.find(t => t.querySelector('a[href*="/student/question/"]')) || tables[0];
            if (targetTable) {
                window.cachedRowsList = Array.from(targetTable.querySelectorAll('tbody tr'));
            } else {
                return;
            }
        }
        if (!window.cachedRowsList.length) return;
        const onlyWrong = items.pch_only_wrong;
        const hideAc = items.pch_hide_ac;
        window.cachedRowsList.forEach(row => {
            row.style.display = '';
            if (onlyWrong && !row.classList.contains('bg--50th')) {
                row.style.display = 'none';
            } else if (hideAc && row.classList.contains('bg--10th')) {
                row.style.display = 'none';
            }
        });
    });
}
