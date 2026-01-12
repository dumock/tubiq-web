const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SnippetsManager {
    constructor() {
        this.filepath = null;
        this.snippets = [];
        this._initialized = false;
    }

    // Lazy initialization - called when app is ready
    _ensureInit() {
        if (this._initialized) return;

        this.filepath = path.join(app.getPath('userData'), 'snippets_v2.json');
        this.load();
        this._initialized = true;
    }

    load() {
        try {
            if (fs.existsSync(this.filepath)) {
                this.snippets = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
            } else {
                this.snippets = [
                    {
                        id: 'default-1',
                        title: 'Example: YouTube Intro',
                        keyword: 'ㄷㅂ',
                        content: '안녕하세요! TubiQ 데스크탑과 함께하는 영상 편집 시간입니다.',
                        enabled: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    },
                    {
                        id: 'default-2',
                        title: '테스트',
                        keyword: 'ㄱㅅ',
                        content: '감사합니다 고맙습니다...',
                        enabled: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                ];
                this.save();
            }
        } catch (e) {
            console.error('Failed to load snippets', e);
            this.snippets = [];
        }
    }

    save() {
        if (!this.filepath) return;
        try {
            fs.writeFileSync(this.filepath, JSON.stringify(this.snippets, null, 2));
        } catch (e) {
            console.error('Failed to save snippets', e);
        }
    }

    getAll() {
        this._ensureInit();
        return this.snippets;
    }

    add(snippet) {
        this._ensureInit();
        if (this.snippets.find(s => s.keyword === snippet.keyword)) {
            throw new Error('Keyword already exists');
        }
        const newSnippet = {
            ...snippet,
            id: Date.now().toString(),
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.snippets.push(newSnippet);
        this.save();
        return newSnippet;
    }

    update(id, updates) {
        this._ensureInit();
        const index = this.snippets.findIndex(s => s.id === id);
        if (index === -1) return null;

        // Keyword collision check
        if (updates.keyword && updates.keyword !== this.snippets[index].keyword) {
            if (this.snippets.find(s => s.keyword === updates.keyword)) {
                throw new Error('Keyword already exists');
            }
        }

        this.snippets[index] = {
            ...this.snippets[index],
            ...updates,
            updatedAt: Date.now()
        };
        this.save();
        return this.snippets[index];
    }

    delete(id) {
        this._ensureInit();
        this.snippets = this.snippets.filter(s => s.id !== id);
        this.save();
    }

    toggle(id) {
        this._ensureInit();
        const snippet = this.snippets.find(s => s.id === id);
        if (snippet) {
            snippet.enabled = !snippet.enabled;
            snippet.updatedAt = Date.now();
            this.save();
        }
        return snippet;
    }
}

module.exports = new SnippetsManager();
