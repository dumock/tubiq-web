// TubiQ Desktop - Renderer Process
const logToMain = (...args) => {
    try {
        if (window.electron && window.electron.send) {
            window.electron.send('log-to-main', ...args);
        }
    } catch (e) { }
    console.log(...args);
};

// Trap all global errors and send to main terminal for debugging
window.onerror = (message, source, lineno, colno, error) => {
    logToMain('[Renderer-Fatal]', message, 'at', source, lineno, colno);
};
window.onunhandledrejection = (event) => {
    logToMain('[Renderer-Promise-Rejection]', event.reason);
};

// Robust media URL construction for local paths - using file:// directly
const getMediaUrl = (filePath) => {
    if (!filePath) return '';
    // Use file:// protocol directly since webSecurity is disabled
    const normalizedPath = filePath.replace(/\\/g, '/');
    // Ensure proper file:// URL format for Windows paths
    if (normalizedPath.match(/^[A-Za-z]:/)) {
        return `file:///${normalizedPath}`;
    }
    return `file://${normalizedPath}`;
};

document.addEventListener('DOMContentLoaded', async () => {
    logToMain('[Renderer] DOMContentLoaded - Bridge Verified');
    const sideNav = document.getElementById('sideNav');
    const sidePanelTitle = document.getElementById('sidePanelTitle');
    const workspaceContent = document.getElementById('workspaceContent');
    const activityIcons = document.querySelectorAll('.activity-icon');

    let currentSection = 'snippets';
    let currentNavId = 'snippets'; // Track active nav item
    let snippets = [];
    let currentOpenFolder = null; // Track currently open folder

    // Load snippets
    const mainHeader = document.getElementById('mainHeader');

    // Horizontal scrolling for header with mouse wheel
    if (mainHeader) {
        mainHeader.addEventListener('wheel', (evt) => {
            evt.preventDefault();
            mainHeader.scrollLeft += evt.deltaY;
        });
    }

    // Menu Toggle Functionality
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const sidePanel = document.getElementById('sidePanel');
    let isMenuOpen = true; // Menu starts open

    if (menuToggleBtn && sidePanel) {
        menuToggleBtn.classList.add('menu-open'); // Start with menu open state
        menuToggleBtn.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            sidePanel.classList.toggle('hidden', !isMenuOpen);
            menuToggleBtn.classList.toggle('menu-open', isMenuOpen);
        });
    }

    // File Picker Overlay
    const filePickerOverlay = document.getElementById('filePickerOverlay');
    const filePickerContent = document.getElementById('filePickerContent');
    const filePickerPath = document.getElementById('filePickerPath');
    const filePickerClose = document.getElementById('filePickerClose');
    let filePickerCurrentPath = null;
    let isFilePickerOpen = false;

    // Toggle file picker with folder icon
    window.toggleFilePicker = () => {
        isFilePickerOpen = !isFilePickerOpen;
        filePickerOverlay.classList.toggle('visible', isFilePickerOpen);

        // Update folder icon active state
        const folderIcon = document.querySelector('[data-section="explorer"]');
        if (folderIcon) {
            folderIcon.classList.toggle('active', isFilePickerOpen);
        }
    };

    // Close button
    if (filePickerClose) {
        filePickerClose.addEventListener('click', () => {
            isFilePickerOpen = false;
            filePickerOverlay.classList.remove('visible');
            const folderIcon = document.querySelector('[data-section="explorer"]');
            if (folderIcon) folderIcon.classList.remove('active');
        });
    }

    // Open file picker at specific path
    window.openFilePicker = async (pathOrSpecial) => {
        let targetPath = pathOrSpecial;

        if (pathOrSpecial === 'desktop') {
            targetPath = await electron.getDesktopPath();
        }

        filePickerCurrentPath = targetPath;
        filePickerPath.textContent = targetPath;

        // Show loading
        filePickerContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Loading...</div>';

        try {
            const result = await electron.readDirectory(targetPath);

            if (!result.success) {
                filePickerContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;">Error: ${escapeHtml(result.error)}</div>`;
                return;
            }

            const contents = result.contents;
            const folders = contents.filter(item => item.isDirectory);
            const files = contents.filter(item => !item.isDirectory);

            // Get parent path
            const parentPath = targetPath.split('\\').slice(0, -1).join('\\');
            // Show back if not at drive root (e.g., C:\ or D:\)
            const canGoBack = parentPath && parentPath.length >= 2 && targetPath.length > 3;

            let html = '';

            // Back button
            if (canGoBack) {
                html += `
                    <div class="file-picker-back" onclick="openFilePicker('${parentPath.replace(/\\/g, '\\\\')}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5m7 7l-7-7 7-7"/>
                        </svg>
                        Back
                    </div>
                `;
            }

            // Folders
            folders.forEach(item => {
                html += `
                    <div class="file-picker-item folder" ondblclick="openFilePicker('${item.path.replace(/\\/g, '\\\\')}')">
                        <div class="file-picker-item-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#38bdf8" stroke="#0284c7" stroke-width="1">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            </svg>
                        </div>
                        <span class="file-picker-item-name">${escapeHtml(item.name)}</span>
                    </div>
                `;
            });

            // Files (draggable)
            files.forEach(item => {
                // For images, show actual image; for others, use thumbnail/icon
                let iconHtml = '';
                if (item.type === 'image') {
                    // Use file:// protocol for images (handles Korean paths better)
                    const fileSrc = 'file:///' + item.path.replace(/\\/g, '/');
                    iconHtml = `<img src="${fileSrc}" onerror="this.src='${item.thumbnail}'">`;
                } else {
                    iconHtml = item.thumbnail
                        ? `<img src="${item.thumbnail}">`
                        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                          </svg>`;
                }

                html += `
                    <div class="file-picker-item file" 
                         draggable="true"
                         ondragstart="handleFilePickerDrag(event, '${item.path.replace(/\\/g, '\\\\')}', '${item.type}')"
                         ondblclick="electron.openExternal('${item.path.replace(/\\/g, '\\\\')}')">
                        <div class="file-picker-item-icon">
                            ${iconHtml}
                        </div>
                        <span class="file-picker-item-name">${escapeHtml(item.name)}</span>
                    </div>
                `;
            });

            if (folders.length === 0 && files.length === 0) {
                html = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Empty folder</div>';
            }

            filePickerContent.innerHTML = html;

            // Add double-click on empty space to go back
            filePickerContent.ondblclick = (e) => {
                // Don't trigger if clicking on items or back button
                if (e.target.closest('.file-picker-item') || e.target.closest('.file-picker-back')) {
                    return;
                }
                // Go to parent folder
                const parentPath = filePickerCurrentPath.split('\\').slice(0, -1).join('\\');
                if (parentPath && parentPath.length > 2) {
                    openFilePicker(parentPath);
                }
            };

        } catch (error) {
            filePickerContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;">Error: ${escapeHtml(error.message)}</div>`;
        }
    };

    // Handle drag from file picker
    window.handleFilePickerDrag = (e, path, type) => {
        e.dataTransfer.setData('tubiq-file-path', path);
        e.dataTransfer.setData('tubiq-file-type', type);
        e.dataTransfer.effectAllowed = 'copy';

        // Also trigger native drag for external apps
        electron.startDrag(path);
    };

    window.initHeaderFolders = () => {
        if (!mainHeader) return;
        // Reset current folder tracker
        if (typeof currentOpenFolder !== 'undefined') {
            currentOpenFolder = null;
        }
        electron.getFolders().then(folders => {
            if (!folders || folders.length === 0) {
                // Default placeholders if empty
                const defaults = [
                    { name: 'BGM', icon: 'folder' },
                    { name: 'ES', icon: 'folder' },
                    { name: 'SE', icon: 'folder' }
                ];
                renderHeaderFolders(defaults);
            } else {
                renderHeaderFolders(folders);
            }
        });
    };

    // Track selected download folder
    let selectedDownloadFolder = null;

    // Silence Remover State
    let silenceRemoverState = {
        audioPath: null,
        isProcessing: false,
        threshold: -40,
        minDuration: 0.5,
        isPlaying: false,
        error: null,
        processedPath: null
    };
    let wavesurfer = null;
    let wsRegions = null;

    window.selectFolderForDownload = (path, name, element) => {
        // Remove previous selection
        document.querySelectorAll('.header-folder-item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        if (selectedDownloadFolder === path) {
            // Deselect if clicking same folder
            selectedDownloadFolder = null;
            electron.setDownloadPath(null);
        } else {
            // Select this folder
            selectedDownloadFolder = path;
            element.classList.add('selected');
            electron.setDownloadPath(path);
        }
    };

    window.renderHeaderFolders = (folders) => {
        mainHeader.innerHTML = `
            <div class="header-toggle" onclick="toggleHeaderExplorer()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            ${folders.map(f => `
                <div class="header-folder-item" 
                     onclick="selectFolderForDownload('${f.path.replace(/\\/g, '\\\\')}', '${escapeHtml(f.name)}', this)"
                     ondblclick="event.stopPropagation(); exploreFolder('${f.path.replace(/\\/g, '\\\\')}', '${escapeHtml(f.name)}')">
                    <div class="header-folder-icon">
                        ${getIcon(f.icon || 'folder')}
                    </div>
                    <span class="header-folder-name">${f.name}</span>
                </div>
            `).join('')}
        `;
    };

    window.toggleHeaderExplorer = () => {
        if (mainHeader) {
            mainHeader.classList.toggle('collapsed');
            const isExpanded = !mainHeader.classList.contains('collapsed');
            electron.updateViewBounds(isExpanded);
        }
    };

    window.initHeaderFolders();

    window.openFolderPath = (path) => {
        // Single click just opens the system folder
        electron.openExternal(path);
    };

    window.exploreFolder = async (folderPath, folderName) => {
        // If same folder is clicked again, close it
        if (currentOpenFolder === folderPath) {
            currentOpenFolder = null;
            selectedDownloadFolder = null;
            electron.setDownloadPath(null);
            window.initHeaderFolders();
            return;
        }

        const result = await electron.readDirectory(folderPath);
        if (result.success) {
            currentOpenFolder = folderPath;
            // Also set as download folder when exploring
            selectedDownloadFolder = folderPath;
            electron.setDownloadPath(folderPath);
            renderHeaderExplorer(result.contents, folderPath, folderName);
        } else {
            alert('Failed to read folder: ' + result.error);
        }
    };

    window.handleInternalDragStart = (e, path, type) => {
        e.preventDefault();
        electron.startDrag(path);
    };

    function renderHeaderExplorer(contents, folderPath, folderName) {
        // Build the header content with a horizontal list
        const parentPath = folderPath.split('\\').slice(0, -1).join('\\');

        mainHeader.innerHTML = `
            <div class="header-explorer-shelf">
                <div class="header-explorer-back" onclick="initHeaderFolders()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M19 12H5m7 7l-7-7 7-7"/>
                    </svg>
                </div>
                
                <div class="header-folder-item active" ondblclick="initHeaderFolders()">
                    <div class="header-folder-icon">
                        ${getIcon('folder')}
                    </div>
                    <span class="header-folder-name">${folderName}</span>
                </div>

                <div class="header-explorer-divider"></div>

                <div class="header-explorer-contents">
                    ${contents.map(item => `
                        <div class="header-explorer-item" 
                             draggable="${!item.isDirectory}"
                             ondragstart="handleInternalDragStart(event, '${item.path.replace(/\\/g, '\\\\')}', '${item.type}')"
                             ${item.isDirectory
                ? `onclick="exploreFolder('${item.path.replace(/\\/g, '\\\\')}', '${escapeHtml(item.name)}')"`
                : `ondblclick="electron.openExternal('${item.path.replace(/\\/g, '\\\\')}')"`
            }>
                            ${!item.isDirectory ? `
                                <button class="header-item-delete" onclick="event.stopPropagation(); deleteHeaderFile('${item.path.replace(/\\/g, '\\\\')}')" title="삭제">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                </button>
                            ` : ''}
                            <div class="header-item-icon ${item.isDirectory ? 'is-folder' : 'is-file'}">
                                ${item.isDirectory ? getIcon('folder') : (
                item.type === 'image' ? `<img src="${item.resourcePath}" class="header-item-preview">` :
                    item.type === 'video' ? `<video src="${item.resourcePath}" class="header-item-preview" preload="auto" muted onloadeddata="this.currentTime=1"></video>` :
                        (item.thumbnail ? `<img src="${item.thumbnail}" class="header-item-preview">` : getIcon('file-text'))
            )}
                            </div>
                            <span class="header-item-name">${escapeHtml(item.name)}</span>
                        </div>
                    `).join('')}
                    ${contents.length === 0 ? '<span class="header-empty-text">Empty folder</span>' : ''}
                </div>
            </div>
        `;
    }

    // Delete file from header explorer
    window.deleteHeaderFile = async (filePath) => {
        if (!confirm('이 파일을 삭제하시겠습니까?')) return;

        const result = await electron.deleteFile(filePath);
        if (result.success) {
            // Refresh the current folder view without closing it
            if (currentOpenFolder) {
                const folderName = currentOpenFolder.split('\\').pop();
                const readResult = await electron.readDirectory(currentOpenFolder);
                if (readResult.success) {
                    renderHeaderExplorer(readResult.contents, currentOpenFolder, folderName);
                }
            }
        } else {
            alert('삭제 실패: ' + result.error);
        }
    };


    async function loadSnippets() {
        try {
            snippets = await electron.getSnippets();
            renderSnippets();
        } catch (e) {
            console.error('Failed to load snippets:', e);
        }
    }

    // Render snippets
    function renderSnippets() {
        workspaceContent.innerHTML = `
            <div class="snippets-header">
                <span class="snippets-title">Snippets Collection</span>
                <button class="new-snippet-btn" onclick="openNewSnippetModal()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    New Snippet
                </button>
            </div>
            <div class="snippets-list">
                ${snippets.map(s => {
            const firstChar = s.keyword ? s.keyword.charAt(0) : '';
            const secondChar = s.keyword && s.keyword.length > 1 ? s.keyword.charAt(1) : '';
            const badgeText = firstChar + (secondChar || '');

            return `
                    <div class="snippet-card" data-id="${s.id}">
                        <div class="snippet-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                            </svg>
                        </div>
                        <div class="snippet-info">
                            <div class="snippet-title">${s.title}</div>
                            <div class="snippet-meta">
                                <span class="snippet-keyword">${badgeText}</span>
                                <span class="snippet-preview">${s.content.substring(0, 50)}${s.content.length > 50 ? '...' : ''}</span>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    // Render side nav based on section
    function renderSideNav(section) {
        console.log('[DEBUG] renderSideNav called with section:', section);
        let navItems = [];

        if (section === 'search' || section === 'snippets') {
            sidePanelTitle.textContent = 'LIBRARY';
            navItems = [
                { id: 'videos', icon: 'play-circle', label: 'All Videos' },
                { id: 'channels', icon: 'users', label: 'All Channels' }
            ];
            navItems.push({ type: 'divider', label: 'AUTOMATION' });
            navItems.push({ id: 'snippets', icon: 'layers', label: 'My Snippets', active: true });
            navItems.push({ id: 'clipboard', icon: 'clipboard', label: 'Clipboard History' });
            navItems.push({ id: 'folder-hub', icon: 'folder-minus', label: 'Folder Hub' });
            navItems.push({ id: 'frame-extractor', icon: 'image', label: 'Frame Extractor' });
            navItems.push({ id: 'bg-remover', icon: 'camera', label: 'BG Remover' });
            navItems.push({ id: 'silence-remover', icon: 'music', label: 'Silence Remover' });
            navItems.push({ id: 'script-extractor', icon: 'file-text', label: 'Script Extractor' });
            navItems.push({ id: 'gemini-studio', icon: 'message-square', label: 'Gemini Studio' });
            navItems.push({ id: 'q-audio', icon: 'mic', label: 'Q Audio' }); // Added
        } else if (section === 'explorer') {
            sidePanelTitle.textContent = 'EXPLORER';
            navItems = [
                { id: 'drive-c', icon: 'hard-drive', label: 'C: Drive', path: 'C:\\' },
                { id: 'drive-d', icon: 'hard-drive', label: 'D: Drive', path: 'D:\\' },
                { id: 'desktop', icon: 'monitor', label: 'Desktop', path: 'desktop' }
            ];
        } else if (section === 'automation') {
            sidePanelTitle.textContent = 'AUTOMATION';
            navItems = [
                { id: 'workflows', icon: 'git-branch', label: 'Workflows' },
                { id: 'templates', icon: 'file-text', label: 'Templates' }
            ];
        }

        console.log('[DEBUG] navItems to render:', navItems);

        const html = navItems.map(item => {
            if (item.type === 'divider') {
                return `<div class="nav-divider" style="padding: 16px 16px 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; color: #8b949e;">${item.label}</div>`;
            }
            return `
                <div class="nav-item ${item.active ? 'active' : ''}" data-nav="${item.id}">
                    ${getIcon(item.icon)}
                    <span class="nav-item-text">${item.label}</span>
                </div>
            `;
        }).join('');

        console.log('[DEBUG] Generated HTML length:', html.length);
        if (sideNav) {
            sideNav.innerHTML = html;
            console.log('[DEBUG] sideNav.innerHTML set. Element:', sideNav);
        } else {
            console.error('[DEBUG] sideNav element NOT FOUND');
        }


        // Add nav item click handlers
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const navId = item.dataset.nav;
                handleNavClick(navId);
            });
        });
    }

    function handleNavClick(navId) {
        // Update active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`[data-nav="${navId}"]`)?.classList.add('active');

        // Track current nav id
        currentNavId = navId;

        if (navId === 'videos' || navId === 'channels') {
            // Hide workspace content and show BrowserView
            workspaceContent.style.display = 'none';
            // Collapse header to maximize BrowserView space
            mainHeader.classList.add('collapsed');
            // Ensure header toggle is available
            if (!mainHeader.querySelector('.header-toggle')) {
                initHeaderFolders();
            }
            electron.setViewUrl(navId);
            electron.setViewVisibility(true);
        } else {
            // Show workspace content and hide BrowserView
            workspaceContent.style.display = 'block';
            // Expand header when not in BrowserView mode
            mainHeader.classList.remove('collapsed');
            electron.updateViewBounds(true);
            electron.setViewVisibility(false);
            if (navId === 'snippets') {
                loadSnippets();
            } else if (navId === 'clipboard') {
                loadClipboardHistory();
            } else if (navId === 'folder-hub') {
                loadFolders();
            } else if (navId === 'frame-extractor') {
                renderFrameExtractor();
            } else if (navId === 'bg-remover') {
                renderBackgroundRemover();
            } else if (navId === 'silence-remover') {
                renderSilenceRemover();
            } else if (navId === 'script-extractor') {
                renderScriptExtractor();
            } else if (navId === 'gemini-studio') {
                renderGeminiStudio();
            } else if (navId === 'q-audio') {
                renderQAudio();
            } else if (navId === 'drive-c') {
                renderFileExplorer('C:\\');
            } else if (navId === 'drive-d') {
                renderFileExplorer('D:\\');
            } else if (navId === 'desktop') {
                renderFileExplorer('desktop');
            }
        }
    }

    // File Explorer state
    let explorerCurrentPath = null;
    let explorerHistory = [];

    async function renderFileExplorer(pathOrSpecial) {
        let targetPath = pathOrSpecial;

        // Handle special paths
        if (pathOrSpecial === 'desktop') {
            targetPath = await electron.getDesktopPath();
        }

        explorerCurrentPath = targetPath;

        // Show loading state
        workspaceContent.innerHTML = `
            <div class="file-explorer-container">
                <div class="fe-header">
                    <h2 class="fe-title">File Explorer</h2>
                    <p class="fe-subtitle">${escapeHtml(targetPath)}</p>
                </div>
                <div class="file-explorer-loading">
                    <div class="loading-spinner-small"></div>
                    <span>Loading...</span>
                </div>
            </div>
        `;

        try {
            const result = await electron.readDirectory(targetPath);

            if (!result.success) {
                workspaceContent.innerHTML = `
                    <div class="file-explorer-container">
                        <div class="fe-header">
                            <h2 class="fe-title">File Explorer</h2>
                            <p class="fe-subtitle" style="color: #ef4444;">Error: ${escapeHtml(result.error)}</p>
                        </div>
                    </div>
                `;
                return;
            }

            const contents = result.contents;
            const folders = contents.filter(item => item.isDirectory);
            const files = contents.filter(item => !item.isDirectory);

            // Get parent path
            const parentPath = targetPath.split('\\').slice(0, -1).join('\\');
            const canGoBack = parentPath && parentPath.length > 2;

            workspaceContent.innerHTML = `
                <div class="file-explorer-container">
                    <div class="fe-header" style="margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${canGoBack ? `
                                <button class="fe-back-btn" onclick="navigateExplorer('${parentPath.replace(/\\/g, '\\\\')}')">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M19 12H5m7 7l-7-7 7-7"/>
                                    </svg>
                                </button>
                            ` : ''}
                            <div>
                                <h2 class="fe-title" style="margin-bottom: 4px;">File Explorer</h2>
                                <p class="fe-subtitle" style="font-size: 12px; color: #64748b;">${escapeHtml(targetPath)}</p>
                            </div>
                        </div>
                    </div>
                    
                    ${folders.length > 0 ? `
                        <div class="explorer-section">
                            <div class="explorer-section-title">Folders (${folders.length})</div>
                            <div class="explorer-grid">
                                ${folders.map(item => `
                                    <div class="explorer-item folder" ondblclick="navigateExplorer('${item.path.replace(/\\/g, '\\\\')}')">
                                        <div class="explorer-item-icon folder-icon">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="#38bdf8" stroke="#0284c7" stroke-width="1">
                                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                            </svg>
                                        </div>
                                        <span class="explorer-item-name">${escapeHtml(item.name)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${files.length > 0 ? `
                        <div class="explorer-section">
                            <div class="explorer-section-title">Files (${files.length})</div>
                            <div class="explorer-grid">
                                ${files.map(item => `
                                    <div class="explorer-item file" 
                                         ondblclick="electron.openExternal('${item.path.replace(/\\/g, '\\\\')}')"
                                         draggable="true"
                                         ondragstart="handleInternalDragStart(event, '${item.path.replace(/\\/g, '\\\\')}', '${item.type}')">
                                        <div class="explorer-item-icon file-icon">
                                            ${item.type === 'image' ? `<img src="${item.resourcePath}" class="explorer-preview">` :
                    item.type === 'video' ? `<video src="${item.resourcePath}" class="explorer-preview" preload="auto" muted onloadeddata="this.currentTime=1"></video>` :
                        `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5">
                                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                  <polyline points="14 2 14 8 20 8"/>
                                              </svg>`}
                                        </div>
                                        <span class="explorer-item-name">${escapeHtml(item.name)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${folders.length === 0 && files.length === 0 ? `
                        <div class="explorer-empty">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            </svg>
                            <p>This folder is empty</p>
                        </div>
                    ` : ''}
                </div>
            `;
        } catch (error) {
            workspaceContent.innerHTML = `
                <div class="file-explorer-container">
                    <div class="fe-header">
                        <h2 class="fe-title">File Explorer</h2>
                        <p class="fe-subtitle" style="color: #ef4444;">Error: ${escapeHtml(error.message)}</p>
                    </div>
                </div>
            `;
        }
    }

    window.navigateExplorer = (path) => {
        renderFileExplorer(path);
    };

    async function loadFolders() {
        try {
            const folders = await electron.getFolders();
            renderFolderHub(folders);
        } catch (e) {
            console.error('Failed to load folders:', e);
        }
    }

    function renderFolderHub(folders, mode = 'customize') {
        workspaceContent.innerHTML = `
            <div class="folder-hub-header">
                <div>
                    <span class="folder-hub-title">${mode === 'customize' ? 'Folder Customizer' : 'Manage Shortcuts'}</span>
                    <p class="folder-hub-subtitle">${mode === 'customize' ? 'Design and match your local directories to the top bar' : 'Edit or remove your existing top bar shortcuts'}</p>
                </div>
                <div style="margin-top: 24px;">
                    <button class="btn-secondary" style="margin-right: 12px;" onclick="renderFolderHub([], '${mode === 'customize' ? 'manage' : 'customize'}')">
                        ${mode === 'customize' ? 'Manage Existing' : 'Back to Customizer'}
                    </button>
                </div>
            </div>
            
            <div class="folder-hub-container">
                ${mode === 'customize' ? `
                    <div class="folder-settings-pane">
                        ${renderFolderSettings()}
                    </div>
                ` : `
                    <div class="folder-settings-pane" style="width: 800px;">
                        <div class="section-label">EXISTING SHORTCUTS</div>
                        ${!folders || folders.length === 0 ? `
                             <div class="empty-folders" style="padding: 40px;">
                                <p>No shortcuts added yet.</p>
                            </div>
                        ` : `
                            <div class="folder-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                ${folders.map(f => `
                                    <div class="folder-card" style="margin: 0; padding: 20px;">
                                        <div class="folder-card-main">
                                            <div class="folder-icon-box" style="color: #74b9ff;">
                                                ${getIcon(f.icon || 'folder')}
                                            </div>
                                            <div class="folder-info">
                                                <div class="folder-name">${escapeHtml(f.name)}</div>
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 8px;">
                                            <button class="delete-folder-btn" onclick="removeShortcut('${f.id}')">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                    <path d="M18 6L6 18M6 6l12 12"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                `}
            </div>
        `;
    }

    window.removeShortcut = async (id) => {
        if (confirm('Remove this shortcut?')) {
            await electron.deleteFolder(id);
            initHeaderFolders();
            loadFolders();
        }
    };

    let draftFolder = {
        icon: 'folder',
        mode: 'folders',
        path: ''
    };

    function renderFolderSettings(folder = null) {
        const isEditing = !!folder;
        const currentIcon = isEditing ? folder.icon : draftFolder.icon;
        const currentMode = isEditing ? folder.mode : draftFolder.mode;
        const currentPath = isEditing ? folder.path : draftFolder.path;

        const icons = [
            'folder', 'layers', 'clipboard', 'play-circle', 'users', 'git-branch', 'file-text', 'star', 'search', 'settings',
            'mail', 'bell', 'calendar', 'camera', 'cloud', 'cpu', 'database', 'edit', 'eye', 'gift',
            'heart', 'home', 'image', 'link', 'lock', 'map-pin', 'moon', 'music', 'package', 'phone'
        ];

        return `
            <div class="icon-selector-section">
                <span class="section-label">SELECT ICON</span>
                <input type="text" class="icon-search-input" id="iconSearchInput" placeholder="Search icons (e.g. folder, layers)" oninput="filterIcons(this.value)" />
                <div class="icon-grid" id="iconSelectorGrid">
                    ${icons.map(icon => `
                        <div class="icon-item ${currentIcon === icon ? 'selected' : ''}" data-icon="${icon}" onclick="setDraftIcon('${icon}')">
                            ${getIcon(icon)}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="mode-selector-section">
                <span class="section-label">FOLDERS MODE</span>
                <div class="segmented-control">
                    <div class="segment-item ${currentMode === 'subfolders' ? 'active' : ''}" onclick="setDraftMode('subfolders')">Subfolders</div>
                    <div class="segment-item ${currentMode === 'folders' ? 'active' : ''}" onclick="setDraftMode('folders')">Folders</div>
                </div>
            </div>

            <div class="folder-preview-section" style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px; background: #f8fbff; border-radius: 24px; border: 1px solid #eef4ff;">
                <div class="folder-preview-icon" style="color: #38bdf8;">
                    ${getIcon(currentIcon)}
                </div>
                <span style="font-size: 18px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(draftFolder.name || 'Folder Name')}</span>
            </div>

            <div class="path-selector-section">
                <span class="section-label">SELECT USERS FOLDER</span>
                <div class="path-display-box" onclick="selectFolderPath()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <span class="path-text">${currentPath || 'Click here to select folders →'}</span>
                </div>
            </div>

            <div class="pills-section">
                <span class="section-label">ADD OR EDIT</span>
                <div class="pills-container">
                    <div class="pill-item">
                        ${getIcon('layers')}
                        <span class="pill-remove">×</span>
                    </div>
                    <div class="pill-item">
                        ${getIcon('users')}
                        <span class="pill-remove">×</span>
                    </div>
                    <div class="pill-item">
                        ${getIcon('play-circle')}
                        <span class="pill-remove">×</span>
                    </div>
                </div>
            </div>

            <div class="settings-footer">
                <button class="btn-secondary" onclick="resetDraft()">Cancel</button>
                <button class="btn-primary" onclick="saveFolderConfiguration()">${isEditing ? 'Update' : 'Add'}</button>
            </div>
        `;
    }

    window.setDraftIcon = (icon) => {
        draftFolder.icon = icon;
        updateSettingsUI();
    };

    window.setDraftMode = (mode) => {
        draftFolder.mode = mode;
        updateSettingsUI();
    };

    window.selectFolderPath = async () => {
        const result = await electron.selectFolder();
        if (result.success) {
            draftFolder.path = result.folder.path;
            draftFolder.name = result.folder.name;
            updateSettingsUI();
        }
    };

    window.resetDraft = () => {
        draftFolder = { icon: 'folder', mode: 'folders', path: '' };
        updateSettingsUI();
    };

    function updateSettingsUI() {
        const pane = document.querySelector('.folder-settings-pane');
        if (pane) {
            pane.innerHTML = renderFolderSettings();
        }
    }


    window.selectFolderToEdit = async (id) => {
        const folders = await electron.getFolders();
        const folder = folders.find(f => f.id === id);
        if (folder) {
            draftFolder = { ...folder };
            // Highlight the active card
            document.querySelectorAll('.folder-card').forEach(card => card.classList.remove('active'));
            const el = Array.from(document.querySelectorAll('.folder-card')).find(c => c.onclick.toString().includes(id));
            if (el) el.classList.add('active');

            updateSettingsUI(folder);
        }
    };

    window.filterIcons = (query) => {
        const grid = document.getElementById('iconSelectorGrid');
        const items = grid.querySelectorAll('.icon-item');
        const q = query.toLowerCase();

        items.forEach(item => {
            const icon = item.dataset.icon;
            if (icon.includes(q)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    };

    window.saveFolderConfiguration = async () => {
        if (!draftFolder.name || !draftFolder.path) {
            alert('Please select a folder and set a name/icon first.');
            return;
        }

        const success = await electron.saveFolder(draftFolder);
        if (success) {
            resetDraft();
            initHeaderFolders();
            loadFolders();
        }
    };

    // Frame Extractor state
    let frameExtractorState = {
        source: null, // 'file' or 'youtube'
        filePath: null,
        youtubeUrl: '',
        frameCount: 20,
        outputPath: null
    };

    // BG Remover state
    let bgRemoverState = {
        originalImage: null,
        processedImage: null,
        isProcessing: false,
        error: null,
        // Touch-up mode
        editMode: null, // 'eraser' | 'mask' | null
        brushSize: 20,
        undoStack: [],
        currentCanvas: null
    };

    function renderBackgroundRemover() {
        workspaceContent.innerHTML = `
            <div class="bg-remover-container">
                <div class="fe-header">
                    <h2 class="fe-title">BG Remover</h2>
                    <p class="fe-subtitle">이미지에서 배경을 자동으로 제거합니다</p>
                </div>

                <div class="fe-drop-zone ${bgRemoverState.originalImage ? 'has-file' : ''}" id="bgDropZone">
                    ${bgRemoverState.originalImage ? `
                        <div class="bg-preview-wrapper ${bgRemoverState.processedImage ? 'comparison' : ''}">
                            <div class="bg-preview-item">
                                <span class="bg-preview-label">Original</span>
                                <img src="${bgRemoverState.originalImage}" class="bg-preview-img">
                            </div>
                            ${bgRemoverState.processedImage ? `
                                <div class="bg-preview-item">
                                    <span class="bg-preview-label">Result</span>
                                    <img src="${bgRemoverState.processedImage}" class="bg-preview-img processed">
                                </div>
                            ` : ''}
                        </div>
                        <div class="bg-file-actions">
                            <button class="fe-clear-btn" onclick="clearBgRemover()">Change Image</button>
                        </div>
                    ` : `
                        <div class="fe-drop-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                        </div>
                        <div class="fe-drop-text">이미지 파일을 드래그하거나 클릭하여 선택</div>
                        <div class="fe-drop-hint">PNG, JPG, WEBP 지원</div>
                    `}
                    <input type="file" id="bgFileInput" accept="image/*" style="display:none">
                </div>

                ${bgRemoverState.originalImage && !bgRemoverState.processedImage ? `
                    <button class="fe-extract-btn" id="bgProcessBtn" onclick="processBackgroundRemoval()" ${bgRemoverState.isProcessing ? 'disabled' : ''}>
                        ${bgRemoverState.isProcessing ? `
                            <div class="loading-spinner-small"></div> Processing...
                        ` : `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                            Remove Background
                        `}
                    </button>
                ` : ''}

                ${bgRemoverState.processedImage ? `
                    <!-- Edit Toolbar (visible in edit mode) -->
                    ${bgRemoverState.editMode ? `
                        <div class="bg-edit-toolbar">
                            <button class="bg-tool-btn ${bgRemoverState.editMode === 'eraser' ? 'active' : ''}" onclick="setBgEditMode('eraser')" title="직접 지우개">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 20H7L3 16c-1-1-1-3 0-4l9-9c1-1 3-1 4 0l5 5c1 1 1 3 0 4l-6 6"/>
                                    <path d="M6.5 17.5L17 7"/>
                                </svg>
                            </button>
                            <button class="bg-tool-btn ${bgRemoverState.editMode === 'mask' ? 'active' : ''}" onclick="setBgEditMode('mask')" title="AI 마스크">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 8v8M8 12h8"/>
                                </svg>
                            </button>
                            <div class="bg-brush-control">
                                <span>Size:</span>
                                <input type="range" min="5" max="50" value="${bgRemoverState.brushSize}" onchange="setBgBrushSize(this.value)" class="bg-brush-slider">
                                <span id="brushSizeLabel">${bgRemoverState.brushSize}px</span>
                            </div>
                            <button class="bg-tool-btn" onclick="undoBgEdit()" title="되돌리기" ${bgRemoverState.undoStack.length === 0 ? 'disabled' : ''}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 10h10a5 5 0 0 1 5 5v2M3 10l6-6M3 10l6 6"/>
                                </svg>
                            </button>
                            ${bgRemoverState.editMode === 'mask' ? `
                                <button class="bg-tool-btn apply-btn" onclick="applyMaskRemoval()" title="마스크 적용">
                                    Apply AI
                                </button>
                            ` : ''}
                            <button class="bg-tool-btn done-btn" onclick="finishBgEdit()" title="완료">
                                Done
                            </button>
                        </div>
                    ` : ''}
                    
                    <!-- Canvas for editing -->
                    <div class="bg-edit-canvas-container" id="bgEditCanvasContainer" style="display: ${bgRemoverState.editMode ? 'block' : 'none'}">
                        <canvas id="bgEditCanvas"></canvas>
                    </div>
                    
                    <div class="bg-result-actions">
                        ${!bgRemoverState.editMode ? `
                            <button class="btn-secondary" onclick="startBgEdit()" style="margin-right: 12px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                </svg>
                                Touch Up
                            </button>
                        ` : ''}
                        <button class="fe-extract-btn" onclick="saveBgRemovedImage()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                            </svg>
                            Download PNG
                        </button>
                    </div>
                ` : ''}

                ${bgRemoverState.error ? `
                    <div class="fe-progress-text" style="color: #EF4444; margin-top: 12px;">오류: ${bgRemoverState.error}</div>
                ` : ''}
                
                <div class="fe-progress-container" id="bgProgressContainer" style="display:${bgRemoverState.isProcessing ? 'block' : 'none'}">
                    <div class="fe-progress-bar" id="bgProgressBar" style="width: 100%; transition: none; animation: shimmer 2s infinite linear;"></div>
                    <div class="fe-progress-text" id="bgProgressText">배경 제거 중... (첫 실행 시 모델 다운로드로 시간이 걸릴 수 있습니다)</div>
                </div>
            </div>
        `;

        // Setup event listeners
        const dropZone = document.getElementById('bgDropZone');
        const fileInput = document.getElementById('bgFileInput');

        if (dropZone && fileInput) {
            dropZone.addEventListener('click', (e) => {
                if (!bgRemoverState.originalImage) fileInput.click();
            });
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');

                // Check for internal drag
                const internalPath = e.dataTransfer.getData('tubiq-file-path');
                if (internalPath) {
                    const type = e.dataTransfer.getData('tubiq-file-type');
                    if (type === 'image') {
                        handleBgImageSelect(internalPath);
                        return;
                    }
                }

                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    handleBgImageSelect(file);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    handleBgImageSelect(e.target.files[0]);
                }
            });
        }
    }

    async function handleBgImageSelect(fileOrPath) {
        let filePath;
        let isInternal = typeof fileOrPath === 'string';

        if (isInternal) {
            filePath = fileOrPath;
        } else {
            filePath = electron.getFilePath(fileOrPath);
        }

        if (filePath) {
            bgRemoverState.originalPath = filePath;

            if (isInternal) {
                // For internal path, use resource protocol for preview
                bgRemoverState.originalImage = `tubiq-resource://${encodeURIComponent(filePath)}`;
                bgRemoverState.processedImage = null;
                bgRemoverState.error = null;
                renderBackgroundRemover();
            } else {
                // Create preview URL for local file
                const reader = new FileReader();
                reader.onload = (e) => {
                    bgRemoverState.originalImage = e.target.result;
                    bgRemoverState.processedImage = null;
                    bgRemoverState.error = null;
                    renderBackgroundRemover();
                };
                reader.readAsDataURL(fileOrPath);
            }
        }
    }

    window.clearBgRemover = () => {
        bgRemoverState = {
            originalImage: null,
            processedImage: null,
            isProcessing: false,
            error: null
        };
        renderBackgroundRemover();
    };

    window.processBackgroundRemoval = async () => {
        if (!bgRemoverState.originalPath) return;

        bgRemoverState.isProcessing = true;
        bgRemoverState.error = null;
        renderBackgroundRemover();

        try {
            const result = await electron.removeBackground(bgRemoverState.originalPath);
            if (result.success) {
                bgRemoverState.processedImage = result.image; // base64
            } else {
                bgRemoverState.error = result.error;
            }
        } catch (e) {
            bgRemoverState.error = e.message;
        } finally {
            bgRemoverState.isProcessing = false;
            renderBackgroundRemover();
        }
    };

    window.saveBgRemovedImage = async () => {
        if (!bgRemoverState.processedImage) return;

        let fileName = 'bg_removed.png';
        if (bgRemoverState.originalPath) {
            const parts = bgRemoverState.originalPath.split(/[\\/]/);
            const fullFileName = parts[parts.length - 1];
            const dotIndex = fullFileName.lastIndexOf('.');
            const baseName = dotIndex !== -1 ? fullFileName.substring(0, dotIndex) : fullFileName;
            fileName = baseName + '_rembg.png';
        }

        const result = await electron.selectFolder();
        if (result.success && result.folder && result.folder.path) {
            const savePath = result.folder.path + (result.folder.path.endsWith('\\') ? '' : '\\') + fileName;
            const saveResult = await electron.saveBase64Image(bgRemoverState.processedImage, savePath);
            if (saveResult.success) {
                alert('이미지가 저장되었습니다: ' + savePath);
            } else {
                alert('저장 실패: ' + saveResult.error);
            }
        }
    };

    // ============ BG Remover Touch-Up Functions ============
    let bgEditCanvas, bgEditCtx, bgMaskCanvas, bgMaskCtx;
    let isDrawing = false;

    window.startBgEdit = () => {
        bgRemoverState.editMode = 'eraser';
        bgRemoverState.undoStack = [];
        renderBackgroundRemover();
        setTimeout(() => initBgEditCanvas(), 50);
    };

    window.setBgEditMode = (mode) => {
        bgRemoverState.editMode = mode;
        renderBackgroundRemover();
        setTimeout(() => initBgEditCanvas(), 50);
    };

    window.setBgBrushSize = (size) => {
        bgRemoverState.brushSize = parseInt(size);
        const label = document.getElementById('brushSizeLabel');
        if (label) label.textContent = size + 'px';
    };

    window.finishBgEdit = () => {
        if (bgEditCanvas) {
            bgRemoverState.processedImage = bgEditCanvas.toDataURL('image/png');
        }
        bgRemoverState.editMode = null;
        bgRemoverState.undoStack = [];
        renderBackgroundRemover();
    };

    window.undoBgEdit = () => {
        if (bgRemoverState.undoStack.length > 0) {
            const prevState = bgRemoverState.undoStack.pop();
            if (bgEditCtx && prevState) {
                const img = new Image();
                img.onload = () => {
                    bgEditCtx.clearRect(0, 0, bgEditCanvas.width, bgEditCanvas.height);
                    bgEditCtx.drawImage(img, 0, 0);
                };
                img.src = prevState;
            }
        }
    };

    function initBgEditCanvas() {
        const container = document.getElementById('bgEditCanvasContainer');
        bgEditCanvas = document.getElementById('bgEditCanvas');
        if (!bgEditCanvas || !container) return;

        bgEditCtx = bgEditCanvas.getContext('2d');

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const maxWidth = 600;
            const scale = Math.min(1, maxWidth / img.width);
            bgEditCanvas.width = img.width * scale;
            bgEditCanvas.height = img.height * scale;
            bgEditCtx.drawImage(img, 0, 0, bgEditCanvas.width, bgEditCanvas.height);

            if (bgRemoverState.editMode === 'mask') {
                bgMaskCanvas = document.createElement('canvas');
                bgMaskCanvas.width = bgEditCanvas.width;
                bgMaskCanvas.height = bgEditCanvas.height;
                bgMaskCtx = bgMaskCanvas.getContext('2d');
                bgMaskCtx.clearRect(0, 0, bgMaskCanvas.width, bgMaskCanvas.height);
            }
        };
        img.src = bgRemoverState.processedImage;

        bgEditCanvas.onmousedown = (e) => {
            isDrawing = true;
            if (bgEditCanvas && bgRemoverState.undoStack.length < 20) {
                bgRemoverState.undoStack.push(bgEditCanvas.toDataURL('image/png'));
            }
            draw(e);
        };
        bgEditCanvas.onmousemove = (e) => { if (isDrawing) draw(e); };
        bgEditCanvas.onmouseup = () => isDrawing = false;
        bgEditCanvas.onmouseleave = () => isDrawing = false;
    }

    function draw(e) {
        if (!bgEditCtx) return;
        const rect = bgEditCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const radius = bgRemoverState.brushSize / 2;

        if (bgRemoverState.editMode === 'eraser') {
            bgEditCtx.save();
            bgEditCtx.globalCompositeOperation = 'destination-out';
            bgEditCtx.beginPath();
            bgEditCtx.arc(x, y, radius, 0, Math.PI * 2);
            bgEditCtx.fill();
            bgEditCtx.restore();
        } else if (bgRemoverState.editMode === 'mask') {
            bgEditCtx.save();
            bgEditCtx.fillStyle = 'rgba(255, 0, 0, 0.4)';
            bgEditCtx.beginPath();
            bgEditCtx.arc(x, y, radius, 0, Math.PI * 2);
            bgEditCtx.fill();
            bgEditCtx.restore();
            if (bgMaskCtx) {
                bgMaskCtx.fillStyle = '#FFFFFF';
                bgMaskCtx.beginPath();
                bgMaskCtx.arc(x, y, radius, 0, Math.PI * 2);
                bgMaskCtx.fill();
            }
        }
    }

    window.applyMaskRemoval = async () => {
        if (!bgMaskCanvas || !bgEditCanvas) return;
        bgRemoverState.isProcessing = true;
        renderBackgroundRemover();
        try {
            const maskBase64 = bgMaskCanvas.toDataURL('image/png');
            const imageBase64 = bgRemoverState.processedImage;
            const result = await electron.removeBgMasked({ image: imageBase64, mask: maskBase64 });
            if (result.success) {
                bgRemoverState.processedImage = result.image;
                bgRemoverState.undoStack = [];
            } else {
                alert('마스크 처리 실패: ' + result.error);
            }
        } catch (e) {
            alert('오류: ' + e.message);
        } finally {
            bgRemoverState.isProcessing = false;
            renderBackgroundRemover();
            setTimeout(() => initBgEditCanvas(), 50);
        }
    };

    // ============ Gemini Studio Functions ============
    let geminiStudioState = {
        messages: [], // { role: 'user'|'model', text: string, attachments?: [] }
        systemInstruction: '',
        model: 'gemini-3-pro-preview',
        temperature: 1.0,
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ],
        isStreaming: false,
        attachments: [] // { name: string, type: string, base64: string }
    };

    window.updateGsState = (key, value) => {
        if (key === 'system') geminiStudioState.systemInstruction = value;
        if (key === 'model') geminiStudioState.model = value;
        if (key === 'temp') {
            geminiStudioState.temperature = parseFloat(value);
            const lbl = document.getElementById('gsTempLabel');
            if (lbl) lbl.textContent = value;
        }
    };

    window.toggleSafetySettings = () => {
        const el = document.getElementById('gsSafetyPane');
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    };

    window.updateSafety = (category, threshold) => {
        const idx = geminiStudioState.safetySettings.findIndex(s => s.category === category);
        if (idx !== -1) {
            geminiStudioState.safetySettings[idx].threshold = threshold;
        }
    };

    function renderGeminiStudio() {
        // Prevent rendering if not on gemini-studio page
        if (currentNavId !== 'gemini-studio') {
            console.log('[DEBUG] renderGeminiStudio called but currentNavId is', currentNavId, '- skipping');
            return;
        }

        workspaceContent.innerHTML = `
            <div class="gs-container">
                <!-- Settings Panel -->
                <div class="gs-settings-panel">
                    <div class="gs-panel-header">
                        <h3>Gemini Studio</h3>
                        <span class="gs-badge">API Mode</span>
                    </div>
                    
                    <div class="gs-setting-group">
                        <label>System Instructions</label>
                        <textarea class="gs-textarea system" placeholder="Ex: You are a helpful assistant..." onchange="updateGsState('system', this.value)">${geminiStudioState.systemInstruction}</textarea>
                    </div>

                    <div class="gs-setting-group">
                        <label>Model</label>
                        <div class="fe-select-wrapper">
                            <select class="fe-select" onchange="updateGsState('model', this.value)">
                                <option value="gemini-3-pro-preview" ${geminiStudioState.model === 'gemini-3-pro-preview' ? 'selected' : ''}>Gemini 3 Pro</option>
                                <option value="gemini-3-flash-preview" ${geminiStudioState.model === 'gemini-3-flash-preview' ? 'selected' : ''}>Gemini 3 Flash</option>
                                <option value="gemini-2.5-pro" ${geminiStudioState.model === 'gemini-2.5-pro' ? 'selected' : ''}>Gemini 2.5 Pro</option>
                                <option value="gemini-2.5-flash" ${geminiStudioState.model === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash</option>
                                <option value="gemini-2.0-flash" ${geminiStudioState.model === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash</option>
                                <option value="gemini-1.5-pro" ${geminiStudioState.model === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro</option>
                                <option value="gemini-1.5-flash" ${geminiStudioState.model === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
                            </select>
                        </div>
                    </div>

                    <div class="gs-setting-group">
                        <label>Temperature: <span id="gsTempLabel">${geminiStudioState.temperature}</span></label>
                        <input type="range" class="gs-slider" min="0" max="2" step="0.1" value="${geminiStudioState.temperature}" oninput="updateGsState('temp', this.value)">
                    </div>

                    <div class="gs-setting-group">
                        <button class="btn-secondary full-width" onclick="toggleSafetySettings()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Safety Settings
                        </button>
                        <div id="gsSafetyPane" style="display:none; margin-top:10px; background: #fff; padding:10px; border-radius:8px; border:1px solid #eee;">
                            ${renderSafetyControls()}
                        </div>
                    </div>
                </div>

                <!-- Chat Panel -->
                <div class="gs-chat-panel">
                    <div class="gs-chat-history" id="gsChatHistory">
                        ${geminiStudioState.messages.length === 0 ? `
                            <div class="gs-empty-state">
                                <div class="gs-empty-icon">✨</div>
                                <h3>Hello, Human!</h3>
                                <p>Ready to chat with ${geminiStudioState.model}</p>
                            </div>
                        ` : renderGsMessages()}
                        ${geminiStudioState.isStreaming ? `<div class="gs-message model"><div class="typing-indicator"><span></span><span></span><span></span></div></div>` : ''}
                    </div>
                    <div class="gs-input-container" id="gsInputContainer">
                        ${geminiStudioState.attachments.length > 0 ? `
                            <div class="gs-inline-attachments">
                                ${geminiStudioState.attachments.map((att, idx) => `
                                    <div class="gs-inline-attachment">
                                        <img src="${att.base64}" alt="${att.name}" />
                                        <button class="gs-inline-attachment-remove" onclick="removeGsAttachment(${idx})">&times;</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        <div class="gs-input-row">
                            <button class="gs-plus-btn" onclick="document.getElementById('gsFileInput').click()" title="Add image">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                            <input type="file" id="gsFileInput" accept="image/*" style="display:none" onchange="handleGsFileSelect(event)" multiple />
                            <textarea id="gsInput" placeholder="메시지를 입력하세요..." onkeydown="handleGsKey(event)"></textarea>
                            <button class="gs-send-btn" onclick="sendGsMessage()" ${geminiStudioState.isStreaming ? 'disabled' : ''}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        scrollToBottom();
    }

    function renderSafetyControls() {
        const levels = ['BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE'];
        const labels = ['Off', 'Low', 'Medium', 'High'];

        return geminiStudioState.safetySettings.map(s => {
            const currentLevel = s.threshold;
            return `
                <div class="gs-safety-item">
                    <label style="font-size:11px;">${s.category.replace('HARM_CATEGORY_', '')}</label>
                    <select class="fe-select small" onchange="updateSafety('${s.category}', this.value)">
                        ${levels.map((l, i) => `<option value="${l}" ${l === currentLevel ? 'selected' : ''}>${labels[i]}</option>`).join('')}
                    </select>
                </div>
            `;
        }).join('');
    }

    function renderGsMessages() {
        return geminiStudioState.messages.map(m => {
            const attachmentsHtml = m.attachments && m.attachments.length > 0
                ? `<div class="gs-message-attachments">
                    ${m.attachments.map(att => `<img src="${att.base64}" class="gs-message-attachment-img" alt="${att.name}" onclick="openGsImageModal('${att.base64}')" title="Click to expand" />`).join('')}
                   </div>`
                : '';
            return `
                <div class="gs-message ${m.role}">
                    <div class="gs-bubble">
                        ${attachmentsHtml}
                        ${formatMessageContent(m.text)}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Image Modal Logic
    window.openGsImageModal = (base64) => {
        let modal = document.getElementById('gsImageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gsImageModal';
            modal.className = 'gs-image-modal';
            modal.innerHTML = `
                <div class="gs-image-modal-content">
                    <button class="gs-image-modal-close" onclick="closeGsImageModal()">&times;</button>
                    <img id="gsImageModalImg" class="gs-image-modal-img" src="" />
                    <button id="gsImageModalDownload" class="gs-image-modal-download" onclick="">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download Image
                    </button>
                </div>
            `;
            document.body.appendChild(modal);

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeGsImageModal();
            });
        }

        const img = document.getElementById('gsImageModalImg');
        const btn = document.getElementById('gsImageModalDownload');
        img.src = base64;
        btn.onclick = () => downloadGsImage(base64);

        modal.classList.add('active');
    };

    window.closeGsImageModal = () => {
        const modal = document.getElementById('gsImageModal');
        if (modal) modal.classList.remove('active');
    };

    window.downloadGsImage = async (base64) => {
        try {
            const timestamp = new Date().getTime();
            const result = await electron.gemini.saveImage({
                base64,
                filename: `gemini_image_${timestamp}.png`
            });
            if (result.success) {
                // Optional: Show toast or feedback
                console.log('Image saved successfully');
            }
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    function formatMessageContent(text) {
        // Basic formatting
        return text
            .replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    window.handleGsKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendGsMessage();
        }
    };

    // Handle file selection for attachments
    window.handleGsFileSelect = (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                geminiStudioState.attachments.push({
                    name: file.name,
                    type: file.type,
                    base64: e.target.result
                });
                renderGeminiStudio();
            };
            reader.readAsDataURL(file);
        });

        // Reset file input
        event.target.value = '';
    };

    // Remove attachment by index
    window.removeGsAttachment = (index) => {
        geminiStudioState.attachments.splice(index, 1);
        renderGeminiStudio();
    };

    // Drag and drop support for attachments
    function initGsDragDrop() {
        // Use document-level event delegation since container is re-rendered
        document.addEventListener('dragover', (e) => {
            const container = document.getElementById('gsInputContainer');
            if (container && container.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                container.classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const container = document.getElementById('gsInputContainer');
            if (container && !container.contains(e.relatedTarget)) {
                container.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            const container = document.getElementById('gsInputContainer');
            if (container && container.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                container.classList.remove('drag-over');

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    Array.from(files).forEach(file => {
                        if (!file.type.startsWith('image/')) return;

                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            geminiStudioState.attachments.push({
                                name: file.name,
                                type: file.type,
                                base64: ev.target.result
                            });
                            renderGeminiStudio();
                        };
                        reader.readAsDataURL(file);
                    });
                }
            }
        });
    }

    // Initialize drag and drop
    initGsDragDrop();

    window.sendGsMessage = async () => {
        const input = document.getElementById('gsInput');
        const text = input.value.trim();
        const hasAttachments = geminiStudioState.attachments.length > 0;

        if (!text && !hasAttachments) return;

        // Copy attachments and clear them
        const currentAttachments = [...geminiStudioState.attachments];
        geminiStudioState.attachments = [];

        // Add user message (with attachment info for display)
        const userMessage = {
            role: 'user',
            text: text || (hasAttachments ? '[Image attached]' : ''),
            attachments: currentAttachments
        };
        geminiStudioState.messages.push(userMessage);
        input.value = '';
        geminiStudioState.isStreaming = true;
        geminiStudioState.streamingText = '';
        renderGeminiStudio();

        try {
            // Sync session to main process before API call
            const session = await electron.getSession();
            if (session?.access_token && session?.refresh_token) {
                await electron.syncSession({
                    access_token: session.access_token,
                    refresh_token: session.refresh_token
                });
            }

            // Prepare API payload with streaming enabled
            const options = {
                model: geminiStudioState.model,
                systemInstruction: geminiStudioState.systemInstruction,
                temperature: geminiStudioState.temperature,
                safetySettings: geminiStudioState.safetySettings,
                history: geminiStudioState.messages.slice(0, -1),
                message: text,
                attachments: currentAttachments.map(att => ({
                    type: att.type,
                    base64: att.base64.split(',')[1] // Remove data:image/xxx;base64, prefix
                })),
                stream: true
            };

            // Start the streaming chat
            electron.gemini.chat(options);

            // The response will come through the stream listener
            // (Handler is set up in initGeminiStreamListener)

        } catch (e) {
            geminiStudioState.isStreaming = false;
            geminiStudioState.messages.push({ role: 'model', text: 'Error: ' + e.message });
            renderGeminiStudio();
        }
    };

    // Initialize streaming listener (called once on app load)
    let geminiStreamListenerInitialized = false;
    function initGeminiStreamListener() {
        if (geminiStreamListenerInitialized) return; // Prevent duplicate listeners
        geminiStreamListenerInitialized = true;

        electron.gemini.onStreamChunk((data) => {
            // Only process if we're actually streaming (prevents stale events)
            if (!geminiStudioState.isStreaming && !data.done) return;

            if (data.error) {
                geminiStudioState.isStreaming = false;
                geminiStudioState.messages.push({ role: 'model', text: 'Error: ' + data.error });
                geminiStudioState.streamingText = '';
                // Only re-render if we're on Gemini Studio page
                if (document.getElementById('gsChatHistory')) {
                    renderGeminiStudio();
                }
                return;
            }

            if (data.done) {
                // Streaming complete - add full message to history
                geminiStudioState.isStreaming = false;

                const finalMsg = {
                    role: 'model',
                    text: data.fullText || geminiStudioState.streamingText
                };

                // Add generated image if present
                if (data.image) {
                    finalMsg.attachments = [{
                        name: 'Generated Image',
                        type: 'image/png',
                        base64: data.image.base64
                    }];
                }

                if (finalMsg.text || finalMsg.attachments) {
                    geminiStudioState.messages.push(finalMsg);
                }

                geminiStudioState.streamingText = '';
                // Only re-render if we're on Gemini Studio page
                if (document.getElementById('gsChatHistory')) {
                    renderGeminiStudio();
                }
            } else {
                // Append chunk to streaming text and update UI
                geminiStudioState.streamingText += data.text;
                updateStreamingMessage();
            }
        });
    }

    // Update just the streaming message without full re-render
    function updateStreamingMessage() {
        const chatHistory = document.getElementById('gsChatHistory');
        if (!chatHistory) return;

        let streamingBubble = document.getElementById('gsStreamingBubble');

        if (!streamingBubble) {
            // Create streaming message element
            const msgDiv = document.createElement('div');
            msgDiv.className = 'gs-message model';
            msgDiv.innerHTML = `<div class="gs-bubble" id="gsStreamingBubble"></div>`;
            chatHistory.appendChild(msgDiv);
            streamingBubble = document.getElementById('gsStreamingBubble');
        }

        // Update content with formatted text
        streamingBubble.innerHTML = formatMessageContent(geminiStudioState.streamingText);
        scrollToBottom();
    }

    // Initialize the listener on load
    initGeminiStreamListener();

    function scrollToBottom() {
        const el = document.getElementById('gsChatHistory');
        if (el) el.scrollTop = el.scrollHeight;
    }
    function getIcon(name) {
        switch (name) {
            case 'mic': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
            case 'clock': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
            case 'scissors': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="6" cy="6" r="3"></circle><path d="M8.12 8.12L12 12"></path><path d="M20 4L8.12 15.88"></path><circle cx="6" cy="18" r="3"></circle><path d="M14.8 14.8L20 20"></path><path d="M15.88 8.12L12 12"></path></svg>`;
            default: return '';
        }
    }

    // Silence Remover UI
    function renderSilenceRemover() {
        const containerHtml = `
            <div class="sr-container">
                <div class="fe-header">
                    <h2 class="fe-title">Silence Remover</h2>
                    <p class="fe-subtitle">오디오에서 무음 구간을 자동으로 제거합니다</p>
                </div>

                <div class="sr-waveform-card">
                    <div id="srDropZone" class="fe-drop-zone ${silenceRemoverState.audioPath ? 'has-file' : ''}">
                        ${silenceRemoverState.audioPath ? `
                            <div class="sr-waveform-container" id="srWaveform"></div>
                            <div class="sr-action-bar">
                                <button class="sr-play-btn" id="srPlayBtn" onclick="toggleSrPlayback()">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                </button>
                                <button class="fe-clear-btn" onclick="clearSilenceRemover()">Change Audio</button>
                            </div>
                        ` : `
                            <div class="fe-drop-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M9 18V5l12-2v13"/>
                                    <circle cx="6" cy="18" r="3"/>
                                    <circle cx="18" cy="16" r="3"/>
                                </svg>
                            </div>
                            <div class="fe-drop-text">오디오 파일을 드래그하거나 클릭하여 선택</div>
                            <div class="fe-drop-hint">MP3, WAV, M4A 지원</div>
                        `}
                        <input type="file" id="srFileInput" accept="audio/*" style="display:none">
                    </div>

                    ${silenceRemoverState.audioPath ? `
                        <div class="sr-controls-grid">
                            <div class="sr-setting-group">
                                <label class="sr-label">
                                    ${getIcon('mic')} Silence Threshold (dB)
                                    <span class="sr-value-badge" id="srThresholdVal">${silenceRemoverState.threshold}dB</span>
                                </label>
                                <input type="range" class="sr-range" id="srThresholdInp" min="-60" max="-10" step="1" 
                                    value="${silenceRemoverState.threshold}">
                                <p class="fe-drop-hint">이 값보다 작은 소리를 무음으로 인식합니다.</p>
                            </div>
                            <div class="sr-setting-group">
                                <label class="sr-label">
                                    ${getIcon('clock')} Min Duration (sec)
                                    <span class="sr-value-badge" id="srDurationVal">${silenceRemoverState.minDuration}s</span>
                                </label>
                                <input type="range" class="sr-range" id="srDurationInp" min="0.1" max="2.0" step="0.1" 
                                    value="${silenceRemoverState.minDuration}">
                                <p class="fe-drop-hint">이 시간보다 긴 무음만 제거합니다.</p>
                            </div>
                        </div>

                        <div class="sr-action-bar" style="margin-top: 32px; display: flex; gap: 12px;">
                            <button class="fe-extract-btn" id="srProcessBtn" onclick="processSilenceRemoval()">
                                ${getIcon('scissors')} Remove Silence & Apply
                            </button>
                            <button class="fe-extract-btn" id="srSaveBtn" onclick="saveProcessedFile()" style="display: none; background-color: #10B981;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                    <polyline points="7 3 7 8 15 8"></polyline>
                                </svg>
                                Save Result
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 8px; font-size: 13px; color: #64748B;">
                            <div style="width: 12px; height: 12px; background-color: rgba(239, 68, 68, 0.4); border-radius: 2px; border: 1px solid rgba(239, 68, 68, 0.6);"></div>
                            <span>이 영역(붉은색)이 삭제됩니다</span>
                        </div>
                    ` : ''}

                    <div id="srErrorMsg" class="fe-progress-text" style="color: #EF4444; margin-top: 12px; display: none;"></div>
                </div>
            </div>
        `;

        workspaceContent.innerHTML = containerHtml;

        if (silenceRemoverState.audioPath) {
            initWavesurfer(silenceRemoverState.audioPath);
            setupSrEventListeners();
        } else {
            setupSrDropZone();
        }
    }

    function setupSrDropZone() {
        const dropZone = document.getElementById('srDropZone');
        const fileInput = document.getElementById('srFileInput');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const internalPath = e.dataTransfer.getData('tubiq-file-path');
            if (internalPath) { handleAudioSelect(internalPath); return; }
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) handleAudioSelect(file);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleAudioSelect(e.target.files[0]);
        });
    }

    // Utility for debouncing
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function setupSrEventListeners() {
        const thresholdInp = document.getElementById('srThresholdInp');
        const durationInp = document.getElementById('srDurationInp');
        const waveformContainer = document.getElementById('srWaveform');

        // Allow dropping new file on the waveform area
        if (waveformContainer) {
            waveformContainer.addEventListener('dragover', (e) => { e.preventDefault(); waveformContainer.style.opacity = '0.7'; });
            waveformContainer.addEventListener('dragleave', () => waveformContainer.style.opacity = '1');
            waveformContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                waveformContainer.style.opacity = '1';
                const internalPath = e.dataTransfer.getData('tubiq-file-path');
                if (internalPath) { handleAudioSelect(internalPath); return; }
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('audio/')) handleAudioSelect(file);
            });
        }

        const debouncedUpdate = debounce(() => {
            updateSilenceVisualization();
        }, 150);

        thresholdInp?.addEventListener('input', (e) => {
            silenceRemoverState.threshold = parseFloat(e.target.value);
            document.getElementById('srThresholdVal').textContent = e.target.value + 'dB';
            debouncedUpdate();
        });

        durationInp?.addEventListener('input', (e) => {
            silenceRemoverState.minDuration = parseFloat(e.target.value);
            document.getElementById('srDurationVal').textContent = e.target.value + 's';
            debouncedUpdate();
        });
    }

    function initWavesurfer(path) {
        if (wavesurfer) {
            try { wavesurfer.destroy(); } catch (e) { }
            wavesurfer = null;
        }

        const waveformContainer = document.querySelector('#srWaveform');
        if (!waveformContainer) {
            console.error('Waveform container not found');
            return;
        }

        try {
            wavesurfer = WaveSurfer.create({
                container: '#srWaveform',
                waveColor: '#8b5cf6',
                progressColor: '#c084fc',
                cursorColor: '#7c3aed',
                barWidth: 2,
                barRadius: 3,
                height: 128,
                normalize: true,
                interact: true,
                hideScrollbar: true
            });

            wsRegions = wavesurfer.registerPlugin(WaveSurfer.Regions.create());

            // Use direct file protocol since webSecurity is disabled
            // path is already an absolute path from electron.getFilePath
            // Just ensure it has file:// prefix if not present (though Wavesurfer handles paths too)
            // Windows path C:\Foo\Bar -> /C:/Foo/Bar -> file:///C:/Foo/Bar
            let normalizedPath = path.replace(/\\/g, '/');
            if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;

            // Encode URI to handle Korean/Spaces, and manually escape # and ?
            const fileUrl = 'file://' + encodeURI(normalizedPath).replace(/#/g, '%23').replace(/\?/g, '%3F');

            console.log('Loading audio with direct file protocol:', fileUrl);
            wavesurfer.load(fileUrl);

            wavesurfer.on('ready', () => {
                console.log('WaveSurfer is ready');
                updateSilenceVisualization();
            });

            wavesurfer.on('error', (err) => {
                console.error('WaveSurfer Error:', err);
                const errorMsg = document.getElementById('srErrorMsg');
                if (errorMsg) {
                    let msg = '파형 로드 중 오류 발생: ' + err;
                    if (err instanceof MediaError || (err && err.name === 'MediaError')) {
                        msg += ` (Code: ${err.code}, Message: ${err.message})`;
                    }
                    errorMsg.textContent = msg;
                    errorMsg.style.display = 'block';
                }
            });

            wavesurfer.on('play', () => {
                silenceRemoverState.isPlaying = true;
                updateSrPlayBtn();
            });
            wavesurfer.on('pause', () => {
                silenceRemoverState.isPlaying = false;
                updateSrPlayBtn();
            });
            wavesurfer.on('finish', () => {
                silenceRemoverState.isPlaying = false;
                updateSrPlayBtn();
            });
        } catch (e) {
            console.error('Failed to initialize WaveSurfer:', e);
        }
    }

    function updateSrPlayBtn() {
        const btn = document.getElementById('srPlayBtn');
        if (!btn) return;
        btn.innerHTML = silenceRemoverState.isPlaying ?
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>` :
            `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    }

    function updateSilenceVisualization() {
        if (!wavesurfer || !wsRegions) return;

        wsRegions.clearRegions();

        // Simple heuristic for preview:
        // We can't perfectly fetch decibels per second in JS easily without heavy analysis,
        // but we can try to visualize the logic.
        // For now, let's just use the Regions to show where the user IS in the settings.
        // Actually, to make it "pro", we should analyze the peaks.

        const buffer = wavesurfer.getDecodedData();
        if (!buffer) return;

        const rawData = buffer.getChannelData(0); // mono
        const sampleRate = buffer.sampleRate;
        const duration = buffer.duration;
        const thresholdLinear = Math.pow(10, silenceRemoverState.threshold / 20);

        const minSamples = silenceRemoverState.minDuration * sampleRate;
        let silenceStart = -1;

        // Downsample for performance (check every 0.05s)
        const step = Math.floor(sampleRate * 0.05);
        for (let i = 0; i < rawData.length; i += step) {
            const amplitude = Math.abs(rawData[i]);
            const isSilence = amplitude < thresholdLinear;

            if (isSilence && silenceStart === -1) {
                silenceStart = i;
            } else if (!isSilence && silenceStart !== -1) {
                if (i - silenceStart >= minSamples) {
                    wsRegions.addRegion({
                        start: silenceStart / sampleRate,
                        end: i / sampleRate,
                        color: 'rgba(239, 68, 68, 0.2)',
                        drag: false,
                        resize: false
                    });
                }
                silenceStart = -1;
            }
        }

        // Handle end of file
        if (silenceStart !== -1 && rawData.length - silenceStart >= minSamples) {
            wsRegions.addRegion({
                start: silenceStart / sampleRate,
                end: duration,
                color: 'rgba(239, 68, 68, 0.2)',
                drag: false,
                resize: false
            });
        }
    }

    async function handleAudioSelect(fileOrPath) {
        let filePath;
        if (typeof fileOrPath === 'string') {
            filePath = fileOrPath;
        } else {
            filePath = electron.getFilePath(fileOrPath);
        }

        if (filePath) {
            silenceRemoverState.audioPath = filePath;
            silenceRemoverState.processedPath = null;
            silenceRemoverState.error = null;
            if (wavesurfer) {
                wavesurfer.destroy();
                wavesurfer = null;
            }
            renderSilenceRemover();
        }
    }

    window.toggleSrPlayback = () => {
        if (wavesurfer) {
            wavesurfer.playPause();
        }
    };

    window.clearSilenceRemover = () => {
        if (wavesurfer) {
            wavesurfer.destroy();
            wavesurfer = null;
        }
        silenceRemoverState = {
            audioPath: null,
            isProcessing: false,
            threshold: -40,
            minDuration: 0.5,
            isPlaying: false,
            error: null,
            processedPath: null
        };
        renderSilenceRemover();
    };

    window.updateSrSetting = (key, value) => {
        silenceRemoverState[key] = parseFloat(value);
        // Refresh display badge
        const badges = document.querySelectorAll('.sr-value-badge');
        if (key === 'threshold') badges[0].textContent = value + 'dB';
        if (key === 'minDuration') badges[1].textContent = value + 's';
    };

    window.saveProcessedFile = async () => {
        if (!silenceRemoverState.processedPath) return;

        const result = await electron.saveProcessedFile({
            filePath: silenceRemoverState.processedPath
        });

        if (result.success) {
            alert('파일이 저장되었습니다: ' + result.savedPath);
        } else if (result.note !== 'canceled') {
            alert('저장 실패: ' + result.error);
        }
    };

    window.processSilenceRemoval = async () => {
        if (!silenceRemoverState.audioPath) return;

        const processBtn = document.getElementById('srProcessBtn');
        const saveBtn = document.getElementById('srSaveBtn');
        const errorMsg = document.getElementById('srErrorMsg');

        if (processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = `<div class="loading-spinner-small"></div> Processing...`;
        }
        if (saveBtn) saveBtn.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';

        try {
            const fullPath = silenceRemoverState.audioPath;
            const parts = fullPath.split(/[\\/]/);
            const fileName = parts[parts.length - 1];
            const dotIndex = fileName.lastIndexOf('.');
            const baseName = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
            const ext = dotIndex !== -1 ? fileName.substring(dotIndex) : '';
            const parentDir = parts.slice(0, -1).join('\\');

            const outputPath = parentDir + '\\' + baseName + '_edited_' + Date.now() + ext;

            const result = await electron.processSilenceRemoval({
                inputPath: fullPath,
                outputPath: outputPath,
                threshold: silenceRemoverState.threshold,
                duration: silenceRemoverState.minDuration
            });

            if (result.success) {
                silenceRemoverState.processedPath = result.path;
                // Reload wavesurfer with processed file
                initWavesurfer(result.path);
                // Show save button
                if (saveBtn) saveBtn.style.display = 'flex';
                alert('무음 제거가 완료되었습니다!');
            } else {
                if (errorMsg) {
                    errorMsg.textContent = '오류: ' + result.error;
                    errorMsg.style.display = 'block';
                }
            }
        } catch (e) {
            console.error('Silence removal failed:', e);
            if (errorMsg) {
                errorMsg.textContent = '오류: ' + e.message;
                errorMsg.style.display = 'block';
            }
        } finally {
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = `${getIcon('scissors')} Remove Silence & Apply`;
            }
        }
    };

    // Script Extractor State
    let scriptExtractorState = {
        filePath: null,
        youtubeUrl: '',
        filter: 'all', // all, shorts, video
        sort: 'latest', // latest, views, oldest
        count: 5
    };

    function renderScriptExtractor() {
        workspaceContent.innerHTML = `
            <div class="fe-container">
                <div class="fe-header">
                    <h2 class="fe-title">Script Extractor</h2>
                    <p class="fe-subtitle">영상에서 대본을 자동으로 추출합니다 (Audio to Text)</p>
                </div>

                <div class="fe-content">
                    <!-- Drop Zone -->
                    <div class="fe-drop-zone" id="seDropZone">
                        <div class="fe-drop-icon">
                            ${getIcon('file-text')}
                        </div>
                        <p class="fe-drop-text">영상 파일을 이곳에 드래그하세요</p>
                        <p class="fe-drop-hint">또는 클릭하여 파일 선택</p>
                        <input type="file" id="seFileInput" accept="video/*,audio/*" style="display: none;">
                    </div>

                    <!-- OR Divider -->
                    <div style="display: flex; align-items: center; margin: 24px 0; gap: 12px; opacity: 0.6;">
                        <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                        <span style="font-size: 12px; font-weight: 600;">또는</span>
                        <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                    </div>

                    <!-- YouTube Input -->
                    <div class="fe-input-group">
                        <label class="fe-label">YouTube 링크 (영상 또는 채널 URL)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" class="fe-input" id="seYoutubeInput" placeholder="여기에 YouTube 영상 또는 채널 주소를 붙여넣으세요..." style="flex: 1;">
                            <button class="btn-secondary" id="sePasteBtn" onclick="pasteFromClipboard()" title="클립보드에서 붙여넣기" style="padding: 0 12px; border-radius: 8px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Options Section (Channel/Filter/Sort) -->
                    <div class="fe-options-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                        <!-- Filter -->
                        <div>
                            <label class="fe-label">콘텐츠 필터</label>
                            <div class="fe-radio-group">
                                <label class="fe-radio" for="filter-shorts">
                                    <input type="radio" id="filter-shorts" name="seFilter" value="shorts" onchange="console.log('[DEBUG] Filter changed:', this.value)">
                                    쇼츠 (Shorts)
                                </label>
                                <label class="fe-radio" for="filter-video">
                                    <input type="radio" id="filter-video" name="seFilter" value="video" onchange="console.log('[DEBUG] Filter changed:', this.value)">
                                    일반 영상
                                </label>
                                <label class="fe-radio" for="filter-all">
                                    <input type="radio" id="filter-all" name="seFilter" value="all" checked onchange="console.log('[DEBUG] Filter changed:', this.value)">
                                    전체
                                </label>
                            </div>
                        </div>
                        <!-- Sort -->
                        <div>
                            <label class="fe-label">정렬 기준</label>
                            <select id="seSortSelect" class="fe-input" style="padding: 10px;">
                                <option value="latest">최신순</option>
                                <option value="views">조회수순</option>
                                <option value="oldest">오래된순</option>
                            </select>
                        </div>
                        <!-- Count -->
                        <div>
                            <label class="fe-label">최대 개수</label>
                            <input type="number" id="seCountInput" class="fe-input" value="5" min="1" max="50" style="padding: 10px;">
                        </div>
                    </div>

                    <!-- Extract Button -->
                    <button class="fe-extract-btn" id="seExtractBtn" onclick="extractScript()">
                        ${getIcon('zap')} 대본 추출하기
                    </button>

                    <!-- Result Area -->
                    <div class="fe-result-section" id="seResultSection" style="display: none; margin-top: 32px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h3 class="fe-section-title">추출된 대본</h3>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-secondary" onclick="copyScript()" style="padding: 6px 12px; font-size: 13px;">
                                    ${getIcon('clipboard')} 복사
                                </button>
                                <button class="btn-secondary" onclick="saveScript()" style="padding: 6px 12px; font-size: 13px;">
                                    ${getIcon('download')} 저장 (.txt)
                                </button>
                            </div>
                        </div>
                        <textarea id="seResultText" class="fe-input" style="height: 300px; resize: vertical; line-height: 1.6;" readonly></textarea>
                    </div>

                    <div id="seLoading" class="fe-loading" style="display: none;">
                        <div class="loading-spinner"></div>
                        <p class="loading-text" id="seLoadingText">AI가 대본을 추출하고 있습니다...</p>
                        <p class="loading-subtext" id="seLoadingSubtext">영상 길이에 따라 시간이 조금 걸릴 수 있습니다</p>
                    </div>
                </div>
            </div>
        `;

        setupSeEventListeners();
    }

    function setupSeEventListeners() {
        const dropZone = document.getElementById('seDropZone');
        const fileInput = document.getElementById('seFileInput');
        const youtubeInput = document.getElementById('seYoutubeInput');

        if (dropZone) {
            dropZone.onclick = () => fileInput.click();
            dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
            dropZone.ondragleave = () => dropZone.classList.remove('active');
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('active');

                // Prioritize checking if it's an internal file drag
                const internalPath = e.dataTransfer.getData('tubiq-file-path');
                if (internalPath) {
                    handleSeFileSelect({ path: internalPath, name: internalPath.split(/[\\/]/).pop() });
                    return;
                }

                // Check for URL drop (from browser)
                const droppedUrl = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
                if (droppedUrl && droppedUrl.includes('youtube.com') || droppedUrl.includes('youtu.be')) {
                    const url = droppedUrl.split('\n')[0].trim();
                    document.getElementById('seYoutubeInput').value = url;
                    scriptExtractorState.youtubeUrl = url;
                    scriptExtractorState.filePath = null;
                    resetSeUI();
                    document.getElementById('seDropZone').style.opacity = '0.5';
                    return;
                }

                if (e.dataTransfer.files.length > 0) {
                    handleSeFileSelect(e.dataTransfer.files[0]);
                }
            };
        }

        if (fileInput) {
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) handleSeFileSelect(e.target.files[0]);
            };
        }

        if (youtubeInput) {
            youtubeInput.oninput = (e) => {
                scriptExtractorState.youtubeUrl = e.target.value;
                scriptExtractorState.filePath = null; // Clear file selection
                resetSeUI();
                if (e.target.value) {
                    document.getElementById('seDropZone').style.opacity = '0.5';
                }
            };
        }
    }

    function handleSeFileSelect(file) {
        scriptExtractorState.filePath = file.path; // Electron exposes path
        scriptExtractorState.youtubeUrl = '';

        document.getElementById('seYoutubeInput').value = '';
        document.getElementById('seDropZone').style.opacity = '1';

        // Update UI to show selected file
        const dropText = document.querySelector('#seDropZone .fe-drop-text');
        const dropHint = document.querySelector('#seDropZone .fe-drop-hint');
        if (dropText) dropText.textContent = file.name;
        if (dropHint) dropHint.textContent = '추출할 준비가 되었습니다';
        document.getElementById('seDropZone').classList.add('selected');
    }

    function resetSeUI() {
        const dropText = document.querySelector('#seDropZone .fe-drop-text');
        const dropHint = document.querySelector('#seDropZone .fe-drop-hint');
        if (dropText) dropText.textContent = '영상 파일을 이곳에 드래그하세요';
        if (dropHint) dropHint.textContent = '또는 클릭하여 파일 선택';
        document.getElementById('seDropZone').classList.remove('selected');
        document.getElementById('seDropZone').style.opacity = '1';
    }

    window.pasteFromClipboard = () => {
        electron.getClipboardHistory().then(history => {
            if (history && history.length > 0) {
                // Find latest YouTube URL in history
                const ytLink = history.find(item => item.text.includes('youtube.com') || item.text.includes('youtu.be'));
                const textToPaste = ytLink ? ytLink.text : history[0].text;

                document.getElementById('seYoutubeInput').value = textToPaste;
                scriptExtractorState.youtubeUrl = textToPaste;
                scriptExtractorState.filePath = null;
                resetSeUI();
                document.getElementById('seDropZone').style.opacity = '0.5';
            }
        });
    };

    window.extractScript = async () => {
        const { filePath, youtubeUrl } = scriptExtractorState;

        // Get options from UI
        const filter = document.querySelector('input[name="seFilter"]:checked')?.value || 'all';
        const sort = document.getElementById('seSortSelect').value;
        const count = parseInt(document.getElementById('seCountInput').value) || 5;

        if (!filePath && !youtubeUrl) {
            alert('파일을 선택하거나 YouTube URL을 입력해주세요.');
            return;
        }

        // UI Loading State
        document.getElementById('seLoading').style.display = 'flex';
        document.getElementById('seResultSection').style.display = 'none';
        document.getElementById('seExtractBtn').disabled = true;

        // Update loading text for multiple items
        if (youtubeUrl) {
            document.getElementById('seLoadingText').textContent = '영상/채널을 분석 중입니다...';
        }

        try {
            const result = await electron.extractScript({
                filePath,
                youtubeUrl,
                options: { filter, sort, count }
            });

            if (result.success) {
                document.getElementById('seResultText').value = result.text;
                document.getElementById('seResultSection').style.display = 'block';
            } else {
                alert('추출 실패: ' + result.error);
            }
        } catch (e) {
            console.error(e);
            alert('오류: ' + e.message);
        } finally {
            document.getElementById('seLoading').style.display = 'none';
            document.getElementById('seExtractBtn').disabled = false;
        }
    };

    window.copyScript = () => {
        const text = document.getElementById('seResultText');
        text.select();
        document.execCommand('copy');
        alert('Copied to clipboard!');
    };

    window.saveScript = async () => {
        const text = document.getElementById('seResultText').value;
        if (!text) return;

        await electron.saveTextFile(text, 'script.txt');
    };
    function renderFrameExtractor() {
        workspaceContent.innerHTML = `
            <div class="frame-extractor-container">
                <div class="fe-header">
                    <h2 class="fe-title">Frame Extractor</h2>
                    <p class="fe-subtitle">영상에서 프레임을 추출합니다</p>
                </div>

                <div class="fe-drop-zone" id="feDropZone">
                    <div class="fe-drop-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                    </div>
                    <div class="fe-drop-text">영상 파일을 드래그하거나 클릭하여 선택</div>
                    <div class="fe-drop-hint">MP4, MOV, AVI, MKV 지원</div>
                    <input type="file" id="feFileInput" accept="video/*" style="display:none">
                </div>

                <div class="fe-divider">
                    <span>또는</span>
                </div>

                <div class="fe-url-input-container">
                    <input type="text" id="feYoutubeUrl" class="fe-url-input" placeholder="YouTube URL 붙여넣기" value="${frameExtractorState.youtubeUrl}">
                </div>

                ${frameExtractorState.filePath ? `
                    <div class="fe-selected-file">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <polygon points="23 7 16 12 23 17 23 7"/>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                        <span>${frameExtractorState.filePath.split('\\').pop()}</span>
                        <button class="fe-clear-btn" onclick="clearFrameExtractorFile()">×</button>
                    </div>
                ` : ''}

                <div class="fe-settings">
                    <div class="fe-setting-group">
                        <label class="fe-label">추출 개수 (최대)</label>
                        <input type="number" id="feFrameCount" class="fe-number-input" value="${frameExtractorState.frameCount}" min="1" max="100" onchange="setFrameCount(this.value)">
                    </div>

                    <div class="fe-setting-group">
                        <label class="fe-label">저장 폴더</label>
                        <div class="fe-folder-select">
                            <span id="feOutputPath">${frameExtractorState.outputPath ? frameExtractorState.outputPath.split('\\').pop() : '폴더 선택...'}</span>
                            <button class="fe-folder-btn" onclick="selectFrameOutputFolder()">선택</button>
                        </div>
                    </div>
                </div>

                <button class="fe-extract-btn" id="feExtractBtn" onclick="startFrameExtraction()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Extract Frames
                </button>

                <div class="fe-progress-container" id="feProgressContainer" style="display:none">
                    <div class="fe-progress-bar" id="feProgressBar"></div>
                    <div class="fe-progress-text" id="feProgressText">추출 중... 0%</div>
                </div>
            </div>
        `;

        // Setup event listeners
        const dropZone = document.getElementById('feDropZone');
        const fileInput = document.getElementById('feFileInput');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            // Check for internal drag
            const internalPath = e.dataTransfer.getData('tubiq-file-path');
            if (internalPath) {
                const type = e.dataTransfer.getData('tubiq-file-type');
                if (type === 'video') {
                    frameExtractorState.filePath = internalPath;
                    frameExtractorState.source = 'file';
                    renderFrameExtractor();
                    return;
                }
            }

            const file = e.dataTransfer.files[0];
            if (file) {
                const filePath = electron.getFilePath(file);
                const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv)$/i.test(filePath);

                if (isVideo && filePath) {
                    frameExtractorState.filePath = filePath;
                    frameExtractorState.source = 'file';
                    renderFrameExtractor();
                } else if (!filePath) {
                    console.error('Failed to get file path via webUtils');
                    alert('파일 경로를 읽는 데 실패했습니다.');
                } else {
                    alert('지원하지 않는 파일 형식입니다. (MP4, MOV, AVI, MKV 지원)');
                }
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                const filePath = electron.getFilePath(file);
                if (filePath) {
                    frameExtractorState.filePath = filePath;
                    frameExtractorState.source = 'file';
                    renderFrameExtractor();
                }
            }
        });

        document.getElementById('feYoutubeUrl').addEventListener('input', (e) => {
            frameExtractorState.youtubeUrl = e.target.value;
            if (e.target.value) {
                frameExtractorState.source = 'youtube';
            }
        });
    }


    // Add progress listener once
    if (typeof electron.onExtractProgress === 'function') {
        electron.onExtractProgress((progress) => {
            const progressBar = document.getElementById('feProgressBar');
            const progressText = document.getElementById('feProgressText');
            if (progressBar && progressText) {
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `추출 중... ${progress}%`;
            }
        });
    }

    window.clearFrameExtractorFile = () => {
        frameExtractorState.filePath = null;
        frameExtractorState.source = null;
        renderFrameExtractor();
    };

    window.setFrameCount = (count) => {
        frameExtractorState.frameCount = parseInt(count) || 20;
    };

    window.selectFrameOutputFolder = async () => {
        const result = await electron.selectFolder();
        console.log('Folder selection result:', result);
        if (result && result.success && result.folder) {
            frameExtractorState.outputPath = result.folder.path;
            renderFrameExtractor();
        }
    };

    window.startFrameExtraction = async () => {
        if (!frameExtractorState.outputPath) {
            alert('저장 폴더를 선택해주세요.');
            return;
        }

        if (!frameExtractorState.filePath && !frameExtractorState.youtubeUrl) {
            alert('영상 파일을 선택하거나 YouTube URL을 입력해주세요.');
            return;
        }

        const progressContainer = document.getElementById('feProgressContainer');
        const progressBar = document.getElementById('feProgressBar');
        const progressText = document.getElementById('feProgressText');
        const extractBtn = document.getElementById('feExtractBtn');

        progressContainer.style.display = 'block';
        extractBtn.disabled = true;
        extractBtn.style.opacity = '0.5';

        try {
            const result = await electron.extractFrames({
                filePath: frameExtractorState.filePath,
                youtubeUrl: frameExtractorState.youtubeUrl,
                frameCount: frameExtractorState.frameCount,
                outputPath: frameExtractorState.outputPath
            });

            if (result.success) {
                progressBar.style.width = '100%';
                progressText.textContent = `완료! ${result.extractedCount}개 프레임 추출됨`;
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    progressBar.style.width = '0%';
                    extractBtn.disabled = false;
                    extractBtn.style.opacity = '1';
                }, 2000);
            } else {
                throw new Error(result.error);
            }
        } catch (e) {
            progressText.textContent = `오류: ${e.message}`;
            progressBar.style.background = '#EF4444';
            extractBtn.disabled = false;
            extractBtn.style.opacity = '1';
        }
    };

    function updateSettingsUI(editingFolder = null) {
        const pane = document.getElementById('folderSettingsPane');
        if (pane) {
            // Re-render the whole pane to show updates
            pane.innerHTML = renderFolderSettings(editingFolder);
        }
    }

    async function loadClipboardHistory() {
        try {
            const history = await electron.getClipboardHistory();
            renderClipboardHistory(history);
        } catch (e) {
            console.error('Failed to load clipboard history:', e);
        }
    }

    function renderClipboardHistory(history) {
        if (!history || history.length === 0) {
            workspaceContent.innerHTML = `
                <div class="clipboard-header">
                    <span class="clipboard-title">Clipboard History</span>
                </div>
                <div class="empty-history">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                    </svg>
                    <p>No clipboard history yet</p>
                </div>
            `;
            return;
        }

        workspaceContent.innerHTML = `
            <div class="clipboard-header">
                <span class="clipboard-title">Clipboard History</span>
                <button class="clear-history-btn" onclick="clearClipboardHistory()">
                    Clear All
                </button>
            </div>
            <div class="clipboard-grid">
                ${history.map(item => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString();

            return `
                        <div class="clipboard-item" onclick="copyClipboardItem('${item.id}')" id="cp-${item.id}">
                            <div class="clipboard-item-content">${escapeHtml(item.text)}</div>
                            <div class="clipboard-item-footer">
                                <span class="clipboard-item-time">${timeStr}</span>
                                <div class="clipboard-item-type">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                                    </svg>
                                    TEXT
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    window.escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Real-time clipboard listener
    electron.onClipboardChanged((history) => {
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav && activeNav.dataset.nav === 'clipboard') {
            renderClipboardHistory(history);
        }
    });

    // Download complete listener - refresh header folder
    electron.onDownloadComplete(async (filePath) => {
        if (currentOpenFolder) {
            // Refresh the header folder to show the new file
            const folderName = currentOpenFolder.split('\\').pop();
            const readResult = await electron.readDirectory(currentOpenFolder);
            if (readResult.success) {
                renderHeaderExplorer(readResult.contents, currentOpenFolder, folderName);
            }
        }
    });

    // Download progress modal
    const downloadModal = document.getElementById('downloadModal');
    const downloadFilename = document.getElementById('downloadFilename');
    const downloadProgressBar = document.getElementById('downloadProgressBar');
    const downloadStatus = document.getElementById('downloadStatus');
    let progressInterval = null;

    electron.onDownloadStart((data) => {
        console.log('Download start event received:', data);
        // Hide BrowserView so modal is visible
        electron.setViewVisibility(false);

        // Show modal
        downloadModal.style.display = 'flex';
        downloadFilename.textContent = data.title || '영상 다운로드 중...';
        downloadProgressBar.style.width = '0%';
        downloadStatus.textContent = '다운로드 준비 중...';

        // Simulate progress (since we don't have real progress from yt-dlp)
        let progress = 0;
        progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                downloadProgressBar.style.width = `${progress}%`;

                if (progress < 30) {
                    downloadStatus.textContent = '연결 중...';
                } else if (progress < 60) {
                    downloadStatus.textContent = '다운로드 중...';
                } else {
                    downloadStatus.textContent = '거의 완료...';
                }
            }
        }, 500);
    });

    electron.onDownloadSuccess((data) => {
        // Complete the progress bar
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }

        // Show success state
        downloadProgressBar.style.width = '100%';
        downloadModal.querySelector('.download-icon').innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;
        downloadModal.querySelector('.download-icon').classList.add('success');
        downloadModal.querySelector('.download-title').textContent = '다운로드 완료!';
        downloadFilename.textContent = data.title || '영상';
        downloadStatus.textContent = '클릭하여 닫기';
        downloadStatus.style.cursor = 'pointer';

        // Click to dismiss
        const dismissModal = () => {
            downloadModal.style.display = 'none';
            downloadProgressBar.style.width = '0%';
            downloadModal.querySelector('.download-icon').classList.remove('success');
            downloadModal.querySelector('.download-icon').innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            `;
            downloadModal.querySelector('.download-title').textContent = '다운로드 중...';
            downloadStatus.style.cursor = '';
            electron.setViewVisibility(true);
            downloadModal.removeEventListener('click', dismissModal);
        };

        downloadModal.addEventListener('click', dismissModal);
    });

    electron.onDownloadError((data) => {
        // Show error state
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }

        downloadModal.querySelector('.download-icon').innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        `;
        downloadModal.querySelector('.download-icon').classList.add('error');
        downloadModal.querySelector('.download-title').textContent = '다운로드 실패';
        downloadFilename.textContent = data.error || '오류가 발생했습니다';
        downloadStatus.textContent = '클릭하여 닫기';
        downloadStatus.style.cursor = 'pointer';

        // Click to dismiss
        const dismissModal = () => {
            downloadModal.style.display = 'none';
            downloadProgressBar.style.width = '0%';
            downloadModal.querySelector('.download-icon').classList.remove('error');
            downloadModal.querySelector('.download-icon').innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            `;
            downloadModal.querySelector('.download-title').textContent = '다운로드 중...';
            downloadStatus.style.cursor = '';
            electron.setViewVisibility(true);
            downloadModal.removeEventListener('click', dismissModal);
        };

        downloadModal.addEventListener('click', dismissModal);
    });

    // Global handles for clipboard actions
    window.copyClipboardItem = async (id) => {
        const history = await electron.getClipboardHistory();
        const item = history.find(i => i.id.toString() === id.toString());
        if (item) {
            electron.copyToClipboard(item.text);

            // Visual feedback
            const el = document.getElementById(`cp-${id}`);
            if (el) {
                const originalBorder = el.style.borderColor;
                el.style.borderColor = 'var(--success-color)';
                el.style.background = 'rgba(16, 185, 129, 0.05)';
                setTimeout(() => {
                    el.style.borderColor = originalBorder;
                    el.style.background = '';
                }, 1000);
            }
        }
    };

    window.clearClipboardHistory = async () => {
        if (confirm('Are you sure you want to clear all clipboard history?')) {
            await electron.clearClipboardHistory();
            renderClipboardHistory([]);
        }
    };

    // Folder Hub actions
    window.addNewFolder = async () => {
        const result = await electron.selectFolder();
        if (result.success) {
            const folders = await electron.getFolders();
            renderFolderHub(folders);
        }
    };

    window.removeFolder = async (id) => {
        if (confirm('Are you sure you want to stop tracking this folder?')) {
            await electron.deleteFolder(id);
            const folders = await electron.getFolders();
            renderFolderHub(folders);
        }
    };

    function getIcon(name) {
        const icons = {
            'play-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor"/></svg>',
            'users': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            'layers': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
            'clipboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
            'git-branch': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
            'folder': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
            'folder-minus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            'mail': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
            'bell': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
            'calendar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
            'camera': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
            'cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
            'cpu': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>',
            'database': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
            'edit': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
            'eye': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            'gift': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
            'heart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
            'home': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            'image': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            'link': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
            'lock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
            'map-pin': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
            'moon': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
            'music': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
            'package': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
            'phone': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
            'star': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
            'search': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            'settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
            'file-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
            'message-square': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
            'zap': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            'hard-drive': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>',
            'monitor': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
            'mic': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>',
        };
        return icons[name] || '';
    }


    // Activity bar click handlers
    activityIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const section = icon.dataset.section;
            if (!section) return; // Skip if no section (e.g., menu toggle)

            // Special handling for explorer - toggle file picker overlay
            if (section === 'explorer') {
                toggleFilePicker();
                return;
            }

            // Close file picker if open
            if (isFilePickerOpen) {
                isFilePickerOpen = false;
                filePickerOverlay.classList.remove('visible');
            }

            activityIcons.forEach(i => i.classList.remove('active'));
            icon.classList.add('active');
            currentSection = section;
            renderSideNav(section);

            // Always show side panel when clicking activity icons
            const sidePanel = document.getElementById('sidePanel');
            if (sidePanel) {
                sidePanel.classList.remove('hidden');
                const menuToggleBtn = document.getElementById('menuToggleBtn');
                if (menuToggleBtn) menuToggleBtn.classList.add('menu-open');
            }

            if (section === 'snippets' || (section === 'search' && currentSection === 'snippets')) {
                electron.setViewVisibility(false);
                loadSnippets();
            }
        });
    });

    // Maximize button state
    electron.onMaximized((isMaximized) => {
        const btn = document.getElementById('maximizeBtn');
        if (isMaximized) {
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="0" width="9" height="9" stroke="currentColor" stroke-width="2" fill="none"/><rect x="0" y="3" width="9" height="9" stroke="currentColor" stroke-width="2" fill="var(--bg-secondary)"/></svg>';
        } else {
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        }
    });

    // Initialize
    renderSideNav('snippets');
    await loadSnippets();

    // User Authentication UI
    const userBtn = document.getElementById('userBtn');
    const userSection = document.getElementById('userSection');

    async function updateUserUI() {
        try {
            const session = await electron.getSession();
            if (session && session.user) {
                const email = session.user.email || '';
                const initial = email.charAt(0).toUpperCase();
                const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;

                if (avatarUrl) {
                    userBtn.innerHTML = `<img src="${avatarUrl}" class="avatar-img" alt="User" />`;
                } else {
                    userBtn.innerHTML = `<div class="avatar-fallback">${initial}</div>`;
                }

                userBtn.title = email;
                userBtn.classList.add('logged-in');
            } else {
                userBtn.innerHTML = `
                    <div class="avatar-placeholder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                    </div>`;
                userBtn.title = 'Login';
                userBtn.classList.remove('logged-in');
            }
        } catch (e) {
            console.error('Failed to check auth:', e);
        }
    }

    // Login Modal Elements
    const loginModal = document.getElementById('loginModal');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const signInBtn = document.getElementById('signInBtn');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const closeLoginBtn = document.getElementById('closeLoginBtn');
    const loginOverlay = document.getElementById('loginOverlay');

    function showLoginModal() {
        loginModal.style.display = 'flex';
        emailInput.value = '';
        passwordInput.value = '';
        electron.setViewVisibility(false); // Hide BrowserView to prevent overlap
    }

    function hideLoginModal() {
        loginModal.style.display = 'none';

        // Restore visibility if we are in a section that needs it
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            const navId = activeNav.dataset.nav;
            if (navId === 'videos' || navId === 'channels') {
                electron.setViewVisibility(true);
            }
        }
    }

    // Enter key support for login
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            signInBtn.click();
        }
    };
    emailInput.addEventListener('keypress', handleEnter);
    passwordInput.addEventListener('keypress', handleEnter);

    signInBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            alert('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        try {
            const { data, error } = await electron.signIn({ email, password });
            if (error) {
                alert('로그인 실패: ' + (error.message || '정보를 확인해주세요.'));
            } else {
                // Sync session tokens to main process
                if (data?.session) {
                    await electron.syncSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token
                    });
                }
                hideLoginModal();
                updateUserUI();
            }
        } catch (e) {
            console.error('Sign in error:', e);
            alert('오류가 발생했습니다.');
        }
    });

    googleLoginBtn.addEventListener('click', async () => {
        hideLoginModal();
        await electron.signInWithGoogle();
    });

    closeLoginBtn.addEventListener('click', hideLoginModal);
    loginOverlay.addEventListener('click', hideLoginModal);

    userBtn.addEventListener('click', async () => {
        const session = await electron.getSession();
        if (session && session.user) {
            if (confirm('로그아웃 하시겠습니까?')) {
                await electron.signOut();
                updateUserUI();
            }
        } else {
            showLoginModal();
        }
    });

    // Listen for auth changes
    electron.onAuthChange(async (session) => {
        // Do NOT sync back to main, as this event comes FROM main (or sync loop occurs)

        updateUserUI();
        // If we are in videos or channels view, reload the view to sync data
        if (currentSection === 'search' || currentSection === 'snippets') {
            const activeNav = document.querySelector('.nav-item.active');
            if (activeNav) {
                const navId = activeNav.dataset.nav;
                if (navId === 'videos' || navId === 'channels') {
                    electron.setViewUrl(navId);
                    electron.setViewVisibility(true);
                }
            }
        }
    });

    // Initial auth check
    updateUserUI();
    initHeaderFolders();
});

// Global function for new snippet button
function openNewSnippetModal() {
    alert('New snippet modal - Coming soon!');
}


window.handleQAudioUpload = async () => {
    // In a real scenario, this would trigger a file picker
    // For now, we simulate a file selection
    const result = await electron.selectFile();

    if (result.success && result.filePaths && result.filePaths.length > 0) {
        qAudioState.filePath = result.filePaths[0];
        qAudioState.fileName = qAudioState.filePath.split(/[\\/]/).pop();
        qAudioState.view = 'editor';
        renderQAudio();
    } else {
        // If cancelled or failed, do nothing or show error
        console.log('File selection cancelled or failed');
    }
};

window.loadQAudioSample = (sampleId) => {
    // Simulate loading a sample
    qAudioState.filePath = `sample://${sampleId}`;
    qAudioState.fileName = `Sample Audio ${sampleId.replace('sample', '')}`;
    qAudioState.view = 'editor';
    renderQAudio();
};

// Q Audio State
let qAudioState = {
    view: 'landing', // 'landing' | 'editor' | 'processing' | 'result'
    filePath: null,
    fileName: null,
    description: 'vocals', // Text prompt for separation
    isProcessing: false,
    error: null,
    result: null // { target: { url }, residual: { url }, duration, sample_rate }
};

// Q Audio WaveSurfer instance
let qAudioWaveSurfer = null;

// Initialize WaveSurfer for Q Audio
function initQAudioWaveSurfer(filePath, containerId = '#qAudioWaveform') {
    if (qAudioWaveSurfer) {
        try { qAudioWaveSurfer.destroy(); } catch (e) { }
        qAudioWaveSurfer = null;
    }

    const container = document.querySelector(containerId);
    if (!container) {
        console.error('Q Audio waveform container not found');
        return;
    }

    // Clear placeholder SVG or existing content
    container.innerHTML = '';

    try {
        // Create WaveSurfer
        qAudioWaveSurfer = WaveSurfer.create({
            container: containerId,
            waveColor: '#4ade80',
            progressColor: '#22c55e',
            cursorColor: '#ffffff',
            barWidth: 3,
            barRadius: 2,
            barGap: 1,
            height: 50,
            normalize: true,
            interact: true,
            hideScrollbar: true
        });

        // Use robust URL construction
        const fileUrl = getMediaUrl(filePath);

        logToMain('[Q-Audio] WaveSurfer URL:', fileUrl);

        qAudioWaveSurfer.load(fileUrl);

        qAudioWaveSurfer.on('error', (err) => {
            console.error('[Q-Audio] WaveSurfer Error:', err);
            container.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px;">
                Unable to load audio waveform. (Error: ${err.message || 'Unknown'})
            </div>`;
        });

        qAudioWaveSurfer.on('ready', () => {
            console.log('[Q-Audio] WaveSurfer ready');
            syncPlayhead();
        });

        // Sync with video playback
        qAudioWaveSurfer.on('timeupdate', (currentTime) => {
            updatePlayheadPosition(currentTime, qAudioWaveSurfer.getDuration());
        });

    } catch (e) {
        console.error('Failed to initialize Q Audio WaveSurfer:', e);
    }
}

// Update playhead position based on current time
function updatePlayheadPosition(currentTime, duration) {
    const playhead = document.querySelector('.q-playhead');
    if (playhead && duration > 0) {
        const percent = (currentTime / duration) * 100;
        playhead.style.left = `${percent}%`;
    }
}

// Sync WaveSurfer with video element
function syncPlayhead() {
    const video = document.querySelector('.q-video-area video');
    if (video && qAudioWaveSurfer) {
        video.addEventListener('timeupdate', () => {
            const duration = video.duration || 1;
            updatePlayheadPosition(video.currentTime, duration);
            // Sync WaveSurfer position
            try {
                qAudioWaveSurfer.seekTo(video.currentTime / duration);
            } catch (e) { }
        });
    }
}

// Extract real frames using IPC (ffmpeg)
async function extractRealFrames(filePath, frameCount = 20) {
    try {
        const tempDir = await window.electron.invoke('get-temp-path');
        const outputPath = `${tempDir}/qAudioFrames_${Date.now()}`;

        // Create output directory
        await window.electron.invoke('ensure-dir', outputPath);

        // Extract frames via IPC
        const result = await window.electron.invoke('extract-frames', {
            filePath: filePath,
            frameCount: frameCount,
            outputPath: outputPath
        });

        if (result.success) {
            // Read extracted frame files
            const frames = [];
            for (let i = 1; i <= result.extractedCount; i++) {
                const framePath = `${outputPath}/frame_${String(i).padStart(3, '0')}.jpg`;
                // Convert to file:// URL
                let normalizedPath = framePath.replace(/\\/g, '/');
                if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
                frames.push('file://' + encodeURI(normalizedPath).replace(/#/g, '%23'));
            }
            return frames;
        } else {
            console.error('Frame extraction failed:', result.error);
            return [];
        }
    } catch (e) {
        console.error('extractRealFrames error:', e);
        return [];
    }
}

window.renderQAudio = () => {
    // Cleanup previous WaveSurfer instance
    if (qAudioWaveSurfer) {
        try { qAudioWaveSurfer.destroy(); } catch (e) { }
        qAudioWaveSurfer = null;
    }

    if (qAudioState.view === 'landing') {
        renderQAudioLanding();
    } else {
        renderQAudioEditor();
    }
};

// Extract video frames for timeline thumbnail strip
async function extractVideoFrames(videoSrc, numFrames = 20) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = videoSrc;
        video.muted = true;
        video.preload = 'metadata';

        // Timeout after 10 seconds
        const timeout = setTimeout(() => {
            console.warn('Frame extraction timed out');
            resolve([]);
        }, 10000);

        video.addEventListener('loadedmetadata', async () => {
            try {
                const duration = video.duration;
                if (!duration || duration <= 0) {
                    clearTimeout(timeout);
                    resolve([]);
                    return;
                }

                const frames = [];
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Set frame size (small thumbnails)
                canvas.width = 80;
                canvas.height = 45;

                for (let i = 0; i < numFrames; i++) {
                    const time = (duration / numFrames) * i;
                    video.currentTime = time;

                    await new Promise((r) => {
                        const seekHandler = () => {
                            try {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                frames.push(canvas.toDataURL('image/jpeg', 0.6));
                            } catch (e) {
                                console.warn('Frame draw failed:', e);
                            }
                            video.removeEventListener('seeked', seekHandler);
                            r();
                        };
                        video.addEventListener('seeked', seekHandler, { once: true });

                        // Fallback timeout for each frame
                        setTimeout(r, 500);
                    });
                }

                clearTimeout(timeout);
                resolve(frames);
            } catch (e) {
                console.error('Frame extraction error:', e);
                clearTimeout(timeout);
                resolve([]);
            }
        });

        video.addEventListener('error', (e) => {
            console.error('Video load error:', e);
            clearTimeout(timeout);
            resolve([]);
        });
    });
}

// Extract frames from the source video element with proper seek synchronization
async function extractFramesFromElement(videoElement, numFrames = 20) {
    logToMain('[extractFramesFromElement] Starting extraction...');

    if (!videoElement || !videoElement.src) {
        logToMain('[extractFramesFromElement] No video element provided');
        return [];
    }

    const duration = videoElement.duration;
    if (!duration || isNaN(duration) || duration <= 0) {
        logToMain('[extractFramesFromElement] Invalid duration:', duration);
        return [];
    }

    if (!videoElement.videoWidth || !videoElement.videoHeight) {
        logToMain('[extractFramesFromElement] Video dimensions not ready');
        return [];
    }

    const frames = [];
    const originalTime = videoElement.currentTime;
    const wasPaused = videoElement.paused;
    if (!wasPaused) videoElement.pause();

    const canvas = document.createElement('canvas');
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    canvas.height = 120;
    canvas.width = Math.round(canvas.height * aspectRatio);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        logToMain('[extractFramesFromElement] Canvas context failed');
        return [];
    }

    logToMain(`[extractFramesFromElement] Extracting ${numFrames} frames from ${duration.toFixed(1)}s video`);

    for (let i = 0; i < numFrames; i++) {
        const targetTime = (duration / numFrames) * i;

        try {
            // Set currentTime and poll until it's close to target
            videoElement.currentTime = targetTime;

            await new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 30;

                const checkSeek = () => {
                    attempts++;
                    if (Math.abs(videoElement.currentTime - targetTime) < 0.5 || attempts >= maxAttempts) {
                        setTimeout(() => {
                            try {
                                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                if (dataUrl && dataUrl.length > 500) {
                                    frames.push(dataUrl);
                                }
                            } catch (e) {
                                logToMain(`[extractFramesFromElement] Frame ${i} draw error:`, e.message);
                            }
                            resolve();
                        }, 30);
                    } else {
                        setTimeout(checkSeek, 50);
                    }
                };
                checkSeek();
            });
        } catch (e) {
            logToMain(`[extractFramesFromElement] Error at frame ${i}:`, e.message);
        }
    }

    // Restore video state
    videoElement.currentTime = originalTime;
    if (!wasPaused) videoElement.play();

    logToMain(`[extractFramesFromElement] Done. Extracted ${frames.length} frames`);
    return frames;
}




// Q Audio Isolate Sound - Call fal.ai API
window.handleQAudioIsolate = async () => {
    if (!qAudioState.filePath || qAudioState.filePath.startsWith('sample://')) {
        alert('Please select a valid audio or video file first.');
        return;
    }

    const descriptionInput = document.getElementById('qAudioDescription');
    const description = descriptionInput?.value?.trim() || 'vocals';

    qAudioState.description = description;
    qAudioState.isProcessing = true;
    qAudioState.error = null;
    qAudioState.result = null;

    // Update UI to show processing
    const isolateBtn = document.getElementById('qAudioIsolateBtn');
    if (isolateBtn) {
        isolateBtn.disabled = true;
        isolateBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';
    }

    try {
        console.log('[Q-Audio] Starting separation...', qAudioState.filePath, description);
        const result = await electron.qAudio.separate(qAudioState.filePath, description);

        if (result.success) {
            // Fix: Unwrap the data object from the main process response
            qAudioState.result = result.data;
            console.log('[Q-Audio] Result received:', qAudioState.result);
            renderQAudioResult();
        } else {
            qAudioState.error = result.error;
            alert('Separation failed: ' + result.error);
        }
    } catch (e) {
        qAudioState.error = e.message;
        alert('Error during separation: ' + e.message);
    } finally {
        qAudioState.isProcessing = false;
        if (isolateBtn) {
            isolateBtn.disabled = false;
            isolateBtn.innerHTML = 'Isolate Sound';
        }
    }
};

// Download separated audio
window.handleQAudioDownload = async (type) => {
    if (!qAudioState.result) return;

    // Support dynamic stems or legacy target/residual
    let url = qAudioState.result[type]?.url;

    // Legacy mapping fallback (if model returns named stems but type is generic)
    if (!url) {
        if (type === 'target') url = qAudioState.result.vocals?.url || qAudioState.result.audio_vocal?.url || qAudioState.result.separated_audio?.url;
        if (type === 'residual') url = qAudioState.result.other?.url || qAudioState.result.background_audio?.url || qAudioState.result.audio_background?.url || qAudioState.result.accompaniment?.url;
    }

    if (!url) {
        alert('Download URL not available for ' + type);
        return;
    }

    const filename = `${qAudioState.fileName?.replace(/\.[^/.]+$/, '') || 'audio'}_${type}.wav`;

    try {
        const result = await electron.qAudio.download(url, filename);
        if (result.success) {
            alert(`Downloaded to: ${result.path}`);
        } else {
            alert('Download failed: ' + result.error);
        }
    } catch (e) {
        alert('Download error: ' + e.message);
    }
};

// Render Q Audio Result view
// Render Q Audio Result view (fal.ai style timeline)
// Toggle Mute for tracks
window.toggleQAudioMute = (trackType, btn) => {
    const isMuted = btn.classList.toggle('muted');

    // Update Audio/Video State
    if (trackType === 'original') {
        const video = document.querySelector('video');
        if (video) video.muted = isMuted;
    } else {
        const audio = document.getElementById(`audio-${trackType}`);
        if (audio) audio.muted = isMuted;
    }

    // Update Icon
    updateMuteIcon(btn, isMuted);
};

function updateMuteIcon(btn, isMuted) {
    if (isMuted) {
        // Muted Icon
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>`;
        btn.style.opacity = '0.5';
    } else {
        // Volume Icon
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
        btn.style.opacity = '1';
    }
}

// Render Q Audio Result view (fal.ai style timeline) - NEW
// Render Q Audio Result view (SAM Audio style: Target + Residual)
function renderQAudioResult() {
    // Robustly find target and residual URLs
    const getUrl = (key) => {
        const root = qAudioState.result || {};

        // Helper to check deeply
        const findUrl = (obj, searchKey) => {
            if (!obj) return null;
            if (obj[searchKey]?.url) return obj[searchKey].url;
            return null;
        };

        // Standard path
        let url = findUrl(root, key) || findUrl(root.data, key);
        if (url) return url;

        // Check for 'stems' array (Fal.ai generic format)
        // Structure: { stems: [{ name: 'vocals', audio_url: { url: ... } }] }
        const stems = root.stems || (root.data && root.data.stems);
        if (Array.isArray(stems) && stems.length > 0) {
            // 1. Try exact name match
            let stem = stems.find(s => s.name === key || (key === 'target' && s.name === qAudioState.description));

            // 2. Fallback: If finding target, assume it's the first stem. If residual, the second.
            if (!stem && stems.length >= 2) {
                if (key === 'target') stem = stems[0];
                if (key === 'residual') stem = stems[1];
            }

            if (stem?.audio_url?.url) return stem.audio_url.url;
        }

        // Mappings for specific model outputs
        if (key === 'target') {
            // SAM Audio typically returns 'target' or keys matching the prompt?
            // Actually, for "music", it might be 'music' or 'target_0'.
            // Let's dump all keys to console in `handleQAudioIsolate` to be sure,
            // but here we try generic fallbacks.
            return findUrl(root, 'target') ||
                findUrl(root, 'music') ||
                findUrl(root, 'vocals') ||
                findUrl(root, 'drums') ||
                // If the model returns exact prompt match
                findUrl(root, qAudioState.description) ||
                // Fal often returns 'audio_vocal' for some models
                findUrl(root, 'audio_vocal');
        }

        if (key === 'residual') {
            return findUrl(root, 'residual') ||
                findUrl(root, 'background') ||
                findUrl(root, 'noise') ||
                findUrl(root, 'other');
        }

        return '';
    };

    const targetUrl = getUrl('target');
    const residualUrl = getUrl('residual');

    console.log('[Q-Audio Debug] Target URL:', targetUrl);
    console.log('[Q-Audio Debug] Residual URL:', residualUrl);

    renderWaveSurferResult('Target vs Residual', [
        { id: 'original', label: 'Original Audio', url: qAudioState.filePath, color: '#64748b', muted: true, isFile: true },
        { id: 'target', label: `Target (${qAudioState.description})`, url: targetUrl, color: '#10b981', muted: true },
        { id: 'residual', label: 'Residual (Background)', url: residualUrl, color: '#f43f5e', muted: false }
    ]);
}

// Global WaveSurfer instances manager
let activeWaveSurfers = [];

function renderWaveSurferResult(title, tracks) {
    // destroy previous instances
    activeWaveSurfers.forEach(ws => ws.destroy());
    activeWaveSurfers = [];

    const tracksHtml = tracks.map(track => `
        <div class="q-sam-track-row" style="height: 64px; margin-bottom: 8px; display: flex; align-items: center; padding: 0 12px; background: rgba(30, 41, 59, 0.4); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
             <div class="q-track-controls" style="width: 32px; margin-right: 12px; display: flex; flex-direction: column; gap: 4px; align-items: center;">
                <button class="q-track-btn ${track.muted ? 'muted' : ''}" onclick="toggleWaveSurferMute('${track.id}', this)" title="Mute/Unmute" style="width: 28px; height: 28px; background: rgba(255,255,255,0.05); border-radius: 4px; border: none; color: ${track.muted ? '#64748b' : '#e2e8f0'}; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${track.muted
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
        }
                </button>
                ${!track.isFile ? `
                <button class="q-track-btn" onclick="handleQAudioDownload('${track.id}')" title="Download" style="width: 28px; height: 28px; background: transparent; border: none; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>` : ''}
            </div>
            
            <div class="q-track-content active" style="flex: 1; height: 100%; position: relative; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                <div class="q-track-label" style="color: ${track.color}; font-weight: 600; font-size: 11px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">${track.label}</div>
                <div id="waveform-${track.id}" class="q-waveform" style="width: 100%; height: 32px;"></div>
            </div>
        </div>
    `).join('');

    // Unified Split SAM Layout for Results (Polished)
    workspaceContent.innerHTML = `
        <div class="q-audio-container" style="display: flex; height: 100%; overflow: hidden; background: #000;">
            
             <!-- Left: Tools & Controls Panel (SAM Style) -->
             <div class="q-sam-sidebar" style="width: 300px; background: #000; color: white; display: flex; flex-direction: column; border-right: 1px solid #1e293b; flex-shrink: 0; padding: 24px;">
                <div style="margin-bottom: 32px; display: flex; align-items: center; justify-content: space-between;">
                     <h2 style="font-size: 16px; font-weight: 600; margin: 0; color: #fff;">Audio Effects</h2>
                     <button onclick="qAudioState.view='editor'; renderQAudio();" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 4px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                     </button>
                </div>

                <div style="margin-bottom: 40px; border-bottom: 1px solid #1e293b; padding-bottom: 0;">
                     <button class="q-sam-tab active" style="background: transparent; border: none; border-bottom: 2px solid #fff; color: white; font-weight: 500; padding: 8px 0; margin-right: 20px; font-size: 13px; margin-bottom: -1px;">Isolated sound</button>
                     <button class="q-sam-tab" style="background: transparent; border: none; color: #64748b; font-weight: 500; padding: 8px 0; font-size: 13px; margin-bottom: -1px;">Without isolated sound</button>
                </div>

                <!-- Volume Control -->
                <div style="margin-bottom: 40px;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 16px; font-weight: 500; text-transform: uppercase;">Volume</div>
                    <div style="display: flex; align-items: center; gap: 12px; background: #0f172a; padding: 12px; border-radius: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" color="#fff"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                        <input type="range" class="q-sam-slider" min="0" max="100" value="80" style="flex: 1; accent-color: #ec4899; height: 3px;">
                    </div>
                </div>

                <!-- Effects List (Visual Only) -->
                <div style="flex: 1; overflow-y: auto;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 16px; font-weight: 500; text-transform: uppercase;">Basic Effects</div>
                    
                    <div class="q-sam-effect-item" style="background: #0f172a; border-radius: 8px; padding: 14px 16px; margin-bottom: 8px; border: 1px solid #1e293b; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 500; font-size: 13px;">Reverb</span>
                            <div style="font-size: 11px; opacity: 0.5;">ℹ️</div>
                        </div>
                    </div>
                    <div class="q-sam-effect-item" style="background: #0f172a; border-radius: 8px; padding: 14px 16px; margin-bottom: 8px; border: 1px solid #1e293b; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 500; font-size: 13px;">Delay</span>
                            <div style="font-size: 11px; opacity: 0.5;">ℹ️</div>
                        </div>
                    </div>
                     <div class="q-sam-effect-item" style="background: #0f172a; border-radius: 8px; padding: 14px 16px; margin-bottom: 8px; border: 1px solid #1e293b; transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 500; font-size: 13px;">Equalizer</span>
                            <div style="font-size: 11px; opacity: 0.5;">ℹ️</div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: auto; padding-top: 20px;">
                    <button class="q-new-btn" onclick="qAudioState = { view: 'landing', filePath: null, fileName: null, description: 'vocals', isProcessing: false, error: null, result: null }; renderQAudio();" style="width: 100%; justify-content: center; background: #1e293b; border: 1px solid #334155; color: #fff; font-size: 13px; padding: 10px;">
                        Start New Project
                    </button>
                </div>
            </div>

            <!-- Right: Player Stage -->
             <div class="q-preview-panel" style="flex: 1; position: relative; display: flex; flex-direction: column; overflow: hidden; background: #000;">
                 <div class="q-sam-editor" style="margin: 0; border: none; border-radius: 0; box-shadow: none; height: 100%; display: flex; flex-direction: column; background: #000;">
                    
                    <!-- Top Actions -->
                    <div style="position: absolute; top: 20px; right: 24px; z-index: 50; display: flex; gap: 12px; align-items: center;">
                        <button style="padding: 0 16px; height: 32px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: #94a3b8; font-size: 12px; font-weight: 500; cursor: pointer;">Start Over</button>
                        <button style="width: 32px; height: 32px; border-radius: 50%; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </button>
                         <button onclick="handleQAudioDownload('all')" style="width: 32px; height: 32px; border-radius: 50%; background: #a855f7; border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(168, 85, 247, 0.3);">
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                    </div>

                    <!-- Video Stage -->
                    <div class="q-sam-video-stage" style="flex: 1; background: #000; display: flex; align-items: center; justify-content: center;">
                         <div id="video-container" style="width:100%; height:100%; max-height:80vh; position:relative;">
                             <video id="main-video" src="${escapeHtml(qAudioState.filePath)}" controls style="max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; outline: none;" muted></video>
                        </div>
                    </div>

                    <!-- Timeline Control Bar -->
                    <div class="q-sam-timeline" style="height: 280px; align-items: flex-start; padding-top: 24px; background: #0f172a; border-top: 1px solid #1e293b;"> 
                        <!-- Controls -->
                         <div class="q-sam-controls" style="margin-top: 8px;">
                            <button class="q-sam-play-btn" id="qSamPlayBtn" onclick="toggleVideoPlayback()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </button>
                        </div>

                        <!-- Tracks List -->
                        <div class="q-sam-tracks" style="overflow-y: auto; padding-right: 8px; height: 100%;">
                            
                            <!-- Video Frame Strip -->
                            <div class="q-sam-track-row" style="height: 48px; margin-bottom: 4px; display: flex; align-items: center; padding: 0 12px; border: none !important; background: transparent !important;">
                                <!-- Spacer to align with track controls (Width 32px + Margin 12px) -->
                                <div style="width: 32px; margin-right: 12px; flex-shrink: 0;"></div>
                                <div class="q-sam-frame-strip" id="qAudioResultFrameStrip" style="flex: 1; height: 100%; position: relative; border-radius: 4px; overflow: hidden; background: #000;">
                                    <div class="q-sam-loading-strip">Generating preview frames...</div>
                                </div>
                            </div>
                            
                            ${tracksHtml}
                            
                            <!-- Global Playhead -->
                            <div class="q-sam-playhead" id="playhead-global" style="height: 100%;"></div>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    `;

    // Initialize WaveSurfer & Logic
    setTimeout(() => {
        // Use passed tracks argument, but ensure URLs are valid
        // Clear existing instances
        activeWaveSurfers.forEach(ws => ws.destroy());
        activeWaveSurfers = [];

        tracks.forEach(track => {
            if (!track.url) return;

            // Ensure media URL
            let safeUrl = track.url;
            if (safeUrl && !safeUrl.startsWith('file://') && !safeUrl.startsWith('http')) {
                safeUrl = getMediaUrl(safeUrl);
            }

            try {
                const ws = WaveSurfer.create({
                    container: `#waveform-${track.id}`,
                    waveColor: track.color, // Full color for visibility
                    progressColor: track.color, // Same color
                    url: safeUrl,
                    height: 48,
                    barWidth: 2,
                    barGap: 2,
                    barRadius: 2,
                    normalize: true,
                    cursorWidth: 0, // No cursor per track, using global playhead
                    interact: false, // Click handled by global container
                    hideScrollbar: true,
                    autoScroll: false,
                    minPxPerSec: 0, // Fit to container
                    fillParent: true
                });
                ws.setMuted(track.muted);
                ws.trackId = track.id;
                activeWaveSurfers.push(ws);
            } catch (e) { console.error(e); }
        });

        // Frame Extraction Logic (Canvas)
        const video = document.getElementById('main-video');
        const frameStripEl = document.getElementById('qAudioResultFrameStrip');

        if (video && frameStripEl) {
            const extractFrames = async () => {
                if (video.videoWidth === 0) { setTimeout(extractFrames, 300); return; }

                const dur = video.duration || 1;
                const numFrames = 20;
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const ar = video.videoWidth / video.videoHeight;
                canvas.height = 48;
                canvas.width = 48 * ar;

                const frames = [];
                const wasPlaying = !video.paused;
                if (wasPlaying) video.pause();
                const originalTime = video.currentTime;

                for (let i = 0; i < numFrames; i++) {
                    video.currentTime = (i / numFrames) * dur;
                    await new Promise(r => {
                        const check = () => (video.readyState >= 2) ? r() : setTimeout(check, 20);
                        check();
                    });
                    // extra wait for render
                    await new Promise(r => setTimeout(r, 50));

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    frames.push(canvas.toDataURL('image/jpeg', 0.6));
                }

                if (wasPlaying) video.play();
                else video.currentTime = originalTime;

                // Inject frames
                frameStripEl.innerHTML = '';
                frames.forEach(src => {
                    const d = document.createElement('div');
                    d.className = 'q-sam-frame';
                    d.style.backgroundImage = `url(${src})`;
                    d.style.borderRight = '1px solid rgba(255,255,255,0.1)';
                    frameStripEl.appendChild(d);
                });
            };
            // Start extraction with delay
            setTimeout(extractFrames, 800);
        }

        // Fix Play Button Sync & Global Playhead
        const playBtn = document.getElementById('qSamPlayBtn');
        const tracksContainer = document.querySelector('.q-sam-tracks');
        const playhead = document.getElementById('playhead-global');

        if (video && playBtn) {
            video.addEventListener('play', () => {
                playBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
            });
            video.addEventListener('pause', () => {
                playBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
                // Sync WaveSurfers on pause to be sure
                activeWaveSurfers.forEach(ws => ws.setTime(video.currentTime));
            });

            // Sync global playhead & WaveSurfers
            if (tracksContainer && playhead) {
                video.addEventListener('timeupdate', () => {
                    const t = video.currentTime;
                    const d = video.duration || 1;
                    const p = (t / d) * 100;
                    playhead.style.left = `${p}%`;

                    // Sync wavesurfers if needed (they usually play audio themselves, but we are using audio elements? 
                    // Wait, renderWaveSurferResult uses WaveSurfer for AUDIO PLAYBACK too if created with URL)
                    // Actually, let's verify if we are using WaveSurfer 'media' option or just visualization.
                    // Created with 'url', so it handles playback. We need to sync video -> wavesurfer seek.

                    // Actually, better to mute WaveSurfers and let Video play? No, video is muted.
                    // So WaveSurfers must play.
                });

                // Seek
                tracksContainer.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    const rect = tracksContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const p = Math.max(0, Math.min(1, x / rect.width));
                    const time = p * (video.duration || 1);
                    video.currentTime = time;
                    activeWaveSurfers.forEach(ws => ws.setTime(time));
                });
            }

            // Master Play/Pause
            window.toggleVideoPlayback = () => {
                if (video.paused) {
                    video.play();
                    activeWaveSurfers.forEach(ws => ws.play());
                } else {
                    video.pause();
                    activeWaveSurfers.forEach(ws => ws.pause());
                }
            };
        }
    }, 100);

    // Initialize WaveSurfer
    requestAnimationFrame(() => {
        tracks.forEach(track => {
            if (!track.url) return;

            try {
                const ws = WaveSurfer.create({
                    container: `#waveform-${track.id}`,
                    waveColor: track.color + '80', // 50% opacity for better visibility on white
                    progressColor: track.color,
                    url: track.url,
                    height: 48,
                    barWidth: 2,
                    barGap: 1,
                    barRadius: 2,
                    normalize: true,
                    cursorWidth: 2,
                    cursorColor: '#334155', // Dark cursor for light mode
                    interact: true,
                    minPxPerSec: 50,
                    hideScrollbar: true,
                    autoScroll: true,
                    autoCenter: true,
                });

                ws.setMuted(track.muted);
                ws.trackId = track.id;
                activeWaveSurfers.push(ws);

                ws.on('ready', () => {
                    console.log(`WaveSurfer ready: ${track.id}`);
                });

                ws.on('error', (e) => {
                    console.error(`WaveSurfer error ${track.id}:`, e);
                });

            } catch (e) {
                console.error("WaveSurfer init failed:", e);
            }
        });

        // Sync Logic
        const video = document.getElementById('main-video');
        if (video) {
            const syncAudio = () => {
                const time = video.currentTime;
                activeWaveSurfers.forEach(ws => {
                    // Check if ready
                    if (ws.getDuration() > 0 && Math.abs(ws.getCurrentTime() - time) > 0.2) {
                        ws.setTime(time);
                    }
                });
            };

            video.addEventListener('play', () => activeWaveSurfers.forEach(ws => ws.play()));
            video.addEventListener('pause', () => activeWaveSurfers.forEach(ws => ws.pause()));
            video.addEventListener('seeking', syncAudio);
            video.addEventListener('timeupdate', () => {
                // Only sync occasionally if needed, or rely on seek events
                // video.timeupdate fires frequently. 
                // Aggressive sync:
                if (!video.paused) {
                    const time = video.currentTime;
                    activeWaveSurfers.forEach(ws => {
                        const diff = Math.abs(ws.getCurrentTime() - time);
                        if (diff > 0.3) {
                            ws.setTime(time);
                        }
                    });
                }
            });

            activeWaveSurfers.forEach(ws => {
                ws.on('interaction', (newTime) => {
                    // Interaction in WaveSurfer (click/drag)
                    // If user clicks, we seek video
                    // Note: newTime might not be passed in v7 interaction event directly depending on version, 
                    // but getCurrentTime() works.
                    setTimeout(() => {
                        const t = ws.getCurrentTime();
                        if (Math.abs(video.currentTime - t) > 0.1) {
                            video.currentTime = t;
                        }
                    }, 10);
                });
            });
        }
    });
}

window.toggleWaveSurferMute = (trackId, btn) => {
    const ws = activeWaveSurfers.find(w => w.trackId === trackId);
    if (ws) {
        const isMuted = !ws.getMuted();
        ws.setMuted(isMuted);

        // Update UI
        updateMuteIcon(btn, isMuted);
        btn.classList.toggle('muted', isMuted);
    }
};

// Render Q Audio Result view (supports multiple stems)
function renderQAudioResult_Demucs() {
    // Detect available stems
    const possibleStems = ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano'];
    const validStems = possibleStems.filter(stem => qAudioState.result && qAudioState.result[stem]);

    // Fallback for legacy/sam-audio result
    if (validStems.length === 0) {
        if (qAudioState.result?.target) validStems.push('target');
        if (qAudioState.result?.residual) validStems.push('residual');
    }

    // Generate HTML for tracks (SAM Style Rows)
    const tracksHtml = validStems.map(stem => {
        const url = qAudioState.result[stem]?.url || (stem === 'target' ? qAudioState.result.target?.url : qAudioState.result.residual?.url);
        // Colors: Vocals=Green, Drums=Yellow, Bass=Blue, Other=Red
        const colorMap = {
            'vocals': '#10b981', 'target': '#10b981',
            'drums': '#f59e0b',
            'bass': '#3b82f6',
            'other': '#f43f5e', 'residual': '#f43f5e',
            'guitar': '#8b5cf6',
            'piano': '#ec4899'
        };
        const color = colorMap[stem] || '#64748b';
        const label = stem.charAt(0).toUpperCase() + stem.slice(1);

        return `
            <div class="q-sam-track-row" style="height: 56px; margin-bottom: 8px;">
                 <div class="q-waveform-controls" style="margin-right: 12px; justify-content: center;">
                    <button class="q-waveform-mute-btn" onclick="toggleWaveSurferMute('${stem}', this)" title="Mute/Unmute">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    </button>
                    <button class="q-waveform-mute-btn" onclick="handleQAudioDownload('${stem}')" title="Download" style="width: 28px; height: 28px; border: none; box-shadow: none; color: #94a3b8;">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>

                <div class="q-sam-waveform" id="waveform-${stem}" style="background: ${color}10; border: 1px solid ${color}30;">
                    <div class="q-sam-track-label" style="background: ${color}20; color: ${color}; top: 8px; transform: none; left: 8px;">${label}</div>
                     <!-- WaveSurfer instance injected here -->
                </div>
            </div>
        `;
    }).join('');

    workspaceContent.innerHTML = `
        <div class="q-audio-container">
            <!-- Unified SAM Layout for Results -->
             <div class="q-preview-panel">
                 <div class="q-sam-editor">
                    
                    <!-- Top Bar (Back & Title) -->
                    <div style="position: absolute; top: 16px; left: 16px; z-index: 50; display: flex; align-items: center; gap: 12px;">
                        <button class="q-back-btn" onclick="qAudioState.view='editor'; renderQAudio();" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: white;">
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        </button>
                        <h1 style="color: white; font-size: 16px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">Separation Complete</h1>
                    </div>

                    <div style="position: absolute; top: 16px; right: 16px; z-index: 50;">
                         <button class="q-new-btn" onclick="qAudioState = { view: 'landing', filePath: null, fileName: null, description: 'vocals', isProcessing: false, error: null, result: null }; renderQAudio();" style="padding: 6px 16px; height: 36px; font-size: 13px;">
                            New Project
                        </button>
                    </div>

                    <!-- Video Stage -->
                    <div class="q-sam-video-stage">
                         <div id="video-container" style="width:100%; height:100%; position:relative;">
                             <video id="main-video" src="${escapeHtml(qAudioState.filePath)}" controls style="max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; outline: none;" muted></video>
                        </div>
                    </div>

                    <!-- Timeline Control Bar -->
                    <div class="q-sam-timeline" style="height: 280px; align-items: flex-start; padding-top: 24px;"> 
                        <!-- Controls -->
                         <div class="q-sam-controls" style="margin-top: 8px;">
                            <button class="q-sam-play-btn" id="qSamPlayBtn" onclick="toggleVideoPlayback()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </button>
                            <div style="font-size: 11px; color: #64748b; font-weight: 500;">ALL</div>
                        </div>

                        <!-- Tracks List -->
                        <div class="q-sam-tracks" style="overflow-y: auto; padding-right: 8px;">
                             <!-- Original Track (Muted by default) -->
                            <div class="q-sam-track-row" style="height: 56px; margin-bottom: 8px;">
                                 <div class="q-waveform-controls" style="margin-right: 12px; justify-content: center;">
                                    <button class="q-waveform-mute-btn muted" onclick="toggleWaveSurferMute('original', this)" title="Mute/Unmute">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>
                                    </button>
                                </div>
                                <div class="q-sam-waveform" id="waveform-original" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                                    <div class="q-sam-track-label" style="top: 8px; transform: none; left: 8px;">Original</div>
                                </div>
                            </div>

                            ${tracksHtml}
                            
                            <!-- Global Playhead -->
                            <div class="q-sam-playhead" id="playhead-global" style="height: 100%;"></div>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    `;

    // Add logic similar to renderWaveSurferResult
    setTimeout(() => {
        // Initialize WaveSurfer
        const tracks = [
            { id: 'original', url: qAudioState.filePath ? getMediaUrl(qAudioState.filePath) : null, color: '#94a3b8', muted: true }
        ];

        validStems.forEach(stem => {
            const url = qAudioState.result[stem]?.url || (stem === 'target' ? qAudioState.result.target?.url : qAudioState.result.residual?.url);
            const colorMap = {
                'vocals': '#10b981', 'target': '#10b981',
                'drums': '#f59e0b',
                'bass': '#3b82f6',
                'other': '#f43f5e', 'residual': '#f43f5e',
                'guitar': '#8b5cf6',
                'piano': '#ec4899'
            };
            tracks.push({
                id: stem,
                url: url,
                color: colorMap[stem] || '#64748b',
                muted: false // Stems play by default
            });
        });

        renderWaveSurferResult('Separation Result', tracks);

        // Fix Play Button Sync
        const video = document.getElementById('main-video');
        const playBtn = document.getElementById('qSamPlayBtn');
        if (video && playBtn) {
            video.addEventListener('play', () => {
                playBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
            });
            video.addEventListener('pause', () => {
                playBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
            });

            // Sync global playhead in the tracks area
            const tracksContainer = document.querySelector('.q-sam-tracks');
            const playhead = document.getElementById('playhead-global');

            if (tracksContainer && playhead) {
                video.addEventListener('timeupdate', () => {
                    const p = (video.currentTime / (video.duration || 1)) * 100;
                    playhead.style.left = `${p}%`;
                });

                tracksContainer.addEventListener('click', (e) => {
                    // Only seek if clicking on waveform area, not buttons
                    if (e.target.closest('button')) return;

                    const rect = tracksContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    // Adjust for padding if needed, but roughly:
                    const p = Math.max(0, Math.min(1, x / rect.width));
                    video.currentTime = p * (video.duration || 1);
                });
            }
        }
    }, 100);
}

// Legacy function (renamed)
function renderQAudioResult_Legacy() {
    workspaceContent.innerHTML = `
        <div class="q-audio-container">
            <!-- Left Info Panel -->
            <div class="q-controls-panel">
                <div class="q-header">
                    <button class="q-back-btn" onclick="qAudioState.view='editor'; renderQAudio();">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </button>
                    <h1>Separation Complete</h1>
                </div>

                <div class="q-result-summary" style="padding: 24px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #fff;">${escapeHtml(qAudioState.fileName)}</h3>
                    <div style="font-size: 13px; color: #94a3b8; margin-bottom: 24px;">
                        Duration: ${qAudioState.result?.duration?.toFixed(1) || 0}s
                    </div>
                    
                    <button class="q-new-btn" style="width: 100%;" onclick="qAudioState = { view: 'landing', filePath: null, fileName: null, description: 'vocals', isProcessing: false, error: null, result: null }; renderQAudio();">
                        Start New Project
                    </button>
                </div>
            </div>

            <!-- Right Preview Panel -->
            <div class="q-preview-panel">
                <div class="q-video-area">
                    <video src="${escapeHtml(qAudioState.filePath)}" controls style="max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; outline: none; background: #000;"></video>
                </div>

                <div class="q-timeline-area" style="height: 280px;">
                    <div class="q-timeline-tools">
                        <div style="color: #64748b; font-size: 12px; font-family: monospace;">Result Preview - ${qAudioState.description}</div>
                    </div>
                    
                    <div class="q-tracks-container">
                        <!-- Original (Default Muted) -->
                        <div class="q-track">
                             <div class="q-track-controls" style="flex-direction: column; gap: 8px;">
                                <button class="q-track-btn muted" onclick="toggleQAudioMute('original', this)" title="Mute/Unmute" style="opacity: 0.5;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>
                                </button>
                                <span style="font-size: 10px; color: #64748b; font-weight: 600;">ORIG</span>
                            </div>
                            <div class="q-track-content">
                                <div class="q-track-label">Original Audio</div>
                                <div class="q-waveform"></div>
                            </div>
                        </div>

                        <!-- Target (Default Unmuted) -->
                        <div class="q-track">
                            <div class="q-track-controls" style="flex-direction: column; gap: 8px;">
                                <button class="q-track-btn" onclick="toggleQAudioMute('target', this)" title="Mute/Unmute">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                </button>
                                <button class="q-track-btn" onclick="handleQAudioDownload('target')" title="Download Target">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                            </div>
                            <div class="q-track-content active" style="background: rgba(16, 185, 129, 0.1); border-left: 2px solid #10b981;">
                                <div class="q-track-label" style="color: #10b981;">Target (${escapeHtml(qAudioState.description)})</div>
                                <div class="q-waveform" style="opacity: 0.8;"></div>
                                <audio src="${qAudioState.result?.target?.url}" id="audio-target"></audio>
                            </div>
                        </div>

                         <!-- Residual (Default Unmuted) -->
                        <div class="q-track">
                            <div class="q-track-controls" style="flex-direction: column; gap: 8px;">
                                <button class="q-track-btn" onclick="toggleQAudioMute('residual', this)" title="Mute/Unmute">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                </button>
                                <button class="q-track-btn" onclick="handleQAudioDownload('residual')" title="Download Residual">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                            </div>
                            <div class="q-track-content" style="background: rgba(244, 63, 94, 0.1); border-left: 2px solid #f43f5e;">
                                <div class="q-track-label" style="color: #f43f5e;">Residual</div>
                                <div class="q-waveform" style="opacity: 0.8;"></div>
                                <audio src="${qAudioState.result?.residual?.url}" id="audio-residual"></audio>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Sync Playback Logic
    const video = document.querySelector('video');
    const targetAudio = document.getElementById('audio-target');
    const residualAudio = document.getElementById('audio-residual');

    if (video) {
        // Mute video to hear results clearly, users can unmute via controls if they want (but better default is mute)
        video.muted = true;

        video.onplay = () => {
            if (targetAudio) targetAudio.play();
            if (residualAudio) residualAudio.play();
        };
        video.onpause = () => {
            if (targetAudio) targetAudio.pause();
            if (residualAudio) residualAudio.pause();
        };
        video.onseeked = () => {
            if (targetAudio) targetAudio.currentTime = video.currentTime;
            if (residualAudio) residualAudio.currentTime = video.currentTime;
        };
        video.onratechange = () => {
            if (targetAudio) targetAudio.playbackRate = video.playbackRate;
            if (residualAudio) residualAudio.playbackRate = video.playbackRate;
        };
    }
}

// Old render function (Deprecated)
function renderQAudioResult_Old() {
    workspaceContent.innerHTML = `
        <div class="q-audio-container">
            <!-- Left Info Panel -->
            <div class="q-controls-panel">
                <div class="q-header">
                    <button class="q-back-btn" onclick="qAudioState.view='editor'; renderQAudio();">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </button>
                    <h1>Separation Complete</h1>
                </div>

                <div class="q-result-summary" style="padding: 24px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #fff;">${escapeHtml(qAudioState.fileName)}</h3>
                    <div style="font-size: 13px; color: #94a3b8; margin-bottom: 24px;">
                        Duration: ${qAudioState.result?.duration?.toFixed(1) || 0}s
                    </div>
                    
                    <button class="q-new-btn" style="width: 100%;" onclick="qAudioState = { view: 'landing', filePath: null, fileName: null, description: 'vocals', isProcessing: false, error: null, result: null }; renderQAudio();">
                        Start New Project
                    </button>
                </div>
            </div>

            <!-- Right Preview Panel -->
            <div class="q-preview-panel">
                <div class="q-video-area">
                    <video src="${escapeHtml(qAudioState.filePath)}" controls style="max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; outline: none; background: #000;"></video>
                </div>

                <div class="q-timeline-area" style="height: 280px;">
                    <div class="q-timeline-tools">
                        <div style="color: #64748b; font-size: 12px; font-family: monospace;">Result Preview - ${qAudioState.description}</div>
                    </div>
                    
                    <div class="q-tracks-container">
                        <!-- Original -->
                        <div class="q-track">
                             <div class="q-track-controls">
                                <span style="font-size: 10px; color: #64748b; font-weight: 600;">ORIGINAL</span>
                            </div>
                            <div class="q-track-content">
                                <div class="q-track-label">Original Audio</div>
                                <div class="q-waveform"></div>
                            </div>
                        </div>

                        <!-- Target -->
                        <div class="q-track">
                            <div class="q-track-controls">
                                <button class="q-track-btn" onclick="handleQAudioDownload('target')" title="Download Target">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                            </div>
                            <div class="q-track-content active" style="background: rgba(16, 185, 129, 0.1); border-left: 2px solid #10b981;">
                                <div class="q-track-label" style="color: #10b981;">Target (${escapeHtml(qAudioState.description)})</div>
                                <div class="q-waveform" style="opacity: 0.8;"></div>
                                <audio src="${qAudioState.result?.target?.url}" id="audio-target"></audio>
                            </div>
                        </div>

                         <!-- Residual -->
                        <div class="q-track">
                            <div class="q-track-controls">
                                <button class="q-track-btn" onclick="handleQAudioDownload('residual')" title="Download Residual">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                            </div>
                            <div class="q-track-content" style="background: rgba(244, 63, 94, 0.1); border-left: 2px solid #f43f5e;">
                                <div class="q-track-label" style="color: #f43f5e;">Residual</div>
                                <div class="q-waveform" style="opacity: 0.8;"></div>
                                <audio src="${qAudioState.result?.residual?.url}" id="audio-residual"></audio>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Sync Playback Logic
    const video = document.querySelector('video');
    const targetAudio = document.getElementById('audio-target');
    const residualAudio = document.getElementById('audio-residual');

    if (video) {
        // Mute video to hear results clearly, users can unmute via controls if they want (but better default is mute)
        video.muted = true;

        video.onplay = () => {
            if (targetAudio) targetAudio.play();
            if (residualAudio) residualAudio.play();
        };
        video.onpause = () => {
            if (targetAudio) targetAudio.pause();
            if (residualAudio) residualAudio.pause();
        };
        video.onseeked = () => {
            if (targetAudio) targetAudio.currentTime = video.currentTime;
            if (residualAudio) residualAudio.currentTime = video.currentTime;
        };
        video.onratechange = () => {
            if (targetAudio) targetAudio.playbackRate = video.playbackRate;
            if (residualAudio) residualAudio.playbackRate = video.playbackRate;
        };
    }
}


function renderQAudioLanding() {
    workspaceContent.innerHTML = `
            <div class="q-landing">
                <div class="q-landing-content">
                    <div class="q-landing-left">
                        <div class="q-landing-header">
                            <h1 class="q-title">Isolate sounds</h1>
                            <p class="q-subtitle">Extract sounds and add effects to them.</p>
                        </div>
                        
                        <div class="q-steps">
                            <div class="q-steps-title">How it works</div>
                            <div class="q-step-item">
                                <span class="q-step-num">1.</span>
                                <span>Add audio or video</span>
                            </div>
                            <div class="q-step-item">
                                <span class="q-step-num">2.</span>
                                <span>Isolate sound</span>
                            </div>
                            <div class="q-step-item">
                                <span class="q-step-num">3.</span>
                                <span>Add effects</span>
                            </div>
                        </div>

                        <div class="q-model-badge">
                            <span class="q-model-label">Model</span>
                            <span class="q-model-name">SAM Audio <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></span>
                        </div>
                    </div>

                    <div class="q-landing-right">
                        <div class="q-upload-card">
                            <div class="q-upload-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="17 8 12 3 7 8"/>
                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                            </div>
                            <h2 class="q-upload-title">Start with your own audio or video</h2>
                            <button class="q-upload-btn" onclick="handleQAudioUpload()">Upload</button>
                        </div>


                    </div>
                </div>
            </div>
        `;
}

// Helper for icons
function getIcon(name) {
    const icons = {
        'mic': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
    };
    return icons[name] || '';
}

function renderQAudioEditor() {
    workspaceContent.innerHTML = `
        <div class="q-audio-container">
            <!-- Left Controls Panel -->
            <div class="q-controls-panel">
                <div class="q-panel-header">
                    <button class="q-back-btn" onclick="qAudioState.view='landing'; renderQAudio();">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </button>
                    <div>
                        <div class="q-panel-title">Isolate Sound</div>
                        <div class="q-panel-subtitle">${escapeHtml(qAudioState.fileName || 'No file selected')}</div>
                    </div>
                </div>

                <!-- Separation Controls -->
                <div class="q-controls-section">
                    <div class="q-section-title">What sound to isolate?</div>
                    <input type="text" id="qAudioDescription" class="q-description-input" 
                           placeholder="Type any sound (e.g., siren, footsteps, clapping)..."
                           value="${escapeHtml(qAudioState.description || 'vocals')}">
                    <div style="font-size: 11px; color: #64748b; margin-top: 6px; margin-bottom: 10px;">
                        * You can type <b>any sound</b> description. The buttons below are just examples.
                    </div>
                    <div class="q-prompt-hints">
                        <span class="q-hint" onclick="document.getElementById('qAudioDescription').value='vocals'">vocals</span>
                        <span class="q-hint" onclick="document.getElementById('qAudioDescription').value='music'">background music</span>
                        <span class="q-hint" onclick="document.getElementById('qAudioDescription').value='drums'">drums</span>
                        <span class="q-hint" onclick="document.getElementById('qAudioDescription').value='guitar'">guitar</span>
                        <span class="q-hint" onclick="document.getElementById('qAudioDescription').value='speech'">speech</span>
                        <span class="q-hint" onclick="document.getElementById('qAudioDescription').value='piano'">piano</span>
                    </div>
                    <button id="qAudioIsolateBtn" class="q-isolate-btn" onclick="handleQAudioIsolate()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        </svg>
                        Isolate Sound
                    </button>
                </div>

                <div class="q-divider"></div>

                <div class="q-controls-section">
                    <div class="q-section-title">Audio Effects (After Separation)</div>
                    <div class="q-slider-container">
                        ${getIcon('mic')}
                        <div class="q-slider">
                            <div class="q-slider-fill" style="width: 70%"></div>
                            <div class="q-slider-thumb"></div>
                        </div>
                    </div>
                </div>


                <div class="q-controls-section">
                    <div class="q-section-title">Basic Effects</div>
                    <div class="q-effect-item">
                        <div class="q-effect-name">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            Reverb
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #cbd5e1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                    <div class="q-effect-item">
                        <div class="q-effect-name">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Delay
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #cbd5e1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                    <div class="q-effect-item">
                        <div class="q-effect-name">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                            Equalizer
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #cbd5e1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                    <div class="q-effect-item">
                        <div class="q-effect-name">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                            Compressor
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #cbd5e1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                </div>

                <div class="q-controls-section">
                    <div class="q-section-title">Vocal Enhancers</div>
                    <div class="q-effect-item">
                        <div class="q-effect-name">
                            ${getIcon('mic')}
                            Studio Sound
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #cbd5e1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                    <div class="q-effect-item">
                        <div class="q-effect-name">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
                            Broadcast Ready
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #cbd5e1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                </div>
            </div>

            <!-- Right Preview Panel (Unified SAM Layout) -->
            <div class="q-preview-panel">
                 <!-- Main Editor Card -->
                 <div class="q-sam-editor">
                    
                    <!-- Video Stage -->
                    <div class="q-sam-video-stage">
                         ${(() => {
            if (!qAudioState.filePath) return `<div class="q-sam-empty-state">
                            <div class="q-sam-empty-icon">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                </svg>
                            </div>
                            <span class="q-sam-empty-text">Load a video to start editing audio</span>
                        </div>`;

            const videoSrc = getMediaUrl(qAudioState.filePath);
            return `<video src="${videoSrc}" class="q-sam-video" controls id="main-video"
                                onerror="logToMain('[Q-Audio] VIDEO ERROR:', this.error ? this.error.message : 'Unknown error');"></video>`;
        })()}
                    </div>

                    <!-- Timeline Control Bar (Attached Bottom) -->
                    <div class="q-sam-timeline">
                        <!-- Playback Controls (Left) -->
                        <div class="q-sam-controls">
                            <button class="q-sam-play-btn" id="qSamPlayBtn" onclick="toggleVideoPlayback()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </button>
                            <button class="q-sam-mute-btn" onclick="toggleVideoMute()">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                            </button>
                        </div>

                        <!-- Tracks Area (Right) -->
                        <div class="q-sam-tracks">
                            
                            <!-- Video Frame Strip -->
                            <div class="q-sam-track-row" style="height: 48px; margin-bottom: 4px;">
                                <div class="q-sam-frame-strip" id="qAudioFrameStrip">
                                    <!-- Frames will be injected here -->
                                     <div class="q-sam-loading-strip">Generating frames...</div>
                                </div>
                            </div>

                            <!-- Waveform Track -->
                            <div class="q-sam-track-row" style="height: 40px;">
                                <div class="q-sam-track-label">Original sound</div>
                                <div class="q-sam-waveform" id="qAudioWaveform">
                                    <!-- Waveform SVG inserted here -->
                                </div>
                            </div>

                            <!-- Playhead (Overlay) -->
                            <div class="q-sam-playhead" id="qSamPlayhead"></div>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    `;

    // Initialize icons
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) { }

    // Attach logic
    const video = document.getElementById('main-video');
    const playBtn = document.getElementById('qSamPlayBtn');

    // Add global toggle function helper
    window.toggleVideoPlayback = () => {
        const v = document.getElementById('main-video');
        if (v) {
            if (v.paused) v.play(); else v.pause();
        }
    };

    window.toggleVideoMute = () => {
        const v = document.getElementById('main-video');
        if (v) v.muted = !v.muted;
    };

    if (qAudioState.filePath && !qAudioState.filePath.startsWith('sample://')) {
        setTimeout(() => {
            const waveformContainer = document.getElementById('qAudioWaveform');
            const playhead = document.getElementById('qSamPlayhead');
            const frameStripEl = document.getElementById('qAudioFrameStrip');

            if (video) {
                // Play/Pause Icon Update
                video.addEventListener('play', () => {
                    if (playBtn) playBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
                });
                video.addEventListener('pause', () => {
                    if (playBtn) playBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
                });

                // Create SAM Waveform
                if (waveformContainer) {
                    const createSAMWaveform = () => {
                        const numBars = 150;
                        const height = 40;
                        let bars = '';
                        for (let i = 0; i < numBars; i++) {
                            const t = i / numBars;
                            const wave = Math.sin(t * Math.PI * 10) * Math.sin(t * Math.PI * 3) * Math.random();
                            const barHeight = Math.max(3, Math.abs(wave) * 30);
                            const x = (t * 100);
                            const y = (height - barHeight) / 2;
                            bars += `<rect x="${x}%" y="${y}" width="0.4%" height="${barHeight}" fill="#94a3b8" rx="1"/>`;
                        }
                        return `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" style="width:100%;height:100%">${bars}</svg>`;
                    };
                    waveformContainer.innerHTML = createSAMWaveform();
                }

                // Playhead Sync
                if (playhead) {
                    // The track area is the reference width
                    const updatePlayhead = () => {
                        const percent = (video.currentTime / (video.duration || 1)) * 100;
                        playhead.style.left = `${percent}%`;
                    };
                    video.addEventListener('timeupdate', updatePlayhead);

                    // Seek on click
                    const tracks = document.querySelector('.q-sam-tracks');
                    if (tracks) {
                        tracks.addEventListener('click', (e) => {
                            const rect = tracks.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const p = x / rect.width;
                            video.currentTime = p * (video.duration || 1);
                        });
                    }
                }

                // Frame Strip Logic
                if (frameStripEl) {
                    const extractFramesWithCanvas = async () => {
                        if (video.videoWidth === 0) { setTimeout(extractFramesWithCanvas, 200); return; }

                        const numFrames = 20;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const ar = video.videoWidth / video.videoHeight;
                        canvas.height = 48;
                        canvas.width = 48 * ar;

                        let framesHtml = '';
                        const dur = video.duration || 1;

                        // Simple sequential extractor (fast approximation)
                        // For true frames we need the async approach used before, keeping it simple for layout demo
                        // Reusing similar logic but inline styling

                        frameStripEl.innerHTML = '';
                        frameStripEl.className = 'q-sam-frame-strip loaded';

                        // Just populate placeholders first to show layout immediately
                        for (let i = 0; i < numFrames; i++) {
                            const div = document.createElement('div');
                            div.className = 'q-sam-frame';
                            // div.style.backgroundImage = `url(...)`; // We would inject real frames here
                            frameStripEl.appendChild(div);
                        }

                        // Async Real Extraction
                        const frames = [];
                        if (!video.paused) video.pause();
                        const originalTime = video.currentTime;

                        for (let i = 0; i < numFrames; i++) {
                            video.currentTime = (i / numFrames) * dur;
                            await new Promise(r => setTimeout(r, 100)); // wait for seek
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const url = canvas.toDataURL('image/jpeg', 0.5);

                            if (frameStripEl.children[i]) {
                                frameStripEl.children[i].style.backgroundImage = `url(${url})`;
                                frameStripEl.children[i].style.backgroundSize = 'cover';
                            }
                        }
                        video.currentTime = originalTime;
                    };
                    // extractFramesWithCanvas(); // Call this optionally or integrate properly

                    // Use existing logic wrapper if available or simple:
                    extractFramesWithCanvas();
                }
            }
        }, 100);
    }
}
