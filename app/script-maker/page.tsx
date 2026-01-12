'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Save, Trash2, Copy, PenTool, Youtube, FileText, ChevronRight, Plus, Download, RotateCcw, Check, Clapperboard } from 'lucide-react';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';

interface PromptStyle {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
}

const DEFAULT_PROMPTS: PromptStyle[] = [
    {
        id: 'p1',
        name: '미스터리 스토리텔링',
        description: '시청자의 호기심을 자극하는 미스터리 쇼츠 스타일',
        systemPrompt: '당신은 미스터리 유튜버입니다. 주어진 내용을 바탕으로 시청자의 호기심을 자극하는 1분 이내의 쇼츠 대본을 작성하세요. 반말을 사용하고, 결론은 마지막에 충격적으로 공개하세요.'
    },
    {
        id: 'p2',
        name: '정보 전달 (빠른 템포)',
        description: '핵심 정보만 빠르게 전달하는 지식 채널 스타일',
        systemPrompt: '당신은 지식 정보 유튜버입니다. 주어진 내용의 핵심 요약하여 1분 쇼츠 대본을 작성하세요. 군더더기 없이 사실 위주로 빠르게 전달하며, 존댓말을 사용하세요.'
    },
    {
        id: 'p3',
        name: '감성 브이로그',
        description: '차분하고 감성적인 내레이션 스타일',
        systemPrompt: '당신은 감성 브이로그 유튜버입니다. 주어진 내용을 바탕으로 편안하고 서정적인 느낌의 쇼츠 내레이션 대본을 작성하세요. 일기 쓰듯이 독백체로 작성하세요.'
    }
];

const DEFAULT_ANALYSIS_PROMPT = `You are an expert Content Stylist and Prompt Engineer.
Analyze the following transcripts (Scripts) from a YouTube channel.
Identify the core "Persona", "Tone & Manner", "Structure", and "Key Catchphrases".

Based on this analysis, write a "System Prompt" that I can give to an AI (like yourself) to make it generate NEW scripts in EXACTLY this style.

The System Prompt should include:
- Role Definition (e.g., "당신은 호기심을 자극하는 미스터리 스토리텔러입니다...")
- Tone Guidelines (e.g., "짧은 문장을 사용하고, 질문으로 끝맺으세요...")
- Structural Rules (e.g., "훅으로 시작해서, 3가지 포인트를 말하고, 반전으로 끝내세요")
- Formatting Rules (if any specific markdown is used)

IMPORTANT: The output System Prompt must be written in **KOREAN** (한국어).
Output ONLY the System Prompt content. Do not add introductory text.`;

export default function ScriptMakerPage() {
    const router = useRouter();
    const [prompts, setPrompts] = useState<PromptStyle[]>(DEFAULT_PROMPTS);
    const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
    const [sourceText, setSourceText] = useState('');
    const [generatedScript, setGeneratedScript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Prompt Editor State
    const [newPromptName, setNewPromptName] = useState('');
    const [newPromptDesc, setNewPromptDesc] = useState('');
    const [newPromptContent, setNewPromptContent] = useState('');

    // YouTube Analysis State
    const [importMode, setImportMode] = useState<'direct' | 'youtube'>('direct');
    const [channelUrl, setChannelUrl] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisPrompt, setAnalysisPrompt] = useState(DEFAULT_ANALYSIS_PROMPT);
    const [showAnalysisSettings, setShowAnalysisSettings] = useState(false);

    // Load saved prompts on mount
    useEffect(() => {
        const saved = localStorage.getItem('my_prompt_styles');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const customPrompts = Array.isArray(parsed) ? parsed : [];
                setPrompts([...DEFAULT_PROMPTS, ...customPrompts]);
            } catch (e) {
                console.error('Failed to load prompts', e);
            }
        }
    }, []);

    const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

    const handleGenerate = async () => {
        if (!selectedPrompt || !sourceText) return;

        setIsGenerating(true);
        setGeneratedScript(''); // Clear previous

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/script-maker/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    sourceText,
                    systemPrompt: selectedPrompt.systemPrompt,
                    styleName: selectedPrompt.name,
                }),
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                setGeneratedScript((prev) => prev + chunk);
            }

        } catch (error) {
            console.error('Generation failed:', error);
            alert('대본 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = async () => {
        if (!generatedScript) return;
        await navigator.clipboard.writeText(generatedScript);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleAnalyzeChannel = async () => {
        if (!channelUrl) return;

        setIsAnalyzing(true);
        try {
            // Get session for API Auth
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/youtube/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    channelUrl,
                    analysisPrompt // Send custom prompt
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Unknown error');

            setNewPromptContent(data.systemPrompt);
            setNewPromptDesc(`Created from ${channelUrl} (${data.scriptCount} videos)`);
            setImportMode('direct'); // Switch back to view result
            alert(`${data.scriptCount}개의 영상을 분석하여 스타일을 추출했습니다!`);

        } catch (error: any) {
            alert('분석 실패: ' + error.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSavePrompt = () => {
        if (!newPromptName || !newPromptContent) return;

        const newId = `p${Date.now()}`;
        const newStyle = {
            id: newId,
            name: newPromptName,
            description: newPromptDesc || '사용자 정의 스타일',
            systemPrompt: newPromptContent
        };

        const updatedPrompts = [...prompts, newStyle];
        setPrompts(updatedPrompts);

        // Save to LocalStorage
        localStorage.setItem('my_prompt_styles', JSON.stringify(updatedPrompts.filter(p => !DEFAULT_PROMPTS.some(dp => dp.id === p.id))));

        setIsEditingPrompt(false);
        setSelectedPromptId(newId);

        // Reset inputs
        setNewPromptName('');
        setNewPromptDesc('');
        setNewPromptContent('');
        setChannelUrl('');
        setImportMode('direct');
    };

    const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('정말 삭제하시겠습니까?')) {
            const updatedPrompts = prompts.filter(p => p.id !== id);
            setPrompts(updatedPrompts);

            // Update LocalStorage, only store custom prompts
            localStorage.setItem('my_prompt_styles', JSON.stringify(updatedPrompts.filter(p => !DEFAULT_PROMPTS.some(dp => dp.id === p.id))));

            if (selectedPromptId === id) {
                setSelectedPromptId(null);
            }
        }
    };

    const handleSendToStoryboard = () => {
        if (!generatedScript) return;
        // Save to localStorage so Storyboard page can pick it up
        localStorage.setItem('tubiq_current_script', generatedScript);
        router.push('/storyboard');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
            <Header />
            <main className="flex h-[calc(100vh-65px)] w-full overflow-hidden">
                {/* 1. Left Sidebar: Prompt Manager */}
                <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Youtube className="h-4 w-4 text-red-500" />
                            벤치마킹 스타일
                        </h2>
                        <button
                            onClick={() => setIsEditingPrompt(true)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-indigo-600 transition-colors"
                            title="새 스타일 추가"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {prompts.map(prompt => (
                            <div
                                key={prompt.id}
                                onClick={() => setSelectedPromptId(prompt.id)}
                                className={`group relative p-3 rounded-xl cursor-pointer border transition-all ${selectedPromptId === prompt.id
                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm dark:bg-indigo-900/20 dark:border-indigo-800'
                                    : 'bg-white border-transparent hover:border-gray-200 hover:bg-gray-50 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className={`text-sm font-bold ${selectedPromptId === prompt.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                                            {prompt.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                            {prompt.description}
                                        </p>
                                    </div>
                                    {selectedPromptId === prompt.id && (
                                        <button
                                            onClick={(e) => handleDeletePrompt(prompt.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Center: Input Workspace */}
                <div className="flex-1 flex flex-col min-w-0 bg-white/50 dark:bg-zinc-950">
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col p-4 max-w-6xl mx-auto w-full gap-4 h-full overflow-hidden">
                        {/* Header - Compact */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                AI 대본 메이커 <span className="text-[10px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full">Beta</span>
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                벤치마킹할 스타일을 선택하고 내용을 입력하면, <b>Gemini 3.0 Pro</b>가 대본을 작성합니다.
                            </p>
                        </div>

                        {isEditingPrompt ? (
                            <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 flex flex-col gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
                                {/* Edit Mode Header */}
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">새로운 프롬프트 스타일 만들기</h3>
                                    <button onClick={() => setIsEditingPrompt(false)} className="text-sm text-gray-500 hover:text-gray-700">취소</button>
                                </div>

                                {/* Mode Tabs */}
                                <div className="flex p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg self-start">
                                    <button
                                        onClick={() => setImportMode('direct')}
                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${importMode === 'direct' ? 'bg-white shadow-sm text-indigo-600 dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        ✍️ 직접 작성
                                    </button>
                                    <button
                                        onClick={() => setImportMode('youtube')}
                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${importMode === 'youtube' ? 'bg-white shadow-sm text-red-600 dark:bg-zinc-700 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        📺 유튜브 분석 (Beta)
                                    </button>
                                </div>

                                {importMode === 'youtube' ? (
                                    <div className="flex flex-col gap-4 py-8 items-center text-center">
                                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
                                            <Youtube className="h-8 w-8" />
                                        </div>
                                        <h4 className="text-lg font-bold">유튜브 채널 스타일 복제하기</h4>
                                        <p className="text-gray-500 text-sm max-w-md">
                                            벤치마킹하고 싶은 채널 URL을 입력하시면,<br />
                                            최신 영상 20개를 분석해 <b>가장 비슷한 대본 스타일</b>을 만들어 드립니다.
                                        </p>

                                        <div className="flex w-full max-w-lg mt-4 gap-2">
                                            <input
                                                type="text"
                                                value={channelUrl}
                                                onChange={(e) => setChannelUrl(e.target.value)}
                                                placeholder="https://www.youtube.com/@channel_id"
                                                className="flex-1 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                            />
                                            <button
                                                onClick={handleAnalyzeChannel}
                                                disabled={!channelUrl || isAnalyzing}
                                                className="bg-red-600 hover:bg-red-700 text-white px-6 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[100px]"
                                            >
                                                {isAnalyzing ? <span className="animate-spin">🌀</span> : '분석하기'}
                                            </button>
                                        </div>
                                        {isAnalyzing && (
                                            <p className="text-xs text-indigo-500 animate-pulse mt-2">
                                                영상 대본을 수집하고 Gemini가 분석 중입니다... (약 10~20초 소요)
                                            </p>
                                        )}

                                        <div className="w-full max-w-lg mt-4 border-t border-gray-100 dark:border-zinc-800 pt-4">
                                            <button
                                                onClick={() => setShowAnalysisSettings(!showAnalysisSettings)}
                                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 flex items-center gap-1 mx-auto transition-colors"
                                            >
                                                {showAnalysisSettings ? '고급 설정 닫기' : '고급 설정 (분석 프롬프트 수정)'}
                                                <ChevronRight className={`h-3 w-3 transition-transform ${showAnalysisSettings ? 'rotate-90' : 'rotate-0'}`} />
                                            </button>

                                            {showAnalysisSettings && (
                                                <div className="mt-3 text-left animate-in slide-in-from-top-2 duration-200">
                                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between items-center">
                                                        <span>Gemini에게 보낼 분석 지침</span>
                                                        <button
                                                            onClick={() => setAnalysisPrompt(DEFAULT_ANALYSIS_PROMPT)}
                                                            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1"
                                                        >
                                                            <RotateCcw className="h-3 w-3" /> 초기화
                                                        </button>
                                                    </label>
                                                    <textarea
                                                        value={analysisPrompt}
                                                        onChange={(e) => setAnalysisPrompt(e.target.value)}
                                                        className="w-full h-64 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-y font-mono leading-relaxed"
                                                        placeholder="채널 분석 시 Gemini에게 전달할 프롬프트입니다."
                                                    />
                                                    <p className="text-[10px] text-gray-400 mt-2">
                                                        * 이 프롬프트는 Gemini가 유튜브 자막을 읽고 스타일을 분석할 때 사용됩니다.<br />
                                                        * "Gemini 3.0 Pro" 등의 문구를 추가하여 더 강력한 분석을 요청해 보세요.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 animate-in fade-in duration-300">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">스타일 이름</label>
                                            <input
                                                type="text"
                                                value={newPromptName}
                                                onChange={(e) => setNewPromptName(e.target.value)}
                                                placeholder="예: 호기심 자극 스토리텔링"
                                                className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">설명 (선택)</label>
                                            <input
                                                type="text"
                                                value={newPromptDesc}
                                                onChange={(e) => setNewPromptDesc(e.target.value)}
                                                placeholder="이 스타일에 대한 간단한 설명"
                                                className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                                                <span>시스템 프롬프트</span>
                                                {newPromptContent && <span className="text-green-600 dark:text-green-400 text-[10px]">✨ 분석 완료</span>}
                                            </label>
                                            <textarea
                                                value={newPromptContent}
                                                onChange={(e) => setNewPromptContent(e.target.value)}
                                                placeholder="AI에게 지시할 내용을 상세히 적어주세요..."
                                                className="w-full h-40 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                )}

                                {importMode === 'direct' && (
                                    <div className="mt-auto pt-4 flex justify-end">
                                        <button
                                            onClick={handleSavePrompt}
                                            disabled={!newPromptName || !newPromptContent}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                                        >
                                            <Save className="h-4 w-4" />
                                            스타일 저장하기
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
                                {/* Input Column */}
                                <div className="flex-1 flex flex-col gap-2 min-h-0">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex justify-between flex-shrink-0 items-center">
                                        <span>소스 텍스트</span>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setSourceText('')}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                title="입력 초기화"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="font-normal text-gray-400">{sourceText.length}자</span>
                                        </div>
                                    </label>
                                    <textarea
                                        value={sourceText}
                                        onChange={(e) => setSourceText(e.target.value)}
                                        placeholder="뉴스 기사, 블로그 글, 또는 대본으로 만들고 싶은 내용을 여기에 붙여넣으세요..."
                                        className="flex-1 w-full p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-sm dark:text-white min-h-0"
                                    />

                                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 flex items-center justify-between shadow-sm flex-shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                                {selectedPrompt ? <PenTool className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> : <Sparkles className="h-4 w-4 text-gray-400" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                                                    {selectedPrompt ? selectedPrompt.name : '스타일 선택'}
                                                </p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:block">
                                                    {selectedPrompt ? '이 스타일로 생성합니다.' : '왼쪽에서 선택하세요.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleGenerate}
                                            disabled={!selectedPrompt || !sourceText || isGenerating}
                                            className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${!selectedPrompt || !sourceText
                                                ? 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed'
                                                : isGenerating
                                                    ? 'bg-indigo-600/80 text-white cursor-wait'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:scale-105 active:scale-95'
                                                }`}
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                                                    생성 중
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    대본 생성
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Divider Arrow (Desktop) */}
                                <div className="hidden lg:flex flex-col justify-center text-gray-300 dark:text-zinc-700 flex-shrink-0">
                                    <ChevronRight className="h-6 w-6" />
                                </div>

                                {/* Output Column */}
                                <div className="flex-1 flex flex-col gap-2 min-h-0">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex justify-between items-center h-5 flex-shrink-0">
                                        <span>생성된 대본</span>
                                        {generatedScript && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleSendToStoryboard}
                                                    className="px-2 py-0.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50"
                                                    title="스토리보드 생성"
                                                >
                                                    <Clapperboard className="h-3 w-3" /> 스토리보드
                                                </button>
                                                <button
                                                    onClick={handleCopy}
                                                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 ${isCopied
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                                                        }`}
                                                >
                                                    {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                    {isCopied ? '복사됨!' : '복사'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const blob = new Blob([generatedScript], { type: 'text/plain' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `scriptResult_${new Date().toISOString().slice(0, 10)}.txt`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        document.body.removeChild(a);
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                    className="px-2 py-0.5 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1.5 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                                    title="TXT 파일로 다운로드"
                                                >
                                                    <Download className="h-3 w-3" /> TXT
                                                </button>
                                            </div>
                                        )}
                                    </label>
                                    <div className={`flex-1 w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm overflow-y-auto min-h-0 relative ${!generatedScript ? 'flex items-center justify-center' : ''
                                        }`}>
                                        {!generatedScript ? (
                                            <div className="text-center text-gray-400 dark:text-zinc-600">
                                                <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                                <p className="text-xs">아직 생성된 대본이 없습니다.<br />왼쪽에서 '생성하기'를 눌러주세요.</p>
                                            </div>
                                        ) : (
                                            <textarea
                                                className="w-full h-full bg-transparent border-none resize-none focus:ring-0 text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-400"
                                                value={generatedScript}
                                                onChange={(e) => setGeneratedScript(e.target.value)}
                                                spellCheck={false}
                                            />
                                        )}

                                        {isGenerating && (
                                            <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                                    <p className="text-sm font-bold text-indigo-600 animate-pulse">Gemini가 대본을 작성 중입니다...</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
