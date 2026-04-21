window.debounce = function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

window.injectCSS = function injectCSS(cssText) {
    let styleEl = document.getElementById('pch-injected-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'pch-injected-styles';
        document.head.appendChild(styleEl);
    }
    try {
        styleEl.sheet.insertRule(cssText, styleEl.sheet.cssRules.length);
    } catch (e) {
        styleEl.textContent += cssText + '\n';
    }
}

window.downloadString = function downloadString(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

window.compareVersions = function compareVersions(v1, v2) {
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

window.NBSP_REGEX = /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;
window.getTextFromElement = function getTextFromElement(element) {
    if (!element) return "";
    const clone = element.cloneNode(true);
    const brs = clone.querySelectorAll('br');
    return clone.innerText.replace(window.NBSP_REGEX, " ")
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
}

window.runWhenReady = function runWhenReady(selector, callback, timeoutMs) {
    if (document.querySelector(selector)) {
        callback();
        return;
    }
    let fired = false;
    const observer = new MutationObserver((mutations, obs) => {
        if (document.querySelector(selector)) {
            fired = true;
            obs.disconnect();
            callback();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (timeoutMs) {
        setTimeout(() => {
            if (!fired) {
                observer.disconnect();
                callback();
            }
        }, timeoutMs);
    }
}
