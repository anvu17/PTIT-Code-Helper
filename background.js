importScripts('pch.js', 'analytics.js');
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendToCPH") {
        (async () => {
            try {
                const res = await fetch("http://127.0.0.1:27121/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(request.data)
                });
                sendResponse({ success: res.ok });
            } catch (err) {
                sendResponse({ success: false });
            }
        })();
        return true;
    }
    if (request.action === "checkUpdate") {
        (async () => {
            try {
                const res = await fetch("https://anvu.web.app/pch/version.json");
                const data = await res.json();
                sendResponse({ current: VERSION, remote: data });
            } catch (err) {
                sendResponse({ error: true });
            }
        })();
        return true;
    }
});
chrome.runtime.setUninstallURL(`https://anvu.web.app/pch/feedback?action=uninstall&version=${VERSION}`);
