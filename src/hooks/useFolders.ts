'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Folder } from '@/types';

interface DbFolder {
    id: string;
    name: string;
    parent_id: string | null;
    sort_order: number;
    created_at: string;
    user_id: string;
}

// Map DB folder to UI Folder type
function mapDbToFolder(dbFolder: DbFolder): Folder {
    return {
        id: dbFolder.id,
        name: dbFolder.name,
        parentId: dbFolder.parent_id,
        order: dbFolder.sort_order,
        createdAt: dbFolder.created_at
    };
}

export function useFolders(scope: 'channels' | 'videos' | 'analysis' = 'channels') {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch folders from API with scope filter
    const fetchFolders = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setFolders([]);
                setIsLoading(false);
                return;
            }

            const res = await fetch(`/api/folders?scope=${scope}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();

            if (json.ok && Array.isArray(json.data)) {
                setFolders(json.data.map(mapDbToFolder));
            } else {
                setError(json.message || 'Failed to fetch folders');
            }
        } catch (err) {
            console.error('Fetch folders error:', err);
            setError('Network error');
        } finally {
            setIsLoading(false);
        }
    }, [scope]);

    // Create folder with scope
    const createFolder = useCallback(async (name: string, parentId: string | null = null): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setError('Not authenticated');
                return false;
            }

            const res = await fetch('/api/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, parent_id: parentId, scope })
            });

            const json = await res.json();

            if (json.ok) {
                await fetchFolders();
                return true;
            } else {
                setError(json.message || 'Failed to create folder');
                return false;
            }
        } catch (err) {
            console.error('Create folder error:', err);
            setError('Network error');
            return false;
        }
    }, [fetchFolders, scope]);

    // Rename folder
    const renameFolder = useCallback(async (id: string, name: string): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setError('Not authenticated');
                return false;
            }

            const res = await fetch('/api/folders', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, name })
            });

            const json = await res.json();

            if (json.ok) {
                await fetchFolders();
                return true;
            } else {
                setError(json.message || 'Failed to rename folder');
                return false;
            }
        } catch (err) {
            console.error('Rename folder error:', err);
            setError('Network error');
            return false;
        }
    }, [fetchFolders]);

    // Delete folder
    const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setError('Not authenticated');
                return false;
            }

            const res = await fetch(`/api/folders?id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const json = await res.json();

            if (json.ok) {
                await fetchFolders();
                return true;
            } else {
                setError(json.message || 'Failed to delete folder');
                return false;
            }
        } catch (err) {
            console.error('Delete folder error:', err);
            setError('Network error');
            return false;
        }
    }, [fetchFolders]);

    // Initial fetch
    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);

    return {
        folders,
        isLoading,
        error,
        fetchFolders,
        createFolder,
        renameFolder,
        deleteFolder
    };
}
