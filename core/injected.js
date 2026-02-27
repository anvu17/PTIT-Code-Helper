(function () {
    'use strict';
    const PROBLEM_ID = location.pathname.split('/').pop();
    const PCH_ICONS = {
        code: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
        paste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
        upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
        trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg>`,
        save: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"></path></svg>`,
        check_green: `<svg viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    };
    window.addEventListener('PCH_CONFIG', (e) => {
        if (e.detail.pch_editor_enabled) {
            new PCHEditor(e.detail);
        }
    });
    window.addEventListener('PCH_PASTE_DATA', (e) => {
        if (e.detail) {
            new PCHEditor({}).submitCode(e.detail);
        }
    });
    class PCHEditor {
        constructor(settings) {
            this.settings = settings;
            this.aceEditor = null;
            this.langSelect = null;
            this.dragOverlay = null;
            this.saveInterval = null;
            this.saveTimeout = null;
            this.isAceInitialized = false;
            this.problemId = PROBLEM_ID;
            this.lastSavedContent = this.settings.draftContent || '';
            this.fileInputEl = null;
            this.submitBtnEl = null;

            this.tryInit();
            this.setupGlobalPasteListener();
            this.setupGlobalDragListener();

            window.addEventListener('beforeunload', () => {
                if (this.saveInterval) clearInterval(this.saveInterval);
                if (this.saveTimeout) clearTimeout(this.saveTimeout);
            });
        }
        tryInit() {
            if (document.querySelector('.pch-helper-box')) return;
            const inject = () => {
                const target = document.querySelector('.submit__des');
                if (target && window.ace) {
                    this.injectEditor(target);
                    return true;
                }
                return false;
            };
            if (inject()) return;
            const observer = new MutationObserver((mutations, obs) => {
                if (inject()) {
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        injectEditor(target) {
            const box = this.createEditorBox();
            let insertAfter = null;
            const parent = target.parentNode;
            if (parent) {
                const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.includes('Giới hạn')) {
                        insertAfter = node.parentElement;
                    }
                }
            }
            if (insertAfter?.nextSibling) {
                insertAfter.parentNode.insertBefore(box, insertAfter.nextSibling);
            } else {
                target.parentNode.insertBefore(box, target.nextSibling);
            }
            this.initAce();
            setTimeout(() => this.createDragOverlay(), 100);
            this.trackStartupPerformance();
            this.setupAutoSave();
        }
        trackStartupPerformance() {
            try {
                const latency = Math.round(performance.now());
                window.dispatchEvent(new CustomEvent('PCH_ANALYTICS', {
                    detail: {
                        name: 'startup_latency',
                        params: { latency_ms: latency }
                    }
                }));
                if (performance.memory) {
                    const usedMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
                    if (usedMB > window.PCH_CONFIG.MEMORY_WARNING_THRESHOLD) {
                        window.dispatchEvent(new CustomEvent('PCH_ANALYTICS', {
                            detail: {
                                name: 'memory_warning',
                                params: { memory_usage_mb: usedMB }
                            }
                        }));
                    }
                }
            } catch (e) { }
        }
        setupGlobalPasteListener() {
            document.addEventListener('paste', (e) => {
                if (!this.aceEditor) return;
                const aceTextInput = document.querySelector('.ace_text-input');
                if (aceTextInput && document.activeElement === aceTextInput) return;
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let item of items) {
                    if (item.kind === 'file') {
                        e.preventDefault();
                        const file = item.getAsFile();
                        if (file) this.handleFileSelect(file);
                        break;
                    }
                }
            });
        }
        setupGlobalDragListener() {
            let dragCounter = 0;
            document.addEventListener('dragenter', (e) => {
                if (e.dataTransfer?.types.includes('Files')) {
                    dragCounter++;
                    if (this.dragOverlay) {
                        this.dragOverlay.style.display = 'flex';
                    }
                }
            });
            document.addEventListener('dragleave', (e) => {
                dragCounter--;
                if (dragCounter === 0 && this.dragOverlay) {
                    this.dragOverlay.style.display = 'none';
                }
            });
            document.addEventListener('drop', (e) => {
                dragCounter = 0;
                if (this.dragOverlay) {
                    this.dragOverlay.style.display = 'none';
                }
            });
        }
        createDragOverlay() {
            this.dragOverlay = document.createElement('div');
            this.dragOverlay.className = 'pch-drag-overlay';
            this.dragOverlay.innerHTML = `
                <div class="pch-drag-content">
                    ${PCH_ICONS.upload}
                    <div class="pch-drag-text">Thả để nhập vào Code Editor</div>
                </div>
            `;
            this.dragOverlay.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            this.dragOverlay.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dragOverlay.style.display = 'none';
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });
            document.body.appendChild(this.dragOverlay);
        }
        handleFileSelect(file) {
            if (!file || !this.aceEditor) return;
            const reader = new FileReader();
            reader.onload = (e) => this.aceEditor.setValue(e.target.result, -1);
            reader.onerror = () => alert('Không thể đọc tệp!');
            reader.readAsText(file);
        }
        createEditorBox() {
            const container = document.createElement('div');
            container.className = 'pch-helper-box';
            const header = document.createElement('div');
            header.className = 'pch-box-header';
            header.innerHTML = `<a href="https://anvu.web.app/pch" target="_blank" class="pch-box-title" style="text-decoration: none; color: #d0011b; font-weight: bold; display: flex; align-items: center; gap: 6px;">${PCH_ICONS.code} PTIT Code Helper</a>`;
            const toolbar = document.createElement('div');
            toolbar.className = 'pch-toolbar';
            this.langSelect = document.createElement('select');
            this.langSelect.className = 'pch-btn';
            const siteCompiler = document.querySelector('#compiler');
            if (siteCompiler) {
                Array.from(siteCompiler.options).forEach(opt => {
                    const myOpt = document.createElement('option');
                    myOpt.value = opt.value;
                    myOpt.text = opt.text;
                    this.langSelect.add(myOpt);
                });
                this.langSelect.value = siteCompiler.value;
                this.langSelect.onchange = () => {
                    siteCompiler.value = this.langSelect.value;
                    siteCompiler.dispatchEvent(new Event('change'));
                    this.updateAceMode();
                };
            }
            toolbar.appendChild(this.langSelect);
            if (this.settings.pch_autosave_enabled) {
                this.saveBtn = document.createElement('button');
                this.saveBtn.className = 'pch-btn';
                this.saveBtn.innerHTML = `${PCH_ICONS.save} Lưu nháp`;
                this.saveBtn.onclick = () => {
                    const content = this.aceEditor.getValue();
                    if (!content.trim()) {
                        window.dispatchEvent(new CustomEvent('PCH_DELETE_DRAFT', {
                            detail: { problemId: this.problemId }
                        }));
                        this.saveBtn.innerHTML = `${PCH_ICONS.check_green} Đã xóa`;
                        setTimeout(() => this.saveBtn.innerHTML = `${PCH_ICONS.save} Lưu nháp`, 1500);
                        return;
                    }
                    window.dispatchEvent(new CustomEvent('PCH_SAVE_DRAFT', {
                        detail: {
                            problemId: this.problemId,
                            content: content
                        }
                    }));
                    this.saveBtn.innerHTML = `${PCH_ICONS.check_green} Đã lưu`;
                    setTimeout(() => this.saveBtn.innerHTML = `${PCH_ICONS.save} Lưu nháp`, 1500);
                };
                toolbar.appendChild(this.saveBtn);
            }
            const clearBtn = document.createElement('button');
            clearBtn.className = 'pch-btn';
            clearBtn.innerHTML = `${PCH_ICONS.trash} Xóa tất cả`;
            clearBtn.onclick = () => {
                this.aceEditor.setValue('');
                window.dispatchEvent(new CustomEvent('PCH_DELETE_DRAFT', {
                    detail: { problemId: this.problemId }
                }));
            };
            toolbar.appendChild(clearBtn);
            const quickBtn = document.createElement('button');
            quickBtn.className = 'pch-btn';
            quickBtn.innerHTML = `${PCH_ICONS.paste} Nộp code từ bộ nhớ tạm`;
            quickBtn.onclick = () => {
                navigator.clipboard.readText()
                    .then(text => {
                        this.submitCode(text);
                    })
                    .catch(() => {
                        window.dispatchEvent(new CustomEvent('PCH_REQ_CLIPBOARD'));
                    });
            };
            toolbar.appendChild(quickBtn);
            const submitBtn = document.createElement('button');
            submitBtn.className = 'pch-btn pch-btn-red';
            submitBtn.textContent = 'Nộp code trong editor';
            submitBtn.onclick = () => this.submitCode(this.aceEditor.getValue());
            toolbar.appendChild(submitBtn);
            header.appendChild(toolbar);
            container.appendChild(header);
            const editorDiv = document.createElement('div');
            editorDiv.id = 'pch-ace-editor';
            container.appendChild(editorDiv);
            return container;
        }
        initAce() {
            if (this.isAceInitialized) return;
            try {
                this.aceEditor = ace.edit("pch-ace-editor");
                this.aceEditor.setTheme('ace/theme/textmate');
                this.aceEditor.setFontSize(14);
                this.aceEditor.setShowPrintMargin(false);
                if (this.langSelect) this.updateAceMode();

                if (this.saveBtn) {
                    this.aceEditor.session.on('change', () => {
                        if (this.saveBtn.innerHTML.includes('Đã lưu')) {
                            this.saveBtn.innerHTML = `${PCH_ICONS.save} Lưu nháp`;
                        }
                    });

                    this.aceEditor.commands.addCommand({
                        name: 'save',
                        bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
                        exec: () => {
                            this.saveBtn.click();
                        }
                    });

                    document.addEventListener('keydown', (e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                            e.preventDefault();
                            this.saveBtn.click();
                        }
                    });
                }
                this.isAceInitialized = true;
            } catch (e) { }
        }
        updateAceMode() {
            if (!this.aceEditor || !this.langSelect) return;
            const text = this.langSelect.options[this.langSelect.selectedIndex].text;
            let mode = 'c_cpp';
            if (text.includes('Java')) mode = 'java';
            else if (text.includes('Python')) mode = 'python';
            else if (text.includes('Golang')) mode = 'golang';
            else if (text.includes('C#')) mode = 'csharp';
            this.aceEditor.session.setMode('ace/mode/' + mode);
        }
        setupAutoSave() {
            if (!this.settings.pch_autosave_enabled) return;
            if (this.settings.draftContent && this.aceEditor.getValue().trim() === '') {
                this.aceEditor.setValue(this.settings.draftContent, -1);
            }
            const save = () => {
                const content = this.aceEditor.getValue();
                if (!content.trim()) return;
                if (content === this.lastSavedContent) return;
                this.lastSavedContent = content;
                window.dispatchEvent(new CustomEvent('PCH_SAVE_DRAFT', {
                    detail: {
                        problemId: this.problemId,
                        content: content
                    }
                }));
            };
            if (this.settings.pch_autosave_mode === 'on_change') {
                this.aceEditor.session.on('change', () => {
                    if (this.saveTimeout) clearTimeout(this.saveTimeout);
                    this.saveTimeout = setTimeout(save, 1000);
                });
            } else if (this.settings.pch_autosave_mode === 'interval') {
                const interval = (this.settings.pch_autosave_interval || 30) * 1000;
                this.saveInterval = setInterval(save, interval);
            }
        }
        submitCode(code) {
            if (!code || !code.trim()) return alert('Code trống!');

            if (!this.fileInputEl) this.fileInputEl = document.querySelector("input[type='file']");
            if (!this.submitBtnEl) this.submitBtnEl = document.querySelector(".submit__pad__btn");

            if (!this.fileInputEl || !this.submitBtnEl) return alert('Không tìm thấy form nộp bài gốc!');

            const file = new File([code], "pch.cpp", { type: "text/plain" });
            const dt = new DataTransfer();
            dt.items.add(file);
            this.fileInputEl.files = dt.files;
            this.fileInputEl.dispatchEvent(new Event('change', { bubbles: true }));
            const oldText = this.submitBtnEl.innerText;
            this.submitBtnEl.innerText = 'Đang nộp...';
            window.dispatchEvent(new CustomEvent('PCH_DELETE_DRAFT', {
                detail: { problemId: this.problemId }
            }));
            setTimeout(() => {
                this.submitBtnEl.click();
                this.submitBtnEl.innerText = oldText;
            }, 500);
        }
    }
})();
