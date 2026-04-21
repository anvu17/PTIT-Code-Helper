window.CPH_CONFIG = {
    group: 'PTIT Code Helper',
    interactive: false,
    memoryLimit: 128,
    timeLimit: 5000,
    testType: 'single',
    input: { type: 'stdin' },
    output: { type: 'stdout' },
    languages: { java: { mainClass: 'Main', taskClass: null } }
};

window.sendToCPH = function sendToCPH() {
    return new Promise((resolve) => {
        SYNC.get(['pch_cph_id_format', 'pch_cph_name_format'], async (items) => {
            const config = {
                idFormat: items.pch_cph_id_format || 'UPPER',
                nameFormat: items.pch_cph_name_format || 'NONE'
            };
            const info = getProblemInfo(config);
            const tests = getTests();
            if (!tests.length) {
                showToast('Không tìm thấy test case!', 'error');
                resolve(false);
                return;
            }
            const cphName = PROBLEM_ID.length > 10
                ? `CONTEST_${PROBLEM_ID.slice(0, 3).toUpperCase()}`
                : info.name;
            const data = {
                ...CPH_CONFIG,
                name: cphName,
                url: info.url,
                tests: tests,
                languages: {
                    ...CPH_CONFIG.languages,
                    java: { ...CPH_CONFIG.languages.java, taskClass: cphName }
                }
            };
            try {
                const res = await chrome.runtime.sendMessage({
                    action: 'sendToCPH',
                    data: data
                });
                if (!res || !res.success) {
                    showToast('Không thể kết nối với CPH!', 'error');
                    resolve(false);
                } else {
                    resolve(true);
                }
            } catch (e) {
                resolve(false);
            }
        });
    });
}
