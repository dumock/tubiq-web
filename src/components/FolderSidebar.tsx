'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Folder as FolderIcon, FolderDot, Plus, GripVertical, Pencil, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Folder } from '../mock/folders';
import {
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FolderSidebarProps {
    folders: Folder[];
    counts: Record<string, number>;
    selectedFolderId: string;
    onSelect: (folderId: string) => void;
    onRename: (folderId: string, newName: string) => void;
    onDelete: (folderId: string) => void;
    onCreateFolder: (folder: Folder) => void;
    lastDroppedFolderId?: string | null;
    activeType?: 'FOLDER' | 'ASSET' | null;
}

interface FolderItemProps {
    folder: Folder;
    count?: number;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    isDraggable?: boolean;
    isJustDropped?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    depth?: number;
    hasChildren?: boolean;
    isInitiallyEditing?: boolean;
    activeType?: 'FOLDER' | 'ASSET' | null;
}

/**
 * FolderItem: Used for Parent (depth 0) and Child (depth 1) folders.
 * Strictly enforces 2-level UI.
 */
function FolderItem({
    folder,
    count,
    isSelected,
    onSelect,
    onRename,
    onDelete,
    isDraggable,
    isJustDropped,
    isCollapsed,
    onToggleCollapse,
    depth = 0,
    hasChildren = false,
    isInitiallyEditing = false,
    activeType
}: FolderItemProps) {
    const [isEditing, setIsEditing] = useState(isInitiallyEditing);
    const [editValue, setEditValue] = useState(folder.name);
    const inputRef = useRef<HTMLInputElement>(null);

    const sortable = useSortable({
        id: folder.id,
        data: { type: 'FOLDER', folder },
        disabled: !isDraggable || isEditing
    });

    const droppable = useDroppable({
        id: `folder:${folder.id}`,
        data: { type: 'FOLDER', folderId: folder.id }
    });

    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = sortable;

    // Outer Sortable Wrapper Style (Move/Reorder)
    const sortableStyle = {
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        zIndex: isDragging ? 10 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    const isOver = droppable.isOver;

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        const trimmed = editValue.trim();
        if (trimmed.length > 0 && trimmed !== folder.name) {
            onRename(folder.id, trimmed);
        } else {
            setEditValue(folder.name);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(folder.name);
            setIsEditing(false);
        }
    };

    // Inner Droppable Visuals (Target Highlight)
    let wrapperClasses = "relative flex items-center transition-all duration-300 rounded-xl w-full ";
    if (isDragging) {
        wrapperClasses += "shadow-2xl ring-2 ring-indigo-500/30 bg-white dark:bg-zinc-800 scale-[1.02] rotate-1 ";
    } else if (isJustDropped) {
        wrapperClasses += "bg-indigo-50/80 ring-2 ring-indigo-400 dark:bg-indigo-900/30 dark:ring-indigo-400 animate-pulse ";
    } else if (isOver && activeType === 'ASSET' && !isEditing) {
        wrapperClasses += "bg-indigo-50/60 ring-2 ring-indigo-500 dark:bg-indigo-900/40 dark:ring-indigo-400 scale-[1.01] ";
    }

    const paddingLeftClass = depth === 1 ? 'pl-8' : 'pl-1';

    return (
        <div
            ref={setSortableRef}
            style={sortableStyle}
            {...attributes}
            className="touch-none outline-none overflow-visible"
        >
            <div
                ref={droppable.setNodeRef}
                className={wrapperClasses}
            >
                {isEditing ? (
                    <div className={`flex w-full items-center py-2 ${paddingLeftClass}`}>
                        <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={handleKeyDown}
                            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : (
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(folder.id)}
                        onDoubleClick={() => {
                            setIsEditing(true);
                            setEditValue(folder.name);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(folder.id);
                            }
                        }}
                        className={`group flex w-full cursor-pointer items-center justify-between rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 select-none outline-none ${paddingLeftClass} ${isSelected
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                            : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100'
                            }`}
                    >
                        {/* Left Part: Drag, Chevron, Icon, Name */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden pr-1">
                            {/* Drag Handle - Only for user folders */}
                            {isDraggable && (
                                <div
                                    {...listeners}
                                    className="shrink-0 p-0.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <GripVertical className="h-3 w-3" />
                                </div>
                            )}

                            {/* Chevron Slot - Always rendered for Parents (depth 0) to maintain alignment */}
                            {depth === 0 && (
                                <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                                    {hasChildren && (
                                        <div
                                            className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onToggleCollapse) onToggleCollapse();
                                            }}
                                        >
                                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </div>
                                    )}
                                </div>
                            )}

                            {depth === 0 ? (
                                <FolderIcon
                                    className={`shrink-0 h-4.5 w-4.5 transition-all duration-300 ${isSelected
                                        ? 'fill-white/20 text-white scale-110'
                                        : 'fill-amber-400/20 text-amber-500 group-hover:scale-110 group-hover:fill-amber-400/40'
                                        }`}
                                />
                            ) : (
                                <FolderDot
                                    className={`shrink-0 h-4 w-4 transition-all duration-300 ${isSelected
                                        ? 'fill-white/20 text-white scale-110'
                                        : 'text-gray-400 group-hover:text-gray-600 group-hover:scale-110 dark:text-gray-500'}`}
                                />
                            )}
                            <span className="flex-1 truncate text-left tracking-tight">
                                {folder.name}
                            </span>
                        </div>

                        {/* Right Part: Actions & Count */}
                        <div className="flex items-center shrink-0">
                            {/* Actions: Rename & Delete */}
                            {/* Actions: Rename & Delete - Now they don't take space unless hovered */}
                            <div className="hidden group-hover:flex items-center gap-1 mr-2 animate-in fade-in slide-in-from-right-1 duration-200">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditing(true);
                                        setEditValue(folder.name);
                                    }}
                                    className={`p-1 rounded transition-all ${isSelected
                                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                                        : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-700 dark:hover:text-indigo-400'}`}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(folder.id);
                                    }}
                                    className={`p-1 rounded transition-all ${isSelected
                                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                                        : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400'}`}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {count !== undefined && (
                                <span className={`mr-3 text-[11px] font-bold px-2 py-0.5 rounded-full transition-all duration-300 ${isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-500'}`}>
                                    {count}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function FolderSidebar({ folders, counts, selectedFolderId, onSelect, onRename, onDelete, onCreateFolder, lastDroppedFolderId, activeType }: FolderSidebarProps) {
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
    const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

    useEffect(() => {
        if (justCreatedId) {
            const timer = setTimeout(() => setJustCreatedId(null), 500);
            return () => clearTimeout(timer);
        }
    }, [justCreatedId]);

    const toggleFolder = (id: string) => {
        const newSet = new Set(collapsedFolders);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setCollapsedFolders(newSet);
    };

    const handleDeleteClick = (id: string) => {
        if (window.confirm("폴더를 삭제할까요? 하위 폴더도 함께 삭제됩니다.")) {
            onDelete(id);
        }
    };

    // Data Filtering for 2-level Tree
    // 1. Define Parents: strictly top-level, non-system, not 'all'
    const parentFolders = folders.filter(f => f.parentId === null && !f.isSystem && f.id !== 'all');

    const isParentFolder = (id: string) => parentFolders.some(f => f.id === id);

    const handleAddParent = () => {
        const newId = crypto.randomUUID();
        const newFolder: Folder = {
            id: newId,
            name: '새 폴더',
            order: parentFolders.length + 1,
            createdAt: new Date().toISOString(),
            parentId: null
        };
        onCreateFolder(newFolder);
        onSelect(newId); // Immediately select the new folder
        setJustCreatedId(newId);
    };

    const handleAddChild = () => {
        // Enforce 2-level creation: Only allow if selected is a valid parent
        if (selectedFolderId === 'all' || !selectedFolderId) {
            console.log("하위 폴더 추가 불가: '전체'는 시스템 폴더입니다.");
            return;
        }

        // Use strictly defined parent check
        if (!isParentFolder(selectedFolderId)) {
            console.log("하위 폴더 추가 불가: 선택된 폴더가 부모 폴더가 아니거나 이미 하위 폴더입니다.");
            return;
        }

        // Auto-expand parent when adding child
        if (collapsedFolders.has(selectedFolderId)) {
            toggleFolder(selectedFolderId);
        }

        const newId = crypto.randomUUID();
        const newFolder: Folder = {
            id: newId,
            name: '새 폴더',
            order: 999,
            createdAt: new Date().toISOString(),
            parentId: selectedFolderId // Strict: parentId is the selected parent ID
        };
        onCreateFolder(newFolder);
        onSelect(newId); // Immediately select the new folder
        setJustCreatedId(newId);
    };

    // Construction of the flattened list for Dnd-Kit SortableContext
    // STRICT 2-LEVEL RENDERING logic
    const visibleFolders: { folder: Folder; depth: number; hasChildren: boolean }[] = [];

    parentFolders.forEach(parent => {
        // Children must have this parent's ID.
        // Any folder pointing to a child ID (Level 3) is automatically excluded here 
        // because we only iterate over 'parentFolders' (Level 1).
        const children = folders.filter(f => f.parentId === parent.id);

        visibleFolders.push({
            folder: parent,
            depth: 0,
            hasChildren: children.length > 0
        });

        // Only add children if parent is NOT collapsed
        if (!collapsedFolders.has(parent.id)) {
            children.forEach(child => {
                visibleFolders.push({
                    folder: child,
                    depth: 1, // Forced depth 1
                    hasChildren: false // Children cannot have children visually
                });
            });
        }
    });

    const isChildCreationDisabled = !selectedFolderId || selectedFolderId === 'all' || !isParentFolder(selectedFolderId);

    return (
        <aside className="flex h-full w-full flex-col bg-white/70 px-3.5 py-6 backdrop-blur-xl border border-gray-100 rounded-[32px] dark:bg-zinc-900/70 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">카테고리</h2>
                <button
                    onClick={() => onSelect('all')}
                    className="h-8 px-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-full transition-all active:scale-95 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                >
                    전체보기
                </button>
            </div>

            {/* Folder Navigation Content */}
            <div className="flex-1 overflow-visible -mx-1 px-1">
                {/* Tree Structure - extra padding for ring-offset */}
                <div className="space-y-0.5 overflow-visible py-1">
                    <SortableContext
                        items={visibleFolders.map(i => i.folder.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {visibleFolders.map(({ folder, depth, hasChildren }) => (
                            <FolderItem
                                key={folder.id}
                                folder={folder}
                                count={counts[folder.id] || 0}
                                isSelected={selectedFolderId === folder.id}
                                onSelect={onSelect}
                                onRename={onRename}
                                onDelete={handleDeleteClick}
                                isDraggable={true}
                                isJustDropped={lastDroppedFolderId === folder.id}
                                depth={depth}
                                hasChildren={hasChildren}
                                isCollapsed={collapsedFolders.has(folder.id)}
                                onToggleCollapse={() => toggleFolder(folder.id)}
                                isInitiallyEditing={folder.id === justCreatedId}
                                activeType={activeType}
                            />
                        ))}
                    </SortableContext>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap gap-3">
                <button
                    onClick={handleAddParent}
                    className="group relative flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 text-sm font-bold text-white transition-all hover:bg-black hover:shadow-lg active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                >
                    <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                    부모 폴더
                </button>
                <button
                    onClick={handleAddChild}
                    disabled={isChildCreationDisabled}
                    className={`group relative flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 transition-all active:scale-95 ${isChildCreationDisabled
                        ? 'border-gray-100 text-gray-300 dark:border-zinc-800 dark:text-zinc-700 cursor-not-allowed'
                        : 'border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white dark:border-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-500 dark:hover:text-white shadow-sm'
                        }`}
                >
                    <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                    하위 폴더
                </button>
            </div>
        </aside>
    );
}
