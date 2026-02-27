document.addEventListener('DOMContentLoaded', () => {
    const els = {
        editorEnabled: document.getElementById('pch_editor_enabled'),
        hideChat: document.getElementById('pch_hide_chat'),
        hideBanner: document.getElementById('pch_hide_banner'),
        hideLectures: document.getElementById('pch_hide_lectures'),
        hideContestBanner: document.getElementById('pch_hide_contest_banner'),
        hideAc: document.getElementById('pch_hide_ac'),
        onlyWrong: document.getElementById('pch_only_wrong'),
        cphIdFormat: document.getElementById('pch_cph_id_format'),
        cphNameFormat: document.getElementById('pch_cph_name_format'),
        feedbackLink: document.getElementById('pch_feedback'),
        updateBanner: document.getElementById('update_banner'),
        updateVersion: document.getElementById('update_version'),
        updateDate: document.getElementById('update_date'),
        updateChangelog: document.getElementById('update_changelog'),
        updateLink: document.getElementById('update_link'),
        updateClose: document.getElementById('update_close'),
        versionDisplay: document.getElementById('pch_version')
    };

    if (els.versionDisplay) {
        els.versionDisplay.textContent = 'v' + VERSION;
    }

    SYNC.get(DEFAULTS, (items) => {
        els.editorEnabled.checked = items.pch_editor_enabled;
        els.hideChat.checked = items.pch_hide_chat;
        els.hideBanner.checked = items.pch_hide_banner;
        els.hideLectures.checked = items.pch_hide_lectures;
        els.hideContestBanner.checked = items.pch_hide_contest_banner;
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
    els.hideContestBanner.onchange = (e) => save('pch_hide_contest_banner', e.target.checked);

    els.hideAc.onchange = (e) => {
        if (e.target.checked) {
            els.onlyWrong.checked = false;
            SYNC.set({ pch_hide_ac: true, pch_only_wrong: false });
        } else {
            save('pch_hide_ac', false);
        }
    };

    els.onlyWrong.onchange = (e) => {
        if (e.target.checked) {
            els.hideAc.checked = false;
            SYNC.set({ pch_only_wrong: true, pch_hide_ac: false });
        } else {
            save('pch_only_wrong', false);
        }
    };

    els.cphIdFormat.onchange = (e) => save('pch_cph_id_format', e.target.value);
    els.cphNameFormat.onchange = (e) => save('pch_cph_name_format', e.target.value);

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
