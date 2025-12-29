import { Folder } from '@/types';

export const MOCK_FOLDERS: Folder[] = [
    { id: 'all', name: '전체', order: 0, createdAt: '2024-01-01', parentId: null, isSystem: true },
    { id: 'favorites', name: '즐겨찾기', order: 1, createdAt: '2024-01-01', parentId: null },
    { id: 'k-pop', name: 'K-POP', order: 2, createdAt: '2024-01-02', parentId: null },
    { id: 'gaming', name: '게임', order: 3, createdAt: '2024-01-03', parentId: null },
    { id: 'tech', name: '테크/IT', order: 4, createdAt: '2024-01-04', parentId: null },
];
