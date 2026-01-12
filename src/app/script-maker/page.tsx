'use client';

import { useState } from 'react';
import { Sparkles, Save, Trash2, Copy, PenTool, Youtube, FileText, ChevronRight, Plus } from 'lucide-react';

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

export default function ScriptMakerPage() {
    const [prompts, setPrompts] = useState<PromptStyle[]>(DEFAULT_PROMPTS);
    const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
    const [sourceText, setSourceText] = useState('');
    const [generatedScript, setGeneratedScript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);

    // Prompt Editor State
    const [newPromptName, setNewPromptName] = useState('');
    const [newPromptDesc, setNewPromptDesc] = useState('');
    const [newPromptContent, setNewPromptContent] = useState('');

    const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

    const handleGenerate = async () => {
        if (!selectedPrompt || !sourceText) return;

        setIsGenerating(true);
        setGeneratedScript(''); // Clear previous

        // Simulate API streaming
        const mockResponse = `(오프닝: 강렬한 BGM과 함께 화면 전환)\n\n${selectedPrompt.name} 스타일로 변환된 대본입니다.\n\n[장면 1]\n${sourceText.slice(0, 30)}...\n\n(본론: 빠른 화면 전환)\n여기 흥미로운 사실이 있습니다. Gemini 3.0 Pro가 분석한 결과에 따르면...\n\n(클라이막스)\n결국 가장 중요한 것은 바로 이것입니다!\n\n(아웃트로: 구독과 좋아요 유도)\n더 많은 영상이 궁금하다면 구독!\n\n#쇼츠 #AI #자동생성`;

        // Typer effect simulation
        const chars = mockResponse.split('');
        for (let i = 0; i < chars.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 30));
            setGeneratedScript(prev => prev + chars[i]);
        }

        setIsGenerating(false);
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

        setPrompts([...prompts, newStyle]);
        setIsEditingPrompt(false);
        setSelectedPromptId(newId);

        // Reset inputs
        setNewPromptName('');
        setNewPromptDesc('');
        setNewPromptContent('');
    };

    const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('정말 이 스타일을 삭제하시겠습니까?')) {
            setPrompts(prompts.filter(p => p.id !== id));
            if (selectedPromptId === id) setSelectedPromptId(null);
        }
    };

    return (
        <div className="flex h-[calc(100vh-65px)] w-full overflow-hidden bg-gray-50 dark:bg-black">
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
                <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full gap-6">
                    {/* Header */}
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            AI 대본 메이커 <span className="text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-0.5 rounded-full">Beta</span>
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            벤치마킹할 스타일을 선택하고 내용을 입력하면, <b>Gemini 3.0 Pro</b>가 대본을 만들어줍니다.
                        </p>
                    </div>

                    {isEditingPrompt ? (
                        <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 flex flex-col gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">새로운 프롬프트 스타일 만들기</h3>
                                <button onClick={() => setIsEditingPrompt(false)} className="text-sm text-gray-500 hover:text-gray-700">취소</button>
                            </div>

                            <div className="grid gap-4">
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
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">시스템 프롬프트</label>
                                    <textarea
                                        value={newPromptContent}
                                        onChange={(e) => setNewPromptContent(e.target.value)}
                                        placeholder="AI에게 지시할 내용을 상세히 적어주세요.&#13;&#10;예: 당신은 역사 유튜버입니다. 초등학생도 이해하기 쉽게 설명하세요..."
                                        className="w-full h-40 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    />
                                </div>
                            </div>

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
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[500px]">
                            {/* Input Column */}
                            <div className="flex-1 flex flex-col gap-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex justify-between">
                                    <span>소스 텍스트</span>
                                    <span className="text-xs font-normal text-gray-400">{sourceText.length}자</span>
                                </label>
                                <textarea
                                    value={sourceText}
                                    onChange={(e) => setSourceText(e.target.value)}
                                    placeholder="뉴스 기사, 블로그 글, 또는 대본으로 만들고 싶은 내용을 여기에 붙여넣으세요..."
                                    className="flex-1 w-full p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-sm dark:text-white"
                                />

                                <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                            {selectedPrompt ? <PenTool className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> : <Sparkles className="h-5 w-5 text-gray-400" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                {selectedPrompt ? selectedPrompt.name : '스타일을 선택해주세요'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {selectedPrompt ? '이 스타일로 대본을 생성합니다.' : '왼쪽에서 벤치마킹 스타일을 선택하세요.'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!selectedPrompt || !sourceText || isGenerating}
                                        className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${!selectedPrompt || !sourceText
                                                ? 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed'
                                                : isGenerating
                                                    ? 'bg-indigo-600/80 text-white cursor-wait'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:scale-105 active:scale-95'
                                            }`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Sparkles className="h-4 w-4 animate-spin" />
                                                생성 중...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4" />
                                                대본 생성하기
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Divider Arrow (Desktop) */}
                            <div className="hidden lg:flex flex-col justify-center text-gray-300 dark:text-zinc-700">
                                <ChevronRight className="h-6 w-6" />
                            </div>

                            {/* Output Column */}
                            <div className="flex-1 flex flex-col gap-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex justify-between">
                                    <span>생성된 대본</span>
                                    {generatedScript && (
                                        <button
                                            onClick={() => navigator.clipboard.writeText(generatedScript)}
                                            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                                        >
                                            <Copy className="h-3 w-3" /> 복사하기
                                        </button>
                                    )}
                                </label>
                                <div className={`flex-1 w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm overflow-y-auto relative ${!generatedScript ? 'flex items-center justify-center' : ''
                                    }`}>
                                    {!generatedScript ? (
                                        <div className="text-center text-gray-400 dark:text-zinc-600">
                                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm">아직 생성된 대본이 없습니다.<br />왼쪽에서 '생성하기'를 눌러주세요.</p>
                                        </div>
                                    ) : (
                                        <div className="prose prose-sm prose-indigo dark:prose-invert max-w-none whitespace-pre-wrap font-medium">
                                            {generatedScript}
                                        </div>
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
        </div>
    );
}
