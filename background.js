chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendToCPH") {
        fetch("http://127.0.0.1:27121/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request.data)
        })
            .then(res => sendResponse({ success: res.ok }))
            .catch(err => {
                fetch("http://127.0.0.1:1327/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(request.data)
                })
                    .then(res2 => sendResponse({ success: res2.ok }))
                    .catch(() => sendResponse({ success: false }));
            });

        return true;
    }

    if (request.action === "checkUpdate") {
        fetch("https://anvu.web.app/pch/version.json")
            .then(res => res.json())
            .then(data => {
                const current = chrome.runtime.getManifest().version;
                sendResponse({ current: current, remote: data });
            })
            .catch(err => sendResponse({ error: true }));
        return true;
    }
});
