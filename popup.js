document.addEventListener('DOMContentLoaded', () => {
    const DEFAULTS = {
        'pch_editor_enabled': true,
        'pch_hide_chat': false,
        'pch_hide_banner': false,
        'pch_hide_lectures': false,
        'pch_hide_ac': false,
        'pch_only_wrong': false,
        'pch_cph_id_format': 'UPPER',
        'pch_cph_name_format': 'NONE'
    };

    chrome.storage.sync.get(DEFAULTS, (items) => {
        document.getElementById('pch_editor_enabled').checked = items.pch_editor_enabled;
        document.getElementById('pch_hide_chat').checked = items.pch_hide_chat;
        document.getElementById('pch_hide_banner').checked = items.pch_hide_banner;
        document.getElementById('pch_hide_lectures').checked = items.pch_hide_lectures;
        document.getElementById('pch_hide_ac').checked = items.pch_hide_ac;
        document.getElementById('pch_only_wrong').checked = items.pch_only_wrong;
        document.getElementById('pch_cph_id_format').value = items.pch_cph_id_format;
        document.getElementById('pch_cph_name_format').value = items.pch_cph_name_format;
    });

    const save = (key, value) => chrome.storage.sync.set({ [key]: value });

    document.getElementById('pch_editor_enabled').onchange = (e) => save('pch_editor_enabled', e.target.checked);
    document.getElementById('pch_hide_chat').onchange = (e) => save('pch_hide_chat', e.target.checked);
    document.getElementById('pch_hide_banner').onchange = (e) => save('pch_hide_banner', e.target.checked);
    document.getElementById('pch_hide_lectures').onchange = (e) => save('pch_hide_lectures', e.target.checked);

    document.getElementById('pch_hide_ac').onchange = (e) => {
        save('pch_hide_ac', e.target.checked);
        if (e.target.checked) {
            document.getElementById('pch_only_wrong').checked = false;
            save('pch_only_wrong', false);
        }
    };

    document.getElementById('pch_only_wrong').onchange = (e) => {
        save('pch_only_wrong', e.target.checked);
        if (e.target.checked) {
            document.getElementById('pch_hide_ac').checked = false;
            save('pch_hide_ac', false);
        }
    };

    document.getElementById('pch_cph_id_format').onchange = (e) => save('pch_cph_id_format', e.target.value);
    document.getElementById('pch_cph_name_format').onchange = (e) => save('pch_cph_name_format', e.target.value);

    checkForUpdate('pch_dismissed_version', (remote) => {
        const banner = document.getElementById('update_banner');
        document.getElementById('update_version').textContent = 'v' + remote.version;
        document.getElementById('update_date').textContent = remote.release_date || '';
        document.getElementById('update_changelog').textContent = remote.changelog;
        document.getElementById('update_link').href = remote.url;
        banner.classList.add('show');

        document.getElementById('update_close').onclick = () => {
            banner.classList.remove('show');
            chrome.storage.sync.set({ pch_dismissed_version: remote.version });
        };
    });
});

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
