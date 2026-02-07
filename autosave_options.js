document.addEventListener('DOMContentLoaded', () => {
    const DEFAULTS = {
        'pch_disable_autosave': false,
        'pch_autosave_interval': 15,
        'pch_autosave_on_change': false,
        'pch_autodelete_time': 24,
        'pch_autodelete_enabled': true
    };

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
        clearBtn: document.getElementById('btn_clear_all')
    };

    chrome.storage.sync.get(DEFAULTS, (items) => {
        els.enabled.checked = !items.pch_disable_autosave;
        els.mode.value = items.pch_autosave_on_change ? 'ON_CHANGE' : 'INTERVAL';
        els.interval.value = items.pch_autosave_interval;
        els.deleteTime.value = items.pch_autodelete_time;
        els.deleteEnabled.checked = items.pch_autodelete_enabled;

        toggleSettings(els.enabled.checked);
        toggleInterval(els.mode.value === 'INTERVAL');
        toggleDeleteTime(els.deleteEnabled.checked);
    });

    renderDrafts();

    els.enabled.onchange = (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.sync.set({ pch_disable_autosave: !isEnabled });
        toggleSettings(isEnabled);
    };

    els.mode.onchange = (e) => {
        const isOnChange = e.target.value === 'ON_CHANGE';
        chrome.storage.sync.set({ pch_autosave_on_change: isOnChange });
        toggleInterval(!isOnChange);
    };

    els.interval.onchange = (e) => {
        let val = parseInt(e.target.value);
        if (val < 5) val = 5;
        chrome.storage.sync.set({ pch_autosave_interval: val });
    };

    els.deleteEnabled.onchange = (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.sync.set({ pch_autodelete_enabled: isEnabled });
        toggleDeleteTime(isEnabled);
    };

    els.deleteTime.onchange = (e) => {
        let val = parseInt(e.target.value);
        if (val < 1) val = 1;
        chrome.storage.sync.set({ pch_autodelete_time: val });
    };

    els.clearBtn.onclick = () => {
        chrome.storage.local.set({ pch_drafts: {} }, renderDrafts);
    };

    function toggleSettings(enabled) {
        if (enabled) {
            els.settingsArea.classList.remove('d-none');
        } else {
            els.settingsArea.classList.add('d-none');
        }
    }

    function toggleInterval(show) {
        if (show) {
            els.intervalRow.classList.remove('d-none');
        } else {
            els.intervalRow.classList.add('d-none');
        }
    }

    function toggleDeleteTime(show) {
        if (show) {
            els.deleteTimeRow.classList.remove('d-none');
        } else {
            els.deleteTimeRow.classList.add('d-none');
        }
    }

    const modal = {
        self: document.getElementById('draft_modal'),
        title: document.getElementById('modal_title'),
        body: document.getElementById('modal_body'),
        close: document.getElementById('modal_close')
    };

    modal.close.onclick = () => modal.self.classList.add('d-none');
    window.onclick = (e) => {
        if (e.target === modal.self) modal.self.classList.add('d-none');
    };

    function renderDrafts() {
        chrome.storage.local.get(['pch_drafts'], (result) => {
            const drafts = result.pch_drafts || {};
            els.draftList.innerHTML = '';

            const keys = Object.keys(drafts);
            if (keys.length === 0) {
                els.draftList.innerHTML = '<div style="padding:10px; text-align:center; color:#888;">Không có bản nháp nào</div>';
                els.clearBtn.style.display = 'none';
            } else {
                els.clearBtn.style.display = 'block';
                keys.forEach(key => {
                    const item = document.createElement('div');
                    item.className = 'draft-item';

                    const info = document.createElement('div');
                    const name = document.createElement('div');
                    name.className = 'draft-name';
                    name.textContent = key;

                    const time = document.createElement('div');
                    time.className = 'draft-time';
                    const date = new Date(drafts[key].timestamp);
                    time.textContent = date.toLocaleString();

                    info.appendChild(name);

                    const actions = document.createElement('div');
                    actions.style.display = 'flex';
                    actions.style.alignItems = 'center';

                    actions.appendChild(time);

                    const view = document.createElement('span');
                    view.className = 'btn-action btn-view';
                    view.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
                    view.title = "Xem chi tiết";
                    view.onclick = () => {
                        modal.title.textContent = key;
                        modal.body.textContent = drafts[key].content;
                        modal.self.classList.remove('d-none');
                    };
                    actions.appendChild(view);

                    const del = document.createElement('span');
                    del.className = 'btn-action btn-del';
                    del.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg>`;
                    del.title = "Xóa";
                    del.onclick = () => {
                        delete drafts[key];
                        chrome.storage.local.set({ pch_drafts: drafts }, renderDrafts);
                    };
                    actions.appendChild(del);

                    item.appendChild(info);
                    item.appendChild(actions);
                    els.draftList.appendChild(item);
                });
            }
        });
    }
});
