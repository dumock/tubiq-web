const { app, BrowserWindow, BrowserView, ipcMain, globalShortcut, shell, clipboard, dialog, protocol, net } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load environment variables

// --- Single Instance Lock & Protocol Handling ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
        // commandLine is an array of strings that contains the arguments used to start the second instance
        // The last argument is usually the URL when triggered via protocol
        const urlStr = commandLine.pop();
        if (urlStr && urlStr.startsWith('tubiq://')) {
            handleProtocolUrl(urlStr);
        }
    });
}

function handleProtocolUrl(urlStr) {
    if (!urlStr) return;
    console.log('[Protocol] Received URL:', urlStr);
    try {
        // Simple manual parsing to avoid url.parse deprecation issues
        const urlObj = new URL(urlStr);
        if (urlObj.protocol === 'tubiq:') {
            if (urlObj.hostname === 'download') {
                const videoId = urlObj.searchParams.get('videoId');
                const title = urlObj.searchParams.get('title');
                if (videoId) {
                    console.log('[Protocol] Triggering download:', videoId, title);
                    handleVideoDownload(videoId, title).then(result => {
                        if (win) {
                            if (result.success) {
                                win.webContents.send('download:success', { path: result.path, title: title || videoId });
                                win.webContents.send('download:complete', result.path);
                            } else {
                                win.webContents.send('download:error', { error: result.error });
                            }
                        }
                    });

                    if (win) {
                        win.webContents.send('download:start', { title: title || videoId });
                        win.show(); // Bring app to front
                    }
                }
            }
        }
    } catch (e) {
        console.error('Failed to parse protocol URL:', urlStr, e);
    }
}

// Simple sync store with memory cache to avoid excessive disk I/O
let storePath = null;
let storeCache = null;

function getStorePath() {
    if (!storePath) {
        storePath = path.join(app.getPath('userData'), 'config.json');
    }
    return storePath;
}

function loadStore() {
    try {
        if (!storeCache) {
            const p = getStorePath();
            if (fs.existsSync(p)) {
                storeCache = JSON.parse(fs.readFileSync(p, 'utf8'));
            } else {
                storeCache = {};
            }
        }
    } catch (e) {
        console.error('Failed to load store:', e);
        storeCache = {};
    }
}

const store = {
    get: (key) => {
        if (!storeCache) loadStore();
        return storeCache[key];
    },
    set: (key, value) => {
        if (!storeCache) loadStore();
        storeCache[key] = value;
        try {
            // Write to disk synchronously to ensure data safety, but only on write
            fs.writeFileSync(getStorePath(), JSON.stringify(storeCache), 'utf8');
        } catch (e) { console.error('Store set error:', e); }
    },
    delete: (key) => {
        if (!storeCache) loadStore();
        delete storeCache[key];
        try {
            fs.writeFileSync(getStorePath(), JSON.stringify(storeCache), 'utf8');
        } catch { }
    }
};

// --- Parse Supabase Keys from Web Env ---
function getEnvKeys() {
    try {
        const envPath = path.join(__dirname, '../web/.env.local');
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        const keys = {};
        lines.forEach(line => {
            const [k, v] = line.split('=');
            if (k && v) keys[k.trim()] = v.trim();
        });
        return {
            url: keys['NEXT_PUBLIC_SUPABASE_URL'],
            anon: keys['NEXT_PUBLIC_SUPABASE_ANON_KEY']
        };
    } catch (e) {
        console.error('Failed to read .env.local:', e);
        return { url: '', anon: '' };
    }
}

const { url: SUPABASE_URL, anon: SUPABASE_ANON_KEY } = getEnvKeys();
console.log('Supabase Init with URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: {
            getItem: (key) => store.get(key),
            setItem: (key, value) => store.set(key, value),
            removeItem: (key) => store.delete(key),
        },
    },
});

// Deep Link Binding for OAuth - must be called after app is ready
function setupProtocolHandler() {
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient('tubiq', process.execPath, [path.resolve(process.argv[1])]);
        }
    } else {
        app.setAsDefaultProtocolClient('tubiq');
    }
}

// Dev Reload - must be called after app is ready
function setupDevReload() {
    if (!app.isPackaged) {
        try {
            require('electron-reload')(__dirname, {
                electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
            });
        } catch (e) {
            console.warn('electron-reload failed to load');
        }
    }
}

// New Modules
const snippetsManager = require('./snippets-manager');
const expansionEngine = require('./expansion-engine');

let win;

// Register custom protocol to serve local files
protocol.registerSchemesAsPrivileged([
    { scheme: 'tubiq-resource', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, stream: true, standard: true, corsEnabled: true } }
]);

// IPC Handlers
ipcMain.handle('get-snippets', () => snippetsManager.getAll());

ipcMain.handle('save-snippet', (event, snippet) => {
    try {
        if (snippet.id) {
            return { success: true, snippet: snippetsManager.update(snippet.id, snippet) };
        } else {
            return { success: true, snippet: snippetsManager.add(snippet) };
        }
    } catch (e) { return { success: false, error: e.message }; }
});

// Bridge for renderer logs to appear in main process terminal
ipcMain.on('log-to-main', (event, ...args) => {
    console.log('[Renderer]', ...args);
});

// Native Drag Support
ipcMain.on('ondragstart', (event, filePath) => {
    event.sender.startDrag({
        file: filePath,
        icon: path.join(__dirname, 'assets/icon_file.png') // Fallback/Default icon
        // Note: Ideally generating an icon on the fly or having specific icons
    });
});

// Clipboard History Logic
let clipboardHistory = [];

// Sync session from renderer (allows main process to access DB with user context)
ipcMain.handle('sync-session', async (event, { access_token, refresh_token }) => {
    try {
        if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({
                access_token,
                refresh_token
            });
            if (error) {
                console.log('[DEBUG] sync-session: setSession failed:', error.message);
                return { success: false, error: error.message };
            }
            console.log('[DEBUG] sync-session: Session set successfully. User:', data.session?.user?.email);
            return { success: true };
        }
        return { success: false, error: 'Missing tokens' };
    } catch (e) {
        console.error('[DEBUG] sync-session error:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('save-text-file', async (event, { content, defaultName }) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
            title: 'Save Text File',
            defaultPath: defaultName || 'script.txt',
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (canceled || !filePath) return { success: false };

        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// ytpl and ytsr removed (unused)

// Helper to convert stream to buffer
async function streamToBuffer(webStream) {
    const reader = webStream.getReader();
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    return Buffer.concat(chunks);
}

// Helper to process a single video
async function processVideoForScript(url, filePath, apiKey) {
    let audioPath = '';
    let cleanupNeeded = false;
    let title = 'Unknown Video';

    try {
        if (url) {
            // YouTube: Use yt-dlp to download audio directly
            // "Could not extract functions" from ytdl-core forces us to use yt-dlp
            if (!url.includes('youtube.com') && !url.includes('youtu.be')) return { success: false, error: 'Invalid URL' };

            // Get Info for title (optional, can skip or use yt-dlp --print)
            // For speed, let's trust yt-dlp or passed title. 
            // We can fetch title via yt-dlp --get-title if needed, but let's just proceed to download.

            audioPath = path.join(app.getPath('temp'), `yt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);

            await new Promise((resolve, reject) => {
                console.log(`[DEBUG] Downloading audio via yt-dlp: ${url}`);
                const args = [
                    '-x',
                    '--audio-format', 'mp3',
                    '--force-overwrites',
                    '-o', audioPath,
                    url
                ];

                const proc = spawn('yt-dlp', args);

                proc.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`yt-dlp exited with code ${code}`));
                });

                proc.on('error', (err) => reject(new Error('yt-dlp spawn failed: ' + err.message)));
            });
            cleanupNeeded = true;
        } else if (filePath) {
            // Local File
            title = path.basename(filePath);
            audioPath = path.join(app.getPath('temp'), `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);

            await new Promise((resolve, reject) => {
                const ffmpeg = spawn(ffmpegProcess || 'ffmpeg', [
                    '-i', filePath,
                    '-vn',
                    '-acodec', 'libmp3lame',
                    '-q:a', '4',
                    '-y',
                    audioPath
                ], { shell: true });

                ffmpeg.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error('ffmpeg failed'));
                });

                ffmpeg.on('error', reject);
            });
            cleanupNeeded = true;
        }

        // Step 1: Whisper API for accurate transcription
        const openaiKey = await getOpenAIApiKey();
        if (!openaiKey) {
            throw new Error('Missing OpenAI API Key for Whisper transcription');
        }

        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(audioPath), { filename: 'audio.mp3', contentType: 'audio/mpeg' });
        formData.append('model', 'whisper-1');
        formData.append('language', 'ko');

        console.log('[DEBUG] Calling Whisper API...');
        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (cleanupNeeded && fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }

        if (!whisperRes.ok) {
            const err = await whisperRes.text();
            throw new Error('Whisper API Error: ' + err);
        }

        const whisperData = await whisperRes.json();
        let text = whisperData?.text || 'No text extracted.';
        console.log('[DEBUG] Whisper transcription complete.');

        // Step 2: Gemini for post-processing cleanup
        if (text && text !== 'No text extracted.') {
            try {
                const cleanupPrompt = `다음은 음성인식으로 추출한 대본입니다. 오타, 잘못 인식된 단어, 문맥상 이상한 부분을 자연스럽게 교정해 주세요. 원본의 의미와 말투는 최대한 유지하면서 읽기 쉽게 다듬어 주세요. 교정된 대본만 출력하세요:\n\n${text}`;

                const cleanupRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: cleanupPrompt }] }]
                        }),
                    }
                );

                if (cleanupRes.ok) {
                    const cleanupData = await cleanupRes.json();
                    const cleanedText = cleanupData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (cleanedText) {
                        text = cleanedText;
                    }
                }
            } catch (cleanupErr) {
                console.log('[DEBUG] Cleanup step failed, using original:', cleanupErr.message);
            }
        }

        return { success: true, title, text };

    } catch (e) {
        if (cleanupNeeded && fs.existsSync(audioPath)) {
            try { fs.unlinkSync(audioPath); } catch { }
        }
        return { success: false, title, error: e.message };
    }
}

// Helper to get Gemini API Key from Supabase or Env
async function getGeminiApiKey() {
    console.log('[DEBUG] Fetching Gemini API Key...');
    try {
        let { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            console.log('[DEBUG] No active Supabase session found. Attempting refresh...');
            // Try explicit refresh which sometimes helps in Electron if persisted but not auto-loaded
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) {
                console.log('[DEBUG] Session refresh failed:', refreshError?.message);
                return process.env.GEMINI_API_KEY;
            }
            session = refreshData.session;
            console.log('[DEBUG] Session refreshed successfully.');
        }

        // Fetch api_config
        const { data, error } = await supabase
            .from('user_settings')
            .select('setting_value')
            .eq('user_id', session.user.id)
            .eq('setting_key', 'api_config')
            .single();

        if (error || !data) {
            console.log('[DEBUG] No api_config found, falling back to Env.', error?.message);
            return process.env.GEMINI_API_KEY;
        }

        const config = data.setting_value;
        // Expected structure: { gemini: { keys: ["AIza...", ...] } }
        const keys = config?.gemini?.keys;

        if (Array.isArray(keys) && keys.length > 0) {
            let rawKey = keys[0];
            let key = '';

            if (typeof rawKey === 'object' && rawKey !== null) {
                console.log('[DEBUG] Key is an object, attempting to extract string:', JSON.stringify(rawKey));
                // Try common property names or just use values[0]
                key = rawKey.key || rawKey.apiKey || rawKey.value || Object.values(rawKey)[0] || '';
            } else {
                key = String(rawKey);
            }

            key = key.trim();

            if (key.length < 10) {
                console.log('[DEBUG] Key from Supabase seems invalid (too short). Fallback to Env. Raw:', rawKey);
            } else {
                console.log(`[DEBUG] Found Gemini Key in Supabase. Prefix: ${key.substring(0, 5)}..., Length: ${key.length}`);
                return key;
            }
        }

        console.log('[DEBUG] api_config found but no valid keys in gemini.keys');
        return process.env.GEMINI_API_KEY;
    } catch (e) {
        console.error('[DEBUG] Failed to fetch API key:', e);
        return process.env.GEMINI_API_KEY;
    }
}

// Helper to get OpenAI API Key from Supabase or Env
async function getOpenAIApiKey() {
    console.log('[DEBUG] Fetching OpenAI API Key...');
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            console.log('[DEBUG] No active Supabase session found.');
            return process.env.OPENAI_API_KEY;
        }

        const { data, error } = await supabase
            .from('user_settings')
            .select('setting_value')
            .eq('user_id', session.user.id)
            .eq('setting_key', 'api_config')
            .single();

        if (error || !data) {
            console.log('[DEBUG] No api_config found for OpenAI, falling back to Env.');
            return process.env.OPENAI_API_KEY;
        }

        const config = data.setting_value;
        const keys = config?.openai?.keys;

        if (Array.isArray(keys) && keys.length > 0) {
            let rawKey = keys[0];
            let key = typeof rawKey === 'object' ? (rawKey.key || rawKey.apiKey || Object.values(rawKey)[0] || '') : String(rawKey);
            key = key.trim();

            if (key.length >= 10) {
                console.log(`[DEBUG] Found OpenAI Key in Supabase. Prefix: ${key.substring(0, 7)}...`);
                return key;
            }
        }

        return process.env.OPENAI_API_KEY;
    } catch (e) {
        console.error('[DEBUG] Failed to fetch OpenAI API key:', e);
        return process.env.OPENAI_API_KEY;
    }
}

// Helper to fetch video list using yt-dlp (Robust Channel/Playlist Support)
async function fetchVideosFromYoutube(url) {
    return new Promise((resolve, reject) => {
        console.log('[DEBUG] Spawning yt-dlp for metadata:', url);
        // --flat-playlist: Don't resolve video URLs yet, just get metadata
        // -J: Dump JSON
        const args = ['--flat-playlist', '-J', url];

        const proc = spawn('yt-dlp', args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error('[DEBUG] yt-dlp failed:', stderr);
                return reject(new Error(stderr || 'yt-dlp execution failed'));
            }

            try {
                const data = JSON.parse(stdout);
                let items = [];

                if (data.entries) {
                    // Playlist or Channel
                    items = data.entries.map(item => ({
                        type: 'youtube',
                        title: item.title,
                        url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
                        id: item.id,
                        duration: item.duration, // seconds
                        views: item.view_count,
                        date: item.upload_date // YYYYMMDD string usually
                    }));
                } else {
                    // Single Video
                    items = [{
                        type: 'youtube',
                        title: data.title,
                        url: data.webpage_url || data.url || url,
                        id: data.id,
                        duration: data.duration,
                        views: data.view_count,
                        date: data.upload_date
                    }];
                }
                resolve(items);
            } catch (e) {
                console.error('[DEBUG] JSON parse failed:', e);
                reject(new Error('Failed to parse yt-dlp output'));
            }
        });

        proc.on('error', (err) => {
            console.error('[DEBUG] yt-dlp spawn error:', err);
            reject(err);
        });
    });
}

ipcMain.handle('extract-script', async (event, { filePath, youtubeUrl, options = {} }) => {
    try {
        const apiKey = await getGeminiApiKey();
        if (!apiKey) return { success: false, error: 'Missing GEMINI_API_KEY (Env or Supabase)' };

        const { filter = 'all', sort = 'latest', count = 5 } = options;
        let targets = [];

        if (filePath) {
            // Single Local File
            targets.push({ type: 'file', path: filePath });
        } else if (youtubeUrl) {
            // Use yt-dlp for all YouTube URLs (Channel, Playlist, Single)
            try {
                console.log('[DEBUG] Fetching metadata via yt-dlp...');
                const videoItems = await fetchVideosFromYoutube(youtubeUrl);
                console.log(`[DEBUG] yt-dlp found ${videoItems.length} videos`);
                targets = videoItems;
            } catch (e) {
                console.error('[DEBUG] yt-dlp processing failed:', e);
                return { success: false, error: 'Youtube Processing Error (yt-dlp): ' + e.message };
            }
        }

        // Filter and Sort (Only applies if targets found)
        if (targets.length > 0) {
            console.log(`[DEBUG] Before Filter: ${targets.length} items. Filter mode: ${filter}`);

            // Filter
            if (filter !== 'all') {
                targets = targets.filter(item => {
                    const duration = typeof item.duration === 'number' ? item.duration : parseFloat(item.duration || 0);
                    const isUrlShorts = item.url && item.url.includes('/shorts/');

                    if (filter === 'shorts') return isUrlShorts || (duration > 0 && duration <= 60);
                    if (filter === 'video') return duration > 60 || (duration === 0 && !isUrlShorts);
                    return true;
                });
            }
            console.log(`[DEBUG] After Filter: ${targets.length} items.`);

            // Sort
            if (sort === 'views') {
                targets.sort((a, b) => (b.views || 0) - (a.views || 0));
            } else if (sort === 'oldest') {
                // Date format from yt-dlp might be YYYYMMDD string
                targets.sort((a, b) => (a.date || '99999999').localeCompare(b.date || '99999999'));
            } else {
                // Latest (default)
            }

            // Limit
            targets = targets.slice(0, Math.min(count, 50));
        }

        if (targets.length === 0) {
            console.log('[DEBUG] No videos found matching criteria. URL:', youtubeUrl);
            return { success: false, error: `조건에 맞는 영상이 없습니다. (필터: ${filter === 'shorts' ? '쇼츠' : filter === 'video' ? '일반 영상' : '전체'}). 채널의 '동영상' 탭 주소를 입력해 보세요.` };
        }

        // Process Loop
        let finalOutput = '';
        let successCount = 0;

        for (let i = 0; i < targets.length; i++) {
            const item = targets[i];

            // Add delay for subsequent requests to avoid 429 (Rate Limit)
            if (i > 0) {
                console.log('[DEBUG] Waiting 5s to avoid Rate Limit...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            const res = await processVideoForScript(item.url, item.path, apiKey);

            if (res.success) {
                successCount++;
                finalOutput += `\n=== [${res.title}] ===\n\n`;
                finalOutput += res.text + '\n\n';
            } else {
                finalOutput += `\n=== [Failed Item] ===\nError: ${res.error}\n\n`;
            }
        }

        return { success: true, text: finalOutput.trim() };

    } catch (e) {
        return { success: false, error: e.message };
    }
});
function startClipboardMonitor() {
    clipboardHistory = store.get('clipboard-history') || [];
    let lastText = clipboard.readText();
    setInterval(() => {
        const currentText = clipboard.readText();
        if (currentText && currentText !== lastText) {
            lastText = currentText;

            // Add to history (remove if already exists to move to top)
            clipboardHistory = clipboardHistory.filter(item => item.text !== currentText);
            clipboardHistory.unshift({
                id: Date.now(),
                text: currentText,
                timestamp: new Date().toISOString()
            });

            // Limit to 100 items
            if (clipboardHistory.length > 100) {
                clipboardHistory = clipboardHistory.slice(0, 100);
            }

            store.set('clipboard-history', clipboardHistory);
            if (win) {
                win.webContents.send('clipboard:changed', clipboardHistory);
            }
        }
    }, 1000);
}

ipcMain.handle('play-video', (event, { path: videoPath, name }) => {
    let playerWin = new BrowserWindow({
        width: 1000,
        height: 700,
        frame: false,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const playerUrl = `file://${path.join(__dirname, 'video-player.html')}?src=${encodeURIComponent(videoPath)}&name=${encodeURIComponent(name)}`;
    playerWin.loadURL(playerUrl);
    playerWin.center();

    playerWin.on('closed', () => {
        playerWin = null;
    });
});

ipcMain.handle('get-clipboard-history', () => clipboardHistory);
ipcMain.handle('clear-clipboard-history', () => {
    clipboardHistory = [];
    store.set('clipboard-history', clipboardHistory);
    return true;
});
ipcMain.on('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text);
});

// Open file with system default application
ipcMain.on('open-external', (event, filePath) => {
    shell.openPath(filePath);
});

ipcMain.handle('delete-snippet', (event, id) => {
    snippetsManager.delete(id);
    return { success: true };
});

// Folder Hub Logic
let folderHub = store.get('folder-hub') || [];

ipcMain.handle('get-folders', () => folderHub);

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        const folderName = path.basename(folderPath);

        const existingFolder = folderHub.find(f => f.path === folderPath);
        if (existingFolder) {
            return { success: true, folder: existingFolder };
        }

        const newFolder = {
            id: Date.now().toString(),
            name: folderName,
            path: folderPath,
            timestamp: new Date().toISOString()
        };
        folderHub.push(newFolder);
        store.set('folder-hub', folderHub);
        return { success: true, folder: newFolder };
    }
    return { success: false };
});

ipcMain.handle('delete-folder', (event, id) => {
    folderHub = folderHub.filter(f => f.id !== id);
    store.set('folder-hub', folderHub);
    return { success: true };
});

ipcMain.handle('read-directory', async (event, dirPath) => {
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const contents = await Promise.all(entries.map(async entry => {
            const itemPath = path.join(dirPath, entry.name);
            const isDirectory = entry.isDirectory();

            // Get file stats for sorting
            let mtime = 0;
            try {
                const stats = await fs.promises.stat(itemPath);
                mtime = stats.mtimeMs;
            } catch (e) { }

            const ext = path.extname(entry.name).toLowerCase();
            let type = 'other';
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) type = 'image';
            else if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(ext)) type = 'video';

            // Get thumbnail
            let thumbnail = '';

            if (type === 'video') {
                // Extract video frame using ffmpeg
                try {
                    const tempDir = app.getPath('temp');
                    const thumbPath = path.join(tempDir, `vt_${Date.now()}.jpg`);

                    await new Promise((resolve, reject) => {
                        const ff = spawn('ffmpeg', [
                            '-ss', '1', '-i', itemPath,
                            '-vframes', '1', '-vf', 'scale=48:-1', '-q:v', '10',
                            '-y', thumbPath
                        ], { windowsHide: true });
                        ff.on('close', code => code === 0 ? resolve() : reject());
                        ff.on('error', reject);
                        setTimeout(() => { ff.kill(); reject(); }, 1000);
                    });

                    const data = await fs.promises.readFile(thumbPath);
                    thumbnail = `data:image/jpeg;base64,${data.toString('base64')}`;
                    fs.promises.unlink(thumbPath).catch(() => { });
                } catch (e) {
                    try {
                        const icon = await app.getFileIcon(itemPath, { size: 'large' });
                        thumbnail = icon.toDataURL();
                    } catch (e2) { }
                }
            } else {
                // System icon for other files
                try {
                    const icon = await app.getFileIcon(itemPath, { size: 'large' });
                    thumbnail = icon.toDataURL();
                } catch (e) { }
            }

            return {
                name: entry.name,
                isDirectory,
                path: itemPath,
                thumbnail,
                type,
                mtime,
                resourcePath: `tubiq-resource://${encodeURIComponent(itemPath)}`
            };
        }));

        // Sort by modification time (newest first)
        contents.sort((a, b) => b.mtime - a.mtime);

        return { success: true, contents };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Delete file from filesystem
ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        await fs.promises.unlink(filePath);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Get desktop path
ipcMain.handle('get-desktop-path', () => {
    return app.getPath('desktop');
});

// Get temp path
ipcMain.handle('get-temp-path', () => {
    return require('os').tmpdir();
});

// Ensure directory exists
ipcMain.handle('ensure-dir', async (event, dirPath) => {
    try {
        await fs.promises.mkdir(dirPath, { recursive: true });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Frame Extractor - extract frames from video using ffmpeg
ipcMain.handle('extract-frames', async (event, options) => {
    const { filePath, youtubeUrl, frameCount, outputPath } = options;

    try {
        let videoPath = filePath;

        // If YouTube URL, download first
        if (youtubeUrl && !filePath) {
            const tempDir = require('os').tmpdir();
            const tempVideoPath = path.join(tempDir, `tubiq_temp_${Date.now()}.mp4`);

            // Download YouTube video using yt-dlp
            const downloadResult = await new Promise((resolve, reject) => {
                const proc = spawn('yt-dlp', [
                    '-f', 'best[ext=mp4]/best',
                    '-o', tempVideoPath,
                    youtubeUrl
                ]);

                proc.on('close', (code) => {
                    if (code === 0) resolve({ success: true, path: tempVideoPath });
                    else reject(new Error('YouTube 다운로드 실패'));
                });

                proc.on('error', (err) => reject(err));
            });

            videoPath = downloadResult.path;
        }

        if (!videoPath) {
            return { success: false, error: '영상 파일이 없습니다.' };
        }

        // Get video duration using ffprobe
        const duration = await new Promise((resolve, reject) => {
            const proc = spawn('ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                videoPath
            ]);

            let output = '';
            proc.stdout.on('data', (data) => { output += data.toString(); });
            proc.on('close', () => resolve(parseFloat(output) || 60));
            proc.on('error', () => resolve(60)); // Default 60 seconds
        });

        // Calculate interval automatically based on duration and requested frame count
        const interval = duration / Math.max(1, frameCount);

        // Calculate frame times
        const frameTimes = [];
        for (let i = 0; i < frameCount; i++) {
            frameTimes.push(i * interval);
        }

        // Extract frames using ffmpeg
        let extractedCount = 0;
        const totalFrames = frameTimes.length;

        for (const time of frameTimes) {
            const outputFile = path.join(outputPath, `frame_${String(extractedCount + 1).padStart(3, '0')}.jpg`);

            await new Promise((resolve, reject) => {
                const proc = spawn('ffmpeg', [
                    '-ss', String(time),
                    '-i', videoPath,
                    '-vframes', '1',
                    '-q:v', '2',
                    '-y',
                    outputFile
                ]);

                proc.on('close', (code) => {
                    if (code === 0) {
                        extractedCount++;
                        // Send progress to renderer
                        const progress = Math.round((extractedCount / totalFrames) * 100);
                        event.sender.send('extract-frames:progress', progress);
                        resolve();
                    } else {
                        resolve(); // Continue even if one frame fails
                    }
                });

                proc.on('error', () => resolve());
            });
        }

        // Clean up temp video if from YouTube
        if (youtubeUrl && !filePath && videoPath.includes('tubiq_temp_')) {
            try { fs.promises.unlink(videoPath); } catch { }
        }

        return { success: true, extractedCount };
    } catch (e) {
        console.error('Frame extraction failed:', e);
        let errorMessage = e.message;
        if (e.message.includes('ENOENT')) {
            errorMessage = 'ffmpeg 또는 ffprobe를 찾을 수 없습니다. 설치 여부를 확인해주세요.';
        }
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('remove-bg', async (event, filePath) => {
    try {
        // Lazy load heavy library
        const { removeBackground } = require('@imgly/background-removal-node');

        const config = {
            output: {
                format: 'image/png'
            }
        };

        // Use file:// URL to help the library identify the format correctly
        const fileUrl = url.pathToFileURL(filePath).href;
        const resultBlob = await removeBackground(fileUrl, config);
        const arrayBuffer = await resultBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

        return { success: true, image: base64 };
    } catch (e) {
        console.error('Background removal failed:', e);
        return { success: false, error: e.message };
    }
});

// Handle masked background removal - uses mask to make specific areas transparent
ipcMain.handle('remove-bg-masked', async (event, { image, mask }) => {
    try {
        const { Jimp } = require('jimp');

        const imageBase64 = image.replace(/^data:image\/\w+;base64,/, '');
        const maskBase64 = mask.replace(/^data:image\/\w+;base64,/, '');

        const imgBuffer = Buffer.from(imageBase64, 'base64');
        const maskBuffer = Buffer.from(maskBase64, 'base64');

        const mainImg = await Jimp.read(imgBuffer);
        const maskImg = await Jimp.read(maskBuffer);

        if (maskImg.getWidth() !== mainImg.getWidth() || maskImg.getHeight() !== mainImg.getHeight()) {
            maskImg.resize(mainImg.getWidth(), mainImg.getHeight());
        }

        mainImg.scan(0, 0, mainImg.getWidth(), mainImg.getHeight(), function (x, y, idx) {
            const maskPixel = Jimp.intToRGBA(maskImg.getPixelColor(x, y));
            if (maskPixel.r > 128 || maskPixel.g > 128 || maskPixel.b > 128) {
                this.bitmap.data[idx + 3] = 0;
            }
        });

        const resultBuffer = await mainImg.getBufferAsync(Jimp.MIME_PNG);
        const base64Result = `data:image/png;base64,${resultBuffer.toString('base64')}`;

        return { success: true, image: base64Result };
    } catch (e) {
        console.error('Masked removal failed:', e);
        return { success: false, error: e.message };
    }
});

// Gemini Chat Handler (with Streaming support)
// Helper to generate image using OpenAI DALL-E 3
async function generateImage(prompt) {
    try {
        const apiKey = await getOpenAIApiKey();
        if (!apiKey) throw new Error('OpenAI API Key not found');

        console.log('[DEBUG] Generating image with prompt:', prompt);
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json"
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error('OpenAI Image API Error: ' + err);
        }

        const data = await response.json();
        return { success: true, base64: data.data[0].b64_json };
    } catch (e) {
        console.error('Image Generation Error:', e);
        return { success: false, error: e.message };
    }
}

// Helper to generate image using Gemini (Native Google Image Gen)
// Helper to generate image using Gemini (Native Google Image Gen)
async function generateImageWithGemini(prompt, targetModelInput = 'gemini-2.0-flash-exp') {
    // Map input model to the correct IMAGE generation model based on user documentation
    // Nano Banana Pro: gemini-3-pro-image-preview
    // Nano Banana: gemini-2.5-flash-image
    let targetModel = targetModelInput;

    if (targetModelInput.includes('gemini-3') || targetModelInput.includes('pro')) {
        targetModel = 'gemini-3-pro-image-preview';
    } else {
        targetModel = 'gemini-2.5-flash-image';
    }

    const fallbackModel = 'gemini-2.5-flash-image';

    // Internal helper to try a specific model
    const tryGen = async (modelName) => {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const apiKey = await getGeminiApiKey();
            if (!apiKey) throw new Error('Gemini API Key not found');

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"],
                    temperature: 1.0
                }
            });

            console.log(`[DEBUG] Attempting Native Image Gen with ${modelName}:`, prompt);
            const result = await model.generateContent("Draw this: " + prompt);
            const response = await result.response;

            if (response.candidates && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                        return { success: true, base64: part.inlineData.data, mimeType: part.inlineData.mimeType, model: modelName };
                    }
                }
            }
            throw new Error(`No image data returned from ${modelName}`);
        } catch (e) {
            return { success: false, error: e.message };
        }
    };

    // 1. Try requested model
    let result = await tryGen(targetModel);

    // 2. If failed and target wasn't the fallback, try fallback
    if (!result.success && targetModel !== fallbackModel) {
        console.warn(`[WARN] Image gen failed with ${targetModel}, falling back to ${fallbackModel}. Error:`, result.error);
        result = await tryGen(fallbackModel);
    }

    return result;
}

// Gemini Chat Handler (with Streaming support)
ipcMain.handle('gemini-chat', async (event, { model, systemInstruction, temperature, safetySettings, history, message, attachments = [], stream = false }) => {
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const apiKey = await getGeminiApiKey();

        if (!apiKey) {
            console.log('[DEBUG] getGeminiApiKey returned null/undefined in gemini-chat');
            return { success: false, error: 'Gemini API Key missing in DB/Env. (Session active?)' };
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Use user selected model, default to 2.0 flash exp
        const targetModel = model || 'gemini-2.0-flash-exp';
        // Check if model likely supports native image generation
        // Gemini 2.0 Flash Exp and Gemini 3 Pro Preview (Nano Banana Pro) support it
        const supportsNativeImage = targetModel.includes('flash') || targetModel.includes('gemini-3');

        let finalSystemInstruction = systemInstruction;

        // Forcefully remind the model of its capabilities if it supports images
        if (supportsNativeImage) {
            const imageGenInstruction = `
You have the ability to generate real images using specialized high-performance models.
- If you are "Gemini 3 Pro" or "Nano Banana Pro", your image engine is "Nano Banana Pro" (gemini-3-pro-image-preview).
- If you are "Gemini 2.5" or "Nano Banana", your image engine is "Nano Banana" (gemini-2.5-flash-image).

When a user asks you to dry or generate an image, YOU MUST generate it using these capabilities.
IMPORTANT: When the system generates an image for you, it will label it as "(Generated image... using Nano Banana Pro)". 
DO NOT DENY THIS. You must ACKNOWLEDGE that "Nano Banana Pro" is your advanced image generation engine. 
Never say "I made that name up" or "That is a hallucination". Valid model names are: Nano Banana, Nano Banana Pro.
Just generate the image.`;
            if (finalSystemInstruction) {
                finalSystemInstruction += `\n\n${imageGenInstruction}`;
            } else {
                finalSystemInstruction = imageGenInstruction;
            }
        }

        const genModel = genAI.getGenerativeModel({
            model: targetModel,
            systemInstruction: finalSystemInstruction ? { parts: [{ text: finalSystemInstruction }] } : undefined,
            safetySettings: safetySettings,
            generationConfig: {
                // If the model is flash exp or gemini-3, we allow both, otherwise just text
                responseModalities: supportsNativeImage ? ["TEXT", "IMAGE"] : undefined,
                temperature: temperature || 1.0
            }
        });

        const formattedHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const chat = genModel.startChat({
            history: formattedHistory
        });

        // Build message parts (text + images)
        const messageParts = [];

        // Add text if present
        if (message) {
            messageParts.push({ text: message });
        }

        // Add image attachments
        if (attachments && attachments.length > 0) {
            for (const att of attachments) {
                const mimeType = att.type || 'image/jpeg';
                // Handle base64 that might include the prefix
                const base64Data = att.base64.includes('base64,') ? att.base64.split('base64,')[1] : att.base64;

                messageParts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                });
            }
        }

        if (stream) {
            // Streaming mode
            const result = await chat.sendMessageStream(messageParts);
            let fullText = '';
            let mightBeToolCall = false;
            let buffer = '';
            let generatedImage = null;

            for await (const chunk of result.stream) {
                // 1. Text
                let chunkText = '';
                try {
                    chunkText = chunk.text();
                } catch (e) { }

                if (chunkText) {
                    fullText += chunkText;

                    // Check if we should start buffering (if it looks like a JSON tool call)
                    // Remove length check to ensure we catch it even if the chunk is large
                    if (fullText.trim().startsWith('{')) {
                        mightBeToolCall = true;
                    }

                    if (mightBeToolCall) {
                        buffer += chunkText;
                    } else {
                        event.sender.send('gemini-stream-chunk', { text: chunkText, done: false });
                    }
                }

                // 2. Native Inline Images (from Gemini 2.0 Flash / Gemini 3 Pro)
                if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
                    const parts = chunk.candidates[0].content.parts;
                    for (const part of parts) {
                        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                            console.log('[DEBUG] Received Native Image from Gemini Stream:', part.inlineData.mimeType);
                            generatedImage = {
                                base64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                                prompt: 'Generative Image'
                            };
                            // If we have an image, we assume any buffered text was just preamble or irrelevant JSON, or we flush it if needed.
                            // Usually native image comes with empty text or description. 
                            if (buffer) {
                                // If buffer is just JSON, we probably want to hide it. If it's description, show it.
                                // For now, let's flush it if it's not the tool call JSON, but simpler to just show it if we got an image natively.
                                event.sender.send('gemini-stream-chunk', { text: buffer, done: false });
                                buffer = '';
                                mightBeToolCall = false;
                            }
                            event.sender.send('gemini-stream-chunk', { text: '', done: false, image: generatedImage });
                        }
                    }
                }
            }

            // 3. Post-stream Tool Call Detection (Hallucination Handling)
            // If the model output JSON looking like a tool call, we intercept it and use Gemini 2.0 Flash to generate the image
            let finalOutputText = fullText;
            let wasIntercepted = false;

            if (!generatedImage) {
                try {
                    const trimmed = fullText.trim();
                    let prompt = '';
                    let isHallucination = false;

                    // 1. JSON Tool Call Check
                    if (trimmed.startsWith('{') && (trimmed.endsWith('}') || trimmed.includes('"action": "dalle.text2im"') || trimmed.includes('"action": "text_to_image"'))) {
                        // Extract JSON string if it's embedded in text
                        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
                        const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;

                        const data = JSON.parse(jsonStr);
                        // Check for common image gen hallucinations (dalle, img_gen, text_to_image, img2img, etc)
                        if (
                            (data.action === 'dalle.text2im') ||
                            (data.action === 'img_gen') ||
                            (data.action === 'text_to_image') ||
                            (data.action === 'img2img') ||
                            (data.tool === 'image_generator') ||
                            (data.action && data.action.includes('image') && data.action.includes('gen')) // Catch-all for *image*gen*
                        ) {
                            if (data.action_input && typeof data.action_input === 'string') {
                                try {
                                    const inputObj = JSON.parse(data.action_input.replace(/'/g, '"')); // Handle python-style dict str
                                    prompt = inputObj.prompt || inputObj.query;

                                    // Handle File Extract (Youtube DL)for text_to_image/img2img
                                    if (!prompt && (data.action === 'text_to_image' || data.action === 'img2img')) prompt = data.action_input;
                                } catch (e) {
                                    prompt = data.action_input;
                                }
                            } else if (data.action_input && typeof data.action_input === 'object') {
                                prompt = data.action_input.prompt || data.action_input.query;
                            }
                            isHallucination = true;
                        }
                    }

                    // 2. Code-Comment / Natural Language Hallucination Check (New Pattern)
                    // e.g. "// image_generation_tool을 호출하여..."
                    // e.g. "// 프롬프트: ..."
                    if (!isHallucination) {
                        const lines = trimmed.split('\n');
                        const toolLine = lines.find(l => l.includes('// image_generation_tool') || l.includes('// image_generator'));
                        const promptLine = lines.find(l => l.includes('// 프롬프트:') || l.includes('// prompt:'));

                        if (toolLine || promptLine) {
                            if (promptLine) {
                                prompt = promptLine.replace('// 프롬프트:', '').replace('// prompt:', '').trim();
                            } else {
                                // Try to infer prompt from context or previous lines if needed, 
                                // but usually the model provides the prompt in the comment if it's following that pattern.
                                // If plain prompt line is missing, maybe look for the line after the tool line?
                                // For now, let's rely on the explicit prompt line the user showed.
                            }
                            if (prompt) isHallucination = true;
                        }
                    }

                    if (isHallucination && prompt) {
                        wasIntercepted = true;
                        console.log('[DEBUG] Intercepted Image Request (Hallucination), redirecting to Gemini:', prompt);
                        event.sender.send('gemini-stream-chunk', { text: '\n\n🎨 나노 바나나(Imagen)가 그림을 그리고 있습니다...', done: false });

                        // Use the same model as the chat (e.g., gemini-3-pro-preview) if possible, or fallback
                        const imgRes = await generateImageWithGemini(prompt, model || 'gemini-2.0-flash-exp');
                        if (imgRes.success) {
                            generatedImage = {
                                base64: `data:${imgRes.mimeType || 'image/png'};base64,${imgRes.base64}`,
                                prompt: prompt
                            };

                            const modelDisplay = imgRes.model.includes('pro') ? 'Nano Banana Pro' : 'Nano Banana';
                            finalOutputText = `(Generated image for: "${prompt}" using ${modelDisplay})`;
                        } else {
                            // If failed, replace the JSON with the error message so the user doesn't see the raw JSON
                            finalOutputText = `(Failed to generate image for: "${prompt}")\n\n[Error: ${imgRes.error}]`;
                        }
                    }
                } catch (e) {
                    // Not valid JSON or parsing error, ignore
                }
            }

            // If we buffered potential tool call text but didn't intercept it (e.g. false alarm or just code), flush it now
            if (!wasIntercepted && buffer && !generatedImage) {
                event.sender.send('gemini-stream-chunk', { text: buffer, done: false });
            }

            // Send the final chunk/message
            // Ensure we send the attachment if we generated one
            const finalPayload = {
                text: finalOutputText,
                done: true,
                attachments: generatedImage ? [{
                    name: `generated_${Date.now()}.png`,
                    base64: generatedImage.base64
                }] : []
            };

            if (generatedImage) {
                console.log(`[DEBUG] Sending generated image. Base64 length: ${generatedImage.base64.length}`);
            }

            event.sender.send('gemini-stream-chunk', finalPayload);
        } else {
            // Non-stream mode (fallback)
            const result = await chat.sendMessage(messageParts);
            const response = await result.response;
            const text = response.text();
            event.sender.send('gemini-stream-chunk', { text, done: true });
            return { success: true, text };
        }
    } catch (e) {
        console.error('Gemini Chat Error:', e);
        event.sender.send('gemini-stream-chunk', { error: e.message, done: true });
        return { success: false, error: e.message };
    }
});

ipcMain.handle('save-base64-image', async (event, { base64, savePath }) => {
    try {
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(savePath, buffer);
        return { success: true };
    } catch (e) {
        console.error('Failed to save image:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('save-processed-file', async (event, { filePath, defaultName }) => {
    try {
        const { canceled, filePath: savePath } = await dialog.showSaveDialog(win, {
            title: 'Save Processed File',
            defaultPath: defaultName || path.basename(filePath),
            filters: [
                { name: 'Audio', extensions: ['mp3', 'wav', 'm4a'] }
            ]
        });

        if (canceled || !savePath) {
            return { success: false, note: 'canceled' };
        }

        fs.copyFileSync(filePath, savePath);
        return { success: true, savedPath: savePath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('process-silence-removal', async (event, options) => {
    const { inputPath, outputPath, threshold, duration } = options;

    return new Promise((resolve) => {
        // ffmpeg -i input.mp3 -af silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-40dB output.mp3
        // ffmpeg -i input.mp3 -af silenceremove=start_periods=1:start_duration=0:start_threshold=-40dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-40dB output.mp3
        // Added start_periods=1 to ensure processing begins correctly
        const filter = `silenceremove=start_periods=1:start_duration=0:start_threshold=${threshold}dB:stop_periods=-1:stop_duration=${duration}:stop_threshold=${threshold}dB`;

        const args = [
            '-i', inputPath,
            '-af', filter,
            '-y', // Overwrite output
            outputPath
        ];

        console.log('Running ffmpeg for silence removal:', args.join(' '));
        const ffmpegProc = spawn('ffmpeg', args, {
            shell: true,
            env: { ...process.env }
        });

        ffmpegProc.stdout.on('data', (data) => console.log(`ffmpeg stdout: ${data}`));
        ffmpegProc.stderr.on('data', (data) => console.log(`ffmpeg stderr: ${data}`));

        ffmpegProc.on('close', (code) => {
            console.log(`ffmpeg process closed with code ${code}`);
            if (code === 0) {
                resolve({ success: true, path: outputPath });
            } else {
                resolve({ success: false, error: `ffmpeg exited with code ${code}` });
            }
        });

        ffmpegProc.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
});

ipcMain.handle('save-folder', (event, folder) => {
    if (folder.id) {
        folderHub = folderHub.map(f => f.id === folder.id ? folder : f);
    } else {
        const newFolder = {
            ...folder,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };
        folderHub.push(newFolder);
    }
    store.set('folder-hub', folderHub);
    return { success: true };
});

ipcMain.handle('toggle-snippet', (event, id) => {
    return { success: true, snippet: snippetsManager.toggle(id) };
});

ipcMain.handle('toggle-engine', () => {
    const isEnabled = expansionEngine.toggle();
    return { success: true, ...expansionEngine.getStatus() };
});

ipcMain.handle('get-engine-status', () => {
    return expansionEngine.getStatus();
});

// Save generated image from Gemini
ipcMain.handle('gemini-save-image', async (event, { base64, filename }) => {
    try {
        const { filePath } = await dialog.showSaveDialog(win, {
            defaultPath: filename || 'generated-image.png',
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
        });

        if (filePath) {
            const data = base64.replace(/^data:image\/\w+;base64,/, "");
            const buf = Buffer.from(data, 'base64');
            require('fs').writeFileSync(filePath, buf);
            return { success: true };
        }
        return { success: false, cancelled: true };
    } catch (error) {
        console.error('Error saving image:', error);
        return { success: false, error: error.message };
    }
});

// Auth IPC Handlers
ipcMain.handle('auth:signIn', async (event, { email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) win.webContents.send('auth:changed', data.session);
    return { data, error };
});

ipcMain.handle('auth:signInWithGoogle', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: 'tubiq://auth-callback'
        }
    });
    if (data?.url) shell.openExternal(data.url);
    return { error };
});

ipcMain.handle('auth:signOut', async () => {
    const { error } = await supabase.auth.signOut();
    win.webContents.send('auth:changed', null);
    return { error };
});

ipcMain.handle('auth:getSession', async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
});

ipcMain.on('open-external', (event, path) => {
    shell.openExternal('file://' + path);
});

// Window Control Handlers
ipcMain.on('win:minimize', () => {
    if (win) win.minimize();
});

ipcMain.on('win:maximize', () => {
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

ipcMain.on('win:close', () => {
    if (win) win.close();
});

// Protocol Handling (OAuth Callback)
app.on('second-instance', (event, commandLine) => {
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
    const url = commandLine.pop();
    if (url.includes('tubiq://auth-callback')) {
        handleAuthCallback(url);
    }
});

async function handleAuthCallback(urlStr) {
    const url = new URL(urlStr);
    const hash = url.hash.substring(1); // remove #
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        if (!error) {
            win.webContents.send('auth:changed', data.session);
        }
    }
}

let view;
function initBrowserView() {
    if (view) return;
    view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:tubiq' // Persist login and settings
        }
    });

    view.webContents.loadURL('http://localhost:3000/video-assets');

    // Listen for navigation to inject YouTube overlay (Only on watch pages)
    view.webContents.on('did-navigate', (event, url) => {
        if (url.includes('youtube.com/watch')) {
            injectYoutubeOverlay();
        }
    });

    view.webContents.on('did-navigate-in-page', (event, url) => {
        if (url.includes('youtube.com/watch')) {
            injectYoutubeOverlay();
        }
    });

    // Sync Session to BrowserView (Improved for reliability)
    view.webContents.on('did-finish-load', async () => {
        const url = view.webContents.getURL();
        if (url.includes('localhost:3000')) {
            syncSessionToView();
        } else if (url.includes('youtube.com/watch')) {
            injectYoutubeOverlay();
        }
    });
}

async function injectYoutubeOverlay() {
    if (!view) return;
    try {
        const cssPath = path.join(__dirname, 'inject/youtube-overlay.css');
        const jsPath = path.join(__dirname, 'inject/youtube-overlay.js');

        if (fs.existsSync(cssPath)) {
            const css = fs.readFileSync(cssPath, 'utf8');
            view.webContents.insertCSS(css);
        }

        if (fs.existsSync(jsPath)) {
            const js = fs.readFileSync(jsPath, 'utf8');
            view.webContents.executeJavaScript(js);
        }
    } catch (e) {
        console.error('[TubiQ] Failed to inject YouTube overlay:', e);
    }
}

async function syncSessionToView() {
    if (!view) return;
    const url = view.webContents.getURL();
    if (!url.includes('localhost:3000')) return;

    const { data } = await supabase.auth.getSession();
    if (data?.session) {
        const sessionStr = JSON.stringify(data.session);
        const projectId = SUPABASE_URL.split('.')[0].split('//')[1];
        const storageKey = `sb-${projectId}-auth-token`;

        // 1. Sync via Cookies for Server Components
        try {
            await view.webContents.session.cookies.set({
                url: 'http://localhost:3000',
                name: storageKey,
                value: encodeURIComponent(sessionStr),
                expirationDate: data.session.expires_at,
                sameSite: 'lax'
            });
        } catch (e) { }

        // 2. Sync via LocalStorage and Force Refresh for Client Components
        await view.webContents.executeJavaScript(`
            (function() {
                const key = '${storageKey}';
                const nextSessionStr = ${JSON.stringify(sessionStr)};
                const current = localStorage.getItem(key);
                
                if (current !== nextSessionStr) {
                    localStorage.setItem(key, nextSessionStr);
                    window.location.reload();
                } else if (document.body.innerText.includes('Sign in') || 
                           document.body.innerText.includes('로그인')) {
                    // Even if token exists, if UI shows login, force reload
                    window.location.reload();
                }
            })();
        `);
    } else {
        // Handle Logout
        const projectId = SUPABASE_URL.split('.')[0].split('//')[1];
        const storageKey = `sb-${projectId}-auth-token`;
        await view.webContents.executeJavaScript(`localStorage.removeItem('${storageKey}');`);
        view.webContents.session.cookies.remove('http://localhost:3000', storageKey);
    }

    // CSS Injection for perfect desktop integration
    view.webContents.insertCSS(`
        header, footer, div[class*="FilterBar"], div[class*="w-full border-b"] { 
            display: none !important; 
        }
        body { background-color: #f9faff !important; overflow-x: hidden !important; }
        main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
        main > div {
            display: flex !important;
            flex-direction: row !important;
            gap: 24px !important;
            padding: 24px 40px !important;
            max-width: 1280px !important;
            margin: 0 auto !important;
        }
        main > div > div:first-child { width: 280px !important; flex: none !important; }
        main > div > div:last-child { flex: 1 !important; min-width: 0 !important; }
        .grid {
            display: grid !important;
            gap: 16px !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        @media (min-width: 1024px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
        @media (min-width: 1280px) { .grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; } }
        div[class*="previewBgClasses"], .flex.h-40 { height: 160px !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
    `);

    // Listen for download requests from web app
    view.webContents.on('ipc-message', async (event, channel, data) => {
        if (channel === 'download-video') {
            const result = await handleVideoDownload(data.videoId, data.title);
            view.webContents.send('download-result', result);
        }
    });

    // Inject script to capture download requests from web app
    view.webContents.executeJavaScript(`
        // Listen for custom download event
        document.addEventListener('tubiq-download', async (e) => {
            const { videoId, title } = e.detail;
            console.log('Download requested:', videoId, title);
            
            // Store request for Electron to pick up
            window.__tubiqDownloadRequest = { videoId, title, timestamp: Date.now() };
        });
    `);

    // Poll for download requests every 500ms
    setInterval(async () => {
        if (!view) return;
        try {
            const request = await view.webContents.executeJavaScript('window.__tubiqDownloadRequest');
            if (request && request.timestamp) {
                // Clear the request
                await view.webContents.executeJavaScript('window.__tubiqDownloadRequest = null;');

                // Notify renderer to show progress modal
                win.webContents.send('download:start', { title: request.title });

                // Process download
                console.log('Processing download request:', request);
                const result = await handleVideoDownload(request.videoId, request.title);

                // Send result to renderer for custom modal
                if (result.success) {
                    win.webContents.send('download:success', { path: result.path, title: request.title });
                    // Notify renderer to refresh header folder
                    win.webContents.send('download:complete', result.path);
                } else {
                    win.webContents.send('download:error', { error: result.error });
                }
            }
        } catch (e) {
            // Ignore errors from executeJavaScript
        }
    }, 500);
}

// Helper function for video download (reused by IPC handler)
async function handleVideoDownload(videoId, title) {
    if (!customDownloadPath) {
        return { success: false, error: '다운로드 폴더를 먼저 선택해주세요.' };
    }

    const safeTitle = (title || videoId).replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    const outputPath = path.join(customDownloadPath, `${safeTitle}.mp4`);
    const url = `https://youtube.com/watch?v=${videoId}`;

    console.log('Starting download:', url, 'to', outputPath);

    // Try yt-dlp first
    try {
        const result = await downloadWithYtDlp(url, outputPath);
        if (result.success) {
            return result;
        }
    } catch (e) {
        console.log('yt-dlp failed:', e.message);
        return { success: false, error: e.message };
    }

    return { success: false, error: 'Download failed' };
}

ipcMain.on('set-view-url', (event, sectionId) => {
    if (!view) initBrowserView();
    const url = sectionId === 'channels'
        ? 'http://localhost:3000/channel-assets'
        : 'http://localhost:3000/video-assets';

    view.webContents.loadURL(url);
});

ipcMain.on('open-youtube', (event, url) => {
    if (!view) initBrowserView();

    // Ensure view is visible
    if (!win.getBrowserView()) {
        win.setBrowserView(view);
        // Dispatch visibility change to renderer to update state/bounds
        win.webContents.send('view:visibility-changed', true);
    }

    view.webContents.loadURL(url);
});

ipcMain.on('set-view-visibility', (event, visible) => {
    if (!win) return;
    if (visible) {
        if (!view) {
            initBrowserView();
            setupDownloadHandler();
        }
        win.setBrowserView(view);

        // Calculate bounds: Activity Bar(72) + Nav Sidebar(210) = 282
        // Title Bar height(40) + Main Header height - starts collapsed (32px)
        const bounds = win.getContentBounds();
        view.setBounds({
            x: 282,
            y: 56, // 40px title bar + 16px for toggle button
            width: bounds.width - 282,
            height: bounds.height - 56
        });
        view.setAutoResize({ width: true, height: true });
    } else {
        win.setBrowserView(null);
    }
});

// Update BrowserView position when header expands/collapses
ipcMain.on('update-view-bounds', (event, headerExpanded) => {
    if (!win || !view) return;
    const bounds = win.getContentBounds();
    const yOffset = headerExpanded ? 130 : 56; // 40 + 90 vs 40 + 16 for toggle
    view.setBounds({
        x: 282,
        y: yOffset,
        width: bounds.width - 282,
        height: bounds.height - yOffset
    });
});

// Download path management
let customDownloadPath = null;

ipcMain.on('set-download-path', (event, downloadPath) => {
    customDownloadPath = downloadPath;
    console.log('Download path set to:', customDownloadPath);
});

// Handle downloads from BrowserView
function setupDownloadHandler() {
    if (!view) return;

    view.webContents.session.on('will-download', (event, item, webContents) => {
        if (customDownloadPath) {
            const fileName = item.getFilename();
            const savePath = path.join(customDownloadPath, fileName);
            item.setSavePath(savePath);
            console.log('Downloading to:', savePath);
        }
    });
}

// YouTube download with yt-dlp (primary) and ytdl-core (fallback)
ipcMain.handle('download-video', async (event, { videoId, title }) => {
    if (!customDownloadPath) {
        return { success: false, error: '다운로드 폴더를 먼저 선택해주세요.' };
    }

    const safeTitle = (title || videoId).replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    const outputPath = path.join(customDownloadPath, `${safeTitle}.mp4`);
    const url = `https://youtube.com/watch?v=${videoId}`;

    console.log('Starting download:', url, 'to', outputPath);

    // Try yt-dlp first
    try {
        const result = await downloadWithYtDlp(url, outputPath);
        if (result.success) {
            return result;
        }
    } catch (e) {
        console.log('yt-dlp failed:', e.message);
        return { success: false, error: e.message };
    }

    return { success: false, error: 'Download failed' };
});

function downloadWithYtDlp(url, outputPath) {
    return new Promise((resolve, reject) => {
        // Try to find yt-dlp in common locations
        const ytdlpPaths = [
            'yt-dlp',
            'yt-dlp.exe',
            path.join(app.getPath('userData'), 'yt-dlp.exe'),
            path.join(__dirname, 'bin', 'yt-dlp.exe')
        ];

        let ytdlp = null;
        for (const p of ytdlpPaths) {
            try {
                if (p === 'yt-dlp' || p === 'yt-dlp.exe' || fs.existsSync(p)) {
                    ytdlp = p;
                    break;
                }
            } catch { }
        }

        if (!ytdlp) {
            reject(new Error('yt-dlp not found'));
            return;
        }

        const args = [
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '-o', outputPath,
            '--no-playlist',
            url
        ];

        console.log('Running yt-dlp:', ytdlp, args.join(' '));

        const process = spawn(ytdlp, args);
        let stderr = '';

        process.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('yt-dlp:', data.toString());
        });

        process.stdout.on('data', (data) => {
            console.log('yt-dlp:', data.toString());
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, path: outputPath });
            } else {
                reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
}



function createWindow() {
    win = new BrowserWindow({
        width: 1300,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // Allow local resource loading for media
        },
        title: "TubiQ Desktop",
        backgroundColor: '#0d1117'
    });

    win.loadFile(path.join(__dirname, 'index.html'));

    // Window State Events
    win.on('maximize', () => win.webContents.send('win:maximized', true));
    win.on('unmaximize', () => win.webContents.send('win:maximized', false));

    // Initial bounds setting
    win.once('ready-to-show', () => {
        win.show();
    });
}

// Global Shortkeys and Engine Init
app.whenReady().then(() => {
    // Protocol handler implementation (Fixed for Windows paths & characters)
    protocol.handle('tubiq-resource', (request) => {
        try {
            const rawUrl = request.url;
            // The protocol is 'tubiq-resource://'
            // We want to extract the path.
            let p = rawUrl.replace(/^tubiq-resource:\/\/+/, '');

            // If the URL was constructed with 'local' host, remove it
            if (p.startsWith('local/')) p = p.substring(6);

            // In Windows, Electron/Chromium might add a leading slash before the drive letter (e.g., /C:/...)
            // Remove any leading slashes to get a clean path.
            while (p.startsWith('/')) p = p.substring(1);

            // Decode the path
            const decodedPath = decodeURIComponent(p);

            // Resolve to absolute path
            const finalFilePath = path.isAbsolute(decodedPath) ? decodedPath : path.resolve(decodedPath);

            console.log(`[Protocol-Resource] Request: ${rawUrl} -> Resolved: ${finalFilePath}`);

            if (fs.existsSync(finalFilePath)) {
                try {
                    fs.accessSync(finalFilePath, fs.constants.R_OK);
                    // Standard way to serve local files with Range support
                    return net.fetch(url.pathToFileURL(finalFilePath).href);
                } catch (accessErr) {
                    console.error(`[Protocol-Resource] Access Denied: ${finalFilePath}`, accessErr);
                    return new Response('Access Denied', { status: 403 });
                }
            } else {
                console.error(`[Protocol-Resource] File NOT Found: ${finalFilePath}`);
                return new Response('File Not Found', { status: 404 });
            }
        } catch (e) {
            console.error('[Protocol-Resource] Fatal Error:', e);
            return new Response('Internal Protocol Error', { status: 500 });
        }
    });

    setupDevReload();
    setupProtocolHandler();
    createWindow();
    startClipboardMonitor();

    // Check for initial protocol URL (Windows)
    const initialUrl = process.argv.find(arg => arg.startsWith('tubiq://'));
    if (initialUrl) {
        console.log('[Protocol] Initial URL detected:', initialUrl);
        // Wait a bit for window to be ready
        setTimeout(() => handleProtocolUrl(initialUrl), 1000);
    }

    // Register Ctrl+Shift+S to open window
    globalShortcut.register('CommandOrControl+Shift+S', () => {
        if (win) {
            win.show();
            win.focus();
        }
    });

    // Register Ctrl+Shift+E to toggle expansion
    globalShortcut.register('CommandOrControl+Shift+E', () => {
        if (expansionEngine) {
            const newState = expansionEngine.toggle();
            console.log('Expansion Engine toggled:', newState);
        } else {
            console.warn('Expansion Engine not available to toggle.');
        }
    });

    // Start Global Hook Engine (Deferred to prevent startup freeze)
    setTimeout(() => {
        try {
            if (expansionEngine && typeof expansionEngine.start === 'function') {
                console.log('Starting Expansion Engine (Deferred)...');
                expansionEngine.start();
            } else {
                console.warn('Expansion Engine is not available.');
            }
        } catch (e) {
            console.error('Failed to start expansion engine. Native modules might be missing.', e.message);
        }
    }, 3000);

    // Auth State Change Monitor for real-time BrowserView sync
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Main: Auth State Change:', event);
        if (win) win.webContents.send('auth:changed', session);
        if (view) syncSessionToView();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Scrape Metadata using Hidden Browser Window (Robust for Douyin/TikTok)
ipcMain.handle('scrape-metadata-browser', async (event, targetUrl) => {
    console.log('[Scraper] Starting browser scrape for:', targetUrl);
    let scrapeWin = new BrowserWindow({
        show: false, // Hidden but rendering
        width: 1280, // Desktop width
        height: 800,
        webPreferences: {
            offscreen: true,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    try {
        // Set a realistic User-Agent (Desktop is often better for parsing than mobile SPA)
        scrapeWin.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await scrapeWin.loadURL(targetUrl, {
            waitUntil: 'dom-ready',
            timeout: 20000
        });

        // Wait a bit for JS to render
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Inject script to extract metadata
        const metadata = await scrapeWin.webContents.executeJavaScript(`
            (function() {
                const getMeta = (prop) => {
                    const el = document.querySelector(\`meta[property="\${prop}"]\`) || document.querySelector(\`meta[name="\${prop}"]\`);
                    return el ? el.content : '';
                };

                let title = getMeta('og:title');
                 // Douyin specific fallback
                 if (!title || title === 'Douyin') {
                     const descEl = document.querySelector('[data-e2e="video-desc"]') || document.querySelector('.desc--1y6Tq'); 
                     if (descEl) title = descEl.innerText;
                     else title = document.title;
                 }
                
                // Remove generic suffix
                if (title) title = title.replace(' - Douyin', '').trim();

                let thumb = getMeta('og:image');
                if (!thumb) {
                    const video = document.querySelector('video');
                    if (video && video.poster) thumb = video.poster;
                    // Douyin img fallback
                    const img = document.querySelector('.img--1G0ci') || document.querySelector('img.poster');
                    if (!thumb && img) thumb = img.src;
                }

                let channel = getMeta('og:site_name') || getMeta('author');
                // Douyin specific channel name
                if (!channel || channel === 'Douyin') {
                    const authorEl = document.querySelector('[data-e2e="video-author-name"]') || document.querySelector('.account-name');
                    if (authorEl) channel = authorEl.innerText;
                }
                
                // View Count (Douyin often puts it in text)
                // Need complex selector, skip for now to avoid breaking.

                return {
                    title: title,
                    thumbnail_url: thumb,
                    channel_name: channel,
                    description: getMeta('og:description'),
                    url: window.location.href, // Capture final URL after redirects
                    date: new Date().toISOString() // Placeholder or extract if possible
                };
            })();
        `);

        console.log('[Scraper] Success:', metadata);
        if (scrapeWin && !scrapeWin.isDestroyed()) scrapeWin.close();
        return { success: true, ...metadata };

    } catch (e) {
        console.error('[Scraper] Failed:', e);
        if (scrapeWin && !scrapeWin.isDestroyed()) scrapeWin.close();
        return { success: false, error: e.message };
    }
});

// ============================================
// Q Audio - SAM Audio Separation via fal.ai API
// ============================================

// Helper to get fal.ai API Key
async function getFalApiKey() {
    console.log('[DEBUG] Fetching fal.ai API Key...');
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            console.log('[DEBUG] No active Supabase session found for fal.ai key.');
            return process.env.FAL_KEY;
        }

        const { data, error } = await supabase
            .from('user_settings')
            .select('setting_value')
            .eq('user_id', session.user.id)
            .eq('setting_key', 'api_config')
            .single();

        if (error || !data) {
            console.log('[DEBUG] No api_config found for fal.ai, falling back to Env.');
            return process.env.FAL_KEY;
        }

        const config = data.setting_value;
        const keys = config?.fal?.keys;

        if (Array.isArray(keys) && keys.length > 0) {
            let rawKey = keys[0];
            let key = typeof rawKey === 'object' ? (rawKey.key || rawKey.apiKey || Object.values(rawKey)[0] || '') : String(rawKey);
            key = key.trim();

            if (key.length >= 10) {
                console.log(`[DEBUG] Found fal.ai Key in Supabase. Prefix: ${key.substring(0, 7)}...`);
                return key;
            }
        }

        return process.env.FAL_KEY;
    } catch (e) {
        console.error('[DEBUG] Failed to fetch fal.ai API key:', e);
        return process.env.FAL_KEY;
    }
}

// Select audio/video file
ipcMain.handle('select-file', async () => {
    try {
        const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [
                { name: 'Audio/Video Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4', 'mov', 'avi', 'mkv', 'webm'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled || !result.filePaths.length) {
            return { success: false };
        }

        return { success: true, filePaths: result.filePaths };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Q Audio Separate - Call fal.ai SAM Audio API
// Helper for MIME types
function getMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
        '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.webm': 'video/webm',
        '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska'
    };
    return map[ext] || 'application/octet-stream';
}

// Upload file to fal.ai
// Q Audio Separate - Call fal.ai SAM Audio API (using @fal-ai/client)
ipcMain.handle('q-audio-separate', async (event, { audioPath, description }) => {
    try {
        const falKey = await getFalApiKey();
        if (!falKey) {
            return { success: false, error: 'Missing FAL_KEY (Set in environment or Supabase settings)' };
        }

        console.log(`[Q-Audio] Starting separation for: ${audioPath}`);

        // Dynamic import for CommonJS compatibility
        const { fal } = await import('@fal-ai/client');

        fal.config({
            credentials: falKey
        });

        // Read file for upload
        console.log('[Q-Audio] Reading file...');
        const audioBuffer = await fs.promises.readFile(audioPath);
        const mimeType = getMime(audioPath);
        const blob = new Blob([audioBuffer], { type: mimeType });

        // 1. Upload to fal.ai storage
        console.log('[Q-Audio] Uploading to fal.ai storage...');
        const fileUrl = await fal.storage.upload(blob);
        console.log(`[Q-Audio] File uploaded: ${fileUrl}`);

        // 2. Submit to Queue
        // Correct Model ID: fal-ai/sam-audio/separate (Confirmed by user screenshot)
        const modelId = 'fal-ai/sam-audio/separate';
        console.log(`[Q-Audio] Submitting to ${modelId}...`);

        let submitResult;
        try {
            submitResult = await fal.queue.submit(modelId, {
                input: {
                    audio_url: fileUrl,
                    prompt: description || 'vocals'
                },
                pollInterval: 1000
            });
        } catch (submitError) {
            console.error('[Q-Audio] Queue Submit Error:', submitError);
            throw submitError;
        }

        const requestId = submitResult.request_id;
        console.log(`[Q-Audio] Request ID: ${requestId}`);

        let result = null;
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes timeout

        while (!result && attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s

            try {
                const status = await fal.queue.status(modelId, { requestId, logs: true });
                console.log(`[Q-Audio] Polling attempt ${attempts}: ${status.status}`);

                if (status.status === 'COMPLETED') {
                    console.log('[Q-Audio] Status COMPLETED. Fetching result...');
                    result = await fal.queue.result(modelId, { requestId });
                    console.log('[Q-Audio] Result fetched successfully.');
                } else if (status.status === 'FAILED') {
                    const failLog = status.logs ? status.logs.map(l => l.message).join('\n') : 'No logs';
                    throw new Error(`Separation failed (Status: FAILED). Logs: ${failLog}`);
                }
            } catch (pollError) {
                console.error(`[Q-Audio] Polling Error (Attempt ${attempts}):`, pollError);
                // If it's a 404 on status, it might be too early or wrong ID, but we retry a few times
                if (attempts > 5 && pollError.message.includes('404')) {
                    throw pollError;
                }
            }
        }

        if (!result) {
            throw new Error('Separation timed out after 2 minutes.');
        }

        console.log('[Q-Audio] Separation complete. Raw Result:', JSON.stringify(result, null, 2));

        // Fix: fal.queue.result returns the data directly, not wrapped in .data
        // We also try to normalize the keys if they differ from target/residual
        const normalizedData = { ...result };

        // Map common variations to standard keys
        if (result.separated_audio && !result.target) normalizedData.target = result.separated_audio;
        if (result.background_audio && !result.residual) normalizedData.residual = result.background_audio;
        if (result.audio_vocal && !result.target) normalizedData.target = result.audio_vocal;
        if (result.audio_background && !result.residual) normalizedData.residual = result.audio_background;

        return { success: true, data: normalizedData };

    } catch (e) {
        console.error('[Q-Audio] API Error:', e);
        // fal-ai/client errors might be objects, try to extract message
        const errorMsg = e.message || JSON.stringify(e);
        return { success: false, error: `API Error: ${errorMsg}` };
    }
});


// Download separated audio from URL
ipcMain.handle('q-audio-download', async (event, { url, filename }) => {
    try {
        const downloadPath = path.join(app.getPath('downloads'), filename);

        const response = await fetch(url);
        if (!response.ok) {
            return { success: false, error: 'Failed to download file' };
        }

        const buffer = await response.arrayBuffer();
        await fs.promises.writeFile(downloadPath, Buffer.from(buffer));

        console.log(`[Q-Audio] Downloaded to: ${downloadPath}`);
        return { success: true, path: downloadPath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
