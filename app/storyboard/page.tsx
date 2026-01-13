'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import {
    Trash2, Plus, Image as ImageIcon, Film, Loader2, Save, Play, Sparkles,
    RefreshCcw, MonitorPlay, ChevronDown, ChevronUp, Settings, Paintbrush,
    Check, X, Pencil, MoreHorizontal, GripVertical, Video, Download, Scissors, AlertCircle,
    Volume2, VolumeX, Pause, Link, Unlink, Zap, StopCircle, Square, RotateCcw, Wand2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import GrokWorkerControl from '@/components/GrokWorkerControl';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
interface GrokAccount {
    id: string;
    name: string;
    email?: string;
    connected: boolean;
    lastActive?: Date;
}

interface Scene {
    id: string;
    script: string;
    imagePrompt: string;
    imagePromptKo?: string;
    videoPrompt: string;
    imageUrl?: string;
    videoUrl?: string;
    imageStatus: 'idle' | 'generating' | 'complete' | 'error';
    videoStatus: 'idle' | 'generating' | 'complete' | 'error';
    jobId?: string; // For polling
}

interface PromptStyle {
    id: string;
    name: string;
    prompt: string;
    previewColor: string;
}

const DEFAULT_STYLES: PromptStyle[] = [
    { id: 'cinematic', name: '시네마틱 리얼리즘', prompt: 'Cinematic, hyperrealistic, 8k, detailed textures, dramatic lighting, movie still', previewColor: 'bg-slate-800' },
    { id: 'anime', name: '재퍼니메이션', prompt: 'Japanese anime style, cel shaded, vibrant colors, detailed background, Studio Ghibli style', previewColor: 'bg-pink-500' },
    { id: 'webtoon', name: '한국 웹툰', prompt: 'Korean webtoon style, manhwa, sharp lines, digital painting, vibrant', previewColor: 'bg-indigo-500' },
    { id: 'watercolor', name: '수채화 일러스트', prompt: 'Watercolor painting, soft edges, artistic, dreamy, paper transaction', previewColor: 'bg-emerald-400' },
    { id: '3d', name: '3D 애니메이션', prompt: '3D render, Pixar style, cute, octane render, unreal engine 5, detailed', previewColor: 'bg-blue-500' },
    { id: 'noir', name: '필름 누와르', prompt: 'Film noir, black and white, high contrast, mysterious, detective movie style', previewColor: 'bg-gray-900' },
    { id: 'roblox', name: '로블록스 스타일', prompt: 'Roblox game style, blocky characters, simple 3D, colorful, playful, low poly, game screenshot', previewColor: 'bg-red-500' },
    { id: 'zack', name: 'Zack D. Films 스타일', prompt: 'Zack Snyder cinematic style, slow motion, desaturated colors, epic composition, dramatic sky, heroic pose, lens flare, 300 movie style', previewColor: 'bg-amber-700' },
    { id: 'pixar3d', name: 'Pixar 스타일 3D', prompt: 'Pixar animation style, 3D render, cute characters, big expressive eyes, colorful, high quality CGI, Toy Story style, Disney Pixar', previewColor: 'bg-sky-500' },
    { id: 'cyberpunk', name: '사이버펑크 애니메이션', prompt: 'Cyberpunk anime style, neon lights, futuristic city, rain, holographic, Blade Runner aesthetic, night scene, vibrant neon colors, dystopian', previewColor: 'bg-purple-600' },
    { id: 'ultrareal', name: '초실사 시네마틱', prompt: 'Ultra realistic, photorealistic, 8k UHD, DSLR quality, natural lighting, film grain, cinematic composition, professional photography, hyper detailed', previewColor: 'bg-zinc-800' },
    { id: 'lego', name: '레고 스타일', prompt: 'LEGO style, everything made of LEGO bricks, LEGO minifigures, plastic texture, colorful bricks, toy photography, LEGO movie style', previewColor: 'bg-yellow-500' },
];

const PREVIEW_COLORS = [
    { name: 'Slate', value: 'bg-slate-800' },
    { name: 'Pink', value: 'bg-pink-500' },
    { name: 'Indigo', value: 'bg-indigo-500' },
    { name: 'Emerald', value: 'bg-emerald-400' },
    { name: 'Blue', value: 'bg-blue-500' },
    { name: 'Gray', value: 'bg-gray-900' },
    { name: 'Orange', value: 'bg-orange-500' },
    { name: 'Purple', value: 'bg-purple-600' },
    { name: 'Red', value: 'bg-red-500' },
    { name: 'Teal', value: 'bg-teal-500' },
];

const ASPECT_RATIOS = [
    { value: '9:16', label: '9:16 (Shorts/TikTok)' },
    { value: '16:9', label: '16:9 (YouTube Landscape)' },
    { value: '1:1', label: '1:1 (Square)' },
    { value: '2.35:1', label: '2.35:1 (Cinematic)' },
];

const SAMPLERS = [
    { value: 'dpm++_2m_karras', label: 'DPM++ 2M Karras' },
    { value: 'euler_a', label: 'Euler a' },
    { value: 'lcm', label: 'LCM (Fast)' },
];

// --- Components ---

// Glassmorphism Dropdown
const GlassDropdown = ({
    options,
    value,
    onChange,
    disabled = false
}: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full p-3.5 rounded-2xl flex justify-between items-center text-sm font-medium transition-all duration-200 border
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 'cursor-pointer hover:bg-white/80 hover:border-indigo-300'}
                    ${isOpen
                        ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10 shadow-lg'
                        : 'bg-white/60 border-gray-200 shadow-sm'
                    }
                    text-gray-800
                `}
            >
                <span className="truncate font-semibold">{selectedOption?.label}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full p-1.5 rounded-2xl bg-white/90 backdrop-blur-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 origin-top top-full right-0">
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full p-3 rounded-xl text-left text-sm transition-all duration-150 flex items-center justify-between
                                        ${isSelected
                                            ? 'bg-indigo-50 shadow-sm font-bold text-indigo-600'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                                        }
                                    `}
                                >
                                    <span>{option.label}</span>
                                    {isSelected && <Check className="h-4 w-4" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// Custom Glassmorphic Video Player
const CustomVideoPlayer = ({ src, poster }: { src: string; poster?: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [progress, setProgress] = useState(0);
    const [showControls, setShowControls] = useState(true);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const current = videoRef.current.currentTime;
            const duration = videoRef.current.duration;
            setProgress((current / duration) * 100);
        }
    };

    const handleVideoEnd = () => {
        setIsPlaying(false);
        setProgress(0);
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (videoRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const newTime = (clickX / width) * videoRef.current.duration;
            videoRef.current.currentTime = newTime;
        }
    };

    return (
        <div
            className="relative w-full h-full group cursor-pointer overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={togglePlay}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(isPlaying ? false : true)}
        >
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnd}
                className="w-full h-full object-cover"
                playsInline
                muted={isMuted}
            />

            {/* Center Play Button - Grok Style (shows when paused) */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                        onClick={togglePlay}
                        className="pointer-events-auto p-4 rounded-full bg-gray-500/60 backdrop-blur-xl text-white hover:bg-gray-500/80 hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl"
                    >
                        <Play className="h-7 w-7 fill-current ml-0.5" />
                    </button>
                </div>
            )}

            {/* Bottom Control Bar - Grok Glassmorphism Style */}
            <div
                className={`absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Control Bar Container */}
                <div className="flex items-center gap-3">
                    {/* Play/Pause Button */}
                    <button
                        onClick={togglePlay}
                        className="p-3 rounded-full bg-gray-500/60 backdrop-blur-xl text-white hover:bg-gray-500/80 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg"
                    >
                        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                    </button>

                    {/* Progress Bar */}
                    <div
                        className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden cursor-pointer backdrop-blur-sm"
                        onClick={handleProgressClick}
                    >
                        <div
                            className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Mute/Unmute Button */}
                    <button
                        onClick={toggleMute}
                        className="p-3 rounded-full bg-gray-500/60 backdrop-blur-xl text-white hover:bg-gray-500/80 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg"
                    >
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {/* Dark Gradient for Contrast at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        </div>

    );
};

export default function StoryboardPage() {
    const router = useRouter();
    // Data State
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [globalScript, setGlobalScript] = useState('');

    // Config State
    const [selectedStyleId, setSelectedStyleId] = useState<string>('cinematic');
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Art Styles State
    const [artStyles, setArtStyles] = useState<PromptStyle[]>([]);
    const [isManageStylesOpen, setIsManageStylesOpen] = useState(false);
    const [newStyleName, setNewStyleName] = useState('');
    const [newStylePrompt, setNewStylePrompt] = useState('');
    const [newStyleColor, setNewStyleColor] = useState('bg-slate-800');

    // Edit Style State
    const [editingStyle, setEditingStyle] = useState<PromptStyle | null>(null);
    const [editName, setEditName] = useState('');
    const [editPrompt, setEditPrompt] = useState('');
    const [editColor, setEditColor] = useState('bg-slate-800');

    // Styles Grid Collapse State
    const [isStylesExpanded, setIsStylesExpanded] = useState(false);

    // Advanced Settings
    const [negativePrompt, setNegativePrompt] = useState('text, watermark, blurry, low quality, ugly, deformed hands');

    // Load Negative Prompt from localStorage on mount (Client-only)
    useEffect(() => {
        const saved = localStorage.getItem('tubiq_negative_prompt');
        if (saved) {
            setNegativePrompt(saved);
        }
    }, []);
    const [isNegativePromptOpen, setIsNegativePromptOpen] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [sampler, setSampler] = useState('dpm++_2m_karras');

    // Storyboard Generation Mode
    const [sceneMode, setSceneMode] = useState<'auto' | 'sentence' | 'fixed'>('auto');
    const [sceneCount, setSceneCount] = useState(6);

    // Smart Regenerate State
    const [regenerateScene, setRegenerateScene] = useState<Scene | null>(null);
    const [regenerateIssue, setRegenerateIssue] = useState('duplicate');
    const [regenerateDescription, setRegenerateDescription] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Image Generation Engine State
    const [imageEngine, setImageEngine] = useState<'comfyui' | 'grok'>('comfyui');

    // Grok Video Engine State
    const [videoEngine, setVideoEngine] = useState<'comfyui' | 'grok'>('comfyui');
    const [grokAccounts, setGrokAccounts] = useState<GrokAccount[]>([]);
    const [isGrokConnecting, setIsGrokConnecting] = useState(false);
    const [grokStatus, setGrokStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
    const [isAutoGenerate, setIsAutoGenerate] = useState(false);

    // Generation Control State (for cancellation)
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);
    const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
    const imageAbortRef = useRef<AbortController | null>(null);
    const videoAbortRef = useRef<AbortController | null>(null);

    // --- Persistence Logic ---

    // 1. Load Data on Mount & Resume Polling
    useEffect(() => {
        try {
            const savedScenes = localStorage.getItem('tubiq_scenes');
            let loadedScenes: Scene[] = [];

            if (savedScenes) {
                loadedScenes = JSON.parse(savedScenes);
                setScenes(loadedScenes);

                // --- Resume Polling for Pending Videos ---
                loadedScenes.forEach(async (scene) => {
                    if (scene.videoStatus === 'generating' && scene.jobId) {
                        console.log(`[Storyboard] Resuming check for job ${scene.jobId} (status: ${scene.videoStatus})`);

                        // Check Supabase immediately to see if it finished while we were gone
                        const { data: job } = await supabase
                            .from('video_queue')
                            .select('status, video_url')
                            .eq('job_id', scene.jobId)
                            .single();

                        if (job) {
                            if (job.status === 'completed' && job.video_url) {
                                console.log('[Storyboard] Job finished in background:', scene.jobId);
                                setScenes(prev => prev.map(s =>
                                    s.id === scene.id ? { ...s, videoStatus: 'complete', videoUrl: job.video_url } : s
                                ));
                            } else if (job.status === 'failed') {
                                console.log('[Storyboard] Job failed in background:', scene.jobId);
                                setScenes(prev => prev.map(s =>
                                    s.id === scene.id ? { ...s, videoStatus: 'error' } : s
                                ));
                            } else {
                                // Still processing? The existing polling loop in pollVideoStatus (if active) needs to pick this up.
                                // Or we simply rely on the fact that if 'generating' is in state, 
                                // the user might need to manually trigger a poll or we rely on realtime subscription?
                                // Assuming we need to restart the polling interval for this scene if it's not global.
                                // BUT: Current architecture usually uses a global poller or per-component poller. 
                                // Let's check if we need to explicitly trigger something.
                                // For now, updating status to current DB status is good enough for 'Resume'.
                                console.log('[Storyboard] Job still running:', scene.jobId);
                            }
                        }
                    }
                });
            }

            const savedScript = localStorage.getItem('tubiq_global_script');
            if (savedScript) setGlobalScript(savedScript);

            const savedStyle = localStorage.getItem('tubiq_selected_style');
            if (savedStyle) setSelectedStyleId(savedStyle);

            const savedSettings = localStorage.getItem('tubiq_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
                if (settings.sampler) setSampler(settings.sampler);
                if (settings.negativePrompt) setNegativePrompt(settings.negativePrompt);
                if (settings.videoEngine) setVideoEngine(settings.videoEngine);
                if (settings.imageEngine) setImageEngine(settings.imageEngine);
                if (settings.sceneMode) setSceneMode(settings.sceneMode);
                if (settings.sceneCount) setSceneCount(settings.sceneCount);
            }
            console.log('[Storyboard] Data loaded from persistence.');
        } catch (e) {
            console.error('[Storyboard] Failed to load persistence data:', e);
        }
    }, []);

    // 2. Save Data on Change
    useEffect(() => {
        if (scenes.length > 0) {
            localStorage.setItem('tubiq_scenes', JSON.stringify(scenes));
        }
    }, [scenes]);

    useEffect(() => {
        localStorage.setItem('tubiq_global_script', globalScript);
    }, [globalScript]);

    useEffect(() => {
        localStorage.setItem('tubiq_selected_style', selectedStyleId);
    }, [selectedStyleId]);

    useEffect(() => {
        const settings = {
            aspectRatio,
            sampler,
            negativePrompt,
            videoEngine,
            imageEngine,
            sceneMode,
            sceneCount
        };
        localStorage.setItem('tubiq_settings', JSON.stringify(settings));
    }, [aspectRatio, sampler, negativePrompt, videoEngine, imageEngine, sceneMode, sceneCount]);

    // External Image Upload State
    const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);
    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    // Handle External Image Upload (Drag & Drop or File Select)
    const handleExternalImageUpload = async (sceneId: string, file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드할 수 있습니다.');
            return;
        }

        try {
            console.log('[Storyboard] Uploading image via Server API...');

            // 1. Prepare FormData for Server API
            const formData = new FormData();
            formData.append('file', file);
            formData.append('bucket', 'videos');
            formData.append('path', 'storyboard-images');

            // 2. Get Access Token for Security
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // 3. Upload via API (Secure + Isolated)
            const response = await fetch('/api/storage/upload', {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            const imageUrl = result.url;
            console.log('[Storyboard] Image uploaded successfully:', imageUrl.substring(0, 80) + '...');

            // 3. Update scene with Supabase URL
            setScenes(prev => prev.map(s =>
                s.id === sceneId ? { ...s, imageUrl, imageStatus: 'complete' as const } : s
            ));
        } catch (e: any) {
            console.error('Image upload error:', e);
            alert('이미지 업로드 중 오류: ' + e.message);
        }
    };

    const handleDrop = (e: React.DragEvent, sceneId: string) => {
        e.preventDefault();
        setDragOverSceneId(null);
        const file = e.dataTransfer.files[0];
        if (file) {
            handleExternalImageUpload(sceneId, file);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, sceneId: string) => {
        const file = e.target.files?.[0];
        if (file) {
            handleExternalImageUpload(sceneId, file);
        }
        e.target.value = ''; // Reset for re-selecting same file
    };

    // Load styles from DB
    useEffect(() => {
        const fetchStylesAndScenes = async () => {
            try {
                // Restore Script
                const passedScript = localStorage.getItem('tubiq_current_script');
                if (passedScript) setGlobalScript(passedScript);

                // Restore Negative Prompt
                const savedNegativePrompt = localStorage.getItem('tubiq_negative_prompt');
                if (savedNegativePrompt) setNegativePrompt(savedNegativePrompt);

                // Restore Selected Style
                const savedStyleId = localStorage.getItem('tubiq_selected_style_id');
                if (savedStyleId) setSelectedStyleId(savedStyleId);

                // Fetch Custom Styles
                const res = await fetch('/api/storyboard/styles');
                if (res.ok) {
                    const dbStyles = await res.json();

                    if (dbStyles.length === 0) {
                        // SEED: First time, save defaults to DB
                        console.log("Seeding default styles to DB...");
                        await fetch('/api/storyboard/styles', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(DEFAULT_STYLES.map((s, i) => ({ ...s, sort_order: i })))
                        });
                        setArtStyles(DEFAULT_STYLES);
                    } else {
                        const mappedStyles = dbStyles.map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            prompt: s.prompt,
                            previewColor: s.preview_color || s.previewColor || 'bg-gray-500'
                        }));
                        setArtStyles(mappedStyles);

                        // If selected style doesn't exist anymore, fallback
                        if (savedStyleId && !mappedStyles.find((s: any) => s.id === savedStyleId)) {
                            setSelectedStyleId(mappedStyles[0]?.id || 'cinematic');
                        }
                    }
                }

                // Fetch Scenes
                const resScenes = await fetch('/api/storyboard/scenes');
                if (resScenes.ok) {
                    const dbScenes = await resScenes.json();
                    const mappedScenes: Scene[] = dbScenes.map((s: any) => ({
                        id: s.id,
                        script: s.script || '',
                        imagePrompt: s.image_prompt || '',
                        imagePromptKo: s.image_prompt_ko || '',
                        videoPrompt: s.video_prompt || 'smooth camera movement, cinematic',
                        imageUrl: s.image_url,
                        videoUrl: s.video_url,
                        imageStatus: s.image_url ? 'complete' : 'idle',
                        videoStatus: s.video_url ? 'complete' : 'idle'
                    }));
                    setScenes(mappedScenes);
                }

            } catch (e) {
                console.error("Failed to load styles or scenes", e);
            }
        };
        fetchStylesAndScenes();
    }, []);

    // Save Preference to localStorage
    useEffect(() => {
        localStorage.setItem('tubiq_negative_prompt', negativePrompt);
        localStorage.setItem('tubiq_selected_style_id', selectedStyleId);
    }, [negativePrompt, selectedStyleId]);

    // Check Grok account status on mount (safe, non-blocking)
    useEffect(() => {
        const checkGrokStatus = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

                const res = await fetch('/api/grok/status', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    setGrokStatus('disconnected');
                    return;
                }

                const data = await res.json();
                if (data.ok) {
                    setGrokAccounts(data.accounts || []);
                    setGrokStatus(data.hasConnectedAccount ? 'connected' : 'disconnected');
                } else {
                    setGrokStatus('disconnected');
                }
            } catch (error) {
                // Silently fail - Grok status check is not critical
                console.warn('Grok status check skipped:', error);
                setGrokStatus('disconnected');
            }
        };
        checkGrokStatus();
    }, []);

    // Grok Account Handlers
    const handleConnectGrok = async () => {
        setIsGrokConnecting(true);
        // Reset status to checking while connecting
        setGrokStatus('checking');

        try {
            const res = await fetch('/api/grok/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();

            if (data.ok) {
                // Refresh account list
                const statusRes = await fetch('/api/grok/status');
                const statusData = await statusRes.json();
                if (statusData.ok) {
                    setGrokAccounts(statusData.accounts || []);
                    setGrokStatus('connected');
                }
                alert('Grok 계정이 연결되었습니다!');
            } else {
                console.error('Grok connection failed:', data.error);
                alert('Grok 연결 실패: ' + (data.error || '로그인이 완료되지 않았습니다.'));
                setGrokStatus('disconnected');
            }
        } catch (error) {
            console.error('Grok connection error:', error);
            alert('Grok 연결 중 오류가 발생했습니다.');
            setGrokStatus('disconnected');
        } finally {
            setIsGrokConnecting(false);
        }
    };

    const handleCancelGrokConnect = () => {
        setIsGrokConnecting(false);
        setGrokStatus('disconnected');
    };

    // Style Handlers
    const handleAddStyle = async () => {
        if (!newStyleName.trim() || !newStylePrompt.trim()) return;

        const newStyle = {
            id: `custom-${crypto.randomUUID().slice(0, 8)}`,
            name: newStyleName,
            prompt: newStylePrompt,
            previewColor: newStyleColor
        };

        // UI Optimistic Update
        const updatedStyles = [...artStyles, newStyle];
        setArtStyles(updatedStyles);

        setNewStyleName('');
        setNewStylePrompt('');
        setIsManageStylesOpen(false);
        setSelectedStyleId(newStyle.id);

        // Save to DB
        try {
            await fetch('/api/storyboard/styles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStyle)
            });
        } catch (e) {
            console.error("Failed to save style", e);
            alert("스타일 저장 실패 (새로고침 시 사라질 수 있습니다)");
        }
    };

    const handleDeleteStyle = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('이 스타일을 삭제하시겠습니까? (DB에서도 삭제됩니다)')) {
            // UI Optimistic Update
            const newStyles = artStyles.filter(s => s.id !== id);
            setArtStyles(newStyles);
            if (selectedStyleId === id) setSelectedStyleId(newStyles[0]?.id || '');

            // Delete from DB
            try {
                await fetch(`/api/storyboard/styles?id=${id}`, { method: 'DELETE' });
            } catch (e) {
                console.error("Failed to delete style", e);
            }
        }
    };

    // Edit Style Handlers
    const handleOpenEdit = (style: PromptStyle) => {
        setEditingStyle(style);
        setEditName(style.name);
        setEditPrompt(style.prompt);
        setEditColor(style.previewColor);
    };

    const handleSaveEdit = async () => {
        if (!editingStyle) return;

        const updatedStyle = {
            ...editingStyle,
            name: editName,
            prompt: editPrompt,
            previewColor: editColor
        };

        // UI Optimistic Update
        setArtStyles(artStyles.map(s => s.id === editingStyle.id ? updatedStyle : s));

        // Save to DB
        try {
            await fetch('/api/storyboard/styles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updates: [{
                        id: editingStyle.id,
                        name: editName,
                        prompt: editPrompt,
                        preview_color: editColor
                    }]
                })
            });
        } catch (e) {
            console.error("Failed to save edit", e);
            alert("수정 동기화 실패 (새로고침 시 복구될 수 있습니다)");
        }

        setEditingStyle(null);
    };

    const handleCreateStoryboard = async () => {
        if (!globalScript) return alert('대본을 입력해주세요.');

        setIsProcessing(true);
        try {
            const style = artStyles.find(s => s.id === selectedStyleId);

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/storyboard/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    script: globalScript,
                    style: selectedStyleId,
                    stylePrompt: style?.prompt,
                    userInstructions: `Negative Prompt: ${negativePrompt}. Aspect Ratio: ${aspectRatio}. Sampler: ${sampler}`,
                    sceneMode: sceneMode,  // 'auto' | 'sentence' | 'fixed'
                    sceneCount: sceneCount // only used when sceneMode is 'fixed'
                })
            });

            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();
            if (data.ok && data.scenes) {
                // Assign unique IDs to new scenes
                const newScenes = data.scenes.map((s: any) => ({
                    ...s,
                    id: crypto.randomUUID(), // Ensure unique key
                    imageStatus: 'idle', // New scenes start as idle for image generation
                    videoStatus: 'idle' // New scenes start as idle for video generation
                }));
                setScenes(newScenes);
                setIsSettingsOpen(false);
            } else {
                throw new Error(data.message || 'Failed to parse scenes');
            }

        } catch (e: any) {
            alert('스토리보드 생성 실패: ' + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // CRUD Ops
    // ... (existing CRUD)

    // --- DnD Logic ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setArtStyles((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update DB order for all items
                const updates = newItems
                    .map((item, index) => ({ id: item.id, sort_order: index }));

                if (updates.length > 0) {
                    fetch('/api/storyboard/styles', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ updates })
                    }).catch(e => console.error("Failed to save order", e));
                }
                return newItems;
            });
        }
    };

    const SortableStyleCard = ({ style, selected, onSelect, onDelete, onEdit }: any) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: style.id });

        const styleObj = {
            transform: CSS.Transform.toString(transform),
            transition,
            zIndex: isDragging ? 50 : 'auto',
            opacity: isDragging ? 0.5 : 1,
        };

        const isDefault = !style.id.startsWith('custom-');

        return (
            <div ref={setNodeRef} style={styleObj} className="relative group h-full">
                <div
                    {...attributes}
                    {...listeners}
                    onClick={onSelect}
                    onDoubleClick={() => onEdit(style)}
                    suppressHydrationWarning
                    className={`relative w-full p-4 rounded-xl text-left transition-all duration-300 overflow-hidden cursor-grab active:cursor-grabbing flex flex-col justify-between min-h-[85px] h-full
                        ${selected
                            ? 'bg-white ring-2 ring-indigo-500 shadow-xl scale-[1.02] z-10'
                            : 'bg-white/60 hover:bg-white hover:shadow-lg border border-gray-200/50 hover:border-gray-300/50 hover:scale-[1.01]'
                        }`}
                >
                    <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-10 transition-opacity group-hover:opacity-15 ${style.previewColor}`} />

                    {/* Delete Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(style.id, e); }}
                        className="absolute top-1.5 right-1.5 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
                        title="삭제"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <span className={`relative z-10 text-xs font-bold block pr-2 mb-1 ${selected ? 'text-indigo-900' : 'text-gray-800'}`}>
                        {style.name}
                    </span>

                    <span className="relative z-10 text-[10px] text-gray-500 line-clamp-2 leading-relaxed font-medium">
                        {style.prompt}
                    </span>

                    {selected && (
                        <div className="absolute bottom-3 right-3 text-indigo-500">
                            <Check className="h-5 w-5 drop-shadow-sm" />
                        </div>
                    )}
                </div>
            </div>
        );
    };
    const handleAddScene = () => {
        const newScene: Scene = {
            id: crypto.randomUUID(),
            script: '',
            imagePrompt: '',
            imagePromptKo: '',
            videoPrompt: 'smooth camera movement, cinematic',
            imageStatus: 'idle',
            videoStatus: 'idle'
        };
        setScenes([...scenes, newScene]);
    };

    const handleDeleteScene = (id: string) => {
        if (confirm('삭제하시겠습니까?')) setScenes(scenes.filter(s => s.id !== id));
    };

    const handleUpdateScene = (id: string, field: keyof Scene, value: string) => {
        setScenes(scenes.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    // --- AI Auto Edit Logic ---
    const handleAutoEdit = () => {
        // 1. Gather all generated videos
        const videoScenes = scenes.filter(s => s.videoUrl && s.videoStatus === 'completed');

        if (videoScenes.length === 0) {
            alert('생성된 영상이 없습니다. 영상을 먼저 생성해주세요.');
            return;
        }

        // 2. Construct Video Clips (Sequential)
        const clips = videoScenes.map((s, index) => ({
            id: crypto.randomUUID(),
            src: s.videoUrl!,
            type: 'video',
            name: `Scene ${index + 1}`,
            startOffset: index * 4, // Default 4s duration per clip
            duration: 4,
            layer: 0,
            trackId: 'main-track'
        }));

        // 3. Construct Subtitles from Scripts
        const subtitles = videoScenes.map((s, index) => ({
            id: crypto.randomUUID(),
            text: s.script,
            start: index * 4,
            end: (index * 4) + 4
        }));

        // 4. Save to LocalStorage
        const projectData = {
            videoClips: clips,
            subtitles: subtitles
        };
        localStorage.setItem('tubiq-edit-project', JSON.stringify(projectData));

        // 5. Redirect to Subtitle Maker
        router.push('/subtitle-maker');
    };

    const isChainRunning = useRef(false);

    const handleGenerateImages = async () => {
        if (isGeneratingImages || isChainRunning.current) return;
        isChainRunning.current = true;

        let currentScenes = [...scenes];
        const scenesToProcess = currentScenes.filter(s => s.imageStatus !== 'generating');

        if (scenesToProcess.length === 0) {
            alert('생성할 장면이 없습니다. (모든 장면이 처리 중입니다)');
            return;
        }

        // Check Grok connection if using Grok engine
        if (imageEngine === 'grok' && grokStatus !== 'connected') {
            const connect = confirm('Grok 계정이 연결되지 않았습니다. 지금 연결하시겠습니까?');
            if (connect) {
                await handleConnectGrok();
                return;
            }
            return;
        }

        // Create AbortController for cancellation
        imageAbortRef.current = new AbortController();
        setIsGeneratingImages(true);

        // Mark all as processing
        currentScenes = currentScenes.map(s => scenesToProcess.find(p => p.id === s.id) ? { ...s, imageStatus: 'generating' } : s);
        setScenes(currentScenes);

        for (const scene of scenesToProcess) {
            // Check if cancelled
            if (imageAbortRef.current?.signal.aborted) {
                currentScenes = currentScenes.map(s =>
                    s.imageStatus === 'generating' ? { ...s, imageStatus: 'idle' } : s
                );
                setScenes(currentScenes);
                break;
            }

            try {
                const style = artStyles.find(s => s.id === selectedStyleId);
                const fullPrompt = `${style?.prompt || ''}, ${scene.imagePrompt}`;

                // Choose API endpoint based on image engine
                const apiEndpoint = imageEngine === 'grok'
                    ? '/api/storyboard/generate-image-grok'
                    : '/api/storyboard/generate-image';

                const res = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: fullPrompt,
                        negative_prompt: negativePrompt,
                        aspectRatio: aspectRatio,
                        sampler: sampler,
                        seed: Math.floor(Math.random() * 1000000000)
                    }),
                    signal: imageAbortRef.current?.signal
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    try {
                        const errorJson = JSON.parse(errorText);
                        throw new Error(errorJson.error || errorJson.message || errorText);
                    } catch (e) {
                        throw new Error(`API Error: ${errorText}`);
                    }
                }
                const data = await res.json();

                if (data.ok && data.imageUrl) {
                    currentScenes = currentScenes.map(s => s.id === scene.id ? {
                        ...s,
                        imageStatus: 'complete',
                        imageUrl: data.imageUrl
                    } : s);
                    setScenes(currentScenes);
                } else {
                    throw new Error(data.error || 'Unknown error');
                }

            } catch (e: any) {
                if (e.name === 'AbortError') {
                    console.log('Image generation cancelled');
                    currentScenes = currentScenes.map(s => s.id === scene.id ? { ...s, imageStatus: 'idle' } : s);
                    setScenes(currentScenes);
                } else {
                    console.error("Image Gen Error", e);
                    currentScenes = currentScenes.map(s => s.id === scene.id ? { ...s, imageStatus: 'error' } : s);
                    setScenes(currentScenes);
                }
            }
        }

        const wasAborted = imageAbortRef.current?.signal.aborted;
        setIsGeneratingImages(false);
        imageAbortRef.current = null;

        // One-Stop Automation: Chain to Video Generation
        if (isAutoGenerate && !wasAborted) {
            console.error('[DEBUG] Auto-Generation enabled. Chaining to Video Generation...');
            await handleGenerateVideos(currentScenes);
        }
        isChainRunning.current = false;
    };

    const handleCancelImageGeneration = () => {
        if (imageAbortRef.current) {
            imageAbortRef.current.abort();
            setScenes(prev => prev.map(s =>
                s.imageStatus === 'generating' ? { ...s, imageStatus: 'idle' } : s
            ));
            setIsGeneratingImages(false);
        }
    };



    const handleCancelVideoGeneration = () => {
        if (videoAbortRef.current) {
            videoAbortRef.current.abort();
            setScenes(prev => prev.map(s =>
                s.videoStatus === 'generating' ? { ...s, videoStatus: 'idle' } : s
            ));
            setIsGeneratingVideos(false);
        }
    };

    const handleCancelSingleVideo = async (jobId: string, sceneId: string) => {
        try {
            // 1. Tell the backend to cancel
            await fetch('/api/worker/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId })
            });

            // 2. Update local state
            setScenes(prev => prev.map(s =>
                s.id === sceneId ? { ...s, videoStatus: 'idle' } : s
            ));
        } catch (e) {
            console.error('Failed to cancel single video:', e);
        }
    };

    const handleCancelSingleImage = (sceneId: string) => {
        // Since image generation is a serial loop in the frontend, 
        // "cancelling" a single one effectively just stops the whole loop 
        // if we are currently on that one, or we can just set its status back to idle.
        setScenes(prev => prev.map(s =>
            s.id === sceneId ? { ...s, imageStatus: 'idle' } : s
        ));
    };

    // Smart Regenerate with Gemini Vision
    const handleSmartRegenerate = async () => {
        if (!regenerateScene || !regenerateScene.imageUrl) return;

        setIsRegenerating(true);

        try {
            // 1. Call Gemini to fix the prompt
            const fixRes = await fetch('/api/storyboard/fix-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: regenerateScene.imageUrl,
                    originalPrompt: regenerateScene.imagePrompt,
                    issueType: regenerateIssue,
                    userDescription: regenerateDescription
                })
            });

            if (!fixRes.ok) {
                const errorData = await fixRes.json().catch(() => ({ message: fixRes.statusText }));
                throw new Error(errorData.message || `프롬프트 수정 실패 (${fixRes.status})`);
            }

            const fixData = await fixRes.json();
            if (!fixData.ok || !fixData.fixedPrompt) throw new Error(fixData.message || '프롬프트 수정 실패');

            const fixedPrompt = fixData.fixedPrompt;
            const sceneId = regenerateScene.id;

            // 2. Update the scene with fixed prompt
            setScenes(prev => prev.map(s => s.id === sceneId ? {
                ...s,
                imagePrompt: fixedPrompt,
                imageStatus: 'generating'
            } : s));

            // Close modal
            setRegenerateScene(null);
            setRegenerateDescription('');

            // 3. Regenerate image with fixed prompt
            const style = artStyles.find(s => s.id === selectedStyleId);
            const fullPrompt = `${style?.prompt || ''}, ${fixedPrompt}`;

            const res = await fetch('/api/storyboard/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: fullPrompt,
                    negative_prompt: negativePrompt,
                    aspectRatio: aspectRatio,
                    sampler: sampler,
                    seed: Math.floor(Math.random() * 1000000000)
                })
            });

            if (!res.ok) throw new Error('이미지 재생성 실패');

            const data = await res.json();

            if (data.ok && data.imageUrl) {
                setScenes(prev => prev.map(s => s.id === sceneId ? {
                    ...s,
                    imageStatus: 'complete',
                    imageUrl: data.imageUrl
                } : s));
            } else {
                throw new Error(data.error || 'Unknown error');
            }

        } catch (e: any) {
            console.error("Smart Regenerate Error", e);
            alert('재생성 실패: ' + e.message);
        } finally {
            setIsRegenerating(false);
        }
    };

    // Video Job Polling
    useEffect(() => {
        const checkJobs = async () => {
            const generatingScenes = scenes.filter(s => s.videoStatus === 'generating' && s.jobId);
            if (generatingScenes.length === 0) return;

            const jobIds = generatingScenes.map(s => s.jobId);

            try {
                const { data: jobs, error } = await supabase
                    .from('video_queue')
                    .select('*')
                    .in('id', jobIds);

                if (error) {
                    console.error('Polling error', error);
                    return;
                }

                if (jobs && jobs.length > 0) {
                    let hasUpdates = false;
                    const updatedScenes = scenes.map(scene => {
                        const job = jobs.find((j: any) => j.id === scene.jobId);
                        if (!job) return scene;

                        if (job.status === 'completed') {
                            hasUpdates = true;
                            console.log('[Polling] Job completed:', job.id, 'video_url:', job.video_url?.substring(0, 100));
                            return {
                                ...scene,
                                videoStatus: 'complete' as const,
                                videoUrl: job.video_url || job.video_path // Fallback to path if needed, but URL preferred
                            };
                        } else if (job.status === 'failed') {
                            hasUpdates = true;
                            return {
                                ...scene,
                                videoStatus: 'error' as const
                            };
                        }
                        return scene;
                    });

                    if (hasUpdates) {
                        setScenes(updatedScenes);
                    }
                }
            } catch (e) {
                console.error('Polling exception', e);
            }
        };

        const interval = setInterval(checkJobs, 3000); // Check every 3 seconds
        return () => clearInterval(interval);
    }, [scenes]);

    const handleGenerateVideos = async (overrideScenes?: typeof scenes) => {
        // Find scenes that have an image but no video
        const scenesToList = overrideScenes || scenes;
        const targetScenes = scenesToList.filter(s => s.imageUrl && (!s.videoUrl || s.videoStatus === 'error'));

        if (targetScenes.length === 0) {
            alert('이미지가 생성된 씬이 없거나, 이미 모든 씬에 영상이 있습니다.');
            return;
        }

        setIsGeneratingVideos(true);
        videoAbortRef.current = new AbortController();

        try {
            // SEQUENTIAL PROCESSING (User Request)
            for (const scene of targetScenes) {
                // Check if cancelled
                if (videoAbortRef.current?.signal.aborted) break;

                const prompt = scene.videoPrompt || "Animate this image with natural motion, high quality, 4k";

                // 1. Submit Video Job
                console.error(`[DEBUG] Submitting video job for Scene ${scenesToList.indexOf(scene) + 1}...`);
                const res = await fetch('/api/grok/generate-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: scene.imageUrl,
                        prompt: prompt
                    }),
                    signal: videoAbortRef.current?.signal
                });

                if (!res.ok) {
                    console.error('Queue failed for scene', scene.id);
                    setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, videoStatus: 'error' } : s));
                    continue; // Skip to next scene even on error
                }

                const data = await res.json();
                if (data.success && data.jobId) {
                    // Update scene with jobId and 'generating' status
                    setScenes(prev => prev.map(s => s.id === scene.id ? {
                        ...s,
                        videoStatus: 'generating',
                        jobId: data.jobId
                    } : s));

                    // 2. WAIT FOR COMPLETION before moving to next (Sequential)
                    console.error(`[DEBUG] Waiting for Scene ${scenesToList.indexOf(scene) + 1} to finish...`);

                    let isFinished = false;
                    const timeout = 300000; // 5 minute max per scene
                    const start = Date.now();

                    while (!isFinished && (Date.now() - start < timeout)) {
                        // Check cancellation
                        if (videoAbortRef.current?.signal.aborted) break;

                        // We check the 'scenes' state indirectly or use a small delay 
                        // The global useEffect already polls the DB, so we just need to wait 
                        // for the status in the main state to change.
                        // However, accessing 'scenes' here might be stale due to closure.
                        // Best way: Use a separate check or just wait for the state to reflect 'complete'

                        await new Promise(resolve => setTimeout(resolve, 3000));

                        // We use a functional update to check the current state
                        let currentStatus = 'generating';
                        setScenes(prev => {
                            const s = prev.find(ps => ps.id === scene.id);
                            currentStatus = s?.videoStatus || 'error';
                            return prev;
                        });

                        if (currentStatus === 'complete' || currentStatus === 'error') {
                            isFinished = true;
                            console.error(`[DEBUG] Scene ${scenesToList.indexOf(scene) + 1} finished with status: ${currentStatus}`);
                        }
                    }
                } else {
                    setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, videoStatus: 'error' } : s));
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Video generation cancelled');
            } else {
                console.error('Video Generation Error:', error);
                alert('영상 생성 요청 중 오류가 발생했습니다.');
            }
        } finally {
            setIsGeneratingVideos(false);
            videoAbortRef.current = null;
        }
    };

    // Layout Config
    const getLayoutConfig = (ratio: string) => {
        switch (ratio) {
            case '16:9': return { widthClass: 'sm:w-[320px]', aspectClass: 'aspect-video' };
            case '1:1': return { widthClass: 'sm:w-[260px]', aspectClass: 'aspect-square' };
            case '2.35:1': return { widthClass: 'sm:w-[360px]', aspectClass: 'aspect-[21/9]' };
            case '9:16':
            default: return { widthClass: 'sm:w-[200px]', aspectClass: 'aspect-[9/16]' };
        }
    };
    const layoutConfig = getLayoutConfig(aspectRatio);

    return (
        <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-sans text-gray-900">
            <Header />

            <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:px-6 lg:px-8 flex flex-col gap-6">

                {/* 1. Configuration Panel */}
                <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-lg overflow-hidden max-w-7xl mx-auto w-full transition-all duration-300">
                    <div
                        className="p-6 flex justify-between items-center cursor-pointer hover:bg-white/40 transition-colors"
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm border border-indigo-50">
                                <Settings className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 tracking-tight">프로젝트 설정 & 대본 입력</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    제트이미지엔진(RunPod + ComfyUI) 설정을 구성합니다.
                                </p>
                            </div>
                        </div>
                        <div className={`p-2.5 rounded-full bg-white/80 shadow-sm border border-gray-100 transition-transform duration-300 ${isSettingsOpen ? 'rotate-180' : ''}`}>
                            <ChevronDown className="h-5 w-5 text-gray-600" />
                        </div>
                    </div>

                    {isSettingsOpen && (
                        <div className="p-8 border-t border-gray-100/50 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                                {/* Left: Style & Engine Settings */}
                                <div className="space-y-8">

                                    {/* Style Section */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="text-base font-bold text-gray-800 flex items-center gap-2">
                                                <div className="p-1.5 bg-indigo-100 rounded-lg"><Paintbrush className="h-4 w-4 text-indigo-600" /></div>
                                                아트 스타일 선택
                                            </label>
                                            <button
                                                onClick={() => setIsManageStylesOpen(true)}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white border border-indigo-100 px-4 py-2 rounded-full hover:bg-indigo-50 transition-all shadow-sm hover:shadow"
                                            >
                                                + 스타일 추가
                                            </button>
                                        </div>

                                        {/* Style adding form overlay */}
                                        {isManageStylesOpen && (
                                            <div className="mb-6 p-5 bg-white rounded-2xl border border-gray-200 shadow-xl animate-in fade-in zoom-in-95 space-y-4 relative z-20">
                                                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                                    <h4 className="text-sm font-bold text-gray-900">새 스타일 추가</h4>
                                                    <button onClick={() => setIsManageStylesOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"><X className="h-4 w-4" /></button>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 mb-1 block">스타일 이름</label>
                                                    <input
                                                        placeholder="예: 사이버펑크 네온"
                                                        value={newStyleName}
                                                        onChange={(e) => setNewStyleName(e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 mb-1 block">프롬프트 (영어)</label>
                                                    <textarea
                                                        placeholder="Cyberpunk style, neon lights, night city..."
                                                        value={newStylePrompt}
                                                        onChange={(e) => setNewStylePrompt(e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs h-24 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-mono text-gray-600 leading-relaxed"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 mb-1 block">대표 색상</label>
                                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                        {PREVIEW_COLORS.map(c => (
                                                            <button
                                                                key={c.value}
                                                                onClick={() => setNewStyleColor(c.value)}
                                                                className={`w-8 h-8 rounded-full shrink-0 ${c.value} transition-transform hover:scale-110 ${newStyleColor === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleAddStyle}
                                                    disabled={!newStyleName || !newStylePrompt}
                                                    className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-[0.98]"
                                                >
                                                    스타일 저장
                                                </button>
                                            </div>
                                        )}

                                        <DndContext id="storyboard-styles-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={artStyles.map(s => s.id)} strategy={rectSortingStrategy}>
                                                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 p-1 transition-all duration-300 ${isStylesExpanded ? 'max-h-[600px]' : 'max-h-[105px]'} overflow-hidden`}>
                                                    {artStyles.map((style) => (
                                                        <SortableStyleCard
                                                            key={style.id}
                                                            style={style}
                                                            selected={selectedStyleId === style.id}
                                                            onSelect={() => setSelectedStyleId(style.id)}
                                                            onDelete={handleDeleteStyle}
                                                            onEdit={handleOpenEdit}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>

                                        {/* Expand/Collapse Button */}
                                        <button
                                            onClick={() => setIsStylesExpanded(!isStylesExpanded)}
                                            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
                                        >
                                            {isStylesExpanded ? (
                                                <>접기 <ChevronUp className="h-4 w-4" /></>
                                            ) : (
                                                <>더보기 ({artStyles.length}개 스타일) <ChevronDown className="h-4 w-4" /></>
                                            )}
                                        </button>
                                    </div>

                                    {/* Advanced Settings Section */}
                                    <div className="p-7 bg-white/40 rounded-3xl border border-white/60 shadow-inner backdrop-blur-sm space-y-6">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 flex items-center gap-2">
                                            <Settings className="h-3 w-3" /> Engine Settings
                                        </h3>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-600 ml-1">화면 비율</label>
                                                <GlassDropdown
                                                    value={aspectRatio}
                                                    onChange={setAspectRatio}
                                                    options={ASPECT_RATIOS}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-600 ml-1">샘플러</label>
                                                <GlassDropdown
                                                    value={sampler}
                                                    onChange={setSampler}
                                                    options={SAMPLERS}
                                                />
                                            </div>
                                        </div>

                                        {/* Negative Prompt - Collapsible */}
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => setIsNegativePromptOpen(!isNegativePromptOpen)}
                                                className="flex items-center gap-2 text-xs font-bold text-gray-600 ml-1 hover:text-gray-800 transition-colors"
                                            >
                                                {isNegativePromptOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                네거티브 프롬프트
                                                <span className="text-gray-400 font-normal">({negativePrompt.length}자)</span>
                                            </button>
                                            {isNegativePromptOpen && (
                                                <textarea
                                                    value={negativePrompt}
                                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                                    placeholder="text, watermark, blurry, low quality..."
                                                    className="w-full p-4 rounded-2xl bg-white/60 border border-gray-200/80 focus:border-indigo-400 shadow-sm backdrop-blur-md text-xs h-20 resize-none outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-gray-700 font-mono leading-relaxed animate-in slide-in-from-top-2"
                                                />
                                            )}
                                        </div>

                                        {/* Scene Split Mode */}
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-600 ml-1">장면 분할 방식</label>
                                            <div className="flex gap-2 flex-wrap">
                                                <button
                                                    onClick={() => setSceneMode('auto')}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sceneMode === 'auto'
                                                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                                                        : 'bg-white/60 text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    자동 (AI 판단)
                                                </button>
                                                <button
                                                    onClick={() => setSceneMode('sentence')}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sceneMode === 'sentence'
                                                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                                                        : 'bg-white/60 text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    문장당 1장면
                                                </button>
                                                <button
                                                    onClick={() => setSceneMode('fixed')}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sceneMode === 'fixed'
                                                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                                                        : 'bg-white/60 text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    고정 개수
                                                </button>
                                            </div>

                                            {/* Scene Count Selector - Only show when fixed mode */}
                                            {sceneMode === 'fixed' && (
                                                <div className="flex items-center gap-3 mt-3 animate-in slide-in-from-top-2">
                                                    <span className="text-xs font-bold text-gray-600">장면 개수:</span>
                                                    <div className="flex items-center gap-1 bg-white/60 rounded-xl p-1 border border-gray-200">
                                                        {[3, 4, 5, 6, 8, 10, 12, 15, 16, 18, 20].map(num => (
                                                            <button
                                                                key={num}
                                                                onClick={() => setSceneCount(num)}
                                                                className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${sceneCount === num
                                                                    ? 'bg-indigo-500 text-white shadow-md'
                                                                    : 'text-gray-600 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                {num}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Script Input */}
                                <div className="flex flex-col h-full bg-white/50 rounded-[2rem] border border-white/60 shadow-sm overflow-hidden">
                                    <div className="flex-1 flex flex-col p-6">
                                        <label className="text-base font-bold text-gray-800 mb-4 flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <div className="p-1.5 bg-indigo-100 rounded-lg"><MonitorPlay className="h-4 w-4 text-indigo-600" /></div>
                                                전체 대본 (Global Script)
                                            </span>
                                            <span className="px-3 py-1 bg-white rounded-full text-xs font-bold text-gray-500 shadow-sm border border-gray-100">{globalScript.length}자</span>
                                        </label>
                                        <div className="flex-1 relative group rounded-2xl overflow-hidden border border-gray-200/60 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all bg-white/60">
                                            <textarea
                                                value={globalScript}
                                                onChange={(e) => setGlobalScript(e.target.value)}
                                                placeholder="이곳에 영상으로 만들 전체 대본을 입력하세요..."
                                                className="w-full h-full p-6 bg-transparent text-sm leading-8 outline-none resize-none placeholder-gray-400 text-gray-800"
                                            />
                                        </div>
                                        <button
                                            onClick={handleCreateStoryboard}
                                            disabled={!globalScript || isProcessing}
                                            className="mt-6 w-full py-4 bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                        >
                                            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                            {isProcessing ? '대본 분석 및 장면 생성 중...' : '스토리보드 장면 자동 생성'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Actions Bar (Sticky) */}
                {scenes.length > 0 && (
                    <div className="sticky top-[64px] z-40 max-w-7xl mx-auto w-full py-4">
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h2 className="text-xl font-bold text-gray-900 px-2 flex items-center gap-2">
                                <span className="w-2 h-8 bg-indigo-500 rounded-full inline-block"></span>
                                {scenes.length} <span className="text-gray-400 font-normal">Scenes</span>
                            </h2>
                            <div className="flex items-center gap-2">
                                {/* Image Engine Toggle - Compact */}
                                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setImageEngine('comfyui')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${imageEngine === 'comfyui'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        ComfyUI
                                    </button>
                                    <button
                                        onClick={() => setImageEngine('grok')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${imageEngine === 'grok'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        <Zap className="h-3 w-3" />
                                        Grok
                                        {imageEngine === 'grok' && (
                                            <span className={`w-1.5 h-1.5 rounded-full ${grokStatus === 'connected' ? 'bg-green-500' :
                                                grokStatus === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                                                }`} />
                                        )}
                                    </button>
                                </div>

                                {/* Grok Connect Button - Only when needed */}
                                {imageEngine === 'grok' && (
                                    <>
                                        {grokStatus !== 'connected' ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleConnectGrok}
                                                    disabled={isGrokConnecting}
                                                    className={`
                                                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm
                                                        ${isGrokConnecting
                                                            ? 'bg-yellow-50 text-yellow-600 border border-yellow-200 cursor-not-allowed'
                                                            : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
                                                        }
                                                    `}
                                                >
                                                    {isGrokConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link className="h-3 w-3" />}
                                                    {isGrokConnecting ? '연결중' : '연결'}
                                                </button>

                                                {isGrokConnecting && (
                                                    <button
                                                        onClick={handleCancelGrokConnect}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm bg-white text-red-500 border border-red-200 hover:bg-red-50 hover:text-red-600"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (confirm('Grok 연결을 해제하고 다시 연결하시겠습니까?')) {
                                                        setGrokStatus('disconnected');
                                                    }
                                                }}
                                                className="px-2 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-50 hover:text-red-500 transition-all"
                                                title="연결 해제 및 재연결"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                            </button>
                                        )}
                                        {/* Local Worker Widget */}
                                        <GrokWorkerControl />
                                    </>
                                )}

                                {/* Auto-Generation Toggle (User Request) */}
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 shadow-sm ml-2">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider leading-none">automation</span>
                                        <span className="text-xs font-bold text-indigo-700">자동 생성</span>
                                    </div>
                                    <button
                                        onClick={() => setIsAutoGenerate(!isAutoGenerate)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-transparent ring-offset-2 ${isAutoGenerate ? 'bg-indigo-600' : 'bg-gray-200'}`}
                                    >
                                        <span
                                            className={`${isAutoGenerate ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                        />
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="w-px h-6 bg-gray-200 mx-1" />

                                {/* Action Buttons - Larger with Cancel Support */}
                                {isGeneratingImages ? (
                                    <button
                                        onClick={handleCancelImageGeneration}
                                        className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 animate-pulse"
                                    >
                                        <Square className="h-4 w-4" />
                                        생성 중지
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleGenerateImages}
                                        className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        이미지생성
                                    </button>
                                )}
                                {isGeneratingVideos ? (
                                    <button
                                        onClick={handleCancelVideoGeneration}
                                        className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 animate-pulse"
                                    >
                                        <Square className="h-4 w-4" />
                                        생성 중지
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleGenerateVideos()}
                                        className={`px-5 py-2.5 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95 ${videoEngine === 'grok'
                                            ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700'
                                            : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600'
                                            }`}
                                    >
                                        {videoEngine === 'grok' ? <Zap className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                                        영상생성
                                    </button>
                                )}
                                <button
                                    onClick={handleAutoEdit}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95 ring-2 ring-indigo-500/20"
                                >
                                    <Wand2 className="h-4 w-4" />
                                    AI 자동편집
                                </button>
                            </div>
                        </div>
                    </div>
                )
                }

                {/* 3. Scene Cards Grid (Fixed 2 Columns for better visibility + Apple Glass Style) */}
                {
                    scenes.length === 0 ? (
                        !isProcessing && (
                            <div className="flex flex-col items-center justify-center py-32 text-gray-300">
                                <div className="p-8 bg-white/50 rounded-full mb-6 ring-1 ring-gray-100 shadow-sm backdrop-blur-sm">
                                    <Film className="h-16 w-16 opacity-30 text-gray-900" />
                                </div>
                                <p className="text-xl font-bold text-gray-400">대본을 입력하고 시작해보세요</p>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col gap-6 pb-32 max-w-7xl mx-auto w-full animate-in slide-in-from-bottom-4">
                            {scenes.map((scene, index) => (
                                <div key={scene.id} className="relative bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-row items-start overflow-visible group ring-1 ring-white/80">

                                    {/* Left: Image Preview (Fixed Width 280px, 9:16 Aspect) */}
                                    <div className="w-[280px] aspect-[9/16] shrink-0 bg-gray-50/30 relative border-r border-white/40 flex items-center justify-center p-4 mb-10" style={{ marginTop: '36px' }}>
                                        {/* Badges */}
                                        <div className="absolute top-5 left-5 flex flex-col gap-2 z-10">
                                            <span className="px-3 py-1.5 bg-gray-900/90 backdrop-blur-md text-[11px] font-bold text-white rounded-lg shadow-lg border border-white/10">
                                                SCENE {index + 1}
                                            </span>
                                            <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md text-[10px] font-bold text-gray-900 rounded-lg shadow-lg border border-gray-100 w-fit">
                                                {aspectRatio}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        {scene.imageUrl ? (
                                            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                                                <img src={scene.imageUrl} alt="Scene Preview" className={`w-full h-full object-cover`} />
                                                {/* Clear Image Button (Top Right) */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setScenes(prev => prev.map(s =>
                                                            s.id === scene.id ? { ...s, imageUrl: undefined, imageStatus: 'idle' as const } : s
                                                        ));
                                                    }}
                                                    className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 hover:scale-110 z-10"
                                                    title="이미지 삭제"
                                                >
                                                    <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
                                                </button>
                                                {/* Download Button Overlay */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadImage(scene.imageUrl!, `scene-${index + 1}.png`);
                                                    }}
                                                    className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur-md rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-110 z-10"
                                                    title="이미지 다운로드"
                                                >
                                                    <Save className="h-5 w-5 text-gray-700" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Hidden File Input */}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    hidden
                                                    ref={(el) => { fileInputRefs.current[scene.id] = el; }}
                                                    onChange={(e) => handleFileSelect(e, scene.id)}
                                                />
                                                {/* Drag & Drop / Click to Upload Area */}
                                                <div
                                                    onClick={() => fileInputRefs.current[scene.id]?.click()}
                                                    onDragOver={(e) => { e.preventDefault(); setDragOverSceneId(scene.id); }}
                                                    onDragLeave={() => setDragOverSceneId(null)}
                                                    onDrop={(e) => handleDrop(e, scene.id)}
                                                    className={`flex flex-col items-center gap-4 p-6 text-center cursor-pointer transition-all rounded-2xl border-2 border-dashed ${dragOverSceneId === scene.id
                                                        ? 'border-indigo-500 bg-indigo-50 scale-105'
                                                        : 'border-transparent hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="p-5 rounded-3xl bg-white shadow-sm border border-gray-50">
                                                        <ImageIcon className="h-8 w-8 text-gray-300" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-xs font-bold tracking-widest text-gray-300 block">PREVIEW</span>
                                                        <span className="text-[10px] text-gray-400">클릭 또는 드래그하여 이미지 추가</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Loading Overlay */}
                                        {scene.imageStatus === 'generating' && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-20">
                                                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancelSingleImage(scene.id);
                                                    }}
                                                    className="px-3 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg shadow hover:bg-red-600 transition-all active:scale-95"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}

                                        {/* Smart Regenerate Button */}
                                        {scene.imageUrl && (
                                            <button
                                                onClick={() => {
                                                    setRegenerateScene(scene);
                                                    setRegenerateIssue('duplicate');
                                                    setRegenerateDescription('');
                                                }}
                                                className="absolute bottom-4 left-4 px-3 py-2 bg-amber-500/90 hover:bg-amber-600 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all z-20 hover:scale-105 text-xs font-bold flex items-center gap-1.5"
                                                title="문제 수정 & 재생성"
                                            >
                                                <RefreshCcw className="h-3.5 w-3.5" />
                                                수정 재생성
                                            </button>
                                        )}
                                    </div>

                                    {/* Center: Inputs Area */}
                                    <div className="flex-1 p-7 flex flex-col gap-6 min-w-0 border-r border-white/40">

                                        {/* 1. Script Section (Top) */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                    대본 / 내레이션
                                                </label>
                                            </div>
                                            <div className="p-1 bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-300 transition-all">
                                                <textarea
                                                    value={scene.script}
                                                    onChange={(e) => handleUpdateScene(scene.id, 'script', e.target.value)}
                                                    className="w-full p-3 bg-transparent text-sm text-gray-900 font-bold resize-none outline-none min-h-[2.5rem] leading-7 placeholder-gray-400"
                                                    placeholder="대본 내용..."
                                                    rows={1}
                                                />
                                            </div>
                                        </div>

                                        {/* 2. Image Prompt Section */}
                                        <div className="space-y-2 flex-1">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                                                    이미지 프롬프트 (영어)
                                                </label>
                                                <button className="text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-white hover:shadow-sm transition-all font-bold">
                                                    Copy
                                                </button>
                                            </div>
                                            <textarea
                                                value={scene.imagePrompt}
                                                onChange={(e) => handleUpdateScene(scene.id, 'imagePrompt', e.target.value)}
                                                className="w-full p-4 text-xs bg-white hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-2xl resize-none h-24 font-mono text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all leading-relaxed shadow-sm"
                                                placeholder="Detailed image description..."
                                            />
                                        </div>

                                        {/* 2.5 Image Prompt Section (KR) */}
                                        <div className="space-y-2 flex-1">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-1">
                                                    이미지 프롬프트 (한글)
                                                </label>
                                            </div>
                                            <textarea
                                                value={scene.imagePromptKo || ''}
                                                onChange={(e) => handleUpdateScene(scene.id, 'imagePromptKo', e.target.value)}
                                                className="w-full p-4 text-xs bg-indigo-50 hover:bg-white focus:bg-white border border-indigo-200 rounded-2xl resize-none h-20 font-sans text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all leading-relaxed shadow-sm"
                                                placeholder="이미지 프롬프트 (한글)..."
                                            />
                                        </div>

                                        {/* 3. Video Prompt Section */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                    모션 프롬프트 <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">Camera</span>
                                                </label>
                                            </div>
                                            <input
                                                type="text"
                                                value={scene.videoPrompt}
                                                onChange={(e) => handleUpdateScene(scene.id, 'videoPrompt', e.target.value)}
                                                className="w-full p-4 text-xs bg-rose-50 border border-rose-200 rounded-2xl font-mono text-rose-700 focus:ring-4 focus:ring-pink-500/10 focus:border-rose-400 focus:bg-white outline-none transition-all"
                                                placeholder="Camera movement..."
                                            />
                                        </div>

                                    </div>

                                    {/* Right: Video Area (Fixed Width 280px, 9:16 Aspect) */}
                                    <div className="w-[280px] aspect-[9/16] shrink-0 bg-gray-50/30 flex flex-col items-center border-l border-white/40 p-4 mb-10" style={{ marginTop: '36px' }}>

                                        {/* Video Container: Fills height */}
                                        <div className="w-full h-full flex flex-col">
                                            {(scene.videoUrl || scene.videoStatus === 'generating' || scene.videoStatus === 'error') ? (
                                                <div className={`w-full h-full rounded-2xl overflow-hidden shadow-lg relative group border ${scene.videoStatus === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-black'}`}>
                                                    {scene.videoUrl ? (
                                                        (scene.videoUrl.includes('.webp') || scene.videoUrl.includes('format=webp')) ? (
                                                            <img
                                                                src={scene.videoUrl}
                                                                alt="Generated Video"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <CustomVideoPlayer
                                                                src={scene.videoUrl}
                                                                poster={scene.imageUrl}
                                                            />
                                                        )
                                                    ) : null}

                                                    {/* Video Overlays (Delete & Duration) */}
                                                    {scene.videoUrl && (
                                                        <>
                                                            {/* Duration Badge */}
                                                            <div className="absolute top-4 left-4 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-white text-[10px] font-bold z-10 border border-white/10">
                                                                00:05
                                                            </div>

                                                            {/* Delete Button (X Icon) */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm('이 영상을 삭제하시겠습니까?')) {
                                                                        setScenes(prev => prev.map(s =>
                                                                            s.id === scene.id ? { ...s, videoUrl: undefined, videoStatus: 'idle' as const } : s
                                                                        ));
                                                                    }
                                                                }}
                                                                className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-gray-100 hover:scale-110 z-10"
                                                                title="영상 삭제"
                                                            >
                                                                <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
                                                            </button>

                                                            {/* Download Button */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const link = document.createElement('a');
                                                                    link.href = scene.videoUrl!;
                                                                    link.download = `scene-${index + 1}-video.mp4`;
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    document.body.removeChild(link);
                                                                }}
                                                                className="absolute bottom-16 right-4 p-3 bg-white/90 backdrop-blur-md rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-110 z-10"
                                                                title="영상 다운로드"
                                                            >
                                                                <Save className="h-5 w-5 text-gray-700" />
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* Error State */}
                                                    {scene.videoStatus === 'error' && !scene.videoUrl && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-500 p-4 text-center">
                                                            <div className="p-2 bg-red-100 rounded-full">
                                                                <AlertCircle className="h-6 w-6" />
                                                            </div>
                                                            <span className="text-[10px] font-bold">Generation Failed</span>
                                                            <button
                                                                onClick={() => handleGenerateVideos()}
                                                                className="text-[9px] underline opacity-80 hover:opacity-100"
                                                            >
                                                                Retry
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Generating State - Only when actually generating and no URL yet */}
                                                    {scene.videoStatus === 'generating' && !scene.videoUrl && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                                                            <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="text-[10px] font-bold animate-pulse text-pink-200 text-center px-2">
                                                                    Generating Video<br />({videoEngine === 'grok' ? 'Grok Video' : 'Wan 2.2'})...
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (scene.jobId) handleCancelSingleVideo(scene.jobId, scene.id);
                                                                        else handleUpdateScene(scene.id, 'videoStatus', 'idle');
                                                                    }}
                                                                    className="mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg border border-white/20 backdrop-blur-sm transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-300 p-6 text-center opacity-50">
                                                    <div className="p-4 rounded-3xl bg-white shadow-sm border border-gray-50">
                                                        <Film className="h-6 w-6 text-gray-300" />
                                                    </div>
                                                    <span className="text-[10px] font-bold tracking-widest text-gray-300">NO VIDEO</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scene Delete Button (Top Right of Scene Card) */}
                                    <button
                                        onClick={() => handleDeleteScene(scene.id)}
                                        className="absolute right-5 p-2 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all z-[60] hover:scale-110 border border-gray-100 hover:border-red-200"
                                        style={{ top: '6px' }}
                                        title="씬 삭제"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                </div >
                            ))
                            }

                            {/* Add Button */}
                            <button
                                onClick={handleAddScene}
                                className="min-h-[350px] border-3 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center text-gray-300 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all gap-5 group bg-white/30 backdrop-blur-sm"
                            >
                                <div className="p-6 bg-white rounded-full shadow-lg group-hover:scale-110 group-hover:shadow-indigo-200 transition-all duration-300 border border-gray-50">
                                    <Plus className="h-8 w-8 text-gray-400 group-hover:text-indigo-500" />
                                </div>
                                <span className="font-bold text-lg tracking-tight">Add New Scene</span>
                            </button>
                        </div >
                    )
                }

                {/* Edit Style Modal */}
                {
                    editingStyle && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
                            <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl border border-white/60 animate-in zoom-in-95">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-gray-900">
                                        {editingStyle.id.startsWith('custom-') ? '스타일 편집' : '스타일 복사 & 편집'}
                                    </h3>
                                    <button onClick={() => setEditingStyle(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                {!editingStyle.id.startsWith('custom-') && (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                                        ⚠️ 기본 스타일은 수정할 수 없습니다. 저장 시 **새로운 커스텀 스타일**로 복사됩니다.
                                    </div>
                                )}

                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">스타일 이름</label>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            placeholder="예: 나만의 스타일"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">프롬프트 (영어)</label>
                                        <textarea
                                            value={editPrompt}
                                            onChange={(e) => setEditPrompt(e.target.value)}
                                            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs h-32 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-mono text-gray-600 leading-relaxed"
                                            placeholder="Cinematic, hyperrealistic, 8k..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">대표 색상</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {PREVIEW_COLORS.map(c => (
                                                <button
                                                    key={c.value}
                                                    onClick={() => setEditColor(c.value)}
                                                    className={`w-8 h-8 rounded-full shrink-0 ${c.value} transition-transform hover:scale-110 ${editColor === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={() => setEditingStyle(null)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={!editName || !editPrompt}
                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {editingStyle.id.startsWith('custom-') ? '저장' : '새 스타일로 저장'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Smart Regenerate Modal */}
                {
                    regenerateScene && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
                            <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl border border-white/60 animate-in zoom-in-95">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                        <RefreshCcw className="h-5 w-5 text-amber-500" />
                                        문제 수정 & 재생성
                                    </h3>
                                    <button onClick={() => setRegenerateScene(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                    💡 Gemini가 현재 이미지를 분석하고, 문제를 해결한 새 프롬프트를 만들어 재생성합니다.
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-2 block">🔍 발생한 문제 선택</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { value: 'duplicate', label: '중복 객체', desc: '머리 2개, 팔 여러개 등' },
                                                { value: 'anatomy', label: '이상한 신체', desc: '기형, 비정상 비율' },
                                                { value: 'composition', label: '구도 문제', desc: '잘림, 어색한 앵글' },
                                                { value: 'style', label: '스타일 불일치', desc: '원하는 스타일 아님' },
                                            ].map(issue => (
                                                <button
                                                    key={issue.value}
                                                    onClick={() => setRegenerateIssue(issue.value)}
                                                    className={`p-3 rounded-xl text-left transition-all ${regenerateIssue === issue.value
                                                        ? 'bg-amber-100 border-2 border-amber-400 ring-2 ring-amber-200'
                                                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    <span className="text-sm font-bold block">{issue.label}</span>
                                                    <span className="text-[10px] text-gray-500">{issue.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">📝 상세 설명 (선택)</label>
                                        <textarea
                                            value={regenerateDescription}
                                            onChange={(e) => setRegenerateDescription(e.target.value)}
                                            placeholder="예: 오징어 머리가 두 개로 나왔어요. 한 마리만 나오게 해주세요."
                                            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none h-24"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={() => setRegenerateScene(null)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSmartRegenerate}
                                        disabled={isRegenerating}
                                        className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                    >
                                        {isRegenerating ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> 분석 중...</>
                                        ) : (
                                            <><RefreshCcw className="h-4 w-4" /> 수정 재생성</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
}
