'use client';

import { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/AuthProvider';
import {
    User,
    Mail,
    Calendar,
    Clock,
    Shield,
    Edit3,
    Save,
    X,
    Trash2,
    Key,
    Activity,
    BarChart3,
    FileVideo,
    Folder,
    AlertCircle,
    Camera,
    Upload,
    Loader2
} from 'lucide-react';

export default function AccountPage() {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user?.email?.split('@')[0] || '');
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mock user stats
    const userStats = {
        joinedAt: '2023.10.15',
        lastLogin: '방금 전',
        totalChannels: 42,
        totalVideos: 1284,
        totalFolders: 8,
        storageUsed: '2.4 GB',
        storageLimit: '10 GB'
    };

    const handleSaveProfile = () => {
        // TODO: Implement profile update API call
        setIsEditing(false);
        alert('프로필이 업데이트되었습니다.');
    };

    const handlePasswordChange = () => {
        // TODO: Implement password change API call
        setShowPasswordChange(false);
        alert('비밀번호가 변경되었습니다.');
    };

    const handleDeleteAccount = () => {
        if (confirm('정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            // TODO: Implement account deletion API call
            alert('계정 삭제 요청이 접수되었습니다.');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('JPG, PNG, WebP 형식만 업로드 가능합니다.');
            return;
        }

        // Validate file size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('파일 크기는 2MB 이하여야 합니다.');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUploadAvatar = async () => {
        if (!fileInputRef.current?.files?.[0]) return;

        const file = fileInputRef.current.files[0];
        const formData = new FormData();
        formData.append('avatar', file);

        try {
            setIsUploading(true);

            // Get auth token from supabase
            const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();
            if (!session) {
                alert('로그인이 필요합니다.');
                return;
            }

            const response = await fetch('/api/user/avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });

            const result = await response.json();

            if (result.ok) {
                setAvatarUrl(result.data.avatar_url);
                setAvatarPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                alert('프로필 사진이 업데이트되었습니다!');
            } else {
                alert(`업로드 실패: ${result.message}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('업로드 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancelUpload = () => {
        setAvatarPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Load avatar on mount
    useEffect(() => {
        const loadAvatar = async () => {
            if (user?.user_metadata?.avatar_url) {
                setAvatarUrl(user.user_metadata.avatar_url);
            }
        };
        loadAvatar();
    }, [user]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />

            <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        내 계정
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        계정 정보를 관리하고 프로필을 수정할 수 있습니다.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column: Profile Card */}
                    <div className="lg:col-span-1">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="flex flex-col items-center text-center">
                                {/* Avatar with Upload */}
                                <div className="relative mb-4">
                                    {avatarPreview || avatarUrl ? (
                                        <img
                                            src={avatarPreview || avatarUrl || ''}
                                            alt="Profile"
                                            className="h-24 w-24 rounded-full object-cover ring-4 ring-indigo-100 dark:ring-indigo-900/30"
                                        />
                                    ) : (
                                        <div className="h-24 w-24 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-indigo-100 dark:ring-indigo-900/30 uppercase">
                                            {user?.email?.[0] || 'U'}
                                        </div>
                                    )}

                                    {/* Upload Button Overlay */}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="absolute bottom-0 right-0 rounded-full bg-indigo-600 p-2 text-white shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                                    >
                                        {isUploading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Camera className="h-4 w-4" />
                                        )}
                                    </button>

                                    {/* Hidden File Input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>

                                {/* Upload Preview Actions */}
                                {avatarPreview && (
                                    <div className="w-full mb-4 space-y-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUploadAvatar}
                                                disabled={isUploading}
                                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                                            >
                                                {isUploading ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        업로드 중...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-3 w-3" />
                                                        업로드
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={handleCancelUpload}
                                                disabled={isUploading}
                                                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 transition-all disabled:opacity-50"
                                            >
                                                <X className="h-3 w-3" />
                                                취소
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            JPG, PNG, WebP (최대 2MB)
                                        </p>
                                    </div>
                                )}

                                {/* User Info */}
                                {isEditing ? (
                                    <div className="w-full space-y-3">
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-center focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                                            placeholder="표시 이름"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveProfile}
                                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-all"
                                            >
                                                <Save className="h-4 w-4" />
                                                저장
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 transition-all"
                                            >
                                                <X className="h-4 w-4" />
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {displayName}
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-all">
                                            {user?.email}
                                        </p>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 transition-all"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                            프로필 수정
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Account Info */}
                            <div className="mt-6 space-y-3 border-t border-gray-100 pt-6 dark:border-zinc-800">
                                <div className="flex items-center gap-3 text-sm">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-400">
                                        가입일: {userStats.joinedAt}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-400">
                                        최근 접속: {userStats.lastLogin}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <Shield className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-400">
                                        권한: 일반 회원
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Stats & Settings */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Usage Statistics */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">사용 통계</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">채널</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.totalChannels}</p>
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileVideo className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">영상</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.totalVideos}</p>
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Folder className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">폴더</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.totalFolders}</p>
                                </div>
                            </div>

                            {/* Storage Usage */}
                            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">저장공간</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        {userStats.storageUsed} / {userStats.storageLimit}
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-700">
                                    <div className="h-2 rounded-full bg-indigo-600" style={{ width: '24%' }} />
                                </div>
                            </div>
                        </div>

                        {/* Security Settings */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                    <Key className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">보안 설정</h3>
                            </div>

                            {showPasswordChange ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            현재 비밀번호
                                        </label>
                                        <input
                                            type="password"
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            새 비밀번호
                                        </label>
                                        <input
                                            type="password"
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            새 비밀번호 확인
                                        </label>
                                        <input
                                            type="password"
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handlePasswordChange}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-all"
                                        >
                                            <Save className="h-4 w-4" />
                                            비밀번호 변경
                                        </button>
                                        <button
                                            onClick={() => setShowPasswordChange(false)}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 transition-all"
                                        >
                                            <X className="h-4 w-4" />
                                            취소
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowPasswordChange(true)}
                                    className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 transition-all"
                                >
                                    <span>비밀번호 변경</span>
                                    <Edit3 className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Danger Zone */}
                        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6 shadow-sm dark:bg-red-900/10 dark:border-red-900/30">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="rounded-xl bg-red-50 p-2 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    <AlertCircle className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-bold text-red-900 dark:text-red-400">위험 구역</h3>
                            </div>

                            <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                                계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                            </p>

                            <button
                                onClick={handleDeleteAccount}
                                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-all"
                            >
                                <Trash2 className="h-4 w-4" />
                                계정 삭제
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
