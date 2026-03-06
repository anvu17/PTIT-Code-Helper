document.addEventListener('DOMContentLoaded', () => {
    const els = {
        enabled: document.getElementById('pch_autosave_enabled'),
        mode: document.getElementById('pch_autosave_mode'),
        interval: document.getElementById('pch_autosave_interval'),
        intervalRow: document.getElementById('interval_setting'),
        deleteTime: document.getElementById('pch_autodelete_time'),
        deleteEnabled: document.getElementById('pch_autodelete_enabled'),
        deleteTimeRow: document.getElementById('autodelete_time_setting'),
        settingsArea: document.getElementById('settings_area'),
        draftList: document.getElementById('draft_list'),
        clearBtn: document.getElementById('btn_clear_all'),
        modalCopyBtn: document.getElementById('modal_copy_btn')
    };

    const modal = {
        self: document.getElementById('draft_modal'),
        title: document.getElementById('modal_title'),
        body: document.getElementById('modal_body'),
        close: document.getElementById('modal_close')
    };

    const feedbackLink = document.getElementById('pch_feedback');
    if (feedbackLink) {
        feedbackLink.href = FEEDBACK_URL;
    }

    if (els.modalCopyBtn) {
        els.modalCopyBtn.onclick = () => {
            const content = modal.body.textContent;
            navigator.clipboard.writeText(content).then(() => {
                const original = els.modalCopyBtn.innerHTML;
                els.modalCopyBtn.innerHTML = `${PCH_ICONS.check_white} Đã sao chép`;
                setTimeout(() => els.modalCopyBtn.innerHTML = original, PCH_CONFIG.FEEDBACK_DURATION);
            });
        };
    }

    modal.close.onclick = () => toggleClass(modal.self, 'pch-d-none', true);

    window.addEventListener('click', (e) => {
        if (e.target === modal.self) toggleClass(modal.self, 'pch-d-none', true);
    });

    function renderDrafts() {
        LOCAL.get(['pch_drafts'], (result) => {
            const drafts = result.pch_drafts || {};
            els.draftList.innerHTML = '';
            const problemIds = Object.keys(drafts);

            if (problemIds.length === 0) {
                els.draftList.innerHTML = '<div style="padding:10px; text-align:center; color:#888;">Không có bản nháp nào</div>';
                els.clearBtn.style.display = 'none';
            } else {
                els.clearBtn.style.display = 'block';
                const fragment = document.createDocumentFragment();

                problemIds.forEach(problemId => {
                    const item = document.createElement('div');
                    item.className = 'draft-item';

                    const info = document.createElement('div');
                    const name = document.createElement('a');
                    name.className = 'draft-name';
                    name.textContent = problemId;
                    name.href = `https://code.ptit.edu.vn/student/question/${problemId}`;
                    name.target = '_blank';
                    name.style.textDecoration = 'none';
                    name.style.color = 'inherit';

                    const time = document.createElement('div');
                    time.className = 'draft-time';
                    const date = new Date(drafts[problemId].timestamp);
                    time.textContent = date.toLocaleString();
                    info.appendChild(name);

                    const actions = document.createElement('div');
                    actions.className = 'draft-actions';
                    actions.appendChild(time);

                    const view = document.createElement('span');
                    view.className = 'pch-icon-btn';
                    view.innerHTML = PCH_ICONS.eye;
                    view.title = 'Xem code';
                    view.onclick = () => {
                        modal.title.innerHTML = `<a href="https://code.ptit.edu.vn/student/question/${problemId}" target="_blank" style="color: inherit; text-decoration: none;">${problemId}</a>`;
                        modal.body.textContent = drafts[problemId].content;
                        modal.self.dataset.problemId = problemId;
                        toggleClass(modal.self, 'pch-d-none', false);
                    };
                    actions.appendChild(view);

                    const copy = document.createElement('span');
                    copy.className = 'pch-icon-btn';
                    copy.innerHTML = PCH_ICONS.copy;
                    copy.title = 'Sao chép';
                    copy.onclick = () => {
                        const content = drafts[problemId].content;
                        navigator.clipboard.writeText(content).then(() => {
                            const original = copy.innerHTML;
                            copy.innerHTML = PCH_ICONS.check_green;
                            setTimeout(() => copy.innerHTML = original, PCH_CONFIG.FEEDBACK_DURATION);
                        });
                    };
                    actions.appendChild(copy);

                    const del = document.createElement('span');
                    del.className = 'pch-icon-btn';
                    del.innerHTML = PCH_ICONS.trash;
                    del.title = 'Xóa';
                    del.onclick = () => {
                        delete drafts[problemId];
                        LOCAL.set({ pch_drafts: drafts }, renderDrafts);
                    };
                    actions.appendChild(del);

                    item.appendChild(info);
                    item.appendChild(actions);
                    fragment.appendChild(item);
                });

                els.draftList.appendChild(fragment);
            }
        });
    }

    renderDrafts();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.pch_drafts) {
            renderDrafts();
        }
    });

    SYNC.get(DEFAULTS, (items) => {
        els.enabled.checked = items.pch_autosave_enabled;
        els.mode.value = items.pch_autosave_mode;
        els.interval.value = items.pch_autosave_interval;
        els.deleteTime.value = items.pch_autodelete_time;
        els.deleteEnabled.checked = items.pch_autodelete_enabled;
        toggleClass(els.settingsArea, 'pch-d-none', !items.pch_autosave_enabled);
        toggleClass(els.intervalRow, 'pch-d-none', items.pch_autosave_mode !== 'interval');
        toggleClass(els.deleteTimeRow, 'pch-d-none', !items.pch_autodelete_enabled);
    });

    els.enabled.onchange = (e) => {
        SYNC.set({ pch_autosave_enabled: e.target.checked });
        toggleClass(els.settingsArea, 'pch-d-none', !e.target.checked);
    };

    els.mode.onchange = (e) => {
        SYNC.set({ pch_autosave_mode: e.target.value });
        toggleClass(els.intervalRow, 'pch-d-none', e.target.value !== 'interval');
    };

    els.interval.onchange = (e) => {
        SYNC.set({ pch_autosave_interval: parseInt(e.target.value) });
    };

    els.deleteEnabled.onchange = (e) => {
        SYNC.set({ pch_autodelete_enabled: e.target.checked });
        toggleClass(els.deleteTimeRow, 'pch-d-none', !e.target.checked);
    };

    els.deleteTime.onchange = (e) => {
        SYNC.set({ pch_autodelete_time: parseInt(e.target.value) });
    };

    els.clearBtn.onclick = () => {
        LOCAL.set({ pch_drafts: {} }, renderDrafts);
    };
});
