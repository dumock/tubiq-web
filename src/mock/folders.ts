export interface Folder {
    id: string;
    name: string;
    order: number;
    createdAt: string;
    parentId: string | null;
    isSystem?: boolean;
}

export const mockFolders: Folder[] = [
    {
        id: 'all',
        name: '전체',
        order: 0,
        createdAt: '2024-01-01',
        parentId: null,
        isSystem: true,
    },
    // Top-Level User Folders (parentId: null)
    {
        id: 'favorites',
        name: '즐겨찾기', // Korean Name
        order: 1,
        createdAt: '2024-01-02',
        parentId: null,
    },
    {
        id: 'clients',
        name: '클라이언트', // Korean Name
        order: 2,
        createdAt: '2024-01-03',
        parentId: null,
    },
    // Sub-Folders (parentId: <FolderID>)
    {
        id: 'collab',
        name: '협업', // Korean Name
        order: 1,
        createdAt: '2024-01-04',
        parentId: 'favorites',
    },
    {
        id: 'archive',
        name: '아카이브', // Korean Name
        order: 1,
        createdAt: '2024-01-05',
        parentId: 'clients',
    },
];
