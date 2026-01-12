
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, RotateCw, Trash2, Video, Clock, Scissors, Copy, Clipboard, Type, Sparkles, Edit3, ChevronRight, Plus, Minus, ChevronDown, Pipette } from 'lucide-react';

interface WordEditMenuProps {
    word: string;
    startTime: number;
    endTime: number;
    currentAnimation: string;
    currentDuration?: number;
    x: number;
    y: number;
    onClose: () => void;
    onAnimationChange: (animationId: string) => void;
    onDurationChange: (duration: number) => void;
    onReplaceVideo: () => void;
    onDetailEdit: () => void;
    ANIMATION_STYLES: { id: string; label: string; class: string }[];
    // Font Props
    currentFontSize?: string;
    currentFontFamily?: string;
    currentColor?: string;
    onFontSizeChange?: (size: string, scope: 'word' | 'subtitle' | 'all') => void;
    onFontFamilyChange?: (font: string, scope: 'word' | 'subtitle' | 'all') => void;
    onColorChange?: (color: string, scope: 'word' | 'subtitle' | 'all') => void;
    FONT_FAMILIES: { id: string; label: string; style: any }[];
    FONT_SIZES: { id: string; label: string; class: string }[];
}

const WordEditMenu = ({
    word,
    startTime,
    endTime,
    currentAnimation,
    currentDuration,
    x,
    y,
    onClose,
    onAnimationChange,
    onDurationChange,
    onReplaceVideo,
    onDetailEdit,
    ANIMATION_STYLES,
    currentFontSize,
    currentFontFamily,
    currentColor,
    onFontSizeChange,
    onFontFamilyChange,
    onColorChange,
    FONT_FAMILIES,
    FONT_SIZES
}: WordEditMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeSubMenu, setActiveSubMenu] = useState<'none' | 'animation' | 'font'>('none');
    const [applyScope, setApplyScope] = useState<'word' | 'subtitle' | 'all'>('word');
    const [mounted, setMounted] = useState(false);
    const [myColors, setMyColors] = useState<string[]>([]);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pickerColor, setPickerColor] = useState('#FF0000');
    const [hue, setHue] = useState(0);
    const [fontDropdownOpen, setFontDropdownOpen] = useState(false);

    // Helper to apply current styles to a new scope immediately
    const handleScopeChange = (newScope: 'word' | 'subtitle' | 'all') => {
        setApplyScope(newScope);
        // Apply currently selected values to the new scope if they exist
        if (currentFontFamily && onFontFamilyChange) onFontFamilyChange(currentFontFamily, newScope);
        if (currentFontSize && onFontSizeChange) onFontSizeChange(currentFontSize, newScope);
        if (currentColor && onColorChange) onColorChange(currentColor, newScope);
    };

    // Load saved colors from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('tubiq-my-colors');
        if (saved) {
            try { setMyColors(JSON.parse(saved)); } catch (e) { }
        }
    }, []);

    // Save to localStorage when myColors changes
    useEffect(() => {
        if (myColors.length > 0) {
            localStorage.setItem('tubiq-my-colors', JSON.stringify(myColors));
        }
    }, [myColors]);

    const addToMyColors = (color: string) => {
        if (!myColors.includes(color)) {
            setMyColors(prev => [color, ...prev].slice(0, 14)); // Max 14 colors (2 rows), newest first
        }
    };

    const removeFromMyColors = (color: string) => {
        setMyColors(prev => prev.filter(c => c !== color));
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close on click outside OR on scroll (but not scroll inside menu)
    useEffect(() => {
        const handleInteraction = (event: Event) => {
            // Check if click is outside
            if (event.type === 'mousedown' && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
            // Close on scroll ONLY if scroll is outside menu
            if (event.type === 'scroll' && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleInteraction);
            document.addEventListener('scroll', handleInteraction, true); // Capture phase for div scrolls
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleInteraction);
            document.removeEventListener('scroll', handleInteraction, true);
        };
    }, [onClose]);

    // Determine if menu should open upward or downward based on position
    const menuHeight = 500; // Increased to account for color picker
    // Check if window is available (client-side)
    const isClient = typeof window !== 'undefined';
    const clientHeight = isClient ? window.innerHeight : 1000;

    // If y is small (near top), open downward. If y is large (near bottom), open upward.
    const openUpward = y > (clientHeight / 2); // Split screen in half

    // Calculate total available height based on direction
    const availableHeight = openUpward ? y - 60 : clientHeight - y - 60; // Offset for anchor

    const style: React.CSSProperties = {
        position: 'fixed',
        left: x,
        top: y - 40, // Anchor slightly above the word
        zIndex: 9999,
        // Removed transform and maxHeight for root, used for anchor
    };

    const MenuItem = ({ icon: Icon, label, onClick, active = false }: { icon: any, label?: string, onClick: () => void, active?: boolean }) => (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-100 dark:border-zinc-700
                ${active ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700'}`}
        >
            <Icon className="h-3.5 w-3.5" />
            {label && <span>{label}</span>}
        </button>
    );

    const IconAction = ({ icon: Icon, onClick }: { icon: any, onClick: () => void }) => (
        <button
            onClick={onClick}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-zinc-700 rounded transition-colors"
        >
            <Icon className="h-3.5 w-3.5" />
        </button>
    );

    if (!mounted) return null;

    return createPortal(
        <div
            ref={menuRef}
            style={style}
            className="flex flex-col items-start animate-in fade-in zoom-in-95 duration-200 font-sans relative"
        >
            {/* Sub Menu (Animation Picker) - Moved Above */}
            {activeSubMenu === 'animation' && (
                <div className={`absolute left-0 ${openUpward ? 'bottom-full mb-2' : 'top-full mt-12'} bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 w-64 p-3 flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-200 z-50`}>
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 mb-1">
                        <span>ANIMATION TYPE</span>
                        {currentAnimation !== 'none' && <span className="text-indigo-500">{currentAnimation}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => onAnimationChange('none')}
                            className={`text-xs px-2 py-1.5 rounded text-left truncate ${!currentAnimation || currentAnimation === 'none'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-50 dark:bg-zinc-700/50 hover:bg-gray-100'}`}
                        >
                            없음
                        </button>
                        {ANIMATION_STYLES.map(anim => (
                            <button
                                key={anim.id}
                                onClick={() => onAnimationChange(anim.id)}
                                className={`text-xs px-2 py-1.5 rounded text-left truncate ${currentAnimation === anim.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-50 dark:bg-zinc-700/50 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                            >
                                {anim.label}
                            </button>
                        ))}
                    </div>

                    {/* Duration Slider inside Animation Menu */}
                    <div className="pt-2 border-t border-gray-100 dark:border-zinc-700 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Duration
                            </label>
                            <span className="text-[10px] font-mono text-gray-400">{currentDuration || 'Auto'}s</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.1"
                            value={currentDuration || 0.5}
                            onChange={(e) => onDurationChange(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>
                </div>
            )}

            {/* Sub Menu (Font Settings) - Moved Above */}
            {activeSubMenu === 'font' && (
                <div className={`absolute left-0 ${openUpward ? 'bottom-full mb-2' : 'top-full mt-12'} w-64 animate-in slide-in-from-bottom-2 duration-200 z-50`}>
                    <div
                        className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar"
                        style={{ maxHeight: Math.min(availableHeight - 20, 600) }}
                    >
                        {/* Apply Scope Selector */}
                        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-zinc-700/50 rounded-lg">
                            <button
                                onClick={() => handleScopeChange('word')}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${applyScope === 'word' ? 'bg-white dark:bg-zinc-600 shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                단어
                            </button>
                            <button
                                onClick={() => handleScopeChange('subtitle')}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${applyScope === 'subtitle' ? 'bg-white dark:bg-zinc-600 shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                테이블
                            </button>
                            <button
                                onClick={() => handleScopeChange('all')}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all ${applyScope === 'all' ? 'bg-white dark:bg-zinc-600 shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                전체
                            </button>
                        </div>

                        {/* Font Family & Size - Side by side */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1 relative">
                                <label className="text-[10px] font-bold text-gray-500">글꼴</label>
                                <div className="relative">
                                    <button
                                        onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
                                        className="w-full flex items-center justify-between text-xs p-1.5 rounded bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 outline-none hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
                                    >
                                        <span className="truncate mr-1" style={{ fontFamily: FONT_FAMILIES.find(f => f.id === currentFontFamily)?.style?.fontFamily }}>
                                            {FONT_FAMILIES.find(f => f.id === currentFontFamily)?.label || '폰트 선택'}
                                        </span>
                                        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${fontDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Dropdown Overlay (Transparent) */}
                                    {fontDropdownOpen && (
                                        <div className="fixed inset-0 z-10" onClick={() => setFontDropdownOpen(false)} />
                                    )}

                                    {/* Dropdown Options */}
                                    {fontDropdownOpen && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 dark:border-zinc-700 p-1.5 flex flex-col gap-0.5 max-h-60 overflow-y-auto custom-scrollbar z-20 animate-in fade-in zoom-in-95 duration-200 origin-top">
                                            {FONT_FAMILIES.map(font => (
                                                <button
                                                    key={font.id}
                                                    onClick={() => {
                                                        onFontFamilyChange && onFontFamilyChange(font.id, applyScope);
                                                        setFontDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-all
                                                            ${currentFontFamily === font.id
                                                            ? 'bg-indigo-600 text-white font-medium shadow-sm'
                                                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                                                    style={font.style}
                                                >
                                                    {font.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500">크기</label>
                                <select
                                    value={currentFontSize}
                                    onChange={(e) => onFontSizeChange && onFontSizeChange(e.target.value, applyScope)}
                                    className="w-full text-xs p-1.5 rounded bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 outline-none focus:border-indigo-500"
                                >
                                    {FONT_SIZES.map(size => (
                                        <option key={size.id} value={size.id}>{size.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Color Palette - Clean Style */}
                        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-700">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Font Color</label>
                                {/* Custom Color Picker Trigger */}
                                <button
                                    onClick={() => setShowColorPicker(!showColorPicker)}
                                    className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md hover:bg-indigo-100 dark:hover:bg-zinc-600 transition-colors"
                                >
                                    <Plus className="h-3 w-3" />
                                    <span>커스텀</span>
                                </button>
                            </div>

                            {/* My Colors Section - Moved Up & DnD Target */}
                            <div
                                className="pt-2 border-t border-gray-100 dark:border-zinc-700"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const color = e.dataTransfer.getData('text/plain');
                                    if (color && /^#[0-9A-F]{6}$/i.test(color)) {
                                        addToMyColors(color);
                                    }
                                }}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
                                        ⭐ 나만의 색상
                                        <span className="text-gray-400 font-normal">({myColors.length}/14)</span>
                                    </span>
                                    {myColors.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setMyColors([]);
                                                localStorage.removeItem('tubiq-my-colors');
                                            }}
                                            className="text-[9px] text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            전체삭제
                                        </button>
                                    )}
                                </div>
                                {myColors.length > 0 ? (
                                    <div className="grid grid-cols-7 gap-px justify-items-center mb-3">
                                        {myColors.map((color, index) => (
                                            <div
                                                key={color}
                                                className="relative group"
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('my-color-index', index.toString());
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation(); // Stop bubbling to parent drop handler
                                                    const draggedIndexStr = e.dataTransfer.getData('my-color-index');
                                                    if (draggedIndexStr) {
                                                        const draggedIndex = parseInt(draggedIndexStr, 10);
                                                        if (draggedIndex === index) return;

                                                        const newColors = [...myColors];
                                                        const [removed] = newColors.splice(draggedIndex, 1);
                                                        newColors.splice(index, 0, removed);
                                                        setMyColors(newColors);
                                                        localStorage.setItem('tubiq-my-colors', JSON.stringify(newColors));
                                                    } else {
                                                        // Allow dropping external color on specific item to add/replace? 
                                                        // Just delegate to parent or handle adding here if needed.
                                                        // For now, let's allow adding color even if dropped on an item
                                                        const newColor = e.dataTransfer.getData('text/plain');
                                                        if (newColor && /^#[0-9A-F]{6}$/i.test(newColor)) {
                                                            addToMyColors(newColor);
                                                        }
                                                    }
                                                }}
                                            >
                                                <button
                                                    onClick={() => onColorChange && onColorChange(color, applyScope)}
                                                    className={`w-6 h-6 rounded-md transition-transform active:scale-95 ${currentColor === color
                                                        ? 'ring-2 ring-indigo-500 ring-offset-1 z-10'
                                                        : 'hover:scale-110 hover:z-10'
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                    title={color}
                                                />
                                                {/* Delete button on hover */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeFromMyColors(color);
                                                    }}
                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Minus className="h-2 w-2 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-gray-400 text-center py-4 mb-3 bg-gray-50 dark:bg-zinc-800 rounded-md border-2 border-dashed border-gray-200 dark:border-zinc-700">
                                        색상을 드래그하여 추가하세요
                                    </div>
                                )}
                            </div>

                            {/* Presets Grid - 5 rows, 7 cols, 1px gap, Draggable Source */}
                            <div className="grid grid-cols-7 gap-px justify-items-center">
                                {[
                                    '#FFFFFF', '#000000', '#9CA3AF', '#4B5563', '#1F2937', '#DC2626', '#EA580C',
                                    '#FDBA74', '#FB923C', '#F59E0B', '#FACC15', '#FEF08A', '#84CC16', '#65A30D',
                                    '#D9F99D', '#4ADE80', '#22C55E', '#16A34A', '#15803D', '#10B981', '#059669',
                                    '#06B6D4', '#0891B2', '#0EA5E9', '#0284C7', '#2563EB', '#4F46E5', '#4338CA',
                                    '#7C3AED', '#9333EA', '#C026D3', '#DB2777', '#E11D48', '#BE123C', '#172554'
                                ].map(color => (
                                    <button
                                        key={color}
                                        draggable={true}
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', color)}
                                        onClick={() => onColorChange && onColorChange(color, applyScope)}
                                        className={`w-6 h-6 rounded-md transition-transform active:scale-95 cursor-grab active:cursor-grabbing ${currentColor === color
                                            ? 'ring-2 ring-indigo-500 ring-offset-1 z-10'
                                            : 'hover:scale-110 hover:z-10'
                                            }`}
                                        style={{ backgroundColor: color, boxShadow: color === '#FFFFFF' ? 'inset 0 0 0 1px #e5e7eb' : undefined }}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Custom Color Picker Panel - Positioned flush to the right */}
                    {showColorPicker && (
                        <div
                            className="absolute left-[calc(100%-1px)] top-0 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm rounded-r-xl rounded-bl-xl shadow-2xl border border-gray-200 dark:border-zinc-700 p-4 w-56 animate-in fade-in slide-in-from-left-2 duration-200"
                            style={{ zIndex: 10001 }}
                        >
                            <div className="space-y-3">
                                {/* Header */}
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">커스텀 색상</span>
                                    <button onClick={() => setShowColorPicker(false)} className="text-gray-400 hover:text-gray-600">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Saturation/Brightness Area */}
                                <div
                                    className="relative w-full h-32 rounded-lg cursor-crosshair overflow-hidden"
                                    style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))` }}
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const s = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                                        const v = Math.round(100 - ((e.clientY - rect.top) / rect.height) * 100);
                                        // Convert HSV to RGB
                                        const h = hue / 360;
                                        const sNorm = s / 100;
                                        const vNorm = v / 100;
                                        const i = Math.floor(h * 6);
                                        const f = h * 6 - i;
                                        const p = vNorm * (1 - sNorm);
                                        const q = vNorm * (1 - f * sNorm);
                                        const t = vNorm * (1 - (1 - f) * sNorm);
                                        let r = 0, g = 0, b = 0;
                                        switch (i % 6) {
                                            case 0: r = vNorm; g = t; b = p; break;
                                            case 1: r = q; g = vNorm; b = p; break;
                                            case 2: r = p; g = vNorm; b = t; break;
                                            case 3: r = p; g = q; b = vNorm; break;
                                            case 4: r = t; g = p; b = vNorm; break;
                                            case 5: r = vNorm; g = p; b = q; break;
                                        }
                                        const hex = '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
                                        setPickerColor(hex);
                                    }}
                                >
                                    <div className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: '50%', top: '50%' }} />
                                </div>

                                {/* Hue Slider */}
                                <div className="space-y-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        value={hue}
                                        onChange={(e) => setHue(Number(e.target.value))}
                                        className="w-full h-3 rounded-full appearance-none cursor-pointer"
                                        style={{
                                            background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                                        }}
                                    />
                                </div>

                                {/* Preview & Confirm */}
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-10 h-10 rounded-lg border border-gray-200 dark:border-zinc-600 shadow-inner"
                                        style={{ backgroundColor: pickerColor }}
                                    />
                                    <div className="flex-1 text-xs font-mono text-gray-500">{pickerColor}</div>

                                    {/* Eye Dropper */}
                                    <button
                                        onClick={() => {
                                            if (!('EyeDropper' in window)) {
                                                alert('이 브라우저는 스포이드 기능을 지원하지 않습니다.');
                                                return;
                                            }
                                            const eyeDropper = new (window as any).EyeDropper();
                                            eyeDropper.open().then((result: any) => {
                                                if (result.sRGBHex) {
                                                    setPickerColor(result.sRGBHex);
                                                }
                                            }).catch((e: any) => {
                                                console.log('EyeDropper failed/canceled', e);
                                            });
                                        }}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-600 rounded-lg text-gray-500 transition-colors mr-1"
                                        title="스포이드 (화면 색상 추출)"
                                    >
                                        <Pipette className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (onColorChange) onColorChange(pickerColor, applyScope);
                                            addToMyColors(pickerColor);
                                            setShowColorPicker(false);
                                        }}
                                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                        확인
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )
            }

            {/* Main Horizontal Menu Bar */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 flex items-center divide-x divide-gray-100 dark:divide-zinc-700 -ml-[32px]">
                {/* 1. Clipboard Group (Icons only) */}
                <div className="flex items-center pr-1">
                    <IconAction icon={Scissors} onClick={() => console.log('Cut')} />
                    <IconAction icon={Copy} onClick={() => console.log('Copy')} />
                    <IconAction icon={Clipboard} onClick={() => console.log('Paste')} />
                </div>

                {/* 2. Menu Items */}
                <MenuItem
                    icon={Type}
                    label="폰트"
                    onClick={() => setActiveSubMenu(activeSubMenu === 'font' ? 'none' : 'font')}
                    active={activeSubMenu === 'font'}
                />

                <MenuItem
                    icon={Sparkles}
                    label="애니메이션"
                    onClick={() => setActiveSubMenu(activeSubMenu === 'animation' ? 'none' : 'animation')}
                    active={activeSubMenu === 'animation'}
                />

                <MenuItem icon={Edit3} label="상세편집" onClick={onDetailEdit} />

                <MenuItem icon={Video} label="클립삽입" onClick={onReplaceVideo} />

                {/* Close */}
                <button onClick={onClose} className="px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X className="h-4 w-4" />
                </button>
            </div>



            {/* Arrow at bottom of main bar if no submenu, or bottom of submenu */}
            {
                activeSubMenu === 'none' && (
                    <div className="ml-4 w-3 h-3 bg-white dark:bg-zinc-800 border-r border-b border-gray-200 dark:border-zinc-700 transform rotate-45 -mt-1.5 z-50"></div>
                )
            }
        </div >,
        document.body
    );
};

export default WordEditMenu;
