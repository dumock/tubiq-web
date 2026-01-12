'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw, Youtube, Bot, ShieldCheck, AlertCircle, Loader2, Sparkles, Share2, Wand2, Mic } from 'lucide-react';
import { useYouTubeApi } from '@/hooks/useYouTubeApi';
import AppleToast from './AppleToast';

interface ApiConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ApiConfigModal({ isOpen, onClose }: ApiConfigModalProps) {
    const { config, updateConfig, isLoading } = useYouTubeApi();
    const [activeTab, setActiveTab] = useState<'youtube' | 'gemini' | 'openai' | 'tikhub' | 'fal' | 'voice'>('youtube');
    const [newKey, setNewKey] = useState('');
    const [newBudget, setNewBudget] = useState<number>(10000);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showToast, setShowToast] = useState(false);

    // Safe access for config[activeTab] - fallback for old configs missing openai
    // For voice tab, we use a different structure, so return dummy for this variable to prevent errors in shared logic
    const currentTabConfig = (activeTab !== 'voice' ? config[activeTab] : undefined) || { keys: [], rotationEnabled: false };

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

        const keyItem: any = {
            id: crypto.randomUUID(),
            key: keyVal,
            maskedKey: masked,
            quota: validQuota,
            active: true // Default to active
        };

        const updatedConfig = {
            ...config,
            [activeTab]: {
                ...currentTabConfig,
                keys: [...currentTabConfig.keys, keyItem]
            }
        };

        updateConfig(updatedConfig);
        setNewKey('');
        setNewBudget(10000);
    };

    const handleDeleteKey = (id: string) => {
        const updatedConfig = {
            ...config,
            [activeTab]: {
                ...currentTabConfig,
                keys: currentTabConfig.keys.filter((k: any) => k.id !== id)
            }
        };
        updateConfig(updatedConfig);
    };

    const toggleRotation = () => {
        const updatedConfig = {
            ...config,
            [activeTab]: {
                ...currentTabConfig,
                rotationEnabled: !currentTabConfig.rotationEnabled
            }
        };
        updateConfig(updatedConfig);
    };

    const handleSave = () => {
        // Trigger toast
        setShowToast(true);
        // Config is already saved via updateConfig calls immediately on change in current logic,
        // so we just show the feedback and then close.
        // We delay closing slightly to let the user see the toast? 
        // Or "Saved" button usually implies "I'm done, save and close".
        // Apple toast usually appears and fades out.
        // Let's keep modal open for a split second or just let toast render on top (users can still see modal bg).
        // Actually, if we close modal, the toast (Portaled) will still show? Yes if component unmounts? 
        // If AppleToast is inside Modal component and Modal unmounts, Toast unmounts.
        // So we need to keep Modal open until Toast finishes OR move Toast to a global context if we want it to persist after close.
        // Simpler approach: Show toast, wait 1s, then close modal.
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <AppleToast
                isOpen={showToast}
                onClose={() => {
                    setShowToast(false);
                    onClose();
                }}
            />
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
                    <button
                        onClick={() => { setActiveTab('openai'); setTestResult(null); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'openai'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                    >
                        <Sparkles className="h-4 w-4" />
                        OpenAI API
                    </button>
                    <button
                        onClick={() => { setActiveTab('tikhub'); setTestResult(null); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'tikhub'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                    >
                        <Share2 className="h-4 w-4" />
                        TikHub API
                    </button>
                    <button
                        onClick={() => { setActiveTab('fal'); setTestResult(null); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'fal'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                    >
                        <Wand2 className="h-4 w-4" />
                        FAL API
                    </button>
                    <button
                        onClick={() => { setActiveTab('voice'); setTestResult(null); }}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'voice'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                    >
                        <Mic className="h-4 w-4" />
                        Voice API
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {/* YouTube Test Integration Button */}
                    {activeTab === 'youtube' && (
                        <div className="mb-6">
                            <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                                <p className="text-xs text-red-700 dark:text-red-300">
                                    ▶️ 유튜브 채널/영상 검색에 사용됩니다.
                                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline font-bold">Google Cloud Console</a>에서 API Key 발급
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        // Get active YouTube key from current config
                                        const youtubeConfig = config.youtube || { keys: [], rotationEnabled: false };
                                        const activeKey = youtubeConfig.keys.find((k: any) => k.active);

                                        const headers: Record<string, string> = {};
                                        if (activeKey) {
                                            headers['X-YouTube-Api-Key'] = activeKey.key;
                                        }

                                        const res = await fetch('/api/integrations/youtube/test', { headers });
                                        const data = await res.json();
                                        if (data.ok) {
                                            setTestResult({ success: true, message: `테스트 성공: ${data.message}` });
                                        } else {
                                            setTestResult({ success: false, message: `테스트 실패: ${data.message || ''}` });
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
                            <div className="mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    🤖 AI 분석, 번역, 스크립트 생성에 사용됩니다.
                                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-bold">Google AI Studio</a>에서 API Key 발급
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        // Get active Gemini key from current config
                                        const geminiConfig = config.gemini || { keys: [], rotationEnabled: false };
                                        const activeKey = geminiConfig.keys.find((k: any) => k.active);

                                        const headers: Record<string, string> = {};
                                        if (activeKey) {
                                            headers['X-Gemini-Api-Key'] = activeKey.key;
                                        }

                                        const res = await fetch('/api/integrations/gemini/test', {
                                            method: 'POST',
                                            headers
                                        });
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

                    {/* OpenAI Test Integration Button */}
                    {activeTab === 'openai' && (
                        <div className="mb-6">
                            <div className="mb-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                                <p className="text-xs text-green-700 dark:text-green-300">
                                    ✨ GPT 기반 콘텐츠 생성에 사용됩니다.
                                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-bold">OpenAI Platform</a>에서 API Key 발급
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        // Get active OpenAI key from current config
                                        const openaiConfig = config.openai || { keys: [], rotationEnabled: false };
                                        const activeKey = openaiConfig.keys.find((k: any) => k.active);

                                        const headers: Record<string, string> = {};
                                        if (activeKey) {
                                            headers['X-OpenAI-Api-Key'] = activeKey.key;
                                        }

                                        const res = await fetch('/api/integrations/openai/test', {
                                            method: 'POST',
                                            headers
                                        });
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

                    {/* TikHub Test Integration Button */}
                    {activeTab === 'tikhub' && (
                        <div className="mb-6">
                            <div className="mb-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
                                <p className="text-xs text-purple-700 dark:text-purple-300">
                                    🎵 TikTok, Instagram, 샤오홍슈 채널 조회에 사용됩니다.
                                    <a href="https://tikhub.io" target="_blank" rel="noopener noreferrer" className="underline font-bold">tikhub.io</a>에서 API Key 발급
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        // Get active TikHub key from current config
                                        const tikhubConfig = config.tikhub || { keys: [], rotationEnabled: false };
                                        const activeKey = tikhubConfig.keys.find((k: any) => k.active);

                                        const headers: Record<string, string> = {};
                                        if (activeKey) {
                                            headers['X-TikHub-Api-Key'] = activeKey.key;
                                        }

                                        const res = await fetch('/api/integrations/tikhub/test', {
                                            method: 'POST',
                                            headers
                                        });
                                        const data = await res.json();
                                        if (data.ok) {
                                            setTestResult({ success: true, message: `테스트 성공: ${data.message}` });
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

                    {/* FAL Test Integration Button */}
                    {activeTab === 'fal' && (
                        <div className="mb-6">
                            <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    ✨ AI 이미지/비디오 생성에 사용됩니다.
                                    <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="underline font-bold">fal.ai</a>에서 API Key 발급
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        // Get active FAL key from current config
                                        const falConfig = config.fal || { keys: [], rotationEnabled: false };
                                        const activeKey = falConfig.keys.find((k: any) => k.active);

                                        const headers: Record<string, string> = {};
                                        if (activeKey) {
                                            headers['X-Fal-Api-Key'] = activeKey.key;
                                        }

                                        const res = await fetch('/api/integrations/fal/test', {
                                            method: 'POST',
                                            headers
                                        });
                                        const data = await res.json();
                                        if (data.ok) {
                                            setTestResult({ success: true, message: `테스트 성공: ${data.message}` });
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

                    {/* Voice API Settings Section */}
                    {activeTab === 'voice' && (
                        <div className="mb-6 space-y-6">
                            <div className="mb-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                                    🎙️ AI 음성 합성(TTS) 서비스 연동을 위한 API 키 설정입니다.
                                </p>
                            </div>

                            <button
                                onClick={async () => {
                                    setTestResult(null);
                                    try {
                                        // Get active Voice keys from current config
                                        const voiceConfig = config.voice || { typecast: '', elevenlabs: '', minimax: '' };

                                        const res = await fetch('/api/integrations/voice/test', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify(voiceConfig)
                                        });
                                        const data = await res.json();
                                        if (data.ok) {
                                            setTestResult({ success: true, message: `테스트 성공: ${data.message}` });
                                        } else {
                                            setTestResult({ success: false, message: `테스트 실패: ${data.message}` });
                                        }
                                    } catch (e) {
                                        setTestResult({ success: false, message: '테스트 오류 발생' });
                                    }
                                }}
                                className="w-full h-10 px-4 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors text-sm mb-4"
                            >
                                음성 API 연동 테스트
                            </button>
                            {testResult && (
                                <div className="mb-4">
                                    <p className={`text-sm ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {testResult.message}
                                    </p>
                                </div>
                            )}

                            {/* Typecast */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-900 dark:text-white">Typecast API Key</label>
                                <input
                                    type="password"
                                    value={config.voice?.typecast || ''}
                                    onChange={(e) => updateConfig({ ...config, voice: { ...config.voice, typecast: e.target.value } })}
                                    placeholder="Typecast API Key 입력"
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 focus:border-indigo-500 outline-none transition-all dark:text-white font-mono"
                                />
                                <p className="text-xs text-gray-500"><a href="https://typecast.ai/developers/api" target="_blank" className="underline hover:text-indigo-500">Typecast</a> 계정 설정에서 발급 가능합니다.</p>
                            </div>

                            {/* ElevenLabs */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-900 dark:text-white">ElevenLabs API Key</label>
                                <input
                                    type="password"
                                    value={config.voice?.elevenlabs || ''}
                                    onChange={(e) => updateConfig({ ...config, voice: { ...config.voice, elevenlabs: e.target.value } })}
                                    placeholder="ElevenLabs API Key 입력"
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 focus:border-indigo-500 outline-none transition-all dark:text-white font-mono"
                                />
                                <p className="text-xs text-gray-500"><a href="https://elevenlabs.io" target="_blank" className="underline hover:text-indigo-500">ElevenLabs</a> 프로필에서 발급 가능합니다.</p>
                            </div>

                            {/* Minimax */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-900 dark:text-white">Minimax API Key</label>
                                <input
                                    type="password"
                                    value={config.voice?.minimax || ''}
                                    onChange={(e) => updateConfig({ ...config, voice: { ...config.voice, minimax: e.target.value } })}
                                    placeholder="Minimax API Key 입력"
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 focus:border-indigo-500 outline-none transition-all dark:text-white font-mono"
                                />
                                <p className="text-xs text-gray-500"><a href="https://api.minimax.chat" target="_blank" className="underline hover:text-indigo-500">Minimax</a> 개발자 콘솔에서 발급 가능합니다.</p>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'voice' && (
                        <>
                            {/* Rotation Toggle Card */}
                            <div className="mb-6 flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-zinc-800/50 p-4 border border-gray-100 dark:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${currentTabConfig.rotationEnabled ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-gray-200 text-gray-500 dark:bg-zinc-700'}`}>
                                        <RotateCcw className={`h-5 w-5 ${currentTabConfig.rotationEnabled ? 'animate-spin-slow' : ''}`} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">API 키 자동 회전 모드</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">할당량 초과 시 자동으로 다음 키를 사용합니다</p>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleRotation}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${currentTabConfig.rotationEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${currentTabConfig.rotationEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Add Key Form */}
                            <div className="mb-8 p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-indigo-600" /> 새 API 키 등록
                                </h3>
                                <div className={`grid grid-cols-1 gap-4 ${activeTab === 'youtube' ? 'sm:grid-cols-12' : 'sm:grid-cols-10'}`}>
                                    <div className={`${activeTab === 'youtube' ? 'sm:col-span-8' : 'sm:col-span-9'}`}>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 ml-1">API 키 입력</label>
                                        <input
                                            type="text"
                                            value={newKey}
                                            onChange={(e) => setNewKey(e.target.value)}
                                            placeholder="키를 입력하세요..."
                                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    {activeTab === 'youtube' && (
                                        <div className="sm:col-span-3">
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 ml-1">일일 예산 (Quota)</label>
                                            <input
                                                type="number"
                                                value={newBudget}
                                                onChange={(e) => setNewBudget(Number(e.target.value))}
                                                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                            />
                                        </div>
                                    )}
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
                                {currentTabConfig.keys.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 bg-gray-50/50 dark:bg-zinc-800/20 rounded-2xl border border-gray-100 dark:border-zinc-800">
                                        <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
                                        <p className="text-sm text-gray-400">등록된 API 키가 없습니다.</p>
                                    </div>
                                ) : (
                                    currentTabConfig.keys.map((key) => (
                                        <div key={key.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all group">
                                            <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate flex-1">{key.maskedKey}</span>
                                                    {key.active && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">Active</span>
                                                    )}
                                                </div>
                                                {activeTab === 'youtube' && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                        <span>일일 예산: <span className="font-bold text-gray-700 dark:text-gray-300">{Number(key.quota).toLocaleString()}</span> units</span>
                                                    </div>
                                                )}
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
                        </>
                    )}
                </div>

                <div className="border-t border-gray-100 dark:border-zinc-800 px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/30 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                    >
                        닫기
                    </button>
                    <button
                        onClick={handleSave}
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
