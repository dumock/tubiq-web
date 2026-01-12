import React, { memo } from 'react';
import { Video, ListVideo, Trash2, Eye, EyeOff } from 'lucide-react';
import WordDetailEditor from '../../src/components/WordDetailEditor';

interface Subtitle {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    animation?: string;
    fontSize?: string;
    fontFamily?: string;
    translatedText?: string;
    words?: { text: string; startTime: number; endTime: number }[];
}

interface SubtitleRowProps {
    sub: Subtitle;
    index: number;
    isActive: boolean;
    isExcluded: boolean;
    isCutMode: boolean;
    currentTime: number; // Still needed for word highlighting
    onSeek: (time: number) => void;
    onUpdate: (updatedSub: Subtitle) => void;
    onDelete: (id: string) => void;
    onToggleExclude: (id: string) => void;
    onSplit: (sub: Subtitle, cursorPosition: number) => void;
    onMergeNext: (sub: Subtitle) => void;
    onMergePrev: (sub: Subtitle) => void;
    FONT_SIZES: { id: string; label: string; class: string }[];
    FONT_FAMILIES: { id: string; label: string; style: any }[];
    ANIMATION_STYLES: { id: string; label: string; class: string }[];
    onHoverStart?: (startTime: number, endTime: number, x: number, y: number) => void;
    onHoverEnd?: () => void;
    onWordClick?: (word: string, startTime: number, endTime: number, x: number, y: number, wordIdx: number) => void;
    isDetailMode?: boolean;
    editingWordIndex?: number;
    audioUrl?: string;
    onCloseDetail?: () => void;
    onWordUpdate?: (word: any, start: number, end: number) => void;
}

// Helper to split text into words with distributed duration (duplicated from page.tsx)
const splitTextToWords = (text: string, startTime: number, endTime: number) => {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];

    const duration = endTime - startTime;
    const durationPerWord = duration / words.length;

    return words.map((word, i) => ({
        text: word,
        startTime: startTime + (i * durationPerWord),
        endTime: startTime + ((i + 1) * durationPerWord)
    }));
};

const SubtitleRow = memo(({
    sub,
    index,
    isActive,
    isExcluded,
    isCutMode,
    currentTime,
    onSeek,
    onUpdate,
    onDelete,
    onToggleExclude,
    onSplit,
    onMergeNext,
    onMergePrev,
    FONT_SIZES,
    FONT_FAMILIES,
    ANIMATION_STYLES,
    onHoverStart,
    onHoverEnd,
    onWordClick,
    isDetailMode,
    editingWordIndex,
    audioUrl,
    onCloseDetail,
    onWordUpdate
}: SubtitleRowProps) => {
    // Debug log
    if (isDetailMode) {
        console.log("SubtitleRow detail mode:", { isDetailMode, editingWordIndex, subId: sub.id });
    }

    // Calculate words for detail editing context
    const words = (sub.words && sub.words.length > 0) ? sub.words : splitTextToWords(sub.text, sub.startTime, sub.endTime);
    const targetWord = (isDetailMode && editingWordIndex !== undefined && words[editingWordIndex])
        ? words[editingWordIndex]
        : { text: sub.text, startTime: sub.startTime, endTime: sub.endTime };

    return (
        <div
            className={`group relative flex flex-col gap-0 p-0 rounded-xl transition-all border ${isExcluded
                ? 'opacity-40 bg-gray-100 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 grayscale'
                : isActive
                    ? 'bg-white border-indigo-400 ring-1 ring-indigo-400 dark:bg-zinc-800 dark:border-indigo-500 shadow-md transform scale-[1.002] z-10'
                    : 'bg-white dark:bg-zinc-800/60 border-gray-100 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600'
                }`}
            onClick={() => onSeek(sub.startTime + 0.05)}
        >
            {/* Main Row Content */}
            <div className="w-full flex items-start gap-3 p-3">
                {/* Left: Index & Checkbox */}
                <div className="w-12 flex flex-col items-center gap-2 pt-1">
                    <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                    <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                </div>

                {/* Middle: Word Boxes & Text Input (Vrew Style) */}
                <div className="flex-1 flex flex-col gap-3">
                    {/* Row 1: Video Edit Badge + Word Chips */}
                    <div className="flex items-center flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded text-[11px] font-bold border border-sky-100 dark:border-sky-800">
                            <Video className="h-3 w-3" />
                            영상편집
                        </div>

                        {/* Simulated Word Boxes */}
                        <div className="flex flex-wrap gap-1">
                            {(sub.words && sub.words.length > 0 ? sub.words : splitTextToWords(sub.text, sub.startTime, sub.endTime)).map((wordData, wIdx) => (
                                <div
                                    key={wIdx}
                                    className={`px-2 py-1 border rounded text-xs shadow-sm cursor-pointer transition-colors ${currentTime >= wordData.startTime && currentTime < wordData.endTime
                                        ? 'bg-indigo-500 text-white border-indigo-600 font-bold scale-105 shadow-md'
                                        : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onWordClick) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            onWordClick(wordData.text, wordData.startTime, wordData.endTime, rect.left + rect.width / 2, rect.top, wIdx);
                                        }
                                        onSeek(wordData.startTime + 0.05);
                                    }}
                                    onMouseEnter={(e) => {
                                        e.stopPropagation();
                                        if (onHoverStart) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            onHoverStart(wordData.startTime, wordData.endTime, rect.left + rect.width / 2, rect.top);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        if (onHoverEnd) onHoverEnd();
                                    }}
                                >
                                    {wordData.text}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Row 2: Full Text Input + Translation */}
                    <div className="relative group/input">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <ListVideo className="h-4 w-4" />
                        </div>
                        <input
                            type="text"
                            value={sub.text}
                            onChange={(e) => {
                                const newText = e.target.value;
                                // Update text and regenerate words locally
                                onUpdate({
                                    ...sub,
                                    text: newText,
                                    words: splitTextToWords(newText, sub.startTime, sub.endTime)
                                });
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const target = e.currentTarget;
                                    const cursorPosition = target.selectionStart || 0;
                                    onSplit(sub, cursorPosition);
                                }
                                if (e.key === 'Delete') {
                                    const target = e.currentTarget;
                                    const cursorPosition = target.selectionStart || 0;
                                    if (cursorPosition === sub.text.length) {
                                        e.preventDefault();
                                        onMergeNext(sub);
                                    }
                                }
                                if (e.key === 'Backspace') {
                                    const target = e.currentTarget;
                                    if (target.selectionStart === 0 && target.selectionEnd === 0) {
                                        e.preventDefault();
                                        onMergePrev(sub);
                                    }
                                }
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                    {sub.translatedText && (
                        <div className="text-[10px] text-gray-400 px-2">{sub.translatedText}</div>
                    )}
                </div>

                {/* Right: Existing Controls */}
                <div className="flex items-start gap-2 pt-1">
                    {/* Effect */}
                    <div className="w-24">
                        <select
                            value={sub.animation || 'none'}
                            onChange={(e) => onUpdate({ ...sub, animation: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full p-1.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                        >
                            {ANIMATION_STYLES.map(style => (
                                <option key={style.id} value={style.id}>{style.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Size */}
                    <div className="w-16">
                        <select
                            value={sub.fontSize || 16}
                            onChange={(e) => onUpdate({ ...sub, fontSize: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full p-1.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                        >
                            {FONT_SIZES.map(size => (
                                <option key={size.id} value={size.id}>{size.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Font */}
                    <div className="w-24">
                        <select
                            value={sub.fontFamily || 'Pretendard'}
                            onChange={(e) => onUpdate({ ...sub, fontFamily: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full p-1.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                        >
                            {FONT_FAMILIES.map(font => (
                                <option key={font.id} value={font.id}>{font.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Delete/Excluded Toggle */}
                    <div className="w-12 flex justify-center">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isCutMode) {
                                    onToggleExclude(sub.id);
                                } else {
                                    onDelete(sub.id);
                                }
                            }}
                            className={`p-1.5 rounded transition-colors ${isCutMode
                                ? isExcluded ? 'text-rose-500 bg-rose-50' : 'text-gray-400 hover:text-rose-500'
                                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                        >
                            {isCutMode ? (isExcluded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />) : <Trash2 className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Detail Editor (Full Width Below) */}
            {isDetailMode && (
                <div className="w-full px-4 pb-4 bg-gray-50/50 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-800 rounded-b-xl">
                    <WordDetailEditor
                        audioUrl={audioUrl || ''}
                        word={targetWord.text}
                        startTime={targetWord.startTime}
                        endTime={targetWord.endTime}
                        onUpdate={(start, end) => onWordUpdate && onWordUpdate(targetWord.text, start, end)}
                        onClose={onCloseDetail || (() => { })}
                    />
                </div>
            )}
        </div >
    );
}, (prev, next) => {
    // Custom comparison for performance
    // Only re-render if:
    // 1. Subtitle data changed
    if (prev.sub !== next.sub) return false;
    // 2. Active status changed
    if (prev.isActive !== next.isActive) return false;
    // 3. Excluded status changed
    if (prev.isExcluded !== next.isExcluded) return false;
    // 4. Cut mode changed
    if (prev.isCutMode !== next.isCutMode) return false;
    // 5. Detail mode changed
    if (prev.isDetailMode !== next.isDetailMode) return false;
    if (prev.editingWordIndex !== next.editingWordIndex) return false;
    // 5. Highlighting (Karaoke) logic:
    // This is tricky. We pass currentTime. If we compare strictly, every frame updates.
    // BUT! We only care about highlighing WORDS inside the row.
    // If we are NOT active, word highlighting doesn't matter (usually).
    // Actually, word highlight relies on currentTime being passed.
    // If we want SMOOTH word highlighting, we CANNOT block updates when currentTime changes IF the row IS active.

    // Optimization: Only allow re-render on currentTime change IF isActive is true.
    // If not active, ignoring currentTime changes is fine.
    if (prev.isActive && next.isActive && prev.currentTime !== next.currentTime) return false;

    // If both inactive, currentTime change shouldn't trigger re-render
    return true;
});

export default SubtitleRow;
