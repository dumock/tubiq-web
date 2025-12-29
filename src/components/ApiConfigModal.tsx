'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw, Youtube, Bot, ShieldCheck, AlertCircle } from 'lucide-react';

interface ApiKey {
    id: string;
    key: string;
    maskedKey: string;
    quota: number;
    active: boolean;
}

interface ApiConfig {
    youtube: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
    gemini: {
        keys: ApiKey[];
        rotationEnabled: boolean;
    };
}

interface ApiConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ApiConfigModal({ isOpen, onClose }: ApiConfigModalProps) {
    const [activeTab, setActiveTab] = useState<'youtube' | 'gemini'>('youtube');
    const [config, setConfig] = useState<ApiConfig>({
        youtube: { keys: [], rotationEnabled: false },
        gemini: { keys: [], rotationEnabled: false }
    });
    const [newKey, setNewKey] = useState('');
    const [newBudget, setNewBudget] = useState<number>(10000);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('tubiq_api_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);

                // Sanitize loaded data
                const sanitizeKeys = (keys: any[]) => keys.map(k => ({
                    ...k,
                    quota: (Number.isFinite(Number(k.quota)) && Number(k.quota) > 0) ? Number(k.quota) : 10000,
                    active: typeof k.active === 'boolean' ? k.active : true, // Ensure active exists
                    maskedKey: k.maskedKey || (k.key?.length > 8 ? `${k.key.slice(0, 4)}••••••••${k.key.slice(-4)}` : '••••••••') // Ensure maskedKey
                }));

                if (parsed.youtube) parsed.youtube.keys = sanitizeKeys(parsed.youtube.keys || []);
                if (parsed.gemini) parsed.gemini.keys = sanitizeKeys(parsed.gemini.keys || []);

                setConfig(parsed);
            } catch (e) {
                console.error('Failed to parse API config', e);
            }
        }
    }, [isOpen]);

    // Save to localStorage
    const saveConfig = (newConfig: ApiConfig) => {
        setConfig(newConfig);
        localStorage.setItem('tubiq_api_config', JSON.stringify(newConfig));
    };

    // Close on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    const handleAddKey = () => {
        if (!newKey.trim()) return;

        const keyVal = newKey.trim();
        const masked = keyVal.length > 8
            ? `${keyVal.slice(0, 4)}••••••••${keyVal.slice(-4)}`
            : '••••••••';

        // Sanitize quota input
        let validQuota = Number.parseInt(String(newBudget), 10);
        if (!Number.isFinite(validQuota) || validQuota <= 0) {
            validQuota = 10000;
        }

        const keyItem: ApiKey = {
            id: crypto.randomUUID(),
            key: keyVal,
            maskedKey: masked,
            quota: validQuota,
            active: true // Default to active
        };

        const updatedConfig = {
            ...config,
            [activeTab]: {
                ...config[activeTab],
                keys: [...config[activeTab].keys, keyItem]
            }
        };

        saveConfig(updatedConfig);
        setNewKey('');
        setNewBudget(10000);
    };

    const handleDeleteKey = (id: string) => {
        const updatedConfig = {
            ...config,
            [activeTab]: {
                ...config[activeTab],
                keys: config[activeTab].keys.filter(k => k.id !== id)
            }
        };
        saveConfig(updatedConfig);
    };

    const toggleRotation = () => {
        const updatedConfig = {
            ...config,
            [activeTab]: {
                ...config[activeTab],
                rotationEnabled: !config[activeTab].rotationEnabled
            }
        };
        saveConfig(updatedConfig);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col scale-100 transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">API / 연동 설정</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">서비스 운영을 위한 API 키를 관리하세요</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-zinc-800 px-6">
                    <button
                        onClick={() => { setActiveTab('youtube'); setTestResult(null); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'youtube'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                    >
                        <Youtube className="h-4 w-4" />
                        YouTube API
                    </button>
                    <button
                        onClick={() => { setActiveTab('gemini'); setTestResult(null); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'gemini'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                    >
                        <Bot className="h-4 w-4" />
                        Gemini API
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {/* YouTube Test Integration Button */}
                    {activeTab === 'youtube' && (
                        <div className="mb-6">
                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        const res = await fetch('/api/integrations/youtube/test');
                                        const data = await res.json();
                                        if (data.ok) {
                                            setTestResult({ success: true, message: `테스트 성공: ${data.message}` });
                                        } else {
                                            setTestResult({ success: false, message: '테스트 실패' });
                                        }
                                    } catch (e) {
                                        setTestResult({ success: false, message: '테스트 오류 발생' });
                                    }
                                }}
                                className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors text-sm"
                            >
                                연동 테스트
                            </button>
                            {testResult && (
                                <p className={`mt-2 text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {testResult.message}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Gemini Test Integration Button */}
                    {activeTab === 'gemini' && (
                        <div className="mb-6">
                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        const res = await fetch('/api/integrations/gemini/test', { method: 'POST' });
                                        const data = await res.json();
                                        if (data.ok) {
                                            setTestResult({ success: true, message: `테스트 성공: ${data.text}` });
                                        } else {
                                            setTestResult({ success: false, message: `테스트 실패: ${data.message}` });
                                        }
                                    } catch (e) {
                                        setTestResult({ success: false, message: '테스트 오류 발생' });
                                    }
                                }}
                                className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors text-sm"
                            >
                                연동 테스트
                            </button>
                            {testResult && (
                                <p className={`mt-2 text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {testResult.message}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Rotation Toggle Card */}
                    <div className="mb-6 flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config[activeTab].rotationEnabled ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-gray-200 text-gray-500 dark:bg-zinc-700'}`}>
                                <RotateCcw className={`h-5 w-5 ${config[activeTab].rotationEnabled ? 'animate-spin-slow' : ''}`} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">API 키 자동 회전 모드</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">할당량 초과 시 자동으로 다음 키를 사용합니다</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleRotation}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${config[activeTab].rotationEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'
                                }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${config[activeTab].rotationEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Add Key Form */}
                    <div className="mb-8 p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-indigo-600" /> 새 API 키 등록
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                            <div className="sm:col-span-8">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 ml-1">API 키 입력</label>
                                <input
                                    type="text"
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    placeholder="키를 입력하세요..."
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                />
                            </div>
                            <div className="sm:col-span-3">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 ml-1">일일 예산 (Quota)</label>
                                <input
                                    type="number"
                                    value={newBudget}
                                    onChange={(e) => setNewBudget(Number(e.target.value))}
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                />
                            </div>
                            <div className="sm:col-span-1 flex items-end">
                                <button
                                    onClick={handleAddKey}
                                    disabled={!newKey}
                                    className="w-full h-[42px] flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Plus className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Key List */}
                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 ml-1">등록된 API 키 목록</h3>
                        {config[activeTab].keys.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 bg-gray-50/50 dark:bg-zinc-800/20 rounded-2xl border border-gray-100 dark:border-zinc-800">
                                <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">등록된 API 키가 없습니다.</p>
                            </div>
                        ) : (
                            config[activeTab].keys.map((key) => (
                                <div key={key.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all group">
                                    <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate flex-1">{key.maskedKey}</span>
                                            {key.active && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">Active</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <span>일일 예산: <span className="font-bold text-gray-700 dark:text-gray-300">{Number(key.quota).toLocaleString()}</span> units</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteKey(key.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-100 dark:border-zinc-800 px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/30 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                    >
                        닫기
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all active:scale-[0.98]"
                    >
                        설정 저장됨
                    </button>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #3f3f46;
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
        </div>
    );
}
