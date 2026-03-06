window.isFetchingNextPage = false;
window.infiniteScrollEnabled = false;
window.cachedRowsList = null;

window.initInfiniteScroll = function initInfiniteScroll() {
    if (!document.querySelector('.ques__table')) return;
    SYNC.get(['pch_infinite_scroll'], (items) => {
        window.infiniteScrollEnabled = items.pch_infinite_scroll === true;
        if (window.infiniteScrollEnabled) {
            window.addEventListener('scroll', window.debouncedHandleScroll);
            document.addEventListener('click', async (e) => {
                const paginationItem = e.target.closest('.pagination a, .pagination span');
                if (paginationItem && window.infiniteScrollEnabled) {
                    let pageNum = '1';
                    let href = '';
                    if (paginationItem.tagName.toLowerCase() === 'a') {
                        href = paginationItem.href;
                        if (!href || href.includes('javascript:')) return;
                        const pageNumMatch = href.match(/page=(\d+)/);
                        if (pageNumMatch) pageNum = pageNumMatch[1];
                    } else {
                        pageNum = paginationItem.textContent.trim();
                        if (isNaN(parseInt(pageNum))) return;
                    }

                    e.preventDefault();
                    if (window.isFetchingNextPage) return;

                    const targetSTT = ((parseInt(pageNum) - 1) * 100 + 1).toString();

                    const scrollToSTT = (stt) => {
                        const tds = document.querySelectorAll('td.text--middle');
                        for (let i = 0; i < tds.length; i++) {
                            if (tds[i].textContent.trim() === stt) {
                                const targetEl = tds[i].parentElement;
                                const yOffset = -100;
                                const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                                return true;
                            }
                        }
                        return false;
                    };

                    if (scrollToSTT(targetSTT)) return;

                    if (href) {
                        window.location.href = href;
                    }
                }
            });
        }
    });
}

function handleScroll() {
    if (window.isFetchingNextPage || !window.infiniteScrollEnabled) return;
    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.body.offsetHeight - 500;
    if (scrollPosition >= threshold) {
        window.loadNextPage();
    }
}

window.debouncedHandleScroll = window.debounce(handleScroll, 150);

window.loadNextPage = async function loadNextPage() {
    const activePageLi = document.querySelector('.pagination li.active');
    if (!activePageLi) return;
    const nextPageLi = activePageLi.nextElementSibling;
    if (!nextPageLi || nextPageLi.classList.contains('disabled')) return;
    const nextLink = nextPageLi.querySelector('a');
    if (!nextLink) return;

    window.isFetchingNextPage = true;
    const url = nextLink.href;

    const currentTables = Array.from(document.querySelectorAll('.ques__table'));
    const targetTable = currentTables.find(t => t.querySelector('a[href*="/student/question/"]')) || currentTables[0];

    if (!targetTable) {
        window.isFetchingNextPage = false;
        return;
    }

    const tbody = targetTable.querySelector('tbody');

    if (tbody) {
        const loadingRow = document.createElement('tr');
        loadingRow.id = 'pch-loading-row';
        loadingRow.innerHTML = `<td colspan="10" style="text-align: center; padding: 15px;"><div style="display:inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #b71c1c; border-radius: 50%; animation: spin 1s linear infinite;"></div></td>`;
        tbody.appendChild(loadingRow);
        window.injectCSS('@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }');
    }

    try {
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const docTables = Array.from(doc.querySelectorAll('.ques__table'));
        const docTargetTable = docTables.find(t => t.querySelector('a[href*="/student/question/"]')) || docTables[0];

        if (!docTargetTable) throw new Error();

        const newRows = Array.from(docTargetTable.querySelectorAll('tbody tr'));
        const newPagination = doc.querySelector('.pagination');

        if (tbody) {
            const loadingIndicator = document.getElementById('pch-loading-row');
            if (loadingIndicator) loadingIndicator.remove();

            const pageMatch = url.match(/page=(\d+)/);
            const pageNum = pageMatch ? pageMatch[1] : null;

            if (newRows.length > 0 && pageNum) {
                newRows[0].id = `pch-page-${pageNum}`;
            }

            newRows.forEach(row => {
                tbody.appendChild(row);
            });
        }

        const currentPagination = document.querySelector('.pagination');
        if (currentPagination && newPagination) {
            currentPagination.innerHTML = newPagination.innerHTML;
        }

        window.cachedRowsList = Array.from(targetTable.querySelectorAll('tbody tr'));
        window.filterProblems();

    } catch (error) {
        window.Analytics.fireErrorEvent({ message: 'Failed to fetch the next page', error: error.toString() });
        const loadingIndicator = document.getElementById('pch-loading-row');
        if (loadingIndicator) loadingIndicator.remove();
    } finally {
        setTimeout(() => {
            window.isFetchingNextPage = false;
        }, 500);
    }
}
