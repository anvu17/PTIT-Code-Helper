document.addEventListener('DOMContentLoaded', () => {
    const els = {
        editorEnabled: document.getElementById('pch_editor_enabled'),
        hideChat: document.getElementById('pch_hide_chat'),
        hideBanner: document.getElementById('pch_hide_banner'),
        hideLectures: document.getElementById('pch_hide_lectures'),
        hideAc: document.getElementById('pch_hide_ac'),
        onlyWrong: document.getElementById('pch_only_wrong'),
        cphIdFormat: document.getElementById('pch_cph_id_format'),
        cphNameFormat: document.getElementById('pch_cph_name_format'),
        feedbackLink: document.getElementById('pch_feedback'),
        openOptionsBtn: document.getElementById('open_options'),
        updateBanner: document.getElementById('update_banner'),
        updateVersion: document.getElementById('update_version'),
        updateDate: document.getElementById('update_date'),
        updateChangelog: document.getElementById('update_changelog'),
        updateLink: document.getElementById('update_link'),
        updateClose: document.getElementById('update_close')
    };
    SYNC.get(DEFAULTS, (items) => {
        els.editorEnabled.checked = items.pch_editor_enabled;
        els.hideChat.checked = items.pch_hide_chat;
        els.hideBanner.checked = items.pch_hide_banner;
        els.hideLectures.checked = items.pch_hide_lectures;
        els.hideAc.checked = items.pch_hide_ac;
        els.onlyWrong.checked = items.pch_only_wrong;
        els.cphIdFormat.value = items.pch_cph_id_format;
        els.cphNameFormat.value = items.pch_cph_name_format;
    });
    if (els.feedbackLink) {
        els.feedbackLink.href = FEEDBACK_URL;
    }
    const save = (key, value) => {
        SYNC.set({ [key]: value });
    };
    els.editorEnabled.onchange = (e) => save('pch_editor_enabled', e.target.checked);
    els.hideChat.onchange = (e) => save('pch_hide_chat', e.target.checked);
    els.hideBanner.onchange = (e) => save('pch_hide_banner', e.target.checked);
    els.hideLectures.onchange = (e) => save('pch_hide_lectures', e.target.checked);
    els.hideAc.onchange = (e) => {
        save('pch_hide_ac', e.target.checked);
        if (e.target.checked) {
            els.onlyWrong.checked = false;
            save('pch_only_wrong', false);
        }
    };
    els.onlyWrong.onchange = (e) => {
        save('pch_only_wrong', e.target.checked);
        if (e.target.checked) {
            els.hideAc.checked = false;
            save('pch_hide_ac', false);
        }
    };
    els.cphIdFormat.onchange = (e) => save('pch_cph_id_format', e.target.value);
    els.cphNameFormat.onchange = (e) => save('pch_cph_name_format', e.target.value);
    if (els.openOptionsBtn) {
        els.openOptionsBtn.onclick = (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
        };
    }
    checkForUpdate('pch_dismissed_version', (remote) => {
        els.updateVersion.textContent = 'v' + remote.version;
        els.updateDate.textContent = remote.release_date || '';
        els.updateChangelog.textContent = remote.changelog;
        els.updateLink.href = remote.url;
        els.updateBanner.classList.add('show');
        els.updateClose.onclick = () => {
            els.updateBanner.classList.remove('show');
            chrome.storage.sync.set({ pch_dismissed_version: remote.version });
        };
    });
});
