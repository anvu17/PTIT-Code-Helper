document.addEventListener('DOMContentLoaded', () => {
    const els = {
        editorEnabled: document.getElementById('pch_editor_enabled'),
        hideChat: document.getElementById('pch_hide_chat'),
        hideBetaBanner: document.getElementById('pch_hide_beta_banner'),
        hideLectures: document.getElementById('pch_hide_lectures'),
        hideContestBanner: document.getElementById('pch_hide_contest_banner'),
        infiniteScroll: document.getElementById('pch_infinite_scroll'),
        hideAc: document.getElementById('pch_hide_ac'),
        onlyWrong: document.getElementById('pch_only_wrong'),
        cphIdFormat: document.getElementById('pch_cph_id_format'),
        cphNameFormat: document.getElementById('pch_cph_name_format'),
        feedbackLink: document.getElementById('pch_feedback'),
        versionDisplay: document.getElementById('pch_version')
    };

    if (els.versionDisplay) {
        els.versionDisplay.textContent = 'v' + VERSION;
    }

    SYNC.get(DEFAULTS, (items) => {
        els.editorEnabled.checked = items.pch_editor_enabled;
        els.hideChat.checked = items.pch_hide_chat;
        els.hideBetaBanner.checked = items.pch_hide_beta_banner;
        els.hideLectures.checked = items.pch_hide_lectures;
        els.hideContestBanner.checked = items.pch_hide_contest_banner;
        els.infiniteScroll.checked = items.pch_infinite_scroll;
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
    els.hideBetaBanner.onchange = (e) => save('pch_hide_beta_banner', e.target.checked);
    els.hideLectures.onchange = (e) => save('pch_hide_lectures', e.target.checked);
    els.hideContestBanner.onchange = (e) => save('pch_hide_contest_banner', e.target.checked);
    els.infiniteScroll.onchange = (e) => save('pch_infinite_scroll', e.target.checked);

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

    fetchNotifications((remote) => {
        chrome.storage.sync.get(['pch_popup_dismissed'], (syncData) => {
            const dismissed = syncData.pch_popup_dismissed || [];
            const candidates = [];

            if (remote.version_info && compareVersions(remote.version_info.latest_version, VERSION) > 0) {
                candidates.push({
                    id: 'update_' + remote.version_info.latest_version,
                    title: `Có bản cập nhật: v${remote.version_info.latest_version}`,
                    date: remote.version_info.release_date || '',
                    message: remote.version_info.release_notes || '',
                    url: remote.version_info.download_url
                });
            }

            if (remote.notifications) {
                const userAgent = navigator.userAgent.toLowerCase();
                for (const n of remote.notifications) {
                    if (n.target) {
                        if (n.target.browsers && n.target.browsers.length > 0) {
                            if (!n.target.browsers.some(b => userAgent.includes(b.toLowerCase()))) continue;
                        }
                        if (n.target.min_version && compareVersions(VERSION, n.target.min_version) < 0) continue;
                        if (n.target.max_version && compareVersions(VERSION, n.target.max_version) > 0) continue;
                    }
                    if (n.expires_at && new Date() > new Date(n.expires_at)) continue;
                    candidates.push({
                        id: n.id,
                        title: n.title,
                        date: n.release_date || '',
                        message: n.message || '',
                        url: n.action_url || ''
                    });
                }
            }

            const container = document.getElementById('notif_container');
            candidates.forEach(notif => {
                if (dismissed.includes(notif.id)) return;
                renderBanner(container, notif, () => {
                    dismissed.push(notif.id);
                    chrome.storage.sync.set({ pch_popup_dismissed: dismissed });
                });
            });
        });
    });

    function renderBanner(container, notif, onClose) {
        const div = document.createElement('div');
        div.className = 'pch-banner show';

        const dateHtml = notif.date ? `
            <div class="pch-mt-8">
                <span class="pch-banner-date">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span class="date-text"></span>
                </span>
            </div>` : '';

        const linkHtml = notif.url ? `<a href="${notif.url}" target="_blank" class="pch-banner-link">Xem chi tiết</a>` : '';

        div.innerHTML = `
            <div class="pch-banner-header">
                <span class="pch-banner-title"></span>
                <span class="pch-banner-close">&times;</span>
            </div>
            ${dateHtml}
            <div class="pch-banner-content"></div>
            ${linkHtml}
        `;

        div.querySelector('.pch-banner-title').textContent = notif.title;
        div.querySelector('.pch-banner-content').textContent = notif.message;
        if (notif.date) div.querySelector('.date-text').textContent = notif.date;

        div.querySelector('.pch-banner-close').onclick = () => {
            div.remove();
            if (onClose) onClose();
        };

        container.appendChild(div);
    }
});

function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}
