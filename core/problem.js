window.TABLE_REGEX = /(?:\b(?:input|output|in|out|giải thích)\b|\.(?:inp?|out?))/i;
window.ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
window.GITHUB_REPOS = {
    'CPP': 'anvu17/PTIT-C-CPP',
    'C': 'anvu17/PTIT-C-CPP',
    'CTDL': 'anvu17/PTIT-DSA',
    'DSA': 'anvu17/PTIT-DSA'
};
window.PROBLEM_ID = location.pathname.split('/').pop();
window.SELECTOR_TITLE = '.submit__nav p span a.link--red';
window.SELECTOR_CONTENT = '.submit__des';
window.isProblemPage = () => !!document.querySelector(window.SELECTOR_CONTENT);

window.QUERY_CACHE = {
    titleEl: null,
    descriptionContainer: null
};

window.getProblemDescription = function getProblemDescription() {
    if (!window.QUERY_CACHE.descriptionContainer) {
        window.QUERY_CACHE.descriptionContainer = document.querySelector(window.SELECTOR_CONTENT);
    }
    const container = window.QUERY_CACHE.descriptionContainer;
    if (!container) return "";
    const clone = container.cloneNode(true);
    Array.from(clone.querySelectorAll('table')).forEach(t => {
        if (!t.rows || t.rows.length === 0) return;
        const hasTarget = Array.from(t.rows[0].querySelectorAll('th, td')).some(cell => window.TABLE_REGEX.test(cell.innerText));
        if (hasTarget) t.remove();
    });
    Array.from(clone.querySelectorAll('p, b, strong')).forEach(p => {
        if (p.innerText.trim() === 'Ví dụ:') p.remove();
    });
    const text = clone.innerText;
    return text.replace(window.NBSP_REGEX, ' ')
        .replace(window.ZERO_WIDTH_REGEX, '')
        .split('\n')
        .map(line => line.trimEnd())
        .filter((line, index, arr) => line !== '' || (index > 0 && arr[index - 1] !== ''))
        .join('\n')
        .replace(/\n{2,}/g, '\n\n')
        .trim();
}

window.getProblemInfo = function getProblemInfo(config) {
    if (!window.QUERY_CACHE.titleEl) {
        window.QUERY_CACHE.titleEl = document.querySelector(window.SELECTOR_TITLE);
    }
    const titleEl = window.QUERY_CACHE.titleEl;
    const fullTitle = titleEl ? titleEl.textContent : window.PROBLEM_ID;
    let nameRaw = fullTitle;
    if (fullTitle.includes('-')) {
        const parts = fullTitle.split('-');
        if (parts[0].trim().toUpperCase() === window.PROBLEM_ID.toUpperCase()) {
            nameRaw = parts.slice(1).join('-').trim();
        }
    }
    const idFormat = config?.idFormat || 'UPPER';
    const nameFormat = config?.nameFormat || 'NONE';
    const formattedId = idFormat === 'UPPER' ? window.PROBLEM_ID.toUpperCase() : idFormat === 'LOWER' ? window.PROBLEM_ID.toLowerCase() : '';
    const formattedName = formatProblemName(nameRaw, nameFormat);

    const final = formattedId && formattedName ? `${formattedId}_${formattedName}`
        : formattedId || formattedName || window.PROBLEM_ID.toUpperCase();

    return { code: window.PROBLEM_ID.toUpperCase(), name: final, nameRaw, url: location.href };
}

window.formatProblemName = function formatProblemName(nameRaw, format) {
    if (format === 'NONE') return '';
    const normalized = nameRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = normalized.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/);

    switch (format) {
        case 'RAW': return words.join('_');
        case 'UPPER_SNAKE': return words.map(w => w.toUpperCase()).join('_');
        case 'SNAKE': return words.map(w => w.toLowerCase()).join('_');
        case 'CAPITALIZED_SNAKE': return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_');
        case 'UPPER_NOSPACE': return words.map(w => w.toUpperCase()).join('');
        case 'LOWER_NOSPACE': return words.map(w => w.toLowerCase()).join('');
        case 'CAMEL': return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        case 'PASCAL': return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        case 'LOWER': return words.map(w => w.toLowerCase()).join('_');
        case 'UPPER': return words.map(w => w.toUpperCase()).join('_');
        default: return '';
    }
}

window.getTests = function getTests() {
    return Array.from(document.querySelectorAll('table')).reduce((tests, t) => {
        if (!t.rows || t.rows.length === 0) return tests;
        const headerCells = Array.from(t.rows[0].querySelectorAll('th, td'));
        const targetCols = headerCells.reduce((acc, cell) => {
            if (window.TABLE_REGEX.test(cell.innerText)) acc.push(cell.cellIndex);
            return acc;
        }, []);

        if (targetCols.length >= 2) {
            const trs = Array.from(t.querySelectorAll('tr')).slice(1);
            const maxColIndex = Math.max(...targetCols.slice(0, 2));

            trs.forEach(row => {
                if (row.cells.length > maxColIndex) {
                    const inputCell = row.cells[targetCols[0]];
                    const outputCell = row.cells[targetCols[1]];
                    const explanationCell = targetCols[2] !== undefined ? row.cells[targetCols[2]] : null;

                    if (!window.TABLE_REGEX.test(inputCell.innerText)) {
                        const input = getTextFromElement(inputCell);
                        const output = getTextFromElement(outputCell);
                        const explanation = explanationCell ? getTextFromElement(explanationCell) : "";

                        if (input || output) tests.push({ input, output, explanation });
                    }
                }
            });
        }
        return tests;
    }, []);
}

window.generateProblemText = function generateProblemText() {
    const info = window.getProblemInfo({ idFormat: 'UPPER', nameFormat: 'NONE' });
    const tests = window.getTests();
    const parts = [
        `PROBLEM: ${window.PROBLEM_ID} - ${info.nameRaw}`,
        `URL: ${info.url}\n`,
        `DESCRIPTION:`,
        window.getProblemDescription() + '\n'
    ];
    tests.forEach((t, i) => {
        const testParts = [`[TEST ${i + 1}]`, `--- Input ---\n${t.input}`];
        if (t.output) testParts.push(`--- Output ---\n${t.output}`);
        if (t.explanation) testParts.push(`--- Explanation ---\n${t.explanation}`);
        parts.push(testParts.join('\n') + '\n');
    });
    parts.push(`Extracted with PTIT Code Helper - https://anvu.web.app/pch`);
    return parts.join('\n');
}
