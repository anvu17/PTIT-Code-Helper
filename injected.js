(function () {
    'use strict';

    const ICONS = {
        code: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
        paste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
        upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
        trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path></svg>`,
        save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`
    };

    window.addEventListener("PCH_CONFIG", (e) => {
        if (e.detail.pch_editor_enabled) {
            new PCHEditor(e.detail);
        }
    });

    window.addEventListener("PCH_PASTE_DATA", (e) => {
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
            this.problemId = location.pathname.split('/').pop().toUpperCase();
            this.lastSavedContent = this.settings.draftContent || '';
            this.tryInit();
            this.setupGlobalPasteListener();
            this.setupGlobalDragListener();
        }

        tryInit() {
            if (document.querySelector('.pch-helper-box')) return;

            const inject = () => {
                const target = document.querySelector('.submit__des') || document.querySelector('.problem-content');
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
            this.setupAutoSave();
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
                    ${ICONS.upload}
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
            header.innerHTML = `<a href="https://anvu.web.app/pch" target="_blank" class="pch-box-title" style="text-decoration: none; color: #d0011b; font-weight: bold; display: flex; align-items: center; gap: 6px;">${ICONS.code} PTIT Code Helper</a>`;

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

            if (!this.settings.pch_disable_autosave) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'pch-btn';
                saveBtn.innerHTML = `${ICONS.save} Lưu nháp`;
                saveBtn.onclick = () => {
                    const content = this.aceEditor.getValue();
                    if (!content.trim()) return alert("Code trống!");

                    window.dispatchEvent(new CustomEvent("PCH_SAVE_DRAFT", {
                        detail: {
                            problemId: this.problemId,
                            content: content
                        }
                    }));

                    const original = saveBtn.innerHTML;
                    saveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Đã lưu`;
                    setTimeout(() => saveBtn.innerHTML = original, 1500);
                };
                toolbar.appendChild(saveBtn);
            }

            const clearBtn = document.createElement('button');
            clearBtn.className = 'pch-btn';
            clearBtn.innerHTML = `${ICONS.trash} Xóa tất cả`;
            clearBtn.onclick = () => {
                this.aceEditor.setValue('');
            };
            toolbar.appendChild(clearBtn);

            const quickBtn = document.createElement('button');
            quickBtn.className = 'pch-btn';
            quickBtn.innerHTML = `${ICONS.paste} Nộp code từ bộ nhớ tạm`;
            quickBtn.onclick = () => {
                navigator.clipboard.readText()
                    .then(text => {
                        this.submitCode(text);
                    })
                    .catch(() => {
                        window.dispatchEvent(new CustomEvent("PCH_REQ_CLIPBOARD"));
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
            try {
                this.aceEditor = ace.edit("pch-ace-editor");
                this.aceEditor.setTheme("ace/theme/textmate");
                this.aceEditor.setFontSize(14);
                this.aceEditor.setShowPrintMargin(false);
                if (this.langSelect) this.updateAceMode();
            } catch (e) { }
        }

        updateAceMode() {
            if (!this.aceEditor || !this.langSelect) return;
            const text = this.langSelect.options[this.langSelect.selectedIndex].text;
            let mode = "c_cpp";
            if (text.includes("Java")) mode = "java";
            else if (text.includes("Python")) mode = "python";
            else if (text.includes("Golang")) mode = "golang";
            else if (text.includes("C#")) mode = "csharp";
            this.aceEditor.session.setMode("ace/mode/" + mode);
        }

        setupAutoSave() {
            if (this.settings.pch_disable_autosave) return;

            if (this.settings.draftContent && this.aceEditor.getValue().trim() === '') {
                this.aceEditor.setValue(this.settings.draftContent, -1);
            }

            const save = () => {
                const content = this.aceEditor.getValue();
                if (!content.trim()) return;
                if (content === this.lastSavedContent) return;

                this.lastSavedContent = content;
                window.dispatchEvent(new CustomEvent("PCH_SAVE_DRAFT", {
                    detail: {
                        problemId: this.problemId,
                        content: content
                    }
                }));
            };

            if (this.settings.pch_autosave_on_change) {
                let timeout;
                this.aceEditor.session.on('change', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(save, 1000);
                });
            } else {
                const interval = (this.settings.pch_autosave_interval || 15) * 1000;
                this.saveInterval = setInterval(save, interval);
            }
        }

        submitCode(code) {
            if (!code || !code.trim()) return alert("Code trống!");

            const fileInput = document.querySelector("input[type='file']");
            const submitBtn = document.querySelector(".submit__pad__btn") || document.querySelector(".submit-btn-real");

            if (!fileInput || !submitBtn) return alert("Không tìm thấy form nộp bài gốc!");

            const file = new File([code], "pch.cpp", { type: "text/plain" });
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));

            const oldText = submitBtn.innerText;
            submitBtn.innerText = "Đang nộp...";
            setTimeout(() => {
                submitBtn.click();
                submitBtn.innerText = oldText;
            }, 500);
        }
    }
})();
