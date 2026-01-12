const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getSnippets: () => ipcRenderer.invoke('get-snippets'),
    saveSnippet: (snippet) => ipcRenderer.invoke('save-snippet', snippet),
    deleteSnippet: (id) => ipcRenderer.invoke('delete-snippet', id),
    toggleSnippet: (id) => ipcRenderer.invoke('toggle-snippet', id),
    toggleEngine: () => ipcRenderer.invoke('toggle-engine'),
    getEngineStatus: () => ipcRenderer.invoke('get-engine-status'),
    setViewVisibility: (visible) => ipcRenderer.send('set-view-visibility', visible),
    setViewUrl: (sectionId) => ipcRenderer.send('set-view-url', sectionId),
    openYoutube: (url) => ipcRenderer.send('open-youtube', url),
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    onMaximized: (callback) => ipcRenderer.on('win:maximized', (event, isMaximized) => callback(isMaximized)),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),

    // Clipboard History Methods
    getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
    clearClipboardHistory: () => ipcRenderer.invoke('clear-clipboard-history'),
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
    onClipboardChanged: (callback) => ipcRenderer.on('clipboard:changed', (event, history) => callback(history)),

    // Auth Methods
    signIn: (credentials) => ipcRenderer.invoke('auth:signIn', credentials),
    signInWithGoogle: () => ipcRenderer.invoke('auth:signInWithGoogle'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    syncSession: (tokens) => ipcRenderer.invoke('sync-session', tokens),
    onAuthChange: (callback) => ipcRenderer.on('auth:changed', (event, session) => callback(session)),

    // Folder Hub APIs
    getFolders: () => ipcRenderer.invoke('get-folders'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    deleteFolder: (id) => ipcRenderer.invoke('delete-folder', id),
    saveFolder: (folder) => ipcRenderer.invoke('save-folder', folder),
    openExternal: (path) => ipcRenderer.send('open-external', path),
    playVideo: (path, name) => ipcRenderer.invoke('play-video', { path, name }),
    readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
    getDesktopPath: () => ipcRenderer.invoke('get-desktop-path'),
    deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
    updateViewBounds: (headerExpanded) => ipcRenderer.send('update-view-bounds', headerExpanded),
    setDownloadPath: (path) => ipcRenderer.send('set-download-path', path),
    onDownloadStart: (callback) => ipcRenderer.on('download:start', (event, data) => callback(data)),
    onDownloadEnd: (callback) => ipcRenderer.on('download:end', () => callback()),
    onDownloadSuccess: (callback) => ipcRenderer.on('download:success', (event, data) => callback(data)),
    onDownloadError: (callback) => ipcRenderer.on('download:error', (event, data) => callback(data)),
    onDownloadComplete: (callback) => ipcRenderer.on('download:complete', (event, filePath) => callback(filePath)),
    extractFrames: (options) => ipcRenderer.invoke('extract-frames', options),
    getFilePath: (file) => webUtils.getPathForFile(file),
    getFilePath: (file) => webUtils.getPathForFile(file),
    onExtractProgress: (callback) => ipcRenderer.on('extract-frames:progress', (event, progress) => callback(progress)),
    startDrag: (path) => ipcRenderer.send('ondragstart', path),

    // BG Remover
    removeBackground: (filePath) => ipcRenderer.invoke('remove-bg', filePath),
    removeBgMasked: (options) => ipcRenderer.invoke('remove-bg-masked', options),
    saveBase64Image: (base64, savePath) => ipcRenderer.invoke('save-base64-image', { base64, savePath }),
    // Silence Remover
    processSilenceRemoval: (options) => ipcRenderer.invoke('process-silence-removal', options),
    saveProcessedFile: (options) => ipcRenderer.invoke('save-processed-file', options),

    // GEMINI API
    gemini: {
        translate: (options) => ipcRenderer.invoke('gemini-translate', options),
        chat: (options) => ipcRenderer.invoke('gemini-chat', options),
        onStreamChunk: (callback) => ipcRenderer.on('gemini-stream-chunk', (event, data) => callback(data)),
        saveImage: (data) => ipcRenderer.invoke('gemini-save-image', data)
    },

    // Script Extractor
    extractScript: (options) => ipcRenderer.invoke('extract-script', options),
    saveTextFile: (content, defaultName) => ipcRenderer.invoke('save-text-file', { content, defaultName }),
    scrapeMetadata: (url) => ipcRenderer.invoke('scrape-metadata-browser', url),

    // Q Audio
    selectFile: () => ipcRenderer.invoke('select-file'),
    qAudio: {
        separate: (audioPath, description) => ipcRenderer.invoke('q-audio-separate', { audioPath, description }),
        download: (url, filename) => ipcRenderer.invoke('q-audio-download', { url, filename })
    }
});
